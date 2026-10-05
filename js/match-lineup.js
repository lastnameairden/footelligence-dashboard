// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ของการเลือก "11 ผู้เล่นตัวจริง" ในรายงานผลการแข่งขัน
//   - รายชื่อให้เลือกต้องมีผู้รักษาประตู (GK) ของรุ่นนั้นด้วย (เดิมตัวกรองตามตำแหน่งโค้ช ทำให้ Head/Assistant Coach ไม่เห็น GK เลย)
//   - ดึงผู้เล่นจากรุ่นอายุอื่นขึ้นมาเล่นเป็นตัวจริงได้ ระบบนับจำนวนและแยกตามรุ่นให้

export const MAX_LINEUP_SIZE = 11;

export const isGoalkeeper = (p) => !!p && p.position === "GK";

const playerName = (p) => p.nickname ?? p.fullName ?? p.id ?? "-";
const numberOf = (p) => (typeof p.number === "number" ? p.number : Infinity);

// ผู้เล่นรุ่นอายุเดียวกับที่แข่ง ทุกตำแหน่งรวม GK — เรียง GK ก่อน แล้วตามเบอร์ (หาผู้รักษาประตูเจอทันที)
export function ownGroupCandidates(pool, ageGroup) {
  if (!ageGroup) return [];
  return pool
    .filter((p) => p.ageGroup === ageGroup)
    .sort((a, b) => Number(isGoalkeeper(b)) - Number(isGoalkeeper(a)) || numberOf(a) - numberOf(b) || playerName(a).localeCompare(playerName(b)));
}

// รุ่นอายุอื่น (ไม่ใช่รุ่นที่แข่ง) ที่มีนักกีฬาในทีม พร้อมจำนวนคน — เรียงจากรุ่นเล็กไปใหญ่
export function guestAgeGroupOptions(pool, ageGroup) {
  const counts = new Map();
  for (const p of pool) {
    if (!p.ageGroup || p.ageGroup === ageGroup) continue;
    counts.set(p.ageGroup, (counts.get(p.ageGroup) || 0) + 1);
  }
  const num = (g) => Number(String(g).replace(/\D/g, "")) || 0;
  return [...counts]
    .map(([group, count]) => ({ ageGroup: group, count }))
    .sort((a, b) => num(a.ageGroup) - num(b.ageGroup));
}

export function guestCandidates(pool, sourceAgeGroup) {
  return ownGroupCandidates(pool, sourceAgeGroup);
}

// สรุปตัวจริงที่เลือก: จำนวนทั้งหมด จำนวนที่มาจากรุ่นอื่น (แยกตามรุ่น) และมีผู้รักษาประตูหรือไม่
export function summarizeLineup(selected, matchAgeGroup) {
  const guests = selected.filter((p) => p.ageGroup && p.ageGroup !== matchAgeGroup);
  const byGroup = new Map();
  for (const p of guests) byGroup.set(p.ageGroup, (byGroup.get(p.ageGroup) || 0) + 1);
  const goalkeepers = selected.filter(isGoalkeeper);
  return {
    total: selected.length,
    guestCount: guests.length,
    guestsByGroup: [...byGroup].map(([ageGroup, count]) => ({ ageGroup, count })),
    goalkeepers: goalkeepers.map(playerName),
    hasGoalkeeper: goalkeepers.length > 0
  };
}

// ฟิลด์ที่เก็บลง matchReports — startingLineupIds/Names เป็นของเดิม (หน้านักกีฬา/สมุดพกใช้ ids นับว่าลงเล่นนัดนี้ ผู้เล่นที่ถูกดึงขึ้นมา
// จึงได้นับนัดนี้ในประวัติของตัวเองด้วย) lineupGuests/lineupGuestCount เป็นของใหม่ ไว้บอกว่าใครมาจากรุ่นอื่น
export function buildLineupFields(selected, matchAgeGroup) {
  const guests = selected.filter((p) => p.ageGroup && p.ageGroup !== matchAgeGroup);
  return {
    startingLineupIds: selected.map((p) => p.id),
    startingLineupNames: selected.map(playerName),
    lineupGuests: guests.map((p) => ({ id: p.id, name: playerName(p), ageGroup: p.ageGroup })),
    lineupGuestCount: guests.length
  };
}

// สร้างรายการตัวจริงกลับจากรายงานที่บันทึกไว้ (ตอนแก้ไข) — ใช้ข้อมูลในรายงานเองเป็นตัวสำรอง กรณีนักกีฬาคนนั้นถูกลบออกจากทีมแล้ว
export function lineupFromReport(report, pool) {
  const ids = report.startingLineupIds || [];
  const names = report.startingLineupNames || [];
  const guests = new Map((report.lineupGuests || []).map((g) => [g.id, g]));
  const byId = new Map(pool.map((p) => [p.id, p]));
  return ids.map((id, i) => {
    const live = byId.get(id);
    if (live) return live;
    const g = guests.get(id);
    return { id, nickname: names[i] ?? g?.name ?? id, ageGroup: g?.ageGroup ?? report.ageGroup ?? null, position: null };
  });
}
