// การแจ้งเตือนของผู้ดูแลระบบ (กระดิ่ง): รายการแยกตามทีม รวมทุกทีมไว้ในกระดิ่งเดียว — กดรายการของทีมไหนก็เข้าหน้าทีมนั้นตรงหน้าที่เกี่ยวข้อง
// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase) เทสต์ใน Node ได้ — ui-utils.js ดึงข้อมูลจาก Firestore แล้วส่งเข้ามาที่นี่
import { icon } from "./icons.js";

// ลิงก์เข้าหน้าทีมแบบใหม่ของแอดมิน (screen = หน้าในเมนูของหน้าทีม หรือเครื่องมือในเมนู Admin เช่น approvals / progress)
export const teamSpaceLink = (team, screen) => `attendance.html#admin=team&team=${encodeURIComponent(team)}&as=admin&screen=${encodeURIComponent(screen)}`;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// รายการต่อทีม: key = `${หมวด}:${ทีม}` (สถานะอ่านแล้วแยกตามทีม) · team/screen ใช้ให้หน้าเว็บพาเข้าหน้าทีมโดยไม่โหลดหน้าใหม่
const forTeam = (category, team, screen, level, iconName, title, detail, count) => ({
  key: `${category}:${team}`,
  team,
  screen,
  icon: icon(iconName),
  level,
  count,
  title: `${esc(team)}: ${title}`,
  detail,
  link: teamSpaceLink(team, screen)
});

const groupBy = (list, keyOf) => {
  const map = new Map();
  for (const item of list) {
    const k = keyOf(item);
    if (!k) continue;
    map.set(k, [...(map.get(k) || []), item]);
  }
  return map;
};

// input:
//   pendingNames  = ชื่อบัญชีที่รออนุมัติ (ไม่ผูกทีม)  fallbackTeam = ทีมที่ใช้เปิดหน้าอนุมัติ (หน้าอนุมัติเป็นเครื่องมือของหน้าทีม)
//   activeInjuries = รายงานบาดเจ็บที่ยังไม่หาย {team, severity, playerName}
//   missingPlanDaysByTeam = Map ทีม → จำนวนวันขาดส่งแผน (14 วัน)
//   lateCoaches = [{ coachName, team, late, total }] ที่ส่งสายเกินเกณฑ์เดือนนี้
//   incompleteDaysByTeam = Map ทีม → จำนวนวันประเมินไม่ครบ (14 วัน)
export function buildAdminNotifications({ pendingNames = [], fallbackTeam, activeInjuries = [], missingPlanDaysByTeam = new Map(), lateCoaches = [], incompleteDaysByTeam = new Map() }) {
  const out = [];

  if (pendingNames.length > 0 && fallbackTeam) {
    out.push({
      key: "pending_accounts",
      team: null, // ไม่ผูกทีม — หน้าเว็บเปิดหน้าอนุมัติในทีมที่ดูอยู่ (ถ้าไม่ได้อยู่ในทีมใช้ fallbackTeam)
      screen: "approvals",
      icon: icon("star"),
      level: "urgent",
      count: pendingNames.length,
      title: `คำขอลงทะเบียนรออนุมัติ ${pendingNames.length} รายการ`,
      detail: esc(pendingNames.slice(0, 5).join(", ") + (pendingNames.length > 5 ? " และอื่นๆ" : "")),
      link: teamSpaceLink(fallbackTeam, "approvals")
    });
  }

  for (const [team, list] of groupBy(activeInjuries, (i) => i.team)) {
    const severe = list.filter((i) => i.severity === "รุนแรง");
    if (severe.length > 0) {
      out.push(forTeam("severe_injuries", team, "injury-results", "urgent", "heart-pulse", `นักกีฬาบาดเจ็บระดับรุนแรงที่ยังไม่หาย ${severe.length} คน`, esc(severe.map((i) => i.playerName ?? "-").join(", ")), severe.length));
    }
    const others = list.length - severe.length;
    if (others > 0) {
      out.push(forTeam("other_injuries", team, "injury-results", "info", "heart-pulse", `นักกีฬาบาดเจ็บที่ยังไม่หาย ${others} คน`, "ระดับปานกลาง/กำลังพักฟื้น — ไม่เร่งด่วนเท่าระดับรุนแรง", others));
    }
  }

  for (const [team, days] of missingPlanDaysByTeam) {
    out.push(forTeam("missing_plans_recent", team, "plan-data", "action", "clock", "ขาดส่งแผนการฝึกซ้อมใน 14 วันที่ผ่านมา", `ขาด ${days} วัน`, days));
  }

  for (const [team, list] of groupBy(lateCoaches, (c) => c.team)) {
    out.push(forTeam("late_coaches_month", team, "plan-data", "action", "trending-down", `โค้ชที่ส่งแผนการฝึกซ้อมสายเกินเกณฑ์เดือนนี้ ${list.length} คน`, esc(list.map((g) => `${g.coachName} (สาย ${g.late}/${g.total} ครั้ง)`).join(", ")), list.length));
  }

  for (const [team, days] of incompleteDaysByTeam) {
    out.push(forTeam("incomplete_evaluations_recent", team, "progress", "info", "clipboard-list", "มีวันประเมินนักกีฬาไม่ครบใน 14 วันที่ผ่านมา", `${days} วัน`, days));
  }

  return out;
}
