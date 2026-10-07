# Health check + grill — 2026-10-07

Status key: **OPEN** · **DECIDED** · **DONE**

## State found

- `main` clean and in sync with `origin/main`; last commit 2026-09-02.
- `tsc --noEmit` clean; eslint 1 warning (`worker/src/index.ts`, anonymous default export).
- **No automated tests in the repo.** `plan-price-changes.md` cites 14 squad-value and 7
  `nextEliteCapture` assertions, but no test file was committed.

## Findings

| # | Finding | Status |
|---|---|---|
| F1 | `hourly`: `squadIds()` swallows an FPL failure as an empty set, then `writeHourlyState(next)` drops every squad player from the watermark. Next hour they are re-seeded, so a price move / injury in that window is never alerted. | DONE — live 75fcda1 (Vercel Production, 2026-10-07) |
| F2 | Stale comments: `price-alert/route.ts` says scheduled by `vercel.json` (it is the Cloudflare Worker); `hourly` mentions 06:00 Bangkok (alert is 21:00). `plan-ui-round-3.md` table still says OPEN. | DONE |
| F3 | Provisional elite capture was marked "untested until tonight" (GW2) and never recorded as verified. | Healthy — see Q4 |
| F5 | `/status` and `snapshotDateKey` still said the snapshot runs at 01:00 UTC; it moved to 22:30 UTC (Worker), 30 min before the 23:00 UTC price deadline. Copy only — the "stopped" alarm math still fires ~2.5h after a missed run. | DONE |
| F4 | ~1s click-to-table delay on menu navigation, cause unknown (Decision 23). | DONE — see Q6–Q9 |

## Decisions

**Q1 · Is production alive after 5 idle weeks?** User: Telegram alerts are still arriving
(2026-10-07). So the Worker → `price-alert` / `hourly` path works. Market snapshot and elite
capture are not confirmed by this — they send nothing — and stay under F3.

**Q2 · F1 fix — option A.** After a failed squad or watchlist lookup, players missing from the
run keep their previous watermark (`lib/hourly-watermark.ts` `nextWatermark`); a normal run
still replaces it wholesale. Rejected: skipping the write (re-alerts watchlist changes) and a
Telegram "lookup failed" message (noisy during FPL updates). First automated test in the repo:
`tests/hourly-watermark.test.mjs`, run by `npm test` (Node strips the types; no new deps).

**Q3 · Ship.** Confirmed: the Vercel project is wired to GitHub — a push to `main` builds and
deploys Production (commit status `Vercel: success`, deployment `Production`).

**Q4 · Did the silent jobs survive 5 idle weeks?** Yes, per `/status` and `/elite` on
2026-10-07: market snapshot 45 days, last 2026-10-06, no gap warning (2026-08-23 → 10-06 is
exactly 45 days); price changes 40 days from 2026-08-28 (also gapless); player stats 5/5
finalised GWs; elite cohort GW1–GW5, matching FPL (GW5 current and data-checked, GW6 deadline
not yet passed). The provisional path is not separately proven, but every finalised week
landed, which is what the data needs.

**Q5 · Next round — option A, commit the missing tests.** (User typed `d`: ก on the Thai
layout.) `nextEliteCapture` moved to Firebase-free `lib/elite-capture.ts` (re-exported from
`elite-cohort.ts`, so callers are unchanged); `squad-value.ts` imports its types with
`import type` so Node can load it. Tests: `elite-capture` 7, `squad-value` 14,
`hourly-watermark` 4 → `npm test` 25/25. `tsc`, eslint and `next build` clean.

**Q6 · F4, the ~1s menu delay — measured again, 2026-10-07, production, desktop Chrome,
logged in.** Instrumented with a MutationObserver + PerformanceObserver (no rAF polling, which
froze the harness in Round 5), then clicked the real menu links:

| Route | Click → content | What follows |
|---|---|---|
| /prices | table in **111 ms** | entry 115→324, then picks 325→438 and watchlist 325→**831** (waterfall) |
| /status | **16 ms** | — |
| /backup | instant shell | `/api/market/status` →482, `/api/fpl/entry` →**1045** |
| /analyst | instant shell | `/api/analyst/transfers` 1.0–**2.3 s**, `x-vercel-cache: MISS` every call |

So the navigation itself no longer waits — F4 as described does not reproduce. The second
the user feels is now **after** the page paints, in three client-visible waits:

- F4a `useMarketContext`: the watchlist fetch waits for `/api/fpl/entry` though it does not
  need the gameweek.
- F4b `/api/analyst/transfers`: picks, then entry, then `loadFeatureInputs` once per horizon
  gameweek, all sequential.
- F4c `/backup`'s entry call took ~1 s (cold function or FPL), not investigated.

