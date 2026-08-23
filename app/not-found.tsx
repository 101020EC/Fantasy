import Link from 'next/link';
import { Search, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="p-8 rounded-4xl bg-white border border-black/5 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-purple-100 text-[#38003c] flex items-center justify-center mx-auto mb-4">
          <Search className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-[#111318] mb-2">Page not found</h2>
        <p className="text-xs text-gray-500 mb-6">That page does not exist, or the Team ID was not a number.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#38003c] text-white font-black text-xs hover:scale-105 transition-transform shadow-md"
        >
          <Home className="w-4 h-4" />
          <span>Back to your team</span>
        </Link>
      </div>
    </div>
  );
}
