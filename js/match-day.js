// Match Day (เมนู Attendance Check) — ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้
// วัน Match Day บันทึกลงคอลเลกชัน matchReports เดิม (id คงที่ต่อวัน+รุ่น+ทีม) เพื่อให้ Dashboard/สมุดพก/หน้านักกีฬาที่อ่านรายงานผลการแข่งขันใช้ต่อได้
// ฟิลด์เดิมครบ (opponent, competitionType, competition, ageGroup, result, scoreUs/Them, formation, startingLineup*, lineupGuests*, notes)
// + ฟิลด์ใหม่: matchDay, matchFormat, players[] (สถานะ/ตำแหน่ง/ประตู/assist/เปลี่ยนตัว/คะแนน), oppAttack, oppDefense, videoUrl
import { buildLineupFields, isGoalkeeper } from "./match-lineup.js";

export const MATCH_FORMATS = [
  { key: "7v7", label: "7v7", size: 7 },
  { key: "9v9", label: "9v9", size: 9 },
  { key: "11v11", label: "11v11", size: 11 },
  { key: "other", label: "อื่นๆ (โปรดระบุ)", size: null }
];
export const COMPETITION_TYPES = ["ลีก", "ทัวร์นาเมนต์", "อุ่นเครื่อง"]; // ค่าเดียวกับฟอร์มรายงานผลการแข่งขันเดิม
export const MATCH_RESULTS = ["ชนะ", "เสมอ", "แพ้"];
export const PLAYER_STATUSES = [
  { key: "starter", label: "ตัวจริง" },
  { key: "sub", label: "สำรอง" },
  { key: "none", label: "ไม่มีรายชื่อ" }
];
export const POSITION_GROUPS = [
  { label: "ผู้รักษาประตู", positions: ["GK"] },
  { label: "กองหลัง", positions: ["CB", "RB", "LB", "RWB", "LWB", "SW"] },
  { label: "กองกลาง", positions: ["CDM", "CM", "CAM", "RM", "LM"] },
  { label: "กองหน้า", positions: ["RW", "LW", "SS", "CF", "ST"] }
];
export const ALL_POSITIONS = POSITION_GROUPS.flatMap((g) => g.positions);

// แผนการเล่นที่แนะนำตามประเภทการแข่งขัน — พิมพ์เองได้ ระบบตรวจว่าผลรวมตัวเลข = จำนวนผู้เล่นนอกประตู
export const FORMATION_PRESETS = {
  "7v7": ["2-3-1", "3-2-1", "2-2-2", "3-1-2"],
  "9v9": ["3-3-2", "3-2-3", "2-4-2", "3-4-1", "2-3-3"],
  "11v11": ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2", "3-4-3", "4-1-4-1", "5-3-2", "4-5-1"]
};

export const MATCH_MAX_MINUTE = 130; // ครอบคลุมต่อเวลา
export const MATCH_RATING_MAX = 4; // คะแนนผู้เล่น 0.5-4 ดาว ครั้งละครึ่งดาว

// "67:00" → วินาที (ไม่ถูกต้อง = null) รูปแบบ นาที:วินาที นาที 0-130 วินาที 00-59
export function parseMinute(text) {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(String(text ?? "").trim());
  if (!m) return null;
  const minutes = Number(m[1]);
  return minutes > MATCH_MAX_MINUTE ? null : minutes * 60 + Number(m[2]);
}

// "7:5" ไม่รับ — แต่ "7:05" รับ; ใช้จัดรูปเป็น "07:05" สำหรับแสดงผล/เก็บ
export function normalizeMinute(text) {
  const secs = parseMinute(text);
  if (secs === null) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
}

export function resultForScore(us, them) {
  if (!Number.isInteger(us) || !Number.isInteger(them)) return null;
  return us > them ? "ชนะ" : us < them ? "แพ้" : "เสมอ";
}

