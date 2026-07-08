// ---------- ระบบให้คะแนนรายวัน 4 ด้าน ----------
// ใช้ร่วมกันทั้งหน้าโค้ช (attendance.js) และ Dashboard (app.js) เพื่อให้คำนวณ
// "ประเมินครบหรือยัง" และ "คะแนนเฉลี่ย" ตรงกันทุกจุด
export const SCORE_CATEGORIES = [
  { key: "physical", label: "สมรรถภาพทางกายและการเคลื่อนไหว", short: "1. สมรรถภาพร่างกาย" },
  { key: "ballSkill", label: "ความสัมพันธ์กับลูกฟุตบอล", short: "2. ทักษะบอล" },
  { key: "gameReading", label: "การอ่านเกมและการรับรู้", short: "3. อ่านเกม/การรับรู้" },
  { key: "attitude", label: "ทัศนคติและความทุ่มเท", short: "4. ทัศนคติ/ความทุ่มเท" }
];

// คะแนนเฉลี่ยจากด้านที่กรอกแล้ว (ไม่ต้องครบ 4 ด้านก็คำนวณได้ อัปเดตสดตามที่กรอก)
export function computeAvgScore(scores) {
  if (!scores) return null;
  const values = SCORE_CATEGORIES.map((c) => scores[c.key]).filter((v) => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// นับว่า "ประเมินครบ" เมื่อมีสถานะแล้ว และถ้ามาซ้อมจริง (A) ต้องให้คะแนนครบทั้ง 4 ด้าน
// (I/R/P ไม่ต้องให้คะแนน เพราะไม่ได้ร่วมฝึกซ้อมจริงในวันนั้น)
export function isPlayerFullyEvaluated(record) {
  if (!record || !record.status) return false;
  if (record.status !== "A") return true;
  const scores = record.scores || {};
  return SCORE_CATEGORIES.every((c) => typeof scores[c.key] === "number");
}

// เติม data-label ให้แต่ละ <td> อัตโนมัติจากหัวตาราง (thead th) ของ <table> เดียวกัน
// ใช้คู่กับ CSS ใน styles.css ที่แปลงตารางเป็นรูปแบบการ์ดบนจอมือถือ (iOS/Android)
export function applyDataLabels(tbody) {
  if (!tbody) return;
  const table = tbody.closest("table");
  if (!table) return;
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
  Array.from(tbody.children).forEach((tr) => {
    const cells = Array.from(tr.children);
    if (cells.length === 1 && cells[0].hasAttribute("colspan")) return;
    cells.forEach((td, i) => {
      if (headers[i]) td.setAttribute("data-label", headers[i]);
    });
  });
}
