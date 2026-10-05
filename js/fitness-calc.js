// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ของระบบทดสอบสมรรถภาพรายรอบ (Sports Science 1.4)
//
// หลักการ: เก็บ "ค่าดิบ" ทุกครั้งที่ทดสอบ (trials) ส่วนค่าที่ใช้/ค่าแปลผล (ดีที่สุด, % ที่ลดลงของ RSA ฯลฯ) คำนวณตอนแสดงผลที่นี่ที่เดียว
// จะได้เปลี่ยนเกณฑ์ภายหลังได้โดยไม่เสียข้อมูลเดิม — ไม่เก็บค่าที่คำนวณลงฐานข้อมูล
//   fitnessRounds/{id}: รอบที่แอดมินเปิด (season, roundType, mode, openDate, closeDate, makeupUntil, testCodes[], status)
//   fitnessResults/{roundId}_{playerId}: ผลของนักกีฬา 1 คน 1 รอบ (tests: { รหัส: { trials: [...] } }, notTested, สภาพการทดสอบ)

// ---------- รายการทดสอบ ----------
// pick: single = ค่าเดียวที่วัด | max = ค่าสูงสุดของทุกครั้ง (ยิ่งมากยิ่งดี) | min = ค่าต่ำสุด (เวลา ยิ่งน้อยยิ่งดี) | rsa = ดีที่สุด/เฉลี่ย/% ที่ลดลง
// minAge/maxAge = รุ่นอายุที่ใช้รายการนี้ (U10–U18) | selective = อยู่ในรอบแบบ Selective ด้วย (ไม่มีความอดทน/COD/RSA)
// step = ขั้นของช่องกรอก (ใช้ตรวจความถูกต้อง/ช่อง input)
export const FITNESS_TESTS = [
  { code: "height", label: "ส่วนสูงยืน", unit: "ซม.", trials: 1, pick: "single", step: 0.1, decimals: 1, minAge: 10, maxAge: 18, selective: true },
  { code: "sitting_height", label: "ส่วนสูงนั่ง", unit: "ซม.", trials: 1, pick: "single", step: 0.1, decimals: 1, minAge: 10, maxAge: 18, selective: false },
  { code: "weight", label: "น้ำหนัก", unit: "กก.", trials: 1, pick: "single", step: 0.1, decimals: 1, minAge: 10, maxAge: 18, selective: true },
  { code: "broad_jump", label: "Broad Jump", unit: "ซม.", trials: 3, pick: "max", step: 1, decimals: 0, minAge: 10, maxAge: 18, selective: true },
  { code: "cmj", label: "CMJ", unit: "ซม.", trials: 3, pick: "max", step: 0.1, decimals: 1, minAge: 13, maxAge: 18, selective: true },
  { code: "sprint_10", label: "Sprint 10 ม.", unit: "วินาที", trials: 3, pick: "min", step: 0.01, decimals: 2, minAge: 10, maxAge: 18, selective: true },
  { code: "sprint_30", label: "Sprint 30 ม.", unit: "วินาที", trials: 3, pick: "min", step: 0.01, decimals: 2, minAge: 13, maxAge: 18, selective: true },
  { code: "cod_505_l", label: "505 ซ้าย", unit: "วินาที", trials: 2, pick: "min", step: 0.01, decimals: 2, minAge: 12, maxAge: 18, selective: false },
  { code: "cod_505_r", label: "505 ขวา", unit: "วินาที", trials: 2, pick: "min", step: 0.01, decimals: 2, minAge: 12, maxAge: 18, selective: false },
  { code: "rsa_6x30", label: "RSA 6×30 ม.", unit: "วินาที", trials: 6, pick: "rsa", step: 0.01, decimals: 2, minAge: 16, maxAge: 18, selective: false },
  { code: "yoyo_ir1c", label: "Yo-Yo IR1C", unit: "เมตร", trials: 1, pick: "single", step: 20, decimals: 0, minAge: 10, maxAge: 13, selective: false },
  { code: "ift_3015", label: "30-15 IFT", unit: "V_IFT กม./ชม.", trials: 1, pick: "single", step: 0.5, decimals: 1, minAge: 12, maxAge: 18, selective: false }
];

