// หน้าจอ Evaluation → Physical Test (Instruction / Testing Form) และ Athlete Results (เปิดสมุดพกของรุ่นที่ดูแล)
// ตรรกะ/HTML อยู่ที่ physical-test-content.js / physical-form.js — ไฟล์นี้ผูก DOM + Firestore (fitnessRounds, players) การแสดง/ซ่อนหน้าจออยู่ที่ attendance.js
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, thisMonthBangkok, todayBangkok } from "./ui-utils.js";
import { ageNumberOf, roundLabel, testsForRound } from "./fitness-calc.js";
import { instructionsHtml } from "./physical-test-content.js";
import { defaultRoundId, roundOptions, testingFormHtml } from "./physical-form.js";
import { ageGroupsOf } from "./player-gallery.js";
import { monthsBack } from "./plan-report-data.js";
import { addMonthsToMonth, thaiMonthLabel } from "./coach-meetings.js";
import { printSheet } from "./print-sheet.js";

const el = (id) => document.getElementById(id);
let api = null; // { team(), ageGroups() } — ageGroups() ว่าง = ดูแลทั้งทีม (ใช้รุ่นที่มีนักกีฬา)
let rounds = [];
let pool = [];

const numberOrInf = (p) => (typeof p.number === "number" ? p.number : Infinity);
const byNumber = (a, b) => numberOrInf(a) - numberOrInf(b) || String(a.nickname ?? "").localeCompare(String(b.nickname ?? ""), "th");

async function loadPool() {
  const snap = await getDocs(query(collection(db, "players"), where("team", "==", api.team())));
  pool = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return pool;
}

async function groupsToShow() {
  const mine = api.ageGroups();
  if (mine.length > 0) return mine;
  if (pool.length === 0) await loadPool();
  return ageGroupsOf(pool);
}

function fillSelect(select, options, keep) {
  select.innerHTML = options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
  select.value = options.some((o) => o.value === keep) ? keep : options[0]?.value ?? "";
}

// ---------- Instruction ----------
export async function showInstruction() {
  const select = el("physical-instruction-age");
  const groups = (await groupsToShow().catch(() => api.ageGroups())).filter((g) => ageNumberOf(g) !== null);
  fillSelect(select, [{ value: "", label: "ทุกรุ่น" }, ...groups.map((g) => ({ value: g, label: g }))], select.value);
  renderInstruction();
}

function renderInstruction() {
  const n = ageNumberOf(el("physical-instruction-age").value);
  el("physical-instruction-body").innerHTML = instructionsHtml(n);
}

// ---------- Testing Form ----------
function renderTestingForm() {
  const sheet = el("physical-form-sheet");
  const ageGroup = el("physical-form-age").value;
  const round = rounds.find((r) => r.id === el("physical-form-round").value) ?? null;
  const tests = testsForRound(round, ageGroup);
  if (tests.length === 0) {
    sheet.innerHTML = '<div class="card card-pad text-slate-500">รุ่นอายุนี้ไม่มีรายการทดสอบในรอบที่เลือก</div>';
    el("physical-form-status").textContent = "";
    return;
  }
  const players = pool.filter((p) => p.ageGroup === ageGroup).sort(byNumber);
  sheet.innerHTML = testingFormHtml({ team: api.team(), ageGroup, roundText: round ? roundLabel(round) : "", players, tests });
  el("physical-form-status").textContent = `${tests.length} รายการทดสอบ · นักกีฬา ${players.length} คน`;
}

export async function showTestingForm() {
  const sheet = el("physical-form-sheet");
  sheet.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const [roundSnap] = await Promise.all([getDocs(collection(db, "fitnessRounds")), loadPool()]);
    rounds = roundSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const groups = (await groupsToShow()).filter((g) => ageNumberOf(g) !== null).sort((a, b) => ageNumberOf(a) - ageNumberOf(b));
    if (groups.length === 0) {
      el("physical-form-age").innerHTML = "";
      sheet.innerHTML = '<div class="card card-pad text-slate-500">ยังไม่มีนักกีฬาในทีม</div>';
      return;
    }
    const ageSelect = el("physical-form-age");
    fillSelect(ageSelect, groups.map((g) => ({ value: g, label: g })), ageSelect.value);
    const roundSelect = el("physical-form-round");
    const keepRound = roundSelect.value || defaultRoundId(rounds, todayBangkok());
    fillSelect(roundSelect, roundOptions(rounds, todayBangkok()).map((o) => ({ value: o.id, label: o.label })), keepRound);
    renderTestingForm();
  } catch (err) {
    console.error(err);
    sheet.innerHTML = `<div class="card card-pad text-red-600">โหลดแบบฟอร์มไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Athlete Results ----------
const monthOptions = () => monthsBack(thisMonthBangkok(), 12).map((m) => ({ value: m, label: thaiMonthLabel(m) }));

export async function showAthleteResults() {
  const ageSelect = el("athlete-results-age");
  const groups = await groupsToShow().catch(() => api.ageGroups());
  const mine = api.ageGroups();
  // โค้ชที่ดูแลหลายรุ่นต้องเลือกรุ่นเสมอ ส่วนโหมดดูแลทั้งทีมเลือก "ทุกรุ่น" ได้
  const options = [...(mine.length === 0 ? [{ value: "__ALL__", label: "ทุกรุ่น" }] : []), ...groups.map((g) => ({ value: g, label: g }))];
  fillSelect(ageSelect, options, ageSelect.value);
  const thisMonth = thisMonthBangkok();
  fillSelect(el("athlete-results-start"), monthOptions(), el("athlete-results-start").value || addMonthsToMonth(thisMonth, -2));
  fillSelect(el("athlete-results-end"), monthOptions(), el("athlete-results-end").value || thisMonth);
  el("athlete-results-status").textContent = "";
}

function openAthleteResults() {
  const status = el("athlete-results-status");
  const team = api.team();
  const ageGroup = el("athlete-results-age").value;
  const start = el("athlete-results-start").value;
  const end = el("athlete-results-end").value;
  status.className = "text-sm text-red-600 w-full";
  if (!team) return void (status.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ");
  if (!ageGroup) return void (status.textContent = "เลือกรุ่นอายุก่อน");
  if (start > end) return void (status.textContent = "เดือนเริ่มต้นต้องอยู่ก่อนหรือเท่ากับเดือนสิ้นสุด");
  window.location.href = `./report-card.html#team=${encodeURIComponent(team)}&ageGroup=${encodeURIComponent(ageGroup)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
}

export function initPhysical(c) {
  api = c;
  el("physical-instruction-age").addEventListener("change", renderInstruction);
  el("physical-form-age").addEventListener("change", renderTestingForm);
  el("physical-form-round").addEventListener("change", renderTestingForm);
  el("physical-form-print-btn").addEventListener("click", () => printSheet("size: A4 landscape; margin: 7mm;"));
  el("athlete-results-open-btn").addEventListener("click", openAthleteResults);
}
