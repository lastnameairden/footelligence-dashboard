// หน้า Event ประจำเดือน: โค้ชกรอกของทีมตัวเอง (โหมดกรอก) · ทีมหลังบ้าน/แอดมินดูสถานะและรายการของทุกทีม (โหมดดู) — ตรรกะอยู่ที่ team-events.js
// ฟอร์มสร้างด้วย JS จึงอ้างอิง element ผ่าน data-* ใน container ไม่ใช้ id
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, todayBangkok } from "./ui-utils.js";
import {
  AGE_OPTIONS,
  ALL_AGES,
  AWAY_MODES,
  EVENT_TYPES,
  EXAM_LEVELS,
  IMPACTS,
  PERIODS,
  VENUES,
  ageGroupsForExamLevels,
  dateLabel,
  defaultMonth,
  dueInfo,
  emptyEvent,
  emptyMatchRow,
  eventDocId,
  formFromDoc,
  isExamType,
  isMatchType,
  monthLabel,
  monthOptions,
  overviewHtml,
  overviewModel,
  validateEventForm
} from "./team-events.js";

// api = { mode() = "fill" | "view", team() = ทีมของโค้ช, teams() = ทุกทีมที่ต้องแสดงในโหมดดู, coach() = { name, phone } ค่าตั้งต้นของผู้กรอก, uid() }
let api = null;
let box = null;
let month = "";
let draft = null;
let saved = null; // เอกสารที่เก็บไว้ของเดือนที่เลือก (null = ยังไม่เคยส่ง)
let statusHtml = "";
let loadToken = 0;

const options = (list, selected, valueOf = (x) => x, labelOf = (x) => x, placeholder = "") =>
  (placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "") +
  list.map((x) => `<option value="${escapeHtml(valueOf(x))}"${valueOf(x) === selected ? " selected" : ""}>${escapeHtml(labelOf(x))}</option>`).join("");

const field = (label, control) => `<div class="event-field"><label class="field-label">${escapeHtml(label)}</label>${control}</div>`;
const chip = (on, attrs, label) => `<button type="button" class="event-chip${on ? " event-chip-on" : ""}" aria-pressed="${on}" ${attrs}>${escapeHtml(label)}</button>`;

function matchRowHtml(ei, mi, m) {
  const at = `data-ev="${ei}" data-m="${mi}"`;
  return `<div class="event-match-row">
    <input type="date" class="field-input" ${at} data-f="date" value="${escapeHtml(m.date)}" aria-label="วันแข่ง" />
    <select class="field-input" ${at} data-f="venue" aria-label="เหย้า/เยือน">${options(VENUES, m.venue)}</select>
    <input type="time" class="field-input" ${at} data-f="time" value="${escapeHtml(m.time)}" aria-label="เวลาแข่ง" />
    <button type="button" class="btn btn-ghost-danger btn-sm" data-action="remove-match" data-ev="${ei}" data-m="${mi}">ลบนัด</button>
  </div>`;
}

function eventHtml(e, i) {
  const at = `data-ev="${i}"`;
  const exam = isExamType(e.type);
  const ageChips = exam
    ? `<div class="event-chips">${EXAM_LEVELS.map((l) => chip(e.examLevels.includes(l), `${at} data-action="toggle-level" data-level="${l}"`, l)).join("")}</div>
       <p class="text-xs text-slate-500">รุ่นที่เกี่ยวข้อง (ระบบแปลงจากชั้นที่สอบ): ${escapeHtml(ageGroupsForExamLevels(e.examLevels).join(", ") || "-")}</p>`
    : `<div class="event-chips">${AGE_OPTIONS.map((g) => chip(e.ageGroups.includes(g), `${at} data-action="toggle-age" data-age="${g}"`, g)).join("")}${chip(AGE_OPTIONS.every((g) => e.ageGroups.includes(g)), `${at} data-action="toggle-age" data-age="${ALL_AGES}"`, ALL_AGES)}</div>`;
  return `<div class="event-card">
    <div class="event-card-head"><strong>Event ${i + 1}</strong><button type="button" class="btn btn-ghost-danger btn-sm" data-action="remove-event" ${at}>ลบรายการ</button></div>
    <div class="event-grid">
      ${field("ประเภท", `<select class="field-input" ${at} data-f="type">${options(EVENT_TYPES, e.type, (t) => t.key, (t) => t.label, "เลือกประเภท")}</select>`)}
      ${field("ชื่อรายการ / กิจกรรม", `<input type="text" class="field-input" ${at} data-f="title" maxlength="80" value="${escapeHtml(e.title)}" />`)}
      ${field("วันที่เริ่ม", `<input type="date" class="field-input" ${at} data-f="start" value="${escapeHtml(e.start)}" />`)}
      ${field("วันที่จบ", `<input type="date" class="field-input" ${at} data-f="end" value="${escapeHtml(e.end)}" />`)}
    </div>
    ${field(exam ? "ชั้นที่สอบ (เลือกได้หลายชั้น)" : "รุ่นที่เกี่ยวข้อง (เลือกได้หลายข้อ)", ageChips)}
    <div class="event-grid">
      ${field("ผลต่อการซ้อม", `<select class="field-input" ${at} data-f="impact">${options(IMPACTS, e.impact, (x) => x.key, (x) => x.label, "เลือกผลต่อการซ้อม")}</select>`)}
      ${e.impact === "partial" ? field("ซ้อมได้กี่นาที", `<input type="number" min="1" max="600" class="field-input" ${at} data-f="practiceMinutes" value="${escapeHtml(e.practiceMinutes)}" />`) + field("ช่วงเวลาไหน", `<select class="field-input" ${at} data-f="practicePeriod">${options(PERIODS, e.practicePeriod, (x) => x, (x) => x, "เลือกช่วงเวลา")}</select>`) : ""}
      ${field("นักเตะที่ไม่อยู่", `<select class="field-input" ${at} data-f="awayMode">${options(AWAY_MODES, e.awayMode, (x) => x.key, (x) => x.label)}</select>`)}
      ${e.awayMode === "some" ? field("จำนวน (คน)", `<input type="number" min="1" max="99" class="field-input" ${at} data-f="awayCount" value="${escapeHtml(e.awayCount)}" />`) : ""}
    </div>
    ${isMatchType(e.type) ? field("วันแข่งแต่ละนัด · เหย้า / เยือน · เวลาแข่ง", `<div class="event-matches">${e.matches.map((m, mi) => matchRowHtml(i, mi, m)).join("")}<div><button type="button" class="btn btn-secondary btn-sm" data-action="add-match" ${at}>+ เพิ่มนัดแข่ง</button></div></div>`) : ""}
    ${field("หมายเหตุ (ไม่บังคับ)", `<input type="text" class="field-input" ${at} data-f="note" maxlength="200" value="${escapeHtml(e.note)}" />`)}
  </div>`;
}

