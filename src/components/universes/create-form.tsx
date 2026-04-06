'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Check, FileJson, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface UniversePasteItem {
  title: string;
  year?: number;
  type: string;
  source: string;
}

type UniverseMediaType =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'game'
  | 'book'
  | 'manga'
  | 'comic'
  | 'boardgame'
  | 'soundtrack'
  | 'podcast'
  | 'themepark';

interface UniverseResolvedItemData {
  title: string;
  externalId: string;
  source: string;
  mediaType: UniverseMediaType;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  rating: number | null;
  description: string | null;
  genres: string[];
  runtime: number | null;
  developer: string | null;
  publisher: string | null;
  platforms: string[];
  networks: string[];
  seasons: number | null;
  totalEpisodes: number | null;
  status: string | null;
  tagline: string | null;
  popularity: number | null;
  previewImage: string | null;
}

interface UniverseCreateSelectedItemPayload {
  title: string;
  externalId: string;
  source: string;
  mediaType: UniverseMediaType;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  rating: number | null;
  description: string | null;
  genres: string[];
  runtime: number | null;
  developer: string | null;
  publisher: string | null;
  platforms: string[];
  networks: string[];
  seasons: number | null;
  totalEpisodes: number | null;
  status: string | null;
  tagline: string | null;
  popularity: number | null;
  isPlaceholder?: boolean;
  additionalData?: Record<string, unknown>;
}

type UniversePreviewStatus = 'resolved' | 'unresolved' | 'processing';

interface UniversePreviewItem {
  index: number;
  input: UniversePasteItem;
  status: UniversePreviewStatus;
  selected: boolean;
  reason?: string;
  resolverMeta?: Record<string, unknown>;
  isJapaneseAnimation?: boolean;
  reroutedToAnime?: boolean;
  resolved?: UniverseResolvedItemData;
}

interface UniversePreviewSummary {
  total: number;
  resolved: number;
  unresolved: number;
  animeRerouted: number;
}

interface UniversePreviewResponse {
  items: UniversePreviewItem[];
  summary: UniversePreviewSummary;
}

interface UniversePreviewStreamStartEvent {
  type: 'start';
  total: number;
}

interface UniversePreviewStreamItemEvent {
  type: 'item';
  processed: number;
  item: UniversePreviewItem;
  summary?: UniversePreviewSummary;
}

interface UniversePreviewStreamDoneEvent {
  type: 'done';
  items: UniversePreviewItem[];
  summary: UniversePreviewSummary;
}

type UniversePreviewStreamEvent =
  | UniversePreviewStreamStartEvent
  | UniversePreviewStreamItemEvent
  | UniversePreviewStreamDoneEvent;

interface CreateUniverseFormData {
  name: string;
  description: string;
  jsonPayload: string;
}

interface SelectedDuplicateGroup {
  dedupeKey: string;
  kept: UniversePreviewItem;
  merged: UniversePreviewItem[];
  source: string;
  mediaType: string;
  externalId: string;
}

interface SelectedPayloadComputation {
  items: UniverseCreateSelectedItemPayload[];
  selectedCount: number;
  dedupedCount: number;
  mergedDuplicates: number;
  duplicateGroups: SelectedDuplicateGroup[];
}

const JSON_SAMPLE = `[
  {
    "title": "Despicable Me",
    "year": 2010,
    "type": "movie",
    "source": "tmdb"
  },
  {
    "title": "Harry Potter and the Philosopher's Stone",
    "year": 1997,
    "type": "book",
    "source": "openlibrary"
  },
  {
    "title": "Cloudy with a Chance of Meatballs: River Expedition",
    "year": 2016,
    "type": "attraction",
    "source": ""
  }
]`;

function formatReleaseDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getPreviewHref(item: UniversePreviewItem): string | null {
  if (item.status !== 'resolved' || !item.resolved) {
    return null;
  }

  const externalId = item.resolved.externalId;
  if (!externalId) {
    return null;
  }

  switch (item.resolved.mediaType) {
    case 'movie':
      return `/movies/${externalId}`;
    case 'tv':
      return `/tv/${externalId}`;
    case 'anime':
      return `/anime/${externalId}`;
    case 'game':
      return `/games/${externalId}`;
    case 'book':
      return `/books/${externalId}`;
    default:
      return null;
  }
}

