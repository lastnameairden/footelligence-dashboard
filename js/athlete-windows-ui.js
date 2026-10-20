// หน้าแอดมิน "เปิดสมุดพกให้โค้ช": กำหนดช่วงวันที่ที่โค้ชเปิด Athlete Results ได้ (ตรรกะ/ตารางอยู่ที่ athlete-windows.js)
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, auth } from "./firebase-init.js";
import { escapeHtml, thisMonthBangkok, todayBangkok } from "./ui-utils.js";
import { ALL_TEAMS, validateWindowForm, windowLabel, windowsTableHtml } from "./athlete-windows.js";
import { addMonthsToMonth, thaiMonthLabel } from "./coach-meetings.js";
import { monthsBack } from "./plan-report-data.js";

const el = (id) => document.getElementById(id);
let windows = [];
let initialized = false;
let teams = [];

function setStatus(text, isError = false) {
  el("athlete-window-status").textContent = text;
  el("athlete-window-status").className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

function renderList() {
  el("athlete-window-list-body").innerHTML = windowsTableHtml(windows, todayBangkok());
}

async function loadWindows() {
  el("athlete-window-list-body").innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  try {
    const snap = await getDocs(collection(db, "athleteResultsWindows"));
    windows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList();
  } catch (err) {
    console.error(err);
    el("athlete-window-list-body").innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-600">โหลดไม่สำเร็จ: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function init() {
  initialized = true;
  el("athlete-window-team").innerHTML =
    `<option value="${ALL_TEAMS}">ทุกทีม</option>` + teams.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  const thisMonth = thisMonthBangkok();
  // เดือนย้อนหลัง 18 เดือนถึงเดือนนี้ — ค่าเริ่มต้นสมุดพกย้อนหลัง 3 เดือนนับถึงเดือนนี้ (เหมือนหน้าสร้างสมุดพกของแอดมิน)
  const options = monthsBack(thisMonth, 18).map((m) => `<option value="${m}">${escapeHtml(thaiMonthLabel(m))}</option>`).join("");
  el("athlete-window-start").innerHTML = options;
  el("athlete-window-end").innerHTML = options;
  el("athlete-window-start").value = addMonthsToMonth(thisMonth, -2);
  el("athlete-window-end").value = thisMonth;
  el("athlete-window-open").value = todayBangkok();

  el("athlete-window-submit").addEventListener("click", async () => {
    const form = {
      team: el("athlete-window-team").value,
      startMonth: el("athlete-window-start").value,
      endMonth: el("athlete-window-end").value,
      openDate: el("athlete-window-open").value,
      closeDate: el("athlete-window-close").value
    };
    const problem = validateWindowForm(form, windows, todayBangkok());
    if (problem) return setStatus(problem, true);
    el("athlete-window-submit").disabled = true;
    try {
      setStatus("กำลังบันทึก...");
      await addDoc(collection(db, "athleteResultsWindows"), { ...form, status: "open", createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
      setStatus(`เปิดสมุดพกช่วง ${windowLabel(form)} ให้โค้ชแล้ว ✓`);
      await loadWindows();
    } catch (err) {
      console.error(err);
      setStatus("บันทึกไม่สำเร็จ: " + err.message, true);
    } finally {
      el("athlete-window-submit").disabled = false;
    }
  });

  el("athlete-window-list-body").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-window-close],[data-window-reopen],[data-window-delete]");
    if (!btn) return;
    const id = btn.dataset.windowClose || btn.dataset.windowReopen || btn.dataset.windowDelete;
    const w = windows.find((x) => x.id === id);
    if (!w) return;
    const deleting = btn.hasAttribute("data-window-delete");
    if (deleting && !confirm(`ลบช่วงเปิดสมุดพก ${windowLabel(w)}? การลบนี้ไม่สามารถย้อนกลับได้`)) return;
    if (btn.hasAttribute("data-window-close") && !confirm(`ปิดช่วงสมุดพก ${windowLabel(w)} ตอนนี้? โค้ชจะเปิดดูไม่ได้ทันที (เปิดอีกครั้งได้ถ้ายังไม่พ้นวันสุดท้าย)`)) return;
    btn.disabled = true;
    try {
      if (deleting) await deleteDoc(doc(db, "athleteResultsWindows", id));
      else await updateDoc(doc(db, "athleteResultsWindows", id), { status: btn.hasAttribute("data-window-close") ? "closed" : "open", updatedAt: serverTimestamp() });
      await loadWindows();
    } catch (err) {
      console.error(err);
      setStatus("อัปเดตไม่สำเร็จ: " + err.message, true);
      btn.disabled = false;
    }
  });
}

// c = { teams: [ชื่อทีม] }
export function openAdminAthleteWindows(c) {
  teams = c.teams;
  if (!initialized) init();
  setStatus("");
  return loadWindows();
}
