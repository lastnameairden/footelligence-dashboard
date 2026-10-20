// เนื้อหาหน้า Physical Test → Instruction: ชื่อ วิธีทดสอบ อุปกรณ์ รูป และลิงก์วิดีโอของแต่ละรายการทดสอบสมรรถภาพ (รายการตรงกับ FITNESS_TESTS ใน fitness-calc.js)
// ข้อความเป็นฉบับร่างตามวิธีมาตรฐานสากล รอผู้ดูแลตรวจแก้ — ใส่รูปและวิดีโอได้โดยกรอก imageUrl / videoUrl ของรายการนั้น (ว่าง = แสดง "รอเพิ่ม")
// imageUrl รับลิงก์ https หรือไฟล์ในโปรเจกต์ที่ขึ้นต้นด้วย "assets/" (เช่น "assets/physical/broad-jump.jpg")
import { FITNESS_TESTS } from "./fitness-calc.js";
import { escapeHtml, safeHttpUrl } from "./ui-utils.js";

export const PHYSICAL_TEST_CONTENT = {
  height: {
    name: "Standing height · ส่วนสูงยืน",
    purpose: "ติดตามการเติบโตของนักกีฬา",
    equipment: ["แผ่นวัดส่วนสูงติดผนัง หรือเครื่องวัดส่วนสูง (stadiometer)", "แผ่นไม้ฉากวางบนศีรษะ"],
    steps: [
      "ถอดรองเท้าและถุงเท้า ยืนตัวตรงให้ส้นเท้า สะโพก หลัง และศีรษะชิดผนัง",
      "มองตรงไปข้างหน้า คางขนานพื้น ขาสองข้างชิดกัน",
      "ผู้วัดวางแผ่นฉากราบบนศีรษะ ให้ผมไม่ดันแผ่น แล้วอ่านค่าเป็น ซม. (ทศนิยม 1 ตำแหน่ง)",
      "วัดครั้งเดียว ถ้าสงสัยให้วัดซ้ำแล้วจดค่าที่ถูกต้อง"
    ],
    tips: ["วัดช่วงเวลาเดียวกันทุกรอบ (ก่อนซ้อม)"],
    imageUrl: null,
    videoUrl: null
  },
  sitting_height: {
    name: "Sitting height · ส่วนสูงนั่ง",
    purpose: "ใช้ประเมินช่วงเวลาการเติบโต (ร่วมกับส่วนสูงยืน)",
    equipment: ["ม้านั่งหรือกล่องแข็งที่พื้นเรียบ", "แผ่นวัดส่วนสูงติดผนัง"],
    steps: [
      "ให้นักกีฬานั่งบนม้านั่ง หลังและสะโพกชิดผนัง ต้นขาขนานพื้น",
      "เข่างอประมาณ 90 องศา มองตรงไปข้างหน้า คางขนานพื้น",
      "วางแผ่นฉากบนศีรษะ แล้ววัดจากพื้นที่นั่งถึงกระหม่อม จดค่าเป็น ซม. (ทศนิยม 1 ตำแหน่ง)"
    ],
    tips: ["ใช้ม้านั่งตัวเดิมทุกครั้ง"],
    imageUrl: null,
    videoUrl: null
  },
  weight: {
    name: "Body weight · น้ำหนัก",
    purpose: "ติดตามการเปลี่ยนแปลงของร่างกาย",
    equipment: ["เครื่องชั่งน้ำหนักดิจิทัล"],
    steps: [
      "สวมชุดซ้อมเบา ถอดรองเท้า วางเครื่องชั่งบนพื้นแข็งเรียบ",
      "ยืนนิ่งกลางเครื่อง สองเท้าลงน้ำหนักเท่ากัน อ่านค่าเป็น กก. (ทศนิยม 1 ตำแหน่ง)"
    ],
    tips: ["ชั่งช่วงเวลาเดียวกันทุกรอบ เช่น ก่อนซ้อม"],
    imageUrl: null,
    videoUrl: null
  },
  broad_jump: {
    name: "Standing broad jump · กระโดดไกล",
    purpose: "วัดพลังของขาในแนวราบ",
    equipment: ["ตลับเมตรยาวอย่างน้อย 3 เมตร", "เทปติดพื้นสำหรับทำเส้นเริ่ม"],
    steps: [
      "ยืนสองเท้าห่างกันประมาณความกว้างของไหล่ ปลายเท้าอยู่หลังเส้นเริ่ม",
      "ย่อเข่า แกว่งแขนไปด้านหลัง แล้วกระโดดไปข้างหน้าให้ไกลที่สุด",
      "ลงพื้นด้วยสองเท้าพร้อมกันและทรงตัวนิ่ง (ถ้าล้มหรือใช้มือยัน ให้ทำใหม่)",
      "วัดจากเส้นเริ่มถึงส้นเท้าหลังสุดที่แตะพื้น จดเป็น ซม."
    ],
    tips: ["ทำ 3 ครั้ง พักระหว่างครั้ง 1–2 นาที ระบบใช้ค่าที่ไกลที่สุด"],
    imageUrl: null,
    videoUrl: null
  },
  cmj: {
    name: "Countermovement jump (CMJ) · กระโดดสูง",
    purpose: "วัดพลังของขาในแนวดิ่ง",
    equipment: ["แผ่นวัดการกระโดด (jump mat) หรืออุปกรณ์/แอปวัดความสูงกระโดดที่ทีมใช้"],
    steps: [
      "ยืนตัวตรงบนแผ่นวัด สองมือเท้าเอว (ไม่แกว่งแขน)",
      "ย่อตัวลงเร็วๆ แล้วกระโดดขึ้นสูงที่สุดทันที",
      "ขณะอยู่กลางอากาศให้ขาเหยียดตรง ลงพื้นที่เดิมด้วยปลายเท้าแล้วงอเข่ารับแรง",
      "จดความสูงเป็น ซม. (ทศนิยม 1 ตำแหน่ง)"
    ],
    tips: ["ทำ 3 ครั้ง พักระหว่างครั้ง 30–60 วินาที ระบบใช้ค่าที่สูงที่สุด"],
    imageUrl: null,
    videoUrl: null
  },
  sprint_10: {
    name: "Sprint 10 m · วิ่งเร็ว 10 เมตร",
    purpose: "วัดอัตราเร่ง",
    equipment: ["ประตูจับเวลาเซลล์แสง (timing gates) หรือนาฬิกาจับเวลา", "กรวย/เทปมาร์กเส้นเริ่มและเส้น 10 เมตร"],
    steps: [
      "ยืนเท้าหน้าอยู่หลังเส้นเริ่มประมาณ 30–50 ซม. (ออกตัวจากท่ายืน)",
      "ออกวิ่งด้วยความเร็วสูงสุดเมื่อพร้อม จนผ่านเส้น 10 เมตร",
      "จดเวลาเป็นวินาที (ทศนิยม 2 ตำแหน่ง)"
    ],
    tips: ["ทำ 3 ครั้ง พักระหว่างครั้ง 2–3 นาที ระบบใช้ค่าที่เร็วที่สุด", "ใช้รองเท้าและพื้นผิวเดียวกันทุกรอบ (บันทึกในช่อง สภาพการทดสอบ)"],
    imageUrl: null,
    videoUrl: null
  },
  sprint_30: {
    name: "Sprint 30 m · วิ่งเร็ว 30 เมตร",
    purpose: "วัดความเร็วสูงสุด",
    equipment: ["ประตูจับเวลาเซลล์แสง หรือนาฬิกาจับเวลา", "กรวย/เทปมาร์กเส้นเริ่มและเส้น 30 เมตร"],
    steps: [
      "ยืนเท้าหน้าอยู่หลังเส้นเริ่มประมาณ 30–50 ซม.",
      "ออกวิ่งด้วยความเร็วสูงสุด ผ่านเส้น 30 เมตรโดยไม่ชะลอก่อนถึงเส้น (ให้วิ่งต่ออีกอย่างน้อย 5 เมตร)",
      "จดเวลาเป็นวินาที (ทศนิยม 2 ตำแหน่ง)"
    ],
    tips: ["ทำ 3 ครั้ง พักระหว่างครั้ง 2–3 นาที ระบบใช้ค่าที่เร็วที่สุด"],
    imageUrl: null,
    videoUrl: null
  },
  cod_505_l: {
    name: "505 agility test (left) · วิ่งกลับตัว 505 เท้าซ้าย",
    purpose: "วัดความสามารถในการเปลี่ยนทิศทาง (เท้าซ้ายเป็นเท้าหมุน)",
    equipment: ["ประตูจับเวลาหรือนาฬิกาจับเวลา", "กรวย/เทปมาร์กเส้น 0 เมตร เส้น 10 เมตร และเส้นกลับตัว 15 เมตร"],
    steps: [
      "ออกวิ่งจากเส้น 0 ด้วยความเร็วสูงสุดผ่านเส้น 10 เมตร (เริ่มจับเวลาที่เส้นนี้)",
      "วิ่งต่อไปแตะเส้น 15 เมตรด้วยเท้าซ้าย แล้วหมุนตัวกลับให้เร็วที่สุด",
      "วิ่งกลับผ่านเส้น 10 เมตร หยุดเวลา (ระยะที่จับเวลารวม 10 เมตร: 5 ไป 5 กลับ)",
      "จดเวลาเป็นวินาที (ทศนิยม 2 ตำแหน่ง)"
    ],
    tips: ["ทำ 2 ครั้ง ระบบใช้ค่าที่เร็วที่สุด ถ้าเท้าไม่แตะเส้นกลับตัวให้ทำใหม่"],
    imageUrl: null,
    videoUrl: null
  },
  cod_505_r: {
    name: "505 agility test (right) · วิ่งกลับตัว 505 เท้าขวา",
    purpose: "วัดความสามารถในการเปลี่ยนทิศทาง (เท้าขวาเป็นเท้าหมุน)",
    equipment: ["ประตูจับเวลาหรือนาฬิกาจับเวลา", "กรวย/เทปมาร์กเส้น 0 เมตร เส้น 10 เมตร และเส้นกลับตัว 15 เมตร"],
    steps: [
      "ออกวิ่งจากเส้น 0 ด้วยความเร็วสูงสุดผ่านเส้น 10 เมตร (เริ่มจับเวลาที่เส้นนี้)",
      "วิ่งต่อไปแตะเส้น 15 เมตรด้วยเท้าขวา แล้วหมุนตัวกลับให้เร็วที่สุด",
      "วิ่งกลับผ่านเส้น 10 เมตร หยุดเวลา",
      "จดเวลาเป็นวินาที (ทศนิยม 2 ตำแหน่ง)"
    ],
    tips: ["ทำ 2 ครั้ง ระบบใช้ค่าที่เร็วที่สุด ทำข้างซ้ายและขวาในเงื่อนไขเดียวกัน"],
    imageUrl: null,
    videoUrl: null
  },
  rsa_6x30: {
    name: "Repeated sprint ability (RSA) 6×30 m · วิ่งเร็วซ้ำ 6×30 เมตร",
    purpose: "วัดความสามารถในการวิ่งเร็วซ้ำๆ และการฟื้นตัวระหว่างเที่ยว",
    equipment: ["ประตูจับเวลาเซลล์แสง หรือนาฬิกาจับเวลา", "กรวยมาร์กเส้นเริ่มและเส้น 30 เมตร"],
    steps: [
      "วิ่งเร็วที่สุด 30 เมตร แล้วเดินหรือจ็อกกิ้งเบาๆ กลับมาที่เส้นเริ่ม",
      "พักรวม 20 วินาทีต่อเที่ยว แล้วออกวิ่งเที่ยวถัดไป ทำทั้งหมด 6 เที่ยว",
      "จดเวลาทั้ง 6 เที่ยว (วินาที ทศนิยม 2 ตำแหน่ง)"
    ],
    tips: ["ระบบคำนวณเที่ยวที่ดีที่สุด เวลาเฉลี่ย และ % ที่ช้าลงให้เอง"],
    imageUrl: null,
    videoUrl: null
  },
  yoyo_ir1c: {
    name: "Yo-Yo IR1C · ทดสอบความอดทนแบบ Yo-Yo (เด็ก)",
    purpose: "วัดความอดทนแบบสลับวิ่งและพัก (รุ่นเยาว์)",
    equipment: ["เสียงสัญญาณ Yo-Yo IR1C (ไฟล์เสียงมาตรฐาน)", "กรวยมาร์กเส้นระยะ 20 เมตร และโซนพัก 5 เมตร"],
    steps: [
      "วิ่งกลับตัวระยะ 20 เมตรตามจังหวะเสียงสัญญาณที่เร็วขึ้นเรื่อยๆ",
      "หลังครบรอบไป–กลับ 40 เมตร พักเดินเบา 10 วินาทีในโซนพัก",
      "ถ้าตามเสียงไม่ทันครั้งแรกให้เตือน ครั้งที่สองให้หยุดการทดสอบ",
      "จดระยะรวมที่วิ่งได้เป็น เมตร"
    ],
    tips: ["ทดสอบเป็นกลุ่มบนพื้นผิวเดียวกัน ให้นักกีฬาทุกคนวอร์มอัพก่อน"],
    imageUrl: null,
    videoUrl: null
  },
  ift_3015: {
    name: "30-15 IFT · ทดสอบความอดทนแบบ 30-15",
    purpose: "วัดความอดทนแบบสลับวิ่งและพัก ได้ค่าความเร็ว V_IFT",
    equipment: ["เสียงสัญญาณ 30-15 IFT (ไฟล์เสียงมาตรฐาน)", "สนามมาร์ก 40 เมตร พร้อมโซนกลับตัว"],
    steps: [
      "วิ่งกลับตัวไปมาระยะ 40 เมตรตามจังหวะเสียง เป็นเวลา 30 วินาที แล้วเดินพัก 15 วินาที",
      "ความเร็วเริ่มที่ 8 กม./ชม. และเพิ่มขึ้น 0.5 กม./ชม. ทุกช่วง",
      "หยุดเมื่อตามเสียงไม่ทันติดต่อกัน 3 ครั้ง หรือถึงช่วงที่วิ่งต่อไม่ไหว",
      "จดความเร็วของช่วงสุดท้ายที่วิ่งจบ (V_IFT กม./ชม.)"
    ],
    tips: ["ทดสอบเป็นกลุ่มบนพื้นผิวเดียวกัน ให้นักกีฬาทุกคนวอร์มอัพก่อน"],
    imageUrl: null,
    videoUrl: null
  }
};

