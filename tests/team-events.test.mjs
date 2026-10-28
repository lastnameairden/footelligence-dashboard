import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageGroupForLevel,
  ageGroupsForExamLevels,
  bangkokStamp,
  deadlineFor,
  deadlineLabel,
  defaultMonth,
  eventReminder,
  dueDateFor,
  dueInfo,
  emptyEvent,
  eventDocId,
  eventStatus,
  formFromDoc,
  monthOptions,
  coachEntriesHtml,
  teamEventsModel,
  teamOverviewHtml,
  validateEventForm
} from "../js/team-events.js";

const goodMatch = () => ({ ...emptyEvent(), type: "official", title: "ฟุตบอลเยาวชนจังหวัด", ageGroups: ["U15", "U16"], start: "2026-11-08", end: "2026-11-09", impact: "partial", practiceStart: "16:00", practiceEnd: "17:30", awayMode: "some", awayPlayers: [{ id: "p1", name: "ต้นกล้า", ageGroup: "U15" }, { id: "p2", name: "ภูมิ", ageGroup: "U16" }], matches: [{ date: "2026-11-08", venue: "เหย้า", time: "15:00" }, { date: "2026-11-09", venue: "เยือน", time: "09:30" }] });
const form = (over = {}) => ({ noEvent: false, contactName: "โค้ชบอม", contactPhone: "081-234-5678", events: [goodMatch()], ...over });