function normalizeMediaType(type: string): UniverseMediaType {
  const normalized = type.trim().toLowerCase().replace(/[\s_-]+/g, '');

  if (normalized === 'tv' || normalized === 'tvshow' || normalized === 'series') return 'tv';
  if (normalized === 'game' || normalized === 'videogame') return 'game';
  if (normalized === 'anime') return 'anime';
  if (normalized === 'book') return 'book';
  if (normalized === 'manga') return 'manga';
  if (normalized === 'comic') return 'comic';
  if (normalized === 'boardgame' || normalized === 'boardgames') return 'boardgame';
  if (normalized === 'soundtrack' || normalized === 'music') return 'soundtrack';
  if (normalized === 'podcast' || normalized === 'podcasts') return 'podcast';
  if (normalized === 'themepark' || normalized === 'attraction' || normalized === 'ride') return 'themepark';
  return 'movie';
}

function toIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function buildArchiveExternalId(item: UniversePreviewItem): string {
  const yearToken = typeof item.input.year === 'number' ? String(item.input.year) : 'na';
  const titleToken = toIdToken(item.input.title) || 'untitled';
  return `archive-${item.input.source}-${item.input.type}-${yearToken}-${titleToken}`;
}

function buildArchivePayload(item: UniversePreviewItem): UniverseCreateSelectedItemPayload {
  const mediaType = normalizeMediaType(item.input.type);
  const releaseDate = typeof item.input.year === 'number' ? `${item.input.year}-01-01` : null;
  return {
    title: item.input.title,
    externalId: buildArchiveExternalId(item),
    source: 'manual',
    mediaType,
    posterPath: null,
    backdropPath: null,
    releaseDate,
    rating: null,
    description: `${item.input.title} is kept as an archive-only entry.`,
    genres: [],
    runtime: null,
    developer: null,
    publisher: null,
    platforms: [],
    networks: [],
    seasons: null,
    totalEpisodes: null,
    status: null,
    tagline: null,
    popularity: null,
    isPlaceholder: true,
    additionalData: {
      unresolved: {
        inputSource: item.input.source,
        inputType: item.input.type,
        inputYear: typeof item.input.year === 'number' ? item.input.year : null,
        reason: item.reason || null,
      },
    },
  };
}

function toSelectedPayload(item: UniversePreviewItem): UniverseCreateSelectedItemPayload | null {
  if (item.status === 'resolved' && item.resolved) {
    return item.resolved;
  }
  if (item.status === 'unresolved') {
    return buildArchivePayload(item);
  }
  return null;
}

function buildSelectedItemKey(item: UniverseCreateSelectedItemPayload): string {
  const source = item.source?.trim().toLowerCase() || 'unknown';
  const mediaType = item.mediaType?.trim().toLowerCase() || 'movie';
  const externalId = item.externalId?.trim();

  if (externalId) {
    return `${source}::${mediaType}::${externalId}`;
  }

  const title = item.title?.trim().toLowerCase() || 'untitled';
  const yearToken = item.releaseDate?.slice(0, 4) || 'na';
  return `fallback::${source}::${mediaType}::${title}::${yearToken}`;
}

