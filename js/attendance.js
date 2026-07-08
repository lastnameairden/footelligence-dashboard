import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-init.js";
import { applyDataLabels, SCORE_CATEGORIES, computeAvgScore, isPlayerFullyEvaluated } from "./ui-utils.js";

const STATUS_OPTIONS = ["A", "I", "R", "P"];
const SCORE_OPTIONS = [1, 2, 3, 4];
const TEAMS = ["KHAMPHEE FOOTBALL", "THAWEE SC", "THAMMASATHIT"];

for (let i = 0; i < SCORE_CATEGORIES.length; i++) {
  const th = document.getElementById(`score-header-${i}`);
  if (th) {
    th.textContent = SCORE_CATEGORIES[i].short;
    th.title = SCORE_CATEGORIES[i].label;
  }
}

const loginSection = document.getElementById("login-section");
const brandHero = document.getElementById("brand-hero");
const coachBar = document.getElementById("coach-bar");
const menuSection = document.getElementById("menu-section");
const menuBackBtn = document.getElementById("menu-back-btn");
const addPlayerSection = document.getElementById("add-player-section");
const checkinSection = document.getElementById("checkin-section");
const menuAddPlayerBtn = document.getElementById("menu-add-player");
const menuCheckinBtn = document.getElementById("menu-checkin");
const menuReportBtn = document.getElementById("menu-report");
const reportSection = document.getElementById("report-section");
const reportDateInput = document.getElementById("report-date");
const reportLoadBtn = document.getElementById("report-load-btn");
const reportLoadStatus = document.getElementById("report-load-status");
const reportForm = document.getElementById("report-form");
const reportPeriodSection = document.getElementById("report-period-section");
const reportPeriodSegmentedWrap = document.getElementById("report-period-segmented");
const reportPeriodDetailWrap = document.getElementById("report-period-detail-wrap");
const reportAttendSegmentedWrap = document.getElementById("report-attend-segmented");
const reportNotesInput = document.getElementById("report-notes");
const reportSubmitBtn = document.getElementById("report-submit-btn");
const reportStatus = document.getElementById("report-status");
const backButtons = document.querySelectorAll("[data-back]");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const registerForm = document.getElementById("register-form");
const registerError = document.getElementById("register-error");
const registerAgeGroupWrap = document.getElementById("register-age-group-wrap");
const registerAgeGroupSelect = document.getElementById("register-age-group");
const pendingSection = document.getElementById("pending-section");
const pendingLogoutBtn = document.getElementById("pending-logout-btn");
const executiveSection = document.getElementById("executive-section");
const coachNameEl = document.getElementById("coach-name");
const coachEmailEl = document.getElementById("coach-email");
const coachTeamEl = document.getElementById("coach-team");
const coachPhoneWrap = document.getElementById("coach-phone-wrap");
const coachPhoneEl = document.getElementById("coach-phone");
const coachStatusBadgeEl = document.getElementById("coach-status-badge");
const coachAgeGroupsEl = document.getElementById("coach-age-groups");
const coachAgeGroupsWrap = document.getElementById("coach-age-groups-wrap");
const coachRoleBadgeEl = document.getElementById("coach-role-badge");
const adminPanelLink = document.getElementById("admin-panel-link");
const adminMenuSection = document.getElementById("admin-menu-section");
const adminCoachesSection = document.getElementById("admin-coaches-section");
const adminProgressSection = document.getElementById("admin-progress-section");
const adminApprovalsSection = document.getElementById("admin-approvals-section");
const adminManageTeamSection = document.getElementById("admin-manage-team-section");
const adminDashboardSection = document.getElementById("admin-dashboard-section");
const adminPrintSection = document.getElementById("admin-print-section");
const adminMenuCoachesBtn = document.getElementById("admin-menu-coaches");
const adminMenuProgressBtn = document.getElementById("admin-menu-progress");
const adminMenuApprovalsBtn = document.getElementById("admin-menu-approvals");
const adminMenuManageTeamBtn = document.getElementById("admin-menu-manage-team");
const adminMenuDashboardBtn = document.getElementById("admin-menu-dashboard");
const adminMenuPrintBtn = document.getElementById("admin-menu-print");
const adminBackButtons = document.querySelectorAll("[data-admin-back]");
const pendingApprovalsBody = document.getElementById("pending-approvals-body");
const adminTeamSelect = document.getElementById("admin-team-select");
const adminSelectTeamBtn = document.getElementById("admin-select-team-btn");
const adminDashboardTeamSelect = document.getElementById("admin-dashboard-team-select");
const adminViewDashboardBtn = document.getElementById("admin-view-dashboard-btn");
const adminPrintTeamSelect = document.getElementById("admin-print-team-select");
const adminPrintAgeGroupSelect = document.getElementById("admin-print-age-group-select");
const adminGeneratePrintBtn = document.getElementById("admin-generate-print-btn");
const adminPrintStatus = document.getElementById("admin-print-status");
const adminStatus = document.getElementById("admin-status");
const menuDashboardCard = document.getElementById("menu-dashboard-card");
const menuCardsGrid = document.getElementById("menu-cards-grid");
const dateInput = document.getElementById("session-date");
const loadSessionBtn = document.getElementById("load-session-btn");
const markNoTrainingBtn = document.getElementById("mark-no-training-btn");
const noTrainingBanner = document.getElementById("no-training-banner");
const undoNoTrainingBtn = document.getElementById("undo-no-training-btn");
const rosterWrap = document.getElementById("roster-wrap");
const rosterLockedBanner = document.getElementById("roster-locked-banner");
const rosterBody = document.getElementById("roster-table-body");
const attendanceStatus = document.getElementById("attendance-status");
const addPlayerForm = document.getElementById("add-player-form");
const addPlayerStatus = document.getElementById("add-player-status");
const addPlayerSubmitBtn = document.getElementById("add-player-submit-btn");
const cancelEditPlayerBtn = document.getElementById("cancel-edit-player-btn");
const playerListBody = document.getElementById("player-list-body");
const coachDirectoryBody = document.getElementById("coach-directory-body");
const progressDateInput = document.getElementById("progress-date-input");
const progressRefreshBtn = document.getElementById("progress-refresh-btn");
const progressTableBody = document.getElementById("progress-table-body");
const progressPie = document.getElementById("progress-pie");
const progressLegend = document.getElementById("progress-legend");

const SUBMISSION_DEADLINE_HOUR = 20; // ต้องส่งข้อมูล/ประเมินภายใน 20:00 น. ของวันนั้น

let currentSessionId = null;
let currentSessionData = null;
let currentAttendanceMap = new Map();
let myTeam = null;
let myCoachName = null;
let myAgeGroup = null; // รุ่นอายุที่โค้ชคนนี้รับผิดชอบ (ถ้ามี) — ล็อกช่องเลือกรุ่นอายุตอนเพิ่มนักกีฬาให้เหลือรุ่นเดียว
let players = [];
let editingPlayerId = null;
let currentIsAdmin = false;
let currentReportId = null;

function setAttendanceStatus(message, isError = false) {
  attendanceStatus.textContent = message;
  attendanceStatus.className = isError
    ? "text-sm text-red-600"
    : "text-sm text-slate-500";
}

const AUTH_ERROR_TH = {
  "auth/email-already-in-use": "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทน",
  "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
  "auth/weak-password": "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)",
  "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/user-not-found": "ไม่พบบัญชีนี้"
};
function authErrorMessage(err) {
  return AUTH_ERROR_TH[err.code] || err.message;
}

// ---------- Login (รองรับอีเมล หรือ เบอร์โทรศัพท์) ----------
function normalizePhone(v) {
  return v.replace(/\D/g, "");
}
function looksLikeEmail(v) {
  return v.includes("@");
}
async function resolveLoginEmail(identifier) {
  if (looksLikeEmail(identifier)) return identifier;
  const phone = normalizePhone(identifier);
  const snap = await getDoc(doc(db, "phoneIndex", phone));
  if (!snap.exists()) {
    throw new Error("ไม่พบบัญชีที่ใช้เบอร์โทรศัพท์นี้");
  }
  return snap.data().email;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    const email = await resolveLoginEmail(identifier);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "เข้าสู่ระบบไม่สำเร็จ: " + (err.code ? authErrorMessage(err) : err.message);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));
