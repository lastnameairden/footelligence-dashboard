// หน้าจอของระบบนัดประชุมโค้ชรายสัปดาห์ (ตรรกะล้วนๆ อยู่ที่ coach-meetings.js)
//   - ผู้ดูแลระบบหลัก: สร้างตารางประจำเดือน เลือกวันพุธ/พฤหัสบดีรายสัปดาห์ ใส่ลิงก์ Google Meet ย้ายโค้ชข้ามสัปดาห์ ยืนยันรายชื่อ/บันทึกผลเข้าประชุม
//   - ผู้ดูแลระบบ + ทีมสต๊าฟ (สิทธิ์ meetings): เขียนวาระ+แนบไฟล์ก่อนประชุม (แยกส่วนกลาง/สายโค้ชผู้เล่น/โค้ชประตู/ฟิตเนสโค้ช)
//     กรอกความคิดเห็นหลังประชุม (โค้ชไม่เห็น) และติดตามงานหลังประชุมที่โค้ชแต่ละคนส่ง
//   - โค้ช: การ์ด "ประชุมครั้งถัดไป" (วาระ+ไฟล์ของส่วนกลางและสายตัวเอง) + งานหลังประชุม (ความรู้ที่ได้ / นำไปใช้ในสนาม) ส่งก่อนกำหนดสิ้นเดือน + แจ้งเตือนที่กระดิ่ง
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  deleteField,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage, auth } from "./firebase-init.js";
import { icon } from "./icons.js";
import { escapeHtml, safeHttpUrl, ageGroupSortKey, teamDateRangeQuery, todayBangkok, thisMonthBangkok } from "./ui-utils.js";
import {
  MEETING_TEAM_SLOTS,
  MEETING_WEEKS_PER_MONTH,
  MEETING_WEEKDAY_LABELS,
  DEFAULT_MEETING_WEEKDAYS,
  MEETING_ATTENDANCE_LABELS,
  MEETING_SECTIONS,
  COACH_RECAP_FIELDS,
  recapDeadline,
  recapDocId,
  recapStatus,
  recapStatusView,
  recapTasksForCoach,
  validateRecapInput,
  addDaysToDate,
  addMonthsToMonth,
  attendanceView,
  buildTeamMeetingDocs,
  coachTrackOf,
  daysUntil,
  describeDaysUntil,
  googleCalendarUrl,
  isValidMeetingLink,
  meetingDate,
  meetingFilePath,
  meetingHistoryRows,
  meetingWeekdayOf,
  nextMeetingForCoach,
  sectionHasPlan,
  sectionsForTrack,
  summarizeMeetingAttendance,
  thaiMeetingDateLabel,
  thaiMonthLabel,
  validateMeetingFile
} from "./coach-meetings.js";

// สีของป้ายสายโค้ช (เขียน class เต็มๆ เพื่อให้ Tailwind สแกนเจอ)
const SECTION_TEXT_CLASS = {
  all: "text-slate-600",
  player: "text-blue-700",
  gk: "text-emerald-700",
  fit: "text-amber-700"
};
const sectionLabel = (key) => MEETING_SECTIONS.find((s) => s.key === key)?.label ?? key;

// ---------- ฝั่งผู้ดูแลระบบ ----------
const monthLabelEl = document.getElementById("admin-meetings-month-label");
const prevBtn = document.getElementById("admin-meetings-prev-btn");
const nextBtn = document.getElementById("admin-meetings-next-btn");
const statusEl = document.getElementById("admin-meetings-status");
const bodyEl = document.getElementById("admin-meetings-body");

let viewMonth = thisMonthBangkok();
let selectedWeek = 1;
let coachesByTeam = new Map(); // team -> [{ id, name, ageGroups, coachPosition }] เรียงตามรุ่นอายุ
let meetings = new Map(); // `${team}|${week}` -> { id, ...data }
let recaps = new Map(); // `${meetingId}_${coachId}` -> งานหลังประชุมที่โค้ชส่งแล้ว
let comments = new Map(); // meetingId -> { all, player, gk, fit } ความคิดเห็นของแอดมิน/ทีมสต๊าฟ
// ทีมสต๊าฟ (สิทธิ์ meetings) เห็นหน้าเดียวกับแอดมินแต่แก้ได้เฉพาะวาระ/ไฟล์/ความคิดเห็น — ลิงก์ Meet ผลเข้าประชุม และการแบ่งกลุ่มเป็นของแอดมินหลัก
let staffMode = false;
// หน้าทีมของทีมหลังบ้าน: แสดงเฉพาะทีมที่เลือก (scopeTeam) และเฉพาะโค้ชที่ดูแลรุ่นที่เลือก (scopeAgeGroup) — null/"" = ไม่กรอง (หน้าแอดมินเดิมเห็นทุกทีม)
// readOnly = ผู้บริหารทีมดูสรุปการประชุมของทีมตัวเอง (อ่านอย่างเดียว): ไม่มีฟอร์มวาระ/ความเห็น/แนบไฟล์ ไม่โหลดความเห็นของแอดมิน (ผู้บริหารไม่มีสิทธิ์อ่าน)
let readOnly = false;
let scopeTeam = null;
let scopeAgeGroup = "";
const scopedSlots = () => (scopeTeam ? MEETING_TEAM_SLOTS.filter((s) => s.team === scopeTeam) : MEETING_TEAM_SLOTS);
// ข้อความที่พิมพ์ค้างไว้ในช่องวาระ/ความคิดเห็น (ยังไม่กดบันทึก) — เก็บไว้เพราะทุกการกระทำโหลดหน้าใหม่ จะได้ไม่หายระหว่างสลับแท็บ/บันทึกอย่างอื่น
const drafts = new Map(); // `${meetingId}|${section}` -> { plan, comment }
const activeSection = new Map(); // meetingId -> section key ที่เปิดอยู่

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

const meetingKey = (team, week) => `${team}|${week}`;
const findMeetingById = (id) => [...meetings.values()].find((x) => x.id === id);

async function reload() {
  monthLabelEl.textContent = thaiMonthLabel(viewMonth);
  bodyEl.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    // เปิดจากหน้าทีม (scopeTeam) ดึงเฉพาะของทีมนั้น — จำเป็นสำหรับผู้บริหารที่กฎ Firestore ให้อ่านได้เฉพาะเอกสารของทีมตัวเอง
    const scope = scopeTeam ? [where("team", "==", scopeTeam)] : [];
    const [coachSnap, meetingSnap, recapSnap, commentSnap] = await Promise.all([
      getDocs(query(collection(db, "coaches"), where("role", "==", "coach"))),
      getDocs(query(collection(db, "coachMeetings"), ...scope, where("month", "==", viewMonth))),
      getDocs(query(collection(db, "coachMeetingRecaps"), ...scope, where("month", "==", viewMonth))),
      readOnly ? Promise.resolve({ forEach: () => {} }) : getDocs(query(collection(db, "coachMeetingComments"), ...scope, where("month", "==", viewMonth)))
    ]);
    const teams = new Set(MEETING_TEAM_SLOTS.map((s) => s.team));
    coachesByTeam = new Map(MEETING_TEAM_SLOTS.map((s) => [s.team, []]));
    coachSnap.forEach((d) => {
      const c = d.data();
      if (c.status !== "approved" || !teams.has(c.team)) return;
      coachesByTeam.get(c.team).push({ id: d.id, name: c.name ?? "-", ageGroups: c.ageGroups || [], coachPosition: c.coachPosition || null });
    });
    for (const list of coachesByTeam.values()) {
      list.sort((a, b) => ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups) || a.name.localeCompare(b.name));
    }
    meetings = new Map();
    meetingSnap.forEach((d) => {
      const m = { id: d.id, ...d.data() };
      meetings.set(meetingKey(m.team, m.week), m);
    });
    recaps = new Map();
    recapSnap.forEach((d) => recaps.set(d.id, d.data()));
    comments = new Map();
    commentSnap.forEach((d) => comments.set(d.id, d.data().comments || {}));
    render();
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = "";
    setStatus("โหลดตารางประชุมไม่สำเร็จ: " + err.message, true);
  }
}

