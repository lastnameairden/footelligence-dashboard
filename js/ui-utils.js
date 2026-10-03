import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { icon } from "./icons.js";

// ---------- วันที่/เวลาตามเขตเวลาไทย (Asia/Bangkok, UTC+7 ไม่มี DST) ----------
// เดิมหลายหน้าหา "วันนี้" ด้วย new Date().toISOString().slice(0, 10) ซึ่งเป็นวันที่ตาม UTC — ช่วง 00:00–07:00 น. เวลาไทย
// จึงได้ "เมื่อวาน" (ค่าเริ่มต้นของวันที่เช็คชื่อ/รายงาน/แผนฝึกเพี้ยน, รอบ MASC เริ่ม-หมดตอน 07:00 น.) และช่วงเที่ยงคืนวันที่ 1
// ของเดือนได้เดือนก่อนหน้า — ทุกที่ที่ต้องการ "วันนี้/เดือนนี้/ชั่วโมงปัจจุบัน" ให้เรียกฟังก์ชันด้านล่างเสมอ ไม่ใช้ค่าจากนาฬิกา
// เครื่อง/เขตเวลาของเครื่อง (มือถือที่ตั้งเขตเวลาผิดก็ยังได้วันที่ไทยถูก) ค่า now ใส่เองได้เพื่อใช้ทดสอบ
// firestore.rules (isActiveMascRound) ใช้เกณฑ์เดียวกัน: request.time + 7 ชั่วโมง
export const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
export function todayBangkok(now = new Date()) {
  return new Date(now.getTime() + BANGKOK_UTC_OFFSET_MS).toISOString().slice(0, 10);
}
export function thisMonthBangkok(now = new Date()) {
  return todayBangkok(now).slice(0, 7);
}
export function bangkokHour(now = new Date()) {
  return new Date(now.getTime() + BANGKOK_UTC_OFFSET_MS).getUTCHours();
}
// เดือน "YYYY-MM" ย้อนหลัง n เดือนจากเดือนนี้ (ตามเวลาไทย)
export function monthsAgoBangkok(n, now = new Date()) {
  const [y, m] = thisMonthBangkok(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - n, 1)).toISOString().slice(0, 7);
}
// วันที่ "YYYY-MM-DD" ย้อนหลัง n วันจากวันนี้ (ตามเวลาไทย) — ใช้ทำ query ช่วงวันที่ย้อนหลังแบบไม่อิงเดือนปฏิทิน
// (ต่างจาก monthsAgoBangkok/monthDateRange ซึ่งตัดตามวันที่ 1 ของเดือน ทำให้ช่วง "ย้อนหลัง N วัน" ที่ตกคาบเกี่ยว
// รอยต่อเดือนได้ช่วงสั้นกว่าที่ตั้งใจ)
export function daysAgoBangkok(n, now = new Date()) {
  return new Date(now.getTime() + BANGKOK_UTC_OFFSET_MS - n * 86400000).toISOString().slice(0, 10);
}

// ---------- query ของทีมหนึ่งในช่วงวันที่ที่ต้องการ (แทนการดึงทั้ง collection มากรองฝั่ง client) ----------
// attendance/sessions/รายงาน/แผนการฝึก โตขึ้นทุกวัน — เดิมหลายหน้าดึงของทั้งทีม "ทุกเดือนตั้งแต่เริ่มใช้" มาก่อนค่อยกรอง
// เดือนที่ต้องการทีหลัง (Firestore คิดเงินตามจำนวนเอกสารที่อ่าน และหน้าจะช้าลงเรื่อยๆ) ที่นี่กรองที่ query เลย
// ต้องมี composite index (team ASC + date ASC) ของ collection นั้นๆ ใน firestore.indexes.json เสมอ เพราะเป็น
// equality บน team ร่วมกับ range บน date ส่วน where("team","==",...) ต้องอยู่ใน query เสมอตามกฎ rules (ownsTeam)
// วันที่เก็บเป็นสตริง "YYYY-MM-DD" จึงเทียบแบบตัวอักษรได้ตรงกับเทียบวันที่
export function monthDateRange(month) {
  return { start: `${month}-01`, end: `${month}-31` };
}
export function teamDateRangeQuery(collectionName, team, startDate, endDate) {
  return query(
    collection(db, collectionName),
    where("team", "==", team),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );
}

// ดึงทั้งเดือนของ "ทีมเดียว" (scopeTeam) หรือ "ทุกทีม" (scopeTeam ว่าง — ใช้ได้เฉพาะผู้ดูแลระบบ ซึ่ง rules ไม่ผูกกับ team)
// กรณีทุกทีมเป็น range บนฟิลด์เดียว (date) ใช้ single-field index อัตโนมัติ ไม่ต้องมี composite index เพิ่ม
export function monthQuery(collectionName, scopeTeam, month) {
  const { start, end } = monthDateRange(month);
  return scopeTeam
    ? teamDateRangeQuery(collectionName, scopeTeam, start, end)
    : query(collection(db, collectionName), where("date", ">=", start), where("date", "<=", end));
}

