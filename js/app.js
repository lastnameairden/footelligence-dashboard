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

// สถานะที่นับว่า "มาซ้อม" ตาม legend ของ Logbook (A หรือค่าประเมิน 1-4)
const ATTENDED_CODES = new Set(["A", "1", "2", "3", "4"]);
const UNASSIGNED_TEAM = "ยังไม่ระบุทีม";
const TEAMS = ["KHAMPHEE FOOTBALL", "THAWEE SC", "THAMMASATHIT"];

const playersGroupsEl = document.getElementById("players-groups");
const attendanceGroupsEl = document.getElementById("attendance-groups");
const overviewCardsEl = document.getElementById("overview-cards");
const teamSummaryBodyEl = document.getElementById("team-summary-body");
const statusEl = document.getElementById("status-message");
const loginGate = document.getElementById("login-gate");
const loginGateMessage = document.getElementById("login-gate-message");
const dashboardContent = document.getElementById("dashboard-content");
const adminTeamBar = document.getElementById("admin-team-bar");
const adminTeamSelectDashboard = document.getElementById("admin-team-select-dashboard");
const adminViewTeamBtn = document.getElementById("admin-view-team-btn");
const adminTeamBarStatus = document.getElementById("admin-team-bar-status");

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = isError
    ? "text-sm text-red-600"
    : "text-sm text-slate-500";
}

function showLoginGate(message) {
  loginGateMessage.textContent = message;
  loginGate.classList.remove("hidden");
  dashboardContent.classList.add("hidden");
  setStatus("");
}

async function loadCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  const docs = [];
  snapshot.forEach((docSnap) => docs.push({ id: docSnap.id, ...docSnap.data() }));
  return docs;
}

async function loadCollectionForTeam(name, team) {
  const snapshot = await getDocs(query(collection(db, name), where("team", "==", team)));
  const docs = [];
  snapshot.forEach((docSnap) => docs.push({ id: docSnap.id, ...docSnap.data() }));
  return docs;
}

// team -> ชื่อโค้ชผู้รับผิดชอบ
function buildCoachNames(coaches) {
  const map = new Map();
  for (const c of coaches) {
    if (!c.team) continue;
    map.set(c.team, c.name || c.email || "ไม่ระบุโค้ช");
  }
  return map;
}

// team -> ป้ายกำกับที่จะแสดง (ชื่อทีม + ชื่อ/อีเมลโค้ชผู้รับผิดชอบ)
function buildTeamLabels(coachNames) {
  const map = new Map();
  for (const [team, name] of coachNames) {
    map.set(team, `${team} (โค้ช: ${name})`);
  }
  return map;
}

function groupByTeam(items) {
  const groups = new Map();
  for (const item of items) {
    const team = item.team || UNASSIGNED_TEAM;
    if (!groups.has(team)) groups.set(team, []);
    groups.get(team).push(item);
  }
  return groups;
}

