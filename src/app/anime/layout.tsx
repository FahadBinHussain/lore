import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime',
  description: 'Track seasonal anime, top series, movies, and complete franchise watch orders on Lore.',
  alternates: {
    canonical: '/anime',
  },
  openGraph: {
    title: 'Anime | Lore',
    description: 'Track seasonal anime, top series, movies, and complete franchise watch orders on Lore.',
    url: '/anime',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anime | Lore',
    description: 'Track seasonal anime, top series, movies, and complete franchise watch orders on Lore.',
  },
};

export default function AnimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
