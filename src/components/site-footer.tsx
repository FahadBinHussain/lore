import Image from 'next/image';
import Link from 'next/link';

const BROWSE = [
  { href: '/movies', label: 'Movies' },
  { href: '/tv', label: 'TV' },
  { href: '/anime', label: 'Anime' },
  { href: '/games', label: 'Games' },
  { href: '/books', label: 'Books' },
  { href: '/comics', label: 'Comics' },
  { href: '/boardgames', label: 'Board games' },
  { href: '/soundtracks', label: 'Soundtracks' },
  { href: '/podcasts', label: 'Podcasts' },
  { href: '/themeparks', label: 'Theme parks' },
];

const LORE = [
  { href: '/universes', label: 'Universes' },
  { href: '/artists', label: 'Artists' },
  { href: '/search', label: 'Search' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const linkClass =
  'text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div className="max-w-xs">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.png" alt="Lore logo" width={32} height={32} className="w-8 h-8 object-contain" />
              <span className="font-heading text-lg font-bold tracking-tight">Lore</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Every official release in a franchise, in release order, with your progress tracked along the way.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <nav aria-label="Browse media" className="sm:col-span-2">
              <h2 className="text-sm font-semibold mb-3">Browse</h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                {BROWSE.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Lore">
              <h2 className="text-sm font-semibold mb-3">Lore</h2>
              <ul className="space-y-2">
                {LORE.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Lore
        </div>
      </div>
    </footer>
  );
}
