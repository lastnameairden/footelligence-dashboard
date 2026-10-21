// ข้อมูลส่วนตัวของโค้ช (รูป ชื่อจริง เบอร์โทร ใบประกาศผู้ฝึกสอน) และการ์ดโค้ชในหน้า Coach Data (ตรรกะล้วนๆ + HTML เป็นสตริง)
// เก็บในเอกสาร coaches/{uid} เดียวกับบัญชี: fullName, phone, certificates[], photoUrl, photoPath — โค้ชกรอกเองที่ Profile
// ส่วนแอดมิน/ทีมหลังบ้านที่มีสิทธิ์ coaches แก้ให้ได้ที่หน้าแก้ไขโค้ช (ดู firestore.rules: coaches update)
import { coachPositionLabel, escapeHtml, safeHttpUrl, teamLogoFallbackHtml } from "./ui-utils.js";
import { formatPhone, normalizePhone } from "./player-profile-fields.js";

export const COACH_CERTIFICATES = ["G - License", "C - License", "B - License", "A - License", "Pro - License"];
export const COACH_FULLNAME_MAX = 80;
export const COACH_OTHER_CERT_MAX = 40;

// ฟอร์มส่วนตัว → { value, error } — ค่าว่างเป็น null/[] เพื่อให้ updateDoc ล้างค่าเดิมที่ลบออกได้
// certificates = ใบที่ติ๊กจากรายการ (เรียงตามรายการ) + "อื่น ๆ" ที่พิมพ์เอง (ถ้ามี) ต่อท้าย
export function parseCoachPersonal({ fullName = "", phone = "", certificates = [], other = "" } = {}) {
  const name = String(fullName ?? "").trim();
  if (name.length > COACH_FULLNAME_MAX) return { value: null, error: `ชื่อจริงยาวเกิน ${COACH_FULLNAME_MAX} ตัวอักษร (ตอนนี้ ${name.length})` };
  if (/[<>]/.test(name)) return { value: null, error: "ชื่อจริงห้ามมีเครื่องหมาย < หรือ >" };
  const rawPhone = String(phone ?? "").trim();
  const digits = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !digits) return { value: null, error: "เบอร์โทรไม่ถูกต้อง (กรอกตัวเลข 9–10 หลัก เช่น 0812345678)" };
  const otherText = String(other ?? "").trim();
  if (otherText.length > COACH_OTHER_CERT_MAX) return { value: null, error: `ใบประกาศอื่น ๆ ยาวเกิน ${COACH_OTHER_CERT_MAX} ตัวอักษร` };
  if (/[<>]/.test(otherText)) return { value: null, error: "ใบประกาศอื่น ๆ ห้ามมีเครื่องหมาย < หรือ >" };
  const picked = COACH_CERTIFICATES.filter((c) => (certificates || []).includes(c));
  return { value: { fullName: name || null, phone: digits, certificates: otherText ? [...picked, otherText] : picked }, error: null };
}

// แยกใบประกาศที่เก็บไว้กลับเป็น { picked: ใบในรายการ, other: ข้อความอื่น ๆ } สำหรับเติมฟอร์ม
export function splitCertificates(list) {
  const items = Array.isArray(list) ? list : [];
  return { picked: items.filter((c) => COACH_CERTIFICATES.includes(c)), other: items.filter((c) => !COACH_CERTIFICATES.includes(c)).join(", ") };
}

// รูปวงกลมเล็กหน้าชื่อโค้ชในตารางรายชื่อโค้ชของแอดมิน — ไม่มีรูปใช้ตัวอักษรแรกของชื่อ
export function coachMiniAvatarHtml(coach) {
  const src = safeHttpUrl(coach.photoUrl);
  const initial = escapeHtml(Array.from(String(coach.name ?? "").trim())[0] ?? "?");
  return `<span class="coach-mini-avatar" aria-hidden="true">${src ? `<img src="${src}" alt="" loading="lazy" />` : teamLogoFallbackHtml(coach.team) || initial}</span>`;
}

const FIELD = (label, body) => `<div><p class="coach-card-label">${escapeHtml(label)}</p>${body}</div>`;
const EMPTY = '<p class="coach-card-empty">ยังไม่กรอก</p>';
const tags = (items, cls) => `<div class="coach-card-tags">${items.map((t) => `<span class="${cls}">${escapeHtml(t)}</span>`).join("")}</div>`;

// การ์ดโค้ชหนึ่งคน (กดเปิดรายละเอียดผลงานเดือนนี้ผ่าน data-coach-card) — showPhone = false ซ่อนแถวเบอร์โทร (เฉพาะทีมหลังบ้าน/แอดมินเห็น)
export function coachCardHtml(coach, { showPhone = true } = {}) {
  const photo = safeHttpUrl(coach.photoUrl);
  const photoBox = photo ? `<img src="${photo}" alt="" loading="lazy" />` : teamLogoFallbackHtml(coach.team) || '<span class="coach-card-photo-empty" aria-hidden="true"></span>';
  const ages = Array.isArray(coach.ageGroups) ? coach.ageGroups : [];
  const certs = Array.isArray(coach.certificates) ? coach.certificates : [];
  const phone = coach.phone ? `<p class="coach-card-value">${escapeHtml(formatPhone(coach.phone))}</p>` : EMPTY;
  return `<button type="button" class="coach-card" data-coach-card="${escapeHtml(coach.id ?? "")}">
    <span class="coach-card-photo">${photoBox}</span>
    <span class="coach-card-body">
      <span class="coach-card-name">${escapeHtml(coach.name ?? "-")}</span>
      ${FIELD("ชื่อจริง", coach.fullName ? `<p class="coach-card-value">${escapeHtml(coach.fullName)}</p>` : EMPTY)}
      ${FIELD("ตำแหน่ง", tags([coachPositionLabel(coach.coachPosition)], "coach-tag coach-tag-position"))}
      ${FIELD("รุ่นอายุที่รับผิดชอบ", ages.length ? tags(ages, "coach-tag coach-tag-age") : EMPTY)}
      ${showPhone ? FIELD("เบอร์โทรศัพท์", phone) : ""}
      ${FIELD("ใบประกาศผู้ฝึกสอน", certs.length ? tags(certs, "coach-tag coach-tag-cert") : EMPTY)}
      ${FIELD("อีเมล", coach.email ? `<p class="coach-card-value">${escapeHtml(coach.email)}</p>` : EMPTY)}
    </span>
  </button>`;
}
