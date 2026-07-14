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
import {
  applyDataLabels,
  SCORE_CATEGORIES,
  computeAvgScore,
  isPlayerFullyEvaluated,
  teamLogoImg,
  isTrainingPlanLate,
  TRAINING_PLAN_LATE_WARNING_THRESHOLD,
  statCard
} from "./ui-utils.js";

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
const addPlayerSection = document.getElementById("add-player-section");
const checkinSection = document.getElementById("checkin-section");
const reportSection = document.getElementById("report-section");
const matchReportSection = document.getElementById("match-report-section");
const injuryReportSection = document.getElementById("injury-report-section");
const matchReportForm = document.getElementById("match-report-form");
const matchReportStatus = document.getElementById("match-report-status");
const matchReportSubmitBtn = document.getElementById("match-report-submit-btn");
const cancelEditMatchBtn = document.getElementById("cancel-edit-match-btn");
const matchReportListBody = document.getElementById("match-report-list-body");
const injuryReportForm = document.getElementById("injury-report-form");
const injuryReportStatus = document.getElementById("injury-report-status");
const injuryReportSubmitBtn = document.getElementById("injury-report-submit-btn");
const cancelEditInjuryBtn = document.getElementById("cancel-edit-injury-btn");
const injuryReportListBody = document.getElementById("injury-report-list-body");
const injuryAgeGroupSelect = document.getElementById("injury-age-group");
const injuryPlayerSearchInput = document.getElementById("injury-player-search");
const injuryPlayerDropdown = document.getElementById("injury-player-dropdown");
const trainingPlanSection = document.getElementById("training-plan-section");
const trainingPlanForm = document.getElementById("training-plan-form");
const trainingPlanStatus = document.getElementById("training-plan-status");
const trainingPlanSubmitBtn = document.getElementById("training-plan-submit-btn");
const cancelEditTrainingPlanBtn = document.getElementById("cancel-edit-training-plan-btn");
const trainingPlanListBody = document.getElementById("training-plan-list-body");
const trainingPlanDateInput = document.getElementById("training-plan-date");
const trainingPlanPlayerGroupSegmentedWrap = document.getElementById("training-plan-player-group-segmented");
const trainingPlanAgeGroupToggleWrap = document.getElementById("training-plan-age-group-toggle");
const trainingPlanTypeSegmentedWrap = document.getElementById("training-plan-type-segmented");
const trainingPlanPhaseSegmentedWrap = document.getElementById("training-plan-phase-segmented");
const trainingPlanCompetitionTopicWrap = document.getElementById("training-plan-competition-topic-wrap");
const trainingPlanCompetitionTopicInput = document.getElementById("training-plan-competition-topic");
const trainingPlanMainPartSelect = document.getElementById("training-plan-main-part");
const trainingPlanPhysicalToggleWrap = document.getElementById("training-plan-physical-toggle");
const trainingPlanNotesInput = document.getElementById("training-plan-notes");
const trainingPlanLateWarning = document.getElementById("training-plan-late-warning");
const trainingPlanLateCountEl = document.getElementById("training-plan-late-count");
const dailySection = document.getElementById("daily-section");
const dailyDateInput = document.getElementById("daily-date-input");
const dailyLoadBtn = document.getElementById("daily-load-btn");
const dailyStatus = document.getElementById("daily-status");
const dailyDateHeading = document.getElementById("daily-date-heading");
const dailyAttendanceBody = document.getElementById("daily-attendance-body");
const dailyTrainingReportCard = document.getElementById("daily-training-report-card");
const dailyTrainingPlanCard = document.getElementById("daily-training-plan-card");
const dailyMatchBody = document.getElementById("daily-match-body");
const dailyInjuryBody = document.getElementById("daily-injury-body");
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
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const registerForm = document.getElementById("register-form");
const registerError = document.getElementById("register-error");
const registerAgeGroupWrap = document.getElementById("register-age-group-wrap");
const registerAgeGroupSelect = document.getElementById("register-age-group");
const pendingSection = document.getElementById("pending-section");
const pendingLogoutBtn = document.getElementById("pending-logout-btn");
const executiveSection = document.getElementById("executive-section");
const executiveDashboardLink = document.getElementById("executive-dashboard-link");
const executiveStatusEl = document.getElementById("executive-status");
const executiveStatCards = document.getElementById("executive-stat-cards");
const executiveLateWarning = document.getElementById("executive-late-warning");
const executiveLateCountEl = document.getElementById("executive-late-count");
const coachNameEl = document.getElementById("coach-name");
const coachEmailEl = document.getElementById("coach-email");
const coachTeamEl = document.getElementById("coach-team");
const coachStatusBadgeEl = document.getElementById("coach-status-badge");
const coachAgeGroupsEl = document.getElementById("coach-age-groups");
const coachAgeGroupsWrap = document.getElementById("coach-age-groups-wrap");
const coachRoleBadgeEl = document.getElementById("coach-role-badge");
const adminCoachesSection = document.getElementById("admin-coaches-section");
const adminProgressSection = document.getElementById("admin-progress-section");
const adminApprovalsSection = document.getElementById("admin-approvals-section");
const adminMatchesSection = document.getElementById("admin-matches-section");
const adminMatchListBody = document.getElementById("admin-match-list-body");
const adminInjuriesSection = document.getElementById("admin-injuries-section");
const adminInjuryListBody = document.getElementById("admin-injury-list-body");
const adminManageTeamSection = document.getElementById("admin-manage-team-section");
const adminDashboardSection = document.getElementById("admin-dashboard-section");
const adminPrintSection = document.getElementById("admin-print-section");
const adminBackButtons = document.querySelectorAll("[data-admin-back]");
const pendingApprovalsBody = document.getElementById("pending-approvals-body");
const adminTeamSelect = document.getElementById("admin-team-select");
const adminSelectTeamBtn = document.getElementById("admin-select-team-btn");
const adminSelectTeamExecutiveBtn = document.getElementById("admin-select-team-executive-btn");
const adminDashboardTeamSelect = document.getElementById("admin-dashboard-team-select");
const adminViewDashboardBtn = document.getElementById("admin-view-dashboard-btn");
const adminPrintTeamSelect = document.getElementById("admin-print-team-select");
const adminPrintAgeGroupSelect = document.getElementById("admin-print-age-group-select");
const adminGeneratePrintBtn = document.getElementById("admin-generate-print-btn");
const adminPrintStatus = document.getElementById("admin-print-status");
const adminStatus = document.getElementById("admin-status");
const hamburgerBtn = document.getElementById("hamburger-btn");
const notificationBellBtn = document.getElementById("notification-bell-btn");
const navDrawerOverlay = document.getElementById("nav-drawer-overlay");
const navDrawer = document.getElementById("nav-drawer");
const navDrawerCloseBtn = document.getElementById("nav-drawer-close-btn");
const navDrawerItems = document.getElementById("nav-drawer-items");
const navDrawerNameEl = document.getElementById("nav-drawer-name");
const navDrawerEmailEl = document.getElementById("nav-drawer-email");
const navDrawerRoleBadgeEl = document.getElementById("nav-drawer-role-badge");
const drawerLogoutBtn = document.getElementById("drawer-logout-btn");
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
// จำหน้าจอผู้ดูแลระบบที่พาเข้ามาจัดการทีม เพื่อให้รายการ "กลับแผงควบคุมผู้ดูแลระบบ" ใน nav drawer
// ย้อนกลับไปจุดเดิมที่ละสเต็ป (มีได้ทั้งจาก "จัดการข้อมูลทีม" หรือคลิกชื่อทีมในตาราง "รายชื่อโค้ชในระบบ")
let adminReturnSection = null;
// เมื่อผู้ดูแลระบบสวมบทบาทเข้าไปดูข้อมูลทีมใดทีมหนึ่ง (myTeam ถูกตั้งค่า) ตัวแปรนี้บอกว่ากำลังสวมบทบาท
// เป็น "coach" (จัดการข้อมูลทีมได้เต็มรูปแบบ) หรือ "executive" (ดูอย่างเดียวเหมือนผู้บริหารทีมจริง)
// ใช้กำหนดว่า nav drawer ควรแสดงเมนูแบบไหน — เป็น null เมื่อไม่ได้อยู่ในโหมดสวมบทบาทใดๆ
let adminViewingAs = null;
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

// ---------- Login ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "เข้าสู่ระบบไม่สำเร็จ: " + (err.code ? authErrorMessage(err) : err.message);
  }
});

drawerLogoutBtn.addEventListener("click", () => {
  closeDrawer();
  signOut(auth);
});
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

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const payload = { name, email, role, status: "pending", createdAt: serverTimestamp() };
    if (role === "coach") payload.ageGroup = ageGroup;
    await setDoc(doc(db, "coaches", cred.user.uid), payload);
    registerForm.reset();
    // onAuthStateChanged จะทำงานต่อเองและแสดงหน้า "รอผู้ดูแลระบบอนุมัติ"
  } catch (err) {
    registerError.textContent = "ลงทะเบียนไม่สำเร็จ: " + authErrorMessage(err);
  }
});

function hideAllScreens() {
  pendingSection.classList.add("hidden");
  executiveSection.classList.add("hidden");
  adminCoachesSection.classList.add("hidden");
  adminProgressSection.classList.add("hidden");
  adminApprovalsSection.classList.add("hidden");
  adminMatchesSection.classList.add("hidden");
  adminInjuriesSection.classList.add("hidden");
  adminManageTeamSection.classList.add("hidden");
  adminDashboardSection.classList.add("hidden");
  adminPrintSection.classList.add("hidden");
  addPlayerSection.classList.add("hidden");
  checkinSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  matchReportSection.classList.add("hidden");
  injuryReportSection.classList.add("hidden");
  trainingPlanSection.classList.add("hidden");
  dailySection.classList.add("hidden");
}

// หน้าแรกหลังล็อกอินสำหรับโค้ช (และผู้ดูแลระบบที่กำลังจัดการทีมใดทีมหนึ่งอยู่) — แทนที่เมนูการ์ดแบบเดิม
function showDaily() {
  hideAllScreens();
  dailySection.classList.remove("hidden");
  if (!dailyDateInput.value) {
    dailyDateInput.value = new Date().toISOString().slice(0, 10);
  }
  loadDailyData(dailyDateInput.value);
}

// ---------- เมนูนำทางแบบเลื่อน (Hamburger Drawer) ----------
function openDrawer() {
  renderDrawerItems();
  navDrawerOverlay.classList.remove("hidden");
  navDrawer.classList.remove("nav-drawer-hidden");
}

function closeDrawer() {
  navDrawer.classList.add("nav-drawer-hidden");
  navDrawerOverlay.classList.add("hidden");
}

hamburgerBtn.addEventListener("click", openDrawer);
navDrawerCloseBtn.addEventListener("click", closeDrawer);
navDrawerOverlay.addEventListener("click", closeDrawer);

function drawerItem(icon, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "drawer-item";
  btn.innerHTML = `<span class="drawer-item-icon">${icon}</span><span>${label}</span>`;
  btn.addEventListener("click", () => {
    closeDrawer();
    onClick();
  });
  return btn;
}

