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

---

# THRESHOLD RECALIBRATION - 2026-08-27 (evening)

Prompted by the user: our table showed 26 players "Rising Tonight"; livefpl
showed one. That gap is not a scale error, it is a **shape** error.

## Method

Read livefpl's Prices table (risers and fallers) and FPL's bootstrap at the same
moment, then inverted their published progress percentage to recover the
threshold each player is being measured against:

    implied threshold = net_transfers / (livefpl_progress / 100)

17 players, ownership 0.0%-43%. Confounders checked and cleared: only 10 players
have `cost_change_start != 0` this season and all are rises, so for everyone else
the gameweek-cumulative net IS the net since their last reset - the two measures
agree and the comparison is clean.

## Finding 1 - rises use a CONSTANT threshold

| player | ownership | implied threshold |
|---|---|---|
| Hinshelwood | 2.5% | 219,341 |
| Gakpo | 5.8% | 224,406 |
| Havertz | 7.3% | 197,651 |
| Cherki | 10.2% | 216,647 |
| Odegaard | 11.2% | 201,995 |
| Gvardiol | 13.3% | 246,182 |
| Tzolis | 25.9% | 194,298 |
| Rogers | 25.9% | 214,039 |
| Szoboszlai | 43.0% | 218,733 |

Ownership spans **17x**. The threshold spans **1.27x**. It is flat.

Median 216,647 = **2.21% of `bootstrap.total_players`** (9,804,056). Expressing
it as a fraction of the manager base rather than a hard number lets it track the
player base as it grows through the season.

Mechanically this is obvious in hindsight: **anyone can buy a player**, so the
buying pool is every manager, not the ones who already own him.

## Finding 2 - falls scale with OWNERSHIP

| player | ownership | implied threshold | per 1% owned |
|---|---|---|---|
| Madueke | 0.3% | 5,721 | 19,071 |
| Merino | 0.6% | 11,568 | 19,280 |
| Welbeck | 1.0% | 18,954 | 18,954 |
| Hincapie | 1.5% | 28,823 | 19,216 |
| Eze | 1.8% | 33,789 | 18,771 |
| Anderson | 6.3% | 118,167 | 18,757 |

Six of seven land within 3% of ~19,000 per 1% ownership - roughly a fifth of a
player's owners. Also mechanical: **only an owner can sell**, so the selling pool
IS the ownership.

So the two directions have genuinely different shapes, and the old formula -
one ownership-proportional divisor for both - was the wrong shape for rises and
the right shape with the wrong constant for falls.

## Accuracy against livefpl

| model | mean abs error | risers >=100% | fallers <=-100% |
|---|---|---|---|
| old `max(25000, own*12000)` | **82.8 pts** | 23 | 16 |
| split rise/fall | **3.6 pts (rises)** | **1** | 13-28 |
| livefpl (truth) | - | **1** | **4** |

The rise side is solved: 3.6 points of error and the count matches exactly.

## The fall side is NOT solved

Two problems, both real:

1. **`selected_by_percent` is rounded to one decimal.** Below ~0.5% ownership the
   denominator is dominated by rounding, and 74 of the 87 false fallers are
   players reported at "0.0%". A floor on the fall threshold hides them
   (`max(15000, own*32000)` gives exactly 4, matching livefpl) but that is fitting
   the count, not the mechanism.
2. **Two players at identical ownership imply different thresholds.** Sarr and
   Bruno G. are both 3.0% owned; implied 48,795 and 32,666 per 1%. Something
   per-player that we cannot observe is involved, so fall error stays ~32-39
   points however the constants are tuned.

Rises are accurate. Falls are directionally right and noisy, and the UI should
not present them with equal confidence.

## Retention - checked, and there is NONE

`grep prune|KEEP_DAYS|retention|delete` over the new modules returns nothing.
`priceChanges/{date}` grows one document per day forever.

Precedent exists and is two lines: `lib/notifications.ts` has `KEEP_DAYS = 90`
and `pruneNotifications()`, called opportunistically after each write.

Size is not the issue (~2KB/day, ~700KB/year). Two other things are:

- **The Past tab reads `listPriceChangeDays(30)`** - already bounded, so old
  documents are invisible and pay rent forever.
