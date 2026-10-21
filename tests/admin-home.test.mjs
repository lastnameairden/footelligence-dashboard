import { test } from "node:test";
import assert from "node:assert/strict";
import { adminChartsHtml, adminChartsModel, adminHomeHtml, adminHomeModel, dayKind, isInjuryActive } from "../js/admin-home.js";

const players = [
  { id: "p1", ageGroup: "U13" }, { id: "p2", ageGroup: "U13" },
  { id: "p3", ageGroup: "U14" },
  { id: "p4", ageGroup: "U15" }, { id: "p5", ageGroup: "U15" }
];
const coaches = [
  { id: "c13", name: "โค้ชปิ", ageGroups: ["U13"] },
  { id: "c14", name: "โค้ชกัสตี้", ageGroups: ["U14"] }
];
const today = "2026-10-21";
const base = { today, trainsToday: true, players, coaches, sessions: [{ id: "s1", date: today }], attendance: [], plans: [], reports: [], injuries: [], pendingApprovals: 0 };

test("dayKind: no_training wins, a session or a team training weekday means training, otherwise rest", () => {
  assert.equal(dayKind({ session: { noTraining: true }, trainsToday: true }), "no_training");
  assert.equal(dayKind({ session: { id: "s" }, trainsToday: false }), "training");
  assert.equal(dayKind({ session: null, trainsToday: true }), "training");
  assert.equal(dayKind({ session: null, trainsToday: false }), "rest");
});

test("isInjuryActive: not healed and no actual return date", () => {
  assert.equal(isInjuryActive({ status: "บาดเจ็บขณะฝึกซ้อม" }), true);
  assert.equal(isInjuryActive({ status: "หายแล้ว" }), false);
  assert.equal(isInjuryActive({ status: "กำลังพักฟื้น", actualReturnDate: "2026-10-01" }), false);
  assert.equal(isInjuryActive(null), false);
});

test("adminHomeModel: per age group check-in / plan / report states on a training day", () => {
  const m = adminHomeModel({
    ...base,
    attendance: [
      { sessionId: "s1", playerId: "p1", status: "A" }, { sessionId: "s1", playerId: "p2", status: "P" }, // U13 ครบ
      { sessionId: "s1", playerId: "p4", status: "A" } // U15 บางส่วน
    ],
    plans: [{ ageGroups: ["U13", "U14"] }],
    reports: [{ coachId: "c13", coachName: "โค้ชปิ" }]
  });
  assert.equal(m.kind, "training");
  const byGroup = Object.fromEntries(m.rows.map((r) => [r.ageGroup, r]));
  assert.deepEqual([byGroup.U13.checkin, byGroup.U13.plan, byGroup.U13.report], ["done", "ok", "ok"]);
  assert.deepEqual([byGroup.U14.checkin, byGroup.U14.plan, byGroup.U14.report], ["none", "ok", "missing"]);
  assert.deepEqual([byGroup.U15.checkin, byGroup.U15.plan, byGroup.U15.report], ["partial", "missing", "nocoach"]);
  assert.equal(byGroup.U15.checkedCount, 1);
  assert.deepEqual(m.summary, { notChecked: 2, plansMissing: 1, reportsMissing: 1, injured: 0, pendingApprovals: 0 });
});

test("adminHomeModel: attendance of another day's session is ignored; blank status does not count", () => {
  const m = adminHomeModel({ ...base, attendance: [{ sessionId: "old", playerId: "p3", status: "A" }, { sessionId: "s1", playerId: "p3", status: "" }] });
  assert.equal(m.rows.find((r) => r.ageGroup === "U14").checkin, "none");
});

test("adminHomeModel: no-training and rest days require nothing; injuries and approvals still count", () => {
  const injuries = [{ ageGroup: "U13", status: "บาดเจ็บขณะฝึกซ้อม" }, { ageGroup: "U13", status: "หายแล้ว" }, { ageGroup: "U15", status: "กำลังพักฟื้น" }];
  for (const [sessions, trainsToday, kind] of [[[{ id: "s1", noTraining: true }], true, "no_training"], [[], false, "rest"]]) {
    const m = adminHomeModel({ ...base, sessions, trainsToday, injuries, pendingApprovals: 2 });
    assert.equal(m.kind, kind);
    assert.ok(m.rows.every((r) => r.checkin === "off" && r.plan === "off" && r.report === "off"));
    assert.deepEqual(m.summary, { notChecked: 0, plansMissing: 0, reportsMissing: 0, injured: 2, pendingApprovals: 2 });
  }
  const m = adminHomeModel({ ...base, injuries });
  assert.equal(m.rows.find((r) => r.ageGroup === "U13").injured, 1);
  assert.equal(m.rows.find((r) => r.ageGroup === "U14").injured, 0);
});

test("adminHomeHtml: tiles, per-group rows, escaped text, dashes on off days", () => {
  const html = adminHomeHtml(adminHomeModel({ ...base, coaches: [{ id: "c13", name: "<b>ปิ</b>", ageGroups: ["U13"] }], pendingApprovals: 1 }), { team: "THAWEE SC" });
  assert.match(html, /ภาพรวม THAWEE SC · วันนี้/);
  assert.match(html, /วันซ้อม/);
  assert.match(html, /&lt;b&gt;ปิ&lt;\/b&gt;/);
  assert.match(html, /ยังไม่เช็คชื่อ/);
  assert.match(html, /data-home-go="approvals"/);
  assert.match(html, /data-home-go="injury"/);
  assert.match(html, /ยังไม่มีโค้ช/);
  const off = adminHomeHtml(adminHomeModel({ ...base, sessions: [], trainsToday: false }), { team: "THAWEE SC" });
  assert.match(off, /ไม่ใช่วันซ้อมของทีม/);
  assert.doesNotMatch(off, /ยังไม่เช็คชื่อ/);
  assert.match(adminHomeHtml(adminHomeModel({ ...base, players: [] })), /ยังไม่มีนักกีฬา/);
});