pendingLogoutBtn.addEventListener("click", () => signOut(auth));

// ---------- สลับแท็บ เข้าสู่ระบบ / ลงทะเบียน ----------
function setActiveTab(activeBtn, inactiveBtn) {
  activeBtn.className = "tab-btn tab-btn-active";
  inactiveBtn.className = "tab-btn";
}
tabLogin.addEventListener("click", () => {
  setActiveTab(tabLogin, tabRegister);
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});
tabRegister.addEventListener("click", () => {
  setActiveTab(tabRegister, tabLogin);
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
});

// ---------- ลงทะเบียนใหม่ (โค้ช หรือ ผู้บริหารทีม) ----------
// รุ่นอายุที่รับผิดชอบ ระบุได้เฉพาะตอนลงทะเบียนเป็นโค้ชเท่านั้น (ผู้บริหารทีมดูภาพรวมทั้งทีม ไม่ผูกกับรุ่นใดรุ่นหนึ่ง)
function updateRegisterAgeGroupVisibility() {
  const role = document.querySelector('input[name="register-role"]:checked').value;
  registerAgeGroupWrap.classList.toggle("hidden", role !== "coach");
}
for (const radio of document.querySelectorAll('input[name="register-role"]')) {
  radio.addEventListener("change", updateRegisterAgeGroupVisibility);
}
updateRegisterAgeGroupVisibility();

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerError.textContent = "";
  const role = document.querySelector('input[name="register-role"]:checked').value;
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const phoneRaw = document.getElementById("register-phone").value.trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const password = document.getElementById("register-password").value;
  const passwordConfirm = document.getElementById("register-password-confirm").value;
  const ageGroup = registerAgeGroupSelect.value;

  if (password !== passwordConfirm) {
    registerError.textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    return;
  }

  if (role === "coach" && !ageGroup) {
    registerError.textContent = "กรุณาเลือกรุ่นอายุที่รับผิดชอบ";
    return;
  }

  if (phone) {
    const existingPhone = await getDoc(doc(db, "phoneIndex", phone));
    if (existingPhone.exists()) {
      registerError.textContent = "เบอร์โทรศัพท์นี้มีผู้ใช้งานแล้ว กรุณาใช้เบอร์อื่นหรือเว้นว่างไว้";
      return;
    }
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const payload = { name, email, role, status: "pending", createdAt: serverTimestamp() };
    if (phone) payload.phone = phone;
    if (role === "coach") payload.ageGroup = ageGroup;
    await setDoc(doc(db, "coaches", cred.user.uid), payload);
    if (phone) {
      await setDoc(doc(db, "phoneIndex", phone), { email });
    }
    registerForm.reset();
    // onAuthStateChanged จะทำงานต่อเองและแสดงหน้า "รอผู้ดูแลระบบอนุมัติ"
  } catch (err) {
    registerError.textContent = "ลงทะเบียนไม่สำเร็จ: " + authErrorMessage(err);
  }
});

function hideAllScreens() {
  pendingSection.classList.add("hidden");
  executiveSection.classList.add("hidden");
  adminMenuSection.classList.add("hidden");
  adminCoachesSection.classList.add("hidden");
  adminProgressSection.classList.add("hidden");
  adminApprovalsSection.classList.add("hidden");
  adminManageTeamSection.classList.add("hidden");
  adminDashboardSection.classList.add("hidden");
  adminPrintSection.classList.add("hidden");
  menuSection.classList.add("hidden");
  addPlayerSection.classList.add("hidden");
  checkinSection.classList.add("hidden");
  reportSection.classList.add("hidden");
}

function showMenu() {
  hideAllScreens();
  menuSection.classList.remove("hidden");
}

function populateTeamSelect(selectEl, placeholder) {
  selectEl.innerHTML =
    (placeholder ? `<option value="">${placeholder}</option>` : "") +
    TEAMS.map((t) => `<option value="${t}">${t}</option>`).join("");
}

// เมนูผู้ดูแลระบบ: แสดงเป็นการ์ดให้เลือกทำทีละอย่าง (ไม่โหลดข้อมูลทุกส่วนพร้อมกันเหมือนก่อน)
// ข้อมูลของแต่ละส่วนจะโหลดก็ต่อเมื่อกดเข้าไปดูจริงๆ เท่านั้น ดู handler ของปุ่มการ์ดแต่ละอันด้านล่าง
function showAdminPanel() {
  hideAllScreens();
  adminMenuSection.classList.remove("hidden");
}

adminMenuCoachesBtn.addEventListener("click", () => {
  hideAllScreens();
  adminCoachesSection.classList.remove("hidden");
  loadCoachDirectory();
});

adminMenuProgressBtn.addEventListener("click", () => {
  hideAllScreens();
  adminProgressSection.classList.remove("hidden");
  if (!progressDateInput.value) {
    progressDateInput.value = new Date().toISOString().slice(0, 10);
  }
  loadDailyProgress(progressDateInput.value);
});

adminMenuApprovalsBtn.addEventListener("click", () => {
  hideAllScreens();
  adminApprovalsSection.classList.remove("hidden");
  loadPendingApprovals();
});

adminMenuManageTeamBtn.addEventListener("click", () => {
  hideAllScreens();
  adminManageTeamSection.classList.remove("hidden");
  populateTeamSelect(adminTeamSelect, null);
});

adminMenuDashboardBtn.addEventListener("click", () => {
  hideAllScreens();
  adminDashboardSection.classList.remove("hidden");
  // มีตัวเลือก "ทุกทีม (ภาพรวม)" เพิ่มจากทีมเดี่ยว เพราะหน้า Dashboard เองตัดตัวเลือกทีมออกไปแล้ว
  // (เลือกทีมได้ที่นี่จุดเดียว)
  adminDashboardTeamSelect.innerHTML =
    '<option value="">-- เลือกทีม --</option>' +
    '<option value="__ALL__">ทุกทีม (ภาพรวม)</option>' +
    TEAMS.map((t) => `<option value="${t}">${t}</option>`).join("");
});

adminMenuPrintBtn.addEventListener("click", () => {
  hideAllScreens();
  adminPrintSection.classList.remove("hidden");
  populateTeamSelect(adminPrintTeamSelect, null);
  adminPrintAgeGroupSelect.value = "__ALL__";
  adminPrintStatus.textContent = "";
});

adminGeneratePrintBtn.addEventListener("click", () => {
  const team = adminPrintTeamSelect.value;
  if (!team) {
    adminPrintStatus.textContent = "กรุณาเลือกทีมก่อน";
    return;
  }
  const ageGroup = adminPrintAgeGroupSelect.value;
  adminPrintStatus.textContent = "";
  // ใช้ "/print" (ไม่ใช่ "/print.html") ตรงๆ เหมือนหน้า Dashboard เพราะเซิร์ฟเวอร์แบบ clean-url
  // จะ redirect ไฟล์ .html ไปที่ path ไม่มีนามสกุล และอาจตัด query string ทิ้งระหว่างทาง
  window.location.href = `${window.location.origin}/print?team=${encodeURIComponent(team)}&ageGroup=${encodeURIComponent(ageGroup)}`;
});

for (const btn of adminBackButtons) {
  btn.addEventListener("click", showAdminPanel);
}

// ล็อกช่องเลือกรุ่นอายุของนักกีฬาให้เหลือเฉพาะรุ่นที่โค้ชคนนี้รับผิดชอบ (ถ้ามีการระบุไว้ตอนลงทะเบียน)
// ผู้ดูแลระบบที่จัดการแทนโค้ช หรือโค้ชเก่าที่ลงทะเบียนก่อนมีฟีเจอร์นี้ (myAgeGroup ว่าง) เลือกได้อิสระตามเดิม
function applyAgeGroupLock() {
  const select = document.getElementById("player-age-group");
  if (myAgeGroup) {
    select.value = myAgeGroup;
    select.disabled = true;
  } else {
    select.disabled = false;
  }
}

menuAddPlayerBtn.addEventListener("click", () => {
  menuSection.classList.add("hidden");
  addPlayerSection.classList.remove("hidden");
  applyAgeGroupLock();
  renderPlayerList();
});

