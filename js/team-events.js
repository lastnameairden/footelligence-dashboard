// Event ประจำเดือนของแต่ละทีม/โรงเรียน (ตรรกะล้วนๆ + HTML เป็นสตริง ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// โค้ชกรอกเดือนละครั้ง (ภายในวันที่ 25 ของเดือนก่อนหน้า) 1 เอกสารต่อทีมต่อเดือน: monthlyEvents/{ทีม}__{YYYY-MM}
// ช่อง "เดือนนี้ไม่มี Event" แยก "ไม่มี Event" ออกจาก "ลืมกรอก" — ทีมหลังบ้าน/แอดมินดูสถานะของทุกทีมได้ในหน้าเดียว
import { addMonthsToMonth } from "./coach-meetings.js";
import { escapeHtml } from "./ui-utils.js";
import { formatPhone, normalizePhone } from "./player-profile-fields.js";

export const DUE_DAY = 25;
export const MAX_EVENTS = 30;
export const TITLE_MAX = 80;
export const NOTE_MAX = 200;
export const NAME_MAX = 80;

// kind: match = มีวันแข่ง/เหย้า-เยือน/เวลา · exam = ระบุชั้นที่สอบ (ระบบ map เป็นรุ่นให้)
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
  { key: "other", label: "อื่นๆ" }
];
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
export const PERIODS = ["เช้า", "กลางวัน", "บ่าย", "เย็น"];
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
export const eventDocId = (team, month) => `${team}__${month}`;

// กำหนดส่งของเดือนที่แจ้ง = วันที่ 25 ของเดือนก่อนหน้า
export const dueDateFor = (month) => `${addMonthsToMonth(month, -1)}-${DUE_DAY}`;

// ป้ายสถานะการส่งในหน้าโค้ช: submitted = ส่งแล้ว · overdue = เลยกำหนดแล้วยังไม่ส่ง · due = ยังไม่ส่ง (ยังไม่เลยกำหนด)
export function dueInfo({ month, today, submitted }) {
  const due = dueDateFor(month);
  if (submitted) return { state: "submitted", due };
  return { state: today > due ? "overdue" : "due", due };
}

// ---------- ฟอร์ม ----------
export function emptyEvent() {
  return { type: "", title: "", ageGroups: [], start: "", end: "", impact: "", awayMode: "none", awayCount: "", matches: [], practiceMinutes: "", practicePeriod: "", examLevels: [], note: "" };
}
export const emptyMatchRow = () => ({ date: "", venue: "เหย้า", time: "" });

const hasBadChar = (s) => /[<>]/.test(s);
const text = (v) => String(v ?? "").trim();

// ฟอร์ม (ค่าที่อ่านจากหน้าจอ) → { value, errors } — value คือเอกสารที่จะเก็บ (ไม่มีฟิลด์ undefined)
export function validateEventForm(form) {
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

  const events = noEvent ? [] : raw.slice(0, MAX_EVENTS).map((e, i) => normalizeEvent(e, `Event ${i + 1}`, errors));
  return {
    errors,
    value: errors.length ? null : { noEvent, contactName, contactPhone: phone, events }
  };
}

