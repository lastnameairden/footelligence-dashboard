import { test } from "node:test";
import assert from "node:assert/strict";
import { buildResults, resultsHtml, scopeReports } from "../js/injury-results.js";

const R = (o) => ({ id: "r", playerId: "p1", playerName: "เจเจ", ageGroup: "U17", date: "2026-08-10", description: "ข้อเท้าพลิก", severity: "เล็กน้อย", status: "หายแล้ว", actualReturnDate: "2026-08-20", bodyRegion: "ข้อเท้า", side: "ซ้าย", injuryType: "เอ็น/ข้อต่อ", mechanism: "ไม่ปะทะ", context: "ซ้อม", ...o });
const reports = [
  R({ id: "a" }),
  R({ id: "b", date: "2026-08-25", playerId: "p1", severity: "ปานกลาง", isRecurrence: true, status: "กำลังพักฟื้น", expectedReturn: "2026-10-10", actualReturnDate: undefined }),
  R({ id: "c", date: "2026-09-02", playerId: "p2", playerName: "นัท", ageGroup: "U18", severity: "รุนแรง", status: "บาดเจ็บขณะแข่งขัน", actualReturnDate: undefined, bodyRegion: "เข่า", injuryType: "กระดูก", mechanism: "ปะทะ", context: "แข่ง" }),
  R({ id: "d", date: "2026-03-01", ageGroup: "U17" }), // previous term
  R({ id: "e", date: "2026-08-12", ageGroup: "U15", playerId: "p9", playerName: "คนอื่น" }) // not this coach's age group
];

test("scopeReports: selected group, else the coach's groups, else the whole team", () => {
  assert.deepEqual(scopeReports(reports, ["U17", "U18"]).map((r) => r.id), ["a", "b", "c", "d"]);
  assert.deepEqual(scopeReports(reports, ["U17", "U18"], "U18").map((r) => r.id), ["c"]);
  assert.equal(scopeReports(reports, []).length, 5);
});

test("buildResults: period rows, delta vs previous period, active now, severity/status/type counts", () => {
  const m = buildResults({ reports, myAgeGroups: ["U17", "U18"], mode: "term", key: "2026-T1", todayStr: "2026-10-20" });
  assert.equal(m.total, 3);
  assert.deepEqual(m.rows.map((r) => r.id), ["c", "b", "a"]);
  assert.equal(m.totalDelta.text, "+2 จากช่วงก่อน");
  assert.equal(m.totalDelta.tone, "bad");
  assert.deepEqual(m.activeNow.map((x) => x.report.id), ["b", "c"], "oldest first; healed ones excluded");
  assert.equal(m.activeNow[0].daysOut, 56);
  assert.equal(m.activeNow[0].overdueDays, 10);
  assert.equal(m.activeNow[1].overdueDays, 0);
  assert.deepEqual(m.bySeverity.map((s) => s.count), [1, 1, 1]);
  assert.deepEqual(m.byStatus.map((s) => [s.label, s.count]), [["บาดเจ็บ", 1], ["กำลังพักฟื้น", 1], ["หายแล้ว", 1]]);
  assert.deepEqual(m.byType.map((t) => [t.label, t.count]), [["กระดูก", 1], ["เอ็น/ข้อต่อ", 2]].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })).map((x) => [x.label, x.count]));
  assert.deepEqual(m.byAgeGroup, [{ label: "U17", count: 2 }, { label: "U18", count: 1 }]);
  assert.deepEqual(m.frequent.map((p) => [p.name, p.count, p.recurrence]), [["เจเจ", 2, 1]]);
  assert.equal(m.trend.length, 6);
  assert.deepEqual(m.trend.map((t) => t.count), [0, 0, 0, 2, 1, 0]);
  assert.equal(m.stats.recurrence, 1);
  assert.equal(m.stats.avgDaysOut, 10);
});

test("buildResults: a selected age group narrows everything; a month with no injuries is empty", () => {
  const u18 = buildResults({ reports, myAgeGroups: ["U17", "U18"], ageGroup: "U18", mode: "term", key: "2026-T1", todayStr: "2026-10-20" });
  assert.equal(u18.total, 1);
  assert.deepEqual(u18.byAgeGroup, []);
  assert.deepEqual(u18.frequent, []);
  const empty = buildResults({ reports, myAgeGroups: ["U17"], mode: "month", key: "2026-10", todayStr: "2026-10-20" });
  assert.equal(empty.total, 0);
  assert.equal(empty.activeNow.length, 1, "active injuries are shown whatever period is selected");
  assert.match(resultsHtml(empty), /ยังไม่มีรายงานบาดเจ็บในช่วงที่เลือก/);
});

test("resultsHtml: summary cards, charts, tables, edit buttons, escaped text", () => {
  const evil = [...reports, R({ id: "x", playerId: "p7", playerName: "<img src=x onerror=1>", date: "2026-09-05", description: "<script>" })];
  const html = resultsHtml(buildResults({ reports: evil, myAgeGroups: ["U17", "U18"], mode: "term", key: "2026-T1", todayStr: "2026-10-20" }));
  assert.match(html, /บาดเจ็บทั้งหมดในช่วงนี้/);
  assert.match(html, /กำลังบาดเจ็บ\/พักฟื้นตอนนี้/);
  assert.match(html, /จำนวนรายงานรายเดือนในช่วงนี้/);
  assert.match(html, /ตามตำแหน่งร่างกาย/);
  assert.match(html, /ตามประเภทอาการ/);
  assert.match(html, /ตามรุ่นอายุ/);
  assert.match(html, /เลยกำหนด 10 วัน/);
  assert.match(html, /data-injury-edit="b"/);
  assert.match(html, /เจเจ<\/span> <span class="text-slate-400">U17<\/span> · 2 ครั้ง \(ซ้ำ 1\)/);
  assert.ok(!html.includes("<img src=x") && !html.includes("<script>"));
  assert.ok((html.match(/<svg/g) || []).length >= 6, "bars and stacked bars are SVG");
});
