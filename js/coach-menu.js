// เมนูหลัก 9 รายการของโค้ช (ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) — ใช้ทั้งเมนู ☰ ด้านข้าง (มือถือ) และแถบเมนูแนวนอน (คอมพิวเตอร์)
// screen = รหัสหน้าจอตาม COACH_SCREEN_KEYS ใน screen-route.js; screens = ทุกหน้าที่นับว่าอยู่ภายใต้เมนูนี้ (ใช้ไฮไลต์เมนูที่เปิดอยู่)
// children = เมนูย่อย (แสดงเป็นแถบเล็กใต้แถบเมนูหลักเมื่ออยู่ในเมนูนั้น) — external = หน้าอื่นนอก attendance.html
// หน้าเดิมที่ยังไม่ได้กำหนดที่อยู่ถาวร (รอผู้ใช้แจ้ง) ผูกไว้ชั่วคราว: Attendance → Daily, Evaluation → ผลทดสอบสมรรถภาพ + MASC, Training Plan → แผน + รายงานการฝึกซ้อม

export const COACH_MENU = [
  { key: "instruction", label: "Instruction", hint: "คำชี้แจง", icon: "file-text", screen: "instruction", screens: ["instruction"] },
  { key: "player-data", label: "Player Data", hint: "ข้อมูลนักกีฬา", icon: "users", screen: "players", screens: ["players", "player-detail", "player-form"] },
  { key: "attendance-check", label: "Attendance Check", hint: "เช็คชื่อ", icon: "check-circle", screen: "checkin", screens: ["checkin"] },
  { key: "attendance", label: "Attendance", hint: "สรุปการเข้าซ้อม", icon: "calendar", screen: "daily", screens: ["daily"] },
  {
    key: "training-plan",
    label: "Training Plan",
    hint: "แผนการฝึกซ้อม",
    icon: "clipboard-list",
    screen: "plan",
    screens: ["plan", "report"],
    children: [
      { label: "แผนการฝึกซ้อม", screen: "plan" },
      { label: "รายงานการฝึกซ้อม", screen: "report" }
    ]
  },
  { key: "match-data", label: "Match Data", hint: "ข้อมูลการแข่งขัน", icon: "football", screen: "match", screens: ["match"] },
  {
    key: "evaluation",
    label: "Evaluation",
    hint: "การประเมิน",
    icon: "target",
    screen: "fitness",
    screens: ["fitness"],
    children: [
      { label: "ผลทดสอบสมรรถภาพ", screen: "fitness" },
      { label: "การประเมิน MASC", external: "masc" }
    ]
  },
  { key: "injury-sick", label: "Injury/Sick", hint: "บาดเจ็บ / เจ็บป่วย", icon: "heart-pulse", screen: "injury", screens: ["injury"] },
  { key: "meeting", label: "Meeting", hint: "นัดประชุม + งานหลังประชุม", icon: "book", screen: "meeting-tasks", screens: ["meeting-tasks"] }
];

// เมนูที่หน้าจอนี้อยู่ภายใต้ (ไม่มี = null)
export function menuKeyForScreen(screen) {
  return COACH_MENU.find((m) => m.screens.includes(screen))?.key ?? null;
}

export function menuItem(key) {
  return COACH_MENU.find((m) => m.key === key) ?? null;
}