function normalizeEvent(e, label, errors) {
  const fail = (msg) => errors.push(`${label}: ${msg}`);
  const type = typeOf(e.type);
  if (!type) fail("เลือกประเภท");
  const title = text(e.title);
  if (!title) fail("กรอกชื่อรายการ / กิจกรรม");
  else if (title.length > TITLE_MAX || hasBadChar(title)) fail(`ชื่อรายการต้องไม่เกิน ${TITLE_MAX} ตัวอักษรและห้ามมี < >`);

  const examLevels = type?.kind === "exam" ? [...new Set((e.examLevels || []).filter((l) => EXAM_LEVELS.includes(l)))] : [];
  if (type?.kind === "exam" && examLevels.length === 0) fail("เลือกชั้นที่สอบอย่างน้อย 1 ชั้น");
  // สอบ: รุ่นที่เกี่ยวข้อง = map จากชั้นที่สอบ · ประเภทอื่น: เลือกเอง (ทุกรุ่น = เลือกครบ U6–U18)
  let ageGroups = type?.kind === "exam" ? ageGroupsForExamLevels(examLevels) : [];
  if (type?.kind !== "exam") {
    const picked = (e.ageGroups || []).includes(ALL_AGES) ? AGE_OPTIONS : AGE_OPTIONS.filter((g) => (e.ageGroups || []).includes(g));
    ageGroups = picked;
    if (picked.length === 0) fail("เลือกรุ่นที่เกี่ยวข้อง");
  }

  const start = text(e.start);
  const end = text(e.end) || start;
  if (!isDate(start)) fail("เลือกวันที่เริ่ม");
  else if (!isDate(end) || end < start) fail("วันที่จบต้องไม่ก่อนวันที่เริ่ม");

  if (!IMPACTS.some((i) => i.key === e.impact)) fail("เลือกผลต่อการซ้อม");
  let practiceMinutes = null;
  let practicePeriod = null;
  if (e.impact === "partial") {
    const minutes = Number(e.practiceMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) fail("ระบุจำนวนนาทีที่ซ้อมได้ (1–600)");
    else practiceMinutes = minutes;
    if (!PERIODS.includes(e.practicePeriod)) fail("เลือกช่วงเวลาที่ซ้อมได้");
    else practicePeriod = e.practicePeriod;
  }

  const awayMode = AWAY_MODES.some((m) => m.key === e.awayMode) ? e.awayMode : "none";
  let awayCount = null;
  if (awayMode === "some") {
    const n = Number(e.awayCount);
    if (!Number.isInteger(n) || n < 1 || n > 99) fail("ระบุจำนวนนักเตะที่ไม่อยู่ (1–99)");
    else awayCount = n;
  }

  let matches = [];
  if (type?.kind === "match") {
    matches = (e.matches || []).map((m) => ({ date: text(m.date), venue: VENUES.includes(m.venue) ? m.venue : "เหย้า", time: text(m.time) }));
    if (matches.length === 0) fail("เพิ่มวันแข่งอย่างน้อย 1 นัด");
    else if (matches.some((m) => !isDate(m.date))) fail("เลือกวันแข่งให้ครบทุกนัด");
    else if (matches.some((m) => m.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time))) fail("เวลาแข่งไม่ถูกต้อง");
  }

  const note = text(e.note);
  if (note.length > NOTE_MAX || hasBadChar(note)) fail(`หมายเหตุต้องไม่เกิน ${NOTE_MAX} ตัวอักษรและห้ามมี < >`);

  return { type: type?.key ?? "", title, ageGroups, start, end, impact: e.impact ?? "", awayMode, awayCount, matches, practiceMinutes, practicePeriod, examLevels, note };
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
      practiceMinutes: e.practiceMinutes ?? "",
      practicePeriod: e.practicePeriod ?? "",
      matches: (e.matches || []).map((m) => ({ ...emptyMatchRow(), ...m })),
      examLevels: e.examLevels || []
    }))
  };
}

// ---------- ภาพรวมของทุกทีม (ทีมหลังบ้าน/แอดมิน) ----------
export const eventStatus = (doc) => (!doc ? "none" : doc.noEvent ? "no-event" : "submitted");

// docs = เอกสารของเดือนที่เลือก (ทุกทีม) · teams = ลำดับทีมที่ต้องแสดงเสมอ แม้ยังไม่มีเอกสาร (เพื่อให้เห็นทีมที่ยังไม่กรอก)
export function overviewModel({ teams, month, docs = [] }) {
  const byTeam = new Map(docs.filter((d) => d.month === month).map((d) => [d.team, d]));
  const rows = teams.map((team) => {
    const doc = byTeam.get(team) ?? null;
    const events = [...(doc?.events || [])].sort((a, b) => String(a.start).localeCompare(String(b.start)));
    return { team, status: eventStatus(doc), contactName: doc?.contactName ?? "", contactPhone: doc?.contactPhone ?? "", submittedDate: doc?.submittedDate ?? "", events };
  });
  const count = (s) => rows.filter((r) => r.status === s).length;
  return { month, rows, summary: { submitted: count("submitted"), noEvent: count("no-event"), missing: count("none"), total: rows.length } };
}

const STATUS_BADGE = { submitted: ["badge-success", "ส่งแล้ว"], "no-event": ["badge-info", "ไม่มี Event"], none: ["badge-danger", "ยังไม่กรอก"] };
const IMPACT_BADGE = { "no-training": "badge-danger", partial: "badge-warning", none: "badge-neutral" };

function awayText(e) {
  if (e.awayMode === "all") return "ทั้งรุ่น";
  if (e.awayMode === "some") return `${e.awayCount ?? "-"} คน`;
  return "-";
}
function detailText(e) {
  const parts = [];
  if (e.matches?.length) parts.push(e.matches.map((m) => `${dateLabel(m.date)} ${m.venue}${m.time ? ` ${m.time}` : ""}`).join(" · "));
  if (e.impact === "partial" && e.practiceMinutes) parts.push(`ซ้อมได้ ${e.practiceMinutes} นาที (${e.practicePeriod ?? "-"})`);
  if (e.examLevels?.length) parts.push(`ชั้นที่สอบ ${e.examLevels.join(", ")}`);
  if (e.note) parts.push(e.note);
  return parts.join(" · ");
}

