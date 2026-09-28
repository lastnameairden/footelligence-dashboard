import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAttendanceChange, firestoreFieldsForChange, createSaveQueue, rosterLockState } from "../js/attendance-save.js";

const fixedNow = () => new Date("2026-03-10T10:00:00Z");

test("applyAttendanceChange: choosing a status keeps existing scores only for A", () => {
  const prev = { status: "A", scores: { physical: 3 } };
  assert.deepEqual(applyAttendanceChange(prev, { status: "A" }, fixedNow).scores, { physical: 3 });
  assert.deepEqual(applyAttendanceChange(prev, { status: "I" }, fixedNow).scores, {});
  assert.equal(applyAttendanceChange(prev, { status: "P" }, fixedNow).status, "P");
});

test("applyAttendanceChange: does not mutate the previous state and works from nothing", () => {
  const prev = { status: "A", scores: { physical: 3 } };
  const next = applyAttendanceChange(prev, { category: "attitude", value: 4 }, fixedNow);
  assert.deepEqual(prev, { status: "A", scores: { physical: 3 } });
  assert.deepEqual(next.scores, { physical: 3, attitude: 4 });
  assert.equal(next.status, "A");
  assert.deepEqual(applyAttendanceChange(undefined, { status: "A" }, fixedNow).status, "A");
  assert.deepEqual(applyAttendanceChange(undefined, { category: "physical", value: 2 }, fixedNow).scores, { physical: 2 });
});

test("applyAttendanceChange: two quick score taps compose (no lost update)", () => {
  // เดิมแต่ละการแตะคำนวณจากสำเนาเก่า ทำให้แตะที่สองทับแตะแรก — ตอนนี้ต่อจากผลก่อนหน้าเสมอ
  let state = { status: "A", scores: {} };
  state = applyAttendanceChange(state, { category: "physical", value: 3 }, fixedNow);
  state = applyAttendanceChange(state, { category: "ballSkill", value: 4 }, fixedNow);
  state = applyAttendanceChange(state, { category: "gameReading", value: 2 }, fixedNow);
  assert.deepEqual(state.scores, { physical: 3, ballSkill: 4, gameReading: 2 });
});

test("applyAttendanceChange: local updatedAt behaves like a Firestore timestamp", () => {
  const next = applyAttendanceChange({}, { status: "A" }, fixedNow);
  assert.equal(next.updatedAt.toDate().toISOString(), "2026-03-10T10:00:00.000Z");
});

test("firestoreFieldsForChange: score writes only the tapped category; non-A status clears scores", () => {
  assert.deepEqual(firestoreFieldsForChange({ category: "physical", value: 3 }), { scores: { physical: 3 } });
  assert.deepEqual(firestoreFieldsForChange({ status: "A" }), { status: "A" });
  assert.deepEqual(firestoreFieldsForChange({ status: "R" }), { status: "R", scores: {} });
});

// ตัวช่วย: งานที่ค้างจนกว่าจะสั่ง resolve/reject เอง เพื่อพิสูจน์ลำดับการทำงานของคิว
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}
const tick = () => new Promise((r) => setImmediate(r));

test("save queue: tasks for the same key run one at a time, in the order they were added", async () => {
  const q = createSaveQueue();
  const log = [];
  const gate1 = deferred();
  q.enqueue("p1", async () => { log.push("start1"); await gate1.promise; log.push("end1"); });
  q.enqueue("p1", async () => { log.push("start2"); log.push("end2"); });
  await tick();
  assert.deepEqual(log, ["start1"], "second task must wait for the first");
  gate1.resolve();
  await q.idle();
  assert.deepEqual(log, ["start1", "end1", "start2", "end2"]);
});

test("save queue: different keys run in parallel", async () => {
  const q = createSaveQueue();
  const started = [];
  const gate = deferred();
  q.enqueue("a", async () => { started.push("a"); await gate.promise; });
  q.enqueue("b", async () => { started.push("b"); await gate.promise; });
  await tick();
  assert.deepEqual(started.sort(), ["a", "b"]);
  gate.resolve();
  await q.idle();
});

test("save queue: pending count is reported on every change and returns to zero", async () => {
  const seen = [];
  const q = createSaveQueue({ onChange: (n) => seen.push(n) });
  const gate = deferred();
  q.enqueue("a", () => gate.promise);
  q.enqueue("a", async () => {});
  q.enqueue("b", async () => {});
  assert.equal(q.pending, 3);
  gate.resolve();
  await q.idle();
  assert.equal(q.pending, 0);
  assert.equal(seen[0], 1);
  assert.equal(seen.at(-1), 0);
  assert.equal(Math.max(...seen), 3);
});

test("save queue: a failing task reports the error and does not block later tasks for that key", async () => {
  const errors = [];
  const q = createSaveQueue({ onError: (err, key) => errors.push([err.message, key]) });
  const ran = [];
  q.enqueue("p1", async () => { throw new Error("permission-denied"); });
  q.enqueue("p1", async () => { ran.push("after"); });
  await q.idle();
  assert.deepEqual(errors, [["permission-denied", "p1"]]);
  assert.deepEqual(ran, ["after"]);
  assert.equal(q.pending, 0);
});

test("save queue: onChange fires with 0 only after the last task and errors were reported", async () => {
  const order = [];
  const q = createSaveQueue({
    onChange: (n) => order.push(`pending:${n}`),
    onError: () => order.push("error")
  });
  q.enqueue("p1", async () => { throw new Error("x"); });
  await q.idle();
  assert.deepEqual(order, ["pending:1", "error", "pending:0"]);
});

test("rosterLockState: complete roster stays editable on the training day, locks from the next day", () => {
  const base = { complete: true, isAdmin: false };
  assert.equal(rosterLockState({ ...base, sessionDate: "2026-03-10", today: "2026-03-10" }), "complete-editable");
  assert.equal(rosterLockState({ ...base, sessionDate: "2026-03-10", today: "2026-03-11" }), "locked");
  assert.equal(rosterLockState({ ...base, sessionDate: "2026-03-10", today: "2026-04-01" }), "locked");
  // วันที่ในอนาคต (ยังไม่ถึงวันซ้อม) ไม่ล็อก
  assert.equal(rosterLockState({ ...base, sessionDate: "2026-03-12", today: "2026-03-10" }), "complete-editable");
});

test("rosterLockState: incomplete rosters and admins are never locked", () => {
  assert.equal(rosterLockState({ complete: false, isAdmin: false, sessionDate: "2026-03-01", today: "2026-03-10" }), "editable");
  assert.equal(rosterLockState({ complete: true, isAdmin: true, sessionDate: "2026-03-01", today: "2026-03-10" }), "editable");
});

test("rosterLockState: without a session date it does not lock", () => {
  assert.equal(rosterLockState({ complete: true, isAdmin: false, sessionDate: "", today: "2026-03-10" }), "complete-editable");
  assert.equal(rosterLockState({ complete: true, isAdmin: false, sessionDate: undefined, today: "2026-03-10" }), "complete-editable");
});
