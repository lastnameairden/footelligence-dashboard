// หน้าจอของระบบนัดประชุมโค้ชรายสัปดาห์ (ตรรกะล้วนๆ อยู่ที่ coach-meetings.js)
//   - ผู้ดูแลระบบ: สร้างตารางประจำเดือน เลือกวันพุธ/พฤหัสบดีรายสัปดาห์ ใส่ลิงก์ Google Meet ย้ายโค้ชข้ามสัปดาห์ บันทึกผลเข้าประชุม
//     เขียนวาระ+แนบไฟล์ก่อนประชุม (แยกส่วนกลาง/สายโค้ชผู้เล่น/โค้ชประตู/ฟิตเนสโค้ช) และสรุปความรู้ การบ้าน ความคิดแอดมินหลังประชุม
//   - โค้ช: การ์ด "ประชุมครั้งถัดไป" (วาระ+ไฟล์ของส่วนกลางและสายตัวเอง) + สรุปประชุมล่าสุดที่แอดมินส่งให้ + แจ้งเตือนที่กระดิ่ง
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
import { db, storage } from "./firebase-init.js";
import { icon } from "./icons.js";
import { escapeHtml, safeHttpUrl, ageGroupSortKey, teamDateRangeQuery, todayBangkok, thisMonthBangkok } from "./ui-utils.js";
import {
  MEETING_TEAM_SLOTS,
  MEETING_WEEKS_PER_MONTH,
  MEETING_WEEKDAY_LABELS,
  DEFAULT_MEETING_WEEKDAYS,
  MEETING_ATTENDANCE_LABELS,
  MEETING_SECTIONS,
  MEETING_RECAP_FIELDS,
  ackDocId,
  coachVisibleRecapFields,
  addDaysToDate,
  addMonthsToMonth,
  buildTeamMeetingDocs,
  coachTrackOf,
  daysUntil,
  describeDaysUntil,
  googleCalendarUrl,
  isValidMeetingLink,
  latestPublishedRecap,
  meetingDate,
  meetingFilePath,
  meetingWeekdayOf,
  nextMeetingForCoach,
  sectionHasPlan,
  sectionHasRecap,
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
let acksByMeeting = new Map(); // meetingId -> Set(coachId) ที่กด "รับทราบ" สรุปแล้ว
// ข้อความที่พิมพ์ค้างไว้ในช่องวาระ/สรุป (ยังไม่กดบันทึก) — เก็บไว้เพราะทุกการกระทำโหลดหน้าใหม่ จะได้ไม่หายระหว่างสลับแท็บ/บันทึกอย่างอื่น
const drafts = new Map(); // `${meetingId}|${section}` -> { plan, know, use, hw, mind }
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
    const [coachSnap, meetingSnap, ackSnap] = await Promise.all([
      getDocs(query(collection(db, "coaches"), where("role", "==", "coach"))),
      getDocs(query(collection(db, "coachMeetings"), where("month", "==", viewMonth))),
      getDocs(query(collection(db, "coachMeetingAcks"), where("month", "==", viewMonth)))
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
    acksByMeeting = new Map();
    ackSnap.forEach((d) => {
      const a = d.data();
      if (!acksByMeeting.has(a.meetingId)) acksByMeeting.set(a.meetingId, new Set());
      acksByMeeting.get(a.meetingId).add(a.coachId);
    });
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

function sectionFormHtml(m, sec) {
  const saved = (m.sections || {})[sec] || {};
  const draft = drafts.get(`${m.id}|${sec}`) || {};
  const val = (field) => escapeHtml(draft[field] ?? saved[field] ?? "");
  const mine = membersOfSection(m, sec);
  const who = sec === "all" ? "โค้ชทุกคนในกลุ่มเห็น" : `โค้ชสาย${sectionLabel(sec)}ในกลุ่มนี้: ${mine.length ? escapeHtml(mine.join(", ")) : "ไม่มี"}`;
  const recap = MEETING_RECAP_FIELDS.map(
    (f) => `<div>
        <label class="field-label">${f.label}${f.adminOnly ? ` <span class="badge badge-neutral">${icon("lock")} บันทึกส่วนตัว โค้ชไม่เห็น</span>` : ""}</label>
        <textarea rows="2" class="field-input" data-field="${f.key}" data-doc="${escapeHtml(m.id)}" data-sec="${sec}" placeholder="${f.placeholder}">${val(f.key)}</textarea>
      </div>`
  ).join("");
  return `
    <div class="space-y-3" data-section-form>
      <p class="text-xs text-slate-500">${who}</p>
      <div>
        <label class="field-label">ก่อนประชุม: หัวข้อที่จะให้ความรู้</label>
        <textarea rows="3" class="field-input" data-field="plan" data-doc="${escapeHtml(m.id)}" data-sec="${sec}" placeholder="หัวข้อและประเด็นที่จะพูดในส่วนนี้">${val("plan")}</textarea>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${fileTagsHtml(m, sec, saved.files || [], true)}
        <button type="button" class="btn btn-secondary btn-sm" data-action="pick-file">${icon("paperclip")} แนบไฟล์</button>
        <input type="file" class="hidden" accept="image/*,application/pdf" data-file-input data-doc="${escapeHtml(m.id)}" data-sec="${sec}" />
      </div>
      <p class="text-xs text-slate-400">PDF หรือรูปภาพ ไม่เกิน 10MB ต่อไฟล์ แนบได้สูงสุด 3 ไฟล์ต่อส่วน โค้ชเห็นทันทีที่แนบ</p>
      <p class="text-xs font-semibold text-slate-600 pt-1">หลังประชุม: สรุปให้โค้ช (ยกเว้นช่อง "ความคิดของแอดมิน" ที่โค้ชไม่เห็น)</p>
      ${recap}
      <div><button type="button" class="btn btn-primary btn-sm" data-action="save-section" data-doc="${escapeHtml(m.id)}" data-sec="${sec}">บันทึกส่วน${sectionLabel(sec)}</button></div>
    </div>`;
}

function render() {
  setStatus("");
  if (meetings.size === 0) {
    const total = [...coachesByTeam.values()].reduce((n, l) => n + l.length, 0);
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
    const counts = MEETING_TEAM_SLOTS.map((s) => (meetings.get(meetingKey(s.team, w))?.coachIds || []).length);
    html += `
      <div class="card card-pad flex items-center gap-3 flex-wrap cursor-pointer ${selected ? "ring-2 ring-blue-500" : ""}" data-action="select-week" data-week="${w}">
        <span class="font-semibold text-slate-900 w-24">สัปดาห์ ${w}</span>
        <span class="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          ${["wed", "thu"]
            .map((d) => {
              const dayCls = d === day ? "bg-blue-50 text-blue-700 font-semibold" : "bg-white text-slate-600";
              return `<button type="button" data-action="weekday" data-week="${w}" data-day="${d}" class="px-3 py-1 text-sm ${dayCls}">${MEETING_WEEKDAY_LABELS[d]}</button>`;
            })
            .join("")}
        </span>
        <span class="text-sm text-slate-700">${escapeHtml(thaiMeetingDateLabel(dateOfWeek(w)))}</span>
        <span class="text-xs text-slate-500 ml-auto">โค้ช ${counts.join(" / ")} คน</span>
      </div>`;
  }
  html += "</div>";

  html += `<div class="flex items-center gap-2 flex-wrap mt-4">
      <h3 class="font-semibold text-slate-900">สัปดาห์ ${selectedWeek} · ${escapeHtml(thaiMeetingDateLabel(dateOfWeek(selectedWeek)))}</h3>
      <button type="button" class="btn btn-secondary btn-sm ml-auto" data-action="regroup">${icon("refresh")} แบ่งกลุ่มใหม่อัตโนมัติ</button>
    </div>
    <div class="space-y-3">`;

  for (const slot of MEETING_TEAM_SLOTS) {
    const m = meetings.get(meetingKey(slot.team, selectedWeek));
    if (!m) {
      html += `<div class="card card-pad"><p class="font-semibold text-slate-900">${escapeHtml(slot.team)}</p><p class="text-sm text-slate-500">ไม่มีนัดในสัปดาห์นี้</p></div>`;
      continue;
    }
    const sum = summarizeMeetingAttendance(m);
    const names = m.coachNames || [];
    // แถวละโค้ช มีปุ่มเลือกผลชัดเจน 3 ปุ่ม (เข้าร่วม/ลา/ขาด) ปุ่มที่เลือกอยู่เป็นสีเต็ม กดซ้ำเพื่อล้าง
    const statusStyles = {
      attended: "bg-emerald-600 text-white",
      leave: "bg-amber-500 text-white",
      absent: "bg-red-600 text-white"
    };
    const rows = (m.coachIds || [])
      .map((id, i) => {
        const current = (m.attendance || {})[id] || "";
        const buttons = ["attended", "leave", "absent"]
          .map((status) => {
            const cls = status === current ? statusStyles[status] : "bg-white text-slate-600";
            return `<button type="button" class="px-3 py-1 text-sm ${cls}" data-action="attendance-set" data-doc="${escapeHtml(m.id)}" data-coach="${escapeHtml(id)}" data-status="${status}" aria-pressed="${status === current}">${MEETING_ATTENDANCE_LABELS[status]}</button>`;
          })
          .join("");
        return `<div class="flex items-center gap-3 flex-wrap">
          <span class="text-sm font-medium text-slate-800 w-32">${escapeHtml(names[i] ?? id)}</span>
          <span class="inline-flex rounded-lg border border-slate-200 overflow-hidden">${buttons}</span>
          ${current ? "" : '<span class="text-xs text-slate-400">ยังไม่บันทึก</span>'}
        </div>`;
      })
      .join("");    const moveOptions = (m.coachIds || []).map((id, i) => `<option value="${escapeHtml(id)}">${escapeHtml(names[i] ?? id)}</option>`).join("");
    const weekOptions = Array.from({ length: MEETING_WEEKS_PER_MONTH }, (_, i) => i + 1)
      .filter((w) => w !== selectedWeek && meetings.has(meetingKey(slot.team, w)))
      .map((w) => `<option value="${w}">สัปดาห์ ${w}</option>`)
      .join("");
    const sec = activeSection.get(m.id) || "all";
    const tabs = MEETING_SECTIONS.map((s) => {
      const filled = sectionHasPlan((m.sections || {})[s.key]) || sectionHasRecap((m.sections || {})[s.key], { includeAdminOnly: true });
      return `<button type="button" class="badge ${s.key === sec ? "badge-info" : "badge-neutral"} cursor-pointer" data-action="sec-tab" data-doc="${escapeHtml(m.id)}" data-sec="${s.key}">${s.label}${filled ? " ●" : ""}</button>`;
    }).join(" ");
    const acked = acksByMeeting.get(m.id)?.size || 0;
    html += `
      <div class="card card-pad space-y-3" data-slot-doc="${escapeHtml(m.id)}">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-slate-900">${escapeHtml(slot.team)}</span>
          <span class="text-sm text-slate-500 whitespace-nowrap">${icon("clock")} ${escapeHtml(m.startTime)}–${escapeHtml(m.endTime)} น.</span>
          <span class="text-xs text-slate-500 ml-auto">เข้าร่วม ${sum.attended} · ลา ${sum.leave} · ขาด ${sum.absent} · รอบันทึก ${sum.pending}</span>
        </div>
        <div class="space-y-2">
          <p class="text-xs font-semibold text-slate-600">ผลเข้าประชุม (เลือกได้ทีละคน กดซ้ำที่ปุ่มเดิมเพื่อล้าง)</p>
          ${rows || '<span class="text-sm text-slate-400">ไม่มีโค้ชในกลุ่มนี้</span>'}
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <input type="text" class="field-input flex-1" data-link-input placeholder="https://meet.google.com/abc-defg-hij" value="${escapeHtml(m.meetLink || "")}" />
          <button type="button" class="btn btn-secondary btn-sm" data-action="save-link" data-doc="${escapeHtml(m.id)}">บันทึกลิงก์</button>
        </div>
        ${
          moveOptions && weekOptions
            ? `<div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-slate-500">ย้ายโค้ช</span>
          <select class="field-input" style="width:auto" data-move-coach>${moveOptions}</select>
          <span class="text-xs text-slate-500">ไป</span>
          <select class="field-input" style="width:auto" data-move-week>${weekOptions}</select>
          <button type="button" class="btn btn-secondary btn-sm" data-action="move" data-doc="${escapeHtml(m.id)}">ย้าย</button>
        </div>`
            : ""
        }
        <div class="border-t border-slate-100 pt-3 space-y-3">
          <p class="font-semibold text-slate-900 text-sm">วาระและสรุปการประชุม</p>
          <div class="flex flex-wrap gap-2">${tabs}</div>
          ${sectionFormHtml(m, sec)}
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" data-action="publish" data-doc="${escapeHtml(m.id)}"${m.recapPublished ? " checked" : ""} />
            ส่งสรุปให้โค้ชแล้ว (โค้ชจะเห็นความรู้ การนำไปใช้ และการบ้านของส่วนกลางและสายตัวเอง ไม่เห็นความคิดของแอดมิน)
          </label>
          ${m.recapPublished ? `<p class="text-xs text-slate-500">โค้ชกดรับทราบแล้ว ${acked}/${(m.coachIds || []).length} คน</p>` : ""}
        </div>
      </div>`;
  }
  html += "</div>";

  const missing = unassignedCoaches();
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
  "save-section": (el) => {
    const sec = el.dataset.sec;
    const docId = el.dataset.doc;
    const updates = { updatedAt: serverTimestamp() };
    for (const ta of el.closest("[data-section-form]").querySelectorAll("textarea[data-field]")) {
      updates[`sections.${sec}.${ta.dataset.field}`] = ta.value.trim();
    }
    return withStatus("กำลังบันทึก...", async () => {
      await updateDoc(doc(db, "coachMeetings", docId), updates);
      drafts.delete(`${docId}|${sec}`);
    });
  },
  publish: (el) =>
    withStatus(el.checked ? "กำลังส่งสรุปให้โค้ช..." : "กำลังเก็บสรุปคืน...", () =>
      updateDoc(doc(db, "coachMeetings", el.dataset.doc), { recapPublished: el.checked, updatedAt: serverTimestamp() })
    )
};

bodyEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !bodyEl.contains(el)) return;
  // ปุ่มวันพุธ/พฤหัสบดีอยู่ในแถวที่คลิกเลือกสัปดาห์ได้ — ทำงานของปุ่มอย่างเดียว ไม่ให้แถวทำซ้ำ
  e.stopPropagation();
  actions[el.dataset.action]?.(el);
});

