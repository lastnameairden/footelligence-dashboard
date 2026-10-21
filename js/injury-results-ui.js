// หน้าจอ Injury/Sick → Results — ตรรกะ/HTML อยู่ที่ injury-results.js ไฟล์นี้ผูก DOM + Firestore (injuryReports ของทีม อ่านอย่างเดียว)
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, todayBangkok } from "./ui-utils.js";
import { PERIOD_MODES, currentPeriodKey, periodFor, shiftPeriodKey } from "./injury-period.js";
import { buildResults, resultsHtml } from "./injury-results.js";
import { ageNumberOf } from "./fitness-calc.js";

const el = (id) => document.getElementById(id);
let api = null; // { team(), ageGroups(), ageLocked() = รุ่นอายุถูกเลือกจากแถบตัวกรองภายนอก (ไม่ใช้ตัวเลือกรุ่นของหน้านี้), edit(report) = เปิด Recording ในโหมดแก้ไข, remove(report) = ลบรายการแล้วโหลดผลใหม่ }
let reports = [];
let mode = "term";
let key = null;

function renderControls() {
  el("injury-results-mode").innerHTML = PERIOD_MODES.map((m) => {
    const cls = m.key === mode ? "segmented-btn active" : "segmented-btn";
    return `<button type="button" class="${cls}" data-mode="${m.key}">${escapeHtml(m.label)}</button>`;
  }).join("");
  el("injury-results-label").textContent = periodFor(mode, key).label;
}

function render() {
  renderControls();
  const mine = api.ageGroups();
  const select = el("injury-results-age");
  const groups = mine.length > 0 ? mine : [...new Set(reports.map((r) => r.ageGroup).filter(Boolean))];
  groups.sort((a, b) => (ageNumberOf(a) ?? 99) - (ageNumberOf(b) ?? 99));
  // ทีมหลังบ้าน: รุ่นอายุมาจากแถบตัวกรองด้านบนที่เดียว — mine ถูกจำกัดตามรุ่นนั้นอยู่แล้ว ("" = ทุกรุ่นในขอบเขต)
  const keep = api.ageLocked && api.ageLocked() ? "" : groups.includes(select.value) ? select.value : "";
  select.innerHTML = `<option value="">${mine.length > 0 ? "ทุกรุ่นที่ดูแล" : "ทุกรุ่น"}</option>` + groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  select.value = keep;
  const model = buildResults({ reports, myAgeGroups: mine, ageGroup: keep, mode, key, todayStr: todayBangkok() });
  el("injury-results-body").innerHTML = resultsHtml(model);
}

export async function showResults() {
  const today = todayBangkok();
  if (!key) key = currentPeriodKey(mode, today);
  el("injury-results-status").textContent = "กำลังโหลด...";
  try {
    const snap = await getDocs(query(collection(db, "injuryReports"), where("team", "==", api.team())));
    reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    el("injury-results-status").textContent = "";
    render();
  } catch (err) {
    console.error(err);
    el("injury-results-status").textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
}

export function initResults(c) {
  api = c;
  key = currentPeriodKey(mode, todayBangkok());
  el("injury-results-mode").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn || btn.dataset.mode === mode) return;
    mode = btn.dataset.mode;
    key = currentPeriodKey(mode, todayBangkok());
    render();
  });
  el("injury-results-prev").addEventListener("click", () => {
    key = shiftPeriodKey(mode, key, -1);
    render();
  });
  el("injury-results-next").addEventListener("click", () => {
    key = shiftPeriodKey(mode, key, 1);
    render();
  });
  el("injury-results-age").addEventListener("change", render);
  el("injury-results-body").addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-injury-edit]");
    const deleteBtn = e.target.closest("[data-injury-delete]");
    const report = reports.find((r) => r.id === (editBtn?.dataset.injuryEdit ?? deleteBtn?.dataset.injuryDelete));
    if (!report) return;
    if (editBtn) api.edit(report);
    else api.remove(report); // ลบ (มีกล่องยืนยันก่อน) แล้วโหลดผลใหม่
  });
}
