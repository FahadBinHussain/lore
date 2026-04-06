import { NextRequest, NextResponse } from 'next/server';

type ChatRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface AIRequestMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface StructuredAIResponse {
  summary: string[];
  totals: {
    total_input_items: number;
    matched_items: number;
    unmatched_items: number;
  };
  items: Array<{
    title: string;
    type: string;
    source: string;
    mediaItemId: number | null;
    externalId: string | null;
    releaseDate: string | null;
  }>;
  universeJson: {
    total: number;
    items: Array<{
      title: string;
      type: string;
      source: string;
      mediaItemId: number | null;
      externalId: string | null;
      releaseDate: string | null;
    }>;
  };
}

function getProviderConfig() {
  const openRouterKey = process.env.OPENROUTER_API_KEY || null;
  if (openRouterKey) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    };

    if (process.env.OPENROUTER_SITE_URL) {
      headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
    }
    if (process.env.OPENROUTER_APP_NAME) {
      headers['X-Title'] = process.env.OPENROUTER_APP_NAME;
    }

    return {
      endpoint: process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
      headers,
    };
  }

  const openAIKey = process.env.OPENAI_API_KEY || null;
  return {
    endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.UNIVERSE_AI_RESOLVER_MODEL || 'gpt-4.1-mini',
    headers: {
      Authorization: openAIKey ? `Bearer ${openAIKey}` : '',
      'Content-Type': 'application/json',
    },
  };
}

function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry): ChatMessage => {
      const role: ChatRole =
        entry.role === 'system' || entry.role === 'assistant' || entry.role === 'user'
          ? entry.role
          : 'user';
      return {
        role,
        content: typeof entry.content === 'string' ? entry.content.trim() : '',
      };
    })
    .filter((entry) => entry.content.length > 0);
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sanitizeStructuredResponse(input: unknown): StructuredAIResponse {
  const safe = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(safe.items) ? safe.items : [];
  const normalizedItems = rawItems.map((row) => {
    const entry = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    return {
      title: typeof entry.title === 'string' ? entry.title : '',
      type: typeof entry.type === 'string' ? entry.type : '',
      source: typeof entry.source === 'string' ? entry.source : '',
      mediaItemId:
        typeof entry.mediaItemId === 'number' && Number.isFinite(entry.mediaItemId)
          ? Math.trunc(entry.mediaItemId)
          : null,
      externalId: typeof entry.externalId === 'string' ? entry.externalId : null,
      releaseDate: typeof entry.releaseDate === 'string' ? entry.releaseDate : null,
    };
  });

  const rawSummary = Array.isArray(safe.summary) ? safe.summary : [];
  const summary = rawSummary
    .filter((line): line is string => typeof line === 'string')
    .slice(0, 2);

  const totals = (safe.totals && typeof safe.totals === 'object' ? safe.totals : {}) as Record<string, unknown>;
  const totalInputItems =
    typeof totals.total_input_items === 'number' && Number.isFinite(totals.total_input_items)
      ? Math.trunc(totals.total_input_items)
      : normalizedItems.length;
  const matchedItems =
    typeof totals.matched_items === 'number' && Number.isFinite(totals.matched_items)
      ? Math.trunc(totals.matched_items)
      : normalizedItems.filter((item) => item.mediaItemId !== null || item.externalId !== null).length;
  const unmatchedItems =
    typeof totals.unmatched_items === 'number' && Number.isFinite(totals.unmatched_items)
      ? Math.trunc(totals.unmatched_items)
      : Math.max(0, totalInputItems - matchedItems);

  return {
    summary,
    totals: {
      total_input_items: totalInputItems,
      matched_items: matchedItems,
      unmatched_items: unmatchedItems,
    },
    items: normalizedItems,
    universeJson: {
      total: normalizedItems.length,
      items: normalizedItems,
    },
  };
}

