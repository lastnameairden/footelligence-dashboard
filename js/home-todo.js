// "งานที่ต้องดำเนินการ" บนหน้า Home ของโค้ช — รวมงานค้างทุกชนิดเป็นการ์ดใบละงานในแถบเลื่อน (carousel) ที่โค้ชเลื่อนเอง
// ตรรกะล้วนๆ (สร้างรายการ + HTML + คำนวณตำแหน่ง) ไม่แตะ DOM/Firestore — การดึงข้อมูลและผูกปุ่มอยู่ที่ attendance.js
// งานที่ทำเสร็จแล้วไม่ถูกส่งเข้ามาตั้งแต่ต้น จึงไม่แสดง (ผู้เรียกดึงเฉพาะงานที่ยังค้าง)

import { escapeHtml } from "./ui-utils.js";
import { icon } from "./icons.js";

// งานประจำวัน (key = ตัวระบุที่ attendance.js ผูกกับหน้าที่ต้องเปิด)
const DAILY = {
  checkin: { icon: "check-circle", title: "ยังไม่ได้เช็คชื่อการฝึกซ้อมวันนี้", detail: "เช็คชื่อและให้คะแนนนักกีฬาของรุ่นที่ดูแล" },
  plan: { icon: "book", title: "ยังไม่ได้ส่งแผนการฝึกซ้อมวันนี้", detail: "วันนี้เป็นวันซ้อมปกติของทีม" },
  report: { icon: "file-text", title: "ยังไม่ได้ส่งรายงานการฝึกซ้อมวันนี้", detail: "ส่งหลังซ้อมเสร็จ" }
};

// daily = ["checkin","plan","report"] เฉพาะที่ยังค้าง · event = { monthLabel, deadlineLabel, leftText } หรือ null
// meetingTasks = [{ dateLabel, deadlineLabel, leftText, overdue }] · notes = [{ id, refLabel, message, type, createdBy, postedAt }] (ยังไม่อ่าน)
// ลำดับ: งานประจำวัน → Event → งานหลังประชุม → ข้อความที่ยังไม่อ่าน
export function buildTodoItems({ daily = [], event = null, meetingTasks = [], notes = [] } = {}) {
  const items = [];
  for (const key of daily) {
    const d = DAILY[key];
    if (d) items.push({ key: `daily-${key}`, tone: "warning", icon: d.icon, title: d.title, detail: d.detail, meta: "", actions: [{ label: "ไปทำเลย →", go: key }] });
  }
  if (event) {
    items.push({
      key: "event",
      tone: "warning",
      icon: "trophy",
      title: `ยังไม่ได้แจ้ง Event ของเดือน${event.monthLabel}`,
      detail: `กรอกภายใน ${event.deadlineLabel} · ${event.leftText}`,
      meta: "",
      actions: [{ label: "ไปกรอกเลย →", go: "event" }]
    });
  }
  meetingTasks.forEach((t, i) => {
    items.push({
      key: `meeting-${i}`,
      tone: "warning",
      icon: "users",
      title: `งานหลังประชุมเมื่อ ${t.dateLabel}`,
      detail: `ยังไม่ส่ง · ${t.overdue ? "เลยกำหนดแล้ว" : t.leftText} (ส่งได้ถึง ${t.deadlineLabel})`,
      meta: "",
      actions: [{ label: "ไปกรอกเลย →", go: "meeting" }]
    });
  });
  for (const n of notes) {
    const actions = [];
    if (n.type === "masc_round") actions.push({ label: "ไปประเมิน →", go: "masc" });
    actions.push({ label: "อ่านแล้ว", readId: n.id });
    items.push({
      key: `note-${n.id}`,
      tone: "info",
      icon: "mail",
      title: n.refLabel || "ข้อความจากผู้ดูแลระบบ",
      detail: n.message || "-",
      meta: `จาก ${n.createdBy || "ผู้ดูแลระบบ"} • ${n.postedAt || "-"}`,
      actions
    });
  }
  return items;
}

// ตำแหน่งการ์ดที่อยู่หน้าสุดตอนนี้ (step = ความกว้างการ์ด + ช่องว่าง) — ใช้ขึ้นตัวนับ/จุดบอกตำแหน่ง
export function todoIndex(scrollLeft, step, count) {
  if (count <= 0 || !(step > 0)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / step)));
}

export const todoCountText = (index, count) => `${index + 1} / ${count}`;

function cardHtml(item, single) {
  const buttons = item.actions
    .map((a) =>
      a.readId !== undefined
        ? `<button type="button" class="btn btn-ghost btn-sm" data-todo-read="${escapeHtml(a.readId)}">อ่านแล้ว</button>`
        : `<button type="button" class="btn btn-secondary btn-sm" data-todo-go="${escapeHtml(a.go)}">${escapeHtml(a.label)}</button>`
    )
    .join("");
  return `<div class="todo-card todo-card-${item.tone}${single ? " todo-card-single" : ""}" data-todo-key="${escapeHtml(item.key)}">
    <p class="todo-card-title">${icon(item.icon)} ${escapeHtml(item.title)}</p>
    <p class="todo-card-detail">${escapeHtml(item.detail)}</p>
    ${item.meta ? `<p class="todo-card-meta">${escapeHtml(item.meta)}</p>` : ""}
    <div class="todo-actions">${buttons}</div>
  </div>`;
}

// กล่องทั้งหมด (หัว + แถบเลื่อน + จุด) — ไม่มีงานเลย = ข้อความ "ทำครบแล้ว"; มีใบเดียว = ไม่มีลูกศร/จุด
export function todoCarouselHtml(items) {
  if (items.length === 0) return '<p class="card card-pad text-sm text-emerald-700 font-medium">วันนี้ทำครบแล้ว ไม่มีงานค้าง</p>';
  const many = items.length > 1;
  const nav = many
    ? `<div class="todo-nav"><button type="button" class="btn btn-secondary btn-sm" data-todo-step="-1" aria-label="การ์ดก่อนหน้า">${icon("chevron-left")}</button><button type="button" class="btn btn-secondary btn-sm" data-todo-step="1" aria-label="การ์ดถัดไป">${icon("chevron-right")}</button></div>`
    : "";
  const dots = many ? `<div class="todo-dots" data-todo-dots>${items.map((_, i) => `<span class="todo-dot${i === 0 ? " todo-dot-on" : ""}"></span>`).join("")}</div>` : "";
  return `<div class="todo-bar">
      <p class="todo-title">${icon("bell")} งานที่ต้องดำเนินการ${many ? ` <span class="todo-count" data-todo-count>${todoCountText(0, items.length)}</span>` : ""}</p>
      ${nav}
    </div>
    <div class="todo-track" data-todo-track>${items.map((it) => cardHtml(it, !many)).join("")}</div>
    ${dots}`;
}
