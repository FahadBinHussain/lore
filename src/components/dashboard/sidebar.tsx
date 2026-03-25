'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Film, Tv, Gamepad2, BookOpen, Sparkles,
  Music, Podcast, MapPin, Menu, X, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const categories = [
  { name: 'Overview', href: '/dashboard', icon: Home, color: 'text-primary' },
  { name: 'Movies', href: '/dashboard/movies', icon: Film, color: 'text-violet-500' },
  { name: 'TV Shows', href: '/dashboard/tv', icon: Tv, color: 'text-cyan-500' },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, color: 'text-amber-500' },
  { name: 'Books', href: '/dashboard/books', icon: BookOpen, color: 'text-emerald-500' },
  { name: 'Comics', href: '/dashboard/comics', icon: Sparkles, color: 'text-purple-500' },
  { name: 'Board Games', href: '/dashboard/boardgames', icon: Gamepad2, color: 'text-orange-500' },
  { name: 'Soundtracks', href: '/dashboard/soundtracks', icon: Music, color: 'text-teal-500' },
  { name: 'Podcasts', href: '/dashboard/podcasts', icon: Podcast, color: 'text-red-500' },
  { name: 'Theme Parks', href: '/dashboard/themeparks', icon: MapPin, color: 'text-lime-500' },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-[60] md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-64 bg-card border-r transform transition-transform duration-200 ease-in-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold">Media Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your favorites</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = pathname === category.href;
              
              return (
                <Link
                  key={category.href}
                  href={category.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className={cn('w-5 h-5', category.color)} />
                  {category.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              © 2026 Lore Media Tracker
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}