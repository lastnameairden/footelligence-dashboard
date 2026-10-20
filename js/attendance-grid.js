// ตารางเช็คชื่อรายเดือนของโค้ช (เมนู Attendance) — นักกีฬา × ทุกวันของเดือน ตรรกะล้วนๆ + สร้าง HTML เป็นสตริง (เทสต์ใน Node ได้)
// รูปแบบเดียวกับตารางของผู้บริหารทีม (ATTENDANCE REGISTER) แต่เพิ่ม Match Day และเปลี่ยนสี:
//   เขียว+เลข = ซ้อม+คะแนนเฉลี่ย · ส้ม = มีวันซ้อมแต่ไม่มีการเช็คชื่อ (พ้นวันนั้นแล้ว) · ฟ้า I/P/R = บาดเจ็บ/ลา/พักฟื้น
//   แดง+เลข = Match Day ที่ลงสนาม (คะแนนที่โค้ชให้) · แดงว่าง = Match Day ที่ไม่ได้ลงสนาม · เทาว่าง = ไม่มีซ้อม · ขาวว่าง = ยังไม่ถึงกำหนด
// คอลัมน์สรุป A / Missed / AV / % นับเฉพาะวันซ้อมปกติ (Match Day ไม่รวม — คนที่ไม่ได้ลงจึงไม่ถูกนับว่าขาด)
import { computeAvgScore, escapeHtml } from "./ui-utils.js";

export const GRID_COLORS = { score: "#0f6b4f", missing: "#c2680c", status: "#1f78c8", match: "#b91c1c", unknown: "#cbd5e1" };
export const STATUS_META = { I: "บาดเจ็บ", P: "ลา", R: "พักฟื้น" };
const WEEKDAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function monthDays(month) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const day = i + 1;
    return { date: `${month}-${String(day).padStart(2, "0")}`, day, dow: new Date(Date.UTC(y, m - 1, day)).getUTCDay() };
  });
}

// matchReports ที่เป็น Match Day (flag matchDay) — รายงานเก่าที่ไม่มีรายละเอียดรายคนไม่นับ (ไม่มีข้อมูลให้แสดงในตาราง)
const isMatchDay = (r) => r && r.matchDay === true && Array.isArray(r.players);

