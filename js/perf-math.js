// คำนวณ/จัดรูปข้อความของตัวจับเวลา (perf-panel.js) — ตรรกะล้วนๆ เทสต์ใน Node ได้

// เวลาตั้งแต่เริ่มเปิดหน้า (t0) ถึงกิจกรรมสุดท้ายที่ทำให้เนื้อหาเปลี่ยน (ms) — ไม่มีกิจกรรมเลย = 0
export function settledMs(t0, activity = []) {
  const last = activity.length ? Math.max(...activity) : t0;
  return Math.max(0, Math.round(last - t0));
}

// "attendance-grid · 420 ms · 5 คำขอ · 38.4 KB"
export function formatPerfLine({ label, ms, requests, bytes }) {
  const kb = Math.round((bytes / 1024) * 10) / 10;
  return `${label} · ${ms} ms · ${requests} คำขอ · ${kb} KB`;
}