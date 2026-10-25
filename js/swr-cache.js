// แคชในหน้าเว็บแบบ "แสดงของเดิมก่อน แล้วโหลดของใหม่มาแทน" (stale-while-revalidate) — เปิดเมนูซ้ำแล้วเห็นข้อมูลทันที
// ระหว่างนั้นโหลดข้อมูลล่าสุดมาแทนเสมอ จึงไม่มีทางค้างข้อมูลเก่า (แคชอยู่ในหน้าเว็บเท่านั้น รีเฟรชหน้าแล้วล้าง) ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้
const store = new Map();

export const peek = (key) => store.get(key)?.value;
export const has = (key) => store.has(key);

// ล้างแคชทั้งหมด หรือเฉพาะคีย์ที่ขึ้นต้นด้วย prefix — เรียกเมื่อมีการเขียนข้อมูล เพื่อไม่ให้แสดงของเดิมที่เพิ่งถูกแก้
export function invalidate(prefix = "") {
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
}

// มีแคช: เรียก onData(ของเดิม, { stale: true }) ทันที แล้วโหลดใหม่ เรียก onData(ใหม่, { stale: false }) — ไม่มีแคช: โหลดแล้วเรียกครั้งเดียว
// โหลดไม่สำเร็จ: โยน error ต่อ (ของเดิมที่แสดงไปแล้วยังอยู่ ผู้เรียกตัดสินใจเองว่าจะแจ้งข้อผิดพลาดหรือไม่) — token กันผลของการโหลดที่ถูกแทนที่ด้วยการโหลดใหม่ของคีย์เดียวกัน
const latest = new Map();
export async function swr(key, fetcher, onData) {
  const token = (latest.get(key) ?? 0) + 1;
  latest.set(key, token);
  if (store.has(key)) onData(store.get(key).value, { stale: true });
  const value = await fetcher();
  if (latest.get(key) !== token) return; // มีการเรียกใหม่ของคีย์นี้ตามมา ให้ผลของครั้งหลังสุดเป็นตัวตัดสิน
  store.set(key, { value });
  onData(value, { stale: false });
}