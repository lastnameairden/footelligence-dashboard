import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEETING_TEAM_SLOTS,
  MEETING_MAX_MINUTES,
  MEETING_MAX_FILES_PER_SECTION,
  MEETING_MAX_FILE_BYTES,
  MEETING_SECTIONS,
  COACH_RECAP_FIELDS,
  COACH_RECAP_MAX_CHARS,
  coachTrackOf,
  meetingFilePath,
  recapDeadline,
  recapDocId,
  recapStatus,
  recapStatusView,
  recapTasksForCoach,
  sectionHasPlan,
  sectionsForTrack,
  validateRecapInput,
  validateMeetingFile,
  addDaysToDate,
  addMonthsToMonth,
  assignCoachesToWeeks,
  buildTeamMeetingDocs,
  daysUntil,
  describeDaysUntil,
  googleCalendarUrl,
  isValidMeetingLink,
  meetingDate,
  meetingDocId,
  meetingWeekdayOf,
  nextMeetingForCoach,
  summarizeMeetingAttendance,
  thaiMeetingDateLabel,
  thaiMonthLabel
} from "../js/coach-meetings.js";

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test("team slots: start at 09:00, back to back, each at most 25 minutes", () => {
  assert.equal(MEETING_TEAM_SLOTS[0].team, "THAWEE SC");
  assert.equal(MEETING_TEAM_SLOTS[0].start, "09:00");
  assert.deepEqual(
    MEETING_TEAM_SLOTS.map((s) => s.team),
    ["THAWEE SC", "THAMMASATHIT", "KHAMPHEE FOOTBALL"]
  );
  MEETING_TEAM_SLOTS.forEach((s, i) => {
    assert.ok(toMinutes(s.end) - toMinutes(s.start) <= MEETING_MAX_MINUTES);
    if (i > 0) assert.equal(s.start, MEETING_TEAM_SLOTS[i - 1].end);
  });
  assert.equal(MEETING_TEAM_SLOTS[2].end, "10:15");
});

test("meetingDate: week N is the Nth Wednesday of the month, Thursday is the day after", () => {
  // ต.ค. 2026: วันที่ 1 เป็นวันพฤหัสบดี → พุธแรก = 7
  assert.equal(meetingDate("2026-10", 1, "wed"), "2026-10-07");
  assert.equal(meetingDate("2026-10", 1, "thu"), "2026-10-08");
  assert.equal(meetingDate("2026-10", 2, "wed"), "2026-10-14");
  assert.equal(meetingDate("2026-10", 4, "thu"), "2026-10-29");
  // พ.ย. 2026: วันที่ 1 เป็นวันอาทิตย์ → พุธแรก = 4
  assert.equal(meetingDate("2026-11", 1, "wed"), "2026-11-04");
  // ถ้าวันที่ 1 เป็นวันพุธ พุธแรกคือวันที่ 1 (ก.ค. 2026)
  assert.equal(meetingDate("2026-07", 1, "wed"), "2026-07-01");
  for (const month of ["2026-02", "2026-09", "2026-12", "2027-03"]) {
    for (let w = 1; w <= 4; w++) {
      assert.equal(meetingWeekdayOf(meetingDate(month, w, "wed")), "wed");
      assert.equal(meetingWeekdayOf(meetingDate(month, w, "thu")), "thu");
    }
  }
});

test("assignCoachesToWeeks: everyone exactly once, groups differ by at most one, 14 coaches → 4/4/3/3", () => {
  const ids = Array.from({ length: 14 }, (_, i) => `c${i}`);
  for (const month of ["2026-10", "2026-11", "2026-12", "2027-01"]) {
    const weeks = assignCoachesToWeeks(ids, month);
    assert.equal(weeks.length, 4);
    assert.deepEqual(weeks.flat().sort(), [...ids].sort());
    assert.deepEqual(weeks.map((w) => w.length).sort(), [3, 3, 4, 4]);
  }
  assert.deepEqual(assignCoachesToWeeks([], "2026-10"), [[], [], [], []]);
  // น้อยกว่า 4 คนก็ไม่มีใครซ้ำสัปดาห์
  const few = assignCoachesToWeeks(["a", "b"], "2026-10");
  assert.equal(few.flat().length, 2);
  assert.ok(few.every((w) => w.length <= 1));
});

