import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageGroupForLevel,
  ageGroupsForExamLevels,
  defaultMonth,
  dueDateFor,
  dueInfo,
  emptyEvent,
  eventDocId,
  eventStatus,
  formFromDoc,
  monthOptions,
  overviewHtml,
  overviewModel,
  validateEventForm
} from "../js/team-events.js";

const goodMatch = () => ({ ...emptyEvent(), type: "official", title: "ฟุตบอลเยาวชนจังหวัด", ageGroups: ["U15", "U16"], start: "2026-11-08", end: "2026-11-09", impact: "partial", practiceMinutes: "60", practicePeriod: "เย็น", awayMode: "some", awayCount: "12", matches: [{ date: "2026-11-08", venue: "เหย้า", time: "15:00" }] });
const form = (over = {}) => ({ noEvent: false, contactName: "โค้ชบอม", contactPhone: "081-234-5678", events: [goodMatch()], ...over });

test("months: default switches to next month from the 15th, due date is the 25th of the month before", () => {
  assert.equal(defaultMonth("2026-10-14"), "2026-10");
  assert.equal(defaultMonth("2026-10-25"), "2026-11");
  assert.equal(defaultMonth("2026-12-20"), "2027-01");
  assert.deepEqual(monthOptions("2026-12-03"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(dueDateFor("2026-11"), "2026-10-25");
  assert.equal(dueDateFor("2027-01"), "2026-12-25");
  assert.equal(eventDocId("THAWEE SC", "2026-11"), "THAWEE SC__2026-11");
});

test("due state: submitted wins, otherwise overdue only after the 25th", () => {
  assert.equal(dueInfo({ month: "2026-11", today: "2026-10-25", submitted: false }).state, "due");
  assert.equal(dueInfo({ month: "2026-11", today: "2026-10-26", submitted: false }).state, "overdue");
  assert.equal(dueInfo({ month: "2026-11", today: "2026-11-02", submitted: true }).state, "submitted");
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
  assert.deepEqual([e.practiceMinutes, e.practicePeriod, e.awayCount, e.awayMode], [60, "เย็น", 12, "some"]);
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
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), practiceMinutes: "" }] })).errors.some((e) => e.includes("นาที")));
  assert.ok(validateEventForm(form({ events: [{ ...goodMatch(), awayCount: "0" }] })).errors.some((e) => e.includes("จำนวน")));
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

test("overview: every team listed, missing teams are visible, other months ignored", () => {
  const docs = [
    { team: "THAWEE SC", month: "2026-11", noEvent: false, contactName: "โค้ชบอม", contactPhone: "0812345678", submittedDate: "2026-10-24", events: [{ ...goodMatch(), start: "2026-11-20", title: "หยุด" }, goodMatch()] },
    { team: "KHAMPHEE FOOTBALL", month: "2026-11", noEvent: true, contactName: "โค้ชต้น", contactPhone: "0891112222", events: [] },
    { team: "THAMMASATHIT", month: "2026-10", noEvent: true, contactName: "x", events: [] }
  ];
  const m = overviewModel({ teams: ["KHAMPHEE FOOTBALL", "THAWEE SC", "THAMMASATHIT"], month: "2026-11", docs });
  assert.deepEqual(m.rows.map((r) => r.status), ["no-event", "submitted", "none"]);
  assert.deepEqual(m.summary, { submitted: 1, noEvent: 1, missing: 1, total: 3 });
  assert.deepEqual(m.rows[1].events.map((e) => e.start), ["2026-11-08", "2026-11-20"], "events sorted by start date");
  assert.equal(eventStatus(null), "none");
  const html = overviewHtml(m);
  assert.ok(html.includes("ยังไม่กรอก") && html.includes("ไม่มี Event") && html.includes("ส่งแล้ว"));
  assert.equal(/NaN|undefined|null/.test(html), false);
});

test("overview html escapes team/event text", () => {
  const docs = [{ team: "T", month: "2026-11", noEvent: false, contactName: "<script>x</script>", events: [{ ...goodMatch(), title: "<img src=x onerror=1>", note: "<b>" }] }];
  const html = overviewHtml(overviewModel({ teams: ["T"], month: "2026-11", docs }));
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img src=x"), false);
});
