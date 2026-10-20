import { test } from "node:test";
import assert from "node:assert/strict";
import { attendanceView, meetingHistoryRows } from "../js/coach-meetings.js";

const M = (o) => ({ id: "m", month: "2026-10", date: "2026-10-07", coachIds: ["c1", "c2"], attendance: {}, ...o });
const meetings = [
  M({ id: "m1", date: "2026-10-07", attendance: { c1: "attended" } }),
  M({ id: "m2", date: "2026-10-14", attendance: { c1: "leave" } }),
  M({ id: "m3", date: "2026-10-21", attendance: { c1: "attended" } }),
  M({ id: "m4", date: "2026-10-28" }),
  M({ id: "m5", date: "2026-10-14", coachIds: ["c2"], attendance: { c2: "attended" } }) // not this coach
];
const recaps = new Map([["m1", { submittedOn: "2026-10-09", know: "ก", use: "ข" }]]);

test("meetingHistoryRows: only the coach's meetings, newest first, with attendance, recap and status", () => {
  const rows = meetingHistoryRows(meetings, "c1", recaps, "2026-10-22");
  assert.deepEqual(rows.map((r) => r.meeting.id), ["m4", "m3", "m2", "m1"]);
  assert.deepEqual(rows.map((r) => r.attendance), [null, "attended", "leave", "attended"]);
  assert.deepEqual(rows.map((r) => r.status.state), ["upcoming", "pending", "excused", "submitted"]);
  assert.equal(rows[3].recap.know, "ก");
  assert.equal(rows[2].recap, null);
});

test("meetingHistoryRows: an unknown attendance value is treated as not recorded; no meetings gives no rows", () => {
  const rows = meetingHistoryRows([M({ id: "x", attendance: { c1: "???" } })], "c1", new Map(), "2026-10-22");
  assert.equal(rows[0].attendance, null);
  assert.deepEqual(meetingHistoryRows([], "c1", new Map(), "2026-10-22"), []);
});

test("attendanceView: recorded status with tone, future meetings, past meetings the admin has not recorded", () => {
  const rows = meetingHistoryRows(meetings, "c1", recaps, "2026-10-22");
  assert.deepEqual(attendanceView(rows[3], "2026-10-22"), { text: "เข้าร่วม", tone: "success" });
  assert.deepEqual(attendanceView(rows[2], "2026-10-22"), { text: "ลา", tone: "neutral" });
  assert.deepEqual(attendanceView(rows[0], "2026-10-22"), { text: "ยังไม่ถึงวันประชุม", tone: "neutral" });
  const unrecorded = meetingHistoryRows([M({ id: "z", date: "2026-10-01" })], "c1", new Map(), "2026-10-22")[0];
  assert.equal(attendanceView(unrecorded, "2026-10-22").text, "ยังไม่บันทึกผล");
  const absent = meetingHistoryRows([M({ id: "a", attendance: { c1: "absent" } })], "c1", new Map(), "2026-10-22")[0];
  assert.deepEqual(attendanceView(absent, "2026-10-22"), { text: "ขาด", tone: "danger" });
});
