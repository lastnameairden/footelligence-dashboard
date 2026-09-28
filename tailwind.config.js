// Tailwind v3 config — ใช้สร้าง css/tailwind.css (ไฟล์ที่ commit ไว้ใน repo) แทนการโหลดสคริปต์ cdn.tailwindcss.com
// ตอนใช้งานจริงบนทุกหน้า (ตัว CDN เป็นเครื่องมือ dev: ช้า กระพริบตอนโหลด ผูกกับบริการภายนอก และบังคับให้ต้องเปิด
// script-src จากโดเมนภายนอกใน CSP)
//
// วิธีสร้างไฟล์ใหม่หลังเพิ่ม/แก้ class ของ Tailwind ใน *.html หรือ js/*.js (รันที่โฟลเดอร์นี้):
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i css/tailwind.input.css -o css/tailwind.css --minify
// แล้ว commit css/tailwind.css ด้วย (Vercel deploy ไฟล์ static ตรงๆ ไม่มีขั้นตอน build) — ไม่ต้องติดตั้ง
// เครื่องมือค้างไว้ในโฟลเดอร์ เพราะ npx โหลดมาใช้ชั่วคราว
//
// class ของ Tailwind ที่ต้องมีให้ครบต้องเขียนเป็นสตริงเต็มในโค้ด (เช่น "bg-emerald-50") ห้ามต่อสตริงแบบ
// `bg-${color}-50` เพราะตัวสแกนมองไม่เห็น class ที่ประกอบขึ้นตอนรัน
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  theme: { extend: {} },
  plugins: []
};
