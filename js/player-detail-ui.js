// หน้านักกีฬารายบุคคล: ส่วน Match Report (กราฟแท่ง 6 นัด) และ IDP / Progression ใต้ Player Profile — ตรรกะ/HTML อยู่ที่ player-progress.js
// ไฟล์นี้ผูก DOM + Firestore: ดึงเฉพาะข้อมูลของนักกีฬาคนนั้น (matchReports ของทีม กรองฝั่งหน้าเว็บ · attendance/playerEvaluations/fitnessResults ของ playerId นั้น)
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, todayBangkok } from "./ui-utils.js";
import { buildFitnessSeries } from "./fitness-profile.js";
import { coachFitnessHtml } from "./fitness-view.js";
import { barPage, dailyScoreHtml, dailyScoreSeries, idpHtml, idpSummary, mascHtml, mascRounds, matchChartHtml, matchDetailHtml, playerMatches } from "./player-progress.js";

const el = (id) => document.getElementById(id);
let requestId = 0;
let match = null; // { matches, unrated, average, page, selectedId } ของนักกีฬาที่เปิดอยู่

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// ดึงไม่สำเร็จ = ข้อความในส่วนนั้นเท่านั้น (ไม่ล้มทั้งหน้า) — คืน { error } แทนรายการ
const safely = (promise) => promise.then(docsOf).catch((err) => (console.error(err), { error: err.message }));

const section = (title, body) => `<div class="space-y-2"><h4 class="text-sm font-semibold text-slate-800">${escapeHtml(title)}</h4>${body}</div>`;
const failed = (what, r) => `<p class="text-sm text-red-600">โหลด${what}ไม่สำเร็จ: ${escapeHtml(r.error)}</p>`;

function renderMatch() {
  const box = el("player-match-report");
  if (!match) return;
  const page = barPage(match.matches, match.page);
  match.page = page.page;
  if (!match.selectedId || !page.bars.some((b) => b.id === match.selectedId)) match.selectedId = page.bars[page.bars.length - 1]?.id ?? null;
  const selected = page.bars.find((b) => b.id === match.selectedId) ?? null;
  const nav = `<div class="flex gap-2">
      <button type="button" class="btn btn-secondary btn-sm" data-bars-older ${page.hasOlder ? "" : "disabled"}>‹ ${page.hasOlder ? "6 นัดก่อนหน้า" : "ไม่มีนัดก่อนหน้า"}</button>
      <button type="button" class="btn btn-secondary btn-sm" data-bars-newer ${page.hasNewer ? "" : "disabled"}>นัดถัดไป ›</button></div>`;
  const unrated = match.unrated > 0 ? `<p class="text-xs text-slate-400">มี ${match.unrated} นัดที่นักกีฬาลงเล่นแต่ยังไม่ได้ให้คะแนน (ไม่แสดงในกราฟ)</p>` : "";
  box.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2"><h3 class="section-title">Match Report · การประเมินในเกม</h3>${page.total > 0 ? nav : ""}</div>
    ${matchChartHtml({ bars: page.bars, average: match.average, selectedId: match.selectedId })}
    ${page.total > 0 ? `<p class="text-xs text-slate-500">6 แท่ง = 6 นัดล่าสุดที่ลงเล่นและมีคะแนน · คะแนนดาวโค้ชจาก Match Day (0–4) · กดแท่งเพื่อดูรายละเอียดนัด · ทั้งหมด ${page.total} นัด</p>` : ""}
    ${matchDetailHtml(selected)}${unrated}`;
}

export async function showPlayerProgress(player, team) {
  const id = ++requestId;
  const matchBox = el("player-match-report");
  const progressBox = el("player-progress");
  match = null;
  matchBox.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด Match Report...</p>';
  progressBox.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด IDP / Progression...</p>';
  if (!team) {
    matchBox.innerHTML = progressBox.innerHTML = "";
    return;
  }
  const [reports, attendance, evaluations, rounds, results] = await Promise.all([
    safely(getDocs(query(collection(db, "matchReports"), where("team", "==", team)))),
    safely(getDocs(query(collection(db, "attendance"), where("team", "==", team), where("playerId", "==", player.id)))),
    safely(getDocs(query(collection(db, "playerEvaluations"), where("playerId", "==", player.id), where("team", "==", team)))),
    safely(getDocs(collection(db, "fitnessRounds"))),
    safely(getDocs(query(collection(db, "fitnessResults"), where("team", "==", team), where("playerId", "==", player.id))))
  ]);
  if (id !== requestId) return; // เปิดนักกีฬาคนอื่นไปแล้ว

  if (reports.error) {
    matchBox.innerHTML = `<h3 class="section-title">Match Report · การประเมินในเกม</h3>${failed(" Match Report", reports)}`;
  } else {
    match = { ...playerMatches(reports, player.id), page: 0, selectedId: null };
    renderMatch();
  }

  const today = todayBangkok();
  const daily = attendance.error ? null : dailyScoreSeries(attendance, today, 30);
  const masc = evaluations.error ? null : mascRounds(evaluations);
  const series = rounds.error || results.error ? null : buildFitnessSeries(rounds, results);
  progressBox.innerHTML = `<h3 class="section-title">IDP / Progression · พัฒนาการรายบุคคล</h3>
    ${section("คะแนนฝึกซ้อมรายวัน", daily ? dailyScoreHtml(daily) : failed("คะแนนรายวัน", attendance))}
    ${section("Footelligence Test (MASC)", masc ? mascHtml(masc) : failed("ผลประเมิน MASC", evaluations))}
    ${section("Physical Test · สมรรถภาพทางกาย", series ? coachFitnessHtml({ player, series }) : failed("ผลทดสอบสมรรถภาพ", rounds.error ? rounds : results))}
    ${section("สรุป IDP (อัตโนมัติ)", idpHtml(idpSummary({ masc: masc ?? [], daily: daily ?? dailyScoreSeries([], today, 30), fitnessSeries: series ?? [] })))}`;
}

export function initPlayerDetailProgress() {
  const box = el("player-match-report");
  box.addEventListener("click", (e) => {
    if (!match) return;
    if (e.target.closest("[data-bars-older]")) match.page += 1;
    else if (e.target.closest("[data-bars-newer]")) match.page -= 1;
    else {
      const bar = e.target.closest(".match-bar");
      if (!bar) return;
      match.selectedId = bar.dataset.matchId;
    }
    renderMatch();
  });
  box.addEventListener("keydown", (e) => {
    const bar = (e.key === "Enter" || e.key === " ") && e.target.closest?.(".match-bar");
    if (!bar || !match) return;
    e.preventDefault();
    match.selectedId = bar.dataset.matchId;
    renderMatch();
  });
}
