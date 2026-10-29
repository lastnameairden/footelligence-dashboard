// หน้า Event ประจำเดือน: โค้ชกรอกของทีมตัวเอง (โหมดกรอก) · ทีมหลังบ้าน/แอดมินดูสถานะและรายการของโรงเรียนที่เลือก (โหมดดู) — ตรรกะอยู่ที่ team-events.js
// ฟอร์มสร้างด้วย JS จึงอ้างอิง element ผ่าน data-* ใน container ไม่ใช้ id
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { coachPositionLabel, escapeHtml, teamLogoImg, todayBangkok } from "./ui-utils.js";
import { printSheet } from "./print-sheet.js";
import { icon } from "./icons.js";
import {
  ALL_AGES,
  AWAY_MODES,
  CHANGE_REASONS,
  EVENT_TYPES,
  EXAM_LEVELS,
  IMPACTS,
  LEAVE_CHANGES,
  MAX_MATCHES,
  SUBSTITUTE_OPTIONS,
  VENUES,
  ageGroupForLevel,
  ageGroupsForExamLevels,
  bangkokStamp,
  dateLabel,
  deadlineLabel,
  defaultMonth,
  dueInfo,
  emptyEvent,
  emptyMatchRow,
  eventDocId,
  formFromDoc,
  kindOfType,
  monthLabel,
  monthOptions,
  coachEntriesHtml,
  teamEventsModel,
  teamEventsSheetHtml,
  teamOverviewHtml,
  validateEventForm
} from "./team-events.js";

// api = { mode() = "fill" | "view", team() = ทีมของโค้ช / ทีมที่เปิดดูอยู่ (โหมดดูแสดงเฉพาะโรงเรียนนี้), coach() = { name, phone } ค่าตั้งต้นของผู้กรอก, uid(),
//         coachId() = โค้ชเจ้าของฟอร์ม, ageGroups() = รุ่นที่โค้ชคนนี้รับผิดชอบ (กรอกได้เฉพาะรุ่นเหล่านี้) }
let api = null;
let box = null;
let month = "";
let draft = null;
let saved = null; // เอกสารของโค้ชคนนี้ในเดือนที่เลือก (null = ยังไม่เคยส่ง)
let teamDocs = []; // เอกสารของทุกคนในทีมในเดือนที่เลือก (แสดงผลการกรอกของโค้ชคนอื่น)
let players = []; // นักกีฬาของทีม (ไว้เลือกชื่อนักเตะที่ไม่อยู่)
let coaches = []; // โค้ชของทีม (ไว้เลือกโค้ชที่ลา)
let statusHtml = "";
let loadToken = 0;

const options = (list, selected, valueOf = (x) => x, labelOf = (x) => x, placeholder = "") =>
  (placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "") +
  list.map((x) => `<option value="${escapeHtml(valueOf(x))}"${valueOf(x) === selected ? " selected" : ""}>${escapeHtml(labelOf(x))}</option>`).join("");

const field = (label, control) => `<div class="event-field"><label class="field-label">${escapeHtml(label)}</label>${control}</div>`;
const chip = (on, attrs, label) => `<button type="button" class="event-chip${on ? " event-chip-on" : ""}" aria-pressed="${on}" ${attrs}>${escapeHtml(label)}</button>`;
const input = (at, f, type, value, extra = "") => `<input type="${type}" class="field-input" ${at} data-f="${f}" value="${escapeHtml(value)}" ${extra} />`;

// รุ่นที่โค้ชคนนี้กรอกได้ (เรียงจากน้อยไปมาก) — ไม่มีรุ่น = กรอกไม่ได้
const myGroups = () => [...api.ageGroups()].sort((a, b) => Number(String(a).replace(/\D/g, "")) - Number(String(b).replace(/\D/g, "")));

const playerName = (p) => p.nickname || p.fullName || p.id;
const byAgeThenName = (a, b) => String(a.ageGroup).localeCompare(String(b.ageGroup), "en", { numeric: true }) || String(playerName(a)).localeCompare(String(playerName(b)), "th");

function matchRowHtml(ei, mi, m) {
  const at = `data-ev="${ei}" data-m="${mi}"`;
  return `<div class="event-match-row">
    <span class="event-match-no">นัด ${mi + 1}</span>
    ${input(at, "date", "date", m.date, 'aria-label="วันแข่ง"')}
    <select class="field-input" ${at} data-f="venue" aria-label="ทีมเป็นเหย้า/เยือน">${options(VENUES, m.venue)}</select>
    ${input(at, "time", "time", m.time, 'aria-label="เวลาแข่งขัน"')}
  </div>`;
}

