import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRINT_OPTIONS, coachFlags, mergeCoachRows, onTimePct, pctTone, readPrintOptions, sortCoachRows, teamKpis } from "../js/print-coach-summary.js";

const coach = (id, name, ageGroups) => ({ id, name, ageGroups });
const A = coach("a", "โค้ชเอ", ["U15", "U16"]);
const B = coach("b", "โค้ชบี", ["U13", "U14"]);
const D = coach("d", "โค้ชดี", ["U18"]);
const input = {
  coaches: [A, B, D],
  planRows: [{ coach: A, onTime: 15, late: 5, missing: 2 }, { coach: B, onTime: 22, late: 0, missing: 0 }, { coach: D, onTime: 7, late: 9, missing: 6 }],
  checkinRows: [{ coach: A, checkinDays: 22, onTime: 20, late: 2, missing: 0 }, { coach: B, checkinDays: 22, onTime: 22, late: 0, missing: 0 }, { coach: D, checkinDays: 20, onTime: 14, late: 6, missing: 2 }],
  reportRows: [{ coach: A, matchDays: 19, onTime: 15, late: 4, missing: 3 }, { coach: B, matchDays: 22, onTime: 21, late: 1, missing: 0 }, { coach: D, matchDays: 12, onTime: 6, late: 6, missing: 10 }],
  consistencyRows: [{ coach: A, completePercent: 73 }, { coach: B, completePercent: 100 }, { coach: D, completePercent: 41 }]
};

test("on-time % is from what was submitted; null when nothing was; tone thresholds are unchanged (80/50)", () => {
  assert.equal(onTimePct(15, 20), 75);
  assert.equal(onTimePct(0, 0), null);
  assert.deepEqual([pctTone(null), pctTone(80), pctTone(79), pctTone(50), pctTone(49)], ["neutral", "success", "warning", "warning", "danger"]);
});

test("one merged row per coach with plan / check-in / report metrics, completeness and issue count", () => {
  const rows = mergeCoachRows(input);
  const d = rows.find((r) => r.coach.id === "d");
  assert.deepEqual(d.plan, { submitted: 16, onTime: 7, late: 9, missing: 6, pct: 44 });
  assert.deepEqual([d.checkin.submitted, d.checkin.pct], [20, 70]);
  assert.deepEqual([d.report.submitted, d.report.pct], [12, 50]);
  assert.equal(d.completePercent, 41);
  assert.equal(d.issues, 9 + 6 + 6 + 2 + 6 + 10);
  assert.deepEqual(rows.find((r) => r.coach.id === "b").flags.map((f) => f.text), ["ส่งรายงานสาย 1"]);
});

test("flags: the three biggest problems; red above the threshold, amber otherwise; clean coach has none", () => {
  const rows = mergeCoachRows(input);
  const d = rows.find((r) => r.coach.id === "d");
  assert.deepEqual(d.flags.map((f) => f.text), ["ไม่ส่งรายงาน 10", "ส่งแผนสาย 9", "ไม่ส่งแผน 6"]);
  assert.ok(d.flags.every((f) => f.tone === "danger"));
  assert.deepEqual(coachFlags({ plan: { late: 2, missing: 0 }, checkin: { late: 0, missing: 0 }, report: { late: 0, missing: 0 } }), [{ text: "ส่งแผนสาย 2", tone: "warning" }]);
  assert.deepEqual(coachFlags({ plan: { late: 0, missing: 0 }, checkin: { late: 0, missing: 0 }, report: { late: 0, missing: 0 } }), []);
});

test("sorting: needs-follow-up first by default, or by age group like before", () => {
  const rows = mergeCoachRows(input);
  assert.deepEqual(sortCoachRows(rows).map((r) => r.coach.name), ["โค้ชดี", "โค้ชเอ", "โค้ชบี"]);
  assert.deepEqual(sortCoachRows(rows, true).map((r) => r.coach.name), ["โค้ชบี", "โค้ชเอ", "โค้ชดี"]);
  assert.equal(rows[0].coach.name, "โค้ชเอ", "the input order is not changed by sorting");
});

test("team KPIs sum all coaches (not an average of percentages)", () => {
  const k = teamKpis(mergeCoachRows(input));
  assert.equal(k.coaches, 3);
  assert.equal(k.planPct, Math.round(((15 + 22 + 7) / (20 + 22 + 16)) * 100));
  assert.equal(k.checkinPct, Math.round(((20 + 22 + 14) / (22 + 22 + 20)) * 100));
  assert.equal(k.reportPct, Math.round(((15 + 21 + 6) / (19 + 22 + 12)) * 100));
  assert.deepEqual(teamKpis([]), { coaches: 0, planPct: null, checkinPct: null, reportPct: null });
});

test("print options: saved choices are read, broken or partial data falls back to the defaults", () => {
  assert.deepEqual(readPrintOptions(null), DEFAULT_PRINT_OPTIONS);
  assert.deepEqual(readPrintOptions("not json"), DEFAULT_PRINT_OPTIONS);
  assert.equal(readPrintOptions(JSON.stringify({ topics: true, injuries: false })).topics, true);
  assert.equal(readPrintOptions(JSON.stringify({ topics: true, injuries: false })).injuries, false);
  assert.equal(readPrintOptions(JSON.stringify({ coaches: "yes" })).coaches, true, "non-boolean values are ignored");
});