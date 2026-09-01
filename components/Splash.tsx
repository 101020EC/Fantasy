import React from 'react';

/**
 * The Premier League lion, as it ships in FPL's own `pl-logo-fantasy.svg`.
 *
 * This replaces a 32KB raster trace whose face read more sloth than lion. One
 * path, ~2.2KB, and — being a vector — it is the only form that can be drawn a
 * stroke at a time.
 */
const LION_PATH =
  'M8.601 4.427c2.385 1.073 3.915 2.431 4.194 2.637-.127-.607-.596-3.521-.867-5.333 1.39.95 4.616 3.15 5.676 3.866.432-1.31 1.93-5.59 1.93-5.59s2.706 4.309 3.169 5.01c.566-.582 3.802-4.12 4.638-5.017.142 2.036.333 4.95.378 5.387.167-.217 1.404-1.924 3.481-3.498-.9 1.742-1.328 4.15-1.521 6.083a24.181 24.181 0 0 0-6.42-.863 23.995 23.995 0 0 0-11.735 3.04c-.63-1.865-1.614-4.188-2.923-5.722Zm32.656 36.75-1.88-2.048c-.538 5.531-3.29 10.226-8.35 13.5l-.77-2.984c-4.296 3.053-11.667 5.03-17.998 1.51.785-3.944 1.482-7.938-.015-12.724-3.505 5.337-6.61 7.428-6.61 7.428C3.267 41.95 3.48 34.103 4.186 31.793L.243 32.995c0-2.636 1.932-8.23 4.727-11.37l-2.464-.387a22.903 22.903 0 0 1 7.225-8.44h.003c-.917 1.427-.93 4.94 1.76 6.28-1.143-1.968-1.28-4.399-.09-5.66 1.196-1.268 3.201-.833 4.482.153-.381-1.098-1.498-2.48-3.172-2.574h-.002a23.314 23.314 0 0 1 10.547-2.5c.709 0 1.411.03 2.104.092h.001c1.104.437 2.726 1.966 3.482 2.918 0 0 .053-1.122-.581-2.476 4.112.982 6.07 2.627 6.893 3.424.169 1.744.7 2.794 1.405 4.456-1.333-1.468-4.68-3.834-6.276-4.401 0 0-.132 1.514-.681 2.243-3.18-2.258-4.744-2.824-4.744-2.824-3.494.49-5.74 1.816-6.958 2.856l1.062.89c-2.105.638-3.473 2.417-3.473 2.417.014.03 1.88.293 1.88.293s-.19 2.155 2.555 3.507c2.349 1.156 5.731-.278 8.914.977-2.094-2.375-3.537-3.438-3.537-3.438s-.834-.17-1.42-.166c-.73.005-1.818.147-3.016-.311-.57-.218-1.235-.606-1.758-.928 0 0 1.47-1.484 3.615-1.812 0 0 1.935.536 3.47 1.652 1.02-.977 2.084-.947 2.084-.947s-1.054.97-.736 2.141c1.535 1.344 3.196 3.267 3.196 3.267 1.693-.913 5.373-.704 6.13.159-.959-1.22-2.34-2.24-3.408-3.113-.13-.457-1.296-2.054-1.492-2.2 0 0 1.109.337 2.097 1.21.286-.399.816-.805 1.542-.983.746.614.877 1.557.857 1.716-.337.392-.666.555-.666.555l1.792 1.907.179-1.368c4.13 5.798 6.383 12.516 3.484 20.965l.002.001Zm-7.79-12.497-.005-2.997s-1.36-.431-2.817-1.54c-2.921.434-6.46 3.324-6.46 3.324s1.197 2.23 2.503 4.635c2.3.311 5.686-2.539 6.778-3.422Zm2.938 5.438s-.234-1.24-1.234-2.4l-2.278.056s-3.075 2.598-4.95 2.658c0 0 1.033 1.891 1.552 2.877 1.034-.22 2.85-1.023 3.58-1.858 0 0 .484 1.533.391 3.341 1.027-.589 2.444-2.172 2.94-4.675v.001Zm.936-9.855a14.694 14.694 0 0 1-2.124 1.479l.01 3.011c.824.901 1.636 1.65 2.243 3.01 1.15-2.036.933-5.037-.129-7.5Z';

/**
 * Open-app splash: the outline draws itself, the purple floods in behind it,
 * the crown wipes to gold, then the whole mark lifts away. Once per session.
 *
 * A server component, not a client one — it has to be in the HTML that arrives.
 * A client component mounts after hydration, so the app would paint first and
 * then be covered, which reads as a bug.
 *
 * The draw uses stroke-dashoffset, which is the one part of this that the
 * compositor cannot own: it runs on the same main thread that is hydrating.
 * That is the deliberate cost of drawing rather than fading. It is kept to a
 * single path, and pointer-events: none from the first frame means the app
 * underneath stays usable however long the animation takes.
 */
export default function Splash() {
  return (
    <div id="splash" aria-hidden="true">
      {/* viewBox measured from the path's own getBBox (0.24, 0, 42.32, 53.03) with
          half a stroke-width of padding on each side, so the outline is not
          clipped while it draws. */}
      <svg id="splash-lion" viewBox="-0.7 -0.7 43.7 54.4" preserveAspectRatio="xMidYMid meet">
        <defs>
          <path id="splash-lion-path" d={LION_PATH} />
          {/* The crown is the top of the same silhouette, so the gold is that
              silhouette clipped to its own top band rather than a second
              drawing of it. */}
          <clipPath id="splash-crown-clip">
            <rect x="-0.7" y="-0.7" width="43.7" height="10.6" />
          </clipPath>
        </defs>
        <use href="#splash-lion-path" className="lion-line" />
        <use href="#splash-lion-path" className="lion-fill" />
        <g clipPath="url(#splash-crown-clip)">
          <use href="#splash-lion-path" className="lion-crown" />
        </g>
      </svg>
      <i className="sp" style={{ ['--x' as string]: '14%', ['--y' as string]: '17%', ['--s' as string]: '18px', ['--d' as string]: '900ms' }} />
      <i className="sp" style={{ ['--x' as string]: '82%', ['--y' as string]: '13%', ['--s' as string]: '13px', ['--d' as string]: '1040ms' }} />
      <i className="sp" style={{ ['--x' as string]: '88%', ['--y' as string]: '78%', ['--s' as string]: '20px', ['--d' as string]: '970ms' }} />
      <i className="sp" style={{ ['--x' as string]: '9%', ['--y' as string]: '71%', ['--s' as string]: '12px', ['--d' as string]: '1160ms' }} />
      <i className="sp" style={{ ['--x' as string]: '73%', ['--y' as string]: '46%', ['--s' as string]: '10px', ['--d' as string]: '1240ms' }} />
      <i className="sp" style={{ ['--x' as string]: '21%', ['--y' as string]: '52%', ['--s' as string]: '11px', ['--d' as string]: '1300ms' }} />
    </div>
  );
}
