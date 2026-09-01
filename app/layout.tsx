import type { Metadata, Viewport } from 'next';
import './globals.css';
import Splash from '@/components/Splash';
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

            The mark used to be two webp files, which this script also had to preload.
            It is inline SVG now — already in this HTML — so there is nothing left to
            fetch and nothing to prioritise. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('fanta_splash')){document.documentElement.dataset.splash='done'}else{sessionStorage.setItem('fanta_splash','1')}}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-pastel-bg text-[#111318] w-full overflow-x-hidden">
        <Splash />
        <AuthProvider>
          <Navbar />
          <div className="flex-1 w-full">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
