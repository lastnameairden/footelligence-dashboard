import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPerfLine, settledMs } from "../js/perf-math.js";

test("settledMs: time until the last change, never negative, 0 when nothing happened", () => {
  assert.equal(settledMs(100, [120, 480.4, 300]), 380);
  assert.equal(settledMs(100, []), 0);
  assert.equal(settledMs(100, [90]), 0);
});

test("formatPerfLine: label, ms, requests and KB with one decimal", () => {
  assert.equal(formatPerfLine({ label: "attendance-grid", ms: 420, requests: 5, bytes: 39322 }), "attendance-grid · 420 ms · 5 คำขอ · 38.4 KB");
  assert.equal(formatPerfLine({ label: "x", ms: 0, requests: 0, bytes: 0 }), "x · 0 ms · 0 คำขอ · 0 KB");
});