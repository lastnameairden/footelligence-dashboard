// หน้านักกีฬารายบุคคล (Player Data → คลิกนักกีฬา): ส่วน Match Report (กราฟแท่ง 6 นัด) และ IDP / Progression (คะแนนฝึกซ้อมรายวัน · MASC รายรอบ · สมรรถภาพ · สรุปอัตโนมัติ)
// ตรรกะล้วนๆ + HTML เป็นสตริง (ไม่พึ่ง DOM/Firebase) ทุกค่าคำนวณตอนแสดงจากข้อมูลเดิมของนักกีฬาคนนั้น ไม่เก็บลงฐานข้อมูล
import { SCORE_CATEGORIES, SCORE_CATEGORY_COLORS, computeAvgScore, escapeHtml } from "./ui-utils.js";
import { categoryRawScore, scoreToGrade } from "./masc-data.js";
import { MATCH_RATING_MAX } from "./match-day.js";
import { FITNESS_TEST_BY_CODE } from "./fitness-calc.js";
import { NO_TREND_CODES, previousValue, trendBetween } from "./fitness-profile.js";
import { addDaysToDate } from "./coach-meetings.js";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const BARS_PER_PAGE = 6;
export const RESULT_COLORS = { ชนะ: "#3f7d3a", เสมอ: "#d9902f", แพ้: "#e24b4a" };

const dayMonth = (dateStr) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ""));
  return m ? `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]}` : "-";
};
const mean = (nums) => (nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length);
const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => (n === null || n === undefined ? "-" : String(round1(n)));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// ---------- Match Report ----------
// การลงเล่นที่มีคะแนนจาก Match Day ของนักกีฬา playerId เรียงจากเก่าไปใหม่ — teamAvg = คะแนนเฉลี่ยของทุกคนที่ลงเล่นและมีคะแนนในนัดนั้น
// รายงานเก่าที่ไม่ได้บันทึกรายคน (ไม่มี players) และนัดที่ลงเล่นแต่ยังไม่ให้คะแนน ไม่ถูกนับในกราฟ (นับนัดที่ไม่มีคะแนนแยกไว้)
export function playerMatches(reports, playerId) {
  const rated = [];
  let unrated = 0;
  for (const r of reports) {
    if (!r.matchDay || !Array.isArray(r.players)) continue;
    const p = r.players.find((x) => x.id === playerId);
    if (!p || !p.played) continue;
    if (typeof p.rating !== "number") {
      unrated += 1;
      continue;
    }
    const ratings = r.players.filter((x) => x.played && typeof x.rating === "number").map((x) => x.rating);
    rated.push({
      id: r.id,
      date: r.date ?? "",
      opponent: r.opponent ?? "-",
      result: r.result ?? null,
      scoreUs: r.scoreUs ?? null,
      scoreThem: r.scoreThem ?? null,
      competition: r.competition || r.competitionType || "",
      rating: p.rating,
      teamAvg: mean(ratings),
      position: p.position ?? null,
      minutes: typeof p.minutes === "number" ? p.minutes : null,
      goals: num(p.goals),
      assists: num(p.assists),
      yellow: num(p.yellowCards),
      red: num(p.redCards),
      note: p.note ?? null
    });
  }
  rated.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { matches: rated, unrated, average: mean(rated.map((m) => m.rating)) };
}

// หน้าที่ page ของแท่ง (0 = ล่าสุด) — bars เรียงจากเก่าไปใหม่ซ้ายไปขวา
export function barPage(matches, page = 0, size = BARS_PER_PAGE) {
  const total = matches.length;
  const maxPage = Math.max(Math.ceil(total / size) - 1, 0);
  const p = Math.min(Math.max(page, 0), maxPage);
  const end = total - p * size;
  const start = Math.max(end - size, 0);
  return { bars: matches.slice(start, end), page: p, hasOlder: start > 0, hasNewer: p > 0, total };
}

const SLOT_W = 100;
const BAR_W = 64;
const PLOT_LEFT = 32;
const PLOT_TOP = 26;
const UNIT_H = 40;
const PLOT_BOTTOM = PLOT_TOP + MATCH_RATING_MAX * UNIT_H;

