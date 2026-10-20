// สิทธิ์ของบัญชี "ทีมหลังบ้าน" (coaches/{uid}.role = "staff") — ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// ทีมหลังบ้านสมัครเองด้วยอีเมลของตัวเอง แล้วผู้ดูแลระบบหลักอนุมัติพร้อมติ๊กสิทธิ์รายคน (เก็บเป็น permissions: string[] ในเอกสารเดียวกัน)
//
// สำคัญ: ตารางสิทธิ์ที่นี่ต้องตรงกับ firestore.rules (hasPerm/canViewAll/canManageAll) — ฝั่งหน้าเว็บใช้ซ่อนเมนูเท่านั้น ตัวบังคับจริงคือกฎ Firestore
//   view         → อ่านข้อมูลทุกทีม (Dashboard, พิมพ์สรุปผลงานโค้ช, สมุดพก) — อ่านอย่างเดียว
//   coaches      → อนุมัติคำขอลงทะเบียน/จัดการบัญชีโค้ชและผู้บริหารทีม (ไม่รวมบัญชีแอดมิน/ทีมหลังบ้าน)
//   manageTeams  → แก้ข้อมูลนักกีฬา/เช็คชื่อ/รายงานแทนโค้ช (เข้าโหมดจัดการทีม) — รวมสิทธิ์ view ในตัว
//   meetings     → นัดประชุมโค้ช: กรอกวาระ/แนบไฟล์ก่อนประชุม + ความคิดเห็นหลังประชุม และดูงานที่โค้ชส่ง (ไม่แตะลิงก์ Meet/ผลเข้าประชุม/จัดกลุ่ม)
// ส่วนที่ไม่เปิดให้ทีมหลังบ้านเลย (เฉพาะแอดมินหลัก): บัญชีแอดมิน/ทีมหลังบ้านและสิทธิ์, สร้างตาราง/ลิงก์/ผลเข้าประชุมโค้ช, รอบทดสอบสมรรถภาพ,
// รอบ MASC, การแจ้งเตือนของแอดมิน, พัฒนาการนักกีฬา, ประกาศถึงทีมหลังบ้าน

export const STAFF_PERMISSIONS = [
  {
    key: "view",
    label: "ดู Dashboard ทุกทีม · พิมพ์สรุปผลงานโค้ช · สมุดพกนักกีฬา",
    hint: "อ่านอย่างเดียว",
    short: "ดูและพิมพ์รายงาน"
  },
  {
    key: "coaches",
    label: "อนุมัติคำขอลงทะเบียนโค้ช และจัดการรายชื่อโค้ช",
    hint: "กำหนดทีม/รุ่นอายุ แก้ไข/ลบบัญชีโค้ชและผู้บริหารทีม — อนุมัติบัญชีแอดมินหรือทีมหลังบ้านไม่ได้",
    short: "อนุมัติ/จัดการโค้ช"
  },
  {
    key: "manageTeams",
    label: "แก้ข้อมูลนักกีฬา เช็คชื่อ และรายงานแทนโค้ช",
    hint: "เข้าโหมดจัดการทีมเหมือนแอดมิน (รวมสิทธิ์ดูทุกทีม)",
    short: "แก้ข้อมูลแทนโค้ช"
  },
  {
    key: "meetings",
    label: "นัดประชุมโค้ช: เตรียมวาระ/แนบไฟล์ และกรอกความคิดเห็นหลังประชุม",
    hint: "เห็นงานที่โค้ชส่ง — แก้ลิงก์ Meet ผลเข้าประชุม และการแบ่งกลุ่มไม่ได้",
    short: "วาระ/ความเห็นประชุมโค้ช"
  }
];
export const STAFF_PERMISSION_KEYS = STAFF_PERMISSIONS.map((p) => p.key);

// รายการสิทธิ์ที่เก็บ: เฉพาะรหัสที่รู้จัก ไม่ซ้ำ เรียงตามลำดับมาตรฐาน — manageTeams ให้ view ด้วยเสมอ (กฎ Firestore ถือว่า manageTeams อ่านได้อยู่แล้ว)
export function normalizePermissions(list) {
  const set = new Set((Array.isArray(list) ? list : []).filter((k) => STAFF_PERMISSION_KEYS.includes(k)));
  if (set.has("manageTeams")) set.add("view");
  return STAFF_PERMISSION_KEYS.filter((k) => set.has(k));
}

// มีสิทธิ์นี้ไหม (view รวมกรณีมี manageTeams) — perms = รายการจากบัญชี (ยังไม่ normalize ก็ได้)
export function staffCan(perms, perm) {
  const p = normalizePermissions(perms);
  return p.includes(perm);
}

export function permissionsSummary(perms) {
  const p = normalizePermissions(perms);
  return p.length === 0 ? "ยังไม่ได้รับสิทธิ์" : STAFF_PERMISSIONS.filter((x) => p.includes(x.key)).map((x) => x.short);
}

// หน้า/เครื่องมือในแผงผู้ดูแลระบบ (key เดียวกับ #admin=... ใน screen-route.js) → สิทธิ์ที่ต้องมี หรือ "admin" = แอดมินหลักเท่านั้น
export const ADMIN_FEATURE_REQUIREMENTS = {
  coaches: "coaches",
  approvals: "coaches",
  coach: "manageTeams",
  team: "manageTeams",
  "manage-team": "manageTeams",
  "player-audit": "manageTeams",
  progress: "view",
  matches: "view",
  injuries: "view",
  dashboard: "view",
  print: "view",
  "report-card": "view",
  "masc-rounds": "admin",
  meetings: "meetings",
  "fitness-rounds": "admin",
  "athlete-windows": "admin",
  "staff-announcements": "admin"
};

// แอดมินหลัก (perms = null) เข้าได้ทุกอย่าง / ทีมหลังบ้านเข้าได้เฉพาะที่มีสิทธิ์ครบ / feature ที่ไม่รู้จักถือว่าแอดมินเท่านั้น (ปลอดภัยไว้ก่อน)
export function canAccessAdminFeature(feature, perms) {
  if (perms === null || perms === undefined) return true;
  const need = ADMIN_FEATURE_REQUIREMENTS[feature];
  if (!need || need === "admin") return false;
  return staffCan(perms, need);
}

// หน้าแรกของทีมหลังบ้านหลังเข้าสู่ระบบ: ดูได้ → Dashboard ("dashboard") ไม่งั้นเครื่องมือแรกที่มีสิทธิ์ (ไม่มีเลย = null)
export function staffLandingFeature(perms) {
  if (staffCan(perms, "view")) return "dashboard";
  return ["coaches", "approvals", "meetings"].find((f) => canAccessAdminFeature(f, perms)) || null;
}
