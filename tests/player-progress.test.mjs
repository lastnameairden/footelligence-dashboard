import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BARS_PER_PAGE,
  barPage,
  dailyScoreHtml,
  dailyScoreSeries,
  idpHtml,
  idpSummary,
  mascHtml,
  mascRounds,
  matchChartHtml,
  matchDetailHtml,
  playerMatches
} from "../js/player-progress.js";

const P = (id, o = {}) => ({ id, played: true, rating: 3, position: "CM", minutes: 60, goals: 0, assists: 0, yellowCards: 0, redCards: 0, note: null, ...o });
const R = (id, date, result, scoreUs, scoreThem, players, o = {}) => ({ id, matchDay: true, date, opponent: `ทีม ${id}`, result, scoreUs, scoreThem, competition: "ลีก", players, ...o });

const reports = [
  R("m1", "2026-09-07", "ชนะ", 4, 0, [P("me", { rating: 4, goals: 1 }), P("b", { rating: 2 })]),
  R("m2", "2026-09-14", "ชนะ", 2, 1, [P("me", { rating: 3.5 }), P("b", { rating: 3.5 }), P("c", { rating: 3, played: false })]),
  R("m3", "2026-09-21", "เสมอ", 1, 1, [P("me", { rating: 3 }), P("b", { rating: 1 })]),
  R("m4", "2026-09-28", "แพ้", 0, 2, [P("me", { rating: 2.5, yellowCards: 1, note: "ใบเหลืองจากการเข้าเสียบ" })]),
  R("m5", "2026-10-05", "ชนะ", 2, 0, [P("b", { rating: 3 })]), // did not play
  R("m6", "2026-10-12", "ชนะ", 3, 1, [P("me", { rating: null }), P("b", { rating: 3 })]), // played, not rated
  R("m7", "2026-10-19", "ชนะ", 1, 0, [P("me", { rating: 3.5, minutes: null })]),
  { id: "old", date: "2026-03-01", opponent: "เก่า", result: "แพ้", scoreUs: 0, scoreThem: 1 }, // legacy report without players
  R("nm", "2026-10-20", "ชนะ", 1, 0, [P("me", { rating: 4 })], { matchDay: false }) // not a Match Day document
];

test("playerMatches: only rated Match Day appearances of this player, oldest first, with the team average of that match", () => {
  const { matches, unrated, average } = playerMatches(reports, "me");
  assert.deepEqual(matches.map((m) => m.id), ["m1", "m2", "m3", "m4", "m7"]);
  assert.equal(unrated, 1, "m6: played but no rating");
  assert.deepEqual(matches.map((m) => m.teamAvg), [3, 3.5, 2, 2.5, 3.5], "m2 excludes the unused sub from the team average");
  assert.equal(matches[0].goals, 1);
  assert.equal(matches[3].yellow, 1);
  assert.equal(matches[4].minutes, null);
  assert.equal(Math.round(average * 100) / 100, 3.3);
  assert.deepEqual(playerMatches(reports, "nobody"), { matches: [], unrated: 0, average: null });
});

test("barPage: 6 bars = latest 6 appearances, older pages step back, bounds are clamped", () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `x${i + 1}` }));
  assert.equal(BARS_PER_PAGE, 6);
  const p0 = barPage(many, 0);
  assert.deepEqual(p0.bars.map((b) => b.id), ["x9", "x10", "x11", "x12", "x13", "x14"]);
  assert.deepEqual([p0.hasOlder, p0.hasNewer], [true, false]);
  const p1 = barPage(many, 1);
  assert.deepEqual(p1.bars.map((b) => b.id), ["x3", "x4", "x5", "x6", "x7", "x8"]);
  const p2 = barPage(many, 2);
  assert.deepEqual(p2.bars.map((b) => b.id), ["x1", "x2"]);
  assert.deepEqual([p2.hasOlder, p2.hasNewer], [false, true]);
  assert.equal(barPage(many, 99).page, 2);
  assert.equal(barPage(many, -5).page, 0);
  assert.deepEqual(barPage([], 0).bars, []);
});