test("months: default switches to next month from the 15th, due date is the 25th of the month before", () => {
  assert.equal(defaultMonth("2026-10-14"), "2026-10");
  assert.equal(defaultMonth("2026-10-25"), "2026-11");
  assert.equal(defaultMonth("2026-12-20"), "2027-01");
  assert.deepEqual(monthOptions("2026-12-03"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(dueDateFor("2027-01"), "2026-12-25");
  assert.deepEqual(deadlineFor("2027-01"), { date: "2026-12-25", time: "23:59" });
  assert.equal(deadlineLabel("2027-01"), "25 ธ.ค.");
  assert.equal(eventDocId("THAWEE SC", "2026-11", "c1"), "THAWEE SC__2026-11__c1");
});

test("due state: submitted wins, otherwise overdue only after the deadline (default 25th 23:59)", () => {
  assert.equal(dueInfo({ month: "2026-12", now: "2026-11-25 23:59", submitted: false }).state, "due");
  assert.equal(dueInfo({ month: "2026-12", now: "2026-11-26 00:00", submitted: false }).state, "overdue");
  assert.equal(dueInfo({ month: "2026-12", now: "2026-12-02 09:00", submitted: true }).state, "submitted");
});

test("November 2026 is extended to 28 Oct 14:00", () => {
  assert.deepEqual(deadlineFor("2026-11"), { date: "2026-10-28", time: "14:00" });
  assert.equal(deadlineLabel("2026-11"), "28 ต.ค. 14:00 น.");
  assert.equal(dueInfo({ month: "2026-11", now: "2026-10-26 10:00", submitted: false }).state, "due", "was overdue under the normal 25th rule");
  assert.equal(dueInfo({ month: "2026-11", now: "2026-10-28 14:00", submitted: false }).state, "due");
  assert.equal(dueInfo({ month: "2026-11", now: "2026-10-28 14:01", submitted: false }).state, "overdue");
});

test("Bangkok stamp uses UTC+7", () => {
  assert.equal(bangkokStamp(new Date("2026-10-25T18:30:00Z")), "2026-10-26 01:30");
});

test("Home reminder: next month, from 7 days before the deadline until the month ends, only while unsent", () => {
  // เดือนพฤศจิกายน: กำหนดพิเศษ 28 ต.ค. 14:00 → เริ่มเตือน 21 ต.ค.
  assert.equal(eventReminder({ now: "2026-10-20 09:00", submitted: false }), null);
  assert.deepEqual(eventReminder({ now: "2026-10-21 09:00", submitted: false }), { month: "2026-11", state: "due", daysLeft: 7 });
  assert.deepEqual(eventReminder({ now: "2026-10-25 09:00", submitted: false }), { month: "2026-11", state: "due", daysLeft: 3 });
  assert.equal(eventReminder({ now: "2026-10-28 13:59", submitted: false }).daysLeft, 0);
  assert.equal(eventReminder({ now: "2026-10-28 14:01", submitted: false }).state, "overdue");
  assert.equal(eventReminder({ now: "2026-10-31 20:00", submitted: false }).state, "overdue");
  assert.equal(eventReminder({ now: "2026-10-25 09:00", submitted: true }), null);
  // เข้าเดือนแล้ว เดือนที่ต้องแจ้งขยับเป็นเดือนถัดไป (ธันวาคม: กำหนด 25 พ.ย. เริ่มเตือน 18 พ.ย.)
  assert.equal(eventReminder({ now: "2026-11-02 09:00", submitted: false }), null);
  assert.deepEqual(eventReminder({ now: "2026-11-18 09:00", submitted: false }), { month: "2026-12", state: "due", daysLeft: 7 });
  assert.equal(eventReminder({ now: "2026-11-26 09:00", submitted: false }).state, "overdue");
});

test("exam levels map to age groups (ป.n -> U(n+6), ม.n -> U(n+12)), sorted and unique", () => {
  assert.equal(ageGroupForLevel("ป.6"), "U12");
  assert.equal(ageGroupForLevel("ม.1"), "U13");
  assert.equal(ageGroupForLevel("ม.6"), "U18");
  assert.equal(ageGroupForLevel("x"), null);
  assert.deepEqual(ageGroupsForExamLevels(["ม.2", "ป.6", "ม.2", "bad"]), ["U12", "U14"]);
});

test("validate: a complete match event passes and is normalised", () => {
  const { value, errors } = validateEventForm(form());
  assert.deepEqual(errors, []);
  assert.equal(value.contactPhone, "0812345678");
  const e = value.events[0];
  assert.deepEqual([e.practiceStart, e.practiceEnd, e.awayCount, e.awayMode], ["16:00", "17:30", 2, "some"]);
  assert.deepEqual(e.awayPlayers.map((p) => p.name), ["ต้นกล้า", "ภูมิ"]);
  assert.equal(e.matches.length, 2);
  assert.deepEqual(e.ageGroups, ["U15", "U16"]);
  assert.equal(JSON.stringify(value).includes("undefined"), false);
});

test("validate: no-event month needs only the header and stores no events", () => {
  const { value, errors } = validateEventForm(form({ noEvent: true, events: [goodMatch()] }));
  assert.deepEqual(errors, []);
  assert.deepEqual(value.events, []);
  assert.equal(value.noEvent, true);
  assert.ok(validateEventForm(form({ events: [] })).errors.some((e) => e.includes("ไม่มี Event")), "an empty month must say no event explicitly");
});

test("validate: header and event problems are reported with the event number", () => {
  assert.ok(validateEventForm(form({ contactName: " " })).errors.includes("กรอกชื่อผู้กรอก"));
  assert.ok(validateEventForm(form({ contactPhone: "123" })).errors.some((e) => e.includes("เบอร์")));
  const bad = { ...goodMatch(), type: "", title: "", ageGroups: [], start: "", impact: "", matches: [] };
  const errors = validateEventForm(form({ events: [goodMatch(), bad] })).errors;
  assert.ok(errors.length >= 4 && errors.every((e) => e.startsWith("Event 2")), errors.join("|"));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), end: "2026-11-01" }] })).errors.some((e) => e.includes("วันที่จบ")));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), practiceEnd: "15:00" }] })).errors.some((e) => e.includes("เวลาจบต้องหลังเวลาเริ่ม")));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), practiceStart: "" }] })).errors.some((e) => e.includes("ช่วงเวลาที่ซ้อม")));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), awayPlayers: [], awayCount: "" }] })).errors.some((e) => e.includes("เลือกชื่อนักเตะ")));
  // ข้อมูลเดิมที่ระบุเป็นจำนวน ยังบันทึกซ้ำได้
  assert.equal(validateEventForm(form({ events: [{ ...goodMatch(), awayPlayers: [], awayCount: "5" }] })).value.events[0].awayCount, 5);
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), title: "<b>x</b>" }] })).errors.some((e) => e.includes("<")));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), matches: [{ date: "2026-11-08", venue: "เหย้า", time: "25:00" }] }] })).errors.some((e) => e.includes("เวลา")));
});

