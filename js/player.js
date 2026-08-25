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
  applyDataLabels,
  SCORE_CATEGORIES,
  STATUS_LABELS,
  computeAvgScore,
  teamLogoImg,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  statCard,
  sendExecutiveNote,
  calcAge,
  buildScoreTrendChartSvg,
  buildCategoryRadarSvg
} from "./ui-utils.js";

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const playerContent = document.getElementById("player-content");
const playerPhotoBadge = document.getElementById("player-photo-badge");
const playerNameHeading = document.getElementById("player-name-heading");
const playerSubheading = document.getElementById("player-subheading");
const playerStatCards = document.getElementById("player-stat-cards");
const scoreTrendChartWrap = document.getElementById("score-trend-chart-wrap");
const categoryBars = document.getElementById("category-bars");
const attendanceHistoryBody = document.getElementById("attendance-history-body");
const matchHistoryBody = document.getElementById("match-history-body");
const injuryHistoryBody = document.getElementById("injury-history-body");
const sendToExecutiveBtn = document.getElementById("send-to-executive-btn");

let currentPlayer = null;
let currentAdminName = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

function showAccessGate(message) {
  accessGateMessage.textContent = message;
  accessGate.classList.remove("hidden");
  playerContent.classList.add("hidden");
  setStatus("");
}

function renderPlayerInfo(player) {
  const age = calcAge(player.birthday);
  // มีรูปจริงก็แสดงแทนไอคอน 👤 เริ่มต้น (เพิ่มรูปได้จากขั้นตอนแก้ไขข้อมูลนักกีฬาในหน้าเช็คชื่อ)
  playerPhotoBadge.innerHTML = player.photoUrl
    ? `<img src="${player.photoUrl}" alt="รูปนักกีฬา" class="w-full h-full object-cover" />`
    : "👤";
  playerNameHeading.textContent = player.nickname || player.fullName || "-";
  const parts = [
    player.fullName ?? "-",
    `เบอร์ ${player.number ?? "-"}`,
    `${teamLogoImg(player.team, "w-4 h-4 object-contain inline-block align-middle rounded mr-1")}${player.team ?? "-"}`,
    `รุ่น ${player.ageGroup ?? "-"}`
  ];
  if (age !== null) parts.push(`อายุ ${age} ปี`);
  if (player.position) parts.push(`ตำแหน่ง ${player.position}`);
  playerSubheading.innerHTML = parts.join(" • ");
}

// กราฟเส้น/เรดาร์ (SVG) ย้ายไปเป็นฟังก์ชันกลางใน ui-utils.js (buildScoreTrendChartSvg/buildCategoryRadarSvg)
// แล้ว เพราะสมุดพกนักกีฬาสำหรับพิมพ์ (report-card.js) ต้องใช้กราฟแบบเดียวกันนี้กับ records ที่กรองสโคปรายช่วง
// เวลาแทนที่จะเป็นประวัติทั้งหมด — ที่นี่แค่เรียกใช้แล้ววาดลง DOM ของหน้านี้
function renderScoreTrendChart(records) {
  scoreTrendChartWrap.innerHTML = buildScoreTrendChartSvg(records);
}

function renderCategoryRadar(records) {
  categoryBars.innerHTML = buildCategoryRadarSvg(records);
}

function renderAttendanceHistory(records) {
  if (records.length === 0) {
    attendanceHistoryBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ยังไม่มีประวัติการเข้าร่วมฝึกซ้อม</td></tr>';
    return;
  }
  const sorted = [...records].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  attendanceHistoryBody.innerHTML = sorted
    .map((r) => {
      const scores = r.scores || {};
      const avg = computeAvgScore(scores);
      return `
        <tr>
          <td class="emphasis">${r.date ?? "-"}</td>
          <td>${r.status ? `${r.status} (${STATUS_LABELS[r.status] ?? "-"})` : "-"}</td>
          ${SCORE_CATEGORIES.map((c) => `<td>${scores[c.key] ?? "-"}</td>`).join("")}
          <td>${avg !== null ? avg.toFixed(2) : "-"}</td>
        </tr>`;
    })
    .join("");
  applyDataLabels(attendanceHistoryBody);
}

