/**
 * intern-ai discovery endpoint client (`qwen3.8-27b`).
 *
 * Replaced the opencode zen free lane on 2026-10-24. Zen budgets every free
 * model per client IP per day, so Vercel's shared egress ran dry every day
 * (see AGENTS.md); this endpoint is a normal metered OpenAI-compatible API.
 *
 * Verified against the live endpoint before writing this client:
 * - vision works: a base64 `data:` URL answered the text + shapes correctly;
 * - `https://` image sources are fetched by the provider and fail opaquely
 *   (`502 media_fetch_failed "image fetch timed out"`), so the caller must
 *   always send bytes, never a bare URL;
 * - with thinking enabled the model streams `delta.reasoning_content` before
 *   any `delta.content`, and a `max_tokens` that only covers the reasoning
 *   comes back with `content: null` and `finish_reason: "stop"` — an empty
 *   answer that must fail loudly, never render as a silent blank. Thinking is
 *   therefore disabled per request (see INTERN_THINKING_OFF), but the drain and
 *   the empty-reply guard stay, because a model that starts thinking again
 *   must still never produce a silent blank.
 *
 * There is deliberately no fallback lane: a failure throws with the upstream
 * status, type and trace id so the caller can surface it loudly.
 */

/**
 * Model choice was measured, not guessed (2026-10-24, same artwork + prompt):
 * `intern-s2` was accurate but took **200 s**; `deepseek-v4.1-flash-1017`
 * 32 s; `Sage-A1.5` 17 s; `qwen3.8-27b` 9–20 s with correct, image-grounded
 * answers.
 *
 * Thinking is turned OFF via `chat_template_kwargs.enable_thinking` — the
 * `reasoning: false` / `reasoning_effort` knobs are advertised but ignored
 * (qwen still burned ~300 reasoning tokens with them). With the template flag
 * the same painting answered in **7.4 s with 0 reasoning tokens** and equal
 * grounding, instead of 12.6 s / 273 reasoning tokens. That flag is the only
 * thing that actually shortens a turn; do not replace it with `reasoning`.
 */
export const INTERN_MODEL = 'qwen3.8-27b';

const INTERN_DEFAULT_BASE_URL = 'https://discovery-api.intern-ai.org.cn/v1';
const INTERN_ATTEMPTS = 3;
const INTERN_BACKOFF_MS = [1000, 3000];
/** Headroom for a long answer now that the reasoning burn is gone. */
const INTERN_MAX_COMPLETION_TOKENS = 2000;

/** Sent verbatim — this is the switch that actually disables Qwen thinking. */
const INTERN_THINKING_OFF = { chat_template_kwargs: { enable_thinking: false } };

/**
 * OpenAI-shaped content parts. Images are always sent as `data:` URLs built by
 * the caller — see the module comment for why a bare https URL is forbidden.
 */
export type InternContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type InternMessage = { role: 'system' | 'user' | 'assistant'; content: string | InternContentPart[] };

export type InternChatResult = {
  content: string;
  finishReason: string | null;
  model: string;
  /** Tokens the model spent thinking before answering (0 when not reported). */
  reasoningTokens: number;
};

export type InternChatOptions = {
  signal?: AbortSignal;
  label?: string;
  /** Model override (defaults to INTERN_MODEL). Used by the engine health probe. */
  model?: string;
  /** Completion budget override. Must stay above the reasoning burn. */
  maxTokens?: number;
  /**
   * Called for every streamed chunk. `reasoning` chunks are the model thinking
   * out loud — they must never be rendered as the answer, but they are what
   * keeps a slow turn visible, so callers forward them as a progress signal.
   */
  onDelta?: (delta: { text: string; reasoning: boolean }) => void;
};

export class InternError extends Error {
  status: number | null;
  upstreamType: string | null;
  traceId: string | null;
  retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number | null,
    extras: { upstreamType?: string | null; traceId?: string | null; retryAfterSeconds?: number | null } = {}
  ) {
    super(message);
    this.name = 'InternError';
    this.status = status;
    this.upstreamType = extras.upstreamType ?? null;
    this.traceId = extras.traceId ?? null;
    this.retryAfterSeconds = extras.retryAfterSeconds ?? null;
  }
}

function baseUrl(): string {
  return (process.env.INTERN_BASE_URL || INTERN_DEFAULT_BASE_URL).replace(/\/$/, '');
}

function apiKey(): string {
  const key = process.env.INTERN_API_KEY?.trim();
  if (!key) {
    throw new InternError(
      'INTERN_API_KEY is not configured for this deployment, so the artwork engine cannot authenticate. ' +
      'Set it in .env.local and in the Vercel project environment.',
      null
    );
  }
  return key;
}

/** `retry-after` is either delta-seconds or an HTTP date — both shapes appear. */
function parseRetryAfter(raw: string | null): number | null {
  if (!raw) return null;
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds);
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.round((at - Date.now()) / 1000));
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error('This operation was aborted');
  error.name = 'AbortError';
  return error;
}

type UpstreamErrorBody = {
  message?: string;
  type?: string;
  code?: string;
  trace_id?: string;
};

function parseUpstreamError(text: string): UpstreamErrorBody | null {
  try {
    const parsed = JSON.parse(text) as { error?: UpstreamErrorBody | string };
    if (typeof parsed.error === 'string') return { message: parsed.error };
    if (parsed.error && typeof parsed.error === 'object') return parsed.error;
  } catch {
    // Non-JSON error bodies are reported verbatim by the caller.
  }
  return null;
}

