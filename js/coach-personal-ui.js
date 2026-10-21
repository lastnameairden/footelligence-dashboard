// ฟอร์ม "ข้อมูลส่วนตัว" ในหน้า Profile ของโค้ช: รูป ชื่อจริง เบอร์โทร ใบประกาศผู้ฝึกสอน — ตรรกะอยู่ที่ coach-card.js
// โค้ชแก้ได้เฉพาะ 5 ฟิลด์นี้ในเอกสารของตัวเอง (กฎ Firestore coaches update) แอดมินที่สวมบทบาทโค้ชคนนั้นแก้ให้ได้เหมือนกัน
// ฟอร์มสร้างด้วย JS จึงอ้างอิง element ผ่าน querySelector ใน container ไม่ใช้ id
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-init.js";
import { escapeHtml, safeHttpUrl } from "./ui-utils.js";
import { COACH_CERTIFICATES, COACH_FULLNAME_MAX, COACH_OTHER_CERT_MAX, parseCoachPersonal, splitCertificates } from "./coach-card.js";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // ต้องตรงกับ storage.rules (coachPhotos)
let api = null; // { record() = เอกสารโค้ช {id, ...} หรือ null, onSaved() = เรียกหลังบันทึกสำเร็จ (วาดข้อมูลเบื้องต้นด้านบนใหม่) }
let container = null;
let removePhoto = false;

function formHtml(coach) {
  const photo = safeHttpUrl(coach.photoUrl);
  const { picked, other } = splitCertificates(coach.certificates);
  const certs = COACH_CERTIFICATES.map((c) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" data-cert value="${escapeHtml(c)}"${picked.includes(c) ? " checked" : ""} /> ${escapeHtml(c)}</label>`).join("");
  return `<div class="card card-pad space-y-4">
    <h3 class="section-title">ข้อมูลส่วนตัว</h3>
    <p class="text-sm text-slate-500">แสดงในการ์ดโค้ชของหน้า Coach Data ที่ทีมหลังบ้านและผู้ดูแลระบบเห็น</p>
    <div class="flex items-center gap-4 flex-wrap">
      <div class="coach-photo-preview">${photo ? `<img src="${photo}" alt="" />` : '<span class="coach-card-photo-empty" aria-hidden="true"></span>'}</div>
      <div class="space-y-1">
        <input type="file" accept="image/*" data-photo-input class="field-input" />
        ${photo ? '<button type="button" class="btn btn-ghost-danger btn-sm" data-photo-remove>ลบรูปเดิม</button>' : ""}
        <p class="text-xs text-slate-400">ไฟล์รูปไม่เกิน 5MB</p>
      </div>
    </div>
    <div>
      <label class="field-label">ชื่อจริง</label>
      <input type="text" data-fullname maxlength="${COACH_FULLNAME_MAX}" class="field-input" value="${escapeHtml(coach.fullName ?? "")}" />
    </div>
    <div>
      <label class="field-label">เบอร์โทรศัพท์</label>
      <input type="tel" inputmode="tel" data-phone class="field-input" placeholder="08x-xxx-xxxx" value="${escapeHtml(coach.phone ?? "")}" />
    </div>
    <div>
      <label class="field-label">ใบประกาศผู้ฝึกสอน</label>
      <div class="flex flex-wrap gap-4">${certs}</div>
      <input type="text" data-cert-other maxlength="${COACH_OTHER_CERT_MAX}" class="field-input mt-2" placeholder="ใบประกาศอื่น ๆ (ถ้ามี)" value="${escapeHtml(other)}" />
    </div>
    <div class="flex items-center gap-3 flex-wrap">
      <button type="button" class="btn btn-primary" data-save>บันทึกข้อมูลส่วนตัว</button>
      <p class="text-sm text-slate-500" data-status></p>
    </div>
  </div>`;
}

function setStatus(text, isError = false) {
  const el = container.querySelector("[data-status]");
  el.textContent = text;
  el.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

async function uploadPhoto(file, coachId) {
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `coachPhotos/${coachId}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return { url: await getDownloadURL(fileRef), path };
}

async function deleteOldPhoto(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch (err) {
    console.warn("ลบรูปเดิมใน Storage ไม่สำเร็จ (ไม่บล็อกการบันทึก):", err);
  }
}

async function save() {
  const coach = api.record();
  if (!coach) return;
  const form = {
    fullName: container.querySelector("[data-fullname]").value,
    phone: container.querySelector("[data-phone]").value,
    certificates: [...container.querySelectorAll("[data-cert]:checked")].map((c) => c.value),
    other: container.querySelector("[data-cert-other]").value
  };
  const { value, error } = parseCoachPersonal(form);
  if (error) return setStatus(error, true);
  const file = container.querySelector("[data-photo-input]").files[0] || null;
  if (file && file.size > MAX_PHOTO_SIZE) return setStatus("รูปใหญ่เกินไป (จำกัดไม่เกิน 5MB)", true);
  if (file && !file.type.startsWith("image/")) return setStatus("รองรับเฉพาะไฟล์รูปภาพเท่านั้น", true);
  const saveBtn = container.querySelector("[data-save]");
  saveBtn.disabled = true;
  const oldPath = coach.photoPath ?? null;
  try {
    const payload = { ...value };
    if (file) {
      setStatus("กำลังอัปโหลดรูป...");
      const uploaded = await uploadPhoto(file, coach.id);
      payload.photoUrl = uploaded.url;
      payload.photoPath = uploaded.path;
    } else if (removePhoto) {
      payload.photoUrl = null;
      payload.photoPath = null;
    }
    setStatus("กำลังบันทึก...");
    await updateDoc(doc(db, "coaches", coach.id), payload);
    Object.assign(coach, payload);
    if (file || removePhoto) await deleteOldPhoto(oldPath);
    removePhoto = false;
    render();
    setStatus("บันทึกแล้ว");
    if (api.onSaved) api.onSaved();
  } catch (err) {
    console.error(err);
    setStatus("บันทึกไม่สำเร็จ: " + err.message, true);
  } finally {
    saveBtn.disabled = false;
  }
}

function render() {
  const coach = api.record();
  if (!coach) {
    container.innerHTML = "";
    return;
  }
  removePhoto = false;
  container.innerHTML = formHtml(coach);
}

export function initCoachPersonal(box, coachApi) {
  container = box;
  api = coachApi;
  container.addEventListener("click", (e) => {
    if (e.target.closest("[data-save]")) save();
    else if (e.target.closest("[data-photo-remove]")) {
      removePhoto = true;
      container.querySelector(".coach-photo-preview").innerHTML = '<span class="coach-card-photo-empty" aria-hidden="true"></span>';
      e.target.closest("[data-photo-remove]").remove();
    }
  });
}

export function showCoachPersonal() {
  render();
}
