// ตรรกะล้วนของการลงทะเบียน/ส่งคำขอเข้าใช้งาน (ไม่แตะ DOM/Firestore) — ใช้ร่วมกันระหว่างฟอร์มลงทะเบียนกับฟอร์ม "ส่งคำขออีกครั้ง"
// ที่ขึ้นเมื่อบัญชีล็อกอินยังอยู่แต่โปรไฟล์ coaches/{uid} ถูกผู้ดูแลระบบลบไปแล้ว
// รูปแบบเอกสารต้องตรงกับกฎ allow create ของ coaches ใน firestore.rules ทุกประการ

import { coachPositionAllowsMultipleAgeGroups, coachPositionLabel } from "./ui-utils.js";

// Firebase Auth ใส่อีเมลใน request.auth.token.email เป็นตัวพิมพ์เล็กเสมอ — ค่าที่บันทึกต้องเป็นตัวพิมพ์เล็กเป๊ะ ไม่งั้นกฎปฏิเสธ
export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// ข้อความ error ภาษาไทยถ้าข้อมูลไม่ผ่าน (null = ผ่าน) — โค้ชต้องมีรุ่นอายุอย่างน้อย 1 รุ่น, Head/Assistant ได้รุ่นเดียว
export function registrationProblem({ role, coachPosition, ageGroups }) {
  if (role !== "coach") return null;
  if (!ageGroups || ageGroups.length === 0) return "กรุณาเลือกรุ่นอายุที่รับผิดชอบอย่างน้อย 1 รุ่น";
  if (!coachPositionAllowsMultipleAgeGroups(coachPosition) && ageGroups.length > 1) {
    return `${coachPositionLabel(coachPosition)} เลือกได้เพียงรุ่นอายุเดียว (ถ้าต้องดูแลมากกว่า 1 รุ่น ต้องให้ผู้ดูแลระบบเป็นผู้เพิ่มให้)`;
  }
  return null;
}

// เอกสารคำขอ (status pending เสมอ) — ผู้บริหาร/ทีมหลังบ้านไม่ต้องมี ageGroups/coachPosition
export function buildPendingProfile({ name, email, role, coachPosition, ageGroups }, createdAt) {
  const payload = { name: String(name || "").trim(), email: normalizeEmail(email), role, status: "pending", createdAt };
  if (role === "coach") {
    payload.ageGroups = [...ageGroups];
    payload.coachPosition = coachPosition;
  }
  return payload;
}

// อีเมลนี้มีบัญชีล็อกอินอยู่แล้ว (เช่น โค้ชที่ถูกลบโปรไฟล์แล้วสมัครซ้ำ — บัญชี Auth ไม่ถูกลบไปด้วย)
export const isEmailInUse = (err) => err?.code === "auth/email-already-in-use";

// รหัสผ่านไม่ตรงกับบัญชีเดิม (Firebase รุ่นใหม่ตอบ invalid-credential แทน wrong-password)
export const isWrongCredential = (err) =>
  ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(err?.code);

export const WRONG_PASSWORD_FOR_EXISTING_EMAIL =
  "อีเมลนี้เคยลงทะเบียนไว้แล้ว แต่รหัสผ่านไม่ตรงกับเดิม — กลับไปแท็บ \"เข้าสู่ระบบ\" แล้วกด \"ลืมรหัสผ่าน\" เพื่อตั้งรหัสผ่านใหม่ จากนั้นเข้าสู่ระบบเพื่อส่งคำขออีกครั้ง";
