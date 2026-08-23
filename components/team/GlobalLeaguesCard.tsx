import React from 'react';
import { Globe2, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface GlobalLeaguesCardProps {
  leagues: any[];
}

/**
 * FPL enrols every manager into system leagues — Overall, their country, their
 * club, a gameweek league, sponsor leagues. They run to millions of entries,
 * so the member table is meaningless here: FPL only serves pages of 50 from
 * the top, and there is no "standings near me" query, so finding yourself
 * would take thousands of requests.
 *
 * The one useful fact is your own position, and the entry payload already
 * carries it as `entry_rank`. So this card reports that and nothing else, and
 * never expands.
 */
export default function GlobalLeaguesCard({ leagues }: GlobalLeaguesCardProps) {
  const systemLeagues = leagues.filter((l) => l.league_type === 's');
  if (systemLeagues.length === 0) return null;

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#111318]">Global &amp; Club Leagues</h3>
            <p className="text-xs text-gray-500">Your position in the leagues FPL enrols you into</p>
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400 font-mono shrink-0">
          {systemLeagues.length} leagues
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {systemLeagues.map((league: any) => {
          const rank = Number(league.entry_rank) || 0;
          const lastRank = Number(league.entry_last_rank) || rank;
          const movement = lastRank - rank;

          return (
            <div
              key={league.id}
              className="p-3.5 rounded-2xl bg-gray-50/80 border border-black/5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="font-bold text-xs text-[#111318] block truncate">
                  {league.name}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">ID: {league.id}</span>
              </div>

              <div className="text-right shrink-0">
                <span className="text-sm font-black text-[#38003c] block">
                  {rank ? `#${rank.toLocaleString()}` : '—'}
                </span>
                <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
                  {movement > 0 ? (
                    <span className="text-emerald-600 flex items-center font-black">
                      <ArrowUp className="w-2.5 h-2.5 stroke-[3]" /> {movement.toLocaleString()}
                    </span>
                  ) : movement < 0 ? (
                    <span className="text-rose-600 flex items-center font-black">
                      <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />{' '}
                      {Math.abs(movement).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center">
                      <Minus className="w-2.5 h-2.5" /> Same
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
