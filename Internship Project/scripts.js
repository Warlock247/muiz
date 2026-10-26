/**
 * ===================================================================
 * UI CONTROLLER (scripts.js)
 * Dashboard layout controller for students and lecturers.
 * ===================================================================
 */

// ===================================================================
// 1. CONFIGURATION & HELPERS
// ===================================================================
const EMAILJS_SERVICE_ID = 'service_s4rqujp';
const EMAILJS_TEMPLATE_ID = 'template_mas8t7o';
const EMAILJS_PUBLIC_KEY = 'sNi2AVf3oBInwdYEe';

let currentStudent = null; // Currently logged-in student account
let currentRole = null;    // 'student' or 'lecturer'
let otpCountdownTimer = null;

function showBackendMessage(message) {
  const element = document.getElementById('backendMessage');
  if (!element) return;
  element.textContent = message || '';
  element.classList.toggle('hidden', !message);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

// Send email using EmailJS (template variables: {{to_email}} and {{otp_code}})
async function sendOtpEmail(toEmail, otpCode, studentName) {
  if (typeof emailjs === 'undefined') {
    throw new Error('EmailJS SDK not loaded.');
  }
  return emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: toEmail,
      otp_code: otpCode,
      to_name: studentName || 'Student',
    },
    EMAILJS_PUBLIC_KEY
  );
}

function getOtpSendErrorMessage(error) {
  const message = String(error?.text || error?.message || '');
  if (/API access from non-browser environments/i.test(message)) {
    return 'EmailJS rejected this page origin. Do not open the HTML file directly. Use the published HTTPS website or a local HTTP server, and allow that exact website origin in EmailJS Account → Security.';
  }
  if (error?.status === 403) {
    return 'EmailJS denied this request (403). In EmailJS Account → Security, allow https://warlock247.github.io. Also confirm your EmailJS service and template are enabled.';
  }
  return `Could not send email: ${message || 'Check your EmailJS service, template, and connection.'}`;
}

function setAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

