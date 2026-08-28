/** Painted the moment the link is clicked — see Round 3 and Decision 22. */
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-6 sm:pt-3 space-y-3">
      <div className="h-10 w-52 rounded-2xl bg-gray-200/70 animate-pulse mb-2" />
      <div className="h-16 rounded-2xl bg-purple-100/70 animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-3xl bg-white/70 border border-black/5 p-4 space-y-2.5">
          <div className="h-4 w-40 rounded bg-gray-200/70 animate-pulse" />
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="h-9 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}
