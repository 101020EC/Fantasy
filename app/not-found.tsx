import Link from 'next/link';
import { Search, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="p-8 rounded-xl bg-white border border-[var(--line)]">
        <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto mb-4">
          <Search className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Page not found</h2>
        <p className="text-xs text-gray-500 mb-6">That page does not exist, or the Team ID was not a number.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-white font-semibold text-xs transition-transform"
        >
          <Home className="w-4 h-4" />
          <span>Back to your team</span>
        </Link>
      </div>
    </div>
  );
}