menuCheckinBtn.addEventListener("click", () => {
  menuSection.classList.add("hidden");
  checkinSection.classList.remove("hidden");
  showRosterView();
});

menuReportBtn.addEventListener("click", () => {
  menuSection.classList.add("hidden");
  reportSection.classList.remove("hidden");
  reportForm.classList.add("hidden");
  reportStatus.textContent = "";
  reportLoadStatus.textContent = "";
  if (!reportDateInput.value) {
    reportDateInput.value = new Date().toISOString().slice(0, 10);
  }
});

for (const btn of backButtons) {
  btn.addEventListener("click", () => {
    if (editingPlayerId) stopEditPlayer();
    currentIsAdmin ? showAdminPanel() : showMenu();
  });
}

adminPanelLink.addEventListener("click", showAdminPanel);

// ---------- ผู้ดูแลระบบ: อนุมัติ/ปฏิเสธคำขอลงทะเบียน ----------
function roleLabel(role) {
  if (role === "admin") return '<span class="badge badge-info">ผู้ดูแลระบบ</span>';
  if (role === "executive") return '<span class="badge badge-neutral">ผู้บริหารทีม</span>';
  return '<span class="badge badge-success">โค้ช</span>';
}

async function loadPendingApprovals() {
  pendingApprovalsBody.innerHTML =
    '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const q = query(collection(db, "coaches"), where("status", "==", "pending"));
  const snapshot = await getDocs(q);
  const pending = [];
  snapshot.forEach((docSnap) => pending.push({ id: docSnap.id, ...docSnap.data() }));

  if (pending.length === 0) {
    pendingApprovalsBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ไม่มีคำขอที่รอการอนุมัติ</td></tr>';
    return;
  }

  pendingApprovalsBody.innerHTML = "";
  for (const c of pending) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="emphasis">${c.name ?? "-"}</td>
      <td>${c.email ?? "-"}</td>
      <td>${roleLabel(c.role)}</td>
    `;

    const teamTd = document.createElement("td");
    const teamSelect = document.createElement("select");
    teamSelect.className = "field-input w-48";
    populateTeamSelect(teamSelect, "-- เลือกทีม --");
    teamTd.appendChild(teamSelect);
    tr.appendChild(teamTd);

    const actionTd = document.createElement("td");
    actionTd.className = "space-x-2";

    const approveBtn = document.createElement("button");
    approveBtn.textContent = "กำหนดทีม + อนุมัติ";
    approveBtn.className = "btn btn-success btn-sm";
    approveBtn.addEventListener("click", () => approveCoach(c.id, teamSelect.value));

    const rejectBtn = document.createElement("button");
    rejectBtn.textContent = "ปฏิเสธ";
    rejectBtn.className = "btn btn-danger-soft btn-sm";
    rejectBtn.addEventListener("click", () => rejectCoach(c.id));

    actionTd.appendChild(approveBtn);
    actionTd.appendChild(rejectBtn);
    tr.appendChild(actionTd);
    pendingApprovalsBody.appendChild(tr);
  }
  applyDataLabels(pendingApprovalsBody);
}

async function approveCoach(coachId, team) {
  if (!team) {
    adminStatus.textContent = "กรุณาเลือกทีมก่อนอนุมัติ";
    adminStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  try {
    await updateDoc(doc(db, "coaches", coachId), { status: "approved", team });
    adminStatus.textContent = "อนุมัติเรียบร้อย ✓";
    adminStatus.className = "text-sm text-emerald-600 w-full";
    await loadPendingApprovals();
    await loadCoachDirectory();
  } catch (err) {
    console.error(err);
    adminStatus.textContent = "อนุมัติไม่สำเร็จ: " + err.message;
    adminStatus.className = "text-sm text-red-600 w-full";
  }
}

async function rejectCoach(coachId) {
  try {
    await deleteDoc(doc(db, "coaches", coachId));
    adminStatus.textContent = "ปฏิเสธคำขอเรียบร้อย";
    adminStatus.className = "text-sm text-slate-500 w-full";
    await loadPendingApprovals();
  } catch (err) {
    console.error(err);
    adminStatus.textContent = "ปฏิเสธไม่สำเร็จ: " + err.message;
    adminStatus.className = "text-sm text-red-600 w-full";
  }
}

// ---------- ผู้ดูแลระบบ: รายชื่อโค้ช + % ส่งข้อมูลตรงเวลา ----------
// เกณฑ์: แต่ละ session (วัน) ถือว่า "ตรงเวลา" ถ้าเวลาบันทึกล่าสุด (สร้าง session หรือให้คะแนนผู้เล่นคนสุดท้าย
// หรือทำเครื่องหมาย "ไม่มีฝึกซ้อม") อยู่ก่อน 20:00 น. ของวันที่ระบุไว้ใน session นั้น
function sessionLatestActivity(session, attendanceForSession) {
  let latest = null;
  const consider = (ts) => {
    if (!ts || typeof ts.toDate !== "function") return;
    const d = ts.toDate();
    if (!latest || d > latest) latest = d;
  };
  consider(session.createdAt);
  consider(session.updatedAt);
  for (const a of attendanceForSession) consider(a.updatedAt);
  return latest;
}

function isSessionOnTime(session, attendanceForSession) {
  const latest = sessionLatestActivity(session, attendanceForSession);
  if (!latest || !session.date) return false;
  const deadline = new Date(`${session.date}T${String(SUBMISSION_DEADLINE_HOUR).padStart(2, "0")}:00:00`);
  return latest <= deadline;
}

async function loadCoachDirectory() {
  coachDirectoryBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const [coachSnap, sessionSnap, attendanceSnap] = await Promise.all([
    getDocs(collection(db, "coaches")),
    getDocs(collection(db, "sessions")),
    getDocs(collection(db, "attendance"))
  ]);

  const coaches = [];
  coachSnap.forEach((d) => coaches.push({ id: d.id, ...d.data() }));
  const sessions = [];
  sessionSnap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
  const attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));

  if (coaches.length === 0) {
    coachDirectoryBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ยังไม่มีโค้ชในระบบ</td></tr>';
    return;
  }

  coachDirectoryBody.innerHTML = "";
  for (const c of coaches) {
    const teamSessions = sessions.filter((s) => s.team === c.team);
    let onTimeCount = 0;
    for (const s of teamSessions) {
      const attendanceForSession = attendanceRecords.filter((a) => a.sessionId === s.id);
      if (isSessionOnTime(s, attendanceForSession)) onTimeCount += 1;
    }
    const percentText =
      teamSessions.length > 0 ? `${Math.round((onTimeCount / teamSessions.length) * 100)}% (${onTimeCount}/${teamSessions.length} วัน)` : "-";
    const statusBadge =
      c.role === "admin"
        ? '<span class="badge badge-info">ผู้ดูแลระบบ</span>'
        : c.status === "approved"
          ? '<span class="badge badge-success">อนุมัติแล้ว</span>'
          : '<span class="badge badge-warning">รอการอนุมัติ</span>';

    const tr = document.createElement("tr");

    const roleTd = document.createElement("td");
    roleTd.innerHTML = roleLabel(c.role);

    const teamTd = document.createElement("td");
    if (c.role !== "admin" && c.team) {
      const viewBtn = document.createElement("button");
      viewBtn.textContent = c.team;
      viewBtn.title = "คลิกเพื่อดู/จัดการข้อมูลทีมนี้";
      viewBtn.className = "btn btn-secondary btn-sm";
      viewBtn.addEventListener("click", () => enterTeamManagementMode(c.team));
      teamTd.appendChild(viewBtn);
    } else {
      teamTd.textContent = c.team ?? "-";
    }

    tr.innerHTML = `
      <td class="emphasis">${c.name ?? "-"}</td>
      <td>${c.email ?? "-"}</td>
    `;
    tr.appendChild(roleTd);
    tr.appendChild(teamTd);
    tr.insertAdjacentHTML(
      "beforeend",
      `<td>${c.role === "coach" ? c.ageGroup ?? "-" : "-"}</td><td>${statusBadge}</td><td>${c.role === "admin" ? "-" : percentText}</td>`
    );

    const reassignTd = document.createElement("td");
    reassignTd.className = "space-x-2";
    if (c.role !== "admin") {
      const teamSelect = document.createElement("select");
      teamSelect.className = "field-input w-40 inline-block";
      populateTeamSelect(teamSelect, null);
      if (c.team) teamSelect.value = c.team;
      const saveBtn = document.createElement("button");
      saveBtn.textContent = "บันทึก";
      saveBtn.className = "btn btn-secondary btn-sm";
      saveBtn.addEventListener("click", () => reassignCoachTeam(c.id, teamSelect.value));
      reassignTd.appendChild(teamSelect);
      reassignTd.appendChild(saveBtn);
    } else {
      reassignTd.textContent = "-";
    }
    tr.appendChild(reassignTd);

    coachDirectoryBody.appendChild(tr);
  }
  applyDataLabels(coachDirectoryBody);
}

async function reassignCoachTeam(coachId, team) {
  try {
    await updateDoc(doc(db, "coaches", coachId), { team });
    adminStatus.textContent = "เปลี่ยนทีมเรียบร้อย ✓";
    adminStatus.className = "text-sm text-emerald-600 w-full";
    await loadCoachDirectory();
  } catch (err) {
    console.error(err);
    adminStatus.textContent = "เปลี่ยนทีมไม่สำเร็จ: " + err.message;
    adminStatus.className = "text-sm text-red-600 w-full";
  }
}

// ---------- ผู้ดูแลระบบ: ความคืบหน้าการประเมินรายวัน ----------
const PROGRESS_COLORS = {
  complete: "#10b981",
  partial: "#f59e0b",
  not_started: "#ef4444",
  no_training: "#94a3b8"
};
const PROGRESS_LABELS = {
  complete: "ประเมินครบแล้ว",
  partial: "ประเมินบางส่วน",
  not_started: "ยังไม่เริ่มประเมิน",
  no_training: "ไม่มีฝึกซ้อม"
};

async function loadDailyProgress(dateStr) {
  progressTableBody.innerHTML =
    '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';

  const coachSnap = await getDocs(collection(db, "coaches"));
  const coaches = [];
  coachSnap.forEach((d) => {
    const data = d.data();
    if (data.status === "approved" && data.role === "coach" && data.team) {
      coaches.push({ id: d.id, ...data });
    }
  });

  if (coaches.length === 0) {
    progressTableBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ยังไม่มีโค้ชที่ได้รับอนุมัติ</td></tr>';
    renderProgressPie([]);
    return;
  }

  const rows = await Promise.all(
    coaches.map(async (c) => {
      const [playersSnap, sessionSnap] = await Promise.all([
        getDocs(query(collection(db, "players"), where("team", "==", c.team))),
        getDocs(query(collection(db, "sessions"), where("date", "==", dateStr), where("team", "==", c.team)))
      ]);
      const totalPlayers = playersSnap.size;

      if (sessionSnap.empty) {
        return { coach: c, totalPlayers, evaluated: 0, noTraining: false, completedAt: null };
      }
      const sessionDoc = sessionSnap.docs[0];
      const sessionData = sessionDoc.data();
      if (sessionData.noTraining) {
        return { coach: c, totalPlayers, evaluated: 0, noTraining: true, completedAt: null };
      }
      const attendanceSnap = await getDocs(
        query(collection(db, "attendance"), where("sessionId", "==", sessionDoc.id))
      );
      const evaluatedRecords = attendanceSnap.docs
        .map((d) => d.data())
        .filter((a) => isPlayerFullyEvaluated(a));
      let completedAt = null;
      if (totalPlayers > 0 && evaluatedRecords.length >= totalPlayers) {
        for (const a of evaluatedRecords) {
          if (a.updatedAt && typeof a.updatedAt.toDate === "function") {
            const t = a.updatedAt.toDate();
            if (!completedAt || t > completedAt) completedAt = t;
          }
        }
      }
      return { coach: c, totalPlayers, evaluated: evaluatedRecords.length, noTraining: false, completedAt };
    })
  );

  progressTableBody.innerHTML = "";
  for (const r of rows) {
    const notEvaluated = Math.max(r.totalPlayers - r.evaluated, 0);
    const completedAtText = r.completedAt
      ? r.completedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น."
      : "-";
    const tr = document.createElement("tr");
    if (r.noTraining) {
      tr.innerHTML = `
        <td class="emphasis">${r.coach.name ?? "-"}</td>
        <td>${r.coach.team}</td>
        <td>${r.totalPlayers}</td>
        <td class="text-slate-400" colspan="2">ไม่มีฝึกซ้อม</td>
        <td>-</td>
      `;
    } else {
      tr.innerHTML = `
        <td class="emphasis">${r.coach.name ?? "-"}</td>
        <td>${r.coach.team}</td>
        <td>${r.totalPlayers}</td>
        <td class="text-emerald-600 font-medium">${r.evaluated}</td>
        <td class="text-red-500 font-medium">${notEvaluated}</td>
        <td>${completedAtText}</td>
      `;
    }
    progressTableBody.appendChild(tr);
  }
  applyDataLabels(progressTableBody);

  renderProgressPie(rows);
}

function categorizeProgress(r) {
  if (r.noTraining) return "no_training";
  if (r.totalPlayers === 0) return null; // ยังไม่มีนักกีฬาในทีม ไม่นับในภาพรวม
  if (r.evaluated >= r.totalPlayers) return "complete";
  if (r.evaluated > 0) return "partial";
  return "not_started";
}

function renderProgressPie(rows) {
  const counts = { complete: 0, partial: 0, not_started: 0, no_training: 0 };
  for (const r of rows) {
    const cat = categorizeProgress(r);
    if (cat) counts[cat] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    progressPie.style.background = "conic-gradient(#e2e8f0 0% 100%)";
    progressLegend.innerHTML = '<p class="text-slate-400 text-center">ไม่มีข้อมูล</p>';
    return;
  }

  let acc = 0;
  const segments = [];
  for (const key of Object.keys(counts)) {
    if (counts[key] === 0) continue;
    const percent = (counts[key] / total) * 100;
    const start = acc;
    acc += percent;
    segments.push(`${PROGRESS_COLORS[key]} ${start}% ${acc}%`);
  }
  progressPie.style.background = `conic-gradient(${segments.join(", ")})`;

  progressLegend.innerHTML = Object.keys(counts)
    .filter((key) => counts[key] > 0)
    .map(
      (key) => `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full inline-block" style="background:${PROGRESS_COLORS[key]}"></span>
        <span class="text-slate-600">${PROGRESS_LABELS[key]}: ${counts[key]} ทีม</span>
      </div>`
    )
    .join("");
}

progressRefreshBtn.addEventListener("click", () => {
  if (!progressDateInput.value) return;
  loadDailyProgress(progressDateInput.value);
});

async function enterTeamManagementMode(team) {
  myTeam = team;
  myCoachName = myCoachName || auth.currentUser?.email;
  myAgeGroup = null; // ผู้ดูแลระบบจัดการทีมแทนโค้ช เลือกรุ่นอายุของนักกีฬาได้อิสระทุกรุ่น
  coachTeamEl.textContent = `${team} (จัดการโดยผู้ดูแลระบบ)`;
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  // ผู้ดูแลระบบมีตัวเลือก "ดู Dashboard ทีมนี้" แยกไว้ที่แผงควบคุมอยู่แล้ว จึงตัดการ์ด Dashboard
  // ออกจากเมนูจัดการข้อมูลทีมนี้ ไม่ให้ซ้ำซ้อน (เหลือ 3 ตัวเลือก: เพิ่มนักกีฬา/เช็คชื่อ/รายงาน)
  menuDashboardCard.classList.add("hidden");
  menuCardsGrid.classList.remove("lg:grid-cols-4");
  menuCardsGrid.classList.add("lg:grid-cols-3");
  // เมนูนี้ถูกเข้าถึงผ่านผู้ดูแลระบบ (ไม่ใช่โค้ชล็อกอินเอง) จึงต้องมีปุ่มกลับไปแผงควบคุมผู้ดูแลด้วย
  menuBackBtn.classList.remove("hidden");
  await loadPlayers();
  showMenu();
}

adminViewDashboardBtn.addEventListener("click", () => {
  const team = adminDashboardTeamSelect.value;
  if (!team) {
    adminStatus.textContent = "กรุณาเลือกทีมที่ต้องการดู Dashboard";
    adminStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  // ไปที่ "/" ตรงๆ (ไม่ใช่ "/index.html") เพราะเซิร์ฟเวอร์แบบ clean-url (เช่น serve) จะ redirect
  // "/index.html" ไปที่ "/" และตัด query string ทิ้งระหว่างทาง ถ้ายิงตรงที่ "/" ตั้งแต่แรกจะไม่โดน redirect
  window.location.href = `${window.location.origin}/?team=${encodeURIComponent(team)}`;
});

adminSelectTeamBtn.addEventListener("click", () => {
  const team = adminTeamSelect.value;
  if (!team) {
    adminStatus.textContent = "กรุณาระบุทีมที่ต้องการจัดการ";
    adminStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  enterTeamManagementMode(team);
});

// แสดงโปรไฟล์ผู้ใช้งานที่มีในระบบให้ครบทุกส่วน (ชื่อ, อีเมล, ทีม, เบอร์โทร, สถานะบัญชี, รุ่นอายุที่รับผิดชอบ)
// ฟิลด์ "รุ่นอายุที่รับผิดชอบ" แสดงเฉพาะบทบาทโค้ชเท่านั้น (ผู้ดูแลระบบ/ผู้บริหารทีมไม่ต้องแสดง — ซ่อนด้วย
// coachAgeGroupsWrap) และอัปเดตแยกหลังโหลดรายชื่อนักกีฬาของทีมเสร็จ (ดู renderAgeGroupsFromPlayers)
function renderCoachProfile(user, data, teamText) {
  coachNameEl.textContent = (data && data.name) || user.email;
  coachEmailEl.textContent = user.email;
  coachTeamEl.textContent = teamText || "-";
  coachPhoneEl.textContent = (data && data.phone) || "-";
  coachStatusBadgeEl.innerHTML =
    data && data.status === "approved"
      ? '<span class="badge badge-success">อนุมัติแล้ว</span>'
      : '<span class="badge badge-warning">รอการอนุมัติ</span>';
  coachAgeGroupsEl.textContent = "-";
}

function formatAgeGroups(playerList) {
  const groups = new Set();
  for (const p of playerList) {
    if (p.ageGroup) groups.add(p.ageGroup);
  }
  return groups.size > 0 ? Array.from(groups).sort().join(", ") : "-";
}

// ใช้ตอนมีรายชื่อนักกีฬาของทีมโหลดไว้แล้วในตัวแปร players (เฉพาะบทบาทโค้ช)
function renderAgeGroupsFromPlayers() {
  coachAgeGroupsEl.textContent = formatAgeGroups(players);
}

// ---------- ล็อกอิน: แยกเส้นทางตามบทบาท (ผู้ดูแลระบบ / โค้ชที่อนุมัติแล้ว / รอการอนุมัติ) ----------
onAuthStateChanged(auth, async (user) => {
  const isCoachSession = !!user && !user.isAnonymous;
  loginSection.classList.toggle("hidden", isCoachSession);
  brandHero.classList.toggle("hidden", isCoachSession);
  coachBar.classList.toggle("hidden", !isCoachSession);
  if (!isCoachSession) {
    hideAllScreens();
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved") {
      currentIsAdmin = false;
      adminPanelLink.classList.add("hidden");
      renderCoachProfile(user, data, (data && data.team) || "รอผู้ดูแลระบบกำหนดทีม");
      coachAgeGroupsWrap.classList.add("hidden");
      coachPhoneWrap.classList.remove("hidden");
      hideAllScreens();
      pendingSection.classList.remove("hidden");
      return;
    }

    currentIsAdmin = data.role === "admin";
    adminPanelLink.classList.toggle("hidden", !currentIsAdmin);

    if (currentIsAdmin) {
      coachRoleBadgeEl.textContent = "ผู้ดูแลระบบ";
      coachRoleBadgeEl.className = "badge badge-info";
      renderCoachProfile(user, data, "เข้าถึงได้ทุกทีม");
      coachAgeGroupsWrap.classList.add("hidden");
      coachPhoneWrap.classList.add("hidden"); // ผู้ดูแลระบบไม่ผูกกับทีม/รุ่นใดรุ่นหนึ่ง ไม่จำเป็นต้องแสดงเบอร์โทร
      showAdminPanel();
      return;
    }

    if (data.role === "executive") {
      coachRoleBadgeEl.textContent = "ผู้บริหารทีม";
      coachRoleBadgeEl.className = "badge badge-neutral";
      renderCoachProfile(user, data, data.team);
      coachAgeGroupsWrap.classList.add("hidden");
      coachPhoneWrap.classList.remove("hidden");
      hideAllScreens();
      executiveSection.classList.remove("hidden");
      return;
    }

    coachRoleBadgeEl.textContent = "โค้ช";
    coachRoleBadgeEl.className = "badge badge-success";
    myTeam = data.team;
    myCoachName = data.name || user.email;
    myAgeGroup = data.ageGroup || null;
    renderCoachProfile(user, data, myTeam);
    coachAgeGroupsWrap.classList.remove("hidden");
    coachPhoneWrap.classList.remove("hidden");
    menuBackBtn.classList.add("hidden"); // โค้ชล็อกอินเข้าเมนูตัวเองโดยตรง ไม่ต้องมีปุ่มกลับแผงผู้ดูแล
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    await loadPlayers();
    renderAgeGroupsFromPlayers();
    showMenu();
  } catch (err) {
    console.error(err);
    setAttendanceStatus("โหลดข้อมูลโค้ชไม่สำเร็จ: " + err.message, true);
  }
});

// ---------- Players (เฉพาะทีมของโค้ชคนนี้) ----------
async function loadPlayers() {
  const q = query(collection(db, "players"), where("team", "==", myTeam));
  const snapshot = await getDocs(q);
  players = [];
  snapshot.forEach((docSnap) => players.push({ id: docSnap.id, ...docSnap.data() }));
  players.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

// ---------- รายชื่อนักกีฬาในทีม + แก้ไข/ลบ ----------
function renderPlayerList() {
  playerListBody.innerHTML = "";
  if (players.length === 0) {
    playerListBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ยังไม่มีนักกีฬาในทีมนี้</td></tr>';
    return;
  }
  for (const p of players) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.number ?? "-"}</td>
      <td class="emphasis">${p.nickname ?? "-"}</td>
      <td>${p.fullName ?? "-"}</td>
      <td>${p.birthday ?? "-"}</td>
      <td>${p.ageGroup ?? "-"}</td>
      <td>${p.position ?? "-"}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.className = "space-x-2";

    const editBtn = document.createElement("button");
    editBtn.textContent = "แก้ไข";
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.addEventListener("click", () => startEditPlayer(p));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "ลบ";
    deleteBtn.className = "btn btn-danger-soft btn-sm";
    deleteBtn.addEventListener("click", () => deletePlayer(p));

    actionTd.appendChild(editBtn);
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);
    playerListBody.appendChild(tr);
  }
  applyDataLabels(playerListBody);
}

function startEditPlayer(p) {
  editingPlayerId = p.id;
  document.getElementById("player-number").value = p.number ?? "";
  document.getElementById("player-nickname").value = p.nickname ?? "";
  document.getElementById("player-fullname").value = p.fullName ?? "";
  document.getElementById("player-birthday").value = p.birthday ?? "";
  document.getElementById("player-age-group").value = p.ageGroup ?? "";
  document.getElementById("player-position").value = p.position ?? "";
  applyAgeGroupLock();
  addPlayerSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditPlayerBtn.classList.remove("hidden");
  addPlayerStatus.textContent = `กำลังแก้ไข "${p.nickname ?? p.fullName}"`;
  addPlayerStatus.className = "text-sm text-slate-500";
  addPlayerForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEditPlayer() {
  editingPlayerId = null;
  addPlayerForm.reset();
  applyAgeGroupLock();
  addPlayerSubmitBtn.textContent = "เพิ่มนักกีฬา";
  cancelEditPlayerBtn.classList.add("hidden");
}

cancelEditPlayerBtn.addEventListener("click", () => {
  stopEditPlayer();
  addPlayerStatus.textContent = "";
});

async function deletePlayer(p) {
  const ok = confirm(`ยืนยันลบนักกีฬา "${p.nickname ?? p.fullName}"? การลบนี้ไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "players", p.id));
    if (editingPlayerId === p.id) stopEditPlayer();
    addPlayerStatus.textContent = `ลบ "${p.nickname ?? p.fullName}" แล้ว`;
    addPlayerStatus.className = "text-sm text-slate-500";
    await loadPlayers();
    renderPlayerList();
    if (currentSessionId && currentSessionData && !currentSessionData.noTraining) {
      const existingMap = await loadExistingAttendance(currentSessionId);
      renderRoster(existingMap);
    }
  } catch (err) {
    console.error(err);
    addPlayerStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    addPlayerStatus.className = "text-sm text-red-600";
  }
}

