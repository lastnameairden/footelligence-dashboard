import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRouteHash, parseRouteHash, isValidRouteDate, COACH_SCREEN_KEYS } from "../js/screen-route.js";

test("coach screen with a date round-trips through the hash", () => {
  const hash = buildRouteHash({ screen: "checkin", date: "2026-03-10" });
  assert.equal(hash, "screen=checkin&d=2026-03-10");
  assert.deepEqual(parseRouteHash("#" + hash), {
    admin: null, team: null, as: null, coach: null, ret: null, screen: "checkin", date: "2026-03-10"
  });
});

test("admin panel sections keep the existing #admin=<key> format", () => {
  assert.equal(buildRouteHash({ admin: "coaches" }), "admin=coaches");
  assert.equal(buildRouteHash({ admin: "report-card" }), "admin=report-card");
  assert.equal(parseRouteHash("#admin=masc-rounds").admin, "masc-rounds");
  // ลิงก์แจ้งเตือนเดิมที่แนบทีม (#admin=progress&team=...) ยังอ่านได้
  const linked = parseRouteHash("#admin=progress&team=THAWEE%20SC");
  assert.equal(linked.admin, "progress");
  assert.equal(linked.team, "THAWEE SC");
});

test("admin managing a team round-trips team, role, coach, return section, screen and date", () => {
  const route = {
    admin: "team", team: "KHAMPHEE FOOTBALL", as: "coach", coach: "abc123", ret: "coaches", screen: "plan", date: "2026-03-10"
  };
  const parsed = parseRouteHash(buildRouteHash(route));
  assert.deepEqual({ ...parsed, date: parsed.date }, {
    admin: "team", team: "KHAMPHEE FOOTBALL", as: "coach", coach: "abc123", ret: "coaches", screen: "plan", date: "2026-03-10"
  });
});

test("admin in executive view has no screen; optional fields are omitted", () => {
  const hash = buildRouteHash({ admin: "team", team: "THAWEE SC", as: "executive" });
  assert.equal(hash, "admin=team&team=THAWEE+SC&as=executive");
  const parsed = parseRouteHash(hash);
  assert.equal(parsed.screen, null);
  assert.equal(parsed.coach, null);
  assert.equal(parsed.team, "THAWEE SC");
});

test("team names with spaces and special characters survive encoding", () => {
  const parsed = parseRouteHash(buildRouteHash({ admin: "team", team: "A&B C=D", as: "coach" }));
  assert.equal(parsed.team, "A&B C=D");
});

test("invalid dates and roles are dropped instead of trusted", () => {
  assert.equal(buildRouteHash({ screen: "checkin", date: "10/03/2026" }), "screen=checkin");
  assert.equal(parseRouteHash("#screen=checkin&d=not-a-date").date, null);
  assert.equal(parseRouteHash("#admin=team&team=X&as=superuser").as, null);
  assert.equal(isValidRouteDate("2026-03-10"), true);
  assert.equal(isValidRouteDate("2026-3-1"), false);
  assert.equal(isValidRouteDate(undefined), false);
});

test("empty or missing hash gives an empty route and an empty hash string", () => {
  assert.equal(buildRouteHash(null), "");
  assert.equal(buildRouteHash({}), "");
  const p = parseRouteHash("");
  assert.deepEqual(Object.values(p), [null, null, null, null, null, null, null]);
  assert.deepEqual(parseRouteHash(undefined), p);
  assert.deepEqual(parseRouteHash("#"), p);
});

test("coach screen keys are the ones the app can reopen", () => {
  assert.deepEqual(COACH_SCREEN_KEYS, ["daily", "checkin", "report", "match", "injury", "plan", "players"]);
});
