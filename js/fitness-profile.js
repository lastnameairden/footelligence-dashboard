// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ของการแสดงผลสมรรถภาพรายบุคคล: ผลทดสอบทุกรอบ ลูกศรพัฒนาการ COD Deficit ช่วงการเติบโต
// ใช้ร่วมกันทั้งหน้านักกีฬา (โค้ช/ผู้บริหาร/แอดมิน) และสมุดพกผู้ปกครอง — ค่าที่คำนวณทั้งหมดคำนวณตอนแสดง ไม่เก็บลงฐานข้อมูล
// (ระดับเทียบรุ่น 5 ขั้นและเปอร์เซ็นไทล์ ยังไม่ทำ: ต้องมีข้อมูลของทั้งเครือข่ายก่อน ดู mockup ข้อ 1.5)
import { FITNESS_TEST_BY_CODE, resultValue, roundLabel } from "./fitness-calc.js";

// ความคลาดเคลื่อนของการวัด: เปลี่ยนไม่เกินค่านี้ถือว่า "คงที่" (ไม่ขึ้นลูกศร) — ค่าตั้งต้น ควรให้ Fitness Coach ตรวจและปรับ แก้ที่นี่ที่เดียว
export const TREND_TOLERANCE = {
  broad_jump: 5,
  cmj: 1.5,
  sprint_10: 0.03,
  sprint_30: 0.05,
  cod_505_l: 0.05,
  cod_505_r: 0.05,
  rsa_6x30: 0.1,
  yoyo_ir1c: 40,
  ift_3015: 0.5
};
// รายการที่ค่ามาก = ดี (กระโดด/ความอดทน) — นอกนั้นค่าน้อย = ดี (เวลา) ส่วนสูง/น้ำหนักไม่มีลูกศร (ดูอัตราการโตแทน)
export const HIGHER_IS_BETTER = { broad_jump: true, cmj: true, yoyo_ir1c: true, ift_3015: true };
export const NO_TREND_CODES = ["height", "sitting_height", "weight"];

// ค่าเดียวที่ใช้เทียบ (RSA ใช้เที่ยวที่ดีที่สุด) — null = ไม่มีค่า
export function usedNumber(test, trials) {
  const v = resultValue(test, trials);
  if (v === null) return null;
  return test.pick === "rsa" ? v.best : v;
}

// เทียบค่าปัจจุบันกับรอบก่อน: "better" | "same" | "lower" (ลดลงเกินความคลาดเคลื่อน) | null (เทียบไม่ได้/ไม่มีลูกศรสำหรับรายการนี้)
export function trendBetween(code, current, previous) {
  if (NO_TREND_CODES.includes(code) || current === null || current === undefined || previous === null || previous === undefined) return null;
  const tol = TREND_TOLERANCE[code];
  if (tol === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) <= tol + 1e-9) return "same";
  const better = HIGHER_IS_BETTER[code] ? diff > 0 : diff < 0;
  return better ? "better" : "lower";
}

// ค่าก่อนหน้าของรายการนั้นที่ใกล้ที่สุดก่อนตำแหน่ง beforeIndex ในชุดผลรายรอบ — รอบ Selective (Monitoring) ไม่มี COD/ความอดทน จึงเทียบข้ามไปยังรอบที่เคยวัดรายการนั้นล่าสุด
// คืน { value, label } (label = ชื่อรอบที่ใช้เทียบ) หรือ null ถ้าไม่เคยวัดมาก่อน
export function previousValue(series, code, beforeIndex) {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const v = series[i].values[code];
    if (v !== null && v !== undefined) return { value: v, label: series[i].label };
  }
  return null;
}