const trunc = (s, n) => (Array.from(String(s)).length > n ? `${Array.from(String(s)).slice(0, n - 1).join("")}…` : String(s));

// กราฟแท่งคะแนนโค้ชต่อนัด (SVG — ไม่ใช้พื้นหลัง div เพื่อให้พิมพ์สีได้) สีแท่งตามผลทีม เส้นเทา = ค่าเฉลี่ยทีมในนัด เส้นดำ = ค่าเฉลี่ยของนักกีฬา
export function matchChartHtml({ bars, average, selectedId = null }) {
  if (bars.length === 0) return '<p class="text-sm text-slate-400">ยังไม่มีคะแนนจาก Match Day ของนักกีฬาคนนี้ — จะแสดงเมื่อโค้ชให้ดาวนักกีฬาในหน้าเช็คชื่อ (Match Day)</p>';
  const y = (v) => PLOT_BOTTOM - v * UNIT_H;
  const width = PLOT_LEFT + SLOT_W * BARS_PER_PAGE;
  const grid = Array.from({ length: MATCH_RATING_MAX + 1 }, (_, v) => `<line x1="${PLOT_LEFT - 6}" y1="${y(v)}" x2="${width}" y2="${y(v)}" stroke="#e2e8f0" stroke-width="0.7"></line><text x="2" y="${y(v) + 4}" font-size="11" fill="#64748b">${v}</text>`).join("");
  const cx = (i) => PLOT_LEFT + i * SLOT_W + SLOT_W / 2;
  const rects = bars
    .map((b, i) => {
      const x = cx(i) - BAR_W / 2;
      const color = RESULT_COLORS[b.result] || "#94a3b8";
      const sel = b.id === selectedId ? ' stroke="#111" stroke-width="2"' : "";
      const score = b.scoreUs !== null && b.scoreThem !== null ? `${b.scoreUs}-${b.scoreThem}` : "";
      const label = `${dayMonth(b.date)} พบ ${b.opponent} ${score} คะแนน ${fmt1(b.rating)}`;
      return `<g class="match-bar" data-match-id="${escapeHtml(b.id)}" tabindex="0" role="button" aria-label="${escapeHtml(label)}" style="cursor:pointer"><title>${escapeHtml(label)}</title>
        <rect x="${x}" y="${y(b.rating)}" width="${BAR_W}" height="${(b.rating * UNIT_H).toFixed(1)}" fill="${color}"${sel}></rect>
        <text x="${cx(i)}" y="${y(b.rating) - 5}" font-size="12" font-weight="600" text-anchor="middle" fill="#111">${fmt1(b.rating)}</text>
        <text x="${cx(i)}" y="${PLOT_BOTTOM + 15}" font-size="10.5" text-anchor="middle" fill="#475569">${escapeHtml(dayMonth(b.date))}</text>
        <text x="${cx(i)}" y="${PLOT_BOTTOM + 28}" font-size="10" text-anchor="middle" fill="#64748b">${escapeHtml(trunc(`พบ ${b.opponent}`, 14))}</text>
        <text x="${cx(i)}" y="${PLOT_BOTTOM + 41}" font-size="10" text-anchor="middle" fill="#64748b">${escapeHtml(score)}</text></g>`;
    })
    .join("");
  const teamPts = bars.map((b, i) => (b.teamAvg === null ? null : [cx(i), y(b.teamAvg)])).filter(Boolean);
  const teamLine = teamPts.length > 1 ? `<polyline points="${teamPts.map(([px, py]) => `${px},${py.toFixed(1)}`).join(" ")}" fill="none" stroke="#9aa0a6" stroke-width="1.6"></polyline>` : "";
  const teamDots = teamPts.map(([px, py]) => `<circle cx="${px}" cy="${py.toFixed(1)}" r="3" fill="#9aa0a6"></circle>`).join("");
  const avgLine = average === null ? "" : `<line x1="${PLOT_LEFT}" y1="${y(average).toFixed(1)}" x2="${width}" y2="${y(average).toFixed(1)}" stroke="#111" stroke-width="2"></line>`;
  const legend = `<p class="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mb-1">
    ${Object.entries(RESULT_COLORS).map(([k, c]) => `<span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:${c}"></span>${k}</span>`).join("")}
    <span>── ค่าเฉลี่ยทีมในนัดนั้น</span><span><b>━</b> ค่าเฉลี่ยของนักกีฬา${average === null ? "" : ` (${fmt1(average)})`}</span></p>`;
  return `${legend}<svg viewBox="0 0 ${width} ${PLOT_BOTTOM + 48}" style="width:100%;max-width:${width}px" role="img" aria-label="กราฟคะแนน Match Day ${bars.length} นัดล่าสุด">${grid}${rects}${teamLine}${teamDots}${avgLine}</svg>`;
}

// รายละเอียดนัดที่เลือก (กดแท่ง)
export function matchDetailHtml(b) {
  if (!b) return "";
  const resultBadge = b.result ? `<span class="badge ${b.result === "ชนะ" ? "badge-success" : b.result === "แพ้" ? "badge-danger" : "badge-warning"}">${escapeHtml(b.result)}</span>` : "";
  const score = b.scoreUs !== null && b.scoreThem !== null ? `${b.scoreUs} - ${b.scoreThem}` : "-";
  const rows = [
    ["ตำแหน่งที่เล่น", escapeHtml(b.position ?? "-")],
    ["นาทีที่ลงเล่น", b.minutes === null ? "-" : `${b.minutes} นาที`],
    ["ประตู / แอสซิสต์", `${b.goals} / ${b.assists}`],
    ["ใบเหลือง / ใบแดง", `${b.yellow} / ${b.red}`],
    ["คะแนนโค้ช", `${fmt1(b.rating)} / ${MATCH_RATING_MAX}`],
    ["ค่าเฉลี่ยทีมในนัด", b.teamAvg === null ? "-" : `${fmt1(b.teamAvg)} / ${MATCH_RATING_MAX}`]
  ];
  return `<div class="rounded-lg bg-slate-50 px-4 py-3 text-sm space-y-2">
    <p class="font-semibold text-slate-800">${escapeHtml(dayMonth(b.date))} · พบ ${escapeHtml(b.opponent)} ${resultBadge} <span class="font-normal text-slate-500">${escapeHtml(score)}${b.competition ? ` · ${escapeHtml(b.competition)}` : ""}</span></p>
    <dl class="profile-kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${b.note ? `<p class="text-slate-600" style="white-space:pre-line">หมายเหตุ: ${escapeHtml(b.note)}</p>` : ""}
  </div>`;
}

// ---------- คะแนนฝึกซ้อมรายวัน ----------
export const TREND_STEP = 0.3; // เปลี่ยนเกินนี้ (ในสเกล 1-4) ถึงนับว่าดีขึ้น/ลดลง

// records = attendance ของนักกีฬาคนนี้ { date, status, scores } — ช่วงปัจจุบัน = days วันล่าสุดนับถึง todayStr เทียบกับ days วันก่อนหน้า
// ถ้า days วันล่าสุดไม่มีคะแนนเลย (เช่น พักฤดูกาล/ช่วงหยุด) จะเลื่อนหน้าต่างไปสิ้นสุดที่วันล่าสุดที่นักกีฬามีคะแนน
// แล้วใส่ shifted: true ให้หน้าจอบอกชัดว่าเป็นช่วงที่เลื่อนมา — ไม่งั้นนักกีฬาที่มีคะแนนแต่เก่ากว่า 30 วันจะดูเหมือนไม่มีข้อมูล
export function dailyScoreSeries(records, todayStr, days = 30) {
  const base = dailyWindow(records, todayStr, days);
  if (base.points.length > 0) return { ...base, shifted: false };
  const latest = records
    .filter((r) => r.date <= todayStr && computeAvgScore(r.scores) !== null)
    .map((r) => r.date)
    .sort()
    .pop();
  if (!latest) return { ...base, shifted: false };
  return { ...dailyWindow(records, latest, days), shifted: true };
}

function dailyWindow(records, todayStr, days) {
  const curStart = addDaysToDate(todayStr, -(days - 1));
  const prevStart = addDaysToDate(curStart, -days);
  const cur = records.filter((r) => r.date >= curStart && r.date <= todayStr);
  const prev = records.filter((r) => r.date >= prevStart && r.date < curStart);
  const byDate = new Map();
  for (const r of cur) {
    const avg = computeAvgScore(r.scores);
    if (avg === null) continue;
    byDate.set(r.date, [...(byDate.get(r.date) || []), avg]);
  }
  const points = [...byDate].map(([date, v]) => ({ date, avg: mean(v) })).sort((a, b) => a.date.localeCompare(b.date));
  const catMean = (list, key) => mean(list.map((r) => r.scores?.[key]).filter((v) => typeof v === "number"));
  const categories = SCORE_CATEGORIES.map((c) => {
    const current = catMean(cur, c.key);
    const previous = catMean(prev, c.key);
    return { key: c.key, label: c.short, color: SCORE_CATEGORY_COLORS[c.key], current, previous, delta: current !== null && previous !== null ? current - previous : null };
  });
  const counts = { A: 0, P: 0, I: 0, R: 0 };
  for (const r of cur) if (counts[r.status] !== undefined) counts[r.status] += 1;
  return { days, curStart, todayStr, points, categories, counts, overall: mean(points.map((p) => p.avg)), previousOverall: mean(prev.map((r) => computeAvgScore(r.scores)).filter((v) => v !== null)) };
}

const arrow = (delta) => (delta === null ? '<span class="text-slate-300">–</span>' : delta >= TREND_STEP ? `<span class="text-emerald-600">↑ +${round1(delta)}</span>` : delta <= -TREND_STEP ? `<span class="text-sky-600">↓ ${round1(delta)}</span>` : '<span class="text-slate-400">→ คงที่</span>');

export function dailyScoreHtml(s) {
  const total = s.counts.A + s.counts.P + s.counts.I + s.counts.R;
  const windowLabel = s.shifted ? `${s.days} วันถึง ${dayMonth(s.todayStr)}` : `${s.days} วันล่าสุด`;
  const counts = `<p class="text-xs text-slate-500">${windowLabel}: มาซ้อม <b>${s.counts.A}</b> · ลา <b>${s.counts.P}</b> · บาดเจ็บ <b>${s.counts.I}</b> · พักฟื้น <b>${s.counts.R}</b> (รวม ${total} วันที่เช็คชื่อ)</p>`;
  if (s.points.length === 0) return `<p class="text-sm text-slate-400">ยังไม่มีคะแนนฝึกซ้อมรายวันใน ${s.days} วันล่าสุด</p>${counts}`;
  const W = 640;
  const H = 150;
  const left = 26;
  const span = s.days - 1 || 1;
  const x = (date) => left + ((new Date(`${date}T00:00:00Z`) - new Date(`${s.curStart}T00:00:00Z`)) / 86400000 / span) * (W - left - 10);
  const y = (v) => 16 + (4 - v) * ((H - 40) / 3);
  const grid = [1, 2, 3, 4].map((v) => `<line x1="${left - 4}" y1="${y(v).toFixed(1)}" x2="${W}" y2="${y(v).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.7"></line><text x="4" y="${(y(v) + 4).toFixed(1)}" font-size="11" fill="#64748b">${v}</text>`).join("");
  const pts = s.points.map((p) => `${x(p.date).toFixed(1)},${y(p.avg).toFixed(1)}`).join(" ");
  const dots = s.points.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.avg).toFixed(1)}" r="3.2" fill="#0f766e"><title>${escapeHtml(dayMonth(p.date))}: ${fmt1(p.avg)}</title></circle>`).join("");
  const ends = `<text x="${left}" y="${H - 8}" font-size="10" fill="#64748b">${escapeHtml(dayMonth(s.curStart))}</text><text x="${W - 10}" y="${H - 8}" font-size="10" text-anchor="end" fill="#64748b">${escapeHtml(dayMonth(s.todayStr))}</text>`;
  const chart = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px" role="img" aria-label="คะแนนฝึกซ้อมรายวัน ${s.days} วันล่าสุด">${grid}<polyline points="${pts}" fill="none" stroke="#0f766e" stroke-width="2"></polyline>${dots}${ends}</svg>`;
  const rows = s.categories
    .map((c) => `<div class="flex items-center gap-3 text-sm mb-1.5"><span class="w-44 shrink-0 text-slate-700">${escapeHtml(c.label)}</span>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" class="flex-1" style="height:10px" role="img" aria-label="${escapeHtml(c.label)} ${fmt1(c.current)}"><rect width="100" height="8" rx="2" fill="#f1f5f9"></rect><rect width="${c.current === null ? 0 : ((c.current / 4) * 100).toFixed(1)}" height="8" rx="2" fill="${c.color}"></rect></svg>
      <span class="w-9 text-right font-medium">${fmt1(c.current)}</span><span class="w-20 text-right text-xs">${arrow(c.delta)}</span></div>`)
    .join("");
  const overall = `<p class="text-sm">คะแนนเฉลี่ย <b>${fmt1(s.overall)}</b> / 4 ${s.previousOverall !== null && s.overall !== null ? `<span class="text-xs">${arrow(s.overall - s.previousOverall)} เทียบ ${s.days} วันก่อนหน้า</span>` : ""}</p>`;
  const shifted = s.shifted ? `<p class="text-xs" style="color:#b45309">ไม่มีคะแนนใน ${s.days} วันล่าสุด — แสดงช่วง ${s.days} วันที่สิ้นสุดวันที่ ${escapeHtml(dayMonth(s.todayStr))} ซึ่งเป็นวันล่าสุดที่มีคะแนน</p>` : "";
  return `${overall}${shifted}${chart}<div class="mt-2">${rows}</div>${counts}`;
}

