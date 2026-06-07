// แม่แบบ — copy ไฟล์นี้เป็น `telegram.config.ts` แล้วใส่ค่าจริง
// telegram.config.ts ถูก gitignore ไว้ (ไม่ขึ้น GitHub)
//
// วิธีหาค่า:
//   TELEGRAM_TOKEN  — สร้าง bot กับ @BotFather → ได้ token
//   TELEGRAM_CHAT_ID — เพิ่มบอทเข้ากลุ่ม, พิมพ์ /start@<bot> ในกลุ่ม,
//                      แล้วเรียก https://api.telegram.org/bot<token>/getUpdates ดู chat.id (กลุ่มเป็นเลขติดลบ)
export const TELEGRAM_TOKEN = 'YOUR_BOT_TOKEN';
export const TELEGRAM_CHAT_ID = 'YOUR_CHAT_ID';
