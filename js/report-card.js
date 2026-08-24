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
  buildCategoryRadarComparisonSvg,
  categoryAveragesFromRecords,
  applyDataLabels,
  STATUS_LABELS
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

// ไล่รายชื่อเดือนทั้งหมดในช่วง [start, end] (รวมปลายทั้งสองด้าน) รูปแบบ "YYYY-MM" — ใช้นับความยาวของรอบเวลา
// เพื่อคำนวณ "รอบก่อนหน้า" ที่ยาวเท่ากัน (ดู previousPeriodRange)
function monthsInRange(start, end) {
  const months = [];
  let [y, m] = start.split("-").map(Number);
  const [endY, endM] = end.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

// เลื่อนเดือน "YYYY-MM" ไปกี่เดือนก็ได้ (delta ติดลบ = ย้อนหลัง)
function addMonths(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// รอบเวลาก่อนหน้ารอบที่เลือกไว้ ยาวเท่ากันเสมอ (เช่น เลือกรอบ 3 เดือน มิ.ย.-ส.ค. รอบก่อนหน้าคือ มี.ค.-พ.ค.)
// ใช้เปรียบเทียบพัฒนาการของนักกีฬาก่อน/หลัง ในตารางเปรียบเทียบและกราฟเรดาร์ซ้อนสองรอบ
function previousPeriodRange(start, end) {
  const monthCount = monthsInRange(start, end).length;
  const prevEnd = addMonths(start, -1);
  const prevStart = addMonths(prevEnd, -(monthCount - 1));
  return { start: prevStart, end: prevEnd };
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

// แถบสเกล 1-4 แบบจิ๋วในตารางเปรียบเทียบ — จุดแดง = คะแนนรอบก่อน, จุดน้ำเงิน = คะแนนรอบนี้ วางบนเส้นเดียวกัน
// ให้เห็นตำแหน่งเทียบกันได้ทันทีโดยไม่ต้องอ่านตัวเลข (คล้ายแถบ "SCALE" ในตัวอย่างการ์ดที่ผู้ใช้ส่งมา)
function buildScaleBarSvg(prevAvg, curAvg, max = 4) {
  const width = 90;
  const height = 16;
  const toX = (v) => 4 + (v / max) * (width - 8);
  const prevDot = prevAvg !== null ? `<circle cx="${toX(prevAvg).toFixed(1)}" cy="8" r="3" fill="#ef4444" />` : "";
  const curDot = curAvg !== null ? `<circle cx="${toX(curAvg).toFixed(1)}" cy="8" r="3" fill="#2563eb" />` : "";
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="4" y1="8" x2="${width - 4}" y2="8" stroke="#e2e8f0" stroke-width="2" />${prevDot}${curDot}</svg>`;
}

// รวมค่าเฉลี่ยรอบก่อน/รอบนี้ทั้ง 4 หมวด พร้อม delta (ผลต่าง) — ใช้ทั้งตารางเปรียบเทียบและ Key takeaways
function categoryComparisons(prevRecords, currentRecords) {
  const prevAverages = categoryAveragesFromRecords(prevRecords);
  const currentAverages = categoryAveragesFromRecords(currentRecords);
  return currentAverages.map((cur, i) => {
    const prev = prevAverages[i];
    const delta = cur.avg !== null && prev.avg !== null ? cur.avg - prev.avg : null;
    return { key: cur.key, label: cur.short, prevAvg: prev.avg, curAvg: cur.avg, delta };
  });
}

function buildSkillComparisonTable(comparisons) {
  const rows = comparisons.map((c) => {
    const changeHtml =
      c.delta === null
        ? '<span class="text-slate-400">-</span>'
        : c.delta > 0.05
          ? `<span class="text-emerald-600">▲ ${c.delta.toFixed(1)}</span>`
          : c.delta < -0.05
            ? `<span class="text-red-600">▼ ${Math.abs(c.delta).toFixed(1)}</span>`
            : '<span class="text-slate-400">≈ คงที่</span>';
    return `
      <tr>
        <td class="emphasis">${c.label}</td>
        <td>${c.prevAvg !== null ? c.prevAvg.toFixed(1) : "-"}</td>
        <td>${c.curAvg !== null ? c.curAvg.toFixed(1) : "-"}</td>
        <td>${buildScaleBarSvg(c.prevAvg, c.curAvg)}</td>
        <td>${changeHtml}</td>
      </tr>`;
  });
  return buildHistoryTable(["ด้านการประเมิน", "รอบก่อน", "รอบนี้", "สเกล 1-4", "การเปลี่ยนแปลง"], rows);
}

// สรุปประเด็นสำคัญเป็นข้อความสั้นๆ (จุดแข็ง/จุดที่ควรพัฒนา/พัฒนาการเด่น/สรุปลงสนาม/สรุปเข้าฝึกซ้อม) — สร้างจาก
// ข้อมูลจริงล้วนๆ ไม่เดาหรือเติมข้อมูลที่ไม่มี ข้อไหนไม่มีข้อมูลพอจะสรุปก็ข้ามไปเฉยๆ
function buildKeyTakeaways(comparisons, matchStats, attendanceStats) {
  const bullets = [];
  const scored = comparisons.filter((c) => c.curAvg !== null);
  if (scored.length > 0) {
    const best = scored.reduce((a, b) => (b.curAvg > a.curAvg ? b : a));
    bullets.push(`จุดแข็งที่สุดคือ ${best.label} (${best.curAvg.toFixed(1)}/4)`);
    const worst = scored.reduce((a, b) => (b.curAvg < a.curAvg ? b : a));
    if (worst.key !== best.key) {
      bullets.push(`ควรเน้นพัฒนาเพิ่มเติมคือ ${worst.label} (${worst.curAvg.toFixed(1)}/4)`);
    }
  }
  const improved = comparisons.filter((c) => c.delta !== null && c.delta > 0.05).sort((a, b) => b.delta - a.delta)[0];
  if (improved) {
    bullets.push(`พัฒนาการชัดเจนที่สุดคือ ${improved.label} เพิ่มขึ้น ${improved.delta.toFixed(1)} แต้มจากรอบก่อน`);
  }
  if (matchStats.total > 0) {
    bullets.push(`ลงสนาม ${matchStats.total} นัด (ชนะ ${matchStats.win} เสมอ ${matchStats.draw} แพ้ ${matchStats.loss})`);
  }
  if (attendanceStats.total > 0) {
    bullets.push(`เข้าร่วมฝึกซ้อม ${attendanceStats.percent}% (มา ${attendanceStats.attended}/${attendanceStats.total} ครั้ง)`);
  }
  return bullets;
}

function matchStatsFor(matchReports) {
  return {
    total: matchReports.length,
    win: matchReports.filter((m) => m.result === "ชนะ").length,
    draw: matchReports.filter((m) => m.result !== "ชนะ" && m.result !== "แพ้").length,
    loss: matchReports.filter((m) => m.result === "แพ้").length
  };
}

// การ์ดสไตล์ "PLAYER PROFILE" (ซ้าย) + เนื้อหาหลัก (ขวา) ตามรูปแบบตัวอย่างที่ผู้ใช้ส่งมา — ไม่มีรูปนักกีฬาจริง
// ในระบบ จึงใช้โลโก้ทีมแทนไอคอนวงกลม ส่วนหมวดคะแนน 4 ด้านที่มีอยู่แล้วยังคงเดิม (ไม่เพิ่มหมวดใหม่ที่ไม่มีข้อมูล
// จริงรองรับ) ปรับแค่วิธีแสดงผลเป็นตารางเทียบรอบก่อน/รอบนี้ + เรดาร์ซ้อนสองรอบ ตามที่ตกลงกันไว้
function buildPlayerPage(player, data, scope) {
  const { team, start, end } = scope;
  const age = calcAge(player.birthday);
  const comparisons = categoryComparisons(data.prevAttendanceRecords, data.attendanceRecords);
  const matchStats = matchStatsFor(data.matchReports);

  const statusCounts = { A: 0, I: 0, R: 0, P: 0 };
  for (const r of data.attendanceRecords) {
    if (r.status && Object.prototype.hasOwnProperty.call(statusCounts, r.status)) statusCounts[r.status] += 1;
  }

  // avg ของ 3 หมวดสมรรถภาพ/ทักษะบอล/อ่านเกม (ใกล้เคียงคำว่า "ทักษะ" มากที่สุดจาก 4 หมวดที่มีอยู่จริง)
  const skillComparisons = comparisons.filter((c) => c.key !== "attitude");
  const skillAvgValues = skillComparisons.map((c) => c.curAvg).filter((v) => v !== null);
  const skillAvg = skillAvgValues.length > 0 ? skillAvgValues.reduce((a, b) => a + b, 0) / skillAvgValues.length : null;
  const attitudeComparison = comparisons.find((c) => c.key === "attitude");

  const page = document.createElement("div");
  page.className = "report-card-page card card-pad space-y-3";

  const header = document.createElement("div");
  header.className = "flex items-start justify-between border-b border-slate-100 pb-2 gap-3";
  header.innerHTML = `
    <div>
      <h2 class="text-base font-bold tracking-tight">รายงานทักษะและพัฒนาการ</h2>
      <p class="text-xs text-slate-500 mt-0.5">รอบการประเมิน ${monthRangeLabel(start, end)} • ${teamLogoImg(team, "w-3.5 h-3.5 object-contain inline-block align-middle rounded mr-1")}${team}</p>
    </div>
    <p class="text-xs text-slate-400 whitespace-nowrap">ออกรายงาน ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}</p>
  `;
  page.appendChild(header);

  const body = document.createElement("div");
  body.className = "grid grid-cols-[130px_1fr] gap-4";

  // ---------- แถบซ้าย: โปรไฟล์นักกีฬา ----------
  const sidebar = document.createElement("aside");
  sidebar.className = "space-y-2";
  sidebar.innerHTML = `
    <p class="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Player Profile</p>
    <div class="w-16 h-16 rounded-full border-2 border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 mx-auto">
      ${teamLogoImg(team, "w-10 h-10 object-contain")}
    </div>
    <p class="text-sm font-semibold text-center">${player.nickname || player.fullName || "-"}</p>
    <div class="text-xs text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
      <p class="flex justify-between"><span class="text-slate-400">รุ่น</span><span>${player.ageGroup || UNASSIGNED_AGE_GROUP}</span></p>
      <p class="flex justify-between"><span class="text-slate-400">อายุ</span><span>${age !== null ? `${age} ปี` : "-"}</span></p>
      <p class="flex justify-between"><span class="text-slate-400">ตำแหน่ง</span><span>${player.position ?? "-"}</span></p>
      <p class="flex justify-between"><span class="text-slate-400">เบอร์เสื้อ</span><span>${player.number ?? "-"}</span></p>
    </div>
    <p class="text-[10px] font-semibold tracking-wide text-slate-400 uppercase pt-1 border-t border-slate-100">Profile Radar</p>
    <div>${buildCategoryRadarComparisonSvg(data.prevAttendanceRecords, data.attendanceRecords, 130)}</div>
    <div class="grid grid-cols-1 gap-1 text-center pt-1 border-t border-slate-100">
      <div><p class="text-[10px] text-slate-400">ด้านทักษะ</p><p class="text-sm font-bold">${skillAvg !== null ? skillAvg.toFixed(1) : "-"}/4</p></div>
      <div><p class="text-[10px] text-slate-400">ด้านทัศนคติ</p><p class="text-sm font-bold">${attitudeComparison?.curAvg !== null && attitudeComparison?.curAvg !== undefined ? attitudeComparison.curAvg.toFixed(1) : "-"}/4</p></div>
    </div>
  `;
  body.appendChild(sidebar);

  // ---------- เนื้อหาหลัก ----------
  const main = document.createElement("div");
  main.className = "space-y-3";

  const statsWrap = document.createElement("div");
  statsWrap.className = "grid grid-cols-4 gap-2";
  statsWrap.innerHTML =
    statCard("นัดที่ลงสนาม", matchStats.total) +
    statCard("ผลการแข่งขัน (ช-ส-พ)", `${matchStats.win}-${matchStats.draw}-${matchStats.loss}`) +
    statCard("% เข้าร่วมฝึกซ้อม", `${data.percent}%`) +
    statCard("คะแนนเฉลี่ยรวม", data.overallAvg !== null ? data.overallAvg.toFixed(2) : "-");
  main.appendChild(statsWrap);

  const skillTitle = document.createElement("h4");
  skillTitle.className = "text-sm font-semibold text-slate-700";
  skillTitle.textContent = "ผลการประเมิน 4 ด้าน (เทียบรอบก่อนหน้า)";
  main.appendChild(skillTitle);
  const skillTableWrap = document.createElement("div");
  skillTableWrap.innerHTML = buildSkillComparisonTable(comparisons);
  main.appendChild(skillTableWrap);

  const attendanceTitle = document.createElement("h4");
  attendanceTitle.className = "text-sm font-semibold text-slate-700";
  attendanceTitle.textContent = "สรุปการฝึกซ้อม";
  main.appendChild(attendanceTitle);
  // สรุปจำนวนครั้งแยกตามสถานะ (มา/บาดเจ็บ/พักฟื้น/ลา) แทนตารางรายวันละเอียด — สั้นกระชับพอสำหรับผู้ปกครอง
  // และช่วยให้เนื้อหาต่อคนพอดี 1 หน้า A4 มากขึ้นด้วย
  const attendanceSummaryWrap = document.createElement("div");
  attendanceSummaryWrap.className = "grid grid-cols-4 gap-2";
  attendanceSummaryWrap.innerHTML = Object.keys(STATUS_LABELS)
    .map((key) => statCard(STATUS_LABELS[key], `${statusCounts[key]} ครั้ง`))
    .join("");
  main.appendChild(attendanceSummaryWrap);

  const keyTakeawaysTitle = document.createElement("h4");
  keyTakeawaysTitle.className = "text-sm font-semibold text-slate-700";
  keyTakeawaysTitle.textContent = "สรุปประเด็นสำคัญ";
  main.appendChild(keyTakeawaysTitle);
  const takeaways = buildKeyTakeaways(comparisons, matchStats, {
    total: data.totalCount,
    attended: statusCounts.A,
    percent: data.percent
  });
  const takeawaysWrap = document.createElement("div");
  takeawaysWrap.className = "card p-3";
  takeawaysWrap.innerHTML =
    takeaways.length > 0
      ? `<ul class="text-xs text-slate-600 space-y-1 list-disc pl-4">${takeaways.map((t) => `<li>${t}</li>`).join("")}</ul>`
      : '<p class="text-xs text-slate-400">ยังไม่มีข้อมูลเพียงพอสำหรับสรุปประเด็นสำคัญ</p>';
  main.appendChild(takeawaysWrap);

  body.appendChild(main);
  page.appendChild(body);

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
  commentPrintText.className = "print-only text-sm whitespace-pre-wrap border border-slate-200 rounded-lg p-2 min-h-[3rem]";
  page.appendChild(commentPrintText);

  const commentTextarea = document.createElement("textarea");
  commentTextarea.className = "field-input w-full no-print";
  commentTextarea.rows = 3;
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
  footer.className = "grid grid-cols-2 gap-6 pt-3 mt-2 border-t border-slate-100 text-sm text-slate-500";
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
  // รอบก่อนหน้ายาวเท่ากับรอบที่เลือก ใช้เทียบพัฒนาการในตารางเปรียบเทียบ/เรดาร์ซ้อนสองรอบ — ไม่ต้อง query
  // Firestore เพิ่ม เพราะ attendanceSnap ด้านล่างดึงข้อมูลทั้งทีมมาแล้ว (ไม่ได้กรองด้วยเดือนที่ query level)
  const prevPeriod = previousPeriodRange(start, end);
  const prevStartDate = `${prevPeriod.start}-01`;
  const prevEndDate = lastDayOfMonth(prevPeriod.end);

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
  const prevPeriodAttendance = attendanceRecords.filter(
    (r) => (r.date || "") >= prevStartDate && (r.date || "") <= prevEndDate
  );

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
    const myPrevAttendance = prevPeriodAttendance.filter((r) => r.playerId === player.id);
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
      prevAttendanceRecords: myPrevAttendance,
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
