// รายการแจ้งเตือนของโค้ชนอกเหนือจากนัดประชุม/งานหลังประชุม (ดู coach-meetings-ui.js): สมุดพกเปิดให้ดู · รอบทดสอบสมรรถภาพเปิดกรอก · ข้อความจากผู้ดูแลระบบที่ยังไม่อ่าน
// ตรรกะล้วนๆ (ไม่พึ่ง DOM/Firebase) คืนรายการรูปแบบเดียวกับที่ renderAdminNotifications ใช้ { key, icon, level, read, title, detail, link } หรือ null เมื่อไม่มีอะไรต้องแจ้ง
// link เป็น "./attendance.html#screen=<หน้าจอของโค้ช>" — attendance.js ดักการกดแล้วเปิดหน้าจอนั้นในหน้าเดิม (ไม่โหลดหน้าใหม่)
import { icon } from "./icons.js";
import { currentEntryRound, roundLabel, roundState } from "./fitness-calc.js";
import { coachAccessModel, dateLabel, daysLeft, windowLabel } from "./athlete-windows.js";
import { escapeHtml } from "./ui-utils.js";

export const screenLink = (screen) => `./attendance.html#screen=${screen}`;

// สมุดพก (Athlete Results) ที่ผู้ดูแลเปิดให้ทีมนี้ดูอยู่ — ช่วงที่ปิดเร็วที่สุดขึ้นก่อน
export function athleteResultsNotification(windows, team, todayStr) {
  const access = coachAccessModel(windows, team, todayStr);
  if (access.kind !== "open") return null;
  const w = access.windows[0];
  const left = daysLeft(w, todayStr);
  return {
    key: "coach_athlete_results",
    icon: icon("book"),
    level: "action",
    read: true,
    title: "สมุดพกเปิดให้ดูแล้ว",
    detail: `ช่วง ${escapeHtml(windowLabel(w))} · ถึง ${escapeHtml(dateLabel(w.closeDate))} (${left === 0 ? "วันสุดท้าย" : `เหลือ ${left} วัน`})`,
    link: screenLink("athlete-results")
  };
}

// รอบทดสอบสมรรถภาพที่เปิดกรอกอยู่ (open หรือช่วงทดสอบซ่อม) — ไม่แจ้งรอบที่ยังไม่ถึงวันเปิดหรือปิดแล้ว
export function fitnessRoundNotification(rounds, todayStr) {
  const round = currentEntryRound(rounds, todayStr);
  if (!round) return null;
  const makeup = roundState(round, todayStr) === "makeup";
  return {
    key: "coach_fitness_round",
    icon: icon("trending-up"),
    level: "action",
    read: true,
    title: "รอบทดสอบสมรรถภาพเปิดอยู่",
    detail: `${escapeHtml(roundLabel(round))} · ${makeup ? `ทดสอบซ่อมได้ถึง ${escapeHtml(dateLabel(round.makeupUntil))}` : `กรอกผลได้ถึง ${escapeHtml(dateLabel(round.closeDate))}`}`,
    link: screenLink("fitness")
  };
}

const ts = (n) => (n.createdAt && typeof n.createdAt.toDate === "function" ? n.createdAt.toDate().getTime() : 0);

// ข้อความจากผู้ดูแลระบบที่ยังไม่ได้ทำเครื่องหมายว่าอ่าน (notes = executiveNotes ของทีม)
export function unreadNotesNotification(notes) {
  const unread = notes.filter((n) => !n.read).sort((a, b) => ts(b) - ts(a));
  if (unread.length === 0) return null;
  const latest = unread[0];
  return {
    key: "coach_admin_notes",
    icon: icon("mail"),
    level: "action",
    read: true,
    title: `ข้อความใหม่จากผู้ดูแลระบบ ${unread.length} รายการ`,
    detail: `ล่าสุด: ${escapeHtml(latest.refLabel ?? String(latest.message ?? "-").slice(0, 60))}`,
    link: screenLink("daily")
  };
}
