import { test } from "node:test";
import assert from "node:assert/strict";
import { execDashboardModel, execDashboardHtml, WATCH_ATTENDANCE_PCT } from "../js/exec-dashboard.js";

const today = "2026-10-22";
const players = [
  { id: "p1", ageGroup: "U15" },
  { id: "p2", ageGroup: "U15" },
  { id: "p3", ageGroup: "U16" },
  { id: "p4", ageGroup: "U16" }
];
const rec = (playerId, date, status, score) => ({ playerId, date, status, scores: score === undefined ? undefined : { a: score } });
// เวลาส่งแผน: ตรงเวลา = 08:00 ของวันนั้น, สาย = เที่ยงคืนของวันถัดไป (เลยเส้นตายของวันนั้น)
const nextDay = (d) => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
const plan = (date, coachName, ageGroups, late) => ({ date, coachName, ageGroups, updatedAt: { toDate: () => new Date(late ? `${nextDay(date)}T00:00:00+07:00` : `${date}T08:00:00+07:00`) } });

test("exec dashboard: month attendance %, delta vs previous month, per age group", () => {
  const attendance = [
    rec("p1", "2026-10-01", "A"), rec("p2", "2026-10-01", "A"), rec("p3", "2026-10-01", "A"), rec("p4", "2026-10-01", "ลา"),
    rec("p1", "2026-09-10", "A"), rec("p2", "2026-09-10", "ลา"), rec("p3", "2026-09-10", "ลา"), rec("p4", "2026-09-10", "ลา"),
    rec("zz", "2026-10-01", "A") // ไม่ใช่นักกีฬาของทีมนี้
  ];
  const m = execDashboardModel({ today, players, attendance });
  assert.equal(m.kpis.players, 4);
  assert.equal(m.kpis.groupCount, 2);
  assert.equal(m.kpis.attendance.pct, 75);
  assert.equal(m.kpis.attendance.delta, 50);
  assert.deepEqual(m.groups.map((g) => [g.ageGroup, g.players, g.pct]), [["U15", 2, 100], ["U16", 2, 50]]);
});

test("exec dashboard: no data gives dashes and null, never NaN", () => {
  const m = execDashboardModel({ today, players: [] });
  assert.equal(m.kpis.attendance.pct, null);
  assert.equal(m.kpis.attendance.delta, null);
  assert.equal(m.kpis.plan.onTimePct, null);
  assert.deepEqual(m.groups, []);
  assert.deepEqual(m.watch, []);
  const html = execDashboardHtml(m, { team: "THAWEE SC", monthLabel: "ตุลาคม 2569" });
  assert.equal(/NaN|undefined|null/.test(html), false);
  assert.ok(html.includes("ยังไม่มีนักกีฬาในทีมนี้"));
});

test("exec dashboard: matches W-D-L per month and per age group, recent 3 newest first", () => {
  const matches = [
    { date: "2026-10-03", ageGroup: "U15", result: "ชนะ", opponent: "A", scoreUs: 2, scoreThem: 0 },
    { date: "2026-10-10", ageGroup: "U15", result: "เสมอ", opponent: "B", scoreUs: 1, scoreThem: 1 },
    { date: "2026-10-17", ageGroup: "U16", result: "แพ้", opponent: "C", scoreUs: 0, scoreThem: 2 },
    { date: "2026-10-20", ageGroup: "U16", result: "ชนะ", opponent: "D", scoreUs: 3, scoreThem: 1 },
    { date: "2026-09-28", ageGroup: "U16", result: "ชนะ", opponent: "old", scoreUs: 1, scoreThem: 0 }
  ];
  const m = execDashboardModel({ today, players, matches });
  assert.deepEqual([m.kpis.match.win, m.kpis.match.draw, m.kpis.match.lose, m.kpis.match.total], [2, 1, 1, 4]);
  assert.deepEqual(m.groups.map((g) => g.match), [{ win: 1, draw: 1, lose: 0 }, { win: 1, draw: 0, lose: 1 }]);
  assert.deepEqual(m.recentMatches.map((x) => x.opponent), ["D", "C", "B"]);
});

test("exec dashboard: plan on-time %, late coaches and low-attendance groups go to the watch list", () => {
  const attendance = [rec("p1", "2026-10-02", "A"), rec("p2", "2026-10-02", "A"), rec("p3", "2026-10-02", "A"), rec("p4", "2026-10-02", "ลา")];
  const plans = [plan("2026-10-05", "โค้ชเอ", ["U15"], true), plan("2026-10-06", "โค้ชเอ", ["U15"], true), plan("2026-10-07", "โค้ชเอ", ["U15"], false), plan("2026-10-08", "โค้ชบี", ["U16"], true)];
  const injuries = [
    { ageGroup: "U16", severity: "รุนแรง", status: "กำลังพักฟื้น" },
    { ageGroup: "U16", severity: "เล็กน้อย", status: "หายแล้ว" },
    { ageGroup: "U15", severity: "ปานกลาง", status: "กำลังพักฟื้น", actualReturnDate: "2026-10-01" }
  ];
  const m = execDashboardModel({ today, players, attendance, plans, injuries });
  assert.deepEqual([m.kpis.plan.total, m.kpis.plan.late, m.kpis.plan.onTimePct], [4, 3, 25]);
  assert.deepEqual(m.kpis.injured, { active: 1, severe: 1 });
  assert.equal(m.groups[1].injured, 1);
  const texts = m.watch.map((w) => w.text);
  assert.ok(texts.some((t) => t.includes("บาดเจ็บรุนแรง 1")));
  assert.ok(texts.some((t) => t.startsWith("U16") && t.includes("50%") && t.includes(`${WATCH_ATTENDANCE_PCT}%`)));
  assert.ok(texts.some((t) => t.startsWith("โค้ชเอ") && t.includes("สาย 2 ครั้งจาก 3")));
  assert.equal(texts.some((t) => t.startsWith("โค้ชบี")), false, "one late plan is below the threshold");
  assert.equal(m.watch[0].tone, "bad", "severe injuries come first");
});

test("exec dashboard: 30-day trend only covers the window and html escapes names", () => {
  const attendance = [rec("p1", "2026-09-01", "A", 4), rec("p1", "2026-09-30", "A", 2), rec("p2", "2026-10-22", "A", 4), rec("p2", "2026-10-21", "ลา", 2)];
  const m = execDashboardModel({ today, players, attendance });
  assert.deepEqual(m.trend.map((p) => p.date), ["2026-09-30", "2026-10-21", "2026-10-22"]);
  assert.equal(m.trend[0].day, 7);
  assert.equal(m.trend.at(-1).day, 29);
  const html = execDashboardHtml({ ...m, watch: [{ tone: "warn", tag: "โค้ช", text: "<img src=x onerror=alert(1)>" }] }, { team: "T<h1>", monthLabel: "x" });
  assert.equal(html.includes("<img src=x"), false);
  assert.equal(html.includes("T<h1>"), false);
  assert.ok(html.includes("<svg"));
});
