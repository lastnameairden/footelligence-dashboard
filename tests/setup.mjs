// โหลดผ่าน `node --import ./tests/setup.mjs` — ทำให้ไฟล์ใน js/ ที่ import Firebase SDK จาก URL ของ gstatic
// (Node import URL https:// ไม่ได้) รันใน Node ได้ โดยสลับเป็นตัวจำลองใน tests/stubs/ แทน
// ต้องใช้ Node 22.15 ขึ้นไป (module.registerHooks)
import { registerHooks } from "node:module";

const firestoreStub = new URL("./stubs/firestore.mjs", import.meta.url).href;
const firebaseInitStub = new URL("./stubs/firebase-init.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("https://www.gstatic.com/firebasejs/") && specifier.endsWith("/firebase-firestore.js")) {
      return { url: firestoreStub, shortCircuit: true };
    }
    if (specifier === "./firebase-init.js") {
      return { url: firebaseInitStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
