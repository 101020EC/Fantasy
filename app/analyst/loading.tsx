export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="h-10 w-48 rounded-2xl bg-gray-200/70 animate-pulse mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-200/60 animate-pulse" />
        ))}
      </div>
      <div className="h-20 rounded-2xl bg-gray-200/60 animate-pulse mb-5" />
      <div className="min-h-[480px] rounded-2xl bg-gray-200/50 animate-pulse" />
    </div>
  );
}
