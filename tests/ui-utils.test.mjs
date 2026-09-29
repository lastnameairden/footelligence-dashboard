import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  safeHttpUrl,
  monthDateRange,
  teamDateRangeQuery,
  monthQuery,
  coachPositionLabel,
  coachPositionAllowsMultipleAgeGroups,
  computeAvgScore,
  isPlayerFullyEvaluated,
  isPlayerOwnedByCoach,
  getCoachPlayerIds,
  ageGroupNumber,
  ageGroupSortKey,
  calcAge,
  isTrainingPlanLate,
  submissionDeadlineFor,
  isCoachSubmissionOnTime,
  isReportLate,
  todayBangkok,
  thisMonthBangkok,
  bangkokHour,
  monthsAgoBangkok,
  trainingPlanHasAttachment,
  computeDailyAvgScores,
  buildAvgScoreSparklineSvg
} from "../js/ui-utils.js";

const ts = (date) => ({ toDate: () => date });

test("escapeHtml: escapes the five HTML-significant characters", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("escapeHtml: neutralises an XSS payload (no raw < or > survive)", () => {
  const out = escapeHtml("<img src=x onerror=alert(1)>");
  assert.ok(!out.includes("<") && !out.includes(">"));
});

test("escapeHtml: null/undefined become empty string, other values are stringified", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(12.5), "12.5");
});

test("safeHttpUrl: accepts https and escapes quotes so attributes cannot be closed early", () => {
  assert.equal(safeHttpUrl("https://firebasestorage.googleapis.com/a.jpg"), "https://firebasestorage.googleapis.com/a.jpg");
  assert.equal(safeHttpUrl("HTTPS://example.com/x"), "HTTPS://example.com/x");
  assert.equal(safeHttpUrl('https://a.com/"onerror="x'), "https://a.com/&quot;onerror=&quot;x");
});

test("safeHttpUrl: rejects everything that is not an https string", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "http://a.com", "//a.com", "", null, undefined, 42, {}]) {
    assert.equal(safeHttpUrl(bad), "", `should reject ${String(bad)}`);
  }
});

test("monthDateRange: string range covering the whole month", () => {
  assert.deepEqual(monthDateRange("2026-03"), { start: "2026-03-01", end: "2026-03-31" });
});

test("teamDateRangeQuery: always filters by team equality plus the date range (required by firestore.rules)", () => {
  const q = teamDateRangeQuery("sessions", "THAWEE SC", "2026-03-01", "2026-03-31");
  assert.equal(q.source.name, "sessions");
  assert.deepEqual(q.constraints, [
    { type: "where", field: "team", op: "==", value: "THAWEE SC" },
    { type: "where", field: "date", op: ">=", value: "2026-03-01" },
    { type: "where", field: "date", op: "<=", value: "2026-03-31" }
  ]);
});

test("monthQuery: team-scoped when a team is given, date-range only for admin (no team)", () => {
  const scoped = monthQuery("attendance", "KHAMPHEE FOOTBALL", "2026-03");
  assert.ok(scoped.constraints.some((c) => c.field === "team" && c.op === "==" && c.value === "KHAMPHEE FOOTBALL"));
  const all = monthQuery("attendance", null, "2026-03");
  assert.ok(!all.constraints.some((c) => c.field === "team"));
  assert.equal(all.constraints.length, 2);
});

test("coach positions: labels and multi-age-group rule", () => {
  assert.equal(coachPositionLabel("head_coach"), "Head Coach");
  assert.equal(coachPositionLabel("nope"), "-");
  assert.equal(coachPositionAllowsMultipleAgeGroups("head_coach"), false);
  assert.equal(coachPositionAllowsMultipleAgeGroups("assistant_coach"), false);
  assert.equal(coachPositionAllowsMultipleAgeGroups("gk_coach"), true);
  assert.equal(coachPositionAllowsMultipleAgeGroups("fitness_coach"), true);
});

test("computeAvgScore: averages only filled categories, null when none", () => {
  assert.equal(computeAvgScore(null), null);
  assert.equal(computeAvgScore({}), null);
  assert.equal(computeAvgScore({ physical: 4, ballSkill: 2 }), 3);
  assert.equal(computeAvgScore({ physical: 5, ballSkill: 5, gameReading: 5, attitude: 5 }), 5);
});

test("isPlayerFullyEvaluated: present players need all 4 scores, other statuses need none", () => {
  assert.equal(isPlayerFullyEvaluated(null), false);
  assert.equal(isPlayerFullyEvaluated({}), false);
  assert.equal(isPlayerFullyEvaluated({ status: "I" }), true);
  assert.equal(isPlayerFullyEvaluated({ status: "A", scores: { physical: 3, ballSkill: 3, gameReading: 3 } }), false);
  assert.equal(isPlayerFullyEvaluated({ status: "A", scores: { physical: 3, ballSkill: 3, gameReading: 3, attitude: 3 } }), true);
});

