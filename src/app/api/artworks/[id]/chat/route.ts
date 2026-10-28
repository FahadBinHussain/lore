import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { artists, artworkChatMessages, artworkChats, artworkExternalIds, artworks, users } from '@/db/schema';
import { INTERN_MODEL, InternError, internChat, type InternContentPart, type InternMessage } from '@/lib/ai/intern';
import { ArtworkImageError, loadArtworkImage } from '@/lib/ai/artwork-image';
import { artworkChatSystemPrompt } from '@/lib/ai/artwork-prompt';

// Engine: intern-ai discovery endpoint, model `qwen3.8-27b` (switched
// 2026-10-24, replacing the opencode zen free lane). Zen budgeted every free
// model per client IP per day and Vercel's shared egress ran dry daily; this is
// a normal metered OpenAI-compatible API, so that quota problem is gone.
//
// Runtime is nodejs because a measured vision turn takes 9–20 s and can spike
// past edge's 30 s wall — the reply is streamed, but the function itself still
// has to stay alive until the model finishes. `neon-http` and JWT sessions work
// on both runtimes, so nothing here needs the edge.
export const runtime = 'nodejs';
export const maxDuration = 60;

const ENGINE_LABEL = `intern-ai discovery (${INTERN_MODEL})`;

const MAX_MESSAGE_CHARS = 4000;
const HISTORY_LIMIT = 20;
const READ_LIMIT = 200;
// Platform cap is 60s; keep our own abort below the wall so the loud error wins.
const REQUEST_TIMEOUT_MS = 55_000;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.query.users.findFirst({ where: eq(users.email, session.user.email), columns: { id: true } });
}

function parseArtworkId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadThread(userId: number, artworkId: number) {
  const chat = await db.query.artworkChats.findFirst({
    where: and(eq(artworkChats.userId, userId), eq(artworkChats.artworkId, artworkId)),
    columns: { id: true },
  });
  if (!chat) {
    return { chatId: null, messages: [] as Array<typeof artworkChatMessages.$inferSelect> };
  }

  const rows = await db.query.artworkChatMessages.findMany({
    where: eq(artworkChatMessages.chatId, chat.id),
    orderBy: [desc(artworkChatMessages.id)],
    limit: READ_LIMIT,
  });
  return { chatId: chat.id, messages: rows.reverse() };
}

