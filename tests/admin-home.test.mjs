import { test } from "node:test";
import assert from "node:assert/strict";
import { adminHomeHtml, adminHomeModel, dayKind, isInjuryActive } from "../js/admin-home.js";

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
