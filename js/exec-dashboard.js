// Dashboard ของผู้บริหารทีม: ภาพรวมเดือนนี้ของทีมตัวเอง แยกตามรุ่นอายุ (ตรรกะล้วนๆ + HTML เป็นสตริง ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// การ์ดตัวเลข 6 ใบ · แนวโน้ม 30 วัน · ตารางเทียบรุ่นอายุ · ควรจับตา · ผลแข่งล่าสุด — ตารางรายละเอียดอื่นดูได้ในเมนูของหน้าทีม
import { computeAvgScore, escapeHtml, isTrainingPlanLate } from "./ui-utils.js";
import { ageGroupsOf } from "./player-gallery.js";
import { addDaysToDate, addMonthsToMonth } from "./coach-meetings.js";
import { ATTENDED_CODES, isInjuryActive } from "./admin-home.js";

export const TREND_DAYS = 30;
export const WATCH_ATTENDANCE_PCT = 85; // รุ่นที่ % เข้าซ้อมเดือนนี้ต่ำกว่านี้ขึ้นในรายการควรจับตา
export const WATCH_LATE_PLANS = 2; // โค้ชที่ส่งแผนสายตั้งแต่กี่ครั้งขึ้นในรายการควรจับตา
export const RECENT_MATCHES = 3;

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const round1 = (v) => Math.round(v * 10) / 10;
const pctOf = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const monthOf = (date) => String(date ?? "").slice(0, 7);

// % มาซ้อมจากแถวเช็คชื่อที่มีสถานะแล้ว (สูตรเดียวกับ Dashboard เดิม: A หรือค่าประเมิน 1-4 = มา)
function attendanceStats(records) {
  const withStatus = records.filter((r) => r.status);
  const attended = withStatus.filter((r) => ATTENDED_CODES.has(String(r.status))).length;
  const score = mean(withStatus.map((r) => computeAvgScore(r.scores)).filter((v) => v !== null));
  return { pct: pctOf(attended, withStatus.length), score: score === null ? null : round1(score), records: withStatus.length };
}

function planStats(plans) {
  const late = plans.filter(isTrainingPlanLate).length;
  return { total: plans.length, late, onTimePct: pctOf(plans.length - late, plans.length) };
}

const tally = (matches) => ({
  win: matches.filter((m) => m.result === "ชนะ").length,
  draw: matches.filter((m) => m.result === "เสมอ").length,
  lose: matches.filter((m) => m.result === "แพ้").length
});

// input: today ("YYYY-MM-DD"), players ของทีม, attendance (ตั้งแต่ต้นเดือนก่อนถึงวันนี้), plans/matches (เดือนนี้), injuries (ทั้งหมดของทีม)
export function execDashboardModel({ today, players = [], attendance = [], plans = [], matches = [], injuries = [] }) {
  const month = monthOf(today);
  const prevMonth = addMonthsToMonth(month, -1);
  const groupOf = new Map(players.map((p) => [p.id, p.ageGroup]));
  const records = attendance.filter((r) => groupOf.has(r.playerId));
  const monthRecords = records.filter((r) => monthOf(r.date) === month);
  const prevRecords = records.filter((r) => monthOf(r.date) === prevMonth);
  const monthPlans = plans.filter((p) => monthOf(p.date) === month);
  const monthMatches = matches.filter((m) => monthOf(m.date) === month);

  const att = attendanceStats(monthRecords);
  const prevAtt = attendanceStats(prevRecords);
  const planAll = planStats(monthPlans);
  const active = injuries.filter(isInjuryActive);
  const severeActive = active.filter((r) => r.severity === "รุนแรง");

  const groups = ageGroupsOf(players).map((g) => {
    const a = attendanceStats(monthRecords.filter((r) => groupOf.get(r.playerId) === g));
    return {
      ageGroup: g,
      players: players.filter((p) => p.ageGroup === g).length,
      pct: a.pct,
      score: a.score,
      plan: planStats(monthPlans.filter((p) => (p.ageGroups || []).includes(g))),
      match: tally(monthMatches.filter((m) => m.ageGroup === g)),
      injured: active.filter((r) => r.ageGroup === g).length
    };
  });

  // แนวโน้ม 30 วัน: ต่อวันมี % เข้าซ้อม และคะแนนเฉลี่ย (แปลงเป็น % ของเต็ม 4 ให้ใช้แกนเดียวกัน)
  const start = addDaysToDate(today, -(TREND_DAYS - 1));
  const byDate = new Map();
  for (const r of records) {
    if (!r.status || r.date < start || r.date > today) continue;
    byDate.set(r.date, [...(byDate.get(r.date) || []), r]);
  }
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const trend = [...byDate]
    .map(([date, rs]) => {
      const s = attendanceStats(rs);
      return { date, day: days(start, date), pct: s.pct, scorePct: s.score === null ? null : (s.score / 4) * 100 };
    })
    .sort((x, y) => x.day - y.day);

  const coachLate = new Map();
  for (const p of monthPlans) {
    const name = p.coachName ?? "-";
    const c = coachLate.get(name) || { name, total: 0, late: 0 };
    c.total += 1;
    if (isTrainingPlanLate(p)) c.late += 1;
    coachLate.set(name, c);
  }

  const watch = [
    ...severeActive.length ? [{ tone: "bad", tag: "บาดเจ็บ", text: `นักกีฬาบาดเจ็บรุนแรง ${severeActive.length} ราย` }] : [],
    ...groups.filter((g) => g.pct !== null && g.pct < WATCH_ATTENDANCE_PCT).map((g) => ({ tone: "warn", tag: "รุ่น", text: `${g.ageGroup} เข้าซ้อมเดือนนี้ ${g.pct}% (ต่ำกว่า ${WATCH_ATTENDANCE_PCT}%)` })),
    ...[...coachLate.values()].filter((c) => c.late >= WATCH_LATE_PLANS).sort((a, b) => b.late - a.late).map((c) => ({ tone: "warn", tag: "โค้ช", text: `${c.name} ส่งแผนสาย ${c.late} ครั้งจาก ${c.total}` }))
  ];

  return {
    today,
    month,
    kpis: {
      players: players.length,
      groupCount: groups.length,
      attendance: { pct: att.pct, delta: att.pct !== null && prevAtt.pct !== null ? att.pct - prevAtt.pct : null },
      score: { value: att.score, delta: att.score !== null && prevAtt.score !== null ? round1(att.score - prevAtt.score) : null },
      plan: planAll,
      match: { ...tally(monthMatches), total: monthMatches.length },
      injured: { active: active.length, severe: severeActive.length }
    },
    trend,
    groups,
    watch,
    recentMatches: [...monthMatches].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, RECENT_MATCHES)
  };
}