// ===================================================================
// 2. THEME CONTROLLER (DARK / LIGHT MODE)
// ===================================================================
function initTheme() {
  const saved = localStorage.getItem('portal_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('portal_theme', next);
}

document.getElementById('themeToggleBtnAuth')?.addEventListener('click', toggleTheme);
document.getElementById('themeToggleBtnDash')?.addEventListener('click', toggleTheme);
initTheme();

// ===================================================================
// 3. AUTHENTICATION & OTP (LOGIN & SIGN UP)
// ===================================================================
const authWrapper = document.getElementById('authWrapper');
const dashboardShell = document.getElementById('dashboardShell');

const studentLoginBtn = document.getElementById('studentLoginButton');
const studentSignupBtn = document.getElementById('studentSignupButton');
const lecturerRoleBtn = document.getElementById('lecturerRoleButton');

const studentLoginForm = document.getElementById('studentLoginForm');
const studentSignupForm = document.getElementById('studentSignupForm');
const otpVerifySection = document.getElementById('otpVerifySection');
const otpVerifyForm = document.getElementById('otpVerifyForm');
const lecturerLoginForm = document.getElementById('lecturerLoginForm');

function switchAuthTab(tab) {
  [studentLoginBtn, studentSignupBtn, lecturerRoleBtn].forEach(b => b.classList.remove('active'));
  [studentLoginForm, studentSignupForm, otpVerifySection, lecturerLoginForm].forEach(f => {
    f.classList.remove('active');
    f.classList.add('hidden');
  });

  setAuthError('signupError', null);
  setAuthError('otpError', null);
  document.getElementById('forgotMessage').classList.add('hidden');

  if (tab === 'login') {
    studentLoginBtn.classList.add('active');
    studentLoginForm.classList.add('active');
    studentLoginForm.classList.remove('hidden');
  } else if (tab === 'signup') {
    studentSignupBtn.classList.add('active');
    studentSignupForm.classList.add('active');
    studentSignupForm.classList.remove('hidden');
  } else if (tab === 'otp') {
    studentSignupBtn.classList.add('active');
    otpVerifySection.classList.add('active');
    otpVerifySection.classList.remove('hidden');
  } else if (tab === 'lecturer') {
    lecturerRoleBtn.classList.add('active');
    lecturerLoginForm.classList.add('active');
    lecturerLoginForm.classList.remove('hidden');
  }
}

studentLoginBtn.addEventListener('click', () => switchAuthTab('login'));
studentSignupBtn.addEventListener('click', () => switchAuthTab('signup'));
lecturerRoleBtn.addEventListener('click', () => switchAuthTab('lecturer'));

document.getElementById('forgotPasswordButton').addEventListener('click', () => {
  document.getElementById('forgotMessage').classList.toggle('hidden');
});

// Step 1: Sign up details -> Send OTP
studentSignupForm.addEventListener('submit', async event => {
  event.preventDefault();
  showBackendMessage('');
  setAuthError('signupError', null);

  const surname = document.getElementById('signupSurname').value.trim();
  const firstName = document.getElementById('signupFirstName').value.trim();
  const matric = document.getElementById('signupMatric').value.trim();
  const email = document.getElementById('signupEmail').value.trim();

  if (!isValidMatric(matric)) {
    return setAuthError('signupError', 'Matric number must be exactly 9 digits.');
  }
  const submitBtn = studentSignupForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending OTP...';

    const otpData = createOTP(surname, firstName, matric, email);
    await sendOtpEmail(email, otpData.code, `${surname} ${firstName}`);

    document.getElementById('otpInfoMessage').textContent =
      `A 6-digit verification code has been sent to ${email}. Check inbox & spam folder.`;

    startOtpCountdown(120);
    switchAuthTab('otp');
  } catch (err) {
    console.error('OTP error:', err);
    clearPendingOTP();
    setAuthError('signupError', getOtpSendErrorMessage(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// Countdown timer
function startOtpCountdown(seconds) {
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  let timeLeft = seconds;
  const countEl = document.getElementById('otpCountdown');
  const timerDiv = document.getElementById('otpTimer');
  const resendBtn = document.getElementById('resendOtpButton');

  countEl.textContent = timeLeft;
  resendBtn.disabled = true;

  otpCountdownTimer = setInterval(() => {
    timeLeft--;
    countEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(otpCountdownTimer);
      timerDiv.innerHTML = '<strong>Code expired.</strong> Click Resend OTP.';
      resendBtn.disabled = false;
    }
  }, 1000);
}

// Step 2: Verify OTP
otpVerifyForm.addEventListener('submit', async event => {
  event.preventDefault();
  setAuthError('otpError', null);

  const code = document.getElementById('otpInput').value.trim();
  const result = verifyOTP(code);

  if (!result.success) {
    return setAuthError('otpError', result.message);
  }

  const submitBtn = otpVerifyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  try {
    const account = await createStudentAccount(result.pending);
    clearPendingOTP();
    if (otpCountdownTimer) clearInterval(otpCountdownTimer);
    await loadPortalData(account.profile);
    launchStudentDashboard(account.profile);
  } catch (error) {
    setAuthError('otpError', error.message || 'Could not create your online account.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Verify & Create Account';
  }
});

// Resend OTP
document.getElementById('resendOtpButton').addEventListener('click', async () => {
  const pending = getPendingOTP();
  if (!pending) return switchAuthTab('signup');

  const resendBtn = document.getElementById('resendOtpButton');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Resending...';

  try {
    const newOtp = createOTP(pending.surname, pending.firstName, pending.matric, pending.email);
    await sendOtpEmail(pending.email, newOtp.code, `${pending.surname} ${pending.firstName}`);
    startOtpCountdown(120);
    alert(`New code sent to ${pending.email}.`);
  } catch (err) {
    console.error('OTP resend error:', err);
    clearPendingOTP();
    setAuthError('otpError', getOtpSendErrorMessage(err));
    resendBtn.disabled = false;
    resendBtn.textContent = 'Resend OTP';
  }
});

// Student Login
studentLoginForm.addEventListener('submit', async event => {
  event.preventDefault();
  showBackendMessage('');
  const matric = document.getElementById('studentMatric').value.trim();
  const password = document.getElementById('studentPassword').value.trim();

  if (!isValidMatric(matric)) {
    return alert('Matric number must be exactly 9 digits.');
  }

  const submitBtn = studentLoginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const result = await signInStudent(matric, password);
    if (!result.success) {
      return alert(result.message);
    }
    await loadPortalData(result.account);
    document.getElementById('studentPassword').value = '';
    launchStudentDashboard(result.account);
  } catch (error) {
    showBackendMessage(error.message);
    try {
      await signOutOnline();
    } catch (signOutError) {
      console.error('Could not clear the failed online session:', signOutError);
    }
  } finally {
    submitBtn.disabled = false;
  }
});

// Lecturer Login
lecturerLoginForm.addEventListener('submit', async event => {
  event.preventDefault();
  showBackendMessage('');
  const email = document.getElementById('lecturerEmail').value.trim();
  const pass = document.getElementById('lecturerPassword').value.trim();

  const submitBtn = lecturerLoginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const result = await signInLecturer(email, pass);
    if (!result.success) {
      return alert(result.message);
    }
    await loadPortalData(result.account);
    document.getElementById('lecturerEmail').value = '';
    document.getElementById('lecturerPassword').value = '';
    launchLecturerDashboard();
  } catch (error) {
    showBackendMessage(error.message);
    try {
      await signOutOnline();
    } catch (signOutError) {
      console.error('Could not clear the failed online session:', signOutError);
    }
  } finally {
    submitBtn.disabled = false;
  }
});

// Logout
async function logout() {
  try {
    await signOutOnline();
  } catch (error) {
    showBackendMessage(error.message);
    return;
  }
  currentStudent = null;
  currentRole = null;

  authWrapper.classList.remove('hidden');
  dashboardShell.classList.add('hidden');
  document.getElementById('dashSidebar').classList.remove('open');

  switchAuthTab('login');
}

document.getElementById('logoutBtn').addEventListener('click', () => logout());

// ===================================================================
// 4. DASHBOARD SHELL & SIDEBAR NAVIGATION
// ===================================================================
const studentHeaderBadge = document.getElementById('studentHeaderBadge');
const lecturerHeaderBadge = document.getElementById('lecturerHeaderBadge');
const studentSidebarMenu = document.getElementById('studentSidebarMenu');
const lecturerSidebarMenu = document.getElementById('lecturerSidebarMenu');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const dashSidebar = document.getElementById('dashSidebar');

// Toggle mobile sidebar
if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener('click', () => {
    dashSidebar.classList.toggle('open');
  });
}

// Student views
const viewStudentStatus = document.getElementById('viewStudentStatus');
const viewStudentForm = document.getElementById('viewStudentForm');
const viewStudentLogbook = document.getElementById('viewStudentLogbook');
const viewLecturerDashboard = document.getElementById('viewLecturerDashboard');

function switchDashboardView(viewName) {
  // Hide mobile sidebar if open
  dashSidebar.classList.remove('open');

  // Update active sidebar nav button
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Hide all sections
  [viewStudentStatus, viewStudentForm, viewStudentLogbook, viewLecturerDashboard].forEach(v => {
    v.classList.add('hidden');
  });

  if (viewName === 'status') {
    viewStudentStatus.classList.remove('hidden');
    renderStudentApplicationStatus();
  } else if (viewName === 'form') {
    viewStudentForm.classList.remove('hidden');
    setupStudentApplicationForm();
  } else if (viewName === 'logbook') {
    viewStudentLogbook.classList.remove('hidden');
    renderStudentLogbookView();
  } else if (viewName === 'slip') {
    openClearanceSlip();
  } else if (viewName === 'lecturer-dash') {
    viewLecturerDashboard.classList.remove('hidden');
    renderLecturerDashboard();
  }
}

// Bind sidebar click events
document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (view) switchDashboardView(view);
  });
});