function asStructuredString(content: string): string {
  try {
    const parsed = JSON.parse(content);
    const normalized = sanitizeStructuredResponse(parsed);
    return JSON.stringify(normalized, null, 2);
  } catch {
    const fallback = sanitizeStructuredResponse({
      summary: ['Response was reformatted because model returned invalid structure.'],
      totals: {
        total_input_items: 0,
        matched_items: 0,
        unmatched_items: 0,
      },
      items: [],
      universeJson: {
        total: 0,
        items: [],
      },
    });
    return JSON.stringify(fallback, null, 2);
  }
}

function extractReasoningFragmentsFromChunk(chunk: unknown): string[] {
  const payload = (chunk && typeof chunk === 'object' ? chunk : {}) as Record<string, unknown>;
  const fragments: string[] = [];

  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed.length > 0) fragments.push(trimmed);
  };

  push(payload.delta);

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice =
    choices.length > 0 && choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : null;
  const delta =
    firstChoice && firstChoice.delta && typeof firstChoice.delta === 'object'
      ? (firstChoice.delta as Record<string, unknown>)
      : null;
  if (!delta) return fragments;

  push(delta.reasoning);

  const reasoningDetails = Array.isArray(delta.reasoning_details) ? delta.reasoning_details : [];
  for (const detail of reasoningDetails) {
    if (!detail || typeof detail !== 'object') continue;
    const row = detail as Record<string, unknown>;
    push(row.text);
    push(row.delta);
    push(row.content);

    if (Array.isArray(row.content)) {
      for (const node of row.content) {
        if (!node || typeof node !== 'object') continue;
        const contentNode = node as Record<string, unknown>;
        push(contentNode.text);
        push(contentNode.delta);
      }
    }
  }

  return fragments;
}

function getOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

