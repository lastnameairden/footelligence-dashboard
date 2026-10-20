import { test } from "node:test";
import assert from "node:assert/strict";
import { GRID_COLORS, buildAttendanceGrid, gridHtml, legendHtml, monthDays } from "../js/attendance-grid.js";

const scores = (n) => ({ physical: n, ballSkill: n, gameReading: n, attitude: n });
const rec = (playerId, date, status, n) => ({ playerId, date, status, ...(status === "A" ? { scores: scores(n) } : {}) });

const players = [
  { id: "a", number: 7, nickname: "เจเจ" },
  { id: "b", number: 3, nickname: "เทอรี่" },
  { id: "c", number: 9, nickname: "นัท" }
];

const matchReport = {
  id: "md1",
  matchDay: true,
  date: "2026-10-19",
  ageGroup: "U16",
  players: [
    { id: "a", name: "เจเจ", ageGroup: "U16", guest: false, status: "starter", played: true, rating: 3.5 },
    { id: "b", name: "เทอรี่", ageGroup: "U16", guest: false, status: "starter", played: true, rating: null },
    { id: "c", name: "นัท", ageGroup: "U16", guest: false, status: "none", played: false, rating: null },
    { id: "g1", name: "ฟิวส์", ageGroup: "U15", guest: true, status: "starter", played: true, rating: 3 },
    { id: "g2", name: "บีม", ageGroup: "U14", guest: true, status: "sub", played: false, rating: null }
  ]
};

function build(extra = {}) {
  return buildAttendanceGrid({
    month: "2026-10",
    ageGroup: "U16",
    players,
    attendanceRecords: [rec("a", "2026-10-14", "A", 3), rec("b", "2026-10-14", "A", 2), rec("b", "2026-10-15", "I"), rec("a", "2026-10-15", "P")],
    sessions: [],
    matchReports: [matchReport],
    weekdays: [1, 2, 3, 4, 5],
    today: "2026-10-20",
    ...extra
  });
}

const cell = (grid, id, date) => grid.rows.find((r) => r.player.id === id).cells[Number(date.slice(8)) - 1];

test("monthDays covers the whole month with weekdays (0 = Sunday)", () => {
  const days = monthDays("2026-10");
  assert.equal(days.length, 31);
  assert.deepEqual([days[0].date, days[0].dow], ["2026-10-01", 4]);
  assert.equal(monthDays("2026-02").length, 28);
});

test("normal training days: green score, blue status (I/P/R), orange for a past day nobody checked, white for today/future", () => {
  const g = build();
  assert.deepEqual([cell(g, "a", "2026-10-14").kind, cell(g, "a", "2026-10-14").text], ["score", "3.0"]);
  assert.deepEqual([cell(g, "b", "2026-10-15").kind, cell(g, "b", "2026-10-15").text], ["status", "I"]);
  assert.equal(cell(g, "a", "2026-10-15").text, "P");
  assert.equal(cell(g, "c", "2026-10-14").kind, "missing", "past training day without a record");
  assert.equal(cell(g, "a", "2026-10-20").kind, "pending", "today is not a problem yet");
  assert.equal(cell(g, "a", "2026-10-22").kind, "pending");
  assert.equal(cell(g, "a", "2026-10-17").kind, "inactive", "Saturday is not a training day");
});

test("Match Day: rating in red for players who played, empty red for those who did not, and only for this age group's players", () => {
  const g = build();
  assert.deepEqual([cell(g, "a", "2026-10-19").kind, cell(g, "a", "2026-10-19").text], ["match", "3.5"]);
  assert.deepEqual([cell(g, "b", "2026-10-19").kind, cell(g, "b", "2026-10-19").text], ["match", "–"], "played but not rated yet");
  assert.deepEqual([cell(g, "c", "2026-10-19").kind, cell(g, "c", "2026-10-19").text], ["match_out", ""]);
  // a player missing from the saved report (joined later) counts as not played on that day
  const g2 = build({ players: [...players, { id: "d", number: 1, nickname: "ใหม่" }] });
  assert.equal(cell(g2, "d", "2026-10-19").kind, "match_out");
});

