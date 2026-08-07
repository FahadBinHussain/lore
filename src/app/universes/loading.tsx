export default function UniversesLoading() {
  return (
    <main className="min-h-screen bg-background pt-16" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading universes</span>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="relative px-6 md:px-12 pt-16 md:pt-24 pb-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10 animate-pulse motion-reduce:animate-none">
            <div className="max-w-2xl space-y-5">
              <div className="h-5 w-32 rounded-full border border-border/60 bg-muted/80 dark:border-outline-variant/50 dark:bg-surface-container-highest" />
              <div className="h-14 md:h-20 w-full max-w-xl rounded-2xl border border-border/60 bg-muted/80 dark:border-outline-variant/50 dark:bg-surface-container-highest" />
              <div className="h-5 w-full max-w-lg rounded bg-muted/70 dark:bg-surface-container-highest" />
              <div className="h-5 w-3/4 max-w-md rounded bg-muted/70 dark:bg-surface-container-highest" />
              <div className="h-10 w-44 rounded-full border border-primary/20 bg-primary/15 dark:border-primary/30 dark:bg-primary/25" />
            </div>
            <div className="flex gap-8 md:gap-12">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm dark:border-outline-variant/50 dark:bg-surface-container-high/80">
                  <div className="h-10 w-16 rounded-lg bg-muted/80 dark:bg-surface-container-highest" />
                  <div className="h-3 w-20 rounded bg-muted/70 dark:bg-surface-container-highest" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="h-12 bg-gradient-to-b from-transparent to-background" />
      </section>

      <section className="px-6 md:px-12 pt-4 pb-32 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm animate-pulse motion-reduce:animate-none dark:border-outline-variant/50 dark:bg-surface-container-high/70"
            >
              <div className="h-48 border-b border-border/60 bg-muted/80 dark:border-outline-variant/50 dark:bg-surface-container-highest" />
              <div className="p-6 space-y-3">
                <div className="h-6 w-3/4 rounded bg-muted/80 dark:bg-surface-container-highest" />
                <div className="h-4 w-full rounded bg-muted/70 dark:bg-surface-container-highest" />
                <div className="h-4 w-2/3 rounded bg-muted/70 dark:bg-surface-container-highest" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
