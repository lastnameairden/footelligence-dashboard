import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_TEAMS,
  coachAccessModel,
  daysLeft,
  dateLabel,
  nextWindowFor,
  openWindowsFor,
  periodAllowed,
  validateWindowForm,
  windowLabel,
  windowState,
  windowsTableHtml
} from "../js/athlete-windows.js";

const W = (o) => ({ id: "w", team: ALL_TEAMS, startMonth: "2026-08", endMonth: "2026-10", openDate: "2026-11-01", closeDate: "2026-11-14", status: "open", ...o });

test("labels: same year, same month, across years; Thai date with year", () => {
  assert.equal(windowLabel(W({})), "ส.ค.–ต.ค. 2026");
  assert.equal(windowLabel(W({ startMonth: "2026-10", endMonth: "2026-10" })), "ต.ค. 2026");
  assert.equal(windowLabel(W({ startMonth: "2025-12", endMonth: "2026-02" })), "ธ.ค. 2025–ก.พ. 2026");
  assert.equal(windowLabel({}), "-");
  assert.equal(dateLabel("2026-11-01"), "1 พ.ย. 2026");
  assert.equal(dateLabel("x"), "-");
});

test("windowState: upcoming before the open date, open through the close date inclusive, closed after or when the admin closes it", () => {
  const w = W({});
  assert.equal(windowState(w, "2026-10-31"), "upcoming");
  assert.equal(windowState(w, "2026-11-01"), "open");
  assert.equal(windowState(w, "2026-11-14"), "open");
  assert.equal(windowState(w, "2026-11-15"), "closed");
  assert.equal(windowState({ ...w, status: "closed" }, "2026-11-05"), "closed");
});

test("a window for ALL teams applies to every team; a team window only to that team", () => {
  const windows = [W({ id: "a" }), W({ id: "b", team: "THAWEE SC", startMonth: "2026-05", endMonth: "2026-07" }), W({ id: "c", team: "KHAMPHEE FOOTBALL", startMonth: "2026-09", endMonth: "2026-10" })];
  assert.deepEqual(openWindowsFor(windows, "THAWEE SC", "2026-11-05").map((w) => w.id).sort(), ["a", "b"]);
  assert.deepEqual(openWindowsFor(windows, "THAMMASATHIT", "2026-11-05").map((w) => w.id), ["a"]);
  assert.deepEqual(openWindowsFor(windows, "THAWEE SC", "2026-12-01"), []);
});

test("periodAllowed needs the exact start and end month of a currently open window", () => {
  const windows = [W({})];
  assert.equal(periodAllowed(windows, "THAWEE SC", "2026-11-05", "2026-08", "2026-10")?.id, "w");
  assert.equal(periodAllowed(windows, "THAWEE SC", "2026-11-05", "2026-08", "2026-09"), null, "different end month");
  assert.equal(periodAllowed(windows, "THAWEE SC", "2026-10-05", "2026-08", "2026-10"), null, "not open yet");
  assert.equal(periodAllowed([W({ status: "closed" })], "THAWEE SC", "2026-11-05", "2026-08", "2026-10"), null, "closed by the admin");
  assert.equal(periodAllowed([W({ team: "KHAMPHEE FOOTBALL" })], "THAWEE SC", "2026-11-05", "2026-08", "2026-10"), null, "other team");
});

test("coachAccessModel: open windows, else the next upcoming one, else nothing", () => {
  const windows = [W({ id: "now" }), W({ id: "later", openDate: "2027-02-01", closeDate: "2027-02-14", startMonth: "2026-11", endMonth: "2027-01" })];
  assert.deepEqual(coachAccessModel(windows, "THAWEE SC", "2026-11-05"), { kind: "open", windows: [windows[0]] });
  const closed = coachAccessModel(windows, "THAWEE SC", "2026-12-20");
  assert.equal(closed.kind, "closed");
  assert.equal(closed.next.id, "later");
  assert.equal(coachAccessModel([], "THAWEE SC", "2026-12-20").next, null);
  assert.equal(nextWindowFor(windows, "THAWEE SC", "2027-03-01"), null);
});

test("daysLeft counts down to the last day", () => {
  assert.equal(daysLeft(W({}), "2026-11-05"), 9);
  assert.equal(daysLeft(W({}), "2026-11-14"), 0);
  assert.equal(daysLeft(W({}), "2026-11-20"), 0);
});

test("validateWindowForm: required fields, order of months and dates, past close date, overlapping duplicate", () => {
  const ok = { team: ALL_TEAMS, startMonth: "2026-08", endMonth: "2026-10", openDate: "2026-11-01", closeDate: "2026-11-14" };
  assert.equal(validateWindowForm(ok, [], "2026-10-20"), null);
  assert.match(validateWindowForm({ ...ok, team: "" }), /ทีม/);
  assert.match(validateWindowForm({ ...ok, startMonth: "" }), /ช่วงเดือน/);
  assert.match(validateWindowForm({ ...ok, startMonth: "2026-11", endMonth: "2026-10" }), /เดือนเริ่มต้น/);
  assert.match(validateWindowForm({ ...ok, openDate: "" }), /วันที่/);
  assert.match(validateWindowForm({ ...ok, closeDate: "2026-10-31" }), /ก่อนวันเริ่ม/);
  assert.match(validateWindowForm({ ...ok, openDate: "2026-09-01", closeDate: "2026-09-10" }, [], "2026-10-20"), /ผ่านไปแล้ว/);
  assert.match(validateWindowForm(ok, [W({ openDate: "2026-11-10", closeDate: "2026-11-20" })], "2026-10-20"), /ทับกัน/);
  assert.equal(validateWindowForm(ok, [W({ status: "closed" })], "2026-10-20"), null, "a window the admin closed does not block a new one");
  assert.equal(validateWindowForm(ok, [W({ team: "THAWEE SC" })], "2026-10-20"), null, "different team scope");
});

test("windowsTableHtml: newest first, labels, status badges, actions, escaped team", () => {
  const html = windowsTableHtml(
    [W({ id: "old", openDate: "2026-08-01", closeDate: "2026-08-14", startMonth: "2026-05", endMonth: "2026-07" }), W({ id: "new" }), W({ id: "x", team: "<b>t</b>", status: "closed" })],
    "2026-11-05"
  );
  assert.ok(html.indexOf("data-window-delete=\"new\"") < html.indexOf("data-window-delete=\"old\""));
  assert.match(html, /ทุกทีม/);
  assert.match(html, /ส\.ค\.–ต\.ค\. 2026/);
  assert.match(html, /1 พ\.ย\. 2026 – 14 พ\.ย\. 2026/);
  assert.match(html, /badge-success[^>]*>กำลังเปิด/);
  assert.match(html, /ปิดแล้ว/);
  assert.match(html, /data-window-close="new"/);
  assert.match(html, /data-window-reopen="x"/);
  assert.ok(!html.includes("data-window-close=\"old\"") && !html.includes("data-window-reopen=\"old\""), "an expired window has no toggle");
  assert.ok(!html.includes("<b>t</b>"));
  assert.match(windowsTableHtml([], "2026-11-05"), /ยังไม่เคยเปิด/);
});
