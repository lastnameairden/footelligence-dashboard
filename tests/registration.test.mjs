import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  registrationProblem,
  buildPendingProfile,
  isEmailInUse,
  isWrongCredential
} from "../js/registration.js";

test("normalizeEmail: trims and lowercases (the Firestore rule compares with the lowercase token email)", () => {
  assert.equal(normalizeEmail("  Coach@Example.COM "), "coach@example.com");
  assert.equal(normalizeEmail(undefined), "");
});

test("registrationProblem: only coaches need age groups; Head/Assistant take exactly one", () => {
  assert.equal(registrationProblem({ role: "executive", ageGroups: [] }), null);
  assert.equal(registrationProblem({ role: "staff", ageGroups: [] }), null);
  assert.match(registrationProblem({ role: "coach", coachPosition: "head_coach", ageGroups: [] }), /อย่างน้อย 1 รุ่น/);
  assert.match(registrationProblem({ role: "coach", coachPosition: "head_coach", ageGroups: ["U13", "U14"] }), /เพียงรุ่นอายุเดียว/);
  assert.match(registrationProblem({ role: "coach", coachPosition: "assistant_coach", ageGroups: ["U13", "U14"] }), /เพียงรุ่นอายุเดียว/);
  assert.equal(registrationProblem({ role: "coach", coachPosition: "head_coach", ageGroups: ["U13"] }), null);
  assert.equal(registrationProblem({ role: "coach", coachPosition: "gk_coach", ageGroups: ["U13", "U14", "U15"] }), null);
});

test("buildPendingProfile: matches the coaches create rule (pending, lowercase email, coach-only fields)", () => {
  const ts = { serverTimestamp: true };
  const coach = buildPendingProfile({ name: " โค้ชเอ ", email: "A@B.com", role: "coach", coachPosition: "head_coach", ageGroups: ["U15"] }, ts);
  assert.deepEqual(coach, { name: "โค้ชเอ", email: "a@b.com", role: "coach", status: "pending", createdAt: ts, ageGroups: ["U15"], coachPosition: "head_coach" });
  const exec = buildPendingProfile({ name: "ผู้บริหาร", email: "e@b.com", role: "executive", coachPosition: "head_coach", ageGroups: ["U15"] }, ts);
  assert.deepEqual(Object.keys(exec).sort(), ["createdAt", "email", "name", "role", "status"]);
});

test("buildPendingProfile: copies the age group list (caller mutations do not leak in)", () => {
  const groups = ["U13"];
  const p = buildPendingProfile({ name: "x", email: "x@y.com", role: "coach", coachPosition: "head_coach", ageGroups: groups }, null);
  groups.push("U14");
  assert.deepEqual(p.ageGroups, ["U13"]);
});

test("auth error classifiers", () => {
  assert.equal(isEmailInUse({ code: "auth/email-already-in-use" }), true);
  assert.equal(isEmailInUse({ code: "auth/weak-password" }), false);
  assert.equal(isEmailInUse(null), false);
  assert.equal(isWrongCredential({ code: "auth/invalid-credential" }), true);
  assert.equal(isWrongCredential({ code: "auth/wrong-password" }), true);
  assert.equal(isWrongCredential({ code: "auth/network-request-failed" }), false);
});
