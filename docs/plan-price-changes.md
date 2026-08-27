# Price Changes + Market UI — design decisions

Grill session, 2026-08-27. Working doc. NO CODE CHANGES YET.

## Fixed context (verified, not assumptions)

Cron schedule is UTC; times below are **Bangkok**.

| Bangkok | UTC | Event |
|---|---|---|
| 06:00 | 23:00 | Telegram alert (`/api/cron/price-alert`) |
| 08:00 | 01:00 | Market snapshot (`/api/cron/market-snapshot`) |
| 08:30-09:30 | 01:30-02:30 | FPL price change window |

- Snapshot lands 30 min BEFORE the window by design: it is the last state before
  prices move (lib/market-snapshot.ts:11). Keep it there.
- Alert lands 2.5h BEFORE that day's window - correct for "act before it rises".
  Keep it there.
- Consequence: `market/D` and `market/D+1` bracket the change of day D's window.
  A doc named `priceChanges/{D+1}` therefore describes the change that happened
  on day **D**. Store `changedOn` explicitly; never infer the date from the id.
- Consequence: at alert time the newest stored diff is ~45h old. The alert must
  diff **live bootstrap `now_cost` vs the newest stored snapshot** instead of
  reading a precomputed doc. Stored diffs serve the Past tab and history only.

## Decision 1 - Target %  (ACCEPTED)

**Fix the reset bug and rescale to 0-100%.**

Bug: `analyzePlayerPrice` uses `transfers_in_event - transfers_out_event`, which
resets only at gameweek rollover. FPL resets a player's counter at **every price
change**, so once a player has risen, the transfers that caused the rise keep
counting and the score stays pinned high for the rest of the gameweek.

Fix: find the snapshot at which `cost_change_event` last moved for that player;
its `transfers_in_event`/`transfers_out_event` become the baseline. Count only
transfers after it. A player with no change this GW keeps baseline 0 (the field
already resets at rollover).

Also: drop the +/-100 clamp so a value can exceed 100%, and treat **100% = changes
tonight** rather than the current 75.

Not adopted: hourly snapshots (Vercel Hobby has 2 cron slots, both taken; market/
would grow 41KB -> ~164KB/day). Per-hour rate and tonight/tomorrow/>2-days
buckets are therefore out of scope for now.

## Open questions
2. Threshold: keep the fixed formula, or learn it from observed changes?

## Decision 2 - Threshold  (ACCEPTED)

**Learn it from observed changes; fall back to the current formula when data is
thin.**

Every real price change is a free labelled sample: `netSinceChange` at the moment
it crossed IS that player's threshold at that ownership. Accumulate into
`priceThresholds/{season}` (per ownership band), and follow the shape
lib/calibration.ts already uses in this repo:

- shrink toward the existing `max(25000, ownership*12000)` formula while the
  sample is small, so a handful of changes cannot swing the whole table
- carry `notes[]` and `sourceDays[]` on the document, and surface in the UI when
  the value is still the fallback rather than fitted - never render an unfitted
  number as if it were measured
- clamp the fitted value to a sane band so one weird change cannot distort it

Blocked on data: needs >= 2 stored snapshots before a single change is observable.

## Decision 3 - Past tab history depth  (ACCEPTED)

**Only what the stored snapshots actually support, with the start date stated in
the UI.** No element-summary backfill.

- Past renders one section per day that has a computable diff.
- Header carries the honest boundary, e.g. "History from 24 Aug".
- Empty is a legitimate state, not an error: with one snapshot no diff exists.
- Rejected: backfilling `value` from element-summary. It is per-fixture, so it
  yields GW-granularity ("rose between GW1 and GW2"), not the per-day view the
  spec asks for; mixing the two granularities in one table would mislead. The
  season is only a few days old, so this costs almost nothing today and the gap
  closes on its own.

Action item (needs the user, not code): run /api/market/status on PROD and report
dayCount / firstDate / missingDates. Everything downstream assumes the snapshot
cron is healthy there; dev has exactly 1 market doc.

## Decision 4 - Market table layout  (ACCEPTED)

Four columns: **Target | Player | Owned | Status**, down from seven.

- Player cell: shirt + name, with `MID  GBP6.5  ARS` on a second line (club as
  short_name, not full name as today). Smaller type throughout.
