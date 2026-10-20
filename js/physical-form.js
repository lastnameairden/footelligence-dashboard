// Physical Test → Testing Form: แบบฟอร์มพิมพ์ A4 แนวนอนหน้าเดียวไว้จดผลระหว่างทดสอบสมรรถภาพ (ตรรกะล้วนๆ + สร้าง HTML เป็นสตริง ไม่พึ่ง DOM/Firebase)
// คอลัมน์ตามรายการทดสอบของรอบ+รุ่นอายุที่เลือก (testsForRound) จำนวนครั้งต่อรายการตาม FITNESS_TESTS แล้วกลับมากรอกที่ Data Entry
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

// ความสูงต่อแถวให้ทั้งตาราง (นักกีฬา + แถวว่าง) พอดีหน้าเดียว — งบความสูงที่เหลือหลังหัวฟอร์ม หัวตาราง 2 แถว และบรรทัดท้าย (มม.)
export const TESTING_TABLE_BUDGET_MM = 132;
export const TESTING_ROW_MM = { min: 3.9, max: 7.5 };
export function testingRowHeightMm(rowCount) {
  const h = TESTING_TABLE_BUDGET_MM / Math.max(rowCount, 1);
  return Math.round(Math.min(TESTING_ROW_MM.max, Math.max(TESTING_ROW_MM.min, h)) * 10) / 10;
}

export const defaultBlankRows = (playerCount) => (playerCount >= 26 ? 2 : 3);

const PICK_TEXT = { max: "สูงสุด", min: "ต่ำสุด" };

// บรรทัดท้ายฟอร์ม: ค่าที่ระบบใช้ของแต่ละรายการหลายครั้ง
export function pickNote(tests) {
  const parts = tests.filter((t) => PICK_TEXT[t.pick]).map((t) => `${t.label} ${PICK_TEXT[t.pick]}`);
  if (tests.some((t) => t.pick === "rsa")) parts.push("RSA คำนวณเที่ยวดีที่สุด/เฉลี่ย/% ที่ช้าลง");
  return parts.length > 0 ? `ค่าที่ระบบใช้: ${parts.join(" · ")}` : "";
}

const cells = (n) => "<td></td>".repeat(n);

export function testingFormHtml({ team, ageGroup, roundText = "", players, tests, blankRows = defaultBlankRows(players.length) }) {
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
  const note = pickNote(tests);
  return `<div class="sheet sheet-form sheet-testing print-sheet" style="--row-h:${rowH}mm">
    <div class="sheet-head"><div class="sheet-brand">${teamLogoImg(team, "sheet-logo")}<div><b>PHYSICAL TEST FORM</b> <span>${escapeHtml(team)} · ${escapeHtml(ageGroup)}${roundText ? ` · ${escapeHtml(roundText)}` : ""}</span></div></div>
      <div class="sheet-vs sheet-row">วันที่ ${fixed(26)} สถานที่ ${fixed(34)} ผู้ทดสอบ ${fixed(34)}</div></div>
    <div class="sheet-fields"><div class="sheet-row"><span>พื้นผิว ${options(SURFACE_OPTIONS)}</span><span>&nbsp; รองเท้า ${options(FOOTWEAR_OPTIONS)}</span></div></div>
    <table class="sheet-table sheet-form-table sheet-testing-table">
      <colgroup><col style="width:6mm"><col style="width:22mm">${tests.map((t) => (t.trials > 1 ? `<col span="${t.trials}">` : `<col style="width:12mm">`)).join("")}<col style="width:26mm"></colgroup>
      <thead><tr><th rowspan="2">#</th><th rowspan="2" class="l">ชื่อเล่น</th>${head1}<th rowspan="2">ไม่ได้ทดสอบ / หมายเหตุ</th></tr><tr>${head2}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="sheet-note">ไม่ได้ทดสอบ: เขียนเหตุผล (บาดเจ็บ / ป่วย / ไม่มา / อื่นๆ) ในช่องท้ายตาราง ช่องว่างคือยังไม่ได้ทดสอบ ไม่ใช่ 0 · ${escapeHtml(note)}</p>
  </div>`;
}
