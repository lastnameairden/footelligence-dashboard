// HTML ของเอกสารในเมนู Match Data (สร้างเป็นสตริง เทสต์ใน Node ได้): ตารางประวัติการแข่งขัน, รายงานผล Match Day (พิมพ์/PDF), Match Recording Form (พิมพ์)
import { escapeHtml, matchResultBadge, safeHttpUrl, teamLogoImg } from "./ui-utils.js";
import { MATCH_RATING_MAX, ALL_POSITIONS } from "./match-day.js";
import { formatLabel } from "./match-history.js";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// "19 ต.ค. 2026" (ค.ศ. เหมือนส่วนอื่นของระบบ)
export function dateLabel(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ""));
  return m ? `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${m[1]}` : "-";
}

// ดาว 4 ดวง (ครึ่งดวงได้) เป็นตัวอักษร: 3.5 → "★★★½" ไม่ใช้รูปเพื่อให้พิมพ์ขาวดำได้
export function starsText(rating) {
  if (typeof rating !== "number") return "";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(MATCH_RATING_MAX - full - (half ? 1 : 0));
}

// ---------- ประวัติการแข่งขัน ----------
export function historyHtml(groups) {
  if (groups.length === 0) return '<div class="card card-pad text-center text-slate-500">ยังไม่มีผลการแข่งขันในฤดูกาลที่เลือก</div>';
  const head = "<tr><th>วันที่ · เวลา</th><th>คู่แข่ง</th><th>รุ่น</th><th>ประเภท</th><th>รายการ</th><th>ชื่อรายการ</th><th>สถานที่</th><th>ผล</th><th>สกอร์</th></tr>";
  const body = groups
    .map((g) => {
      const summary = `${g.matches.length} นัด · ชนะ ${g.wins} เสมอ ${g.draws} แพ้ ${g.losses}`;
      const rows = g.matches
        .map(
          (m) => `<tr class="match-history-row" data-match-id="${escapeHtml(m.id)}" tabindex="0">
            <td>${escapeHtml(dateLabel(m.date))}${m.matchTime ? ` · ${escapeHtml(m.matchTime)}` : ""}</td>
            <td class="emphasis">${escapeHtml(m.opponent ?? "-")}</td>
            <td>${escapeHtml(m.ageGroup ?? "-")}</td>
            <td>${escapeHtml(formatLabel(m))}</td>
            <td>${escapeHtml(m.competitionType ?? "-")}</td>
            <td>${escapeHtml(m.competition ?? "-")}</td>
            <td>${escapeHtml(m.venue ?? "-")}</td>
            <td>${matchResultBadge(m.result)}</td>
            <td>${m.scoreUs ?? "-"} – ${m.scoreThem ?? "-"}</td>
          </tr>`
        )
        .join("");
      return `<tr class="match-divider"><td colspan="9">${escapeHtml(g.ageGroup)} · ${summary}</td></tr>${rows}`;
    })
    .join("");
  return `<div class="card table-wrap"><table class="pro-table match-history-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

// ---------- รายงานผล Match Day ----------
const cardMark = (n, cls) => (n > 0 ? `<span class="sheet-card ${cls}"></span>${n > 1 ? `<span class="sheet-card-n">×${n}</span>` : ""}` : "");

export function reportSheetHtml(model, team) {
  const info = [
    ["วันที่", `${dateLabel(model.date)}${model.time ? ` · ${escapeHtml(model.time)} น.` : ""}`],
    ["สถานที่", escapeHtml(model.venue ?? "-")],
    ["รายการ", escapeHtml([model.competitionType, model.competition].filter(Boolean).join(" · ") || "-")],
    ["ประเภท", `${escapeHtml(model.format)}${model.lengthMinutes ? ` · ${model.lengthMinutes} นาที` : ""}`],
    ["แผนการเล่น", escapeHtml(model.formation ?? "-")]
  ]
    .map(([k, v]) => `<div><span class="sheet-k">${k}</span> <span class="sheet-v">${v}</span></div>`)
    .join("");
  const resultBadge = model.result ? `<span class="sheet-result sheet-result-${model.result === "ชนะ" ? "win" : model.result === "แพ้" ? "loss" : "draw"}">${escapeHtml(model.result)}</span>` : "";
  let table;
  if (model.detail) {
    const body = model.rows
      .map((r) => {
        if (!r.played) {
          return `<tr class="sheet-out"><td>${r.number ?? ""}</td><td class="l">${escapeHtml(r.name)}${r.guest ? ` <span class="sheet-guest">${escapeHtml(r.ageGroup)}</span>` : ""}</td><td colspan="9" class="l">${escapeHtml(r.statusLabel)} — ไม่ได้ลงสนาม</td></tr>`;
        }
        return `<tr>
          <td>${r.number ?? ""}</td>
          <td class="l">${escapeHtml(r.name)}${r.guest ? ` <span class="sheet-guest">${escapeHtml(r.ageGroup)}</span>` : ""}<div class="sheet-sub">${escapeHtml(r.subNote)}</div></td>
          <td>${r.rating !== null ? `${r.rating} ${escapeHtml(starsText(r.rating))}` : "-"}</td>
          <td class="l">${escapeHtml(r.note)}</td>
          <td>${r.minutes ?? "-"}</td>
          <td>${cardMark(r.yellow, "sheet-card-y")}</td>
          <td>${cardMark(r.red, "sheet-card-r")}</td>
          <td>${r.goals || ""}</td>
          <td>${r.assists || ""}</td>
          <td>${escapeHtml(r.position ?? "-")}</td>
          <td>${escapeHtml(r.statusLabel)}</td>
        </tr>`;
      })
      .join("");
    const t = model.totals;
    table = `<table class="sheet-table">
      <thead><tr><th>#</th><th class="l">ผู้เล่น</th><th>คะแนน</th><th class="l">หมายเหตุ</th><th>นาที</th><th>เหลือง</th><th>แดง</th><th>ประตู</th><th>Assist</th><th>ตำแหน่ง</th><th>สถานะ</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td></td><td class="l">รวม (เฉพาะคนที่ลงสนาม)</td><td>${t.avgRating !== null ? `เฉลี่ย ${t.avgRating} ${escapeHtml(starsText(t.avgRating))}` : "-"}</td><td></td><td>${t.minutesKnown ? t.minutes : "-"}</td><td>${t.yellow}</td><td>${t.red}</td><td>${t.goals}</td><td>${t.assists}</td><td></td><td></td></tr></tfoot>
    </table>`;
  } else {
    table = `<p class="sheet-note">รายงานนี้บันทึกก่อนมีระบบ Match Day จึงไม่มีรายละเอียดรายคน${model.lineupNames.length > 0 ? ` — ตัวจริง: ${escapeHtml(model.lineupNames.join(", "))}` : ""}</p>`;
  }
  const link = safeHttpUrl(model.videoUrl);
  const reportLines = [
    ["เกมรุกของคู่แข่ง", model.oppAttack],
    ["เกมรับของคู่แข่ง", model.oppDefense],
    ["ความคิดเห็นเพิ่มเติม", model.notes]
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<p><span class="sheet-k">${k}</span> ${escapeHtml(v)}</p>`)
    .join("");
  const linkLine = link ? `<p><span class="sheet-k">ลิงก์ดูการแข่งขันย้อนหลัง</span> <a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a></p>` : "";
  return `<div class="sheet sheet-report print-sheet">
    <div class="sheet-head"><div class="sheet-brand">${teamLogoImg(team, "sheet-logo")}<div><b>${escapeHtml(team)} · ${escapeHtml(model.ageGroup)}</b><br><span>รายงานผลการแข่งขัน</span></div></div>
      <div class="sheet-vs">${escapeHtml(team)} vs ${escapeHtml(model.opponent)}</div></div>
    <div class="sheet-score"><div class="sheet-scoreline">${escapeHtml(team)} <b>${model.scoreUs ?? "-"} – ${model.scoreThem ?? "-"}</b> ${escapeHtml(model.opponent)} ${resultBadge}</div><div class="sheet-info">${info}</div></div>
    <h4>ผลงานนักกีฬา</h4>
    ${table}
    <h4>Match Report</h4>
    <div class="sheet-report-lines">${reportLines || '<p class="sheet-note">ไม่มีข้อมูล Match Report</p>'}${linkLine}</div>
  </div>`;
}

