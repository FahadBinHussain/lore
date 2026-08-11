'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Check, ExternalLink, Loader2, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DetailPageSkeleton } from '@/components/ui/skeleton';

export interface GenericMediaDetail {
  id: string;
  title: string;
  mediaType: string;
  source: string;
  image?: string | null;
  description?: string | null;
  releaseDate?: string | null;
  rating?: number | string | null;
  subtitle?: string | null;
  externalUrl?: string | null;
  chips?: string[];
  fields?: Array<{
    label: string;
    value: string | number | null | undefined;
  }>;
}

interface GenericMediaDetailPageProps {
  apiBase: string;
  mediaType: string;
  title: string;
  label: string;
  completeLabel: string;
  incompleteLabel: string;
  icon: LucideIcon;
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function GenericMediaDetailPage({
  apiBase,
  mediaType,
  title,
  label,
  completeLabel,
  incompleteLabel,
  icon: Icon,
}: GenericMediaDetailPageProps) {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const [detail, setDetail] = useState<GenericMediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [updating, setUpdating] = useState(false);

  const rawId = params?.id;
  const itemId = useMemo(() => {
    const value = Array.isArray(rawId) ? rawId[0] : rawId;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }, [rawId]);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;
    const resolvedItemId = itemId;

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/${apiBase}/${encodeURIComponent(resolvedItemId)}`);
        if (!response.ok) {
          throw new Error(`${label} not found`);
        }

        const data = await response.json();
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Failed to load ${label.toLowerCase()}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [apiBase, itemId, label]);

  useEffect(() => {
    if (!detail) return;
    const currentDetail = detail;

    async function loadStatus() {
      try {
        const response = await fetch(
          `/api/media/status?mediaId=${encodeURIComponent(currentDetail.id)}&mediaType=${encodeURIComponent(mediaType)}`,
          { cache: 'no-store' }
        );
        if (!response.ok) return;
        const data = await response.json();
        setIsComplete(Boolean(data.isWatched));
      } catch (err) {
        console.error('Failed to fetch media status:', err);
      }
    }

    loadStatus();
  }, [detail, mediaType]);

  const description = stripHtml(detail?.description);
  const releaseDate = formatDate(detail?.releaseDate);

  async function toggleComplete() {
    if (!detail) return;

    setUpdating(true);
    try {
      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: detail.id,
          mediaType,
          isWatched: !isComplete,
          title: detail.title,
          posterPath: detail.image ?? null,
          releaseDate: detail.releaseDate ?? null,
        }),
      });

      if (response.ok) {
        setIsComplete((value) => !value);
      }
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <Icon className="h-16 w-16 text-primary" />
        <h1 className="text-3xl font-bold">{error || `${label} not found`}</h1>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-[320px_minmax(0,1fr)] lg:py-16">
        <aside className="space-y-4">
          <Button variant="ghost" onClick={() => router.back()} className="px-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="overflow-hidden border-base-content/10 bg-base-200">
            <CardContent className="p-0">
              <div className="aspect-[2/3] bg-base-300">
                {detail.image ? (
                  <img src={detail.image} alt={detail.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Icon className="h-20 w-20 text-base-content/30" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="uppercase tracking-wider">
                {title}
              </Badge>
              <Badge variant={isComplete ? 'default' : 'secondary'}>
                {isComplete ? 'Tracked complete' : 'Not complete'}
              </Badge>
              {detail.source ? (
                <Badge variant="outline" className="uppercase">
                  {detail.source}
                </Badge>
              ) : null}
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{detail.title}</h1>
              {detail.subtitle ? (
                <p className="mt-3 text-lg text-base-content/70">{detail.subtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-base-content/70">
              {releaseDate ? <span>{releaseDate}</span> : null}
              {detail.rating ? (
                <span className="inline-flex items-center gap-1 text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  {detail.rating}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={toggleComplete} disabled={updating}>
                {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {isComplete ? incompleteLabel : completeLabel}
              </Button>
              {detail.externalUrl ? (
                <Link href={detail.externalUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline' })}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Provider Page
                </Link>
              ) : null}
            </div>
          </div>

          {detail.chips && detail.chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detail.chips.map((chip) => (
                <Badge key={chip} variant="secondary">
                  {chip}
                </Badge>
              ))}
            </div>
          ) : null}

          <Card className="border-base-content/10 bg-base-200/60">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="mb-3 text-xl font-bold">Overview</h2>
                <p className="whitespace-pre-line leading-7 text-base-content/80">
                  {description || 'No description available yet.'}
                </p>
              </div>

              {detail.fields && detail.fields.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.fields
                    .filter((field) => field.value !== null && field.value !== undefined && String(field.value).trim() !== '')
                    .map((field) => (
                      <div key={field.label} className="rounded-lg border border-base-content/10 bg-base-100 p-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-base-content/50">{field.label}</div>
                        <div className="mt-1 font-medium">{field.value}</div>
                      </div>
                    ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
