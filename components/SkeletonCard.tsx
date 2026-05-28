export default function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-32 rounded bg-neutral-800" />
        <div className="h-4 w-4 rounded-full bg-neutral-800" />
      </div>
      <div className="h-8 w-20 rounded bg-neutral-800" />
      <div className="h-5 w-16 rounded-full bg-neutral-800" />
      <div className="h-6 w-full rounded bg-neutral-800" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="h-20 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="h-56 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse" />
    </div>
  );
}
