'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Who the viewer is, as far as the market table cares: which players are in
 * their squad, and which they are watching.
 *
 * /prices renders on the server from bootstrap alone and has no idea which
 * team the viewer follows — that only exists in localStorage — so both sets
 * are fetched here, after mount.
 */
export function useMarketContext(savedTeamId: string) {
  const [squadIds, setSquadIds] = useState<Set<number>>(new Set());
  const [watchIds, setWatchIds] = useState<Set<number>>(new Set());
  const [watchlistReady, setWatchlistReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!savedTeamId) {
      setSquadIds(new Set());
      setWatchIds(new Set());
      setWatchlistReady(false);
      return;
    }

    const ac = new AbortController();

    (async () => {
      try {
        const entryRes = await fetch(`/api/fpl/entry/${savedTeamId}`, { signal: ac.signal });
        const entry = entryRes.ok ? await entryRes.json() : null;
        const gw = entry?.current_event;

        const [picks, watch] = await Promise.all([
          gw
            ? fetch(`/api/fpl/picks/${savedTeamId}/${gw}`, { signal: ac.signal }).then((r) =>
                r.ok ? r.json() : null
              )
            : Promise.resolve(null),
          fetch(`/api/watchlist?teamId=${savedTeamId}`, { signal: ac.signal }).then((r) =>
            r.ok ? r.json() : null
          ),
        ]);

        // Every pick counts, bench included — they are still your players.
        setSquadIds(new Set<number>((picks?.picks ?? []).map((p: any) => Number(p.element))));
        setWatchIds(new Set<number>((watch?.elementIds ?? []).map(Number)));
        setWatchlistReady(Boolean(watch?.configured));
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn('Could not load market context:', err);
      }
    })();

    return () => ac.abort();
  }, [savedTeamId]);

  /** Optimistic toggle — the row recolours immediately, then reverts if the save fails. */
  const toggleWatch = useCallback(
    async (elementId: number) => {
      if (!savedTeamId) return;

      const next = new Set(watchIds);
      if (next.has(elementId)) next.delete(elementId);
      else next.add(elementId);

      const previous = watchIds;
      setWatchIds(next);
      setSaveError(null);

      try {
        const res = await fetch(`/api/watchlist?teamId=${savedTeamId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elementIds: [...next] }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Could not save the watchlist');
        }
      } catch (err: any) {
        setWatchIds(previous);
        setSaveError(err.message);
      }
    },
    [savedTeamId, watchIds]
  );

  return { squadIds, watchIds, watchlistReady, toggleWatch, saveError };
}
