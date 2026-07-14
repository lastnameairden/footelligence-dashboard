import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-init.js";
import {
  computeAvgScore,
  teamLogoImg,
  statCard,
  applyDataLabels,
  isTrainingPlanLate,
  TRAINING_PLAN_LATE_WARNING_THRESHOLD,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge
} from "./ui-utils.js";

const UNASSIGNED_AGE_GROUP = "ไม่ระบุรุ่นอายุ";

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const printContent = document.getElementById("print-content");
const printScopeLabel = document.getElementById("print-scope-label");
const printGeneratedAt = document.getElementById("print-generated-at");
const overviewCardsEl = document.getElementById("overview-cards");
const printTableBody = document.getElementById("print-table-body");
const printBtn = document.getElementById("print-btn");
const printMonthSelect = document.getElementById("print-month-select");
const printMonthLoadBtn = document.getElementById("print-month-load-btn");
const printTrainingPlanCards = document.getElementById("print-training-plan-cards");
const printTrainingPlanBody = document.getElementById("print-training-plan-body");
const printMatchCards = document.getElementById("print-match-cards");
const printMatchBody = document.getElementById("print-match-body");
const printInjuryCards = document.getElementById("print-injury-cards");
const printInjuryBody = document.getElementById("print-injury-body");

let currentPrintTeam = null;
let currentPrintAgeGroup = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "text-sm text-red-600 no-print" : "text-sm text-slate-500 no-print";
}

function showAccessGate(message) {
  accessGateMessage.textContent = message;
  accessGate.classList.remove("hidden");
  printContent.classList.add("hidden");
  setStatus("");
}

printBtn.addEventListener("click", () => window.print());

printMonthLoadBtn.addEventListener("click", () => {
  if (!currentPrintTeam || !printMonthSelect.value) return;
  // อัปเดต hash ใน URL ด้วยเพื่อให้ลิงก์ที่แชร์/บันทึกไว้ชี้ไปที่เดือนที่กำลังดูอยู่จริง
  window.location.hash = `team=${encodeURIComponent(currentPrintTeam)}&ageGroup=${encodeURIComponent(currentPrintAgeGroup)}&month=${encodeURIComponent(printMonthSelect.value)}`;
  loadPrintSummary(currentPrintTeam, currentPrintAgeGroup, printMonthSelect.value);
});

