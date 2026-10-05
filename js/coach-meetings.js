// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ของระบบนัดประชุมโค้ชรายสัปดาห์
//
// กติกา: ใน 1 เดือนมี 4 สัปดาห์ประชุม ทุกสัปดาห์เป็นวันพุธหรือวันพฤหัสบดี (ผู้ดูแลระบบเลือกรายสัปดาห์) โค้ชแต่ละคนเข้าประชุม
// เดือนละ 1 ครั้ง จึงแบ่งโค้ชของแต่ละทีมเป็น 4 กลุ่มเฉลี่ยๆ กัน กลุ่มละสัปดาห์ แต่ละทีมใช้เวลาไม่เกิน 25 นาที เรียงต่อกันตั้งแต่ 09:00
// เอกสาร 1 ใบ = 1 ทีม × 1 สัปดาห์ของเดือน (coachMeetings/{เดือน}_{ลำดับทีม}_{สัปดาห์})

export const MEETING_WEEKS_PER_MONTH = 4;
export const MEETING_MAX_MINUTES = 25;

// ลำดับตามนี้ = ลำดับการประชุมในวันเดียวกัน (ทีมแรกเริ่ม 09:00 ทีมถัดไปต่อกันทีละ 25 นาที)
export const MEETING_TEAM_SLOTS = [
  { team: "THAWEE SC", start: "09:00", end: "09:25" },
  { team: "THAMMASATHIT", start: "09:25", end: "09:50" },
  { team: "KHAMPHEE FOOTBALL", start: "09:50", end: "10:15" }
];

export function meetingSlotForTeam(team) {
  return MEETING_TEAM_SLOTS.find((s) => s.team === team) || null;
}

export function meetingTeamIndex(team) {
  return MEETING_TEAM_SLOTS.findIndex((s) => s.team === team);
}

export const MEETING_WEEKDAY_LABELS = { wed: "พุธ", thu: "พฤหัสบดี" };
// ค่าเริ่มต้นเมื่อสร้างตารางใหม่ สลับพุธ/พฤหัสบดีรายสัปดาห์ (ผู้ดูแลระบบปรับได้ภายหลัง)
export const DEFAULT_MEETING_WEEKDAYS = ["wed", "thu", "wed", "thu"];

const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function utcDateOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDaysToDate(dateStr, days) {
  const d = utcDateOf(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDate(d);
}

export function addMonthsToMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return formatUtcDate(d).slice(0, 7);
}

export function daysUntil(dateStr, todayStr) {
  return Math.round((utcDateOf(dateStr) - utcDateOf(todayStr)) / 86400000);
}

export function describeDaysUntil(n) {
  if (n <= 0) return "วันนี้";
  if (n === 1) return "พรุ่งนี้";
  return `อีก ${n} วัน`;
}

