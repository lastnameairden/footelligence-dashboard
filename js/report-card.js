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
  calcAge,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  categoryAveragesFromRecords,
  applyDataLabels,
  STATUS_LABELS,
  TEAM_COLORS,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_COLORS
} from "./ui-utils.js";
import { CRITERIA, SECT, categoryRawScore, scoreToGrade } from "./masc-data.js";

const UNASSIGNED_AGE_GROUP = "ไม่ระบุรุ่นอายุ";
const DEFAULT_ACCENT = "#0f172a";
// สีตามความหมาย (เขียว=มา/บวก, แดง=บาดเจ็บ/ลบ, เหลือง=พักฟื้น/เป็นกลาง, เทา=ลา) ใช้ให้การ์ดสถิติมีสีสันแต่ยังสื่อ
// ความหมายตรงกับ badge สี success/danger/warning/neutral ที่ใช้อยู่แล้วทั่วแอป
const STATUS_COLORS = { A: "#16a34a", I: "#dc2626", R: "#d97706", P: "#64748b" };

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

// ตัดรายการให้เหลือไม่เกิน max แถว พร้อมบอกว่ามีเพิ่มอีกกี่รายการ — กันตารางประวัติยาวจนล้นหน้ากระดาษ (นักกีฬา
// ที่มีข้อมูลเยอะผิดปกติ เช่น ลงแข่ง/บาดเจ็บถี่มาก) พ่อแม่ยังเห็นรายการล่าสุดครบ แค่ไม่เห็นแบบละเอียดทั้งหมด
function capRows(items, max) {
  return { shown: items.slice(0, max), extra: Math.max(0, items.length - max) };
}

