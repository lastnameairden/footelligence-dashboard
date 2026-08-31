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
  signOut,
  sendPasswordResetEmail,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, auth, storage } from "./firebase-init.js";
import {
  applyDataLabels,
  SCORE_CATEGORIES,
  computeAvgScore,
  isPlayerFullyEvaluated,
  teamLogoImg,
  isTrainingPlanLate,
  TRAINING_PLAN_LATE_WARNING_THRESHOLD,
  submissionDeadlineFor,
  isCoachSubmissionOnTime,
  isReportLate,
  statCard,
  matchResultBadge,
  injurySeverityBadge,
  injuryStatusBadge,
  loadAdminNotifications,
  renderAdminNotifications,
  markNotificationRead,
  getCoachPlayerIds,
  ageGroupSortKey,
  ageGroupNumber,
  calcAge,
  COACH_POSITIONS,
  coachPositionLabel,
  coachPositionAllowsMultipleAgeGroups,
  sendExecutiveNote
} from "./ui-utils.js";
import { categoryRawScore } from "./masc-data.js";

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
const trainingPlanFileInput = document.getElementById("training-plan-file-input");
const trainingPlanFileStatus = document.getElementById("training-plan-file-status");
const trainingPlanLateWarning = document.getElementById("training-plan-late-warning");
const trainingPlanLateCountEl = document.getElementById("training-plan-late-count");
const dailySection = document.getElementById("daily-section");
const dailyDateInput = document.getElementById("daily-date-input");
const dailyLoadBtn = document.getElementById("daily-load-btn");
const dailyStatus = document.getElementById("daily-status");
const dailyDateHeading = document.getElementById("daily-date-heading");
const dailyReminderBanner = document.getElementById("daily-reminder-banner");
const dailyExecutiveNotesList = document.getElementById("daily-executive-notes-list");
const dailyAttendanceBody = document.getElementById("daily-attendance-body");
const dailyAttendancePagination = document.getElementById("daily-attendance-pagination");
const dailyTrainingReportCard = document.getElementById("daily-training-report-card");
const dailyTrainingPlanCard = document.getElementById("daily-training-plan-card");
const dailyMatchBody = document.getElementById("daily-match-body");
const dailyInjuryBody = document.getElementById("daily-injury-body");
const reportDateInput = document.getElementById("report-date");
const reportLoadBtn = document.getElementById("report-load-btn");
const reportLoadStatus = document.getElementById("report-load-status");
const reportSummary = document.getElementById("report-summary");
const reportSummaryText = document.getElementById("report-summary-text");
const reportSummaryDetails = document.getElementById("report-summary-details");
const reportSummaryPhotos = document.getElementById("report-summary-photos");
const reportEditBtn = document.getElementById("report-edit-btn");
const reportForm = document.getElementById("report-form");
const reportPeriodSection = document.getElementById("report-period-section");
const reportPeriodSegmentedWrap = document.getElementById("report-period-segmented");
const reportPeriodDetailWrap = document.getElementById("report-period-detail-wrap");
const reportAttendSegmentedWrap = document.getElementById("report-attend-segmented");
const reportNotesInput = document.getElementById("report-notes");
const reportPhotoWrap = document.getElementById("report-photo-wrap");
const reportPhotoInput = document.getElementById("report-photo-input");
const reportPhotoPreview = document.getElementById("report-photo-preview");
const reportSubmitBtn = document.getElementById("report-submit-btn");
const reportStatus = document.getElementById("report-status");
const backButtons = document.querySelectorAll("[data-back]");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const forgotPasswordLink = document.getElementById("forgot-password-link");
const forgotPasswordStatus = document.getElementById("forgot-password-status");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const registerForm = document.getElementById("register-form");
const registerError = document.getElementById("register-error");
const registerAgeGroupWrap = document.getElementById("register-age-group-wrap");
const registerCoachPositionSelect = document.getElementById("register-coach-position");
const registerAgeGroupCheckboxes = document.querySelectorAll(".register-age-group-checkbox");
const registerAgeGroupHint = document.getElementById("register-age-group-hint");
const pendingSection = document.getElementById("pending-section");
const pendingLogoutBtn = document.getElementById("pending-logout-btn");
const executiveSection = document.getElementById("executive-section");
const executiveDashboardLink = document.getElementById("executive-dashboard-link");
const executiveStatusEl = document.getElementById("executive-status");
const executiveStatCards = document.getElementById("executive-stat-cards");
const executiveLateWarning = document.getElementById("executive-late-warning");
const executiveLateCountEl = document.getElementById("executive-late-count");
const executiveLateDetailEl = document.getElementById("executive-late-detail");
const executiveCoachSummary = document.getElementById("executive-coach-summary");
const coachPlanDetailOverlay = document.getElementById("coach-plan-detail-overlay");
const coachPlanDetailTitleEl = document.getElementById("coach-plan-detail-title");
const coachPlanDetailBody = document.getElementById("coach-plan-detail-body");
const coachPlanDetailCloseBtn = document.getElementById("coach-plan-detail-close-btn");
const executiveNotesList = document.getElementById("executive-notes-list");
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
const adminPlayerAuditSection = document.getElementById("admin-player-audit-section");
const playerAuditStatus = document.getElementById("player-audit-status");
const playerAuditBody = document.getElementById("player-audit-body");
const adminBackButtons = document.querySelectorAll("[data-admin-back]");
const pendingApprovalsBody = document.getElementById("pending-approvals-body");
const adminTeamSelect = document.getElementById("admin-team-select");
const adminSelectTeamBtn = document.getElementById("admin-select-team-btn");
const adminSelectTeamExecutiveBtn = document.getElementById("admin-select-team-executive-btn");
const adminDashboardTeamSelect = document.getElementById("admin-dashboard-team-select");
const adminViewDashboardBtn = document.getElementById("admin-view-dashboard-btn");
const adminPrintTeamSelect = document.getElementById("admin-print-team-select");
const adminPrintAgeGroupSelect = document.getElementById("admin-print-age-group-select");
const adminPrintMonthSelect = document.getElementById("admin-print-month-select");
const adminGeneratePrintBtn = document.getElementById("admin-generate-print-btn");
const adminReportCardSection = document.getElementById("admin-report-card-section");
const adminReportCardTeamSelect = document.getElementById("admin-report-card-team-select");
const adminReportCardAgeGroupSelect = document.getElementById("admin-report-card-age-group-select");
const adminReportCardStartSelect = document.getElementById("admin-report-card-start-select");
const adminReportCardEndSelect = document.getElementById("admin-report-card-end-select");
const adminGenerateReportCardBtn = document.getElementById("admin-generate-report-card-btn");
const adminReportCardStatus = document.getElementById("admin-report-card-status");
const adminMascRoundsSection = document.getElementById("admin-masc-rounds-section");
const adminMascRoundPeriodSelect = document.getElementById("admin-masc-round-period-select");
const adminMascRoundStartInput = document.getElementById("admin-masc-round-start-input");
const adminMascRoundEndInput = document.getElementById("admin-masc-round-end-input");
const adminMascRoundStartBtn = document.getElementById("admin-masc-round-start-btn");
const adminMascRoundStatus = document.getElementById("admin-masc-round-status");
const adminMascRoundListBody = document.getElementById("admin-masc-round-list-body");
const adminMascRoundCreateCard = document.getElementById("admin-masc-round-create-card");
const adminMascRoundCorrectionNote = document.getElementById("admin-masc-round-correction-note");
const adminMascRoundCorrectionLabel = document.getElementById("admin-masc-round-correction-label");
const adminMascRoundCorrectionSummary = document.getElementById("admin-masc-round-correction-summary");
const adminMascRoundCorrectionCancelBtn = document.getElementById("admin-masc-round-correction-cancel");
const mascProgressRoundSelect = document.getElementById("masc-progress-round-select");
const mascProgressTeamTabs = document.getElementById("masc-progress-team-tabs");
const mascProgressBody = document.getElementById("masc-progress-body");
const adminPrintStatus = document.getElementById("admin-print-status");
const adminStatus = document.getElementById("admin-status");
const hamburgerBtn = document.getElementById("hamburger-btn");
const notificationBellBtn = document.getElementById("notification-bell-btn");
const notificationBadge = document.getElementById("notification-badge");
const notificationPanel = document.getElementById("notification-panel");
const notificationList = document.getElementById("notification-list");
const notificationRefreshBtn = document.getElementById("notification-refresh-btn");
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
const viewSessionBtn = document.getElementById("view-session-btn");
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
const playerPhotoInput = document.getElementById("player-photo-input");
const playerPhotoStatus = document.getElementById("player-photo-status");
const playerListBody = document.getElementById("player-list-body");
const coachDirectoryGroups = document.getElementById("coach-directory-groups");
const editCoachOverlay = document.getElementById("edit-coach-overlay");
const editCoachCloseBtn = document.getElementById("edit-coach-close-btn");
const editCoachNameInput = document.getElementById("edit-coach-name");
const editCoachEmailInput = document.getElementById("edit-coach-email");
const editCoachRoleSelect = document.getElementById("edit-coach-role");
const editCoachTeamWrap = document.getElementById("edit-coach-team-wrap");
const editCoachTeamSelect = document.getElementById("edit-coach-team");
const editCoachAgeGroupWrap = document.getElementById("edit-coach-age-group-wrap");
const editCoachPositionSelect = document.getElementById("edit-coach-position");
const editCoachAgeGroupCheckboxes = document.querySelectorAll(".edit-coach-age-group-checkbox");
const editCoachStatusSelect = document.getElementById("edit-coach-status");
const editCoachModalStatus = document.getElementById("edit-coach-modal-status");
const editCoachSaveBtn = document.getElementById("edit-coach-save-btn");
const editCoachResetPasswordBtn = document.getElementById("edit-coach-reset-password-btn");
const editCoachDeleteBtn = document.getElementById("edit-coach-delete-btn");
const editCoachCancelBtn = document.getElementById("edit-coach-cancel-btn");
const progressDateInput = document.getElementById("progress-date-input");
const progressRefreshBtn = document.getElementById("progress-refresh-btn");
const progressTableBody = document.getElementById("progress-table-body");
const progressPie = document.getElementById("progress-pie");
const progressLegend = document.getElementById("progress-legend");
const progressTeamTabs = document.getElementById("progress-team-tabs");

let currentSessionId = null;
let currentSessionData = null;
let currentAttendanceMap = new Map();
let myTeam = null;
// ชื่อ/อีเมลของบัญชีผู้ดูแลระบบเอง เก็บไว้ตอนล็อกอิน เพื่อใช้คืนค่ากลับตอนออกจากโหมดสวมบทบาท (โค้ช/ผู้บริหารทีม)
// เพราะระหว่างสวมบทบาทจะเขียนทับ coachNameEl/coachEmailEl ด้วยข้อมูลของโค้ช/ผู้บริหารทีมที่สวมบทบาทอยู่
let adminOwnName = null;
let adminOwnEmail = null;
let myCoachName = null;
// รุ่นอายุที่โค้ชคนนี้รับผิดชอบ (array — Head Coach ปกติมี 1 รุ่น, GK Coach มีได้หลายรุ่น) ใช้จำกัด/ล็อก
// ช่องเลือกรุ่นอายุตอนเพิ่มนักกีฬา (ดู applyAgeGroupLock)
let myAgeGroups = [];
// ตำแหน่งโค้ชคนนี้ (head_coach/assistant_coach/gk_coach/fitness_coach) ใช้กรองรายชื่อนักกีฬาใน loadPlayers():
// GK Coach เห็นเฉพาะผู้เล่นตำแหน่ง GK ส่วน Head Coach/Assistant Coach ไม่เห็นผู้เล่นตำแหน่ง GK เลย (กันไม่ให้
// ต้องเช็คชื่อ/ให้คะแนนซ้ำซ้อนกัน เพราะ GK Coach ดูแลผู้รักษาประตูแยกต่างหากอยู่แล้ว)
let myCoachPosition = null;
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

const MAX_PLAYER_PHOTO_SIZE = 5 * 1024 * 1024; // ต้องตรงกับ storage.rules
// รูปนักกีฬาของแถวที่กำลังแก้ไขอยู่ (ถ้ามี) — เก็บแยกจาก input[type=file] เพราะเลือกรูปใหม่แล้วยังต้องรู้ว่า
// ของเดิมคืออะไร (โชว์รูปเดิมไว้จนกว่าจะอัปโหลดรูปใหม่ทับหรือกดลบ) เหมือนแพทเทิร์นไฟล์แนบแผนการฝึกซ้อม
let playerExistingPhotoUrl = null;
let playerExistingPhotoPath = null;
let playerRemoveExistingPhoto = false;

// อัปโหลดรูปนักกีฬาขึ้น Storage แล้วคืน {url, path} — path ใช้ team+timestamp กันชื่อไฟล์ชนกัน ไม่ใช้ playerId
// เพราะตอนเพิ่มนักกีฬาใหม่ยังไม่มี id จนกว่าจะบันทึกเอกสารสำเร็จ (เหมือนแพทเทิร์น uploadTrainingPlanFile)
async function uploadPlayerPhoto(file, team) {
  const safeName = file.name.replace(/[^\w.\-ก-๙]/g, "_");
  const filePath = `players/${team}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, path: filePath };
}

// แสดงสถานะรูปนักกีฬาปัจจุบันใต้ช่องเลือกไฟล์ — ของเดิม (ถ้ามีและยังไม่ถูกลบ) จะมีรูปตัวอย่าง + ปุ่ม "ลบรูป"
// เลือกรูปใหม่แล้วจะถือว่าใช้รูปใหม่แทนตอนบันทึก โดยไม่ต้องกดลบของเดิมก่อน
function renderPlayerPhotoStatus() {
  playerPhotoStatus.innerHTML = "";
  if (playerPhotoInput.files[0]) {
    playerPhotoStatus.textContent = `เลือกรูปใหม่: ${playerPhotoInput.files[0].name}`;
    return;
  }
  if (playerExistingPhotoUrl && !playerRemoveExistingPhoto) {
    const wrap = document.createElement("div");
    wrap.className = "flex items-center gap-2";
    const img = document.createElement("img");
    img.src = playerExistingPhotoUrl;
    img.alt = "รูปนักกีฬา";
    img.className = "w-12 h-12 object-cover rounded-full border border-slate-200";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost-danger btn-sm";
    removeBtn.textContent = "ลบรูป";
    removeBtn.addEventListener("click", () => {
      playerRemoveExistingPhoto = true;
      renderPlayerPhotoStatus();
    });
    wrap.append(img, removeBtn);
    playerPhotoStatus.appendChild(wrap);
    return;
  }
  playerPhotoStatus.textContent = playerExistingPhotoUrl ? "รูปเดิมจะถูกลบเมื่อบันทึก" : "ยังไม่มีรูป";
}

playerPhotoInput.addEventListener("change", () => {
  playerRemoveExistingPhoto = false;
  renderPlayerPhotoStatus();
});

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

// ---------- ลืมรหัสผ่าน (โค้ชกดเองจากหน้าเข้าสู่ระบบ) ----------
// ใช้ระบบส่งลิงก์รีเซ็ตรหัสผ่านทางอีเมลของ Firebase Auth เอง (ปลอดภัยกว่าให้ผู้ดูแลระบบตั้งรหัสผ่านแทน
// เพราะไม่มีใครนอกจากเจ้าของอีเมลนั้นเห็นรหัสผ่านใหม่เลย) ใช้อีเมลจากช่องกรอกด้านบนของฟอร์มเข้าสู่ระบบ
forgotPasswordLink.addEventListener("click", async () => {
  const email = document.getElementById("login-identifier").value.trim();
  forgotPasswordStatus.textContent = "";
  if (!email) {
    forgotPasswordStatus.textContent = 'กรุณากรอกอีเมลในช่องด้านบนก่อน แล้วกด "ลืมรหัสผ่าน?" อีกครั้ง';
    forgotPasswordStatus.className = "text-sm text-red-600";
    return;
  }
  try {
    forgotPasswordStatus.textContent = "กำลังส่งอีเมล...";
    forgotPasswordStatus.className = "text-sm text-slate-500";
    await sendPasswordResetEmail(auth, email);
    forgotPasswordStatus.textContent = `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} แล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงถังขยะ/สแปม)`;
    forgotPasswordStatus.className = "text-sm text-emerald-600";
  } catch (err) {
    forgotPasswordStatus.textContent = "ส่งอีเมลไม่สำเร็จ: " + (err.code ? authErrorMessage(err) : err.message);
    forgotPasswordStatus.className = "text-sm text-red-600";
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

// Head Coach ดูแลได้รุ่นเดียวเท่านั้น (บังคับแบบ radio ผ่านกลุ่ม checkbox) ส่วน GK Coach เลือกได้หลายรุ่น
// เพราะดูแลนักกีฬาตำแหน่งผู้รักษาประตูของหลายรุ่นอายุพร้อมกันในทีมเดียว
function enforceRegisterAgeGroupLimit() {
  const position = registerCoachPositionSelect.value;
  const allowsMultiple = coachPositionAllowsMultipleAgeGroups(position);
  const label = coachPositionLabel(position);
  registerAgeGroupHint.textContent = allowsMultiple
    ? `${label} เลือกได้หลายรุ่นอายุ (ดูแลนักกีฬาของหลายรุ่นในทีมเดียวกันได้)`
    : `${label} ดูแลได้เพียงรุ่นอายุเดียว — เลือกรุ่นอายุที่รับผิดชอบ (ถ้าต้องดูแลมากกว่า 1 รุ่น ต้องให้ผู้ดูแลระบบเป็นผู้เพิ่มให้)`;
  if (allowsMultiple) return;
  const checked = Array.from(registerAgeGroupCheckboxes).filter((cb) => cb.checked);
  if (checked.length > 1) {
    // เก็บไว้แค่ตัวล่าสุดที่เพิ่งกด ปลดตัวที่เลือกไว้ก่อนหน้าออกทั้งหมด
    for (const cb of checked.slice(0, -1)) cb.checked = false;
  }
}
registerCoachPositionSelect.addEventListener("change", enforceRegisterAgeGroupLimit);
for (const cb of registerAgeGroupCheckboxes) {
  cb.addEventListener("change", enforceRegisterAgeGroupLimit);
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerError.textContent = "";
  const role = document.querySelector('input[name="register-role"]:checked').value;
  const name = document.getElementById("register-name").value.trim();
  // ต้องแปลงเป็นตัวพิมพ์เล็กก่อนเสมอ เพราะ Firebase Auth จะทำให้อีเมลใน request.auth.token.email เป็นตัวพิมพ์
  // เล็กเสมอไม่ว่าผู้ใช้จะพิมพ์ตัวใหญ่ปนมาแค่ไหน — ถ้าค่าที่บันทึกลง Firestore (request.resource.data.email)
  // ไม่ตรงกับตัวพิมพ์เล็กเป๊ะๆ กฎ allow create จะปฏิเสธด้วย "Missing or insufficient permissions" ทันที
  const email = document.getElementById("register-email").value.trim().toLowerCase();
  const password = document.getElementById("register-password").value;
  const passwordConfirm = document.getElementById("register-password-confirm").value;
  const coachPosition = registerCoachPositionSelect.value;
  const ageGroups = Array.from(registerAgeGroupCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  if (password !== passwordConfirm) {
    registerError.textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    return;
  }

  if (role === "coach" && ageGroups.length === 0) {
    registerError.textContent = "กรุณาเลือกรุ่นอายุที่รับผิดชอบอย่างน้อย 1 รุ่น";
    return;
  }
  if (role === "coach" && !coachPositionAllowsMultipleAgeGroups(coachPosition) && ageGroups.length > 1) {
    registerError.textContent = `${coachPositionLabel(coachPosition)} เลือกได้เพียงรุ่นอายุเดียว (ถ้าต้องดูแลมากกว่า 1 รุ่น ต้องให้ผู้ดูแลระบบเป็นผู้เพิ่มให้)`;
    return;
  }

  let createdCred = null;
  try {
    createdCred = await createUserWithEmailAndPassword(auth, email, password);
    const payload = { name, email, role, status: "pending", createdAt: serverTimestamp() };
    if (role === "coach") {
      payload.ageGroups = ageGroups;
      payload.coachPosition = coachPosition;
    }
    await setDoc(doc(db, "coaches", createdCred.user.uid), payload);
    registerForm.reset();
    // onAuthStateChanged จะทำงานต่อเองและแสดงหน้า "รอผู้ดูแลระบบอนุมัติ"
  } catch (err) {
    // ถ้าสร้างบัญชี Firebase Auth สำเร็จแล้วแต่บันทึกโปรไฟล์ลง Firestore ไม่สำเร็จ (เช่น เน็ตหลุดกลางทาง)
    // ต้องลบบัญชี Auth ที่เพิ่งสร้างทิ้งด้วย ไม่งั้นจะเหลือ "บัญชีผี" ที่ล็อกอินได้แต่ไม่มีโปรไฟล์ใน Firestore
    // เลย — ผู้ดูแลระบบจะมองไม่เห็นในหน้าอนุมัติ/รายชื่อโค้ชเลยแม้แต่รายการเดียว (ค้นหาไม่เจอเพราะไม่มีเอกสาร
    // ให้ค้นตั้งแต่ต้น) และอีเมลนั้นก็ลงทะเบียนซ้ำไม่ได้อีกเพราะ Firebase Auth มองว่าอีเมลถูกใช้ไปแล้ว
    if (createdCred) {
      try {
        await deleteUser(createdCred.user);
      } catch (cleanupErr) {
        console.error("ลบบัญชีที่สร้างไม่สมบูรณ์ไม่สำเร็จ:", cleanupErr);
      }
    }
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
  adminReportCardSection.classList.add("hidden");
  adminMascRoundsSection.classList.add("hidden");
  adminPlayerAuditSection.classList.add("hidden");
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
  checkTodayReminders();
  loadExecutiveNotes(myTeam, dailyExecutiveNotesList);
}

// เตือนงานประจำวันที่ยังไม่ได้ทำของ "วันนี้" จริงๆ (ไม่ผูกกับวันที่ที่เลือกดูในการ์ดด้านบนของหน้านี้) — เรียก
// ครั้งเดียวตอนเปิดหน้า Daily (หน้าแรกของโค้ช) เพื่อกันลืมเช็คชื่อ/ส่งรายงาน โดยไม่ต้องรอผู้ดูแลระบบส่งข้อความ
// เตือนย้อนหลัง ตรวจแค่ "เริ่มทำหรือยัง" ไม่ตรวจความครบถ้วน (มีระบบแจ้งเตือนของผู้ดูแลระบบดูแลส่วนนั้นอยู่แล้ว)
async function checkTodayReminders() {
  if (!myTeam) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  dailyReminderBanner.classList.add("hidden");
  dailyReminderBanner.innerHTML = "";
  try {
    const [session, reportSnap] = await Promise.all([
      findSession(todayStr),
      getDocs(query(collection(db, "trainingReports"), where("team", "==", myTeam), where("date", "==", todayStr)))
    ]);

    const reminders = [];
    if (!session) {
      reminders.push({ text: "ยังไม่ได้เช็คชื่อการฝึกซ้อมวันนี้", action: openCheckinSection });
    }
    if (reportSnap.empty) {
      reminders.push({ text: "ยังไม่ได้ส่งรายงานการฝึกซ้อมวันนี้", action: openReportSection });
    }
    if (reminders.length === 0) return;

    dailyReminderBanner.innerHTML = '<p class="text-sm font-semibold text-amber-800 mb-1">🔔 สิ่งที่ยังไม่ได้ทำวันนี้</p>';
    for (const r of reminders) {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-3";
      row.innerHTML = `<p class="text-sm text-amber-700">${r.text}</p>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = "ไปทำเลย →";
      btn.addEventListener("click", r.action);
      row.appendChild(btn);
      dailyReminderBanner.appendChild(row);
    }
    dailyReminderBanner.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    // ไม่ต้องแสดง error ให้กวนใจ เพราะเป็นแค่ตัวเตือนเสริม ไม่ใช่ข้อมูลหลักของหน้านี้
  }
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

