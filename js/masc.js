import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-init.js";
import { AGES, POS, SECT, SB, CRITERIA, SCORE_VALUES, categoryRawScore, scoreToGrade } from "./masc-data.js";
import { getCoachPlayerIds } from "./ui-utils.js";

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const mascContent = document.getElementById("masc-content");

const ageFilterSelect = document.getElementById("masc-age-filter-select");
const playerSelect = document.getElementById("masc-player-select");
const periodSelect = document.getElementById("masc-period-select");
const newBtn = document.getElementById("masc-new-btn");
const historyWrap = document.getElementById("masc-history-wrap");
const historyList = document.getElementById("masc-history-list");
const mascStatus = document.getElementById("masc-status");

const formWrap = document.getElementById("masc-form-wrap");
const posBadge = document.getElementById("masc-pos-badge");
const playerTitle = document.getElementById("masc-player-title");
const subTitle = document.getElementById("masc-sub-title");
const overallEl = document.getElementById("masc-overall");

const positionSelect = document.getElementById("masc-position-select");
const secondarySelect = document.getElementById("masc-secondary-select");
const ageSelect = document.getElementById("masc-age-select");
const pitchEl = document.getElementById("masc-pitch");
const footToggle = document.getElementById("masc-foot-toggle");
const heightInput = document.getElementById("masc-height");
const weightInput = document.getElementById("masc-weight");
const maturationToggle = document.getElementById("masc-maturation-toggle");
const schoolBehaviorEl = document.getElementById("masc-school-behavior");

const talentEl = document.getElementById("masc-talent");
const limitationsEl = document.getElementById("masc-limitations");
const observationsEl = document.getElementById("masc-observations");
const roleImportant = document.getElementById("masc-role-important");
const roleRotation = document.getElementById("masc-role-rotation");
const roleReserve = document.getElementById("masc-role-reserve");
const mascGridEl = document.getElementById("masc-grid");

const saveBtn = document.getElementById("masc-save-btn");
const printBtn = document.getElementById("masc-print-btn");
const deleteBtn = document.getElementById("masc-delete-btn");
const saveStatus = document.getElementById("masc-save-status");

// ---------- ตำแหน่งผู้เล่น (16 ตำแหน่งละเอียดจากฟอร์มเพิ่มนักกีฬา) -> ตำแหน่งกลุ่ม MASC (6 กลุ่ม) ----------
const POSITION_TO_MASC = {
  GK: "GK",
  CB: "CB",
  SW: "CB",
  RB: "FB/WB",
  LB: "FB/WB",
  RWB: "FB/WB",
  LWB: "FB/WB",
  CDM: "CM",
  CM: "CM",
  CAM: "CM",
  RM: "WG",
  LM: "WG",
  RW: "WG",
  LW: "WG",
  SS: "ST",
  CF: "ST",
  ST: "ST"
};

// รุ่นอายุของนักกีฬา (U6-U18) -> ช่วงวัยของ MASC (4 ช่วง)
function ageGroupToBracket(ageGroup) {
  const n = parseInt(String(ageGroup).replace(/\D/g, ""), 10);
  if (isNaN(n)) return "U9-12";
  if (n <= 8) return "U6-8";
  if (n <= 12) return "U9-12";
  if (n <= 14) return "U13-14";
  return "U15-18";
}

let myTeam = null;
let myCoachDoc = null;
let isReadOnly = false;
let players = [];
let currentPlayer = null;
let currentEvaluationId = null;
let evaluationsForPlayer = [];
let scores = { M: [null, null, null, null], A: [null, null, null, null], S: [null, null, null, null], C: [null, null, null, null] };
let sbScores = [null, null, null];
let curPosition = "CB";
let curAgeBracket = "U13-14";
let curFoot = null;
let curMaturation = null;
let curRoles = new Set();

function setStatus(message, isError = false) {
  mascStatus.textContent = message;
  mascStatus.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

// ---------- ตัวสร้าง UI ทั่วไป (segmented แบบเลือกได้ค่าเดียว หรือกดซ้ำเพื่อยกเลิกเลือก) ----------
// getActive/setActive เป็น getter/setter ของตัวแปรสถานะภายนอก เพื่อให้สลับ active class ได้โดยไม่ต้อง
// สร้าง DOM ใหม่ทั้งกลุ่มทุกครั้งที่คลิก (ต่างจากแบบเดิมที่ต้องพึ่งพาการ re-render เวียนตัวเอง)
function buildSegmented(container, options, getActive, setActive) {
  container.innerHTML = "";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt.label;
    btn.className = "segmented-btn" + (getActive() === opt.value ? " active" : "");
    btn.addEventListener("click", () => {
      const isActive = getActive() === opt.value;
      setActive(isActive ? null : opt.value);
      container.querySelectorAll(".segmented-btn").forEach((b) => b.classList.remove("active"));
      if (!isActive) btn.classList.add("active");
    });
    container.appendChild(btn);
  }
}