function buildHistoryTable(headers, rows, extraCount) {
  if (rows.length === 0) {
    return '<p class="text-xs text-slate-400">ไม่มีข้อมูลในช่วงเวลานี้</p>';
  }
  const wrap = document.createElement("div");
  wrap.className = "card table-wrap rc-mini-table";
  wrap.innerHTML = `
    <table class="pro-table">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = wrap.querySelector("tbody");
  tbody.innerHTML = rows.join("");
  applyDataLabels(tbody);
  const extraNote = extraCount > 0 ? `<p class="text-[10px] text-slate-400 mt-0.5">และอีก ${extraCount} รายการ</p>` : "";
  return wrap.outerHTML + extraNote;
}

// รวมค่าเฉลี่ยรอบก่อน/รอบนี้ทั้ง 4 หมวด พร้อม delta (ผลต่าง) — ใช้ใน Key takeaways เท่านั้นตอนนี้ (เดิมมีตาราง
// เปรียบเทียบแสดงด้วย แต่ผู้ใช้ให้เอาออกแล้วใส่ผลประเมิน MASC โดยละเอียดแทน — ดู buildMascSection)
function categoryComparisons(prevRecords, currentRecords) {
  const prevAverages = categoryAveragesFromRecords(prevRecords);
  const currentAverages = categoryAveragesFromRecords(currentRecords);
  return currentAverages.map((cur, i) => {
    const prev = prevAverages[i];
    const delta = cur.avg !== null && prev.avg !== null ? cur.avg - prev.avg : null;
    return { key: cur.key, label: cur.short, prevAvg: prev.avg, curAvg: cur.avg, delta };
  });
}

// สรุปประเด็นสำคัญเป็นข้อความสั้นๆ (จุดแข็ง/จุดที่ควรพัฒนา/พัฒนาการเด่น/สรุปลงสนาม/สรุปเข้าฝึกซ้อม) — สร้างจาก
// ข้อมูลจริงล้วนๆ ไม่เดาหรือเติมข้อมูลที่ไม่มี ข้อไหนไม่มีข้อมูลพอจะสรุปก็ข้ามไปเฉยๆ — จำกัดไว้ไม่เกิน 4 ข้อ กันล้นกรอบ
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
  return bullets.slice(0, 4);
}

function matchStatsFor(matchReports) {
  return {
    total: matchReports.length,
    win: matchReports.filter((m) => m.result === "ชนะ").length,
    draw: matchReports.filter((m) => m.result !== "ชนะ" && m.result !== "แพ้").length,
    loss: matchReports.filter((m) => m.result === "แพ้").length
  };
}

// การ์ดสถิติจิ๋วมีสี — ต่างจาก statCard กลาง (ui-utils.js, สีเทาเรียบใช้ทั่วแอป) เพราะหน้านี้ต้องการความมีสีสัน
// ตามที่ผู้ใช้ขอโดยเฉพาะ ไม่กระทบหน้าจออื่น — พื้นหลังโทนอ่อนของสีที่ระบุ (~10% opacity) ตัวเลข/label ใช้สีเข้ม
function colorStatCard(label, value, hex) {
  return `
    <div class="rounded-lg p-1.5 text-center" style="background:${hex}1a; border:1px solid ${hex}40;">
      <p class="text-[9px] font-medium leading-tight" style="color:${hex}">${label}</p>
      <p class="text-sm font-bold leading-tight" style="color:${hex}">${value}</p>
    </div>
  `;
}

const ROLE_LABELS = { important: "ตัวหลัก", rotation: "ตัวหมุนเวียน", reserve: "ตัวสำรอง" };
const MASC_COLORS = { M: "#0ea5e9", A: "#8b5cf6", S: "#f59e0b", C: "#ec4899" };

// เกรด M/A/S/C (1/3/7/9) จากการประเมิน MASC ล่าสุด — คืนค่า null ทั้งหมดถ้ายังไม่เคยประเมิน (ใช้ทั้งในป้ายเล็กๆ
// ใต้ Profile Radar และเนื้อหาข้อความในคอลัมน์ผลประเมิน แยกฟังก์ชันไว้กันคำนวณเพี้ยนกันคนละจุด)
function mascGradesFor(evaluation) {
  return ["M", "A", "S", "C"].map((key) => ({
    key,
    grade: evaluation ? scoreToGrade(categoryRawScore(evaluation.scores?.[key])) : null
  }));
}

// กราฟเรดาร์ของเกรด MASC (M/A/S/C) 4 แกน สเกล 1-9 (ค่าที่ระบบให้จริงมีแค่ 1/3/7/9) แทนที่ป้ายตัวเลขเดิมในแถบซ้าย
// ให้เห็นรูปทรงจุดแข็ง/จุดที่ต้องพัฒนาได้ในภาพเดียว เหมือนกับที่ Profile Radar เคยทำกับคะแนนรายวัน (ซึ่งย้ายไป
// เป็นกราฟแนวโน้มในคอลัมน์กลางแทนแล้ว — ดู buildCategoryTrendChartSvg)
function buildMascRadarSvg(mascGrades, size = 130) {
  const hasAnyData = mascGrades.some((g) => g.grade !== null);
  if (!hasAnyData) {
    return '<p class="text-xs text-slate-400 text-center py-4">ยังไม่มีข้อมูลการประเมิน MASC</p>';
  }
  const maxScore = 9;
  const n = mascGrades.length;
  // เผื่อขอบซ้าย/ขวา/บน-ล่างของ canvas ให้กว้างกว่าวงกลมจริง ไม่งั้นป้ายชื่อ+ตัวเลขของจุดซ้ายสุด/ขวาสุด
  // (ที่ text-anchor เป็น start/end) จะยื่นออกไปนอก viewBox แล้วโดนตัดหาย (พบจากภาพที่ผู้ใช้ส่งมา)
  const padX = 28;
  const padY = 16;
  const canvasW = size + padX * 2;
  const canvasH = size + padY * 2;
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const R = size * 0.32;
  const angles = mascGrades.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);
  const point = (angle, fraction) => ({
    x: cx + R * fraction * Math.cos(angle),
    y: cy + R * fraction * Math.sin(angle)
  });

  const gridRings = [0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const pts = angles.map((a) => point(a, fraction)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="1" />`;
    })
    .join("");

  const spokes = angles
    .map((a) => {
      const p = point(a, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />`;
    })
    .join("");

  const dataPoints = angles.map((a, i) => point(a, (mascGrades[i].grade ?? 0) / maxScore));
  const polygon = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const dots = dataPoints
    .map((p, i) => {
      const g = mascGrades[i];
      const color = MASC_COLORS[g.key];
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}"><title>${g.key}: ${g.grade ?? "-"}</title></circle>`;
    })
    .join("");

  const labelR = R + 16;
  const labels = angles
    .map((a, i) => {
      const p = point(a, labelR / R);
      const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
      const g = mascGrades[i];
      const color = MASC_COLORS[g.key];
      return `<text x="${p.x.toFixed(1)}" y="${(p.y + 3).toFixed(1)}" font-size="9" font-weight="700" fill="${color}" text-anchor="${anchor}">${g.key} ${g.grade ?? "-"}</text>`;
    })
    .join("");

  // คำอธิบายสีใต้กราฟ (สีไหน = หมวดอะไร) แยกจากป้ายชื่อบนกราฟที่มีแค่ตัวย่อ M/A/S/C
  const legend = ["M", "A", "S", "C"]
    .map(
      (key) =>
        `<span class="inline-flex items-center gap-0.5"><span class="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:${MASC_COLORS[key]}"></span>${key} · ${SECT[key].nm}</span>`
    )
    .join("");

  return `
    <svg viewBox="0 0 ${canvasW} ${canvasH}" width="100%" style="max-width:${canvasW}px; margin:0 auto; display:block">
      ${gridRings}
      ${spokes}
      <polygon points="${polygon}" fill="#64748b" fill-opacity="0.08" stroke="#94a3b8" stroke-width="1.5" />
      ${dots}
      ${labels}
    </svg>
    <div class="text-[7px] text-slate-500 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 mt-0.5">${legend}</div>
  `;
}

