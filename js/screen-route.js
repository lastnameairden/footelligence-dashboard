// "หน้าจอปัจจุบัน" ของ attendance.html ที่เก็บไว้ใน URL hash เพื่อให้กดรีเฟรชแล้วกลับมาอยู่หน้าเดิม — หน้านี้เป็นหน้าเดียวที่สลับ
// หลายจอด้วยการซ่อน/แสดง (เช็คชื่อ รายงาน แผนฝึก แผงผู้ดูแลระบบ ฯลฯ) ซึ่งเดิมไม่มีอะไรใน URL บอกว่าอยู่จอไหน รีเฟรชแล้วจึงเด้งกลับหน้าแรก
// (โค้ช → Daily, ผู้ดูแลระบบที่สวมบทบาทอยู่ → หลุดออกไป Dashboard) โมดูลนี้ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้
//
// รูปแบบ hash (ใช้ hash ไม่ใช่ query string เหตุผลเดียวกับที่เขียนไว้ใน attendance.js: เซิร์ฟเวอร์ทดสอบในเครื่องตัด query ทิ้งตอน redirect)
//   โค้ช/ผู้ใช้ทั่วไป:               screen=<checkin|report|...>[&d=YYYY-MM-DD]
//   ผู้ดูแลระบบ (แผงควบคุม):         admin=<coaches|progress|...>         ← รูปแบบเดิมของ deep link ทั้งหมด ใช้ต่อได้เหมือนเดิม
//   ผู้ดูแลระบบสวมบทบาทจัดการทีม:   admin=team&team=<ทีม>&as=<coach|executive>[&coach=<id>][&ret=<coaches|manage-team>][&screen=..][&d=..]

export const COACH_SCREEN_KEYS = ["daily", "checkin", "report", "match", "injury", "plan", "players"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidRouteDate(value) {
  return typeof value === "string" && DATE_RE.test(value);
}

// route = { admin?, team?, as?, coach?, ret?, screen?, date? } → สตริง hash (ไม่มี #) คืน "" ถ้าไม่มีอะไรจะเก็บ
export function buildRouteHash(route) {
  if (!route) return "";
  const params = new URLSearchParams();
  if (route.admin === "team") {
    params.set("admin", "team");
    if (route.team) params.set("team", route.team);
    if (route.as) params.set("as", route.as);
    if (route.coach) params.set("coach", route.coach);
    if (route.ret) params.set("ret", route.ret);
    if (route.screen) params.set("screen", route.screen);
    if (isValidRouteDate(route.date)) params.set("d", route.date);
  } else if (route.admin) {
    params.set("admin", route.admin);
  } else if (route.screen) {
    params.set("screen", route.screen);
    if (isValidRouteDate(route.date)) params.set("d", route.date);
  }
  return params.toString();
}

// hash (มีหรือไม่มี # นำหน้าก็ได้) → route ที่ตรวจรูปแบบพื้นฐานแล้ว (as ต้องเป็น coach/executive, d ต้องเป็นวันที่) ส่วนค่า
// ที่ต้องเทียบกับข้อมูลจริง (ชื่อทีม, key ของหน้าจอ) ให้ผู้เรียกตรวจเอง
export function parseRouteHash(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const as = params.get("as");
  const date = params.get("d");
  return {
    admin: params.get("admin") || null,
    team: params.get("team") || null,
    as: as === "coach" || as === "executive" ? as : null,
    coach: params.get("coach") || null,
    ret: params.get("ret") || null,
    screen: params.get("screen") || null,
    date: isValidRouteDate(date) ? date : null
  };
}
