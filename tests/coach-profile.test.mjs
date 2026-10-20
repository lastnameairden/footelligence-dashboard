import { test } from "node:test";
import assert from "node:assert/strict";
import { ageGroupRows, monthlyStats, profileInfoHtml, profileStatsHtml } from "../js/coach-profile.js";

const ts = (iso) => ({ toDate: () => new Date(iso) });
const coach = { id: "c1", name: "โค้ชเอก", email: "ek@example.com", status: "approved", coachPosition: "head_coach", ageGroups: ["U17", "U16"], createdAt: ts("2026-05-12T03:00:00Z") };

const players = [
  { id: "p1", ageGroup: "U16", position: "CM" },
  { id: "p2", ageGroup: "U16", position: "GK" },
  { id: "p3", ageGroup: "U17", position: "ST" },
  { id: "p4", ageGroup: "U18", position: "CM" }
];

test("ageGroupRows: youngest first, counts only the players this coach is responsible for (head coach excludes GK)", () => {
  assert.deepEqual(ageGroupRows(coach, players), [{ ageGroup: "U16", count: 1 }, { ageGroup: "U17", count: 1 }]);
  assert.deepEqual(ageGroupRows({ ...coach, coachPosition: "gk_coach" }, players), [{ ageGroup: "U16", count: 1 }, { ageGroup: "U17", count: 0 }]);
  assert.deepEqual(ageGroupRows({ ageGroups: [] }, players), []);
});

const sessions = [
  { id: "s1", date: "2026-10-05" },
  { id: "s1b", date: "2026-10-05" },
  { id: "s2", date: "2026-10-06" },
  { id: "s3", date: "2026-10-07", noTraining: true },
  { id: "s4", date: "2026-09-30" }
];
const att = (sessionId, playerId, iso) => ({ sessionId, playerId, updatedAt: ts(iso) });
const attendance = [
  att("s1b", "p1", "2026-10-05T10:00:00Z"), // on time (17:00 Bangkok)
  att("s2", "p1", "2026-10-07T01:00:00Z"), // late (after 23:59 on the 6th)
  att("s2", "p2", "2026-10-06T10:00:00Z"), // GK: not this coach's player, ignored
  att("s4", "p1", "2026-09-30T10:00:00Z") // other month
];
const plans = [
  { date: "2026-10-05", coachId: "c1", updatedAt: ts("2026-10-05T01:00:00Z") }, // 08:00 on time
  { date: "2026-10-06", coachName: "โค้ชเอก", updatedAt: ts("2026-10-06T08:00:00Z") }, // 15:00 late
  { date: "2026-10-06", coachId: "other", coachName: "คนอื่น", updatedAt: ts("2026-10-06T01:00:00Z") },
  { date: "2026-09-29", coachId: "c1", updatedAt: ts("2026-09-29T01:00:00Z") }
];
const reports = [
  { date: "2026-10-05", coachId: "c1", updatedAt: ts("2026-10-05T12:00:00Z") },
  { date: "2026-10-06", coachId: "c1", updatedAt: ts("2026-10-07T03:00:00Z") }, // late
  { date: "2026-10-06", coachId: "other", coachName: "คนอื่น" }
];
const meetings = [
  { date: "2026-10-07", coachIds: ["c1", "c2"], attendance: { c1: "attended" } },
  { date: "2026-10-14", coachIds: ["c1"], attendance: { c1: "leave" } },
  { date: "2026-10-21", coachIds: ["c1"], attendance: { c1: "absent" } },
  { date: "2026-10-28", coachIds: ["c1"], attendance: {} },
  { date: "2026-10-14", coachIds: ["c2"], attendance: { c2: "attended" } }
];

test("monthlyStats: check-in days on real training days only, on-time vs late, plans and reports by coach and month, meetings by status", () => {
  const s = monthlyStats({ team: "THAWEE SC", month: "2026-10", coach, sessions, attendance, plans, reports, meetings, players });
  assert.equal(s.quota, 22, "THAWEE SC trains Mon-Fri: 22 weekdays in Oct 2026");
  assert.deepEqual(s.checkin, { days: 2, onTime: 1, late: 1 });
  assert.deepEqual(s.plans, { total: 2, onTime: 1, late: 1 });
  assert.deepEqual(s.reports, { total: 2, late: 1 });
  assert.deepEqual(s.meetings, { total: 4, attended: 1, leave: 1, absent: 1 });
});

test("monthlyStats: an empty month gives zeros", () => {
  const s = monthlyStats({ team: "THAWEE SC", month: "2026-08", coach, sessions, attendance, plans, reports, meetings, players });
  assert.deepEqual([s.checkin.days, s.plans.total, s.reports.total, s.meetings.total], [0, 0, 0, 0]);
});

test("profileInfoHtml: shows account, position, age groups with counts, to-do items, escapes text", () => {
  const html = profileInfoHtml({
    coach: { ...coach, name: "<b>x</b>" },
    team: "THAWEE SC",
    ageRows: ageGroupRows(coach, players),
    todo: { tasks: 2, round: "Re-evaluation ต.ค. 2026", book: "ส.ค.–ต.ค. 2026 (เหลือ 9 วัน)" }
  });
  assert.ok(!html.includes("<b>x</b>"));
  assert.match(html, /ek@example\.com/);
  assert.match(html, /อนุมัติแล้ว/);
  assert.match(html, /Head Coach/);
  assert.match(html, /U16 · 1 คน<br>U17 · 1 คน/);
  assert.match(html, /สมัครเมื่อ 12 พ\.ค\. 2026/);
  assert.match(html, /2 งาน/);
  assert.match(html, /Re-evaluation ต\.ค\. 2026/);
  assert.match(html, /เหลือ 9 วัน/);
  assert.match(html, /แจ้งผู้ดูแลระบบ/);
  const empty = profileInfoHtml({ coach: { ...coach, status: "pending", createdAt: undefined }, team: "THAWEE SC", ageRows: [], todo: { tasks: 0, round: null, book: null } });
  assert.match(empty, /รออนุมัติ/);
  assert.match(empty, /ไม่มีงานค้าง/);
  assert.match(empty, /ไม่มี<\/span>/);
  assert.match(empty, /สมัครเมื่อ -/);
});

test("profileStatsHtml: four tiles, meeting tile says so when there are no meetings", () => {
  const s = monthlyStats({ team: "THAWEE SC", month: "2026-10", coach, sessions, attendance, plans, reports, meetings, players });
  const html = profileStatsHtml(s);
  assert.equal((html.match(/class="profile-stat"/g) || []).length, 4);
  assert.match(html, /เช็คชื่อตรงเวลา[\s\S]*?1<span[^>]*> \/ 22 วัน · สาย 1/);
  assert.match(html, /เข้าประชุม[\s\S]*?1<span[^>]*> \/ 4 ครั้ง · ลา 1 ขาด 1/);
  const none = profileStatsHtml(monthlyStats({ team: "THAWEE SC", month: "2026-08", coach, sessions, attendance, plans, reports, meetings, players }));
  assert.match(none, /ไม่มีนัดในเดือนนี้/);
});