function drawerSectionLabel(html) {
  const div = document.createElement("div");
  div.className = "drawer-section-label";
  div.innerHTML = html;
  return div;
}

function drawerDivider() {
  const div = document.createElement("div");
  div.className = "drawer-divider";
  return div;
}

function goToDashboard() {
  window.location.href = `${window.location.origin}/`;
}

// ผู้ดูแลระบบออกจากโหมด "จัดการทีมแทนโค้ช" กลับไปยังจุดที่พาเข้ามา (ทีละสเต็ป ตาม adminReturnSection —
// เซ็ตไว้เสมอตอนเข้าโหมดนี้ใน enterTeamManagementMode จึงไม่มีทางเป็น null จริงๆ แต่กันไว้ด้วย fallback)
// พร้อมล้าง myTeam ไม่ให้เมนูค้างแสดงเครื่องมือของทีมเดิมหลังออกจากโหมดนี้แล้ว
function exitTeamManagementToAdminPanel() {
  hideAllScreens();
  (adminReturnSection || adminManageTeamSection).classList.remove("hidden");
  myTeam = null;
  adminReturnSection = null;
  adminViewingAs = null;
  // สลับป้ายบทบาทกลับเป็น "ผู้ดูแลระบบ" ตามเดิม (ตรงข้ามกับที่สลับเป็น "โค้ช"/"ผู้บริหารทีม" ไว้ตอนเข้าโหมด
  // สวมบทบาท ผ่าน enterTeamManagementMode / enterExecutiveViewMode)
  coachRoleBadgeEl.textContent = "ผู้ดูแลระบบ";
  coachRoleBadgeEl.className = "badge badge-info";
  coachTeamEl.textContent = "เข้าถึงได้ทุกทีม";
  coachAgeGroupsWrap.classList.add("hidden");
  renderDrawerItems();
}

// เนื้อหาเมนูปรับตามบทบาทและบริบทปัจจุบัน (โค้ช / ผู้บริหารทีม / ผู้ดูแลระบบ, กำลังจัดการทีมอยู่หรือไม่)
function renderDrawerItems() {
  // ซิงก์ป้ายบทบาทจากแถบข้อมูลโค้ช (coach-bar) เข้ามาในลิ้นชักด้วย เพราะกำหนดค่าหลังจุดที่เรียก
  // renderCoachProfile() เสมอ (renderDrawerItems ถูกเรียกทีหลังในทุกกรณี จึงอ่านค่าล่าสุดได้ตรงกัน)
  navDrawerRoleBadgeEl.innerHTML = coachRoleBadgeEl.outerHTML;
  navDrawerItems.innerHTML = "";

  if (currentIsAdmin) {
    if (myTeam && adminViewingAs === "executive") {
      // สวมบทบาทเป็นผู้บริหารทีม (ดูอย่างเดียว) — เมนูเหมือนที่ผู้บริหารทีมจริงเห็นทุกประการ (มีแค่ทาง
      // ไป Dashboard) บวกทางกลับแผงควบคุมผู้ดูแลระบบเพิ่มมาให้ (ผู้บริหารทีมจริงไม่มีปุ่มนี้)
      navDrawerItems.appendChild(drawerSectionLabel(`ผู้บริหารทีม: ${teamLogoImg(myTeam)}${myTeam}`));
      navDrawerItems.appendChild(drawerItem("📊", "Dashboard", goToDashboard));
      navDrawerItems.appendChild(drawerDivider());
      navDrawerItems.appendChild(drawerItem("🛡️", "กลับแผงควบคุมผู้ดูแลระบบ", exitTeamManagementToAdminPanel));
    } else if (myTeam) {
      navDrawerItems.appendChild(drawerSectionLabel(`จัดการทีม: ${teamLogoImg(myTeam)}${myTeam}`));
      navDrawerItems.appendChild(drawerItem("📅", "Daily", showDaily));
      navDrawerItems.appendChild(drawerItem("👤", "เพิ่ม/แก้ไขนักกีฬา", openAddPlayerSection));
      navDrawerItems.appendChild(drawerItem("✅", "เช็คชื่อ + ให้คะแนน", openCheckinSection));
      navDrawerItems.appendChild(drawerItem("📝", "รายงานการฝึกซ้อม", openReportSection));
      navDrawerItems.appendChild(drawerItem("⚽", "รายงานผลการแข่งขัน", openMatchReportSection));
      navDrawerItems.appendChild(drawerItem("🩹", "รายงานอาการบาดเจ็บ", openInjuryReportSection));
      navDrawerItems.appendChild(drawerItem("📋", "แผนการฝึกซ้อมรายวัน", openTrainingPlanSection));
      navDrawerItems.appendChild(drawerDivider());
      navDrawerItems.appendChild(drawerItem("🛡️", "กลับแผงควบคุมผู้ดูแลระบบ", exitTeamManagementToAdminPanel));
    } else {
      navDrawerItems.appendChild(drawerSectionLabel("ผู้ดูแลระบบ"));
      navDrawerItems.appendChild(drawerItem("👥", "รายชื่อโค้ชในระบบ", openAdminCoachesSection));
      navDrawerItems.appendChild(drawerItem("📈", "ความคืบหน้าการประเมินรายวัน", openAdminProgressSection));
      navDrawerItems.appendChild(drawerItem("📝", "คำขอลงทะเบียนที่รอการอนุมัติ", openAdminApprovalsSection));
      navDrawerItems.appendChild(drawerItem("⚽", "รายงานผลการแข่งขันทั้งหมด", openAdminMatchesSection));
      navDrawerItems.appendChild(drawerItem("🩹", "รายงานอาการบาดเจ็บทั้งหมด", openAdminInjuriesSection));
      navDrawerItems.appendChild(drawerItem("📁", "จัดการข้อมูลทีม", openAdminManageTeamSection));
      navDrawerItems.appendChild(drawerItem("📊", "ดู Dashboard ทีม", openAdminDashboardSection));
      navDrawerItems.appendChild(drawerItem("🖨️", "พิมพ์สรุป Dashboard", openAdminPrintSection));
      navDrawerItems.appendChild(drawerItem("📈", "พัฒนาการนักกีฬา", () => (window.location.href = "./development.html")));
      navDrawerItems.appendChild(drawerDivider());
      navDrawerItems.appendChild(drawerItem("🏠", "หน้า Dashboard หลัก", goToDashboard));
    }
    return;
  }

  if (myTeam) {
    navDrawerItems.appendChild(drawerSectionLabel(`ทีม: ${teamLogoImg(myTeam)}${myTeam}`));
    navDrawerItems.appendChild(drawerItem("📅", "Daily", showDaily));
    navDrawerItems.appendChild(drawerItem("👤", "เพิ่ม/แก้ไขนักกีฬา", openAddPlayerSection));
    navDrawerItems.appendChild(drawerItem("✅", "เช็คชื่อ + ให้คะแนน", openCheckinSection));
    navDrawerItems.appendChild(drawerItem("📝", "รายงานการฝึกซ้อม", openReportSection));
    navDrawerItems.appendChild(drawerItem("⚽", "รายงานผลการแข่งขัน", openMatchReportSection));
    navDrawerItems.appendChild(drawerItem("🩹", "รายงานอาการบาดเจ็บ", openInjuryReportSection));
    navDrawerItems.appendChild(drawerItem("📋", "แผนการฝึกซ้อมรายวัน", openTrainingPlanSection));
    navDrawerItems.appendChild(drawerDivider());
    navDrawerItems.appendChild(drawerItem("📊", "Dashboard", goToDashboard));
    return;
  }

  // ผู้บริหารทีม (ดูข้อมูลอย่างเดียว ไม่มีเครื่องมือจัดการทีม) หรือกรณีอื่นที่ยังไม่ทราบทีม
  navDrawerItems.appendChild(drawerSectionLabel("เมนู"));
  navDrawerItems.appendChild(drawerItem("📊", "Dashboard", goToDashboard));
}

function populateTeamSelect(selectEl, placeholder) {
  selectEl.innerHTML =
    (placeholder ? `<option value="">${placeholder}</option>` : "") +
    TEAMS.map((t) => `<option value="${t}">${t}</option>`).join("");
}

// ฟังก์ชันเปิดแต่ละหน้าย่อยของผู้ดูแลระบบ แยกเป็นชื่อฟังก์ชันเดี่ยวๆ (ไม่ใช่ arrow function มืดในปุ่มการ์ดตรงๆ)
// เพื่อให้เรียกได้ทั้งจากการ์ดในหน้าแผงควบคุม และจากรายการเมนูใน nav drawer โดยตรง
function openAdminCoachesSection() {
  hideAllScreens();
  adminCoachesSection.classList.remove("hidden");
  loadCoachDirectory();
}

function openAdminProgressSection() {
  hideAllScreens();
  adminProgressSection.classList.remove("hidden");
  if (!progressDateInput.value) {
    progressDateInput.value = new Date().toISOString().slice(0, 10);
  }
  loadDailyProgress(progressDateInput.value);
}

function openAdminApprovalsSection() {
  hideAllScreens();
  adminApprovalsSection.classList.remove("hidden");
  loadPendingApprovals();
}

// ผู้ดูแลระบบเห็นข้อมูลได้ทุกทีมอยู่แล้ว (isAdmin() ไม่ผูกกับ resource.data ใน Firestore rules) จึง query
// แบบไม่กรอง team ได้เลย ต่างจากหน้าของโค้ชที่ต้อง where("team","==",myTeam) เสมอ
async function loadAdminMatchList() {
  adminMatchListBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const snap = await getDocs(collection(db, "matchReports"));
  const reports = [];
  snap.forEach((d) => reports.push(d.data()));
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (reports.length === 0) {
    adminMatchListBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายการแข่งขันจากทีมใดเลย</td></tr>';
    return;
  }

  adminMatchListBody.innerHTML = reports
    .map(
      (m) => `
      <tr>
        <td class="emphasis">${teamLogoImg(m.team)}${m.team ?? "-"}</td>
        <td>${m.date ?? "-"}</td>
        <td>${m.opponent ?? "-"}</td>
        <td>${m.competitionType ?? "-"}</td>
        <td>${m.ageGroup ?? "-"}</td>
        <td>${matchResultBadge(m.result)}</td>
        <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
        <td>${m.competition ?? "-"}</td>
      </tr>`
    )
    .join("");
  applyDataLabels(adminMatchListBody);
}

async function loadAdminInjuryList() {
  adminInjuryListBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const snap = await getDocs(collection(db, "injuryReports"));
  const reports = [];
  snap.forEach((d) => reports.push(d.data()));
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (reports.length === 0) {
    adminInjuryListBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ไม่มีรายงานอาการบาดเจ็บจากทีมใดเลย</td></tr>';
    return;
  }

  adminInjuryListBody.innerHTML = reports
    .map(
      (inj) => `
      <tr>
        <td class="emphasis">${teamLogoImg(inj.team)}${inj.team ?? "-"}</td>
        <td>${inj.date ?? "-"}</td>
        <td>${inj.playerName ?? "-"}</td>
        <td>${inj.ageGroup ?? "-"}</td>
        <td>${inj.description ?? "-"}</td>
        <td>${injurySeverityBadge(inj.severity)}</td>
        <td>${injuryStatusBadge(inj.status)}</td>
        <td>${inj.expectedReturn ?? "-"}</td>
      </tr>`
    )
    .join("");
  applyDataLabels(adminInjuryListBody);
}

