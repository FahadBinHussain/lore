'use client';

import Link from 'next/link';
import { ArrowRight, ListOrdered, CheckCheck, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRINCIPLES = [
  {
    icon: Layers,
    title: 'Complete by design',
    body: 'A universe holds every official release in a franchise: main series, sequels, spin-offs, shorts, games, books, comics, and soundtracks. Nothing is dropped for being small or obscure.',
  },
  {
    icon: ListOrdered,
    title: 'Release order first',
    body: 'Items are sorted by when they originally came out, so the timeline reads the way the franchise actually unfolded.',
  },
  {
    icon: CheckCheck,
    title: 'Progress you can trust',
    body: 'Progress is items done out of items tracked. Anything that cannot be tracked yet is labeled as curated instead of being counted.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.1] max-w-3xl">
            Tracking media should feel as good as finishing it.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Lore helps enthusiasts organize and follow their entertainment across movies, TV shows, anime, games, books, comics, and more, one franchise at a time.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold mb-10">How Lore works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="w-5 h-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to start your timeline?</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Sign in, open a universe, and mark the first thing you have finished.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth/signin">
              <Button size="lg" className="group h-11 px-5 text-sm w-full sm:w-auto">
                Get started
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="h-11 px-5 text-sm w-full sm:w-auto">
                Contact us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