- **`collectObservations()` reads the newest 30 days** to fit thresholds. Once
  more than 30 days exist, the fit silently uses a moving window - which is
  probably correct, since the real threshold drifts with the manager base, but
  it is currently accidental rather than chosen.

## Decision 10 - Split rise/fall thresholds  (ACCEPTED)

**Rises: constant. Falls: ownership-proportional with a floor. Say plainly that
falls are the less confident half.**

```
riseThreshold = total_players * RISE_FRACTION      (fitted; 0.0221 today)
fallThreshold = max(FALL_FLOOR, ownership * FALL_PER_PCT)
                                                   (fitted; 15,000 and ~32,000)
```

- `total_players` comes from bootstrap and is already fetched everywhere the
  score is computed, so the rise threshold tracks the manager base as it grows
  instead of ageing into a hard-coded number.
- The fall floor exists because `selected_by_percent` is rounded to one decimal:
  below ~0.5% the denominator is mostly rounding error, and without a floor 74
  players reported as "0.0%" flood the faller list. The floor is chosen to match
  the observed count, which is fitting the symptom - stated here so nobody later
  mistakes it for a measured quantity.
- `fitPriceThresholds` now fits **three** scalars against real observations
  (rise fraction, fall per-percent, fall floor) instead of one scale factor on a
  shape that was wrong. Every observed change remains a direct sample.
- UI must distinguish the two: rises carry ~3.6 points of error against livefpl,
  falls ~32-39 points however the constants are tuned, because two players at
  identical ownership demonstrably imply different thresholds. Presenting both
  with the same confidence would be the dishonest part.

## Decision 11 - Retention  (ACCEPTED)

- `priceChanges/` keeps **730 days** (two seasons), pruned opportunistically
  after each write, mirroring `pruneNotifications()`. ~1.5MB total.
- **`collectObservations` widens from 30 days to 90.** The 30 was never chosen -
  it was a default that came along for the ride. It was defensible while the
  threshold was a raw number that drifts with the manager base, but Decision 10
  stores the rise threshold as a *fraction of `total_players`*, which removes
  that drift. With the drift gone, more samples are strictly better.
- The Past tab stays at 30 days per page with a "load more".

## Result after implementing Decisions 10 and 11

Re-measured against the same livefpl snapshot:

| | before | after | livefpl |
|---|---|---|---|
| mean abs error, rises | 82.8 pts | **3.6 pts** | - |
| mean abs error, falls | - | 28.5 pts | - |
| Rising Tonight | **26** | **1** | **1** |
| Falling Tonight | 20 | 15 | 4 |

Every rise sample now lands within 8 points. The count matches exactly.

**One honest caveat on the rise side:** we and livefpl both say exactly one
player is rising tonight, but not the same one - we pick Palmer (109%), they pick
Odegaard (103.6%, Palmer 88.9% "Tomorrow"). Palmer's implied threshold is 266k
against a 216k median, the only real outlier in the rise set, and the two above
him by ownership (Gvardiol 13.3% -> 246k, Palmer 14.7% -> 266k) hint at a mild
ownership slope the flat model does not capture. Not worth adding a parameter
on two points; the fitter will find it from real observations if it is real.

Falls remain the weak half at 28.5 points, driven by Bruno G. (-220 vs -102.5)
and Madueke (-36 vs -93.6) - the same per-player variation that made two players
at identical ownership imply different thresholds. The market table now says so
in as many words rather than presenting both directions with equal confidence.

---

# ROUND 2 - UI, falls, and performance (2026-08-27, late)

## Measured page timings on PRODUCTION (logged in, cache-busted, two passes)

```
/analyst        2,677 ms   135 KB
/prices         1,389 ms   531 KB   <-- payload
/status           899 ms    25 KB
/team/2792350     718 ms   108 KB
/                  85 ms    12 KB   (client shell, already fast)
```

Pass 1 and pass 2 are identical on every server-rendered route, so nothing is
being cached between requests - every navigation pays the full cost.

## Cause of the /prices payload: the same 24 objects, 616 times

