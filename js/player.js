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
import { applyDataLabels, SCORE_CATEGORIES, computeAvgScore, teamLogoImg } from "./ui-utils.js";

const STATUS_LABELS = { A: "มา", I: "บาดเจ็บ", R: "พักฟื้น", P: "ลา" };
const CHART_PALETTE = ["#0f172a", "#10b981", "#f59e0b", "#3b82f6"];

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const playerContent = document.getElementById("player-content");
const playerNameHeading = document.getElementById("player-name-heading");
const playerSubheading = document.getElementById("player-subheading");
const playerStatCards = document.getElementById("player-stat-cards");
const scoreTrendChartWrap = document.getElementById("score-trend-chart-wrap");
const categoryBars = document.getElementById("category-bars");
const attendanceHistoryBody = document.getElementById("attendance-history-body");
const matchHistoryBody = document.getElementById("match-history-body");
const injuryHistoryBody = document.getElementById("injury-history-body");

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

function statCard(label, value) {
  return `
    <div class="stat-card">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
    </div>
  `;
}

function calcAge(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function renderPlayerInfo(player) {
  const age = calcAge(player.birthday);
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

// กราฟเส้นแบบ SVG ธรรมดา ไม่พึ่งไลบรารีภายนอก แสดงคะแนนเฉลี่ยรายวันเรียงตามเวลา เพื่อดูแนวโน้มพัฒนาการ
function renderScoreTrendChart(records) {
  const points = records
    .filter((r) => computeAvgScore(r.scores) !== null)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (points.length === 0) {
    scoreTrendChartWrap.innerHTML =
      '<p class="text-sm text-slate-400 text-center py-8">ยังไม่มีข้อมูลคะแนนเพียงพอสำหรับแสดงกราฟ</p>';
    return;
  }

  const width = Math.max(points.length * 70, 320);
  const height = 220;
  const padTop = 20;
  const padBottom = 36;
  const padLeft = 30;
  const padRight = 20;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxScore = 4;

  const coords = points.map((p, i) => {
    const avg = computeAvgScore(p.scores);
    const x = points.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (points.length - 1)) * chartW;
    const y = padTop + chartH - (avg / maxScore) * chartH;
    return { x, y, avg, date: p.date };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const gridLines = [1, 2, 3, 4]
    .map((v) => {
      const y = padTop + chartH - (v / maxScore) * chartH;
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />
              <text x="${padLeft - 6}" y="${y + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${v}</text>`;
    })
    .join("");

  const dots = coords
    .map(
      (c) => `
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="#0f172a">
        <title>${c.date}: ${c.avg.toFixed(2)}</title>
      </circle>
      <text x="${c.x.toFixed(1)}" y="${height - 12}" font-size="10" fill="#64748b" text-anchor="middle">${c.date ? c.date.slice(5) : ""}</text>`
    )
    .join("");

  scoreTrendChartWrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="min-width:${width}px">
      ${gridLines}
      <path d="${linePath}" fill="none" stroke="#0f172a" stroke-width="2" />
      ${dots}
    </svg>
  `;
}

function renderCategoryBars(records) {
  const sums = {};
  const counts = {};
  for (const cat of SCORE_CATEGORIES) {
    sums[cat.key] = 0;
    counts[cat.key] = 0;
  }
  for (const r of records) {
    const scores = r.scores || {};
    for (const cat of SCORE_CATEGORIES) {
      if (typeof scores[cat.key] === "number") {
        sums[cat.key] += scores[cat.key];
        counts[cat.key] += 1;
      }
    }
  }

  categoryBars.innerHTML = SCORE_CATEGORIES.map((cat, i) => {
    const avg = counts[cat.key] > 0 ? sums[cat.key] / counts[cat.key] : 0;
    const pct = Math.min((avg / 4) * 100, 100);
    return `
      <div class="mb-4 last:mb-0">
        <div class="flex justify-between text-xs text-slate-500 mb-1">
          <span>${cat.label}</span>
          <span>${counts[cat.key] > 0 ? avg.toFixed(2) : "-"}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-3">
          <div class="h-3 rounded-full" style="width:${pct}%; background:${CHART_PALETTE[i % CHART_PALETTE.length]}"></div>
        </div>
      </div>`;
  }).join("");
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

function matchResultBadge(result) {
  if (result === "ชนะ") return '<span class="badge badge-success">ชนะ</span>';
  if (result === "แพ้") return '<span class="badge badge-danger">แพ้</span>';
  return '<span class="badge badge-neutral">เสมอ</span>';
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

function injurySeverityBadge(severity) {
  if (severity === "รุนแรง") return `<span class="badge badge-danger">${severity}</span>`;
  if (severity === "ปานกลาง") return `<span class="badge badge-warning">${severity}</span>`;
  return `<span class="badge badge-neutral">${severity ?? "-"}</span>`;
}

function injuryStatusBadge(status) {
  if (status === "หายแล้ว") return '<span class="badge badge-success">หายแล้ว</span>';
  if (status === "กำลังพักฟื้น") return '<span class="badge badge-warning">กำลังพักฟื้น</span>';
  if (status === "บาดเจ็บขณะแข่งขัน" || status === "บาดเจ็บขณะฝึกซ้อม") {
    return `<span class="badge badge-danger">${status}</span>`;
  }
  return `<span class="badge badge-neutral">${status ?? "-"}</span>`;
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
  renderCategoryBars(attendanceRecords);
  renderAttendanceHistory(attendanceRecords);
  renderMatchHistory(matchReports);
  renderInjuryHistory(injuryReports);

  accessGate.classList.add("hidden");
  playerContent.classList.remove("hidden");
  setStatus(`โหลดข้อมูลสำเร็จ • บันทึกทั้งหมด ${totalCount} ครั้ง`);
}

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