async function loadPrintSummary(team, ageGroup, month) {
  setStatus("กำลังโหลดข้อมูล...");
  currentPrintTeam = team;
  currentPrintAgeGroup = ageGroup;
  printMonthSelect.value = month;

  const playersSnap = await getDocs(query(collection(db, "players"), where("team", "==", team)));
  let players = [];
  playersSnap.forEach((d) => players.push({ id: d.id, ...d.data() }));
  if (ageGroup !== "__ALL__") {
    players = players.filter((p) => (p.ageGroup || UNASSIGNED_AGE_GROUP) === ageGroup);
  }
  players.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const attendanceSnap = await getDocs(query(collection(db, "attendance"), where("team", "==", team)));
  const attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));
  // จำกัดเฉพาะบันทึกของเดือนที่เลือก (สรุปนี้เป็นสรุปรายเดือน ไม่ใช่สรุปสะสมทั้งหมดเหมือนเดิมอีกต่อไป)
  const monthRecords = attendanceRecords.filter((r) => (r.date || "").startsWith(month));

  const playerIds = new Set(players.map((p) => p.id));
  const scopedRecords = monthRecords.filter((r) => playerIds.has(r.playerId));

  const statsByPlayer = new Map();
  for (const p of players) {
    statsByPlayer.set(p.id, { attended: 0, missed: 0, total: 0, scoreSum: 0, scoreCount: 0 });
  }
  for (const r of scopedRecords) {
    const stat = statsByPlayer.get(r.playerId);
    if (!stat) continue;
    stat.total += 1;
    if (r.status === "A") stat.attended += 1;
    else stat.missed += 1;
    const avgScore = computeAvgScore(r.scores);
    if (avgScore !== null) {
      stat.scoreSum += avgScore;
      stat.scoreCount += 1;
    }
  }

  const overall = { attended: 0, total: 0, scoreSum: 0, scoreCount: 0 };
  for (const s of statsByPlayer.values()) {
    overall.attended += s.attended;
    overall.total += s.total;
    overall.scoreSum += s.scoreSum;
    overall.scoreCount += s.scoreCount;
  }
  const overallPercent = overall.total > 0 ? Math.round((overall.attended / overall.total) * 100) : 0;
  const overallAvgScore = overall.scoreCount > 0 ? (overall.scoreSum / overall.scoreCount).toFixed(1) : "-";

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
  const scopeText =
    ageGroup === "__ALL__" ? `ทีม ${team} — ทุกรุ่นอายุ — เดือน${monthLabel}` : `ทีม ${team} — รุ่นอายุ ${ageGroup} — เดือน${monthLabel}`;
  printScopeLabel.innerHTML = `${teamLogoImg(team, "w-5 h-5 object-contain inline-block align-middle rounded mr-1")}${scopeText}`;
  printGeneratedAt.textContent = `สร้างสรุปเมื่อ ${new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })}`;
  document.title = `FOOTELLIGENCE DATA — สรุป ${scopeText}`;

  overviewCardsEl.innerHTML =
    statCard("จำนวนนักกีฬา", players.length) +
    statCard("% เข้าร่วมฝึกซ้อมรวม", `${overallPercent}%`) +
    statCard("คะแนนเฉลี่ยรวม", overallAvgScore);

  if (players.length === 0) {
    printTableBody.innerHTML =
      '<tr><td colspan="9" class="px-4 py-6 text-center text-slate-400">ไม่มีนักกีฬาในขอบเขตที่เลือก</td></tr>';
  } else {
    printTableBody.innerHTML = players
      .map((p) => {
        const s = statsByPlayer.get(p.id);
        const percent = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
        const avgScore = s.scoreCount > 0 ? (s.scoreSum / s.scoreCount).toFixed(1) : "-";
        return `
          <tr>
            <td>${p.number ?? "-"}</td>
            <td class="emphasis">${p.nickname ?? "-"}</td>
            <td>${p.fullName ?? "-"}</td>
            <td>${p.ageGroup ?? "-"}</td>
            <td>${s.total}</td>
            <td class="text-emerald-600 font-medium">${s.attended}</td>
            <td class="text-red-500 font-medium">${s.missed}</td>
            <td>${percent}%</td>
            <td>${avgScore}</td>
          </tr>`;
      })
      .join("");
  }

  await loadPrintExtras(team, ageGroup, month);

  setStatus(`โหลดข้อมูลสำเร็จ • ผู้เล่น ${players.length} คน`);
}

