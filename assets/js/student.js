/**
 * student.js
 * -----------------------------------------------------------------------
 * Student Portal Module
 * 
 * Features:
 * - Collapsible royal blue left sidebar navigation matching official theme.
 * - Two-sided booklet report card with academic year selector for returning students.
 * - Financial statement with Print and Download actions.
 * - Messages & Notices tab.
 * - Comprehensive Settings tab (profile photo, display name, contact, password, PWA install).
 * - Replaces all emojis with standard PNG icons from assets/icons/.
 * -----------------------------------------------------------------------
 */

window.StudentPanel = (function () {
  let currentStudent = null;
  let currentTab = 'reportCard';
  let selectedAcademicYear = '2026-2027';
  let isSidebarCollapsed = false;

  async function mount(container, user) {
    currentStudent = user;
    currentTab = 'reportCard';
    selectedAcademicYear = user.academicYear || '2026-2027';

    // Fetch freshest student profile
    const res = await API.callBackend('getStudentById', { studentId: user.id }, 'Loading profile...');
    if (res && res.success && res.student) {
      currentStudent = Object.assign({}, user, res.student);
    }

    renderPortalLayout(container);
    await loadTab(currentTab);
  }

  function renderPortalLayout(container) {
    container.innerHTML = `
      <div class="portal-layout">
        <!-- Collapsible Royal Blue Sidebar -->
        <aside class="portal-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}" id="studentSidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand-title">Student Portal</div>
            <button class="sidebar-toggle-btn" id="sidebarToggleBtn" type="button" title="Toggle Navigation">
              <img src="assets/icons/text-align-justify.png" alt="Toggle">
            </button>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-title">Academic &amp; Records</div>
            
            <a class="sidebar-item ${currentTab === 'reportCard' ? 'active' : ''}" data-tab="reportCard">
              <img src="assets/icons/file-text.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Report Card</span>
            </a>

            <a class="sidebar-item ${currentTab === 'finance' ? 'active' : ''}" data-tab="finance">
              <img src="assets/icons/landmark.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Financial Statement</span>
            </a>

            <div class="nav-section-title">Communication</div>

            <a class="sidebar-item ${currentTab === 'messages' ? 'active' : ''}" data-tab="messages">
              <img src="assets/icons/mail-open.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">School Notices</span>
            </a>

            <div class="nav-section-title">Account</div>

            <a class="sidebar-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
              <img src="assets/icons/monitor-cog.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Settings</span>
            </a>

            <a class="sidebar-item" id="studentLogoutBtn">
              <img src="assets/icons/log-out.png" class="sidebar-icon" alt="">
              <span class="sidebar-item-label">Sign Out</span>
            </a>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="portal-content">
          <!-- Student Overview Banner -->
          <div class="content-card" style="margin-bottom: 20px;">
            <div style="display: flex; gap: 18px; align-items: center; flex-wrap: wrap;">
              <div style="width: 64px; height: 64px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid var(--color-primary); flex-shrink: 0;">
                ${currentStudent.photo ? `<img src="${currentStudent.photo}" style="width: 100%; height: 100%; object-fit: cover;">` : `<img src="assets/icons/circle-user-round.png" style="width: 38px; height: 38px;">`}
              </div>
              <div style="flex: 1; min-width: 220px;">
                <h2 style="margin: 0 0 4px; color: var(--color-primary); font-size: 20px;">
                  ${escapeHtml(currentStudent.name)}
                </h2>
                <div style="font-size: 13.5px; color: var(--color-text-muted);">
                  Student ID: <b>[${escapeHtml(currentStudent.id)}]</b> &bull; Class: <b>${escapeHtml(currentStudent.className || currentStudent.grade)}</b>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
                  <span class="badge ${currentStudent.status === 'Active' ? 'badge-success' : 'badge-danger'}">
                    ${escapeHtml(currentStudent.status || 'Active')}
                  </span>
                  <span class="badge badge-light">
                    Category: ${currentStudent.studentCategory === 'old' ? 'Returning Student' : 'New Enrollee'}
                  </span>
                  ${currentStudent.gradeLocked ? `<span class="badge badge-warning">Clearance Required</span>` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Active Tab Body -->
          <div id="studentTabContainer"></div>
        </main>
      </div>
    `;

    // Sidebar Toggle
    const sidebar = document.getElementById('studentSidebar');
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
    const logoutBtn = document.getElementById('studentLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.Auth) window.Auth.logout();
      });
    }
  }

  async function loadTab(tab) {
    const container = document.getElementById('studentTabContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-text-muted);">Loading...</div>';

    switch (tab) {
      case 'reportCard':
        await renderReportCardTab(container);
        break;
      case 'finance':
        await renderFinanceTab(container);
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
  // 1. REPORT CARD WITH ACADEMIC YEAR SELECTOR
  // =========================================================================
  async function renderReportCardTab(container) {
    if (currentStudent.gradeLocked) {
      container.innerHTML = `
        <div class="content-card" style="text-align: center; padding: 48px 20px;">
          <img src="assets/icons/landmark.png" style="width: 48px; height: 48px; opacity: 0.6; margin-bottom: 12px;" alt="">
          <h3 style="color: var(--color-warning); margin: 0 0 10px;">Grade Sheet Clearance Required</h3>
          <p style="max-width: 520px; margin: 0 auto 20px; font-size: 14px; color: var(--color-text-muted); line-height: 1.6;">
            Your academic report card has been withheld by the school administration pending administrative or financial clearance. Please visit the school business office.
          </p>
          <button class="btn btn-primary" id="gotoFinanceBtn">View Financial Statement</button>
        </div>
      `;
      const btn = document.getElementById('gotoFinanceBtn');
      if (btn) btn.onclick = () => switchTab('finance');
      return;
    }

    // Available Academic Years for selection
    const years = ['2026-2027', '2025-2026', '2024-2025'];
    if (currentStudent.years) {
      Object.keys(currentStudent.years).forEach(y => {
        if (!years.includes(y)) years.push(y);
      });
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;" class="no-print">
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="font-size: 13.5px; font-weight: 600; color: var(--color-primary);" for="academicYearSelect">Academic Year Record:</label>
          <select id="academicYearSelect" class="select-field" style="width: 160px; padding: 6px 10px;">
            ${years.map(y => `<option value="${y}" ${y === selectedAcademicYear ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="reportCardMountPoint"></div>
    `;

    const selectEl = document.getElementById('academicYearSelect');
    if (selectEl) {
      selectEl.addEventListener('change', async (e) => {
        selectedAcademicYear = e.target.value;
        await fetchAndRenderReportCard();
      });
    }

    await fetchAndRenderReportCard();
  }

  async function fetchAndRenderReportCard() {
    const mount = document.getElementById('reportCardMountPoint');
    if (!mount) return;
    mount.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--color-text-muted);">Fetching academic evaluations...</div>';

    const res = await API.callBackend('getReportCard', {
      studentId: currentStudent.id,
      academicYear: selectedAcademicYear
    }, 'Loading report card...');

    if (res && res.success && res.reportCard) {
      ReportCard.render(res.reportCard, mount);
    } else {
      mount.innerHTML = `
        <div class="content-card" style="text-align: center; padding: 36px;">
          <p style="color: var(--color-text-muted); font-size: 14px;">No report card records filed for academic year ${selectedAcademicYear}.</p>
        </div>
      `;
    }
  }

  // =========================================================================
  // 2. FINANCIAL STATEMENT WITH PRINT & DOWNLOAD
  // =========================================================================
  async function renderFinanceTab(container) {
    const res = await API.callBackend('getStudentFinance', { studentId: currentStudent.id }, 'Fetching fee statement...');
    const f = (res && res.success && res.finance) ? res.finance : (currentStudent.finance || {});
    const inst = f.installments || [0, 0, 0, 0];
    const currency = f.currency || 'USD';

    container.innerHTML = `
      <!-- Action Toolbar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;" class="no-print">
        <h3 style="margin: 0; color: var(--color-primary); font-size: 18px;">Official Tuition &amp; Fee Statement</h3>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-light" id="printFinanceBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/file-text.png" style="width: 15px; height: 15px;" alt="">
            Print Statement
          </button>
          <button type="button" class="btn btn-primary" id="downloadFinanceBtn" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/download (2).png" style="width: 15px; height: 15px; filter: brightness(0) invert(1);" alt="">
            Download PDF
          </button>
        </div>
      </div>

      <!-- Printable Statement Area -->
      <div id="printableFinanceStatement" class="content-card">
        <div style="border-bottom: 2px solid var(--color-primary); padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0; color: var(--color-primary); font-size: 19px;">IE SCHOOL MANAGEMENT SYSTEM</h2>
            <div style="font-size: 12.5px; color: var(--color-text-muted);">Official Student Account Financial Statement</div>
          </div>
          <div style="text-align: right; font-size: 12.5px;">
            <div><b>Date:</b> ${new Date().toLocaleDateString()}</div>
            <div><b>Status:</b> ${f.balance > 0 ? '<span class="score-red">Balance Due</span>' : '<span class="score-green">Cleared</span>'}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; font-size: 13.5px;">
          <div><b>Student Name:</b> ${escapeHtml(currentStudent.name)}</div>
          <div><b>Student ID:</b> [${escapeHtml(currentStudent.id)}]</div>
          <div><b>Class:</b> ${escapeHtml(currentStudent.className || currentStudent.grade)}</div>
          <div><b>Academic Year:</b> ${escapeHtml(currentStudent.academicYear || '2026-2027')}</div>
        </div>

        <div class="stats-grid" style="margin-bottom: 24px;">
          <div class="stat-card">
            <div class="stat-label">Total Tuition &amp; Fees Billed</div>
            <div class="stat-value">${currency} ${(f.tuitionTotal || 0).toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Amount Paid</div>
            <div class="stat-value" style="color: var(--color-success);">${currency} ${(f.totalPaid || 0).toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Remaining Balance</div>
            <div class="stat-value" style="color: ${(f.balance || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
              ${currency} ${(f.balance || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <h4 style="margin: 0 0 10px; color: var(--color-primary); font-size: 14.5px;">Payment Schedule Breakdown</h4>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Schedule Item</th>
                <th>Amount Billed</th>
                <th>Amount Paid / Recorded</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Registration Fee</td>
                <td>${currency} ${f.registrationFee || 0}</td>
                <td>${currency} ${f.registrationPaid ? (f.registrationFee || 0) : 0}</td>
                <td>${f.registrationPaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Unpaid</span>'}</td>
              </tr>
              <tr>
                <td>1st Installment</td>
                <td>${currency} ${(f.tuitionTotal || 0) / 4}</td>
                <td>${currency} ${inst[0] || 0}</td>
                <td>${inst[0] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              <tr>
                <td>2nd Installment</td>
                <td>${currency} ${(f.tuitionTotal || 0) / 4}</td>
                <td>${currency} ${inst[1] || 0}</td>
                <td>${inst[1] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              <tr>
                <td>3rd Installment</td>
                <td>${currency} ${(f.tuitionTotal || 0) / 4}</td>
                <td>${currency} ${inst[2] || 0}</td>
                <td>${inst[2] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              <tr>
                <td>4th Installment</td>
                <td>${currency} ${(f.tuitionTotal || 0) / 4}</td>
                <td>${currency} ${inst[3] || 0}</td>
                <td>${inst[3] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-muted);">
          <div>School Business Office Registrar Signature: _________________________</div>
          <div>Official Seal</div>
        </div>
      </div>
    `;

    document.getElementById('printFinanceBtn').onclick = () => window.print();
    document.getElementById('downloadFinanceBtn').onclick = () => window.print();
  }

  // =========================================================================
  // 3. MESSAGES TAB
  // =========================================================================
  async function renderMessagesTab(container) {
    const res = await API.callBackend('getMessages', {}, 'Fetching notices...');
    const messages = (res && res.success && Array.isArray(res.messages)) ? res.messages : [];

    container.innerHTML = `
      <div class="content-card">
        <h3 class="card-title" style="margin-bottom: 16px;">School Announcements &amp; Notices</h3>
        ${messages.length === 0 ? `
          <div style="text-align: center; padding: 30px; color: var(--color-text-muted); font-size: 14px;">
            No announcements broadcasted at this time.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${messages.map(m => `
              <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 18px; background: var(--color-surface);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="color: var(--color-primary); font-size: 15px;">${escapeHtml(m.subject || 'Announcement')}</strong>
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
  // 4. SETTINGS TAB (Profile photo, display name, password, PWA install)
  // =========================================================================
  function renderSettingsTab(container) {
    container.innerHTML = `
      <div style="max-width: 600px;">
        <div class="content-card" style="margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Profile &amp; Contact Information</h3>
          
          <div class="form-group">
            <label class="form-label">Display Name</label>
            <input type="text" class="input-field" value="${escapeHtml(currentStudent.name)}" disabled>
          </div>

          <div class="form-group">
            <label class="form-label">Student ID</label>
            <input type="text" class="input-field" value="${escapeHtml(currentStudent.id)}" disabled>
          </div>

          <div class="form-group">
            <label class="form-label">Parent / Guardian Contact Phone</label>
            <input type="text" id="settingPhone" class="input-field" value="${escapeHtml(currentStudent.phone || '')}" placeholder="+231-...">
          </div>

          <div class="form-group">
            <label class="form-label">Profile Photo (Upload / Take Photo)</label>
            <input type="file" id="settingPhotoInput" class="input-field" accept="image/*">
          </div>

          <button type="button" class="btn btn-primary" id="saveContactBtn">Update Profile Details</button>
        </div>

        <div class="content-card" style="margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Security &amp; Password</h3>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" id="studentNewPassword" class="input-field" placeholder="Enter new password (min. 4 characters)">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input type="password" id="studentConfirmPassword" class="input-field" placeholder="Confirm new password">
          </div>
          <button type="button" class="btn btn-primary" id="changePasswordBtn">Change Password</button>
        </div>

        <div class="content-card">
          <h3 class="card-title" style="margin-bottom: 12px;">Mobile Application (PWA)</h3>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 14px;">
            Install the IE School Management System app directly on your phone or tablet for fast offline access.
          </p>
          <button type="button" class="btn btn-light" id="studentPwaBtn" style="display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/download (2).png" style="width: 16px; height: 16px;" alt="">
            Install App to Device
          </button>
        </div>
      </div>
    `;

    document.getElementById('saveContactBtn').onclick = async () => {
      const phone = document.getElementById('settingPhone').value.trim();
      const photoFile = document.getElementById('settingPhotoInput').files[0];

      let photoBase64 = currentStudent.photo || '';
      if (photoFile) {
        photoBase64 = await readFileAsDataUrl(photoFile);
      }

      const res = await API.callBackend('updateStudent', {
        student: { id: currentStudent.id, phone: phone, photo: photoBase64 }
      }, 'Saving profile...');

      if (res && res.success) {
        currentStudent.phone = phone;
        if (photoBase64) currentStudent.photo = photoBase64;
        API.toastSuccess();
      } else {
        API.toastNotification(res.message || 'Could not update profile.', true);
      }
    };

    document.getElementById('changePasswordBtn').onclick = async () => {
      const p1 = document.getElementById('studentNewPassword').value;
      const p2 = document.getElementById('studentConfirmPassword').value;

      if (!p1 || p1.length < 4) {
        API.toastNotification('Password must be at least 4 characters.', true);
        return;
      }
      if (p1 !== p2) {
        API.toastNotification('Passwords do not match.', true);
        return;
      }

      const res = await API.callBackend('updateStudent', {
        student: { id: currentStudent.id, password: p1 }
      }, 'Updating password...');

      if (res && res.success) {
        API.toastSuccess();
        document.getElementById('studentNewPassword').value = '';
        document.getElementById('studentConfirmPassword').value = '';
      } else {
        API.toastNotification(res.message || 'Error changing password.', true);
      }
    };

    document.getElementById('studentPwaBtn').onclick = () => {
      const btn = document.getElementById('installAppBtn');
      if (btn) btn.click();
      else API.toastNotification('App install ready via browser menu (Add to Home Screen).');
    };
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
    switchTab: switchTab
  };
})();
