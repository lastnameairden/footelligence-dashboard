import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportModel, filterReports, formatLabel, groupByAgeGroup, hasDetail, seasonLabel, seasonOptions, seasonStartYear } from "../js/match-history.js";
import { FORM_COL_WIDTHS, FORM_ROW_MM, FORM_TABLE_BUDGET_MM, dateLabel, defaultBlankRows, formRowHeightMm, historyHtml, recordingFormHtml, reportSheetHtml, starsText } from "../js/match-sheets.js";

const detailReport = {
  id: "md1",
  matchDay: true,
  date: "2026-10-19",
  matchTime: "13:00",
  venue: "สนาม A",
  ageGroup: "U16",
  opponent: "Bangkok FC U16",
  competitionType: "ลีก",
  competition: "Thailand Youth League",
  matchFormat: "11v11",
  matchLengthMinutes: 80,
  formation: "4-3-3",
  result: "ชนะ",
  scoreUs: 3,
  scoreThem: 1,
  oppAttack: "โยนยาว",
  oppDefense: "ตั้งรับต่ำ",
  videoUrl: "https://youtu.be/x",
  notes: "ดี",
  startingLineupNames: ["เจเจ", "เทอรี่"],
  players: [
    { id: "gk", number: 1, name: "เจเจ", status: "starter", played: true, position: "GK", rating: 3.5, goals: 0, assists: 0, yellowCards: 1, redCards: 0, minutes: 80 },
    { id: "st", name: "เทอรี่", status: "starter", played: true, position: "ST", rating: 3.5, goals: 2, assists: 0, yellowCards: 0, redCards: 0, minutes: 67, subOutMinute: "67:00", replacedById: "sb", note: "ยิงสองประตู" },
    { id: "sb", name: "นัท", status: "sub", played: true, position: "ST", rating: 2.5, goals: 1, assists: 1, yellowCards: 0, redCards: 0, minutes: 13, subInMinute: "67:00", replacesId: "st" },
    { id: "bn", name: "โชกุน", status: "none", played: false },
    { id: "g1", name: "ฟิวส์", status: "sub", played: false, guest: true, ageGroup: "U15" }
  ]
};
const legacy = { id: "old", date: "2026-03-02", ageGroup: "U13", opponent: "ทีมเก่า", result: "แพ้", scoreUs: 0, scoreThem: 2, competitionType: "อุ่นเครื่อง", startingLineupNames: ["เอ", "บี"] };

test("season runs May to April and the label spans two years", () => {
  assert.equal(seasonStartYear("2026-10-19"), 2026);
  assert.equal(seasonStartYear("2027-04-30"), 2026);
  assert.equal(seasonStartYear("2027-05-01"), 2027);
  assert.equal(seasonStartYear("bad"), null);
  assert.equal(seasonLabel(2026), "2026/2027");
  assert.deepEqual(seasonOptions([detailReport, legacy], "2026-10-20"), [2026, 2025]);
  assert.deepEqual(seasonOptions([], "2026-10-20"), [2026], "the current season is always selectable");
});

test("formatLabel and hasDetail", () => {
  assert.equal(formatLabel(detailReport), "11v11");
  assert.equal(formatLabel({ matchFormat: "other", matchFormatOther: "5v5" }), "5v5");
  assert.equal(formatLabel(legacy), "-");
  assert.equal(hasDetail(detailReport), true);
  assert.equal(hasDetail(legacy), false);
});

test("filterReports by season, search and the coach's age groups; groupByAgeGroup sorts groups young to old and matches newest first", () => {
  const all = [detailReport, legacy, { ...detailReport, id: "md2", date: "2026-10-12", matchTime: "13:06", ageGroup: "U16", result: "เสมอ" }];
  assert.deepEqual(filterReports(all, { seasonStart: 2026 }).map((r) => r.id), ["md1", "md2"]);
  assert.deepEqual(filterReports(all, { seasonStart: 2025 }).map((r) => r.id), ["old"]);
  assert.deepEqual(filterReports(all, { query: " bangkok" }).map((r) => r.id), ["md1", "md2"]);
  assert.deepEqual(filterReports(all, { ageGroups: ["U13"] }).map((r) => r.id), ["old"]);
  assert.equal(filterReports(all, {}).length, 3);
  const groups = groupByAgeGroup(all);
  assert.deepEqual(groups.map((g) => g.ageGroup), ["U13", "U16"]);
  assert.deepEqual(groups[1].matches.map((m) => m.id), ["md1", "md2"]);
  assert.deepEqual([groups[1].wins, groups[1].draws, groups[1].losses], [1, 1, 0]);
});

test("buildReportModel orders starters, then subs who played, then the rest; totals only count who played", () => {
  const m = buildReportModel(detailReport);
  assert.deepEqual(m.rows.map((r) => r.id), ["gk", "st", "sb", "bn", "g1"]);
  assert.equal(m.rows[1].subNote, "ออก 67:00 (แทนโดย นัท)");
  assert.equal(m.rows[2].subNote, "เข้าแทน เทอรี่ นาที 67:00");
  assert.deepEqual([m.totals.goals, m.totals.assists, m.totals.yellow, m.totals.red, m.totals.minutes], [3, 1, 1, 0, 160]);
  assert.equal(m.totals.avgRating, 3.2, "(3.5 + 3.5 + 2.5) / 3 rounded to 1 decimal");
  assert.equal(m.totals.ratedCount, 3);
  assert.equal(m.totals.minutesKnown, true);
  assert.equal(m.time, "13:00");
  assert.equal(m.format, "11v11");
});