// ---------- MASC รายรอบ ----------
export const MASC_CATEGORIES = [
  { key: "M", label: "Motricity", color: "#2563eb" },
  { key: "A", label: "Availability", color: "#16a34a" },
  { key: "S", label: "Smart", color: "#f59e0b" },
  { key: "C", label: "Commitment", color: "#db2777" }
];

const evalTime = (e) => (e.updatedAt && typeof e.updatedAt.toDate === "function" ? e.updatedAt.toDate().getTime() : 0);

// การประเมิน MASC ของนักกีฬาคนนี้เรียงจากเก่าไปใหม่ (รอบเดียวกันซ้ำ = ใช้อันล่าสุด) เฉพาะที่มีเกรดอย่างน้อยหมวดหนึ่ง
export function mascRounds(evaluations) {
  const latestByLabel = new Map();
  for (const e of [...evaluations].sort((a, b) => evalTime(a) - evalTime(b))) latestByLabel.set(e.assessmentPeriod || e.roundId || e.id || "-", e);
  const list = [...latestByLabel].map(([label, e]) => ({
    label: String(label),
    time: evalTime(e),
    grades: Object.fromEntries(MASC_CATEGORIES.map((c) => [c.key, scoreToGrade(categoryRawScore(e.scores?.[c.key]))])),
    talent: e.talent || "",
    limitations: e.limitations || "",
    observations: e.observations || ""
  }));
  list.sort((a, b) => a.time - b.time);
  return list.filter((r) => Object.values(r.grades).some((g) => g !== null));
}

