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

type UniverseMediaType = 'movie' | 'tv' | 'anime' | 'game';

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

interface UniversePreviewItem {
  index: number;
  input: UniversePasteItem;
  status: 'resolved' | 'unresolved';
  selected: boolean;
  reason?: string;
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

interface CreateUniverseFormData {
  name: string;
  description: string;
  jsonPayload: string;
}

const JSON_SAMPLE = `[
  {
    "title": "Despicable Me",
    "year": 2010,
    "type": "movie",
    "source": "tmdb"
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
    default:
      return null;
  }
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

  const selectedResolvedItems = useMemo(
    () => previewItems.filter((item) => item.status === 'resolved' && item.selected && item.resolved),
    [previewItems]
  );

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

    setIsPreviewLoading(true);
    try {
      const response = await fetch('/api/universes/create/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: parsedPayload,
        }),
      });

      const data = (await response.json()) as UniversePreviewResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview items');
      }

      setPreviewItems(data.items || []);
      setPreviewSummary(data.summary || null);
    } catch (error) {
      setPreviewItems([]);
      setPreviewSummary(null);
      setPreviewError(error instanceof Error ? error.message : 'Failed to preview items');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setPreviewItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index || item.status !== 'resolved') return item;
        return { ...item, selected: !item.selected };
      })
    );
  };

  const selectAll = () => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.status === 'resolved' ? { ...item, selected: true } : item))
    );
  };

  const deselectAll = () => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.status === 'resolved' ? { ...item, selected: false } : item))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!formData.name.trim()) {
      setSubmitError('Universe name is required.');
      return;
    }

    if (selectedResolvedItems.length === 0) {
      setSubmitError('Select at least one resolved item before creating the universe.');
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
          selectedItems: selectedResolvedItems.map((item) => item.resolved),
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
              Paste an array of objects with `title`, `year`, `type`, and `source`.
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
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Total: {previewSummary.total}</Badge>
                <Badge variant="secondary">Resolved: {previewSummary.resolved}</Badge>
                <Badge variant="secondary">Unresolved: {previewSummary.unresolved}</Badge>
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-700">
                  JP Animation {'->'} Anime: {previewSummary.animeRerouted}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAll}>
                  Select All
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={deselectAll}>
                  Deselect All
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedResolvedItems.length} item(s) selected
                </span>
              </div>
            </div>
          )}

          {previewItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[28rem] overflow-y-auto divide-y">
                {previewItems.map((item, index) => {
                  const canSelect = item.status === 'resolved';
                  const displayTitle = item.resolved?.title || item.input.title;
                  const previewImage = item.resolved?.previewImage;
                  const fullReleaseDate = formatReleaseDate(item.resolved?.releaseDate);
                  const previewHref = getPreviewHref(item);

                  return (
                    <div key={`${item.index}-${item.input.title}-${item.input.year ?? 'na'}`} className="p-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4"
                          checked={canSelect ? item.selected : false}
                          disabled={!canSelect}
                          onChange={() => toggleItemSelection(index)}
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
                              {item.status === 'resolved' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
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
                              <Badge variant={item.status === 'resolved' ? 'secondary' : 'destructive'}>
                                {item.status}
                              </Badge>
                              {item.reroutedToAnime && (
                                <Badge variant="secondary" className="bg-violet-500/10 text-violet-700">
                                  Import to Anime
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

                            {item.reason && (
                              <p className="text-xs text-destructive mt-2">{item.reason}</p>
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
            <Button type="submit" disabled={isLoading || selectedResolvedItems.length === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create Universe (${selectedResolvedItems.length})`
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
