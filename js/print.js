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
import { computeAvgScore, teamLogoImg } from "./ui-utils.js";

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

function statCard(label, value) {
  return `
    <div class="stat-card">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
    </div>
  `;
}

printBtn.addEventListener("click", () => window.print());

async function loadPrintSummary(team, ageGroup) {
  setStatus("กำลังโหลดข้อมูล...");

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

  const playerIds = new Set(players.map((p) => p.id));
  const scopedRecords = attendanceRecords.filter((r) => playerIds.has(r.playerId));

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

  const scopeText = ageGroup === "__ALL__" ? `ทีม ${team} — ทุกรุ่นอายุ` : `ทีม ${team} — รุ่นอายุ ${ageGroup}`;
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

  setStatus(`โหลดข้อมูลสำเร็จ • ผู้เล่น ${players.length} คน`);
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

    const params = new URLSearchParams(window.location.search);
    const team = params.get("team");
    const ageGroup = params.get("ageGroup") || "__ALL__";

    if (!team) {
      showAccessGate("ไม่พบทีมที่ต้องการสรุป กรุณาเลือกทีมจากหน้าเช็คชื่ออีกครั้ง");
      return;
    }

    accessGate.classList.add("hidden");
    printContent.classList.remove("hidden");
    await loadPrintSummary(team, ageGroup);
  } catch (err) {
    console.error(err);
    setStatus("โหลดข้อมูลไม่สำเร็จ: " + err.message, true);
  }
});