// ค่าเริ่มต้น: weekdays = วันซ้อมปกติของทีม (0=อาทิตย์) — วันที่มี session จริง (ไม่ใช่ noTraining) นับเพิ่ม, วันที่ noTraining ตัดออก
export function buildAttendanceGrid({ month, ageGroup, players, attendanceRecords, sessions, matchReports, weekdays, today }) {
  const days = monthDays(month);
  const trainingDates = new Set();
  const noTraining = new Set();
  for (const s of sessions) {
    if (!s.date || !s.date.startsWith(month)) continue;
    if (s.noTraining) noTraining.add(s.date);
    else trainingDates.add(s.date);
  }
  for (const d of days) if ((weekdays || [1, 2, 3, 4, 5]).includes(d.dow)) trainingDates.add(d.date);
  for (const date of noTraining) trainingDates.delete(date);

  const recordByKey = new Map();
  for (const r of attendanceRecords) {
    if (!r.playerId || !r.date) continue;
    const key = `${r.playerId}|${r.date}`;
    const prev = recordByKey.get(key);
    const t = (x) => (x?.updatedAt && typeof x.updatedAt.toDate === "function" ? x.updatedAt.toDate().getTime() : 0);
    if (!prev || t(r) >= t(prev)) recordByKey.set(key, r);
  }

  // Match Day: ของรุ่นนี้ (ownMatchDates) และรายการรายคนจากทุกรุ่น (entryByKey — รวมคนที่ถูกดึงไปเล่นรุ่นอื่น)
  const matches = (matchReports || []).filter((r) => isMatchDay(r) && (r.date || "").startsWith(month));
  const ownMatchDates = new Set(matches.filter((r) => r.ageGroup === ageGroup).map((r) => r.date));
  const entryByKey = new Map();
  for (const r of matches) for (const p of r.players) entryByKey.set(`${p.id}|${r.date}`, p);

  // ผู้เล่นรุ่นอื่นที่ถูกดึงมาลงสนามใน Match Day ของรุ่นนี้ — แสดงเป็นแถวเพิ่มท้ายตาราง (เฉพาะช่อง Match Day)
  const ownIds = new Set(players.map((p) => p.id));
  const guests = new Map();
  for (const r of matches.filter((m) => m.ageGroup === ageGroup)) {
    for (const p of r.players) {
      if (!p.guest || !p.played || ownIds.has(p.id)) continue;
      if (!guests.has(p.id)) guests.set(p.id, { id: p.id, number: null, nickname: p.name ?? "-", fromAgeGroup: p.ageGroup });
    }
  }
  const rowPlayers = [...players, ...guests.values()];

  const matchDates = new Set(ownMatchDates);
  for (const p of rowPlayers) for (const d of days) if (entryByKey.has(`${p.id}|${d.date}`)) matchDates.add(d.date);

  const columns = days.map((d) => ({
    ...d,
    active: trainingDates.has(d.date) || matchDates.has(d.date),
    isToday: d.date === today,
    matchDay: matchDates.has(d.date)
  }));

  const rows = rowPlayers.map((p) => {
    const guest = guests.has(p.id);
    let attended = 0;
    let missed = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    const cells = days.map((d) => {
      const entry = entryByKey.get(`${p.id}|${d.date}`);
      if (entry && entry.played) {
        const rating = typeof entry.rating === "number" ? entry.rating : null;
        return { kind: "match", text: rating !== null ? String(rating) : "–", title: rating !== null ? `Match Day · คะแนน ${rating}` : "Match Day · ลงสนาม (ยังไม่ให้คะแนน)" };
      }
      if (entry || (!guest && ownMatchDates.has(d.date))) return { kind: "match_out", text: "", title: "Match Day · ไม่ได้ลงสนาม" };
      if (guest) return { kind: "blank", text: "", title: "" };
      if (!trainingDates.has(d.date)) return { kind: "inactive", text: "", title: "" };
      const record = recordByKey.get(`${p.id}|${d.date}`);
      if (!record) {
        // ส้มเฉพาะเมื่อพ้นวันนั้นไปแล้ว — วันนี้/อนาคตยังขาว (ยังไม่ถือเป็นปัญหา)
        return d.date >= today ? { kind: "pending", text: "", title: "" } : { kind: "missing", text: "–", title: "มีวันฝึกซ้อมจริงแต่ไม่มีการเช็คชื่อ" };
      }
      if (record.status === "A") {
        attended += 1;
        const avg = computeAvgScore(record.scores);
        if (avg !== null) {
          scoreSum += avg;
          scoreCount += 1;
        }
        return { kind: "score", text: avg !== null ? avg.toFixed(1) : "-", title: `มาซ้อม คะแนนเฉลี่ย ${avg !== null ? avg.toFixed(2) : "ยังไม่ให้คะแนน"}` };
      }
      if (STATUS_META[record.status]) {
        missed += 1;
        return { kind: "status", text: record.status, title: STATUS_META[record.status] };
      }
      return { kind: "unknown", text: String(record.status ?? "?"), title: "" };
    });
    const reported = attended + missed;
    const summary = guest
      ? null
      : {
          attended,
          missed,
          avg: scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : "-",
          percent: reported > 0 ? Math.round((attended / reported) * 100) : null
        };
    return { player: p, guest, cells, summary };
  });
  return { columns, rows };
}