function dueBadge() {
  const info = dueInfo({ month, today: todayBangkok(), submitted: !!saved });
  const when = dateLabel(info.due);
  if (info.state === "submitted") return `<span class="badge badge-success">ส่งแล้ว${saved.submittedDate ? ` ${escapeHtml(dateLabel(saved.submittedDate))}` : ""}</span>`;
  return info.state === "overdue" ? `<span class="badge badge-danger">เลยกำหนด ${escapeHtml(when)}</span>` : `<span class="badge badge-warning">ครบกำหนด ${escapeHtml(when)}</span>`;
}

function renderFill() {
  const team = api.team();
  box.innerHTML = `<div class="card card-pad space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2"><h3 class="section-title">แจ้ง Event ประจำเดือน</h3>${dueBadge()}</div>
    <div class="event-grid">
      ${field("โรงเรียน", `<select class="field-input" disabled><option>${escapeHtml(team)}</option></select>`)}
      ${field("แจ้งสำหรับเดือน", `<select class="field-input" data-f="month">${options(monthOptions(todayBangkok()), month, (m) => m, monthLabel)}</select>`)}
      ${field("ผู้กรอก", `<input type="text" class="field-input" data-f="contactName" maxlength="80" value="${escapeHtml(draft.contactName)}" />`)}
      ${field("เบอร์ติดต่อ", `<input type="tel" inputmode="tel" class="field-input" data-f="contactPhone" placeholder="08x-xxx-xxxx" value="${escapeHtml(draft.contactPhone)}" />`)}
    </div>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-f="noEvent"${draft.noEvent ? " checked" : ""} /> เดือนนี้ไม่มี Event</label>
    ${draft.noEvent ? "" : draft.events.map(eventHtml).join("")}
    <div class="event-actions">
      ${draft.noEvent ? "" : '<button type="button" class="btn btn-secondary" data-action="add-event">+ เพิ่ม Event</button>'}
      <button type="button" class="btn btn-primary" data-action="save">บันทึกและส่ง</button>
    </div>
    <div class="text-sm" data-status>${statusHtml}</div>
    <p class="text-xs text-slate-500">กรอกแล้วแก้ไขได้ภายหลัง ส่งซ้ำจะทับของเดิมของเดือนนี้ — ทีมหลังบ้านและผู้ดูแลระบบเห็นสถานะของทุกทีมในเมนู Event</p>
  </div>`;
}

function renderView(model) {
  box.innerHTML = `<div class="card card-pad flex items-center gap-3 flex-wrap">
      <label class="field-label mb-0">เดือน</label>
      <select class="field-input" style="width:auto" data-f="month">${options(monthOptions(todayBangkok()), month, (m) => m, monthLabel)}</select>
      <p class="text-sm text-slate-500">ดูอย่างเดียว · โค้ชของแต่ละโรงเรียนเป็นผู้กรอก</p>
    </div>${overviewHtml(model)}`;
}

const msg = (text, error = false) => `<span class="${error ? "text-red-600" : "text-slate-500"}">${text}</span>`;