// ---------- เพิ่ม/แก้ไขนักกีฬาในทีมของโค้ช ----------
addPlayerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!myTeam) {
    addPlayerStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    addPlayerStatus.className = "text-sm text-red-600";
    return;
  }
  const numberVal = document.getElementById("player-number").value;
  const nickname = document.getElementById("player-nickname").value.trim();
  const fullName = document.getElementById("player-fullname").value.trim();
  const birthday = document.getElementById("player-birthday").value;
  const ageGroup = document.getElementById("player-age-group").value;
  const position = document.getElementById("player-position").value.trim();

  const payload = {
    number: numberVal ? Number(numberVal) : null,
    nickname,
    fullName,
    birthday: birthday || null,
    ageGroup: ageGroup || null,
    position: position || null,
    team: myTeam
  };

  try {
    addPlayerStatus.textContent = "กำลังบันทึก...";
    addPlayerStatus.className = "text-sm text-slate-500";

    if (editingPlayerId) {
      await updateDoc(doc(db, "players", editingPlayerId), payload);
      addPlayerStatus.textContent = `บันทึกการแก้ไข "${nickname}" สำเร็จ ✓`;
      addPlayerStatus.className = "text-sm text-emerald-600";
      stopEditPlayer();
    } else {
      await addDoc(collection(db, "players"), { ...payload, createdAt: serverTimestamp() });
      addPlayerForm.reset();
      applyAgeGroupLock();
      addPlayerStatus.textContent = `เพิ่ม "${nickname}" สำเร็จ ✓`;
      addPlayerStatus.className = "text-sm text-emerald-600";
    }

    await loadPlayers();
    renderPlayerList();
    if (currentSessionId && currentSessionData && !currentSessionData.noTraining) {
      const existingMap = await loadExistingAttendance(currentSessionId);
      renderRoster(existingMap);
    }
  } catch (err) {
    console.error(err);
    addPlayerStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    addPlayerStatus.className = "text-sm text-red-600";
  }
});

