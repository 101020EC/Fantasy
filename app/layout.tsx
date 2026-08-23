import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

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
    <html lang="th" className="dark">
      <body className="bg-[#0d0118] text-gray-100 antialiased min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