function awayChipsHtml(i, e) {
  if (!e.awayPlayers.length) return `<p class="text-xs text-slate-500">${e.awayCount ? `ข้อมูลเดิมระบุไว้ ${escapeHtml(e.awayCount)} คน — เลือกชื่อใหม่เพื่อแทนที่` : "ยังไม่ได้เลือกชื่อ"}</p>`;
  return `<div class="event-chips">${e.awayPlayers.map((p) => chip(true, `data-ev="${i}" data-action="remove-away" data-pid="${escapeHtml(p.id)}"`, `${p.name}${p.ageGroup ? ` · ${p.ageGroup}` : ""} ✕`)).join("")}</div><p class="text-xs text-slate-500">เลือกแล้ว ${e.awayPlayers.length} คน</p>`;
}

// รายชื่อนักกีฬาให้เลือก: เฉพาะรุ่นที่เลือกไว้ใน Event นี้ (ค้นหาด้วยการซ่อน/แสดงแถว ไม่วาดใหม่ระหว่างพิมพ์)
function awayPickerHtml(i, e) {
  const picked = new Set(e.awayPlayers.map((p) => p.id));
  const list = players.filter((p) => e.ageGroups.includes(p.ageGroup)).sort(byAgeThenName);
  const rows = list
    .map((p) => `<label class="event-player" data-search="${escapeHtml(`${playerName(p)} ${p.fullName ?? ""} ${p.ageGroup}`.toLowerCase())}"><input type="checkbox" data-ev="${i}" data-f="awayPlayer" data-pid="${escapeHtml(p.id)}"${picked.has(p.id) ? " checked" : ""} /> ${escapeHtml(playerName(p))} <span class="text-slate-500">· ${escapeHtml(p.ageGroup)}${p.fullName && p.fullName !== playerName(p) ? ` · ${escapeHtml(p.fullName)}` : ""}</span></label>`)
    .join("");
  const body = e.ageGroups.length === 0 ? '<p class="text-xs text-slate-500">เลือกรุ่นที่เกี่ยวข้องก่อน แล้วรายชื่อนักกีฬาของรุ่นนั้นจะขึ้นที่นี่</p>' : list.length === 0 ? '<p class="text-xs text-slate-500">ไม่พบนักกีฬาในรุ่นที่เลือก</p>' : `<input type="text" class="field-input" data-ev="${i}" data-f="awaySearch" placeholder="ค้นหาชื่อเล่นหรือชื่อจริง" /><div class="event-player-list" data-player-list="${i}">${rows}</div>`;
  return `<div data-away-chips="${i}">${awayChipsHtml(i, e)}</div>${body}`;
}

function ageChipsHtml(e, at) {
  if (kindOfType(e.type) === "exam") {
    const mine = myGroups();
  return `<div class="event-chips">${EXAM_LEVELS.filter((l) => mine.includes(ageGroupForLevel(l))).map((l) => chip(e.examLevels.includes(l), `${at} data-action="toggle-level" data-level="${l}"`, l)).join("")}</div>
       <p class="text-xs text-slate-500">รุ่นที่เกี่ยวข้อง (ระบบแปลงจากชั้นที่สอบ): ${escapeHtml(ageGroupsForExamLevels(e.examLevels).join(", ") || "-")}</p>`;
  }
  const mine = myGroups();
  return `<div class="event-chips">${mine.map((g) => chip(e.ageGroups.includes(g), `${at} data-action="toggle-age" data-age="${g}"`, g)).join("")}${mine.length > 1 ? chip(mine.every((g) => e.ageGroups.includes(g)), `${at} data-action="toggle-age" data-age="${ALL_AGES}"`, "ทุกรุ่นของฉัน") : ""}</div>`;
}

function coachOptions(e) {
  const mine = myGroups();
  const list = coaches.filter((c) => c.id === api.coachId() || (c.ageGroups || []).some((g) => mine.includes(g))).map((c) => ({ id: c.id, label: `${c.name ?? c.email ?? "-"}${c.coachPosition ? ` (${coachPositionLabel(c.coachPosition)})` : ""}` }));
  if (e.coachId && !list.some((c) => c.id === e.coachId)) list.push({ id: e.coachId, label: e.coachName });
  return options(list, e.coachId, (c) => c.id, (c) => c.label, "เลือกโค้ช");
}