function openAdminMatchesSection() {
  hideAllScreens();
  adminMatchesSection.classList.remove("hidden");
  loadAdminMatchList();
}

function openAdminInjuriesSection() {
  hideAllScreens();
  adminInjuriesSection.classList.remove("hidden");
  loadAdminInjuryList();
}

function openAdminManageTeamSection() {
  hideAllScreens();
  adminManageTeamSection.classList.remove("hidden");
  populateTeamSelect(adminTeamSelect, null);
}

function openAdminDashboardSection() {
  hideAllScreens();
  adminDashboardSection.classList.remove("hidden");
  // มีตัวเลือก "ทุกทีม (ภาพรวม)" เพิ่มจากทีมเดี่ยว เพราะหน้า Dashboard เองตัดตัวเลือกทีมออกไปแล้ว
  // (เลือกทีมได้ที่นี่จุดเดียว)
  adminDashboardTeamSelect.innerHTML =
    '<option value="">-- เลือกทีม --</option>' +
    '<option value="__ALL__">ทุกทีม (ภาพรวม)</option>' +
    TEAMS.map((t) => `<option value="${t}">${t}</option>`).join("");
}

function openAdminPrintSection() {
  hideAllScreens();
  adminPrintSection.classList.remove("hidden");
  populateTeamSelect(adminPrintTeamSelect, null);
  adminPrintAgeGroupSelect.value = "__ALL__";
  adminPrintStatus.textContent = "";
}

adminGeneratePrintBtn.addEventListener("click", () => {
  const team = adminPrintTeamSelect.value;
  if (!team) {
    adminPrintStatus.textContent = "กรุณาเลือกทีมก่อน";
    return;
  }
  const ageGroup = adminPrintAgeGroupSelect.value;
  adminPrintStatus.textContent = "";
  // ใช้ path เต็ม "/print.html" (มีนามสกุลไฟล์) เพราะ Vercel (โฮสต์จริง) ไม่รองรับ path
  // แบบไม่มีนามสกุลอัตโนมัติเหมือนเซิร์ฟเวอร์ทดสอบในเครื่อง (จะขึ้น 404) — ไฟล์ .html ยิงตรงได้ทุกที่
  window.location.href = `${window.location.origin}/print.html?team=${encodeURIComponent(team)}&ageGroup=${encodeURIComponent(ageGroup)}`;
});

// หน้าแผงควบคุมแบบการ์ด (admin-menu-section) ถูกยกเลิกไปแล้ว — ปุ่ม "← กลับหน้า Dashboard" ในแต่ละ
// เครื่องมือของผู้ดูแลระบบจึงย้อนกลับไปหน้า Dashboard โดยตรงแทน (ซึ่งเป็นหน้าหลักของผู้ดูแลระบบอยู่แล้ว)
for (const btn of adminBackButtons) {
  btn.addEventListener("click", goToDashboard);
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

function openAddPlayerSection() {
  hideAllScreens();
  addPlayerSection.classList.remove("hidden");
  applyAgeGroupLock();
  renderPlayerList();
}

function openCheckinSection() {
  hideAllScreens();
  checkinSection.classList.remove("hidden");
  showRosterView();
}

function openReportSection() {
  hideAllScreens();
  reportSection.classList.remove("hidden");
  reportForm.classList.add("hidden");
  reportStatus.textContent = "";
  reportLoadStatus.textContent = "";
  if (!reportDateInput.value) {
    reportDateInput.value = new Date().toISOString().slice(0, 10);
  }
}

function openMatchReportSection() {
  hideAllScreens();
  matchReportSection.classList.remove("hidden");
  stopEditMatch();
  renderMatchReportList();
}

function openInjuryReportSection() {
  hideAllScreens();
  injuryReportSection.classList.remove("hidden");
  stopEditInjury();
  renderInjuryReportList();
}

dailyLoadBtn.addEventListener("click", () => {
  if (!dailyDateInput.value) {
    dailyStatus.textContent = "กรุณาเลือกวันที่ก่อน";
    dailyStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  loadDailyData(dailyDateInput.value);
});

for (const btn of backButtons) {
  btn.addEventListener("click", () => {
    if (editingPlayerId) stopEditPlayer();
    // ปุ่มนี้อยู่ในหน้าเพิ่มนักกีฬา/เช็คชื่อ/รายงาน/แข่งขัน/บาดเจ็บ ซึ่งหลังลบเมนูการ์ดออกแล้ว
    // หน้า Daily คือหน้าแม่หนึ่งเดียวของทั้งหมดนี้ จึงย้อนกลับไปหน้า Daily ทีละสเต็ปเสมอ
    showDaily();
  });
}

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
      viewBtn.innerHTML = `${teamLogoImg(c.team, "w-5 h-5 object-contain inline-block align-middle mr-1 rounded")}${c.team}`;
      viewBtn.title = "คลิกเพื่อดู/จัดการข้อมูลทีมนี้";
      viewBtn.className = "btn btn-secondary btn-sm";
      viewBtn.addEventListener("click", () => enterTeamManagementMode(c.team, adminCoachesSection));
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

async function enterTeamManagementMode(team, returnSection) {
  myTeam = team;
  myCoachName = myCoachName || auth.currentUser?.email;
  myAgeGroup = null; // ผู้ดูแลระบบจัดการทีมแทนโค้ช เลือกรุ่นอายุของนักกีฬาได้อิสระทุกรุ่น
  adminViewingAs = "coach";
  // แสดงป้ายบทบาทเป็น "โค้ช" เหมือนจริง (แทนที่จะขึ้น "ผู้ดูแลระบบ" ตลอด) เพื่อให้ผู้ดูแลระบบเห็นหน้าจอ
  // ตรงกับที่โค้ชจริงเห็นทุกประการเวลาสวมบทบาทเข้ามาทดสอบ/ตรวจสอบระบบ — สลับกลับตอนออกจากโหมดนี้ที่
  // exitTeamManagementToAdminPanel()
  coachRoleBadgeEl.textContent = "โค้ช";
  coachRoleBadgeEl.className = "badge badge-success";
  coachTeamEl.innerHTML = `${teamLogoImg(team)}${team}`;
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  // เมนูนี้ถูกเข้าถึงผ่านผู้ดูแลระบบ (ไม่ใช่โค้ชล็อกอินเอง) จึงต้องมีรายการ "กลับแผงควบคุมผู้ดูแลระบบ"
  // ใน nav drawer ที่ย้อนกลับไปจุดที่พามาที่นี่ทีละสเต็ป (ดู exitTeamManagementToAdminPanel)
  adminReturnSection = returnSection || adminManageTeamSection;
  await loadPlayers();
  renderDrawerItems();
  showDaily();
}

// ผู้ดูแลระบบสวมบทบาทเป็น "ผู้บริหารทีม" (ดูอย่างเดียว) แทนที่จะเป็นโค้ชเต็มรูปแบบ — ใช้ตรวจสอบว่าหน้าจอ
// ที่ผู้บริหารทีมจริงเห็นถูกต้องหรือไม่ โดยไม่ต้องขอให้ผู้บริหารทีมจริงล็อกอินทดสอบให้
function enterExecutiveViewMode(team, returnSection) {
  myTeam = team;
  myAgeGroup = null;
  adminViewingAs = "executive";
  coachRoleBadgeEl.textContent = "ผู้บริหารทีม";
  coachRoleBadgeEl.className = "badge badge-neutral";
  coachTeamEl.innerHTML = `${teamLogoImg(team)}${team}`;
  coachAgeGroupsWrap.classList.add("hidden");
  // ผู้บริหารทีมจริงไปหน้า Dashboard โดยไม่ต้องแนบ ?team= เพราะระบบรู้ทีมจากบัญชีอยู่แล้ว แต่ผู้ดูแลระบบที่
  // สวมบทบาทไม่มีทีมผูกกับบัญชีจริง จึงต้องแนบทีมที่เลือกไว้ไปกับลิงก์ด้วย ไม่งั้น Dashboard จะไม่รู้ว่าจะโชว์ทีมไหน
  executiveDashboardLink.href = `/?team=${encodeURIComponent(team)}`;
  adminReturnSection = returnSection || adminManageTeamSection;
  hideAllScreens();
  executiveSection.classList.remove("hidden");
  renderDrawerItems();
  loadExecutiveSummary(team);
}

// สรุปภาพรวมทีมสั้นๆ ที่ผู้บริหารทีมควรเห็นทันทีที่เข้าระบบ (ไม่ต้องคลิกไปหน้า Dashboard ก่อนถึงจะเห็นอะไร)
// ใช้ร่วมกันทั้งบัญชีผู้บริหารทีมจริง และผู้ดูแลระบบที่สวมบทบาทผ่าน enterExecutiveViewMode
async function loadExecutiveSummary(team) {
  executiveStatusEl.textContent = "กำลังโหลดข้อมูล...";
  executiveStatCards.innerHTML = "";
  executiveLateWarning.classList.add("hidden");
  try {
    const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const [playersSnap, attendanceSnap, trainingPlansSnap] = await Promise.all([
      getDocs(query(collection(db, "players"), where("team", "==", team))),
      getDocs(query(collection(db, "attendance"), where("team", "==", team))),
      getDocs(query(collection(db, "trainingPlans"), where("team", "==", team)))
    ]);

    const totalPlayers = playersSnap.size;

    const attendanceRecords = [];
    attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));
    const monthAttendance = attendanceRecords.filter((r) => (r.date || "").startsWith(thisMonth));
    const attendedCount = monthAttendance.filter((r) => r.status === "A").length;
    const attendPercent = monthAttendance.length > 0 ? Math.round((attendedCount / monthAttendance.length) * 100) : 0;
    const scoredRecords = monthAttendance.filter((r) => computeAvgScore(r.scores) !== null);
    const avgScore =
      scoredRecords.length > 0
        ? (scoredRecords.reduce((sum, r) => sum + computeAvgScore(r.scores), 0) / scoredRecords.length).toFixed(2)
        : "-";

    const trainingPlans = [];
    trainingPlansSnap.forEach((d) => trainingPlans.push(d.data()));
    const monthPlans = trainingPlans.filter((p) => (p.date || "").startsWith(thisMonth));
    const lateCount = monthPlans.filter((p) => isTrainingPlanLate(p)).length;

    executiveStatCards.innerHTML =
      statCard("นักกีฬาทั้งหมด", totalPlayers) +
      statCard("% เข้าร่วมฝึกซ้อมเดือนนี้", `${attendPercent}%`) +
      statCard("คะแนนประเมินเฉลี่ยเดือนนี้", avgScore) +
      statCard("แผนฝึกซ้อมที่ส่งเดือนนี้", monthPlans.length);

    executiveLateWarning.classList.toggle("hidden", lateCount <= TRAINING_PLAN_LATE_WARNING_THRESHOLD);
    executiveLateCountEl.textContent = lateCount;

    executiveStatusEl.textContent = `อัปเดตข้อมูลล่าสุด • ทีม ${team}`;
  } catch (err) {
    console.error(err);
    executiveStatusEl.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
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
  enterTeamManagementMode(team, adminManageTeamSection);
});

