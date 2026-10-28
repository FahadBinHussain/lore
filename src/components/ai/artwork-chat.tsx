'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Eye, Loader2, LogIn, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';

export interface ChatArtwork {
  id: string;
  title: string;
  year: number | null;
}

type ChatMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
};

type ChatResponse = {
  error?: string;
  reason?: string;
  reply?: ChatMessage;
  userMessage?: ChatMessage;
  messages?: ChatMessage[];
};

/** Stream events from POST /api/artworks/[id]/chat (see the route comment). */
type ChatEvent =
  | { type: 'meta'; engine: string; model: string; chatId: number; userMessage: ChatMessage }
  | { type: 'thinking' }
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: ChatMessage; engine: string; reasoningTokens: number }
  | { type: 'error'; error: string; reason?: string; engine?: string };

const MODEL_LABEL = 'qwen3.8-27b';
export function ArtworkChat({ artwork, artistName }: { artwork: ChatArtwork; artistName: string }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [engineLabel, setEngineLabel] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    setMessages([]);
    setDraft('');
    setStreamText('');
    fetch(`/api/artworks/${encodeURIComponent(artwork.id)}/chat`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as ChatResponse & { engine?: string };
        if (response.status === 401) {
          setAuthRequired(true);
          return;
        }
        if (!response.ok) throw new Error(data.error || `Chat history request failed (HTTP ${response.status}).`);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        if (data.engine) setEngineLabel(data.engine);
      })
      .catch((cause: unknown) => {
        if ((cause as Error)?.name === 'AbortError') return;
        setError((cause as Error)?.message || 'Chat history could not be loaded.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [artwork.id]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, pending, open, error, streamText]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || pending || authRequired) return;
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: text };
    setMessages((current) => [...current, optimistic]);
    setDraft('');
    setPending(true);
    setError(null);
    setStreamText('');
    let streamOpened = false;
    try {
      const response = await fetch(`/api/artworks/${encodeURIComponent(artwork.id)}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      // Pre-stream failures come back as ordinary JSON with a real status code.
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = (await response.json()) as ChatResponse;
        if (response.status === 401) {
          setAuthRequired(true);
          throw new Error(data.error || 'Sign in to use artwork chat.');
        }
        throw new Error(data.error || `Chat request failed (HTTP ${response.status}).`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('The chat stream opened without a body.');
      streamOpened = true;

      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      let failure: string | null = null;

      const handleEvent = (event: ChatEvent) => {
        if (event.type === 'meta') {
          setEngineLabel(event.engine);
          setMessages((current) => current.map((message) => (message.id === optimistic.id ? event.userMessage : message)));
          return;
        }
        if (event.type === 'delta') {
          answer += event.text;
          setStreamText(answer);
          return;
        }
        if (event.type === 'done') {
          setMessages((current) => [...current, event.reply]);
          setStreamText('');
          return;
        }
        if (event.type === 'error') {
          failure = `${event.error}${event.engine ? ` (engine: ${event.engine})` : ''}`;
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split = buffer.indexOf('\n\n');
        while (split >= 0) {
          const chunk = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          split = buffer.indexOf('\n\n');
          const payload = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('');
          if (payload) handleEvent(JSON.parse(payload) as ChatEvent);
        }
      }

      if (failure) throw new Error(failure);
    } catch (cause) {
      // A turn that never reached the stream wrote nothing server-side, so the
      // optimistic bubble is reverted and the text goes back in the box. Once
      // the stream opened, the user row IS saved — keep it, drop the partial.
      if (!streamOpened) {
        setMessages((current) => current.filter((message) => message.id !== optimistic.id));
        setDraft(text);
      }
      setStreamText('');
      setError((cause as Error)?.message || 'Chat request failed.');
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }, [artwork.id, authRequired, draft, pending]);

  const clear = useCallback(async () => {
    if (!messages.length) return;
    if (!window.confirm('Delete this artwork conversation? This cannot be undone.')) return;
    setClearing(true);
    setError(null);
    try {
      const response = await fetch(`/api/artworks/${encodeURIComponent(artwork.id)}/chat`, { method: 'DELETE' });
      const data = (await response.json()) as ChatResponse & { deleted?: number };
      if (!response.ok) throw new Error(data.error || `Clear request failed (HTTP ${response.status}).`);
      setMessages([]);
      setStreamText('');
    } catch (cause) {
      setError((cause as Error)?.message || 'Conversation could not be cleared.');
    } finally {
      setClearing(false);
    }
  }, [artwork.id, messages.length]);

  if (!mounted) return null;

  const title = artwork.year ? `${artwork.title} (${artwork.year})` : artwork.title;
  const suggestions = [
    'What is happening in this painting? Describe the composition, light, and palette.',
    `What should I know about "${artwork.title}"?`,
    `Where does this sit in ${artistName}'s career?`,
  ];

  return createPortal(
    <>
      {open && (
        <section
          aria-label={`Artwork chat about ${title}`}
          className="fixed inset-x-3 bottom-24 z-[85] flex h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border border-base-content/15 bg-base-100 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:inset-x-auto sm:right-5 sm:w-[380px]"
        >
          <header className="flex items-center gap-2 border-b border-base-content/10 bg-base-200/60 px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                Artwork companion
                <span title="Vision: the reference image is sent with every question" className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
                  <Eye className="h-3 w-3 animate-pulse" /> sees it
                </span>
              </p>
              <p className="truncate text-xs text-base-content/60">{title}</p>
            </div>
            <button
              type="button"
              onClick={clear}
              disabled={!messages.length || clearing}
              aria-label="Clear this conversation"
              title="Clear this conversation"
              className="rounded-full p-2 text-base-content/60 transition-all duration-200 hover:scale-110 hover:bg-error/10 hover:text-error active:scale-95 disabled:opacity-30"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close artwork chat"
              className="rounded-full p-2 text-base-content/60 transition-all duration-200 hover:scale-110 hover:bg-base-content/10 hover:text-base-content active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {loading && (
              <p className="flex items-center gap-2 text-xs text-base-content/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading saved conversation…
              </p>
            )}

            {!loading && !authRequired && !messages.length && (
              <div className="space-y-2">
                <p className="text-sm text-base-content/70">It reads the reference image of this work, and the thread is saved to your account and follows whichever artwork you open.</p>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}
                    className="block w-full rounded-lg border border-base-content/10 bg-base-200/50 px-3 py-2 text-left text-xs text-base-content/80 transition-all duration-200 hover:scale-[1.02] hover:border-primary/40 hover:bg-primary/10 hover:text-base-content active:scale-95"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-content'
                      : 'rounded-bl-sm border border-base-content/10 bg-base-200 text-base-content'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {streamText && (
              <div className="flex justify-start">
                <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-base-content/10 bg-base-200 px-3 py-2 text-sm leading-relaxed text-base-content">
                  {streamText}
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary" />
                </div>
              </div>
            )}

            {pending && !streamText && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-base-content/10 bg-base-200 px-3 py-2 text-xs text-base-content/60">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  Looking at the painting
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 border-t border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {authRequired ? (
            <div className="border-t border-base-content/10 px-3 py-3">
              <p className="mb-2 text-xs text-base-content/70">Conversations are stored per user, so artwork chat needs a signed-in account.</p>
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(pathname || '/')}`}
                className="btn btn-primary btn-sm w-full gap-2"
              >
                <LogIn className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" /> Sign in to chat
              </Link>
            </div>
          ) : (
            <div className="border-t border-base-content/10 p-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      setOpen(false);
                      return;
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  maxLength={4000}
                  placeholder="Ask about this artwork…"
                  aria-label="Message the artwork companion"
                  className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-base-content/15 bg-base-200/60 px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || pending || loading}
                  aria-label="Send message"
                  className="btn btn-primary btn-sm h-11 w-11 rounded-xl p-0 transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-base-content/40">
                Engine: {engineLabel ?? 'intern-ai discovery'} · {MODEL_LABEL} · reference image attached each turn
              </p>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Hide artwork chat' : 'Ask about this artwork'}
        className="group fixed bottom-5 right-5 z-[85] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-content shadow-2xl transition-all duration-200 hover:scale-105 hover:shadow-primary/40 active:scale-95"
      >
        {open ? <X className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" /> : <MessageCircle className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-12" />}
        <span className="hidden text-sm font-medium sm:inline">{open ? 'Hide chat' : 'Ask about this work'}</span>
        {!open && <Sparkles className="h-4 w-4 animate-pulse" />}
      </button>
    </>,
    document.body
  );
}
