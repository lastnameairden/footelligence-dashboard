import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROWTH_LABELS,
  RAPID_GROWTH_VELOCITY,
  ageAt,
  buildFitnessSeries,
  codDeficit,
  growthStatus,
  heightVelocity,
  mirwaldOffsetMale,
  previousValue,
  trendBetween,
  usedNumber
} from "../js/fitness-profile.js";
import { FITNESS_TEST_BY_CODE } from "../js/fitness-calc.js";

test("trendBetween: arrows only beyond the measurement tolerance; time tests are better when lower", () => {
  assert.equal(trendBetween("broad_jump", 195, 189), "better");
  assert.equal(trendBetween("broad_jump", 192, 189), "same", "3 cm is within the 5 cm tolerance");
  assert.equal(trendBetween("broad_jump", 180, 189), "lower");
  assert.equal(trendBetween("sprint_10", 2.05, 2.08), "same", "0.03 s is within tolerance");
  assert.equal(trendBetween("sprint_30", 4.81, 4.88), "better");
  assert.equal(trendBetween("sprint_30", 4.95, 4.88), "lower");
  assert.equal(trendBetween("ift_3015", 17.5, 16.5), "better");
  assert.equal(trendBetween("height", 152, 149), null, "height/weight use growth rate, no arrow");
  assert.equal(trendBetween("weight", 40, 38), null);
  assert.equal(trendBetween("sprint_10", 2.05, null), null);
  assert.equal(trendBetween("nope", 1, 2), null);
});

test("usedNumber: best of trials, RSA uses the best repetition", () => {
  assert.equal(usedNumber(FITNESS_TEST_BY_CODE.broad_jump, [186, 191, 189]), 191);
  assert.equal(usedNumber(FITNESS_TEST_BY_CODE.sprint_10, [2.11, 2.08, 2.1]), 2.08);
  assert.equal(usedNumber(FITNESS_TEST_BY_CODE.rsa_6x30, [4.9, 4.95, 5.01]), 4.9);
  assert.equal(usedNumber(FITNESS_TEST_BY_CODE.sprint_10, []), null);
});

const rounds = [
  { id: "r2", roundType: "monitoring", openDate: "2027-08-09" },
  { id: "r1", roundType: "baseline", openDate: "2027-05-17" },
  { id: "r3", roundType: "reeval", openDate: "2027-11-08" }
];

test("buildFitnessSeries: oldest first, only rounds with a result, skips whole-round not-tested", () => {
  const results = [
    { roundId: "r2", testDate: "2027-08-12", tests: { height: { trials: [149.7] }, sprint_10: { trials: [2.1, 2.08] } } },
    { roundId: "r1", testDate: "2027-05-19", tests: { height: { trials: [146.6] } } },
    { roundId: "r3", testDate: "2027-11-10", tests: { height: { trials: [152.1] } }, notTested: { reason: "บาดเจ็บ" } }
  ];
  const series = buildFitnessSeries(rounds, results);
  assert.deepEqual(series.map((p) => p.round.id), ["r1", "r2"]);
  assert.equal(series[1].values.sprint_10, 2.08);
  assert.equal(series[1].values.cmj, null);
  assert.equal(series[0].label, "Baseline พ.ค. 2027");
  assert.deepEqual(buildFitnessSeries(rounds, []), []);
  assert.deepEqual(buildFitnessSeries(rounds, [{ roundId: "r1", tests: {} }]), [], "no values at all");
});

test("codDeficit = 505 − sprint 10 m per side, plus left/right asymmetry", () => {
  const d = codDeficit({ sprint_10: 2.05, cod_505_l: 2.51, cod_505_r: 2.55 });
  assert.ok(Math.abs(d.left - 0.46) < 1e-9);
  assert.ok(Math.abs(d.right - 0.5) < 1e-9);
  assert.ok(Math.abs(d.asymmetry - 0.04) < 1e-9);
  assert.deepEqual(codDeficit({ cod_505_l: 2.5, cod_505_r: 2.6 }).left, null, "needs the sprint of the same round");
  assert.equal(codDeficit({ sprint_10: 2.1 }).asymmetry, null);
  assert.equal(codDeficit(undefined).left, null);
});