test("matchChartHtml: a bar per match coloured by result, labels with date/opponent/score, team line and player average line; empty state", () => {
  const { matches, average } = playerMatches(reports, "me");
  const html = matchChartHtml({ bars: barPage(matches, 0).bars, average, selectedId: "m4" });
  assert.equal((html.match(/class="match-bar"/g) || []).length, 5);
  assert.match(html, /fill="#3f7d3a"/);
  assert.match(html, /fill="#d9902f"/);
  assert.match(html, /fill="#e24b4a"/);
  assert.match(html, /data-match-id="m3"/);
  assert.match(html, /7 ก\.ย\./);
  assert.match(html, /4-0/);
  assert.match(html, /<polyline/);
  assert.match(html, /stroke="#111" stroke-width="2"/);
  assert.match(html, /ค่าเฉลี่ยของนักกีฬา \(3\.3\)/);
  assert.match(html, /stroke="#111" stroke-width="2"><\/rect>|stroke-width="2"><\/rect>/, "selected bar is outlined");
  assert.match(matchChartHtml({ bars: [], average: null }), /ยังไม่มีคะแนนจาก Match Day/);
  const evil = playerMatches([R("e", "2026-10-01", "ชนะ", 1, 0, [P("me")], { opponent: "<img src=x onerror=1>" })], "me");
  assert.ok(!matchChartHtml({ bars: evil.matches, average: 3 }).includes("<img"));
});

test("matchDetailHtml: result, score, position, minutes, goals/assists, cards, ratings and the note (escaped)", () => {
  const { matches } = playerMatches(reports, "me");
  const html = matchDetailHtml(matches[3]);
  assert.match(html, /28 ก\.ย\. · พบ ทีม m4/);
  assert.match(html, /badge-danger[^>]*>แพ้/);
  assert.match(html, /0 - 2/);
  assert.match(html, /ใบเหลือง \/ ใบแดง<\/dt><dd>1 \/ 0/);
  assert.match(html, /2\.5 \/ 4/);
  assert.match(html, /ใบเหลืองจากการเข้าเสียบ/);
  assert.match(matchDetailHtml(matches[4]), /นาทีที่ลงเล่น<\/dt><dd>-/);
  assert.equal(matchDetailHtml(null), "");
});

const sc = (a, b, c, d) => ({ physical: a, ballSkill: b, gameReading: c, attitude: d });
const att = (date, status, scores) => ({ date, status, scores });

test("dailyScoreSeries: 30-day window, per-day averages, category means vs the previous 30 days, status counts", () => {
  const today = "2026-10-20";
  const records = [
    att("2026-10-19", "A", sc(4, 4, 3, 4)),
    att("2026-10-18", "A", sc(3, 3, 3, 3)),
    att("2026-10-17", "P"),
    att("2026-10-10", "I"),
    att("2026-09-30", "A", sc(2, 2, 2, 2)), // previous window (09-20 .. 10-20 is current: 09-21..10-20)
    att("2026-09-10", "A", sc(2, 3, 2, 3)), // previous window
    att("2026-07-01", "A", sc(4, 4, 4, 4)) // too old
  ];
  const s = dailyScoreSeries(records, today, 30);
  assert.equal(s.curStart, "2026-09-21");
  assert.deepEqual(s.points.map((p) => p.date), ["2026-09-30", "2026-10-18", "2026-10-19"]);
  assert.deepEqual(s.counts, { A: 3, P: 1, I: 1, R: 0 });
  const physical = s.categories.find((c) => c.key === "physical");
  assert.equal(physical.current, 3);
  assert.equal(physical.previous, 2);
  assert.equal(physical.delta, 1);
  assert.equal(Math.round(s.overall * 100) / 100, 2.92);
  assert.equal(s.categories.every((c) => c.color), true);
  const html = dailyScoreHtml(s);
  assert.match(html, /<polyline/);
  assert.match(html, /มาซ้อม <b>3<\/b> · ลา <b>1<\/b> · บาดเจ็บ <b>1<\/b>/);
  assert.match(html, /↑ \+1/);
  assert.match(dailyScoreHtml(dailyScoreSeries([], today, 30)), /ยังไม่มีคะแนนฝึกซ้อมรายวัน/);
});

test("dailyScoreSeries: no scores in the last 30 days shifts the window to the latest scored day instead of showing nothing", () => {
  const today = "2026-10-20";
  const records = [att("2026-08-10", "A", sc(3, 3, 3, 3)), att("2026-08-05", "A", sc(2, 2, 2, 2)), att("2026-10-01", "P")];
  const s = dailyScoreSeries(records, today, 30);
  assert.equal(s.shifted, true);
  assert.equal(s.todayStr, "2026-08-10");
  assert.deepEqual(s.points.map((p) => p.date), ["2026-08-05", "2026-08-10"]);
  assert.match(dailyScoreHtml(s), /<polyline/);
  assert.match(dailyScoreHtml(s), /ไม่มีคะแนนใน 30 วันล่าสุด/);
  // มีคะแนนในช่วงล่าสุดอยู่แล้ว = ไม่เลื่อน
  assert.equal(dailyScoreSeries([att("2026-10-19", "A", sc(4, 4, 4, 4))], today, 30).shifted, false);
  // ไม่มีคะแนนเลย = ไม่เลื่อน (ยังขึ้นข้อความ "ยังไม่มีคะแนน")
  assert.equal(dailyScoreSeries([att("2026-10-01", "P")], today, 30).shifted, false);
});

