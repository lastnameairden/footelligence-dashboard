import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMatchDayPayload,
  cleanupRows,
  expectedStarters,
  formFromReport,
  formationError,
  matchDayDocId,
  MATCH_RATING_MAX,
  minutesPlayed,
  newRow,
  normalizeMinute,
  parseFormation,
  parseMinute,
  playedIds,
  replacementOptions,
  resultForScore,
  setReplacement,
  setStatus,
  subInfo,
  validateMatchDay
} from "../js/match-day.js";

test("parseMinute accepts mm:ss up to 130 minutes and rejects the rest; normalizeMinute pads", () => {
  assert.equal(parseMinute("67:00"), 4020);
  assert.equal(parseMinute("7:05"), 425);
  assert.equal(parseMinute("00:00"), 0);
  assert.equal(parseMinute("131:00"), null, "over 130 minutes");
  assert.equal(parseMinute("67"), null);
  assert.equal(parseMinute("67:60"), null);
  assert.equal(parseMinute(""), null);
  assert.equal(normalizeMinute("7:05"), "07:05");
  assert.equal(normalizeMinute("abc"), null);
});

test("resultForScore", () => {
  assert.equal(resultForScore(3, 1), "ชนะ");
  assert.equal(resultForScore(1, 1), "เสมอ");
  assert.equal(resultForScore(0, 2), "แพ้");
  assert.equal(resultForScore(null, 1), null);
});

test("formation must match the match format (players outside the goal)", () => {
  assert.equal(parseFormation("4-3-3").outfield, 10);
  assert.equal(parseFormation("4-2-3-1").outfield, 10);
  assert.equal(parseFormation("433"), null);
  assert.equal(parseFormation("4-0-3"), null);
  assert.equal(formationError("11v11", "4-3-3"), null);
  assert.equal(formationError("11v11", "4-2-3-1"), null);
  assert.match(formationError("11v11", "3-3-2"), /ไม่ตรงกับ 11v11/);
  assert.equal(formationError("9v9", "3-3-2"), null);
  assert.equal(formationError("7v7", "2-3-1"), null);
  assert.match(formationError("7v7", "4-3-3"), /ไม่ตรงกับ 7v7/);
  assert.equal(formationError("other", "3-3"), null);
  assert.match(formationError("other", "2-1"), /4-10/);
  assert.match(formationError("11v11", "abc"), /รูปแบบ/);
});

test("expectedStarters: 7/9/11 by format, or formation total + keeper for other", () => {
  assert.equal(expectedStarters("11v11", ""), 11);
  assert.equal(expectedStarters("9v9", "x"), 9);
  assert.equal(expectedStarters("other", "3-3"), 7);
  assert.equal(expectedStarters("other", "nope"), null);
});

const mk = (id, status, extra = {}) => ({ ...newRow({ id, nickname: id, ageGroup: "U16", position: "CM", number: Number(id.replace(/\D/g, "")) || null }, "U16"), status, ...extra });

test("newRow marks players from another age group as guests", () => {
  assert.equal(newRow({ id: "a", ageGroup: "U15" }, "U16").guest, true);
  assert.equal(newRow({ id: "a", ageGroup: "U16" }, "U16").guest, false);
});

test("substitution links both ways: sub plays only if he replaces someone", () => {
  let rows = [mk("A", "starter", { position: "ST" }), mk("B", "sub"), mk("C", "sub")];
  assert.deepEqual([...playedIds(rows)], ["A"]);
  rows = setReplacement(rows, "A", "B");
  rows = rows.map((r) => (r.id === "A" ? { ...r, outMinute: "67:00" } : r));
  assert.deepEqual([...playedIds(rows)].sort(), ["A", "B"]);
  assert.deepEqual(subInfo(rows).get("B"), { outId: "A", minute: "67:00" });
  // C is not selectable for A once B is chosen elsewhere; B is still offered to A
  assert.deepEqual(replacementOptions(rows, "A").map((r) => r.id).sort(), ["B", "C"]);
  assert.deepEqual(replacementOptions(rows, "C").map((r) => r.id), [], "B is taken by A, C cannot replace himself");
});

