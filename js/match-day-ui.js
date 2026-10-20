// หน้าจอ Match Day ในเมนู Attendance Check (ตรรกะล้วนๆ อยู่ที่ match-day.js) — เลือกชนิดวัน "Match Day" แล้วแสดงฟอร์ม 3 ส่วนแทนตารางเช็คชื่อ
//   1. ข้อมูล Match  2. ข้อมูล Game + ตารางนักกีฬาทั้งรุ่น (+ ปุ่มเพิ่มนักกีฬาจากรุ่นอื่น)  3. Match Report
// บันทึกลง matchReports (id คงที่ต่อทีม+วัน+รุ่น) และทำเครื่องหมาย sessions.matchDayAgeGroups ของวันนั้น (ใช้ตัดรุ่นนี้ออกจากสถิติเช็คชื่อซ้อม)
import { collection, getDocs, getDoc, query, where, doc, setDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { icon } from "./icons.js";
import { applyDataLabels, escapeHtml } from "./ui-utils.js";
import { guestAgeGroupOptions, ownGroupCandidates } from "./match-lineup.js";
import {
  COMPETITION_TYPES,
  FORMATION_PRESETS,
  MATCH_FORMATS,
  MATCH_RATING_MAX,
  MATCH_RESULTS,
  POSITION_GROUPS,
  PLAYER_STATUSES,
  buildMatchDayPayload,
  cleanupRows,
  expectedStarters,
  formFromReport,
  matchDayDocId,
  newRow,
  playedIds,
  replacementOptions,
  setReplacement,
  setStatus,
  subInfo,
  validateMatchDay
} from "./match-day.js";

let panel = null;
let ctx = null; // { team, date, ageGroups, coachId, coachName, ensureSession(date) }
let state = null;

const emptyForm = () => ({
  format: "",
  formatOther: "",
  matchTime: "",
  venue: "",
  matchLength: "",
  competitionType: "",
  competition: "",
  opponent: "",
  result: "",
  scoreUs: "",
  scoreThem: "",
  formation: "",
  rows: [],
  oppAttack: "",
  oppDefense: "",
  videoUrl: "",
  notes: ""
});


// ---------- โหลด ----------
async function loadPool() {
  const snap = await getDocs(query(collection(db, "players"), where("team", "==", ctx.team)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function buildOwnRows(pool, ageGroup) {
  return ownGroupCandidates(pool, ageGroup)
    .sort((a, b) => (typeof a.number === "number" ? a.number : Infinity) - (typeof b.number === "number" ? b.number : Infinity))
    .map((p) => newRow(p, ageGroup));
}

async function loadAgeGroup(ageGroup) {
  state.ageGroup = ageGroup;
  state.status = "";
  state.errors = [];
  state.warnings = [];
  state.guest = { open: false, group: "", picked: new Set() };
  const ref = doc(db, "matchReports", matchDayDocId(ctx.team, ctx.date, ageGroup));
  const snap = await getDoc(ref);
  const own = buildOwnRows(state.pool, ageGroup);
  if (snap.exists() && snap.data().matchDay) {
    state.existing = { id: snap.id, ...snap.data() };
    const form = formFromReport(state.existing);
    // นักกีฬารุ่นนี้ที่เพิ่งเข้าทีมหลังบันทึก → เติมเป็นแถว "ไม่มีรายชื่อ" ให้ครบทั้งรุ่น
    const have = new Set(form.rows.map((r) => r.id));
    const ownRows = form.rows.filter((r) => !r.guest);
    const guests = form.rows.filter((r) => r.guest);
    form.rows = [...ownRows, ...own.filter((r) => !have.has(r.id)), ...guests];
    state.form = form;
  } else {
    state.existing = null;
    state.form = { ...emptyForm(), rows: own };
  }
}

// ---------- วาด ----------
function optionHtml(value, label, current) {
  return `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function textField(label, field, value, { placeholder = "", type = "text", cls = "" } = {}) {
  return `<div class="${cls}"><label class="field-label">${label}</label><input type="${type}" class="field-input" data-f="${field}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></div>`;
}

function starsHtml(row) {
  const value = row.rating || 0;
  const stars = Array.from({ length: MATCH_RATING_MAX }, (_, i) => i + 1)
    .map((n) => {
      const fill = value >= n ? 100 : value >= n - 0.5 ? 50 : 0;
      return `<span class="star"><span class="star-bg">★</span><span class="star-fg" style="width:${fill}%">★</span>
        <button type="button" class="star-hit star-hit-left" data-rate="${n - 0.5}" data-row="${escapeHtml(row.id)}" aria-label="${n - 0.5} ดาว"></button>
        <button type="button" class="star-hit star-hit-right" data-rate="${n}" data-row="${escapeHtml(row.id)}" aria-label="${n} ดาว"></button></span>`;
    })
    .join("");
  return `<span class="star-rating">${stars}</span> <span class="text-xs text-slate-500">${value ? value : ""}</span>`;
}

function positionOptions(current) {
  return (
    `<option value="">-</option>` +
    POSITION_GROUPS.map((g) => `<optgroup label="${escapeHtml(g.label)}">${g.positions.map((p) => optionHtml(p, p, current)).join("")}</optgroup>`).join("")
  );
}

function rowHtml(row, rows, played, subs) {
  const id = escapeHtml(row.id);
  const isPlayed = played.has(row.id);
  const statusSel = `<select class="field-input" data-row-status="${id}">${PLAYER_STATUSES.map((s) => optionHtml(s.key, s.label, row.status)).join("")}</select>`;
  const positionSel = row.status === "none" ? "-" : `<select class="field-input" data-row-position="${id}">${positionOptions(row.position)}</select>`;
  const numInput = (field, value) => (isPlayed ? `<input type="number" min="0" class="field-input match-num" data-row="${id}" data-rf="${field}" value="${escapeHtml(value)}" />` : "-");
  const cardInput = (field, value) => (isPlayed ? `<input type="number" min="0" class="field-input match-num" data-row="${id}" data-rf="${field}" value="${escapeHtml(value)}" />` : "-");
  const noteInput = isPlayed ? `<input type="text" class="field-input match-note" data-row="${id}" data-rf="note" value="${escapeHtml(row.note)}" placeholder="หมายเหตุ" />` : "-";
  let subCell = "-";
  let replacedCell = "-";
  const entered = subs.get(row.id);
  if (entered) {
    const out = rows.find((r) => r.id === entered.outId);
    subCell = `<span class="text-blue-700">เข้าแทน ${escapeHtml(out ? out.nickname : "-")} นาที ${escapeHtml(entered.minute || "-")}</span>`;
  } else if (row.status === "sub") {
    subCell = '<span class="text-slate-400">ยังไม่ได้ลง</span>';
  }
  if (isPlayed) {
    const options = replacementOptions(rows, row.id);
    replacedCell = `<div class="flex gap-2 items-center flex-wrap">
      <input type="text" class="field-input match-min" data-row="${id}" data-rf="outMinute" value="${escapeHtml(row.outMinute)}" placeholder="ออก 00:00" inputmode="numeric" />
      <select class="field-input" data-row-replace="${id}"><option value="">-- ไม่มีผู้เข้าแทน --</option>${options.map((o) => optionHtml(o.id, o.nickname, row.replacedBy)).join("")}</select></div>`;
  }
  const rating = isPlayed ? starsHtml(row) : '<span class="text-xs text-slate-400">ไม่ได้ลงสนาม</span>';
  const guestBadge = row.guest ? ` <span class="badge badge-info">${escapeHtml(row.ageGroup)}</span>` : "";
  const remove = row.guest ? `<button type="button" class="btn btn-ghost btn-sm text-red-600" data-guest-remove="${id}">✕ เอาออก</button>` : "";
  return `<tr>
    <td>${row.number ?? "-"}</td>
    <td class="emphasis">${escapeHtml(row.nickname)}${guestBadge}</td>
    <td>${escapeHtml(row.fullName || "-")}</td>
    <td>${statusSel}</td>
    <td>${positionSel}</td>
    <td>${numInput("goals", row.goals)}</td>
    <td>${numInput("assists", row.assists)}</td>
    <td>${cardInput("yellow", row.yellow)}</td>
    <td>${cardInput("red", row.red)}</td>
    <td>${subCell}</td>
    <td>${replacedCell}</td>
    <td>${noteInput}</td>
    <td>${rating}</td>
    <td>${remove}</td>
  </tr>`;
}

function rosterHtml() {
  const rows = state.form.rows;
  const played = playedIds(rows);
  const subs = subInfo(rows);
  const own = rows.filter((r) => !r.guest);
  const guests = rows.filter((r) => r.guest);
  const header = "<tr><th>#</th><th>ชื่อเล่น</th><th>ชื่อจริง</th><th>สถานะ</th><th>ตำแหน่ง</th><th>ประตู</th><th>Assist</th><th>ใบเหลือง</th><th>ใบแดง</th><th>เปลี่ยนตัว</th><th>ถูกเปลี่ยนแทนโดย</th><th>หมายเหตุ</th><th>คะแนน</th><th></th></tr>";
  const body =
    own.map((r) => rowHtml(r, rows, played, subs)).join("") +
    (guests.length > 0 ? `<tr class="match-divider"><td colspan="14">นักกีฬาจากรุ่นอื่น (เพิ่มต่อท้ายรายชื่อรุ่น ${escapeHtml(state.ageGroup)})</td></tr>${guests.map((r) => rowHtml(r, rows, played, subs)).join("")}` : "");
  return `<div class="card table-wrap"><table class="pro-table match-day-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
}

function guestPanelHtml() {
  const g = state.guest;
  if (!g.open) return "";
  const groups = guestAgeGroupOptions(state.pool, state.ageGroup);
  if (groups.length === 0) return '<div class="card card-pad bg-slate-50 text-sm text-slate-500">ไม่มีนักกีฬารุ่นอื่นในทีม</div>';
  if (!g.group || !groups.some((o) => o.ageGroup === g.group)) g.group = groups[0].ageGroup;
  const taken = new Set(state.form.rows.map((r) => r.id));
  const candidates = ownGroupCandidates(state.pool, g.group).filter((p) => !taken.has(p.id));
  const items = candidates
    .map((p) => {
      const checked = g.picked.has(p.id) ? " checked" : "";
      const label = `${p.nickname ?? p.fullName ?? "-"}${p.position === "GK" ? " (GK)" : ""}`;
      return `<label class="match-guest-item" data-search="${escapeHtml(`${p.nickname ?? ""} ${p.fullName ?? ""}`.toLowerCase())}"><input type="checkbox" data-guest-pick="${escapeHtml(p.id)}"${checked} /> ${escapeHtml(label)}</label>`;
    })
    .join("");
  return `<div class="card card-pad bg-slate-50 space-y-3">
    <div class="flex flex-wrap items-end gap-3">
      <div><label class="field-label">เลือกรุ่นอายุ</label>
        <select class="field-input" data-guest-group>${groups.map((o) => optionHtml(o.ageGroup, `${o.ageGroup} (${o.count} คน)`, g.group)).join("")}</select></div>
      <div class="flex-1 min-w-[180px]"><label class="field-label">ค้นหา</label><input type="search" class="field-input" data-guest-search placeholder="ชื่อเล่น/ชื่อจริง" /></div>
      <span class="text-sm text-slate-500" data-guest-count>เลือกแล้ว ${g.picked.size} คน</span>
    </div>
    <div class="flex flex-wrap gap-2">${items || '<span class="text-sm text-slate-400">ไม่มีนักกีฬาให้เลือก (เพิ่มครบทุกคนแล้ว)</span>'}</div>
    <div class="flex gap-2"><button type="button" class="btn btn-primary btn-sm" data-guest-add>เพิ่มลงตาราง</button><button type="button" class="btn btn-secondary btn-sm" data-guest-close>ปิด</button></div>
  </div>`;
}

function render() {
  const f = state.form;
  const expected = f.format ? expectedStarters(f.format, f.formation) : null;
  const starters = f.rows.filter((r) => r.status === "starter").length;
  const presets = f.format && FORMATION_PRESETS[f.format] ? FORMATION_PRESETS[f.format] : [];
  const ageSelect =
    ctx.ageGroups.length > 1
      ? `<div><label class="field-label">รุ่นอายุ</label><select class="field-input" data-age-group>${ctx.ageGroups.map((g) => optionHtml(g, g, state.ageGroup)).join("")}</select></div>`
      : `<div><label class="field-label">รุ่นอายุ</label><p class="font-semibold pt-2">${escapeHtml(state.ageGroup)}</p></div>`;
  const resultButtons = MATCH_RESULTS.map((r) => {
    const cls = f.result === r ? "segmented-btn active" : "segmented-btn";
    return `<button type="button" class="${cls}" data-result="${r}" aria-pressed="${f.result === r}">${r}</button>`;
  }).join("");
  const statusCls = state.statusError ? "text-sm text-red-600" : "text-sm text-slate-500";
  const messages = [
    ...state.errors.map((e) => `<li class="text-red-600">${escapeHtml(e)}</li>`),
    ...state.warnings.map((w) => `<li class="text-amber-700">เตือน: ${escapeHtml(w)}</li>`)
  ].join("");
  panel.innerHTML = `
    <div class="space-y-6">
      <div class="card card-pad flex flex-wrap items-end gap-4">${ageSelect}<p class="text-sm text-slate-500">วันที่ ${escapeHtml(ctx.date)} · ${state.existing ? "มีข้อมูล Match Day ที่บันทึกไว้แล้ว (แก้ไขได้)" : "ยังไม่ได้บันทึก Match Day ของรุ่นนี้"}</p></div>

      <div class="card card-pad space-y-4">
        <h3 class="section-title">ส่วนที่ 1 · ข้อมูล Match</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label class="field-label">ประเภทการแข่งขัน</label>
            <select class="field-input" data-f="format"><option value="">-- เลือก --</option>${MATCH_FORMATS.map((m) => optionHtml(m.key, m.label, f.format)).join("")}</select></div>
          ${f.format === "other" ? textField("ระบุประเภทการแข่งขัน", "formatOther", f.formatOther, { placeholder: "เช่น 5v5, 8v8" }) : "<div></div>"}
          <div><label class="field-label">ประเภทรายการ</label>
            <select class="field-input" data-f="competitionType"><option value="">-- เลือก --</option>${COMPETITION_TYPES.map((t) => optionHtml(t, t, f.competitionType)).join("")}</select></div>
          ${textField("ชื่อรายการ", "competition", f.competition, { placeholder: "เช่น Thailand Youth League" })}
          ${textField("คู่แข่ง", "opponent", f.opponent, { placeholder: "ชื่อทีมคู่แข่ง", cls: "sm:col-span-2" })}
          ${textField("เวลาแข่ง (ไม่บังคับ)", "matchTime", f.matchTime, { type: "time" })}
          ${textField("สถานที่ (ไม่บังคับ)", "venue", f.venue, { placeholder: "เช่น สนาม A" })}
          ${textField("ความยาวการแข่งขัน นาที (ไม่บังคับ — ใช้คำนวณนาทีที่ลงเล่น)", "matchLength", f.matchLength, { type: "number", placeholder: "เช่น 80", cls: "sm:col-span-2" })}
        </div>
      </div>

      <div class="card card-pad space-y-4">
        <h3 class="section-title">ส่วนที่ 2 · ข้อมูล Game</h3>
        <div class="flex flex-wrap items-end gap-4">
          <div><label class="field-label">ผลการแข่งขัน</label><div class="segmented">${resultButtons}</div></div>
          <div><label class="field-label">ประตูทีมเรา</label><input type="number" min="0" class="field-input w-24" data-f="scoreUs" value="${escapeHtml(f.scoreUs)}" /></div>
          <div><label class="field-label">ประตูคู่แข่ง</label><input type="number" min="0" class="field-input w-24" data-f="scoreThem" value="${escapeHtml(f.scoreThem)}" /></div>
          <div><label class="field-label">แผนการเล่น</label>
            <input type="text" class="field-input w-40" data-f="formation" list="match-day-formations" value="${escapeHtml(f.formation)}" placeholder="เช่น 4-3-3" />
            <datalist id="match-day-formations">${presets.map((p) => `<option value="${p}"></option>`).join("")}</datalist></div>
        </div>
        <p class="text-xs text-slate-400">แผนการเล่นต้องสอดคล้องกับประเภทการแข่งขัน (7v7 = ผู้เล่นนอกประตูรวม 6 · 9v9 = 8 · 11v11 = 10) · ผู้เล่นตัวจริงตอนนี้ ${starters}${expected ? `/${expected}` : ""} คน</p>
        ${rosterHtml()}
        <p class="text-xs text-slate-400">เมื่อเลือก "ถูกเปลี่ยนแทนโดย" ที่แถวผู้เล่นที่ออก แถวผู้เล่นที่เข้าแทนจะขึ้น "เข้าแทน ... นาที ..." เอง · ให้คะแนนได้เฉพาะคนที่ได้ลงสนาม คลิกที่ดาวครึ่งซ้าย/ครึ่งขวาเพื่อเพิ่มลดทีละครึ่งดาว คลิกค่าเดิมซ้ำเพื่อล้าง</p>
        <div><button type="button" class="btn btn-secondary" data-guest-toggle>+ เพิ่มนักกีฬาจากรุ่นอื่น</button></div>
        ${guestPanelHtml()}
      </div>

      <div class="card card-pad space-y-4">
        <h3 class="section-title">ส่วนที่ 3 · Match Report</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label class="field-label">รูปแบบการเล่นเกมรุกของคู่แข่ง</label><textarea rows="3" class="field-input" data-f="oppAttack">${escapeHtml(f.oppAttack)}</textarea></div>
          <div><label class="field-label">รูปแบบการเล่นเกมรับของคู่แข่ง</label><textarea rows="3" class="field-input" data-f="oppDefense">${escapeHtml(f.oppDefense)}</textarea></div>
          ${textField("ลิงก์สำหรับดูการแข่งขันย้อนหลัง (ถ้ามี)", "videoUrl", f.videoUrl, { placeholder: "https://..." })}
          <div><label class="field-label">ความคิดเห็นเพิ่มเติม (ถ้ามี)</label><textarea rows="3" class="field-input" data-f="notes">${escapeHtml(f.notes)}</textarea></div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn btn-primary" data-save>${state.existing ? "บันทึกการแก้ไข Match Day" : "บันทึก Match Day"}</button>
        ${state.existing ? `<button type="button" class="btn btn-danger-soft" data-delete>${icon("trash")} ลบ Match Day นี้</button>` : ""}
        <span class="${statusCls}">${escapeHtml(state.status)}</span>
      </div>
      ${messages ? `<ul class="text-sm space-y-1 list-disc pl-5">${messages}</ul>` : ""}
    </div>`;
  const tbody = panel.querySelector(".match-day-table tbody");
  if (tbody) applyDataLabels(tbody);
}

// ---------- เหตุการณ์ ----------
function onInput(e) {
  const t = e.target;
  if (t.dataset.f && t.tagName !== "SELECT") {
    state.form[t.dataset.f] = t.value;
    return;
  }
  if (t.dataset.rf) {
    const row = state.form.rows.find((r) => r.id === t.dataset.row);
    if (row) row[t.dataset.rf] = t.value;
    return;
  }
  if (t.dataset.guestSearch !== undefined) {
    const q = t.value.trim().toLowerCase();
    for (const item of panel.querySelectorAll(".match-guest-item")) item.classList.toggle("hidden", q !== "" && !item.dataset.search.includes(q));
  }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.f && t.tagName === "SELECT") {
    state.form[t.dataset.f] = t.value;
    render();
  } else if (t.dataset.rowStatus) {
    state.form.rows = setStatus(state.form.rows, t.dataset.rowStatus, t.value);
    render();
  } else if (t.dataset.rowPosition) {
    const row = state.form.rows.find((r) => r.id === t.dataset.rowPosition);
    if (row) row.position = t.value;
  } else if (t.dataset.rowReplace) {
    state.form.rows = setReplacement(state.form.rows, t.dataset.rowReplace, t.value);
    render();
  } else if (t.dataset.ageGroup !== undefined) {
    switchAgeGroup(t.value);
  } else if (t.dataset.guestGroup !== undefined) {
    state.guest.group = t.value;
    state.guest.picked = new Set();
    render();
  } else if (t.dataset.guestPick) {
    if (t.checked) state.guest.picked.add(t.dataset.guestPick);
    else state.guest.picked.delete(t.dataset.guestPick);
    const counter = panel.querySelector("[data-guest-count]");
    if (counter) counter.textContent = `เลือกแล้ว ${state.guest.picked.size} คน`;
  }
}

async function switchAgeGroup(group) {
  panel.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  await loadAgeGroup(group);
  render();
}

async function save() {
  const { errors, warnings } = validateMatchDay(state.form);
  state.errors = errors;
  state.warnings = warnings;
  state.status = "";
  if (errors.length > 0) {
    state.status = "ยังบันทึกไม่ได้ — ตรวจรายการด้านล่าง";
    state.statusError = true;
    render();
    return;
  }
  if (warnings.length > 0 && !confirm(`มีข้อสังเกต:\n- ${warnings.join("\n- ")}\n\nบันทึกต่อหรือไม่?`)) return;
  state.statusError = false;
  state.status = "กำลังบันทึก...";
  render();
  try {
    const id = matchDayDocId(ctx.team, ctx.date, state.ageGroup);
    const payload = buildMatchDayPayload(state.form, state.ageGroup);
    await setDoc(doc(db, "matchReports", id), {
      ...payload,
      team: ctx.team,
      date: ctx.date,
      coachId: ctx.coachId,
      coachName: ctx.coachName,
      createdAt: state.existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const session = await ctx.ensureSession(ctx.date);
    await setDoc(doc(db, "sessions", session.id), { matchDayAgeGroups: arrayUnion(state.ageGroup), updatedAt: serverTimestamp() }, { merge: true });
    const snap = await getDoc(doc(db, "matchReports", id));
    state.existing = { id, ...snap.data() };
    state.status = "บันทึก Match Day แล้ว ✓";
  } catch (err) {
    console.error(err);
    state.statusError = true;
    state.status = "บันทึกไม่สำเร็จ: " + err.message;
  }
  render();
}

async function removeMatchDay() {
  if (!state.existing || !confirm(`ยืนยันลบ Match Day วันที่ ${ctx.date} รุ่น ${state.ageGroup} กับ ${state.existing.opponent}?\nการลบนี้ไม่สามารถย้อนกลับได้`)) return;
  try {
    await deleteDoc(doc(db, "matchReports", state.existing.id));
    const session = await ctx.ensureSession(ctx.date);
    await setDoc(doc(db, "sessions", session.id), { matchDayAgeGroups: arrayRemove(state.ageGroup), updatedAt: serverTimestamp() }, { merge: true });
    await loadAgeGroup(state.ageGroup);
    state.status = "ลบ Match Day แล้ว";
    state.statusError = false;
  } catch (err) {
    console.error(err);
    state.statusError = true;
    state.status = "ลบไม่สำเร็จ: " + err.message;
  }
  render();
}

function onClick(e) {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.result) {
    state.form.result = state.form.result === t.dataset.result ? "" : t.dataset.result;
    render();
  } else if (t.dataset.rate) {
    const row = state.form.rows.find((r) => r.id === t.dataset.row);
    const value = Number(t.dataset.rate);
    if (row) row.rating = row.rating === value ? null : value;
    render();
  } else if (t.dataset.guestToggle !== undefined) {
    state.guest.open = !state.guest.open;
    render();
  } else if (t.dataset.guestClose !== undefined) {
    state.guest.open = false;
    state.guest.picked = new Set();
    render();
  } else if (t.dataset.guestAdd !== undefined) {
    const picked = state.pool.filter((p) => state.guest.picked.has(p.id));
    state.form.rows = [...state.form.rows, ...picked.map((p) => newRow(p, state.ageGroup))];
    state.guest.picked = new Set();
    render();
  } else if (t.dataset.guestRemove) {
    // เอานักกีฬาที่เพิ่มมาออก: ความเชื่อมเปลี่ยนตัวที่ชี้มาที่เขาถูกล้างเองโดย cleanupRows
    state.form.rows = cleanupRows(state.form.rows.filter((r) => r.id !== t.dataset.guestRemove));
    render();
  } else if (t.dataset.save !== undefined) {
    save();
  } else if (t.dataset.delete !== undefined) {
    removeMatchDay();
  }
}

// ---------- ทางเข้า ----------
export function initMatchDay(panelEl) {
  panel = panelEl;
  panel.addEventListener("input", onInput);
  panel.addEventListener("change", onChange);
  panel.addEventListener("click", onClick);
}

// c = { team, date, ageGroups (รุ่นที่ดูแล — ว่าง = ทุกรุ่นที่มีนักกีฬา), initialAgeGroup (เปิดรุ่นนี้ก่อน ถ้ามี), coachId, coachName, ensureSession(date) }
export async function openMatchDay(c) {
  ctx = { ...c };
  panel.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const pool = await loadPool();
    const groups = ctx.ageGroups.length > 0 ? ctx.ageGroups : [...new Set(pool.map((p) => p.ageGroup).filter(Boolean))].sort();
    if (groups.length === 0) {
      panel.innerHTML = '<div class="card card-pad text-slate-500">ยังไม่มีนักกีฬาในทีม — เพิ่มนักกีฬาที่เมนู Player Data ก่อน</div>';
      return;
    }
    ctx.ageGroups = groups;
    const first = groups.includes(ctx.initialAgeGroup) ? ctx.initialAgeGroup : groups[0];
    state = { pool, ageGroup: first, form: emptyForm(), existing: null, errors: [], warnings: [], status: "", statusError: false, guest: { open: false, group: "", picked: new Set() } };
    await loadAgeGroup(first);
    render();
  } catch (err) {
    console.error(err);
    panel.innerHTML = `<div class="card card-pad text-red-600">โหลด Match Day ไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}
