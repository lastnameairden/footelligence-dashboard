// Event ประจำเดือนของแต่ละทีม/โรงเรียน (ตรรกะล้วนๆ + HTML เป็นสตริง ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// โค้ชกรอกเดือนละครั้ง (ภายในวันที่ 25 ของเดือนก่อนหน้า) 1 เอกสารต่อทีมต่อเดือน: monthlyEvents/{ทีม}__{YYYY-MM}
// ช่อง "เดือนนี้ไม่มี Event" แยก "ไม่มี Event" ออกจาก "ลืมกรอก" — ทีมหลังบ้าน/แอดมินดูสถานะของทุกทีมได้ในหน้าเดียว
import { addDaysToDate, addMonthsToMonth } from "./coach-meetings.js";
import { ageGroupSortKey, escapeHtml } from "./ui-utils.js";
import { formatPhone, normalizePhone } from "./player-profile-fields.js";

export const DUE_DAY = 25;
export const DEFAULT_DUE_TIME = "23:59";
export const REMINDER_DAYS = 7; // เริ่มเตือนที่หน้า Home ก่อนกำหนดกี่วัน
// เดือนที่แจ้ง → กำหนดส่งที่ไม่ใช่ค่าปกติ (วันที่ 25 ของเดือนก่อนหน้า เวลา 23:59) — เดือนพฤศจิกายน 2569 ขยายเวลาให้ถึง 28 ต.ค. 14:00
export const DEADLINE_OVERRIDES = { "2026-11": { date: "2026-10-28", time: "14:00" } };
export const MAX_EVENTS = 30;
export const TITLE_MAX = 80;
export const NOTE_MAX = 200;
export const NAME_MAX = 80;

// kind: match = มีจำนวนนัด/วันแข่ง/เหย้า-เยือน/เวลา · exam = ระบุชั้นที่สอบ (ระบบ map เป็นรุ่นให้)
//       change-day / change-time / coach-leave = แจ้งขอเปลี่ยนตารางซ้อม (ไม่มีชื่อรายการ/ผลต่อการซ้อม/นักเตะที่ไม่อยู่ — ชื่อสร้างให้อัตโนมัติ)
export const EVENT_TYPES = [
  { key: "official", label: "แข่งทางการ", kind: "match" },
  { key: "friendly", label: "กระชับมิตร", kind: "match" },
  { key: "festival", label: "Festival" },
  { key: "public-holiday", label: "วันหยุดราชการ" },
  { key: "school-holiday", label: "วันหยุดโรงเรียน" },
  { key: "exam", label: "สอบ", kind: "exam" },
  { key: "camp", label: "ค่าย-ทัศนศึกษา" },
  { key: "school-activity", label: "กิจกรรมโรงเรียน" },
  { key: "venue-busy", label: "สนามไม่ว่าง" },
  { key: "change-day", label: "เปลี่ยนวันซ้อม", kind: "change-day" },
  { key: "change-time", label: "เปลี่ยนเวลาซ้อม", kind: "change-time" },
  { key: "coach-leave", label: "โค้ชลา / ไม่อยู่ซ้อม", kind: "coach-leave" },
  { key: "other", label: "อื่นๆ" }
];
const SCHEDULE_KINDS = ["change-day", "change-time", "coach-leave"];
export const CHANGE_REASONS = ["สนามไม่ว่าง", "ติดกิจกรรมโรงเรียน", "สภาพอากาศ", "โค้ชไม่ว่าง", "อื่นๆ"];
export const LEAVE_CHANGES = ["งดซ้อม", "เลื่อนวันซ้อม", "เปลี่ยนเวลาซ้อม", "ให้รุ่นอื่นซ้อมรวม"];
export const SUBSTITUTE_OPTIONS = [
  { key: "none", label: "ไม่มี" },
  { key: "yes", label: "มี" }
];
export const MAX_MATCHES = 20;
export const MAX_AWAY_PLAYERS = 60;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const IMPACTS = [
  { key: "no-training", label: "งดซ้อม" },
  { key: "partial", label: "ซ้อมได้บางส่วน" },
  { key: "none", label: "ไม่กระทบวันซ้อม" }
];
export const AWAY_MODES = [
  { key: "none", label: "ไม่มี" },
  { key: "all", label: "ทั้งรุ่น" },
  { key: "some", label: "บางคน" }
];
export const VENUES = ["เหย้า", "เยือน"];
export const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => `U${i + 6}`); // U6 … U18
export const ALL_AGES = "ทุกรุ่น";

