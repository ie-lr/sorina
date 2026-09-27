/**
 * admin.js
 * -----------------------------------------------------------------------
 * Administrator & Super Administrator panel.
 * Loaded ONLY after verified admin authentication (Section 12.2).
 * Implements RBAC-checked UI, Super Admin administrator management,
 * Student CRUD, Teacher assignments, Finance, Audit, and Settings.
 * -----------------------------------------------------------------------
 */

window.AdminPanel = (function () {
  let currentUser = null;
  let currentTab = 'overview';
  let cachedStudents = [];
  let cachedTeachers = [];

  function mount(container, user) {
    currentUser = user;
    currentTab = 'overview';
    renderShell(container);
    loadTabContent('overview');
  }

  function renderShell(container) {
    const isSuperAdmin = currentUser.role === 'superadmin';
    const perms = currentUser.permissions || {};

    const canStudents = isSuperAdmin || perms['students:view'];
    const canTeachers = isSuperAdmin || perms['teachers:view'];
    const canFinance = isSuperAdmin || perms['finance:view'];
    const canScores = isSuperAdmin || perms['scores:view'];
    const canSettings = isSuperAdmin || perms['settings:edit'];
    const canAudit = isSuperAdmin || perms['audit:view'];
    const canExport = isSuperAdmin || perms['export:data'];

    container.innerHTML = `
      <div class="dashboard-container">
        <!-- Dashboard Top Navigation Tabs -->
        <div class="nav-tabs" role="tablist">
          <button class="nav-tab-item active" data-tab="overview">📊 Overview</button>
          ${isSuperAdmin ? `<button class="nav-tab-item" data-tab="admins">🛡️ Manage Admins</button>` : ''}
          ${canStudents ? `<button class="nav-tab-item" data-tab="students">🎓 Students</button>` : ''}
          ${canTeachers ? `<button class="nav-tab-item" data-tab="teachers">👨‍🏫 Teachers</button>` : ''}
          ${canFinance ? `<button class="nav-tab-item" data-tab="finance">💳 Finance</button>` : ''}
          ${canScores ? `<button class="nav-tab-item" data-tab="grading">📝 Grading Controls</button>` : ''}
          ${canSettings ? `<button class="nav-tab-item" data-tab="settings">⚙️ Settings &amp; Branding</button>` : ''}
          ${canAudit ? `<button class="nav-tab-item" data-tab="audit">📜 Audit Log</button>` : ''}
          ${canExport ? `<button class="nav-tab-item" data-tab="export">📥 Export Data</button>` : ''}
        </div>

        <!-- Dynamic Content Body -->
        <div id="adminTabContent"></div>
      </div>
    `;

    container.querySelectorAll('.nav-tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.nav-tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadTabContent(currentTab);
      });
    });
  }

  async function loadTabContent(tab) {
    const content = document.getElementById('adminTabContent');
    if (!content) return;
    content.innerHTML = '<div style="padding: 40px; text-align: center;"><div class="stat-label">Loading section...</div></div>';

    switch (tab) {
      case 'overview':
        await renderOverview(content);
        break;
      case 'admins':
        await renderManageAdmins(content);
        break;
      case 'students':
        await renderStudents(content);
        break;
      case 'teachers':
        await renderTeachers(content);
        break;
      case 'finance':
        await renderFinance(content);
        break;
      case 'grading':
        await renderGradingControls(content);
        break;
      case 'settings':
        await renderSettings(content);
        break;
      case 'audit':
        await renderAuditLog(content);
        break;
      case 'export':
        renderExport(content);
        break;
    }
  }

  // =========================================================================
  // 1. OVERVIEW
  // =========================================================================
  async function renderOverview(container) {
    const res = await API.callBackend('getAllStudents');
    const students = (res && res.success) ? res.students : [];
    cachedStudents = students;

    const tRes = await API.callBackend('getTeachers');
    const teachers = (tRes && tRes.success) ? tRes.teachers : [];
    cachedTeachers = teachers;

    const activeStudents = students.filter(s => s.status === 'Active');
    const droppedStudents = students.filter(s => s.status === 'Dropped');
    const lockedGradeSheets = students.filter(s => s.gradeLocked);

    let totalTuition = 0;
    let totalCollected = 0;
    students.forEach(s => {
      if (s.finance) {
        totalTuition += (s.finance.tuitionTotal || 0);
        totalCollected += (s.finance.totalPaid || 0);
      }
    });

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Active Students</div>
          <div class="stat-value">${activeStudents.length}</div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">Total registered: ${students.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Teaching Staff</div>
          <div class="stat-value">${teachers.length}</div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">Active accounts</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Revenue Collected</div>
          <div class="stat-value">$${totalCollected.toLocaleString()}</div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">Billed: $${totalTuition.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Grade Sheets Locked</div>
          <div class="stat-value" style="color: var(--color-warning);">${lockedGradeSheets.length}</div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">Withheld for clearance</div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header-row">
          <h3 class="card-title">Quick Administration Actions</h3>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="window.AdminPanel.openAddStudentModal()">➕ Register New Student</button>
          <button class="btn btn-secondary" onclick="window.AdminPanel.openAddTeacherModal()">👨‍🏫 Add Teacher</button>
          <button class="btn btn-light" onclick="window.AdminPanel.switchTab('finance')">💳 View Finance Roster</button>
          <button class="btn btn-light" onclick="window.AdminPanel.switchTab('grading')">📝 Manage Open Periods</button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 2. MANAGE ADMINISTRATORS (Super Admin Only)
  // =========================================================================
  async function renderManageAdmins(container) {
    const res = await API.callBackend('listAdmins');
    const admins = (res && res.success) ? res.admins : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Manage System Administrators</h3>
            <p style="margin: 4px 0 0; font-size: 13px; color: var(--color-text-muted);">
              Super Administrator controls: Grant discrete module privileges to staff administrators.
            </p>
          </div>
          <button class="btn btn-primary" onclick="window.AdminPanel.openCreateAdminModal()">➕ Add Administrator</button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Verified Email</th>
                <th>Role Tier</th>
                <th>Granted Modules</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${admins.map(a => `
                <tr>
                  <td><b>${escapeHtml(a.username)}</b></td>
                  <td>${escapeHtml(a.name)}</td>
                  <td>${escapeHtml(a.email)}</td>
                  <td><span class="badge ${a.isSuperAdmin ? 'badge-success' : 'badge-info'}">${escapeHtml(a.roleTier)}</span></td>
                  <td>
                    ${a.isSuperAdmin ? '<span class="badge badge-success">Full System Access</span>' : formatGrantedPills(a.permissions)}
                  </td>
                  <td>${escapeHtml(a.lastLogin || 'Never')}</td>
                  <td>
                    ${a.isSuperAdmin ? '<span style="font-size: 12px; color: var(--color-text-dim);">Protected</span>' : `
                      <button class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditAdminModal('${escapeHtml(a.username)}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="window.AdminPanel.removeAdmin('${escapeHtml(a.username)}')">Remove</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function formatGrantedPills(perms) {
    if (!perms || typeof perms !== 'object') return '—';
    const granted = Object.keys(perms).filter(k => perms[k] === true);
    if (granted.length === 0) return '<span style="color: var(--color-text-dim);">None</span>';
    return granted.map(k => `<span class="badge badge-light" style="margin: 1px;">${k.replace(':', ' ')}</span>`).join('');
  }

  // =========================================================================
  // 3. STUDENTS MANAGEMENT
  // =========================================================================
  async function renderStudents(container) {
    const res = await API.callBackend('getAllStudents');
    cachedStudents = (res && res.success) ? res.students : [];

    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['students:edit']);

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Student Directory &amp; Records</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">Manage student profiles, grade-sheet lock states, and report cards.</div>
          </div>
          ${canEdit ? `<button class="btn btn-primary" onclick="window.AdminPanel.openAddStudentModal()">➕ Register Student</button>` : ''}
        </div>

        <!-- Filter Row -->
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <input type="text" id="studentSearchInput" class="input-field" placeholder="Search by name or student ID..." style="max-width: 280px;" oninput="window.AdminPanel.filterStudents()">
          <select id="studentClassFilter" class="select-field" style="max-width: 180px;" onchange="window.AdminPanel.filterStudents()">
            <option value="">All Classes</option>
            <option value="Nursery">Nursery</option>
            <option value="Grade 1">Grade 1</option>
            <option value="Grade 2">Grade 2</option>
            <option value="Grade 3">Grade 3</option>
            <option value="Grade 4">Grade 4</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
          </select>
          <select id="studentStatusFilter" class="select-field" style="max-width: 150px;" onchange="window.AdminPanel.filterStudents()">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Dropped">Dropped</option>
          </select>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="studentsTable">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Class</th>
                <th>Guardian &amp; Contact</th>
                <th>Category</th>
                <th>Status</th>
                <th>Grade Sheet</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="studentsTableBody">
              <!-- Rendered via renderStudentsTable -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    renderStudentsTable(cachedStudents);
  }

  function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['students:edit']);

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No student records found.</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr>
        <td><b>${escapeHtml(s.id)}</b></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${s.photo ? `<img src="${s.photo}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">` : '👤'}
            <span>${escapeHtml(s.name)}</span>
          </div>
        </td>
        <td>${escapeHtml(s.className || s.grade)}</td>
        <td>${escapeHtml(s.guardian || '—')} ${s.phone ? `(${escapeHtml(s.phone)})` : ''}</td>
        <td><span class="badge ${s.studentCategory === 'new' ? 'badge-info' : 'badge-light'}">${escapeHtml(s.studentCategory)}</span></td>
        <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(s.status)}</span></td>
        <td>
          ${s.gradeLocked 
            ? `<span class="badge badge-warning" style="cursor: pointer;" title="Click to unlock" onclick="${canEdit ? `window.AdminPanel.toggleGradeLock('${s.id}', false)` : ''}">🔒 Locked</span>`
            : `<span class="badge badge-success" style="cursor: pointer;" title="Click to lock" onclick="${canEdit ? `window.AdminPanel.toggleGradeLock('${s.id}', true)` : ''}">🔓 Open</span>`
          }
        </td>
        <td>
          <button class="btn btn-light btn-sm" onclick="window.AdminPanel.viewReportCard('${s.id}')">Report Card</button>
          ${canEdit ? `
            <button class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditStudentModal('${s.id}')">Edit</button>
            ${s.status === 'Active' 
              ? `<button class="btn btn-danger btn-sm" onclick="window.AdminPanel.dropStudent('${s.id}')">Drop</button>`
              : `<button class="btn btn-primary btn-sm" onclick="window.AdminPanel.undropStudent('${s.id}')">Reinstate</button>`
            }
          ` : ''}
        </td>
      </tr>
    `).join('');
  }

  function filterStudents() {
    const search = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
    const cls = (document.getElementById('studentClassFilter')?.value || '').toLowerCase();
    const stat = (document.getElementById('studentStatusFilter')?.value || '').toLowerCase();

    const filtered = cachedStudents.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search);
      const matchClass = !cls || (s.className || s.grade).toLowerCase() === cls;
      const matchStatus = !stat || s.status.toLowerCase() === stat;
      return matchSearch && matchClass && matchStatus;
    });

    renderStudentsTable(filtered);
  }

  // =========================================================================
  // 4. TEACHERS MANAGEMENT
  // =========================================================================
  async function renderTeachers(container) {
    const res = await API.callBackend('getTeachers');
    cachedTeachers = (res && res.success) ? res.teachers : [];

    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['teachers:edit']);

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Teaching Staff Directory</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">Manage teacher accounts and class/subject assignments.</div>
          </div>
          ${canEdit ? `<button class="btn btn-primary" onclick="window.AdminPanel.openAddTeacherModal()">➕ Add Teacher</button>` : ''}
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Teacher ID</th>
                <th>Name &amp; Title</th>
                <th>Assigned Classes &amp; Subjects</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${cachedTeachers.map(t => `
                <tr>
                  <td><b>${escapeHtml(t.id)}</b></td>
                  <td>${escapeHtml(t.name)} <div style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(t.title || 'Teacher')}</div></td>
                  <td>
                    ${formatTeacherAssignments(t.assignments)}
                  </td>
                  <td>${escapeHtml(t.phone || '—')}</td>
                  <td><span class="badge ${t.status === 'Active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(t.status)}</span></td>
                  <td>
                    ${canEdit ? `
                      <button class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditTeacherModal('${escapeHtml(t.id)}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteTeacher('${escapeHtml(t.id)}')">Deactivate</button>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function formatTeacherAssignments(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return '<span style="color: var(--color-text-dim);">No assignments</span>';
    }
    return assignments.map(a => `
      <div style="margin: 2px 0;">
        <b>${escapeHtml(a.class)}:</b> <span style="font-size: 12px; color: var(--color-text-muted);">${Array.isArray(a.subjects) ? a.subjects.map(escapeHtml).join(', ') : 'All subjects'}</span>
      </div>
    `).join('');
  }

  // =========================================================================
  // 5. FINANCE MANAGEMENT
  // =========================================================================
  async function renderFinance(container) {
    const res = await API.callBackend('getAllStudents');
    const students = (res && res.success) ? res.students : [];

    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['finance:edit']);

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Student Fee &amp; Payment Roster</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">Itemized tuition installments, registration, and miscellaneous fees.</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Tuition Total</th>
                <th>Registration</th>
                <th>Installments (1/2/3/4)</th>
                <th>Total Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => {
                const f = s.finance || {};
                const inst = f.installments || [0, 0, 0, 0];
                return `
                  <tr>
                    <td><b>${escapeHtml(s.id)}</b></td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.className || s.grade)}</td>
                    <td>$${(f.tuitionTotal || 0).toLocaleString()}</td>
                    <td>${f.registrationPaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Unpaid</span>'}</td>
                    <td style="font-size: 12px;">$${inst[0]} / $${inst[1]} / $${inst[2]} / $${inst[3]}</td>
                    <td><b style="color: var(--color-success);">$${(f.totalPaid || 0).toLocaleString()}</b></td>
                    <td><b style="color: ${(f.balance || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">$${(f.balance || 0).toLocaleString()}</b></td>
                    <td>
                      ${canEdit ? `
                        <button class="btn btn-primary btn-sm" onclick="window.AdminPanel.openRecordPaymentModal('${escapeHtml(s.id)}')">Record Payment</button>
                      ` : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 6. GRADING CONTROLS (Open / Close Periods)
  // =========================================================================
  async function renderGradingControls(container) {
    const res = await API.callBackend('getPermissions');
    const perms = (res && res.success) ? res.permissions : {};

    const periods = [
      { key: 'p1', label: '1st Period' },
      { key: 'p2', label: '2nd Period' },
      { key: 'p3', label: '3rd Period' },
      { key: 'exam1', label: '1st Semester Exam' },
      { key: 'p4', label: '4th Period' },
      { key: 'p5', label: '5th Period' },
      { key: 'p6', label: '6th Period' },
      { key: 'exam2', label: '2nd Semester Exam' }
    ];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Grading Period Locks</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Controls which grading periods are open for teacher grade submissions. Once closed, teacher submissions are rejected server-side.
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 16px;">
          ${periods.map(p => `
            <div style="border: 1px solid var(--color-border); padding: 16px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; background: var(--color-surface);">
              <div>
                <div style="font-weight: bold; font-size: 14px;">${p.label}</div>
                <div style="font-size: 12px; color: var(--color-text-muted);">Status: ${perms[p.key] ? '<span style="color: var(--color-success); font-weight: bold;">OPEN</span>' : '<span style="color: var(--color-danger); font-weight: bold;">CLOSED</span>'}</div>
              </div>
              <button class="btn btn-sm ${perms[p.key] ? 'btn-danger' : 'btn-primary'}" onclick="window.AdminPanel.togglePeriodPermission('${p.key}', ${!perms[p.key]})">
                ${perms[p.key] ? 'Close Period' : 'Open Period'}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 7. SETTINGS & BRANDING
  // =========================================================================
  async function renderSettings(container) {
    const res = await API.callBackend('getSettings');
    const settings = (res && res.success) ? res.settings : {};
    const subRes = await API.callBackend('getSubjects');
    const subjects = (subRes && subRes.success) ? subRes.subjects : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <h3 class="card-title">School Branding &amp; Deployment Configuration</h3>
        </div>

        <form id="settingsForm" onsubmit="window.AdminPanel.saveSettings(event)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label" for="stSchoolName">School Name</label>
              <input type="text" id="stSchoolName" class="input-field" value="${escapeHtml(settings.schoolName || '')}" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="stMotto">Motto / Slogan</label>
              <input type="text" id="stMotto" class="input-field" value="${escapeHtml(settings.schoolMotto || '')}">
            </div>

            <div class="form-group">
              <label class="form-label" for="stCurrency">Currency Code</label>
              <input type="text" id="stCurrency" class="input-field" value="${escapeHtml(settings.currencyCode || 'USD')}">
            </div>

            <div class="form-group">
              <label class="form-label" for="stAcademicYear">Academic Year</label>
              <input type="text" id="stAcademicYear" class="input-field" value="${escapeHtml(settings.academicYear || '2026-2027')}">
            </div>

            <div class="form-group">
              <label class="form-label" for="stEmail">Contact Email</label>
              <input type="email" id="stEmail" class="input-field" value="${escapeHtml(settings.contactEmail || '')}">
            </div>

            <div class="form-group">
              <label class="form-label" for="stPhone">Contact Phone</label>
              <input type="text" id="stPhone" class="input-field" value="${escapeHtml(settings.contactPhone || '')}">
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Save Branding Settings</button>
        </form>
      </div>

      <div class="content-card">
        <div class="card-header-row">
          <h3 class="card-title">Academic Subject Catalog</h3>
          <div style="font-size: 13px; color: var(--color-text-muted);">List of subjects taught across classes.</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
          ${subjects.map(s => `<span class="badge badge-info" style="font-size: 13px; padding: 6px 12px;">${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 8. AUDIT LOG
  // =========================================================================
  async function renderAuditLog(container) {
    const res = await API.callBackend('getAuditLog', { limit: 100 });
    const entries = (res && res.success) ? res.entries : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Append-Only Security Audit Log</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">Protected log of all logins, permission edits, data writes, and exports.</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target Record</th>
                <th>Outcome</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => `
                <tr>
                  <td style="font-size: 12px;">${escapeHtml(e.timestamp)}</td>
                  <td><b>${escapeHtml(e.actor)}</b></td>
                  <td><span class="badge badge-light">${escapeHtml(e.action)}</span></td>
                  <td>${escapeHtml(e.target || '—')}</td>
                  <td><span class="badge ${e.outcome === 'SUCCESS' ? 'badge-success' : e.outcome === 'BLOCKED' || e.outcome === 'DENIED' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(e.outcome)}</span></td>
                  <td style="font-size: 12px; color: var(--color-text-muted);">${escapeHtml(e.detail || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 9. DATA EXPORT
  // =========================================================================
  function renderExport(container) {
    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <h3 class="card-title">Authorized Data Export</h3>
        </div>
        <p style="font-size: 14px; color: var(--color-text-muted);">
          Export official spreadsheet tables to standard CSV format. All export actions are logged in the security audit log.
        </p>

        <div style="display: flex; gap: 14px; flex-wrap: wrap; margin-top: 20px;">
          <button class="btn btn-primary" onclick="window.AdminPanel.downloadCsv('students')">📥 Export Students CSV</button>
          <button class="btn btn-secondary" onclick="window.AdminPanel.downloadCsv('finance')">📥 Export Finance CSV</button>
          <button class="btn btn-light" onclick="window.AdminPanel.downloadCsv('scores')">📥 Export Scores CSV</button>
          <button class="btn btn-light" onclick="window.AdminPanel.downloadCsv('teachers')">📥 Export Teachers CSV</button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // MODALS & EVENT HANDLERS
  // =========================================================================
  function openAddStudentModal() {
    App.showModal({
      title: 'Register New Student',
      content: `
        <form id="addStudentForm" onsubmit="return false;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="asId">Student ID *</label>
              <input type="text" id="asId" class="input-field" placeholder="STU-2026-..." required>
            </div>
            <div class="form-group">
              <label class="form-label" for="asName">Full Name *</label>
              <input type="text" id="asName" class="input-field" placeholder="First and last name" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="asClass">Class / Grade *</label>
              <select id="asClass" class="select-field" required>
                <option value="Nursery">Nursery</option>
                <option value="Grade 1" selected>Grade 1</option>
                <option value="Grade 2">Grade 2</option>
                <option value="Grade 3">Grade 3</option>
                <option value="Grade 4">Grade 4</option>
                <option value="Grade 5">Grade 5</option>
                <option value="Grade 6">Grade 6</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="asCategory">Category *</label>
              <select id="asCategory" class="select-field">
                <option value="new" selected>New Student</option>
                <option value="old">Returning / Old Student</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="asPass">Initial Password *</label>
              <input type="password" id="asPass" class="input-field" value="student123" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="asDob">Date of Birth</label>
              <input type="date" id="asDob" class="input-field">
            </div>
            <div class="form-group">
              <label class="form-label" for="asGuardian">Guardian Name</label>
              <input type="text" id="asGuardian" class="input-field">
            </div>
            <div class="form-group">
              <label class="form-label" for="asPhone">Guardian Phone</label>
              <input type="text" id="asPhone" class="input-field">
            </div>
          </div>
        </form>
      `,
      confirmText: 'Register Student',
      onConfirm: async () => {
        const id = document.getElementById('asId').value.trim();
        const name = document.getElementById('asName').value.trim();
        const cls = document.getElementById('asClass').value;
        const cat = document.getElementById('asCategory').value;
        const pass = document.getElementById('asPass').value.trim();
        const dob = document.getElementById('asDob').value;
        const guardian = document.getElementById('asGuardian').value.trim();
        const phone = document.getElementById('asPhone').value.trim();

        if (!id || !name || !pass) {
          App.showToast('ID, Name, and Password are required.', 'error');
          return;
        }

        const res = await API.callBackend('addStudent', {
          student: { id, name, className: cls, studentCategory: cat, password: pass, dob, guardian, phone }
        });

        if (res && res.success) {
          App.showToast(res.message, 'success');
          loadTabContent('students');
        } else {
          App.showToast(res.message || 'Failed to add student.', 'error');
        }
      }
    });
  }

  function openCreateAdminModal() {
    App.showModal({
      title: 'Create Administrator Account',
      content: `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label" for="caUser">Username *</label>
            <input type="text" id="caUser" class="input-field" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="caName">Display Name *</label>
            <input type="text" id="caName" class="input-field" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="caEmail">Verified Email *</label>
            <input type="email" id="caEmail" class="input-field" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="caPass">Temporary Password *</label>
            <input type="password" id="caPass" class="input-field" required>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <label class="form-label">Granted Access Permissions:</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <label><input type="checkbox" id="perm_students_view" checked> Students: View</label>
            <label><input type="checkbox" id="perm_students_edit"> Students: Edit</label>
            <label><input type="checkbox" id="perm_teachers_view" checked> Teachers: View</label>
            <label><input type="checkbox" id="perm_teachers_edit"> Teachers: Edit</label>
            <label><input type="checkbox" id="perm_finance_view" checked> Finance: View</label>
            <label><input type="checkbox" id="perm_finance_edit"> Finance: Edit</label>
            <label><input type="checkbox" id="perm_scores_view" checked> Scores: View</label>
            <label><input type="checkbox" id="perm_scores_edit"> Scores: Edit</label>
            <label><input type="checkbox" id="perm_messaging" checked> Messaging</label>
            <label><input type="checkbox" id="perm_lesson_plans" checked> Lesson Plans</label>
            <label><input type="checkbox" id="perm_export"> Export Data</label>
            <label><input type="checkbox" id="perm_settings"> Settings</label>
          </div>
        </div>
      `,
      confirmText: 'Create Administrator',
      onConfirm: async () => {
        const username = document.getElementById('caUser').value.trim();
        const name = document.getElementById('caName').value.trim();
        const email = document.getElementById('caEmail').value.trim();
        const password = document.getElementById('caPass').value.trim();

        const perms = {
          'students:view': document.getElementById('perm_students_view').checked,
          'students:edit': document.getElementById('perm_students_edit').checked,
          'teachers:view': document.getElementById('perm_teachers_view').checked,
          'teachers:edit': document.getElementById('perm_teachers_edit').checked,
          'finance:view': document.getElementById('perm_finance_view').checked,
          'finance:edit': document.getElementById('perm_finance_edit').checked,
          'scores:view': document.getElementById('perm_scores_view').checked,
          'scores:edit': document.getElementById('perm_scores_edit').checked,
          'messaging': document.getElementById('perm_messaging').checked,
          'lesson_plans': document.getElementById('perm_lesson_plans').checked,
          'export:data': document.getElementById('perm_export').checked,
          'settings:edit': document.getElementById('perm_settings').checked
        };

        const res = await API.callBackend('createAdmin', { username, name, email, password, permissions: perms });
        if (res && res.success) {
          App.showToast(res.message, 'success');
          loadTabContent('admins');
        } else {
          App.showToast(res.message || 'Error creating admin.', 'error');
        }
      }
    });
  }

  async function toggleGradeLock(studentId, lockState) {
    const res = await API.callBackend('setGradeLock', { studentId, locked: lockState });
    if (res && res.success) {
      App.showToast(res.message, 'success');
      loadTabContent('students');
    } else {
      App.showToast(res.message || 'Error updating grade lock.', 'error');
    }
  }

  async function dropStudent(studentId) {
    if (!confirm(`Are you sure you want to mark student ${studentId} as Dropped?`)) return;
    const res = await API.callBackend('dropStudent', { studentId });
    if (res && res.success) {
      App.showToast(res.message, 'success');
      loadTabContent('students');
    }
  }

  async function undropStudent(studentId) {
    const newPass = prompt(`Enter a new password to reinstate student ${studentId}:`, 'student123');
    if (!newPass) return;
    const res = await API.callBackend('undropStudent', { studentId, newPassword: newPass });
    if (res && res.success) {
      App.showToast(res.message, 'success');
      loadTabContent('students');
    }
  }

  async function viewReportCard(studentId) {
    const res = await API.callBackend('getReportCard', { studentId });
    if (res && res.success && res.reportCard) {
      App.showModal({
        title: 'Student Report Card',
        content: '<div id="reportCardModalMount"></div>',
        confirmText: 'Done',
        cancelText: 'Close'
      });
      ReportCard.render(res.reportCard, '#reportCardModalMount');
    } else {
      App.showToast(res.message || 'Unable to retrieve report card.', 'error');
    }
  }

  async function openRecordPaymentModal(studentId) {
    const res = await API.callBackend('getStudentFinance', { studentId });
    const f = (res && res.success && res.finance) ? res.finance : {};
    const inst = f.installments || [0, 0, 0, 0];

    App.showModal({
      title: `Record Payment — Student ${studentId}`,
      content: `
        <div style="font-size: 13.5px; line-height: 1.6;">
          <p>Total Tuition: <b>$${f.tuitionTotal || 0}</b> | Current Balance: <b style="color: var(--color-danger);">$${f.balance || 0}</b></p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Registration Paid</label>
              <select id="payReg" class="select-field">
                <option value="true" ${f.registrationPaid ? 'selected' : ''}>Yes (Paid)</option>
                <option value="false" ${!f.registrationPaid ? 'selected' : ''}>No (Unpaid)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">1st Installment ($)</label>
              <input type="number" id="payInst1" class="input-field" value="${inst[0] || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">2nd Installment ($)</label>
              <input type="number" id="payInst2" class="input-field" value="${inst[1] || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">3rd Installment ($)</label>
              <input type="number" id="payInst3" class="input-field" value="${inst[2] || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">4th Installment ($)</label>
              <input type="number" id="payInst4" class="input-field" value="${inst[3] || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Other Payments ($)</label>
              <input type="number" id="payOther" class="input-field" value="${f.otherPayments || 0}">
            </div>
          </div>
        </div>
      `,
      confirmText: 'Save Payment',
      onConfirm: async () => {
        const payload = {
          registrationPaid: document.getElementById('payReg').value === 'true',
          installments: [
            Number(document.getElementById('payInst1').value || 0),
            Number(document.getElementById('payInst2').value || 0),
            Number(document.getElementById('payInst3').value || 0),
            Number(document.getElementById('payInst4').value || 0)
          ],
          otherPayments: Number(document.getElementById('payOther').value || 0)
        };

        const saveRes = await API.callBackend('recordPayment', { studentId, payment: payload });
        if (saveRes && saveRes.success) {
          App.showToast(saveRes.message, 'success');
          loadTabContent('finance');
        } else {
          App.showToast(saveRes.message || 'Payment update failed.', 'error');
        }
      }
    });
  }

  async function togglePeriodPermission(periodKey, state) {
    const update = { [periodKey]: state };
    const res = await API.callBackend('savePermissions', { permissions: update });
    if (res && res.success) {
      App.showToast(res.message, 'success');
      loadTabContent('grading');
    }
  }

  async function saveSettings(e) {
    if (e) e.preventDefault();
    const payload = {
      schoolName: document.getElementById('stSchoolName').value.trim(),
      schoolMotto: document.getElementById('stMotto').value.trim(),
      currencyCode: document.getElementById('stCurrency').value.trim(),
      academicYear: document.getElementById('stAcademicYear').value.trim(),
      contactEmail: document.getElementById('stEmail').value.trim(),
      contactPhone: document.getElementById('stPhone').value.trim()
    };

    const res = await API.callBackend('updateSettings', { settings: payload });
    if (res && res.success) {
      App.showToast(res.message, 'success');
      App.applyBranding();
    } else {
      App.showToast(res.message || 'Failed to save settings.', 'error');
    }
  }

  async function downloadCsv(dataType) {
    const res = await API.callBackend('exportData', { dataType });
    if (res && res.success && res.csv) {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', res.fileName || `${dataType}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      App.showToast(`Exported ${dataType} table.`, 'success');
    } else {
      App.showToast(res.message || 'Export failed.', 'error');
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
    switchTab: (t) => loadTabContent(t),
    openAddStudentModal: openAddStudentModal,
    openCreateAdminModal: openCreateAdminModal,
    filterStudents: filterStudents,
    toggleGradeLock: toggleGradeLock,
    dropStudent: dropStudent,
    undropStudent: undropStudent,
    viewReportCard: viewReportCard,
    openRecordPaymentModal: openRecordPaymentModal,
    togglePeriodPermission: togglePeriodPermission,
    saveSettings: saveSettings,
    downloadCsv: downloadCsv
  };
})();
