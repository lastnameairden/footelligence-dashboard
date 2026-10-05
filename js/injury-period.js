// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ของตัวเลือกช่วงเวลาในส่วนรายงานอาการบาดเจ็บของ Dashboard (Sports Science 1.3)
// ช่วงที่เลือกได้: เดือน / เทอม / ปีการศึกษา — ปีการศึกษาเริ่มเดือนพฤษภาคม (ตรงกับรอบทดสอบ Baseline) แบ่งเป็น 2 เทอมไม่มีช่วงว่าง:
// เทอม 1 = พ.ค.–ต.ค., เทอม 2 = พ.ย.–เม.ย. ของปีถัดไป — ถ้านิยามเทอมของโรงเรียนต่างจากนี้ แก้ที่ TERMS ที่เดียว
// คีย์ช่วง: เดือน "YYYY-MM" / เทอม "YYYY-T1" หรือ "YYYY-T2" / ปีการศึกษา "YYYY-Y" (YYYY = ปี ค.ศ. ที่ปีการศึกษานั้นเริ่ม)

export const PERIOD_MODES = [
  { key: "month", label: "เดือน" },
  { key: "term", label: "เทอม" },
  { key: "year", label: "ปีการศึกษา" }
];

export const ACADEMIC_YEAR_START_MONTH = 5;
// startMonth/endMonth เป็นเดือนของปีการศึกษา (endOffset = เลื่อนปีหรือไม่เมื่อเดือนสิ้นสุดข้ามปี)
const TERMS = {
  T1: { number: 1, startMonth: 5, endMonth: 10, endYearOffset: 0 },
  T2: { number: 2, startMonth: 11, endMonth: 4, endYearOffset: 1 }
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const pad = (n) => String(n).padStart(2, "0");
const ym = (y, m) => `${y}-${pad(m)}`;

export function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y}`;
}
export function monthShortLabel(month) {
  return THAI_MONTHS_SHORT[Number(month.slice(5)) - 1];
}

// ปีที่ปีการศึกษาของวันที่นั้นเริ่ม (ม.ค.–เม.ย. ยังอยู่ในปีการศึกษาที่เริ่มปีก่อน)
export function academicYearOf(month) {
  const [y, m] = month.split("-").map(Number);
  return m >= ACADEMIC_YEAR_START_MONTH ? y : y - 1;
}

export function monthsBetween(startMonth, endMonth) {
  const out = [];
  let [y, m] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(ym(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// ช่วงปัจจุบันของแต่ละแบบ ตามวันที่ (YYYY-MM-DD, เวลาไทยที่ผู้เรียกส่งมา)
export function currentPeriodKey(mode, todayStr) {
  const month = todayStr.slice(0, 7);
  if (mode === "month") return month;
  const ay = academicYearOf(month);
  if (mode === "year") return `${ay}-Y`;
  const m = Number(month.slice(5));
  return `${ay}-${m >= TERMS.T1.startMonth && m <= TERMS.T1.endMonth ? "T1" : "T2"}`;
}

export function periodFor(mode, key) {
  if (mode === "month") {
    return { mode, key, label: monthLabel(key), startMonth: key, endMonth: key, months: [key], start: `${key}-01`, end: `${key}-31` };
  }
  const y = Number(key.slice(0, 4));
  let startMonth;
  let endMonth;
  let label;
  if (mode === "year") {
    startMonth = ym(y, ACADEMIC_YEAR_START_MONTH);
    endMonth = ym(y + 1, ACADEMIC_YEAR_START_MONTH - 1);
    label = `ปีการศึกษา ${y}/${String(y + 1).slice(2)}`;
  } else {
    const term = TERMS[key.slice(5)];
    startMonth = ym(y, term.startMonth);
    endMonth = ym(y + term.endYearOffset, term.endMonth);
    label = `เทอม ${term.number} ปีการศึกษา ${y}/${String(y + 1).slice(2)}`;
  }
  return { mode, key, label, startMonth, endMonth, months: monthsBetween(startMonth, endMonth), start: `${startMonth}-01`, end: `${endMonth}-31` };
}

// เลื่อนช่วงไปข้างหน้า (+1) หรือย้อนหลัง (-1)
export function shiftPeriodKey(mode, key, delta) {
  if (mode === "month") {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return ym(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }
  const y = Number(key.slice(0, 4));
  if (mode === "year") return `${y + delta}-Y`;
  const index = key.slice(5) === "T1" ? 0 : 1;
  const next = index + delta;
  const yearShift = Math.floor(next / 2);
  return `${y + yearShift}-T${(((next % 2) + 2) % 2) + 1}`;
}

// จำนวนรายงานต่อเดือนในช่วงที่เลือก (ใช้วาดกราฟแนวโน้ม) — rows ต้องมี date "YYYY-MM-DD"
export function monthlyCounts(rows, months) {
  const counts = new Map(months.map((m) => [m, 0]));
  for (const r of rows) {
    const m = (r.date || "").slice(0, 7);
    if (counts.has(m)) counts.set(m, counts.get(m) + 1);
  }
  return months.map((m) => ({ month: m, count: counts.get(m) }));
}

export function rowsInPeriod(rows, period) {
  return rows.filter((r) => (r.date || "") >= period.start && (r.date || "") <= period.end);
}

// ข้อความเทียบกับช่วงก่อน: tone = good/bad/neutral (lowerIsBetter = ค่าน้อยลงถือว่าดี)
// previous เป็น null/undefined = ช่วงก่อนไม่มีข้อมูลให้เทียบ
export function formatDelta(current, previous, { lowerIsBetter = true } = {}) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return { text: "ไม่มีช่วงก่อนเทียบ", tone: "neutral" };
  }
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { text: "เท่าช่วงก่อน", tone: "neutral" };
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return { text: `${diff > 0 ? "+" : ""}${diff} จากช่วงก่อน`, tone: better ? "good" : "bad" };
}
