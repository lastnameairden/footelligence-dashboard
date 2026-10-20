import { test } from "node:test";
import assert from "node:assert/strict";
import { FITNESS_TESTS, testsForRound } from "../js/fitness-calc.js";
import { PHYSICAL_TEST_CONTENT, instructionCardHtml, instructionsHtml, safeImageSrc } from "../js/physical-test-content.js";
import { PAGE_CONTENT_WIDTH_MM, TESTING_ROW_MM, defaultBlankRows, defaultRoundId, pickNote, roundOptions, testWidthMm, testingFormHtml, testingPages, testingRowHeightMm } from "../js/physical-form.js";

const rounds = [
  { id: "r1", roundType: "baseline", openDate: "2026-05-17", closeDate: "2026-05-30", makeupUntil: "2026-06-13", mode: "full" },
  { id: "r2", roundType: "monitoring", openDate: "2026-08-09", closeDate: "2026-08-22", makeupUntil: "2026-09-05", mode: "selective" },
  { id: "r3", roundType: "reeval", openDate: "2026-11-08", closeDate: "2026-11-21", makeupUntil: "2026-12-05", mode: "full" }
];

test("every fitness test has instruction content with equipment, steps and an empty media slot", () => {
  for (const t of FITNESS_TESTS) {
    const c = PHYSICAL_TEST_CONTENT[t.code];
    assert.ok(c, t.code);
    assert.ok(c.name && c.equipment.length > 0 && c.steps.length > 0, t.code);
  }
  assert.deepEqual(Object.keys(PHYSICAL_TEST_CONTENT).sort(), FITNESS_TESTS.map((t) => t.code).sort());
});

test("instruction card: age range, trial rule, placeholders when there is no image or video, and real media when given", () => {
  const broad = FITNESS_TESTS.find((t) => t.code === "broad_jump");
  const html = instructionCardHtml(broad);
  assert.match(html, /U10–U18/);
  assert.match(html, /3 ครั้ง · ใช้ค่าสูงสุด/);
  assert.match(html, /รูปการทดสอบ · รอเพิ่ม/);
  assert.match(html, /วิดีโอ · รอเพิ่ม/);
  const withMedia = instructionCardHtml(broad, { ...PHYSICAL_TEST_CONTENT.broad_jump, imageUrl: "assets/physical/bj.jpg", videoUrl: "https://youtu.be/abc?x=1&y=2" });
  assert.match(withMedia, /<img src="assets\/physical\/bj\.jpg"/);
  assert.match(withMedia, /href="https:\/\/youtu\.be\/abc\?x=1&amp;y=2"/);
  assert.ok(!withMedia.includes("รอเพิ่ม"));
});

test("safeImageSrc accepts https and assets/ paths only; the instruction page filters by age", () => {
  assert.equal(safeImageSrc("javascript:alert(1)"), "");
  assert.equal(safeImageSrc("assets/../secret.png"), "");
  assert.equal(safeImageSrc("assets/physical/a.png"), "assets/physical/a.png");
  assert.equal(safeImageSrc("https://x.com/a.png"), "https://x.com/a.png");
  assert.equal((instructionsHtml().match(/instruction-card/g) || []).length, FITNESS_TESTS.length);
  const u11 = instructionsHtml(11);
  assert.ok(u11.includes('data-test="broad_jump"') && !u11.includes('data-test="cmj"') && !u11.includes('data-test="rsa_6x30"'));
  assert.match(instructionsHtml(30), /ไม่มีรายการทดสอบ/);
});

test("defaultRoundId prefers the open round, then the latest, then none; options end with the no-round choice", () => {
  assert.equal(defaultRoundId(rounds, "2026-08-10"), "r2");
  assert.equal(defaultRoundId(rounds, "2026-10-01"), "r3", "latest by open date when nothing is open");
  assert.equal(defaultRoundId([], "2026-10-01"), "");
  const options = roundOptions(rounds, "2026-08-10");
  assert.deepEqual(options.map((o) => o.id), ["r3", "r2", "r1", ""]);
  assert.match(options[1].label, /กำลังเปิด/);
  assert.match(options[0].label, /ยังไม่เปิด/);
  assert.match(options[2].label, /ปิดแล้ว/);
});

