// หน้ากรอกผลทดสอบสมรรถภาพของโค้ช: ตารางนักกีฬาของรุ่นเรียงลงมา คอลัมน์รายการทดสอบไปทางขวา (ตรรกะล้วนอยู่ที่ fitness-calc.js)
//   - ผูกกับ "รอบที่เปิดอยู่" รอบเดียว ไม่แสดงผลรอบก่อนหน้า (ดูประวัติทุกรอบได้ที่หน้านักกีฬา/สมุดพก)
//   - บันทึกอัตโนมัติรายคนเมื่อแก้ช่องแล้วออกจากช่อง (คิวเดียวกับเช็คชื่อ ดู attendance-save.js) ค่าว่าง = "ไม่ได้ทดสอบรอบนี้" ไม่ใช่ 0
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, todayBangkok } from "./ui-utils.js";
import { createSaveQueue } from "./attendance-save.js";
import {
  FOOTWEAR_OPTIONS,
  NOT_TESTED_REASONS,
  SURFACE_OPTIONS,
  ageNumberOf,
  completion,
  currentEntryRound,
  daysBetween,
  formatResult,
  hasValue,
  plausibilityWarnings,
  roundLabel,
  roundState,
  testsForRound,
  thaiDateShort
} from "./fitness-calc.js";

const statusEl = document.getElementById("fitness-entry-status");
const bannerEl = document.getElementById("fitness-entry-banner");
const controlsEl = document.getElementById("fitness-entry-controls");
const ageSelect = document.getElementById("fitness-entry-age");
const progressEl = document.getElementById("fitness-entry-progress");
const summaryEl = document.getElementById("fitness-entry-summary");
const warnEl = document.getElementById("fitness-entry-warnings");
const dateInput = document.getElementById("fitness-entry-date");
const surfaceSelect = document.getElementById("fitness-entry-surface");
const footwearSelect = document.getElementById("fitness-entry-footwear");
const saveStatusEl = document.getElementById("fitness-entry-save-status");
const gridWrap = document.getElementById("fitness-entry-grid-wrap");

let ctx = null; // { team, coachId, coachName, ageGroups, isAdmin } จาก attendance.js ตอนเปิดหน้า
let round = null;
let pool = []; // นักกีฬาทุกรุ่น/ทุกตำแหน่งของทีม (ไม่ผ่านตัวกรองตำแหน่งโค้ช — ทดสอบสมรรถภาพทุกคน รวม GK)
let results = new Map(); // playerId -> { tests: { code: { trials: [string] } }, notTested: {reason}|null, saved: boolean }
let ageGroup = "";
let conditions = { testDate: todayBangkok(), surface: SURFACE_OPTIONS[0], footwear: FOOTWEAR_OPTIONS[0] };