export function mascHtml(rounds) {
  if (rounds.length === 0) return '<p class="text-sm text-slate-400">ยังไม่มีผลการประเมิน Footelligence Test (MASC) ของนักกีฬาคนนี้</p>';
  const shown = rounds.slice(-5);
  const W = 640;
  const H = 190;
  const plotTop = 16;
  const unit = (H - 50) / 9;
  const groupW = (W - 34) / shown.length;
  const barW = Math.min(26, (groupW - 18) / 4);
  const grid = [1, 3, 7, 9].map((g) => `<line x1="26" y1="${(H - 30 - g * unit).toFixed(1)}" x2="${W}" y2="${(H - 30 - g * unit).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.7"></line><text x="4" y="${(H - 26 - g * unit).toFixed(1)}" font-size="11" fill="#64748b">${g}</text>`).join("");
  const groups = shown
    .map((r, gi) => {
      const gx = 30 + gi * groupW + (groupW - barW * 4) / 2;
      const bars = MASC_CATEGORIES.map((c, i) => {
        const g = r.grades[c.key];
        if (g === null) return "";
        const h = g * unit;
        return `<rect x="${(gx + i * barW).toFixed(1)}" y="${(H - 30 - h).toFixed(1)}" width="${barW - 3}" height="${h.toFixed(1)}" fill="${c.color}"><title>${c.label} ${g}</title></rect><text x="${(gx + i * barW + (barW - 3) / 2).toFixed(1)}" y="${(H - 33 - h).toFixed(1)}" font-size="10" text-anchor="middle" fill="#111">${g}</text>`;
      }).join("");
      return `${bars}<text x="${(gx + barW * 2 - 1.5).toFixed(1)}" y="${H - 12}" font-size="10.5" text-anchor="middle" fill="#475569">${escapeHtml(r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label)}</text>`;
    })
    .join("");
  const legend = `<p class="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mb-1">${MASC_CATEGORIES.map((c) => `<span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:${c.color}"></span>${c.key} · ${c.label}</span>`).join("")}</p>`;
  const last = rounds[rounds.length - 1];
  const prev = rounds.length > 1 ? rounds[rounds.length - 2] : null;
  const changes = MASC_CATEGORIES.map((c) => {
    const g = last.grades[c.key];
    const p = prev ? prev.grades[c.key] : null;
    const tag = g === null ? "–" : p === null || prev === null ? "" : g > p ? '<span class="text-emerald-600">↑</span>' : g < p ? '<span class="text-sky-600">↓</span>' : '<span class="text-slate-400">→</span>';
    return `<span class="badge badge-neutral">${c.key} ${g ?? "–"} ${tag}</span>`;
  }).join(" ");
  return `${legend}<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px" role="img" aria-label="เกรด MASC รายรอบ">${grid}${groups}</svg>
    <p class="text-sm mt-1">รอบล่าสุด <b>${escapeHtml(last.label)}</b>: ${changes}${prev ? ` <span class="text-xs text-slate-400">เทียบ ${escapeHtml(prev.label)}</span>` : ""}</p>
    <p class="text-xs text-slate-400 mt-1">เกรด 1 / 3 / 7 / 9 จากการประเมินของโค้ช (9 = สูงสุด)</p>`;
}

