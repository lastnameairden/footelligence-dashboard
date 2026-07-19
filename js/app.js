import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-init.js";
import {
  applyDataLabels,
  computeAvgScore,
  isPlayerFullyEvaluated,
  teamIconBadge,
  teamLogoImg,
  isTrainingPlanLate,
  TRAINING_PLAN_LATE_WARNING_THRESHOLD,
  statCard,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  sendExecutiveNote,
  loadAdminNotifications,
  renderAdminNotifications,
  markNotificationRead,
  getCoachPlayerIds,
  ageGroupSortKey,
  ageGroupNumber,
  coachPositionLabel
} from "./ui-utils.js";

// สถานะที่นับว่า "มาซ้อม" ตาม legend ของ Logbook (A หรือค่าประเมิน 1-4)
const ATTENDED_CODES = new Set(["A", "1", "2", "3", "4"]);
const UNASSIGNED_TEAM = "ยังไม่ระบุทีม";
const TEAMS = ["KHAMPHEE FOOTBALL", "THAWEE SC", "THAMMASATHIT"];

const playersGroupsEl = document.getElementById("players-groups");
const attendanceGroupsEl = document.getElementById("attendance-groups");
const overviewCardsEl = document.getElementById("overview-cards");
const positionToggleWrap = document.getElementById("position-toggle-wrap");
const playerPositionToggleBtn = document.getElementById("player-position-toggle-btn");
const gkPositionToggleBtn = document.getElementById("gk-position-toggle-btn");
const playersPieTitleEl = document.getElementById("players-pie-title");
const attendanceBarsTitleEl = document.getElementById("attendance-bars-title");
const scoreBarsTitleEl = document.getElementById("score-bars-title");
const teamSummaryColGroupEl = document.getElementById("team-summary-col-group");
const teamSummaryBodyEl = document.getElementById("team-summary-body");
const teamSummaryTabsEl = document.getElementById("team-summary-tabs");
const statusEl = document.getElementById("status-message");
const loginGate = document.getElementById("login-gate");
const loginGateMessage = document.getElementById("login-gate-message");
const dashboardContent = document.getElementById("dashboard-content");
const adminPickTeamPrompt = document.getElementById("admin-pick-team-prompt");
const adminPickTeamGrid = document.getElementById("admin-pick-team-grid");
const ageProgressSection = document.getElementById("age-group-progress-section");
const ageProgressDateInput = document.getElementById("age-progress-date-input");
const ageProgressRefreshBtn = document.getElementById("age-progress-refresh-btn");
const ageProgressTableBody = document.getElementById("age-progress-table-body");
const ageProgressPie = document.getElementById("age-progress-pie");
const ageProgressLegend = document.getElementById("age-progress-legend");
const trainingReportsSection = document.getElementById("training-reports-section");
const trainingReportsBody = document.getElementById("training-reports-body");
const trainingReportsLocationHeader = document.getElementById("training-reports-location-header");
const trainingPlanSummaryBody = document.getElementById("training-plan-summary-body");
const trainingPlanSummaryActionHeader = document.getElementById("training-plan-summary-action-header");
const matchReportsStatCardsEl = document.getElementById("match-reports-stat-cards");
const dashboardMatchBody = document.getElementById("dashboard-match-body");
const injuryReportsStatCardsEl = document.getElementById("injury-reports-stat-cards");
const dashboardInjuryBody = document.getElementById("dashboard-injury-body");
const headerAttendanceLink = document.getElementById("header-attendance-link");
const dashboardBackLink = document.getElementById("dashboard-back-link");
const hamburgerBtn = document.getElementById("hamburger-btn");
const notificationBellBtn = document.getElementById("notification-bell-btn");
const notificationBadge = document.getElementById("notification-badge");
const notificationPanel = document.getElementById("notification-panel");
const notificationList = document.getElementById("notification-list");
const notificationRefreshBtn = document.getElementById("notification-refresh-btn");
const navDrawerOverlay = document.getElementById("nav-drawer-overlay");
const navDrawer = document.getElementById("nav-drawer");
const navDrawerCloseBtn = document.getElementById("nav-drawer-close-btn");
const navDrawerItems = document.getElementById("nav-drawer-items");
const navDrawerNameEl = document.getElementById("nav-drawer-name");
const navDrawerEmailEl = document.getElementById("nav-drawer-email");
const navDrawerRoleBadgeEl = document.getElementById("nav-drawer-role-badge");
const drawerLogoutBtn = document.getElementById("drawer-logout-btn");

let currentViewerRole = null; // "admin" | "coach" | "executive"
let currentAdminName = null;
let currentTrainingPlanRows = [];

let currentScopeTeam = null;
let currentTeamPlayers = [];
// สลับดู "ผู้เล่น" กับ "GK" ในภาพรวมของทีมที่เลือกอยู่ (ปุ่ม position-toggle) — เก็บพารามิเตอร์ล่าสุดไว้ใน
// scopedOverviewData เพื่อให้สลับปุ่มได้ทันทีโดยไม่ต้องโหลดข้อมูลจาก Firestore ใหม่
let currentDashboardPosition = "player";
let scopedOverviewData = null;

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
  headerAttendanceLink.classList.add("hidden");
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

// "team||ageGroup" -> ชื่อโค้ชหลักของรุ่นนั้น (เฉพาะ Head Coach / Assistant Coach เพราะเป็นตำแหน่งที่ผูกกับ
// รุ่นอายุเดียว ต่างจาก GK Coach/Fitness Coach ที่ดูแลหลายรุ่นพร้อมกันจึงไม่ถือเป็น "โค้ชประจำรุ่น" คนเดียว)
// Head Coach มีสิทธิ์เหนือกว่า Assistant Coach หากรุ่นเดียวกันมีทั้งคู่
function buildCoachNameByAgeGroup(coaches) {
  const map = new Map();
  for (const c of coaches) {
    if (!c.team || c.role !== "coach" || !Array.isArray(c.ageGroups)) continue;
    if (c.coachPosition !== "head_coach" && c.coachPosition !== "assistant_coach") continue;
    for (const ag of c.ageGroups) {
      const key = `${c.team}||${ag}`;
      if (c.coachPosition === "head_coach" || !map.has(key)) {
        map.set(key, c.name || c.email || "ไม่ระบุโค้ช");
      }
    }
  }
  return map;
}

// "team||ageGroup" -> ชื่อ GK Coach ที่ดูแลรุ่นนั้น (คู่กับ buildCoachNameByAgeGroup ด้านบนที่ดูแลเฉพาะ
// Head/Assistant Coach) ใช้แสดงโค้ชผู้รับผิดชอบของแถว GK แยกจากแถวผู้เล่นตำแหน่งอื่น
function buildGkCoachNameByAgeGroup(coaches) {
  const map = new Map();
  for (const c of coaches) {
    if (!c.team || c.role !== "coach" || c.coachPosition !== "gk_coach" || !Array.isArray(c.ageGroups)) continue;
    for (const ag of c.ageGroups) {
      map.set(`${c.team}||${ag}`, c.name || c.email || "ไม่ระบุโค้ช");
    }
  }
  return map;
}