// ส่วนที่เฉพาะแต่ละประเภทของ "แจ้งเปลี่ยนตารางซ้อม"
function scheduleFieldsHtml(e, at) {
  switch (kindOfType(e.type)) {
    case "change-day":
      return `<div class="event-grid">
        ${field("เหตุผล", `<select class="field-input" ${at} data-f="reason">${options(CHANGE_REASONS, e.reason, (x) => x, (x) => x, "เลือกเหตุผล")}</select>`)}
        ${field("วันซ้อมเดิม", input(at, "oldDate", "date", e.oldDate))}
        ${field("เปลี่ยนเป็นวันที่", input(at, "newDate", "date", e.newDate))}
      </div>`;
    case "change-time":
      return `<div class="event-grid">
        ${field("วันที่เริ่ม", input(at, "start", "date", e.start))}
        ${field("วันที่จบ", input(at, "end", "date", e.end))}
        ${field("เวลาเดิม · เริ่ม", input(at, "oldStart", "time", e.oldStart))}
        ${field("เวลาเดิม · จบ", input(at, "oldEnd", "time", e.oldEnd))}
        ${field("เวลาใหม่ · เริ่ม", input(at, "newStart", "time", e.newStart))}
        ${field("เวลาใหม่ · จบ", input(at, "newEnd", "time", e.newEnd))}
      </div>`;
    case "coach-leave":
      return `<div class="event-grid">
        ${field("โค้ชที่ไม่อยู่", `<select class="field-input" ${at} data-f="coachId">${coachOptions(e)}</select>`)}
        ${field("วันที่เริ่ม", input(at, "start", "date", e.start))}
        ${field("วันที่จบ", input(at, "end", "date", e.end))}
        ${field("มีผู้ฝึกสอนแทนหรือไม่", `<select class="field-input" ${at} data-f="substitute">${options(SUBSTITUTE_OPTIONS, e.substitute, (x) => x.key, (x) => x.label)}</select>`)}
      </div>
      ${
        e.substitute === "yes"
          ? field("ชื่อผู้ฝึกสอนแทน", input(at, "substituteName", "text", e.substituteName, 'maxlength="80"'))
          : `<div class="event-sub-box">
              ${field("ไม่มีผู้ฝึกสอนแทน — ต้องการเปลี่ยนแปลงอย่างไร (เลือกได้หลายข้อ)", `<div class="event-chips">${LEAVE_CHANGES.map((c) => chip(e.changes.includes(c), `${at} data-action="toggle-change" data-change="${c}"`, c)).join("")}</div>`)}
              ${field("รายละเอียด / วันและเวลาที่ขอเปลี่ยน", input(at, "changeDetail", "text", e.changeDetail, 'maxlength="200"'))}
            </div>`
      }`;
    default:
      return "";
  }
}

