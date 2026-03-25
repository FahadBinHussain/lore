'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
  Film, Tv, Gamepad2, BookOpen, 
  LayoutDashboard, Search, 
  LogOut, ChevronLeft, ChevronRight,
  Sparkles, Zap, BookCopy, Dice6,
  Music, Podcast, MapPin
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'from-violet-500 to-purple-600' },
  { name: 'Movies', href: '/dashboard/movies', icon: Film, color: 'from-rose-500 to-pink-600' },
  { name: 'TV Shows', href: '/dashboard/tv', icon: Tv, color: 'from-cyan-500 to-blue-600' },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, color: 'from-amber-500 to-orange-600' },
  { name: 'Books', href: '/dashboard/books', icon: BookOpen, color: 'from-emerald-500 to-green-600' },
  { name: 'Comics', href: '/dashboard/comics', icon: BookCopy, color: 'from-purple-500 to-pink-600' },
  { name: 'Board Games', href: '/dashboard/boardgames', icon: Dice6, color: 'from-orange-500 to-red-600' },
  { name: 'Soundtracks', href: '/dashboard/soundtracks', icon: Music, color: 'from-indigo-500 to-blue-600' },
  { name: 'Podcasts', href: '/dashboard/podcasts', icon: Podcast, color: 'from-teal-500 to-cyan-600' },
  { name: 'Theme Parks', href: '/dashboard/themeparks', icon: MapPin, color: 'from-rose-500 to-pink-600' },
  { name: 'Universes', href: '/universes', icon: Sparkles, color: 'from-purple-500 to-indigo-600' },
  { name: 'Search', href: '/search', icon: Search, color: 'from-slate-500 to-gray-600' },
];

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen transition-all duration-500 ease-in-out',
          collapsed ? 'w-24' : 'w-64'
        )}
      >
        {/* Background with gradient and blur */}
        <div className="absolute inset-0 bg-gradient-to-b from-card via-card/95 to-card/90 backdrop-blur-xl border-r border-border/50" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        {/* Content */}
        <div className="relative h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4">
            <Link href="/" className={cn('flex items-center gap-3 group', collapsed && 'justify-center w-full')}>
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="font-bold text-xl bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                    Lore
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium -mt-1">Media Tracker</span>
                </div>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-xl hover:bg-primary/10 transition-all duration-300',
                collapsed && 'hidden'
              )}
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Collapse button when collapsed */}
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-20 h-7 w-7 rounded-full border-2 bg-card shadow-lg hover:shadow-xl hover:bg-primary/10 transition-all duration-300"
              onClick={() => setCollapsed(false)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Navigation */}
          <nav className={cn("flex-1 py-6 space-y-3", collapsed ? "px-3" : "px-3")}>
            {navigation.map((item, index) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (collapsed) {
                return (
                  <div key={item.name} className="w-full flex justify-center">
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 group relative overflow-hidden',
                        isActive
                          ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className={cn(
                        "h-6 w-6 transition-all duration-300",
                        isActive ? "text-primary-foreground" : "group-hover:scale-110"
                      )} />
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                      )}
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 h-11 rounded-xl transition-all duration-300 group relative overflow-hidden',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Background gradient for active state */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                  )}
                  
                  {/* Icon with gradient background */}
                  <div className={cn(
                    "relative p-2 rounded-lg transition-all duration-300",
                    isActive 
                      ? "bg-white/20 shadow-sm" 
                      : "group-hover:bg-primary/20"
                  )}>
                    <Icon className={cn(
                      "h-4 w-4 transition-all duration-300",
                      isActive ? "text-primary-foreground" : `bg-gradient-to-r ${item.color} bg-clip-text text-transparent group-hover:scale-110`
                    )} />
                  </div>
                  
                  <span className="relative font-medium text-sm">{item.name}</span>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>


          {/* Bottom section */}
          <div className={cn("pb-6", collapsed ? "px-3" : "px-3")}>
            {/* User profile */}
            <div className={cn(
              'group relative overflow-hidden rounded-xl transition-all duration-300 mb-3',
              collapsed ? 'flex justify-center' : ''
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className={cn(
                'relative flex items-center gap-3',
                collapsed && 'justify-center'
              )}>
                <div className="relative">
                  <Avatar className={cn(
                    "flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-300",
                    collapsed ? "h-10 w-10" : "h-10 w-10"
                  )}>
                    <AvatarImage src={user.image || ''} alt={user.name || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                      {user.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full border-2 border-card" />
                </div>
                
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sign out button */}
            <div className="flex justify-center">
              {collapsed ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-xl hover:text-destructive transition-all duration-300"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-6 w-6" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'flex-1 transition-all duration-500 ease-in-out',
          collapsed ? 'ml-24' : 'ml-64'
        )}
      >
        {children}
      </main>
    </div>
  );
}