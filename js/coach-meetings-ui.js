// หน้าจอของระบบนัดประชุมโค้ชรายสัปดาห์ (ตรรกะล้วนๆ อยู่ที่ coach-meetings.js)
//   - ผู้ดูแลระบบ: สร้างตารางประจำเดือน เลือกวันพุธ/พฤหัสบดีรายสัปดาห์ ใส่ลิงก์ Google Meet ย้ายโค้ชข้ามสัปดาห์ และบันทึกผลเข้าประชุม
//   - โค้ช: การ์ด "ประชุมครั้งถัดไป" บนหน้า Daily + แจ้งเตือนที่กระดิ่งก่อนวันประชุม
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
  deleteField,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { icon } from "./icons.js";
import {
  escapeHtml,
  safeHttpUrl,
  ageGroupSortKey,
  teamDateRangeQuery,
  todayBangkok,
  thisMonthBangkok
} from "./ui-utils.js";
import {
  MEETING_TEAM_SLOTS,
  MEETING_WEEKS_PER_MONTH,
  MEETING_WEEKDAY_LABELS,
  DEFAULT_MEETING_WEEKDAYS,
  MEETING_ATTENDANCE_LABELS,
  addDaysToDate,
  addMonthsToMonth,
  buildTeamMeetingDocs,
  daysUntil,
  describeDaysUntil,
  googleCalendarUrl,
  isValidMeetingLink,
  meetingDate,
  meetingWeekdayOf,
  nextAttendanceStatus,
  nextMeetingForCoach,
  summarizeMeetingAttendance,
  thaiMeetingDateLabel,
  thaiMonthLabel
} from "./coach-meetings.js";

// ---------- ฝั่งผู้ดูแลระบบ ----------
const monthLabelEl = document.getElementById("admin-meetings-month-label");
const prevBtn = document.getElementById("admin-meetings-prev-btn");
const nextBtn = document.getElementById("admin-meetings-next-btn");
const statusEl = document.getElementById("admin-meetings-status");
const bodyEl = document.getElementById("admin-meetings-body");

let viewMonth = thisMonthBangkok();
let selectedWeek = 1;
let coachesByTeam = new Map(); // team -> [{ id, name, ageGroups }] เรียงตามรุ่นอายุ
let meetings = new Map(); // `${team}|${week}` -> { id, ...data }

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

const meetingKey = (team, week) => `${team}|${week}`;