function weekdayOfWeek(week) {
  for (const s of MEETING_TEAM_SLOTS) {
    const m = meetings.get(meetingKey(s.team, week));
    if (m) return meetingWeekdayOf(m.date) || "wed";
  }
  return DEFAULT_MEETING_WEEKDAYS[week - 1];
}

function dateOfWeek(week) {
  for (const s of MEETING_TEAM_SLOTS) {
    const m = meetings.get(meetingKey(s.team, week));
    if (m) return m.date;
  }
  return meetingDate(viewMonth, week, DEFAULT_MEETING_WEEKDAYS[week - 1]);
}

// โค้ชที่อนุมัติแล้วแต่ยังไม่อยู่ในนัดใดของเดือนนี้ (เช่น เพิ่งได้รับอนุมัติหลังสร้างตาราง)
function unassignedCoaches() {
  const out = [];
  for (const s of MEETING_TEAM_SLOTS) {
    const assigned = new Set();
    for (let w = 1; w <= MEETING_WEEKS_PER_MONTH; w++) {
      (meetings.get(meetingKey(s.team, w))?.coachIds || []).forEach((id) => assigned.add(id));
    }
    for (const c of coachesByTeam.get(s.team) || []) {
      if (!assigned.has(c.id)) out.push({ ...c, team: s.team });
    }
  }
  return out;
}

// ชื่อโค้ชในนัดนี้ที่อยู่ในสายที่เลือก (ส่วนกลาง = ทุกคน)
function membersOfSection(m, sec) {
  const roster = new Map((coachesByTeam.get(m.team) || []).map((c) => [c.id, c]));
  const names = m.coachNames || [];
  return (m.coachIds || [])
    .map((id, i) => ({ name: names[i] ?? id, track: coachTrackOf(roster.get(id)?.coachPosition) }))
    .filter((c) => sec === "all" || c.track === sec)
    .map((c) => c.name);
}

