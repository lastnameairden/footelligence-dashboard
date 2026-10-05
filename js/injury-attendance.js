// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ที่เชื่อม "รายงานอาการบาดเจ็บ" (injuryReports) กับ "เช็คชื่อ" (attendance)
// เป้าหมาย: กรอกครั้งเดียวใช้ได้ทั้งสองที่ — รายงานที่ยังไม่หายทำให้เช็คชื่อเติม I/R ให้ และการกด I/R โดยยังไม่มีรายงานสร้างรายงานสั้นๆ ได้ทันที
// รหัสสถานะเช็คชื่อ: I = บาดเจ็บ, R = พักฟื้น (ดู STATUS_LABELS ใน ui-utils.js) สถานะรายงาน: ดู injuryStatusBadge ใน ui-utils.js

export const INJURY_STATUS_HEALED = "หายแล้ว";
export const INJURY_STATUS_RECOVERING = "กำลังพักฟื้น";
export const INJURY_STATUS_IN_TRAINING = "บาดเจ็บขณะฝึกซ้อม";
export const INJURY_SEVERITIES = ["เล็กน้อย", "ปานกลาง", "รุนแรง"];

// รายงานที่ "ยังไม่หาย" ของนักกีฬาแต่ละคน ณ วันที่เช็คชื่อ (เกิดก่อนหรือในวันนั้น) — ถ้ามีหลายใบเลือกใบล่าสุด
// คืน Map playerId -> รายงาน (ต้องมี id ติดมาด้วย) ใบที่ "หายแล้ว" ไม่ถูกนับ ตัวระบบไม่รู้วันที่หายจริงจึงไม่เติมย้อนหลังให้
export function activeInjuryByPlayer(injuries, sessionDate) {
  const map = new Map();
  for (const inj of injuries) {
    if (!inj || !inj.playerId || inj.status === INJURY_STATUS_HEALED) continue;
    if (inj.date && sessionDate && inj.date > sessionDate) continue;
    const current = map.get(inj.playerId);
    if (!current || (inj.date || "") >= (current.date || "")) map.set(inj.playerId, inj);
  }
  return map;
}

// สถานะเช็คชื่อที่สอดคล้องกับรายงาน: กำลังพักฟื้น → R นอกนั้น (บาดเจ็บขณะแข่ง/ซ้อม) → I
export function attendanceStatusForInjury(injury) {
  return injury && injury.status === INJURY_STATUS_RECOVERING ? "R" : "I";
}

// สถานะรายงานตอนสร้างจากเช็คชื่อ: กด I = เพิ่งบาดเจ็บ (ที่ซ้อม) / กด R = กำลังพักฟื้น
export function injuryStatusForAttendance(status) {
  return status === "R" ? INJURY_STATUS_RECOVERING : INJURY_STATUS_IN_TRAINING;
}

// รายการที่ต้องเติมให้อัตโนมัติ: นักกีฬาที่ "ยังไม่มีสถานะเช็คชื่อ" ของวันนั้น และมีรายงานบาดเจ็บค้างอยู่ — ไม่ทับสิ่งที่โค้ชกดไว้แล้ว
// attendanceMap: Map playerId -> { status, ... } (ค่าว่าง/ไม่มีสถานะ = ยังไม่ได้กด)
export function planInjuryAutoFill(players, attendanceMap, injuryMap) {
  const plan = [];
  for (const p of players) {
    const existing = attendanceMap.get(p.id);
    if (existing && existing.status) continue;
    const injury = injuryMap.get(p.id);
    if (!injury) continue;
    plan.push({ playerId: p.id, status: attendanceStatusForInjury(injury), injuryReportId: injury.id });
  }
  return plan;
}

// ข้อความอธิบายรายงานสั้นๆ ใต้ปุ่มสถานะ
export function describeInjury(injury, sessionDate) {
  const parts = [injury.description || "บาดเจ็บ"];
  if (injury.status) parts.push(injury.status);
  if (injury.severity) parts.push(`ความรุนแรง${injury.severity}`);
  let overdue = false;
  if (injury.expectedReturn) {
    parts.push(`คาดกลับ ${injury.expectedReturn}`);
    overdue = !!sessionDate && injury.expectedReturn < sessionDate;
  }
  return { text: parts.join(" · "), overdue };
}

// เอกสารรายงานบาดเจ็บที่สร้างจากฟอร์มสั้นในหน้าเช็คชื่อ (ยังไม่รวม createdAt/updatedAt ซึ่งผู้เรียกใส่ serverTimestamp เอง)
// คืน null ถ้าอาการว่าง — ต้องมีอย่างน้อยอาการ ส่วนรายละเอียดอื่นแก้เพิ่มได้ในหน้ารายงานบาดเจ็บ
export function buildQuickInjuryReport({ team, player, playerName, date, description, severity, attendanceStatus, coachId, coachName }) {
  const text = String(description || "").trim();
  if (!text) return null;
  return {
    team,
    playerId: player.id,
    playerName,
    ageGroup: player.ageGroup ?? null,
    date,
    description: text,
    severity: INJURY_SEVERITIES.includes(severity) ? severity : INJURY_SEVERITIES[0],
    status: injuryStatusForAttendance(attendanceStatus),
    expectedReturn: null,
    notes: null,
    coachId,
    coachName,
    fromAttendance: true
  };
}
