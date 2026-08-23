import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/components/AuthContext';
import PasswordGate from '@/components/PasswordGate';

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
    icon: '/logo.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#38003c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fanta" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-pastel-bg text-[#111318] w-full overflow-x-hidden">
        <AuthProvider>
          <PasswordGate>
            <Navbar />
            <div className="flex-1 w-full">{children}</div>
          </PasswordGate>
        </AuthProvider>
      </body>
    </html>
  );
}
