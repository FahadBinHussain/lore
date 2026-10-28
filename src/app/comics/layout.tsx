import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comics & Graphic Novels',
  description: 'Explore comic arcs, graphic novels, manga, and reading orders on Lore.',
  alternates: {
    canonical: '/comics',
  },
  openGraph: {
    title: 'Comics & Graphic Novels | Lore',
    description: 'Explore comic arcs, graphic novels, manga, and reading orders on Lore.',
    url: '/comics',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comics & Graphic Novels | Lore',
    description: 'Explore comic arcs, graphic novels, manga, and reading orders on Lore.',
  },
};

export default function ComicsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