function parseInputYear(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toSortableDateToken(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const strict = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (strict) {
    const year = Number.parseInt(strict[1], 10);
    const month = Number.parseInt(strict[2], 10);
    const day = Number.parseInt(strict[3], 10);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return year * 10000 + month * 100 + day;
    }
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return (
    parsed.getUTCFullYear() * 10000 +
    (parsed.getUTCMonth() + 1) * 100 +
    parsed.getUTCDate()
  );
}

function getPreviewSortToken(item: UniversePreviewItem): number {
  const resolvedToken = toSortableDateToken(item.resolved?.releaseDate);
  if (resolvedToken !== null) {
    return resolvedToken;
  }

  if (typeof item.input.year === 'number' && Number.isFinite(item.input.year)) {
    return Math.trunc(item.input.year) * 10000 + 101;
  }

  return Number.POSITIVE_INFINITY;
}

function buildPendingPreviewItem(value: unknown, index: number): UniversePreviewItem {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const title =
    typeof raw.title === 'string' && raw.title.trim().length > 0
      ? raw.title.trim()
      : `Item ${index + 1}`;
  const type =
    typeof raw.type === 'string' && raw.type.trim().length > 0
      ? raw.type.trim()
      : 'unknown';
  const source =
    typeof raw.source === 'string'
      ? raw.source.trim()
      : '';

  return {
    index,
    input: {
      title,
      year: parseInputYear(raw.year),
      type,
      source,
    },
    status: 'processing',
    selected: false,
    reason: 'Resolving...',
  };
}

export function CreateUniverseForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewSummary, setPreviewSummary] = useState<UniversePreviewSummary | null>(null);
  const [previewItems, setPreviewItems] = useState<UniversePreviewItem[]>([]);
  const [formData, setFormData] = useState<CreateUniverseFormData>({
    name: '',
    description: '',
    jsonPayload: '',
  });

  const selectedPreviewItems = useMemo(
    () => previewItems.filter((item) => item.selected),
    [previewItems]
  );
  const selectedPayloadResult = useMemo<SelectedPayloadComputation>(() => {
    const keyedSelections: Array<{
      key: string;
      payload: UniverseCreateSelectedItemPayload;
      previewItem: UniversePreviewItem;
    }> = [];

    for (const previewItem of selectedPreviewItems) {
      const payload = toSelectedPayload(previewItem);
      if (!payload) continue;
      keyedSelections.push({
        key: buildSelectedItemKey(payload),
        payload,
        previewItem,
      });
    }

    const uniqueItems = new Map<string, UniverseCreateSelectedItemPayload>();
    const duplicateBuckets = new Map<string, UniversePreviewItem[]>();

    for (const selection of keyedSelections) {
      if (!uniqueItems.has(selection.key)) {
        uniqueItems.set(selection.key, selection.payload);
      }

      const bucket = duplicateBuckets.get(selection.key);
      if (bucket) {
        bucket.push(selection.previewItem);
      } else {
        duplicateBuckets.set(selection.key, [selection.previewItem]);
      }
    }

    const dedupedItems = Array.from(uniqueItems.values());
    const duplicateGroups: SelectedDuplicateGroup[] = [];

    for (const [key, items] of duplicateBuckets.entries()) {
      if (items.length <= 1) continue;
      const canonical = uniqueItems.get(key);
      duplicateGroups.push({
        dedupeKey: key,
        kept: items[0],
        merged: items.slice(1),
        source: canonical?.source || 'unknown',
        mediaType: canonical?.mediaType || 'unknown',
        externalId: canonical?.externalId || 'unknown',
      });
    }

    return {
      items: dedupedItems,
      selectedCount: keyedSelections.length,
      dedupedCount: dedupedItems.length,
      mergedDuplicates: Math.max(0, keyedSelections.length - dedupedItems.length),
      duplicateGroups,
    };
  }, [selectedPreviewItems]);
  const selectedPayloadItems = selectedPayloadResult.items;
  const duplicateRowMeta = useMemo(() => {
    const byIndex = new Map<number, { role: 'kept' | 'merged'; dedupeKey: string }>();
    for (const group of selectedPayloadResult.duplicateGroups) {
      byIndex.set(group.kept.index, { role: 'kept', dedupeKey: group.dedupeKey });
      for (const item of group.merged) {
        byIndex.set(item.index, { role: 'merged', dedupeKey: group.dedupeKey });
      }
    }
    return byIndex;
  }, [selectedPayloadResult.duplicateGroups]);
  const resolvedPreviewItems = useMemo(
    () => previewItems.filter((item): item is UniversePreviewItem & { resolved: UniverseResolvedItemData } => item.status === 'resolved' && Boolean(item.resolved)),
    [previewItems]
  );
  const unresolvedPreviewItems = useMemo(
    () => previewItems.filter((item) => item.status === 'unresolved'),
    [previewItems]
  );
  const sortedPreviewItems = useMemo(() => {
    return [...previewItems].sort((a, b) => {
      const dateDiff = getPreviewSortToken(a) - getPreviewSortToken(b);
      if (dateDiff !== 0) return dateDiff;

      const statusRank = (item: UniversePreviewItem) => {
        if (item.status === 'resolved') return 0;
        if (item.status === 'unresolved') return 1;
        return 2;
      };
      const statusDiff = statusRank(a) - statusRank(b);
      if (statusDiff !== 0) return statusDiff;

      return a.index - b.index;
    });
  }, [previewItems]);
  const resolvedByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of resolvedPreviewItems) {
      const current = counts.get(item.resolved.mediaType) || 0;
      counts.set(item.resolved.mediaType, current + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [resolvedPreviewItems]);
  const resolvedBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of resolvedPreviewItems) {
      const current = counts.get(item.resolved.source) || 0;
      counts.set(item.resolved.source, current + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [resolvedPreviewItems]);

  const handleInputChange = (field: keyof CreateUniverseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreview = async () => {
    setPreviewError(null);
    setSubmitError(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(formData.jsonPayload);
    } catch {
      setPreviewItems([]);
      setPreviewSummary(null);
      setPreviewError('Invalid JSON. Please fix the payload format and try again.');
      return;
    }

    if (!Array.isArray(parsedPayload)) {
      setPreviewItems([]);
      setPreviewSummary(null);
      setPreviewError('Payload must be a JSON array of items.');
      return;
    }

    const pendingItems = parsedPayload.map((entry, index) => buildPendingPreviewItem(entry, index));
    setPreviewItems(pendingItems);
    setPreviewSummary({
      total: pendingItems.length,
      resolved: 0,
      unresolved: 0,
      animeRerouted: 0,
    });

    setIsPreviewLoading(true);
    try {
      const response = await fetch('/api/universes/create/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: parsedPayload,
          stream: true,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to preview items');
      }

      const contentType = response.headers.get('content-type') || '';
      if (response.body && contentType.includes('application/x-ndjson')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let event: UniversePreviewStreamEvent;
            try {
              event = JSON.parse(trimmed) as UniversePreviewStreamEvent;
            } catch {
              continue;
            }

            if (event.type === 'start') {
              setPreviewSummary({
                total: event.total,
                resolved: 0,
                unresolved: 0,
                animeRerouted: 0,
              });
              continue;
            }

            if (event.type === 'item') {
              const streamed = event.item.status === 'unresolved'
                ? { ...event.item, selected: true }
                : event.item;

              setPreviewItems((prev) => {
                const next = [...prev];
                const targetIndex = streamed.index;
                if (targetIndex >= 0 && targetIndex < next.length) {
                  next[targetIndex] = streamed;
                } else {
                  next.push(streamed);
                }
                return next;
              });

              if (event.summary) {
                setPreviewSummary(event.summary);
              }
              continue;
            }

            if (event.type === 'done') {
              setPreviewItems(
                (event.items || []).map((item) =>
                  item.status === 'unresolved' ? { ...item, selected: true } : item
                )
              );
              setPreviewSummary(event.summary || null);
            }
          }
        }
      } else {
        const data = (await response.json()) as UniversePreviewResponse & { error?: string };
        setPreviewItems(
          (data.items || []).map((item) =>
            item.status === 'unresolved' ? { ...item, selected: true } : item
          )
        );
        setPreviewSummary(data.summary || null);
      }
    } catch (error) {
      setPreviewItems([]);
      setPreviewSummary(null);
      setPreviewError(error instanceof Error ? error.message : 'Failed to preview items');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const toggleItemSelection = (originalIndex: number) => {
    setPreviewItems((prev) =>
      prev.map((item) => {
        if (item.index !== originalIndex) return item;
        if (item.status === 'processing') return item;
        return { ...item, selected: !item.selected };
      })
    );
  };

  const selectAll = () => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.status === 'processing' ? item : { ...item, selected: true }))
    );
  };

  const deselectAll = () => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.status === 'processing' ? item : { ...item, selected: false }))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!formData.name.trim()) {
      setSubmitError('Universe name is required.');
      return;
    }

    if (selectedPayloadItems.length === 0) {
      setSubmitError('Select at least one item before creating the universe.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/universes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          selectedItems: selectedPayloadItems,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create universe');
      }

      router.push('/universes');
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create universe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Universe Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Universe Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(event) => handleInputChange('name', event.target.value)}
              placeholder="Enter universe name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(event) => handleInputChange('description', event.target.value)}
              placeholder="Describe this universe collection..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jsonPayload">Universe JSON *</Label>
            <Textarea
              id="jsonPayload"
              value={formData.jsonPayload}
              onChange={(event) => handleInputChange('jsonPayload', event.target.value)}
              placeholder={JSON_SAMPLE}
              className="min-h-56 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Paste objects with `title`, `year`, `type`, and `source`. Unsupported or custom types are kept as archive-only entries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handlePreview} disabled={isPreviewLoading}>
              {isPreviewLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing & Previewing...
                </>
              ) : (
                <>
                  <FileJson className="w-4 h-4 mr-2" />
                  Parse JSON
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleInputChange('jsonPayload', JSON_SAMPLE)}
            >
              Fill Sample
            </Button>
          </div>

          {previewError && (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
              {previewError}
            </div>
          )}

          {previewSummary && (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{previewSummary.total}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="text-lg font-semibold text-emerald-600">{previewSummary.resolved}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                  <p className="text-lg font-semibold text-destructive">{previewSummary.unresolved}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">JP {'->'} Anime</p>
                  <p className="text-lg font-semibold text-violet-600">{previewSummary.animeRerouted}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {resolvedByType.map(([type, count]) => (
                  <Badge key={`type-${type}`} variant="outline" className="capitalize">
                    {type}: {count}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {resolvedBySource.map(([source, count]) => (
                  <Badge key={`source-${source}`} variant="outline" className="uppercase">
                    {source}: {count}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAll}>
                  Select All
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={deselectAll}>
                  Deselect All
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedPayloadResult.dedupedCount} unique item(s) selected
                  {selectedPayloadResult.selectedCount !== selectedPayloadResult.dedupedCount
                    ? ` from ${selectedPayloadResult.selectedCount} selected row${
                        selectedPayloadResult.selectedCount === 1 ? '' : 's'
                      }`
                    : ''}
                  {selectedPayloadResult.mergedDuplicates > 0
                    ? ` (${selectedPayloadResult.mergedDuplicates} duplicate entr${
                        selectedPayloadResult.mergedDuplicates === 1 ? 'y' : 'ies'
                      } merged)`
                    : ''}
                </span>
              </div>

            </div>
          )}

          {unresolvedPreviewItems.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">Unresolved Items ({unresolvedPreviewItems.length})</p>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {unresolvedPreviewItems.map((item) => (
                  <div key={`unresolved-${item.index}-${item.input.title}`} className="text-xs text-destructive/90">
                    <span className="font-medium">{item.input.title}</span>
                    {typeof item.input.year === 'number' ? ` (${item.input.year})` : ''}
                    {' - '}
                    {item.reason || 'No matching result found'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[28rem] overflow-y-auto divide-y">
                {sortedPreviewItems.map((item) => {
                  const displayTitle = item.resolved?.title || item.input.title;
                  const previewImage = item.resolved?.previewImage;
                  const fullReleaseDate = formatReleaseDate(item.resolved?.releaseDate);
                  const previewHref = getPreviewHref(item);
                  const archivePayload = item.status === 'unresolved' ? toSelectedPayload(item) : null;
                  const duplicateMeta = duplicateRowMeta.get(item.index);
                  const statusVariant =
                    item.status === 'resolved'
                      ? 'secondary'
                      : item.status === 'processing'
                        ? 'outline'
                        : 'destructive';
                  const statusLabel = item.status === 'processing' ? 'resolving' : item.status;
                  const duplicateRowClass =
                    duplicateMeta?.role === 'kept'
                      ? 'border-l-4 border-l-emerald-500 bg-emerald-500/10'
                      : duplicateMeta?.role === 'merged'
                        ? 'border-l-4 border-l-red-500 bg-red-500/10'
                        : '';

                  return (
                    <div
                      key={`${item.index}-${item.input.title}-${item.input.year ?? 'na'}`}
                      className={`p-3 ${duplicateRowClass}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4"
                          checked={item.selected}
                          disabled={item.status === 'processing'}
                          onChange={() => toggleItemSelection(item.index)}
                        />

                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {previewImage ? (
                            previewHref ? (
                              <Link href={previewHref} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <img
                                  src={previewImage}
                                  alt={displayTitle}
                                  className="w-12 h-16 object-cover rounded border hover:opacity-90 transition-opacity"
                                />
                              </Link>
                            ) : (
                              <img
                                src={previewImage}
                                alt={displayTitle}
                                className="w-12 h-16 object-cover rounded border"
                              />
                            )
                          ) : (
                            <div className="w-12 h-16 rounded border bg-muted/60 flex items-center justify-center text-muted-foreground">
                              {item.status === 'resolved' ? (
                                <Check className="w-4 h-4" />
                              ) : item.status === 'processing' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {previewHref ? (
                                <Link
                                  href={previewHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium truncate underline-offset-2 hover:underline"
                                >
                                  {displayTitle}
                                </Link>
                              ) : (
                                <p className="font-medium truncate">{displayTitle}</p>
                              )}
                              <Badge variant={statusVariant}>
                                {statusLabel}
                              </Badge>
                              {duplicateMeta?.role === 'kept' && (
                                <Badge className="bg-emerald-600 text-white">Duplicate Group: Kept</Badge>
                              )}
                              {duplicateMeta?.role === 'merged' && (
                                <Badge className="bg-red-600 text-white">Duplicate Group: Merged</Badge>
                              )}
                              {item.reroutedToAnime && (
                                <Badge variant="secondary" className="bg-violet-500/10 text-violet-700">
                                  Import to Anime
                                </Badge>
                              )}
                              {item.status === 'unresolved' && (
                                <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                                  Archive-only
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="capitalize">
                                Input: {item.input.type}
                              </Badge>
                              <Badge variant="outline" className="uppercase">
                                {item.input.source}
                              </Badge>
                              {item.resolved && (
                                <Badge variant="outline" className="capitalize">
                                  Saved as: {item.resolved.mediaType}
                                </Badge>
                              )}
                              {fullReleaseDate && (
                                <Badge variant="outline">
                                  Release: {fullReleaseDate}
                                </Badge>
                              )}
                              {typeof item.input.year === 'number' && (
                                <Badge variant="outline">{item.input.year}</Badge>
                              )}
                            </div>

                            {item.resolved && (
                              <div className="mt-2 rounded-md border bg-background/50 p-2 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <p><span className="text-muted-foreground">Matched ID:</span> {item.resolved.externalId}</p>
                                  <p><span className="text-muted-foreground">Saved Type:</span> <span className="capitalize">{item.resolved.mediaType}</span></p>
                                  <p><span className="text-muted-foreground">Source:</span> <span className="uppercase">{item.resolved.source}</span></p>
                                  <p><span className="text-muted-foreground">Rating:</span> {typeof item.resolved.rating === 'number' ? item.resolved.rating.toFixed(1) : 'N/A'}</p>
                                  {item.resolved.runtime !== null && (
                                    <p><span className="text-muted-foreground">Runtime:</span> {item.resolved.runtime} min</p>
                                  )}
                                  {item.resolved.totalEpisodes !== null && (
                                    <p><span className="text-muted-foreground">Episodes:</span> {item.resolved.totalEpisodes}</p>
                                  )}
                                  {item.resolved.seasons !== null && (
                                    <p><span className="text-muted-foreground">Seasons:</span> {item.resolved.seasons}</p>
                                  )}
                                  {item.resolved.publisher && (
                                    <p><span className="text-muted-foreground">Publisher:</span> {item.resolved.publisher}</p>
                                  )}
                                  {item.resolved.developer && (
                                    <p><span className="text-muted-foreground">Developer:</span> {item.resolved.developer}</p>
                                  )}
                                </div>

                                {item.resolved.genres.length > 0 && (
                                  <p className="text-xs">
                                    <span className="text-muted-foreground">Genres:</span> {item.resolved.genres.slice(0, 8).join(', ')}
                                  </p>
                                )}
                                {item.resolved.platforms.length > 0 && (
                                  <p className="text-xs">
                                    <span className="text-muted-foreground">Platforms:</span> {item.resolved.platforms.slice(0, 8).join(', ')}
                                  </p>
                                )}
                                {item.resolved.networks.length > 0 && (
                                  <p className="text-xs">
                                    <span className="text-muted-foreground">Networks:</span> {item.resolved.networks.slice(0, 8).join(', ')}
                                  </p>
                                )}

                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                    View extracted JSON
                                  </summary>
                                  <pre className="mt-2 max-h-40 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
{JSON.stringify(item.resolved, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}

                            {item.status === 'unresolved' && archivePayload && (
                              <div className="mt-2 rounded-md border bg-background/50 p-2 space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  This item will be saved as an archive-only placeholder.
                                </p>
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                    View extracted JSON
                                  </summary>
                                  <pre className="mt-2 max-h-40 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
{JSON.stringify(archivePayload, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}

                            {item.reason && (
                              <p
                                className={`text-xs mt-2 ${
                                  item.status === 'processing' ? 'text-muted-foreground' : 'text-destructive'
                                }`}
                              >
                                {item.reason}
                              </p>
                            )}

                            {item.resolverMeta && (
                              <details className="text-xs mt-2">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                  View AI response
                                </summary>
                                <pre className="mt-2 max-h-40 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
{JSON.stringify(item.resolverMeta, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isLoading || selectedPayloadItems.length === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create Universe (${selectedPayloadItems.length})`
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

