'use client';

import { useEffect, useSyncExternalStore, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { isAdminRole, normalizeUserRole } from '@/lib/auth/roles';
import {
  ArrowRight, LayoutDashboard, Search, Plus,
  User, Settings, Bell, LogOut, Menu, X, Palette, Check, LoaderCircle
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

const DAISYUI_THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
  'caramellatte',
  'abyss',
  'silk',
] as const;

const DARK_THEMES = new Set([
  'dark',
  'synthwave',
  'halloween',
  'forest',
  'black',
  'luxury',
  'dracula',
  'business',
  'night',
  'coffee',
  'dim',
  'sunset',
  'abyss',
]);

function isValidTheme(theme: string | null): theme is (typeof DAISYUI_THEMES)[number] {
  return !!theme && DAISYUI_THEMES.includes(theme as (typeof DAISYUI_THEMES)[number]);
}

function getServerTheme() {
  return 'light';
}

function getClientTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const savedTheme = localStorage.getItem('theme');
  if (isValidTheme(savedTheme)) {
    return savedTheme;
  }

  const htmlTheme = document.documentElement.getAttribute('data-theme');
  if (isValidTheme(htmlTheme)) {
    return htmlTheme;
  }

  return 'dark';
}

function subscribeTheme(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleThemeChange = () => callback();
  window.addEventListener('storage', handleThemeChange);
  window.addEventListener('theme-change', handleThemeChange);

  return () => {
    window.removeEventListener('storage', handleThemeChange);
    window.removeEventListener('theme-change', handleThemeChange);
  };
}

function applyTheme(theme: string, options?: { persist?: boolean; dispatch?: boolean }) {
  const persist = options?.persist ?? true;
  const dispatch = options?.dispatch ?? true;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', DARK_THEMES.has(theme));
  if (persist) {
    localStorage.setItem('theme', theme);
  }
  if (dispatch) {
    window.dispatchEvent(new Event('theme-change'));
  }
}

function normalizeAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

