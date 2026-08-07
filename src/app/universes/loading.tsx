export default function UniversesLoading() {
  return (
    <main className="min-h-screen bg-background pt-16" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading universes</span>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="relative px-6 md:px-12 pt-16 md:pt-24 pb-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10 animate-pulse">
            <div className="max-w-2xl space-y-5">
              <div className="h-5 w-32 rounded-full bg-surface-container-high/70" />
              <div className="h-14 md:h-20 w-full max-w-xl rounded-2xl bg-surface-container-high/70" />
              <div className="h-5 w-full max-w-lg rounded bg-surface-container-high/50" />
              <div className="h-5 w-3/4 max-w-md rounded bg-surface-container-high/50" />
              <div className="h-10 w-44 rounded-full bg-primary/20" />
            </div>
            <div className="flex gap-8 md:gap-12">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-10 w-16 rounded-lg bg-surface-container-high/70" />
                  <div className="h-3 w-20 rounded bg-surface-container-high/50" />
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
            <div key={index} className="glass-card rounded-3xl overflow-hidden animate-pulse">
              <div className="h-48 bg-surface-container-high/50" />
              <div className="p-6 space-y-3">
                <div className="h-6 bg-surface-container-high/50 rounded w-3/4" />
                <div className="h-4 bg-surface-container-high/50 rounded w-full" />
                <div className="h-4 bg-surface-container-high/50 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