test("isPlayerOwnedByCoach: position and age group decide ownership", () => {
  const gk = { id: "1", ageGroup: "U12", position: "GK" };
  const cm = { id: "2", ageGroup: "U12", position: "CM" };
  const other = { id: "3", ageGroup: "U14", position: "CM" };
  const head = { coachPosition: "head_coach", ageGroups: ["U12"] };
  const gkCoach = { coachPosition: "gk_coach", ageGroups: ["U12", "U14"] };
  const fitness = { coachPosition: "fitness_coach", ageGroups: ["U12"] };
  assert.equal(isPlayerOwnedByCoach(head, gk), false);
  assert.equal(isPlayerOwnedByCoach(head, cm), true);
  assert.equal(isPlayerOwnedByCoach(head, other), false);
  assert.equal(isPlayerOwnedByCoach(gkCoach, gk), true);
  assert.equal(isPlayerOwnedByCoach(gkCoach, cm), false);
  assert.equal(isPlayerOwnedByCoach(fitness, gk), true);
  assert.equal(isPlayerOwnedByCoach({ coachPosition: "head_coach" }, cm), false);
  assert.deepEqual([...getCoachPlayerIds(head, [gk, cm, other])], ["2"]);
});

test("age group ordering: numeric, not alphabetical; no number sorts last", () => {
  assert.equal(ageGroupNumber("U9"), 9);
  assert.equal(ageGroupNumber("U10"), 10);
  assert.equal(ageGroupNumber("ไม่ระบุรุ่นอายุ"), Infinity);
  assert.ok(ageGroupSortKey(["U9"]) < ageGroupSortKey(["U10"]));
  assert.equal(ageGroupSortKey(["U14", "U10"]), 10);
  assert.equal(ageGroupSortKey([]), Infinity);
  assert.equal(ageGroupSortKey(undefined), Infinity);
});

test("calcAge: birthday not yet reached this year subtracts one", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-06-15T12:00:00+07:00") });
  assert.equal(calcAge("2014-06-15"), 12);
  assert.equal(calcAge("2014-06-16"), 11);
  assert.equal(calcAge("2014-01-01"), 12);
  assert.equal(calcAge("2014-06-15T00:00:00Z"), 12);
  assert.equal(calcAge(""), null);
  assert.equal(calcAge("not a date"), null);
});

test("isTrainingPlanLate: after 14:00 of the plan date is late", () => {
  assert.equal(isTrainingPlanLate({ date: "2026-03-10", updatedAt: ts(new Date("2026-03-10T13:59:00+07:00")) }), false);
  assert.equal(isTrainingPlanLate({ date: "2026-03-10", updatedAt: ts(new Date("2026-03-10T14:01:00+07:00")) }), true);
  assert.equal(isTrainingPlanLate({ date: "2026-03-10", updatedAt: ts(new Date("2026-03-11T08:00:00+07:00")) }), true);
  assert.equal(isTrainingPlanLate({ date: "2026-03-10" }), false);
});

test("submission deadline is 23:59:59 local time on the session date", () => {
  assert.deepEqual(submissionDeadlineFor("2026-03-10"), new Date("2026-03-10T23:59:59+07:00"));
});

test("isReportLate: after 23:59:59 of the report date is late", () => {
  assert.equal(isReportLate({ date: "2026-03-10", updatedAt: ts(new Date("2026-03-10T23:59:59+07:00")) }), false);
  assert.equal(isReportLate({ date: "2026-03-10", updatedAt: ts(new Date("2026-03-11T00:00:01+07:00")) }), true);
  assert.equal(isReportLate({ date: "2026-03-10" }), false);
});

test("isCoachSubmissionOnTime: uses the latest attendance save; none means not on time", () => {
  const session = { date: "2026-03-10" };
  const early = { updatedAt: ts(new Date("2026-03-10T18:00:00+07:00")) };
  const late = { updatedAt: ts(new Date("2026-03-11T09:00:00+07:00")) };
  assert.equal(isCoachSubmissionOnTime(session, [early]), true);
  assert.equal(isCoachSubmissionOnTime(session, [early, late]), false);
  assert.equal(isCoachSubmissionOnTime(session, []), false);
  assert.equal(isCoachSubmissionOnTime({}, [early]), false);
});

// ---------- เวลาไทย (UTC+7): เดิมใช้วันที่ตาม UTC ทำให้ 00:00-07:00 น. ได้ "เมื่อวาน" ----------
test("todayBangkok: 00:00-06:59 Thai time is already the new day (17:00-23:59 UTC of the previous day)", () => {
  assert.equal(todayBangkok(new Date("2026-03-10T16:59:59Z")), "2026-03-10");
  assert.equal(todayBangkok(new Date("2026-03-10T17:00:00Z")), "2026-03-11");
  assert.equal(todayBangkok(new Date("2026-03-11T06:00:00+07:00")), "2026-03-11");
  assert.equal(todayBangkok(new Date("2026-03-11T00:00:00+07:00")), "2026-03-11");
  assert.equal(todayBangkok(new Date("2026-03-10T23:59:59+07:00")), "2026-03-10");
});