const FOOT_OPTIONS = [
  { value: "R", label: "ขวา R" },
  { value: "L", label: "ซ้าย L" },
  { value: "B", label: "สองเท้า B" }
];
const MATURATION_OPTIONS = [
  { value: "early", label: "โตเร็ว · Early" },
  { value: "on_time", label: "ตามเกณฑ์ · On-time" },
  { value: "late", label: "โตช้า · Late" }
];

// ---------- สนามหญ้า (SVG แสดงตำแหน่งที่กำลังประเมิน) ----------
function drawPitch() {
  const marks = POS[curPosition].marks;
  const W = 200,
    H = 150;
  const lab = curPosition.replace("/", "");
  let s = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="#E8F1E8" stroke="#7DAA7D" stroke-width="1.6"/>`;
  s += `<line x1="1" y1="${H / 2}" x2="${W - 1}" y2="${H / 2}" stroke="#7DAA7D" stroke-width="1.2"/>`;
  s += `<circle cx="${W / 2}" cy="${H / 2}" r="20" fill="none" stroke="#7DAA7D" stroke-width="1.2"/>`;
  const pbW = W * 0.5,
    pbH = H * 0.16,
    gW = W * 0.26,
    gH = H * 0.07;
  s += `<rect x="${(W - pbW) / 2}" y="0" width="${pbW}" height="${pbH}" fill="none" stroke="#7DAA7D" stroke-width="1.2"/>`;
  s += `<rect x="${(W - pbW) / 2}" y="${H - pbH}" width="${pbW}" height="${pbH}" fill="none" stroke="#7DAA7D" stroke-width="1.2"/>`;
  s += `<rect x="${(W - gW) / 2}" y="0" width="${gW}" height="${gH}" fill="none" stroke="#7DAA7D" stroke-width="1.2"/>`;
  s += `<rect x="${(W - gW) / 2}" y="${H - gH}" width="${gW}" height="${gH}" fill="none" stroke="#7DAA7D" stroke-width="1.2"/>`;
  marks.forEach(([mx, my]) => {
    const cx = mx * W,
      cy = my * H;
    s += `<circle cx="${cx}" cy="${cy}" r="13" fill="#0f172a" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${cx}" y="${cy}" fill="#fff" font-size="${lab.length > 2 ? 9 : 11}" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="Arial">${lab}</text>`;
  });
  pitchEl.innerHTML = s;
}

// ---------- คำนวณ/แสดงเกรด ----------
function refreshGrades() {
  let sum = 0,
    n = 0;
  ["M", "A", "S", "C"].forEach((cat) => {
    const raw = categoryRawScore(scores[cat]);
    const g = scoreToGrade(raw);
    const el = document.getElementById("masc-gv-" + cat);
    if (el) el.innerHTML = g == null ? "<b>–</b>" : `<b>${g}</b><i class="ml-1 text-slate-400 text-xs font-normal">${raw.toFixed(1)}</i>`;
    if (raw != null) {
      sum += raw;
      n++;
    }
  });
  overallEl.textContent = n === 4 ? `เกรด ${scoreToGrade(sum / 4)} · ค่าเฉลี่ย ${(sum / 4).toFixed(2)}` : "–";
}