// ---------- Session (find-or-create by date + team) ----------
async function findOrCreateSession(dateStr) {
  const q = query(
    collection(db, "sessions"),
    where("date", "==", dateStr),
    where("team", "==", myTeam)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, data: docSnap.data() };
  }
  const newData = { date: dateStr, team: myTeam, createdAt: serverTimestamp() };
  const newDoc = await addDoc(collection(db, "sessions"), newData);
  return { id: newDoc.id, data: newData };
}

async function loadExistingAttendance(sessionId) {
  const q = query(
    collection(db, "attendance"),
    where("sessionId", "==", sessionId),
    where("team", "==", myTeam)
  );
  const snapshot = await getDocs(q);
  const map = new Map();
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    map.set(data.playerId, { status: data.status, scores: data.scores || {}, updatedAt: data.updatedAt });
  });
  return map;
}

function formatEvalTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  return timestamp.toDate().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

// สร้างกลุ่มปุ่มแบบ segmented control (กดเลือกได้ทีละค่า) ใช้ทั้งสถานะและคะแนนแต่ละด้าน
function createSegmentedGroup(options, activeValue, onSelect) {
  const group = document.createElement("div");
  group.className = "segmented";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(opt);
    btn.className = "segmented-btn" + (activeValue === opt ? " active" : "");
    btn.addEventListener("click", () => onSelect(opt));
    group.appendChild(btn);
  }
  return group;
}

