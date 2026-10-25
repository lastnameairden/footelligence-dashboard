import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyBlock, graphOf, htmlPages } from "../tools/modulepreload.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every page's modulepreload block matches the modules it really imports (run: node tools/modulepreload.mjs)", () => {
  for (const page of htmlPages()) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.equal(applyBlock(html), html, `${page} is out of date`);
  }
});

test("module graph: the entry and its dependencies are listed once each, Firebase SDK files come from gstatic", () => {
  const { local, remote } = graphOf("js/attendance.js");
  assert.equal(local[0], "js/attendance.js");
  assert.equal(new Set(local).size, local.length);
  assert.ok(local.includes("js/team-events-ui.js") && local.includes("js/photo-upload.js") && local.includes("js/firebase-init.js"));
  assert.ok(remote.length >= 3 && remote.every((u) => u.startsWith("https://www.gstatic.com/firebasejs/")));
  for (const f of local) assert.ok(fs.existsSync(path.join(root, f)), `${f} does not exist`);
});
