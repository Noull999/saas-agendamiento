export function SkeletonLine({ className = '' }) {
  return <div className={`bg-zinc-800 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-4 w-3/4" />
          <SkeletonLine className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <SkeletonLine className="h-4 w-1/4" />
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-4 w-1/5" />
          <SkeletonLine className="h-4 w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}
