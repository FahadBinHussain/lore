import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TV Shows',
  description: 'Explore trending series, seasonal television, episode guides, and streaming shows on Lore.',
  alternates: {
    canonical: '/tv',
  },
  openGraph: {
    title: 'TV Shows | Lore',
    description: 'Explore trending series, seasonal television, episode guides, and streaming shows on Lore.',
    url: '/tv',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TV Shows | Lore',
    description: 'Explore trending series, seasonal television, episode guides, and streaming shows on Lore.',
  },
};

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
