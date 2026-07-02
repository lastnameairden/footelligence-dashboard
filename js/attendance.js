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

const STATUS_OPTIONS = ["A", "I", "R", "P"];
const SCORE_OPTIONS = [1, 2, 3, 4];
const TEAMS = ["KHAMPHEE FOOTBALL", "THAWEE SC", "THAMMASATHIT"];

const loginSection = document.getElementById("login-section");
const brandHero = document.getElementById("brand-hero");
const coachBar = document.getElementById("coach-bar");
const menuSection = document.getElementById("menu-section");
const addPlayerSection = document.getElementById("add-player-section");
const checkinSection = document.getElementById("checkin-section");
const menuAddPlayerBtn = document.getElementById("menu-add-player");
const menuCheckinBtn = document.getElementById("menu-checkin");
const backButtons = document.querySelectorAll("[data-back]");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const registerForm = document.getElementById("register-form");
const registerError = document.getElementById("register-error");
const pendingSection = document.getElementById("pending-section");
const pendingLogoutBtn = document.getElementById("pending-logout-btn");
const executiveSection = document.getElementById("executive-section");
const coachEmailEl = document.getElementById("coach-email");
const coachTeamEl = document.getElementById("coach-team");
const coachRoleBadgeEl = document.getElementById("coach-role-badge");
const adminPanelLink = document.getElementById("admin-panel-link");
const adminSection = document.getElementById("admin-section");
const pendingApprovalsBody = document.getElementById("pending-approvals-body");
const adminTeamSelect = document.getElementById("admin-team-select");
const adminSelectTeamBtn = document.getElementById("admin-select-team-btn");
const adminStatus = document.getElementById("admin-status");
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
let players = [];
let editingPlayerId = null;
let currentIsAdmin = false;

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

  if (password !== passwordConfirm) {
    registerError.textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
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
  adminSection.classList.add("hidden");
  menuSection.classList.add("hidden");
  addPlayerSection.classList.add("hidden");
  checkinSection.classList.add("hidden");
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

function showAdminPanel() {
  hideAllScreens();
  adminSection.classList.remove("hidden");
  populateTeamSelect(adminTeamSelect, null);
  loadPendingApprovals();
  loadCoachDirectory();
  if (!progressDateInput.value) {
    progressDateInput.value = new Date().toISOString().slice(0, 10);
  }
  loadDailyProgress(progressDateInput.value);
}

menuAddPlayerBtn.addEventListener("click", () => {
  menuSection.classList.add("hidden");
  addPlayerSection.classList.remove("hidden");
  renderPlayerList();
});

menuCheckinBtn.addEventListener("click", () => {
  menuSection.classList.add("hidden");
  checkinSection.classList.remove("hidden");
  showRosterView();
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
    '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
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
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ยังไม่มีโค้ชในระบบ</td></tr>';
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
      `<td>${statusBadge}</td><td>${c.role === "admin" ? "-" : percentText}</td>`
    );

    const reassignTd = document.createElement("td");
    if (c.role !== "admin") {
      const teamSelect = document.createElement("select");
      teamSelect.className = "field-input w-40 inline-block";
      populateTeamSelect(teamSelect, null);
      if (c.team) teamSelect.value = c.team;
      const saveBtn = document.createElement("button");
      saveBtn.textContent = "บันทึก";
      saveBtn.className = "btn btn-secondary btn-sm ml-2";
      saveBtn.addEventListener("click", () => reassignCoachTeam(c.id, teamSelect.value));
      reassignTd.appendChild(teamSelect);
      reassignTd.appendChild(saveBtn);
    } else {
      reassignTd.textContent = "-";
    }
    tr.appendChild(reassignTd);

    coachDirectoryBody.appendChild(tr);
  }
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
        .filter((a) => a.status);
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
  coachTeamEl.textContent = `${team} (จัดการโดยผู้ดูแลระบบ)`;
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  await loadPlayers();
  showMenu();
}

adminSelectTeamBtn.addEventListener("click", () => {
  const team = adminTeamSelect.value;
  if (!team) {
    adminStatus.textContent = "กรุณาระบุทีมที่ต้องการจัดการ";
    adminStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  enterTeamManagementMode(team);
});

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

  coachEmailEl.textContent = user.email;

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved") {
      currentIsAdmin = false;
      adminPanelLink.classList.add("hidden");
      hideAllScreens();
      pendingSection.classList.remove("hidden");
      return;
    }

    currentIsAdmin = data.role === "admin";
    adminPanelLink.classList.toggle("hidden", !currentIsAdmin);

    if (currentIsAdmin) {
      coachRoleBadgeEl.textContent = "ผู้ดูแลระบบ";
      coachRoleBadgeEl.className = "badge badge-info";
      coachTeamEl.textContent = "เข้าถึงได้ทุกทีม";
      showAdminPanel();
      return;
    }

    if (data.role === "executive") {
      coachRoleBadgeEl.textContent = "ผู้บริหารทีม";
      coachRoleBadgeEl.className = "badge badge-neutral";
      coachTeamEl.textContent = data.team;
      hideAllScreens();
      executiveSection.classList.remove("hidden");
      return;
    }

    coachRoleBadgeEl.textContent = "โค้ช";
    coachRoleBadgeEl.className = "badge badge-success";
    myTeam = data.team;
    coachTeamEl.textContent = myTeam;
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    await loadPlayers();
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
}