// Launch Student Dashboard
function launchStudentDashboard(account) {
  currentStudent = account;
  currentRole = 'student';

  // Toggle wrappers
  authWrapper.classList.add('hidden');
  dashboardShell.classList.remove('hidden');

  // Header display: Name and 9-digit Matric Number at the top
  studentHeaderBadge.classList.remove('hidden');
  lecturerHeaderBadge.classList.add('hidden');
  document.getElementById('loggedInStudentName').textContent = account.fullName;
  document.getElementById('loggedInMatric').textContent = account.matric;

  // Sidebar menus
  studentSidebarMenu.classList.remove('hidden');
  lecturerSidebarMenu.classList.add('hidden');

  // Load default view
  switchDashboardView('status');
}

// Launch Lecturer Dashboard
function launchLecturerDashboard() {
  currentStudent = null;
  currentRole = 'lecturer';

  authWrapper.classList.add('hidden');
  dashboardShell.classList.remove('hidden');

  studentHeaderBadge.classList.add('hidden');
  lecturerHeaderBadge.classList.remove('hidden');

  studentSidebarMenu.classList.add('hidden');
  lecturerSidebarMenu.classList.remove('hidden');

  switchDashboardView('lecturer-dash');
}

// ===================================================================
// 5. STUDENT APPLICATION STATUS & EDITING
// ===================================================================
const recordEmpty = document.getElementById('recordEmpty');
const recordDetails = document.getElementById('recordDetails');
const editSubmissionBtn = document.getElementById('editSubmissionBtn');
const viewClearanceTopBtn = document.getElementById('viewClearanceTopBtn');

// Render student's submission status
function renderStudentApplicationStatus() {
  if (!currentStudent) return;
  const sub = getSubmissionByMatric(currentStudent.matric);

  // Update lock indicators in sidebar
  const sideLogbookLock = document.getElementById('sideLogbookLock');
  const sideSlipLock = document.getElementById('sideSlipLock');

  if (sub && sub.status === 'Accepted') {
    sideLogbookLock.textContent = '✅';
    sideSlipLock.textContent = '✅';
  } else {
    sideLogbookLock.textContent = '🔒';
    sideSlipLock.textContent = '🔒';
  }

  if (!sub) {
    recordEmpty.classList.remove('hidden');
    recordDetails.classList.add('hidden');
    editSubmissionBtn.textContent = '📝 Fill Application Form';
    viewClearanceTopBtn.classList.add('hidden');
    return;
  }

  recordEmpty.classList.add('hidden');
  recordDetails.classList.remove('hidden');
  editSubmissionBtn.textContent = '✏️ Edit Submission';

  const progress = calculateProgress(sub.startDate, sub.endDate);
  const status = sub.status || 'Pending';

  document.getElementById('recordFullName').textContent = sub.fullName;
  document.getElementById('recordMatricNumber').textContent = sub.matricNumber;
  document.getElementById('recordDeptSchool').textContent = `${sub.department} (${sub.school})`;
  document.getElementById('recordCompanyName').textContent = sub.companyName;
  document.getElementById('recordCompanyPhone').textContent = sub.companyPhone;
  document.getElementById('recordSupervisor').textContent = sub.supervisor;
  document.getElementById('recordDates').textContent = `${sub.startDate} to ${sub.endDate}`;
  document.getElementById('recordProgressPercent').textContent = `${progress}%`;

  const badge = document.getElementById('recordStatusBadge');
  badge.className = `status-badge status-${status.toLowerCase()}`;
  badge.textContent = status;

  const progressFill = document.getElementById('recordProgressFill');
  progressFill.style.width = `${progress}%`;
  document.getElementById('recordProgressBar').classList.remove('hidden');

  // Lecturer feedback
  const feedbackRow = document.getElementById('recordFeedbackRow');
  if (sub.lecturerFeedback) {
    document.getElementById('recordFeedbackText').textContent = sub.lecturerFeedback;
    feedbackRow.classList.remove('hidden');
  } else {
    feedbackRow.classList.add('hidden');
  }

  // Documents
  document.getElementById('recordAcceptanceForm').innerHTML = sub.acceptanceFileData
    ? `<a href="${escapeHtml(sub.acceptanceFileData)}" download="${escapeHtml(sub.acceptanceForm)}" class="file-link">📥 Download</a>
       <button type="button" class="preview-btn" data-preview-name="${escapeHtml(sub.acceptanceForm)}" data-preview-url="${escapeHtml(sub.acceptanceFileData)}">👁️ Preview</button>`
    : escapeHtml(sub.acceptanceForm || 'None');

  document.getElementById('recordApplicationLetter').innerHTML = sub.applicationLetterData
    ? `<a href="${escapeHtml(sub.applicationLetterData)}" download="${escapeHtml(sub.applicationLetter)}" class="file-link">📥 Download</a>
       <button type="button" class="preview-btn" data-preview-name="${escapeHtml(sub.applicationLetter)}" data-preview-url="${escapeHtml(sub.applicationLetterData)}">👁️ Preview</button>`
    : escapeHtml(sub.applicationLetter || 'None');

  document.getElementById('recordNotes').textContent = sub.notes || 'None';

  // Clearance button visibility
  if (status === 'Accepted') {
    viewClearanceTopBtn.classList.remove('hidden');
  } else {
    viewClearanceTopBtn.classList.add('hidden');
  }
}

