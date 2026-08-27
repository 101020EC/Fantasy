/**
 * Painted the moment the link is clicked.
 *
 * Without a loading boundary the App Router renders nothing at all for a
 * `force-dynamic` route until the server component resolves, so the click
 * looked like it had done nothing for over a second. It also gives Next
 * something to prefetch for a route it otherwise cannot.
 */
export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-4 sm:pt-3 sm:pb-6">
      <div className="h-10 w-56 rounded-2xl bg-gray-200/70 animate-pulse mb-3" />
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="h-9 w-40 rounded-full bg-gray-200/70 animate-pulse" />
        <div className="h-14 w-52 rounded-2xl bg-gray-200/60 animate-pulse hidden sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3">
        <div className="h-24 rounded-3xl bg-emerald-100/70 animate-pulse" />
        <div className="h-24 rounded-3xl bg-rose-100/70 animate-pulse" />
      </div>
      <div className="h-36 rounded-3xl bg-gray-200/60 animate-pulse mb-4" />
      <div className="min-h-[420px] rounded-3xl bg-gray-200/50 animate-pulse" />
    </div>
  );
}
