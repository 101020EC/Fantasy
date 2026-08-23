# UI round 2 — decision log

Fourteen requests. Items 1–4 are already implemented on branch
`market-ui-tweaks` (not yet merged); the rest are new. Several items
conflict with each other or with decisions made during the audit, so each
is resolved here before any code is written.

Status key: **OPEN** (needs a decision) · **DECIDED** · **DONE**

---

## Already implemented (branch `market-ui-tweaks`)

| # | Request | Note |
|---|---|---|
| 1 | Market: show the price window in Bangkok time | **Conflicts with #9** — currently rendered in Thai |
| 2 | Market: injury note on one line, running right | Done |
| 3 | Market: centre the table header, make it blend | **Superseded by #14**, which reorders the columns |
| 4 | History: stop Team Setup opening every time | Done |

## New requests

| # | Request | Status |
|---|---|---|
| 5 | History: move Team Setup beside the team name, flush right | OPEN |
| 6 | Team: remove the gameweek selector bar | OPEN — reverses audit fix L5 |
| 7 | Team: show other leagues, not only Private | OPEN — reverses audit fix M10 |
| 8 | Backup: turn into a page; browse stored player data; add "Back Up League" | OPEN — largest item, has a hard external constraint |
| 9 | Convert all remaining Thai UI text to English | OPEN — conflicts with #1 |
| 10 | Falling Tonight icon → falling red leaf | OPEN |
| 11 | Make the top bar / top edge white | OPEN — header is already white; needs clarifying |
| 12 | Market: align Trending Up under Rising Tonight, Trending Down under Falling Tonight | OPEN |
| 14 | Market: Target % half width and moved first; status icons; Status column last and centred | OPEN — contains an internal contradiction |

---

## Findings from the codebase

- **League types.** FPL returns only two `league_type` values: `s` (system —
  club, country, gameweek, Overall, sponsor leagues) and `x` (invitational).
  Team 1 has 23 classic leagues. There is also a separate `h2h` array, empty
  for that team.

  _Correction (found while verifying batch 2): an earlier note here said only
  1 of the 23 was `x`. That came from printing the first 8 rows and reading
  them as the whole set. The real split is **16 private / 7 system**, which
  the rendered cards confirm._ Audit fix M10 narrowed the card
  to `x` only; #7 asks to widen it again.
- **Backup is a modal**, opened from the navbar menu — not a route.
- **Already archived** by `POST /api/archive`: `teams/{id}`,
  `teams/{id}/gameweeks/gw_{n}`, `leagues/{id}/gameweeks/gw_{n}` (full member
  standings). So "back up each member's rank per gameweek" partly exists.
- **Already captured daily** by `/api/cron/market-snapshot`: `market/{date}`
  (13 volatile fields x 604 players) and `players/roster`. This is the data
  #8 would browse. One day is stored so far.
- `app/settings/telegram/` is an empty leftover directory, untracked by git.

---

## Decisions

_(appended as each question is resolved)_

### Finding: historical league standings (bears on #8)

Tested against the live API:

- `leagues-classic/{id}/standings/` **ignores an `event` parameter** — three
  variants returned byte-identical current standings. There is no way to ask
  "what did this table look like after GW 3".
- But `entry/{id}/history/` returns every past gameweek for one manager
  (`points`, `total_points`, `overall_rank`). Sorting all members by
  cumulative `total_points` **reconstructs any past gameweek's table**.
  Cost: one request per member (a 50-member league = 50 requests).

The consequence is the opposite of the market snapshot: member history does
**not** expire, so a league's past standings can be rebuilt at any time. There
is no urgency to start capturing, and no data is being lost while we wait.

It is currently GW1, so there is nothing to backfill yet regardless.

---

## Decision 1 — #8 "Back Up League" reconstructs full history (option B)

Chosen: **B** — rebuild every past gameweek from each member's
`entry/{id}/history/`, rather than only capturing the current table.

Rationale: the user's leagues have **fewer than 20 members**, so a full
rebuild is under 20 requests per league — cheap enough that the simpler
forward-only option buys nothing.

**Reconstruction must copy FPL's tie semantics.** Verified against league 314:
`rank` ties (3, 3, 6, 6, 9, 9, 9, 9) while `rank_sort` stays unique. Equal
`total_points` therefore share a rank, and the next rank skips by the size of
the tied group. `event_total` is recoverable too — `entry/{id}/history/`
carries per-gameweek `points`.

**Storage (assumed, not asked):** reuse the existing
`leagues/{id}/gameweeks/gw_{n}` path, add a `source: 'live' | 'reconstructed'`
field, and let a backfill fill gaps without overwriting a document already
captured live from FPL — FPL's own report is authoritative for the gameweek it
was taken in, particularly for `rank_sort` tiebreaks.

---

## Decision 2 — #8 Backup page is status + per-player line charts (option C)

Chosen: **C**, with **line charts** rather than numeric tables.

- **Status panel** — days captured, date range, gaps, which leagues and
  gameweeks are stored, last sync. This is the only place the daily cron's
  health is visible; today a silent failure would go unnoticed until someone
  opened the Firebase console.
