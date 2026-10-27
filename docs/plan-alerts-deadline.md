# Plan — alerts only before the deadline (grill 2026-10-27)

Request: "เปลี่ยนการแจ้งเตือนไม่ต้องเตือนทุกวัน เป็นแค่ก่อน deadline" — stop the daily Telegram
messages; send only ahead of the gameweek deadline.

Status key: **OPEN** · **DECIDED** · **DONE**

## Today (before this change)

| Job | Schedule (Worker) | Sends when |
|---|---|---|
| `/api/cron/price-alert` | `0 14 * * *` = 21:00 Bangkok, every night | Almost always: any market price change since the last snapshot qualifies on its own (`changed.changes.length`) |
| `/api/cron/hourly` | `5 * * * *` | A tracked player's price moved, new injury news, or a status flag changed. Prices move nightly at 23:00Z (06:00 Bangkok), so this fires most mornings too |
| `/api/cron/market-snapshot` | `30 22 * * *` | Never messages — data only, stays as is |

## Decisions

**D1 · Scope — DECIDED: both jobs.** The 21:00 nightly message goes away, and the hourly watch
stops sending routine price moves. What remains is one summary ahead of each deadline; the
hourly job keeps only genuinely urgent squad events (details in later decisions).

**D2 · When — DECIDED: two messages per gameweek, 24h and 2h before the deadline.**
- **T−24h — full summary:** predicted risers/fallers for the last price change before the
  deadline (23:00Z), prices that already moved, injuries/flags, free transfers.
- **T−2h — short reminder:** set the line-up and captain, plus any injury news that appeared
  after the T−24h message.
- Deadlines move (00:30, 17:30, 19:30 Bangkok all happen), so a fixed cron cannot hit them.
  The hourly job (:05) decides: on the first run where the deadline is ≤ 24h (resp. ≤ 2h)
  away and that slot has not been sent for this GW, it sends — once per GW per slot, keyed
  in Firestore so a retry or a redeploy cannot double-send.

**D3 · Night-time sends — DECIDED: send on time, always.** No quiet hours and no shifting; a
deadline at 00:30 Bangkok means a T−24h message at ~00:05–00:30 the night before. The user can
mute Telegram themselves.

**D4 · Between deadlines — DECIDED: squad status drops only.** The hourly job messages
immediately only when a player **in the squad** (not the watchlist) changes status to
doubtful/injured/suspended/unavailable (`d`/`i`/`s`/`u`). Price moves, reworded news and
watchlist changes stop being sent hourly; they are reported in the T−24h summary instead.
The hourly watermark keeps updating every run so nothing is reported twice.

**D5 · Settings — DECIDED: fixed times, three switches.** The "deadline (36h)" switch and the
`deadlineHours` number go away. The Telegram settings modal gets three on/off switches:
**T−24h summary**, **T−2h reminder**, **instant squad status drop**. The existing content
switches (price moves, trends, injuries, watchlist, prices already changed) keep controlling
what goes into the T−24h summary. Times stay fixed at 24h and 2h — not user-editable.

**D6 · T−2h content — DECIDED: always sent, with a squad check.** Every GW, even when nothing
is wrong: deadline time (Bangkok), current captain / vice-captain, starters carrying a status
flag (suggest the bench swap), free transfers left (`lib/free-transfers.ts`), and injury news
that appeared after the T−24h message.

**D7 · Mechanics — DECIDED (from the code, no user input needed).**
- The Worker's `0 14 * * *` entry and its `JOBS` line are removed, then `wrangler deploy`
  from `worker/` (wrangler is logged in on this Mac). Push to `main` deploys the app; it does
  not deploy the Worker.
- `/api/cron/price-alert` stops being scheduled. Its message builder moves into a
  Firebase-free module (testable with `npm test`) that the hourly job calls for T−24h; the
  route itself is kept as a manual trigger for now.
- Sent slots are recorded per GW (`{event, slot: '24h'|'2h'}`) next to the hourly state, and
  written **before** the send, matching the hourly watermark's rule.
- Catch-up: if the T−24h slot was never sent (outage, or the feature deploys inside the
  window) and the deadline is already ≤ 2h away, send one combined message instead of two.
- Notifications log (`/notifications`) gets kinds for `deadline-24h`, `deadline-2h`,
  `status-drop`; old `alert` entries still render.
- Settings migration: stored `alerts.deadlineHours` is ignored; the three new switches
  default to on.

## Other open work found during the check (2026-10-27)
- Git clean, `npm test` passing, last commit 2026-10-07 (b5bebb4).
- **Q11 AI transfer advice — still PARKED** (options A/B/C in `plan-grill-2026-10.md`), and F9
  only if Claude is chosen. Nothing else open: UI rounds 2–3 are closed and `priceChanges/`
  retention (730 days) is in place.

_Interview complete — D1–D7 decided._

## Implementation (2026-10-27)
- `lib/deadline-alerts.ts` (pure, 8 tests in `tests/deadline-alerts.test.mjs`): `dueSlots`,
  `markSent`, `statusDrops` (severity a < d < i/s/u; improvements and new players ignored),
  `reminderFindings`.
- `lib/deadline-messages.ts`: `loadSquadContext` (entry, picks, free transfers), `buildSummary`
  (the old nightly body + deadline + free transfers), `buildReminder`. Captain and line-up are
  from the latest picks FPL shows — the coming GW's are private until its deadline.
- Slot state in `settings/deadlineAlerts`, separate from `settings/hourlyState` so the
  watermark's wholesale rewrite cannot erase it. A failed read skips the slot this hour.
- `/api/cron/price-alert` sends the summary on demand and does not mark the slot.
- Dry run against live FPL (team 2792350, GW9 deadline Sat 31 Oct 18:00 Bangkok): summary and
  reminder render as intended; the first scheduled summary is due ~Fri 30 Oct 18:05 Bangkok.
