import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-init.js";
import {
  computeAvgScore,
  teamLogoImg,
  statCard,
  calcAge,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  buildScoreTrendChartSvg,
  buildCategoryRadarSvg,
  applyDataLabels
} from "./ui-utils.js";

const UNASSIGNED_AGE_GROUP = "ไม่ระบุรุ่นอายุ";

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const reportCardContent = document.getElementById("report-card-content");
const reportCardScopeLabel = document.getElementById("report-card-scope-label");
const reportCardPages = document.getElementById("report-card-pages");
const printBtn = document.getElementById("print-btn");

let currentAdminName = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "text-sm text-red-600 no-print" : "text-sm text-slate-500 no-print";
}

function showAccessGate(message) {
  accessGateMessage.textContent = message;
  accessGate.classList.remove("hidden");
  reportCardContent.classList.add("hidden");
  setStatus("");
}

// เผื่อกรณีแอดมินยังพิมพ์คำเห็นค้างอยู่ในช่องแล้วกดพิมพ์ทันทีโดยไม่คลิกออกจากช่องก่อน (ปกติข้อความที่พิมพ์
// ออกมาจะมาจาก commentPrintText ซึ่งอัปเดตตอน blur เท่านั้น) — บังคับ blur ก่อนเพื่อ sync ข้อความล่าสุดเสมอ
printBtn.addEventListener("click", () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  window.print();
});

// วันสุดท้ายของเดือน (รูปแบบ "YYYY-MM-DD") — ใช้ปิดขอบเขตบนของช่วงเวลาสมุดพก เทียบกับ date string ได้ตรงๆ
// เพราะฟิลด์ date ในระบบเก็บเป็น "YYYY-MM-DD" เรียงลำดับได้แบบ lexicographic อยู่แล้ว
function lastDayOfMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(last).padStart(2, "0")}`;
}

function monthRangeLabel(start, end) {
  const startLabel = new Date(`${start}-01T00:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
  const endLabel = new Date(`${end}-01T00:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
  return start === end ? startLabel : `${startLabel} – ${endLabel}`;
}

// บันทึกคำเห็นโค้ชของนักกีฬาคนนี้สำหรับรอบเวลานี้โดยเฉพาะ — id เอกสารผูกกับ playerId+start+end เพื่อไม่ให้
// คำเห็นรอบเก่าถูกทับตอนสร้างสมุดพกรอบถัดไป (ดู firestore.rules: playerReportCards เฉพาะผู้ดูแลระบบเท่านั้น)
async function saveComment(player, team, start, end, commentText, indicatorEl) {
  const docId = `${player.id}_${start}_${end}`;
  indicatorEl.textContent = "กำลังบันทึก...";
  indicatorEl.className = "text-xs text-slate-400 no-print";
  try {
    await setDoc(doc(db, "playerReportCards", docId), {
      playerId: player.id,
      playerName: player.nickname || player.fullName || "-",
      team,
      ageGroup: player.ageGroup || null,
      startMonth: start,
      endMonth: end,
      comment: commentText,
      updatedAt: serverTimestamp(),
      updatedBy: currentAdminName
    });
    indicatorEl.textContent = "บันทึกแล้ว ✓";
    indicatorEl.className = "text-xs text-emerald-600 no-print";
  } catch (err) {
    console.error(err);
    indicatorEl.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    indicatorEl.className = "text-xs text-red-600 no-print";
  }
}

function buildHistoryTable(headers, rows) {
  if (rows.length === 0) {
    return '<p class="text-sm text-slate-400">ไม่มีข้อมูลในช่วงเวลานี้</p>';
  }
  const wrap = document.createElement("div");
  wrap.className = "card table-wrap";
  wrap.innerHTML = `
    <table class="pro-table text-xs">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = wrap.querySelector("tbody");
  tbody.innerHTML = rows.join("");
  applyDataLabels(tbody);
  return wrap.outerHTML;
}