// ชุดผลรายรอบของนักกีฬาคนหนึ่ง เรียงจากรอบเก่าไปใหม่ — เฉพาะรอบที่มีผลอย่างน้อยหนึ่งค่า (ไม่นับรอบที่ระบุว่าไม่ได้ทดสอบทั้งรอบ)
// rounds = fitnessRounds [{ id, ... }], results = fitnessResults ของนักกีฬาคนนี้ [{ roundId, testDate, tests, notTested }]
export function buildFitnessSeries(rounds, results) {
  const byRound = new Map(results.map((r) => [r.roundId, r]));
  return rounds
    .filter((r) => byRound.has(r.id))
    .sort((a, b) => (a.openDate || "").localeCompare(b.openDate || ""))
    .map((round) => {
      const result = byRound.get(round.id);
      const values = {};
      for (const [code, test] of Object.entries(FITNESS_TEST_BY_CODE)) {
        values[code] = usedNumber(test, result.tests?.[code]?.trials);
      }
      return { round, label: roundLabel(round), date: result.testDate || round.openDate, values, trials: result.tests || {}, notTested: result.notTested || null };
    })
    .filter((p) => !p.notTested && Object.values(p.values).some((v) => v !== null));
}

// COD Deficit = เวลา 505 − เวลา Sprint 10 ม. (ของรอบเดียวกัน) แยกซ้าย/ขวา + ความต่างซ้าย-ขวา (สัญญาณความไม่สมดุลของขา)
export function codDeficit(values) {
  const sprint = values?.sprint_10 ?? null;
  const side = (code) => (sprint !== null && values?.[code] != null ? values[code] - sprint : null);
  const left = side("cod_505_l");
  const right = side("cod_505_r");
  const asymmetry = values?.cod_505_l != null && values?.cod_505_r != null ? Math.abs(values.cod_505_l - values.cod_505_r) : null;
  return { left, right, asymmetry };
}
export const COD_ASYMMETRY_NOTE_THRESHOLD = 0.1; // วินาที — ต่างกันเกินนี้ให้ขึ้นข้อสังเกต

