// หน้า Profile ของโค้ช: ข้อมูลบัญชี/ความรับผิดชอบ/งานที่ต้องทำ + ผลการทำงานรายเดือนของโค้ชคนนั้น (ตรรกะล้วนๆ + HTML เป็นสตริง ไม่พึ่ง DOM/Firebase)
// สูตรตรงกับหน้าสรุปผลงานโค้ชของแอดมิน (print.js): เช็คชื่อนับตามวันฝึกซ้อมจริง ตรงเวลา = บันทึกล่าสุดก่อน 23:59 แผน/รายงานจับคู่ด้วย coachId หรือชื่อ
import {
  coachPositionLabel,
  escapeHtml,
  getCoachPlayerIds,
  isCoachSubmissionOnTime,
  isPlayerOwnedByCoach,
  isRecordOfCoach,
  isReportLate,
  isTrainingPlanLate,
  safeHttpUrl,
  teamLogoImg,
  todayBangkok,
  trainingDaysQuotaForTeamMonth
} from "./ui-utils.js";
import { ageNumberOf } from "./fitness-calc.js";
import { dateLabel } from "./athlete-windows.js";
import { formatPhone } from "./player-profile-fields.js";

const inMonth = (record, month) => String(record?.date ?? "").startsWith(month);

// ผลการทำงานของโค้ช coach ในเดือน month — sessions/attendance/plans/reports/meetings/players คือข้อมูลของทีมเดือนนั้น
export function monthlyStats({ team, month, coach, sessions, attendance, plans, reports, meetings, players }) {
  const quota = trainingDaysQuotaForTeamMonth(team, month);

  // วันฝึกซ้อมจริงของเดือน (session ที่ไม่ใช่ noTraining) รวม doc ซ้ำวันเดียวกัน — เหมือน print.js
  const byDate = new Map();
  for (const s of sessions.filter((s) => inMonth(s, month) && !s.noTraining)) {
    if (!byDate.has(s.date)) byDate.set(s.date, { date: s.date, ids: [] });
    byDate.get(s.date).ids.push(s.id);
  }
  const myPlayerIds = getCoachPlayerIds(coach, players);
  let checkinDays = 0;
  let checkinOnTime = 0;
  for (const s of byDate.values()) {
    const mine = attendance.filter((a) => s.ids.includes(a.sessionId) && myPlayerIds.has(a.playerId));
    if (mine.length === 0) continue;
    checkinDays += 1;
    if (isCoachSubmissionOnTime(s, mine)) checkinOnTime += 1;
  }

  const myPlans = plans.filter((p) => inMonth(p, month) && isRecordOfCoach(p, coach));
  const plansLate = myPlans.filter((p) => isTrainingPlanLate(p)).length;
  const myReports = reports.filter((r) => inMonth(r, month) && isRecordOfCoach(r, coach));
  const reportsLate = myReports.filter((r) => isReportLate(r)).length;

  const myMeetings = meetings.filter((m) => inMonth(m, month) && (m.coachIds || []).includes(coach.id));
  const status = (m) => (m.attendance || {})[coach.id];

  return {
    quota,
    checkin: { days: checkinDays, onTime: checkinOnTime, late: checkinDays - checkinOnTime },
    plans: { total: myPlans.length, onTime: myPlans.length - plansLate, late: plansLate },
    reports: { total: myReports.length, late: reportsLate },
    meetings: {
      total: myMeetings.length,
      attended: myMeetings.filter((m) => status(m) === "attended").length,
      leave: myMeetings.filter((m) => status(m) === "leave").length,
      absent: myMeetings.filter((m) => status(m) === "absent").length
    }
  };
}

// รุ่นอายุที่ดูแลพร้อมจำนวนนักกีฬาที่โค้ชคนนี้ดูแลจริงในรุ่นนั้น (ตามตำแหน่ง: GK Coach เฉพาะผู้รักษาประตู ฯลฯ)
export function ageGroupRows(coach, players) {
  return [...(coach.ageGroups || [])]
    .sort((a, b) => (ageNumberOf(a) ?? 99) - (ageNumberOf(b) ?? 99))
    .map((ageGroup) => ({ ageGroup, count: players.filter((p) => p.ageGroup === ageGroup && isPlayerOwnedByCoach(coach, p)).length }));
}

