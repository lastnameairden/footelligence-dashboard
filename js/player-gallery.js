// แกลเลอรีนักกีฬา (เมนู Player Data) — ตรรกะล้วนๆ ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้

// "2009 / 2552" (ค.ศ. / พ.ศ.) จากวันเกิดรูปแบบ YYYY-MM-DD — ไม่มีหรือรูปแบบผิด = "-"
export function birthYearLabel(birthday) {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(String(birthday ?? ""));
  if (!m) return "-";
  const year = Number(m[1]);
  return `${year} / ${year + 543}`;
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// "12 มี.ค. 2009 / 2552" — ใช้ในหน้ารายละเอียด
export function birthdayLabel(birthday) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday ?? ""));
  if (!m) return "-";
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return "-";
  return `${Number(m[3])} ${THAI_MONTHS_SHORT[month - 1]} ${year} / ${year + 543}`;
}

// รุ่นอายุที่มีนักกีฬาอยู่ เรียงจากเด็กไปโต (U10, U12, U16 …) — ไม่ใช่รูปแบบ U<เลข> ไว้ท้าย
export function ageGroupsOf(players) {
  const num = (g) => {
    const m = /^U(\d+)$/i.exec(String(g));
    return m ? Number(m[1]) : Infinity;
  };
  return [...new Set(players.map((p) => p.ageGroup).filter(Boolean))].sort((a, b) => num(a) - num(b) || String(a).localeCompare(String(b)));
}

const searchText = (p) => `${p.nickname ?? ""} ${p.fullName ?? ""}`.toLowerCase();

// กรองตามรุ่นอายุ (ageGroup ว่าง/"all" = ทุกรุ่นที่โค้ชเห็น) + ค้นหาชื่อเล่น/ชื่อจริง แล้วเรียง — sort: "number" (เบอร์ ไม่มีเบอร์ไว้ท้าย) | "name" (ชื่อเล่น)
export function filterAndSortPlayers(players, { ageGroup = "all", query = "", sort = "number" } = {}) {
  const q = String(query).trim().toLowerCase();
  const list = players.filter((p) => (!ageGroup || ageGroup === "all" || p.ageGroup === ageGroup) && (!q || searchText(p).includes(q)));
  const nameOf = (p) => p.nickname || p.fullName || "";
  const numberOf = (p) => (typeof p.number === "number" ? p.number : Infinity);
  return list.sort(
    sort === "name"
      ? (a, b) => nameOf(a).localeCompare(nameOf(b), "th")
      : (a, b) => numberOf(a) - numberOf(b) || nameOf(a).localeCompare(nameOf(b), "th")
  );
}

export function playerDisplayName(p) {
  return p?.nickname || p?.fullName || "-";
}
