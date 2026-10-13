// ตัวสร้าง HTML ของส่วนสมรรถภาพรายบุคคล ใช้ร่วมกันทั้งหน้านักกีฬา (มุมมองโค้ช) และสมุดพกผู้ปกครอง — ตรรกะอยู่ที่ fitness-profile.js
// หลักการแสดงผล: ไม่ใช้สีแดงกับผลที่ต่ำ (ใช้สีฟ้า/เทา) ไม่แสดงอันดับหรือชื่อเพื่อน ช่องที่ไม่ได้ทดสอบแสดง "–"/"ไม่ได้ทดสอบ" ไม่ใช่ 0
import { escapeHtml } from "./ui-utils.js";
import { FITNESS_TEST_BY_CODE, FITNESS_TESTS } from "./fitness-calc.js";
import {
  COD_ASYMMETRY_NOTE_THRESHOLD,
  GROWTH_LABELS,
  GROWTH_PARENT_TEXT,
  NO_TREND_CODES,
  codDeficit,
  growthStatus,
  previousValue,
  trendBetween
} from "./fitness-profile.js";

const fmt = (code, v) => (v === null || v === undefined ? "–" : v.toFixed(FITNESS_TEST_BY_CODE[code].decimals));

const TREND_BADGE = {
  better: '<span class="badge badge-success">↑ ดีขึ้น</span>',
  same: '<span class="badge badge-neutral">→ คงที่</span>',
  lower: '<span class="badge badge-info">↓ ลดลงเล็กน้อย</span>'
};

// รายการที่มีค่าอย่างน้อยหนึ่งรอบ ตามลำดับรายการมาตรฐาน
function codesWithData(series) {
  return FITNESS_TESTS.map((t) => t.code).filter((code) => series.some((p) => p.values[code] !== null && p.values[code] !== undefined));
}

