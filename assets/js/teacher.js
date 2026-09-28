/**
 * teacher.js
 * -----------------------------------------------------------------------
 * Teacher Portal Module
 * 
 * Features:
 * - Collapsible royal blue left sidebar navigation matching official design.
 * - Class & Subject grade entry scoped to teacher assignments.
 * - Lesson Plan submission with file upload (PDF, Word, Image).
 * - Test Submission tab for submitting exam tests to Admin.
 * - Messages & Announcements.
 * - Comprehensive Settings tab (photo, contact, password, PWA).
 * - Standard PNG icons from assets/icons/ throughout.
 * -----------------------------------------------------------------------
 */

window.TeacherPanel = (function () {
  let currentTeacher = null;
  let currentAssignments = [];
  let selectedClass = '';
  let selectedSubject = '';
  let currentRoster = [];
  let gradingPermissions = {};
  let currentTab = 'grades';
  let isSidebarCollapsed = false;

  async function mount(container, user) {
    currentTeacher = user;
    currentAssignments = user.assignments || [];
    currentTab = 'grades';

    if (currentAssignments.length > 0) {
      selectedClass = currentAssignments[0].class || '';
      selectedSubject = (currentAssignments[0].subjects && currentAssignments[0].subjects[0]) || '';
    }

    // Fetch open period permissions
    const pRes = await API.callBackend('getPermissions', {}, 'Loading permissions...');
    gradingPermissions = (pRes && pRes.success) ? pRes.permissions : {};

    renderPortalLayout(container);
    await loadTab(currentTab);
  }

  function renderPortalLayout(container) {
    container.innerHTML = `
      <div class="portal-layout">
        <!-- Collapsible Royal Blue Sidebar -->
        <aside class="portal-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}" id="teacherSidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand-title">Teacher Portal</div>
            <button class="sidebar-toggle-btn" id="sidebarToggleBtn" type="button" title="Toggle Navigation">
              <img src="assets/icons/text-align-justify.png" alt="Toggle">
            </button>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-title">Teaching &amp; Grading</div>
            
            <a class="sidebar-item ${currentTab === 'grades' ? 'active' : ''}" data-tab="grades">
              <img src="assets/icons/pencil.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Grade Sheet Entry</span>
            </a>

            <a class="sidebar-item ${currentTab === 'lessonPlans' ? 'active' : ''}" data-tab="lessonPlans">
              <img src="assets/icons/folders.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Lesson Plans</span>
            </a>

            <a class="sidebar-item ${currentTab === 'tests' ? 'active' : ''}" data-tab="tests">
              <img src="assets/icons/file-text.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Test Submissions</span>
            </a>

            <div class="nav-section-title">Communication</div>

            <a class="sidebar-item ${currentTab === 'messages' ? 'active' : ''}" data-tab="messages">
              <img src="assets/icons/mail-open.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Notices &amp; Messages</span>
            </a>

            <div class="nav-section-title">Account</div>

            <a class="sidebar-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
              <img src="assets/icons/monitor-cog.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Settings</span>
            </a>

            <a class="sidebar-item" id="teacherLogoutBtn">
              <img src="assets/icons/log-out.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Sign Out</span>
            </a>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="portal-content">
          <!-- Teacher Overview Banner -->
          <div class="content-card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
              <div style="display: flex; gap: 14px; align-items: center;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid var(--color-primary); flex-shrink: 0;">
                  ${currentTeacher.photo ? `<img src="${currentTeacher.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<img src="assets/icons/user.png" style="width:32px; height:32px;">`}
                </div>
                <div>
                  <h2 style="margin: 0; color: var(--color-primary); font-size: 19px;">
                    ${escapeHtml(currentTeacher.name)}
                  </h2>
                  <div style="font-size: 13px; color: var(--color-text-muted); margin-top: 2px;">
                    Teacher ID: <b>[${escapeHtml(currentTeacher.id)}]</b> &bull; ${escapeHtml(currentTeacher.title || 'Teacher')}
                  </div>
                </div>
              </div>

            </div>

            <!-- Teaching Load Badges -->
            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--color-border);">
              <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 6px;">
                Assigned Teaching Load:
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${currentAssignments.map(a => `
                  <div class="badge badge-light" style="padding: 5px 10px; font-size: 12px; border: 1px solid #cbd5e1;">
                    <b>${escapeHtml(a.class)}:</b> ${Array.isArray(a.subjects) && a.subjects.length > 0 ? a.subjects.map(escapeHtml).join(', ') : 'All Subjects'}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Active Tab Body -->
          <div id="teacherTabContainer"></div>
        </main>
      </div>
    `;

    // Sidebar Toggle
    const sidebar = document.getElementById('teacherSidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        isSidebarCollapsed = !isSidebarCollapsed;
        sidebar.classList.toggle('collapsed', isSidebarCollapsed);
      });
    }

    // Nav Item Click Handlers
    container.querySelectorAll('.sidebar-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.sidebar-item[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadTab(currentTab);
      });
    });

    // Logout
    const logoutBtn = document.getElementById('teacherLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.Auth) window.Auth.logout();
      });
    }
  }

  async function loadTab(tab) {
    const container = document.getElementById('teacherTabContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--color-text-muted);">Loading...</div>';

    switch (tab) {
      case 'grades':
        await renderGradesTab(container);
        break;
      case 'lessonPlans':
        await renderLessonPlansTab(container);
        break;
      case 'tests':
        await renderTestsTab(container);
        break;
      case 'messages':
        await renderMessagesTab(container);
        break;
      case 'settings':
        renderSettingsTab(container);
        break;
    }
  }

  // =========================================================================
  // 1. GRADE SHEET ENTRY
  // =========================================================================
  async function renderGradesTab(container) {
    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Class Grade Sheet Entry</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Select your assigned class and subject to view students and record scores for open periods.
            </div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <select id="teacherClassSelect" class="select-field" style="max-width: 170px;">
              ${currentAssignments.map(a => `<option value="${escapeHtml(a.class)}" ${a.class === selectedClass ? 'selected' : ''}>${escapeHtml(a.class)}</option>`).join('')}
            </select>

            <select id="teacherSubjectSelect" class="select-field" style="max-width: 200px;">
            </select>
          </div>
        </div>

        <!-- Open Periods Banner -->
        <div id="openPeriodsNotice" style="background: #f8fafc; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); margin: 12px 0 16px; font-size: 12.5px; display: flex; align-items: center; gap: 8px;">
          <img src="assets/icons/info.png" style="width: 16px; height: 16px;" alt="">
          <span>Currently Open Periods for Editing: <b id="openPeriodsText">...</b></span>
        </div>

        <!-- Students Grade Grid -->
        <div class="table-responsive">
          <table class="data-table" id="teacherGradeTable">
            <thead>
              <tr>
                <th style="min-width: 170px;">Student Name</th>
                <th style="width: 110px;">ID</th>
                <th class="p-col p1">1st P</th>
                <th class="p-col p2">2nd P</th>
                <th class="p-col p3">3rd P</th>
                <th class="p-col exam1">Exam 1</th>
                <th class="p-col p4">4th P</th>
                <th class="p-col p5">5th P</th>
                <th class="p-col p6">6th P</th>
                <th class="p-col exam2">Exam 2</th>
                <th style="width: 80px;">Action</th>
              </tr>
            </thead>
            <tbody id="gradeTableBody">
              <tr><td colspan="11" style="text-align:center; padding: 25px;">Loading student roster...</td></tr>
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 18px;">
          <button type="button" class="btn btn-primary" id="saveAllGradesBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/save-pen.png" style="width: 16px; height: 16px; filter: brightness(0) invert(1);" alt="">
            Save Grade Sheet Changes
          </button>
        </div>
      </div>
    `;

    document.getElementById('teacherClassSelect').onchange = (e) => onClassChange(e.target.value);
    document.getElementById('teacherSubjectSelect').onchange = (e) => onSubjectChange(e.target.value);
    document.getElementById('saveAllGradesBtn').onclick = () => submitAllGrades();

    updateSubjectDropdown();
    await loadRosterAndGrades();
  }

  function updateSubjectDropdown() {
    const subSelect = document.getElementById('teacherSubjectSelect');
    if (!subSelect) return;

    const assignment = currentAssignments.find(a => a.class === selectedClass);
    const subjects = (assignment && Array.isArray(assignment.subjects) && assignment.subjects.length > 0)
      ? assignment.subjects
      : ['General Mathematics', 'Reading', 'General Science', 'Social Studies'];

    subSelect.innerHTML = subjects.map(s => `
      <option value="${escapeHtml(s)}" ${s === selectedSubject ? 'selected' : ''}>${escapeHtml(s)}</option>
    `).join('');

    if (!subjects.includes(selectedSubject) && subjects.length > 0) {
      selectedSubject = subjects[0];
    }
  }

  async function onClassChange(newClass) {
    selectedClass = newClass;
    updateSubjectDropdown();
    await loadRosterAndGrades();
  }

  async function onSubjectChange(newSub) {
    selectedSubject = newSub;
    await loadRosterAndGrades();
  }

  async function loadRosterAndGrades() {
    updateOpenPeriodsUI();
    const tbody = document.getElementById('gradeTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 25px;">Loading students in ' + escapeHtml(selectedClass) + '...</td></tr>';

    const res = await API.callBackend('getStudentsByClass', { className: selectedClass }, 'Fetching class roster...');
    currentRoster = (res && res.success && Array.isArray(res.students)) ? res.students : [];

    if (currentRoster.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 30px; color: var(--color-text-muted);">No enrolled students found in ' + escapeHtml(selectedClass) + '.</td></tr>';
      return;
    }

    const isNursery = isNurserySection(selectedClass);

    tbody.innerHTML = currentRoster.map(s => {
      const year = s.academicYear || '2026-2027';
      const scores = (s.years && s.years[year]) || [];
      const subScore = scores.find(sc => String(sc.subject || '').trim().toLowerCase() === selectedSubject.toLowerCase()) || {};

      return `
        <tr data-student-id="${escapeHtml(s.id)}">
          <td><b>${escapeHtml(s.name)}</b></td>
          <td style="font-size: 12.5px; color: var(--color-text-dim);">[${escapeHtml(s.id)}]</td>
          ${renderScoreInput('p1', subScore.p1, isNursery)}
          ${renderScoreInput('p2', subScore.p2, isNursery)}
          ${renderScoreInput('p3', subScore.p3, isNursery)}
          ${renderScoreInput('exam1', subScore.exam1, isNursery)}
          ${renderScoreInput('p4', subScore.p4, isNursery)}
          ${renderScoreInput('p5', subScore.p5, isNursery)}
          ${renderScoreInput('p6', subScore.p6, isNursery)}
          ${renderScoreInput('exam2', subScore.exam2, isNursery)}
          <td>
            <button type="button" class="btn btn-light btn-sm" onclick="window.TeacherPanel.viewStudentReport('${escapeHtml(s.id)}')" title="Preview Student Report Card">
              <img src="assets/icons/file-text.png" style="width: 14px; height: 14px;" alt="">
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderScoreInput(periodKey, val, isNursery) {
    const isOpen = gradingPermissions[periodKey] !== false;
    const cleanVal = (val !== null && val !== undefined && val !== '') ? String(val) : '';

    if (isNursery) {
      return `
        <td style="text-align:center;">
          <select class="select-field score-input" data-period="${periodKey}" ${!isOpen ? 'disabled' : ''} style="width: 58px; padding: 4px; text-align:center; font-weight:700;">
            <option value="">—</option>
            <option value="A" ${cleanVal === 'A' ? 'selected' : ''}>A</option>
            <option value="B" ${cleanVal === 'B' ? 'selected' : ''}>B</option>
            <option value="C" ${cleanVal === 'C' ? 'selected' : ''}>C</option>
            <option value="D" ${cleanVal === 'D' ? 'selected' : ''}>D</option>
          </select>
        </td>
      `;
    }

    return `
      <td style="text-align:center;">
        <input type="number" min="0" max="100" class="input-field score-input" data-period="${periodKey}" value="${cleanVal}" ${!isOpen ? 'disabled' : ''} style="width: 62px; padding: 5px; text-align: center; font-weight: 600;" placeholder="—">
      </td>
    `;
  }

  function updateOpenPeriodsUI() {
    const textEl = document.getElementById('openPeriodsText');
    if (!textEl) return;
    const periods = [
      { k: 'p1', label: '1st P' }, { k: 'p2', label: '2nd P' }, { k: 'p3', label: '3rd P' }, { k: 'exam1', label: 'Exam 1' },
      { k: 'p4', label: '4th P' }, { k: 'p5', label: '5th P' }, { k: 'p6', label: '6th P' }, { k: 'exam2', label: 'Exam 2' }
    ];
    const open = periods.filter(p => gradingPermissions[p.k] !== false).map(p => p.label);
    textEl.textContent = open.length > 0 ? open.join(', ') : 'All periods currently closed by administration.';
  }

  async function submitAllGrades() {
    const rows = document.querySelectorAll('#gradeTableBody tr[data-student-id]');
    if (rows.length === 0) return;

    const gradesPayload = [];
    rows.forEach(tr => {
      const sId = tr.dataset.studentId;
      const sGrades = { studentId: sId };
      tr.querySelectorAll('.score-input').forEach(inp => {
        const period = inp.dataset.period;
        const val = inp.value.trim();
        sGrades[period] = val === '' ? '' : val;
      });
      gradesPayload.push(sGrades);
    });

    const res = await API.callBackend('teacherSubmitGrades', {
      teacherId: currentTeacher.id,
      className: selectedClass,
      subject: selectedSubject,
      academicYear: '2026-2027',
      grades: gradesPayload
    }, 'Saving grade values...');

    if (res && res.success) {
      API.toastSuccess();
      await loadRosterAndGrades();
    } else {
      API.toastNotification(res.message || 'Error recording grades.', true);
    }
  }

  // =========================================================================
  // 2. LESSON PLANS (WITH FILE UPLOAD: PDF, WORD, IMAGE)
  // =========================================================================
  async function renderLessonPlansTab(container) {
    const res = await API.callBackend('getLessonPlans', { filters: { teacherId: currentTeacher.id } }, 'Loading lesson plans...');
    const plans = (res && res.success && Array.isArray(res.plans)) ? res.plans : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Submitted Lesson Plans</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Repository of your lesson plans and uploaded curriculum files.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="openNewLessonPlanBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/file-plus.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            New Lesson Plan
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Lesson Title</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Attachment / File</th>
                <th>Submitted Date</th>
              </tr>
            </thead>
            <tbody>
              ${plans.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No lesson plans submitted yet.</td></tr>
              ` : plans.map(p => `
                <tr>
                  <td><b>${escapeHtml(p.title)}</b></td>
                  <td>${escapeHtml(p.class || p.className)}</td>
                  <td>${escapeHtml(p.subject)}</td>
                  <td>
                    ${p.attachmentUrl ? `
                      <a href="${p.attachmentUrl}" target="_blank" class="btn btn-light btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
                        <img src="assets/icons/download (2).png" style="width: 12px; height: 12px;" alt="">
                        ${escapeHtml(p.attachmentName || 'View Document')}
                      </a>
                    ` : '<span style="color:#94a3b8;">No Attachment</span>'}
                  </td>
                  <td>${escapeHtml(p.submittedAt || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('openNewLessonPlanBtn').onclick = () => openLessonPlanModal();
  }

  function openLessonPlanModal() {
    App.showModal({
      title: 'Submit New Lesson Plan',
      content: `
        <div style="font-size: 13.5px;">
          <div class="form-group">
            <label class="form-label" for="lpTitle">Lesson Title *</label>
            <input type="text" id="lpTitle" class="input-field" placeholder="e.g. Introduction to Plant Biology" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="lpClass">Class *</label>
              <select id="lpClass" class="select-field">
                ${currentAssignments.map(a => `<option value="${escapeHtml(a.class)}">${escapeHtml(a.class)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="lpSubject">Subject *</label>
              <input type="text" id="lpSubject" class="input-field" value="${escapeHtml(selectedSubject || 'General Science')}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="lpDetails">Objectives, Methodology &amp; Resources *</label>
            <textarea id="lpDetails" class="textarea-field" rows="3" placeholder="Outline specific learning outcomes and teaching strategy..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="lpFile">Upload Lesson Document (PDF, Word, Image)</label>
            <input type="file" id="lpFile" class="input-field" accept=".pdf,.doc,.docx,image/*">
            <div class="form-hint">Supports PDF lesson plans, Word docs, or scanned handwritten notes.</div>
          </div>
        </div>
      `,
      confirmText: 'Submit Lesson Plan',
      onConfirm: async () => {
        const title = document.getElementById('lpTitle').value.trim();
        const cls = document.getElementById('lpClass').value;
        const sub = document.getElementById('lpSubject').value.trim();
        const details = document.getElementById('lpDetails').value.trim();
        const file = document.getElementById('lpFile').files[0];

        if (!title || !details) {
          API.toastNotification('Title and lesson details are required.', true);
          return;
        }

        let fileDataUrl = '';
        let fileName = '';
        if (file) {
          fileDataUrl = await readFileAsDataUrl(file);
          fileName = file.name;
        }

        const res = await API.callBackend('saveLessonPlan', {
          plan: {
            title: title,
            class: cls,
            subject: sub,
            details: details,
            attachmentUrl: fileDataUrl,
            attachmentName: fileName,
            teacherId: currentTeacher.id,
            teacherName: currentTeacher.name
          }
        }, 'Submitting lesson plan...');

        if (res && res.success) {
          API.toastSuccess();
          if (currentTab === 'lessonPlans') loadTab('lessonPlans');
        } else {
          API.toastNotification(res.message || 'Submission failed.', true);
        }
      }
    });
  }

  // =========================================================================
  // 3. TEST SUBMISSIONS (EXAMS & TESTS TO ADMIN)
  // =========================================================================
  async function renderTestsTab(container) {
    const res = await API.callBackend('getTeacherTests', {}, 'Loading test submissions...');
    const tests = (res && res.success && Array.isArray(res.tests)) ? res.tests : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Exam &amp; Test Submissions to Administration</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Submit periodic and semester test drafts for administrative review and print clearance.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="openNewTestBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/cloud-upload.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Submit New Test Draft
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Test Title</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Period</th>
                <th>Document File</th>
                <th>Admin Status</th>
                <th>Date Submitted</th>
              </tr>
            </thead>
            <tbody>
              ${tests.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No tests submitted for administrative review yet.</td></tr>
              ` : tests.map(t => `
                <tr>
                  <td><b>${escapeHtml(t.title)}</b></td>
                  <td>${escapeHtml(t.className)}</td>
                  <td>${escapeHtml(t.subject)}</td>
                  <td>${escapeHtml(t.period)}</td>
                  <td>
                    ${t.attachmentUrl ? `
                      <a href="${t.attachmentUrl}" target="_blank" class="btn btn-light btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
                        <img src="assets/icons/file-text.png" style="width: 12px; height: 12px;" alt="">
                        View Paper
                      </a>
                    ` : '<span style="color:#94a3b8;">No File Attached</span>'}
                  </td>
                  <td>
                    <span class="badge ${t.status === 'Approved' ? 'badge-success' : t.status === 'Printed' ? 'badge-info' : 'badge-warning'}">
                      ${escapeHtml(t.status || 'Submitted')}
                    </span>
                  </td>
                  <td>${escapeHtml(t.submittedAt || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('openNewTestBtn').onclick = () => openTestSubmitModal();
  }

  function openTestSubmitModal() {
    App.showModal({
      title: 'Submit Examination / Test Draft to Admin',
      content: `
        <div style="font-size: 13.5px;">
          <div class="form-group">
            <label class="form-label" for="testTitle">Test Title *</label>
            <input type="text" id="testTitle" class="input-field" placeholder="e.g. 1st Period Mathematics Evaluation" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="testClass">Class *</label>
              <select id="testClass" class="select-field">
                ${currentAssignments.map(a => `<option value="${escapeHtml(a.class)}">${escapeHtml(a.class)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="testSubject">Subject *</label>
              <input type="text" id="testSubject" class="input-field" value="${escapeHtml(selectedSubject || 'Mathematics')}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="testPeriod">Evaluation Period *</label>
            <select id="testPeriod" class="select-field">
              <option value="1st Period">1st Period</option>
              <option value="2nd Period">2nd Period</option>
              <option value="3rd Period">3rd Period</option>
              <option value="1st Semester Exam">1st Semester Exam</option>
              <option value="4th Period">4th Period</option>
              <option value="5th Period">5th Period</option>
              <option value="6th Period">6th Period</option>
              <option value="2nd Semester Exam">2nd Semester Exam</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="testDetails">Instructions &amp; Teacher Notes</label>
            <textarea id="testDetails" class="textarea-field" rows="2" placeholder="e.g. Total Marks: 50, Time Allowed: 1 Hour..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="testFile">Upload Test Question Paper (PDF, Word, Image) *</label>
            <input type="file" id="testFile" class="input-field" accept=".pdf,.doc,.docx,image/*" required>
            <div class="form-hint">Upload the actual question sheet for administrative review and print clearance.</div>
          </div>
        </div>
      `,
      confirmText: 'Submit Test Paper',
      onConfirm: async () => {
        const title = document.getElementById('testTitle').value.trim();
        const cls = document.getElementById('testClass').value;
        const sub = document.getElementById('testSubject').value.trim();
        const period = document.getElementById('testPeriod').value;
        const details = document.getElementById('testDetails').value.trim();
        const file = document.getElementById('testFile').files[0];

        if (!title || !file) {
          API.toastNotification('Test title and question paper file are required.', true);
          return;
        }

        const fileDataUrl = await readFileAsDataUrl(file);

        const res = await API.callBackend('submitTeacherTest', {
          test: {
            title: title,
            className: cls,
            subject: sub,
            period: period,
            details: details,
            attachmentUrl: fileDataUrl,
            attachmentName: file.name
          }
        }, 'Submitting test to admin...');

        if (res && res.success) {
          API.toastSuccess();
          if (currentTab === 'tests') loadTab('tests');
        } else {
          API.toastNotification(res.message || 'Error submitting test.', true);
        }
      }
    });
  }

  // =========================================================================
  // 4. MESSAGES TAB
  // =========================================================================
  async function renderMessagesTab(container) {
    const res = await API.callBackend('getMessages', {}, 'Fetching notices...');
    const messages = (res && res.success && Array.isArray(res.messages)) ? res.messages : [];

    container.innerHTML = `
      <div class="content-card">
        <h3 class="card-title" style="margin-bottom: 16px;">Staff Notices &amp; Administrative Communications</h3>
        ${messages.length === 0 ? `
          <div style="text-align: center; padding: 30px; color: var(--color-text-muted); font-size: 14px;">
            No announcements broadcasted at this time.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${messages.map(m => `
              <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 18px; background: var(--color-surface);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="color: var(--color-primary); font-size: 15px;">${escapeHtml(m.subject || 'Staff Notice')}</strong>
                  <span style="font-size: 12px; color: var(--color-text-muted);">${escapeHtml(m.sentAt || '')}</span>
                </div>
                <div style="font-size: 13.5px; color: var(--color-text); line-height: 1.5;">${escapeHtml(m.body || '')}</div>
                <div style="margin-top: 8px; font-size: 12px; color: var(--color-text-dim);">From: ${escapeHtml(m.senderName || 'School Administration')}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // =========================================================================
  // 5. SETTINGS TAB
  // =========================================================================
  function renderSettingsTab(container) {
    container.innerHTML = `
      <div style="max-width: 600px;">
        <div class="content-card" style="margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Teacher Profile &amp; Contact</h3>
          
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="teacherSettingName" class="input-field" value="${escapeHtml(currentTeacher.name)}">
          </div>

          <div class="form-group">
            <label class="form-label">Teacher ID</label>
            <input type="text" class="input-field" value="[${escapeHtml(currentTeacher.id)}]" disabled>
          </div>

          <div class="form-group">
            <label class="form-label">Contact Phone</label>
            <input type="text" id="teacherSettingPhone" class="input-field" value="${escapeHtml(currentTeacher.phone || '')}" placeholder="+231-...">
          </div>

          <div class="form-group">
            <label class="form-label">Profile Photo (Upload / Camera)</label>
            <input type="file" id="teacherPhotoInput" class="input-field" accept="image/*">
          </div>

          <button type="button" class="btn btn-primary" id="saveTeacherProfileBtn">Save Profile Details</button>
        </div>

        <div class="content-card" style="margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Security &amp; Password</h3>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" id="tNewPassword" class="input-field" placeholder="Enter new password (min. 4 characters)">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input type="password" id="tConfirmPassword" class="input-field" placeholder="Confirm new password">
          </div>
          <button type="button" class="btn btn-primary" id="saveTeacherPassBtn">Update Password</button>
        </div>

        <div class="content-card">
          <h3 class="card-title" style="margin-bottom: 12px;">Mobile Application (PWA)</h3>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 14px;">
            Install the app directly on your smartphone for offline grade sheets and attendance.
          </p>
          <button type="button" class="btn btn-light" id="teacherPwaBtn" style="display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/download (2).png" style="width: 16px; height: 16px;" alt="">
            Install App to Device
          </button>
        </div>

        <div class="content-card" style="margin-top: 20px;">
          <h3 class="card-title" style="margin-bottom: 12px;">Account Session</h3>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 14px;">
            Sign out of your teacher portal session on this device.
          </p>
          <button type="button" class="btn btn-danger" id="teacherSettingsSignOutBtn" style="display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/log-out.png" style="width: 16px; height: 16px; filter: brightness(0) invert(1);" alt="">
            Sign Out
          </button>
        </div>
      </div>
    `;

    document.getElementById('saveTeacherProfileBtn').onclick = async () => {
      const name = document.getElementById('teacherSettingName').value.trim();
      const phone = document.getElementById('teacherSettingPhone').value.trim();
      const photoFile = document.getElementById('teacherPhotoInput').files[0];

      let photoBase64 = currentTeacher.photo || '';
      if (photoFile) {
        photoBase64 = await readFileAsDataUrl(photoFile);
      }

      const res = await API.callBackend('saveTeacher', {
        teacher: {
          id: currentTeacher.id,
          name: name,
          phone: phone,
          photo: photoBase64,
          assignments: currentAssignments
        }
      }, 'Saving profile...');

      if (res && res.success) {
        currentTeacher.name = name;
        currentTeacher.phone = phone;
        if (photoBase64) currentTeacher.photo = photoBase64;
        API.toastSuccess();
      } else {
        API.toastNotification(res.message || 'Error updating profile.', true);
      }
    };

    document.getElementById('saveTeacherPassBtn').onclick = async () => {
      const p1 = document.getElementById('tNewPassword').value;
      const p2 = document.getElementById('tConfirmPassword').value;

      if (!p1 || p1.length < 4) {
        API.toastNotification('Password must be at least 4 characters.', true);
        return;
      }
      if (p1 !== p2) {
        API.toastNotification('Passwords do not match.', true);
        return;
      }

      const res = await API.callBackend('saveTeacher', {
        teacher: { id: currentTeacher.id, password: p1, name: currentTeacher.name }
      }, 'Changing password...');

      if (res && res.success) {
        API.toastSuccess();
        document.getElementById('tNewPassword').value = '';
        document.getElementById('tConfirmPassword').value = '';
      } else {
        API.toastNotification(res.message || 'Error updating password.', true);
      }
    };

    document.getElementById('teacherPwaBtn').onclick = () => {
      const btn = document.getElementById('installAppBtn');
      if (btn) btn.click();
      else API.toastNotification('App install ready via browser menu (Add to Home Screen).');
    };

    const signOutBtn = document.getElementById('teacherSettingsSignOutBtn');
    if (signOutBtn) {
      signOutBtn.onclick = () => {
        if (window.Auth) window.Auth.logout();
      };
    }
  }

  async function viewStudentReport(studentId) {
    const res = await API.callBackend('getReportCard', { studentId: studentId }, 'Loading student report...');
    if (res && res.success && res.reportCard) {
      App.showModal({
        title: 'Student Cumulative Report Card',
        content: '<div id="teacherRcMount"></div>',
        confirmText: 'Done',
        cancelText: 'Close'
      });
      ReportCard.render(res.reportCard, '#teacherRcMount');
    } else {
      API.toastNotification(res.message || 'Unable to load report card.', true);
    }
  }

  function isNurserySection(className) {
    if (!className) return false;
    const str = String(className).toLowerCase();
    return ['nursery', 'k-1', 'k-2', 'kg-1', 'kg-2', 'kindergarten', 'pre-k'].some(k => str.includes(k));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    mount: mount,
    viewStudentReport: viewStudentReport
  };
})();
