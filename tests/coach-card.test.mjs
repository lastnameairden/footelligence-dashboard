import { test } from "node:test";
import assert from "node:assert/strict";
import { coachDetailHtml } from "../js/coach-profile.js";
import { COACH_CERTIFICATES, COACH_FULLNAME_MAX, coachCardHtml, coachMiniAvatarHtml, parseCoachPersonal, splitCertificates } from "../js/coach-card.js";

test("parseCoachPersonal: all optional; blank clears to null/[]", () => {
  assert.deepEqual(parseCoachPersonal({}), { value: { fullName: null, phone: null, certificates: [] }, error: null });
});

test("parseCoachPersonal: trims name, normalizes phone, keeps list order and appends the free-text certificate", () => {
  const { value, error } = parseCoachPersonal({ fullName: "  ปิยะ สมศรี ", phone: "082-884-6090", certificates: ["C - License", "G - License", "bogus"], other: " AFC Futsal " });
  assert.equal(error, null);
  assert.deepEqual(value, { fullName: "ปิยะ สมศรี", phone: "0828846090", certificates: ["G - License", "C - License", "AFC Futsal"] });
});

test("parseCoachPersonal: rejects bad phone, long or angle-bracket text", () => {
  assert.match(parseCoachPersonal({ phone: "123" }).error, /เบอร์โทรไม่ถูกต้อง/);
  assert.match(parseCoachPersonal({ fullName: "ก".repeat(COACH_FULLNAME_MAX + 1) }).error, /ชื่อจริงยาวเกิน/);
  assert.match(parseCoachPersonal({ fullName: "<b>x</b>" }).error, /ห้ามมี/);
  assert.match(parseCoachPersonal({ other: "ข".repeat(41) }).error, /ยาวเกิน/);
  assert.match(parseCoachPersonal({ other: "a<b" }).error, /ห้ามมี/);
});

test("splitCertificates: listed ones vs anything else", () => {
  assert.deepEqual(splitCertificates(["G - License", "AFC Futsal", "x"]), { picked: ["G - License"], other: "AFC Futsal, x" });
  assert.deepEqual(splitCertificates(undefined), { picked: [], other: "" });
  assert.equal(COACH_CERTIFICATES.length, 5);
});

test("coachCardHtml: photo, escaped text, empty-field placeholders, phone only when allowed", () => {
  const full = coachCardHtml({ id: "c1", name: "โค้ช<ปิ>", fullName: "ปิยะ", coachPosition: "head_coach", ageGroups: ["U13"], phone: "0828846090", certificates: ["G - License"], email: "pi@example.com", photoUrl: "https://example.com/a.jpg" });
  assert.match(full, /data-coach-card="c1"/);
  assert.match(full, /<img src="https:\/\/example\.com\/a\.jpg"/);
  assert.match(full, /โค้ช&lt;ปิ&gt;/);
  assert.match(full, /082-884-6090/);
  assert.match(full, /coach-tag-age">U13/);
  assert.match(full, /G - License/);
  assert.match(full, /Head Coach/);
  assert.doesNotMatch(coachCardHtml({ id: "c1", name: "x", phone: "0828846090" }, { showPhone: false }), /082-884|เบอร์โทรศัพท์/);
  const empty = coachCardHtml({ id: "c2", name: "โค้ชซัน", coachPosition: "gk_coach", ageGroups: [] });
  assert.match(empty, /coach-card-photo-empty/);
  assert.equal((empty.match(/ยังไม่กรอก/g) || []).length, 5, "full name, age groups, phone, certificates and email show the placeholder");
  assert.match(coachCardHtml({ id: "c3", name: "x", photoUrl: "javascript:alert(1)" }), /coach-card-photo-empty/);
});

test("coachDetailHtml: head, contact, certificates, age groups with player counts; placeholders when empty", () => {
  const html = coachDetailHtml({
    coach: { id: "c1", name: "โค้ชปิ", fullName: "ปิยะ <สมศรี>", status: "approved", coachPosition: "head_coach", phone: "0828846090", email: "pi@example.com", certificates: ["G - License", "AFC Futsal"], createdAt: { toDate: () => new Date("2026-05-01T05:00:00Z") } },
    team: "THAWEE SC",
    ageRows: [{ ageGroup: "U13", count: 12 }, { ageGroup: "U14", count: 8 }]
  });
  assert.match(html, /ปิยะ &lt;สมศรี&gt;/);
  assert.match(html, /href="tel:0828846090"[^>]*>082-884-6090/);
  assert.match(html, /pi@example\.com/);
  assert.match(html, /coach-tag-cert">G - License/);
  assert.match(html, /AFC Futsal/);
  assert.match(html, /U13 · 12 คน<br>U14 · 8 คน/);
  assert.match(html, /นักกีฬาที่ดูแลรวม[\s\S]*20 คน/);
  assert.match(html, /อนุมัติแล้ว/);
  const empty = coachDetailHtml({ coach: { id: "c2", name: "โค้ชซัน", status: "pending", coachPosition: "gk_coach" }, team: "THAWEE SC", ageRows: [] });
  assert.equal((empty.match(/ยังไม่กรอก/g) || []).length, 5, "head full name + detail full name, phone, email and certificates are empty");
  assert.match(empty, /ยังไม่กรอกชื่อจริง/);
  assert.match(empty, /รออนุมัติ/);
});
test("coachMiniAvatarHtml: https photo, else the first letter of the name (escaped)", () => {
  assert.match(coachMiniAvatarHtml({ name: "ปิ", photoUrl: "https://example.com/a.jpg" }), /<img src="https:\/\/example\.com\/a\.jpg"/);
  assert.match(coachMiniAvatarHtml({ name: "ปิ" }), />ป<\/span>/);
  assert.match(coachMiniAvatarHtml({ name: "<b>", photoUrl: "http://insecure/a.jpg" }), />&lt;<\/span>/);
  assert.match(coachMiniAvatarHtml({}), />\?<\/span>/);
});