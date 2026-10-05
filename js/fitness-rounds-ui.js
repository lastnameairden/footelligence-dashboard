// หน้าแอดมิน "รอบทดสอบสมรรถภาพ": เปิดรอบ (Baseline/Monitoring/Re-evaluation/Final, Full/Selective, วันเปิด-ปิด, รายการที่ใช้) และปิด/เปิดรอบ
// ตรรกะล้วนอยู่ที่ fitness-calc.js — โค้ชกรอกผลเฉพาะรอบที่เปิดอยู่ (กฎ Firestore บังคับช่วงวันที่ที่ฝั่งเซิร์ฟเวอร์ด้วย)
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, auth } from "./firebase-init.js";
import { escapeHtml, todayBangkok } from "./ui-utils.js";
import {
  FITNESS_TESTS,
  MAKEUP_DAYS,
  ROUND_MODES,
  ROUND_TYPES,
  ROUND_TYPE_BY_KEY,
  addDays,
  bestSeasonFor,
  datesFromOpen,
  defaultRoundDates,
  defaultTestCodes,
  roundLabel,
  roundState,
  seasonLabelFor,
  thaiDateShort,
  validateRoundForm
} from "./fitness-calc.js";

const seasonSelect = document.getElementById("fitness-round-season");
const typeSelect = document.getElementById("fitness-round-type");
const modeWrap = document.getElementById("fitness-round-mode");
const openInput = document.getElementById("fitness-round-open");
const closeInput = document.getElementById("fitness-round-close");
const makeupEl = document.getElementById("fitness-round-makeup");
const testsWrap = document.getElementById("fitness-round-tests");
const submitBtn = document.getElementById("fitness-round-submit");
const statusEl = document.getElementById("fitness-round-status");
const listBody = document.getElementById("fitness-round-list-body");

let mode = "full";
let selectedCodes = new Set(defaultTestCodes("full"));
let rounds = [];
let initialized = false;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

// ปีการศึกษาที่เลือกได้: ปีปัจจุบัน และสองปีถัดไป (ปีการศึกษาเริ่ม พ.ค.)
function initSeasonOptions() {
  const today = todayBangkok();
  const [y, m] = today.split("-").map(Number);
  const current = m >= 5 ? y : y - 1;
  seasonSelect.innerHTML = [current, current + 1, current + 2]
    .map((yr) => `<option value="${seasonLabelFor(yr)}">${seasonLabelFor(yr)}</option>`)
    .join("");
  typeSelect.innerHTML = ROUND_TYPES.map((t) => `<option value="${t.key}">${t.label} (${t.hint})</option>`).join("");
}

function renderModeButtons() {
  modeWrap.innerHTML = "";
  for (const m of ROUND_MODES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = m.label;
    btn.className = "segmented-btn" + (m.key === mode ? " active" : "");
    btn.addEventListener("click", () => {
      mode = m.key;
      selectedCodes = new Set(defaultTestCodes(mode)); // เปลี่ยนรูปแบบ = ติ๊กรายการให้ตามรูปแบบใหม่ (แก้เองได้ต่อ)
      renderModeButtons();
      renderTestChips();
    });
    modeWrap.appendChild(btn);
  }
}

function renderTestChips() {
  testsWrap.innerHTML = "";
  for (const t of FITNESS_TESTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-toggle" + (selectedCodes.has(t.code) ? " active" : "");
    btn.textContent = `${t.label} (U${t.minAge}–U${t.maxAge})`;
    btn.addEventListener("click", () => {
      if (selectedCodes.has(t.code)) selectedCodes.delete(t.code);
      else selectedCodes.add(t.code);
      renderTestChips();
    });
    testsWrap.appendChild(btn);
  }
}

function updateMakeupText() {
  makeupEl.textContent = closeInput.value
    ? `ทดสอบซ่อมได้ถึง ${thaiDateShort(addDays(closeInput.value, MAKEUP_DAYS))} (วันปิดรอบ + ${MAKEUP_DAYS} วัน คำนวณให้เอง)`
    : "";
}

// เลือกปีการศึกษา/รอบ → ตั้งวันเปิด-ปิด และรูปแบบตั้งต้นตามรอบนั้น (แก้ต่อได้)
function applyDefaults() {
  const dates = defaultRoundDates(typeSelect.value, seasonSelect.value);
  if (!dates) return;
  openInput.value = dates.openDate;
  closeInput.value = dates.closeDate;
  mode = ROUND_TYPE_BY_KEY[typeSelect.value].defaultMode;
  selectedCodes = new Set(defaultTestCodes(mode));
  renderModeButtons();
  renderTestChips();
  updateMakeupText();
}

seasonSelect.addEventListener("change", applyDefaults);
// เปลี่ยนรอบ → เลือกปีการศึกษาที่รอบนั้นยังไม่พ้นให้ก่อน (เช่น Baseline ช่วง ต.ค. 2026 → 2027/28) แล้วตั้งวันที่ตามนั้น
typeSelect.addEventListener("change", () => {
  seasonSelect.value = bestSeasonFor(typeSelect.value, todayBangkok());
  applyDefaults();
});
openInput.addEventListener("change", () => {
  if (openInput.value) closeInput.value = datesFromOpen(openInput.value).closeDate;
  updateMakeupText();
});
closeInput.addEventListener("change", updateMakeupText);

