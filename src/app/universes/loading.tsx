export default function UniversesLoading() {
  return (
    <main className="min-h-screen bg-base-100 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-32" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading universes</span>

      {/* Hero skeleton */}
      <section className="hero bg-base-200/60 rounded-3xl border border-base-200/80 p-6 sm:p-10 lg:p-12 mb-10 shadow-sm">
        <div className="hero-content flex-col lg:flex-row justify-between items-start lg:items-center w-full max-w-none p-0 gap-8">
          <div className="max-w-2xl w-full space-y-4">
            <div className="skeleton h-6 w-44 rounded-full" />
            <div className="skeleton h-12 sm:h-16 w-full max-w-xl rounded-2xl" />
            <div className="skeleton h-4 w-full max-w-lg rounded" />
            <div className="skeleton h-4 w-3/4 max-w-md rounded" />
            <div className="flex gap-3 pt-2">
              <div className="skeleton h-10 w-40 rounded-full" />
              <div className="skeleton h-10 w-36 rounded-full" />
            </div>
          </div>
          <div className="stats stats-vertical sm:stats-horizontal shadow-md bg-base-100 border border-base-200 rounded-2xl w-full sm:w-auto">
            <div className="stat py-4 px-6 sm:px-8 space-y-2">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-10 w-16" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="stat py-4 px-6 sm:px-8 space-y-2">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-10 w-24" />
              <div className="skeleton h-3 w-28" />
            </div>
          </div>
        </div>
      </section>

      {/* Search and filter controls skeleton */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
        <div className="skeleton h-12 max-w-md w-full rounded-xl" />
        <div className="skeleton h-9 w-40 rounded-lg self-end sm:self-auto" />
      </div>

      {/* Cards grid skeleton */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="card card-border bg-base-100 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="skeleton aspect-[16/9] w-full rounded-none" />
              <div className="card-body p-5 space-y-3">
                <div className="skeleton h-6 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-2/3" />
                <div className="flex gap-2 py-1">
                  <div className="skeleton h-5 w-16 rounded-full" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
                <div className="skeleton h-2 w-full mt-2" />
                <div className="card-actions justify-between pt-3 border-t border-base-200 mt-auto">
                  <div className="skeleton h-5 w-24 rounded-full" />
                  <div className="skeleton h-5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
