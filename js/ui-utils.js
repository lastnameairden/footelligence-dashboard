import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";

// ---------- ข้อความจากผู้ดูแลระบบถึงทีม (แจ้งนักกีฬาที่มีพัฒนาการดี หรือแจ้งปัญหาของโค้ช) ----------
// ใช้ร่วมกันทุกจุดที่ผู้ดูแลระบบกดส่งข้อความ (หน้าข้อมูลนักกีฬา, หน้าพัฒนาการนักกีฬา, Dashboard) เพื่อให้
// เขียนลง Firestore ด้วยรูปแบบเดียวกันเสมอ — Firestore rules อนุญาตให้ isAdmin() สร้างเอกสารนี้เท่านั้น
// ส่วนโค้ช/ผู้บริหารทีมของทีมนั้นอ่านได้และแก้ไขได้แค่ทำเครื่องหมายว่าอ่านแล้ว
export async function sendExecutiveNote({ team, type, refId, refLabel, message, createdBy }) {
  await addDoc(collection(db, "executiveNotes"), {
    team,
    type,
    refId: refId || null,
    refLabel: refLabel || null,
    message,
    createdBy: createdBy || null,
    read: false,
    createdAt: serverTimestamp()
  });
}

// ---------- โลโก้ทีม (ใช้แทนอิโมจิ 🛡️ ทุกจุดที่แสดงชื่อ/ไอคอนของแต่ละทีม) ----------
export const TEAM_LOGOS = {
  "KHAMPHEE FOOTBALL": "./assets/logo-khamphee-football.png",
  "THAWEE SC": "./assets/logo-thawee-sc.jpg",
  "THAMMASATHIT": "./assets/logo-thammasathit.jpg"
};

// กล่องไอคอนสี่เหลี่ยมมน (เหมือน .icon-badge/.icon-badge-lg เดิม) แต่ใส่โลโก้ทีมจริงแทนอิโมจิ
// ใช้แทนที่ `<div class="icon-badge icon-badge-lg">🛡️</div>` ได้ทันที — ทีมที่ไม่รู้จัก (เช่นยังไม่ตั้งชื่อ)
// จะ fallback กลับไปใช้อิโมจิ 🛡️ เดิมโดยอัตโนมัติ
// ไฟล์โลโก้ที่ได้มามีพื้นหลังขาว/เทาอ่อนติดมาด้วย (ไม่ใช่พื้นหลังโปร่งใสจริง — โดยเฉพาะไฟล์ .jpg ที่ไม่รองรับ
// ความโปร่งใสอยู่แล้ว) จึงใช้ mix-blend-multiply ผสมกับพื้นหลังสีขาวของกล่องที่ห่อไว้ ทำให้พื้นหลังของโลโก้
// กลืนไปกับพื้นหลังการ์ด/ตารางโดยไม่ต้องแก้ไฟล์รูปเอง (ใช้ได้ผลดีเมื่อพื้นหลังโดยรอบเป็นสีขาว/อ่อนเช่นกัน)
export function teamIconBadge(team, { large = true, extraClass = "" } = {}) {
  const sizeClass = `icon-badge${large ? " icon-badge-lg" : ""}${extraClass ? " " + extraClass : ""}`;
  const src = TEAM_LOGOS[team];
  if (!src) return `<div class="${sizeClass}">🛡️</div>`;
  return `<div class="${sizeClass} overflow-hidden p-0.5 bg-white"><img src="${src}" alt="${team}" class="w-full h-full object-contain rounded mix-blend-multiply" /></div>`;
}

// รูปโลโก้ทีมแบบเปล่าๆ (ไม่มีกล่องล้อม) สำหรับวางแทรกหน้าชื่อทีมในข้อความ/ตาราง — คืนสตริงว่างถ้าไม่รู้จักทีมนี้
// เติม mix-blend-multiply ให้เสมอไม่ว่าจะส่ง className เองหรือไม่ เพื่อกลืนพื้นหลังขาวของไฟล์โลโก้เข้ากับพื้นหลังโดยรอบ
export function teamLogoImg(team, className = "w-6 h-6 object-contain inline-block align-middle rounded mr-1.5") {
  const src = TEAM_LOGOS[team];
  if (!src) return "";
  return `<img src="${src}" alt="${team}" class="${className} mix-blend-multiply" />`;
}

// การ์ดตัวเลขสรุปแบบสั้นๆ (label + value) ใช้ในหน้าสรุปภาพรวมต่างๆ
export function statCard(label, value) {
  return `
    <div class="stat-card">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
    </div>
  `;
}

// ---------- ระบบให้คะแนนรายวัน 4 ด้าน ----------
// ใช้ร่วมกันทั้งหน้าโค้ช (attendance.js) และ Dashboard (app.js) เพื่อให้คำนวณ
// "ประเมินครบหรือยัง" และ "คะแนนเฉลี่ย" ตรงกันทุกจุด
export const SCORE_CATEGORIES = [
  { key: "physical", label: "สมรรถภาพทางกายและการเคลื่อนไหว", short: "1. สมรรถภาพร่างกาย" },
  { key: "ballSkill", label: "ความสัมพันธ์กับลูกฟุตบอล", short: "2. ทักษะบอล" },
  { key: "gameReading", label: "การอ่านเกมและการรับรู้", short: "3. อ่านเกม/การรับรู้" },
  { key: "attitude", label: "ทัศนคติและความทุ่มเท", short: "4. ทัศนคติ/ความทุ่มเท" }
];