// เก็บข้อความที่กำลังพิมพ์ไว้ทุกครั้ง เพื่อไม่ให้หายเมื่อสลับแท็บสาย/บันทึกอย่างอื่นแล้วหน้าโหลดใหม่
bodyEl.addEventListener("input", (e) => {
  const ta = e.target.closest("textarea[data-field]");
  if (!ta) return;
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

export function openAdminMeetings() {
  return reload();
}

// ---------- ฝั่งโค้ช ----------
let cached = { key: "", at: 0, value: null };

// นัดครั้งถัดไป + สรุปประชุมล่าสุดที่ส่งให้แล้ว (ค้นเฉพาะทีมตัวเองในช่วง ±62 วัน — กฎ Firestore ต้อง where(team) ตรงกับทีม)
async function fetchCoachMeetingData(team, coachId, track) {
  const key = `${team}|${coachId}|${track}`;
  const now = Date.now();
  if (cached.key === key && now - cached.at < 30000) return cached.value;
  const today = todayBangkok();
  const [meetingSnap, ackSnap] = await Promise.all([
    getDocs(teamDateRangeQuery("coachMeetings", team, addDaysToDate(today, -62), addDaysToDate(today, 62))),
    getDocs(query(collection(db, "coachMeetingAcks"), where("team", "==", team), where("coachId", "==", coachId)))
  ]);
  const list = [];
  meetingSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  const ackedIds = new Set();
  ackSnap.forEach((d) => ackedIds.add(d.data().meetingId));
  const recap = latestPublishedRecap(list, coachId, today, track);
  const value = {
    next: nextMeetingForCoach(list, coachId, today),
    recap,
    recapAcked: !!recap && ackedIds.has(recap.id)
  };
  cached = { key, at: now, value };
  return value;
}

function invalidateCoachMeetingCache() {
  cached = { key: "", at: 0, value: null };
}

const preLine = 'style="white-space:pre-line"';

function nextMeetingCardHtml(m, track) {
  const left = daysUntil(m.date, todayBangkok());
  const soon = left <= 2;
  const link = safeHttpUrl(m.meetLink);
  const blocks = sectionsForTrack(track)
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

function recapCardHtml(m, track, acked, canAck) {
  const blocks = sectionsForTrack(track)
    .map((key) => {
      const s = (m.sections || {})[key];
      if (!sectionHasRecap(s)) return "";
      const rows = coachVisibleRecapFields().filter((f) => String(s[f.key] || "").trim())
        .map(
          (f) => `<div class="mt-2">
          <p class="text-xs font-semibold text-slate-500">${f.label}</p>
          <p class="text-sm text-slate-800" ${preLine}>${escapeHtml(s[f.key])}</p>
        </div>`
        )
        .join("");
      return `<div class="mt-3">
        <p class="text-sm font-semibold ${SECTION_TEXT_CLASS[key]}">${key === "all" ? "ส่วนกลาง (ทุกสาย)" : `สาย${sectionLabel(key)}`}</p>${rows}</div>`;
    })
    .join("");
  const ackPart = acked
    ? '<span class="badge badge-success mt-3">รับทราบแล้ว</span>'
    : canAck
      ? `<div class="mt-3"><button type="button" class="btn btn-secondary btn-sm" data-action="ack" data-meeting="${escapeHtml(m.id)}" data-month="${escapeHtml(m.month)}" data-team="${escapeHtml(m.team)}">รับทราบ</button></div>`
      : "";
  return `
    <div class="card card-pad ${acked ? "" : "ring-2 ring-blue-500"}">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <p class="font-semibold text-slate-900">สรุปการประชุมเมื่อ ${escapeHtml(thaiMeetingDateLabel(m.date))}</p>
        ${acked ? "" : '<span class="badge badge-info">ใหม่</span>'}
      </div>
      ${blocks}
      ${ackPart}
    </div>`;
}

const cardArgs = new WeakMap();

async function onCardClick(e) {
  const btn = e.target.closest('[data-action="ack"]');
  if (!btn) return;
  const args = cardArgs.get(e.currentTarget);
  if (!args) return;
  btn.disabled = true;
  try {
    await setDoc(doc(db, "coachMeetingAcks", ackDocId(btn.dataset.meeting, args.coachId)), {
      team: btn.dataset.team,
      meetingId: btn.dataset.meeting,
      coachId: args.coachId,
      month: btn.dataset.month,
      createdAt: serverTimestamp()
    });
    invalidateCoachMeetingCache();
    await renderCoachMeetingCard(e.currentTarget, args.team, args.coachId, args.opts);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    alert("บันทึกการรับทราบไม่สำเร็จ: " + err.message);
  }
}

// opts = { position: ตำแหน่งโค้ช (กำหนดสาย), canAck: false เมื่อผู้ดูแลระบบสวมบทบาทดูแทนโค้ช (กดรับทราบแทนไม่ได้) }
export async function renderCoachMeetingCard(el, team, coachId, opts = {}) {
  cardArgs.set(el, { team, coachId, opts });
  if (!el.dataset.bound) {
    el.dataset.bound = "1";
    el.addEventListener("click", onCardClick);
  }
  el.classList.add("hidden");
  el.innerHTML = "";
  if (!coachId) return;
  try {
    const track = coachTrackOf(opts.position);
    const { next, recap, recapAcked } = await fetchCoachMeetingData(team, coachId, track);
    if (!next && !recap) return;
    el.className = "space-y-3";
    el.innerHTML = (next ? nextMeetingCardHtml(next, track) : "") + (recap ? recapCardHtml(recap, track, recapAcked, opts.canAck !== false) : "");
  } catch (err) {
    // การ์ดเสริมของหน้า Daily — ไม่แสดง error ให้กวนใจ (เหมือนตัวเตือนงานประจำวัน)
    console.error(err);
  }
}

// รายการสำหรับกระดิ่งของโค้ช: นัดของตัวเองที่เหลือไม่เกิน 3 วัน + สรุปประชุมที่ยังไม่กดรับทราบ (read: true = ไม่มีปุ่ม "อ่านแล้ว"
// เพราะโค้ชเขียนสถานะอ่านลง Firestore ไม่ได้ — รายการหายเองเมื่อพ้นวันประชุม/กดรับทราบแล้ว)
export async function loadCoachMeetingNotifications(team, coachId, position) {
  const { next, recap, recapAcked } = await fetchCoachMeetingData(team, coachId, coachTrackOf(position));
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
        link: "./attendance.html#screen=daily"
      });
    }
  }
  if (recap && !recapAcked) {
    items.push({
      key: "coach_meeting_recap",
      icon: icon("book"),
      level: "info",
      read: true,
      title: "มีสรุปการประชุมใหม่จากแอดมิน",
      detail: `${escapeHtml(thaiMeetingDateLabel(recap.date))} · ${escapeHtml(recap.team)}`,
      link: "./attendance.html#screen=daily"
    });
  }
  return items;
}
