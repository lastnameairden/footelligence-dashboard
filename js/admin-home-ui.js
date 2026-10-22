// Home ของแอดมินในหน้าทีม: ภาพรวมของทีมที่เลือกวันนี้ + การ์ด Meeting — ตรรกะ/HTML อยู่ที่ admin-home.js
// ไฟล์นี้ผูก DOM + Firestore: ดึงเฉพาะข้อมูลของทีมนี้ (และจำนวนคำขอลงทะเบียนที่ค้าง) อ่านส่วนไหนไม่สำเร็จก็แสดงข้อความของส่วนนั้นต่อหัวเรื่อง ไม่ล้มทั้งหน้า
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { TEAM_TRAINING_WEEKDAYS, escapeHtml, teamDateRangeQuery, todayBangkok } from "./ui-utils.js";
import { addDaysToDate } from "./coach-meetings.js";
import { TREND_DAYS, adminChartsHtml, adminChartsModel, adminHomeHtml, adminHomeModel } from "./admin-home.js";
import { meetingCardHtml } from "./staff-home-ui.js";

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// ดึงไม่สำเร็จ = คืน null (ผู้เรียกนับเป็นข้อมูลว่างและบอกผู้ใช้ว่าบางส่วนโหลดไม่ได้)
const safely = (promise, failures, what) => promise.then(docsOf).catch((err) => (console.error(err), failures.push(what), null));

let requestId = 0;

// executive = Home ของผู้บริหาร: ไม่มีการ์ดคำขอลงทะเบียน (ไม่ดึงข้อมูลนั้น) และไม่มีการ์ด Meeting
export async function showAdminHome(body, { team, ageGroup = "", executive = false }) {
  const id = ++requestId;
  body.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  const today = todayBangkok();
  const [y, m, d] = today.split("-").map(Number);
  const trainsToday = (TEAM_TRAINING_WEEKDAYS[team] || []).includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  const todayOf = (name) => query(collection(db, name), where("team", "==", team), where("date", "==", today));
  const failures = [];
  // กราฟแนวโน้มใช้ attendance ย้อนหลัง 2 ช่วง (ปัจจุบัน + 30 วันก่อนหน้า) ของทั้งทีม แล้วกรองรุ่นอายุฝั่งหน้าเว็บ
  const [players, coaches, pending, sessions, attendance, plans, reports, injuries, history, meeting] = await Promise.all([
    safely(getDocs(query(collection(db, "players"), where("team", "==", team))), failures, "นักกีฬา"),
    safely(getDocs(query(collection(db, "coaches"), where("team", "==", team))), failures, "โค้ช"),
    executive ? Promise.resolve([]) : safely(getDocs(query(collection(db, "coaches"), where("status", "==", "pending"))), failures, "คำขอลงทะเบียน"),
    safely(getDocs(todayOf("sessions")), failures, "รอบเช็คชื่อ"),
    safely(getDocs(todayOf("attendance")), failures, "เช็คชื่อ"),
    safely(getDocs(todayOf("trainingPlans")), failures, "แผนฝึก"),
    safely(getDocs(todayOf("trainingReports")), failures, "รายงานฝึก"),
    safely(getDocs(query(collection(db, "injuryReports"), where("team", "==", team))), failures, "รายงานบาดเจ็บ"),
    safely(getDocs(teamDateRangeQuery("attendance", team, addDaysToDate(today, -(TREND_DAYS * 2 - 1)), today)), failures, "ประวัติเช็คชื่อ"),
    executive ? Promise.resolve("") : meetingCardHtml(team).catch((err) => (console.error(err), `<div class="card card-pad text-sm text-red-600">โหลดงานประชุมไม่สำเร็จ: ${escapeHtml(err.message)}</div>`))
  ]);
  if (id !== requestId) return; // เปิดหน้าอื่น/สลับทีมไปแล้ว
  const model = adminHomeModel({
    today,
    trainsToday,
    players: players ?? [],
    coaches: (coaches ?? []).filter((c) => c.role === "coach" && c.status === "approved"),
    sessions: sessions ?? [],
    attendance: attendance ?? [],
    plans: plans ?? [],
    reports: reports ?? [],
    injuries: injuries ?? [],
    pendingApprovals: (pending ?? []).length,
    ageGroup
  });
  const charts = adminChartsModel({ players: players ?? [], attendance: history ?? [], today, ageGroup });
  const warn = failures.length ? `<div class="card card-pad text-sm text-amber-700">โหลดข้อมูลบางส่วนไม่สำเร็จ (${escapeHtml(failures.join(", "))}) ตัวเลขที่เกี่ยวข้องอาจไม่ครบ</div>` : "";
  body.innerHTML = `${warn}${adminHomeHtml(model, { team, showApprovals: !executive })}${adminChartsHtml(charts)}${meeting}`;
}

// ปุ่มบนการ์ดสรุป (data-home-go) — go = "approvals" | "injury" ผู้เรียกกำหนดว่าจะเปิดหน้าไหน
export function initAdminHome(body, go) {
  body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-home-go]");
    if (btn) go(btn.dataset.homeGo);
  });
}
