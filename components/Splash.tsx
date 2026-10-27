import React from 'react';
import Logo from './Logo';

/**
 * Open-app splash: the F mark on white, settling in and fading out. Once per
 * session.
 *
 * A server component, not a client one — it has to be in the HTML that arrives.
 * A client component mounts after hydration, so the app would paint first and
 * then be covered, which reads as a bug.
 *
 * Only opacity and transform animate, both owned by the compositor, so it never
 * competes with hydration; pointer-events: none from the first frame keeps the
 * app underneath usable throughout.
 */
export default function Splash() {
  return (
    <div id="splash" aria-hidden="true">
      <div id="splash-mark">
        <Logo className="w-full h-full" title="" />
      </div>
    </div>
  );
}
