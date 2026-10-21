// Home ของแอดมินในหน้าทีม: ภาพรวมของทีมที่เลือก "วันนี้" (ตรรกะล้วนๆ + HTML เป็นสตริง ไม่พึ่ง DOM/Firebase เพื่อเทสต์ใน Node ได้)
// ต่อรุ่นอายุ: เช็คชื่อวันนี้ครบไหม · ส่งแผนฝึกซ้อมแล้วไหม · โค้ชของรุ่นนั้นส่งรายงานแล้วไหม · นักกีฬาบาดเจ็บอยู่กี่คน
// กติกาเดียวกับเตือนในหน้า Home ของโค้ช (checkTodayReminders): แผนต้องส่งเฉพาะวันซ้อมของทีมที่ไม่ได้กดวันไม่มีซ้อม
import { escapeHtml, isRecordOfCoach } from "./ui-utils.js";
import { ageGroupsOf } from "./player-gallery.js";

const HEALED = "หายแล้ว";

// รายงานบาดเจ็บที่ยังค้างอยู่ = ยังไม่หายและยังไม่มีวันกลับมาซ้อมจริง
export const isInjuryActive = (r) => !!r && r.status !== HEALED && !r.actualReturnDate;

// วันนี้เป็นวันแบบไหน: training = วันซ้อม (มีรอบเช็คชื่อที่ไม่ใช่วันไม่มีซ้อม หรือเป็นวันซ้อมของทีม) · no_training = กดวันไม่มีซ้อมแล้ว · rest = ไม่ใช่วันซ้อมของทีม
export function dayKind({ session, trainsToday }) {
  if (session?.noTraining) return "no_training";
  return session || trainsToday ? "training" : "rest";
}

export const DAY_KIND_LABEL = { training: "วันซ้อม", no_training: "วันไม่มีซ้อม", rest: "ไม่ใช่วันซ้อมของทีม" };

// input: { today, trainsToday, players, coaches (เฉพาะโค้ชที่อนุมัติแล้วของทีม), sessions (วันนี้), attendance (วันนี้), plans (วันนี้), reports (วันนี้), injuries (ทั้งหมดของทีม), pendingApprovals }
export function adminHomeModel({ today, trainsToday = false, players = [], coaches = [], sessions = [], attendance = [], plans = [], reports = [], injuries = [], pendingApprovals = 0 }) {
  const kind = dayKind({ session: sessions[0], trainsToday });
  const sessionIds = new Set(sessions.map((s) => s.id));
  const statusByPlayer = new Map();
  for (const a of attendance) if (sessionIds.has(a.sessionId) && a.status) statusByPlayer.set(a.playerId, a.status);
  const active = injuries.filter(isInjuryActive);
  const injuredByGroup = new Map();
  for (const r of active) injuredByGroup.set(r.ageGroup, (injuredByGroup.get(r.ageGroup) || 0) + 1);

  const rows = ageGroupsOf(players).map((ageGroup) => {
    const roster = players.filter((p) => p.ageGroup === ageGroup);
    const groupCoaches = coaches.filter((c) => (c.ageGroups || []).includes(ageGroup));
    const checked = roster.filter((p) => statusByPlayer.has(p.id)).length;
    const required = kind === "training";
    const checkin = !required ? "off" : checked >= roster.length && roster.length > 0 ? "done" : checked > 0 ? "partial" : "none";
    const plan = !required ? "off" : plans.some((p) => (p.ageGroups || []).includes(ageGroup)) ? "ok" : "missing";
    const report = !required ? "off" : groupCoaches.length === 0 ? "nocoach" : reports.some((r) => groupCoaches.some((c) => isRecordOfCoach(r, c))) ? "ok" : "missing";
    return {
      ageGroup,
      coaches: groupCoaches.map((c) => c.name ?? "-"),
      playerCount: roster.length,
      checkedCount: checked,
      checkin,
      plan,
      report,
      injured: injuredByGroup.get(ageGroup) || 0
    };
  });

  return {
    today,
    kind,
    rows,
    summary: {
      notChecked: rows.filter((r) => r.checkin === "none" || r.checkin === "partial").length,
      plansMissing: rows.filter((r) => r.plan === "missing").length,
      reportsMissing: rows.filter((r) => r.report === "missing").length,
      injured: active.length,
      pendingApprovals
    }
  };
}