```
analyses total                     648 KB  (616 players)
  .team          364 bytes x616 =  218 KB   <-- 20 distinct clubs
  .elementType   294 bytes x616 =  176 KB   <-- 4 distinct positions
with team/elementType as ids       252 KB   (-396 KB, 61%)
as positional arrays                38 KB
```

`PriceAnalysis` embeds the whole `FPLTeam` and `FPLElementType` object in every
row, and `PriceMarketTable` is a client component, so all 616 copies cross the
server/client boundary. Sixty-one percent of the page is twenty clubs and four
positions, repeated.

The market page needs every player client-side for search, filter and sort, so
sending 616 rows is right. Sending 616 copies of "Arsenal" is not.

## Cause of /analyst at 2.7s

It runs the full pipeline on every request - `loadFeatureInputs` (six Firestore
reads) then `buildFeatures` then `forecast` over ~600 players - to render a page
whose inputs change once a day. The forecast for the target gameweek is already
written to `forecasts/{season}/gameweeks/gw_n` by the nightly cron.

## Firestore round trips (dev, measured)

```
market .select() ids only     427 ms   (1 document)
read one full market doc      108 ms   (41 KB)
priceThresholds doc            75 ms
listPriceChangeDays(30)        45 ms
```

The fixed cost of a round trip dominates; `loadPriceContext` caches baselines
for 15 minutes but `readPriceThresholds` runs uncached on every request.

## Decision 12 - Team page warning names the players  (ACCEPTED)

The badge gives a count and nothing else, and the team page does not load the
watchlist at all (`grep watch` over TeamPitchTopBar.tsx and team/[id]/page.tsx
returns nothing), so a watchlisted player about to rise is invisible on the page
where you would act on it.

- Read `watchlists/{teamId}` on the team page - one small document.
- Under the badges, a compact line naming who is moving, squad and watchlist
  together, with the watchlist entries marked by the star already used elsewhere.

## Falls: three attempts, and the honest conclusion

Our 15 `falling_soon` against livefpl's 5 tonight. The extras are NOT
low-ownership noise - they span 0.5% to 13.7% and only one is under 1%.

Attempt 1 - tune the constant. Raising `fallPerPercent` to ~32,000 does match the
count, but Anderson (6.3%) and Hincapie (1.5%) - both confirmed falling tonight
by livefpl - drop to -63%. It trades false positives for false negatives.

Attempt 2 - measure the implied per-player constant. At essentially identical
ownership the values differ by 2.5x: Hincapie 1.5% implies 19,216 per 1% while
Doku 1.4% implies over 48,700. No single constant can satisfy both.

Attempt 3 - use ownership at the START of the counting window rather than now,
reconstructed as `own_now - net/total_players*100`. A heavily-sold player has
already shrunk, so current ownership makes the divisor too small. This is a real
improvement in consistency - the spread in the implied constant falls from 42%
to 31% - but the count stays at 13 and the mean error rises to 36.6.

**The ordering is what is broken, not the scale.** Our biggest faller is Spence
at -300%; livefpl does not have him in their top ten at all. No threshold fixes
a wrong ordering, and the fitter can only ever correct the scale of a shape -
so more observations will not rescue this the way they will rescue rises.

livefpl polls hourly and has years of per-player counter state. We poll daily and
have five days. That gap is the finding.

## Refit on 176 livefpl points (27 risers, 110 fallers, 2026-08-27)

Collected the full risers and fallers tables from livefpl (40 rows/page, three
pages each) and inverted the published progress against FPL's bootstrap, after
dropping every player whose price has already moved this season - their counter
has been reset while `transfers_in_event` kept counting, so our net is not
comparable for them.

**The shapes are now confirmed, not inferred.** Coefficient of variation of the
implied threshold under each model:

| | as a constant | scaled by ownership |
|---|---|---|
| RISES (27 pts) | **CV 20%** | CV 76% |
| FALLS (110 pts) | CV 183% | **CV 38%** |

Rises are flat, falls scale with ownership. Neither is close.

An independent confirmation fell out of the same data: the players our old
formula ranked at 300% - Sangare, De Cuyper, Joao Pedro, Kayode, Mendy - all sit
at 1-11% on livefpl, because they have already risen and their counters reset.
That is exactly what `findTransferBaselines` corrects.

