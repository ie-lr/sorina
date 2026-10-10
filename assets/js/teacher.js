/**
 * teacher.js
 * -----------------------------------------------------------------------
 * Teacher Portal Module
 * 
 * Features:
 * - Collapsible royal blue left sidebar navigation matching official design.
 * - Class & Subject grade entry scoped to teacher assignments.
 * - Lesson Plan submission with file upload (PDF, Word, Image).
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
  let curriculumMap = {};
  let currentTab = 'grades';
  let isSidebarCollapsed = false;

  async function mount(container, user) {
    currentTeacher = user;
    currentTab = 'grades';

    await refreshTeacherProfile();   // always load the LIVE teacher record

    if (currentAssignments.length > 0) {
      selectedClass = currentAssignments[0].class || '';
      selectedSubject = subjectsForClass(selectedClass)[0] || '';
    }

    const pRes = await API.callBackend('getPermissions', {}, 'Loading permissions...');
    gradingPermissions = (pRes && pRes.success) ? pRes.permissions : {};

    renderPortalLayout(container);
    await loadTab(currentTab);

    document.removeEventListener('visibilitychange', onTeacherReturn);
    document.addEventListener('visibilitychange', onTeacherReturn);
  }

  async function refreshTeacherProfile() {
    const r = await API.callBackend('getTeachers', {}, 'Loading your assignments...');
    const list = (r && r.success && Array.isArray(r.teachers)) ? r.teachers : [];
    const me = list.find(t => String(t.id).toLowerCase() === String(currentTeacher.id).toLowerCase()) || currentTeacher;
    currentTeacher.academicYear = me.academicYear || currentTeacher.academicYear || '2026-2027';
    currentTeacher.name = me.name || currentTeacher.name;
    currentTeacher.title = me.title || currentTeacher.title;
    currentAssignments = (me.assignments || []).filter(a => !a.academicYear || String(a.academicYear) === String(currentTeacher.academicYear));
    const cRes = await API.callBackend('getCurriculumSubjects', {}, 'Loading class subjects...');
    curriculumMap = (cRes && cRes.success && cRes.curriculum) ? cRes.curriculum : {};
    lastProfileRefresh = Date.now();
  }

  async function onTeacherReturn() {
    if (document.visibilityState !== 'visible' || !currentTeacher) return;
    if (Date.now() - lastProfileRefresh < 15000) return;
    const before = JSON.stringify(currentAssignments) + currentTeacher.academicYear;
    await refreshTeacherProfile();
    if (before !== JSON.stringify(currentAssignments) + currentTeacher.academicYear) {
      if (!currentAssignments.some(a => a.class === selectedClass)) selectedClass = (currentAssignments[0] || {}).class || '';
      selectedSubject = subjectsForClass(selectedClass)[0] || '';
      API.toastNotification('Your class/subject assignments were updated by the administrator.');
      await loadTab(currentTab);
    }
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

            <a class="sidebar-item" id="teacherLogoutBtn" data-action="logout" role="button" tabindex="0" style="cursor: pointer;">
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
                    Teacher ID: <b>[${escapeHtml(currentTeacher.id)}]</b> &bull; ${escapeHtml(currentTeacher.title || 'Teacher')} &bull; Academic Year: <b>${escapeHtml(String(currentTeacher.academicYear).replace('-', '–'))}</b>
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

  // Subjects this teacher may handle in a class: strictly the ones assigned to them.
  function subjectsForClass(cls) {
    const key = Object.keys(curriculumMap).find(k => String(k).trim().toLowerCase() === String(cls).trim().toLowerCase());
    return key && Array.isArray(curriculumMap[key]) ? curriculumMap[key] : [];
  }

  function updateSubjectDropdown() {
    const subSelect = document.getElementById('teacherSubjectSelect');
    if (!subSelect) return;

    const subjects = subjectsForClass(selectedClass);

    subSelect.innerHTML = subjects.length
      ? subjects.map(s => `
      <option value="${escapeHtml(s)}" ${s === selectedSubject ? 'selected' : ''}>${escapeHtml(s)}</option>
    `).join('')
      : '<option value="">No subjects assigned</option>';

    if (!subjects.includes(selectedSubject)) {
      selectedSubject = subjects[0] || '';
    }
    subSelect.value = selectedSubject;
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

    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 25px;">Loading grade sheet for ' + escapeHtml(selectedClass) + '...</td></tr>';

    if (!selectedSubject) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 30px; color: var(--color-text-muted);">No subject is assigned to you for ' + escapeHtml(selectedClass) + '. Please contact the administrator.</td></tr>';
      return;
    }

    const res = await API.callBackend('getClassGradeSheet', {
      className: selectedClass,
      subject: selectedSubject,
      academicYear: currentTeacher.academicYear || '2026-2027'
    }, 'Fetching class grade sheet...');

    currentRoster = (res && res.success && Array.isArray(res.sheet)) ? res.sheet : [];

    if (currentRoster.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 30px; color: var(--color-text-muted);">No enrolled students found in ' + escapeHtml(selectedClass) + '.</td></tr>';
      return;
    }

    const isNursery = isNurserySection(selectedClass);

    tbody.innerHTML = currentRoster.map(row => {
      const sId = row.studentId;
      const sName = row.studentName;
      const scores = row.scores || {};
      const version = row.version || 1;

      return `
        <tr data-student-id="${escapeHtml(sId)}" data-version="${version}">
          <td><b>${escapeHtml(sName)}</b></td>
          <td style="font-size: 12.5px; color: var(--color-text-dim);">[${escapeHtml(sId)}]</td>
          ${renderScoreInput('p1', scores.p1, isNursery)}
          ${renderScoreInput('p2', scores.p2, isNursery)}
          ${renderScoreInput('p3', scores.p3, isNursery)}
          ${renderScoreInput('exam1', scores.exam1, isNursery)}
          ${renderScoreInput('p4', scores.p4, isNursery)}
          ${renderScoreInput('p5', scores.p5, isNursery)}
          ${renderScoreInput('p6', scores.p6, isNursery)}
          ${renderScoreInput('exam2', scores.exam2, isNursery)}
          <td>
            <button type="button" class="btn btn-light btn-sm" onclick="window.TeacherPanel.viewStudentReport('${escapeHtml(sId)}')" title="Preview Student Report Card">
              <img src="assets/icons/file-text.png" style="width: 14px; height: 14px;" alt="">
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderScoreInput(periodKey, val, isNursery) {
    const isOpen = gradingPermissions[periodKey] === true;
    const cleanVal = (val !== null && val !== undefined && val !== '') ? String(val) : '';

    if (isNursery) {
      return `
        <td style="text-align:center;">
          <select class="select-field score-input ${!isOpen ? 'period-locked' : ''}" data-period="${periodKey}" data-original-val="${escapeHtml(cleanVal)}" ${!isOpen ? 'disabled title="Period locked - view only"' : ''} style="width: 58px; padding: 4px; text-align:center; font-weight:700;">
            <option value="">—</option>
            <option value="A" ${cleanVal === 'A' ? 'selected' : ''}>A</option>
            <option value="B" ${cleanVal === 'B' ? 'selected' : ''}>B</option>
            <option value="C" ${cleanVal === 'C' ? 'selected' : ''}>C</option>
          </select>
        </td>
      `;
    }

    return `
      <td style="text-align:center;">
        <input type="number" min="0" max="100" class="input-field score-input ${!isOpen ? 'period-locked' : ''}" data-period="${periodKey}" data-original-val="${escapeHtml(cleanVal)}" value="${cleanVal}" ${!isOpen ? 'disabled title="Period locked - view only"' : ''} style="width: 62px; padding: 5px; text-align: center; font-weight: 600;" placeholder="—">
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
    const open = periods.filter(p => gradingPermissions[p.k] === true).map(p => p.label);
    textEl.textContent = open.length > 0 ? open.join(', ') : 'All periods currently closed by administration.';
  }

  async function submitAllGrades() {
    const rows = document.querySelectorAll('#gradeTableBody tr[data-student-id]');
    if (rows.length === 0) return;

    const gradesPayload = [];
    rows.forEach(tr => {
      const sId = tr.dataset.studentId;
      const baseVersion = Number(tr.dataset.version) || 1;
      const changes = {};
      let hasChanges = false;
      tr.querySelectorAll('.score-input').forEach(inp => {
        const period = inp.dataset.period;
        const originalVal = inp.dataset.originalVal || '';
        const currentVal = inp.value.trim();
        if (currentVal !== originalVal) {
          changes[period] = currentVal === '' ? '' : currentVal;
          hasChanges = true;
        }
      });
      if (hasChanges) {
        gradesPayload.push({
          studentId: sId,
          baseVersion: baseVersion,
          changes: changes
        });
      }
    });

    if (gradesPayload.length === 0) {
      API.toastNotification('No changes detected to save.');
      return;
    }

    const res = await API.callBackend('teacherSubmitGrades', {
      teacherId: currentTeacher.id,
      className: selectedClass,
      subject: selectedSubject,
      academicYear: currentTeacher.academicYear || '2026-2027',
      grades: gradesPayload
    }, 'Saving grade values...');

    if (res && res.conflict) {
      API.toastNotification(res.message || 'Another user modified this grade sheet. Reloading latest grades...', true);
      await loadRosterAndGrades();
      return;
    }

    if (res && res.success) {
      const failed = (res.results || []).filter(r => r.saved === false);
      if (!res.savedCount || failed.length || (res.closedPeriods && res.closedPeriods.length)) {
        const why = failed.length
          ? failed.map(f => `${f.studentId}: ${f.reason}`).join(' | ')
          : (res.closedPeriods && res.closedPeriods.length ? 'Period(s) closed by the administrator: ' + res.closedPeriods.join(', ').toUpperCase() : 'Nothing was saved.');
        API.toastNotification((res.savedCount ? `Saved ${res.savedCount}. ` : 'Not saved. ') + why, true);
      } else {
        API.toastSuccess();
      }
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
              <select id="lpSubject" class="select-field">
                ${(currentAssignments.find(a => a.class === clsForLesson())?.subjects || [selectedSubject]).filter(Boolean).map(s => `<option value="${escapeHtml(s)}" ${s === selectedSubject ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
              </select>
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
        if (!isAssignedClassAndSubject(cls, sub)) {
          API.toastNotification('You can only submit a lesson plan for your assigned class and subject.', true);
          return;
        }
        if (file && file.size > 20 * 1024 * 1024) {
          API.toastNotification('Attachment is too large. Maximum size is 5 MB.', true);
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
            attachmentData: fileDataUrl,
            attachmentName: fileName,
            teacherId: currentTeacher.id,
            teacherName: currentTeacher.name,
            academicYear: currentTeacher.academicYear || '2026-2027'
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
  // 3. MESSAGES TAB
  // =========================================================================
  async function renderMessagesTab(container) {
    const res = await API.callBackend('getMessages', {teacherId: currentTeacher.id, role:'teacher'}, 'Fetching notices...');
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
                <div style="font-size: 13.5px; color: var(--color-text); line-height: 1.5;">${escapeHtml(m.body || '')}</div>${m.recipientId?`<div style="font-size:12px;margin-top:5px;color:#475569;">Direct to ID: <b>${escapeHtml(m.recipientId)}</b></div>`:''}${m.attachmentUrl?`<div style="margin-top:8px;"><a class="btn btn-light btn-sm" href="${escapeHtml(m.attachmentUrl)}" target="_blank">View Attachment</a></div>`:''}
                <div style="margin-top: 8px; font-size: 12px; color: var(--color-text-dim);">From: ${escapeHtml(m.senderName || 'School Administration')}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // =========================================================================
  // 4. SETTINGS TAB
  // =========================================================================
  function renderSettingsTab(container) {
    container.innerHTML = `
      <div style="max-width: 600px;">
        <div class="content-card" style="margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Teacher Account Information</h3>
          <div class="form-group"><label class="form-label">Full Name</label><input type="text" class="input-field" value="${escapeHtml(currentTeacher.name)}" disabled></div>
          <div class="form-group"><label class="form-label">Teacher ID</label><input type="text" class="input-field" value="[${escapeHtml(currentTeacher.id)}]" disabled></div>
          <div class="form-group"><label class="form-label">Position</label><input type="text" class="input-field" value="${escapeHtml(currentTeacher.title || 'Teacher')}" disabled></div>
          <div style="padding:12px;background:#f8fafc;border:1px solid var(--color-border);border-radius:8px;color:#64748b;font-size:13px;">Your name, phone number, and profile picture are managed by the school administration and cannot be changed from the teacher dashboard.</div>
        </div>

        <div class="content-card" style="margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Security &amp; Password</h3>
          <div class="form-group"><label class="form-label">New Password</label><input type="password" id="tNewPassword" class="input-field" placeholder="Enter new password (min. 4 characters)"></div>
          <div class="form-group"><label class="form-label">Confirm Password</label><input type="password" id="tConfirmPassword" class="input-field" placeholder="Confirm password"></div>
          <button type="button" class="btn btn-primary" id="saveTeacherPassBtn">Update Password</button>
        </div>

        <div class="content-card">
          <h3 class="card-title" style="margin-bottom: 12px;">Account Session</h3>
          <button type="button" class="btn btn-danger" id="teacherSettingsSignOutBtn" data-action="logout">Sign Out</button>
        </div>
      </div>`;

    document.getElementById('saveTeacherPassBtn').onclick = async () => {
      const p1 = document.getElementById('tNewPassword').value;
      const p2 = document.getElementById('tConfirmPassword').value;
      if (!p1 || p1.length < 4) { API.toastNotification('Password must be at least 4 characters.', true); return; }
      if (p1 !== p2) { API.toastNotification('Passwords do not match.', true); return; }
      const res = await API.callBackend('saveTeacher', { teacher: { id: currentTeacher.id, password: p1, name: currentTeacher.name } }, 'Changing password...');
      if (res && res.success) { API.toastSuccess(); document.getElementById('tNewPassword').value=''; document.getElementById('tConfirmPassword').value=''; }
      else API.toastNotification(res.message || 'Error updating password.', true);
    };
  }

  async function viewStudentReport(studentId) {
    const student = currentRoster.find(s => String(s.id) === String(studentId));
    if (!student) {
      API.toastNotification('Student record is no longer available in your assigned class.', true);
      return;
    }

      const res = await API.callBackend('getReportCard', { studentId: studentId, academicYear: currentTeacher.academicYear }, 'Loading student report...');    if (!(res && res.success && res.reportCard)) {
      API.toastNotification((res && res.message) || 'Unable to load this student report.', true);
      return;
    }

    App.showModal({
      title: `Student Report — ${student.name}`,
      content: '<div id="teacherStudentReportMount" style="max-height:70vh;overflow:auto;"></div>',
      confirmText: 'Close',
      onConfirm: () => {}
    });

    setTimeout(() => {
      const mount = document.getElementById('teacherStudentReportMount');
      if (mount && window.ReportCard && typeof ReportCard.render === 'function') {
        ReportCard.render(res.reportCard, mount);
      }
    }, 50);
  }

  function clsForLesson() {
    return selectedClass || (currentAssignments[0] && currentAssignments[0].class) || '';
  }

  function isAssignedClassAndSubject(className, subject) {
    const a = currentAssignments.find(x => String(x.class).trim() === String(className).trim());
    return !!a && Array.isArray(a.subjects) && a.subjects.some(x => String(x).trim().toLowerCase() === String(subject).trim().toLowerCase());
  }

  function isNurserySection(className) {
  const s = String(className || '').trim().toLowerCase().replace(/[\s\-_]+/g, '');
  if (!s) return false;
  return s.startsWith('nursery') || s.startsWith('kindergarten') ||
         ['k1', 'k2', 'kg1', 'kg2', 'prek', 'daycare', 'creche', 'abc'].includes(s);
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
