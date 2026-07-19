import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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

// ---------- ตำแหน่งโค้ช ----------
// Head Coach / Assistant Coach ดูแลได้รุ่นอายุเดียว (ทำงานคู่กันในรุ่นเดียวกัน) — Assistant Coach จึงใช้
// เงื่อนไขเดียวกับ Head Coach ทุกประการ ส่วน GK Coach / Fitness Coach ดูแลได้หลายรุ่นพร้อมกัน เพราะเป็น
// ตำแหน่งเฉพาะทางที่มักดูแลนักกีฬา/ฟิตเนสของหลายรุ่นอายุในทีมเดียวกัน — ใช้ร่วมกันทั้งหน้าโค้ช (attendance.js)
// และ Dashboard (app.js) เพื่อไม่ให้รายชื่อ/เงื่อนไขตำแหน่งโค้ชเพี้ยนไปคนละทางระหว่างสองหน้า
export const COACH_POSITIONS = {
  head_coach: { label: "Head Coach", multiAgeGroup: false },
  assistant_coach: { label: "Assistant Coach", multiAgeGroup: false },
  gk_coach: { label: "GK Coach", multiAgeGroup: true },
  fitness_coach: { label: "Fitness Coach", multiAgeGroup: true }
};

export function coachPositionLabel(coachPosition) {
  return COACH_POSITIONS[coachPosition]?.label || "-";
}

