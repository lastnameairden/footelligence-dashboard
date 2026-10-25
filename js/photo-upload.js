// อัปโหลดรูปนักกีฬา/โค้ชขึ้น Storage: เก็บรูปต้นฉบับไว้ครบ + สร้างรูปย่อ (JPEG ด้านยาวสุด 320px) เก็บคู่กัน — ตรรกะล้วนๆ อยู่ที่ photo-src.js
// ตั้ง Cache-Control ยาว: path ของรูปไม่ซ้ำกันทุกครั้งที่อัปโหลด (มี timestamp) เบราว์เซอร์จึงจำรูปไว้ได้นานโดยไม่เสี่ยงเห็นรูปเก่า
import { getDownloadURL, ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { storage } from "./firebase-init.js";
import { THUMB_QUALITY, thumbPathFor, thumbSize } from "./photo-src.js";

export const PHOTO_CACHE_CONTROL = "public,max-age=31536000";

// ย่อรูปเป็น JPEG ด้วย canvas — ล้มเหลว (เบราว์เซอร์ไม่รองรับ/ไฟล์อ่านไม่ได้) = null แล้วใช้รูปเต็มแทน ไม่บล็อกการบันทึก
export async function makeThumbnail(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = thumbSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // ภาพโปร่งใส (PNG) ไม่ให้กลายเป็นพื้นดำตอนเป็น JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", THUMB_QUALITY));
  } catch (err) {
    console.warn("สร้างรูปย่อไม่สำเร็จ (ใช้รูปเต็มแทน):", err);
    return null;
  }
}

// คืน { url, path, thumbUrl, thumbPath } — thumbUrl/thumbPath เป็น null ถ้าสร้างหรืออัปโหลดรูปย่อไม่สำเร็จ
export async function uploadPhotoWithThumb(file, filePath) {
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file, { cacheControl: PHOTO_CACHE_CONTROL });
  const url = await getDownloadURL(fileRef);
  let thumbUrl = null;
  let thumbPath = null;
  const blob = await makeThumbnail(file);
  if (blob) {
    try {
      const path = thumbPathFor(filePath);
      const thumbRef = storageRef(storage, path);
      await uploadBytes(thumbRef, blob, { contentType: "image/jpeg", cacheControl: PHOTO_CACHE_CONTROL });
      thumbUrl = await getDownloadURL(thumbRef);
      thumbPath = path;
    } catch (err) {
      console.warn("อัปโหลดรูปย่อไม่สำเร็จ (ใช้รูปเต็มแทน):", err);
    }
  }
  return { url, path: filePath, thumbUrl, thumbPath };
}
