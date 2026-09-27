/**
 * iePortal.js
 * -----------------------------------------------------------------------
 * Controller for the dedicated IE Developer Company Portal.
 * 
 * Features:
 * 1. Independent Developer Authentication (separate login & session token).
 * 2. System Kill-Switch: Remotely suspend or restore entire school operation.
 * 3. Security Signals Telemetry: Real-time detection of brute-force and forceful entries.
 * 4. Print Dispatch Queue: Inspect ID cards & tests submitted by Admin, update status.
 * 5. Direct messaging with School Admin exclusively.
 * -----------------------------------------------------------------------
 */

(function () {
  let devToken = sessionStorage.getItem('ie_dev_token') || '';
  let isSuspended = false;
  let currentTab = 'signals';

  const loginView = document.getElementById('devLoginView');
  const dashView = document.getElementById('devDashboardView');
  const loginForm = document.getElementById('devLoginForm');
  const loginErr = document.getElementById('devLoginError');
  const devTabContainer = document.getElementById('devTabContainer');

  // Initialize
  if (devToken) {
    showDashboard();
  }

  // Handle Login
  if (loginForm) {
    loginForm.onsubmit = async () => {
      const user = document.getElementById('devUser').value.trim();
      const pass = document.getElementById('devPass').value.trim();

      loginErr.classList.add('hidden');

      const res = await API.callBackend('ieLogin', { username: user, password: pass }, 'Verifying developer key...');
      if (res && res.success && res.token) {
        devToken = res.token;
        sessionStorage.setItem('ie_dev_token', devToken);
        showDashboard();
      } else {
        loginErr.textContent = res.message || 'Invalid developer credentials.';
        loginErr.classList.remove('hidden');
      }
    };
  }

  async function showDashboard() {
    loginView.classList.add('hidden');
    dashView.classList.remove('hidden');

    // Setup Header Action
    const headActs = document.getElementById('devHeaderActions');
    if (headActs) {
      headActs.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="dev-badge">AUTHENTICATED DEVELOPER</span>
          <button type="button" class="btn btn-light btn-sm" id="devLogoutBtn">Sign Out</button>
        </div>
      `;
      document.getElementById('devLogoutBtn').onclick = () => {
        sessionStorage.removeItem('ie_dev_token');
        window.location.reload();
      };
    }

    // Bind Kill-Switch Toggle
    const killBtn = document.getElementById('toggleKillSwitchBtn');
    if (killBtn) {
      killBtn.onclick = toggleKillSwitch;
    }

    // Bind Tabs
    document.querySelectorAll('.nav-tab-item[data-tab]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nav-tab-item[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadTab(currentTab);
      };
    });

    await refreshSystemStatus();
    loadTab(currentTab);
  }

  async function refreshSystemStatus() {
    const res = await API.callBackend('ieGetStatus', { token: devToken }, 'Checking status...');
    if (res && res.success) {
      isSuspended = Boolean(res.suspended);
      updateKillSwitchUI();
    }
  }

  function updateKillSwitchUI() {
    const box = document.getElementById('killSwitchBox');
    const title = document.getElementById('killSwitchTitle');
    const desc = document.getElementById('killSwitchDesc');
    const btn = document.getElementById('toggleKillSwitchBtn');

    if (isSuspended) {
      box.className = 'kill-switch-box suspended';
      title.textContent = 'School Operations: SUSPENDED';
      title.style.color = '#ef4444';
      desc.textContent = 'All student, teacher, and administrator operations are blocked by system kill-switch.';
      btn.textContent = 'RESTORE SCHOOL SYSTEM';
      btn.className = 'btn btn-primary';
      btn.style.background = '#10b981';
      btn.style.borderColor = '#10b981';
    } else {
      box.className = 'kill-switch-box active';
      title.textContent = 'School Operations: ACTIVE';
      title.style.color = '#10b981';
      desc.textContent = 'Entire school portal is live and accepting student, teacher, and administrator connections.';
      btn.textContent = 'SUSPEND SCHOOL SYSTEM';
      btn.className = 'btn btn-danger';
    }
  }

  async function toggleKillSwitch() {
    const actionName = isSuspended ? 'RESTORE' : 'SUSPEND';
    const reason = prompt(`Confirm: Are you sure you want to ${actionName} the school management system? Enter authorization note:`, 'Developer administrative intervention');
    if (reason === null) return;

    const res = await API.callBackend('ieToggleSuspension', {
      token: devToken,
      suspend: !isSuspended,
      reason: reason
    }, 'Updating system state...');

    if (res && res.success) {
      isSuspended = res.suspended;
      updateKillSwitchUI();
      API.toastSuccess(`{System ${isSuspended ? 'Suspended' : 'Restored'}}`);
    } else {
      API.toastNotification(res.message || 'Error updating system state.', true);
    }
  }

  async function loadTab(tab) {
    if (!devTabContainer) return;
    devTabContainer.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Loading telemetry...</div>';

    switch (tab) {
      case 'signals':
        await renderSignalsTab();
        break;
      case 'printQueue':
        await renderPrintQueueTab();
        break;
      case 'messages':
        await renderMessagesTab();
        break;
    }
  }

  // =========================================================================
  // 1. SECURITY SIGNALS TELEMETRY
  // =========================================================================
  async function renderSignalsTab() {
    const res = await API.callBackend('ieGetSecuritySignals', { token: devToken }, 'Loading security signals...');
    const signals = (res && res.success && Array.isArray(res.signals)) ? res.signals : [];

    devTabContainer.innerHTML = `
      <div class="dev-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0; color: #ffffff; font-size: 17px;">Real-Time Security Signals &amp; Forceful Entries</h3>
            <div style="font-size: 12.5px; color: #94a3b8;">Automated telemetry detecting brute force attacks, credential stuffing, and unauthorized access attempts.</div>
          </div>
          <button type="button" class="btn btn-light btn-sm" id="refreshSignalsBtn">Refresh Telemetry</button>
        </div>

        <div style="display: flex; flex-direction: column;">
          ${signals.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: #64748b;">
              No security anomalies or forceful entry signals recorded. System integrity optimal.
            </div>
          ` : signals.map(s => `
            <div class="signal-item">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge ${s.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(s.severity)}</span>
                  <strong style="color: #ffffff; font-size: 14px;">${escapeHtml(s.eventType)}</strong>
                  <span style="font-size: 12px; color: #64748b;">[${escapeHtml(s.id)}]</span>
                </div>
                <div style="font-size: 13px; color: #94a3b8; margin-top: 4px; font-family: monospace;">
                  ${escapeHtml(s.details)}
                </div>
              </div>
              <div style="font-size: 12px; color: #64748b; white-space: nowrap;">
                ${escapeHtml(s.timestamp)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('refreshSignalsBtn').onclick = renderSignalsTab;
  }

  // =========================================================================
  // 2. PRINTING DISPATCH QUEUE (ID CARDS & TEACHER TESTS)
  // =========================================================================
  async function renderPrintQueueTab() {
    const res = await API.callBackend('ieGetPrintQueue', { token: devToken }, 'Loading print queue...');
    const jobs = (res && res.success && Array.isArray(res.jobs)) ? res.jobs : [];

    devTabContainer.innerHTML = `
      <div class="dev-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0; color: #ffffff; font-size: 17px;">Printing Production Queue</h3>
            <div style="font-size: 12.5px; color: #94a3b8;">Orders dispatched by School Administration for physical printing (PVC Student ID Cards &amp; Examination Question Sheets).</div>
          </div>
          <button type="button" class="btn btn-light btn-sm" id="refreshPrintQueueBtn">Refresh Queue</button>
        </div>

        <div class="table-responsive">
          <table class="data-table" style="color: #e2e8f0;">
            <thead>
              <tr style="border-color: #334155;">
                <th>Job ID</th>
                <th>Job Type</th>
                <th>Units / Copies</th>
                <th>Order Description</th>
                <th>Requested By</th>
                <th>Production Status</th>
                <th>Update Status</th>
              </tr>
            </thead>
            <tbody>
              ${jobs.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 25px; color: #64748b;">Print production queue is currently clear.</td></tr>
              ` : jobs.map(j => `
                <tr style="border-color: #1e293b;">
                  <td><b>${escapeHtml(j.jobId)}</b></td>
                  <td><span class="badge ${j.jobType === 'EXAM_TEST' ? 'badge-info' : 'badge-primary'}">${escapeHtml(j.jobType)}</span></td>
                  <td><b>${j.count} unit(s)</b></td>
                  <td style="font-size: 12.5px; color: #cbd5e1;">${escapeHtml(j.details)}</td>
                  <td>${escapeHtml(j.requestedBy)}</td>
                  <td>
                    <span class="badge ${j.status === 'Completed' || j.status === 'Dispatched' ? 'badge-success' : j.status === 'In Progress' ? 'badge-info' : 'badge-warning'}">
                      ${escapeHtml(j.status)}
                    </span>
                  </td>
                  <td>
                    <select class="select-field" style="padding: 4px 8px; font-size: 12px; background: #1e293b; color: #fff; border-color: #334155;" onchange="window.IeConsole.updateJob('${escapeHtml(j.jobId)}', this.value)">
                      <option value="Pending" ${j.status === 'Pending' ? 'selected' : ''}>Pending</option>
                      <option value="In Progress" ${j.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                      <option value="Printed" ${j.status === 'Printed' ? 'selected' : ''}>Printed</option>
                      <option value="Dispatched" ${j.status === 'Dispatched' ? 'selected' : ''}>Dispatched to School</option>
                      <option value="Completed" ${j.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('refreshPrintQueueBtn').onclick = renderPrintQueueTab;
  }

  async function updateJob(jobId, newStatus) {
    const res = await API.callBackend('ieUpdatePrintJob', {
      token: devToken,
      jobId: jobId,
      status: newStatus
    }, 'Updating job...');

    if (res && res.success) {
      API.toastSuccess();
      renderPrintQueueTab();
    } else {
      API.toastNotification(res.message || 'Error updating job status.', true);
    }
  }

  // =========================================================================
  // 3. ADMIN DIRECT MESSAGING
  // =========================================================================
  async function renderMessagesTab() {
    const res = await API.callBackend('ieGetMessages', { token: devToken }, 'Loading messages...');
    const messages = (res && res.success && Array.isArray(res.messages)) ? res.messages : [];

    devTabContainer.innerHTML = `
      <div class="dev-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0; color: #ffffff; font-size: 17px;">School Administration Communication Thread</h3>
            <div style="font-size: 12.5px; color: #94a3b8;">Exclusive messaging channel directly connecting IE Developer Support with the school's leadership.</div>
          </div>
          <button type="button" class="btn btn-primary" id="openDevReplyBtn">Dispatch Message to Admin</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${messages.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: #64748b;">
              No messages exchanged with school administration yet.
            </div>
          ` : messages.map(m => `
            <div style="border: 1px solid #1e293b; border-radius: 8px; padding: 14px 18px; background: ${m.sender === 'IE_DEVELOPER' ? '#1e293b' : '#0a192f'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: #ffffff; font-size: 14.5px;">${escapeHtml(m.subject)}</strong>
                <span style="font-size: 12px; color: #64748b;">${escapeHtml(m.timestamp)}</span>
              </div>
              <div style="font-size: 13.5px; color: #cbd5e1; line-height: 1.5;">${escapeHtml(m.body)}</div>
              <div style="margin-top: 6px; font-size: 11.5px; font-weight: 700; color: ${m.sender === 'IE_DEVELOPER' ? '#60a5fa' : '#34d399'};">
                Sender: ${escapeHtml(m.senderName)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('openDevReplyBtn').onclick = () => {
      const subject = prompt('Message Subject:', 'Notice from IE Digital Works Developer Team');
      if (!subject) return;
      const body = prompt('Message Body:');
      if (!body) return;

      sendDeveloperMessage(subject, body);
    };
  }

  async function sendDeveloperMessage(subject, body) {
    const res = await API.callBackend('ieSendMessage', {
      token: devToken,
      subject: subject,
      body: body
    }, 'Transmitting message...');

    if (res && res.success) {
      API.toastSuccess();
      renderMessagesTab();
    } else {
      API.toastNotification(res.message || 'Error transmitting message.', true);
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

  window.IeConsole = {
    updateJob: updateJob
  };

})();
