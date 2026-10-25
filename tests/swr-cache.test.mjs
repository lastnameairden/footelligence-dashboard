import { test } from "node:test";
import assert from "node:assert/strict";
import { has, invalidate, peek, swr } from "../js/swr-cache.js";

test("first call: fetch once, show once (not stale)", async () => {
  invalidate();
  const seen = [];
  await swr("a:1", async () => "v1", (v, meta) => seen.push([v, meta.stale]));
  assert.deepEqual(seen, [["v1", false]]);
  assert.equal(peek("a:1"), "v1");
});

test("second call: cached value shown right away as stale, then replaced by the fresh one", async () => {
  invalidate();
  await swr("b:1", async () => "old", () => {});
  const seen = [];
  await swr("b:1", async () => "new", (v, meta) => seen.push([v, meta.stale]));
  assert.deepEqual(seen, [["old", true], ["new", false]]);
  assert.equal(peek("b:1"), "new");
});

test("invalidate drops everything or only a prefix, so a saved change is never shown as old data", async () => {
  invalidate();
  await swr("plans:T", async () => 1, () => {});
  await swr("att-grid:T:2026-10", async () => 2, () => {});
  invalidate("plans:");
  assert.equal(has("plans:T"), false);
  assert.equal(has("att-grid:T:2026-10"), true);
  invalidate();
  assert.equal(has("att-grid:T:2026-10"), false);
});

test("a failed fetch rejects and keeps the previously cached value", async () => {
  invalidate();
  await swr("c:1", async () => "kept", () => {});
  const seen = [];
  await assert.rejects(swr("c:1", async () => { throw new Error("offline"); }, (v) => seen.push(v)), /offline/);
  assert.deepEqual(seen, ["kept"], "the stale value was shown before the failure");
  assert.equal(peek("c:1"), "kept");
});

test("two overlapping calls for one key: only the later one updates the screen last", async () => {
  invalidate();
  const seen = [];
  let releaseSlow;
  const slow = swr("d:1", () => new Promise((r) => (releaseSlow = () => r("slow"))), (v) => seen.push(v));
  const fast = swr("d:1", async () => "fast", (v) => seen.push(v));
  await fast;
  releaseSlow();
  await slow;
  assert.deepEqual(seen, ["fast"]);
});