test("moving a substitute to replace someone else frees the previous link", () => {
  let rows = [mk("A", "starter"), mk("B", "starter"), mk("S", "sub")];
  rows = setReplacement(rows, "A", "S");
  rows = setReplacement(rows, "B", "S");
  assert.equal(rows.find((r) => r.id === "A").replacedBy, "");
  assert.equal(rows.find((r) => r.id === "B").replacedBy, "S");
});

test("changing a starter to 'none' clears goals, rating, minute and the substitute link", () => {
  let rows = [mk("A", "starter", { goals: "2", assists: "1", rating: 3.5, outMinute: "60:00" }), mk("S", "sub", { goals: "1", rating: 3 })];
  rows = setReplacement(rows, "A", "S");
  rows = setStatus(rows, "A", "none");
  const a = rows.find((r) => r.id === "A");
  assert.deepEqual([a.goals, a.assists, a.rating, a.outMinute, a.replacedBy, a.position], ["", "", null, "", "", ""]);
  const s = rows.find((r) => r.id === "S");
  assert.deepEqual([s.goals, s.rating], ["", null], "the substitute never came on, so his stats are cleared too");
});

test("setStatus fills the registered position when it is a standard one", () => {
  const rows = setStatus([newRow({ id: "A", ageGroup: "U16", position: "GK" }, "U16"), newRow({ id: "B", ageGroup: "U16", position: "weird" }, "U16")], "A", "starter");
  assert.equal(rows[0].position, "GK");
  assert.equal(setStatus(rows, "B", "starter")[1].position, "");
});

test("cleanupRows handles substitution chains (sub replaced again) and drops dangling links", () => {
  let rows = [mk("A", "starter"), mk("B", "sub"), mk("C", "sub")];
  rows = setReplacement(rows, "A", "B");
  rows = setReplacement(rows, "B", "C");
  assert.deepEqual([...playedIds(rows)].sort(), ["A", "B", "C"]);
  rows = setStatus(rows, "A", "sub"); // A no longer a starter → B no longer came on → C never came on
  assert.deepEqual([...playedIds(cleanupRows(rows))], []);
});

function validForm(overrides = {}) {
  const rows = [];
  for (let i = 1; i <= 11; i++) rows.push(mk(`P${i}`, "starter", { position: i === 1 ? "GK" : "CM" }));
  rows.push(mk("S1", "sub"), mk("N1", "none"));
  return {
    format: "11v11",
    formatOther: "",
    competitionType: "ลีก",
    competition: "Thailand Youth League",
    opponent: "Bangkok FC U16",
    result: "ชนะ",
    scoreUs: "3",
    scoreThem: "1",
    formation: "4-3-3",
    rows,
    oppAttack: "โยนยาวหาหน้า",
    oppDefense: "ตั้งรับต่ำ",
    videoUrl: "",
    notes: "",
    ...overrides
  };
}

test("validateMatchDay: a complete form passes with no errors", () => {
  assert.deepEqual(validateMatchDay(validForm()), { errors: [], warnings: [] });
});

test("validateMatchDay blocks on the required pieces", () => {
  const v = (o) => validateMatchDay(validForm(o)).errors.join("|");
  assert.match(v({ format: "" }), /ประเภทการแข่งขัน/);
  assert.match(v({ format: "other", formatOther: " " }), /อื่นๆ/);
  assert.match(v({ competition: "" }), /ชื่อรายการ/);
  assert.match(v({ opponent: "" }), /คู่แข่ง/);
  assert.match(v({ result: "" }), /ผลการแข่งขัน/);
  assert.match(v({ scoreUs: "" }), /ตัวเลข/);
  assert.match(v({ formation: "" }), /แผนการเล่น/);
  assert.match(v({ formation: "3-3-2" }), /ไม่ตรงกับ 11v11/);
  assert.match(v({ oppAttack: " " }), /เกมรุก/);
  assert.match(v({ oppDefense: "" }), /เกมรับ/);
  assert.match(v({ videoUrl: "http://x.com/a" }), /https/);
  assert.equal(validateMatchDay(validForm({ videoUrl: "https://youtube.com/watch?v=1" })).errors.length, 0);
});

