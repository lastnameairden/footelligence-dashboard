// Physical Test → Testing Form: แบบฟอร์มพิมพ์ A4 แนวตั้งไว้จดผลระหว่างทดสอบสมรรถภาพ (ตรรกะล้วนๆ + สร้าง HTML เป็นสตริง ไม่พึ่ง DOM/Firebase)
// คอลัมน์ตามรายการทดสอบของรอบ+รุ่นอายุที่เลือก (testsForRound) จำนวนครั้งต่อรายการตาม FITNESS_TESTS แล้วกลับมากรอกที่ Data Entry
// รายการทดสอบมากเกินความกว้างกระดาษแนวตั้งจะแบ่งเป็นหลายหน้า (แต่ละหน้ามีรายชื่อนักกีฬาชุดเดิม) ทุกหน้าอยู่ในขอบกระดาษ — ดู @media print ของ .sheet-testing ใน styles.css
import { FOOTWEAR_OPTIONS, SURFACE_OPTIONS, currentEntryRound, roundLabel, roundState } from "./fitness-calc.js";
import { escapeHtml, teamLogoImg } from "./ui-utils.js";

const BOX = "☐";

const STATE_LABELS = { open: "กำลังเปิด", makeup: "ทดสอบซ่อม", upcoming: "ยังไม่เปิด", closed: "ปิดแล้ว" };

// รอบที่ฟอร์มใช้เป็นค่าตั้งต้น: รอบที่เปิดกรอกอยู่ ถ้าไม่มีใช้รอบล่าสุดตามวันเปิด ไม่มีรอบเลย = "" (ทุกรายการของรุ่น)
export function defaultRoundId(rounds, todayStr) {
  const current = currentEntryRound(rounds, todayStr);
  if (current) return current.id;
  return [...rounds].sort((a, b) => String(b.openDate).localeCompare(String(a.openDate)))[0]?.id ?? "";
}

// ตัวเลือกรอบ ใหม่ไปเก่า + ตัวเลือกท้ายสุด "ทุกรายการ" (ไม่ผูกรอบ)
export function roundOptions(rounds, todayStr) {
  const list = [...rounds]
    .sort((a, b) => String(b.openDate).localeCompare(String(a.openDate)))
    .map((r) => ({ id: r.id, label: `${roundLabel(r)} · ${STATE_LABELS[roundState(r, todayStr)] ?? ""}` }));
  list.push({ id: "", label: "ไม่ผูกรอบ (ทุกรายการของรุ่นนี้)" });
  return list;
}

// ---------- เลย์เอาต์กระดาษ A4 แนวตั้ง (พื้นที่พิมพ์ 194 × 281 มม. หลังหักขอบ 8 มม.) ----------
export const PAGE_CONTENT_WIDTH_MM = 194;
const NUMBER_COL_MM = 6;
const NAME_COL_MM = 24;
const REMARK_COL_MM = 24;
const TRIAL_CELL_MM = 7.5; // ช่องจดเวลา/ระยะ 1 ครั้ง (เขียนทศนิยม 2 ตำแหน่งได้)
const SINGLE_CELL_MM = 13; // รายการวัดครั้งเดียว (ส่วนสูง น้ำหนัก ความอดทน)

export const testWidthMm = (t) => (t.trials > 1 ? t.trials * TRIAL_CELL_MM : SINGLE_CELL_MM);