// "Edit Submission" button on the submission status page
if (editSubmissionBtn) {
  editSubmissionBtn.addEventListener('click', () => {
    switchDashboardView('form');
  });
}

if (viewClearanceTopBtn) {
  viewClearanceTopBtn.addEventListener('click', () => {
    openClearanceSlip();
  });
}

// Setup and pre-fill application form
function setupStudentApplicationForm() {
  if (!currentStudent) return;
  const sub = getSubmissionByMatric(currentStudent.matric);

  document.getElementById('fullName').value = sub ? sub.fullName : currentStudent.fullName;
  document.getElementById('matricNumber').value = currentStudent.matric;

  if (sub) {
    document.getElementById('formTitle').textContent = '✏️ Edit Internship Application';
    document.getElementById('submitButton').textContent = 'Update Application';

    document.getElementById('department').value = sub.department || '';
    document.getElementById('school').value = sub.school || '';
    document.getElementById('supervisor').value = sub.supervisor || '';
    document.getElementById('companyName').value = sub.companyName || '';
    document.getElementById('companyPhone').value = sub.companyPhone || '';
    document.getElementById('startDate').value = sub.startDate || '';
    document.getElementById('endDate').value = sub.endDate || '';
    document.getElementById('additionalNotes').value = sub.notes || '';

    // Files are optional if retaining existing uploads
    document.getElementById('acceptanceForm').required = !sub.acceptanceFileData;
    document.getElementById('applicationLetter').required = !sub.applicationLetterData;
  } else {
    document.getElementById('formTitle').textContent = 'Internship Application Form';
    document.getElementById('submitButton').textContent = 'Submit Application';
    document.getElementById('acceptanceForm').required = true;
    document.getElementById('applicationLetter').required = true;
  }
}

