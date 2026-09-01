'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FPLElementType, FPLTeam } from '@/lib/types';
import { fromMarketCells, type MarketCell } from '@/lib/market-row';
import { ArrowDown, ArrowUp, Leaf, Rocket, Search, Star, AlertCircle } from 'lucide-react';
import { PriceChangeDay } from '@/lib/price-changes';
import { statusFromLikelihood } from '@/lib/price-calculator';
import PriceChanges from './PriceChanges';
import PlayerJersey from '../pitch/PlayerJersey';
import { STATUS_META, StatusPill } from './status-meta';
import AvailabilityChip from './AvailabilityChip';
import { useAuth } from '../AuthContext';
import { useMarketContext } from './useMarketContext';

const POSITION_IDS: Record<string, number> = { gkp: 1, def: 2, mid: 3, fwd: 4 };

/** Rows rendered before "Show more". */
const PAGE = 25;

// Laid out as two columns so each chip sits under the summary card it narrows:
// Trending Up below Rising Tonight, Trending Down below Falling Tonight.
const STATUS_FILTERS = [
  { key: 'critical_risers', status: 'rising_soon', active: 'bg-emerald-600 text-white' },
  { key: 'critical_fallers', status: 'falling_soon', active: 'bg-rose-600 text-white' },
  { key: 'risers', status: 'likely_riser', active: 'bg-emerald-100 text-emerald-800' },
  { key: 'fallers', status: 'likely_faller', active: 'bg-rose-100 text-rose-800' },
] as const;

const POSITION_FILTERS = [
  { key: 'gkp', label: 'GK' },
  { key: 'def', label: 'DEF' },
  { key: 'mid', label: 'MID' },
  { key: 'fwd', label: 'FWD' },
  { key: 'all', label: 'All' },
];

/** Column tooltips for the three projected deadlines. */
const FORECAST_DAYS = ['Tonight', 'Tomorrow', 'The night after'];

const SORT_CHIPS = [
  { field: 'changeScore', label: 'Target' },
  { field: 'currentCost', label: 'Price' },
  { field: 'selectedByPercent', label: 'Owned' },
  { field: 'netTransfers', label: 'Net' },
] as const;

/**
 * A market row with the club and position replaced by ids.
 *
 * `PriceAnalysis` embeds the whole FPLTeam and FPLElementType object, and this
 * is a client component, so all 616 copies crossed the server/client boundary:
 * 218KB of twenty clubs and 176KB of four positions, 61% of the page. The
 * lookups travel once instead.
 */
interface PriceMarketTableProps {
  analyses: MarketCell[][];
  /** Twenty clubs, sent once. */
  teams: FPLTeam[];
  /** Four positions, sent once. */
  types: FPLElementType[];
  /** Newest first. Empty until a second snapshot exists to diff against. */
  changeDays?: PriceChangeDay[];
  /** Whether each direction's threshold rests on observed changes yet. */
  /** Rendered on the right of the tab row — the page's update-window card. */
  aside?: React.ReactNode;
}

