// หน้าแสดงผล Injury/Sick → Results: สรุปการบาดเจ็บของรุ่นที่โค้ชดูแลในช่วงที่เลือก พร้อมกราฟ (ตรรกะล้วนๆ + HTML เป็นสตริง ไม่พึ่ง DOM/Firebase)
// ใช้ตัวคำนวณ/กราฟเดิมร่วมกับ Dashboard (injury-form.js, injury-period.js, injury-stats-view.js) — กราฟแท่งเป็น SVG เพื่อให้พิมพ์สีได้
import { escapeHtml, injurySeverityBadge, injuryStatusBadge } from "./ui-utils.js";
import { buildInjuryStats, contextFor, formStatusFor, injuryDaysOut } from "./injury-form.js";
import { formatDelta, monthShortLabel, monthlyCounts, periodFor, rowsInPeriod, shiftPeriodKey } from "./injury-period.js";
import { barsHtml, injuryTrendHtml } from "./injury-stats-view.js";

const HEALED = "หายแล้ว";
const SEVERITIES = [
  { label: "เล็กน้อย", color: "#94a3b8" },
  { label: "ปานกลาง", color: "#f59e0b" },
  { label: "รุนแรง", color: "#ef4444" }
];
const STATUSES = [
  { label: "บาดเจ็บ", color: "#ef4444" },
  { label: "กำลังพักฟื้น", color: "#f59e0b" },
  { label: "หายแล้ว", color: "#10b981" }
];

// รายงานในขอบเขตของโค้ช: เลือกรุ่นเฉพาะ = รุ่นนั้น, ไม่เลือก = ทุกรุ่นที่ดูแล (ไม่ได้ระบุรุ่นที่ดูแล = ทั้งทีม)
export function scopeReports(reports, myAgeGroups, selectedAgeGroup = "") {
  if (selectedAgeGroup) return reports.filter((r) => r.ageGroup === selectedAgeGroup);
  return myAgeGroups.length > 0 ? reports.filter((r) => myAgeGroups.includes(r.ageGroup)) : reports;
}