submitBtn.addEventListener("click", async () => {
  const form = {
    season: seasonSelect.value,
    roundType: typeSelect.value,
    mode,
    openDate: openInput.value,
    closeDate: closeInput.value,
    testCodes: FITNESS_TESTS.filter((t) => selectedCodes.has(t.code)).map((t) => t.code)
  };
  const problem = validateRoundForm(form, rounds);
  if (problem) {
    setStatus(problem, true);
    return;
  }
  submitBtn.disabled = true;
  try {
    setStatus("กำลังเปิดรอบ...");
    await addDoc(collection(db, "fitnessRounds"), {
      ...form,
      makeupUntil: addDays(form.closeDate, MAKEUP_DAYS),
      status: "open",
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    setStatus("เปิดรอบทดสอบแล้ว ✓");
    await loadRounds();
  } catch (err) {
    console.error(err);
    setStatus("เปิดรอบไม่สำเร็จ: " + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

const STATE_BADGE = {
  open: ["badge-success", "เปิดอยู่"],
  makeup: ["badge-warning", "ช่วงทดสอบซ่อม"],
  upcoming: ["badge-warning", "ยังไม่ถึงวันเปิด"],
  closed: ["badge-neutral", "ปิดแล้ว"]
};

function renderList() {
  if (rounds.length === 0) {
    listBody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ยังไม่เคยเปิดรอบทดสอบ</td></tr>';
    return;
  }
  const today = todayBangkok();
  listBody.innerHTML = rounds
    .map((r) => {
      const state = roundState(r, today);
      const [cls, text] = STATE_BADGE[state];
      const modeLabel = ROUND_MODES.find((m) => m.key === r.mode)?.label ?? r.mode;
      const manualClosed = r.status === "closed";
      let action = "";
      if (!manualClosed && state !== "closed") {
        action = `<button type="button" class="btn btn-secondary btn-sm" data-close-round="${escapeHtml(r.id)}">ปิดรอบ</button>`;
      } else if (manualClosed && today <= r.makeupUntil) {
        action = `<button type="button" class="btn btn-secondary btn-sm" data-reopen-round="${escapeHtml(r.id)}">เปิดอีกครั้ง</button>`;
      }
      return `
        <tr>
          <td class="emphasis">${escapeHtml(roundLabel(r))}<div class="text-xs text-slate-400">ปีการศึกษา ${escapeHtml(r.season)}</div></td>
          <td>${escapeHtml(modeLabel)}<div class="text-xs text-slate-400">${(r.testCodes || []).length} รายการ</div></td>
          <td>${thaiDateShort(r.openDate)} – ${thaiDateShort(r.closeDate)}</td>
          <td>${thaiDateShort(r.makeupUntil)}</td>
          <td><span class="badge ${cls}">${manualClosed && state === "closed" ? "ปิดโดยแอดมิน" : text}</span></td>
          <td>${action}</td>
        </tr>`;
    })
    .join("");
}

listBody.addEventListener("click", async (e) => {
  const closeBtn = e.target.closest("[data-close-round]");
  const reopenBtn = e.target.closest("[data-reopen-round]");
  const btn = closeBtn || reopenBtn;
  if (!btn) return;
  const id = btn.dataset.closeRound || btn.dataset.reopenRound;
  const round = rounds.find((r) => r.id === id);
  if (!round) return;
  if (closeBtn && !confirm(`ปิดรอบ "${roundLabel(round)}" ตอนนี้? โค้ชจะกรอกหรือแก้ผลของรอบนี้ไม่ได้อีก (เปิดอีกครั้งได้ถ้ายังไม่พ้นช่วงทดสอบซ่อม)`)) return;
  btn.disabled = true;
  try {
    await updateDoc(doc(db, "fitnessRounds", id), { status: closeBtn ? "closed" : "open", updatedAt: serverTimestamp() });
    await loadRounds();
  } catch (err) {
    console.error(err);
    setStatus("อัปเดตรอบไม่สำเร็จ: " + err.message, true);
    btn.disabled = false;
  }
});

async function loadRounds() {
  listBody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  try {
    const snap = await getDocs(collection(db, "fitnessRounds"));
    rounds = [];
    snap.forEach((d) => rounds.push({ id: d.id, ...d.data() }));
    rounds.sort((a, b) => (b.openDate || "").localeCompare(a.openDate || ""));
    renderList();
  } catch (err) {
    console.error(err);
    listBody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-red-600">โหลดรอบทดสอบไม่สำเร็จ: ${escapeHtml(err.message)}</td></tr>`;
  }
}

export function openAdminFitnessRounds() {
  if (!initialized) {
    initialized = true;
    initSeasonOptions();
    seasonSelect.value = bestSeasonFor(typeSelect.value, todayBangkok());
    applyDefaults();
  }
  setStatus("");
  return loadRounds();
}