adminSelectTeamExecutiveBtn.addEventListener("click", () => {
  const team = adminTeamSelect.value;
  if (!team) {
    adminStatus.textContent = "กรุณาระบุทีมที่ต้องการดู";
    adminStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  enterExecutiveViewMode(team, adminManageTeamSection);
});

// แสดงโปรไฟล์ผู้ใช้งานที่มีในระบบให้ครบทุกส่วน (ชื่อ, อีเมล, ทีม, สถานะบัญชี, รุ่นอายุที่รับผิดชอบ)
// ฟิลด์ "รุ่นอายุที่รับผิดชอบ" แสดงเฉพาะบทบาทโค้ชเท่านั้น (ผู้ดูแลระบบ/ผู้บริหารทีมไม่ต้องแสดง — ซ่อนด้วย
// coachAgeGroupsWrap) และอัปเดตแยกหลังโหลดรายชื่อนักกีฬาของทีมเสร็จ (ดู renderAgeGroupsFromPlayers)
function renderCoachProfile(user, data, teamText) {
  coachNameEl.textContent = (data && data.name) || user.email;
  coachEmailEl.textContent = user.email;
  // teamLogoImg คืนค่าว่างเองถ้า teamText ไม่ตรงชื่อทีมจริง (เช่น "เข้าถึงได้ทุกทีม" ของผู้ดูแลระบบ)
  // จึงเรียกได้เลยโดยไม่ต้องเช็คเงื่อนไขเพิ่ม
  coachTeamEl.innerHTML = `${teamLogoImg(teamText)}${teamText || "-"}`;
  coachStatusBadgeEl.innerHTML =
    data && data.status === "approved"
      ? '<span class="badge badge-success">อนุมัติแล้ว</span>'
      : '<span class="badge badge-warning">รอการอนุมัติ</span>';
  coachAgeGroupsEl.textContent = "-";
  // สะท้อนชื่อ/อีเมลเดียวกันเข้าไปในเมนูลิ้นชักด้วย เพื่อให้ผู้ใช้เห็นว่ากำลังล็อกอินด้วยบัญชีใดอยู่เสมอ
  // ไม่ว่าจะเลื่อนดูหน้าไหนอยู่ (ป้ายบทบาทซิงก์แยกใน renderDrawerItems เพราะกำหนดค่าทีหลังจุดนี้)
  navDrawerNameEl.textContent = coachNameEl.textContent;
  navDrawerEmailEl.textContent = coachEmailEl.textContent;
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
  hamburgerBtn.classList.add("hidden");
  notificationBellBtn.classList.add("hidden");
  if (!isCoachSession) {
    hideAllScreens();
    closeDrawer();
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved") {
      currentIsAdmin = false;
      renderCoachProfile(user, data, (data && data.team) || "รอผู้ดูแลระบบกำหนดทีม");
      coachAgeGroupsWrap.classList.add("hidden");
      hideAllScreens();
      pendingSection.classList.remove("hidden");
      return;
    }

    // ตั้งแต่จุดนี้เป็นต้นไปบัญชีได้รับอนุมัติแล้ว (ทุกบทบาท) จึงแสดงปุ่มเมนู/แจ้งเตือนที่แถบด้านบน
    hamburgerBtn.classList.remove("hidden");
    notificationBellBtn.classList.remove("hidden");

    currentIsAdmin = data.role === "admin";

    if (currentIsAdmin) {
      coachRoleBadgeEl.textContent = "ผู้ดูแลระบบ";
      coachRoleBadgeEl.className = "badge badge-info";
      renderCoachProfile(user, data, "เข้าถึงได้ทุกทีม");
      coachAgeGroupsWrap.classList.add("hidden");
      myTeam = null;
      adminReturnSection = null;
      renderDrawerItems();

      // หน้าแรกของผู้ดูแลระบบคือ Dashboard เสมอ — หน้านี้ (attendance.html) จะไม่แสดงแผงควบคุมเองโดย
      // อัตโนมัติอีกต่อไป เข้าถึงเครื่องมือแต่ละอย่างได้ผ่าน deep link #admin=... เท่านั้น (ลิงก์จากเมนู ☰
      // ในหน้า Dashboard หรือจากการ์ด/ปุ่มภายในหน้านี้เอง) เพื่อกันไม่ให้วน redirect ไปมา
      // ใช้ URL hash (#) แทน query string (?) เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง (serve, clean-url) จะ redirect
      // "attendance.html" ไปเป็น "attendance" และตัด query string ทิ้งระหว่างทาง แต่ hash ไม่ถูกส่งไปเซิร์ฟเวอร์
      // เลยจึงไม่โดนตัด ใช้ได้ทั้งในเครื่องและบน Vercel เหมือนกัน
      const adminDeepLinks = {
        coaches: openAdminCoachesSection,
        progress: openAdminProgressSection,
        approvals: openAdminApprovalsSection,
        matches: openAdminMatchesSection,
        injuries: openAdminInjuriesSection,
        "manage-team": openAdminManageTeamSection,
        dashboard: openAdminDashboardSection,
        print: openAdminPrintSection
      };
      const adminDeepLink = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("admin");
      if (adminDeepLink && adminDeepLinks[adminDeepLink]) {
        adminDeepLinks[adminDeepLink]();
      } else {
        window.location.href = `${window.location.origin}/`;
      }
      return;
    }

    if (data.role === "executive") {
      coachRoleBadgeEl.textContent = "ผู้บริหารทีม";
      coachRoleBadgeEl.className = "badge badge-neutral";
      renderCoachProfile(user, data, data.team);
      coachAgeGroupsWrap.classList.add("hidden");
      myTeam = null;
      adminViewingAs = null;
      // บัญชีผู้บริหารทีมจริงไม่ต้องแนบ ?team= เพราะ Dashboard รู้ทีมจากบัญชีอยู่แล้ว (ต่างจากตอนผู้ดูแล
      // ระบบสวมบทบาทที่ enterExecutiveViewMode ซึ่งต้องแนบทีมไปกับลิงก์ด้วย)
      executiveDashboardLink.href = "./index.html";
      renderDrawerItems();
      hideAllScreens();
      executiveSection.classList.remove("hidden");
      loadExecutiveSummary(data.team);
      return;
    }

    coachRoleBadgeEl.textContent = "โค้ช";
    coachRoleBadgeEl.className = "badge badge-success";
    myTeam = data.team;
    myCoachName = data.name || user.email;
    myAgeGroup = data.ageGroup || null;
    renderCoachProfile(user, data, myTeam);
    coachAgeGroupsWrap.classList.remove("hidden");
    adminReturnSection = null;
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    await loadPlayers();
    renderAgeGroupsFromPlayers();
    renderDrawerItems();
    showDaily();
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

// กลุ่มปุ่มแบบเลือกได้หลายค่าพร้อมกัน (ต่างจาก segmented ที่เลือกได้ค่าเดียว) ใช้กับตัวเลือกที่มีจำนวนมาก
// จนต้องขึ้นบรรทัดใหม่ได้ เช่น รุ่นอายุหลายรุ่น หรือจุดเน้นด้านฟิสิคอลหลายข้อ
function createChipToggleGroup(options, activeSet, onToggle) {
  const group = document.createElement("div");
  group.className = "chip-toggle-group";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(opt);
    btn.className = "chip-toggle" + (activeSet.has(opt) ? " active" : "");
    btn.addEventListener("click", () => onToggle(opt));
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

// ---------- รายงานผลการแข่งขัน ----------
const MATCH_RESULT_OPTIONS = ["ชนะ", "แพ้", "เสมอ"];
const MAX_LINEUP_SIZE = 11;

let editingMatchId = null;
let matchResult = null;
let matchLineupSelectedIds = new Set();

const matchCompetitionTypeSelect = document.getElementById("match-competition-type");
const matchAgeGroupSelect = document.getElementById("match-age-group");
const matchResultSegmentedWrap = document.getElementById("match-result-segmented");
const matchFormationInput = document.getElementById("match-formation");
const matchLineupSearchInput = document.getElementById("match-lineup-search");
const matchLineupDropdown = document.getElementById("match-lineup-dropdown");
const matchLineupChips = document.getElementById("match-lineup-chips");
const matchLineupCountEl = document.getElementById("match-lineup-count");

function matchResultBadge(result) {
  if (result === "ชนะ") return '<span class="badge badge-success">ชนะ</span>';
  if (result === "แพ้") return '<span class="badge badge-danger">แพ้</span>';
  return '<span class="badge badge-neutral">เสมอ</span>';
}

function renderMatchResultSegmented() {
  matchResultSegmentedWrap.innerHTML = "";
  matchResultSegmentedWrap.appendChild(
    createSegmentedGroup(MATCH_RESULT_OPTIONS, matchResult, (result) => {
      matchResult = result;
      renderMatchResultSegmented();
    })
  );
}

function updateMatchLineupCount() {
  matchLineupCountEl.textContent = `(${matchLineupSelectedIds.size}/${MAX_LINEUP_SIZE} คน)`;
}

// เฉพาะนักกีฬารุ่นอายุเดียวกับที่เลือกไว้ตอนบนของฟอร์มเท่านั้น (ต้องเลือกรุ่นอายุก่อนถึงจะค้นหาผู้เล่นได้)
function eligibleLineupPlayers() {
  const ageGroup = matchAgeGroupSelect.value;
  if (!ageGroup) return [];
  return players.filter((p) => p.ageGroup === ageGroup);
}

function playerLabel(p) {
  return p.nickname ?? p.fullName ?? "-";
}

function renderMatchLineupChips() {
  matchLineupChips.innerHTML = "";
  const selected = players.filter((p) => matchLineupSelectedIds.has(p.id));
  for (const p of selected) {
    const chip = document.createElement("span");
    chip.className =
      "inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-full pl-3 pr-2 py-1";
    chip.textContent = playerLabel(p);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.className = "text-slate-400 hover:text-red-600 leading-none";
    removeBtn.addEventListener("click", () => {
      matchLineupSelectedIds.delete(p.id);
      renderMatchLineupChips();
      renderMatchLineupDropdown(matchLineupSearchInput.value);
    });
    chip.appendChild(removeBtn);
    matchLineupChips.appendChild(chip);
  }
  updateMatchLineupCount();
}

function addPlayerToLineup(playerId) {
  if (matchLineupSelectedIds.size >= MAX_LINEUP_SIZE) return;
  matchLineupSelectedIds.add(playerId);
  matchLineupSearchInput.value = "";
  renderMatchLineupChips();
  renderMatchLineupDropdown("");
  matchLineupSearchInput.focus();
}

function renderMatchLineupDropdown(searchText) {
  const ageGroup = matchAgeGroupSelect.value;
  if (!ageGroup) {
    matchLineupDropdown.innerHTML = '<p class="text-sm text-slate-400 px-3 py-2">กรุณาเลือกรุ่นอายุที่แข่งขันก่อน</p>';
    matchLineupDropdown.classList.remove("hidden");
    return;
  }
  if (matchLineupSelectedIds.size >= MAX_LINEUP_SIZE) {
    matchLineupDropdown.innerHTML = '<p class="text-sm text-slate-400 px-3 py-2">เลือกครบ 11 คนแล้ว</p>';
    matchLineupDropdown.classList.remove("hidden");
    return;
  }

  const keyword = searchText.trim().toLowerCase();
  const candidates = eligibleLineupPlayers()
    .filter((p) => !matchLineupSelectedIds.has(p.id))
    .filter((p) => !keyword || playerLabel(p).toLowerCase().includes(keyword) || (p.fullName ?? "").toLowerCase().includes(keyword));

  if (candidates.length === 0) {
    matchLineupDropdown.innerHTML =
      `<p class="text-sm text-slate-400 px-3 py-2">${eligibleLineupPlayers().length === 0 ? "ไม่มีนักกีฬารุ่นอายุนี้ในทีม" : "ไม่พบนักกีฬาที่ค้นหา"}</p>`;
    matchLineupDropdown.classList.remove("hidden");
    return;
  }

  matchLineupDropdown.innerHTML = "";
  for (const p of candidates) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = `${playerLabel(p)}${p.fullName ? ` (${p.fullName})` : ""}`;
    item.className = "block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
    // ใช้ mousedown แทน click เพื่อให้ทำงานก่อน blur ของช่องค้นหา ไม่งั้น dropdown จะถูกซ่อนก่อนคลิกติด
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      addPlayerToLineup(p.id);
    });
    matchLineupDropdown.appendChild(item);
  }
  matchLineupDropdown.classList.remove("hidden");
}