// ---------- การแจ้งเตือน (เฉพาะผู้ดูแลระบบ — โค้ช/ผู้บริหารทีมมีปุ่มกระดิ่งแต่ยังไม่เปิดใช้งาน) ----------
let currentNotifications = [];

async function refreshNotifications() {
  if (!currentIsAdmin) return;
  notificationList.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">กำลังโหลด...</p>';
  try {
    currentNotifications = await loadAdminNotifications();
    renderAdminNotifications(notificationList, currentNotifications);
    const unreadCount = currentNotifications.filter((n) => !n.read).length;
    notificationBadge.classList.toggle("hidden", unreadCount === 0);
  } catch (err) {
    console.error(err);
    notificationList.innerHTML = `<p class="text-red-600 text-sm text-center py-6">โหลดการแจ้งเตือนไม่สำเร็จ: ${err.message}</p>`;
  }
}

notificationBellBtn.addEventListener("click", () => {
  const opening = notificationPanel.classList.contains("hidden");
  notificationPanel.classList.toggle("hidden", !opening);
  if (opening) refreshNotifications();
});
notificationRefreshBtn.addEventListener("click", refreshNotifications);
// คลิกปุ่ม "✓" ในรายการเพื่อทำเครื่องหมายว่าอ่านแล้วทีละรายการ (event delegation เพราะรายการถูกสร้างใหม่
// ทุกครั้งที่โหลดข้อมูล) กันไม่ให้คลิกไปโดนลิงก์ที่ห่ออยู่ด้วย (preventDefault + stopPropagation)
notificationList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-mark-read-index]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const n = currentNotifications[Number(btn.dataset.markReadIndex)];
  if (!n) return;
  try {
    await markNotificationRead(n.key, n.detail);
    refreshNotifications();
  } catch (err) {
    console.error(err);
    alert("ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ: " + err.message);
  }
});
document.addEventListener("click", (e) => {
  if (notificationPanel.classList.contains("hidden")) return;
  if (notificationPanel.contains(e.target) || notificationBellBtn.contains(e.target)) return;
  notificationPanel.classList.add("hidden");
});

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
  myAgeGroups = [];
  myCoachPosition = null;
  adminReturnSection = null;
  adminViewingAs = null;
  // สลับป้ายบทบาท + ชื่อ/อีเมลกลับเป็นของผู้ดูแลระบบเองตามเดิม (ตรงข้ามกับที่เขียนทับด้วยข้อมูลของโค้ช/
  // ผู้บริหารทีมที่สวมบทบาทไว้ตอนเข้า enterTeamManagementMode / enterExecutiveViewMode)
  coachRoleBadgeEl.textContent = "ผู้ดูแลระบบ";
  coachRoleBadgeEl.className = "badge badge-info";
  coachNameEl.textContent = adminOwnName;
  coachEmailEl.textContent = adminOwnEmail;
  coachStatusBadgeEl.innerHTML = '<span class="badge badge-success">อนุมัติแล้ว</span>';
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
      navDrawerItems.appendChild(
        drawerItem("🧬", "การประเมิน MASC", () => {
          // แนบ ageGroups/coachPosition ไปด้วยถ้ากำลังสวมบทบาทเป็นโค้ชคนใดคนหนึ่งอยู่ (myAgeGroups มีค่า) เพื่อให้
          // masc.html กรองรายชื่อนักกีฬาให้ตรงกับที่โค้ชคนนั้นเห็นจริง เหมือนกับทุกเมนูอื่นในโหมดนี้ — ถ้าเป็นการ
          // จัดการทีมแบบกว้าง (ไม่เจาะจงโค้ช) myAgeGroups จะว่างอยู่แล้ว จึงไม่แนบพารามิเตอร์เพิ่ม เห็นทุกรุ่นเหมือนเดิม
          const params = new URLSearchParams({ team: myTeam });
          if (myAgeGroups.length > 0) params.set("ageGroups", myAgeGroups.join(","));
          if (myCoachPosition) params.set("coachPosition", myCoachPosition);
          window.location.href = `./masc.html#${params.toString()}`;
        })
      );
      navDrawerItems.appendChild(drawerDivider());
      navDrawerItems.appendChild(drawerItem("🛡️", "กลับแผงควบคุมผู้ดูแลระบบ", exitTeamManagementToAdminPanel));
    } else {
      navDrawerItems.appendChild(drawerSectionLabel("ผู้ดูแลระบบ"));
      navDrawerItems.appendChild(drawerItem("👥", "รายชื่อโค้ชในระบบ", openAdminCoachesSection));
      navDrawerItems.appendChild(drawerItem("🧐", "ตรวจสอบข้อมูลนักกีฬาที่ผิดปกติ", openAdminPlayerAuditSection));
      navDrawerItems.appendChild(drawerItem("📈", "ความคืบหน้าการประเมินรายวัน", openAdminProgressSection));
      navDrawerItems.appendChild(drawerItem("📝", "คำขอลงทะเบียนที่รอการอนุมัติ", openAdminApprovalsSection));
      navDrawerItems.appendChild(drawerItem("⚽", "รายงานผลการแข่งขันทั้งหมด", openAdminMatchesSection));
      navDrawerItems.appendChild(drawerItem("🩹", "รายงานอาการบาดเจ็บทั้งหมด", openAdminInjuriesSection));
      navDrawerItems.appendChild(drawerItem("📊", "ดู Dashboard ทีม", openAdminDashboardSection));
      navDrawerItems.appendChild(drawerItem("🖨️", "พิมพ์สรุป Dashboard", openAdminPrintSection));
      navDrawerItems.appendChild(drawerItem("📔", "สมุดพกนักกีฬา", openAdminReportCardSection));
      navDrawerItems.appendChild(drawerItem("🧬", "กำหนดรอบการประเมิน MASC", openAdminMascRoundsSection));
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
    navDrawerItems.appendChild(drawerItem("🧬", "การประเมิน MASC", () => (window.location.href = "./masc.html")));
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

// เปิดตรงไปยังโค้ช/ผู้บริหารทีมคนที่ระบุ (มาจากผลค้นหาชื่อในหน้า Dashboard: #admin=coach&id=<coachId>)
// สวมบทบาทเข้าไปดูหน้าจอของคนนั้นทันทีเหมือนคลิกชื่อในรายชื่อโค้ช — ถ้าหา id นี้ไม่เจอหรือไม่มี id แนบมา
// ให้ fallback ไปหน้ารายชื่อโค้ชทั้งหมดแทน
async function openAdminCoachDeepLink() {
  const coachId = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("id");
  if (!coachId) {
    openAdminCoachesSection();
    return;
  }
  try {
    const snap = await getDoc(doc(db, "coaches", coachId));
    if (!snap.exists()) {
      openAdminCoachesSection();
      return;
    }
    const coach = { id: snap.id, ...snap.data() };
    if (coach.role === "executive") {
      enterExecutiveViewMode(coach.team, adminCoachesSection, coach);
    } else if (coach.role === "coach") {
      enterTeamManagementMode(coach.team, adminCoachesSection, coach);
    } else {
      openAdminCoachesSection();
    }
  } catch (err) {
    console.error(err);
    openAdminCoachesSection();
  }
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
  if (!adminPrintMonthSelect.value) {
    adminPrintMonthSelect.value = new Date().toISOString().slice(0, 7); // "YYYY-MM" — ค่าเริ่มต้นเป็นเดือนนี้
  }
  adminPrintStatus.textContent = "";
}

adminGeneratePrintBtn.addEventListener("click", () => {
  const team = adminPrintTeamSelect.value;
  if (!team) {
    adminPrintStatus.textContent = "กรุณาเลือกทีมก่อน";
    return;
  }
  const month = adminPrintMonthSelect.value;
  if (!month) {
    adminPrintStatus.textContent = "กรุณาเลือกเดือนก่อน";
    return;
  }
  const ageGroup = adminPrintAgeGroupSelect.value;
  adminPrintStatus.textContent = "";
  // ใช้ path เต็ม "/print.html" (มีนามสกุลไฟล์) เพราะ Vercel (โฮสต์จริง) ไม่รองรับ path แบบไม่มีนามสกุล
  // อัตโนมัติเหมือนเซิร์ฟเวอร์ทดสอบในเครื่อง (จะขึ้น 404) — ไฟล์ .html ยิงตรงได้ทุกที่ ส่วนพารามิเตอร์ใช้ URL
  // hash (#) แทน query string (?) เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง (serve, clean-url) จะ redirect
  // "print.html" ไปเป็น "print" และตัด query string ทิ้งระหว่างทาง แต่ไม่ตัด hash — ใช้ได้ทั้งในเครื่องและบน Vercel
  window.location.href =
    `${window.location.origin}/print.html#team=${encodeURIComponent(team)}` +
    `&ageGroup=${encodeURIComponent(ageGroup)}&month=${encodeURIComponent(month)}`;
});

// เดือนก่อนหน้า n เดือน ในรูปแบบ "YYYY-MM" — ใช้ตั้งค่าเริ่มต้นของช่วงเวลาสมุดพก (3 เดือนล่าสุดนับถึงเดือนนี้)
function monthsAgoStr(n) {
  const d = new Date();
  d.setDate(1); // กันวันที่ปัจจุบันเกินจำนวนวันของเดือนก่อนหน้า (เช่น 31 มี.ค. ย้อนไป ก.พ.)
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

function openAdminReportCardSection() {
  hideAllScreens();
  adminReportCardSection.classList.remove("hidden");
  populateTeamSelect(adminReportCardTeamSelect, null);
  adminReportCardAgeGroupSelect.value = "__ALL__";
  if (!adminReportCardStartSelect.value) {
    adminReportCardStartSelect.value = monthsAgoStr(2); // ค่าเริ่มต้น: ย้อนหลัง 3 เดือนนับถึงเดือนนี้
  }
  if (!adminReportCardEndSelect.value) {
    adminReportCardEndSelect.value = monthsAgoStr(0);
  }
  adminReportCardStatus.textContent = "";
}

adminGenerateReportCardBtn.addEventListener("click", () => {
  const team = adminReportCardTeamSelect.value;
  if (!team) {
    adminReportCardStatus.textContent = "กรุณาเลือกทีมก่อน";
    return;
  }
  const start = adminReportCardStartSelect.value;
  const end = adminReportCardEndSelect.value;
  if (!start || !end) {
    adminReportCardStatus.textContent = "กรุณาเลือกช่วงเวลาให้ครบ";
    return;
  }
  if (start > end) {
    adminReportCardStatus.textContent = "เดือนเริ่มต้นต้องอยู่ก่อนหรือเท่ากับเดือนสิ้นสุด";
    return;
  }
  const ageGroup = adminReportCardAgeGroupSelect.value;
  adminReportCardStatus.textContent = "";
  window.location.href =
    `${window.location.origin}/report-card.html#team=${encodeURIComponent(team)}` +
    `&ageGroup=${encodeURIComponent(ageGroup)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
});

// ---------- ผู้ดูแลระบบ: กำหนดรอบการประเมิน MASC (ช่วงวันที่ + แจ้งเตือนโค้ชทุกทีม) ----------
// รอบเดียวใช้ทั้งองค์กรพร้อมกันทุกทีม (ไม่แยกทีม) ตามที่ตกลงกันไว้ — สถานะคำนวณสดจากวันที่ปัจจุบันเทียบกับ
// startDate/endDate ที่บันทึกไว้ ไม่ต้องมีฟิลด์สถานะแยกเก็บเอง (กันข้อมูลเพี้ยนถ้าเปิดแอปข้ามวันไป)
function mascRoundStatus(round) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (todayStr < round.startDate) return { label: "ยังไม่เริ่ม", className: "badge-neutral" };
  if (todayStr > round.endDate) return { label: "สิ้นสุดแล้ว", className: "badge-neutral" };
  return { label: "กำลังดำเนินการ", className: "badge-success" };
}

// ---------- "รอบแก้ไข" — เปิดรอบเดิมซ้ำ (label เดิม) อีกครั้งด้วยวันที่ใหม่ สำหรับทีม/รุ่นที่ยังประเมินไม่ครบ
// หลังรอบเดิมหมดเขตแล้ว ไม่ต้องมี field แยกในสคีมา เพราะ playerEvaluations ผูกกับ label อยู่แล้ว การเปิดรอบใหม่
// ด้วย label เดิมก็ทำให้ hasActiveMascRound ในหน้า masc.html กลับมาเป็นจริงสำหรับ "ช่วงที่ N" นั้นได้ทันที โดยไม่
// กระทบข้อมูลที่ประเมินครบไปแล้ว (isCorrectionRound เป็นแค่ flag ไว้แสดงผลในตารางประวัติเท่านั้น) ----------
let mascCorrectionRoundLabel = null;

function updateMascRoundStartBtnLabel() {
  adminMascRoundStartBtn.textContent = mascCorrectionRoundLabel
    ? "เปิดรอบแก้ไข (แจ้งเตือนเฉพาะทีม/รุ่นที่ยังค้าง)"
    : "เริ่มรอบประเมิน (แจ้งเตือนทุกทีม)";
}

async function enterMascCorrectionMode(round) {
  mascCorrectionRoundLabel = round.label;
  adminMascRoundPeriodSelect.value = round.label;
  adminMascRoundPeriodSelect.disabled = true;
  adminMascRoundStartInput.value = "";
  adminMascRoundEndInput.value = "";
  adminMascRoundStatus.textContent = "";
  updateMascRoundStartBtnLabel();
  adminMascRoundCorrectionLabel.textContent = round.label;
  adminMascRoundCorrectionSummary.innerHTML = '<p class="text-slate-500">กำลังตรวจสอบว่ารุ่นไหนยังประเมินไม่ครบ...</p>';
  adminMascRoundCorrectionNote.classList.remove("hidden");
  adminMascRoundCreateCard.scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    const groups = await computeIncompleteGroupsForLabel(round.label);
    if (groups.length === 0) {
      adminMascRoundCorrectionSummary.innerHTML =
        '<p class="text-emerald-700">ทุกทีมประเมินครบแล้วสำหรับช่วงนี้ — อาจไม่จำเป็นต้องเปิดรอบแก้ไขก็ได้</p>';
      return;
    }
    adminMascRoundCorrectionSummary.innerHTML =
      '<p class="font-medium mb-1.5">รุ่นที่ยังประเมินไม่ครบ:</p><div class="flex flex-wrap gap-1.5">' +
      groups.map((g) => `<span class="badge badge-warning">${teamLogoImg(g.team)}${g.team} · ${g.ageGroup}: ${g.done}/${g.total}</span>`).join("") +
      "</div>";
  } catch (err) {
    console.error(err);
    adminMascRoundCorrectionSummary.innerHTML = `<p class="text-red-600">ตรวจสอบไม่สำเร็จ: ${err.message}</p>`;
  }
}

// หมายเหตุ: ตั้งใจไม่ล้าง adminMascRoundStatus ในนี้ — ตอนบันทึกรอบสำเร็จ ต้องเรียกฟังก์ชันนี้ก่อนตั้งข้อความ
// "บันทึกสำเร็จ ✓" ทีหลัง ถ้ามาล้างในนี้ด้วยจะเผลอลบข้อความสำเร็จทิ้งไปพร้อมกัน จุดที่ต้องล้างสถานะเอง (เปิดหน้าใหม่/
// กดยกเลิก) จึงเซ็ตให้ตรงๆ ที่ตัวเรียกแทน
function exitMascCorrectionMode() {
  mascCorrectionRoundLabel = null;
  adminMascRoundPeriodSelect.disabled = false;
  adminMascRoundPeriodSelect.value = "";
  adminMascRoundStartInput.value = "";
  adminMascRoundEndInput.value = "";
  adminMascRoundCorrectionNote.classList.add("hidden");
  updateMascRoundStartBtnLabel();
}

adminMascRoundCorrectionCancelBtn.addEventListener("click", () => {
  exitMascCorrectionMode();
  adminMascRoundStatus.textContent = "";
});

function openAdminMascRoundsSection() {
  hideAllScreens();
  adminMascRoundsSection.classList.remove("hidden");
  exitMascCorrectionMode();
  adminMascRoundStatus.textContent = "";
  loadMascRounds();
}

// เก็บรอบทั้งหมดที่โหลดล่าสุดไว้ใช้ร่วมกับ dropdown "ดูความคืบหน้าของรอบ" ด้านล่าง กันไม่ต้อง query ซ้ำ
let mascRoundsCache = [];

async function loadMascRounds() {
  adminMascRoundListBody.innerHTML =
    '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  try {
    const snap = await getDocs(collection(db, "mascRounds"));
    const rounds = [];
    snap.forEach((d) => rounds.push({ id: d.id, ...d.data() }));
    rounds.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    mascRoundsCache = rounds;
    renderMascRoundList(rounds);
    populateMascProgressRoundSelect(rounds);
  } catch (err) {
    console.error(err);
    adminMascRoundListBody.innerHTML =
      `<tr><td colspan="5" class="px-4 py-6 text-center text-red-600">โหลดไม่สำเร็จ: ${err.message}</td></tr>`;
  }
}

// ---------- ผู้ดูแลระบบ: ความคืบหน้าการประเมิน MASC แยกทีม/รุ่น สำหรับรอบที่เลือก ----------
function isEvaluationComplete(ev) {
  return ["M", "A", "S", "C"].every((cat) => categoryRawScore(ev.scores?.[cat]) !== null);
}
function isEvaluationStarted(ev) {
  return ["M", "A", "S", "C"].some((cat) => (ev.scores?.[cat] || []).some((v) => v !== null && v !== undefined));
}

function populateMascProgressRoundSelect(rounds) {
  if (rounds.length === 0) {
    mascProgressRoundSelect.innerHTML = '<option value="">— ยังไม่มีรอบ —</option>';
    mascProgressTeamTabs.innerHTML = "";
    mascProgressBody.innerHTML = '<p class="text-sm text-slate-400 py-2">ยังไม่เคยกำหนดรอบการประเมิน MASC</p>';
    return;
  }
  mascProgressRoundSelect.innerHTML = rounds
    .map((r) => `<option value="${r.id}">${r.label} (${r.startDate} – ${r.endDate}) · ${mascRoundStatus(r).label}</option>`)
    .join("");
  // ค่าเริ่มต้น: รอบที่ "กำลังดำเนินการ" อยู่ตอนนี้ถ้ามี ไม่งั้นใช้รอบล่าสุด (rounds เรียงจากใหม่ไปเก่าอยู่แล้ว)
  const activeRound = rounds.find((r) => mascRoundStatus(r).label === "กำลังดำเนินการ");
  mascProgressRoundSelect.value = (activeRound || rounds[0]).id;
  loadMascProgressBreakdown();
}

mascProgressRoundSelect.addEventListener("change", loadMascProgressBreakdown);

// ดึงรายชื่อนักกีฬาทั้งหมด + สถานะการประเมิน (complete/partial/none) สำหรับ assessmentPeriod หนึ่ง — ใช้ร่วมกัน
// ทั้งตัวแสดงความคืบหน้ารายทีม (loadMascProgressBreakdown) และตัวสรุปรุ่นที่ยังค้างตอนสร้างรอบแก้ไข
// (computeIncompleteGroupsForLabel) กันเขียน query + logic คำนวณสถานะซ้ำสองที่
async function fetchPlayerEvaluationStatusForLabel(label) {
  const [playersSnap, evalSnap] = await Promise.all([
    getDocs(collection(db, "players")),
    // กรองด้วย assessmentPeriod (ค่าเป็น label ของรอบ ไม่ใช่ id) ตามโครงสร้างข้อมูลเดิมของ playerEvaluations —
    // ถ้าเคยตั้ง label ซ้ำกันข้ามรอบ (เช่นปีถัดไปใช้ "ช่วงที่ 1" ซ้ำ) การประเมินจากรอบเก่าจะปนมาด้วย เป็น
    // ข้อจำกัดเดิมของระบบเพราะ playerEvaluations ผูกกับ label ไม่ได้ผูกกับ id ของรอบโดยตรง
    getDocs(query(collection(db, "playerEvaluations"), where("assessmentPeriod", "==", label)))
  ]);
  const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const rank = { complete: 2, partial: 1, none: 0 };
  const statusByPlayerId = new Map();
  evalSnap.forEach((d) => {
    const ev = d.data();
    if (!ev.playerId) return;
    const status = isEvaluationComplete(ev) ? "complete" : isEvaluationStarted(ev) ? "partial" : "none";
    const existing = statusByPlayerId.get(ev.playerId);
    if (!existing || rank[status] > rank[existing]) statusByPlayerId.set(ev.playerId, status);
  });
  return { players, statusByPlayerId };
}

// สรุปรุ่นอายุของแต่ละทีมที่ "ยังประเมินไม่ครบ" สำหรับ assessmentPeriod ที่กำหนด — ใช้ตอนผู้ดูแลระบบกำลังจะสร้าง
// รอบแก้ไข เพื่อให้เห็นก่อนตัดสินใจว่ายังจำเป็นต้องเปิดรอบแก้ไขจริงไหม และแจ้งเตือนเฉพาะทีมที่เกี่ยวข้องเท่านั้น
async function computeIncompleteGroupsForLabel(label) {
  const { players, statusByPlayerId } = await fetchPlayerEvaluationStatusForLabel(label);
  const byTeamAgeGroup = new Map();
  for (const p of players) {
    if (!p.team || !p.ageGroup) continue;
    const key = `${p.team}__${p.ageGroup}`;
    if (!byTeamAgeGroup.has(key)) byTeamAgeGroup.set(key, { team: p.team, ageGroup: p.ageGroup, done: 0, total: 0 });
    const entry = byTeamAgeGroup.get(key);
    entry.total += 1;
    if (statusByPlayerId.get(p.id) === "complete") entry.done += 1;
  }
  return Array.from(byTeamAgeGroup.values())
    .filter((g) => g.done < g.total)
    .sort((a, b) => TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team) || ageGroupNumber(a.ageGroup) - ageGroupNumber(b.ageGroup));
}

async function loadMascProgressBreakdown() {
  const round = mascRoundsCache.find((r) => r.id === mascProgressRoundSelect.value);
  if (!round) {
    mascProgressTeamTabs.innerHTML = "";
    mascProgressBody.innerHTML = "";
    return;
  }
  mascProgressTeamTabs.innerHTML = "";
  mascProgressBody.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">กำลังโหลด...</p>';
  try {
    const { players, statusByPlayerId } = await fetchPlayerEvaluationStatusForLabel(round.label);

    const byTeam = new Map();
    for (const p of players) {
      if (!p.team) continue;
      if (!byTeam.has(p.team)) byTeam.set(p.team, []);
      byTeam.get(p.team).push(p);
    }
    const teamsPresent = TEAMS.filter((t) => byTeam.has(t));
    if (teamsPresent.length === 0) {
      mascProgressBody.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">ยังไม่มีนักกีฬาในระบบ</p>';
      return;
    }

    function showTeam(team, btn) {
      for (const tabBtn of mascProgressTeamTabs.children) {
        tabBtn.classList.toggle("btn-primary", tabBtn === btn);
        tabBtn.classList.toggle("btn-secondary", tabBtn !== btn);
      }
      renderMascProgressBody(byTeam.get(team) || [], statusByPlayerId);
    }

    for (const team of teamsPresent) {
      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = "btn btn-secondary btn-sm";
      tabBtn.innerHTML = `${teamLogoImg(team)}${team}`;
      tabBtn.addEventListener("click", () => showTeam(team, tabBtn));
      mascProgressTeamTabs.appendChild(tabBtn);
    }
    showTeam(teamsPresent[0], mascProgressTeamTabs.children[0]);
  } catch (err) {
    console.error(err);
    mascProgressBody.innerHTML = `<p class="text-sm text-red-600 py-4 text-center">โหลดไม่สำเร็จ: ${err.message}</p>`;
  }
}

// การ์ดแบบเปิด/ปิดได้ (details/summary) หนึ่งใบต่อหนึ่งรุ่นอายุของทีมที่เลือก — เปิดรุ่นแรกให้อัตโนมัติ
// ที่เหลือพับไว้ก่อนกันหน้ายาวเกินไปถ้าทีมมีหลายรุ่น คลิกหัวข้อเพื่อเปิด/ปิดดูรายชื่อได้ทีละรุ่น
function renderMascProgressBody(teamPlayers, statusByPlayerId) {
  const ageGroups = Array.from(new Set(teamPlayers.map((p) => p.ageGroup).filter(Boolean))).sort(
    (a, b) => ageGroupNumber(a) - ageGroupNumber(b)
  );
  if (ageGroups.length === 0) {
    mascProgressBody.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">ทีมนี้ยังไม่มีนักกีฬา</p>';
    return;
  }
  const nameChip = (p, cls) => `<span class="badge ${cls}">${p.nickname || p.fullName || "-"}</span>`;
  mascProgressBody.innerHTML = ageGroups
    .map((ag, i) => {
      const groupPlayers = teamPlayers
        .filter((p) => p.ageGroup === ag)
        .sort((a, b) => (a.nickname || a.fullName || "").localeCompare(b.nickname || b.fullName || ""));
      const done = groupPlayers.filter((p) => statusByPlayerId.get(p.id) === "complete");
      const partial = groupPlayers.filter((p) => statusByPlayerId.get(p.id) === "partial");
      const notStarted = groupPlayers.filter((p) => (statusByPlayerId.get(p.id) ?? "none") === "none");
      const total = groupPlayers.length;
      const badgeClass = total > 0 && done.length === total ? "badge-success" : done.length > 0 ? "badge-info" : "badge-neutral";
      const doneChips = done.map((p) => nameChip(p, "badge-success")).join("") || '<span class="masc-progress-empty">— ไม่มี —</span>';
      const pendingChips =
        [...partial.map((p) => nameChip(p, "badge-warning")), ...notStarted.map((p) => nameChip(p, "badge-neutral"))].join("") ||
        '<span class="masc-progress-empty">— ไม่มี —</span>';
      return `
        <details class="masc-progress-group"${i === 0 ? " open" : ""}>
          <summary>
            <span>รุ่น ${ag}</span>
            <span class="badge ${badgeClass}">${done.length}/${total} คน</span>
          </summary>
          <div class="masc-progress-columns">
            <div>
              <p class="masc-progress-col-title">✅ ประเมินครบแล้ว (${done.length})</p>
              <div class="masc-progress-names">${doneChips}</div>
            </div>
            <div>
              <p class="masc-progress-col-title">⏳ ยังไม่ประเมิน / ยังไม่ครบ (${partial.length + notStarted.length})</p>
              <div class="masc-progress-names">${pendingChips}</div>
            </div>
          </div>
        </details>`;
    })
    .join("");
}

function renderMascRoundList(rounds) {
  if (rounds.length === 0) {
    adminMascRoundListBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ยังไม่เคยกำหนดรอบการประเมิน</td></tr>';
    return;
  }
  adminMascRoundListBody.innerHTML = rounds
    .map((r) => {
      const status = mascRoundStatus(r);
      const isEnded = status.label === "สิ้นสุดแล้ว";
      return `
        <tr>
          <td class="emphasis">${r.label ?? "-"}${r.isCorrectionRound ? ' <span class="badge badge-warning">รอบแก้ไข</span>' : ""}</td>
          <td>${r.startDate ?? "-"}</td>
          <td>${r.endDate ?? "-"}</td>
          <td><span class="badge ${status.className}">${status.label}</span></td>
          <td class="whitespace-nowrap">
            ${isEnded ? `<button type="button" class="btn btn-secondary btn-sm" data-masc-round-fix="${r.id}">สร้างรอบแก้ไข</button>` : ""}
            <button type="button" class="btn btn-ghost-danger btn-sm" data-masc-round-delete="${r.id}">ลบ</button>
          </td>
        </tr>`;
    })
    .join("");
  applyDataLabels(adminMascRoundListBody);
  adminMascRoundListBody.querySelectorAll("[data-masc-round-fix]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const round = rounds.find((r) => r.id === btn.dataset.mascRoundFix);
      if (round) enterMascCorrectionMode(round);
    });
  });
  adminMascRoundListBody.querySelectorAll("[data-masc-round-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("ยืนยันลบรอบการประเมินนี้? การลบนี้ไม่แจ้งเตือนโค้ชว่ายกเลิก และไม่สามารถย้อนกลับได้")) return;
      try {
        await deleteDoc(doc(db, "mascRounds", btn.dataset.mascRoundDelete));
        await loadMascRounds();
      } catch (err) {
        console.error(err);
        alert("ลบไม่สำเร็จ: " + err.message);
      }
    });
  });
}

adminMascRoundStartBtn.addEventListener("click", async () => {
  const label = adminMascRoundPeriodSelect.value;
  const startDate = adminMascRoundStartInput.value;
  const endDate = adminMascRoundEndInput.value;
  if (!label) {
    adminMascRoundStatus.textContent = "กรุณาเลือกช่วงที่ประเมิน";
    return;
  }
  if (!startDate || !endDate) {
    adminMascRoundStatus.textContent = "กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด";
    return;
  }
  if (startDate > endDate) {
    adminMascRoundStatus.textContent = "วันที่เริ่มต้องอยู่ก่อนหรือเท่ากับวันที่สิ้นสุด";
    return;
  }
  adminMascRoundStartBtn.disabled = true;
  adminMascRoundStatus.textContent = "กำลังบันทึก...";
  adminMascRoundStatus.className = "text-sm text-slate-500 w-full";
  // โหมด "รอบแก้ไข" ต้องยังตรงกับช่วงที่ล็อกไว้ตอนกดปุ่ม "สร้างรอบแก้ไข" เท่านั้น (กันกรณีแปลกๆ ที่ dropdown ถูก
  // เปิด disabled ไว้แต่ค่าเปลี่ยนไปได้ทางอื่น) — ถ้าไม่ตรงถือว่าเป็นการสร้างรอบใหม่ปกติ
  const isCorrection = mascCorrectionRoundLabel !== null && mascCorrectionRoundLabel === label;
  try {
    const startLabel = new Date(`${startDate}T00:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const endLabel = new Date(`${endDate}T00:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const createdBy = myCoachName || auth.currentUser?.email || "-";
    const newDoc = await addDoc(collection(db, "mascRounds"), {
      label,
      startDate,
      endDate,
      createdBy,
      createdAt: serverTimestamp(),
      ...(isCorrection ? { isCorrectionRound: true } : {})
    });
    // แจ้งเตือน (ใช้ executiveNotes ที่มีอยู่แล้ว — โค้ชเห็นข้อความนี้ในหน้า Daily ของตัวเองทันที) — รอบใหม่ปกติ
    // แจ้งทุกทีมเหมือนเดิม ส่วนรอบแก้ไขแจ้งเฉพาะทีมที่ยังมีรุ่นค้างอยู่จริง พร้อมระบุรุ่นที่ค้างของทีมนั้นในข้อความ
    // เพื่อไม่ให้ทีมที่ประเมินครบไปแล้วโดนแจ้งเตือนซ้ำแบบไม่จำเป็น
    let notifiedTeams;
    if (isCorrection) {
      const incompleteGroups = await computeIncompleteGroupsForLabel(label);
      notifiedTeams = Array.from(new Set(incompleteGroups.map((g) => g.team)));
      await Promise.all(
        notifiedTeams.map((team) => {
          const teamGroups = incompleteGroups
            .filter((g) => g.team === team)
            .map((g) => g.ageGroup)
            .join(", ");
          const message = `เปิดรอบแก้ไข MASC ${label} อีกครั้ง (รุ่น ${teamGroups} ยังประเมินไม่ครบ) ตั้งแต่วันที่ ${startLabel} ถึง ${endLabel} กรุณาดำเนินการให้แล้วเสร็จภายในกำหนด`;
          return sendExecutiveNote({ team, type: "masc_round", refId: newDoc.id, refLabel: label, message, createdBy });
        })
      );
    } else {
      notifiedTeams = TEAMS;
      const message = `เริ่มรอบประเมิน MASC ${label} แล้ว ตั้งแต่วันที่ ${startLabel} ถึง ${endLabel} กรุณาดำเนินการให้แล้วเสร็จภายในกำหนด`;
      await Promise.all(
        TEAMS.map((team) => sendExecutiveNote({ team, type: "masc_round", refId: newDoc.id, refLabel: label, message, createdBy }))
      );
    }
    adminMascRoundStatus.textContent =
      notifiedTeams.length > 0
        ? `${isCorrection ? "เปิดรอบแก้ไข" : "เริ่มรอบประเมิน"} ${label} และแจ้งเตือน ${notifiedTeams.length} ทีมแล้ว ✓`
        : `${isCorrection ? "เปิดรอบแก้ไข" : "เริ่มรอบประเมิน"} ${label} แล้ว (ไม่มีทีมที่ต้องแจ้งเตือนเพิ่ม)`;
    adminMascRoundStatus.className = "text-sm text-emerald-600 w-full";
    exitMascCorrectionMode();
    await loadMascRounds();
  } catch (err) {
    console.error(err);
    adminMascRoundStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    adminMascRoundStatus.className = "text-sm text-red-600 w-full";
  } finally {
    adminMascRoundStartBtn.disabled = false;
  }
});

// หน้าแผงควบคุมแบบการ์ด (admin-menu-section) ถูกยกเลิกไปแล้ว — ปุ่ม "← กลับหน้า Dashboard" ในแต่ละ
// เครื่องมือของผู้ดูแลระบบจึงย้อนกลับไปหน้า Dashboard โดยตรงแทน (ซึ่งเป็นหน้าหลักของผู้ดูแลระบบอยู่แล้ว)
for (const btn of adminBackButtons) {
  btn.addEventListener("click", goToDashboard);
}

// ล็อก/จำกัดช่องเลือกรุ่นอายุของนักกีฬาตามรุ่นที่โค้ชคนนี้รับผิดชอบ (ถ้ามีการระบุไว้ตอนลงทะเบียน)
// รุ่นเดียว (Head Coach ปกติ) = ล็อกค่าและปิดไม่ให้แก้ / หลายรุ่น (GK Coach) = ซ่อนตัวเลือกอื่นเหลือแค่รุ่นที่
// ดูแล แต่ยังเลือกได้เอง / ไม่มีข้อมูล (ผู้ดูแลระบบจัดการแทน หรือโค้ชเก่าก่อนมีฟีเจอร์นี้ — myAgeGroups ว่าง)
// เลือกได้อิสระตามเดิม
function applyAgeGroupLock() {
  const select = document.getElementById("player-age-group");
  if (myAgeGroups && myAgeGroups.length === 1) {
    select.value = myAgeGroups[0];
    select.disabled = true;
    for (const opt of select.options) opt.hidden = false;
  } else if (myAgeGroups && myAgeGroups.length > 1) {
    select.disabled = false;
    for (const opt of select.options) {
      if (opt.value === "") continue;
      opt.hidden = !myAgeGroups.includes(opt.value);
    }
    if (select.value && !myAgeGroups.includes(select.value)) select.value = "";
  } else {
    select.disabled = false;
    for (const opt of select.options) opt.hidden = false;
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
  reportSummary.classList.add("hidden");
  reportStatus.textContent = "";
  reportLoadStatus.textContent = "";
  updateReportPhotoWrapVisibility();
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
// เกณฑ์: แต่ละ session (วัน) ที่โค้ชคนนี้มีนักกีฬาของตัวเองบันทึกไว้ ถือว่า "ตรงเวลา" ถ้าเวลาแก้ไขล่าสุดของ
// บันทึกนักกีฬาที่ตัวเองดูแล (ไม่รวมของโค้ชอื่นในเซสชันเดียวกัน) อยู่ก่อน 23:59 น. ของวันนั้น — คำนวณแยกรายคน
// เพราะ 1 เซสชันใช้ร่วมกันได้หลายโค้ช (คนละรุ่นอายุ) การแก้ไขของโค้ชอื่นไม่ควรกระทบผลของโค้ชคนนี้ (ย้าย
// isCoachSubmissionOnTime/submissionDeadlineFor/isReportLate ไป ui-utils.js แล้ว เพราะ print.js ต้องใช้กฎ
// เดียวกันนี้ด้วย)
function buildCoachRow(c, sessions, attendanceRecords, players) {
  const teamSessions = sessions.filter((s) => s.team === c.team);
  const myPlayerIds = getCoachPlayerIds(c, players);
  let onTimeCount = 0;
  let relevantSessions = 0;
  for (const s of teamSessions) {
    const myAttendanceForSession = attendanceRecords.filter((a) => a.sessionId === s.id && myPlayerIds.has(a.playerId));
    if (myAttendanceForSession.length === 0) continue; // ยังไม่มีบันทึกของนักกีฬาที่ตัวเองดูแลในวันนั้น ไม่นับ
    relevantSessions += 1;
    if (isCoachSubmissionOnTime(s, myAttendanceForSession)) onTimeCount += 1;
  }
  const percentText =
    relevantSessions > 0 ? `${Math.round((onTimeCount / relevantSessions) * 100)}% (${onTimeCount}/${relevantSessions} วัน)` : "-";
  const statusBadge =
    c.role === "admin"
      ? '<span class="badge badge-info">ผู้ดูแลระบบ</span>'
      : c.status === "approved"
        ? '<span class="badge badge-success">อนุมัติแล้ว</span>'
        : '<span class="badge badge-warning">รอการอนุมัติ</span>';

  const tr = document.createElement("tr");

  // ชื่อโค้ชคลิกได้ ใช้สวมบทบาทเข้าไปดูหน้าจอจริงของบัญชีนั้น (เหมือนกดปุ่ม "จัดการทีมนี้" แต่เจาะจงคนเดียว
  // ไม่ใช่คนแรกที่เจอในทีม) ส่วนการแก้ไขข้อมูลบัญชียังใช้ปุ่ม "แก้ไขบัญชี" แยกต่างหากในคอลัมน์ "จัดการ"
  const nameTd = document.createElement("td");
  nameTd.className = "emphasis";
  const nameBtn = document.createElement("button");
  nameBtn.type = "button";
  nameBtn.textContent = c.name ?? "-";
  nameBtn.className = "text-blue-600 hover:underline text-left";
  nameBtn.title = "คลิกเพื่อดูข้อมูล/หน้าจอของบัญชีนี้";
  nameBtn.addEventListener("click", () => {
    if (c.team && c.role === "coach") {
      enterTeamManagementMode(c.team, adminCoachesSection, c);
    } else if (c.team && c.role === "executive") {
      enterExecutiveViewMode(c.team, adminCoachesSection, c);
    } else {
      openEditCoachModal(c);
    }
  });
  nameTd.appendChild(nameBtn);

  const roleTd = document.createElement("td");
  roleTd.innerHTML = roleLabel(c.role);

  tr.appendChild(nameTd);
  tr.insertAdjacentHTML("beforeend", `<td>${c.email ?? "-"}</td>`);
  tr.appendChild(roleTd);
  tr.insertAdjacentHTML(
    "beforeend",
    `<td>${c.role === "coach" ? coachPositionLabel(c.coachPosition) : "-"}</td>` +
      `<td>${c.role === "coach" ? (c.ageGroups || []).join(", ") || "-" : "-"}</td>` +
      `<td>${statusBadge}</td>` +
      `<td>${c.role === "admin" ? "-" : percentText}</td>`
  );

  const actionTd = document.createElement("td");
  const editBtn = document.createElement("button");
  editBtn.textContent = "แก้ไขบัญชี";
  editBtn.className = "btn btn-secondary btn-sm";
  editBtn.addEventListener("click", () => openEditCoachModal(c));
  actionTd.appendChild(editBtn);
  tr.appendChild(actionTd);

  return tr;
}

function buildCoachGroupTable(coaches, sessions, attendanceRecords, players) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card table-wrap">
      <table class="pro-table">
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>อีเมล</th>
            <th>บทบาท</th>
            <th>ตำแหน่งโค้ช</th>
            <th>รุ่นอายุ</th>
            <th>สถานะ</th>
            <th title="เปอร์เซ็นต์ของวันที่ส่งข้อมูลก่อน 23:59 น. เทียบกับจำนวนวันที่บันทึกทั้งหมด">% ตรงเวลา</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  const tbody = wrapper.querySelector("tbody");
  for (const c of coaches) {
    tbody.appendChild(buildCoachRow(c, sessions, attendanceRecords, players));
  }
  applyDataLabels(tbody);
  return wrapper;
}

// จัดกลุ่มรายชื่อโค้ชตามทีม (เรียงตามลำดับ TEAMS คงที่) แล้วเรียงภายในแต่ละทีมตามรุ่นอายุน้อยไปมาก เพื่อให้
// ดูง่ายกว่าตารางรวมทุกทีมแบบเดิม — บัญชีที่ยังไม่มีทีม (ผู้ดูแลระบบ/รอกำหนดทีม) แยกไว้เป็นกลุ่มท้ายสุด
async function loadCoachDirectory() {
  coachDirectoryGroups.innerHTML = '<p class="text-slate-400 text-sm">กำลังโหลด...</p>';
  const [coachSnap, sessionSnap, attendanceSnap, playerSnap] = await Promise.all([
    getDocs(collection(db, "coaches")),
    getDocs(collection(db, "sessions")),
    getDocs(collection(db, "attendance")),
    getDocs(collection(db, "players"))
  ]);

  const coaches = [];
  coachSnap.forEach((d) => coaches.push({ id: d.id, ...d.data() }));
  const sessions = [];
  sessionSnap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
  const attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));
  const players = [];
  playerSnap.forEach((d) => players.push({ id: d.id, ...d.data() }));

  if (coaches.length === 0) {
    coachDirectoryGroups.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีโค้ชในระบบ</p>';
    return;
  }

  const teamGroups = new Map();
  for (const team of TEAMS) teamGroups.set(team, []);
  const unassignedGroup = [];
  for (const c of coaches) {
    if (c.team && teamGroups.has(c.team)) {
      teamGroups.get(c.team).push(c);
    } else {
      unassignedGroup.push(c);
    }
  }

  const sortWithinTeam = (list) =>
    list.sort((a, b) => {
      // ผู้บริหารทีมไว้บนสุด (ไม่ผูกกับรุ่นอายุใดรุ่นหนึ่ง) แล้วค่อยเรียงโค้ชตามรุ่นอายุน้อยไปมาก
      if (a.role === "executive" && b.role !== "executive") return -1;
      if (b.role === "executive" && a.role !== "executive") return 1;
      const keyDiff = ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups);
      return keyDiff !== 0 ? keyDiff : (a.name ?? "").localeCompare(b.name ?? "");
    });

  coachDirectoryGroups.innerHTML = "";
  for (const team of TEAMS) {
    const teamCoaches = teamGroups.get(team);
    if (teamCoaches.length === 0) continue;
    sortWithinTeam(teamCoaches);

    const heading = document.createElement("h3");
    heading.className = "section-title text-sm mb-2";
    heading.innerHTML = `${teamLogoImg(team)}${team} (${teamCoaches.length} คน)`;

    const viewTeamBtn = document.createElement("button");
    viewTeamBtn.type = "button";
    viewTeamBtn.textContent = "จัดการทีมนี้ →";
    viewTeamBtn.className = "btn btn-secondary btn-sm mb-3";
    viewTeamBtn.addEventListener("click", () => enterTeamManagementMode(team, adminCoachesSection));

    const sendSummaryBtn = document.createElement("button");
    sendSummaryBtn.type = "button";
    sendSummaryBtn.textContent = "📤 ส่งสรุปการทำงานโค้ชให้ผู้บริหารทีม";
    sendSummaryBtn.className = "btn btn-secondary btn-sm mb-3";
    sendSummaryBtn.addEventListener("click", () => sendCoachActivitySummaryToExecutive(team, sendSummaryBtn));

    const btnGroup = document.createElement("div");
    btnGroup.className = "flex gap-2 flex-wrap";
    btnGroup.appendChild(sendSummaryBtn);
    btnGroup.appendChild(viewTeamBtn);

    const groupWrap = document.createElement("div");
    groupWrap.className = "mb-2 flex items-center justify-between flex-wrap gap-2";
    groupWrap.appendChild(heading);
    groupWrap.appendChild(btnGroup);

    coachDirectoryGroups.appendChild(groupWrap);
    coachDirectoryGroups.appendChild(buildCoachGroupTable(teamCoaches, sessions, attendanceRecords, players));
  }

  if (unassignedGroup.length > 0) {
    unassignedGroup.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const heading = document.createElement("h3");
    heading.className = "section-title text-sm mb-2";
    heading.textContent = `🛡️ ยังไม่มีทีม (ผู้ดูแลระบบ/รอกำหนดทีม) (${unassignedGroup.length} คน)`;
    coachDirectoryGroups.appendChild(heading);
    coachDirectoryGroups.appendChild(buildCoachGroupTable(unassignedGroup, sessions, attendanceRecords, players));
  }
}

// ---------- สรุปการทำงานของโค้ชแต่ละคนประจำเดือนนี้ (เช็คชื่อ/รายงานการฝึกซ้อม/แผนการฝึกซ้อม) ----------
// ใช้ร่วมกัน 2 จุด: (1) หน้าสรุปของผู้บริหารทีมเอง — ดูได้เองแบบ passive ไม่ต้องรอใครส่งให้ (2) ปุ่ม "ส่งสรุป
// การทำงานโค้ชให้ผู้บริหารทีม" ของผู้ดูแลระบบในหน้ารายชื่อโค้ช — แบบ push แจ้งเตือนผ่าน executiveNotes ที่มีอยู่แล้ว
// นับคะแนนเช็คชื่อ/ตรงเวลาด้วยหลักการเดียวกับ buildCoachRow (getCoachPlayerIds + isCoachSubmissionOnTime) แต่
// จำกัดเฉพาะ "เดือนนี้" ต่างจากตารางรายชื่อโค้ชที่นับสะสมทุกเดือนรวมกัน — ส่วนรายงาน/แผนฝึกซ้อมจับคู่ด้วยชื่อโค้ช
// (coachName) ไม่ใช่ coachId เพราะเวลาผู้ดูแลระบบสวมบทบาทส่งแทนโค้ช coachId จะกลายเป็น uid ของผู้ดูแลระบบเอง
// (ตามหลักการเดียวกับ loadTrainingPlanSummary ใน app.js)
async function computeCoachMonthlySummaryRows(team) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [coachSnap, playerSnap, sessionSnap, attendanceSnap, reportSnap, planSnap] = await Promise.all([
    getDocs(query(collection(db, "coaches"), where("team", "==", team), where("role", "==", "coach"))),
    getDocs(query(collection(db, "players"), where("team", "==", team))),
    getDocs(query(collection(db, "sessions"), where("team", "==", team))),
    getDocs(query(collection(db, "attendance"), where("team", "==", team))),
    getDocs(query(collection(db, "trainingReports"), where("team", "==", team))),
    getDocs(query(collection(db, "trainingPlans"), where("team", "==", team)))
  ]);

  const coaches = [];
  coachSnap.forEach((d) => coaches.push({ id: d.id, ...d.data() }));
  const players = [];
  playerSnap.forEach((d) => players.push({ id: d.id, ...d.data() }));
  const sessions = [];
  sessionSnap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
  const monthSessions = sessions.filter((s) => (s.date || "").startsWith(thisMonth));
  const attendanceRecords = [];
  attendanceSnap.forEach((d) => attendanceRecords.push(d.data()));
  const reports = [];
  reportSnap.forEach((d) => reports.push(d.data()));
  const monthReports = reports.filter((r) => (r.date || "").startsWith(thisMonth));
  const plans = [];
  planSnap.forEach((d) => plans.push({ id: d.id, ...d.data() }));
  const monthPlans = plans.filter((p) => (p.date || "").startsWith(thisMonth));
  const today = new Date();
  const todayDay = today.getDate();

  coaches.sort(
    (a, b) => ageGroupSortKey(a.ageGroups) - ageGroupSortKey(b.ageGroups) || (a.name ?? "").localeCompare(b.name ?? "")
  );

  return coaches.map((c) => {
    const myPlayerIds = getCoachPlayerIds(c, players);
    let checkinDays = 0;
    let onTimeCount = 0;
    // สถานะการเช็คชื่อรายวัน ใช้เทียบกับแผน/รายงานของวันเดียวกัน เพื่อตรวจความสอดคล้อง (ดู dailyConsistency)
    const checkinStatusByDate = new Map();
    for (const s of monthSessions) {
      const myAttendanceForSession = attendanceRecords.filter((a) => a.sessionId === s.id && myPlayerIds.has(a.playerId));
      if (myAttendanceForSession.length === 0) continue;
      checkinDays += 1;
      const onTime = isCoachSubmissionOnTime(s, myAttendanceForSession);
      if (onTime) onTimeCount += 1;
      if (s.date) checkinStatusByDate.set(s.date, onTime ? "onTime" : "late");
    }
    const myReports = monthReports
      .filter((r) => r.coachName === c.name)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const reportCount = myReports.length;
    // สถานะการส่งรายงานรายวัน ใช้เกณฑ์ "สาย" เดียวกับเช็คชื่อ (23:59 น. ดู isReportLate)
    const reportStatusByDate = new Map();
    for (const r of myReports) {
      if (!r.date) continue;
      reportStatusByDate.set(r.date, isReportLate(r) ? "late" : "onTime");
    }
    const myPlans = monthPlans
      .filter((p) => p.coachName === c.name)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const planLateCount = myPlans.filter((p) => isTrainingPlanLate(p)).length;

    // สถานะการส่งแผนรายวัน ตั้งแต่วันที่ 1 ถึงวันนี้ ใช้วาดกราฟแนวโน้ม — ถ้าวันไหนมีหลายแผน (ปกติไม่ควรมี แต่กัน
    // ไว้เผื่อ) ถือว่า "ตรงเวลา" ถ้ามีอย่างน้อยหนึ่งแผนของวันนั้นตรงเวลา
    const planStatusByDate = new Map();
    for (const p of myPlans) {
      if (!p.date) continue;
      const late = isTrainingPlanLate(p);
      if (planStatusByDate.get(p.date) !== "onTime") {
        planStatusByDate.set(p.date, late ? "late" : "onTime");
      }
    }
    const planTrend = [];
    for (let day = 1; day <= todayDay; day++) {
      const dateStr = `${thisMonth}-${String(day).padStart(2, "0")}`;
      planTrend.push({ date: dateStr, status: planStatusByDate.get(dateStr) || "none" });
    }

    // ตรวจความสอดคล้องของแผน/เช็คชื่อ/รายงาน รายวัน — เอาเฉพาะวันที่มีอย่างน้อย 1 อย่างเกิดขึ้นจริง (ไม่รวมวันที่
    // ไม่มีอะไรเลยทั้งสามอย่าง เช่น วันหยุด) เรียงล่าสุดก่อน เพื่อให้เห็นวันที่ทำไม่ครบ/ไม่ตรงกันได้ทันที
    const allActivityDates = new Set([
      ...planStatusByDate.keys(),
      ...checkinStatusByDate.keys(),
      ...reportStatusByDate.keys()
    ]);
    const dailyConsistency = Array.from(allActivityDates)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        plan: planStatusByDate.get(date) || "none",
        checkin: checkinStatusByDate.get(date) || "none",
        report: reportStatusByDate.get(date) || "none"
      }));

    return {
      coachId: c.id,
      coachName: c.name ?? "-",
      coachPosition: c.coachPosition,
      ageGroups: c.ageGroups || [],
      checkinDays,
      onTimeCount,
      reportCount,
      reports: myReports,
      planCount: myPlans.length,
      planLateCount,
      plans: myPlans,
      planTrend,
      dailyConsistency
    };
  });
}

// กราฟแนวโน้มการส่งแผนการฝึกซ้อมรายวัน แบบ heatmap ทีละวันตั้งแต่วันที่ 1 ถึงวันนี้ (ไม่ใช้ไลบรารีภายนอก
// เหมือนกราฟอื่นๆ ในระบบ) — เขียว = ส่งตรงเวลา, ส้ม = ส่งสาย, เทา = ยังไม่ได้ส่งวันนั้น
function renderCoachPlanTrendChart(planTrend) {
  const colors = { onTime: "#10b981", late: "#f59e0b", none: "#e2e8f0" };
  const labels = { onTime: "ส่งตรงเวลา", late: "ส่งสาย", none: "ไม่ได้ส่ง" };
  const cells = planTrend
    .map((d) => {
      const day = Number(d.date.slice(-2));
      const textColor = d.status === "none" ? "#94a3b8" : "#fff";
      return `<div class="w-6 h-6 rounded flex items-center justify-center text-[10px] font-medium" style="background:${colors[d.status]};color:${textColor}" title="วันที่ ${d.date}: ${labels[d.status]}">${day}</div>`;
    })
    .join("");
  return `
    <div class="flex flex-wrap gap-1">${cells}</div>
    <div class="flex items-center gap-3 mt-2 text-xs text-slate-500">
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${colors.onTime}"></span>ตรงเวลา</span>
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${colors.late}"></span>สาย</span>
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${colors.none}"></span>ไม่ได้ส่ง</span>
    </div>
  `;
}

function dailyConsistencyBadge(status) {
  if (status === "onTime") return '<span class="badge badge-success">✅ ตรงเวลา</span>';
  if (status === "late") return '<span class="badge badge-warning">⚠️ สาย</span>';
  return '<span class="badge badge-danger">❌ ไม่ได้ส่ง</span>';
}

// ตารางตรวจความสอดคล้องรายวัน: แผนฝึกซ้อม/เช็คชื่อ+ให้คะแนน/รายงานการฝึกซ้อม ของโค้ชคนเดียวกันควรทำครบทั้ง 3
// อย่างในวันเดียวกัน ถ้าวันไหนมีบางอย่างแต่ขาดอย่างอื่นไป แปลว่าโค้ชยังไม่ได้ดำเนินการ (หรือส่งสายจนพ้นเกณฑ์) จึง
// ไฮไลต์แถวนั้นให้เห็นชัด — เอาเฉพาะวันที่มีอย่างน้อย 1 ใน 3 อย่างเกิดขึ้นจริง (ดู dailyConsistency ในฟังก์ชัน
// computeCoachMonthlySummaryRows)
function renderDailyConsistencyTable(dailyConsistency) {
  if (dailyConsistency.length === 0) {
    return '<p class="text-sm text-slate-400">ยังไม่มีข้อมูลเดือนนี้</p>';
  }
  const rows = dailyConsistency
    .map((d) => {
      const consistent = d.plan === d.checkin && d.checkin === d.report;
      const rowClass = consistent ? "" : "bg-red-50";
      return `
        <tr class="${rowClass}">
          <td>${d.date}</td>
          <td>${dailyConsistencyBadge(d.plan)}</td>
          <td>${dailyConsistencyBadge(d.checkin)}</td>
          <td>${dailyConsistencyBadge(d.report)}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <div class="card table-wrap">
      <table class="pro-table text-xs">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>แผนฝึกซ้อม</th>
            <th>เช็คชื่อ+ให้คะแนน</th>
            <th>รายงานการฝึกซ้อม</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-400 mt-1">🔴 แถวสีแดง = วันที่ทำ 3 อย่างไม่สอดคล้องกัน (ทำบางอย่างแต่ขาดอย่างอื่น หรือส่งสายไม่พร้อมกัน)</p>
  `;
}

// เนื้อหาในแถวรายละเอียดที่ขยายออกมาต่อจากแถวสรุปของโค้ชแต่ละคน — สถิติละเอียด + กราฟแนวโน้ม + รายการแผนที่
// คลิกดูรายละเอียดแต่ละฉบับได้ (เปิด modal ผ่าน renderPlanDetailModal)
function renderCoachDetailContent(row) {
  const wrap = document.createElement("div");
  wrap.className = "space-y-4";

  const onTimePercent = row.checkinDays > 0 ? Math.round((row.onTimeCount / row.checkinDays) * 100) : null;
  const statsWrap = document.createElement("div");
  statsWrap.className = "grid grid-cols-2 sm:grid-cols-4 gap-3";
  statsWrap.innerHTML =
    statCard("เช็คชื่อเดือนนี้", row.checkinDays > 0 ? `${row.checkinDays} วัน` : "-") +
    statCard("% ตรงเวลา (เช็คชื่อ)", onTimePercent !== null ? `${onTimePercent}%` : "-") +
    statCard("ส่งรายงานฝึกซ้อม", row.reportCount > 0 ? `${row.reportCount} วัน` : "-") +
    statCard("ส่งแผนฝึกซ้อม", row.planCount > 0 ? `${row.planCount} ครั้ง` : "-");
  wrap.appendChild(statsWrap);

  const trendTitle = document.createElement("h4");
  trendTitle.className = "text-sm font-semibold text-slate-700";
  trendTitle.textContent = "แนวโน้มการส่งแผนการฝึกซ้อมรายวัน";
  wrap.appendChild(trendTitle);

  const trendWrap = document.createElement("div");
  trendWrap.innerHTML = renderCoachPlanTrendChart(row.planTrend);
  wrap.appendChild(trendWrap);

  const consistencyTitle = document.createElement("h4");
  consistencyTitle.className = "text-sm font-semibold text-slate-700";
  consistencyTitle.textContent = "ตรวจความสอดคล้องรายวัน (แผน / เช็คชื่อ / รายงาน)";
  wrap.appendChild(consistencyTitle);

  const consistencyWrap = document.createElement("div");
  consistencyWrap.innerHTML = renderDailyConsistencyTable(row.dailyConsistency);
  wrap.appendChild(consistencyWrap);

  const listTitle = document.createElement("h4");
  listTitle.className = "text-sm font-semibold text-slate-700";
  listTitle.textContent = `แผนการฝึกซ้อมที่ส่งเดือนนี้ (${row.plans.length} รายการ) — คลิกเพื่อดูรายละเอียด`;
  wrap.appendChild(listTitle);

  if (row.plans.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-slate-400";
    empty.textContent = "ยังไม่มีแผนที่ส่งเดือนนี้";
    wrap.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "space-y-1.5";
    for (const plan of row.plans) {
      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "w-full text-left card card-pad py-2 px-3 hover:bg-slate-50 flex items-center justify-between gap-3 flex-wrap";
      item.innerHTML = `
        <span class="text-sm">
          <span class="emphasis">${plan.date ?? "-"}</span>
          <span class="text-slate-500"> — ${plan.trainingType ?? "-"} • ${(plan.ageGroups || []).join(", ") || "-"}</span>
        </span>
        ${trainingPlanSubmissionStatus(plan)}
      `;
      item.addEventListener("click", () => renderPlanDetailModal(plan));
      list.appendChild(item);
    }
    wrap.appendChild(list);
  }

  const reportListTitle = document.createElement("h4");
  reportListTitle.className = "text-sm font-semibold text-slate-700";
  reportListTitle.textContent = `รายงานการฝึกซ้อมที่ส่งเดือนนี้ (${row.reports.length} รายการ) — คลิกเพื่อดูรายละเอียด`;
  wrap.appendChild(reportListTitle);

  if (row.reports.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-slate-400";
    empty.textContent = "ยังไม่มีรายงานที่ส่งเดือนนี้";
    wrap.appendChild(empty);
  } else {
    const reportList = document.createElement("div");
    reportList.className = "space-y-1.5";
    for (const report of row.reports) {
      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "w-full text-left card card-pad py-2 px-3 hover:bg-slate-50 flex items-center justify-between gap-3 flex-wrap";
      const attendedBadge =
        report.attended === true
          ? '<span class="badge badge-success">มีการซ้อม</span>'
          : report.attended === false
            ? '<span class="badge badge-warning">ไม่มีการซ้อม</span>'
            : "-";
      item.innerHTML = `
        <span class="text-sm"><span class="emphasis">${report.date ?? "-"}</span></span>
        ${attendedBadge}
      `;
      item.addEventListener("click", () => renderReportDetailModal(report));
      reportList.appendChild(item);
    }
    wrap.appendChild(reportList);
  }

  return wrap;
}

// เปิด modal ดูรายละเอียดแผนการฝึกซ้อม 1 ฉบับแบบดูอย่างเดียว (ผู้บริหารทีม/ผู้ดูแลระบบคลิกจากรายการในการ์ด
// สรุปการทำงานโค้ช) — ใช้ textContent ล้วนสำหรับค่าที่มาจากผู้ใช้ (หมายเหตุ/ชื่อไฟล์) เพื่อกัน XSS
function renderPlanDetailModal(plan) {
  coachPlanDetailTitleEl.textContent = "รายละเอียดแผนการฝึกซ้อม";
  coachPlanDetailBody.innerHTML = "";

  const fields = [
    ["วันที่", plan.date ?? "-"],
    ["โค้ชผู้ส่ง", plan.coachName ?? "-"],
    ["รุ่นอายุ", (plan.ageGroups || []).join(", ") || "-"],
    ["กลุ่มผู้เล่น", plan.playerGroup ?? "-"],
    ["ประเภทการฝึก", plan.trainingType ?? "-"],
    ["Phase", plan.phase ?? "-"]
  ];
  if (plan.competitionTopic) fields.push(["หัวข้อการแข่งขัน", plan.competitionTopic]);
  fields.push(["หัวข้อหลัก", plan.mainPart ?? "-"]);
  fields.push(["Physical", (plan.physicalFocus || []).join(", ") || "-"]);
  fields.push(["หมายเหตุ", plan.notes ?? "-"]);

  for (const [label, value] of fields) {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0";
    const labelEl = document.createElement("span");
    labelEl.className = "text-slate-400 flex-shrink-0";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "text-slate-800 text-right";
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    coachPlanDetailBody.appendChild(row);
  }

  const statusRow = document.createElement("div");
  statusRow.className = "flex justify-between gap-4 py-1.5";
  const statusLabel = document.createElement("span");
  statusLabel.className = "text-slate-400";
  statusLabel.textContent = "สถานะการส่ง";
  const statusValue = document.createElement("span");
  statusValue.innerHTML = trainingPlanSubmissionStatus(plan);
  statusRow.append(statusLabel, statusValue);
  coachPlanDetailBody.appendChild(statusRow);

  if (plan.fileUrl) {
    const fileLink = document.createElement("a");
    fileLink.href = plan.fileUrl;
    fileLink.target = "_blank";
    fileLink.rel = "noopener";
    fileLink.className = "btn btn-secondary btn-sm inline-block mt-2";
    fileLink.textContent = plan.fileName ? `📎 เปิดไฟล์แนบ: ${plan.fileName}` : "📎 เปิดไฟล์แนบ";
    coachPlanDetailBody.appendChild(fileLink);
  }

  coachPlanDetailOverlay.classList.remove("hidden");
}

// เปิด modal ดูรายละเอียดรายงานการฝึกซ้อม 1 ฉบับแบบดูอย่างเดียว (ผู้บริหารทีม/ผู้ดูแลระบบคลิกจากรายการในการ์ด
// สรุปการทำงานโค้ช) — ใช้ overlay เดียวกับรายละเอียดแผนการฝึกซ้อม (renderPlanDetailModal), formatReportPeriodForDaily
// อยู่ท้ายไฟล์แต่เรียกใช้ได้ที่นี่เพราะ function declaration ถูก hoist
function renderReportDetailModal(report) {
  coachPlanDetailTitleEl.textContent = "รายละเอียดรายงานการฝึกซ้อม";
  coachPlanDetailBody.innerHTML = "";

  const attendedText = report.attended === true ? "มีการซ้อม" : report.attended === false ? "ไม่มีการซ้อม" : "-";

  const fields = [
    ["วันที่", report.date ?? "-"],
    ["โค้ชผู้ส่ง", report.coachName ?? "-"],
    ["สถานะ", attendedText],
    ["ช่วงเวลาฝึกซ้อม", formatReportPeriodForDaily(report)],
    ["หมายเหตุ", report.notes ?? "-"]
  ];

  for (const [label, value] of fields) {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0";
    const labelEl = document.createElement("span");
    labelEl.className = "text-slate-400 flex-shrink-0";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "text-slate-800 text-right";
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    coachPlanDetailBody.appendChild(row);
  }

  // รูปภาพจากการฝึกซ้อมมีเฉพาะทีม THAWEE SC (ดู REPORT_PHOTO_TEAM) รายงานของทีมอื่นจะไม่มีฟิลด์นี้เลย
  if (Array.isArray(report.photos) && report.photos.length > 0) {
    const photoWrap = document.createElement("div");
    photoWrap.className = "flex flex-wrap gap-2 mt-2";
    for (const photo of report.photos) {
      const link = document.createElement("a");
      link.href = photo.url;
      link.target = "_blank";
      link.rel = "noopener";
      const img = document.createElement("img");
      img.src = photo.url;
      img.alt = photo.name || "รูปการฝึกซ้อม";
      img.className = "w-20 h-20 object-cover rounded-lg border border-slate-200";
      link.appendChild(img);
      photoWrap.appendChild(link);
    }
    coachPlanDetailBody.appendChild(photoWrap);
  }

  coachPlanDetailOverlay.classList.remove("hidden");
}

coachPlanDetailCloseBtn.addEventListener("click", () => coachPlanDetailOverlay.classList.add("hidden"));
coachPlanDetailOverlay.addEventListener("click", (e) => {
  if (e.target === coachPlanDetailOverlay) coachPlanDetailOverlay.classList.add("hidden");
});

// ตารางสรุปการทำงานของโค้ชแต่ละคน — คลิกที่แถวเพื่อขยายดูรายละเอียด (สถิติละเอียด/กราฟแนวโน้ม/รายการแผนที่ส่ง)
function renderCoachActivitySummaryTable(containerEl, rows) {
  if (rows.length === 0) {
    containerEl.innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีโค้ชในทีมนี้</p>';
    return;
  }
  containerEl.innerHTML = `
    <div class="card table-wrap">
      <table class="pro-table">
        <thead>
          <tr>
            <th>โค้ช</th>
            <th>ตำแหน่ง/รุ่นอายุ</th>
            <th title="จำนวนวันที่เช็คชื่อเดือนนี้ (%ตรงเวลาก่อน 23:59 น.)">เช็คชื่อเดือนนี้</th>
            <th>รายงานการฝึกซ้อม</th>
            <th>แผนการฝึกซ้อม</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  const tbody = containerEl.querySelector("tbody");
  for (const r of rows) {
    const onTimePercent = r.checkinDays > 0 ? Math.round((r.onTimeCount / r.checkinDays) * 100) : null;
    const checkinText = r.checkinDays > 0 ? `${r.checkinDays} วัน (${onTimePercent}% ตรงเวลา)` : "ยังไม่ได้เช็คชื่อ";
    const planText =
      r.planCount > 0 ? `${r.planCount} ครั้ง${r.planLateCount > 0 ? ` (สาย ${r.planLateCount})` : ""}` : "ยังไม่ได้ส่ง";

    const mainRow = document.createElement("tr");
    mainRow.className = "cursor-pointer";
    mainRow.innerHTML = `
      <td class="emphasis"><span class="inline-block w-3 text-slate-400" data-toggle-arrow>▸</span> ${r.coachName}</td>
      <td>${coachPositionLabel(r.coachPosition)} (${r.ageGroups.join(", ") || "-"})</td>
      <td>${checkinText}</td>
      <td>${r.reportCount > 0 ? `${r.reportCount} วัน` : "ยังไม่ได้ส่ง"}</td>
      <td>${planText}</td>
    `;

    const detailRow = document.createElement("tr");
    detailRow.className = "hidden";
    const detailTd = document.createElement("td");
    detailTd.colSpan = 5;
    detailTd.className = "bg-slate-50 px-4 py-4";
    detailRow.appendChild(detailTd);

    let expanded = false;
    mainRow.addEventListener("click", () => {
      expanded = !expanded;
      mainRow.querySelector("[data-toggle-arrow]").textContent = expanded ? "▾" : "▸";
      detailRow.classList.toggle("hidden", !expanded);
      if (expanded && detailTd.children.length === 0) {
        detailTd.appendChild(renderCoachDetailContent(r));
      }
    });

    tbody.appendChild(mainRow);
    tbody.appendChild(detailRow);
  }
  applyDataLabels(tbody);
}

function formatCoachActivitySummaryText(team, rows) {
  const monthLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long" });
  const lines = [`สรุปการทำงานของโค้ชทีม ${team} ประจำเดือน${monthLabel}:`, ""];
  for (const r of rows) {
    const onTimePercent = r.checkinDays > 0 ? Math.round((r.onTimeCount / r.checkinDays) * 100) : null;
    const checkinText = r.checkinDays > 0 ? `เช็คชื่อ ${r.checkinDays} วัน (${onTimePercent}% ตรงเวลา)` : "ยังไม่ได้เช็คชื่อ";
    const reportText = r.reportCount > 0 ? `ส่งรายงานฝึกซ้อม ${r.reportCount} วัน` : "ยังไม่ได้ส่งรายงานฝึกซ้อม";
    const planText =
      r.planCount > 0
        ? `ส่งแผนฝึกซ้อม ${r.planCount} ครั้ง${r.planLateCount > 0 ? ` (สาย ${r.planLateCount})` : ""}`
        : "ยังไม่ได้ส่งแผนฝึกซ้อม";
    lines.push(
      `${r.coachName} (${coachPositionLabel(r.coachPosition)}, ${r.ageGroups.join(", ") || "-"}): ${checkinText} • ${reportText} • ${planText}`
    );
  }
  return lines.join("\n");
}

// เรียกจากหน้าสรุปของผู้บริหารทีมเอง (real executive หรือผู้ดูแลระบบที่สวมบทบาท) — ดูได้เองแบบ passive
async function loadCoachActivitySummary(team) {
  executiveCoachSummary.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const rows = await computeCoachMonthlySummaryRows(team);
    renderCoachActivitySummaryTable(executiveCoachSummary, rows);
  } catch (err) {
    console.error(err);
    executiveCoachSummary.innerHTML = `<p class="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: ${err.message}</p>`;
  }
}

// เรียกจากปุ่ม "ส่งสรุปการทำงานโค้ชให้ผู้บริหารทีม" ในหน้ารายชื่อโค้ชของผู้ดูแลระบบ — แบบ push แจ้งเตือนไปที่
// executiveNotes ของทีมนั้น (ผู้บริหารทีมเห็นในกล่อง "ข้อความจากผู้ดูแลระบบ" ทันที ไม่ต้องรอเข้ามาดูเอง)
async function sendCoachActivitySummaryToExecutive(team, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "กำลังส่ง...";
  try {
    const rows = await computeCoachMonthlySummaryRows(team);
    if (rows.length === 0) {
      alert(`ทีม ${team} ยังไม่มีโค้ชในระบบ ไม่มีข้อมูลจะส่ง`);
      return;
    }
    await sendExecutiveNote({
      team,
      type: "summary",
      refId: null,
      refLabel: "สรุปการทำงานของโค้ชประจำเดือนนี้",
      message: formatCoachActivitySummaryText(team, rows),
      createdBy: adminOwnName
    });
    alert(`ส่งสรุปการทำงานของโค้ชให้ผู้บริหารทีม ${team} แล้ว ✓`);
  } catch (err) {
    console.error(err);
    alert("ส่งไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ---------- ผู้ดูแลระบบ: ตรวจสอบข้อมูลนักกีฬาที่ผิดปกติ ----------
// สแกนนักกีฬาทุกทีม ชี้เป้า 2 ปัญหาที่มักเกิดจากการกรอกข้อมูลพลาด: (1) ไม่ได้เลือกรุ่นอายุตอนเพิ่มนักกีฬา
// (ฟอร์มเดิมไม่บังคับเลือก แก้ไปแล้วให้บังคับเลือกสำหรับนักกีฬาใหม่ แต่คนเก่าที่เคยเพิ่มไว้ก่อนหน้ายังต้องมาไล่แก้
// เอง) และ (2) วันเกิดที่คำนวณอายุแล้วดูผิดปกติ (เช่น พิมพ์ปี พ.ศ. เข้าไปในช่องแทนที่จะเป็น ค.ศ. ทำให้อายุคำนวณ
// ได้ติดลบหรือมากผิดปกติ — input[type=date] ของเบราว์เซอร์เก็บค่าเป็น ค.ศ. เสมออยู่แล้ว ปัญหาจึงมักมาจากข้อมูล
// เก่าที่นำเข้ามาแบบอื่น ไม่ใช่จากฟอร์มนี้โดยตรง) — แก้ไขได้ทันทีในตารางโดยไม่ต้องสวมบทบาทเข้าไปทีละทีม
const PLAYER_AUDIT_AGE_GROUPS = ["U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];
const PLAYER_AUDIT_MIN_AGE = 3;
const PLAYER_AUDIT_MAX_AGE = 22;

function playerAuditIssues(p, age) {
  const issues = [];
  if (!p.ageGroup) issues.push("ไม่ระบุรุ่นอายุ");
  if (p.birthday && (age === null || age < PLAYER_AUDIT_MIN_AGE || age > PLAYER_AUDIT_MAX_AGE)) {
    issues.push(age === null ? "วันเกิดอ่านค่าไม่ได้" : `วันเกิดผิดปกติ (อายุคำนวณได้ ${age} ปี)`);
  }
  return issues;
}

// ถ้าวันเกิดดูผิดปกติ ลองเดาว่าน่าจะเป็นปี พ.ศ. ที่กรอกเข้าไปตรงๆ แทนที่จะแปลงเป็น ค.ศ. ก่อน (ปี พ.ศ. = ค.ศ. + 543
// เช่น 2560 แทนที่จะเป็น 2017) — ลองลบ 543 ออกจากปีแล้วเช็คว่าอายุที่ได้จากค่าที่แก้แล้วอยู่ในช่วงที่สมเหตุสมผล
// หรือไม่ ถ้าใช่ค่อยคืนวันที่ที่แก้แล้วออกไปเป็นคำแนะนำ (ยังต้องให้แอดมินตรวจสอบแล้วกดบันทึกเองอยู่ดี ไม่ได้แก้
// ฐานข้อมูลจริงให้อัตโนมัติ) — คืน null ถ้าลบ 543 แล้วยังดูผิดปกติอยู่ (ไม่ใช่ปัญหาปฏิทิน พ.ศ./ค.ศ. แน่ๆ)
function suggestedBirthdayFix(birthday, age) {
  if (!birthday || age === null) return null;
  const match = /^(\d{4})(-\d{2}-\d{2})$/.exec(birthday);
  if (!match) return null;
  const fixedDate = `${Number(match[1]) - 543}${match[2]}`;
  const fixedAge = calcAge(fixedDate);
  return fixedAge !== null && fixedAge >= PLAYER_AUDIT_MIN_AGE && fixedAge <= PLAYER_AUDIT_MAX_AGE ? fixedDate : null;
}

function playerAuditRowHtml(p) {
  const rawAge = calcAge(p.birthday);
  const birthdayAbnormal = Boolean(p.birthday) && (rawAge === null || rawAge < PLAYER_AUDIT_MIN_AGE || rawAge > PLAYER_AUDIT_MAX_AGE);
  const suggestedBirthday = birthdayAbnormal ? suggestedBirthdayFix(p.birthday, rawAge) : null;
  // ถ้าเดาได้ว่าเป็นปัญหา พ.ศ./ค.ศ. ให้ใส่ค่าที่แก้แล้วในช่องให้เลยเพื่อความรวดเร็ว (แค่ตรวจสอบแล้วกดบันทึก
  // ไม่ต้องพิมพ์วันที่ใหม่เอง) — ถ้าเดาไม่ได้ก็ยังโชว์ค่าเดิมไว้ให้แก้เอง
  const displayBirthday = suggestedBirthday || p.birthday || "";
  const displayAge = calcAge(displayBirthday);

  const issues = [];
  if (!p.ageGroup) issues.push("ไม่ระบุรุ่นอายุ");
  if (birthdayAbnormal) {
    issues.push(
      suggestedBirthday
        ? "🔧 พบว่าน่าจะกรอกปี พ.ศ. ในวันเกิด — ปรับเป็น ค.ศ. ให้อัตโนมัติแล้ว โปรดตรวจสอบก่อนบันทึก"
        : rawAge === null
          ? "วันเกิดอ่านค่าไม่ได้"
          : `วันเกิดผิดปกติ (อายุคำนวณได้ ${rawAge} ปี)`
    );
  }

  const ageGroupOptions = PLAYER_AUDIT_AGE_GROUPS
    .map((ag) => `<option value="${ag}"${p.ageGroup === ag ? " selected" : ""}>${ag}</option>`)
    .join("");
  return `
    <tr data-player-id="${p.id}">
      <td>${teamLogoImg(p.team)}${p.team ?? "-"}</td>
      <td class="emphasis">${p.nickname ?? p.fullName ?? "-"}</td>
      <td><input type="date" class="field-input" data-audit-birthday value="${displayBirthday}" /></td>
      <td data-audit-age-display>${displayAge !== null ? `${displayAge} ปี` : "-"}</td>
      <td><select class="field-input" data-audit-age-group><option value="">-- เลือกรุ่นอายุ --</option>${ageGroupOptions}</select></td>
      <td>${issues.map((i) => `<span class="badge badge-warning">${i}</span>`).join(" ")}</td>
      <td><button type="button" class="btn btn-primary btn-sm" data-audit-save>บันทึก</button></td>
    </tr>`;
}

async function loadPlayerAudit() {
  playerAuditStatus.textContent = "กำลังโหลด...";
  playerAuditBody.innerHTML =
    '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  try {
    const snap = await getDocs(collection(db, "players"));
    const players = [];
    snap.forEach((d) => players.push({ id: d.id, ...d.data() }));

    const flagged = players.filter((p) => playerAuditIssues(p, calcAge(p.birthday)).length > 0);
    flagged.sort(
      (a, b) => (a.team ?? "").localeCompare(b.team ?? "") || ageGroupNumber(a.ageGroup) - ageGroupNumber(b.ageGroup)
    );

    if (flagged.length === 0) {
      playerAuditStatus.textContent = `ตรวจสอบนักกีฬาทั้งหมด ${players.length} คนแล้ว ไม่พบข้อมูลที่ผิดปกติ ✓`;
      playerAuditBody.innerHTML =
        '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ไม่พบนักกีฬาที่ข้อมูลผิดปกติ</td></tr>';
      return;
    }

    playerAuditStatus.textContent = `พบนักกีฬา ${flagged.length} คน (จากทั้งหมด ${players.length} คน) ที่ข้อมูลอาจไม่ถูกต้อง — แก้ไขแล้วกด "บันทึก" ทีละแถวได้เลย`;
    playerAuditBody.innerHTML = flagged.map(playerAuditRowHtml).join("");
  } catch (err) {
    console.error(err);
    playerAuditStatus.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
    playerAuditBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">โหลดไม่สำเร็จ</td></tr>';
  }
}

// อัปเดตคอลัมน์ "อายุที่คำนวณได้" สดๆ ตอนแก้วันเกิดในตาราง (ก่อนกดบันทึก) ให้เห็นผลทันทีว่าค่าที่แก้ดูสมเหตุสมผล
// หรือยัง และกดบันทึกทีละแถวด้วย event delegation เพราะแถวถูกสร้างใหม่ทุกครั้งที่โหลด — บันทึกสำเร็จแล้วลบแถว
// นั้นออกจากตารางเลย (ไม่ต้องโหลดใหม่ทั้งหมด) เพราะแก้ไขแล้วก็ไม่ผิดปกติอีกต่อไป
playerAuditBody.addEventListener("input", (e) => {
  if (!e.target.matches("[data-audit-birthday]")) return;
  const tr = e.target.closest("tr");
  const age = calcAge(e.target.value);
  tr.querySelector("[data-audit-age-display]").textContent = age !== null ? `${age} ปี` : "-";
});

playerAuditBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-audit-save]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const playerId = tr.dataset.playerId;
  const birthday = tr.querySelector("[data-audit-birthday]").value || null;
  const ageGroup = tr.querySelector("[data-audit-age-group]").value || null;

  if (!ageGroup) {
    alert("กรุณาเลือกรุ่นอายุก่อนบันทึก");
    return;
  }

  btn.disabled = true;
  btn.textContent = "กำลังบันทึก...";
  try {
    await updateDoc(doc(db, "players", playerId), { birthday, ageGroup });
    tr.remove();
    if (playerAuditBody.children.length === 0) {
      playerAuditStatus.textContent = "แก้ไขครบทุกรายการแล้ว ✓";
      playerAuditBody.innerHTML =
        '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">ไม่พบนักกีฬาที่ข้อมูลผิดปกติ</td></tr>';
    }
  } catch (err) {
    console.error(err);
    alert("บันทึกไม่สำเร็จ: " + err.message);
    btn.disabled = false;
    btn.textContent = "บันทึก";
  }
});

function openAdminPlayerAuditSection() {
  hideAllScreens();
  adminPlayerAuditSection.classList.remove("hidden");
  loadPlayerAudit();
}

// ---------- ผู้ดูแลระบบ: แก้ไขบัญชีผู้ใช้คนอื่น (ชื่อ/บทบาท/ทีม/รุ่นอายุ/สถานะ) ----------
// Firestore rules อนุญาต isAdmin() ให้ update เอกสาร coaches ได้ทุกฟิลด์อยู่แล้ว (allow update: if isAdmin();)
// จึงไม่ต้องแก้ rules เพิ่ม — อีเมลปิดแก้ไขไว้เพราะเป็นบัญชี Firebase Auth จริง แก้แค่ฟิลด์ใน Firestore
// จะทำให้ข้อมูลไม่ตรงกับอีเมลที่ใช้ล็อกอินจริง
let editingCoachAccountId = null;

function updateEditCoachFieldVisibility() {
  const role = editCoachRoleSelect.value;
  editCoachTeamWrap.classList.toggle("hidden", role === "admin");
  editCoachAgeGroupWrap.classList.toggle("hidden", role !== "coach");
}

function openEditCoachModal(c) {
  editingCoachAccountId = c.id;
  editCoachNameInput.value = c.name || "";
  editCoachEmailInput.value = c.email || "";
  editCoachRoleSelect.value = c.role || "coach";
  populateTeamSelect(editCoachTeamSelect, "-- ไม่ระบุทีม --");
  editCoachTeamSelect.value = c.team || "";
  editCoachPositionSelect.value = c.coachPosition || "head_coach";
  const ageGroups = c.ageGroups || [];
  for (const cb of editCoachAgeGroupCheckboxes) {
    cb.checked = ageGroups.includes(cb.value);
  }
  editCoachStatusSelect.value = c.status || "pending";
  updateEditCoachFieldVisibility();
  editCoachModalStatus.textContent = "";
  editCoachOverlay.classList.remove("hidden");
}

function closeEditCoachModal() {
  editCoachOverlay.classList.add("hidden");
  editingCoachAccountId = null;
}

editCoachRoleSelect.addEventListener("change", updateEditCoachFieldVisibility);
editCoachCloseBtn.addEventListener("click", closeEditCoachModal);
editCoachCancelBtn.addEventListener("click", closeEditCoachModal);
editCoachOverlay.addEventListener("click", (e) => {
  if (e.target === editCoachOverlay) closeEditCoachModal();
});

editCoachSaveBtn.addEventListener("click", async () => {
  if (!editingCoachAccountId) return;
  const role = editCoachRoleSelect.value;
  const name = editCoachNameInput.value.trim();
  if (!name) {
    editCoachModalStatus.textContent = "กรุณากรอกชื่อ";
    editCoachModalStatus.className = "text-sm text-red-600";
    return;
  }
  // เลื่อนขั้นเป็นผู้ดูแลระบบเป็นการกระทำที่มีผลกระทบสูง (ให้สิทธิ์เข้าถึงข้อมูลทุกทีมทันที) จึงขอยืนยันซ้ำ
  if (role === "admin") {
    const ok = confirm(`ยืนยันปรับบัญชี "${name}" เป็นผู้ดูแลระบบ? บัญชีนี้จะเข้าถึงข้อมูลของทุกทีมได้ทันที`);
    if (!ok) return;
  }
  // ผู้ดูแลระบบเลือกได้หลายรุ่นแม้เป็น Head Coach — ไม่บังคับจำกัดจำนวนแบบตอนโค้ชลงทะเบียนเอง
  const ageGroups =
    role === "coach" ? Array.from(editCoachAgeGroupCheckboxes).filter((cb) => cb.checked).map((cb) => cb.value) : [];
  const payload = {
    name,
    role,
    status: editCoachStatusSelect.value,
    team: role === "admin" ? null : editCoachTeamSelect.value || null,
    ageGroups: role === "coach" ? ageGroups : null,
    coachPosition: role === "coach" ? editCoachPositionSelect.value : null
  };
  try {
    editCoachModalStatus.textContent = "กำลังบันทึก...";
    editCoachModalStatus.className = "text-sm text-slate-500";
    await updateDoc(doc(db, "coaches", editingCoachAccountId), payload);
    editCoachModalStatus.textContent = "บันทึกสำเร็จ ✓";
    editCoachModalStatus.className = "text-sm text-emerald-600";
    await loadCoachDirectory();
    setTimeout(closeEditCoachModal, 500);
  } catch (err) {
    console.error(err);
    editCoachModalStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    editCoachModalStatus.className = "text-sm text-red-600";
  }
});

// ผู้ดูแลระบบช่วยโค้ชที่ลืมรหัสผ่าน โดยส่งลิงก์รีเซ็ตไปที่อีเมลของบัญชีนั้นโดยตรง (ผู้ดูแลระบบไม่มีทาง
// เห็นหรือตั้งรหัสผ่านแทนได้เลย เพราะ Firebase Auth ไม่อนุญาตให้เปลี่ยนรหัสผ่านของบัญชีอื่นจากฝั่ง client)
editCoachResetPasswordBtn.addEventListener("click", async () => {
  const email = editCoachEmailInput.value.trim();
  if (!email) return;
  const ok = confirm(`ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} ใช่หรือไม่?`);
  if (!ok) return;
  try {
    editCoachModalStatus.textContent = "กำลังส่งอีเมล...";
    editCoachModalStatus.className = "text-sm text-slate-500";
    await sendPasswordResetEmail(auth, email);
    editCoachModalStatus.textContent = `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} แล้ว ✓`;
    editCoachModalStatus.className = "text-sm text-emerald-600";
  } catch (err) {
    console.error(err);
    editCoachModalStatus.textContent = "ส่งอีเมลไม่สำเร็จ: " + (err.code ? authErrorMessage(err) : err.message);
    editCoachModalStatus.className = "text-sm text-red-600";
  }
});

// ลบเฉพาะโปรไฟล์ใน Firestore (coaches/{uid}) — Firebase Auth ไม่อนุญาตให้ลบบัญชีผู้ใช้อื่นจากฝั่ง client
// เหมือนกัน (ต้องใช้ Admin SDK ฝั่งเซิร์ฟเวอร์) ผลคือบัญชีนั้นจะล็อกอินเข้าเว็บไม่ได้อีก (ระบบมองว่าไม่มีโปรไฟล์
// จึงค้างที่หน้า "รอผู้ดูแลระบบอนุมัติ" ตลอดไป) เหมือนกับตอนกดปฏิเสธคำขอลงทะเบียนที่ทำแบบนี้อยู่แล้ว
editCoachDeleteBtn.addEventListener("click", async () => {
  if (!editingCoachAccountId) return;
  if (editingCoachAccountId === auth.currentUser?.uid) {
    alert("ไม่สามารถลบบัญชีของตัวเองได้");
    return;
  }
  const name = editCoachNameInput.value.trim() || editCoachEmailInput.value.trim() || "บัญชีนี้";
  const ok = confirm(`ยืนยันลบบัญชี "${name}" ออกจากระบบถาวร? การลบนี้ไม่สามารถย้อนกลับได้ และบัญชีนี้จะเข้าสู่ระบบไม่ได้อีก`);
  if (!ok) return;
  try {
    editCoachModalStatus.textContent = "กำลังลบ...";
    editCoachModalStatus.className = "text-sm text-slate-500";
    await deleteDoc(doc(db, "coaches", editingCoachAccountId));
    editCoachModalStatus.textContent = "ลบบัญชีสำเร็จ ✓";
    editCoachModalStatus.className = "text-sm text-emerald-600";
    await loadCoachDirectory();
    setTimeout(closeEditCoachModal, 500);
  } catch (err) {
    console.error(err);
    editCoachModalStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    editCoachModalStatus.className = "text-sm text-red-600";
  }
});

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

// วาดตารางความคืบหน้าของแถวที่ส่งมา (ใช้ซ้ำได้ทั้งตอนโหลดครั้งแรกและตอนสลับปุ่มเลือกทีม)
function renderProgressTable(rows) {
  progressTableBody.innerHTML = "";
  if (rows.length === 0) {
    progressTableBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
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
}

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
    progressTeamTabs.classList.add("hidden");
    progressTeamTabs.innerHTML = "";
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
      // นับเฉพาะนักกีฬาในรุ่นอายุ (และตำแหน่งถ้าเป็น GK Coach) ที่โค้ชคนนี้รับผิดชอบจริง ไม่ใช่นักกีฬาทั้งทีม
      // (ทีมหนึ่งมีหลายรุ่นอายุ/หลายโค้ชดูแลคนละรุ่น — sessions/attendance ยังผูกกับ "ทีม" ทั้งก้อนต่อวัน)
      const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const myPlayerIds = getCoachPlayerIds(c, players);
      const totalPlayers = myPlayerIds.size;

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
        .filter((a) => myPlayerIds.has(a.playerId) && isPlayerFullyEvaluated(a));
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

  // เรียงตามลำดับทีม (TEAMS) แล้วตามรุ่นอายุน้อยไปมากภายในทีมเดียวกัน
  rows.sort((a, b) => {
    const teamDiff = TEAMS.indexOf(a.coach.team) - TEAMS.indexOf(b.coach.team);
    return teamDiff !== 0 ? teamDiff : ageGroupSortKey(a.coach.ageGroups) - ageGroupSortKey(b.coach.ageGroups);
  });

  // เลือกดูทีละทีมผ่านปุ่มแทนการแสดงทุกทีมพร้อมกัน โดย default เลือกทีมแรกให้อัตโนมัติ
  const teamsPresent = Array.from(new Set(rows.map((r) => r.coach.team)));
  progressTeamTabs.classList.remove("hidden");
  progressTeamTabs.innerHTML = "";

  function showTeam(team, btn) {
    for (const tabBtn of progressTeamTabs.children) {
      tabBtn.classList.toggle("btn-primary", tabBtn === btn);
      tabBtn.classList.toggle("btn-secondary", tabBtn !== btn);
    }
    const teamRows = rows.filter((r) => r.coach.team === team);
    renderProgressTable(teamRows);
    renderProgressPie(teamRows);
  }

  for (const team of teamsPresent) {
    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.className = "btn btn-secondary btn-sm";
    tabBtn.innerHTML = `${teamLogoImg(team)}${team}`;
    tabBtn.addEventListener("click", () => showTeam(team, tabBtn));
    progressTeamTabs.appendChild(tabBtn);
  }
  // ถ้ามาจากลิงก์แจ้งเตือนที่ระบุทีมไว้ (#admin=progress&team=...) ให้เปิดทีมนั้นให้ทันทีแทนทีมแรกตามลำดับปกติ
  // เพื่อให้ผู้ดูแลระบบดำเนินการต่อจากที่คลิกแจ้งเตือนได้เลยโดยไม่ต้องไล่หาทีมเอง
  const linkedTeam = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("team");
  const defaultIndex = linkedTeam ? teamsPresent.indexOf(linkedTeam) : -1;
  const startIndex = defaultIndex >= 0 ? defaultIndex : 0;
  showTeam(teamsPresent[startIndex], progressTeamTabs.children[startIndex]);
}

function categorizeProgress(r) {
  if (r.noTraining) return "no_training";
  if (r.totalPlayers === 0) return null; // ยังไม่มีนักกีฬาในรุ่นที่ดูแล ไม่นับในภาพรวม
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

// หาบัญชีโค้ช/ผู้บริหารทีมตัวจริงของทีมนี้ (ถ้ามี) เพื่อเอาชื่อ/อีเมล/สถานะจริงมาแสดง แทนที่จะค้างเป็น
// ข้อมูลของผู้ดูแลระบบเอง — ให้หน้าจอตอนสวมบทบาทตรงกับที่เจ้าของบัญชีจริงเห็น 100% ไม่มีร่องรอยของผู้ดูแลระบบ
// หลงเหลือให้สับสน จนกว่าจะกดกลับแผงควบคุมผู้ดูแลระบบ
// ถ้ามีโค้ชหลายคนตรงเงื่อนไข (role="coach") ให้เลือก Head Coach ก่อน Assistant Coach ก่อนตำแหน่งอื่น (แทนที่จะ
// เอาคนแรกที่เจอแบบสุ่มตามลำดับ query) เพื่อให้ "โค้ชตัวแทนทีม" ที่แสดงตอนสวมบทบาทแบบกว้าง (ไม่เจาะจงคน — ดู
// coachRecordOverride ใน enterTeamManagementMode) สอดคล้องกับหลักการเดียวกับ buildCoachNameByAgeGroup ใน
// app.js ที่ให้สิทธิ์ Head Coach เหนือกว่า Assistant Coach เสมอ
async function findCoachRecordForTeam(team, role) {
  const snap = await getDocs(
    query(
      collection(db, "coaches"),
      where("team", "==", team),
      where("role", "==", role),
      where("status", "==", "approved")
    )
  );
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => d.data());
  if (role !== "coach") return docs[0];
  const priority = { head_coach: 0, assistant_coach: 1 };
  docs.sort((a, b) => (priority[a.coachPosition] ?? 2) - (priority[b.coachPosition] ?? 2));
  return docs[0];
}

// coachRecordOverride: ระบุได้เมื่อรู้ตัวโค้ชที่ต้องการสวมบทบาทแน่ชัดอยู่แล้ว (เช่น คลิกชื่อโค้ชคนใดคนหนึ่งใน
// รายชื่อโค้ช) เพื่อไม่ให้ไปหลงเอาโค้ชคนแรกที่เจอในทีมมาแสดงผิดคน (ทีมหนึ่งมีโค้ชได้หลายคนคนละรุ่นอายุ) ถ้าไม่ระบุ
// จะ fallback ไปหาโค้ชคนแรกของทีมเหมือนเดิม (ใช้ตอนกดจากปุ่ม "จัดการทีมนี้ →" ซึ่งไม่ได้เจาะจงคนใดคนหนึ่ง)
async function enterTeamManagementMode(team, returnSection, coachRecordOverride) {
  myTeam = team;
  adminViewingAs = "coach";
  const coachRecord = coachRecordOverride || (await findCoachRecordForTeam(team, "coach"));
  // ถ้าเจาะจงโค้ชคนใดคนหนึ่ง (coachRecordOverride — คลิกชื่อโค้ชคนนั้นมาโดยตรง) จำกัด myAgeGroups ตามรุ่นอายุ
  // ที่โค้ชคนนั้นรับผิดชอบจริง เพื่อให้เห็นเฉพาะนักกีฬารุ่นที่ดูแล ตรงกับหน้าจอที่โค้ชคนนั้นเห็นจริง 100% แต่ถ้าเป็น
  // การจัดการทีมแบบกว้างผ่านปุ่ม "จัดการทีมนี้ →" (ไม่ได้เจาะจงคนใดคนหนึ่ง) ให้เข้าถึงได้ทุกรุ่นอายุของทีมเหมือนเดิม
  myAgeGroups = coachRecordOverride ? coachRecord?.ageGroups || [] : [];
  myCoachPosition = coachRecordOverride ? coachRecord?.coachPosition || null : null;
  myCoachName = coachRecord?.name || auth.currentUser?.email;
  // แสดงชื่อ/อีเมล/สถานะ/รุ่นอายุของโค้ชตัวจริง (ถ้าหาเจอ) แทนข้อมูลของผู้ดูแลระบบเอง เพื่อให้หน้าจอเหมือนที่โค้ช
  // จริงเห็นทุกประการเวลาสวมบทบาทเข้ามาทดสอบ/ตรวจสอบระบบ — สลับกลับตอนออกจากโหมดนี้ที่ exitTeamManagementToAdminPanel()
  coachNameEl.textContent = coachRecord?.name || team;
  coachEmailEl.textContent = coachRecord?.email || "-";
  coachStatusBadgeEl.innerHTML = '<span class="badge badge-success">อนุมัติแล้ว</span>';
  coachRoleBadgeEl.textContent = "โค้ช";
  coachRoleBadgeEl.className = "badge badge-success";
  coachTeamEl.innerHTML = `${teamLogoImg(team)}${team}`;
  coachAgeGroupsWrap.classList.remove("hidden");
  // ใช้ ageGroups ของโค้ชคนนั้นโดยตรงจาก Firestore (ไม่ใช้รุ่นอายุที่ปรากฏในรายชื่อนักกีฬาของทั้งทีม เพราะ
  // ทีมหนึ่งมีนักกีฬาหลายรุ่น อาจไม่ตรงกับรุ่นที่โค้ชคนนี้รับผิดชอบจริง)
  coachAgeGroupsEl.textContent = coachRecord?.ageGroups?.length ? coachRecord.ageGroups.join(", ") : "-";
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
async function enterExecutiveViewMode(team, returnSection, execRecordOverride) {
  myTeam = team;
  myAgeGroups = [];
  myCoachPosition = null;
  adminViewingAs = "executive";
  const execRecord = execRecordOverride || (await findCoachRecordForTeam(team, "executive"));
  // แสดงชื่อ/อีเมล/สถานะของผู้บริหารทีมตัวจริง (ถ้าหาเจอ) แทนข้อมูลของผู้ดูแลระบบเอง เหมือนกับโหมดโค้ช
  coachNameEl.textContent = execRecord?.name || team;
  coachEmailEl.textContent = execRecord?.email || "-";
  coachStatusBadgeEl.innerHTML = '<span class="badge badge-success">อนุมัติแล้ว</span>';
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
  loadCoachActivitySummary(team);
  loadExecutiveNotes(team, executiveNotesList);
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

    // นับจำนวนครั้งที่ส่งสายแยกเป็นรายโค้ช ไม่ใช่รวมทั้งทีม เพราะโค้ชแต่ละคนดูแลคนละรุ่นอายุ การรวมกันจะ
    // แจ้งเตือนทั้งทีมทั้งที่มีแค่โค้ชบางคนที่ส่งสายบ่อย (ใช้ตรรกะเดียวกับ loadAdminNotifications ใน ui-utils.js)
    const coachGroups = new Map();
    for (const p of monthPlans) {
      const coachName = p.coachName ?? "-";
      if (!coachGroups.has(coachName)) {
        coachGroups.set(coachName, { coachName, total: 0, late: 0 });
      }
      const g = coachGroups.get(coachName);
      g.total += 1;
      if (isTrainingPlanLate(p)) g.late += 1;
    }
    const lateCoaches = Array.from(coachGroups.values()).filter((g) => g.late > TRAINING_PLAN_LATE_WARNING_THRESHOLD);

    executiveStatCards.innerHTML =
      statCard("นักกีฬาทั้งหมด", totalPlayers) +
      statCard("% เข้าร่วมฝึกซ้อมเดือนนี้", `${attendPercent}%`) +
      statCard("คะแนนประเมินเฉลี่ยเดือนนี้", avgScore) +
      statCard("แผนฝึกซ้อมที่ส่งเดือนนี้", monthPlans.length);

    executiveLateWarning.classList.toggle("hidden", lateCoaches.length === 0);
    executiveLateCountEl.textContent = lateCoaches.length;
    executiveLateDetailEl.textContent = lateCoaches.map((g) => `${g.coachName} (สาย ${g.late}/${g.total} ครั้ง) ควรพูดคุยเรื่องมาตรฐานการส่งแผน`).join(" • ");

    executiveStatusEl.textContent = `อัปเดตข้อมูลล่าสุด • ทีม ${team}`;
  } catch (err) {
    console.error(err);
    executiveStatusEl.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
}

// ข้อความที่ผู้ดูแลระบบส่งถึงทีมนี้โดยตรง (เช่น แจ้งนักกีฬาที่มีพัฒนาการดี หรือแจ้งปัญหาของโค้ช) — ใช้ร่วมกันทั้ง
// บัญชีผู้บริหารทีมจริง (executiveNotesList ในหน้าสรุปภาพรวม), โค้ชจริง (dailyExecutiveNotesList ในหน้า Daily
// ซึ่งเป็นผู้รับผิดชอบตัวจริงที่ควรเห็นข้อความนี้ด้วย ไม่ใช่แค่ผู้บริหารทีม), และผู้ดูแลระบบที่สวมบทบาทเป็นทั้งสองแบบ
// listEl ระบุปลายทางที่จะ render (รับพารามิเตอร์แทนการฝัง element เดียวตายตัว เพราะมีสองจุดที่ต้องใช้ร่วมกัน)
let currentExecutiveNotesTeam = null;
let currentExecutiveNotesListEl = null;

async function loadExecutiveNotes(team, listEl) {
  currentExecutiveNotesTeam = team;
  currentExecutiveNotesListEl = listEl;
  listEl.innerHTML = '<p class="text-sm text-slate-400">กำลังโหลด...</p>';
  try {
    const snap = await getDocs(query(collection(db, "executiveNotes"), where("team", "==", team)));
    const notes = [];
    snap.forEach((d) => notes.push({ id: d.id, ...d.data() }));
    notes.sort((a, b) => {
      const ta = a.createdAt && typeof a.createdAt.toDate === "function" ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt && typeof b.createdAt.toDate === "function" ? b.createdAt.toDate().getTime() : 0;
      return tb - ta;
    });

    if (notes.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีข้อความจากผู้ดูแลระบบ</p>';
      return;
    }

    listEl.innerHTML = notes
      .map((n) => {
        const typeIcon = n.type === "player" ? "⭐" : n.type === "coach" ? "⚠️" : "📌";
        const postedAt =
          n.createdAt && typeof n.createdAt.toDate === "function"
            ? n.createdAt.toDate().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
            : "-";
        const unreadBadge = n.read ? "" : '<span class="badge badge-info">ใหม่</span>';
        const readBtn = n.read
          ? ""
          : `<button type="button" class="btn btn-ghost btn-sm mt-2" data-mark-read-id="${n.id}">✓ ทำเครื่องหมายว่าอ่านแล้ว</button>`;
        return `
          <div class="card card-pad${n.read ? "" : " border-2 border-blue-200"}">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <p class="font-semibold">${typeIcon} ${n.refLabel ?? "-"}</p>
              ${unreadBadge}
            </div>
            <p class="text-sm text-slate-600 mt-1 whitespace-pre-line">${n.message ?? "-"}</p>
            <p class="text-xs text-slate-400 mt-2">จาก ${n.createdBy ?? "ผู้ดูแลระบบ"} • ${postedAt}</p>
            ${readBtn}
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="text-sm text-red-600">โหลดข้อความไม่สำเร็จ: ${err.message}</p>`;
  }
}

async function handleExecutiveNoteMarkRead(e) {
  const btn = e.target.closest("[data-mark-read-id]");
  if (!btn || !currentExecutiveNotesTeam || !currentExecutiveNotesListEl) return;
  try {
    await updateDoc(doc(db, "executiveNotes", btn.dataset.markReadId), { read: true });
    await loadExecutiveNotes(currentExecutiveNotesTeam, currentExecutiveNotesListEl);
  } catch (err) {
    console.error(err);
    alert("อัปเดตไม่สำเร็จ: " + err.message);
  }
}
executiveNotesList.addEventListener("click", handleExecutiveNoteMarkRead);
dailyExecutiveNotesList.addEventListener("click", handleExecutiveNoteMarkRead);

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
// coachAgeGroupsWrap) ผู้เรียกต้องตั้งค่า coachAgeGroupsEl.textContent เองจากฟิลด์ ageGroups ของโค้ชคนนั้น
// โดยตรง (ไม่ใช้ข้อมูลจากรายชื่อนักกีฬาของทีม เพราะทีมหนึ่งมีนักกีฬาหลายรุ่น อาจไม่ตรงกับรุ่นที่โค้ชคนนี้ดูแลจริง)
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
      // เก็บชื่อ/อีเมลของผู้ดูแลระบบเองไว้ใช้คืนค่ากลับตอนออกจากโหมดสวมบทบาท (ดู exitTeamManagementToAdminPanel)
      adminOwnName = coachNameEl.textContent;
      adminOwnEmail = coachEmailEl.textContent;
      myTeam = null;
      adminReturnSection = null;
      renderDrawerItems();
      refreshNotifications();

      // หน้าแรกของผู้ดูแลระบบคือ Dashboard เสมอ — หน้านี้ (attendance.html) จะไม่แสดงแผงควบคุมเองโดย
      // อัตโนมัติอีกต่อไป เข้าถึงเครื่องมือแต่ละอย่างได้ผ่าน deep link #admin=... เท่านั้น (ลิงก์จากเมนู ☰
      // ในหน้า Dashboard หรือจากการ์ด/ปุ่มภายในหน้านี้เอง) เพื่อกันไม่ให้วน redirect ไปมา
      // ใช้ URL hash (#) แทน query string (?) เพราะเซิร์ฟเวอร์ทดสอบในเครื่อง (serve, clean-url) จะ redirect
      // "attendance.html" ไปเป็น "attendance" และตัด query string ทิ้งระหว่างทาง แต่ hash ไม่ถูกส่งไปเซิร์ฟเวอร์
      // เลยจึงไม่โดนตัด ใช้ได้ทั้งในเครื่องและบน Vercel เหมือนกัน
      const adminDeepLinks = {
        coaches: openAdminCoachesSection,
        coach: openAdminCoachDeepLink,
        progress: openAdminProgressSection,
        approvals: openAdminApprovalsSection,
        matches: openAdminMatchesSection,
        injuries: openAdminInjuriesSection,
        "manage-team": openAdminManageTeamSection,
        dashboard: openAdminDashboardSection,
        print: openAdminPrintSection,
        "player-audit": openAdminPlayerAuditSection,
        "report-card": openAdminReportCardSection,
        "masc-rounds": openAdminMascRoundsSection
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
      loadCoachActivitySummary(data.team);
      loadExecutiveNotes(data.team, executiveNotesList);
      return;
    }

    coachRoleBadgeEl.textContent = "โค้ช";
    coachRoleBadgeEl.className = "badge badge-success";
    myTeam = data.team;
    myCoachName = data.name || user.email;
    myAgeGroups = data.ageGroups || [];
    myCoachPosition = data.coachPosition || null;
    renderCoachProfile(user, data, myTeam);
    coachAgeGroupsWrap.classList.remove("hidden");
    coachAgeGroupsEl.textContent = myAgeGroups.length ? myAgeGroups.join(", ") : "-";
    adminReturnSection = null;
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    await loadPlayers();
    renderDrawerItems();
    showDaily();
  } catch (err) {
    console.error(err);
    setAttendanceStatus("โหลดข้อมูลโค้ชไม่สำเร็จ: " + err.message, true);
  }
});

// ---------- Players (เฉพาะทีมของโค้ชคนนี้) ----------
// ถ้ารู้รุ่นอายุที่รับผิดชอบแน่ชัด (myAgeGroups ไม่ว่าง — โค้ชจริงล็อกอินเอง หรือผู้ดูแลระบบสวมบทบาทเป็นโค้ช
// คนใดคนหนึ่งเจาะจง) กรองให้เห็นเฉพาะนักกีฬารุ่นที่ดูแลจริงเท่านั้น ส่วนโหมด "จัดการทีมนี้" แบบกว้าง (ไม่ผูกกับ
// โค้ชคนใดคนหนึ่ง) myAgeGroups จะว่างเปล่า จึงยังเห็นนักกีฬาทุกรุ่นของทีมเหมือนเดิม
async function loadPlayers() {
  const clauses = [where("team", "==", myTeam)];
  if (myAgeGroups.length > 0) {
    clauses.push(where("ageGroup", "in", myAgeGroups));
  }
  const q = query(collection(db, "players"), ...clauses);
  const snapshot = await getDocs(q);
  players = [];
  snapshot.forEach((docSnap) => players.push({ id: docSnap.id, ...docSnap.data() }));
  // GK Coach ดูแลเฉพาะผู้เล่นตำแหน่งผู้รักษาประตู (GK) ส่วน Head Coach/Assistant Coach จะไม่เห็นผู้เล่น
  // ตำแหน่ง GK เลย เพื่อไม่ให้ต้องเช็คชื่อ/ให้คะแนนซ้ำซ้อนกับ GK Coach
  if (myCoachPosition === "gk_coach") {
    players = players.filter((p) => p.position === "GK");
  } else if (myCoachPosition === "head_coach" || myCoachPosition === "assistant_coach") {
    players = players.filter((p) => p.position !== "GK");
  }
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
  playerPhotoInput.value = "";
  playerExistingPhotoUrl = p.photoUrl ?? null;
  playerExistingPhotoPath = p.photoPath ?? null;
  playerRemoveExistingPhoto = false;
  renderPlayerPhotoStatus();
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
  playerExistingPhotoUrl = null;
  playerExistingPhotoPath = null;
  playerRemoveExistingPhoto = false;
  renderPlayerPhotoStatus();
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
    // ลบรูปนักกีฬาใน Storage ทิ้งด้วยแบบ best-effort กันไฟล์ค้าง (ไม่บล็อกการลบเอกสารหลักถ้าลบรูปไม่สำเร็จ)
    await deleteStorageFileBestEffort(p.photoPath);
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
  let birthday = document.getElementById("player-birthday").value;
  // ช่อง input[type=date] ของเบราว์เซอร์เก็บค่าเป็น ค.ศ. เสมอ แต่โค้ชบางคนพิมพ์ปี พ.ศ. เข้าไปตรงๆ (เช่น 2560
  // แทนที่จะเป็น 2017) ทำให้อายุคำนวณผิดเพี้ยน — เช็คทันทีตอนกรอก ไม่ต้องรอให้ผู้ดูแลระบบมาตรวจพบทีหลังผ่าน
  // เครื่องมือ "ตรวจสอบข้อมูลนักกีฬาที่ผิดปกติ" (ใช้ตรรกะเดียวกัน: ลองลบ 543 ออกจากปี ถ้าอายุที่ได้สมเหตุสมผล
  // ค่อยแก้ให้อัตโนมัติ ไม่ต้องรอโค้ชพิมพ์ใหม่เอง)
  let birthdayCorrectedNote = "";
  if (birthday) {
    const enteredAge = calcAge(birthday);
    if (enteredAge === null || enteredAge < PLAYER_AUDIT_MIN_AGE || enteredAge > PLAYER_AUDIT_MAX_AGE) {
      const fixed = suggestedBirthdayFix(birthday, enteredAge);
      if (fixed) {
        birthdayCorrectedNote = ` (ปรับปีเกิดจาก พ.ศ. ${birthday.slice(0, 4)} เป็น ค.ศ. ${fixed.slice(0, 4)} ให้อัตโนมัติ)`;
        birthday = fixed;
      }
    }
  }
  const ageGroup = document.getElementById("player-age-group").value;
  const position = document.getElementById("player-position").value.trim();
  const numberNum = numberVal ? Number(numberVal) : null;

  // เบอร์/ลำดับห้ามซ้ำกันภายในรุ่นอายุเดียวกัน (ต่างรุ่นอายุใช้เบอร์เดียวกันได้ปกติ) — เช็คจากรายชื่อนักกีฬา
  // ของทีมนี้ที่โหลดไว้แล้ว ไม่รวมนักกีฬาที่กำลังแก้ไขอยู่เอง (ถ้ามี)
  if (numberNum !== null && ageGroup) {
    const duplicate = players.find(
      (p) => p.id !== editingPlayerId && p.ageGroup === ageGroup && p.number === numberNum
    );
    if (duplicate) {
      addPlayerStatus.textContent = `เบอร์/ลำดับ ${numberNum} ถูกใช้แล้วในรุ่นอายุ ${ageGroup} โดย "${duplicate.nickname ?? duplicate.fullName ?? "-"}" กรุณาเปลี่ยนเบอร์`;
      addPlayerStatus.className = "text-sm text-red-600";
      return;
    }
  }

  const selectedPhoto = playerPhotoInput.files[0] || null;
  if (selectedPhoto) {
    if (selectedPhoto.size > MAX_PLAYER_PHOTO_SIZE) {
      addPlayerStatus.textContent = "รูปใหญ่เกินไป (จำกัดไม่เกิน 5MB)";
      addPlayerStatus.className = "text-sm text-red-600";
      return;
    }
    if (!selectedPhoto.type.startsWith("image/")) {
      addPlayerStatus.textContent = "รองรับเฉพาะไฟล์รูปภาพเท่านั้น";
      addPlayerStatus.className = "text-sm text-red-600";
      return;
    }
  }

  const payload = {
    number: numberNum,
    nickname,
    fullName,
    birthday: birthday || null,
    ageGroup: ageGroup || null,
    position: position || null,
    team: myTeam
  };

  addPlayerSubmitBtn.disabled = true;
  const oldPhotoPath = playerExistingPhotoPath;
  try {
    if (selectedPhoto) {
      addPlayerStatus.textContent = "กำลังอัปโหลดรูป...";
      addPlayerStatus.className = "text-sm text-slate-500";
      const uploaded = await uploadPlayerPhoto(selectedPhoto, myTeam);
      payload.photoUrl = uploaded.url;
      payload.photoPath = uploaded.path;
    } else if (playerRemoveExistingPhoto) {
      payload.photoUrl = null;
      payload.photoPath = null;
    }
    // ถ้าไม่ได้เลือกรูปใหม่และไม่ได้กดลบรูปเดิม จะไม่ใส่ photoUrl/photoPath ใน payload เลย — updateDoc เป็น
    // partial update จึงไม่แตะฟิลด์เดิม รูปที่เพิ่มไว้ก่อนหน้ายังอยู่ครบตามเดิม

    addPlayerStatus.textContent = "กำลังบันทึก...";
    addPlayerStatus.className = "text-sm text-slate-500";

    if (editingPlayerId) {
      await updateDoc(doc(db, "players", editingPlayerId), payload);
      addPlayerStatus.textContent = `บันทึกการแก้ไข "${nickname}" สำเร็จ ✓${birthdayCorrectedNote}`;
      addPlayerStatus.className = "text-sm text-emerald-600";
      stopEditPlayer();
    } else {
      await addDoc(collection(db, "players"), { ...payload, createdAt: serverTimestamp() });
      addPlayerForm.reset();
      applyAgeGroupLock();
      playerExistingPhotoUrl = null;
      playerExistingPhotoPath = null;
      playerRemoveExistingPhoto = false;
      renderPlayerPhotoStatus();
      addPlayerStatus.textContent = `เพิ่ม "${nickname}" สำเร็จ ✓${birthdayCorrectedNote}`;
      addPlayerStatus.className = "text-sm text-emerald-600";
    }

    // ลบรูปเก่าทิ้งแบบ best-effort หลังบันทึกสำเร็จแล้วเท่านั้น (เฉพาะตอนถูกแทนที่ด้วยรูปใหม่ หรือถูกลบทิ้ง)
    if (oldPhotoPath && (selectedPhoto || payload.photoPath === null)) {
      await deleteStorageFileBestEffort(oldPhotoPath);
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
  } finally {
    addPlayerSubmitBtn.disabled = false;
  }
});

// ---------- Session (find-or-create by date + team) ----------
async function findOrCreateSession(dateStr) {
  const existing = await findSession(dateStr);
  if (existing) return existing;
  const newData = { date: dateStr, team: myTeam, createdAt: serverTimestamp() };
  const newDoc = await addDoc(collection(db, "sessions"), newData);
  return { id: newDoc.id, data: newData };
}

// ค้นหาวันซ้อมแบบอ่านอย่างเดียว ไม่สร้างเอกสารใหม่ถ้ายังไม่มี — ใช้กับปุ่ม "เรียกดู" เพื่อย้อนดูประวัติ
// โดยไม่ทิ้งเอกสาร sessions เปล่าๆ ไว้ในฐานข้อมูลสำหรับวันที่ยังไม่เคยเช็คชื่อจริง
async function findSession(dateStr) {
  const q = query(
    collection(db, "sessions"),
    where("date", "==", dateStr),
    where("team", "==", myTeam)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
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
    // ใช้คลาส space-x-2 เป็นตัวกระตุ้นให้เซลล์นี้ห่อบรรทัด/ชิดซ้ายบนมือถือ (ดู table.pro-table td.space-x-2
    // ใน styles.css) กันปุ่มสถานะ A/I/R/P ถูกบีบไปชิดขวาสุดจนล้นจอแคบ
    statusTd.className = "space-x-2";
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

    // ให้คะแนนได้เฉพาะสถานะ "มา (A)" เท่านั้น — I (บาดเจ็บ) / R (พักฟื้น) / P (ลา) ไม่จำเป็นต้องให้คะแนน (ตรงกับ
    // isPlayerFullyEvaluated ใน ui-utils.js ที่ถือว่าประเมินครบแล้วถ้าไม่ใช่ A อยู่แล้ว) — แต่ถ้ายังไม่ได้เลือก
    // สถานะเลย ต้องไม่โชว์ข้อความ "ไม่ต้องให้คะแนน" ทันที เพราะจะดูเหมือนไม่ต้องให้คะแนนใครเลยทั้งตาราง ทำให้โค้ช
    // สับสน จึงแยกเป็น 3 สถานะ: ยังไม่เลือกสถานะ (รอ) / A (ให้คะแนนได้) / I,R,P (ไม่ต้องให้คะแนน)
    const scoringAllowed = existing.status === "A";
    const statusChosen = Boolean(existing.status);
    for (const category of SCORE_CATEGORIES) {
      const catTd = document.createElement("td");
      catTd.className = "space-x-2";
      if (locked) {
        const val = scores[category.key];
        catTd.innerHTML = val
          ? `<span class="badge badge-neutral">${val}</span>`
          : '<span class="text-slate-400">-</span>';
      } else if (!statusChosen) {
        catTd.innerHTML = '<span class="text-slate-300 text-xs">เลือกสถานะก่อน</span>';
      } else if (!scoringAllowed) {
        const val = scores[category.key];
        catTd.innerHTML = val
          ? `<span class="text-slate-500">${val}</span> <span class="text-slate-300 text-xs">(ไม่บังคับ)</span>`
          : '<span class="text-slate-300 text-xs" title="ให้คะแนนได้เฉพาะสถานะ มา (A) เท่านั้น">ไม่ต้องให้คะแนน</span>';
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
    const payload = {
      playerId,
      sessionId: currentSessionId,
      team: myTeam,
      date: dateInput.value,
      status,
      updatedAt: serverTimestamp()
    };
    // ให้คะแนนได้เฉพาะสถานะ "มา (A)" เท่านั้น — ถ้าเปลี่ยนสถานะเป็นอย่างอื่น (I/R/P) ล้างคะแนนเก่าทิ้งไปด้วย
    // เผื่อเคสที่โค้ชให้คะแนนไว้ก่อนแล้ว (ตอนยังเป็น A) แล้วค่อยเปลี่ยนสถานะทีหลัง ไม่ให้มีคะแนนที่ไม่มีความหมาย
    // ค้างอยู่ในฐานข้อมูล (scores: {} แทนที่ทั้ง field เดิมเพราะ setDoc merge:true แทนที่ทั้งค่าของ field นี้)
    if (status !== "A") {
      payload.scores = {};
    }
    await setDoc(doc(db, "attendance", docId), payload, { merge: true });
    const prev = currentAttendanceMap.get(playerId) || {};
    const updated = { ...prev, status, updatedAt: { toDate: () => new Date() } };
    if (status !== "A") updated.scores = {};
    currentAttendanceMap.set(playerId, updated);
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

// ยังไม่เคยเช็คชื่อวันนี้เลย (ไม่มีเอกสาร sessions) และผู้ใช้แค่ "เรียกดู" ไม่ได้กด "โหลด/สร้าง" — ซ่อนทุกกล่องไว้
// ก่อน แล้วให้ attendance-status อธิบายว่ายังไม่มีข้อมูล กันสับสนกับ "วันนี้ไม่มีฝึกซ้อม" ซึ่งเป็นคนละสถานะกัน
function showNoSessionView() {
  noTrainingBanner.classList.add("hidden");
  rosterLockedBanner.classList.add("hidden");
  rosterWrap.classList.add("hidden");
}

async function renderSession(session, dateStr) {
  currentSessionId = session.id;
  currentSessionData = session.data;

  if (session.data.noTraining) {
    showNoTrainingView();
    setAttendanceStatus(`วันที่ ${dateStr} ถูกบันทึกว่าไม่มีฝึกซ้อม (ทีม ${myTeam})`);
    return;
  }
  showRosterView();
  const existingMap = await loadExistingAttendance(session.id);
  renderRoster(existingMap);
  setAttendanceStatus(`พร้อมเช็คชื่อวันที่ ${dateStr} (ทีม ${myTeam})`);
}

async function loadSessionForDate(dateStr) {
  setAttendanceStatus("กำลังโหลด...");
  const session = await findOrCreateSession(dateStr);
  await renderSession(session, dateStr);
}

// เรียกดูวันที่ที่เลือกแบบอ่านอย่างเดียว (ไม่สร้างวันซ้อมใหม่ถ้ายังไม่เคยมี) — ใช้ตอนโค้ชแค่อยากย้อนดูประวัติว่า
// วันนั้นเช็คชื่อไว้หรือยัง โดยไม่ต้องกังวลว่าจะไปสร้างเอกสารเปล่าทิ้งไว้สำหรับวันที่ไม่มีการฝึกซ้อมจริง
async function viewSessionForDate(dateStr) {
  setAttendanceStatus("กำลังค้นหา...");
  const session = await findSession(dateStr);
  if (!session) {
    currentSessionId = null;
    currentSessionData = null;
    showNoSessionView();
    setAttendanceStatus(`ยังไม่มีข้อมูลวันที่ ${dateStr} (ทีม ${myTeam}) — ยังไม่เคยสร้างวันซ้อมนี้`);
    return;
  }
  await renderSession(session, dateStr);
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

viewSessionBtn.addEventListener("click", async () => {
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
    await viewSessionForDate(dateStr);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("เรียกดูไม่สำเร็จ: " + err.message, true);
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
  const allReports = [];
  snap.forEach((d) => allReports.push({ id: d.id, ...d.data() }));
  // แก้ไข/สร้างรายงานของโค้ชคนนี้เองเท่านั้น กันไปทับ/แย่งรายงานของโค้ชคนอื่นในทีมเดียวกัน (ดู filterByMyCoachName)
  const myReports = filterByMyCoachName(allReports);
  const existing = myReports.length > 0 ? myReports[0] : null;

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
    // เคยถูกซิงก์มาแบบอัตโนมัติเท่านั้น (โค้ชไม่เคยกรอกอะไรเองเลย) พอยกเลิก "ไม่มีฝึกซ้อม" แล้วจะไม่เหลือข้อมูล
    // อะไรที่มีความหมายอีกต่อไป — ลบเอกสารทิ้งไปเลยแทนการล้างค่าเป็น null ค้างไว้ (ไม่ถือว่าเป็นการส่งรายงาน)
    // กันหน้า Daily/ภาพรวมต่างๆ เข้าใจผิดว่ามีรายงานอยู่ทั้งที่ไม่มีข้อมูลจริง
    await deleteDoc(doc(db, "trainingReports", existing.id));
  }
}

// ทิศทางตรงข้ามกับ syncTrainingReportForNoTraining ด้านบน: เมื่อโค้ชกรอกฟอร์ม "รายงานการฝึกซ้อม" ด้วยตนเองว่า
// "ไม่มีการซ้อม" ให้ทำเครื่องหมายวันซ้อมนั้นเป็น noTraining ทันที (สร้างวันซ้อมใหม่ให้ถ้ายังไม่เคยมี) เพื่อให้หน้า
// เช็คชื่อรายวันเห็นสถานะนี้ทันทีโดยไม่ต้องรอโค้ชไปกดปุ่ม "วันนี้ไม่มีฝึกซ้อม" ซ้ำอีกรอบ — ถ้ารายงานบอกว่า
// "มีการซ้อม" และวันนั้นเคยถูกทำเครื่องหมายไม่มีฝึกซ้อมไว้ก่อน (จากหน้าเช็คชื่อหรือรายงานครั้งก่อน) ให้ยกเลิกสถานะ
// นั้นให้อัตโนมัติเช่นกัน (ไม่แตะต้องถ้ายังไม่เคยมีวันซ้อมมาก่อนเลย เพราะไม่มีอะไรต้องยกเลิก)
async function syncSessionForReportAttendance(dateStr, attended) {
  if (attended === true) {
    const existing = await findSession(dateStr);
    if (existing && existing.data.noTraining) {
      await setDoc(doc(db, "sessions", existing.id), { noTraining: false, updatedAt: serverTimestamp() }, { merge: true });
      if (currentSessionId === existing.id) {
        currentSessionData = { ...currentSessionData, noTraining: false };
      }
    }
    return;
  }
  const session = await findOrCreateSession(dateStr);
  await setDoc(doc(db, "sessions", session.id), { noTraining: true, updatedAt: serverTimestamp() }, { merge: true });
  if (currentSessionId === session.id) {
    currentSessionData = { ...currentSessionData, noTraining: true };
  }
}

const PERIOD_LABELS = { morning: "ซ้อมเช้า", evening: "ซ้อมเย็น", other: "อื่นๆ โปรดระบุ" };
const PERIOD_CODES_BY_LABEL = Object.fromEntries(
  Object.entries(PERIOD_LABELS).map(([code, label]) => [label, code])
);
// ใช้คำว่า "มีการซ้อม / ไม่มีการซ้อม" แทน "เข้า / ไม่เข้า" เพื่อไม่ให้ตีความผิดว่าโค้ชขาดงานเอง
// (สถานะนี้บันทึกว่า "วันนี้มีการฝึกซ้อมเกิดขึ้นหรือไม่" ไม่ใช่การประเมินตัวโค้ช)
const ATTEND_LABELS = { true: "มีการซ้อม", false: "ไม่มีการซ้อม" };

// แนบรูปภาพจากการฝึกซ้อมในรายงาน — เปิดใช้เฉพาะทีมนี้ตามคำขอ ทีมอื่นไม่แสดงช่องแนบรูปเลย
const REPORT_PHOTO_TEAM = "THAWEE SC";

let reportPeriodType = null; // "morning" | "evening" | "other"
let reportPeriodStartTime = "";
let reportPeriodEndTime = "";
let reportPeriodOtherText = "";
let reportAttended = null; // true | false
// รูปภาพที่แนบไว้ตอนโหลดรายงานขึ้นมา (ก่อนแก้ไข) กับสำเนาที่แก้ไขได้ (กดลบแล้วตัดออกจาก array นี้) — เทียบสอง
// อันนี้ตอนบันทึกเพื่อรู้ว่ารูปไหนถูกลบไปจริง จะได้ไปลบไฟล์ใน Storage ทิ้งด้วย (ดู deleteStorageFileBestEffort)
let reportOriginalPhotos = [];
let reportExistingPhotos = [];

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

// แสดง/ซ่อนช่องแนบรูปภาพตามทีม (เฉพาะ THAWEE SC) — เรียกทุกครั้งที่เข้าหน้ารายงานหรือโหลดข้อมูลของวันที่เลือก
function updateReportPhotoWrapVisibility() {
  reportPhotoWrap.classList.toggle("hidden", myTeam !== REPORT_PHOTO_TEAM);
}

// แสดงรูปที่แนบไว้แล้ว (ของเดิม มีปุ่ม ✕ ลบทีละรูป) ต่อด้วยรูปที่เพิ่งเลือกใหม่จาก input (พรีวิวด้วย object URL
// ยังไม่อัปโหลดจริงจนกว่าจะกดส่งรายงาน)
function renderReportPhotoPreview() {
  reportPhotoPreview.innerHTML = "";
  for (const photo of reportExistingPhotos) {
    const wrap = document.createElement("div");
    wrap.className = "relative";
    wrap.innerHTML = `<a href="${photo.url}" target="_blank" rel="noopener"><img src="${photo.url}" class="w-16 h-16 object-cover rounded border border-slate-200" /></a>`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center";
    removeBtn.textContent = "✕";
    removeBtn.title = "ลบรูปนี้";
    removeBtn.addEventListener("click", () => {
      reportExistingPhotos = reportExistingPhotos.filter((p) => p !== photo);
      renderReportPhotoPreview();
    });
    wrap.appendChild(removeBtn);
    reportPhotoPreview.appendChild(wrap);
  }
  for (const file of reportPhotoInput.files) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "w-16 h-16 object-cover rounded border border-dashed border-slate-300";
    img.title = `ใหม่: ${file.name}`;
    reportPhotoPreview.appendChild(img);
  }
}

reportPhotoInput.addEventListener("change", renderReportPhotoPreview);

// อัปโหลดรูปภาพแนบรายงานขึ้น Storage แล้วคืน {url, name, path} — path แยกตามทีม/วันที่/เวลาที่อัปโหลด
// เพื่อกันชื่อไฟล์ชนกัน (ใช้ path เดียวกับที่ storage.rules ล็อกไว้เฉพาะทีม THAWEE SC เท่านั้น)
async function uploadReportPhoto(file, team, dateStr) {
  const safeName = file.name.replace(/[^\w.\-ก-๙]/g, "_");
  const filePath = `trainingReports/${team}/${dateStr}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, name: file.name, path: filePath };
}

// แสดงเนื้อหารายงานที่มีอยู่แล้วแบบดูอย่างเดียว (การ์ดสรุป + ปุ่ม "แก้ไขรายงาน") แทนการเปิดฟอร์มที่กดส่งซ้ำ
// ได้ทันที เพื่อกันการส่งซ้ำ/แก้โดยไม่ตั้งใจ — headline ให้ระบุเองได้ (ใช้ข้อความต่างกันตอนโหลดข้อมูลเดิม
// เทียบกับตอนเพิ่งส่งรายงานสำเร็จ) ส่วนรายละเอียดใช้ textContent ล้วนเพื่อกัน XSS จากข้อความหมายเหตุที่โค้ชพิมพ์เอง
function renderReportSummary(dateStr, data, headline) {
  reportSummaryText.textContent =
    headline || `พบรายงานที่เคยส่งไว้สำหรับวันที่ ${dateStr} — ดูอย่างเดียว กดแก้ไขรายงานหากต้องการเปลี่ยนข้อมูล`;

  reportSummaryDetails.innerHTML = "";
  const attendedLabel = typeof data.attended === "boolean" ? ATTEND_LABELS[data.attended] : "-";
  const lines = [`สถานะการฝึกซ้อม: ${attendedLabel}`];
  if (data.attended === true) {
    const periodLabel =
      data.periodType === "other" ? data.periodOtherText || "อื่นๆ" : PERIOD_LABELS[data.periodType] || "-";
    const timeRange =
      data.periodStartTime && data.periodEndTime ? ` (${data.periodStartTime} - ${data.periodEndTime} น.)` : "";
    lines.push(`ช่วงเวลาฝึกซ้อม: ${periodLabel}${timeRange}`);
  }
  if (data.notes) lines.push(`หมายเหตุ: ${data.notes}`);
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    reportSummaryDetails.appendChild(p);
  }
  reportSummaryPhotos.innerHTML = (data.photos || [])
    .map(
      (photo) =>
        `<a href="${photo.url}" target="_blank" rel="noopener"><img src="${photo.url}" class="w-16 h-16 object-cover rounded border border-slate-200" /></a>`
    )
    .join("");
}

async function loadReportForDate(dateStr) {
  const q = query(
    collection(db, "trainingReports"),
    where("team", "==", myTeam),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  const allReports = [];
  snap.forEach((d) => allReports.push({ id: d.id, ...d.data() }));
  // กรองเอาเฉพาะรายงานของโค้ชคนนี้เอง ไม่เอารายงานของโค้ชคนอื่นในทีมเดียวกันมาปนกัน (ดู filterByMyCoachName)
  const myReports = filterByMyCoachName(allReports);
  const existing = myReports.length > 0 ? myReports[0] : null;

  currentReportId = existing ? existing.id : null;
  reportPeriodType = existing ? existing.periodType || null : null;
  reportPeriodStartTime = existing ? existing.periodStartTime || "" : "";
  reportPeriodEndTime = existing ? existing.periodEndTime || "" : "";
  reportPeriodOtherText = existing ? existing.periodOtherText || "" : "";
  reportAttended = existing && typeof existing.attended === "boolean" ? existing.attended : null;
  reportNotesInput.value = existing ? existing.notes || "" : "";
  reportOriginalPhotos = existing?.photos ? existing.photos.slice() : [];
  reportExistingPhotos = reportOriginalPhotos.slice();
  reportPhotoInput.value = "";
  updateReportPhotoWrapVisibility();
  renderReportPhotoPreview();

  renderPeriodSegmented();
  renderPeriodDetail();
  renderAttendSegmented();

  reportStatus.textContent = "";

  // มีรายงานที่โค้ชเคยกรอกจริงแล้ว (ไม่ใช่แค่ค่าที่ระบบซิงก์มาจากปุ่ม "วันนี้ไม่มีฝึกซ้อม") — ล็อกไว้เป็นดูอย่าง
  // เดียวก่อน กันส่งซ้ำ/แก้โดยไม่ตั้งใจ ต้องกดปุ่ม "แก้ไขรายงาน" เพื่อปลดล็อกฟอร์มเอง (ค่าที่กรอกไว้ในฟอร์มก็จะ
  // ถูกต้องอยู่แล้วเพราะ render* ด้านบนอ่านจาก state ที่ตั้งไว้แล้ว)
  if (existing && !existing.autoFromNoTraining) {
    reportForm.classList.add("hidden");
    renderReportSummary(dateStr, existing);
    reportSummary.classList.remove("hidden");
    reportLoadStatus.textContent = `พบรายงานที่เคยส่งไว้สำหรับวันที่ ${dateStr}`;
    reportLoadStatus.className = "text-sm text-slate-500 w-full";
    return;
  }

  reportSummary.classList.add("hidden");
  reportForm.classList.remove("hidden");
  if (existing && existing.autoFromNoTraining) {
    reportLoadStatus.textContent = `วันที่ ${dateStr} ถูกทำเครื่องหมายว่า "ไม่มีฝึกซ้อม" ไว้ในหน้าเช็คชื่อ — ระบบซิงก์สถานะมาให้อัตโนมัติ แก้ไขเพิ่มเติมได้ตามจริง`;
    reportLoadStatus.className = "text-sm text-amber-600 w-full";
  } else {
    reportLoadStatus.textContent = `ยังไม่มีรายงานสำหรับวันที่ ${dateStr} — กรอกข้อมูลด้านล่างเพื่อส่งรายงานใหม่`;
    reportLoadStatus.className = "text-sm text-slate-500 w-full";
  }
}

reportEditBtn.addEventListener("click", () => {
  reportSummary.classList.add("hidden");
  reportForm.classList.remove("hidden");
  reportStatus.textContent = "";
});

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

  const newPhotoFiles = myTeam === REPORT_PHOTO_TEAM ? Array.from(reportPhotoInput.files) : [];
  for (const file of newPhotoFiles) {
    if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
      reportStatus.textContent = `รูป "${file.name}" ใหญ่เกินไป (จำกัดไม่เกิน 10MB)`;
      reportStatus.className = "text-sm text-red-600";
      return;
    }
    if (!file.type.startsWith("image/")) {
      reportStatus.textContent = `"${file.name}" ไม่ใช่ไฟล์รูปภาพ`;
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

    const removedPhotos = reportOriginalPhotos.filter(
      (op) => !reportExistingPhotos.some((ep) => ep.path === op.path)
    );
    if (myTeam === REPORT_PHOTO_TEAM) {
      if (newPhotoFiles.length > 0) {
        reportStatus.textContent = "กำลังอัปโหลดรูปภาพ...";
      }
      const uploaded = await Promise.all(newPhotoFiles.map((f) => uploadReportPhoto(f, myTeam, dateStr)));
      payload.photos = [...reportExistingPhotos, ...uploaded];
      reportStatus.textContent = "กำลังส่งรายงาน...";
    }

    if (currentReportId) {
      await updateDoc(doc(db, "trainingReports", currentReportId), payload);
    } else {
      const newDoc = await addDoc(collection(db, "trainingReports"), { ...payload, createdAt: serverTimestamp() });
      currentReportId = newDoc.id;
    }
    await syncSessionForReportAttendance(dateStr, reportAttended);
    for (const photo of removedPhotos) {
      await deleteStorageFileBestEffort(photo.path);
    }
    // sync state ของรูปภาพให้ตรงกับที่เพิ่งบันทึกไปจริง กัน re-upload ไฟล์เดิมซ้ำถ้ากด "แก้ไขรายงาน" ต่อทันที
    // โดยไม่ได้กด "โหลดวันนี้" ใหม่ (ปุ่มแก้ไขแค่สลับการแสดงผล ไม่ได้เรียก loadReportForDate ซ้ำ)
    reportOriginalPhotos = payload.photos ? payload.photos.slice() : [];
    reportExistingPhotos = reportOriginalPhotos.slice();
    reportPhotoInput.value = "";
    renderReportPhotoPreview();

    reportStatus.textContent = "";
    // ล็อกกลับเป็นดูอย่างเดียวทันทีหลังส่งสำเร็จ กันกดส่งซ้ำโดยไม่ตั้งใจ — ต้องกด "แก้ไขรายงาน" เพื่อแก้ไขต่อ
    reportForm.classList.add("hidden");
    renderReportSummary(dateStr, payload, `ส่งรายงานสำหรับวันที่ ${dateStr} เรียบร้อย ✓ — ดูอย่างเดียว กดแก้ไขรายงานหากต้องการเปลี่ยนข้อมูล`);
    reportSummary.classList.remove("hidden");
    reportLoadStatus.textContent = `ส่งรายงานสำหรับวันที่ ${dateStr} เรียบร้อย ✓ (ซิงก์กับหน้าเช็คชื่อรายวันอัตโนมัติ)`;
    reportLoadStatus.className = "text-sm text-emerald-600 w-full";
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
// หัวข้อหลักเฉพาะผู้รักษาประตู — เหมือนกันทุกรุ่นอายุ (ต่างจากหัวข้อของผู้เล่นทั่วไปที่แยกตาม bracket) เพิ่มเข้าไป
// ต่อท้ายหัวข้อของ bracket นั้นๆ เมื่อเลือกประเภทการฝึกเป็น "Goalkeeper" (ดู renderTrainingPlanMainPartOptions)
const TRAINING_PLAN_GOALKEEPER_MAIN_PARTS = [
  "Handling & Catching",
  "Diving",
  "Shot Stopping",
  "Positioning",
  "Angle Play",
  "Footwork",
  "Agility & Coordination",
  "Mental Toughness",
  "Decision Making",
  "Distribution"
];
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

const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024; // ต้องตรงกับ storage.rules

// อัปโหลดไฟล์แนบแผนการฝึกซ้อมขึ้น Storage แล้วคืน {fileUrl, fileName, filePath} — path แยกตามทีม/วันที่/เวลา
// ที่อัปโหลด (timestamp) เพื่อกันชื่อไฟล์ชนกัน (สองแผนคนละวันแนบไฟล์ชื่อเดียวกันได้โดยไม่ทับกัน)
async function uploadTrainingPlanFile(file, team, dateStr) {
  const safeName = file.name.replace(/[^\w.\-ก-๙]/g, "_");
  const filePath = `trainingPlans/${team}/${dateStr}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  return { fileUrl, fileName: file.name, filePath };
}

let editingTrainingPlanId = null;
let trainingPlanAgeGroupsSelected = new Set();
let trainingPlanPlayerGroup = null;
let trainingPlanType = null;
let trainingPlanPhase = null;
let trainingPlanPhysicalSelected = new Set();
// ไฟล์แนบของแผนที่กำลังแก้ไขอยู่ (ถ้ามี) — เก็บไว้แยกจาก input[type=file] เพราะเลือกไฟล์ใหม่แล้วยังต้องรู้ว่า
// ของเดิมคืออะไร (โชว์ลิงก์เดิมไว้จนกว่าจะอัปโหลดไฟล์ใหม่ทับหรือกดลบ)
let trainingPlanExistingFileUrl = null;
let trainingPlanExistingFileName = null;
let trainingPlanExistingFilePath = null;
let trainingPlanRemoveExistingFile = false;

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
// ไม่อยู่ในชุดใหม่แล้ว จะล้างค่าที่เลือกไว้ก่อนหน้าทิ้ง (กันไม่ให้ค่าที่บันทึกไม่ตรงกับรุ่นอายุจริง) — ถ้าเลือก
// ประเภทการฝึกเป็น "Goalkeeper" จะเพิ่มหัวข้อเฉพาะผู้รักษาประตูต่อท้ายหัวข้อของ bracket นั้นด้วย (เหมือนกันทุกรุ่นอายุ)
function renderTrainingPlanMainPartOptions() {
  const bracket = bracketForAgeGroups(trainingPlanAgeGroupsSelected);
  const currentValue = trainingPlanMainPartSelect.value;
  if (!bracket) {
    trainingPlanMainPartSelect.innerHTML = '<option value="">-- เลือกรุ่นอายุก่อน --</option>';
    trainingPlanMainPartSelect.disabled = true;
    return;
  }
  const options =
    trainingPlanType === "Goalkeeper"
      ? [...TRAINING_PLAN_MAIN_PART_BY_BRACKET[bracket], ...TRAINING_PLAN_GOALKEEPER_MAIN_PARTS]
      : TRAINING_PLAN_MAIN_PART_BY_BRACKET[bracket];
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
      // หัวข้อหลัก (Main part) มีตัวเลือกเพิ่มเติมเฉพาะตอนเลือกประเภท "Goalkeeper" ต้องอัปเดตช่องนี้ด้วยทุกครั้ง
      // ที่เปลี่ยนประเภทการฝึก ไม่ใช่แค่ตอนเปลี่ยนรุ่นอายุเหมือนเดิม
      renderTrainingPlanMainPartOptions();
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

// แสดงสถานะไฟล์แนบปัจจุบันใต้ช่องเลือกไฟล์ — ของเดิม (ถ้ามีและยังไม่ถูกลบ) จะมีลิงก์เปิดดู + ปุ่ม "ลบไฟล์แนบ"
// เลือกไฟล์ใหม่แล้วจะถือว่าใช้ไฟล์ใหม่แทนตอนบันทึก โดยไม่ต้องกดลบของเดิมก่อน
function renderTrainingPlanFileStatus() {
  trainingPlanFileStatus.innerHTML = "";
  if (trainingPlanFileInput.files[0]) {
    trainingPlanFileStatus.textContent = `เลือกไฟล์ใหม่: ${trainingPlanFileInput.files[0].name}`;
    return;
  }
  if (trainingPlanExistingFileUrl && !trainingPlanRemoveExistingFile) {
    trainingPlanFileStatus.innerHTML = `📎 ไฟล์ที่แนบไว้: <a href="${trainingPlanExistingFileUrl}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">${trainingPlanExistingFileName ?? "เปิดไฟล์"}</a> `;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost-danger btn-sm";
    removeBtn.textContent = "ลบไฟล์แนบ";
    removeBtn.addEventListener("click", () => {
      trainingPlanRemoveExistingFile = true;
      renderTrainingPlanFileStatus();
    });
    trainingPlanFileStatus.appendChild(removeBtn);
    return;
  }
  trainingPlanFileStatus.textContent = trainingPlanExistingFileUrl ? "ไฟล์แนบเดิมจะถูกลบเมื่อบันทึก" : "ยังไม่ได้แนบไฟล์";
}

trainingPlanFileInput.addEventListener("change", () => {
  trainingPlanRemoveExistingFile = false;
  renderTrainingPlanFileStatus();
});

function stopEditTrainingPlan() {
  editingTrainingPlanId = null;
  trainingPlanForm.reset();
  trainingPlanAgeGroupsSelected = new Set();
  trainingPlanPlayerGroup = null;
  trainingPlanType = null;
  trainingPlanPhase = null;
  trainingPlanPhysicalSelected = new Set();
  trainingPlanExistingFileUrl = null;
  trainingPlanExistingFileName = null;
  trainingPlanExistingFilePath = null;
  trainingPlanRemoveExistingFile = false;
  renderTrainingPlanAgeGroupToggle();
  renderTrainingPlanMainPartOptions();
  renderTrainingPlanPhysicalToggle();
  renderTrainingPlanPlayerGroupSegmented();
  renderTrainingPlanTypeSegmented();
  renderTrainingPlanPhaseSegmented();
  renderTrainingPlanFileStatus();
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
  trainingPlanFileInput.value = "";
  trainingPlanExistingFileUrl = plan.fileUrl ?? null;
  trainingPlanExistingFileName = plan.fileName ?? null;
  trainingPlanExistingFilePath = plan.filePath ?? null;
  trainingPlanRemoveExistingFile = false;
  renderTrainingPlanAgeGroupToggle();
  renderTrainingPlanMainPartOptions();
  trainingPlanMainPartSelect.value = plan.mainPart ?? "";
  renderTrainingPlanPhysicalToggle();
  renderTrainingPlanPlayerGroupSegmented();
  renderTrainingPlanTypeSegmented();
  renderTrainingPlanPhaseSegmented();
  renderTrainingPlanFileStatus();
  trainingPlanSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditTrainingPlanBtn.classList.remove("hidden");
  trainingPlanStatus.textContent = `กำลังแก้ไขแผนการฝึกซ้อมวันที่ ${plan.date}`;
  trainingPlanStatus.className = "text-sm text-slate-500";
  trainingPlanForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ลบไฟล์ใน Storage แบบ best-effort — ใช้ร่วมกันทั้งไฟล์แนบแผนการฝึกซ้อมและรูปภาพแนบรายงานการฝึกซ้อม
// ไม่ให้ error จุดนี้ไปบล็อกการลบ/แก้ไขเอกสารหลักใน Firestore (เช่นไฟล์ถูกลบไปแล้วจากรอบก่อน หรือ path เพี้ยน
// ก็ไม่ควรทำให้ผู้ใช้บันทึกข้อมูลหลักไม่ได้)
async function deleteStorageFileBestEffort(filePath) {
  if (!filePath) return;
  try {
    await deleteObject(storageRef(storage, filePath));
  } catch (err) {
    console.warn("ลบไฟล์เดิมไม่สำเร็จ (ไม่บล็อกการทำงานหลัก):", err);
  }
}

async function deleteTrainingPlan(plan) {
  const ok = confirm(`ยืนยันลบแผนการฝึกซ้อมวันที่ ${plan.date}? การลบนี้ไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "trainingPlans", plan.id));
    await deleteStorageFileBestEffort(plan.filePath);
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
    '<tr><td colspan="9" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const snap = await getDocs(query(collection(db, "trainingPlans"), where("team", "==", myTeam)));
  const allPlans = [];
  snap.forEach((d) => allPlans.push({ id: d.id, ...d.data() }));

  // แสดงเฉพาะแผนของรุ่นอายุที่ตัวเองรับผิดชอบ (ถ้ารู้ตัวโค้ชแน่ชัด — myAgeGroups ไม่ว่าง เช่นโค้ชจริงล็อกอินเอง
  // หรือผู้ดูแลระบบสวมบทบาทเป็นโค้ชคนใดคนหนึ่งเจาะจง) ไม่ปนกับแผนของโค้ชรุ่นอื่นในทีมเดียวกัน — trainingPlans
  // เก็บ ageGroups เป็น array (เลือกได้หลายรุ่นต่อแผน) จึงเช็คว่ามีรุ่นใดรุ่นหนึ่งตรงกับที่ดูแลหรือไม่ แทนที่จะ
  // เทียบค่าเดียวตรงๆ แบบ filterByMyAgeGroups — โหมด "จัดการทีมนี้" แบบกว้าง (myAgeGroups ว่าง) ยังเห็นทุกแผนเหมือนเดิม
  const plans = myAgeGroups.length > 0
    ? allPlans.filter((p) => (p.ageGroups || []).some((ag) => myAgeGroups.includes(ag)))
    : allPlans;
  plans.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const lateCountThisMonth = countLateTrainingPlansThisMonth(plans);
  trainingPlanLateWarning.classList.toggle("hidden", lateCountThisMonth <= TRAINING_PLAN_LATE_WARNING_THRESHOLD);
  trainingPlanLateCountEl.textContent = lateCountThisMonth;

  if (plans.length === 0) {
    trainingPlanListBody.innerHTML =
      '<tr><td colspan="9" class="px-4 py-6 text-center text-slate-400">ยังไม่มีแผนการฝึกซ้อม</td></tr>';
    return;
  }

  trainingPlanListBody.innerHTML = "";
  for (const plan of plans) {
    const tr = document.createElement("tr");
    const fileCell = plan.fileUrl
      ? `<a href="${plan.fileUrl}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">📎 เปิดไฟล์</a>`
      : "-";
    tr.innerHTML = `
      <td class="emphasis">${plan.date ?? "-"}</td>
      <td>${(plan.ageGroups || []).join(", ") || "-"}</td>
      <td>${plan.trainingType ?? "-"}</td>
      <td>${plan.phase ?? "-"}</td>
      <td>${plan.mainPart ?? "-"}</td>
      <td>${(plan.physicalFocus || []).join(", ") || "-"}</td>
      <td>${trainingPlanSubmissionStatus(plan)}</td>
      <td>${fileCell}</td>
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

  const selectedFile = trainingPlanFileInput.files[0] || null;
  if (selectedFile) {
    if (selectedFile.size > MAX_ATTACHMENT_FILE_SIZE) {
      trainingPlanStatus.textContent = "ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 10MB)";
      trainingPlanStatus.className = "text-sm text-red-600";
      return;
    }
    if (!/^image\/|^application\/pdf$/.test(selectedFile.type)) {
      trainingPlanStatus.textContent = "รองรับเฉพาะไฟล์รูปภาพหรือ PDF เท่านั้น";
      trainingPlanStatus.className = "text-sm text-red-600";
      return;
    }
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

  trainingPlanSubmitBtn.disabled = true;
  const oldFilePath = trainingPlanExistingFilePath;
  try {
    if (selectedFile) {
      trainingPlanStatus.textContent = "กำลังอัปโหลดไฟล์แนบ...";
      trainingPlanStatus.className = "text-sm text-slate-500";
      const uploaded = await uploadTrainingPlanFile(selectedFile, myTeam, dateStr);
      payload.fileUrl = uploaded.fileUrl;
      payload.fileName = uploaded.fileName;
      payload.filePath = uploaded.filePath;
    } else if (trainingPlanRemoveExistingFile) {
      payload.fileUrl = null;
      payload.fileName = null;
      payload.filePath = null;
    }
    // ถ้าไม่ได้เลือกไฟล์ใหม่และไม่ได้กดลบไฟล์เดิม จะไม่ใส่ fileUrl/fileName/filePath ใน payload เลย —
    // updateDoc เป็น partial update จึงไม่แตะฟิลด์เดิม ไฟล์ที่แนบไว้ก่อนหน้ายังอยู่ครบตามเดิม

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
    // ลบไฟล์เก่าทิ้งแบบ best-effort หลังบันทึกสำเร็จแล้วเท่านั้น (เฉพาะตอนถูกแทนที่ด้วยไฟล์ใหม่ หรือถูกลบทิ้ง)
    if (oldFilePath && (selectedFile || payload.filePath === null)) {
      await deleteStorageFileBestEffort(oldFilePath);
    }
    await renderTrainingPlanList();
  } catch (err) {
    console.error(err);
    trainingPlanStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
    trainingPlanStatus.className = "text-sm text-red-600";
  } finally {
    trainingPlanSubmitBtn.disabled = false;
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

const DAILY_ATTENDANCE_PAGE_SIZE = 10;
let dailyAttendanceRows = [];
let dailyAttendancePage = 1;

function renderDailyAttendancePage() {
  const totalPages = Math.max(1, Math.ceil(dailyAttendanceRows.length / DAILY_ATTENDANCE_PAGE_SIZE));
  dailyAttendancePage = Math.min(Math.max(dailyAttendancePage, 1), totalPages);
  const start = (dailyAttendancePage - 1) * DAILY_ATTENDANCE_PAGE_SIZE;
  const pageRows = dailyAttendanceRows.slice(start, start + DAILY_ATTENDANCE_PAGE_SIZE);

  dailyAttendanceBody.innerHTML = pageRows
    .map(
      (r) => `
        <tr>
          <td class="emphasis">${r.name}</td>
          <td>${r.status}</td>
          <td>${r.avgText}</td>
        </tr>`
    )
    .join("");
  applyDataLabels(dailyAttendanceBody);

  // แสดงปุ่มเปลี่ยนหน้าเฉพาะตอนมีมากกว่า 1 หน้า (ไม่รกจอถ้ามีนักกีฬาน้อยกว่า/เท่ากับ 10 คน)
  if (totalPages <= 1) {
    dailyAttendancePagination.classList.add("hidden");
    return;
  }
  dailyAttendancePagination.classList.remove("hidden");
  dailyAttendancePagination.innerHTML = "";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-secondary btn-sm";
  prevBtn.textContent = "‹ ก่อนหน้า";
  prevBtn.disabled = dailyAttendancePage <= 1;
  prevBtn.addEventListener("click", () => {
    dailyAttendancePage -= 1;
    renderDailyAttendancePage();
  });
  const pageLabel = document.createElement("span");
  pageLabel.className = "text-slate-500";
  pageLabel.textContent = `หน้า ${dailyAttendancePage} จาก ${totalPages} (ทั้งหมด ${dailyAttendanceRows.length} คน)`;
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-secondary btn-sm";
  nextBtn.textContent = "ถัดไป ›";
  nextBtn.disabled = dailyAttendancePage >= totalPages;
  nextBtn.addEventListener("click", () => {
    dailyAttendancePage += 1;
    renderDailyAttendancePage();
  });
  dailyAttendancePagination.appendChild(prevBtn);
  dailyAttendancePagination.appendChild(pageLabel);
  dailyAttendancePagination.appendChild(nextBtn);
}

// แสดงเฉพาะนักกีฬาที่อยู่ในขอบเขตของโค้ชคนนี้จริง (players ตัวแปรกลางถูกกรองตามรุ่นอายุ+ตำแหน่งไว้แล้วจาก
// loadPlayers) — บันทึกเช็คชื่อผูกกับ "ทีม" ทั้งก้อนต่อวัน จึงมีนักกีฬารุ่น/ตำแหน่งอื่นปนมาด้วย ต้องกรองออกไป
// ไม่ใช่แค่หาไม่เจอแล้วโชว์ "-" (แบบเดิมที่แก้ไปก่อนหน้า) เพื่อให้โค้ชแต่ละคนเห็นเฉพาะรุ่น/นักกีฬาของตัวเองเท่านั้น
function renderDailyAttendance(snap) {
  const myPlayerIds = new Set(players.map((p) => p.id));
  const records = [];
  snap.forEach((d) => {
    const data = d.data();
    if (myPlayerIds.has(data.playerId)) records.push(data);
  });
  dailyAttendancePage = 1;
  if (records.length === 0) {
    dailyAttendanceRows = [];
    dailyAttendancePagination.classList.add("hidden");
    dailyAttendanceBody.innerHTML =
      '<tr><td colspan="3" class="px-4 py-6 text-center text-slate-400">ยังไม่มีการเช็คชื่อในวันนี้</td></tr>';
    return;
  }
  const playerMap = new Map(players.map((p) => [p.id, p]));
  dailyAttendanceRows = records.map((r) => {
    const p = playerMap.get(r.playerId);
    const avg = computeAvgScore(r.scores);
    return {
      name: p ? p.nickname ?? p.fullName ?? "-" : "-",
      status: r.status ?? "-",
      avgText: avg !== null ? avg.toFixed(2) : "-"
    };
  });
  renderDailyAttendancePage();
}

function renderDailyTrainingReport(snap) {
  // รายงานการฝึกซ้อมส่งแยกต่างหากทีละโค้ช (ไม่มีฟิลด์ ageGroup ให้กรองเหมือนแผนการฝึกซ้อม) ต้องกรองเอาเฉพาะ
  // รายงานของโค้ชคนนี้เอง ไม่ใช่หยิบรายงานแรกที่เจอ (อาจเป็นของโค้ชรุ่นอื่นในทีมเดียวกัน)
  const allReports = [];
  snap.forEach((d) => allReports.push(d.data()));
  const reports = filterByMyCoachName(allReports);
  if (reports.length === 0) {
    dailyTrainingReportCard.innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีรายงานการฝึกซ้อมในวันนี้</p>';
    return;
  }
  const r = reports[0];
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
  // แผนการฝึกซ้อมส่งแยกต่างหากทีละโค้ช (มี ageGroups ของตัวเอง) ทีมหนึ่งจึงมีได้หลายแผนต่อวัน (คนละโค้ช
  // คนละรุ่นอายุ) ต้องกรองเอาเฉพาะแผนของรุ่นอายุที่โค้ชคนนี้ดูแลจริง ไม่ใช่หยิบแผนแรกที่เจอแบบสุ่ม
  const plans = [];
  snap.forEach((d) => plans.push(d.data()));
  const myPlans =
    myAgeGroups.length > 0 ? plans.filter((pl) => (pl.ageGroups || []).some((ag) => myAgeGroups.includes(ag))) : plans;
  if (myPlans.length === 0) {
    dailyTrainingPlanCard.innerHTML = '<p class="text-sm text-slate-400">ยังไม่มีการส่งแผนการฝึกซ้อมในวันนี้</p>';
    return;
  }
  const p = myPlans[0];
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

// กรองเฉพาะรุ่นอายุที่โค้ชคนนี้ดูแลจริง (myAgeGroups ว่างเปล่า = โหมดจัดการทีมแบบกว้าง ไม่เจาะจงคน จึงเห็น
// ทุกรุ่นเหมือนเดิม) ใช้ร่วมกันทั้งผลการแข่งขันและอาการบาดเจ็บ เพราะทั้งสองผูกกับรุ่นอายุโดยตรงอยู่แล้ว
function filterByMyAgeGroups(reports) {
  return myAgeGroups.length > 0 ? reports.filter((r) => myAgeGroups.includes(r.ageGroup)) : reports;
}

// เหมือน filterByMyAgeGroups ด้านบนแต่กรองด้วยชื่อโค้ชแทน — ใช้กับ "รายงานการฝึกซ้อม" (trainingReports) ซึ่งไม่มี
// ฟิลด์ ageGroup ให้กรอง (เดิมออกแบบเป็นรายงานเดียวต่อทีมต่อวัน แต่ทีมหนึ่งมีหลายโค้ชคนละรุ่นอายุ ทำให้เห็น
// รายงานของโค้ชคนอื่นปนกันอยู่) myAgeGroups.length > 0 เป็นสัญญาณเดียวกับที่ใช้ทั่วทั้งระบบว่า "รู้ตัวโค้ชคนนี้
// แน่ชัดแล้ว" (โค้ชจริงล็อกอินเอง หรือผู้ดูแลระบบสวมบทบาทเจาะจงคนใดคนหนึ่ง) — โหมด "จัดการทีมนี้" แบบกว้าง
// (myAgeGroups ว่างเปล่า) ยังเห็นรายงานของทุกโค้ชในทีมเหมือนเดิม เพราะยังไม่รู้ว่าจะจำกัดขอบเขตแค่ไหน
function filterByMyCoachName(reports) {
  return myAgeGroups.length > 0 ? reports.filter((r) => r.coachName === myCoachName) : reports;
}

function renderDailyMatchReports(snap) {
  const allReports = [];
  snap.forEach((d) => allReports.push(d.data()));
  const reports = filterByMyAgeGroups(allReports);
  if (reports.length === 0) {
    dailyMatchBody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">ไม่มีการแข่งขันในวันนี้</td></tr>';
    return;
  }
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
  const allReports = [];
  snap.forEach((d) => allReports.push(d.data()));
  const reports = filterByMyAgeGroups(allReports);
  if (reports.length === 0) {
    dailyInjuryBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ไม่มีรายงานอาการบาดเจ็บในวันนี้</td></tr>';
    return;
  }
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