test("validate: 'ทุกรุ่น' selects U6-U18, exam derives age groups from the levels", () => {
  const all = validateEventForm(form({ events: [{ ...goodMatch(), ageGroups: ["ทุกรุ่น"] }] }));
  assert.equal(all.value.events[0].ageGroups.length, 13);
  const exam = { ...emptyEvent(), type: "exam", title: "สอบกลางภาค", start: "2026-11-10", end: "2026-11-14", impact: "no-training", examLevels: ["ม.1", "ม.3"], ageGroups: ["U6"] };
  const r = validateEventForm(form({ events: [exam] }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.value.events[0].ageGroups, ["U13", "U15"]);
  assert.ok(validateEventForm(form({ events: [{ ...exam, examLevels: [] }] })).errors.some((e) => e.includes("ชั้นที่สอบ")));
});

test("form round trip: stored doc -> form -> validate gives the same events", () => {
  const first = validateEventForm(form()).value;
  const again = validateEventForm(formFromDoc(first)).value;
  assert.deepEqual(again, first);
});

const coachRow = (id, name, ageGroups) => ({ id, name, ageGroups });
const doc = (coachId, coachName, over = {}) => ({ team: "THAWEE SC", month: "2026-11", coachId, coachName, noEvent: false, contactName: coachName, contactPhone: "0812345678", submittedDate: "2026-10-24", firstSubmittedDate: "2026-10-24", events: [goodMatch()], ...over });

test("eventDocId: one document per coach per month", () => {
  assert.equal(eventDocId("THAWEE SC", "2026-11", "c1"), "THAWEE SC__2026-11__c1");
  assert.notEqual(eventDocId("THAWEE SC", "2026-11", "c1"), eventDocId("THAWEE SC", "2026-11", "c2"));
});

test("a coach can only fill his own age groups: outside groups, 'all' and exam levels are limited to them", () => {
  const mine = { allowedAgeGroups: ["U15", "U16"] };
  assert.deepEqual(validateEventForm(form({ events: [{ ...goodMatch(), ageGroups: ["U15"] }] }), mine).errors, []);
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), ageGroups: ["U15", "U17"] }] }), mine).errors.some((m) => m.includes("U17") && m.includes("ไม่ใช่รุ่นที่คุณรับผิดชอบ")));
  const all = validateEventForm(form({ events: [{ ...goodMatch(), ageGroups: ["ทุกรุ่น"] }] }), mine);
  assert.deepEqual(all.value.events[0].ageGroups, ["U15", "U16"], "'all' means all of my groups, not U6-U18");
  const exam = { ...emptyEvent(), type: "exam", title: "สอบ", start: "2026-11-10", end: "2026-11-10", impact: "no-training", examLevels: ["ม.1"] };
  assert.ok(validateEventForm(form({ events: [exam] }), mine).errors.some((m) => m.includes("ชั้นที่สอบต้องตรงกับรุ่น")), "ม.1 is U13, not mine");
  assert.deepEqual(validateEventForm(form({ events: [{ ...exam, examLevels: ["ม.3"] }] }), mine).errors, [], "ม.3 is U15");
  assert.deepEqual(validateEventForm(form({ events: [{ ...goodMatch(), ageGroups: ["U13"] }] })).errors, [], "no restriction when none is given");
});

