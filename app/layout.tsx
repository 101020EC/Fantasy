import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/components/AuthContext';
import PasswordGate from '@/components/PasswordGate';

export const metadata: Metadata = {
  title: 'Fanta | Fantasy Premier League Team & Price Radar',
  description:
    'Fanta - เว็บแอปดูทีม Fantasy Premier League ผ่าน Team ID พร้อมเรดาร์แจ้งเตือนราคานักเตะขึ้นหรือลงคืนนี้',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="light">
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