// สรุปแผนการฝึกซ้อม/ผลการแข่งขัน/อาการบาดเจ็บ ของทีม+เดือน+รุ่นอายุเดียวกับตารางผู้เล่นด้านบน — ให้สรุป
// สำหรับพิมพ์มีข้อมูลครบรูปแบบเดียวกับหน้า Dashboard
async function loadPrintExtras(team, ageGroup, month) {
  const [trainingPlanSnap, matchSnap, injurySnap] = await Promise.all([
    getDocs(query(collection(db, "trainingPlans"), where("team", "==", team))),
    getDocs(query(collection(db, "matchReports"), where("team", "==", team))),
    getDocs(query(collection(db, "injuryReports"), where("team", "==", team)))
  ]);

  // ---------- สรุปการส่งแผนการฝึกซ้อมรายวัน ----------
  let plans = [];
  trainingPlanSnap.forEach((d) => plans.push(d.data()));
  plans = plans.filter((p) => (p.date || "").startsWith(month));
  if (ageGroup !== "__ALL__") {
    plans = plans.filter((p) => (p.ageGroups || []).includes(ageGroup));
  }
  plans.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const lateCount = plans.filter((p) => isTrainingPlanLate(p)).length;
  const onTimeCount = plans.length - lateCount;
  printTrainingPlanCards.innerHTML =
    statCard("จำนวนแผนที่ส่ง", plans.length) +
    statCard("ตรงเวลา", onTimeCount) +
    statCard("สาย", lateCount) +
    statCard(
      "สถานะ",
      lateCount > TRAINING_PLAN_LATE_WARNING_THRESHOLD ? "⚠️ ต้องปรับปรุง" : "ปกติ"
    );

  if (plans.length === 0) {
    printTrainingPlanBody.innerHTML =
      '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400">ยังไม่มีการส่งแผนการฝึกซ้อมในเดือนนี้</td></tr>';
  } else {
    printTrainingPlanBody.innerHTML = plans
      .map((p) => {
        const lateBadge = isTrainingPlanLate(p)
          ? '<span class="badge badge-warning">⏱ เลท</span>'
          : '<span class="badge badge-success">✅ ตรงเวลา</span>';
        return `
          <tr>
            <td class="emphasis">${p.date ?? "-"}</td>
            <td>${p.trainingType ?? "-"}</td>
            <td>${p.mainPart ?? "-"}</td>
            <td>${lateBadge}</td>
          </tr>`;
      })
      .join("");
    applyDataLabels(printTrainingPlanBody);
  }

  // ---------- รายงานผลการแข่งขัน ----------
  let matches = [];
  matchSnap.forEach((d) => matches.push(d.data()));
  matches = matches.filter((m) => (m.date || "").startsWith(month));
  if (ageGroup !== "__ALL__") {
    matches = matches.filter((m) => m.ageGroup === ageGroup);
  }
  matches.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  printMatchCards.innerHTML =
    statCard("แข่งทั้งหมด", matches.length) +
    statCard("ชนะ", matches.filter((m) => m.result === "ชนะ").length) +
    statCard("แพ้", matches.filter((m) => m.result === "แพ้").length) +
    statCard("เสมอ", matches.filter((m) => m.result === "เสมอ").length);

  if (matches.length === 0) {
    printMatchBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายการแข่งขันในเดือนนี้</td></tr>';
  } else {
    printMatchBody.innerHTML = matches
      .map(
        (m) => `
        <tr>
          <td class="emphasis">${m.date ?? "-"}</td>
          <td>${m.opponent ?? "-"}</td>
          <td>${m.competitionType ?? "-"}</td>
          <td>${matchResultBadge(m.result)}</td>
          <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
          <td>${m.competition ?? "-"}</td>
        </tr>`
      )
      .join("");
    applyDataLabels(printMatchBody);
  }

  // ---------- รายงานอาการบาดเจ็บ ----------
  let injuries = [];
  injurySnap.forEach((d) => injuries.push(d.data()));
  injuries = injuries.filter((i) => (i.date || "").startsWith(month));
  if (ageGroup !== "__ALL__") {
    injuries = injuries.filter((i) => i.ageGroup === ageGroup);
  }
  injuries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  printInjuryCards.innerHTML =
    statCard("รายการทั้งหมด", injuries.length) +
    statCard("ยังไม่หาย", injuries.filter((i) => i.status !== "หายแล้ว").length) +
    statCard("หายแล้ว", injuries.filter((i) => i.status === "หายแล้ว").length) +
    statCard("รุนแรง", injuries.filter((i) => i.severity === "รุนแรง").length);

  if (injuries.length === 0) {
    printInjuryBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ไม่มีรายงานอาการบาดเจ็บในเดือนนี้</td></tr>';
  } else {
    printInjuryBody.innerHTML = injuries
      .map(
        (inj) => `
        <tr>
          <td class="emphasis">${inj.date ?? "-"}</td>
          <td class="emphasis">${inj.playerName ?? "-"}</td>
          <td>${inj.description ?? "-"}</td>
          <td>${injurySeverityBadge(inj.severity)}</td>
          <td>${injuryStatusBadge(inj.status)}</td>
          <td>${inj.expectedReturn ?? "-"}</td>
        </tr>`
      )
      .join("");
    applyDataLabels(printInjuryBody);
  }
}

onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  if (!isCoachSession) {
    showAccessGate("ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบก่อน จึงจะสร้างสรุปสำหรับพิมพ์ได้");
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved" || data.role !== "admin") {
      showAccessGate("หน้านี้ใช้ได้เฉพาะบัญชีผู้ดูแลระบบเท่านั้น");
      return;
    }

    // ใช้ URL hash (#team=...&ageGroup=...&month=...) แทน query string เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง
    // (serve, clean-url) จะ redirect "print.html" ไปเป็น "print" และตัด query string ทิ้งระหว่างทาง
    // แต่ไม่ตัด hash — ใช้ได้ทั้งในเครื่องและบน Vercel เหมือนกัน
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const team = params.get("team");
    const ageGroup = params.get("ageGroup") || "__ALL__";
    const month = params.get("month") || new Date().toISOString().slice(0, 7);

    if (!team) {
      showAccessGate("ไม่พบทีมที่ต้องการสรุป กรุณาเลือกทีมจากหน้าเช็คชื่ออีกครั้ง");
      return;
    }

    accessGate.classList.add("hidden");
    printContent.classList.remove("hidden");
    await loadPrintSummary(team, ageGroup, month);
  } catch (err) {
    console.error(err);
    setStatus("โหลดข้อมูลไม่สำเร็จ: " + err.message, true);
  }
});