// รายละเอียดผลประเมิน MASC ล่าสุดของนักกีฬาคนนี้แบบครบทุกเกณฑ์ (ดึงจากฟีเจอร์ "🧬 การประเมิน MASC" ที่มีอยู่แล้ว
// ในระบบ — เก็บจริงใน Firestore collection playerEvaluations) ไม่ใช่จากฟอร์มภายนอกที่ผู้ใช้ส่งลิงก์มา เพราะฟอร์ม
// นั้นเป็น static form ล้วนๆ ไม่มีฐานข้อมูลให้ดึง — แทนที่ตารางเปรียบเทียบคะแนนรายวัน 4 หมวดเดิมตามที่ผู้ใช้ขอ
// (เอาออกแล้วใส่ผล MASC แบบละเอียดแทน) เกณฑ์แต่ละข้อดึง label ตามตำแหน่ง/ช่วงอายุของนักกีฬาจาก masc-data.js
// เหมือนกับที่หน้า masc.html ใช้จริง (CRITERIA[position][ageBracket][category])
function buildMascSection(evaluation) {
  if (!evaluation) {
    return '<p class="text-xs text-slate-400">ยังไม่มีข้อมูลการประเมิน MASC สำหรับนักกีฬาคนนี้</p>';
  }
  const roleText = (evaluation.playerRoles || []).map((r) => ROLE_LABELS[r] || r).join(", ") || "-";
  const updatedLabel = evaluation.updatedAt?.toDate
    ? evaluation.updatedAt.toDate().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    : "-";
  const criteriaForPosition = CRITERIA[evaluation.position]?.[evaluation.ageBracket] || null;

  const categoryBlocks = ["M", "A", "S", "C"]
    .map((key) => {
      const grade = scoreToGrade(categoryRawScore(evaluation.scores?.[key]));
      const criteriaList = criteriaForPosition?.[key] || [];
      const scoreValues = evaluation.scores?.[key] || [];
      const rows =
        criteriaList
          .map(([th], i) => {
            const val = scoreValues[i];
            const weightLabel = i === 0 ? "CORE" : "SUP";
            return `<p class="flex justify-between gap-1 leading-tight"><span class="text-slate-500 truncate">${weightLabel} · ${th}</span><span class="font-semibold flex-shrink-0" style="color:${MASC_COLORS[key]}">${val ?? "-"}</span></p>`;
          })
          .join("") || '<p class="text-slate-400">ไม่พบเกณฑ์สำหรับตำแหน่ง/ช่วงอายุนี้</p>';
      return `
        <div class="rounded-lg p-1.5" style="background:${MASC_COLORS[key]}0d; border:1px solid ${MASC_COLORS[key]}30;">
          <p class="flex items-center justify-between mb-0.5">
            <span class="text-[10px] font-bold" style="color:${MASC_COLORS[key]}">${key} · ${SECT[key].nm}</span>
            <span class="text-xs font-bold" style="color:${MASC_COLORS[key]}">เกรด ${grade ?? "-"}</span>
          </p>
          <div class="text-[9px] space-y-0.5">${rows}</div>
        </div>`;
    })
    .join("");

  return `
    <p class="text-[10px] text-slate-400 mb-1">ประเมินล่าสุด: ${evaluation.assessmentPeriod || "-"} • อัปเดต ${updatedLabel} • ตำแหน่ง ${evaluation.position ?? "-"} (${evaluation.ageBracket ?? "-"}) • บทบาท: ${roleText}</p>
    <div class="grid grid-cols-2 gap-1.5">${categoryBlocks}</div>
    <div class="text-[10px] text-slate-600 space-y-0.5 mt-1.5">
      ${evaluation.talent ? `<p class="line-clamp-1"><span class="font-semibold text-slate-500">จุดเด่น:</span> ${evaluation.talent}</p>` : ""}
      ${evaluation.limitations ? `<p class="line-clamp-1"><span class="font-semibold text-slate-500">จุดที่ต้องพัฒนา:</span> ${evaluation.limitations}</p>` : ""}
    </div>
  `;
}