// ชั้นเรียนที่สอบ → รุ่นอายุ (ป.1 = U7 … ม.6 = U18): ป.n → U(n+6), ม.n → U(n+12)
export const EXAM_LEVELS = [...[1, 2, 3, 4, 5, 6].map((n) => `ป.${n}`), ...[1, 2, 3, 4, 5, 6].map((n) => `ม.${n}`)];
export function ageGroupForLevel(level) {
  const m = /^(ป|ม)\.(\d)$/.exec(String(level));
  if (!m) return null;
  const n = Number(m[2]);
  return `U${m[1] === "ป" ? n + 6 : n + 12}`;
}
export function ageGroupsForExamLevels(levels = []) {
  return [...new Set(levels.map(ageGroupForLevel).filter(Boolean))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

const typeOf = (key) => EVENT_TYPES.find((t) => t.key === key) ?? null;
export const typeLabel = (key) => typeOf(key)?.label ?? "-";
export const impactLabel = (key) => IMPACTS.find((i) => i.key === key)?.label ?? "-";
export const isMatchType = (key) => typeOf(key)?.kind === "match";
export const isExamType = (key) => typeOf(key)?.kind === "exam";
export const kindOfType = (key) => typeOf(key)?.kind ?? "";
export const isScheduleChange = (key) => SCHEDULE_KINDS.includes(kindOfType(key));

// ---------- เดือน / กำหนดส่ง ----------
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const isMonth = (v) => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function monthLabel(month) {
  if (!isMonth(month)) return "-";
  const [y, m] = month.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}
export function dateLabel(date) {
  if (!isDate(date)) return "-";
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
}
export function rangeLabel(start, end) {
  if (!start) return "-";
  return !end || end === start ? dateLabel(start) : `${dateLabel(start)} – ${dateLabel(end)}`;
}

// เดือนที่เลือกแจ้งได้: เดือนก่อน (ไว้แก้ย้อนหลัง) · เดือนนี้ · อีก 2 เดือนข้างหน้า
export function monthOptions(today) {
  const cur = today.slice(0, 7);
  return [-1, 0, 1, 2].map((d) => addMonthsToMonth(cur, d));
}
// ค่าเริ่มต้น: ตั้งแต่วันที่ 15 เป็นต้นไปเป็นช่วงแจ้งเดือนถัดไป ก่อนหน้านั้นยังเป็นเดือนนี้
export function defaultMonth(today) {
  const cur = today.slice(0, 7);
  return Number(today.slice(8, 10)) >= 15 ? addMonthsToMonth(cur, 1) : cur;
}
// 1 เอกสารต่อโค้ช 1 คนต่อเดือน (โค้ชหลายคนในทีมกรอกได้ไม่ทับกัน) — เอกสารแบบเดิมที่กรอกทั้งทีมมี id {ทีม}__{เดือน} และไม่มี coachId
export const eventDocId = (team, month, coachId) => `${team}__${month}__${coachId}`;

// กำหนดส่งของเดือนที่แจ้ง = วันที่ 25 ของเดือนก่อนหน้า (ถึง 23:59) เว้นแต่เดือนนั้นมีกำหนดพิเศษใน DEADLINE_OVERRIDES
export function deadlineFor(month) {
  return DEADLINE_OVERRIDES[month] ?? { date: `${addMonthsToMonth(month, -1)}-${DUE_DAY}`, time: DEFAULT_DUE_TIME };
}
export const dueDateFor = (month) => deadlineFor(month).date;
// "28 ต.ค." หรือ "28 ต.ค. 14:00" (แสดงเวลาเฉพาะกำหนดพิเศษ)
export function deadlineLabel(month) {
  const d = deadlineFor(month);
  return d.time === DEFAULT_DUE_TIME ? dateLabel(d.date) : `${dateLabel(d.date)} ${d.time} น.`;
}
// เวลาปัจจุบันตามเวลาไทย "YYYY-MM-DD HH:MM" (เทียบเป็นสตริงกับกำหนดส่งได้ตรงๆ)
export const bangkokStamp = (now = new Date()) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ");
const deadlineStamp = (month) => {
  const d = deadlineFor(month);
  return `${d.date} ${d.time}`;
};

// ป้ายสถานะการส่งในหน้าโค้ช: submitted = ส่งแล้ว · overdue = เลยกำหนดแล้วยังไม่ส่ง · due = ยังไม่ส่ง (ยังไม่เลยกำหนด)
export function dueInfo({ month, now, submitted }) {
  const due = dueDateFor(month);
  if (submitted) return { state: "submitted", due };
  return { state: now > deadlineStamp(month) ? "overdue" : "due", due };
}

// เตือนที่หน้า Home ของโค้ช: เดือนถัดไปที่ยังไม่ได้แจ้ง — เริ่มเตือนก่อนกำหนด REMINDER_DAYS วัน เตือนต่อจนเลยกำหนดไปแล้วจนสิ้นเดือน (เริ่มเดือนที่แจ้งแล้วหยุดเตือน)
// คืน null = ไม่ต้องเตือน · { month, state: "due" | "overdue", daysLeft } (daysLeft = จำนวนวันถึงวันกำหนด ติดลบ/0 เมื่อเลย/ตรงวัน)
export function eventReminder({ now, submitted }) {
  const date = now.slice(0, 10);
  const month = addMonthsToMonth(date.slice(0, 7), 1);
  if (submitted) return null;
  const { date: dueDay } = deadlineFor(month);
  if (date < addDaysToDate(dueDay, -REMINDER_DAYS)) return null;
  const daysLeft = Math.round((Date.parse(dueDay) - Date.parse(date)) / 86400000);
  return { month, state: now > deadlineStamp(month) ? "overdue" : "due", daysLeft };
}

// ---------- ฟอร์ม ----------
export function emptyEvent() {
  return {
    type: "", title: "", ageGroups: [], start: "", end: "", impact: "", awayMode: "none", awayCount: "", awayPlayers: [], matches: [], practiceNormal: false, practiceStart: "", practiceEnd: "", examLevels: [], note: "",
    reason: "", oldDate: "", newDate: "", oldStart: "", oldEnd: "", newStart: "", newEnd: "", coachId: "", coachName: "", substitute: "none", substituteName: "", changes: [], changeDetail: ""
  };
}
export const emptyMatchRow = () => ({ date: "", venue: "เหย้า", time: "" });

const hasBadChar = (s) => /[<>]/.test(s);
const text = (v) => String(v ?? "").trim();

// ฟอร์ม (ค่าที่อ่านจากหน้าจอ) → { value, errors } — value คือเอกสารที่จะเก็บ (ไม่มีฟิลด์ undefined)
// opts.allowedAgeGroups = รุ่นที่โค้ชคนนี้รับผิดชอบ (ตัวเลือกรุ่นและชั้นที่สอบต้องอยู่ในนี้) — ไม่ระบุ = ไม่จำกัด
export function validateEventForm(form, { allowedAgeGroups = null } = {}) {
  const errors = [];
  const contactName = text(form.contactName);
  if (!contactName) errors.push("กรอกชื่อผู้กรอก");
  else if (contactName.length > NAME_MAX || hasBadChar(contactName)) errors.push(`ชื่อผู้กรอกต้องไม่เกิน ${NAME_MAX} ตัวอักษรและห้ามมี < >`);
  const rawPhone = text(form.contactPhone);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!rawPhone) errors.push("กรอกเบอร์ติดต่อ");
  else if (!phone) errors.push("เบอร์ติดต่อไม่ถูกต้อง (กรอกตัวเลข 9–10 หลัก เช่น 0812345678)");

  const noEvent = form.noEvent === true;
  const raw = Array.isArray(form.events) ? form.events : [];
  if (!noEvent && raw.length === 0) errors.push("เพิ่ม Event อย่างน้อย 1 รายการ หรือติ๊ก \"เดือนนี้ไม่มี Event\"");
  if (raw.length > MAX_EVENTS) errors.push(`เพิ่ม Event ได้ไม่เกิน ${MAX_EVENTS} รายการ`);

  const allowed = allowedAgeGroups?.length ? allowedAgeGroups : null;
  const events = noEvent ? [] : raw.slice(0, MAX_EVENTS).map((e, i) => normalizeEvent(e, `Event ${i + 1}`, errors, allowed));
  return {
    errors,
    value: errors.length ? null : { noEvent, contactName, contactPhone: phone, events }
  };
}

function timeRange(label, start, end, fail) {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) fail(`ระบุ${label}ให้ครบ (เวลาเริ่มและเวลาจบ เช่น 16:00)`);
  else if (end <= start) fail(`${label}: เวลาจบต้องหลังเวลาเริ่ม`);
}

