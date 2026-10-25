import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdminNotifications, teamSpaceLink } from "../js/admin-notifications.js";

const T = ["THAWEE SC", "KHAMPHEE FOOTBALL"];

test("teamSpaceLink opens the new team space of that team on the given screen", () => {
  assert.equal(teamSpaceLink("THAWEE SC", "plan-data"), "attendance.html#admin=team&team=THAWEE%20SC&as=admin&screen=plan-data");
});

test("injuries are split per team; severe ones are urgent and open that team's injury results", () => {
  const list = buildAdminNotifications({
    activeInjuries: [
      { team: T[0], severity: "รุนแรง", playerName: "เอ" },
      { team: T[0], severity: "ปานกลาง", playerName: "บี" },
      { team: T[1], severity: "รุนแรง", playerName: "ซี" }
    ]
  });
  const severe = list.filter((n) => n.key.startsWith("severe_injuries:"));
  assert.deepEqual(severe.map((n) => n.team).sort(), [T[1], T[0]].sort());
  assert.ok(severe.every((n) => n.level === "urgent" && n.screen === "injury-results"));
  const thawee = severe.find((n) => n.team === T[0]);
  assert.match(thawee.title, /^THAWEE SC: /);
  assert.equal(thawee.detail, "เอ", "another team's player is never listed under this team");
  assert.equal(thawee.link, teamSpaceLink(T[0], "injury-results"));
  assert.equal(list.filter((n) => n.key.startsWith("other_injuries:")).length, 1);
});

test("plan, late-coach and evaluation items are one per team and open the matching page of that team", () => {
  const list = buildAdminNotifications({
    missingPlanDaysByTeam: new Map([[T[1], 3]]),
    lateCoaches: [{ coachName: "โค้ชเอ", team: T[0], late: 4, total: 9 }, { coachName: "โค้ชบี", team: T[1], late: 5, total: 8 }],
    incompleteDaysByTeam: new Map([[T[0], 2]])
  });
  const byKey = Object.fromEntries(list.map((n) => [n.key, n]));
  assert.equal(byKey[`missing_plans_recent:${T[1]}`].screen, "plan-data");
  assert.equal(byKey[`missing_plans_recent:${T[1]}`].count, 3);
  assert.deepEqual([byKey[`late_coaches_month:${T[0]}`].detail, byKey[`late_coaches_month:${T[1]}`].detail], ["โค้ชเอ (สาย 4/9 ครั้ง)", "โค้ชบี (สาย 5/8 ครั้ง)"]);
  assert.equal(byKey[`incomplete_evaluations_recent:${T[0]}`].screen, "progress");
  assert.equal(new Set(list.map((n) => n.key)).size, list.length, "keys are unique so read-state is per team");
});

test("pending registrations have no team: one item that opens approvals in the fallback team", () => {
  const [n] = buildAdminNotifications({ pendingNames: ["ก", "ข"], fallbackTeam: T[0] });
  assert.equal(n.key, "pending_accounts");
  assert.equal(n.team, null);
  assert.equal(n.count, 2);
  assert.equal(n.link, teamSpaceLink(T[0], "approvals"));
  assert.deepEqual(buildAdminNotifications({}), []);
});

test("names from data are escaped in titles and details", () => {
  const [n] = buildAdminNotifications({ activeInjuries: [{ team: "T<b>", severity: "รุนแรง", playerName: "<img src=x onerror=1>" }] });
  assert.equal(n.detail.includes("<img"), false);
  assert.equal(n.title.includes("<b>"), false);
});