// เมนูหลัก 11 รายการของโค้ช (ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) — ใช้ทั้งเมนู ☰ ด้านข้าง (มือถือ) และแถบเมนูแนวนอน (คอมพิวเตอร์)
// screen = รหัสหน้าจอตาม COACH_SCREEN_KEYS ใน screen-route.js; screens = ทุกหน้าที่นับว่าอยู่ภายใต้เมนูนี้ (ใช้ไฮไลต์เมนูที่เปิดอยู่)
// disabled (ในเมนูย่อย) = ยังไม่เปิดใช้งาน แสดงจางๆ กดไม่ได้
// children = เมนูย่อย (แสดงเป็นแถบเล็กใต้แถบเมนูหลักเมื่ออยู่ในเมนูนั้น) — external = หน้าอื่นนอก attendance.html (ตอนนี้ไม่มีเมนูใดใช้: Footelligence Test และสมุดพกฝังอยู่ในกรอบเมนูแล้ว)
// Home = หน้าแรกหลังล็อกอิน (screen "daily" คงรหัสเดิมไว้ให้ลิงก์เก่า/กระดิ่งใช้ต่อได้)

export const COACH_MENU = [
  { key: "home", label: "Home", hint: "วันนี้", icon: "home", screen: "daily", screens: ["daily"] },
  { key: "instruction", label: "Instruction", hint: "คำชี้แจง", icon: "file-text", screen: "instruction", screens: ["instruction"] },
  { key: "player-data", label: "Player Data", hint: "ข้อมูลนักกีฬา", icon: "users", screen: "players", screens: ["players", "player-detail", "player-form"] },
  { key: "attendance-check", label: "Attendance Check", hint: "เช็คชื่อ", icon: "check-circle", screen: "checkin", screens: ["checkin"] },
  { key: "attendance", label: "Attendance", hint: "สรุปการเข้าซ้อม", icon: "calendar", screen: "attendance-grid", screens: ["attendance-grid"] },
  {
    key: "training-plan",
    label: "Training Plan",
    hint: "แผนการฝึกซ้อม",
    icon: "clipboard-list",
    screen: "training-plan",
    screens: ["training-plan", "plan", "plan-data", "report", "report-data"],
    // disabled = ยังไม่เปิดใช้งาน (แสดงจาง กดไม่ได้ รออัปเดต)
    children: [
      { label: "Upload Training Plan", screen: "plan" },
      { label: "Training Plan Data", screen: "plan-data" },
      { label: "Training Report", screen: "report" },
      { label: "Training Report Data", screen: "report-data" },
      { label: "FootelligencePad", disabled: true },
      { label: "Footelligence Logbook", disabled: true },
      { label: "Export", disabled: true }
    ]
  },
  {
    key: "match-data",
    label: "Match Data",
    hint: "ข้อมูลการแข่งขัน",
    icon: "football",
    screen: "match-data",
    // "match" = หน้ารายงานผลการแข่งขันเดิม (ถูกแทนที่แล้ว ลิงก์เก่าพามาหน้า Match Data)
    screens: ["match-data", "match-form", "match-history", "match-sheet", "match"],
    children: [
      { label: "Match Recording Form", screen: "match-form" },
      { label: "ประวัติการแข่งขัน", screen: "match-history", screens: ["match-history", "match-sheet"] }
    ]
  },
  {
    key: "evaluation",
    label: "Evaluation",
    hint: "การประเมิน",
    icon: "target",
    screen: "evaluation",
    screens: ["evaluation", "footelligence-test", "physical-test", "physical-instruction", "physical-form", "fitness", "athlete-results"],
    // children ซ้อนได้ 1 ชั้น: Physical Test มีเมนูย่อยของตัวเอง (แสดงเป็นแถบแถวที่สอง)
    children: [
      { label: "Footelligence Test", screen: "footelligence-test" },
      {
        label: "Physical Test",
        screen: "physical-test",
        screens: ["physical-test", "physical-instruction", "physical-form", "fitness"],
        children: [
          { label: "Instruction", screen: "physical-instruction" },
          { label: "Testing Form", screen: "physical-form" },
          { label: "Data Entry", screen: "fitness" }
        ]
      },
      { label: "Athlete Results", screen: "athlete-results" }
    ]
  },
  {
    key: "injury-sick",
    label: "Injury/Sick",
    hint: "บาดเจ็บ / เจ็บป่วย",
    icon: "heart-pulse",
    screen: "injury-menu",
    screens: ["injury-menu", "injury", "injury-results"],
    children: [
      { label: "Recording", screen: "injury" },
      { label: "Results", screen: "injury-results" }
    ]
  },
  {
    key: "meeting",
    label: "Meeting",
    hint: "นัดประชุม + งานหลังประชุม",
    icon: "book",
    screen: "meeting-menu",
    screens: ["meeting-menu", "meeting-next", "meeting-tasks", "meeting-history"],
    children: [
      { label: "Next Meeting", screen: "meeting-next" },
      { label: "Post-Meeting Tasks", screen: "meeting-tasks" },
      { label: "History", screen: "meeting-history" }
    ]
  },
  { key: "profile", label: "Profile", hint: "โปรไฟล์ของฉัน", icon: "user", screen: "profile", screens: ["profile"] }
];

// เมนูย่อยนี้เปิดอยู่ไหม (เมนูย่อยบางตัวครอบคลุมหลายหน้าจอ เช่น ประวัติการแข่งขัน + รายงานผล)
export function childMatchesScreen(child, screen) {
  return !!screen && (child.screens || [child.screen]).includes(screen);
}

// เมนูย่อยชั้นแรกที่หน้าจอนี้อยู่ภายใต้ (ใช้เลือกแถบเมนูย่อยชั้นที่ 2 ที่จะแสดง) — ไม่มี = null
export function activeChildFor(menu, screen) {
  return (menu?.children || []).find((c) => c.children && childMatchesScreen(c, screen)) ?? null;
}

// เมนูที่หน้าจอนี้อยู่ภายใต้ (ไม่มี = null) — menu ค่าเริ่มต้นคือเมนูโค้ช, ทีมหลังบ้านส่งเมนูของตัวเองมา (staff-menu.js)
export function menuKeyForScreen(screen, menu = COACH_MENU) {
  return menu.find((m) => m.screens.includes(screen))?.key ?? null;
}

export function menuItem(key, menu = COACH_MENU) {
  return menu.find((m) => m.key === key) ?? null;
}