async function loadFill() {
  const token = ++loadToken;
  box.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const snap = await getDocs(query(collection(db, "monthlyEvents"), where("team", "==", api.team()), where("month", "==", month)));
    if (token !== loadToken) return;
    saved = snap.docs[0]?.data() ?? null;
  } catch (err) {
    console.error(err);
    if (token === loadToken) box.innerHTML = `<div class="card card-pad text-sm text-red-600">โหลดข้อมูล Event ไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
    return;
  }
  const who = api.coach();
  draft = saved ? formFromDoc(saved) : { noEvent: false, contactName: who.name ?? "", contactPhone: who.phone ?? "", events: [] };
  statusHtml = "";
  renderFill();
}

async function loadView() {
  const token = ++loadToken;
  box.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const snap = await getDocs(query(collection(db, "monthlyEvents"), where("month", "==", month)));
    if (token !== loadToken) return;
    renderView(overviewModel({ teams: api.teams(), month, docs: snap.docs.map((d) => d.data()) }));
  } catch (err) {
    console.error(err);
    if (token === loadToken) box.innerHTML = `<div class="card card-pad text-sm text-red-600">โหลดข้อมูล Event ไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

async function save() {
  const { value, errors } = validateEventForm(draft);
  if (errors.length) {
    box.querySelector("[data-status]").innerHTML = msg(errors.map(escapeHtml).join("<br>"), true);
    return;
  }
  const btn = box.querySelector('[data-action="save"]');
  btn.disabled = true;
  box.querySelector("[data-status]").innerHTML = msg("กำลังบันทึก...");
  try {
    const team = api.team();
    const submittedDate = todayBangkok();
    await setDoc(doc(db, "monthlyEvents", eventDocId(team, month)), { team, month, ...value, submittedDate, updatedAt: serverTimestamp(), updatedBy: api.uid() });
    saved = { team, month, ...value, submittedDate };
    draft = formFromDoc(saved);
    statusHtml = msg("บันทึกและส่งแล้ว");
    renderFill();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    box.querySelector("[data-status]").innerHTML = msg("บันทึกไม่สำเร็จ: " + escapeHtml(err.message), true);
  }
}

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn || api.mode() !== "fill") return;
  const ev = draft.events[Number(btn.dataset.ev)];
  switch (btn.dataset.action) {
    case "add-event":
      draft.events.push(emptyEvent());
      break;
    case "remove-event":
      draft.events.splice(Number(btn.dataset.ev), 1);
      break;
    case "add-match":
      ev.matches.push(emptyMatchRow());
      break;
    case "remove-match":
      ev.matches.splice(Number(btn.dataset.m), 1);
      break;
    case "toggle-age":
      ev.ageGroups = btn.dataset.age === ALL_AGES ? (AGE_OPTIONS.every((g) => ev.ageGroups.includes(g)) ? [] : [...AGE_OPTIONS]) : toggle(ev.ageGroups, btn.dataset.age);
      break;
    case "toggle-level":
      ev.examLevels = toggle(ev.examLevels, btn.dataset.level);
      break;
    case "save":
      save();
      return;
    default:
      return;
  }
  statusHtml = "";
  renderFill();
}

// ช่องกรอกอัปเดต draft ทันที (ไม่วาดใหม่ระหว่างพิมพ์) — วาดใหม่เฉพาะเมื่อฟอร์มเปลี่ยนรูป (ประเภท/ผลต่อการซ้อม/นักเตะไม่อยู่/ไม่มี Event)
function onField(e) {
  const t = e.target;
  const f = t.dataset.f;
  if (!f) return;
  if (f === "month") {
    if (e.type !== "change") return;
    month = t.value;
    if (api.mode() === "fill") loadFill();
    else loadView();
    return;
  }
  if (api.mode() !== "fill") return;
  if (f === "noEvent") {
    draft.noEvent = t.checked;
    renderFill();
    return;
  }
  if (t.dataset.ev === undefined) {
    draft[f] = t.value;
    return;
  }
  const ev = draft.events[Number(t.dataset.ev)];
  if (t.dataset.m !== undefined) {
    ev.matches[Number(t.dataset.m)][f] = t.value;
    return;
  }
  ev[f] = t.value;
  if (e.type === "change" && (f === "type" || f === "impact" || f === "awayMode")) {
    if (f === "type" && isExamType(t.value)) ev.ageGroups = [];
    if (f === "type" && isMatchType(t.value) && ev.matches.length === 0) ev.matches.push(emptyMatchRow());
    statusHtml = "";
    renderFill();
  }
}

export function initTeamEvents(container, coachApi) {
  box = container;
  api = coachApi;
  box.addEventListener("click", onClick);
  box.addEventListener("input", onField);
  box.addEventListener("change", onField);
}

export function showTeamEvents() {
  month = defaultMonth(todayBangkok());
  return api.mode() === "fill" ? loadFill() : loadView();
}