function startEditPlayer(p) {
  editingPlayerId = p.id;
  document.getElementById("player-number").value = p.number ?? "";
  document.getElementById("player-nickname").value = p.nickname ?? "";
  document.getElementById("player-fullname").value = p.fullName ?? "";
  document.getElementById("player-birthday").value = p.birthday ?? "";
  document.getElementById("player-age-group").value = p.ageGroup ?? "";
  document.getElementById("player-position").value = p.position ?? "";
  addPlayerSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditPlayerBtn.classList.remove("hidden");
  addPlayerStatus.textContent = `กำลังแก้ไข "${p.nickname ?? p.fullName}"`;
  addPlayerStatus.className = "text-sm text-slate-500";
  addPlayerForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEditPlayer() {
  editingPlayerId = null;
  addPlayerForm.reset();
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
    map.set(data.playerId, { status: data.status, score: data.score, updatedAt: data.updatedAt });
  });
  return map;
}

function formatEvalTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  return timestamp.toDate().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function activeBtnClass(isActive) {
  return isActive
    ? "toggle-pill toggle-pill-active"
    : "toggle-pill toggle-pill-idle";
}

// ประเมินครบทุกคนแล้ว = ทุกคนมีฟิลด์ status ถูกบันทึกไว้
function isRosterComplete(existingMap) {
  return players.length > 0 && players.every((p) => !!existingMap.get(p.id)?.status);
}

function renderRoster(existingMap) {
  currentAttendanceMap = existingMap;
  const locked = isRosterComplete(existingMap) && !currentIsAdmin;
  rosterLockedBanner.classList.toggle("hidden", !locked);

  rosterBody.innerHTML = "";
  if (players.length === 0) {
    rosterBody.innerHTML =
      '<tr><td colspan="3" class="px-4 py-6 text-center text-slate-400">ยังไม่มีผู้เล่นในทีมนี้</td></tr>';
    return;
  }
  for (const p of players) {
    const existing = existingMap.get(p.id) || {};
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.className = "emphasis";
    nameTd.textContent = p.nickname ?? p.fullName ?? "-";
    tr.appendChild(nameTd);

    const statusTd = document.createElement("td");
    statusTd.className = "space-x-2";
    if (locked) {
      statusTd.innerHTML = existing.status
        ? `<span class="badge badge-neutral">${existing.status}</span>`
        : '<span class="text-slate-400">-</span>';
    } else {
      for (const status of STATUS_OPTIONS) {
        const btn = document.createElement("button");
        btn.textContent = status;
        btn.className = activeBtnClass(existing.status === status);
        btn.addEventListener("click", () =>
          saveAttendanceField(p.id, "status", status)
        );
        statusTd.appendChild(btn);
      }
    }
    tr.appendChild(statusTd);

    const scoreTd = document.createElement("td");
    scoreTd.className = "space-x-2";
    if (locked) {
      scoreTd.innerHTML = existing.score
        ? `<span class="badge badge-neutral">${existing.score}</span>`
        : '<span class="text-slate-400">-</span>';
    } else {
      for (const score of SCORE_OPTIONS) {
        const btn = document.createElement("button");
        btn.textContent = String(score);
        btn.className = activeBtnClass(existing.score === score);
        btn.addEventListener("click", () =>
          saveAttendanceField(p.id, "score", score)
        );
        scoreTd.appendChild(btn);
      }
    }
    const timeSpan = document.createElement("span");
    timeSpan.className = "text-xs text-slate-400 ml-2";
    timeSpan.textContent = formatEvalTime(existing.updatedAt)
      ? `ประเมินเมื่อ ${formatEvalTime(existing.updatedAt)} น.`
      : "";
    scoreTd.appendChild(timeSpan);
    tr.appendChild(scoreTd);

    rosterBody.appendChild(tr);
  }
}

async function saveAttendanceField(playerId, field, value) {
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
        [field]: value,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    const prev = currentAttendanceMap.get(playerId) || {};
    currentAttendanceMap.set(playerId, { ...prev, [field]: value, updatedAt: { toDate: () => new Date() } });
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
    showNoTrainingView();
    setAttendanceStatus(`บันทึกวันที่ ${dateStr} เป็น "ไม่มีฝึกซ้อม" แล้ว ✓`);
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
    await loadSessionForDate(dateInput.value);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("ยกเลิกไม่สำเร็จ: " + err.message, true);
  }
});