Rise constant, stable across every band: **2.237% of `total_players`**
(2.212% from |pct|>=50, 2.240% from >=30). MAE 4.4 points, count exact.

## The fall trade-off, stated plainly

Fitting the fall constant to the players nearest the line gives ~19,200 per 1%.
Fitting it to reproduce livefpl's *count* gives ~26,000. They cannot both hold:

| fall constant | flagged | of livefpl's 5 real fallers |
|---|---|---|
| 19,229 (measured at the line) | 13 | **4 caught** |
| 21,022 (measured over all 110) | 8 | 2 caught |
| 26,000 (tuned to match the count) | **5** | **2 caught** |

Raising the constant to match the count does not swap false positives for
accuracy - it drops Anderson and Hincapie, whom the measured constant scores at
-106% against livefpl's -106.8% and -105.6%, near-perfectly. Tuning to the count
produces the right number of the wrong players.

The residual is not ownership. Players we overestimate span 0.5%-13.7% and the
ratio to livefpl runs 1.8x-2.8x with no ownership pattern, while Anderson (6.2%)
and Hincapie (1.5%) are dead on. Something per-player and unobservable in the
public API is setting each player's line.

## Decision 13 - Fall constant: recall over count  (ACCEPTED)

**Keep the measured constant (~19,229 per 1% owned) and accept 13 flagged.**

Missing a player who really does fall costs you real money - you sell late.
Seeing three extra names costs you nothing but a second look. The asymmetry
decides it, and tuning to the count would drop Anderson and Hincapie, whom the
measured constant scores at -106% against livefpl's -106.8% and -105.6%.

Rise fraction updated 0.0221 -> **0.02237**, now measured on 27 points across
four bands rather than nine.

## Decision 14 - Round 2 UI and performance  (IMPLEMENTED)

1. **"MY TEAM" chip removed** - the row already carries a blue tint, and the
   badge spent width in the narrowest column to repeat it.
2. **Team page names the movers.** A line under the badges lists squad and
   watchlist players that are moving, green for rises, red for falls, watchlist
   marked with the star used elsewhere. `lib/watchlist.ts` reads
   `watchlists/{teamId}` server-side - the page did not load it at all before.
3. **Team gameweek chips follow the week being played.** They were built from
   the squad's gameweek, which is the week that has just ended, so after GW1 they
   offered GW1 and GW2 instead of GW2 and GW3. New `liveGw` prop, resolved the
   same way as Decision 6, kept separate from the squad's own `activeGw`.
4. **Market header regrouped**: title tight to the top, tab switcher and the
   update-window card sharing the row below it. The card is passed into
   PriceMarketTable as `aside` because the tabs live inside that client
   component.
5. **Falls: measured constant kept** (Decision 13).
6. **Performance.**

```
                          before      after
market payload            648 KB     144 KB   (-78%)
  rows                    648 KB     136 KB
  clubs + positions        394 KB       8 KB   sent once, not 616 times
/analyst render          2,677 ms     ~cached  unstable_cache, 15 min
```

`lib/market-row.ts` now owns the row contract: exactly ten fields plus two ids.
`PriceAnalysis` also carries baselines, raw transfer counts and threshold
provenance that the table never reads, ~14KB each across 616 rows.

**A bug this caught that types did not.** `MARKET_ROW_FIELDS` was first exported
from the `'use client'` table module. `tsc` and `next build` both passed, and the
page threw `MARKET_ROW_FIELDS is not iterable` at runtime: a *value* imported
from a client module into a server component arrives as a client reference, not
the array. Types cross that boundary, constants do not - which is why the
contract now lives in `lib/`.

---

# ROUND 3 (2026-08-27, night)

## Decision 15 - Team page opens on the upcoming gameweek  (ACCEPTED)

`initialGw` defaulted to `entry.current_event`, the last gameweek with points -
GW1. The chips offer GW2 and GW3 (Decision 14), and `isShown` compares against
that default, so **no chip was highlighted at all**: the page opened on a
gameweek that was no longer offered. Default to the gameweek being played.

Picks are still fetched for the last gameweek that HAS them, rather than letting
the existing walk-back discover it: starting the fetch at GW2 would spend a
guaranteed 404 on every single team page load, which fights Decision 17.

