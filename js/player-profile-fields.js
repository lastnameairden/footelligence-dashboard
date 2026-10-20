// ข้อมูลเพิ่มเติมของนักกีฬา: เท้าถนัด · ตำแหน่งรอง · โรคประจำตัว/แพ้ · ผู้ปกครองและผู้ติดต่อสำรอง
// ไฟล์นี้เป็นตรรกะล้วน (ตรวจค่าจากฟอร์ม + สร้าง HTML ของการ์ด) — ผูก DOM/Firestore อยู่ใน attendance.js
// ข้อมูลกลุ่มนี้ไม่แสดงในสมุดพกและเอกสารพิมพ์ (เห็นเฉพาะหน้า Player Data ของผู้ที่อ่านข้อมูลนักกีฬาได้)
import { escapeHtml } from "./ui-utils.js";

export const PLAYER_POSITIONS = ["GK", "CB", "RB", "LB", "RWB", "LWB", "SW", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "SS", "CF", "ST"];
export const PLAYER_FEET = ["ขวา", "ซ้าย", "ได้ทั้งสองข้าง"];
export const GUARDIAN_RELATIONS = ["พ่อ", "แม่", "ผู้ปกครองอื่น"];
export const HEALTH_NOTE_MAX = 300;

// เบอร์ไทย: เก็บเป็นตัวเลขล้วนขึ้นต้นด้วย 0 (รับ +66 / เว้นวรรค / ขีด) — ไม่ผ่านคืน null
export function normalizePhone(raw) {
  const text = String(raw ?? "").replace(/[\s\-().]/g, "").replace(/^\+66/, "0");
  return /^0\d{8,9}$/.test(text) ? text : null;
}

export function formatPhone(digits) {
  const d = String(digits ?? "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return d;
}

function parseContact(label, { name, phone, relation }, withRelation) {
  const n = String(name ?? "").trim();
  const p = String(phone ?? "").trim();
  if (!n && !p) return { value: null, error: null };
  if (!n) return { value: null, error: `${label}: กรอกชื่อด้วย (มีเบอร์โทรแล้ว)` };
  if (!p) return { value: null, error: `${label}: กรอกเบอร์โทรด้วย (เบอร์โทรใช้ติดต่อฉุกเฉิน)` };
  const digits = normalizePhone(p);
  if (!digits) return { value: null, error: `${label}: เบอร์โทรไม่ถูกต้อง (กรอกตัวเลข 9–10 หลัก เช่น 0812345678)` };
  const value = { name: n, phone: digits };
  if (withRelation) value.relation = GUARDIAN_RELATIONS.includes(relation) ? relation : null;
  return { value, error: null };
}

// คืน { value, error } — value มีครบทุกฟิลด์ (ค่าว่างเป็น null / []) เพื่อให้ updateDoc ล้างค่าเดิมที่โค้ชลบออกได้
export function parsePlayerExtras({ position = "", foot = "", secondaryPositions = [], health = "", guardian = {}, backup = {} } = {}) {
  const secondary = [...new Set(secondaryPositions)].filter((p) => PLAYER_POSITIONS.includes(p) && p !== position);
  const note = String(health ?? "").trim();
  if (note.length > HEALTH_NOTE_MAX) return { value: null, error: `โรคประจำตัว/แพ้: ยาวเกิน ${HEALTH_NOTE_MAX} ตัวอักษร (ตอนนี้ ${note.length})` };
  const main = parseContact("ผู้ปกครองหลัก", guardian, true);
  if (main.error) return { value: null, error: main.error };
  const second = parseContact("ผู้ติดต่อสำรอง", backup, false);
  if (second.error) return { value: null, error: second.error };
  return {
    value: {
      foot: PLAYER_FEET.includes(foot) ? foot : null,
      secondaryPositions: secondary,
      healthNote: note || null,
      guardian: main.value,
      backupContact: second.value
    },
    error: null
  };
}

const telLink = (phone) => `<a href="tel:${escapeHtml(phone)}" class="player-phone">${escapeHtml(formatPhone(phone))}</a>`;

function contactHtml(contact, relationText) {
  if (!contact) return "-";
  const who = `${escapeHtml(contact.name)}${relationText ? ` (${escapeHtml(relationText)})` : ""}`;
  return `${who}<br>${telLink(contact.phone)}`;
}

// แถบเตือนสีแดงใต้ชื่อ — ไม่มีข้อมูล = ไม่แสดงอะไร
export function healthAlertHtml(player) {
  const note = String(player?.healthNote ?? "").trim();
  if (!note) return "";
  return `<div class="health-alert" role="note"><strong>ข้อควรระวังด้านสุขภาพ</strong><span>${escapeHtml(note)}</span></div>`;
}

// แถวเพิ่มของการ์ดข้อมูล: [ป้าย, HTML ที่ escape แล้ว] — ตำแหน่งรอง/เท้าถนัดวางต่อจาก "ตำแหน่ง", ผู้ปกครองต่อท้ายสุด
export function positionExtraRows(player) {
  const secondary = Array.isArray(player?.secondaryPositions) ? player.secondaryPositions : [];
  return [
    ["ตำแหน่งรอง", secondary.length ? escapeHtml(secondary.join(", ")) : "-"],
    ["เท้าถนัด", player?.foot ? escapeHtml(player.foot) : "-"]
  ];
}

export function contactExtraRows(player) {
  return [
    ["ผู้ปกครองหลัก", contactHtml(player?.guardian, player?.guardian?.relation)],
    ["ผู้ติดต่อสำรอง", contactHtml(player?.backupContact, null)]
  ];
}
