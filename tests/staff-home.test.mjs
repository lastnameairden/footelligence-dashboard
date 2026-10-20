import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  announcementCardHtml,
  announcementTime,
  sortAnnouncements,
  unreadAnnouncements,
  validateAnnouncement
} from "../js/staff-announcements.js";
import { teamRecapSummary } from "../js/coach-meetings.js";

test("validateAnnouncement: both fields required, trimmed, length limited", () => {
  assert.deepEqual(validateAnnouncement({ title: "  ส่งรายงาน ", message: " ภายในวันศุกร์ " }), { value: { title: "ส่งรายงาน", message: "ภายในวันศุกร์" }, error: null });
  assert.match(validateAnnouncement({ title: "", message: "x" }).error, /หัวข้อ/);
  assert.match(validateAnnouncement({ title: "x", message: "  " }).error, /รายละเอียด/);
  assert.match(validateAnnouncement({ title: "ก".repeat(ANNOUNCEMENT_TITLE_MAX + 1), message: "x" }).error, /หัวข้อยาวเกิน/);
  assert.match(validateAnnouncement({ title: "x", message: "ก".repeat(ANNOUNCEMENT_MESSAGE_MAX + 1) }).error, /รายละเอียดยาวเกิน/);
  assert.equal(validateAnnouncement({ title: "ก".repeat(ANNOUNCEMENT_TITLE_MAX), message: "ก".repeat(ANNOUNCEMENT_MESSAGE_MAX) }).error, null);
  assert.equal(validateAnnouncement().value, null);
});

test("announcement time accepts Firestore Timestamps, {seconds} and numbers; newest first; unread vs last seen", () => {
  assert.equal(announcementTime({ createdAt: { toMillis: () => 5000 } }), 5000);
  assert.equal(announcementTime({ createdAt: { seconds: 7 } }), 7000);
  assert.equal(announcementTime({ createdAt: 9 }), 9);
  assert.equal(announcementTime({}), 0);
  const list = [{ id: "a", createdAt: 100 }, { id: "c", createdAt: 300 }, { id: "b", createdAt: 200 }];
  assert.deepEqual(sortAnnouncements(list).map((a) => a.id), ["c", "b", "a"]);
  assert.deepEqual(list.map((a) => a.id), ["a", "c", "b"], "input is not mutated");
  assert.deepEqual(unreadAnnouncements(list, 200).map((a) => a.id), ["c"]);
  assert.equal(unreadAnnouncements(list, 0).length, 3);
  assert.equal(unreadAnnouncements(undefined, 0).length, 0);
});

test("announcement card: escaped text, new badge only when unread", () => {
  const a = { id: "1", title: "<b>x</b>", message: "บรรทัด 1\nบรรทัด 2", createdBy: "แอดมิน", createdAt: Date.UTC(2026, 9, 21, 5) };
  const html = announcementCardHtml(a, { unread: true });
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /badge-warning">ใหม่/);
  assert.match(html, /white-space:pre-line/);
  assert.match(html, /แอดมิน/);
  assert.doesNotMatch(announcementCardHtml(a), /ใหม่/);
});

test("teamRecapSummary: counts waiting / overdue / done and skips leave, absent and future meetings", () => {
  const meeting = (id, date, ids, attendance = {}) => ({ id, month: "2026-10", date, coachIds: ids, coachNames: ids.map((i) => `โค้ช${i}`), attendance });
  const meetings = [
    meeting("m1", "2026-10-07", ["a", "b", "c", "d"], { c: "leave", d: "absent" }),
    meeting("m2", "2026-10-28", ["a", "b"])
  ];
  const recaps = new Map([["m1_a", { submittedOn: "2026-10-08" }]]);
  // วันที่ 20: m1 → a ส่งแล้ว, b รอส่ง, c/d ลา/ขาด; m2 ยังไม่ถึงวัน
  const mid = teamRecapSummary(meetings, recaps, "2026-10-20");
  assert.deepEqual({ w: mid.waiting, o: mid.overdue, d: mid.done }, { w: 1, o: 0, d: 1 });
  assert.deepEqual(mid.waitingCoaches, ["โค้ชb"]);
  // วันที่ 30: เลยกำหนด (วันสุดท้ายที่ส่ง = 29) b ค้าง + นัด m2 ของ a, b ก็ค้าง
  const late = teamRecapSummary(meetings, recaps, "2026-10-30");
  assert.deepEqual({ w: late.waiting, o: late.overdue, d: late.done }, { w: 3, o: 3, d: 1 });
  assert.deepEqual(teamRecapSummary([], new Map(), "2026-10-20"), { waiting: 0, overdue: 0, done: 0, waitingCoaches: [] });
});