const saveQueue = createSaveQueue({
  onChange: (pending) => {
    saveStatusEl.textContent = pending > 0 ? `กำลังบันทึก... (รอส่ง ${pending})` : "บันทึกแล้ว ✓";
    saveStatusEl.className = "text-sm text-slate-500";
  },
  onError: (err) => {
    console.error(err);
    saveStatusEl.textContent = "บันทึกบางรายการไม่สำเร็จ: " + err.message + " — ลองแก้ช่องนั้นอีกครั้ง";
    saveStatusEl.className = "text-sm text-red-600";
  }
});
window.addEventListener("beforeunload", (e) => {
  if (saveQueue.pending > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});

const playerName = (p) => p.nickname ?? p.fullName ?? p.id;

function groupPlayers() {
  return pool
    .filter((p) => p.ageGroup === ageGroup)
    .sort((a, b) => (typeof a.number === "number" ? a.number : Infinity) - (typeof b.number === "number" ? b.number : Infinity) || playerName(a).localeCompare(playerName(b)));
}

function resultOf(playerId) {
  if (!results.has(playerId)) results.set(playerId, { tests: {}, notTested: null, saved: false });
  return results.get(playerId);
}

const hasAnyValue = (r) => Object.values(r.tests).some((t) => hasValue(t.trials));

// ช่วงทดสอบซ่อม: โค้ชแก้ได้เฉพาะคนที่ยังไม่มีผล หรือที่ระบุว่าไม่ได้ทดสอบ (กฎ Firestore แยกให้ไม่ได้ จึงบังคับที่นี่) — แอดมินแก้ได้ทุกคน
function rowLocked(playerId) {
  if (ctx.isAdmin || roundState(round, todayBangkok()) !== "makeup") return false;
  const r = results.get(playerId);
  return !!r && hasAnyValue(r) && !r.notTested;
}

function showBanner() {
  const today = todayBangkok();
  const state = roundState(round, today);
  const modeText = round.mode === "selective" ? "Selective" : "Full";
  if (state === "open") {
    const left = daysBetween(today, round.closeDate);
    bannerEl.className = "card card-success card-pad flex items-center justify-between gap-3 flex-wrap";
    bannerEl.innerHTML = `<div><p class="font-semibold text-emerald-800">รอบที่เปิดอยู่: ${escapeHtml(roundLabel(round))} (${modeText})</p>
      <p class="text-sm text-emerald-700">กรอกได้ถึง ${thaiDateShort(round.closeDate)} · เหลือ ${left} วัน · ทดสอบซ่อมได้ถึง ${thaiDateShort(round.makeupUntil)}</p></div>
      <span class="badge badge-neutral">หน้านี้แสดงเฉพาะรอบนี้</span>`;
  } else {
    bannerEl.className = "card card-warning card-pad flex items-center justify-between gap-3 flex-wrap";
    bannerEl.innerHTML = `<div><p class="font-semibold text-amber-800">ช่วงทดสอบซ่อม: ${escapeHtml(roundLabel(round))} (${modeText})</p>
      <p class="text-sm text-amber-700">กรอกได้เฉพาะนักกีฬาที่ยังไม่มีผล หรือที่ระบุว่าไม่ได้ทดสอบ · ถึง ${thaiDateShort(round.makeupUntil)}</p></div>
      <span class="badge badge-neutral">หน้านี้แสดงเฉพาะรอบนี้</span>`;
  }
  bannerEl.classList.remove("hidden");
}

function showMessage(text) {
  bannerEl.classList.add("hidden");
  controlsEl.classList.add("hidden");
  gridWrap.innerHTML = `<div class="card card-pad text-center text-slate-500">${escapeHtml(text)}</div>`;
}

// ---------- ตาราง ----------
function inputCell(player, test, i, locked, skipped, warn) {
  const r = resultOf(player.id);
  const value = (r.tests[test.code]?.trials || [])[i] ?? "";
  const warnCls = warn ? " border-amber-500" : "";
  return `<td><input type="number" inputmode="decimal" min="0" step="${test.step}" class="field-input${warnCls}" style="width:4.2rem;padding:0.2rem 0.3rem;text-align:center" value="${escapeHtml(value)}" data-p="${escapeHtml(player.id)}" data-c="${test.code}" data-i="${i}"${locked || skipped ? " disabled" : ""}${warn ? ` title="${escapeHtml(warn)}"` : ""} /></td>`;
}

function rowStatusHtml(player, tests) {
  const r = resultOf(player.id);
  const c = completion(r, tests);
  if (c.state === "not_tested") return '<span class="badge badge-danger">ไม่ได้ทดสอบ</span>';
  if (c.state === "empty") return '<span class="badge badge-neutral">ยังไม่กรอก</span>';
  if (c.state === "complete") return `<span class="badge badge-success">ครบ ${c.done}/${c.total}</span>`;
  return `<span class="badge badge-warning">${c.done}/${c.total}</span>`;
}

function rowHtml(player, tests) {
  const r = resultOf(player.id);
  const locked = rowLocked(player.id);
  const skipped = !!r.notTested;
  const warns = plausibilityWarnings(r.tests);
  const cells = tests
    .map((t) => {
      let html = "";
      for (let i = 0; i < t.trials; i++) html += inputCell(player, t, i, locked, skipped, warns[t.code]);
      if (t.trials > 1) html += `<td><span class="font-semibold" data-use="${escapeHtml(player.id)}|${t.code}">${formatResult(t, r.tests[t.code]?.trials)}</span></td>`;
      return html;
    })
    .join("");
  const reason = skipped
    ? `<select class="field-input" style="width:auto;padding:0.15rem 0.3rem" data-reason="${escapeHtml(player.id)}"${locked ? " disabled" : ""}>${NOT_TESTED_REASONS.map((x) => `<option${r.notTested.reason === x ? " selected" : ""}>${x}</option>`).join("")}</select>`
    : "";
  return `<tr data-row="${escapeHtml(player.id)}" class="${skipped ? "opacity-50" : ""}">
    <td class="font-semibold text-slate-900" style="position:sticky;left:0;background:var(--surface-2,#fff);text-align:left;min-width:6rem">${escapeHtml(playerName(player))}${locked ? ' <span class="text-xs text-slate-400">(มีผลแล้ว)</span>' : ""}</td>
    ${cells}
    <td><div class="flex items-center justify-center gap-2" style="white-space:nowrap"><span data-status="${escapeHtml(player.id)}">${rowStatusHtml(player, tests)}</span>
      <label class="text-xs text-slate-600"><input type="checkbox" data-skip="${escapeHtml(player.id)}"${skipped ? " checked" : ""}${locked ? " disabled" : ""} /> ไม่ทดสอบ</label>${reason}</div></td>
  </tr>`;
}

function renderGrid() {
  const tests = testsForRound(round, ageGroup);
  const players = groupPlayers();
  if (tests.length === 0) {
    gridWrap.innerHTML = '<div class="card card-pad text-center text-slate-500">รุ่นอายุนี้ไม่มีรายการทดสอบในรอบนี้</div>';
    progressEl.textContent = "";
    summaryEl.textContent = "";
    return;
  }
  if (players.length === 0) {
    gridWrap.innerHTML = '<div class="card card-pad text-center text-slate-500">ไม่มีนักกีฬารุ่นอายุนี้ในทีม</div>';
    progressEl.textContent = "";
    summaryEl.textContent = "";
    return;
  }
  const head1 = tests
    .map((t) => `<th colspan="${t.trials > 1 ? t.trials + 1 : 1}">${escapeHtml(t.label)} (${escapeHtml(t.unit)})</th>`)
    .join("");
  const head2 = tests
    .map((t) => (t.trials > 1 ? Array.from({ length: t.trials }, (_, i) => `<th>${i + 1}</th>`).join("") + "<th>ใช้</th>" : "<th>ผล</th>"))
    .join("");
  gridWrap.innerHTML = `
    <div class="card" style="overflow-x:auto">
      <table class="pro-table grid-table" style="min-width:max-content">
        <thead>
          <tr><th rowspan="2" style="position:sticky;left:0;background:var(--surface-1,#f8fafc);text-align:left">นักกีฬา</th>${head1}<th rowspan="2" style="min-width:11rem">สถานะ</th></tr>
          <tr>${head2}</tr>
        </thead>
        <tbody>${players.map((p) => rowHtml(p, tests)).join("")}</tbody>
      </table>
    </div>`;
  const inputs = tests.reduce((s, t) => s + t.trials, 0);
  summaryEl.textContent = `รุ่น ${ageGroup} · ${tests.length} รายการ · ${inputs} ช่องต่อคน`;
  updateProgress();
}

function updateProgress() {
  const tests = testsForRound(round, ageGroup);
  const players = groupPlayers();
  const done = players.filter((p) => completion(resultOf(p.id), tests).state === "complete").length;
  progressEl.textContent = `กรอกครบ ${done}/${players.length} คน`;
  const warnCount = players.reduce((n, p) => n + Object.keys(plausibilityWarnings(resultOf(p.id).tests)).length, 0);
  warnEl.textContent = warnCount > 0 ? `ตรวจซ้ำ ${warnCount} ช่อง (กรอบสีส้ม) — เตือนเท่านั้น ไม่บล็อกการบันทึก` : "";
}

// ---------- บันทึก ----------
function payloadFor(player) {
  const r = resultOf(player.id);
  const tests = {};
  for (const t of testsForRound(round, ageGroup)) {
    const trials = r.tests[t.code]?.trials;
    // แตะแล้ว (มี trials ในหน่วยความจำ) เขียนเสมอ แม้ลบหมดแล้ว — merge ลง Firestore จะได้ล้างค่าเดิมของรายการนั้นจริง
    if (trials) tests[t.code] = { trials: trials.map((v) => (v === "" || v === undefined ? null : Number(v))) };
  }
  return {
    team: ctx.team,
    playerId: player.id,
    playerName: playerName(player),
    ageGroup: player.ageGroup ?? ageGroup,
    roundId: round.id,
    testDate: conditions.testDate || null,
    surface: conditions.surface || null,
    footwear: conditions.footwear || null,
    tests,
    notTested: r.notTested || null,
    recordedBy: { coachId: ctx.coachId, coachName: ctx.coachName },
    updatedAt: serverTimestamp()
  };
}

function saveRow(player) {
  const key = `${round.id}_${player.id}`;
  const payload = payloadFor(player);
  resultOf(player.id).saved = true;
  saveQueue.enqueue(key, () => setDoc(doc(db, "fitnessResults", key), payload, { merge: true }));
}

// สภาพการทดสอบเป็นของทั้งรุ่น: แก้แล้วอัปเดตเอกสารผลที่บันทึกไว้แล้วของรุ่นนี้ทุกคนด้วย (คนที่ยังไม่มีเอกสารจะใช้ค่านี้ตอนบันทึกครั้งแรก)
function saveConditions() {
  conditions = { testDate: dateInput.value, surface: surfaceSelect.value, footwear: footwearSelect.value };
  const saved = groupPlayers().filter((p) => resultOf(p.id).saved);
  if (saved.length === 0) return;
  saveQueue.enqueue(`${round.id}_conditions_${ageGroup}`, async () => {
    const batch = writeBatch(db);
    for (const p of saved) {
      batch.set(
        doc(db, "fitnessResults", `${round.id}_${p.id}`),
        { testDate: conditions.testDate || null, surface: conditions.surface || null, footwear: conditions.footwear || null, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  });
}

for (const el of [dateInput, surfaceSelect, footwearSelect]) el.addEventListener("change", () => round && saveConditions());

function refreshRow(playerId) {
  const player = pool.find((p) => p.id === playerId);
  const tests = testsForRound(round, ageGroup);
  const r = resultOf(playerId);
  for (const t of tests.filter((x) => x.trials > 1)) {
    const el = gridWrap.querySelector(`[data-use="${CSS.escape(`${playerId}|${t.code}`)}"]`);
    if (el) el.textContent = formatResult(t, r.tests[t.code]?.trials);
  }
  const statusEl2 = gridWrap.querySelector(`[data-status="${CSS.escape(playerId)}"]`);
  if (statusEl2 && player) statusEl2.innerHTML = rowStatusHtml(player, tests);
  // กรอบสีส้ม (ค่าผิดปกติ) ปรับตามที่พิมพ์ทันที
  const warns = plausibilityWarnings(r.tests);
  for (const input of gridWrap.querySelectorAll(`input[data-p="${CSS.escape(playerId)}"]`)) {
    const w = warns[input.dataset.c];
    input.classList.toggle("border-amber-500", !!w);
    if (w) input.title = w;
    else input.removeAttribute("title");
  }
  updateProgress();
}

gridWrap.addEventListener("input", (e) => {
  const input = e.target.closest("input[data-p]");
  if (!input) return;
  const r = resultOf(input.dataset.p);
  const test = testsForRound(round, ageGroup).find((t) => t.code === input.dataset.c);
  const trials = r.tests[input.dataset.c]?.trials || Array.from({ length: test.trials }, () => "");
  trials[Number(input.dataset.i)] = input.value;
  r.tests[input.dataset.c] = { trials };
  refreshRow(input.dataset.p);
});

gridWrap.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-p]");
  if (input) {
    const player = pool.find((p) => p.id === input.dataset.p);
    if (player) saveRow(player);
    return;
  }
  const skip = e.target.closest("input[data-skip]");
  if (skip) {
    const player = pool.find((p) => p.id === skip.dataset.skip);
    if (!player) return;
    resultOf(player.id).notTested = skip.checked ? { reason: NOT_TESTED_REASONS[0] } : null;
    saveRow(player);
    renderGrid();
    return;
  }
  const reason = e.target.closest("select[data-reason]");
  if (reason) {
    const player = pool.find((p) => p.id === reason.dataset.reason);
    if (!player) return;
    resultOf(player.id).notTested = { reason: reason.value };
    saveRow(player);
  }
});

// Enter = ลงแถวถัดไปในช่องเดิม (กรอกทีละรายการทั้งรุ่นเหมือนตอนวัดจริง)
gridWrap.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const input = e.target.closest("input[data-p]");
  if (!input) return;
  e.preventDefault();
  const column = [...gridWrap.querySelectorAll(`input[data-c="${input.dataset.c}"][data-i="${input.dataset.i}"]`)].filter((x) => !x.disabled);
  const next = column[column.indexOf(input) + 1];
  if (next) {
    next.focus();
    next.select();
  }
});