## Decision 16 - Trending badges must not look like Tonight  (ACCEPTED)

Not a data bug. Verified on production, both pages agree exactly: Tzolis is at
+67% and reads "Trending Up" on the market table and "1 Trending Up" on the team
page. He is correctly absent from Rising Tonight, which starts at 100%.

The confusion is the design's fault. The Trending badge is the same solid green
in the same shape as the Tonight badge, differing by one word - and the mobile
label collapses to "1 Up", which reads as the same thing. Two tiers that mean
very different things should not look nearly identical.

Tonight keeps the solid fill and the pulse. Trending becomes translucent with a
border and no pulse - visibly the quieter statement.

## Decision 17 - loading.tsx on every dynamic route  (ACCEPTED)

Only `/team/[id]` had one. `/prices`, `/analyst` and `/status` are all
`force-dynamic` with no loading boundary, so the App Router paints nothing until
the server component resolves - the click appears to do nothing for 0.9 to 2.7
seconds. That is exactly the reported symptom.

A loading boundary also gives Next something to prefetch for a dynamic route, so
the shell is already in the client cache by the time the link is clicked.

## Round 3 verification

- Team page now opens with **GW 2 highlighted**. Before, `initialGw` was GW1
  while the chips offered GW2 and GW3, so `isShown` matched nothing and neither
  chip was selected — a bug that was on screen and invisible.
- Confirmed on production that the "1 Trending Up" report was NOT a data
  mismatch: Tzolis is +67% and reads "Trending Up" on both pages, correctly
  outside Rising Tonight, which starts at 100%.
- All four dynamic routes now return a prefetchable **14KB skeleton** to an
  `RSC`/`Next-Router-Prefetch` request. Previously only /team/[id] did; the
  others had no loading boundary, so a click blocked on the full render.

**Consequence worth naming:** opening on the upcoming gameweek makes the pitch
default to fixtures rather than stats, because `FootballPitch` picks its mode
from `isPreview` and a gameweek that has not kicked off has no points to show.
Existing behaviour, newly reached by default. GW1's points are one chip away.

## Decision 18 — one unescaped `~` silenced every alert

The alert was never being skipped and the cron never failed. Telegram rejected
the message, every single night:

```
Bad Request: can't parse entities:
Can't find end of Italic entity at byte offset 256
```

The last line of the message was hardcoded, not passed through
`escapeMarkdown()`:

```
⏰ _Prices update daily ~01:30 - 02:30 UTC_
                        ^ opens a MarkdownV2 strikethrough
```

`~` opened a strikethrough entity that swallowed the italic's closing `_`.
Message length is 257 bytes and the `~` sits at byte 237, which matches the
offset Telegram reported. `escapeMarkdown` already covers `~` — the character
simply never reached it. It was the only occurrence in the repository.

Confirmed on production that the bot itself was healthy: `POST /api/telegram/test`
delivered, because its fixed message happens to contain no `~`. So the fault was
isolated to the alert template alone — not the token, the chat id, the schedule,
or the thresholds.

**Second change, worth more than the first.** `sendTelegramMessage` now retries
without `parse_mode` when Telegram reports a parse failure, and reports the
original rejection as a warning on an otherwise successful send. A single stray
character cost days of alerts; from here a formatting slip costs the formatting
only. The warning is recorded on the notification so /status still shows the bug
rather than hiding it behind a delivered message.

This was only findable because the /status page and the notification log from
Decision 12 record failures. Before them, a rejection returned 502 into a Vercel
log nobody reads, and looked exactly like a quiet night.

## Decision 19 — an FPL outage should cost freshness, not the site

On 2026-08-28 FPL began returning 403 to every request from Vercel while the
identical request from a residential IP returned 200 — a Cloudflare block on the
egress address. Two separate failures followed, and both were ours.

**The message was wrong.** `/team/[id]` rendered "Team Not Found" with a "Search
Another Team ID" button. The team was fine; FPL was down. The page sent people to
correct something that was never broken. `FplError` now carries a `kind` —
`not_found` only for a real 404, `unavailable` for everything else — and the two
get different cards. The upstream one offers a retry, not a search box.

**The site had nothing to fall back on.** Every page begins with the bootstrap,
so one refused request took down the whole app while a perfectly good copy sat in
memory. Three layers now, in order of freshness:

