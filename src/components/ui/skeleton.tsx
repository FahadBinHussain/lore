import { cn } from '@/lib/utils';
export { EmptyState, ErrorState } from './state';

function SkeletonBase({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-md', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <SkeletonBase className={className} />;
}

export function MediaCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/40">
      <SkeletonBase className="aspect-[2/3] w-full rounded-b-none" />
      <div className="p-3 space-y-2">
        <SkeletonBase className="h-4 w-3/4" />
        <SkeletonBase className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function MediaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MediaCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SkeletonBase className="h-[50vh] min-h-[400px] w-full rounded-none" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonBase className="h-8 w-2/3" />
            <SkeletonBase className="h-4 w-full" />
            <SkeletonBase className="h-4 w-full" />
            <SkeletonBase className="h-4 w-3/4" />
            <div className="flex gap-3 pt-2">
              <SkeletonBase className="h-10 w-32 rounded-lg" />
              <SkeletonBase className="h-10 w-32 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-6">
              <SkeletonBase className="h-24 rounded-xl" />
              <SkeletonBase className="h-24 rounded-xl" />
            </div>
          </div>
          <div className="space-y-4">
            <SkeletonBase className="h-48 rounded-2xl" />
            <SkeletonBase className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border/40">
      <SkeletonBase className="w-12 h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBase className="h-4 w-1/2" />
        <SkeletonBase className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}