function normalizeEvent(e, label, errors, allowed = null) {
  const fail = (msg) => errors.push(`${label}: ${msg}`);
  const type = typeOf(e.type);
  if (!type) fail("เลือกประเภท");
  const kind = type?.kind;
  const schedule = SCHEDULE_KINDS.includes(kind);
  let title = text(e.title);
  if (!schedule) {
    if (!title) fail("กรอกชื่อรายการ / กิจกรรม");
    else if (title.length > TITLE_MAX || hasBadChar(title)) fail(`ชื่อรายการต้องไม่เกิน ${TITLE_MAX} ตัวอักษรและห้ามมี < >`);
  }

  const examLevels = kind === "exam" ? [...new Set((e.examLevels || []).filter((l) => EXAM_LEVELS.includes(l)))] : [];
  if (kind === "exam" && examLevels.length === 0) fail("เลือกชั้นที่สอบอย่างน้อย 1 ชั้น");
  // สอบ: รุ่นที่เกี่ยวข้อง = map จากชั้นที่สอบ · ประเภทอื่น: เลือกเอง (ทุกรุ่น = เลือกครบ U6–U18)
  let ageGroups = kind === "exam" ? ageGroupsForExamLevels(examLevels) : [];
  if (kind === "exam" && allowed && ageGroups.some((g) => !allowed.includes(g))) fail(`ชั้นที่สอบต้องตรงกับรุ่นที่คุณรับผิดชอบ (${allowed.join(", ")})`);
  if (kind !== "exam") {
    const options = allowed ?? AGE_OPTIONS; // โค้ชกรอกได้เฉพาะรุ่นของตัวเอง
    const chosen = (e.ageGroups || []).filter((g) => g !== ALL_AGES);
    const outside = allowed ? chosen.filter((g) => !allowed.includes(g)) : [];
    if (outside.length > 0) fail(`รุ่น ${outside.join(", ")} ไม่ใช่รุ่นที่คุณรับผิดชอบ`);
    const picked = (e.ageGroups || []).includes(ALL_AGES) ? options : options.filter((g) => chosen.includes(g));
    ageGroups = picked;
    if (picked.length === 0) fail("เลือกรุ่นที่เกี่ยวข้อง");
  }

  let start = text(e.start);
  let end = text(e.end) || start;
  let oldDate = "";
  let newDate = "";
  let reason = "";
  if (kind === "change-day") {
    oldDate = text(e.oldDate);
    newDate = text(e.newDate);
    if (!isDate(oldDate)) fail("เลือกวันซ้อมเดิม");
    else if (!isDate(newDate)) fail("เลือกวันที่เปลี่ยนเป็น");
    else if (newDate === oldDate) fail("วันที่ใหม่ต้องไม่ใช่วันซ้อมเดิม");
    reason = CHANGE_REASONS.includes(e.reason) ? e.reason : "";
    if (!reason) fail("เลือกเหตุผล");
    start = oldDate;
    end = oldDate;
  } else if (!isDate(start)) fail("เลือกวันที่เริ่ม");
  else if (!isDate(end) || end < start) fail("วันที่จบต้องไม่ก่อนวันที่เริ่ม");

  let oldStart = "";
  let oldEnd = "";
  let newStart = "";
  let newEnd = "";
  if (kind === "change-time") {
    [oldStart, oldEnd, newStart, newEnd] = [e.oldStart, e.oldEnd, e.newStart, e.newEnd].map(text);
    timeRange("เวลาซ้อมเดิม", oldStart, oldEnd, fail);
    timeRange("เวลาซ้อมใหม่", newStart, newEnd, fail);
  }

  let coachId = "";
  let coachName = "";
  let substitute = "none";
  let substituteName = "";
  let changes = [];
  let changeDetail = "";
  if (kind === "coach-leave") {
    coachId = text(e.coachId);
    coachName = text(e.coachName);
    if (!coachName) fail("เลือกโค้ชที่ไม่อยู่");
    else if (coachName.length > NAME_MAX || hasBadChar(coachName)) fail("ชื่อโค้ชไม่ถูกต้อง");
    substitute = e.substitute === "yes" ? "yes" : "none";
    if (substitute === "yes") {
      substituteName = text(e.substituteName);
      if (!substituteName) fail("กรอกชื่อผู้ฝึกสอนแทน");
      else if (substituteName.length > NAME_MAX || hasBadChar(substituteName)) fail("ชื่อผู้ฝึกสอนแทนไม่ถูกต้อง");
    } else {
      changes = LEAVE_CHANGES.filter((c) => (e.changes || []).includes(c));
      if (changes.length === 0) fail("เลือกสิ่งที่ต้องการเปลี่ยนแปลงอย่างน้อย 1 อย่าง");
      changeDetail = text(e.changeDetail);
      if (!changeDetail) fail("กรอกรายละเอียดวันและเวลาที่ขอเปลี่ยน");
      else if (changeDetail.length > NOTE_MAX || hasBadChar(changeDetail)) fail(`รายละเอียดต้องไม่เกิน ${NOTE_MAX} ตัวอักษรและห้ามมี < >`);
    }
  }

  let impact = "";
  let practiceStart = "";
  let practiceEnd = "";
  const practiceNormal = !schedule && e.impact === "partial" && e.practiceNormal === true; // ซ้อมได้ตามเวลาปกติ ไม่ต้องระบุช่วงเวลา
  if (!schedule) {
    impact = IMPACTS.some((i) => i.key === e.impact) ? e.impact : "";
    if (!impact) fail("เลือกผลต่อการซ้อม");
    if (impact === "partial" && !practiceNormal) {
      practiceStart = text(e.practiceStart);
      practiceEnd = text(e.practiceEnd);
      timeRange("ช่วงเวลาที่ซ้อม", practiceStart, practiceEnd, fail);
    }
  }

  const awayMode = !schedule && AWAY_MODES.some((m) => m.key === e.awayMode) ? e.awayMode : "none";
  let awayCount = null;
  let awayPlayers = [];
  if (awayMode === "some") {
    const seen = new Set();
    awayPlayers = (e.awayPlayers || [])
      .map((p) => ({ id: text(p.id), name: text(p.name), ageGroup: text(p.ageGroup) }))
      .filter((p) => p.name && !seen.has(p.id || p.name) && seen.add(p.id || p.name))
      .slice(0, MAX_AWAY_PLAYERS);
    if (awayPlayers.length > 0) awayCount = awayPlayers.length;
    else if (Number.isInteger(Number(e.awayCount)) && Number(e.awayCount) >= 1 && Number(e.awayCount) <= 99) awayCount = Number(e.awayCount); // ข้อมูลเดิมที่ระบุเป็นจำนวน
    else fail("เลือกชื่อนักเตะที่ไม่อยู่อย่างน้อย 1 คน");
  }

  let matches = [];
  if (kind === "match") {
    matches = (e.matches || []).slice(0, MAX_MATCHES).map((m) => ({ date: text(m.date), venue: VENUES.includes(m.venue) ? m.venue : "เหย้า", time: text(m.time) }));
    if (matches.length === 0) fail("ระบุจำนวนนัดที่แข่งอย่างน้อย 1 นัด");
    else if (matches.some((m) => !isDate(m.date))) fail("เลือกวันแข่งให้ครบทุกนัด");
    else if (matches.some((m) => m.time && !TIME_RE.test(m.time))) fail("เวลาแข่งไม่ถูกต้อง");
  }

  const note = text(e.note);
  if (note.length > NOTE_MAX || hasBadChar(note)) fail(`หมายเหตุต้องไม่เกิน ${NOTE_MAX} ตัวอักษรและห้ามมี < >`);

  if (schedule) {
    title =
      kind === "change-day" ? `เปลี่ยนวันซ้อม ${dateLabel(oldDate)} → ${dateLabel(newDate)}` : kind === "change-time" ? `เปลี่ยนเวลาซ้อม ${oldStart}–${oldEnd} → ${newStart}–${newEnd}` : `${coachName} ไม่อยู่ซ้อม`;
  }
  return {
    type: type?.key ?? "", title, ageGroups, start, end, impact, awayMode, awayCount, awayPlayers, matches, practiceNormal, practiceStart, practiceEnd, examLevels, note,
    reason, oldDate, newDate, oldStart, oldEnd, newStart, newEnd, coachId, coachName, substitute, substituteName, changes, changeDetail
  };
}
// เอกสารที่เก็บไว้ → ค่าตั้งต้นของฟอร์ม (เติมให้ครบทุกฟิลด์ที่ฟอร์มใช้)
export function formFromDoc(doc) {
  return {
    noEvent: doc?.noEvent === true,
    contactName: doc?.contactName ?? "",
    contactPhone: doc?.contactPhone ?? "",
    events: (doc?.events || []).map((e) => ({
      ...emptyEvent(),
      ...e,
      awayCount: e.awayCount ?? "",
      awayPlayers: (e.awayPlayers || []).map((p) => ({ ...p })),
      matches: (e.matches || []).map((m) => ({ ...emptyMatchRow(), ...m })),
      examLevels: e.examLevels || [],
      changes: e.changes || []
    }))
  };
}
// ---------- ผลการกรอกของโค้ชทุกคนในทีม (หน้าโค้ช = ของคนอื่น · หน้าทีมงาน/แอดมิน = ทั้งทีม) ----------
export const eventStatus = (doc) => (!doc ? "none" : doc.noEvent ? "no-event" : "submitted");

