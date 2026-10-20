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
  markAllNotificationsRead,
  getCoachPlayerIds,
  ageGroupSortKey,
  ageGroupNumber,
  calcAge,
  COACH_POSITIONS,
  coachPositionLabel,
  coachPositionAllowsMultipleAgeGroups,
  sendExecutiveNote,
  escapeHtml,
  monthDateRange,
  teamDateRangeQuery,
  safeHttpUrl,
  todayBangkok,
  thisMonthBangkok,
  monthsAgoBangkok,
  trainingPlanHasAttachment,
  TEAM_TRAINING_WEEKDAYS,
  isRecordOfCoach
} from "./ui-utils.js";
import { openAdminMeetings, renderCoachMeetingCard, renderCoachMeetingTasks, renderCoachNextMeeting, renderCoachMeetingHistory, loadCoachMeetingNotifications, loadCoachMeetingOverview } from "./coach-meetings-ui.js";
import { openAdminFitnessRounds } from "./fitness-rounds-ui.js";
import { openAdminAthleteWindows } from "./athlete-windows-ui.js";
import { openFitnessEntry } from "./fitness-entry-ui.js";
import { parseParentHeights } from "./fitness-calc.js";
import { applyTeamTheme } from "./team-theme.js";
import { initMatchDay, openMatchDay } from "./match-day-ui.js";
import { buildAttendanceGrid, gridHtml, legendHtml } from "./attendance-grid.js";
import { initMatchData, showMatchForm, showMatchHistory } from "./match-data-ui.js";
import { addMonthsToMonth, thaiMonthLabel } from "./coach-meetings.js";
import { filterPlans, filterReportsByMonths, groupByMonth, monthOptionsOf, monthsBack, planAgeGroupsOf, planDataHtml, reportHistoryHtml } from "./plan-report-data.js";
import { COACH_MENU, activeChildFor, childMatchesScreen, menuItem, menuKeyForScreen } from "./coach-menu.js";
import { initPhysical, showAthleteResults, showInstruction, showTestingForm } from "./physical-ui.js";
import { initProfile, showProfile } from "./coach-profile-ui.js";
import { initResults, showResults } from "./injury-results-ui.js";
import { ageGroupsOf, birthYearLabel, birthdayLabel, filterAndSortPlayers, playerDisplayName } from "./player-gallery.js";
import { STAFF_PERMISSIONS, canAccessAdminFeature, normalizePermissions, permissionsSummary, staffCan, staffLandingFeature } from "./staff-perms.js";
import { isEvaluationComplete } from "./masc-data.js";
import { applyAttendanceChange, firestoreFieldsForChange, createSaveQueue, rosterLockState } from "./attendance-save.js";
import {
  INJURY_SEVERITIES,
  INJURY_STATUS_HEALED,
  activeInjuryByPlayer,
  buildQuickInjuryReport,
  describeInjury,
  planInjuryAutoFill
} from "./injury-attendance.js";
import {
  MAX_LINEUP_SIZE,
  buildLineupFields,
  guestAgeGroupOptions,
  guestCandidates,
  isGoalkeeper,
  lineupFromReport,
  ownGroupCandidates,
  summarizeLineup
} from "./match-lineup.js";
import {
  BODY_REGIONS,
  CONTEXTS,
  MECHANISMS,
  SIDES,
  contextFor,
  detectRecurrence,
  diffDays,
  formStatusFor,
  injuryDetailLabels,
  storedStatusFor
} from "./injury-form.js";
import { buildRouteHash, parseRouteHash, isValidRouteDate } from "./screen-route.js";
import { icon } from "./icons.js";

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
const injuryAgeGroupSelect = document.getElementById("injury-age-group");
const injuryPlayerSearchInput = document.getElementById("injury-player-search");
const injuryPlayerDropdown = document.getElementById("injury-player-dropdown");
const trainingPlanSection = document.getElementById("training-plan-section");
const trainingPlanForm = document.getElementById("training-plan-form");
const trainingPlanStatus = document.getElementById("training-plan-status");
const trainingPlanSubmitBtn = document.getElementById("training-plan-submit-btn");
const cancelEditTrainingPlanBtn = document.getElementById("cancel-edit-training-plan-btn");
const trainingPlanMenuSection = document.getElementById("training-plan-menu-section");
const planDataSection = document.getElementById("plan-data-section");
const planDataMonthSelect = document.getElementById("plan-data-month-select");
const planDataAgeSelect = document.getElementById("plan-data-age-select");
const planDataStatus = document.getElementById("plan-data-status");
const planDataBody = document.getElementById("plan-data-body");
const reportDataSection = document.getElementById("report-data-section");
const reportDataMonthSelect = document.getElementById("report-data-month-select");
const reportDataStatus = document.getElementById("report-data-status");
const reportDataBody = document.getElementById("report-data-body");
const reportHistoryBody = document.getElementById("report-history-body");
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
const meetingTasksSection = document.getElementById("meeting-tasks-section");
const meetingTasksBody = document.getElementById("meeting-tasks-body");
const meetingMenuSection = document.getElementById("meeting-menu-section");
const meetingNextSection = document.getElementById("meeting-next-section");
const meetingNextBody = document.getElementById("meeting-next-body");
const meetingHistorySection = document.getElementById("meeting-history-section");
const meetingHistoryBody = document.getElementById("meeting-history-body");
const meetingHistoryMonth = document.getElementById("meeting-history-month");
const matchDataSection = document.getElementById("match-data-section");
const matchFormSection = document.getElementById("match-form-section");
const matchHistorySection = document.getElementById("match-history-section");
const matchSheetSection = document.getElementById("match-sheet-section");
const attendanceGridSection = document.getElementById("attendance-grid-section");
const attendanceGridCoachLabel = document.getElementById("attendance-grid-coach-label");
const attendanceGridPrevBtn = document.getElementById("attendance-grid-prev-btn");
const attendanceGridNextBtn = document.getElementById("attendance-grid-next-btn");
const attendanceGridMonthLabel = document.getElementById("attendance-grid-month-label");
const attendanceGridAgeSelect = document.getElementById("attendance-grid-age-select");
const attendanceGridStatus = document.getElementById("attendance-grid-status");
const attendanceGridLegend = document.getElementById("attendance-grid-legend");
const attendanceGridWrap = document.getElementById("attendance-grid-wrap");
const dayTypeSegmented = document.getElementById("day-type-segmented");
const matchDayPanel = document.getElementById("match-day-panel");
const scoreLegend = document.getElementById("score-legend");
const instructionSection = document.getElementById("instruction-section");
const playerGallerySection = document.getElementById("player-gallery-section");
const playerGalleryCount = document.getElementById("player-gallery-count");
const playerGalleryAddBtn = document.getElementById("player-gallery-add-btn");
const playerGalleryChips = document.getElementById("player-gallery-chips");
const playerGallerySearch = document.getElementById("player-gallery-search");
const playerGallerySort = document.getElementById("player-gallery-sort");
const playerGalleryStatus = document.getElementById("player-gallery-status");
const playerGalleryGrid = document.getElementById("player-gallery-grid");
const playerDetailSection = document.getElementById("player-detail-section");
const playerDetailBackBtn = document.getElementById("player-detail-back-btn");
const playerDetailBody = document.getElementById("player-detail-body");
const playerFormBackBtn = document.getElementById("player-form-back-btn");
const coachTabbar = document.getElementById("coach-tabbar");
const coachTabbarInner = document.getElementById("coach-tabbar-inner");
const coachSubtabs = document.getElementById("coach-subtabs");
const coachSubtabsInner = document.getElementById("coach-subtabs-inner");
const coachSubtabs2 = document.getElementById("coach-subtabs2");
const coachSubtabs2Inner = document.getElementById("coach-subtabs2-inner");
const evaluationMenuSection = document.getElementById("evaluation-menu-section");
const physicalTestMenuSection = document.getElementById("physical-test-menu-section");
const physicalInstructionSection = document.getElementById("physical-instruction-section");
const physicalFormSection = document.getElementById("physical-form-section");
const athleteResultsSection = document.getElementById("athlete-results-section");
const profileSection = document.getElementById("profile-section");
const injuryMenuSection = document.getElementById("injury-menu-section");
const injuryResultsSection = document.getElementById("injury-results-section");
const dailyReminderBanner = document.getElementById("daily-reminder-banner");
const homeDateLine = document.getElementById("home-date-line");
const homeAllDone = document.getElementById("home-all-done");
const dailyMeetingCard = document.getElementById("daily-meeting-card");
const dailyExecutiveNotesList = document.getElementById("daily-executive-notes-list");
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
const executiveAttendanceAgeGroupSelect = document.getElementById("executive-attendance-age-group-select");
const executiveAttendanceStatusEl = document.getElementById("executive-attendance-status");
const executiveAttendanceGridWrap = document.getElementById("executive-attendance-grid-wrap");
const executiveAttendanceCoachLabel = document.getElementById("executive-attendance-coach-label");
const coachPlanDetailOverlay = document.getElementById("coach-plan-detail-overlay");
const coachPlanDetailTitleEl = document.getElementById("coach-plan-detail-title");
const coachPlanDetailBody = document.getElementById("coach-plan-detail-body");
const coachPlanDetailCloseBtn = document.getElementById("coach-plan-detail-close-btn");
const executiveNotesList = document.getElementById("executive-notes-list");
const executivePlayersSection = document.getElementById("executive-players-section");
const executivePlayersBackBtn = document.getElementById("executive-players-back-btn");
const executivePlayersGroupsEl = document.getElementById("executive-players-groups");
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
const adminMeetingsSection = document.getElementById("admin-meetings-section");
const adminFitnessRoundsSection = document.getElementById("admin-fitness-rounds-section");
const adminAthleteWindowsSection = document.getElementById("admin-athlete-windows-section");
const fitnessEntrySection = document.getElementById("fitness-entry-section");
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
const notificationMarkAllReadBtn = document.getElementById("notification-mark-all-read-btn");
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
const rosterCompleteBanner = document.getElementById("roster-complete-banner");
const rosterBody = document.getElementById("roster-table-body");
const attendanceStatus = document.getElementById("attendance-status");
const addPlayerForm = document.getElementById("add-player-form");
const addPlayerStatus = document.getElementById("add-player-status");
const addPlayerSubmitBtn = document.getElementById("add-player-submit-btn");
const cancelEditPlayerBtn = document.getElementById("cancel-edit-player-btn");
const playerPhotoInput = document.getElementById("player-photo-input");
const playerPhotoStatus = document.getElementById("player-photo-status");

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
const editCoachPermissionsWrap = document.getElementById("edit-coach-permissions-wrap");
const editCoachPermissionsEl = document.getElementById("edit-coach-permissions");
const progressDateInput = document.getElementById("progress-date-input");
const progressRefreshBtn = document.getElementById("progress-refresh-btn");
const progressTableBody = document.getElementById("progress-table-body");
const progressPie = document.getElementById("progress-pie");
const progressLegend = document.getElementById("progress-legend");
const progressTeamTabs = document.getElementById("progress-team-tabs");

let currentSessionId = null;
let currentSessionData = null;
let currentAttendanceMap = new Map();
// รายงานบาดเจ็บที่ยังไม่หาย ณ วันที่เช็คชื่อ (playerId -> รายงาน) ใช้เติม I/R ให้และเตือนเมื่อกด A ให้คนที่ยังบาดเจ็บอยู่
let activeInjuryMap = new Map();
// ฟอร์มรายงานบาดเจ็บสั้นที่กำลังเปิดอยู่ใต้แถวนักกีฬา (เปิดทีละคน): สถานะที่กดไว้ยังไม่บันทึกจนกว่าจะกดบันทึก/ข้าม
let injuryFormState = null; // { playerId, status, description, severity, error }
const dismissedHealHints = new Set(); // playerId ที่โค้ชปิดคำถาม "หายแล้วใช่ไหม" ไว้ในหน้านี้
let myTeam = null;
// ทีมของบัญชีผู้บริหารทีมจริง (ไม่ใช่การสวมบทบาทของผู้ดูแลระบบ) — เก็บแยกจาก myTeam เพราะ myTeam ต้องเป็น
// null สำหรับผู้บริหารทีมจริงเสมอ (renderDrawerItems ใช้ myTeam ที่มีค่าเป็นสัญญาณว่า "มีเครื่องมือจัดการทีมเต็มรูปแบบ"
// ถ้าตั้ง myTeam ให้ผู้บริหารทีมจริงจะได้เมนูของโค้ชผิดๆ ไปด้วย) ใช้เฉพาะเปิดหน้ารายชื่อนักกีฬาแบบดูอย่างเดียว
let myExecutiveTeam = null;
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
// id ของโค้ช/ผู้บริหารทีมที่ผู้ดูแลระบบสวมบทบาทเป็นอยู่ (ถ้าเจาะจงตัวบุคคล) — เก็บไว้ใน URL hash เพื่อให้รีเฟรชแล้วกลับเข้าโหมดเดิม
let adminViewingCoachId = null;
let players = [];
let editingPlayerId = null;
let currentIsAdmin = false;
// ทีมหลังบ้าน (role = staff): รายการสิทธิ์ของบัญชีนี้ — null = แอดมินหลัก (ไม่จำกัด) หน้าจอ "แอดมิน" ใช้ร่วมกัน แต่เมนู/ปุ่มซ่อนตามสิทธิ์
// (ตัวบังคับจริงคือกฎ Firestore ดู staff-perms.js)
let currentStaffPerms = null;
const adminCan = (feature) => currentIsAdmin && canAccessAdminFeature(feature, currentStaffPerms);
const isStaffSession = () => currentStaffPerms !== null;
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
  document.getElementById("register-staff-hint").classList.toggle("hidden", role !== "staff");
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
  executivePlayersSection.classList.add("hidden");
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
  adminMeetingsSection.classList.add("hidden");
  adminFitnessRoundsSection.classList.add("hidden");
  adminAthleteWindowsSection.classList.add("hidden");
  fitnessEntrySection.classList.add("hidden");
  adminPlayerAuditSection.classList.add("hidden");
  addPlayerSection.classList.add("hidden");
  checkinSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  matchReportSection.classList.add("hidden");
  injuryReportSection.classList.add("hidden");
  trainingPlanSection.classList.add("hidden");
  trainingPlanMenuSection.classList.add("hidden");
  planDataSection.classList.add("hidden");
  reportDataSection.classList.add("hidden");
  dailySection.classList.add("hidden");
  meetingTasksSection.classList.add("hidden");
  meetingMenuSection.classList.add("hidden");
  meetingNextSection.classList.add("hidden");
  meetingHistorySection.classList.add("hidden");
  instructionSection.classList.add("hidden");
  attendanceGridSection.classList.add("hidden");
  matchDataSection.classList.add("hidden");
  matchFormSection.classList.add("hidden");
  matchHistorySection.classList.add("hidden");
  matchSheetSection.classList.add("hidden");
  evaluationMenuSection.classList.add("hidden");
  physicalTestMenuSection.classList.add("hidden");
  physicalInstructionSection.classList.add("hidden");
  physicalFormSection.classList.add("hidden");
  athleteResultsSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  injuryMenuSection.classList.add("hidden");
  injuryResultsSection.classList.add("hidden");
  playerGallerySection.classList.add("hidden");
  playerDetailSection.classList.add("hidden");
}

// ---------- งานหลังประชุม (เมนูของโค้ช) ----------
// หน้าเฉพาะสำหรับกรอกงานหลังประชุมของโค้ช (ฟอร์มและตรรกะอยู่ที่ coach-meetings-ui.js) — ตัวเลขบนเมนูคือจำนวนนัดที่ยังไม่ได้ส่งงาน
let meetingTaskCount = 0;

async function refreshMeetingTaskCount() {
  const coachId = meetingCoachId();
  if (!myTeam || !coachId || currentIsAdmin) return;
  try {
    const { tasks } = await loadCoachMeetingOverview(myTeam, coachId, myCoachPosition);
    meetingTaskCount = tasks.filter((t) => t.status.state === "pending" || t.status.state === "overdue").length;
    renderCoachNav();
  } catch (err) {
    console.error(err);
  }
}

// ---------- Meeting (เมนู 9): หน้าเลือก → Next Meeting / Post-Meeting Tasks / History ----------
function meetingPageOpts() {
  return { position: myCoachPosition, onChange: () => { refreshNotifications(); refreshMeetingTaskCount(); } };
}
function openMeetingMenu() {
  hideAllScreens();
  meetingMenuSection.classList.remove("hidden");
}
async function openMeetingNext() {
  hideAllScreens();
  meetingNextSection.classList.remove("hidden");
  const coachId = meetingCoachId();
  if (!myTeam || !coachId) {
    meetingNextBody.innerHTML = '<div class="card card-pad text-sm text-slate-500">ยังไม่ทราบโค้ช — โหมดจัดการทีมแบบกว้างไม่ได้ระบุโค้ชคนใดคนหนึ่ง</div>';
    return;
  }
  await renderCoachNextMeeting(meetingNextBody, myTeam, coachId, meetingPageOpts());
}
function renderMeetingHistory() {
  const coachId = meetingCoachId();
  if (!myTeam || !coachId) {
    meetingHistoryBody.innerHTML = '<div class="card card-pad text-sm text-slate-500">ยังไม่ทราบโค้ช — โหมดจัดการทีมแบบกว้างไม่ได้ระบุโค้ชคนใดคนหนึ่ง</div>';
    return Promise.resolve();
  }
  return renderCoachMeetingHistory(meetingHistoryBody, myTeam, coachId, meetingHistoryMonth.value, meetingPageOpts());
}
async function openMeetingHistory() {
  hideAllScreens();
  meetingHistorySection.classList.remove("hidden");
  if (!meetingHistoryMonth.options.length) {
    const thisMonth = thisMonthBangkok();
    // เดือนหน้า (นัดที่ผู้ดูแลสร้างล่วงหน้า) + เดือนนี้ย้อนหลัง 12 เดือน
    const months = [addMonthsToMonth(thisMonth, 1), ...Array.from({ length: 13 }, (_, i) => addMonthsToMonth(thisMonth, -i))];
    meetingHistoryMonth.innerHTML = months.map((m) => `<option value="${m}">${escapeHtml(thaiMonthLabel(m))}</option>`).join("");
    meetingHistoryMonth.value = thisMonth;
  }
  await renderMeetingHistory();
}
meetingHistoryMonth.addEventListener("change", renderMeetingHistory);
for (const btn of document.querySelectorAll("[data-meeting-nav]")) btn.addEventListener("click", () => COACH_SCREEN_OPENERS[btn.dataset.meetingNav]?.());
for (const btn of document.querySelectorAll("[data-meeting-back]")) btn.addEventListener("click", openMeetingMenu);

async function openMeetingTasksSection() {
  hideAllScreens();
  meetingTasksSection.classList.remove("hidden");
  const coachId = meetingCoachId();
  if (!myTeam || !coachId) {
    meetingTasksBody.innerHTML = '<div class="card card-pad text-sm text-slate-500">ยังไม่ทราบโค้ชที่ต้องส่งงาน</div>';
    return;
  }
  await renderCoachMeetingTasks(meetingTasksBody, myTeam, coachId, {
    position: myCoachPosition,
    onChange: () => {
      refreshNotifications();
      refreshMeetingTaskCount();
    }
  });
  refreshMeetingTaskCount();
}
// หน้าแรกหลังล็อกอินสำหรับโค้ช (และผู้ดูแลระบบที่กำลังจัดการทีมใดทีมหนึ่งอยู่) — แทนที่เมนูการ์ดแบบเดิม
function showDaily() {
  hideAllScreens();
  dailySection.classList.remove("hidden");
  homeDateLine.textContent = formatThaiDate(todayBangkok());
  checkTodayReminders();

  renderCoachMeetingCard(dailyMeetingCard, myTeam, meetingCoachId(), {
    position: myCoachPosition,
    onChange: () => {
      refreshNotifications();
      refreshMeetingTaskCount();
    }
  });
  loadExecutiveNotes(myTeam, dailyExecutiveNotesList);
}

function formatThaiDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// เตือนงานประจำวันที่ยังไม่ได้ทำของ "วันนี้" (หน้า Home — หน้าแรกของโค้ช) เพื่อกันลืมเช็คชื่อ/ส่งแผน/ส่งรายงาน โดยไม่ต้องรอผู้ดูแลระบบ
// ส่งข้อความเตือนย้อนหลัง ตรวจแค่ "เริ่มทำหรือยัง" ไม่ตรวจความครบถ้วน (มีระบบแจ้งเตือนของผู้ดูแลระบบดูแลส่วนนั้นอยู่แล้ว)
// เตือนแผนฝึกเฉพาะวันฝึกซ้อมปกติของทีมที่ไม่ได้ถูกทำเครื่องหมาย "ไม่มีซ้อม" และยังไม่มีแผนของรุ่นที่ดูแลในวันนี้
async function checkTodayReminders() {
  if (!myTeam) return;
  const todayStr = todayBangkok();
  dailyReminderBanner.classList.add("hidden");
  dailyReminderBanner.innerHTML = "";
  homeAllDone.classList.add("hidden");
  try {
    const [session, reportSnap, planSnap] = await Promise.all([
      findSession(todayStr),
      getDocs(query(collection(db, "trainingReports"), where("team", "==", myTeam), where("date", "==", todayStr))),
      getDocs(query(collection(db, "trainingPlans"), where("team", "==", myTeam), where("date", "==", todayStr)))
    ]);

    const reminders = [];
    if (!session) {
      reminders.push({ text: "ยังไม่ได้เช็คชื่อการฝึกซ้อมวันนี้", action: openCheckinSection });
    }
    const [y, m, d] = todayStr.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const trainsToday = (TEAM_TRAINING_WEEKDAYS[myTeam] || []).includes(weekday);
    const hasMyPlan = planSnap.docs.some((p) => {
      const groups = p.data().ageGroups || [];
      return myAgeGroups.length === 0 || groups.some((g) => myAgeGroups.includes(g));
    });
    if (trainsToday && !session?.noTraining && !hasMyPlan) {
      reminders.push({ text: "ยังไม่ได้ส่งแผนการฝึกซ้อมวันนี้", action: openTrainingPlanSection });
    }
    if (reportSnap.empty) {
      reminders.push({ text: "ยังไม่ได้ส่งรายงานการฝึกซ้อมวันนี้", action: openReportSection });
    }
    if (reminders.length === 0) {
      homeAllDone.classList.remove("hidden");
      return;
    }

    dailyReminderBanner.innerHTML = `<p class="text-sm font-semibold text-amber-800 mb-1">${icon("bell")} สิ่งที่ยังไม่ได้ทำวันนี้</p>`;
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

function meetingCoachId() {
  return currentIsAdmin ? adminViewingCoachId : auth.currentUser?.uid || null;
}

// กระดิ่งของโค้ช: แจ้งนัดประชุมโค้ชที่เหลือไม่เกิน 3 วัน (ผู้บริหารทีมยังไม่เปิดใช้งาน)
async function refreshCoachNotifications() {
  if (!myTeam || !meetingCoachId()) return;
  try {
    currentNotifications = await loadCoachMeetingNotifications(myTeam, meetingCoachId(), myCoachPosition);
    renderAdminNotifications(notificationList, currentNotifications);
    notificationBadge.classList.toggle("hidden", currentNotifications.length === 0);
  } catch (err) {
    console.error(err);
  }
}

async function refreshNotifications() {
  if (isStaffSession()) return; // การแจ้งเตือนของแอดมินอ่านข้อมูลที่เฉพาะแอดมินหลักเข้าถึงได้ (adminNotificationReads ฯลฯ)
  if (!currentIsAdmin) return refreshCoachNotifications();
  notificationList.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">กำลังโหลด...</p>';
  try {
    currentNotifications = await loadAdminNotifications();
    renderAdminNotifications(notificationList, currentNotifications);
    const unreadCount = currentNotifications.filter((n) => !n.read).length;
    notificationBadge.classList.toggle("hidden", unreadCount === 0);
  } catch (err) {
    console.error(err);
    notificationList.innerHTML = `<p class="text-red-600 text-sm text-center py-6">โหลดการแจ้งเตือนไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

notificationBellBtn.addEventListener("click", () => {
  const opening = notificationPanel.classList.contains("hidden");
  notificationPanel.classList.toggle("hidden", !opening);
  if (opening) refreshNotifications();
});
notificationRefreshBtn.addEventListener("click", refreshNotifications);

// "อ่านทั้งหมด" — ปิดปุ่มระหว่างเขียน กันกดซ้ำระหว่างที่ยังเขียน Firestore ไม่เสร็จ
notificationMarkAllReadBtn.addEventListener("click", async () => {
  if (currentNotifications.every((n) => n.read)) return;
  notificationMarkAllReadBtn.disabled = true;
  try {
    await markAllNotificationsRead(currentNotifications);
    await refreshNotifications();
  } catch (err) {
    console.error(err);
    alert("ทำเครื่องหมายว่าอ่านทั้งหมดไม่สำเร็จ: " + err.message);
  } finally {
    notificationMarkAllReadBtn.disabled = false;
  }
});

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

function drawerItem(iconHtml, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "drawer-item";
  btn.innerHTML = `<span class="drawer-item-icon">${iconHtml}</span><span>${label}</span>`;
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
  adminViewingCoachId = null;
  // สลับป้ายบทบาท + ชื่อ/อีเมลกลับเป็นของผู้ดูแลระบบเองตามเดิม (ตรงข้ามกับที่เขียนทับด้วยข้อมูลของโค้ช/
  // ผู้บริหารทีมที่สวมบทบาทไว้ตอนเข้า enterTeamManagementMode / enterExecutiveViewMode)
  coachRoleBadgeEl.textContent = isStaffSession() ? "ทีมหลังบ้าน" : "ผู้ดูแลระบบ";
  coachRoleBadgeEl.className = isStaffSession() ? "badge badge-warning" : "badge badge-info";
  coachNameEl.textContent = adminOwnName;
  coachEmailEl.textContent = adminOwnEmail;
  coachStatusBadgeEl.innerHTML = '<span class="badge badge-success">อนุมัติแล้ว</span>';
  coachTeamEl.textContent = isStaffSession() ? "เข้าถึงตามสิทธิ์ที่ได้รับ" : "เข้าถึงได้ทุกทีม";
  coachAgeGroupsWrap.classList.add("hidden");
  renderDrawerItems();
}

// เนื้อหาเมนูปรับตามบทบาทและบริบทปัจจุบัน (โค้ช / ผู้บริหารทีม / ผู้ดูแลระบบ, กำลังจัดการทีมอยู่หรือไม่)
// เมนูหลักของโค้ชถูกวาง 2 ที่: แถบแนวนอนใต้หัวหน้า (คอมพิวเตอร์) และรายการใน ☰ (มือถือ) — ธีมสีทีม/แถบเมนูอัปเดตทุกครั้งที่เมนูถูกวาดใหม่
// (เข้าสู่ระบบ สวมบทบาท/ออกจากบทบาท) และทุกครั้งที่หน้าจอเปลี่ยน (ดู routeObserver ด้านล่าง)
function renderDrawerItems() {
  renderDrawerItemsInner();
  applyTeamTheme(coachNavVisible() ? myTeam : null);
  renderCoachNav();
}

function renderDrawerItemsInner() {
  // ซิงก์ป้ายบทบาทจากแถบข้อมูลโค้ช (coach-bar) เข้ามาในลิ้นชักด้วย เพราะกำหนดค่าหลังจุดที่เรียก
  // renderCoachProfile() เสมอ (renderDrawerItems ถูกเรียกทีหลังในทุกกรณี จึงอ่านค่าล่าสุดได้ตรงกัน)
  navDrawerRoleBadgeEl.innerHTML = coachRoleBadgeEl.outerHTML;
  navDrawerItems.innerHTML = "";

  if (currentIsAdmin) {
    if (myTeam && adminViewingAs === "executive") {
      // สวมบทบาทเป็นผู้บริหารทีม (ดูอย่างเดียว) — เมนูเหมือนที่ผู้บริหารทีมจริงเห็นทุกประการ (มีแค่ทาง
      // ไป Dashboard) บวกทางกลับแผงควบคุมผู้ดูแลระบบเพิ่มมาให้ (ผู้บริหารทีมจริงไม่มีปุ่มนี้)
      navDrawerItems.appendChild(drawerSectionLabel(`ผู้บริหารทีม: ${teamLogoImg(myTeam)}${myTeam}`));
      navDrawerItems.appendChild(drawerItem(icon("users"), "รายชื่อนักกีฬาในทีม", () => openExecutivePlayersSection(myTeam)));
      navDrawerItems.appendChild(drawerItem(icon("bar-chart"), "Dashboard", goToDashboard));
      navDrawerItems.appendChild(drawerDivider());
      navDrawerItems.appendChild(drawerItem(icon("shield"), "กลับแผงควบคุมผู้ดูแลระบบ", exitTeamManagementToAdminPanel));
    } else if (myTeam) {
      navDrawerItems.appendChild(drawerSectionLabel(`จัดการทีม: ${teamLogoImg(myTeam)}${myTeam}`));
      appendCoachMenuToDrawer();
      navDrawerItems.appendChild(drawerDivider());
      navDrawerItems.appendChild(drawerItem(icon("shield"), "กลับแผงควบคุมผู้ดูแลระบบ", exitTeamManagementToAdminPanel));
    } else {
      // เมนูของแผงผู้ดูแลระบบ: แอดมินหลักเห็นครบ ทีมหลังบ้านเห็นเฉพาะที่มีสิทธิ์ (ซ่อนเมนูอย่างเดียว — ตัวบังคับจริงคือกฎ Firestore)
      navDrawerItems.appendChild(drawerSectionLabel(isStaffSession() ? "ทีมหลังบ้าน" : "ผู้ดูแลระบบ"));
      const adminItems = [
        ["coaches", "users", "รายชื่อโค้ชในระบบ", openAdminCoachesSection],
        ["player-audit", "search", "ตรวจสอบข้อมูลนักกีฬาที่ผิดปกติ", openAdminPlayerAuditSection],
        ["progress", "trending-up", "ความคืบหน้าเช็คชื่อรายวัน", openAdminProgressSection],
        ["approvals", "file-text", "คำขอลงทะเบียนรออนุมัติ", openAdminApprovalsSection],
        ["matches", "football", "รายงานผลการแข่งขันทั้งหมด", openAdminMatchesSection],
        ["injuries", "heart-pulse", "รายงานอาการบาดเจ็บทั้งหมด", openAdminInjuriesSection],
        ["dashboard", "bar-chart", "เลือกทีมเพื่อดู Dashboard", goToDashboard],
        ["print", "printer", "พิมพ์สรุปผลงานโค้ช", openAdminPrintSection],
        ["report-card", "book", "สมุดพกนักกีฬา", openAdminReportCardSection],
        ["masc-rounds", "dna", "กำหนดรอบการประเมิน MASC", openAdminMascRoundsSection],
        ["meetings", "calendar", "นัดประชุมโค้ชรายสัปดาห์", openAdminMeetingsSection],
        ["fitness-rounds", "trending-up", "รอบทดสอบสมรรถภาพ", openAdminFitnessRoundsSection],
        ["athlete-windows", "book", "เปิดสมุดพกให้โค้ช", openAdminAthleteWindowsSection],
        ["development", "trending-up", "พัฒนาการนักกีฬา", () => (window.location.href = "./development.html")]
      ];
      for (const [feature, iconName, label, handler] of adminItems) {
        // "development" (หน้าพัฒนาการนักกีฬา) เป็นของแอดมินหลักเท่านั้น — ไม่อยู่ในตารางสิทธิ์ของทีมหลังบ้าน
        if (feature === "development" ? isStaffSession() : !adminCan(feature)) continue;
        navDrawerItems.appendChild(drawerItem(icon(iconName), label, handler));
      }
    }
    return;
  }

  if (myTeam) {
    navDrawerItems.appendChild(drawerSectionLabel(`ทีม: ${teamLogoImg(myTeam)}${myTeam}`));
    appendCoachMenuToDrawer();
    navDrawerItems.appendChild(drawerDivider());
    navDrawerItems.appendChild(drawerItem(icon("bar-chart"), "Dashboard", goToDashboard));
    return;
  }

  // ผู้บริหารทีม (ดูข้อมูลอย่างเดียว ไม่มีเครื่องมือจัดการทีม) หรือกรณีอื่นที่ยังไม่ทราบทีม
  navDrawerItems.appendChild(drawerSectionLabel("เมนู"));
  if (myExecutiveTeam) {
    navDrawerItems.appendChild(
      drawerItem(icon("users"), "รายชื่อนักกีฬาในทีม", () => openExecutivePlayersSection(myExecutiveTeam))
    );
  }
  navDrawerItems.appendChild(drawerItem(icon("bar-chart"), "Dashboard", goToDashboard));
}

// ---------- เมนูหลักของโค้ช 9 รายการ (รายการและการจับคู่หน้าจออยู่ที่ coach-menu.js) ----------
const COACH_SCREEN_OPENERS = {
  instruction: () => openInstructionSection(),
  "attendance-grid": () => openAttendanceGrid(),
  players: () => openPlayerGallery(),
  checkin: () => openCheckinSection(),
  daily: () => showDaily(),
  "training-plan": () => openTrainingPlanLanding(),
  plan: () => openTrainingPlanSection(),
  "plan-data": () => openPlanData(),
  report: () => openReportSection(),
  "report-data": () => openReportData(),
  match: () => openMatchDataLanding(), // ฟอร์มรายงานผลเดิมถูกแทนที่ด้วย Match Data แล้ว
  "match-data": () => openMatchDataLanding(),
  "match-form": () => openMatchForm(),
  "match-history": () => openMatchHistory(),
  "match-sheet": () => openMatchHistory(),
  injury: () => openInjuryReportSection(),
  fitness: () => openFitnessEntrySection(),
  evaluation: () => openEvaluationLanding(),
  "physical-test": () => openPhysicalTestLanding(),
  "physical-instruction": () => openPhysicalInstruction(),
  "physical-form": () => openPhysicalForm(),
  "athlete-results": () => openAthleteResultsSection(),
  profile: () => openProfileSection(),
  "injury-menu": () => openInjuryMenu(),
  "injury-results": () => openInjuryResults(),
  masc: () => openMascPage(),
  "meeting-menu": () => openMeetingMenu(),
  "meeting-next": () => openMeetingNext(),
  "meeting-tasks": () => openMeetingTasksSection(),
  "meeting-history": () => openMeetingHistory()
};

// หน้าประเมิน MASC เป็นหน้าแยก (masc.html) — ผู้ดูแลระบบที่สวมบทบาทโค้ชแนบรุ่นอายุ/ตำแหน่งของโค้ชคนนั้นไปด้วย เพื่อให้เห็นรายชื่อตรงกับที่โค้ชเห็นจริง
function openMascPage() {
  if (!currentIsAdmin) {
    window.location.href = "./masc.html";
    return;
  }
  const params = new URLSearchParams({ team: myTeam });
  if (myAgeGroups.length > 0) params.set("ageGroups", myAgeGroups.join(","));
  if (myCoachPosition) params.set("coachPosition", myCoachPosition);
  window.location.href = `./masc.html#${params.toString()}`;
}

// เมนูของโค้ชใช้ตอนมีทีมที่ดูแลอยู่ (โค้ชจริง หรือผู้ดูแลระบบ/ทีมหลังบ้านที่สวมบทบาทโค้ช) — โหมดผู้บริหารทีมไม่ใช้
function coachNavVisible() {
  return !!myTeam && !(currentIsAdmin && adminViewingAs === "executive");
}

function currentScreenKey() {
  return ROUTE_SCREENS.find((s) => !s.el.classList.contains("hidden"))?.key ?? null;
}

// เมนูย่อยของเมนูหนึ่ง (ทีมหลังบ้านไม่เห็น MASC เหมือนเดิม)
function coachChildren(menu) {
  return (menu.children || []).filter((c) => !(c.external === "masc" && isStaffSession()));
}

function openCoachMenuItem(key) {
  const menu = menuItem(key);
  if (menu) COACH_SCREEN_OPENERS[menu.screen]?.();
}

function menuBadgeHtml(key) {
  return key === "meeting" && meetingTaskCount > 0 ? ` <span class="badge badge-warning">${meetingTaskCount}</span>` : "";
}

function appendCoachMenuToDrawer() {
  const wrap = document.createElement("div");
  wrap.className = "coach-drawer-menu";
  const active = menuKeyForScreen(currentScreenKey());
  const screen = currentScreenKey();
  for (const menu of COACH_MENU) {
    const btn = drawerItem(icon(menu.icon), `${menu.label}<span class="drawer-hint">${menu.hint}</span>${menuBadgeHtml(menu.key)}`, () => openCoachMenuItem(menu.key));
    if (menu.key === active) btn.classList.add("active");
    wrap.appendChild(btn);
    for (const child of coachChildren(menu)) {
      const sub = drawerItem("", child.disabled ? `${child.label} <span class="badge badge-warning">เร็วๆ นี้</span>` : child.label, child.disabled ? () => {} : child.external ? openMascPage : COACH_SCREEN_OPENERS[child.screen]);
      sub.classList.add("drawer-subitem");
      if (child.disabled) sub.classList.add("coach-subtab-off");
      if (childMatchesScreen(child, screen)) sub.classList.add("active");
      wrap.appendChild(sub);
      // เมนูย่อยชั้นที่ 2 (Physical Test → Instruction / Testing Form / Data Entry) เยื้องเข้าไปอีกชั้น
      for (const grand of child.children || []) {
        const sub2 = drawerItem("", grand.label, COACH_SCREEN_OPENERS[grand.screen]);
        sub2.classList.add("drawer-subitem", "drawer-subitem2");
        if (childMatchesScreen(grand, screen)) sub2.classList.add("active");
        wrap.appendChild(sub2);
      }
    }
  }
  navDrawerItems.appendChild(wrap);
}

function renderCoachNav() {
  const visible = coachNavVisible();
  coachTabbar.classList.toggle("is-on", visible);
  // การ์ดชื่อโค้ช (coach-bar) ไม่แสดงในหน้าของเมนูโค้ช — ข้อมูลอยู่ที่เมนู Profile (ยังอยู่ใน DOM เพราะลิ้นชักดึงชื่อ/ป้ายบทบาทจากที่นี่)
  coachBar.classList.toggle("coach-bar-off", visible);
  if (!visible) {
    coachTabbarInner.innerHTML = "";
    coachSubtabsInner.innerHTML = "";
    coachSubtabs.classList.remove("is-on");
    coachSubtabs2Inner.innerHTML = "";
    coachSubtabs2.classList.remove("is-on");
    return;
  }
  const screen = currentScreenKey();
  const active = menuKeyForScreen(screen);
  const tabs = COACH_MENU.map((menu) => {
    const cls = menu.key === active ? "coach-tab active" : "coach-tab";
    return `<button type="button" class="${cls}" data-menu="${menu.key}" title="${escapeHtml(menu.hint)}">${icon(menu.icon)} ${menu.label}${menuBadgeHtml(menu.key)}</button>`;
  });
  if (!currentIsAdmin) tabs.push(`<button type="button" class="coach-tab" data-menu="dashboard" style="margin-left:auto">${icon("bar-chart")} Dashboard</button>`);
  coachTabbarInner.innerHTML = tabs.join("");

  const subtabHtml = (child) => {
    if (child.disabled) return `<button type="button" class="coach-subtab coach-subtab-off" data-sub-off title="เร็วๆ นี้">${escapeHtml(child.label)}</button>`;
    const cls = childMatchesScreen(child, screen) ? "coach-subtab active" : "coach-subtab";
    return `<button type="button" class="${cls}" data-sub-screen="${child.screen ?? ""}" data-sub-external="${child.external ?? ""}">${escapeHtml(child.label)}</button>`;
  };
  const menu = active ? menuItem(active) : null;
  const children = menu ? coachChildren(menu) : [];
  coachSubtabsInner.innerHTML = children.map(subtabHtml).join("");
  coachSubtabs.classList.toggle("is-on", children.length > 0);

  // แถบแถวที่สอง: เมนูย่อยของเมนูย่อยที่เปิดอยู่ (เช่น Physical Test)
  const grandChildren = activeChildFor(menu, screen)?.children ?? [];
  coachSubtabs2Inner.innerHTML = grandChildren.map(subtabHtml).join("");
  coachSubtabs2.classList.toggle("is-on", grandChildren.length > 0);
}

coachTabbarInner.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-menu]");
  if (!btn) return;
  if (btn.dataset.menu === "dashboard") goToDashboard();
  else openCoachMenuItem(btn.dataset.menu);
});

for (const row of [coachSubtabsInner, coachSubtabs2Inner]) {
  row.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.hasAttribute("data-sub-off")) return;
    if (btn.dataset.subExternal === "masc") openMascPage();
    else COACH_SCREEN_OPENERS[btn.dataset.subScreen]?.();
  });
}

// ---------- Match Data (เมนู 6) ----------
let pendingMatchDayAgeGroup = null; // รุ่นที่ให้ Match Day เปิดก่อน (ตอนกด "แก้ไขใน Match Day" จากรายงานผล)

function openMatchDataLanding() {
  hideAllScreens();
  matchDataSection.classList.remove("hidden");
}
function openMatchForm() {
  hideAllScreens();
  matchFormSection.classList.remove("hidden");
  showMatchForm();
}
function openMatchHistory() {
  hideAllScreens();
  matchHistorySection.classList.remove("hidden");
  showMatchHistory();
}

// กดแก้ไขจากรายงานผล: ไปหน้า Attendance Check ของวันนั้น เลือก Match Day และเปิดรุ่นอายุของนัดนั้น
async function openMatchDayFor(date, ageGroup) {
  openCheckinSection();
  dateInput.value = date;
  pendingMatchDayAgeGroup = ageGroup;
  await chooseDayType("match");
}

initMatchData({
  team: () => myTeam,
  ageGroups: () => myAgeGroups,
  open: (screen) => (screen === "match-form" ? openMatchForm() : openMatchHistory()),
  show: (screen) => {
    hideAllScreens();
    (screen === "match-sheet" ? matchSheetSection : matchHistorySection).classList.remove("hidden");
  },
  editMatchDay: openMatchDayFor,
  ensureSession: (date) => findOrCreateSession(date)
});

for (const btn of document.querySelectorAll("[data-match-data-back]")) btn.addEventListener("click", openMatchDataLanding);

// ---------- Attendance (เมนู 4): ตารางเช็คชื่อรายเดือนของรุ่นอายุที่โค้ชดูแล — ตรรกะ/สีอยู่ที่ attendance-grid.js ----------
let attendanceGridMonth = "";
let attendanceGridData = null; // { attendanceRecords, sessions, matchReports, coaches } ของเดือนที่โหลดล่าสุด

function renderAttendanceGridView() {
  const groups = ageGroupsOf(players);
  if (groups.length === 0) {
    attendanceGridAgeSelect.innerHTML = "";
    attendanceGridWrap.innerHTML = '<p class="px-4 py-6 text-center text-slate-400 text-sm">ยังไม่มีนักกีฬาในความดูแล</p>';
    attendanceGridCoachLabel.textContent = "สรุปการเข้าซ้อมรายเดือน";
    return;
  }
  const keep = groups.includes(attendanceGridAgeSelect.value) ? attendanceGridAgeSelect.value : groups[0];
  attendanceGridAgeSelect.innerHTML = groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  attendanceGridAgeSelect.value = keep;
  const coaches = (attendanceGridData.coaches || []).filter((c) => (c.ageGroups || []).includes(keep));
  attendanceGridCoachLabel.textContent =
    coaches.length > 0 ? `โค้ชผู้รับผิดชอบ: ${coaches.map((c) => `${c.name ?? "-"} (${coachPositionLabel(c.coachPosition)})`).join(", ")}` : "สรุปการเข้าซ้อมรายเดือน";
  const rosterOfGroup = filterAndSortPlayers(players, { ageGroup: keep, sort: "number" });
  const grid = buildAttendanceGrid({
    month: attendanceGridMonth,
    ageGroup: keep,
    players: rosterOfGroup,
    attendanceRecords: attendanceGridData.attendanceRecords,
    sessions: attendanceGridData.sessions,
    matchReports: attendanceGridData.matchReports,
    weekdays: TEAM_TRAINING_WEEKDAYS[myTeam],
    today: todayBangkok()
  });
  attendanceGridWrap.innerHTML = gridHtml(grid);
}

