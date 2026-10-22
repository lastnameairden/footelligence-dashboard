// เมนูหน้าทีมของ "ผู้บริหารทีม" (ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) — ผู้บริหารมีทีมเดียว ดูอย่างเดียว
// ใช้หน้าจอชุดเดียวกับทีมหลังบ้าน (staff-menu.js) แต่ตัด Tools ออก และเพิ่ม Dashboard (ฝัง index.html) ไว้ถัดจาก Home
// Meeting เป็นสรุปการประชุมโค้ชของทีมตัวเองแบบอ่านอย่างเดียว (หน้า staff-meeting โหมด readOnly)
import { STAFF_MENU } from "./staff-menu.js";

const pick = (key) => {
  const { perm, ...item } = STAFF_MENU.find((m) => m.key === key);
  return item;
};

export const EXEC_TEAM_MENU = [
  pick("home"),
  { key: "dashboard", label: "Dashboard", hint: "กราฟภาพรวมของทีม", icon: "bar-chart", screen: "team-dashboard", screens: ["team-dashboard"] },
  pick("coach-data"),
  pick("player-data"),
  pick("attendance"),
  pick("training"),
  pick("match-data"),
  pick("evaluation"),
  pick("injury-sick"),
  pick("meeting")
];