// ---------- IDP (สรุปอัตโนมัติ) ----------
// จุดเด่น/ควรพัฒนาสร้างจากข้อมูลที่มีเท่านั้น (MASC ล่าสุด · คะแนนรายวัน · ผลทดสอบสมรรถภาพ) ไม่มีช่องกรอกเพิ่ม
export function idpSummary({ masc, daily, fitnessSeries }) {
  const strengths = [];
  const improve = [];

  const last = masc.length > 0 ? masc[masc.length - 1] : null;
  if (last) {
    const graded = MASC_CATEGORIES.filter((c) => last.grades[c.key] !== null);
    const top = Math.max(...graded.map((c) => last.grades[c.key]));
    const low = Math.min(...graded.map((c) => last.grades[c.key]));
    if (graded.length > 0 && top !== low) {
      const names = (g) => graded.filter((c) => last.grades[c.key] === g).map((c) => c.label).join(", ");
      strengths.push(`MASC (${last.label}): ${names(top)} เกรดสูงสุด (${top})`);
      improve.push(`MASC (${last.label}): ${names(low)} เกรดต่ำสุด (${low})`);
    }
  }

  if (daily && daily.points.length >= 5) {
    const scored = daily.categories.filter((c) => c.current !== null);
    if (scored.length > 1) {
      const sorted = [...scored].sort((a, b) => b.current - a.current);
      if (sorted[0].current - sorted[sorted.length - 1].current >= 0.2) {
        strengths.push(`คะแนนรายวัน: ${sorted[0].label.replace(/^\d\.\s*/, "")} สูงสุด (${fmt1(sorted[0].current)}/4)`);
        improve.push(`คะแนนรายวัน: ${sorted[sorted.length - 1].label.replace(/^\d\.\s*/, "")} ต่ำสุด (${fmt1(sorted[sorted.length - 1].current)}/4)`);
      }
    }
    for (const c of daily.categories) {
      if (c.delta === null) continue;
      const name = c.label.replace(/^\d\.\s*/, "");
      if (c.delta >= TREND_STEP) strengths.push(`คะแนนรายวัน: ${name} ดีขึ้น (+${round1(c.delta)} เทียบ ${daily.days} วันก่อนหน้า)`);
      else if (c.delta <= -TREND_STEP) improve.push(`คะแนนรายวัน: ${name} ลดลง (${round1(c.delta)} เทียบ ${daily.days} วันก่อนหน้า)`);
    }
  }

  if (fitnessSeries && fitnessSeries.length > 0) {
    const lastRound = fitnessSeries[fitnessSeries.length - 1];
    const better = [];
    const lower = [];
    for (const code of Object.keys(FITNESS_TEST_BY_CODE)) {
      if (NO_TREND_CODES.includes(code) || lastRound.values[code] == null) continue;
      const before = previousValue(fitnessSeries, code, fitnessSeries.length - 1);
      if (!before) continue;
      const t = trendBetween(code, lastRound.values[code], before.value);
      if (t === "better") better.push(FITNESS_TEST_BY_CODE[code].label);
      else if (t === "lower") lower.push(FITNESS_TEST_BY_CODE[code].label);
    }
    if (better.length > 0) strengths.push(`ผลทดสอบสมรรถภาพ (${lastRound.label}) ดีขึ้น: ${better.join(", ")}`);
    if (lower.length > 0) improve.push(`ผลทดสอบสมรรถภาพ (${lastRound.label}) ลดลงเล็กน้อย: ${lower.join(", ")}`);
  }

  return { strengths, improve, notes: last ? { label: last.label, talent: last.talent, limitations: last.limitations, observations: last.observations } : null };
}