// ---------- ตารางประเมิน MASC (4 หมวด x 4 ข้อ) ----------
function renderMascGrid() {
  mascGridEl.innerHTML = "";
  const cats = ["M", "A", "S", "C"];
  cats.forEach((cat) => {
    const items = CRITERIA[curPosition][curAgeBracket][cat];
    const sc = SECT[cat];
    const cell = document.createElement("div");
    cell.className = "border border-slate-200 rounded-lg overflow-hidden";
    let h = `
      <div class="flex items-center gap-2 bg-amber-50 px-3 py-2">
        <div class="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">${sc.nm[0]}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm text-slate-900">${sc.nm} <span class="font-normal text-xs text-slate-500">${sc.th}</span></p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-[10px] font-semibold text-slate-500">GRADE</p>
          <div id="masc-gv-${cat}" class="border border-slate-300 rounded bg-white px-2 py-0.5 text-sm">–</div>
        </div>
      </div>
      <div class="p-1.5 space-y-1">`;
    items.forEach((it, i) => {
      const isCore = i === 0;
      h += `
        <div class="masc-row ${isCore ? "core" : ""}">
          <span class="text-[9px] font-bold rounded px-1.5 py-0.5 flex-shrink-0 ${isCore ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}">${isCore ? "CORE 40%" : "SUP 20%"}</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-slate-900 leading-tight">${it[0]}</p>
            <p class="text-[10px] text-slate-400 italic leading-tight">${it[1]}</p>
          </div>
          <div class="flex gap-1 flex-shrink-0" data-cat="${cat}" data-idx="${i}"></div>
        </div>`;
    });
    h += `</div>`;
    cell.innerHTML = h;
    mascGridEl.appendChild(cell);
  });

  mascGridEl.querySelectorAll("[data-cat]").forEach((wrap) => {
    const cat = wrap.dataset.cat;
    const idx = Number(wrap.dataset.idx);
    SCORE_VALUES.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bub" + (scores[cat][idx] === v ? " on" : "");
      btn.textContent = String(v);
      btn.addEventListener("click", () => {
        const cur = scores[cat][idx];
        scores[cat][idx] = cur === v ? null : v;
        wrap.querySelectorAll(".bub").forEach((b) => b.classList.remove("on"));
        if (scores[cat][idx] === v) btn.classList.add("on");
        refreshGrades();
      });
      wrap.appendChild(btn);
    });
  });
  refreshGrades();
}