test("Match Day column is active and marked even when it is not a normal training day", () => {
  const g = build({ matchReports: [{ ...matchReport, date: "2026-10-17" }] }); // a Saturday
  const col = g.columns.find((c) => c.date === "2026-10-17");
  assert.deepEqual([col.active, col.matchDay], [true, true]);
  assert.equal(g.columns.find((c) => c.date === "2026-10-16").matchDay, false);
  assert.equal(cell(g, "a", "2026-10-17").kind, "match");
});

test("summary columns count normal training only — Match Day neither counts as attended nor as missed", () => {
  const g = build();
  const a = g.rows.find((r) => r.player.id === "a").summary;
  assert.deepEqual([a.attended, a.missed, a.avg, a.percent], [1, 1, "3.0", 50]);
  const c = g.rows.find((r) => r.player.id === "c").summary;
  assert.deepEqual([c.attended, c.missed, c.avg, c.percent], [0, 0, "-", null], "not in the squad is not an absence");
});

test("players borrowed from another age group who played appear as extra rows with match cells only; unused substitutes do not", () => {
  const g = build();
  assert.deepEqual(g.rows.map((r) => r.player.id), ["a", "b", "c", "g1"]);
  const guest = g.rows.find((r) => r.player.id === "g1");
  assert.equal(guest.guest, true);
  assert.equal(guest.summary, null);
  assert.deepEqual([cell(g, "g1", "2026-10-19").kind, cell(g, "g1", "2026-10-19").text], ["match", "3"]);
  assert.equal(cell(g, "g1", "2026-10-14").kind, "blank");
});

test("a borrowed player's own age-group grid shows that day in red with the rating", () => {
  const g = buildAttendanceGrid({
    month: "2026-10",
    ageGroup: "U15",
    players: [{ id: "g1", number: 5, nickname: "ฟิวส์" }, { id: "x", number: 2, nickname: "อื่น" }],
    attendanceRecords: [],
    sessions: [],
    matchReports: [matchReport],
    weekdays: [1, 2, 3, 4, 5],
    today: "2026-10-20"
  });
  assert.deepEqual([cell(g, "g1", "2026-10-19").kind, cell(g, "g1", "2026-10-19").text], ["match", "3"]);
  assert.equal(cell(g, "x", "2026-10-19").kind, "missing", "another U15 player was not part of the U16 match, so a normal (unchecked) training day");
  assert.equal(g.columns.find((c) => c.date === "2026-10-19").matchDay, true);
});

test("noTraining sessions hide a normal training day; extra sessions add one; old matchReports without details are ignored", () => {
  const g = build({
    sessions: [
      { date: "2026-10-14", noTraining: true },
      { date: "2026-10-17", noTraining: false }
    ],
    matchReports: [{ id: "old", date: "2026-10-12", ageGroup: "U16", opponent: "x" }]
  });
  assert.equal(cell(g, "a", "2026-10-14").kind, "inactive");
  assert.equal(cell(g, "c", "2026-10-17").kind, "missing", "extra Saturday session counts as a training day");
  assert.equal(g.columns.find((c) => c.date === "2026-10-12").matchDay, false);
});

test("gridHtml: colors per meaning (blue for I/P/R, red for Match Day), today ring, legend", () => {
  const html = gridHtml(build());
  assert.ok(html.includes(`background:${GRID_COLORS.status};`), "blue status dot");
  assert.ok(html.includes(`background:${GRID_COLORS.match};`), "red match dot");
  assert.ok(!html.includes("bg-red-700"), "I/P/R are no longer red");
  assert.ok(html.includes("(U15 ยืมมาแข่ง)"));
  assert.ok(html.includes("inset 0 0 0 2px #10b981"), "today ring");
  assert.ok(html.includes("inset 0 -3px 0 #b91c1c"), "Match Day header mark");
  const legend = legendHtml();
  assert.match(legend, /Match Day ไม่ได้ลงสนาม/);
  assert.match(legend, /บาดเจ็บ/);
});
