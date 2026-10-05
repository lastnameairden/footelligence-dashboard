// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ของรายงานอาการบาดเจ็บแบบละเอียด (Sports Science 1.2)
//
// ฟิลด์ใหม่ใน injuryReports (ทุกช่องเว้นว่างได้ ข้อมูลเดิมที่ไม่มีช่องเหล่านี้ยังใช้ได้ตามปกติ):
//   bodyRegion, side, injuryType, mechanism, context, isRecurrence, actualReturnDate, progressNotes[{date,note,by}]
// สถานะที่เก็บ (status) ยังเป็นคำเดิม 4 แบบ (บาดเจ็บขณะแข่งขัน/บาดเจ็บขณะฝึกซ้อม/กำลังพักฟื้น/หายแล้ว) เพราะหลายจุดทั่วระบบเช็คค่านี้อยู่
// (ป้ายสถานะ กระดิ่ง เช็คชื่อ) — ฟอร์มแยกให้กรอกเป็น "เกิดที่ไหน (context)" กับ "สถานะ" แล้วประกอบเป็นค่าเดิมตอนบันทึก
// ส่วนจำนวนวันที่หยุดไม่เก็บ คำนวณจากวันที่บาดเจ็บ → วันที่กลับมาซ้อมจริงทุกครั้งที่แสดง

export const BODY_REGIONS = [
  "ศีรษะ/คอ",
  "ไหล่/แขน",
  "ลำตัว/หลัง",
  "สะโพก/ขาหนีบ",
  "ต้นขาหน้า",
  "ต้นขาหลัง",
  "เข่า",
  "หน้าแข้ง/น่อง",
  "เอ็นร้อยหวาย",
  "ข้อเท้า",
  "เท้า"
];
export const SIDES = ["ซ้าย", "ขวา", "ไม่เกี่ยวข้อง"];
export const INJURY_TYPES = ["กล้ามเนื้อ", "เอ็น/ข้อต่อ", "กระดูก", "ฟกช้ำ/แผล", "ศีรษะ/สมอง", "อื่นๆ"];
export const MECHANISMS = ["ปะทะ", "ไม่ปะทะ", "ใช้งานหนักสะสม"];
export const CONTEXTS = ["แข่ง", "ซ้อม", "อื่นๆ"];
// สถานะที่โค้ชเลือกในฟอร์ม (ไม่ปนกับ "เกิดที่ไหน")
export const FORM_STATUSES = ["บาดเจ็บ", "กำลังพักฟื้น", "หายแล้ว"];

const STORED_IN_MATCH = "บาดเจ็บขณะแข่งขัน";
const STORED_IN_TRAINING = "บาดเจ็บขณะฝึกซ้อม";
const STORED_RECOVERING = "กำลังพักฟื้น";
const STORED_HEALED = "หายแล้ว";

// สถานะในฟอร์ม + เกิดที่ไหน → สถานะที่เก็บ (คำเดิม)
export function storedStatusFor(formStatus, context) {
  if (formStatus === "บาดเจ็บ") return context === "แข่ง" ? STORED_IN_MATCH : STORED_IN_TRAINING;
  return formStatus;
}

// สถานะที่เก็บ → สถานะในฟอร์ม (ใช้ตอนเปิดแก้ไขรายงานเดิม)
export function formStatusFor(storedStatus) {
  if (storedStatus === STORED_IN_MATCH || storedStatus === STORED_IN_TRAINING) return "บาดเจ็บ";
  return FORM_STATUSES.includes(storedStatus) ? storedStatus : "บาดเจ็บ";
}

// เกิดที่ไหน: ใช้ค่าที่บันทึกไว้ ถ้าเป็นรายงานเก่าให้เดาจากสถานะเดิม (ไม่มีข้อมูล = null)
export function contextFor(report) {
  if (CONTEXTS.includes(report.context)) return report.context;
  if (report.status === STORED_IN_MATCH) return "แข่ง";
  if (report.status === STORED_IN_TRAINING) return "ซ้อม";
  return null;
}