matchLineupSearchInput.addEventListener("input", () => {
  renderMatchLineupDropdown(matchLineupSearchInput.value);
});
matchLineupSearchInput.addEventListener("focus", () => {
  renderMatchLineupDropdown(matchLineupSearchInput.value);
});
matchLineupSearchInput.addEventListener("blur", () => {
  matchLineupDropdown.classList.add("hidden");
});
matchAgeGroupSelect.addEventListener("change", () => {
  // เปลี่ยนรุ่นอายุแล้ว รายชื่อผู้เล่นตัวจริงที่เคยเลือกไว้อาจไม่ใช่รุ่นเดียวกันอีกต่อไป จึงล้างค่าเดิม
  matchLineupSelectedIds = new Set();
  matchLineupSearchInput.value = "";
  renderMatchLineupChips();
  matchLineupDropdown.classList.add("hidden");
});

async function renderMatchReportList() {
  matchReportListBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const snap = await getDocs(query(collection(db, "matchReports"), where("team", "==", myTeam)));
  const reports = [];
  snap.forEach((d) => reports.push({ id: d.id, ...d.data() }));
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (reports.length === 0) {
    matchReportListBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายการแข่งขัน</td></tr>';
    return;
  }

  matchReportListBody.innerHTML = "";
  for (const m of reports) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="emphasis">${m.date ?? "-"}</td>
      <td>${m.opponent ?? "-"}</td>
      <td>${m.competitionType ?? "-"}</td>
      <td>${m.ageGroup ?? "-"}</td>
      <td>${matchResultBadge(m.result)}</td>
      <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
      <td>${m.competition ?? "-"}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.className = "space-x-2";
    const editBtn = document.createElement("button");
    editBtn.textContent = "แก้ไข";
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.addEventListener("click", () => startEditMatch(m));
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "ลบ";
    deleteBtn.className = "btn btn-danger-soft btn-sm";
    deleteBtn.addEventListener("click", () => deleteMatchReport(m));
    actionTd.appendChild(editBtn);
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);
    matchReportListBody.appendChild(tr);
  }
  applyDataLabels(matchReportListBody);
}

function startEditMatch(m) {
  editingMatchId = m.id;
  document.getElementById("match-date").value = m.date ?? "";
  document.getElementById("match-opponent").value = m.opponent ?? "";
  matchCompetitionTypeSelect.value = m.competitionType ?? "ทัวร์นาเมนต์";
  document.getElementById("match-competition").value = m.competition ?? "";
  matchAgeGroupSelect.value = m.ageGroup ?? "";
  document.getElementById("match-score-us").value = m.scoreUs ?? "";
  document.getElementById("match-score-them").value = m.scoreThem ?? "";
  matchFormationInput.value = m.formation ?? "";
  document.getElementById("match-notes").value = m.notes ?? "";
  matchResult = m.result ?? null;
  renderMatchResultSegmented();
  matchLineupSelectedIds = new Set(m.startingLineupIds || []);
  renderMatchLineupChips();
  matchReportSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditMatchBtn.classList.remove("hidden");
  matchReportStatus.textContent = `กำลังแก้ไขผลการแข่งขันวันที่ ${m.date}`;
  matchReportStatus.className = "text-sm text-slate-500";
  matchReportForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEditMatch() {
  editingMatchId = null;
  matchReportForm.reset();
  matchResult = null;
  renderMatchResultSegmented();
  matchLineupSelectedIds = new Set();
  renderMatchLineupChips();
  matchLineupDropdown.classList.add("hidden");
  matchReportSubmitBtn.textContent = "บันทึกผลการแข่งขัน";
  cancelEditMatchBtn.classList.add("hidden");
}

cancelEditMatchBtn.addEventListener("click", () => {
  stopEditMatch();
  matchReportStatus.textContent = "";
});

async function deleteMatchReport(m) {
  const ok = confirm(`ยืนยันลบผลการแข่งขันวันที่ ${m.date} กับ ${m.opponent}? การลบนี้ไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "matchReports", m.id));
    if (editingMatchId === m.id) stopEditMatch();
    matchReportStatus.textContent = "ลบรายการแล้ว";
    matchReportStatus.className = "text-sm text-slate-500";
    await renderMatchReportList();
  } catch (err) {
    console.error(err);
    matchReportStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    matchReportStatus.className = "text-sm text-red-600";
  }
}

matchReportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!myTeam) {
    matchReportStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    matchReportStatus.className = "text-sm text-red-600";
    return;
  }
  if (!matchResult) {
    matchReportStatus.textContent = "กรุณาเลือกผลการแข่งขัน (ชนะ/แพ้/เสมอ)";
    matchReportStatus.className = "text-sm text-red-600";
    return;
  }
  if (!matchAgeGroupSelect.value) {
    matchReportStatus.textContent = "กรุณาเลือกรุ่นอายุที่แข่งขัน";
    matchReportStatus.className = "text-sm text-red-600";
    return;
  }

  const date = document.getElementById("match-date").value;
  const opponent = document.getElementById("match-opponent").value.trim();
  const competitionType = matchCompetitionTypeSelect.value;
  const competition = document.getElementById("match-competition").value.trim();
  const ageGroup = matchAgeGroupSelect.value;
  const scoreUs = Number(document.getElementById("match-score-us").value);
  const scoreThem = Number(document.getElementById("match-score-them").value);
  const formation = matchFormationInput.value.trim();
  const notes = document.getElementById("match-notes").value.trim();

  const lineupPlayers = players.filter((p) => matchLineupSelectedIds.has(p.id));
  const startingLineupIds = lineupPlayers.map((p) => p.id);
  const startingLineupNames = lineupPlayers.map((p) => p.nickname ?? p.fullName ?? p.id);

  const payload = {
    team: myTeam,
    date,
    opponent,
    competitionType,
    competition: competition || null,
    ageGroup,
    result: matchResult,
    scoreUs,
    scoreThem,
    formation: formation || null,
    startingLineupIds,
    startingLineupNames,
    notes: notes || null,
    coachId: auth.currentUser.uid,
    coachName: myCoachName || auth.currentUser.email,
    updatedAt: serverTimestamp()
  };

  try {
    matchReportStatus.textContent = "กำลังบันทึก...";
    matchReportStatus.className = "text-sm text-slate-500";

    if (editingMatchId) {
      await updateDoc(doc(db, "matchReports", editingMatchId), payload);
      matchReportStatus.textContent = "บันทึกการแก้ไขสำเร็จ ✓";
      matchReportStatus.className = "text-sm text-emerald-600";
      stopEditMatch();
    } else {
      await addDoc(collection(db, "matchReports"), { ...payload, createdAt: serverTimestamp() });
      matchReportForm.reset();
      matchResult = null;
      renderMatchResultSegmented();
      matchLineupSelectedIds = new Set();
      renderMatchLineupChips();
      matchReportStatus.textContent = "บันทึกผลการแข่งขันสำเร็จ ✓";
      matchReportStatus.className = "text-sm text-emerald-600";
    }
    await renderMatchReportList();
  } catch (err) {
    console.error(err);
    matchReportStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    matchReportStatus.className = "text-sm text-red-600";
  }
});

// ---------- รายงานอาการบาดเจ็บ ----------
let editingInjuryId = null;
let injurySelectedPlayerId = null;

// เฉพาะนักกีฬารุ่นอายุเดียวกับที่เลือกไว้ (ใช้ playerLabel() ที่นิยามไว้แล้วในส่วนรายงานผลการแข่งขัน)
function eligibleInjuryPlayers() {
  const ageGroup = injuryAgeGroupSelect.value;
  if (!ageGroup) return [];
  return players.filter((p) => p.ageGroup === ageGroup);
}

function selectInjuryPlayer(p) {
  injurySelectedPlayerId = p.id;
  injuryPlayerSearchInput.value = playerLabel(p);
  injuryPlayerDropdown.classList.add("hidden");
}

function renderInjuryPlayerDropdown(searchText) {
  const ageGroup = injuryAgeGroupSelect.value;
  if (!ageGroup) {
    injuryPlayerDropdown.innerHTML = '<p class="text-sm text-slate-400 px-3 py-2">กรุณาเลือกรุ่นอายุก่อน</p>';
    injuryPlayerDropdown.classList.remove("hidden");
    return;
  }
  const keyword = searchText.trim().toLowerCase();
  const candidates = eligibleInjuryPlayers().filter(
    (p) => !keyword || playerLabel(p).toLowerCase().includes(keyword) || (p.fullName ?? "").toLowerCase().includes(keyword)
  );
  if (candidates.length === 0) {
    injuryPlayerDropdown.innerHTML =
      `<p class="text-sm text-slate-400 px-3 py-2">${eligibleInjuryPlayers().length === 0 ? "ไม่มีนักกีฬารุ่นอายุนี้ในทีม" : "ไม่พบนักกีฬาที่ค้นหา"}</p>`;
    injuryPlayerDropdown.classList.remove("hidden");
    return;
  }
  injuryPlayerDropdown.innerHTML = "";
  for (const p of candidates) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = `${playerLabel(p)}${p.fullName ? ` (${p.fullName})` : ""}`;
    item.className = "block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
    // ใช้ mousedown แทน click เพื่อให้ทำงานก่อน blur ของช่องค้นหา ไม่งั้น dropdown จะถูกซ่อนก่อนคลิกติด
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectInjuryPlayer(p);
    });
    injuryPlayerDropdown.appendChild(item);
  }
  injuryPlayerDropdown.classList.remove("hidden");
}

injuryPlayerSearchInput.addEventListener("input", () => {
  injurySelectedPlayerId = null; // พิมพ์ใหม่ = ยกเลิกตัวที่เคยเลือกไว้ ต้องเลือกใหม่จาก dropdown
  renderInjuryPlayerDropdown(injuryPlayerSearchInput.value);
});
injuryPlayerSearchInput.addEventListener("focus", () => {
  renderInjuryPlayerDropdown(injuryPlayerSearchInput.value);
});
injuryPlayerSearchInput.addEventListener("blur", () => {
  injuryPlayerDropdown.classList.add("hidden");
});
injuryAgeGroupSelect.addEventListener("change", () => {
  // เปลี่ยนรุ่นอายุแล้ว นักกีฬาที่เคยเลือกไว้อาจไม่ใช่รุ่นเดียวกันอีกต่อไป จึงล้างค่าเดิม
  injurySelectedPlayerId = null;
  injuryPlayerSearchInput.value = "";
  injuryPlayerDropdown.classList.add("hidden");
});

function injurySeverityBadge(severity) {
  if (severity === "รุนแรง") return `<span class="badge badge-danger">${severity}</span>`;
  if (severity === "ปานกลาง") return `<span class="badge badge-warning">${severity}</span>`;
  return `<span class="badge badge-neutral">${severity ?? "-"}</span>`;
}

function injuryStatusBadge(status) {
  if (status === "หายแล้ว") return '<span class="badge badge-success">หายแล้ว</span>';
  if (status === "กำลังพักฟื้น") return '<span class="badge badge-warning">กำลังพักฟื้น</span>';
  if (status === "บาดเจ็บขณะแข่งขัน" || status === "บาดเจ็บขณะฝึกซ้อม") {
    return `<span class="badge badge-danger">${status}</span>`;
  }
  return `<span class="badge badge-neutral">${status ?? "-"}</span>`;
}

async function renderInjuryReportList() {
  injuryReportListBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const snap = await getDocs(query(collection(db, "injuryReports"), where("team", "==", myTeam)));
  const reports = [];
  snap.forEach((d) => reports.push({ id: d.id, ...d.data() }));
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (reports.length === 0) {
    injuryReportListBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ยังไม่มีรายการบาดเจ็บ</td></tr>';
    return;
  }

  injuryReportListBody.innerHTML = "";
  for (const inj of reports) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="emphasis">${inj.date ?? "-"}</td>
      <td>${inj.playerName ?? "-"}</td>
      <td>${inj.ageGroup ?? "-"}</td>
      <td>${inj.description ?? "-"}</td>
      <td>${injurySeverityBadge(inj.severity)}</td>
      <td>${injuryStatusBadge(inj.status)}</td>
      <td>${inj.expectedReturn ?? "-"}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.className = "space-x-2";
    const editBtn = document.createElement("button");
    editBtn.textContent = "แก้ไข";
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.addEventListener("click", () => startEditInjury(inj));
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "ลบ";
    deleteBtn.className = "btn btn-danger-soft btn-sm";
    deleteBtn.addEventListener("click", () => deleteInjuryReport(inj));
    actionTd.appendChild(editBtn);
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);
    injuryReportListBody.appendChild(tr);
  }
  applyDataLabels(injuryReportListBody);
}

function startEditInjury(inj) {
  editingInjuryId = inj.id;
  injuryAgeGroupSelect.value = inj.ageGroup ?? "";
  injurySelectedPlayerId = inj.playerId ?? null;
  injuryPlayerSearchInput.value = inj.playerName ?? "";
  document.getElementById("injury-date").value = inj.date ?? "";
  document.getElementById("injury-description").value = inj.description ?? "";
  document.getElementById("injury-severity").value = inj.severity ?? "เล็กน้อย";
  document.getElementById("injury-status").value = inj.status ?? "กำลังพักฟื้น";
  document.getElementById("injury-expected-return").value = inj.expectedReturn ?? "";
  document.getElementById("injury-notes").value = inj.notes ?? "";
  injuryReportSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditInjuryBtn.classList.remove("hidden");
  injuryReportStatus.textContent = `กำลังแก้ไขรายการบาดเจ็บของ "${inj.playerName}"`;
  injuryReportStatus.className = "text-sm text-slate-500";
  injuryReportForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEditInjury() {
  editingInjuryId = null;
  injuryReportForm.reset();
  injurySelectedPlayerId = null;
  injuryPlayerDropdown.classList.add("hidden");
  injuryReportSubmitBtn.textContent = "บันทึกอาการบาดเจ็บ";
  cancelEditInjuryBtn.classList.add("hidden");
}

cancelEditInjuryBtn.addEventListener("click", () => {
  stopEditInjury();
  injuryReportStatus.textContent = "";
});

async function deleteInjuryReport(inj) {
  const ok = confirm(`ยืนยันลบรายการบาดเจ็บของ "${inj.playerName}"? การลบนี้ไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "injuryReports", inj.id));
    if (editingInjuryId === inj.id) stopEditInjury();
    injuryReportStatus.textContent = "ลบรายการแล้ว";
    injuryReportStatus.className = "text-sm text-slate-500";
    await renderInjuryReportList();
  } catch (err) {
    console.error(err);
    injuryReportStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    injuryReportStatus.className = "text-sm text-red-600";
  }
}

injuryReportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!myTeam) {
    injuryReportStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    injuryReportStatus.className = "text-sm text-red-600";
    return;
  }
  if (!injuryAgeGroupSelect.value) {
    injuryReportStatus.textContent = "กรุณาเลือกรุ่นอายุ";
    injuryReportStatus.className = "text-sm text-red-600";
    return;
  }
  if (!injurySelectedPlayerId) {
    injuryReportStatus.textContent = "กรุณาเลือกนักกีฬาจากรายการค้นหา";
    injuryReportStatus.className = "text-sm text-red-600";
    return;
  }
  const ageGroup = injuryAgeGroupSelect.value;
  const player = players.find((p) => p.id === injurySelectedPlayerId);
  const playerName = player ? playerLabel(player) : injuryPlayerSearchInput.value.trim();
  const date = document.getElementById("injury-date").value;
  const description = document.getElementById("injury-description").value.trim();
  const severity = document.getElementById("injury-severity").value;
  const status = document.getElementById("injury-status").value;
  const expectedReturn = document.getElementById("injury-expected-return").value;
  const notes = document.getElementById("injury-notes").value.trim();

  const payload = {
    team: myTeam,
    playerId: injurySelectedPlayerId,
    playerName,
    ageGroup,
    date,
    description,
    severity,
    status,
    expectedReturn: expectedReturn || null,
    notes: notes || null,
    coachId: auth.currentUser.uid,
    coachName: myCoachName || auth.currentUser.email,
    updatedAt: serverTimestamp()
  };

  try {
    injuryReportStatus.textContent = "กำลังบันทึก...";
    injuryReportStatus.className = "text-sm text-slate-500";

    if (editingInjuryId) {
      await updateDoc(doc(db, "injuryReports", editingInjuryId), payload);
      injuryReportStatus.textContent = "บันทึกการแก้ไขสำเร็จ ✓";
      injuryReportStatus.className = "text-sm text-emerald-600";
      stopEditInjury();
    } else {
      await addDoc(collection(db, "injuryReports"), { ...payload, createdAt: serverTimestamp() });
      injuryReportForm.reset();
      injurySelectedPlayerId = null;
      injuryPlayerDropdown.classList.add("hidden");
      injuryReportStatus.textContent = "บันทึกอาการบาดเจ็บสำเร็จ ✓";
      injuryReportStatus.className = "text-sm text-emerald-600";
    }
    await renderInjuryReportList();
  } catch (err) {
    console.error(err);
    injuryReportStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    injuryReportStatus.className = "text-sm text-red-600";
  }
});

