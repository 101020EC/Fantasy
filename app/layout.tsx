import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthContext';
import PasswordGate from '@/components/PasswordGate';

export const metadata: Metadata = {
  title: 'FPL Radar Pro | Fantasy Premier League Team Viewer & Price Predictor',
  description:
    'เว็บแอปดูทีม Fantasy Premier League ผ่าน Team ID พร้อมเรดาร์แจ้งเตือนราคานักเตะขึ้นหรือลงคืนนี้',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
        <AuthProvider>
          <PasswordGate>
            <ThemeProvider>
              <Navbar />
              <div className="flex-1 w-full">{children}</div>
            </ThemeProvider>
          </PasswordGate>
        </AuthProvider>
      </body>
    </html>
  );
}