export function eventRowsHtml(events) {
  if (!events.length) return '<p class="text-sm text-slate-500">ไม่มีรายการ</p>';
  const rows = events
    .map((e) => {
      const detail = detailText(e);
      const ages = e.ageGroups?.length >= AGE_OPTIONS.length ? ALL_AGES : (e.ageGroups || []).join(", ");
      return `<tr>
        <td>${escapeHtml(rangeLabel(e.start, e.end))}</td>
        <td><span class="emphasis">${escapeHtml(typeLabel(e.type))}</span> · ${escapeHtml(e.title)}${detail ? `<div class="text-xs text-slate-500">${escapeHtml(detail)}</div>` : ""}</td>
        <td>${escapeHtml(ages || "-")}</td>
        <td><span class="badge ${IMPACT_BADGE[e.impact] || "badge-neutral"}">${escapeHtml(impactLabel(e.impact))}</span></td>
        <td>${escapeHtml(awayText(e))}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="pro-table"><thead><tr><th>วันที่</th><th>ประเภท · ชื่อ</th><th>รุ่น</th><th>ผลต่อการซ้อม</th><th>นักเตะไม่อยู่</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const tile = (label, value, tone = "") =>
  `<div class="admin-home-tile${tone ? ` admin-home-tile-${tone}` : ""}"><span class="admin-home-tile-label">${escapeHtml(label)}</span><span class="admin-home-tile-value">${value}</span></div>`;

// โรงเรียนเดียว (หน้าทีมของทีมหลังบ้าน/แอดมิน): แสดงเฉพาะข้อมูลของโรงเรียนที่เลือก ไม่มีสรุปรวมทุกทีม
const SINGLE_NOTE = { none: "โรงเรียนนี้ยังไม่ส่ง Event ของเดือนนี้", "no-event": "โรงเรียนนี้แจ้งว่าเดือนนี้ไม่มี Event" };
function singleTeamHtml(model) {
  const r = model.rows[0];
  const [cls, label] = STATUS_BADGE[r.status];
  const when = r.status === "none" || !r.submittedDate ? "" : ` <span class="text-xs text-slate-500">${escapeHtml(dateLabel(r.submittedDate))}</span>`;
  const who = r.contactName ? `<p class="text-sm text-slate-500">ผู้กรอก: ${escapeHtml(r.contactName)}${r.contactPhone ? ` · ${escapeHtml(formatPhone(r.contactPhone))}` : ""}</p>` : "";
  const body = r.status === "submitted" ? eventRowsHtml(r.events) : `<p class="text-sm text-slate-500">${SINGLE_NOTE[r.status]}</p>`;
  return `<div class="card card-pad space-y-3">
    <div class="flex items-center justify-between flex-wrap gap-2"><h3 class="section-title">${escapeHtml(r.team)} · Event ประจำเดือน${escapeHtml(monthLabel(model.month))}</h3><span><span class="badge ${cls}">${label}</span>${when}</span></div>
    ${who}${body}
  </div>`;
}

export function overviewHtml(model) {
  if (model.rows.length === 1) return singleTeamHtml(model);
  const { rows, summary: s } = model;
  const tiles = `<div class="admin-home-tiles">${tile("ส่งแล้ว", `${s.submitted} / ${s.total}`, s.submitted === s.total ? "ok" : "")}${tile("ไม่มี Event", String(s.noEvent))}${tile("ยังไม่กรอก", String(s.missing), s.missing > 0 ? "bad" : "ok")}</div>`;
  const table = rows
    .map((r) => {
      const [cls, label] = STATUS_BADGE[r.status];
      const when = r.status === "none" || !r.submittedDate ? "" : ` <span class="text-xs text-slate-500">${escapeHtml(dateLabel(r.submittedDate))}</span>`;
      const who = r.contactName ? `${escapeHtml(r.contactName)}${r.contactPhone ? ` · ${escapeHtml(formatPhone(r.contactPhone))}` : ""}` : "-";
      return `<tr><td class="emphasis">${escapeHtml(r.team)}</td><td><span class="badge ${cls}">${label}</span>${when}</td><td>${r.events.length ? `${r.events.length} รายการ` : "-"}</td><td>${who}</td></tr>`;
    })
    .join("");
  const details = rows
    .filter((r) => r.events.length)
    .map((r) => `<div class="space-y-2"><h4 class="admin-chart-title">${escapeHtml(r.team)} · รายการ Event</h4>${eventRowsHtml(r.events)}</div>`)
    .join("");
  return `<div class="card card-pad space-y-3">
    <h3 class="section-title">Event ประจำเดือน${escapeHtml(monthLabel(model.month))}</h3>
    ${tiles}
    <div class="table-wrap"><table class="pro-table"><thead><tr><th>โรงเรียน</th><th>สถานะ</th><th>Event</th><th>ผู้กรอก</th></tr></thead><tbody>${table}</tbody></table></div>
  </div>${details ? `<div class="card card-pad space-y-4">${details}</div>` : ""}`;
}
