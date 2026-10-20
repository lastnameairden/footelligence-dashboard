import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactExtraRows,
  formatPhone,
  healthAlertHtml,
  normalizePhone,
  parsePlayerExtras,
  positionExtraRows
} from "../js/player-profile-fields.js";

test("normalizePhone: digits only, +66 becomes 0, 9-10 digits starting with 0", () => {
  assert.equal(normalizePhone("081-234-5678"), "0812345678");
  assert.equal(normalizePhone(" +66 81 234 5678 "), "0812345678");
  assert.equal(normalizePhone("02-123-4567"), "021234567");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone("1812345678"), null);
  assert.equal(formatPhone("0812345678"), "081-234-5678");
  assert.equal(formatPhone("021234567"), "02-123-4567");
});

test("parsePlayerExtras: everything optional, blank clears to null/[] so updateDoc can remove old values", () => {
  assert.deepEqual(parsePlayerExtras({}), {
    value: { foot: null, secondaryPositions: [], healthNote: null, guardian: null, backupContact: null },
    error: null
  });
});

test("parsePlayerExtras: foot, secondary positions (deduped, valid, never the main position), health note", () => {
  const { value } = parsePlayerExtras({ position: "RB", foot: "ขวา", secondaryPositions: ["CB", "RB", "CB", "XX", "RWB"], health: "  หอบหืด · แพ้ยาเพนิซิลลิน " });
  assert.equal(value.foot, "ขวา");
  assert.deepEqual(value.secondaryPositions, ["CB", "RWB"]);
  assert.equal(value.healthNote, "หอบหืด · แพ้ยาเพนิซิลลิน");
  assert.equal(parsePlayerExtras({ foot: "เท้าซ้ายมือ" }).value.foot, null);
  assert.match(parsePlayerExtras({ health: "ก".repeat(301) }).error, /ยาวเกิน 300/);
  assert.equal(parsePlayerExtras({ health: "ก".repeat(300) }).error, null);
});

test("parsePlayerExtras: a contact needs both name and phone, phone is normalized, relation optional", () => {
  const ok = parsePlayerExtras({ guardian: { name: " สมหญิง ", relation: "แม่", phone: "081-234-5678" }, backup: { name: "สมชาย", phone: "0891112222" } });
  assert.deepEqual(ok.value.guardian, { name: "สมหญิง", phone: "0812345678", relation: "แม่" });
  assert.deepEqual(ok.value.backupContact, { name: "สมชาย", phone: "0891112222" });
  assert.equal(parsePlayerExtras({ guardian: { name: "สมหญิง", relation: "ป้า", phone: "0812345678" } }).value.guardian.relation, null);
  assert.match(parsePlayerExtras({ guardian: { name: "สมหญิง", phone: "" } }).error, /ผู้ปกครองหลัก.*เบอร์โทร/);
  assert.match(parsePlayerExtras({ guardian: { name: "", phone: "0812345678" } }).error, /ผู้ปกครองหลัก.*ชื่อ/);
  assert.match(parsePlayerExtras({ backup: { name: "สมชาย", phone: "123" } }).error, /ผู้ติดต่อสำรอง.*ไม่ถูกต้อง/);
});

test("health alert: shown only when a note exists, escaped", () => {
  assert.equal(healthAlertHtml({}), "");
  assert.equal(healthAlertHtml({ healthNote: "   " }), "");
  const html = healthAlertHtml({ healthNote: "แพ้ <b>ยา</b>" });
  assert.match(html, /class="health-alert"/);
  assert.match(html, /แพ้ &lt;b&gt;ยา&lt;\/b&gt;/);
});

test("detail rows: dashes when empty, tel links and relation when present", () => {
  assert.deepEqual(positionExtraRows({}), [["ตำแหน่งรอง", "-"], ["เท้าถนัด", "-"]]);
  assert.deepEqual(positionExtraRows({ secondaryPositions: ["CB", "RWB"], foot: "ซ้าย" }), [["ตำแหน่งรอง", "CB, RWB"], ["เท้าถนัด", "ซ้าย"]]);
  assert.deepEqual(contactExtraRows({}), [["ผู้ปกครองหลัก", "-"], ["ผู้ติดต่อสำรอง", "-"]]);
  const rows = contactExtraRows({ guardian: { name: "สมหญิง", relation: "แม่", phone: "0812345678" }, backupContact: { name: "สมชาย", phone: "0891112222" } });
  assert.match(rows[0][1], /สมหญิง \(แม่\)<br><a href="tel:0812345678"[^>]*>081-234-5678<\/a>/);
  assert.match(rows[1][1], /สมชาย<br><a href="tel:0891112222"/);
});
