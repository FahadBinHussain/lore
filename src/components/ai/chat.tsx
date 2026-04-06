'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Loader2, Send, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  toolsUsed?: string[];
}

interface AIModel {
  id: string;
  name: string;
  isFree: boolean;
  promptPrice: number | null;
  completionPrice: number | null;
  totalCost?: number | null;
  contextLength?: number | null;
  maxCompletionTokens?: number | null;
  popularity?: number | null;
  performance?: number | null;
  created?: number | null;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are Lore AI. Help with media discovery, universe curation, and parser troubleshooting. Be concise and practical.';
const AI_MODEL_STORAGE_KEY = 'lore:ai:model';

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState(() => {
    if (typeof window === 'undefined') return 'openai/gpt-4.1-mini';
    const saved = window.localStorage.getItem(AI_MODEL_STORAGE_KEY);
    return saved && saved.trim().length > 0 ? saved : 'openai/gpt-4.1-mini';
  });
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [freeOnly, setFreeOnly] = useState(true);
  const [sortBy, setSortBy] = useState<'cost' | 'popularity' | 'performance' | 'name'>('cost');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [thinkingLines, setThinkingLines] = useState<string[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);
  const filteredModels = useMemo(() => {
    const base = freeOnly ? models.filter((entry) => entry.isFree) : models;
    const list = [...base];
    const numberOr = (value: number | null | undefined, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback;

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);

      if (sortBy === 'cost') {
        const aCost = numberOr(a.totalCost, Number.POSITIVE_INFINITY);
        const bCost = numberOr(b.totalCost, Number.POSITIVE_INFINITY);
        if (aCost !== bCost) return aCost - bCost;
        return a.name.localeCompare(b.name);
      }

      if (sortBy === 'popularity') {
        const aPop = numberOr(a.popularity, Number.NEGATIVE_INFINITY);
        const bPop = numberOr(b.popularity, Number.NEGATIVE_INFINITY);
        if (aPop !== bPop) return bPop - aPop;
        return a.name.localeCompare(b.name);
      }

      const aPerf =
        numberOr(a.performance, Number.NEGATIVE_INFINITY) !== Number.NEGATIVE_INFINITY
          ? numberOr(a.performance, Number.NEGATIVE_INFINITY)
          : numberOr(a.contextLength, Number.NEGATIVE_INFINITY);
      const bPerf =
        numberOr(b.performance, Number.NEGATIVE_INFINITY) !== Number.NEGATIVE_INFINITY
          ? numberOr(b.performance, Number.NEGATIVE_INFINITY)
          : numberOr(b.contextLength, Number.NEGATIVE_INFINITY);
      if (aPerf !== bPerf) return bPerf - aPerf;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [freeOnly, models, sortBy]);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      setModelsLoading(true);
      try {
        const response = await fetch('/api/ai/models');
        const data = (await response.json().catch(() => ({}))) as { models?: AIModel[] };
        if (!response.ok) {
          throw new Error('Failed to load model list');
        }

        if (!isMounted) return;
        const nextModels = Array.isArray(data.models) ? data.models : [];
        setModels(nextModels);
        if (!nextModels.some((entry) => entry.id === model) && nextModels[0]?.id) {
          setModel(nextModels[0].id);
        }
      } catch {
        if (isMounted) {
          setModels([]);
        }
      } finally {
        if (isMounted) {
          setModelsLoading(false);
        }
      }
    };

    loadModels();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, model);
  }, [model]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;

    const content = input.trim();
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);
    setThinkingLines([]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream: true,
          model,
          messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
            ...messages.map((message) => ({ role: message.role, content: message.content })),
            { role: 'user', content },
          ],
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'AI request failed');
      }

      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', toolsUsed: [] }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let toolsUsed: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          const lines = eventBlock.split('\n');
          const dataLine = lines.find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;

          let eventData: {
            type?: string;
            text?: string;
            message?: string;
            name?: string;
            toolsUsed?: string[];
            error?: string;
          };

          try {
            eventData = JSON.parse(payload);
          } catch {
            continue;
          }

          if (eventData.type === 'reasoning' && eventData.message) {
            const line = eventData.message as string;
            setThinkingLines((prev) => {
              if (prev[prev.length - 1] === line) return prev;
              return [...prev, line].slice(-8);
            });
            continue;
          }

          if (eventData.type === 'tool' && eventData.name) {
            const toolLine = `Using tool: ${eventData.name}`;
            setThinkingLines((prev) => {
              if (prev[prev.length - 1] === toolLine) return prev;
              return [...prev, toolLine].slice(-8);
            });
            continue;
          }

          if (eventData.type === 'delta' && eventData.text) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: `${message.content}${eventData.text || ''}` }
                  : message
              )
            );
            continue;
          }

          if (eventData.type === 'done') {
            toolsUsed = Array.isArray(eventData.toolsUsed) ? eventData.toolsUsed : [];
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId ? { ...message, toolsUsed } : message
              )
            );
            setThinkingLines([]);
            continue;
          }

          if (eventData.type === 'error') {
            throw new Error(eventData.error || 'AI stream failed');
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
      setThinkingLines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!canSend) return;
    void handleSubmit(event);
  };

  const handleCopyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(id);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === id ? null : current));
      }, 1500);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="flex h-[calc(100dvh-5rem)] w-full flex-col gap-3 py-2">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold">AI Assistant</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Badge variant="outline">Model</Badge>
        <select
          className="select select-bordered select-sm min-w-72 bg-base-100 text-base-content"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={modelsLoading || filteredModels.length === 0}
        >
          {filteredModels.length === 0 ? (
            <option value={model}>{modelsLoading ? 'Loading models...' : 'No models found'}</option>
          ) : (
            filteredModels.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} {entry.isFree ? '(Free)' : ''}
              </option>
            ))
          )}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          Sort by
          <select
            className="select select-bordered select-xs bg-base-100 text-base-content"
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as 'cost' | 'popularity' | 'performance' | 'name')
            }
          >
            <option value="cost">Cost</option>
            <option value="popularity">Popularity</option>
            <option value="performance">Performance</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(event) => setFreeOnly(event.target.checked)}
          />
          Free only
        </label>
        <span className="text-xs text-muted-foreground">
          {filteredModels.length} / {models.length} model
          {models.length === 1 ? '' : 's'}
        </span>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-3"
      >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Start chatting. Ask for universe parsing help, media suggestions, or resolver debugging.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'ml-auto max-w-[90%] border-primary/40 bg-primary/10'
                      : 'mr-auto max-w-[90%] border-border bg-background'
                  }`}
                >
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {message.role}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === 'assistant' && message.toolsUsed && message.toolsUsed.length > 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Tools used: {message.toolsUsed.join(', ')}
                    </p>
                  ) : null}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyMessage(message.id, message.content)}
                    >
                      {copiedMessageId === message.id ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
            {isLoading && thinkingLines.length > 0 ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">Thinking</p>
                <div className="space-y-1">
                  {thinkingLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-xs text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border bg-card p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask anything..."
          className="min-h-24"
        />
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!canSend}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
