// เมนูหลัก 9 รายการของ "ทีมหลังบ้าน" ในหน้าทีม (ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// รูปแบบเดียวกับ COACH_MENU ใน coach-menu.js (key/label/hint/icon/screen/screens/children) เพื่อใช้ตัววาดเมนูเดียวกัน
// perm = สิทธิ์ของทีมหลังบ้านที่ต้องมีจึงจะเห็นเมนูนี้ (ดู staff-perms.js) — ซ่อนเมนูอย่างเดียว ตัวบังคับจริงคือกฎ Firestore
// หน้าทีมนี้ "ดูอย่างเดียว": การแก้ข้อมูลแทนโค้ชยังอยู่ในโหมดจัดการทีมเดิม (สิทธิ์ manageTeams)
import { staffCan } from "./staff-perms.js";

export const STAFF_MENU = [
  { key: "home", label: "Home", hint: "แจ้งเตือน", icon: "home", screen: "staff-home", screens: ["staff-home"], perm: "view" },
  { key: "coach-data", label: "Coach Data", hint: "ข้อมูลโค้ช", icon: "users", screen: "staff-coaches", screens: ["staff-coaches"], perm: "view" },
  { key: "player-data", label: "Player Data", hint: "ข้อมูลนักกีฬา", icon: "users", screen: "players", screens: ["players", "player-detail"], perm: "view" },
  { key: "attendance", label: "Attendance", hint: "สรุปการเข้าซ้อม", icon: "calendar", screen: "attendance-grid", screens: ["attendance-grid"], perm: "view" },
  {
    key: "training",
    label: "Training",
    hint: "แผน / รายงานการฝึกซ้อม",
    icon: "clipboard-list",
    screen: "training-plan",
    screens: ["training-plan", "plan-data", "report-data"],
    perm: "view",
    children: [
      { label: "Training Data", screen: "plan-data" },
      { label: "Training Report Data", screen: "report-data" }
    ]
  },
  { key: "match-data", label: "Match Data", hint: "ประวัติการแข่งขัน", icon: "football", screen: "match-history", screens: ["match-history", "match-sheet"], perm: "view" },
  // Evaluation ของทีมหลังบ้านมีแค่ Athlete Results (สมุดพกนักกีฬา) — เปิดดูได้ทุกช่วงเวลาโดยไม่ติดช่วงเปิดของโค้ช (physical-ui.js canBypass)
  // Footelligence Test / Physical Test (หน้ากรอกและแบบฟอร์มของโค้ช) ไม่อยู่ในเมนูนี้ ผลทดสอบดูได้ในสมุดพกและหน้านักกีฬารายบุคคล
  { key: "evaluation", label: "Evaluation", hint: "สมุดพกนักกีฬา", icon: "target", screen: "athlete-results", screens: ["athlete-results", "evaluation"], perm: "view" },  { key: "injury-sick", label: "Injury/Sick", hint: "ประวัติบาดเจ็บ / เจ็บป่วย", icon: "heart-pulse", screen: "injury-results", screens: ["injury-results"], perm: "view" },
  { key: "meeting", label: "Meeting", hint: "นัดประชุมและคำตอบจากโค้ช", icon: "book", screen: "staff-meeting", screens: ["staff-meeting"], perm: "meetings" }
];

// เมนูที่บัญชีนี้เห็น (perms = รายการสิทธิ์ของบัญชี ยังไม่ normalize ก็ได้)
export function staffMenuFor(perms) {
  return STAFF_MENU.filter((m) => staffCan(perms, m.perm));
}

// หน้าจอที่ไม่นับว่าเป็น "ข้อมูลรายรุ่น" — ไม่แสดงตัวกรองรุ่นอายุ
export const STAFF_UNFILTERED_SCREENS = ["staff-home"];