const LEGACY_NAME = "ข้อมูลเดิมที่กรอกทั้งทีม";
const byEarliestGroup = (a, b) => ageGroupSortKey(a.ageGroups || []) - ageGroupSortKey(b.ageGroups || []) || String(a.name).localeCompare(String(b.name), "th");

function rowOf(coach, doc) {
  const events = [...(doc?.events || [])].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return {
    coachId: coach.id ?? "",
    name: coach.name ?? doc?.coachName ?? "-",
    ageGroups: coach.ageGroups ?? doc?.coachAgeGroups ?? [],
    status: eventStatus(doc),
    contactName: doc?.contactName ?? "",
    contactPhone: doc?.contactPhone ?? "",
    submittedDate: doc?.submittedDate ?? "",
    firstSubmittedDate: doc?.firstSubmittedDate ?? doc?.submittedDate ?? "",
    events
  };
}

// docs = monthlyEvents ของทีมนี้ (เดือนที่เลือก) · coaches = โค้ชที่อนุมัติแล้วของทีม [{ id, name, ageGroups }] (แสดงทุกคน แม้ยังไม่กรอก)
// เอกสารแบบเดิมที่กรอกทั้งทีม (ไม่มี coachId) แสดงเป็นแถว legacy ดูอย่างเดียว ไม่นับในจำนวนโค้ชที่ส่ง
export function teamEventsModel({ team, month, docs = [], coaches = [] }) {
  const mine = docs.filter((d) => d.team === team && d.month === month);
  const byCoach = new Map(mine.filter((d) => d.coachId).map((d) => [d.coachId, d]));
  const rows = coaches.map((c) => rowOf(c, byCoach.get(c.id)));
  for (const d of byCoach.values()) if (!coaches.some((c) => c.id === d.coachId)) rows.push(rowOf({ id: d.coachId }, d)); // เจ้าของเอกสารที่ไม่อยู่ในรายชื่อโค้ชที่อนุมัติแล้ว ยังต้องเห็นข้อมูลที่กรอกไว้
  rows.sort(byEarliestGroup);
  const legacyDoc = mine.find((d) => !d.coachId) ?? null;
  const legacy = legacyDoc ? { ...rowOf({ id: "", name: LEGACY_NAME, ageGroups: [] }, legacyDoc), legacy: true } : null;
  const allEvents = [...rows, ...(legacy ? [legacy] : [])]
    .flatMap((r) => r.events.map((e) => ({ ...e, coachName: r.name })))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const count = (s) => rows.filter((r) => r.status === s).length;
  return { team, month, rows, legacy, allEvents, summary: { submitted: count("submitted"), noEvent: count("no-event"), missing: count("none"), total: rows.length } };
}