function buildPlayerPage(player, data, scope) {
  const { team, start, end } = scope;
  const age = calcAge(player.birthday);

  const page = document.createElement("div");
  page.className = "report-card-page card card-pad space-y-5";

  const header = document.createElement("div");
  header.className = "text-center border-b border-slate-100 pb-4";
  header.innerHTML = `
    <img src="./assets/logo.png" alt="Footelligence" class="w-12 h-12 object-contain mx-auto mb-2" />
    <h2 class="text-lg font-bold tracking-tight">สมุดพกนักกีฬา — รอบการประเมิน ${monthRangeLabel(start, end)}</h2>
    <p class="text-base font-semibold mt-2">${player.nickname || player.fullName || "-"}</p>
    <p class="text-sm text-slate-500 mt-1">
      ${player.fullName ?? "-"} • เบอร์ ${player.number ?? "-"} •
      ${teamLogoImg(team, "w-4 h-4 object-contain inline-block align-middle rounded mr-1")}${team} •
      รุ่น ${player.ageGroup || UNASSIGNED_AGE_GROUP}${age !== null ? ` • อายุ ${age} ปี` : ""}${player.position ? ` • ตำแหน่ง ${player.position}` : ""}
    </p>
  `;
  page.appendChild(header);

  const statsWrap = document.createElement("div");
  statsWrap.className = "grid grid-cols-3 gap-3";
  statsWrap.innerHTML =
    statCard("จำนวนครั้งที่บันทึก", data.totalCount) +
    statCard("% เข้าร่วมฝึกซ้อม", `${data.percent}%`) +
    statCard("คะแนนเฉลี่ยรวม", data.overallAvg !== null ? data.overallAvg.toFixed(2) : "-");
  page.appendChild(statsWrap);

  const chartsWrap = document.createElement("div");
  chartsWrap.className = "grid sm:grid-cols-2 gap-4";
  const trendCard = document.createElement("div");
  trendCard.className = "card card-pad";
  trendCard.innerHTML = `<h4 class="text-sm font-semibold text-slate-700 mb-2">แนวโน้มคะแนนเฉลี่ยรายวัน</h4><div class="overflow-x-auto">${buildScoreTrendChartSvg(data.attendanceRecords)}</div>`;
  const radarCard = document.createElement("div");
  radarCard.className = "card card-pad";
  radarCard.innerHTML = `<h4 class="text-sm font-semibold text-slate-700 mb-2">คะแนนเฉลี่ยแยกตามด้าน</h4>${buildCategoryRadarSvg(data.attendanceRecords)}`;
  chartsWrap.append(trendCard, radarCard);
  page.appendChild(chartsWrap);

  const matchTitle = document.createElement("h4");
  matchTitle.className = "text-sm font-semibold text-slate-700";
  matchTitle.textContent = "ผลการแข่งขันที่ลงสนาม";
  page.appendChild(matchTitle);
  const matchRows = [...data.matchReports]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map(
      (m) => `
      <tr>
        <td class="emphasis">${m.date ?? "-"}</td>
        <td>${m.opponent ?? "-"}</td>
        <td>${matchResultBadge(m.result)}</td>
        <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
      </tr>`
    );
  const matchWrap = document.createElement("div");
  matchWrap.innerHTML = buildHistoryTable(["วันที่", "คู่แข่ง", "ผล", "สกอร์"], matchRows);
  page.appendChild(matchWrap);

  const injuryTitle = document.createElement("h4");
  injuryTitle.className = "text-sm font-semibold text-slate-700";
  injuryTitle.textContent = "ประวัติการบาดเจ็บ";
  page.appendChild(injuryTitle);
  const injuryRows = [...data.injuryReports]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map(
      (inj) => `
      <tr>
        <td class="emphasis">${inj.date ?? "-"}</td>
        <td>${inj.description ?? "-"}</td>
        <td>${injurySeverityBadge(inj.severity)}</td>
        <td>${injuryStatusBadge(inj.status)}</td>
      </tr>`
    );
  const injuryWrap = document.createElement("div");
  injuryWrap.innerHTML = buildHistoryTable(["วันที่", "อาการ", "ความรุนแรง", "สถานะ"], injuryRows);
  page.appendChild(injuryWrap);

  const commentTitle = document.createElement("h4");
  commentTitle.className = "text-sm font-semibold text-slate-700";
  commentTitle.textContent = "คำเห็นและข้อเสนอแนะจากโค้ช";
  page.appendChild(commentTitle);

  const commentPrintText = document.createElement("p");
  commentPrintText.className = "print-only text-sm whitespace-pre-wrap border border-slate-200 rounded-lg p-3 min-h-[4rem]";
  page.appendChild(commentPrintText);

  const commentTextarea = document.createElement("textarea");
  commentTextarea.className = "field-input w-full no-print";
  commentTextarea.rows = 4;
  commentTextarea.placeholder = "เขียนคำเห็น/ข้อเสนอแนะสำหรับนักกีฬาคนนี้...";
  commentTextarea.value = data.comment || "";
  commentPrintText.textContent = data.comment || "-";
  const commentIndicator = document.createElement("p");
  commentIndicator.className = "text-xs text-slate-400 no-print";
  commentTextarea.addEventListener("blur", () => {
    commentPrintText.textContent = commentTextarea.value.trim() || "-";
    saveComment(player, team, start, end, commentTextarea.value.trim(), commentIndicator);
  });
  page.append(commentTextarea, commentIndicator);

  const footer = document.createElement("div");
  footer.className = "grid grid-cols-2 gap-6 pt-6 mt-4 border-t border-slate-100 text-sm text-slate-500";
  footer.innerHTML = `
    <p>ลงชื่อโค้ช ........................................</p>
    <p>ลงชื่อผู้ปกครอง ........................................</p>
  `;
  page.appendChild(footer);

  return page;
}

