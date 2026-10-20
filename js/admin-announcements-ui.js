// หน้าแอดมิน "ประกาศถึงทีมหลังบ้าน": เขียนประกาศที่ทีมหลังบ้านเห็นที่ Home ของหน้าทีม (ตรรกะ/การ์ดอยู่ที่ staff-announcements.js)
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml } from "./ui-utils.js";
import { announcementCardHtml, sortAnnouncements, validateAnnouncement } from "./staff-announcements.js";

const el = (id) => document.getElementById(id);
let list = [];
let initialized = false;
let authorName = () => "ผู้ดูแลระบบ";

function setStatus(text, isError = false) {
  el("announce-status").textContent = text;
  el("announce-status").className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

function renderList() {
  if (list.length === 0) {
    el("announce-list").innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีประกาศ</p>';
    return;
  }
  el("announce-list").innerHTML = list
    .map((a) => `<div class="space-y-1">${announcementCardHtml(a)}<button type="button" class="btn btn-ghost-danger btn-sm" data-announce-delete="${escapeHtml(a.id)}">ลบประกาศนี้</button></div>`)
    .join("");
}

async function load() {
  el("announce-list").innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const snap = await getDocs(query(collection(db, "staffAnnouncements"), orderBy("createdAt", "desc"), limit(50)));
    list = sortAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderList();
  } catch (err) {
    console.error(err);
    el("announce-list").innerHTML = `<p class="text-sm text-red-600">โหลดประกาศไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

function init() {
  initialized = true;
  el("announce-submit").addEventListener("click", async () => {
    const { value, error } = validateAnnouncement({ title: el("announce-title").value, message: el("announce-message").value });
    if (error) return setStatus(error, true);
    el("announce-submit").disabled = true;
    try {
      setStatus("กำลังประกาศ...");
      await addDoc(collection(db, "staffAnnouncements"), { ...value, createdBy: authorName(), createdAt: serverTimestamp() });
      el("announce-title").value = "";
      el("announce-message").value = "";
      setStatus("ประกาศแล้ว — ทีมหลังบ้านเห็นที่ Home ของหน้าทีม");
      await load();
    } catch (err) {
      console.error(err);
      setStatus("ประกาศไม่สำเร็จ: " + err.message, true);
    } finally {
      el("announce-submit").disabled = false;
    }
  });
  el("announce-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-announce-delete]");
    if (!btn) return;
    const a = list.find((x) => x.id === btn.dataset.announceDelete);
    if (!a || !confirm(`ลบประกาศ "${a.title}"?\nทีมหลังบ้านจะไม่เห็นประกาศนี้อีก`)) return;
    try {
      await deleteDoc(doc(db, "staffAnnouncements", a.id));
      setStatus("ลบประกาศแล้ว");
      await load();
    } catch (err) {
      console.error(err);
      setStatus("ลบไม่สำเร็จ: " + err.message, true);
    }
  });
}

export function openAdminAnnouncements(opts = {}) {
  if (opts.authorName) authorName = opts.authorName;
  if (!initialized) init();
  setStatus("");
  return load();
}