- Owned cell: `31.2%` on line 1, `+124,050` net transfers on line 2.
- Sorting moves to a **chip row above the table** (Target | Price | Owned | Net),
  matching the filter chip row that already exists on this page. Tapping the
  active chip flips direction. All four sorts survive; the table loses no width.
- Status pill collapses on mobile to icon + one word (Tonight / Up / Down) and
  expands to the full label at `sm:`. "Rising Tonight" at full width is what
  breaks "fit the screen".
- Target cell keeps its progress bar, now on the 0-100% scale from Decision 1.

Reference: the livefpl Prices table, but with Target first rather than Player -
this page is a price radar, so the prediction is what you scan first.

Note (found while exploring, item 5): the home page labels a gameweek "Current"
when `gw === maxAvailableGw`, and `maxAvailableGw = entry.current_event`
(app/page.tsx:170, :310). FPL keeps `current_event` at the last gameweek that has
points, so it stays 1 until the GW2 deadline. Open question 6.

## Decision 5 - Telegram alert  (ACCEPTED)

Add a "prices changed" section to the existing 06:00 Bangkok message. Do NOT add
a second cron or a second message.

- **Scope: squad + watchlist by name**, plus **one summary line** for the whole
  market ("12 rises, 8 falls today - see Past"). Named entries are the ones that
  actually moved your team value; the market total prevents the message from
  looking like nothing happened while hiding 40 changes.
- Source: diff **live bootstrap `now_cost`** against the newest stored
  `market/{date}`. Never a precomputed doc - see the 45h staleness trap above.
- New `AlertToggles.priceChanged: boolean = true`. `getTelegramConfig` already
  spreads `{...DEFAULT_ALERTS, ...d.alerts}`, so existing Firestore settings pick
  the default up with no migration.
- Cap the named list (~15 lines + "and N more"); Telegram rejects >4096 chars and
  a rejection today leaves no trace anywhere.

**No second snapshot at 06:00.** Rejected because `market/{YYYY-MM-DD}` is keyed
by date, so a second daily write overwrites the first. Re-keying by timestamp
would break /api/market/status, /api/market/player and `loadMarketBefore()` in
lib/forecast-inputs.ts, which feeds every forecast - a rewrite of existing
architecture, which is out of bounds. The payoff was small anyway: 06:00 and
08:00 Bangkok are both BEFORE the change window and both fall in the quietest
transfer hours in the UK, so the implied per-hour rate would not represent the
day. If per-hour is wanted later, add a separate slim `priceTicks/` collection
rather than touching `market/`.

## Decision 6 - "Current" gameweek label  (ACCEPTED)

Once GW1 is finished but the GW2 deadline has not passed: **GW1 = Done,
GW2 = Current.** "Current" means the gameweek being played or about to be -
`is_next` when `is_current` is already finished. This matches the official site,
which shows "Gameweek 2" as soon as GW1 ends.

Implementation note (no question needed): `app/page.tsx:170` uses one variable for
two jobs - the "Current" label AND the ceiling on which gameweeks are selectable.
Split it:

- `latestScoredGw = entry.current_event`  -> data ceiling; stats cards read this
- `activeGw = is_next ?? is_current`      -> the "Current" label only

Changing the single variable naively would let the user select GW2, and
`currentGwStats` (app/page.tsx:169) looks it up in `history.current[]`, which has
no event 2 yet - the stats cards would render empty.

## Decision 7 - Team page price badge  (ACCEPTED)

**Tonight first, trending as fallback. Two badges, split by direction.**

Bug found while exploring: TeamPitchTopBar.tsx:129 renders the badge as
`bg-rose-600` with a `TrendingDown` icon *regardless of direction*. A squad with
three players about to RISE - which increases team value and is good news -
currently shows a red "3 Players at Risk!". Wrong colour, wrong icon, wrong verb.

New behaviour:

- green `N Rising Tonight` (Rocket) and red `N Falling Tonight` (Leaf), rendered
  side by side when both are non-zero; count only `rising_soon` / `falling_soon`
- if neither exists, fall back to the trending tier in a softer tone
  ("2 Trending Up" / "1 Trending Down"), keeping today's two-tier behaviour
- only when all four counts are zero: "Today Safe"

Why the fallback matters: Decision 1 moves the "tonight" cut from 75% to 100%, so
tonight-only counts would be zero on most days, and the 60-99% band - the window
where you can still act - would vanish from the team page entirely. By the time a
player reaches 100% it is usually too late.

