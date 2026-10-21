import { test } from "node:test";
import assert from "node:assert/strict";
import { STAFF_MENU, STAFF_UNFILTERED_SCREENS, staffMenuFor } from "../js/staff-menu.js";
import { COACH_MENU, menuItem, menuKeyForScreen } from "../js/coach-menu.js";
import { ageGroupsForFilter, matchesAgeFilter, validFilter } from "../js/age-filter.js";
import { COACH_SCREEN_KEYS } from "../js/screen-route.js";
import { ADMIN_TEAM_MENU } from "../js/admin-menu.js";

test("staff menu: the nine agreed items in order", () => {
  assert.deepEqual(STAFF_MENU.map((m) => m.label), ["Home", "Coach Data", "Player Data", "Attendance", "Training", "Match Data", "Evaluation", "Injury/Sick", "Meeting"]);
  assert.equal(new Set(STAFF_MENU.map((m) => m.key)).size, 9);
});

test("staff menu: view permission sees eight, Meeting needs the meetings permission", () => {
  const view = staffMenuFor(["view"]).map((m) => m.key);
  assert.equal(view.includes("meeting"), false);
  assert.equal(view.length, 8);
  assert.equal(staffMenuFor(["view", "meetings"]).length, 9);
  assert.deepEqual(staffMenuFor(["meetings"]).map((m) => m.key), ["meeting"]);
  assert.deepEqual(staffMenuFor([]), []);
  // manageTeams ให้ view ในตัว
  assert.equal(staffMenuFor(["manageTeams"]).length, 8);
});

test("staff menu: Evaluation is Athlete Results only (no landing, no Physical Test / Footelligence Test)", () => {
  const ev = STAFF_MENU.find((m) => m.key === "evaluation");
  assert.equal(ev.screen, "athlete-results");
  assert.equal(ev.children, undefined);
  for (const s of ["physical-test", "physical-instruction", "physical-form", "footelligence-test", "fitness"]) assert.equal(ev.screens.includes(s), false, s);
});

test("staff menu: only the agreed read-only parts of Training, Match Data and Injury/Sick", () => {
  const training = STAFF_MENU.find((m) => m.key === "training");
  assert.deepEqual(training.children.map((c) => c.screen), ["plan-data", "report-data"]);
  assert.equal(STAFF_MENU.find((m) => m.key === "match-data").screen, "match-history");
  assert.equal(STAFF_MENU.find((m) => m.key === "injury-sick").screen, "injury-results");
  const allScreens = STAFF_MENU.flatMap((m) => m.screens);
  for (const editing of ["plan", "report", "match-form", "injury", "fitness", "player-form", "checkin", "profile", "footelligence-test"]) {
    assert.equal(allScreens.includes(editing), false, `${editing} is a coach editing screen and must not be in the staff menu`);
  }
});

test("menuKeyForScreen / menuItem take an explicit menu and still default to the coach menu", () => {
  assert.equal(menuKeyForScreen("players"), "player-data");
  assert.equal(menuKeyForScreen("plan-data", STAFF_MENU), "training");
  assert.equal(menuKeyForScreen("plan-data"), "training-plan");
  assert.equal(menuKeyForScreen("staff-coaches", COACH_MENU), null);
  assert.equal(menuItem("meeting", STAFF_MENU).screen, "staff-meeting");
  assert.equal(menuItem("meeting").screen, "meeting-menu");
  assert.deepEqual(STAFF_UNFILTERED_SCREENS, ["staff-home"]);
});

test("age filter: '' means all groups, a group maps to the coach-side myAgeGroups shape", () => {
  assert.deepEqual(ageGroupsForFilter(""), []);
  assert.deepEqual(ageGroupsForFilter("U12"), ["U12"]);
  assert.equal(validFilter("U12", ["U10", "U12"]), "U12");
  assert.equal(validFilter("U14", ["U10", "U12"]), "");
  assert.equal(matchesAgeFilter(["U10", "U12"], ""), true);
  assert.equal(matchesAgeFilter(["U10", "U12"], "U12"), true);
  assert.equal(matchesAgeFilter(["U10"], "U12"), false);
  assert.equal(matchesAgeFilter(undefined, "U12"), false);
  assert.equal(matchesAgeFilter(undefined, ""), true);
});

test("every staff-* route key belongs to the staff menu, and every staff menu screen is a known route key", () => {
  const staffScreens = [...STAFF_MENU, ...ADMIN_TEAM_MENU].flatMap((m) => m.screens);
  for (const key of COACH_SCREEN_KEYS.filter((k) => k.startsWith("staff-"))) assert.ok(staffScreens.includes(key), key);
  for (const m of STAFF_MENU) {
    assert.ok(COACH_SCREEN_KEYS.includes(m.screen), `${m.key} → ${m.screen}`);
    assert.ok(m.screens.includes(m.screen));
    for (const c of m.children || []) for (const s of [c.screen, ...(c.children || []).map((g) => g.screen)]) assert.ok(m.screens.includes(s), `${m.key} child ${s}`);
  }
});
test("admin team menu: the nine items, full coach submenus, shared staff pages for Home / Coach Data / Meeting", () => {
  assert.deepEqual(ADMIN_TEAM_MENU.map((m) => m.label), ["Home", "Coach Data", "Player Data", "Attendance", "Training", "Match Data", "Evaluation", "Injury/Sick", "Meeting"]);
  assert.equal(new Set(ADMIN_TEAM_MENU.map((m) => m.key)).size, 9);
  assert.deepEqual(ADMIN_TEAM_MENU.find((m) => m.key === "home").screens, ["staff-home"]);
  assert.equal(ADMIN_TEAM_MENU.find((m) => m.key === "meeting").screen, "staff-meeting");
  const training = ADMIN_TEAM_MENU.find((m) => m.key === "training");
  assert.deepEqual(training.children.slice(0, 4).map((c) => c.screen), ["plan", "plan-data", "report", "report-data"]);
  assert.deepEqual(ADMIN_TEAM_MENU.find((m) => m.key === "match-data").children.map((c) => c.screen), ["match-form", "match-history"]);
  const evaluation = ADMIN_TEAM_MENU.find((m) => m.key === "evaluation");
  assert.deepEqual(evaluation.children.map((c) => c.screen), ["footelligence-test", "physical-test", "athlete-results"]);
  assert.deepEqual(ADMIN_TEAM_MENU.find((m) => m.key === "injury-sick").children.map((c) => c.screen), ["injury", "injury-results"]);
  assert.deepEqual(ADMIN_TEAM_MENU.find((m) => m.key === "attendance").children.map((c) => c.screen), ["attendance-grid", "checkin"]);
  for (const m of ADMIN_TEAM_MENU) {
    assert.ok(COACH_SCREEN_KEYS.includes(m.screen), `${m.key} → ${m.screen}`);
    assert.ok(m.screens.includes(m.screen));
    assert.equal(m.perm, undefined, "the admin menu is not permission-filtered");
  }
  // แต่ละหน้าจออยู่ภายใต้เมนูเดียวเท่านั้น
  const seen = new Map();
  for (const m of ADMIN_TEAM_MENU) for (const s of m.screens) assert.equal(seen.has(s), false, `${s} listed under ${seen.get(s)} and ${m.key}`), seen.set(s, m.key);
  assert.equal(menuKeyForScreen("report", ADMIN_TEAM_MENU), "training");
  assert.equal(menuKeyForScreen("checkin", ADMIN_TEAM_MENU), "attendance");
});