test("validateMatchDay: starters must total 11 and include a goalkeeper and positions", () => {
  const rows = validForm().rows;
  assert.match(validateMatchDay(validForm({ rows: rows.slice(1) })).errors.join("|"), /ตัวจริงต้องครบ 11 คน \(ตอนนี้ 10 คน\)/);
  const noGk = rows.map((r) => (r.position === "GK" ? { ...r, position: "CB" } : r));
  assert.match(validateMatchDay(validForm({ rows: noGk })).errors.join("|"), /ผู้รักษาประตู/);
  const noPos = rows.map((r) => (r.id === "P5" ? { ...r, position: "" } : r));
  assert.match(validateMatchDay(validForm({ rows: noPos })).errors.join("|"), /ตำแหน่งการเล่นของตัวจริง "P5"/);
  // 9v9 expects 9 starters
  assert.match(validateMatchDay(validForm({ format: "9v9", formation: "3-3-2" })).errors.join("|"), /ครบ 9 คน/);
});

test("validateMatchDay: substitution needs a 00:00 minute; warnings for score mismatch and goal sum", () => {
  let rows = validForm().rows.map((r) => (r.id === "P2" ? { ...r, goals: "5" } : r));
  rows = setReplacement(rows, "P2", "S1");
  let res = validateMatchDay(validForm({ rows }));
  assert.match(res.errors.join("|"), /นาทีที่ "P2" ถูกเปลี่ยนออก/);
  rows = rows.map((r) => (r.id === "P2" ? { ...r, outMinute: "67:00" } : r));
  res = validateMatchDay(validForm({ rows }));
  assert.deepEqual(res.errors, []);
  assert.match(res.warnings.join("|"), /ผลรวมประตูของผู้เล่น \(5\) มากกว่าประตูทีมเรา \(3\)/);
  assert.match(validateMatchDay(validForm({ rows, result: "แพ้" })).warnings.join("|"), /ไม่ตรงกับสกอร์ 3-1/);
  rows = rows.map((r) => (r.id === "P3" ? { ...r, outMinute: "9999" } : r));
  assert.match(validateMatchDay(validForm({ rows })).errors.join("|"), /นาทีที่ "P3" ออกจากสนามต้องเป็นรูปแบบ 00:00/);
});

test("validateMatchDay: a substitute taken off before he came on is rejected", () => {
  let rows = validForm().rows.concat(mk("S2", "sub"));
  rows = setReplacement(rows, "P2", "S1");
  rows = setReplacement(rows, "S1", "S2");
  rows = rows.map((r) => (r.id === "P2" ? { ...r, outMinute: "60:00" } : r.id === "S1" ? { ...r, outMinute: "50:00" } : r));
  assert.match(validateMatchDay(validForm({ rows })).errors.join("|"), /"S1" ถูกเปลี่ยนออกก่อนนาทีที่ลงสนาม/);
});