test("assignCoachesToWeeks: rotates so a coach does not get the same week every month", () => {
  const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
  const weekOf = (month, id) => assignCoachesToWeeks(ids, month).findIndex((w) => w.includes(id));
  assert.notEqual(weekOf("2026-10", "c0"), weekOf("2026-11", "c0"));
  // นัดครบรอบ 4 เดือนจะกลับมาเป็นสัปดาห์เดิม
  assert.equal(weekOf("2026-10", "c0"), weekOf("2027-02", "c0"));
});

test("assignCoachesToWeeks: neighbours in the sorted list (same age group) land in different weeks", () => {
  const ids = ["u13a", "u13b", "u13c", "u14a"];
  const weeks = assignCoachesToWeeks(ids, "2026-10");
  const weekOf = (id) => weeks.findIndex((w) => w.includes(id));
  assert.equal(new Set(ids.map(weekOf)).size, 4);
});

test("buildTeamMeetingDocs: 4 docs for the team with date, slot time, coach snapshot and kept links", () => {
  const coaches = [
    { id: "a", name: "โค้ชเอ" },
    { id: "b", name: "โค้ชบี" },
    { id: "c", name: "โค้ชซี" }
  ];
  const docs = buildTeamMeetingDocs({
    month: "2026-10",
    team: "THAMMASATHIT",
    coaches,
    weekdays: ["wed", "thu", "wed", "thu"],
    existingLinks: { 2: "https://meet.google.com/aaa-bbbb-ccc" }
  });
  assert.equal(docs.length, 4);
  assert.deepEqual(
    docs.map((d) => d.id),
    ["2026-10_1_1", "2026-10_1_2", "2026-10_1_3", "2026-10_1_4"]
  );
  assert.equal(docs[0].id, meetingDocId("2026-10", "THAMMASATHIT", 1));
  assert.deepEqual(docs.map((d) => d.data.date), ["2026-10-07", "2026-10-15", "2026-10-21", "2026-10-29"]);
  assert.ok(docs.every((d) => d.data.startTime === "09:25" && d.data.endTime === "09:50" && d.data.team === "THAMMASATHIT"));
  assert.equal(docs[1].data.meetLink, "https://meet.google.com/aaa-bbbb-ccc");
  assert.equal(docs[0].data.meetLink, "");
  const all = docs.flatMap((d) => d.data.coachIds);
  assert.deepEqual(all.sort(), ["a", "b", "c"]);
  for (const d of docs) assert.equal(d.data.coachIds.length, d.data.coachNames.length);
  assert.throws(() => buildTeamMeetingDocs({ month: "2026-10", team: "NOPE", coaches }));
});

test("date helpers", () => {
  assert.equal(addDaysToDate("2026-10-30", 3), "2026-11-02");
  assert.equal(addMonthsToMonth("2026-12", 1), "2027-01");
  assert.equal(addMonthsToMonth("2026-01", -1), "2025-12");
  assert.equal(daysUntil("2026-10-07", "2026-10-05"), 2);
  assert.equal(daysUntil("2026-10-05", "2026-10-05"), 0);
  assert.equal(describeDaysUntil(0), "วันนี้");
  assert.equal(describeDaysUntil(1), "พรุ่งนี้");
  assert.equal(describeDaysUntil(3), "อีก 3 วัน");
  assert.equal(thaiMeetingDateLabel("2026-10-21"), "พุธที่ 21 ต.ค. 2026");
  assert.equal(thaiMeetingDateLabel("2026-10-15"), "พฤหัสบดีที่ 15 ต.ค. 2026");
  assert.equal(thaiMonthLabel("2026-10"), "ตุลาคม 2026");
});

test("summarizeMeetingAttendance counts only coaches still in the group", () => {
  const m = { coachIds: ["a", "b", "c", "d"], attendance: { a: "attended", b: "leave", c: "absent", gone: "attended" } };
  assert.deepEqual(summarizeMeetingAttendance(m), { attended: 1, leave: 1, absent: 1, pending: 1, total: 4 });
  assert.deepEqual(summarizeMeetingAttendance({}), { attended: 0, leave: 0, absent: 0, pending: 0, total: 0 });
});

