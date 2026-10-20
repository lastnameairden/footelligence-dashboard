// ประกาศจากผู้ดูแลระบบถึงทีมหลังบ้าน (collection staffAnnouncements) — ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้
// แอดมินเขียน (หน้า "ประกาศถึงทีมหลังบ้าน") ทีมหลังบ้านอ่านที่ Home ของหน้าทีม — "ยังไม่อ่าน" เทียบกับเวลาที่เปิด Home ครั้งล่าสุดของเบราว์เซอร์นี้
import { escapeHtml } from "./ui-utils.js";

export const ANNOUNCEMENT_TITLE_MAX = 80;
export const ANNOUNCEMENT_MESSAGE_MAX = 1000;

// ตรวจข้อความจากฟอร์มแอดมิน → { value: { title, message }, error: null } หรือ { value: null, error }
export function validateAnnouncement({ title, message } = {}) {
  const t = String(title ?? "").trim();
  const m = String(message ?? "").trim();
  if (!t) return { value: null, error: "กรอกหัวข้อประกาศ" };
  if (t.length > ANNOUNCEMENT_TITLE_MAX) return { value: null, error: `หัวข้อยาวเกิน ${ANNOUNCEMENT_TITLE_MAX} ตัวอักษร (ตอนนี้ ${t.length})` };
  if (!m) return { value: null, error: "กรอกรายละเอียดประกาศ" };
  if (m.length > ANNOUNCEMENT_MESSAGE_MAX) return { value: null, error: `รายละเอียดยาวเกิน ${ANNOUNCEMENT_MESSAGE_MAX} ตัวอักษร (ตอนนี้ ${m.length})` };
  return { value: { title: t, message: m }, error: null };
}

// เวลาสร้างเป็นมิลลิวินาที (Timestamp ของ Firestore / { seconds } / ตัวเลข) — ไม่มี = 0
export function announcementTime(a) {
  const c = a?.createdAt;
  if (!c) return 0;
  if (typeof c.toMillis === "function") return c.toMillis();
  if (typeof c.seconds === "number") return c.seconds * 1000;
  return typeof c === "number" ? c : 0;
}

export function sortAnnouncements(list) {
  return [...(list || [])].sort((a, b) => announcementTime(b) - announcementTime(a));
}

export function unreadAnnouncements(list, seenMs) {
  return (list || []).filter((a) => announcementTime(a) > (seenMs || 0));
}

const dateLabel = (ms) => (ms ? new Date(ms).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }) : "");

// การ์ดประกาศหนึ่งรายการ (ข้อความ escape แล้ว ขึ้นบรรทัดใหม่ตามที่พิมพ์)
export function announcementCardHtml(a, { unread = false } = {}) {
  const badge = unread ? ' <span class="badge badge-warning">ใหม่</span>' : "";
  const by = a.createdBy ? ` · ${escapeHtml(a.createdBy)}` : "";
  return `<div class="card card-pad space-y-1" data-announcement="${escapeHtml(a.id ?? "")}">
    <p class="font-semibold text-slate-900">${escapeHtml(a.title)}${badge}</p>
    <p class="text-sm text-slate-700" style="white-space:pre-line">${escapeHtml(a.message)}</p>
    <p class="text-xs text-slate-400">${escapeHtml(dateLabel(announcementTime(a)))}${by}</p>
  </div>`;
}