// รูปจากลิงก์ https หรือไฟล์ในโปรเจกต์ (assets/...) เท่านั้น — คืนค่าที่ escape แล้ว (เหมือน safeHttpUrl) พร้อมใส่ใน attribute
export function safeImageSrc(url) {
  const s = String(url ?? "").trim();
  if (/^assets\/[\w\-./]+$/.test(s) && !s.includes("..")) return escapeHtml(s);
  return safeHttpUrl(s);
}

const ageRange = (t) => (t.minAge === t.maxAge ? `U${t.minAge}` : `U${t.minAge}–U${t.maxAge}`);
const PICK_LABELS = { single: "วัดครั้งเดียว", max: "ใช้ค่าสูงสุด", min: "ใช้ค่าต่ำสุด", rsa: "คำนวณเที่ยวดีที่สุด/เฉลี่ย/% ที่ช้าลง" };

function listHtml(items) {
  return `<ul class="list-disc pl-5 space-y-0.5">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

// การ์ดคำอธิบายของรายการทดสอบ test (ตัวอ็อบเจ็กต์จาก FITNESS_TESTS) — ไม่มีเนื้อหา = แสดงเฉพาะชื่อและเกณฑ์
export function instructionCardHtml(test, content = PHYSICAL_TEST_CONTENT[test.code]) {
  const c = content || {};
  const trials = test.trials > 1 ? `${test.trials} ครั้ง · ` : "";
  const meta = `${ageRange(test)} · ${trials}${PICK_LABELS[test.pick] ?? ""} · หน่วย ${escapeHtml(test.unit)}`;
  const img = safeImageSrc(c.imageUrl);
  const video = safeHttpUrl(c.videoUrl);
  const media = img
    ? `<img src="${img}" alt="${escapeHtml(c.name ?? test.label)}" class="instruction-img" loading="lazy" />`
    : '<div class="instruction-img instruction-img-empty">รูปการทดสอบ · รอเพิ่ม</div>';
  const videoHtml = video
    ? `<a href="${video}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">ดูวิดีโอการทดสอบ ↗</a>`
    : '<span class="text-slate-400">วิดีโอ · รอเพิ่ม</span>';
  return `<article class="card card-pad instruction-card" data-test="${escapeHtml(test.code)}">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <h3 class="section-title">${escapeHtml(c.name ?? test.label)}</h3>
      <span class="badge badge-neutral">${meta}</span>
    </div>
    ${c.purpose ? `<p class="text-sm text-slate-500 mt-1">${escapeHtml(c.purpose)}</p>` : ""}
    <div class="instruction-grid mt-3">
      ${media}
      <div class="space-y-2 text-sm">
        ${c.equipment ? `<div><p class="font-semibold">อุปกรณ์</p>${listHtml(c.equipment)}</div>` : ""}
        ${c.steps ? `<div><p class="font-semibold">วิธีทดสอบ</p><ol class="list-decimal pl-5 space-y-0.5">${c.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol></div>` : ""}
        ${c.tips && c.tips.length ? `<div><p class="font-semibold">ข้อควรระวัง</p>${listHtml(c.tips)}</div>` : ""}
        <p>${videoHtml}</p>
      </div>
    </div>
  </article>`;
}

// ทุกรายการทดสอบเรียงตาม FITNESS_TESTS (ถ้าระบุ ageGroup จะแสดงเฉพาะรายการที่ทดสอบในรุ่นนั้น)
export function instructionsHtml(ageGroupNumber = null) {
  const tests = FITNESS_TESTS.filter((t) => ageGroupNumber === null || (ageGroupNumber >= t.minAge && ageGroupNumber <= t.maxAge));
  if (tests.length === 0) return '<div class="card card-pad text-center text-slate-500">ไม่มีรายการทดสอบสำหรับรุ่นอายุนี้</div>';
  return tests.map((t) => instructionCardHtml(t)).join("");
}