async function loadReportCards(team, ageGroup, start, end) {
  setStatus("กำลังโหลดข้อมูล...");

  const startDate = `${start}-01`;
  const endDate = lastDayOfMonth(end);

  const [playersSnap, attendanceSnap, matchSnap, injurySnap, commentsSnap] = await Promise.all([
    getDocs(query(collection(db, "players"), where("team", "==", team))),
    getDocs(query(collection(db, "attendance"), where("team", "==", team))),
    getDocs(query(collection(db, "matchReports"), where("team", "==", team))),
    getDocs(query(collection(db, "injuryReports"), where("team", "==", team))),
    getDocs(
      query(
        collection(db, "playerReportCards"),
        where("team", "==", team),
        where("startMonth", "==", start),
        where("endMonth", "==", end)
      )
    )
  ]);

  let players = [];
  playersSnap.forEach((d) => players.push({ id: d.id, ...d.data() }));
  if (ageGroup !== "__ALL__") {
    players = players.filter((p) => (p.ageGroup || UNASSIGNED_AGE_GROUP) === ageGroup);
  }
  players.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  if (players.length === 0) {
    reportCardPages.innerHTML =
      '<p class="text-sm text-slate-400 no-print">ไม่พบนักกีฬาในทีม/รุ่นอายุที่เลือก</p>';
    setStatus("ไม่พบนักกีฬาในทีม/รุ่นอายุที่เลือก");
    return;
  }

  const attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));
  const periodAttendance = attendanceRecords.filter((r) => (r.date || "") >= startDate && (r.date || "") <= endDate);

  const matchReports = [];
  matchSnap.forEach((d) => matchReports.push(d.data()));
  const periodMatches = matchReports.filter((m) => (m.date || "") >= startDate && (m.date || "") <= endDate);

  const injuryReports = [];
  injurySnap.forEach((d) => injuryReports.push(d.data()));
  const periodInjuries = injuryReports.filter((i) => (i.date || "") >= startDate && (i.date || "") <= endDate);

  const commentsByPlayerId = new Map();
  commentsSnap.forEach((d) => commentsByPlayerId.set(d.data().playerId, d.data()));

  const monthLabel = monthRangeLabel(start, end);
  const scopeText =
    ageGroup === "__ALL__"
      ? `ทีม ${team} — ทุกรุ่นอายุ — รอบ ${monthLabel} — ${players.length} คน`
      : `ทีม ${team} — รุ่นอายุ ${ageGroup} — รอบ ${monthLabel} — ${players.length} คน`;
  reportCardScopeLabel.innerHTML = `${teamLogoImg(team, "w-5 h-5 object-contain inline-block align-middle rounded mr-1")}${scopeText}`;
  document.title = `FOOTELLIGENCE DATA — สมุดพก ${scopeText}`;

  reportCardPages.innerHTML = "";
  for (const player of players) {
    const myAttendance = periodAttendance.filter((r) => r.playerId === player.id);
    const attendedCount = myAttendance.filter((r) => r.status === "A").length;
    const totalCount = myAttendance.length;
    const percent = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;
    const scoredRecords = myAttendance.filter((r) => computeAvgScore(r.scores) !== null);
    const overallAvg =
      scoredRecords.length > 0
        ? scoredRecords.reduce((sum, r) => sum + computeAvgScore(r.scores), 0) / scoredRecords.length
        : null;
    const myMatches = periodMatches.filter((m) => (m.startingLineupIds || []).includes(player.id));
    const myInjuries = periodInjuries.filter((i) => i.playerId === player.id);
    const existingComment = commentsByPlayerId.get(player.id);

    const page = buildPlayerPage(player, {
      attendanceRecords: myAttendance,
      totalCount,
      percent,
      overallAvg,
      matchReports: myMatches,
      injuryReports: myInjuries,
      comment: existingComment?.comment || ""
    }, { team, start, end });
    reportCardPages.appendChild(page);
  }

  setStatus(`โหลดข้อมูลสำเร็จ • สมุดพกทั้งหมด ${players.length} คน`);
}

onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  if (!isCoachSession) {
    showAccessGate("ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบก่อน จึงจะสร้างสมุดพกนักกีฬาได้");
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved" || data.role !== "admin") {
      showAccessGate("หน้านี้ใช้ได้เฉพาะบัญชีผู้ดูแลระบบเท่านั้น");
      return;
    }
    currentAdminName = data.name || user.email;

    // ใช้ URL hash (#team=...&ageGroup=...&start=...&end=...) แทน query string เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง
    // (serve, clean-url) จะ redirect "report-card.html" ไปเป็น "report-card" และตัด query string ทิ้งระหว่างทาง
    // แต่ไม่ตัด hash — ใช้ได้ทั้งในเครื่องและบน Vercel เหมือนกัน
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const team = params.get("team");
    const ageGroup = params.get("ageGroup") || "__ALL__";
    const start = params.get("start");
    const end = params.get("end");

    if (!team || !start || !end) {
      showAccessGate("ไม่พบเงื่อนไขที่ต้องการสร้างสมุดพก กรุณาเลือกทีม/ช่วงเวลาจากหน้าเช็คชื่ออีกครั้ง");
      return;
    }

    accessGate.classList.add("hidden");
    reportCardContent.classList.remove("hidden");
    await loadReportCards(team, ageGroup, start, end);
  } catch (err) {
    console.error(err);
    setStatus("โหลดข้อมูลไม่สำเร็จ: " + err.message, true);
  }
});