// ---------- โหลด/เปิดหน้า ----------
function ageOptions() {
  const fromPool = [...new Set(pool.map((p) => p.ageGroup).filter(Boolean))];
  const mine = ctx.ageGroups && ctx.ageGroups.length > 0 ? ctx.ageGroups : fromPool;
  return mine
    .filter((g) => ageNumberOf(g) !== null)
    .sort((a, b) => ageNumberOf(a) - ageNumberOf(b));
}

async function loadRoundData() {
  const snap = await getDocs(query(collection(db, "fitnessResults"), where("team", "==", ctx.team), where("roundId", "==", round.id)));
  results = new Map();
  let first = null;
  snap.forEach((d) => {
    const data = d.data();
    first = first || data;
    results.set(data.playerId, {
      tests: Object.fromEntries(
        Object.entries(data.tests || {}).map(([code, t]) => [code, { trials: (t.trials || []).map((v) => (v === null || v === undefined ? "" : String(v))) }])
      ),
      notTested: data.notTested || null,
      saved: true
    });
  });
  // สภาพการทดสอบ: ใช้ค่าที่บันทึกไว้แล้ว (ถ้ามี) ไม่งั้นค่าตั้งต้น (วันนี้/หญ้าเทียม/รองเท้าสตั๊ด)
  conditions = {
    testDate: first?.testDate || todayBangkok(),
    surface: first?.surface || SURFACE_OPTIONS[0],
    footwear: first?.footwear || FOOTWEAR_OPTIONS[0]
  };
  dateInput.value = conditions.testDate;
  surfaceSelect.value = conditions.surface;
  footwearSelect.value = conditions.footwear;
}

