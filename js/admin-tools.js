// เมนู Admin/Tools ของหน้าทีม: เครื่องมือผู้ดูแลระบบทั้งหมดรวมที่เดียว (ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// แอดมินหลัก (perms = null) เห็นครบ — ทีมหลังบ้านเห็นเฉพาะที่ได้รับสิทธิ์ (ตารางสิทธิ์อยู่ที่ ADMIN_FEATURE_REQUIREMENTS ใน staff-perms.js)
// ผลแข่งขัน/อาการบาดเจ็บ/สมุดพกของทีมอยู่ในเมนู Match Data, Injury/Sick และ Evaluation (Athlete Results) ตามรุ่นอายุที่กรองแล้ว จึงไม่ซ้ำเป็นเครื่องมือที่นี่
// feature = รหัสหน้าในแผงผู้ดูแล (ตรงกับ key ใน ROUTE_SCREENS) ยกเว้น 2 รายการที่ไม่ใช่หน้าในแผง: team-dashboard (ลิงก์ออก) และ manage-team (เข้าโหมดจัดการทีมแทนโค้ช)
// development (พัฒนาการนักกีฬา) เป็นหน้าฝัง development.html ในหน้าทีม จึงนับเป็นหน้าในเมนูนี้
import { canAccessAdminFeature } from "./staff-perms.js";

export const ADMIN_TOOL_GROUPS = [
  {
    key: "accounts",
    label: "บัญชีและสิทธิ์",
    tools: [
      { feature: "approvals", label: "คำขอลงทะเบียนรออนุมัติ", hint: "อนุมัติโค้ช ผู้บริหารทีม ทีมหลังบ้าน", icon: "file-text" },
      { feature: "coaches", label: "รายชื่อโค้ชในระบบ", hint: "แก้ไขบัญชีและสิทธิ์ทุกทีม", icon: "users" },
      { feature: "staff-announcements", label: "ประกาศถึงทีมหลังบ้าน", hint: "เขียนประกาศที่ Home", icon: "bell" }
    ]
  },
  {
    key: "monitoring",
    label: "ติดตามงาน",
    tools: [
      { feature: "progress", label: "ความคืบหน้าเช็คชื่อรายวัน", hint: "ดูทุกทีมพร้อมกัน", icon: "trending-up" },
      { feature: "print", label: "พิมพ์สรุปผลงานโค้ช", hint: "รายเดือน", icon: "printer" },
      { feature: "player-audit", label: "ตรวจสอบข้อมูลนักกีฬาที่ผิดปกติ", hint: "รุ่นอายุ วันเกิด", icon: "search" }
    ]
  },
  {
    key: "evaluation",
    label: "รอบการประเมิน",
    tools: [
      { feature: "masc-rounds", label: "รอบการประเมิน MASC", hint: "กำหนดรอบ แก้รอบเดิม", icon: "dna" },
      { feature: "fitness-rounds", label: "รอบทดสอบสมรรถภาพ", hint: "เปิด/ปิดรอบ", icon: "trending-up" },
      { feature: "athlete-windows", label: "เปิดสมุดพกให้โค้ช", hint: "ช่วงที่โค้ชเปิดดูได้", icon: "book" }
    ]
  },
  {
    key: "other",
    label: "อื่น ๆ",
    tools: [
      { feature: "team-dashboard", label: "Dashboard ของทีม", hint: "กราฟภาพรวมของทีมนี้", icon: "bar-chart" },
      { feature: "development", label: "พัฒนาการนักกีฬา", hint: "หน้าพัฒนาการ", icon: "trending-up" },
      { feature: "manage-team", label: "จัดการทีมแทนโค้ช", hint: "โหมดแก้ข้อมูลของทีมนี้เหมือนโค้ช", icon: "refresh" }
    ]
  }
];

// หน้าในแผงผู้ดูแลที่เปิดจากเมนูนี้ (ใช้ไฮไลต์เมนู + จำหน้าตอนรีเฟรช) — ไม่รวมรายการที่เป็นลิงก์/โหมดอื่น
export const ADMIN_TOOL_SCREENS = ADMIN_TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.feature)).filter((f) => !["team-dashboard", "manage-team"].includes(f));

// เครื่องมือที่บัญชีนี้ใช้ได้ แยกตามกลุ่ม (ตัดกลุ่มที่ว่าง) — perms = null คือแอดมินหลัก
export function toolGroupsFor(perms) {
  return ADMIN_TOOL_GROUPS.map((g) => ({ ...g, tools: g.tools.filter((t) => canAccessAdminFeature(t.feature, perms)) })).filter((g) => g.tools.length > 0);
}

export const hasAdminTools = (perms) => toolGroupsFor(perms).length > 0;

// ข้อมูลเมนู "Admin" (แอดมิน) / "Tools" (ทีมหลังบ้าน) ใน STAFF_MENU/ADMIN_TEAM_MENU — รูปแบบเดียวกับรายการเมนูอื่น
export function toolsMenuItem(isAdmin) {
  return {
    key: "admin-tools",
    label: isAdmin ? "Admin" : "Tools",
    hint: isAdmin ? "เครื่องมือผู้ดูแลระบบ" : "เครื่องมือตามสิทธิ์",
    icon: "shield",
    screen: "staff-tools",
    screens: ["staff-tools", ...ADMIN_TOOL_SCREENS]
  };
}
