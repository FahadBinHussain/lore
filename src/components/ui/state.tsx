import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-16 text-center', className)}>
      <Icon className="w-12 h-12 text-muted-foreground/30" />
      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  retryAction?: React.ReactNode;
  className?: string;
}

export function ErrorState({ icon: Icon, title, description, retryAction, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-16 text-center', className)}>
      {Icon ? (
        <Icon className="w-12 h-12 text-destructive/40" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-destructive text-xl">!</span>
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {retryAction && <div className="pt-2">{retryAction}</div>}
    </div>
  );
}