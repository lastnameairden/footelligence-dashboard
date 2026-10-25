// รูปนักกีฬา/โค้ช: ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// เก็บรูปต้นฉบับไว้เหมือนเดิม และเก็บ "รูปย่อ" คู่กันเพื่อใช้แสดงในการ์ด/รายการ (ไฟล์เล็กกว่ามาก) — ดู photo-upload.js
import { safeHttpUrl } from "./ui-utils.js";

export const THUMB_MAX = 320; // ด้านยาวสุดของรูปย่อ (พิกเซล) — การ์ดในแกลเลอรีแสดงไม่เกินราว 160px จึงคมพอบนจอความละเอียดสูง
export const THUMB_QUALITY = 0.8;

// ขนาดรูปย่อ: ย่อลงให้ด้านยาวสุดไม่เกิน max ไม่ขยายรูปที่เล็กอยู่แล้ว
export function thumbSize(width, height, max = THUMB_MAX) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// path ของรูปย่อ: โฟลเดอร์เดียวกับรูปต้นฉบับ ชื่อ thumb_<ชื่อเดิมไม่มีนามสกุล>.jpg (ไม่ต้องแก้กฎ Storage เพราะอยู่ใต้ path เดิม)
export function thumbPathFor(path) {
  const i = path.lastIndexOf("/");
  const name = path.slice(i + 1).replace(/\.[^.]+$/, "");
  return `${path.slice(0, i + 1)}thumb_${name}.jpg`;
}

// src สำหรับการ์ด/รายการ: รูปย่อถ้ามี ไม่มีใช้รูปเต็ม (รูปที่อัปโหลดก่อนมีระบบรูปย่อ) — ไม่ใช่ https = ว่าง
export function photoSrc(entity) {
  return safeHttpUrl(entity?.photoThumbUrl) || safeHttpUrl(entity?.photoUrl);
}

// path ใน Storage ที่ต้องลบพร้อมกันเมื่อลบ/เปลี่ยนรูป (ต้นฉบับ + รูปย่อ)
export const photoPathsOf = (entity) => [entity?.photoPath, entity?.photoThumbPath].filter((p) => typeof p === "string" && p);
