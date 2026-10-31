// สรุปผลงานโค้ชรายเดือน (หน้า print.html): รวมแผนการฝึกซ้อม + เช็คชื่อ + รายงาน + ความครบถ้วน เป็นแถวเดียวต่อโค้ช
// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase) เทสต์ใน Node ได้ — print.js คำนวณตัวเลขรายส่วนเดิมแล้วส่งเข้ามารวมที่นี่
import { ageGroupSortKey } from "./ui-utils.js";

export const WARN_THRESHOLD = 3; // เกินเท่านี้ถือว่าเกินเกณฑ์ (ตรงกับ TRAINING_PLAN_LATE_WARNING_THRESHOLD ที่ใช้เตือนส่งแผนสาย)
export const MAX_FLAGS = 3;

// % ตรงเวลา "จากที่ส่งแล้ว" — ยังไม่ส่งเลย = null (แสดงเป็น "-")
export const onTimePct = (onTime, submitted) => (submitted > 0 ? Math.round((onTime / submitted) * 100) : null);
// สีป้าย % (เกณฑ์เดียวกับของเดิม): ≥ 80 เขียว · 50–79 เหลือง · ต่ำกว่า 50 แดง
export const pctTone = (pct) => (pct === null ? "neutral" : pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger");

const metric = (m = {}) => {
  const onTime = m.onTime ?? 0;
  const late = m.late ?? 0;
  const missing = m.missing ?? 0;
  const submitted = m.submitted ?? onTime + late;
  return { submitted, onTime, late, missing, pct: onTimePct(onTime, submitted) };
};

// ป้ายเรื่องที่ต้องติดตามของโค้ชคนหนึ่ง: เอาเรื่องที่จำนวนมากที่สุด MAX_FLAGS เรื่อง · เกินเกณฑ์ = แดง ไม่เกิน = เหลือง
export function coachFlags({ plan, checkin, report }, threshold = WARN_THRESHOLD) {
  const items = [
    ["ส่งแผนสาย", plan.late],
    ["ไม่ส่งแผน", plan.missing],
    ["เช็คชื่อสาย", checkin.late],
    ["ไม่เช็คชื่อ", checkin.missing],
    ["ส่งรายงานสาย", report.late],
    ["ไม่ส่งรายงาน", report.missing]
  ];
  return items
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FLAGS)
    .map(([label, n]) => ({ text: `${label} ${n}`, tone: n > threshold ? "danger" : "warning" }));
}

// รวมผลรายส่วนเดิม (แถวต่อโค้ชของแผน/เช็คชื่อ/รายงาน/ความสอดคล้อง ที่คำนวณใน print.js) เป็นแถวเดียวต่อโค้ช
// planRows = { coach, onTime, late, missing } · checkinRows = { coach, checkinDays, onTime, late, missing } · reportRows = { coach, matchDays, onTime, late, missing }
// consistencyRows = { coach, completePercent } — จับคู่ด้วย coach.id
export function mergeCoachRows({ coaches, planRows = [], checkinRows = [], reportRows = [], consistencyRows = [] }) {
  const byId = (rows) => new Map(rows.map((r) => [r.coach.id, r]));
  const p = byId(planRows);
  const c = byId(checkinRows);
  const r = byId(reportRows);
  const k = byId(consistencyRows);
  return coaches.map((coach) => {
    const pr = p.get(coach.id);
    const cr = c.get(coach.id);
    const rr = r.get(coach.id);
    const plan = metric(pr);
    const checkin = metric(cr && { ...cr, submitted: cr.checkinDays });
    const report = metric(rr && { ...rr, submitted: rr.matchDays });
    return {
      coach,
      plan,
      checkin,
      report,
      completePercent: k.get(coach.id)?.completePercent ?? null,
      issues: plan.late + plan.missing + checkin.late + checkin.missing + report.late + report.missing,
      flags: coachFlags({ plan, checkin, report })
    };
  });
}

// เรียงแถว: byAge = ตามรุ่นอายุแล้วชื่อ (แบบเดิม) · ไม่ใช่ = โค้ชที่มีเรื่องต้องติดตามมากที่สุดขึ้นก่อน (เท่ากันเรียงตามรุ่นอายุ)
export function sortCoachRows(rows, byAge = false) {
  const age = (a, b) => ageGroupSortKey(a.coach.ageGroups || []) - ageGroupSortKey(b.coach.ageGroups || []) || String(a.coach.name ?? "").localeCompare(String(b.coach.name ?? ""), "th");
  return [...rows].sort(byAge ? age : (a, b) => b.issues - a.issues || age(a, b));
}

// ตัวเลขหลักของทีม: % ตรงเวลาจากที่ส่งแล้วทั้งทีม (รวมทุกโค้ช ไม่ใช่เฉลี่ย % ของแต่ละคน)
export function teamKpis(rows) {
  const sum = (key, f) => rows.reduce((s, r) => s + r[key][f], 0);
  return {
    coaches: rows.length,
    planPct: onTimePct(sum("plan", "onTime"), sum("plan", "submitted")),
    checkinPct: onTimePct(sum("checkin", "onTime"), sum("checkin", "submitted")),
    reportPct: onTimePct(sum("report", "onTime"), sum("report", "submitted"))
  };
}

// หัวข้อที่เลือกพิมพ์ได้ (ค่าเริ่มต้น + อ่านค่าที่จำไว้) — ค่าที่เก็บเสียหายหรือไม่ครบใช้ค่าเริ่มต้นแทน
export const PRINT_SECTIONS = ["coaches", "trends", "topics", "matches", "injuries"];
export const DEFAULT_PRINT_OPTIONS = { coaches: true, trends: true, topics: false, matches: true, injuries: true, byAge: false };
export function readPrintOptions(raw) {
  let saved = {};
  try {
    saved = JSON.parse(raw ?? "{}") || {};
  } catch {
    saved = {};
  }
  return Object.fromEntries(Object.entries(DEFAULT_PRINT_OPTIONS).map(([k, v]) => [k, typeof saved[k] === "boolean" ? saved[k] : v]));
}