import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Lore',
  description: 'The philosophy, architecture, and principles behind Lore — the media and multiverse tracker.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About Lore',
    description: 'The philosophy, architecture, and principles behind Lore — the media and multiverse tracker.',
    url: '/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Lore',
    description: 'The philosophy, architecture, and principles behind Lore — the media and multiverse tracker.',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