const ev = (label, M, A, S, C, time, extra = {}) => ({
  assessmentPeriod: label,
  updatedAt: { toDate: () => new Date(time) },
  scores: { M, A, S, C },
  ...extra
});
const all = (v) => [v, v, v, v];

test("mascRounds: grades per round oldest first, the latest evaluation wins for the same round, incomplete rounds without any grade are dropped", () => {
  const rounds = mascRounds([
    ev("รอบที่ 2", all(9), all(7), all(3), all(7), "2026-10-01T00:00:00Z", { talent: "ผ่านบอลดี", limitations: "ใช้เท้าซ้าย", observations: "ตั้งใจ" }),
    ev("รอบที่ 1", all(3), all(3), all(3), all(1), "2026-05-20T00:00:00Z"),
    ev("รอบที่ 1", all(3), all(7), all(3), all(3), "2026-05-25T00:00:00Z"),
    ev("ว่าง", [null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null], "2026-06-01T00:00:00Z")
  ]);
  assert.deepEqual(rounds.map((r) => r.label), ["รอบที่ 1", "รอบที่ 2"]);
  assert.deepEqual(rounds[0].grades, { M: 3, A: 7, S: 3, C: 3 }, "later duplicate replaces the earlier one");
  assert.deepEqual(rounds[1].grades, { M: 9, A: 7, S: 3, C: 7 });
  assert.equal(rounds[1].talent, "ผ่านบอลดี");
  const html = mascHtml(rounds);
  assert.match(html, /รอบล่าสุด <b>รอบที่ 2<\/b>/);
  assert.match(html, /M 9[^<]*<span class="text-emerald-600">↑/);
  assert.match(html, /A 7 <span class="text-slate-400">→/);
  assert.match(html, /S 3 <span class="text-slate-400">→/);
  assert.match(html, /C 7 <span class="text-emerald-600">↑/);
  assert.match(mascHtml([]), /ยังไม่มีผลการประเมิน/);
});

test("idpSummary: strengths and areas to improve from the latest MASC, daily scores and fitness trends; empty data gives empty lists", () => {
  const masc = mascRounds([ev("รอบที่ 2", all(9), all(7), all(3), all(7), "2026-10-01T00:00:00Z", { talent: "ผ่านบอลดี" })]);
  const daily = dailyScoreSeries(
    [
      ...["01", "02", "03", "04", "05", "06"].map((d) => att(`2026-10-${d}`, "A", sc(4, 3, 2, 3))),
      ...["01", "02", "03", "04", "05", "06"].map((d) => att(`2026-09-${d}`, "A", sc(2, 3, 2, 3)))
    ],
    "2026-10-20",
    30
  );
  const series = [
    { label: "Baseline", values: { broad_jump: 180, sprint_10: 1.9, height: 160 } },
    { label: "Re-evaluation", values: { broad_jump: 195, sprint_10: 2.1, height: 164 } }
  ];
  const s = idpSummary({ masc, daily, fitnessSeries: series });
  assert.ok(s.strengths.some((t) => /MASC \(รอบที่ 2\): Motricity เกรดสูงสุด \(9\)/.test(t)));
  assert.ok(s.improve.some((t) => /MASC \(รอบที่ 2\): Smart เกรดต่ำสุด \(3\)/.test(t)));
  assert.ok(s.strengths.some((t) => /คะแนนรายวัน: สมรรถภาพร่างกาย สูงสุด \(4\/4\)/.test(t)));
  assert.ok(s.improve.some((t) => /คะแนนรายวัน: อ่านเกม\/การรับรู้ ต่ำสุด/.test(t)));
  assert.ok(s.strengths.some((t) => /ผลทดสอบสมรรถภาพ \(Re-evaluation\) ดีขึ้น: Broad Jump/.test(t)));
  assert.ok(s.improve.some((t) => /ลดลงเล็กน้อย: Sprint 10 ม\./.test(t)));
  assert.equal(s.notes.talent, "ผ่านบอลดี");
  const html = idpHtml(s);
  assert.match(html, /จุดเด่น/);
  assert.match(html, /ควรพัฒนา/);
  assert.match(html, /ผ่านบอลดี/);
  const none = idpSummary({ masc: [], daily: dailyScoreSeries([], "2026-10-20"), fitnessSeries: [] });
  assert.deepEqual([none.strengths, none.improve, none.notes], [[], [], null]);
  assert.match(idpHtml(none), /ยังมีข้อมูลไม่พอสำหรับสรุป/);
});