test("nextMeetingForCoach picks the soonest upcoming meeting that includes the coach", () => {
  const list = [
    { id: "past", date: "2026-10-01", startTime: "09:00", coachIds: ["me"] },
    { id: "other", date: "2026-10-07", startTime: "09:00", coachIds: ["someone"] },
    { id: "later", date: "2026-10-21", startTime: "09:00", coachIds: ["me"] },
    { id: "soon", date: "2026-10-14", startTime: "09:00", coachIds: ["x", "me"] }
  ];
  assert.equal(nextMeetingForCoach(list, "me", "2026-10-05").id, "soon");
  assert.equal(nextMeetingForCoach(list, "me", "2026-10-14").id, "soon", "a meeting today still counts");
  assert.equal(nextMeetingForCoach(list, "me", "2026-10-22"), null);
  assert.equal(nextMeetingForCoach([], "me", "2026-10-05"), null);
});

test("meeting link must be https (or empty)", () => {
  assert.equal(isValidMeetingLink(""), true);
  assert.equal(isValidMeetingLink("https://meet.google.com/abc-defg-hij"), true);
  assert.equal(isValidMeetingLink("http://meet.google.com/abc-defg-hij"), false);
  assert.equal(isValidMeetingLink("javascript:alert(1)"), false);
  assert.equal(isValidMeetingLink("not a url"), false);
});

test("googleCalendarUrl carries Bangkok time, the slot and the Meet link", () => {
  const url = new URL(
    googleCalendarUrl({
      team: "THAWEE SC",
      date: "2026-10-21",
      startTime: "09:00",
      endTime: "09:25",
      meetLink: "https://meet.google.com/abc-defg-hij"
    })
  );
  assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261021T090000/20261021T092500");
  assert.equal(url.searchParams.get("ctz"), "Asia/Bangkok");
  assert.equal(url.searchParams.get("location"), "https://meet.google.com/abc-defg-hij");
  assert.match(url.searchParams.get("text"), /THAWEE SC/);
  const noLink = new URL(googleCalendarUrl({ team: "THAWEE SC", date: "2026-10-21", startTime: "09:00", endTime: "09:25", meetLink: "" }));
  assert.equal(noLink.searchParams.get("location"), null);
});

test("coachTrackOf maps registered positions to the three meeting tracks", () => {
  assert.equal(coachTrackOf("gk_coach"), "gk");
  assert.equal(coachTrackOf("fitness_coach"), "fit");
  assert.equal(coachTrackOf("head_coach"), "player");
  assert.equal(coachTrackOf("assistant_coach"), "player");
  assert.equal(coachTrackOf(null), null);
  assert.equal(coachTrackOf("something"), null);
  assert.deepEqual(MEETING_SECTIONS.map((s) => s.key), ["all", "player", "gk", "fit"]);
  assert.deepEqual(sectionsForTrack("gk"), ["all", "gk"]);
  assert.deepEqual(sectionsForTrack(null), ["all"]);
});

test("validateMeetingFile: only images/PDF, at most 10MB, at most 3 per section", () => {
  const ok = { name: "a.pdf", size: 1000, type: "application/pdf" };
  assert.equal(validateMeetingFile(ok, 0), null);
  assert.equal(validateMeetingFile({ name: "a.png", size: 1000, type: "image/png" }, 2), null);
  assert.match(validateMeetingFile(ok, MEETING_MAX_FILES_PER_SECTION), /สูงสุด 3 ไฟล์/);
  assert.match(validateMeetingFile({ ...ok, size: MEETING_MAX_FILE_BYTES + 1 }, 0), /10MB/);
  assert.match(validateMeetingFile({ name: "a.exe", size: 10, type: "application/x-msdownload" }, 0), /รูปภาพหรือ PDF/);
  assert.equal(MEETING_MAX_FILE_BYTES, 10 * 1024 * 1024);
});

test("meetingFilePath keeps files under the meeting folder with a safe name", () => {
  assert.equal(meetingFilePath("2026-10_0_3", "gk", "สรุป ครอส (1).pdf", 1760000000000), "coachMeetings/2026-10_0_3/gk/1760000000000_สรุป_ครอส__1_.pdf");
});

test("sectionHasPlan ignores blank text", () => {
  assert.equal(sectionHasPlan(undefined), false);
  assert.equal(sectionHasPlan({ plan: "  " }), false);
  assert.equal(sectionHasPlan({ plan: "หัวข้อ" }), true);
  assert.equal(sectionHasPlan({ plan: "", files: [{ name: "a" }] }), true);
});

test("recapDocId is {meetingId}_{coachId} (the Firestore rule enforces the same shape)", () => {
  assert.equal(recapDocId("2026-10_0_3", "uid1"), "2026-10_0_3_uid1");
});

