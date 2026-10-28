import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Soundtracks & Scores',
  description: 'Explore film scores, game OSTs, anime themes, and original soundtracks on Lore.',
  alternates: {
    canonical: '/soundtracks',
  },
  openGraph: {
    title: 'Soundtracks & Scores | Lore',
    description: 'Explore film scores, game OSTs, anime themes, and original soundtracks on Lore.',
    url: '/soundtracks',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soundtracks & Scores | Lore',
    description: 'Explore film scores, game OSTs, anime themes, and original soundtracks on Lore.',
  },
};

export default function SoundtracksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