// ---------- แผนการฝึกซ้อมรายวัน ----------
// อ้างอิงรูปแบบจากตาราง "Training plan แผนรายวัน" ใน Airtable (Thawee SC Football 2026/2027)
const TRAINING_PLAN_AGE_GROUPS = ["U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];
const TRAINING_PLAN_PLAYER_GROUP_OPTIONS = ["A", "B", "ไม่ระบุ"];
const TRAINING_PLAN_TYPE_OPTIONS = ["Player", "Goalkeeper", "Circuit training"];
const TRAINING_PLAN_PHASE_OPTIONS = ["Learning Phase (ช่วงเรียนรู้)", "Competition Phase (ช่วงแข่งขัน)", "Rest"];
// หัวข้อหลักการฝึก (Main part) แยกตามช่วงอายุจริงเหมือนใน Airtable — ระบบนี้รองรับ U9-U18 เท่านั้น
// (ไม่มีรุ่น U6-U8 ในระบบ) จึงตัดชุดตัวเลือกของ U6-U8 ออก เหลือ 3 ช่วงอายุ
const TRAINING_PLAN_MAIN_PART_BY_BRACKET = {
  "U9-12": [
    "Passing",
    "Directional first touch",
    "Support",
    "Dribbling & Driving",
    "Pressing",
    "Covering & Marking",
    "Positioning (Width&Depth)",
    "Switching play",
    "Finishing"
  ],
  "U13-14": [
    "Structure & Switching play",
    "Build up vs Mid block",
    "Build up vs High pressing",
    "Playing between the line",
    "Zonal defense",
    "Pressing (Trap & Trigger)",
    "Forcing wide & Box defending",
    "Offensive transition",
    "Defensive transition",
    "Attacking movement & Final third"
  ],
  "U15-18": [
    "Structure & Switching play",
    "Pressing (Trap & Trigger & Intensity)",
    "Build up (Playing through high press)",
    "Mid block compactness & Shifting",
    "Defensive transition",
    "Offensive transition",
    "Adapting Build-up to Opponent's Shape",
    "Verticality & Direct Penetration",
    "Low block & Box defending",
    "Line breaking & Third man run",
    "Attacking in movement & Final third"
  ]
};
const TRAINING_PLAN_PHYSICAL_OPTIONS = [
  "Strength Endurance", "Explosive Strength", "Maximal Strength", "Core Strength",
  "Aerobic Capacity", "Aerobic Power", "Anaerobic Lactic", "Anaerobic Alactic",
  "Reaction", "Acceleration", "Maximal Speed", "Speed Endurance", "Acyclic Speed",
  "Flexibility & Mobility", "Coordination & Balance", "Agility", "Basic motor skill",
  "Perception & Awareness", "Rondo / IDP", "Active recovery", "Tension (strength)",
  "Duration (speed endurance)", "Velocity (max speed)", "Complexity", "Activation",
  "Match prepare", "Coordination & ball mastery", "Agility & Dribbling",
  "Speed & reaction", "Balance & basic skills", "Scrimmage / Game day"
];

let editingTrainingPlanId = null;
let trainingPlanAgeGroupsSelected = new Set();
let trainingPlanPlayerGroup = null;
let trainingPlanType = null;
let trainingPlanPhase = null;
let trainingPlanPhysicalSelected = new Set();

// รุ่นอายุที่เลือกอาจคาบเกี่ยวหลายช่วง (bracket) — ใช้ช่วงอายุของรุ่นที่เด็กที่สุดที่เลือกไว้เป็นตัวกำหนด
// ชุดตัวเลือก Main part ที่จะแสดง (ลดความซับซ้อนจาก Airtable ที่มีฟิลด์แยกต่อ bracket)
function bracketForAgeGroups(ageGroupsSet) {
  if (ageGroupsSet.size === 0) return null;
  const nums = Array.from(ageGroupsSet).map((g) => Number(g.replace("U", "")));
  const youngest = Math.min(...nums);
  if (youngest <= 12) return "U9-12";
  if (youngest <= 14) return "U13-14";
  return "U15-18";
}

function renderTrainingPlanAgeGroupToggle() {
  trainingPlanAgeGroupToggleWrap.innerHTML = "";
  trainingPlanAgeGroupToggleWrap.appendChild(
    createChipToggleGroup(TRAINING_PLAN_AGE_GROUPS, trainingPlanAgeGroupsSelected, (ageGroup) => {
      if (trainingPlanAgeGroupsSelected.has(ageGroup)) {
        trainingPlanAgeGroupsSelected.delete(ageGroup);
      } else {
        trainingPlanAgeGroupsSelected.add(ageGroup);
      }
      renderTrainingPlanAgeGroupToggle();
      renderTrainingPlanMainPartOptions();
    })
  );
}

// อัปเดตตัวเลือกในช่อง Main part ให้ตรงกับ bracket ของรุ่นอายุที่เลือกไว้ ถ้าเปลี่ยนรุ่นอายุจนตัวเลือกเดิม
// ไม่อยู่ในชุดใหม่แล้ว จะล้างค่าที่เลือกไว้ก่อนหน้าทิ้ง (กันไม่ให้ค่าที่บันทึกไม่ตรงกับรุ่นอายุจริง)
function renderTrainingPlanMainPartOptions() {
  const bracket = bracketForAgeGroups(trainingPlanAgeGroupsSelected);
  const currentValue = trainingPlanMainPartSelect.value;
  if (!bracket) {
    trainingPlanMainPartSelect.innerHTML = '<option value="">-- เลือกรุ่นอายุก่อน --</option>';
    trainingPlanMainPartSelect.disabled = true;
    return;
  }
  const options = TRAINING_PLAN_MAIN_PART_BY_BRACKET[bracket];
  trainingPlanMainPartSelect.disabled = false;
  trainingPlanMainPartSelect.innerHTML =
    `<option value="">-- เลือกหัวข้อหลัก (${bracket}) --</option>` +
    options.map((o) => `<option value="${o}">${o}</option>`).join("");
  if (options.includes(currentValue)) {
    trainingPlanMainPartSelect.value = currentValue;
  }
}

function renderTrainingPlanPhysicalToggle() {
  trainingPlanPhysicalToggleWrap.innerHTML = "";
  trainingPlanPhysicalToggleWrap.appendChild(
    createChipToggleGroup(TRAINING_PLAN_PHYSICAL_OPTIONS, trainingPlanPhysicalSelected, (opt) => {
      if (trainingPlanPhysicalSelected.has(opt)) {
        trainingPlanPhysicalSelected.delete(opt);
      } else {
        trainingPlanPhysicalSelected.add(opt);
      }
      renderTrainingPlanPhysicalToggle();
    })
  );
}

function renderTrainingPlanPlayerGroupSegmented() {
  trainingPlanPlayerGroupSegmentedWrap.innerHTML = "";
  trainingPlanPlayerGroupSegmentedWrap.appendChild(
    createSegmentedGroup(TRAINING_PLAN_PLAYER_GROUP_OPTIONS, trainingPlanPlayerGroup, (val) => {
      trainingPlanPlayerGroup = val;
      renderTrainingPlanPlayerGroupSegmented();
    })
  );
}

function renderTrainingPlanTypeSegmented() {
  trainingPlanTypeSegmentedWrap.innerHTML = "";
  trainingPlanTypeSegmentedWrap.appendChild(
    createSegmentedGroup(TRAINING_PLAN_TYPE_OPTIONS, trainingPlanType, (val) => {
      trainingPlanType = val;
      renderTrainingPlanTypeSegmented();
    })
  );
}

// แสดงช่อง "หัวข้อ (สำหรับช่วงแข่งขัน)" เฉพาะตอนเลือก Phase เป็นช่วงแข่งขันเท่านั้น
function updateTrainingPlanCompetitionTopicVisibility() {
  trainingPlanCompetitionTopicWrap.classList.toggle("hidden", trainingPlanPhase !== "Competition Phase (ช่วงแข่งขัน)");
}

function renderTrainingPlanPhaseSegmented() {
  trainingPlanPhaseSegmentedWrap.innerHTML = "";
  trainingPlanPhaseSegmentedWrap.appendChild(
    createSegmentedGroup(TRAINING_PLAN_PHASE_OPTIONS, trainingPlanPhase, (val) => {
      trainingPlanPhase = val;
      renderTrainingPlanPhaseSegmented();
      updateTrainingPlanCompetitionTopicVisibility();
    })
  );
  updateTrainingPlanCompetitionTopicVisibility();
}

function stopEditTrainingPlan() {
  editingTrainingPlanId = null;
  trainingPlanForm.reset();
  trainingPlanAgeGroupsSelected = new Set();
  trainingPlanPlayerGroup = null;
  trainingPlanType = null;
  trainingPlanPhase = null;
  trainingPlanPhysicalSelected = new Set();
  renderTrainingPlanAgeGroupToggle();
  renderTrainingPlanMainPartOptions();
  renderTrainingPlanPhysicalToggle();
  renderTrainingPlanPlayerGroupSegmented();
  renderTrainingPlanTypeSegmented();
  renderTrainingPlanPhaseSegmented();
  trainingPlanSubmitBtn.textContent = "ส่งแผนการฝึกซ้อม";
  cancelEditTrainingPlanBtn.classList.add("hidden");
}

cancelEditTrainingPlanBtn.addEventListener("click", () => {
  stopEditTrainingPlan();
  trainingPlanStatus.textContent = "";
});

function startEditTrainingPlan(plan) {
  editingTrainingPlanId = plan.id;
  trainingPlanDateInput.value = plan.date ?? "";
  trainingPlanAgeGroupsSelected = new Set(plan.ageGroups || []);
  trainingPlanPlayerGroup = plan.playerGroup ?? null;
  trainingPlanType = plan.trainingType ?? null;
  trainingPlanPhase = plan.phase ?? null;
  trainingPlanPhysicalSelected = new Set(plan.physicalFocus || []);
  trainingPlanCompetitionTopicInput.value = plan.competitionTopic ?? "";
  trainingPlanNotesInput.value = plan.notes ?? "";
  renderTrainingPlanAgeGroupToggle();
  renderTrainingPlanMainPartOptions();
  trainingPlanMainPartSelect.value = plan.mainPart ?? "";
  renderTrainingPlanPhysicalToggle();
  renderTrainingPlanPlayerGroupSegmented();
  renderTrainingPlanTypeSegmented();
  renderTrainingPlanPhaseSegmented();
  trainingPlanSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditTrainingPlanBtn.classList.remove("hidden");
  trainingPlanStatus.textContent = `กำลังแก้ไขแผนการฝึกซ้อมวันที่ ${plan.date}`;
  trainingPlanStatus.className = "text-sm text-slate-500";
  trainingPlanForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteTrainingPlan(plan) {
  const ok = confirm(`ยืนยันลบแผนการฝึกซ้อมวันที่ ${plan.date}? การลบนี้ไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "trainingPlans", plan.id));
    if (editingTrainingPlanId === plan.id) stopEditTrainingPlan();
    trainingPlanStatus.textContent = "ลบแผนการฝึกซ้อมแล้ว";
    trainingPlanStatus.className = "text-sm text-slate-500";
    await renderTrainingPlanList();
  } catch (err) {
    console.error(err);
    trainingPlanStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    trainingPlanStatus.className = "text-sm text-red-600";
  }
}

// สถานะการส่ง เทียบวันที่บันทึกล่าสุดกับวันที่ของแผน (แบบเดียวกับสูตรใน Airtable) — ส่งภายในหรือก่อนวันที่
// ของแผนถือว่า "ตรงเวลา" ถ้าส่ง/แก้ไขหลังวันที่ของแผนไปแล้วถือว่า "เลท"
function trainingPlanSubmissionStatus(plan) {
  if (!plan.updatedAt || !plan.date) return "-";
  return isTrainingPlanLate(plan)
    ? '<span class="badge badge-warning">⏱ เลท</span>'
    : '<span class="badge badge-success">✅ ตรงเวลา</span>';
}

// นับจำนวนครั้งที่ส่งสายในเดือนปัจจุบัน (ตามวันที่ในแผน ไม่ใช่วันที่ส่งจริง) ใช้เตือนโค้ชเมื่อเกินเกณฑ์
function countLateTrainingPlansThisMonth(plans) {
  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  return plans.filter((p) => (p.date || "").startsWith(thisMonth) && isTrainingPlanLate(p)).length;
}

async function renderTrainingPlanList() {
  trainingPlanListBody.innerHTML =
    '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const snap = await getDocs(query(collection(db, "trainingPlans"), where("team", "==", myTeam)));
  const plans = [];
  snap.forEach((d) => plans.push({ id: d.id, ...d.data() }));
  plans.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // แจ้งเตือนถ้าเดือนนี้ส่งสายเกินเกณฑ์ (นับรวมทั้งทีม เพราะผู้ดูแลระบบที่สวมบทบาทจัดการทีมแทนโค้ชก็ควร
  // เห็นสถิติเดียวกับที่โค้ชจริงเห็น)
  const lateCountThisMonth = countLateTrainingPlansThisMonth(plans);
  trainingPlanLateWarning.classList.toggle("hidden", lateCountThisMonth <= TRAINING_PLAN_LATE_WARNING_THRESHOLD);
  trainingPlanLateCountEl.textContent = lateCountThisMonth;

  if (plans.length === 0) {
    trainingPlanListBody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400">ยังไม่มีแผนการฝึกซ้อม</td></tr>';
    return;
  }

  trainingPlanListBody.innerHTML = "";
  for (const plan of plans) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="emphasis">${plan.date ?? "-"}</td>
      <td>${(plan.ageGroups || []).join(", ") || "-"}</td>
      <td>${plan.trainingType ?? "-"}</td>
      <td>${plan.phase ?? "-"}</td>
      <td>${plan.mainPart ?? "-"}</td>
      <td>${(plan.physicalFocus || []).join(", ") || "-"}</td>
      <td>${trainingPlanSubmissionStatus(plan)}</td>
    `;
    const actionTd = document.createElement("td");
    actionTd.className = "space-x-2";
    const editBtn = document.createElement("button");
    editBtn.textContent = "แก้ไข";
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.addEventListener("click", () => startEditTrainingPlan(plan));
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "ลบ";
    deleteBtn.className = "btn btn-danger-soft btn-sm";
    deleteBtn.addEventListener("click", () => deleteTrainingPlan(plan));
    actionTd.appendChild(editBtn);
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);
    trainingPlanListBody.appendChild(tr);
  }
  applyDataLabels(trainingPlanListBody);
}

function openTrainingPlanSection() {
  hideAllScreens();
  trainingPlanSection.classList.remove("hidden");
  stopEditTrainingPlan();
  trainingPlanDateInput.value = new Date().toISOString().slice(0, 10);
  renderTrainingPlanList();
}

trainingPlanForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!myTeam) {
    trainingPlanStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    trainingPlanStatus.className = "text-sm text-red-600";
    return;
  }
  const dateStr = trainingPlanDateInput.value;
  if (!dateStr) {
    trainingPlanStatus.textContent = "กรุณาเลือกวันที่";
    trainingPlanStatus.className = "text-sm text-red-600";
    return;
  }
  if (trainingPlanAgeGroupsSelected.size === 0) {
    trainingPlanStatus.textContent = "กรุณาเลือกรุ่นอายุอย่างน้อย 1 รุ่น";
    trainingPlanStatus.className = "text-sm text-red-600";
    return;
  }
  if (!trainingPlanType) {
    trainingPlanStatus.textContent = "กรุณาเลือกประเภทการฝึก";
    trainingPlanStatus.className = "text-sm text-red-600";
    return;
  }
  if (!trainingPlanPhase) {
    trainingPlanStatus.textContent = "กรุณาเลือก Phase (ช่วงการซ้อม)";
    trainingPlanStatus.className = "text-sm text-red-600";
    return;
  }

  const payload = {
    team: myTeam,
    date: dateStr,
    ageGroups: Array.from(trainingPlanAgeGroupsSelected),
    playerGroup: trainingPlanPlayerGroup && trainingPlanPlayerGroup !== "ไม่ระบุ" ? trainingPlanPlayerGroup : null,
    trainingType: trainingPlanType,
    phase: trainingPlanPhase,
    competitionTopic:
      trainingPlanPhase === "Competition Phase (ช่วงแข่งขัน)" ? trainingPlanCompetitionTopicInput.value.trim() || null : null,
    mainPart: trainingPlanMainPartSelect.value || null,
    physicalFocus: Array.from(trainingPlanPhysicalSelected),
    notes: trainingPlanNotesInput.value.trim() || null,
    coachId: auth.currentUser.uid,
    coachName: myCoachName || auth.currentUser.email,
    updatedAt: serverTimestamp()
  };

  try {
    trainingPlanStatus.textContent = "กำลังบันทึก...";
    trainingPlanStatus.className = "text-sm text-slate-500";

    if (editingTrainingPlanId) {
      await updateDoc(doc(db, "trainingPlans", editingTrainingPlanId), payload);
      trainingPlanStatus.textContent = "บันทึกการแก้ไขสำเร็จ ✓";
      trainingPlanStatus.className = "text-sm text-emerald-600";
      stopEditTrainingPlan();
    } else {
      await addDoc(collection(db, "trainingPlans"), { ...payload, createdAt: serverTimestamp() });
      stopEditTrainingPlan();
      trainingPlanDateInput.value = dateStr;
      trainingPlanStatus.textContent = "ส่งแผนการฝึกซ้อมสำเร็จ ✓";
      trainingPlanStatus.className = "text-sm text-emerald-600";
    }
    await renderTrainingPlanList();
  } catch (err) {
    console.error(err);
    trainingPlanStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    trainingPlanStatus.className = "text-sm text-red-600";
  }
});