function renderMatchHistory(reports) {
  if (reports.length === 0) {
    matchHistoryBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่เคยลงเล่นตัวจริงในรายการแข่งขันใด</td></tr>';
    return;
  }
  const sorted = [...reports].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  matchHistoryBody.innerHTML = sorted
    .map(
      (m) => `
      <tr>
        <td class="emphasis">${m.date ?? "-"}</td>
        <td>${m.opponent ?? "-"}</td>
        <td>${m.competitionType ?? "-"}${m.competition ? ` (${m.competition})` : ""}</td>
        <td>${matchResultBadge(m.result)}</td>
        <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
      </tr>`
    )
    .join("");
  applyDataLabels(matchHistoryBody);
}


function renderInjuryHistory(reports) {
  if (reports.length === 0) {
    injuryHistoryBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ไม่มีประวัติการบาดเจ็บ</td></tr>';
    return;
  }
  const sorted = [...reports].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  injuryHistoryBody.innerHTML = sorted
    .map(
      (inj) => `
      <tr>
        <td class="emphasis">${inj.date ?? "-"}</td>
        <td>${inj.description ?? "-"}</td>
        <td>${injurySeverityBadge(inj.severity)}</td>
        <td>${injuryStatusBadge(inj.status)}</td>
        <td>${inj.expectedReturn ?? "-"}</td>
      </tr>`
    )
    .join("");
  applyDataLabels(injuryHistoryBody);
}

async function loadPlayerData(playerId) {
  setStatus("กำลังโหลดข้อมูล...");
  const playerDoc = await getDoc(doc(db, "players", playerId));
  if (!playerDoc.exists()) {
    showAccessGate("ไม่พบข้อมูลนักกีฬานี้ (อาจถูกลบไปแล้ว)");
    return;
  }
  const player = { id: playerDoc.id, ...playerDoc.data() };
  currentPlayer = player;

  renderPlayerInfo(player);

  // ต้องแนบ where("team", "==", player.team) เสมอ เพราะ Firestore rules ของ attendance/matchReports/
  // injuryReports เช็ค resource.data.team — query ที่ไม่กรองด้วยฟิลด์นี้จะถูกปฏิเสธสำหรับบัญชีที่ไม่ใช่ผู้ดูแลระบบ
  const [attendanceSnap, matchSnap, injurySnap] = await Promise.all([
    getDocs(query(collection(db, "attendance"), where("team", "==", player.team), where("playerId", "==", playerId))),
    getDocs(query(collection(db, "matchReports"), where("team", "==", player.team))),
    getDocs(query(collection(db, "injuryReports"), where("team", "==", player.team), where("playerId", "==", playerId)))
  ]);

  const attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));
  // matchReports ไม่มีฟิลด์ playerId โดยตรง (เก็บเป็น array รายชื่อผู้เล่นตัวจริง) จึงกรองฝั่ง client แทน
  const matchReports = [];
  matchSnap.forEach((d) => {
    const data = d.data();
    if ((data.startingLineupIds || []).includes(playerId)) matchReports.push(data);
  });
  const injuryReports = [];
  injurySnap.forEach((d) => injuryReports.push(d.data()));

  const attendedCount = attendanceRecords.filter((r) => r.status === "A").length;
  const totalCount = attendanceRecords.length;
  const percent = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;
  const scoredRecords = attendanceRecords.filter((r) => computeAvgScore(r.scores) !== null);
  const overallAvg =
    scoredRecords.length > 0
      ? scoredRecords.reduce((sum, r) => sum + computeAvgScore(r.scores), 0) / scoredRecords.length
      : null;

  playerStatCards.innerHTML =
    statCard("จำนวนครั้งที่บันทึก", totalCount) +
    statCard("มาซ้อม", attendedCount) +
    statCard("% เข้าร่วม", `${percent}%`) +
    statCard("คะแนนเฉลี่ยรวม", overallAvg !== null ? overallAvg.toFixed(2) : "-");

  renderScoreTrendChart(attendanceRecords);
  renderCategoryRadar(attendanceRecords);
  renderAttendanceHistory(attendanceRecords);
  renderMatchHistory(matchReports);
  renderInjuryHistory(injuryReports);

  accessGate.classList.add("hidden");
  playerContent.classList.remove("hidden");
  setStatus(`โหลดข้อมูลสำเร็จ • บันทึกทั้งหมด ${totalCount} ครั้ง`);
}

