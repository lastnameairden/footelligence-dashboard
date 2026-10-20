import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterPlans,
  filterReportsByMonths,
  groupByMonth,
  locationHtml,
  monthOptionsOf,
  monthsBack,
  planAgeGroupsOf,
  planDataHtml,
  reportAttendLabel,
  photoThumbsHtml,
  reportHistoryHtml,
  reportPeriodLabel,
  shortDate,
  submittedLabel
} from "../js/plan-report-data.js";

const ts = (iso) => ({ toDate: () => new Date(iso) });

const plans = [
  { id: "p1", date: "2026-10-20", createdAt: ts("2026-10-20T01:50:00Z"), coachName: "โค้ชไต๋", ageGroups: ["U16"], playerGroup: "A", trainingType: "Player", phase: "Competition Phase (ช่วงแข่งขัน)", competitionTopic: "พบทีม A", mainPart: "เกมรุกเร็ว", physicalFocus: ["Speed", "Agility"], fileUrl: "https://example.com/a.pdf", notes: null },
  { id: "p2", date: "2026-10-19", createdAt: ts("2026-10-19T07:32:00Z"), coachName: "โค้ชไต๋", ageGroups: ["U16", "U17"], trainingType: "Player", phase: "Preparation", mainPart: "Possession", physicalFocus: [], fileUrl: null, notes: "รถติด" },
  { id: "p3", date: "2026-09-30", ageGroups: ["U13"], coachName: "อีกคน" }
];

test("shortDate and submittedLabel use Thai month names and Bangkok time", () => {
  assert.equal(shortDate("2026-10-20"), "20 ต.ค. 2026");
  assert.equal(shortDate("x"), "-");
  assert.equal(submittedLabel(plans[0]), "20 ต.ค. 08:50", "01:50 UTC is 08:50 in Bangkok");
  assert.equal(submittedLabel({}), "-");
  assert.equal(submittedLabel({ updatedAt: ts("2026-10-19T17:30:00Z") }), "20 ต.ค. 00:30", "falls back to updatedAt, crossing midnight in Bangkok");
});

test("month helpers: options always include this month, newest first; monthsBack counts back across a year boundary", () => {
  assert.deepEqual(monthOptionsOf(plans, "2026-10"), ["2026-10", "2026-09"]);
  assert.deepEqual(monthOptionsOf([], "2026-10"), ["2026-10"]);
  assert.deepEqual(monthsBack("2026-02", 3), ["2026-02", "2026-01", "2025-12"]);
  const groups = groupByMonth(plans);
  assert.deepEqual(groups.map((g) => [g.month, g.items.map((p) => p.id)]), [["2026-10", ["p1", "p2"]], ["2026-09", ["p3"]]]);
});

test("filterPlans by month and age group (a plan can cover several age groups)", () => {
  assert.deepEqual(filterPlans(plans, { month: "2026-10" }).map((p) => p.id), ["p1", "p2"]);
  assert.deepEqual(filterPlans(plans, { month: "2026-10", ageGroup: "U17" }).map((p) => p.id), ["p2"]);
  assert.deepEqual(filterPlans(plans, {}).length, 3);
  assert.deepEqual(planAgeGroupsOf(plans), ["U13", "U16", "U17"]);
});

test("planDataHtml shows every column of the upload form, the status badge, the file link and edit/delete", () => {
  const html = planDataHtml(groupByMonth(filterPlans(plans, { month: "2026-10" })), { statusHtml: (p) => `<b>S-${p.id}</b>` });
  for (const label of ["แบบฝึกประจำวันที่", "วัน/เวลาที่ส่ง", "Session plan", "โค้ช", "รุ่นอายุ", "กลุ่มผู้เล่น", "ประเภทการฝึก", "Phase", "หัวข้อหลัก", "Physical", "สถานะ", "หมายเหตุ"]) {
    assert.ok(html.includes(`<th>${label}</th>`), label);
  }
  assert.match(html, /ตุลาคม 2026 · 2 แผน/);
  assert.match(html, /20 ต\.ค\. 2026/);
  assert.match(html, /20 ต\.ค\. 08:50/);
  assert.match(html, /href="https:\/\/example\.com\/a\.pdf"/);
  assert.match(html, /พบทีม A/);
  assert.match(html, /Speed, Agility/);
  assert.match(html, /S-p1/);
  assert.match(html, /data-plan-edit="p1"/);
  assert.match(html, /data-plan-delete="p2"/);
  assert.ok(!planDataHtml(groupByMonth(plans), { statusHtml: () => "", canEdit: false }).includes("data-plan-edit"));
  assert.match(planDataHtml([], {}), /ยังไม่มีแผน/);
});