// ประเมินครบทุกคนแล้ว = ทุกคนมีสถานะ และถ้ามาซ้อม (A) ต้องให้คะแนนครบทั้ง 4 ด้าน
function isRosterComplete(existingMap) {
  return players.length > 0 && players.every((p) => isPlayerFullyEvaluated(existingMap.get(p.id)));
}

function renderRoster(existingMap) {
  currentAttendanceMap = existingMap;
  const locked = isRosterComplete(existingMap) && !currentIsAdmin;
  rosterLockedBanner.classList.toggle("hidden", !locked);

  rosterBody.innerHTML = "";
  if (players.length === 0) {
    rosterBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ยังไม่มีผู้เล่นในทีมนี้</td></tr>';
    return;
  }
  for (const p of players) {
    const existing = existingMap.get(p.id) || {};
    const scores = existing.scores || {};
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.className = "emphasis";
    nameTd.textContent = p.nickname ?? p.fullName ?? "-";
    tr.appendChild(nameTd);

    const statusTd = document.createElement("td");
    if (locked) {
      statusTd.innerHTML = existing.status
        ? `<span class="badge badge-neutral">${existing.status}</span>`
        : '<span class="text-slate-400">-</span>';
    } else {
      statusTd.appendChild(
        createSegmentedGroup(STATUS_OPTIONS, existing.status, (status) => saveStatus(p.id, status))
      );
    }
    tr.appendChild(statusTd);

    for (const category of SCORE_CATEGORIES) {
      const catTd = document.createElement("td");
      if (locked) {
        const val = scores[category.key];
        catTd.innerHTML = val
          ? `<span class="badge badge-neutral">${val}</span>`
          : '<span class="text-slate-400">-</span>';
      } else {
        catTd.appendChild(
          createSegmentedGroup(SCORE_OPTIONS, scores[category.key], (score) =>
            saveScoreCategory(p.id, category.key, score)
          )
        );
      }
      tr.appendChild(catTd);
    }

    const avgTd = document.createElement("td");
    const avg = computeAvgScore(scores);
    const timeText = formatEvalTime(existing.updatedAt)
      ? `<span class="text-xs text-slate-400 ml-2">อัปเดตล่าสุด ${formatEvalTime(existing.updatedAt)} น.</span>`
      : "";
    avgTd.innerHTML = avg !== null
      ? `<span class="emphasis">${avg.toFixed(2)}</span>${timeText}`
      : '<span class="text-slate-400">-</span>';
    tr.appendChild(avgTd);

    rosterBody.appendChild(tr);
  }
  applyDataLabels(rosterBody);
}