1. the fetch itself, retried **once** on 403/429/5xx — FPL's block is IP-level
   and a burst makes it worse, so this covers a wobble and gets out of the way;
2. the last good response per path, in instance memory;
3. for the bootstrap only, a durable copy in `settings/fplBootstrapCache`,
   rewritten at most hourly. Instance memory dies with a cold start, which is
   precisely the case that takes the site down.

Stale data is served **labelled**. An error page is obviously wrong; last hour's
prices presented as current are not, which makes silence the worse failure.

**A design that would have shipped broken.** Staleness was first tracked with
React's `cache()` for per-request state. A throwaway probe route proved it
returns a *fresh* object on every call outside a render — the banner would never
have appeared, and no type error or build would have said so. It is now keyed on
the identity of the returned value in a `WeakMap`: a value served from the
fallback is marked, a freshly fetched one is a new object and is not, and nothing
leaks between concurrent requests.

Verified: 11 assertions against a stubbed FPL (fallback serves, fresh values stay
unmarked, exactly one retry, a genuine 404 is neither retried nor substituted),
plus a Firestore round-trip on the dev database confirming the document fits and
the hourly write guard holds.

**Not verified:** the banner has never been seen during a real outage — FPL
recovered before this shipped. The next 403 is its first live test.

## Round 5 — the stats card and the menu

### Decision 20 — Squad Value is a selling price, not a market price

The card read £100.0m while the pitch above it showed prices that had moved for
days. It was `entry_history.value`, frozen at the GW1 deadline.

The naive fix is wrong: summing `now_cost` gives a number FPL never shows, and
it overstates the team every time a player rises. FPL sells at
`purchase + floor((now_cost − purchase) / 2)` on a rise, and at `now_cost` on a
fall — the manager keeps half the gain and all of the loss.

Purchase price is recoverable for all fifteen without a new endpoint shape:

| Case | Source |
|---|---|
| Bought during the season | `element_in_cost`, latest transfer-in for that element |
| Original squad, never traded | `now_cost − cost_change_start` — the season-start price, which is what they were bought at |

`cost_change_start` is already in `ELEMENT_FIELDS`; only `/entry/{id}/transfers/`
is new to this page, and `fetchFPLTransfers` already exists and already degrades
to `[]`.

### Decision 21 — the stats card mixes two clocks, so it gets two headings

`Total Points 53` is a season figure. `GW Points —` is a week that has not
kicked off. Side by side with no heading they read as one contradictory
statement — which is exactly what was reported. Split into **"GW n · not played
yet"** (points, rank) and **"Season so far · through GW1"** (total, overall rank,
squad value, bank). Every number now says what period it belongs to.

### Decision 22 — the prefetch added in Round 3 never ran

Round 3 added `loading.tsx` to all four dynamic routes and verified the server
returns a 14KB skeleton to an RSC prefetch request. That verified the wrong
half. The nav menu is `{isMenuOpen && (…)}`, so its links are **not in the DOM
until the hamburger is pressed** — and Next prefetches on viewport intersection.
Confirmed against production HTML: `/analyst`, `/status` and `/backup` appear
nowhere in the initial markup.

So every menu click still paid a full round trip before anything could paint.
The skeleton existed; nothing had asked for it.

Fixed by prefetching imperatively with `router.prefetch()` on mount, during idle
time, rather than by relying on the observer seeing a hidden element. Rendering
the menu permanently and hiding it with CSS would not have worked either —
`display: none` never intersects.

Measured on production, two passes per route:

| Route | TTFB | Total | HTML |
|---|---|---|---|
| /backup | 114 ms | 115 ms | 12 KB |
| /status | 405 ms | 910 ms | 29 KB |
| /team | 410 ms | 1,264 ms | 114 KB |
| /prices | 330 ms | 1,195 ms | 351 KB |
| /analyst | 350 ms | 2,623 ms | 138 KB |

TTFB is flat across all five while totals span 20×, so the cost is streaming the
body, not starting the response. Prefetching the skeleton hides that entirely
from the click; /prices' 351KB body and /analyst's 2.6s remain, and are a
separate question deliberately left open.