export function coachPositionAllowsMultipleAgeGroups(coachPosition) {
  return COACH_POSITIONS[coachPosition]?.multiAgeGroup ?? true;
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

// ---------- ความเป็นเจ้าของนักกีฬาของโค้ชแต่ละคน (ใช้ร่วมกันทุกจุดที่ต้องแยกสถิติรายบุคคลของโค้ช) ----------
// เฉพาะรุ่นอายุที่ตัวเองดูแล และถ้าเป็น GK Coach นับเฉพาะตำแหน่ง GK ส่วน Head/Assistant Coach ไม่นับตำแหน่ง
// GK เลย (กันซ้ำซ้อนกับ GK Coach) — Fitness Coach นับทุกตำแหน่งเพราะฝึกฟิตเนสไม่ได้แยกเฉพาะตำแหน่งใดตำแหน่งหนึ่ง
// ใช้ร่วมกันในทุกจุดที่ต้องรู้ "นักกีฬาของโค้ชคนนี้": รายชื่อผู้เล่นในหน้าโค้ชเอง (attendance.js loadPlayers),
// ความคืบหน้าการประเมินรายวัน, % ตรงเวลาในรายชื่อโค้ช, และตารางภาพรวมทุกทีมใน Dashboard (app.js) เพื่อไม่ให้
// แต่ละหน้าคำนวณเพี้ยนไปคนละทาง (เช่น เอาผู้เล่น GK ไปนับซ้ำเป็นของ Head Coach)
export function isPlayerOwnedByCoach(coach, player) {
  const ageGroups = coach.ageGroups || [];
  if (!ageGroups.includes(player.ageGroup)) return false;
  if (coach.coachPosition === "gk_coach") return player.position === "GK";
  if (coach.coachPosition === "head_coach" || coach.coachPosition === "assistant_coach") return player.position !== "GK";
  return true;
}

export function getCoachPlayerIds(coach, players) {
  return new Set(players.filter((p) => isPlayerOwnedByCoach(coach, p)).map((p) => p.id));
}

// ดึงตัวเลขจากชื่อรุ่นอายุเดี่ยว (เช่น "U9" -> 9) ใช้เรียงรุ่นอายุจากน้อยไปมากแทนการเรียงตามตัวอักษร (ซึ่งจะเอา
// "U10" ไว้ก่อน "U9" ผิดลำดับ) ไม่มีตัวเลขเลย (เช่น "ไม่ระบุรุ่นอายุ") ถือว่าอยู่ท้ายสุด
export function ageGroupNumber(ageGroup) {
  const n = parseInt(String(ageGroup).replace(/\D/g, ""), 10);
  return isNaN(n) ? Infinity : n;
}

// เหมือน ageGroupNumber แต่รับ array ของรุ่นอายุ (โค้ช GK/Fitness ดูแลได้หลายรุ่นพร้อมกัน) ใช้รุ่นที่น้อยที่สุด
// เป็นตัวจัดลำดับ ไม่มีรุ่นอายุเลย (เช่น ผู้บริหารทีม) ถือว่าอยู่ท้ายสุด — ใช้ร่วมกันทุกจุดที่ต้องเรียงลำดับโค้ช
// ตามรุ่นอายุ กันแต่ละหน้าเรียงไม่ตรงกัน (เช่น ใช้แค่ ageGroups[0] แทนที่จะหาค่าน้อยที่สุดจริง)
export function ageGroupSortKey(ageGroups) {
  if (!ageGroups || ageGroups.length === 0) return Infinity;
  const nums = ageGroups.map(ageGroupNumber).filter((n) => n !== Infinity);
  return nums.length > 0 ? Math.min(...nums) : Infinity;
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

// ---------- การแจ้งเตือนสำหรับผู้ดูแลระบบ ----------
// คำนวณสดทุกครั้งที่กดกระดิ่งจากสถานะปัจจุบันของข้อมูล (อนุมัติบัญชีแล้ว, อาการบาดเจ็บหายแล้ว, ส่งแผน/ประเมิน
// ครบแล้ว ฯลฯ ก็หายไปจากรายการเอง) — "อ่านแล้ว" ถูกบันทึกแยกต่างหากใน adminNotificationReads/{key} เทียบกับ
// เนื้อหาปัจจุบันของหมวดนั้น (ดู markNotificationRead) ถ้าเนื้อหาเปลี่ยน (เช่น มีรายการใหม่เพิ่มเข้ามา) จะกลับมา
// เป็น "ยังไม่อ่าน" ให้เองอัตโนมัติ ไม่ต้องกลัวพลาดเรื่องใหม่เพราะไปกดอ่านของเก่าทิ้งไว้ก่อนหน้า
// ครอบคลุม 6 เรื่องที่ผู้ดูแลระบบต้องรู้ (เรียงความสำคัญ): บัญชีรออนุมัติ, อาการบาดเจ็บที่ยังไม่หาย (แยกรุนแรง),
// แผนการฝึกซ้อมวันนี้ที่ยังไม่ส่งหลังเลยเวลา, โค้ชที่ส่งแผนสายเกินเกณฑ์เดือนนี้, การประเมินนักกีฬาวันนี้ที่ยังไม่ครบ
export async function loadAdminNotifications() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonth = todayStr.slice(0, 7);
  const teams = Object.keys(TEAM_LOGOS);
  const notifications = [];

  const [coachSnap, injurySnap, planSnap, sessionSnap] = await Promise.all([
    getDocs(collection(db, "coaches")),
    getDocs(collection(db, "injuryReports")),
    getDocs(collection(db, "trainingPlans")),
    getDocs(query(collection(db, "sessions"), where("date", "==", todayStr)))
  ]);

  // 1) บัญชีรออนุมัติ
  const pendingNames = [];
  coachSnap.forEach((d) => {
    const c = d.data();
    if (c.status === "pending") pendingNames.push(c.name || c.email || "ไม่ระบุชื่อ");
  });
  if (pendingNames.length > 0) {
    notifications.push({
      key: "pending_accounts",
      icon: "🆕",
      level: "urgent",
      title: `คำขอลงทะเบียนรออนุมัติ ${pendingNames.length} รายการ`,
      detail: pendingNames.slice(0, 5).join(", ") + (pendingNames.length > 5 ? " และอื่นๆ" : ""),
      link: "attendance.html#admin=approvals"
    });
  }

  // 2) อาการบาดเจ็บที่ยังไม่หาย (แยกระดับรุนแรงเป็นรายการเร่งด่วน)
  const activeInjuries = [];
  injurySnap.forEach((d) => {
    const inj = d.data();
    if (inj.status !== "หายแล้ว") activeInjuries.push(inj);
  });
  const severeInjuries = activeInjuries.filter((inj) => inj.severity === "รุนแรง");
  if (severeInjuries.length > 0) {
    notifications.push({
      key: "severe_injuries",
      icon: "🚑",
      level: "urgent",
      title: `นักกีฬาบาดเจ็บระดับรุนแรงที่ยังไม่หาย ${severeInjuries.length} คน`,
      detail: severeInjuries.map((inj) => `${inj.playerName ?? "-"} (${inj.team ?? "-"})`).join(", "),
      link: "attendance.html#admin=injuries"
    });
  }
  const otherActiveCount = activeInjuries.length - severeInjuries.length;
  if (otherActiveCount > 0) {
    notifications.push({
      key: "other_injuries",
      icon: "🩹",
      level: "info",
      title: `นักกีฬาบาดเจ็บที่ยังไม่หาย ${otherActiveCount} คน`,
      detail: "ระดับปานกลาง/กำลังพักฟื้น — ไม่เร่งด่วนเท่าระดับรุนแรง",
      link: "attendance.html#admin=injuries"
    });
  }

  // 3) แผนการฝึกซ้อมวันนี้ที่ยังไม่ส่ง (เตือนเฉพาะหลังเลยเวลาเส้นตายของวันนั้นแล้ว)
  const plans = [];
  planSnap.forEach((d) => plans.push(d.data()));
  if (new Date().getHours() >= TRAINING_PLAN_DEADLINE_HOUR) {
    const teamsWithPlanToday = new Set(plans.filter((p) => p.date === todayStr).map((p) => p.team));
    const missingTeams = teams.filter((t) => !teamsWithPlanToday.has(t));
    if (missingTeams.length > 0) {
      notifications.push({
        key: "missing_plans_today",
        icon: "⏰",
        level: "action",
        title: `ทีมที่ยังไม่ส่งแผนการฝึกซ้อมวันนี้ ${missingTeams.length} ทีม`,
        detail: `เลยเวลา ${TRAINING_PLAN_DEADLINE_HOUR}:00 น. แล้ว — ${missingTeams.join(", ")}`,
        // ?team=__ALL__ เพื่อให้ผู้ดูแลระบบเห็นข้อมูลทันที (ไม่งั้น Dashboard จะโชว์หน้าเลือกทีมแทน) และ
        // #training-plan-summary-section ให้เลื่อนไปที่ตารางสรุปแผนการฝึกซ้อมโดยตรง
        link: "index.html?team=__ALL__#training-plan-summary-section"
      });
    }
  }

  // 4) โค้ชที่ส่งแผนการฝึกซ้อมสายเกินเกณฑ์ในเดือนนี้ (ใช้เกณฑ์เดียวกับหน้าสรุปแผนการฝึกซ้อมใน Dashboard)
  const monthPlans = plans.filter((p) => (p.date || "").startsWith(thisMonth));
  const coachGroups = new Map();
  for (const p of monthPlans) {
    const key = `${p.coachName ?? "-"}__${p.team ?? "-"}`;
    if (!coachGroups.has(key)) {
      coachGroups.set(key, { coachName: p.coachName ?? "-", team: p.team ?? "-", total: 0, late: 0 });
    }
    const g = coachGroups.get(key);
    g.total += 1;
    if (isTrainingPlanLate(p)) g.late += 1;
  }
  const lateCoaches = Array.from(coachGroups.values()).filter((g) => g.late > TRAINING_PLAN_LATE_WARNING_THRESHOLD);
  if (lateCoaches.length > 0) {
    notifications.push({
      key: "late_coaches_month",
      icon: "📉",
      level: "action",
      title: `โค้ชที่ส่งแผนการฝึกซ้อมสายเกินเกณฑ์เดือนนี้ ${lateCoaches.length} คน`,
      detail: lateCoaches.map((g) => `${g.coachName} (สาย ${g.late}/${g.total} ครั้ง)`).join(", "),
      link: "index.html?team=__ALL__#training-plan-summary-section"
    });
  }

  // 5) การประเมินนักกีฬาวันนี้ที่ยังไม่ครบ (ตรวจเฉพาะทีมที่มีการฝึกซ้อมวันนี้แล้วเท่านั้น)
  const incompleteTeams = [];
  for (const sessionDoc of sessionSnap.docs) {
    const session = sessionDoc.data();
    if (session.noTraining) continue;
    const [playersSnap, attendanceSnap] = await Promise.all([
      getDocs(query(collection(db, "players"), where("team", "==", session.team))),
      getDocs(query(collection(db, "attendance"), where("sessionId", "==", sessionDoc.id)))
    ]);
    const totalPlayers = playersSnap.size;
    if (totalPlayers === 0) continue;
    const evaluatedCount = attendanceSnap.docs.map((d) => d.data()).filter((a) => isPlayerFullyEvaluated(a)).length;
    if (evaluatedCount < totalPlayers) {
      incompleteTeams.push({ team: session.team, evaluated: evaluatedCount, total: totalPlayers });
    }
  }
  if (incompleteTeams.length > 0) {
    // แนบชื่อทีมแรกที่ยังไม่ครบไปกับลิงก์ ให้หน้าความคืบหน้าเปิดทีมนั้นให้ทันที (ไม่ต้องไล่หาเอง) — ถ้ามีหลาย
    // ทีมค้างอยู่ ทีมอื่นๆ ยังเลือกดูต่อได้จากปุ่มเลือกทีมในหน้านั้นตามปกติ
    notifications.push({
      key: "incomplete_evaluations_today",
      icon: "📋",
      level: "info",
      title: `การประเมินนักกีฬาวันนี้ยังไม่ครบ ${incompleteTeams.length} ทีม`,
      detail: incompleteTeams.map((t) => `${t.team} (${t.evaluated}/${t.total} คน)`).join(", "),
      link: `attendance.html#admin=progress&team=${encodeURIComponent(incompleteTeams[0].team)}`
    });
  }

  // อ่านสถานะ "อ่านแล้ว" ต่อรายการ — เทียบ contentHash (ใช้ detail ตรงๆ) กับครั้งล่าสุดที่กดอ่าน ถ้าเนื้อหา
  // เปลี่ยนไป (เช่น มีคนเพิ่มเข้ามาอีก) ถือว่า "ยังไม่อ่าน" ใหม่โดยอัตโนมัติ ไม่ต้องรอผู้ดูแลระบบมากดอ่านซ้ำเอง
  const readSnap = await getDocs(collection(db, "adminNotificationReads"));
  const readMap = new Map();
  readSnap.forEach((d) => readMap.set(d.id, d.data().contentHash));
  for (const n of notifications) {
    n.read = readMap.get(n.key) === n.detail;
  }

  const levelOrder = { urgent: 0, action: 1, info: 2 };
  notifications.sort((a, b) => {
    const levelDiff = levelOrder[a.level] - levelOrder[b.level];
    if (levelDiff !== 0) return levelDiff;
    return Number(a.read) - Number(b.read); // ยังไม่อ่านขึ้นก่อนภายในระดับความสำคัญเดียวกัน
  });
  return notifications;
}

// บันทึกว่า "อ่านแล้ว" สำหรับรายการแจ้งเตือนหมวดนี้ (เทียบเนื้อหาปัจจุบัน ถ้าเนื้อหาเปลี่ยนภายหลังจะกลับมา
// เป็น "ยังไม่อ่าน" เองอัตโนมัติ) ผู้ดูแลระบบทุกคนเห็นสถานะอ่านร่วมกัน ไม่แยกเป็นรายบุคคล
export async function markNotificationRead(key, contentHash) {
  await setDoc(doc(db, "adminNotificationReads", key), { contentHash, readAt: serverTimestamp() });
}

const NOTIFICATION_LEVEL_CLASS = {
  urgent: "border-l-4 border-red-500",
  action: "border-l-4 border-amber-500",
  info: "border-l-4 border-slate-300"
};

// วาดรายการแจ้งเตือนลงในกล่อง dropdown ที่ระบุ — ใช้ร่วมกันทั้งหน้า Dashboard (index.html) และ attendance.html
// รายการยังไม่อ่านจะเน้นด้วยพื้นหลังฟ้าอ่อน + จุดฟ้า และมีปุ่ม "✓" ให้ทำเครื่องหมายว่าอ่านแล้วทีละรายการ ผู้เรียก
// ต้องผูก event listener แบบ delegation บน listEl เองสำหรับ [data-mark-read-index] (ดูตัวอย่างใน attendance.js/app.js)
// เพราะการเขียนลง Firestore (markNotificationRead) ต้องทำที่หน้าเพจแล้วเรียก refresh ใหม่ ไม่ใช่หน้าที่ของ
// ฟังก์ชันวาดผลอย่างเดียวนี้
export function renderAdminNotifications(listEl, notifications) {
  if (!listEl) return;
  if (notifications.length === 0) {
    listEl.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">ไม่มีรายการที่ต้องแจ้งเตือนตอนนี้ ✓</p>';
    return;
  }
  listEl.innerHTML = notifications
    .map((n, i) => {
      const unreadClass = n.read ? "" : "bg-blue-50/60";
      const markReadBtn = n.read
        ? ""
        : `<button type="button" class="btn-icon flex-shrink-0" data-mark-read-index="${i}" title="ทำเครื่องหมายว่าอ่านแล้ว" aria-label="ทำเครื่องหมายว่าอ่านแล้ว">✓</button>`;
      return `
    <div class="flex items-start gap-1 rounded-lg hover:bg-slate-50 ${NOTIFICATION_LEVEL_CLASS[n.level] || ""} ${unreadClass}">
      <a href="${n.link}" class="flex-1 min-w-0 p-3">
        <p class="text-sm font-medium text-slate-900">${n.read ? "" : '<span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 align-middle"></span>'}${n.icon} ${n.title}</p>
        <p class="text-xs text-slate-500 mt-0.5">${n.detail}</p>
      </a>
      ${markReadBtn}
    </div>`;
    })
    .join("");
}