function fileTagsHtml(m, sec, files, removable) {
  return files
    .map((f, i) => {
      const href = safeHttpUrl(f.url);
      const name = escapeHtml(f.name);
      const remove = removable
        ? ` <button type="button" class="text-slate-400" data-action="remove-file" data-doc="${escapeHtml(m.id)}" data-sec="${sec}" data-index="${i}" aria-label="ลบไฟล์ ${name}">${icon("close")}</button>`
        : "";
      return `<span class="badge badge-neutral">${icon("paperclip")} ${href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a>` : name}${remove}</span>`;
    })
    .join(" ");
}

// โหมดอ่านอย่างเดียว (ผู้บริหารทีม): วาระและไฟล์ประกอบการประชุมของส่วนนี้ ไม่มีช่องกรอก
function sectionReadHtml(m, sec) {
  const saved = (m.sections || {})[sec] || {};
  const plan = String(saved.plan || "").trim();
  const mine = membersOfSection(m, sec);
  const who = sec === "all" ? "โค้ชทุกคนในกลุ่มเห็น" : `โค้ชสาย${sectionLabel(sec)}ในกลุ่มนี้: ${mine.length ? escapeHtml(mine.join(", ")) : "ไม่มี"}`;
  const files = saved.files || [];
  return `
    <div class="space-y-3">
      <p class="text-xs text-slate-500">${who}</p>
      ${plan ? `<p class="text-sm text-slate-800" ${preLine}>${escapeHtml(plan)}</p>` : '<p class="text-sm text-slate-400">ยังไม่มีวาระในส่วนนี้</p>'}
      ${files.length ? `<div class="flex items-center gap-2 flex-wrap">${fileTagsHtml(m, sec, files, false)}</div>` : ""}
    </div>`;
}

function sectionFormHtml(m, sec) {
  const saved = (m.sections || {})[sec] || {};
  const draft = drafts.get(`${m.id}|${sec}`) || {};
  const plan = escapeHtml(draft.plan ?? saved.plan ?? "");
  const comment = escapeHtml(draft.comment ?? (comments.get(m.id) || {})[sec] ?? "");
  const mine = membersOfSection(m, sec);
  const who = sec === "all" ? "โค้ชทุกคนในกลุ่มเห็น" : `โค้ชสาย${sectionLabel(sec)}ในกลุ่มนี้: ${mine.length ? escapeHtml(mine.join(", ")) : "ไม่มี"}`;
  return `
    <div class="space-y-3" data-section-form>
      <p class="text-xs text-slate-500">${who}</p>
      <div>
        <label class="field-label">ก่อนประชุม: หัวข้อที่จะให้ความรู้</label>
        <textarea rows="3" class="field-input" data-field="plan" data-doc="${escapeHtml(m.id)}" data-sec="${sec}" placeholder="หัวข้อและประเด็นที่จะพูดในส่วนนี้">${plan}</textarea>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${fileTagsHtml(m, sec, saved.files || [], true)}
        <button type="button" class="btn btn-secondary btn-sm" data-action="pick-file">${icon("paperclip")} แนบไฟล์</button>
        <input type="file" class="hidden" accept="image/*,application/pdf" data-file-input data-doc="${escapeHtml(m.id)}" data-sec="${sec}" />
      </div>
      <p class="text-xs text-slate-400">PDF หรือรูปภาพ ไม่เกิน 10MB ต่อไฟล์ แนบได้สูงสุด 3 ไฟล์ต่อส่วน โค้ชเห็นทันทีที่แนบ</p>
      <div>
        <label class="field-label">ความคิดเห็นหลังประชุม <span class="badge badge-neutral">${icon("lock")} โค้ชไม่เห็น</span></label>
        <textarea rows="2" class="field-input" data-field="comment" data-doc="${escapeHtml(m.id)}" data-sec="${sec}" placeholder="สิ่งที่สังเกตจากการประชุม แนวทางต่อยอด คำชม">${comment}</textarea>
      </div>
      <div><button type="button" class="btn btn-primary btn-sm" data-action="save-section" data-doc="${escapeHtml(m.id)}" data-sec="${sec}">บันทึกส่วน${sectionLabel(sec)}</button></div>
    </div>`;
}

// ป้ายสถานะงานหลังประชุมของโค้ชคนหนึ่ง (ว่างถ้ายังไม่ถึงวันประชุม) — class เขียนเต็มเพื่อให้ Tailwind/เทสต์สแกนเจอ
const RECAP_TONE_BADGE = {
  success: "badge badge-success",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
  neutral: "badge badge-neutral"
};

function recapStatusBadge(status) {
  if (status.state === "upcoming") return "";
  const view = recapStatusView(status);
  return `<span class="${RECAP_TONE_BADGE[view.tone]}">${escapeHtml(view.text)}</span>`;
}

// คำตอบที่โค้ชส่งแล้ว กางดูได้ในแถวของโค้ชคนนั้น
function recapAnswerHtml(recap) {
  const rows = COACH_RECAP_FIELDS.map(
    (f) => `<div class="mt-2">
        <p class="text-xs font-semibold text-slate-500">${f.label}</p>
        <p class="text-sm text-slate-800" ${preLine}>${escapeHtml(recap[f.key] || "-")}</p>
      </div>`
  ).join("");
  return `<details class="w-full"><summary class="text-xs text-blue-700 cursor-pointer">ดูคำตอบ</summary>${rows}</details>`;
}
// โค้ชในนัดนี้ที่ผ่านตัวกรองรุ่นอายุ (ไม่ได้เลือกรุ่น = ทุกคน)
function keptCoachIds(m) {
  const ids = (m && m.coachIds) || [];
  if (!scopeAgeGroup) return ids;
  const roster = new Map((coachesByTeam.get(m.team) || []).map((c) => [c.id, c]));
  return ids.filter((id) => (roster.get(id)?.ageGroups || []).includes(scopeAgeGroup));
}

function render() {
  setStatus("");
  if (meetings.size === 0) {
    const total = [...coachesByTeam.values()].reduce((n, l) => n + l.length, 0);
    if (staffMode) {
      bodyEl.innerHTML = `<div class="card card-pad text-center"><p class="text-sm text-slate-500">ยังไม่มีตารางประชุมของ${escapeHtml(thaiMonthLabel(viewMonth))} — ผู้ดูแลระบบหลักเป็นผู้สร้างตาราง</p></div>`;
      return;
    }
    bodyEl.innerHTML = `
      <div class="card card-pad text-center space-y-3">
        <p class="font-semibold text-slate-900">ยังไม่มีตารางประชุมของ${escapeHtml(thaiMonthLabel(viewMonth))}</p>
        <p class="text-sm text-slate-500">ระบบจะแบ่งโค้ชทั้ง ${total} คนเป็น 4 กลุ่มเฉลี่ยกัน กลุ่มละหนึ่งสัปดาห์ สลับวันพุธ/พฤหัสบดี (ปรับได้ภายหลัง)</p>
        <div><button type="button" class="btn btn-primary" data-action="generate"${total === 0 ? " disabled" : ""}>สร้างตารางประชุมเดือนนี้</button></div>
      </div>`;
    return;
  }

  let html = '<div class="space-y-2">';
  for (let w = 1; w <= MEETING_WEEKS_PER_MONTH; w++) {
    const day = weekdayOfWeek(w);
    const selected = w === selectedWeek;
    const counts = scopedSlots().map((s) => keptCoachIds(meetings.get(meetingKey(s.team, w))).length);
    html += `
      <div class="card card-pad flex items-center gap-3 flex-wrap cursor-pointer ${selected ? "ring-2 ring-blue-500" : ""}" data-action="select-week" data-week="${w}">
        <span class="font-semibold text-slate-900 w-24">สัปดาห์ ${w}</span>
        ${
          staffMode
            ? `<span class="badge badge-neutral">วัน${MEETING_WEEKDAY_LABELS[day]}</span>`
            : `<span class="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          ${["wed", "thu"]
            .map((d) => {
              const dayCls = d === day ? "bg-blue-50 text-blue-700 font-semibold" : "bg-white text-slate-600";
              return `<button type="button" data-action="weekday" data-week="${w}" data-day="${d}" class="px-3 py-1 text-sm ${dayCls}">${MEETING_WEEKDAY_LABELS[d]}</button>`;
            })
            .join("")}
        </span>`
        }
        <span class="text-sm text-slate-700">${escapeHtml(thaiMeetingDateLabel(dateOfWeek(w)))}</span>
        <span class="text-xs text-slate-500 ml-auto">โค้ช ${counts.join(" / ")} คน</span>
      </div>`;
  }
  html += "</div>";

  html += `<div class="flex items-center gap-2 flex-wrap mt-4">
      <h3 class="font-semibold text-slate-900">สัปดาห์ ${selectedWeek} · ${escapeHtml(thaiMeetingDateLabel(dateOfWeek(selectedWeek)))}</h3>
      ${staffMode ? "" : `<button type="button" class="btn btn-secondary btn-sm ml-auto" data-action="regroup">${icon("refresh")} แบ่งกลุ่มใหม่อัตโนมัติ</button>`}
    </div>
    <div class="space-y-3">`;

  for (const slot of scopedSlots()) {
    const m = meetings.get(meetingKey(slot.team, selectedWeek));
    if (!m) {
      html += `<div class="card card-pad"><p class="font-semibold text-slate-900">${escapeHtml(slot.team)}</p><p class="text-sm text-slate-500">ไม่มีนัดในสัปดาห์นี้</p></div>`;
      continue;
    }
    const keptIds = keptCoachIds(m);
    const sum = summarizeMeetingAttendance({ ...m, coachIds: keptIds });
    const names = m.coachNames || [];
    const todayStr = todayBangkok();
    // แถวละโค้ช มีปุ่มเลือกผลชัดเจน 3 ปุ่ม (เข้าร่วม/ลา/ขาด) ปุ่มที่เลือกอยู่เป็นสีเต็ม กดซ้ำเพื่อล้าง (เฉพาะแอดมินหลัก — ทีมสต๊าฟเห็นผลอย่างเดียว)
    const statusStyles = {
      attended: "bg-emerald-600 text-white",
      leave: "bg-amber-500 text-white",
      absent: "bg-red-600 text-white"
    };
    const rows = (m.coachIds || [])
      .map((id, i) => {
        if (!keptIds.includes(id)) return "";
        const current = (m.attendance || {})[id] || "";
        const buttons = ["attended", "leave", "absent"]
          .map((status) => {
            const cls = status === current ? statusStyles[status] : "bg-white text-slate-600";
            return `<button type="button" class="px-3 py-1 text-sm ${cls}" data-action="attendance-set" data-doc="${escapeHtml(m.id)}" data-coach="${escapeHtml(id)}" data-status="${status}" aria-pressed="${status === current}">${MEETING_ATTENDANCE_LABELS[status]}</button>`;
          })
          .join("");
        const attendanceControl = staffMode
          ? `<span class="badge badge-neutral">${current ? MEETING_ATTENDANCE_LABELS[current] : "ยังไม่บันทึกผลเข้าประชุม"}</span>`
          : `<span class="inline-flex rounded-lg border border-slate-200 overflow-hidden">${buttons}</span>${current ? "" : '<span class="text-xs text-slate-400">ยังไม่บันทึก</span>'}`;
        const recap = recaps.get(recapDocId(m.id, id)) || null;
        const recapBadge = recapStatusBadge(recapStatus(m, id, recap, todayStr));
        return `<div class="flex items-center gap-3 flex-wrap">
          <span class="text-sm font-medium text-slate-800 w-32">${escapeHtml(names[i] ?? id)}</span>
          ${attendanceControl}
          ${recapBadge}
          ${recap ? recapAnswerHtml(recap) : ""}
        </div>`;
      })
      .join("");
    const moveOptions = (m.coachIds || []).map((id, i) => `<option value="${escapeHtml(id)}">${escapeHtml(names[i] ?? id)}</option>`).join("");
    const weekOptions = Array.from({ length: MEETING_WEEKS_PER_MONTH }, (_, i) => i + 1)
      .filter((w) => w !== selectedWeek && meetings.has(meetingKey(slot.team, w)))
      .map((w) => `<option value="${w}">สัปดาห์ ${w}</option>`)
      .join("");
    const sec = activeSection.get(m.id) || "all";
    const tabs = MEETING_SECTIONS.map((s) => {
      const filled = sectionHasPlan((m.sections || {})[s.key]) || String((comments.get(m.id) || {})[s.key] || "").trim() !== "";
      return `<button type="button" class="badge ${s.key === sec ? "badge-info" : "badge-neutral"} cursor-pointer" data-action="sec-tab" data-doc="${escapeHtml(m.id)}" data-sec="${s.key}">${s.label}${filled ? " ●" : ""}</button>`;
    }).join(" ");
    const safeLink = safeHttpUrl(m.meetLink);
    const linkControl = staffMode
      ? `<p class="text-sm text-slate-600">${icon("link")} ${safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.meetLink)}</a>` : "ผู้ดูแลระบบหลักยังไม่ได้ใส่ลิงก์ Google Meet"}</p>`
      : `<div class="flex items-center gap-2 flex-wrap">
          <input type="text" class="field-input flex-1" data-link-input placeholder="https://meet.google.com/abc-defg-hij" value="${escapeHtml(m.meetLink || "")}" />
          <button type="button" class="btn btn-secondary btn-sm" data-action="save-link" data-doc="${escapeHtml(m.id)}">บันทึกลิงก์</button>
        </div>`;
    const moveControl =
      !staffMode && moveOptions && weekOptions
        ? `<div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-slate-500">ย้ายโค้ช</span>
          <select class="field-input" style="width:auto" data-move-coach>${moveOptions}</select>
          <span class="text-xs text-slate-500">ไป</span>
          <select class="field-input" style="width:auto" data-move-week>${weekOptions}</select>
          <button type="button" class="btn btn-secondary btn-sm" data-action="move" data-doc="${escapeHtml(m.id)}">ย้าย</button>
        </div>`
        : "";
    const rowsHeading = staffMode ? "ผลเข้าประชุม + งานหลังประชุมของโค้ช" : "ผลเข้าประชุม (เลือกได้ทีละคน กดซ้ำที่ปุ่มเดิมเพื่อล้าง) + งานหลังประชุมของโค้ช";
    html += `
      <div class="card card-pad space-y-3" data-slot-doc="${escapeHtml(m.id)}">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-slate-900">${escapeHtml(slot.team)}</span>
          <span class="text-sm text-slate-500 whitespace-nowrap">${icon("clock")} ${escapeHtml(m.startTime)}–${escapeHtml(m.endTime)} น.</span>
          <span class="text-xs text-slate-500 ml-auto">เข้าร่วม ${sum.attended} · ลา ${sum.leave} · ขาด ${sum.absent} · รอบันทึก ${sum.pending}</span>
        </div>
        <div class="space-y-2">
          <p class="text-xs font-semibold text-slate-600">${rowsHeading}</p>
          ${rows || '<span class="text-sm text-slate-400">ไม่มีโค้ชในกลุ่มนี้</span>'}
          <p class="text-xs text-slate-400">โค้ชส่งงานได้ถึง ${escapeHtml(thaiMeetingDateLabel(recapDeadline(m.month)))} (ก่อน 2 วันสุดท้ายของเดือน) ผู้ที่ลา/ขาดไม่ต้องส่ง</p>
        </div>
        ${linkControl}
        ${moveControl}
        <div class="border-t border-slate-100 pt-3 space-y-3">
          <p class="font-semibold text-slate-900 text-sm">${readOnly ? "วาระและเอกสารประกอบการประชุม" : "วาระก่อนประชุม และความคิดเห็นหลังประชุม"}</p>
          <div class="flex flex-wrap gap-2">${tabs}</div>
          ${readOnly ? sectionReadHtml(m, sec) : sectionFormHtml(m, sec)}
        </div>
      </div>`;
  }
  html += "</div>";
  const missing = staffMode ? [] : unassignedCoaches();
  if (missing.length > 0) {
    html += `<div class="card card-warning card-pad space-y-2 mt-4">
      <p class="text-sm font-semibold text-amber-800">${icon("alert-triangle")} โค้ชที่ยังไม่อยู่ในนัดเดือนนี้</p>
      ${missing
        .map(
          (c) => `<div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm text-amber-800">${escapeHtml(c.name)} (${escapeHtml(c.team)})</span>
        <button type="button" class="btn btn-secondary btn-sm" data-action="add-coach" data-team="${escapeHtml(c.team)}" data-coach="${escapeHtml(c.id)}">จัดเข้ากลุ่มที่คนน้อยที่สุด</button>
      </div>`
        )
        .join("")}
    </div>`;
  }
  bodyEl.innerHTML = html;
}

