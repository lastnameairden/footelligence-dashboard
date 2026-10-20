// ช่วงเวลาที่ผู้ดูแลระบบเปิดให้โค้ชดู "Athlete Results" (สมุดพกนักกีฬา) — ตรรกะล้วนๆ + HTML ตารางฝั่งแอดมิน (ไม่พึ่ง DOM/Firebase)
// เอกสาร athleteResultsWindows: { team: "ALL" | ชื่อทีม, startMonth, endMonth ("YYYY-MM" ช่วงของสมุดพก), openDate, closeDate (วันที่โค้ชเปิดดูได้ รวมวันปิด), status: "open" | "closed" }
// การล็อกนี้บังคับที่หน้าเว็บ (เมนูโค้ช + หน้า report-card.html) — แอดมินและทีมหลังบ้านเปิดได้ตลอด
import { daysBetween } from "./fitness-calc.js";
import { escapeHtml } from "./ui-utils.js";

export const ALL_TEAMS = "ALL";

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthParts = (m) => {
  const x = /^(\d{4})-(\d{2})$/.exec(String(m ?? ""));
  return x ? { y: Number(x[1]), m: Number(x[2]) } : null;
};

// "1 พ.ย. 2026" จาก "2026-11-01"
export function dateLabel(dateStr) {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ""));
  return x ? `${Number(x[3])} ${THAI_MONTHS_SHORT[Number(x[2]) - 1]} ${x[1]}` : "-";
}

// "ส.ค.–ต.ค. 2026" / "ธ.ค. 2025–ก.พ. 2026" / "ต.ค. 2026" (เดือนเดียว)
export function windowLabel(w) {
  const a = monthParts(w.startMonth);
  const b = monthParts(w.endMonth);
  if (!a || !b) return "-";
  if (a.y === b.y && a.m === b.m) return `${THAI_MONTHS_SHORT[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${THAI_MONTHS_SHORT[a.m - 1]}–${THAI_MONTHS_SHORT[b.m - 1]} ${a.y}`;
  return `${THAI_MONTHS_SHORT[a.m - 1]} ${a.y}–${THAI_MONTHS_SHORT[b.m - 1]} ${b.y}`;
}

// upcoming (ยังไม่ถึงวันเปิด) | open (โค้ชเปิดดูได้) | closed (พ้นวันปิด หรือแอดมินสั่งปิด)
export function windowState(w, todayStr) {
  if (w.status === "closed") return "closed";
  if (todayStr < w.openDate) return "upcoming";
  if (todayStr <= w.closeDate) return "open";
  return "closed";
}

export const windowAppliesTo = (w, team) => w.team === ALL_TEAMS || w.team === team;

export function openWindowsFor(windows, team, todayStr) {
  return windows
    .filter((w) => windowAppliesTo(w, team) && windowState(w, todayStr) === "open")
    .sort((a, b) => a.closeDate.localeCompare(b.closeDate) || b.endMonth.localeCompare(a.endMonth));
}

// ช่วงถัดไปที่ยังไม่ถึงวันเปิด (ไม่มี = null)
export function nextWindowFor(windows, team, todayStr) {
  return (
    windows
      .filter((w) => windowAppliesTo(w, team) && windowState(w, todayStr) === "upcoming")
      .sort((a, b) => a.openDate.localeCompare(b.openDate))[0] ?? null
  );
}

// เหลือกี่วัน (0 = วันสุดท้าย)
export const daysLeft = (w, todayStr) => Math.max(0, daysBetween(todayStr, w.closeDate));

// สมุดพกช่วง start–end ของทีมนี้เปิดให้โค้ชดูอยู่หรือไม่ — คืนช่วงที่เปิด (ไม่ใช่ = null) ต้องตรงทั้งเดือนเริ่มและเดือนสิ้นสุด
export function periodAllowed(windows, team, todayStr, start, end) {
  return openWindowsFor(windows, team, todayStr).find((w) => w.startMonth === start && w.endMonth === end) ?? null;
}

// สถานะที่หน้า Athlete Results ของโค้ชแสดง: { kind: "open", windows } | { kind: "closed", next }
export function coachAccessModel(windows, team, todayStr) {
  const open = openWindowsFor(windows, team, todayStr);
  return open.length > 0 ? { kind: "open", windows: open } : { kind: "closed", next: nextWindowFor(windows, team, todayStr) };
}

// ตรวจฟอร์มเปิดช่วง คืนข้อความ error (ไม่มี = null)
export function validateWindowForm({ team, startMonth, endMonth, openDate, closeDate }, windows = [], todayStr = "") {
  if (!team) return "เลือกทีม";
  if (!monthParts(startMonth) || !monthParts(endMonth)) return "เลือกช่วงเดือนของสมุดพก";
  if (startMonth > endMonth) return "เดือนเริ่มต้นต้องอยู่ก่อนหรือเท่ากับเดือนสิ้นสุด";
  if (!openDate || !closeDate) return "กำหนดวันที่เริ่มและวันสุดท้ายที่โค้ชเปิดดูได้";
  if (closeDate < openDate) return "วันสุดท้ายต้องไม่ก่อนวันเริ่ม";
  if (todayStr && closeDate < todayStr) return "วันสุดท้ายผ่านไปแล้ว";
  const dup = windows.find(
    (w) => w.team === team && w.startMonth === startMonth && w.endMonth === endMonth && w.status !== "closed" && !(todayStr && w.closeDate < todayStr) && openDate <= w.closeDate && w.openDate <= closeDate
  );
  if (dup) return "มีช่วงเปิดของสมุดพกช่วงนี้ที่ทับกันอยู่แล้ว ปิดอันเดิมก่อนหรือแก้วันที่";
  return null;
}

const STATE_BADGE = {
  open: ["badge-success", "กำลังเปิด"],
  upcoming: ["badge-warning", "ยังไม่ถึงวันเปิด"],
  closed: ["badge-neutral", "ปิดแล้ว"]
};

// ตารางฝั่งแอดมิน — ปุ่ม data-window-close / data-window-reopen / data-window-delete
export function windowsTableHtml(windows, todayStr) {
  if (windows.length === 0) return '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่เคยเปิดสมุดพกให้โค้ช</td></tr>';
  return [...windows]
    .sort((a, b) => String(b.openDate).localeCompare(String(a.openDate)))
    .map((w) => {
      const state = windowState(w, todayStr);
      const [cls, text] = STATE_BADGE[state];
      const manual = w.status === "closed";
      const id = escapeHtml(w.id);
      const toggle =
        state !== "closed" || (manual && todayStr <= w.closeDate)
          ? manual
            ? `<button type="button" class="btn btn-secondary btn-sm" data-window-reopen="${id}">เปิดอีกครั้ง</button>`
            : `<button type="button" class="btn btn-secondary btn-sm" data-window-close="${id}">ปิดเลย</button>`
          : "";
      return `<tr>
        <td class="emphasis">${w.team === ALL_TEAMS ? "ทุกทีม" : escapeHtml(w.team)}</td>
        <td>${escapeHtml(windowLabel(w))}</td>
        <td>${escapeHtml(dateLabel(w.openDate))} – ${escapeHtml(dateLabel(w.closeDate))}</td>
        <td><span class="badge ${cls}">${manual && state === "closed" ? "ปิดโดยแอดมิน" : text}</span></td>
        <td class="whitespace-nowrap">${toggle} <button type="button" class="btn btn-danger-soft btn-sm" data-window-delete="${id}">ลบ</button></td>
      </tr>`;
    })
    .join("");
}
