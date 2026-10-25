// ตัวจับเวลาการเปิดเมนู (เปิดด้วย ?perf=1 ปิดด้วย ?perf=0 จำค่าไว้ในเครื่องนี้) — แสดงกล่องเล็กมุมซ้ายล่างว่าแต่ละหน้าใช้เวลากี่มิลลิวินาทีจนเนื้อหานิ่ง
// จำนวนคำขอเครือข่าย และข้อมูลที่โหลดมากี่ KB เพื่อใช้ดูว่าเมนูไหนช้าจริงบนข้อมูลจริง (ตรรกะคำนวณอยู่ใน perf-math.js)
import { formatPerfLine, settledMs } from "./perf-math.js";

const FLAG = "footelligence-perf";
const QUIET_MS = 500; // เนื้อหาหน้าไม่เปลี่ยนและไม่มีคำขอใหม่นานเท่านี้ ถือว่านิ่งแล้ว
const MAX_LINES = 8;

function enabled() {
  try {
    const q = new URLSearchParams(location.search).get("perf");
    if (q === "1") localStorage.setItem(FLAG, "1");
    if (q === "0") localStorage.removeItem(FLAG);
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return new URLSearchParams(location.search).get("perf") === "1";
  }
}

export function initPerfPanel() {
  if (!enabled() || typeof PerformanceObserver !== "function") return;
  const panel = document.createElement("div");
  panel.setAttribute("data-perf-panel", "");
  panel.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;max-width:92vw;background:rgba(20,20,20,.88);color:#fff;font:12px/1.5 monospace;padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre";
  document.body.appendChild(panel);
  const lines = [];
  const resources = []; // { end, bytes }
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) resources.push({ end: e.responseEnd, bytes: e.transferSize || 0 });
  }).observe({ type: "resource", buffered: false });

  const active = new Map(); // section element -> { t0, activity[] }
  const finish = (section, run) => {
    active.delete(section);
    const ms = settledMs(run.t0, run.activity);
    const mine = resources.filter((r) => r.end >= run.t0 && r.end <= run.t0 + ms + QUIET_MS);
    lines.push(formatPerfLine({ label: (section.id || "?").replace(/-section$/, ""), ms, requests: mine.length, bytes: mine.reduce((s, r) => s + r.bytes, 0) }));
    panel.textContent = lines.slice(-MAX_LINES).join("\n");
  };
  const touch = (section) => {
    const run = active.get(section);
    if (!run) return;
    run.activity.push(performance.now());
    clearTimeout(run.timer);
    run.timer = setTimeout(() => finish(section, run), QUIET_MS);
  };

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      const section = m.target.closest?.("main section[id]") ?? null;
      if (m.type === "attributes" && m.attributeName === "class" && m.target.matches?.("main section[id]")) {
        const shown = !m.target.classList.contains("hidden");
        if (shown && !active.has(m.target)) active.set(m.target, { t0: performance.now(), activity: [], timer: null });
        if (shown) touch(m.target);
      } else if (section) touch(section);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"], characterData: true });
}