async function reload() {
  monthLabelEl.textContent = thaiMonthLabel(viewMonth);
  bodyEl.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const [coachSnap, meetingSnap] = await Promise.all([
      getDocs(query(collection(db, "coaches"), where("role", "==", "coach"))),
      getDocs(query(collection(db, "coachMeetings"), where("month", "==", viewMonth)))
    ]);
    const teams = new Set(MEETING_TEAM_SLOTS.map((s) => s.team));
    coachesByTeam = new Map(MEETING_TEAM_SLOTS.map((s) => [s.team, []]));
    coachSnap.forEach((d) => {
      const c = d.data();
      if (c.status !== "approved" || !teams.has(c.team)) return;
      coachesByTeam.get(c.team).push({ id: d.id, name: c.name ?? "-", ageGroups: c.ageGroups || [] });
    });
    for (const list of coachesByTeam.values()) {
      list.sort((a, b) => ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups) || a.name.localeCompare(b.name));
    }
    meetings = new Map();
    meetingSnap.forEach((d) => {
      const m = { id: d.id, ...d.data() };
      meetings.set(meetingKey(m.team, m.week), m);
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
    <p class="text-xs text-slate-500">แตะชื่อโค้ชเพื่อบันทึกผล: ยังไม่บันทึก → เข้าร่วม → ลา → ขาด</p>
    <div class="space-y-3">`;

  for (const slot of MEETING_TEAM_SLOTS) {
    const m = meetings.get(meetingKey(slot.team, selectedWeek));
    if (!m) {
      html += `<div class="card card-pad"><p class="font-semibold text-slate-900">${escapeHtml(slot.team)}</p><p class="text-sm text-slate-500">ไม่มีนัดในสัปดาห์นี้</p></div>`;
      continue;
    }
    const sum = summarizeMeetingAttendance(m);
    const names = m.coachNames || [];
    const chips = (m.coachIds || [])
      .map((id, i) => {
        const s = (m.attendance || {})[id] || "";
        const cls = s === "attended" ? "badge-success" : s === "leave" ? "badge-warning" : s === "absent" ? "badge-danger" : "badge-neutral";
        const label = s ? ` · ${MEETING_ATTENDANCE_LABELS[s]}` : "";
        return `<button type="button" class="badge ${cls} cursor-pointer" data-action="attendance" data-doc="${escapeHtml(m.id)}" data-coach="${escapeHtml(id)}">${escapeHtml(names[i] ?? id)}${label}</button>`;
      })
      .join(" ");
    const moveOptions = (m.coachIds || []).map((id, i) => `<option value="${escapeHtml(id)}">${escapeHtml(names[i] ?? id)}</option>`).join("");
    const weekOptions = Array.from({ length: MEETING_WEEKS_PER_MONTH }, (_, i) => i + 1)
      .filter((w) => w !== selectedWeek && meetings.has(meetingKey(slot.team, w)))
      .map((w) => `<option value="${w}">สัปดาห์ ${w}</option>`)
      .join("");
    html += `
      <div class="card card-pad space-y-3" data-slot-doc="${escapeHtml(m.id)}">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-slate-900">${escapeHtml(slot.team)}</span>
          <span class="text-sm text-slate-500">${icon("clock")} ${escapeHtml(m.startTime)}–${escapeHtml(m.endTime)} น.</span>
          <span class="text-xs text-slate-500 ml-auto">เข้าร่วม ${sum.attended} · ลา ${sum.leave} · ขาด ${sum.absent} · รอบันทึก ${sum.pending}</span>
        </div>
        <div class="flex flex-wrap gap-2">${chips || '<span class="text-sm text-slate-400">ไม่มีโค้ชในกลุ่มนี้</span>'}</div>
        <div class="flex items-center gap-2 flex-wrap">
          <input type="text" class="field-input flex-1" data-link-input placeholder="https://meet.google.com/abc-defg-hij" value="${escapeHtml(m.meetLink || "")}" />
          <button type="button" class="btn btn-secondary btn-sm" data-action="save-link" data-doc="${escapeHtml(m.id)}">บันทึกลิงก์</button>
        </div>
        ${
          moveOptions && weekOptions
            ? `<div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-slate-500">ย้ายโค้ช</span>
          <select class="field-input" data-move-coach>${moveOptions}</select>
          <span class="text-xs text-slate-500">ไป</span>
          <select class="field-input" data-move-week>${weekOptions}</select>
          <button type="button" class="btn btn-secondary btn-sm" data-action="move" data-doc="${escapeHtml(m.id)}">ย้าย</button>
        </div>`
            : ""
        }
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

// สร้าง/แบ่งกลุ่มใหม่ทุกทีม — คงวันพุธ/พฤหัสบดีและลิงก์เดิมไว้ (ถ้ามี) แต่ล้างผลเข้าประชุมเพราะกลุ่มเปลี่ยน
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
    batch.set(doc(db, "coachMeetings", d.id), { ...d.data, updatedAt: serverTimestamp() });
  }
  await batch.commit();
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
    if (!confirm("แบ่งกลุ่มโค้ชใหม่ทั้งหมด? การย้ายโค้ชและผลเข้าประชุมที่บันทึกไว้ของเดือนนี้จะถูกล้าง (วันและลิงก์ Meet คงเดิม)")) return;
    return withStatus("กำลังแบ่งกลุ่มใหม่...", writeAllDocs);
  },
  attendance: (el) =>
    withStatus("กำลังบันทึกผลเข้าประชุม...", async () => {
      const m = [...meetings.values()].find((x) => x.id === el.dataset.doc);
      if (!m) return;
      const next = nextAttendanceStatus((m.attendance || {})[el.dataset.coach] || "");
      await updateDoc(doc(db, "coachMeetings", m.id), {
        [`attendance.${el.dataset.coach}`]: next || deleteField(),
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
    const from = [...meetings.values()].find((x) => x.id === el.dataset.doc);
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
  }
};

bodyEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !bodyEl.contains(el)) return;
  // ปุ่มวันพุธ/พฤหัสบดีอยู่ในแถวที่คลิกเลือกสัปดาห์ได้ — ทำงานของปุ่มอย่างเดียว ไม่ให้แถวทำซ้ำ
  e.stopPropagation();
  actions[el.dataset.action]?.(el);
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
let cachedNext = { key: "", at: 0, value: null };

// นัดประชุมครั้งถัดไปของโค้ชคนนี้ (ค้นเฉพาะทีมตัวเองในช่วง 62 วันข้างหน้า — กฎ Firestore ต้อง where(team) ตรงกับทีม)
async function fetchNextMeeting(team, coachId) {
  const key = `${team}|${coachId}`;
  const now = Date.now();
  if (cachedNext.key === key && now - cachedNext.at < 30000) return cachedNext.value;
  const today = todayBangkok();
  const snap = await getDocs(teamDateRangeQuery("coachMeetings", team, today, addDaysToDate(today, 62)));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  const value = nextMeetingForCoach(list, coachId, today);
  cachedNext = { key, at: now, value };
  return value;
}

export async function renderCoachMeetingCard(el, team, coachId) {
  el.classList.add("hidden");
  el.innerHTML = "";
  if (!coachId) return;
  try {
    const m = await fetchNextMeeting(team, coachId);
    if (!m) return;
    const left = daysUntil(m.date, todayBangkok());
    const soon = left <= 2;
    const link = safeHttpUrl(m.meetLink);
    el.className = `card card-pad flex items-center gap-4 flex-wrap ${soon ? "card-warning" : ""}`;
    el.innerHTML = `
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
      </div>`;
    el.classList.remove("hidden");
  } catch (err) {
    // การ์ดเสริมของหน้า Daily — ไม่แสดง error ให้กวนใจ (เหมือนตัวเตือนงานประจำวัน)
    console.error(err);
  }
}

// รายการสำหรับกระดิ่งของโค้ช: แจ้งเมื่อนัดประชุมของตัวเองเหลือไม่เกิน 3 วัน (read: true = ไม่มีปุ่ม "อ่านแล้ว" เพราะโค้ชเขียน
// สถานะอ่านลง Firestore ไม่ได้ — รายการหายเองเมื่อพ้นวันประชุม)
export async function loadCoachMeetingNotifications(team, coachId) {
  const m = await fetchNextMeeting(team, coachId);
  if (!m) return [];
  const left = daysUntil(m.date, todayBangkok());
  if (left > 3) return [];
  return [
    {
      key: "coach_meeting",
      icon: icon("calendar"),
      level: "action",
      read: true,
      title: `ประชุมโค้ช${describeDaysUntil(left)}`,
      detail: `${escapeHtml(thaiMeetingDateLabel(m.date))} · ${escapeHtml(m.startTime)}–${escapeHtml(m.endTime)} น. · ${escapeHtml(m.team)}`,
      link: "./attendance.html#screen=daily"
    }
  ];
}
