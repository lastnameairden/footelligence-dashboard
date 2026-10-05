import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LINEUP_SIZE,
  buildLineupFields,
  guestAgeGroupOptions,
  guestCandidates,
  isGoalkeeper,
  lineupFromReport,
  ownGroupCandidates,
  summarizeLineup
} from "../js/match-lineup.js";

const pool = [
  { id: "a1", nickname: "ต้น", ageGroup: "U13", position: "CM", number: 8 },
  { id: "a2", nickname: "เจ", ageGroup: "U13", position: "ST", number: 9 },
  { id: "gk13", nickname: "เกม", ageGroup: "U13", position: "GK", number: 1 },
  { id: "b1", nickname: "บอส", ageGroup: "U14", position: "CB", number: 4 },
  { id: "b2", nickname: "ภูมิ", ageGroup: "U14", position: "GK", number: 1 },
  { id: "c1", nickname: "กาย", ageGroup: "U12", position: "CM", number: 6 },
  { id: "d1", nickname: "ไม่มีรุ่น", ageGroup: null, position: "CM" }
];

test("11 starters", () => assert.equal(MAX_LINEUP_SIZE, 11));

test("ownGroupCandidates includes the goalkeeper of that age group, goalkeepers first", () => {
  const list = ownGroupCandidates(pool, "U13");
  assert.deepEqual(list.map((p) => p.id), ["gk13", "a1", "a2"]);
  assert.equal(isGoalkeeper(list[0]), true);
  assert.deepEqual(ownGroupCandidates(pool, ""), []);
  assert.deepEqual(ownGroupCandidates(pool, "U99"), []);
});

test("guestAgeGroupOptions lists the other age groups with player counts, youngest first", () => {
  assert.deepEqual(guestAgeGroupOptions(pool, "U13"), [
    { ageGroup: "U12", count: 1 },
    { ageGroup: "U14", count: 2 }
  ]);
  assert.deepEqual(guestAgeGroupOptions(pool.filter((p) => p.ageGroup === "U13"), "U13"), []);
  assert.deepEqual(guestCandidates(pool, "U14").map((p) => p.id), ["b2", "b1"]);
});

test("summarizeLineup counts guests per age group and looks for a goalkeeper", () => {
  const sel = [pool[0], pool[2], pool[3], pool[4], pool[5]];
  const s = summarizeLineup(sel, "U13");
  assert.equal(s.total, 5);
  assert.equal(s.guestCount, 3);
  assert.deepEqual(s.guestsByGroup, [
    { ageGroup: "U14", count: 2 },
    { ageGroup: "U12", count: 1 }
  ]);
  assert.equal(s.hasGoalkeeper, true);
  assert.deepEqual(s.goalkeepers, ["เกม", "ภูมิ"]);
  const none = summarizeLineup([pool[0], pool[1]], "U13");
  assert.equal(none.hasGoalkeeper, false);
  assert.equal(none.guestCount, 0);
  assert.deepEqual(summarizeLineup([], "U13"), { total: 0, guestCount: 0, guestsByGroup: [], goalkeepers: [], hasGoalkeeper: false });
});

test("buildLineupFields keeps the old id/name fields and adds the guest list", () => {
  const f = buildLineupFields([pool[0], pool[3]], "U13");
  assert.deepEqual(f.startingLineupIds, ["a1", "b1"]);
  assert.deepEqual(f.startingLineupNames, ["ต้น", "บอส"]);
  assert.deepEqual(f.lineupGuests, [{ id: "b1", name: "บอส", ageGroup: "U14" }]);
  assert.equal(f.lineupGuestCount, 1);
  const own = buildLineupFields([pool[0]], "U13");
  assert.deepEqual(own.lineupGuests, []);
  assert.equal(own.lineupGuestCount, 0);
});

test("lineupFromReport restores the lineup and falls back to the report when a player was removed", () => {
  const report = {
    ageGroup: "U13",
    startingLineupIds: ["a1", "gone1", "gone2"],
    startingLineupNames: ["ต้น", "คนเก่า", "แขกเก่า"],
    lineupGuests: [{ id: "gone2", name: "แขกเก่า", ageGroup: "U15" }]
  };
  const list = lineupFromReport(report, pool);
  assert.equal(list[0], pool[0]);
  assert.equal(list[1].nickname, "คนเก่า");
  assert.equal(list[1].ageGroup, "U13");
  assert.equal(list[2].ageGroup, "U15");
  assert.deepEqual(lineupFromReport({}, pool), []);
});