test("team overview: every coach is listed (missing ones too), several coaches never overwrite each other", () => {
  const coaches = [coachRow("c1", "โค้ชบอม", ["U15", "U16"]), coachRow("c2", "โค้ชต้น", ["U17"]), coachRow("c3", "โค้ชบี", ["U13"])];
  const docs = [
    doc("c1", "โค้ชบอม", { events: [goodMatch(), { ...goodMatch(), title: "งานที่สอง", start: "2026-11-20", end: "2026-11-20" }] }),
    doc("c2", "โค้ชต้น", { noEvent: true, events: [] }),
    { ...doc("c9", "คนอื่นทีม", {}), team: "KHAMPHEE FOOTBALL" },
    { ...doc("c1", "โค้ชบอม", {}), month: "2026-10" }
  ];
  const m = teamEventsModel({ team: "THAWEE SC", month: "2026-11", docs, coaches });
  assert.deepEqual(m.rows.map((r) => [r.name, r.status]), [["โค้ชบี", "none"], ["โค้ชบอม", "submitted"], ["โค้ชต้น", "no-event"]], "sorted by age group, one row per coach");
  assert.deepEqual(m.summary, { submitted: 1, noEvent: 1, missing: 1, total: 3 });
  assert.deepEqual(m.allEvents.map((e) => [e.coachName, e.start]), [["โค้ชบอม", "2026-11-08"], ["โค้ชบอม", "2026-11-20"]], "events of every coach in one list, newest data only for this team and month");
  const html = teamOverviewHtml(m);
  assert.ok(html.includes("โค้ชที่ส่งแล้ว") && html.includes("2 / 3") && html.includes("ยังไม่กรอก") && html.includes("<th>โค้ช</th>"));
  assert.equal(html.includes("KHAMPHEE") || html.includes("คนอื่นทีม"), false, "no other team's data");
  assert.equal(/NaN|undefined|null/.test(html), false);
});

test("legacy whole-team document stays visible as read-only 'old data' and does not count as a coach", () => {
  const legacy = { team: "THAWEE SC", month: "2026-11", noEvent: false, contactName: "โค้ชบอม", events: [goodMatch()], submittedDate: "2026-10-24" };
  const m = teamEventsModel({ team: "THAWEE SC", month: "2026-11", docs: [legacy], coaches: [coachRow("c1", "โค้ชบอม", ["U15"])] });
  assert.equal(m.summary.total, 1);
  assert.equal(m.summary.missing, 1, "the coach still has to fill his own entry");
  assert.ok(m.legacy && m.legacy.legacy === true);
  assert.equal(m.allEvents.length, 1);
  assert.ok(teamOverviewHtml(m).includes("ข้อมูลเดิมที่กรอกทั้งทีม"));
});

test("coach page: other coaches' entries are shown read-only, mine is excluded", () => {
  const coaches = [coachRow("c1", "โค้ชบอม", ["U15"]), coachRow("c2", "โค้ชต้น", ["U17"]), coachRow("c3", "โค้ชบี", ["U13"])];
  const m = teamEventsModel({ team: "THAWEE SC", month: "2026-11", docs: [doc("c1", "โค้ชบอม"), doc("c2", "โค้ชต้น", { events: [{ ...goodMatch(), title: "ของโค้ชต้น" }] })], coaches });
  const html = coachEntriesHtml(m, { excludeCoachId: "c1" });
  assert.ok(html.includes("โค้ชต้น") && html.includes("ของโค้ชต้น") && html.includes("โค้ชบี") && html.includes("ยังไม่ได้กรอก"));
  assert.equal(html.includes("โค้ชบอม"), false);
  assert.ok(coachEntriesHtml(teamEventsModel({ team: "THAWEE SC", month: "2026-11", docs: [], coaches: [coachRow("c1", "คนเดียว", ["U15"])] }), { excludeCoachId: "c1" }).includes("ยังไม่มีโค้ชคนอื่น"));
});
test("overview html escapes team/event text", () => {
  const docs = [{ team: "T", month: "2026-11", noEvent: false, contactName: "<script>x</script>", events: [{ ...goodMatch(), title: "<img src=x onerror=1>", note: "<b>" }] }];
  const html = overviewHtml(overviewModel({ teams: ["T"], month: "2026-11", docs }));
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img src=x"), false);
});

