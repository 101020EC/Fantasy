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
| F2 | Stale comments: `price-alert/route.ts` says scheduled by `vercel.json` (it is the Cloudflare Worker); `hourly` mentions 06:00 Bangkok (alert is 21:00). `plan-ui-round-3.md` table still says OPEN. | Comments DONE; round-3 table OPEN |
| F3 | Provisional elite capture was marked "untested until tonight" (GW2) and never recorded as verified. | Healthy — see Q4 |
| F5 | `/status` and `snapshotDateKey` still said the snapshot runs at 01:00 UTC; it moved to 22:30 UTC (Worker), 30 min before the 23:00 UTC price deadline. Copy only — the "stopped" alarm math still fires ~2.5h after a missed run. | DONE |
| F4 | ~1s click-to-table delay on menu navigation, cause unknown (Decision 23). | OPEN |

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