test("buildMatchDayPayload keeps the old matchReports fields and adds the Match Day ones", () => {
  let rows = validForm().rows.map((r) => (r.id === "P2" ? { ...r, goals: "2", outMinute: "67:00", rating: 3.5 } : r));
  rows = setReplacement(rows, "P2", "S1");
  rows = rows.map((r) => (r.id === "S1" ? { ...r, goals: "1", assists: "1", rating: 2.5 } : r));
  rows.push(newRow({ id: "G1", nickname: "ฟิวส์", ageGroup: "U15", position: "CM" }, "U16"));
  rows = setStatus(rows, "G1", "sub");
  const payload = buildMatchDayPayload(validForm({ rows }), "U16");
  assert.equal(payload.matchDay, true);
  assert.equal(payload.opponent, "Bangkok FC U16");
  assert.equal(payload.competitionType, "ลีก");
  assert.equal(payload.competition, "Thailand Youth League");
  assert.deepEqual([payload.result, payload.scoreUs, payload.scoreThem, payload.formation], ["ชนะ", 3, 1, "4-3-3"]);
  assert.equal(payload.startingLineupIds.length, 11, "old lineup field = starters only");
  assert.equal(payload.lineupGuestCount, 0, "the guest is only a substitute who never played");
  const p2 = payload.players.find((p) => p.id === "P2");
  assert.deepEqual([p2.goals, p2.subOutMinute, p2.replacedById, p2.rating, p2.played], [2, "67:00", "S1", 3.5, true]);
  const s1 = payload.players.find((p) => p.id === "S1");
  assert.deepEqual([s1.goals, s1.assists, s1.subInMinute, s1.replacesId, s1.played, s1.rating], [1, 1, "67:00", "P2", true, 2.5]);
  const g1 = payload.players.find((p) => p.id === "G1");
  assert.deepEqual([g1.guest, g1.ageGroup, g1.played, g1.rating], [true, "U15", false, null]);
  assert.equal(payload.players.find((p) => p.id === "N1").played, false);
  assert.equal(payload.videoUrl, null);
  assert.equal(payload.matchFormatOther, null);
});

test("a guest starter shows up in the legacy lineup fields", () => {
  let rows = validForm().rows.filter((r) => r.id !== "P11");
  rows.push(newRow({ id: "G9", nickname: "บีม", ageGroup: "U14", position: "RW" }, "U16"));
  rows = setStatus(rows, "G9", "starter");
  const payload = buildMatchDayPayload(validForm({ rows }), "U16");
  assert.deepEqual(payload.lineupGuests, [{ id: "G9", name: "บีม", ageGroup: "U14" }]);
  assert.equal(payload.lineupGuestCount, 1);
});

test("formFromReport restores what buildMatchDayPayload saved", () => {
  let rows = validForm().rows.map((r) => (r.id === "P2" ? { ...r, goals: "2", outMinute: "67:00", rating: 3.5 } : r));
  rows = setReplacement(rows, "P2", "S1");
  const form = validForm({ rows });
  const back = formFromReport(buildMatchDayPayload(form, "U16"));
  assert.deepEqual(validateMatchDay(back), validateMatchDay(form));
  const p2 = back.rows.find((r) => r.id === "P2");
  assert.deepEqual([p2.goals, p2.outMinute, p2.replacedBy, p2.rating], ["2", "67:00", "S1", 3.5]);
  assert.equal(back.format, "11v11");
});

test("rating scale is 4 stars in half steps", () => {
  assert.equal(MATCH_RATING_MAX, 4);
  const rows = validForm().rows;
  const withRating = (rating) => validateMatchDay(validForm({ rows: rows.map((r) => (r.id === "P2" ? { ...r, rating } : r)) })).errors.join("|");
  assert.equal(withRating(4), "");
  assert.equal(withRating(0.5), "");
  assert.match(withRating(4.5), /ระหว่าง 0\.5-4 ดาว/);
  assert.match(withRating(5), /ระหว่าง 0\.5-4 ดาว/);
  assert.match(withRating(2.3), /ครั้งละครึ่งดาว/);
});

test("matchDayDocId is stable per team + date + age group and safe as a document id", () => {
  assert.equal(matchDayDocId("THAWEE SC", "2026-10-19", "U16"), "md_2026-10-19_U16_THAWEE-SC");
  assert.equal(matchDayDocId("THAWEE SC", "2026-10-19", "U16"), matchDayDocId("THAWEE SC", "2026-10-19", "U16"));
});