// "พุธที่ 21 ต.ค. 2026"
export function thaiMeetingDateLabel(dateStr) {
  const d = utcDateOf(dateStr);
  return `${THAI_WEEKDAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${THAI_MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function thaiMonthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return `${THAI_MONTHS_FULL[m - 1]} ${y}`;
}

// วันที่ประชุมของสัปดาห์ที่ week (1-4) = "พุธที่ week ของเดือน" (หรือวันพฤหัสบดีถัดมา) — นับจากวันพุธแรกของเดือน
export function meetingDate(month, week, weekday) {
  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const firstWednesday = 1 + ((3 - firstDow + 7) % 7);
  const offset = 7 * (week - 1) + (weekday === "thu" ? 1 : 0);
  return formatUtcDate(new Date(Date.UTC(y, m - 1, firstWednesday + offset)));
}

export function meetingWeekdayOf(dateStr) {
  const dow = utcDateOf(dateStr).getUTCDay();
  return dow === 3 ? "wed" : dow === 4 ? "thu" : null;
}

// หมุนกลุ่มไปหนึ่งสัปดาห์ทุกเดือน โค้ชคนเดิมจะไม่ได้ประชุมสัปดาห์เดิมซ้ำๆ ทุกเดือน
export function monthRotationOffset(month) {
  const [y, m] = month.split("-").map(Number);
  return (y * 12 + (m - 1)) % MEETING_WEEKS_PER_MONTH;
}

// coachIds ต้องเรียงมาแล้ว (ตามรุ่นอายุ) — แบ่งแบบเวียน เพื่อให้โค้ชรุ่นเดียวกันที่อยู่ติดกันตกคนละสัปดาห์
// และทุกกลุ่มมีจำนวนต่างกันไม่เกิน 1 คน
export function assignCoachesToWeeks(coachIds, month) {
  const weeks = Array.from({ length: MEETING_WEEKS_PER_MONTH }, () => []);
  const offset = monthRotationOffset(month);
  coachIds.forEach((id, i) => weeks[(i + offset) % MEETING_WEEKS_PER_MONTH].push(id));
  return weeks;
}

export function meetingDocId(month, team, week) {
  return `${month}_${meetingTeamIndex(team)}_${week}`;
}

// สร้างข้อมูลนัดประชุมครบ 4 สัปดาห์ของทีมหนึ่งในเดือนหนึ่ง — coaches = [{ id, name }] เรียงตามรุ่นอายุแล้ว
export function buildTeamMeetingDocs({ month, team, coaches, weekdays = DEFAULT_MEETING_WEEKDAYS, existingLinks = {} }) {
  const slot = meetingSlotForTeam(team);
  if (!slot) throw new Error(`ไม่รู้จักทีม ${team}`);
  const groups = assignCoachesToWeeks(
    coaches.map((c) => c.id),
    month
  );
  const nameById = new Map(coaches.map((c) => [c.id, c.name ?? "-"]));
  return groups.map((ids, i) => {
    const week = i + 1;
    return {
      id: meetingDocId(month, team, week),
      data: {
        team,
        month,
        week,
        date: meetingDate(month, week, weekdays[i] || "wed"),
        startTime: slot.start,
        endTime: slot.end,
        meetLink: existingLinks[week] || "",
        coachIds: ids,
        coachNames: ids.map((id) => nameById.get(id)),
        attendance: {}
      }
    };
  });
}

// ลิงก์ประชุมต้องเป็น https เท่านั้น (ว่างได้ = ยังไม่กำหนด)
export function isValidMeetingLink(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export const MEETING_ATTENDANCE_STATUSES = ["attended", "leave", "absent"];
export const MEETING_ATTENDANCE_LABELS = { attended: "เข้าร่วม", leave: "ลา", absent: "ขาด" };

// แตะชื่อโค้ชวนไปเรื่อยๆ: ยังไม่บันทึก → เข้าร่วม → ลา → ขาด → ยังไม่บันทึก
export function nextAttendanceStatus(current) {
  if (!current) return "attended";
  const i = MEETING_ATTENDANCE_STATUSES.indexOf(current);
  return i < 0 || i === MEETING_ATTENDANCE_STATUSES.length - 1 ? "" : MEETING_ATTENDANCE_STATUSES[i + 1];
}

export function summarizeMeetingAttendance(meeting) {
  const ids = meeting.coachIds || [];
  const att = meeting.attendance || {};
  const counts = { attended: 0, leave: 0, absent: 0, pending: 0, total: ids.length };
  for (const id of ids) {
    const s = att[id];
    if (MEETING_ATTENDANCE_STATUSES.includes(s)) counts[s] += 1;
    else counts.pending += 1;
  }
  return counts;
}

// นัดครั้งถัดไป (วันนี้หรือหลังจากนี้) ของโค้ชคนหนึ่ง
export function nextMeetingForCoach(meetings, coachId, todayStr) {
  return (
    meetings
      .filter((m) => m.date >= todayStr && (m.coachIds || []).includes(coachId))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""))[0] || null
  );
}

// ลิงก์ "เพิ่มลง Google Calendar" — ไม่ต้องล็อกอิน/ขอสิทธิ์อะไรเพิ่ม แค่เปิดหน้าสร้างนัดที่กรอกไว้ให้แล้ว
export function googleCalendarUrl(meeting) {
  const compact = (date, time) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `ประชุมโค้ช ${meeting.team}`,
    dates: `${compact(meeting.date, meeting.startTime)}/${compact(meeting.date, meeting.endTime)}`,
    ctz: "Asia/Bangkok",
    details: `ประชุมโค้ชรายสัปดาห์ (${meeting.team})${meeting.meetLink ? `\nGoogle Meet: ${meeting.meetLink}` : ""}`
  });
  if (meeting.meetLink) params.set("location", meeting.meetLink);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ---------- วาระ/ไฟล์ก่อนประชุม และสรุปความรู้หลังประชุม แยกตามสายโค้ช ----------
// สายมี 4 ส่วน: ส่วนกลาง (ทุกคนในกลุ่ม) + 3 สายตามตำแหน่งที่โค้ชลงทะเบียนไว้ ข้อมูลอยู่ใน sections.<สาย> ของเอกสารนัด
// (หัวข้อ plan + ไฟล์ files ก่อนประชุม / สรุป know, use, hw, mind หลังประชุม) โค้ชเห็นส่วนกลางกับสายของตัวเองเป็นหลัก
export const MEETING_SECTIONS = [
  { key: "all", label: "ส่วนกลาง" },
  { key: "player", label: "โค้ชผู้เล่น" },
  { key: "gk", label: "โค้ชประตู" },
  { key: "fit", label: "ฟิตเนสโค้ช" }
];

export const MEETING_RECAP_FIELDS = [
  { key: "know", label: "ความรู้ที่ได้วันนี้", placeholder: "สรุปแก่นความรู้ 2-3 ข้อ" },
  { key: "use", label: "นำไปใช้ในสนามอย่างไร", placeholder: "ตัวอย่างเกม/แบบฝึกที่ลองใช้ได้ทันที" },
  { key: "hw", label: "การบ้านก่อนครั้งหน้า", placeholder: "1-2 ข้อ ทำได้จริงภายใน 1 เดือน" },
  { key: "mind", label: "ความคิดของแอดมิน", placeholder: "สิ่งที่สังเกตจากการพูดคุย แนวทางต่อยอด คำชม" }
];

export const MEETING_MAX_FILES_PER_SECTION = 3;
export const MEETING_MAX_FILE_BYTES = 10 * 1024 * 1024; // ต้องตรงกับ storage.rules

// ตำแหน่งที่ลงทะเบียน (coachPosition) → สายของการประชุม; ไม่มีตำแหน่ง = ไม่อยู่ในสายใด (เห็นแต่ส่วนกลาง)
export function coachTrackOf(position) {
  if (position === "gk_coach") return "gk";
  if (position === "fitness_coach") return "fit";
  if (position === "head_coach" || position === "assistant_coach") return "player";
  return null;
}

// ส่วนที่โค้ชคนนี้ควรเห็น: ส่วนกลาง + สายของตัวเอง
export function sectionsForTrack(track) {
  return track ? ["all", track] : ["all"];
}

// คืนข้อความ error ถ้าแนบไฟล์นี้ไม่ได้ ไม่งั้นคืน null — ชนิดไฟล์ตรวจที่ฝั่งหน้าเว็บ (เหตุผลเดียวกับ storage.rules)
export function validateMeetingFile(file, existingCount) {
  if (existingCount >= MEETING_MAX_FILES_PER_SECTION) return `แนบได้สูงสุด ${MEETING_MAX_FILES_PER_SECTION} ไฟล์ต่อส่วน`;
  if (file.size > MEETING_MAX_FILE_BYTES) return `"${file.name}" ใหญ่เกินไป (จำกัดไม่เกิน 10MB)`;
  const okType = /^image\//.test(file.type) || file.type === "application/pdf";
  if (!okType) return `"${file.name}" ต้องเป็นรูปภาพหรือ PDF เท่านั้น`;
  return null;
}

export function meetingFilePath(meetingId, section, fileName, now) {
  const safe = String(fileName).replace(/[^\w.\-ก-๙]/g, "_");
  return `coachMeetings/${meetingId}/${section}/${now}_${safe}`;
}

export function sectionHasRecap(section) {
  return MEETING_RECAP_FIELDS.some((f) => section && String(section[f.key] || "").trim() !== "");
}

export function sectionHasPlan(section) {
  return !!section && (String(section.plan || "").trim() !== "" || (section.files || []).length > 0);
}

// สรุปประชุมล่าสุดที่ส่งให้โค้ชแล้ว (วันประชุมไม่เกินวันนี้) และมีเนื้อหาในส่วนที่โค้ชคนนี้เห็นจริง
export function latestPublishedRecap(meetings, coachId, todayStr, track) {
  const keys = sectionsForTrack(track);
  return (
    meetings
      .filter(
        (m) =>
          m.recapPublished === true &&
          m.date <= todayStr &&
          (m.coachIds || []).includes(coachId) &&
          keys.some((k) => sectionHasRecap((m.sections || {})[k]))
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null
  );
}

// เอกสาร "รับทราบสรุปประชุม" ใช้ id นี้เสมอ (1 คน 1 นัด) — กฎ Firestore บังคับรูปแบบเดียวกัน
export function ackDocId(meetingId, coachId) {
  return `${meetingId}_${coachId}`;
}