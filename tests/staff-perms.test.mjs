import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_FEATURE_REQUIREMENTS,
  STAFF_PERMISSION_KEYS,
  canAccessAdminFeature,
  normalizePermissions,
  permissionsSummary,
  staffCan,
  staffLandingFeature
} from "../js/staff-perms.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");

test("normalizePermissions keeps known keys only, no duplicates, canonical order; manageTeams implies view", () => {
  assert.deepEqual(normalizePermissions(["coaches", "view"]), ["view", "coaches"]);
  assert.deepEqual(normalizePermissions(["manageTeams"]), ["view", "manageTeams"]);
  assert.deepEqual(normalizePermissions(["view", "view", "admin", "nope", 5]), ["view"]);
  assert.deepEqual(normalizePermissions(undefined), []);
  assert.deepEqual(normalizePermissions("view"), []);
});

test("staffCan: view is implied by manageTeams, nothing else is implied", () => {
  assert.equal(staffCan(["manageTeams"], "view"), true);
  assert.equal(staffCan(["view"], "manageTeams"), false);
  assert.equal(staffCan(["view"], "coaches"), false);
  assert.equal(staffCan([], "view"), false);
  assert.equal(staffCan(null, "view"), false);
});

test("canAccessAdminFeature: main admin (perms = null) can open everything; staff only what the permissions allow", () => {
  for (const feature of [...Object.keys(ADMIN_FEATURE_REQUIREMENTS), "anything-else"]) {
    assert.equal(canAccessAdminFeature(feature, null), true, feature);
  }
  const viewer = ["view"];
  assert.equal(canAccessAdminFeature("dashboard", viewer), true);
  assert.equal(canAccessAdminFeature("print", viewer), true);
  assert.equal(canAccessAdminFeature("report-card", viewer), true);
  assert.equal(canAccessAdminFeature("coaches", viewer), false);
  assert.equal(canAccessAdminFeature("manage-team", viewer), false);
  const hr = ["coaches"];
  assert.equal(canAccessAdminFeature("coaches", hr), true);
  assert.equal(canAccessAdminFeature("approvals", hr), true);
  assert.equal(canAccessAdminFeature("print", hr), false);
  const editor = ["manageTeams"];
  assert.equal(canAccessAdminFeature("manage-team", editor), true);
  assert.equal(canAccessAdminFeature("team", editor), true);
  assert.equal(canAccessAdminFeature("player-audit", editor), true);
  assert.equal(canAccessAdminFeature("print", editor), true, "manageTeams includes view");
  assert.equal(canAccessAdminFeature("coaches", editor), false);
});

test("admin-only tools are never reachable by staff, whatever permissions they hold", () => {
  const all = [...STAFF_PERMISSION_KEYS];
  for (const feature of ["masc-rounds", "fitness-rounds", "development", "unknown-feature"]) {
    assert.equal(canAccessAdminFeature(feature, all), false, feature);
  }
});

test("meetings permission opens only the meetings tool", () => {
  assert.equal(canAccessAdminFeature("meetings", ["meetings"]), true);
  assert.equal(canAccessAdminFeature("meetings", ["view", "coaches", "manageTeams"]), false);
  assert.equal(canAccessAdminFeature("dashboard", ["meetings"]), false);
  assert.equal(canAccessAdminFeature("coaches", ["meetings"]), false);
  assert.equal(staffLandingFeature(["meetings"]), "meetings");
});

test("staffLandingFeature: Dashboard if they can view, else the first tool they may open", () => {
  assert.equal(staffLandingFeature(["view"]), "dashboard");
  assert.equal(staffLandingFeature(["manageTeams"]), "dashboard");
  assert.equal(staffLandingFeature(["coaches"]), "coaches");
  assert.equal(staffLandingFeature(["meetings", "coaches"]), "coaches");
  assert.equal(staffLandingFeature([]), null);
});