test("buildReportModel for an old report has no rows and says so", () => {
  const m = buildReportModel(legacy);
  assert.equal(m.detail, false);
  assert.deepEqual(m.rows, []);
  assert.equal(m.totals.avgRating, null);
});

test("starsText shows 4 stars with half steps", () => {
  assert.equal(starsText(3.5), "★★★½");
  assert.equal(starsText(4), "★★★★");
  assert.equal(starsText(0.5), "½☆☆☆");
  assert.equal(starsText(null), "");
});

test("historyHtml groups by age group and makes every row clickable; reportSheetHtml shows the scoreline, notes and the unplayed", () => {
  const html = historyHtml(groupByAgeGroup([detailReport, legacy]));
  assert.match(html, /U16 · 1 นัด · ชนะ 1 เสมอ 0 แพ้ 0/);
  assert.match(html, /data-match-id="md1"/);
  assert.match(html, /19 ต\.ค\. 2026 · 13:00/);
  assert.match(historyHtml([]), /ยังไม่มีผลการแข่งขัน/);
  const sheet = reportSheetHtml(buildReportModel(detailReport), "THAWEE SC");
  assert.match(sheet, /THAWEE SC <b>3 – 1<\/b> Bangkok FC U16/);
  assert.match(sheet, /ออก 67:00 \(แทนโดย นัท\)/);
  assert.match(sheet, /ยิงสองประตู/);
  assert.match(sheet, /<td>1<\/td>\s*<td class="l">เจเจ/, "shirt number column");
  assert.match(sheet, /11v11 · 80 นาที/, "match length in the info box");
  assert.match(sheet, /ไม่มีรายชื่อ — ไม่ได้ลงสนาม/);
  assert.match(sheet, /\(U15\)|>U15</);
  assert.match(sheet, /เกมรุกของคู่แข่ง<\/span> โยนยาว/);
  assert.match(sheet, /youtu\.be\/x/);
  assert.match(reportSheetHtml(buildReportModel(legacy), "THAWEE SC"), /ก่อนมีระบบ Match Day/);
  assert.equal(dateLabel("2026-10-19"), "19 ต.ค. 2026");
});

test("recordingFormHtml lists every player of the age group plus blank rows and the three sections", () => {
  const html = recordingFormHtml({ team: "THAWEE SC", ageGroup: "U16", players: [{ number: 7, nickname: "เจเจ", fullName: "ภพธรรม", ageGroup: "U16" }, { number: 3, nickname: "เทอรี่", fullName: "เจตนิพัทธ์", ageGroup: "U16" }], blankRows: 4 });
  assert.match(html, /MATCH RECORDING FORM/);
  assert.match(html, /ส่วนที่ 1 · ข้อมูล Match/);
  assert.match(html, /ส่วนที่ 2 · ข้อมูล Game/);
  assert.match(html, /ส่วนที่ 3 · Match Report/);
  assert.match(html, /เจเจ/);
  assert.equal((html.match(/class="sheet-blank"/g) || []).length, 4);
  assert.match(html, /ความยาวการแข่งขัน/);
  assert.match(html, /☆☆☆☆/, "4 blank stars");
});

test("the recording form is sized to fit one A4 landscape page: rows shrink with the roster but never overflow the budget", () => {
  assert.equal(formRowHeightMm(14), FORM_ROW_MM.max, "few players: comfortable rows");
  for (const n of [16, 20, 24, 26, 28]) {
    const h = formRowHeightMm(n);
    assert.ok(h >= FORM_ROW_MM.min && h <= FORM_ROW_MM.max);
    assert.ok(h * n <= FORM_TABLE_BUDGET_MM + 1e-6 || h === FORM_ROW_MM.min, `${n} rows of ${h}mm must fit the ${FORM_TABLE_BUDGET_MM}mm budget`);
  }
  assert.ok(formRowHeightMm(26) < formRowHeightMm(18), "more players, thinner rows");
  assert.equal(defaultBlankRows(18), 4);
  assert.equal(defaultBlankRows(24), 2, "fewer blank rows for a big squad");
  assert.equal(Math.round(FORM_COL_WIDTHS.reduce((a, b) => a + b, 0)), 100);
  assert.equal(FORM_COL_WIDTHS.length, 14);
});

test("recordingFormHtml carries the row height, a column per field and no page-spilling extras", () => {
  const players = Array.from({ length: 20 }, (_, i) => ({ number: i + 1, nickname: `P${i + 1}`, fullName: "x", ageGroup: "U16" }));
  const html = recordingFormHtml({ team: "THAWEE SC", ageGroup: "U16", players });
  assert.match(html, new RegExp(`--row-h:${formRowHeightMm(24)}mm`), "20 players + 4 blank rows");
  assert.equal((html.match(/<col /g) || []).length, 14);
  assert.equal((html.match(/<th[ >]/g) || []).length, 14);
  assert.equal((html.match(/class="sheet-blank"/g) || []).length, 4);
  const big = recordingFormHtml({ team: "THAWEE SC", ageGroup: "U16", players: Array.from({ length: 26 }, (_, i) => ({ number: i, nickname: "x", ageGroup: "U16" })) });
  assert.equal((big.match(/class="sheet-blank"/g) || []).length, 2);
});