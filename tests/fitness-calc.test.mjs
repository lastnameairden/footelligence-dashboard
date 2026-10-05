import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FITNESS_TESTS,
  FITNESS_TEST_BY_CODE,
  SELECTIVE_TEST_CODES,
  addDays,
  ageNumberOf,
  bestSeasonFor,
  completion,
  currentEntryRound,
  datesFromOpen,
  defaultRoundDates,
  defaultTestCodes,
  formatResult,
  overlappingRound,
  plausibilityWarnings,
  resultValue,
  roundLabel,
  roundState,
  rsaStats,
  testsForRound,
  validateRoundForm
} from "../js/fitness-calc.js";

const codesFor = (round, age) => testsForRound(round, age).map((t) => t.code);

test("height and sitting height are measured once, like weight", () => {
  for (const code of ["height", "sitting_height", "weight", "yoyo_ir1c", "ift_3015"]) {
    assert.equal(FITNESS_TEST_BY_CODE[code].trials, 1, code);
  }
  assert.equal(FITNESS_TEST_BY_CODE.broad_jump.trials, 3);
  assert.equal(FITNESS_TEST_BY_CODE.cod_505_l.trials, 2);
  assert.equal(FITNESS_TEST_BY_CODE.rsa_6x30.trials, 6);
  assert.equal(FITNESS_TESTS.length, 12);
});

test("ageNumberOf parses U-groups only", () => {
  assert.equal(ageNumberOf("U13"), 13);
  assert.equal(ageNumberOf("u9"), 9);
  assert.equal(ageNumberOf("13"), null);
  assert.equal(ageNumberOf(""), null);
  assert.equal(ageNumberOf(null), null);
});

test("testsForRound: full round columns by age group", () => {
  const full = { mode: "full" };
  assert.deepEqual(codesFor(full, "U10"), ["height", "sitting_height", "weight", "broad_jump", "sprint_10", "yoyo_ir1c"]);
  assert.deepEqual(codesFor(full, "U12"), ["height", "sitting_height", "weight", "broad_jump", "sprint_10", "cod_505_l", "cod_505_r", "yoyo_ir1c", "ift_3015"]);
  assert.deepEqual(codesFor(full, "U13"), ["height", "sitting_height", "weight", "broad_jump", "cmj", "sprint_10", "sprint_30", "cod_505_l", "cod_505_r", "yoyo_ir1c", "ift_3015"]);
  assert.deepEqual(codesFor(full, "U14"), ["height", "sitting_height", "weight", "broad_jump", "cmj", "sprint_10", "sprint_30", "cod_505_l", "cod_505_r", "ift_3015"]);
  assert.deepEqual(codesFor(full, "U17"), ["height", "sitting_height", "weight", "broad_jump", "cmj", "sprint_10", "sprint_30", "cod_505_l", "cod_505_r", "rsa_6x30", "ift_3015"]);
  assert.deepEqual(codesFor(full, "U9"), [], "U9 is outside every test's age range");
  assert.deepEqual(codesFor(full, "bad"), []);
});

test("testsForRound: selective round has no endurance, COD, RSA or sitting height", () => {
  const sel = { mode: "selective" };
  assert.deepEqual(codesFor(sel, "U10"), ["height", "weight", "broad_jump", "sprint_10"]);
  assert.deepEqual(codesFor(sel, "U13"), ["height", "weight", "broad_jump", "cmj", "sprint_10", "sprint_30"]);
  assert.deepEqual(SELECTIVE_TEST_CODES, ["height", "weight", "broad_jump", "cmj", "sprint_10", "sprint_30"]);
  // รอบที่ระบุ testCodes เอง ใช้ตามนั้น (ยังกรองตามรุ่น)
  assert.deepEqual(codesFor({ mode: "selective", testCodes: ["height", "cmj"] }, "U10"), ["height"]);
  assert.deepEqual(defaultTestCodes("selective"), SELECTIVE_TEST_CODES);
  assert.equal(defaultTestCodes("full").length, 12);
});

test("resultValue picks best of trials; blank and non-numeric trials are ignored", () => {
  const T = FITNESS_TEST_BY_CODE;
  assert.equal(resultValue(T.broad_jump, ["186", "191", "189"]), 191);
  assert.equal(resultValue(T.sprint_10, [2.11, 2.08, "2.10"]), 2.08);
  assert.equal(resultValue(T.height, ["149.7"]), 149.7);
  assert.equal(resultValue(T.sprint_10, ["", null, "abc"]), null);
  assert.equal(resultValue(T.sprint_10, []), null);
  assert.equal(resultValue(T.sprint_10, undefined), null);
});

