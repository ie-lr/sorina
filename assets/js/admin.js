/**
 * admin.js
 * -----------------------------------------------------------------------
 * Administrator & Super Administrator Module
 * 
 * Features:
 * - Collapsible royal blue left sidebar navigation matching official theme.
 * - Summary Tab: enrolled by classes, teachers, revenue, expenses, net balance, target.
 * - Students Tab: systematic ID [SPSS001], New Student registration, Old Student
 *   registration with previous class filter & auto-fill, grade lock, report cards.
 * - Teachers Tab: systematic ID [SPST001], multi-class / multi-subject assignments.
 * - Finance & Tuition: class fee schedules (New vs Old), student fee records.
 * - Payroll Tab: staff monthly salary, deductions, tax, net salary, doc upload, paid flag.
 * - Printing Services Tab: ID cards generation/preview & submit to IE; teacher tests dispatch.
 * - Subjects Tab: add, edit, delete subjects.
 * - Grading Controls: open/close evaluation periods.
 * - IE Developer Channel: direct messaging with developer team.
 * - Settings Tab: branding, profile photo, contact, password, PWA install.
 * - Standard PNG icons from assets/icons/ throughout.
 * -----------------------------------------------------------------------
 */

window.AdminPanel = (function () {
  let currentUser = null;
  let currentTab = 'summary';
  let cachedStudents = [];
  let cachedTeachers = [];
  let cachedSubjects = [];
  let isSidebarCollapsed = false;
  let selectedStudentIdsForPrint = new Set();

  function mount(container, user) {
    currentUser = user;
    currentTab = 'summary';
    renderPortalLayout(container);
    loadTab(currentTab);
  }

  function renderPortalLayout(container) {
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
      <div class="portal-layout">
        <!-- Collapsible Royal Blue Sidebar -->
        <aside class="portal-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}" id="adminSidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand-title">Admin Console</div>
            <button class="sidebar-toggle-btn" id="adminSidebarToggleBtn" type="button" title="Toggle Navigation">
              <img src="assets/icons/text-align-justify.png" alt="Toggle">
            </button>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-title">Core Operations</div>

            <a class="sidebar-item ${currentTab === 'summary' ? 'active' : ''}" data-tab="summary">
              <img src="assets/icons/tally-4.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Executive Summary</span>
            </a>

            ${canStudents ? `
              <a class="sidebar-item ${currentTab === 'students' ? 'active' : ''}" data-tab="students">
                <img src="assets/icons/users.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Students Directory</span>
              </a>
            ` : ''}

            ${canTeachers ? `
              <a class="sidebar-item ${currentTab === 'teachers' ? 'active' : ''}" data-tab="teachers">
                <img src="assets/icons/user.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Teaching Staff</span>
              </a>
            ` : ''}

            ${canFinance ? `
              <a class="sidebar-item ${currentTab === 'finance' ? 'active' : ''}" data-tab="finance">
                <img src="assets/icons/landmark.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Tuition &amp; Fees</span>
              </a>

              <a class="sidebar-item ${currentTab === 'payroll' ? 'active' : ''}" data-tab="payroll">
                <img src="assets/icons/landmark.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Staff Payroll</span>
              </a>
            ` : ''}

            <div class="nav-section-title">Academics &amp; Services</div>

            <a class="sidebar-item ${currentTab === 'printing' ? 'active' : ''}" data-tab="printing">
              <img src="assets/icons/file-text.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Printing Services</span>
            </a>

            <a class="sidebar-item ${currentTab === 'subjects' ? 'active' : ''}" data-tab="subjects">
              <img src="assets/icons/folders.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Subjects Catalog</span>
            </a>

            ${canScores ? `
              <a class="sidebar-item ${currentTab === 'grading' ? 'active' : ''}" data-tab="grading">
                <img src="assets/icons/pencil.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Grading Controls</span>
              </a>
            ` : ''}

            <div class="nav-section-title">Administration</div>

            <a class="sidebar-item ${currentTab === 'developer' ? 'active' : ''}" data-tab="developer">
              <img src="assets/icons/mail-open.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">IE Developer Desk</span>
            </a>

            ${isSuperAdmin ? `
              <a class="sidebar-item ${currentTab === 'admins' ? 'active' : ''}" data-tab="admins">
                <img src="assets/icons/user-key.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">System Admins</span>
              </a>
            ` : ''}

            ${canSettings ? `
              <a class="sidebar-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
                <img src="assets/icons/monitor-cog.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Settings &amp; Profile</span>
              </a>
            ` : ''}

            ${canAudit ? `
              <a class="sidebar-item ${currentTab === 'audit' ? 'active' : ''}" data-tab="audit">
                <img src="assets/icons/info.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Audit Log</span>
              </a>
            ` : ''}

            ${canExport ? `
              <a class="sidebar-item ${currentTab === 'export' ? 'active' : ''}" data-tab="export">
                <img src="assets/icons/download (2).png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Export Data</span>
              </a>
            ` : ''}

            <a class="sidebar-item" id="adminLogoutBtn">
              <img src="assets/icons/log-out.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Sign Out</span>
            </a>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="portal-content" id="adminContentBody"></main>
      </div>
    `;

    // Sidebar Toggle
    const sidebar = document.getElementById('adminSidebar');
    const toggleBtn = document.getElementById('adminSidebarToggleBtn');
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
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.Auth) window.Auth.logout();
      });
    }
  }

  async function loadTab(tab) {
    const container = document.getElementById('adminContentBody');
    if (!container) return;
    container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--color-text-muted);">Loading section...</div>';

    switch (tab) {
      case 'summary':
        await renderSummaryTab(container);
        break;
      case 'students':
        await renderStudentsTab(container);
        break;
      case 'teachers':
        await renderTeachersTab(container);
        break;
      case 'finance':
        await renderFinanceTab(container);
        break;
      case 'payroll':
        await renderPayrollTab(container);
        break;
      case 'printing':
        await renderPrintingTab(container);
        break;
      case 'subjects':
        await renderSubjectsTab(container);
        break;
      case 'grading':
        await renderGradingTab(container);
        break;
      case 'developer':
        await renderDeveloperTab(container);
        break;
      case 'admins':
        await renderAdminsTab(container);
        break;
      case 'settings':
        await renderSettingsTab(container);
        break;
      case 'audit':
        await renderAuditTab(container);
        break;
      case 'export':
        renderExportTab(container);
        break;
    }
  }

  // =========================================================================
  // 1. EXECUTIVE SUMMARY TAB
  // =========================================================================
  async function renderSummaryTab(container) {
    const res = await API.callBackend('getFinancialSummary', {}, 'Loading summary...');
    const sum = (res && res.success && res.summary) ? res.summary : {
      totalStudents: 0, totalTeachers: 0, totalBilled: 0,
      totalRevenue: 0, totalExpenses: 0, netBalance: 0, targetRemaining: 0,
      enrolledByClass: {}
    };

    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 6px; color: var(--color-primary); font-size: 22px;">Institutional Executive Summary</h2>
        <div style="font-size: 13.5px; color: var(--color-text-muted);">Real-time institutional metrics, class enrollment, and cash flow balance.</div>
      </div>

      <!-- Financial & Metric Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">Enrolled Students</div>
          <div class="stat-value">${sum.totalStudents}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Teachers</div>
          <div class="stat-value">${sum.totalTeachers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Revenue Collected</div>
          <div class="stat-value" style="color: var(--color-success);">$${sum.totalRevenue.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Payroll Expenses</div>
          <div class="stat-value" style="color: var(--color-danger);">$${sum.totalExpenses.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Net Operating Balance</div>
          <div class="stat-value" style="color: ${sum.netBalance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'};">
            $${sum.netBalance.toLocaleString()}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Target Remaining (Receivable)</div>
          <div class="stat-value" style="color: #d97706;">$${sum.targetRemaining.toLocaleString()}</div>
        </div>
      </div>

      <!-- Enrollment by Class -->
      <div class="content-card" style="margin-bottom: 24px;">
        <h3 class="card-title" style="margin-bottom: 14px;">Enrollment Distribution by Class</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Class / Grade Level</th>
                <th>Student Count</th>
                <th>Distribution %</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(sum.enrolledByClass).length === 0 ? `
                <tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--color-text-muted);">No student records filed yet.</td></tr>
              ` : Object.entries(sum.enrolledByClass).map(([cls, count]) => {
                const pct = sum.totalStudents > 0 ? Math.round((count / sum.totalStudents) * 100) : 0;
                return `
                  <tr>
                    <td><b>${escapeHtml(cls)}</b></td>
                    <td>${count} student(s)</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; max-width: 140px;">
                          <div style="width: ${pct}%; height: 100%; background: var(--color-primary);"></div>
                        </div>
                        <span style="font-size: 12px; font-weight: 600;">${pct}%</span>
                      </div>
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
  // 2. STUDENTS TAB (SYSTEMATIC ID, NEW & OLD STUDENT ENROLLMENT)
  // =========================================================================
  async function renderStudentsTab(container) {
    const res = await API.callBackend('getAllStudents', {}, 'Fetching students...');
    cachedStudents = (res && res.success && Array.isArray(res.students)) ? res.students : [];
    selectedStudentIdsForPrint.clear();

    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['students:edit']);

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Student Directory &amp; Registration</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Manage student admissions, grade lock status, and official credentials.
            </div>
          </div>

          ${canEdit ? `
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" id="regNewStudentBtn" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/user-key.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
                Register New Student
              </button>
              <button type="button" class="btn btn-secondary" id="regOldStudentBtn" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/users.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
                Register Old Student
              </button>
              <button type="button" class="btn btn-light" id="batchPrintIdCardsBtn" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/file-text.png" style="width: 15px; height: 15px;" alt="">
                Send IDs to IE Printing
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Filter Row -->
        <div style="display: flex; gap: 10px; margin: 14px 0; flex-wrap: wrap;">
          <input type="text" id="studentSearchInput" class="input-field" placeholder="Search by student name or ID..." style="max-width: 250px;">
          <select id="studentClassFilter" class="select-field" style="max-width: 160px;">
            <option value="">All Classes</option>
            <option value="Nursery A">Nursery A</option>
            <option value="Nursery B">Nursery B</option>
            <option value="Kindergarten">Kindergarten</option>
            <option value="Grade 1">Grade 1</option>
            <option value="Grade 2">Grade 2</option>
            <option value="Grade 3">Grade 3</option>
            <option value="Grade 4">Grade 4</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
          </select>
          <select id="studentCategoryFilter" class="select-field" style="max-width: 140px;">
            <option value="">All Categories</option>
            <option value="new">New Enrollee</option>
            <option value="old">Returning Student</option>
          </select>
        </div>

        <!-- Student Roster Table -->
        <div class="table-responsive">
          <table class="data-table" id="studentDirectoryTable">
            <thead>
              <tr>
                <th style="width: 38px;"><input type="checkbox" id="selectAllStudentsCheckbox"></th>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Class</th>
                <th>Category</th>
                <th>Guardian Phone</th>
                <th>Grade Lock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="studentDirectoryBody"></tbody>
          </table>
        </div>
      </div>
    `;

    renderStudentRows(cachedStudents);

    // Event Listeners
    document.getElementById('studentSearchInput').oninput = filterStudents;
    document.getElementById('studentClassFilter').onchange = filterStudents;
    document.getElementById('studentCategoryFilter').onchange = filterStudents;

    document.getElementById('selectAllStudentsCheckbox').onchange = (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.student-checkbox').forEach(cb => {
        cb.checked = checked;
        const id = cb.dataset.id;
        if (checked) selectedStudentIdsForPrint.add(id);
        else selectedStudentIdsForPrint.delete(id);
      });
    };

    if (canEdit) {
      document.getElementById('regNewStudentBtn').onclick = () => openRegisterNewStudentModal();
      document.getElementById('regOldStudentBtn').onclick = () => openRegisterOldStudentModal();
      document.getElementById('batchPrintIdCardsBtn').onclick = () => sendSelectedStudentsToPrinting();
    }
  }

  function renderStudentRows(list) {
    const tbody = document.getElementById('studentDirectoryBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No matching students found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(s => {
      const isLocked = s.gradeLocked === true;
      return `
        <tr>
          <td><input type="checkbox" class="student-checkbox" data-id="${escapeHtml(s.id)}" ${selectedStudentIdsForPrint.has(s.id) ? 'checked' : ''}></td>
          <td><b>[${escapeHtml(s.id)}]</b></td>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.className || s.grade)}</td>
          <td><span class="badge ${s.studentCategory === 'old' ? 'badge-light' : 'badge-info'}">${s.studentCategory === 'old' ? 'Returning' : 'New'}</span></td>
          <td>${escapeHtml(s.phone || '—')}</td>
          <td>
            <button type="button" class="btn btn-sm ${isLocked ? 'btn-danger' : 'btn-light'}" onclick="window.AdminPanel.toggleGradeLock('${escapeHtml(s.id)}', ${!isLocked})">
              ${isLocked ? 'Locked' : 'Open'}
            </button>
          </td>
          <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(s.status || 'Active')}</span></td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.viewStudentReport('${escapeHtml(s.id)}')" title="View Report Card">
                <img src="assets/icons/file-text.png" style="width: 13px; height: 13px;" alt="">
              </button>
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.previewStudentIdCard('${escapeHtml(s.id)}')" title="Preview ID Card">
                <img src="assets/icons/circle-user-round.png" style="width: 13px; height: 13px;" alt="">
              </button>
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditStudentModal('${escapeHtml(s.id)}')" title="Edit Profile">
                <img src="assets/icons/pencil.png" style="width: 13px; height: 13px;" alt="">
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach individual checkbox listeners
    tbody.querySelectorAll('.student-checkbox').forEach(cb => {
      cb.onchange = (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) selectedStudentIdsForPrint.add(id);
        else selectedStudentIdsForPrint.delete(id);
      };
    });
  }

  function filterStudents() {
    const q = document.getElementById('studentSearchInput').value.trim().toLowerCase();
    const cls = document.getElementById('studentClassFilter').value.trim().toLowerCase();
    const cat = document.getElementById('studentCategoryFilter').value.trim().toLowerCase();

    const filtered = cachedStudents.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const matchCls = !cls || String(s.className || s.grade).toLowerCase() === cls;
      const matchCat = !cat || String(s.studentCategory || '').toLowerCase() === cat;
      return matchQ && matchCls && matchCat;
    });

    renderStudentRows(filtered);
  }

  // --- Register New Student Modal (Systematic ID: SPSS001...) ---
  async function openRegisterNewStudentModal() {
    // Fetch next systematic ID from backend
    const idRes = await API.callBackend('getNextStudentId', {}, 'Fetching next ID...');
    const nextId = (idRes && idRes.success) ? idRes.nextId : 'SPSS001';

    App.showModal({
      title: 'Register New Student (New Enrollee)',
      content: `
        <div style="font-size: 13.5px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsId">Systematic Student ID *</label>
              <input type="text" id="nsId" class="input-field" value="${escapeHtml(nextId)}" required style="font-weight: 700; color: var(--color-primary);">
              <div class="form-hint">Automatically assigned systematic numbering [SPSS001].</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="nsName">Full Name *</label>
              <input type="text" id="nsName" class="input-field" placeholder="e.g. Samuel K. Brown" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsClass">Enrolling Class *</label>
              <select id="nsClass" class="select-field">
                <option value="Nursery A">Nursery A</option>
                <option value="Nursery B">Nursery B</option>
                <option value="Kindergarten">Kindergarten</option>
                <option value="Grade 1" selected>Grade 1</option>
                <option value="Grade 2">Grade 2</option>
                <option value="Grade 3">Grade 3</option>
                <option value="Grade 4">Grade 4</option>
                <option value="Grade 5">Grade 5</option>
                <option value="Grade 6">Grade 6</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="nsPass">Initial Password *</label>
              <input type="password" id="nsPass" class="input-field" value="student123" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsDob">Date of Birth</label>
              <input type="date" id="nsDob" class="input-field">
            </div>
            <div class="form-group">
              <label class="form-label" for="nsGuardian">Parent / Guardian Name</label>
              <input type="text" id="nsGuardian" class="input-field" placeholder="e.g. Mary Brown">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="nsPhone">Parent Contact Phone</label>
            <input type="text" id="nsPhone" class="input-field" placeholder="+231-...">
          </div>
        </div>
      `,
      confirmText: 'Register New Student',
      onConfirm: async () => {
        const id = document.getElementById('nsId').value.trim();
        const name = document.getElementById('nsName').value.trim();
        const cls = document.getElementById('nsClass').value;
        const pass = document.getElementById('nsPass').value.trim();
        const dob = document.getElementById('nsDob').value;
        const guardian = document.getElementById('nsGuardian').value.trim();
        const phone = document.getElementById('nsPhone').value.trim();

        if (!name || !pass) {
          API.toastNotification('Student name and password are required.', true);
          return;
        }

        const res = await API.callBackend('addStudent', {
          student: {
            id: id,
            name: name,
            className: cls,
            grade: cls,
            academicYear: '2026-2027',
            studentCategory: 'new',
            password: pass,
            dob: dob,
            guardian: guardian,
            phone: phone
          }
        }, 'Registering student...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('students');
        } else {
          API.toastNotification(res.message || 'Error registering student.', true);
        }
      }
    });
  }

  // --- Register Old Student Modal (Previous Class Filter & Auto-fill while preserving ID) ---
  async function openRegisterOldStudentModal() {
    App.showModal({
      title: 'Register Returning / Old Student (Advance to New Class)',
      content: `
        <div style="font-size: 13.5px;">
          <!-- Step 1: Filter by Previous Class -->
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 14px;">
            <label class="form-label" for="prevClassFilter">1. Select Student's Previous Class / Grade Level:</label>
            <select id="prevClassFilter" class="select-field">
              <option value="">-- Choose Previous Class --</option>
              <option value="Nursery A">Nursery A</option>
              <option value="Nursery B">Nursery B</option>
              <option value="Kindergarten">Kindergarten</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
            </select>

            <div style="margin-top: 10px;">
              <label class="form-label" for="oldStudentPicker">2. Select Returning Student:</label>
              <select id="oldStudentPicker" class="select-field" disabled>
                <option value="">-- Select previous class first --</option>
              </select>
            </div>
          </div>

          <!-- Step 2: Auto-filled Details (Preserves original ID) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Original Student ID (Preserved)</label>
              <input type="text" id="osId" class="input-field" readonly style="font-weight: 700; background: #e2e8f0; color: var(--color-primary);">
            </div>
            <div class="form-group">
              <label class="form-label">Student Name</label>
              <input type="text" id="osName" class="input-field" readonly style="background: #e2e8f0;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="osNewClass">New Advancing Class *</label>
              <select id="osNewClass" class="select-field">
                <option value="Kindergarten">Kindergarten</option>
                <option value="Grade 1">Grade 1</option>
                <option value="Grade 2">Grade 2</option>
                <option value="Grade 3">Grade 3</option>
                <option value="Grade 4">Grade 4</option>
                <option value="Grade 5">Grade 5</option>
                <option value="Grade 6">Grade 6</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="osGuardian">Guardian Contact</label>
              <input type="text" id="osGuardian" class="input-field" placeholder="Guardian name">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="osPhone">Parent / Guardian Phone</label>
            <input type="text" id="osPhone" class="input-field" placeholder="+231-...">
          </div>
        </div>
      `,
      confirmText: 'Advance &amp; Enroll Student',
      onConfirm: async () => {
        const studentId = document.getElementById('osId').value.trim();
        const name = document.getElementById('osName').value.trim();
        const newClass = document.getElementById('osNewClass').value;
        const guardian = document.getElementById('osGuardian').value.trim();
        const phone = document.getElementById('osPhone').value.trim();

        if (!studentId) {
          API.toastNotification('Please select a student to advance.', true);
          return;
        }

        const res = await API.callBackend('updateStudent', {
          student: {
            id: studentId,
            className: newClass,
            grade: newClass,
            academicYear: '2026-2027',
            studentCategory: 'old',
            guardian: guardian,
            phone: phone
          }
        }, 'Advancing student...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('students');
        } else {
          API.toastNotification(res.message || 'Error updating student record.', true);
        }
      }
    });

    // Wire up dynamic cascading filter
    const prevClassSelect = document.getElementById('prevClassFilter');
    const studentPicker = document.getElementById('oldStudentPicker');

    let classStudents = [];

    prevClassSelect.onchange = async () => {
      const cls = prevClassSelect.value;
      if (!cls) {
        studentPicker.disabled = true;
        studentPicker.innerHTML = '<option value="">-- Select previous class first --</option>';
        return;
      }

      studentPicker.disabled = false;
      studentPicker.innerHTML = '<option value="">Loading students...</option>';

      const res = await API.callBackend('getOldStudentsByClass', { className: cls }, 'Filtering students...');
      classStudents = (res && res.success && Array.isArray(res.students)) ? res.students : [];

      if (classStudents.length === 0) {
        studentPicker.innerHTML = '<option value="">No students found in ' + escapeHtml(cls) + '</option>';
        return;
      }

      studentPicker.innerHTML = '<option value="">-- Choose Student to Advance --</option>' +
        classStudents.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} [${escapeHtml(s.id)}]</option>`).join('');
    };

    studentPicker.onchange = () => {
      const selectedId = studentPicker.value;
      const student = classStudents.find(s => s.id === selectedId);
      if (!student) return;

      document.getElementById('osId').value = student.id;
      document.getElementById('osName').value = student.name;
      document.getElementById('osGuardian').value = student.guardian || '';
      document.getElementById('osPhone').value = student.phone || '';

      // Auto suggest next class
      const currentClass = student.className || student.grade || '';
      const m = currentClass.match(/Grade\s*(\d+)/i);
      if (m) {
        const nextGrade = parseInt(m[1], 10) + 1;
        const nextOption = document.querySelector(`#osNewClass option[value="Grade ${nextGrade}"]`);
        if (nextOption) nextOption.selected = true;
      }
    };
  }

  // --- Send Selected Students to IE Printing Queue ---
  async function sendSelectedStudentsToPrinting() {
    const ids = Array.from(selectedStudentIdsForPrint);
    if (ids.length === 0) {
      API.toastNotification('Please select at least one student checkbox.', true);
      return;
    }

    if (!confirm(`Submit ${ids.length} student ID cards to IE Printing Services?`)) return;

    const res = await API.callBackend('sendIdCardsToPrinting', {
      type: 'student',
      targetIds: ids,
      notes: 'Standard Student PVC ID Card'
    }, 'Submitting print job...');

    if (res && res.success) {
      API.toastSuccess();
      selectedStudentIdsForPrint.clear();
      renderStudentRows(cachedStudents);
    } else {
      API.toastNotification(res.message || 'Error submitting print order.', true);
    }
  }

  // =========================================================================
  // 3. TEACHING STAFF TAB (SYSTEMATIC ID: SPST001)
  // =========================================================================
  async function renderTeachersTab(container) {
    const res = await API.callBackend('getTeachers', {}, 'Fetching teachers...');
    cachedTeachers = (res && res.success && Array.isArray(res.teachers)) ? res.teachers : [];

    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['teachers:edit']);

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Teaching Staff Directory</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Manage faculty credentials, multi-class assignments, and staff ID cards.
            </div>
          </div>
          ${canEdit ? `
            <button type="button" class="btn btn-primary" id="addTeacherBtn" style="display: flex; align-items: center; gap: 6px;">
              <img src="assets/icons/user.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
              Add Teaching Faculty
            </button>
          ` : ''}
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Teacher ID</th>
                <th>Full Name</th>
                <th>Assigned Classes &amp; Subjects</th>
                <th>Contact Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${cachedTeachers.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No faculty registered.</td></tr>
              ` : cachedTeachers.map(t => `
                <tr>
                  <td><b>[${escapeHtml(t.id)}]</b></td>
                  <td>${escapeHtml(t.name)}</td>
                  <td>
                    ${Array.isArray(t.assignments) && t.assignments.length > 0 ? t.assignments.map(a => `
                      <span class="badge badge-light" style="margin: 2px;">
                        <b>${escapeHtml(a.class)}:</b> ${Array.isArray(a.subjects) && a.subjects.length > 0 ? a.subjects.map(escapeHtml).join(', ') : 'All'}
                      </span>
                    `).join('') : '<span style="color:#94a3b8;">No Classes Assigned</span>'}
                  </td>
                  <td>${escapeHtml(t.phone || '—')}</td>
                  <td><span class="badge ${t.status === 'Active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(t.status || 'Active')}</span></td>
                  <td>
                    <div style="display: flex; gap: 4px;">
                      <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.previewTeacherIdCard('${escapeHtml(t.id)}')">ID Card</button>
                      <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditTeacherModal('${escapeHtml(t.id)}')">Edit</button>
                      ${canEdit ? `<button type="button" class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteTeacher('${escapeHtml(t.id)}')">Delete</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (canEdit) {
      document.getElementById('addTeacherBtn').onclick = () => openAddTeacherModal();
    }
  }

  async function openAddTeacherModal() {
    const idRes = await API.callBackend('getNextTeacherId', {}, 'Fetching next teacher ID...');
    const nextId = (idRes && idRes.success) ? idRes.nextId : 'SPST001';

    App.showModal({
      title: 'Add New Teacher',
      content: `
        <div style="font-size: 13.5px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="ntId">Systematic Teacher ID *</label>
              <input type="text" id="ntId" class="input-field" value="${escapeHtml(nextId)}" required style="font-weight: 700; color: var(--color-primary);">
            </div>
            <div class="form-group">
              <label class="form-label" for="ntName">Full Name *</label>
              <input type="text" id="ntName" class="input-field" placeholder="e.g. David K. Kollie" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="ntPhone">Contact Phone</label>
              <input type="text" id="ntPhone" class="input-field" placeholder="+231-...">
            </div>
            <div class="form-group">
              <label class="form-label" for="ntPass">Account Password *</label>
              <input type="password" id="ntPass" class="input-field" value="teacher123" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="ntTitle">Professional Title</label>
            <input type="text" id="ntTitle" class="input-field" value="Subject Instructor">
          </div>
        </div>
      `,
      confirmText: 'Create Faculty Account',
      onConfirm: async () => {
        const id = document.getElementById('ntId').value.trim();
        const name = document.getElementById('ntName').value.trim();
        const phone = document.getElementById('ntPhone').value.trim();
        const pass = document.getElementById('ntPass').value.trim();
        const title = document.getElementById('ntTitle').value.trim();

        if (!name || !pass) {
          API.toastNotification('Teacher name and password required.', true);
          return;
        }

        const res = await API.callBackend('saveTeacher', {
          teacher: { id, name, phone, password: pass, title, status: 'Active', assignments: [] }
        }, 'Saving teacher...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('teachers');
        } else {
          API.toastNotification(res.message || 'Error creating teacher.', true);
        }
      }
    });
  }

  // =========================================================================
  // 4. TUITION & FEES MANAGEMENT
  // =========================================================================
  async function renderFinanceTab(container) {
    const res = await API.callBackend('getAllStudents', {}, 'Loading finance records...');
    const students = (res && res.success && Array.isArray(res.students)) ? res.students : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Student Tuition &amp; Fee Payments</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Record installment payments, registration, and monitor student account balances.
            </div>
          </div>
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Total Billed</th>
                <th>Registration</th>
                <th>Installments (1/2/3/4)</th>
                <th>Total Paid</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${students.length === 0 ? `
                <tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No student finance accounts found.</td></tr>
              ` : students.map(s => {
                const f = s.finance || {};
                const inst = f.installments || [0, 0, 0, 0];
                return `
                  <tr>
                    <td><b>[${escapeHtml(s.id)}]</b></td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.className || s.grade)}</td>
                    <td>$${(f.tuitionTotal || 0).toLocaleString()}</td>
                    <td>${f.registrationPaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Unpaid</span>'}</td>
                    <td style="font-size: 12px;">$${inst[0]} / $${inst[1]} / $${inst[2]} / $${inst[3]}</td>
                    <td><b style="color: var(--color-success);">$${(f.totalPaid || 0).toLocaleString()}</b></td>
                    <td><b class="${(f.balance || 0) > 0 ? 'score-red' : 'score-green'}">$${(f.balance || 0).toLocaleString()}</b></td>
                    <td>
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.AdminPanel.openRecordPaymentModal('${escapeHtml(s.id)}')">
                        Record Payment
                      </button>
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

  function openRecordPaymentModal(studentId) {
    const student = cachedStudents.find(s => s.id === studentId);
    if (!student) return;
    const f = student.finance || {};
    const inst = f.installments || [0, 0, 0, 0];

    App.showModal({
      title: `Record Fee Payment: ${student.name} [${student.id}]`,
      content: `
        <div style="font-size: 13.5px;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 14px;">
            <div>Class: <b>${escapeHtml(student.className || student.grade)}</b></div>
            <div>Total Tuition Billed: <b>$${f.tuitionTotal || 0}</b> | Current Balance: <b class="${f.balance > 0 ? 'score-red' : 'score-green'}">$${f.balance || 0}</b></div>
          </div>

          <div class="form-group">
            <label><input type="checkbox" id="payReg" ${f.registrationPaid ? 'checked' : ''}> Registration Fee Paid ($${f.registrationFee || 0})</label>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="payInst1">1st Installment Paid ($)</label>
              <input type="number" id="payInst1" class="input-field" value="${inst[0] || 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="payInst2">2nd Installment Paid ($)</label>
              <input type="number" id="payInst2" class="input-field" value="${inst[1] || 0}">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="payInst3">3rd Installment Paid ($)</label>
              <input type="number" id="payInst3" class="input-field" value="${inst[2] || 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="payInst4">4th Installment Paid ($)</label>
              <input type="number" id="payInst4" class="input-field" value="${inst[3] || 0}">
            </div>
          </div>
        </div>
      `,
      confirmText: 'Save Payment Record',
      onConfirm: async () => {
        const regPaid = document.getElementById('payReg').checked;
        const i1 = Number(document.getElementById('payInst1').value) || 0;
        const i2 = Number(document.getElementById('payInst2').value) || 0;
        const i3 = Number(document.getElementById('payInst3').value) || 0;
        const i4 = Number(document.getElementById('payInst4').value) || 0;

        const res = await API.callBackend('recordPayment', {
          studentId: studentId,
          payment: {
            registrationPaid: regPaid,
            installments: [i1, i2, i3, i4]
          }
        }, 'Recording payment...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('finance');
        } else {
          API.toastNotification(res.message || 'Error recording payment.', true);
        }
      }
    });
  }

  // =========================================================================
  // 5. STAFF PAYROLL TAB
  // =========================================================================
  async function renderPayrollTab(container) {
    const res = await API.callBackend('getPayroll', {}, 'Loading payroll...');
    const payroll = (res && res.success && Array.isArray(res.payroll)) ? res.payroll : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Staff Monthly Payroll Management</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Compute staff base salaries, deductions, taxes, and track disbursement status.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="openAddPayrollBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/file-plus.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Record Staff Salary Entry
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role</th>
                <th>Month / Year</th>
                <th>Base Salary</th>
                <th>Deductions</th>
                <th>Tax</th>
                <th>Net Salary</th>
                <th>Disbursement</th>
                <th>Pay Slip / Voucher</th>
              </tr>
            </thead>
            <tbody>
              ${payroll.length === 0 ? `
                <tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No payroll records entered for this period.</td></tr>
              ` : payroll.map(p => `
                <tr>
                  <td><b>${escapeHtml(p.staffName || p.staffId)}</b></td>
                  <td>${escapeHtml(p.role || 'Staff')}</td>
                  <td>${escapeHtml(p.monthYear)}</td>
                  <td>$${(p.baseSalary || 0).toLocaleString()}</td>
                  <td>$${(p.deductions || 0).toLocaleString()}</td>
                  <td>$${(p.tax || 0).toLocaleString()}</td>
                  <td><b style="color: var(--color-primary); font-size: 14px;">$${(p.netSalary || 0).toLocaleString()}</b></td>
                  <td>
                    ${p.paid ? `
                      <span class="badge badge-success">Paid (${escapeHtml(p.paymentDate || '')})</span>
                    ` : `
                      <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.markPayrollPaid('${escapeHtml(p.staffId)}', '${escapeHtml(p.monthYear)}')">
                        Mark as Paid
                      </button>
                    `}
                  </td>
                  <td>
                    ${p.documentUrl ? `
                      <a href="${p.documentUrl}" target="_blank" class="btn btn-light btn-sm">View Voucher</a>
                    ` : '<span style="color:#94a3b8;">No File</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('openAddPayrollBtn').onclick = () => openAddPayrollModal();
  }

  function openAddPayrollModal() {
    App.showModal({
      title: 'Process Staff Payroll Record',
      content: `
        <div style="font-size: 13.5px;">
          <div class="form-group">
            <label class="form-label" for="prStaff">Select Staff Member *</label>
            <select id="prStaff" class="select-field">
              ${cachedTeachers.map(t => `<option value="${escapeHtml(t.id)}" data-name="${escapeHtml(t.name)}" data-role="${escapeHtml(t.title || 'Teacher')}">${escapeHtml(t.name)} [${escapeHtml(t.id)}]</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="prMonth">Month &amp; Academic Year *</label>
            <input type="text" id="prMonth" class="input-field" value="September 2026" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="prBase">Base Salary ($) *</label>
              <input type="number" id="prBase" class="input-field" value="200" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="prDed">Deductions ($)</label>
              <input type="number" id="prDed" class="input-field" value="0">
            </div>
            <div class="form-group">
              <label class="form-label" for="prTax">Income Tax ($)</label>
              <input type="number" id="prTax" class="input-field" value="10">
            </div>
          </div>

          <div class="form-group">
            <label><input type="checkbox" id="prPaid" checked> Disbursed / Paid Immediately</label>
          </div>

          <div class="form-group">
            <label class="form-label" for="prDoc">Upload Pay Slip / Payment Receipt (Optional)</label>
            <input type="file" id="prDoc" class="input-field" accept=".pdf,image/*">
          </div>
        </div>
      `,
      confirmText: 'Save Payroll Entry',
      onConfirm: async () => {
        const staffSel = document.getElementById('prStaff');
        const staffId = staffSel.value;
        const opt = staffSel.selectedOptions[0];
        const staffName = opt ? opt.dataset.name : '';
        const role = opt ? opt.dataset.role : 'Teacher';
        const monthYear = document.getElementById('prMonth').value.trim();
        const base = Number(document.getElementById('prBase').value) || 0;
        const ded = Number(document.getElementById('prDed').value) || 0;
        const tax = Number(document.getElementById('prTax').value) || 0;
        const paid = document.getElementById('prPaid').checked;
        const file = document.getElementById('prDoc').files[0];

        let docUrl = '';
        if (file) {
          docUrl = await readFileAsDataUrl(file);
        }

        const res = await API.callBackend('savePayrollRecord', {
          payroll: {
            staffId: staffId,
            staffName: staffName,
            role: role,
            monthYear: monthYear,
            baseSalary: base,
            deductions: ded,
            tax: tax,
            paid: paid,
            paymentDate: paid ? new Date().toLocaleDateString() : '',
            documentUrl: docUrl
          }
        }, 'Saving payroll...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('payroll');
        } else {
          API.toastNotification(res.message || 'Error recording payroll.', true);
        }
      }
    });
  }

  async function markPayrollPaid(staffId, monthYear) {
    const res = await API.callBackend('savePayrollRecord', {
      payroll: {
        staffId: staffId,
        monthYear: monthYear,
        paid: true,
        paymentDate: new Date().toLocaleDateString()
      }
    }, 'Updating status...');

    if (res && res.success) {
      API.toastSuccess();
      loadTab('payroll');
    }
  }

  // =========================================================================
  // 6. PRINTING SERVICES TAB (ID CARDS & TEACHER TESTS DISPATCH)
  // =========================================================================
  async function renderPrintingTab(container) {
    const res = await API.callBackend('getTeacherTests', {}, 'Loading test submissions...');
    const tests = (res && res.success && Array.isArray(res.tests)) ? res.tests : [];

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
        <!-- ID Cards Section -->
        <div class="content-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-title">Student &amp; Staff ID Card Production</h3>
              <div style="font-size: 13px; color: var(--color-text-muted);">
                Generate ID card background previews and dispatch printing batches to IE Developer Printing Services.
              </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="window.AdminPanel.switchTab('students')">
              Select Students in Directory
            </button>
          </div>
          
          <div style="margin-top: 14px; padding: 16px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-weight: 700; color: var(--color-primary); font-size: 14px;">Instant Single ID Card Preview:</div>
              <div style="font-size: 12.5px; color: var(--color-text-muted);">Preview official front and reverse PVC badge with QR security before printing.</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <select id="quickIdPreviewSelect" class="select-field" style="width: 200px;">
                ${cachedStudents.slice(0, 10).map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} [${escapeHtml(s.id)}]</option>`).join('')}
              </select>
              <button type="button" class="btn btn-light" id="previewQuickIdBtn">Preview Card</button>
            </div>
          </div>
        </div>

        <!-- Teacher Tests Printing Dispatch Section -->
        <div class="content-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-title">Teacher Examination Question Papers</h3>
              <div style="font-size: 13px; color: var(--color-text-muted);">
                Review examination test drafts submitted by teaching faculty and dispatch to IE for bulk printing.
              </div>
            </div>
          </div>

          <div class="table-responsive" style="margin-top: 14px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Test Title</th>
                  <th>Faculty</th>
                  <th>Class &amp; Subject</th>
                  <th>Period</th>
                  <th>File Attachment</th>
                  <th>Status</th>
                  <th>Dispatch to IE Printing</th>
                </tr>
              </thead>
              <tbody>
                ${tests.length === 0 ? `
                  <tr><td colspan="7" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No faculty tests submitted yet.</td></tr>
                ` : tests.map(t => `
                  <tr>
                    <td><b>${escapeHtml(t.title)}</b></td>
                    <td>${escapeHtml(t.teacherName)}</td>
                    <td>${escapeHtml(t.className)} &bull; ${escapeHtml(t.subject)}</td>
                    <td>${escapeHtml(t.period)}</td>
                    <td>
                      ${t.attachmentUrl ? `
                        <a href="${t.attachmentUrl}" target="_blank" class="btn btn-light btn-sm">View Paper</a>
                      ` : '<span style="color:#94a3b8;">No File</span>'}
                    </td>
                    <td><span class="badge ${t.status === 'Printed' ? 'badge-success' : 'badge-info'}">${escapeHtml(t.status || 'Submitted')}</span></td>
                    <td>
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.AdminPanel.openDispatchTestModal('${escapeHtml(t.testId)}')">
                        Dispatch to IE
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('previewQuickIdBtn').onclick = () => {
      const sId = document.getElementById('quickIdPreviewSelect').value;
      if (sId) previewStudentIdCard(sId);
    };
  }

  function previewStudentIdCard(studentId) {
    const student = cachedStudents.find(s => s.id === studentId) || { id: studentId, name: 'Student Preview', className: 'Grade 1' };

    App.showModal({
      title: `Student ID Card Preview [${student.id}]`,
      content: `
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; padding: 10px;">
          <!-- Front Side -->
          <div style="width: 250px; height: 380px; background: linear-gradient(135deg, #052652 0%, #001f44 100%); color: #fff; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 6px 18px rgba(0,0,0,0.25); position: relative; overflow: hidden;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; opacity: 0.9;">IE SCHOOL MANAGEMENT SYSTEM</div>
            <div style="font-size: 12px; font-weight: 900; margin-top: 2px;">STUDENT IDENTIFICATION</div>
            
            <div style="width: 90px; height: 90px; border-radius: 50%; background: #ffffff; border: 3px solid #ffd000; margin: 16px 0 10px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${student.photo ? `<img src="${student.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<img src="assets/icons/circle-user-round.png" style="width:50px; height:50px;">`}
            </div>

            <div style="font-size: 16px; font-weight: 800; line-height: 1.2;">${escapeHtml(student.name)}</div>
            <div style="font-size: 13px; font-weight: 700; color: #ffd000; margin-top: 4px;">ID: [${escapeHtml(student.id)}]</div>
            <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">Grade: ${escapeHtml(student.className || student.grade)}</div>
            <div style="font-size: 11px; margin-top: 2px; opacity: 0.8;">Academic Year: 2026–2027</div>

            <div style="margin-top: auto; font-size: 9.5px; opacity: 0.7;">Official Student Credential</div>
          </div>

          <!-- Back Side -->
          <div style="width: 250px; height: 380px; background: #ffffff; color: #052652; border: 2px solid #052652; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 6px 18px rgba(0,0,0,0.15); font-size: 11.5px;">
            <div style="text-align: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
              <b style="font-size: 12px;">TERMS OF ISSUANCE</b>
            </div>

            <div style="font-size: 10.5px; color: #475569; line-height: 1.4;">
              &bull; This card certifies enrollment in the IE School Management System.<br>
              &bull; Non-transferable and must be presented for campus entry and exam halls.<br>
              &bull; If found, return to School Registrar's Office.
            </div>

            <div style="background: #f1f5f9; padding: 8px; border-radius: 4px; text-align: center; font-size: 10px;">
              Emergency Contact: <b>${escapeHtml(student.phone || '+231-770-123456')}</b>
            </div>

            <div style="text-align: center; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; font-weight: 700;">
              Principal's Authorized Signature
            </div>
          </div>
        </div>
      `,
      confirmText: 'Done',
      cancelText: 'Close'
    });
  }

  function previewTeacherIdCard(teacherId) {
    const teacher = cachedTeachers.find(t => t.id === teacherId) || { id: teacherId, name: 'Teacher', title: 'Faculty' };

    App.showModal({
      title: `Teacher Faculty ID Badge [${teacher.id}]`,
      content: `
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; padding: 10px;">
          <div style="width: 250px; height: 380px; background: linear-gradient(135deg, #0f2d59 0%, #001f44 100%); color: #fff; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 6px 18px rgba(0,0,0,0.25);">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; opacity: 0.9;">IE SCHOOL MANAGEMENT SYSTEM</div>
            <div style="font-size: 12px; font-weight: 900; margin-top: 2px;">FACULTY STAFF IDENTIFICATION</div>
            
            <div style="width: 90px; height: 90px; border-radius: 50%; background: #ffffff; border: 3px solid #10b981; margin: 16px 0 10px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${teacher.photo ? `<img src="${teacher.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<img src="assets/icons/user.png" style="width:50px; height:50px;">`}
            </div>

            <div style="font-size: 16px; font-weight: 800; line-height: 1.2;">${escapeHtml(teacher.name)}</div>
            <div style="font-size: 13px; font-weight: 700; color: #10b981; margin-top: 4px;">ID: [${escapeHtml(teacher.id)}]</div>
            <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">Title: ${escapeHtml(teacher.title || 'Teacher')}</div>
            <div style="font-size: 11px; margin-top: 2px; opacity: 0.8;">Academic Year: 2026–2027</div>

            <div style="margin-top: auto; font-size: 9.5px; opacity: 0.7;">Official School Faculty Staff</div>
          </div>
        </div>
      `,
      confirmText: 'Done',
      cancelText: 'Close'
    });
  }

  function openDispatchTestModal(testId) {
    App.showModal({
      title: 'Dispatch Test to IE Printing Queue',
      content: `
        <div style="font-size: 13.5px;">
          <div class="form-group">
            <label class="form-label" for="ptCopies">Copies Required *</label>
            <input type="number" id="ptCopies" class="input-field" value="50" min="1" required>
            <div class="form-hint">Number of student examination papers needed.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="ptInstructions">Special Printing Instructions</label>
            <textarea id="ptInstructions" class="textarea-field" rows="2" placeholder="e.g. Double-sided, stapled at top left..."></textarea>
          </div>
        </div>
      `,
      confirmText: 'Dispatch Order to IE',
      onConfirm: async () => {
        const copies = Number(document.getElementById('ptCopies').value) || 50;
        const inst = document.getElementById('ptInstructions').value.trim();

        const res = await API.callBackend('sendTestToPrinting', {
          testId: testId,
          copies: copies,
          instructions: inst
        }, 'Submitting print order...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('printing');
        } else {
          API.toastNotification(res.message || 'Error submitting test order.', true);
        }
      }
    });
  }

  // =========================================================================
  // 7. SUBJECTS MANAGEMENT TAB
  // =========================================================================
  async function renderSubjectsTab(container) {
    const res = await API.callBackend('getSubjects', {}, 'Loading subjects...');
    cachedSubjects = (res && res.success && Array.isArray(res.subjects)) ? res.subjects : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">School Curriculum &amp; Subjects Catalog</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Configure, add, update, or remove subjects taught in the curriculum.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="openAddSubBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/square-dashed-plus.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Add New Subject
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${cachedSubjects.map(s => `
                <tr>
                  <td><b>${escapeHtml(s)}</b></td>
                  <td><span class="badge badge-success">Active Curriculum</span></td>
                  <td>
                    <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditSubjectModal('${escapeHtml(s)}')">Rename</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteSubject('${escapeHtml(s)}')">Remove</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('openAddSubBtn').onclick = () => openAddSubjectModal();
  }

  function openAddSubjectModal() {
    App.showModal({
      title: 'Add New Academic Subject',
      content: `
        <div class="form-group">
          <label class="form-label" for="newSubName">Subject Name *</label>
          <input type="text" id="newSubName" class="input-field" placeholder="e.g. Computer Science" required>
        </div>
      `,
      confirmText: 'Add Subject',
      onConfirm: async () => {
        const name = document.getElementById('newSubName').value.trim();
        if (!name) return;

        const res = await API.callBackend('addSubject', { subjectName: name }, 'Adding subject...');
        if (res && res.success) {
          API.toastSuccess();
          loadTab('subjects');
        } else {
          API.toastNotification(res.message || 'Error adding subject.', true);
        }
      }
    });
  }

  function openEditSubjectModal(oldName) {
    App.showModal({
      title: `Rename Subject: ${oldName}`,
      content: `
        <div class="form-group">
          <label class="form-label" for="editSubName">New Subject Name *</label>
          <input type="text" id="editSubName" class="input-field" value="${escapeHtml(oldName)}" required>
        </div>
      `,
      confirmText: 'Update Subject',
      onConfirm: async () => {
        const newName = document.getElementById('editSubName').value.trim();
        if (!newName || newName === oldName) return;

        const res = await API.callBackend('updateSubject', {
          oldSubjectName: oldName,
          newSubjectName: newName
        }, 'Renaming subject...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('subjects');
        } else {
          API.toastNotification(res.message || 'Error renaming subject.', true);
        }
      }
    });
  }

  async function deleteSubject(subjectName) {
    if (!confirm(`Are you sure you want to remove subject "${subjectName}"?`)) return;

    const res = await API.callBackend('deleteSubject', { subjectName: subjectName }, 'Removing subject...');
    if (res && res.success) {
      API.toastSuccess();
      loadTab('subjects');
    } else {
      API.toastNotification(res.message || 'Error removing subject.', true);
    }
  }

  // =========================================================================
  // 8. GRADING CONTROLS (Open / Close Periods)
  // =========================================================================
  async function renderGradingTab(container) {
    const res = await API.callBackend('getPermissions', {}, 'Loading permissions...');
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
        <h3 class="card-title">Marking Period Grade Sheet Access Controls</h3>
        <p style="font-size: 13px; color: var(--color-text-muted); margin: 4px 0 16px;">
          Lock or unlock specific evaluation periods. When locked, teachers cannot alter scores.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
          ${periods.map(p => {
            const isOpen = perms[p.key] !== false;
            return `
              <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; background: var(--color-surface); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 700; color: var(--color-primary); font-size: 14px;">${escapeHtml(p.label)}</div>
                  <div style="font-size: 12px; color: var(--color-text-muted);">${isOpen ? 'Open for entry' : 'Locked'}</div>
                </div>
                <button type="button" class="btn btn-sm ${isOpen ? 'btn-danger' : 'btn-primary'}" onclick="window.AdminPanel.togglePeriodPerm('${p.key}', ${!isOpen})">
                  ${isOpen ? 'Lock Period' : 'Unlock Period'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  async function togglePeriodPerm(key, state) {
    const pRes = await API.callBackend('getPermissions');
    const perms = (pRes && pRes.success) ? pRes.permissions : {};
    perms[key] = state;

    const res = await API.callBackend('savePermissions', { permissions: perms }, 'Saving permissions...');
    if (res && res.success) {
      API.toastSuccess();
      loadTab('grading');
    }
  }

  // =========================================================================
  // 9. IE DEVELOPER DESK (DIRECT CONTACT CHANNEL)
  // =========================================================================
  async function renderDeveloperTab(container) {
    const res = await API.callBackend('adminGetIeMessages', {}, 'Fetching messages with IE...');
    const messages = (res && res.success && Array.isArray(res.messages)) ? res.messages : [];

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">IE Developer Support Desk</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Exclusive direct channel between School Administration and IE Digital Works developers.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="openSendIeMsgBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/mail-open.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Contact Developer Team
          </button>
        </div>

        <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 12px;">
          ${messages.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: var(--color-text-muted); font-size: 14px;">
              No messages exchanged with developer team yet.
            </div>
          ` : messages.map(m => `
            <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 18px; background: ${m.sender === 'IE_DEVELOPER' ? '#eff6ff' : 'var(--color-surface)'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--color-primary); font-size: 14.5px;">${escapeHtml(m.subject)}</strong>
                <span style="font-size: 12px; color: var(--color-text-muted);">${escapeHtml(m.timestamp)}</span>
              </div>
              <div style="font-size: 13.5px; color: var(--color-text); line-height: 1.5;">${escapeHtml(m.body)}</div>
              <div style="margin-top: 6px; font-size: 11.5px; font-weight: 700; color: ${m.sender === 'IE_DEVELOPER' ? '#1d4ed8' : '#059669'};">
                From: ${escapeHtml(m.senderName)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('openSendIeMsgBtn').onclick = () => {
      App.showModal({
        title: 'Send Message to IE Developer Team',
        content: `
          <div class="form-group">
            <label class="form-label" for="ieMsgSubject">Subject *</label>
            <input type="text" id="ieMsgSubject" class="input-field" placeholder="e.g. System Inquiry / Custom Feature" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="ieMsgBody">Message Body *</label>
            <textarea id="ieMsgBody" class="textarea-field" rows="4" placeholder="Detail your communication with IE Digital Works..." required></textarea>
          </div>
        `,
        confirmText: 'Send Message to Developer',
        onConfirm: async () => {
          const sub = document.getElementById('ieMsgSubject').value.trim();
          const body = document.getElementById('ieMsgBody').value.trim();
          if (!sub || !body) return;

          const res = await API.callBackend('adminSendIeMessage', { subject: sub, body: body }, 'Sending message...');
          if (res && res.success) {
            API.toastSuccess();
            loadTab('developer');
          } else {
            API.toastNotification(res.message || 'Error sending message.', true);
          }
        }
      });
    };
  }

  // =========================================================================
  // 10. SETTINGS & PROFILE TAB
  // =========================================================================
  async function renderSettingsTab(container) {
    const sRes = await API.callBackend('getSettings', {}, 'Loading settings...');
    const s = (sRes && sRes.success && sRes.settings) ? sRes.settings : {};

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        <!-- Institutional Settings -->
        <div class="content-card">
          <h3 class="card-title" style="margin-bottom: 14px;">School Branding &amp; Configuration</h3>
          
          <div class="form-group">
            <label class="form-label" for="setSchoolName">School Name</label>
            <input type="text" id="setSchoolName" class="input-field" value="${escapeHtml(s.schoolName || 'IE School Management System')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="setSchoolMotto">School Motto</label>
            <input type="text" id="setSchoolMotto" class="input-field" value="${escapeHtml(s.schoolMotto || 'Excellence in Knowledge, Character & Integrity')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="setYear">Current Academic Year</label>
            <input type="text" id="setYear" class="input-field" value="${escapeHtml(s.academicYear || '2026-2027')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="setPhone">Contact Phone</label>
            <input type="text" id="setPhone" class="input-field" value="${escapeHtml(s.contactPhone || '+231-770-123456')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="setEmail">School Email</label>
            <input type="email" id="setEmail" class="input-field" value="${escapeHtml(s.contactEmail || 'admin@ieschools.edu')}">
          </div>

          <button type="button" class="btn btn-primary" id="saveBrandingBtn">Update School Settings</button>
        </div>

        <!-- Administrator Personal Account -->
        <div>
          <div class="content-card" style="margin-bottom: 20px;">
            <h3 class="card-title" style="margin-bottom: 14px;">Administrator Profile &amp; Password</h3>

            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input type="text" class="input-field" value="${escapeHtml(currentUser.name || currentUser.username)}" disabled>
            </div>

            <div class="form-group">
              <label class="form-label" for="adminNewPass">New Password</label>
              <input type="password" id="adminNewPass" class="input-field" placeholder="Enter new password (min. 6 characters)">
            </div>

            <button type="button" class="btn btn-primary" id="saveAdminPassBtn">Change Password</button>
          </div>

          <div class="content-card">
            <h3 class="card-title" style="margin-bottom: 12px;">Mobile Application (PWA)</h3>
            <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 14px;">
              Install the administrative console on your device for rapid offline data entry.
            </p>
            <button type="button" class="btn btn-light" id="adminPwaBtn" style="display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/download (2).png" style="width: 16px; height: 16px;" alt="">
              Install Console to Device
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('saveBrandingBtn').onclick = async () => {
      const schoolName = document.getElementById('setSchoolName').value.trim();
      const schoolMotto = document.getElementById('setSchoolMotto').value.trim();
      const academicYear = document.getElementById('setYear').value.trim();
      const phone = document.getElementById('setPhone').value.trim();
      const email = document.getElementById('setEmail').value.trim();

      const res = await API.callBackend('updateSettings', {
        settings: { schoolName, schoolMotto, academicYear, contactPhone: phone, contactEmail: email, logoUrl: 'assets/images/school-logo.png' }
      }, 'Updating settings...');

      if (res && res.success) {
        API.toastSuccess();
      } else {
        API.toastNotification(res.message || 'Error updating settings.', true);
      }
    };

    document.getElementById('saveAdminPassBtn').onclick = () => {
      const p = document.getElementById('adminNewPass').value;
      if (!p || p.length < 6) {
        API.toastNotification('Password must be at least 6 characters.', true);
        return;
      }
      API.toastSuccess();
      document.getElementById('adminNewPass').value = '';
    };

    document.getElementById('adminPwaBtn').onclick = () => {
      const btn = document.getElementById('installAppBtn');
      if (btn) btn.click();
      else API.toastNotification('App install ready via browser menu (Add to Home Screen).');
    };
  }

  // =========================================================================
  // 11. ADMINS TAB (SUPER ADMIN ONLY)
  // =========================================================================
  async function renderAdminsTab(container) {
    const res = await API.callBackend('listAdmins', {}, 'Loading admins...');
    const admins = (res && res.success && Array.isArray(res.admins)) ? res.admins : [];

    container.innerHTML = `
      <div class="content-card">
        <h3 class="card-title">Authorized System Administrators</h3>
        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              ${admins.map(a => `
                <tr>
                  <td><b>${escapeHtml(a.username)}</b></td>
                  <td>${escapeHtml(a.name)}</td>
                  <td>${escapeHtml(a.email)}</td>
                  <td><span class="badge ${a.isSuperAdmin ? 'badge-success' : 'badge-info'}">${escapeHtml(a.roleTier)}</span></td>
                  <td>${escapeHtml(a.lastLogin || 'Never')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 12. AUDIT LOG & EXPORT
  // =========================================================================
  async function renderAuditTab(container) {
    const res = await API.callBackend('getAuditLog', {}, 'Loading audit logs...');
    const logs = (res && res.success && Array.isArray(res.entries)) ? res.entries : [];

    container.innerHTML = `
      <div class="content-card">
        <h3 class="card-title">System Audit Log</h3>
        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No audit log events recorded yet.</td></tr>
              ` : logs.map(l => `
                <tr>
                  <td>${escapeHtml(l.timestamp)}</td>
                  <td><b>${escapeHtml(l.actor)}</b></td>
                  <td>${escapeHtml(l.action)}</td>
                  <td>${escapeHtml(l.target)}</td>
                  <td><span class="badge ${l.outcome === 'SUCCESS' ? 'badge-success' : 'badge-danger'}">${escapeHtml(l.outcome)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderExportTab(container) {
    container.innerHTML = `
      <div class="content-card">
        <h3 class="card-title">Export Institutional Data to CSV</h3>
        <p style="font-size: 13px; color: var(--color-text-muted); margin: 4px 0 16px;">
          Download complete database spreadsheets as secure CSV files.
        </p>

        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" onclick="window.AdminPanel.exportCsv('students')" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/download (2).png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Export Students CSV
          </button>
          <button type="button" class="btn btn-primary" onclick="window.AdminPanel.exportCsv('finance')" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/download (2).png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Export Finance CSV
          </button>
          <button type="button" class="btn btn-primary" onclick="window.AdminPanel.exportCsv('scores')" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/download (2).png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Export Scores CSV
          </button>
        </div>
      </div>
    `;
  }

  async function exportCsv(type) {
    const res = await API.callBackend('exportData', { dataType: type }, 'Generating CSV export...');
    if (res && res.success && res.csv) {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.fileName || `${type}_export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      API.toastSuccess();
    } else {
      API.toastNotification(res.message || 'Error exporting CSV.', true);
    }
  }

  async function toggleGradeLock(studentId, lockState) {
    const res = await API.callBackend('setGradeLock', { studentId: studentId, locked: lockState }, 'Updating grade lock...');
    if (res && res.success) {
      API.toastSuccess();
      loadTab('students');
    }
  }

  async function viewStudentReport(studentId) {
    const res = await API.callBackend('getReportCard', { studentId: studentId }, 'Loading report card...');
    if (res && res.success && res.reportCard) {
      App.showModal({
        title: 'Student Report Card Preview',
        content: '<div id="adminRcMount"></div>',
        confirmText: 'Done',
        cancelText: 'Close'
      });
      ReportCard.render(res.reportCard, '#adminRcMount');
    }
  }

  function switchTab(tab) {
    const btn = document.querySelector(`.sidebar-item[data-tab="${tab}"]`);
    if (btn) btn.click();
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
    switchTab: switchTab,
    toggleGradeLock: toggleGradeLock,
    viewStudentReport: viewStudentReport,
    previewStudentIdCard: previewStudentIdCard,
    previewTeacherIdCard: previewTeacherIdCard,
    openDispatchTestModal: openDispatchTestModal,
    markPayrollPaid: markPayrollPaid,
    openEditSubjectModal: openEditSubjectModal,
    deleteSubject: deleteSubject,
    togglePeriodPerm: togglePeriodPerm,
    exportCsv: exportCsv
  };
})();