// ---------- Match Recording Form (ให้โค้ชพิมพ์ไปจดข้อมูลแล้วกลับมากรอก Match Day) ----------
const BOX = "☐";
const STARS_BLANK = "☆".repeat(MATCH_RATING_MAX);

export function recordingFormHtml({ team, ageGroup, players, blankRows = 4 }) {
  const rows = players
    .map(
      (p) => `<tr>
        <td>${p.number ?? ""}</td><td class="l">${escapeHtml(p.nickname ?? "-")}</td><td class="l">${escapeHtml(p.fullName ?? "")}</td><td>${escapeHtml(p.ageGroup ?? ageGroup)}</td>
        <td class="nw">${BOX}ต ${BOX}ส ${BOX}ม</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="nw">${STARS_BLANK}</td></tr>`
    )
    .join("");
  const blank = Array.from({ length: blankRows }, () => `<tr class="sheet-blank"><td></td><td class="l"></td><td class="l"></td><td></td><td class="nw">${BOX}ต ${BOX}ส ${BOX}ม</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="nw">${STARS_BLANK}</td></tr>`).join("");
  const line = (w = 110) => `<span class="sheet-line" style="min-width:${w}px"></span>`;
  return `<div class="sheet sheet-form print-sheet">
    <div class="sheet-head"><div class="sheet-brand">${teamLogoImg(team, "sheet-logo")}<div><b>MATCH RECORDING FORM</b><br><span>${escapeHtml(team)} · ${escapeHtml(ageGroup)}</span></div></div>
      <div class="sheet-vs">วันที่ ${line(100)} เวลา ${line(55)} สถานที่ ${line(120)}</div></div>
    <h4>ส่วนที่ 1 · ข้อมูล Match</h4>
    <div class="sheet-fields">
      <div>ประเภทการแข่งขัน ${BOX} 7v7 ${BOX} 9v9 ${BOX} 11v11 ${BOX} อื่นๆ ${line(70)} &nbsp; ความยาวการแข่งขัน ${line(40)} นาที</div>
      <div>ประเภทรายการ ${BOX} ลีก ${BOX} ทัวร์นาเมนต์ ${BOX} อุ่นเครื่อง &nbsp; ชื่อรายการ ${line(220)}</div>
      <div>คู่แข่ง ${line(260)}</div>
    </div>
    <h4>ส่วนที่ 2 · ข้อมูล Game</h4>
    <div class="sheet-fields"><div>ผลการแข่งขัน ${BOX} ชนะ ${BOX} เสมอ ${BOX} แพ้ &nbsp; ประตู ทีมเรา ${line(40)} คู่แข่ง ${line(40)} &nbsp; แผนการเล่น ${line(80)}</div></div>
    <table class="sheet-table sheet-form-table">
      <thead><tr><th>#</th><th class="l">ชื่อเล่น</th><th class="l">ชื่อจริง</th><th>รุ่น</th><th>ต=ตัวจริง ส=สำรอง ม=ไม่มีรายชื่อ</th><th>ตำแหน่ง</th><th>ประตู</th><th>Assist</th><th>ใบเหลือง</th><th>ใบแดง</th><th>ออกนาที</th><th>ถูกแทนโดย</th><th>หมายเหตุ</th><th>คะแนน (วงกลม ครั้งละครึ่งดาว)</th></tr></thead>
      <tbody>${rows}${blank}</tbody>
    </table>
    <p class="sheet-note">ตำแหน่ง: ${ALL_POSITIONS.join(" ")} · นาทีเปลี่ยนตัวเขียนรูปแบบ 00:00 · แถวว่างท้ายตารางสำหรับนักกีฬาจากรุ่นอื่น (เขียนรุ่นอายุในช่อง "รุ่น")</p>
    <h4>ส่วนที่ 3 · Match Report</h4>
    <div class="sheet-fields">
      <div>รูปแบบการเล่นเกมรุกของคู่แข่ง ${line(520)}</div>
      <div>รูปแบบการเล่นเกมรับของคู่แข่ง ${line(520)}</div>
      <div>ลิงก์ดูการแข่งขันย้อนหลัง (ถ้ามี) ${line(300)} </div>
      <div>ความคิดเห็นเพิ่มเติม (ถ้ามี) ${line(430)}</div>
    </div>
  </div>`;
}