// คะแนนเฉลี่ยจากด้านที่กรอกแล้ว (ไม่ต้องครบ 4 ด้านก็คำนวณได้ อัปเดตสดตามที่กรอก)
export function computeAvgScore(scores) {
  if (!scores) return null;
  const values = SCORE_CATEGORIES.map((c) => scores[c.key]).filter((v) => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// นับว่า "ประเมินครบ" เมื่อมีสถานะแล้ว และถ้ามาซ้อมจริง (A) ต้องให้คะแนนครบทั้ง 4 ด้าน
// (I/R/P ไม่ต้องให้คะแนน เพราะไม่ได้ร่วมฝึกซ้อมจริงในวันนั้น)
export function isPlayerFullyEvaluated(record) {
  if (!record || !record.status) return false;
  if (record.status !== "A") return true;
  const scores = record.scores || {};
  return SCORE_CATEGORIES.every((c) => typeof scores[c.key] === "number");
}

// ---------- แผนการฝึกซ้อมรายวัน: กฎ "ส่งสาย" ----------
// ใช้ร่วมกันทั้งหน้าโค้ช (attendance.js — เตือนโค้ชเจ้าของแผนเอง) และ Dashboard (app.js — สรุปให้ผู้ดูแล
// ระบบเห็นภาพรวมทุกโค้ช) เพื่อให้กฎ "สาย" ตรงกันทุกจุด ไม่มีจุดไหนคำนวณเพี้ยนจากอีกจุด
// ต้องส่งแผนภายใน 14:00 น. ของวันที่ระบุในแผนนั้น ถ้าส่ง/แก้ไขหลังจากนี้ (หรือส่งข้ามวันไปแล้ว) ถือว่า "เลท"
export const TRAINING_PLAN_DEADLINE_HOUR = 14;
// สายเกินกี่ครั้งต่อเดือนถึงต้องแจ้งเตือนให้โค้ชปรับปรุงมาตรฐานการส่งแผน
export const TRAINING_PLAN_LATE_WARNING_THRESHOLD = 3;

export function isTrainingPlanLate(plan) {
  const ts = plan.updatedAt && typeof plan.updatedAt.toDate === "function" ? plan.updatedAt.toDate() : null;
  if (!ts || !plan.date) return false;
  const deadline = new Date(`${plan.date}T${String(TRAINING_PLAN_DEADLINE_HOUR).padStart(2, "0")}:00:00`);
  return ts > deadline;
}

// ---------- ป้ายสถานะผลการแข่งขัน/อาการบาดเจ็บ ----------
// ใช้ร่วมกันทั้งหน้าโค้ช (attendance.js), Dashboard (app.js), และหน้าข้อมูลนักกีฬา (player.js)
export function matchResultBadge(result) {
  if (result === "ชนะ") return '<span class="badge badge-success">ชนะ</span>';
  if (result === "แพ้") return '<span class="badge badge-danger">แพ้</span>';
  return '<span class="badge badge-neutral">เสมอ</span>';
}

export function injurySeverityBadge(severity) {
  if (severity === "รุนแรง") return `<span class="badge badge-danger">${severity}</span>`;
  if (severity === "ปานกลาง") return `<span class="badge badge-warning">${severity}</span>`;
  return `<span class="badge badge-neutral">${severity ?? "-"}</span>`;
}

export function injuryStatusBadge(status) {
  if (status === "หายแล้ว") return '<span class="badge badge-success">หายแล้ว</span>';
  if (status === "กำลังพักฟื้น") return '<span class="badge badge-warning">กำลังพักฟื้น</span>';
  if (status === "บาดเจ็บขณะแข่งขัน" || status === "บาดเจ็บขณะฝึกซ้อม") {
    return `<span class="badge badge-danger">${status}</span>`;
  }
  return `<span class="badge badge-neutral">${status ?? "-"}</span>`;
}

// เติม data-label ให้แต่ละ <td> อัตโนมัติจากหัวตาราง (thead th) ของ <table> เดียวกัน
// ใช้คู่กับ CSS ใน styles.css ที่แปลงตารางเป็นรูปแบบการ์ดบนจอมือถือ (iOS/Android)
export function applyDataLabels(tbody) {
  if (!tbody) return;
  const table = tbody.closest("table");
  if (!table) return;
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
  Array.from(tbody.children).forEach((tr) => {
    const cells = Array.from(tr.children);
    if (cells.length === 1 && cells[0].hasAttribute("colspan")) return;
    cells.forEach((td, i) => {
      if (headers[i]) td.setAttribute("data-label", headers[i]);
    });
  });
}