function eventHtml(e, i) {
  const at = `data-ev="${i}"`;
  const kind = kindOfType(e.type);
  const schedule = kind === "change-day" || kind === "change-time" || kind === "coach-leave";
  const typeSelect = field("ประเภท", `<select class="field-input" ${at} data-f="type">${options(EVENT_TYPES, e.type, (t) => t.key, (t) => t.label, "เลือกประเภท")}</select>`);
  const ages = field(kind === "exam" ? "ชั้นที่สอบ (เลือกได้หลายชั้น)" : kind === "coach-leave" ? "รุ่นที่ได้รับผลกระทบ" : "รุ่นที่เกี่ยวข้อง (เลือกได้หลายข้อ)", ageChipsHtml(e, at));
  const note = field("หมายเหตุ (ไม่บังคับ)", input(at, "note", "text", e.note, 'maxlength="200"'));
  const head = `<div class="event-card-head"><strong>Event ${i + 1}</strong><button type="button" class="btn btn-ghost-danger btn-sm" data-action="remove-event" ${at}>ลบรายการ</button></div>`;
  if (schedule) return `<div class="event-card">${head}${typeSelect}${ages}${scheduleFieldsHtml(e, at)}${note}</div>`;

  const matchBlock =
    kind === "match"
      ? `${field("จำนวนนัดที่แข่ง", input(at, "matchCount", "number", e.matches.length || "", `min="1" max="${MAX_MATCHES}"`))}
         ${e.matches.length ? field("วันแข่งแต่ละนัด · ทีมเป็นเหย้า/เยือน · เวลาแข่งขัน", `<div class="event-matches">${e.matches.map((m, mi) => matchRowHtml(i, mi, m)).join("")}</div>`) : ""}`
      : "";
  return `<div class="event-card">${head}
    ${typeSelect}
    ${field("ชื่อรายการ / กิจกรรม", input(at, "title", "text", e.title, 'maxlength="80"'))}
    <div class="event-grid">
      ${field("วันที่เริ่ม", input(at, "start", "date", e.start))}
      ${field("วันที่จบ", input(at, "end", "date", e.end))}
    </div>
    ${ages}
    <div class="event-grid">
      ${field("ผลต่อการซ้อม", `<select class="field-input" ${at} data-f="impact">${options(IMPACTS, e.impact, (x) => x.key, (x) => x.label, "เลือกผลต่อการซ้อม")}</select>`)}
      ${e.impact === "partial" ? `<label class="flex items-center gap-2 text-sm event-check"><input type="checkbox" ${at} data-f="practiceNormal"${e.practiceNormal ? " checked" : ""} /> ซ้อมตามเวลาปกติ</label>` + (e.practiceNormal ? "" : field("ช่วงเวลาที่ซ้อม · เวลาเริ่ม", input(at, "practiceStart", "time", e.practiceStart)) + field("ช่วงเวลาที่ซ้อม · เวลาจบ", input(at, "practiceEnd", "time", e.practiceEnd))) : ""}
      ${field("นักเตะที่ไม่อยู่", `<select class="field-input" ${at} data-f="awayMode">${options(AWAY_MODES, e.awayMode, (x) => x.key, (x) => x.label)}</select>`)}
    </div>
    ${e.awayMode === "some" ? field("เลือกชื่อนักเตะที่ไม่อยู่", awayPickerHtml(i, e)) : ""}
    ${matchBlock}
    ${note}
  </div>`;
}

function dueBadge() {
  const info = dueInfo({ month, now: bangkokStamp(), submitted: !!saved });
  const when = deadlineLabel(month);
  if (!saved && teamDocs.some((d) => !d.coachId)) return `<span class="badge badge-neutral">มีข้อมูลเดิมที่กรอกทั้งทีม · กรอกของคุณเพิ่ม</span>`;
  if (info.state === "submitted") return `<span class="badge badge-success">ส่งแล้ว${saved.submittedDate ? ` ${escapeHtml(dateLabel(saved.submittedDate))}` : ""}</span>`;
  return info.state === "overdue" ? `<span class="badge badge-danger">เลยกำหนด ${escapeHtml(when)}</span>` : `<span class="badge badge-warning">ครบกำหนด ${escapeHtml(when)}</span>`;
}

function renderFill() {
  const team = api.team();
  const model = teamEventsModel({ team, month, docs: teamDocs, coaches });
  box.innerHTML = `<div class="card card-pad space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2"><h3 class="section-title">แจ้ง Event ประจำเดือน</h3>${dueBadge()}</div>
    <div class="event-grid">
      ${field("โรงเรียน", `<select class="field-input" disabled><option>${escapeHtml(team)}</option></select>`)}
      ${field("แจ้งสำหรับเดือน", `<select class="field-input" data-f="month">${options(monthOptions(todayBangkok()), month, (m) => m, monthLabel)}</select>`)}
      ${field("รุ่นที่คุณกรอกได้", `<input type="text" class="field-input" disabled value="${escapeHtml(myGroups().join(", "))}" />`)}
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
    <p class="text-xs text-slate-500">กรอกได้เฉพาะรุ่นที่คุณดูแล แก้ไขได้ตลอดเดือน (เช่น เพิ่มโค้ชลาหรือเปลี่ยนเวลาซ้อม) ส่งซ้ำจะทับของเดิมของคุณ ไม่กระทบของโค้ชคนอื่น — ทีมหลังบ้านและผู้ดูแลระบบเห็นผลของทุกคนและวันที่แก้ไขล่าสุดในเมนู Event</p>
  </div>
  <div class="card card-pad space-y-3">
    <h3 class="section-title">การกรอกของโค้ชคนอื่นในทีม · ${escapeHtml(monthLabel(month))}</h3>
    <p class="text-xs text-slate-500">ดูอย่างเดียว — โค้ชแต่ละคนแก้ได้เฉพาะของตัวเอง</p>
    ${coachEntriesHtml(model, { excludeCoachId: api.coachId() })}
  </div>`;
}