const STATUS_BADGE = { submitted: ["badge-success", "ส่งแล้ว"], "no-event": ["badge-info", "ไม่มี Event"], none: ["badge-danger", "ยังไม่กรอก"] };
const IMPACT_BADGE = { "no-training": "badge-danger", partial: "badge-warning", none: "badge-neutral" };

// ป้ายคอลัมน์ "ผลต่อการซ้อม": ประเภทปกติใช้ค่าที่เลือก · แจ้งเปลี่ยนตารางซ้อมใช้ป้ายตามประเภท
function effectBadge(e) {
  switch (kindOfType(e.type)) {
    case "change-day":
      return ["badge-warning", "เปลี่ยนวันซ้อม"];
    case "change-time":
      return ["badge-warning", "เปลี่ยนเวลาซ้อม"];
    case "coach-leave":
      if (e.substitute === "yes") return ["badge-neutral", "มีผู้ฝึกสอนแทน"];
      return (e.changes || []).includes("งดซ้อม") ? ["badge-danger", "งดซ้อม"] : ["badge-warning", "ขอเปลี่ยน"];
    default:
      return [IMPACT_BADGE[e.impact] || "badge-neutral", impactLabel(e.impact)];
  }
}

function awayText(e) {
  if (e.awayMode === "all") return "ทั้งรุ่น";
  if (e.awayMode === "some") return `${e.awayCount ?? "-"} คน`;
  return "-";
}
const trainRange = (e) => (e.practiceNormal ? "ซ้อมตามเวลาปกติ" : e.practiceStart && e.practiceEnd ? `ซ้อม ${e.practiceStart}–${e.practiceEnd} น.` : e.practiceMinutes ? `ซ้อมได้ ${e.practiceMinutes} นาที (${e.practicePeriod ?? "-"})` : "");
function detailText(e) {
  const parts = [];
  if (e.matches?.length) parts.push(`${e.matches.length} นัด: ${e.matches.map((m) => `${dateLabel(m.date)} ${m.venue}${m.time ? ` ${m.time}` : ""}`).join(" · ")}`);
  if (e.impact === "partial" && trainRange(e)) parts.push(trainRange(e));
  if (e.examLevels?.length) parts.push(`ชั้นที่สอบ ${e.examLevels.join(", ")}`);
  if (e.awayMode === "some" && e.awayPlayers?.length) parts.push(`นักเตะที่ไม่อยู่: ${e.awayPlayers.map((p) => p.name).join(", ")}`);
  if (kindOfType(e.type) === "change-day" && e.reason) parts.push(`เหตุผล: ${e.reason}`);
  if (kindOfType(e.type) === "coach-leave") {
    if (e.substitute === "yes") parts.push(`ผู้ฝึกสอนแทน: ${e.substituteName}`);
    else parts.push(`ไม่มีผู้ฝึกสอนแทน · ขอ: ${(e.changes || []).join(", ")}${e.changeDetail ? ` (${e.changeDetail})` : ""}`);
  }
  if (e.note) parts.push(e.note);
  return parts.join(" · ");
}