async function withStatus(label, fn) {
  setStatus(label);
  try {
    await fn();
    await reload();
  } catch (err) {
    console.error(err);
    setStatus("ไม่สำเร็จ: " + err.message, true);
  }
}

// สร้างตารางครั้งแรก = เขียนเอกสารใหม่ทั้งหมด / แบ่งกลุ่มใหม่ = แก้เฉพาะรายชื่อกับผลเข้าประชุมของนัดเดิม (คงวัน ลิงก์ วาระ ไฟล์ และสรุปไว้)
function buildAllDocs() {
  const docs = [];
  for (const slot of MEETING_TEAM_SLOTS) {
    const coaches = coachesByTeam.get(slot.team) || [];
    if (coaches.length === 0) continue;
    const weekdays = [];
    const existingLinks = {};
    for (let w = 1; w <= MEETING_WEEKS_PER_MONTH; w++) {
      weekdays.push(weekdayOfWeek(w));
      const link = meetings.get(meetingKey(slot.team, w))?.meetLink;
      if (link) existingLinks[w] = link;
    }
    docs.push(...buildTeamMeetingDocs({ month: viewMonth, team: slot.team, coaches, weekdays, existingLinks }));
  }
  return docs;
}

async function writeAllDocs() {
  const batch = writeBatch(db);
  for (const d of buildAllDocs()) {
    const ref = doc(db, "coachMeetings", d.id);
    if (findMeetingById(d.id)) {
      batch.update(ref, {
        coachIds: d.data.coachIds,
        coachNames: d.data.coachNames,
        attendance: {},
        updatedAt: serverTimestamp()
      });
    } else {
      batch.set(ref, { ...d.data, updatedAt: serverTimestamp() });
    }
  }
  await batch.commit();
}