/** One shape for every failure the client must show loudly. */
function failurePayload(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof ArtworkImageError) {
    return {
      status: 502,
      body: {
        error: `${error.message} The vision lane refuses to answer from metadata alone, so this turn was not sent.`,
        reason: 'artwork_image_unavailable',
        imageUrl: error.imageUrl,
        upstreamStatus: error.status,
        engine: ENGINE_LABEL,
      },
    };
  }
  if (error instanceof InternError) {
    if (error.status === 429) {
      const seconds = error.retryAfterSeconds;
      const resetAt = seconds === null ? null : new Date(Date.now() + seconds * 1000).toISOString();
      return {
        status: 429,
        body: {
          error: `The artwork engine is rate-limiting this server${seconds === null ? '' : ` (retry after ${seconds}s${resetAt ? `, ${resetAt}` : ''})`}. This thread is saved, so retry shortly.`,
          reason: 'rate_limited',
          retryAfterSeconds: seconds,
          resetAt,
          engine: ENGINE_LABEL,
          upstream: error.message,
        },
      };
    }
    return {
      status: 502,
      body: {
        error: error.message,
        reason: 'engine_error',
        engine: ENGINE_LABEL,
        internStatus: error.status,
        upstreamType: error.upstreamType,
        traceId: error.traceId,
      },
    };
  }
  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : 'Artwork chat failed.', engine: ENGINE_LABEL },
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to use artwork chat. Conversations are stored per user, so there is no anonymous thread.', reason: 'not_signed_in' },
      { status: 401 }
    );
  }

  const { id } = await params;
  const artworkId = parseArtworkId(id);
  if (!artworkId) return NextResponse.json({ error: `Invalid artwork id "${id}".` }, { status: 400 });

  try {
    const artwork = await db.query.artworks.findFirst({ where: eq(artworks.id, artworkId), columns: { id: true, title: true, year: true } });
    if (!artwork) return NextResponse.json({ error: `Artwork ${artworkId} is not in the local catalog.` }, { status: 404 });

    const { chatId, messages } = await loadThread(user.id, artworkId);
    return NextResponse.json({
      artwork: { id: String(artwork.id), title: artwork.title, year: artwork.year },
      chatId,
      messages: messages.map((message) => ({ id: message.id, role: message.role, content: message.content, model: message.model, createdAt: message.createdAt })),
      model: INTERN_MODEL,
      engine: ENGINE_LABEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Artwork chat could not be loaded.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST streams the reply as server-sent events so a 10–20 s vision turn stays
 * visible instead of freezing the panel:
 *   {type:'meta',…} → {type:'thinking'}* → {type:'delta',text}* → {type:'done',reply,…}
 * Failures arrive as {type:'error',…} naming the engine, or as ordinary JSON
 * when they happen before the stream opens (auth, bad artwork, image fetch).
 * The user turn is written before the model call and the assistant turn after
 * it, so a failed answer never leaves a chat row claiming a reply that does not
 * exist.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to use artwork chat. Conversations are stored per user, so there is no anonymous thread.', reason: 'not_signed_in' },
      { status: 401 }
    );
  }

  const { id } = await params;
  const artworkId = parseArtworkId(id);
  if (!artworkId) return NextResponse.json({ error: `Invalid artwork id "${id}".` }, { status: 400 });

  let body: { message?: unknown };
  try {
    body = await request.json() as { message?: unknown };
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON: { "message": "..." }.' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'Message is empty.' }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `Message is ${message.length} characters; the limit is ${MAX_MESSAGE_CHARS}.` }, { status: 413 });
  }

  // Everything that can fail cleanly happens before the stream opens, so the
  // client always gets a real HTTP status for auth/catalog/image problems.
  let artwork: {
    id: number;
    title: string;
    year: number | null;
    width: number | null;
    height: number | null;
    imageUrl: string | null;
    artistName: string;
    biography: string | null;
  };
  let sources: Array<{ provider: string; sourceUrl: string | null; title: string | null }>;
  let image: Awaited<ReturnType<typeof loadArtworkImage>>;
  let payload: InternMessage[];
  let chatId: number;
  let userRowId: number;
  let createdAt: Date;

  try {
    const [row] = await db.select({
      id: artworks.id,
      title: artworks.title,
      year: artworks.year,
      width: artworks.width,
      height: artworks.height,
      imageUrl: artworks.imageUrl,
      artistName: artists.name,
      biography: artists.biography,
    }).from(artworks)
      .innerJoin(artists, eq(artworks.artistId, artists.id))
      .where(eq(artworks.id, artworkId))
      .limit(1);
    if (!row) return NextResponse.json({ error: `Artwork ${artworkId} is not in the local catalog.` }, { status: 404 });
    artwork = row;

    sources = await db.select({
      provider: artworkExternalIds.provider,
      sourceUrl: artworkExternalIds.sourceUrl,
      title: artworkExternalIds.title,
    }).from(artworkExternalIds)
      .where(eq(artworkExternalIds.artworkId, artworkId))
      .orderBy(desc(artworkExternalIds.isPrimary), asc(artworkExternalIds.provider))
      .limit(6);

    if (!artwork.imageUrl) {
      return NextResponse.json({
        error: `Artwork ${artworkId} ("${artwork.title}") has no stored image reference, so the vision lane has nothing to look at. Re-import the work with an imageUrl before chatting.`,
        reason: 'artwork_image_missing',
        engine: ENGINE_LABEL,
      }, { status: 409 });
    }

    // The image is downloaded with the same 55s budget as the model, so a slow
    // host cannot eat the whole turn and leave the engine no time to answer.
    image = await loadArtworkImage(artwork.imageUrl, AbortSignal.timeout(REQUEST_TIMEOUT_MS));

    const { messages: stored } = await loadThread(user.id, artworkId);
    const history: InternMessage[] = stored.slice(-HISTORY_LIMIT).map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.content,
    }));

    // The image goes on the current turn only: persisted history stays text, so
    // the thread never stores artwork bytes (refs-only rule).
    const currentTurn: InternContentPart[] = [
      { type: 'text', text: message },
      { type: 'image_url', image_url: { url: image.dataUrl } },
    ];

    payload = [
      { role: 'system', content: artworkChatSystemPrompt({ ...artwork, sources, seesImage: true }) },
      ...history,
      { role: 'user', content: currentTurn },
    ];

    const chat = (await db.insert(artworkChats)
      .values({ userId: user.id, artworkId })
      .onConflictDoUpdate({
        target: [artworkChats.userId, artworkChats.artworkId],
        set: { updatedAt: new Date() },
      })
      .returning({ id: artworkChats.id }))[0];
    chatId = chat.id;

    const [userRow] = await db.insert(artworkChatMessages)
      .values({ chatId, role: 'user', content: message })
      .returning();
    userRowId = userRow.id;
    createdAt = userRow.createdAt;
  } catch (error) {
    const { status, body: detail } = failurePayload(error);
    return NextResponse.json(detail, { status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: Record<string, unknown>) => {
        if (!open) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      emit({
        type: 'meta',
        engine: ENGINE_LABEL,
        model: INTERN_MODEL,
        chatId,
        userMessage: { id: userRowId, role: 'user', content: message, createdAt },
        vision: { imageBytes: image.bytes, contentType: image.contentType, imageUrl: artwork.imageUrl },
      });

      let announcedThinking = false;
      try {
        const result = await internChat(payload, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          label: `artwork-${artworkId}`,
          onDelta: (delta) => {
            if (delta.reasoning) {
              if (!announcedThinking) {
                announcedThinking = true;
                emit({ type: 'thinking' });
              }
              return;
            }
            emit({ type: 'delta', text: delta.text });
          },
        });

        const [assistantRow] = await db.insert(artworkChatMessages)
          .values({ chatId, role: 'assistant', content: result.content.trim(), model: result.model })
          .returning();
        await db.update(artworkChats).set({ updatedAt: new Date() }).where(eq(artworkChats.id, chatId));

        emit({
          type: 'done',
          reply: { id: assistantRow.id, role: 'assistant', content: assistantRow.content, model: assistantRow.model, createdAt: assistantRow.createdAt },
          engine: ENGINE_LABEL,
          reasoningTokens: result.reasoningTokens,
        });
      } catch (error) {
        const { body: detail } = failurePayload(error);
        emit({ type: 'error', ...detail, chatId });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Vercel/nginx buffering would defeat the whole point of streaming.
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to use artwork chat. Conversations are stored per user, so there is no anonymous thread.', reason: 'not_signed_in' },
      { status: 401 }
    );
  }

  const { id } = await params;
  const artworkId = parseArtworkId(id);
  if (!artworkId) return NextResponse.json({ error: `Invalid artwork id "${id}".` }, { status: 400 });

  try {
    const deleted = await db.delete(artworkChats)
      .where(and(eq(artworkChats.userId, user.id), eq(artworkChats.artworkId, artworkId)))
      .returning({ id: artworkChats.id });
    return NextResponse.json({ deleted: deleted.length, chatIds: deleted.map((row) => row.id) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Artwork chat could not be cleared.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
