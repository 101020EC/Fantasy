import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/components/AuthContext';

export const metadata: Metadata = {
  title: 'Fanta | Fantasy Premier League Team & Price Radar',
  description:
    'Fanta - Fantasy Premier League live team tracker with nightly price change radar and history archive.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fanta',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available: blocking it fails WCAG 1.4.4, and the iOS
  // input auto-zoom it was meant to stop is already handled by text-base inputs.
  viewportFit: 'cover',
  themeColor: '#38003c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning covers this one element, not its descendants. It is
    // required because the head script below always writes data-splash before React
    // hydrates, and React 19 flags extra attributes, not only props the server rendered.
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fanta" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Must run before the first frame is painted, or a returning visitor sees the
            splash flash on every refresh. Only JS can read sessionStorage; CSS cannot.

            It writes data-splash rather than appending to className: className is a prop
            the server rendered, so touching it mismatches on every hydration.

            When the splash is skipped its images are not preloaded either — that 38KB of
            priority belongs to the CSS and JS that actually render the page. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('fanta_splash')){document.documentElement.dataset.splash='done'}else{sessionStorage.setItem('fanta_splash','1');for(var s of ['/splash-logo.webp','/splash-crown.webp']){var l=document.createElement('link');l.rel='preload';l.as='image';l.href=s;l.fetchPriority='high';document.head.appendChild(l)}}}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-pastel-bg text-[#111318] w-full overflow-x-hidden">
        {/*
          Open-app splash: the logo scales in, the crown wipes to gold, then the whole
          mark lifts and fades out. Runs once per session.

          Plain HTML in the layout rather than a client component: a component mounts
          after hydration, so the app would paint first and then be covered, which reads
          as a bug.

          CSS gives it pointer-events: none from the first frame, so the app underneath
          stays touchable throughout. app/page.tsx already shows a skeleton while its
          four fetches run, so this covers dead time that existed anyway — it does not
          add any new waiting.
        */}
        <div id="splash" aria-hidden="true">
          <div id="splash-logo">
            {/* background-image, not <img>. Chrome does not defer an <img loading="lazy">
                that has no layout box: it fetches immediately even when the parent is
                display: none, which made every later session pay the 38KB for nothing.
                A background-image on a display: none element is never fetched, so the
                skip path costs zero. Sizing and placement live in globals.css. */}
            <div id="splash-mark">
              <div className="splash-body" />
              <div id="splash-crown" />
            </div>
          </div>
          <i className="sp" style={{ ['--x' as string]: '14%', ['--y' as string]: '17%', ['--s' as string]: '18px', ['--d' as string]: '120ms' }} />
          <i className="sp" style={{ ['--x' as string]: '82%', ['--y' as string]: '13%', ['--s' as string]: '13px', ['--d' as string]: '260ms' }} />
          <i className="sp" style={{ ['--x' as string]: '88%', ['--y' as string]: '78%', ['--s' as string]: '20px', ['--d' as string]: '190ms' }} />
          <i className="sp" style={{ ['--x' as string]: '9%', ['--y' as string]: '71%', ['--s' as string]: '12px', ['--d' as string]: '380ms' }} />
          <i className="sp" style={{ ['--x' as string]: '73%', ['--y' as string]: '46%', ['--s' as string]: '10px', ['--d' as string]: '460ms' }} />
          <i className="sp" style={{ ['--x' as string]: '21%', ['--y' as string]: '52%', ['--s' as string]: '11px', ['--d' as string]: '520ms' }} />
        </div>
        <AuthProvider>
          <Navbar />
          <div className="flex-1 w-full">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
