export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="h-10 w-36 rounded-2xl bg-gray-200/70 animate-pulse mb-4" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-200/60 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
