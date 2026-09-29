import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { icon, ICON_NAMES } from "../js/icons.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsFiles = fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js"));

test("icon() renders a real <svg> for a known name and falls back for an unknown one", () => {
  assert.match(icon("bell"), /^<svg /);
  assert.match(icon("bell"), /<\/svg>$/);
  assert.notEqual(icon("bell"), icon("search"));
  assert.equal(icon("this-name-does-not-exist"), icon("alert-triangle"));
});

test("icon() is sized in em and colored via currentColor, so it drops into any icon-badge/button unchanged", () => {
  const svg = icon("shield");
  assert.match(svg, /width="1em"/);
  assert.match(svg, /height="1em"/);
  assert.match(svg, /stroke="currentColor"/);
});

// เคยเกิดปัญหานี้จริงตอนเปลี่ยนจากอิโมจิมาเป็นไอคอน: เรียก icon("ชื่อที่สะกดผิด") แล้วไม่มี error ให้เห็น กลายเป็น
// ไอคอนสามเหลี่ยมเตือน (ค่า fallback) เงียบๆ แทน — เทสต์นี้ไล่หาทุกจุดที่เรียก icon("...") ในซอร์สจริงแล้วเช็คว่า
// ชื่อที่เรียกมีอยู่จริงในทะเบียน ICON_NAMES ทุกตัว
test("every icon(\"name\") call across js/*.js uses a name that actually exists", () => {
  const used = new Set();
  for (const file of jsFiles) {
    const text = fs.readFileSync(path.join(root, "js", file), "utf8");
    for (const m of text.matchAll(/\bicon\(\s*"([a-z0-9-]+)"\s*[,)]/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10, "expected to find many icon(\"...\") call sites — did the source move?");
  const unknown = [...used].filter((name) => !ICON_NAMES.includes(name));
  assert.deepEqual(unknown, []);
});
