import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-init.js";
import { SCORE_CATEGORIES, computeAvgScore, applyDataLabels, teamLogoImg, sendExecutiveNote } from "./ui-utils.js";

const TEAMS = ["KHAMPHEE FOOTBALL", "THAWEE SC", "THAMMASATHIT"];
// ต้องมีข้อมูลคะแนนอย่างน้อยเท่านี้ครั้งจึงจะคำนวณแนวโน้ม "ช่วงแรก vs ช่วงหลัง" ได้อย่างมีความหมาย
// (น้อยกว่านี้ผลต่างจะแกว่งง่ายเกินไป ไม่สะท้อนพัฒนาการจริง)
const MIN_RECORDS = 4;
const TOP_N = 10;

const statusEl = document.getElementById("status-message");
const accessGate = document.getElementById("access-gate");
const accessGateMessage = document.getElementById("access-gate-message");
const developmentContent = document.getElementById("development-content");
const devTeamSelect = document.getElementById("dev-team-select");
const devAgeGroupSelect = document.getElementById("dev-age-group-select");
const devRefreshBtn = document.getElementById("dev-refresh-btn");
const devFilterNote = document.getElementById("dev-filter-note");
const devDeltaBars = document.getElementById("dev-delta-bars");
const devTableBody = document.getElementById("dev-table-body");

let allPlayers = [];
let attendanceByPlayerId = new Map();
let currentDevRows = [];
let currentAdminName = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "text-sm text-red-600" : "text-sm text-slate-500";
}

function showAccessGate(message) {
  accessGateMessage.textContent = message;
  accessGate.classList.remove("hidden");
  developmentContent.classList.add("hidden");
  setStatus("");
}

for (const team of TEAMS) {
  const opt = document.createElement("option");
  opt.value = team;
  opt.textContent = team;
  devTeamSelect.appendChild(opt);
}

// ---------- คำนวณอันดับพัฒนาการ ----------
// เทียบคะแนนเฉลี่ยของ "ช่วงแรก" (ครึ่งแรกของบันทึกที่มีคะแนน เรียงตามวันที่) กับ "ช่วงหลัง" (ครึ่งหลัง)
// ผลต่างที่เป็นบวกมากที่สุด = พัฒนาการโดดเด่นที่สุด
function computeDevelopment(teamFilter, ageGroupFilter) {
  const eligiblePlayers = allPlayers.filter(
    (p) => (teamFilter === "__ALL__" || p.team === teamFilter) && (ageGroupFilter === "__ALL__" || p.ageGroup === ageGroupFilter)
  );

  const rows = [];
  for (const p of eligiblePlayers) {
    const records = attendanceByPlayerId.get(p.id) || [];
    const scored = records
      .filter((r) => computeAvgScore(r.scores) !== null)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((r) => ({ date: r.date, avg: computeAvgScore(r.scores) }));

    if (scored.length < MIN_RECORDS) continue;

    const mid = Math.floor(scored.length / 2);
    const firstHalf = scored.slice(0, mid);
    const secondHalf = scored.slice(mid);
    const earlyAvg = firstHalf.reduce((s, r) => s + r.avg, 0) / firstHalf.length;
    const lateAvg = secondHalf.reduce((s, r) => s + r.avg, 0) / secondHalf.length;

    rows.push({
      player: p,
      earlyAvg,
      lateAvg,
      delta: lateAvg - earlyAvg,
      count: scored.length,
      trend: scored
    });
  }

  rows.sort((a, b) => b.delta - a.delta);
  return rows.slice(0, TOP_N);
}

// ---------- กราฟแท่งแสดงส่วนต่างคะแนน (เขียว = พัฒนาขึ้น, แดง = ลดลง) ----------
function renderDeltaBars(rows) {
  if (rows.length === 0) {
    devDeltaBars.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">ยังไม่มีนักกีฬาที่มีข้อมูลเพียงพอสำหรับคำนวณแนวโน้ม</p>';
    return;
  }
  const maxAbsDelta = Math.max(...rows.map((r) => Math.abs(r.delta)), 0.1);
  devDeltaBars.innerHTML = rows
    .map((r) => {
      const pct = Math.min((Math.abs(r.delta) / maxAbsDelta) * 100, 100);
      const color = r.delta >= 0 ? "#10b981" : "#ef4444";
      const label = r.player.nickname ?? r.player.fullName ?? "-";
      const sign = r.delta >= 0 ? "+" : "";
      return `
      <div class="mb-3 last:mb-0">
        <div class="flex justify-between text-xs text-slate-500 mb-1">
          <span>${label} (${teamLogoImg(r.player.team, "w-4 h-4 object-contain inline-block align-middle rounded mr-1")}${r.player.team ?? "-"})</span>
          <span>${sign}${r.delta.toFixed(2)}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-3">
          <div class="h-3 rounded-full" style="width:${pct}%; background:${color}"></div>
        </div>
      </div>`;
    })
    .join("");
}

