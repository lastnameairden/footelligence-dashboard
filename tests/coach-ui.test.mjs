import { test } from "node:test";
import assert from "node:assert/strict";
import { TEAM_THEMES, applyTeamTheme, contrastWithWhite, teamThemeVars } from "../js/team-theme.js";
import fs from "node:fs";
import { COACH_MENU, activeChildFor, childMatchesScreen, menuItem, menuKeyForScreen } from "../js/coach-menu.js";
import { COACH_SCREEN_KEYS } from "../js/screen-route.js";
import { ageGroupsOf, birthYearLabel, birthdayLabel, filterAndSortPlayers, playerDisplayName } from "../js/player-gallery.js";

test("team themes: white text is readable (>= 4.5:1) on every header and accent color", () => {
  for (const [team, t] of Object.entries(TEAM_THEMES)) {
    for (const key of ["header", "accent", "accentHover"]) {
      assert.ok(contrastWithWhite(t[key]) >= 4.5, `${team} ${key} ${t[key]} contrast ${contrastWithWhite(t[key]).toFixed(2)}`);
    }
  }
});

test("teamThemeVars covers the three teams and nothing else; accent tint is a 10% wash of the accent", () => {
  assert.deepEqual(Object.keys(TEAM_THEMES).sort(), ["KHAMPHEE FOOTBALL", "THAMMASATHIT", "THAWEE SC"]);
  assert.equal(teamThemeVars("NOPE"), null);
  assert.equal(teamThemeVars(null), null);
  const v = teamThemeVars("THAWEE SC");
  assert.equal(v["--accent"], "#b01e38");
  assert.equal(v["--accent-tint"], "rgba(176, 30, 56, 0.1)");
  assert.equal(v["--header-ink"], "#FFFFFF");
});

test("applyTeamTheme sets then clears the CSS variables and the data attribute", () => {
  const store = new Map();
  const attrs = new Map();
  const root = {
    style: { setProperty: (k, v) => store.set(k, v), removeProperty: (k) => store.delete(k) },
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k)
  };
  applyTeamTheme("KHAMPHEE FOOTBALL", root);
  assert.equal(store.get("--header-bg"), "#0b2a5b");
  assert.equal(attrs.get("data-team-theme"), "KHAMPHEE FOOTBALL");
  applyTeamTheme("THAMMASATHIT", root);
  assert.equal(store.get("--accent"), "#c2410c", "switching teams replaces the previous theme");
  applyTeamTheme(null, root);
  assert.equal(store.size, 0);
  assert.equal(attrs.size, 0);
});

test("coach menu: exactly the ten requested items, in order, English labels", () => {
  assert.deepEqual(
    COACH_MENU.map((m) => m.label),
    ["Instruction", "Player Data", "Attendance Check", "Attendance", "Training Plan", "Match Data", "Evaluation", "Injury/Sick", "Meeting", "Profile"]
  );
  assert.equal(new Set(COACH_MENU.map((m) => m.key)).size, 10);
});

test("coach menu only points at screens that exist, and every coach screen belongs to one menu", () => {
  for (const m of COACH_MENU) {
    assert.ok(COACH_SCREEN_KEYS.includes(m.screen), `${m.key} → ${m.screen}`);
    assert.ok(m.screens.includes(m.screen));
    for (const c of m.children || []) if (c.screen) assert.ok(m.screens.includes(c.screen), `${m.key} child ${c.screen}`);
  }
  for (const screen of COACH_SCREEN_KEYS) assert.notEqual(menuKeyForScreen(screen), null, `screen ${screen} has no menu`);
  assert.equal(menuKeyForScreen("report"), "training-plan");
  assert.equal(menuKeyForScreen("player-detail"), "player-data");
  assert.equal(menuKeyForScreen("nope"), null);
  assert.equal(menuItem("meeting").screen, "meeting-tasks");
  assert.equal(menuKeyForScreen("profile"), "profile");
});

test("Training Plan menu: landing + 4 live options + 3 disabled 'coming soon' options; old plan/report links stay under it", () => {
  const tp = menuItem("training-plan");
  assert.equal(tp.screen, "training-plan");
  assert.deepEqual(tp.children.map((c) => c.label), ["Upload Training Plan", "Training Plan Data", "Training Report", "Training Report Data", "FootelligencePad", "Footelligence Logbook", "Export"]);
  assert.deepEqual(tp.children.filter((c) => c.disabled).map((c) => c.label), ["FootelligencePad", "Footelligence Logbook", "Export"]);
  for (const c of tp.children.filter((c) => c.disabled)) assert.equal(c.screen, undefined, `${c.label} must not navigate`);
  for (const s of ["training-plan", "plan", "plan-data", "report", "report-data"]) assert.equal(menuKeyForScreen(s), "training-plan", s);
  assert.equal(childMatchesScreen(tp.children[2], "report"), true);
  assert.equal(childMatchesScreen(tp.children[4], "report"), false);
});

