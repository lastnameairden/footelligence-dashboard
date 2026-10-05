import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BODY_REGIONS,
  CONTEXTS,
  FORM_STATUSES,
  buildInjuryStats,
  contextFor,
  detectRecurrence,
  diffDays,
  formStatusFor,
  injuryDaysOut,
  injuryDetailLabels,
  storedStatusFor
} from "../js/injury-form.js";

test("form status + context ↔ stored status keeps the original four values", () => {
  assert.equal(storedStatusFor("บาดเจ็บ", "แข่ง"), "บาดเจ็บขณะแข่งขัน");
  assert.equal(storedStatusFor("บาดเจ็บ", "ซ้อม"), "บาดเจ็บขณะฝึกซ้อม");
  assert.equal(storedStatusFor("บาดเจ็บ", null), "บาดเจ็บขณะฝึกซ้อม");
  assert.equal(storedStatusFor("กำลังพักฟื้น", "แข่ง"), "กำลังพักฟื้น");
  assert.equal(storedStatusFor("หายแล้ว", "ซ้อม"), "หายแล้ว");
  assert.equal(formStatusFor("บาดเจ็บขณะแข่งขัน"), "บาดเจ็บ");
  assert.equal(formStatusFor("บาดเจ็บขณะฝึกซ้อม"), "บาดเจ็บ");
  assert.equal(formStatusFor("กำลังพักฟื้น"), "กำลังพักฟื้น");
  assert.equal(formStatusFor("หายแล้ว"), "หายแล้ว");
  assert.equal(formStatusFor(undefined), "บาดเจ็บ");
  assert.deepEqual(FORM_STATUSES, ["บาดเจ็บ", "กำลังพักฟื้น", "หายแล้ว"]);
  assert.equal(BODY_REGIONS.length, 11);
  assert.deepEqual(CONTEXTS, ["แข่ง", "ซ้อม", "อื่นๆ"]);
});

test("contextFor uses the saved value, else guesses from the old status", () => {
  assert.equal(contextFor({ context: "อื่นๆ", status: "บาดเจ็บขณะแข่งขัน" }), "อื่นๆ");
  assert.equal(contextFor({ status: "บาดเจ็บขณะแข่งขัน" }), "แข่ง");
  assert.equal(contextFor({ status: "บาดเจ็บขณะฝึกซ้อม" }), "ซ้อม");
  assert.equal(contextFor({ status: "หายแล้ว" }), null);
});

test("days out: healed with a return date is final, otherwise counted up to today", () => {
  assert.equal(diffDays("2026-10-12", "2026-10-26"), 14);
  assert.equal(diffDays("2026-10-26", "2026-10-12"), null, "return before injury is invalid");
  assert.equal(diffDays("", "2026-10-12"), null);
  assert.deepEqual(injuryDaysOut({ status: "หายแล้ว", date: "2026-10-12", actualReturnDate: "2026-10-26" }, "2026-11-01"), { days: 14, final: true });
  assert.equal(injuryDaysOut({ status: "หายแล้ว", date: "2026-10-12" }, "2026-11-01"), null);
  assert.deepEqual(injuryDaysOut({ status: "กำลังพักฟื้น", date: "2026-10-12" }, "2026-10-20"), { days: 8, final: false });
});

test("detectRecurrence needs the same player, region and side from an earlier date", () => {
  const list = [
    { id: "a", playerId: "p1", bodyRegion: "ข้อเท้า", side: "ซ้าย", date: "2026-08-14" },
    { id: "b", playerId: "p1", bodyRegion: "ข้อเท้า", side: "ขวา", date: "2026-09-01" },
    { id: "c", playerId: "p2", bodyRegion: "ข้อเท้า", side: "ซ้าย", date: "2026-09-02" },
    { id: "d", playerId: "p1", bodyRegion: "เข่า", side: "ซ้าย", date: "2026-09-03" },
    { id: "e", playerId: "p1", bodyRegion: "ข้อเท้า", side: "ซ้าย", date: "2026-11-01" }
  ];
  const q = { playerId: "p1", bodyRegion: "ข้อเท้า", side: "ซ้าย", date: "2026-10-12" };
  assert.equal(detectRecurrence(list, q).id, "a");
  assert.equal(detectRecurrence(list, { ...q, side: "ขวา" }).id, "b");
  assert.equal(detectRecurrence(list, { ...q, bodyRegion: "" }), null);
  assert.equal(detectRecurrence(list, { ...q, playerId: "" }), null);
  assert.equal(detectRecurrence(list, { ...q, excludeId: "a" }), null);
  assert.equal(detectRecurrence(list, { ...q, date: "2026-08-01" }), null);
});

