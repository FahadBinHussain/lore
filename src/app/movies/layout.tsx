import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Explore trending, popular, and top-rated movies across global cinema on Lore.',
  alternates: {
    canonical: '/movies',
  },
  openGraph: {
    title: 'Movies | Lore',
    description: 'Explore trending, popular, and top-rated movies across global cinema on Lore.',
    url: '/movies',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Movies | Lore',
    description: 'Explore trending, popular, and top-rated movies across global cinema on Lore.',
  },
};

export default function MoviesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