export function idpHtml(s) {
  const list = (items, empty) => (items.length === 0 ? `<p class="text-sm text-slate-400">${empty}</p>` : `<ul class="list-disc pl-5 text-sm space-y-1">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`);
  const note = (label, text) => (text ? `<p class="text-sm"><span class="font-semibold">${label}:</span> <span style="white-space:pre-line">${escapeHtml(text)}</span></p>` : "");
  const coach = s.notes && (s.notes.talent || s.notes.limitations || s.notes.observations)
    ? `<div class="rounded-lg bg-slate-50 px-4 py-3 space-y-1"><p class="text-xs font-semibold text-slate-600">บันทึกของโค้ชจากการประเมิน MASC (${escapeHtml(s.notes.label)})</p>${note("จุดเด่น", s.notes.talent)}${note("จุดที่ต้องพัฒนา", s.notes.limitations)}${note("ข้อสังเกต", s.notes.observations)}</div>`
    : "";
  return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div><p class="text-sm font-semibold text-emerald-700 mb-1">จุดเด่น</p>${list(s.strengths, "ยังมีข้อมูลไม่พอสำหรับสรุป")}</div>
      <div><p class="text-sm font-semibold text-amber-700 mb-1">ควรพัฒนา</p>${list(s.improve, "ยังมีข้อมูลไม่พอสำหรับสรุป")}</div>
    </div>${coach}
    <p class="text-xs text-slate-400">สรุปอัตโนมัติจาก MASC ล่าสุด คะแนนฝึกซ้อมรายวัน และผลทดสอบสมรรถภาพ — เป็นข้อมูลประกอบการวางแผนพัฒนารายบุคคลของโค้ช ไม่ใช่คำตัดสิน</p>`;
}