const tile = (label, value, sub = "", tone = "") =>
  `<div class="admin-home-tile${tone ? ` admin-home-tile-${tone}` : ""}"><span class="admin-home-tile-label">${escapeHtml(label)}</span><span class="admin-home-tile-value">${value}</span>${sub}</div>`;
const sub = (text, tone = "") => `<span class="admin-home-tile-sub${tone ? ` exec-delta-${tone}` : ""}">${text}</span>`;
const pctText = (v) => (v === null ? "-" : `${v}%`);

function pointsDelta(delta, unit, suffix) {
  if (delta === null) return sub("ยังไม่มีข้อมูลเดือนก่อนเทียบ");
  if (delta === 0) return sub(`คงที่${suffix}`);
  return sub(`${delta > 0 ? "↑ +" : "↓ "}${delta}${unit}${suffix}`, delta > 0 ? "good" : "bad");
}

function kpiHtml(k) {
  const m = k.match;
  return `<div class="admin-home-tiles">
    ${tile("นักกีฬาทั้งหมด", String(k.players), sub(`${k.groupCount} รุ่นอายุ`))}
    ${tile("เข้าซ้อมเดือนนี้", pctText(k.attendance.pct), pointsDelta(k.attendance.delta, " จุด", " จากเดือนก่อน"))}
    ${tile("คะแนนประเมินเฉลี่ย", k.score.value === null ? "-" : `${k.score.value}<small> / 4</small>`, pointsDelta(k.score.delta, "", " จากเดือนก่อน"))}
    ${tile("แผนฝึกส่งตรงเวลา", pctText(k.plan.onTimePct), sub(k.plan.late > 0 ? `ส่งสาย ${k.plan.late} ครั้ง` : k.plan.total > 0 ? "ไม่มีส่งสาย" : "ยังไม่มีแผนเดือนนี้", k.plan.late > 0 ? "bad" : ""))}
    ${tile("ผลแข่งเดือนนี้", m.total ? `${m.win}-${m.draw}-${m.lose}` : "-", sub(m.total ? "ชนะ-เสมอ-แพ้" : "ยังไม่มีการแข่งขัน"))}
    ${tile("บาดเจ็บ/ป่วยตอนนี้", String(k.injured.active), sub(k.injured.severe > 0 ? `รุนแรง ${k.injured.severe} ราย` : "ไม่มีรายรุนแรง", k.injured.severe > 0 ? "bad" : ""), k.injured.active > 0 ? "warn" : "ok")}
  </div>`;
}