test("rsaStats: best, mean and decrement against the best repeated six times", () => {
  const s = rsaStats([4.9, 4.95, 5.01, 5.06, 5.1, 5.18]);
  assert.equal(s.best, 4.9);
  assert.ok(Math.abs(s.mean - 5.0333333) < 1e-4);
  assert.ok(Math.abs(s.decrementPct - 2.7211) < 1e-3);
  assert.equal(s.count, 6);
  assert.equal(rsaStats([]), null);
  assert.equal(rsaStats([5, 5, 5]).decrementPct, 0);
});

test("formatResult shows the used value with the test's decimals, or a dash", () => {
  const T = FITNESS_TEST_BY_CODE;
  assert.equal(formatResult(T.broad_jump, [186, 191]), "191");
  assert.equal(formatResult(T.sprint_10, [2.1, 2.08]), "2.08");
  assert.equal(formatResult(T.height, ["149.7"]), "149.7");
  assert.equal(formatResult(T.rsa_6x30, [4.9, 4.95, 5.01, 5.06, 5.1, 5.18]), "4.90 / 2.7%");
  assert.equal(formatResult(T.sprint_10, []), "–");
});

test("completion: counts tests with at least one value; not-tested players are their own state", () => {
  const tests = testsForRound({ mode: "selective" }, "U10"); // height, weight, broad_jump, sprint_10
  assert.deepEqual(completion({}, tests), { done: 0, total: 4, state: "empty" });
  assert.deepEqual(completion({ tests: { height: { trials: [149] } } }, tests), { done: 1, total: 4, state: "partial" });
  const all = { tests: Object.fromEntries(tests.map((t) => [t.code, { trials: [1] }])) };
  assert.deepEqual(completion(all, tests), { done: 4, total: 4, state: "complete" });
  assert.deepEqual(completion({ notTested: { reason: "บาดเจ็บ" }, tests: all.tests }, tests), { done: 0, total: 4, state: "not_tested" });
  assert.equal(completion({}, []).state, "empty");
});

test("round dates: 2-week entry window, then 14 days of make-up", () => {
  assert.equal(addDays("2027-05-30", 14), "2027-06-13");
  assert.deepEqual(datesFromOpen("2027-05-17"), { openDate: "2027-05-17", closeDate: "2027-05-30", makeupUntil: "2027-06-13" });
  assert.deepEqual(defaultRoundDates("baseline", "2027/28"), { openDate: "2027-05-17", closeDate: "2027-05-30", makeupUntil: "2027-06-13" });
  assert.equal(defaultRoundDates("monitoring", "2027/28").openDate, "2027-08-09");
  assert.equal(defaultRoundDates("reeval", "2027/28").openDate, "2027-11-08");
  assert.equal(defaultRoundDates("final", "2027/28").openDate, "2028-02-01");
  assert.equal(defaultRoundDates("nope", "2027/28"), null);
  assert.equal(defaultRoundDates("baseline", "bad"), null);
});

test("roundLabel and roundState", () => {
  const r = { id: "r1", roundType: "baseline", openDate: "2027-05-17", closeDate: "2027-05-30", makeupUntil: "2027-06-13", status: "open" };
  assert.equal(roundLabel(r), "Baseline พ.ค. 2027");
  assert.equal(roundState(r, "2027-05-16"), "upcoming");
  assert.equal(roundState(r, "2027-05-17"), "open");
  assert.equal(roundState(r, "2027-05-30"), "open");
  assert.equal(roundState(r, "2027-05-31"), "makeup");
  assert.equal(roundState(r, "2027-06-13"), "makeup");
  assert.equal(roundState(r, "2027-06-14"), "closed");
  assert.equal(roundState({ ...r, status: "closed" }, "2027-05-20"), "closed", "closed by the admin");
});

test("currentEntryRound: open rounds only; an open round beats a make-up round; nearest closing first", () => {
  const mk = (id, open, close, makeup, status = "open") => ({ id, roundType: "monitoring", openDate: open, closeDate: close, makeupUntil: makeup, status });
  const rounds = [mk("a", "2027-05-17", "2027-05-30", "2027-06-13"), mk("b", "2027-08-09", "2027-08-22", "2027-09-05")];
  assert.equal(currentEntryRound(rounds, "2027-08-12").id, "b");
  assert.equal(currentEntryRound(rounds, "2027-06-01").id, "a", "a is in its make-up window");
  assert.equal(currentEntryRound(rounds, "2027-07-01"), null);
  assert.equal(currentEntryRound([], "2027-07-01"), null);
  const overlap = [mk("x", "2027-05-17", "2027-05-30", "2027-06-13"), mk("y", "2027-05-25", "2027-06-07", "2027-06-21")];
  assert.equal(currentEntryRound(overlap, "2027-05-28").id, "x", "closest to closing among open rounds");
  assert.equal(currentEntryRound([mk("c", "2027-05-17", "2027-05-30", "2027-06-13", "closed")], "2027-05-20"), null);
});

