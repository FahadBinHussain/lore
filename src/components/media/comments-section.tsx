'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Loader2,
  MessageCircle,
  Reply,
  Send,
  Trash2,
  Pencil,
  X,
  Check,
  LogIn,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface CommentRow {
  id: number;
  mediaItemId: number;
  userId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userImage: string | null;
  userUsername: string | null;
  userEmail: string | null;
}

interface CommentsSectionProps {
  mediaId: string;
  mediaType: string;
  title?: string | null;
  posterPath?: string | null;
  releaseDate?: string | null;
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function initials(name: string | null, email: string | null, username: string | null): string {
  const base = name || username || email || '?';
  const parts = base.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  const t = base.trim();
  return t ? t[0].toUpperCase() : '?';
}

function displayName(c: CommentRow): string {
  return c.userName || c.userUsername || c.userEmail || `User #${c.userId}`;
}

export function CommentsSection({ mediaId, mediaType, title, posterPath, releaseDate }: CommentsSectionProps) {
  const { data: session, status } = useSession();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isAuthed = status === 'authenticated' && Boolean(session?.user);
  const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const fetchComments = useCallback(async () => {
    if (!mediaId || !mediaType) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/media/comments?mediaId=${encodeURIComponent(mediaId)}&mediaType=${encodeURIComponent(mediaType)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [mediaId, mediaType]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const topLevel = useMemo(() => comments.filter((c) => c.parentId === null), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<number, CommentRow[]>();
    for (const c of comments) {
      if (c.parentId === null) continue;
      const arr = map.get(c.parentId) ?? [];
      arr.push(c);
      map.set(c.parentId, arr);
    }
    return map;
  }, [comments]);

  async function handlePost() {
    const text = composer.trim();
    if (!text) return;
    if (text.length > 2000) return;
    setPosting(true);
    try {
      const res = await fetch('/api/media/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          mediaType,
          content: text,
          parentId: replyTo?.id ?? null,
          title: title ?? undefined,
          posterPath: posterPath ?? undefined,
          releaseDate: releaseDate ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to post comment');
      setComposer('');
      setReplyTo(null);
      await fetchComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/media/comments/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete');
      await fetchComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveEdit(id: number) {
    const text = editingContent.trim();
    if (!text) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/media/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update');
      setEditingId(null);
      setEditingContent('');
      await fetchComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Comments</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}
          </p>
        </div>
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-4 sm:p-6">
          {isAuthed ? (
            <div className="space-y-3">
              {replyTo ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Replying to <span className="font-medium text-foreground">{displayName(replyTo)}</span>
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-3">
                <Avatar size="sm" className="mt-1 hidden sm:flex">
                  {session?.user?.image ? <AvatarImage src={session.user.image} alt={session.user.name ?? ''} /> : null}
                  <AvatarFallback>{initials(session?.user?.name ?? null, session?.user?.email ?? null, (session?.user as { username?: string | null })?.username ?? null)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder={replyTo ? `Reply to ${displayName(replyTo)}…` : 'Share your thoughts…'}
                    maxLength={2000}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{composer.trim().length}/2000</span>
                    <Button onClick={handlePost} disabled={posting || !composer.trim()} size="sm">
                      {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {replyTo ? 'Reply' : 'Comment'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">Sign in to join the conversation.</p>
              <Link href="/auth/signin">
                <Button size="sm" variant="outline">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}{' '}
          <button type="button" onClick={() => setError(null)} className="ml-2 font-medium underline underline-offset-4">
            Dismiss
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Card key={i} className="border-border/60 bg-card/40">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : topLevel.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/30">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Be the first to share what you thought.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {topLevel.map((c) => {
            const replies = repliesByParent.get(c.id) ?? [];
            const isOwner = currentUserId !== null && c.userId === currentUserId;
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="space-y-3">
                <Card className="border-border/60 bg-card/60 backdrop-blur">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar size="sm">
                        {c.userImage ? <AvatarImage src={c.userImage} alt={displayName(c)} /> : null}
                        <AvatarFallback>{initials(c.userName, c.userEmail, c.userUsername)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{displayName(c)}</span>
                          {c.userUsername ? <span className="text-xs text-muted-foreground">@{c.userUsername}</span> : null}
                          <span className="text-xs text-muted-foreground">· {formatRelative(c.createdAt)}</span>
                          {c.updatedAt !== c.createdAt ? <span className="text-xs text-muted-foreground">(edited)</span> : null}
                        </div>

                        {isEditing ? (
                          <div className="mt-3 space-y-3">
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              maxLength={2000}
                              rows={3}
                              className="resize-none"
                              autoFocus
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">{editingContent.trim().length}/2000</span>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditingContent('');
                                  }}
                                >
                                  <X className="mr-1.5 h-3.5 w-3.5" />
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={() => handleSaveEdit(c.id)} disabled={savingEdit || !editingContent.trim()}>
                                  {savingEdit ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                                  Save
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                            {c.content}
                          </p>
                        )}

                        {!isEditing ? (
                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                if (!isAuthed) return;
                                setReplyTo(c);
                                // focus composer on next tick
                                setTimeout(() => document.getElementById(`comments-composer-${mediaId}`)?.focus(), 0);
                              }}
                              disabled={!isAuthed}
                            >
                              <Reply className="mr-1 h-3.5 w-3.5" />
                              Reply
                            </Button>
                            {isOwner ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => {
                                    setEditingId(c.id);
                                    setEditingContent(c.content);
                                  }}
                                >
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleDelete(c.id)}
                                  disabled={deletingId === c.id}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {deletingId === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {replies.length > 0 ? (
                  <div className="ml-4 space-y-3 border-l-2 border-border/50 pl-4 sm:ml-6 sm:pl-6">
                    {replies.map((r) => {
                      const rIsOwner = currentUserId !== null && r.userId === currentUserId;
                      const rIsEditing = editingId === r.id;
                      return (
                        <Card key={r.id} className="border-border/50 bg-card/40">
                          <CardContent className="p-4">
                            <div className="flex gap-3">
                              <Avatar size="sm">
                                {r.userImage ? <AvatarImage src={r.userImage} alt={displayName(r)} /> : null}
                                <AvatarFallback>{initials(r.userName, r.userEmail, r.userUsername)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold">{displayName(r)}</span>
                                  {r.userUsername ? <span className="text-xs text-muted-foreground">@{r.userUsername}</span> : null}
                                  <span className="text-xs text-muted-foreground">· {formatRelative(r.createdAt)}</span>
                                  {r.updatedAt !== r.createdAt ? <span className="text-xs text-muted-foreground">(edited)</span> : null}
                                </div>

                                {rIsEditing ? (
                                  <div className="mt-3 space-y-3">
                                    <Textarea
                                      value={editingContent}
                                      onChange={(e) => setEditingContent(e.target.value)}
                                      maxLength={2000}
                                      rows={2}
                                      className="resize-none"
                                      autoFocus
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-muted-foreground">{editingContent.trim().length}/2000</span>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingId(null);
                                            setEditingContent('');
                                          }}
                                        >
                                          <X className="mr-1.5 h-3.5 w-3.5" />
                                          Cancel
                                        </Button>
                                        <Button size="sm" onClick={() => handleSaveEdit(r.id)} disabled={savingEdit || !editingContent.trim()}>
                                          {savingEdit ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                                    {r.content}
                                  </p>
                                )}

                                {!rIsEditing ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-1">
                                    {rIsOwner ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="xs"
                                          onClick={() => {
                                            setEditingId(r.id);
                                            setEditingContent(r.content);
                                          }}
                                        >
                                          <Pencil className="mr-1 h-3.5 w-3.5" />
                                          Edit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="xs"
                                          onClick={() => handleDelete(r.id)}
                                          disabled={deletingId === r.id}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          {deletingId === r.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                                          Delete
                                        </Button>
                                      </>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* hidden anchor for focus */}
      <span id={`comments-composer-${mediaId}`} className="sr-only" aria-hidden />
    </section>
  );
}
