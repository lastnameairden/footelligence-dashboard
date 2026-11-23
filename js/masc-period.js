// ชื่อที่แสดงของช่วงประเมิน MASC — ค่าที่เก็บในฐานข้อมูล (mascRounds.label / playerEvaluations.assessmentPeriod) ยังเป็น "ช่วงที่ 1".."ช่วงที่ 4"
// เหมือนเดิม เพราะใช้จับคู่รอบกับผลประเมินเก่า แปลงเป็น "1/2569" เฉพาะตอนแสดงผลบนหน้าจอ/ข้อความแจ้งเตือน
// ขึ้นฤดูกาลใหม่ (เช่น 2570) แก้ที่ค่านี้ที่เดียว

export const MASC_SEASON_YEAR = 2569;

// "ช่วงที่ 2" → "2/2569" — ค่าที่ไม่ใช่รูปแบบนี้ (ว่าง/ค่าเดิมแบบอื่น) คืนตามเดิม
export function mascPeriodName(label, year = MASC_SEASON_YEAR) {
  const m = /^ช่วงที่\s*(\d+)$/.exec(String(label ?? "").trim());
  return m ? `${m[1]}/${year}` : label;
}
