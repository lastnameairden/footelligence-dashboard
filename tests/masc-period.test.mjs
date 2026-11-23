import { test } from "node:test";
import assert from "node:assert/strict";
import { mascPeriodName, MASC_SEASON_YEAR } from "../js/masc-period.js";

test("mascPeriodName: ช่วงที่ N → N/2569 (display only)", () => {
  assert.equal(MASC_SEASON_YEAR, 2569);
  assert.equal(mascPeriodName("ช่วงที่ 1"), "1/2569");
  assert.equal(mascPeriodName("ช่วงที่ 4"), "4/2569");
  assert.equal(mascPeriodName(" ช่วงที่  2 "), "2/2569");
  assert.equal(mascPeriodName("ช่วงที่ 3", 2570), "3/2570");
});

test("mascPeriodName: anything else is returned unchanged", () => {
  assert.equal(mascPeriodName("2/2569"), "2/2569");
  assert.equal(mascPeriodName("รอบพิเศษ"), "รอบพิเศษ");
  assert.equal(mascPeriodName(""), "");
  assert.equal(mascPeriodName(null), null);
  assert.equal(mascPeriodName(undefined), undefined);
});