test("Evaluation menu: Footelligence Test (MASC), Physical Test with 3 sub-options, Athlete Results", () => {
  const ev = menuItem("evaluation");
  assert.equal(ev.screen, "evaluation");
  assert.deepEqual(ev.children.map((c) => c.label), ["Footelligence Test", "Physical Test", "Athlete Results"]);
  assert.equal(ev.children[0].external, "masc");
  const physical = ev.children[1];
  assert.deepEqual(physical.children.map((c) => [c.label, c.screen]), [["Instruction", "physical-instruction"], ["Testing Form", "physical-form"], ["Data Entry", "fitness"]]);
  for (const s of ["evaluation", "physical-test", "physical-instruction", "physical-form", "fitness", "athlete-results"]) assert.equal(menuKeyForScreen(s), "evaluation", s);
  for (const g of physical.children) assert.ok(physical.screens.includes(g.screen), g.screen);
  assert.equal(activeChildFor(ev, "physical-form")?.label, "Physical Test");
  assert.equal(activeChildFor(ev, "fitness")?.label, "Physical Test", "old fitness entry page now lives under Physical Test");
  assert.equal(activeChildFor(ev, "athlete-results"), null, "no second row for leaf sub-menus");
  assert.equal(activeChildFor(menuItem("meeting"), "meeting-tasks"), null);
  assert.equal(activeChildFor(null, "fitness"), null);
});

test("birthYearLabel / birthdayLabel show Gregorian / Buddhist years", () => {
  assert.equal(birthYearLabel("2009-03-12"), "2009 / 2552");
  assert.equal(birthYearLabel(""), "-");
  assert.equal(birthYearLabel(null), "-");
  assert.equal(birthYearLabel("12/03/2009"), "-");
  assert.equal(birthdayLabel("2009-03-12"), "12 มี.ค. 2009 / 2552");
  assert.equal(birthdayLabel("2009-13-12"), "-");
});

const roster = [
  { id: "a", nickname: "เจเจ", fullName: "ภพธรรม พรคต", ageGroup: "U16", number: 7 },
  { id: "b", nickname: "เทอรี่", fullName: "เจตนิพัทธ์ คำสม", ageGroup: "U16", number: 3 },
  { id: "c", nickname: "นัท", fullName: "นันทพัทธ์ ออมสิน", ageGroup: "U13", number: null },
  { id: "d", nickname: "Alex", fullName: "Alex Smith", ageGroup: "U13", number: 1 }
];

test("ageGroupsOf: only groups present, youngest first", () => {
  assert.deepEqual(ageGroupsOf(roster), ["U13", "U16"]);
  assert.deepEqual(ageGroupsOf([]), []);
});

test("filterAndSortPlayers: by age group, by name search, sorted by number (no number last) or by name", () => {
  assert.deepEqual(filterAndSortPlayers(roster, { ageGroup: "U16" }).map((p) => p.id), ["b", "a"]);
  assert.deepEqual(filterAndSortPlayers(roster, {}).map((p) => p.id), ["d", "b", "a", "c"]);
  assert.deepEqual(filterAndSortPlayers(roster, { query: "  smith " }).map((p) => p.id), ["d"]);
  assert.deepEqual(filterAndSortPlayers(roster, { query: "เจ" }).map((p) => p.id).sort(), ["a", "b"]);
  assert.deepEqual(filterAndSortPlayers(roster, { sort: "name", ageGroup: "U13" }).map((p) => p.id), ["c", "d"]);
  assert.deepEqual(filterAndSortPlayers(roster, { ageGroup: "all", query: "zzz" }), []);
});

test("playerDisplayName prefers the nickname", () => {
  assert.equal(playerDisplayName({ nickname: "เจเจ", fullName: "x" }), "เจเจ");
  assert.equal(playerDisplayName({ fullName: "x" }), "x");
  assert.equal(playerDisplayName({}), "-");
});

test("Match Data menu: landing page plus two sub-menus; the history sub-menu also covers the report view; the old match screen maps here", () => {
  const menu = menuItem("match-data");
  assert.equal(menu.screen, "match-data");
  assert.deepEqual(menu.children.map((c) => c.label), ["Match Recording Form", "ประวัติการแข่งขัน"]);
  const [form, history] = menu.children;
  assert.equal(childMatchesScreen(form, "match-form"), true);
  assert.equal(childMatchesScreen(form, "match-history"), false);
  assert.equal(childMatchesScreen(history, "match-history"), true);
  assert.equal(childMatchesScreen(history, "match-sheet"), true);
  assert.equal(menuKeyForScreen("match"), "match-data");
  assert.equal(menuKeyForScreen("match-sheet"), "match-data");
});

// match-data-ui.js อ่าน element ผ่าน el("id") — เช็คว่ามีครบใน attendance.html (ตัวเช็ค getElementById ในเทสต์อื่นมองไม่เห็นรูปแบบนี้)
test("every id match-data-ui.js reads through el(...) exists in attendance.html", () => {
  const html = fs.readFileSync(new URL("../attendance.html", import.meta.url), "utf8");
  const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const src = fs.readFileSync(new URL("../js/match-data-ui.js", import.meta.url), "utf8");
  const used = [...new Set([...src.matchAll(/\bel\("([^"]+)"\)/g)].map((m) => m[1]))];
  assert.ok(used.length >= 15, "found the ids");
  assert.deepEqual(used.filter((id) => !declared.has(id)), []);
});