function renderView(model) {
  // หน้าจอ: ตัวเลือกเดือน + สรุป · เวลาสั่งพิมพ์: แสดงเฉพาะใบพิมพ์ (.print-only) ที่ซ่อนส่วนอื่น (.no-print) — กลไกเดียวกับ Match Data (print-sheet.js)
  const sheet = teamEventsSheetHtml(model, { logo: teamLogoImg(model.team, "sheet-logo"), printedAt: new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }) });
  box.innerHTML = `<div class="card card-pad flex items-center gap-3 flex-wrap no-print">
      <label class="field-label mb-0">เดือน</label>
      <select class="field-input" style="width:auto" data-f="month">${options(monthOptions(todayBangkok()), month, (m) => m, monthLabel)}</select>
      <p class="text-sm text-slate-500 flex-1">ดูอย่างเดียว · โค้ชแต่ละคนกรอกเฉพาะรุ่นของตัวเอง</p>
      <button type="button" class="btn btn-secondary" data-action="print-events">${icon("printer")} พิมพ์ผลการแจ้ง Event</button>
    </div><div class="space-y-4 no-print">${teamOverviewHtml(model)}</div><div class="print-only">${sheet}</div>`;
}

const msg = (text, error = false) => `<span class="${error ? "text-red-600" : "text-slate-500"}">${text}</span>`;
const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// นักกีฬา/โค้ชของทีม (โหลดครั้งเดียวต่อทีม) — ดึงไม่สำเร็จก็ฟอร์มยังกรอกได้ แค่ไม่มีรายชื่อให้เลือก
let rosterTeam = "";
async function loadRoster() {
  const team = api.team();
  if (rosterTeam === team) return;
  const [p, c] = await Promise.all([
    getDocs(query(collection(db, "players"), where("team", "==", team))).then(docsOf).catch((err) => (console.error(err), [])),
    getDocs(query(collection(db, "coaches"), where("team", "==", team))).then(docsOf).catch((err) => (console.error(err), []))
  ]);
  players = p;
  coaches = c.filter((x) => x.role === "coach" && x.status === "approved").sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
  rosterTeam = team;
}

