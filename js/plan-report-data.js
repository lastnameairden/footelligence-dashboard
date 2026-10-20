// ตาราง Training Plan Data (ประวัติการอัปโหลดแผน) และประวัติรายงานการฝึกซ้อม (Training Report / Training Report Data) — ตรรกะล้วนๆ + สร้าง HTML เป็นสตริง
// (ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้) ข้อมูลมาจาก trainingPlans และ trainingReports เดิม ไม่มีฟิลด์ใหม่
import { addMonthsToMonth, thaiMonthLabel } from "./coach-meetings.js";
import { escapeHtml, safeHttpUrl } from "./ui-utils.js";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const monthOf = (dateStr) => String(dateStr ?? "").slice(0, 7);

// "20 ต.ค. 2026" จาก "2026-10-20"
export function shortDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ""));
  return m ? `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${m[1]}` : "-";
}

// เวลาที่ส่ง (เวลาไทย) จาก Firestore Timestamp (มี toDate()) → "20 ต.ค. 08:50" — ไม่มีค่า = "-"
export function submittedLabel(record) {
  const ts = record?.createdAt ?? record?.updatedAt;
  if (!ts || typeof ts.toDate !== "function") return "-";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(ts.toDate());
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${THAI_MONTHS[Number(get("month")) - 1]} ${get("hour")}:${get("minute")}`;
}

// เดือน (ใหม่ไปเก่า) ที่มีข้อมูลอยู่ + เดือนปัจจุบันเสมอ
export function monthOptionsOf(records, thisMonth) {
  const set = new Set(records.map((r) => monthOf(r.date)).filter(Boolean));
  set.add(thisMonth);
  return [...set].sort((a, b) => b.localeCompare(a));
}

// n เดือนย้อนหลังนับจาก thisMonth (รวมเดือนนี้) — ใช้กับ Training Report Data ที่ต้องเลือกเดือนก่อนโหลด
export function monthsBack(thisMonth, n) {
  return Array.from({ length: n }, (_, i) => addMonthsToMonth(thisMonth, -i));
}

export function groupByMonth(records) {
  const map = new Map();
  for (const r of records) {
    const m = monthOf(r.date) || "-";
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(r);
  }
  return [...map]
    .map(([month, items]) => ({ month, items: items.sort((a, b) => String(b.date).localeCompare(String(a.date))) }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

// ---------- แผนการฝึกซ้อม ----------
// plans ของรุ่นที่ดูแลถูกกรองมาก่อนแล้ว (ageGroups ของแผนเป็น array) — ที่นี่กรองตามเดือนและรุ่นที่เลือกในตาราง
export function filterPlans(plans, { month = "", ageGroup = "" } = {}) {
  return plans.filter((p) => (!month || monthOf(p.date) === month) && (!ageGroup || (p.ageGroups || []).includes(ageGroup)));
}

export function planAgeGroupsOf(plans) {
  const num = (g) => Number(String(g).replace(/\D/g, "")) || 0;
  return [...new Set(plans.flatMap((p) => p.ageGroups || []))].sort((a, b) => num(a) - num(b));
}

// ctx.statusHtml(plan) = ป้ายตรงเวลา/เลท (ใช้ฟังก์ชันเดิมของหน้านี้) · canEdit = แสดงปุ่มแก้ไข/ลบ
export function planDataHtml(groups, { statusHtml, canEdit = true }) {
  if (groups.length === 0) return '<div class="card card-pad text-center text-slate-500">ยังไม่มีแผนการฝึกซ้อมในเดือนที่เลือก</div>';
  const head = "<tr><th>แบบฝึกประจำวันที่</th><th>วัน/เวลาที่ส่ง</th><th>Session plan</th><th>โค้ช</th><th>รุ่นอายุ</th><th>กลุ่มผู้เล่น</th><th>ประเภทการฝึก</th><th>Phase</th><th>หัวข้อหลัก</th><th>Physical</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr>";
  const body = groups
    .map((g) => {
      const rows = g.items
        .map((p) => {
          const file = safeHttpUrl(p.fileUrl);
          const topic = p.competitionTopic ? `<div class="text-xs text-slate-500">${escapeHtml(p.competitionTopic)}</div>` : "";
          const actions = canEdit
            ? `<button type="button" class="btn btn-secondary btn-sm" data-plan-edit="${escapeHtml(p.id)}">แก้ไข</button> <button type="button" class="btn btn-danger-soft btn-sm" data-plan-delete="${escapeHtml(p.id)}">ลบ</button>`
            : "";
          return `<tr>
            <td class="emphasis">${escapeHtml(shortDate(p.date))}</td>
            <td>${escapeHtml(submittedLabel(p))}</td>
            <td>${file ? `<a href="${file}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">เปิดไฟล์</a>` : "-"}</td>
            <td>${escapeHtml(p.coachName ?? "-")}</td>
            <td>${escapeHtml((p.ageGroups || []).join(", ") || "-")}</td>
            <td>${escapeHtml(p.playerGroup ?? "-")}</td>
            <td>${escapeHtml(p.trainingType ?? "-")}</td>
            <td>${escapeHtml(p.phase ?? "-")}${topic}</td>
            <td>${escapeHtml(p.mainPart ?? "-")}</td>
            <td>${escapeHtml((p.physicalFocus || []).join(", ") || "-")}</td>
            <td>${statusHtml ? statusHtml(p) : "-"}</td>
            <td>${escapeHtml(p.notes ?? "-")}</td>
            <td class="whitespace-nowrap">${actions}</td>
          </tr>`;
        })
        .join("");
      return `<tr class="match-divider"><td colspan="13">${escapeHtml(thaiMonthLabel(g.month))} · ${g.items.length} แผน</td></tr>${rows}`;
    })
    .join("");
  return `<div class="card table-wrap"><table class="pro-table plan-data-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

// ---------- รายงานการฝึกซ้อม ----------
const PERIOD_LABELS = { morning: "ซ้อมเช้า", evening: "ซ้อมเย็น" };

export function reportAttendLabel(r) {
  return r.attended === true ? "มีการซ้อม" : r.attended === false ? "ไม่มีการซ้อม" : "-";
}

export function reportPeriodLabel(r) {
  if (r.attended !== true || !r.periodType) return "-";
  const label = r.periodType === "other" ? r.periodOtherText || "อื่นๆ" : PERIOD_LABELS[r.periodType] || r.periodType;
  const range = r.periodStartTime && r.periodEndTime ? ` ${r.periodStartTime}-${r.periodEndTime} น.` : "";
  return `${label}${range}`;
}

const validCoord = (n) => typeof n === "number" && Number.isFinite(n);

// พิกัด GPS ที่ส่งตอนรายงาน → ลิงก์ Google Maps (สร้างจากตัวเลขเท่านั้น) — ไม่มีพิกัด = "-"
export function locationHtml(loc) {
  if (!loc || !validCoord(loc.lat) || !validCoord(loc.lng)) return "-";
  const text = `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  return `<a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${text}</a>`;
}

// รายงานของเดือน/ช่วงที่เลือก (เดือนเดียว หรือหลายเดือนที่ระบุ) — months = ["2026-10", "2026-09"] ว่าง = ทุกเดือน
export function filterReportsByMonths(reports, months = []) {
  const set = new Set(months);
  return reports.filter((r) => set.size === 0 || set.has(monthOf(r.date)));
}

// mode "compact" = ใต้ฟอร์ม Training Report · "full" = หน้า Training Report Data (เพิ่มโค้ช พิกัด วัน/เวลาที่ส่ง)
export function reportHistoryHtml(groups, { mode = "compact", highlightDate = null } = {}) {
  if (groups.length === 0) return '<div class="card card-pad text-center text-slate-500">ยังไม่มีรายงานการฝึกซ้อมในช่วงที่เลือก</div>';
  const full = mode === "full";
  const head = full
    ? "<tr><th>วันที่</th><th>โค้ช</th><th>การซ้อม</th><th>ช่วงเวลา</th><th>หมายเหตุ</th><th>สถานที่ (GPS)</th><th>รูป</th><th>วัน/เวลาที่ส่ง</th><th></th></tr>"
    : "<tr><th>วันที่</th><th>การซ้อม</th><th>ช่วงเวลา</th><th>หมายเหตุ</th><th>รูป</th><th></th></tr>";
  const cols = full ? 9 : 6;
  const body = groups
    .map((g) => {
      const rows = g.items
        .map((r) => {
          const tag = r.attended === true ? "badge badge-success" : "badge badge-neutral";
          const attend = `<span class="${tag}">${escapeHtml(reportAttendLabel(r))}</span>`;
          const open = `<button type="button" class="btn btn-secondary btn-sm" data-report-open="${escapeHtml(r.date)}">เปิด / แก้ไข</button>`;
          const photos = (r.photos || []).length || "-";
          const mark = highlightDate && r.date === highlightDate ? ' class="report-row-new"' : "";
          return full
            ? `<tr${mark}><td class="emphasis">${escapeHtml(shortDate(r.date))}</td><td>${escapeHtml(r.coachName ?? "-")}</td><td>${attend}</td><td>${escapeHtml(reportPeriodLabel(r))}</td><td>${escapeHtml(r.notes ?? "-")}</td><td>${locationHtml(r.location)}</td><td>${photos}</td><td>${escapeHtml(submittedLabel(r))}</td><td>${open}</td></tr>`
            : `<tr${mark}><td class="emphasis">${escapeHtml(shortDate(r.date))}</td><td>${attend}</td><td>${escapeHtml(reportPeriodLabel(r))}</td><td>${escapeHtml(r.notes ?? "-")}</td><td>${photos}</td><td>${open}</td></tr>`;
        })
        .join("");
      return `<tr class="match-divider"><td colspan="${cols}">${escapeHtml(thaiMonthLabel(g.month))} · ${g.items.length} รายงาน</td></tr>${rows}`;
    })
    .join("");
  return `<div class="card table-wrap"><table class="pro-table report-history-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
