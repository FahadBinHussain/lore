import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  AtSign,
  CalendarDays,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { normalizeUserRole } from '@/lib/auth/roles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const metadata: Metadata = {
  title: 'Profile - Lore',
  description: 'View your Lore account profile',
};

function normalizeAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function getInitials(name: string | null | undefined, fallback: string) {
  const source = name?.trim() || fallback;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const user = session.user;
  const role = normalizeUserRole(user.role);
  const displayName = user.name || user.username || 'User';
  const email = user.email || 'No email on file';
  const avatarUrl = normalizeAvatarUrl(user.image);
  const initials = getInitials(displayName, email);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Profile</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage your identity and jump back into your media library.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-lg border border-border/60 bg-card text-card-foreground shadow-sm">
            <div className="border-b border-border/60 bg-gradient-to-r from-primary/8 via-primary/4 to-secondary/8 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="size-20 shrink-0 bg-primary text-2xl font-semibold text-primary-foreground ring-4 ring-background">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : null}
                  <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold sm:text-2xl">{displayName}</h2>
                  <p className="truncate text-sm text-muted-foreground">{email}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
                    <ShieldCheck className="size-3.5" />
                    {role}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <UserRound className="size-4 text-muted-foreground" />
                  Name
                </div>
                <p className="truncate text-sm text-muted-foreground">{displayName}</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AtSign className="size-4 text-muted-foreground" />
                  Email
                </div>
                <p className="truncate text-sm text-muted-foreground">{email}</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  Role
                </div>
                <p className="text-sm capitalize text-muted-foreground">{role}</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  Account
                </div>
                <p className="text-sm text-muted-foreground">Signed in</p>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="group flex items-center rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LayoutDashboard className="mr-3 size-4 text-muted-foreground" />
                Dashboard
                <ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/search"
                className="group flex items-center rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Search className="mr-3 size-4 text-muted-foreground" />
                Search Media
                <ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