// ---------- HTML ----------
const dot = (bg, text, title, extra = "") =>
  `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold" style="background:${bg};${extra}" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;

function cellHtml(cell) {
  switch (cell.kind) {
    case "inactive":
      return '<td style="padding:0.3rem;text-align:center;background:#F8FAFC;"></td>';
    case "pending":
    case "blank":
      return '<td style="padding:0.3rem;text-align:center;background:#fff;"></td>';
    case "missing":
      return `<td style="padding:0.3rem;text-align:center;">${dot(GRID_COLORS.missing, "–", cell.title)}</td>`;
    case "score":
      return `<td style="padding:0.3rem;text-align:center;">${dot(GRID_COLORS.score, cell.text, cell.title)}</td>`;
    case "status":
      return `<td style="padding:0.3rem;text-align:center;">${dot(GRID_COLORS.status, cell.text, cell.title)}</td>`;
    case "match":
      return `<td style="padding:0.3rem;text-align:center;">${dot(GRID_COLORS.match, cell.text, cell.title)}</td>`;
    case "match_out":
      return `<td style="padding:0.3rem;text-align:center;">${dot(GRID_COLORS.match, "", cell.title)}</td>`;
    default:
      return `<td style="padding:0.3rem;text-align:center;">${dot(GRID_COLORS.unknown, cell.text, "", "color:#475569;")}</td>`;
  }
}

export function legendHtml() {
  const item = (swatch, label) => `<span class="inline-flex items-center gap-1.5">${swatch}<span>${label}</span></span>`;
  const box = (bg, text) => dot(bg, text, "");
  return `<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
    ${item(box(GRID_COLORS.score, "3.5"), "ซ้อม + ให้คะแนน")}
    ${item(box(GRID_COLORS.missing, "–"), "มีซ้อม ไม่มีการเช็คชื่อ")}
    ${item(box(GRID_COLORS.status, "I"), "บาดเจ็บ")}
    ${item(box(GRID_COLORS.status, "P"), "ลา")}
    ${item(box(GRID_COLORS.status, "R"), "พักฟื้น")}
    ${item(box(GRID_COLORS.match, "3.5"), "Match Day (คะแนนที่โค้ชให้)")}
    ${item(box(GRID_COLORS.match, ""), "Match Day ไม่ได้ลงสนาม")}
    ${item('<span style="display:inline-block;width:1.5rem;height:1.5rem;background:#F8FAFC;border:1px solid #E1E4DE;"></span>', "ไม่มีซ้อม")}
    ${item('<span style="display:inline-block;width:1.5rem;height:1.5rem;background:#fff;border:1px solid #E1E4DE;"></span>', "ยังไม่ถึงกำหนด")}
  </div>`;
}

export function gridHtml(grid) {
  const headerCells = grid.columns
    .map((c) => {
      const bg = c.active ? "" : "background:#F8FAFC;";
      const ring = c.isToday ? "box-shadow:inset 0 0 0 2px #10b981;" : c.matchDay ? `box-shadow:inset 0 -3px 0 ${GRID_COLORS.match};` : "";
      const title = c.matchDay ? ' title="Match Day"' : "";
      return `<th${title} style="padding:0.5rem 0.3rem;text-align:center;font-size:0.65rem;white-space:nowrap;${bg}${ring}">${c.day}<br><span class="text-slate-400 font-normal">${WEEKDAY_TH[c.dow]}</span></th>`;
    })
    .join("");
  const body = grid.rows
    .map((r) => {
      const p = r.player;
      const name = `${p.number != null ? `${escapeHtml(p.number)} · ` : ""}${escapeHtml(p.nickname)}${r.guest ? ` <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(p.fromAgeGroup)} ยืมมาแข่ง)</span>` : ""}`;
      const s = r.summary;
      const percentColor = !s || s.percent === null ? "text-slate-400" : s.percent >= 80 ? "text-emerald-700" : s.percent >= 50 ? "text-amber-700" : "text-red-700";
      const summaryCells = s
        ? `<td style="text-align:center;background:#F8FAFC;font-weight:600;">${s.attended}</td>
           <td style="text-align:center;background:#F8FAFC;">${s.missed}</td>
           <td style="text-align:center;background:#F8FAFC;">${s.avg}</td>
           <td style="text-align:center;background:#F8FAFC;border-right:2px solid #E1E4DE;font-weight:600;" class="${percentColor}">${s.percent === null ? "-" : `${s.percent}%`}</td>`
        : `<td style="text-align:center;background:#F8FAFC;">—</td><td style="text-align:center;background:#F8FAFC;">—</td><td style="text-align:center;background:#F8FAFC;">—</td><td style="text-align:center;background:#F8FAFC;border-right:2px solid #E1E4DE;">—</td>`;
      return `<tr>
        <td class="emphasis" style="position:sticky;left:0;background:#fff;white-space:nowrap;padding:0.5rem 0.75rem;">${name}</td>
        ${summaryCells}
        ${r.cells.map(cellHtml).join("")}
      </tr>`;
    })
    .join("");
  return `<table class="pro-table grid-table" style="font-size:0.75rem;">
    <thead><tr>
      <th style="position:sticky;left:0;background:#EEF0EC;text-align:left;min-width:9rem;">นักกีฬา</th>
      <th style="text-align:center;" title="Attendance — จำนวนครั้งที่มาซ้อม">A</th>
      <th style="text-align:center;" title="Missed — รวมบาดเจ็บ/ลา/พักฟื้น">Missed</th>
      <th style="text-align:center;" title="Average — คะแนนเฉลี่ยรวม">AV</th>
      <th style="text-align:center;border-right:2px solid #E1E4DE;" title="% เข้าร่วม">%</th>
      ${headerCells}
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}