// ---------- กราฟเส้นเล็กๆ (sparkline) แสดงแนวโน้มคะแนนในตาราง ----------
function renderSparkline(trend) {
  const width = 100;
  const height = 30;
  const pad = 4;
  const maxScore = 4;
  const coords = trend.map((t, i) => {
    const x = trend.length === 1 ? width / 2 : pad + (i / (trend.length - 1)) * (width - pad * 2);
    const y = height - pad - (t.avg / maxScore) * (height - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <path d="${path}" fill="none" stroke="#0f172a" stroke-width="1.5" />
      <circle cx="${coords[coords.length - 1].x.toFixed(1)}" cy="${coords[coords.length - 1].y.toFixed(1)}" r="2.5" fill="#10b981" />
    </svg>
  `;
}

function renderTable(rows) {
  currentDevRows = rows;
  if (rows.length === 0) {
    devTableBody.innerHTML =
      `<tr><td colspan="10" class="px-4 py-6 text-center text-slate-400">ยังไม่มีนักกีฬาที่มีข้อมูลบันทึกอย่างน้อย ${MIN_RECORDS} ครั้งในเงื่อนไขที่เลือก</td></tr>`;
    return;
  }
  devTableBody.innerHTML = rows
    .map((r, i) => {
      const sign = r.delta >= 0 ? "+" : "";
      const deltaClass = r.delta >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold";
      const label = r.player.nickname ?? r.player.fullName ?? "-";
      return `
        <tr>
          <td class="emphasis">${i + 1}</td>
          <td class="emphasis"><a href="./player.html#id=${r.player.id}" class="text-blue-600 hover:underline">${label}</a></td>
          <td>${teamLogoImg(r.player.team)}${r.player.team ?? "-"}</td>
          <td>${r.player.ageGroup ?? "-"}</td>
          <td>${r.earlyAvg.toFixed(2)}</td>
          <td>${r.lateAvg.toFixed(2)}</td>
          <td class="${deltaClass}">${sign}${r.delta.toFixed(2)}</td>
          <td>${r.count}</td>
          <td>${renderSparkline(r.trend)}</td>
          <td>
            <button type="button" class="btn btn-secondary btn-sm" data-send-player-id="${r.player.id}">📤</button>
          </td>
        </tr>`;
    })
    .join("");
  applyDataLabels(devTableBody);
}

function refresh() {
  const rows = computeDevelopment(devTeamSelect.value, devAgeGroupSelect.value);
  renderDeltaBars(rows);
  renderTable(rows);
  devFilterNote.textContent =
    `นับเฉพาะนักกีฬาที่มีข้อมูลคะแนนบันทึกไว้อย่างน้อย ${MIN_RECORDS} ครั้ง เทียบคะแนนเฉลี่ยครึ่งแรกกับครึ่งหลังของข้อมูลที่มี ` +
    `(พบทั้งหมด ${rows.length} คนที่ตรงเงื่อนไข)`;
}

devRefreshBtn.addEventListener("click", refresh);
devTeamSelect.addEventListener("change", refresh);
devAgeGroupSelect.addEventListener("change", refresh);

// ส่งข้อมูลนักกีฬาแถวนี้ไปแจ้งผู้บริหารทีมโดยตรง — ใช้ event delegation เพราะแถวถูกสร้างใหม่ทุกครั้งที่ refresh()
devTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-send-player-id]");
  if (!btn) return;
  const row = currentDevRows.find((r) => r.player.id === btn.dataset.sendPlayerId);
  if (!row) return;
  const label = row.player.nickname ?? row.player.fullName ?? "-";
  const sign = row.delta >= 0 ? "+" : "";
  const defaultMessage = `นักกีฬาที่มีพัฒนาการโดดเด่น: ${label} (ทีม ${row.player.team ?? "-"}) — คะแนนเฉลี่ยเปลี่ยนแปลง ${sign}${row.delta.toFixed(2)} จากช่วงแรกของข้อมูลที่มี`;
  const message = prompt("ข้อความที่จะส่งถึงผู้บริหารทีม:", defaultMessage);
  if (message === null || !message.trim()) return;
  try {
    await sendExecutiveNote({
      team: row.player.team,
      type: "player",
      refId: row.player.id,
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

async function loadAllData() {
  setStatus("กำลังโหลดข้อมูล...");
  const [playersSnap, attendanceSnap] = await Promise.all([
    getDocs(collection(db, "players")),
    getDocs(collection(db, "attendance"))
  ]);

  allPlayers = [];
  playersSnap.forEach((d) => allPlayers.push({ id: d.id, ...d.data() }));

  attendanceByPlayerId = new Map();
  attendanceSnap.forEach((d) => {
    const data = d.data();
    if (!data.playerId) return;
    if (!attendanceByPlayerId.has(data.playerId)) attendanceByPlayerId.set(data.playerId, []);
    attendanceByPlayerId.get(data.playerId).push(data);
  });

  refresh();
  setStatus(`โหลดข้อมูลสำเร็จ • นักกีฬาทั้งหมด ${allPlayers.length} คน`);
}

onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  if (!isCoachSession) {
    showAccessGate("ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบก่อน จึงจะดูอันดับพัฒนาการนักกีฬาได้");
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved" || data.role !== "admin") {
      showAccessGate("เฉพาะบัญชีผู้ดูแลระบบเท่านั้นที่ดูอันดับพัฒนาการนักกีฬาได้");
      return;
    }

    currentAdminName = data.name || user.email;
    accessGate.classList.add("hidden");
    developmentContent.classList.remove("hidden");
    await loadAllData();
  } catch (err) {
    console.error(err);
    setStatus("โหลดข้อมูลไม่สำเร็จ: " + err.message, true);
  }
});