// ---------- พฤติกรรมในโรงเรียน ----------
function renderSchoolBehavior() {
  schoolBehaviorEl.innerHTML = "";
  SB.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2";
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold leading-tight">${it[0]}</p>
        <p class="text-[10px] text-slate-400 italic leading-tight">${it[1]}</p>
      </div>
      <div class="flex gap-1 flex-shrink-0"></div>`;
    const bubWrap = row.querySelector("div:last-child");
    SCORE_VALUES.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bub" + (sbScores[i] === v ? " on" : "");
      btn.textContent = String(v);
      btn.addEventListener("click", () => {
        const cur = sbScores[i];
        sbScores[i] = cur === v ? null : v;
        bubWrap.querySelectorAll(".bub").forEach((b) => b.classList.remove("on"));
        if (sbScores[i] === v) btn.classList.add("on");
      });
      bubWrap.appendChild(btn);
    });
    schoolBehaviorEl.appendChild(row);
  });
}

function renderPositionSelectors() {
  positionSelect.innerHTML = Object.keys(POS)
    .map((p) => `<option value="${p}" ${p === curPosition ? "selected" : ""}>${p} · ${POS[p].th}</option>`)
    .join("");
  secondarySelect.innerHTML =
    '<option value="">— ไม่ระบุ —</option>' +
    Object.keys(POS)
      .map((p) => `<option value="${p}">${p} · ${POS[p].th}</option>`)
      .join("");
  ageSelect.innerHTML = Object.keys(AGES)
    .map((a) => `<option value="${a}" ${a === curAgeBracket ? "selected" : ""}>${a} · ${AGES[a].en}</option>`)
    .join("");
}

// ---------- วาดฟอร์มทั้งหมดใหม่ตามตำแหน่ง/ช่วงวัยปัจจุบัน ----------
function renderForm() {
  const p = POS[curPosition];
  posBadge.textContent = curPosition;
  subTitle.textContent = `${p.th} (${p.en}) · ${curAgeBracket} · ${AGES[curAgeBracket].th}`;
  positionSelect.value = curPosition;
  ageSelect.value = curAgeBracket;
  drawPitch();
  renderMascGrid();
}

// ---------- โหลดรายชื่อนักกีฬาของทีม (กรองตามรุ่นอายุ/ตำแหน่งของโค้ชคนนี้ ถ้าเป็นโค้ชจริง) ----------
// เรียงรุ่นอายุจากน้อยไปมากตามตัวเลขในชื่อ (เช่น "U9" < "U10")
function ageGroupNumber(ageGroup) {
  const n = parseInt(String(ageGroup).replace(/\D/g, ""), 10);
  return isNaN(n) ? Infinity : n;
}

// แสดงตัวเลือกนักกีฬาเฉพาะรุ่นอายุที่เลือกอยู่เท่านั้น (ไม่รวมทุกรุ่นไว้ในลิสต์เดียวกัน เพราะโค้ชบางตำแหน่ง
// เช่น GK Coach/Fitness Coach ดูแลได้หลายรุ่นพร้อมกัน รายชื่อจะยาวปนกันจนหาคนที่ต้องการยาก)
function renderPlayerOptions(ageGroup) {
  const filtered = ageGroup ? players.filter((p) => p.ageGroup === ageGroup) : players;
  playerSelect.innerHTML =
    '<option value="">-- เลือกนักกีฬา --</option>' + filtered.map((p) => `<option value="${p.id}">${p.nickname || p.fullName || "-"}</option>`).join("");
}

async function loadPlayers() {
  const snap = await getDocs(query(collection(db, "players"), where("team", "==", myTeam)));
  const allPlayers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // จำกัดเฉพาะนักกีฬาที่โค้ชคนนี้รับผิดชอบจริง (ตามรุ่นอายุ+ตำแหน่งของโค้ช) — ผู้ดูแลระบบที่จัดการทีมแบบกว้าง
  // (ไม่ได้เจาะจงเป็นโค้ชคนใดคนหนึ่ง) ยังเห็นนักกีฬาทุกรุ่นของทีมเหมือนเดิม
  players = myCoachDoc && myCoachDoc.role === "coach" ? allPlayers.filter((p) => getCoachPlayerIds(myCoachDoc, allPlayers).has(p.id)) : allPlayers;
  players.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || ""));

  const ageGroups = Array.from(new Set(players.map((p) => p.ageGroup).filter(Boolean))).sort((a, b) => ageGroupNumber(a) - ageGroupNumber(b));
  ageFilterSelect.innerHTML = ageGroups.map((ag) => `<option value="${ag}">${ag}</option>`).join("");
  renderPlayerOptions(ageGroups[0] || "");
}

// ---------- ประวัติการประเมินของนักกีฬาที่เลือก ----------
async function loadHistoryForPlayer(playerId) {
  const snap = await getDocs(query(collection(db, "playerEvaluations"), where("playerId", "==", playerId)));
  evaluationsForPlayer = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  evaluationsForPlayer.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
    const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
    return tb - ta;
  });
  if (evaluationsForPlayer.length === 0) {
    historyWrap.classList.add("hidden");
    return;
  }
  historyWrap.classList.remove("hidden");
  historyList.innerHTML = "";
  evaluationsForPlayer.forEach((ev) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary btn-sm";
    const dateText = ev.createdAt && ev.createdAt.toDate ? ev.createdAt.toDate().toLocaleDateString("th-TH") : "-";
    btn.textContent = `${ev.assessmentPeriod || "-"} · ${ev.position || "-"} · ${dateText}`;
    btn.addEventListener("click", () => loadEvaluationIntoForm(ev));
    historyList.appendChild(btn);
  });
}

function resetFormFields() {
  scores = { M: [null, null, null, null], A: [null, null, null, null], S: [null, null, null, null], C: [null, null, null, null] };
  sbScores = [null, null, null];
  curFoot = null;
  curMaturation = null;
  curRoles = new Set();
  talentEl.value = "";
  limitationsEl.value = "";
  observationsEl.value = "";
  heightInput.value = "";
  weightInput.value = "";
  secondarySelect.value = "";
  roleImportant.checked = false;
  roleRotation.checked = false;
  roleReserve.checked = false;
  buildSegmented(footToggle, FOOT_OPTIONS, () => curFoot, (v) => { curFoot = v; });
  buildSegmented(maturationToggle, MATURATION_OPTIONS, () => curMaturation, (v) => { curMaturation = v; });
  renderSchoolBehavior();
}

function startNewEvaluationForCurrentPlayer() {
  if (!currentPlayer) return;
  currentEvaluationId = null;
  deleteBtn.classList.add("hidden");
  curPosition = POSITION_TO_MASC[currentPlayer.position] || "CB";
  curAgeBracket = ageGroupToBracket(currentPlayer.ageGroup);
  playerTitle.textContent = currentPlayer.nickname || currentPlayer.fullName || "-";
  resetFormFields();
  renderPositionSelectors();
  renderForm();
  formWrap.classList.remove("hidden");
  setStatus("กำลังสร้างการประเมินรอบใหม่ — เลือกช่วงที่ประเมินด้านบนแล้วให้คะแนนแต่ละข้อ");
}

function loadEvaluationIntoForm(ev) {
  currentEvaluationId = ev.id;
  deleteBtn.classList.toggle("hidden", isReadOnly);
  curPosition = ev.position || "CB";
  curAgeBracket = ev.ageBracket || "U13-14";
  playerTitle.textContent = currentPlayer.nickname || currentPlayer.fullName || "-";
  scores = ev.scores || { M: [null, null, null, null], A: [null, null, null, null], S: [null, null, null, null], C: [null, null, null, null] };
  sbScores = ev.schoolBehavior || [null, null, null];
  curFoot = ev.foot || null;
  curMaturation = ev.maturation || null;
  curRoles = new Set(ev.playerRoles || []);
  talentEl.value = ev.talent || "";
  limitationsEl.value = ev.limitations || "";
  observationsEl.value = ev.observations || "";
  heightInput.value = ev.height || "";
  weightInput.value = ev.weight || "";
  secondarySelect.value = ev.secondaryPosition || "";
  periodSelect.value = ev.assessmentPeriod || "";
  roleImportant.checked = curRoles.has("important");
  roleRotation.checked = curRoles.has("rotation");
  roleReserve.checked = curRoles.has("reserve");
  // renderSchoolBehavior()/renderMascGrid() (เรียกผ่าน renderForm ด้านล่าง) อ่านค่าจาก sbScores/scores ที่
  // ตั้งไว้ข้างบนนี้อยู่แล้วตอนสร้างปุ่มแต่ละอัน จึงไม่ต้องมาไล่แปะสถานะ .on ย้อนหลังซ้ำอีกรอบ
  buildSegmented(footToggle, FOOT_OPTIONS, () => curFoot, (v) => { curFoot = v; });
  buildSegmented(maturationToggle, MATURATION_OPTIONS, () => curMaturation, (v) => { curMaturation = v; });
  renderSchoolBehavior();
  renderPositionSelectors();
  renderForm();
  formWrap.classList.remove("hidden");
  setStatus(`กำลังดู/แก้ไขการประเมิน ${ev.assessmentPeriod || "-"} ที่บันทึกไว้`);
}

// ---------- บันทึก/ลบ ----------
function collectPayload() {
  curRoles = new Set();
  if (roleImportant.checked) curRoles.add("important");
  if (roleRotation.checked) curRoles.add("rotation");
  if (roleReserve.checked) curRoles.add("reserve");
  return {
    playerId: currentPlayer.id,
    playerName: currentPlayer.nickname || currentPlayer.fullName || "-",
    team: myTeam,
    ageGroup: currentPlayer.ageGroup || null,
    position: curPosition,
    ageBracket: curAgeBracket,
    secondaryPosition: secondarySelect.value || null,
    assessmentPeriod: periodSelect.value || null,
    foot: curFoot,
    height: heightInput.value ? Number(heightInput.value) : null,
    weight: weightInput.value ? Number(weightInput.value) : null,
    maturation: curMaturation,
    talent: talentEl.value.trim(),
    limitations: limitationsEl.value.trim(),
    observations: observationsEl.value.trim(),
    playerRoles: Array.from(curRoles),
    scores,
    schoolBehavior: sbScores,
    coachName: myCoachDoc?.name || auth.currentUser?.email || "-",
    updatedAt: serverTimestamp()
  };
}

saveBtn.addEventListener("click", async () => {
  if (!currentPlayer) return;
  saveStatus.textContent = "กำลังบันทึก...";
  saveStatus.className = "text-sm text-slate-500";
  try {
    const payload = collectPayload();
    if (currentEvaluationId) {
      await updateDoc(doc(db, "playerEvaluations", currentEvaluationId), payload);
    } else {
      payload.createdAt = serverTimestamp();
      const newDoc = await addDoc(collection(db, "playerEvaluations"), payload);
      currentEvaluationId = newDoc.id;
      deleteBtn.classList.remove("hidden");
    }
    saveStatus.textContent = "บันทึกสำเร็จ ✓";
    saveStatus.className = "text-sm text-emerald-600";
    await loadHistoryForPlayer(currentPlayer.id);
  } catch (err) {
    console.error(err);
    saveStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    saveStatus.className = "text-sm text-red-600";
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!currentEvaluationId) return;
  if (!confirm("ยืนยันลบการประเมินนี้? การลบนี้ไม่สามารถย้อนกลับได้")) return;
  try {
    await deleteDoc(doc(db, "playerEvaluations", currentEvaluationId));
    await loadHistoryForPlayer(currentPlayer.id);
    startNewEvaluationForCurrentPlayer();
    setStatus("ลบการประเมินแล้ว");
  } catch (err) {
    console.error(err);
    alert("ลบไม่สำเร็จ: " + err.message);
  }
});

printBtn.addEventListener("click", () => window.print());

// ---------- event wiring ----------
positionSelect.addEventListener("change", () => {
  curPosition = positionSelect.value;
  renderForm();
});
ageSelect.addEventListener("change", () => {
  curAgeBracket = ageSelect.value;
  renderForm();
});

ageFilterSelect.addEventListener("change", () => {
  renderPlayerOptions(ageFilterSelect.value);
  playerSelect.value = "";
  playerSelect.dispatchEvent(new Event("change"));
});

playerSelect.addEventListener("change", async () => {
  const id = playerSelect.value;
  formWrap.classList.add("hidden");
  historyWrap.classList.add("hidden");
  if (!id) {
    currentPlayer = null;
    periodSelect.disabled = true;
    newBtn.disabled = true;
    return;
  }
  currentPlayer = players.find((p) => p.id === id);
  periodSelect.disabled = false;
  newBtn.disabled = false;
  setStatus("กำลังโหลดประวัติการประเมิน...");
  await loadHistoryForPlayer(id);
  setStatus(evaluationsForPlayer.length > 0 ? `พบการประเมิน ${evaluationsForPlayer.length} รอบก่อนหน้า — คลิกเพื่อดู หรือกด "+ ประเมินรอบใหม่"` : "ยังไม่มีการประเมินของนักกีฬาคนนี้ — กด \"+ ประเมินรอบใหม่\" เพื่อเริ่ม");
});

newBtn.addEventListener("click", startNewEvaluationForCurrentPlayer);

// ---------- ล็อกอิน / สิทธิ์การเข้าถึง ----------
onAuthStateChanged(auth, async (user) => {
  if (!user || user.isAnonymous) {
    statusEl.textContent = "";
    accessGate.classList.remove("hidden");
    accessGateMessage.textContent = "ต้องเข้าสู่ระบบด้วยบัญชีที่มีทีมก่อน จึงจะสร้างการประเมิน MASC ได้";
    mascContent.classList.add("hidden");
    return;
  }
  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;
    if (!data || data.status !== "approved") {
      accessGate.classList.remove("hidden");
      accessGateMessage.textContent = "บัญชีนี้ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ";
      mascContent.classList.add("hidden");
      return;
    }

    if (data.role === "admin") {
      const teamParam = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("team");
      if (!teamParam) {
        accessGate.classList.remove("hidden");
        accessGateMessage.innerHTML = 'ผู้ดูแลระบบต้องระบุทีมก่อน — เข้าผ่านลิงก์ <code>masc.html#team=ชื่อทีม</code> จากหน้ารายชื่อโค้ช';
        mascContent.classList.add("hidden");
        return;
      }
      myTeam = teamParam;
      myCoachDoc = { role: "admin", name: data.name || user.email, team: teamParam };
      isReadOnly = false;
    } else if (data.role === "executive") {
      myTeam = data.team;
      myCoachDoc = data;
      isReadOnly = true;
    } else {
      myTeam = data.team;
      myCoachDoc = data;
      isReadOnly = false;
    }

    if (!myTeam) {
      accessGate.classList.remove("hidden");
      accessGateMessage.textContent = "บัญชีนี้ยังไม่ได้รับมอบหมายทีม กรุณาติดต่อผู้ดูแลระบบ";
      mascContent.classList.add("hidden");
      return;
    }

    accessGate.classList.add("hidden");
    mascContent.classList.remove("hidden");
    statusEl.textContent = "";
    saveBtn.classList.toggle("hidden", isReadOnly);
    printBtn.classList.remove("hidden");
    if (isReadOnly) setStatus("บัญชีนี้ดูข้อมูลได้อย่างเดียว (ผู้บริหารทีม) ไม่สามารถบันทึกการประเมินได้");

    await loadPlayers();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
});
