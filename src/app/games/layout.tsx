import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Games',
  description: 'Track games across franchises, release platforms, and story timelines on Lore.',
  alternates: {
    canonical: '/games',
  },
  openGraph: {
    title: 'Video Games | Lore',
    description: 'Track games across franchises, release platforms, and story timelines on Lore.',
    url: '/games',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Video Games | Lore',
    description: 'Track games across franchises, release platforms, and story timelines on Lore.',
  },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