async function uploadSectionFile(m, sec, file) {
  const existing = ((m.sections || {})[sec] || {}).files || [];
  const problem = validateMeetingFile(file, existing.length);
  if (problem) {
    setStatus(problem, true);
    return;
  }
  await withStatus("กำลังอัปโหลดไฟล์...", async () => {
    const filePath = meetingFilePath(m.id, sec, file.name, Date.now());
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await updateDoc(doc(db, "coachMeetings", m.id), {
      [`sections.${sec}.files`]: [...existing, { name: file.name, url, path: filePath }],
      updatedAt: serverTimestamp()
    });
  });
}

const actions = {
  "select-week": (el) => {
    selectedWeek = Number(el.dataset.week);
    render();
  },
  weekday: (el) =>
    withStatus("กำลังบันทึกวันประชุม...", async () => {
      const week = Number(el.dataset.week);
      selectedWeek = week;
      const date = meetingDate(viewMonth, week, el.dataset.day);
      const batch = writeBatch(db);
      for (const slot of MEETING_TEAM_SLOTS) {
        const m = meetings.get(meetingKey(slot.team, week));
        if (m) batch.update(doc(db, "coachMeetings", m.id), { date, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }),
  generate: () => withStatus("กำลังสร้างตารางประชุม...", writeAllDocs),
  regroup: () => {
    if (!confirm("แบ่งกลุ่มโค้ชใหม่ทั้งหมด? การย้ายโค้ชและผลเข้าประชุมที่บันทึกไว้ของเดือนนี้จะถูกล้าง (วัน ลิงก์ Meet วาระ ไฟล์ และสรุปคงเดิม)")) return;
    return withStatus("กำลังแบ่งกลุ่มใหม่...", writeAllDocs);
  },
  "attendance-set": (el) =>
    withStatus("กำลังบันทึกผลเข้าประชุม...", async () => {
      const m = findMeetingById(el.dataset.doc);
      if (!m) return;
      const status = el.dataset.status;
      const current = (m.attendance || {})[el.dataset.coach] || "";
      await updateDoc(doc(db, "coachMeetings", m.id), {
        [`attendance.${el.dataset.coach}`]: current === status ? deleteField() : status,
        updatedAt: serverTimestamp()
      });
    }),
  "save-link": (el) => {
    const card = el.closest("[data-slot-doc]");
    const link = card.querySelector("[data-link-input]").value.trim();
    if (!isValidMeetingLink(link)) {
      setStatus("ลิงก์ต้องขึ้นต้นด้วย https:// (เช่น ลิงก์ Google Meet)", true);
      return;
    }
    return withStatus("กำลังบันทึกลิงก์...", () =>
      updateDoc(doc(db, "coachMeetings", el.dataset.doc), { meetLink: link, updatedAt: serverTimestamp() })
    );
  },
  move: (el) => {
    const card = el.closest("[data-slot-doc]");
    const coachId = card.querySelector("[data-move-coach]").value;
    const toWeek = Number(card.querySelector("[data-move-week]").value);
    const from = findMeetingById(el.dataset.doc);
    const to = from && meetings.get(meetingKey(from.team, toWeek));
    if (!from || !to || !coachId) return;
    // เขียนรายการ id/ชื่อทั้งชุดใหม่แทน arrayRemove/arrayUnion เพราะชื่อโค้ชซ้ำกันได้ (arrayUnion จะตัดชื่อซ้ำทิ้ง ทำให้จำนวนชื่อไม่ตรงกับจำนวน id)
    const fromIds = from.coachIds || [];
    const idx = fromIds.indexOf(coachId);
    const name = (from.coachNames || [])[idx] ?? "-";
    return withStatus("กำลังย้ายโค้ช...", async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, "coachMeetings", from.id), {
        coachIds: fromIds.filter((id) => id !== coachId),
        coachNames: (from.coachNames || []).filter((_, i) => i !== idx),
        [`attendance.${coachId}`]: deleteField(),
        updatedAt: serverTimestamp()
      });
      batch.update(doc(db, "coachMeetings", to.id), {
        coachIds: [...(to.coachIds || []), coachId],
        coachNames: [...(to.coachNames || []), name],
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    });
  },
  "add-coach": (el) => {
    const team = el.dataset.team;
    const coach = (coachesByTeam.get(team) || []).find((c) => c.id === el.dataset.coach);
    let target = null;
    for (let w = 1; w <= MEETING_WEEKS_PER_MONTH; w++) {
      const m = meetings.get(meetingKey(team, w));
      if (m && (!target || (m.coachIds || []).length < (target.coachIds || []).length)) target = m;
    }
    if (!coach || !target) return;
    return withStatus("กำลังจัดโค้ชเข้านัด...", () =>
      updateDoc(doc(db, "coachMeetings", target.id), {
        coachIds: [...(target.coachIds || []), coach.id],
        coachNames: [...(target.coachNames || []), coach.name],
        updatedAt: serverTimestamp()
      })
    );
  },
  "sec-tab": (el) => {
    activeSection.set(el.dataset.doc, el.dataset.sec);
    render();
  },
  "pick-file": (el) => el.parentElement.querySelector("[data-file-input]").click(),
  "remove-file": (el) => {
    const m = findMeetingById(el.dataset.doc);
    const sec = el.dataset.sec;
    const files = (((m || {}).sections || {})[sec] || {}).files || [];
    const target = files[Number(el.dataset.index)];
    if (!m || !target || !confirm(`ลบไฟล์ "${target.name}"?`)) return;
    return withStatus("กำลังลบไฟล์...", async () => {
      await updateDoc(doc(db, "coachMeetings", m.id), {
        [`sections.${sec}.files`]: files.filter((_, i) => i !== Number(el.dataset.index)),
        updatedAt: serverTimestamp()
      });
      try {
        await deleteObject(storageRef(storage, target.path));
      } catch (err) {
        console.warn("ลบไฟล์ใน Storage ไม่สำเร็จ (ไม่บล็อกการทำงานหลัก):", err);
      }
    });
  },
  // วาระ (ก่อนประชุม) เขียนลงเอกสารนัด / ความคิดเห็น (หลังประชุม) เขียนแยกที่ coachMeetingComments ที่โค้ชอ่านไม่ได้ — บันทึกพร้อมกันในชุดเดียว
  "save-section": (el) => {
    const sec = el.dataset.sec;
    const docId = el.dataset.doc;
    const m = findMeetingById(docId);
    if (!m) return;
    const form = el.closest("[data-section-form]");
    const plan = form.querySelector('textarea[data-field="plan"]').value.trim();
    const comment = form.querySelector('textarea[data-field="comment"]').value.trim();
    return withStatus("กำลังบันทึก...", async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, "coachMeetings", docId), { [`sections.${sec}.plan`]: plan, updatedAt: serverTimestamp() });
      batch.set(
        doc(db, "coachMeetingComments", docId),
        {
          meetingId: docId,
          team: m.team,
          month: m.month,
          comments: { [sec]: comment },
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || ""
        },
        { merge: true }
      );
      await batch.commit();
      drafts.delete(`${docId}|${sec}`);
    });
  }
};

// ทีมสต๊าฟแก้ได้เฉพาะวาระ/ไฟล์/ความคิดเห็น (กฎ Firestore บังคับอีกชั้น) — action อื่นของแอดมินหลักถูกปิดไว้ที่นี่ด้วย
const STAFF_ALLOWED_ACTIONS = new Set(["select-week", "sec-tab", "pick-file", "remove-file", "save-section"]);
const READONLY_ALLOWED_ACTIONS = new Set(["select-week", "sec-tab"]);

bodyEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !bodyEl.contains(el)) return;
  if (readOnly && !READONLY_ALLOWED_ACTIONS.has(el.dataset.action)) return;
  if (staffMode && !STAFF_ALLOWED_ACTIONS.has(el.dataset.action)) return;
  // ปุ่มวันพุธ/พฤหัสบดีอยู่ในแถวที่คลิกเลือกสัปดาห์ได้ — ทำงานของปุ่มอย่างเดียว ไม่ให้แถวทำซ้ำ
  e.stopPropagation();
  actions[el.dataset.action]?.(el);
});

// เก็บข้อความที่กำลังพิมพ์ไว้ทุกครั้ง เพื่อไม่ให้หายเมื่อสลับแท็บสาย/บันทึกอย่างอื่นแล้วหน้าโหลดใหม่
bodyEl.addEventListener("input", (e) => {
  const ta = e.target.closest("textarea[data-field]");
  if (!ta || !bodyEl.contains(ta)) return;
  const key = `${ta.dataset.doc}|${ta.dataset.sec}`;
  drafts.set(key, { ...(drafts.get(key) || {}), [ta.dataset.field]: ta.value });
});

bodyEl.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-file-input]");
  if (!input) return;
  const file = input.files[0];
  input.value = "";
  const m = findMeetingById(input.dataset.doc);
  if (file && m) uploadSectionFile(m, input.dataset.sec, file);
});

function changeMonth(delta) {
  viewMonth = addMonthsToMonth(viewMonth, delta);
  selectedWeek = 1;
  reload();
}
prevBtn.addEventListener("click", () => changeMonth(-1));
nextBtn.addEventListener("click", () => changeMonth(1));

// opts.staffMode = true เมื่อเปิดโดยทีมหลังบ้าน (สิทธิ์ meetings) — ซ่อนเครื่องมือที่เป็นของแอดมินหลัก
export function openAdminMeetings(opts = {}) {
  readOnly = opts.readOnly === true;
  staffMode = opts.staffMode === true || readOnly;
  scopeTeam = opts.team || null;
  scopeAgeGroup = opts.ageGroup || "";
  return reload();
}

// ---------- ฝั่งโค้ช ----------
let cached = { key: "", at: 0, value: null };

// เก็บงานหลังประชุมที่ส่งแล้วไว้แสดง (แก้ไขได้) ไม่เกินกี่วันหลังวันประชุม — ที่ยังไม่ส่งแสดงจนกว่าจะส่ง
const RECENT_SUBMITTED_DAYS = 35;

// นัดครั้งถัดไป + งานหลังประชุมของตัวเอง (ค้นเฉพาะทีมตัวเองในช่วง ±62 วัน — กฎ Firestore ต้อง where(team) ตรงกับทีม และงานต้อง where(coachId) ของตัวเอง)
async function fetchCoachMeetingData(team, coachId, track) {
  const key = `${team}|${coachId}|${track}`;
  const now = Date.now();
  if (cached.key === key && now - cached.at < 30000) return cached.value;
  const today = todayBangkok();
  const [meetingSnap, recapSnap] = await Promise.all([
    getDocs(teamDateRangeQuery("coachMeetings", team, addDaysToDate(today, -62), addDaysToDate(today, 62))),
    getDocs(query(collection(db, "coachMeetingRecaps"), where("team", "==", team), where("coachId", "==", coachId)))
  ]);
  const list = [];
  meetingSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  const recapsByMeeting = new Map();
  recapSnap.forEach((d) => recapsByMeeting.set(d.data().meetingId, d.data()));
  const recentFrom = addDaysToDate(today, -RECENT_SUBMITTED_DAYS);
  const tasks = recapTasksForCoach(list, coachId, recapsByMeeting, today).filter(
    (t) => t.status.state === "pending" || t.status.state === "overdue" || t.meeting.date >= recentFrom
  );
  const value = { next: nextMeetingForCoach(list, coachId, today), tasks };
  cached = { key, at: now, value };
  return value;
}

// นัดครั้งถัดไป + งานหลังประชุมของโค้ช (ใช้ร่วมกับหน้า "สิ่งที่ต้องทำ") — { next, tasks }
export function loadCoachMeetingOverview(team, coachId, position) {
  return fetchCoachMeetingData(team, coachId, coachTrackOf(position));
}

function invalidateCoachMeetingCache() {
  cached = { key: "", at: 0, value: null };
}
const preLine = 'style="white-space:pre-line"';
// วาระ + ไฟล์แนบที่แอดมิน/ทีมสต๊าฟใส่ไว้ของนัดนี้ — เฉพาะส่วนกลางและสายของโค้ชคนนี้ (ว่าง = ไม่มีอะไรให้แสดง) ไม่รวมความคิดเห็นหลังประชุมที่โค้ชไม่เห็น
function agendaBlocksHtml(m, track) {
  return sectionsForTrack(track)
    .map((key) => {
      const s = (m.sections || {})[key];
      if (!sectionHasPlan(s)) return "";
      return `<div class="mt-2">
        <p class="text-xs font-semibold ${SECTION_TEXT_CLASS[key]}">${key === "all" ? "ส่วนกลาง (ทุกสาย)" : `สาย${sectionLabel(key)}`}</p>
        ${s.plan ? `<p class="text-sm text-slate-700" ${preLine}>${escapeHtml(s.plan)}</p>` : ""}
        <div class="flex gap-2 flex-wrap mt-1">${fileTagsHtml(m, key, s.files || [], false)}</div>
      </div>`;
    })
    .join("");
}

function nextMeetingCardHtml(m, track) {
  const left = daysUntil(m.date, todayBangkok());
  const soon = left <= 2;
  const link = safeHttpUrl(m.meetLink);
  const blocks = agendaBlocksHtml(m, track);
  return `
    <div class="card card-pad ${soon ? "card-warning" : ""}">
      <div class="flex items-center gap-4 flex-wrap">
        <span class="icon-badge icon-badge-lg">${icon("calendar")}</span>
        <div class="flex-1 min-w-[200px]">
          <p class="font-semibold text-slate-900">ประชุมโค้ชครั้งถัดไป</p>
          <p class="text-sm text-slate-700">${escapeHtml(thaiMeetingDateLabel(m.date))} · ${escapeHtml(m.startTime)}–${escapeHtml(m.endTime)} น. · ${escapeHtml(m.team)}</p>
          <span class="badge ${soon ? "badge-warning" : "badge-neutral"} mt-1">${describeDaysUntil(left)}</span>
          ${link ? "" : '<p class="text-xs text-slate-500 mt-1">ผู้ดูแลระบบยังไม่ได้ใส่ลิงก์ Google Meet</p>'}
        </div>
        <div class="flex gap-2 flex-wrap">
          ${link ? `<a class="btn btn-primary btn-sm" href="${link}" target="_blank" rel="noopener noreferrer">เข้าร่วม Meet</a>` : ""}
          <a class="btn btn-secondary btn-sm" href="${escapeHtml(googleCalendarUrl(m))}" target="_blank" rel="noopener noreferrer">เพิ่มลง Google Calendar</a>
        </div>
      </div>
      ${blocks ? `<div class="border-t border-slate-100 mt-3 pt-1">${blocks}</div>` : ""}
    </div>`;
}