test("ageAt gives decimal years from a full birth date", () => {
  assert.ok(Math.abs(ageAt("2014-05-01", "2027-11-01") - 13.5) < 0.05);
  assert.equal(ageAt("", "2027-11-01"), null);
  assert.equal(ageAt("2030-01-01", "2027-11-01"), null);
});

test("mirwaldOffsetMale: sample boy and invalid inputs", () => {
  const off = mirwaldOffsetMale({ age: 13.5, height: 152.1, sitting: 80, weight: 40.1 });
  assert.ok(Math.abs(off - -0.895) < 0.01, `offset ${off}`);
  assert.equal(mirwaldOffsetMale({ age: 6, height: 120, sitting: 62, weight: 22 }), null, "outside 8-18 years");
  assert.equal(mirwaldOffsetMale({ age: 13, height: 150, sitting: 150, weight: 40 }), null, "sitting height must be below standing height");
  assert.equal(mirwaldOffsetMale({ age: 13, height: 150, weight: 40 }), null);
  // เด็กที่โตกว่าวัยเดียวกัน (ส่วนสูง/น้ำหนักมากกว่า) → offset สูงกว่า
  const taller = mirwaldOffsetMale({ age: 13.5, height: 165, sitting: 86, weight: 52 });
  assert.ok(taller > off);
});

const pt = (date, values) => ({ date, values });

test("heightVelocity uses the last two heights at least 45 days apart", () => {
  assert.equal(heightVelocity([pt("2027-05-19", { height: 146.6 })]), null);
  const v = heightVelocity([pt("2027-05-19", { height: 146.6 }), pt("2027-08-12", { height: 149.7 })]);
  assert.ok(Math.abs(v - 13.3) < 0.1, `velocity ${v}`);
  assert.equal(heightVelocity([pt("2027-05-19", { height: 146.6 }), pt("2027-06-01", { height: 147.5 })]), null, "too close together");
  assert.equal(heightVelocity([pt("2027-05-19", {}), pt("2027-08-12", { height: 149.7 })]), null);
});

test("growthStatus: rapid velocity wins; otherwise offset band for boys; unknown without data", () => {
  const fast = [pt("2027-05-19", { height: 146.6 }), pt("2027-08-12", { height: 149.7 })];
  assert.equal(growthStatus({ player: {}, series: fast }).key, "rapid", "velocity alone is enough (no sex needed)");
  assert.ok(growthStatus({ player: {}, series: fast }).velocity >= RAPID_GROWTH_VELOCITY);

  const slow = [pt("2027-05-19", { height: 146.0, sitting_height: 74, weight: 36 }), pt("2027-08-12", { height: 146.8, sitting_height: 74.4, weight: 36.8 })];
  const boy = { sex: "ชาย", birthday: "2014-05-01" };
  const s = growthStatus({ player: boy, series: slow });
  assert.ok(["pre", "circa", "post"].includes(s.key));
  assert.ok(s.offset !== null);
  assert.equal(growthStatus({ player: { birthday: "2014-05-01" }, series: slow }).key, null, "no sex → no offset band");
  assert.equal(growthStatus({ player: { sex: "หญิง", birthday: "2014-05-01" }, series: slow }).offset, null);
  assert.equal(growthStatus({ player: boy, series: [pt("2027-05-19", { height: 146 })] }).key, null);
  assert.ok(GROWTH_LABELS.rapid && GROWTH_LABELS.pre && GROWTH_LABELS.circa && GROWTH_LABELS.post);
});

test("previousValue skips rounds that did not measure the test (Selective rounds have no COD)", () => {
  const series = [
    { label: "Baseline", values: { cod_505_l: 2.62, height: 146 } },
    { label: "Monitoring", values: { cod_505_l: null, height: 149 } },
    { label: "Re-eval", values: { cod_505_l: 2.51, height: 152 } }
  ];
  assert.deepEqual(previousValue(series, "cod_505_l", 2), { value: 2.62, label: "Baseline" });
  assert.deepEqual(previousValue(series, "height", 2), { value: 149, label: "Monitoring" });
  assert.equal(previousValue(series, "cod_505_l", 0), null);
  assert.equal(previousValue(series, "cmj", 2), null);
});