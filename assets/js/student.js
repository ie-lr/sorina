/**
 * student.js
 * -----------------------------------------------------------------------
 * Student and Parent portal module.
 * Loaded ONLY after verified student/parent authentication (Section 12.2).
 * Strictly scoped to student's own records (IDOR prevention).
 * Enforces grade-sheet lock rules and full-template report card rendering.
 * -----------------------------------------------------------------------
 */

window.StudentPanel = (function () {
  let currentStudent = null;
  let currentTab = 'reportCard';

  async function mount(container, user) {
    currentStudent = user;
    currentTab = 'reportCard';

    // Fetch freshest student profile
    const res = await API.callBackend('getStudentById', { studentId: user.id });
    if (res && res.success && res.student) {
      currentStudent = Object.assign({}, user, res.student);
    }

    renderStudentShell(container);
    await loadTab(currentTab);
  }

  function renderStudentShell(container) {
    const isLocked = currentStudent.gradeLocked === true;

    container.innerHTML = `
      <div class="dashboard-container">
        <!-- Student Profile Overview Card -->
        <div class="content-card" style="margin-bottom: 20px;">
          <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 36px; overflow: hidden; border: 2px solid var(--color-primary);">
              ${currentStudent.photo ? `<img src="${currentStudent.photo}" style="width: 100%; height: 100%; object-fit: cover;">` : '🎓'}
            </div>
            <div style="flex: 1; min-width: 240px;">
              <h2 style="margin: 0 0 4px; color: var(--color-primary); font-size: 22px;">
                ${escapeHtml(currentStudent.name)}
              </h2>
              <div style="font-size: 13.5px; color: var(--color-text-muted);">
                Student ID: <b>${escapeHtml(currentStudent.id)}</b> | Class: <b>${escapeHtml(currentStudent.className || currentStudent.grade)}</b>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                <span class="badge ${currentStudent.status === 'Active' ? 'badge-success' : 'badge-danger'}">
                  ${escapeHtml(currentStudent.status || 'Active')}
                </span>
                <span class="badge badge-light">
                  Academic Year: ${escapeHtml(currentStudent.academicYear || '2026-2027')}
                </span>
                <span class="badge ${currentStudent.studentCategory === 'new' ? 'badge-info' : 'badge-light'}">
                  ${currentStudent.studentCategory === 'new' ? 'New Student' : 'Returning Student'}
                </span>
                ${isLocked ? `<span class="badge badge-warning">🔒 Grade Sheet Locked</span>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Student Sub Navigation -->
        <div class="nav-tabs" role="tablist">
          <button class="nav-tab-item active" data-tab="reportCard">📜 Official Report Card</button>
          <button class="nav-tab-item" data-tab="finance">💳 Tuition &amp; Fee Statement</button>
          <button class="nav-tab-item" data-tab="messages">✉️ Messages &amp; Notices</button>
          <button class="nav-tab-item" data-tab="security">🔒 Change Password</button>
        </div>

        <!-- Tab Body -->
        <div id="studentTabBody"></div>
      </div>
    `;

    container.querySelectorAll('.nav-tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.nav-tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadTab(currentTab);
      });
    });
  }

  async function loadTab(tab) {
    const container = document.getElementById('studentTabBody');
    if (!container) return;
    container.innerHTML = '<div style="padding: 40px; text-align: center;"><div class="stat-label">Loading your records...</div></div>';

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
      case 'security':
        renderSecurityTab(container);
        break;
    }
  }

  // =========================================================================
  // 1. REPORT CARD TAB
  // =========================================================================
  async function renderReportCardTab(container) {
    if (currentStudent.gradeLocked) {
      container.innerHTML = `
        <div class="content-card" style="text-align: center; padding: 50px 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">🔒</div>
          <h3 style="color: var(--color-warning); margin: 0 0 10px;">Grade Sheet Clearance Required</h3>
          <p style="max-width: 550px; margin: 0 auto 20px; font-size: 14.5px; color: var(--color-text-muted); line-height: 1.6;">
            Your academic report card has been withheld by the school administration pending administrative or financial clearance. Please visit the school business office or contact the registrar.
          </p>
          <div style="display: inline-flex; gap: 10px;">
            <button class="btn btn-primary" onclick="window.StudentPanel.switchTab('finance')">View Finance Statement</button>
          </div>
        </div>
      `;
      return;
    }

    const res = await API.callBackend('getReportCard', { studentId: currentStudent.id });
    if (res && res.success && res.reportCard) {
      ReportCard.render(res.reportCard, container);
    } else {
      container.innerHTML = `
        <div class="content-card" style="text-align: center; padding: 40px;">
          <p style="color: var(--color-text-muted); font-size: 14px;">${escapeHtml(res.message || 'No report card available yet.')}</p>
        </div>
      `;
    }
  }

  // =========================================================================
  // 2. FINANCE TAB
  // =========================================================================
  async function renderFinanceTab(container) {
    const res = await API.callBackend('getStudentFinance', { studentId: currentStudent.id });
    const f = (res && res.success && res.finance) ? res.finance : (currentStudent.finance || {});
    const inst = f.installments || [0, 0, 0, 0];
    const currency = f.currency || 'USD';

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Tuition Billed</div>
          <div class="stat-value">${currency} ${(f.tuitionTotal || 0).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Paid to Date</div>
          <div class="stat-value" style="color: var(--color-success);">${currency} ${(f.totalPaid || 0).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Outstanding Balance</div>
          <div class="stat-value" style="color: ${(f.balance || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
            ${currency} ${(f.balance || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header-row">
          <h3 class="card-title">Fee Breakdown &amp; Installments</h3>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fee Item</th>
                <th>Required / Scheduled Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Registration Fee</td>
                <td>${currency} ${f.registrationFee || 0}</td>
                <td>${f.registrationPaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Unpaid</span>'}</td>
              </tr>
              <tr>
                <td>1st Tuition Installment</td>
                <td>${currency} ${inst[0] || 0}</td>
                <td>${inst[0] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              <tr>
                <td>2nd Tuition Installment</td>
                <td>${currency} ${inst[1] || 0}</td>
                <td>${inst[1] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              <tr>
                <td>3rd Tuition Installment</td>
                <td>${currency} ${inst[2] || 0}</td>
                <td>${inst[2] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              <tr>
                <td>4th Tuition Installment</td>
                <td>${currency} ${inst[3] || 0}</td>
                <td>${inst[3] > 0 ? '<span class="badge badge-success">Recorded</span>' : '<span class="badge badge-light">Pending</span>'}</td>
              </tr>
              ${f.entranceFee ? `
                <tr>
                  <td>Entrance Fee (New Student)</td>
                  <td>${currency} ${f.entranceFee}</td>
                  <td>${f.entranceFeePaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Unpaid</span>'}</td>
                </tr>
              ` : ''}
              ${f.requirementsFee ? `
                <tr>
                  <td>Requirements Fee</td>
                  <td>${currency} ${f.requirementsFee}</td>
                  <td>${f.requirementsFeePaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-light">Pending</span>'}</td>
                </tr>
              ` : ''}
              ${f.peSuitFee ? `
                <tr>
                  <td>PE Suit Fee</td>
                  <td>${currency} ${f.peSuitFee}</td>
                  <td>${f.peSuitFeePaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-light">Pending</span>'}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 3. MESSAGES TAB
  // =========================================================================
  async function renderMessagesTab(container) {
    const res = await API.callBackend('getMessages');
    const messages = (res && res.success) ? res.messages : [];

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="content-card" style="text-align: center; padding: 40px;">
          <p style="color: var(--color-text-muted);">No new announcements or messages in your inbox.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="content-card">
        <div class="card-header-row">
          <h3 class="card-title">School Notices &amp; Messages</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${messages.map(m => `
            <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 16px; background: #fff;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <b style="color: var(--color-primary); font-size: 15px;">${escapeHtml(m.subject)}</b>
                <span style="font-size: 11.5px; color: var(--color-text-muted);">${escapeHtml(m.sentAt)}</span>
              </div>
              <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px;">
                From: <b>${escapeHtml(m.senderName)}</b> (${escapeHtml(m.senderRole)})
              </div>
              <div style="font-size: 13.5px; line-height: 1.5; color: var(--color-text);">
                ${escapeHtml(m.body)}
              </div>
              ${m.attachmentUrl ? `
                <div style="margin-top: 10px;">
                  <a href="${m.attachmentUrl}" target="_blank" class="btn btn-light btn-sm">📎 View Attachment</a>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 4. SECURITY / PASSWORD CHANGE TAB
  // =========================================================================
  function renderSecurityTab(container) {
    container.innerHTML = `
      <div class="content-card" style="max-width: 480px;">
        <div class="card-header-row">
          <h3 class="card-title">Change Password</h3>
        </div>
        <form id="changePassForm" onsubmit="window.StudentPanel.handleChangePassword(event)">
          <div class="form-group">
            <label class="form-label" for="spNewPass">New Password *</label>
            <input type="password" id="spNewPass" class="input-field" placeholder="Enter new password (min. 4 chars)" required minlength="4">
          </div>
          <div class="form-group">
            <label class="form-label" for="spConfirmPass">Confirm New Password *</label>
            <input type="password" id="spConfirmPass" class="input-field" placeholder="Re-type new password" required minlength="4">
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Update Password</button>
        </form>
      </div>
    `;
  }

  async function handleChangePassword(e) {
    if (e) e.preventDefault();
    const newPass = document.getElementById('spNewPass').value.trim();
    const confirmPass = document.getElementById('spConfirmPass').value.trim();

    if (newPass !== confirmPass) {
      App.showToast('Passwords do not match.', 'error');
      return;
    }

    const res = await API.callBackend('updateStudent', {
      student: { id: currentStudent.id, password: newPass }
    });

    if (res && res.success) {
      App.showToast('Password updated successfully.', 'success');
      document.getElementById('changePassForm').reset();
    } else {
      App.showToast(res.message || 'Password update failed.', 'error');
    }
  }

  function switchTab(t) {
    const navBtn = document.querySelector(`.nav-tab-item[data-tab="${t}"]`);
    if (navBtn) navBtn.click();
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
    handleChangePassword: handleChangePassword
  };
})();