const TONE = { done: "success", ok: "success", partial: "warning", missing: "warning", none: "danger", nocoach: "neutral", off: "neutral" };
const pill = (state, text) => `<span class="badge badge-${TONE[state]}">${escapeHtml(text)}</span>`;

const CHECKIN_TEXT = { done: "เช็คชื่อแล้ว", partial: "เช็คบางส่วน", none: "ยังไม่เช็คชื่อ", off: "-" };
const PLAN_TEXT = { ok: "ส่งแผนแล้ว", missing: "ยังไม่ส่งแผน", off: "-" };
const REPORT_TEXT = { ok: "ส่งรายงานแล้ว", missing: "ยังไม่ส่งรายงาน", nocoach: "ไม่มีโค้ช", off: "-" };

const tile = (label, value, tone, go = "") => {
  const cls = tone ? `admin-home-tile admin-home-tile-${tone}` : "admin-home-tile";
  const body = `<span class="admin-home-tile-label">${escapeHtml(label)}</span><span class="admin-home-tile-value">${value}</span>`;
  return go ? `<button type="button" class="${cls}" data-home-go="${escapeHtml(go)}">${body}</button>` : `<div class="${cls}">${body}</div>`;
};

export function adminHomeHtml(model, { team = "" } = {}) {
  const { summary: s, rows, kind } = model;
  const off = kind !== "training";
  const tone = (n) => (off ? "" : n > 0 ? "warn" : "ok");
  const tiles = [
    tile("รุ่นที่ยังเช็คชื่อไม่ครบ", off ? "-" : s.notChecked, off ? "" : s.notChecked > 0 ? "bad" : "ok"),
    tile("รุ่นที่ยังไม่ส่งแผนฝึก", off ? "-" : s.plansMissing, tone(s.plansMissing)),
    tile("รุ่นที่ยังไม่ส่งรายงานฝึก", off ? "-" : s.reportsMissing, tone(s.reportsMissing)),
    tile("นักกีฬาบาดเจ็บอยู่", s.injured, s.injured > 0 ? "warn" : "ok", "injury"),
    tile("คำขอลงทะเบียนรออนุมัติ", s.pendingApprovals, s.pendingApprovals > 0 ? "warn" : "ok", "approvals")
  ].join("");
  const body =
    rows.length === 0
      ? '<p class="text-sm text-slate-400">ยังไม่มีนักกีฬาในทีมนี้</p>'
      : rows
          .map((r) => {
            const who = r.coaches.length ? escapeHtml(r.coaches.join(", ")) : '<span class="text-slate-400">ยังไม่มีโค้ช</span>';
            const injured = r.injured > 0 ? ` <span class="badge badge-warning">บาดเจ็บ ${r.injured}</span>` : "";
            const done = r.checkin === "off" ? "" : ` <span class="text-xs text-slate-400">${r.checkedCount}/${r.playerCount}</span>`;
            return `<div class="admin-home-row">
          <div class="admin-home-row-who"><strong>${escapeHtml(r.ageGroup)}</strong> <span class="text-sm text-slate-500">${who}</span>${injured}</div>
          <div class="admin-home-row-state">${pill(r.checkin, CHECKIN_TEXT[r.checkin])}${done} ${pill(r.plan, PLAN_TEXT[r.plan])} ${pill(r.report, REPORT_TEXT[r.report])}</div>
        </div>`;
          })
          .join("");
  return `<div class="card card-pad space-y-3">
    <div class="flex items-center justify-between flex-wrap gap-2"><h3 class="section-title">ภาพรวม ${escapeHtml(team)} · วันนี้</h3><span class="badge badge-neutral">${escapeHtml(DAY_KIND_LABEL[kind])}</span></div>
    <div class="admin-home-tiles">${tiles}</div>
    <div class="admin-home-rows">${body}</div>
  </div>`;
}