function dayNumber(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const n = dayNumber(toDate) - dayNumber(fromDate);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// จำนวนวันที่หยุด: หายแล้วและมีวันที่กลับมาซ้อมจริง = วันบาดเจ็บ → วันกลับ; ยังไม่หาย = นับถึงวันนี้ (แสดงเป็น "ผ่านมาแล้ว" ไม่ใช่ตัวเลขสุดท้าย)
export function injuryDaysOut(report, todayStr) {
  if (report.status === STORED_HEALED) {
    const n = diffDays(report.date, report.actualReturnDate);
    return n === null ? null : { days: n, final: true };
  }
  const n = diffDays(report.date, todayStr);
  return n === null ? null : { days: n, final: false };
}

// บาดเจ็บซ้ำ: นักกีฬาคนเดิม ตำแหน่งเดียวกัน ข้างเดียวกัน และเกิดก่อนรายงานนี้ — คืนรายงานก่อนหน้าล่าสุดที่เข้าเงื่อนไข (ไม่มี = null)
export function detectRecurrence(reports, { playerId, bodyRegion, side, date, excludeId }) {
  if (!playerId || !bodyRegion) return null;
  return (
    reports
      .filter(
        (r) =>
          r.id !== excludeId &&
          r.playerId === playerId &&
          r.bodyRegion === bodyRegion &&
          (r.side || null) === (side || null) &&
          (!date || (r.date || "") < date)
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null
  );
}

// ป้ายรายละเอียดสั้นๆ ใต้อาการในตารางรายการ + ข้อความจำนวนวันที่หยุด
export function injuryDetailLabels(report, todayStr) {
  const tags = [];
  if (report.bodyRegion) tags.push(report.side && report.side !== "ไม่เกี่ยวข้อง" ? `${report.bodyRegion} (${report.side})` : report.bodyRegion);
  if (report.injuryType) tags.push(report.injuryType);
  if (report.mechanism) tags.push(report.mechanism);
  const ctx = contextFor(report);
  if (ctx && report.context) tags.push(`เกิดที่${ctx}`);
  if (report.isRecurrence) tags.push("บาดเจ็บซ้ำ");
  const out = injuryDaysOut(report, todayStr);
  let daysText = "";
  if (out) daysText = out.final ? `หยุดไป ${out.days} วัน` : `ผ่านมา ${out.days} วัน (ยังไม่หาย)`;
  return { tags, daysText };
}

function countBy(items, keyOf) {
  const map = new Map();
  for (const it of items) {
    const key = keyOf(it);
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// เก็บ top N ที่เหลือรวมเป็น "อื่นๆ"
function topWithOther(list, n) {
  if (list.length <= n) return list;
  const rest = list.slice(n).reduce((sum, x) => sum + x.count, 0);
  return [...list.slice(0, n), { label: "อื่นๆ (ตำแหน่งที่เหลือ)", count: rest }];
}

// สถิติรวมของรายงานชุดหนึ่ง (เดือน/รุ่น/ทีมที่ผู้เรียกกรองมาแล้ว) — หยุดเฉลี่ยนับเฉพาะที่หายแล้วและมีวันกลับมาซ้อมจริง
export function buildInjuryStats(reports) {
  const total = reports.length;
  const finals = reports.map((r) => injuryDaysOut(r, null)).filter((o) => o && o.final);
  const avgDaysOut = finals.length > 0 ? finals.reduce((s, o) => s + o.days, 0) / finals.length : null;
  const recurrence = reports.filter((r) => r.isRecurrence).length;
  return {
    total,
    active: reports.filter((r) => r.status !== STORED_HEALED).length,
    avgDaysOut,
    avgDaysOutSample: finals.length,
    recurrence,
    recurrencePercent: total > 0 ? Math.round((recurrence / total) * 100) : 0,
    byRegion: topWithOther(countBy(reports, (r) => r.bodyRegion), 6),
    byMechanism: countBy(reports, (r) => r.mechanism),
    byContext: countBy(reports, (r) => contextFor(r)),
    withRegion: reports.filter((r) => r.bodyRegion).length
  };
}
