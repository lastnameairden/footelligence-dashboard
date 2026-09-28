// ตัวจำลอง firebase-firestore.js: ฟังก์ชันสร้าง query คืนโครงสร้างธรรมดาให้เทสต์ตรวจได้ว่า query ประกอบถูกไหม
// (เช่น ต้องมี where("team","==",...) เสมอ ตามกฎ rules) ไม่ได้ต่อ Firestore จริง
export const collection = (db, name) => ({ type: "collection", name });
export const where = (field, op, value) => ({ type: "where", field, op, value });
export const query = (source, ...constraints) => ({ type: "query", source, constraints });
export const doc = (db, ...path) => ({ type: "doc", path });
export const serverTimestamp = () => ({ type: "serverTimestamp" });
export const addDoc = async () => ({ id: "stub" });
export const setDoc = async () => {};
export const getDocs = async () => ({ docs: [], forEach() {} });