// แผนการเล่น "4-3-3" → { outfield: 10 } หรือ null ถ้ารูปแบบไม่ถูกต้อง (2-5 ตัวเลข ตัวละหลักเดียวเท่านั้นไม่ได้ — รับ 1-2 หลัก)
export function parseFormation(text) {
  const t = String(text ?? "").trim();
  if (!/^\d{1,2}(-\d{1,2}){1,5}$/.test(t)) return null;
  const parts = t.split("-").map(Number);
  if (parts.some((n) => n < 1)) return null;
  return { parts, outfield: parts.reduce((a, b) => a + b, 0) };
}

// จำนวนผู้เล่นตัวจริงที่ต้องมี: 7/9/11 ตามประเภท หรือ (ผลรวมแผน + 1 GK) ถ้าเป็น "อื่นๆ" — null = ยังตัดสินไม่ได้ (แผนไม่ถูกต้อง)
export function expectedStarters(format, formation) {
  const known = MATCH_FORMATS.find((f) => f.key === format)?.size;
  if (known) return known;
  const parsed = parseFormation(formation);
  return parsed ? parsed.outfield + 1 : null;
}

// แผนการเล่นต้องสอดคล้องกับประเภทการแข่งขัน — คืน null ถ้าผ่าน หรือข้อความ error
export function formationError(format, formation) {
  const parsed = parseFormation(formation);
  if (!parsed) return "แผนการเล่นต้องเป็นรูปแบบตัวเลขคั่นด้วยขีด เช่น 4-3-3";
  const size = MATCH_FORMATS.find((f) => f.key === format)?.size;
  if (size && parsed.outfield !== size - 1) return `แผนการเล่น ${formation} ไม่ตรงกับ ${format} (ผู้เล่นนอกประตูต้องรวมได้ ${size - 1} คน)`;
  if (!size && (parsed.outfield < 4 || parsed.outfield > 10)) return "แผนการเล่นของประเภท \"อื่นๆ\" ต้องรวมผู้เล่นนอกประตู 4-10 คน";
  return null;
}

// ---------- แถวนักกีฬา ----------
// row = { id, nickname, fullName, ageGroup, guest, defaultPosition, status, position, goals, assists, outMinute, replacedBy, rating }
export function newRow(player, ownAgeGroup) {
  return {
    id: player.id,
    nickname: player.nickname ?? player.fullName ?? "-",
    fullName: player.fullName ?? "",
    ageGroup: player.ageGroup ?? ownAgeGroup,
    guest: !!player.ageGroup && player.ageGroup !== ownAgeGroup,
    defaultPosition: player.position ?? "",
    status: "none",
    position: "",
    goals: "",
    assists: "",
    outMinute: "",
    replacedBy: "",
    rating: null
  };
}

// ใครลงสนามบ้าง: ตัวจริงทุกคน + สำรองที่ถูกเลือกเป็นคนเข้าแทนของใครสักคน
export function playedIds(rows) {
  const subbedOn = new Set(rows.map((r) => r.replacedBy).filter(Boolean));
  return new Set(rows.filter((r) => r.status === "starter" || (r.status === "sub" && subbedOn.has(r.id))).map((r) => r.id));
}

// ใครเข้าแทนใคร (ข้อมูลเชื่อมกันสองทาง): subId → { outId, minute }
export function subInfo(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.replacedBy) map.set(r.replacedBy, { outId: r.id, minute: r.outMinute });
  }
  return map;
}

// ตัวเลือก "ถูกเปลี่ยนแทนโดย" ของแถวหนึ่ง: ผู้เล่นสถานะสำรองที่ยังไม่ได้เข้าแทนใคร (หรือเข้าแทนแถวนี้อยู่แล้ว) และไม่ใช่ตัวเอง
export function replacementOptions(rows, rowId) {
  const taken = new Map(rows.filter((r) => r.replacedBy).map((r) => [r.replacedBy, r.id]));
  return rows.filter((r) => r.status === "sub" && r.id !== rowId && (!taken.has(r.id) || taken.get(r.id) === rowId));
}