export function Navbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [universesPendingFrom, setUniversesPendingFrom] = useState<string | null>(null);
  const [themeFilter, setThemeFilter] = useState('');
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeTheme, getClientTheme, getServerTheme);
  const avatarUrl = normalizeAvatarUrl(session?.user?.image);
  const universesActive = pathname === '/universes' || pathname.startsWith('/universes/');
  const universesPending = universesPendingFrom === pathname && !universesActive;

  const handlePendingUniversesClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !universesPending ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTheme = localStorage.getItem('theme');
    if (isValidTheme(savedTheme) && savedTheme !== theme) {
      // First hydration can carry the server fallback snapshot.
      // Respect persisted user theme instead of overwriting it.
      applyTheme(savedTheme, { persist: false, dispatch: true });
      return;
    }
    applyTheme(theme);
  }, [theme]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50">
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/90 to-background/80 backdrop-blur-md" />

      <div className="relative w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Lore logo"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain bg-transparent transform-none rotate-0 scale-100"
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg sm:text-xl text-foreground">
                Lore
              </span>
              <span className="text-[8px] sm:text-[10px] text-muted-foreground font-medium -mt-1">Media Tracker</span>
            </div>
          </Link>

          {/* Desktop Navigation — single source of truth, premium grouped */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
            {[
              { href: '/movies', label: 'Movies' },
              { href: '/tv', label: 'TV' },
              { href: '/anime', label: 'Anime' },
              { href: '/games', label: 'Games' },
              { href: '/books', label: 'Books' },
            ].map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors relative ${active ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
                >
                  {item.label}
                </Link>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 rounded-full px-3 text-sm font-medium' })}
              >
                Explore
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground">More</DropdownMenuLabel>
                  {[
                    { href: '/manga', label: 'Manga' },
                    { href: '/comics', label: 'Comics' },
                    { href: '/boardgames', label: 'Board Games' },
                    { href: '/soundtracks', label: 'Soundtracks' },
                    { href: '/podcasts', label: 'Podcasts' },
                    { href: '/themeparks', label: 'Theme Parks' },
                  ].map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <DropdownMenuLinkItem
                        key={item.href}
                        render={<Link href={item.href} />}
                        closeOnClick
                        className={active ? 'bg-muted text-foreground' : ''}
                      >
                        {item.label}
                      </DropdownMenuLinkItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/universes"
              aria-current={universesActive ? 'page' : undefined}
              aria-busy={universesPending}
              onClick={handlePendingUniversesClick}
              onNavigate={() => setUniversesPendingFrom(pathname)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${universesActive || universesPending ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
            >
              Universes
              <span className="relative size-3.5" aria-hidden="true">
                <LoaderCircle className={`absolute inset-0 size-3.5 animate-spin transition-opacity ${universesPending ? 'opacity-100' : 'opacity-0'}`} />
              </span>
            </Link>
            <Link
              href="/search"
              aria-current={pathname === '/search' ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${pathname === '/search' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
            >
              Search
            </Link>
          </nav>

          {/* Tablet Navigation — compact */}
          <nav className="hidden md:flex lg:hidden items-center gap-1" aria-label="Primary">
            {[
              { href: '/movies', label: 'Movies' },
              { href: '/tv', label: 'TV' },
              { href: '/games', label: 'Games' },
            ].map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {item.label}
                </Link>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 rounded-full px-3' })}>Browse</DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {[
                  { href: '/anime', label: 'Anime' },
                  { href: '/books', label: 'Books' },
                  { href: '/manga', label: 'Manga' },
                  { href: '/comics', label: 'Comics' },
                  { href: '/boardgames', label: 'Board Games' },
                  { href: '/soundtracks', label: 'Soundtracks' },
                  { href: '/podcasts', label: 'Podcasts' },
                  { href: '/themeparks', label: 'Theme Parks' },
                ].map((i) => (
                  <DropdownMenuLinkItem key={i.href} render={<Link href={i.href} />} closeOnClick>
                    {i.label}
                  </DropdownMenuLinkItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/universes"
              aria-current={universesActive ? 'page' : undefined}
              aria-busy={universesPending}
              onClick={handlePendingUniversesClick}
              onNavigate={() => setUniversesPendingFrom(pathname)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${universesActive || universesPending ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Universes
              <span className="relative size-3.5" aria-hidden="true">
                <LoaderCircle className={`absolute inset-0 size-3.5 animate-spin transition-opacity ${universesPending ? 'opacity-100' : 'opacity-0'}`} />
              </span>
            </Link>
            <Link href="/search" className={`rounded-full px-3 py-1.5 text-sm font-medium ${pathname === '/search' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              Search
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'h-9 px-2 sm:px-3 text-xs sm:text-sm',
                })}
                title={`Theme: ${theme}`}
              >
                <Palette className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline capitalize">{theme}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 p-0 overflow-hidden"
              >
                <div className="p-2 border-b border-border/50 sticky top-0 bg-popover z-10">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2 pt-1 pb-2">Select Theme · {DAISYUI_THEMES.length}</div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      placeholder="Filter themes…"
                      value={themeFilter}
                      onChange={(e) => setThemeFilter(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="w-full rounded-md border border-input bg-muted/50 pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-1">
                  <DropdownMenuGroup>
                    {(themeFilter ? DAISYUI_THEMES.filter((t) => t.toLowerCase().includes(themeFilter.toLowerCase())) : DAISYUI_THEMES).map((themeName) => (
                      <DropdownMenuItem
                        key={themeName}
                        className="capitalize gap-2"
                        onClick={() => applyTheme(themeName)}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DARK_THEMES.has(themeName) ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)' }} aria-hidden />
                        <span>{themeName}</span>
                        {theme === themeName && <Check className="ml-auto h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                    {themeFilter && DAISYUI_THEMES.filter((t) => t.toLowerCase().includes(themeFilter.toLowerCase())).length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">No themes match “{themeFilter}”</div>
                    )}
                  </DropdownMenuGroup>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              {session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <div className="relative h-10 w-10 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all duration-200 cursor-pointer">
                      <Avatar className="h-10 w-10 ring-2 ring-background/50">
                        {avatarUrl ? (
                          <AvatarImage src={avatarUrl} alt={session.user.name || ''} referrerPolicy="no-referrer" />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground font-semibold text-sm">
                          {session.user.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72 p-0 shadow-2xl border-border/50 bg-background/95 backdrop-blur-xl" align="end">
                    {/* User Profile Section */}
                    <div className="px-4 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-secondary/5 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          {avatarUrl ? (
                            <AvatarImage src={avatarUrl} alt={session.user.name || ''} referrerPolicy="no-referrer" />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                            {session.user.name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {session.user.name || 'User'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {session.user.email || 'user@example.com'}
                          </p>
                          <p className="text-xs text-primary font-medium capitalize">
                            {normalizeUserRole(session.user.role)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Section */}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Navigation
                      </DropdownMenuLabel>

                      <DropdownMenuLinkItem
                        render={<Link href="/dashboard" />}
                        closeOnClick
                        className="group px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150"
                      >
                        <LayoutDashboard className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">Dashboard</span>
                        <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </DropdownMenuLinkItem>

                      <DropdownMenuLinkItem
                        render={<Link href="/search" />}
                        closeOnClick
                        className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150"
                      >
                        <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">Search Media</span>
                      </DropdownMenuLinkItem>

                      {isAdminRole(session?.user?.role) && (
                        <DropdownMenuLinkItem
                          render={<Link href="/universes/create" />}
                          closeOnClick
                          className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150"
                        >
                          <Plus className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">Create Universe</span>
                        </DropdownMenuLinkItem>
                      )}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Account Section */}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Account
                      </DropdownMenuLabel>

                      <DropdownMenuLinkItem
                        render={<Link href="/profile" />}
                        closeOnClick
                        className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150"
                      >
                        <User className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">Profile</span>
                      </DropdownMenuLinkItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <Settings className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">Settings</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <Bell className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">Notifications</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Sign Out */}
                    <div className="p-2">
                      <DropdownMenuItem
                        className="px-3 py-2.5 cursor-pointer hover:bg-destructive/5 focus:bg-destructive/5 transition-colors duration-150 text-destructive focus:text-destructive"
                        onClick={() => signOut({ callbackUrl: '/' })}
                      >
                        <div className="flex items-center w-full">
                          <LogOut className="mr-3 h-4 w-4" />
                          <span className="font-medium">Sign Out</span>
                        </div>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : status === 'loading' ? (
                <div className="h-10 w-10 rounded-full skeleton-shimmer" />
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button variant="ghost" className="text-sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signin">
                    <Button className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu — grouped, premium */}
        {mobileMenuOpen && (
          <div id="mobile-nav" className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="px-4 py-4 space-y-5 max-h-[calc(100dvh-4rem)] overflow-y-auto">
              <div>
                <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Watch</div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { href: '/movies', label: 'Movies' },
                    { href: '/tv', label: 'TV Shows' },
                    { href: '/anime', label: 'Anime' },
                    { href: '/universes', label: 'Universes', extra: universesActive || universesPending },
                  ].map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={(e) => {
                          if (item.href === '/universes') {
                            handlePendingUniversesClick(e as unknown as MouseEvent<HTMLAnchorElement>);
                            if ((e as unknown as { defaultPrevented: boolean }).defaultPrevented) return;
                          }
                          setMobileMenuOpen(false);
                        }}
                        className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active || (item as { extra?: boolean }).extra ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Read & Play</div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { href: '/manga', label: 'Manga' },
                    { href: '/books', label: 'Books' },
                    { href: '/comics', label: 'Comics' },
                    { href: '/games', label: 'Games' },
                    { href: '/boardgames', label: 'Board Games' },
                  ].map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)} className={`rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Listen & Visit</div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { href: '/soundtracks', label: 'Soundtracks' },
                    { href: '/podcasts', label: 'Podcasts' },
                    { href: '/themeparks', label: 'Theme Parks' },
                    { href: '/search', label: 'Search' },
                  ].map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)} className={`rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">Sign in to track universes and sync progress</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