function countBy(items, keyOf) {
  const map = new Map();
  for (const it of items) {
    const key = keyOf(it);
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
}

const countOf = (list, label) => list.filter((r) => r.label === label)[0]?.count ?? 0;

// reports = injuryReports ของทีม (ยังไม่กรอง) · mode/key = ช่วงที่เลือก (ดู injury-period.js)
export function buildResults({ reports, myAgeGroups = [], ageGroup = "", mode, key, todayStr }) {
  const scoped = scopeReports(reports, myAgeGroups, ageGroup);
  const period = periodFor(mode, key);
  const previous = periodFor(mode, shiftPeriodKey(mode, key, -1));
  const inPeriod = rowsInPeriod(scoped, period);
  const prevRows = rowsInPeriod(scoped, previous);
  const stats = buildInjuryStats(inPeriod);

  // กำลังบาดเจ็บ/พักฟื้นอยู่ตอนนี้ (ทุกช่วงเวลา — ไม่ผูกกับช่วงที่เลือก): นานสุดก่อน
  const activeNow = scoped
    .filter((r) => r.status !== HEALED)
    .map((r) => {
      const out = injuryDaysOut(r, todayStr);
      const overdueDays = r.expectedReturn && r.expectedReturn < todayStr ? injuryDaysOut({ date: r.expectedReturn, status: "x" }, todayStr)?.days ?? 0 : 0;
      return { report: r, daysOut: out ? out.days : null, overdueDays };
    })
    .sort((a, b) => String(a.report.date).localeCompare(String(b.report.date)));

  // นักกีฬาที่บาดเจ็บหลายครั้งในช่วงนี้
  const byPlayer = new Map();
  for (const r of inPeriod) {
    const id = r.playerId || r.playerName || "?";
    const cur = byPlayer.get(id) || { name: r.playerName ?? "-", ageGroup: r.ageGroup ?? "", count: 0, recurrence: 0 };
    cur.count += 1;
    if (r.isRecurrence) cur.recurrence += 1;
    byPlayer.set(id, cur);
  }
  const frequent = [...byPlayer.values()].filter((p) => p.count >= 2).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th")).slice(0, 5);

  const ageGroups = countBy(inPeriod, (r) => r.ageGroup);
  return {
    period,
    ageGroup,
    total: inPeriod.length,
    totalDelta: formatDelta(inPeriod.length, prevRows.length),
    stats,
    activeNow,
    trend: monthlyCounts(inPeriod, period.months),
    bySeverity: SEVERITIES.map((s) => ({ ...s, count: inPeriod.filter((r) => r.severity === s.label).length })),
    byStatus: STATUSES.map((s) => ({ ...s, count: inPeriod.filter((r) => formStatusFor(r.status) === s.label).length })),
    byType: countBy(inPeriod, (r) => r.injuryType),
    byAgeGroup: ageGroups.length > 1 ? ageGroups : [],
    frequent,
    history: buildHistory(scoped, todayStr),
    todayStr
  };
}

const TONE_CLASS = { good: "text-emerald-600", bad: "text-red-600", neutral: "text-slate-400" };

const statCard = (label, value, sub, subClass = "text-slate-400") =>
  `<div class="profile-stat"><p class="profile-stat-label">${escapeHtml(label)}</p><p class="profile-stat-value">${value}</p><p class="text-xs ${subClass}">${sub}</p></div>`;

// แถบสัดส่วนซ้อน (ความรุนแรง/สถานะ) + คำอธิบายสี — items = [{label,color,count}]
function stackHtml(items) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return '<p class="text-xs text-slate-400">ยังไม่มีรายงานในช่วงนี้</p>';
  let x = 0;
  const rects = items
    .filter((i) => i.count > 0)
    .map((i) => {
      const w = (i.count / total) * 100;
      const r = `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="12" fill="${i.color}"><title>${escapeHtml(i.label)} ${i.count}</title></rect>`;
      x += w;
      return r;
    })
    .join("");
  const legend = items
    .map((i) => `<span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:${i.color}"></span>${escapeHtml(i.label)} ${i.count}</span>`)
    .join("");
  return `<svg viewBox="0 0 100 12" preserveAspectRatio="none" style="width:100%;height:14px;display:block" role="img" aria-label="${items.map((i) => `${escapeHtml(i.label)} ${i.count}`).join(" ")}"><rect width="100" height="12" rx="2" fill="#f1f5f9"/>${rects}</svg>
    <p class="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 mt-1.5">${legend}</p>`;
}

const panel = (title, body) => `<div class="card card-pad"><p class="text-xs font-semibold text-slate-600 mb-2">${escapeHtml(title)}</p>${body}</div>`;

