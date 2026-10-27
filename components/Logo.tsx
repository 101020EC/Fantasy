import React from 'react';

/**
 * The Fanta mark: a white geometric F on an FPL-purple rounded square.
 *
 * One drawing for every place the brand appears — navbar, splash, login,
 * empty states — and the source the home-screen PNGs are rendered from
 * (scripts/render-icons.py draws the same rectangles). Inline SVG, so it costs
 * no request and stays sharp at any size.
 */
export const LOGO_ACCENT = '#38003c';

/** The F, in a 512 box: stem, top bar, middle bar. Shared with the icon script. */
export const F_RECTS = [
  { x: 156, y: 120, w: 76, h: 272 },
  { x: 156, y: 120, w: 208, h: 72 },
  { x: 156, y: 226, w: 164, h: 66 },
] as const;

export default function Logo({
  className = 'w-8 h-8',
  title = 'Fanta',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label={title}>
      <rect width="512" height="512" rx="120" fill={LOGO_ACCENT} />
      {F_RECTS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="6" fill="#ffffff" />
      ))}
    </svg>
  );
}
