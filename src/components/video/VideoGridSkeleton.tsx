export function VideoGridSkeleton() {
  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="aspect-video bg-gray-800" />
          <div className="p-4 space-y-3">
            <div className="h-5 w-3/4 bg-gray-800 rounded" />
            <div className="h-4 w-1/2 bg-gray-800 rounded" />
            <div className="h-4 w-1/3 bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}