function activeTableHtml(model) {
  if (model.activeNow.length === 0) return '<p class="text-sm text-slate-500">ไม่มีนักกีฬาที่กำลังบาดเจ็บหรือพักฟื้นอยู่ตอนนี้</p>';
  const rows = model.activeNow
    .map(({ report: r, daysOut, overdueDays }) => {
      const expected = r.expectedReturn
        ? overdueDays > 0
          ? `<span class="text-red-600">เลยกำหนด ${overdueDays} วัน</span>`
          : escapeHtml(r.expectedReturn)
        : "-";
      return `<tr><td class="emphasis">${escapeHtml(r.playerName ?? "-")}<div class="text-xs text-slate-400">${escapeHtml(r.ageGroup ?? "")}</div></td><td>${escapeHtml(r.description ?? "-")}</td><td>${injuryStatusBadge(r.status)}</td><td>${daysOut === null ? "-" : `${daysOut} วัน`}</td><td>${expected}</td></tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="pro-table injury-results-table"><thead><tr><th>นักกีฬา</th><th>อาการ</th><th>สถานะ</th><th>หยุดมาแล้ว</th><th>คาดว่ากลับ</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ประวัติการบาดเจ็บแยกรุ่น ทุกช่วงเวลา: รุ่นที่ยังมีคนบาดเจ็บอยู่ขึ้นก่อน (เปิดไว้) แล้วเรียงตามรุ่นอายุ — ในรุ่นเรียงคนที่ยังบาดเจ็บก่อน แล้วตามวันล่าสุด
export function buildHistory(scoped, todayStr) {
  const groups = new Map();
  for (const r of scoped) {
    const ag = r.ageGroup || "ไม่ระบุรุ่น";
    if (!groups.has(ag)) groups.set(ag, new Map());
    const players = groups.get(ag);
    const id = r.playerId || r.playerName || "?";
    if (!players.has(id)) players.set(id, { name: r.playerName ?? "-", reports: [] });
    players.get(id).reports.push(r);
  }
  const ageNo = (g) => Number(String(g).replace(/\D/g, "")) || 999;
  return [...groups]
    .map(([ageGroup, players]) => {
      const list = [...players.values()].map((p) => {
        const reports = [...p.reports].sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const active = reports.find((r) => r.status !== HEALED) ?? null;
        return { name: p.name, count: reports.length, recurrence: reports.filter((r) => r.isRecurrence).length, latest: reports[0], status: (active ?? reports[0]).status, active: !!active, reports };
      });
      list.sort((a, b) => Number(b.active) - Number(a.active) || String(b.latest.date).localeCompare(String(a.latest.date)) || a.name.localeCompare(b.name, "th"));
      return { ageGroup, players: list, totalReports: list.reduce((s, p) => s + p.count, 0), activePlayers: list.filter((p) => p.active).length };
    })
    .sort((a, b) => Number(b.activePlayers > 0) - Number(a.activePlayers > 0) || ageNo(a.ageGroup) - ageNo(b.ageGroup));
}

function playerReportsTableHtml(player, todayStr) {
  const rows = player.reports
    .map((r) => {
      const place = r.bodyRegion ? (r.side && r.side !== "ไม่เกี่ยวข้อง" ? `${r.bodyRegion} (${r.side})` : r.bodyRegion) : "-";
      const out = injuryDaysOut(r, todayStr);
      const days = out ? (out.final ? `${out.days} วัน` : `${out.days}+ วัน`) : "-";
      return `<tr>
        <td class="emphasis">${escapeHtml(r.date ?? "-")}</td>
        <td>${escapeHtml(r.description ?? "-")}${r.isRecurrence ? ' <span class="badge badge-warning">ซ้ำ</span>' : ""}</td>
        <td>${escapeHtml(place)}</td>
        <td>${escapeHtml(r.injuryType ?? "-")}</td>
        <td>${escapeHtml(r.mechanism ?? "-")}</td>
        <td>${escapeHtml(contextFor(r) ?? "-")}</td>
        <td>${injurySeverityBadge(r.severity)}</td>
        <td>${injuryStatusBadge(r.status)}</td>
        <td>${days}</td>
        <td class="whitespace-nowrap"><button type="button" class="btn btn-secondary btn-sm" data-injury-edit="${escapeHtml(r.id)}">แก้ไข</button> <button type="button" class="btn btn-danger-soft btn-sm" data-injury-delete="${escapeHtml(r.id)}">ลบ</button></td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="pro-table injury-results-table"><thead><tr><th>วันที่</th><th>อาการ</th><th>ตำแหน่ง/ข้าง</th><th>ประเภท</th><th>กลไก</th><th>เกิดที่</th><th>ความรุนแรง</th><th>สถานะ</th><th>หยุด</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function historyHtml(model) {
  if (model.history.length === 0) return '<div class="card card-pad text-center text-slate-500">ยังไม่มีประวัติการบาดเจ็บ</div>';
  return model.history
    .map((g) => {
      const open = g.activePlayers > 0 ? " open" : "";
      const activeBadge = g.activePlayers > 0 ? `<span class="badge badge-warning">ยังบาดเจ็บ ${g.activePlayers} คน</span>` : "";
      const players = g.players
        .map((p) => {
          const latest = `${escapeHtml(p.latest.description ?? "-")} · ${escapeHtml(p.latest.date ?? "-")}`;
          return `<details class="injury-history-player">
            <summary class="injury-history-summary"><span class="font-medium">${escapeHtml(p.name)}</span><span class="text-slate-500">${p.count} ครั้ง${p.recurrence > 0 ? ` (ซ้ำ ${p.recurrence})` : ""}</span><span class="text-slate-500 injury-history-latest">${latest}</span>${injuryStatusBadge(p.status)}</summary>
            ${playerReportsTableHtml(p, model.todayStr)}
          </details>`;
        })
        .join("");
      return `<details class="card injury-history-group"${open}>
        <summary class="injury-history-group-summary"><span class="font-semibold">${escapeHtml(g.ageGroup)}</span><span class="text-sm text-slate-500">${g.players.length} ราย · ${g.totalReports} ครั้ง</span>${activeBadge}</summary>
        <div class="injury-history-list">${players}</div>
      </details>`;
    })
    .join("");
}
export function resultsHtml(model) {
  const s = model.stats;
  const avg = s.avgDaysOut === null ? "-" : s.avgDaysOut.toFixed(1).replace(/\.0$/, "");
  const cards = `<div class="profile-stat-grid">
    ${statCard("บาดเจ็บทั้งหมดในช่วงนี้", `${model.total}<span class="profile-stat-sub"> ราย</span>`, escapeHtml(model.totalDelta.text), TONE_CLASS[model.totalDelta.tone])}
    ${statCard("กำลังบาดเจ็บ/พักฟื้นตอนนี้", `${model.activeNow.length}<span class="profile-stat-sub"> คน</span>`, "นับทุกช่วงเวลา")}
    ${statCard("หยุดซ้อมเฉลี่ย", `${avg}<span class="profile-stat-sub"> วัน</span>`, s.avgDaysOut === null ? "ยังไม่มีรายที่หายแล้วและระบุวันกลับ" : `จาก ${s.avgDaysOutSample} รายที่หายแล้ว`)}
    ${statCard("บาดเจ็บซ้ำ", `${s.recurrence}<span class="profile-stat-sub"> ราย (${s.recurrencePercent}%)</span>`, "ตำแหน่งและข้างเดียวกับที่เคยบาดเจ็บ")}
  </div>`;
  const frequent =
    model.frequent.length === 0
      ? '<p class="text-sm text-slate-500">ไม่มีนักกีฬาที่บาดเจ็บหลายครั้งในช่วงนี้</p>'
      : `<ul class="text-sm space-y-1">${model.frequent.map((p) => `<li><span class="font-medium">${escapeHtml(p.name)}</span> <span class="text-slate-400">${escapeHtml(p.ageGroup)}</span> · ${p.count} ครั้ง${p.recurrence > 0 ? ` (ซ้ำ ${p.recurrence})` : ""}</li>`).join("")}</ul>`;
  const typeBars = barsHtml(model.byType);
  const ageBars = model.byAgeGroup.length > 0 ? panel("ตามรุ่นอายุ", barsHtml(model.byAgeGroup)) : "";
  return `
    ${cards}
    ${model.total === 0 ? '<div class="card card-pad text-center text-slate-500">ยังไม่มีรายงานบาดเจ็บในช่วงที่เลือก</div>' : injuryTrendHtml(model.trend, monthShortLabel)}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${panel("ตามตำแหน่งร่างกาย", barsHtml(s.byRegion))}
      <div class="space-y-4">
        ${panel("ความรุนแรง", stackHtml(model.bySeverity))}
        ${panel("สถานะ", stackHtml(model.byStatus))}
      </div>
      ${panel("ตามกลไกการบาดเจ็บ", barsHtml(s.byMechanism))}
      ${panel("ตามที่เกิดเหตุ", barsHtml(s.byContext))}
      ${panel("ตามประเภทอาการ", typeBars)}
      ${ageBars}
    </div>
    <div class="card card-pad space-y-2"><h3 class="section-title">กำลังบาดเจ็บ/พักฟื้นอยู่ตอนนี้</h3>${activeTableHtml(model)}</div>
    <div class="card card-pad space-y-2"><h3 class="section-title">นักกีฬาที่บาดเจ็บบ่อย</h3>${frequent}</div>
    <div class="space-y-2"><div class="flex flex-wrap items-baseline justify-between gap-2"><h3 class="section-title">ประวัติการบาดเจ็บแยกตามรุ่นอายุ</h3><span class="text-xs text-slate-400">ทุกช่วงเวลา · ไม่ผูกกับช่วงที่เลือกด้านบน</span></div>${historyHtml(model)}</div>`;
}