test("row height shrinks with more rows but stays within the printable limits", () => {
  assert.equal(testingRowHeightMm(10), TESTING_ROW_MM.max);
  assert.equal(testingRowHeightMm(80), TESTING_ROW_MM.min);
  assert.ok(testingRowHeightMm(35) < testingRowHeightMm(30));
  assert.equal(defaultBlankRows(30), 2);
  assert.equal(defaultBlankRows(14), 3);
});

const players = [
  { number: 7, nickname: "เจเจ" },
  { number: 3, nickname: "<b>x</b>" }
];

test("testingPages: every page stays inside the A4 portrait width, tests keep their order and are never split", () => {
  const tests = testsForRound(rounds[0], "U16");
  const pages = testingPages(tests);
  assert.ok(pages.length >= 2, "11 tests do not fit one portrait page");
  assert.deepEqual(pages.flat().map((t) => t.code), tests.map((t) => t.code));
  const fixedMm = 6 + 24 + 24;
  for (const page of pages) assert.ok(fixedMm + page.reduce((n, t) => n + testWidthMm(t), 0) <= PAGE_CONTENT_WIDTH_MM, page.map((t) => t.code).join());
  assert.deepEqual(testingPages([]), []);
  const few = testingPages(tests.slice(0, 3));
  assert.equal(few.length, 1, "a short test list stays on one page");
});

test("testing form: one A4 portrait sheet per page of tests, same players on every page, columns follow the trial counts, text is escaped", () => {
  const tests = testsForRound(rounds[0], "U16");
  const pages = testingPages(tests);
  const html = testingFormHtml({ team: "THAWEE SC", ageGroup: "U16", roundText: "Baseline พ.ค. 2026", players, tests });
  const sheets = html.split('<div class="sheet sheet-testing print-sheet"').slice(1);
  assert.equal(sheets.length, pages.length);
  assert.match(html, /PHYSICAL TEST FORM/);
  assert.match(html, /THAWEE SC · U16 · Baseline พ.ค. 2026/);
  assert.match(sheets[0], /หน้า 1\/2/);
  assert.match(sheets[1], /หน้า 2\/2/);
  sheets.forEach((sheet, i) => {
    for (const t of pages[i]) assert.ok(sheet.includes(t.label), `${t.label} on page ${i + 1}`);
    for (const t of pages.flat().filter((x) => !pages[i].includes(x))) assert.ok(!sheet.includes(`<th rowspan="2">${t.label}`) && !sheet.includes(`>${t.label}<br>`), `${t.label} only on its own page`);
    const trialTotal = pages[i].reduce((n, t) => n + t.trials, 0);
    const firstBody = sheet.split("<tbody>")[1].split("</tr>")[0];
    assert.equal((firstBody.match(/<td/g) || []).length, 2 + trialTotal + 1, `row cells on page ${i + 1}`);
    const subHeaders = sheet.split("</tr><tr>")[1].split("</tr>")[0];
    assert.equal((subHeaders.match(/<th>/g) || []).length, pages[i].filter((t) => t.trials > 1).reduce((n, t) => n + t.trials, 0));
    assert.ok(sheet.includes("เจเจ"), "players repeat on every page");
    assert.equal((sheet.match(/sheet-blank/g) || []).length, 3);
    assert.match(sheet, /พื้นผิว ☐ หญ้าเทียม/);
    assert.match(sheet, /รองเท้า ☐ รองเท้าสตั๊ด/);
    assert.match(sheet, /--row-h:\d+(\.\d)?mm/);
  });
  assert.ok(!html.includes("<b>x</b>"));
  const single = testingFormHtml({ team: "THAWEE SC", ageGroup: "U16", players, tests: tests.slice(0, 3) });
  assert.ok(!single.includes("หน้า 1/"), "no page label when there is only one page");
});
test("pickNote lists max/min tests and RSA only when present", () => {
  const u16 = testsForRound(rounds[0], "U16");
  assert.match(pickNote(u16), /Broad Jump สูงสุด/);
  assert.match(pickNote(u16), /Sprint 10 ม\. ต่ำสุด/);
  assert.match(pickNote(u16), /RSA/);
  assert.equal(pickNote(FITNESS_TESTS.filter((t) => t.pick === "single")), "");
});