test("overlappingRound / validateRoundForm", () => {
  const existing = [{ id: "a", roundType: "baseline", openDate: "2027-05-17", closeDate: "2027-05-30", makeupUntil: "2027-06-13" }];
  const form = { season: "2027/28", roundType: "monitoring", mode: "selective", openDate: "2027-08-09", closeDate: "2027-08-22", testCodes: ["height"] };
  assert.equal(validateRoundForm(form, existing), null);
  assert.match(validateRoundForm({ ...form, openDate: "2027-06-01", closeDate: "2027-06-14" }, existing), /ซ้อนกับรอบ "Baseline พ.ค. 2027"/);
  assert.equal(overlappingRound({ openDate: "2027-06-14", makeupUntil: "2027-06-28" }, existing), null);
  assert.match(validateRoundForm({ ...form, season: "" }, []), /ปีการศึกษา/);
  assert.match(validateRoundForm({ ...form, roundType: "x" }, []), /เลือกรอบ/);
  assert.match(validateRoundForm({ ...form, mode: "x" }, []), /Full หรือ Selective/);
  assert.match(validateRoundForm({ ...form, openDate: "" }, []), /วันเปิด/);
  assert.match(validateRoundForm({ ...form, closeDate: "2027-08-01" }, []), /ก่อนวันเปิด/);
  assert.match(validateRoundForm({ ...form, testCodes: [] }, []), /อย่างน้อย 1/);
  assert.match(validateRoundForm({ ...form, testCodes: ["nope"] }, []), /ไม่รู้จัก/);
});

test("bestSeasonFor picks the first academic year whose round has not finished yet", () => {
  // วันนี้ 5 ต.ค. 2026: Baseline พ.ค. 2026 ผ่านไปแล้ว → ปีการศึกษา 2027/28
  assert.equal(bestSeasonFor("baseline", "2026-10-05"), "2027/28");
  assert.equal(bestSeasonFor("monitoring", "2026-10-05"), "2027/28");
  assert.equal(bestSeasonFor("reeval", "2026-10-05"), "2026/27");
  assert.equal(bestSeasonFor("final", "2026-10-05"), "2026/27");
  // ยังอยู่ในช่วงทดสอบซ่อมของรอบนั้น ยังเลือกปีเดิม
  assert.equal(bestSeasonFor("baseline", "2026-06-10"), "2026/27");
  assert.equal(bestSeasonFor("baseline", "2026-06-14"), "2027/28");
  // ม.ค.–เม.ย. ยังนับเป็นปีการศึกษาที่เริ่มปีก่อน
  assert.equal(bestSeasonFor("final", "2027-02-05"), "2026/27");
});
test("after Baseline each age uses a single endurance test (U12 Yo-Yo, U13+ 30-15); Baseline keeps both", () => {
  const base = { roundType: "baseline", mode: "full" };
  assert.deepEqual(codesFor(base, "U13").slice(-2), ["yoyo_ir1c", "ift_3015"]);
  assert.deepEqual(codesFor(base, "U12").slice(-2), ["yoyo_ir1c", "ift_3015"]);
  const nov = { roundType: "reeval", mode: "full" };
  assert.ok(codesFor(nov, "U12").includes("yoyo_ir1c") && !codesFor(nov, "U12").includes("ift_3015"));
  assert.ok(codesFor(nov, "U13").includes("ift_3015") && !codesFor(nov, "U13").includes("yoyo_ir1c"));
  assert.ok(codesFor(nov, "U10").includes("yoyo_ir1c"), "U10-U11 only have Yo-Yo");
  assert.ok(codesFor(nov, "U16").includes("ift_3015"));
  // ไม่ระบุ roundType = ไม่ตัด
  assert.ok(codesFor({ mode: "full" }, "U13").includes("yoyo_ir1c"));
  assert.equal(codesFor({ roundType: "final", mode: "selective" }, "U13").includes("ift_3015"), false);
});

test("plausibilityWarnings flags out-of-range trials and a sitting height not below standing height", () => {
  assert.deepEqual(plausibilityWarnings({}), {});
  assert.deepEqual(plausibilityWarnings({ height: { trials: [149.7] }, sitting_height: { trials: [75.1] }, sprint_10: { trials: [2.1, 2.08] } }), {});
  const w = plausibilityWarnings({ height: { trials: [14.97] }, sprint_10: { trials: [2.1, 21] }, broad_jump: { trials: [186, 191] } });
  assert.deepEqual(Object.keys(w).sort(), ["height", "sprint_10"]);
  assert.match(w.height, /ผิดปกติ/);
  assert.match(plausibilityWarnings({ height: { trials: [150] }, sitting_height: { trials: [150] } }).sitting_height, /น้อยกว่าส่วนสูงยืน/);
  assert.deepEqual(plausibilityWarnings({ height: { trials: [150] }, sitting_height: { trials: [] } }), {});
  assert.deepEqual(plausibilityWarnings({ height: { trials: ["", null] } }), {});
});