- **Player browser** — search a player, see price / ownership / net transfers
  over time as a line.

Only one day is stored so far, so a chart is a single point until the archive
grows. Expected, not a defect.

**Charting (assumed, not asked):** hand-rolled inline SVG, no charting
library. The project's dependencies are deliberately small and the team page
was just cut from 249 kB to 118 kB by removing the Firebase client SDK;
pulling in Recharts (~100 kB) to draw one line would give most of that back.
The required chart — a line over dates with a hover readout — is a modest
amount of SVG.

---

## Decision 3 — #7 leagues split into two groups (option B)

Chosen: **B**. FPL only ever returns two `league_type` values, and they want
opposite treatment:

- **`x` — Private leagues.** Listed as now, expandable to the full member
  table, reorderable. These are the ones worth reading.
- **`s` — Global & club leagues** (Overall, England, Liverpool, Gameweek 1,
  Sky Sports, Top 1% …). Show the user's own position only, taken from
  `entry_rank`, which the entry payload already carries — no extra request.
  Not expandable.

Option C (expand a global league to the rows *around* you) was rejected as
not buildable: FPL offers no "standings near me" query, only paginated pages
of 50, so finding yourself in a ten-million-entry league would take thousands
of requests.

**Backup scope:** only private (`x`) leagues, and only those the user ticks —
matching the selection already stored in `fpl_selected_leagues_{teamId}`.
System leagues are never reconstructed; a million-member table is not
rebuildable at one request per member.

---

## Decision 4 — #14 Target % becomes the first column (option A)

Chosen: **A**. New order:

```
Target % | Player | Pos | Price | Owned % | Net Transfers | Status
```

Target % is halved in width. Status stays last and its content is centred, as
asked — noted that this puts Target % and Status (the score and the label for
that same score) at opposite ends of the table.

**Assumed, not asked:**
- "Trending down, green down-graph" is read as **red**. The rest of the app
  uses green for up and red for down, and #10 asks for a red leaf for Falling.
- Blinking icons reuse the existing `animate-pulse-rise` / `animate-pulse-fall`
  keyframes, which already honour `prefers-reduced-motion`.

---

### Findings that resolve two items without asking

- **#10 icons are all available in lucide-react** (already a dependency):
  `Leaf`, `Rocket`, `TrendingUp`, `TrendingDown`. A red `Leaf` rotated
  slightly gives the falling-leaf reading without a custom SVG.
- **`urgencyLabel` is dead.** `lib/price-calculator.ts` builds it for every
  player and `lib/types.ts` declares it, but no component ever renders it — it
  is computed 604 times and serialised to the client for nothing. Rather than
  translating it under #9, delete the field; that also trims the /prices
  payload.

---

## Decision 5 — #11 white top strip in installed (PWA) mode only

Chosen: **C, scoped to the top edge in standalone mode.**

The page background is `#f4f6fb`, so when the app is installed and running
with `viewport-fit: cover`, the strip behind the status bar picks up that
blue-grey while the navbar directly under it is white — two bands instead of
one surface.

Fix: extend the sticky navbar up through `env(safe-area-inset-top)` with a
solid white background, so the inset is painted by the header itself. The page
background elsewhere is unchanged, and `themeColor` stays `#38003c` — option A
was offered and declined.

---

### Items resolved by reading the code, no question needed

**#5 — Team Setup button placement.** The banner is
`flex flex-col sm:flex-row` with the button `self-start sm:self-auto`, so on
phones it drops below the team name and sits left. Make the row horizontal at
every width and push the button right with `ml-auto`.

**#6 — removing the Team page gameweek bar loses nothing.** The History page
already carries an identical 38-gameweek strip, and its version is better: it
swaps the squad in place, while the Team page's reloads the whole route
through `?gw=`. The two were redundant. `?gw=` stays supported on the route so
existing links keep working; only the control is removed.

**#9 — all Thai becomes English**, including the Bangkok time added in #1
("08:30 – 09:30 Bangkok" rather than "น."), the server-side error strings, and
the firebase-admin setup diagnostics. `urgencyLabel` is deleted rather than
translated (see above).

**#12 — filter buttons pair with the summary cards.** Today the status row
runs Rising Tonight, Falling Tonight, Trending Up, Trending Down in one wrap.
Lay it out as two columns matching the cards above: Rising Tonight / Trending
Up on the left, Falling Tonight / Trending Down on the right.

---

## Decision 6 — #8 chart plots three toggleable series (option C)

Chosen: **C** — price, net transfers, and ownership %, each line toggleable.

Injury state is drawn as **bands along the time axis**, not a fourth line — it
explains why transfers collapsed rather than being a quantity to compare
(assumed, not offered as an option).

### Consequences worth recording

**Reads need a server route.** `firestore.rules` denies every client request,
so the page cannot query Firestore directly. It needs `GET /api/market/...`
handlers returning a player's series and the archive status, alongside the
existing write routes.

**Reconstruction is cheaper than it first looks.** `entry/{id}/history/`
returns *every* gameweek for a manager in one response, so rebuilding a
league costs one request **per member**, not per member per gameweek — under
20 requests for these leagues, with all 38 gameweeks derived locally from the
results. A synchronous request is fine; no job queue needed.