Reuse STATUS_META from components/prices/status-meta.tsx for icon and colour so
the team page and the market table cannot drift apart.

## Decision 8 - System health  (ACCEPTED)

**Build a `/status` page** that renders the endpoints which already exist but
which nothing currently calls: /api/market/status and /api/analyst/status. There
is no app/settings/page.tsx today, only app/settings/telegram.

Show, as green/amber/red rather than raw JSON:

- market snapshot: last capture time, missing dates
- price changes: days computed, last change detected
- Telegram: configured?, last send, last failure and its reason
- playerStats: gameweeks stored vs finalised, which are pending
- gameweeks: which are `data_checked`
- forecast: last generated, current quality flags

Prerequisite, and worth doing first on its own: `recordNotification` is currently
called only when `result.ok` (price-alert/route.ts:196), so a Telegram rejection
leaves no trace anywhere. "Nothing qualified", "bot not configured" and "every
send was rejected" are indistinguishable from outside today - which is exactly
why "why did it not alert" could not be answered from the data.

## Decision 9 - Build order  (ACCEPTED)

```
0. USER: GET /api/market/status on PROD -> dayCount, firstDate, missingDates
         GET /api/telegram/settings on PROD -> configured?
1. Record Telegram failures + build /status page        (small; makes the rest visible)
2. lib/price-changes.ts + diff step in market-snapshot   (write-only, nothing reads it, risk 0)
3. Target % rewrite: reset baseline + 0-100% scale       (foundation for all UI)
4. UI: 4-column table, Past tab, team badges, GW label
5. Telegram "prices changed" section                     (needs step 2)
```

Rationale: steps 3 and 4 are coupled. The Target % rewrite changes what "Rising
Tonight" *means*, and both the new table and the team badge display it. Building
the UI first would give the known-wrong number more prominence and then require
reworking both surfaces.

Partial-credit note that makes step 3 viable before much history exists: a player
with `cost_change_event == 0` has not changed price this gameweek, so baseline 0
is already correct and needs no stored history at all. Early in a gameweek that is
nearly the whole table. Only players who have already moved need a snapshot to
locate their baseline, and they degrade to today's behaviour until one exists.

## Still open / carried

- Prod verification (step 0) gates the honest answer to "is the system working
  after GW1". Dev shows playerStats EMPTY and forecasts flagged
  `no_player_history` + `uncalibrated`, but dev's cron does not run, so this says
  nothing about prod.
- `data_checked` for GW1: not confirmed. Do NOT loosen that gate to force stats
  capture - GW1 already showed FPL contradicting itself (history 94 vs league
  table 93), and provisional stats would poison the training signal permanently.
- Retention for `priceChanges/` - small docs, but unbounded. Decide before it
  matters, not after.
- memory note to update: `.env.local` now resolves to `fanta-fpl-dev`, not prod.

---

# IMPLEMENTATION STATUS - 2026-08-27

Steps 1-5 of Decision 9 are built. Step 0 (prod verification) is still with the
user and is the only thing blocking a truthful answer on system health.

## Files created

| File | Role |
|---|---|
| `lib/price-changes.ts` | pure. `diffSnapshots`, `diffAgainstLive`, `findTransferBaselines`, `buildThresholdObservations` |
| `lib/price-thresholds.ts` | pure. `fitPriceThresholds`, `thresholdFor`, `fallbackThreshold` |
| `lib/price-changes-store.ts` | Firestore access + `loadPriceContext` (cached 15 min) |
| `components/prices/PriceChanges.tsx` | the Past tab |
| `app/status/page.tsx` | the health page |

## Files modified

`lib/price-calculator.ts` (rewritten scoring), `lib/types.ts`, `lib/fpl-api.ts`
(threads `PriceContext` through `buildSquadPlayers`), `lib/telegram.ts`
(+`priceChanged` toggle), `lib/notifications.ts` (+`outcome`/`error`),
`app/api/cron/market-snapshot/route.ts` (+diff step, +threshold fit),
`app/api/cron/price-alert/route.ts` (+changed-prices section, +failure records),
`app/api/market/status/route.ts`, `app/api/telegram/settings/route.ts`,
`app/prices/page.tsx`, `app/page.tsx` (GW label), `app/team/[id]/page.tsx`,
`components/prices/PriceMarketTable.tsx` (4 columns, tabs, sort chips),
`components/prices/status-meta.tsx`, `components/pitch/TeamPitchTopBar.tsx`,
`components/telegram/TelegramSettingsModal.tsx`, `components/Navbar.tsx`.