const overviewModel = ({ teams, month, docs }) => teamEventsModel({ team: teams[0], month, docs });
const overviewHtml = (m) => teamOverviewHtml(m);
const base = (type, over = {}) => ({ ...emptyEvent(), type, ageGroups: ["U15", "U16"], ...over });

test("change day: needs old and new date and a reason; title is generated; no impact/title required", () => {
  const ok = { oldDate: "2026-11-12", newDate: "2026-11-13", reason: "สนามไม่ว่าง" };
  const r = validateEventForm(form({ events: [base("change-day", ok)] }));
  assert.deepEqual(r.errors, []);
  const e = r.value.events[0];
  assert.deepEqual([e.start, e.end, e.impact, e.awayMode], ["2026-11-12", "2026-11-12", "", "none"]);
  assert.equal(e.title, "เปลี่ยนวันซ้อม 12 พ.ย. → 13 พ.ย.");
  assert.ok(validateEventForm(form({ events: [base("change-day", { ...ok, newDate: "2026-11-12" })] })).errors.some((m) => m.includes("ไม่ใช่วันซ้อมเดิม")));
  assert.ok(validateEventForm(form({ events: [base("change-day", { ...ok, reason: "" })] })).errors.some((m) => m.includes("เหตุผล")));
  assert.ok(validateEventForm(form({ events: [base("change-day", { ...ok, oldDate: "" })] })).errors.some((m) => m.includes("วันซ้อมเดิม")));
});

test("change time: both time ranges must be valid with end after start", () => {
  const ok = { start: "2026-11-17", end: "2026-11-21", oldStart: "16:00", oldEnd: "18:00", newStart: "15:00", newEnd: "16:30" };
  const r = validateEventForm(form({ events: [base("change-time", ok)] }));
  assert.deepEqual(r.errors, []);
  assert.equal(r.value.events[0].title, "เปลี่ยนเวลาซ้อม 16:00–18:00 → 15:00–16:30");
  assert.ok(validateEventForm(form({ events: [base("change-time", { ...ok, newEnd: "14:00" })] })).errors.some((m) => m.includes("เวลาซ้อมใหม่")));
  assert.ok(validateEventForm(form({ events: [base("change-time", { ...ok, oldStart: "" })] })).errors.some((m) => m.includes("เวลาซ้อมเดิม")));
});

