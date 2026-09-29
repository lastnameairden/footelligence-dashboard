// ---------- ชุดไอคอนเส้น (inline SVG) แทนอิโมจิ ----------
// อิโมจิเรนเดอร์หน้าตาต่างกันในแต่ละอุปกรณ์/ระบบปฏิบัติการ (ฟอนต์อิโมจิของ Windows/Android/iOS ไม่เหมือนกัน)
// และทำให้ระบบดูไม่เป็นมืออาชีพ — ใช้ icon(name) แทนทุกจุดที่เคยใส่อิโมจิเป็นไอคอน (เมนู, หัวข้อหน้า, ปุ่มไอคอน,
// การแจ้งเตือน) ยกเว้นจุดที่อิโมจิ/สัญลักษณ์แทรกอยู่กลางข้อความสถานะสั้นๆ (เช่น "บันทึกแล้ว ✓") ซึ่งส่วนใหญ่เขียน
// ผ่าน .textContent (ใส่ HTML/SVG ไม่ได้อยู่แล้ว) ยังคงเป็นอิโมจิ/สัญลักษณ์เดิมไปก่อน
//
// ขนาดไอคอนอิง 1em เสมอ (width/height="1em") จึงปรับตาม font-size ของ element ที่ห่ออยู่ได้เหมือนตอนเป็นอิโมจิ
// สีอิง currentColor จึงรับสีจาก CSS ของ element ที่ห่อ (เช่น .icon-badge, .drawer-item) โดยอัตโนมัติ
const ICON_PATHS = {
  shield: '<path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  "trending-up": '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.3 2.3L16 10"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  "clipboard-list": '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h6M9 19h3"/>',
  "file-text": '<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="M8.5 12.5h7M8.5 16h7"/>',
  football: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3 2.2-1.1 3.6h-3.8L9 9.2 12 7Z"/><path d="M12 3v4M4.5 9l3.3 1M5 16.3l3-2.2M19.5 9l-3.3 1M19 16.3l-3-2.2M9.2 20l1.5-3.2M14.8 20l-1.5-3.2"/>',
  "heart-pulse": '<path d="M20 8.5c0 4-4 6.5-8 9.5-4-3-8-5.5-8-9.5A4.5 4.5 0 0 1 8.5 4c1.4 0 2.7.7 3.5 1.8C12.8 4.7 14.1 4 15.5 4A4.5 4.5 0 0 1 20 8.5Z"/><path d="M4.5 10H8l1.5-3L12 12l1.5-4 1 2h4.5"/>',
  dna: '<path d="M7 3c0 4 10 4 10 8s-10 4-10 8"/><path d="M17 3c0 4-10 4-10 8s10 4 10 8"/><path d="M8 7h8M8 12h8M8 17h8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.3c2.8.4 4.5 2.3 4.5 5.7"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/>',
  "user-plus": '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M18 8v4M16 10h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v6h-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  printer: '<rect x="6" y="9" width="12" height="7" rx="1"/><path d="M6 9V4h12v5"/><path d="M8 16v4h8v-4"/>',
  book: '<path d="M6 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V4Z"/><path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2"/><path d="M9 8h6"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9"/>',
  trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a1 1 0 0 0-1 1c0 2 1.5 3.5 3.5 3.8"/><path d="M16 5h3a1 1 0 0 1 1 1c0 2-1.5 3.5-3.5 3.8"/><path d="M12 12v3"/><path d="M8 20h8"/><path d="M9 17h6l1 3H8l1-3Z"/>',
  "alert-triangle": '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/>',
  send: '<path d="M4 11 20 4l-6 16-3-7-7-2Z"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  "bar-chart": '<path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  pin: '<path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
  edit: '<path d="M4 20h4L18 10l-4-4L4 16v4Z"/><path d="m14.5 5.5 4 4"/>',
  "trending-down": '<path d="m3 7 6 6 4-4 8 9"/><path d="M15 18h6v-6"/>',
  "x-circle": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  star: '<path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 17l-5.6 3 1.4-6.2L3 9.5l6.4-.6L12 3Z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6Z"/>',
  paperclip: '<path d="M8 12.5V6.5a4 4 0 0 1 8 0v9a2.5 2.5 0 0 1-5 0v-8"/>',
  link: '<path d="M9 15a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1"/><path d="M15 9a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1-1"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>'
};

// รายชื่อไอคอนที่มีจริง — ใช้ตรวจสอบใน tests/icons.test.mjs ว่าทุกจุดที่เรียก icon("ชื่อ") ทั่วโค้ด สะกดชื่อถูกต้อง
// (เรียกชื่อที่ไม่มีจริงจะไม่มี error ให้เห็นตอนรัน แค่เงียบๆ กลายเป็นรูปสามเหลี่ยมเตือนแทน จึงต้องมีเทสต์กันไว้)
export const ICON_NAMES = Object.keys(ICON_PATHS);

export function icon(name, extraAttrs = "") {
  const inner = ICON_PATHS[name] || ICON_PATHS["alert-triangle"];
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;flex-shrink:0" aria-hidden="true" ${extraAttrs}>${inner}</svg>`;
}