export const FITNESS_TEST_BY_CODE = Object.fromEntries(FITNESS_TESTS.map((t) => [t.code, t]));
export const SELECTIVE_TEST_CODES = FITNESS_TESTS.filter((t) => t.selective).map((t) => t.code);
export const FULL_TEST_CODES = FITNESS_TESTS.map((t) => t.code);

export const FOOTWEAR_OPTIONS = ["รองเท้าสตั๊ด", "รองเท้าวิ่ง"];
export const SURFACE_OPTIONS = ["หญ้าเทียม", "หญ้าจริง", "ในร่ม"];
export const NOT_TESTED_REASONS = ["บาดเจ็บ", "ป่วย", "ไม่มา", "อื่นๆ"];

// "U13" → 13 (ไม่รู้จัก = null)
export function ageNumberOf(ageGroup) {
  const m = /^U(\d{1,2})$/i.exec(String(ageGroup || "").trim());
  return m ? Number(m[1]) : null;
}

// รายการที่ใช้กับรุ่นอายุนี้ในรอบนี้: อยู่ใน testCodes ของรอบ (ไม่มี testCodes = ทั้งชุดตามรูปแบบ) และอยู่ในช่วงอายุของรายการ
export function testsForRound(round, ageGroup) {
  const age = ageNumberOf(ageGroup);
  if (age === null) return [];
  const codes = new Set(round?.testCodes && round.testCodes.length > 0 ? round.testCodes : round?.mode === "selective" ? SELECTIVE_TEST_CODES : FULL_TEST_CODES);
  return FITNESS_TESTS.filter((t) => codes.has(t.code) && age >= t.minAge && age <= t.maxAge);
}

export function defaultTestCodes(mode) {
  return mode === "selective" ? [...SELECTIVE_TEST_CODES] : [...FULL_TEST_CODES];
}

// ---------- ค่าจากผลดิบ ----------
const toNumbers = (trials) => (trials || []).map((x) => (x === "" || x === null || x === undefined ? NaN : Number(x))).filter((n) => Number.isFinite(n));

// ค่าที่ใช้ของรายการหนึ่ง (null = ยังไม่มีค่า) — RSA คืนอ็อบเจ็กต์ { best, mean, decrementPct } (ดู rsaStats)
export function resultValue(test, trials) {
  const nums = toNumbers(trials);
  if (nums.length === 0) return null;
  if (test.pick === "max") return Math.max(...nums);
  if (test.pick === "min") return Math.min(...nums);
  if (test.pick === "rsa") return rsaStats(nums);
  return nums[0];
}

// RSA: best = เที่ยวที่เร็วที่สุด, mean = เวลาเฉลี่ย, decrementPct = % ที่ช้าลงเทียบกับการวิ่งได้เท่าเที่ยวดีที่สุดทุกเที่ยว
// สูตรมาตรฐาน: (ผลรวมเวลา ÷ (best × จำนวนเที่ยว) − 1) × 100
export function rsaStats(trials) {
  const nums = toNumbers(trials);
  if (nums.length === 0) return null;
  const best = Math.min(...nums);
  const sum = nums.reduce((s, x) => s + x, 0);
  return { best, mean: sum / nums.length, decrementPct: (sum / (best * nums.length) - 1) * 100, count: nums.length };
}

// ข้อความค่าที่ใช้สำหรับแสดง (ตามทศนิยมของรายการ) — ไม่มีค่า = "–"
export function formatResult(test, trials) {
  const v = resultValue(test, trials);
  if (v === null) return "–";
  if (test.pick === "rsa") return `${v.best.toFixed(test.decimals)} / ${v.decrementPct.toFixed(1)}%`;
  return v.toFixed(test.decimals);
}

