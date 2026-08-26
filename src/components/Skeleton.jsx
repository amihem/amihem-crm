export function CardSkeleton({ count = 4 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-panel border border-line rounded-2xl p-4 animate-pulse">
          <div className="h-3.5 bg-line rounded w-1/3 mb-2.5" />
          <div className="h-3 bg-line rounded w-2/3 mb-2" />
          <div className="h-3 bg-line rounded w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-panel border border-line rounded-2xl p-4 animate-pulse flex flex-col gap-2">
          <div className="h-3.5 bg-line rounded w-2/3" />
          <div className="h-2.5 bg-line rounded w-1/2" />
          <div className="h-2.5 bg-line rounded w-1/3 mt-1" />
        </div>
      ))}
    </div>
  );
}