// c = { team, coachId, coachName, ageGroups, isAdmin }
export async function openFitnessEntry(c) {
  ctx = c;
  statusEl.textContent = "";
  gridWrap.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  bannerEl.classList.add("hidden");
  controlsEl.classList.add("hidden");
  if (!ctx.team) {
    showMessage("ยังไม่ทราบทีมที่รับผิดชอบ");
    return;
  }
  try {
    const [roundSnap, playerSnap] = await Promise.all([
      getDocs(collection(db, "fitnessRounds")),
      getDocs(query(collection(db, "players"), where("team", "==", ctx.team)))
    ]);
    const rounds = [];
    roundSnap.forEach((d) => rounds.push({ id: d.id, ...d.data() }));
    round = currentEntryRound(rounds, todayBangkok());
    if (!round) {
      showMessage("ตอนนี้ไม่มีรอบทดสอบที่เปิดอยู่ — แอดมินเป็นผู้เปิดรอบทดสอบ");
      return;
    }
    pool = playerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const options = ageOptions();
    if (options.length === 0) {
      showMessage("ไม่มีรุ่นอายุที่ดูแล หรือยังไม่มีนักกีฬาในทีม");
      return;
    }
    ageSelect.innerHTML = options.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    ageGroup = options.includes(ageGroup) ? ageGroup : options[0];
    ageSelect.value = ageGroup;
    await loadRoundData();
    showBanner();
    controlsEl.classList.remove("hidden");
    saveStatusEl.textContent = "";
    renderGrid();
  } catch (err) {
    console.error(err);
    showMessage("โหลดไม่สำเร็จ: " + err.message);
  }
}

ageSelect.addEventListener("change", () => {
  ageGroup = ageSelect.value;
  renderGrid();
});