function shortThaiMonthLabel(monthStr) {
  return new Date(`${monthStr}-01T00:00:00`).toLocaleDateString("th-TH", { year: "2-digit", month: "short" });
}

// กราฟแท่งกลุ่มรายเดือนของคะแนนประเมินรายวัน 4 ด้าน แทนที่ Profile Radar เดิมซึ่งย้ายไปเป็นเรดาร์ MASC ในแถบซ้าย
// แล้ว — เลือกใช้แท่งแทนเส้นเพราะรอบเวลาสั้น (มักแค่ 2-3 เดือน) กราฟเส้นจะมีจุดน้อยจนดูโล่ง ไม่มีน้ำหนักภาพ ส่วน
// แท่งยังดูมีเนื้อหาครบแม้มีข้อมูลน้อยจุด — สีแท่งตรงกับ SCORE_CATEGORY_COLORS เหมือนเดิม
function buildCategoryTrendChartSvg(records, start, end) {
  const months = monthsInRange(start, end);
  const width = 230;
  const height = 92;
  const padTop = 8;
  const padBottom = 16;
  const padLeft = 16;
  const padRight = 6;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxScore = 4;

  const series = SCORE_CATEGORIES.map((cat) => {
    const values = months.map((month) => {
      const monthRecords = records.filter((r) => (r.date || "").startsWith(month));
      let sum = 0;
      let count = 0;
      for (const r of monthRecords) {
        const v = r.scores?.[cat.key];
        if (typeof v === "number") {
          sum += v;
          count += 1;
        }
      }
      return count > 0 ? sum / count : null;
    });
    return { key: cat.key, label: cat.short, color: SCORE_CATEGORY_COLORS[cat.key], values };
  });

  const hasAnyData = series.some((s) => s.values.some((v) => v !== null));
  if (!hasAnyData) {
    return '<p class="text-xs text-slate-400 text-center py-6">ยังไม่มีข้อมูลคะแนนเพียงพอสำหรับแสดงกราฟ</p>';
  }

  const gridLines = [2, 4]
    .map((v) => {
      const y = padTop + chartH - (v / maxScore) * chartH;
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />
              <text x="${padLeft - 3}" y="${y + 2.5}" font-size="6" fill="#94a3b8" text-anchor="end">${v}</text>`;
    })
    .join("");

  const baselineY = padTop + chartH;
  const groupWidth = chartW / months.length;
  const groupGap = groupWidth * 0.18; // ช่องว่างระหว่างกลุ่มเดือน กันแท่งของเดือนติดกันจนดูเป็นแท่งเดียว
  const barWidth = (groupWidth - groupGap) / series.length;

  const bars = months
    .map((month, gi) => {
      const groupX = padLeft + gi * groupWidth + groupGap / 2;
      return series
        .map((s, si) => {
          const val = s.values[gi];
          if (val === null) return "";
          const barH = (val / maxScore) * chartH;
          const x = groupX + si * barWidth;
          const y = baselineY - barH;
          const w = Math.max(barWidth - 1, 1);
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${barH.toFixed(1)}" rx="1" fill="${s.color}"><title>${s.label}: ${val.toFixed(1)}</title></rect>`;
        })
        .join("");
    })
    .join("");

  const monthLabels = months
    .map((m, i) => {
      const x = padLeft + i * groupWidth + groupWidth / 2;
      return `<text x="${x.toFixed(1)}" y="${height - 4}" font-size="6" fill="#64748b" text-anchor="middle">${shortThaiMonthLabel(m)}</text>`;
    })
    .join("");

  const legend = SCORE_CATEGORIES.map(
    (cat) =>
      `<span class="inline-flex items-center gap-0.5"><span class="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:${SCORE_CATEGORY_COLORS[cat.key]}"></span>${cat.short.replace(/^\d+\.\s*/, "")}</span>`
  ).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      <line x1="${padLeft}" y1="${baselineY.toFixed(1)}" x2="${width - padRight}" y2="${baselineY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1" />
      ${bars}
      ${monthLabels}
    </svg>
    <div class="text-[7px] text-slate-500 flex flex-wrap justify-center gap-x-1.5 mt-0.5">${legend}</div>
  `;
}

// การ์ดรายงานแนวนอน (A4 landscape) 3 คอลัมน์ ตามรูปแบบตัวอย่างที่ผู้ใช้ส่งมา — แถบสีหัวกระดาษใช้สีประจำทีม
// (TEAM_COLORS) ไม่มีรูปนักกีฬาจริงในระบบ จึงใช้โลโก้ทีมแทนไอคอนวงกลม ส่วนหมวดคะแนน 4 ด้านที่มีอยู่แล้วยังคงเดิม
function buildPlayerPage(player, data, scope) {
  const { team, start, end } = scope;
  const accent = TEAM_COLORS[team] || DEFAULT_ACCENT;
  const age = calcAge(player.birthday);
  const comparisons = categoryComparisons(data.prevAttendanceRecords, data.attendanceRecords);
  const matchStats = matchStatsFor(data.matchReports);

  const statusCounts = { A: 0, I: 0, R: 0, P: 0 };
  for (const r of data.attendanceRecords) {
    if (r.status && Object.prototype.hasOwnProperty.call(statusCounts, r.status)) statusCounts[r.status] += 1;
  }

  const mascGrades = mascGradesFor(data.mascEvaluation);

  const page = document.createElement("div");
  page.className = "report-card-page card overflow-hidden";
  page.style.setProperty("--accent", accent);

  // ---------- แถบหัวกระดาษสีประจำทีม ----------
  const header = document.createElement("div");
  header.className = "flex items-center justify-between px-4 py-2 text-white";
  header.style.background = accent;
  header.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
        ${teamLogoImg(team, "w-6 h-6 object-contain")}
      </div>
      <div>
        <p class="text-sm font-bold leading-tight">${player.nickname || player.fullName || "-"} <span class="font-normal opacity-80">• ${player.fullName ?? "-"}</span></p>
        <p class="text-[10px] opacity-90 leading-tight">${team} • รอบการประเมิน ${monthRangeLabel(start, end)}</p>
      </div>
    </div>
    <p class="text-[10px] opacity-90 whitespace-nowrap">ออกรายงาน ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}</p>
  `;
  page.appendChild(header);

  const body = document.createElement("div");
  body.className = "grid grid-cols-[170px_1fr_1fr] gap-3 p-3";

  // ---------- คอลัมน์ 1: โปรไฟล์นักกีฬา ----------
  const sidebar = document.createElement("aside");
  sidebar.className = "space-y-1.5";
  sidebar.innerHTML = `
    <p class="text-[9px] font-semibold tracking-wide uppercase" style="color:${accent}">Player Profile</p>
    <div class="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-slate-50 mx-auto" style="border:2px solid ${accent}">
      ${player.photoUrl ? `<img src="${player.photoUrl}" alt="รูปนักกีฬา" class="w-full h-full object-cover" />` : teamLogoImg(team, "w-9 h-9 object-contain")}
    </div>
    <div class="text-[10px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
      <p class="flex justify-between"><span class="text-slate-400">รุ่น</span><span class="font-medium">${player.ageGroup || UNASSIGNED_AGE_GROUP}</span></p>
      <p class="flex justify-between"><span class="text-slate-400">อายุ</span><span class="font-medium">${age !== null ? `${age} ปี` : "-"}</span></p>
      <p class="flex justify-between"><span class="text-slate-400">ตำแหน่ง</span><span class="font-medium">${player.position ?? "-"}</span></p>
      <p class="flex justify-between"><span class="text-slate-400">เบอร์เสื้อ</span><span class="font-medium">${player.number ?? "-"}</span></p>
    </div>
    <p class="text-[9px] font-semibold tracking-wide uppercase pt-1 border-t border-slate-100" style="color:${accent}">MASC ล่าสุด</p>
    <div>${buildMascRadarSvg(mascGrades, 130)}</div>
  `;
  body.appendChild(sidebar);

  // ---------- คอลัมน์ 2: ผลการประเมิน + MASC ----------
  const col2 = document.createElement("div");
  col2.className = "space-y-2";

  const statsWrap = document.createElement("div");
  statsWrap.className = "grid grid-cols-4 gap-1.5";
  statsWrap.innerHTML =
    colorStatCard("นัดที่ลงสนาม", matchStats.total, "#2563eb") +
    colorStatCard("ผล (ช-ส-พ)", `${matchStats.win}-${matchStats.draw}-${matchStats.loss}`, "#7c3aed") +
    colorStatCard("% เข้าซ้อม", `${data.percent}%`, "#059669") +
    colorStatCard("คะแนนเฉลี่ย", data.overallAvg !== null ? data.overallAvg.toFixed(2) : "-", "#d97706");
  col2.appendChild(statsWrap);

  const mascTitle = document.createElement("h4");
  mascTitle.className = "text-xs font-semibold pl-2";
  mascTitle.style.borderLeft = `3px solid ${accent}`;
  mascTitle.textContent = "การประเมิน MASC โดยละเอียด";
  col2.appendChild(mascTitle);
  const mascWrap = document.createElement("div");
  mascWrap.innerHTML = buildMascSection(data.mascEvaluation);
  col2.appendChild(mascWrap);

  // เดิม Profile Radar (คะแนนรายวัน 4 ด้าน) อยู่ในแถบซ้าย ย้ายมาแสดงเป็นกราฟแนวโน้มรายเดือนตรงนี้แทนตามที่ผู้ใช้
  // ขอ — แถบซ้ายเหลือแค่เรดาร์ MASC (ดู mascGrades ด้านบน) ไม่ให้มีเรดาร์ซ้ำสองอันในหน้าเดียว
  const trendTitle = document.createElement("h4");
  trendTitle.className = "text-xs font-semibold pl-2";
  trendTitle.style.borderLeft = `3px solid ${accent}`;
  trendTitle.textContent = "แนวโน้มคะแนนประเมินรายวัน (รายเดือน)";
  col2.appendChild(trendTitle);
  const trendWrap = document.createElement("div");
  trendWrap.className = "card p-1.5 max-w-[240px] mx-auto";
  trendWrap.innerHTML = buildCategoryTrendChartSvg(data.attendanceRecords, start, end);
  col2.appendChild(trendWrap);

  body.appendChild(col2);

  // ---------- คอลัมน์ 3: ประวัติและสรุปประเด็นสำคัญ ----------
  const col3 = document.createElement("div");
  col3.className = "space-y-2";

  const attendanceTitle = document.createElement("h4");
  attendanceTitle.className = "text-xs font-semibold pl-2";
  attendanceTitle.style.borderLeft = `3px solid ${accent}`;
  attendanceTitle.textContent = "สรุปการฝึกซ้อม";
  col3.appendChild(attendanceTitle);
  const attendanceSummaryWrap = document.createElement("div");
  attendanceSummaryWrap.className = "grid grid-cols-4 gap-1.5";
  attendanceSummaryWrap.innerHTML = Object.keys(STATUS_LABELS)
    .map((key) => colorStatCard(STATUS_LABELS[key], `${statusCounts[key]} ครั้ง`, STATUS_COLORS[key]))
    .join("");
  col3.appendChild(attendanceSummaryWrap);

  const matchTitle = document.createElement("h4");
  matchTitle.className = "text-xs font-semibold pl-2";
  matchTitle.style.borderLeft = `3px solid ${accent}`;
  matchTitle.textContent = "ผลการแข่งขันที่ลงสนาม";
  col3.appendChild(matchTitle);
  const cappedMatches = capRows(
    [...data.matchReports].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    4
  );
  const matchRows = cappedMatches.shown.map(
    (m) => `
      <tr>
        <td class="emphasis">${m.date ?? "-"}</td>
        <td>${m.opponent ?? "-"}</td>
        <td>${matchResultBadge(m.result)}</td>
        <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
      </tr>`
  );
  const matchWrap = document.createElement("div");
  matchWrap.innerHTML = buildHistoryTable(["วันที่", "คู่แข่ง", "ผล", "สกอร์"], matchRows, cappedMatches.extra);
  col3.appendChild(matchWrap);

  const injuryTitle = document.createElement("h4");
  injuryTitle.className = "text-xs font-semibold pl-2";
  injuryTitle.style.borderLeft = `3px solid ${accent}`;
  injuryTitle.textContent = "ประวัติการบาดเจ็บ";
  col3.appendChild(injuryTitle);
  const cappedInjuries = capRows(
    [...data.injuryReports].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    3
  );
  const injuryRows = cappedInjuries.shown.map(
    (inj) => `
      <tr>
        <td class="emphasis">${inj.date ?? "-"}</td>
        <td>${inj.description ?? "-"}</td>
        <td>${injurySeverityBadge(inj.severity)}</td>
        <td>${injuryStatusBadge(inj.status)}</td>
      </tr>`
  );
  const injuryWrap = document.createElement("div");
  injuryWrap.innerHTML = buildHistoryTable(["วันที่", "อาการ", "ความรุนแรง", "สถานะ"], injuryRows, cappedInjuries.extra);
  col3.appendChild(injuryWrap);

  const keyTakeawaysTitle = document.createElement("h4");
  keyTakeawaysTitle.className = "text-xs font-semibold pl-2";
  keyTakeawaysTitle.style.borderLeft = `3px solid ${accent}`;
  keyTakeawaysTitle.textContent = "สรุปประเด็นสำคัญ";
  col3.appendChild(keyTakeawaysTitle);
  const takeaways = buildKeyTakeaways(comparisons, matchStats, {
    total: data.totalCount,
    attended: statusCounts.A,
    percent: data.percent
  });
  const takeawaysWrap = document.createElement("div");
  takeawaysWrap.className = "rounded-lg p-2";
  takeawaysWrap.style.background = `${accent}0d`;
  takeawaysWrap.innerHTML =
    takeaways.length > 0
      ? `<ul class="text-[10px] text-slate-600 space-y-0.5 list-disc pl-3">${takeaways.map((t) => `<li>${t}</li>`).join("")}</ul>`
      : '<p class="text-[10px] text-slate-400">ยังไม่มีข้อมูลเพียงพอสำหรับสรุปประเด็นสำคัญ</p>';
  col3.appendChild(takeawaysWrap);

  body.appendChild(col3);
  page.appendChild(body);

  // ---------- ส่วนล่าง: คำเห็นโค้ช + ลายเซ็น (เต็มความกว้าง ใต้ 3 คอลัมน์) ----------
  const footerWrap = document.createElement("div");
  footerWrap.className = "px-4 pb-3 pt-2 border-t border-slate-100";

  const commentTitle = document.createElement("h4");
  commentTitle.className = "text-xs font-semibold pl-2 mb-1";
  commentTitle.style.borderLeft = `3px solid ${accent}`;
  commentTitle.textContent = "ข้อเสนอแนะจากโค้ช";
  footerWrap.appendChild(commentTitle);

  const commentRow = document.createElement("div");
  commentRow.className = "grid grid-cols-[1fr_200px] gap-3 items-start";

  const commentPrintText = document.createElement("p");
  commentPrintText.className = "print-only text-xs whitespace-pre-wrap border border-slate-200 rounded-lg p-2 min-h-[2.5rem] line-clamp-3";
  const commentTextarea = document.createElement("textarea");
  commentTextarea.className = "field-input w-full no-print text-sm";
  commentTextarea.rows = 2;
  commentTextarea.placeholder = "เขียนข้อเสนอแนะสำหรับนักกีฬาคนนี้...";
  commentTextarea.value = data.comment || "";
  commentPrintText.textContent = data.comment || "-";
  const commentIndicator = document.createElement("p");
  commentIndicator.className = "text-[10px] text-slate-400 no-print";
  commentTextarea.addEventListener("blur", () => {
    commentPrintText.textContent = commentTextarea.value.trim() || "-";
    saveComment(player, team, start, end, commentTextarea.value.trim(), commentIndicator);
  });
  const commentCol = document.createElement("div");
  commentCol.append(commentPrintText, commentTextarea, commentIndicator);
  commentRow.appendChild(commentCol);

  const signatureCol = document.createElement("div");
  signatureCol.className = "text-[10px] text-slate-500 space-y-3 pt-1";
  signatureCol.innerHTML = `
    <p>ลงชื่อโค้ช .......................................</p>
    <p>ลงชื่อผู้ปกครอง .......................................</p>
  `;
  commentRow.appendChild(signatureCol);

  footerWrap.appendChild(commentRow);
  page.appendChild(footerWrap);

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

  const [playersSnap, attendanceSnap, matchSnap, injurySnap, commentsSnap, evaluationsSnap] = await Promise.all([
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
    ),
    getDocs(query(collection(db, "playerEvaluations"), where("team", "==", team)))
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

  const evaluations = [];
  evaluationsSnap.forEach((d) => evaluations.push(d.data()));

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

    // เลือกการประเมิน MASC ล่าสุดของนักกีฬาคนนี้ (เรียงตามเวลาบันทึกล่าสุด) ไม่ได้กรองตามช่วงเวลาของสมุดพก
    // เพราะรอบประเมิน MASC ("ช่วงที่ 1-4") เป็นคนละระบบ ไม่ได้ผูกกับเดือนปฏิทินแบบเดียวกับสมุดพก
    const myEvaluations = evaluations.filter((e) => e.playerId === player.id);
    const mascEvaluation =
      myEvaluations.length > 0
        ? myEvaluations
            .slice()
            .sort((a, b) => (b.updatedAt?.toDate?.().getTime() ?? 0) - (a.updatedAt?.toDate?.().getTime() ?? 0))[0]
        : null;

    const page = buildPlayerPage(player, {
      attendanceRecords: myAttendance,
      prevAttendanceRecords: myPrevAttendance,
      totalCount,
      percent,
      overallAvg,
      matchReports: myMatches,
      injuryReports: myInjuries,
      // ถ้าแอดมินยังไม่เคยเขียน/บันทึกข้อเสนอแนะเองสำหรับรอบนี้ ให้ดึงข้อสังเกตจากการประเมิน MASC ล่าสุดมาใส่
      // เป็นค่าเริ่มต้นแทนช่องว่างเปล่าๆ (ยังแก้ไข/บันทึกทับเป็นของตัวเองได้ตามปกติ — ไม่ได้ล็อกไว้)
      comment: existingComment?.comment || mascEvaluation?.observations || "",
      mascEvaluation
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