// ---------- สรุปประจำวัน (Daily) ----------
function formatThaiDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatReportPeriodForDaily(r) {
  if (!r.periodType) return "-";
  const labels = { morning: "ซ้อมเช้า", evening: "ซ้อมเย็น" };
  const label = r.periodType === "other" ? r.periodOtherText || "อื่นๆ" : labels[r.periodType] || r.periodType;
  const timeRange = r.periodStartTime && r.periodEndTime ? `${r.periodStartTime} - ${r.periodEndTime} น.` : "";
  return timeRange ? `${label} (${timeRange})` : label;
}

function renderDailyAttendance(snap) {
  const records = [];
  snap.forEach((d) => records.push(d.data()));
  if (records.length === 0) {
    dailyAttendanceBody.innerHTML =
      '<tr><td colspan="3" class="px-4 py-6 text-center text-slate-400">ยังไม่มีการเช็คชื่อในวันนี้</td></tr>';
    return;
  }
  const playerMap = new Map(players.map((p) => [p.id, p]));
  dailyAttendanceBody.innerHTML = records
    .map((r) => {
      const p = playerMap.get(r.playerId);
      const name = p ? p.nickname ?? p.fullName ?? "-" : "-";
      const avg = computeAvgScore(r.scores);
      return `
        <tr>
          <td class="emphasis">${name}</td>
          <td>${r.status ?? "-"}</td>
          <td>${avg !== null ? avg.toFixed(2) : "-"}</td>
        </tr>`;
    })
    .join("");
  applyDataLabels(dailyAttendanceBody);
}

function renderDailyTrainingReport(snap) {
  if (snap.empty) {
    dailyTrainingReportCard.innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีรายงานการฝึกซ้อมในวันนี้</p>';
    return;
  }
  const r = snap.docs[0].data();
  const attendedText =
    r.attended === true
      ? '<span class="badge badge-success">มีการซ้อม</span>'
      : r.attended === false
        ? '<span class="badge badge-warning">ไม่มีการซ้อม</span>'
        : "-";
  dailyTrainingReportCard.innerHTML = `
    <div class="space-y-2">
      <p><span class="text-slate-400">สถานะ:</span> ${attendedText}</p>
      <p><span class="text-slate-400">ช่วงเวลา:</span> ${formatReportPeriodForDaily(r)}</p>
      <p><span class="text-slate-400">หมายเหตุ:</span> ${r.notes ?? "-"}</p>
    </div>
  `;
}

function renderDailyTrainingPlan(snap) {
  if (snap.empty) {
    dailyTrainingPlanCard.innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีการส่งแผนการฝึกซ้อมในวันนี้</p>';
    return;
  }
  const p = snap.docs[0].data();
  dailyTrainingPlanCard.innerHTML = `
    <div class="space-y-2">
      <p><span class="text-slate-400">รุ่นอายุ:</span> ${(p.ageGroups || []).join(", ") || "-"}</p>
      <p><span class="text-slate-400">กรุ้ปผู้เล่น:</span> ${p.playerGroup ?? "-"}</p>
      <p><span class="text-slate-400">ประเภทการฝึก:</span> ${p.trainingType ?? "-"}</p>
      <p><span class="text-slate-400">Phase:</span> ${p.phase ?? "-"}</p>
      <p><span class="text-slate-400">หัวข้อหลัก (Main part):</span> ${p.mainPart ?? "-"}</p>
      <p><span class="text-slate-400">Physical:</span> ${(p.physicalFocus || []).join(", ") || "-"}</p>
      <p><span class="text-slate-400">สถานะการส่ง:</span> ${trainingPlanSubmissionStatus(p)}</p>
    </div>
  `;
}

function renderDailyMatchReports(snap) {
  if (snap.empty) {
    dailyMatchBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ไม่มีการแข่งขันในวันนี้</td></tr>';
    return;
  }
  const reports = [];
  snap.forEach((d) => reports.push(d.data()));
  dailyMatchBody.innerHTML = reports
    .map(
      (m) => `
      <tr>
        <td class="emphasis">${m.opponent ?? "-"}</td>
        <td>${m.competitionType ?? "-"}</td>
        <td>${m.ageGroup ?? "-"}</td>
        <td>${matchResultBadge(m.result)}</td>
        <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
        <td>${m.competition ?? "-"}</td>
      </tr>`
    )
    .join("");
  applyDataLabels(dailyMatchBody);
}

function renderDailyInjuryReports(snap) {
  if (snap.empty) {
    dailyInjuryBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ไม่มีรายงานอาการบาดเจ็บในวันนี้</td></tr>';
    return;
  }
  const reports = [];
  snap.forEach((d) => reports.push(d.data()));
  dailyInjuryBody.innerHTML = reports
    .map(
      (inj) => `
      <tr>
        <td class="emphasis">${inj.playerName ?? "-"}</td>
        <td>${inj.ageGroup ?? "-"}</td>
        <td>${inj.description ?? "-"}</td>
        <td>${injurySeverityBadge(inj.severity)}</td>
        <td>${injuryStatusBadge(inj.status)}</td>
      </tr>`
    )
    .join("");
  applyDataLabels(dailyInjuryBody);
}

async function loadDailyData(dateStr) {
  if (!myTeam) {
    dailyStatus.textContent = "ยังไม่ทราบทีมที่รับผิดชอบ";
    dailyStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  dailyStatus.textContent = "กำลังโหลดข้อมูล...";
  dailyStatus.className = "text-sm text-slate-500 w-full";
  dailyDateHeading.textContent = `📅 ${formatThaiDate(dateStr)}`;
  dailyDateHeading.classList.remove("hidden");

  try {
    const [attendanceSnap, trainingSnap, trainingPlanSnap, matchSnap, injurySnap] = await Promise.all([
      getDocs(query(collection(db, "attendance"), where("team", "==", myTeam), where("date", "==", dateStr))),
      getDocs(query(collection(db, "trainingReports"), where("team", "==", myTeam), where("date", "==", dateStr))),
      getDocs(query(collection(db, "trainingPlans"), where("team", "==", myTeam), where("date", "==", dateStr))),
      getDocs(query(collection(db, "matchReports"), where("team", "==", myTeam), where("date", "==", dateStr))),
      getDocs(query(collection(db, "injuryReports"), where("team", "==", myTeam), where("date", "==", dateStr)))
    ]);

    renderDailyAttendance(attendanceSnap);
    renderDailyTrainingReport(trainingSnap);
    renderDailyTrainingPlan(trainingPlanSnap);
    renderDailyMatchReports(matchSnap);
    renderDailyInjuryReports(injurySnap);

    dailyStatus.textContent = "โหลดข้อมูลสำเร็จ ✓";
    dailyStatus.className = "text-sm text-emerald-600 w-full";
  } catch (err) {
    console.error(err);
    dailyStatus.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
    dailyStatus.className = "text-sm text-red-600 w-full";
  }
}