// ผู้ดูแลระบบส่งข้อมูลนักกีฬาคนนี้ (เช่น พัฒนาการที่ดี) ไปแจ้งผู้บริหารทีมโดยตรง — ใช้ prompt() ธรรมดา
// (ไม่สร้าง modal ใหม่) ให้แก้ข้อความเริ่มต้นได้ก่อนส่งจริง สอดคล้องกับ confirm() ที่ใช้อยู่แล้วทั่วแอป
sendToExecutiveBtn.addEventListener("click", async () => {
  if (!currentPlayer) return;
  const label = currentPlayer.nickname || currentPlayer.fullName || "-";
  const defaultMessage = `นักกีฬาที่น่าจับตามอง: ${label} (ทีม ${currentPlayer.team ?? "-"}) — ลองดูรายละเอียดเพิ่มเติมที่หน้าข้อมูลนักกีฬา`;
  const message = prompt("ข้อความที่จะส่งถึงผู้บริหารทีม:", defaultMessage);
  if (message === null || !message.trim()) return;
  try {
    await sendExecutiveNote({
      team: currentPlayer.team,
      type: "player",
      refId: currentPlayer.id,
      refLabel: label,
      message: message.trim(),
      createdBy: currentAdminName
    });
    alert("ส่งข้อความถึงผู้บริหารทีมแล้ว ✓");
  } catch (err) {
    console.error(err);
    alert("ส่งไม่สำเร็จ: " + err.message);
  }
});

// ใช้ URL hash (#id=...) แทน query string เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง (serve, clean-url) จะ redirect
// "player.html" ไปเป็น "player" และตัด query string ทิ้งระหว่างทาง แต่ไม่ตัด hash — ใช้ได้ทั้งในเครื่องและบน Vercel
function getPlayerIdFromUrl() {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("id");
}

onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  if (!isCoachSession) {
    showAccessGate("ต้องเข้าสู่ระบบด้วยบัญชีโค้ช ผู้บริหารทีม หรือผู้ดูแลระบบก่อน จึงจะดูข้อมูลนักกีฬาได้");
    return;
  }

  const playerId = getPlayerIdFromUrl();
  if (!playerId) {
    showAccessGate("ไม่พบรหัสนักกีฬาที่ต้องการดู กรุณากลับไปเลือกนักกีฬาจากหน้า Dashboard ใหม่อีกครั้ง");
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;
    if (!data || data.status !== "approved") {
      showAccessGate("บัญชีนี้ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ กรุณารอหรือติดต่อผู้ดูแลระบบ");
      return;
    }

    if (data.role === "admin") {
      currentAdminName = data.name || user.email;
      sendToExecutiveBtn.classList.remove("hidden");
    }

    await loadPlayerData(playerId);
  } catch (err) {
    console.error(err);
    // โค้ช/ผู้บริหารทีมพยายามดูนักกีฬาทีมอื่น — Firestore rules ปฏิเสธด้วย permission-denied
    // แสดงข้อความที่เข้าใจง่ายแทน error ดิบจาก Firebase
    if (err.code === "permission-denied") {
      showAccessGate("คุณไม่มีสิทธิ์ดูข้อมูลนักกีฬาคนนี้ (อาจอยู่ทีมอื่น)");
    } else {
      setStatus("โหลดข้อมูลไม่สำเร็จ: " + err.message, true);
    }
  }
});
