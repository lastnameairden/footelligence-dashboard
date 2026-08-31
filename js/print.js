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
  ageGroupSortKey,
  getCoachPlayerIds,
  isCoachSubmissionOnTime
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
const printTrainingPlanTrend = document.getElementById("print-training-plan-trend");
const printCheckinCards = document.getElementById("print-checkin-cards");
const printCheckinBody = document.getElementById("print-checkin-body");
const printCheckinTrend = document.getElementById("print-checkin-trend");
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
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${segH.toFixed(1)}" fill="${seg.color}"><title>${d.date}: ${verb}ตรงเวลา ${d.onTime} · ${verb}สาย ${d.late} · ${noneLabel} ${d.none}</title></rect>`;
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

// สรุปแผนการฝึกซ้อม/ผลการแข่งขัน/อาการบาดเจ็บ ของทีม+เดือน+รุ่นอายุเดียวกับตารางผู้เล่นด้านบน — ให้สรุป
// สำหรับพิมพ์มีข้อมูลครบรูปแบบเดียวกับหน้า Dashboard
async function loadPrintExtras(team, ageGroup, month) {
  const [trainingPlanSnap, matchSnap, injurySnap, coachSnap, sessionSnap, attendanceSnap, playersSnap] = await Promise.all([
    getDocs(query(collection(db, "trainingPlans"), where("team", "==", team))),
    getDocs(query(collection(db, "matchReports"), where("team", "==", team))),
    getDocs(query(collection(db, "injuryReports"), where("team", "==", team))),
    getDocs(query(collection(db, "coaches"), where("team", "==", team), where("role", "==", "coach"))),
    getDocs(query(collection(db, "sessions"), where("team", "==", team))),
    getDocs(query(collection(db, "attendance"), where("team", "==", team))),
    getDocs(query(collection(db, "players"), where("team", "==", team)))
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
  const monthSessions = sessions
    .filter((s) => (s.date || "").startsWith(month) && !s.noTraining)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  let attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));

  let allPlayers = [];
  playersSnap.forEach((d) => allPlayers.push({ id: d.id, ...d.data() }));
  const scopedPlayers = ageGroup === "__ALL__" ? allPlayers : allPlayers.filter((p) => p.ageGroup === ageGroup);

  // ---------- สรุปการส่งแผนการฝึกซ้อมรายวัน แยกรายโค้ช (ตรงเวลา/สาย/วันฝึกซ้อมที่ต้องส่ง/% ตรงตามวันฝึกซ้อม) ----------
  // จับคู่แผนกับโค้ชด้วยชื่อ (coachName) ไม่ใช่ coachId เพราะถ้าผู้ดูแลระบบสวมบทบาทส่งแทนโค้ช coachId จะกลายเป็น
  // uid ของผู้ดูแลระบบเอง (หลักการเดียวกับ computeCoachMonthlySummaryRows ในหน้า attendance.html) — "จำนวนทั้งหมด
  // ที่ต้องส่ง" คือจำนวนวันฝึกซ้อมจริง (monthSessions) ไม่ใช่เกณฑ์คงที่อีกต่อไป เพราะวันที่ฝึกซ้อมต้องตรงกับวันที่
  // ส่งแผนการฝึกซ้อม — นับว่า "ส่งตรงวันฝึกซ้อม" ถ้าโค้ชคนนั้นส่งแผนของวันที่ตรงกับวันฝึกซ้อมวันนั้นพอดี
  let plans = [];
  trainingPlanSnap.forEach((d) => plans.push(d.data()));
  plans = plans.filter((p) => (p.date || "").startsWith(month));
  if (ageGroup !== "__ALL__") {
    plans = plans.filter((p) => (p.ageGroups || []).includes(ageGroup));
  }

  const lateCount = plans.filter((p) => isTrainingPlanLate(p)).length;
  const onTimeCount = plans.length - lateCount;
  printTrainingPlanCards.innerHTML =
    statCard("วันฝึกซ้อมทั้งหมด", monthSessions.length) +
    statCard("ส่งแผนตรงเวลา", onTimeCount) +
    statCard("ส่งแผนสาย", lateCount) +
    statCard(
      "สถานะ",
      lateCount > TRAINING_PLAN_LATE_WARNING_THRESHOLD ? "⚠️ ต้องปรับปรุง" : "ปกติ"
    );

  const coachRows = coaches.map((c) => {
    const myPlans = plans.filter((p) => p.coachName === c.name);
    let matchDays = 0;
    let onTime = 0;
    for (const s of monthSessions) {
      const dayPlans = myPlans.filter((p) => p.date === s.date);
      if (dayPlans.length === 0) continue;
      matchDays += 1;
      if (dayPlans.some((p) => !isTrainingPlanLate(p))) onTime += 1;
    }
    const late = matchDays - onTime;
    const matchPercent = monthSessions.length > 0 ? Math.round((matchDays / monthSessions.length) * 100) : null;
    return { coach: c, matchDays, onTime, late, matchPercent };
  });

  if (coachRows.length === 0) {
    printTrainingPlanBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printTrainingPlanBody.innerHTML = coachRows
      .map(({ coach, onTime, late, matchPercent }) => {
        const percentText = matchPercent === null ? "-" : `${matchPercent}%`;
        const percentBadgeClass = matchPercent === null ? "badge-neutral" : matchPercent >= 80 ? "badge-success" : matchPercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${coach.name ?? "-"}</td>
            <td>${(coach.ageGroups || []).join(", ") || "-"}</td>
            <td>${monthSessions.length}</td>
            <td class="text-emerald-600 font-medium">${onTime}</td>
            <td class="text-red-500 font-medium">${late}</td>
            <td><span class="badge ${percentBadgeClass}">${percentText}</span></td>
          </tr>`;
      })
      .join("");
    applyDataLabels(printTrainingPlanBody);
  }

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

  // ---------- สรุปการเช็คชื่อ + ให้คะแนนนักกีฬารายวัน แยกรายโค้ช ----------
  // เกณฑ์เดียวกับสรุปแผนการฝึกซ้อมด้านบน คือวันฝึกซ้อมจริง (monthSessions) — วัดว่าโค้ชเช็คชื่อ+ให้คะแนน "ตรงกับ
  // วันที่ทีมฝึกซ้อมจริง" กี่วันจากทั้งหมด ไม่ใช่แค่ดูอัตราตรงเวลาของที่เช็คชื่อมาแล้วเฉยๆ (เกณฑ์เดียวกับ
  // checkinDays/isCoachSubmissionOnTime ใน computeCoachMonthlySummaryRows ของ attendance.js)
  const checkinRows = coaches.map((c) => {
    const myPlayerIds = getCoachPlayerIds(c, scopedPlayers);
    let checkinDays = 0;
    let onTime = 0;
    for (const s of monthSessions) {
      const myAttendanceForSession = attendanceRecords.filter((a) => a.sessionId === s.id && myPlayerIds.has(a.playerId));
      if (myAttendanceForSession.length === 0) continue;
      checkinDays += 1;
      if (isCoachSubmissionOnTime(s, myAttendanceForSession)) onTime += 1;
    }
    const late = checkinDays - onTime;
    const matchPercent = monthSessions.length > 0 ? Math.round((checkinDays / monthSessions.length) * 100) : null;
    return { coach: c, checkinDays, onTime, late, matchPercent };
  });

  const totalCheckinDays = checkinRows.reduce((sum, r) => sum + r.checkinDays, 0);
  const totalOnTime = checkinRows.reduce((sum, r) => sum + r.onTime, 0);
  printCheckinCards.innerHTML =
    statCard("วันฝึกซ้อมทั้งหมด", monthSessions.length) +
    statCard("เช็คชื่อตรงวันฝึกซ้อม (รวม)", totalCheckinDays) +
    statCard("ตรงเวลา (รวม)", totalOnTime) +
    statCard("สาย (รวม)", totalCheckinDays - totalOnTime);

  if (checkinRows.length === 0) {
    printCheckinBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ไม่มีโค้ชในขอบเขตที่เลือก</td></tr>';
  } else {
    printCheckinBody.innerHTML = checkinRows
      .map(({ coach, checkinDays, onTime, late, matchPercent }) => {
        const percentText = matchPercent === null ? "-" : `${matchPercent}%`;
        const percentBadgeClass =
          matchPercent === null ? "badge-neutral" : matchPercent >= 80 ? "badge-success" : matchPercent >= 50 ? "badge-warning" : "badge-danger";
        return `
          <tr>
            <td class="emphasis">${coach.name ?? "-"}</td>
            <td>${(coach.ageGroups || []).join(", ") || "-"}</td>
            <td>${monthSessions.length}</td>
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
      const myAttendanceForSession = attendanceRecords.filter((a) => a.sessionId === s.id && myPlayerIds.has(a.playerId));
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