export function hasValue(trials) {
  return toNumbers(trials).length > 0;
}

// จำนวนรายการที่กรอกแล้วจากที่ต้องกรอก (result = เอกสารผลของนักกีฬา, tests = testsForRound)
export function completion(result, tests) {
  if (result?.notTested) return { done: 0, total: tests.length, state: "not_tested" };
  const done = tests.filter((t) => hasValue(result?.tests?.[t.code]?.trials)).length;
  const state = done === 0 ? "empty" : done === tests.length && tests.length > 0 ? "complete" : "partial";
  return { done, total: tests.length, state };
}

// ---------- รอบทดสอบ ----------
export const ROUND_TYPES = [
  { key: "baseline", label: "Baseline", hint: "กลาง พ.ค.", defaultMonthDay: [5, 17], defaultMode: "full" },
  { key: "monitoring", label: "Monitoring", hint: "ส.ค.", defaultMonthDay: [8, 9], defaultMode: "selective" },
  { key: "reeval", label: "Re-evaluation", hint: "พ.ย.", defaultMonthDay: [11, 8], defaultMode: "full" },
  { key: "final", label: "Final", hint: "ต้น ก.พ.", defaultMonthDay: [2, 1], defaultMode: "full" }
];
export const ROUND_TYPE_BY_KEY = Object.fromEntries(ROUND_TYPES.map((t) => [t.key, t]));
export const ROUND_MODES = [
  { key: "full", label: "Full" },
  { key: "selective", label: "Selective" }
];
export const ENTRY_WINDOW_DAYS = 14; // กรอกได้ภายใน 2 สัปดาห์ของรอบ (วันเปิดถึงวันปิดรวมวันเปิด)
export const MAKEUP_DAYS = 14; // ทดสอบซ่อมได้อีก 14 วันหลังปิดรอบ

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function utcDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
export function addDays(dateStr, days) {
  const d = utcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}
export function daysBetween(fromStr, toStr) {
  return Math.round((utcDate(toStr) - utcDate(fromStr)) / 86400000);
}

export function thaiDateShort(dateStr) {
  const d = utcDate(dateStr);
  return `${d.getUTCDate()} ${THAI_MONTHS_SHORT[d.getUTCMonth()]}`;
}