Also noticed: the navbar menu button has no `aria-label` (F6).

**Q7 · Fix F4a + F4b — option A (reorder only, no cache).** Shipped 86bb936.
- F4a: `useMarketContext` starts the watchlist fetch alongside entry → picks.
- F4b: `/api/analyst/transfers` fetches latest picks, entry and every horizon gameweek's
  `loadFeatureInputs` in one `Promise.all` (all read-only).

Measured on production, 5 warm calls each, same browser:

| | before | after |
|---|---|---|
| `/api/analyst/transfers` | 1331, 1271, 975, 889, 1033 ms | (cold 2474), 988, 862, 855, 946 ms |
| response body sha-256 | `61313a7de2fd` | `61313a7de2fd` — identical |

**Honest result: F4b barely moved (~1.0 → ~0.9 s).** The sequential reads were not where
the time goes. Still unknown: `requireSession`, `fetchFPLBootstrap`,
`getAllMarketPriceAnalyses`, or `optimiseTransfers` CPU. Needs server-side timing to say.

**Q8 · Server-Timing — option A.** Shipped 8e3ff88: `/api/analyst/transfers` sends a
`Server-Timing` header per step (parallel steps timed on their own). Production, 6 calls,
body hash unchanged (`61313a7de2fd`), warm runs (one cold outlier at 1.47 s server):

| step | ms |
|---|---|
| bootstrap | 25–40 |
| picks / entry (parallel) | 25–50 |
| **inputs** (`loadFeatureInputs` × 3 GWs, parallel) | **495–555** |
| forecast (CPU, 3 GWs) | 120–155 |
| prices, optimise | 1–2 |
| total (server) | 665–745 |
| client round trip | 807–873 |

**The time is Firestore reads in `loadFeatureInputs`: ~70% of the server's time.** With a 3-GW
horizon it reads the same documents repeatedly — `fixtures`, `playerPriors` and the latest
`market/{date}` (the deadline filter resolves to the same newest doc for future GWs) three
times each, and the overlapping 6-GW `playerStats` windows ≈ 14 reads for ~6 distinct docs.
About 26 document reads where ~10 are distinct, several of them large (market ≈ 616 players).

**Q9 · Read each document once per request — option A.** Shipped 4ad1f8b.
`loadFeatureInputs` takes an optional `memo` (`ReadMemo`, a `Map` created per request — never
kept across requests, so nothing goes stale). Snapshots are shared, `.data()` is not, so one
gameweek's inputs cannot mutate another's. The market query is keyed by
`min(deadline day, tomorrow)`: no snapshot is dated in the future, so every upcoming GW
resolves to the same read. Only `/api/analyst/transfers` passes a memo; other callers are
unchanged. Rejected: a cross-request cache of data-checked `playerStats` (option B) — Vercel
instances recycle, so the gain would be uneven.

Production, 5 warm calls (+1 cold), body hash still `61313a7de2fd`:

| | before (8e3ff88) | after (4ad1f8b) |
|---|---|---|
| inputs | 495–555 ms | **220–262 ms** |
| server total | 665–745 ms | **372–472 ms** |
| client round trip | 807–873 ms | **487–585 ms** |

**F4 closed.** Menu navigation was already instant; the slowest post-paint wait (analyst
suggestions) is down ~40%. Remaining cost is `forecast` CPU (~120–190 ms) — not pursued.

**Q10 · Close the leftovers — option A.** Checked on production, logged in, 2026-10-07:

- Round 3 #2: icons use `animate-blink` (opacity), no transform clash — done.
- Round 3 #3: `/team/2792350` shows two buttons (GW 6 / GW 7), no arrows; on `/`, picking the
  unplayed GW 6 shows "Squad Lineup (Gameweek 6)" with every points tile "—" — done.
- Round 3 #4: mode B cells read `HUL / A`, `CHE / H` …; win/loss/draw tint is in
  `PlayerCard.tsx` (draw neutral) — done. D5 (16px inputs on iOS) — done.
- `plan-ui-round-3.md` table updated; F2 closed.
- **F7 (new, fixed 826e18c):** the green "rising tonight" badge in `TeamPitchTopBar` used
  `animate-pulse-fall`, so it pulsed with the red ring. Now `animate-pulse-rise`. No squad
  player was rising tonight, so the fix is verified in code, not on screen.
- **F6 fixed 826e18c:** menu button has `aria-label` (Open/Close menu) and `aria-expanded`;
  confirmed on production.

## Round closed — 2026-10-07

Everything found is DONE. Not pursued, deliberately: `forecast` CPU (~150 ms) in transfer
suggestions; a cross-request cache of data-checked `playerStats`.
