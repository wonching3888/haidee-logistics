interface PageSkeletonProps {
  rows?: number;
}

export function PageSkeleton({ rows = 3 }: PageSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-haidee-border/40" />
      <div className="h-4 w-72 animate-pulse rounded bg-haidee-border/30" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-haidee-border/30"
        />
      ))}
    </div>
  );
}
