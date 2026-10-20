// ตัวกรองรุ่นอายุของหน้าทีมสำหรับทีมหลังบ้าน (ตรรกะล้วนๆ) — "" = รวมทุกรุ่น, ไม่งั้นเป็นรหัสรุ่นเดียว เช่น "U12"
// สอดคล้องกับ myAgeGroups ในหน้าโค้ช: [] = ทุกรุ่น, [รุ่น] = เฉพาะรุ่นนั้น จึงใช้โมดูลของโค้ชต่อได้ทั้งหมด

// ค่าที่เก็บไว้ต้องยังมีอยู่ในรายการรุ่นของทีมนี้ ไม่งั้นกลับไปรวมทุกรุ่น
export function validFilter(value, available) {
  return available.includes(value) ? value : "";
}

export const ageGroupsForFilter = (value) => (value ? [value] : []);

// โค้ช/รายการที่ผูกกับหลายรุ่น ผ่านตัวกรองถ้าไม่ได้เลือกรุ่น หรือมีรุ่นที่เลือกอยู่ในรายการ
export function matchesAgeFilter(ageGroups, value) {
  return !value || (Array.isArray(ageGroups) && ageGroups.includes(value));
}