// การ์ดงานหลังประชุมของโค้ช: ยังไม่ส่ง = ฟอร์มเปิดอยู่ / ส่งแล้ว = พับไว้ กางเพื่อแก้ไขได้ — canSubmit=false เมื่อแอดมินสวมบทบาทดูแทนโค้ช (ส่งแทนไม่ได้)
function recapTaskCardHtml(task, coachId, canSubmit, track) {
  const { meeting: m, recap, status } = task;
  const view = recapStatusView(status);
  const badge = `<span class="${RECAP_TONE_BADGE[view.tone]}">${escapeHtml(view.text)}</span>`;
  const idx = (m.coachIds || []).indexOf(coachId);
  const coachName = (m.coachNames || [])[idx] ?? "-";
  const done = !!recap;
  const fields = COACH_RECAP_FIELDS.map((f, i) => {
    const value = recap ? recap[f.key] || "" : "";
    const control = canSubmit
      ? `<textarea rows="3" class="field-input" data-recap-field="${f.key}" placeholder="${f.placeholder}">${escapeHtml(value)}</textarea>`
      : `<p class="text-sm text-slate-800" ${preLine}>${escapeHtml(value || "-")}</p>`;
    return `<div class="mt-3"><label class="field-label">${i + 1}. ${f.label}</label>${control}</div>`;
  }).join("");
  const action = canSubmit
    ? `<p class="text-sm text-red-600 mt-2 hidden" data-recap-error></p>
       <div class="mt-3"><button type="button" class="btn btn-primary btn-sm" data-action="submit-recap">${done ? "บันทึกการแก้ไข" : "ส่งงาน"}</button></div>`
    : '<p class="text-xs text-slate-500 mt-3">ผู้ดูแลระบบดูแทนโค้ช — ส่งงานแทนไม่ได้</p>';
  const deadlineText = `ส่งได้ถึง ${thaiMeetingDateLabel(status.deadline)}`;
  const attrs = `data-recap-card data-meeting="${escapeHtml(m.id)}" data-month="${escapeHtml(m.month)}" data-team="${escapeHtml(m.team)}" data-name="${escapeHtml(coachName)}" data-exists="${done ? "1" : ""}"`;
  const agenda = agendaBlocksHtml(m, track);
  const agendaPart = agenda
    ? `<div class="mt-3 rounded-lg bg-slate-50 p-3"><p class="text-sm font-semibold text-slate-900">วาระและเอกสารจากทีมงาน</p>${agenda}</div>`
    : "";
  const meetLink = safeHttpUrl(m.meetLink);
  const linkPart = meetLink
    ? `<div class="mt-3"><a class="btn btn-secondary btn-sm" href="${meetLink}" target="_blank" rel="noopener noreferrer">${icon("link")} ลิงก์เข้าประชุม Google Meet</a></div>`
    : "";
  const body = `${linkPart}${agendaPart}${fields}${action}`;
  if (done) {
    return `<details class="card card-pad" ${attrs}>
      <summary class="cursor-pointer flex items-center gap-2 flex-wrap">
        <span class="font-semibold text-slate-900">งานหลังประชุมเมื่อ ${escapeHtml(thaiMeetingDateLabel(m.date))}</span>${badge}
      </summary>${body}</details>`;
  }
  const overdue = status.state === "overdue";
  const ringCls = overdue ? "card-warning" : "ring-2 ring-blue-500";
  return `<div class="card card-pad ${ringCls}" ${attrs}>
      <div class="flex items-center gap-2 flex-wrap">
        <p class="font-semibold text-slate-900">งานหลังประชุมเมื่อ ${escapeHtml(thaiMeetingDateLabel(m.date))}</p>${badge}
        <span class="text-xs text-slate-500 ml-auto">${escapeHtml(deadlineText)} (ก่อน 2 วันสุดท้ายของเดือน)</span>
      </div>${body}</div>`;
}

const cardArgs = new WeakMap();