test("planDataHtml escapes user text and refuses non-http file links", () => {
  const evil = [{ id: "x", date: "2026-10-01", coachName: "<img src=x onerror=1>", ageGroups: ["U16"], notes: "<script>", fileUrl: "javascript:alert(1)" }];
  const html = planDataHtml(groupByMonth(evil), {});
  assert.ok(!html.includes("<script>") && !html.includes("<img src=x"));
  assert.ok(!html.includes("javascript:"));
});

const reports = [
  { id: "r1", date: "2026-10-20", coachName: "โค้ชไต๋", attended: true, periodType: "evening", periodStartTime: "16:00", periodEndTime: "18:00", notes: null, photos: [{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }], location: { lat: 13.7512, lng: 100.5013 }, createdAt: ts("2026-10-20T11:12:00Z") },
  { id: "r2", date: "2026-10-17", coachName: "โค้ชไต๋", attended: false, notes: "วันหยุด", autoFromNoTraining: true },
  { id: "r3", date: "2026-09-30", coachName: "โค้ชไต๋", attended: true, periodType: "other", periodOtherText: "ซ้อมพิเศษ" },
  { id: "r4", date: "2026-08-10", coachName: "โค้ชไต๋", attended: true, periodType: "morning" }
];

test("report labels: attendance, period with time range, GPS link built from numbers only", () => {
  assert.equal(reportAttendLabel(reports[0]), "มีการซ้อม");
  assert.equal(reportAttendLabel(reports[1]), "ไม่มีการซ้อม");
  assert.equal(reportAttendLabel({}), "-");
  assert.equal(reportPeriodLabel(reports[0]), "ซ้อมเย็น 16:00-18:00 น.");
  assert.equal(reportPeriodLabel(reports[2]), "ซ้อมพิเศษ");
  assert.equal(reportPeriodLabel(reports[1]), "-", "no period on a no-training day");
  assert.match(locationHtml(reports[0].location), /google\.com\/maps\?q=13\.7512,100\.5013/);
  assert.match(locationHtml(reports[0].location), />13\.7512, 100\.5013</);
  assert.equal(locationHtml(null), "-");
  assert.equal(locationHtml({ lat: "x", lng: 1 }), "-");
});

test("filterReportsByMonths keeps this month and the previous one; empty list keeps everything", () => {
  assert.deepEqual(filterReportsByMonths(reports, ["2026-10", "2026-09"]).map((r) => r.id), ["r1", "r2", "r3"]);
  assert.equal(filterReportsByMonths(reports, []).length, 4);
});

test("reportHistoryHtml: compact (under the form) and full (Training Report Data) columns, open buttons and the highlighted new report", () => {
  const groups = groupByMonth(filterReportsByMonths(reports, ["2026-10", "2026-09"]));
  const compact = reportHistoryHtml(groups, { highlightDate: "2026-10-20" });
  assert.match(compact, /ตุลาคม 2026 · 2 รายงาน/);
  assert.match(compact, /กันยายน 2026 · 1 รายงาน/);
  assert.match(compact, /data-report-open="2026-10-20"/);
  assert.match(compact, /class="report-row-new"/);
  assert.ok(!compact.includes("<th>สถานที่ (GPS)</th>"));
  const full = reportHistoryHtml(groups, { mode: "full" });
  for (const label of ["โค้ช", "สถานที่ (GPS)", "วัน/เวลาที่ส่ง"]) assert.ok(full.includes(`<th>${label}</th>`), label);
  assert.match(full, /20 ต\.ค\. 18:12/);
  assert.match(full, /13\.7512, 100\.5013/);
  assert.match(reportHistoryHtml([], {}), /ยังไม่มีรายงาน/);
});

test("photoThumbsHtml: one thumbnail link per https photo, anything else is dropped, no photos = dash", () => {
  const html = photoThumbsHtml([{ url: "https://x/a.jpg?t=1&u=2" }, { url: "javascript:alert(1)" }, { url: "https://x/b.jpg" }, null, {}]);
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.match(html, /href="https:\/\/x\/a\.jpg\?t=1&amp;u=2" target="_blank" rel="noopener noreferrer"/);
  assert.ok(!html.includes("javascript:"));
  assert.equal(photoThumbsHtml([]), "-");
  assert.equal(photoThumbsHtml(undefined), "-");
  assert.equal(photoThumbsHtml([{ url: "http://insecure/a.jpg" }]), "-");
});

test("report history tables show the photo thumbnails instead of a count", () => {
  const groups = groupByMonth([{ id: "r", date: "2026-10-20", coachName: "โค้ช", attended: true, photos: [{ url: "https://x/a.jpg" }] }]);
  for (const mode of ["compact", "full"]) {
    const html = reportHistoryHtml(groups, { mode });
    assert.match(html, /class="report-photo-thumb"/, mode);
    assert.match(html, /src="https:\/\/x\/a\.jpg"/, mode);
  }
});
