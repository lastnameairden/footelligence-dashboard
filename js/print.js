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
  trainingDaysQuotaForTeamMonth,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  ageGroupSortKey,
  ageGroupNumber,
  getCoachPlayerIds,
  isCoachSubmissionOnTime,
  isReportLate,
  escapeHtml,
  monthDateRange,
  teamDateRangeQuery,
  thisMonthBangkok
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
const printTrainingPlanQuotaBar = document.getElementById("print-training-plan-quota-bar");
const printTrainingPlanTrend = document.getElementById("print-training-plan-trend");
const printTrainingPlanTopicsPlayer = document.getElementById("print-training-plan-topics-player");
const printTrainingPlanTopicsGk = document.getElementById("print-training-plan-topics-gk");
const printCheckinCards = document.getElementById("print-checkin-cards");
const printCheckinBody = document.getElementById("print-checkin-body");
const printCheckinTrend = document.getElementById("print-checkin-trend");
const printReportCards = document.getElementById("print-report-cards");
const printReportBody = document.getElementById("print-report-body");
const printReportTrend = document.getElementById("print-report-trend");
const printConsistencyBody = document.getElementById("print-consistency-body");
const printMatchCards = document.getElementById("print-match-cards");
const printMatchSummaryCards = document.getElementById("print-match-summary-cards");
const printMatchBody = document.getElementById("print-match-body");
const printInjuryCards = document.getElementById("print-injury-cards");
const printInjuryChart = document.getElementById("print-injury-chart");
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
  printGeneratedAt.textContent = `สร้างสรุปเมื่อ ${new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" })}`;
  document.title = `FOOTELLIGENCE DATA — สรุป ${scopeText}`;

  await loadPrintExtras(team, ageGroup, month);

  setStatus("โหลดข้อมูลสำเร็จ");
}