// ปีการศึกษา "2027/28" → ปี ค.ศ. ที่เริ่ม (2027) — เทอม/ปีการศึกษาเริ่ม พ.ค. เหมือนส่วนบาดเจ็บ (ดู injury-period.js)
export function seasonStartYear(season) {
  const m = /^(\d{4})\/\d{2}$/.exec(String(season || ""));
  return m ? Number(m[1]) : null;
}
export function seasonLabelFor(startYear) {
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

// วันเปิดรอบตั้งต้นของรอบนั้นในปีการศึกษานั้น (แก้ได้ในฟอร์ม): Baseline/Monitoring/Re-eval อยู่ในปีที่เริ่ม Final อยู่ปีถัดไป
export function defaultRoundDates(roundType, season) {
  const y = seasonStartYear(season);
  const type = ROUND_TYPE_BY_KEY[roundType];
  if (y === null || !type) return null;
  const [month, day] = type.defaultMonthDay;
  const year = roundType === "final" ? y + 1 : y;
  const openDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return datesFromOpen(openDate);
}

// ปีการศึกษาแรกที่รอบนี้ยังไม่พ้นช่วงทดสอบซ่อม ณ วันนี้ (ใช้ตั้งค่าเริ่มต้นในฟอร์มเปิดรอบ ไม่ให้ขึ้นวันที่ที่ผ่านไปแล้ว)
export function bestSeasonFor(roundType, todayStr, { span = 3 } = {}) {
  const [y, m] = todayStr.split("-").map(Number);
  const current = m >= 5 ? y : y - 1;
  for (let yr = current; yr < current + span; yr++) {
    const dates = defaultRoundDates(roundType, seasonLabelFor(yr));
    if (dates && todayStr <= dates.makeupUntil) return seasonLabelFor(yr);
  }
  return seasonLabelFor(current);
}

export function datesFromOpen(openDate) {
  const closeDate = addDays(openDate, ENTRY_WINDOW_DAYS - 1);
  return { openDate, closeDate, makeupUntil: addDays(closeDate, MAKEUP_DAYS) };
}

// ชื่อรอบสำหรับแสดง เช่น "Baseline พ.ค. 2027"
export function roundLabel(round) {
  const type = ROUND_TYPE_BY_KEY[round.roundType];
  const d = utcDate(round.openDate);
  return `${type ? type.label : round.roundType} ${THAI_MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// สถานะรอบ ณ วันนี้: upcoming (ยังไม่ถึงวันเปิด) | open (กรอกได้) | makeup (หลังปิด อยู่ในช่วงทดสอบซ่อม) | closed
// แอดมินสั่งปิดเอง (status: "closed") ถือว่าปิดทันที
export function roundState(round, todayStr) {
  if (round.status === "closed") return "closed";
  if (todayStr < round.openDate) return "upcoming";
  if (todayStr <= round.closeDate) return "open";
  if (todayStr <= round.makeupUntil) return "makeup";
  return "closed";
}

export function roundIsEntryOpen(round, todayStr) {
  const s = roundState(round, todayStr);
  return s === "open" || s === "makeup";
}

// รอบที่โค้ชควรกรอกตอนนี้: รอบที่กรอกได้ (open/makeup) — ถ้ามีหลายรอบ เลือกรอบที่ใกล้ปิดที่สุด (null = ไม่มีรอบเปิด)
export function currentEntryRound(rounds, todayStr) {
  return (
    rounds
      .filter((r) => roundIsEntryOpen(r, todayStr))
      .sort((a, b) => (roundState(a, todayStr) === "open" ? 0 : 1) - (roundState(b, todayStr) === "open" ? 0 : 1) || a.closeDate.localeCompare(b.closeDate))[0] || null
  );
}

// ช่วงกรอก+ซ่อมของรอบใหม่ทับกับรอบอื่นหรือไม่ (ไม่ให้เปิดซ้อนกัน) — คืนรอบที่ชน (ไม่ชน = null)
export function overlappingRound(candidate, rounds) {
  return rounds.find((r) => r.id !== candidate.id && candidate.openDate <= r.makeupUntil && r.openDate <= candidate.makeupUntil) || null;
}

// ตรวจฟอร์มเปิดรอบ คืนข้อความ error (ไม่มี = null)
export function validateRoundForm({ season, roundType, mode, openDate, closeDate, testCodes }, rounds = []) {
  if (seasonStartYear(season) === null) return "เลือกปีการศึกษา";
  if (!ROUND_TYPE_BY_KEY[roundType]) return "เลือกรอบ";
  if (!ROUND_MODES.some((m) => m.key === mode)) return "เลือกรูปแบบ Full หรือ Selective";
  if (!openDate || !closeDate) return "กำหนดวันเปิดและวันปิดรอบ";
  if (closeDate < openDate) return "วันปิดรอบต้องไม่ก่อนวันเปิด";
  if (!testCodes || testCodes.length === 0) return "เลือกรายการทดสอบอย่างน้อย 1 รายการ";
  if (testCodes.some((c) => !FITNESS_TEST_BY_CODE[c])) return "มีรายการทดสอบที่ไม่รู้จัก";
  const clash = overlappingRound({ openDate, makeupUntil: addDays(closeDate, MAKEUP_DAYS) }, rounds);
  if (clash) return `ช่วงนี้ซ้อนกับรอบ "${roundLabel(clash)}" (${thaiDateShort(clash.openDate)} – ${thaiDateShort(clash.makeupUntil)} รวมช่วงซ่อม)`;
  return null;
}
