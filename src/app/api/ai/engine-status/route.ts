import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { INTERN_MODEL, InternError, internChat } from '@/lib/ai/intern';

// Health check for the artwork-chat engine (replaced /api/ai/zen-status on
// 2026-10-24 when the chat moved off the opencode zen free lane).
//
// Default = config only, because a live probe costs tokens AND ~10s of a
// reasoning model's budget. `?probe=1` sends one tiny real completion and
// reports the measured latency, finish reason and reasoning burn — that is the
// only honest way to answer "is the engine usable right now".
export const runtime = 'nodejs';
export const maxDuration = 60;

const PROBE_TIMEOUT_MS = 45_000;
const PROBE_MAX_TOKENS = 800;

function baseHost(): string {
  const raw = process.env.INTERN_BASE_URL || 'https://discovery-api.intern-ai.org.cn/v1';
  try {
    return new URL(raw).host;
  } catch {
    return raw;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Sign in to inspect the artwork engine.', reason: 'not_signed_in' },
      { status: 401 }
    );
  }

  const key = process.env.INTERN_API_KEY?.trim();
  const probe = request.nextUrl.searchParams.get('probe') === '1';
  const payload = {
    engine: `intern-ai discovery (${INTERN_MODEL})`,
    model: INTERN_MODEL,
    baseHost: baseHost(),
    keyConfigured: Boolean(key),
    // Measured 2026-10-24 on the same artwork + prompt through the production
    // modules. Kept here so "why this model" is answerable without digging.
    measuredModels: [
      { model: 'qwen3.8-27b', latencyMs: '7400 (thinking off) / 9000-20000 (thinking on)', vision: 'ok', choice: 'in use' },
      { model: 'Sage-A1.5', latencyMs: '17000', vision: 'ok', choice: 'slower' },
      { model: 'deepseek-v4.1-flash-1017', latencyMs: '32200', vision: 'ok', choice: 'slower' },
      { model: 'intern-s2', latencyMs: '200000', vision: 'ok', choice: 'unusable in one request' },
    ],
    thinking: 'off (chat_template_kwargs.enable_thinking=false — the reasoning/reasoning_effort knobs are ignored upstream)',
    note: key
      ? 'Key present. Replies are streamed; a vision turn measures ~7-12s with thinking off.'
      : 'INTERN_API_KEY is missing, so every chat turn will fail loudly with a 502 engine_error.',
  };

  if (!probe) return NextResponse.json({ ...payload, probed: false });

  if (!key) {
    return NextResponse.json({ ...payload, probed: true, ok: false, error: 'INTERN_API_KEY is not configured.' }, { status: 500 });
  }

  const started = Date.now();
  try {
    const result = await internChat(
      [{ role: 'user', content: 'Reply with the single word: OK' }],
      { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), label: 'engine-status', maxTokens: PROBE_MAX_TOKENS }
    );
    return NextResponse.json({
      ...payload,
      probed: true,
      ok: true,
      latencyMs: Date.now() - started,
      finishReason: result.finishReason,
      reasoningTokens: result.reasoningTokens,
      reply: result.content.trim().slice(0, 200),
    });
  } catch (error) {
    const latencyMs = Date.now() - started;
    if (error instanceof InternError) {
      return NextResponse.json({
        ...payload,
        probed: true,
        ok: false,
        latencyMs,
        error: error.message,
        internStatus: error.status,
        upstreamType: error.upstreamType,
        traceId: error.traceId,
        retryAfterSeconds: error.retryAfterSeconds,
      }, { status: 502 });
    }
    return NextResponse.json({
      ...payload,
      probed: true,
      ok: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Engine probe failed.',
    }, { status: 502 });
  }
}
