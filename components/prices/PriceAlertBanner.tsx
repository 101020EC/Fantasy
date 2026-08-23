'use client';

import React from 'react';
import { PriceAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PriceAlertBannerProps {
  risers: PriceAnalysis[];
  fallers: PriceAnalysis[];
}

export default function PriceAlertBanner({ risers, fallers }: PriceAlertBannerProps) {
  if (risers.length === 0 && fallers.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-2 mb-4">
      {/* Fallers Alert */}
      {fallers.length > 0 && (
        <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-2xl shrink-0 mt-0.5 shadow-md">
              <TrendingDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-900">
                Squad Warning: {fallers.length} player{fallers.length > 1 ? 's' : ''} at risk of falling tonight!
              </h4>
              <p className="text-xs text-rose-700 mt-0.5 font-medium">
                {fallers.map((f) => f.webName).join(', ')}
              </p>
            </div>
          </div>
          <Link
            href="/prices"
            className="self-start sm:self-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-full transition shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <span>View Market</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Risers Alert */}
      {risers.length > 0 && (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500 text-white rounded-2xl shrink-0 mt-0.5 shadow-md">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-emerald-900">
                Squad Alert: {risers.length} player{risers.length > 1 ? 's' : ''} expected to rise tonight!
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                {risers.map((r) => r.webName).join(', ')}
              </p>
            </div>
          </div>
          <Link
            href="/prices"
            className="self-start sm:self-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-full transition shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <span>View Market</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