async function saveStatus(playerId, status) {
  if (!currentSessionId) return;
  try {
    const docId = `${playerId}_${currentSessionId}`;
    await setDoc(
      doc(db, "attendance", docId),
      {
        playerId,
        sessionId: currentSessionId,
        team: myTeam,
        date: dateInput.value,
        status,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    const prev = currentAttendanceMap.get(playerId) || {};
    currentAttendanceMap.set(playerId, { ...prev, status, updatedAt: { toDate: () => new Date() } });
    renderRoster(currentAttendanceMap);
    setAttendanceStatus("บันทึกแล้ว ✓");
  } catch (err) {
    console.error(err);
    setAttendanceStatus("บันทึกไม่สำเร็จ: " + err.message, true);
  }
}

async function saveScoreCategory(playerId, categoryKey, value) {
  if (!currentSessionId) return;
  try {
    const prev = currentAttendanceMap.get(playerId) || {};
    const newScores = { ...(prev.scores || {}), [categoryKey]: value };
    const docId = `${playerId}_${currentSessionId}`;
    await setDoc(
      doc(db, "attendance", docId),
      {
        playerId,
        sessionId: currentSessionId,
        team: myTeam,
        date: dateInput.value,
        scores: newScores,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    currentAttendanceMap.set(playerId, { ...prev, scores: newScores, updatedAt: { toDate: () => new Date() } });
    renderRoster(currentAttendanceMap);
    setAttendanceStatus("บันทึกแล้ว ✓");
  } catch (err) {
    console.error(err);
    setAttendanceStatus("บันทึกไม่สำเร็จ: " + err.message, true);
  }
}

function showRosterView() {
  noTrainingBanner.classList.add("hidden");
  rosterWrap.classList.remove("hidden");
}

function showNoTrainingView() {
  noTrainingBanner.classList.remove("hidden");
  rosterLockedBanner.classList.add("hidden");
  rosterWrap.classList.add("hidden");
}

async function loadSessionForDate(dateStr) {
  setAttendanceStatus("กำลังโหลด...");
  const session = await findOrCreateSession(dateStr);
  currentSessionId = session.id;
  currentSessionData = session.data;

  if (session.data.noTraining) {
    showNoTrainingView();
    setAttendanceStatus(`วันที่ ${dateStr} ถูกบันทึกว่าไม่มีฝึกซ้อม (ทีม ${myTeam})`);
    return;
  }
  showRosterView();
  const existingMap = await loadExistingAttendance(currentSessionId);
  renderRoster(existingMap);
  setAttendanceStatus(`พร้อมเช็คชื่อวันที่ ${dateStr} (ทีม ${myTeam})`);
}

loadSessionBtn.addEventListener("click", async () => {
  const dateStr = dateInput.value;
  if (!dateStr) {
    setAttendanceStatus("กรุณาเลือกวันที่ก่อน", true);
    return;
  }
  if (!myTeam) {
    setAttendanceStatus("ยังไม่ทราบทีมที่รับผิดชอบ", true);
    return;
  }
  try {
    await loadSessionForDate(dateStr);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("โหลดไม่สำเร็จ: " + err.message, true);
  }
});

markNoTrainingBtn.addEventListener("click", async () => {
  const dateStr = dateInput.value;
  if (!dateStr) {
    setAttendanceStatus("กรุณาเลือกวันที่ก่อน", true);
    return;
  }
  if (!myTeam) {
    setAttendanceStatus("ยังไม่ทราบทีมที่รับผิดชอบ", true);
    return;
  }
  try {
    setAttendanceStatus("กำลังบันทึก...");
    const session = await findOrCreateSession(dateStr);
    await setDoc(
      doc(db, "sessions", session.id),
      { noTraining: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
    currentSessionId = session.id;
    currentSessionData = { ...session.data, noTraining: true };
    await syncTrainingReportForNoTraining(dateStr, true);
    showNoTrainingView();
    setAttendanceStatus(`บันทึกวันที่ ${dateStr} เป็น "ไม่มีฝึกซ้อม" แล้ว ✓ (ซิงก์กับรายงานการฝึกซ้อมอัตโนมัติ)`);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("บันทึกไม่สำเร็จ: " + err.message, true);
  }
});

undoNoTrainingBtn.addEventListener("click", async () => {
  if (!currentSessionId) return;
  try {
    setAttendanceStatus("กำลังยกเลิก...");
    await setDoc(
      doc(db, "sessions", currentSessionId),
      { noTraining: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await syncTrainingReportForNoTraining(dateInput.value, false);
    await loadSessionForDate(dateInput.value);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("ยกเลิกไม่สำเร็จ: " + err.message, true);
  }
});

// ---------- รายงานการฝึกซ้อม (ช่วงเวลาฝึกซ้อม + สถานะการฝึกซ้อม + หมายเหตุ + พิกัด GPS) ----------
// เชื่อมโยงกับปุ่ม "วันนี้ไม่มีฝึกซ้อม" ในหน้าเช็คชื่อ: เมื่อทำเครื่องหมายวันใดว่าไม่มีฝึกซ้อม
// ให้ซิงก์สถานะไปที่รายงานการฝึกซ้อมของวันนั้นอัตโนมัติ (attended: false) เพื่อไม่ให้ข้อมูล
// สองจุดขัดแย้งกัน — ถ้ายกเลิก "ไม่มีฝึกซ้อม" ในภายหลัง และรายงานยังเป็นค่าที่ซิงก์อัตโนมัติอยู่
// (โค้ชยังไม่เคยแก้ไขเอง) จะล้างค่ากลับเป็นค่าว่างให้โค้ชกรอกตามจริงอีกครั้ง
const AUTO_NO_TRAINING_NOTE = "ไม่มีฝึกซ้อม (บันทึกอัตโนมัติจากการทำเครื่องหมายวันไม่มีฝึกซ้อมในหน้าเช็คชื่อ)";

async function syncTrainingReportForNoTraining(dateStr, isNoTraining) {
  const q = query(
    collection(db, "trainingReports"),
    where("team", "==", myTeam),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  const existing = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };

  if (isNoTraining) {
    const payload = {
      team: myTeam,
      date: dateStr,
      coachId: auth.currentUser.uid,
      coachName: myCoachName || auth.currentUser.email,
      periodType: null,
      periodStartTime: null,
      periodEndTime: null,
      periodOtherText: null,
      attended: false,
      notes: existing && existing.notes ? existing.notes : AUTO_NO_TRAINING_NOTE,
      autoFromNoTraining: true,
      location: existing ? existing.location ?? null : null,
      updatedAt: serverTimestamp()
    };
    if (existing) {
      await updateDoc(doc(db, "trainingReports", existing.id), payload);
    } else {
      await addDoc(collection(db, "trainingReports"), { ...payload, createdAt: serverTimestamp() });
    }
  } else if (existing && existing.autoFromNoTraining) {
    await updateDoc(doc(db, "trainingReports", existing.id), {
      attended: null,
      notes: null,
      autoFromNoTraining: false,
      updatedAt: serverTimestamp()
    });
  }
}

const PERIOD_LABELS = { morning: "ซ้อมเช้า", evening: "ซ้อมเย็น", other: "อื่นๆ โปรดระบุ" };
const PERIOD_CODES_BY_LABEL = Object.fromEntries(
  Object.entries(PERIOD_LABELS).map(([code, label]) => [label, code])
);
// ใช้คำว่า "มีการซ้อม / ไม่มีการซ้อม" แทน "เข้า / ไม่เข้า" เพื่อไม่ให้ตีความผิดว่าโค้ชขาดงานเอง
// (สถานะนี้บันทึกว่า "วันนี้มีการฝึกซ้อมเกิดขึ้นหรือไม่" ไม่ใช่การประเมินตัวโค้ช)
const ATTEND_LABELS = { true: "มีการซ้อม", false: "ไม่มีการซ้อม" };

let reportPeriodType = null; // "morning" | "evening" | "other"
let reportPeriodStartTime = "";
let reportPeriodEndTime = "";
let reportPeriodOtherText = "";
let reportAttended = null; // true | false

function renderPeriodSegmented() {
  reportPeriodSegmentedWrap.innerHTML = "";
  reportPeriodSegmentedWrap.appendChild(
    createSegmentedGroup(
      Object.values(PERIOD_LABELS),
      reportPeriodType ? PERIOD_LABELS[reportPeriodType] : null,
      (label) => {
        reportPeriodType = PERIOD_CODES_BY_LABEL[label];
        renderPeriodSegmented();
        renderPeriodDetail();
      }
    )
  );
}

function renderPeriodDetail() {
  reportPeriodDetailWrap.innerHTML = "";
  if (!reportPeriodType) {
    reportPeriodDetailWrap.classList.add("hidden");
    return;
  }
  reportPeriodDetailWrap.classList.remove("hidden");

  if (reportPeriodType === "other") {
    const otherInput = document.createElement("input");
    otherInput.type = "text";
    otherInput.className = "field-input mb-3";
    otherInput.placeholder = "ระบุประเภทช่วงเวลาฝึกซ้อม เช่น ซ้อมบ่าย, ซ้อมพิเศษ";
    otherInput.value = reportPeriodOtherText;
    otherInput.addEventListener("input", () => {
      reportPeriodOtherText = otherInput.value;
    });
    reportPeriodDetailWrap.appendChild(otherInput);
  }

  const timeRow = document.createElement("div");
  timeRow.className = "flex items-center gap-3";

  const startWrap = document.createElement("div");
  startWrap.innerHTML = '<label class="field-label">เวลาเริ่ม</label>';
  const startInput = document.createElement("input");
  startInput.type = "time";
  startInput.className = "field-input w-40";
  startInput.value = reportPeriodStartTime;
  startInput.addEventListener("input", () => {
    reportPeriodStartTime = startInput.value;
  });
  startWrap.appendChild(startInput);

  const endWrap = document.createElement("div");
  endWrap.innerHTML = '<label class="field-label">เวลาสิ้นสุด</label>';
  const endInput = document.createElement("input");
  endInput.type = "time";
  endInput.className = "field-input w-40";
  endInput.value = reportPeriodEndTime;
  endInput.addEventListener("input", () => {
    reportPeriodEndTime = endInput.value;
  });
  endWrap.appendChild(endInput);

  timeRow.appendChild(startWrap);
  timeRow.appendChild(endWrap);
  reportPeriodDetailWrap.appendChild(timeRow);
}

// แสดงส่วน "ช่วงเวลาฝึกซ้อม" เฉพาะตอนสถานะเป็น "มีการซ้อม" เท่านั้น
// (ถ้า "ไม่มีการซ้อม" ไม่จำเป็นต้องระบุช่วงเวลา เพราะไม่มีการฝึกซ้อมเกิดขึ้นจริง)
function updatePeriodSectionVisibility() {
  reportPeriodSection.classList.toggle("hidden", reportAttended !== true);
}

function renderAttendSegmented() {
  reportAttendSegmentedWrap.innerHTML = "";
  reportAttendSegmentedWrap.appendChild(
    createSegmentedGroup(
      Object.values(ATTEND_LABELS),
      reportAttended === null ? null : ATTEND_LABELS[reportAttended],
      (label) => {
        reportAttended = label === ATTEND_LABELS.true;
        renderAttendSegmented();
        updatePeriodSectionVisibility();
      }
    )
  );
  updatePeriodSectionVisibility();
}

async function loadReportForDate(dateStr) {
  const q = query(
    collection(db, "trainingReports"),
    where("team", "==", myTeam),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  const existing = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };

  currentReportId = existing ? existing.id : null;
  reportPeriodType = existing ? existing.periodType || null : null;
  reportPeriodStartTime = existing ? existing.periodStartTime || "" : "";
  reportPeriodEndTime = existing ? existing.periodEndTime || "" : "";
  reportPeriodOtherText = existing ? existing.periodOtherText || "" : "";
  reportAttended = existing && typeof existing.attended === "boolean" ? existing.attended : null;
  reportNotesInput.value = existing ? existing.notes || "" : "";

  renderPeriodSegmented();
  renderPeriodDetail();
  renderAttendSegmented();

  reportStatus.textContent = "";
  reportForm.classList.remove("hidden");
  if (existing && existing.autoFromNoTraining) {
    reportLoadStatus.textContent = `วันที่ ${dateStr} ถูกทำเครื่องหมายว่า "ไม่มีฝึกซ้อม" ไว้ในหน้าเช็คชื่อ — ระบบซิงก์สถานะมาให้อัตโนมัติ แก้ไขเพิ่มเติมได้ตามจริง`;
    reportLoadStatus.className = "text-sm text-amber-600 w-full";
  } else {
    reportLoadStatus.textContent = existing
      ? `พบรายงานที่เคยส่งไว้สำหรับวันที่ ${dateStr} — แก้ไข/ส่งซ้ำได้`
      : `ยังไม่มีรายงานสำหรับวันที่ ${dateStr} — กรอกข้อมูลด้านล่างเพื่อส่งรายงานใหม่`;
    reportLoadStatus.className = "text-sm text-slate-500 w-full";
  }
}

reportLoadBtn.addEventListener("click", async () => {
  const dateStr = reportDateInput.value;
  if (!dateStr) {
    reportLoadStatus.textContent = "กรุณาเลือกวันที่ก่อน";
    reportLoadStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  if (!myTeam) {
    reportLoadStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    reportLoadStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  try {
    reportLoadStatus.textContent = "กำลังโหลด...";
    reportLoadStatus.className = "text-sm text-slate-500 w-full";
    await loadReportForDate(dateStr);
  } catch (err) {
    console.error(err);
    reportLoadStatus.textContent = "โหลดไม่สำเร็จ: " + err.message;
    reportLoadStatus.className = "text-sm text-red-600 w-full";
  }
});

// ขอพิกัด GPS ปัจจุบัน ณ ขณะกดส่งรายงาน (ไม่ใช้ตำแหน่งเก่าที่ cache ไว้)
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("อุปกรณ์นี้ไม่รองรับการระบุพิกัด GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(new Error(`ไม่สามารถระบุพิกัด GPS ได้ (${err.message}) กรุณาอนุญาตการเข้าถึงตำแหน่งของเบราว์เซอร์`)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dateStr = reportDateInput.value;
  if (!myTeam) {
    reportStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    reportStatus.className = "text-sm text-red-600";
    return;
  }
  if (!dateStr) {
    reportStatus.textContent = "กรุณาเลือกวันที่ก่อน";
    reportStatus.className = "text-sm text-red-600";
    return;
  }

  if (reportAttended === null) {
    reportStatus.textContent = "กรุณาเลือกสถานะการฝึกซ้อม";
    reportStatus.className = "text-sm text-red-600";
    return;
  }

  if (reportAttended === false && !reportNotesInput.value.trim()) {
    reportStatus.textContent = "กรุณาระบุเหตุผลที่ไม่มีการซ้อมในช่องหมายเหตุ";
    reportStatus.className = "text-sm text-red-600";
    return;
  }

  // ต้องระบุช่วงเวลาฝึกซ้อมเฉพาะตอน "มีการซ้อม" เท่านั้น
  if (reportAttended === true) {
    if (!reportPeriodType) {
      reportStatus.textContent = "กรุณาเลือกช่วงเวลาฝึกซ้อม";
      reportStatus.className = "text-sm text-red-600";
      return;
    }
    if (reportPeriodType === "other" && !reportPeriodOtherText.trim()) {
      reportStatus.textContent = "กรุณาระบุประเภทช่วงเวลาฝึกซ้อม";
      reportStatus.className = "text-sm text-red-600";
      return;
    }
    if (!reportPeriodStartTime || !reportPeriodEndTime) {
      reportStatus.textContent = "กรุณาระบุเวลาเริ่มและเวลาสิ้นสุดการฝึกซ้อม";
      reportStatus.className = "text-sm text-red-600";
      return;
    }
    if (reportPeriodStartTime >= reportPeriodEndTime) {
      reportStatus.textContent = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
      reportStatus.className = "text-sm text-red-600";
      return;
    }
  }

  reportSubmitBtn.disabled = true;
  reportStatus.textContent = "กำลังส่งรายงาน...";
  reportStatus.className = "text-sm text-slate-500";

  try {
    let location = null;
    try {
      const pos = await getCurrentPosition();
      location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
    } catch (gpsErr) {
      console.warn(gpsErr);
      // ไม่บล็อกการส่งรายงานหากขอพิกัดไม่สำเร็จ (เช่น ผู้ใช้ปฏิเสธสิทธิ์)
    }

    const payload = {
      team: myTeam,
      date: dateStr,
      coachId: auth.currentUser.uid,
      coachName: myCoachName || auth.currentUser.email,
      periodType: reportAttended === true ? reportPeriodType : null,
      periodStartTime: reportAttended === true ? reportPeriodStartTime : null,
      periodEndTime: reportAttended === true ? reportPeriodEndTime : null,
      periodOtherText: reportAttended === true && reportPeriodType === "other" ? reportPeriodOtherText.trim() : null,
      attended: reportAttended,
      notes: reportNotesInput.value.trim() || null,
      autoFromNoTraining: false,
      location,
      updatedAt: serverTimestamp()
    };

    if (currentReportId) {
      await updateDoc(doc(db, "trainingReports", currentReportId), payload);
    } else {
      const newDoc = await addDoc(collection(db, "trainingReports"), { ...payload, createdAt: serverTimestamp() });
      currentReportId = newDoc.id;
    }

    reportStatus.textContent = "ส่งรายงานเรียบร้อย ✓";
    reportStatus.className = "text-sm text-emerald-600";
  } catch (err) {
    console.error(err);
    reportStatus.textContent = "ส่งรายงานไม่สำเร็จ: " + err.message;
    reportStatus.className = "text-sm text-red-600";
  } finally {
    reportSubmitBtn.disabled = false;
  }
});
