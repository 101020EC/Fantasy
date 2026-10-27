# Plan — mobile bottom tab bar, new logo, minimal redesign (grill 2026-10-27)

Request: "ในมือถือเพิ่มแถบเมนูด้านล่างโดยมี Team History Market Analyst และ More (รวมระบบที่เหลือ)
เปลี่ยนโลโก้ เปลี่ยนดีไซน์เว็บเป็นแนวมินิมอล"

Status key: **OPEN** · **DECIDED** · **DONE**

## Today
- Navigation: one hamburger dropdown at every width (`components/Navbar.tsx`) with nine
  colour-coded rows — Team, History, Market, Analyst, Elite, Alert (Telegram modal), Back Up,
  Status, Log out — plus a bell button (notifications modal) and a desktop-only Team ID search.
- Logo: crowned sloth on a lime-to-green gradient — `public/logo-mark.webp` (navbar),
  `icon-192/512.png`, `apple-touch-icon.png`, `logo.png`; the splash uses an inline SVG mark
  (`components/Splash.tsx`). `themeColor` `#38003c`.
- Look: pastel palette (`tailwind.config.ts` `pastel.*`, `bg-pastel-bg` #f4f6fb), FPL purple
  `#38003c` in 67 places, `font-black` in 219, `rounded-2xl/3xl` cards, 88 shadows.
- Pages: `/` History, `/team/[id]/[gw]`, `/prices` Market, `/analyst`, `/elite`, `/elite/[id]`,
  `/backup`, `/status`, `/login`.

## Decisions

**M1 · Direction — DECIDED: black/white/grey + one accent, FPL purple `#38003c`.** White and
very light grey surfaces, near-black text, hairline borders instead of shadows, smaller radii,
semibold instead of black weight. Purple only for the primary action and the selected tab.
Green/red only where they carry meaning (price up/down, available/flagged) — no decorative
per-section colours (the menu's emerald/orange/sky/indigo rows go).

**M2 · Logo — DECIDED: "F" monogram.** Rounded square in FPL purple `#38003c` with a white
geometric F, drawn as inline SVG (one source for navbar, splash, favicon and the PNG home-screen
icons rendered from it). The sloth is retired everywhere, including `logo-mark.webp`/`logo.png`.

**M3 · Breakpoints — DECIDED: bottom tab bar on phones only; larger screens keep the hamburger.**
Below 768px (`md`): a fixed bottom bar with Team · History · Market · Analyst · More, and the
header shrinks to logo + bell (the hamburger is hidden). From 768px up: no bottom bar; the
existing hamburger dropdown stays, restyled minimal (M1).

**M4 · More — DECIDED: its own page, `/more`.** A full page (works at any width) listing
Team ID search (phones have none today), Elite, Alerts (opens the Telegram settings modal),
Back Up, Status, Log out. The More tab is also highlighted on `/elite`, `/elite/[id]`,
`/backup` and `/status`, so the bar always shows where you are.
- From the code: tabs are icon + short label (labels keep them readable and accessible);
  Team goes to the saved team (`/?switch=true` when none), as the menu does today; the bar
  sits above `env(safe-area-inset-bottom)` and pages get matching bottom padding.

**M5 · Rollout — DECIDED: the whole app in one release.** Shell (tab bar, header, `/more`,
logo, icons, tokens) and every page and modal restyled together, deployed once.

**M6 · Pitch — DECIDED: flat green.** One solid grass green, no stripes or gradients, thin
white markings; player cards on it go flat (no shadows). The only large block of colour in
the app, on purpose.

**M7 · Dark mode — DECIDED: light only this round.** Colours go through CSS variables/tailwind
tokens so a dark theme can be added later without touching every page again.

**M8 · Settled from the code (no user input needed).**
- Font stays the system stack (SF Pro on iPhone) — already minimal, no web-font download.
  Weights: 600 for headings and numbers, 400/500 body; `font-black` (219 uses) goes.
- Tokens: `--bg` #fafafa, `--surface` #fff, `--text` #111318, `--muted` #6b7280,
  `--line` #e5e7eb, `--accent` #38003c, `--up` green, `--down` red. The `pastel.*` palette is
  removed from `tailwind.config.ts` once nothing uses it. Radii 8–12px, no decorative shadows
  (one soft shadow for modals/sheets only).
- Splash: the F monogram on white, a short fade — no sloth artwork. `themeColor` becomes
  #ffffff to match the white header.
- Icons: `icon-192/512.png` and `apple-touch-icon.png` regenerated from the F SVG (no ffmpeg
  here — render with a Swift/AppKit or Pillow script); `logo-mark.webp`/`logo.png` deleted.
  iPhone users must remove and re-add the home-screen icon to see it.
- Bottom bar hidden on `/login`; modals and the bar never overlap (modals sit above it).
- Verification: dev server + the built-in browser at 375px and desktop width, every page.

_Interview complete — M1–M8 decided._

## Implementation (2026-10-27)
- Tokens in `app/globals.css` `:root` (`--bg`, `--surface`, `--text`, `--muted`, `--line`,
  `--accent`, `--accent-soft`, `--up`, `--down`, `--pitch`, `--tabbar-h`); `.pastel-card` is now
  the one flat card, `.pastel-pitch` flat green. Tailwind's `pastel.*`/`fpl.*` colours and radius
  overrides removed.
- Sweep over every page/component: `font-black/extrabold` → semibold, `font-bold` → medium,
  decorative shadows dropped (one soft shadow on modals and the desktop menu), radii → `xl`,
  decorative purple/indigo/sky/amber section colours → neutral or accent.
- Kept on purpose because they carry meaning: green/red rise/fall, amber/orange availability,
  FDR fixture colours, pink watchlist, sky squad-row highlight.
- `components/Logo.tsx` (F mark) + `scripts/render-icons.py` → `icon-192/512.png`,
  `apple-touch-icon.png`, `favicon-64.png`; sloth files deleted.
- `components/nav-items.ts` is the single list for `TabBar.tsx` (phones), the desktop menu in
  `Navbar.tsx`, and `app/more/page.tsx`.
- Checked in the built-in browser at 375px (Team, History, Market, Analyst, More, Elite, Backup,
  Status, login, player modal, splash) and 1024px (menu); no console errors after a clean
  reload; `npm test` 46 pass; build passes.