// แบ่งรายการทดสอบเป็นหน้าๆ ตามความกว้างที่เหลือ (เรียงตามลำดับเดิม ไม่ตัดรายการข้ามหน้า) — ไม่มีรายการ = []
export function testingPages(tests) {
  const available = PAGE_CONTENT_WIDTH_MM - NUMBER_COL_MM - NAME_COL_MM - REMARK_COL_MM;
  const pages = [];
  let current = [];
  let used = 0;
  for (const t of tests) {
    const w = testWidthMm(t);
    if (current.length > 0 && used + w > available) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(t);
    used += w;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

// ความสูงต่อแถวให้ทั้งตาราง (นักกีฬา + แถวว่าง) พอดีหน้าเดียวต่อชุดรายการ — งบความสูงที่เหลือหลังหัวฟอร์ม หัวตาราง 2 แถว และบรรทัดท้าย (มม.)
export const TESTING_TABLE_BUDGET_MM = 200;
export const TESTING_ROW_MM = { min: 4.6, max: 8.5 };
export function testingRowHeightMm(rowCount) {
  const h = TESTING_TABLE_BUDGET_MM / Math.max(rowCount, 1);
  return Math.round(Math.min(TESTING_ROW_MM.max, Math.max(TESTING_ROW_MM.min, h)) * 10) / 10;
}

export const defaultBlankRows = (playerCount) => (playerCount >= 28 ? 2 : 3);

const PICK_TEXT = { max: "สูงสุด", min: "ต่ำสุด" };

// บรรทัดท้ายฟอร์ม: ค่าที่ระบบใช้ของแต่ละรายการที่วัดหลายครั้ง
export function pickNote(tests) {
  const parts = tests.filter((t) => PICK_TEXT[t.pick]).map((t) => `${t.label} ${PICK_TEXT[t.pick]}`);
  if (tests.some((t) => t.pick === "rsa")) parts.push("RSA คำนวณเที่ยวดีที่สุด/เฉลี่ย/% ที่ช้าลง");
  return parts.length > 0 ? `ค่าที่ระบบใช้: ${parts.join(" · ")}` : "";
}

const cells = (n) => "<td></td>".repeat(n);

function pageHtml({ team, ageGroup, roundText, players, tests, blankRows, pageNo, pageCount, allTests }) {
  const fixed = (w) => `<span class="sheet-line" style="width:${w}mm"></span>`;
  const options = (list) => list.map((o) => `${BOX} ${escapeHtml(o)}`).join(" ");
  const trialCells = tests.reduce((n, t) => n + Math.max(t.trials, 1), 0);
  const head1 = tests
    .map((t) => {
      const unit = `<br><span class="sheet-sub">${escapeHtml(t.unit)}</span>`;
      return t.trials > 1 ? `<th colspan="${t.trials}">${escapeHtml(t.label)}${unit}</th>` : `<th rowspan="2">${escapeHtml(t.label)}${unit}</th>`;
    })
    .join("");
  const head2 = tests
    .filter((t) => t.trials > 1)
    .map((t) => Array.from({ length: t.trials }, (_, i) => `<th>${i + 1}</th>`).join(""))
    .join("");
  const row = (p) => `<tr><td>${escapeHtml(p?.number ?? "")}</td><td class="l">${escapeHtml(p?.nickname ?? "")}</td>${cells(trialCells)}<td></td></tr>`;
  const body = players.map(row).join("") + Array.from({ length: blankRows }, () => '<tr class="sheet-blank"><td></td><td class="l"></td>' + cells(trialCells) + "<td></td></tr>").join("");
  const rowH = testingRowHeightMm(players.length + blankRows);
  const cols = `<col style="width:${NUMBER_COL_MM}mm"><col style="width:${NAME_COL_MM}mm">${tests.map((t) => (t.trials > 1 ? `<col span="${t.trials}" style="width:${TRIAL_CELL_MM}mm">` : `<col style="width:${SINGLE_CELL_MM}mm">`)).join("")}<col>`;
  const note = pickNote(allTests);
  const pageLabel = pageCount > 1 ? ` <span class="sheet-page-no">หน้า ${pageNo}/${pageCount}</span>` : "";
  return `<div class="sheet sheet-testing print-sheet" style="--row-h:${rowH}mm">
    <div class="sheet-head"><div class="sheet-brand">${teamLogoImg(team, "sheet-logo")}<div><b>PHYSICAL TEST FORM</b> <span>${escapeHtml(team)} · ${escapeHtml(ageGroup)}${roundText ? ` · ${escapeHtml(roundText)}` : ""}</span>${pageLabel}</div></div></div>
    <div class="sheet-fields">
      <div class="sheet-row">วันที่ ${fixed(26)} สถานที่ ${fixed(40)} ผู้ทดสอบ ${fixed(40)}</div>
      <div class="sheet-row"><span>พื้นผิว ${options(SURFACE_OPTIONS)}</span><span>&nbsp; รองเท้า ${options(FOOTWEAR_OPTIONS)}</span></div>
    </div>
    <table class="sheet-table sheet-testing-table">
      <colgroup>${cols}</colgroup>
      <thead><tr><th rowspan="2">#</th><th rowspan="2" class="l">ชื่อเล่น</th>${head1}<th rowspan="2">ไม่ได้ทดสอบ / หมายเหตุ</th></tr><tr>${head2}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="sheet-note">ไม่ได้ทดสอบ: เขียนเหตุผล (บาดเจ็บ / ป่วย / ไม่มา / อื่นๆ) ในช่องท้ายตาราง ช่องว่างคือยังไม่ได้ทดสอบ ไม่ใช่ 0${note ? ` · ${escapeHtml(note)}` : ""}</p>
  </div>`;
}

// ฟอร์มทั้งชุด: 1 กระดาษ (A4 แนวตั้ง) ต่อชุดรายการทดสอบ — ทุกหน้ามีรายชื่อนักกีฬาเหมือนกัน
export function testingFormHtml({ team, ageGroup, roundText = "", players, tests, blankRows = defaultBlankRows(players.length) }) {
  const pages = testingPages(tests);
  return pages.map((pageTests, i) => pageHtml({ team, ageGroup, roundText, players, tests: pageTests, blankRows, pageNo: i + 1, pageCount: pages.length, allTests: tests })).join("");
}