// ---------- การเติบโต ----------
const DAY_MS = 86400000;
const toUtc = (d) => {
  const [y, m, day] = String(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

// อายุทศนิยม (ปี) ณ วันที่ — ต้องมีวันเกิดเต็ม
export function ageAt(birthday, dateStr) {
  if (!birthday || !dateStr) return null;
  const days = (toUtc(dateStr) - toUtc(birthday)) / DAY_MS;
  return Number.isFinite(days) && days > 0 ? days / 365.25 : null;
}

// อัตราการเพิ่มของส่วนสูง (ซม./ปี) ระหว่างสองรอบล่าสุดที่มีส่วนสูงและห่างกันอย่างน้อย 45 วัน — เป็นค่าที่วัดจริง ไม่ผ่านสูตร จึงใช้เป็นสัญญาณหลักของ "กำลังโตเร็ว"
export function heightVelocity(series) {
  const pts = series.filter((p) => p.values.height != null && p.date);
  if (pts.length < 2) return null;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const days = (toUtc(b.date) - toUtc(a.date)) / DAY_MS;
  if (days < 45) return null;
  return ((b.values.height - a.values.height) / days) * 365.25;
}

// Maturity offset (ปีจากช่วงโตเร็วสูงสุด) สมการของ Mirwald และคณะ (2002) สำหรับ "เด็กชาย" — ใช้ได้กับอายุราว 8–18 ปี ความคลาดเคลื่อนราว ±1 ปี
// และไวต่อส่วนสูงนั่งมาก (วัดครั้งเดียว) จึงใช้เป็นช่วงประมาณเท่านั้น ไม่ใช่ตัวเลขเป๊ะ — ไม่คำนวณให้เด็กหญิง/ไม่ระบุเพศ (ยังไม่ได้ใส่สมการที่ตรวจสอบแล้ว)
export function mirwaldOffsetMale({ age, height, sitting, weight }) {
  if ([age, height, sitting, weight].some((x) => typeof x !== "number" || !Number.isFinite(x))) return null;
  if (age < 8 || age > 18 || height <= sitting) return null;
  const leg = height - sitting;
  return (
    -9.236 +
    0.0002708 * (leg * sitting) -
    0.001663 * (age * leg) +
    0.007216 * (age * sitting) +
    0.02292 * ((weight / height) * 100)
  );
}

export const RAPID_GROWTH_VELOCITY = 7; // ซม./ปี — เร็วกว่านี้ถือว่ากำลังโตเร็ว (ช่วงพีคของเด็กชายราว 8–10 ซม./ปี)

export const GROWTH_LABELS = {
  pre: "ก่อนช่วงโตเร็ว",
  circa: "กำลังเข้าสู่ช่วงโตเร็ว",
  rapid: "กำลังอยู่ในช่วงโตเร็ว",
  post: "ผ่านช่วงโตเร็วแล้ว"
};

// คำอธิบายภาษาง่ายสำหรับผู้ปกครอง (ไม่แสดงตัวเลข offset หรืออัตราการโต)
export const GROWTH_PARENT_TEXT = {
  pre: "ร่างกายยังไม่เข้าสู่ช่วงโตเร็ว การฝึกเน้นทักษะและการเคลื่อนไหวพื้นฐานจะได้ผลดี",
  circa: "ร่างกายกำลังจะเข้าสู่ช่วงโตเร็ว โค้ชจะติดตามและปรับน้ำหนักการฝึกให้เหมาะสม",
  rapid:
    "ร่างกายกำลังเติบโตเร็ว ช่วงนี้การทรงตัวและการประสานงานของร่างกายอาจแปรปรวนชั่วคราว และผลทดสอบบางรายการอาจไม่ขึ้นตามความตั้งใจ ซึ่งเป็นเรื่องปกติของวัยนี้ โค้ชจะปรับการฝึกให้เหมาะกับช่วงนี้",
  post: "ผ่านช่วงโตเร็วที่สุดมาแล้ว ร่างกายเริ่มคงที่และสร้างความแข็งแรงต่อได้เต็มที่"
};

// สถานะช่วงการเติบโต: ถ้าส่วนสูงเพิ่มเร็ว (วัดจริง) = "rapid" ก่อนเสมอ ไม่งั้นดูจาก offset (เด็กชายที่มีข้อมูลครบ) — ไม่มีข้อมูลพอ = key เป็น null
export function growthStatus({ player, series }) {
  const velocity = heightVelocity(series);
  let offset = null;
  if (player?.sex === "ชาย") {
    const latest = [...series].reverse().find((p) => p.values.height != null && p.values.sitting_height != null && p.values.weight != null);
    if (latest) {
      offset = mirwaldOffsetMale({
        age: ageAt(player.birthday, latest.date),
        height: latest.values.height,
        sitting: latest.values.sitting_height,
        weight: latest.values.weight
      });
    }
  }
  let key = null;
  if (velocity !== null && velocity >= RAPID_GROWTH_VELOCITY) key = "rapid";
  else if (offset !== null) key = offset < -1 ? "pre" : offset <= 1 ? "circa" : "post";
  return { key, velocity, offset };
}

// ---------- สรุปจากโค้ชฟิตเนสในสมุดพก: ข้อความสำเร็จรูปให้เลือก (แก้เป็นรายคนได้) ----------
export const FITNESS_SUMMARY_PRESETS = {
  strength: [
    "แรงส่งและพลังขาดีขึ้นต่อเนื่อง",
    "ความเร็วเส้นตรงดีขึ้นชัดเจน",
    "ความอดทนแอโรบิกอยู่ในเกณฑ์ดี",
    "มีวินัยและตั้งใจทดสอบทุกรายการ"
  ],
  improve: [
    "ความคล่องตัวในการเปลี่ยนทิศทางและการเบรกก่อนกลับตัว",
    "พลังขาในการกระโดดและออกตัว",
    "ความอดทนในการวิ่งซ้ำความเร็วสูง",
    "ความยืดหยุ่นและความสมดุลของขาสองข้าง"
  ],
  home: [
    "ยืดเหยียดกล้ามเนื้อขาหลังและน่อง 10 นาทีหลังอาบน้ำ",
    "นอนให้พอ 9–10 ชั่วโมงต่อคืน",
    "ดื่มน้ำให้พอและกินโปรตีนครบทุกมื้อ",
    "เล่นกีฬาอื่นหรือวิ่งเล่นกลางแจ้งสัปดาห์ละ 2–3 ครั้ง"
  ]
};