async function loadAttendanceGrid() {
  attendanceGridMonthLabel.textContent = thaiMonthLabel(attendanceGridMonth);
  attendanceGridStatus.textContent = "กำลังโหลด...";
  attendanceGridWrap.innerHTML = '<p class="px-4 py-6 text-center text-slate-400 text-sm">กำลังโหลด...</p>';
  try {
    const { start, end } = monthDateRange(attendanceGridMonth);
    const [attSnap, sessionSnap, matchSnap, coachSnap] = await Promise.all([
      getDocs(teamDateRangeQuery("attendance", myTeam, start, end)),
      getDocs(teamDateRangeQuery("sessions", myTeam, start, end)),
      getDocs(teamDateRangeQuery("matchReports", myTeam, start, end)),
      getDocs(query(collection(db, "coaches"), where("team", "==", myTeam), where("role", "==", "coach")))
    ]);
    attendanceGridData = {
      attendanceRecords: attSnap.docs.map((d) => d.data()),
      sessions: sessionSnap.docs.map((d) => d.data()),
      matchReports: matchSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      coaches: coachSnap.docs.map((d) => d.data())
    };
    attendanceGridStatus.textContent = "";
    renderAttendanceGridView();
  } catch (err) {
    console.error(err);
    attendanceGridStatus.textContent = "";
    attendanceGridWrap.innerHTML = `<p class="px-4 py-6 text-center text-red-600 text-sm">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

function openAttendanceGrid() {
  hideAllScreens();
  attendanceGridSection.classList.remove("hidden");
  attendanceGridLegend.innerHTML = legendHtml();
  if (!attendanceGridMonth) attendanceGridMonth = thisMonthBangkok();
  loadAttendanceGrid();
}

attendanceGridPrevBtn.addEventListener("click", () => {
  attendanceGridMonth = addMonthsToMonth(attendanceGridMonth, -1);
  loadAttendanceGrid();
});
attendanceGridNextBtn.addEventListener("click", () => {
  attendanceGridMonth = addMonthsToMonth(attendanceGridMonth, 1);
  loadAttendanceGrid();
});
attendanceGridAgeSelect.addEventListener("change", () => {
  if (attendanceGridData) renderAttendanceGridView();
});

function openInstructionSection() {
  hideAllScreens();
  instructionSection.classList.remove("hidden");
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
    progressDateInput.value = todayBangkok();
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
        <td class="emphasis">${teamLogoImg(m.team)}${escapeHtml(m.team ?? "-")}</td>
        <td>${escapeHtml(m.date ?? "-")}</td>
        <td>${escapeHtml(m.opponent ?? "-")}</td>
        <td>${escapeHtml(m.competitionType ?? "-")}</td>
        <td>${escapeHtml(m.ageGroup ?? "-")}</td>
        <td>${matchResultBadge(m.result)}</td>
        <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
        <td>${escapeHtml(m.competition ?? "-")}</td>
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
        <td class="emphasis">${teamLogoImg(inj.team)}${escapeHtml(inj.team ?? "-")}</td>
        <td>${escapeHtml(inj.date ?? "-")}</td>
        <td>${escapeHtml(inj.playerName ?? "-")}</td>
        <td>${escapeHtml(inj.ageGroup ?? "-")}</td>
        <td>${escapeHtml(inj.description ?? "-")}</td>
        <td>${injurySeverityBadge(inj.severity)}</td>
        <td>${injuryStatusBadge(inj.status)}</td>
        <td>${escapeHtml(inj.expectedReturn ?? "-")}</td>
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
    adminPrintMonthSelect.value = thisMonthBangkok(); // "YYYY-MM" — ค่าเริ่มต้นเป็นเดือนนี้
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
  return monthsAgoBangkok(n);
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
  const todayStr = todayBangkok();
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
      groups.map((g) => `<span class="badge badge-warning">${teamLogoImg(g.team)}${escapeHtml(g.team)} · ${escapeHtml(g.ageGroup)}: ${g.done}/${g.total}</span>`).join("") +
      "</div>";
  } catch (err) {
    console.error(err);
    adminMascRoundCorrectionSummary.innerHTML = `<p class="text-red-600">ตรวจสอบไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
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

// ---------- Evaluation (เมนู 7) ----------
function openEvaluationLanding() {
  hideAllScreens();
  evaluationMenuSection.classList.remove("hidden");
}
function openPhysicalTestLanding() {
  hideAllScreens();
  physicalTestMenuSection.classList.remove("hidden");
}
function openPhysicalInstruction() {
  hideAllScreens();
  physicalInstructionSection.classList.remove("hidden");
  showInstruction();
}
function openPhysicalForm() {
  hideAllScreens();
  physicalFormSection.classList.remove("hidden");
  showTestingForm();
}
// ---------- Profile (เมนู 10) ----------
// เอกสารโค้ชที่หน้า Profile แสดง: โค้ชจริง = เอกสารของตัวเอง, แอดมินสวมบทบาท = โค้ชที่เลือก (โหมดจัดการทีมแบบกว้างไม่ระบุตัว = null)
let currentCoachRecord = null;

async function profileTaskCount() {
  const coachId = meetingCoachId();
  if (!myTeam || !coachId) return null;
  const { tasks } = await loadCoachMeetingOverview(myTeam, coachId, myCoachPosition);
  return tasks.filter((t) => t.status.state === "pending" || t.status.state === "overdue").length;
}

function openProfileSection() {
  hideAllScreens();
  profileSection.classList.remove("hidden");
  showProfile();
}

initProfile({ record: () => currentCoachRecord, team: () => myTeam, taskCount: profileTaskCount });

function openAthleteResultsSection() {
  hideAllScreens();
  athleteResultsSection.classList.remove("hidden");
  showAthleteResults();
}

initPhysical({ team: () => myTeam, ageGroups: () => myAgeGroups, canBypass: () => currentIsAdmin });
for (const btn of document.querySelectorAll("[data-eval-nav]")) btn.addEventListener("click", () => COACH_SCREEN_OPENERS[btn.dataset.evalNav]?.());
for (const btn of document.querySelectorAll("[data-eval-back]")) btn.addEventListener("click", openEvaluationLanding);
for (const btn of document.querySelectorAll("[data-physical-back]")) btn.addEventListener("click", openPhysicalTestLanding);

function openFitnessEntrySection() {
  hideAllScreens();
  fitnessEntrySection.classList.remove("hidden");
  openFitnessEntry({
    team: myTeam,
    coachId: auth.currentUser.uid,
    coachName: myCoachName || auth.currentUser.email,
    ageGroups: myAgeGroups,
    isAdmin: currentIsAdmin
  });
}

function openAdminAthleteWindowsSection() {
  hideAllScreens();
  adminAthleteWindowsSection.classList.remove("hidden");
  openAdminAthleteWindows({ teams: TEAMS });
}

function openAdminFitnessRoundsSection() {
  hideAllScreens();
  adminFitnessRoundsSection.classList.remove("hidden");
  openAdminFitnessRounds();
}

function openAdminMeetingsSection() {
  hideAllScreens();
  adminMeetingsSection.classList.remove("hidden");
  openAdminMeetings({ staffMode: isStaffSession() });
}

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
      `<tr><td colspan="5" class="px-4 py-6 text-center text-red-600">โหลดไม่สำเร็จ: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ---------- ผู้ดูแลระบบ: ความคืบหน้าการประเมิน MASC แยกทีม/รุ่น สำหรับรอบที่เลือก ----------
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
    .map((r) => `<option value="${r.id}">${r.label} (${escapeHtml(r.startDate)} – ${escapeHtml(r.endDate)}) · ${mascRoundStatus(r).label}</option>`)
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
    mascProgressBody.innerHTML = `<p class="text-sm text-red-600 py-4 text-center">โหลดไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
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
  const nameChip = (p, cls) => `<span class="badge ${cls}">${escapeHtml(p.nickname || p.fullName || "-")}</span>`;
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
            <span>รุ่น ${escapeHtml(ag)}</span>
            <span class="badge ${badgeClass}">${done.length}/${total} คน</span>
          </summary>
          <div class="masc-progress-columns">
            <div>
              <p class="masc-progress-col-title">${icon("check-circle")} ประเมินครบแล้ว (${done.length})</p>
              <div class="masc-progress-names">${doneChips}</div>
            </div>
            <div>
              <p class="masc-progress-col-title">${icon("clock")} ยังไม่ประเมิน / ยังไม่ครบ (${partial.length + notStarted.length})</p>
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
          <td>${escapeHtml(r.startDate ?? "-")}</td>
          <td>${escapeHtml(r.endDate ?? "-")}</td>
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

// "หน้านักกีฬา" = แกลเลอรีของเมนู Player Data (ฟอร์มเพิ่ม/แก้ไขเปิดจากปุ่มในแกลเลอรี/หน้ารายละเอียด — ดู openPlayerForm)
function openAddPlayerSection() {
  openPlayerGallery();
}

function openCheckinSection() {
  hideAllScreens();
  checkinSection.classList.remove("hidden");
  resetDayType();
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
    reportDateInput.value = todayBangkok();
  }
  loadReportHistory();
}

function openMatchReportSection() {
  hideAllScreens();
  matchReportSection.classList.remove("hidden");
  stopEditMatch();
  renderMatchReportList();
  // โหลดนักกีฬาทุกรุ่น/ทุกตำแหน่งของทีมไว้ให้เลือก 11 ตัวจริง (รวม GK และผู้เล่นรุ่นอื่นที่ดึงขึ้นมา)
  loadMatchPlayerPool().then(renderMatchGuestControls);
}

// ---------- Injury/Sick (เมนู 8): หน้าเลือก → Recording (ฟอร์มเดิม) / Results (สรุปผลและกราฟ) ----------
function openInjuryMenu() {
  hideAllScreens();
  injuryMenuSection.classList.remove("hidden");
}
function openInjuryResults() {
  hideAllScreens();
  injuryResultsSection.classList.remove("hidden");
  showResults();
}
for (const btn of document.querySelectorAll("[data-injury-nav]")) btn.addEventListener("click", () => COACH_SCREEN_OPENERS[btn.dataset.injuryNav]?.());
for (const btn of document.querySelectorAll("[data-injury-back]")) btn.addEventListener("click", openInjuryMenu);

function openInjuryReportSection() {
  hideAllScreens();
  injuryReportSection.classList.remove("hidden");
  stopEditInjury();
  renderInjuryReportList();
}


for (const btn of backButtons) {
  btn.addEventListener("click", () => {
    if (editingPlayerId) stopEditPlayer();
    // ปุ่มนี้อยู่ในหน้าเพิ่มนักกีฬา/เช็คชื่อ/รายงาน/แข่งขัน/บาดเจ็บ ซึ่งหลังลบเมนูการ์ดออกแล้ว
    // หน้า Home คือหน้าแม่หนึ่งเดียวของทั้งหมดนี้ จึงย้อนกลับไปหน้า Home เสมอ
    showDaily();
  });
}

// ---------- ผู้ดูแลระบบ: อนุมัติ/ปฏิเสธคำขอลงทะเบียน ----------
function roleLabel(role) {
  if (role === "admin") return '<span class="badge badge-info">ผู้ดูแลระบบ</span>';
  if (role === "executive") return '<span class="badge badge-neutral">ผู้บริหารทีม</span>';
  if (role === "staff") return '<span class="badge badge-warning">ทีมหลังบ้าน</span>';
  return '<span class="badge badge-success">โค้ช</span>';
}

async function loadPendingApprovals() {
  pendingApprovalsBody.innerHTML =
    '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>';
  const q = query(collection(db, "coaches"), where("status", "==", "pending"));
  const snapshot = await getDocs(q);
  const allPending = [];
  snapshot.forEach((docSnap) => allPending.push({ id: docSnap.id, ...docSnap.data() }));
  // ทีมหลังบ้านที่มีสิทธิ์ coaches อนุมัติได้เฉพาะโค้ช/ผู้บริหารทีม — คำขอของทีมหลังบ้านและแอดมินเห็น/อนุมัติได้เฉพาะแอดมินหลัก
  const pending = isStaffSession() ? allPending.filter((c) => c.role === "coach" || c.role === "executive") : allPending;

  if (pending.length === 0) {
    pendingApprovalsBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">ไม่มีคำขอที่รอการอนุมัติ</td></tr>';
    return;
  }

  pendingApprovalsBody.innerHTML = "";
  for (const c of pending) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="emphasis">${escapeHtml(c.name ?? "-")}</td>
      <td>${escapeHtml(c.email ?? "-")}</td>
      <td>${roleLabel(c.role)}</td>
    `;

    // คำขอของทีมหลังบ้านไม่ต้องเลือกทีม แต่ต้องติ๊กสิทธิ์รายข้อ (สิทธิ์ที่ติ๊กเป็นตัวกำหนดเมนูและข้อมูลที่เห็นหลังเข้าสู่ระบบ)
    const isStaffRequest = c.role === "staff";
    const teamTd = document.createElement("td");
    const teamSelect = document.createElement("select");
    const permBoxes = [];
    if (isStaffRequest) {
      teamTd.className = "space-y-1";
      for (const perm of STAFF_PERMISSIONS) {
        const label = document.createElement("label");
        label.className = "flex items-start gap-2 text-sm text-slate-700";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = perm.key;
        box.className = "mt-1";
        permBoxes.push(box);
        const text = document.createElement("span");
        text.textContent = perm.label;
        label.append(box, text);
        teamTd.appendChild(label);
      }
    } else {
      teamSelect.className = "field-input w-48";
      populateTeamSelect(teamSelect, "-- เลือกทีม --");
      teamTd.appendChild(teamSelect);
    }
    tr.appendChild(teamTd);

    const actionTd = document.createElement("td");
    actionTd.className = "space-x-2";

    const approveBtn = document.createElement("button");
    approveBtn.textContent = isStaffRequest ? "อนุมัติ + บันทึกสิทธิ์" : "กำหนดทีม + อนุมัติ";
    approveBtn.className = "btn btn-success btn-sm";
    approveBtn.addEventListener("click", () =>
      isStaffRequest
        ? approveStaff(c.id, permBoxes.filter((b) => b.checked).map((b) => b.value))
        : approveCoach(c.id, teamSelect.value)
    );

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
    adminStatus.innerHTML = `อนุมัติเรียบร้อย ${icon("check")}`;
    adminStatus.className = "text-sm text-emerald-600 w-full";
    await loadPendingApprovals();
    await loadCoachDirectory();
  } catch (err) {
    console.error(err);
    adminStatus.textContent = "อนุมัติไม่สำเร็จ: " + err.message;
    adminStatus.className = "text-sm text-red-600 w-full";
  }
}

// อนุมัติบัญชีทีมหลังบ้าน: ต้องติ๊กสิทธิ์อย่างน้อย 1 ข้อ (manageTeams ให้ view ด้วยเสมอ) ไม่ผูกทีม — เฉพาะแอดมินหลัก (กฎ Firestore)
async function approveStaff(accountId, perms) {
  const permissions = normalizePermissions(perms);
  if (permissions.length === 0) {
    adminStatus.textContent = "กรุณาติ๊กสิทธิ์อย่างน้อย 1 ข้อก่อนอนุมัติ";
    adminStatus.className = "text-sm text-red-600 w-full";
    return;
  }
  try {
    await updateDoc(doc(db, "coaches", accountId), { status: "approved", team: null, permissions });
    adminStatus.innerHTML = `อนุมัติเรียบร้อย ${icon("check")}`;
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
    // เข้าโหมดดูหน้าจอของบัญชีนั้นต้องมีสิทธิ์ manageTeams (แอดมินหลักมีเสมอ) — ทีมหลังบ้านที่มีแค่สิทธิ์ coaches คลิกชื่อแล้วเปิดหน้าแก้ไขบัญชีแทน
    if (c.team && c.role === "coach" && adminCan("manage-team")) {
      enterTeamManagementMode(c.team, adminCoachesSection, c);
    } else if (c.team && c.role === "executive" && adminCan("manage-team")) {
      enterExecutiveViewMode(c.team, adminCoachesSection, c);
    } else if (!(isStaffSession() && (c.role === "admin" || c.role === "staff"))) {
      openEditCoachModal(c);
    }
  });
  nameTd.appendChild(nameBtn);

  const roleTd = document.createElement("td");
  roleTd.innerHTML = roleLabel(c.role);

  tr.appendChild(nameTd);
  tr.insertAdjacentHTML("beforeend", `<td>${escapeHtml(c.email ?? "-")}</td>`);
  tr.appendChild(roleTd);
  tr.insertAdjacentHTML(
    "beforeend",
    `<td>${c.role === "coach" ? coachPositionLabel(c.coachPosition) : c.role === "staff" ? escapeHtml([].concat(permissionsSummary(c.permissions)).join(" · ")) : "-"}</td>` +
      `<td>${c.role === "coach" ? (c.ageGroups || []).join(", ") || "-" : "-"}</td>` +
      `<td>${statusBadge}</td>` +
      `<td>${c.role === "admin" || c.role === "staff" ? "-" : percentText}</td>`
  );

  const actionTd = document.createElement("td");
  const editBtn = document.createElement("button");
  editBtn.textContent = "แก้ไขบัญชี";
  editBtn.className = "btn btn-secondary btn-sm";
  editBtn.addEventListener("click", () => openEditCoachModal(c));
  // บัญชีแอดมินและทีมหลังบ้านแก้ได้เฉพาะแอดมินหลัก (ทีมหลังบ้านที่จัดการโค้ชได้ ไม่เห็นปุ่มนี้ของบัญชีเหล่านั้น)
  if (!(isStaffSession() && (c.role === "admin" || c.role === "staff"))) actionTd.appendChild(editBtn);
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
  // ทีมหลังบ้านที่มีแค่สิทธิ์ coaches อ่านข้อมูลนักกีฬา/เช็คชื่อไม่ได้ — โหลดไม่ได้ก็ยังเห็นรายชื่อโค้ช แค่คอลัมน์ % ตรงเวลาเป็น "-"
  const optional = (promise) => (isStaffSession() ? promise.catch(() => null) : promise);
  const [coachSnap, sessionSnap, attendanceSnap, playerSnap] = await Promise.all([
    getDocs(collection(db, "coaches")),
    optional(getDocs(collection(db, "sessions"))),
    optional(getDocs(collection(db, "attendance"))),
    optional(getDocs(collection(db, "players")))
  ]);

  const coaches = [];
  coachSnap.forEach((d) => coaches.push({ id: d.id, ...d.data() }));
  const sessions = [];
  sessionSnap?.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
  const attendanceRecords = [];
  attendanceSnap?.forEach((d) => attendanceRecords.push(d.data()));
  const players = [];
  playerSnap?.forEach((d) => players.push({ id: d.id, ...d.data() }));

  if (coaches.length === 0) {
    coachDirectoryGroups.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีโค้ชในระบบ</p>';
    return;
  }

  const teamGroups = new Map();
  for (const team of TEAMS) teamGroups.set(team, []);
  const unassignedGroup = [];
  const staffGroup = [];
  for (const c of coaches) {
    if (c.role === "staff") {
      staffGroup.push(c);
    } else if (c.team && teamGroups.has(c.team)) {
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
    sendSummaryBtn.innerHTML = `${icon("send")} ส่งสรุปการทำงานโค้ชให้ผู้บริหารทีม`;
    sendSummaryBtn.className = "btn btn-secondary btn-sm mb-3";
    sendSummaryBtn.addEventListener("click", () => sendCoachActivitySummaryToExecutive(team, sendSummaryBtn));

    const btnGroup = document.createElement("div");
    btnGroup.className = "flex gap-2 flex-wrap";
    // ส่งสรุปถึงผู้บริหารทีมเป็นงานของแอดมินหลัก / เข้าโหมดจัดการทีมต้องมีสิทธิ์ manageTeams
    if (!isStaffSession()) btnGroup.appendChild(sendSummaryBtn);
    if (adminCan("manage-team")) btnGroup.appendChild(viewTeamBtn);

    const groupWrap = document.createElement("div");
    groupWrap.className = "mb-2 flex items-center justify-between flex-wrap gap-2";
    groupWrap.appendChild(heading);
    groupWrap.appendChild(btnGroup);

    coachDirectoryGroups.appendChild(groupWrap);
    coachDirectoryGroups.appendChild(buildCoachGroupTable(teamCoaches, sessions, attendanceRecords, players));
  }

  if (staffGroup.length > 0) {
    staffGroup.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const staffHeading = document.createElement("h3");
    staffHeading.className = "section-title text-sm mb-2";
    staffHeading.innerHTML = `${icon("briefcase")} ทีมหลังบ้าน (${staffGroup.length} คน)`;
    coachDirectoryGroups.appendChild(staffHeading);
    coachDirectoryGroups.appendChild(buildCoachGroupTable(staffGroup, sessions, attendanceRecords, players));
  }

  if (unassignedGroup.length > 0) {
    unassignedGroup.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const heading = document.createElement("h3");
    heading.className = "section-title text-sm mb-2";
    heading.innerHTML = `${icon("shield")} ยังไม่มีทีม (ผู้ดูแลระบบ/รอกำหนดทีม) (${unassignedGroup.length} คน)`;
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
  const thisMonth = thisMonthBangkok();
  // สรุปนี้ดูเฉพาะ "เดือนนี้" อยู่แล้ว จึงดึงเฉพาะเดือนนี้ที่ query เลย ไม่ดึงของทีมทุกเดือนมากรองทีหลัง
  const { start: monthStart, end: monthEnd } = monthDateRange(thisMonth);
  const [coachSnap, playerSnap, sessionSnap, attendanceSnap, reportSnap, planSnap] = await Promise.all([
    getDocs(query(collection(db, "coaches"), where("team", "==", team), where("role", "==", "coach"))),
    getDocs(query(collection(db, "players"), where("team", "==", team))),
    getDocs(teamDateRangeQuery("sessions", team, monthStart, monthEnd)),
    getDocs(teamDateRangeQuery("attendance", team, monthStart, monthEnd)),
    getDocs(teamDateRangeQuery("trainingReports", team, monthStart, monthEnd)),
    getDocs(teamDateRangeQuery("trainingPlans", team, monthStart, monthEnd))
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
  const todayDay = Number(todayBangkok().slice(8, 10));

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
      .filter((r) => isRecordOfCoach(r, c))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const reportCount = myReports.length;
    // สถานะการส่งรายงานรายวัน ใช้เกณฑ์ "สาย" เดียวกับเช็คชื่อ (23:59 น. ดู isReportLate)
    const reportStatusByDate = new Map();
    for (const r of myReports) {
      if (!r.date) continue;
      reportStatusByDate.set(r.date, isReportLate(r) ? "late" : "onTime");
    }
    const myPlans = monthPlans
      .filter((p) => isRecordOfCoach(p, c))
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
      return `<div class="w-6 h-6 rounded flex items-center justify-center text-[10px] font-medium" style="background:${colors[d.status]};color:${textColor}" title="วันที่ ${escapeHtml(d.date)}: ${labels[d.status]}">${day}</div>`;
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
  if (status === "onTime") return `<span class="badge badge-success">${icon("check-circle")} ตรงเวลา</span>`;
  if (status === "late") return `<span class="badge badge-warning">${icon("alert-triangle")} สาย</span>`;
  return `<span class="badge badge-danger">${icon("x-circle")} ไม่ได้ส่ง</span>`;
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
          <td>${escapeHtml(d.date)}</td>
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
    <p class="text-xs text-slate-400 mt-1"><span class="inline-block w-2.5 h-2.5 rounded-sm align-middle" style="background:#ef4444"></span> แถวสีแดง = วันที่ทำ 3 อย่างไม่สอดคล้องกัน (ทำบางอย่างแต่ขาดอย่างอื่น หรือส่งสายไม่พร้อมกัน)</p>
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
          <span class="emphasis">${escapeHtml(plan.date ?? "-")}</span>
          <span class="text-slate-500"> — ${escapeHtml(plan.trainingType ?? "-")} • ${(plan.ageGroups || []).join(", ") || "-"}</span>
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
        <span class="text-sm"><span class="emphasis">${escapeHtml(report.date ?? "-")}</span></span>
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
    fileLink.innerHTML = plan.fileName ? `${icon("paperclip")} เปิดไฟล์แนบ: ${escapeHtml(plan.fileName)}` : `${icon("paperclip")} เปิดไฟล์แนบ`;
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
      <td class="emphasis"><span class="inline-block w-3 text-slate-400" data-toggle-arrow>▸</span> ${escapeHtml(r.coachName)}</td>
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
  const monthLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", timeZone: "Asia/Bangkok" });
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
    executiveCoachSummary.innerHTML = `<p class="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
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
    .map((ag) => `<option value="${escapeHtml(ag)}"${p.ageGroup === ag ? " selected" : ""}>${escapeHtml(ag)}</option>`)
    .join("");
  return `
    <tr data-player-id="${p.id}">
      <td>${teamLogoImg(p.team)}${escapeHtml(p.team ?? "-")}</td>
      <td class="emphasis">${escapeHtml(p.nickname ?? p.fullName ?? "-")}</td>
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
      playerAuditStatus.innerHTML = `ตรวจสอบนักกีฬาทั้งหมด ${players.length} คนแล้ว ไม่พบข้อมูลที่ผิดปกติ ${icon("check")}`;
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
      playerAuditStatus.innerHTML = `แก้ไขครบทุกรายการแล้ว ${icon("check")}`;
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

let editingCoachAccount = null;

function updateEditCoachFieldVisibility() {
  const role = editCoachRoleSelect.value;
  editCoachTeamWrap.classList.toggle("hidden", role === "admin" || role === "staff");
  editCoachAgeGroupWrap.classList.toggle("hidden", role !== "coach");
  editCoachPermissionsWrap.classList.toggle("hidden", role !== "staff");
}

// ช่องติ๊กสิทธิ์ของทีมหลังบ้านในหน้าแก้ไขบัญชี (เฉพาะแอดมินหลักที่เปลี่ยนบทบาทเป็นทีมหลังบ้านหรือแก้สิทธิ์ได้)
function renderEditCoachPermissions(selected) {
  const current = new Set(normalizePermissions(selected));
  editCoachPermissionsEl.innerHTML = "";
  for (const perm of STAFF_PERMISSIONS) {
    const label = document.createElement("label");
    label.className = "flex items-start gap-2 text-sm text-slate-700";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = perm.key;
    box.className = "mt-1 edit-coach-permission-checkbox";
    box.checked = current.has(perm.key);
    const text = document.createElement("span");
    text.innerHTML = `<b class="font-medium">${escapeHtml(perm.label)}</b><br><span class="text-xs text-slate-400">${escapeHtml(perm.hint)}</span>`;
    label.append(box, text);
    editCoachPermissionsEl.appendChild(label);
  }
}

function openEditCoachModal(c) {
  editingCoachAccountId = c.id;
  editingCoachAccount = c;
  // ทีมหลังบ้านที่จัดการโค้ชได้ ปรับบทบาทได้แค่ระหว่างโค้ช/ผู้บริหารทีม (เลื่อนเป็นแอดมินหรือทีมหลังบ้านเป็นของแอดมินหลัก — กฎ Firestore บังคับด้วย)
  for (const opt of editCoachRoleSelect.options) {
    const restricted = isStaffSession() && (opt.value === "admin" || opt.value === "staff");
    opt.hidden = restricted;
    opt.disabled = restricted;
  }
  renderEditCoachPermissions(c.permissions);
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
  if (role === "staff" && !confirm(`ยืนยันตั้งบัญชี "${name}" เป็นทีมหลังบ้านตามสิทธิ์ที่ติ๊ก?`)) return;
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
    team: role === "admin" || role === "staff" ? null : editCoachTeamSelect.value || null,
    ageGroups: role === "coach" ? ageGroups : null,
    coachPosition: role === "coach" ? editCoachPositionSelect.value : null
  };
  // สิทธิ์ทีมหลังบ้าน: แอดมินหลักเท่านั้นที่ตั้ง/ล้างได้ (ทีมหลังบ้านที่แก้บัญชีโค้ชต้องไม่ส่งฟิลด์ permissions — กฎ Firestore ห้ามแตะ)
  if (!isStaffSession()) {
    if (role === "staff") {
      const perms = normalizePermissions(
        Array.from(editCoachPermissionsEl.querySelectorAll(".edit-coach-permission-checkbox")).filter((b) => b.checked).map((b) => b.value)
      );
      if (perms.length === 0) {
        editCoachModalStatus.textContent = "กรุณาติ๊กสิทธิ์อย่างน้อย 1 ข้อให้ทีมหลังบ้าน";
        editCoachModalStatus.className = "text-sm text-red-600";
        return;
      }
      payload.permissions = perms;
    } else if (editingCoachAccount && "permissions" in editingCoachAccount) {
      payload.permissions = null; // เปลี่ยนบทบาทออกจากทีมหลังบ้าน — ล้างสิทธิ์เดิมทิ้ง
    }
  }
  try {
    editCoachModalStatus.textContent = "กำลังบันทึก...";
    editCoachModalStatus.className = "text-sm text-slate-500";
    await updateDoc(doc(db, "coaches", editingCoachAccountId), payload);
    editCoachModalStatus.innerHTML = `บันทึกสำเร็จ ${icon("check")}`;
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
    editCoachModalStatus.innerHTML = `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${escapeHtml(email)} แล้ว ${icon("check")}`;
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
    editCoachModalStatus.innerHTML = `ลบบัญชีสำเร็จ ${icon("check")}`;
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
  no_training: "ไม่มีฝึกซ้อม / Match Day"
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
        <td class="emphasis">${escapeHtml(r.coach.name ?? "-")}</td>
        <td>${escapeHtml(r.coach.team)}</td>
        <td>${r.totalPlayers}</td>
        <td class="text-slate-400" colspan="2">${r.matchDay ? "Match Day" : "ไม่มีฝึกซ้อม"}</td>
        <td>-</td>
      `;
    } else {
      tr.innerHTML = `
        <td class="emphasis">${escapeHtml(r.coach.name ?? "-")}</td>
        <td>${escapeHtml(r.coach.team)}</td>
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
      let totalPlayers = myPlayerIds.size;

      if (sessionSnap.empty) {
        return { coach: c, totalPlayers, evaluated: 0, noTraining: false, completedAt: null };
      }
      const sessionDoc = sessionSnap.docs[0];
      const sessionData = sessionDoc.data();
      if (sessionData.noTraining) {
        return { coach: c, totalPlayers, evaluated: 0, noTraining: true, completedAt: null };
      }
      // รุ่นอายุที่มี Match Day ในวันนั้นไม่นับเป็นวันเช็คชื่อซ้อม — ถ้านักกีฬาทุกคนของโค้ชอยู่ในรุ่นเหล่านั้นถือเป็น Match Day ทั้งแถว
      const matchDayGroups = new Set(sessionData.matchDayAgeGroups || []);
      if (matchDayGroups.size > 0) {
        for (const p of players) if (matchDayGroups.has(p.ageGroup)) myPlayerIds.delete(p.id);
        if (totalPlayers > 0 && myPlayerIds.size === 0) {
          return { coach: c, totalPlayers, evaluated: 0, noTraining: true, matchDay: true, completedAt: null };
        }
        totalPlayers = myPlayerIds.size;
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
// landing: ฟังก์ชันที่เปิดหน้าจอแรกหลังเข้าโหมด (ค่าเริ่มต้น Daily — ตอนรีเฟรชจะส่งฟังก์ชันที่เปิดหน้าจอเดิมมาแทน)
async function enterTeamManagementMode(team, returnSection, coachRecordOverride, landing = showDaily) {
  myTeam = team;
  adminViewingAs = "coach";
  adminViewingCoachId = coachRecordOverride?.id || null;
  const coachRecord = coachRecordOverride || (await findCoachRecordForTeam(team, "coach"));
  // ถ้าเจาะจงโค้ชคนใดคนหนึ่ง (coachRecordOverride — คลิกชื่อโค้ชคนนั้นมาโดยตรง) จำกัด myAgeGroups ตามรุ่นอายุ
  // ที่โค้ชคนนั้นรับผิดชอบจริง เพื่อให้เห็นเฉพาะนักกีฬารุ่นที่ดูแล ตรงกับหน้าจอที่โค้ชคนนั้นเห็นจริง 100% แต่ถ้าเป็น
  // การจัดการทีมแบบกว้างผ่านปุ่ม "จัดการทีมนี้ →" (ไม่ได้เจาะจงคนใดคนหนึ่ง) ให้เข้าถึงได้ทุกรุ่นอายุของทีมเหมือนเดิม
  myAgeGroups = coachRecordOverride ? coachRecord?.ageGroups || [] : [];
  myCoachPosition = coachRecordOverride ? coachRecord?.coachPosition || null : null;
  myCoachName = coachRecord?.name || auth.currentUser?.email;
  currentCoachRecord = coachRecordOverride ? coachRecord : null;
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
    dateInput.value = todayBangkok();
  }
  // เมนูนี้ถูกเข้าถึงผ่านผู้ดูแลระบบ (ไม่ใช่โค้ชล็อกอินเอง) จึงต้องมีรายการ "กลับแผงควบคุมผู้ดูแลระบบ"
  // ใน nav drawer ที่ย้อนกลับไปจุดที่พามาที่นี่ทีละสเต็ป (ดู exitTeamManagementToAdminPanel)
  adminReturnSection = returnSection || adminManageTeamSection;
  await loadPlayers();
  renderDrawerItems();
  landing();
}

// ผู้ดูแลระบบสวมบทบาทเป็น "ผู้บริหารทีม" (ดูอย่างเดียว) แทนที่จะเป็นโค้ชเต็มรูปแบบ — ใช้ตรวจสอบว่าหน้าจอ
// ที่ผู้บริหารทีมจริงเห็นถูกต้องหรือไม่ โดยไม่ต้องขอให้ผู้บริหารทีมจริงล็อกอินทดสอบให้
async function enterExecutiveViewMode(team, returnSection, execRecordOverride) {
  myTeam = team;
  myAgeGroups = [];
  myCoachPosition = null;
  adminViewingAs = "executive";
  adminViewingCoachId = execRecordOverride?.id || null;
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
  renderDrawerItems();
  showExecutiveHome(team);
}

// หน้าแรกของโหมดผู้บริหารทีม (สรุปภาพรวม) — ใช้ร่วมกันทั้งบัญชีผู้บริหารทีมจริง, ผู้ดูแลระบบที่สวมบทบาท
// ผ่าน enterExecutiveViewMode และปุ่ม "กลับ" ของหน้ารายชื่อนักกีฬา (openExecutivePlayersSection) ด้านล่าง
function showExecutiveHome(team) {
  hideAllScreens();
  executiveSection.classList.remove("hidden");
  loadExecutiveSummary(team);
  loadCoachActivitySummary(team);
  loadExecutiveNotes(team, executiveNotesList);
  loadExecutiveDailyAttendance(team);
}

// รายชื่อนักกีฬาในทีม สำหรับโหมดผู้บริหารทีม (ดูอย่างเดียว ไม่มีปุ่มแก้ไข/ลบเหมือนหน้าของโค้ช) — เขียน
// query แยกจาก loadPlayers()/players ทั่วไป เพราะ loadPlayers() อิงตัวแปร myTeam ซึ่งบัญชีผู้บริหารทีมจริง
// ตั้งใจปล่อยเป็น null ไว้เสมอ (ดูหมายเหตุที่ myExecutiveTeam) จึงรับทีมที่จะดูเป็นพารามิเตอร์ตรงๆ แทน
const EXECUTIVE_UNASSIGNED_AGE_GROUP = "ไม่ระบุรุ่นอายุ";

// จัดกลุ่มตำแหน่งเล่น (รหัสละเอียดตามที่กรอกตอนเพิ่มนักกีฬา) เป็น 4 หมวดกว้างๆ แบบที่คุ้นตาในวงการฟุตบอล
// (GK/กองหลัง/กองกลาง/กองหน้า) ใช้กำหนดสี badge ให้แยกแยะตำแหน่งได้ไวขึ้นด้วยสายตา ไม่ต้องอ่านตัวย่อทีละคน
const POSITION_GROUPS = {
  GK: "gk",
  CB: "df", RB: "df", LB: "df", RWB: "df", LWB: "df", SW: "df",
  CDM: "mf", CM: "mf", CAM: "mf", RM: "mf", LM: "mf",
  RW: "fw", LW: "fw", SS: "fw", CF: "fw", ST: "fw"
};
const POSITION_GROUP_BADGE = { gk: "badge-warning", df: "badge-info", mf: "badge-success", fw: "badge-danger" };

async function openExecutivePlayersSection(team) {
  executivePlayersReturnTeam = team;
  hideAllScreens();
  executivePlayersSection.classList.remove("hidden");
  executivePlayersGroupsEl.innerHTML = '<p class="text-slate-400 text-sm">กำลังโหลด...</p>';
  try {
    // ไม่มี limit/pagination ใดๆ ในนี้ — ดึงนักกีฬาทุกคนของทีมนี้มาแสดงทั้งหมดในครั้งเดียวเสมอ
    const snapshot = await getDocs(query(collection(db, "players"), where("team", "==", team)));
    const teamPlayers = [];
    snapshot.forEach((docSnap) => teamPlayers.push({ id: docSnap.id, ...docSnap.data() }));
    renderExecutivePlayerList(teamPlayers);
  } catch (err) {
    console.error(err);
    executivePlayersGroupsEl.innerHTML = `<p class="text-red-600 text-sm">โหลดรายชื่อนักกีฬาไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

// การ์ดวงกลมรูปนักกีฬา (รูปจริงถ้ามี ไม่มีก็ไอคอนคนแทน) ให้หน้าตาเป็นทาวเนอร์รายชื่อแบบมืออาชีพ ไม่ใช่ตารางตัวหนังสือล้วน
function executiveAvatarHtml(p) {
  const photo = p.photoUrl
    ? `<img src="${safeHttpUrl(p.photoUrl)}" alt="" class="w-full h-full object-cover" />`
    : icon("user");
  return `<div class="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center overflow-hidden flex-shrink-0">${photo}</div>`;
}

// สรุปจำนวนรวม + แยกตามหมวดตำแหน่งไว้บนสุด ให้เห็นตัวเลขยืนยันว่าครบทุกคนในทีมได้ทันทีโดยไม่ต้องนับเอง
function executiveRosterSummaryHtml(teamPlayers) {
  const counts = { gk: 0, df: 0, mf: 0, fw: 0, other: 0 };
  for (const p of teamPlayers) {
    const group = POSITION_GROUPS[p.position] || "other";
    counts[group] += 1;
  }
  const chip = (label, value, badgeClass) =>
    `<span class="badge ${badgeClass}">${label} ${value}</span>`;
  return `
    <div class="card card-pad flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wide">นักกีฬาทั้งหมดในทีม</p>
        <p class="text-2xl font-semibold text-slate-900" style="font-family:'Mitr',sans-serif;">${teamPlayers.length} คน</p>
      </div>
      <div class="flex flex-wrap gap-2">
        ${chip("GK", counts.gk, POSITION_GROUP_BADGE.gk)}
        ${chip("กองหลัง", counts.df, POSITION_GROUP_BADGE.df)}
        ${chip("กองกลาง", counts.mf, POSITION_GROUP_BADGE.mf)}
        ${chip("กองหน้า", counts.fw, POSITION_GROUP_BADGE.fw)}
        ${counts.other > 0 ? chip("ไม่ระบุตำแหน่ง", counts.other, "badge-neutral") : ""}
      </div>
    </div>
  `;
}

// แบ่งรายชื่อเป็นการ์ดแยกตามรุ่นอายุ (ทีมหนึ่งมักมีหลายรุ่นอายุคละกัน) เรียงรุ่นน้อยไปมากด้วย ageGroupNumber
// เหมือนหน้า Dashboard ของผู้ดูแลระบบ (renderPlayersGroups ใน app.js) เพื่อให้ดูง่ายกว่าตารางเดียวรวมทุกรุ่น —
// ไม่มี limit/pagination ที่ไหนเลยในฟังก์ชันนี้ ทุกคนที่ query กลับมาจะถูกแสดงครบ ไม่มีการตัดรายการทิ้ง
function renderExecutivePlayerList(teamPlayers) {
  executivePlayersGroupsEl.innerHTML = "";
  if (teamPlayers.length === 0) {
    executivePlayersGroupsEl.innerHTML = '<p class="text-slate-400 text-sm">ยังไม่มีนักกีฬาในทีมนี้</p>';
    return;
  }
  const ageGroupMap = new Map();
  for (const p of teamPlayers) {
    const ageGroup = p.ageGroup || EXECUTIVE_UNASSIGNED_AGE_GROUP;
    if (!ageGroupMap.has(ageGroup)) ageGroupMap.set(ageGroup, []);
    ageGroupMap.get(ageGroup).push(p);
  }
  const sortedAgeGroups = [...ageGroupMap.keys()].sort((a, b) => ageGroupNumber(a) - ageGroupNumber(b));

  executivePlayersGroupsEl.insertAdjacentHTML("beforeend", executiveRosterSummaryHtml(teamPlayers));

  for (const ageGroup of sortedAgeGroups) {
    // เบอร์เสื้อที่ไม่ได้กรอกไว้ (undefined/null) ให้ไปอยู่ท้ายกลุ่มเสมอ ไม่ใช่ดันขึ้นบนสุดเหมือนเบอร์ 0
    const groupPlayers = ageGroupMap
      .get(ageGroup)
      .slice()
      .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <h3 class="section-title text-sm mb-2">${escapeHtml(ageGroup)} <span class="text-slate-400 font-normal">(${groupPlayers.length} คน)</span></h3>
      <div class="card table-wrap">
        <table class="pro-table">
          <thead>
            <tr>
              <th>เบอร์</th>
              <th>นักกีฬา</th>
              <th>ชื่อ-นามสกุล</th>
              <th>อายุ</th>
              <th>วันเกิด</th>
              <th>ตำแหน่ง</th>
            </tr>
          </thead>
          <tbody>
            ${groupPlayers
              .map((p) => {
                const age = calcAge(p.birthday);
                const posGroup = POSITION_GROUPS[p.position];
                const posBadgeClass = posGroup ? POSITION_GROUP_BADGE[posGroup] : "badge-neutral";
                return `
              <tr>
                <td class="text-slate-400 font-medium">${p.number != null ? escapeHtml(p.number) : "-"}</td>
                <td class="emphasis">
                  <a href="./player.html#id=${p.id}" class="flex items-center gap-3 text-blue-600 hover:underline">
                    ${executiveAvatarHtml(p)}
                    <span>${escapeHtml(p.nickname ?? "-")}</span>
                  </a>
                </td>
                <td>${escapeHtml(p.fullName ?? "-")}</td>
                <td>${age != null ? `${age} ปี` : "-"}</td>
                <td>${escapeHtml(p.birthday ?? "-")}</td>
                <td>${p.position ? `<span class="badge ${posBadgeClass}">${escapeHtml(p.position)}</span>` : `<span class="text-slate-300">-</span>`}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    applyDataLabels(wrapper.querySelector("tbody"));
    executivePlayersGroupsEl.appendChild(wrapper);
  }
}

// จำทีมที่กำลังดูอยู่ไว้ ให้ปุ่ม "กลับ" ของหน้ารายชื่อนักกีฬาย้อนกลับไปหน้าสรุปภาพรวมของทีมเดิมได้ถูกต้อง
// (ต่างจากปุ่ม [data-back] ทั่วไปที่ผูกกับ showDaily() ซึ่งใช้ไม่ได้กับโหมดผู้บริหารทีมที่ไม่มีหน้า Daily)
let executivePlayersReturnTeam = null;
executivePlayersBackBtn.addEventListener("click", () => showExecutiveHome(executivePlayersReturnTeam));

// สรุปภาพรวมทีมสั้นๆ ที่ผู้บริหารทีมควรเห็นทันทีที่เข้าระบบ (ไม่ต้องคลิกไปหน้า Dashboard ก่อนถึงจะเห็นอะไร)
// ใช้ร่วมกันทั้งบัญชีผู้บริหารทีมจริง และผู้ดูแลระบบที่สวมบทบาทผ่าน enterExecutiveViewMode
async function loadExecutiveSummary(team) {
  executiveStatusEl.textContent = "กำลังโหลดข้อมูล...";
  executiveStatCards.innerHTML = "";
  executiveLateWarning.classList.add("hidden");
  try {
    const thisMonth = thisMonthBangkok(); // "YYYY-MM"
    const { start: monthStart, end: monthEnd } = monthDateRange(thisMonth);
    const [playersSnap, attendanceSnap, trainingPlansSnap] = await Promise.all([
      getDocs(query(collection(db, "players"), where("team", "==", team))),
      getDocs(teamDateRangeQuery("attendance", team, monthStart, monthEnd)),
      getDocs(teamDateRangeQuery("trainingPlans", team, monthStart, monthEnd))
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

// ---------- การเช็คชื่อ+ให้คะแนนรายวัน แยกตามรุ่นอายุ (โหมดผู้บริหารทีม) ----------
// ตารางแบบ "นักกีฬา × ทุกวันในเดือน" (คนละอย่างกับสรุปแบบรายวันเดิมที่เคยทำ) อิงฟอร์ม ATTENDANCE REGISTER ของ
// FA Thailand ที่ผู้ใช้ส่งมา — คอลัมน์สรุป A/Missed/AV/% อยู่หน้าตาราง ตามด้วยช่องของแต่ละวันในเดือน ทีมหนึ่งมีหลาย
// รุ่นอายุคละกัน ดูพร้อมกันหมดจะแน่นเกินไป จึงให้เลือกดูได้ทีละรุ่นอายุผ่าน dropdown — ดึงข้อมูลเดือนนี้มาครั้งเดียว
// เก็บไว้ในตัวแปรปิดสโคป แล้วกรองใหม่ตามรุ่นอายุที่เลือกตอนสลับ dropdown โดยไม่ query ซ้ำ
const EXECUTIVE_STATUS_META = { I: "บาดเจ็บ", P: "ลา", R: "พักฟื้น" };
let executiveAttendancePlayersByAgeGroup = new Map(); // ageGroup -> [{id, number, nickname}] เรียงเบอร์แล้ว
let executiveAttendanceRecordByPlayerDate = new Map(); // "playerId|date" -> attendance record ล่าสุด (เผื่อมีบันทึกซ้ำ)
let executiveAttendanceTrainingDates = []; // วันที่ (YYYY-MM-DD) ที่มีวันฝึกซ้อมจริงในเดือนนี้ เรียงจากน้อยไปมาก
let executiveAttendanceMonth = ""; // "YYYY-MM" ของรอบข้อมูลที่โหลดไว้ล่าสุด
let executiveAttendanceCoachesByAgeGroup = new Map(); // ageGroup -> [{name, coachPosition}] โค้ชที่รับผิดชอบรุ่นนั้น

async function loadExecutiveDailyAttendance(team) {
  executiveAttendanceStatusEl.textContent = "กำลังโหลด...";
  executiveAttendanceGridWrap.innerHTML = '<p class="px-4 py-6 text-center text-slate-400 text-sm">กำลังโหลด...</p>';
  try {
    const thisMonth = thisMonthBangkok();
    executiveAttendanceMonth = thisMonth;
    const { start: monthStart, end: monthEnd } = monthDateRange(thisMonth);
    const [playersSnap, sessionSnap, attendanceSnap, coachSnap] = await Promise.all([
      getDocs(query(collection(db, "players"), where("team", "==", team))),
      getDocs(teamDateRangeQuery("sessions", team, monthStart, monthEnd)),
      getDocs(teamDateRangeQuery("attendance", team, monthStart, monthEnd)),
      getDocs(query(collection(db, "coaches"), where("team", "==", team), where("role", "==", "coach")))
    ]);

    // โค้ชแต่ละคนรับผิดชอบได้หลายรุ่นอายุพร้อมกัน (ageGroups เป็น array) จึงอาจมีโค้ชมากกว่า 1 คนต่อ 1 รุ่น
    // (เช่น Head Coach + GK Coach ดูแลรุ่นเดียวกัน) เก็บไว้ทุกคนที่ตรงรุ่นนั้น ไม่ใช่แค่คนแรกที่เจอ
    executiveAttendanceCoachesByAgeGroup = new Map();
    coachSnap.forEach((d) => {
      const data = d.data();
      for (const ag of data.ageGroups || []) {
        if (!executiveAttendanceCoachesByAgeGroup.has(ag)) executiveAttendanceCoachesByAgeGroup.set(ag, []);
        executiveAttendanceCoachesByAgeGroup.get(ag).push({ name: data.name || "-", coachPosition: data.coachPosition });
      }
    });

    executiveAttendancePlayersByAgeGroup = new Map();
    for (const d of playersSnap.docs) {
      const data = d.data();
      const ageGroup = data.ageGroup || "ไม่ระบุรุ่นอายุ";
      if (!executiveAttendancePlayersByAgeGroup.has(ageGroup)) executiveAttendancePlayersByAgeGroup.set(ageGroup, []);
      executiveAttendancePlayersByAgeGroup.get(ageGroup).push({ id: d.id, number: data.number ?? null, nickname: data.nickname ?? "-" });
    }
    for (const list of executiveAttendancePlayersByAgeGroup.values()) {
      list.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
    }

    // วันฝึกซ้อม "ควรจะมี" อิงตารางฝึกซ้อมปกติประจำสัปดาห์ของแต่ละทีม (TEAM_TRAINING_WEEKDAYS เดียวกับที่ใช้คำนวณ
    // เกณฑ์ในหน้าพิมพ์สรุปผลงานโค้ช) ไม่ใช่แค่ดูว่ามี session doc จริงหรือเปล่า — เพราะถ้าโค้ชลืมสร้าง session เลย
    // (ไม่เช็คชื่ออะไรทั้งนั้น) วันนั้นจะไม่มี session ให้เจอ ถ้าอิง session อย่างเดียวจะกลายเป็น "ไม่มีซ้อม" (เทา)
    // ทั้งที่จริงควรเป็น "มีซ้อมแต่ไม่เช็คชื่อ" (ส้ม) ซึ่งเป็นปัญหาที่ต้องติดตาม — ส่วน session doc ที่มีจริงยังใช้
    // ช่วยปรับสองกรณี: 1) noTraining=true วันนั้นทำเครื่องหมายว่าไม่ซ้อมจริง (เช่น วันหยุดพิเศษ) ให้ตัดออกแม้จะตรง
    // ตารางปกติ 2) มี session จริงในวันที่ไม่ตรงตารางปกติ (เช่น ซ้อมพิเศษวันเสาร์ของทีมที่ปกติซ้อมจันทร์-ศุกร์)
    // ให้นับเพิ่มเข้าไปด้วย
    const noTrainingDates = new Set();
    const extraSessionDates = new Set();
    sessionSnap.forEach((d) => {
      const data = d.data();
      if (!data.date) return;
      if (data.noTraining) noTrainingDates.add(data.date);
      else extraSessionDates.add(data.date);
    });

    const weekdays = TEAM_TRAINING_WEEKDAYS[team] || [1, 2, 3, 4, 5];
    const [schedYear, schedMonth] = thisMonth.split("-").map(Number);
    const daysInSchedMonth = new Date(Date.UTC(schedYear, schedMonth, 0)).getUTCDate();
    const trainingDateSet = new Set();
    for (let day = 1; day <= daysInSchedMonth; day++) {
      const dateStr = `${thisMonth}-${String(day).padStart(2, "0")}`;
      const dow = new Date(Date.UTC(schedYear, schedMonth - 1, day)).getUTCDay();
      if (weekdays.includes(dow)) trainingDateSet.add(dateStr);
    }
    for (const date of extraSessionDates) trainingDateSet.add(date);
    for (const date of noTrainingDates) trainingDateSet.delete(date);
    executiveAttendanceTrainingDates = [...trainingDateSet].sort();

    // เก็บ "บันทึกล่าสุด" ต่อคนต่อวัน (ถ้ามีมากกว่า 1 ใบในวันเดียวกันจริงๆ ใช้ใบที่ updatedAt ล่าสุด) กัน
    // ข้อมูลเพี้ยนถ้าเกิดกรณีบันทึกซ้ำ
    executiveAttendanceRecordByPlayerDate = new Map();
    attendanceSnap.forEach((d) => {
      const data = d.data();
      if (!data.playerId || !data.date) return;
      const key = `${data.playerId}|${data.date}`;
      const existing = executiveAttendanceRecordByPlayerDate.get(key);
      const existingTime = existing?.updatedAt && typeof existing.updatedAt.toDate === "function" ? existing.updatedAt.toDate().getTime() : 0;
      const newTime = data.updatedAt && typeof data.updatedAt.toDate === "function" ? data.updatedAt.toDate().getTime() : 0;
      if (!existing || newTime >= existingTime) executiveAttendanceRecordByPlayerDate.set(key, data);
    });

    const ageGroups = [...executiveAttendancePlayersByAgeGroup.keys()].sort((a, b) => ageGroupNumber(a) - ageGroupNumber(b));
    if (ageGroups.length === 0) {
      executiveAttendanceStatusEl.textContent = "ยังไม่มีนักกีฬาในทีมนี้";
      executiveAttendanceGridWrap.innerHTML = '<p class="px-4 py-6 text-center text-slate-400 text-sm">ยังไม่มีนักกีฬาในทีมนี้</p>';
      executiveAttendanceAgeGroupSelect.innerHTML = "";
      return;
    }
    const keepSelected = ageGroups.includes(executiveAttendanceAgeGroupSelect.value) ? executiveAttendanceAgeGroupSelect.value : ageGroups[0];
    executiveAttendanceAgeGroupSelect.innerHTML = ageGroups.map((ag) => `<option value="${escapeHtml(ag)}">${escapeHtml(ag)}</option>`).join("");
    executiveAttendanceAgeGroupSelect.value = keepSelected;
    executiveAttendanceStatusEl.textContent = `อัปเดตข้อมูลล่าสุด • เดือนนี้`;
    renderExecutiveDailyAttendanceForAgeGroup(executiveAttendanceAgeGroupSelect.value);
  } catch (err) {
    console.error(err);
    executiveAttendanceStatusEl.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
    executiveAttendanceGridWrap.innerHTML = `<p class="px-4 py-6 text-center text-red-600 text-sm">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

const EXEC_WEEKDAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// ตารางเมทริกซ์นักกีฬา × ทุกวันของเดือนนี้ (ไม่ใช่แค่วันที่มีข้อมูล) — แต่ละช่องบอกทั้งสถานะเช็คชื่อและคะแนนพร้อมกัน:
// เขียว+ตัวเลข = มาซ้อม+ให้คะแนน (ตัวเลขคือคะแนนเฉลี่ยจริงของวันนั้น), ส้ม = มีวันฝึกซ้อมจริงแต่ไม่มีการเช็คชื่อเลย,
// แดง+I/P/R = บาดเจ็บ/ลา/พักฟื้นตามสถานะจริงในระบบ, ช่องเทาว่าง = วันที่ไม่มีการฝึกซ้อม, ช่องขาวล้วน = ยังไม่มีบันทึก
// แต่ยังไม่ถือเป็นปัญหา (วันนี้ที่ยังไม่จบ หรืออนาคต) — ขึ้นเป็นส้ม (ปัญหาจริง) ก็ต่อเมื่อ "พ้นวันนั้นไปแล้ว" เท่านั้น
// (วันนี้เองแม้ยังไม่เช็คชื่อก็ยังเป็นขาวไว้ก่อน เผื่อยังไม่ถึงเวลาซ้อม/โค้ชยังไม่ได้กรอก) — คอลัมน์สรุป A/Missed/AV/%
// นับเฉพาะวันฝึกซ้อมจริงที่มีบันทึกแล้ว (ไม่รวมช่องส้ม/ขาว) ตามฟอร์ม ATTENDANCE REGISTER ต้นแบบ
function renderExecutiveDailyAttendanceForAgeGroup(ageGroup) {
  const coaches = executiveAttendanceCoachesByAgeGroup.get(ageGroup) || [];
  executiveAttendanceCoachLabel.textContent =
    coaches.length > 0
      ? `โค้ชผู้รับผิดชอบ: ${coaches.map((c) => `${c.name} (${coachPositionLabel(c.coachPosition)})`).join(", ")}`
      : "ยังไม่มีโค้ชที่รับผิดชอบรุ่นนี้";

  const players = executiveAttendancePlayersByAgeGroup.get(ageGroup) || [];
  if (players.length === 0) {
    executiveAttendanceGridWrap.innerHTML = '<p class="px-4 py-6 text-center text-slate-400 text-sm">ยังไม่มีนักกีฬาในรุ่นนี้</p>';
    return;
  }

  const today = todayBangkok();
  const [year, month] = executiveAttendanceMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const trainingDateSet = new Set(executiveAttendanceTrainingDates);
  const allDates = Array.from({ length: daysInMonth }, (_, i) => `${executiveAttendanceMonth}-${String(i + 1).padStart(2, "0")}`);

  const headerCells = allDates
    .map((date, i) => {
      const day = i + 1;
      const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      const isTraining = trainingDateSet.has(date);
      const isToday = date === today;
      const bg = isTraining ? "" : "background:#F8FAFC;";
      const ring = isToday ? "box-shadow:inset 0 0 0 2px #10b981;" : "";
      return `<th style="padding:0.5rem 0.3rem;text-align:center;font-size:0.65rem;white-space:nowrap;${bg}${ring}">${day}<br><span class="text-slate-400 font-normal">${EXEC_WEEKDAY_TH[dow]}</span></th>`;
    })
    .join("");

  const bodyRows = players
    .map((p) => {
      let attendedCount = 0;
      let missedCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;

      const dayCells = allDates
        .map((date) => {
          const isTraining = trainingDateSet.has(date);
          if (!isTraining) return '<td style="padding:0.3rem;text-align:center;background:#F8FAFC;"></td>';

          const record = executiveAttendanceRecordByPlayerDate.get(`${p.id}|${date}`);
          if (!record) {
            // ยังไม่ขึ้นเป็น "ไม่มีการเช็คชื่อ" (ส้ม) จนกว่าจะพ้นวันนั้นไปแล้วจริงๆ — วันนี้เองแม้ยังไม่เช็คชื่อก็ถือว่า
            // ยังไม่ถึงกำหนด (ขาว) เผื่อโค้ชยังไม่ได้ซ้อม/ยังไม่มีเวลากรอก ไม่ใช่ปัญหาจนกว่าจะข้ามวันไปแล้ว
            if (date >= today) return '<td style="padding:0.3rem;text-align:center;background:#fff;"></td>';
            return `<td style="padding:0.3rem;text-align:center;"><span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold" style="background:#C2680C;" title="มีวันฝึกซ้อมจริงแต่ไม่มีการเช็คชื่อ">–</span></td>`;
          }
          if (record.status === "A") {
            attendedCount += 1;
            const avg = computeAvgScore(record.scores);
            if (avg !== null) {
              scoreSum += avg;
              scoreCount += 1;
            }
            const label = avg !== null ? avg.toFixed(1) : "-";
            return `<td style="padding:0.3rem;text-align:center;"><span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-700 text-white text-[10px] font-bold" title="มาซ้อม คะแนนเฉลี่ย ${avg !== null ? avg.toFixed(2) : "ยังไม่ให้คะแนน"}">${label}</span></td>`;
          }
          if (EXECUTIVE_STATUS_META[record.status]) {
            missedCount += 1;
            return `<td style="padding:0.3rem;text-align:center;"><span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-700 text-white text-[10px] font-bold" title="${EXECUTIVE_STATUS_META[record.status]}">${escapeHtml(record.status)}</span></td>`;
          }
          // สถานะอื่นที่ไม่รู้จัก (กันโค้ดพังถ้าข้อมูลเพี้ยน) — แสดงตัวย่อสถานะดิบๆ ไว้เทาๆ ไม่นับเข้าสรุปฝั่งไหน
          return `<td style="padding:0.3rem;text-align:center;"><span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-600 text-[10px] font-bold">${escapeHtml(record.status ?? "?")}</span></td>`;
        })
        .join("");

      const totalReported = attendedCount + missedCount;
      const percent = totalReported > 0 ? Math.round((attendedCount / totalReported) * 100) : null;
      const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : "-";
      const percentText = percent === null ? "-" : `${percent}%`;
      const percentColor = percent === null ? "text-slate-400" : percent >= 80 ? "text-emerald-700" : percent >= 50 ? "text-amber-700" : "text-red-700";

      return `
        <tr>
          <td class="emphasis" style="position:sticky;left:0;background:#fff;white-space:nowrap;padding:0.5rem 0.75rem;">${p.number != null ? escapeHtml(p.number) + " · " : ""}${escapeHtml(p.nickname)}</td>
          <td style="text-align:center;background:#F8FAFC;font-weight:600;">${attendedCount}</td>
          <td style="text-align:center;background:#F8FAFC;">${missedCount}</td>
          <td style="text-align:center;background:#F8FAFC;">${avgScore}</td>
          <td style="text-align:center;background:#F8FAFC;border-right:2px solid #E1E4DE;font-weight:600;" class="${percentColor}">${percentText}</td>
          ${dayCells}
        </tr>`;
    })
    .join("");

  executiveAttendanceGridWrap.innerHTML = `
    <table class="pro-table grid-table" style="font-size:0.75rem;">
      <thead>
        <tr>
          <th style="position:sticky;left:0;background:#EEF0EC;text-align:left;min-width:9rem;">นักกีฬา</th>
          <th style="text-align:center;" title="Attendance — จำนวนครั้งที่มาซ้อม">A</th>
          <th style="text-align:center;" title="Missed — รวมบาดเจ็บ/ลา/พักฟื้น">Missed</th>
          <th style="text-align:center;" title="Average — คะแนนเฉลี่ยรวม">AV</th>
          <th style="text-align:center;border-right:2px solid #E1E4DE;" title="% เข้าร่วม">%</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

executiveAttendanceAgeGroupSelect.addEventListener("change", () => {
  renderExecutiveDailyAttendanceForAgeGroup(executiveAttendanceAgeGroupSelect.value);
});

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
        const typeIcon = n.type === "player" ? icon("star") : n.type === "coach" ? icon("alert-triangle") : icon("pin");
        const postedAt =
          n.createdAt && typeof n.createdAt.toDate === "function"
            ? n.createdAt.toDate().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
            : "-";
        const unreadBadge = n.read ? "" : '<span class="badge badge-info">ใหม่</span>';
        const readBtn = n.read
          ? ""
          : `<button type="button" class="btn btn-ghost btn-sm mt-2" data-mark-read-id="${n.id}">${icon("check")} ทำเครื่องหมายว่าอ่านแล้ว</button>`;
        return `
          <div class="card card-pad${n.read ? "" : " border-2 border-blue-200"}">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <p class="font-semibold">${typeIcon} ${n.refLabel ?? "-"}</p>
              ${unreadBadge}
            </div>
            <p class="text-sm text-slate-600 mt-1 whitespace-pre-line">${escapeHtml(n.message ?? "-")}</p>
            <p class="text-xs text-slate-400 mt-2">จาก ${escapeHtml(n.createdBy ?? "ผู้ดูแลระบบ")} • ${postedAt}</p>
            ${readBtn}
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="text-sm text-red-600">โหลดข้อความไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
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

// ---------- จำหน้าจอปัจจุบันไว้ใน URL hash — กดรีเฟรชแล้วกลับมาอยู่หน้าเดิม ----------
// หน้านี้สลับหลายจอด้วยการซ่อน/แสดง section โดยเดิมไม่มีอะไรใน URL บอกว่าอยู่จอไหน รีเฟรชแล้วโค้ชเด้งกลับ Daily ส่วนผู้ดูแลระบบ
// ที่สวมบทบาทอยู่หลุดไป Dashboard ตอนนี้ทุกครั้งที่จอเปลี่ยน (สังเกตผ่าน MutationObserver ที่ตัว section ไม่ต้องแก้ทุกฟังก์ชันเปิดหน้า)
// จะเขียนหน้าจอ/วันที่/บริบทการสวมบทบาทลง hash ด้วย replaceState (ไม่เพิ่มประวัติเบราว์เซอร์) แล้วตอนโหลดหน้าอ่านกลับมาเปิดจอเดิม
// รูปแบบและการแปลงอยู่ที่ screen-route.js ที่นี่ผูกกับ DOM/สถานะของหน้า — ข้อมูลที่กรอกค้างในฟอร์มยังไม่ถูกเก็บ (กลับมาเป็นฟอร์มว่าง)
const ROUTE_SCREENS = [
  { el: dailySection, key: "daily", kind: "coach" },
  { el: meetingTasksSection, key: "meeting-tasks", kind: "coach" },
  { el: meetingMenuSection, key: "meeting-menu", kind: "coach" },
  { el: meetingNextSection, key: "meeting-next", kind: "coach" },
  { el: meetingHistorySection, key: "meeting-history", kind: "coach" },
  { el: checkinSection, key: "checkin", kind: "coach" },
  { el: reportSection, key: "report", kind: "coach" },
  { el: matchReportSection, key: "match", kind: "coach" },
  { el: injuryReportSection, key: "injury", kind: "coach" },
  { el: trainingPlanSection, key: "plan", kind: "coach" },
  { el: trainingPlanMenuSection, key: "training-plan", kind: "coach" },
  { el: planDataSection, key: "plan-data", kind: "coach" },
  { el: reportDataSection, key: "report-data", kind: "coach" },
  { el: playerGallerySection, key: "players", kind: "coach" },
  { el: playerDetailSection, key: "player-detail", kind: "coach" },
  { el: addPlayerSection, key: "player-form", kind: "coach" },
  { el: instructionSection, key: "instruction", kind: "coach" },
  { el: attendanceGridSection, key: "attendance-grid", kind: "coach" },
  { el: matchDataSection, key: "match-data", kind: "coach" },
  { el: matchFormSection, key: "match-form", kind: "coach" },
  { el: matchHistorySection, key: "match-history", kind: "coach" },
  { el: matchSheetSection, key: "match-sheet", kind: "coach" },
  { el: fitnessEntrySection, key: "fitness", kind: "coach" },
  { el: evaluationMenuSection, key: "evaluation", kind: "coach" },
  { el: physicalTestMenuSection, key: "physical-test", kind: "coach" },
  { el: physicalInstructionSection, key: "physical-instruction", kind: "coach" },
  { el: physicalFormSection, key: "physical-form", kind: "coach" },
  { el: athleteResultsSection, key: "athlete-results", kind: "coach" },
  { el: profileSection, key: "profile", kind: "coach" },
  { el: injuryMenuSection, key: "injury-menu", kind: "coach" },
  { el: injuryResultsSection, key: "injury-results", kind: "coach" },
  { el: executiveSection, key: "executive", kind: "executive" },
  { el: executivePlayersSection, key: "executive-players", kind: "executive" },
  { el: adminCoachesSection, key: "coaches", kind: "admin" },
  { el: adminPlayerAuditSection, key: "player-audit", kind: "admin" },
  { el: adminProgressSection, key: "progress", kind: "admin" },
  { el: adminApprovalsSection, key: "approvals", kind: "admin" },
  { el: adminMatchesSection, key: "matches", kind: "admin" },
  { el: adminInjuriesSection, key: "injuries", kind: "admin" },
  { el: adminManageTeamSection, key: "manage-team", kind: "admin" },
  { el: adminDashboardSection, key: "dashboard", kind: "admin" },
  { el: adminPrintSection, key: "print", kind: "admin" },
  { el: adminReportCardSection, key: "report-card", kind: "admin" },
  { el: adminMascRoundsSection, key: "masc-rounds", kind: "admin" },
  { el: adminMeetingsSection, key: "meetings", kind: "admin" },
  { el: adminFitnessRoundsSection, key: "fitness-rounds", kind: "admin" },
  { el: adminAthleteWindowsSection, key: "athlete-windows", kind: "admin" }
];
let routeSyncEnabled = false;

function routeDateForScreen(key) {
  const input = { checkin: dateInput, report: reportDateInput, plan: trainingPlanDateInput }[key];
  return input && isValidRouteDate(input.value) ? input.value : undefined;
}

function currentRouteFromScreen() {
  const active = ROUTE_SCREENS.find((s) => !s.el.classList.contains("hidden"));
  if (!active) return null;
  if (currentIsAdmin && myTeam) {
    const route = {
      admin: "team",
      team: myTeam,
      as: adminViewingAs === "executive" ? "executive" : "coach",
      coach: adminViewingCoachId || undefined,
      ret: adminReturnSection === adminCoachesSection ? "coaches" : "manage-team"
    };
    if (active.kind === "coach") {
      route.screen = active.key;
      route.date = routeDateForScreen(active.key);
    }
    return route;
  }
  if (currentIsAdmin) return active.kind === "admin" ? { admin: active.key } : null;
  return active.kind === "coach" ? { screen: active.key, date: routeDateForScreen(active.key) } : null;
}

function syncRouteToUrl() {
  if (!routeSyncEnabled) return;
  const route = currentRouteFromScreen();
  if (!route) return;
  const current = window.location.hash.replace(/^#/, "");
  // hash ปัจจุบันบอกแผงผู้ดูแลระบบหน้านี้อยู่แล้ว (เช่น ลิงก์แจ้งเตือน #admin=progress&team=... ที่หน้าจอยังต้องอ่านค่า team ต่อ) ไม่เขียนทับ
  if (route.admin && route.admin !== "team" && parseRouteHash(current).admin === route.admin) return;
  const next = buildRouteHash(route);
  if (next === current) return;
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
}

function enableRouteSync() {
  routeSyncEnabled = true;
  syncRouteToUrl();
}

{
  const routeObserver = new MutationObserver(() => {
    syncRouteToUrl();
    renderCoachNav();
  });
  for (const s of ROUTE_SCREENS) routeObserver.observe(s.el, { attributes: true, attributeFilter: ["class"] });
  for (const input of [dateInput, reportDateInput, trainingPlanDateInput]) {
    input.addEventListener("change", syncRouteToUrl);
  }
}

// เปิดหน้าจอของโค้ชตาม key ใน hash (ไม่รู้จัก key = Daily) และคืนวันที่ที่เลือกไว้ — เช็คชื่อใช้ "เรียกดู" (ไม่สร้างวันซ้อมใหม่)
// เพื่อให้รีเฟรชไม่ไปสร้างเอกสารวันซ้อมเปล่าโดยไม่ตั้งใจ ถ้าวันซ้อมนั้นมีอยู่แล้วตารางจะขึ้นเหมือนเดิม
function openCoachScreen(screen, date) {
  const d = isValidRouteDate(date) ? date : null;
  switch (screen) {
    case "checkin":
      openCheckinSection();
      if (d) dateInput.value = d;
      if (!dateInput.value) dateInput.value = todayBangkok();
      viewSessionForDate(dateInput.value).catch((err) => {
        console.error(err);
        setAttendanceStatus("เรียกดูไม่สำเร็จ: " + err.message, true);
      });
      break;
    case "report":
      openReportSection();
      if (d) reportDateInput.value = d;
      reportLoadBtn.click();
      break;
    case "plan":
      openTrainingPlanSection();
      if (d) trainingPlanDateInput.value = d;
      break;
    case "training-plan":
      openTrainingPlanLanding();
      break;
    case "plan-data":
      openPlanData();
      break;
    case "report-data":
      openReportData();
      break;
    case "match":
    case "match-data":
      openMatchDataLanding();
      break;
    case "match-form":
      openMatchForm();
      break;
    case "match-history":
    case "match-sheet": // รหัสรายงานไม่ได้เก็บใน URL — รีเฟรชแล้วกลับมาที่ประวัติ
      openMatchHistory();
      break;
    case "injury":
      openInjuryReportSection();
      break;
    case "players":
    case "player-detail": // รหัสนักกีฬาไม่ได้เก็บใน URL — รีเฟรชแล้วกลับมาที่แกลเลอรี
      openPlayerGallery();
      break;
    case "player-form":
      openPlayerForm();
      break;
    case "instruction":
      openInstructionSection();
      break;
    case "attendance-grid":
      openAttendanceGrid();
      break;
    case "fitness":
      openFitnessEntrySection();
      break;
    case "evaluation":
      openEvaluationLanding();
      break;
    case "physical-test":
      openPhysicalTestLanding();
      break;
    case "physical-instruction":
      openPhysicalInstruction();
      break;
    case "physical-form":
      openPhysicalForm();
      break;
    case "athlete-results":
      openAthleteResultsSection();
      break;
    case "profile":
      openProfileSection();
      break;
    case "injury-menu":
      openInjuryMenu();
      break;
    case "injury-results":
      openInjuryResults();
      break;
    case "meeting-menu":
      openMeetingMenu();
      break;
    case "meeting-next":
      openMeetingNext();
      break;
    case "meeting-history":
      openMeetingHistory();
      break;
    case "meeting-tasks":
      openMeetingTasksSection();
      break;
    default:
      showDaily();
  }
}

// ผู้ดูแลระบบรีเฟรชขณะสวมบทบาทจัดการทีมอยู่: เข้าโหมดเดิม (ทีม/โค้ชคนเดิม/ผู้บริหารทีม) แล้วเปิดจอเดิม — คืน false ถ้าข้อมูลใน hash
// ใช้ไม่ได้ (ทีมไม่มีจริง) ให้ผู้เรียก fallback ไปทางเดิม
async function restoreAdminTeamContext(route) {
  if (!TEAMS.includes(route.team)) return false;
  const wantedRole = route.as === "executive" ? "executive" : "coach";
  let record = null;
  if (route.coach) {
    try {
      const snap = await getDoc(doc(db, "coaches", route.coach));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        if (data.team === route.team && data.role === wantedRole && data.status === "approved") record = data;
      }
    } catch (err) {
      console.error(err);
    }
  }
  const returnSection = route.ret === "coaches" ? adminCoachesSection : adminManageTeamSection;
  if (wantedRole === "executive") {
    await enterExecutiveViewMode(route.team, returnSection, record);
  } else {
    await enterTeamManagementMode(route.team, returnSection, record, () => openCoachScreen(route.screen, route.date));
  }
  return true;
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
    routeSyncEnabled = false;
    hideAllScreens();
    closeDrawer();
    return;
  }

  try {
    const coachDoc = await getDoc(doc(db, "coaches", user.uid));
    const data = coachDoc.exists() ? coachDoc.data() : null;

    if (!data || data.status !== "approved") {
      currentIsAdmin = false;
      currentStaffPerms = null;
      renderCoachProfile(user, data, (data && data.team) || (data && data.role === "staff" ? "รอผู้ดูแลระบบอนุมัติและกำหนดสิทธิ์" : "รอผู้ดูแลระบบกำหนดทีม"));
      coachAgeGroupsWrap.classList.add("hidden");
      hideAllScreens();
      pendingSection.classList.remove("hidden");
      return;
    }

    // ตั้งแต่จุดนี้เป็นต้นไปบัญชีได้รับอนุมัติแล้ว (ทุกบทบาท) จึงแสดงปุ่มเมนู/แจ้งเตือนที่แถบด้านบน
    hamburgerBtn.classList.remove("hidden");
    notificationBellBtn.classList.remove("hidden");

    // ทีมหลังบ้านใช้หน้าจอแผงผู้ดูแลระบบร่วมกัน แต่เมนู/ปุ่มซ่อนตามสิทธิ์ที่ได้รับ (currentStaffPerms; null = แอดมินหลัก)
    const isStaffRole = data.role === "staff";
    currentStaffPerms = isStaffRole ? normalizePermissions(data.permissions) : null;
    currentIsAdmin = data.role === "admin" || isStaffRole;
    if (isStaffRole) notificationBellBtn.classList.add("hidden"); // การแจ้งเตือนเป็นของแอดมินหลัก

    if (currentIsAdmin) {
      coachRoleBadgeEl.textContent = isStaffRole ? "ทีมหลังบ้าน" : "ผู้ดูแลระบบ";
      coachRoleBadgeEl.className = isStaffRole ? "badge badge-warning" : "badge badge-info";
      renderCoachProfile(user, data, isStaffRole ? "เข้าถึงตามสิทธิ์ที่ได้รับ" : "เข้าถึงได้ทุกทีม");
      coachAgeGroupsWrap.classList.add("hidden");
      // เก็บชื่อ/อีเมลของผู้ดูแลระบบเองไว้ใช้คืนค่ากลับตอนออกจากโหมดสวมบทบาท (ดู exitTeamManagementToAdminPanel)
      adminOwnName = coachNameEl.textContent;
      adminOwnEmail = coachEmailEl.textContent;
      myTeam = null;
      adminReturnSection = null;
      renderDrawerItems();
      if (!isStaffRole) refreshNotifications();

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
        "masc-rounds": openAdminMascRoundsSection,
        meetings: openAdminMeetingsSection,
        "fitness-rounds": openAdminFitnessRoundsSection,
        "athlete-windows": openAdminAthleteWindowsSection
      };
      const route = parseRouteHash(window.location.hash);
      if (route.admin === "team" && adminCan("team") && (await restoreAdminTeamContext(route))) {
        enableRouteSync();
        return;
      }
      const adminDeepLink = route.admin;
      // ลิงก์ตรงไปหน้าที่ไม่มีสิทธิ์ ถือเหมือนไม่ได้ระบุหน้า (ตกไปหน้าแรกของบัญชีนั้น) — เมนูที่ซ่อนไว้ก็เข้าทาง URL ไม่ได้ด้วย
      if (adminDeepLink && adminDeepLinks[adminDeepLink] && adminCan(adminDeepLink)) {
        adminDeepLinks[adminDeepLink]();
        enableRouteSync();
      } else if (!isStaffRole || staffLandingFeature(currentStaffPerms) === "dashboard") {
        window.location.href = `${window.location.origin}/`;
      } else {
        // ทีมหลังบ้านที่ไม่มีสิทธิ์ดู Dashboard: เปิดเครื่องมือแรกที่มีสิทธิ์ (ไม่มีสิทธิ์ใดเลย = หน้ารออนุมัติ)
        const landing = staffLandingFeature(currentStaffPerms);
        if (landing && adminDeepLinks[landing]) {
          adminDeepLinks[landing]();
          enableRouteSync();
        } else {
          hideAllScreens();
          pendingSection.classList.remove("hidden");
        }
      }
      return;
    }

    if (data.role === "executive") {
      coachRoleBadgeEl.textContent = "ผู้บริหารทีม";
      coachRoleBadgeEl.className = "badge badge-neutral";
      renderCoachProfile(user, data, data.team);
      coachAgeGroupsWrap.classList.add("hidden");
      myTeam = null;
      myExecutiveTeam = data.team;
      adminViewingAs = null;
      // บัญชีผู้บริหารทีมจริงไม่ต้องแนบ ?team= เพราะ Dashboard รู้ทีมจากบัญชีอยู่แล้ว (ต่างจากตอนผู้ดูแล
      // ระบบสวมบทบาทที่ enterExecutiveViewMode ซึ่งต้องแนบทีมไปกับลิงก์ด้วย)
      executiveDashboardLink.href = "./index.html";
      renderDrawerItems();
      showExecutiveHome(data.team);
      return;
    }

    coachRoleBadgeEl.textContent = "โค้ช";
    coachRoleBadgeEl.className = "badge badge-success";
    myTeam = data.team;
    myCoachName = data.name || user.email;
    myAgeGroups = data.ageGroups || [];
    myCoachPosition = data.coachPosition || null;
    renderCoachProfile(user, data, myTeam);
    currentCoachRecord = { id: user.uid, ...data };
    coachAgeGroupsWrap.classList.remove("hidden");
    coachAgeGroupsEl.textContent = myAgeGroups.length ? myAgeGroups.join(", ") : "-";
    adminReturnSection = null;
    if (!dateInput.value) {
      dateInput.value = todayBangkok();
    }
    await loadPlayers();
    renderDrawerItems();
    // รีเฟรชแล้วกลับมาจอเดิม (screen/d ใน hash) — ไม่มีหรือไม่รู้จักก็เปิด Daily เหมือนเดิม
    const restored = parseRouteHash(window.location.hash);
    openCoachScreen(restored.screen, restored.date);
    enableRouteSync();
    refreshCoachNotifications();
    refreshMeetingTaskCount();
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

// ---------- Player Data (เมนู 2): แกลเลอรี → รายละเอียดรายคน → เพิ่ม/แก้ไข/ลบ ----------
// โค้ชเห็นเฉพาะนักกีฬาที่ loadPlayers() กรองให้แล้ว (รุ่นอายุ + ตำแหน่งตามที่รับผิดชอบ)
let galleryAgeGroup = "all";
let detailPlayerId = null;

function playerPhotoHtml(p) {
  const src = safeHttpUrl(p.photoUrl);
  return src ? `<img src="${src}" alt="" loading="lazy" />` : icon("user");
}

function openPlayerGallery(message = "") {
  hideAllScreens();
  playerGallerySection.classList.remove("hidden");
  playerGalleryStatus.textContent = message;
  renderPlayerGallery();
}

function playerCardHtml(p) {
  return `<button type="button" class="player-card" data-player-id="${escapeHtml(p.id)}">
    <span class="player-card-photo">${playerPhotoHtml(p)}</span>
    <span class="player-card-body">
      <span class="player-card-name">${escapeHtml(playerDisplayName(p))}${p.number != null ? ` <span class="badge badge-neutral">#${escapeHtml(p.number)}</span>` : ""}</span>
      <span class="player-card-label">FULL NAME (ชื่อจริง)</span>
      <span class="player-card-value">${escapeHtml(p.fullName ?? "-")}</span>
      <span class="player-card-label">AGE GROUP (รุ่นอายุ)</span>
      <span class="badge badge-neutral">${escapeHtml(p.ageGroup ?? "-")}</span>
      <span class="player-card-label">YEAR OF BIRTH (ปีเกิด)</span>
      <span class="badge badge-success">${escapeHtml(birthYearLabel(p.birthday))}</span>
    </span>
  </button>`;
}

function renderPlayerGallery() {
  const groups = ageGroupsOf(players);
  if (galleryAgeGroup !== "all" && !groups.includes(galleryAgeGroup)) galleryAgeGroup = "all";
  // ปุ่มสลับรุ่นอายุ แสดงเมื่อโค้ชดูแลหลายรุ่น (รุ่นเดียวไม่ต้องมีตัวเลือก)
  playerGalleryChips.innerHTML =
    groups.length > 1
      ? ["all", ...groups]
          .map((g) => {
            const cls = g === galleryAgeGroup ? "chip-toggle active" : "chip-toggle";
            return `<button type="button" class="${cls}" data-gallery-group="${escapeHtml(g)}">${g === "all" ? "ทุกรุ่น" : escapeHtml(g)}</button>`;
          })
          .join("")
      : "";
  const list = filterAndSortPlayers(players, { ageGroup: galleryAgeGroup, query: playerGallerySearch.value, sort: playerGallerySort.value });
  playerGalleryCount.textContent = `${groups.length > 0 ? `${groups.join(" · ")} · ` : ""}${list.length} คน`;
  playerGalleryGrid.innerHTML =
    list.length > 0
      ? list.map(playerCardHtml).join("")
      : `<div class="card card-pad text-center text-slate-500" style="grid-column:1/-1">${players.length === 0 ? "ยังไม่มีนักกีฬาในความดูแล — กด \"+ เพิ่มนักกีฬา\" เพื่อเริ่มต้น" : "ไม่พบนักกีฬาตามเงื่อนไขที่เลือก"}</div>`;
}

playerGalleryChips.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-gallery-group]");
  if (!btn) return;
  galleryAgeGroup = btn.dataset.galleryGroup;
  renderPlayerGallery();
});
playerGallerySearch.addEventListener("input", renderPlayerGallery);
playerGallerySort.addEventListener("change", renderPlayerGallery);
playerGalleryGrid.addEventListener("click", (e) => {
  const card = e.target.closest("[data-player-id]");
  if (card) openPlayerDetail(card.dataset.playerId);
});
playerGalleryAddBtn.addEventListener("click", () => openPlayerForm());

function playerDetailRows(p) {
  const heights = p.parentHeights;
  const parents =
    heights && (heights.father || heights.mother)
      ? `${heights.father ?? "-"} / ${heights.mother ?? "-"} ซม.${heights.source ? ` (${heights.source})` : ""}`
      : "-";
  return [
    ["ชื่อ-นามสกุล", p.fullName ?? "-"],
    ["รุ่นอายุ", p.ageGroup ?? "-"],
    ["วันเกิด / ปีเกิด", birthdayLabel(p.birthday)],
    ["ตำแหน่ง", p.position ?? "-"],
    ["เพศ", p.sex ?? "-"],
    ["ส่วนสูงพ่อ / แม่", parents]
  ]
    .map(([label, value]) => `<div class="player-detail-row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

function openPlayerDetail(id) {
  const p = players.find((x) => x.id === id);
  if (!p) {
    openPlayerGallery();
    return;
  }
  detailPlayerId = id;
  hideAllScreens();
  playerDetailSection.classList.remove("hidden");
  playerDetailBody.innerHTML = `<div class="flex gap-5 flex-wrap">
    <div class="player-detail-photo">${playerPhotoHtml(p)}</div>
    <div class="flex-1 min-w-[240px]">
      <h2 class="text-xl font-bold">${escapeHtml(playerDisplayName(p))}${p.number != null ? ` <span class="badge badge-neutral">เบอร์ ${escapeHtml(p.number)}</span>` : ""}</h2>
      <dl class="mt-2">${playerDetailRows(p)}</dl>
      <div class="flex gap-2 flex-wrap mt-4">
        <button type="button" class="btn btn-secondary" data-detail-action="edit">${icon("edit")} แก้ไขข้อมูล</button>
        <button type="button" class="btn btn-danger-soft" data-detail-action="delete">${icon("trash")} ลบนักกีฬา</button>
      </div>
    </div>
  </div>`;
}

playerDetailBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-detail-action]");
  const p = players.find((x) => x.id === detailPlayerId);
  if (!btn || !p) return;
  if (btn.dataset.detailAction === "edit") startEditPlayer(p);
  else deletePlayer(p);
});
playerDetailBackBtn.addEventListener("click", () => openPlayerGallery());

// ฟอร์มเพิ่ม/แก้ไข — ปุ่มกลับพาไปหน้ารายละเอียดถ้ากำลังแก้ไขอยู่ ไม่งั้นกลับแกลเลอรี
function openPlayerFormScreen() {
  hideAllScreens();
  addPlayerSection.classList.remove("hidden");
  applyAgeGroupLock();
}

function openPlayerForm() {
  stopEditPlayer();
  addPlayerStatus.textContent = "";
  openPlayerFormScreen();
}

function leavePlayerForm() {
  const editedId = editingPlayerId;
  stopEditPlayer();
  addPlayerStatus.textContent = "";
  if (editedId) openPlayerDetail(editedId);
  else openPlayerGallery();
}
playerFormBackBtn.addEventListener("click", leavePlayerForm);
function startEditPlayer(p) {
  openPlayerFormScreen();
  editingPlayerId = p.id;
  document.getElementById("player-number").value = p.number ?? "";
  document.getElementById("player-nickname").value = p.nickname ?? "";
  document.getElementById("player-fullname").value = p.fullName ?? "";
  document.getElementById("player-birthday").value = p.birthday ?? "";
  document.getElementById("player-age-group").value = p.ageGroup ?? "";
  document.getElementById("player-position").value = p.position ?? "";
  document.getElementById("player-sex").value = p.sex ?? "";
  document.getElementById("player-father-height").value = p.parentHeights?.father ?? "";
  document.getElementById("player-mother-height").value = p.parentHeights?.mother ?? "";
  document.getElementById("player-parent-height-source").value = p.parentHeights?.source ?? "แจ้งเอง";
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

cancelEditPlayerBtn.addEventListener("click", leavePlayerForm);

async function deletePlayer(p) {
  const ok = confirm(`ยืนยันลบนักกีฬา "${p.nickname ?? p.fullName}" ออกจากระบบ?\nข้อมูลเช็คชื่อและผลประเมินเดิมที่อ้างถึงนักกีฬาคนนี้จะไม่ถูกลบ และการลบนี้ไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "players", p.id));
    // ลบรูปนักกีฬาใน Storage ทิ้งด้วยแบบ best-effort กันไฟล์ค้าง (ไม่บล็อกการลบเอกสารหลักถ้าลบรูปไม่สำเร็จ)
    await deleteStorageFileBestEffort(p.photoPath);
    if (editingPlayerId === p.id) stopEditPlayer();
    await loadPlayers();
    openPlayerGallery(`ลบ "${p.nickname ?? p.fullName}" แล้ว`);
    if (currentSessionId && currentSessionData && !currentSessionData.noTraining) {
      const existingMap = await loadExistingAttendance(currentSessionId);
      renderRoster(existingMap);
    }
  } catch (err) {
    console.error(err);
    openPlayerGallery("ลบไม่สำเร็จ: " + err.message);
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
  const sex = document.getElementById("player-sex").value;
  const parentHeights = parseParentHeights({
    father: document.getElementById("player-father-height").value,
    mother: document.getElementById("player-mother-height").value,
    source: document.getElementById("player-parent-height-source").value
  });
  if (parentHeights.error) {
    addPlayerStatus.textContent = parentHeights.error;
    addPlayerStatus.className = "text-sm text-red-600";
    return;
  }
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
    sex: sex || null,
    parentHeights: parentHeights.value,
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

    const editedId = editingPlayerId;
    if (editingPlayerId) {
      await updateDoc(doc(db, "players", editingPlayerId), payload);
      addPlayerStatus.innerHTML = `บันทึกการแก้ไข "${escapeHtml(nickname)}" สำเร็จ ${icon("check")}${escapeHtml(birthdayCorrectedNote)}`;
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
      addPlayerStatus.innerHTML = `เพิ่ม "${escapeHtml(nickname)}" สำเร็จ ${icon("check")}${escapeHtml(birthdayCorrectedNote)}`;
      addPlayerStatus.className = "text-sm text-emerald-600";
    }

    // ลบรูปเก่าทิ้งแบบ best-effort หลังบันทึกสำเร็จแล้วเท่านั้น (เฉพาะตอนถูกแทนที่ด้วยรูปใหม่ หรือถูกลบทิ้ง)
    if (oldPhotoPath && (selectedPhoto || payload.photoPath === null)) {
      await deleteStorageFileBestEffort(oldPhotoPath);
    }

    await loadPlayers();
    renderPlayerGallery();
    if (currentSessionId && currentSessionData && !currentSessionData.noTraining) {
      const existingMap = await loadExistingAttendance(currentSessionId);
      renderRoster(existingMap);
    }
    if (editedId) openPlayerDetail(editedId);
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
    map.set(data.playerId, { status: data.status, scores: data.scores || {}, updatedAt: data.updatedAt, injuryReportId: data.injuryReportId ?? null });
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
  const lockState = rosterLockState({
    complete: isRosterComplete(existingMap),
    sessionDate: (currentSessionData && currentSessionData.date) || dateInput.value,
    today: todayBangkok(),
    isAdmin: currentIsAdmin
  });
  const locked = lockState === "locked";
  rosterLockedBanner.classList.toggle("hidden", !locked);
  rosterCompleteBanner.classList.toggle("hidden", lockState !== "complete-editable");

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
        ? `<span class="badge badge-neutral">${escapeHtml(existing.status)}</span>`
        : '<span class="text-slate-400">-</span>';
    } else {
      // ถ้าเปิดฟอร์มรายงานบาดเจ็บค้างอยู่ ให้ปุ่มที่กดไว้เป็นสีเต็มทันที (ยังไม่บันทึกสถานะจนกว่าจะกดบันทึก/ข้ามในฟอร์ม)
      const staged = injuryFormState && injuryFormState.playerId === p.id ? injuryFormState : null;
      statusTd.appendChild(
        createSegmentedGroup(STATUS_OPTIONS, staged ? staged.status : existing.status, (status) => onStatusTap(p, status))
      );
    }
    const injuryExtras = buildInjuryExtras(p, existing, locked);
    if (injuryExtras) statusTd.appendChild(injuryExtras);
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
    if (!locked && injuryFormState && injuryFormState.playerId === p.id) {
      rosterBody.appendChild(buildInjuryFormRow(p, injuryFormState));
    }
  }
  applyDataLabels(rosterBody);
}

// ---------- เชื่อมรายงานบาดเจ็บกับเช็คชื่อ (ตรรกะล้วนอยู่ที่ injury-attendance.js) ----------
function currentSessionDate() {
  return (currentSessionData && currentSessionData.date) || dateInput.value;
}

async function loadTeamInjuries() {
  const snap = await getDocs(query(collection(db, "injuryReports"), where("team", "==", myTeam)));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

function makeButton(text, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

// ข้อมูลเสริมใต้ปุ่มสถานะของแถว: รายงานที่ผูกอยู่ (I/R) / คำถาม "หายแล้วใช่ไหม" (กด A ทั้งที่ยังมีรายงานค้าง) / ลิงก์สร้างรายงาน (I/R ที่ยังไม่มีรายงาน)
function buildInjuryExtras(p, existing, locked) {
  const injury = activeInjuryMap.get(p.id);
  const status = existing.status;
  const wrap = document.createElement("div");
  wrap.className = "mt-2 space-y-1";
  if (injury && (status === "I" || status === "R")) {
    const info = describeInjury(injury, currentSessionDate());
    const line = document.createElement("p");
    line.className = "text-xs text-slate-600";
    line.innerHTML = `${icon("heart-pulse")} ${escapeHtml(info.text)}${info.overdue ? ' <span class="badge badge-warning">เลยวันคาดว่ากลับแล้ว</span>' : ""}`;
    const note = document.createElement("p");
    note.className = "text-xs text-slate-400";
    note.textContent = `${existing.injuryReportId ? "ผูกกับรายงานบาดเจ็บ · " : ""}แก้สถานะได้ถ้าไม่ตรงความจริง`;
    wrap.append(line, note);
    return wrap;
  }
  if (locked) return null;
  if (injury && status === "A" && !dismissedHealHints.has(p.id)) {
    const box = document.createElement("div");
    box.className = "rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-sm space-y-2";
    const msg = document.createElement("p");
    msg.textContent = `มีรายงานบาดเจ็บที่ยังไม่หาย: ${injury.description || "-"} · หายแล้วใช่ไหม?`;
    const actions = document.createElement("div");
    actions.className = "flex gap-2 flex-wrap";
    actions.append(
      makeButton("เปลี่ยนรายงานเป็นหายแล้ว", "btn btn-secondary btn-sm", () => healInjuryFromRoster(p)),
      makeButton("ยังไม่หาย (ปรับเป็น R)", "btn btn-secondary btn-sm", () =>
        commitAttendanceChange(p.id, { status: "R", injuryReportId: injury.id })
      ),
      makeButton("ซ่อน", "btn btn-ghost btn-sm", () => {
        dismissedHealHints.add(p.id);
        renderRoster(currentAttendanceMap);
      })
    );
    box.append(msg, actions);
    wrap.appendChild(box);
    return wrap;
  }
  if (!injury && (status === "I" || status === "R") && !(injuryFormState && injuryFormState.playerId === p.id)) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 flex-wrap text-xs text-slate-500";
    row.append(
      "ยังไม่มีรายงานบาดเจ็บ",
      makeButton("สร้างรายงาน", "btn btn-ghost btn-sm", () => {
        injuryFormState = { playerId: p.id, status, description: "", severity: INJURY_SEVERITIES[0], error: "" };
        renderRoster(currentAttendanceMap);
      })
    );
    wrap.appendChild(row);
    return wrap;
  }
  return null;
}

// แตะปุ่มสถานะ: I/R ที่ยังไม่มีรายงานบาดเจ็บค้างอยู่ → เปิดฟอร์มสั้นก่อน (ยังไม่บันทึกสถานะ) ส่วนอื่นบันทึกทันทีเหมือนเดิม
function onStatusTap(p, status) {
  const prev = currentAttendanceMap.get(p.id) || {};
  const injury = activeInjuryMap.get(p.id);
  injuryFormState = null;
  if (status === "I" || status === "R") {
    if (injury) {
      commitAttendanceChange(p.id, { status, injuryReportId: injury.id });
      return;
    }
    injuryFormState = { playerId: p.id, status, description: "", severity: INJURY_SEVERITIES[0], error: "" };
    renderRoster(currentAttendanceMap);
    return;
  }
  // เปลี่ยนเป็น A/P: ล้างลิงก์รายงานเดิมของวันนี้ (ถ้ามี) — ตัวรายงานบาดเจ็บเองไม่ถูกแตะ
  commitAttendanceChange(p.id, prev.injuryReportId ? { status, injuryReportId: null } : { status });
}

function buildInjuryFormRow(p, st) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 7;
  const box = document.createElement("div");
  box.className = "rounded-lg bg-slate-50 px-3 py-3 space-y-2";
  const title = document.createElement("p");
  title.className = "text-sm font-semibold text-slate-800";
  title.textContent = `${p.nickname ?? p.fullName ?? "นักกีฬา"} ยังไม่มีรายงานบาดเจ็บ — บันทึกสั้นๆ ตอนนี้เลย (แก้รายละเอียดเพิ่มได้ภายหลังที่หน้ารายงานอาการบาดเจ็บ)`;
  const fields = document.createElement("div");
  fields.className = "flex gap-3 flex-wrap items-end";
  const descWrap = document.createElement("div");
  descWrap.className = "flex-1 min-w-[200px]";
  descWrap.innerHTML = '<label class="field-label">อาการ</label>';
  const desc = document.createElement("input");
  desc.type = "text";
  desc.className = "field-input";
  desc.placeholder = "เช่น ข้อเท้าพลิก";
  desc.value = st.description;
  desc.addEventListener("input", () => {
    st.description = desc.value;
  });
  descWrap.appendChild(desc);
  const sevWrap = document.createElement("div");
  sevWrap.innerHTML = '<label class="field-label">ความรุนแรง</label>';
  const sev = document.createElement("select");
  sev.className = "field-input";
  sev.innerHTML = INJURY_SEVERITIES.map((s) => `<option value="${s}">${s}</option>`).join("");
  sev.value = st.severity;
  sev.addEventListener("change", () => {
    st.severity = sev.value;
  });
  sevWrap.appendChild(sev);
  fields.append(descWrap, sevWrap);
  const error = document.createElement("p");
  error.className = "text-xs text-red-600";
  error.textContent = st.error;
  const actions = document.createElement("div");
  actions.className = "flex gap-2 flex-wrap";
  actions.append(
    makeButton("บันทึกรายงานบาดเจ็บ", "btn btn-primary btn-sm", () => submitQuickInjury(p, true)),
    makeButton("บันทึกเฉพาะสถานะ", "btn btn-secondary btn-sm", () => submitQuickInjury(p, false)),
    makeButton("ยกเลิก", "btn btn-ghost btn-sm", () => {
      injuryFormState = null;
      renderRoster(currentAttendanceMap);
    })
  );
  box.append(title, fields, error, actions);
  td.appendChild(box);
  tr.appendChild(td);
  return tr;
}

// withReport = สร้างรายงานบาดเจ็บ + บันทึกสถานะที่ผูกกับรายงาน / ไม่ใช่ = บันทึกสถานะอย่างเดียว (กันไม่ให้ฟอร์มขวางโค้ชที่รีบ)
async function submitQuickInjury(p, withReport) {
  const st = injuryFormState;
  if (!st || st.playerId !== p.id) return;
  if (!withReport) {
    injuryFormState = null;
    commitAttendanceChange(p.id, { status: st.status });
    return;
  }
  const payload = buildQuickInjuryReport({
    team: myTeam,
    player: p,
    playerName: playerLabel(p),
    date: currentSessionDate(),
    description: st.description,
    severity: st.severity,
    attendanceStatus: st.status,
    coachId: auth.currentUser.uid,
    coachName: myCoachName || auth.currentUser.email
  });
  if (!payload) {
    st.error = "กรอกอาการสั้นๆ ก่อนบันทึก (หรือกด \"บันทึกเฉพาะสถานะ\")";
    renderRoster(currentAttendanceMap);
    return;
  }
  try {
    setAttendanceStatus("กำลังบันทึกรายงานบาดเจ็บ...");
    const ref = await addDoc(collection(db, "injuryReports"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    activeInjuryMap.set(p.id, { id: ref.id, ...payload });
    injuryFormState = null;
    commitAttendanceChange(p.id, { status: st.status, injuryReportId: ref.id });
  } catch (err) {
    console.error(err);
    st.error = "บันทึกรายงานไม่สำเร็จ: " + err.message;
    renderRoster(currentAttendanceMap);
    setAttendanceStatus("บันทึกรายงานบาดเจ็บไม่สำเร็จ: " + err.message, true);
  }
}

// กด A ให้คนที่ยังมีรายงานค้าง แล้วโค้ชยืนยันว่า "หายแล้ว" — วันนี้ถือเป็นวันกลับมาซ้อมจริง (actualReturnDate)
async function healInjuryFromRoster(p) {
  const injury = activeInjuryMap.get(p.id);
  if (!injury) return;
  try {
    await updateDoc(doc(db, "injuryReports", injury.id), {
      status: INJURY_STATUS_HEALED,
      actualReturnDate: currentSessionDate(),
      updatedAt: serverTimestamp()
    });
    activeInjuryMap.delete(p.id);
    renderRoster(currentAttendanceMap);
    setAttendanceStatus(`อัปเดตรายงานบาดเจ็บของ ${p.nickname ?? p.fullName ?? "นักกีฬา"} เป็น "หายแล้ว" ✓`);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("อัปเดตรายงานบาดเจ็บไม่สำเร็จ: " + err.message, true);
  }
}

// บันทึกการแตะสถานะ/คะแนน: อัปเดตหน้าจอทันทีจากสถานะปัจจุบัน แล้วต่อคิวเขียน Firestore เบื้องหลัง (ตรรกะอยู่ที่
// attendance-save.js) — ค่า session/วันที่/ทีมจับไว้ตอนแตะ ไม่อ่านตอนเขียน กันสลับวันที่ระหว่างที่ยังรอส่งแล้วไปเขียนผิดวัน
// ผลการเขียนที่ล้มเหลว (เช่น สิทธิ์ไม่พอ) จะโหลดข้อมูลล่าสุดกลับมาแสดงตอนคิวว่าง ส่วนตอนเน็ตหลุด Firestore ไม่ถือว่าล้มเหลว
// แต่เก็บรอส่งเมื่อกลับมาออนไลน์ — ตัวบอกจำนวนรอส่งและคำเตือนตอนปิดหน้า (beforeunload) จึงสำคัญ
let attendanceNeedsResync = false;
let attendanceSlowSaveTimer = null;
const ATTENDANCE_SLOW_SAVE_MS = 6000;

function renderAttendanceSaveIndicator(pending) {
  clearTimeout(attendanceSlowSaveTimer);
  attendanceSlowSaveTimer = null;
  if (pending > 0) {
    setAttendanceStatus(`กำลังบันทึก… (${pending} รายการ)`);
    attendanceSlowSaveTimer = setTimeout(() => {
      if (attendanceSaveQueue.pending > 0) {
        setAttendanceStatus(`สัญญาณอ่อน — ยังรอส่ง ${attendanceSaveQueue.pending} รายการ อย่าปิดหน้านี้จนกว่าจะขึ้น "บันทึกแล้ว ✓"`, true);
      }
    }, ATTENDANCE_SLOW_SAVE_MS);
    return;
  }
  if (attendanceNeedsResync) {
    attendanceNeedsResync = false;
    resyncRosterAfterSaveError();
    return;
  }
  setAttendanceStatus("บันทึกแล้ว ✓");
}

async function resyncRosterAfterSaveError() {
  if (!currentSessionId) return;
  try {
    renderRoster(await loadExistingAttendance(currentSessionId));
    setAttendanceStatus("บันทึกบางรายการไม่สำเร็จ — โหลดข้อมูลล่าสุดกลับมาแล้ว กรุณาตรวจสอบและแตะใหม่อีกครั้ง", true);
  } catch (err) {
    console.error(err);
    setAttendanceStatus("บันทึกบางรายการไม่สำเร็จ และโหลดข้อมูลล่าสุดไม่ได้: " + err.message, true);
  }
}

const attendanceSaveQueue = createSaveQueue({
  onChange: renderAttendanceSaveIndicator,
  onError: (err) => {
    console.error(err);
    attendanceNeedsResync = true;
  }
});

// มีรายการรอส่งอยู่ = ปิดหน้าตอนนี้ข้อมูลที่แตะไว้จะหาย ให้เบราว์เซอร์ถามก่อน
window.addEventListener("beforeunload", (e) => {
  if (attendanceSaveQueue.pending > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function commitAttendanceChange(playerId, change) {
  if (!currentSessionId) return;
  const sessionId = currentSessionId;
  const date = dateInput.value;
  const team = myTeam;
  currentAttendanceMap.set(playerId, applyAttendanceChange(currentAttendanceMap.get(playerId), change));
  renderRoster(currentAttendanceMap);
  attendanceSaveQueue.enqueue(`${sessionId}_${playerId}`, () =>
    setDoc(
      doc(db, "attendance", `${playerId}_${sessionId}`),
      { playerId, sessionId, team, date, updatedAt: serverTimestamp(), ...firestoreFieldsForChange(change) },
      { merge: true }
    )
  );
}

function saveScoreCategory(playerId, categoryKey, value) {
  commitAttendanceChange(playerId, { category: categoryKey, value });
}
// ---------- ชนิดวันของหน้าเช็คชื่อ: วันซ้อมปกติ / วันไม่มีซ้อม / Match Day ----------
// วันไม่มีซ้อมใช้ตรรกะเดิมของปุ่ม "วันนี้ไม่มีฝึกซ้อม" (ซ่อนปุ่มเดิมไว้ ให้ตัวเลือกนี้เรียกแทน) Match Day = ฟอร์มใน match-day-ui.js แทนตารางเช็คชื่อ
const DAY_TYPES = [
  ["normal", "วันซ้อมปกติ"],
  ["no_training", "วันไม่มีซ้อม"],
  ["match", "Match Day"]
];
let dayType = "normal";
initMatchDay(matchDayPanel);

function renderDayTypeSegmented() {
  dayTypeSegmented.innerHTML = "";
  const active = DAY_TYPES.find(([key]) => key === dayType)[1];
  dayTypeSegmented.appendChild(
    createSegmentedGroup(
      DAY_TYPES.map(([, label]) => label),
      active,
      (label) => chooseDayType(DAY_TYPES.find(([, l]) => l === label)[0])
    )
  );
}

// แค่ปรับสถานะ/ปุ่มบนจอให้ตรง ไม่ทำงานอื่น (ใช้ตอนระบบเปลี่ยนมุมมองเอง เช่น โหลดวันที่ถูกบันทึกว่าไม่มีซ้อม)
function syncDayTypeUi(type) {
  dayType = type;
  renderDayTypeSegmented();
}

function setMatchDayVisible(on) {
  matchDayPanel.classList.toggle("hidden", !on);
  loadSessionBtn.classList.toggle("hidden", on);
  viewSessionBtn.classList.toggle("hidden", on);
  scoreLegend.classList.toggle("hidden", on); // เกณฑ์ 1-4 เป็นของตารางเช็คชื่อซ้อม ไม่เกี่ยวกับ Match Day
  if (on) {
    rosterWrap.classList.add("hidden");
    noTrainingBanner.classList.add("hidden");
    rosterLockedBanner.classList.add("hidden");
    rosterCompleteBanner.classList.add("hidden");
    setAttendanceStatus("");
  }
}

function resetDayType() {
  setMatchDayVisible(false);
  syncDayTypeUi("normal");
}

function startMatchDay() {
  return openMatchDay({
    team: myTeam,
    date: dateInput.value,
    ageGroups: myAgeGroups,
    initialAgeGroup: pendingMatchDayAgeGroup,
    coachId: auth.currentUser.uid,
    coachName: myCoachName || auth.currentUser.email,
    ensureSession: findOrCreateSession
  });
}

async function chooseDayType(type) {
  if (type === dayType) return;
  const dateStr = dateInput.value;
  if (!dateStr) {
    setAttendanceStatus("กรุณาเลือกวันที่ก่อน", true);
    return;
  }
  if (!myTeam) {
    setAttendanceStatus("ยังไม่ทราบทีมที่รับผิดชอบ", true);
    return;
  }
  if (type === "match") {
    syncDayTypeUi("match");
    setMatchDayVisible(true);
    await startMatchDay();
    return;
  }
  setMatchDayVisible(false);
  syncDayTypeUi(type);
  if (type === "no_training") markNoTrainingBtn.click();
  else if (currentSessionData?.noTraining) undoNoTrainingBtn.click();
  else {
    try {
      await viewSessionForDate(dateStr);
    } catch (err) {
      console.error(err);
      setAttendanceStatus("เรียกดูไม่สำเร็จ: " + err.message, true);
    }
  }
}

// เปลี่ยนวันที่ระหว่างอยู่ใน Match Day = โหลดฟอร์มของวันใหม่ (รุ่นเดิม)
dateInput.addEventListener("change", () => {
  if (dayType === "match" && dateInput.value && myTeam) startMatchDay();
});

function showRosterView() {
  noTrainingBanner.classList.add("hidden");
  rosterWrap.classList.remove("hidden");
  if (dayType === "no_training") syncDayTypeUi("normal");
}

function showNoTrainingView() {
  syncDayTypeUi("no_training");
  noTrainingBanner.classList.remove("hidden");
  rosterLockedBanner.classList.add("hidden");
  rosterCompleteBanner.classList.add("hidden");
  rosterWrap.classList.add("hidden");
}

// ยังไม่เคยเช็คชื่อวันนี้เลย (ไม่มีเอกสาร sessions) และผู้ใช้แค่ "เรียกดู" ไม่ได้กด "โหลด/สร้าง" — ซ่อนทุกกล่องไว้
// ก่อน แล้วให้ attendance-status อธิบายว่ายังไม่มีข้อมูล กันสับสนกับ "วันนี้ไม่มีฝึกซ้อม" ซึ่งเป็นคนละสถานะกัน
function showNoSessionView() {
  noTrainingBanner.classList.add("hidden");
  rosterLockedBanner.classList.add("hidden");
  rosterCompleteBanner.classList.add("hidden");
  rosterWrap.classList.add("hidden");
}

async function renderSession(session, dateStr, { autoFill = false } = {}) {
  currentSessionId = session.id;
  currentSessionData = session.data;

  if (session.data.noTraining) {
    showNoTrainingView();
    setAttendanceStatus(`วันที่ ${dateStr} ถูกบันทึกว่าไม่มีฝึกซ้อม (ทีม ${myTeam})`);
    return;
  }
  showRosterView();
  const existingMap = await loadExistingAttendance(session.id);
  // รายงานบาดเจ็บเป็นข้อมูลเสริม — โหลดไม่ได้ก็ยังเช็คชื่อได้ตามปกติ (แค่ไม่มีการเติม I/R และคำเตือน)
  try {
    activeInjuryMap = activeInjuryByPlayer(await loadTeamInjuries(), dateStr);
  } catch (err) {
    console.error(err);
    activeInjuryMap = new Map();
  }
  injuryFormState = null;
  renderRoster(existingMap);
  setAttendanceStatus(`พร้อมเช็คชื่อวันที่ ${dateStr} (ทีม ${myTeam})`);
  // เติม I/R ให้นักกีฬาที่มีรายงานบาดเจ็บค้างอยู่และยังไม่มีสถานะของวันนั้น — เฉพาะตอนโค้ชกด "โหลด/สร้างวันซ้อมนี้" (ไม่เขียนข้อมูลตอนแค่เรียกดู)
  // และไม่เติมถ้าตารางล็อกแล้ว โค้ชแก้สถานะที่เติมให้ได้เองเหมือนปกติ
  const locked =
    rosterLockState({ complete: isRosterComplete(existingMap), sessionDate: dateStr, today: todayBangkok(), isAdmin: currentIsAdmin }) === "locked";
  if (autoFill && !locked) {
    for (const item of planInjuryAutoFill(players, existingMap, activeInjuryMap)) {
      commitAttendanceChange(item.playerId, { status: item.status, injuryReportId: item.injuryReportId });
    }
  }
}

async function loadSessionForDate(dateStr) {
  setAttendanceStatus("กำลังโหลด...");
  const session = await findOrCreateSession(dateStr);
  await renderSession(session, dateStr, { autoFill: true });
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
    wrap.innerHTML = `<a href="${safeHttpUrl(photo.url)}" target="_blank" rel="noopener"><img src="${safeHttpUrl(photo.url)}" class="w-16 h-16 object-cover rounded border border-slate-200" /></a>`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center";
    removeBtn.innerHTML = icon("close");
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
        `<a href="${safeHttpUrl(photo.url)}" target="_blank" rel="noopener"><img src="${safeHttpUrl(photo.url)}" class="w-16 h-16 object-cover rounded border border-slate-200" /></a>`
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
    reportLoadStatus.innerHTML = `ส่งรายงานสำหรับวันที่ ${escapeHtml(dateStr)} เรียบร้อย ${icon("check")} (ซิงก์กับหน้าเช็คชื่อรายวันอัตโนมัติ)`;
    reportLoadStatus.className = "text-sm text-emerald-600 w-full";
    loadReportHistory(dateStr);
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
const matchLineupSummaryEl = document.getElementById("match-lineup-summary");
const matchLineupGkNoteEl = document.getElementById("match-lineup-gk-note");
const matchGuestSegmentedWrap = document.getElementById("match-guest-segmented");
const matchGuestPanel = document.getElementById("match-guest-panel");
const matchGuestAgeGroupSelect = document.getElementById("match-guest-age-group");
const matchGuestSearchInput = document.getElementById("match-guest-search");
const matchGuestDropdown = document.getElementById("match-guest-dropdown");

function renderMatchResultSegmented() {
  matchResultSegmentedWrap.innerHTML = "";
  matchResultSegmentedWrap.appendChild(
    createSegmentedGroup(MATCH_RESULT_OPTIONS, matchResult, (result) => {
      matchResult = result;
      renderMatchResultSegmented();
    })
  );
}

// ---------- 11 ผู้เล่นตัวจริง (ตรรกะล้วนอยู่ที่ match-lineup.js) ----------
// รายชื่อให้เลือกมาจาก "นักกีฬาทุกรุ่น/ทุกตำแหน่งของทีม" (matchPlayerPool) ไม่ใช่ players ที่ถูกกรองตามตำแหน่ง/รุ่นของโค้ช เพราะ
// Head/Assistant Coach ไม่เห็น GK ใน players เลย แต่ 11 ตัวจริงต้องมีผู้รักษาประตูของรุ่นนั้น และต้องดึงผู้เล่นรุ่นอื่นขึ้นมาเล่นได้
let matchPlayerPool = [];
let matchLineupRecords = new Map(); // id -> ข้อมูลนักกีฬาที่เลือกไว้ (เก็บไว้เองเพราะอาจไม่อยู่ใน pool เช่น ถูกลบออกจากทีมแล้ว)
let matchGuestMode = false; // มีผู้เล่นจากรุ่นอื่นขึ้นมาเล่นไหม

async function loadMatchPlayerPool() {
  try {
    const snap = await getDocs(query(collection(db, "players"), where("team", "==", myTeam)));
    matchPlayerPool = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    matchPlayerPool = [];
  }
}

// โหลด pool ไม่ได้ก็ยังใช้ฟอร์มได้ (ถอยไปใช้ players เหมือนเดิม — ไม่มี GK/รุ่นอื่นให้เลือกเท่านั้น)
const lineupPool = () => (matchPlayerPool.length > 0 ? matchPlayerPool : players);

function matchSelectedPlayers() {
  return [...matchLineupSelectedIds].map((id) => matchLineupRecords.get(id)).filter(Boolean);
}

function playerLabel(p) {
  return p.nickname ?? p.fullName ?? "-";
}

function updateMatchLineupCount() {
  const sum = summarizeLineup(matchSelectedPlayers(), matchAgeGroupSelect.value);
  matchLineupCountEl.textContent = `(${matchLineupSelectedIds.size}/${MAX_LINEUP_SIZE} คน)`;
  if (sum.guestCount > 0) {
    matchLineupSummaryEl.textContent = `ผู้เล่นจากรุ่นอื่นขึ้นมาเล่น ${sum.guestCount} คน (${sum.guestsByGroup.map((g) => `${g.ageGroup}: ${g.count} คน`).join(" · ")})`;
  } else {
    matchLineupSummaryEl.textContent = matchGuestMode ? "ยังไม่ได้เลือกผู้เล่นจากรุ่นอื่น" : "";
  }
  if (sum.total === 0) {
    matchLineupGkNoteEl.textContent = "";
  } else if (sum.hasGoalkeeper) {
    matchLineupGkNoteEl.textContent = `ผู้รักษาประตู: ${sum.goalkeepers.join(", ")}`;
    matchLineupGkNoteEl.className = "text-sm text-emerald-700 mt-1";
  } else {
    matchLineupGkNoteEl.textContent = "ยังไม่มีผู้รักษาประตูใน 11 ตัวจริง";
    matchLineupGkNoteEl.className = "text-sm text-amber-700 mt-1";
  }
}

function renderMatchLineupChips() {
  matchLineupChips.innerHTML = "";
  const matchGroup = matchAgeGroupSelect.value;
  for (const p of matchSelectedPlayers()) {
    const guest = p.ageGroup && p.ageGroup !== matchGroup;
    const chip = document.createElement("span");
    chip.className =
      "inline-flex items-center gap-2 text-sm font-medium rounded-full pl-3 pr-2 py-1 " +
      (guest ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700");
    chip.textContent = `${playerLabel(p)}${isGoalkeeper(p) ? " (GK)" : ""}${guest ? ` · ${p.ageGroup}` : ""}`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.innerHTML = icon("close");
    removeBtn.className = "text-slate-400 hover:text-red-600 leading-none";
    removeBtn.addEventListener("click", () => {
      matchLineupSelectedIds.delete(p.id);
      renderMatchLineupChips();
      renderLineupDropdowns();
    });
    chip.appendChild(removeBtn);
    matchLineupChips.appendChild(chip);
  }
  updateMatchLineupCount();
}

function addPlayerToLineup(p) {
  if (matchLineupSelectedIds.size >= MAX_LINEUP_SIZE) return;
  matchLineupSelectedIds.add(p.id);
  matchLineupRecords.set(p.id, p);
  matchLineupSearchInput.value = "";
  matchGuestSearchInput.value = "";
  renderMatchLineupChips();
  renderLineupDropdowns();
}

// dropdown ค้นหาผู้เล่น (ใช้ร่วมกันทั้งช่องรุ่นที่แข่งและช่องผู้เล่นจากรุ่นอื่น) — candidates = รายชื่อที่ยังเลือกได้ก่อนกรองด้วยคำค้น
function renderLineupDropdown(dropdownEl, searchText, candidates, emptyText) {
  if (matchLineupSelectedIds.size >= MAX_LINEUP_SIZE) {
    dropdownEl.innerHTML = '<p class="text-sm text-slate-400 px-3 py-2">เลือกครบ 11 คนแล้ว</p>';
    dropdownEl.classList.remove("hidden");
    return;
  }
  const keyword = searchText.trim().toLowerCase();
  const available = candidates.filter((p) => !matchLineupSelectedIds.has(p.id));
  const shown = available.filter(
    (p) => !keyword || playerLabel(p).toLowerCase().includes(keyword) || (p.fullName ?? "").toLowerCase().includes(keyword)
  );
  if (shown.length === 0) {
    dropdownEl.innerHTML = `<p class="text-sm text-slate-400 px-3 py-2">${candidates.length === 0 ? emptyText : "ไม่พบนักกีฬาที่ค้นหา"}</p>`;
    dropdownEl.classList.remove("hidden");
    return;
  }
  dropdownEl.innerHTML = "";
  for (const p of shown) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = `${playerLabel(p)}${p.fullName ? ` (${p.fullName})` : ""}${isGoalkeeper(p) ? " · GK" : ""}`;
    item.className = "block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
    // ใช้ mousedown แทน click เพื่อให้ทำงานก่อน blur ของช่องค้นหา ไม่งั้น dropdown จะถูกซ่อนก่อนคลิกติด
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      addPlayerToLineup(p);
    });
    dropdownEl.appendChild(item);
  }
  dropdownEl.classList.remove("hidden");
}

function renderMatchLineupDropdown(searchText) {
  const ageGroup = matchAgeGroupSelect.value;
  if (!ageGroup) {
    matchLineupDropdown.innerHTML = '<p class="text-sm text-slate-400 px-3 py-2">กรุณาเลือกรุ่นอายุที่แข่งขันก่อน</p>';
    matchLineupDropdown.classList.remove("hidden");
    return;
  }
  renderLineupDropdown(matchLineupDropdown, searchText, ownGroupCandidates(lineupPool(), ageGroup), "ไม่มีนักกีฬารุ่นอายุนี้ในทีม");
}

function renderMatchGuestDropdown(searchText) {
  const source = matchGuestAgeGroupSelect.value;
  if (!source) {
    matchGuestDropdown.innerHTML = '<p class="text-sm text-slate-400 px-3 py-2">เลือกรุ่นอายุที่ดึงขึ้นมาก่อน</p>';
    matchGuestDropdown.classList.remove("hidden");
    return;
  }
  renderLineupDropdown(matchGuestDropdown, searchText, guestCandidates(lineupPool(), source), "ไม่มีนักกีฬารุ่นนี้ในทีม");
}

function renderLineupDropdowns() {
  if (!matchLineupDropdown.classList.contains("hidden")) renderMatchLineupDropdown(matchLineupSearchInput.value);
  if (!matchGuestDropdown.classList.contains("hidden")) renderMatchGuestDropdown(matchGuestSearchInput.value);
}

// ปุ่ม "มีผู้เล่นจากรุ่นอื่นขึ้นมาเล่นไหม? ไม่มี/มี" + ช่องเลือกรุ่น/ค้นหาผู้เล่น (แสดงเฉพาะเมื่อเลือก "มี")
function renderMatchGuestControls() {
  matchGuestSegmentedWrap.innerHTML = "";
  matchGuestSegmentedWrap.appendChild(
    createSegmentedGroup(["ไม่มี", "มี"], matchGuestMode ? "มี" : "ไม่มี", (choice) => {
      if (choice === "มี") {
        if (!matchAgeGroupSelect.value) {
          matchReportStatus.textContent = "กรุณาเลือกรุ่นอายุที่แข่งขันก่อน";
          matchReportStatus.className = "text-sm text-red-600";
          return;
        }
        matchGuestMode = true;
      } else {
        const matchGroup = matchAgeGroupSelect.value;
        const guests = matchSelectedPlayers().filter((p) => p.ageGroup && p.ageGroup !== matchGroup);
        if (guests.length > 0 && !confirm(`เอาผู้เล่นจากรุ่นอื่น ${guests.length} คนออกจากตัวจริง?`)) return;
        guests.forEach((p) => matchLineupSelectedIds.delete(p.id));
        matchGuestMode = false;
      }
      renderMatchGuestControls();
      renderMatchLineupChips();
    })
  );
  matchGuestPanel.classList.toggle("hidden", !matchGuestMode);
  const keep = matchGuestAgeGroupSelect.value;
  const options = guestAgeGroupOptions(lineupPool(), matchAgeGroupSelect.value);
  matchGuestAgeGroupSelect.innerHTML =
    '<option value="">-- เลือกรุ่นอายุ --</option>' +
    options.map((o) => `<option value="${escapeHtml(o.ageGroup)}">${escapeHtml(o.ageGroup)} (${o.count} คน)</option>`).join("");
  if (options.some((o) => o.ageGroup === keep)) matchGuestAgeGroupSelect.value = keep;
  matchGuestSearchInput.disabled = options.length === 0;
  matchGuestSearchInput.placeholder = options.length === 0 ? "ไม่มีนักกีฬารุ่นอื่นในทีม" : "พิมพ์ชื่อเพื่อค้นหาและเลือกผู้เล่นจากรุ่นนั้น...";
}

function resetMatchLineup() {
  matchLineupSelectedIds = new Set();
  matchLineupRecords = new Map();
  matchGuestMode = false;
  matchLineupSearchInput.value = "";
  matchGuestSearchInput.value = "";
  matchLineupDropdown.classList.add("hidden");
  matchGuestDropdown.classList.add("hidden");
  renderMatchGuestControls();
  renderMatchLineupChips();
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
matchGuestSearchInput.addEventListener("input", () => {
  renderMatchGuestDropdown(matchGuestSearchInput.value);
});
matchGuestSearchInput.addEventListener("focus", () => {
  renderMatchGuestDropdown(matchGuestSearchInput.value);
});
matchGuestSearchInput.addEventListener("blur", () => {
  matchGuestDropdown.classList.add("hidden");
});
matchGuestAgeGroupSelect.addEventListener("change", () => {
  matchGuestSearchInput.value = "";
  matchGuestDropdown.classList.add("hidden");
});
matchAgeGroupSelect.addEventListener("change", () => {
  // เปลี่ยนรุ่นอายุแล้ว รายชื่อผู้เล่นตัวจริงที่เคยเลือกไว้อาจไม่ใช่รุ่นเดียวกันอีกต่อไป จึงล้างค่าเดิม (รวมผู้เล่นที่ดึงมาจากรุ่นอื่น)
  resetMatchLineup();
});
renderMatchGuestControls();
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
      <td class="emphasis">${escapeHtml(m.date ?? "-")}</td>
      <td>${escapeHtml(m.opponent ?? "-")}</td>
      <td>${escapeHtml(m.competitionType ?? "-")}</td>
      <td>${escapeHtml(m.ageGroup ?? "-")}</td>
      <td>${matchResultBadge(m.result)}</td>
      <td class="emphasis">${m.scoreUs} - ${m.scoreThem}</td>
      <td>${escapeHtml(m.competition ?? "-")}</td>
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
  matchLineupRecords = new Map(lineupFromReport(m, lineupPool()).map((p) => [p.id, p]));
  matchLineupSelectedIds = new Set(matchLineupRecords.keys());
  matchGuestMode = matchSelectedPlayers().some((p) => p.ageGroup && p.ageGroup !== m.ageGroup);
  renderMatchGuestControls();
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
  resetMatchLineup();
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

  const lineupPlayers = matchSelectedPlayers();
  // 11 ตัวจริงควรมีผู้รักษาประตู — ไม่บังคับ (กรณีไม่มี GK ในทีมจริงๆ) แต่ถามยืนยันก่อนบันทึกเพื่อกันลืม
  if (lineupPlayers.length > 0 && !lineupPlayers.some(isGoalkeeper)) {
    if (!confirm("ใน 11 ตัวจริงยังไม่มีผู้รักษาประตู — ยืนยันบันทึกโดยไม่มี GK?")) return;
  }
  const lineupFields = buildLineupFields(lineupPlayers, ageGroup);

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
    ...lineupFields,
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
      matchReportStatus.innerHTML = `บันทึกการแก้ไขสำเร็จ ${icon("check")}`;
      matchReportStatus.className = "text-sm text-emerald-600";
      stopEditMatch();
    } else {
      await addDoc(collection(db, "matchReports"), { ...payload, createdAt: serverTimestamp() });
      matchReportForm.reset();
      matchResult = null;
      renderMatchResultSegmented();
      resetMatchLineup();
      matchReportStatus.innerHTML = `บันทึกผลการแข่งขันสำเร็จ ${icon("check")}`;
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

// ---------- รายงานบาดเจ็บแบบละเอียด: ตำแหน่ง/ข้าง/ประเภท/กลไก/เกิดที่ไหน/บาดเจ็บซ้ำ/วันกลับมาซ้อมจริง/ความคืบหน้า (ตรรกะล้วนอยู่ที่ injury-form.js) ----------
// ทุกช่องใหม่เว้นว่างได้ — โค้ชที่รีบกรอกแค่อาการ+ความรุนแรงเหมือนเดิม และรายงานเก่าที่ไม่มีช่องเหล่านี้ยังเปิดแก้ไขได้ตามปกติ
let injuryReportsCache = []; // รายงานของทีม (โหลดตอนเปิดหน้ารายการ) ใช้ตรวจบาดเจ็บซ้ำและแสดงความคืบหน้า
let injuryRegion = null;
let injurySide = null;
let injuryMechanism = null;
let injuryContext = null;
let injuryRecurrenceTouched = false; // โค้ชติ๊ก/เอาติ๊ก "บาดเจ็บซ้ำ" เองแล้ว — ระบบไม่เปลี่ยนให้อีก
const injuryDateInput = document.getElementById("injury-date");
const injuryStatusSelect = document.getElementById("injury-status");
const injuryTypeSelect = document.getElementById("injury-type");
const injuryRegionChipsEl = document.getElementById("injury-region-chips");
const injurySideWrap = document.getElementById("injury-side-segmented");
const injuryMechanismWrap = document.getElementById("injury-mechanism-segmented");
const injuryContextWrap = document.getElementById("injury-context-segmented");
const injuryRecurrenceHint = document.getElementById("injury-recurrence-hint");
const injuryRecurrenceCheckbox = document.getElementById("injury-recurrence");
const injuryActualReturnWrap = document.getElementById("injury-actual-return-wrap");
const injuryActualReturnInput = document.getElementById("injury-actual-return");
const injuryDaysOutEl = document.getElementById("injury-days-out");
const injuryProgressSection = document.getElementById("injury-progress-section");
const injuryProgressList = document.getElementById("injury-progress-list");
const injuryProgressInput = document.getElementById("injury-progress-input");
const injuryProgressAddBtn = document.getElementById("injury-progress-add-btn");
const injuryProgressStatus = document.getElementById("injury-progress-status");

// กดตัวเลือกเดิมซ้ำ = ล้างค่า (ช่องเหล่านี้เว้นว่างได้)
function injuryChoiceGroup(wrap, options, active, onChange) {
  wrap.innerHTML = "";
  wrap.appendChild(createSegmentedGroup(options, active, (v) => onChange(active === v ? null : v)));
}

function renderInjuryChoiceControls() {
  injuryRegionChipsEl.innerHTML = "";
  injuryRegionChipsEl.appendChild(
    createChipToggleGroup(BODY_REGIONS, new Set(injuryRegion ? [injuryRegion] : []), (r) => {
      injuryRegion = injuryRegion === r ? null : r;
      renderInjuryChoiceControls();
      refreshInjuryRecurrence();
    })
  );
  injuryChoiceGroup(injurySideWrap, SIDES, injurySide, (v) => {
    injurySide = v;
    renderInjuryChoiceControls();
    refreshInjuryRecurrence();
  });
  injuryChoiceGroup(injuryMechanismWrap, MECHANISMS, injuryMechanism, (v) => {
    injuryMechanism = v;
    renderInjuryChoiceControls();
  });
  injuryChoiceGroup(injuryContextWrap, CONTEXTS, injuryContext, (v) => {
    injuryContext = v;
    renderInjuryChoiceControls();
  });
}

// เจอรายงานเก่าของนักกีฬาคนเดียวกัน ตำแหน่งและข้างเดียวกัน → ขึ้นข้อความและติ๊ก "บาดเจ็บซ้ำ" ให้ (ถ้าโค้ชยังไม่แตะเอง)
function refreshInjuryRecurrence() {
  const found = detectRecurrence(injuryReportsCache, {
    playerId: injurySelectedPlayerId,
    bodyRegion: injuryRegion,
    side: injurySide,
    date: injuryDateInput.value,
    excludeId: editingInjuryId
  });
  if (found) {
    const where = `${injuryRegion}${injurySide && injurySide !== "ไม่เกี่ยวข้อง" ? ` (${injurySide})` : ""}`;
    injuryRecurrenceHint.textContent = `เคยมีรายงานบาดเจ็บ ${where} ของนักกีฬาคนนี้เมื่อ ${found.date}${found.status === "หายแล้ว" ? " (หายแล้ว)" : ""} · ระบบทำเครื่องหมาย "บาดเจ็บซ้ำ" ให้ แก้ได้ถ้าไม่ใช่`;
    injuryRecurrenceHint.classList.remove("hidden");
  } else {
    injuryRecurrenceHint.classList.add("hidden");
  }
  if (!injuryRecurrenceTouched) injuryRecurrenceCheckbox.checked = !!found;
}
injuryRecurrenceCheckbox.addEventListener("change", () => {
  injuryRecurrenceTouched = true;
});

function updateInjuryDaysOut() {
  if (injuryStatusSelect.value === "หายแล้ว") {
    const n = diffDays(injuryDateInput.value, injuryActualReturnInput.value);
    injuryDaysOutEl.textContent = n === null ? "ใส่วันที่กลับมาซ้อมจริง ระบบจะนับจำนวนวันที่หยุดให้" : `หยุดไป ${n} วัน (นับจากวันบาดเจ็บถึงวันกลับมาซ้อมจริง ระบบคำนวณให้เอง)`;
  } else {
    injuryDaysOutEl.textContent = "ยังไม่หาย · พอกลับมาซ้อมแล้วเลือก \"หายแล้ว\" ระบบจะถามวันที่กลับมาซ้อมจริงและนับจำนวนวันที่หยุดให้";
  }
}

// prefill = เปลี่ยนสถานะเป็น "หายแล้ว" ด้วยมือ → ใส่วันนี้เป็นวันกลับมาซ้อมจริงให้ก่อน (ตอนเปิดแก้ไขรายงานเก่าไม่เติมให้ กันบันทึกวันผิดโดยไม่รู้ตัว)
function updateInjuryStatusFields(prefill = false) {
  const healed = injuryStatusSelect.value === "หายแล้ว";
  injuryActualReturnWrap.classList.toggle("hidden", !healed);
  if (healed && prefill && !injuryActualReturnInput.value) injuryActualReturnInput.value = todayBangkok();
  updateInjuryDaysOut();
}
injuryStatusSelect.addEventListener("change", () => updateInjuryStatusFields(true));
injuryActualReturnInput.addEventListener("change", updateInjuryDaysOut);
injuryDateInput.addEventListener("change", () => {
  refreshInjuryRecurrence();
  updateInjuryDaysOut();
});

function resetInjuryFormExtras() {
  injuryRegion = null;
  injurySide = null;
  injuryMechanism = null;
  injuryContext = null;
  injuryRecurrenceTouched = false;
  injuryTypeSelect.value = "";
  injuryRecurrenceCheckbox.checked = false;
  injuryRecurrenceHint.classList.add("hidden");
  injuryActualReturnInput.value = "";
  renderInjuryChoiceControls();
  updateInjuryStatusFields();
  renderInjuryProgress();
}

function loadInjuryFormExtras(inj) {
  injuryRegion = inj.bodyRegion ?? null;
  injurySide = inj.side ?? null;
  injuryMechanism = inj.mechanism ?? null;
  injuryContext = contextFor(inj);
  injuryTypeSelect.value = inj.injuryType ?? "";
  injuryRecurrenceCheckbox.checked = !!inj.isRecurrence;
  injuryRecurrenceTouched = true;
  injuryActualReturnInput.value = inj.actualReturnDate ?? "";
  renderInjuryChoiceControls();
  refreshInjuryRecurrence();
  updateInjuryStatusFields();
  renderInjuryProgress();
}

// ความคืบหน้าการรักษา (แสดงเฉพาะตอนเปิดแก้ไขรายงานที่บันทึกแล้ว)
function renderInjuryProgress() {
  const record = editingInjuryId ? injuryReportsCache.find((r) => r.id === editingInjuryId) : null;
  injuryProgressSection.classList.toggle("hidden", !record);
  injuryProgressStatus.textContent = "";
  if (!record) return;
  const notes = record.progressNotes || [];
  injuryProgressList.innerHTML =
    notes.length === 0
      ? '<p class="text-sm text-slate-400">ยังไม่มีบันทึกความคืบหน้า</p>'
      : notes
          .map(
            (n) =>
              `<p class="text-sm text-slate-700"><span class="font-semibold">${escapeHtml(n.date ?? "")}</span> · ${escapeHtml(n.note ?? "")} <span class="text-slate-400">— ${escapeHtml(n.by ?? "")}</span></p>`
          )
          .join("");
}

injuryProgressInput.addEventListener("input", () => {
  injuryProgressStatus.textContent = "";
});
injuryProgressAddBtn.addEventListener("click", async () => {
  const record = editingInjuryId ? injuryReportsCache.find((r) => r.id === editingInjuryId) : null;
  if (!record) return;
  const note = injuryProgressInput.value.trim();
  if (!note) {
    injuryProgressStatus.textContent = "พิมพ์ความคืบหน้าสั้นๆ ก่อนเพิ่ม";
    return;
  }
  injuryProgressAddBtn.disabled = true;
  try {
    const progressNotes = [
      ...(record.progressNotes || []),
      { date: todayBangkok(), note, by: myCoachName || auth.currentUser.email }
    ];
    await updateDoc(doc(db, "injuryReports", record.id), { progressNotes, updatedAt: serverTimestamp() });
    record.progressNotes = progressNotes;
    injuryProgressInput.value = "";
    renderInjuryProgress();
    await renderInjuryReportList();
  } catch (err) {
    console.error(err);
    injuryProgressStatus.textContent = "บันทึกไม่สำเร็จ: " + err.message;
  } finally {
    injuryProgressAddBtn.disabled = false;
  }
});
renderInjuryChoiceControls();
updateInjuryStatusFields();
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
  refreshInjuryRecurrence();
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
  refreshInjuryRecurrence();
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
  refreshInjuryRecurrence();
});

// โหลดรายงานบาดเจ็บของทีมเข้า cache (ใช้ตรวจบาดเจ็บซ้ำและบันทึกความคืบหน้า) — หน้า Recording ไม่แสดงรายชื่อแล้ว ดู/แก้ไข/ลบรายการที่ Results
async function renderInjuryReportList() {
  const snap = await getDocs(query(collection(db, "injuryReports"), where("team", "==", myTeam)));
  const reports = [];
  snap.forEach((d) => reports.push({ id: d.id, ...d.data() }));
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  injuryReportsCache = reports;
}
function startEditInjury(inj) {
  editingInjuryId = inj.id;
  injuryAgeGroupSelect.value = inj.ageGroup ?? "";
  injurySelectedPlayerId = inj.playerId ?? null;
  injuryPlayerSearchInput.value = inj.playerName ?? "";
  document.getElementById("injury-date").value = inj.date ?? "";
  document.getElementById("injury-description").value = inj.description ?? "";
  document.getElementById("injury-severity").value = inj.severity ?? "เล็กน้อย";
  document.getElementById("injury-status").value = formStatusFor(inj.status);
  document.getElementById("injury-expected-return").value = inj.expectedReturn ?? "";
  loadInjuryFormExtras(inj);
  document.getElementById("injury-notes").value = inj.notes ?? "";
  injuryReportSubmitBtn.textContent = "บันทึกการแก้ไข";
  cancelEditInjuryBtn.classList.remove("hidden");
  injuryReportStatus.textContent = `กำลังแก้ไขรายการบาดเจ็บของ "${inj.playerName}"`;
  injuryReportStatus.className = "text-sm text-slate-500";
  injuryReportForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Results → "แก้ไข": เปิด Recording ในโหมดแก้ไขรายการนั้น
initResults({
  team: () => myTeam,
  ageGroups: () => myAgeGroups,
  edit: (report) => {
    openInjuryReportSection();
    startEditInjury(report);
  },
  remove: async (report) => {
    await deleteInjuryReport(report);
    await showResults();
  }
});

function stopEditInjury() {
  editingInjuryId = null;
  injuryReportForm.reset();
  resetInjuryFormExtras();
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
  const formStatus = document.getElementById("injury-status").value;
  const status = storedStatusFor(formStatus, injuryContext);
  const actualReturn = document.getElementById("injury-actual-return").value;
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
    bodyRegion: injuryRegion,
    side: injurySide,
    injuryType: injuryTypeSelect.value || null,
    mechanism: injuryMechanism,
    context: injuryContext,
    isRecurrence: injuryRecurrenceCheckbox.checked,
    actualReturnDate: formStatus === "หายแล้ว" && actualReturn ? actualReturn : null,
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
      injuryReportStatus.innerHTML = `บันทึกการแก้ไขสำเร็จ ${icon("check")}`;
      injuryReportStatus.className = "text-sm text-emerald-600";
      stopEditInjury();
    } else {
      await addDoc(collection(db, "injuryReports"), { ...payload, progressNotes: [], createdAt: serverTimestamp() });
      injuryReportForm.reset();
      resetInjuryFormExtras();
      injurySelectedPlayerId = null;
      injuryPlayerDropdown.classList.add("hidden");
      injuryReportStatus.innerHTML = `บันทึกอาการบาดเจ็บสำเร็จ ${icon("check")}`;
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
// ต้องแนบไฟล์ทุกครั้งที่ส่งแผน — ปุ่มส่งจะกดไม่ได้จนกว่าจะมีไฟล์ (เลือกไฟล์ใหม่ หรือมีไฟล์เดิมที่ยังไม่ถูกลบ) ทุกจุดที่ไฟล์แนบ
// เปลี่ยน (เลือกไฟล์ / ลบไฟล์เดิม / เริ่มหรือยกเลิกการแก้ไข) เรียก renderTrainingPlanFileStatus ซึ่งเรียกฟังก์ชันนี้ต่อเสมอ
let trainingPlanSubmitting = false;
function trainingPlanCanSubmit() {
  return trainingPlanHasAttachment({
    hasNewFile: Boolean(trainingPlanFileInput.files[0]),
    existingFileUrl: trainingPlanExistingFileUrl,
    removeExisting: trainingPlanRemoveExistingFile
  });
}
function updateTrainingPlanSubmitState() {
  const hasFile = trainingPlanCanSubmit();
  trainingPlanSubmitBtn.disabled = trainingPlanSubmitting || !hasFile;
  trainingPlanSubmitBtn.title = hasFile ? "" : "ต้องแนบไฟล์แผนการฝึก (รูป/PDF) ก่อนจึงจะส่งได้";
  trainingPlanFileStatus.classList.toggle("text-red-600", !hasFile);
  trainingPlanFileStatus.classList.toggle("text-slate-500", hasFile);
}

function renderTrainingPlanFileStatus() {
  renderTrainingPlanFileStatusText();
  updateTrainingPlanSubmitState();
}

function renderTrainingPlanFileStatusText() {
  trainingPlanFileStatus.innerHTML = "";
  if (trainingPlanFileInput.files[0]) {
    trainingPlanFileStatus.textContent = `เลือกไฟล์ใหม่: ${trainingPlanFileInput.files[0].name}`;
    return;
  }
  if (trainingPlanExistingFileUrl && !trainingPlanRemoveExistingFile) {
    trainingPlanFileStatus.innerHTML = `${icon("paperclip")} ไฟล์ที่แนบไว้: <a href="${trainingPlanExistingFileUrl}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">${trainingPlanExistingFileName ?? "เปิดไฟล์"}</a> `;
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
  trainingPlanFileStatus.textContent = trainingPlanExistingFileUrl
    ? "ลบไฟล์เดิมแล้ว — ต้องแนบไฟล์ใหม่ก่อนจึงจะบันทึกได้"
    : "ยังไม่ได้แนบไฟล์ — ต้องแนบไฟล์แผนการฝึก (รูป/PDF) ก่อนจึงจะส่งแผนได้";
}

trainingPlanFileInput.addEventListener("change", () => {
  trainingPlanRemoveExistingFile = false;
  renderTrainingPlanFileStatus();
});
renderTrainingPlanFileStatus(); // ตั้งสถานะปุ่มส่ง (ปิดไว้จนกว่าจะแนบไฟล์) ตั้งแต่โหลดหน้า

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
    planDataStatus.textContent = "ลบแผนการฝึกซ้อมแล้ว";
    planDataStatus.className = "text-sm text-slate-500";
  } catch (err) {
    console.error(err);
    trainingPlanStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    trainingPlanStatus.className = "text-sm text-red-600";
    planDataStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
    planDataStatus.className = "text-sm text-red-600";
  }
}

// สถานะการส่ง เทียบวันที่บันทึกล่าสุดกับวันที่ของแผน (แบบเดียวกับสูตรใน Airtable) — ส่งภายในหรือก่อนวันที่
// ของแผนถือว่า "ตรงเวลา" ถ้าส่ง/แก้ไขหลังวันที่ของแผนไปแล้วถือว่า "เลท"
function trainingPlanSubmissionStatus(plan) {
  if (!plan.updatedAt || !plan.date) return "-";
  return isTrainingPlanLate(plan)
    ? `<span class="badge badge-warning">${icon("clock")} เลท</span>`
    : `<span class="badge badge-success">${icon("check-circle")} ตรงเวลา</span>`;
}

// นับจำนวนครั้งที่ส่งสายในเดือนปัจจุบัน (ตามวันที่ในแผน ไม่ใช่วันที่ส่งจริง) ใช้เตือนโค้ชเมื่อเกินเกณฑ์
function countLateTrainingPlansThisMonth(plans) {
  const thisMonth = thisMonthBangkok(); // "YYYY-MM"
  return plans.filter((p) => (p.date || "").startsWith(thisMonth) && isTrainingPlanLate(p)).length;
}

// โหลดแผนของทีม (กรองตามรุ่นที่ดูแล) เก็บไว้ใน trainingPlansCache แล้ววาดตารางที่หน้า Training Plan Data + อัปเดตแจ้งเตือนส่งสาย
let trainingPlansCache = [];

async function renderTrainingPlanList() {
  planDataStatus.textContent = "กำลังโหลด...";
  planDataStatus.className = "text-sm text-slate-500";
  let allPlans = [];
  try {
    const snap = await getDocs(query(collection(db, "trainingPlans"), where("team", "==", myTeam)));
    snap.forEach((d) => allPlans.push({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    planDataStatus.textContent = "โหลดแผนไม่สำเร็จ: " + err.message;
    planDataStatus.className = "text-sm text-red-600";
    return;
  }

  // แสดงเฉพาะแผนของรุ่นอายุที่ตัวเองรับผิดชอบ (ถ้ารู้ตัวโค้ชแน่ชัด — myAgeGroups ไม่ว่าง เช่นโค้ชจริงล็อกอินเอง
  // หรือผู้ดูแลระบบสวมบทบาทเป็นโค้ชคนใดคนหนึ่งเจาะจง) ไม่ปนกับแผนของโค้ชรุ่นอื่นในทีมเดียวกัน — trainingPlans
  // เก็บ ageGroups เป็น array (เลือกได้หลายรุ่นต่อแผน) จึงเช็คว่ามีรุ่นใดรุ่นหนึ่งตรงกับที่ดูแลหรือไม่ แทนที่จะ
  // เทียบค่าเดียวตรงๆ แบบ filterByMyAgeGroups — โหมด "จัดการทีมนี้" แบบกว้าง (myAgeGroups ว่าง) ยังเห็นทุกแผนเหมือนเดิม
  const plans = myAgeGroups.length > 0
    ? allPlans.filter((p) => (p.ageGroups || []).some((ag) => myAgeGroups.includes(ag)))
    : allPlans;
  plans.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  trainingPlansCache = plans;

  const lateCountThisMonth = countLateTrainingPlansThisMonth(plans);
  trainingPlanLateWarning.classList.toggle("hidden", lateCountThisMonth <= TRAINING_PLAN_LATE_WARNING_THRESHOLD);
  trainingPlanLateCountEl.textContent = lateCountThisMonth;

  planDataStatus.textContent = "";
  renderPlanData();
}

// ตาราง Training Plan Data: กรองตามเดือน/รุ่นอายุที่เลือก (ข้อมูลอยู่ใน trainingPlansCache ไม่ต้องโหลดใหม่)
function renderPlanData() {
  const thisMonth = thisMonthBangkok();
  const months = monthOptionsOf(trainingPlansCache, thisMonth);
  const month = months.includes(planDataMonthSelect.value) ? planDataMonthSelect.value : thisMonth;
  planDataMonthSelect.innerHTML = months.map((m) => `<option value="${m}">${escapeHtml(thaiMonthLabel(m))}</option>`).join("");
  planDataMonthSelect.value = month;

  const ages = planAgeGroupsOf(trainingPlansCache);
  const ageGroup = ages.includes(planDataAgeSelect.value) ? planDataAgeSelect.value : "";
  planDataAgeSelect.innerHTML = '<option value="">ทุกรุ่น</option>' + ages.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
  planDataAgeSelect.value = ageGroup;

  const groups = groupByMonth(filterPlans(trainingPlansCache, { month, ageGroup }));
  planDataBody.innerHTML = planDataHtml(groups, { statusHtml: trainingPlanSubmissionStatus });
  applyDataLabels(planDataBody.querySelector("tbody"));
}

planDataMonthSelect.addEventListener("change", renderPlanData);
planDataAgeSelect.addEventListener("change", renderPlanData);
planDataBody.addEventListener("click", (e) => {
  const edit = e.target.closest("[data-plan-edit]");
  const del = e.target.closest("[data-plan-delete]");
  if (edit) {
    const plan = trainingPlansCache.find((p) => p.id === edit.dataset.planEdit);
    if (!plan) return;
    openTrainingPlanSection(); // ไปหน้า Upload ในโหมดแก้ไข (ฟอร์มเดิม)
    startEditTrainingPlan(plan);
  } else if (del) {
    const plan = trainingPlansCache.find((p) => p.id === del.dataset.planDelete);
    if (plan) deleteTrainingPlan(plan);
  }
});

function openTrainingPlanLanding() {
  hideAllScreens();
  trainingPlanMenuSection.classList.remove("hidden");
}

function openPlanData() {
  hideAllScreens();
  planDataSection.classList.remove("hidden");
  planDataMonthSelect.value = "";
  planDataAgeSelect.value = "";
  renderTrainingPlanList();
}

// เมนูที่ยังไม่เปิดใช้งานกดไม่ได้ (แสดงเป็น "เร็วๆ นี้" ที่ป้ายอยู่แล้ว)
for (const btn of document.querySelectorAll("[data-plan-nav]")) btn.addEventListener("click", () => COACH_SCREEN_OPENERS[btn.dataset.planNav]?.());
for (const btn of document.querySelectorAll("[data-training-plan-back]")) btn.addEventListener("click", openTrainingPlanLanding);

// ---------- ประวัติรายงานการฝึกซ้อม (Training Report ใต้ฟอร์ม + Training Report Data) ----------
// รายงานของโค้ชคนนี้ในช่วงเดือนที่ระบุ (เดือนแรก→เดือนสุดท้าย) — ใช้ฟิลเตอร์ฝั่งโค้ชเหมือนหน้ารายงานเดิม (filterByMyCoachName)
async function fetchMyReportsInMonths(months) {
  const sorted = [...months].sort();
  const snap = await getDocs(teamDateRangeQuery("trainingReports", myTeam, `${sorted[0]}-01`, `${sorted[sorted.length - 1]}-31`));
  const all = [];
  snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
  return filterReportsByMonths(filterByMyCoachName(all), months);
}

// highlightDate = วันที่ของรายงานที่เพิ่งส่ง (ไฮไลต์แถวนั้น)
async function loadReportHistory(highlightDate = null) {
  if (!myTeam) return;
  const thisMonth = thisMonthBangkok();
  reportHistoryBody.innerHTML = '<p class="text-sm text-slate-500">กำลังโหลด...</p>';
  try {
    const reports = await fetchMyReportsInMonths([addMonthsToMonth(thisMonth, -1), thisMonth]);
    reportHistoryBody.innerHTML = reportHistoryHtml(groupByMonth(reports), { highlightDate });
    applyDataLabels(reportHistoryBody.querySelector("tbody"));
  } catch (err) {
    console.error(err);
    reportHistoryBody.innerHTML = `<p class="text-sm text-red-600">โหลดประวัติรายงานไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

async function renderReportData() {
  const month = reportDataMonthSelect.value || thisMonthBangkok();
  reportDataStatus.textContent = "กำลังโหลด...";
  reportDataStatus.className = "text-sm text-slate-500";
  try {
    const reports = await fetchMyReportsInMonths([month]);
    reportDataBody.innerHTML = reportHistoryHtml(groupByMonth(reports), { mode: "full" });
    applyDataLabels(reportDataBody.querySelector("tbody"));
    reportDataStatus.textContent = "";
  } catch (err) {
    console.error(err);
    reportDataStatus.textContent = "โหลดไม่สำเร็จ: " + err.message;
    reportDataStatus.className = "text-sm text-red-600";
  }
}

function openReportData() {
  hideAllScreens();
  reportDataSection.classList.remove("hidden");
  const thisMonth = thisMonthBangkok();
  reportDataMonthSelect.innerHTML = monthsBack(thisMonth, 12).map((m) => `<option value="${m}">${escapeHtml(thaiMonthLabel(m))}</option>`).join("");
  reportDataMonthSelect.value = thisMonth;
  renderReportData();
}
reportDataMonthSelect.addEventListener("change", renderReportData);

// กด "เปิด / แก้ไข" ที่แถวรายงาน → ไปหน้า Training Report ของวันนั้นแล้วโหลดรายงาน
function openReportOfDate(date) {
  openReportSection();
  reportDateInput.value = date;
  reportLoadBtn.click();
}
for (const body of [reportHistoryBody, reportDataBody]) {
  body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-report-open]");
    if (btn) openReportOfDate(btn.dataset.reportOpen);
  });
}

function openTrainingPlanSection() {
  hideAllScreens();
  trainingPlanSection.classList.remove("hidden");
  stopEditTrainingPlan();
  trainingPlanDateInput.value = todayBangkok();
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
  // ปุ่มส่งถูกปิดอยู่แล้วเมื่อไม่มีไฟล์ — กันไว้อีกชั้นเผื่อฟอร์มถูกส่งโดยทางอื่น
  if (!trainingPlanCanSubmit()) {
    trainingPlanStatus.textContent = "กรุณาแนบไฟล์แผนการฝึก (รูป/PDF) ก่อนส่ง";
    trainingPlanStatus.className = "text-sm text-red-600";
    return;
  }
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

  trainingPlanSubmitting = true;
  updateTrainingPlanSubmitState();
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
      trainingPlanStatus.innerHTML = `บันทึกการแก้ไขสำเร็จ ${icon("check")}`;
      trainingPlanStatus.className = "text-sm text-emerald-600";
      stopEditTrainingPlan();
    } else {
      await addDoc(collection(db, "trainingPlans"), { ...payload, createdAt: serverTimestamp() });
      stopEditTrainingPlan();
      trainingPlanDateInput.value = dateStr;
      trainingPlanStatus.innerHTML = `ส่งแผนการฝึกซ้อมสำเร็จ ${icon("check")}`;
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
    trainingPlanSubmitting = false;
    updateTrainingPlanSubmitState();
  }
});

// ---------- Home: ข้อความช่วยเหลือของรายงานการฝึกซ้อม ----------
function formatReportPeriodForDaily(r) {
  if (!r.periodType) return "-";
  const labels = { morning: "ซ้อมเช้า", evening: "ซ้อมเย็น" };
  const label = r.periodType === "other" ? r.periodOtherText || "อื่นๆ" : labels[r.periodType] || r.periodType;
  const timeRange = r.periodStartTime && r.periodEndTime ? `${r.periodStartTime} - ${r.periodEndTime} น.` : "";
  return timeRange ? `${label} (${timeRange})` : label;
}