## New Firestore collections

```
priceChanges/{YYYY-MM-DD}   ~2KB/day  diff + threshold observations
priceThresholds/{season}    tiny      fitted scale per direction
```

Both keyed so a cron re-run overwrites its own document.

## Verification

- `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean.
- 47 unit assertions on the pure module pass, covering all ten cases from the
  audit's test plan plus baseline behaviour across a gameweek rollover.
- End-to-end run against live FPL bootstrap (614 players): the pipeline produces
  scores, statuses and orderings without error.

## FINDING from the live run - the unfitted threshold is visibly too low

With no fitted threshold and no snapshot history, against live FPL data:

```
rising_soon (>=100%)   26 players
falling_soon (<=-100%) 20 players
top scores pinned at the +300 / -300 display cap
  M.Sangare  MID  7.6% owned  net +318,070  ->  300%
  De Cuyper  DEF  7.0% owned  net +373,809  ->  300%
```

46 players "changing tonight" is too many, and hitting the cap means the divisor
is far too small for low-ownership players. This is the estimate being wrong, not
the new code being wrong - `max(25000, ownership*12000)` was never checked against
a real change, which is the whole reason Decision 2 exists.

It self-corrects: once `priceChanges` documents accumulate, `fitPriceThresholds`
measures the real scale and divides by it. Until then the market page labels the
number "estimated threshold" and /status shows the threshold row as idle rather
than green. Nothing presents the estimate as a measurement.

Note the caveat this run also exposed: only 10 players had a non-zero
`cost_change_event`, because that field resets at the gameweek rollover. Right
after a rollover a zero baseline is correct for everyone, so the reset fix has
nothing to correct yet; it earns its keep mid-gameweek.

## Not done

- Visual confirmation of the new UI. The app is password-gated and entering a
  password is not something I will do; the dev server is running on :3000 for the
  user to log into.
- Prod verification (step 0).
- Retention policy for `priceChanges/` - small docs, but unbounded.

## Browser verification - 2026-08-27

Verified in Chrome, logged in, against the dev database.

Working as specified:

- `/prices` - Table/Past tabs, four columns (Target / Player / Owned / Status),
  `MID GBP4.6 BHA` under the name, SORT chip row with direction arrow, Past tab
  showing the honest "No price history yet" empty state (dev has one snapshot).
- `/team/11` - two badges side by side: green rocket "3 Rising Tonight" and red
  leaf "1 Falling Tonight". `/team/1` falls back to "1 Trending Down" in the
  softer tone. `/team/2792350` shows "Today Safe".
- `/` - `DONE GW 1`, `CURRENT GW 2`, `UPCOMING GW 3`.
- `/status` - all seven rows render with correct tones.

Three defects found in the browser and fixed:

1. **Status column clipped.** `table-fixed` gave Status 96px while the
   "Rising Tonight" pill is 120px wide with `whitespace-nowrap`, and the card's
   `overflow-hidden` cut it off (`scrollWidth` 1134 vs `clientWidth` 1102).
   Widened to `w-24 sm:w-36`; measured 1102/1102 after.
2. **`/prices` badge said "Gameweek 1"** days after GW1 ended - the same
   `is_current` trap as Decision 6, in a second place. Now resolves the active
   gameweek the same way the home page does.
3. `"1 days"` on /status. Pluralised.

## ANSWER to "does the system still work after GW1"

`/status` reports **GW1 IS data-checked** (`1 data-checked (up to GW1)`, FPL
reports GW1 current and GW2 next). So the `data_checked` gate is open and the
analyst pipeline is free to capture GW1 player stats - the earlier audit could
not confirm this.

In dev it has not: `Player stats: 0 of 1 finalised gameweeks` (amber). Expected,
because the cron only runs on the production deployment. **Check /status on prod**
- if it also says 0 of 1, the nightly job is not capturing and the forecast is
still running on last season's priors.

## Not verified

Mobile layout at 375px. `resize_window` reports success but `innerWidth` stays
1470, so the breakpoint never switches; the Browser pane can emulate mobile but
is not logged in. Arithmetic says it fits (64 + 96 + 96 fixed, ~119px for the
player cell which truncates, short pill ~79px inside 96px) but that is a
calculation, not an observation.
