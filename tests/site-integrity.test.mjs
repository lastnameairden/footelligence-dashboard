// เช็คโครงสร้างของเว็บแบบ static (ไม่ต้องเปิดเบราว์เซอร์/ต่อ Firebase) — กันความผิดพลาดที่ผ่านมาซ้ำ:
// ลืม build Tailwind ใหม่, ใส่ inline handler ที่ CSP บล็อก, ลืมใส่ลิงก์ CSS ฯลฯ
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const htmlFiles = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
const jsFiles = fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`);

test("found the pages and scripts to check", () => {
  assert.ok(htmlFiles.length >= 7, `expected at least 7 html pages, found ${htmlFiles.length}`);
  assert.ok(jsFiles.length >= 8);
});

test("every page links the built Tailwind CSS as the last element of <head> and no CDN", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.ok(!/cdn\.tailwindcss\.com/.test(html), `${file} still references the Tailwind CDN`);
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    const lastTag = [...head.matchAll(/<(link|style|script|meta|title)\b[^>]*>/g)].pop()[0];
    assert.ok(/href="\.\/css\/tailwind\.css"/.test(lastTag), `${file}: tailwind.css must be the last tag in <head> (cascade order)`);
  }
});

// CSP ของ vercel.json บล็อก inline event handler และ javascript: URL — โค้ดที่ใส่มาจะ "เงียบ" ไม่ทำงานบนเว็บจริง
test("no inline event-handler attributes or javascript: URLs (blocked by the CSP)", () => {
  const handler = /\son(click|change|input|submit|error|load|keyup|keydown|focus|blur|mouseover)=["'\\]/i;
  for (const file of [...htmlFiles, ...jsFiles]) {
    const text = read(file);
    assert.ok(!handler.test(text), `${file} contains an inline event handler`);
    assert.ok(!/["'`]\s*javascript:/i.test(text), `${file} contains a javascript: URL`);
  }
});

// getElementById("x") ที่หา id ไม่เจอจะได้ null แล้วสคริปต์พังทั้งหน้าตอนโหลด (เช่น เพิ่มตัวแปรใน JS แต่ลืมเพิ่ม element ใน HTML)
// เช็คเฉพาะ id ที่ระบุเป็นสตริงตรงๆ — id ที่สร้างตอนรันผ่านเทมเพลต (innerHTML) ไม่นับ จึงใช้ได้กับ id ที่ประกาศตอนโหลดหน้า
const PAGE_OF_SCRIPT = {
  "js/attendance.js": "attendance.html",
  "js/app.js": "index.html",
  "js/masc.js": "masc.html",
  "js/print.js": "print.html",
  "js/report-card.js": "report-card.html",
  "js/player.js": "player.html",
  "js/development.js": "development.html"
};
test("every getElementById id used by a page script exists in that page's HTML", () => {
  for (const [script, page] of Object.entries(PAGE_OF_SCRIPT)) {
    const html = read(page);
    const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const missing = [...new Set([...read(script).matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]))]
      .filter((id) => !declared.has(id));
    assert.deepEqual(missing, [], `${script} looks up ids that are not in ${page}`);
  }
});

// "วันนี้/เดือนนี้" ต้องมาจาก todayBangkok()/thisMonthBangkok() ใน ui-utils.js เท่านั้น — new Date().toISOString() เป็นเวลา UTC
// (00:00-07:00 น. เวลาไทยจะได้ "เมื่อวาน") เคยทำให้วันที่เริ่มต้นของเช็คชื่อ/รายงาน/แผนฝึกและรอบ MASC เพี้ยน
test("no UTC-based today/this-month in the app code (use todayBangkok / thisMonthBangkok)", () => {
  for (const file of jsFiles.filter((f) => f !== "js/ui-utils.js")) {
    const text = read(file);
    assert.ok(!/toISOString\(\)\s*\.slice\(\s*0\s*,\s*(10|7)\s*\)/.test(text), `${file} derives a date/month from UTC — use todayBangkok()/thisMonthBangkok()`);
  }
});