// Submission Form Handler
const submissionForm = document.getElementById('submissionForm');
submissionForm.addEventListener('submit', async event => {
  event.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const matricNumber = document.getElementById('matricNumber').value.trim();
  const department = document.getElementById('department').value.trim();
  const school = document.getElementById('school').value.trim();
  const supervisor = document.getElementById('supervisor').value.trim();
  const companyName = document.getElementById('companyName').value.trim();
  const companyPhone = document.getElementById('companyPhone').value.trim();
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const notes = document.getElementById('additionalNotes').value.trim();

  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    return alert('End Date cannot be earlier than Start Date.');
  }

  const existing = getSubmissionByMatric(matricNumber);
  const submitBtn = document.getElementById('submitButton');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const acceptFile = document.getElementById('acceptanceForm').files[0];
  const letterFile = document.getElementById('applicationLetter').files[0];

  try {
    let acceptanceForm = existing ? existing.acceptanceForm : 'No file';
    let acceptanceFileData = existing ? existing.acceptanceFileData : null;
    let acceptanceFilePath = existing ? existing.acceptanceFilePath : null;
    if (acceptFile) {
      acceptanceForm = acceptFile.name;
      acceptanceFilePath = await uploadPortalFile(acceptFile, matricNumber, 'acceptance-form');
      acceptanceFileData = await createSignedAssetUrl(acceptanceFilePath);
    }

    let applicationLetter = existing ? existing.applicationLetter : 'No file';
    let applicationLetterData = existing ? existing.applicationLetterData : null;
    let applicationLetterPath = existing ? existing.applicationLetterPath : null;
    if (letterFile) {
      applicationLetter = letterFile.name;
      applicationLetterPath = await uploadPortalFile(letterFile, matricNumber, 'application-letter');
      applicationLetterData = await createSignedAssetUrl(applicationLetterPath);
    }

    await saveSubmission({
      fullName,
      matricNumber,
      department,
      school,
      supervisor,
      companyName,
      companyPhone,
      startDate,
      endDate,
      acceptanceForm,
      acceptanceFileData,
      acceptanceFilePath,
      applicationLetter,
      applicationLetterData,
      applicationLetterPath,
      notes,
    });
    alert('Application saved successfully to your online account.');
    switchDashboardView('status');
  } catch (error) {
    alert(`Could not save your application online: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Application';
  }
});

// ===================================================================
// 6. WEEKLY LOGBOOK (LOCKED UNTIL ACCEPTED + DYNAMIC WEEKS)
// ===================================================================
const logbookForm = document.getElementById('logbookForm');
const logbookList = document.getElementById('logbookList');
const logbookLockedBanner = document.getElementById('logbookLockedBanner');
const logbookUnlockedArea = document.getElementById('logbookUnlockedArea');
const lockedStatusBadge = document.getElementById('lockedStatusBadge');

function renderStudentLogbookView() {
  if (!currentStudent) return;
  const sub = getSubmissionByMatric(currentStudent.matric);

  // RULE: Cannot upload logbook until lecturer accepts submission
  if (!sub || sub.status !== 'Accepted') {
    logbookLockedBanner.classList.remove('hidden');
    logbookUnlockedArea.classList.add('hidden');

    const curStatus = sub ? sub.status : 'Not Submitted';
    lockedStatusBadge.className = `status-badge status-${curStatus.toLowerCase().replace(' ', '')}`;
    lockedStatusBadge.textContent = curStatus;
  } else {
    logbookLockedBanner.classList.add('hidden');
    logbookUnlockedArea.classList.remove('hidden');
    setupLogbookWeeks(sub);

    if (sub.logbookApproved) {
      const approvedNotice = document.createElement('div');
      approvedNotice.className = 'status-banner approved';
      approvedNotice.innerHTML = '✅ Weekly logbook approved by your lecturer.';
      const existingBanner = logbookUnlockedArea.querySelector('.status-banner');
      if (existingBanner) existingBanner.remove();
      logbookUnlockedArea.insertBefore(approvedNotice, logbookUnlockedArea.firstChild.nextSibling);
    } else if (getLogEntries(currentStudent.matric).length) {
      const pendingNotice = document.createElement('div');
      pendingNotice.className = 'status-banner pending';
      pendingNotice.innerHTML = '⏳ Your weekly logbook has been submitted and is awaiting lecturer approval.';
      const existingBanner = logbookUnlockedArea.querySelector('.status-banner');
      if (existingBanner) existingBanner.remove();
      logbookUnlockedArea.insertBefore(pendingNotice, logbookUnlockedArea.firstChild.nextSibling);
    }
  }

  renderLogbookList();
}

// Generate the week options based on project duration
function setupLogbookWeeks(sub) {
  const logWeekSelect = document.getElementById('logWeek');
  const logWeekHelp = document.getElementById('logWeekHelp');
  if (!logWeekSelect) return;

  const totalWeeks = sub ? calculateDurationWeeks(sub.startDate, sub.endDate) : 12;

  logWeekSelect.innerHTML = '<option value="">Select Week</option>';
  for (let w = 1; w <= totalWeeks; w++) {
    const opt = document.createElement('option');
    opt.value = `Week ${w}`;
    opt.textContent = `Week ${w}`;
    logWeekSelect.appendChild(opt);
  }

  if (logWeekHelp && sub && sub.startDate && sub.endDate) {
    logWeekHelp.textContent = `Project duration: ${totalWeeks} weeks (${sub.startDate} to ${sub.endDate}).`;
  }
}

// Auto-fill dates when week is picked
const logWeekSelectEl = document.getElementById('logWeek');
if (logWeekSelectEl) {
  logWeekSelectEl.addEventListener('change', () => {
    if (!currentStudent) return;
    const sub = getSubmissionByMatric(currentStudent.matric);
    if (!sub || !sub.startDate) return;

    const match = logWeekSelectEl.value.match(/Week (\d+)/);
    if (match) {
      const weekNum = parseInt(match[1], 10);
      const start = new Date(sub.startDate);
      if (!isNaN(start.getTime())) {
        const weekStart = new Date(start.getTime() + (weekNum - 1) * 7 * 86400000);
        const weekEnd = new Date(weekStart.getTime() + 4 * 86400000); // Mon - Fri
        const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const datesInput = document.getElementById('logDates');
        if (datesInput) datesInput.value = `${fmt(weekStart)} - ${fmt(weekEnd)}`;
      }
    }
  });
}

// Submit new weekly log entry
logbookForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentStudent) return;

  const sub = getSubmissionByMatric(currentStudent.matric);
  if (!sub || sub.status !== 'Accepted') {
    return alert('Logbook submission is locked. Your placement must be officially Accepted by your lecturer first.');
  }

  const week = document.getElementById('logWeek').value;
  const dates = document.getElementById('logDates').value.trim();
  const tasks = document.getElementById('logTasks').value.trim();
  const skills = document.getElementById('logSkills').value.trim();
  const selectedFiles = Array.from(document.getElementById('logImages').files || []);
  const submitBtn = logbookForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const uploadedImages = await Promise.all(
      selectedFiles.map(file => uploadPortalFile(file, currentStudent.matric, 'logbook'))
    );
    await saveLogEntry({
      matric: currentStudent.matric,
      studentName: currentStudent.fullName,
      week,
      dates,
      tasks,
      skills,
      images: uploadedImages.filter(Boolean),
      approved: false,
    });

    logbookForm.reset();
    renderLogbookList();
    renderStudentLogbookView();
    alert('Weekly log entry saved successfully online.');
  } catch (error) {
    alert(`Could not save your logbook entry online: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

function renderLogbookList() {
  if (!currentStudent) return;
  const logs = getLogEntries(currentStudent.matric);

  if (!logs.length) {
    logbookList.innerHTML = '<p class="record-empty">No weekly log entries recorded yet.</p>';
    return;
  }

  logbookList.innerHTML = logs.map(l => `
    <div class="logbook-entry">
    <span class="log-week-badge">${escapeHtml(l.week)}</span>
    <small style="color: var(--text-muted); float: right;">Period: ${escapeHtml(l.dates)}</small>
    <div style="margin: 8px 0;"><strong>Activities:</strong> ${escapeHtml(l.tasks)}</div>
    <div style="font-size: 0.85rem; color: var(--text-muted);"><strong>Skills Learned:</strong> ${escapeHtml(l.skills)}</div>
      <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
      ${(Array.isArray(l.images) && l.images.length ? l.images.map(image => `<img src="${escapeHtml(image)}" alt="${escapeHtml(l.week)} proof" style="max-width: 120px; max-height: 90px; border-radius: 10px; border: 1px solid #dfe9f2; object-fit: cover;" />`).join('') : '<span style="color: var(--text-muted);">No images uploaded for this week.</span>')}
      </div>
      <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">
        ${l.approved ? '✅ Lecturer approved this weekly log.' : '⏳ Pending lecturer approval.'}
      </div>
    </div>
  `).join('');
}

// ===================================================================
// 7. PRINTABLE CLEARANCE SLIP
// ===================================================================
const clearanceModal = document.getElementById('clearanceModal');
const closeSlipBtn = document.getElementById('closeSlipBtn');

function openClearanceSlip() {
  if (!currentStudent) return;
  const sub = getSubmissionByMatric(currentStudent.matric);

  if (!sub || sub.status !== 'Accepted') {
    return alert(`Official Clearance Slip is only unlocked once your internship placement is Accepted.\n(Current Status: ${sub ? sub.status : 'Not Submitted'})`);
  }

  document.getElementById('slipFullName').textContent = sub.fullName;
  document.getElementById('slipMatric').textContent = sub.matricNumber;
  document.getElementById('slipDept').textContent = sub.department;
  document.getElementById('slipSchool').textContent = sub.school;
  document.getElementById('slipCompany').textContent = sub.companyName;
  document.getElementById('slipPhone').textContent = sub.companyPhone;
  document.getElementById('slipSupervisor').textContent = sub.supervisor;
  document.getElementById('slipDates').textContent = `${sub.startDate} to ${sub.endDate}`;
  document.getElementById('slipQrCode').textContent = `SIWES-${sub.matricNumber}-${Date.now().toString().slice(-6)}`;

  clearanceModal.classList.remove('hidden');
}

if (closeSlipBtn) closeSlipBtn.addEventListener('click', () => clearanceModal.classList.add('hidden'));

// ===================================================================
// 8. DOCUMENT PREVIEW MODAL
// ===================================================================
const previewModal = document.getElementById('previewModal');
const previewTitle = document.getElementById('previewTitle');
const previewBody = document.getElementById('previewBody');
const closePreviewBtn = document.getElementById('closePreviewBtn');

function openPreview(filename, dataUrl) {
  if (!dataUrl) return alert('No file data available.');
  previewTitle.textContent = filename || 'Document Preview';
  previewBody.replaceChildren();
  if (dataUrl.startsWith('data:image/')) {
    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = 'Preview';
    image.style.cssText = 'max-width:100%; border-radius:8px;';
    previewBody.appendChild(image);
  } else {
    const frame = document.createElement('iframe');
    frame.src = dataUrl;
    frame.title = filename || 'Document Preview';
    frame.style.cssText = 'width:100%; height:480px; border:none; border-radius:8px;';
    previewBody.appendChild(frame);
  }
  previewModal.classList.remove('hidden');
}

if (closePreviewBtn) {
  closePreviewBtn.addEventListener('click', () => {
    previewModal.classList.add('hidden');
    previewBody.innerHTML = '';
  });
}

// ===================================================================
// 9. LECTURER DASHBOARD (KPIS, LIVE SEARCH, ACTIONS, OVERTURN, CSV)
// ===================================================================
let lecturerStatusFilter = 'all';
let lecturerSearchTerm = '';

const dbTableBody = document.getElementById('dbTableBody');
const dbMessage = document.getElementById('dbMessage');
const dbSearchInput = document.getElementById('dbSearchInput');
const exportCsvBtn = document.getElementById('exportCsvButton');
const sideExportBtn = document.getElementById('sideExportBtn');
const filterPills = document.querySelectorAll('.filter-pill');

function updateKpiCards() {
  const stats = getKpiStats();
  document.getElementById('kpiTotal').textContent = stats.total;
  document.getElementById('kpiPending').textContent = stats.pending;
  document.getElementById('kpiAccepted').textContent = stats.accepted;
  document.getElementById('kpiDenied').textContent = stats.denied;
}

function renderLecturerDashboard() {
  updateKpiCards();

  const all = getAllSubmissions();
  let list = all;

  if (lecturerStatusFilter !== 'all') {
    list = list.filter(s => (s.status || 'Pending') === lecturerStatusFilter);
  }

  if (lecturerSearchTerm) {
    const q = lecturerSearchTerm.toLowerCase();
    list = list.filter(s =>
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.matricNumber || '').toLowerCase().includes(q) ||
      (s.companyName || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }

  dbTableBody.innerHTML = '';

  if (!all.length) {
    dbMessage.textContent = 'No submissions recorded yet.';
    return;
  }
  if (!list.length) {
    dbMessage.textContent = 'No matching records for current filter/search.';
    return;
  }

  dbMessage.textContent = `Showing ${list.length} of ${all.length} application(s).`;

  list.forEach((entry, idx) => {
    const progress = calculateProgress(entry.startDate, entry.endDate);
    const status = entry.status || 'Pending';
    const row = document.createElement('tr');

    const acceptDoc = entry.acceptanceFileData
      ? `<a href="${escapeHtml(entry.acceptanceFileData)}" download="${escapeHtml(entry.acceptanceForm)}" class="file-link">📥 Form</a>
         <button type="button" class="preview-btn" data-preview-name="${escapeHtml(entry.acceptanceForm)}" data-preview-url="${escapeHtml(entry.acceptanceFileData)}">👁️</button>`
      : escapeHtml(entry.acceptanceForm || 'None');

    const letterDoc = entry.applicationLetterData
      ? `<a href="${escapeHtml(entry.applicationLetterData)}" download="${escapeHtml(entry.applicationLetter)}" class="file-link">📥 Letter</a>
         <button type="button" class="preview-btn" data-preview-name="${escapeHtml(entry.applicationLetter)}" data-preview-url="${escapeHtml(entry.applicationLetterData)}">👁️</button>`
      : escapeHtml(entry.applicationLetter || 'None');

    const logEntries = getLogEntries(entry.matricNumber);
    const logsPendingApproval = logEntries.length > 0 && !entry.logbookApproved;
    const logsApproved = Boolean(entry.logbookApproved);

    // Once accepted: hide Accept & Deny and show the Overturn button
    let actionsHtml = '';
    if (status === 'Accepted') {
      actionsHtml = `
        <button type="button" class="action-button edit-btn" data-review-action="overturn" data-submission-id="${escapeHtml(entry.id)}">✏️ Overturn</button>
        <button type="button" class="action-button logs-btn" data-review-action="logs" data-matric="${escapeHtml(entry.matricNumber)}" data-student-name="${escapeHtml(entry.fullName)}">📖 Logs</button>
      `;
      if (logEntries.length) {
        actionsHtml += `
          <button type="button" class="action-button accept-btn" data-review-action="approve-logs" data-matric="${escapeHtml(entry.matricNumber)}" data-student-name="${escapeHtml(entry.fullName)}">${logsApproved ? '✓ Approved' : '✅ Approve Logs'}</button>
        `;
      }
    } else {
      actionsHtml = `
        <button type="button" class="action-button accept-btn" data-review-action="accept" data-submission-id="${escapeHtml(entry.id)}">✓ Accept</button>
        <button type="button" class="action-button deny-btn" data-review-action="deny" data-submission-id="${escapeHtml(entry.id)}">✕ Deny</button>
        <button type="button" class="action-button logs-btn" data-review-action="logs" data-matric="${escapeHtml(entry.matricNumber)}" data-student-name="${escapeHtml(entry.fullName)}">📖 Logs</button>
      `;
    }

    if (logsPendingApproval) {
      row.classList.add('row-pending-logbook');
    }

    row.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td><strong>${escapeHtml(entry.fullName)}</strong></td>
      <td><code>${escapeHtml(entry.matricNumber)}</code></td>
      <td>${escapeHtml(entry.department)}</td>
      <td>${escapeHtml(entry.companyName)}<small>📞 ${escapeHtml(entry.companyPhone)}</small></td>
      <td>${escapeHtml(entry.supervisor)}</td>
      <td><small>${escapeHtml(entry.startDate)}<br>to ${escapeHtml(entry.endDate)}</small></td>
      <td>
        <strong>${progress}%</strong>
        <div class="progress-container" style="height:6px; margin-top:4px;">
          <div class="progress-fill" style="width:${progress}%;"></div>
        </div>
      </td>
      <td><span class="status-badge status-${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span></td>
      <td>
        <div class="action-buttons">
          ${actionsHtml}
        </div>
      </td>
      <td>${acceptDoc}<br>${letterDoc}</td>
      <td>
        <small>${escapeHtml(entry.notes || 'No notes')}</small>
        ${entry.lecturerFeedback ? `<div style="color:#dc2626; font-size:0.8rem; margin-top:4px;"><strong>Note:</strong> ${escapeHtml(entry.lecturerFeedback)}</div>` : ''}
      </td>
    `;
    dbTableBody.appendChild(row);
  });
}

// Lecturer overturns decision
window.overturnDecision = async function(id) {
  const sub = getAllSubmissions().find(s => String(s.id) === String(id));
  if (!sub) return;

  const choice = prompt(
    `Overturn decision for ${sub.fullName} (${sub.matricNumber})?\n\nCurrent Status: ${sub.status}\n\nType "deny" to mark Denied\nType "pending" to reset to Pending review:`,
    'deny'
  );
  if (!choice) return;

  const clean = choice.trim().toLowerCase();
  let newStatus = '';
  if (clean === 'deny' || clean === 'denied') {
    newStatus = 'Denied';
  } else if (clean === 'pending') {
    newStatus = 'Pending';
  } else {
    return alert('Invalid choice. Please type "deny" or "pending".');
  }

  let feedback = '';
  if (newStatus === 'Denied') {
    feedback = prompt('Enter reason for denial / overturn:', 'Previous approval overturned — placement details require update.');
    if (feedback === null) return;
  } else {
    feedback = 'Decision overturned to Pending review by lecturer.';
  }

  try {
    await updateSubmissionStatus(id, newStatus, feedback);
    renderLecturerDashboard();
  } catch (error) {
    return alert(`Could not update the application online: ${error.message}`);
  }

  // Notify student via EmailJS
  const acc = getAccount(sub.matricNumber);
  if (acc && acc.email) {
    try {
      await sendOtpEmail(acc.email, `Status Update: ${newStatus}`, acc.fullName);
    } catch (e) {
      console.warn('Status email skipped:', e);
    }
  }

  alert(`Status for ${sub.fullName} updated to "${newStatus}".`);
};

// Lecturer Accept / Deny
window.handleLecturerStatus = async function(id, newStatus) {
  let feedback = '';
  if (newStatus === 'Denied') {
    feedback = prompt('Enter reason for denial (optional):', 'Please correct company details / re-upload form.');
    if (feedback === null) return;
  } else {
    if (!confirm('Mark this internship placement as Accepted?')) return;
  }

  try {
    await updateSubmissionStatus(id, newStatus, feedback);
    renderLecturerDashboard();
  } catch (error) {
    return alert(`Could not update the application online: ${error.message}`);
  }

  const sub = getAllSubmissions().find(s => String(s.id) === String(id));
  if (sub) {
    const acc = getAccount(sub.matricNumber);
    if (acc && acc.email) {
      try {
        await sendOtpEmail(acc.email, `Status Update: ${newStatus}`, acc.fullName);
      } catch (e) {
        console.warn('Status email skipped:', e);
      }
    }
  }
};

// Search & Filter listeners
if (dbSearchInput) {
  dbSearchInput.addEventListener('input', e => {
    lecturerSearchTerm = e.target.value.trim();
    renderLecturerDashboard();
  });
}

filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    lecturerStatusFilter = pill.dataset.filter;
    renderLecturerDashboard();
  });
});

if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportSubmissionsCsv);
if (sideExportBtn) sideExportBtn.addEventListener('click', exportSubmissionsCsv);

window.approveAllLogbooks = async function() {
  const pending = getAllLogEntries().filter(item => !item.approved);

  if (!pending.length) {
    return alert('There are no pending weekly logbooks to approve.');
  }

  const confirmApprove = confirm(`Approve all ${pending.length} pending weekly logbook entries?`);
  if (!confirmApprove) return;

  try {
    await approveAllPendingLogbooks();
    renderLecturerDashboard();
    if (currentStudent) {
      renderStudentLogbookView();
    }
    alert(`Approved all ${pending.length} pending logbook entries.`);
  } catch (error) {
    alert(`Could not approve logbooks online: ${error.message}`);
  }
};

// Lecturer View Student Logbook Modal
const studentLogsModal = document.getElementById('studentLogsModal');
const logsModalTitle = document.getElementById('logsModalTitle');
const logsModalBody = document.getElementById('logsModalBody');
const closeLogsBtn = document.getElementById('closeLogsBtn');

window.openStudentLogsModal = function(matric, name) {
  logsModalTitle.textContent = `${name}'s Weekly Logbook (${matric})`;
  const logs = getLogEntries(matric);

  if (!logs.length) {
    logsModalBody.innerHTML = '<p class="record-empty">No weekly logs submitted by this student yet.</p>';
  } else {
    logsModalBody.innerHTML = logs.map(l => `
      <div class="logbook-entry">
        <span class="log-week-badge">${escapeHtml(l.week)}</span>
        <small style="color: var(--text-muted); float: right;">${escapeHtml(l.dates)}</small>
        <div style="margin: 8px 0;"><strong>Activities:</strong> ${escapeHtml(l.tasks)}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);"><strong>Skills:</strong> ${escapeHtml(l.skills)}</div>
        <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
          ${(Array.isArray(l.images) && l.images.length ? l.images.map(image => `<img src="${escapeHtml(image)}" alt="${escapeHtml(l.week)} proof" style="max-width: 160px; max-height: 110px; border-radius: 10px; border: 1px solid #dfe9f2; object-fit: cover;" />`).join('') : '<span style="color: var(--text-muted);">No images uploaded.</span>')}
        </div>
        <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">
          ${l.approved ? '✅ Approved by lecturer' : '⏳ Awaiting lecturer approval'}
        </div>
      </div>
    `).join('');

    const studentSubmission = getSubmissionByMatric(matric);
    const shouldShowApproveButton = logs.length > 0 && (!studentSubmission || !studentSubmission.logbookApproved);
    if (shouldShowApproveButton) {
      logsModalBody.insertAdjacentHTML('beforeend', `
        <div style="margin-top: 18px; text-align: right;">
          <button type="button" class="primary-btn-sm" data-review-action="approve-logs" data-matric="${escapeHtml(matric)}" data-student-name="${escapeHtml(name)}">✅ Approve this logbook</button>
        </div>
      `);
    }
  }

  studentLogsModal.classList.remove('hidden');
};

window.approveStudentLogbookHandler = async function(matric, name) {
  const logs = getLogEntries(matric);
  if (!logs.length) {
    return alert(`${name} has not uploaded any weekly log entries yet.`);
  }

  const confirmApprove = confirm(`Approve the full weekly logbook for ${name}?`);
  if (!confirmApprove) return;

  try {
    await markLogbookApproved(matric, 'Approved by lecturer');
    renderLecturerDashboard();
    if (currentStudent && currentStudent.matric === matric) {
      renderStudentLogbookView();
    }
    studentLogsModal.classList.add('hidden');
    alert(`Weekly logbook approved for ${name}.`);
  } catch (error) {
    alert(`Could not approve this logbook online: ${error.message}`);
  }
};

if (closeLogsBtn) {
  closeLogsBtn.addEventListener('click', () => studentLogsModal.classList.add('hidden'));
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const previewButton = target.closest('[data-preview-url]');
  if (previewButton) {
    openPreview(previewButton.dataset.previewName, previewButton.dataset.previewUrl);
    return;
  }

  const actionButton = target.closest('[data-review-action]');
  if (!actionButton) return;

  const { reviewAction, submissionId, matric, studentName } = actionButton.dataset;
  if (reviewAction === 'overturn') {
    window.overturnDecision(submissionId);
  } else if (reviewAction === 'accept') {
    window.handleLecturerStatus(submissionId, 'Accepted');
  } else if (reviewAction === 'deny') {
    window.handleLecturerStatus(submissionId, 'Denied');
  } else if (reviewAction === 'logs') {
    window.openStudentLogsModal(matric, studentName);
  } else if (reviewAction === 'approve-logs') {
    window.approveStudentLogbookHandler(matric, studentName);
  }
});

async function initializePortal() {
  try {
    const profile = await restoreOnlineSession();
    if (!profile) return;
    if (profile.role === 'lecturer') {
      launchLecturerDashboard();
    } else {
      launchStudentDashboard(profile);
    }
  } catch (error) {
    console.error('Could not restore the Supabase session:', error);
    showBackendMessage(`Could not connect to the online portal: ${error.message}`);
  }
}

initializePortal();