// เปลี่ยนสถานะของแถว: ถ้าไม่ใช่ตัวจริง/สำรองที่ลงสนามแล้ว ล้างข้อมูลที่ไม่เกี่ยวข้อง (ประตู, assist, คะแนน, การเปลี่ยนตัว) และปลดความเชื่อมที่ชี้มาที่แถวนี้
export function setStatus(rows, rowId, status) {
  const next = rows.map((r) => ({ ...r }));
  const row = next.find((r) => r.id === rowId);
  if (!row) return next;
  row.status = status;
  if (status === "none") row.position = "";
  // ตำแหน่งตั้งต้น = ตำแหน่งที่ลงทะเบียนไว้ของนักกีฬา (ถ้าอยู่ในรายการตำแหน่งมาตรฐาน) แก้ได้
  else if (!row.position && ALL_POSITIONS.includes(row.defaultPosition)) row.position = row.defaultPosition;
  return cleanupRows(next);
}

// ทำให้ข้อมูลสอดคล้อง: ความเชื่อมเปลี่ยนตัวต้องชี้ไป "สำรอง" ที่ยังมีอยู่ และคนที่ไม่ได้ลงสนามห้ามมีประตู/assist/คะแนน/นาทีออก
export function cleanupRows(rows) {
  let next = rows.map((r) => ({ ...r }));
  // วนซ้ำเพราะการล้างแถวหนึ่งอาจทำให้ความเชื่อมของอีกแถวไร้ผล (เปลี่ยนตัวต่อกันเป็นทอด)
  for (let i = 0; i < next.length + 1; i++) {
    const subs = new Set(next.filter((r) => r.status === "sub").map((r) => r.id));
    const played = playedIds(next);
    let changed = false;
    for (const r of next) {
      if (r.replacedBy && (!played.has(r.id) || !subs.has(r.replacedBy) || r.replacedBy === r.id)) {
        r.replacedBy = "";
        changed = true;
      }
      if (!played.has(r.id)) {
        if (r.goals !== "" || r.assists !== "" || r.rating !== null || r.outMinute !== "") {
          r.goals = "";
          r.assists = "";
          r.rating = null;
          r.outMinute = "";
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return next;
}

// ตั้งผู้เข้าแทน: คนออก (outId) ถูกแทนโดย subId — ถ้า subId เคยเข้าแทนคนอื่นอยู่ให้ย้ายมา
export function setReplacement(rows, outId, subId) {
  const next = rows.map((r) => ({ ...r }));
  for (const r of next) if (subId && r.replacedBy === subId && r.id !== outId) r.replacedBy = "";
  const out = next.find((r) => r.id === outId);
  if (out) out.replacedBy = subId || "";
  return cleanupRows(next);
}

const asInt = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

// ---------- ตรวจฟอร์มก่อนบันทึก ----------
// form = { format, formatOther, competitionType, competition, opponent, result, scoreUs, scoreThem, formation, rows, oppAttack, oppDefense, videoUrl }
// คืน { errors: [ข้อความที่บล็อกการบันทึก], warnings: [เตือนเฉยๆ] }
export function validateMatchDay(form) {
  const errors = [];
  const warnings = [];
  if (!form.format) errors.push("เลือกประเภทการแข่งขัน");
  else if (form.format === "other" && !String(form.formatOther ?? "").trim()) errors.push("ระบุประเภทการแข่งขัน (อื่นๆ)");
  if (!form.competitionType) errors.push("เลือกประเภทรายการ");
  if (!String(form.competition ?? "").trim()) errors.push("ระบุชื่อรายการ");
  if (!String(form.opponent ?? "").trim()) errors.push("ระบุคู่แข่ง");
  if (!form.result) errors.push("เลือกผลการแข่งขัน");
  const us = asInt(form.scoreUs);
  const them = asInt(form.scoreThem);
  const scoresOk = Number.isInteger(us) && us >= 0 && Number.isInteger(them) && them >= 0;
  if (!scoresOk) errors.push("ประตูทีมเรากับคู่แข่งต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  else if (form.result && resultForScore(us, them) !== form.result) warnings.push(`ผลที่เลือก (${form.result}) ไม่ตรงกับสกอร์ ${us}-${them}`);

  let formationProblem = null;
  if (!String(form.formation ?? "").trim()) formationProblem = "ระบุแผนการเล่น";
  else if (form.format) formationProblem = formationError(form.format, form.formation);
  if (formationProblem) errors.push(formationProblem);

  const rows = form.rows || [];
  const starters = rows.filter((r) => r.status === "starter");
  const expected = form.format ? expectedStarters(form.format, form.formation) : null;
  if (expected && starters.length !== expected) errors.push(`ตัวจริงต้องครบ ${expected} คน (ตอนนี้ ${starters.length} คน)`);
  if (starters.length > 0 && !starters.some((r) => r.position === "GK")) errors.push("ตัวจริงต้องมีผู้รักษาประตู (เลือกตำแหน่ง GK ให้ผู้เล่นหนึ่งคน)");
  for (const r of starters) if (!r.position) errors.push(`เลือกตำแหน่งการเล่นของตัวจริง "${r.nickname}"`);

  const played = playedIds(rows);
  const infoBySub = subInfo(rows);
  for (const r of rows) {
    if (r.replacedBy) {
      if (parseMinute(r.outMinute) === null) errors.push(`ระบุนาทีที่ "${r.nickname}" ถูกเปลี่ยนออก เป็นรูปแบบ 00:00`);
    } else if (String(r.outMinute ?? "").trim() !== "" && parseMinute(r.outMinute) === null) {
      errors.push(`นาทีที่ "${r.nickname}" ออกจากสนามต้องเป็นรูปแบบ 00:00`);
    }
    if (r.rating !== null && r.rating !== undefined && (!(r.rating > 0 && r.rating <= MATCH_RATING_MAX) || (r.rating * 2) % 1 !== 0)) {
      errors.push(`คะแนนของ "${r.nickname}" ต้องอยู่ระหว่าง 0.5-${MATCH_RATING_MAX} ดาว (ครั้งละครึ่งดาว)`);
    }
    if (played.has(r.id)) {
      const g = asInt(r.goals);
      const a = asInt(r.assists);
      if ((g !== null && (!Number.isInteger(g) || g < 0)) || (a !== null && (!Number.isInteger(a) || a < 0))) errors.push(`ประตู/assist ของ "${r.nickname}" ต้องเป็นตัวเลข 0 ขึ้นไป`);
    }
  }
  // นาทีเข้าแทนต้องอยู่หลังนาทีที่คนที่เข้าไปแทนลงสนาม (กรณีเปลี่ยนต่อเป็นทอด) — ตรวจแบบง่าย: ถ้าสำรองที่เข้ามาแล้วถูกเปลี่ยนออกอีก นาทีออกต้องไม่น้อยกว่านาทีเข้า
  for (const r of rows) {
    const entered = infoBySub.get(r.id);
    if (entered && r.replacedBy) {
      const inSecs = parseMinute(entered.minute);
      const outSecs = parseMinute(r.outMinute);
      if (inSecs !== null && outSecs !== null && outSecs < inSecs) errors.push(`"${r.nickname}" ถูกเปลี่ยนออกก่อนนาทีที่ลงสนาม`);
    }
  }
  const goalSum = rows.filter((r) => played.has(r.id)).reduce((n, r) => n + (asInt(r.goals) || 0), 0);
  if (scoresOk && goalSum > us) warnings.push(`ผลรวมประตูของผู้เล่น (${goalSum}) มากกว่าประตูทีมเรา (${us})`);

  if (!String(form.oppAttack ?? "").trim()) errors.push("กรอกรูปแบบการเล่นเกมรุกของคู่แข่ง");
  if (!String(form.oppDefense ?? "").trim()) errors.push("กรอกรูปแบบการเล่นเกมรับของคู่แข่ง");
  const link = String(form.videoUrl ?? "").trim();
  if (link && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(link)) errors.push("ลิงก์ดูการแข่งขันย้อนหลังต้องขึ้นต้นด้วย https://");
  return { errors, warnings };
}

// id เอกสารคงที่ต่อ (ทีม, วัน, รุ่นอายุ) — บันทึกซ้ำ = แก้ของเดิม
export function matchDayDocId(team, date, ageGroup) {
  return `md_${date}_${ageGroup}_${String(team).replace(/[^A-Za-z0-9]+/g, "-")}`;
}

// เอกสารที่จะเขียนลง matchReports (ยังไม่รวม createdAt/updatedAt/coach*/team ที่ผู้เรียกใส่เอง)
export function buildMatchDayPayload(form, ageGroup) {
  const rows = form.rows || [];
  const played = playedIds(rows);
  const infoBySub = subInfo(rows);
  const starters = rows.filter((r) => r.status === "starter");
  const players = rows.map((r) => {
    const entered = infoBySub.get(r.id);
    const did = played.has(r.id);
    return {
      id: r.id,
      name: r.nickname,
      fullName: r.fullName || null,
      ageGroup: r.ageGroup,
      guest: r.guest,
      status: r.status,
      position: r.position || null,
      played: did,
      goals: did ? asInt(r.goals) ?? 0 : 0,
      assists: did ? asInt(r.assists) ?? 0 : 0,
      subOutMinute: r.replacedBy || r.outMinute ? normalizeMinute(r.outMinute) : null,
      replacedById: r.replacedBy || null,
      subInMinute: entered ? normalizeMinute(entered.minute) : null,
      replacesId: entered ? entered.outId : null,
      rating: did && r.rating ? r.rating : null
    };
  });
  const lineup = buildLineupFields(
    starters.map((r) => ({ id: r.id, nickname: r.nickname, ageGroup: r.ageGroup, position: r.position })),
    ageGroup
  );
  const format = form.format;
  return {
    matchDay: true,
    ageGroup,
    opponent: form.opponent.trim(),
    competitionType: form.competitionType,
    competition: form.competition.trim(),
    matchFormat: format,
    matchFormatOther: format === "other" ? form.formatOther.trim() : null,
    result: form.result,
    scoreUs: Number(form.scoreUs),
    scoreThem: Number(form.scoreThem),
    formation: form.formation.trim(),
    ...lineup,
    players,
    oppAttack: form.oppAttack.trim(),
    oppDefense: form.oppDefense.trim(),
    videoUrl: String(form.videoUrl ?? "").trim() || null,
    notes: String(form.notes ?? "").trim() || null
  };
}

// กรอกฟอร์มกลับจากเอกสารที่บันทึกไว้ (ตอนเปิดดู/แก้ไข) — ผู้เรียกเติมแถวของนักกีฬาที่เพิ่งเข้าทีมหลังบันทึกเองจากรายชื่อปัจจุบัน
export function formFromReport(report) {
  const rows = (report.players || []).map((p) => ({
    id: p.id,
    nickname: p.name ?? "-",
    fullName: p.fullName ?? "",
    ageGroup: p.ageGroup ?? report.ageGroup,
    guest: !!p.guest,
    defaultPosition: "",
    status: p.status ?? "none",
    position: p.position ?? "",
    goals: p.goals ? String(p.goals) : "",
    assists: p.assists ? String(p.assists) : "",
    outMinute: p.subOutMinute ?? "",
    replacedBy: p.replacedById ?? "",
    rating: p.rating ?? null
  }));
  return {
    format: report.matchFormat ?? "",
    formatOther: report.matchFormatOther ?? "",
    competitionType: report.competitionType ?? "",
    competition: report.competition ?? "",
    opponent: report.opponent ?? "",
    result: report.result ?? "",
    scoreUs: report.scoreUs ?? "",
    scoreThem: report.scoreThem ?? "",
    formation: report.formation ?? "",
    rows,
    oppAttack: report.oppAttack ?? "",
    oppDefense: report.oppDefense ?? "",
    videoUrl: report.videoUrl ?? "",
    notes: report.notes ?? ""
  };
}

export { isGoalkeeper };
