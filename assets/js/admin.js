/**
 * admin.js
 * -----------------------------------------------------------------------
 * Administrator & Super Administrator Module
 * 
 * Features:
 * - Collapsible royal blue left sidebar navigation matching official theme.
 * - Summary Tab: enrolled by classes, teachers, revenue, expenses, net balance, target.
 * - Students Tab: systematic ID [SJSH001], New Student registration, Old Student
 *   registration with previous class filter & auto-fill, grade lock, report cards.
 * - Teachers Tab: systematic ID [SPST001], multi-class / multi-subject assignments.
 * - Finance & Tuition: class fee schedules (New vs Old), student fee records.
 * - Expenses Tab: all school expenses (salaries included) recorded in the database.
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
  let cachedExpenses = [];
  let cachedAnnouncements = [];
  let cachedSubjects = [];
  let isSidebarCollapsed = false;

  function hasPerm(permKey) {
    if (!currentUser) return true;
    if (currentUser.role === 'superadmin') return true;
    return Boolean(currentUser.permissions && currentUser.permissions[permKey]);
  }

  const DEFAULT_GRADE_LEVELS = [
    'Daycare',
    'Nursery 1',
    'Nursery 2',
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

  function getStoredClasses() {
    try {
      const saved = JSON.parse(localStorage.getItem('sorina_custom_classes') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (e) {}
    return [...DEFAULT_GRADE_LEVELS];
  }

  let GRADE_LEVELS = getStoredClasses();

  let cachedClassFees = [];
  let dashboardCurrency = localStorage.getItem('sorina_dashboard_currency') || 'USD';
  function currencySymbol(code){ return code === 'LRD' ? 'LRD' : 'USD'; }
  // Base amounts are stored in USD. Viewing in LRD multiplies by the admin-entered exchange rate (LRD per 1 USD).
  function getExchangeRate(){ const r = Number(localStorage.getItem('sorina_exchange_rate')); return r > 0 ? r : 0; }
  function convertAmount(v, code=dashboardCurrency){
    const n = Number(v); const base = isNaN(n) ? 0 : n;
    if (code === 'USD') return base;
    const rate = getExchangeRate();
    return rate > 0 ? base * rate : base;
  }
  function syncCurrencySelects(){
    ['adminGlobalCurrency','dashboardCurrencySelect'].forEach(id => { const el = document.getElementById(id); if (el) el.value = dashboardCurrency; });
  }
  // Switching away from USD requires a conversion rate (e.g. 1 USD = 200 LRD).
  function requestCurrencyChange(newCode, tab){
    if (newCode === dashboardCurrency) { syncCurrencySelects(); return; }
    const apply = () => {
      dashboardCurrency = newCode;
      localStorage.setItem('sorina_dashboard_currency', dashboardCurrency);
      syncCurrencySelects();
      loadTab(tab || currentTab);
    };
    if (newCode === 'USD') { apply(); return; }
    syncCurrencySelects(); // revert dropdown until a valid rate is confirmed
    const existing = getExchangeRate();
    App.showModal({
      title: 'Currency Conversion Rate',
      content: `<div style="font-size:13.5px;line-height:1.6;">
        <p>Amounts are recorded in <b>USD</b>. To view them in <b>${newCode}</b>, enter the exchange rate.</p>
        <div class="form-group"><label class="form-label" for="fxRateInput">1 USD = ? ${newCode}</label>
        <input type="number" id="fxRateInput" class="input-field" min="0" step="any" placeholder="e.g. 200" value="${existing || ''}"></div>
        <div class="form-hint">Example: rate 200 means USD 1 shows as ${newCode} 200.</div></div>`,
      confirmText: 'Apply Rate',
      onConfirm: () => {
        const rate = Number(document.getElementById('fxRateInput').value);
        if (!(rate > 0)) { App.showToast('Enter a conversion rate greater than 0.', 'error'); return false; }
        localStorage.setItem('sorina_exchange_rate', String(rate));
        apply();
        App.showToast(`Currency set to ${newCode} at 1 USD = ${rate} ${newCode}`, 'success');
      }
    });
  }
  function previousAcademicYear(year){
    const m=String(year||'').match(/^(\d{4})[-\/](\d{4})$/);
    return m ? `${Number(m[1])-1}-${Number(m[2])-1}` : '';
  }
  function moneyLabel(v, code=dashboardCurrency){ return currencySymbol(code)+' '+convertAmount(toNum(v), code).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  // Subjects & curriculum come ONLY from the database (no local copies).
  let subjectRecords = [];
  let curriculumMapCache = {};
  function getCatalogSubjects(){ return subjectRecords.filter(r=>r.status!=='Inactive').map(r=>r.name); }
  function selectedCurriculumForClass(cls){ const m=curriculumMapCache[cls]; return Array.isArray(m)?m:[]; }
  async function refreshSubjectCatalog(){
    const [a,b]=await Promise.all([API.callBackend('getSubjects',{},'Loading subjects...'),API.callBackend('getCurriculumSubjects',{},'Loading class subjects...')]);
    if(a&&a.success&&Array.isArray(a.subjects)) subjectRecords=a.subjects.filter(x=>x&&x.name).map(x=>({name:x.name,category:x.category||'',code:x.code||'',status:x.status==='Inactive'?'Inactive':'Active',description:x.description||''}));
    else { subjectRecords=[]; API.toastNotification((a&&a.message)||'Could not load subjects from the database.',true); }
    curriculumMapCache=(b&&b.success&&b.curriculum&&typeof b.curriculum==='object')?b.curriculum:{};
    cachedSubjects=subjectRecords.map(r=>r.name);
    return subjectRecords;
  }

  function getClassFeeSchedule(className, category) {
    category = String(category || 'new').toLowerCase();
    const found = cachedClassFees.find(f =>
      String(f.className).toLowerCase() === String(className).toLowerCase() &&
      String(f.studentCategory || 'new').toLowerCase() === category
    );
    if (found) return found;
    // No schedule in the database yet: show zeros, never invented amounts.
    return { className, studentCategory: category, currency: 'USD', entranceFee: 0, registrationFee: 0, tuitionTotal: 0, requirementsFee: 0, peSuitFee: 0, portalFee: 0, installments: [], extraFees: [], notSet: true };
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
    if (currentUser && currentUser.permissions) { ['view','edit','delete'].forEach(k=>{ if (currentUser.permissions['payroll:'+k] && !currentUser.permissions['expenses:'+k]) currentUser.permissions['expenses:'+k]=true; }); }
    const isSuper = user.role === 'superadmin';
    const perms = user.permissions || {};

    if (isSuper || perms['summary:view'] === true) currentTab = 'summary';
    else if (perms['students:view'] || perms['students:edit'] || perms['students:delete']) currentTab = 'students';
    else if (perms['teachers:view'] || perms['teachers:edit'] || perms['teachers:delete']) currentTab = 'teachers';
    else if (perms['finance:view'] || perms['finance:edit'] || perms['finance:delete']) currentTab = 'finance';
    else if (perms['expenses:view'] || perms['expenses:edit'] || perms['expenses:delete']) currentTab = 'expenses';
    else if (perms['messaging:view'] || perms['messaging:send']) currentTab = 'announcements';
    else if (perms['subjects:view'] || perms['subjects:edit'] || perms['subjects:delete']) currentTab = 'subjects';
    else if (isSuper || user.role === 'admin' || perms['scores:view'] || perms['scores:edit']) currentTab = 'gradeEntry';
    else if (perms['settings:edit']) currentTab = 'settings';
    else if (perms['audit:view']) currentTab = 'audit';
    else if (perms['export:view'] || perms['export:data']) currentTab = 'export';
    else currentTab = 'settings';

    renderPortalLayout(container);
    const gc=document.getElementById('adminGlobalCurrency'); if(gc) gc.onchange=()=>requestCurrencyChange(gc.value,currentTab);
    loadTab(currentTab);
  }

  function renderPortalLayout(container) {
    const isSuperAdmin = currentUser.role === 'superadmin';
    const perms = currentUser.permissions || {};

    const canSummary = isSuperAdmin || perms['summary:view'] === true;
    const canStudents = isSuperAdmin || perms['students:view'] || perms['students:edit'] || perms['students:delete'];
    const canTeachers = isSuperAdmin || perms['teachers:view'] || perms['teachers:edit'] || perms['teachers:delete'];
    const canFinance = isSuperAdmin || perms['finance:view'] || perms['finance:edit'] || perms['finance:delete'];
    const canExpenses = isSuperAdmin || perms['expenses:view'] || perms['expenses:edit'] || perms['expenses:delete'];
    const canSubjects = isSuperAdmin || perms['subjects:view'] || perms['subjects:edit'] || perms['subjects:delete'];
    const canScores = isSuperAdmin || perms['scores:view'] === true || perms['scores:edit'] === true;
    const canLessonPlans = isSuperAdmin || perms['lesson_plans:view'] === true;
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

          <!-- Academic Year & Currency Selectors -->
          <div class="sidebar-year-box" style="padding: 10px 14px; background: rgba(255,255,255,0.08); border-radius: 6px; margin: 10px 12px 14px;">
            <div style="font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 4px; color: #ffffff; font-weight: 600;">Academic Year</div>
            <select id="adminGlobalYearSelect" class="select-field" style="width: 100%; background: #ffffff; color: var(--color-primary); font-weight: 700; font-size: 12.5px; padding: 5px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 8px;">
              ${ACADEMIC_YEARS.map(y => `<option value="${y}" ${selectedAcademicYear === y ? 'selected' : ''}>${y.replace('-', '–')}</option>`).join('')}
            </select>
            <div style="font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 4px; color: #ffffff; font-weight: 600;">Currency</div>
            <select id="adminGlobalCurrency" class="select-field" style="width: 100%; background: #ffffff; color: var(--color-primary); font-weight: 700; font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
              <option value="USD" ${dashboardCurrency === 'USD' ? 'selected' : ''}>USD ($)</option>
              <option value="LRD" ${dashboardCurrency === 'LRD' ? 'selected' : ''}>LRD (L$)</option>
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

            ${canExpenses ? `
              <a class="sidebar-item ${currentTab === 'expenses' ? 'active' : ''}" data-tab="expenses">
                <img src="assets/icons/landmark.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">All Expenses</span>
              </a>
            ` : ''}

            <div class="nav-section-title">Academics &amp; Services</div>

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
              ${isSuperAdmin ? `<a class="sidebar-item ${currentTab === 'grading' ? 'active' : ''}" data-tab="grading">
                <img src="assets/icons/pencil.png" class="sidebar-icon" alt="">
                <span class="sidebar-item-label">Grading Controls</span>
              </a>` : ''}
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

    // Sidebar Toggle & Auto-hide
    const sidebar = document.getElementById('adminSidebar');
    const toggleBtn = document.getElementById('adminSidebarToggleBtn');
    let sidebarTimer = null;

    function resetSidebarTimer() {
      if (sidebarTimer) clearTimeout(sidebarTimer);
      // Auto-collapse after 60 seconds (1 minute) of inactivity
      sidebarTimer = setTimeout(() => {
        if (!isSidebarCollapsed && sidebar) {
          isSidebarCollapsed = true;
          sidebar.classList.add('collapsed');
        }
      }, 60000);
    }

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isSidebarCollapsed = !isSidebarCollapsed;
        sidebar.classList.toggle('collapsed', isSidebarCollapsed);
        if (!isSidebarCollapsed) resetSidebarTimer();
      });
    }

    // Auto-collapse when user clicks or interacts with main screen of selected tab
    const contentArea = document.getElementById('adminContentBody');
    if (contentArea) {
      contentArea.addEventListener('click', () => {
        if (!isSidebarCollapsed && sidebar && window.innerWidth > 768) {
          isSidebarCollapsed = true;
          sidebar.classList.add('collapsed');
        }
      });
    }

    if (sidebar) {
      sidebar.addEventListener('mouseenter', resetSidebarTimer);
      sidebar.addEventListener('mousemove', resetSidebarTimer);
    }
    resetSidebarTimer();

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

    // Global Currency Select handler
    const curSelect = document.getElementById('adminGlobalCurrency');
    if (curSelect) {
      // change handled by requestCurrencyChange (rate prompt) via onchange above

    }

    // Nav Item Click Handlers
    container.querySelectorAll('.sidebar-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.sidebar-item[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        // Auto-collapse sidebar after user selects a tab so main workspace is wide
        if (!isSidebarCollapsed && sidebar) {
          isSidebarCollapsed = true;
          sidebar.classList.add('collapsed');
        }
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
      expenses: isSuper || perms['expenses:view'] || perms['expenses:edit'] || perms['expenses:delete'],
      announcements: isSuper || perms['messaging:view'] || perms['messaging:send'],
      subjects: isSuper || perms['subjects:view'] || perms['subjects:edit'] || perms['subjects:delete'],
      gradeEntry: isSuper || perms['scores:view'] === true || perms['scores:edit'] === true,
      lessonPlans: isSuper || perms['lesson_plans:view'] === true,
      grading: isSuper,
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

    try {
    if (['students','teachers'].includes(tab)) await refreshSubjectCatalog();

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
      case 'expenses':
        await renderExpensesTab(container);
        break;
      case 'announcements':
        await renderAnnouncementsTab(container);
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
    } catch (err) {
      console.error('[Admin] Tab failed to load:', tab, err);
      container.innerHTML = `<div class="content-card" style="text-align:center;padding:40px 20px;"><h3 style="color:var(--color-danger);margin-bottom:8px;">This section could not be loaded</h3><p style="color:var(--color-text-muted);max-width:520px;margin:0 auto 14px;">${escapeHtml(err && err.message ? err.message : 'Unexpected error')}</p><button type="button" class="btn btn-primary" onclick="window.AdminPanel.switchTab('${escapeHtml(tab)}')">Try Again</button></div>`;
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

    return `
      <div style="display: flex; justify-content: center; align-items: center; padding: 16px 0;">
        <svg viewBox="0 0 260 260" width="220" height="220" style="max-width: 100%; height: auto;">
          ${paths}
        </svg>
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
          <div class="stat-value" style="color: var(--color-success);">${currencySymbol(dashboardCurrency)} ${convertAmount(sum.totalRevenue).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value" style="color: var(--color-danger);">${currencySymbol(dashboardCurrency)} ${convertAmount(sum.totalExpenses).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Net Operating Balance</div>
          <div class="stat-value" style="color: ${sum.netBalance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'};">
            ${currencySymbol(dashboardCurrency)} ${convertAmount(sum.netBalance).toLocaleString()}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Target Remaining (Receivable)</div>
          <div class="stat-value" style="color: #d97706;">${currencySymbol(dashboardCurrency)} ${convertAmount(sum.targetRemaining).toLocaleString()}</div>
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
    const dc=document.getElementById('dashboardCurrencySelect'); if(dc) dc.onchange=()=>requestCurrencyChange(dc.value,'summary');
    const sy=document.getElementById('summaryAcademicYear'); if(sy) sy.onchange=()=>{ selectedAcademicYear=sy.value; localStorage.setItem('sorina_selected_academic_year',selectedAcademicYear); const global=document.getElementById('adminGlobalYearSelect'); if(global) global.value=selectedAcademicYear; App.showToast(`Executive Summary set to academic year ${selectedAcademicYear}`, 'info'); loadTab('summary'); };
  }

  // =========================================================================
  // 2. STUDENTS TAB (SYSTEMATIC ID, NEW & OLD STUDENT ENROLLMENT)
  // =========================================================================
  async function renderStudentsTab(container) {
    const res = await API.callBackend('getAllStudents', { academicYear: selectedAcademicYear }, 'Fetching students...');
    cachedStudents = (res && res.success && Array.isArray(res.students)) ? res.students : [];

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

    if (canEdit) {
      document.getElementById('regNewStudentBtn').onclick = () => openRegisterNewStudentModal();
      document.getElementById('regOldStudentBtn').onclick = () => openRegisterOldStudentModal();
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
          <td><b>[${escapeHtml(s.id)}]</b></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #cbd5e1;">
                ${s.photo ? `<img src="${escapeHtml(s.photo)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='👤'">` : '👤'}
              </div>
              <div>
                <div style="font-weight: 600;">${escapeHtml(s.name)}</div>
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
        canScores ? API.callBackend('getReportCard', { studentId: studentId, academicYear: selectedAcademicYear }) : Promise.resolve(null),
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
                  <b>Class Curriculum Subjects:</b>
                  ${(selectedCurriculumForClass(s.className || s.grade) || []).length
                    ? (selectedCurriculumForClass(s.className || s.grade) || []).map(x=>`<span class="badge badge-light" style="margin:2px;">${escapeHtml(x)}</span>`).join('')
                    : '<span style="color:#94a3b8;"> No curriculum subjects configured for this class</span>'}
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

  // Billed = class fee package tied to the student's class (server applies the class fee schedule).
  function studentBilled(s) {
    const f = s.finance || {};
    if (f.totalBilled !== undefined) return toNum(f.totalBilled);
    return toNum(f.tuitionTotal) + toNum(f.registrationFee) + toNum(f.requirementsFee) + toNum(f.peSuitFee) +
           toNum(f.portalFee) + toNum(f.entranceFee) + (f.extraFees || []).reduce((a, x) => a + toNum(x.amount), 0);
  }

  // Balance = class billed total minus everything the student has paid.
  function studentBalance(s) {
    return Math.max(0, studentBilled(s) - toNum((s.finance || {}).totalPaid));
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
    if (!list.length) { API.toastNotification('No students to print receipts for.', true); return; }
    const cardsHtml = list.map(s => buildReceiptCardHtml(s)).join('');

    App.showModal({
      title: `Payment Receipt Preview (${list.length} student${list.length > 1 ? 's' : ''})`,
      content: `
        <div class="no-print" style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; background: #e0f2fe; padding: 10px 14px; border-radius: 6px; border: 1px solid #7dd3fc;">
          <span style="font-size: 13px; color: #0369a1; font-weight: 600;">Print preview loaded. Ready to print or save to PDF.</span>
          <button type="button" class="btn btn-primary btn-sm" id="modalPrintReceiptBtn" style="display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Receipt${list.length > 1 ? 's' : ''}
          </button>
        </div>
        <div id="receiptPreviewContainer" style="max-height: 70vh; overflow-y: auto; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1;">
          <div class="receiptPrintGrid" style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center;">
            ${cardsHtml}
          </div>
        </div>
      `,
      confirmText: 'Print Now',
      cancelText: 'Close',
      onConfirm: () => {
        executeReceiptPrint(cardsHtml);
        return true;
      }
    });

    setTimeout(() => {
      const pBtn = document.getElementById('modalPrintReceiptBtn');
      if (pBtn) pBtn.onclick = () => executeReceiptPrint(cardsHtml);
    }, 50);
  }

  function executeReceiptPrint(cardsHtml) {
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('');
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Receipts - Sorina Daycare & Primary School System</title>${styles}
        <style>@page { size: A4 landscape; margin: 6mm; } body{background:#fff;margin:0;padding:4mm;}</style></head><body><div class="receiptPrintGrid">${cardsHtml}</div></body></html>`);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => { printWin.print(); }, 400);
    } else {
      window.print();
    }
  }

  function printSingleReceipt(studentId) {
    const s = cachedStudents.find(x => x.id === studentId);
    if (!s) { API.toastNotification('Student record not found.', true); return; }
    printReceiptCards([s]);
  }

  // --- Register New Student Modal (Systematic ID: SJSH001, Photo, Subjects, Class Fee Schedule) ---
  async function openRegisterNewStudentModal() {
    const idRes = await API.callBackend('getNextStudentId', {}, 'Fetching next ID...');
    const nextId = (idRes && idRes.success) ? idRes.nextId : 'SJSH001';
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
            <div class="form-hint" style="margin-top: 4px;">Upload passport-style student photograph. Used globally in receipts and reports.</div>
          </div>

          <!-- Identification & Personal Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" for="nsId">Systematic Student ID *</label>
              <input type="text" id="nsId" class="input-field" value="${escapeHtml(nextId)}" required style="font-weight: 700; color: var(--color-primary);">
              <div class="form-hint">Systematic format [SJSH001].</div>
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
            <div style="font-weight:700;color:var(--color-primary);margin-bottom:6px;">Class Curriculum Subjects</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Subjects are defined at the class level and appear automatically on report cards.</div>
            <div>${(selectedCurriculumForClass(s.className || s.grade) || []).length
              ? (selectedCurriculumForClass(s.className || s.grade) || []).map(x=>`<span class="badge badge-light" style="margin:2px;">${escapeHtml(x)}</span>`).join('')
              : '<span style="color:#94a3b8;">No curriculum subjects configured for this class</span>'}</div>
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
            phone: phone
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
        return (!q||hay.includes(q))&&(y==='all'||!t.academicYear||String(t.academicYear)===y)&&(st==='all'||String(t.status||'Active')===st);
      });
      const body=document.getElementById('teacherDirectoryBody');
      if(!body)return;
      body.innerHTML=rows.length?`<div class="table-responsive"><table class="data-table" style="min-width:950px;"><thead><tr><th>Staff</th><th>Academic Year</th><th>Systematic ID</th><th>Assigned Class / Subject</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(t=>{
        const assignments=(t.assignments||[]).map(a=>`<div style="margin:2px 0;"><b>${escapeHtml(a.class)}</b><span style="color:#64748b;"> — ${Array.isArray(a.subjects)&&a.subjects.length?a.subjects.map(escapeHtml).join(', '):'All Subjects'}</span></div>`).join('');
        return `<tr><td><div style="display:flex;align-items:center;gap:9px;min-width:185px;"><div style="width:42px;height:42px;border-radius:50%;overflow:hidden;background:#e2e8f0;display:flex;align-items:center;justify-content:center;border:1px solid #cbd5e1;flex-shrink:0;">${t.photo?`<img src="${escapeHtml(t.photo)}" style="width:100%;height:100%;object-fit:cover;">`:'<img src="assets/icons/user.png" style="width:23px;height:23px;opacity:.65;">'}</div><div><b>${escapeHtml(t.name)}</b><div style="font-size:11px;color:#64748b;">${escapeHtml(t.title||'Teacher')}</div></div></div></td><td><span class="badge badge-light">${escapeHtml(String(t.academicYear||'—').replace('-', '–'))}</span></td><td><b style="color:var(--color-primary);">${escapeHtml(t.id)}</b><div style="font-size:10px;color:#64748b;">Login ID</div></td><td style="max-width:360px;">${assignments||'<span style="color:#94a3b8;">Not assigned</span>'}</td><td>${escapeHtml(t.phone||'—')}<br><span style="font-size:11px;color:#64748b;">${escapeHtml(t.email||'')}</span></td><td><span class="badge ${t.status==='Active'?'badge-success':'badge-danger'}">${escapeHtml(t.status||'Active')}</span></td><td><div style="display:flex;gap:4px;flex-wrap:wrap;"><button class="btn btn-light btn-sm" onclick="window.AdminPanel.openEditTeacherModal('${escapeHtml(t.id)}')">Edit</button>${canDelete?`<button class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteTeacher('${escapeHtml(t.id)}')">Delete</button>`:''}</div></td></tr>`;
      }).join('')}</tbody></table></div>`:`<div style="padding:42px 20px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:10px;">No teaching staff found. Use <b>Add Teaching Staff</b> to create a year-specific teacher account.</div>`;
    };
    ['teacherSearch','teacherYearFilter','teacherStatusFilter'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderRows));
    document.getElementById('teacherYearFilter')?.addEventListener('change',renderRows);
    if(canEdit)document.getElementById('addTeacherBtn').onclick=()=>openAddTeacherModal();
    renderRows();
  }

  function teacherYearOptions(selected){ return TEACHER_YEARS.map(y=>`<option value="${y}" ${String(selected||'')===y?'selected':''}>${y.replace('-', '–')}</option>`).join(''); }

  // ---- Teacher assignment: each class gets its own subjects (taken from that class's curriculum) ----
  function teacherAssignPickerHtml(prefix, existing){
    const map={}; (existing||[]).forEach(a=>{ if(a&&a.class) map[a.class]=new Set(a.subjects||[]); });
    return `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin:12px 0;background:#f8fafc;">
      <label class="form-label" style="font-weight:700;">Assigned Classes &amp; Subjects</label>
      <div class="form-hint" style="margin-bottom:8px;">Tick a class, then tick the subjects this teacher handles in that class. The teacher can only open and grade the classes and subjects selected here.</div>
      ${GRADE_LEVELS.map(g=>{
        const subs=selectedCurriculumForClass(g), on=map[g]!==undefined;
        return `<div class="ta-block" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:6px;background:#fff;">
          <label style="font-size:13px;"><input type="checkbox" class="${prefix}-class-check" value="${escapeHtml(g)}" ${on?'checked':''}> <b>${escapeHtml(g)}</b></label>
          <div class="${prefix}-subject-panel" data-class="${escapeHtml(g)}" style="display:${on?'grid':'none'};grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:5px;font-size:12px;margin-top:7px;">
            ${subs.length?subs.map(sub=>`<label><input type="checkbox" class="${prefix}-subject-check" data-class="${escapeHtml(g)}" value="${escapeHtml(sub)}" ${on&&map[g].has(sub)?'checked':''}> ${escapeHtml(sub)}</label>`).join(''):'<div style="color:#b45309;grid-column:1/-1;">No subjects are assigned to this class yet. Assign them in the Subjects tab first.</div>'}
          </div></div>`;
      }).join('')}
    </div>`;
  }
  function bindTeacherAssignPicker(prefix){
    document.querySelectorAll('.'+prefix+'-class-check').forEach(cb=>{
      cb.addEventListener('change',()=>{
        const panel=[...document.querySelectorAll('.'+prefix+'-subject-panel')].find(x=>x.dataset.class===cb.value);
        if(panel) panel.style.display=cb.checked?'grid':'none';
      });
    });
  }
  function collectTeacherAssignments(prefix){
    const assignments=[]; let missing='';
    document.querySelectorAll('.'+prefix+'-class-check:checked').forEach(c=>{
      const cls=c.value;
      const subjects=[...document.querySelectorAll('.'+prefix+'-subject-check:checked')].filter(x=>x.dataset.class===cls).map(x=>x.value);
      if(!subjects.length&&!missing) missing=cls;
      assignments.push({class:cls,subjects});
    });
    return {assignments,missing};
  }

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
        <div class="form-group"><label class="form-label">Staff Photo</label><input type="file" id="ntPhoto" class="input-field" accept="image/*"><div class="form-hint">Passport/profile photo used throughout the teacher portal and profiles.</div></div>
        ${teacherAssignPickerHtml('nt',[])}
      </div>`,confirmText:'Create Teacher Account',onConfirm:async()=>{
        const id=document.getElementById('ntId').value.trim(),name=document.getElementById('ntName').value.trim(),year=document.getElementById('ntYear').value,pass=document.getElementById('ntPass').value.trim();
        if(!id||!name||!pass){API.toastNotification('Academic year, Systematic ID, name and password are required.',true);return false;}
        const picked=collectTeacherAssignments('nt');
        if(picked.missing){API.toastNotification(`Select at least one subject for ${picked.missing}, or untick that class.`,true);return false;}
        const assignments=picked.assignments;
        const file=document.getElementById('ntPhoto').files[0];
        const photo=file?await readFileAsDataUrl(file):'';
        const teacher={id,name,academicYear:year,title:document.getElementById('ntTitle').value.trim()||'Teacher',phone:document.getElementById('ntPhone').value.trim(),email:document.getElementById('ntEmail').value.trim(),password:pass,photo,status:document.getElementById('ntStatus').value,assignments,createdAt:new Date().toISOString()};
        const r=await API.callBackend('saveTeacher',{teacher},'Creating teacher account...');
        if(r&&r.success){API.toastSuccess(`${id} created for ${year}. Teacher can now sign in from the Teacher Portal.`);loadTab('teachers');return true;}else{API.toastNotification((r&&r.message)||'Could not create teacher.',true);return false;}
      }});
    setTimeout(()=>bindTeacherAssignPicker('nt'),50);
  }

  function openEditTeacherModal(teacherId) {
    const t=cachedTeachers.find(x=>x.id===teacherId); if(!t)return;
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
        ${teacherAssignPickerHtml('et',t.assignments)}
      </div>`,confirmText:'Save Teacher Profile',onConfirm:async()=>{
        const name=document.getElementById('etName').value.trim(); if(!name){API.toastNotification('Teacher name is required.',true);return false;}
        const picked=collectTeacherAssignments('et');
        if(picked.missing){API.toastNotification(`Select at least one subject for ${picked.missing}, or untick that class.`,true);return false;}
        const file=document.getElementById('etPhoto').files[0];
        const payload={id:t.id,originalId:t.id,name,academicYear:document.getElementById('etYear').value,title:document.getElementById('etTitle').value.trim(),phone:document.getElementById('etPhone').value.trim(),email:document.getElementById('etEmail').value.trim(),status:document.getElementById('etStatus').value,photo:file?await readFileAsDataUrl(file):(t.photo||''),assignments:picked.assignments};
        const pass=document.getElementById('etPass').value.trim();if(pass)payload.password=pass;
        const r=await API.callBackend('saveTeacher',{teacher:payload},'Saving teacher profile...');if(r&&r.success){API.toastSuccess('Teacher profile updated.');loadTab('teachers');return true;}else{API.toastNotification((r&&r.message)||'Could not update teacher.',true);return false;}
      }});
    setTimeout(()=>bindTeacherAssignPicker('et'),50);
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
    } else {
      cachedClassFees = [];
      API.toastNotification((feesRes && feesRes.message) || 'Could not load class fee schedules from the database.', true);
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
            <button type="button" class="btn btn-primary btn-sm" id="addClassBtn" style="display: flex; align-items: center; gap: 6px;">
              <span>+</span> Add Class
            </button>
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
                <th style="text-align: right;">Additional</th>
                <th style="text-align: right; background: #e2e8f0;">Total Package</th>
                <th style="text-align: center;">Actions</th>
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
                const extrasTot = (sched.extraFees||[]).reduce((a,x)=>a+toNum(x.amount),0);
                const tot = ent + reg + tui + req + pe + port + extrasTot;
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
                    <td style="text-align: right;">${extrasTot>0?formatMoney(extrasTot, cur)+`<div style="font-size:10px;color:#64748b;">${(sched.extraFees||[]).length} fee(s)</div>`:'<span style="color:#94a3b8;">—</span>'}</td>
                    <td style="text-align: right; font-weight: 800; color: var(--color-primary); background: #f8fafc;">${formatMoney(tot, cur)}</td>
                    <td style="text-align: center; white-space: nowrap;">
                      <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openClassFeeModal('${escapeHtml(cls)}', '${financeCategoryView}')" title="Configure fee rates">
                        Edit Rates
                      </button>
                      <button type="button" class="btn btn-light btn-sm" onclick="window.AdminPanel.openRenameClassModal('${escapeHtml(cls)}')" title="Rename class">
                        Rename
                      </button>
                      <button type="button" class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteClass('${escapeHtml(cls)}')" title="Remove class">
                        Delete
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
        if (stat === 'cleared') matchStat = curBal <= 0 && studentBilled(s) > 0;
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
        const totBilled = studentBilled(s);
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
              ${inst.slice(0, 4).map(v => toNum(v).toLocaleString()).join(' / ')} <span style="color:#94a3b8;">${escapeHtml(cur)}</span>
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
    const acBtn = document.getElementById('addClassBtn');
    if (acBtn) acBtn.onclick = openAddClassModal;
  }

  function saveStoredClasses(list) {
    GRADE_LEVELS = [...list];
    localStorage.setItem('sorina_custom_classes', JSON.stringify(GRADE_LEVELS));
  }

  function openAddClassModal() {
    App.showModal({
      title: 'Add New School Class',
      content: `
        <div class="form-group">
          <label class="form-label" for="newClassNameInput">Class / Grade Level Name *</label>
          <input type="text" id="newClassNameInput" class="input-field" placeholder="e.g. Nursery 3 or Grade 13" required>
          <div class="form-hint">Enter the new class name. It will be immediately available across all tabs, registrations, and fee schedules.</div>
        </div>
      `,
      confirmText: 'Create Class',
      onConfirm: () => {
        const name = (document.getElementById('newClassNameInput')?.value || '').trim();
        if (!name) {
          API.toastNotification('Class name is required.', true);
          return false;
        }
        if (GRADE_LEVELS.some(c => c.toLowerCase() === name.toLowerCase())) {
          API.toastNotification('A class with that name already exists.', true);
          return false;
        }
        saveStoredClasses([...GRADE_LEVELS, name]);
        API.toastSuccess(`Class "${name}" successfully created.`);
        loadTab(currentTab);
        return true;
      }
    });
  }

  function openRenameClassModal(oldName) {
    App.showModal({
      title: `Rename Class: ${escapeHtml(oldName)}`,
      content: `
        <div class="form-group">
          <label class="form-label" for="renameClassNameInput">New Class Name *</label>
          <input type="text" id="renameClassNameInput" class="input-field" value="${escapeHtml(oldName)}" required>
          <div class="form-hint">Renaming updates this class across the entire portal.</div>
        </div>
      `,
      confirmText: 'Rename Class',
      onConfirm: () => {
        const newName = (document.getElementById('renameClassNameInput')?.value || '').trim();
        if (!newName) {
          API.toastNotification('New class name is required.', true);
          return false;
        }
        if (newName.toLowerCase() !== oldName.toLowerCase() && GRADE_LEVELS.some(c => c.toLowerCase() === newName.toLowerCase())) {
          API.toastNotification('Another class already has that name.', true);
          return false;
        }
        const updated = GRADE_LEVELS.map(c => c === oldName ? newName : c);
        saveStoredClasses(updated);
        API.toastSuccess(`Class renamed to "${newName}".`);
        loadTab(currentTab);
        return true;
      }
    });
  }

  function deleteClass(clsName) {
    if (!confirm(`Are you sure you want to remove class "${clsName}"?`)) return;
    const updated = GRADE_LEVELS.filter(c => c !== clsName);
    if (!updated.length) {
      API.toastNotification('Cannot delete all classes.', true);
      return;
    }
    saveStoredClasses(updated);
    API.toastSuccess(`Class "${clsName}" removed.`);
    loadTab(currentTab);
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
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
              <b style="color:var(--color-primary);">Tuition Installments &amp; Deadlines</b>
              <button type="button" class="btn btn-light btn-sm" id="cfAddInst">+ Add Installment</button>
            </div>
            <div id="cfInstList" style="display:grid;gap:6px;"></div>
            <div id="cfInstSum" class="form-hint" style="margin-top:6px;"></div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin-top:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
              <b style="color:var(--color-primary);">Additional Fees (with time frame)</b>
              <button type="button" class="btn btn-light btn-sm" id="cfAddExtra">+ Add Fee</button>
            </div>
            <div id="cfExtraList" style="display:grid;gap:8px;"></div>
            <div class="form-hint" style="margin-top:6px;">Each fee has a name, an amount and the period in which it applies. These are billed to every student in this class.</div>
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

        const installments = [...document.querySelectorAll('#cfInstList .cf-inst-row')].map(r => ({
          amount: Number(r.querySelector('.cf-inst-amt').value) || 0,
          deadline: r.querySelector('.cf-inst-date').value || ''
        }));
        const extraFees = [...document.querySelectorAll('#cfExtraList .cf-extra-row')].map(r => ({
          name: r.querySelector('.cf-ex-name').value.trim(),
          amount: Number(r.querySelector('.cf-ex-amt').value) || 0,
          startDate: r.querySelector('.cf-ex-start').value || '',
          endDate: r.querySelector('.cf-ex-end').value || ''
        }));
        if (extraFees.some(x => !x.name)) { API.toastNotification('Every additional fee needs a name.', true); return false; }
        if (extraFees.some(x => x.startDate && x.endDate && x.endDate < x.startDate)) { API.toastNotification('An additional fee ends before it starts. Check the dates.', true); return false; }
        const instSum = installments.reduce((a, x) => a + x.amount, 0);
        if (installments.length && Math.abs(instSum - tuition) > 0.009) {
          API.toastNotification(`Installments total ${instSum.toFixed(2)} but tuition is ${tuition.toFixed(2)}. They must match.`, true);
          return false;
        }

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
          installments: installments,
          extraFees: extraFees
        };

        const res = await API.callBackend('saveClassFee', feeData, 'Saving fee schedule...');
        if (res && res.success) {
          API.toastSuccess('Fee schedule saved to the database.');
          loadTab('finance');
        } else {
          API.toastNotification((res && res.message) || 'Error saving class fee schedule.', true);
          return false;
        }
      }
    });

    // Live editors for installments and additional fees
    setTimeout(() => {
      let inst = (Array.isArray(sched.installments) ? sched.installments : []).map(x => ({ amount: x.amount, deadline: x.deadline || '' }));
      let extras = (Array.isArray(sched.extraFees) ? sched.extraFees : []).map(x => ({ name: x.name, amount: x.amount, startDate: x.startDate || '', endDate: x.endDate || '' }));
      const ord = n => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

      function syncFromDom() {
        inst = [...document.querySelectorAll('#cfInstList .cf-inst-row')].map(r => ({ amount: Number(r.querySelector('.cf-inst-amt').value) || 0, deadline: r.querySelector('.cf-inst-date').value || '' }));
        extras = [...document.querySelectorAll('#cfExtraList .cf-extra-row')].map(r => ({ name: r.querySelector('.cf-ex-name').value, amount: Number(r.querySelector('.cf-ex-amt').value) || 0, startDate: r.querySelector('.cf-ex-start').value || '', endDate: r.querySelector('.cf-ex-end').value || '' }));
      }
      function updateSum() {
        const t = Number(document.getElementById('cfTuition')?.value) || 0;
        const sum = [...document.querySelectorAll('#cfInstList .cf-inst-amt')].reduce((a, i) => a + (Number(i.value) || 0), 0);
        const el = document.getElementById('cfInstSum');
        if (!el) return;
        el.innerHTML = inst.length ? `Installments total <b>${sum.toFixed(2)}</b> of tuition <b>${t.toFixed(2)}</b>` + (Math.abs(sum - t) > 0.009 ? ' <span style="color:#dc2626;font-weight:700;">— must match tuition</span>' : ' <span style="color:#15803d;font-weight:700;">✓</span>') : 'No installments: tuition is due as a single payment.';
      }
      function drawInst() {
        const box = document.getElementById('cfInstList'); if (!box) return;
        box.innerHTML = inst.map((x, i) => `<div class="cf-inst-row" style="display:grid;grid-template-columns:90px 1fr 1fr auto;gap:8px;align-items:center;background:#f8fafc;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0;">
          <span style="font-size:12.5px;font-weight:700;color:var(--color-primary);">${ord(i + 1)}</span>
          <input type="number" min="0" step="0.01" class="input-field cf-inst-amt" value="${escapeHtml(String(x.amount ?? 0))}" placeholder="Amount" style="padding:4px 8px;">
          <input type="date" class="input-field cf-inst-date" value="${escapeHtml(x.deadline || '')}" title="Payment deadline" style="padding:4px 8px;">
          <button type="button" class="btn btn-light btn-sm cf-del-inst" data-i="${i}" style="color:#ef4444;padding:2px 8px;" title="Remove installment">✕</button>
        </div>`).join('');
        box.querySelectorAll('.cf-del-inst').forEach(b => b.onclick = () => { syncFromDom(); inst.splice(Number(b.dataset.i), 1); drawInst(); });
        box.querySelectorAll('.cf-inst-amt').forEach(i => i.oninput = updateSum);
        updateSum();
      }
      function drawExtras() {
        const box = document.getElementById('cfExtraList'); if (!box) return;
        box.innerHTML = extras.length ? extras.map((x, i) => `<div class="cf-extra-row" style="display:grid;grid-template-columns:1.4fr 1fr auto;gap:8px;align-items:end;background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #e2e8f0;">
          <div><label class="form-label" style="font-size:11px;">Fee name</label><input class="input-field cf-ex-name" value="${escapeHtml(x.name || '')}" placeholder="e.g. Field Trip" style="padding:4px 8px;"></div>
          <div><label class="form-label" style="font-size:11px;">Amount</label><input type="number" min="0" step="0.01" class="input-field cf-ex-amt" value="${escapeHtml(String(x.amount ?? 0))}" style="padding:4px 8px;"></div>
          <button type="button" class="btn btn-light btn-sm cf-del-extra" data-i="${i}" style="color:#ef4444;padding:2px 8px;" title="Remove fee">✕</button>
          <div><label class="form-label" style="font-size:11px;">Starts</label><input type="date" class="input-field cf-ex-start" value="${escapeHtml(x.startDate || '')}" style="padding:4px 8px;"></div>
          <div><label class="form-label" style="font-size:11px;">Ends / Deadline</label><input type="date" class="input-field cf-ex-end" value="${escapeHtml(x.endDate || '')}" style="padding:4px 8px;"></div>
          <span></span>
        </div>`).join('') : '<div style="font-size:12px;color:#94a3b8;">No additional fees for this class.</div>';
        box.querySelectorAll('.cf-del-extra').forEach(b => b.onclick = () => { syncFromDom(); extras.splice(Number(b.dataset.i), 1); drawExtras(); });
      }
      document.getElementById('cfAddInst').onclick = () => { syncFromDom(); inst.push({ amount: 0, deadline: '' }); drawInst(); };
      document.getElementById('cfAddExtra').onclick = () => { syncFromDom(); extras.push({ name: '', amount: 0, startDate: '', endDate: '' }); drawExtras(); };
      document.getElementById('cfTuition').addEventListener('input', updateSum);
      drawInst(); drawExtras();
    }, 60);
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; color: var(--color-primary); font-size: 13px;">Admission &amp; Activity Fees</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <label class="form-label" style="margin: 0; font-size: 12px;" for="epCurrency">Fee Currency:</label>
                <select id="epCurrency" class="select-field ep-calc-input" style="padding: 3px 8px; font-weight: 700;">
                  <option value="USD" ${currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                  <option value="LRD" ${currency === 'LRD' ? 'selected' : ''}>LRD (L$)</option>
                </select>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label class="form-label" for="epRegFee">Registration Fee</label>
                <input type="number" id="epRegFee" class="input-field ep-calc-input" value="${f.registrationFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epRegPaid" class="ep-calc-input" ${f.registrationPaid ? 'checked' : ''}>
                  <span>Mark as Paid</span>
                </label>
              </div>

              <div>
                <label class="form-label" for="epEntFee">Entrance Fee</label>
                <input type="number" id="epEntFee" class="input-field ep-calc-input" value="${f.entranceFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epEntPaid" class="ep-calc-input" ${f.entranceFeePaid ? 'checked' : ''}>
                  <span>Mark as Paid</span>
                </label>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
              <div>
                <label class="form-label" for="epReqFee">Requirements</label>
                <input type="number" id="epReqFee" class="input-field ep-calc-input" value="${f.requirementsFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epReqPaid" class="ep-calc-input" ${f.requirementsFeePaid ? 'checked' : ''}>
                  <span>Paid</span>
                </label>
              </div>

              <div>
                <label class="form-label" for="epPeFee">PE Suit</label>
                <input type="number" id="epPeFee" class="input-field ep-calc-input" value="${f.peSuitFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epPePaid" class="ep-calc-input" ${f.peSuitFeePaid ? 'checked' : ''}>
                  <span>Paid</span>
                </label>
              </div>

              <div>
                <label class="form-label" for="epPortalFee">Portal Fee</label>
                <input type="number" id="epPortalFee" class="input-field ep-calc-input" value="${f.portalFee || 0}">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; cursor: pointer;">
                  <input type="checkbox" id="epPortalPaid" class="ep-calc-input" ${f.portalFeePaid ? 'checked' : ''}>
                  <span>Paid</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Tuition Installments with (+) Add Installment -->
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #ffffff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 700; color: var(--color-primary); font-size: 13px;">Tuition Installments Payments</span>
                <div style="font-size: 12px; color: #64748b;">Record payment amounts and timeframe dates for each installment.</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: 600;">Total Tuition Billed:</span>
                <input type="number" id="epTuitionTotal" class="input-field ep-calc-input" style="width: 95px; padding: 3px 6px; font-weight: 700;" value="${f.tuitionTotal || 0}">
                <button type="button" class="btn btn-primary btn-sm" id="epAddInstallmentBtn" style="display: flex; align-items: center; gap: 4px;">
                  <span>+</span> Add Installment
                </button>
              </div>
            </div>

            <!-- Dynamic Installments List -->
            <div id="epInstallmentsList" style="display: flex; flex-direction: column; gap: 8px;"></div>

            ${(Array.isArray(f.extraFees) && f.extraFees.length) ? `
            <div style="margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:10px;">
              <div style="font-weight:700;color:var(--color-primary);font-size:13px;margin-bottom:6px;">Additional Fees</div>
              <div id="epExtraList" style="display:flex;flex-direction:column;gap:6px;">
                ${f.extraFees.map(x => `<div class="ep-extra-row" data-name="${escapeHtml(x.name)}" data-start="${escapeHtml(x.startDate||'')}" data-end="${escapeHtml(x.endDate||'')}" style="display:grid;grid-template-columns:1fr 100px auto;gap:8px;align-items:center;background:#f8fafc;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0;">
                  <div><b style="font-size:12.5px;">${escapeHtml(x.name)}</b><div style="font-size:11px;color:#64748b;">${escapeHtml(x.startDate||'—')} → ${escapeHtml(x.endDate||'—')}</div></div>
                  <input type="number" min="0" step="0.01" class="input-field ep-calc-input ep-extra-amt" value="${Number(x.amount)||0}" style="padding:4px 8px;">
                  <label style="font-size:12px;white-space:nowrap;"><input type="checkbox" class="ep-calc-input ep-extra-paid" ${x.paid?'checked':''}> Paid</label>
                </div>`).join('')}
              </div>
            </div>` : ''}

            <div class="form-group" style="margin-top: 10px;">
              <label class="form-label" for="epOther">Additional / Ancillary Payment</label>
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
        const selectedCur = document.getElementById('epCurrency')?.value || currency;
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
        const other = Number(document.getElementById('epOther').value) || 0;

        // Gather dynamic installment amounts and dates
        const instRows = document.querySelectorAll('.ep-inst-row');
        const installmentValues = [];
        const installmentDates = [];
        instRows.forEach(row => {
          const amt = Number(row.querySelector('.ep-inst-amt')?.value) || 0;
          const dt = row.querySelector('.ep-inst-date')?.value || '';
          installmentValues.push(amt);
          installmentDates.push(dt);
        });

        const paymentData = {
          currency: selectedCur,
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
          installments: installmentValues,
          installmentDates: installmentDates,
          extraFees: [...document.querySelectorAll('.ep-extra-row')].map(r => ({ name: r.dataset.name, amount: Number(r.querySelector('.ep-extra-amt').value) || 0, paid: r.querySelector('.ep-extra-paid').checked, startDate: r.dataset.start || '', endDate: r.dataset.end || '' })),
          otherPayments: other
        };

        if (installmentValues.some(v => v < 0)) { API.toastNotification('Installment amounts cannot be negative.', true); return false; }

        const res = await API.callBackend('recordPayment', {
          studentId: studentId,
          payment: paymentData
        }, 'Recording payment to database...');

        if (res && res.success) {
          API.toastSuccess('Payment saved to the database.');
          loadTab('finance');
          return true;
        }
        API.toastNotification((res && res.message) || 'The payment was NOT saved. Please try again.', true);
        return false;
      }
    });

    // Wire live dynamic installments and calculations
    setTimeout(() => {
      let instList = Array.isArray(f.installments) && f.installments.length ? [...f.installments] : [0, 0, 0, 0];
      let dateList = Array.isArray(f.installmentDates) ? [...f.installmentDates] : [];

      function renderInstallmentRows() {
        const container = document.getElementById('epInstallmentsList');
        if (!container) return;
        container.innerHTML = instList.map((amt, idx) => {
          const ord = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
          const dt = dateList[idx] || '';
          return `
            <div class="ep-inst-row" style="display: grid; grid-template-columns: 120px 1fr 1fr auto; gap: 8px; align-items: center; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12.5px; font-weight: 700; color: var(--color-primary);">${ord} Installment:</span>
              <div>
                <input type="number" min="0" step="0.01" class="input-field ep-calc-input ep-inst-amt" value="${amt}" placeholder="Amount" style="padding: 4px 8px;">
              </div>
              <div>
                <input type="date" class="input-field ep-inst-date" value="${escapeHtml(dt)}" title="Payment Timeframe / Due Date" style="padding: 4px 8px;">
              </div>
              <div>
                ${instList.length > 1 ? `<button type="button" class="btn btn-light btn-sm ep-del-inst-btn" data-idx="${idx}" style="color: #ef4444; padding: 2px 8px;">✕</button>` : ''}
              </div>
            </div>
          `;
        }).join('');

        container.querySelectorAll('.ep-del-inst-btn').forEach(btn => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            instList.splice(idx, 1);
            dateList.splice(idx, 1);
            renderInstallmentRows();
            calcLive();
          };
        });

        container.querySelectorAll('.ep-calc-input').forEach(input => {
          input.addEventListener('input', calcLive);
          input.addEventListener('change', calcLive);
        });
      }

      const addInstBtn = document.getElementById('epAddInstallmentBtn');
      if (addInstBtn) {
        addInstBtn.onclick = () => {
          instList.push(0);
          dateList.push('');
          renderInstallmentRows();
          calcLive();
        };
      }

      function calcLive() {
        const cur = document.getElementById('epCurrency')?.value || currency;
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
        let sumInst = 0;
        document.querySelectorAll('.ep-inst-amt').forEach(inp => {
          sumInst += Number(inp.value) || 0;
        });
        const other = Number(document.getElementById('epOther')?.value) || 0;

        let exBill = 0, exPaid = 0;
        document.querySelectorAll('.ep-extra-row').forEach(r => { const a = Number(r.querySelector('.ep-extra-amt').value) || 0; exBill += a; if (r.querySelector('.ep-extra-paid').checked) exPaid += a; });
        const totBilled = tuition + regFee + entFee + reqFee + peFee + portFee + exBill;
        const totPaid = (regPaid ? regFee : 0) + (entPaid ? entFee : 0) + (reqPaid ? reqFee : 0) + (pePaid ? peFee : 0) + (portPaid ? portFee : 0) + sumInst + other + exPaid;
        const balance = Math.max(0, totBilled - totPaid);

        const bEl = document.getElementById('epLiveBilled');
        const pEl = document.getElementById('epLivePaid');
        const balEl = document.getElementById('epLiveBalance');

        if (bEl) bEl.textContent = formatMoney(totBilled, cur);
        if (pEl) pEl.textContent = formatMoney(totPaid, cur);
        if (balEl) {
          balEl.textContent = formatMoney(balance, cur);
          balEl.style.color = balance > 0 ? 'var(--color-danger)' : 'var(--color-success)';
        }
      }

      renderInstallmentRows();
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
  // 5. EXPENSES TAB
  // =========================================================================
  async function renderExpensesTab(container) {
    const res = await API.callBackend('getExpenses', {}, 'Fetching expenses from database...');
    if (res && res.success && Array.isArray(res.expenses)) {
      cachedExpenses = res.expenses;
    } else {
      cachedExpenses = [];
    }

    const total = cachedExpenses.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
    // Revenue comes from student payments; expenses recorded here are deducted from it.
    let revenueCollected = null;
    const sumRes = await API.callBackend('getFinancialSummary', { academicYear: selectedAcademicYear }, 'Calculating balance...');
    if (sumRes && sumRes.success && sumRes.summary) revenueCollected = toNum(sumRes.summary.totalRevenue);
    const expCur = dashboardCurrency;
    const today = new Date().toISOString().slice(0, 10);
    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row" style="flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div><h3 class="card-title">All Expenses</h3><div style="font-size:13px;color:var(--color-text-muted);">Record and manage every school expense directly in the institutional database. Automatically deducted from Revenue.</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-light" id="downloadExpensesBtn">Download CSV</button>
            <button type="button" class="btn btn-primary" id="addExpenseBtn">+ Add Expense</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px;">
          <div class="stat-card"><div class="stat-label">Total Expenses</div><div class="stat-value" style="color:var(--color-danger);">${moneyLabel(total, expCur)}</div></div>
          ${revenueCollected !== null ? `<div class="stat-card"><div class="stat-label">Revenue Collected</div><div class="stat-value" style="color:var(--color-success);">${moneyLabel(revenueCollected, expCur)}</div></div>
          <div class="stat-card"><div class="stat-label">Net Balance (Revenue − Expenses)</div><div class="stat-value" style="color:${revenueCollected - total >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'};">${moneyLabel(revenueCollected - total, expCur)}</div></div>` : ''}
          <div class="stat-card"><div class="stat-label">Expense Entries</div><div class="stat-value">${cachedExpenses.length}</div></div>
          <div class="stat-card">        </div>
        <div style="overflow:auto;">
          <table class="data-table">
            <thead><tr><th>Number</th><th>Description</th><th>Category</th><th>Quantity</th><th>Amount</th><th>Total</th><th>Date</th><th>Payment Method</th><th>Vendor / Payee</th><th>Reference</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              ${cachedExpenses.length ? cachedExpenses.map((e,i)=>`<tr>
                <td><b>${escapeHtml(e.number || String(i+1).padStart(3,'0'))}</b></td><td>${escapeHtml(e.description||'')}</td><td>${escapeHtml(e.category||'General')}</td>
                <td>${Number(e.quantity||1)}</td><td>$${Number(e.amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td><b style="color:var(--color-danger);">$${Number(e.total||0).toLocaleString(undefined,{minimumFractionDigits:2})}</b></td>
                <td>${escapeHtml(e.date||'')}</td><td>${escapeHtml(e.paymentMethod||'')}</td><td>${escapeHtml(e.vendor||'')}</td><td>${escapeHtml(e.reference||'')}</td><td>${escapeHtml(e.notes||'')}</td>
                <td><button class="btn btn-light btn-sm" onclick="window.AdminPanel.editExpense(${i})">Edit</button> <button class="btn btn-danger btn-sm" onclick="window.AdminPanel.deleteExpense(${i})">Delete</button></td>
              </tr>`).join('') : '<tr><td colspan="12" style="text-align:center;padding:30px;color:#64748b;">No expenses recorded yet in database.</td></tr>'}
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
      <div class="form-group"><label class="form-label">Category</label><select id="exCategory" class="select-field"><option ${e.category==='General'?'selected':''}>General</option><option ${e.category==='Utilities'?'selected':''}>Utilities</option><option ${e.category==='Teaching Materials'?'selected':''}>Teaching Materials</option><option ${e.category==='Maintenance'?'selected':''}>Maintenance</option><option ${e.category==='Transportation'?'selected':''}>Transportation</option><option ${e.category==='Food / Cafeteria'?'selected':''}>Food / Cafeteria</option><option ${e.category==='Salary / Staff'?'selected':''}>Salary / Staff</option><option ${e.category==='Office Supplies'?'selected':''}>Office Supplies</option><option ${e.category==='Other'?'selected':''}>Other</option></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="form-group"><label class="form-label">Quantity</label><input type="number" min="1" id="exQuantity" class="input-field" value="${Number(e.quantity||1)}"></div><div class="form-group"><label class="form-label">Amount (per unit)</label><input type="number" min="0" step="0.01" id="exAmount" class="input-field" value="${Number(e.amount||0)}"></div></div>
      <div class="form-group"><label class="form-label">Date</label><input type="date" id="exDate" class="input-field" value="${escapeHtml(e.date||'')}"></div>
      <div class="form-group"><label class="form-label">Payment Method</label><select id="exPayment" class="select-field"><option ${e.paymentMethod==='Cash'?'selected':''}>Cash</option><option ${e.paymentMethod==='Bank Transfer'?'selected':''}>Bank Transfer</option><option ${e.paymentMethod==='Mobile Money'?'selected':''}>Mobile Money</option><option ${e.paymentMethod==='Cheque'?'selected':''}>Cheque</option><option ${e.paymentMethod==='Card'?'selected':''}>Card</option><option ${e.paymentMethod==='Other'?'selected':''}>Other</option></select></div>
      <div class="form-group"><label class="form-label">Vendor / Payee</label><input id="exVendor" class="input-field" value="${escapeHtml(e.vendor||'')}"></div>
      <div class="form-group"><label class="form-label">Reference / Receipt No.</label><input id="exReference" class="input-field" value="${escapeHtml(e.reference||'')}"></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea id="exNotes" class="input-field" rows="3">${escapeHtml(e.notes||'')}</textarea></div>`,confirmText:index===null?'Save Expense':'Update Expense',onConfirm:async()=>{
        const desc=document.getElementById('exDescription').value.trim();
        if(!desc){
          API.toastNotification('Expense description is required.', true);
          return false;
        }
        const q=Math.max(1,Number(document.getElementById('exQuantity').value)||1);
        const a=Math.max(0,Number(document.getElementById('exAmount').value)||0);
        const item={
          number: document.getElementById('exNumber').value.trim() || String(cachedExpenses.length+1).padStart(3,'0'),
          description: desc,
          category: document.getElementById('exCategory').value,
          quantity: q,
          amount: a,
          total: q * a,
          date: document.getElementById('exDate').value,
          paymentMethod: document.getElementById('exPayment').value,
          vendor: document.getElementById('exVendor').value.trim(),
          reference: document.getElementById('exReference').value.trim(),
          notes: document.getElementById('exNotes').value.trim()
        };

        const res = await API.callBackend('saveExpense', { expense: item }, 'Saving expense to database...');
        if (res && res.success) {
          if (index === null) cachedExpenses.push(item);
          API.toastSuccess('Expense successfully recorded to database.');
          loadTab('expenses');
          return true;
        } else {
          API.toastNotification(res?.message || 'Database rejected expense submission. Check connection or fields.', true);
          return false;
        }
      }});
  }
  function editExpense(i){openExpenseModal(i)}
  async function deleteExpense(i){
    const item = cachedExpenses[i];
    if (!item) return;
    if (!confirm(`Delete expense "${item.description}" (${item.number})?`)) return;
    const res = await API.callBackend('deleteExpense', { number: item.number, id: item.number }, 'Deleting expense from database...');
    if (res && res.success) {
      cachedExpenses.splice(i,1);
      API.toastSuccess('Expense record deleted from database.');
      loadTab('expenses');
    } else {
      API.toastNotification(res?.message || 'Could not delete expense from database.', true);
    }
  }
  function downloadExpenses(){ const headers=['Number','Description','Category','Quantity','Amount','Total','Date','Payment Method','Vendor / Payee','Reference','Notes']; const rows=[headers.join(',')].concat(cachedExpenses.map(e=>[e.number,e.description,e.category,e.quantity,e.amount,e.total,e.date,e.paymentMethod,e.vendor,e.reference,e.notes].map(escapeCsv).map(x=>'"'+x+'"').join(','))); const blob=new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='Sorina_All_Expenses_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(a.href); }

  async function renderAnnouncementsTab(container) {
    const res=await API.callBackend('getAnnouncements',{},'Loading announcements...'); cachedAnnouncements=(res&&res.success&&Array.isArray(res.announcements))?res.announcements:cachedAnnouncements;
    container.innerHTML=`<div class="content-card"><div class="card-header-row" style="margin-bottom:16px;"><div><h3 class="card-title">School Notice & Announcement</h3><div style="font-size:13px;color:var(--color-text-muted);">Publish notices directly to teachers, students, or everyone.</div></div><button class="btn btn-primary" id="newAnnouncementBtn">+ New Announcement</button></div><div>${cachedAnnouncements.length?cachedAnnouncements.map((m,i)=>`<div style="border:1px solid var(--color-border);border-radius:8px;padding:15px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;gap:10px;"><div><b>${escapeHtml(m.subject||'School Announcement')}</b><span class="badge badge-light" style="margin-left:8px;">${escapeHtml(m.audience||'Both')}</span></div><span style="font-size:12px;color:#64748b;">${escapeHtml(m.sentAt||'')}</span></div><p style="margin:8px 0;line-height:1.5;">${escapeHtml(m.body||'')}</p>${m.recipientId?`<div style="font-size:12px;color:#475569;">Recipient ID: <b>${escapeHtml(m.recipientId)}</b></div>`:''}${m.attachmentUrl?`<div style="margin-top:8px;"><a class="btn btn-light btn-sm" href="${escapeHtml(m.attachmentUrl)}" target="_blank">View Attachment${m.attachmentName?' — '+escapeHtml(m.attachmentName):''}</a></div>`:''}<div style="font-size:12px;color:#64748b;">From: ${escapeHtml(m.senderName||'School Administration')} <button class="btn btn-danger btn-sm" style="float:right;" onclick="window.AdminPanel.deleteAnnouncement(${i})">Delete</button></div></div>`).join(''):'<div style="padding:30px;text-align:center;color:#64748b;">No announcements published yet.</div>'}</div></div>`;
    document.getElementById('newAnnouncementBtn').onclick=openAnnouncementModal;
  }
  function openAnnouncementModal(){ App.showModal({title:'Create School Announcement',content:`<div class="form-group"><label class="form-label">Subject *</label><input id="annSubject" class="input-field" placeholder="e.g. Mid-Term Examination Notice"></div><div class="form-group"><label class="form-label">Send To *</label><select id="annAudience" class="select-field"><option value="Both">Teachers & Students</option><option value="Teachers">Teachers Only</option><option value="Students">Students Only</option><option value="Individual">Individual ID</option></select></div><div class="form-group" id="annRecipientWrap" style="display:none"><label class="form-label">Recipient Student/Teacher ID</label><input id="annRecipientId" class="input-field" placeholder="e.g. SJSH001 or SPST001"></div><div class="form-group"><label class="form-label">Announcement *</label><textarea id="annBody" class="input-field" rows="6" placeholder="Write the school notice here..."></textarea></div><div class="form-group"><label class="form-label">Attachment</label><input type="file" id="annAttachment" class="input-field" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"></div>`,confirmText:'Publish Announcement',onConfirm:async()=>{const subject=document.getElementById('annSubject').value.trim(),body=document.getElementById('annBody').value.trim(),audience=document.getElementById('annAudience').value,recipientId=document.getElementById('annRecipientId').value.trim();const file=document.getElementById('annAttachment').files[0];if(!subject||!body){API.toastNotification('Subject and announcement text are required.',true);return;}if(audience==='Individual'&&!recipientId){API.toastNotification('Enter the recipient ID.',true);return;}const attachmentUrl=file?await readFileAsDataUrl(file):'';const item={id:'ANN-'+Date.now(),subject,body,audience:audience==='Individual'?'Individual':audience,recipientId:audience==='Individual'?recipientId:'',attachmentUrl,attachmentName:file?file.name:'',senderName:currentUser.name||'School Administration',sentAt:new Date().toLocaleString()};const r=await API.callBackend('saveAnnouncement',{announcement:item},'Publishing announcement...');if(r&&r.success){cachedAnnouncements=r.announcements||[item,...cachedAnnouncements];API.toastSuccess('Announcement published.');loadTab('announcements')}else API.toastNotification(r.message||'Could not publish announcement.',true);}});setTimeout(()=>{const a=document.getElementById('annAudience');if(a)a.onchange=()=>{document.getElementById('annRecipientWrap').style.display=a.value==='Individual'?'block':'none';};},50); }

  async function deleteAnnouncement(i){const item=cachedAnnouncements[i];if(!item||!confirm('Delete this announcement?'))return;const r=await API.callBackend('deleteAnnouncement',{id:item.id},'Deleting announcement...');if(r&&r.success){cachedAnnouncements.splice(i,1);loadTab('announcements')}}

  // =========================================================================
  // 7. SUBJECTS MANAGEMENT & CURRICULUM CATALOG
  // =========================================================================
  const SUBJECT_LEVEL_GROUPS = [
    { key:'early', label:'Daycare to ABC', levels:['Daycare','Nursery','ABC'] },
    { key:'kindergarten', label:'K1 to K2', levels:['K1','K2'] },
    { key:'primary', label:'Grade 1 to Grade 6', levels:['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
    { key:'secondary', label:'Grade 7 to Grade 12', levels:['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'] }
  ];
  function getSubjectMeta(name){
    return subjectRecords.find(r=>r.name===name)||{name,code:'',category:'',status:'Active',description:''};
  }
  function getActiveCatalogSubjects(){ return getCatalogSubjects(); }
  function subjectLevelCount(name, map){ return GRADE_LEVELS.filter(c=>(map[c]||[]).includes(name)).length; }

  async function renderSubjectsTab(container) {
    await refreshSubjectCatalog();
    const curriculum=curriculumMapCache;
    const activeSubjects=getActiveCatalogSubjects();
    const categories=[...new Set(subjectRecords.map(r=>r.category).filter(Boolean))].sort();
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
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">Total Subjects</div><b style="font-size:21px;">${subjectRecords.length}</b></div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">Active</div><b style="font-size:21px;">${activeSubjects.length}</b></div>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">Assigned</div><b style="font-size:21px;">${activeSubjects.filter(x=>subjectLevelCount(x,curriculum)>0).length}</b></div>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#64748b;">School Levels</div><b style="font-size:21px;">${GRADE_LEVELS.length}</b></div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input id="subjectSearch" class="input-field" style="flex:1;min-width:220px;" placeholder="Search subject name or code...">
          <select id="subjectStatusFilter" class="select-field" style="min-width:145px;"><option value="all">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
          <select id="subjectCategoryFilter" class="select-field" style="min-width:145px;"><option value="all">All Categories</option>${categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
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
      const rows=subjectRecords.filter(m=>{
        const hay=(m.name+' '+(m.code||'')).toLowerCase();
        return (!q||hay.includes(q)) && (st==='all'||m.status===st) && (cat==='all'||m.category===cat);
      }).map(m=>m.name);
      body.innerHTML=rows.length?rows.map(name=>{const m=getSubjectMeta(name), count=subjectLevelCount(name,curriculum); return `<tr>
        <td><input type="checkbox" class="subject-row-check" value="${escapeHtml(name)}"></td>
        <td><b>${escapeHtml(name)}</b>${m.description?`<div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(m.description)}</div>`:''}</td>
        <td>${escapeHtml(m.code||'—')}</td><td>${escapeHtml(m.category||'—')}</td>
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
      <div class="form-group"><label class="form-label">Category</label><input id="newSubCategory" class="input-field" list="subCatList" placeholder="e.g. Literacy" value=""><datalist id="subCatList">${[...new Set(subjectRecords.map(r=>r.category).filter(Boolean))].map(c=>`<option value="${escapeHtml(c)}">`).join('')}</datalist></div>
      <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description</label><textarea id="newSubDesc" class="input-field" rows="2" placeholder="Optional description"></textarea></div>
      <div style="grid-column:1/-1;"><b>Assign immediately to levels</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;margin-top:8px;">${GRADE_LEVELS.map(c=>`<label style="font-size:12px;"><input type="checkbox" class="new-sub-level" value="${escapeHtml(c)}"> ${escapeHtml(c)}</label>`).join('')}</div></div>
    </div>`,confirmText:'Create Subject',onConfirm:async()=>{
      const name=document.getElementById('newSubName').value.trim(), code=document.getElementById('newSubCode').value.trim(), category=document.getElementById('newSubCategory').value.trim(), description=document.getElementById('newSubDesc').value.trim();
      if(!name){API.toastNotification('Subject name is required.',true);return false;}
      if(subjectRecords.some(x=>x.name.toLowerCase()===name.toLowerCase())){API.toastNotification('That subject already exists.',true);return false;}
      const r=await API.callBackend('addSubject',{name,code,category,description},'Creating subject...');
      if(!r||!r.success){API.toastNotification((r&&r.message)||'Could not create subject.',true);return false;}
      const levels=[...document.querySelectorAll('.new-sub-level:checked')].map(x=>x.value);
      if(levels.length){
        const cr=JSON.parse(JSON.stringify(curriculumMapCache||{}));levels.forEach(c=>{cr[c]=Array.from(new Set([...(cr[c]||[]),name]));});
        const r2=await API.callBackend('saveCurriculumSubjects',{curriculum:cr},'Applying subject to levels...');
        if(!r2||!r2.success){API.toastNotification('Subject saved, but level assignment failed: '+((r2&&r2.message)||'unknown error'),true);loadTab('subjects');return;}
      }
      API.toastSuccess('Subject created.');loadTab('subjects');
    }});
  }

  function openEditSubjectModal(oldName){
    const m=getSubjectMeta(oldName);
    App.showModal({title:'Edit Subject',content:`<div class="form-group"><label class="form-label">Subject Name *</label><input id="editSubName" class="input-field" value="${escapeHtml(oldName)}"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="form-group"><label class="form-label">Subject Code</label><input id="editSubCode" class="input-field" value="${escapeHtml(m.code)}"></div><div class="form-group"><label class="form-label">Category</label><input id="editSubCategory" class="input-field" list="subCatList" placeholder="e.g. Literacy" value="${escapeHtml(m.category)}"><datalist id="subCatList">${[...new Set(subjectRecords.map(r=>r.category).filter(Boolean))].map(c=>`<option value="${escapeHtml(c)}">`).join('')}</datalist></div></div><div class="form-group"><label class="form-label">Description</label><textarea id="editSubDesc" class="input-field" rows="2">${escapeHtml(m.description)}</textarea></div>`,confirmText:'Save Changes',onConfirm:async()=>{
      const newName=document.getElementById('editSubName').value.trim();
      if(!newName){API.toastNotification('Subject name is required.',true);return false;}
      if(newName.toLowerCase()!==oldName.toLowerCase()&&subjectRecords.some(x=>x.name.toLowerCase()===newName.toLowerCase())){API.toastNotification('Another subject already uses that name.',true);return false;}
      const r=await API.callBackend('updateSubject',{oldName,newName,code:document.getElementById('editSubCode').value.trim(),category:document.getElementById('editSubCategory').value.trim(),description:document.getElementById('editSubDesc').value.trim()},'Updating subject...');
      if(!r||!r.success){API.toastNotification((r&&r.message)||'Could not update subject.',true);return false;}
      API.toastSuccess('Subject updated.');loadTab('subjects');
    }});
  }

  async function toggleSubjectStatus(name){
    const m=getSubjectMeta(name), next=m.status==='Inactive'?'Active':'Inactive';
    const r=await API.callBackend('updateSubject',{oldName:name,newName:name,status:next},next==='Active'?'Activating subject...':'Deactivating subject...');
    if(!r||!r.success){API.toastNotification((r&&r.message)||'Could not change subject status.',true);return;}
    API.toastSuccess(next==='Active'?'Subject activated.':'Subject deactivated.');loadTab('subjects');
  }

  function levelCheckboxes(selected){return GRADE_LEVELS.map(c=>`<label style="font-size:12px;"><input type="checkbox" class="assign-level" value="${escapeHtml(c)}" ${selected.includes(c)?'checked':''}> ${escapeHtml(c)}</label>`).join('');}
  function openSubjectLevelAssignment(name,map){
    const selected=GRADE_LEVELS.filter(c=>(map[c]||[]).includes(name));
    App.showModal({title:'Assign Subject to School Levels',content:`<div style="margin-bottom:10px;"><b>${escapeHtml(name)}</b><div style="font-size:12px;color:#64748b;">Select every class where this subject should be part of the curriculum.</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;">${levelCheckboxes(selected)}</div>`,confirmText:'Save Level Assignment',onConfirm:async()=>{const chosen=[...document.querySelectorAll('.assign-level:checked')].map(x=>x.value);GRADE_LEVELS.forEach(c=>{const arr=(map[c]||[]).filter(x=>x!==name);if(chosen.includes(c))arr.push(name);map[c]=Array.from(new Set(arr));});const r=await API.callBackend('saveCurriculumSubjects',{curriculum:map},'Saving subject assignments...');if(r&&r.success){API.toastSuccess('Subject assignments saved.');loadTab('subjects')}else API.toastNotification((r&&r.message)||'Could not save assignments.',true);}});
  }
  function openBulkSubjectAssignment(names,map){
    App.showModal({title:'Bulk Assign Subjects to Levels',content:`<div style="margin-bottom:10px;"><b>${names.length} selected subject(s)</b><div style="font-size:12px;color:#64748b;">Choose levels to add these subjects to. Existing assignments are preserved.</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;">${levelCheckboxes([])}</div>`,confirmText:'Apply Assignments',onConfirm:async()=>{const chosen=[...document.querySelectorAll('.assign-level:checked')].map(x=>x.value);if(!chosen.length){API.toastNotification('Select at least one level.',true);return;}chosen.forEach(c=>{map[c]=Array.from(new Set([...(map[c]||[]),...names]));});const r=await API.callBackend('saveCurriculumSubjects',{curriculum:map},'Applying bulk assignments...');if(r&&r.success){API.toastSuccess('Bulk curriculum assignment completed.');loadTab('subjects')}else API.toastNotification((r&&r.message)||'Could not apply assignments.',true);}});
  }

  async function deleteSubject(subjectName){
    if(!confirm(`Delete subject "${subjectName}"? It will also be removed from class subject assignments.`)) return;
    const res=await API.callBackend('deleteSubject',{subject:subjectName,subjectName:subjectName},'Deleting subject...');
    if(res&&res.success){API.toastSuccess('Subject deleted.');loadTab('subjects');}else API.toastNotification((res&&res.message)||'Could not delete subject.',true);
  }

  async function renderCurriculumSubjectsTab(container){
    // Keep the existing navigation entry, but use the same redesigned catalog manager.
    await renderSubjectsTab(container);
  }

  async function renderAdminGradeEntryTab(container) {
    const stRes = await API.callBackend('getAllStudents', { academicYear: selectedAcademicYear }, 'Loading academic roster...');
    cachedStudents = (stRes && stRes.success ? stRes.students : []);
    await refreshSubjectCatalog();
    const allSubjects = getCatalogSubjects();
    const permRes = await API.callBackend('getPermissions', {});
    const periodOpenMap = (permRes && permRes.success && permRes.permissions) ? permRes.permissions : {};
    const isPeriodLocked = (k) => currentUser.role !== 'superadmin' && periodOpenMap[k] !== true;
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
          <table class="data-table" style="min-width:1180px;"><thead style="position:sticky;top:0;z-index:2;background:#f8fafc;"><tr><th style="min-width:220px;">Student</th>${periods.map(p=>`<th style="min-width:105px;text-align:center;">${escapeHtml(p.label)}<div style="font-size:10px;font-weight:700;color:${isPeriodLocked(p.key)?'#b45309':'#15803d'};">${isPeriodLocked(p.key)?'Locked &bull; view only':'Open &bull; editable'}</div></th>`).join('')}<th>Status</th></tr></thead><tbody id="agBody"></tbody></table>
        </div>
        <div style="padding:12px 22px;border-top:1px solid var(--color-border);background:#fff;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;"><div><b>Grade Activity Log</b><div style="font-size:12px;color:#64748b;">Recent admin and teacher grade submissions for ${escapeHtml(selectedAcademicYear)}.</div></div><button type="button" class="btn btn-light btn-sm" id="agLogRefresh">Refresh Log</button></div>
        <div id="agLog" style="padding:0 22px 16px;max-height:220px;overflow:auto;"></div>
      </div>`;

    let currentStudents=[];
    const scoreKeys=periods.map(p=>p.key);
    function subjectOptionsForClass(cls){
      const assigned=selectedCurriculumForClass(cls);
      return Array.isArray(assigned)?assigned.filter(Boolean):[];
    }
    function refreshSubjects(preferred){
      const cls=document.getElementById('agClass').value;
      const list=subjectOptionsForClass(cls);
      const el=document.getElementById('agSubject');
      el.innerHTML=list.length?list.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join(''):'<option value="">No subjects assigned</option>';
      if(preferred&&list.includes(preferred))el.value=preferred;
    }
    function any(rec){return scoreKeys.some(k=>String(rec[k]??'').trim()!=='');}
    function complete(rec){return scoreKeys.every(k=>String(rec[k]??'').trim()!=='');}
    function valid(v){return v===''||(Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100);}
    function statusOf(rec){if(rec.status==='submitted')return 'submitted'; if(complete(rec))return 'complete'; return any(rec)?'incomplete':'notstarted';}
    function updateSummary(){const rows=[...document.querySelectorAll('#agBody tr[data-id]')];let c=0,m=0,s=0,d=0;rows.forEach(tr=>{const r={};tr.querySelectorAll('.ag-score').forEach(i=>r[i.dataset.p]=i.value.trim());const st=statusOf(r);if(st==='complete'||st==='submitted')c++;if(st==='incomplete'||st==='notstarted')m++;if(tr.dataset.originalStatus==='submitted'||st==='submitted')s++;if(tr.dataset.dirty==='1')d++;});document.getElementById('agTotal').textContent=rows.length;document.getElementById('agComplete').textContent=c;document.getElementById('agMissing').textContent=m;document.getElementById('agSubmitted').textContent=s;document.getElementById('agDirty').textContent=d;}
    function draw(){
      const subject=document.getElementById('agSubject').value,q=document.getElementById('agSearch').value.trim().toLowerCase(),view=document.getElementById('agView').value;
      if(!subject){
        document.getElementById('agBody').innerHTML='<tr><td colspan="10" style="text-align:center;padding:30px;color:#64748b;">No subjects in curriculum for this class. Add subjects in Settings &rarr; Curriculum first.</td></tr>';
        updateSummary();
        return;
      }
      const filtered=currentStudents.filter(st=>{const rec=st.scores||{},stt=st.status||statusOf(rec);const match=!q||String(st.studentName||'').toLowerCase().includes(q)||String(st.studentId||'').toLowerCase().includes(q);const mode=view==='all'||(view==='complete'&&(stt==='complete'||stt==='submitted'))||(view==='incomplete'&&(stt==='incomplete'||stt==='notstarted'))||(view==='submitted'&&stt==='submitted');return match&&mode;});
      const body=document.getElementById('agBody');
      body.innerHTML=filtered.map(st=>{
        const rec=st.scores||{},stt=st.status||statusOf(rec),version=st.version||1;
        const badge=stt==='submitted'?'<span class="badge badge-success">Submitted</span>':stt==='complete'?'<span class="badge badge-info">Complete</span>':stt==='incomplete'?'<span class="badge badge-warning">In Progress</span>':'<span class="badge badge-light">Not Started</span>';
        return `<tr data-id="${escapeHtml(st.studentId)}" data-version="${version}" data-dirty="0" data-original-status="${escapeHtml(stt)}"><td><div style="font-weight:700;">${escapeHtml(st.studentName||'Unnamed Student')}</div><div style="font-size:11px;color:#64748b;">${escapeHtml(st.studentId)}</div></td>${scoreKeys.map(k=>{const val=(rec[k]!==null&&rec[k]!==undefined&&rec[k]!=='')?String(rec[k]):'';return `<td style="text-align:center;"><input type="number" min="0" max="100" step="0.01" class="input-field ag-score" ${isPeriodLocked(k)?'disabled title="Period closed by the Super Administrator"':''} data-p="${k}" data-original-val="${escapeHtml(val)}" value="${escapeHtml(val)}" style="width:82px;text-align:center;margin:auto;"></td>`;}).join('')}<td class="ag-status" style="font-size:12px;font-weight:700;">${badge}</td></tr>`;
      }).join('')||'<tr><td colspan="10" style="text-align:center;padding:30px;color:#64748b;">No students match the current filters.</td></tr>';
      document.querySelectorAll('.ag-score').forEach(input=>{input.addEventListener('input',()=>{const tr=input.closest('tr');if(!valid(input.value)){input.setCustomValidity('Enter a score from 0 to 100.');input.style.borderColor='#dc2626';}else{input.setCustomValidity('');input.style.borderColor='';}tr.dataset.dirty='1';const r={};tr.querySelectorAll('.ag-score').forEach(i=>r[i.dataset.p]=i.value.trim());const st=statusOf(r);tr.querySelector('.ag-status').innerHTML=st==='submitted'?'<span class="badge badge-success">Ready to Submit</span>':complete(r)?'<span class="badge badge-info">Complete</span>':any(r)?'<span class="badge badge-warning">In Progress</span>':'<span class="badge badge-light">Not Started</span>';updateSummary();});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const a=[...document.querySelectorAll('.ag-score')],i=a.indexOf(input);if(a[i+1])a[i+1].focus();}});});
      updateSummary();
    }
    async function loadClass(){
      const cls=document.getElementById('agClass').value;
      refreshSubjects();
      const subject=document.getElementById('agSubject').value;
      if(!subject){currentStudents=[];draw();await loadLog();return;}
      const r=await API.callBackend('getClassGradeSheet',{className:cls,subject:subject,academicYear:selectedAcademicYear},'Loading class grade sheet...');
      currentStudents=(r&&r.success&&Array.isArray(r.sheet))?r.sheet:[];
      draw();
      await loadLog();
    }
    async function loadLog(){const r=await API.callBackend('getGradeActivityLog',{academicYear:selectedAcademicYear});const logs=r&&r.success?r.logs:[];const el=document.getElementById('agLog');el.innerHTML=logs.length?`<div style="display:grid;gap:6px;margin-top:9px;">${logs.slice(0,12).map(x=>`<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span><b>${escapeHtml(x.action||'Grade activity')}</b> &mdash; ${escapeHtml(x.className||'')} / ${escapeHtml(x.subject||'')} (${escapeHtml(String(x.studentCount||0))} students)</span><span style="color:#64748b;">${escapeHtml(x.actorName||'Administrator')} &bull; ${escapeHtml(x.status||'')} &bull; ${escapeHtml(x.timestamp||'')}</span></div>`).join('')}</div>`:'<div style="padding:12px 0;color:#64748b;font-size:12px;">No grade activity recorded yet.</div>';}
    async function saveGrades(mode){
      const cls=document.getElementById('agClass').value;
      const subject=document.getElementById('agSubject').value;
      if(!subject){API.toastNotification('No subject selected.',true);return;}
      const rows=[...document.querySelectorAll('#agBody tr[data-id]')];
      const grades=[];
      let invalid=false,incomplete=false;
      rows.forEach(tr=>{
        const sId=tr.dataset.id;
        const baseVersion=Number(tr.dataset.version)||1;
        const changes={};
        let hasChanges=false;
        const allCurrent={};
        tr.querySelectorAll('.ag-score').forEach(i=>{
          const v=i.value.trim();
          if(!valid(v)){invalid=true;i.focus();}
          const orig=i.dataset.originalVal||'';
          if(v!==orig){changes[i.dataset.p]=v===''? '':v;hasChanges=true;}
          allCurrent[i.dataset.p]=v;
        });
        if(!complete(allCurrent))incomplete=true;
        if(hasChanges){
          grades.push({studentId:sId,baseVersion:baseVersion,changes:changes});
        }
      });
      if(invalid){API.toastNotification('Correct scores outside the 0–100 range before saving.',true);return;}
      if(!grades.length){API.toastNotification('No unsaved grade changes on this screen.');return;}
      if(mode==='submitted'&&incomplete&&!confirm('Some selected students do not have all grading periods completed. Submit these grades anyway?'))return;
      const r=await API.callBackend('teacherSubmitGrades',{teacherId:currentUser.id,actorRole:'admin',actorName:currentUser.name||'Administrator',className:cls,subject:subject,academicYear:selectedAcademicYear,gradeStatus:mode,grades:grades},mode==='submitted'?'Submitting official grades...':'Saving grade draft...');
      if(r&&r.conflict){
        API.toastNotification(r.message||'Another user modified this grade sheet. Reloading latest grades...',true);
        await loadClass();
        return;
      }
      if(r&&r.success){API.toastSuccess(r.message||'Grades saved.');await loadClass();}
      else API.toastNotification((r&&r.message)||'Unable to save grades.',true);
    }
    document.getElementById('agClass').onchange=loadClass;document.getElementById('agSubject').onchange=loadClass;document.getElementById('agSearch').oninput=draw;document.getElementById('agView').onchange=draw;document.getElementById('agReset').onclick=()=>{if(confirm('Discard unsaved changes?'))draw();};document.getElementById('agDraft').onclick=()=>saveGrades('draft');document.getElementById('agSubmit').onclick=()=>saveGrades('submitted');document.getElementById('agLogRefresh').onclick=loadLog;
    await loadClass();
  }

  async function renderAdminLessonPlansTab(container) {
    const res=await API.callBackend('getLessonPlans',{filters:{academicYear:selectedAcademicYear}},'Loading teacher lesson plans...');
    const plans=(res&&res.success&&(res.plans||res.lessonPlans))||[]; if(!(res&&res.success))API.toastNotification((res&&res.message)||'Could not load lesson plans from the database.',true); const pending=plans.filter(p=>(p.status||'pending')==='pending').length;
    container.innerHTML=`<div class="content-card"><div class="card-header-row"><div><h3 class="card-title">Teacher Lesson Plan Inbox</h3><div style="font-size:13px;color:var(--color-text-muted);">All lesson plans submitted by teachers appear here for administrative review, approval or return for revision.</div></div><span class="badge ${pending?'badge-warning':'badge-success'}">${pending} Pending Review</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:15px 0;"><div class="content-card" style="padding:11px;margin:0;"><small>Total Submitted</small><div style="font-size:21px;font-weight:800;">${plans.length}</div></div><div class="content-card" style="padding:11px;margin:0;"><small>Pending</small><div style="font-size:21px;font-weight:800;">${pending}</div></div><div class="content-card" style="padding:11px;margin:0;"><small>Approved</small><div style="font-size:21px;font-weight:800;">${plans.filter(p=>p.status==='approved').length}</div></div><div class="content-card" style="padding:11px;margin:0;"><small>Revision Needed</small><div style="font-size:21px;font-weight:800;">${plans.filter(p=>p.status==='revision').length}</div></div></div>
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Lesson</th><th>Teacher</th><th>Class</th><th>Subject</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${plans.length?plans.map(p=>`<tr><td><b>${escapeHtml(p.title||'Untitled Lesson')}</b><div style="font-size:11px;color:#64748b;">${escapeHtml((p.details||'').slice(0,100))}${(p.details||'').length>100?'…':''}</div></td><td>${escapeHtml(p.teacherName||p.teacherId||'')}</td><td>${escapeHtml(p.class||p.className||'')}</td><td>${escapeHtml(p.subject||'')}</td><td>${escapeHtml(p.submittedAt||'')}</td><td>${p.status==='approved'?'<span class="badge badge-success">Approved</span>':p.status==='revision'?'<span class="badge badge-warning">Revision</span>':'<span class="badge badge-info">Pending</span>'}</td><td><button type="button" class="btn btn-light btn-sm lp-review" data-id="${escapeHtml(p.id)}">Review</button></td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748b;">No teacher lesson plans have been submitted for this academic year.</td></tr>'}</tbody></table></div></div>`;
    document.querySelectorAll('.lp-review').forEach(btn=>btn.onclick=()=>{
      const p=plans.find(x=>String(x.id)===String(btn.dataset.id)); if(!p)return;
      App.showModal({title:'Review Teacher Lesson Plan',content:`<div style="font-size:13px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;"><div><b>Teacher</b><br>${escapeHtml(p.teacherName||p.teacherId||'')}</div><div><b>Class / Subject</b><br>${escapeHtml(p.class||p.className||'')} &bull; ${escapeHtml(p.subject||'')}</div></div><div style="padding:12px;background:#f8fafc;border-radius:8px;"><b>${escapeHtml(p.title||'Untitled Lesson')}</b><p style="white-space:pre-wrap;margin:8px 0 0;">${escapeHtml(p.details||'No lesson details supplied.')}</p></div>${p.attachmentUrl?`<div style="margin-top:12px;"><a class="btn btn-light btn-sm" href="${p.attachmentUrl}" target="_blank">Open Attachment: ${escapeHtml(p.attachmentName||'Lesson Plan File')}</a></div>`:''}<div class="form-group" style="margin-top:12px;"><label class="form-label">Decision</label><select id="lpReviewDecision" class="select-field"><option value="approved">Approve Lesson Plan</option><option value="revision">Return for Revision</option></select></div><div class="form-group"><label class="form-label">Admin Review Comment</label><textarea id="lpReviewComment" class="textarea-field" rows="3" placeholder="Add approval note or revision instructions..."></textarea></div></div>`,confirmText:p.status==='approved'?'Close':'Submit Review',onConfirm:async()=>{if(p.status==='approved')return;const decision=document.getElementById('lpReviewDecision').value;const c=document.getElementById('lpReviewComment').value.trim();if(decision==='revision'&&!c){API.toastNotification('Please enter the revision instructions for the teacher.',true);return false;}const rr=await API.callBackend('reviewLessonPlan',{id:p.id,status:decision,comment:c,reviewedBy:currentUser.name||'Administrator'},decision==='approved'?'Approving lesson plan...':'Returning lesson plan...');if(rr&&rr.success){API.toastSuccess(rr.message);await renderAdminLessonPlansTab(container);}else API.toastNotification((rr&&rr.message)||'Unable to review lesson plan.',true);}});
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

    // Expenses Module
    { key: 'expenses:view', label: 'All Expenses (View)', desc: 'View all school expense records', group: 'Expenses' },
    { key: 'expenses:edit', label: 'All Expenses (Manage/Edit)', desc: 'Add and edit expense records (salaries included)', group: 'Expenses' },
    { key: 'expenses:delete', label: 'All Expenses (Delete)', desc: 'Delete expense records', group: 'Expenses' },

    // Curriculum Module
    { key: 'subjects:view', label: 'Subjects Catalog (View)', desc: 'Browse official school curriculum subjects', group: 'Curriculum' },
    { key: 'subjects:edit', label: 'Subjects Catalog (Manage/Edit)', desc: 'Add new subjects, edit codes and department names', group: 'Curriculum' },
    { key: 'subjects:delete', label: 'Subjects Catalog (Delete)', desc: 'Remove subjects from curriculum catalog', group: 'Curriculum' },

    // Academics Module
    { key: 'scores:view', label: 'Grading Controls (View)', desc: 'View student grade sheets, periodic marks & report cards', group: 'Academics' },
    { key: 'scores:edit', label: 'Grading Controls (Manage/Edit)', desc: 'Lock/unlock grading periods and override periodic scores', group: 'Academics' },


    // System Operations
    { key: 'summary:view', label: 'Executive Summary (View)', desc: 'Access administrative KPIs, enrollment charts & revenue metrics', group: 'System' },
    { key: 'messaging:view', label: 'Announcements (View)', desc: 'View school notices and broadcasts', group: 'Communication' },
    { key: 'messaging:send', label: 'Announcements (Broadcast)', desc: 'Broadcast notices to students, parents, and faculty', group: 'Communication' },
    { key: 'lesson_plans:view', label: 'Lesson Plans (Inspect)', desc: 'Review and evaluate submitted teacher lesson plans', group: 'Academics' },
    { key: 'export:view', label: 'Export Records (Download)', desc: 'Download CSV archives of rosters, ledger & expenses', group: 'System' },
    { key: 'settings:edit', label: 'School Settings (Manage)', desc: 'Update school branding, contacts, motto & academic year', group: 'System' },
    { key: 'audit:view', label: 'Security Audit Log (View)', desc: 'Inspect system access logs, authentication & audit trail', group: 'Security' }
  ];

  const ROLE_PRESETS = {
    'custom': { name: 'Other Staff — Manually Selected Responsibilities', perms: [] },
    'registrar': {
      name: 'School Registrar',
      perms: ['summary:view', 'students:view', 'students:edit', 'students:delete', 'finance:view', 'finance:edit', 'finance:delete', 'expenses:view', 'expenses:edit', 'expenses:delete', 'messaging:view', 'messaging:send', 'settings:edit', 'export:view']
    },
    'vpi': {
      name: 'Vice Principal for Instruction (VPI)',
      perms: ['summary:view', 'teachers:view', 'teachers:edit', 'subjects:view', 'subjects:edit', 'subjects:delete', 'scores:view', 'scores:edit', 'lesson_plans:view', 'messaging:view', 'messaging:send', 'settings:edit', 'export:view']
    },
    'bursar': {
      name: 'Bursar / Financial Officer',
      perms: ['finance:view', 'finance:edit', 'expenses:view', 'expenses:edit', 'summary:view', 'export:view']
    },
    'principal': {
      name: 'Academic Dean / Principal',
      perms: ['summary:view', 'students:view', 'teachers:view', 'teachers:edit', 'scores:view', 'scores:edit', 'subjects:view', 'subjects:edit', 'messaging:view', 'messaging:send', 'export:view', 'lesson_plans:view']
    },
    'auditor': {
      name: 'Staff Auditor (View Only)',
      perms: ['summary:view', 'students:view', 'teachers:view', 'finance:view', 'expenses:view', 'audit:view', 'export:view']
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
    const res = await API.callBackend('getReportCard', { studentId: studentId, academicYear: selectedAcademicYear }, 'Loading report card...');
    if (res && res.success && res.reportCard) {
      App.showModal({
        title: `Official Report Card Preview: ${escapeHtml(res.reportCard.student?.name || studentId)} (${escapeHtml(selectedAcademicYear)})`,
        content: `
          <div class="no-print" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; padding: 10px 14px; border-radius: 6px; border: 1px solid #86efac;">
            <span style="font-size: 13px; color: #166534; font-weight: 600;">Two-Page Official Report Card Preview (${escapeHtml(selectedAcademicYear)})</span>
            <button type="button" class="btn btn-primary btn-sm" id="modalPrintReportCardBtn" style="display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Official Report Card
            </button>
          </div>
          <div id="adminRcMount" style="max-height: 75vh; overflow-y: auto; background: #e2e8f0; padding: 12px; border-radius: 8px;"></div>
        `,
        confirmText: 'Print',
        cancelText: 'Close',
        onConfirm: () => {
          window.print();
          return false;
        }
      });

      // Render the comprehensive two-page report card
      ReportCard.render(res.reportCard, '#adminRcMount');

      // Make modal dialog wide for report preview
      const activeOverlay = document.querySelector('#modalContainer .modal-overlay:last-child');
      if (activeOverlay) activeOverlay.classList.add('modal-preview');

      setTimeout(() => {
        const pBtn = document.getElementById('modalPrintReportCardBtn');
        if (pBtn) pBtn.onclick = () => window.print();
      }, 60);
    } else {
      API.toastNotification((res && res.message) || 'Unable to generate report card preview for this student.', true);
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
