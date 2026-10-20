// หน้าจอเมนู Match Data: Match Recording Form (พิมพ์ไปจดแล้วกลับมากรอก Match Day) + ประวัติการแข่งขัน + รายงานผล Match Day (พิมพ์/PDF)
// ตรรกะ/HTML อยู่ที่ match-history.js / match-sheets.js — ไฟล์นี้ผูก DOM + Firestore (matchReports, players) การแสดง/ซ่อนหน้าจออยู่ที่ attendance.js
import { collection, getDocs, query, where, doc, deleteDoc, setDoc, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, todayBangkok } from "./ui-utils.js";
import { buildReportModel, filterReports, groupByAgeGroup, hasDetail, seasonLabel, seasonOptions } from "./match-history.js";
import { historyHtml, recordingFormHtml, reportSheetHtml } from "./match-sheets.js";
import { ageGroupsOf } from "./player-gallery.js";

const el = (id) => document.getElementById(id);
let api = null; // { team(), ageGroups(), open(screen) = เปิดพร้อมโหลดข้อมูล, show(screen) = แค่สลับหน้าจอ, editMatchDay(date, ageGroup), ensureSession(date) }
let reports = []; // matchReports ของทีม (โหลดตอนเปิดประวัติ)
let currentReport = null;

// ---------- พิมพ์ ----------
// พิมพ์เฉพาะ .print-sheet: ใส่ class ให้ body ชั่วคราว (CSS @media print ซ่อนส่วนอื่น) + ตั้งขนาดกระดาษผ่าน <style> ชั่วคราว แล้วคืนค่าเมื่อพิมพ์เสร็จ
function printSheet(pageCss) {
  const style = document.createElement("style");
  style.textContent = `@page { ${pageCss} }`;
  document.head.appendChild(style);
  document.body.classList.add("printing-sheet");
  const cleanup = () => {
    document.body.classList.remove("printing-sheet");
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// ---------- Match Recording Form ----------
async function loadPool() {
  const snap = await getDocs(query(collection(db, "players"), where("team", "==", api.team())));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function renderForm() {
  const select = el("match-form-age-select");
  const sheet = el("match-form-sheet");
  sheet.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const pool = await loadPool();
    const mine = api.ageGroups();
    const groups = mine.length > 0 ? mine : ageGroupsOf(pool);
    if (groups.length === 0) {
      select.innerHTML = "";
      sheet.innerHTML = '<div class="card card-pad text-slate-500">ยังไม่มีนักกีฬาในทีม</div>';
      return;
    }
    const keep = groups.includes(select.value) ? select.value : groups[0];
    select.innerHTML = groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    select.value = keep;
    // รายชื่อทั้งรุ่นรวมผู้รักษาประตู (ไม่กรองตามตำแหน่งโค้ชเหมือนหน้า Player Data) เรียงตามเบอร์
    const players = pool
      .filter((p) => p.ageGroup === keep)
      .sort((a, b) => (typeof a.number === "number" ? a.number : Infinity) - (typeof b.number === "number" ? b.number : Infinity) || String(a.nickname ?? "").localeCompare(String(b.nickname ?? ""), "th"));
    sheet.innerHTML = recordingFormHtml({ team: api.team(), ageGroup: keep, players });
  } catch (err) {
    console.error(err);
    sheet.innerHTML = `<div class="card card-pad text-red-600">โหลดแบบฟอร์มไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- ประวัติการแข่งขัน ----------
function renderHistory() {
  const seasonSelect = el("match-history-season-select");
  const options = seasonOptions(reports, todayBangkok());
  const keep = options.includes(Number(seasonSelect.value)) ? Number(seasonSelect.value) : options[0];
  seasonSelect.innerHTML = options.map((y) => `<option value="${y}">${seasonLabel(y)}</option>`).join("");
  seasonSelect.value = String(keep);
  const list = filterReports(reports, { seasonStart: keep, query: el("match-history-search").value, ageGroups: api.ageGroups() });
  el("match-history-status").textContent = `${list.length} นัดในฤดูกาล ${seasonLabel(keep)}`;
  el("match-history-body").innerHTML = historyHtml(groupByAgeGroup(list));
}

async function loadHistory() {
  el("match-history-status").textContent = "กำลังโหลด...";
  el("match-history-body").innerHTML = "";
  try {
    const snap = await getDocs(query(collection(db, "matchReports"), where("team", "==", api.team())));
    reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHistory();
  } catch (err) {
    console.error(err);
    el("match-history-status").textContent = "";
    el("match-history-body").innerHTML = `<div class="card card-pad text-red-600">โหลดประวัติไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- รายงานผล ----------
function renderSheet(report) {
  currentReport = report;
  el("match-sheet-body").innerHTML = reportSheetHtml(buildReportModel(report), api.team());
  el("match-sheet-status").textContent = "";
  // รายงานเก่าที่ไม่ได้มาจาก Match Day แก้ไขในหน้านี้ไม่ได้ (ฟอร์มเดิมถูกแทนที่แล้ว) — ลบได้
  el("match-sheet-edit-btn").classList.toggle("hidden", !hasDetail(report));
}

function openSheetFor(id) {
  const report = reports.find((r) => r.id === id);
  if (!report) return;
  renderSheet(report);
  api.show("match-sheet");
}

async function deleteCurrent() {
  const r = currentReport;
  if (!r || !confirm(`ยืนยันลบผลการแข่งขันวันที่ ${r.date} รุ่น ${r.ageGroup ?? "-"} กับ ${r.opponent ?? "-"}?\nการลบนี้ไม่สามารถย้อนกลับได้`)) return;
  try {
    await deleteDoc(doc(db, "matchReports", r.id));
    if (r.matchDay && r.ageGroup) {
      // เอาเครื่องหมาย Match Day ออกจากวันซ้อมของวันนั้น ให้รุ่นนี้กลับมานับเป็นวันเช็คชื่อซ้อมตามปกติ
      const session = await api.ensureSession(r.date);
      await setDoc(doc(db, "sessions", session.id), { matchDayAgeGroups: arrayRemove(r.ageGroup), updatedAt: serverTimestamp() }, { merge: true });
    }
    reports = reports.filter((x) => x.id !== r.id);
    currentReport = null;
    api.show("match-history");
    renderHistory();
    el("match-history-status").textContent = "ลบผลการแข่งขันแล้ว";
  } catch (err) {
    console.error(err);
    el("match-sheet-status").textContent = "ลบไม่สำเร็จ: " + err.message;
  }
}

// ---------- ทางเข้า ----------
export function initMatchData(a) {
  api = a;
  el("match-data-go-form").addEventListener("click", () => api.open("match-form"));
  el("match-data-go-history").addEventListener("click", () => api.open("match-history"));
  el("match-form-age-select").addEventListener("change", renderForm);
  el("match-form-print-btn").addEventListener("click", () => printSheet("size: A4 landscape; margin: 7mm;"));
  el("match-history-season-select").addEventListener("change", renderHistory);
  el("match-history-search").addEventListener("input", renderHistory);
  const body = el("match-history-body");
  body.addEventListener("click", (e) => {
    const row = e.target.closest("[data-match-id]");
    if (row) openSheetFor(row.dataset.matchId);
  });
  body.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const row = e.target.closest("[data-match-id]");
    if (row) openSheetFor(row.dataset.matchId);
  });
  el("match-sheet-back-btn").addEventListener("click", () => api.show("match-history"));
  el("match-sheet-print-btn").addEventListener("click", () => printSheet("size: A4 portrait; margin: 10mm;"));
  el("match-sheet-edit-btn").addEventListener("click", () => currentReport && api.editMatchDay(currentReport.date, currentReport.ageGroup));
  el("match-sheet-delete-btn").addEventListener("click", deleteCurrent);
}

export const showMatchForm = renderForm;
export const showMatchHistory = loadHistory;

// รีเฟรชแล้วเปิดรายงานโดยตรงไม่ได้ (รหัสรายงานไม่ได้เก็บใน URL) — ถ้าไม่มีรายงานที่เลือกอยู่ให้ผู้เรียกพากลับประวัติ
export const hasCurrentReport = () => currentReport !== null;