// สร้างแถวสถิติแยกเป็นรายคนของโค้ชทุกคนทุกตำแหน่ง (ทีม + ตำแหน่ง + รุ่นอายุที่ดูแล + จำนวนนักกีฬา/% เข้าร่วม/
// คะแนนเฉลี่ยเฉพาะนักกีฬาที่ตัวเองดูแลจริงเท่านั้น ไม่ใช่รวมทั้งทีม) ใช้แสดงในตารางภาพรวม "ทุกทีม" แทนการรวม
// ทุกคนของทีมเป็นแถวเดียว — ใช้ getCoachPlayerIds (ตัวเดียวกับที่หน้ารายชื่อโค้ช/ความคืบหน้าการประเมินใช้) เพื่อ
// แยกผู้เล่นตำแหน่ง GK ออกจาก Head/Assistant Coach อย่างถูกต้อง (ไม่งั้น GK จะถูกนับซ้ำเป็นของ Head Coach
// และ GK Coach เองจะไม่มีแถวเลย) เรียงตามลำดับทีม (TEAMS) แล้วตามรุ่นอายุน้อยไปมากภายในทีมเดียวกัน
function buildCoachOverviewRows(coaches, playerGroups, attendanceRecords) {
  const rows = [];
  for (const c of coaches) {
    if (!c.team || c.role !== "coach") continue;
    const teamPlayers = playerGroups.get(c.team) || [];
    const myPlayerIds = getCoachPlayerIds(c, teamPlayers);
    const coachPlayers = teamPlayers.filter((p) => myPlayerIds.has(p.id));
    const totals = sumStats(computeAttendanceStats(coachPlayers, attendanceRecords));
    rows.push({
      team: c.team,
      coachName: c.name || c.email || "ไม่ระบุโค้ช",
      coachPosition: c.coachPosition,
      ageGroups: c.ageGroups || [],
      playerCount: coachPlayers.length,
      totals
    });
  }
  rows.sort((a, b) => {
    const teamDiff = TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team);
    return teamDiff !== 0 ? teamDiff : ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups);
  });
  return rows;
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

function groupByAgeGroup(items) {
  const groups = new Map();
  for (const item of items) {
    const ageGroup = item.ageGroup || UNASSIGNED_AGE_GROUP;
    if (!groups.has(ageGroup)) groups.set(ageGroup, []);
    groups.get(ageGroup).push(item);
  }
  return new Map([...groups.entries()].sort((a, b) => ageGroupNumber(a[0]) - ageGroupNumber(b[0])));
}

// แสดงผู้เล่นทีละรุ่นอายุแทนการแสดงทั้งทีมรวมกันในตารางเดียว (ทีมหนึ่งมีผู้เล่นหลายสิบคนคละรุ่น ยาวเกินไป)
// คลิกปุ่มรุ่นอายุเพื่อสลับดูทีละรุ่น โดย default เลือกรุ่นที่น้อยที่สุดของทีมนั้นให้อัตโนมัติ
function renderPlayersGroups(playerGroups) {
  playersGroupsEl.innerHTML = "";
  if (playerGroups.size === 0) {
    playersGroupsEl.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีข้อมูลผู้เล่นใน Firestore</p>';
    return;
  }
  for (const [team, teamPlayers] of playerGroups) {
    const ageGroupMap = groupByAgeGroup(teamPlayers);
    const ageGroupKeys = Array.from(ageGroupMap.keys());

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <h3 class="section-title text-sm mb-2">${teamLogoImg(team)}${team}</h3>
      <div class="flex flex-wrap gap-2 mb-3"></div>
      <div class="card table-wrap">
        <table class="pro-table">
          <thead>
            <tr>
              <th>รหัสประจำตัว</th>
              <th>ชื่อเล่น</th>
              <th>ชื่อ-นามสกุล</th>
              <th>วันเกิด</th>
              <th>รุ่นอายุ</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    const tabsEl = wrapper.querySelector("div");
    const tbody = wrapper.querySelector("tbody");

    function showAgeGroup(ageGroup, btn) {
      for (const tabBtn of tabsEl.children) {
        tabBtn.classList.toggle("btn-primary", tabBtn === btn);
        tabBtn.classList.toggle("btn-secondary", tabBtn !== btn);
      }
      const groupPlayers = (ageGroupMap.get(ageGroup) || []).slice().sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      tbody.innerHTML = groupPlayers
        .map(
          (p) => `
        <tr>
          <td>${p.number ?? "-"}</td>
          <td class="emphasis"><a href="./player.html#id=${p.id}" class="text-blue-600 hover:underline">${p.nickname ?? "-"}</a></td>
          <td>${p.fullName ?? "-"}</td>
          <td>${p.birthday ?? "-"}</td>
          <td>${p.ageGroup ?? "-"}</td>
        </tr>`
        )
        .join("");
      applyDataLabels(tbody);
    }

    for (const ageGroup of ageGroupKeys) {
      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = "btn btn-secondary btn-sm";
      tabBtn.textContent = `${ageGroup} (${ageGroupMap.get(ageGroup).length})`;
      tabBtn.addEventListener("click", () => showAgeGroup(ageGroup, tabBtn));
      tabsEl.appendChild(tabBtn);
    }
    if (ageGroupKeys.length > 0) {
      showAgeGroup(ageGroupKeys[0], tabsEl.children[0]);
    }

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
    const avgScore = computeAvgScore(r.scores);
    if (avgScore !== null) {
      stat.scoreSum += avgScore;
      stat.scoreCount += 1;
    }
  }
  return Array.from(statsMap.values());
}

