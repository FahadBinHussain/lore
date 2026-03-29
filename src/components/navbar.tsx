'use client';

import { useEffect, useSyncExternalStore, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  Sparkles, ArrowRight, LayoutDashboard, Search, Plus,
  User, Settings, Bell, LogOut, Menu, X, Palette, Check
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

  return 'light';
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

function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', DARK_THEMES.has(theme));
  localStorage.setItem('theme', theme);
  window.dispatchEvent(new Event('theme-change'));
}

export function Navbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, getClientTheme, getServerTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50">
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/90 to-background/80 backdrop-blur-md" />

      <div className="relative w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0">
            <div className="relative">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                Lore
              </span>
              <span className="text-[8px] sm:text-[10px] text-muted-foreground font-medium -mt-1">Media Tracker</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-4">
            <Link
              href="/movies"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Movies
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/tv"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              TV Shows
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/anime"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Anime
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/games"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Games
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/books"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Books
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/comics"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Comics
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/boardgames"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Board Games
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/soundtracks"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Soundtracks
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/podcasts"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Podcasts
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/themeparks"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Theme Parks
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/search"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Search
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
          </nav>

          {/* Medium Screen Navigation */}
          <nav className="hidden md:flex lg:hidden items-center gap-4">
            <Link
              href="/movies"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Movies
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/tv"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              TV Shows
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/games"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Games
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
            </Link>
            <Link
              href="/search"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              Search
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
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
                className="w-56 max-h-80 overflow-y-auto"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Select Theme</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {DAISYUI_THEMES.map((themeName) => (
                    <DropdownMenuItem
                      key={themeName}
                      className="capitalize"
                      onClick={() => applyTheme(themeName)}
                    >
                      <span>{themeName}</span>
                      {theme === themeName && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              {status === 'loading' ? (
                <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <div className="relative h-10 w-10 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all duration-200 cursor-pointer">
                      <Avatar className="h-10 w-10 ring-2 ring-background/50">
                        {session.user.image && (session.user.image.startsWith('http://') || session.user.image.startsWith('https://')) ? (
                          <AvatarImage src={session.user.image} alt={session.user.name || ''} />
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
                          {session.user.image && (session.user.image.startsWith('http://') || session.user.image.startsWith('https://')) ? (
                            <AvatarImage src={session.user.image} alt={session.user.name || ''} />
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
                            {session.user.role || 'user'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Section */}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Navigation
                      </DropdownMenuLabel>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <Link href="/dashboard" className="flex items-center w-full">
                          <LayoutDashboard className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Dashboard</span>
                          <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <Link href="/search" className="flex items-center w-full">
                          <Search className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Search Media</span>
                        </Link>
                      </DropdownMenuItem>

                      {session?.user?.role === 'admin' && (
                        <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                          <Link href="/universes/create" className="flex items-center w-full">
                            <Plus className="mr-3 h-4 w-4 text-primary" />
                            <span className="font-medium">Create Universe</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Account Section */}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Account
                      </DropdownMenuLabel>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <User className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Profile</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <Settings className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Settings</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <Bell className="mr-3 h-4 w-4 text-primary" />
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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col space-y-4">
              <Link
                href="/movies"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Movies
              </Link>
              <Link
                href="/tv"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                TV Shows
              </Link>
              <Link
                href="/anime"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Anime
              </Link>
              <Link
                href="/games"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Games
              </Link>
              <Link
                href="/books"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Books
              </Link>
              <Link
                href="/comics"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Comics
              </Link>
              <Link
                href="/boardgames"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Board Games
              </Link>
              <Link
                href="/soundtracks"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Soundtracks
              </Link>
              <Link
                href="/podcasts"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Podcasts
              </Link>
              <Link
                href="/themeparks"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Theme Parks
              </Link>
              <Link
                href="/search"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Search
              </Link>
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  Use the user menu above to sign in or access your dashboard
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
