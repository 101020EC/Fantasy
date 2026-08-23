# UI round 3 — decision log

Four items: two bug reports, two feature requests. Findings from the code and
a running build come first, so questions only cover what the code cannot
answer.

Status: **OPEN** · **DECIDED** · **DONE**

| # | Request | Status |
|---|---|---|
| 1 | Alert settings — schedule, and what to alert on | OPEN |
| 2 | Market: the pulsing icon on Rising / Falling does nothing | DIAGNOSED |
| 3 | Team: picking GW2 still shows GW1; drop the arrow; tidy it | OPEN |
| 4 | Mode B: full club abbreviation, H/A under it, win/loss colour on the score | OPEN |

---

## #2 — diagnosed, two faults stacked

Measured on a running build, sampling the icon six times across the animation:

```
animation-name            pulse-fall      (running, 2s)
prefers-reduced-motion    false
box-shadow                rgba(239,68,68,0.7) 0px 0px 0px 0px
transform (6 samples)     matrix(1,0,0,1,0,0)  — identical every time
```

**The keyframes fight Tailwind's transform.** `pulse-rise`/`pulse-fall` animate
`transform: scale(...)`, and the leaf also carries `rotate-[135deg]`. Both set
the same property, the animation wins, and the measured transform sits at
identity throughout — so the leaf is **not even rotated**, let alone pulsing.

**The pulse was written for a badge, not an icon.** Its visible part is a
`box-shadow` ring expanding to 6px and fading. That reads well on the solid
round badge it was built for on the pitch; on a transparent SVG icon the
shadow follows the element box and is effectively invisible. The 5% scale on a
14px icon is under a pixel.

So the animation genuinely runs and genuinely shows nothing — "ไม่ทำงาน" is
accurate.

Fix direction: animate `opacity` for icons — that is what "กระพริบ" describes —
and stop animating `transform` on anything that also uses a Tailwind
transform. The badge on the pitch can keep the ring, since it works there.

---

## #3 — what the page actually does at `?gw=2`

```
badge            GW 1          (the squad's gameweek)
buttons          ‹ GW 2   GW 3 ›
stats card       GW Points 26  (GW1's points)
fixture cells    GW2 · GW3 · GW4   ← the only thing that changed
```

The fixture shift works. But FPL has no GW2 squad and no GW2 points until the
deadline passes, so nothing else *can* change — and with the badge still
reading GW 1 and the points unchanged, the page looks like it ignored the
click. The complaint is about what it looks like, not about the fixture logic.

### Correction after measuring production

The opponents **do** change, locally and in production. Counting club
abbreviations in the served HTML for team 1:

```
?gw=1   COV×4  AVL×1        (mode A card reads "COV (H)", difficulty 2)
?gw=2   COV×1  AVL×4        (mode A card reads "AVL (A)", difficulty 4)
```

So the fixture logic is sound and deployed. What is actually wrong is
everything *around* it:

- The badge still reads **GW 1**, because that is the squad's gameweek.
- The card still shows **6pt** and the stats card **GW Points 26** — GW1's
  points, displayed while previewing GW2. That is not just confusing, it is
  wrong: a future gameweek has no points.

Against a badge saying GW 1 and unchanged point totals, a small opponent
label changing from COV to AVL reads as "nothing happened". The report is
about the framing, and the points are a real defect.

**Settled by the user:** two buttons — current gameweek and next — for
previewing fixtures only. Points must show as not-yet-available. Arrows come
off.

---

## Decisions

**D1 · #3 — two buttons, fixtures only.** Current gameweek and next, no
arrows. Opponents already change; the fix is everything else: points must read
as not-yet-available when previewing a future gameweek, rather than showing
the current one's.

**D2 · #1 — option A, fixed schedule at 06:00 Bangkok.** Vercel Cron reads its
schedule from `vercel.json` at deploy time, so a time picker in the app would
need the job to fire hourly and self-filter — and Hobby allows one run per day
per job, with both slots already used. The alert moves from 01:05 UTC to
**23:00 UTC** (06:00 Bangkok).

_Worth knowing:_ FPL changes prices 01:30–02:30 UTC. The old slot sat 25
minutes before that window; the new one sits 2.5 hours before. More warning,
but the transfer counts the prediction reads are less settled that early, so
calls will be slightly less certain. Asked for deliberately.

**Which alerts fire** becomes configurable, stored with the other Telegram
settings: price rising tonight · price falling tonight · trending up/down
(earlier, less certain) · injury news for squad players · include watchlist.

**D3 · #2 — animate opacity, not transform.** Icons blink by fading, which is
what "กระพริบ" describes and cannot collide with `rotate-[135deg]`. The round
badge on the pitch keeps its expanding ring, which works there.

**D4 · #4 — fixture cells.** Full club abbreviation, H or A beneath it, and
the score tinted dark green for a win, dark red for a loss. _Assumed:_ a draw
stays neutral — it is neither, and colouring it either way would misread.

**D5 · input zoom.** The three Telegram fields share a `field` constant using
`text-xs` (12px); iOS zooms any input under 16px. Every other input in the app
already uses `text-base sm:text-xs`. Same pattern here.

_Interview complete._

---

## Added after the interview

**Team page keeps two buttons, not three.** Market and History. Changing team
already lives on History, and alert settings moved to the navbar, so neither
needed a slot on the pitch header.

**A Notifications button sits before the menu**, opening a log of what was
actually sent to Telegram, grouped by Bangkok date and expandable to the
message as delivered. The alert job used to send and forget, so `lib/
notifications.ts` records each successful send — the nightly run and the test
button both — and prunes past 90 days. Failing to write the log never fails a
delivered alert: the message has already arrived by then.

The list is empty until something sends, since nothing was being recorded
before this.
