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
| F1 | `hourly`: `squadIds()` swallows an FPL failure as an empty set, then `writeHourlyState(next)` drops every squad player from the watermark. Next hour they are re-seeded, so a price move / injury in that window is never alerted. | DONE (local, not deployed) |
| F2 | Stale comments: `price-alert/route.ts` says scheduled by `vercel.json` (it is the Cloudflare Worker); `hourly` mentions 06:00 Bangkok (alert is 21:00). `plan-ui-round-3.md` table still says OPEN. | Comments DONE; round-3 table OPEN |
| F3 | Provisional elite capture was marked "untested until tonight" (GW2) and never recorded as verified. | OPEN |
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