// URL ที่มาจากข้อมูล (รูปนักกีฬา/รูปแนบรายงาน) ก่อนใส่ใน src/href — รับเฉพาะ https:// แล้ว escape ตัวอักษรพิเศษ ถ้าไม่ใช่
// ให้เป็นสตริงว่าง กัน javascript:/data: หรือการปิดเครื่องหมายคำพูดเพื่อฉีด attribute อื่น (escapeHtml อย่างเดียวกัน scheme ไม่ได้)
export function safeHttpUrl(url) {
  return typeof url === "string" && /^https:\/\//i.test(url) ? escapeHtml(url) : "";
}

// ---------- กัน XSS: escape ข้อความจากผู้ใช้ก่อนใส่ลง innerHTML ----------
// ข้อมูลในแอปนี้ (ชื่อโค้ช ชื่อนักกีฬา คู่แข่ง หมายเหตุ ฯลฯ) มาจากผู้ใช้ที่ล็อกอินแล้วเขียนลง Firestore ได้เอง แล้วผู้ดูแล
// ระบบ/โค้ชคนอื่นเปิดดูผ่าน template string → innerHTML ถ้าไม่ escape ผู้ใช้คนหนึ่งใส่ <img onerror=...> เป็นชื่อได้
// แล้วสคริปต์จะรันในเบราว์เซอร์ของคนที่เปิดดู (รวมถึงแอดมินที่มีสิทธิ์เขียนทุกอย่าง) — ครอบทุกค่าที่มาจากผู้ใช้ด้วยฟังก์ชันนี้
// ค่า null/undefined กลายเป็นสตริงว่าง (ตัวที่ต้องการ "-" ให้ใส่ ?? "-" ข้างในวงเล็บเหมือนเดิม)
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

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

// ---------- สีประจำทีม (ใช้กับกราฟ/แผนภูมิทุกจุดที่ต้องแยกสีตามทีม เพื่อให้สีของแต่ละทีมคงที่เสมอ
// ไม่ว่าจะเรียงลำดับอย่างไรบนหน้าจอ) ----------
export const TEAM_COLORS = {
  "KHAMPHEE FOOTBALL": "#0ea5e9", // ฟ้า/น้ำเงิน
  "THAWEE SC": "#dc2626", // แดง
  "THAMMASATHIT": "#16a34a" // เขียว
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
  if (!src) return `<div class="${sizeClass}">${icon("shield")}</div>`;
  return `<div class="${sizeClass} overflow-hidden p-0.5 bg-white"><img src="${src}" alt="${escapeHtml(team)}" class="w-full h-full object-contain rounded mix-blend-multiply" /></div>`;
}

