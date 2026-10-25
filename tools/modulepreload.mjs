// สร้างรายการ <link rel="modulepreload"> ของแต่ละหน้า HTML จากโมดูลที่หน้านั้นนำเข้าจริง — ให้เบราว์เซอร์เริ่มโหลดทุกไฟล์พร้อมกันตั้งแต่ต้น
// แทนการรอไล่ตาม import ทีละชั้น (ไฟล์ละรอบการเชื่อมต่อ) ใช้: node tools/modulepreload.mjs (เขียนทับบล็อกระหว่างคอมเมนต์ modulepreload:start/end)
// มีเทสต์ (tests/modulepreload.test.mjs) ตรวจว่าบล็อกตรงกับโมดูลที่นำเข้าจริงเสมอ — เพิ่ม/ลบ import แล้วเทสต์ล้มให้รันคำสั่งนี้
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const START = "<!-- modulepreload:start (สร้างด้วย node tools/modulepreload.mjs ห้ามแก้ด้วยมือ) -->";
const END = "<!-- modulepreload:end -->";
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\b[^;'"]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// โมดูลภายในโปรเจกต์ + ไฟล์ Firebase SDK ที่ entry นำเข้า (ตาม import แบบ static เท่านั้น) เรียงตามลำดับที่พบ
export function graphOf(entryRel) {
  const local = [];
  const remote = [];
  const visit = (rel) => {
    if (local.includes(rel)) return;
    local.push(rel);
    for (const m of read(rel).matchAll(STATIC_IMPORT)) {
      const spec = m[1] ?? m[2];
      if (/^https:\/\/www\.gstatic\.com\//.test(spec)) {
        if (!remote.includes(spec)) remote.push(spec);
      } else if (spec.startsWith("./") || spec.startsWith("../")) {
        visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
      }
    }
  };
  visit(entryRel);
  return { local, remote };
}

export function blockFor(html) {
  const entry = /<script type="module" src="\.\/(js\/[^"]+)"/.exec(html)?.[1];
  if (!entry) return null;
  const { local, remote } = graphOf(entry);
  const links = [...remote, ...local.map((f) => `./${f}`)].map((href) => `  <link rel="modulepreload" href="${href}" />`);
  return `${START}\n${links.join("\n")}\n  ${END}`;
}

// ใส่/แทนที่บล็อกใน <head> ต่อท้ายลิงก์ styles.css (Tailwind ต้องเป็นองค์ประกอบสุดท้ายของ head ตามเทสต์ site-integrity จึงใส่ก่อนหน้านั้น)
// คืน html ใหม่ (หน้าที่ไม่มีสคริปต์ module คืนเดิม)
const STYLES_LINK = `<link rel="stylesheet" href="./css/styles.css" />`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function applyBlock(html) {
  const block = blockFor(html);
  if (!block) return html;
  const stripped = html.replace(new RegExp(`\\n?[ \\t]*${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`), "");
  if (!stripped.includes(STYLES_LINK)) throw new Error("ไม่พบลิงก์ styles.css สำหรับวางบล็อก modulepreload");
  return stripped.replace(STYLES_LINK, () => `${STYLES_LINK}\n  ${block}`);
}

export const htmlPages = () => fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const page of htmlPages()) {
    const before = read(page);
    const after = applyBlock(before);
    if (after !== before) fs.writeFileSync(path.join(ROOT, page), after);
    console.log(`${page}: ${after === before ? "ไม่เปลี่ยน" : "อัปเดตแล้ว"}`);
  }
}