async function onCardClick(e) {
  const btn = e.target.closest('[data-action="submit-recap"]');
  if (!btn) return;
  const args = cardArgs.get(e.currentTarget);
  const card = btn.closest("[data-recap-card]");
  if (!args || !card) return;
  const errorEl = card.querySelector("[data-recap-error]");
  const input = {};
  for (const ta of card.querySelectorAll("textarea[data-recap-field]")) input[ta.dataset.recapField] = ta.value;
  const result = validateRecapInput(input);
  if (result.error) {
    errorEl.textContent = result.error;
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");
  btn.disabled = true;
  try {
    const ref = doc(db, "coachMeetingRecaps", recapDocId(card.dataset.meeting, args.coachId));
    if (card.dataset.exists) {
      await updateDoc(ref, { ...result.values, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        team: card.dataset.team,
        meetingId: card.dataset.meeting,
        coachId: args.coachId,
        coachName: card.dataset.name,
        month: card.dataset.month,
        ...result.values,
        submittedOn: todayBangkok(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    invalidateCoachMeetingCache();
    await args.rerender();
    args.opts.onChange?.();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    errorEl.textContent = "ส่งงานไม่สำเร็จ: " + err.message;
    errorEl.classList.remove("hidden");
  }
}

// opts = { position: ตำแหน่งโค้ช (กำหนดสาย), canSubmit: false เมื่อผู้ดูแลระบบสวมบทบาทดูแทนโค้ช, onChange: เรียกหลังส่งงานสำเร็จ (ให้กระดิ่งรีเฟรช) }
export async function renderCoachMeetingCard(el, team, coachId, opts = {}) {
  cardArgs.set(el, { team, coachId, opts, rerender: () => renderCoachMeetingCard(el, team, coachId, opts) });
  if (!el.dataset.bound) {
    el.dataset.bound = "1";
    el.addEventListener("click", onCardClick);
  }
  el.classList.add("hidden");
  el.innerHTML = "";
  if (!coachId) return;
  try {
    const track = coachTrackOf(opts.position);
    const { next, tasks } = await fetchCoachMeetingData(team, coachId, track);
    if (!next && tasks.length === 0) return;
    el.className = "space-y-3";
    el.innerHTML = (next ? nextMeetingCardHtml(next, track) : "") + tasks.map((t) => recapTaskCardHtml(t, coachId, opts.canSubmit !== false, coachTrackOf(opts.position))).join("");
  } catch (err) {
    // การ์ดเสริมของหน้า Daily — ไม่แสดง error ให้กวนใจ (เหมือนตัวเตือนงานประจำวัน)
    console.error(err);
  }
}

// หน้า "งานหลังประชุม" (เมนูของโค้ช): แสดงเฉพาะงานหลังประชุม — ยังไม่ส่ง = ฟอร์มเปิดอยู่ / ส่งแล้ว = พับไว้ กางแก้ไขได้ (ย้อนหลังไม่เกิน RECENT_SUBMITTED_DAYS วัน)
export async function renderCoachMeetingTasks(el, team, coachId, opts = {}) {
  cardArgs.set(el, { team, coachId, opts, rerender: () => renderCoachMeetingTasks(el, team, coachId, opts) });
  if (!el.dataset.bound) {
    el.dataset.bound = "1";
    el.addEventListener("click", onCardClick);
  }
  el.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    invalidateCoachMeetingCache();
    const track = coachTrackOf(opts.position);
    const { tasks } = await fetchCoachMeetingData(team, coachId, track);
    // งานหลังประชุมของแต่ละนัด (แต่ละงานแสดงวาระ+ไฟล์ของนัดนั้นด้วย) — นัดครั้งถัดไปอยู่หน้า Next Meeting แยกต่างหาก
    el.innerHTML =
      (tasks.length > 0
        ? tasks.map((t) => recapTaskCardHtml(t, coachId, opts.canSubmit !== false, track)).join("")
        : '<div class="card card-pad text-sm text-slate-500">ยังไม่มีงานหลังประชุมที่ต้องส่ง — งานจะขึ้นที่นี่หลังวันประชุมของคุณ</div>');
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="card card-pad text-sm text-red-600">โหลดงานหลังประชุมไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

// หน้า Meeting → Next Meeting: นัดครั้งถัดไป (วัน/เวลา ลิงก์ วาระ+ไฟล์ของส่วนกลางและสายตัวเอง) + รายชื่อผู้เข้าร่วมนัดนั้น
export async function renderCoachNextMeeting(el, team, coachId, opts = {}) {
  el.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    invalidateCoachMeetingCache();
    const track = coachTrackOf(opts.position);
    const { next } = await fetchCoachMeetingData(team, coachId, track);
    if (!next) {
      el.innerHTML = '<div class="card card-pad text-sm text-slate-500">ยังไม่มีนัดประชุมครั้งถัดไป — ผู้ดูแลระบบจะกำหนดตารางประชุมรายเดือน</div>';
      return;
    }
    const names = (next.coachNames || []).filter(Boolean);
    const participants = names.length > 0
      ? `<div class="card card-pad"><p class="text-sm font-semibold text-slate-900 mb-1">ผู้เข้าร่วมสัปดาห์นี้ (${names.length} คน)</p><p class="text-sm text-slate-700">${names.map(escapeHtml).join(" · ")}</p></div>`
      : "";
    el.innerHTML = nextMeetingCardHtml(next, track) + participants;
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="card card-pad text-sm text-red-600">โหลดนัดประชุมไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

// หน้า Meeting → History: ประวัติการประชุมของโค้ชในเดือน month — การเข้าร่วม สถานะงานหลังประชุม และกางดูวาระ+ไฟล์/คำตอบที่ส่งไว้
export async function renderCoachMeetingHistory(el, team, coachId, month, opts = {}) {
  el.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const track = coachTrackOf(opts.position);
    const today = todayBangkok();
    const [meetingSnap, recapSnap] = await Promise.all([
      getDocs(teamDateRangeQuery("coachMeetings", team, `${month}-01`, `${month}-31`)),
      getDocs(query(collection(db, "coachMeetingRecaps"), where("team", "==", team), where("coachId", "==", coachId)))
    ]);
    const list = meetingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const recapsByMeeting = new Map();
    recapSnap.forEach((d) => recapsByMeeting.set(d.data().meetingId, d.data()));
    const rows = meetingHistoryRows(list, coachId, recapsByMeeting, today);
    if (rows.length === 0) {
      el.innerHTML = '<div class="card card-pad text-center text-sm text-slate-500">ไม่มีการประชุมของคุณในเดือนนี้</div>';
      return;
    }
    el.innerHTML = rows
      .map((row) => {
        const m = row.meeting;
        const att = attendanceView(row, today);
        const rec = recapStatusView(row.status);
        const agenda = agendaBlocksHtml(m, track);
        const answers = row.recap
          ? COACH_RECAP_FIELDS.map((f, i) => `<div class="mt-2"><p class="text-xs font-semibold text-slate-600">${i + 1}. ${f.label}</p><p class="text-sm text-slate-800" ${preLine}>${escapeHtml(row.recap[f.key] || "-")}</p></div>`).join("")
          : "";
        const body = `${agenda ? `<div class="mt-3 rounded-lg bg-slate-50 p-3"><p class="text-sm font-semibold text-slate-900">วาระและเอกสารจากทีมงาน</p>${agenda}</div>` : ""}${
          row.recap ? `<div class="mt-3"><p class="text-sm font-semibold text-slate-900">งานหลังประชุมที่ส่งไว้</p>${answers}</div>` : ""
        }`;
        const summary = `<span class="font-semibold text-slate-900">${escapeHtml(thaiMeetingDateLabel(m.date))}</span><span class="${RECAP_TONE_BADGE[att.tone]}">${escapeHtml(att.text)}</span>${row.status.state === "upcoming" ? "" : `<span class="${RECAP_TONE_BADGE[rec.tone]}">${escapeHtml(rec.text)}</span>`}`;
        return body
          ? `<details class="card card-pad"><summary class="cursor-pointer flex items-center gap-2 flex-wrap">${summary}</summary>${body}</details>`
          : `<div class="card card-pad"><div class="flex items-center gap-2 flex-wrap">${summary}</div><p class="text-xs text-slate-400 mt-2">ไม่มีวาระหรือไฟล์ที่บันทึกไว้ของนัดนี้</p></div>`;
      })
      .join("");
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="card card-pad text-sm text-red-600">โหลดประวัติการประชุมไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

// รายการสำหรับกระดิ่งของโค้ช: นัดของตัวเองที่เหลือไม่เกิน 3 วัน + งานหลังประชุมที่ยังไม่ส่ง (read: true = ไม่มีปุ่ม "อ่านแล้ว"
// เพราะโค้ชเขียนสถานะอ่านลง Firestore ไม่ได้ — รายการหายเองเมื่อพ้นวันประชุม/ส่งงานแล้ว)
export async function loadCoachMeetingNotifications(team, coachId, position) {
  const { next, tasks } = await fetchCoachMeetingData(team, coachId, coachTrackOf(position));
  const items = [];
  if (next) {
    const left = daysUntil(next.date, todayBangkok());
    if (left <= 3) {
      items.push({
        key: "coach_meeting",
        icon: icon("calendar"),
        level: "action",
        read: true,
        title: `ประชุมโค้ช${describeDaysUntil(left)}`,
        detail: `${escapeHtml(thaiMeetingDateLabel(next.date))} · ${escapeHtml(next.startTime)}–${escapeHtml(next.endTime)} น. · ${escapeHtml(next.team)}`,
        link: "./attendance.html#screen=meeting-next"
      });
    }
  }
  for (const t of tasks) {
    if (t.status.state !== "pending" && t.status.state !== "overdue") continue;
    const overdue = t.status.state === "overdue";
    items.push({
      key: `coach_meeting_recap_${t.meeting.id}`,
      icon: icon("book"),
      level: overdue ? "urgent" : "action",
      read: true,
      title: overdue ? "งานหลังประชุมเลยกำหนดส่งแล้ว" : "ส่งงานหลังประชุม (ความรู้ที่ได้ / นำไปใช้ในสนาม)",
      detail: `ประชุมเมื่อ ${escapeHtml(thaiMeetingDateLabel(t.meeting.date))} · ส่งได้ถึง ${escapeHtml(thaiMeetingDateLabel(t.status.deadline))}`,
      link: "./attendance.html#screen=meeting-tasks"
    });
  }
  return items;
}