const WIDTH = 640;
const HEIGHT = 110;
const PAD = 6; // กันจุดปลายเส้นโดนตัดขอบ
function trendHtml(trend) {
  const pts = (key) => trend.filter((p) => p[key] !== null);
  if (pts("pct").length < 2) return '<p class="admin-chart-sub">ยังไม่มีข้อมูลเพียงพอสำหรับแสดงแนวโน้ม</p>';
  const x = (p) => (PAD + (p.day / (TREND_DAYS - 1)) * (WIDTH - PAD * 2)).toFixed(1);
  const y = (v) => (HEIGHT - 10 - (Math.max(0, Math.min(v, 100)) / 100) * (HEIGHT - 20)).toFixed(1);
  const line = (key) => pts(key).map((p, i) => `${i === 0 ? "M" : "L"}${x(p)},${y(p[key])}`).join(" ");
  const last = (key) => pts(key).at(-1);
  const dot = (key, cls) => (last(key) ? `<circle cx="${x(last(key))}" cy="${y(last(key)[key])}" r="4" class="${cls}"/>` : "");
  const grid = [0, 50, 100].map((v) => `<line x1="0" y1="${y(v)}" x2="${WIDTH}" y2="${y(v)}" class="exec-trend-grid"/>`).join("");
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="แนวโน้มเข้าซ้อมและคะแนนเฉลี่ย 30 วัน">
    ${grid}<path d="${line("pct")}" class="exec-trend-att"/>${pts("scorePct").length > 1 ? `<path d="${line("scorePct")}" class="exec-trend-score"/>` : ""}${dot("pct", "exec-trend-dot-att")}${dot("scorePct", "exec-trend-dot-score")}
  </svg>`;
}

const barCell = (pct) =>
  pct === null ? "-" : `<div class="admin-bar"><span class="admin-bar-track"><span class="admin-bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></span></span><span class="admin-bar-value">${pct}%</span></div>`;

function groupsHtml(groups) {
  if (groups.length === 0) return '<p class="text-sm text-slate-400">ยังไม่มีนักกีฬาในทีมนี้</p>';
  const rows = groups
    .map((g) => {
      const m = g.match;
      return `<tr>
        <td class="emphasis">${escapeHtml(g.ageGroup)}</td>
        <td>${g.players}</td>
        <td class="exec-bar-cell">${barCell(g.pct)}</td>
        <td>${g.score === null ? "-" : g.score}</td>
        <td>${pctText(g.plan.onTimePct)}</td>
        <td>${m.win + m.draw + m.lose ? `${m.win}-${m.draw}-${m.lose}` : "-"}</td>
        <td>${g.injured}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="pro-table">
    <thead><tr><th>รุ่น</th><th>นักกีฬา</th><th>เข้าซ้อม</th><th>คะแนน</th><th>แผนตรงเวลา</th><th>ผลแข่ง</th><th>บาดเจ็บ</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

const WATCH_BADGE = { bad: "badge-danger", warn: "badge-warning" };
function watchHtml(watch) {
  if (watch.length === 0) return '<p class="text-sm text-slate-500">เดือนนี้ไม่มีเรื่องที่ต้องจับตา</p>';
  return watch.map((w) => `<div class="exec-row"><span>${escapeHtml(w.text)}</span><span class="badge ${WATCH_BADGE[w.tone]}">${escapeHtml(w.tag)}</span></div>`).join("");
}

const RESULT_BADGE = { ชนะ: "badge-success", แพ้: "badge-danger" };
function matchesHtml(matches) {
  if (matches.length === 0) return '<p class="text-sm text-slate-500">เดือนนี้ยังไม่มีการแข่งขัน</p>';
  return matches
    .map((m) => `<div class="exec-row"><span>${escapeHtml(m.ageGroup ?? "-")} vs ${escapeHtml(m.opponent ?? "-")}</span><span><span class="badge ${RESULT_BADGE[m.result] || "badge-neutral"}">${escapeHtml(m.result ?? "-")}</span> ${escapeHtml(String(m.scoreUs ?? "-"))}-${escapeHtml(String(m.scoreThem ?? "-"))}</span></div>`)
    .join("");
}

export function execDashboardHtml(model, { team = "", teamLogo = "", monthLabel = "" } = {}) {
  return `<div class="exec-dash space-y-4">
    <div class="exec-dash-head">${teamLogo}<div><h2 class="section-title">${escapeHtml(team)}</h2><p class="admin-chart-sub">ภาพรวมเดือน${escapeHtml(monthLabel)}</p></div></div>
    ${kpiHtml(model.kpis)}
    <div class="card card-pad admin-chart-card">
      <h4 class="admin-chart-title">แนวโน้ม 30 วัน</h4>
      ${trendHtml(model.trend)}
      <p class="exec-legend"><span class="exec-legend-att">เข้าซ้อม ${pctText(model.kpis.attendance.pct)}</span><span class="exec-legend-score">คะแนนเฉลี่ย ${model.kpis.score.value === null ? "-" : `${model.kpis.score.value} / 4`} (แสดงเป็น % ของเต็ม)</span></p>
    </div>
    <div class="card card-pad admin-chart-card"><h4 class="admin-chart-title">เปรียบเทียบรุ่นอายุ (เดือนนี้)</h4>${groupsHtml(model.groups)}</div>
    <div class="admin-chart-grid">
      <div class="card card-pad admin-chart-card"><h4 class="admin-chart-title">ควรจับตา</h4>${watchHtml(model.watch)}</div>
      <div class="card card-pad admin-chart-card"><h4 class="admin-chart-title">ผลแข่งล่าสุด</h4>${matchesHtml(model.recentMatches)}</div>
    </div>
  </div>`;
}
