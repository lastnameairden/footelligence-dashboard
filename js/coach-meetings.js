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

// ---------- วาระ/ไฟล์ก่อนประชุม (แอดมิน+ทีมสต๊าฟกรอก) แยกตามสายโค้ช ----------
// สายมี 4 ส่วน: ส่วนกลาง (ทุกคนในกลุ่ม) + 3 สายตามตำแหน่งที่โค้ชลงทะเบียนไว้ ข้อมูลอยู่ใน sections.<สาย> ของเอกสารนัด
// (หัวข้อ plan + ไฟล์ files) โค้ชเห็นส่วนกลางกับสายของตัวเอง
// ความคิดเห็นหลังประชุมของแอดมิน/ทีมสต๊าฟเก็บแยกที่ coachMeetingComments/{meetingId} (โค้ชอ่านไม่ได้ตามกฎ Firestore)
// ส่วน sections.<สาย>.know/use/hw/mind เป็นข้อมูลรุ่นเก่า ไม่เขียน/ไม่แสดงอีกแล้ว
export const MEETING_SECTIONS = [
  { key: "all", label: "ส่วนกลาง" },
  { key: "player", label: "โค้ชผู้เล่น" },
  { key: "gk", label: "โค้ชประตู" },
  { key: "fit", label: "ฟิตเนสโค้ช" }
];

// งานหลังประชุมที่ "โค้ชแต่ละคน" กรอกเอง (collection coachMeetingRecaps/{meetingId}_{coachId}) ภายในกำหนดส่งของเดือนนั้น
export const COACH_RECAP_FIELDS = [
  { key: "know", label: "ความรู้ที่ได้วันนี้", placeholder: "สรุปแก่นความรู้ 2-3 ข้อ" },
  { key: "use", label: "นำไปใช้ในสนามอย่างไร", placeholder: "ตัวอย่างเกม/แบบฝึกที่ลองใช้ได้ทันที" }
];
export const COACH_RECAP_MAX_CHARS = 2000; // ต้องตรงกับ firestore.rules
// ต้องส่งก่อน 2 วันสุดท้ายของเดือนที่ประชุม = ส่งได้ถึงวัน (วันสุดท้ายของเดือน − 2) เช่น ตุลาคมส่งได้ถึงวันที่ 29
export const COACH_RECAP_DEADLINE_DAYS_BEFORE_MONTH_END = 2;

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

export function sectionHasPlan(section) {
  return !!section && (String(section.plan || "").trim() !== "" || (section.files || []).length > 0);
}

// ---------- งานหลังประชุมของโค้ช (ความรู้ที่ได้ + นำไปใช้ในสนาม) ----------
// เอกสารงานของโค้ชใช้ id นี้เสมอ (1 คน 1 นัด) — กฎ Firestore บังคับรูปแบบเดียวกัน
export function recapDocId(meetingId, coachId) {
  return `${meetingId}_${coachId}`;
}

// วันสุดท้ายที่ส่งงานของนัดในเดือน month ("YYYY-MM") = วันสุดท้ายของเดือน ลบ 2 วัน
export function recapDeadline(month) {
  const [y, m] = month.split("-").map(Number);
  const lastDay = formatUtcDate(new Date(Date.UTC(y, m, 0)));
  return addDaysToDate(lastDay, -COACH_RECAP_DEADLINE_DAYS_BEFORE_MONTH_END);
}

// สถานะงานหลังประชุมของโค้ชหนึ่งคนในนัดหนึ่ง — recap = เอกสารที่ส่งแล้ว (ถ้ามี) ใช้ submittedOn (วันที่ไทย yyyy-mm-dd) เทียบกำหนดส่ง
//   submitted / late = ส่งแล้ว (ตรงเวลา / หลังกำหนด)  excused = แอดมินบันทึกว่าลา/ขาด ไม่ต้องส่ง  upcoming = ยังไม่ถึงวันประชุม
//   pending = ถึงวันประชุมแล้วและยังอยู่ในกำหนด  overdue = เลยกำหนดแล้วยังไม่ส่ง
export function recapStatus(meeting, coachId, recap, todayStr) {
  const deadline = recapDeadline(meeting.month);
  if (recap && recap.submittedOn) {
    return { state: recap.submittedOn > deadline ? "late" : "submitted", deadline, daysLeft: null };
  }
  const attendance = (meeting.attendance || {})[coachId];
  if (attendance === "leave" || attendance === "absent") return { state: "excused", deadline, daysLeft: null };
  if (todayStr < meeting.date) return { state: "upcoming", deadline, daysLeft: null };
  const daysLeft = daysUntil(deadline, todayStr);
  return { state: daysLeft < 0 ? "overdue" : "pending", deadline, daysLeft };
}

// ข้อความ+โทนสีของสถานะ (tone = success / warning / danger / neutral)
export function recapStatusView(status) {
  switch (status.state) {
    case "submitted":
      return { text: "ส่งแล้ว", tone: "success" };
    case "late":
      return { text: "ส่งแล้ว (เลยกำหนด)", tone: "warning" };
    case "excused":
      return { text: "ลา/ขาด · ไม่ต้องส่ง", tone: "neutral" };
    case "upcoming":
      return { text: "ยังไม่ถึงวันประชุม", tone: "neutral" };
    case "pending":
      return { text: status.daysLeft === 0 ? "ยังไม่ส่ง · ส่งได้ถึงวันนี้" : `ยังไม่ส่ง · เหลือ ${status.daysLeft} วัน`, tone: "warning" };
    default:
      return { text: `เลยกำหนด ${Math.abs(status.daysLeft)} วัน`, tone: "danger" };
  }
}

// ตรวจข้อความที่โค้ชกรอก: ต้องมีทั้งสองช่อง ไม่ยาวเกิน COACH_RECAP_MAX_CHARS — คืน { error } หรือ { values } (ตัดช่องว่างหัวท้ายแล้ว)
export function validateRecapInput(input) {
  const values = {};
  for (const f of COACH_RECAP_FIELDS) {
    const text = String((input || {})[f.key] ?? "").trim();
    if (!text) return { error: `กรอก "${f.label}" ก่อนส่ง` };
    if (text.length > COACH_RECAP_MAX_CHARS) return { error: `"${f.label}" ยาวเกิน ${COACH_RECAP_MAX_CHARS} ตัวอักษร` };
    values[f.key] = text;
  }
  return { values };
}

// นัดที่โค้ชต้องดูแลงานหลังประชุม: ถึงวันประชุมแล้ว ไม่ใช่ลา/ขาด (หรือส่งไปแล้ว) เรียงจากล่าสุดก่อน — recapsByMeeting = Map(meetingId → เอกสารงาน)
export function recapTasksForCoach(meetings, coachId, recapsByMeeting, todayStr) {
  return meetings
    .filter((m) => (m.coachIds || []).includes(coachId))
    .map((m) => ({ meeting: m, recap: recapsByMeeting.get(m.id) || null }))
    .map((t) => ({ ...t, status: recapStatus(t.meeting, coachId, t.recap, todayStr) }))
    .filter((t) => t.status.state !== "upcoming" && t.status.state !== "excused")
    .sort((a, b) => b.meeting.date.localeCompare(a.meeting.date));
}