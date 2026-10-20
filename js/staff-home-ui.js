// Home ของหน้าทีมสำหรับทีมหลังบ้าน: ประกาศจากผู้ดูแลระบบ + (สิทธิ์ meetings) งานหลังประชุมของโค้ชที่รอตรวจ — ตรรกะ/HTML อยู่ที่ staff-announcements.js
// และ coach-meetings.js ไฟล์นี้ผูก DOM + Firestore: อ่านไม่สำเร็จแสดงข้อความในส่วนนั้นเท่านั้น ไม่ล้มทั้งหน้า
import { collection, getDocs, limit, orderBy, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, monthDateRange, teamDateRangeQuery, thisMonthBangkok, todayBangkok } from "./ui-utils.js";
import { teamRecapSummary } from "./coach-meetings.js";
import { announcementCardHtml, announcementTime, sortAnnouncements, unreadAnnouncements } from "./staff-announcements.js";

const seenKey = (uid) => `staffAnnSeen:${uid}`;

function readSeen(uid) {
  try {
    return Number(localStorage.getItem(seenKey(uid))) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(uid, ms) {
  try {
    localStorage.setItem(seenKey(uid), String(ms));
  } catch {
    // จำเวลาที่อ่านไม่ได้ (โหมดส่วนตัว) = ครั้งหน้าขึ้นป้าย "ใหม่" ซ้ำ ไม่กระทบการใช้งาน
  }
}

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const errorBox = (what, err) => `<div class="card card-pad text-sm text-red-600">โหลด${what}ไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;

async function meetingCardHtml(team) {
  const month = thisMonthBangkok();
  const { start, end } = monthDateRange(month);
  const [meetingSnap, recapSnap] = await Promise.all([
    getDocs(teamDateRangeQuery("coachMeetings", team, start, end)),
    getDocs(query(collection(db, "coachMeetingRecaps"), where("team", "==", team), where("month", "==", month)))
  ]);
  const meetings = docsOf(meetingSnap);
  if (meetings.length === 0) {
    return `<div class="card card-pad space-y-1"><p class="font-semibold text-slate-900">Meeting</p><p class="text-sm text-slate-500">ยังไม่มีตารางประชุมของเดือนนี้</p></div>`;
  }
  const recaps = new Map(recapSnap.docs.map((d) => [d.id, d.data()]));
  const s = teamRecapSummary(meetings, recaps, todayBangkok());
  const open = '<button type="button" class="btn btn-secondary btn-sm" data-staff-open-meeting>เปิดหน้า Meeting</button>';
  if (s.waiting === 0) {
    return `<div class="card card-pad space-y-2"><p class="font-semibold text-slate-900">Meeting</p><p class="text-sm text-slate-500">ไม่มีงานหลังประชุมค้างตรวจ · ส่งแล้ว ${s.done} งานในเดือนนี้</p>${open}</div>`;
  }
  const overdue = s.overdue > 0 ? ` · เลยกำหนด ${s.overdue}` : "";
  return `<div class="card card-warning card-pad space-y-2">
    <p class="font-semibold text-slate-900">Meeting: รอตรวจคำตอบจากโค้ช ${s.waiting} งาน${overdue}</p>
    <p class="text-sm text-slate-600">${escapeHtml([...new Set(s.waitingCoaches)].join(", "))}</p>
    ${open}
  </div>`;
}

async function announcementsHtml(uid) {
  const snap = await getDocs(query(collection(db, "staffAnnouncements"), orderBy("createdAt", "desc"), limit(30)));
  const list = sortAnnouncements(docsOf(snap));
  const seen = readSeen(uid);
  const unread = new Set(unreadAnnouncements(list, seen).map((a) => a.id));
  if (list.length > 0) writeSeen(uid, announcementTime(list[0]));
  const cards = list.length === 0 ? '<div class="card card-pad text-sm text-slate-500">ยังไม่มีประกาศจากผู้ดูแลระบบ</div>' : list.map((a) => announcementCardHtml(a, { unread: unread.has(a.id) })).join("");
  return `<div class="space-y-2"><h3 class="section-title">ประกาศจากผู้ดูแลระบบ</h3>${cards}</div>`;
}

let requestId = 0;

export function initStaffHome(body, openMeeting) {
  body.addEventListener("click", (e) => {
    if (e.target.closest("[data-staff-open-meeting]")) openMeeting();
  });
}

export async function showStaffHome(body, { team, uid, canMeetings }) {
  const id = ++requestId;
  body.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  const [meeting, announcements] = await Promise.all([
    canMeetings ? meetingCardHtml(team).catch((err) => (console.error(err), errorBox("งานประชุม", err))) : "",
    announcementsHtml(uid).catch((err) => (console.error(err), errorBox("ประกาศ", err)))
  ]);
  if (id !== requestId) return; // เปิดหน้าอื่น/สลับทีมไปแล้ว
  body.innerHTML = `${meeting}${announcements}`;
}