test("permissionsSummary lists short labels", () => {
  assert.deepEqual(permissionsSummary(["manageTeams", "coaches"]), ["ดูและพิมพ์รายงาน", "อนุมัติ/จัดการโค้ช", "แก้ข้อมูลแทนโค้ช"]);
  assert.equal(permissionsSummary([]), "ยังไม่ได้รับสิทธิ์");
});

// ตารางสิทธิ์ฝั่งหน้าเว็บต้องตรงกับกฎ Firestore ที่บังคับจริง — เพิ่ม/เปลี่ยนรหัสสิทธิ์แล้วลืมแก้อีกฝั่งจะล้มที่นี่
test("every permission key is enforced by firestore.rules and rules grant staff only through hasPerm()", () => {
  for (const key of STAFF_PERMISSION_KEYS) {
    assert.ok(rules.includes(`hasPerm('${key}')`), `firestore.rules never checks hasPerm('${key}')`);
  }
  const used = [...rules.matchAll(/hasPerm\('(\w+)'\)/g)].map((m) => m[1]);
  for (const key of used) assert.ok(STAFF_PERMISSION_KEYS.includes(key), `rules use unknown permission ${key}`);
});

test("rules: staff can register as pending but registration never carries permissions; staff can never edit admin/staff accounts", () => {
  assert.match(rules, /request\.resource\.data\.role in \['coach', 'executive', 'staff'\]/);
  const create = rules.slice(rules.indexOf("match /coaches/{coachId}"), rules.indexOf("match /players/{id}"));
  assert.ok(create.includes("hasOnly(['name', 'email', 'role', 'status', 'createdAt', 'ageGroups', 'coachPosition'])"), "create keeps the fixed key list, so no permissions at registration");
  assert.match(create, /hasPerm\('coaches'\)[\s\S]*resource\.data\.role in \['coach', 'executive'\][\s\S]*request\.resource\.data\.role in \['coach', 'executive'\]/);
  assert.match(create, /hasAny\(\['permissions', 'email'\]\)/);
  // ทีมหลังบ้านไม่แตะรอบ/นัด/ข้อความของแอดมิน
  for (const name of ["mascRounds", "fitnessRounds", "adminNotificationReads"]) {
    const block = rules.slice(rules.indexOf(`match /${name}/`));
    const end = block.indexOf("\n    }");
    assert.ok(!/canManageAll|hasPerm/.test(block.slice(0, end)), `${name} must stay admin-only for writes`);
  }
  // นัดประชุม: สร้าง/ลบเฉพาะแอดมินหลัก ทีมสต๊าฟ (meetings) แก้ได้แค่ sections + updatedAt — ลิงก์ ผลเข้าประชุม และรายชื่อห้ามแตะ
  const meetings = rules.slice(rules.indexOf("match /coachMeetings/"), rules.indexOf("match /coachMeetingAcks/"));
  assert.match(meetings, /allow create, delete: if isAdmin\(\);/);
  assert.match(meetings, /hasPerm\('meetings'\)[\s\S]*affectedKeys\(\)\.hasOnly\(\['sections', 'updatedAt'\]\)/);
  // ความคิดเห็นหลังประชุมโค้ชอ่านไม่ได้เลย / งานหลังประชุมโค้ชเขียนได้เฉพาะของตัวเอง
  const comments = rules.slice(rules.indexOf("match /coachMeetingComments/"), rules.indexOf("match /trainingPlans/"));
  assert.match(comments, /allow read: if isAdmin\(\) \|\| hasPerm\('meetings'\);/);
  assert.ok(!/canManageTeam|canViewTeam|canViewAll/.test(comments), "coaches must not read comments");
  const recaps = rules.slice(rules.indexOf("match /coachMeetingRecaps/"), rules.indexOf("match /coachMeetingComments/"));
  assert.match(recaps, /request\.resource\.data\.coachId == request\.auth\.uid/);
  assert.match(recaps, /resource\.data\.coachId == request\.auth\.uid[\s\S]*hasOnly\(\['know', 'use', 'updatedAt'\]\)/);
  assert.match(recaps, /allow delete: if isAdmin\(\);/);
});
