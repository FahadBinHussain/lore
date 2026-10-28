import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Books & Novels',
  description: 'Track novels, series, lore companions, and expanded universe literature on Lore.',
  alternates: {
    canonical: '/books',
  },
  openGraph: {
    title: 'Books & Novels | Lore',
    description: 'Track novels, series, lore companions, and expanded universe literature on Lore.',
    url: '/books',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Books & Novels | Lore',
    description: 'Track novels, series, lore companions, and expanded universe literature on Lore.',
  },
};

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
