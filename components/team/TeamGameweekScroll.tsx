'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';

interface TeamGameweekScrollProps {
  teamId: string | number;
  activeGw: number;
  currentGw: number;
}

export default function TeamGameweekScroll({
  teamId,
  activeGw,
  currentGw,
}: TeamGameweekScrollProps) {
  const activePillRef = useRef<HTMLAnchorElement>(null);

  // Auto scroll to active Gameweek pill on load
  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeGw]);

  return (
    <div className="pastel-card p-2.5 sm:p-3 shadow-sm flex items-center overflow-x-auto gap-2 scrollbar-none mb-4">
      {Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => {
        const isSelected = gw === activeGw;
        const isCurrent = gw === currentGw;
        const isFinished = gw < currentGw;

        return (
          <Link
            key={gw}
            ref={isSelected ? activePillRef : null}
            href={`/team/${teamId}?gw=${gw}`}
            className={`flex-shrink-0 min-w-[65px] text-center py-2 px-2 rounded-full text-xs transition active:scale-95 ${
              isSelected
                ? 'bg-pastel-orange text-[#111318] font-black shadow-md ring-2 ring-orange-400'
                : isFinished
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold'
                : isCurrent
                ? 'bg-purple-100 hover:bg-purple-200 text-[#38003c] font-black'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-400 font-medium'
            }`}
          >
            <span className="block text-[8px] uppercase opacity-75">
              {isCurrent ? 'Current' : isFinished ? 'Done' : 'Upcoming'}
            </span>
            <span className="text-xs font-black">GW {gw}</span>
          </Link>
        );
      })}
    </div>
  );
}
