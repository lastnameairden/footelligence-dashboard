import { test } from "node:test";
import assert from "node:assert/strict";
import {
  academicYearOf,
  currentPeriodKey,
  formatDelta,
  monthlyCounts,
  monthsBetween,
  periodFor,
  rowsInPeriod,
  shiftPeriodKey
} from "../js/injury-period.js";

test("academic year starts in May (Jan-Apr belong to the year that started the previous May)", () => {
  assert.equal(academicYearOf("2026-05"), 2026);
  assert.equal(academicYearOf("2026-10"), 2026);
  assert.equal(academicYearOf("2027-04"), 2026);
  assert.equal(academicYearOf("2027-05"), 2027);
});

test("currentPeriodKey for month, term and academic year", () => {
  assert.equal(currentPeriodKey("month", "2026-10-05"), "2026-10");
  assert.equal(currentPeriodKey("term", "2026-10-05"), "2026-T1");
  assert.equal(currentPeriodKey("year", "2026-10-05"), "2026-Y");
  assert.equal(currentPeriodKey("term", "2026-11-01"), "2026-T2");
  assert.equal(currentPeriodKey("term", "2027-03-15"), "2026-T2");
  assert.equal(currentPeriodKey("term", "2027-05-01"), "2027-T1");
  assert.equal(currentPeriodKey("year", "2027-02-01"), "2026-Y");
});

test("periodFor builds the label, month list and date range", () => {
  const m = periodFor("month", "2026-10");
  assert.equal(m.label, "ตุลาคม 2026");
  assert.deepEqual(m.months, ["2026-10"]);
  assert.equal(m.start, "2026-10-01");
  assert.equal(m.end, "2026-10-31");
  const t1 = periodFor("term", "2026-T1");
  assert.equal(t1.label, "เทอม 1 ปีการศึกษา 2026/27");
  assert.deepEqual(t1.months, ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  const t2 = periodFor("term", "2026-T2");
  assert.deepEqual(t2.months, ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]);
  assert.equal(t2.start, "2026-11-01");
  assert.equal(t2.end, "2027-04-31");
  const y = periodFor("year", "2026-Y");
  assert.equal(y.label, "ปีการศึกษา 2026/27");
  assert.equal(y.months.length, 12);
  assert.equal(y.months[0], "2026-05");
  assert.equal(y.months[11], "2027-04");
  assert.deepEqual([...t1.months, ...t2.months], y.months, "the two terms tile the academic year with no gap");
});

test("shiftPeriodKey moves across years in both directions", () => {
  assert.equal(shiftPeriodKey("month", "2026-01", -1), "2025-12");
  assert.equal(shiftPeriodKey("month", "2026-12", 1), "2027-01");
  assert.equal(shiftPeriodKey("term", "2026-T1", -1), "2025-T2");
  assert.equal(shiftPeriodKey("term", "2026-T2", 1), "2027-T1");
  assert.equal(shiftPeriodKey("term", "2026-T1", 1), "2026-T2");
  assert.equal(shiftPeriodKey("term", "2026-T2", -1), "2026-T1");
  assert.equal(shiftPeriodKey("year", "2026-Y", -1), "2025-Y");
  assert.equal(shiftPeriodKey("year", "2026-Y", 1), "2027-Y");
});

test("monthsBetween and monthlyCounts / rowsInPeriod", () => {
  assert.deepEqual(monthsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  const rows = [{ date: "2026-05-02" }, { date: "2026-05-30" }, { date: "2026-07-10" }, { date: "2026-11-01" }, {}];
  const t1 = periodFor("term", "2026-T1");
  assert.deepEqual(
    monthlyCounts(rows, t1.months).map((c) => c.count),
    [2, 0, 1, 0, 0, 0]
  );
  assert.equal(rowsInPeriod(rows, t1).length, 3);
  assert.equal(rowsInPeriod(rows, periodFor("month", "2026-05")).length, 2);
});

test("formatDelta: lower is better, neutral without a comparison", () => {
  assert.deepEqual(formatDelta(5, 8), { text: "-3 จากช่วงก่อน", tone: "good" });
  assert.deepEqual(formatDelta(8, 5), { text: "+3 จากช่วงก่อน", tone: "bad" });
  assert.deepEqual(formatDelta(5, 5), { text: "เท่าช่วงก่อน", tone: "neutral" });
  assert.deepEqual(formatDelta(5, null), { text: "ไม่มีช่วงก่อนเทียบ", tone: "neutral" });
  assert.deepEqual(formatDelta(null, 5), { text: "ไม่มีช่วงก่อนเทียบ", tone: "neutral" });
  assert.deepEqual(formatDelta(11.2, 12.4), { text: "-1.2 จากช่วงก่อน", tone: "good" });
  assert.equal(formatDelta(8, 5, { lowerIsBetter: false }).tone, "good");
});