test("injuryDetailLabels lists region/side, type, mechanism, context, recurrence and days", () => {
  const r = {
    status: "หายแล้ว",
    date: "2026-10-12",
    actualReturnDate: "2026-10-26",
    bodyRegion: "ข้อเท้า",
    side: "ซ้าย",
    injuryType: "เอ็น/ข้อต่อ",
    mechanism: "ไม่ปะทะ",
    context: "ซ้อม",
    isRecurrence: true
  };
  const l = injuryDetailLabels(r, "2026-11-01");
  assert.deepEqual(l.tags, ["ข้อเท้า (ซ้าย)", "เอ็น/ข้อต่อ", "ไม่ปะทะ", "เกิดที่ซ้อม", "บาดเจ็บซ้ำ"]);
  assert.equal(l.daysText, "หยุดไป 14 วัน");
  const old = injuryDetailLabels({ status: "กำลังพักฟื้น", date: "2026-10-12" }, "2026-10-20");
  assert.deepEqual(old.tags, []);
  assert.equal(old.daysText, "ผ่านมา 8 วัน (ยังไม่หาย)");
  assert.deepEqual(injuryDetailLabels({ bodyRegion: "เข่า", side: "ไม่เกี่ยวข้อง" }, "2026-10-12").tags, ["เข่า"]);
});

test("buildInjuryStats: totals, average days out (healed with return date), recurrence and breakdowns", () => {
  const reports = [
    { status: "หายแล้ว", date: "2026-10-01", actualReturnDate: "2026-10-11", bodyRegion: "ข้อเท้า", mechanism: "ไม่ปะทะ", context: "ซ้อม" },
    { status: "หายแล้ว", date: "2026-10-05", actualReturnDate: "2026-10-17", bodyRegion: "ข้อเท้า", mechanism: "ปะทะ", isRecurrence: true, context: "แข่ง" },
    { status: "หายแล้ว", date: "2026-10-05" }, // ไม่มีวันกลับ ไม่นับในค่าเฉลี่ย
    { status: "กำลังพักฟื้น", date: "2026-10-08", bodyRegion: "เข่า" },
    { status: "บาดเจ็บขณะแข่งขัน", date: "2026-10-09" }
  ];
  const s = buildInjuryStats(reports);
  assert.equal(s.total, 5);
  assert.equal(s.active, 2);
  assert.equal(s.avgDaysOut, 11);
  assert.equal(s.avgDaysOutSample, 2);
  assert.equal(s.recurrence, 1);
  assert.equal(s.recurrencePercent, 20);
  assert.deepEqual(s.byRegion, [{ label: "ข้อเท้า", count: 2 }, { label: "เข่า", count: 1 }]);
  // เท่ากัน เรียงตามตัวอักษร (ปะทะ ก่อน ไม่ปะทะ)
  assert.deepEqual(s.byMechanism, [{ label: "ปะทะ", count: 1 }, { label: "ไม่ปะทะ", count: 1 }]);
  assert.deepEqual(s.byContext, [{ label: "แข่ง", count: 2 }, { label: "ซ้อม", count: 1 }]);
  assert.equal(s.withRegion, 3);
  const empty = buildInjuryStats([]);
  assert.equal(empty.avgDaysOut, null);
  assert.equal(empty.recurrencePercent, 0);
});

test("buildInjuryStats folds the long tail of regions into one 'other' row", () => {
  const regions = BODY_REGIONS.slice(0, 8);
  const reports = regions.map((r, i) => ({ status: "หายแล้ว", date: "2026-10-01", bodyRegion: r, isRecurrence: false, _i: i }));
  const s = buildInjuryStats(reports);
  assert.equal(s.byRegion.length, 7);
  assert.equal(s.byRegion[6].count, 2);
});
