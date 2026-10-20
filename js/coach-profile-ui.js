// หน้าจอ Profile ของโค้ช (อ่านอย่างเดียว) — ตรรกะ/HTML อยู่ที่ coach-profile.js ไฟล์นี้ผูก DOM + Firestore
// ข้อมูลทั้งหมดเป็นของโค้ชคนที่กำลังใช้งาน (หรือโค้ชที่ผู้ดูแลระบบสวมบทบาทอยู่) — โค้ชแก้ข้อมูลบัญชีเองไม่ได้ตามกฎ Firestore
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, monthDateRange, teamDateRangeQuery, thisMonthBangkok, todayBangkok } from "./ui-utils.js";
import { currentEntryRound, roundLabel } from "./fitness-calc.js";
import { coachAccessModel, daysLeft, windowLabel } from "./athlete-windows.js";
import { monthsBack } from "./plan-report-data.js";
import { thaiMonthLabel } from "./coach-meetings.js";
import { ageGroupRows, monthlyStats, profileInfoHtml, profileStatsHtml } from "./coach-profile.js";

const el = (id) => document.getElementById(id);
let api = null; // { record() = เอกสารโค้ช {id, ...} หรือ null, team(), taskCount() = async จำนวนงานหลังประชุมค้าง (null = ไม่ทราบ) }
let players = [];
let requestId = 0; // กันผลของคำขอเก่าทับคำขอใหม่เมื่อเปลี่ยนเดือน/เปิดหน้าซ้ำเร็วๆ

const fetchDocs = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));

async function loadStats(id) {
  const record = api.record();
  const team = api.team();
  const month = el("profile-month-select").value || thisMonthBangkok();
  const box = el("profile-stats");
  box.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  const { start, end } = monthDateRange(month);
  try {
    const [sessions, attendance, plans, reports, meetings] = await Promise.all(
      ["sessions", "attendance", "trainingPlans", "trainingReports", "coachMeetings"].map((name) => fetchDocs(teamDateRangeQuery(name, team, start, end)))
    );
    if (id !== requestId) return;
    box.innerHTML = profileStatsHtml(monthlyStats({ team, month, coach: record, sessions, attendance, plans, reports, meetings, players }));
  } catch (err) {
    console.error(err);
    if (id === requestId) box.innerHTML = `<p class="text-sm text-red-600">โหลดผลการทำงานไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

export async function showProfile() {
  const id = ++requestId;
  const record = api.record();
  const team = api.team();
  const info = el("profile-info");
  const statsWrap = el("profile-stats-wrap");
  if (!record || !team) {
    info.innerHTML = '<div class="card card-pad text-slate-500">โหมดจัดการทีมแบบกว้างไม่ได้ระบุโค้ชคนใดคนหนึ่ง เลือกโค้ชรายคนจากรายชื่อโค้ชเพื่อดูโปรไฟล์</div>';
    statsWrap.classList.add("hidden");
    return;
  }
  statsWrap.classList.remove("hidden");
  const month = el("profile-month-select");
  if (!month.options.length) {
    month.innerHTML = monthsBack(thisMonthBangkok(), 12).map((m) => `<option value="${m}">${escapeHtml(thaiMonthLabel(m))}</option>`).join("");
  }
  info.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const today = todayBangkok();
    // งานที่ต้องทำ: ดึงไม่สำเร็จไม่ให้ล้มทั้งหน้า (แสดงเป็น "-" / "ไม่มี")
    const [playerList, rounds, windows, tasks] = await Promise.all([
      fetchDocs(query(collection(db, "players"), where("team", "==", team))),
      fetchDocs(collection(db, "fitnessRounds")).catch(() => []),
      fetchDocs(collection(db, "athleteResultsWindows")).catch(() => []),
      Promise.resolve(api.taskCount()).catch(() => null)
    ]);
    if (id !== requestId) return;
    players = playerList;
    const round = currentEntryRound(rounds, today);
    const access = coachAccessModel(windows, team, today);
    const book = access.kind === "open" ? `${windowLabel(access.windows[0])} (${daysLeft(access.windows[0], today) === 0 ? "วันสุดท้าย" : `เหลือ ${daysLeft(access.windows[0], today)} วัน`})` : null;
    info.innerHTML = profileInfoHtml({ coach: record, team, ageRows: ageGroupRows(record, players), todo: { tasks, round: round ? roundLabel(round) : null, book } });
    await loadStats(id);
  } catch (err) {
    console.error(err);
    if (id === requestId) info.innerHTML = `<div class="card card-pad text-red-600">โหลดโปรไฟล์ไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

export function initProfile(c) {
  api = c;
  el("profile-month-select").addEventListener("change", () => loadStats(requestId));
}
