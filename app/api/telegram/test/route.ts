import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { botToken, chatId, teamName, teamId } = await req.json();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ Telegram Bot Token และ Chat ID' },
        { status: 400 }
      );
    }

    const message = `🔔 *ทดสอบการเชื่อมต่อ FPL Radar Pro สำเร็จ!*\n\n` +
      `⚽ *ทีม:* ${teamName || `Team #${teamId || 'FPL'}`}\n` +
      `📊 *สถานะ:* ระบบแจ้งเตือนราคานักเตะ Fantasy Premier League พร้อมทำงานแล้ว\n\n` +
      `_ระบบจะส่งข้อความแจ้งเตือนเมื่อนักเตะในทีมของคุณมีความเสี่ยงราคาตกหรือขึ้นในรอบดึก_ 🚀`;

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const result = await telegramRes.json();

    if (!telegramRes.ok || !result.ok) {
      return NextResponse.json(
        { error: result.description || 'ไม่สามารถส่งข้อความไปยัง Telegram ได้ กรุณาตรวจสอบ Token และ Chat ID' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Telegram' },
      { status: 500 }
    );
  }
}
