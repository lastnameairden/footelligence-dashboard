// ประวัติการแข่งขัน + รายงานผล Match Day (เมนู Match Data) — ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้
// ข้อมูลมาจากคอลเลกชัน matchReports (รายงานที่บันทึกจาก Match Day มี matchDay + players[] / รายงานเก่าจากฟอร์มเดิมมีแค่สกอร์ คู่แข่ง แผนการเล่น ตัวจริง)

const FORMAT_LABELS = { "7v7": "7v7", "9v9": "9v9", "11v11": "11v11" };

export function formatLabel(report) {
  if (report.matchFormat === "other") return report.matchFormatOther || "อื่นๆ";
  return FORMAT_LABELS[report.matchFormat] || "-";
}

// ปีการศึกษา: เริ่มพฤษภาคม ถึงเมษายนปีถัดไป (เหมือนที่ระบบใช้กับรอบทดสอบ) — 2026-10-19 → 2026, 2027-03-01 → 2026
export function seasonStartYear(dateStr) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(dateStr ?? ""));
  if (!m) return null;
  const year = Number(m[1]);
  return Number(m[2]) >= 5 ? year : year - 1;
}

export const seasonLabel = (startYear) => `${startYear}/${startYear + 1}`;

// ฤดูกาลที่มีรายงานอยู่ (ใหม่ไปเก่า) + ฤดูกาลปัจจุบันเสมอ (ยังไม่มีรายงานก็เลือกได้)
export function seasonOptions(reports, todayStr) {
  const years = new Set(reports.map((r) => seasonStartYear(r.date)).filter((y) => y !== null));
  const current = seasonStartYear(todayStr);
  if (current !== null) years.add(current);
  return [...years].sort((a, b) => b - a);
}

const ageNum = (g) => {
  const m = /^U(\d+)$/i.exec(String(g ?? ""));
  return m ? Number(m[1]) : Infinity;
};

const searchText = (r) => `${r.opponent ?? ""} ${r.competition ?? ""} ${r.venue ?? ""}`.toLowerCase();

// ageGroups = รุ่นที่โค้ชดูแล (ว่าง = ทุกรุ่น) · seasonStart = ปีเริ่มต้นฤดูกาล (null = ทุกฤดูกาล)
export function filterReports(reports, { seasonStart = null, query = "", ageGroups = [] } = {}) {
  const q = String(query).trim().toLowerCase();
  const groups = ageGroups.length > 0 ? new Set(ageGroups) : null;
  return reports.filter((r) => (seasonStart === null || seasonStartYear(r.date) === seasonStart) && (!groups || groups.has(r.ageGroup)) && (!q || searchText(r).includes(q)));
}

const byNewest = (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.matchTime ?? "").localeCompare(String(a.matchTime ?? ""));

// จัดกลุ่มตามรุ่นอายุ (เล็กไปใหญ่) ในกลุ่มเรียงจากใหม่ไปเก่า — { ageGroup, matches, wins, draws, losses }
export function groupByAgeGroup(reports) {
  const map = new Map();
  for (const r of reports) {
    const key = r.ageGroup || "ไม่ระบุรุ่น";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map]
    .map(([ageGroup, matches]) => ({
      ageGroup,
      matches: matches.sort(byNewest),
      wins: matches.filter((m) => m.result === "ชนะ").length,
      draws: matches.filter((m) => m.result === "เสมอ").length,
      losses: matches.filter((m) => m.result === "แพ้").length
    }))
    .sort((a, b) => ageNum(a.ageGroup) - ageNum(b.ageGroup) || a.ageGroup.localeCompare(b.ageGroup));
}

export const hasDetail = (report) => !!report && report.matchDay === true && Array.isArray(report.players);

const STATUS_LABEL = { starter: "ตัวจริง", sub: "สำรอง", none: "ไม่มีรายชื่อ" };

// ข้อมูลสำหรับวาดรายงานผล: แถวนักกีฬาเรียง ตัวจริง → สำรองที่ได้ลง → ที่เหลือ (ไม่ได้ลง) พร้อมยอดรวม
export function buildReportModel(report) {
  const detail = hasDetail(report);
  const players = detail ? report.players : [];
  const nameById = new Map(players.map((p) => [p.id, p.name ?? "-"]));
  const order = (p) => (p.status === "starter" ? 0 : p.played ? 1 : 2);
  const rows = players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => order(a.p) - order(b.p) || a.i - b.i)
    .map(({ p }) => {
      const notes = [];
      if (p.replacedById) notes.push(`ออก ${p.subOutMinute ?? "-"} (แทนโดย ${nameById.get(p.replacedById) ?? "-"})`);
      else if (p.played && p.subOutMinute) notes.push(`ออก ${p.subOutMinute}`);
      if (p.replacesId) notes.push(`เข้าแทน ${nameById.get(p.replacesId) ?? "-"} นาที ${p.subInMinute ?? "-"}`);
      return {
        id: p.id,
        name: p.name ?? "-",
        ageGroup: p.ageGroup ?? null,
        guest: !!p.guest,
        status: p.status ?? "none",
        statusLabel: STATUS_LABEL[p.status] ?? "-",
        played: !!p.played,
        position: p.position ?? null,
        rating: typeof p.rating === "number" ? p.rating : null,
        goals: p.goals || 0,
        assists: p.assists || 0,
        yellow: p.yellowCards || 0,
        red: p.redCards || 0,
        minutes: typeof p.minutes === "number" ? p.minutes : null,
        subNote: notes.join(" · "),
        note: p.note ?? ""
      };
    });
  const played = rows.filter((r) => r.played);
  const rated = played.filter((r) => r.rating !== null);
  const known = played.filter((r) => r.minutes !== null);
  const totals = {
    minutes: known.reduce((n, r) => n + r.minutes, 0),
    minutesKnown: known.length === played.length,
    yellow: played.reduce((n, r) => n + r.yellow, 0),
    red: played.reduce((n, r) => n + r.red, 0),
    goals: played.reduce((n, r) => n + r.goals, 0),
    assists: played.reduce((n, r) => n + r.assists, 0),
    avgRating: rated.length > 0 ? Math.round((rated.reduce((n, r) => n + r.rating, 0) / rated.length) * 10) / 10 : null,
    ratedCount: rated.length
  };
  return {
    detail,
    id: report.id,
    date: report.date,
    time: report.matchTime || null,
    ageGroup: report.ageGroup ?? "-",
    format: formatLabel(report),
    competitionType: report.competitionType ?? null,
    competition: report.competition ?? null,
    opponent: report.opponent ?? "-",
    venue: report.venue ?? null,
    formation: report.formation ?? null,
    scoreUs: report.scoreUs ?? null,
    scoreThem: report.scoreThem ?? null,
    result: report.result ?? null,
    lengthMinutes: report.matchLengthMinutes ?? null,
    rows,
    totals,
    oppAttack: report.oppAttack ?? null,
    oppDefense: report.oppDefense ?? null,
    videoUrl: report.videoUrl ?? null,
    notes: report.notes ?? null,
    lineupNames: report.startingLineupNames ?? []
  };
}
