/**
 * teacher.js
 * -----------------------------------------------------------------------
 * Teacher portal module.
 * Loaded ONLY after verified teacher authentication (Section 12.2).
 * Scoped strictly to teacher's class and subject assignments.
 * -----------------------------------------------------------------------
 */

window.TeacherPanel = (function () {
  let currentTeacher = null;
  let currentAssignments = [];
  let selectedClass = '';
  let selectedSubject = '';
  let currentRoster = [];
  let gradingPermissions = {};

  async function mount(container, user) {
    currentTeacher = user;
    currentAssignments = user.assignments || [];
    if (currentAssignments.length > 0) {
      selectedClass = currentAssignments[0].class || '';
      selectedSubject = (currentAssignments[0].subjects && currentAssignments[0].subjects[0]) || '';
    }

    // Fetch open period permissions
    const pRes = await API.callBackend('getPermissions');
    gradingPermissions = (pRes && pRes.success) ? pRes.permissions : {};

    renderTeacherShell(container);
    await loadRosterAndGrades();
  }

  function renderTeacherShell(container) {
    container.innerHTML = `
      <div class="dashboard-container">
        <!-- Teacher Profile Card -->
        <div class="content-card" style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <h2 style="margin: 0; color: var(--color-primary); font-size: 20px;">
                Welcome, ${escapeHtml(currentTeacher.name)}
              </h2>
              <div style="font-size: 13px; color: var(--color-text-muted); margin-top: 4px;">
                Teacher ID: <b>${escapeHtml(currentTeacher.id)}</b> | Title: ${escapeHtml(currentTeacher.title || 'Teacher')}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.TeacherPanel.openLessonPlanModal()">
              📝 Submit Lesson Plan
            </button>
          </div>

          <!-- Assignment Badges -->
          <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--color-border);">
            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 6px;">
              Your Assigned Teaching Load:
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${currentAssignments.map(a => `
                <div class="badge badge-light" style="padding: 6px 10px; font-size: 12.5px;">
                  🏫 <b>${escapeHtml(a.class)}:</b> ${Array.isArray(a.subjects) ? a.subjects.map(escapeHtml).join(', ') : 'All'}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Grade Entry Section -->
        <div class="content-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-title">Class Grade Sheet Entry</h3>
              <div style="font-size: 13px; color: var(--color-text-muted);">
                Select your assigned class and subject to view students and enter scores for open periods.
              </div>
            </div>

            <!-- Scoped Class & Subject Pickers -->
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <select id="teacherClassSelect" class="select-field" style="max-width: 180px; margin: 0;" onchange="window.TeacherPanel.onClassChange(this.value)">
                ${currentAssignments.map(a => `<option value="${escapeHtml(a.class)}" ${a.class === selectedClass ? 'selected' : ''}>${escapeHtml(a.class)}</option>`).join('')}
              </select>

              <select id="teacherSubjectSelect" class="select-field" style="max-width: 220px; margin: 0;" onchange="window.TeacherPanel.onSubjectChange(this.value)">
                <!-- Populated via updateSubjectDropdown -->
              </select>
            </div>
          </div>

          <!-- Open Periods Banner -->
          <div id="openPeriodsNotice" style="background: #f8fafc; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); margin-bottom: 16px; font-size: 12.5px; display: flex; align-items: center; gap: 8px;">
            <span>ℹ️</span>
            <span>Currently Open Periods for Editing: <b id="openPeriodsText">...</b></span>
          </div>

          <!-- Students Grade Grid -->
          <div class="table-responsive">
            <table class="data-table" id="teacherGradeTable">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>1st P.</th>
                  <th>2nd P.</th>
                  <th>3rd P.</th>
                  <th>Sem 1 Exam</th>
                  <th>4th P.</th>
                  <th>5th P.</th>
                  <th>6th P.</th>
                  <th>Sem 2 Exam</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="teacherGradeTableBody">
                <!-- Injected via renderRosterRows -->
              </tbody>
            </table>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn-primary" id="saveGradesBtn" onclick="window.TeacherPanel.submitAllGrades()">
              💾 Save All Grades
            </button>
          </div>
        </div>

        <!-- Submitted Lesson Plans Section -->
        <div class="content-card" style="margin-top: 20px;">
          <div class="card-header-row">
            <h3 class="card-title">My Submitted Lesson Plans</h3>
          </div>
          <div id="lessonPlansContainer">
            <!-- Loaded dynamically -->
          </div>
        </div>
      </div>
    `;

    updateSubjectDropdown();
    updateOpenPeriodsNotice();
    loadLessonPlans();
  }

  function updateSubjectDropdown() {
    const subSelect = document.getElementById('teacherSubjectSelect');
    if (!subSelect) return;

    const assignment = currentAssignments.find(a => a.class === selectedClass);
    const subjects = (assignment && Array.isArray(assignment.subjects)) ? assignment.subjects : [];

    subSelect.innerHTML = subjects.map(s => `
      <option value="${escapeHtml(s)}" ${s === selectedSubject ? 'selected' : ''}>${escapeHtml(s)}</option>
    `).join('');

    if (subjects.length > 0 && !subjects.includes(selectedSubject)) {
      selectedSubject = subjects[0];
    }
  }

  function updateOpenPeriodsNotice() {
    const el = document.getElementById('openPeriodsText');
    if (!el) return;

    const openList = [];
    const pMap = {
      p1: '1st Period', p2: '2nd Period', p3: '3rd Period', exam1: '1st Sem Exam',
      p4: '4th Period', p5: '5th Period', p6: '6th Period', exam2: '2nd Sem Exam'
    };

    Object.keys(pMap).forEach(k => {
      if (gradingPermissions[k]) openList.push(pMap[k]);
    });

    el.textContent = openList.length > 0 ? openList.join(', ') : 'None (All periods currently locked by Admin)';
  }

  async function onClassChange(newClass) {
    selectedClass = newClass;
    updateSubjectDropdown();
    await loadRosterAndGrades();
  }

  async function onSubjectChange(newSubject) {
    selectedSubject = newSubject;
    await loadRosterAndGrades();
  }

  async function loadRosterAndGrades() {
    const tbody = document.getElementById('teacherGradeTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Loading student roster...</td></tr>';

    if (!selectedClass || !selectedSubject) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Please select an assigned class and subject.</td></tr>';
      return;
    }

    const res = await API.callBackend('getStudentsByClass', { className: selectedClass });
    currentRoster = (res && res.success) ? res.students : [];

    if (currentRoster.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No active students found in ${escapeHtml(selectedClass)}.</td></tr>`;
      return;
    }

    renderRosterRows();
  }

  function renderRosterRows() {
    const tbody = document.getElementById('teacherGradeTableBody');
    if (!tbody) return;

    const isNursery = selectedClass.toLowerCase().includes('nursery');

    tbody.innerHTML = currentRoster.map(s => {
      return `
        <tr data-student-id="${escapeHtml(s.id)}">
          <td><b>${escapeHtml(s.id)}</b></td>
          <td>${escapeHtml(s.name)}</td>
          ${renderPeriodInput(s.id, 'p1', isNursery)}
          ${renderPeriodInput(s.id, 'p2', isNursery)}
          ${renderPeriodInput(s.id, 'p3', isNursery)}
          ${renderPeriodInput(s.id, 'exam1', isNursery)}
          ${renderPeriodInput(s.id, 'p4', isNursery)}
          ${renderPeriodInput(s.id, 'p5', isNursery)}
          ${renderPeriodInput(s.id, 'p6', isNursery)}
          ${renderPeriodInput(s.id, 'exam2', isNursery)}
          <td>
            <button class="btn btn-light btn-sm" onclick="window.TeacherPanel.viewStudentReport('${escapeHtml(s.id)}')">View Card</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPeriodInput(studentId, periodKey, isNursery) {
    const isOpen = gradingPermissions[periodKey] === true;
    const disabledAttr = isOpen ? '' : 'disabled title="Period closed by Admin"';
    const bgStyle = isOpen ? 'background: #fff;' : 'background: #f1f5f9; cursor: not-allowed;';

    if (isNursery) {
      // Nursery letter scale A/B/C
      return `
        <td>
          <select class="select-field grade-input" data-period="${periodKey}" ${disabledAttr} style="padding: 4px 6px; font-size: 12px; margin: 0; min-width: 55px; ${bgStyle}">
            <option value="">—</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </td>
      `;
    }

    return `
      <td>
        <input type="number" min="0" max="100" class="input-field grade-input" data-period="${periodKey}" ${disabledAttr} style="padding: 4px 6px; font-size: 12px; margin: 0; width: 55px; text-align: center; ${bgStyle}">
      </td>
    `;
  }

  async function submitAllGrades() {
    const tbody = document.getElementById('teacherGradeTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-student-id]');
    const gradesList = [];

    rows.forEach(r => {
      const studentId = r.dataset.studentId;
      const inputs = r.querySelectorAll('.grade-input');
      const item = { studentId };

      inputs.forEach(inp => {
        const period = inp.dataset.period;
        const val = inp.value.trim();
        if (val !== '') {
          item[period] = val;
        }
      });

      gradesList.push(item);
    });

    const saveBtn = document.getElementById('saveGradesBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving grades...';

    try {
      const res = await API.callBackend('submitGrades', {
        teacherId: currentTeacher.id,
        className: selectedClass,
        subject: selectedSubject,
        grades: gradesList
      });

      if (res && res.success) {
        App.showToast(res.message, 'success');
      } else {
        App.showToast(res.message || 'Error submitting grades.', 'error');
      }
    } catch (e) {
      App.showToast('Network error while submitting grades.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save All Grades';
    }
  }

  async function loadLessonPlans() {
    const container = document.getElementById('lessonPlansContainer');
    if (!container) return;

    const res = await API.callBackend('getLessonPlans');
    const plans = (res && res.success) ? res.lessonPlans : [];

    if (plans.length === 0) {
      container.innerHTML = '<div style="font-size: 13px; color: var(--color-text-muted); padding: 10px 0;">No lesson plans submitted yet.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Class</th>
              <th>Subject</th>
              <th>Period</th>
              <th>Submitted Date</th>
              <th>Attachment</th>
            </tr>
          </thead>
          <tbody>
            ${plans.map(p => `
              <tr>
                <td><b>${escapeHtml(p.title)}</b></td>
                <td>${escapeHtml(p.className)}</td>
                <td>${escapeHtml(p.subject)}</td>
                <td>${escapeHtml(p.period)}</td>
                <td>${escapeHtml(p.submittedAt)}</td>
                <td>
                  ${p.attachmentUrl ? `<a href="${p.attachmentUrl}" target="_blank" class="btn btn-light btn-sm">📎 View Doc</a>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function openLessonPlanModal() {
    App.showModal({
      title: 'Submit New Lesson Plan',
      content: `
        <div style="font-size: 13.5px;">
          <div class="form-group">
            <label class="form-label" for="lpTitle">Lesson Title *</label>
            <input type="text" id="lpTitle" class="input-field" placeholder="e.g. Introduction to Algebra" required>
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
                ${(currentAssignments[0]?.subjects || []).map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="lpDetails">Lesson Objectives &amp; Overview *</label>
            <textarea id="lpDetails" class="textarea-field" rows="4" placeholder="Detail the lesson objectives, materials, and methodology..." required></textarea>
          </div>
        </div>
      `,
      confirmText: 'Submit Lesson Plan',
      onConfirm: async () => {
        const title = document.getElementById('lpTitle').value.trim();
        const cls = document.getElementById('lpClass').value;
        const sub = document.getElementById('lpSubject').value;
        const details = document.getElementById('lpDetails').value.trim();

        if (!title || !details) {
          App.showToast('Title and details are required.', 'error');
          return;
        }

        const res = await API.callBackend('saveLessonPlan', {
          plan: { title, class: cls, subject: sub, details }
        });

        if (res && res.success) {
          App.showToast(res.message, 'success');
          loadLessonPlans();
        } else {
          App.showToast(res.message || 'Submission failed.', 'error');
        }
      }
    });
  }

  async function viewStudentReport(studentId) {
    const res = await API.callBackend('getReportCard', { studentId });
    if (res && res.success && res.reportCard) {
      App.showModal({
        title: 'Student Report Card Preview',
        content: '<div id="teacherRcMount"></div>',
        confirmText: 'Done',
        cancelText: 'Close'
      });
      ReportCard.render(res.reportCard, '#teacherRcMount');
    } else {
      App.showToast(res.message || 'Unable to load report card.', 'error');
    }
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
    onClassChange: onClassChange,
    onSubjectChange: onSubjectChange,
    submitAllGrades: submitAllGrades,
    openLessonPlanModal: openLessonPlanModal,
    viewStudentReport: viewStudentReport
  };
})();
