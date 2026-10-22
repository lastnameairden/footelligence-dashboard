// Dashboard ของผู้บริหารทีม: ผูก DOM + Firestore — ดึงเฉพาะข้อมูลของทีมนี้ (ตรรกะ/HTML อยู่ที่ exec-dashboard.js)
// ดึงส่วนไหนไม่สำเร็จก็นับเป็นข้อมูลว่างและบอกผู้ใช้ว่าบางส่วนโหลดไม่ได้ ไม่ล้มทั้งหน้า
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, monthQuery, teamDateRangeQuery, teamLogoImg, thisMonthBangkok, todayBangkok } from "./ui-utils.js";
import { addMonthsToMonth } from "./coach-meetings.js";
import { execDashboardHtml, execDashboardModel } from "./exec-dashboard.js";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const safely = (promise, failures, what) => promise.then(docsOf).catch((err) => (console.error(err), failures.push(what), []));

// "2026-10" -> "ตุลาคม 2569"
export function thaiMonthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

export async function showExecDashboard(body, team) {
  body.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  const today = todayBangkok();
  const month = thisMonthBangkok();
  const prevMonthStart = `${addMonthsToMonth(month, -1)}-01`;
  const failures = [];
  const [players, attendance, plans, matches, injuries] = await Promise.all([
    safely(getDocs(query(collection(db, "players"), where("team", "==", team))), failures, "นักกีฬา"),
    safely(getDocs(teamDateRangeQuery("attendance", team, prevMonthStart, today)), failures, "เช็คชื่อ"),
    safely(getDocs(monthQuery("trainingPlans", team, month)), failures, "แผนฝึก"),
    safely(getDocs(monthQuery("matchReports", team, month)), failures, "ผลแข่งขัน"),
    safely(getDocs(query(collection(db, "injuryReports"), where("team", "==", team))), failures, "รายงานบาดเจ็บ")
  ]);
  const model = execDashboardModel({ today, players, attendance, plans, matches, injuries });
  const warn = failures.length ? `<div class="card card-pad text-sm text-amber-700 mb-4">โหลดข้อมูลบางส่วนไม่สำเร็จ (${escapeHtml(failures.join(", "))}) ตัวเลขที่เกี่ยวข้องอาจไม่ครบ</div>` : "";
  body.innerHTML = warn + execDashboardHtml(model, { team, teamLogo: teamLogoImg(team, "w-10 h-10 object-contain inline-block rounded"), monthLabel: thaiMonthLabel(month) });
}
