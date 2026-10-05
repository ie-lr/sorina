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
  let cachedAdmins = [];
  let cachedPayroll = [];
  let cachedExpenses = JSON.parse(localStorage.getItem('sorina_expenses') || '[]');
  let cachedAnnouncements = JSON.parse(localStorage.getItem('sorina_announcements') || '[]');
  let cachedCustomStaff = JSON.parse(localStorage.getItem('sorina_custom_staff') || '[]');
  let cachedSubjects = [];
  let isSidebarCollapsed = false;
  let selectedStudentIdsForPrint = new Set();

  function hasPerm(permKey) {
    if (!currentUser) return true;
    if (currentUser.role === 'superadmin') return true;
    return Boolean(currentUser.permissions && currentUser.permissions[permKey]);
  }

  const GRADE_LEVELS = [
    'Daycare',
    'Nursery',
    'ABC',
    'K1',
    'K2',
    'Grade 1',
    'Grade 2',
    'Grade 3',
    'Grade 4',
    'Grade 5',
    'Grade 6',
    'Grade 7',
    'Grade 8',
    'Grade 9',
    'Grade 10',
    'Grade 11',
    'Grade 12'
  ];

  let cachedClassFees = [];
  let dashboardCurrency = localStorage.getItem('sorina_dashboard_currency') || 'USD';
  function currencySymbol(code){ return code === 'LRD' ? 'LRD' : 'USD'; }
  function previousAcademicYear(year){
    const m=String(year||'').match(/^(\d{4})[-\/](\d{4})$/);
    return m ? `${Number(m[1])-1}-${Number(m[2])-1}` : '';
  }
  function moneyLabel(v, code=dashboardCurrency){ return currencySymbol(code)+' '+toNum(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function getCatalogSubjects(){ try{const x=JSON.parse(localStorage.getItem('_sorina_subject_catalog')||'null'); if(Array.isArray(x)&&x.length){ const meta=JSON.parse(localStorage.getItem('_sorina_subject_meta')||'{}'); return x.filter(n=>!meta[n]||meta[n].status!=='Inactive'); }}catch(e){} return CURRICULUM_SUBJECTS; }
  function selectedCurriculumForClass(cls){ try{const m=JSON.parse(localStorage.getItem('_sorina_curriculum_map')||'{}'); return Array.isArray(m[cls])?m[cls]:[];}catch(e){return [];} }
  const DEFAULT_CLASS_FEES = {
    'Daycare': {
      new: { entranceFee: 20, registrationFee: 30, tuitionTotal: 150, requirementsFee: 25, peSuitFee: 20, portalFee: 15 },
      old: { entranceFee: 0, registrationFee: 25, tuitionTotal: 140, requirementsFee: 25, peSuitFee: 20, portalFee: 15 }
    },
    'Nursery': {
      new: { entranceFee: 20, registrationFee: 30, tuitionTotal: 160, requirementsFee: 25, peSuitFee: 20, portalFee: 15 },
      old: { entranceFee: 0, registrationFee: 25, tuitionTotal: 150, requirementsFee: 25, peSuitFee: 20, portalFee: 15 }
    },
    'ABC': {
      new: { entranceFee: 20, registrationFee: 35, tuitionTotal: 180, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
      old: { entranceFee: 0, registrationFee: 30, tuitionTotal: 170, requirementsFee: 30, peSuitFee: 20, portalFee: 15 }
    },
    'K1': {
      new: { entranceFee: 20, registrationFee: 35, tuitionTotal: 190, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
      old: { entranceFee: 0, registrationFee: 30, tuitionTotal: 180, requirementsFee: 30, peSuitFee: 20, portalFee: 15 }
    },
    'K2': {
      new: { entranceFee: 20, registrationFee: 35, tuitionTotal: 200, requirementsFee: 30, peSuitFee: 20, portalFee: 15 },
      old: { entranceFee: 0, registrationFee: 30, tuitionTotal: 190, requirementsFee: 30, peSuitFee: 20, portalFee: 15 }
    },
    'Grade 1': {
      new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 220, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
      old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 200, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
    },
    'Grade 2': {
      new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 220, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
      old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 200, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
    },
    'Grade 3': {
      new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 230, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
      old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 210, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
    },
    'Grade 4': {
      new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 240, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
      old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 220, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
    },
    'Grade 5': {
      new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 250, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
      old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 230, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
    },
    'Grade 6': {
      new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 260, requirementsFee: 35, peSuitFee: 25, portalFee: 20 },
      old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 240, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }
    },
    'Grade 7': { new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 270, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }, old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 250, requirementsFee: 35, peSuitFee: 25, portalFee: 20 } },
    'Grade 8': { new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 280, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }, old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 260, requirementsFee: 35, peSuitFee: 25, portalFee: 20 } },
    'Grade 9': { new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 290, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }, old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 270, requirementsFee: 35, peSuitFee: 25, portalFee: 20 } },
    'Grade 10': { new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 300, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }, old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 280, requirementsFee: 35, peSuitFee: 25, portalFee: 20 } },
    'Grade 11': { new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 310, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }, old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 290, requirementsFee: 35, peSuitFee: 25, portalFee: 20 } },
    'Grade 12': { new: { entranceFee: 25, registrationFee: 40, tuitionTotal: 320, requirementsFee: 35, peSuitFee: 25, portalFee: 20 }, old: { entranceFee: 0, registrationFee: 35, tuitionTotal: 300, requirementsFee: 35, peSuitFee: 25, portalFee: 20 } }
  };

  function getClassFeeSchedule(className, category) {
    category = String(category || 'new').toLowerCase();
    const found = cachedClassFees.find(f =>
      String(f.className).toLowerCase() === String(className).toLowerCase() &&
      String(f.studentCategory || 'new').toLowerCase() === category
    );
    if (found) return found;
    const defForClass = DEFAULT_CLASS_FEES[className] || DEFAULT_CLASS_FEES['Grade 1'];
    return (defForClass && defForClass[category]) || {
      entranceFee: category === 'new' ? 25 : 0,
      registrationFee: category === 'new' ? 40 : 35,
      tuitionTotal: 200,
      requirementsFee: 35,
      peSuitFee: 25,
      portalFee: 20
    };
  }

  function formatGradeCell(val) {
    if (val === null || val === undefined || val === '' || val === '—' || val === '-') return '—';
    const num = Number(val);
    if (isNaN(num)) {
      const s = String(val).trim().toUpperCase();
      if (s === 'A' || s === 'A+') return `<span class="score-deep-green">${escapeHtml(s)}</span>`;
      if (s === 'B' || s === 'C') return `<span class="score-blue">${escapeHtml(s)}</span>`;
      if (s === 'D' || s === 'F') return `<span class="score-red">${escapeHtml(s)}</span>`;
      return escapeHtml(s);
    }
    if (num >= 70) return `<span style="color:#082f50;font-weight:800;">${num}</span>`;
    if (num >= 60) return `<span style="color:#dc2626;font-weight:800;">${num}</span>`;
    return `<span style="color:#dc2626;font-weight:800;">${num}</span>`;
  }

  const ACADEMIC_YEARS = ['2026-2027','2027-2028','2028-2029','2029-2030','2030-2031'];
  let selectedAcademicYear = ACADEMIC_YEARS.includes(localStorage.getItem('sorina_selected_academic_year')) ? localStorage.getItem('sorina_selected_academic_year') : '2026-2027';

  function mount(container, user) {
    currentUser = user;
    const isSuper = user.role === 'superadmin';
    const perms = user.permissions || {};

    if (isSuper || perms['summary:view'] === true) currentTab = 'summary';
    else if (perms['students:view'] || perms['students:edit'] || perms['students:delete']) currentTab = 'students';
    else if (perms['teachers:view'] || perms['teachers:edit'] || perms['teachers:delete']) currentTab = 'teachers';
    else if (perms['finance:view'] || perms['finance:edit'] || perms['finance:delete']) currentTab = 'finance';
    else if (perms['payroll:view'] || perms['payroll:edit'] || perms['payroll:delete']) currentTab = 'payroll';
    else if (perms['messaging:view'] || perms['messaging:send']) currentTab = 'announcements';
    else if (perms['printing:view'] || perms['printing:send']) currentTab = 'printing';
    else if (perms['subjects:view'] || perms['subjects:edit'] || perms['subjects:delete']) currentTab = 'subjects';
    else if (isSuper || user.role === 'admin' || perms['scores:view'] || perms['scores:edit']) currentTab = 'gradeEntry';
    else if (perms['settings:edit']) currentTab = 'settings';
    else if (perms['audit:view']) currentTab = 'audit';
    else if (perms['export:view'] || perms['export:data']) currentTab = 'export';
    else currentTab = 'settings';

    renderPortalLayout(container);
    const gc=document.getElementById('adminGlobalCurrency'); if(gc) gc.onchange=()=>{dashboardCurrency=gc.value;localStorage.setItem('sorina_dashboard_currency',dashboardCurrency);loadTab(currentTab);};
    loadTab(currentTab);
  }

  function renderPortalLayout(container) {
    const isSuperAdmin = currentUser.role === 'superadmin';
    const perms = currentUser.permissions || {};

    const canSummary = isSuperAdmin || perms['summary:view'] === true;
    const canStudents = isSuperAdmin || perms['students:view'] || perms['students:edit'] || perms['students:delete'];
    const canTeachers = isSuperAdmin || perms['teachers:view'] || perms['teachers:edit'] || perms['teachers:delete'];
    const canFinance = isSuperAdmin || perms['finance:view'] || perms['finance:edit'] || perms['finance:delete'];
    const canPayroll = isSuperAdmin || perms['payroll:view'] || perms['payroll:edit'] || perms['payroll:delete'];
    const canPrinting = isSuperAdmin || perms['printing:view'] || perms['printing:send'];
    const canSubjects = isSuperAdmin || perms['subjects:view'] || perms['subjects:edit'] || perms['subjects:delete'];
    const canScores = isSuperAdmin || currentUser?.role === 'admin' || perms['scores:view'] || perms['scores:edit'];
    const canLessonPlans = isSuperAdmin || currentUser?.role === 'admin' || perms['lesson_plans:view'];
    const canSettings = isSuperAdmin || perms['settings:edit'];
    const canAudit = isSuperAdmin || perms['audit:view'];
    const canExport = isSuperAdmin || perms['export:view'] || perms['export:data'];

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

          <!-- Academic Year Selector -->
          <div class="sidebar-year-box" style="padding: 10px 14px; background: rgba(255,255,255,0.08); border-radius: 6px; margin: 10px 12px 14px;">
            <div style="font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 4px; color: #ffffff; font-weight: 600;">Academic Year</div>
            <select id="adminGlobalYearSelect" class="select-field" style="width: 100%; background: #ffffff; color: var(--color-primary); font-weight: 700; font-size: 12.5px; padding: 5px 8px; border-radius: 4px; cursor: pointer;">
              ${ACADEMIC_YEARS.map(y => `<option value="${y}" ${selectedAcademicYear === y ? 'selected' : ''}>${y.replace('-', '–')}</option>`).join('')}
            </select>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-title">Core Operations</div>

            ${canSummary ? `
              <a class="sidebar-item ${currentTab === 'summary' ? 'active' : ''}" data-tab="summary">
                <img src="assets/icons/tally-4.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Executive Summary</span>
              </a>
            ` : ''}

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
            ` : ''}

            ${canPayroll ? `
              <a class="sidebar-item ${currentTab === 'payroll' ? 'active' : ''}" data-tab="payroll">
                <img src="assets/icons/landmark.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">All Expenses</span>
              </a>
            ` : ''}

            <div class="nav-section-title">Academics &amp; Services</div>

            ${canPrinting ? `
              <a class="sidebar-item ${currentTab === 'printing' ? 'active' : ''}" data-tab="printing">
                <img src="assets/icons/file-text.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Printing Services</span>
              </a>
            ` : ''}

            ${canSubjects ? `
              <a class="sidebar-item ${currentTab === 'subjects' ? 'active' : ''}" data-tab="subjects">
                <img src="assets/icons/folders.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Subjects Catalog</span>
              </a>
            ` : ''}

            ${canScores ? `
              <a class="sidebar-item ${currentTab === 'gradeEntry' ? 'active' : ''}" data-tab="gradeEntry">
                <img src="assets/icons/pencil.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Grade Entry &amp; Submission</span>
              </a>
              <a class="sidebar-item ${currentTab === 'grading' ? 'active' : ''}" data-tab="grading">
                <img src="assets/icons/pencil.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Grading Controls</span>
              </a>
            ` : ''}

            ${canLessonPlans ? `
              <a class="sidebar-item ${currentTab === 'lessonPlans' ? 'active' : ''}" data-tab="lessonPlans">
                <img src="assets/icons/file-text.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Teacher Lesson Plans</span>
              </a>
            ` : ''}

            <div class="nav-section-title">Communication</div>

            ${isSuperAdmin || perms['messaging:view'] || perms['messaging:send'] ? `
              <a class="sidebar-item ${currentTab === 'announcements' ? 'active' : ''}" data-tab="announcements">
                <img src="assets/icons/bell-ring.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">School Announcements</span>
              </a>
            ` : ''}

            <div class="nav-section-title">Administration</div>

            ${isSuperAdmin ? `
              <a class="sidebar-item ${currentTab === 'developer' ? 'active' : ''}" data-tab="developer">
                <img src="assets/icons/mail-open.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">IE Developer Desk</span>
              </a>

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

            <a class="sidebar-item" id="adminLogoutBtn" role="button" tabindex="0" style="cursor: pointer;">
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

    // Academic Year Select handler
    const yearSelect = document.getElementById('adminGlobalYearSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        selectedAcademicYear = e.target.value;
        localStorage.setItem('sorina_selected_academic_year', selectedAcademicYear);
        App.showToast(`Switched active academic year to ${selectedAcademicYear}`, 'info');
        loadTab(currentTab);
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
        if (window.Auth && typeof window.Auth.logout === 'function') {
          window.Auth.logout();
        } else if (typeof window.logout === 'function') {
          window.logout();
        }
      });
    }
  }

  async function loadTab(tab) {
    const container = document.getElementById('adminContentBody');
    if (!container) return;
    container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--color-text-muted);">Loading section...</div>';

    const isSuper = currentUser.role === 'superadmin';
    const perms = currentUser.permissions || {};

    const permittedTabs = {
      summary: isSuper || perms['summary:view'] === true,
      students: isSuper || perms['students:view'] || perms['students:edit'] || perms['students:delete'],
      teachers: isSuper || perms['teachers:view'] || perms['teachers:edit'] || perms['teachers:delete'],
      finance: isSuper || perms['finance:view'] || perms['finance:edit'] || perms['finance:delete'],
      payroll: isSuper || perms['payroll:view'] || perms['payroll:edit'] || perms['payroll:delete'],
      announcements: isSuper || perms['messaging:view'] || perms['messaging:send'],
      printing: isSuper || perms['printing:view'] || perms['printing:send'],
      subjects: isSuper || perms['subjects:view'] || perms['subjects:edit'] || perms['subjects:delete'],
      gradeEntry: isSuper || currentUser?.role === 'admin' || perms['scores:view'] || perms['scores:edit'],
      lessonPlans: isSuper || currentUser?.role === 'admin' || perms['lesson_plans:view'],
      grading: isSuper || currentUser?.role === 'admin' || perms['scores:view'] || perms['scores:edit'],
      developer: isSuper,
      admins: isSuper,
      settings: isSuper || perms['settings:edit'],
      audit: isSuper || perms['audit:view'],
      export: isSuper || perms['export:view'] || perms['export:data']
    };

    if (!permittedTabs[tab]) {
      container.innerHTML = `
        <div class="content-card" style="text-align: center; padding: 50px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
          <h3 style="color: var(--color-danger); margin-bottom: 8px;">Access Restricted</h3>
          <p style="color: var(--color-text-muted); max-width: 480px; margin: 0 auto 16px;">
            You do not have assigned permissions to access the <b>${escapeHtml(tab)}</b> module. Please contact the Super Administrator if you require access.
          </p>
          <button type="button" class="btn btn-primary" onclick="window.AdminPanel.switchTab('summary')">Return to Summary</button>
        </div>
      `;
      return;
    }

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
        await renderExpensesTab(container);
        break;
      case 'announcements':
        await renderAnnouncementsTab(container);
        break;
      case 'printing':
        await renderPrintingTab(container);
        break;
      case 'subjects':
        await renderSubjectsTab(container);
        break;
      case 'curriculum':
        await renderCurriculumSubjectsTab(container);
        break;
      case 'gradeEntry':
        await renderAdminGradeEntryTab(container);
        break;
      case 'lessonPlans':
        await renderAdminLessonPlansTab(container);
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
  // 1. EXECUTIVE SUMMARY TAB (WITH ENROLLMENT PIE CHART)
  // =========================================================================
  function generatePieChartSvg(data, total) {
    if (!total || total === 0 || Object.keys(data).length === 0) {
      return `<div style="text-align: center; padding: 30px; color: var(--color-text-muted);">No student enrollment records filed for ${escapeHtml(selectedAcademicYear)}.</div>`;
    }
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ea580c', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];
    const cx = 130;
    const cy = 130;
    const r = 95;
    let cumulativeAngle = -Math.PI / 2;
    const entries = Object.entries(data);

    let paths = '';
    entries.forEach(([cls, count], idx) => {
      const fraction = count / total;
      const angle = fraction * 2 * Math.PI;
      const endAngle = cumulativeAngle + angle;

      const x1 = cx + r * Math.cos(cumulativeAngle);
      const y1 = cy + r * Math.sin(cumulativeAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const largeArcFlag = angle > Math.PI ? 1 : 0;
      const color = colors[idx % colors.length];

      if (entries.length === 1 || fraction >= 0.999) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"><title>${escapeHtml(cls)}: ${count} (${Math.round(fraction * 100)}%)</title></circle>`;
      } else {
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        paths += `<path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="2"><title>${escapeHtml(cls)}: ${count} (${Math.round(fraction * 100)}%)</title></path>`;
      }
      cumulativeAngle = endAngle;
    });

    // Donut hole
    paths += `<circle cx="${cx}" cy="${cy}" r="48" fill="#ffffff"></circle>`;
    paths += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#64748b">TOTAL</text>`;
    paths += `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="16" font-weight="800" fill="var(--color-primary)">${total}</text>`;

    const legend = entries.map(([cls, count], idx) => {
      const color = colors[idx % colors.length];
      const pct = Math.round((count / total) * 100);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; padding: 4px 0; border-bottom: 1px dashed #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${color}; flex-shrink: 0;"></span>
            <b>${escapeHtml(cls)}</b>
          </div>
          <div style="color: var(--color-text-muted);"><b style="color: var(--color-text-main);">${count}</b> (${pct}%)</div>
        </div>
      `;
    }).join('');

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: center; padding: 12px 0;">
        <div style="display: flex; justify-content: center;">
          <svg viewBox="0 0 260 260" width="220" height="220" style="max-width: 100%; height: auto;">
            ${paths}
          </svg>
        </div>
        <div style="max-height: 240px; overflow-y: auto; padding-right: 8px;">
          <div style="font-weight: 700; font-size: 13px; color: var(--color-primary); margin-bottom: 8px;">Class Enrollment Distribution Legend</div>
          ${legend}
        </div>
      </div>
    `;
  }

  async function renderSummaryTab(container) {
    const res = await API.callBackend('getFinancialSummary', { academicYear: selectedAcademicYear }, 'Loading summary...');
    const sum = (res && res.success && res.summary) ? res.summary : {
      totalStudents: 0, totalTeachers: 0, totalBilled: 0,
      totalRevenue: 0, totalExpenses: 0, netBalance: 0, targetRemaining: 0,
      enrolledByClass: {}
    };

    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-bottom:10px;"><label class="form-label" style="margin:0;">Dashboard Currency</label><select id="dashboardCurrencySelect" class="select-field" style="width:100px;"><option value="USD" ${dashboardCurrency==='USD'?'selected':''}>USD</option><option value="LRD" ${dashboardCurrency==='LRD'?'selected':''}>LRD</option></select></div>
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 style="margin: 0 0 6px; color: var(--color-primary); font-size: 22px;">Institutional Executive Summary</h2>
          <div style="font-size: 13.5px; color: var(--color-text-muted);">Real-time institutional metrics, class enrollment, and cash flow balance.</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <label for="summaryAcademicYear" style="font-size:12px;font-weight:700;color:#475569;">Academic Year</label>
          <select id="summaryAcademicYear" class="select-field" style="min-width:150px;font-weight:700;">${ACADEMIC_YEARS.map(y => `<option value="${y}" ${y===selectedAcademicYear?'selected':''}>${y.replace('-', '–')}</option>`).join('')}</select>
        </div>
      </div>

      <!-- Financial & Metric Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">Enrolled Students</div>
          <div class="stat-value">${sum.totalStudents}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Revenue Collected</div>
          <div class="stat-value" style="color: var(--color-success);">${currencySymbol(dashboardCurrency)} ${sum.totalRevenue.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value" style="color: var(--color-danger);">${currencySymbol(dashboardCurrency)} ${sum.totalExpenses.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Net Operating Balance</div>
          <div class="stat-value" style="color: ${sum.netBalance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'};">
            ${currencySymbol(dashboardCurrency)} ${sum.netBalance.toLocaleString()}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Target Remaining (Receivable)</div>
          <div class="stat-value" style="color: #d97706;">${currencySymbol(dashboardCurrency)} ${sum.targetRemaining.toLocaleString()}</div>
        </div>
      </div>

      <!-- Enrollment by Class with Pie Chart -->
      <div class="content-card" style="margin-bottom: 24px;">
        <h3 class="card-title" style="margin-bottom: 14px;">Enrollment Distribution by Class (Summary Pie Chart)</h3>
        ${generatePieChartSvg(sum.enrolledByClass, sum.totalStudents)}

        <div class="table-responsive" style="margin-top: 16px;">
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
                <tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--color-text-muted);">No student records filed yet for ${escapeHtml(selectedAcademicYear)}.</td></tr>
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
    const dc=document.getElementById('dashboardCurrencySelect'); if(dc) dc.onchange=()=>{dashboardCurrency=dc.value;localStorage.setItem('sorina_dashboard_currency',dashboardCurrency);loadTab('summary');};
    const sy=document.getElementById('summaryAcademicYear'); if(sy) sy.onchange=()=>{ selectedAcademicYear=sy.value; localStorage.setItem('sorina_selected_academic_year',selectedAcademicYear); const global=document.getElementById('adminGlobalYearSelect'); if(global) global.value=selectedAcademicYear; App.showToast(`Executive Summary set to academic year ${selectedAcademicYear}`, 'info'); loadTab('summary'); };
  }

  // =========================================================================
  // 2. STUDENTS TAB (SYSTEMATIC ID, NEW & OLD STUDENT ENROLLMENT)
  // =========================================================================
  async function renderStudentsTab(container) {
    const res = await API.callBackend('getAllStudents', {}, 'Fetching students...');
    cachedStudents = (res && res.success && Array.isArray(res.students)) ? res.students : [];
    selectedStudentIdsForPrint.clear();

    const canEdit = hasPerm('students:edit');
    const canDelete = hasPerm('students:delete');
    const canPrint = hasPerm('printing:view') || hasPerm('printing:send');

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

        <!-- Filter & Receipt Action Row -->
        <div style="display: flex; gap: 10px; margin: 14px 0; flex-wrap: wrap; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <input type="text" id="studentSearchInput" class="input-field" placeholder="Search by student name or ID..." style="max-width: 220px;">
            <select id="studentClassFilter" class="select-field" style="max-width: 140px;">
              <option value="">All Classes</option>
              ${GRADE_LEVELS.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
            </select>
            <select id="studentCategoryFilter" class="select-field" style="max-width: 140px;">
              <option value="">All Categories</option>
              <option value="new">New Enrollee</option>
              <option value="old">Returning Student</option>
            </select>
          </div>

          <!-- Bulk Receipt Printing Controls -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <label style="font-size: 13px; font-weight: 600; color: var(--color-primary); display: flex; align-items: center; gap: 6px;">
              Receipts:
              <select id="receiptCategorySelect" class="select-field" style="max-width: 160px; font-weight: normal;" onchange="window.AdminPanel.onReceiptCategoryChange()">
                <option value="all">All Students</option>
                <option value="class">By Class</option>
                <option value="overdue">Overdue (Balance Due)</option>
                <option value="cleared">Tuition Cleared</option>
              </select>
            </label>
            <select id="receiptClassSelect" class="select-field hidden" style="max-width: 140px;"></select>
            <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.printReceiptsByCategory()" style="display: flex; align-items: center; gap: 6px;">
              🧾 Print Receipts (3/page)
            </button>
          </div>
        </div>

        <!-- Student Roster Table -->
        <div class="table-responsive">
          <table class="data-table" id="studentDirectoryTable">
            <thead>
              <tr>
                <th style="width: 28px;"></th>
                <th style="width: 38px;"><input type="checkbox" id="selectAllStudentsCheckbox"></th>
                <th>Student ID</th>
                <th>Student</th>
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

    const yearFiltered = cachedStudents.filter(s => {
      if (!selectedAcademicYear) return true;
      if (!s.academicYear) return true;
      return String(s.academicYear).trim() === String(selectedAcademicYear).trim();
    });
    renderStudentRows(yearFiltered);

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

    const canEdit = hasPerm('students:edit');
    const canDelete = hasPerm('students:delete');

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No matching students found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(s => {
      const isLocked = s.gradeLocked === true;
      return `
        <tr id="student-row-${escapeHtml(s.id)}">
          <td>
            <button type="button" class="expand-btn" data-id="${escapeHtml(s.id)}" onclick="window.AdminPanel.toggleStudentExpandRow('${escapeHtml(s.id)}', this)" title="Expand academic and finance details">+</button>
          </td>
          <td><input type="checkbox" class="student-checkbox" data-id="${escapeHtml(s.id)}" ${selectedStudentIdsForPrint.has(s.id) ? 'checked' : ''}></td>
          <td><b>[${escapeHtml(s.id)}]</b></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #cbd5e1;">
                ${s.photo ? `<img src="${escapeHtml(s.photo)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='👤'">` : '👤'}
              </div>
              <div>
                <div style="font-weight: 600;">${escapeHtml(s.name)}</div>
                ${Array.isArray(s.curriculumSubjects) && s.curriculumSubjects.length ? `<div style="font-size: 10.5px; color: #64748b;">${s.curriculumSubjects.length} Assigned Subjects</div>` : '<div style="font-size: 10.5px; color: #94a3b8;">No Subjects Assigned</div>'}
              </div>
            </div>
          </td>
          <td>${escapeHtml(s.className || s.grade)}</td>
          <td><span class="badge ${s.studentCategory === 'old' ? 'badge-light' : 'badge-info'}">${s.studentCategory === 'old' ? 'Returning' : 'New'}</span></td>
          <td>${escapeHtml(s.phone || '—')}</td>
          <td>
            ${canEdit ? `
              <button type="button" class="btn btn-sm ${isLocked ? 'btn-danger' : 'btn-light'}" onclick="window.AdminPanel.toggleGradeLock('${escapeHtml(s.id)}', ${!isLocked})">
                ${isLocked ? 'Locked' : 'Open'}
              </button>
            ` : `
              <span class="badge ${isLocked ? 'badge-danger' : 'badge-light'}">${isLocked ? 'Locked' : 'Open'}</span>
            `}
          </td>
          <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(s.status || 'Active')}</span></td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.printSingleReceipt('${escapeHtml(s.id)}')" title="Print Payment Receipt">
                🧾
              </button>
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.viewStudentReport('${escapeHtml(s.id)}')" title="View Report Card">
                <img src="assets/icons/file-text.png" style="width: 13px; height: 13px;" alt="">
              </button>
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.previewStudentIdCard('${escapeHtml(s.id)}')" title="Preview ID Card">
                <img src="assets/icons/circle-user-round.png" style="width: 13px; height: 13px;" alt="">
              </button>
              ${canEdit ? `
                <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditStudentModal('${escapeHtml(s.id)}')" title="Edit Profile">
                  <img src="assets/icons/pencil.png" style="width: 13px; height: 13px;" alt="">
                </button>
              ` : ''}
              ${canDelete ? `
                <button type="button" class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteStudent('${escapeHtml(s.id)}')" title="Delete Student" style="padding: 2px 6px;">
                  🗑
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
        <tr id="expand-row-${escapeHtml(s.id)}" class="student-expand-row hidden">
          <td colspan="10">
            <div id="expand-content-${escapeHtml(s.id)}" class="student-expand-container">
              <div style="text-align: center; padding: 12px; color: var(--color-text-muted); font-size: 13px;">Loading student grades and financial summary...</div>
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
    const q = (document.getElementById('studentSearchInput')?.value || '').trim().toLowerCase();
    const cls = (document.getElementById('studentClassFilter')?.value || '').trim().toLowerCase();
    const cat = (document.getElementById('studentCategoryFilter')?.value || '').trim().toLowerCase();

    const filtered = cachedStudents.filter(s => {
      const matchYear = !selectedAcademicYear || !s.academicYear || String(s.academicYear).trim() === String(selectedAcademicYear).trim();
      const matchQ = !q || (s.name && s.name.toLowerCase().includes(q)) || (s.id && s.id.toLowerCase().includes(q));
      const matchCls = !cls || String(s.className || s.grade || '').toLowerCase() === cls;
      const matchCat = !cat || String(s.studentCategory || '').toLowerCase() === cat;
      return matchYear && matchQ && matchCls && matchCat;
    });

    renderStudentRows(filtered);
  }

  // =========================================================================
  // STUDENT EXPAND ROW (ACADEMIC GRADES & FINANCIAL SUMMARY ROWS)
  // =========================================================================
  async function toggleStudentExpandRow(studentId, btn) {
    const expandRow = document.getElementById(`expand-row-${studentId}`);
    const content = document.getElementById(`expand-content-${studentId}`);
    if (!expandRow || !content) return;

    if (!expandRow.classList.contains('hidden')) {
      expandRow.classList.add('hidden');
      if (btn) btn.textContent = '+';
      return;
    }

    expandRow.classList.remove('hidden');
    if (btn) btn.textContent = '−';

    const isSuper = currentUser.role === 'superadmin';
    const perms = currentUser.permissions || {};
    const canScores = isSuper || currentUser?.role === 'admin' || perms['scores:view'] || perms['scores:edit'];
    const canFinance = isSuper || perms['finance:view'];

    if (!canScores && !canFinance) {
      content.innerHTML = `
        <div style="padding: 10px; color: var(--color-text-muted); font-size: 13px;">
          You do not have assigned administrative permissions to view grades or finances for this student.
        </div>
      `;
      return;
    }

    content.innerHTML = '<div style="text-align: center; padding: 14px; color: var(--color-text-muted); font-size: 13px;">Loading student grades and financial summary...</div>';

    try {
      const [rcRes, finRes] = await Promise.all([
        canScores ? API.callBackend('getReportCard', { studentId: studentId }) : Promise.resolve(null),
        canFinance ? API.callBackend('getStudentFinance', { studentId: studentId }) : Promise.resolve(null)
      ]);

      const s = cachedStudents.find(x => x.id === studentId) || { id: studentId, name: 'Student' };
      const rc = (rcRes && rcRes.success && rcRes.reportCard) ? rcRes.reportCard : null;
      const fin = (finRes && finRes.success && finRes.finance) ? finRes.finance : (s.finance || {});
      const studentWithFin = Object.assign({}, s, { finance: fin });

      const currency = fin.currency || 'USD';
      const totBilled = toNum(fin.tuitionTotal) + toNum(fin.registrationFee) + toNum(fin.requirementsFee) + toNum(fin.peSuitFee) + toNum(fin.portalFee) + toNum(fin.entranceFee);
      const totPaid = toNum(fin.totalPaid);
      const balance = studentBalance(studentWithFin);

      const rows = (rc && Array.isArray(rc.rows) && rc.rows.length > 0) ? rc.rows : [];
      const summary = (rc && rc.summary) ? rc.summary : {};
      const installments = fin.installments || [0, 0, 0, 0];
      const fallbackDate = fin.updatedAt || new Date().toLocaleDateString();

      // Individual payment breakdown rows
      const paymentRows = [
        { label: 'Entrance Fee', billed: toNum(fin.entranceFee), paid: fin.entranceFeePaid ? toNum(fin.entranceFee) : 0, isPaid: Boolean(fin.entranceFeePaid), date: fallbackDate },
        { label: 'Registration Fee', billed: toNum(fin.registrationFee), paid: fin.registrationPaid ? toNum(fin.registrationFee) : 0, isPaid: Boolean(fin.registrationPaid), date: fin.registrationDate || fallbackDate },
        { label: 'Requirements Fee', billed: toNum(fin.requirementsFee), paid: fin.requirementsFeePaid ? toNum(fin.requirementsFee) : 0, isPaid: Boolean(fin.requirementsFeePaid), date: fallbackDate },
        { label: 'PE Suit Fee', billed: toNum(fin.peSuitFee), paid: fin.peSuitFeePaid ? toNum(fin.peSuitFee) : 0, isPaid: Boolean(fin.peSuitFeePaid), date: fallbackDate },
        { label: 'Portal Fee', billed: toNum(fin.portalFee), paid: fin.portalFeePaid ? toNum(fin.portalFee) : 0, isPaid: Boolean(fin.portalFeePaid), date: fallbackDate },
        { label: '1st Tuition Installment', billed: toNum(fin.tuitionTotal) > 0 ? Math.round(toNum(fin.tuitionTotal) / 4) : 0, paid: toNum(installments[0]), isPaid: toNum(installments[0]) > 0, date: fallbackDate },
        { label: '2nd Tuition Installment', billed: toNum(fin.tuitionTotal) > 0 ? Math.round(toNum(fin.tuitionTotal) / 4) : 0, paid: toNum(installments[1]), isPaid: toNum(installments[1]) > 0, date: fallbackDate },
        { label: '3rd Tuition Installment', billed: toNum(fin.tuitionTotal) > 0 ? Math.round(toNum(fin.tuitionTotal) / 4) : 0, paid: toNum(installments[2]), isPaid: toNum(installments[2]) > 0, date: fallbackDate },
        { label: '4th Tuition Installment', billed: toNum(fin.tuitionTotal) > 0 ? Math.round(toNum(fin.tuitionTotal) / 4) : 0, paid: toNum(installments[3]), isPaid: toNum(installments[3]) > 0, date: fallbackDate },
        { label: 'Other Payments', billed: 0, paid: toNum(fin.otherPayments), isPaid: toNum(fin.otherPayments) > 0, date: fallbackDate }
      ];

      content.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 6px 0;">
          <!-- Header Banner with Student Photo & Core Details -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; border-radius: 6px; overflow: hidden; background: #e2e8f0; border: 2px solid var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                ${s.photo ? `<img src="${escapeHtml(s.photo)}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
              </div>
              <div>
                <h4 style="margin: 0; font-size: 15px; color: var(--color-primary);">${escapeHtml(s.name)} [${escapeHtml(s.id)}]</h4>
                <div style="font-size: 12px; color: var(--color-text-muted);">
                  Class: <b>${escapeHtml(s.className || s.grade)}</b> &bull; Academic Year: <b>${escapeHtml(s.academicYear || selectedAcademicYear)}</b> &bull; Category: <b>${s.studentCategory === 'old' ? 'Returning Student' : 'New Enrollee'}</b>
                </div>
                <div style="margin-top:7px;font-size:12px;">
                  <b>Assigned Subjects:</b>
                  ${Array.isArray(s.curriculumSubjects) && s.curriculumSubjects.length
                    ? s.curriculumSubjects.map(x=>`<span class="badge badge-light" style="margin:2px;">${escapeHtml(x)}</span>`).join('')
                    : '<span style="color:#94a3b8;"> No subjects assigned</span>'}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary btn-sm" onclick="window.AdminPanel.openEditPaymentModal('${escapeHtml(studentId)}')">
                💳 Edit / Record Payment
              </button>
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.printSingleReceipt('${escapeHtml(studentId)}')">
                🧾 Print Receipt (3/page)
              </button>
              <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.viewStudentReport('${escapeHtml(studentId)}')">
                📄 Full Report Card
              </button>
            </div>
          </div>

          <div class="expand-split-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px;">
            <!-- Left: Academic Grades Rows Table -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
              <div style="font-weight: 700; color: var(--color-primary); font-size: 13.5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>Academic Grades Roster</span>
                <span style="font-size: 11px; font-weight: normal; color: #64748b;">
                  <span class="score-deep-green">■ 91-100</span> &bull; <span class="score-blue">■ 70-90</span> &bull; <span class="score-red">■ &lt;70</span>
                </span>
              </div>
              ${canScores ? (rows.length > 0 ? `
                <div style="max-height: 380px; overflow-y: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                    <thead>
                      <tr style="background: #f1f5f9; text-align: center;">
                        <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Subject</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="1st Period">1st</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="2nd Period">2nd</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="3rd Period">3rd</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="Exam 1">Ex1</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1; font-weight: 700;">Sem1</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="4th Period">4th</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="5th Period">5th</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="6th Period">6th</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1;" title="Exam 2">Ex2</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1; font-weight: 700;">Sem2</th>
                        <th style="padding: 4px 5px; border: 1px solid #cbd5e1; font-weight: 800; background: #e2e8f0;">Yr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows.map(r => `
                        <tr>
                          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-weight: 600;">${escapeHtml(r.subject)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.p1)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.p2)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.p3)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.exam1)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${formatGradeCell(r.sem1Avg)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.p4)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.p5)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.p6)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center;">${formatGradeCell(r.exam2)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${formatGradeCell(r.sem2Avg)}</td>
                          <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; background: #f8fafc;">${formatGradeCell(r.yearlyAvg)}</td>
                        </tr>
                      `).join('')}
                      <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">General Summary</td>
                        <td colspan="4" style="text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 11px;">Sem 1 Avg: <b>${formatGradeCell(summary.sem1Avg || summary.overallAverage)}</b></td>
                        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: center;">${formatGradeCell(summary.sem1Avg)}</td>
                        <td colspan="4" style="text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 11px;">Rank: <b>${summary.rankSem2 || summary.rankSem1 || '—'}</b></td>
                        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: center;">${formatGradeCell(summary.sem2Avg)}</td>
                        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; background: #e2e8f0;">${formatGradeCell(summary.overallAverage)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ` : '<div style="font-size: 12.5px; color: #64748b; padding: 14px 0; text-align: center;">No academic grades recorded for this student yet.</div>') : '<div style="font-size: 12.5px; color: #64748b;">No scores view permissions assigned.</div>'}
            </div>

            <!-- Right: Fee & Payment Schedule Rows Table -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
              <div style="font-weight: 700; color: var(--color-primary); font-size: 13.5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>Tuition &amp; Fee Payments Ledger</span>
                <span class="badge ${balance > 0 ? 'badge-danger' : 'badge-success'}" style="font-size: 11px;">
                  ${balance > 0 ? 'Balance Due: ' + formatMoney(balance, currency) : 'Tuition Cleared ✓'}
                </span>
              </div>
              ${canFinance ? `
                <div style="max-height: 380px; overflow-y: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                    <thead>
                      <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">Fee Category</th>
                        <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Billed</th>
                        <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Paid</th>
                        <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Balance</th>
                        <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${paymentRows.map(p => {
                        const bal = Math.max(0, p.billed - p.paid);
                        return `
                          <tr>
                            <td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-weight: 500;">${escapeHtml(p.label)}</td>
                            <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: right;">${p.billed > 0 ? formatMoney(p.billed, currency) : '—'}</td>
                            <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: right; color: ${p.paid > 0 ? 'var(--color-success)' : 'inherit'}; font-weight: ${p.paid > 0 ? '700' : 'normal'};">${formatMoney(p.paid, currency)}</td>
                            <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: right; color: ${bal > 0 ? 'var(--color-danger)' : '#64748b'}; font-weight: ${bal > 0 ? '700' : 'normal'};">${p.billed > 0 ? formatMoney(bal, currency) : '—'}</td>
                            <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: center;">
                              ${p.isPaid ? '<span class="badge badge-success" style="padding: 1px 6px; font-size: 10px;">Paid</span>' : (p.billed > 0 ? '<span class="badge badge-warning" style="padding: 1px 6px; font-size: 10px;">Pending</span>' : '<span style="color:#94a3b8;">—</span>')}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                      <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1;">Total Financial Position</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${formatMoney(totBilled, currency)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: var(--color-success);">${formatMoney(totPaid, currency)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: ${balance > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">${formatMoney(balance, currency)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">
                          ${balance <= 0 && totBilled > 0 ? '<span class="badge badge-success" style="padding: 2px 6px; font-size: 10px;">Cleared</span>' : '<span class="badge badge-danger" style="padding: 2px 6px; font-size: 10px;">Due</span>'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ` : '<div style="font-size: 12.5px; color: #64748b;">No finance view permissions assigned.</div>'}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = '<div class="alert alert-danger" style="margin: 0;">Error loading student details. Please try again.</div>';
    }
  }

  // =========================================================================
  // PAYMENT RECEIPTS & BULK PRINTING (3 PER LANDSCAPE A4 PAGE)
  // =========================================================================
  function buildReceiptRow(label, amount, currency, dateStr) {
    if (!amount || Number(amount) <= 0) return '';
    return `
      <div class="receiptRow">
        <div class="receiptRowCheck">✓</div>
        <div class="receiptRowLabel">${escapeHtml(label)}</div>
        <div class="receiptRowDate"><small>Payment Date</small>${escapeHtml(dateStr) || '—'}</div>
        <div class="receiptRowAmount">${formatMoney(amount, currency)}</div>
      </div>`;
  }

  function buildReceiptCardHtml(s) {
    const branding = (window.App && App.getSettings && App.getSettings()) || {};
    const f = s.finance || {};
    const currency = f.currency || 'USD';
    const installments = f.installments || [0, 0, 0, 0];
    const fallbackDate = f.updatedAt || new Date().toLocaleDateString();
    const rows = [];

    if (f.entranceFeePaid) rows.push(buildReceiptRow('Entrance Fee', f.entranceFee, currency, fallbackDate));
    if (f.registrationPaid) rows.push(buildReceiptRow('Registration Fee', f.registrationFee, currency, f.registrationDate || fallbackDate));
    if (f.requirementsFeePaid) rows.push(buildReceiptRow('Requirements Fee', f.requirementsFee, currency, fallbackDate));
    if (f.peSuitFeePaid) rows.push(buildReceiptRow('PE Suit Fee', f.peSuitFee, currency, fallbackDate));
    if (f.portalFeePaid) rows.push(buildReceiptRow('Portal Fee', f.portalFee, currency, fallbackDate));
    ['1st', '2nd', '3rd', '4th'].forEach((ord, i) => {
      rows.push(buildReceiptRow(`${ord} Tuition Installment`, installments[i], currency, fallbackDate));
    });
    rows.push(buildReceiptRow('Other Payments', f.otherPayments, currency, fallbackDate));

    const rowsHtml = rows.join('') || `<p class="muted" style="padding:10px 0; color:#64748b; font-size:12px;">No payments recorded yet.</p>`;

    const totalPaid =
      (f.entranceFeePaid ? toNum(f.entranceFee) : 0) +
      (f.registrationPaid ? toNum(f.registrationFee) : 0) +
      (f.requirementsFeePaid ? toNum(f.requirementsFee) : 0) +
      (f.peSuitFeePaid ? toNum(f.peSuitFee) : 0) +
      (f.portalFeePaid ? toNum(f.portalFee) : 0) +
      installments.reduce((a, b) => a + toNum(b), 0) +
      toNum(f.otherPayments);

    const totalBalance = studentBalance(s);
    return `
      <div class="receiptCard">
        <div class="receiptTopBrand">
          <img class="receiptTopLogo" src="${escapeHtml(branding.logoUrl || 'assets/images/school-logo.png')}" alt="Logo" onerror="this.style.display='none'">
          <div class="receiptTopSchoolName">${escapeHtml(branding.schoolName || 'Sorina Daycare & Primary School System')}</div>
          <div class="receiptTopMotto">${escapeHtml(branding.schoolMotto || 'Excellence in Knowledge, Character & Integrity')}</div>
        </div>
        <div class="receiptHeaderRule"></div>
        <div class="receiptStudentPhotoRow">
          <div class="receiptStudentPhotoBox">${s.photo ? `<img src="${escapeHtml(s.photo)}" alt="Photo">` : '👤'}</div>
        </div>
        <div class="receiptTitle">PAYMENT RECEIPT</div>
        <div class="receiptMetaRow">
          <div><small>Paid For</small><b>${escapeHtml(s.name)} (${escapeHtml(s.id)})</b></div>
          <div><small>Date</small><b>${new Date().toLocaleDateString()}</b></div>
        </div>
        <div class="receiptRowsWrap">${rowsHtml}</div>
        <div class="receiptTotalsBar">
          <div><small>Total Paid</small><b>${formatMoney(totalPaid, currency)}</b></div>
          <div class="receiptBalanceBlock"><small>Total Balance</small><b class="${totalBalance > 0 ? 'score-red' : 'score-green'}">${formatMoney(totalBalance, currency)}</b></div>
        </div>
        <div class="receiptFooterNote">Payments are record-only; no payment is processed online on this website.</div>
      </div>`;
  }

  function studentBalance(s) {
    const f = s.finance || {};
    const installments = f.installments || [0, 0, 0, 0];
    const tuitionPaid = installments.reduce((a, b) => a + toNum(b), 0);
    const tuitionBalance = Math.max(0, toNum(f.tuitionTotal) - tuitionPaid);
    const regBalance = f.registrationPaid ? 0 : toNum(f.registrationFee);
    const reqBalance = f.requirementsFeePaid ? 0 : toNum(f.requirementsFee);
    const peBalance = f.peSuitFeePaid ? 0 : toNum(f.peSuitFee);
    const portalBalance = f.portalFeePaid ? 0 : toNum(f.portalFee);
    const entranceBalance = f.entranceFeePaid ? 0 : toNum(f.entranceFee);
    return tuitionBalance + regBalance + reqBalance + peBalance + portalBalance + entranceBalance;
  }

  function toNum(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
  function formatMoney(n, currency) {
    const num = toNum(n);
    return (currency || 'USD') + ' ' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function receiptCategoryEligibleStudents() {
    return cachedStudents.filter(s => s.status !== 'Dropped');
  }

  function populateReceiptClassSelect() {
    const sel = document.getElementById('receiptClassSelect');
    if (!sel) return;
    const classesPresent = Array.from(new Set(receiptCategoryEligibleStudents().map(s => s.className || s.grade).filter(Boolean)));
    sel.innerHTML = classesPresent.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('') || '<option value="">No classes found</option>';
  }

  function onReceiptCategoryChange() {
    const cat = document.getElementById('receiptCategorySelect').value;
    const classSel = document.getElementById('receiptClassSelect');
    if (!classSel) return;
    if (cat === 'class') {
      populateReceiptClassSelect();
      classSel.classList.remove('hidden');
    } else {
      classSel.classList.add('hidden');
    }
  }

  function printReceiptsByCategory() {
    const cat = document.getElementById('receiptCategorySelect').value;
    const pool = receiptCategoryEligibleStudents();
    let selected = [];

    if (cat === 'all') {
      selected = pool;
    } else if (cat === 'class') {
      const cls = document.getElementById('receiptClassSelect').value;
      if (!cls) { alert('No class selected.'); return; }
      selected = pool.filter(s => String(s.className || s.grade).toLowerCase() === cls.toLowerCase());
    } else if (cat === 'overdue') {
      selected = pool.filter(s => studentBalance(s) > 0);
    } else if (cat === 'cleared') {
      selected = pool.filter(s => toNum((s.finance || {}).tuitionTotal) > 0 && studentBalance(s) <= 0);
    }

    if (!selected.length) {
      alert('No students match this category.');
      return;
    }
    printReceiptCards(selected);
  }

  function printReceiptCards(students) {
    const list = (students || []).filter(Boolean);
    if (!list.length) { alert('No students to print receipts for.'); return; }
    const cardsHtml = list.map(s => buildReceiptCardHtml(s)).join('');
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('');
    const printWin = window.open('', '_blank');
    printWin.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Receipts - Sorina Daycare & Primary School System</title>${styles}
      <style>@page { size: A4 landscape; margin: 6mm; } body{background:#fff;margin:0;padding:4mm;}</style></head><body><div class="receiptPrintGrid">${cardsHtml}</div></body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);
  }

  function printSingleReceipt(studentId) {
    const s = cachedStudents.find(x => x.id === studentId);
    if (!s) { alert('Student record not found.'); return; }
    printReceiptCards([s]);
  }

  const CURRICULUM_SUBJECTS = [
    'English / Reading',
    'Phonics',
    'Spelling & Vocabulary',
    'Handwriting',
    'Composition / Grammar',
    'General Mathematics',
    'Mental Math',
    'General Science',
    'Health Education',
    'Social Studies',
    'Religious & Moral Education',
    'Creative Arts / Music',
    'Physical Education'
  ];

  // --- Register New Student Modal (Systematic ID: SPSS001, Photo, Subjects, Class Fee Schedule) ---
  async function openRegisterNewStudentModal() {
    const idRes = await API.callBackend('getNextStudentId', {}, 'Fetching next ID...');
    const nextId = (idRes && idRes.success) ? idRes.nextId : 'SPSS001';
    let uploadedPhotoBase64 = '';

    const initialClass = GRADE_LEVELS[2] || 'ABC';
    const initialFee = getClassFeeSchedule(initialClass, 'new');

    App.showModal({
      title: 'Register New Student (New Enrollee)',
      content: `
        <div style="font-size: 13.5px; max-height: 75vh; overflow-y: auto; padding-right: 6px;">
          <!-- Student Photo Upload & Preview -->
          <div style="text-align: center; margin-bottom: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <label class="form-label" style="display: block; font-weight: 700; margin-bottom: 6px;">Student Photo</label>
            <div id="nsPhotoPreviewBox" style="width: 76px; height: 90px; border: 2px dashed #94a3b8; border-radius: 6px; margin: 0 auto 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #ffffff;">
              <span style="font-size: 32px; color: #94a3b8;">👤</span>
            </div>
            <input type="file" id="nsPhotoInput" accept="image/*" class="input-field" style="max-width: 250px; margin: 0 auto; font-size: 12px; padding: 4px;">
            <div class="form-hint" style="margin-top: 4px;">Upload passport-style student photograph. Used globally in ID cards, receipts, and reports.</div>
          </div>

          <!-- Identification & Personal Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsId">Systematic Student ID *</label>
              <input type="text" id="nsId" class="input-field" value="${escapeHtml(nextId)}" required style="font-weight: 700; color: var(--color-primary);">
              <div class="form-hint">Systematic format [SPSS001].</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="nsName">Student Full Name *</label>
              <input type="text" id="nsName" class="input-field" placeholder="e.g. Samuel K. Brown" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsClass">Enrolling Class *</label>
              <select id="nsClass" class="select-field">
                ${GRADE_LEVELS.map(g => `<option value="${escapeHtml(g)}" ${g === initialClass ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="nsGender">Gender</label>
              <select id="nsGender" class="select-field">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="nsDob">Date of Birth</label>
              <input type="date" id="nsDob" class="input-field">
            </div>
          </div>

          <!-- Auto-Tied Class Fee Schedule Box -->
          <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; margin: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--color-primary); font-size: 13px;">Class Fee Schedule (Auto-Tied)</span>
              <span class="badge badge-info" style="font-size: 11px;">New Enrollee Package</span>
            </div>
            <div id="nsFeeSummaryBox" style="font-size: 12px; color: #334155; line-height: 1.5;">
              <div>Tuition: <b>$${initialFee.tuitionTotal || 0}</b> | Registration: <b>$${initialFee.registrationFee || 0}</b> | Entrance: <b>$${initialFee.entranceFee || 0}</b></div>
              <div>Requirements: <b>$${initialFee.requirementsFee || 0}</b> | PE Suit: <b>$${initialFee.peSuitFee || 0}</b> | Portal: <b>$${initialFee.portalFee || 0}</b></div>
              <div style="margin-top: 4px; font-weight: 800; color: var(--color-primary);">
                Total Annual Obligation: $${toNum(initialFee.tuitionTotal) + toNum(initialFee.registrationFee) + toNum(initialFee.entranceFee) + toNum(initialFee.requirementsFee) + toNum(initialFee.peSuitFee) + toNum(initialFee.portalFee)}
              </div>
            </div>
          </div>

          <!-- Curriculum is controlled separately by the Curriculum Subject log -->
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;">
            <b>Curriculum Subject</b><div style="color:#64748b;margin-top:4px;">Subjects are assigned automatically from the selected class curriculum. Admin manages them from the separate “Curriculum Subject” log.</div>
          </div>

          <!-- Guardian & Access Credentials -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsGuardian">Parent / Guardian Name</label>
              <input type="text" id="nsGuardian" class="input-field" placeholder="e.g. Mary Brown">
            </div>
            <div class="form-group">
              <label class="form-label" for="nsPhone">Parent Contact Phone</label>
              <input type="text" id="nsPhone" class="input-field" placeholder="+231-...">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="nsPass">Initial Student Password *</label>
            <input type="password" id="nsPass" class="input-field" value="student123" required>
          </div>
        </div>
      `,
      confirmText: 'Register New Student',
      onConfirm: async () => {
        const id = document.getElementById('nsId').value.trim();
        const name = document.getElementById('nsName').value.trim();
        const cls = document.getElementById('nsClass').value;
        const gender = document.getElementById('nsGender').value;
        const dob = document.getElementById('nsDob').value;
        const guardian = document.getElementById('nsGuardian').value.trim();
        const phone = document.getElementById('nsPhone').value.trim();
        const pass = document.getElementById('nsPass').value.trim();

        if (!name || !pass) {
          API.toastNotification('Student name and password are required.', true);
          return;
        }

        const assignedSubjects = selectedCurriculumForClass(cls);

        const feeSchedule = getClassFeeSchedule(cls, 'new');
        const totTuition = toNum(feeSchedule.tuitionTotal);
        const regFee = toNum(feeSchedule.registrationFee);
        const entFee = toNum(feeSchedule.entranceFee);
        const reqFee = toNum(feeSchedule.requirementsFee);
        const peFee = toNum(feeSchedule.peSuitFee);
        const portFee = toNum(feeSchedule.portalFee);
        const totalBillable = totTuition + regFee + entFee + reqFee + peFee + portFee;

        const res = await API.callBackend('addStudent', {
          student: {
            id: id,
            name: name,
            className: cls,
            grade: cls,
            academicYear: selectedAcademicYear,
            studentCategory: 'new',
            gender: gender,
            dob: dob,
            photo: uploadedPhotoBase64 || '',
            guardian: guardian,
            phone: phone,
            password: pass,
            curriculumSubjects: assignedSubjects,
            finance: {
              tuitionTotal: totTuition,
              registrationFee: regFee,
              registrationPaid: false,
              entranceFee: entFee,
              entranceFeePaid: false,
              requirementsFee: reqFee,
              requirementsFeePaid: false,
              peSuitFee: peFee,
              peSuitFeePaid: false,
              portalFee: portFee,
              portalFeePaid: false,
              installments: [0, 0, 0, 0],
              otherPayments: 0,
              totalPaid: 0,
              balance: totalBillable,
              currency: feeSchedule.currency || dashboardCurrency
            }
          }
        }, 'Registering student...');

        if (res && res.success) {
          API.toastSuccess('Returning student advanced and registered for ' + selectedAcademicYear + '. Previous-year record preserved.');
          loadTab('students');
        } else {
          API.toastNotification(res.message || 'Error registering student.', true);
        }
      }
    });

    // Wire up image reader and fee schedule update
    setTimeout(() => {
      const photoInput = document.getElementById('nsPhotoInput');
      if (photoInput) {
        photoInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              uploadedPhotoBase64 = evt.target.result;
              const box = document.getElementById('nsPhotoPreviewBox');
              if (box) box.innerHTML = `<img src="${uploadedPhotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
          }
        };
      }

      const classSel = document.getElementById('nsClass');
      if (classSel) {
        classSel.onchange = () => {
          const c = classSel.value;
          const fee = getClassFeeSchedule(c, 'new');
          const feeBox = document.getElementById('nsFeeSummaryBox');
          if (feeBox) {
            const tot = toNum(fee.tuitionTotal) + toNum(fee.registrationFee) + toNum(fee.entranceFee) + toNum(fee.requirementsFee) + toNum(fee.peSuitFee) + toNum(fee.portalFee);
            feeBox.innerHTML = `
              <div>Tuition: <b>$${fee.tuitionTotal || 0}</b> | Registration: <b>$${fee.registrationFee || 0}</b> | Entrance: <b>$${fee.entranceFee || 0}</b></div>
              <div>Requirements: <b>$${fee.requirementsFee || 0}</b> | PE Suit: <b>$${fee.peSuitFee || 0}</b> | Portal: <b>$${fee.portalFee || 0}</b></div>
              <div style="margin-top: 4px; font-weight: 800; color: var(--color-primary);">Total Annual Obligation: $${tot}</div>
            `;
          }
        };
      }

      const toggleSubjectsBtn = document.getElementById('nsToggleAllSubjectsBtn');
      if (toggleSubjectsBtn) {
        toggleSubjectsBtn.onclick = () => {
          const cbs = document.querySelectorAll('.ns-subject-check');
          const allChecked = Array.from(cbs).every(c => c.checked);
          cbs.forEach(c => c.checked = !allChecked);
          toggleSubjectsBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
        };
      }
    }, 50);
  }

  // --- Register Old Student Modal (Previous Class Filter & Auto-fill while preserving ID) ---
  async function openRegisterOldStudentModal() {
    let oldStudentPhoto = '';

    App.showModal({
      title: 'Register Returning / Old Student (Advance to New Class)',
      content: `
        <div style="font-size: 13.5px; max-height: 75vh; overflow-y: auto; padding-right: 6px;">
          <!-- Step 1: Select previous academic year and class -->
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label class="form-label" for="prevAcademicYear">Previous Academic School Year:</label>
                <select id="prevAcademicYear" class="select-field">
                  ${[previousAcademicYear(selectedAcademicYear), previousAcademicYear(previousAcademicYear(selectedAcademicYear)), previousAcademicYear(previousAcademicYear(previousAcademicYear(selectedAcademicYear)))].filter(Boolean).map(y => `<option value="${escapeHtml(y)}" ${y===previousAcademicYear(selectedAcademicYear)?'selected':''}>${escapeHtml(y)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label" for="prevClassFilter">1. Select Student's Previous Class / Grade Level:</label>
                <select id="prevClassFilter" class="select-field">
                  <option value="">-- Choose Previous Class --</option>
                  ${GRADE_LEVELS.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:6px;">Students are loaded only from the selected previous academic year and are carried forward with their existing records.</div>

            <div style="margin-top: 10px;">
              <label class="form-label" for="oldStudentPicker">2. Select Returning Student:</label>
              <select id="oldStudentPicker" class="select-field" disabled>
                <option value="">-- Select previous class first --</option>
              </select>
            </div>
          </div>

          <!-- Step 2: Auto-filled Details (Preserves original ID & Photo) -->
          <div style="display: flex; gap: 14px; align-items: center; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 12px;">
            <div id="osPhotoBox" style="width: 54px; height: 64px; border: 2px solid var(--color-primary); border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #eef2ff; font-size: 24px; flex-shrink: 0;">
              👤
            </div>
            <div style="flex: 1;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <label class="form-label" style="font-size: 11px;">Original Student ID (Preserved)</label>
                  <input type="text" id="osId" class="input-field" readonly style="font-weight: 700; background: #e2e8f0; color: var(--color-primary); font-size: 12.5px;">
                </div>
                <div>
                  <label class="form-label" style="font-size: 11px;">Student Full Name</label>
                  <input type="text" id="osName" class="input-field" readonly style="background: #e2e8f0; font-weight: 600; font-size: 12.5px;">
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Advancing Class & Auto-Tied Old Student Fee Schedule -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="osNewClass">New Advancing Class *</label>
              <select id="osNewClass" class="select-field">
                ${GRADE_LEVELS.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="osGuardian">Guardian Contact</label>
              <input type="text" id="osGuardian" class="input-field" placeholder="Guardian name">
            </div>
          </div>

          <!-- Auto-Tied Returning Fee Schedule Box -->
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: #065f46; font-size: 13px;">Returning Student Fee Schedule (Auto-Tied)</span>
              <span class="badge badge-success" style="font-size: 11px;">Returning Rate</span>
            </div>
            <div id="osFeeSummaryBox" style="font-size: 12px; color: #064e3b; line-height: 1.5;">
              <div>Tuition: <b>$200</b> | Registration: <b>$35</b> | Requirements: <b>$35</b></div>
              <div>PE Suit: <b>$25</b> | Portal: <b>$20</b> | Entrance: <b>$0 (Waived)</b></div>
              <div style="margin-top: 4px; font-weight: 800;">Total Annual Obligation: $315</div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;"><b>Curriculum Subject</b><div style="color:#64748b;margin-top:4px;">Subjects are controlled by the class Curriculum Subject log.</div></div>

          <div class="form-group">
            <label class="form-label" for="osPhone">Parent / Guardian Phone</label>
            <input type="text" id="osPhone" class="input-field" placeholder="+231-...">
          </div>
        </div>
      `,
      confirmText: 'Advance &amp; Enroll Student',
      onConfirm: async () => {
        const studentId = document.getElementById('osId').value.trim();
        const newClass = document.getElementById('osNewClass').value;
        const guardian = document.getElementById('osGuardian').value.trim();
        const phone = document.getElementById('osPhone').value.trim();

        if (!studentId) {
          API.toastNotification('Please select a returning student to advance.', true);
          return;
        }

        const assignedSubjects = selectedCurriculumForClass(newClass);

        const feeSchedule = getClassFeeSchedule(newClass, 'old');
        const totTuition = toNum(feeSchedule.tuitionTotal);
        const regFee = toNum(feeSchedule.registrationFee);
        const reqFee = toNum(feeSchedule.requirementsFee);
        const peFee = toNum(feeSchedule.peSuitFee);
        const portFee = toNum(feeSchedule.portalFee);
        const totalBillable = totTuition + regFee + reqFee + peFee + portFee;

        const previousYear = document.getElementById('prevAcademicYear').value || previousAcademicYear(selectedAcademicYear);
        const sourceStudent = classStudents.find(x => x.id === studentId) || {};
        const currentRecord = Object.assign({}, sourceStudent, {
          id: studentId,
          className: newClass,
          grade: newClass,
          academicYear: selectedAcademicYear,
          studentCategory: 'old',
          guardian: guardian || sourceStudent.guardian || '',
          phone: phone || sourceStudent.phone || '',
          curriculumSubjects: assignedSubjects,
          assignedSubjects: undefined,
          promotedFromAcademicYear: previousYear,
          previousClass: sourceStudent.className || sourceStudent.grade || '',
          promotionDate: new Date().toISOString(),
          finance: {
            tuitionTotal: totTuition,
            registrationFee: regFee,
            registrationPaid: false,
            entranceFee: 0,
            entranceFeePaid: true,
            requirementsFee: reqFee,
            requirementsFeePaid: false,
            peSuitFee: peFee,
            peSuitFeePaid: false,
            portalFee: portFee,
            portalFeePaid: false,
            installments: [0, 0, 0, 0, 0],
            otherPayments: 0,
            totalPaid: 0,
            balance: totalBillable,
            currency: feeSchedule.currency || dashboardCurrency
          }
        });
        delete currentRecord.years;
        const res = await API.callBackend('addStudent', { student: currentRecord }, 'Advancing student to the current academic year...');

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
    const newClassSelect = document.getElementById('osNewClass');

    function updateOsFeeBox(cls) {
      const fee = getClassFeeSchedule(cls, 'old');
      const box = document.getElementById('osFeeSummaryBox');
      if (box) {
        const tot = toNum(fee.tuitionTotal) + toNum(fee.registrationFee) + toNum(fee.requirementsFee) + toNum(fee.peSuitFee) + toNum(fee.portalFee);
        box.innerHTML = `
          <div>Tuition: <b>$${fee.tuitionTotal || 0}</b> | Registration: <b>$${fee.registrationFee || 0}</b> | Requirements: <b>$${fee.requirementsFee || 0}</b></div>
          <div>PE Suit: <b>$${fee.peSuitFee || 0}</b> | Portal: <b>$${fee.portalFee || 0}</b> | Entrance: <b>$0 (Waived)</b></div>
          <div style="margin-top: 4px; font-weight: 800;">Total Annual Obligation: $${tot}</div>
        `;
      }
    }

    if (newClassSelect) {
      newClassSelect.onchange = () => updateOsFeeBox(newClassSelect.value);
    }

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

      const previousYear = document.getElementById('prevAcademicYear').value || previousAcademicYear(selectedAcademicYear);
      const res = await API.callBackend('getOldStudentsByClass', { className: cls, academicYear: previousYear, currentAcademicYear: selectedAcademicYear }, 'Filtering students from previous academic year...');
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

      const photoBox = document.getElementById('osPhotoBox');
      if (photoBox) {
        photoBox.innerHTML = student.photo ? `<img src="${escapeHtml(student.photo)}" style="width:100%;height:100%;object-fit:cover;">` : '👤';
      }

      // Auto suggest next class from GRADE_LEVELS
      const currentClass = student.className || student.grade || '';
      const curIdx = GRADE_LEVELS.indexOf(currentClass);
      if (curIdx >= 0 && curIdx < GRADE_LEVELS.length - 1) {
        const nextGrade = GRADE_LEVELS[curIdx + 1];
        newClassSelect.value = nextGrade;
        updateOsFeeBox(nextGrade);
      }
    };

;
  }

  // --- Edit Student Modal ---
  function openEditStudentModal(studentId) {
    const s = cachedStudents.find(x => x.id === studentId);
    if (!s) {
      API.toastNotification('Student record not found.', true);
      return;
    }

    let updatedPhoto = s.photo || '';

    App.showModal({
      title: `Edit Student Profile: ${escapeHtml(s.name)} [${escapeHtml(s.id)}]`,
      content: `
        <div style="font-size: 13.5px; max-height: 75vh; overflow-y: auto; padding-right: 6px;">
          <!-- Photo Edit -->
          <div style="text-align: center; margin-bottom: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div id="editStudentPhotoBox" style="width: 76px; height: 90px; border: 2px solid var(--color-primary); border-radius: 6px; margin: 0 auto 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #ffffff;">
              ${updatedPhoto ? `<img src="${escapeHtml(updatedPhoto)}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
            </div>
            <input type="file" id="editStudentPhotoInput" accept="image/*" class="input-field" style="max-width: 250px; margin: 0 auto; font-size: 12px; padding: 4px;">
            <div class="form-hint">Change or upload new student photograph.</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="editSName">Full Name *</label>
              <input type="text" id="editSName" class="input-field" value="${escapeHtml(s.name)}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="editSClass">Enrolled Class *</label>
              <select id="editSClass" class="select-field">
                ${GRADE_LEVELS.map(g => `<option value="${escapeHtml(g)}" ${(s.className || s.grade) === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="editSCat">Student Category</label>
              <select id="editSCat" class="select-field">
                <option value="new" ${s.studentCategory === 'new' ? 'selected' : ''}>New Enrollee</option>
                <option value="old" ${s.studentCategory === 'old' ? 'selected' : ''}>Returning Student</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="editSStatus">Account Status</label>
              <select id="editSStatus" class="select-field">
                <option value="Active" ${s.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Suspended" ${s.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                <option value="Dropped" ${s.status === 'Dropped' ? 'selected' : ''}>Dropped</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="editSDob">Date of Birth</label>
              <input type="date" id="editSDob" class="input-field" value="${escapeHtml(s.dob || '')}">
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:12px 0;">
            <div style="font-weight:700;color:var(--color-primary);margin-bottom:6px;">Assigned Subjects</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Only these student-specific subjects appear on the student's report card.</div>
            <div>${Array.isArray(s.curriculumSubjects) && s.curriculumSubjects.length
              ? s.curriculumSubjects.map(x=>`<span class="badge badge-light" style="margin:2px;">${escapeHtml(x)}</span>`).join('')
              : '<span style="color:#94a3b8;">No subjects assigned</span>'}</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="editSGuardian">Parent / Guardian</label>
              <input type="text" id="editSGuardian" class="input-field" value="${escapeHtml(s.guardian || '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="editSPhone">Contact Phone</label>
              <input type="text" id="editSPhone" class="input-field" value="${escapeHtml(s.phone || '')}">
            </div>
          </div>

        </div>
      `,
      confirmText: 'Save Profile Changes',
      onConfirm: async () => {
        const name = document.getElementById('editSName').value.trim();
        const cls = document.getElementById('editSClass').value;
        const cat = document.getElementById('editSCat').value;
        const status = document.getElementById('editSStatus').value;
        const dob = document.getElementById('editSDob').value;
        const guardian = document.getElementById('editSGuardian').value.trim();
        const phone = document.getElementById('editSPhone').value.trim();

        if (!name) {
          API.toastNotification('Student name is required.', true);
          return;
        }

        const assignedSubjects = Array.isArray(s.curriculumSubjects)
          ? Array.from(new Set(s.curriculumSubjects.map(x=>String(x||'').trim()).filter(Boolean)))
          : [];

        const res = await API.callBackend('updateStudent', {
          student: {
            id: s.id,
            name: name,
            className: cls,
            grade: cls,
            studentCategory: cat,
            status: status,
            dob: dob,
            photo: updatedPhoto,
            guardian: guardian,
            phone: phone,
            curriculumSubjects: assignedSubjects
          }
        }, 'Updating student...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('students');
        } else {
          API.toastNotification(res.message || 'Error updating student.', true);
        }
      }
    });

    setTimeout(() => {
      const photoInput = document.getElementById('editStudentPhotoInput');
      if (photoInput) {
        photoInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              updatedPhoto = evt.target.result;
              const box = document.getElementById('editStudentPhotoBox');
              if (box) box.innerHTML = `<img src="${updatedPhoto}" style="width:100%;height:100%;object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
          }
        };
      }
    }, 50);
  }

  async function deleteStudent(studentId) {
    if (!confirm(`Are you sure you want to permanently delete student [${studentId}] and all associated records?`)) return;
    const res = await API.callBackend('deleteStudent', { studentId: studentId }, 'Deleting student record...');
    if (res && res.success) {
      API.toastSuccess();
      cachedStudents = cachedStudents.filter(s => s.id !== studentId);
      loadTab('students');
    } else {
      API.toastNotification(res.message || 'Error deleting student.', true);
    }
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
  // 3. TEACHING STAFF TAB — YEAR-SPECIFIC FACULTY DIRECTORY
  // =========================================================================
  const TEACHER_YEARS = ACADEMIC_YEARS;

  async function renderTeachersTab(container) {
    const res = await API.callBackend('getTeachers', {}, 'Fetching teaching staff...');
    cachedTeachers = (res && res.success && Array.isArray(res.teachers)) ? res.teachers : [];
    const canEdit = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['teachers:edit']);
    const canDelete = currentUser.role === 'superadmin' || (currentUser.permissions && currentUser.permissions['teachers:delete']);

    const yearCounts = TEACHER_YEARS.map(y => ({year:y,count:cachedTeachers.filter(t=>String(t.academicYear||'')===y).length}));
    const activeCount = cachedTeachers.filter(t=>String(t.status||'Active')==='Active').length;
    const assignedCount = cachedTeachers.filter(t=>Array.isArray(t.assignments)&&t.assignments.length).length;

    container.innerHTML = `
      <div class="content-card" style="overflow:hidden;">
        <div class="card-header-row" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h3 class="card-title">Teaching Staff Management</h3>
            <div style="font-size:13px;color:var(--color-text-muted);">Year-specific teacher accounts, credentials, photos, classes, subjects and contact records.</div>
          </div>
          ${canEdit ? `<button type="button" class="btn btn-primary" id="addTeacherBtn" style="display:flex;align-items:center;gap:7px;white-space:nowrap;"><img src="assets/icons/user.png" style="width:15px;height:15px;filter:brightness(0) invert(1);"> Add Teaching Staff</button>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0;">
          <div style="padding:14px;border:1px solid var(--color-border);border-radius:10px;background:#f8fafc;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Total Staff</div><div style="font-size:25px;font-weight:800;color:var(--color-primary);">${cachedTeachers.length}</div></div>
          <div style="padding:14px;border:1px solid var(--color-border);border-radius:10px;background:#f8fafc;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Active</div><div style="font-size:25px;font-weight:800;color:#15803d;">${activeCount}</div></div>
          <div style="padding:14px;border:1px solid var(--color-border);border-radius:10px;background:#f8fafc;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">With Assignments</div><div style="font-size:25px;font-weight:800;color:#7c3aed;">${assignedCount}</div></div>
          <div style="padding:14px;border:1px solid var(--color-border);border-radius:10px;background:#f8fafc;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Academic Years</div><div style="font-size:25px;font-weight:800;color:#0f766e;">${yearCounts.filter(x=>x.count).length}</div></div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(180px,1.4fr) repeat(2,minmax(150px,1fr));gap:10px;margin-bottom:14px;">
          <input id="teacherSearch" class="input-field" placeholder="Search name, ID, phone or email...">
          <select id="teacherYearFilter" class="select-field"><option value="all">All Academic Years</option>${TEACHER_YEARS.map(y=>`<option value="${y}" ${y===selectedAcademicYear?'selected':''}>${y.replace('-', '–')}</option>`).join('')}</select>
          <select id="teacherStatusFilter" class="select-field"><option value="all">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
        </div>
        <div id="teacherDirectoryBody"></div>
      </div>`;

    const renderRows = () => {
      const q=(document.getElementById('teacherSearch')?.value||'').trim().toLowerCase();
      const y=document.getElementById('teacherYearFilter')?.value||'all';
      const st=document.getElementById('teacherStatusFilter')?.value||'all';
      const rows=cachedTeachers.filter(t=>{
        const hay=[t.id,t.name,t.phone,t.email,t.title,t.academicYear].join(' ').toLowerCase();
        return (!q||hay.includes(q))&&(y==='all'||String(t.academicYear||'')===y)&&(st==='all'||String(t.status||'Active')===st);
      });
      const body=document.getElementById('teacherDirectoryBody');
      if(!body)return;
      body.innerHTML=rows.length?`<div class="table-responsive"><table class="data-table" style="min-width:950px;"><thead><tr><th>Staff</th><th>Academic Year</th><th>Systematic ID</th><th>Assigned Class / Subject</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(t=>{
        const assignments=(t.assignments||[]).map(a=>`<div style="margin:2px 0;"><b>${escapeHtml(a.class)}</b><span style="color:#64748b;"> — ${Array.isArray(a.subjects)&&a.subjects.length?a.subjects.map(escapeHtml).join(', '):'All Subjects'}</span></div>`).join('');
        return `<tr><td><div style="display:flex;align-items:center;gap:9px;min-width:185px;"><div style="width:42px;height:42px;border-radius:50%;overflow:hidden;background:#e2e8f0;display:flex;align-items:center;justify-content:center;border:1px solid #cbd5e1;flex-shrink:0;">${t.photo?`<img src="${escapeHtml(t.photo)}" style="width:100%;height:100%;object-fit:cover;">`:'<img src="assets/icons/user.png" style="width:23px;height:23px;opacity:.65;">'}</div><div><b>${escapeHtml(t.name)}</b><div style="font-size:11px;color:#64748b;">${escapeHtml(t.title||'Teacher')}</div></div></div></td><td><span class="badge badge-light">${escapeHtml(String(t.academicYear||'—').replace('-', '–'))}</span></td><td><b style="color:var(--color-primary);">${escapeHtml(t.id)}</b><div style="font-size:10px;color:#64748b;">Login ID</div></td><td style="max-width:360px;">${assignments||'<span style="color:#94a3b8;">Not assigned</span>'}</td><td>${escapeHtml(t.phone||'—')}<br><span style="font-size:11px;color:#64748b;">${escapeHtml(t.email||'')}</span></td><td><span class="badge ${t.status==='Active'?'badge-success':'badge-danger'}">${escapeHtml(t.status||'Active')}</span></td><td><div style="display:flex;gap:4px;flex-wrap:wrap;"><button class="btn btn-light btn-sm" onclick="window.AdminPanel.previewTeacherIdCard('${escapeHtml(t.id)}')">ID Card</button><button class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditTeacherModal('${escapeHtml(t.id)}')">Edit</button>${canDelete?`<button class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteTeacher('${escapeHtml(t.id)}')">Delete</button>`:''}</div></td></tr>`;
      }).join('')}</tbody></table></div>`:`<div style="padding:42px 20px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:10px;">No teaching staff found. Use <b>Add Teaching Staff</b> to create a year-specific teacher account.</div>`;
    };
    ['teacherSearch','teacherYearFilter','teacherStatusFilter'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderRows));
    document.getElementById('teacherYearFilter')?.addEventListener('change',renderRows);
    if(canEdit)document.getElementById('addTeacherBtn').onclick=()=>openAddTeacherModal();
    renderRows();
  }

  function teacherYearOptions(selected){ return TEACHER_YEARS.map(y=>`<option value="${y}" ${String(selected||'')===y?'selected':''}>${y.replace('-', '–')}</option>`).join(''); }

  async function openAddTeacherModal() {
    const idRes=await API.callBackend('getNextTeacherId',{},'Fetching next teacher ID...');
    const nextId=idRes&&idRes.success?idRes.nextId:'SPST001';
    App.showModal({title:'Register Teaching Staff',content:`
      <div style="font-size:13.5px;max-height:78vh;overflow-y:auto;padding-right:5px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;">
          <div class="form-group"><label class="form-label">Academic Year *</label><select id="ntYear" class="select-field">${teacherYearOptions(selectedAcademicYear)}</select></div>
          <div class="form-group"><label class="form-label">Systematic ID *</label><input id="ntId" class="input-field" value="${escapeHtml(nextId)}" required><div class="form-hint">Format: SPST001, SPST002...</div></div>
          <div class="form-group"><label class="form-label">Full Name *</label><input id="ntName" class="input-field" placeholder="Teacher full name" required></div>
          <div class="form-group"><label class="form-label">Professional Title</label><input id="ntTitle" class="input-field" value="Teacher"></div>
          <div class="form-group"><label class="form-label">Contact Phone *</label><input id="ntPhone" class="input-field" placeholder="+231..."></div>
          <div class="form-group"><label class="form-label">Email</label><input id="ntEmail" type="email" class="input-field" placeholder="teacher@school.com"></div>
          <div class="form-group"><label class="form-label">Password *</label><input id="ntPass" type="password" class="input-field" value="teacher123" required></div>
          <div class="form-group"><label class="form-label">Status</label><select id="ntStatus" class="select-field"><option>Active</option><option>Inactive</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Staff Photo</label><input type="file" id="ntPhoto" class="input-field" accept="image/*"><div class="form-hint">Passport/profile photo used throughout the teacher portal and ID card.</div></div>
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin:12px 0;background:#f8fafc;"><label class="form-label" style="font-weight:700;">Assigned Classes</label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:6px;font-size:12px;">${GRADE_LEVELS.map(g=>`<label><input type="checkbox" class="nt-class-check" value="${escapeHtml(g)}"> ${escapeHtml(g)}</label>`).join('')}</div></div>
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#f8fafc;"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><label class="form-label" style="font-weight:700;">Assigned Subjects</label><button type="button" class="btn btn-light btn-sm" id="ntToggleAllSubjectsBtn">Select All</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;font-size:12px;">${getCatalogSubjects().map(sub=>`<label><input type="checkbox" class="nt-subject-check" value="${escapeHtml(sub)}"> ${escapeHtml(sub)}</label>`).join('')}</div></div>
      </div>`,confirmText:'Create Teacher Account',onConfirm:async()=>{
        const id=document.getElementById('ntId').value.trim(),name=document.getElementById('ntName').value.trim(),year=document.getElementById('ntYear').value,pass=document.getElementById('ntPass').value.trim();
        if(!id||!name||!pass){API.toastNotification('Academic year, Systematic ID, name and password are required.',true);return false;}
        const classes=[...document.querySelectorAll('.nt-class-check:checked')].map(x=>x.value),subjects=[...document.querySelectorAll('.nt-subject-check:checked')].map(x=>x.value);
        const assignments=classes.map(cls=>({class:cls,subjects:subjects}));
        const file=document.getElementById('ntPhoto').files[0];
        const photo=file?await readFileAsDataUrl(file):'';
        const teacher={id,name,academicYear:year,title:document.getElementById('ntTitle').value.trim()||'Teacher',phone:document.getElementById('ntPhone').value.trim(),email:document.getElementById('ntEmail').value.trim(),password:pass,photo,status:document.getElementById('ntStatus').value,assignments,createdAt:new Date().toISOString()};
        const r=await API.callBackend('saveTeacher',{teacher},'Creating teacher account...');
        if(r&&r.success){API.toastSuccess(`${id} created for ${year}. Teacher can now sign in from the Teacher Portal.`);loadTab('teachers');return true;}else{API.toastNotification((r&&r.message)||'Could not create teacher.',true);return false;}
      }});
    setTimeout(()=>{const b=document.getElementById('ntToggleAllSubjectsBtn');if(b)b.onclick=()=>{const c=[...document.querySelectorAll('.nt-subject-check')],all=c.length&&c.every(x=>x.checked);c.forEach(x=>x.checked=!all);b.textContent=all?'Select All':'Deselect All';};},50);
  }

  function openEditTeacherModal(teacherId) {
    const t=cachedTeachers.find(x=>x.id===teacherId); if(!t)return;
    const assignedClasses=(t.assignments||[]).map(a=>a.class), assignedSubjects=[...new Set((t.assignments||[]).flatMap(a=>a.subjects||[]))];
    App.showModal({title:`Edit Teaching Staff — ${escapeHtml(t.name)}`,content:`
      <div style="font-size:13.5px;max-height:78vh;overflow-y:auto;padding-right:5px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;">
          <div class="form-group"><label class="form-label">Academic Year</label><select id="etYear" class="select-field">${teacherYearOptions(t.academicYear)}</select></div>
          <div class="form-group"><label class="form-label">Systematic ID</label><input id="etId" class="input-field" value="${escapeHtml(t.id)}" disabled></div>
          <div class="form-group"><label class="form-label">Full Name</label><input id="etName" class="input-field" value="${escapeHtml(t.name)}"></div>
          <div class="form-group"><label class="form-label">Professional Title</label><input id="etTitle" class="input-field" value="${escapeHtml(t.title||'Teacher')}"></div>
          <div class="form-group"><label class="form-label">Contact Phone</label><input id="etPhone" class="input-field" value="${escapeHtml(t.phone||'')}"></div>
          <div class="form-group"><label class="form-label">Email</label><input id="etEmail" type="email" class="input-field" value="${escapeHtml(t.email||'')}"></div>
          <div class="form-group"><label class="form-label">Status</label><select id="etStatus" class="select-field"><option ${t.status==='Active'?'selected':''}>Active</option><option ${t.status==='Inactive'?'selected':''}>Inactive</option></select></div>
          <div class="form-group"><label class="form-label">Reset Password</label><input id="etPass" type="password" class="input-field" placeholder="Leave blank to keep current"></div>
        </div>
        <div class="form-group"><label class="form-label">Replace Staff Photo</label><input type="file" id="etPhoto" class="input-field" accept="image/*"></div>
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#f8fafc;margin:12px 0;"><label class="form-label" style="font-weight:700;">Assigned Classes</label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:6px;font-size:12px;">${GRADE_LEVELS.map(g=>`<label><input type="checkbox" class="et-class-check" value="${escapeHtml(g)}" ${assignedClasses.includes(g)?'checked':''}> ${escapeHtml(g)}</label>`).join('')}</div></div>
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#f8fafc;"><label class="form-label" style="font-weight:700;">Assigned Subjects</label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;font-size:12px;">${getCatalogSubjects().map(sub=>`<label><input type="checkbox" class="et-subject-check" value="${escapeHtml(sub)}" ${assignedSubjects.includes(sub)?'checked':''}> ${escapeHtml(sub)}</label>`).join('')}</div></div>
      </div>`,confirmText:'Save Teacher Profile',onConfirm:async()=>{
        const name=document.getElementById('etName').value.trim(); if(!name){API.toastNotification('Teacher name is required.',true);return false;}
        const classes=[...document.querySelectorAll('.et-class-check:checked')].map(x=>x.value),subjects=[...document.querySelectorAll('.et-subject-check:checked')].map(x=>x.value);
        const file=document.getElementById('etPhoto').files[0];
        const payload={id:t.id,originalId:t.id,name,academicYear:document.getElementById('etYear').value,title:document.getElementById('etTitle').value.trim(),phone:document.getElementById('etPhone').value.trim(),email:document.getElementById('etEmail').value.trim(),status:document.getElementById('etStatus').value,photo:file?await readFileAsDataUrl(file):(t.photo||''),assignments:classes.map(cls=>({class:cls,subjects}))};
        const pass=document.getElementById('etPass').value.trim();if(pass)payload.password=pass;
        const r=await API.callBackend('saveTeacher',{teacher:payload},'Saving teacher profile...');if(r&&r.success){API.toastSuccess('Teacher profile updated.');loadTab('teachers');return true;}else{API.toastNotification((r&&r.message)||'Could not update teacher.',true);return false;}
      }});
  }

  async function deleteTeacher(teacherId) {
    const t=cachedTeachers.find(x=>x.id===teacherId); if(!t)return;
    if(!confirm(`Remove ${t.name} (${t.id}) from ${t.academicYear}?`))return;
    const r=await API.callBackend('deleteTeacher',{teacherId},'Removing teacher...');
    if(r&&r.success){API.toastSuccess('Teaching staff removed.');loadTab('teachers');}else API.toastNotification(r.message||'Could not remove teacher.',true);
  }

  // =========================================================================
  // 4. TUITION & FEES MANAGEMENT (CLASS FEE SCHEDULE + STUDENT PAYMENTS)
  // =========================================================================
  let financeCategoryView = 'new'; // 'new' or 'old'

  async function renderFinanceTab(container) {
    const [studRes, feesRes] = await Promise.all([
      API.callBackend('getAllStudents', { academicYear: selectedAcademicYear }, 'Loading finance records...'),
      API.callBackend('getClassFees', {}, 'Loading class fees...')
    ]);

    cachedStudents = (studRes && studRes.success && Array.isArray(studRes.students)) ? studRes.students : [];
    const students = cachedStudents;
    if (feesRes && feesRes.success && Array.isArray(feesRes.classFees)) {
      cachedClassFees = feesRes.classFees;
    }

    container.innerHTML = `
      <div class="content-card" style="margin-bottom: 20px;">
        <!-- Card 1: Class Fee Schedule (New vs Old Students) -->
        <div class="card-header-row" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Class Fee Schedule (Tuition &amp; Fees Architecture)</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Set institutional billing rates per grade level. Registering a student automatically binds their year fee schedule.
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <div class="btn-group" style="display: flex; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
              <button type="button" class="btn btn-sm ${financeCategoryView === 'new' ? 'btn-primary' : 'btn-light'}" id="feeViewNewBtn" style="border-radius: 0;">
                New Students Rates
              </button>
              <button type="button" class="btn btn-sm ${financeCategoryView === 'old' ? 'btn-primary' : 'btn-light'}" id="feeViewOldBtn" style="border-radius: 0;">
                Returning (Old) Students Rates
              </button>
            </div>
          </div>
        </div>

        <!-- Class Fee Schedule Table -->
        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr style="background: #f1f5f9;">
                <th>Class / Grade Level</th>
                <th style="text-align: right;">Entrance</th>
                <th style="text-align: right;">Registration</th>
                <th style="text-align: right;">Tuition Total</th>
                <th style="text-align: right;">Requirements</th>
                <th style="text-align: right;">PE Suit</th>
                <th style="text-align: right;">Portal Fee</th>
                <th style="text-align: right; background: #e2e8f0;">Total Package</th>
                <th style="text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${GRADE_LEVELS.map(cls => {
                const sched = getClassFeeSchedule(cls, financeCategoryView);
                const ent = toNum(sched.entranceFee);
                const reg = toNum(sched.registrationFee);
                const tui = toNum(sched.tuitionTotal);
                const req = toNum(sched.requirementsFee);
                const pe = toNum(sched.peSuitFee);
                const port = toNum(sched.portalFee);
                const tot = ent + reg + tui + req + pe + port;
                const cur = sched.currency || 'USD';
                return `
                  <tr>
                    <td><b>${escapeHtml(cls)}</b></td>
                    <td style="text-align: right;">${ent > 0 ? formatMoney(ent, cur) : '<span style="color:#94a3b8;">Waived</span>'}</td>
                    <td style="text-align: right;">${formatMoney(reg, cur)}</td>
                    <td style="text-align: right; font-weight: 600;">${formatMoney(tui, cur)}</td>
                    <td style="text-align: right;">${formatMoney(req, cur)}</td>
                    <td style="text-align: right;">${formatMoney(pe, cur)}</td>
                    <td style="text-align: right;">${formatMoney(port, cur)}</td>
                    <td style="text-align: right; font-weight: 800; color: var(--color-primary); background: #f8fafc;">${formatMoney(tot, cur)}</td>
                    <td style="text-align: center;">
                      <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openClassFeeModal('${escapeHtml(cls)}', '${financeCategoryView}')" title="Configure fee rates">
                        Edit Schedule
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="content-card" style="margin-top:14px;background:#f8fafc;border:1px solid #cbd5e1;">
          <div class="card-header-row" style="flex-wrap:wrap;gap:10px;"><div><h4 class="card-title" style="margin:0;">Additional Payment Items</h4><div style="font-size:12px;color:#64748b;">Add custom charges for this academic year.</div></div><button type="button" class="btn btn-primary btn-sm" id="addFeeItemBtn">+ Add Payment</button></div>
          <div id="feeItemsList" style="margin-top:10px;"></div>
        </div>
      </div>

      <!-- Card 2: Student Tuition & Fee Payments Table -->
      <div class="content-card">
        <div class="card-header-row" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Student Tuition &amp; Fee Payments Ledger</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Record installments, registration, and monitor student ledger balances for ${escapeHtml(selectedAcademicYear)}.
            </div>
          </div>

          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <input type="text" id="finSearchInput" class="input-field" placeholder="Search student or ID..." style="max-width: 190px;">
            <select id="finClassFilter" class="select-field" style="max-width: 140px;">
              <option value="">All Classes</option>
              ${GRADE_LEVELS.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
            </select>
            <select id="finStatusFilter" class="select-field" style="max-width: 130px;">
              <option value="">All Statuses</option>
              <option value="overdue">Overdue Balance</option>
              <option value="cleared">Tuition Cleared</option>
            </select>
          </div>
        </div>

        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table" id="finStudentTable">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student</th>
                <th>Class</th>
                <th>Category</th>
                <th style="text-align: right;">Total Billed</th>
                <th style="text-align: center;">Registration</th>
                <th style="text-align: center;">Installments (1/2/3/4)</th>
                <th style="text-align: right;">Total Paid</th>
                <th style="text-align: right;">Balance</th>
                <th style="text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody id="finStudentTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    async function renderFeeItems(){
      const box=document.getElementById('feeItemsList'); if(!box)return;
      const r=await API.callBackend('getFeeItems',{studentCategory:financeCategoryView,academicYear:selectedAcademicYear},'Loading payment items...');
      const items=(r&&r.success&&Array.isArray(r.feeItems))?r.feeItems:[];
      box.innerHTML=items.length?items.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;flex-wrap:wrap;"><div><b>${escapeHtml(x.description)}</b><div style="font-size:11px;color:#64748b;">${escapeHtml(x.academicYear||selectedAcademicYear)} • ${x.studentCategory==='old'?'Returning':'New'}${x.className?' • '+escapeHtml(x.className):''}</div></div><div style="display:flex;align-items:center;gap:8px;"><b>${formatMoney(Number(x.amount)||0,x.currency||dashboardCurrency)}</b><button class="btn btn-light btn-sm" onclick="window.AdminPanel.deleteFeeItem('${escapeHtml(x.id)}')">Delete</button></div></div>`).join(''):'<div style="padding:15px;text-align:center;color:#94a3b8;">No additional payment items added yet.</div>';
    }
    document.getElementById('addFeeItemBtn').onclick=()=>openAddFeeItemModal();
    await renderFeeItems();

    // Filter and Render Student Finance Rows
    function renderFinRows() {
      const tbody = document.getElementById('finStudentTableBody');
      if (!tbody) return;

      const q = (document.getElementById('finSearchInput')?.value || '').trim().toLowerCase();
      const cls = (document.getElementById('finClassFilter')?.value || '').trim().toLowerCase();
      const stat = (document.getElementById('finStatusFilter')?.value || '').trim().toLowerCase();

      const filtered = students.filter(s => {
        const matchYear = !selectedAcademicYear || !s.academicYear || String(s.academicYear).trim() === String(selectedAcademicYear).trim();
        const curBal = studentBalance(s);
        const matchQ = !q || (s.name && s.name.toLowerCase().includes(q)) || (s.id && s.id.toLowerCase().includes(q));
        const matchCls = !cls || String(s.className || s.grade || '').toLowerCase() === cls;
        let matchStat = true;
        if (stat === 'overdue') matchStat = curBal > 0;
        if (stat === 'cleared') matchStat = curBal <= 0 && toNum((s.finance || {}).tuitionTotal) > 0;
        return matchYear && matchQ && matchCls && matchStat;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No student finance accounts match your filter.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(s => {
        const f = s.finance || {};
        const cur = f.currency || 'USD';
        const inst = f.installments || [0, 0, 0, 0];
        const totBilled = toNum(f.tuitionTotal) + toNum(f.registrationFee) + toNum(f.requirementsFee) + toNum(f.peSuitFee) + toNum(f.portalFee) + toNum(f.entranceFee);
        const totPaid = toNum(f.totalPaid);
        const bal = studentBalance(s);

        return `
          <tr>
            <td><b>[${escapeHtml(s.id)}]</b></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #cbd5e1;">
                  ${s.photo ? `<img src="${escapeHtml(s.photo)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='👤'">` : '👤'}
                </div>
                <span style="font-weight: 600;">${escapeHtml(s.name)}</span>
              </div>
            </td>
            <td>${escapeHtml(s.className || s.grade)}</td>
            <td><span class="badge ${s.studentCategory === 'old' ? 'badge-light' : 'badge-info'}">${s.studentCategory === 'old' ? 'Returning' : 'New'}</span></td>
            <td style="text-align: right; font-weight: 600;">${formatMoney(totBilled, cur)}</td>
            <td style="text-align: center;">${f.registrationPaid ? '<span class="badge badge-success" style="padding: 2px 6px; font-size: 10.5px;">Paid</span>' : '<span class="badge badge-warning" style="padding: 2px 6px; font-size: 10.5px;">Unpaid</span>'}</td>
            <td style="text-align: center; font-size: 11.5px; color: #475569;">
              $${inst[0]} / $${inst[1]} / $${inst[2]} / $${inst[3]}
            </td>
            <td style="text-align: right;"><b style="color: var(--color-success);">${formatMoney(totPaid, cur)}</b></td>
            <td style="text-align: right;"><b class="${bal > 0 ? 'score-red' : 'score-green'}">${formatMoney(bal, cur)}</b></td>
            <td style="text-align: center;">
              <div style="display: flex; gap: 4px; justify-content: center;">
                <button type="button" class="btn btn-primary btn-sm" onclick="window.AdminPanel.openEditPaymentModal('${escapeHtml(s.id)}')">
                  Edit Payment
                </button>
                <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.printSingleReceipt('${escapeHtml(s.id)}')">
                  🧾
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderFinRows();

    // Event listeners
    document.getElementById('feeViewNewBtn').onclick = () => {
      financeCategoryView = 'new';
      renderFinanceTab(container);
    };
    document.getElementById('feeViewOldBtn').onclick = () => {
      financeCategoryView = 'old';
      renderFinanceTab(container);
    };

    document.getElementById('finSearchInput').oninput = renderFinRows;
    document.getElementById('finClassFilter').onchange = renderFinRows;
    document.getElementById('finStatusFilter').onchange = renderFinRows;
  }

  async function openAddFeeItemModal(){
    App.showModal({title:'Add Payment',content:`<div style="display:grid;gap:12px;"><div class="form-group"><label class="form-label">Description *</label><input id="afiDesc" class="input-field" placeholder="e.g. Examination Fee" required></div><div class="form-group"><label class="form-label">Amount *</label><input id="afiAmount" type="number" min="0" step="0.01" class="input-field" placeholder="0.00" required></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div><label class="form-label">Academic Year</label><select id="afiYear" class="select-field">${TEACHER_YEARS.map(y=>`<option value="${y}" ${y===selectedAcademicYear?'selected':''}>${y.replace('-', '–')}</option>`).join('')}</select></div><div><label class="form-label">Student Type</label><select id="afiCat" class="select-field"><option value="new">New Students</option><option value="old">Returning Students</option></select></div></div><div><label class="form-label">Class (optional)</label><select id="afiClass" class="select-field"><option value="">All Classes</option>${GRADE_LEVELS.map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}</select></div></div>`,confirmText:'Save',onConfirm:async()=>{const description=document.getElementById('afiDesc').value.trim();const amount=Number(document.getElementById('afiAmount').value);if(!description||!isFinite(amount)||amount<0){API.toastNotification('Description and a valid amount are required.',true);return false;}const r=await API.callBackend('saveFeeItem',{description,amount,academicYear:document.getElementById('afiYear').value,studentCategory:document.getElementById('afiCat').value,className:document.getElementById('afiClass').value,currency:dashboardCurrency},'Saving payment...');if(r&&r.success){API.toastSuccess('Payment saved.');loadTab('finance');return true;}API.toastNotification(r.message||'Could not save payment.',true);return false;}});
  }
  async function deleteFeeItem(id){if(!confirm('Delete this payment item?'))return;const r=await API.callBackend('deleteFeeItem',{id},'Deleting payment...');if(r&&r.success){API.toastSuccess('Payment removed.');loadTab('finance');}else API.toastNotification(r.message||'Could not delete payment.',true);}

  // --- Modal to Configure Class Fee Schedule ---
  function openClassFeeModal(className, category) {
    category = String(category || 'new').toLowerCase();
    const sched = getClassFeeSchedule(className, category);

    App.showModal({
      title: `Set Class Fee Schedule: ${escapeHtml(className)} (${category === 'new' ? 'New Students' : 'Returning Students'})`,
      content: `
        <div style="font-size: 13.5px;">
          <div style="background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 14px;">
            <div>Class: <b>${escapeHtml(className)}</b> &bull; Category: <b>${category === 'new' ? 'New Enrollee' : 'Returning Student'}</b></div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Configuring fees for this class automatically binds newly registered students to these rates.
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="cfCurrency">Currency *</label><select id="cfCurrency" class="select-field"><option value="USD" ${((sched.currency||dashboardCurrency)==="USD")?"selected":""}>USD</option><option value="LRD" ${((sched.currency||dashboardCurrency)==="LRD")?"selected":""}>LRD</option></select><label class="form-label" for="cfTuition">Tuition Total *</label>
              <input type="number" id="cfTuition" class="input-field" value="${sched.tuitionTotal || 0}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="cfReg">Registration Fee *</label>
              <input type="number" id="cfReg" class="input-field" value="${sched.registrationFee || 0}" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="cfEntrance">Entrance Fee ($)</label>
              <input type="number" id="cfEntrance" class="input-field" value="${sched.entranceFee || 0}">
              <div class="form-hint">Usually $0 for returning students.</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="cfReq">Requirements Fee ($)</label>
              <input type="number" id="cfReq" class="input-field" value="${sched.requirementsFee || 0}">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="cfPe">PE Suit Fee ($)</label>
              <input type="number" id="cfPe" class="input-field" value="${sched.peSuitFee || 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="cfPortal">Portal Fee ($)</label>
              <input type="number" id="cfPortal" class="input-field" value="${sched.portalFee || 0}">
            </div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin-top:12px;">
            <b style="color:var(--color-primary);">5-Installment Tuition Schedule &amp; Deadlines</b>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px;">
              ${[1,2,3,4,5].map(i=>`<div><label class="form-label">${i}${i===1?'st':i===2?'nd':i===3?'rd':'th'} Deadline</label><input type="date" id="cfD${i}" class="input-field" value="${escapeHtml((sched.deadlines&&sched.deadlines[i-1])||'')}"></div>`).join('')}
            </div>
            <div class="form-hint">Each installment is tracked against these dates. Students with unpaid installments after the deadline receive an easy-to-read warning in their portal.</div>
          </div>
        </div>
      `,
      confirmText: 'Save Class Fee Schedule',
      onConfirm: async () => {
        const tuition = Number(document.getElementById('cfTuition').value) || 0;
        const reg = Number(document.getElementById('cfReg').value) || 0;
        const entrance = Number(document.getElementById('cfEntrance').value) || 0;
        const req = Number(document.getElementById('cfReq').value) || 0;
        const pe = Number(document.getElementById('cfPe').value) || 0;
        const portal = Number(document.getElementById('cfPortal').value) || 0;

        const feeData = {
          className: className,
          studentCategory: category,
          currency: document.getElementById('cfCurrency').value,
          tuitionTotal: tuition,
          registrationFee: reg,
          entranceFee: entrance,
          requirementsFee: req,
          peSuitFee: pe,
          portalFee: portal,
          inst1Amount: Math.round(tuition / 5),
          inst2Amount: Math.round(tuition / 5),
          inst3Amount: Math.round(tuition / 5),
          inst4Amount: Math.round(tuition / 5),
          inst5Amount: Math.round(tuition / 5),
          deadlines: [1,2,3,4,5].map(i=>document.getElementById('cfD'+i).value)
        };

        const res = await API.callBackend('saveClassFee', feeData, 'Saving fee schedule...');
        if (res && res.success) {
          API.toastSuccess();
          // Update cachedClassFees locally
          const idx = cachedClassFees.findIndex(f => f.className === className && f.studentCategory === category);
          if (idx >= 0) cachedClassFees[idx] = Object.assign({}, cachedClassFees[idx], feeData);
          else cachedClassFees.push(feeData);
          loadTab('finance');
        } else {
          API.toastNotification(res.message || 'Error saving class fee schedule.', true);
        }
      }
    });
  }

  // --- Modal to Edit / Record Payment for Student ---
  async function openEditPaymentModal(studentId) {
    let student = cachedStudents.find(s => s.id === studentId);
    if (!student) {
      const res = await API.callBackend('getAllStudents', { academicYear: selectedAcademicYear });
      if (res && res.success && Array.isArray(res.students)) {
        cachedStudents = res.students;
        student = cachedStudents.find(s => s.id === studentId);
      }
    }
    if (!student) {
      API.toastNotification('Student record not found.', true);
      return;
    }

    const f = student.finance || {};
    const inst = f.installments || [0, 0, 0, 0];
    const currency = f.currency || 'USD';

    App.showModal({
      title: `Edit Fee Payment: ${escapeHtml(student.name)} [${escapeHtml(student.id)}]`,
      content: `
        <div style="font-size: 13.5px; max-height: 75vh; overflow-y: auto; padding-right: 6px;">
          <!-- Student Banner -->
          <div style="display: flex; gap: 12px; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 6px; overflow: hidden; background: #e2e8f0; border: 1.5px solid var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ${student.photo ? `<img src="${escapeHtml(student.photo)}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
            </div>
            <div>
              <div style="font-weight: 700; color: var(--color-primary);">${escapeHtml(student.name)} [${escapeHtml(student.id)}]</div>
              <div style="font-size: 12px; color: #64748b;">
                Class: <b>${escapeHtml(student.className || student.grade)}</b> &bull; Category: <b>${student.studentCategory === 'old' ? 'Returning Student' : 'New Enrollee'}</b>
              </div>
            </div>
          </div>

          <!-- Miscellaneous Fees Breakdown -->
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #ffffff;">
            <div style="font-weight: 700; color: var(--color-primary); font-size: 13px; margin-bottom: 8px;">Admission &amp; Activity Fees</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label class="form-label" for="epRegFee">Registration Fee ($)</label>
                <input type="number" id="epRegFee" class="input-field ep-calc-input" value="${f.registrationFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epRegPaid" class="ep-calc-input" ${f.registrationPaid ? 'checked' : ''}>
                  <span>Mark as Paid</span>
                </label>
              </div>

              <div>
                <label class="form-label" for="epEntFee">Entrance Fee ($)</label>
                <input type="number" id="epEntFee" class="input-field ep-calc-input" value="${f.entranceFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epEntPaid" class="ep-calc-input" ${f.entranceFeePaid ? 'checked' : ''}>
                  <span>Mark as Paid</span>
                </label>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
              <div>
                <label class="form-label" for="epReqFee">Requirements ($)</label>
                <input type="number" id="epReqFee" class="input-field ep-calc-input" value="${f.requirementsFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epReqPaid" class="ep-calc-input" ${f.requirementsFeePaid ? 'checked' : ''}>
                  <span>Paid</span>
                </label>
              </div>

              <div>
                <label class="form-label" for="epPeFee">PE Suit ($)</label>
                <input type="number" id="epPeFee" class="input-field ep-calc-input" value="${f.peSuitFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epPePaid" class="ep-calc-input" ${f.peSuitFeePaid ? 'checked' : ''}>
                  <span>Paid</span>
                </label>
              </div>

              <div>
                <label class="form-label" for="epPortalFee">Portal Fee ($)</label>
                <input type="number" id="epPortalFee" class="input-field ep-calc-input" value="${f.portalFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epPortalPaid" class="ep-calc-input" ${f.portalFeePaid ? 'checked' : ''}>
                  <span>Paid</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Tuition Installments -->
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #ffffff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; color: var(--color-primary); font-size: 13px;">Tuition Installments Payments</span>
              <div style="font-size: 12px;">Total Tuition Billed: <input type="number" id="epTuitionTotal" class="input-field ep-calc-input" style="width: 90px; display: inline-block; padding: 3px 6px; font-weight: 700;" value="${f.tuitionTotal || 0}"></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label" for="epInst1">1st Installment Paid ($)</label>
                <input type="number" id="epInst1" class="input-field ep-calc-input" value="${inst[0] || 0}">
              </div>
              <div class="form-group">
                <label class="form-label" for="epInst2">2nd Installment Paid ($)</label>
                <input type="number" id="epInst2" class="input-field ep-calc-input" value="${inst[1] || 0}">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label" for="epInst3">3rd Installment Paid ($)</label>
                <input type="number" id="epInst3" class="input-field ep-calc-input" value="${inst[2] || 0}">
              </div>
              <div class="form-group">
                <label class="form-label" for="epInst4">4th Installment Paid ($)</label>
                <input type="number" id="epInst4" class="input-field ep-calc-input" value="${inst[3] || 0}">
              </div>
            </div>
            <div class="form-group"><label class="form-label" for="epInst5">5th Installment Paid</label><input type="number" id="epInst5" class="input-field ep-calc-input" value="${inst[4] || 0}"></div>
            <div style="background:#fff7ed;border:1px solid #fed7aa;padding:10px;border-radius:7px;font-size:12px;color:#9a3412;">${[0,1,2,3,4].map(i=>{const d=(getClassFeeSchedule(student.className||student.grade,student.studentCategory||'new').deadlines||[])[i]; return d && new Date(d)<new Date() && !(inst[i]>0) ? `Payment warning: The ${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'} installment deadline has passed. Please make this payment as soon as possible.`:''}).filter(Boolean).join('<br>')}</div>

            <div class="form-group" style="margin-top: 6px;">
              <label class="form-label" for="epOther">Add Another Payment</label>
              <input type="number" id="epOther" class="input-field ep-calc-input" value="${f.otherPayments || 0}">
            </div>
          </div>

          <!-- Live Balance Position Preview -->
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center;">
            <div>
              <div style="font-size: 10.5px; color: #64748b; text-transform: uppercase;">Total Billed</div>
              <div style="font-size: 15px; font-weight: 800;" id="epLiveBilled">$0.00</div>
            </div>
            <div>
              <div style="font-size: 10.5px; color: #64748b; text-transform: uppercase;">Total Paid</div>
              <div style="font-size: 15px; font-weight: 800; color: var(--color-success);" id="epLivePaid">$0.00</div>
            </div>
            <div>
              <div style="font-size: 10.5px; color: #64748b; text-transform: uppercase;">Outstanding Balance</div>
              <div style="font-size: 15px; font-weight: 800;" id="epLiveBalance">$0.00</div>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Save Payment Record',
      onConfirm: async () => {
        const regFee = Number(document.getElementById('epRegFee').value) || 0;
        const regPaid = document.getElementById('epRegPaid').checked;
        const entFee = Number(document.getElementById('epEntFee').value) || 0;
        const entPaid = document.getElementById('epEntPaid').checked;
        const reqFee = Number(document.getElementById('epReqFee').value) || 0;
        const reqPaid = document.getElementById('epReqPaid').checked;
        const peFee = Number(document.getElementById('epPeFee').value) || 0;
        const pePaid = document.getElementById('epPePaid').checked;
        const portalFee = Number(document.getElementById('epPortalFee').value) || 0;
        const portalPaid = document.getElementById('epPortalPaid').checked;

        const tuitionTotal = Number(document.getElementById('epTuitionTotal').value) || 0;
        const i1 = Number(document.getElementById('epInst1').value) || 0;
        const i2 = Number(document.getElementById('epInst2').value) || 0;
        const i3 = Number(document.getElementById('epInst3').value) || 0;
        const i4 = Number(document.getElementById('epInst4').value) || 0;
        const i5 = Number(document.getElementById('epInst5').value) || 0;
        const other = Number(document.getElementById('epOther').value) || 0;

        const paymentData = {
          currency: currency,
          tuitionTotal: tuitionTotal,
          registrationFee: regFee,
          registrationPaid: regPaid,
          registrationDate: regPaid ? (f.registrationDate || new Date().toISOString().split('T')[0]) : '',
          entranceFee: entFee,
          entranceFeePaid: entPaid,
          requirementsFee: reqFee,
          requirementsFeePaid: reqPaid,
          peSuitFee: peFee,
          peSuitFeePaid: pePaid,
          portalFee: portalFee,
          portalFeePaid: portalPaid,
          installments: [i1, i2, i3, i4, i5],
          otherPayments: other
        };

        const res = await API.callBackend('recordPayment', {
          studentId: studentId,
          payment: paymentData
        }, 'Recording payment...');

        if (res && res.success) {
          API.toastSuccess();
          // Update cached student finance locally
          const sObj = cachedStudents.find(x => x.id === studentId);
          if (sObj) {
            sObj.finance = Object.assign({}, sObj.finance, paymentData);
          }
          loadTab('finance');
        } else {
          API.toastNotification(res.message || 'Error recording payment.', true);
        }
      }
    });

    // Wire live calculation
    setTimeout(() => {
      function calcLive() {
        const regFee = Number(document.getElementById('epRegFee')?.value) || 0;
        const regPaid = document.getElementById('epRegPaid')?.checked;
        const entFee = Number(document.getElementById('epEntFee')?.value) || 0;
        const entPaid = document.getElementById('epEntPaid')?.checked;
        const reqFee = Number(document.getElementById('epReqFee')?.value) || 0;
        const reqPaid = document.getElementById('epReqPaid')?.checked;
        const peFee = Number(document.getElementById('epPeFee')?.value) || 0;
        const pePaid = document.getElementById('epPePaid')?.checked;
        const portFee = Number(document.getElementById('epPortalFee')?.value) || 0;
        const portPaid = document.getElementById('epPortalPaid')?.checked;

        const tuition = Number(document.getElementById('epTuitionTotal')?.value) || 0;
        const i1 = Number(document.getElementById('epInst1')?.value) || 0;
        const i2 = Number(document.getElementById('epInst2')?.value) || 0;
        const i3 = Number(document.getElementById('epInst3')?.value) || 0;
        const i4 = Number(document.getElementById('epInst4')?.value) || 0;
        const other = Number(document.getElementById('epOther')?.value) || 0;

        const totBilled = tuition + regFee + entFee + reqFee + peFee + portFee;
        const totPaid = (regPaid ? regFee : 0) + (entPaid ? entFee : 0) + (reqPaid ? reqFee : 0) + (pePaid ? peFee : 0) + (portPaid ? portFee : 0) + i1 + i2 + i3 + i4 + other;
        const balance = Math.max(0, totBilled - totPaid);

        const bEl = document.getElementById('epLiveBilled');
        const pEl = document.getElementById('epLivePaid');
        const balEl = document.getElementById('epLiveBalance');

        if (bEl) bEl.textContent = formatMoney(totBilled, currency);
        if (pEl) pEl.textContent = formatMoney(totPaid, currency);
        if (balEl) {
          balEl.textContent = formatMoney(balance, currency);
          balEl.style.color = balance > 0 ? 'var(--color-danger)' : 'var(--color-success)';
        }
      }

      document.querySelectorAll('.ep-calc-input').forEach(input => {
        input.addEventListener('input', calcLive);
        input.addEventListener('change', calcLive);
      });
      calcLive();
    }, 50);
  }

  // Alias for backward compatibility
  const openRecordPaymentModal = openEditPaymentModal;

  // =========================================================================
  // 5. STAFF PAYROLL TAB
  // =========================================================================
  const PAYROLL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const PAYROLL_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  async function ensureStaffLoadedForPayroll() {
    if (!cachedTeachers || cachedTeachers.length === 0) {
      const tRes = await API.callBackend('getTeachers', {});
      if (tRes && tRes.success && Array.isArray(tRes.teachers)) {
        cachedTeachers = tRes.teachers;
      }
    }
    if (!cachedAdmins || cachedAdmins.length === 0) {
      const aRes = await API.callBackend('listAdmins', {});
      if (aRes && aRes.success && Array.isArray(aRes.admins)) {
        cachedAdmins = aRes.admins;
      }
    }
  }

  function getAllStaffList() {
    const list = [];
    (cachedTeachers || []).forEach(t => {
      list.push({ id: t.id, name: t.name, role: t.title || 'Teacher', category: 'Teacher' });
    });
    (cachedAdmins || []).forEach(a => {
      list.push({ id: a.username, name: a.name || a.username, role: a.title || a.roleTier || 'Administrator', category: 'Administrator' });
    });
    (cachedCustomStaff || []).forEach(c => {
      list.push({ id: c.id, name: c.name, role: c.role || 'Staff', category: 'General Staff' });
    });
    return list;
  }

  async function renderExpensesTab(container) {
    const stored = JSON.parse(localStorage.getItem('sorina_expenses') || '[]');
    cachedExpenses = Array.isArray(stored) ? stored : [];
    const total = cachedExpenses.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
    const today = new Date().toISOString().slice(0,10);
    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row" style="flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div><h3 class="card-title">All Expenses</h3><div style="font-size:13px;color:var(--color-text-muted);">Record and manage every school expense with complete audit-ready details.</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-light" id="downloadExpensesBtn">Download CSV</button>
            <button type="button" class="btn btn-primary" id="addExpenseBtn">+ Add Expense</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px;">
          <div class="stat-card"><div class="stat-label">Total Expenses</div><div class="stat-value">$${total.toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
          <div class="stat-card"><div class="stat-label">Expense Entries</div><div class="stat-value">${cachedExpenses.length}</div></div>
          <div class="stat-card"><div class="stat-label">Today</div><div class="stat-value" style="font-size:18px;">${today}</div></div>
        </div>
        <div style="overflow:auto;">
          <table class="data-table">
            <thead><tr><th>Number</th><th>Description</th><th>Category</th><th>Quantity</th><th>Amount</th><th>Total</th><th>Date</th><th>Payment Method</th><th>Vendor / Payee</th><th>Reference</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              ${cachedExpenses.length ? cachedExpenses.map((e,i)=>`<tr>
                <td>${escapeHtml(e.number || String(i+1).padStart(3,'0'))}</td><td>${escapeHtml(e.description||'')}</td><td>${escapeHtml(e.category||'General')}</td>
                <td>${Number(e.quantity||1)}</td><td>$${Number(e.amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td><b>$${Number(e.total||0).toLocaleString(undefined,{minimumFractionDigits:2})}</b></td>
                <td>${escapeHtml(e.date||'')}</td><td>${escapeHtml(e.paymentMethod||'')}</td><td>${escapeHtml(e.vendor||'')}</td><td>${escapeHtml(e.reference||'')}</td><td>${escapeHtml(e.notes||'')}</td>
                <td><button class="btn btn-light btn-sm" onclick="window.AdminPanel.editExpense(${i})">Edit</button> <button class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteExpense(${i})">Delete</button></td>
              </tr>`).join('') : '<tr><td colspan="12" style="text-align:center;padding:30px;color:#64748b;">No expenses recorded yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    document.getElementById('addExpenseBtn').onclick=()=>openExpenseModal();
    document.getElementById('downloadExpensesBtn').onclick=downloadExpenses;
  }

  function openExpenseModal(index=null) {
    const e = index===null ? {number:String(cachedExpenses.length+1).padStart(3,'0'),quantity:1,date:new Date().toISOString().slice(0,10),paymentMethod:'Cash'} : cachedExpenses[index];
    App.showModal({title:index===null?'Add School Expense':'Edit School Expense',content:`
      <div class="form-group"><label class="form-label">Number</label><input id="exNumber" class="input-field" value="${escapeHtml(e.number||'')}"></div>
      <div class="form-group"><label class="form-label">Description *</label><input id="exDescription" class="input-field" value="${escapeHtml(e.description||'')}" placeholder="What was purchased or paid for?"></div>
      <div class="form-group"><label class="form-label">Category</label><select id="exCategory" class="select-field"><option>General</option><option>Utilities</option><option>Teaching Materials</option><option>Maintenance</option><option>Transportation</option><option>Food / Cafeteria</option><option>Salary / Staff</option><option>Office Supplies</option><option>Other</option></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="form-group"><label class="form-label">Quantity</label><input type="number" min="1" id="exQuantity" class="input-field" value="${Number(e.quantity||1)}"></div><div class="form-group"><label class="form-label">Amount (per unit)</label><input type="number" min="0" step="0.01" id="exAmount" class="input-field" value="${Number(e.amount||0)}"></div></div>
      <div class="form-group"><label class="form-label">Date</label><input type="date" id="exDate" class="input-field" value="${escapeHtml(e.date||'')}"></div>
      <div class="form-group"><label class="form-label">Payment Method</label><select id="exPayment" class="select-field"><option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Cheque</option><option>Card</option><option>Other</option></select></div>
      <div class="form-group"><label class="form-label">Vendor / Payee</label><input id="exVendor" class="input-field" value="${escapeHtml(e.vendor||'')}"></div>
      <div class="form-group"><label class="form-label">Reference / Receipt No.</label><input id="exReference" class="input-field" value="${escapeHtml(e.reference||'')}"></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea id="exNotes" class="input-field" rows="3">${escapeHtml(e.notes||'')}</textarea></div>`,confirmText:index===null?'Save Expense':'Update Expense',onConfirm:()=>{
        const desc=document.getElementById('exDescription').value.trim(); if(!desc){API.toastNotification('Description is required.',true);return;}
        const q=Math.max(1,Number(document.getElementById('exQuantity').value)||1), a=Math.max(0,Number(document.getElementById('exAmount').value)||0);
        const item={number:document.getElementById('exNumber').value.trim()||String(cachedExpenses.length+1).padStart(3,'0'),description:desc,category:document.getElementById('exCategory').value,quantity:q,amount:a,total:q*a,date:document.getElementById('exDate').value,paymentMethod:document.getElementById('exPayment').value,vendor:document.getElementById('exVendor').value.trim(),reference:document.getElementById('exReference').value.trim(),notes:document.getElementById('exNotes').value.trim()};
        if(index===null) cachedExpenses.push(item); else cachedExpenses[index]=item; localStorage.setItem('sorina_expenses',JSON.stringify(cachedExpenses)); API.toastSuccess(); loadTab('payroll');
      }});
  }
  function editExpense(i){openExpenseModal(i)}
  function deleteExpense(i){ if(!confirm('Delete this expense record?')) return; cachedExpenses.splice(i,1); localStorage.setItem('sorina_expenses',JSON.stringify(cachedExpenses)); loadTab('payroll'); }
  function downloadExpenses(){ const headers=['Number','Description','Category','Quantity','Amount','Total','Date','Payment Method','Vendor / Payee','Reference','Notes']; const rows=[headers.join(',')].concat(cachedExpenses.map(e=>[e.number,e.description,e.category,e.quantity,e.amount,e.total,e.date,e.paymentMethod,e.vendor,e.reference,e.notes].map(escapeCsv).map(x=>'"'+x+'"').join(','))); const blob=new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='Sorina_All_Expenses_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(a.href); }

  async function renderAnnouncementsTab(container) {
    const res=await API.callBackend('getAnnouncements',{},'Loading announcements...'); cachedAnnouncements=(res&&res.success&&Array.isArray(res.announcements))?res.announcements:cachedAnnouncements;
    container.innerHTML=`<div class="content-card"><div class="card-header-row" style="margin-bottom:16px;"><div><h3 class="card-title">School Notice & Announcement</h3><div style="font-size:13px;color:var(--color-text-muted);">Publish notices directly to teachers, students, or everyone.</div></div><button class="btn btn-primary" id="newAnnouncementBtn">+ New Announcement</button></div><div>${cachedAnnouncements.length?cachedAnnouncements.map((m,i)=>`<div style="border:1px solid var(--color-border);border-radius:8px;padding:15px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;gap:10px;"><div><b>${escapeHtml(m.subject||'School Announcement')}</b><span class="badge badge-light" style="margin-left:8px;">${escapeHtml(m.audience||'Both')}</span></div><span style="font-size:12px;color:#64748b;">${escapeHtml(m.sentAt||'')}</span></div><p style="margin:8px 0;line-height:1.5;">${escapeHtml(m.body||'')}</p>${m.recipientId?`<div style="font-size:12px;color:#475569;">Recipient ID: <b>${escapeHtml(m.recipientId)}</b></div>`:''}${m.attachmentUrl?`<div style="margin-top:8px;"><a class="btn btn-light btn-sm" href="${escapeHtml(m.attachmentUrl)}" target="_blank">View Attachment${m.attachmentName?' — '+escapeHtml(m.attachmentName):''}</a></div>`:''}<div style="font-size:12px;color:#64748b;">From: ${escapeHtml(m.senderName||'School Administration')} <button class="btn btn-danger btn-sm" style="float:right;" onclick="window.AdminPanel.deleteAnnouncement(${i})">Delete</button></div></div>`).join(''):'<div style="padding:30px;text-align:center;color:#64748b;">No announcements published yet.</div>'}</div></div>`;
    document.getElementById('newAnnouncementBtn').onclick=openAnnouncementModal;
  }
  function openAnnouncementModal(){ App.showModal({title:'Create School Announcement',content:`<div class="form-group"><label class="form-label">Subject *</label><input id="annSubject" class="input-field" placeholder="e.g. Mid-Term Examination Notice"></div><div class="form-group"><label class="form-label">Send To *</label><select id="annAudience" class="select-field"><option value="Both">Teachers & Students</option><option value="Teachers">Teachers Only</option><option value="Students">Students Only</option><option value="Individual">Individual ID</option></select></div><div class="form-group" id="annRecipientWrap" style="display:none"><label class="form-label">Recipient Student/Teacher ID</label><input id="annRecipientId" class="input-field" placeholder="e.g. SPSS001 or SPST001"></div><div class="form-group"><label class="form-label">Announcement *</label><textarea id="annBody" class="input-field" rows="6" placeholder="Write the school notice here..."></textarea></div><div class="form-group"><label class="form-label">Attachment</label><input type="file" id="annAttachment" class="input-field" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"></div>`,confirmText:'Publish Announcement',onConfirm:async()=>{const subject=document.getElementById('annSubject').value.trim(),body=document.getElementById('annBody').value.trim(),audience=document.getElementById('annAudience').value,recipientId=document.getElementById('annRecipientId').value.trim();const file=document.getElementById('annAttachment').files[0];if(!subject||!body){API.toastNotification('Subject and announcement text are required.',true);return;}if(audience==='Individual'&&!recipientId){API.toastNotification('Enter the recipient ID.',true);return;}const attachmentUrl=file?await readFileAsDataUrl(file):'';const item={id:'ANN-'+Date.now(),subject,body,audience:audience==='Individual'?'Individual':audience,recipientId:audience==='Individual'?recipientId:'',attachmentUrl,attachmentName:file?file.name:'',senderName:currentUser.name||'School Administration',sentAt:new Date().toLocaleString()};const r=await API.callBackend('saveAnnouncement',{announcement:item},'Publishing announcement...');if(r&&r.success){cachedAnnouncements=r.announcements||[item,...cachedAnnouncements];localStorage.setItem('sorina_announcements',JSON.stringify(cachedAnnouncements));API.toastSuccess('Announcement published.');loadTab('announcements')}else API.toastNotification(r.message||'Could not publish announcement.',true);}});setTimeout(()=>{const a=document.getElementById('annAudience');if(a)a.onchange=()=>{document.getElementById('annRecipientWrap').style.display=a.value==='Individual'?'block':'none';};},50); }

  async function deleteAnnouncement(i){const item=cachedAnnouncements[i];if(!item||!confirm('Delete this announcement?'))return;const r=await API.callBackend('deleteAnnouncement',{id:item.id},'Deleting announcement...');if(r&&r.success){cachedAnnouncements.splice(i,1);localStorage.setItem('sorina_announcements',JSON.stringify(cachedAnnouncements));loadTab('announcements')}}

  function getFilteredPayrollRecords() {
    const monthFilter = document.getElementById('payrollMonthFilter') ? document.getElementById('payrollMonthFilter').value : '';
    const yearFilter = document.getElementById('payrollYearFilter') ? document.getElementById('payrollYearFilter').value : '';
    const statusFilter = document.getElementById('payrollStatusFilter') ? document.getElementById('payrollStatusFilter').value : '';

    return cachedPayroll.filter(p => {
      const my = String(p.monthYear || '');
      if (monthFilter && !my.toLowerCase().includes(monthFilter.toLowerCase())) return false;
      if (yearFilter && !my.includes(yearFilter)) return false;
      if (statusFilter === 'paid' && !p.paid) return false;
      if (statusFilter === 'unpaid' && p.paid) return false;
      return true;
    });
  }

  function renderFilteredPayrollTable() {
    const tbody = document.getElementById('payrollTableBody');
    if (!tbody) return;

    const filtered = getFilteredPayrollRecords();

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No payroll records match the selected filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td>
          <b>${escapeHtml(p.staffName || p.staffId)}</b>
          <div style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(p.staffId)}</div>
        </td>
        <td>${escapeHtml(p.role || 'Staff')}</td>
        <td><b>${escapeHtml(p.monthYear)}</b></td>
        <td>$${(Number(p.baseSalary) || 0).toLocaleString()}</td>
        <td style="color: #b91c1c;">-$${(Number(p.deductions) || 0).toLocaleString()}</td>
        <td style="color: #64748b;">$${(Number(p.tax) || 0).toLocaleString()}</td>
        <td><b style="color: var(--color-primary); font-size: 14px;">$${(Number(p.netSalary) || 0).toLocaleString()}</b></td>
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
          ` : '<span style="color:#94a3b8; font-size:12px;">No File</span>'}
        </td>
        <td>
          <button type="button" class="btn btn-light btn-sm" style="display: inline-flex; align-items: center; gap: 4px;" onclick="window.AdminPanel.openEditPayrollModal('${escapeHtml(p.staffId)}', '${escapeHtml(p.monthYear)}')">
            <img src="assets/icons/edit.png" style="width: 12px; height: 12px;" alt=""> Edit
          </button>
        </td>
      </tr>
    `).join('');
  }

  function openAddCustomStaffModal() {
    App.showModal({
      title: 'Register Staff Member',
      content: `
        <div style="font-size: 13.5px;">
          <p style="color: var(--color-text-muted); margin-bottom: 14px;">
            Add administrative, instructional, or non-teaching support personnel to the school staff registry.
          </p>
          <div class="form-group">
            <label class="form-label" for="csName">Staff Full Name *</label>
            <input type="text" id="csName" class="input-field" placeholder="e.g. Samuel K. Gboto" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="csId">Staff ID Code (Optional)</label>
            <input type="text" id="csId" class="input-field" placeholder="e.g. STF-001" value="STF-${Date.now().toString().slice(-4)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="csRole">Role / Designation *</label>
            <select id="csRole" class="select-field">
              <option value="Administrator">Administrator</option>
              <option value="Teacher">Teacher / Instructor</option>
              <option value="Registrar">Registrar</option>
              <option value="Bursar / Accountant">Bursar / Accountant</option>
              <option value="Security Officer">Security Officer</option>
              <option value="Driver / Transportation">Driver / Transportation</option>
              <option value="Custodian / Cleaner">Custodian / Cleaner</option>
              <option value="Cook / Cafeteria Staff">Cook / Cafeteria Staff</option>
              <option value="Maintenance / Handyman">Maintenance / Handyman</option>
              <option value="School Nurse">School Nurse</option>
              <option value="Librarian">Librarian</option>
              <option value="Other Staff">Other Staff</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="csPhone">Phone Number (Optional)</label>
            <input type="text" id="csPhone" class="input-field" placeholder="+231-770-000000">
          </div>
        </div>
      `,
      confirmText: 'Save Staff Member',
      onConfirm: () => {
        const name = document.getElementById('csName').value.trim();
        const id = document.getElementById('csId').value.trim() || `STF-${Date.now().toString().slice(-4)}`;
        const role = document.getElementById('csRole').value;
        const phone = document.getElementById('csPhone').value.trim();

        if (!name) {
          API.toastNotification('Please enter the staff member full name.', true);
          return;
        }

        cachedCustomStaff.push({ id, name, role, phone });
        localStorage.setItem('sorina_custom_staff', JSON.stringify(cachedCustomStaff));
        API.toastSuccess();
        loadTab('payroll');
      }
    });
  }

  function openAddPayrollModal() {
    const staffList = getAllStaffList();
    const now = new Date();
    const currentMonth = PAYROLL_MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();

    const teachersList = staffList.filter(s => s.category === 'Teacher');
    const adminsList = staffList.filter(s => s.category === 'Administrator');
    const generalList = staffList.filter(s => s.category === 'General Staff');

    App.showModal({
      title: 'Process Staff Payroll Entry',
      content: `
        <div style="font-size: 13.5px;">
          <div class="form-group">
            <label class="form-label" for="prStaff">Select Staff Member *</label>
            <select id="prStaff" class="select-field">
              ${teachersList.length ? `
                <optgroup label="Teachers &amp; Faculty">
                  ${teachersList.map(s => `<option value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-role="${escapeHtml(s.role)}">${escapeHtml(s.name)} [${escapeHtml(s.id)}]</option>`).join('')}
                </optgroup>
              ` : ''}
              ${adminsList.length ? `
                <optgroup label="Administrators &amp; Officers">
                  ${adminsList.map(s => `<option value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-role="${escapeHtml(s.role)}">${escapeHtml(s.name)} [${escapeHtml(s.id)}]</option>`).join('')}
                </optgroup>
              ` : ''}
              ${generalList.length ? `
                <optgroup label="Support &amp; General Staff">
                  ${generalList.map(s => `<option value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-role="${escapeHtml(s.role)}">${escapeHtml(s.name)} [${escapeHtml(s.id)}]</option>`).join('')}
                </optgroup>
              ` : ''}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="prMonthSelect">Disbursement Month *</label>
              <select id="prMonthSelect" class="select-field">
                ${PAYROLL_MONTHS.map(m => `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="prYearSelect">Academic Year *</label>
              <select id="prYearSelect" class="select-field">
                ${PAYROLL_YEARS.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
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
            <div class="form-group">
              <label class="form-label" for="prNet">Net Salary ($)</label>
              <input type="number" id="prNet" class="input-field" value="190" style="font-weight: 700; color: var(--color-primary);">
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
        const staffId = staffSel ? staffSel.value : '';
        const opt = staffSel ? staffSel.selectedOptions[0] : null;
        const staffName = opt ? opt.dataset.name : '';
        const role = opt ? opt.dataset.role : 'Staff';
        const month = document.getElementById('prMonthSelect').value;
        const year = document.getElementById('prYearSelect').value;
        const monthYear = `${month} ${year}`;
        const base = Number(document.getElementById('prBase').value) || 0;
        const ded = Number(document.getElementById('prDed').value) || 0;
        const tax = Number(document.getElementById('prTax').value) || 0;
        const net = Number(document.getElementById('prNet').value) || (base - ded - tax);
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
            netSalary: net,
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

    const updateNet = () => {
      const b = Number(document.getElementById('prBase').value) || 0;
      const d = Number(document.getElementById('prDed').value) || 0;
      const t = Number(document.getElementById('prTax').value) || 0;
      const netElem = document.getElementById('prNet');
      if (netElem) netElem.value = Math.max(0, b - d - t);
    };

    setTimeout(() => {
      const b = document.getElementById('prBase');
      const d = document.getElementById('prDed');
      const t = document.getElementById('prTax');
      if (b) b.addEventListener('input', updateNet);
      if (d) d.addEventListener('input', updateNet);
      if (t) t.addEventListener('input', updateNet);
      updateNet();
    }, 50);
  }

  function openEditPayrollModal(staffId, monthYear) {
    const p = cachedPayroll.find(x => String(x.staffId) === String(staffId) && String(x.monthYear) === String(monthYear));
    if (!p) {
      API.toastNotification('Payroll record not found.', true);
      return;
    }

    const parts = String(p.monthYear || '').split(' ');
    const initialMonth = parts[0] || 'September';
    const initialYear = Number(parts[1]) || 2026;

    App.showModal({
      title: `Edit Payroll: ${escapeHtml(p.staffName || p.staffId)}`,
      content: `
        <div style="font-size: 13.5px;">
          <div style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px;">
            <div><b>Staff Member:</b> ${escapeHtml(p.staffName || p.staffId)} [${escapeHtml(p.staffId)}]</div>
            <div><b>Role:</b> ${escapeHtml(p.role || 'Staff')}</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="prEditMonth">Month *</label>
              <select id="prEditMonth" class="select-field">
                ${PAYROLL_MONTHS.map(m => `<option value="${m}" ${m.toLowerCase() === initialMonth.toLowerCase() ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="prEditYear">Year *</label>
              <select id="prEditYear" class="select-field">
                ${PAYROLL_YEARS.map(y => `<option value="${y}" ${y === initialYear ? 'selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
            <div class="form-group">
              <label class="form-label" for="prEditBase">Base Salary ($) *</label>
              <input type="number" id="prEditBase" class="input-field" value="${p.baseSalary || 0}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="prEditDed">Deductions ($)</label>
              <input type="number" id="prEditDed" class="input-field" value="${p.deductions || 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="prEditTax">Income Tax ($)</label>
              <input type="number" id="prEditTax" class="input-field" value="${p.tax || 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="prEditNet">Net Salary ($) *</label>
              <input type="number" id="prEditNet" class="input-field" value="${p.netSalary || 0}" style="font-weight: 700; color: var(--color-primary);">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: center;">
            <div class="form-group" style="margin-top: 10px;">
              <label><input type="checkbox" id="prEditPaid" ${p.paid ? 'checked' : ''}> Disbursed / Paid</label>
            </div>
            <div class="form-group">
              <label class="form-label" for="prEditDate">Payment Date</label>
              <input type="text" id="prEditDate" class="input-field" value="${escapeHtml(p.paymentDate || '')}" placeholder="MM/DD/YYYY">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="prEditDoc">Replace Pay Slip / Voucher (Optional)</label>
            <input type="file" id="prEditDoc" class="input-field" accept=".pdf,image/*">
            ${p.documentUrl ? `<div style="margin-top: 4px; font-size: 12px;"><a href="${p.documentUrl}" target="_blank">Current Voucher Document</a></div>` : ''}
          </div>
        </div>
      `,
      confirmText: 'Update Payroll Record',
      onConfirm: async () => {
        const month = document.getElementById('prEditMonth').value;
        const year = document.getElementById('prEditYear').value;
        const newMonthYear = `${month} ${year}`;
        const base = Number(document.getElementById('prEditBase').value) || 0;
        const ded = Number(document.getElementById('prEditDed').value) || 0;
        const tax = Number(document.getElementById('prEditTax').value) || 0;
        const net = Number(document.getElementById('prEditNet').value) || (base - ded - tax);
        const paid = document.getElementById('prEditPaid').checked;
        const payDate = document.getElementById('prEditDate').value.trim() || (paid ? new Date().toLocaleDateString() : '');
        const file = document.getElementById('prEditDoc').files[0];

        let docUrl = p.documentUrl || '';
        if (file) {
          docUrl = await readFileAsDataUrl(file);
        }

        const res = await API.callBackend('savePayrollRecord', {
          payroll: {
            staffId: p.staffId,
            staffName: p.staffName,
            role: p.role,
            monthYear: newMonthYear,
            baseSalary: base,
            deductions: ded,
            tax: tax,
            netSalary: net,
            paid: paid,
            paymentDate: payDate,
            documentUrl: docUrl
          }
        }, 'Updating payroll record...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('payroll');
        } else {
          API.toastNotification(res.message || 'Error updating payroll.', true);
        }
      }
    });

    const updateEditNet = () => {
      const b = Number(document.getElementById('prEditBase').value) || 0;
      const d = Number(document.getElementById('prEditDed').value) || 0;
      const t = Number(document.getElementById('prEditTax').value) || 0;
      const netElem = document.getElementById('prEditNet');
      if (netElem) netElem.value = Math.max(0, b - d - t);
    };

    setTimeout(() => {
      const b = document.getElementById('prEditBase');
      const d = document.getElementById('prEditDed');
      const t = document.getElementById('prEditTax');
      if (b) b.addEventListener('input', updateEditNet);
      if (d) d.addEventListener('input', updateEditNet);
      if (t) t.addEventListener('input', updateEditNet);
    }, 50);
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

  function downloadPayrollReport() {
    App.showModal({
      title: 'Export Staff Payroll Records',
      content: `
        <div style="font-size: 13.5px;">
          <p style="color: var(--color-text-muted); margin-bottom: 14px;">
            Export official payroll reports for auditing, banking salary disbursement, or financial archives.
          </p>
          <div class="form-group">
            <label class="form-label" for="prExportScope">Select Timeframe / Category</label>
            <select id="prExportScope" class="select-field">
              <option value="filtered">Current Filtered View</option>
              <option value="all">All Historical Records</option>
              ${PAYROLL_MONTHS.map(m => `<option value="month_${m}">All Records for ${m}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      confirmText: 'Download CSV Report',
      onConfirm: () => {
        const scope = document.getElementById('prExportScope').value;
        let records = [];

        if (scope === 'filtered') {
          records = getFilteredPayrollRecords();
        } else if (scope === 'all') {
          records = cachedPayroll;
        } else if (scope.startsWith('month_')) {
          const targetMonth = scope.replace('month_', '').toLowerCase();
          records = cachedPayroll.filter(p => String(p.monthYear || '').toLowerCase().includes(targetMonth));
        }

        if (records.length === 0) {
          API.toastNotification('No payroll records found for the selected timeframe.', true);
          return;
        }

        const headers = ['Staff ID', 'Staff Name', 'Role', 'Month & Year', 'Base Salary ($)', 'Deductions ($)', 'Tax ($)', 'Net Salary ($)', 'Payment Status', 'Payment Date'];
        const csvRows = [headers.join(',')];

        records.forEach(r => {
          const row = [
            `"${escapeCsv(r.staffId || '')}"`,
            `"${escapeCsv(r.staffName || '')}"`,
            `"${escapeCsv(r.role || '')}"`,
            `"${escapeCsv(r.monthYear || '')}"`,
            Number(r.baseSalary || 0),
            Number(r.deductions || 0),
            Number(r.tax || 0),
            Number(r.netSalary || 0),
            `"${r.paid ? 'Paid' : 'Unpaid'}"`,
            `"${escapeCsv(r.paymentDate || '')}"`
          ];
          csvRows.push(row.join(','));
        });

        const csvBlob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(csvBlob);
        link.download = `Sorina_Staff_Payroll_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        API.toastSuccess();
      }
    });
  }

  function escapeCsv(val) {
    return String(val || '').replace(/"/g, '""');
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
            <div style="font-size: 11px; margin-top: 2px; opacity: 0.8;">Academic Year: ${escapeHtml(String(teacher.academicYear || '—').replace('-', '–'))}</div>

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
            <div style="font-size: 11px; margin-top: 2px; opacity: 0.8;">Academic Year: ${escapeHtml(String(teacher.academicYear || '—').replace('-', '–'))}</div>

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
  // 7. SUBJECTS MANAGEMENT & CURRICULUM CATALOG
  // =========================================================================
  const SUBJECT_LEVEL_GROUPS = [
    { key:'early', label:'Daycare to ABC', levels:['Daycare','Nursery','ABC'] },
    { key:'kindergarten', label:'K1 to K2', levels:['K1','K2'] },
    { key:'primary', label:'Grade 1 to Grade 6', levels:['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
    { key:'secondary', label:'Grade 7 to Grade 12', levels:['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'] }
  ];
  function subjectMetaStore(){
    try { return JSON.parse(localStorage.getItem('_sorina_subject_meta') || '{}') || {}; } catch(e){ return {}; }
  }
  function saveSubjectMetaStore(meta){ localStorage.setItem('_sorina_subject_meta', JSON.stringify(meta || {})); }
  function getSubjectMeta(name){
    const meta=subjectMetaStore();
    return Object.assign({code:'',category:'Core',status:'Active',description:'',sortOrder:0}, meta[name]||{});
  }
  function getActiveCatalogSubjects(){
    return getCatalogSubjects().filter(name=>getSubjectMeta(name).status!=='Inactive');
  }
  function ensureSubjectMeta(names){
    const meta=subjectMetaStore();
    (names||[]).forEach((name,i)=>{ if(!meta[name]) meta[name]={code:'',category:'Core',status:'Active',description:'',sortOrder:i+1}; });
    saveSubjectMetaStore(meta); return meta;
  }
  function subjectLevelCount(name, map){ return GRADE_LEVELS.filter(c=>(map[c]||[]).includes(name)).length; }

  async function renderSubjectsTab(container) {
    const res = await API.callBackend('getSubjects', {}, 'Loading subjects catalog...');
    cachedSubjects = (res && res.success && Array.isArray(res.subjects)) ? res.subjects : getCatalogSubjects();
    ensureSubjectMeta(cachedSubjects);
    let mapRes=await API.callBackend('getCurriculumSubjects', {}, 'Loading level assignments...');
    let curriculum=(mapRes&&mapRes.success&&mapRes.curriculum)||{};
    const activeSubjects=getActiveCatalogSubjects();

    container.innerHTML=`
      <div class="content-card">
        <div class="card-header-row" style="align-items:flex-start;gap:12px;">
          <div>
            <h3 class="card-title">Subjects Catalog &amp; Curriculum Manager</h3>
            <div style="font-size:13px;color:var(--color-text-muted);margin-top:4px;">One place to create subjects, maintain subject details, assign them to every school level, and control what appears across the portal.</div>
          </div>
          <button class="btn btn-primary" id="openAddSubBtn">+ Add New Subject</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">Total Subjects</div><b style="font-size:21px;">${cachedSubjects.length}</b></div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">Active</div><b style="font-size:21px;">${activeSubjects.length}</b></div>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">Assigned</div><b style="font-size:21px;">${activeSubjects.filter(x=>subjectLevelCount(x,curriculum)>0).length}</b></div>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">School Levels</div><b style="font-size:21px;">${GRADE_LEVELS.length}</b></div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input id="subjectSearch" class="input-field" style="flex:1;min-width:220px;" placeholder="Search subject name or code...">
          <select id="subjectStatusFilter" class="select-field" style="min-width:145px;"><option value="all">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
          <select id="subjectCategoryFilter" class="select-field" style="min-width:145px;"><option value="all">All Categories</option><option>Core</option><option>Language</option><option>Mathematics</option><option>Science</option><option>Social Studies</option><option>Arts</option><option>ICT</option><option>Physical Education</option><option>Religious</option><option>Other</option></select>
          <button class="btn btn-light" id="bulkAssignBtn">Assign Selected to Levels</button>
        </div>

        <div class="table-responsive">
          <table class="data-table"><thead><tr><th><input type="checkbox" id="subjectSelectAll"></th><th>Subject</th><th>Code</th><th>Category</th><th>Levels</th><th>Status</th><th>Actions</th></tr></thead><tbody id="subjectCatalogBody"></tbody></table>
        </div>
        <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b;"><b>Portal behavior:</b> Active subjects can be selected for curriculum, teacher assignments and grade entry. Renaming a subject updates existing teacher, student curriculum, curriculum-map and grade references. Removing a subject also removes it from those assignments.</div>
      </div>`;

    const body=document.getElementById('subjectCatalogBody');
    function draw(){
      const q=(document.getElementById('subjectSearch').value||'').toLowerCase().trim();
      const st=document.getElementById('subjectStatusFilter').value;
      const cat=document.getElementById('subjectCategoryFilter').value;
      const meta=subjectMetaStore();
      const rows=cachedSubjects.filter(name=>{
        const m=meta[name]||{}; const hay=(name+' '+(m.code||'')).toLowerCase();
        return (!q||hay.includes(q)) && (st==='all'||(m.status||'Active')===st) && (cat==='all'||(m.category||'Core')===cat);
      });
      body.innerHTML=rows.length?rows.map(name=>{const m=getSubjectMeta(name), count=subjectLevelCount(name,curriculum); return `<tr>
        <td><input type="checkbox" class="subject-row-check" value="${escapeHtml(name)}"></td>
        <td><b>${escapeHtml(name)}</b>${m.description?`<div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(m.description)}</div>`:''}</td>
        <td>${escapeHtml(m.code||'—')}</td><td>${escapeHtml(m.category||'Core')}</td>
        <td><span class="badge badge-light">${count}/${GRADE_LEVELS.length} levels</span></td>
        <td><span class="badge ${m.status==='Inactive'?'badge-light':'badge-success'}">${escapeHtml(m.status||'Active')}</span></td>
        <td style="white-space:nowrap;"><button class="btn btn-light btn-sm" data-edit-sub="${escapeHtml(name)}">Edit</button> <button class="btn btn-light btn-sm" data-assign-sub="${escapeHtml(name)}">Assign</button> <button class="btn ${m.status==='Inactive'?'btn-primary':'btn-light'} btn-sm" data-toggle-sub="${escapeHtml(name)}">${m.status==='Inactive'?'Activate':'Deactivate'}</button> <button class="btn btn-danger btn-sm" data-delete-sub="${escapeHtml(name)}">Delete</button></td>
      </tr>`;}).join(''):`<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748b;">No subjects match your filters.</td></tr>`;
      body.querySelectorAll('[data-edit-sub]').forEach(b=>b.onclick=()=>openEditSubjectModal(b.dataset.editSub));
      body.querySelectorAll('[data-assign-sub]').forEach(b=>b.onclick=()=>openSubjectLevelAssignment(b.dataset.assignSub,curriculum));
      body.querySelectorAll('[data-toggle-sub]').forEach(b=>b.onclick=()=>toggleSubjectStatus(b.dataset.toggleSub));
      body.querySelectorAll('[data-delete-sub]').forEach(b=>b.onclick=()=>deleteSubject(b.dataset.deleteSub));
    }
    document.getElementById('openAddSubBtn').onclick=openAddSubjectModal;
    ['subjectSearch','subjectStatusFilter','subjectCategoryFilter'].forEach(id=>document.getElementById(id).addEventListener('input',draw));
    document.getElementById('subjectSelectAll').onchange=e=>body.querySelectorAll('.subject-row-check').forEach(x=>x.checked=e.target.checked);
    document.getElementById('bulkAssignBtn').onclick=()=>{
      const selected=[...body.querySelectorAll('.subject-row-check:checked')].map(x=>x.value);
      if(!selected.length){API.toastNotification('Select at least one subject first.',true);return;}
      openBulkSubjectAssignment(selected,curriculum);
    };
    draw();
  }

  function openAddSubjectModal(){
    App.showModal({title:'Add New Subject',content:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Subject Name *</label><input id="newSubName" class="input-field" placeholder="e.g. Computer Science"></div>
      <div class="form-group"><label class="form-label">Subject Code</label><input id="newSubCode" class="input-field" placeholder="e.g. ICT101"></div>
      <div class="form-group"><label class="form-label">Category</label><select id="newSubCategory" class="select-field" style="width:100%;"><option>Core</option><option>Language</option><option>Mathematics</option><option>Science</option><option>Social Studies</option><option>Arts</option><option>ICT</option><option>Physical Education</option><option>Religious</option><option>Other</option></select></div>
      <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description</label><textarea id="newSubDesc" class="input-field" rows="2" placeholder="Optional description"></textarea></div>
      <div style="grid-column:1/-1;"><b>Assign immediately to levels</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;margin-top:8px;">${GRADE_LEVELS.map(c=>`<label style="font-size:12px;"><input type="checkbox" class="new-sub-level" value="${escapeHtml(c)}"> ${escapeHtml(c)}</label>`).join('')}</div></div>
    </div>`,confirmText:'Create Subject',onConfirm:async()=>{
      const name=document.getElementById('newSubName').value.trim(), code=document.getElementById('newSubCode').value.trim(), category=document.getElementById('newSubCategory').value, description=document.getElementById('newSubDesc').value.trim();
      if(!name){API.toastNotification('Subject name is required.',true);return;}
      if(cachedSubjects.some(x=>x.toLowerCase()===name.toLowerCase())){API.toastNotification('That subject already exists.',true);return;}
      const r=await API.callBackend('addSubject',{subject:name,subjectName:name},'Creating subject...');
      if(!r||!r.success){API.toastNotification((r&&r.message)||'Could not create subject.',true);return;}
      const meta=subjectMetaStore();meta[name]={code,category,status:'Active',description,sortOrder:cachedSubjects.length+1};saveSubjectMetaStore(meta);
      const levels=[...document.querySelectorAll('.new-sub-level:checked')].map(x=>x.value);let cr=JSON.parse(localStorage.getItem('_sorina_curriculum_map')||'{}');levels.forEach(c=>{cr[c]=Array.from(new Set([...(cr[c]||[]),name]));});
      await API.callBackend('saveCurriculumSubjects',{curriculum:cr},'Applying subject to levels...');
      API.toastSuccess('Subject created and curriculum updated.');loadTab('subjects');
    }});
  }

  function openEditSubjectModal(oldName){
    const m=getSubjectMeta(oldName);
    App.showModal({title:'Edit Subject',content:`<div class="form-group"><label class="form-label">Subject Name *</label><input id="editSubName" class="input-field" value="${escapeHtml(oldName)}"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="form-group"><label class="form-label">Subject Code</label><input id="editSubCode" class="input-field" value="${escapeHtml(m.code)}"></div><div class="form-group"><label class="form-label">Category</label><select id="editSubCategory" class="select-field" style="width:100%;">${['Core','Language','Mathematics','Science','Social Studies','Arts','ICT','Physical Education','Religious','Other'].map(x=>`<option ${x===m.category?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="form-group"><label class="form-label">Description</label><textarea id="editSubDesc" class="input-field" rows="2">${escapeHtml(m.description)}</textarea></div>`,confirmText:'Save Changes',onConfirm:async()=>{
      const newName=document.getElementById('editSubName').value.trim();if(!newName){API.toastNotification('Subject name is required.',true);return;}
      if(newName.toLowerCase()!==oldName.toLowerCase()&&cachedSubjects.some(x=>x.toLowerCase()===newName.toLowerCase())){API.toastNotification('Another subject already uses that name.',true);return;}
      const r=await API.callBackend('updateSubject',{oldSubjectName:oldName,newSubjectName:newName,oldName,newName},'Updating subject...');if(!r||!r.success){API.toastNotification((r&&r.message)||'Could not update subject.',true);return;}
      const meta=subjectMetaStore();delete meta[oldName];meta[newName]={code:document.getElementById('editSubCode').value.trim(),category:document.getElementById('editSubCategory').value,status:m.status,description:document.getElementById('editSubDesc').value.trim(),sortOrder:m.sortOrder};saveSubjectMetaStore(meta);API.toastSuccess('Subject updated across the portal.');loadTab('subjects');
    }});
  }

  async function toggleSubjectStatus(name){const meta=subjectMetaStore();meta[name]=Object.assign({},getSubjectMeta(name),{status:getSubjectMeta(name).status==='Inactive'?'Active':'Inactive'});saveSubjectMetaStore(meta);API.toastSuccess(meta[name].status==='Active'?'Subject activated.':'Subject deactivated from new selections.');loadTab('subjects');}

  function levelCheckboxes(selected){return GRADE_LEVELS.map(c=>`<label style="font-size:12px;"><input type="checkbox" class="assign-level" value="${escapeHtml(c)}" ${selected.includes(c)?'checked':''}> ${escapeHtml(c)}</label>`).join('');}
  function openSubjectLevelAssignment(name,map){
    const selected=GRADE_LEVELS.filter(c=>(map[c]||[]).includes(name));
    App.showModal({title:'Assign Subject to School Levels',content:`<div style="margin-bottom:10px;"><b>${escapeHtml(name)}</b><div style="font-size:12px;color:#64748b;">Select every class where this subject should be part of the curriculum.</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;">${levelCheckboxes(selected)}</div>`,confirmText:'Save Level Assignment',onConfirm:async()=>{const chosen=[...document.querySelectorAll('.assign-level:checked')].map(x=>x.value);GRADE_LEVELS.forEach(c=>{const arr=(map[c]||[]).filter(x=>x!==name);if(chosen.includes(c))arr.push(name);map[c]=Array.from(new Set(arr));});const r=await API.callBackend('saveCurriculumSubjects',{curriculum:map},'Saving subject assignments...');if(r&&r.success){API.toastSuccess('Subject assignments saved.');loadTab('subjects')}else API.toastNotification((r&&r.message)||'Could not save assignments.',true);}});
  }
  function openBulkSubjectAssignment(names,map){
    App.showModal({title:'Bulk Assign Subjects to Levels',content:`<div style="margin-bottom:10px;"><b>${names.length} selected subject(s)</b><div style="font-size:12px;color:#64748b;">Choose levels to add these subjects to. Existing assignments are preserved.</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;">${levelCheckboxes([])}</div>`,confirmText:'Apply Assignments',onConfirm:async()=>{const chosen=[...document.querySelectorAll('.assign-level:checked')].map(x=>x.value);if(!chosen.length){API.toastNotification('Select at least one level.',true);return;}chosen.forEach(c=>{map[c]=Array.from(new Set([...(map[c]||[]),...names]));});const r=await API.callBackend('saveCurriculumSubjects',{curriculum:map},'Applying bulk assignments...');if(r&&r.success){API.toastSuccess('Bulk curriculum assignment completed.');loadTab('subjects')}else API.toastNotification((r&&r.message)||'Could not apply assignments.',true);}});
  }

  async function deleteSubject(subjectName){
    if(!confirm(`Remove subject "${subjectName}"? This will remove it from curriculum and teacher/student subject assignments.`)) return;
    const res=await API.callBackend('deleteSubject',{subject:subjectName,subjectName:subjectName},'Removing subject...');
    if(res&&res.success){const meta=subjectMetaStore();delete meta[subjectName];saveSubjectMetaStore(meta);API.toastSuccess('Subject removed from the portal.');loadTab('subjects');}else API.toastNotification((res&&res.message)||'Error removing subject.',true);
  }

  async function renderCurriculumSubjectsTab(container){
    // Keep the existing navigation entry, but use the same redesigned catalog manager.
    await renderSubjectsTab(container);
  }

  async function renderAdminGradeEntryTab(container) {
    const stRes = await API.callBackend('getAllStudents', { academicYear: selectedAcademicYear }, 'Loading academic roster...');
    cachedStudents = (stRes && stRes.success ? stRes.students : []);
    const subRes = await API.callBackend('getSubjects');
    const allSubjects = subRes && subRes.success ? subRes.subjects : CURRICULUM_SUBJECTS;
    const classes = [...new Set(cachedStudents.map(s => s.className || s.grade).filter(Boolean))];
    const periods = [
      {key:'p1',label:'1st Period'},{key:'p2',label:'2nd Period'},{key:'p3',label:'3rd Period'},{key:'exam1',label:'1st Sem. Exam'},
      {key:'p4',label:'4th Period'},{key:'p5',label:'5th Period'},{key:'p6',label:'6th Period'},{key:'exam2',label:'2nd Sem. Exam'}
    ];
    const firstClass=classes[0]||GRADE_LEVELS[0]||'';
    container.innerHTML=`
      <div class="content-card" style="padding:0;overflow:hidden;">
        <div style="padding:20px 22px;border-bottom:1px solid var(--color-border);background:linear-gradient(135deg,#f7fafc,#fff);">
          <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;">
            <div><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;"><h3 class="card-title" style="margin:0;">Grade Entry &amp; Submission Center</h3><span class="badge badge-info">ADMIN CONTROL</span></div>
            <div style="font-size:13px;color:var(--color-text-muted);margin-top:5px;max-width:820px;">The administrator can enter, correct, save, submit and finalize academic grades for any student, class or subject. Every submission is recorded in the grade activity log.</div></div>
            <div style="text-align:right;font-size:12px;color:#64748b;">Academic Year<br><b style="font-size:15px;color:var(--color-primary);">${escapeHtml(selectedAcademicYear)}</b></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:17px;">
            <div><label class="form-label">Class / Grade</label><select id="agClass" class="select-field" style="width:100%;">${classes.map(c=>`<option value="${escapeHtml(c)}" ${c===firstClass?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></div>
            <div><label class="form-label">Subject</label><select id="agSubject" class="select-field" style="width:100%;"></select></div>
            <div><label class="form-label">Search Student</label><input id="agSearch" class="input-field" style="width:100%;" placeholder="Name or Student ID"></div>
            <div><label class="form-label">Grade Status</label><select id="agView" class="select-field" style="width:100%;"><option value="all">All Students</option><option value="incomplete">Incomplete</option><option value="complete">Complete</option><option value="submitted">Submitted</option></select></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;padding:13px 22px;border-bottom:1px solid var(--color-border);">
          <div class="content-card" style="padding:10px 12px;margin:0;"><small>Students</small><div id="agTotal" style="font-size:21px;font-weight:800;">0</div></div>
          <div class="content-card" style="padding:10px 12px;margin:0;"><small>Complete</small><div id="agComplete" style="font-size:21px;font-weight:800;">0</div></div>
          <div class="content-card" style="padding:10px 12px;margin:0;"><small>Missing</small><div id="agMissing" style="font-size:21px;font-weight:800;">0</div></div>
          <div class="content-card" style="padding:10px 12px;margin:0;"><small>Submitted</small><div id="agSubmitted" style="font-size:21px;font-weight:800;">0</div></div>
          <div class="content-card" style="padding:10px 12px;margin:0;"><small>Unsaved</small><div id="agDirty" style="font-size:21px;font-weight:800;">0</div></div>
        </div>
        <div style="padding:11px 22px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;background:#f8fafc;border-bottom:1px solid var(--color-border);">
          <div style="font-size:12px;color:#64748b;"><b>Admin workflow:</b> Save Draft for incomplete work. Use Submit / Finalize when the selected grade sheet is ready for official academic records.</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;"><button type="button" class="btn btn-light btn-sm" id="agReset">Reset Unsaved</button><button type="button" class="btn btn-light" id="agDraft">Save Draft</button><button type="button" class="btn btn-primary" id="agSubmit">Submit / Finalize Grades</button></div>
        </div>
        <div class="table-responsive" style="max-height:56vh;overflow:auto;">
          <table class="data-table" style="min-width:1180px;"><thead style="position:sticky;top:0;z-index:2;background:#f8fafc;"><tr><th style="min-width:220px;">Student</th>${periods.map(p=>`<th style="min-width:105px;text-align:center;">${escapeHtml(p.label)}</th>`).join('')}<th>Status</th></tr></thead><tbody id="agBody"></tbody></table>
        </div>
        <div style="padding:12px 22px;border-top:1px solid var(--color-border);background:#fff;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;"><div><b>Grade Activity Log</b><div style="font-size:12px;color:#64748b;">Recent admin and teacher grade submissions for ${escapeHtml(selectedAcademicYear)}.</div></div><button type="button" class="btn btn-light btn-sm" id="agLogRefresh">Refresh Log</button></div>
        <div id="agLog" style="padding:0 22px 16px;max-height:220px;overflow:auto;"></div>
      </div>`;

    let currentStudents=[];
    const scoreKeys=periods.map(p=>p.key);
    function subjectOptionsForClass(cls,students){
      const assigned=new Set(selectedCurriculumForClass(cls));
      students.forEach(s=>(Array.isArray(s.curriculumSubjects)?s.curriculumSubjects:[]).forEach(x=>assigned.add(x)));
      const list=[...assigned].filter(x=>allSubjects.some(a=>String(a).toLowerCase()===String(x).toLowerCase()));
      return (list.length?list:allSubjects).filter(Boolean);
    }
    function refreshSubjects(preferred){
      const cls=document.getElementById('agClass').value; const students=cachedStudents.filter(s=>String(s.className||s.grade)===String(cls)&&(s.status||'Active')==='Active');
      const list=subjectOptionsForClass(cls,students); const el=document.getElementById('agSubject'); el.innerHTML=list.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join(''); if(preferred&&list.includes(preferred))el.value=preferred;
    }
    function getRec(st,sub){return ((st.years||{})[selectedAcademicYear]||[]).find(x=>String(x.subject).toLowerCase()===String(sub).toLowerCase())||{};}
    function any(rec){return scoreKeys.some(k=>String(rec[k]??'').trim()!=='');}
    function complete(rec){return scoreKeys.every(k=>String(rec[k]??'').trim()!=='');}
    function valid(v){return v===''||(Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100);}
    function statusOf(rec){if(rec.status==='submitted')return 'submitted'; if(complete(rec))return 'complete'; return any(rec)?'incomplete':'notstarted';}
    function updateSummary(){const rows=[...document.querySelectorAll('#agBody tr[data-id]')];let c=0,m=0,s=0,d=0;rows.forEach(tr=>{const r={};tr.querySelectorAll('.ag-score').forEach(i=>r[i.dataset.p]=i.value.trim());const st=statusOf(r);if(st==='complete'||st==='submitted')c++;if(st==='incomplete'||st==='notstarted')m++;if(tr.dataset.originalStatus==='submitted'||st==='submitted')s++;if(tr.dataset.dirty==='1')d++;});document.getElementById('agTotal').textContent=rows.length;document.getElementById('agComplete').textContent=c;document.getElementById('agMissing').textContent=m;document.getElementById('agSubmitted').textContent=s;document.getElementById('agDirty').textContent=d;}
    function draw(){
      const subject=document.getElementById('agSubject').value,q=document.getElementById('agSearch').value.trim().toLowerCase(),view=document.getElementById('agView').value;
      const filtered=currentStudents.filter(st=>{const rec=getRec(st,subject),stt=statusOf(rec);const match=!q||String(st.name||'').toLowerCase().includes(q)||String(st.id||'').toLowerCase().includes(q);const mode=view==='all'||(view==='complete'&&(stt==='complete'||stt==='submitted'))||(view==='incomplete'&&(stt==='incomplete'||stt==='notstarted'))||(view==='submitted'&&stt==='submitted');return match&&mode;});
      const body=document.getElementById('agBody'); body.innerHTML=filtered.map(st=>{const rec=getRec(st,subject),stt=statusOf(rec);const badge=stt==='submitted'?'<span class="badge badge-success">Submitted</span>':stt==='complete'?'<span class="badge badge-info">Complete</span>':stt==='incomplete'?'<span class="badge badge-warning">In Progress</span>':'<span class="badge badge-light">Not Started</span>';return `<tr data-id="${escapeHtml(st.id)}" data-dirty="0" data-original-status="${escapeHtml(stt)}"><td><div style="font-weight:700;">${escapeHtml(st.name||'Unnamed Student')}</div><div style="font-size:11px;color:#64748b;">${escapeHtml(st.id)} &bull; ${escapeHtml(st.className||st.grade||'')}</div></td>${scoreKeys.map(k=>`<td style="text-align:center;"><input type="number" min="0" max="100" step="0.01" class="input-field ag-score" data-p="${k}" value="${escapeHtml(rec[k]??'')}" style="width:82px;text-align:center;margin:auto;"></td>`).join('')}<td class="ag-status" style="font-size:12px;font-weight:700;">${badge}</td></tr>`;}).join('')||`<tr><td colspan="10" style="text-align:center;padding:30px;color:#64748b;">No students match the current filters.</td></tr>`;
      document.querySelectorAll('.ag-score').forEach(input=>{input.addEventListener('input',()=>{const tr=input.closest('tr');if(!valid(input.value)){input.setCustomValidity('Enter a score from 0 to 100.');input.style.borderColor='#dc2626';}else{input.setCustomValidity('');input.style.borderColor='';}tr.dataset.dirty='1';const r={};tr.querySelectorAll('.ag-score').forEach(i=>r[i.dataset.p]=i.value.trim());const st=statusOf(r);tr.querySelector('.ag-status').innerHTML=st==='submitted'?'<span class="badge badge-success">Ready to Submit</span>':complete(r)?'<span class="badge badge-info">Complete</span>':any(r)?'<span class="badge badge-warning">In Progress</span>':'<span class="badge badge-light">Not Started</span>';updateSummary();});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const a=[...document.querySelectorAll('.ag-score')],i=a.indexOf(input);if(a[i+1])a[i+1].focus();}});});updateSummary();}
    async function loadClass(){const cls=document.getElementById('agClass').value;const r=await API.callBackend('getStudentsByClass',{className:cls,academicYear:selectedAcademicYear},'Loading class roster...');currentStudents=(r&&r.success?r.students:[]).filter(s=>(s.status||'Active')==='Active');refreshSubjects();draw();await loadLog();}
    async function loadLog(){const r=await API.callBackend('getGradeActivityLog',{academicYear:selectedAcademicYear});const logs=r&&r.success?r.logs:[];const el=document.getElementById('agLog');el.innerHTML=logs.length?`<div style="display:grid;gap:6px;margin-top:9px;">${logs.slice(0,12).map(x=>`<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span><b>${escapeHtml(x.action||'Grade activity')}</b> &mdash; ${escapeHtml(x.className||'')} / ${escapeHtml(x.subject||'')} (${escapeHtml(String(x.studentCount||0))} students)</span><span style="color:#64748b;">${escapeHtml(x.actorName||'Administrator')} &bull; ${escapeHtml(x.status||'')} &bull; ${escapeHtml(x.timestamp||'')}</span></div>`).join('')}</div>`:'<div style="padding:12px 0;color:#64748b;font-size:12px;">No grade activity recorded yet.</div>';}
    async function saveGrades(mode){const rows=[...document.querySelectorAll('#agBody tr[data-id]')],grades=[];let invalid=false,incomplete=false;rows.forEach(tr=>{const g={studentId:tr.dataset.id};tr.querySelectorAll('.ag-score').forEach(i=>{const v=i.value.trim();if(!valid(v)){invalid=true;i.focus();}g[i.dataset.p]=v;});if(!complete(g))incomplete=true;if(tr.dataset.dirty==='1')grades.push(g);});if(invalid){API.toastNotification('Correct scores outside the 0–100 range before saving.',true);return;}if(!grades.length){API.toastNotification('No unsaved grade changes on this screen.');return;}if(mode==='submitted'&&incomplete&&!confirm('Some selected students do not have all grading periods completed. Submit these grades anyway?'))return;const r=await API.callBackend('teacherSubmitGrades',{teacherId:currentUser.id,actorRole:'admin',actorName:currentUser.name||'Administrator',className:document.getElementById('agClass').value,subject:document.getElementById('agSubject').value,academicYear:selectedAcademicYear,gradeStatus:mode,grades},mode==='submitted'?'Submitting official grades...':'Saving grade draft...');if(r&&r.success){API.toastSuccess(r.message||'Grades saved.');await loadClass();}else API.toastNotification((r&&r.message)||'Unable to save grades.',true);}
    document.getElementById('agClass').onchange=loadClass;document.getElementById('agSubject').onchange=draw;document.getElementById('agSearch').oninput=draw;document.getElementById('agView').onchange=draw;document.getElementById('agReset').onclick=()=>{if(confirm('Discard unsaved changes?'))draw();};document.getElementById('agDraft').onclick=()=>saveGrades('draft');document.getElementById('agSubmit').onclick=()=>saveGrades('submitted');document.getElementById('agLogRefresh').onclick=loadLog;
    refreshSubjects();await loadClass();
  }

  async function renderAdminLessonPlansTab(container) {
    const res=await API.callBackend('getLessonPlans',{filters:{academicYear:selectedAcademicYear}},'Loading teacher lesson plans...');
    const plans=res&&res.success?res.plans:[]; const pending=plans.filter(p=>(p.status||'pending')==='pending').length;
    container.innerHTML=`<div class="content-card"><div class="card-header-row"><div><h3 class="card-title">Teacher Lesson Plan Inbox</h3><div style="font-size:13px;color:var(--color-text-muted);">All lesson plans submitted by teachers appear here for administrative review, approval or return for revision.</div></div><span class="badge ${pending?'badge-warning':'badge-success'}">${pending} Pending Review</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:15px 0;"><div class="content-card" style="padding:11px;margin:0;"><small>Total Submitted</small><div style="font-size:21px;font-weight:800;">${plans.length}</div></div><div class="content-card" style="padding:11px;margin:0;"><small>Pending</small><div style="font-size:21px;font-weight:800;">${pending}</div></div><div class="content-card" style="padding:11px;margin:0;"><small>Approved</small><div style="font-size:21px;font-weight:800;">${plans.filter(p=>p.status==='approved').length}</div></div><div class="content-card" style="padding:11px;margin:0;"><small>Revision Needed</small><div style="font-size:21px;font-weight:800;">${plans.filter(p=>p.status==='revision').length}</div></div></div>
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Lesson</th><th>Teacher</th><th>Class</th><th>Subject</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${plans.length?plans.map(p=>`<tr><td><b>${escapeHtml(p.title||'Untitled Lesson')}</b><div style="font-size:11px;color:#64748b;">${escapeHtml((p.details||'').slice(0,100))}${(p.details||'').length>100?'…':''}</div></td><td>${escapeHtml(p.teacherName||p.teacherId||'')}</td><td>${escapeHtml(p.class||p.className||'')}</td><td>${escapeHtml(p.subject||'')}</td><td>${escapeHtml(p.submittedAt||'')}</td><td>${p.status==='approved'?'<span class="badge badge-success">Approved</span>':p.status==='revision'?'<span class="badge badge-warning">Revision</span>':'<span class="badge badge-info">Pending</span>'}</td><td><button type="button" class="btn btn-light btn-sm lp-review" data-id="${escapeHtml(p.id)}">Review</button></td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748b;">No teacher lesson plans have been submitted for this academic year.</td></tr>'}</tbody></table></div></div>`;
    document.querySelectorAll('.lp-review').forEach(btn=>btn.onclick=()=>{
      const p=plans.find(x=>String(x.id)===String(btn.dataset.id)); if(!p)return;
      App.showModal({title:'Review Teacher Lesson Plan',content:`<div style="font-size:13px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;"><div><b>Teacher</b><br>${escapeHtml(p.teacherName||p.teacherId||'')}</div><div><b>Class / Subject</b><br>${escapeHtml(p.class||p.className||'')} &bull; ${escapeHtml(p.subject||'')}</div></div><div style="padding:12px;background:#f8fafc;border-radius:8px;"><b>${escapeHtml(p.title||'Untitled Lesson')}</b><p style="white-space:pre-wrap;margin:8px 0 0;">${escapeHtml(p.details||'No lesson details supplied.')}</p></div>${p.attachmentUrl?`<div style="margin-top:12px;"><a class="btn btn-light btn-sm" href="${p.attachmentUrl}" target="_blank">Open Attachment: ${escapeHtml(p.attachmentName||'Lesson Plan File')}</a></div>`:''}<div class="form-group" style="margin-top:12px;"><label class="form-label">Decision</label><select id="lpReviewDecision" class="select-field"><option value="approved">Approve Lesson Plan</option><option value="revision">Return for Revision</option></select></div><div class="form-group"><label class="form-label">Admin Review Comment</label><textarea id="lpReviewComment" class="textarea-field" rows="3" placeholder="Add approval note or revision instructions..."></textarea></div></div>`,confirmText:p.status==='approved'?'Close':'Submit Review',onConfirm:async()=>{if(p.status==='approved')return;const decision=document.getElementById('lpReviewDecision').value;const c=document.getElementById('lpReviewComment').value.trim();if(decision==='revision'&&!c){API.toastNotification('Please enter the revision instructions for the teacher.',true);return;}const rr=await API.callBackend('reviewLessonPlan',{id:p.id,status:decision,comment:c,reviewedBy:currentUser.name||'Administrator'},decision==='approved'?'Approving lesson plan...':'Returning lesson plan...');if(rr&&rr.success){API.toastSuccess(rr.message);await renderAdminLessonPlansTab(container);}else API.toastNotification((rr&&rr.message)||'Unable to review lesson plan.',true);}});
    });
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
            <input type="text" id="setSchoolName" class="input-field" value="${escapeHtml(s.schoolName || 'Sorina Daycare & Primary School System')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="setSchoolMotto">School Motto</label>
            <input type="text" id="setSchoolMotto" class="input-field" value="${escapeHtml(s.schoolMotto || 'Excellence in Knowledge, Character & Integrity')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="setLogo">School Logo</label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div id="schoolLogoPreview" style="width:64px;height:64px;border:1px solid #dbe3ec;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;"><img src="${escapeHtml(s.logoUrl || 'assets/images/school-logo.png')}" alt="School logo" style="width:100%;height:100%;object-fit:contain;"></div>
              <input type="file" id="setLogo" class="input-field" accept="image/*" style="max-width:280px;">
            </div>
            <div class="form-hint">This logo will be used throughout the entire portal, headers, reports and receipts. Maximum 2 MB.</div>
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
              <label class="form-label">Profile Photo</label>
              <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                <div id="adminProfilePhotoBox" style="width:84px;height:84px;border-radius:50%;overflow:hidden;border:2px solid var(--color-primary);display:flex;align-items:center;justify-content:center;background:#eef2f7;font-size:28px;">
                  ${currentUser.photo ? `<img src="${escapeHtml(currentUser.photo)}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
                </div>
                <div>
                  <input type="file" id="adminProfilePhotoInput" class="input-field" accept="image/*" style="max-width:280px;">
                  <div class="form-hint">JPG, PNG or WEBP. Recommended passport-style photo. Maximum 2 MB.</div>
                  <button type="button" class="btn btn-light btn-sm" id="removeAdminProfilePhotoBtn" style="margin-top:6px;">Remove Photo</button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input type="text" class="input-field" value="${escapeHtml(currentUser.name || currentUser.username)}" disabled>
            </div>

            <div class="form-group">
              <label class="form-label" for="adminCurrentPass">Current Password</label>
              <input type="password" id="adminCurrentPass" class="input-field" placeholder="Enter current password">
              <label class="form-label" for="adminNewPass" style="margin-top:10px;">New Password</label>
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

          <div class="content-card" style="margin-top: 20px;">
            <h3 class="card-title" style="margin-bottom: 12px;">Account Session</h3>
            <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 14px;">
              Sign out of your administrator console session on this device.
            </p>
            <button type="button" class="btn btn-danger" id="adminSettingsLogoutBtn" style="display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/log-out.png" style="width: 16px; height: 16px; filter: brightness(0) invert(1);" alt="">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    `;

    let adminProfilePhoto = currentUser.photo || '';
    const photoInput = document.getElementById('adminProfilePhotoInput');
    const photoBox = document.getElementById('adminProfilePhotoBox');
    const removePhotoBtn = document.getElementById('removeAdminProfilePhotoBtn');
    if (photoInput) photoInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { API.toastNotification('Please select an image file.', true); return; }
      if (file.size > 2 * 1024 * 1024) { API.toastNotification('Profile photo must be 2 MB or smaller.', true); photoInput.value=''; return; }
      adminProfilePhoto = await readFileAsDataUrl(file);
      if (photoBox) photoBox.innerHTML = `<img src="${adminProfilePhoto}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;">`;
      const rr = await API.callBackend('updateAdminProfile',{username:currentUser.username,photo:adminProfilePhoto},'Saving profile photo...');
      if (rr && rr.success) { currentUser.photo=adminProfilePhoto; sessionStorage.setItem('sorina_user_data',JSON.stringify(currentUser)); API.toastSuccess('Profile photo saved.'); }
      else API.toastNotification((rr&&rr.message)||'Could not save profile photo.',true);
    };
    if (removePhotoBtn) removePhotoBtn.onclick = async () => {
      adminProfilePhoto='';
      if (photoBox) photoBox.innerHTML='👤';
      const rr=await API.callBackend('updateAdminProfile',{username:currentUser.username,photo:''},'Removing profile photo...');
      if(rr&&rr.success){currentUser.photo='';sessionStorage.setItem('sorina_user_data',JSON.stringify(currentUser));API.toastSuccess('Profile photo removed.');}
      else API.toastNotification((rr&&rr.message)||'Could not remove profile photo.',true);
    };

    let pendingLogo = s.logoUrl || 'assets/images/school-logo.png';
    const logoInput = document.getElementById('setLogo');
    if (logoInput) logoInput.onchange = async (e) => {
      const file=e.target.files && e.target.files[0]; if(!file)return;
      if(!file.type.startsWith('image/')){API.toastNotification('Please select an image file.',true);return;}
      if(file.size>2*1024*1024){API.toastNotification('School logo must be 2 MB or smaller.',true);logoInput.value='';return;}
      pendingLogo=await readFileAsDataUrl(file);
      const preview=document.getElementById('schoolLogoPreview'); if(preview)preview.innerHTML=`<img src="${pendingLogo}" alt="School logo" style="width:100%;height:100%;object-fit:contain;">`;
    };

    document.getElementById('saveBrandingBtn').onclick = async () => {
      const schoolName=document.getElementById('setSchoolName').value.trim(), schoolMotto=document.getElementById('setSchoolMotto').value.trim(), academicYear=document.getElementById('setYear').value.trim(), phone=document.getElementById('setPhone').value.trim(), email=document.getElementById('setEmail').value.trim();
      const res=await API.callBackend('updateSettings',{settings:{schoolName,schoolMotto,academicYear,contactPhone:phone,contactEmail:email,logoUrl:pendingLogo}},'Updating school branding...');
      if(res&&res.success){ if(window.App&&App.applyBranding) await App.applyBranding(); API.toastSuccess('School branding and configuration are now active across the portal.'); }
      else API.toastNotification((res&&res.message)||'Error updating settings.',true);
    };

    document.getElementById('saveAdminPassBtn').onclick = async () => {
      const currentPassword=document.getElementById('adminCurrentPass').value, newPassword=document.getElementById('adminNewPass').value;
      if(!currentPassword){API.toastNotification('Enter your current password.',true);return;}
      if(!newPassword||newPassword.length<6){API.toastNotification('Password must be at least 6 characters.',true);return;}
      const res=await API.callBackend('changePassword',{username:currentUser.username,currentPassword,newPassword},'Updating administrator password...');
      if(res&&res.success){API.toastSuccess('Administrator password updated successfully. It will be required at the next sign-in.');document.getElementById('adminCurrentPass').value='';document.getElementById('adminNewPass').value='';}
      else API.toastNotification((res&&res.message)||'Could not update password.',true);
    };

    document.getElementById('adminPwaBtn').onclick = () => {
      const btn = document.getElementById('installAppBtn');
      if (btn) btn.click();
      else API.toastNotification('App install ready via browser menu (Add to Home Screen).');
    };

    const signOutBtn = document.getElementById('adminSettingsLogoutBtn');
    if (signOutBtn) {
      signOutBtn.onclick = () => {
        if (window.Auth) window.Auth.logout();
      };
    }
  }

  // =========================================================================
  // 11. ADMINS TAB (SUPER ADMIN RBAC MANAGEMENT)
  // =========================================================================
  const PERMISSION_DEFINITIONS = [
    // Students Module
    { key: 'students:view', label: 'Students Directory (View)', desc: 'Browse student roster, profiles, photos & credentials', group: 'Students' },
    { key: 'students:edit', label: 'Students Directory (Manage/Edit)', desc: 'Enroll new/old students, edit details, lock/unlock grades', group: 'Students' },
    { key: 'students:delete', label: 'Students Directory (Delete)', desc: 'Permanently remove or archive student records', group: 'Students' },

    // Faculty Module
    { key: 'teachers:view', label: 'Teaching Staff (View)', desc: 'Browse teacher directory and assigned courses', group: 'Faculty' },
    { key: 'teachers:edit', label: 'Teaching Staff (Manage/Edit)', desc: 'Register teachers, edit profiles, attach classes & subjects', group: 'Faculty' },
    { key: 'teachers:delete', label: 'Teaching Staff (Delete)', desc: 'Remove faculty members from active roster', group: 'Faculty' },

    // Finance Module
    { key: 'finance:view', label: 'Tuition & Fees (View)', desc: 'Inspect fee schedules, collection ledger & student balances', group: 'Finance' },
    { key: 'finance:edit', label: 'Tuition & Fees (Record/Edit)', desc: 'Record & edit student tuition payments, fee schedule rates', group: 'Finance' },
    { key: 'finance:delete', label: 'Tuition & Fees (Delete)', desc: 'Delete payment records or fee entries', group: 'Finance' },

    // Payroll Module
    { key: 'payroll:view', label: 'All Expenses (View)', desc: 'Inspect staff compensation and payment vouchers', group: 'Payroll' },
    { key: 'payroll:edit', label: 'All Expenses (Manage/Edit)', desc: 'Process payroll, edit salary amounts, add staff, mark paid', group: 'Payroll' },
    { key: 'payroll:delete', label: 'All Expenses (Delete)', desc: 'Delete payroll records or salary entries', group: 'Payroll' },

    // Curriculum Module
    { key: 'subjects:view', label: 'Subjects Catalog (View)', desc: 'Browse official school curriculum subjects', group: 'Curriculum' },
    { key: 'subjects:edit', label: 'Subjects Catalog (Manage/Edit)', desc: 'Add new subjects, edit codes and department names', group: 'Curriculum' },
    { key: 'subjects:delete', label: 'Subjects Catalog (Delete)', desc: 'Remove subjects from curriculum catalog', group: 'Curriculum' },

    // Academics Module
    { key: 'scores:view', label: 'Grading Controls (View)', desc: 'View student grade sheets, periodic marks & report cards', group: 'Academics' },
    { key: 'scores:edit', label: 'Grading Controls (Manage/Edit)', desc: 'Lock/unlock grading periods and override periodic scores', group: 'Academics' },

    // Printing Module
    { key: 'printing:view', label: 'Printing Services (Preview)', desc: 'Generate & preview student/staff ID cards & tests', group: 'Printing' },
    { key: 'printing:send', label: 'Printing Services (Submit to IE)', desc: 'Submit ID cards and teacher tests to IE for physical printing', group: 'Printing' },

    // System Operations
    { key: 'summary:view', label: 'Executive Summary (View)', desc: 'Access administrative KPIs, enrollment charts & revenue metrics', group: 'System' },
    { key: 'messaging:view', label: 'Announcements (View)', desc: 'View school notices and broadcasts', group: 'Communication' },
    { key: 'messaging:send', label: 'Announcements (Broadcast)', desc: 'Broadcast notices to students, parents, and faculty', group: 'Communication' },
    { key: 'lesson_plans:view', label: 'Lesson Plans (Inspect)', desc: 'Review and evaluate submitted teacher lesson plans', group: 'Academics' },
    { key: 'export:view', label: 'Export Records (Download)', desc: 'Download CSV archives of rosters, ledger & payroll', group: 'System' },
    { key: 'settings:edit', label: 'School Settings (Manage)', desc: 'Update school branding, contacts, motto & academic year', group: 'System' },
    { key: 'audit:view', label: 'Security Audit Log (View)', desc: 'Inspect system access logs, authentication & audit trail', group: 'Security' }
  ];

  const ROLE_PRESETS = {
    'custom': { name: 'Other Staff — Manually Selected Responsibilities', perms: [] },
    'registrar': {
      name: 'School Registrar',
      perms: ['summary:view', 'students:view', 'students:edit', 'students:delete', 'finance:view', 'finance:edit', 'finance:delete', 'payroll:view', 'payroll:edit', 'payroll:delete', 'messaging:view', 'messaging:send', 'settings:edit', 'printing:view', 'printing:send', 'export:view']
    },
    'vpi': {
      name: 'Vice Principal for Instruction (VPI)',
      perms: ['summary:view', 'teachers:view', 'teachers:edit', 'subjects:view', 'subjects:edit', 'subjects:delete', 'scores:view', 'scores:edit', 'lesson_plans:view', 'messaging:view', 'messaging:send', 'settings:edit', 'export:view']
    },
    'bursar': {
      name: 'Bursar / Financial Officer',
      perms: ['finance:view', 'finance:edit', 'payroll:view', 'payroll:edit', 'summary:view', 'export:view']
    },
    'principal': {
      name: 'Academic Dean / Principal',
      perms: ['summary:view', 'students:view', 'teachers:view', 'teachers:edit', 'scores:view', 'scores:edit', 'subjects:view', 'subjects:edit', 'messaging:view', 'messaging:send', 'export:view', 'lesson_plans:view']
    },
    'auditor': {
      name: 'Staff Auditor (View Only)',
      perms: ['summary:view', 'students:view', 'teachers:view', 'finance:view', 'payroll:view', 'audit:view', 'export:view']
    }
  };

  async function renderAdminsTab(container) {
    const res = await API.callBackend('listAdmins', {}, 'Loading admins...');
    const admins = (res && res.success && Array.isArray(res.admins)) ? res.admins : [];
    cachedAdmins = admins;

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row" style="flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <div>
            <h3 class="card-title">Authorized System Administrators</h3>
            <div style="font-size: 13px; color: var(--color-text-muted);">
              Super Administrator Console: Provision administrative accounts and assign granular role-based features and permissions.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="openAddAdminBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/user-plus.png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Register New Administrator
          </button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Title / Role</th>
                <th>Email</th>
                <th>Last Login</th>
                <th>Assigned Features &amp; Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${admins.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--color-text-muted);">No administrator accounts found.</td></tr>
              ` : admins.map(a => {
                const perms = a.permissions || {};
                const activePermKeys = Object.keys(perms).filter(k => perms[k] === true);

                return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;background:#f8fafc;flex-shrink:0;">${a.photo ? `<img src="${escapeHtml(a.photo)}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}</div>
                        <div><b>${escapeHtml(a.name || a.username)}</b>
                          <div style="font-size: 11px; color: var(--color-text-muted); font-family: monospace;">@${escapeHtml(a.username)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${a.isSuperAdmin ? 'badge-success' : 'badge-info'}">${escapeHtml(a.title || a.roleTier)}</span>
                    </td>
                    <td>${escapeHtml(a.email)}</td>
                    <td>${escapeHtml(a.lastLogin || 'Never')}</td>
                    <td style="max-width: 320px;">
                      ${a.isSuperAdmin ? `
                        <span class="badge badge-success" style="font-size: 11px;">Full System Control (Super Admin)</span>
                      ` : activePermKeys.length === 0 ? `
                        <span style="color: var(--color-text-muted); font-size: 12px; font-style: italic;">No specific features assigned</span>
                      ` : `
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                          ${activePermKeys.map(k => {
                            const def = PERMISSION_DEFINITIONS.find(p => p.key === k);
                            const lbl = def ? def.label : k;
                            return `<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${escapeHtml(lbl)}</span>`;
                          }).join('')}
                        </div>
                      `}
                    </td>
                    <td>
                      ${a.isSuperAdmin ? `
                        <span style="color: var(--color-text-muted); font-size: 12px;">Protected Account</span>
                      ` : `
                        <div style="display: flex; gap: 6px;">
                          <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditAdminPermissionsModal('${escapeHtml(a.username)}')">
                            Permissions
                          </button>
                          <button type="button" class="btn btn-danger btn-sm" onclick="window.AdminPanel.removeAdmin('${escapeHtml(a.username)}')">
                            Remove
                          </button>
                        </div>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('openAddAdminBtn').onclick = () => openAddAdminModal();
  }

  function openAddAdminModal() {
    App.showModal({
      title: 'Provision Administrator Account',
      content: `
        <div style="font-size: 13.5px; max-height: 70vh; overflow-y: auto; padding-right: 6px;">
          <p style="color: var(--color-text-muted); margin-bottom: 14px;">
            SuperAdmin creates a separate login account for each administrator. Choose Registrar or VPI for a ready-made responsibility set, or choose Others to manually select exactly what the person can access.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="newAdmUsername">Username *</label>
              <input type="text" id="newAdmUsername" class="input-field" placeholder="e.g. registrar.sorina" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="newAdmName">Full Name *</label>
              <input type="text" id="newAdmName" class="input-field" placeholder="e.g. Sarah J. Freeman" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="newAdmEmail">Email Address *</label>
              <input type="email" id="newAdmEmail" class="input-field" placeholder="e.g. sfreeman@sorina.edu" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="newAdmPass">Initial Password *</label>
              <input type="password" id="newAdmPass" class="input-field" placeholder="Min 6 characters" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="newAdmPhoto">Administrator Profile Photo</label>
            <div style="display:flex;align-items:center;gap:12px;">
              <div id="newAdmPhotoBox" style="width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px dashed #94a3b8;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-size:24px;">👤</div>
              <input type="file" id="newAdmPhoto" class="input-field" accept="image/*" style="max-width:300px;">
            </div>
            <div class="form-hint">Optional. JPG, PNG or WEBP, maximum 2 MB.</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="newAdmPreset">Role Template / Preset</label>
              <select id="newAdmPreset" class="select-field">
                <option value="custom">Others — Manually Select Responsibilities</option>
                <option value="registrar" selected>School Registrar</option>
                <option value="vpi">Vice Principal for Instruction (VPI)</option>
                <option value="bursar">Bursar / Financial Officer</option>
                <option value="principal">Academic Dean / Principal</option>
                <option value="auditor">Staff Auditor (View Only)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="newAdmTitle">Official Title / Designation *</label>
              <input type="text" id="newAdmTitle" class="input-field" placeholder="e.g. School Registrar, Bursar, Vice Principal" value="School Registrar">
            </div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:10px 12px;border-radius:8px;margin-top:14px;color:#1e3a8a;font-size:12px;"><b>Role setup:</b> Registrar and VPI use the recommended access below. Select <b>Others</b> when adding another staff member and manually tick only the responsibilities that person needs.</div>

          <div style="margin-top: 18px; border-top: 1px solid var(--color-border); padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <label class="form-label" style="font-weight: 700; margin: 0;">Authorized Features &amp; Responsibilities</label>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-light btn-sm" id="admSelectAllPermsBtn" style="padding: 2px 8px; font-size: 11.5px;">Select All</button>
                <button type="button" class="btn btn-light btn-sm" id="admClearAllPermsBtn" style="padding: 2px 8px; font-size: 11.5px;">Clear</button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border);">
              ${PERMISSION_DEFINITIONS.map(p => `
                <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding: 4px; font-size: 12px;">
                  <input type="checkbox" class="adm-perm-check" data-key="${p.key}" style="margin-top: 2px;">
                  <div>
                    <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(p.label)}</div>
                    <div style="font-size: 10.5px; color: var(--color-text-muted); line-height: 1.2;">${escapeHtml(p.desc)}</div>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `,
      confirmText: 'Create Administrator',
      onConfirm: async () => {
        const username = document.getElementById('newAdmUsername').value.trim();
        const name = document.getElementById('newAdmName').value.trim();
        const email = document.getElementById('newAdmEmail').value.trim();
        const password = document.getElementById('newAdmPass').value;
        const title = document.getElementById('newAdmTitle').value.trim() || 'Administrator';

        if (!username || !name || !email || !password) {
          API.toastNotification('Please fill in all required fields.', true);
          return;
        }

        if (password.length < 6) {
          API.toastNotification('Password must be at least 6 characters.', true);
          return;
        }

        let photo = '';
        const photoFile = document.getElementById('newAdmPhoto')?.files?.[0];
        if (photoFile) {
          if (!photoFile.type.startsWith('image/')) { API.toastNotification('Administrator photo must be an image.', true); return; }
          if (photoFile.size > 2 * 1024 * 1024) { API.toastNotification('Administrator photo must be 2 MB or smaller.', true); return; }
          photo = await readFileAsDataUrl(photoFile);
        }

        const permissions = {};
        document.querySelectorAll('.adm-perm-check').forEach(chk => {
          if (chk.checked) permissions[chk.dataset.key] = true;
        });

        const res = await API.callBackend('createAdmin', {
          username: username,
          name: name,
          email: email,
          password: password,
          title: title,
          permissions: permissions,
          photo: photo
        }, 'Creating administrator...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('admins');
        } else {
          API.toastNotification(res.message || 'Error creating administrator.', true);
        }
      }
    });

    setTimeout(() => {
      const photoInput = document.getElementById('newAdmPhoto');
      const photoBox = document.getElementById('newAdmPhotoBox');
      if (photoInput) photoInput.onchange = (e) => {
        const f=e.target.files&&e.target.files[0]; if(!f)return;
        if(!f.type.startsWith('image/')||f.size>2*1024*1024){API.toastNotification('Choose an image no larger than 2 MB.',true);photoInput.value='';return;}
        const r=new FileReader(); r.onload=()=>{if(photoBox)photoBox.innerHTML=`<img src="${r.result}" style="width:100%;height:100%;object-fit:cover;">`;}; r.readAsDataURL(f);
      };
      const selectAllBtn = document.getElementById('admSelectAllPermsBtn');
      const clearAllBtn = document.getElementById('admClearAllPermsBtn');
      const presetSelect = document.getElementById('newAdmPreset');

      const applyPreset = (key) => {
        const p = ROLE_PRESETS[key];
        if (!p) return;
        const allowed = new Set(p.perms);
        document.querySelectorAll('.adm-perm-check').forEach(c => {
          c.checked = allowed.has(c.dataset.key);
        });
        if (key !== 'custom') {
          const tInput = document.getElementById('newAdmTitle');
          if (tInput) tInput.value = p.name;
        }
      };

      if (presetSelect) {
        presetSelect.onchange = (e) => applyPreset(e.target.value);
        applyPreset('registrar'); // Default to registrar
      }

      if (selectAllBtn) {
        selectAllBtn.onclick = () => {
          document.querySelectorAll('.adm-perm-check').forEach(c => c.checked = true);
        };
      }
      if (clearAllBtn) {
        clearAllBtn.onclick = () => {
          document.querySelectorAll('.adm-perm-check').forEach(c => c.checked = false);
        };
      }
    }, 50);
  }

  function openEditAdminPermissionsModal(username) {
    const a = cachedAdmins.find(x => x.username === username);
    if (!a) {
      API.toastNotification('Administrator account not found.', true);
      return;
    }

    const currentPerms = a.permissions || {};

    App.showModal({
      title: `Permissions: ${escapeHtml(a.name || a.username)}`,
      content: `
        <div style="font-size: 13.5px; max-height: 70vh; overflow-y: auto; padding-right: 6px;">
          <div style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; display:flex;align-items:center;gap:12px;">
            <div id="editAdmPhotoBox" style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid var(--color-primary);display:flex;align-items:center;justify-content:center;background:#fff;font-size:22px;">${a.photo ? `<img src="${escapeHtml(a.photo)}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}</div>
            <div>
              <div><b>Administrator:</b> ${escapeHtml(a.name || a.username)} (@${escapeHtml(a.username)})</div>
              <div><b>Email:</b> ${escapeHtml(a.email)}</div>
              <label style="display:block;margin-top:6px;font-size:11px;">Change Profile Photo <input type="file" id="editAdmPhoto" accept="image/*" style="max-width:240px;font-size:11px;"></label>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="editAdmPreset">Apply Role Preset</label>
              <select id="editAdmPreset" class="select-field">
                <option value="custom">Keep Current Custom</option>
                <option value="registrar">School Registrar</option>
                <option value="vpi">Vice Principal for Instruction (VPI)</option>
                <option value="bursar">Bursar / Financial Officer</option>
                <option value="principal">Academic Dean / Principal</option>
                <option value="auditor">Staff Auditor (View Only)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="editAdmTitle">Title / Role Designation</label>
              <input type="text" id="editAdmTitle" class="input-field" value="${escapeHtml(a.title || a.roleTier)}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="editAdmNewPass">Reset Password (Optional)</label>
            <input type="password" id="editAdmNewPass" class="input-field" placeholder="Leave blank to keep unchanged">
          </div>

          <div style="margin-top: 14px; border-top: 1px solid var(--color-border); padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <label class="form-label" style="font-weight: 700; margin: 0;">Assigned Features &amp; Responsibilities</label>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-light btn-sm" id="admEditSelectAllBtn" style="padding: 2px 8px; font-size: 11.5px;">Select All</button>
                <button type="button" class="btn btn-light btn-sm" id="admEditClearAllBtn" style="padding: 2px 8px; font-size: 11.5px;">Clear</button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border);">
              ${PERMISSION_DEFINITIONS.map(p => `
                <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding: 4px; font-size: 12px;">
                  <input type="checkbox" class="adm-edit-perm-check" data-key="${p.key}" ${currentPerms[p.key] === true ? 'checked' : ''} style="margin-top: 2px;">
                  <div>
                    <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(p.label)}</div>
                    <div style="font-size: 10.5px; color: var(--color-text-muted); line-height: 1.2;">${escapeHtml(p.desc)}</div>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `,
      confirmText: 'Save Permissions',
      onConfirm: async () => {
        const title = document.getElementById('editAdmTitle').value.trim();
        const newPass = document.getElementById('editAdmNewPass').value.trim();

        const permissions = {};
        document.querySelectorAll('.adm-edit-perm-check').forEach(chk => {
          if (chk.checked) permissions[chk.dataset.key] = true;
        });

        let photo = a.photo || '';
        const photoFile = document.getElementById('editAdmPhoto')?.files?.[0];
        if (photoFile) {
          if (!photoFile.type.startsWith('image/') || photoFile.size > 2*1024*1024) { API.toastNotification('Choose an image no larger than 2 MB.', true); return; }
          photo = await readFileAsDataUrl(photoFile);
        }
        const payload = {
          username: a.username,
          title: title,
          permissions: permissions,
          photo: photo
        };
        if (newPass) {
          payload.newPassword = newPass;
        }

        const res = await API.callBackend('updateAdminPermissions', payload, 'Updating administrator permissions...');

        if (res && res.success) {
          API.toastSuccess();
          loadTab('admins');
        } else {
          API.toastNotification(res.message || 'Error updating administrator.', true);
        }
      }
    });

    setTimeout(() => {
      const editPhotoInput = document.getElementById('editAdmPhoto');
      const editPhotoBox = document.getElementById('editAdmPhotoBox');
      if (editPhotoInput) editPhotoInput.onchange = (e) => {
        const f=e.target.files&&e.target.files[0]; if(!f)return;
        if(!f.type.startsWith('image/')||f.size>2*1024*1024){API.toastNotification('Choose an image no larger than 2 MB.',true);editPhotoInput.value='';return;}
        const r=new FileReader(); r.onload=()=>{if(editPhotoBox)editPhotoBox.innerHTML=`<img src="${r.result}" style="width:100%;height:100%;object-fit:cover;">`;}; r.readAsDataURL(f);
      };
      const selectAllBtn = document.getElementById('admEditSelectAllBtn');
      const clearAllBtn = document.getElementById('admEditClearAllBtn');
      const presetSelect = document.getElementById('editAdmPreset');

      if (presetSelect) {
        presetSelect.onchange = (e) => {
          const key = e.target.value;
          if (key === 'custom') return;
          const p = ROLE_PRESETS[key];
          if (!p) return;
          const allowed = new Set(p.perms);
          document.querySelectorAll('.adm-edit-perm-check').forEach(c => {
            c.checked = allowed.has(c.dataset.key);
          });
          const tInput = document.getElementById('editAdmTitle');
          if (tInput) tInput.value = p.name;
        };
      }

      if (selectAllBtn) {
        selectAllBtn.onclick = () => {
          document.querySelectorAll('.adm-edit-perm-check').forEach(c => c.checked = true);
        };
      }
      if (clearAllBtn) {
        clearAllBtn.onclick = () => {
          document.querySelectorAll('.adm-edit-perm-check').forEach(c => c.checked = false);
        };
      }
    }, 50);
  }

  function removeAdmin(username) {
    App.showModal({
      title: 'Remove Administrator Access',
      content: `
        <div style="font-size: 13.5px;">
          <p>Are you sure you want to revoke administrative credentials and access for <b>@${escapeHtml(username)}</b>?</p>
          <p style="color: #b91c1c; font-size: 12.5px;">This action will immediately disable their login to the admin console.</p>
        </div>
      `,
      confirmText: 'Revoke Access',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const res = await API.callBackend('removeAdmin', { username: username }, 'Removing administrator...');
        if (res && res.success) {
          API.toastSuccess();
          loadTab('admins');
        } else {
          API.toastNotification(res.message || 'Error removing administrator.', true);
        }
      }
    });
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
    exportCsv: exportCsv,
    toggleStudentExpandRow: toggleStudentExpandRow,
    printReceiptsByCategory: printReceiptsByCategory,
    onReceiptCategoryChange: onReceiptCategoryChange,
    printSingleReceipt: printSingleReceipt,
    openAddAdminModal: openAddAdminModal,
    openEditAdminPermissionsModal: openEditAdminPermissionsModal,
    removeAdmin: removeAdmin,
    openAddCustomStaffModal: openAddCustomStaffModal,
    openEditPayrollModal: openEditPayrollModal,
    downloadPayrollReport: downloadExpenses,
    editExpense: editExpense,
    deleteExpense: deleteExpense,
    deleteAnnouncement: deleteAnnouncement,
    openEditPaymentModal: openEditPaymentModal,
    openRecordPaymentModal: openRecordPaymentModal,
    openClassFeeModal: openClassFeeModal,
    openAddFeeItemModal: openAddFeeItemModal,
    deleteFeeItem: deleteFeeItem,
    openEditStudentModal: openEditStudentModal,
    deleteStudent: deleteStudent,
    openEditTeacherModal: openEditTeacherModal,
    deleteTeacher: deleteTeacher
  };
})();