**The Backup modal becomes a page.** New route `/backup`; the navbar menu
entry points there; `FirebaseBackupModal` is deleted rather than kept
alongside (assumed).

---

## Added mid-planning: #15 and #16

**#15 — highlight rows for players in your squad (blue).**
`/prices` is a pure server component; it fetches bootstrap and nothing else,
and has no idea which team the viewer follows. The highlight has to come from
a client-side fetch of `/api/fpl/picks/{savedTeamId}/{gw}` — the team id only
exists in localStorage. All 15 picks count, bench included.

**#16 — watchlist (light pink), intended to drive Telegram alerts.**

### Finding that shapes this

The nightly alert runs in `/api/cron/price-alert`, on the server, triggered by
Vercel Cron. It identifies the squad from `TELEGRAM_TEAM_ID` and fetches picks
server-side. **It cannot read localStorage — no browser is involved.**

So a watchlist kept in localStorage could colour rows and nothing else; the
stated reason for building it (alerting on those players) would not be
reachable. To drive Telegram, the list has to live where the server can read
it: Firestore.

## Decision 7 — #16 watchlist lives in Firestore (option B)

Chosen: **B** — `watchlists/{teamId}` behind a `GET`/`PUT /api/watchlist`
route, using the same `firebase-admin` path as `/api/archive`.

localStorage was rejected because it defeats the stated purpose: the nightly
alert has no browser to read from, so a local list could tint rows and never
reach Telegram.

The cron then alerts on **squad players and watchlist players**, as two
sections of one message.

**Assumed, not asked:**
- A player both in the squad and on the watchlist renders **blue** (squad is
  the stronger fact) with a small pink marker at the end of the row.
- The button beside the search box **toggles watchlist mode**: every row gains
  a ★ control while it is on, and a "Watchlist only" chip joins the status
  filters.

---

## Summary — all 16 items

| # | Item | Resolution |
|---|---|---|
| 1 | Market: Bangkok time | Done; retranslate to English under #9 |
| 2 | Market: injury note on one line | Done |
| 3 | Market: header centred, not banded | Done; column order redone by #14 |
| 4 | History: no unprompted Team Setup | Done |
| 5 | History: Team Setup right of the name | Horizontal row at all widths, `ml-auto` |
| 6 | Team: drop the gameweek bar | Redundant with History's; `?gw=` route support stays |
| 7 | Team: show other leagues | Two groups — private expandable, system rank-only |
| 8 | Backup page | Status panel + per-player charts; full history rebuild |
| 9 | Thai → English | All of it; `urgencyLabel` deleted rather than translated |
| 10 | Falling Tonight icon | lucide `Leaf`, red, tilted |
| 11 | White top strip | Navbar extends through `safe-area-inset-top` |
| 12 | Filter buttons align with cards | Two columns matching the summary cards |
| 14 | Market: Target % first and halved; icons; Status last | Target % is column one |
| 15 | Highlight squad players blue | Client fetch of picks; all 15 including bench |
| 16 | Watchlist, pink | Firestore-backed so the cron can alert on it |

---

## Decision 8 — ship in three batches (option B)

1. **UI pass** — #1, 3, 5, 6, 9, 10, 11, 12, 14. No data changes.
2. **Leagues + personalisation** — #7, 15, 16. Touches live data and the cron.
3. **Backup page** — #8. New route, new read API, history rebuild.

Batch 1 absorbs the four commits already on `market-ui-tweaks`.

_Interview complete — all 16 items resolved._

---

### Finding while building batch 3: only rebuild finalised gameweeks

The first reconstruction run disagreed with FPL. For one manager,
`entry/{id}/history/` reported 94 points while the league table reported 93,
with `event_transfers_cost: 0` — so not a transfer hit.

The cause is that GW1 is still open: `finished: false, data_checked: false`.
While a gameweek is live FPL is still awarding bonus and correcting stats, and
its endpoints disagree with each other in the meantime.

The ranking logic was right; the input was provisional. `reconstructLeagueHistory`
now takes the set of `data_checked` gameweeks and skips everything else, so the
archive never stores a number FPL is about to change.

Consequence worth expecting: **right now nothing is reconstructable**, because
no gameweek has been finalised yet this season. The button will report zero
gameweeks written until GW1 closes.

---

## Batch 3 built — verification notes

**Reconstruction matches FPL exactly.** Run against the user's own 9-member
private league, the rebuilt GW1 table reproduced every total and every rank
including the tie — two managers on 23 sharing #5, the next rank skipping to
#7. The only difference is the display order *within* a tie, since FPL's
`rank_sort` is not derivable from public data; the shared `rank` is.

**A Firestore query bug, found by the status panel reading zero.**
`leagues/{id}` documents are never written — only their `gameweeks`
subcollection is — and Firestore treats such a parent as a *missing document*
that `collection('leagues').get()` does not return. Two leagues existed and
the panel reported none. Fixed with `listDocuments()`, which returns
references regardless.

**Nothing is reconstructable yet, by design.** No gameweek is `data_checked`
this season, so the button reports zero written and says why.