test("vercel.json CSP keeps scripts locked down", () => {
  const vj = JSON.parse(read("vercel.json"));
  const headers = Object.fromEntries(vj.headers[0].headers.map((h) => [h.key, h.value]));
  const csp = headers["Content-Security-Policy"];
  const scriptSrc = csp.match(/script-src([^;]*)/)[1];
  assert.ok(!/unsafe-inline|unsafe-eval/.test(scriptSrc), "script-src must not allow inline/eval");
  assert.ok(/frame-ancestors 'none'/.test(csp));
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
});

// class ที่ใช้ใน HTML/JS ต้องมีนิยามใน css/tailwind.css หรือ css/styles.css หรือ <style> ของหน้านั้น ถ้าไม่มี
// แปลว่าเพิ่ม Tailwind class ใหม่แล้วลืม build (คำสั่งอยู่ที่หัวไฟล์ tailwind.config.js)
// รายการนี้คือ class ที่ใช้เป็น "ชื่ออ้างอิงให้ JS" ไม่มีสไตล์จริง
const NON_STYLING_HOOKS = new Set(["edit-coach-age-group-checkbox", "register-age-group-checkbox", "pagination-controls"]);

test("every class used in HTML/JS is defined in the CSS", () => {
  let css = read("css/tailwind.css") + read("css/styles.css");
  for (const file of htmlFiles) {
    for (const m of read(file).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += m[1];
  }
  const esc = (tok) => tok.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  const missing = new Map();
  for (const file of [...htmlFiles, ...jsFiles]) {
    for (const m of read(file).matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g)) {
      const value = m[1].replace(/\$\{[^}]*\}/g, " ");
      for (const tok of value.split(/\s+/).filter(Boolean)) {
        if (!/^[a-zA-Z!\[-][\w:\/\[\]%.#(),_-]*$/.test(tok)) continue;
        if (NON_STYLING_HOOKS.has(tok) || css.includes("." + esc(tok))) continue;
        if (!missing.has(tok)) missing.set(tok, new Set());
        missing.get(tok).add(file);
      }
    }
  }
  const report = [...missing].map(([tok, files]) => `${tok} (${[...files].join(", ")})`);
  assert.deepEqual(report, [], "classes with no CSS — rebuild css/tailwind.css (see tailwind.config.js)");
});

// เกณฑ์ "ประเมิน MASC ครบ" เคยถูกเขียนซ้ำ 3 ไฟล์ (เสี่ยงคิดไม่ตรงกัน) — ตอนนี้อยู่ที่ masc-data.js ที่เดียว
test("isEvaluationComplete is defined only in masc-data.js", () => {
  for (const file of jsFiles) {
    const defines = /function\s+isEvaluationComplete\b/.test(read(file));
    assert.equal(defines, file === "js/masc-data.js", `${file}: isEvaluationComplete must be imported from masc-data.js, not redefined`);
  }
});

test("Firestore/Storage rules never open everything up", () => {
  for (const file of ["firestore.rules", "storage.rules"]) {
    const rules = read(file);
    assert.ok(!/allow[^;]*:\s*if\s+true\s*;/.test(rules), `${file} has an "if true" rule`);
    assert.ok(!/match\s*\/\{document=\*\*\}/.test(rules), `${file} has a catch-all match`);
  }
  // หมายเหตุ: storage.rules ตอนนี้กลับไปเป็นแบบ "ล็อกอินแล้วก็พอ" (ไม่แยกทีม) ชั่วคราว หลังเวอร์ชันที่เช็คทีมผ่าน
  // firestore.get() ทำให้โค้ชอัปโหลดรูปรายงานไม่ได้ (storage/unauthorized) — เมื่อแก้ตัวเช็คทีมสำเร็จแล้ว ให้เพิ่ม
  // assertion กลับ: ห้าม "allow read"/"allow write" รวม, ต้องมี "allow list: if false" ทุกโฟลเดอร์
});

test("Firestore indexes file is valid JSON with the composite team+date indexes", () => {
  const idx = JSON.parse(read("firestore.indexes.json"));
  assert.ok(Array.isArray(idx.indexes) && idx.indexes.length >= 6);
  for (const i of idx.indexes) {
    assert.deepEqual(i.fields.map((f) => f.fieldPath), ["team", "date"], `unexpected index on ${i.collectionGroup}`);
  }
});