// กราฟเส้นเล็กของส่วนสูงทุกรอบ (SVG viewBox ไม่ตั้ง height — กันขอบเว้น ดูหมายเหตุใน injury-stats-view.js)
export function heightSparklineSvg(series, { width = 200, height = 60, color = "#2563eb" } = {}) {
  const pts = series.filter((p) => p.values.height != null);
  if (pts.length < 2) return "";
  const vals = pts.map((p) => p.values.height);
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const xy = pts.map((p, i) => [10 + (i * (width - 20)) / (pts.length - 1), height - 8 - ((p.values.height - min) / span) * (height - 16)]);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const dots = xy.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"></circle>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px" role="img" aria-label="กราฟส่วนสูงทุกรอบ"><path d="${line}" fill="none" stroke="${color}" stroke-width="2"></path>${dots}</svg>`;
}

// ---------- มุมมองโค้ช (หน้านักกีฬา) ----------
export function coachFitnessHtml({ player, series }) {
  if (series.length === 0) {
    return '<p class="text-sm text-slate-400">ยังไม่มีผลทดสอบสมรรถภาพ — จะแสดงเมื่อโค้ชกรอกผลของรอบที่เปิดอยู่</p>';
  }
  const growth = growthStatus({ player, series });
  const tags = [];
  if (growth.key) tags.push(`<span class="badge badge-warning">ช่วงการเติบโต: ${GROWTH_LABELS[growth.key]} (ประมาณ)</span>`);
  if (growth.velocity !== null) tags.push(`<span class="badge badge-neutral">ส่วนสูงเพิ่ม ${growth.velocity.toFixed(1)} ซม./ปี</span>`);
  if (player.parentHeights?.source) tags.push(`<span class="badge badge-neutral">ส่วนสูงพ่อแม่: ${escapeHtml(player.parentHeights.source)}</span>`);
  let growthNote;
  if (growth.key) {
    growthNote =
      "ประมาณการจากส่วนสูง น้ำหนัก ส่วนสูงนั่ง และอายุ (คลาดเคลื่อนได้ราว ±1 ปี) เป็นสัญญาณให้โค้ชคุยกัน ไม่ใช่คำตัดสิน — ช่วงโตเร็วสัมพันธ์กับอาการเจ็บเข่า/ส้นเท้า ดูภาระซ้อมประกอบ";
  } else if (player.sex !== "ชาย") {
    growthNote = "ยังไม่แสดงช่วงการเติบโต: ต้องระบุเพศของนักกีฬา (ตอนนี้รองรับการคำนวณของเด็กชาย) ที่หน้าแก้ไขนักกีฬา และมีผลทดสอบส่วนสูง ส่วนสูงนั่ง น้ำหนักครบ";
  } else {
    growthNote = "ยังไม่แสดงช่วงการเติบโต: ต้องมีส่วนสูง ส่วนสูงนั่ง น้ำหนักครบ และวันเกิดเต็มของนักกีฬา อัตราการโตจะแสดงเมื่อมีผลอย่างน้อย 2 รอบ";
  }

  const codes = codesWithData(series);
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null; // มีมากกว่า 1 รอบหรือไม่ (แสดงหัวคอลัมน์เทียบรอบก่อน)
  const head = series.map((p) => `<th class="text-right">${escapeHtml(p.label)}</th>`).join("");
  const rows = codes
    .map((code) => {
      const t = FITNESS_TEST_BY_CODE[code];
      const cells = series.map((p) => `<td class="text-right">${fmt(code, p.values[code])}</td>`).join("");
      // เทียบกับรอบล่าสุดที่เคยวัดรายการนั้น (ข้ามรอบ Selective ที่ไม่มีรายการนี้) — ผู้ใช้เห็นว่าเทียบกับรอบไหนจาก tooltip
      const before = NO_TREND_CODES.includes(code) || last.values[code] == null ? null : previousValue(series, code, series.length - 1);
      const trend = before ? (TREND_BADGE[trendBetween(code, last.values[code], before.value)] || "").replace("<span", `<span title="เทียบกับ ${escapeHtml(before.label)}"`) : "";
      return `<tr><td class="emphasis">${escapeHtml(t.label)} <span class="text-xs text-slate-400">${escapeHtml(t.unit)}</span></td>${cells}<td class="text-right">${trend}</td></tr>`;
    })
    .join("");

  const cod = codDeficit(last.values);
  const asymmetric = cod.asymmetry !== null && cod.asymmetry > COD_ASYMMETRY_NOTE_THRESHOLD;
  const asymmetryClass = asymmetric ? "text-amber-700" : "text-slate-500";
  const codBox =
    cod.left !== null || cod.right !== null
      ? `<div class="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <p class="text-xs font-semibold text-slate-600 mb-1">COD Deficit (505 − Sprint 10 ม.) · ${escapeHtml(last.label)}</p>
          <p>ซ้าย <b>${cod.left === null ? "–" : cod.left.toFixed(2)}</b> · ขวา <b>${cod.right === null ? "–" : cod.right.toFixed(2)}</b> วินาที</p>
          ${
            cod.asymmetry !== null
              ? `<p class="text-xs ${asymmetryClass}">ต่างซ้าย-ขวา ${cod.asymmetry.toFixed(2)} วินาที${asymmetric ? " — ควรดูความไม่สมดุลของขาสองข้าง" : " (ปกติ)"}</p>`
              : ""
          }
          <p class="text-xs text-slate-400 mt-1">ค่ายิ่งต่ำ = เสียเวลาตอนเลี้ยวน้อยเมื่อเทียบกับความเร็วเส้นตรง · ข้อสังเกตสำหรับโค้ช ไม่ใช่คำวินิจฉัย</p>
        </div>`
      : "";

  return `
    <div class="space-y-4">
      <div>
        <div class="flex flex-wrap gap-2">${tags.join("") || '<span class="text-sm text-slate-400">ยังไม่มีข้อมูลการเติบโต</span>'}</div>
        <p class="text-xs text-slate-400 mt-1">${growthNote}</p>
      </div>
      <div class="card table-wrap">
        <table class="pro-table">
          <thead><tr><th>รายการ (ค่าที่ใช้)</th>${head}<th class="text-right">${prev ? "เทียบรอบก่อน" : ""}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="text-xs text-slate-400">ลูกศรแสดงเมื่อเปลี่ยนมากกว่าความคลาดเคลื่อนของการวัดเท่านั้น · "–" = ไม่ได้ทดสอบรอบนั้น · คะแนนโค้ช (MASC และคะแนนรายวัน) แยกอยู่ในส่วนอื่นของหน้านี้ ไม่รวมกับผลทดสอบ</p>
      ${codBox}
    </div>`;
}

// ---------- สมุดพกผู้ปกครอง: ส่วนที่ 1-3 (ส่วนที่ 4 สรุปจากโค้ชฟิตเนสสร้างด้วย DOM ใน report-card.js เพราะแก้ไขได้) ----------
// mascM = เกรด M ล่าสุด (1/3/7/9) หรือ null — ขนาดตัวอักษรเล็กตามแบบสมุดพก (พิมพ์ A4 แนวนอน)
export function parentFitnessSectionsHtml({ player, series, mascM }) {
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const growth = growthStatus({ player, series });

  const heightNow = last.values.height;
  const heightPrev = prev ? prev.values.height : null;
  const grew = heightNow != null && heightPrev != null ? heightNow - heightPrev : null;
  const growthSection = `
    <div class="grid grid-cols-2 gap-2 items-center">
      <div class="rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
        <p class="text-[9px] text-slate-400">ส่วนสูงตอนนี้</p>
        <p class="text-base font-bold text-slate-900 leading-tight">${heightNow != null ? heightNow.toFixed(1) : "–"} <span class="text-[10px] font-normal">ซม.</span></p>
        ${grew !== null ? `<p>${grew >= 0 ? "เพิ่มขึ้น" : "เปลี่ยนแปลง"} <b>${Math.abs(grew).toFixed(1)} ซม.</b> จากรอบก่อน</p>` : ""}
      </div>
      <div>${heightSparklineSvg(series, { width: 150, height: 50 })}</div>
    </div>
    ${
      growth.key
        ? `<p class="mt-1.5"><span class="badge badge-info">${GROWTH_LABELS[growth.key]}</span></p>
           <p class="text-[10px] text-slate-600 leading-snug mt-0.5">${GROWTH_PARENT_TEXT[growth.key]}</p>`
        : ""
    }`;

  const codes = codesWithData(series).filter((c) => !NO_TREND_CODES.includes(c));
  const testRows = codes
    .map((code) => {
      const t = FITNESS_TEST_BY_CODE[code];
      const cur = last.values[code];
      const earlier = previousValue(series, code, series.length - 1);
      const trend = !earlier ? '<span class="badge badge-neutral">รอบแรก</span>' : TREND_BADGE[trendBetween(code, cur, earlier.value)] || "";
      return `<tr><td class="emphasis">${escapeHtml(t.label)}</td><td class="text-right">${earlier ? `${fmt(code, earlier.value)} <span class="text-[8px] text-slate-400">${escapeHtml(earlier.label)}</span>` : "–"}</td><td class="text-right"><b>${cur === null || cur === undefined ? "ไม่ได้ทดสอบรอบนี้" : fmt(code, cur)}</b> <span class="text-slate-400">${cur === null || cur === undefined ? "" : escapeHtml(t.unit)}</span></td><td class="text-right">${cur === null || cur === undefined ? "" : trend}</td></tr>`;
    })
    .join("");
  const testSection = codes.length
    ? `<table class="pro-table"><thead><tr><th>รายการ</th><th class="text-right">${prev ? "รอบก่อนหน้า" : ""}</th><th class="text-right">${escapeHtml(last.label)}</th><th class="text-right">พัฒนาการ</th></tr></thead><tbody>${testRows}</tbody></table>
       <p class="text-[8px] text-slate-400 mt-1">ค่าที่วัดได้จริง · ลูกศรแสดงเมื่อเปลี่ยนมากกว่าความคลาดเคลื่อนของการวัด</p>`
    : '<p class="text-[10px] text-slate-400">ยังไม่มีผลทดสอบในรอบนี้</p>';

  const mascSection =
    mascM === null || mascM === undefined
      ? '<p class="text-[10px] text-slate-400">ยังไม่มีผลประเมินการเคลื่อนไหว</p>'
      : `<p class="text-[10px] text-slate-600">คะแนนการเคลื่อนไหว (MASC-M) <b class="text-sm text-slate-900">${mascM} / 9</b> <span class="badge badge-neutral">โค้ชประเมิน</span></p>
         <p class="text-[8px] text-slate-400 mt-0.5">เป็นความเห็นของโค้ชต่อคุณภาพการเคลื่อนไหว ไม่ใช่ค่าที่วัดด้วยเครื่องมือ จึงแยกจากผลทดสอบ</p>`;

  return { growthSection, testSection, mascSection };
}