function sumStats(statsArray) {
  return statsArray.reduce(
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
}

// รวมสถิติของแต่ละทีม (ต่อผู้เล่น + ผลรวมทั้งทีม) ไว้ที่เดียว ใช้ซ้ำได้ทั้งตารางละเอียดและภาพรวม
function computeTeamStats(playerGroups, attendanceRecords) {
  const result = new Map();
  for (const [team, players] of playerGroups) {
    const teamRecords = attendanceRecords.filter((r) => (r.team || UNASSIGNED_TEAM) === team);
    const stats = computeAttendanceStats(players, teamRecords);
    result.set(team, { stats, totals: sumStats(stats), playerCount: players.length });
  }
  return result;
}

// เหมือน computeTeamStats แต่แบ่งกลุ่มตามรุ่นอายุแทนทีม (ใช้ตอนดูข้อมูลทีมใดทีมหนึ่งโดยเฉพาะ เช่น
// หน้าจอของโค้ช/ผู้บริหารทีม — เพราะดูทีมเดียวอยู่แล้ว การแยกตามทีมซ้ำจึงไม่มีประโยชน์เท่าแยกตามรุ่นอายุ)
function computeAgeGroupStats(ageGroupGroups, attendanceRecords) {
  const result = new Map();
  for (const [ageGroup, groupPlayers] of ageGroupGroups) {
    const playerIds = new Set(groupPlayers.map((p) => p.id));
    const groupRecords = attendanceRecords.filter((r) => playerIds.has(r.playerId));
    const stats = computeAttendanceStats(groupPlayers, groupRecords);
    result.set(ageGroup, { stats, totals: sumStats(stats), playerCount: groupPlayers.length });
  }
  return result;
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

// mode "team": ดูภาพรวมทุกทีม (ผู้ดูแลระบบเลือก "ทุกทีม") — สถิติรวม/พาย/กราฟแท่งด้านบนยังคงสรุปตามทีมเหมือน
//   เดิม (จาก groups/groupStats) แต่ตารางด้านล่างแยกเป็นรายคนของโค้ชแต่ละคน ไม่รวมเป็นแถวเดียวต่อทีม —
//   coachLookup คือ array จาก buildCoachOverviewRows (หนึ่งแถวต่อโค้ชหนึ่งคน พร้อมสถิติเฉพาะรุ่นที่ดูแล)
// mode "ageGroup": ดูข้อมูลทีมใดทีมหนึ่งโดยเฉพาะ (โค้ช/ผู้บริหารทีม/ผู้ดูแลระบบที่เลือกทีมเดียว) — แบ่งกลุ่ม
//   ตามรุ่นอายุแทน เพราะดูทีมเดียวอยู่แล้ว แบ่งตามทีมซ้ำไม่มีประโยชน์ coachLookup เป็นฟังก์ชัน (ageGroup) => coachName
//   เพื่อให้แต่ละแถวแสดงโค้ชประจำรุ่นนั้น ๆ ถูกต้อง (แต่ละรุ่นอาจมีโค้ชคนละคน)
function renderOverview(groups, groupStats, mode, coachLookup) {
  const isAgeGroupMode = mode === "ageGroup";

  const overall = { players: 0, attended: 0, missed: 0, total: 0, scoreSum: 0, scoreCount: 0 };
  for (const [, { totals, playerCount }] of groupStats) {
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
    statCard(isAgeGroupMode ? "จำนวนรุ่นทั้งหมด" : "จำนวนทีมทั้งหมด", groups.size) +
    statCard("จำนวนนักกีฬาทั้งหมด", overall.players) +
    statCard("% เข้าร่วมฝึกซ้อมรวม", `${overallPercent}%`) +
    statCard("คะแนนเฉลี่ยรวม", overallAvgScore);

  playersPieTitleEl.textContent = isAgeGroupMode ? "สัดส่วนนักกีฬาต่อรุ่น" : "สัดส่วนนักกีฬาต่อทีม";
  attendanceBarsTitleEl.textContent = isAgeGroupMode ? "% เข้าร่วมฝึกซ้อมแต่ละรุ่น" : "% เข้าร่วมฝึกซ้อมแต่ละทีม";
  scoreBarsTitleEl.textContent = isAgeGroupMode ? "คะแนนเฉลี่ยแต่ละรุ่น (เต็ม 4)" : "คะแนนเฉลี่ยแต่ละทีม (เต็ม 4)";
  teamSummaryColGroupEl.textContent = isAgeGroupMode ? "รุ่นอายุ" : "ทีม";

  renderPlayersPie(groups);
  renderBarChart(
    "attendance-bars",
    Array.from(groupStats.entries()).map(([key, { totals }]) => ({
      label: key,
      value: totals.total > 0 ? Math.round((totals.attended / totals.total) * 100) : 0
    })),
    (v) => `${v}%`,
    100
  );
  renderBarChart(
    "score-bars",
    Array.from(groupStats.entries()).map(([key, { totals }]) => ({
      label: key,
      value: totals.scoreCount > 0 ? totals.scoreSum / totals.scoreCount : 0
    })),
    (v) => v.toFixed(1),
    4
  );

  if (groupStats.size === 0) {
    teamSummaryBodyEl.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่มีข้อมูล</td></tr>';
    return;
  }

  if (isAgeGroupMode) {
    // ดูทีมเดียวอยู่แล้ว (มาจาก URL) ไม่ต้องมีปุ่มเลือกทีมซ้ำ
    teamSummaryTabsEl.classList.add("hidden");
    teamSummaryTabsEl.innerHTML = "";
    teamSummaryBodyEl.innerHTML = Array.from(groupStats.entries())
      .map(([key, { totals, playerCount }]) => {
        const percent = totals.total > 0 ? Math.round((totals.attended / totals.total) * 100) : 0;
        const avgScore = totals.scoreCount > 0 ? (totals.scoreSum / totals.scoreCount).toFixed(1) : "-";
        const coachName = coachLookup(key) || "-";
        return `
        <tr>
          <td class="emphasis">${key}</td>
          <td>${coachName}</td>
          <td>${playerCount}</td>
          <td>${percent}%</td>
          <td>${avgScore}</td>
        </tr>`;
      })
      .join("");
    applyDataLabels(teamSummaryBodyEl);
  } else if (coachLookup.length === 0) {
    teamSummaryTabsEl.classList.add("hidden");
    teamSummaryTabsEl.innerHTML = "";
    teamSummaryBodyEl.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่มีข้อมูลโค้ช</td></tr>';
  } else {
    // ดูภาพรวมทุกทีม — เลือกดูทีละทีมผ่านปุ่มแทนการแสดงโค้ชทุกทีมพร้อมกัน (ไม่งั้นตารางยาวเกินไปเมื่อมีหลายทีม
    // หลายโค้ช) โดย default เลือกทีมแรกตามลำดับ TEAMS ให้อัตโนมัติ
    const teamsPresent = Array.from(new Set(coachLookup.map((row) => row.team)));
    teamSummaryTabsEl.classList.remove("hidden");
    teamSummaryTabsEl.innerHTML = "";

    function showTeamRows(team, btn) {
      for (const tabBtn of teamSummaryTabsEl.children) {
        tabBtn.classList.toggle("btn-primary", tabBtn === btn);
        tabBtn.classList.toggle("btn-secondary", tabBtn !== btn);
      }
      teamSummaryBodyEl.innerHTML = coachLookup
        .filter((row) => row.team === team)
        .map((row) => {
          const percent = row.totals.total > 0 ? Math.round((row.totals.attended / row.totals.total) * 100) : 0;
          const avgScore = row.totals.scoreCount > 0 ? (row.totals.scoreSum / row.totals.scoreCount).toFixed(1) : "-";
          return `
        <tr>
          <td class="emphasis">${teamLogoImg(row.team)}${row.team}</td>
          <td>${row.coachName} — ${coachPositionLabel(row.coachPosition)} (${row.ageGroups.join(", ") || "-"})</td>
          <td>${row.playerCount}</td>
          <td>${percent}%</td>
          <td>${avgScore}</td>
        </tr>`;
        })
        .join("");
      applyDataLabels(teamSummaryBodyEl);
    }

    for (const team of teamsPresent) {
      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = "btn btn-secondary btn-sm";
      tabBtn.innerHTML = `${teamLogoImg(team)}${team}`;
      tabBtn.addEventListener("click", () => showTeamRows(team, tabBtn));
      teamSummaryTabsEl.appendChild(tabBtn);
    }
    showTeamRows(teamsPresent[0], teamSummaryTabsEl.children[0]);
  }
}

// แสดงสถิติการเข้าฝึกซ้อมทีละรุ่นอายุแทนการรวมทั้งทีมไว้ในตารางเดียว (เหมือนรายชื่อผู้เล่นด้านบน) — คลิกปุ่ม
// รุ่นอายุเพื่อสลับดูทีละรุ่น โดย default เลือกรุ่นที่น้อยที่สุดของทีมนั้นให้อัตโนมัติ
function renderAttendanceGroups(playerGroups, attendanceRecords) {
  attendanceGroupsEl.innerHTML = "";
  if (playerGroups.size === 0) {
    attendanceGroupsEl.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีข้อมูลผู้เล่นใน Firestore</p>';
    return;
  }
  for (const [team, teamPlayers] of playerGroups) {
    const ageGroupStats = computeAgeGroupStats(groupByAgeGroup(teamPlayers), attendanceRecords);
    const ageGroupKeys = Array.from(ageGroupStats.keys());

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <h3 class="section-title text-sm mb-2">${teamLogoImg(team)}${team}</h3>
      <div class="flex flex-wrap gap-2 mb-3"></div>
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
          <tbody></tbody>
        </table>
      </div>
    `;
    const tabsEl = wrapper.querySelector("div");
    const tbody = wrapper.querySelector("tbody");

    function showAgeGroup(ageGroup, btn) {
      for (const tabBtn of tabsEl.children) {
        tabBtn.classList.toggle("btn-primary", tabBtn === btn);
        tabBtn.classList.toggle("btn-secondary", tabBtn !== btn);
      }
      const stats = ageGroupStats.get(ageGroup)?.stats ?? [];
      tbody.innerHTML = stats
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
        .join("");
      applyDataLabels(tbody);
    }

    for (const ageGroup of ageGroupKeys) {
      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = "btn btn-secondary btn-sm";
      tabBtn.textContent = `${ageGroup} (${ageGroupStats.get(ageGroup).playerCount})`;
      tabBtn.addEventListener("click", () => showAgeGroup(ageGroup, tabBtn));
      tabsEl.appendChild(tabBtn);
    }
    if (ageGroupKeys.length > 0) {
      showAgeGroup(ageGroupKeys[0], tabsEl.children[0]);
    }

    attendanceGroupsEl.appendChild(wrapper);
  }
}

// ---------- ความคืบหน้าการประเมินรายวัน แยกตามรุ่นอายุ (เฉพาะตอนดูข้อมูลทีมใดทีมหนึ่ง) ----------
const AGE_PROGRESS_COLORS = {
  complete: "#10b981",
  partial: "#f59e0b",
  not_started: "#ef4444",
  no_training: "#94a3b8"
};
const AGE_PROGRESS_LABELS = {
  complete: "ประเมินครบแล้ว",
  partial: "ประเมินบางส่วน",
  not_started: "ยังไม่เริ่มประเมิน",
  no_training: "ไม่มีฝึกซ้อม"
};
const UNASSIGNED_AGE_GROUP = "ไม่ระบุรุ่นอายุ";

async function loadAgeGroupProgress(team, dateStr) {
  ageProgressTableBody.innerHTML =
    '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';

  const ageGroups = new Map();
  for (const p of currentTeamPlayers) {
    const ag = p.ageGroup || UNASSIGNED_AGE_GROUP;
    if (!ageGroups.has(ag)) ageGroups.set(ag, []);
    ageGroups.get(ag).push(p);
  }

  if (ageGroups.size === 0) {
    ageProgressTableBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่มีนักกีฬาในทีมนี้</td></tr>';
    renderAgeProgressPie([]);
    return;
  }

  const sessionSnap = await getDocs(
    query(collection(db, "sessions"), where("date", "==", dateStr), where("team", "==", team))
  );

  let noTraining = false;
  let attendanceRecords = [];
  if (!sessionSnap.empty) {
    const sessionDoc = sessionSnap.docs[0];
    noTraining = !!sessionDoc.data().noTraining;
    if (!noTraining) {
      const attSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("sessionId", "==", sessionDoc.id),
          where("team", "==", team)
        )
      );
      attSnap.forEach((d) => attendanceRecords.push(d.data()));
    }
  }

  const rows = [];
  for (const [ageGroup, groupPlayers] of ageGroups) {
    if (noTraining) {
      rows.push({ ageGroup, totalPlayers: groupPlayers.length, evaluated: 0, noTraining: true, completedAt: null });
      continue;
    }
    const evaluatedRecords = attendanceRecords.filter(
      (a) => isPlayerFullyEvaluated(a) && groupPlayers.some((p) => p.id === a.playerId)
    );
    let completedAt = null;
    if (groupPlayers.length > 0 && evaluatedRecords.length >= groupPlayers.length) {
      for (const a of evaluatedRecords) {
        if (a.updatedAt && typeof a.updatedAt.toDate === "function") {
          const t = a.updatedAt.toDate();
          if (!completedAt || t > completedAt) completedAt = t;
        }
      }
    }
    rows.push({ ageGroup, totalPlayers: groupPlayers.length, evaluated: evaluatedRecords.length, noTraining: false, completedAt });
  }

  rows.sort((a, b) => a.ageGroup.localeCompare(b.ageGroup));

  ageProgressTableBody.innerHTML = rows
    .map((r) => {
      const notEvaluated = Math.max(r.totalPlayers - r.evaluated, 0);
      if (r.noTraining) {
        return `
          <tr>
            <td class="emphasis">${r.ageGroup}</td>
            <td>${r.totalPlayers}</td>
            <td class="text-slate-400" colspan="2">ไม่มีฝึกซ้อม</td>
            <td>-</td>
          </tr>`;
      }
      const completedAtText = r.completedAt
        ? r.completedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น."
        : "-";
      return `
        <tr>
          <td class="emphasis">${r.ageGroup}</td>
          <td>${r.totalPlayers}</td>
          <td class="text-emerald-600 font-medium">${r.evaluated}</td>
          <td class="text-red-500 font-medium">${notEvaluated}</td>
          <td>${completedAtText}</td>
        </tr>`;
    })
    .join("");
  applyDataLabels(ageProgressTableBody);

  renderAgeProgressPie(rows);
}

function categorizeAgeProgress(r) {
  if (r.noTraining) return "no_training";
  if (r.totalPlayers === 0) return null;
  if (r.evaluated >= r.totalPlayers) return "complete";
  if (r.evaluated > 0) return "partial";
  return "not_started";
}

function renderAgeProgressPie(rows) {
  const counts = { complete: 0, partial: 0, not_started: 0, no_training: 0 };
  for (const r of rows) {
    const cat = categorizeAgeProgress(r);
    if (cat) counts[cat] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    ageProgressPie.style.background = "conic-gradient(#e2e8f0 0% 100%)";
    ageProgressLegend.innerHTML = '<p class="text-slate-400 text-center">ไม่มีข้อมูล</p>';
    return;
  }

  let acc = 0;
  const segments = [];
  for (const key of Object.keys(counts)) {
    if (counts[key] === 0) continue;
    const percent = (counts[key] / total) * 100;
    const start = acc;
    acc += percent;
    segments.push(`${AGE_PROGRESS_COLORS[key]} ${start}% ${acc}%`);
  }
  ageProgressPie.style.background = `conic-gradient(${segments.join(", ")})`;

  ageProgressLegend.innerHTML = Object.keys(counts)
    .filter((key) => counts[key] > 0)
    .map(
      (key) => `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full inline-block" style="background:${AGE_PROGRESS_COLORS[key]}"></span>
        <span class="text-slate-600">${AGE_PROGRESS_LABELS[key]}: ${counts[key]} รุ่น</span>
      </div>`
    )
    .join("");
}

ageProgressRefreshBtn.addEventListener("click", () => {
  if (!currentScopeTeam || !ageProgressDateInput.value) return;
  loadAgeGroupProgress(currentScopeTeam, ageProgressDateInput.value);
});

// ---------- รายงานสถานะการฝึกซ้อมประจำวัน ส่งโดยโค้ช (เฉพาะตอนดูข้อมูลทีมใดทีมหนึ่ง) ----------
const PERIOD_TYPE_LABELS = { morning: "ซ้อมเช้า", evening: "ซ้อมเย็น" };

function formatReportPeriod(r) {
  if (!r.periodType) return "-";
  const label = r.periodType === "other" ? r.periodOtherText || "อื่นๆ" : PERIOD_TYPE_LABELS[r.periodType] || r.periodType;
  const timeRange = r.periodStartTime && r.periodEndTime ? `${r.periodStartTime} - ${r.periodEndTime} น.` : "";
  return timeRange ? `${label} (${timeRange})` : label;
}

function formatReportAttended(r) {
  const autoTag = r.autoFromNoTraining
    ? ' <span class="text-xs text-slate-400">(ซิงก์จากวันไม่มีฝึกซ้อม)</span>'
    : "";
  if (r.attended === true) return `<span class="badge badge-success">มีการซ้อม</span>${autoTag}`;
  if (r.attended === false) return `<span class="badge badge-warning">ไม่มีการซ้อม</span>${autoTag}`;
  return '<span class="text-slate-400">-</span>';
}

// พิกัด GPS บันทึกไว้เบื้องหลังเพื่อให้ผู้ดูแลระบบ/ผู้บริหารทีมตรวจสอบเท่านั้น
// บัญชีโค้ชห้ามเห็นคอลัมน์นี้เด็ดขาด (ทั้งหัวตารางและลิงก์แผนที่ในแต่ละแถว)
async function loadTrainingReports(team) {
  const showLocation = currentViewerRole !== "coach";
  trainingReportsLocationHeader.classList.toggle("hidden", !showLocation);
  const colCount = showLocation ? 7 : 6;

  trainingReportsBody.innerHTML =
    `<tr><td colspan="${colCount}" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>`;

  const snap = await getDocs(query(collection(db, "trainingReports"), where("team", "==", team)));
  const reports = [];
  snap.forEach((d) => reports.push({ id: d.id, ...d.data() }));
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (reports.length === 0) {
    trainingReportsBody.innerHTML =
      `<tr><td colspan="${colCount}" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายงานจากโค้ช</td></tr>`;
    return;
  }

  trainingReportsBody.innerHTML = reports
    .map((r) => {
      const postedAt =
        r.updatedAt && typeof r.updatedAt.toDate === "function"
          ? r.updatedAt.toDate().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
          : "-";
      const mapCell = showLocation
        ? `<td>${
            r.location
              ? `<a href="https://www.google.com/maps?q=${r.location.lat},${r.location.lng}" target="_blank" rel="noopener" class="text-blue-600 underline">ดูแผนที่</a>`
              : "-"
          }</td>`
        : "";
      return `
        <tr>
          <td class="emphasis">${r.date ?? "-"}</td>
          <td>${r.coachName ?? "-"}</td>
          <td>${formatReportPeriod(r)}</td>
          <td>${formatReportAttended(r)}</td>
          <td>${r.notes ?? "-"}</td>
          <td>${postedAt}</td>
          ${mapCell}
        </tr>`;
    })
    .join("");
  applyDataLabels(trainingReportsBody);
}

// scopeTeam: null = ผู้ดูแลระบบ เห็นทุกทีม / string = โค้ช เห็นเฉพาะทีมตัวเอง
// ---------- สรุปการส่งแผนการฝึกซ้อมรายวัน (ภาพรวมทุกโค้ช เพื่อจับตาดูโค้ชที่ส่งสายบ่อย) ----------
async function loadTrainingPlanSummary(scopeTeam) {
  const isAdminViewer = currentViewerRole === "admin";
  trainingPlanSummaryActionHeader.classList.toggle("hidden", !isAdminViewer);
  const colCount = isAdminViewer ? 7 : 6;

  trainingPlanSummaryBody.innerHTML =
    `<tr><td colspan="${colCount}" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>`;

  const snap = scopeTeam
    ? await getDocs(query(collection(db, "trainingPlans"), where("team", "==", scopeTeam)))
    : await getDocs(collection(db, "trainingPlans"));
  const plans = [];
  snap.forEach((d) => plans.push(d.data()));

  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const monthPlans = plans.filter((p) => (p.date || "").startsWith(thisMonth));

  // จัดกลุ่มตามโค้ช+ทีม (กันชื่อโค้ชซ้ำกันคนละทีม) เพราะเป้าหมายคือดูมาตรฐานการส่งของโค้ชแต่ละคน ไม่ใช่ทีม
  const groups = new Map();
  for (const p of monthPlans) {
    const key = `${p.coachName ?? "-"}__${p.team ?? "-"}`;
    if (!groups.has(key)) {
      groups.set(key, { coachName: p.coachName ?? "-", team: p.team ?? "-", total: 0, late: 0 });
    }
    const g = groups.get(key);
    g.total += 1;
    if (isTrainingPlanLate(p)) g.late += 1;
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.late - a.late);
  currentTrainingPlanRows = rows;

  if (rows.length === 0) {
    trainingPlanSummaryBody.innerHTML =
      `<tr><td colspan="${colCount}" class="px-4 py-6 text-center text-slate-400">ยังไม่มีการส่งแผนการฝึกซ้อมในเดือนนี้</td></tr>`;
    return;
  }

  trainingPlanSummaryBody.innerHTML = rows
    .map((r, i) => {
      const onTime = r.total - r.late;
      // สายเกินเกณฑ์ (>3 ครั้ง/เดือน) = ต้องปรับปรุงมาตรฐานการส่งแผน
      const needsImprovement = r.late > TRAINING_PLAN_LATE_WARNING_THRESHOLD;
      const statusBadge = needsImprovement
        ? '<span class="badge badge-danger">⚠️ ต้องปรับปรุง</span>'
        : '<span class="badge badge-success">ปกติ</span>';
      const actionCell = isAdminViewer
        ? `<td><button type="button" class="btn btn-secondary btn-sm" data-send-coach-index="${i}">📤 แจ้ง</button></td>`
        : "";
      return `
        <tr>
          <td class="emphasis">${r.coachName}</td>
          <td>${teamLogoImg(r.team)}${r.team}</td>
          <td>${r.total}</td>
          <td class="text-emerald-600 font-medium">${onTime}</td>
          <td class="text-red-500 font-medium">${r.late}</td>
          <td>${statusBadge}</td>
          ${actionCell}
        </tr>`;
    })
    .join("");
  applyDataLabels(trainingPlanSummaryBody);
}

// แจ้งผู้บริหารทีมว่าโค้ชคนนี้ส่งแผนสายเกินเกณฑ์ (ปุ่มนี้แสดงเฉพาะผู้ดูแลระบบ) — ใช้ event delegation
// เพราะแถวถูกสร้างใหม่ทุกครั้งที่โหลดข้อมูล
trainingPlanSummaryBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-send-coach-index]");
  if (!btn) return;
  const r = currentTrainingPlanRows[Number(btn.dataset.sendCoachIndex)];
  if (!r) return;
  const onTime = r.total - r.late;
  const defaultMessage = `โค้ช ${r.coachName} (ทีม ${r.team}) ส่งแผนการฝึกซ้อมสาย ${r.late} ครั้งจากทั้งหมด ${r.total} ครั้งในเดือนนี้ (ตรงเวลา ${onTime} ครั้ง) ควรพูดคุยเรื่องมาตรฐานการส่งแผน`;
  const message = prompt("ข้อความที่จะส่งถึงผู้บริหารทีม:", defaultMessage);
  if (message === null || !message.trim()) return;
  try {
    await sendExecutiveNote({
      team: r.team,
      type: "coach",
      refId: null,
      refLabel: r.coachName,
      message: message.trim(),
      createdBy: currentAdminName
    });
    alert("ส่งข้อความถึงผู้บริหารทีมแล้ว ✓");
  } catch (err) {
    console.error(err);
    alert("ส่งไม่สำเร็จ: " + err.message);
  }
});

// ---------- รายงานผลการแข่งขัน + รายงานอาการบาดเจ็บ (ภาพรวมทุกทีม หรือทีมที่เลือก) ----------
async function loadMatchAndInjuryReports(scopeTeam) {
  matchReportsStatCardsEl.innerHTML = "";
  dashboardMatchBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  injuryReportsStatCardsEl.innerHTML = "";
  dashboardInjuryBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';

  const [matchSnap, injurySnap] = await Promise.all([
    scopeTeam
      ? getDocs(query(collection(db, "matchReports"), where("team", "==", scopeTeam)))
      : getDocs(collection(db, "matchReports")),
    scopeTeam
      ? getDocs(query(collection(db, "injuryReports"), where("team", "==", scopeTeam)))
      : getDocs(collection(db, "injuryReports"))
  ]);

  const matches = [];
  matchSnap.forEach((d) => matches.push(d.data()));
  matches.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const winCount = matches.filter((m) => m.result === "ชนะ").length;
  const loseCount = matches.filter((m) => m.result === "แพ้").length;
  const drawCount = matches.filter((m) => m.result === "เสมอ").length;

  matchReportsStatCardsEl.innerHTML =
    statCard("แข่งทั้งหมด", matches.length) +
    statCard("ชนะ", winCount) +
    statCard("แพ้", loseCount) +
    statCard("เสมอ", drawCount);

  if (matches.length === 0) {
    dashboardMatchBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายการแข่งขัน</td></tr>';
  } else {
    dashboardMatchBody.innerHTML = matches
      .map(
        (m) => `
        <tr>
          <td class="emphasis">${teamLogoImg(m.team)}${m.team ?? "-"}</td>
          <td>${m.date ?? "-"}</td>
          <td>${m.opponent ?? "-"}</td>
          <td>${m.competitionType ?? "-"}</td>
          <td>${m.ageGroup ?? "-"}</td>
          <td>${matchResultBadge(m.result)}</td>
          <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
          <td>${m.competition ?? "-"}</td>
        </tr>`
      )
      .join("");
    applyDataLabels(dashboardMatchBody);
  }

  const injuries = [];
  injurySnap.forEach((d) => injuries.push(d.data()));
  injuries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const activeCount = injuries.filter((i) => i.status !== "หายแล้ว").length;
  const recoveredCount = injuries.filter((i) => i.status === "หายแล้ว").length;
  const severeCount = injuries.filter((i) => i.severity === "รุนแรง").length;

  injuryReportsStatCardsEl.innerHTML =
    statCard("รายการทั้งหมด", injuries.length) +
    statCard("ยังไม่หาย", activeCount) +
    statCard("หายแล้ว", recoveredCount) +
    statCard("รุนแรง", severeCount);

  if (injuries.length === 0) {
    dashboardInjuryBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ไม่มีรายงานอาการบาดเจ็บ</td></tr>';
  } else {
    dashboardInjuryBody.innerHTML = injuries
      .map(
        (inj) => `
        <tr>
          <td class="emphasis">${teamLogoImg(inj.team)}${inj.team ?? "-"}</td>
          <td>${inj.date ?? "-"}</td>
          <td class="emphasis">${inj.playerName ?? "-"}</td>
          <td>${inj.ageGroup ?? "-"}</td>
          <td>${inj.description ?? "-"}</td>
          <td>${injurySeverityBadge(inj.severity)}</td>
          <td>${injuryStatusBadge(inj.status)}</td>
          <td>${inj.expectedReturn ?? "-"}</td>
        </tr>`
      )
      .join("");
    applyDataLabels(dashboardInjuryBody);
  }
}

// วาดภาพรวมของทีมที่เลือกอยู่ (การ์ดสรุป/พาย/กราฟแท่ง/ตาราง) เฉพาะตำแหน่งที่เลือก ("player" = ทุกตำแหน่ง
// ยกเว้น GK, "gk" = เฉพาะผู้รักษาประตู) เรียกซ้ำได้ทันทีตอนคลิกปุ่มสลับโดยไม่ต้องโหลดข้อมูลจาก Firestore ใหม่
function renderScopedTeamOverviewForPosition(position) {
  if (!scopedOverviewData) return;
  currentDashboardPosition = position;
  const { scopeTeam, players, attendanceRecords, coachNameByAgeGroup, gkCoachNameByAgeGroup } = scopedOverviewData;
  const filteredPlayers = players.filter((p) => (p.position === "GK") === (position === "gk"));
  const ageGroupGroups = groupByAgeGroup(filteredPlayers);
  const ageGroupStats = computeAgeGroupStats(ageGroupGroups, attendanceRecords);
  const lookup = position === "gk" ? gkCoachNameByAgeGroup : coachNameByAgeGroup;
  renderOverview(ageGroupGroups, ageGroupStats, "ageGroup", (ageGroup) => lookup.get(`${scopeTeam}||${ageGroup}`));

  playerPositionToggleBtn.classList.toggle("btn-primary", position === "player");
  playerPositionToggleBtn.classList.toggle("btn-secondary", position !== "player");
  gkPositionToggleBtn.classList.toggle("btn-primary", position === "gk");
  gkPositionToggleBtn.classList.toggle("btn-secondary", position !== "gk");
}

playerPositionToggleBtn.addEventListener("click", () => renderScopedTeamOverviewForPosition("player"));
gkPositionToggleBtn.addEventListener("click", () => renderScopedTeamOverviewForPosition("gk"));

// เลื่อนไปยัง section ที่ระบุใน URL hash โดยตรง (เช่น มาจากลิงก์แจ้งเตือน index.html?team=__ALL__#training-plan-summary-section)
// เพื่อให้ผู้ดูแลระบบดำเนินการต่อจากที่คลิกแจ้งเตือนได้เลย ไม่ต้องไล่หา section เอง — เรียกตอน dashboardContent
// ถูกเอา class hidden ออกแล้วเสมอ (ผู้เรียกทุกจุดเปิดให้เห็นก่อนค่อยเรียก loadDashboard) จึงเลื่อนได้ทันที
function scrollToHashTarget() {
  const targetId = window.location.hash.replace(/^#/, "");
  if (!targetId) return;
  const el = document.getElementById(targetId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadDashboard(scopeTeam) {
  try {
    setStatus("กำลังโหลดข้อมูล...");
    scrollToHashTarget();
    currentScopeTeam = scopeTeam;
    const [players, attendanceRecords, coaches] = await Promise.all([
      scopeTeam ? loadCollectionForTeam("players", scopeTeam) : loadCollection("players"),
      scopeTeam ? loadCollectionForTeam("attendance", scopeTeam) : loadCollection("attendance"),
      loadCollection("coaches")
    ]);
    currentTeamPlayers = scopeTeam ? players : [];
    const coachNameByAgeGroup = buildCoachNameByAgeGroup(coaches);
    const playerGroups = groupByTeam(players);
    const teamStats = computeTeamStats(playerGroups, attendanceRecords);

    if (scopeTeam) {
      // ดูข้อมูลทีมเดียวอยู่แล้ว (โค้ช/ผู้บริหารทีม/ผู้ดูแลระบบที่เลือกทีมเดียว) — ภาพรวมด้านบนแบ่งตาม
      // รุ่นอายุแทนทีม เพื่อให้เห็นข้อมูลที่ใช้ได้จริงมากกว่าการแยกตามทีมซึ่งมีทีมเดียวอยู่แล้ว พร้อมปุ่มสลับดู
      // "ผู้เล่น" กับ "GK" เพราะมีโค้ชดูแลคนละคน (GK Coach ดูแลผู้รักษาประตูแยกจาก Head/Assistant Coach)
      const gkCoachNameByAgeGroup = buildGkCoachNameByAgeGroup(coaches);
      positionToggleWrap.classList.remove("hidden");
      scopedOverviewData = { scopeTeam, players, attendanceRecords, coachNameByAgeGroup, gkCoachNameByAgeGroup };
      renderScopedTeamOverviewForPosition(currentDashboardPosition);
    } else {
      positionToggleWrap.classList.add("hidden");
      scopedOverviewData = null;
      const coachOverviewRows = buildCoachOverviewRows(coaches, playerGroups, attendanceRecords);
      renderOverview(playerGroups, teamStats, "team", coachOverviewRows);
    }
    renderPlayersGroups(playerGroups);
    renderAttendanceGroups(playerGroups, attendanceRecords);
    setStatus(`โหลดข้อมูลสำเร็จ • ผู้เล่น ${players.length} คน • ${playerGroups.size} ทีม`);

    loadTrainingPlanSummary(scopeTeam);
    loadMatchAndInjuryReports(scopeTeam);

    ageProgressSection.classList.toggle("hidden", !scopeTeam);
    trainingReportsSection.classList.toggle("hidden", !scopeTeam);
    if (scopeTeam) {
      if (!ageProgressDateInput.value) {
        ageProgressDateInput.value = new Date().toISOString().slice(0, 10);
      }
      await loadAgeGroupProgress(scopeTeam, ageProgressDateInput.value);
      await loadTrainingReports(scopeTeam);
    }
  } catch (err) {
    console.error(err);
    setStatus(
      "โหลดข้อมูลไม่สำเร็จ: " + err.message + " (ตรวจสอบ firebase-config.js และ Firestore Rules)",
      true
    );
  }
}

// ---------- ผู้ดูแลระบบ: การ์ดเลือกทีม (สไตล์เดียวกับแผงควบคุมผู้ดูแลระบบในหน้าเช็คชื่อ) ----------
function linkCard(iconHtml, title, description, href) {
  const a = document.createElement("a");
  a.href = href;
  a.className = "text-left card card-pad hover:shadow-md hover:ring-2 hover:ring-slate-900 transition block";
  a.innerHTML = `
    ${iconHtml}
    <div class="text-lg font-semibold mb-1">${title}</div>
    <p class="text-sm text-slate-500">${description}</p>
  `;
  return a;
}

function emojiBadge(emoji) {
  return `<div class="icon-badge icon-badge-lg mb-3">${emoji}</div>`;
}

// การ์ดของแต่ละทีมใช้โลโก้จริงแทนอิโมจิ 🛡️ (teamIconBadge จะ fallback เป็น 🛡️ เองถ้าไม่รู้จักชื่อทีมนี้)
function teamPickCard(title, description, teamParam) {
  return linkCard(teamIconBadge(teamParam, { extraClass: "mb-3" }), title, description, `/?team=${encodeURIComponent(teamParam)}`);
}

function renderAdminPickTeamGrid() {
  adminPickTeamGrid.innerHTML = "";
  adminPickTeamGrid.appendChild(
    linkCard(emojiBadge("📊"), "ทุกทีม (ภาพรวม)", "ดูสรุปข้อมูลรวมทุกทีมในหน้าเดียว", `/?team=${encodeURIComponent("__ALL__")}`)
  );
  for (const team of TEAMS) {
    adminPickTeamGrid.appendChild(teamPickCard(team, "ดูข้อมูล Dashboard เฉพาะทีมนี้", team));
  }
}

// ---------- เมนูนำทางแบบเลื่อน (Hamburger Drawer) — เหมือนกับใน attendance.html ----------
function openDrawer() {
  navDrawerOverlay.classList.remove("hidden");
  navDrawer.classList.remove("nav-drawer-hidden");
}

function closeDrawer() {
  navDrawer.classList.add("nav-drawer-hidden");
  navDrawerOverlay.classList.add("hidden");
}

hamburgerBtn.addEventListener("click", openDrawer);
navDrawerCloseBtn.addEventListener("click", closeDrawer);
navDrawerOverlay.addEventListener("click", closeDrawer);

// ---------- การแจ้งเตือน (เฉพาะผู้ดูแลระบบ — โค้ช/ผู้บริหารทีมมีปุ่มกระดิ่งแต่ยังไม่เปิดใช้งาน) ----------
let currentNotifications = [];

async function refreshNotifications() {
  if (currentViewerRole !== "admin") return;
  notificationList.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">กำลังโหลด...</p>';
  try {
    currentNotifications = await loadAdminNotifications();
    renderAdminNotifications(notificationList, currentNotifications);
    const unreadCount = currentNotifications.filter((n) => !n.read).length;
    notificationBadge.classList.toggle("hidden", unreadCount === 0);
  } catch (err) {
    console.error(err);
    notificationList.innerHTML = `<p class="text-red-600 text-sm text-center py-6">โหลดการแจ้งเตือนไม่สำเร็จ: ${err.message}</p>`;
  }
}

notificationBellBtn.addEventListener("click", () => {
  const opening = notificationPanel.classList.contains("hidden");
  notificationPanel.classList.toggle("hidden", !opening);
  if (opening) refreshNotifications();
});
notificationRefreshBtn.addEventListener("click", refreshNotifications);
// คลิกปุ่ม "✓" ในรายการเพื่อทำเครื่องหมายว่าอ่านแล้วทีละรายการ (event delegation เพราะรายการถูกสร้างใหม่
// ทุกครั้งที่โหลดข้อมูล) กันไม่ให้คลิกไปโดนลิงก์ที่ห่ออยู่ด้วย (preventDefault + stopPropagation)
notificationList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-mark-read-index]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const n = currentNotifications[Number(btn.dataset.markReadIndex)];
  if (!n) return;
  try {
    await markNotificationRead(n.key, n.detail);
    refreshNotifications();
  } catch (err) {
    console.error(err);
    alert("ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ: " + err.message);
  }
});
document.addEventListener("click", (e) => {
  if (notificationPanel.classList.contains("hidden")) return;
  if (notificationPanel.contains(e.target) || notificationBellBtn.contains(e.target)) return;
  notificationPanel.classList.add("hidden");
});
drawerLogoutBtn.addEventListener("click", () => {
  closeDrawer();
  signOut(auth);
});

function drawerItem(icon, label, href) {
  const a = document.createElement("a");
  a.href = href;
  a.className = "drawer-item";
  a.innerHTML = `<span class="drawer-item-icon">${icon}</span><span>${label}</span>`;
  return a;
}

function drawerSectionLabel(text) {
  const div = document.createElement("div");
  div.className = "drawer-section-label";
  div.textContent = text;
  return div;
}

function drawerDivider() {
  const div = document.createElement("div");
  div.className = "drawer-divider";
  return div;
}

// เนื้อหาเมนูปรับตามบทบาท — ผู้ดูแลระบบเห็นลิงก์ตรงไปยังเครื่องมือแต่ละอย่างในหน้าเช็คชื่อ (ผ่าน
// ?admin=... deep link กันไม่ให้วน redirect กลับมาหน้านี้) โค้ช/ผู้บริหารทีมเห็นแค่ทางกลับไปหน้าหลักของตัวเอง
function renderDrawerItems() {
  navDrawerItems.innerHTML = "";

  if (currentViewerRole === "admin") {
    // ใช้ URL hash (#admin=...) แทน query string เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง (serve, clean-url) จะ
    // redirect "attendance.html" ไปเป็น "attendance" และตัด query string ทิ้งระหว่างทาง แต่ไม่ตัด hash
    navDrawerItems.appendChild(drawerSectionLabel("ผู้ดูแลระบบ"));
    navDrawerItems.appendChild(drawerItem("👥", "รายชื่อโค้ชในระบบ", "./attendance.html#admin=coaches"));
    navDrawerItems.appendChild(drawerItem("📈", "ความคืบหน้าการประเมินรายวัน", "./attendance.html#admin=progress"));
    navDrawerItems.appendChild(drawerItem("📝", "คำขอลงทะเบียนที่รอการอนุมัติ", "./attendance.html#admin=approvals"));
    navDrawerItems.appendChild(drawerItem("⚽", "รายงานผลการแข่งขันทั้งหมด", "./attendance.html#admin=matches"));
    navDrawerItems.appendChild(drawerItem("🩹", "รายงานอาการบาดเจ็บทั้งหมด", "./attendance.html#admin=injuries"));
    navDrawerItems.appendChild(drawerItem("📁", "จัดการข้อมูลทีม", "./attendance.html#admin=manage-team"));
    navDrawerItems.appendChild(drawerItem("🖨️", "พิมพ์สรุป Dashboard", "./attendance.html#admin=print"));
    navDrawerItems.appendChild(drawerItem("📈", "พัฒนาการนักกีฬา", "./development.html"));
    navDrawerItems.appendChild(drawerDivider());
    navDrawerItems.appendChild(drawerItem("🔄", "เลือกทีมอื่น (Dashboard)", "/"));
  } else if (currentViewerRole === "coach") {
    navDrawerItems.appendChild(drawerSectionLabel("เมนู"));
    navDrawerItems.appendChild(drawerItem("📅", "กลับหน้า Daily", "./attendance.html"));
  } else {
    navDrawerItems.appendChild(drawerSectionLabel("เมนู"));
    navDrawerItems.appendChild(drawerItem("📋", "กลับหน้าหลัก", "./attendance.html"));
  }
}

// ต้องล็อกอินด้วยบัญชีโค้ช/ผู้ดูแลระบบที่ได้รับอนุมัติแล้วเท่านั้น จึงจะเห็นข้อมูล Dashboard
// ผู้ดูแลระบบเลือกทีมจากหน้าเช็คชื่อเท่านั้น (ผ่านลิงก์ที่แนบ ?team= มา) ไม่มีตัวเลือกซ้ำในหน้านี้อีก
// ส่วนโค้ช/ผู้บริหารทีมเห็นเฉพาะทีมของตัวเองอัตโนมัติ
onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  hamburgerBtn.classList.add("hidden");
  notificationBellBtn.classList.add("hidden");
  if (!isCoachSession) {
    adminPickTeamPrompt.classList.add("hidden");
    dashboardBackLink.classList.add("hidden");
    closeDrawer();
    showLoginGate("ต้องเข้าสู่ระบบด้วยบัญชีโค้ชหรือผู้ดูแลระบบก่อน จึงจะดูข้อมูล Dashboard ได้");
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved") {
      adminPickTeamPrompt.classList.add("hidden");
      dashboardBackLink.classList.add("hidden");
      showLoginGate("บัญชีนี้ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ กรุณารอหรือติดต่อผู้ดูแลระบบ");
      return;
    }

    loginGate.classList.add("hidden");
    currentViewerRole = data.role;
    if (currentViewerRole === "admin") {
      currentAdminName = data.name || user.email;
      refreshNotifications();
    }

    // เมนู ☰/🔔 แสดงให้ทุกบทบาทที่ได้รับอนุมัติแล้ว พร้อมสะท้อนชื่อ/อีเมล/บทบาทเข้าไปในลิ้นชัก
    hamburgerBtn.classList.remove("hidden");
    notificationBellBtn.classList.remove("hidden");
    navDrawerNameEl.textContent = data.name || user.email;
    navDrawerEmailEl.textContent = user.email;
    navDrawerRoleBadgeEl.innerHTML =
      data.role === "admin"
        ? '<span class="badge badge-info">ผู้ดูแลระบบ</span>'
        : data.role === "executive"
          ? '<span class="badge badge-neutral">ผู้บริหารทีม</span>'
          : '<span class="badge badge-success">โค้ช</span>';
    renderDrawerItems();

    const isAdmin = data.role === "admin";
    // ลิงก์ "← กลับเมนูหลัก" แบบเดิมไปหน้าเช็คชื่อตรงๆ ใช้ไม่ได้กับผู้ดูแลระบบอีกต่อไป (จะโดน redirect
    // กลับมาหน้านี้ทันที) จึงซ่อนไว้เฉพาะผู้ดูแลระบบ ให้ใช้เมนู ☰ แทน — โค้ช/ผู้บริหารทีมยังใช้ได้ตามปกติ
    headerAttendanceLink.classList.toggle("hidden", isAdmin);
    if (isAdmin) {
      // ต้องมาจากลิงก์ "ดู Dashboard ทีมนี้" ในหน้าเช็คชื่อ (มี ?team= แนบมา) เท่านั้น ถึงจะเห็นข้อมูล
      // ถ้าเข้าหน้านี้ตรงๆ โดยไม่มีพารามิเตอร์ จะแสดงข้อความให้กลับไปเลือกทีมที่หน้าเช็คชื่อแทน
      const teamFromUrl = new URLSearchParams(window.location.search).get("team");
      if (teamFromUrl === "__ALL__") {
        adminPickTeamPrompt.classList.add("hidden");
        dashboardContent.classList.remove("hidden");
        dashboardBackLink.classList.remove("hidden");
        loadDashboard(null);
      } else if (teamFromUrl && TEAMS.includes(teamFromUrl)) {
        adminPickTeamPrompt.classList.add("hidden");
        dashboardContent.classList.remove("hidden");
        dashboardBackLink.classList.remove("hidden");
        loadDashboard(teamFromUrl);
      } else {
        // อยู่ที่หน้าเลือกทีมเอง (หน้าแรกของผู้ดูแลระบบ) ไม่มีหน้าก่อนหน้าให้ย้อนกลับแล้ว จึงไม่ต้องมีปุ่มนี้
        dashboardContent.classList.add("hidden");
        dashboardBackLink.classList.add("hidden");
        renderAdminPickTeamGrid();
        adminPickTeamPrompt.classList.remove("hidden");
        setStatus("");
      }
    } else {
      adminPickTeamPrompt.classList.add("hidden");
      dashboardBackLink.classList.add("hidden");
      dashboardContent.classList.remove("hidden");
      loadDashboard(data.team);
    }
  } catch (err) {
    console.error(err);
    setStatus("โหลดข้อมูลบัญชีไม่สำเร็จ: " + err.message, true);
  }
});
