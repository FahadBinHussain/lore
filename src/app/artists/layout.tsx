import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artists',
  description: 'Explore visual artists, art galleries, and tracked paintings across history on Lore.',
  alternates: {
    canonical: '/artists',
  },
  openGraph: {
    title: 'Artists | Lore',
    description: 'Explore visual artists, art galleries, and tracked paintings across history on Lore.',
    url: '/artists',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Artists | Lore',
    description: 'Explore visual artists, art galleries, and tracked paintings across history on Lore.',
  },
};

export default function ArtistsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
