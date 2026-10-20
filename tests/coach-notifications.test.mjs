import { test } from "node:test";
import assert from "node:assert/strict";
import { athleteResultsNotification, fitnessRoundNotification, screenLink, unreadNotesNotification } from "../js/coach-notifications.js";

const W = (o) => ({ id: "w", team: "ALL", startMonth: "2026-08", endMonth: "2026-10", openDate: "2026-10-15", closeDate: "2026-10-29", status: "open", ...o });
const ts = (iso) => ({ toDate: () => new Date(iso) });

test("screenLink points at a coach screen in attendance.html", () => {
  assert.equal(screenLink("meeting-next"), "./attendance.html#screen=meeting-next");
});

test("athleteResultsNotification: only while a window for the team is open; shows the period and days left", () => {
  const n = athleteResultsNotification([W({})], "THAWEE SC", "2026-10-20");
  assert.equal(n.link, "./attendance.html#screen=athlete-results");
  assert.match(n.detail, /ส\.ค\.–ต\.ค\. 2026/);
  assert.match(n.detail, /29 ต\.ค\. 2026/);
  assert.match(n.detail, /เหลือ 9 วัน/);
  assert.equal(n.read, true);
  assert.match(athleteResultsNotification([W({ closeDate: "2026-10-20" })], "THAWEE SC", "2026-10-20").detail, /วันสุดท้าย/);
  assert.equal(athleteResultsNotification([W({})], "THAWEE SC", "2026-10-10"), null, "not open yet");
  assert.equal(athleteResultsNotification([W({ status: "closed" })], "THAWEE SC", "2026-10-20"), null, "closed by the admin");
  assert.equal(athleteResultsNotification([W({ team: "KHAMPHEE FOOTBALL" })], "THAWEE SC", "2026-10-20"), null, "other team");
  assert.equal(athleteResultsNotification([], "THAWEE SC", "2026-10-20"), null);
});

const R = (o) => ({ id: "r", roundType: "reeval", openDate: "2026-10-12", closeDate: "2026-10-25", makeupUntil: "2026-11-08", status: "open", ...o });

test("fitnessRoundNotification: open round shows the entry deadline, makeup period shows the makeup deadline, nothing otherwise", () => {
  const open = fitnessRoundNotification([R({})], "2026-10-20");
  assert.equal(open.link, "./attendance.html#screen=fitness");
  assert.match(open.detail, /Re-evaluation ต\.ค\. 2026/);
  assert.match(open.detail, /กรอกผลได้ถึง 25 ต\.ค\. 2026/);
  assert.match(fitnessRoundNotification([R({})], "2026-10-30").detail, /ทดสอบซ่อมได้ถึง 8 พ\.ย\. 2026/);
  assert.equal(fitnessRoundNotification([R({})], "2026-10-01"), null, "not open yet");
  assert.equal(fitnessRoundNotification([R({})], "2026-11-20"), null, "closed");
  assert.equal(fitnessRoundNotification([R({ status: "closed" })], "2026-10-20"), null);
  assert.equal(fitnessRoundNotification([], "2026-10-20"), null);
});

test("unreadNotesNotification: counts unread admin messages and quotes the newest; nothing when all are read", () => {
  const notes = [
    { id: "a", read: true, refLabel: "เก่า", createdAt: ts("2026-10-01T00:00:00Z") },
    { id: "b", read: false, refLabel: "แจ้งพัฒนาการนักกีฬา", createdAt: ts("2026-10-18T00:00:00Z") },
    { id: "c", read: false, message: "ข้อความยาวไม่มีหัวข้อ", createdAt: ts("2026-10-10T00:00:00Z") }
  ];
  const n = unreadNotesNotification(notes);
  assert.match(n.title, /2 รายการ/);
  assert.match(n.detail, /แจ้งพัฒนาการนักกีฬา/);
  assert.equal(n.link, "./attendance.html#screen=daily");
  assert.equal(unreadNotesNotification(notes.filter((x) => x.read)), null);
  assert.equal(unreadNotesNotification([]), null);
  const evil = unreadNotesNotification([{ read: false, refLabel: "<img src=x onerror=1>", createdAt: ts("2026-10-18T00:00:00Z") }]);
  assert.ok(!evil.detail.includes("<img"));
});