// กราฟแท่งซ้อน (stacked bar) แสดงสัดส่วนโค้ชที่ตรงเวลา/สาย/ไม่ได้ทำในแต่ละวัน — ความสูงรวมของทุกแท่งเท่ากันเสมอ
// (=จำนวนโค้ชทั้งหมดในขอบเขต) เพราะโค้ชแต่ละคนอยู่ในสถานะใดสถานะหนึ่งเสมอ กราฟนี้จึงแสดง "สัดส่วน" ที่เปลี่ยนไป
// ในแต่ละวัน ไม่ใช่ปริมาณรวม — ใช้ดูภาพรวมว่าช่วงไหนของเดือนทีมโค้ชทำงานดี/แย่กว่ากัน
// รับ dailyCounts เป็น array ของ {date, onTime, late, none} ตามลำดับวันที่ต้องการแสดง — ไม่จำเป็นต้องครบทุกวันที่
// ในเดือน (เช่นกราฟเช็คชื่อจะมีแค่วันที่มีวันฝึกซ้อมจริงเท่านั้น) label วันที่ดึงจากท้าย date string ของแต่ละ
// entry เองเสมอ ไม่ได้อิงตำแหน่ง index+1 = วันที่ กันป้ายวันที่เพี้ยนเมื่อข้อมูลไม่ครบทุกวัน
function buildCoachDailyTrendSvg(dailyCounts, totalCoaches, options = {}) {
  const noneLabel = options.noneLabel || "ยังไม่ส่ง";
  const verb = options.verb || "ส่ง";
  if (totalCoaches === 0 || dailyCounts.length === 0) {
    return '<p class="text-xs text-slate-400 text-center py-6">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>';
  }
  const width = 760;
  const height = 170;
  const padTop = 8;
  const padBottom = 24;
  const padLeft = 26;
  const padRight = 8;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const n = dailyCounts.length;
  const slotW = chartW / n;
  const barGap = slotW * 0.15;
  const barWidth = slotW - barGap;
  const maxY = totalCoaches;
  const baselineY = padTop + chartH;

  const gridLines = [0.5, 1]
    .map((frac) => {
      const y = padTop + chartH - frac * chartH;
      return `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>
              <text x="${padLeft - 4}" y="${(y + 2.5).toFixed(1)}" font-size="7" fill="#94a3b8" text-anchor="end">${Math.round(frac * maxY)}</text>`;
    })
    .join("");

  const bars = dailyCounts
    .map((d, i) => {
      const x = padLeft + i * slotW + barGap / 2;
      let yCursor = baselineY;
      return [
        { count: d.onTime, color: "#10b981" },
        { count: d.late, color: "#f59e0b" },
        { count: d.none, color: "#cbd5e1" }
      ]
        .map((seg) => {
          if (seg.count <= 0) return "";
          const segH = (seg.count / maxY) * chartH;
          const y = yCursor - segH;
          yCursor = y;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${segH.toFixed(1)}" fill="${seg.color}"><title>${escapeHtml(d.date)}: ${verb}ตรงเวลา ${d.onTime} · ${verb}สาย ${d.late} · ${noneLabel} ${d.none}</title></rect>`;
        })
        .join("");
    })
    .join("");

  // ป้ายวันที่: เว้นระยะให้เหลือไม่เกิน ~10 ป้าย ไม่ว่า n จะมากหรือน้อย กันป้ายทับกันตอนมีหลายแท่ง
  const labelEvery = Math.max(1, Math.ceil(n / 10));
  const dayLabels = dailyCounts
    .map((d, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return "";
      const x = padLeft + i * slotW + slotW / 2;
      const dayText = (d.date || "").slice(-2).replace(/^0/, "");
      return `<text x="${x.toFixed(1)}" y="${height - 6}" font-size="7" fill="#64748b" text-anchor="middle">${dayText}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px; display:block; margin:0 auto;">
      ${gridLines}
      <line x1="${padLeft}" y1="${baselineY.toFixed(1)}" x2="${width - padRight}" y2="${baselineY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1"/>
      ${bars}
      ${dayLabels}
    </svg>
    <div class="text-[10px] text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
      <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:#10b981"></span>${verb}ตรงเวลา</span>
      <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:#f59e0b"></span>${verb}สาย</span>
      <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:#cbd5e1"></span>${noneLabel}</span>
    </div>
  `;
}

// นับจำนวนครั้งที่แต่ละหัวข้อหลัก (mainPart) ถูกใช้ในแผนการฝึกซ้อม เรียงจากใช้บ่อยไปหาน้อย — ข้าม "-"/ว่างเปล่า
// (บางแผนของผู้รักษาประตูไม่ได้ระบุหัวข้อหลัก) เพราะไม่ใช่หัวข้อจริง นับรวมแล้วจะดูเหมือนหัวข้อยอดฮิตผิดๆ
function countPlanTopics(planList) {
  const counts = new Map();
  for (const p of planList) {
    const topic = (p.mainPart || "").trim();
    if (!topic || topic === "-") continue;
    counts.set(topic, (counts.get(topic) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

// กราฟแท่งแนวนอน 1 แท่งต่อ 1 หัวข้อ — เลือกแนวนอนเพราะชื่อหัวข้อฝึกซ้อมมักยาว (เช่น "Build up (Playing
// through high press)") ขึ้นป้ายแนวตั้งใต้แท่งจะอ่านไม่ออก
function buildTopicBarChartSvg(topics, color) {
  if (topics.length === 0) {
    return '<p class="text-xs text-slate-400 text-center py-4">ไม่มีข้อมูลหัวข้อการฝึกซ้อม</p>';
  }
  const rowH = 20;
  const padTop = 4;
  const padBottom = 4;
  const labelW = 175;
  const barAreaW = 230;
  const countW = 26;
  const width = labelW + barAreaW + countW;
  const height = padTop + padBottom + topics.length * rowH;
  const maxCount = Math.max(...topics.map((t) => t.count));

  const rows = topics
    .map((t, i) => {
      const y = padTop + i * rowH;
      const midY = (y + rowH / 2 + 3).toFixed(1);
      const barW = Math.max((t.count / maxCount) * barAreaW, 2);
      const label = t.topic.length > 32 ? `${t.topic.slice(0, 31)}…` : t.topic;
      return `
        <text x="${labelW - 6}" y="${midY}" font-size="9" fill="#334155" text-anchor="end">${escapeHtml(label)}<title>${escapeHtml(t.topic)}</title></text>
        <rect x="${labelW}" y="${(y + 3).toFixed(1)}" width="${barW.toFixed(1)}" height="${rowH - 8}" rx="2" fill="${color}"><title>${escapeHtml(t.topic)}: ${t.count} ครั้ง</title></rect>
        <text x="${(labelW + barW + 4).toFixed(1)}" y="${midY}" font-size="9" fill="#475569">${t.count}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px; display:block;">${rows}</svg>`;
}

// แถบสัดส่วนรวมทีมเดียวแบบ 100%-stacked แนวนอน แทนกราฟวงกลมเดิม — วงกลมกะสัดส่วนด้วยตาเปล่ายากเมื่อสัดส่วนเบ้มาก
// (เช่น 90% เป็นสถานะเดียว) แถบเทียบความยาวตรงๆ แม่นยำกว่า และย่อพื้นที่หน้าพิมพ์ลงได้มากกว่าวงกลม
function buildQuotaProportionBarHtml(totalOnTime, totalLate, totalMissing) {
  const total = totalOnTime + totalLate + totalMissing;
  if (total === 0) {
    return '<p class="text-xs text-slate-400 text-center py-4">ไม่มีข้อมูล</p>';
  }
  const width = 600;
  const height = 26;
  const segs = [
    { value: totalOnTime, color: "#10b981", label: "ตรงเวลา" },
    { value: totalLate, color: "#f59e0b", label: "สาย" },
    { value: totalMissing, color: "#cbd5e1", label: "ไม่ส่ง" }
  ];
  let x = 0;
  const rects = segs
    .map((s) => {
      if (s.value <= 0) return "";
      const w = (s.value / total) * width;
      const rect = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="${s.color}"><title>${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)</title></rect>`;
      x += w;
      return rect;
    })
    .join("");
  const legend = segs
    .map((s) => {
      const pct = Math.round((s.value / total) * 100);
      return `<span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${s.color}"></span>${s.label} ${pct}% (${s.value})</span>`;
    })
    .join("");

  // สำคัญ: ห้ามใส่ height="${height}" เป็น attribute ตายตัวคู่กับ width="100%" — สัดส่วนกล่อง SVG ที่ได้ (เต็ม
  // ความกว้าง container x สูงคงที่) จะไม่ตรงกับสัดส่วนของ viewBox แล้ว browser จะ letterbox (ย่อเนื้อหาให้พอดี
  // แล้ววางกึ่งกลาง) เหลือพื้นที่ว่าง 2 ข้างเป็นสีพื้นหลังของ div ครอบ ดูเหมือนแท่งสีเทาโผล่มาก่อน/หลังแท่งจริง
  // ทั้งที่โค้ดคำนวณตำแหน่งถูกต้อง (เจอบั๊กนี้จริงตอนทดสอบ) ใช้ style="max-width" แทนเพื่อให้สัดส่วนคงที่เสมอ
  return `
    <div style="border-radius:6px; overflow:hidden; background:#e2e8f0;">
      <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px; display:block;">${rects}</svg>
    </div>
    <div class="text-xs text-slate-500 flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">${legend}</div>
  `;
}

// แถบสัดส่วนขนาดเล็กในแต่ละแถวของตาราง (ตรงเวลา/สาย/ไม่ส่ง เทียบกับเกณฑ์ที่ต้องส่งของโค้ชคนนั้น) แทนกราฟแท่งแยก
// รายโค้ชแบบเดิมที่เคยอยู่คนละที่กับตาราง — เห็นสัดส่วนพร้อมตัวเลขในแถวเดียวกันเลย ไม่ต้องสลับดูกราฟแยก
function buildInlineQuotaBarSvg(onTime, late, missing, quota) {
  const width = 120;
  const height = 10;
  const denom = Math.max(quota, onTime + late + missing, 1);
  const segs = [
    { value: onTime, color: "#10b981" },
    { value: late, color: "#f59e0b" },
    { value: missing, color: "#94a3b8" }
  ];
  let x = 0;
  const rects = segs
    .map((s) => {
      if (s.value <= 0) return "";
      const w = (s.value / denom) * width;
      const rect = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="${s.color}"/>`;
      x += w;
      return rect;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="2" fill="#eef0ec"/>${rects}</svg>`;
}

// แถบผลต่างประตูวิ่งจากกึ่งกลาง (diverging bar) — เขียวไปทางขวาเมื่อได้มากกว่าเสีย แดงไปทางซ้ายเมื่อเสียมากกว่าได้
// เห็นทิศทาง "รุกดี/รับดี" ได้ทันทีโดยไม่ต้องคำนวณลบเลขเอง ความยาวแท่งเทียบกับ maxAbsDiff (ผลต่างที่มากที่สุด
// ในบรรดารุ่นอายุที่แสดง) เพื่อให้เทียบขนาดข้ามการ์ดกันได้
function buildGoalDiffBarSvg(diff, maxAbsDiff) {
  const cx = 120;
  const trackHalf = 90;
  const rawLen = maxAbsDiff > 0 ? (Math.abs(diff) / maxAbsDiff) * trackHalf : 0;
  const barLen = diff === 0 ? 0 : Math.max(rawLen, 2);
  const color = diff > 0 ? "#059669" : diff < 0 ? "#dc2626" : "#94a3b8";
  const diffText = diff > 0 ? `+${diff}` : `${diff}`;
  // ป้ายตัวเลขวางต่อท้ายปลายแท่งจริงเสมอ (ไม่ใช่ตำแหน่งคงที่ริมกรอบ) กันตัวเลขไปทับแท่งตอนแท่งยาวใกล้สุดทาง
  // (เคยเกิดจริง — ค่าผลต่างมากๆ ทำให้แท่งยาวจนป้ายเลข (สีเดียวกับแท่ง) ซ้อนทับแท่งจนตัวเลขบางส่วนมองไม่เห็น)
  const onRight = diff >= 0;
  const textX = onRight ? cx + barLen + 6 : cx - barLen - 6;
  const barX = onRight ? cx : cx - barLen;
  return `
    <svg viewBox="0 0 240 28" width="100%" style="max-width:240px; display:block;">
      <line x1="${cx}" y1="2" x2="${cx}" y2="24" stroke="#e2e8f0"/>
      ${barLen > 0 ? `<rect x="${barX.toFixed(1)}" y="9" width="${barLen.toFixed(1)}" height="10" rx="2" fill="${color}"><title>ผลต่างประตู: ${diffText}</title></rect>` : ""}
      <text x="${textX.toFixed(1)}" y="18.5" font-size="11" font-weight="700" fill="${color}" text-anchor="${onRight ? "start" : "end"}">${diffText}</text>
    </svg>`;
}

// การ์ดสรุปผลการแข่งขันแยกรายรุ่นอายุ (อัตราชนะ/สถิติชนะ-เสมอ-แพ้/ผลต่างประตู รวมไว้ในการ์ดเดียวต่อรุ่น) แทน
// กราฟแท่งแยก 2 กราฟแบบเดิม (ผลแพ้ชนะ + ประตูได้เสียคนละกราฟ ต้องลบเลขเองถึงจะรู้ผลต่าง) — ใช้เกณฑ์สีอัตราชนะ
// เดียวกับ badge ตารางอื่นในหน้านี้ (>=80% เขียว, >=50% เหลือง, ต่ำกว่านั้นแดง)
function buildMatchSummaryCardsHtml(matches) {
  if (matches.length === 0) {
    return '<p class="text-xs text-slate-400 text-center py-6">ไม่มีข้อมูลผลการแข่งขัน</p>';
  }
  const groups = new Map();
  for (const m of matches) {
    const ag = m.ageGroup || "ไม่ระบุรุ่น";
    if (!groups.has(ag)) groups.set(ag, { win: 0, draw: 0, loss: 0, for: 0, against: 0 });
    const g = groups.get(ag);
    if (m.result === "ชนะ") g.win += 1;
    else if (m.result === "เสมอ") g.draw += 1;
    else if (m.result === "แพ้") g.loss += 1;
    g.for += Number(m.scoreUs) || 0;
    g.against += Number(m.scoreThem) || 0;
  }
  const ageGroups = Array.from(groups.keys()).sort((a, b) => ageGroupNumber(a) - ageGroupNumber(b));
  const maxAbsDiff = Math.max(1, ...ageGroups.map((ag) => Math.abs(groups.get(ag).for - groups.get(ag).against)));

  const cards = ageGroups
    .map((ag) => {
      const g = groups.get(ag);
      const total = g.win + g.draw + g.loss;
      const winRate = total > 0 ? Math.round((g.win / total) * 100) : 0;
      const badgeClass = winRate >= 80 ? "badge-success" : winRate >= 50 ? "badge-warning" : "badge-danger";
      const diff = g.for - g.against;
      return `
        <div class="card card-pad flex flex-col gap-2">
          <div class="flex items-baseline justify-between">
            <h4 class="font-semibold text-slate-800">${escapeHtml(ag)}</h4>
            <span class="text-xs text-slate-400">${total} นัด</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${badgeClass} text-base">${winRate}%</span>
            <span class="text-xs text-slate-500">อัตราชนะ</span>
          </div>
          <p class="text-xs text-slate-500">${g.win} ชนะ · ${g.draw} เสมอ · ${g.loss} แพ้</p>
          <div class="border-t border-slate-100 pt-2 mt-1">
            <p class="text-xs text-slate-400 mb-1">ผลต่างประตู (${g.for} ได้ / ${g.against} เสีย)</p>
            ${buildGoalDiffBarSvg(diff, maxAbsDiff)}
          </div>
        </div>`;
    })
    .join("");

  return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>`;
}

// กราฟแท่งกลุ่มความรุนแรงของอาการบาดเจ็บ (เล็กน้อย/ปานกลาง/รุนแรง) แยกตามรุ่นอายุ — กลุ่มแท่งต่อรุ่นอายุแบบ
// เดียวกับที่รายงานผลการแข่งขันด้านบนเคยใช้ (ก่อนเปลี่ยนเป็นการ์ด+แถบผลต่างประตู) เปลี่ยนแค่หมวดหมู่และสี
// ให้เห็นว่ารุ่นไหนมีนักกีฬาบาดเจ็บรุนแรงสะสมมากกว่ากัน
function buildInjurySeverityChartSvg(injuries) {
  if (injuries.length === 0) {
    return '<p class="text-xs text-slate-400 text-center py-6">ไม่มีข้อมูลอาการบาดเจ็บ</p>';
  }
  const groups = new Map();
  for (const i of injuries) {
    const ag = i.ageGroup || "ไม่ระบุรุ่น";
    if (!groups.has(ag)) groups.set(ag, { mild: 0, moderate: 0, severe: 0 });
    const g = groups.get(ag);
    if (i.severity === "รุนแรง") g.severe += 1;
    else if (i.severity === "ปานกลาง") g.moderate += 1;
    else g.mild += 1;
  }
  const ageGroups = Array.from(groups.keys()).sort((a, b) => ageGroupNumber(a) - ageGroupNumber(b));

  const width = 700;
  const height = 190;
  const padTop = 10;
  const padBottom = 24;
  const padLeft = 24;
  const padRight = 8;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const n = ageGroups.length;
  const groupW = chartW / n;
  const groupGap = groupW * 0.18;
  const series = ["mild", "moderate", "severe"];
  const barW = (groupW - groupGap) / series.length;
  const seriesColor = { mild: "#94a3b8", moderate: "#f59e0b", severe: "#ef4444" };
  const maxY = Math.max(...ageGroups.map((ag) => Math.max(groups.get(ag).mild, groups.get(ag).moderate, groups.get(ag).severe)), 1);
  const baselineY = padTop + chartH;

  const gridLines = [0.5, 1]
    .map((frac) => {
      const y = padTop + chartH - frac * chartH;
      return `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>
              <text x="${padLeft - 4}" y="${(y + 2.5).toFixed(1)}" font-size="7" fill="#94a3b8" text-anchor="end">${Math.round(frac * maxY)}</text>`;
    })
    .join("");

  const bars = ageGroups
    .map((ag, gi) => {
      const g = groups.get(ag);
      const groupX = padLeft + gi * groupW + groupGap / 2;
      return series
        .map((key, si) => {
          const val = g[key];
          if (val === 0) return "";
          const barH = (val / maxY) * chartH;
          const x = groupX + si * barW;
          const y = baselineY - barH;
          const label = key === "mild" ? "เล็กน้อย" : key === "moderate" ? "ปานกลาง" : "รุนแรง";
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(barW - 1, 1).toFixed(1)}" height="${barH.toFixed(1)}" rx="1" fill="${seriesColor[key]}"><title>${escapeHtml(ag)} ${label}: ${val} ราย</title></rect>`;
        })
        .join("");
    })
    .join("");

  const groupLabels = ageGroups
    .map((ag, gi) => {
      const x = padLeft + gi * groupW + groupW / 2;
      return `<text x="${x.toFixed(1)}" y="${height - 6}" font-size="8" fill="#64748b" text-anchor="middle">${escapeHtml(ag)}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px; display:block; margin:0 auto;">
      ${gridLines}
      <line x1="${padLeft}" y1="${baselineY.toFixed(1)}" x2="${width - padRight}" y2="${baselineY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1"/>
      ${bars}
      ${groupLabels}
    </svg>
    <div class="text-[10px] text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
      <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:#94a3b8"></span>เล็กน้อย</span>
      <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:#f59e0b"></span>ปานกลาง</span>
      <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:#ef4444"></span>รุนแรง</span>
    </div>
  `;
}

// สรุปแผนการฝึกซ้อม/ผลการแข่งขัน/อาการบาดเจ็บ ของทีม+เดือน+รุ่นอายุเดียวกับตารางผู้เล่นด้านบน — ให้สรุป
// สำหรับพิมพ์มีข้อมูลครบรูปแบบเดียวกับหน้า Dashboard
async function loadPrintExtras(team, ageGroup, month) {
  // ดึงเฉพาะเดือนที่เลือกที่ query เลย (เดิมดึงของทีมทุกเดือนมากรองทีหลัง — attendance โตทุกวันจึงช้าลง/แพงขึ้นเรื่อยๆ)
  // ยกเว้น players/coaches ที่เป็นรายชื่อปัจจุบัน ไม่ผูกกับเดือน
  const { start: monthStart, end: monthEnd } = monthDateRange(month);
  const [trainingPlanSnap, matchSnap, injurySnap, coachSnap, sessionSnap, attendanceSnap, playersSnap, trainingReportSnap] =
    await Promise.all([
      getDocs(teamDateRangeQuery("trainingPlans", team, monthStart, monthEnd)),
      getDocs(teamDateRangeQuery("matchReports", team, monthStart, monthEnd)),
      getDocs(teamDateRangeQuery("injuryReports", team, monthStart, monthEnd)),
      getDocs(query(collection(db, "coaches"), where("team", "==", team), where("role", "==", "coach"))),
      getDocs(teamDateRangeQuery("sessions", team, monthStart, monthEnd)),
      getDocs(teamDateRangeQuery("attendance", team, monthStart, monthEnd)),
      getDocs(query(collection(db, "players"), where("team", "==", team))),
      getDocs(teamDateRangeQuery("trainingReports", team, monthStart, monthEnd))
    ]);

  let coaches = [];
  coachSnap.forEach((d) => coaches.push({ id: d.id, ...d.data() }));
  if (ageGroup !== "__ALL__") {
    coaches = coaches.filter((c) => (c.ageGroups || []).includes(ageGroup));
  }
  coaches.sort(
    (a, b) => ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups) || (a.name ?? "").localeCompare(b.name ?? "")
  );

  // จำนวนวันฝึกซ้อมจริงของเดือนนั้น (sessions ที่ team สร้างไว้ และไม่ได้ถูกทำเครื่องหมาย noTraining) — ใช้เป็น
  // เกณฑ์ "ต้องส่ง/ต้องเช็คชื่อ" ร่วมกันทั้งสรุปแผนการฝึกซ้อมและสรุปการเช็คชื่อด้านล่าง เพราะวันที่ฝึกซ้อมต้องตรงกับ
  // วันที่ส่งแผนการฝึกซ้อม (ไม่ใช่เกณฑ์คงที่ต่อเดือนแบบเดิมอีกต่อไป)
  let sessions = [];
  sessionSnap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
  // รวม session doc ที่มีวันที่ซ้ำกันให้เหลือ 1 รายการต่อวัน (บางครั้งมี session doc ซ้ำวันเดียวกันมากกว่า 1 ใบ
  // เช่น สร้างผิดพลาด/สร้างซ้ำ — เจอจริงจนต้อง dedupe ไว้แล้วใน computeMissingPlanDaysByTeam ของ ui-utils.js)
  // ไม่งั้นกราฟแนวโน้มด้านล่างจะมีแท่ง/ป้ายวันที่ซ้ำกัน และตัวเศษของ "เช็คชื่อตรงวันฝึกซ้อม" จะถูกนับซ้ำสองเท่า
  // ในวันนั้น — เก็บ ids ของทุก session doc ในวันนั้นไว้ (แทน id เดี่ยว) เพื่อให้ยังจับคู่ attendance ที่อาจผูกกับ
  // doc ใดก็ได้ในวันนั้นได้ครบ
  const monthSessionsByDate = new Map();
  for (const s of sessions.filter((s) => (s.date || "").startsWith(month) && !s.noTraining)) {
    if (!monthSessionsByDate.has(s.date)) monthSessionsByDate.set(s.date, { date: s.date, ids: [] });
    monthSessionsByDate.get(s.date).ids.push(s.id);
  }
  const monthSessions = Array.from(monthSessionsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  let attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));

  let allPlayers = [];
  playersSnap.forEach((d) => allPlayers.push({ id: d.id, ...d.data() }));
  const scopedPlayers = ageGroup === "__ALL__" ? allPlayers : allPlayers.filter((p) => p.ageGroup === ageGroup);

  // ---------- สรุปการส่งแผนการฝึกซ้อมรายวัน แยกรายโค้ช (ตรงเวลา/สาย/เกณฑ์ที่ต้องส่ง/% ตรงเวลา) ----------
  // จับคู่แผนกับโค้ชด้วยชื่อ (coachName) ไม่ใช่ coachId เพราะถ้าผู้ดูแลระบบสวมบทบาทส่งแทนโค้ช coachId จะกลายเป็น
  // uid ของผู้ดูแลระบบเอง (หลักการเดียวกับ computeCoachMonthlySummaryRows ในหน้า attendance.html) — คอลัมน์
  // "จำนวนทั้งหมดที่ต้องส่ง" แสดงจำนวนวันฝึกซ้อมจริงของทีมนี้ในเดือนนี้ (ตามตารางฝึกซ้อมปกติของทีม ดู
  // TEAM_TRAINING_WEEKDAYS) ไม่ใช่เกณฑ์คงที่ทุกทีมเท่ากันแบบเดิม — ส่วน % ตรงเวลา เทียบกับจำนวนที่ส่งจริง
  // (onTime/(onTime+late)) วัดคุณภาพความตรงเวลาของสิ่งที่ส่งมาแล้ว
  const monthlyQuota = trainingDaysQuotaForTeamMonth(team, month);
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
    statCard("จำนวนโค้ชทั้งหมด", coaches.length);

  const coachRows = coaches.map((c) => {
    const myPlans = plans.filter((p) => p.coachName === c.name);
    const late = myPlans.filter((p) => isTrainingPlanLate(p)).length;
    const total = myPlans.length;
    const onTime = total - late;
    // ถ้าส่งเกินเกณฑ์ (total > quota) ถือว่าไม่มีจำนวนที่ "ไม่ส่ง" เหลือ ไม่ใช่ค่าติดลบ
    const missing = Math.max(monthlyQuota - total, 0);
    const onTimePercent = total > 0 ? Math.round((onTime / total) * 100) : null;
    return { coach: c, onTime, late, missing, onTimePercent };
  });

  printTrainingPlanQuotaBar.innerHTML = buildQuotaProportionBarHtml(
    coachRows.reduce((sum, r) => sum + r.onTime, 0),
    coachRows.reduce((sum, r) => sum + r.late, 0),
    coachRows.reduce((sum, r) => sum + r.missing, 0)
  );

  if (coachRows.length === 0) {
    printTrainingPlanBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printTrainingPlanBody.innerHTML = coachRows
      .map(({ coach, onTime, late, missing, onTimePercent }) => {
        const percentText = onTimePercent === null ? "-" : `${onTimePercent}%`;
        const percentBadgeClass = onTimePercent === null ? "badge-neutral" : onTimePercent >= 80 ? "badge-success" : onTimePercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${escapeHtml(coach.name ?? "-")}</td>
            <td>${(coach.ageGroups || []).join(", ") || "-"}</td>
            <td>${monthlyQuota}</td>
            <td>${buildInlineQuotaBarSvg(onTime, late, missing, monthlyQuota)}</td>
            <td class="text-emerald-600 font-medium">${onTime}</td>
            <td class="text-red-500 font-medium">${late}</td>
            <td class="text-slate-500 font-medium">${missing}</td>
            <td><span class="badge ${percentBadgeClass}">${percentText}</span></td>
          </tr>`;
      })
      .join("");
    applyDataLabels(printTrainingPlanBody);
  }

  // กราฟแนวโน้มยังอิงวันฝึกซ้อมจริง (monthSessions) เพื่อให้แกน X ตรงกับกราฟเช็คชื่อด้านล่าง ไม่ใช่ทุกวันปฏิทิน
  const planDailyCounts = monthSessions.map((s) => {
    let dOnTime = 0;
    let dLate = 0;
    let dNone = 0;
    for (const c of coaches) {
      const dayPlans = plans.filter((p) => p.date === s.date && p.coachName === c.name);
      if (dayPlans.length === 0) {
        dNone += 1;
        continue;
      }
      if (dayPlans.some((p) => !isTrainingPlanLate(p))) dOnTime += 1;
      else dLate += 1;
    }
    return { date: s.date, onTime: dOnTime, late: dLate, none: dNone };
  });
  printTrainingPlanTrend.innerHTML = buildCoachDailyTrendSvg(planDailyCounts, coaches.length);

  // หัวข้อการฝึกซ้อมที่ใช้ในเดือนนี้ แยกผู้เล่น/ผู้รักษาประตู (trainingType) — ไม่รวมประเภท "Circuit training"
  // เพราะไม่ใช่ทั้งฝั่งผู้เล่นหรือผู้รักษาประตูโดยเฉพาะ
  printTrainingPlanTopicsPlayer.innerHTML = buildTopicBarChartSvg(
    countPlanTopics(plans.filter((p) => p.trainingType === "Player")),
    "#2563eb"
  );
  printTrainingPlanTopicsGk.innerHTML = buildTopicBarChartSvg(
    countPlanTopics(plans.filter((p) => p.trainingType === "Goalkeeper")),
    "#f59e0b"
  );

  // ---------- สรุปการเช็คชื่อ + ให้คะแนนนักกีฬารายวัน แยกรายโค้ช ----------
  // เกณฑ์เดียวกับสรุปแผนการฝึกซ้อมด้านบน คือวันฝึกซ้อมจริง (monthSessions) — วัดว่าโค้ชเช็คชื่อ+ให้คะแนน "ตรงกับ
  // วันที่ทีมฝึกซ้อมจริง" กี่วันจากทั้งหมด ไม่ใช่แค่ดูอัตราตรงเวลาของที่เช็คชื่อมาแล้วเฉยๆ (เกณฑ์เดียวกับ
  // checkinDays/isCoachSubmissionOnTime ใน computeCoachMonthlySummaryRows ของ attendance.js)
  const checkinRows = coaches.map((c) => {
    const myPlayerIds = getCoachPlayerIds(c, scopedPlayers);
    let checkinDays = 0;
    let onTime = 0;
    for (const s of monthSessions) {
      const myAttendanceForSession = attendanceRecords.filter((a) => s.ids.includes(a.sessionId) && myPlayerIds.has(a.playerId));
      if (myAttendanceForSession.length === 0) continue;
      checkinDays += 1;
      if (isCoachSubmissionOnTime(s, myAttendanceForSession)) onTime += 1;
    }
    const late = checkinDays - onTime;
    // เกณฑ์ "ต้องเช็คชื่อ" ใช้จำนวนวันฝึกซ้อมจริงของทีมนี้ในเดือนนี้ (monthlyQuota เดียวกับแผนการฝึกซ้อมด้านบน
    // เพราะทั้งสองกิจกรรมควรเกิดขึ้นทุกวันฝึกซ้อมจริงเท่ากัน) ไม่ใช่ตัวเลขคงที่แบบเดิม — checkinDays ยังนับจาก
    // วันฝึกซ้อมจริง (monthSessions) เหมือนเดิม เพราะเช็คชื่อได้เฉพาะวันที่มี session จริงเท่านั้น แต่ % เทียบกับ
    // เกณฑ์นี้แทน
    const matchPercent = Math.round((checkinDays / monthlyQuota) * 100);
    return { coach: c, checkinDays, onTime, late, matchPercent };
  });

  const totalCheckinDays = checkinRows.reduce((sum, r) => sum + r.checkinDays, 0);
  const totalOnTime = checkinRows.reduce((sum, r) => sum + r.onTime, 0);
  // การ์ดนี้อยู่คู่กับสถิติแบบ "รวม" ของทุกโค้ช (totalCheckinDays ฯลฯ) จึงต้องคูณ coaches.length ด้วย ไม่งั้น
  // จะเทียบกันไม่ตรง (เช่น 22 vs รวมจริง 118 ของ 7 คน — ดูเหมือนทำเกินเกณฑ์ผิดๆ ทั้งที่คูณแล้วยังไม่ถึงเกณฑ์)
  // เกณฑ์ต่อโค้ช 1 คนยังเป็น monthlyQuota เท่าเดิม (ดูคอลัมน์ "จำนวนที่ต้องเช็คชื่อ" ในตารางรายโค้ชด้านล่าง)
  const totalQuota = monthlyQuota * coaches.length;
  printCheckinCards.innerHTML =
    statCard("จำนวนที่ต้องเช็คชื่อ (รวม)", totalQuota) +
    statCard("เช็คชื่อตรงวันฝึกซ้อม (รวม)", totalCheckinDays) +
    statCard("ตรงเวลา (รวม)", totalOnTime) +
    statCard("สาย (รวม)", totalCheckinDays - totalOnTime);

  if (checkinRows.length === 0) {
    printCheckinBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printCheckinBody.innerHTML = checkinRows
      .map(({ coach, checkinDays, onTime, late, matchPercent }) => {
        const percentText = `${matchPercent}%`;
        const percentBadgeClass = matchPercent >= 80 ? "badge-success" : matchPercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${escapeHtml(coach.name ?? "-")}</td>
            <td>${(coach.ageGroups || []).join(", ") || "-"}</td>
            <td>${monthlyQuota}</td>
            <td>${checkinDays}</td>
            <td class="text-emerald-600 font-medium">${onTime}</td>
            <td class="text-red-500 font-medium">${late}</td>
            <td><span class="badge ${percentBadgeClass}">${percentText}</span></td>
          </tr>`;
      })
      .join("");
    applyDataLabels(printCheckinBody);
  }

  const checkinDailyCounts = monthSessions.map((s) => {
    let dOnTime = 0;
    let dLate = 0;
    let dNone = 0;
    for (const c of coaches) {
      const myPlayerIds = getCoachPlayerIds(c, scopedPlayers);
      const myAttendanceForSession = attendanceRecords.filter((a) => s.ids.includes(a.sessionId) && myPlayerIds.has(a.playerId));
      if (myAttendanceForSession.length === 0) {
        dNone += 1;
        continue;
      }
      if (isCoachSubmissionOnTime(s, myAttendanceForSession)) dOnTime += 1;
      else dLate += 1;
    }
    return { date: s.date, onTime: dOnTime, late: dLate, none: dNone };
  });
  printCheckinTrend.innerHTML = buildCoachDailyTrendSvg(checkinDailyCounts, coaches.length, { noneLabel: "ยังไม่เช็คชื่อ", verb: "เช็คชื่อ" });

  // ---------- สรุปการส่งรายงานการฝึกซ้อม แยกรายโค้ช ----------
  // คนละอย่างกับ "แผนการฝึกซ้อม" (ส่งก่อนซ้อม) — รายงานนี้ส่งหลังซ้อมจบ และไม่มีฟิลด์ ageGroups ในตัวเอง (1
  // รายงานต่อโค้ชต่อวัน ไม่แยกตามรุ่นอายุ) จึงกรองตามรายชื่อโค้ชในขอบเขต (coaches) แทนการกรองตัวรายงานเอง — เกณฑ์
  // "ต้องส่ง" ใช้ monthlyQuota เดียวกับแผนการฝึกซ้อม/เช็คชื่อด้านบน (จำนวนวันฝึกซ้อมจริงของทีมตามปฏิทิน) ไม่ใช่
  // จำนวน session ที่มีคนสร้างจริงอีกต่อไป (เดิมใช้ monthSessions.length เป็นเกณฑ์ ทำให้ถ้าทีมไม่ได้สร้าง session
  // ครบทุกวันฝึกซ้อมจริง เกณฑ์จะลดตามไปด้วยเหมือนกับปัญหาที่แก้ในส่วนแผนการฝึกซ้อม/เช็คชื่อ) — ส่วนตัวเศษ
  // (matchDays/onTime) ยังนับจาก monthSessions เหมือนเดิม เพราะส่งรายงานได้เฉพาะวันที่มี session จริงเท่านั้น
  let reports = [];
  trainingReportSnap.forEach((d) => reports.push(d.data()));
  reports = reports.filter((r) => (r.date || "").startsWith(month));

  const reportRows = coaches.map((c) => {
    const myReports = reports.filter((r) => r.coachName === c.name);
    let matchDays = 0;
    let onTime = 0;
    for (const s of monthSessions) {
      const dayReports = myReports.filter((r) => r.date === s.date);
      if (dayReports.length === 0) continue;
      matchDays += 1;
      if (dayReports.some((r) => !isReportLate(r))) onTime += 1;
    }
    const late = matchDays - onTime;
    const matchPercent = Math.round((matchDays / monthlyQuota) * 100);
    return { coach: c, matchDays, onTime, late, matchPercent };
  });

  // การ์ดนี้อยู่คู่กับสถิติแบบ "รวม" ของทุกโค้ช (matchDays ฯลฯ รวมทุกคน) จึงต้องคูณ coaches.length ด้วยเหมือนกับ
  // การ์ดสรุปการเช็คชื่อด้านบน ไม่งั้นจะเทียบกันไม่ตรง — เกณฑ์ต่อโค้ช 1 คนยังเป็น monthlyQuota เท่าเดิม (ดูคอลัมน์
  // "วันฝึกซ้อมทั้งหมด" ในตารางรายโค้ชด้านล่าง)
  printReportCards.innerHTML =
    statCard("วันฝึกซ้อมทั้งหมด (รวม)", monthlyQuota * coaches.length) +
    statCard("ส่งตรงวันฝึกซ้อม (รวม)", reportRows.reduce((sum, r) => sum + r.matchDays, 0)) +
    statCard("ตรงเวลา (รวม)", reportRows.reduce((sum, r) => sum + r.onTime, 0)) +
    statCard("สาย (รวม)", reportRows.reduce((sum, r) => sum + r.late, 0));

  if (reportRows.length === 0) {
    printReportBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printReportBody.innerHTML = reportRows
      .map(({ coach, matchDays, onTime, late, matchPercent }) => {
        const percentText = `${matchPercent}%`;
        const percentBadgeClass = matchPercent >= 80 ? "badge-success" : matchPercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${escapeHtml(coach.name ?? "-")}</td>
            <td>${(coach.ageGroups || []).join(", ") || "-"}</td>
            <td>${monthlyQuota}</td>
            <td>${matchDays}</td>
            <td class="text-emerald-600 font-medium">${onTime}</td>
            <td class="text-red-500 font-medium">${late}</td>
            <td><span class="badge ${percentBadgeClass}">${percentText}</span></td>
          </tr>`;
      })
      .join("");
    applyDataLabels(printReportBody);
  }

  const reportDailyCounts = monthSessions.map((s) => {
    let dOnTime = 0;
    let dLate = 0;
    let dNone = 0;
    for (const c of coaches) {
      const dayReports = reports.filter((r) => r.date === s.date && r.coachName === c.name);
      if (dayReports.length === 0) {
        dNone += 1;
        continue;
      }
      if (dayReports.some((r) => !isReportLate(r))) dOnTime += 1;
      else dLate += 1;
    }
    return { date: s.date, onTime: dOnTime, late: dLate, none: dNone };
  });
  printReportTrend.innerHTML = buildCoachDailyTrendSvg(reportDailyCounts, coaches.length, { noneLabel: "ยังไม่ส่งรายงาน" });

  // ---------- ความสอดคล้องของการทำงานประจำวัน (แผน + เช็คชื่อ + รายงาน) แยกรายโค้ช ----------
  // นับเฉพาะวันฝึกซ้อมจริง (monthSessions) ที่โค้ชคนนั้นส่งครบทั้ง 3 อย่าง (ไม่สนว่าตรงเวลาหรือสาย เพราะความ
  // ตรงเวลาแยกดูได้แล้วในแต่ละส่วนด้านบน — ส่วนนี้วัดแค่ "ทำครบหรือไม่" ในวันเดียวกัน) — เกณฑ์ "วันฝึกซ้อมทั้งหมด"
  // ใช้ monthlyQuota เหมือน 3 ส่วนด้านบน (ดูเหตุผลที่คอมเมนต์ของสรุปการส่งรายงานการฝึกซ้อม) ไม่ใช่ monthSessions.length
  const consistencyRows = coaches.map((c) => {
    const myPlayerIds = getCoachPlayerIds(c, scopedPlayers);
    const myPlans = plans.filter((p) => p.coachName === c.name);
    const myReports = reports.filter((r) => r.coachName === c.name);
    let complete = 0;
    for (const s of monthSessions) {
      const hasPlan = myPlans.some((p) => p.date === s.date);
      const hasCheckin = attendanceRecords.some((a) => s.ids.includes(a.sessionId) && myPlayerIds.has(a.playerId));
      const hasReport = myReports.some((r) => r.date === s.date);
      if (hasPlan && hasCheckin && hasReport) complete += 1;
    }
    // ถ้าทำครบเกินเกณฑ์ (เช่น team มี session จริงมากกว่า monthlyQuota) ถือว่าไม่มีจำนวนที่ "ขาด" เหลือ ไม่ใช่ค่าติดลบ
    const incomplete = Math.max(monthlyQuota - complete, 0);
    const completePercent = Math.round((complete / monthlyQuota) * 100);
    return { coach: c, complete, incomplete, completePercent };
  });

  if (consistencyRows.length === 0) {
    printConsistencyBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printConsistencyBody.innerHTML = consistencyRows
      .map(({ coach, complete, incomplete, completePercent }) => {
        const percentText = `${completePercent}%`;
        const percentBadgeClass = completePercent >= 80 ? "badge-success" : completePercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${escapeHtml(coach.name ?? "-")}</td>
            <td>${(coach.ageGroups || []).join(", ") || "-"}</td>
            <td>${monthlyQuota}</td>
            <td class="text-emerald-600 font-medium">${complete}</td>
            <td class="text-red-500 font-medium">${incomplete}</td>
            <td><span class="badge ${percentBadgeClass}">${percentText}</span></td>
          </tr>`;
      })
      .join("");
    applyDataLabels(printConsistencyBody);
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

  printMatchSummaryCards.innerHTML = buildMatchSummaryCardsHtml(matches);

  if (matches.length === 0) {
    printMatchBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายการแข่งขันในเดือนนี้</td></tr>';
  } else {
    printMatchBody.innerHTML = matches
      .map(
        (m) => `
        <tr>
          <td class="emphasis">${escapeHtml(m.date ?? "-")}</td>
          <td>${escapeHtml(m.ageGroup ?? "-")}</td>
          <td>${escapeHtml(m.opponent ?? "-")}</td>
          <td>${escapeHtml(m.competitionType ?? "-")}</td>
          <td>${matchResultBadge(m.result)}</td>
          <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
          <td>${escapeHtml(m.competition ?? "-")}</td>
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

  printInjuryChart.innerHTML = buildInjurySeverityChartSvg(injuries);

  if (injuries.length === 0) {
    printInjuryBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ไม่มีรายงานอาการบาดเจ็บในเดือนนี้</td></tr>';
  } else {
    printInjuryBody.innerHTML = injuries
      .map(
        (inj) => `
        <tr>
          <td class="emphasis">${escapeHtml(inj.date ?? "-")}</td>
          <td class="emphasis">${escapeHtml(inj.playerName ?? "-")}</td>
          <td>${escapeHtml(inj.description ?? "-")}</td>
          <td>${injurySeverityBadge(inj.severity)}</td>
          <td>${injuryStatusBadge(inj.status)}</td>
          <td>${escapeHtml(inj.expectedReturn ?? "-")}</td>
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
    const month = params.get("month") || thisMonthBangkok();

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
