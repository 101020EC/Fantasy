# ⚽ FPL Radar Pro - Fantasy Premier League Team Viewer & Price Alert

เว็บแอปพลิเคชันสำหรับผู้เล่น **Fantasy Premier League (FPL)** ที่สามารถระบุ **Team ID** เพื่อดึงข้อมูลทีม, แสดงผล 11 ตัวจริงบนผังสนามฟุตบอล (Pitch View), แต้มสะสม, มูลค่าทีม, เงินคงเหลือ พร้อมฟีเจอร์เด่นคือ **ระบบเรดาร์แจ้งเตือนราคานักเตะขึ้นหรือลง (Price Rise & Fall Predictor)** เพื่อช่วยตัดสินใจวางแผนซื้อขายก่อนราคาปรับในรอบดึก

![FPL Radar Pro](https://resources.premierleague.com/premierleague/photo/2023/07/04/55ad42c3-485a-4712-b91c-1e245a47738b/FPL_hub_article.jpg)

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. **🔍 Team ID Search & Quick Switcher**:
   - กรอก FPL Team ID เพื่อดึงข้อมูลทันที
   - บันทึกประวัติทีมที่ดูล่าสุดลงบนเครื่อง (Recent Teams) ทำให้เปิดดูซ้ำได้ในคลิกเดียว
   - มีปุ่มสุ่มดูทีมตัวอย่างสำหรับทดลองระบบ
2. **🏟️ แผนผังสนามฟุตบอล (Interactive Pitch View)**:
   - จัดเรียง 11 ตัวจริงตาม Formation อัตโนมัติ (เช่น 3-4-3, 4-3-3, 3-5-2)
   - ระบุกัปตัน (C), รองกัปตัน (V) และรายชื่อตัวสำรอง 1-4 ด้านล่างสนาม
   - คลิกที่ตัวนักเตะเพื่อดูสถิติเชิงลึก (ฟอร์ม, การถือครอง, ยอดซื้อเข้า/ขายออก, โปรแกรมแข่งล่วงหน้าพร้อมค่าความยาก FDR)
3. **📈 เรดาร์แจ้งเตือนราคาขึ้น/ลง (Price Alerts & Predictor)**:
   - ป้ายเตือน (Badge) บนตัวนักเตะในสนาม (🚀 *ขึ้นคืนนี้*, 🟢 *ขาขึ้น*, ⚠️ *ตกคืนนี้*, 🔴 *ขาลง*)
   - แถบแจ้งเตือนสรุปรายชื่อนักเตะในทีมที่มีความเสี่ยงราคาตกหรือมีโอกาสราคาขึ้นในคืนนี้
4. **📊 หน้าตลาดราคาพรีเมียร์ลีก (Full Market Price Radar)**:
   - ตารางสรุปนักเตะทุกคนในลีก คัดกรองตามตำแหน่ง (GK, DEF, MID, FWD) และค้นหาตามชื่อ
   - มีดัชนีทำนายราคา (Price Momentum Score) พร้อมจำนวนการซื้อ-ขายสุทธิ (Net Transfers)

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Source**: Official Fantasy Premier League REST API (เชื่อมต่อผ่าน Server Route Handlers เพื่อหลีกเลี่ยงปัญหา CORS)
- **Deployment Platform**: [Vercel](https://vercel.com/) + [GitHub](https://github.com/)

---

## 🚀 วิธีการติดตั้งและรันในเครื่อง (Local Development)

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```

2. รันโหมด Development:
   ```bash
   npm run dev
   ```

3. เปิดเบราว์เซอร์แล้วเข้าไปที่ `http://localhost:3000`

---

## 🚢 วิธีการ Deploy ขึ้น GitHub และ Vercel (Step-by-Step)

### ขั้นตอนที่ 1: อัปโหลดโปรเจกต์ขึ้น GitHub
1. สร้าง Repository ใหม่บน [GitHub.com](https://github.com/new) (เช่น ตั้งชื่อว่า `fpl-radar`)
2. รันคำสั่ง Git ในโฟลเดอร์โปรเจกต์:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: FPL Radar Pro Web App"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

### ขั้นตอนที่ 2: Deploy ขึ้น Vercel
1. เข้าไปที่ [Vercel.com](https://vercel.com) แล้วล็อกอินด้วยบัญชี GitHub
2. คลิกปุ่ม **"Add New..."** -> **"Project"**
3. เลือก Repository ที่เพิ่ง Push ขึ้นไป (เช่น `fpl-radar`) แล้วคลิก **"Import"**
4. Vercel จะตรวจจับว่าเป็นโปรเจกต์ **Next.js** อัตโนมัติ โดยไม่ต้องตั้งค่า Build Command เพิ่มเติม
5. คลิกปุ่ม **"Deploy"** รอประมาณ 1-2 นาที คุณจะได้ URL เว็บไซต์พร้อมใช้งานทันที (เช่น `https://fpl-radar.vercel.app`)

---

## ❓ วิธีค้นหา FPL Team ID

1. ล็อกอินเข้าสู่เว็บไซต์ [fantasy.premierleague.com](https://fantasy.premierleague.com)
2. ไปที่แท็บ **'Pick Team'** หรือ **'Points'**
3. เลื่อนลงมาแล้วกดคลิกที่ลิงก์ **'View Gameweek history'**
4. ดูที่ URL บนเบราว์เซอร์ จะมีรูปแบบดังนี้:
   ```text
   https://fantasy.premierleague.com/entry/123456/history
   ```
5. ตัวเลข `123456` คือ **Team ID** ของคุณ