// รูปโลโก้ทีมแบบเปล่าๆ (ไม่มีกล่องล้อม) สำหรับวางแทรกหน้าชื่อทีมในข้อความ/ตาราง — คืนสตริงว่างถ้าไม่รู้จักทีมนี้
// เติม mix-blend-multiply ให้เสมอไม่ว่าจะส่ง className เองหรือไม่ เพื่อกลืนพื้นหลังขาวของไฟล์โลโก้เข้ากับพื้นหลังโดยรอบ
export function teamLogoImg(team, className = "w-6 h-6 object-contain inline-block align-middle rounded mr-1.5") {
  const src = TEAM_LOGOS[team];
  if (!src) return "";
  return `<img src="${src}" alt="${escapeHtml(team)}" class="${className} mix-blend-multiply" />`;
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

// ใช้ร่วมกันทั้งหน้าข้อมูลนักกีฬา (player.js) และสมุดพกนักกีฬาสำหรับพิมพ์ (report-card.js)
export const STATUS_LABELS = { A: "มา", I: "บาดเจ็บ", R: "พักฟื้น", P: "ลา" };

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

// ---------- กราฟคะแนนของนักกีฬารายคน (ไม่พึ่งไลบรารีภายนอก) ----------
// ใช้ร่วมกันทั้งหน้าข้อมูลนักกีฬา (player.js) และสมุดพกนักกีฬาสำหรับพิมพ์ (report-card.js) — คืนเป็น HTML
// string ล้วน (ไม่แตะ DOM เอง) เพื่อให้ทั้งสองหน้าเรียกใช้กับ records ที่กรองสโคปต่างกันได้ (ทั้งหมด/รายช่วงเวลา)

// กราฟเส้นแบบ SVG แสดงคะแนนเฉลี่ยรายวันเรียงตามเวลา เพื่อดูแนวโน้มพัฒนาการ
export function buildScoreTrendChartSvg(records) {
  const points = records
    .filter((r) => computeAvgScore(r.scores) !== null)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (points.length === 0) {
    return '<p class="text-sm text-slate-400 text-center py-8">ยังไม่มีข้อมูลคะแนนเพียงพอสำหรับแสดงกราฟ</p>';
  }

  const width = Math.max(points.length * 70, 320);
  const height = 220;
  const padTop = 20;
  const padBottom = 36;
  const padLeft = 30;
  const padRight = 20;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxScore = 4;

  const coords = points.map((p, i) => {
    const avg = computeAvgScore(p.scores);
    const x = points.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (points.length - 1)) * chartW;
    const y = padTop + chartH - (avg / maxScore) * chartH;
    return { x, y, avg, date: p.date };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const gridLines = [1, 2, 3, 4]
    .map((v) => {
      const y = padTop + chartH - (v / maxScore) * chartH;
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />
              <text x="${padLeft - 6}" y="${y + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${v}</text>`;
    })
    .join("");

  const dots = coords
    .map(
      (c) => `
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="#0f172a">
        <title>${c.date}: ${c.avg.toFixed(2)}</title>
      </circle>
      <text x="${c.x.toFixed(1)}" y="${height - 12}" font-size="10" fill="#64748b" text-anchor="middle">${c.date ? c.date.slice(5) : ""}</text>`
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="min-width:${width}px">
      ${gridLines}
      <path d="${linePath}" fill="none" stroke="#0f172a" stroke-width="2" />
      ${dots}
    </svg>
  `;
}

// รวมการเช็คชื่อ+ให้คะแนน (attendance) เป็น "คะแนนเฉลี่ยต่อวัน" หนึ่งจุดต่อวัน (ต่างจาก buildScoreTrendChartSvg
// ด้านบนที่เป็นหนึ่งจุดต่อการประเมินหนึ่งครั้งของนักกีฬาคนเดียว) — ใช้กับภาพรวมทั้งหมดของ Dashboard ที่ต้องดู
// แนวโน้มรวมทุกทีม/ทุกนักกีฬาในวันเดียวกัน ไม่ใช่ของนักกีฬาคนเดียว
export function computeDailyAvgScores(records, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const byDate = new Map();
  for (const r of records) {
    if (!r.date || r.date < cutoffStr) continue;
    const avg = computeAvgScore(r.scores);
    if (avg === null) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, { sum: 0, count: 0 });
    const bucket = byDate.get(r.date);
    bucket.sum += avg;
    bucket.count += 1;
  }
  return Array.from(byDate.entries())
    .map(([date, { sum, count }]) => ({ date, avg: sum / count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// เส้นแนวโน้มขนาดเล็ก (sparkline) สำหรับการ์ดสรุป — ไม่มีแกน/ตัวเลขกำกับ (มีตัวเลขสรุปแยกอยู่นอกการ์ดแล้ว)
// สีเส้นรับจาก currentColor ของ element ที่ห่อ (ใส่ class/style กำหนดสีจากภายนอกได้ เหมือน icon())
export function buildAvgScoreSparklineSvg(points, { width = 360, height = 78 } = {}) {
  if (points.length < 2) {
    return '<p class="text-xs text-slate-400 text-center py-4">ยังไม่มีข้อมูลเพียงพอสำหรับแสดงแนวโน้ม</p>';
  }
  const maxScore = 4;
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: height - (Math.max(0, Math.min(p.avg, maxScore)) / maxScore) * height
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" style="color:inherit">
      <path d="${area}" fill="currentColor" opacity="0.12" />
      <path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <title>${escapeHtml(points[0].date)} – ${escapeHtml(points[points.length - 1].date)}</title>
    </svg>
  `;
}

// กราฟใยแมงมุม (radar chart) แบบ SVG แสดงคะแนนเฉลี่ยทั้ง 4 ด้านเทียบกันในรูปเดียว ให้เห็นจุดแข็ง/จุดที่ต้อง
// พัฒนาของนักกีฬาได้เร็วกว่าดูเป็นแท่งเรียงกัน — size ปรับได้ (สมุดพกสำหรับพิมพ์ใช้ขนาดเล็กกว่าค่าเริ่มต้นเพื่อ
// ประหยัดพื้นที่หน้ากระดาษ A4)
export function buildCategoryRadarSvg(records, size = 340) {
  const sums = {};
  const counts = {};
  for (const cat of SCORE_CATEGORIES) {
    sums[cat.key] = 0;
    counts[cat.key] = 0;
  }
  for (const r of records) {
    const scores = r.scores || {};
    for (const cat of SCORE_CATEGORIES) {
      if (typeof scores[cat.key] === "number") {
        sums[cat.key] += scores[cat.key];
        counts[cat.key] += 1;
      }
    }
  }

  const hasAnyData = SCORE_CATEGORIES.some((cat) => counts[cat.key] > 0);
  if (!hasAnyData) {
    return '<p class="text-sm text-slate-400 text-center py-8">ยังไม่มีข้อมูลคะแนนเพียงพอสำหรับแสดงกราฟ</p>';
  }

  const averages = SCORE_CATEGORIES.map((cat) => (counts[cat.key] > 0 ? sums[cat.key] / counts[cat.key] : 0));
  const n = SCORE_CATEGORIES.length;
  const maxScore = 4;
  const cx = size / 2;
  const cy = size / 2 - 6;
  const R = size * 0.29; // สัดส่วนเดิมของ 340: R=100 (~29%) รักษาสัดส่วนเดิมไว้เมื่อ size เปลี่ยน
  // เริ่มแกนแรกที่ด้านบน (12 นาฬิกา) แล้วไล่ตามเข็มนาฬิกาทีละแกน
  const angles = SCORE_CATEGORIES.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);
  const point = (angle, fraction) => ({
    x: cx + R * fraction * Math.cos(angle),
    y: cy + R * fraction * Math.sin(angle)
  });

  const gridRings = [0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const pts = angles
        .map((a) => point(a, fraction))
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="1" />`;
    })
    .join("");

  const spokes = angles
    .map((a) => {
      const p = point(a, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />`;
    })
    .join("");

  const dataPoints = angles.map((a, i) => point(a, averages[i] / maxScore));
  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const dataDots = dataPoints
    .map((p, i) => {
      const cat = SCORE_CATEGORIES[i];
      const valueText = counts[cat.key] > 0 ? averages[i].toFixed(2) : "-";
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#0f172a"><title>${cat.label}: ${valueText}</title></circle>`;
    })
    .join("");

  const labelR = R + 34;
  const labels = angles
    .map((a, i) => {
      const p = point(a, labelR / R);
      const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
      const cat = SCORE_CATEGORIES[i];
      const valueText = counts[cat.key] > 0 ? averages[i].toFixed(2) : "-";
      return `
        <text x="${p.x.toFixed(1)}" y="${(p.y - 4).toFixed(1)}" font-size="11" font-weight="600" fill="#334155" text-anchor="${anchor}">${cat.short}</text>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 11).toFixed(1)}" font-size="11" fill="#94a3b8" text-anchor="${anchor}">${valueText}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="max-width:100%; margin:0 auto; display:block">
      ${gridRings}
      ${spokes}
      <polygon points="${dataPolygon}" fill="#0f172a" fill-opacity="0.12" stroke="#0f172a" stroke-width="2" />
      ${dataDots}
      ${labels}
    </svg>
  `;
}

// ค่าเฉลี่ยแต่ละหมวด (SCORE_CATEGORIES) จาก records ที่ให้มา — ตัวช่วยกลางใช้ในสมุดพกนักกีฬา (report-card.js)
// สำหรับสรุปประเด็นสำคัญ (key takeaways) เพื่อไม่ให้คำนวณค่าเฉลี่ยเพี้ยนกันคนละจุด
function categoryAveragesFromRecords(records) {
  const sums = {};
  const counts = {};
  for (const cat of SCORE_CATEGORIES) {
    sums[cat.key] = 0;
    counts[cat.key] = 0;
  }
  for (const r of records) {
    const scores = r.scores || {};
    for (const cat of SCORE_CATEGORIES) {
      if (typeof scores[cat.key] === "number") {
        sums[cat.key] += scores[cat.key];
        counts[cat.key] += 1;
      }
    }
  }
  return SCORE_CATEGORIES.map((cat) => ({
    key: cat.key,
    label: cat.label,
    short: cat.short,
    avg: counts[cat.key] > 0 ? sums[cat.key] / counts[cat.key] : null
  }));
}
export { categoryAveragesFromRecords };

// สีประจำแต่ละหมวดคะแนน (4 หมวด = 4 สี) ใช้ในกราฟแนวโน้มคะแนนรายวันของสมุดพกนักกีฬา (report-card.js) เพื่อให้
// แยกแต่ละด้านออกจากกันได้ด้วยสีทันทีโดยไม่ต้องอ่าน label — ไม่ผูกกับสีทีม (TEAM_COLORS) เพราะเป็นคนละมิติกัน
// (นี่คือมิติของ "ด้านการประเมิน" ไม่ใช่ทีม)
export const SCORE_CATEGORY_COLORS = {
  physical: "#16a34a",
  ballSkill: "#0ea5e9",
  gameReading: "#f59e0b",
  attitude: "#ec4899"
};

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

// คำนวณอายุปัจจุบันจากวันเกิด (ค.ศ. เสมอ เพราะ input[type=date] ของเบราว์เซอร์เก็บค่าแบบเกรกอเรียนภายในอยู่แล้ว
// ไม่ว่า locale ของเครื่องจะแสดงผลเป็นปฏิทินอะไรก็ตาม) คืนค่า null ถ้าวันเกิดว่างหรือ parse ไม่ได้ — ใช้ร่วมกัน
// ทั้งหน้าข้อมูลนักกีฬารายบุคคลและเครื่องมือตรวจสอบข้อมูลนักกีฬาผิดปกติของผู้ดูแลระบบ
export function calcAge(birthday, now = new Date()) {
  if (!birthday) return null;
  // วันเกิดรูปแบบ "YYYY-MM-DD" อ่านตรงๆ ไม่ผ่าน new Date() (ซึ่งตีความเป็น UTC แล้วเขตเวลาลบทำให้วันเกิดเลื่อนถอยหลังหนึ่งวัน)
  // และเทียบกับ "วันนี้" ตามเวลาไทยเหมือนส่วนอื่นของแอป
  const parts = typeof birthday === "string" ? birthday.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  let by, bm, bd;
  if (parts) {
    [by, bm, bd] = parts.slice(1).map(Number);
  } else {
    const b = new Date(birthday);
    if (isNaN(b.getTime())) return null;
    by = b.getFullYear();
    bm = b.getMonth() + 1;
    bd = b.getDate();
  }
  const [ty, tm, td] = todayBangkok(now).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

// ---------- แผนการฝึกซ้อมรายวัน: กฎ "ส่งสาย" ----------
// ใช้ร่วมกันทั้งหน้าโค้ช (attendance.js — เตือนโค้ชเจ้าของแผนเอง) และ Dashboard (app.js — สรุปให้ผู้ดูแล
// ระบบเห็นภาพรวมทุกโค้ช) เพื่อให้กฎ "สาย" ตรงกันทุกจุด ไม่มีจุดไหนคำนวณเพี้ยนจากอีกจุด
// ต้องส่งแผนภายใน 14:00 น. ของวันที่ระบุในแผนนั้น ถ้าส่ง/แก้ไขหลังจากนี้ (หรือส่งข้ามวันไปแล้ว) ถือว่า "เลท"
export const TRAINING_PLAN_DEADLINE_HOUR = 14;
// สายเกินกี่ครั้งต่อเดือนถึงต้องแจ้งเตือนให้โค้ชปรับปรุงมาตรฐานการส่งแผน
export const TRAINING_PLAN_LATE_WARNING_THRESHOLD = 3;
// วันฝึกซ้อมปกติของแต่ละทีมต่อสัปดาห์ (0=อาทิตย์ ... 6=เสาร์ ตาม Date.getUTCDay()) — ใช้คำนวณ "จำนวนทั้งหมดที่
// ต้องส่ง" ต่อเดือนในสรุปการทำงานของโค้ช (print.js) ให้ตรงกับจำนวนวันฝึกซ้อมจริงของ "ปฏิทิน" เดือนนั้นๆ ของแต่ละทีม
// แทนตัวเลขคงที่แบบเดิม — ใช้แสดงเกณฑ์เฉยๆ ไม่ได้ใช้ล็อกว่าห้ามส่ง/ต้องส่งเฉพาะวันเหล่านี้ (โค้ชยังส่งวันอื่นได้ตามปกติ
// ถ้ามีการฝึกซ้อมจริงนอกตารางปกติ) แก้ตรงนี้ที่เดียวถ้าตารางฝึกซ้อมของทีมใดเปลี่ยน
export const TEAM_TRAINING_WEEKDAYS = {
  "THAWEE SC": [1, 2, 3, 4, 5], // จันทร์-ศุกร์ (5 วัน/สัปดาห์)
  THAMMASATHIT: [1, 2, 3, 4, 5, 6], // จันทร์-เสาร์ (6 วัน/สัปดาห์)
  "KHAMPHEE FOOTBALL": [0, 1, 2, 3, 4] // อาทิตย์-พฤหัสบดี (5 วัน/สัปดาห์)
};
// เกณฑ์จำนวนแผนที่ต้องส่ง/จำนวนวันที่ต้องเช็คชื่อ+ให้คะแนนนักกีฬาต่อเดือน ของทีมนั้นในเดือนนั้น (นับจากปฏิทินตาม
// TEAM_TRAINING_WEEKDAYS ไม่ใช่จำนวน sessions ที่มีคนสร้างจริง เพราะถ้าโค้ชไม่เช็คชื่อเลยจะไม่มี session ให้นับ
// เกณฑ์จะเหลือ 0 กลายเป็น "ทำครบ 100%" ผิดๆ) ใช้ร่วมกันทั้งสรุปแผนการฝึกซ้อมและสรุปการเช็คชื่อ (คนละกิจกรรมกัน
// แต่ทั้งคู่ควรเกิดขึ้นทุกวันฝึกซ้อมจริงเท่ากัน จึงใช้เกณฑ์เดียวกัน) ทีมที่ไม่มีในตาราง fallback เป็น 20 (ค่าคงที่เดิม)
// เทียบชื่อโค้ชแบบทนต่อความต่างเล็กน้อย (ช่องว่างหัว/ท้าย/ซ้ำ, ตัวพิมพ์เล็กใหญ่, คำนำหน้า "โค้ช") — แผน/รายงานเก็บชื่อโค้ช
// ณ ตอนที่ส่ง ส่วนรายชื่อโค้ชแก้ไขได้ทีหลัง จึงเทียบแบบเท่ากันเป๊ะแล้วแผนที่ส่งแล้วหลุดไม่ถูกนับให้โค้ชได้
export function coachNameKey(name) {
  return String(name ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^โค้ช\s*/, "")
    .toLowerCase();
}
export function isSameCoachName(a, b) {
  const ka = coachNameKey(a);
  return ka !== "" && ka === coachNameKey(b);
}

// แผน/รายงานเป็นของโค้ชคนนี้ไหม — ดูจาก coachId (uid ผู้ส่ง = id เอกสารโค้ช ทนต่อการเปลี่ยนชื่อโค้ชภายหลัง) หรือชื่อตรงกัน
// (กรณีผู้ดูแลระบบสวมบทบาทส่งแทน coachId จะเป็น uid ของผู้ดูแลระบบ จึงต้องพึ่งชื่อ)
export function isRecordOfCoach(record, coach) {
  if (record?.coachId && coach?.id && record.coachId === coach.id) return true;
  return isSameCoachName(record?.coachName, coach?.name);
}

export function trainingDaysQuotaForTeamMonth(team, monthStr) {
  const weekdays = TEAM_TRAINING_WEEKDAYS[team];
  if (!weekdays || !monthStr) return 20;
  const [y, m] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (weekdays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())) count++;
  }
  return count;
}

// แผนการฝึกซ้อมต้องมีไฟล์แนบ (รูป/PDF) ทุกครั้งที่ส่ง/บันทึกแก้ไข — นับว่ามีไฟล์เมื่อเลือกไฟล์ใหม่แล้ว หรือมีไฟล์เดิมที่ยังไม่ถูกสั่งลบ
export function trainingPlanHasAttachment({ hasNewFile, existingFileUrl, removeExisting }) {
  return Boolean(hasNewFile || (existingFileUrl && !removeExisting));
}

export function isTrainingPlanLate(plan) {
  const ts = plan.updatedAt && typeof plan.updatedAt.toDate === "function" ? plan.updatedAt.toDate() : null;
  if (!ts || !plan.date) return false;
  const deadline = new Date(`${plan.date}T${String(TRAINING_PLAN_DEADLINE_HOUR).padStart(2, "0")}:00:00+07:00`);
  return ts > deadline;
}

// ---------- เช็คชื่อ+ให้คะแนน / รายงานการฝึกซ้อม: กฎ "ส่งสาย" ----------
// ต้องเช็คชื่อ+ให้คะแนน และส่งรายงานการฝึกซ้อม ภายใน 23:59 น. ของวันนั้น ใช้ deadline เดียวกันทั้งสองอย่าง — ย้าย
// มาไว้ที่นี่ (เดิมอยู่ใน attendance.js เท่านั้น) เพราะสรุปสำหรับพิมพ์ (print.js) ต้องใช้กฎเดียวกันนี้ด้วย
export const SUBMISSION_DEADLINE_HOUR = 23;
export const SUBMISSION_DEADLINE_MINUTE = 59;
export function submissionDeadlineFor(dateStr) {
  return new Date(
    `${dateStr}T${String(SUBMISSION_DEADLINE_HOUR).padStart(2, "0")}:${String(SUBMISSION_DEADLINE_MINUTE).padStart(2, "0")}:59+07:00`
  );
}
// นับว่า "ตรงเวลา" ถ้าเวลาบันทึกล่าสุดของการเช็คชื่อ (จากบันทึกทั้งหมดของโค้ชคนนั้นในวันซ้อมนั้น) อยู่ก่อนเดดไลน์
export function isCoachSubmissionOnTime(session, myAttendanceForSession) {
  if (!session.date) return false;
  let latest = null;
  for (const a of myAttendanceForSession) {
    if (a.updatedAt && typeof a.updatedAt.toDate === "function") {
      const t = a.updatedAt.toDate();
      if (!latest || t > latest) latest = t;
    }
  }
  if (!latest) return false;
  return latest <= submissionDeadlineFor(session.date);
}
// รายงานการฝึกซ้อมต้องส่งภายในเวลาเดียวกับการเช็คชื่อ (23:59 น.) — ย้ายมาไว้ที่นี่ด้วยเหตุผลเดียวกับข้างบน
export function isReportLate(report) {
  const ts = report.updatedAt && typeof report.updatedAt.toDate === "function" ? report.updatedAt.toDate() : null;
  if (!ts || !report.date) return false;
  return ts > submissionDeadlineFor(report.date);
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
// นับจำนวนวันที่แต่ละทีม "มีซ้อมจริงแต่ยังไม่ส่งแผนการฝึกซ้อม" — แยกเป็นฟังก์ชันล้วน (ไม่พึ่ง Firestore/เวลาจริง)
// จาก loadAdminNotifications ด้านล่าง เพื่อเทสต์ตรงๆ ได้ sessions/plans เป็น array เอกสารดิบจาก Firestore
// (ยังไม่กรองอะไร อาจมีมากกว่าช่วง windowStart-todayStr ก็ได้ ฟังก์ชันนี้กรองเองอีกชั้น) ของวันนี้เองยังไม่นับว่า
// ขาดจนกว่า currentHour จะถึง deadlineHour (เผื่อโค้ชยังไม่ถึงเวลาส่งของวันนี้)
export function computeMissingPlanDaysByTeam(sessions, plans, { windowStart, todayStr, deadlineHour, currentHour }) {
  const trainingDaysByTeam = new Map(); // team -> Set(date) เฉพาะวันที่มีซ้อมจริงในช่วงที่สนใจ
  for (const s of sessions) {
    if (s.noTraining || !s.team || !s.date || s.date < windowStart || s.date > todayStr) continue;
    if (!trainingDaysByTeam.has(s.team)) trainingDaysByTeam.set(s.team, new Set());
    trainingDaysByTeam.get(s.team).add(s.date);
  }
  const plannedDatesByTeam = new Map(); // team -> Set(date) ที่ส่งแผนไว้แล้ว
  for (const p of plans) {
    if (!p.team || !p.date) continue;
    if (!plannedDatesByTeam.has(p.team)) plannedDatesByTeam.set(p.team, new Set());
    plannedDatesByTeam.get(p.team).add(p.date);
  }
  const missing = new Map();
  for (const [team, dates] of trainingDaysByTeam) {
    for (const d of dates) {
      if (d === todayStr && currentHour < deadlineHour) continue;
      if (!(plannedDatesByTeam.get(team) || new Set()).has(d)) {
        missing.set(team, (missing.get(team) || 0) + 1);
      }
    }
  }
  return missing;
}

// ครอบคลุม 6 เรื่องที่ผู้ดูแลระบบต้องรู้ (เรียงความสำคัญ): บัญชีรออนุมัติ, อาการบาดเจ็บที่ยังไม่หาย (แยกรุนแรง),
// แผนการฝึกซ้อมที่ยังไม่ส่งย้อนหลัง 14 วัน, โค้ชที่ส่งแผนสายเกินเกณฑ์เดือนนี้, การประเมินนักกีฬาที่ยังไม่ครบย้อนหลัง 14 วัน
//
// ทำไมย้อนหลัง 14 วัน (ไม่ใช่แค่ "วันนี้"): ระบบนี้ไม่มีการเก็บ "ประวัติ" การแจ้งเตือนไว้เลย — คำนวณสดจากสถานะ
// ปัจจุบันทุกครั้งที่เปิดกระดิ่ง ถ้าเช็คแค่วันนี้ ผู้ดูแลระบบที่ไม่ได้เข้ามาดูทุกวันจะพลาดเรื่องที่ค้างของวันก่อนๆ ไปเงียบๆ
// (พอวันเปลี่ยน "วันนี้" ของเมื่อวานก็หายไปจากเงื่อนไขทันที) จึงมองย้อนหลัง 14 วันแทน โดยยังนับเฉพาะวันที่ "มีการ
// ฝึกซ้อมจริง" (มี sessions และไม่ได้ติ๊ก "วันนี้ไม่มีฝึกซ้อม") ไม่ใช่ทุกวันตามปฏิทิน กันเสียงรบกวนจากวันหยุดที่ไม่มี
// ซ้อมอยู่แล้วซึ่งไม่ควรนับว่า "ขาดส่งแผน/ประเมิน"
export async function loadAdminNotifications() {
  const todayStr = todayBangkok();
  const thisMonth = todayStr.slice(0, 7);
  const windowStart = daysAgoBangkok(13); // รวมวันนี้ = ย้อนหลัง 14 วัน
  const notifications = [];

  const [coachSnap, injurySnap, planSnap, sessionSnap] = await Promise.all([
    getDocs(collection(db, "coaches")),
    getDocs(collection(db, "injuryReports")),
    // แผนที่ใช้ตรวจ ต้องครอบทั้งช่วง 14 วันย้อนหลัง (ข้อ 3) และทั้งเดือนปฏิทินนี้ (ข้อ 4) พร้อมกัน — สองช่วงนี้ไม่ทับกัน
    // สนิทเสมอ (เช่น วันที่ 3 ของเดือน ย้อนหลัง 14 วันจะเลยไปเดือนก่อน) จึง query ตั้งแต่จุดที่เก่ากว่าของสองจุดนี้
    // แล้วให้แต่ละข้อกรองช่วงของตัวเองจาก plans อีกที เป็น query ช่วงวันที่ล้วนๆ (ไม่ผูก team) จึงไม่ต้องมี
    // composite index เพิ่ม — injuryReports ยังดึงทั้งหมดเพราะต้องดูอาการที่ "ยังไม่หาย" ซึ่งอาจเกิดขึ้นนานแล้วก็ได้
    getDocs(
      query(
        collection(db, "trainingPlans"),
        where("date", ">=", windowStart < `${thisMonth}-01` ? windowStart : `${thisMonth}-01`),
        where("date", "<=", todayStr)
      )
    ),
    getDocs(query(collection(db, "sessions"), where("date", ">=", windowStart), where("date", "<=", todayStr)))
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
      icon: icon("star"),
      level: "urgent",
      count: pendingNames.length,
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
      icon: icon("heart-pulse"),
      level: "urgent",
      count: severeInjuries.length,
      title: `นักกีฬาบาดเจ็บระดับรุนแรงที่ยังไม่หาย ${severeInjuries.length} คน`,
      detail: severeInjuries.map((inj) => `${inj.playerName ?? "-"} (${inj.team ?? "-"})`).join(", "),
      link: "attendance.html#admin=injuries"
    });
  }
  const otherActiveCount = activeInjuries.length - severeInjuries.length;
  if (otherActiveCount > 0) {
    notifications.push({
      key: "other_injuries",
      icon: icon("heart-pulse"),
      level: "info",
      count: otherActiveCount,
      title: `นักกีฬาบาดเจ็บที่ยังไม่หาย ${otherActiveCount} คน`,
      detail: "ระดับปานกลาง/กำลังพักฟื้น — ไม่เร่งด่วนเท่าระดับรุนแรง",
      link: "attendance.html#admin=injuries"
    });
  }

  // 3) แผนการฝึกซ้อมที่ยังไม่ส่ง ย้อนหลัง 14 วัน — นับเฉพาะวันที่ทีมนั้นมีวันซ้อมจริง (มี sessions และไม่ได้ติ๊ก
  // "วันนี้ไม่มีฝึกซ้อม") ไม่ใช่ทุกวันตามปฏิทิน ของวันนี้เองยังไม่นับว่าขาดจนกว่าจะเลยเวลาเส้นตาย
  const plans = [];
  planSnap.forEach((d) => plans.push(d.data()));
  const sessionsInWindow = sessionSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const missingPlanDaysByTeam = computeMissingPlanDaysByTeam(sessionsInWindow, plans, {
    windowStart,
    todayStr,
    deadlineHour: TRAINING_PLAN_DEADLINE_HOUR,
    currentHour: bangkokHour()
  });
  if (missingPlanDaysByTeam.size > 0) {
    notifications.push({
      key: "missing_plans_recent",
      icon: icon("clock"),
      level: "action",
      count: missingPlanDaysByTeam.size,
      title: `ทีมที่มีวันขาดส่งแผนการฝึกซ้อมใน 14 วันที่ผ่านมา ${missingPlanDaysByTeam.size} ทีม`,
      detail: Array.from(missingPlanDaysByTeam.entries()).map(([t, count]) => `${t} (ขาด ${count} วัน)`).join(", "),
      // ?team=__ALL__ เพื่อให้ผู้ดูแลระบบเห็นข้อมูลทันที (ไม่งั้น Dashboard จะโชว์หน้าเลือกทีมแทน) และ
      // #training-plan-summary-section ให้เลื่อนไปที่ตารางสรุปแผนการฝึกซ้อมโดยตรง
      link: "index.html?team=__ALL__#training-plan-summary-section"
    });
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
      icon: icon("trending-down"),
      level: "action",
      count: lateCoaches.length,
      title: `โค้ชที่ส่งแผนการฝึกซ้อมสายเกินเกณฑ์เดือนนี้ ${lateCoaches.length} คน`,
      detail: lateCoaches.map((g) => `${g.coachName} (สาย ${g.late}/${g.total} ครั้ง)`).join(", "),
      link: "index.html?team=__ALL__#training-plan-summary-section"
    });
  }

  // 5) การประเมินนักกีฬาที่ยังไม่ครบ ย้อนหลัง 14 วัน (ตรวจเฉพาะวันที่มีการฝึกซ้อมจริงของแต่ละทีม — ใช้ sessions
  // ชุดเดียวกับข้อ 3 ด้านบน) — ดึงจำนวนนักกีฬาต่อทีมครั้งเดียวต่อทีม (ไม่ใช่ต่อวันซ้อม) แล้วเช็ค attendance ของ
  // แต่ละวันซ้อมแบบขนาน (Promise.all) กันคำขอ Firestore บวมเกินจำเป็นเมื่อย้อนหลังหลายวัน
  const realSessions = sessionsInWindow.filter((s) => !s.noTraining && s.team && s.date && s.date >= windowStart);
  const teamsWithSessions = Array.from(new Set(realSessions.map((s) => s.team)));
  const playerCountByTeam = new Map();
  await Promise.all(
    teamsWithSessions.map(async (team) => {
      const snap = await getDocs(query(collection(db, "players"), where("team", "==", team)));
      playerCountByTeam.set(team, snap.size);
    })
  );
  const incompleteTeamPerSession = await Promise.all(
    realSessions.map(async (session) => {
      const totalPlayers = playerCountByTeam.get(session.team) || 0;
      if (totalPlayers === 0) return null;
      const attendanceSnap = await getDocs(query(collection(db, "attendance"), where("sessionId", "==", session.id)));
      const evaluatedCount = attendanceSnap.docs.map((d) => d.data()).filter((a) => isPlayerFullyEvaluated(a)).length;
      return evaluatedCount < totalPlayers ? session.team : null;
    })
  );
  const incompleteDaysByTeam = new Map(); // team -> จำนวนวันที่ประเมินไม่ครบ
  for (const team of incompleteTeamPerSession) {
    if (!team) continue;
    incompleteDaysByTeam.set(team, (incompleteDaysByTeam.get(team) || 0) + 1);
  }
  if (incompleteDaysByTeam.size > 0) {
    // แนบชื่อทีมแรกที่ยังไม่ครบไปกับลิงก์ ให้หน้าความคืบหน้าเปิดทีมนั้นให้ทันที (ไม่ต้องไล่หาเอง) — ถ้ามีหลาย
    // ทีมค้างอยู่ ทีมอื่นๆ ยังเลือกดูต่อได้จากปุ่มเลือกทีมในหน้านั้นตามปกติ
    notifications.push({
      key: "incomplete_evaluations_recent",
      icon: icon("clipboard-list"),
      level: "info",
      count: incompleteDaysByTeam.size,
      title: `ทีมที่มีวันประเมินนักกีฬาไม่ครบใน 14 วันที่ผ่านมา ${incompleteDaysByTeam.size} ทีม`,
      detail: Array.from(incompleteDaysByTeam.entries()).map(([t, count]) => `${t} (${count} วัน)`).join(", "),
      link: `attendance.html#admin=progress&team=${encodeURIComponent(incompleteDaysByTeam.keys().next().value)}`
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

// ทำเครื่องหมายว่าอ่านแล้วทีละหมวดพร้อมกันทั้งหมด (ปุ่ม "ทำเครื่องหมายว่าอ่านทั้งหมด") — เขียนแยกเอกสารต่อหมวด
// เหมือน markNotificationRead ปกติทุกประการ แค่ยิงพร้อมกันทีเดียวแทนการกดทีละรายการ ข้ามรายการที่อ่านแล้วอยู่ก่อน
// (n.read) เพื่อไม่ต้องเขียนทับด้วยค่าเดิมโดยไม่จำเป็น
export async function markAllNotificationsRead(notifications) {
  await Promise.all(notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.key, n.detail)));
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
        : `<button type="button" class="btn-icon flex-shrink-0" data-mark-read-index="${i}" title="ทำเครื่องหมายว่าอ่านแล้ว" aria-label="ทำเครื่องหมายว่าอ่านแล้ว">${icon("check")}</button>`;
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