async function fetchInternalJson<T>(
  request: NextRequest,
  path: string
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const origin = getOrigin(request);
    const response = await fetch(`${origin}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: `Internal API failed: ${path}`,
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown internal API error',
    };
  }
}

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_catalog',
      description:
        'Search site catalog across movies, tv, anime, games, books, comics, board games, podcasts, soundtracks, and attractions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'movie',
              'tv',
              'anime',
              'game',
              'book',
              'comic',
              'boardgame',
              'podcast',
              'soundtrack',
              'themepark',
            ],
          },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_universes',
      description: 'List visible universes with progress and metadata for the signed-in user.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_universe_items',
      description:
        'Get items from a universe by slug, id, or name match. Includes media title/type/source/release date/IDs when available.',
      parameters: {
        type: 'object',
        properties: {
          universe: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['universe'],
      },
    },
  },
];

async function executeTool(
  request: NextRequest,
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (toolName === 'search_catalog') {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const type = typeof args.type === 'string' ? args.type.trim() : '';
    const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.max(1, Math.min(50, Math.trunc(args.limit))) : 10;

    if (!query) {
      return { ok: false, error: 'query is required' };
    }

    // Your /api/search currently supports only movie/tv/anime as explicit `type` filters.
    // For other types (game/book/etc.), fetch untyped results and filter here.
    const supportedTypedSearch = new Set(['movie', 'tv', 'anime']);
    const shouldPassType = type && supportedTypedSearch.has(type);

    const params = new URLSearchParams();
    params.set('q', query);
    if (shouldPassType) params.set('type', type);
    const response = await fetchInternalJson<{ results?: Array<Record<string, unknown>> }>(
      request,
      `/api/search?${params.toString()}`
    );

    const rawResults = Array.isArray(response.data?.results) ? response.data?.results : [];
    const normalizedType = type.toLowerCase();
    const results = type
      ? rawResults.filter((entry) => {
          const entryType = typeof entry.type === 'string' ? entry.type.toLowerCase() : '';
          if (!entryType) return false;
          if (entryType === normalizedType) return true;
          // light alias handling
          if (normalizedType === 'themepark' && (entryType === 'attraction' || entryType === 'themepark')) return true;
          return false;
        })
      : rawResults;
    return {
      ok: response.ok,
      status: response.status,
      query,
      type: type || null,
      total: results.length,
      totalBeforeTypeFilter: rawResults.length,
      results: results.slice(0, limit),
      error: response.ok ? null : response.error || 'Search failed',
    };
  }

  if (toolName === 'list_universes' || toolName === 'get_universe_items') {
    const response = await fetchInternalJson<{
      collections?: Array<{
        id: number;
        slug: string;
        name: string;
        description?: string | null;
        itemCount?: number | null;
        items?: Array<{
          id: number;
          releaseOrder?: number | null;
          mediaItem: {
            id: number;
            title: string;
            mediaType: string;
            source: string | null;
            externalId: string;
            releaseDate?: string | null;
            rating?: string | number | null;
            isPlaceholder?: boolean | null;
          };
        }>;
      }>;
    }>(request, '/api/universes');

    const collections = Array.isArray(response.data?.collections) ? response.data.collections : [];
    if (toolName === 'list_universes') {
      const limit =
        typeof args.limit === 'number' && Number.isFinite(args.limit)
          ? Math.max(1, Math.min(50, Math.trunc(args.limit)))
          : 10;
      const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
      const filtered = query
        ? collections.filter((entry) => entry.name.toLowerCase().includes(query) || entry.slug.toLowerCase().includes(query))
        : collections;

      return {
        ok: response.ok,
        status: response.status,
        total: filtered.length,
        universes: filtered.slice(0, limit).map((entry) => ({
          id: entry.id,
          slug: entry.slug,
          name: entry.name,
          description: entry.description || null,
          itemCount: entry.itemCount ?? entry.items?.length ?? 0,
        })),
        error: response.ok ? null : response.error || 'Failed to list universes',
      };
    }

    const universeInput = typeof args.universe === 'string' ? args.universe.trim() : '';
    if (!universeInput) {
      return { ok: false, error: 'universe is required' };
    }
    const limit =
      typeof args.limit === 'number' && Number.isFinite(args.limit)
        ? Math.max(1, Math.min(200, Math.trunc(args.limit)))
        : 50;
    const universeLower = universeInput.toLowerCase();
    const target = collections.find((entry) => {
      if (entry.slug.toLowerCase() === universeLower) return true;
      if (entry.name.toLowerCase() === universeLower) return true;
      if (String(entry.id) === universeInput) return true;
      return false;
    });

    if (!target) {
      return {
        ok: false,
        error: `Universe not found: ${universeInput}`,
        available: collections.slice(0, 10).map((entry) => ({ id: entry.id, slug: entry.slug, name: entry.name })),
      };
    }

    const items = (target.items || [])
      .slice()
      .sort((a, b) => (a.releaseOrder || 0) - (b.releaseOrder || 0))
      .slice(0, limit)
      .map((entry) => ({
        collectionItemId: entry.id,
        releaseOrder: entry.releaseOrder ?? null,
        mediaItemId: entry.mediaItem.id,
        title: entry.mediaItem.title,
        mediaType: entry.mediaItem.mediaType,
        source: entry.mediaItem.source,
        externalId: entry.mediaItem.externalId,
        releaseDate: entry.mediaItem.releaseDate ?? null,
        rating: entry.mediaItem.rating ?? null,
        isPlaceholder: entry.mediaItem.isPlaceholder ?? false,
      }));

    return {
      ok: response.ok,
      status: response.status,
      universe: {
        id: target.id,
        slug: target.slug,
        name: target.name,
        description: target.description || null,
      },
      totalItems: target.items?.length || 0,
      itemsReturned: items.length,
      items,
      error: response.ok ? null : response.error || 'Failed to get universe items',
    };
  }

  return { ok: false, error: `Unknown tool: ${toolName}` };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      messages?: unknown;
      model?: unknown;
      stream?: unknown;
    };

    const messages = sanitizeMessages(body.messages);
    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const config = getProviderConfig();
    const authorization = config.headers.Authorization || '';
    if (!authorization) {
      return NextResponse.json(
        { error: 'No AI API key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.' },
        { status: 500 }
      );
    }

    const model =
      typeof body.model === 'string' && body.model.trim().length > 0
        ? body.model.trim()
        : config.model;
    const streamMode = body.stream === true;

    const configuredMaxTokens = Number.parseInt(process.env.OPENROUTER_CHAT_MAX_TOKENS || '2048', 10);
    const maxTokens = Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0 ? configuredMaxTokens : 2048;

    const toolsUsed = new Set<string>();
    const runMessages: AIRequestMessage[] = [
      {
        role: 'system',
        content:
          [
            'You are Lore AI.',
            'You can call tools to fetch live data from the Lore site APIs.',
            'Use tools whenever the user asks for search, universes, or universe items.',
            'If user asks what tools are available, list exact function names: search_catalog, list_universes, get_universe_items.',
            'Always respond with VALID JSON only (no markdown, no prose outside JSON, no reasoning).',
            'JSON schema:',
            '{"summary":[string,string?],"totals":{"total_input_items":number,"matched_items":number,"unmatched_items":number},"items":[{"title":string,"type":string,"source":string,"mediaItemId":number|null,"externalId":string|null,"releaseDate":string|null}],"universeJson":{"total":number,"items":[...]}}',
            'When IDs are available from tools, always include them.',
            'If IDs are missing, set null explicitly and still include the item row.',
            'Do not ask follow-up questions unless the user explicitly requests them.',
          ].join(' '),
      },
      ...messages.map(
        (entry): AIRequestMessage => ({
          role: entry.role,
          content: entry.content,
        })
      ),
    ];

    const maxToolIterations = 4;

    const runCompletion = async (
      onToolUsed?: (toolName: string) => void
    ): Promise<{ reply: string; model: string; toolsUsed: string[] }> => {
      const toolsUsed = new Set<string>();
      for (let iteration = 0; iteration < maxToolIterations; iteration += 1) {
        const upstream = await fetch(config.endpoint, {
          method: 'POST',
          headers: config.headers,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: maxTokens,
          messages: runMessages,
          tools: TOOLS,
          tool_choice: 'auto',
          response_format: { type: 'json_object' },
        }),
      });

        const json = (await upstream.json().catch(() => ({}))) as {
          choices?: Array<{
            message?: {
              content?: string;
              tool_calls?: Array<{
                id: string;
                type: 'function';
                function: { name: string; arguments: string };
              }>;
            };
          }>;
          error?: { message?: string } | string;
        };

        if (!upstream.ok) {
          const errorMessage =
            typeof json.error === 'string'
              ? json.error
              : json.error?.message || 'AI request failed';
          throw new Error(errorMessage);
        }

        const message = json.choices?.[0]?.message;
        const toolCalls = message?.tool_calls || [];

        if (!toolCalls.length) {
          const reply = message?.content?.trim();
          if (!reply) {
            throw new Error('No response from AI model');
          }
          return { reply: asStructuredString(reply), model, toolsUsed: Array.from(toolsUsed) };
        }

        runMessages.push({
          role: 'assistant',
          content: message?.content || '',
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          const toolName = call.function?.name || '';
          if (toolName) {
            toolsUsed.add(toolName);
            onToolUsed?.(toolName);
          }
          const args = parseToolArguments(call.function?.arguments || '{}');
          const result = await executeTool(request, toolName, args);

          runMessages.push({
            role: 'tool',
            name: toolName,
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }

      throw new Error('Tool calling exceeded max iterations');
    };

    const runCompletionStreaming = async (
      onToolUsed: (toolName: string) => void,
      onReasoning: (message: string) => void,
      onDelta: (text: string) => void
    ): Promise<{ model: string; toolsUsed: string[] }> => {
      const toolsUsed = new Set<string>();

      for (let iteration = 0; iteration < maxToolIterations; iteration += 1) {
        const upstream = await fetch(config.endpoint, {
          method: 'POST',
          headers: config.headers,
          body: JSON.stringify({
            model,
            temperature: 0.4,
            max_tokens: maxTokens,
            messages: runMessages,
            tools: TOOLS,
            tool_choice: 'auto',
            response_format: { type: 'json_object' },
          }),
        });

        const json = (await upstream.json().catch(() => ({}))) as {
          choices?: Array<{
            message?: {
              content?: string;
              tool_calls?: Array<{
                id: string;
                type: 'function';
                function: { name: string; arguments: string };
              }>;
            };
          }>;
          error?: { message?: string } | string;
        };

        if (!upstream.ok) {
          const errorMessage =
            typeof json.error === 'string'
              ? json.error
              : json.error?.message || 'AI request failed';
          throw new Error(errorMessage);
        }

        const message = json.choices?.[0]?.message;
        const toolCalls = message?.tool_calls || [];

        if (!toolCalls.length) {
          const reply = message?.content?.trim();
          const fallbackReply = reply ? asStructuredString(reply) : '';

          const streamUpstream = await fetch(config.endpoint, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify({
              model,
              temperature: 0.4,
              max_tokens: maxTokens,
              messages: runMessages,
              response_format: { type: 'json_object' },
              reasoning: { enabled: true, exclude: false },
              stream: true,
            }),
          });

          if (!streamUpstream.ok || !streamUpstream.body) {
            if (fallbackReply.length > 0) {
              onDelta(fallbackReply);
              return { model, toolsUsed: Array.from(toolsUsed) };
            }
            throw new Error('Streaming response failed');
          }

          const reader = streamUpstream.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let streamed = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;

              const payload = trimmed.slice(5).trim();
              if (!payload) continue;
              if (payload === '[DONE]') {
                break;
              }

              let parsed: {
                choices?: Array<{
                  delta?: { content?: string };
                  message?: { content?: string };
                }>;
              };
              try {
                parsed = JSON.parse(payload);
              } catch {
                continue;
              }

              const reasoningFragments = extractReasoningFragmentsFromChunk(parsed);
              for (const fragment of reasoningFragments) {
                onReasoning(fragment);
              }

              const delta =
                parsed.choices?.[0]?.delta?.content ??
                parsed.choices?.[0]?.message?.content ??
                '';

              if (delta) {
                streamed += delta;
                onDelta(delta);
              }
            }
          }

          if (!streamed.trim() && fallbackReply.length > 0) {
            onDelta(fallbackReply);
          }

          return { model, toolsUsed: Array.from(toolsUsed) };
        }

        runMessages.push({
          role: 'assistant',
          content: message?.content || '',
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          const toolName = call.function?.name || '';
          if (toolName) {
            toolsUsed.add(toolName);
            onToolUsed(toolName);
          }
          const args = parseToolArguments(call.function?.arguments || '{}');
          const result = await executeTool(request, toolName, args);

          runMessages.push({
            role: 'tool',
            name: toolName,
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }

      throw new Error('Tool calling exceeded max iterations');
    };

    if (streamMode) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (payload: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          };
          try {
            // Initial ping to open stream immediately in clients/proxies
            controller.enqueue(encoder.encode(`: connected\n\n`));
            const result = await runCompletionStreaming(
              (toolName) => {
                write({ type: 'tool', name: toolName, message: `Using tool: ${toolName}` });
              },
              (message) => {
                write({ type: 'reasoning', message });
              },
              (text) => {
                write({ type: 'delta', text });
              }
            );
            write({ type: 'done', model: result.model, toolsUsed: result.toolsUsed });
            controller.close();
          } catch (error) {
            write({
              type: 'error',
              error: error instanceof Error ? error.message : 'AI request failed',
            });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const result = await runCompletion();
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI chat route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
