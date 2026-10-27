export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      <div className="h-36 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-16 rounded-xl bg-gray-200/70 animate-pulse" />
      <div className="min-h-[560px] rounded-xl bg-emerald-100/60 animate-pulse" />
    </div>
  );
}