function describeFailure(status: number, text: string, retryAfterRaw: string | null): InternError {
  const body = parseUpstreamError(text);
  const type = body?.type || body?.code || null;
  const trace = body?.trace_id ? ` (trace ${body.trace_id})` : '';
  const detail = (body?.message || text || '<no body>').slice(0, 300);
  return new InternError(
    `intern HTTP ${status}${type ? ` ${type}` : ''}: ${detail}${trace}`,
    status,
    { upstreamType: type, traceId: body?.trace_id ?? null, retryAfterSeconds: parseRetryAfter(retryAfterRaw) }
  );
}

type SseFrame = {
  error?: unknown;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: { content?: string | null; reasoning_content?: string | null };
  }>;
  usage?: { completion_tokens_details?: { reasoning_tokens?: number | null } } | null;
};

async function drainSse(
  response: Response,
  label: string,
  onDelta?: (delta: { text: string; reasoning: boolean }) => void
): Promise<{ content: string; finishReason: string | null; reasoningTokens: number }> {
  const body = response.body;
  if (!body) throw new InternError(`[${label}] intern response body is null`, null);

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let finishReason: string | null = null;
  let reasoningTokens = 0;
  let sawDone = false;

  const handleLine = (line: string) => {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed.startsWith('data:')) return; // comments / event: / id: lines
    const data = trimmed.slice(5).trim();
    if (!data) return;
    if (data === '[DONE]') {
      sawDone = true;
      return;
    }
    let frame: SseFrame;
    try {
      frame = JSON.parse(data) as SseFrame;
    } catch {
      throw new InternError(`[${label}] intern invalid SSE frame: ${data.slice(0, 200)}`, null);
    }
    if (frame.error) {
      const detail = typeof frame.error === 'string' ? frame.error : JSON.stringify(frame.error).slice(0, 300);
      throw new InternError(`[${label}] intern stream error frame: ${detail}`, null);
    }
    const reported = frame.usage?.completion_tokens_details?.reasoning_tokens;
    if (typeof reported === 'number' && reported > reasoningTokens) reasoningTokens = reported;
    const choices = Array.isArray(frame.choices) ? frame.choices : [];
    for (const choice of choices) {
      const delta = choice?.delta;
      // reasoning_content is the model thinking out loud; it is not the answer.
      if (delta && typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        onDelta?.({ text: delta.content, reasoning: false });
      } else if (delta && typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        onDelta?.({ text: delta.reasoning_content, reasoning: true });
      }
      if (typeof choice?.finish_reason === 'string' && choice.finish_reason) finishReason = choice.finish_reason;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      if (sawDone) break;
      newline = buffer.indexOf('\n');
    }
    if (sawDone) break;
  }
  if (!sawDone && buffer) handleLine(buffer);

  return { content, finishReason, reasoningTokens };
}

export async function internChat(messages: InternMessage[], options: InternChatOptions = {}): Promise<InternChatResult> {
  const label = options.label ?? 'artwork-chat';
  const signal = options.signal;
  if (!messages.length) throw new InternError(`[${label}] refusing to send an empty chat body`, null);

  const key = apiKey();
  const model = options.model?.trim() || INTERN_MODEL;
  const maxTokens = options.maxTokens && options.maxTokens > 0 ? options.maxTokens : INTERN_MAX_COMPLETION_TOKENS;
  const url = `${baseUrl()}/chat/completions`;
  let lastFailure: InternError | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= INTERN_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await abortableDelay(INTERN_BACKOFF_MS[attempt - 2], signal);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          Accept: 'text/event-stream',
        },
        signal,
        body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens, ...INTERN_THINKING_OFF }),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      lastFailure = null;
      console.warn(`  [${label}] intern attempt ${attempt}/${INTERN_ATTEMPTS} failed: ${(error as Error)?.message || error}`);
      continue;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      const failure = describeFailure(response.status, text, response.headers.get('retry-after'));
      // 4xx does not heal inside a 6s retry window (bad key, bad model, media
      // fetch, rate limit). Only network failures and 5xx are retried.
      if (response.status < 500) throw failure;
      lastFailure = failure;
      lastError = null;
      console.warn(`  [${label}] intern attempt ${attempt}/${INTERN_ATTEMPTS} ${failure.message}`);
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/event-stream/i.test(contentType)) {
      const text = await response.text().catch(() => '<no body>');
      throw new InternError(
        `intern unexpected content-type "${contentType}" (expected SSE event-stream); body head: ${text.slice(0, 300)}`,
        null
      );
    }

    const result = await drainSse(response, label, options.onDelta);
    if (!result.content.trim()) {
      const spent = result.reasoningTokens > 0 ? `, ${result.reasoningTokens} of them on reasoning` : '';
      throw new InternError(
        `intern returned an empty reply${result.finishReason ? ` (finish_reason=${result.finishReason})` : ''}` +
        ` after a ${maxTokens}-token completion budget${spent}; the answer is empty, so this is not shown as a reply`,
        null
      );
    }
    return { content: result.content, finishReason: result.finishReason, model, reasoningTokens: result.reasoningTokens };
  }

  if (lastFailure) throw lastFailure;
  throw new InternError(
    `intern: all ${INTERN_ATTEMPTS} attempts failed with no recorded error: ${(lastError as Error)?.message || lastError}`,
    null
  );
}
