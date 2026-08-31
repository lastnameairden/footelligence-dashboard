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
  teamLogoImg,
  statCard,
  applyDataLabels,
  isTrainingPlanLate,
  TRAINING_PLAN_LATE_WARNING_THRESHOLD,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  ageGroupSortKey
} from "./ui-utils.js";

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const printContent = document.getElementById("print-content");
const printScopeLabel = document.getElementById("print-scope-label");
const printGeneratedAt = document.getElementById("print-generated-at");
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

// สรุปนี้เดิมมีตารางรายชื่อนักกีฬา+สถิติการเข้าซ้อมรายบุคคลด้วย แต่ผู้ใช้แจ้งให้ตัดออก เพราะหน้านี้ตั้งใจให้เป็น
// สรุป "การทำงานของโค้ช" (ส่งแผนการฝึกซ้อม/รายงานผลการแข่งขัน ตรงเวลาหรือไม่) และ "รายชื่อนักกีฬาที่บาดเจ็บ"
// เท่านั้น ไม่ใช่สรุปข้อมูลรายบุคคลของนักกีฬาทุกคน — ดู loadPrintExtras() ด้านล่างสำหรับ 3 หัวข้อที่เหลือ
async function loadPrintSummary(team, ageGroup, month) {
  setStatus("กำลังโหลดข้อมูล...");
  currentPrintTeam = team;
  currentPrintAgeGroup = ageGroup;
  printMonthSelect.value = month;

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
  const scopeText =
    ageGroup === "__ALL__" ? `ทีม ${team} — ทุกรุ่นอายุ — เดือน${monthLabel}` : `ทีม ${team} — รุ่นอายุ ${ageGroup} — เดือน${monthLabel}`;
  printScopeLabel.innerHTML = `${teamLogoImg(team, "w-5 h-5 object-contain inline-block align-middle rounded mr-1")}${scopeText}`;
  printGeneratedAt.textContent = `สร้างสรุปเมื่อ ${new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })}`;
  document.title = `FOOTELLIGENCE DATA — สรุป ${scopeText}`;

  await loadPrintExtras(team, ageGroup, month);

  setStatus("โหลดข้อมูลสำเร็จ");
}

// สรุปแผนการฝึกซ้อม/ผลการแข่งขัน/อาการบาดเจ็บ ของทีม+เดือน+รุ่นอายุเดียวกับตารางผู้เล่นด้านบน — ให้สรุป
// สำหรับพิมพ์มีข้อมูลครบรูปแบบเดียวกับหน้า Dashboard
async function loadPrintExtras(team, ageGroup, month) {
  const [trainingPlanSnap, matchSnap, injurySnap, coachSnap] = await Promise.all([
    getDocs(query(collection(db, "trainingPlans"), where("team", "==", team))),
    getDocs(query(collection(db, "matchReports"), where("team", "==", team))),
    getDocs(query(collection(db, "injuryReports"), where("team", "==", team))),
    getDocs(query(collection(db, "coaches"), where("team", "==", team), where("role", "==", "coach")))
  ]);

  // ---------- สรุปการส่งแผนการฝึกซ้อมรายวัน แยกรายโค้ช (ตรงเวลา/สาย/ทั้งหมด/% ตรงเวลา) ----------
  // จับคู่แผนกับโค้ชด้วยชื่อ (coachName) ไม่ใช่ coachId เพราะถ้าผู้ดูแลระบบสวมบทบาทส่งแทนโค้ช coachId จะกลายเป็น
  // uid ของผู้ดูแลระบบเอง (หลักการเดียวกับ computeCoachMonthlySummaryRows ในหน้า attendance.html)
  let plans = [];
  trainingPlanSnap.forEach((d) => plans.push(d.data()));
  plans = plans.filter((p) => (p.date || "").startsWith(month));
  if (ageGroup !== "__ALL__") {
    plans = plans.filter((p) => (p.ageGroups || []).includes(ageGroup));
  }

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

  let coaches = [];
  coachSnap.forEach((d) => coaches.push({ id: d.id, ...d.data() }));
  if (ageGroup !== "__ALL__") {
    coaches = coaches.filter((c) => (c.ageGroups || []).includes(ageGroup));
  }
  coaches.sort(
    (a, b) => ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups) || (a.name ?? "").localeCompare(b.name ?? "")
  );

  const coachRows = coaches.map((c) => {
    const myPlans = plans.filter((p) => p.coachName === c.name);
    const late = myPlans.filter((p) => isTrainingPlanLate(p)).length;
    const total = myPlans.length;
    const onTime = total - late;
    const onTimePercent = total > 0 ? Math.round((onTime / total) * 100) : null;
    return { coach: c, total, onTime, late, onTimePercent };
  });

  if (coachRows.length === 0) {
    printTrainingPlanBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printTrainingPlanBody.innerHTML = coachRows
      .map(({ coach, total, onTime, late, onTimePercent }) => {
        const percentText = onTimePercent === null ? "-" : `${onTimePercent}%`;
        const percentBadgeClass = onTimePercent === null ? "badge-neutral" : onTimePercent >= 80 ? "badge-success" : onTimePercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${coach.name ?? "-"}</td>
            <td class="text-emerald-600 font-medium">${onTime}</td>
            <td class="text-red-500 font-medium">${late}</td>
            <td>${total}</td>
            <td><span class="badge ${percentBadgeClass}">${percentText}</span></td>
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