test("coach leave: with a substitute only the name is needed, without one a requested change and detail are", () => {
  const leave = { coachId: "c1", coachName: "โค้ชบอม", start: "2026-11-24", end: "2026-11-25" };
  const withSub = validateEventForm(form({ events: [base("coach-leave", { ...leave, substitute: "yes", substituteName: "โค้ชต้น" })] }));
  assert.deepEqual(withSub.errors, []);
  assert.deepEqual([withSub.value.events[0].changes, withSub.value.events[0].changeDetail], [[], ""]);
  assert.equal(withSub.value.events[0].title, "โค้ชบอม ไม่อยู่ซ้อม");
  assert.ok(validateEventForm(form({ events: [base("coach-leave", { ...leave, substitute: "yes", substituteName: "" })] })).errors.some((m) => m.includes("ผู้ฝึกสอนแทน")));
  const noSub = { ...leave, substitute: "none", changes: ["งดซ้อม", "bad"], changeDetail: "งดซ้อม 2 วัน" };
  const r = validateEventForm(form({ events: [base("coach-leave", noSub)] }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.value.events[0].changes, ["งดซ้อม"]);
  assert.ok(validateEventForm(form({ events: [base("coach-leave", { ...noSub, changes: [] })] })).errors.some((m) => m.includes("สิ่งที่ต้องการเปลี่ยนแปลง")));
  assert.ok(validateEventForm(form({ events: [base("coach-leave", { ...noSub, changeDetail: "" })] })).errors.some((m) => m.includes("รายละเอียด")));
  assert.ok(validateEventForm(form({ events: [base("coach-leave", { ...noSub, coachName: "" })] })).errors.some((m) => m.includes("เลือกโค้ช")));
});

test("partial training can be at the normal time: no start/end needed, and the time range is ignored", () => {
  const normal = { ...goodMatch(), practiceNormal: true, practiceStart: "", practiceEnd: "" };
  const r = validateEventForm(form({ events: [normal] }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual([r.value.events[0].practiceNormal, r.value.events[0].practiceStart, r.value.events[0].practiceEnd], [true, "", ""]);
  assert.equal(validateEventForm(form({ events: [{ ...normal, practiceNormal: false }] })).errors.some((m) => m.includes("ช่วงเวลาที่ซ้อม")), true, "unchecked again means a range is required");
  assert.equal(validateEventForm(form({ events: [{ ...goodMatch(), impact: "no-training", practiceNormal: true }] })).value.events[0].practiceNormal, false, "only meaningful for partial training");
  const html = overviewHtml(overviewModel({ teams: ["T"], month: "2026-11", docs: [{ team: "T", month: "2026-11", contactName: "x", events: [r.value.events[0]] }] }));
  assert.ok(html.includes("ซ้อมตามเวลาปกติ"));
});

test("matches: the number of matches decides the rows, each needs a date; partial practice shows a time range", () => {
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), matches: [] }] })).errors.some((m) => m.includes("จำนวนนัด")));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), matches: [{ date: "", venue: "เหย้า", time: "" }] }] })).errors.some((m) => m.includes("วันแข่ง")));
  const html = overviewHtml(overviewModel({ teams: ["T"], month: "2026-11", docs: [{ team: "T", month: "2026-11", contactName: "x", events: [validateEventForm(form()).value.events[0]] }] }));
  assert.ok(html.includes("2 นัด") && html.includes("ซ้อม 16:00–17:30 น.") && html.includes("นักเตะที่ไม่อยู่: ต้นกล้า, ภูมิ"));
});

test("overview shows the badge per change type and the last edited date after a re-send", () => {
  const events = [
    validateEventForm(form({ events: [base("coach-leave", { coachName: "โค้ชบอม", start: "2026-11-24", end: "2026-11-24", substitute: "none", changes: ["งดซ้อม"], changeDetail: "งดซ้อม" })] })).value.events[0],
    validateEventForm(form({ events: [base("change-day", { oldDate: "2026-11-12", newDate: "2026-11-13", reason: "สนามไม่ว่าง" })] })).value.events[0]
  ];
  const html = overviewHtml(overviewModel({ teams: ["T"], month: "2026-11", docs: [{ team: "T", month: "2026-11", contactName: "x", submittedDate: "2026-11-05", firstSubmittedDate: "2026-10-24", events }] }));
  assert.ok(html.includes("งดซ้อม") && html.includes("เปลี่ยนวันซ้อม") && html.includes("ไม่มีผู้ฝึกสอนแทน"));
  assert.ok(html.includes("ส่ง 24 ต.ค. · แก้ไขล่าสุด 5 พ.ย."));
  const once = overviewHtml(overviewModel({ teams: ["T"], month: "2026-11", docs: [{ team: "T", month: "2026-11", contactName: "x", submittedDate: "2026-10-24", firstSubmittedDate: "2026-10-24", events }] }));
  assert.equal(once.includes("แก้ไขล่าสุด"), false);
});