export default function PriceMarketTable({
  analyses,
  teams,
  types,
  changeDays = [],
  aside,
}: PriceMarketTableProps) {
  // Rehydrated once, from the positional arrays the server sends. Object keys
  // repeated 616 times were the single largest thing on this page; decoding
  // them here keeps the rest of this component written against named fields.
  const rows = useMemo(() => analyses.map(fromMarketCells), [analyses]);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const [tab, setTab] = useState<'table' | 'past'>('table');
  const [search, setSearch] = useState('');
  // Status and position are separate so they combine; one shared value meant
  // picking a position silently cleared the status filter.
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<
    'netTransfers' | 'changeScore' | 'currentCost' | 'selectedByPercent'
  >('netTransfers');
  const [sortAsc, setSortAsc] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const [watchOnly, setWatchOnly] = useState(false);

  const { savedTeamId } = useAuth();
  const { squadIds, watchIds, watchlistReady, toggleWatch, saveError } =
    useMarketContext(savedTeamId);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows
      .filter((p) => {
        if (q) {
          const matchSearch =
            p.webName.toLowerCase().includes(q) ||
            p.fullName.toLowerCase().includes(q) ||
            (teamById.get(p.teamId)?.name ?? '').toLowerCase().includes(q) ||
            (teamById.get(p.teamId)?.short_name ?? '').toLowerCase().includes(q);
          if (!matchSearch) return false;
        }

        if (statusFilter === 'risers' && !['rising_soon', 'likely_riser'].includes(p.status))
          return false;
        if (statusFilter === 'critical_risers' && p.status !== 'rising_soon') return false;
        if (statusFilter === 'fallers' && !['falling_soon', 'likely_faller'].includes(p.status))
          return false;
        if (statusFilter === 'critical_fallers' && p.status !== 'falling_soon') return false;

        if (positionFilter !== 'all' && p.typeId !== POSITION_IDS[positionFilter])
          return false;

        if (watchOnly && !watchIds.has(p.elementId)) return false;

        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
  }, [rows, search, statusFilter, positionFilter, sortField, sortAsc, watchOnly, watchIds, teamById]);

  // 25, not 100. The rendered rows were 160KB of the page's 351KB at ~1.6KB
  // each, and the table is already sorted by how close each player is to
  // moving — the names that matter are at the top. The rest is one click away
  // and costs no request, since every row is already in the browser.
  const [limit, setLimit] = useState(PAGE);
  // A new sort or filter puts different players at the top, so an expanded list
  // from the previous one is not the answer to the new question.
  useEffect(() => {
    setLimit(PAGE);
  }, [search, statusFilter, positionFilter, sortField, sortAsc, watchOnly, tab]);

  const visibleRows = filteredData.slice(0, limit);

  const { criticalRisersCount, criticalFallersCount } = useMemo(
    () => ({
      criticalRisersCount: rows.filter((a) => a.status === 'rising_soon').length,
      criticalFallersCount: rows.filter((a) => a.status === 'falling_soon').length,
    }),
    [rows]
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  /**
   * Sorting lives in its own chip row rather than in the table headers.
   *
   * The four-column layout folds price into the player cell and ownership
   * together with net transfers, so three of the four sortable headers no
   * longer have a column of their own. Chips keep every sort reachable without
   * spending table width, and match the filter chips already on this page.
   */
  const sortChips = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">
        Sort
      </span>
      {SORT_CHIPS.map((chip) => {
        const isOn = sortField === chip.field;
        return (
          <button
            key={chip.field}
            type="button"
            onClick={() => handleSort(chip.field)}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1 ${
              isOn
                ? 'bg-[#38003c] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{chip.label}</span>
            {isOn &&
              (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full">
      {/* Two tenses, kept apart. Everything under "Table" is a prediction about
          tonight; everything under "Past" is a record of what already
          happened. Mixing them would make a player who has risen look like one
          about to. */}
      <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-1 p-1 rounded-full bg-gray-100 w-fit">
        {([
          ['table', 'Table'],
          ['past', 'Past'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-5 py-1.5 rounded-full text-xs font-black transition ${
              tab === key ? 'bg-white text-[#38003c] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {key === 'past' && changeDays.length > 0 && (
              <span className="ml-1.5 text-[10px] text-gray-400">{changeDays.length}</span>
            )}
          </button>
        ))}
      </div>
        {aside}
      </div>

      {tab === 'past' ? (
        <PriceChanges days={changeDays} analyses={rows} teams={teams} types={types} />
      ) : (
      <>
      {/* Summary cards — each is also the filter for its own status */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3">
        <button
          onClick={() =>
            setStatusFilter(statusFilter === 'critical_risers' ? 'all' : 'critical_risers')
          }
          className={`p-4 sm:p-5 rounded-3xl text-left transition transform hover:scale-[1.01] active:scale-95 shadow-md flex items-center justify-between ${
            statusFilter === 'critical_risers'
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-300'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-100">
              <Rocket className="w-4 h-4" />
              <span>Rising Tonight</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black mt-1">
              {criticalRisersCount} <span className="text-sm font-normal opacity-90">players</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 animate-blink" />
          </div>
        </button>

        <button
          onClick={() =>
            setStatusFilter(statusFilter === 'critical_fallers' ? 'all' : 'critical_fallers')
          }
          className={`p-4 sm:p-5 rounded-3xl text-left transition transform hover:scale-[1.01] active:scale-95 shadow-md flex items-center justify-between ${
            statusFilter === 'critical_fallers'
              ? 'bg-rose-700 text-white ring-4 ring-rose-300'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-100">
              <Leaf className="w-4 h-4 rotate-[135deg]" />
              <span>Falling Tonight</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black mt-1">
              {criticalFallersCount} <span className="text-sm font-normal opacity-90">players</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Leaf className="w-5 h-5 rotate-[135deg] animate-blink" />
          </div>
        </button>
      </div>

      {/* Same grid and gap as the summary cards above, and outside the padded
          controls card — otherwise the card's own padding shifts the column
          split and the chips no longer sit under the card they narrow. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        {STATUS_FILTERS.map((tab) => {
          const meta = STATUS_META[tab.status];
          const isOn = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(isOn ? 'all' : tab.key)}
              className={`px-3 py-2 rounded-full text-xs font-bold transition truncate flex items-center justify-center gap-1.5 ${
                isOn
                  ? `${tab.active} shadow-sm ring-1 ring-black/10`
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-black/5 shadow-sm'
              }`}
            >
              {/* Selected chips invert to a solid fill, so the icon takes the
                  chip's own colour rather than its usual green or red. */}
              <meta.Icon
                className={`w-3.5 h-3.5 shrink-0 ${isOn ? '' : meta.iconClass}`}
              />
              <span className="truncate">{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search and position controls */}
      <div className="pastel-card p-4 sm:p-5 shadow-sm mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player name or club..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-full text-base sm:text-xs text-[#111318] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition shadow-inner"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          </div>

          <button
            type="button"
            onClick={() => setWatchMode((v) => !v)}
            disabled={!savedTeamId}
            title={
              savedTeamId
                ? 'Add or remove players from your watchlist'
                : 'Pick a team first to use the watchlist'
            }
            className={`shrink-0 px-3.5 py-2.5 rounded-full text-xs font-black transition flex items-center gap-1.5 disabled:opacity-40 ${
              watchMode
                ? 'bg-pink-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-600'
            }`}
          >
            <Star className={`w-4 h-4 ${watchMode ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">Watchlist</span>
            {watchIds.size > 0 && (
              <span
                className={`px-1.5 rounded-full text-[10px] ${
                  watchMode ? 'bg-white/25' : 'bg-pink-100 text-pink-700'
                }`}
              >
                {watchIds.size}
              </span>
            )}
          </button>
        </div>

        {watchMode && !watchlistReady && savedTeamId && (
          <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              The watchlist needs Firebase configured on the server, otherwise it cannot be saved or
              used for Telegram alerts.
            </span>
          </div>
        )}

        {saveError && (
          <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="pt-2 border-t border-black/5">{sortChips}</div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/5">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">
            Position
          </span>
          {watchIds.size > 0 && (
            <button
              type="button"
              onClick={() => setWatchOnly((v) => !v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1 mr-1 ${
                watchOnly
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
              }`}
            >
              <Star className={`w-3 h-3 ${watchOnly ? 'fill-current' : ''}`} />
              <span>Watchlist only</span>
            </button>
          )}
          {POSITION_FILTERS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPositionFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition ${
                positionFilter === tab.key
                  ? 'bg-[#38003c] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pastel-card overflow-hidden shadow-sm">
        <div>
          <table className="w-full text-left text-sm text-gray-700 table-fixed">
            <thead className="text-[10px] uppercase text-gray-400 border-b border-black/5 font-black tracking-wide">
              <tr>
                {/* Target leads: this is a price radar, so the prediction is
                    the column you scan first. Four columns, not seven — position,
                    price and club now sit under the player's name, which is what
                    lets the whole table fit a phone without scrolling sideways. */}
                <th className="px-2 py-3 text-center w-16">Target</th>
                <th className="px-2 py-3 text-left">Player</th>
                <th className="px-2 py-3 text-center w-24">Owned</th>
                {/* Wider than Owned: the full "Falling Tonight" pill is ~120px
                    and the card clips anything past the column, so a 96px
                    column silently cut the label in half. The mobile label is
                    one word, so the narrow width is only used where it fits. */}
                <th className="px-2 py-3 text-center w-24 sm:w-36">Status</th>
                {/* FPL projects three deadlines ahead, so the table shows all
                    three. Hidden below sm: on a phone the row already carries
                    Target and Status, and a fourth numeric column pushes the
                    player's name into two lines. */}
                <th className="px-2 py-3 text-center w-28 hidden sm:table-cell">Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {visibleRows.map((player) => {
                const inSquad = squadIds.has(player.elementId);
                const watched = watchIds.has(player.elementId);
                const club = teamById.get(player.teamId);
                const type = typeById.get(player.typeId);
                const tonight =
                  player.status === 'rising_soon' || player.status === 'falling_soon'
                    ? STATUS_META[player.status]
                    : null;

                // Squad wins the row colour when a player is both — being in
                // the team is the stronger fact; the star still marks the
                // watchlist membership.
                const rowTint = inSquad
                  ? 'bg-sky-50 hover:bg-sky-100'
                  : watched
                  ? 'bg-pink-50 hover:bg-pink-100'
                  : 'hover:bg-purple-50/40';

                return (
                  <tr
                    key={player.elementId}
                    className={`transition group ${rowTint}`}
                  >
                    {/* Target — percent of FPL's threshold. 100 means a change
                        is expected tonight, so the bar fills at 100 and the
                        number is allowed to run past it. */}
                    <td className="px-2 py-2.5">
                      <div className="w-14 mx-auto">
                        <div className="flex items-center justify-center gap-1 mb-1 text-[10px] font-bold">
                          {/* Only the two "tonight" states are marked — a pulse
                              on every row would stop meaning anything. */}
                          {tonight && (
                            <tonight.Icon
                              className={`w-3 h-3 shrink-0 ${tonight.iconClass}`}
                              aria-label={tonight.label}
                            />
                          )}
                          <span
                            className={
                              player.changeScore > 0
                                ? 'text-emerald-600'
                                : player.changeScore < 0
                                ? 'text-rose-600'
                                : 'text-gray-400'
                            }
                          >
                            {player.changeScore > 0 ? `+${player.changeScore}` : player.changeScore}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              player.changeScore >= 100
                                ? 'bg-emerald-500'
                                : player.changeScore > 0
                                ? 'bg-emerald-400'
                                : player.changeScore <= -100
                                ? 'bg-rose-500'
                                : player.changeScore < 0
                                ? 'bg-rose-400'
                                : 'bg-gray-300'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(8, Math.abs(player.changeScore)))}%`,
                              marginLeft: player.changeScore < 0 ? 'auto' : '0',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-2 py-2.5">
                      <div className="flex items-start gap-2">
                        <PlayerJersey
                          teamCode={club?.code ?? 0}
                          isGkp={player.typeId === 1}
                          className="w-7 h-7 shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <div className="font-bold text-[13px] text-[#111318] group-hover:text-purple-700 transition truncate">
                              {player.webName}
                            </div>
                            {/* No "MY TEAM" chip: the row already carries a
                                blue tint for it, and a badge on the narrowest
                                column was spending width to repeat that. */}
                            {watched && (
                              <Star className="w-3 h-3 text-pink-500 fill-current shrink-0" />
                            )}
                            {watchMode && (
                              <button
                                type="button"
                                onClick={() => toggleWatch(player.elementId)}
                                aria-label={
                                  watched
                                    ? `Remove ${player.webName} from watchlist`
                                    : `Add ${player.webName} to watchlist`
                                }
                                className={`ml-0.5 p-1 rounded-full transition shrink-0 ${
                                  watched
                                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                                    : 'bg-gray-100 text-gray-400 hover:bg-pink-100 hover:text-pink-600'
                                }`}
                              >
                                <Star className={`w-3 h-3 ${watched ? 'fill-current' : ''}`} />
                              </button>
                            )}
                          </div>
                          {/* Position, price and club on one line under the
                              name — the club as its short code, since the full
                              name is what pushed this column wide. */}
                          <div className="text-[10px] text-gray-500 font-semibold truncate">
                            {type?.singular_name_short ?? ''}{' '}
                            <span className="font-mono text-[#111318] font-bold">
                              £{player.currentCost.toFixed(1)}
                            </span>{' '}
                            {club?.short_name ?? ''}
                          </div>
                          <AvailabilityChip
                            chance={player.chanceOfPlaying}
                            news={player.news}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Ownership above, net transfers below. Net is measured
                        since this player's last price change, not since the
                        gameweek started — that is the number FPL counts. */}
                    <td className="px-2 py-2.5 text-center font-mono">
                      <div className="text-[12px] font-bold text-gray-700">
                        {player.selectedByPercent}%
                      </div>
                      <div className="text-[11px] font-bold">
                        {player.netTransfers > 0 ? (
                          <span className="text-emerald-600">
                            +{player.netTransfers.toLocaleString()}
                          </span>
                        ) : player.netTransfers < 0 ? (
                          <span className="text-rose-600">
                            {player.netTransfers.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-2.5 text-center">
                      <StatusPill status={player.status} />
                    </td>

                    {/* Tonight, tomorrow, the night after. The colour comes from
                        FPL's own likelihood band rather than from the percentage,
                        so this column and the Status pill can never disagree. */}
                    <td className="px-2 py-2.5 hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1 font-mono text-[11px] font-bold">
                        {[0, 1, 2].map((i) => {
                          const percent = player[`proj${i}` as 'proj0'];
                          const likelihood = player[`lk${i}` as 'lk0'];
                          if (percent == null) {
                            return (
                              <span key={i} className="w-9 text-center text-gray-300">
                                –
                              </span>
                            );
                          }
                          const st = statusFromLikelihood(Number(likelihood ?? 0));
                          const tone =
                            st === 'rising_soon'
                              ? 'bg-emerald-100 text-emerald-700'
                              : st === 'likely_riser'
                              ? 'bg-emerald-50 text-emerald-600'
                              : st === 'falling_soon'
                              ? 'bg-rose-100 text-rose-700'
                              : st === 'likely_faller'
                              ? 'bg-rose-50 text-rose-600'
                              : 'text-gray-400';
                          return (
                            <span
                              key={i}
                              className={`w-9 text-center rounded py-0.5 ${tone}`}
                              title={FORECAST_DAYS[i]}
                            >
                              {percent > 0 ? `+${percent}` : percent}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visibleRows.length < filteredData.length && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE * 3)}
            className="w-full py-3 text-xs font-black text-[#38003c] hover:bg-purple-50 transition border-t border-black/5"
          >
            Show more · {visibleRows.length} of {filteredData.length}
          </button>
        )}

        {filteredData.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-gray-500 mb-1">No players match these filters</p>
            <p className="text-xs text-gray-400">
              Try a different name, or clear the status and position filters.
            </p>
          </div>
        )}

        {/* FPL never publishes the threshold, and the two directions do not
            share one. Rises are measured against the whole manager base —
            anyone can buy — and match the reference closely. Falls are measured
            against a player's own owners, and are genuinely noisier: two players
            at the same ownership can imply very different thresholds. Saying so
            is the difference between a number and a number that misleads. */}
        <div className="px-3 pt-2.5 text-center text-[10px] text-gray-400 leading-snug space-y-0.5">
          <p>
            Target is how far along a price change is right now; 100% means it lands at the next
            deadline. Forecast is where FPL expects the player to be at each of the next three
            deadlines — tonight, tomorrow, the night after.
          </p>
          <p className="text-gray-300">
            Both numbers come from FPL itself, not from an estimate made here.
          </p>
        </div>

        <div className="p-3 text-center text-xs text-gray-400 border-t border-black/5 bg-gray-50/50 mt-2">
          {filteredData.length === 0
            ? 'No matching players'
            : filteredData.length > visibleRows.length
            ? `Showing the top ${visibleRows.length} of ${filteredData.length.toLocaleString()} matching players`
            : `Showing all ${filteredData.length} matching ${
                filteredData.length === 1 ? 'player' : 'players'
              }`}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
