// ตรรกะบันทึกการเช็คชื่อ/ให้คะแนนแบบ "อัปเดตหน้าจอทันที แล้วเขียนเบื้องหลัง" — แยกออกมาเป็นโมดูลที่ไม่พึ่ง Firebase/DOM
// เพื่อเทสต์ใน Node ได้ (tests/attendance-save.test.mjs)
//
// เดิมทุกครั้งที่โค้ชแตะปุ่มสถานะ/คะแนน หน้าจอจะรอเซิร์ฟเวอร์ตอบก่อนถึงจะอัปเดตปุ่ม — สัญญาณอ่อนที่สนามจึงเห็นปุ่มค้าง
// แตะซ้ำ และแตะสองหมวดของนักกีฬาคนเดียวติดกันเร็วๆ ทำให้ค่าที่เพิ่งแตะตัวแรกหายจากหน้าจอ (แต่ละครั้งคำนวณคะแนนจาก
// สำเนาเก่าที่ยังไม่รวมการแตะก่อนหน้า) ตอนนี้: คำนวณค่าใหม่จากสถานะบนหน้าจอปัจจุบันทันทีและแสดงเลย ส่วนการเขียน Firestore
// ต่อคิวรายนักกีฬาให้เรียงลำดับเดียวกับที่แตะ และนับจำนวนรายการที่ยังรอส่งไว้แจ้งผู้ใช้

// สถานะของนักกีฬาหนึ่งคนหลังการแตะหนึ่งครั้ง (ไม่แก้ค่าเดิม)
// change = { status } หรือ { category, value } — ให้คะแนนได้เฉพาะสถานะ "มา (A)" ถ้าเปลี่ยนเป็น I/R/P ล้างคะแนนเก่าทิ้ง
export function applyAttendanceChange(prev, change, now = () => new Date()) {
  const base = prev || {};
  const updatedAt = { toDate: now };
  if ("status" in change) {
    const next = { ...base, status: change.status, updatedAt };
    if (change.status !== "A") next.scores = {};
    // injuryReportId = ลิงก์ไปรายงานบาดเจ็บที่ทำให้สถานะเป็น I/R (null = ล้างลิงก์ ไม่ส่งมา = ไม่แตะค่าเดิม)
    if ("injuryReportId" in change) next.injuryReportId = change.injuryReportId;
    return next;
  }
  return { ...base, scores: { ...(base.scores || {}), [change.category]: change.value }, updatedAt };
}

// ฟิลด์ที่ต้อง merge ลง Firestore สำหรับการแตะหนึ่งครั้ง — คะแนนเขียนเฉพาะหมวดที่แตะ (merge ซ้อนใน map เดิม) ไม่เขียนทั้ง
// map ทับ กันเขียนทับคะแนนหมวดอื่นที่เพิ่งบันทึกจากอีกเครื่อง/การแตะก่อนหน้าที่ยังไม่เสร็จ ส่วน scores: {} ตอนเปลี่ยนเป็น
// I/R/P ตั้งใจให้แทนที่ทั้ง map ด้วยค่าว่าง (SDK ใส่ path ที่เป็น map ว่างเข้า field mask จึงล้างของเดิมจริง)
export function firestoreFieldsForChange(change) {
  if ("status" in change) {
    const fields = change.status !== "A" ? { status: change.status, scores: {} } : { status: change.status };
    if ("injuryReportId" in change) fields.injuryReportId = change.injuryReportId;
    return fields;
  }
  return { scores: { [change.category]: change.value } };
}

// คิวเขียนแบบเรียงลำดับต่อ key (เช่น sessionId_playerId): งานของ key เดียวกันรันทีละงานตามลำดับที่ใส่เข้ามา
// ส่วนต่าง key รันพร้อมกันได้ งานที่ล้มเหลวไม่ทำให้คิวหยุด (เรียก onError แล้วทำงานถัดไปต่อ)
// onChange(pending) ถูกเรียกทุกครั้งที่จำนวนรายการที่ยังไม่เสร็จเปลี่ยน
export function createSaveQueue({ onChange = () => {}, onError = () => {} } = {}) {
  const chains = new Map();
  let pending = 0;

  function enqueue(key, task) {
    pending++;
    onChange(pending);
    const previous = chains.get(key) || Promise.resolve();
    const run = previous
      .then(() => task())
      .catch((err) => {
        onError(err, key);
      })
      .then(() => {
        pending--;
        if (chains.get(key) === run) chains.delete(key);
        onChange(pending);
      });
    chains.set(key, run);
    return run;
  }

  return {
    enqueue,
    get pending() {
      return pending;
    },
    // รอจนทุกงานที่อยู่ในคิวตอนนี้เสร็จ
    idle: () => Promise.all([...chains.values()])
  };
}

// สถานะการล็อกตารางเช็คชื่อ: ประเมินครบทุกคนแล้ว "ในวันฝึกซ้อมนั้น" ยังแก้ไขได้จนสิ้นวัน (เวลาไทย) เพื่อให้โค้ชแก้ที่แตะพลาด
// ได้ (เดิมล็อกทันทีที่แตะช่องสุดท้าย แก้เองไม่ได้ ต้องพึ่งผู้ดูแลระบบ) พ้นวันแล้วถึงล็อกเป็นดูอย่างเดียว — ผู้ดูแลระบบไม่ถูกล็อก
// คืนค่า "editable" (ยังประเมินไม่ครบ/ผู้ดูแลระบบ) | "complete-editable" (ครบแล้วแต่ยังแก้ได้วันนี้) | "locked"
// sessionDate/today เป็นสตริง "YYYY-MM-DD" เทียบแบบตัวอักษรได้
export function rosterLockState({ complete, sessionDate, today, isAdmin }) {
  if (isAdmin || !complete) return "editable";
  return sessionDate && sessionDate < today ? "locked" : "complete-editable";
}