test("thisMonthBangkok: first minutes of the 1st in Thailand already belong to the new month", () => {
  assert.equal(thisMonthBangkok(new Date("2026-02-28T17:00:00Z")), "2026-03");
  assert.equal(thisMonthBangkok(new Date("2026-02-28T16:59:00Z")), "2026-02");
  assert.equal(thisMonthBangkok(new Date("2025-12-31T17:00:00Z")), "2026-01");
});

test("bangkokHour: hour of day in Thailand regardless of machine timezone", () => {
  assert.equal(bangkokHour(new Date("2026-03-10T07:00:00Z")), 14);
  assert.equal(bangkokHour(new Date("2026-03-10T17:00:00Z")), 0);
  assert.equal(bangkokHour(new Date("2026-03-10T16:59:00Z")), 23);
});

test("monthsAgoBangkok: steps back whole months, across year boundaries and short months", () => {
  const now = new Date("2026-03-31T10:00:00+07:00");
  assert.equal(monthsAgoBangkok(0, now), "2026-03");
  assert.equal(monthsAgoBangkok(1, now), "2026-02");
  assert.equal(monthsAgoBangkok(3, now), "2025-12");
  assert.equal(monthsAgoBangkok(14, now), "2025-01");
});

test("trainingPlanHasAttachment: a plan needs a new file or a kept existing file", () => {
  assert.equal(trainingPlanHasAttachment({ hasNewFile: false, existingFileUrl: null, removeExisting: false }), false);
  assert.equal(trainingPlanHasAttachment({ hasNewFile: true, existingFileUrl: null, removeExisting: false }), true);
  assert.equal(trainingPlanHasAttachment({ hasNewFile: false, existingFileUrl: "https://x/y.pdf", removeExisting: false }), true);
  // ลบไฟล์เดิมแล้วยังไม่เลือกไฟล์ใหม่ = ไม่มีไฟล์ ส่งไม่ได้
  assert.equal(trainingPlanHasAttachment({ hasNewFile: false, existingFileUrl: "https://x/y.pdf", removeExisting: true }), false);
  // ลบไฟล์เดิมแต่เลือกไฟล์ใหม่ = ส่งได้
  assert.equal(trainingPlanHasAttachment({ hasNewFile: true, existingFileUrl: "https://x/y.pdf", removeExisting: true }), true);
  assert.equal(trainingPlanHasAttachment({ hasNewFile: false, existingFileUrl: "", removeExisting: false }), false);
});

test("computeDailyAvgScores: groups by date and averages across players, dropping records with no score yet", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-20T12:00:00+07:00") });
  const records = [
    { date: "2026-03-18", scores: { physical: 4, ballSkill: 4, gameReading: 4, attitude: 4 } }, // avg 4
    { date: "2026-03-18", scores: { physical: 2, ballSkill: 2, gameReading: 2, attitude: 2 } }, // avg 2 -> day avg (4+2)/2=3
    { date: "2026-03-19", scores: { physical: 3, ballSkill: 3, gameReading: 3, attitude: 3 } }, // avg 3
    { date: "2026-03-19", status: "I" }, // ไม่มีคะแนน (ลา/บาดเจ็บ) ไม่นับ
    { date: "2025-01-01", scores: { physical: 1, ballSkill: 1, gameReading: 1, attitude: 1 } } // เกิน 30 วัน ไม่นับ
  ];
  const days = computeDailyAvgScores(records, 30);
  assert.deepEqual(days.map((d) => d.date), ["2026-03-18", "2026-03-19"]);
  assert.equal(days[0].avg, 3);
  assert.equal(days[1].avg, 3);
});

test("computeDailyAvgScores: empty or all-unscored input gives an empty list", () => {
  assert.deepEqual(computeDailyAvgScores([], 30), []);
  assert.deepEqual(computeDailyAvgScores([{ date: "2026-03-18", status: "I" }], 30), []);
});

test("buildAvgScoreSparklineSvg: renders a path for 2+ points, a placeholder message otherwise", () => {
  assert.match(buildAvgScoreSparklineSvg([{ date: "2026-03-18", avg: 3 }, { date: "2026-03-19", avg: 3.5 }]), /<svg/);
  assert.match(buildAvgScoreSparklineSvg([{ date: "2026-03-18", avg: 3 }]), /ยังไม่มีข้อมูล/);
  assert.match(buildAvgScoreSparklineSvg([]), /ยังไม่มีข้อมูล/);
});
