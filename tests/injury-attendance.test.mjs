import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeInjuryByPlayer,
  attendanceStatusForInjury,
  injuryStatusForAttendance,
  planInjuryAutoFill,
  describeInjury,
  buildQuickInjuryReport
} from "../js/injury-attendance.js";
import { applyAttendanceChange, firestoreFieldsForChange } from "../js/attendance-save.js";

const inj = (over) => ({ id: "i1", playerId: "p1", date: "2026-10-01", status: "บาดเจ็บขณะฝึกซ้อม", severity: "ปานกลาง", description: "ข้อเท้าพลิก", ...over });

test("activeInjuryByPlayer: only unhealed reports that started on or before the session date, newest wins", () => {
  const list = [
    inj({ id: "old", date: "2026-09-01" }),
    inj({ id: "new", date: "2026-10-05" }),
    inj({ id: "healed", playerId: "p2", status: "หายแล้ว" }),
    inj({ id: "future", playerId: "p3", date: "2026-10-30" }),
    inj({ id: "other", playerId: "p4", status: "กำลังพักฟื้น" })
  ];
  const map = activeInjuryByPlayer(list, "2026-10-21");
  assert.equal(map.get("p1").id, "new");
  assert.equal(map.has("p2"), false, "healed reports are ignored");
  assert.equal(map.has("p3"), false, "injury that starts after the session is not active yet");
  assert.equal(map.get("p4").id, "other");
  assert.equal(activeInjuryByPlayer(list, "2026-10-02").get("p1").id, "old");
});

test("status mapping between reports and attendance", () => {
  assert.equal(attendanceStatusForInjury({ status: "กำลังพักฟื้น" }), "R");
  assert.equal(attendanceStatusForInjury({ status: "บาดเจ็บขณะแข่งขัน" }), "I");
  assert.equal(attendanceStatusForInjury({ status: "บาดเจ็บขณะฝึกซ้อม" }), "I");
  assert.equal(injuryStatusForAttendance("I"), "บาดเจ็บขณะฝึกซ้อม");
  assert.equal(injuryStatusForAttendance("R"), "กำลังพักฟื้น");
});

test("planInjuryAutoFill fills only players without a status that have an active injury", () => {
  const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
  const attendance = new Map([
    ["p2", { status: "A" }], // โค้ชกดแล้ว ห้ามทับ
    ["p3", { status: undefined, scores: {} }] // มีเอกสารแต่ยังไม่มีสถานะ
  ]);
  const injuries = new Map([
    ["p1", inj({ id: "r1" })],
    ["p2", inj({ id: "r2", playerId: "p2" })],
    ["p3", inj({ id: "r3", playerId: "p3", status: "กำลังพักฟื้น" })]
  ]);
  assert.deepEqual(planInjuryAutoFill(players, attendance, injuries), [
    { playerId: "p1", status: "I", injuryReportId: "r1" },
    { playerId: "p3", status: "R", injuryReportId: "r3" }
  ]);
  assert.deepEqual(planInjuryAutoFill(players, attendance, new Map()), []);
});

test("describeInjury flags a missed expected return date", () => {
  const d = describeInjury(inj({ expectedReturn: "2026-10-10" }), "2026-10-21");
  assert.equal(d.overdue, true);
  assert.match(d.text, /ข้อเท้าพลิก/);
  assert.match(d.text, /คาดกลับ 2026-10-10/);
  assert.equal(describeInjury(inj({ expectedReturn: "2026-10-28" }), "2026-10-21").overdue, false);
  assert.equal(describeInjury(inj({}), "2026-10-21").overdue, false);
});

test("buildQuickInjuryReport needs a description and maps the attendance status", () => {
  const base = { team: "THAWEE SC", player: { id: "p1", ageGroup: "U13" }, playerName: "เจ", date: "2026-10-21", coachId: "c1", coachName: "โค้ชเอ" };
  assert.equal(buildQuickInjuryReport({ ...base, description: "   ", severity: "เล็กน้อย", attendanceStatus: "I" }), null);
  const i = buildQuickInjuryReport({ ...base, description: " ข้อเท้าพลิก ", severity: "ปานกลาง", attendanceStatus: "I" });
  assert.equal(i.description, "ข้อเท้าพลิก");
  assert.equal(i.status, "บาดเจ็บขณะฝึกซ้อม");
  assert.equal(i.severity, "ปานกลาง");
  assert.equal(i.ageGroup, "U13");
  assert.equal(i.team, "THAWEE SC");
  assert.equal(i.expectedReturn, null);
  const r = buildQuickInjuryReport({ ...base, description: "กล้ามเนื้อต้นขา", severity: "ไม่รู้จัก", attendanceStatus: "R" });
  assert.equal(r.status, "กำลังพักฟื้น");
  assert.equal(r.severity, "เล็กน้อย", "unknown severity falls back to the mildest");
});

test("attendance change can carry the injury report link (and clear it with null)", () => {
  const withLink = applyAttendanceChange({ status: "A", scores: { physical: 3 } }, { status: "I", injuryReportId: "r1" });
  assert.equal(withLink.injuryReportId, "r1");
  assert.deepEqual(withLink.scores, {});
  assert.deepEqual(firestoreFieldsForChange({ status: "I", injuryReportId: "r1" }), { status: "I", scores: {}, injuryReportId: "r1" });
  assert.deepEqual(firestoreFieldsForChange({ status: "A", injuryReportId: null }), { status: "A", injuryReportId: null });
  // ไม่ส่งมา = ไม่แตะค่าเดิม (พฤติกรรมเดิมไม่เปลี่ยน)
  assert.deepEqual(firestoreFieldsForChange({ status: "A" }), { status: "A" });
  assert.equal("injuryReportId" in applyAttendanceChange({ status: "I", injuryReportId: "r1" }, { status: "A" }), true);
  assert.equal(applyAttendanceChange({ status: "I", injuryReportId: "r1" }, { status: "A" }).injuryReportId, "r1");
});