test("recapDeadline: two days before the last day of the month are off-limits, so the last day to submit is last day - 2", () => {
  assert.equal(recapDeadline("2026-10"), "2026-10-29");
  assert.equal(recapDeadline("2026-11"), "2026-11-28");
  assert.equal(recapDeadline("2026-02"), "2026-02-26");
  assert.equal(recapDeadline("2028-02"), "2028-02-27", "leap year");
  assert.equal(recapDeadline("2026-12"), "2026-12-29");
});

test("recapStatus: upcoming, pending, overdue, submitted, late, excused", () => {
  const m = { id: "m1", month: "2026-10", date: "2026-10-21", coachIds: ["me", "gone"], attendance: { gone: "absent" } };
  assert.equal(recapStatus(m, "me", null, "2026-10-20").state, "upcoming");
  const sameDay = recapStatus(m, "me", null, "2026-10-21");
  assert.deepEqual([sameDay.state, sameDay.daysLeft, sameDay.deadline], ["pending", 8, "2026-10-29"]);
  assert.equal(recapStatus(m, "me", null, "2026-10-29").daysLeft, 0);
  const late = recapStatus(m, "me", null, "2026-10-31");
  assert.deepEqual([late.state, late.daysLeft], ["overdue", -2]);
  assert.equal(recapStatus(m, "me", { submittedOn: "2026-10-29" }, "2026-10-31").state, "submitted", "the deadline day itself is on time");
  assert.equal(recapStatus(m, "me", { submittedOn: "2026-10-30" }, "2026-10-31").state, "late");
  assert.equal(recapStatus(m, "gone", null, "2026-11-05").state, "excused");
  assert.equal(recapStatus(m, "gone", { submittedOn: "2026-10-22" }, "2026-11-05").state, "submitted", "a submission always counts, even from someone marked absent");
  assert.equal(recapStatus({ ...m, attendance: { me: "leave" } }, "me", null, "2026-10-25").state, "excused");
});

test("recapStatusView words and tones", () => {
  assert.deepEqual(recapStatusView({ state: "submitted" }), { text: "ส่งแล้ว", tone: "success" });
  assert.equal(recapStatusView({ state: "late" }).tone, "warning");
  assert.deepEqual(recapStatusView({ state: "pending", daysLeft: 8 }), { text: "ยังไม่ส่ง · เหลือ 8 วัน", tone: "warning" });
  assert.match(recapStatusView({ state: "pending", daysLeft: 0 }).text, /ถึงวันนี้/);
  assert.deepEqual(recapStatusView({ state: "overdue", daysLeft: -2 }), { text: "เลยกำหนด 2 วัน", tone: "danger" });
  assert.equal(recapStatusView({ state: "excused" }).tone, "neutral");
});

test("validateRecapInput needs both fields, trims them and caps the length", () => {
  assert.deepEqual(COACH_RECAP_FIELDS.map((f) => f.key), ["know", "use"]);
  assert.deepEqual(validateRecapInput({ know: "  ก  ", use: "ข" }), { values: { know: "ก", use: "ข" } });
  assert.match(validateRecapInput({ know: "ก", use: "  " }).error, /นำไปใช้ในสนามอย่างไร/);
  assert.match(validateRecapInput({ use: "ข" }).error, /ความรู้ที่ได้วันนี้/);
  assert.match(validateRecapInput({ know: "ก".repeat(COACH_RECAP_MAX_CHARS + 1), use: "ข" }).error, /ยาวเกิน/);
  assert.equal(COACH_RECAP_MAX_CHARS, 2000);
});

test("recapTasksForCoach: only meetings that already happened, newest first, without excused ones", () => {
  const mk = (id, date, extra) => ({ id, month: date.slice(0, 7), date, coachIds: ["me"], attendance: {}, ...extra });
  const list = [
    mk("sep", "2026-09-16"),
    mk("oct", "2026-10-14"),
    mk("future", "2026-10-28"),
    mk("excused", "2026-10-07", { attendance: { me: "leave" } }),
    mk("notme", "2026-10-08", { coachIds: ["other"] })
  ];
  const recaps = new Map([["sep", { submittedOn: "2026-09-20" }]]);
  const tasks = recapTasksForCoach(list, "me", recaps, "2026-10-15");
  assert.deepEqual(tasks.map((t) => [t.meeting.id, t.status.state]), [["oct", "pending"], ["sep", "submitted"]]);
});