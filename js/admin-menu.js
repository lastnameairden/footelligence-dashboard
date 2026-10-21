// เมนูหน้าทีมของ "แอดมินหลัก" (ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// รูปแบบเดียวกับเมนูโค้ช/ทีมหลังบ้าน (key/label/hint/icon/screen/screens/children) แต่เมนูย่อยครบเท่าที่โค้ชมี — แอดมินดูและแก้ข้อมูลของทีมได้ในที่เดียว
// (Training มี Upload/Report, Match Data มีฟอร์มบันทึก, Evaluation มี Footelligence Test/Physical Test, Injury มี Recording ฯลฯ)
// หน้าที่ใช้ร่วมกับทีมหลังบ้าน: Home (staff-home), Coach Data (staff-coaches), Meeting (staff-meeting) — หน้าอื่นเป็นหน้าเดียวกับของโค้ช
import { menuItem } from "./coach-menu.js";

const fromCoach = (key, overrides = {}) => ({ ...menuItem(key), ...overrides });

export const ADMIN_TEAM_MENU = [
  { key: "home", label: "Home", hint: "ภาพรวมทีม", icon: "home", screen: "staff-home", screens: ["staff-home"] },
  { key: "coach-data", label: "Coach Data", hint: "ข้อมูลโค้ช", icon: "users", screen: "staff-coaches", screens: ["staff-coaches"] },
  fromCoach("player-data"),
  {
    key: "attendance",
    label: "Attendance",
    hint: "สรุปและเช็คชื่อแทนโค้ช",
    icon: "calendar",
    screen: "staff-attendance-menu",
    screens: ["staff-attendance-menu", "attendance-grid", "checkin"],
    children: [
      { label: "Attendance (สรุปการเข้าซ้อม)", screen: "attendance-grid" },
      { label: "Attendance Check (เช็คชื่อ)", screen: "checkin" }
    ]
  },
  fromCoach("training-plan", { key: "training", label: "Training" }),
  fromCoach("match-data"),
  fromCoach("evaluation"),
  fromCoach("injury-sick"),
  { key: "meeting", label: "Meeting", hint: "นัดประชุมและคำตอบจากโค้ช", icon: "book", screen: "staff-meeting", screens: ["staff-meeting"] }
];