const kv = (rows) =>
  `<dl class="profile-kv">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

const initialOf = (name) => escapeHtml(Array.from(String(name ?? "").trim())[0] ?? "?");

// รูปโค้ชถ้ามี (https เท่านั้น) ไม่มีก็ใช้ตัวอักษรแรกของชื่อ
const avatarInner = (coach) => {
  const src = safeHttpUrl(coach.photoUrl);
  return src ? `<img src="${src}" alt="" />` : initialOf(coach.name);
};

function createdLabel(coach) {
  const ts = coach.createdAt;
  return ts && typeof ts.toDate === "function" ? dateLabel(todayBangkok(ts.toDate())) : "-";
}

// todo = { tasks: จำนวนงานหลังประชุมที่ค้าง (null = ไม่ทราบ), round: ข้อความรอบทดสอบที่เปิด (ไม่มี = null), book: ข้อความช่วงสมุดพกที่เปิด (ไม่มี = null) }
export function profileInfoHtml({ coach, team, ageRows, todo }) {
  const statusBadge = coach.status === "approved" ? '<span class="badge badge-success">อนุมัติแล้ว</span>' : '<span class="badge badge-warning">รออนุมัติ</span>';
  const ageHtml = ageRows.length > 0 ? ageRows.map((r) => `${escapeHtml(r.ageGroup)} · ${r.count} คน`).join("<br>") : "-";
  const none = '<span class="text-slate-400">ไม่มี</span>';
  const taskText = todo.tasks === null || todo.tasks === undefined ? "-" : todo.tasks > 0 ? `<span class="badge badge-warning">${todo.tasks} งาน</span>` : "ไม่มีงานค้าง";
  return `
    <div class="card card-pad profile-head">
      <div class="profile-avatar" aria-hidden="true">${avatarInner(coach)}</div>
      <div class="profile-head-main">
        <p class="profile-name">${escapeHtml(coach.name ?? "-")} ${statusBadge}</p>
        <p class="text-sm text-slate-500">${escapeHtml(coach.email ?? "-")}</p>
      </div>
      <div class="profile-head-side">${teamLogoImg(team)}${escapeHtml(team ?? "-")}<br><span class="text-xs text-slate-400">สมัครเมื่อ ${escapeHtml(createdLabel(coach))}</span></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="card card-pad">
        <h3 class="section-title mb-2">บทบาทและความรับผิดชอบ</h3>
        ${kv([
          ["ตำแหน่ง", escapeHtml(coachPositionLabel(coach.coachPosition))],
          ["ทีม", escapeHtml(team ?? "-")],
          ["รุ่นอายุที่ดูแล", ageHtml]
        ])}
      </div>
      <div class="card card-pad">
        <h3 class="section-title mb-2">ที่ต้องทำตอนนี้</h3>
        ${kv([
          ["งานหลังประชุมที่ค้าง", taskText],
          ["รอบทดสอบสมรรถภาพที่เปิด", todo.round ? escapeHtml(todo.round) : none],
          ["สมุดพกที่เปิดให้ดู", todo.book ? escapeHtml(todo.book) : none]
        ])}
      </div>
    </div>
    <p class="text-sm text-slate-500">แก้ไขชื่อ ตำแหน่ง หรือรุ่นอายุที่ดูแล: แจ้งผู้ดูแลระบบ</p>`;
}

// ข้อมูลเบื้องต้นของโค้ชแบบละเอียด (หน้ารายบุคคลใน Coach Data ของทีมหลังบ้าน): ส่วนหัว + ข้อมูลส่วนตัว/ติดต่อ + บทบาทและรุ่นที่ดูแล
// ageRows = ageGroupRows(coach, players) — จำนวนนักกีฬาที่โค้ชคนนี้ดูแลจริงในแต่ละรุ่น
export function coachDetailHtml({ coach, team, ageRows }) {
  const statusBadge = coach.status === "approved" ? '<span class="badge badge-success">อนุมัติแล้ว</span>' : '<span class="badge badge-warning">รออนุมัติ</span>';
  const empty = '<span class="text-slate-400">ยังไม่กรอก</span>';
  const certs = Array.isArray(coach.certificates) ? coach.certificates : [];
  const total = ageRows.reduce((n, r) => n + r.count, 0);
  const ageHtml = ageRows.length > 0 ? ageRows.map((r) => `${escapeHtml(r.ageGroup)} · ${r.count} คน`).join("<br>") : "-";
  const phone = coach.phone ? `<a href="tel:${escapeHtml(coach.phone)}" class="player-phone">${escapeHtml(formatPhone(coach.phone))}</a>` : empty;
  const certHtml = certs.length > 0 ? `<span class="coach-card-tags">${certs.map((c) => `<span class="coach-tag coach-tag-cert">${escapeHtml(c)}</span>`).join("")}</span>` : empty;
  return `
    <div class="card card-pad profile-head">
      <div class="profile-avatar" aria-hidden="true">${avatarInner(coach)}</div>
      <div class="profile-head-main">
        <p class="profile-name">${escapeHtml(coach.name ?? "-")} ${statusBadge}</p>
        <p class="text-sm text-slate-600">${coach.fullName ? escapeHtml(coach.fullName) : "ยังไม่กรอกชื่อจริง"}</p>
        <p class="text-sm text-slate-500">${escapeHtml(coachPositionLabel(coach.coachPosition))}</p>
      </div>
      <div class="profile-head-side">${teamLogoImg(team)}${escapeHtml(team ?? "-")}<br><span class="text-xs text-slate-400">สมัครเมื่อ ${escapeHtml(createdLabel(coach))}</span></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="card card-pad">
        <h3 class="section-title mb-2">ข้อมูลส่วนตัวและการติดต่อ</h3>
        ${kv([
          ["ชื่อที่ใช้ในระบบ", escapeHtml(coach.name ?? "-")],
          ["ชื่อจริง", coach.fullName ? escapeHtml(coach.fullName) : empty],
          ["เบอร์โทรศัพท์", phone],
          ["อีเมล", coach.email ? escapeHtml(coach.email) : empty],
          ["ใบประกาศผู้ฝึกสอน", certHtml]
        ])}
      </div>
      <div class="card card-pad">
        <h3 class="section-title mb-2">บทบาทและความรับผิดชอบ</h3>
        ${kv([
          ["ตำแหน่ง", escapeHtml(coachPositionLabel(coach.coachPosition))],
          ["ทีม", escapeHtml(team ?? "-")],
          ["รุ่นอายุที่ดูแล", ageHtml],
          ["นักกีฬาที่ดูแลรวม", ageRows.length > 0 ? `${total} คน` : "-"],
          ["สถานะบัญชี", statusBadge]
        ])}
      </div>
    </div>`;
}

const tile = (label, value, sub) =>
  `<div class="profile-stat"><p class="profile-stat-label">${escapeHtml(label)}</p><p class="profile-stat-value">${value}<span class="profile-stat-sub"> ${escapeHtml(sub)}</span></p></div>`;

export function profileStatsHtml(stats) {
  const { quota, checkin, plans, reports, meetings } = stats;
  const meetingTile = meetings.total === 0 ? tile("เข้าประชุม", "-", "ไม่มีนัดในเดือนนี้") : tile("เข้าประชุม", meetings.attended, `/ ${meetings.total} ครั้ง${meetings.leave + meetings.absent > 0 ? ` · ลา ${meetings.leave} ขาด ${meetings.absent}` : ""}`);
  return `<div class="profile-stat-grid">
    ${tile("เช็คชื่อตรงเวลา", checkin.onTime, `/ ${quota} วัน · สาย ${checkin.late}`)}
    ${tile("ส่งแผนฝึกตรงเวลา", plans.onTime, `/ ${quota} · สาย ${plans.late}`)}
    ${tile("ส่งรายงานซ้อม", reports.total, `/ ${quota} วัน · สาย ${reports.late}`)}
    ${meetingTile}
  </div>`;
}
