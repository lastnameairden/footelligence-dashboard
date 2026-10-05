// แผงสถิติการบาดเจ็บ (หยุดเฉลี่ย บาดเจ็บซ้ำ แยกตามตำแหน่งร่างกาย/กลไก/ที่เกิด) ใช้ร่วมกันทั้ง Dashboard (app.js) และหน้าพิมพ์ (print.js)
// แท่งกราฟวาดเป็น SVG (ไม่ใช้พื้นหลัง div) เพราะเบราว์เซอร์ไม่พิมพ์สีพื้นหลังโดยปริยาย — preserveAspectRatio="none" กันขอบเว้นตอนยืดตามความกว้าง
import { escapeHtml } from "./ui-utils.js";
import { buildInjuryStats } from "./injury-form.js";

function barsHtml(list) {
  if (list.length === 0) return '<p class="text-xs text-slate-400">ยังไม่มีรายงานที่ระบุข้อมูลนี้</p>';
  const max = Math.max(...list.map((x) => x.count));
  return list
    .map(
      (x) => `
      <div class="flex items-center gap-3 text-sm mb-1.5">
        <span class="w-36 shrink-0 text-slate-700">${escapeHtml(x.label)}</span>
        <svg viewBox="0 0 100 8" preserveAspectRatio="none" class="flex-1" style="height:10px" role="img" aria-label="${escapeHtml(x.label)} ${x.count} ราย">
          <rect x="0" y="0" width="100" height="8" rx="2" fill="#f1f5f9"></rect>
          <rect x="0" y="0" width="${Math.max((x.count / max) * 100, 2).toFixed(1)}" height="8" rx="2" fill="#f87171"></rect>
        </svg>
        <span class="w-8 text-right font-medium text-slate-800">${x.count}</span>
      </div>`
    )
    .join("");
}

// reports = รายงานบาดเจ็บของช่วง/ขอบเขตที่ต้องการ (กรองมาแล้ว) คืนสตริงว่างถ้าไม่มีรายงานเลย (ผู้เรียกจะไม่แสดงแผง)
// summaryCards: false = ซ่อนการ์ดหยุดเฉลี่ย/บาดเจ็บซ้ำด้านบน (Dashboard มีการ์ดสรุปของตัวเองอยู่แล้ว)
export function injuryStatsHtml(reports, { summaryCards = true } = {}) {
  if (reports.length === 0) return "";
  const s = buildInjuryStats(reports);
  const avgText = s.avgDaysOut === null ? "-" : s.avgDaysOut.toFixed(1).replace(/\.0$/, "");
  const avgNote =
    s.avgDaysOut === null
      ? "ยังไม่มีรายงานที่หายแล้วและระบุวันกลับมาซ้อมจริง"
      : `จาก ${s.avgDaysOutSample} รายที่หายแล้ว`;
  return `
    <div class="card card-pad space-y-4">
      ${
        summaryCards
          ? `<div class="grid grid-cols-2 gap-4">
        <div class="rounded-lg bg-slate-50 px-4 py-3">
          <p class="text-xs text-slate-500">วันที่หยุดซ้อมเฉลี่ย</p>
          <p class="text-2xl font-semibold text-slate-900">${avgText}<span class="text-sm font-normal text-slate-500"> วัน</span></p>
          <p class="text-xs text-slate-400">${avgNote}</p>
        </div>
        <div class="rounded-lg bg-slate-50 px-4 py-3">
          <p class="text-xs text-slate-500">บาดเจ็บซ้ำ</p>
          <p class="text-2xl font-semibold text-slate-900">${s.recurrence}<span class="text-sm font-normal text-slate-500"> ราย (${s.recurrencePercent}%)</span></p>
          <p class="text-xs text-slate-400">ตำแหน่งและข้างเดียวกับที่เคยบาดเจ็บ</p>
        </div>
      </div>`
          : ""
      }
      <div>
        <p class="text-xs font-semibold text-slate-600 mb-2">ตามตำแหน่งร่างกาย</p>
        ${barsHtml(s.byRegion)}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-semibold text-slate-600 mb-2">ตามกลไกการบาดเจ็บ</p>
          ${barsHtml(s.byMechanism)}
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-600 mb-2">ตามที่เกิดเหตุ</p>
          ${barsHtml(s.byContext)}
        </div>
      </div>
      <p class="text-xs text-slate-400">แยกตามตำแหน่ง/กลไก นับเฉพาะรายงานที่ระบุข้อมูล (${s.withRegion} จาก ${s.total} ราย ระบุตำแหน่ง)</p>
    </div>`;
}

// กราฟแท่งจำนวนรายงานรายเดือนในช่วงที่เลือก (เทอม/ปีเห็นแนวโน้มว่าเดือนไหนบาดเจ็บมาก) — counts = [{ month, count }]
export function injuryTrendHtml(counts, monthShortLabelOf) {
  if (counts.length === 0) return "";
  const max = Math.max(1, ...counts.map((c) => c.count));
  const columns = counts
    .map((c) => {
      const h = c.count === 0 ? 1 : Math.max((c.count / max) * 80, 3);
      return `
      <div class="flex flex-col items-center justify-end gap-1 flex-1 text-xs text-slate-500">
        <span class="text-slate-800 font-medium">${c.count}</span>
        <svg viewBox="0 0 10 80" preserveAspectRatio="none" style="width:60%;height:80px" role="img" aria-label="${escapeHtml(monthShortLabelOf(c.month))} ${c.count} ราย">
          <rect x="0" y="${(80 - h).toFixed(1)}" width="10" height="${h.toFixed(1)}" rx="1.5" fill="${c.count === 0 ? "#e2e8f0" : "#f87171"}"></rect>
        </svg>
        <span>${escapeHtml(monthShortLabelOf(c.month))}</span>
      </div>`;
    })
    .join("");
  return `
    <div class="card card-pad">
      <p class="text-xs font-semibold text-slate-600 mb-2">จำนวนรายงานรายเดือนในช่วงนี้</p>
      <div class="flex gap-2 items-end">${columns}</div>
    </div>`;
}