// showCoach = เพิ่มคอลัมน์ชื่อโค้ชผู้กรอก (รายการรวมทั้งทีม — แต่ละ event ต้องมี coachName)
export function eventRowsHtml(events, { showCoach = false } = {}) {
  if (!events.length) return '<p class="text-sm text-slate-500">ไม่มีรายการ</p>';
  const rows = events
    .map((e) => {
      const detail = detailText(e);
      const ages = e.ageGroups?.length >= AGE_OPTIONS.length ? ALL_AGES : (e.ageGroups || []).join(", ");
      return `<tr>
        <td>${escapeHtml(rangeLabel(e.start, e.end))}</td>
        <td><span class="emphasis">${escapeHtml(typeLabel(e.type))}</span> · ${escapeHtml(e.title)}${detail ? `<div class="text-xs text-slate-500">${escapeHtml(detail)}</div>` : ""}</td>
        ${showCoach ? `<td>${escapeHtml(e.coachName ?? "-")}</td>` : ""}
        <td>${escapeHtml(ages || "-")}</td>
        <td><span class="badge ${effectBadge(e)[0]}">${escapeHtml(effectBadge(e)[1])}</span></td>
        <td>${escapeHtml(isScheduleChange(e.type) ? "-" : awayText(e))}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="pro-table"><thead><tr><th>วันที่</th><th>ประเภท · ชื่อ</th>${showCoach ? "<th>โค้ช</th>" : ""}<th>รุ่น</th><th>ผลต่อการซ้อม</th><th>นักเตะไม่อยู่</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// วันที่ส่ง (และวันที่แก้ไขล่าสุด ถ้าโค้ชแก้หลังส่งไปแล้ว)
function whenHtml(r) {
  if (r.status === "none" || !r.submittedDate) return "";
  const edited = r.firstSubmittedDate && r.firstSubmittedDate !== r.submittedDate;
  return ` <span class="text-xs text-slate-500">${escapeHtml(edited ? `ส่ง ${dateLabel(r.firstSubmittedDate)} · แก้ไขล่าสุด ${dateLabel(r.submittedDate)}` : dateLabel(r.submittedDate))}</span>`;
}

const tile = (label, value, tone = "") =>
  `<div class="admin-home-tile${tone ? ` admin-home-tile-${tone}` : ""}"><span class="admin-home-tile-label">${escapeHtml(label)}</span><span class="admin-home-tile-value">${value}</span></div>`;

const agesText = (r) => (r.ageGroups?.length ? r.ageGroups.join(", ") : "");
const whoText = (r) => (r.contactName ? `${escapeHtml(r.contactName)}${r.contactPhone ? ` · ${escapeHtml(formatPhone(r.contactPhone))}` : ""}` : "-");

// การ์ดต่อโค้ช (หน้าโค้ช: ผลการกรอกของโค้ชคนอื่นในทีม ดูอย่างเดียว) — excludeCoachId = ไม่แสดงของตัวเอง (อยู่ในฟอร์มด้านบนแล้ว)
export function coachEntriesHtml(model, { excludeCoachId = "" } = {}) {
  const list = [...model.rows.filter((r) => !excludeCoachId || r.coachId !== excludeCoachId), ...(model.legacy ? [model.legacy] : [])];
  if (list.length === 0) return '<p class="text-sm text-slate-500">ยังไม่มีโค้ชคนอื่นในทีมนี้</p>';
  return list
    .map((r) => {
      const [cls, label] = STATUS_BADGE[r.status];
      const body = r.status === "submitted" ? eventRowsHtml(r.events) : r.status === "no-event" ? '<p class="text-sm text-slate-500">แจ้งว่าเดือนนี้ไม่มี Event</p>' : '<p class="text-sm text-slate-500">ยังไม่ได้กรอก</p>';
      return `<div class="event-entry">
        <div class="flex items-center justify-between flex-wrap gap-2"><strong>${escapeHtml(r.name)}${agesText(r) ? ` <span class="text-sm text-slate-500 font-normal">· ${escapeHtml(agesText(r))}</span>` : ""}</strong><span><span class="badge ${cls}">${label}</span>${whenHtml(r)}</span></div>
        ${body}
      </div>`;
    })
    .join("");
}

// หน้าทีมงาน/แอดมิน: สรุปจำนวนโค้ชที่ส่ง + ตารางสถานะรายโค้ช + รายการ Event รวมทั้งทีมเรียงตามวัน (มีคอลัมน์โค้ช)
export function teamOverviewHtml(model) {
  const s = model.summary;
  const tiles = `<div class="admin-home-tiles">${tile("โค้ชที่ส่งแล้ว", `${s.submitted + s.noEvent} / ${s.total}`, s.missing === 0 && s.total > 0 ? "ok" : "")}${tile("แจ้งว่าไม่มี Event", String(s.noEvent))}${tile("ยังไม่กรอก", String(s.missing), s.missing > 0 ? "bad" : "ok")}</div>`;
  const rows = [...model.rows, ...(model.legacy ? [model.legacy] : [])]
    .map((r) => {
      const [cls, label] = STATUS_BADGE[r.status];
      return `<tr><td class="emphasis">${escapeHtml(r.name)}</td><td>${escapeHtml(agesText(r) || "-")}</td><td><span class="badge ${cls}">${label}</span>${whenHtml(r)}</td><td>${r.events.length ? `${r.events.length} รายการ` : "-"}</td><td>${whoText(r)}</td></tr>`;
    })
    .join("");
  const table = rows ? `<div class="table-wrap"><table class="pro-table"><thead><tr><th>โค้ช</th><th>รุ่น</th><th>สถานะ</th><th>Event</th><th>ผู้กรอก</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="text-sm text-slate-500">ยังไม่มีโค้ชในทีมนี้</p>';
  return `<div class="card card-pad space-y-3">
    <h3 class="section-title">${escapeHtml(model.team)} · Event ประจำเดือน${escapeHtml(monthLabel(model.month))}</h3>
    ${tiles}
    ${table}
  </div>${model.allEvents.length ? `<div class="card card-pad space-y-2"><h4 class="admin-chart-title">รายการ Event ทั้งทีม (เรียงตามวัน)</h4>${eventRowsHtml(model.allEvents, { showCoach: true })}</div>` : ""}`;
}

// ใบพิมพ์สรุปการแจ้ง Event ของทีมในเดือนที่เลือก (A4 แนวตั้ง) — สถานะรายโค้ช + รายการ Event ทั้งทีมเรียงตามวัน
// logo = HTML รูปโลโก้ทีม (ผู้เรียกใส่ให้ เพื่อให้ฟังก์ชันนี้ไม่พึ่ง DOM) · printedAt = ข้อความวันที่พิมพ์
export function teamEventsSheetHtml(model, { logo = "", printedAt = "" } = {}) {
  const s = model.summary;
  const people = [...model.rows, ...(model.legacy ? [model.legacy] : [])];
  const statusText = (r) => {
    const base = STATUS_BADGE[r.status][1];
    if (r.status === "none" || !r.submittedDate) return base;
    const edited = r.firstSubmittedDate && r.firstSubmittedDate !== r.submittedDate;
    return `${base} ${edited ? `${dateLabel(r.firstSubmittedDate)} (แก้ไขล่าสุด ${dateLabel(r.submittedDate)})` : dateLabel(r.submittedDate)}`;
  };
  const coachRows = people
    .map((r) => `<tr><td class="l">${escapeHtml(r.name)}</td><td>${escapeHtml(agesText(r) || "-")}</td><td class="l">${escapeHtml(statusText(r))}</td><td>${r.events.length || "-"}</td><td class="l">${whoText(r)}</td></tr>`)
    .join("");
  const eventRows = model.allEvents
    .map((e) => {
      const detail = detailText(e);
      const ages = e.ageGroups?.length >= AGE_OPTIONS.length ? ALL_AGES : (e.ageGroups || []).join(", ");
      return `<tr><td class="nw">${escapeHtml(rangeLabel(e.start, e.end))}</td><td class="l"><b>${escapeHtml(typeLabel(e.type))}</b> · ${escapeHtml(e.title)}${detail ? `<div class="sheet-note">${escapeHtml(detail)}</div>` : ""}</td><td class="l">${escapeHtml(e.coachName ?? "-")}</td><td>${escapeHtml(ages || "-")}</td><td>${escapeHtml(effectBadge(e)[1])}</td><td>${escapeHtml(isScheduleChange(e.type) ? "-" : awayText(e))}</td></tr>`;
    })
    .join("");
  return `<div class="sheet sheet-events print-sheet">
    <div class="sheet-head">
      <div class="sheet-brand">${logo}<div><div style="font-size:1.05rem;font-weight:700">รายงานการแจ้ง Event ประจำเดือน${escapeHtml(monthLabel(model.month))}</div><div>${escapeHtml(model.team)}</div></div></div>
      <div class="sheet-note" style="text-align:right">${printedAt ? `พิมพ์เมื่อ ${escapeHtml(printedAt)}` : ""}</div>
    </div>
    <p class="sheet-note">โค้ชที่ส่งแล้ว ${s.submitted + s.noEvent} / ${s.total} คน (แจ้งว่าไม่มี Event ${s.noEvent} · ยังไม่กรอก ${s.missing})</p>
    <h4>สถานะรายโค้ช</h4>
    ${people.length ? `<table class="sheet-table"><thead><tr><th>โค้ช</th><th>รุ่น</th><th>สถานะ</th><th>Event</th><th>ผู้กรอก</th></tr></thead><tbody>${coachRows}</tbody></table>` : '<p class="sheet-note">ยังไม่มีโค้ชในทีมนี้</p>'}
    <h4>รายการ Event ทั้งทีม (เรียงตามวัน)</h4>
    ${model.allEvents.length ? `<table class="sheet-table"><thead><tr><th>วันที่</th><th>ประเภท · ชื่อ</th><th>โค้ช</th><th>รุ่น</th><th>ผลต่อการซ้อม</th><th>นักเตะไม่อยู่</th></tr></thead><tbody>${eventRows}</tbody></table>` : '<p class="sheet-note">ไม่มีรายการ Event ในเดือนนี้</p>'}
  </div>`;
}