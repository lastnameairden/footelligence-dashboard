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

// ฟอร์มต้องอยู่ในกระดาษ A4 แนวนอน "หน้าเดียว" — ความสูงที่เหลือให้ตารางนักกีฬา (มม.) หลังหักหัวฟอร์ม ส่วนที่ 1/3 และบรรทัดอื่น (ดู @media print ใน styles.css)
export const FORM_TABLE_BUDGET_MM = 112; // เผื่อ ~15 มม. จากที่ประเมินไว้ ให้หัวตารางขึ้นหลายบรรทัดหรือข้อความยาวก็ยังไม่ล้นหน้า
// สัดส่วนความกว้างคอลัมน์ (รวม 100): # · ชื่อเล่น · ชื่อจริง · รุ่น · สถานะ · ตำแหน่ง · ประตู · Assist · เหลือง · แดง · ออกนาที · ถูกแทนโดย · หมายเหตุ · คะแนน
export const FORM_COL_WIDTHS = [3, 8, 13, 4, 11, 6, 4.5, 4.5, 4, 4, 6, 9, 12, 11];
export const FORM_ROW_MM = { min: 3.9, max: 6.5 };

// ความสูงต่อแถวของตาราง (มม.) ให้จำนวนแถวทั้งหมด (นักกีฬา + แถวว่าง) พอดีกับ FORM_TABLE_BUDGET_MM — คนน้อยแถวสูง/คนมากแถวบางลงแต่ยังอยู่หน้าเดียว
export function formRowHeightMm(rowCount) {
  const h = FORM_TABLE_BUDGET_MM / Math.max(rowCount, 1);
  return Math.floor(Math.min(FORM_ROW_MM.max, Math.max(FORM_ROW_MM.min, h)) * 10) / 10; // ปัดลงเสมอ ไม่ให้เกินงบความสูง
}

// แถวว่างท้ายตารางสำหรับนักกีฬารุ่นอื่น: 4 แถว ลดเหลือ 2 เมื่อรุ่นมีนักกีฬามาก เพื่อไม่ให้แถวบางเกินไป
export const defaultBlankRows = (playerCount) => (playerCount >= 24 ? 2 : 4);

export function recordingFormHtml({ team, ageGroup, players, blankRows = defaultBlankRows(players.length) }) {
  const cells = (n) => "<td></td>".repeat(n);
  const rows = players
    .map(
      (p) => `<tr>
        <td>${p.number ?? ""}</td><td class="l">${escapeHtml(p.nickname ?? "-")}</td><td class="l">${escapeHtml(p.fullName ?? "")}</td><td>${escapeHtml(p.ageGroup ?? ageGroup)}</td>
        <td class="nw">${BOX}ต ${BOX}ส ${BOX}ม</td>${cells(8)}<td class="nw">${STARS_BLANK}</td></tr>`
    )
    .join("");
  const blank = Array.from({ length: blankRows }, () => `<tr class="sheet-blank"><td></td><td class="l"></td><td class="l"></td><td></td><td class="nw">${BOX}ต ${BOX}ส ${BOX}ม</td>${cells(8)}<td class="nw">${STARS_BLANK}</td></tr>`).join("");
  const rowH = formRowHeightMm(players.length + blankRows);
  const line = (cls = "") => `<span class="sheet-line grow ${cls}"></span>`;
  const fixed = (w) => `<span class="sheet-line" style="width:${w}mm"></span>`;
  return `<div class="sheet sheet-form print-sheet" style="--row-h:${rowH}mm">
    <div class="sheet-head"><div class="sheet-brand">${teamLogoImg(team, "sheet-logo")}<div><b>MATCH RECORDING FORM</b> <span>${escapeHtml(team)} · ${escapeHtml(ageGroup)}</span></div></div>
      <div class="sheet-vs sheet-row">วันที่ ${fixed(26)} เวลา ${fixed(14)} สถานที่ ${fixed(40)}</div></div>
    <h4>ส่วนที่ 1 · ข้อมูล Match</h4>
    <div class="sheet-fields">
      <div class="sheet-row"><span>ประเภทการแข่งขัน ${BOX} 7v7 ${BOX} 9v9 ${BOX} 11v11 ${BOX} อื่นๆ</span>${fixed(22)}<span>ความยาวการแข่งขัน</span>${fixed(12)}<span>นาที &nbsp; ประเภทรายการ ${BOX} ลีก ${BOX} ทัวร์นาเมนต์ ${BOX} อุ่นเครื่อง</span></div>
      <div class="sheet-row"><span>ชื่อรายการ</span>${line()}<span>คู่แข่ง</span>${line()}</div>
    </div>
    <h4>ส่วนที่ 2 · ข้อมูล Game</h4>
    <div class="sheet-fields"><div class="sheet-row"><span>ผลการแข่งขัน ${BOX} ชนะ ${BOX} เสมอ ${BOX} แพ้ &nbsp; ประตู ทีมเรา</span>${fixed(12)}<span>คู่แข่ง</span>${fixed(12)}<span>&nbsp; แผนการเล่น</span>${fixed(24)}</div></div>
    <table class="sheet-table sheet-form-table">
      <colgroup>${FORM_COL_WIDTHS.map((w) => `<col style="width:${w}%">`).join("")}</colgroup>
      <thead><tr><th>#</th><th class="l">ชื่อเล่น</th><th class="l">ชื่อจริง</th><th>รุ่น</th><th>ต=ตัวจริง ส=สำรอง ม=ไม่มี</th><th>ตำแหน่ง</th><th>ประตู</th><th>Assist</th><th>เหลือง</th><th>แดง</th><th>ออกนาที</th><th>ถูกแทนโดย</th><th>หมายเหตุ</th><th>คะแนน (ครึ่งดาว)</th></tr></thead>
      <tbody>${rows}${blank}</tbody>
    </table>
    <p class="sheet-note">ตำแหน่ง: ${ALL_POSITIONS.join(" ")} · นาทีเปลี่ยนตัวเขียน 00:00 · แถวว่างท้ายตารางสำหรับนักกีฬาจากรุ่นอื่น (เขียนรุ่นในช่อง "รุ่น")</p>
    <h4>ส่วนที่ 3 · Match Report</h4>
    <div class="sheet-fields sheet-cols">
      <div class="sheet-row"><span>เกมรุกของคู่แข่ง</span>${line()}</div>
      <div class="sheet-row"><span>ลิงก์ดูย้อนหลัง (ถ้ามี)</span>${line()}</div>
      <div class="sheet-row"><span>เกมรับของคู่แข่ง</span>${line()}</div>
      <div class="sheet-row"><span>ความคิดเห็นเพิ่มเติม (ถ้ามี)</span>${line()}</div>
    </div>
  </div>`;
}