async function loadFill() {
  const token = ++loadToken;
  box.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const [snap] = await Promise.all([getDocs(query(collection(db, "monthlyEvents"), where("team", "==", api.team()), where("month", "==", month))), loadRoster()]);
    if (token !== loadToken) return;
    teamDocs = snap.docs.map((d) => d.data());
    saved = teamDocs.find((d) => d.coachId && d.coachId === api.coachId()) ?? null;
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
    const [snap, coachSnap] = await Promise.all([
      getDocs(query(collection(db, "monthlyEvents"), where("team", "==", api.team()), where("month", "==", month))),
      getDocs(query(collection(db, "coaches"), where("team", "==", api.team()))).catch((err) => (console.error(err), null))
    ]);
    if (token !== loadToken) return;
    const teamCoaches = (coachSnap ? docsOf(coachSnap) : []).filter((x) => x.role === "coach" && x.status === "approved");
    renderView(teamEventsModel({ team: api.team(), month, docs: snap.docs.map((d) => d.data()), coaches: teamCoaches }));
  } catch (err) {
    console.error(err);
    if (token === loadToken) box.innerHTML = `<div class="card card-pad text-sm text-red-600">โหลดข้อมูล Event ไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

async function save() {
  const { value, errors } = validateEventForm(draft, { allowedAgeGroups: myGroups() });
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
    const firstSubmittedDate = saved?.firstSubmittedDate ?? saved?.submittedDate ?? submittedDate; // แก้หลังส่ง = วันที่ส่งครั้งแรกยังคงเดิม ทีมหลังบ้านเห็นวันที่แก้ไขล่าสุด
    const coachId = api.coachId();
    const payload = { team, month, coachId, coachName: api.coachName() || "-", coachAgeGroups: myGroups(), ...value, submittedDate, firstSubmittedDate };
    await setDoc(doc(db, "monthlyEvents", eventDocId(team, month, coachId)), { ...payload, updatedAt: serverTimestamp(), updatedBy: api.uid() });
    saved = payload;
    teamDocs = [...teamDocs.filter((d) => d.coachId !== coachId), payload];
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
const refreshAwayChips = (i) => {
  const el = box.querySelector(`[data-away-chips="${i}"]`);
  if (el) el.innerHTML = awayChipsHtml(i, draft.events[i]);
};

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (btn?.dataset.action === "print-events") return printSheet("size: A4 portrait; margin: 10mm;");
  if (!btn || api.mode() !== "fill") return;
  const ev = draft.events[Number(btn.dataset.ev)];
  switch (btn.dataset.action) {
    case "add-event":
      draft.events.push(emptyEvent());
      break;
    case "remove-event":
      draft.events.splice(Number(btn.dataset.ev), 1);
      break;
    case "toggle-age":
      ev.ageGroups = btn.dataset.age === ALL_AGES ? (myGroups().every((g) => ev.ageGroups.includes(g)) ? [] : [...myGroups()]) : toggle(ev.ageGroups, btn.dataset.age);
      ev.awayPlayers = ev.awayPlayers.filter((p) => !p.ageGroup || ev.ageGroups.includes(p.ageGroup)); // รุ่นที่เอาออกแล้ว ไม่เก็บชื่อนักกีฬาของรุ่นนั้น
      break;
    case "toggle-level":
      ev.examLevels = toggle(ev.examLevels, btn.dataset.level);
      ev.ageGroups = ageGroupsForExamLevels(ev.examLevels);
      break;
    case "toggle-change":
      ev.changes = toggle(ev.changes, btn.dataset.change);
      break;
    case "remove-away": {
      ev.awayPlayers = ev.awayPlayers.filter((p) => p.id !== btn.dataset.pid);
      ev.awayCount = ev.awayPlayers.length || "";
      refreshAwayChips(Number(btn.dataset.ev));
      const cb = [...box.querySelectorAll('[data-f="awayPlayer"]')].find((c) => c.dataset.ev === btn.dataset.ev && c.dataset.pid === btn.dataset.pid);
      if (cb) cb.checked = false;
      return;
    }
    case "save":
      save();
      return;
    default:
      return;
  }
  statusHtml = "";
  renderFill();
}

function setMatchCount(ev, raw) {
  const n = Math.max(0, Math.min(MAX_MATCHES, Math.floor(Number(raw)) || 0));
  while (ev.matches.length < n) ev.matches.push(emptyMatchRow());
  ev.matches.length = n;
}

// ช่องกรอกอัปเดต draft ทันที (ไม่วาดใหม่ระหว่างพิมพ์) — วาดใหม่เฉพาะเมื่อฟอร์มเปลี่ยนรูป (ประเภท/ผลต่อการซ้อม/นักเตะไม่อยู่/ผู้ฝึกสอนแทน/จำนวนนัด/ไม่มี Event)
const RESHAPE = new Set(["type", "impact", "awayMode", "substitute"]);
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
  if (f === "awaySearch") {
    const q = t.value.trim().toLowerCase();
    for (const row of box.querySelectorAll(`[data-player-list="${t.dataset.ev}"] .event-player`)) row.hidden = q !== "" && !row.dataset.search.includes(q);
    return;
  }
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
  if (f === "awayPlayer") {
    const p = players.find((x) => x.id === t.dataset.pid);
    ev.awayPlayers = t.checked ? [...ev.awayPlayers.filter((x) => x.id !== t.dataset.pid), { id: p.id, name: playerName(p), ageGroup: p.ageGroup }] : ev.awayPlayers.filter((x) => x.id !== t.dataset.pid);
    ev.awayCount = ev.awayPlayers.length || "";
    refreshAwayChips(Number(t.dataset.ev));
    return;
  }
  if (t.dataset.m !== undefined) {
    ev.matches[Number(t.dataset.m)][f] = t.value;
    return;
  }
  if (f === "matchCount") {
    if (e.type !== "change") return;
    setMatchCount(ev, t.value);
    statusHtml = "";
    renderFill();
    return;
  }
  if (f === "practiceNormal") {
    ev.practiceNormal = t.checked;
    statusHtml = "";
    renderFill();
    return;
  }
  if (f === "coachId") {
    ev.coachId = t.value;
    ev.coachName = coaches.find((c) => c.id === t.value)?.name ?? ev.coachName;
    return;
  }
  ev[f] = t.value;
  if (e.type === "change" && RESHAPE.has(f)) {
    if (f === "type") {
      const kind = kindOfType(t.value);
      if (kind === "exam") ev.ageGroups = [];
      if (kind === "match" && ev.matches.length === 0) ev.matches.push(emptyMatchRow());
      if (kind !== "coach-leave") ev.coachId = ev.coachName = "";
    }
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