test("adminHomeModel: age filter narrows rows, injuries and summary but not pending approvals", () => {
  const injuries = [{ ageGroup: "U13", status: "บาดเจ็บ" }, { ageGroup: "U15", status: "บาดเจ็บ" }];
  const m = adminHomeModel({ ...base, injuries, pendingApprovals: 3, ageGroup: "U13" });
  assert.deepEqual(m.rows.map((r) => r.ageGroup), ["U13"]);
  assert.equal(m.summary.injured, 1);
  assert.equal(m.summary.pendingApprovals, 3);
  assert.equal(m.summary.notChecked, 1);
  assert.equal(adminHomeModel({ ...base, injuries, ageGroup: "" }).rows.length, 3);
});

const scores = (v) => ({ physical: v, ballSkill: v, gameReading: v, attitude: v });
const rec = (date, playerId, status, v) => ({ date, playerId, status, scores: v === undefined ? {} : scores(v) });

test("adminChartsModel: 30-day trend vs the 30 days before, per-day averages, filter by age group", () => {
  const attendance = [
    rec("2026-10-20", "p1", "A", 4), rec("2026-10-20", "p2", "A", 2), // วันเดียวกัน (U13 เฉลี่ย 3 / รวม U14 ด้วย 2.33)
    rec("2026-10-10", "p1", "A", 3),
    rec("2026-09-10", "p1", "A", 2), // ก่อนหน้า (09-22..10-21 คือช่วงปัจจุบัน → 09-10 อยู่ช่วงก่อนหน้า)
    rec("2026-07-01", "p1", "A", 4), // เก่าเกินไป
    rec("2026-10-20", "p3", "A", 1) // รุ่น U14 ไม่นับเมื่อกรอง U13
  ];
  const all = adminChartsModel({ players, attendance, today });
  assert.deepEqual(all.trend.points.map((p) => [p.date, Math.round(p.avg * 100) / 100]), [["2026-10-10", 3], ["2026-10-20", 2.33]], "10-20 averages p1 4, p2 2 and p3 1");
  assert.equal(Math.round(all.trend.current * 100) / 100, 2.5);
  assert.equal(all.trend.previous, 2);
  assert.equal(all.trend.delta, 0.5);
  const u13 = adminChartsModel({ players, attendance, today, ageGroup: "U13" });
  assert.equal(u13.trend.current, 3);
  assert.deepEqual(u13.groups.map((g) => g.ageGroup), ["U13"]);
});

test("adminChartsModel: this month attendance % uses the Dashboard rule (A or 1-4 attended, leave/injury/rehab not), score average per group", () => {
  const attendance = [
    rec("2026-10-02", "p1", "A", 4), rec("2026-10-02", "p2", "P"), rec("2026-10-03", "p1", "I"), rec("2026-10-03", "p2", "3", 2), // U13: 2 มา / 4
    rec("2026-10-02", "p3", "A", 3), // U14: 1/1
    rec("2026-09-30", "p1", "A", 4), // เดือนก่อน ไม่นับ
    { date: "2026-10-04", playerId: "p4", status: "", scores: {} } // ไม่มีสถานะ ไม่นับ
  ];
  const { groups } = adminChartsModel({ players, attendance, today });
  const by = Object.fromEntries(groups.map((g) => [g.ageGroup, g]));
  assert.deepEqual([by.U13.pct, by.U13.records, by.U13.avgScore], [50, 4, 3]);
  assert.deepEqual([by.U14.pct, by.U14.avgScore], [100, 3]);
  assert.deepEqual([by.U15.pct, by.U15.avgScore, by.U15.records], [null, null, 0]);
});

test("adminChartsModel: empty data gives null trend values; html shows the empty messages", () => {
  const m = adminChartsModel({ players, attendance: [], today });
  assert.deepEqual([m.trend.current, m.trend.previous, m.trend.delta, m.trend.points.length], [null, null, null, 0]);
  const html = adminChartsHtml(m);
  assert.match(html, /ยังไม่มีคะแนนใน 30 วันล่าสุด/);
  assert.equal((html.match(/ยังไม่มีข้อมูลเดือนนี้/g) || []).length, 2);
});

test("adminChartsHtml: sparkline, bars per group with escaped labels, trend text with arrow", () => {
  const attendance = [rec("2026-10-20", "p1", "A", 4), rec("2026-10-19", "p1", "A", 3), rec("2026-09-10", "p1", "A", 2)];
  const html = adminChartsHtml(adminChartsModel({ players, attendance, today }));
  assert.match(html, /<svg/);
  assert.match(html, /เฉลี่ย 3\.5 \/ 4 · เทียบ 30 วันก่อนหน้า ↑ \+1\.5/);
  assert.match(html, /class="admin-bar-label">U13</);
  assert.match(html, /width:100%/);
  assert.match(html, /class="admin-bar-value">100%</);
});