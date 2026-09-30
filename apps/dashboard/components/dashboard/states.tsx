import type { ReactNode } from "react";
import { Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  hint,
  icon,
  className,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
      role="status"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  hint = "The ShaktiOS API may be unreachable. Check that it is running, then retry.",
  onRetry,
  className,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("rounded-[1.4rem] bg-card py-0 ring-0", className)} aria-hidden>
      <CardContent className="space-y-3 p-6">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-1/2 animate-pulse rounded-xl bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-6 py-4" aria-hidden aria-label="Loading table">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="h-9 flex-1 animate-pulse rounded-xl bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-9 w-16 animate-pulse rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}