function renderPlayersGroups(playerGroups, teamLabels) {
  playersGroupsEl.innerHTML = "";
  if (playerGroups.size === 0) {
    playersGroupsEl.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีข้อมูลผู้เล่นใน Firestore</p>';
    return;
  }
  for (const [team, players] of playerGroups) {
    players.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    const label = teamLabels.get(team) || team;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <h3 class="section-title text-sm mb-2">${label}</h3>
      <div class="card table-wrap">
        <table class="pro-table">
          <thead>
            <tr>
              <th>รหัสประจำตัว</th>
              <th>ชื่อเล่น</th>
              <th>ชื่อ-นามสกุล</th>
              <th>วันเกิด</th>
            </tr>
          </thead>
          <tbody>
            ${players
              .map(
                (p) => `
              <tr>
                <td>${p.number ?? "-"}</td>
                <td class="emphasis">${p.nickname ?? "-"}</td>
                <td>${p.fullName ?? "-"}</td>
                <td>${p.birthday ?? "-"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    playersGroupsEl.appendChild(wrapper);
  }
}

function computeAttendanceStats(players, records) {
  const statsMap = new Map();
  for (const p of players) {
    statsMap.set(p.id, { nickname: p.nickname, attended: 0, missed: 0, total: 0, scoreSum: 0, scoreCount: 0 });
  }
  for (const r of records) {
    const stat = statsMap.get(r.playerId);
    if (!stat) continue;
    stat.total += 1;
    if (ATTENDED_CODES.has(String(r.status))) {
      stat.attended += 1;
    } else {
      stat.missed += 1;
    }
    const score = Number(r.score);
    if (score >= 1 && score <= 4) {
      stat.scoreSum += score;
      stat.scoreCount += 1;
    }
  }
  return Array.from(statsMap.values());
}

// รวมสถิติของแต่ละทีม (ต่อผู้เล่น + ผลรวมทั้งทีม) ไว้ที่เดียว ใช้ซ้ำได้ทั้งตารางละเอียดและภาพรวม
function computeTeamStats(playerGroups, attendanceRecords) {
  const result = new Map();
  for (const [team, players] of playerGroups) {
    const teamRecords = attendanceRecords.filter((r) => (r.team || UNASSIGNED_TEAM) === team);
    const stats = computeAttendanceStats(players, teamRecords);
    const totals = stats.reduce(
      (acc, s) => {
        acc.attended += s.attended;
        acc.missed += s.missed;
        acc.total += s.total;
        acc.scoreSum += s.scoreSum;
        acc.scoreCount += s.scoreCount;
        return acc;
      },
      { attended: 0, missed: 0, total: 0, scoreSum: 0, scoreCount: 0 }
    );
    result.set(team, { stats, totals, playerCount: players.length });
  }
  return result;
}

function statCard(label, value) {
  return `
    <div class="stat-card">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
    </div>
  `;
}

const CHART_PALETTE = ["#0f172a", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];

function renderPlayersPie(playerGroups) {
  const pieEl = document.getElementById("players-pie");
  const legendEl = document.getElementById("players-pie-legend");
  const entries = Array.from(playerGroups.entries()).map(([team, list]) => ({ team, count: list.length }));
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  if (total === 0) {
    pieEl.style.background = "conic-gradient(#e2e8f0 0% 100%)";
    legendEl.innerHTML = '<p class="text-slate-400">ไม่มีข้อมูล</p>';
    return;
  }

  let acc = 0;
  const segments = entries.map((e, i) => {
    const percent = (e.count / total) * 100;
    const start = acc;
    acc += percent;
    return `${CHART_PALETTE[i % CHART_PALETTE.length]} ${start}% ${acc}%`;
  });
  pieEl.style.background = `conic-gradient(${segments.join(", ")})`;
  legendEl.innerHTML = entries
    .map(
      (e, i) => `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full inline-block" style="background:${CHART_PALETTE[i % CHART_PALETTE.length]}"></span>
        <span class="text-slate-600">${e.team}: ${e.count} คน</span>
      </div>`
    )
    .join("");
}

function renderBarChart(containerId, entries, valueFormatter, maxValue) {
  const el = document.getElementById(containerId);
  if (entries.length === 0) {
    el.innerHTML = '<p class="text-slate-400 text-sm">ไม่มีข้อมูล</p>';
    return;
  }
  el.innerHTML = entries
    .map((e, i) => {
      const pct = maxValue > 0 ? Math.min((e.value / maxValue) * 100, 100) : 0;
      return `
      <div>
        <div class="flex justify-between text-xs text-slate-500 mb-1">
          <span>${e.label}</span>
          <span>${valueFormatter(e.value)}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-3">
          <div class="h-3 rounded-full" style="width:${pct}%; background:${CHART_PALETTE[i % CHART_PALETTE.length]}"></div>
        </div>
      </div>`;
    })
    .join("");
}

function renderOverview(playerGroups, teamStats, coachNames) {
  const overall = { players: 0, attended: 0, missed: 0, total: 0, scoreSum: 0, scoreCount: 0 };
  for (const [team, { totals, playerCount }] of teamStats) {
    overall.players += playerCount;
    overall.attended += totals.attended;
    overall.missed += totals.missed;
    overall.total += totals.total;
    overall.scoreSum += totals.scoreSum;
    overall.scoreCount += totals.scoreCount;
  }
  const overallPercent = overall.total > 0 ? Math.round((overall.attended / overall.total) * 100) : 0;
  const overallAvgScore = overall.scoreCount > 0 ? (overall.scoreSum / overall.scoreCount).toFixed(1) : "-";

  overviewCardsEl.innerHTML =
    statCard("จำนวนทีมทั้งหมด", playerGroups.size) +
    statCard("จำนวนนักกีฬาทั้งหมด", overall.players) +
    statCard("% เข้าร่วมฝึกซ้อมรวม", `${overallPercent}%`) +
    statCard("คะแนนเฉลี่ยรวม", overallAvgScore);

  renderPlayersPie(playerGroups);
  renderBarChart(
    "attendance-bars",
    Array.from(teamStats.entries()).map(([team, { totals }]) => ({
      label: team,
      value: totals.total > 0 ? Math.round((totals.attended / totals.total) * 100) : 0
    })),
    (v) => `${v}%`,
    100
  );
  renderBarChart(
    "score-bars",
    Array.from(teamStats.entries()).map(([team, { totals }]) => ({
      label: team,
      value: totals.scoreCount > 0 ? totals.scoreSum / totals.scoreCount : 0
    })),
    (v) => v.toFixed(1),
    4
  );

  if (teamStats.size === 0) {
    teamSummaryBodyEl.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  teamSummaryBodyEl.innerHTML = Array.from(teamStats.entries())
    .map(([team, { totals, playerCount }]) => {
      const percent = totals.total > 0 ? Math.round((totals.attended / totals.total) * 100) : 0;
      const avgScore = totals.scoreCount > 0 ? (totals.scoreSum / totals.scoreCount).toFixed(1) : "-";
      const coachName = coachNames.get(team) || "-";
      return `
        <tr>
          <td class="emphasis">${team}</td>
          <td>${coachName}</td>
          <td>${playerCount}</td>
          <td>${percent}%</td>
          <td>${avgScore}</td>
        </tr>`;
    })
    .join("");
}

function renderAttendanceGroups(playerGroups, teamStats, teamLabels) {
  attendanceGroupsEl.innerHTML = "";
  if (playerGroups.size === 0) {
    attendanceGroupsEl.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีข้อมูลผู้เล่นใน Firestore</p>';
    return;
  }
  for (const [team] of playerGroups) {
    const stats = teamStats.get(team)?.stats ?? [];
    const label = teamLabels.get(team) || team;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <h3 class="section-title text-sm mb-2">${label}</h3>
      <div class="card table-wrap">
        <table class="pro-table">
          <thead>
            <tr>
              <th>ชื่อเล่น</th>
              <th>จำนวนครั้งที่บันทึก</th>
              <th>มาซ้อม</th>
              <th>ขาด/บาดเจ็บ/ลา</th>
              <th>% เข้าร่วม</th>
              <th>คะแนนเฉลี่ย</th>
            </tr>
          </thead>
          <tbody>
            ${stats
              .map((s) => {
                const percent = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
                const avgScore = s.scoreCount > 0 ? (s.scoreSum / s.scoreCount).toFixed(1) : "-";
                return `
              <tr>
                <td class="emphasis">${s.nickname ?? "-"}</td>
                <td>${s.total}</td>
                <td class="text-emerald-600 font-medium">${s.attended}</td>
                <td class="text-red-500 font-medium">${s.missed}</td>
                <td>${percent}%</td>
                <td>${avgScore}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    attendanceGroupsEl.appendChild(wrapper);
  }
}

// scopeTeam: null = ผู้ดูแลระบบ เห็นทุกทีม / string = โค้ช เห็นเฉพาะทีมตัวเอง
async function loadDashboard(scopeTeam) {
  try {
    setStatus("กำลังโหลดข้อมูล...");
    const [players, attendanceRecords, coaches] = await Promise.all([
      scopeTeam ? loadCollectionForTeam("players", scopeTeam) : loadCollection("players"),
      scopeTeam ? loadCollectionForTeam("attendance", scopeTeam) : loadCollection("attendance"),
      loadCollection("coaches")
    ]);
    const coachNames = buildCoachNames(coaches);
    const teamLabels = buildTeamLabels(coachNames);
    const playerGroups = groupByTeam(players);
    const teamStats = computeTeamStats(playerGroups, attendanceRecords);
    renderOverview(playerGroups, teamStats, coachNames);
    renderPlayersGroups(playerGroups, teamLabels);
    renderAttendanceGroups(playerGroups, teamStats, teamLabels);
    setStatus(`โหลดข้อมูลสำเร็จ • ผู้เล่น ${players.length} คน • ${playerGroups.size} ทีม`);
  } catch (err) {
    console.error(err);
    setStatus(
      "โหลดข้อมูลไม่สำเร็จ: " + err.message + " (ตรวจสอบ firebase-config.js และ Firestore Rules)",
      true
    );
  }
}

adminTeamSelectDashboard.innerHTML += TEAMS.map((t) => `<option value="${t}">${t}</option>`).join("");

adminViewTeamBtn.addEventListener("click", () => {
  const selected = adminTeamSelectDashboard.value;
  if (!selected) {
    adminTeamBarStatus.textContent = "กรุณาเลือกทีมก่อน";
    adminTeamBarStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  adminTeamBarStatus.textContent = "";
  dashboardContent.classList.remove("hidden");
  loadDashboard(selected === "__ALL__" ? null : selected);
});

// ต้องล็อกอินด้วยบัญชีโค้ช/ผู้ดูแลระบบที่ได้รับอนุมัติแล้วเท่านั้น จึงจะเห็นข้อมูล Dashboard
// ผู้ดูแลระบบต้องเลือกทีมก่อนถึงจะเห็นข้อมูล (หรือเลือก "ทุกทีม") ส่วนโค้ชเห็นเฉพาะทีมของตัวเองอัตโนมัติ
onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  if (!isCoachSession) {
    adminTeamBar.classList.add("hidden");
    showLoginGate("ต้องเข้าสู่ระบบด้วยบัญชีโค้ชหรือผู้ดูแลระบบก่อน จึงจะดูข้อมูล Dashboard ได้");
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved") {
      adminTeamBar.classList.add("hidden");
      showLoginGate("บัญชีนี้ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ กรุณารอหรือติดต่อผู้ดูแลระบบ");
      return;
    }

    loginGate.classList.add("hidden");

    const isAdmin = data.role === "admin";
    if (isAdmin) {
      // ผู้ดูแลระบบต้องกดเลือกทีมก่อน ถึงจะแสดงข้อมูล (ค้างไว้ที่แถบเลือกทีมจนกว่าจะกดปุ่ม)
      adminTeamBar.classList.remove("hidden");
      dashboardContent.classList.add("hidden");
      setStatus("");
    } else {
      adminTeamBar.classList.add("hidden");
      dashboardContent.classList.remove("hidden");
      loadDashboard(data.team);
    }
  } catch (err) {
    console.error(err);
    setStatus("โหลดข้อมูลบัญชีไม่สำเร็จ: " + err.message, true);
  }
});