test("minutesPlayed: starter until he leaves, substitute from his entry, full time for the rest, unknown without a length", () => {
  let rows = validForm().rows.map((r) => (r.id === "P2" ? { ...r, outMinute: "67:00" } : r));
  rows = setReplacement(rows, "P2", "S1");
  const by = (id, length) => minutesPlayed(rows.find((r) => r.id === id), rows, length);
  assert.equal(by("P2", 80), 67);
  assert.equal(by("S1", 80), 13);
  assert.equal(by("P3", 80), 80);
  assert.equal(by("P3", null), null, "no match length and still on the pitch at the end");
  assert.equal(by("P2", null), 67, "left at a known minute, length not needed");
  assert.equal(by("N1", 80), 0, "not in the squad");
  assert.equal(by("S1", null), null);
});

test("new Match Day fields: time, venue, length, cards and per-player notes are validated, saved and restored", () => {
  const rows = validForm().rows.map((r) => (r.id === "P3" ? { ...r, yellow: "1", note: " ยิงสวย " } : r.id === "P4" ? { ...r, red: "1" } : r));
  const form = validForm({ rows, matchTime: "13:00", venue: "สนาม A", matchLength: "80" });
  assert.deepEqual(validateMatchDay(form).errors, []);
  const payload = buildMatchDayPayload(form, "U16");
  assert.deepEqual([payload.matchTime, payload.venue, payload.matchLengthMinutes], ["13:00", "สนาม A", 80]);
  const p3 = payload.players.find((p) => p.id === "P3");
  assert.deepEqual([p3.yellowCards, p3.redCards, p3.note, p3.minutes], [1, 0, "ยิงสวย", 80]);
  assert.equal(payload.players.find((p) => p.id === "P4").redCards, 1);
  const back = formFromReport(payload);
  assert.deepEqual([back.matchTime, back.venue, back.matchLength], ["13:00", "สนาม A", "80"]);
  const r3 = back.rows.find((r) => r.id === "P3");
  assert.deepEqual([r3.yellow, r3.red, r3.note], ["1", "", "ยิงสวย"]);
  // the optional fields may stay empty
  const bare = buildMatchDayPayload(validForm(), "U16");
  assert.deepEqual([bare.matchTime, bare.venue, bare.matchLengthMinutes], [null, null, null]);
});

test("new Match Day fields reject bad values", () => {
  const e = (o) => validateMatchDay(validForm(o)).errors.join("|");
  assert.match(e({ matchTime: "25:00" }), /เวลาแข่ง/);
  assert.match(e({ matchTime: "1pm" }), /เวลาแข่ง/);
  assert.match(e({ matchLength: "5" }), /ความยาวการแข่งขัน/);
  assert.match(e({ matchLength: "80.5" }), /ความยาวการแข่งขัน/);
  const rows = validForm().rows;
  assert.match(e({ rows: rows.map((r) => (r.id === "P3" ? { ...r, yellow: "3" } : r)) }), /ใบเหลือง\/ใบแดงของ "P3"/);
  assert.match(e({ rows: rows.map((r) => (r.id === "P3" ? { ...r, red: "2" } : r)) }), /ใบเหลือง\/ใบแดงของ "P3"/);
});

test("cards and notes are cleared for a player who did not play", () => {
  let rows = [mk("A", "starter", { yellow: "1", red: "1", note: "x" })];
  rows = setStatus(rows, "A", "none");
  assert.deepEqual([rows[0].yellow, rows[0].red, rows[0].note], ["", "", ""]);
});

test("the shirt number is kept on the row, saved in players[] and restored", () => {
  assert.equal(newRow({ id: "a", number: 7, ageGroup: "U16" }, "U16").number, 7);
  assert.equal(newRow({ id: "a", ageGroup: "U16" }, "U16").number, null);
  const payload = buildMatchDayPayload(validForm(), "U16");
  assert.equal(payload.players.find((p) => p.id === "P5").number, 5);
  assert.equal(formFromReport(payload).rows.find((r) => r.id === "P5").number, 5);
});