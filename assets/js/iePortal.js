/**
 * iePortal.js
 * -----------------------------------------------------------------------
 * Controller for the dedicated IE Developer Company Portal.
 * 
 * Features:
 * 1. Independent Developer Authentication (separate login & session token).
 * 2. System Kill-Switch: Remotely suspend or restore entire school operation.
 * 3. Security Signals Telemetry: Real-time detection of brute-force and forceful entries.
 * 4. Print Dispatch Queue: Inspect ID cards submitted by Admin, update status.
 * 5. Direct messaging with School Admin exclusively.
 * -----------------------------------------------------------------------
 */

(function () {
  let devToken = sessionStorage.getItem('ie_dev_token') || '';
  let isSuspended = false;
  let currentTab = 'signals';
  let inboxToken = '';

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

  // Pre-login endpoint setup
  const preLoginEndpointBtn = document.getElementById('devPreLoginEndpointBtn');
  if (preLoginEndpointBtn) {
    preLoginEndpointBtn.onclick = (e) => {
      e.preventDefault();
      showEndpointConfigModal();
    };
  }

  function showEndpointConfigModal() {
    const modalContainer = document.getElementById('modalContainer') || document.body;
    const currentUrl = API.getBackendUrl() || '';

    modalContainer.innerHTML = `
      <div id="devEndpointModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px);">
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; max-width: 580px; width: 100%; padding: 26px; box-shadow: 0 25px 50px rgba(0,0,0,0.7); color: #f8fafc;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="font-weight: 800; font-size: 16px; color: #60a5fa; display: flex; align-items: center; gap: 8px;">
              <span>⚙️</span> Google Apps Script Web App Endpoint
            </div>
            <button type="button" id="closeEndpointModalBtn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <p style="font-size: 12.5px; color: #94a3b8; margin: 0 0 16px; line-height: 1.5;">
            Configure the deployed Google Apps Script Webhook URL (ending in <code>/exec</code>). This setting establishes the master link to the Google Sheets database and is managed exclusively by IE Digital Works Developers.
          </p>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Web App Execution URL</label>
            <input type="url" id="modalEndpointUrlInput" value="${escapeHtml(currentUrl)}" placeholder="https://script.google.com/macros/s/.../exec" style="width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 13px; font-family: monospace; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 6px;">
          </div>

          <div id="modalEndpointPingResult" style="margin-bottom: 16px; font-size: 12.5px; display: none;"></div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 20px;">
            <button type="button" id="modalTestEndpointBtn" class="btn btn-light btn-sm" style="padding: 8px 14px; background: #334155; color: #f8fafc; border: 1px solid #475569;">
              Test Latency &amp; Ping
            </button>
            <div style="display: flex; gap: 10px;">
              <button type="button" id="modalCancelEndpointBtn" class="btn btn-secondary btn-sm" style="padding: 8px 14px;">Close</button>
              <button type="button" id="modalSaveEndpointBtn" class="btn btn-primary btn-sm" style="padding: 8px 18px; font-weight: 700;">Save Endpoint</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeEndpointModalBtn');
    const cancelBtn = document.getElementById('modalCancelEndpointBtn');
    const saveBtn = document.getElementById('modalSaveEndpointBtn');
    const testBtn = document.getElementById('modalTestEndpointBtn');
    const inputEl = document.getElementById('modalEndpointUrlInput');
    const resultEl = document.getElementById('modalEndpointPingResult');

    const closeModal = () => {
      const modal = document.getElementById('devEndpointModal');
      if (modal) modal.remove();
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    if (testBtn) {
      testBtn.onclick = async () => {
        const val = (inputEl.value || '').trim();
        if (!val) {
          resultEl.style.display = 'block';
          resultEl.innerHTML = '<span style="color: #ef4444;">Please enter a URL before testing.</span>';
          return;
        }
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<span style="color: #60a5fa;">Pinging endpoint...</span>';
        
        const originalUrl = API.getBackendUrl();
        API.setBackendUrl(val);
        const startTime = performance.now();
        const res = await API.callBackend('ping', {}, 'Pinging endpoint...');
        const elapsed = Math.round(performance.now() - startTime);

        if (res && res.success) {
          resultEl.innerHTML = `<span style="color: #10b981; font-weight: 600;">Connected successfully! Latency: ${elapsed}ms (${escapeHtml(res.message || 'Sorina Backend online')})</span>`;
        } else {
          if (originalUrl) API.setBackendUrl(originalUrl);
          resultEl.innerHTML = `<span style="color: #ef4444; font-weight: 600;">Connection failed (${elapsed}ms): ${escapeHtml(res && res.message ? res.message : 'No response from server. Check script deployment and web app access settings.')}</span>`;
        }
      };
    }

    if (saveBtn) {
      saveBtn.onclick = () => {
        const val = (inputEl.value || '').trim();
        API.setBackendUrl(val);
        API.toastSuccess('Endpoint Saved');
        closeModal();
      };
    }
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
      case 'securedInbox':
        await renderSecuredInboxTab();
        break;
      case 'database':
        await renderDatabaseTab();
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
  // 2. PRINTING DISPATCH QUEUE (ID CARDS)
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
                  <td><span class="badge badge-primary">${escapeHtml(j.jobType)}</span></td>
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


  // =========================================================================
  // 3b. SECURED INBOX (email only, separate one-line password)
  // =========================================================================
  function checkInboxPassword(pw) {
    if (/\s/.test(pw)) return 'Password must be a single line with no spaces.';
    if (pw.length < 10) return 'Password must be at least 10 characters long.';
    if (!/[A-Za-z]/.test(pw)) return 'Password must contain at least one letter.';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character.';
    return '';
  }

  async function renderSecuredInboxTab() {
    if (inboxToken) {
      await renderInboxMessages();
      return;
    }
    const st = await API.callBackend('ieInboxStatus', { token: devToken }, 'Checking secured inbox...');
    const configured = !!(st && st.success && st.configured);
    renderInboxGate(configured);
  }

  function renderInboxGate(configured) {
    devTabContainer.innerHTML = `
      <div class="dev-card" style="max-width: 520px; margin: 0 auto;">
        <h3 style="margin: 0 0 6px; color: #ffffff; font-size: 17px;">
          🔐 ${configured ? 'Unlock Secured Inbox' : 'Create Secured Inbox Password'}
        </h3>
        <div style="font-size: 12.5px; color: #94a3b8; margin-bottom: 14px; line-height: 1.5;">
          ${configured
            ? 'Enter the secured inbox password to read emails.'
            : 'This inbox holds emails only. Set a one-line password: at least 10 characters with letters, numbers and a special character (e.g. Sorina#2026ie).'}
        </div>
        <div id="inboxGateError" class="alert alert-danger hidden" style="margin-bottom: 12px;"></div>
        <input type="password" id="inboxPassInput" class="input-field" autocomplete="off"
               placeholder="${configured ? 'Secured inbox password' : 'New password (min 10, letters+numbers+special)'}"
               style="background: #1e293b; color: #fff; border-color: #334155; width: 100%; box-sizing: border-box;">
        ${configured ? '' : `
        <input type="password" id="inboxPassConfirm" class="input-field" autocomplete="off"
               placeholder="Confirm password"
               style="background: #1e293b; color: #fff; border-color: #334155; width: 100%; box-sizing: border-box; margin-top: 10px;">
        <div id="inboxPassHint" style="font-size: 12px; color: #64748b; margin-top: 8px;">10+ characters &bull; letter &bull; number &bull; special character</div>`}
        <button type="button" id="inboxGateBtn" class="btn btn-primary" style="width: 100%; padding: 11px; margin-top: 14px; font-weight: 700;">
          ${configured ? 'Unlock Inbox' : 'Create Password & Open Inbox'}
        </button>
      </div>
    `;

    const errEl = document.getElementById('inboxGateError');
    const input = document.getElementById('inboxPassInput');
    const confirmEl = document.getElementById('inboxPassConfirm');
    const showErr = (m) => { errEl.textContent = m; errEl.classList.remove('hidden'); };

    if (!configured) {
      const hint = document.getElementById('inboxPassHint');
      input.oninput = () => {
        const msg = input.value ? checkInboxPassword(input.value) : '';
        hint.style.color = input.value ? (msg ? '#f87171' : '#34d399') : '#64748b';
        hint.textContent = input.value ? (msg || 'Password strength OK') : '10+ characters \u2022 letter \u2022 number \u2022 special character';
      };
    }

    const submit = async () => {
      errEl.classList.add('hidden');
      const pw = input.value;
      if (!configured) {
        const msg = checkInboxPassword(pw);
        if (msg) return showErr(msg);
        if (pw !== confirmEl.value) return showErr('Passwords do not match.');
      } else if (!pw) {
        return showErr('Enter the password.');
      }
      const res = await API.callBackend(
        configured ? 'ieInboxUnlock' : 'ieInboxSetup',
        { token: devToken, password: pw },
        configured ? 'Unlocking inbox...' : 'Creating secured inbox...'
      );
      if (res && res.success && res.inboxToken) {
        inboxToken = res.inboxToken;
        await renderInboxMessages();
      } else {
        showErr((res && res.message) || 'Could not open secured inbox.');
        input.value = '';
      }
    };
    document.getElementById('inboxGateBtn').onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter' && configured) submit(); };
  }

  async function renderInboxMessages() {
    const res = await API.callBackend('ieInboxList', { token: devToken, inboxToken: inboxToken }, 'Loading secured emails...');
    if (!res || !res.success) {
      if (res && res.locked) inboxToken = '';
      return renderSecuredInboxTab();
    }
    const emails = res.emails || [];

    devTabContainer.innerHTML = `
      <div class="dev-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="margin: 0; color: #ffffff; font-size: 17px;">🔐 Secured Inbox <span class="badge badge-warning" style="margin-left: 6px;">${res.unread || 0} unread</span></h3>
            <div style="font-size: 12.5px; color: #94a3b8;">Email-only inbox for the IE team. Session auto-locks after 30 minutes.</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-light btn-sm" id="inboxRefreshBtn">Refresh</button>
            <button type="button" class="btn btn-light btn-sm" id="inboxChangePwBtn">Change Password</button>
            <button type="button" class="btn btn-danger btn-sm" id="inboxLockBtn">Lock Inbox</button>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${emails.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: #64748b;">No emails in the secured inbox yet.</div>
          ` : emails.map(m => `
            <div class="inbox-mail" data-id="${escapeHtml(m.id)}" data-read="${m.read ? '1' : '0'}"
                 style="border: 1px solid #1e293b; border-left: 4px solid ${m.read ? '#334155' : '#3b82f6'}; border-radius: 8px; padding: 12px 16px; background: #0a192f; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; gap: 10px; align-items: center;">
                <strong style="color: #ffffff; font-size: 14px; ${m.read ? 'font-weight: 500;' : ''}">${escapeHtml(m.subject)}</strong>
                <span style="font-size: 12px; color: #64748b; white-space: nowrap;">${escapeHtml(m.timestamp)}</span>
              </div>
              <div style="font-size: 12px; color: #60a5fa; margin-top: 2px;">From: ${escapeHtml(m.from)} &bull; ${escapeHtml(m.category)}</div>
              <div class="inbox-body hidden" style="font-size: 13.5px; color: #cbd5e1; line-height: 1.55; margin-top: 10px; white-space: pre-wrap; font-family: monospace;">${escapeHtml(m.body)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('inboxRefreshBtn').onclick = renderInboxMessages;
    document.getElementById('inboxLockBtn').onclick = async () => {
      await API.callBackend('ieInboxLock', { token: devToken, inboxToken: inboxToken }, 'Locking inbox...');
      inboxToken = '';
      renderSecuredInboxTab();
    };
    document.getElementById('inboxChangePwBtn').onclick = changeInboxPassword;

    devTabContainer.querySelectorAll('.inbox-mail').forEach(card => {
      card.onclick = async () => {
        card.querySelector('.inbox-body').classList.toggle('hidden');
        if (card.dataset.read === '0') {
          card.dataset.read = '1';
          card.style.borderLeftColor = '#334155';
          await API.callBackend('ieInboxMarkRead', { token: devToken, inboxToken: inboxToken, id: card.dataset.id }, 'Updating...');
        }
      };
    });
  }

  async function changeInboxPassword() {
    const cur = prompt('Current secured inbox password:');
    if (!cur) return;
    const next = prompt('New password (one line, 10+ characters, letters + numbers + special character):');
    if (!next) return;
    const msg = checkInboxPassword(next);
    if (msg) { API.toastNotification(msg, true); return; }
    const res = await API.callBackend('ieInboxChangePassword', { token: devToken, currentPassword: cur, newPassword: next }, 'Changing password...');
    if (res && res.success) API.toastSuccess('Password changed');
    else API.toastNotification((res && res.message) || 'Could not change password.', true);
  }

  // =========================================================================
  // 4. DATABASE & INFRASTRUCTURE CONTROLLER
  // =========================================================================
  async function renderDatabaseTab() {
    const currentUrl = API.getBackendUrl() || '';

    const tables = [
      { name: 'Students', scope: 'Operational', cols: 16, key: 'Student ID', desc: 'Profiles, classes, enrollment status, parent contact info, credentials.' },
      { name: 'Scores', scope: 'Operational', cols: 17, key: 'Student ID + Subject', desc: 'Six period grades, 1st & 2nd semester exams, yearly averages, remarks.' },
      { name: 'Finance', scope: 'Operational', cols: 22, key: 'Student ID', desc: 'Tuition, registration, PE suit, entrance, portal fees, installments, balance.' },
      { name: 'Teachers', scope: 'Operational', cols: 9, key: 'Teacher ID', desc: 'Faculty profiles, subject/class assignments JSON, phone, status.' },
      { name: 'Subjects', scope: 'Operational', cols: 2, key: 'Subject Name', desc: 'Curriculum subjects list and creation timestamps.' },
      { name: 'ClassFees', scope: 'Operational', cols: 6, key: 'Grade Level', desc: 'Grade-by-grade fee structures, tuition rates, and mandatory fees.' },
      { name: 'Messages', scope: 'Operational', cols: 7, key: 'Message ID', desc: 'Portal internal messages, notifications, and announcements.' },
      { name: 'LessonPlans', scope: 'Operational', cols: 12, key: 'Plan ID', desc: 'Teacher lesson plans, approval states, week/term schedules.' },
      { name: 'Admin', scope: 'Security / Admin', cols: 11, key: 'Admin ID', desc: 'Administrative staff, PBKDF2 hashed passwords, role-based permission flags.' },
      { name: 'Settings', scope: 'Operational', cols: 2, key: 'Key', desc: 'Global configurations: school name, current academic year, grading scale.' },
      { name: 'AuditLog', scope: 'Security / Admin', cols: 6, key: 'Timestamp', desc: 'Tamper-evident security ledger logging administrative events & exports.' },
      { name: 'BackupLog', scope: 'Security / Admin', cols: 7, key: 'Backup ID', desc: 'Snapshot history, record counts, Drive storage URLs, SHA-256 hashes.' },
      { name: 'PrintQueue', scope: 'Operational', cols: 9, key: 'Job ID', desc: 'PVC ID Card and Examination Question sheet dispatch requests.' },
      { name: 'DeveloperMessages', scope: 'Operational', cols: 7, key: 'Message ID', desc: 'Private direct messaging between School Admin and IE Developers.' },
      { name: 'SecuritySignals', scope: 'Operational', cols: 5, key: 'Signal ID', desc: 'Forceful entry alerts, suspicious IP activities, brute-force alarms.' }
    ];

    devTabContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">

        <!-- Active Endpoint Configuration -->
        <div class="dev-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
              <h3 style="margin: 0; color: #ffffff; font-size: 17px;">Google Apps Script Web App Endpoint</h3>
              <div style="font-size: 12.5px; color: #94a3b8;">
                Master connection URL to the Google Sheets backend. Removed from School Admin to ensure centralized developer control.
              </div>
            </div>
            <span class="dev-badge" id="endpointStatusBadge" style="background: ${currentUrl ? '#065f46; color: #34d399;' : '#7f1d1d; color: #f87171;'}">
              ${currentUrl ? 'CONFIGURED' : 'UNCONFIGURED'}
            </span>
          </div>

          <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
            <input type="url" id="devEndpointInput" value="${escapeHtml(currentUrl)}" placeholder="https://script.google.com/macros/s/.../exec" style="flex: 1; min-width: 320px; padding: 10px 14px; font-size: 13px; font-family: monospace; background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 6px;">
            <button type="button" class="btn btn-light btn-sm" id="devTestPingBtn" style="padding: 10px 16px; background: #334155; color: #f8fafc; border: 1px solid #475569;">
              Test Latency &amp; Ping
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="devSaveEndpointBtn" style="padding: 10px 20px; font-weight: 700;">
              Save &amp; Apply Endpoint
            </button>
          </div>

          <div id="devPingFeedback" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-top: 10px;"></div>
        </div>

        <!-- Database Initialization & Schema Provisioning -->
        <div class="dev-card" style="border-left: 4px solid #3b82f6;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 14px;">
            <div>
              <h3 style="margin: 0; color: #ffffff; font-size: 17px;">Database Provisioning &amp; Schema Synchronization</h3>
              <div style="font-size: 12.5px; color: #94a3b8; max-width: 750px; line-height: 1.5; margin-top: 4px;">
                Executes <code>initDatabase</code> on the connected Google Sheets backend. Automatically creates any missing sheets across all 17 schema tables, applies locked header formatting, sets string type preservation on identifier columns, and seeds default curriculum subjects without overwriting existing records.
              </div>
            </div>
            <button type="button" class="btn btn-primary" id="devInitDatabaseBtn" style="padding: 12px 20px; font-weight: 700; background: #2563eb; border-color: #3b82f6; display: flex; align-items: center; gap: 8px;">
              <span>🚀</span> Initialize / Sync All 17 Database Tables
            </button>
          </div>

          <div id="devInitResult" style="display: none; padding: 12px 16px; border-radius: 6px; font-size: 13.5px; margin-top: 10px;"></div>
        </div>

        <!-- 17-Table Schema Architecture Table -->
        <div class="dev-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h3 style="margin: 0; color: #ffffff; font-size: 17px;">Database Blueprint (17 Relational Google Sheets Tables)</h3>
              <div style="font-size: 12.5px; color: #94a3b8;">
                High-integrity schema specifications enforced by the backend across Operational and Security/Admin spreadsheets.
              </div>
            </div>
            <span style="font-size: 13px; color: #60a5fa; font-weight: 700;">17 Tables Defined</span>
          </div>

          <div class="table-responsive">
            <table class="data-table" style="color: #e2e8f0; width: 100%;">
              <thead>
                <tr style="border-color: #334155;">
                  <th style="width: 40px;">#</th>
                  <th>Sheet / Table Name</th>
                  <th>Spreadsheet Scope</th>
                  <th>Columns</th>
                  <th>Primary Key</th>
                  <th>Table Purpose &amp; Domain</th>
                </tr>
              </thead>
              <tbody>
                ${tables.map((t, idx) => `
                  <tr style="border-color: #1e293b;">
                    <td style="color: #64748b;">${idx + 1}</td>
                    <td>
                      <strong style="color: #f8fafc; font-family: monospace; font-size: 13.5px;">${escapeHtml(t.name)}</strong>
                    </td>
                    <td>
                      <span class="badge ${t.scope.includes('Security') ? 'badge-danger' : 'badge-primary'}" style="font-size: 11px;">
                        ${escapeHtml(t.scope)}
                      </span>
                    </td>
                    <td><b>${t.cols}</b> cols</td>
                    <td style="font-family: monospace; font-size: 12px; color: #93c5fd;">${escapeHtml(t.key)}</td>
                    <td style="font-size: 12.5px; color: #cbd5e1;">${escapeHtml(t.desc)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    // Bind Ping Test
    const pingBtn = document.getElementById('devTestPingBtn');
    const endpointInput = document.getElementById('devEndpointInput');
    const pingFeedback = document.getElementById('devPingFeedback');
    const saveEndpointBtn = document.getElementById('devSaveEndpointBtn');
    const initDbBtn = document.getElementById('devInitDatabaseBtn');
    const initResult = document.getElementById('devInitResult');

    if (pingBtn) {
      pingBtn.onclick = async () => {
        const val = (endpointInput.value || '').trim();
        if (!val) {
          pingFeedback.style.display = 'block';
          pingFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
          pingFeedback.style.border = '1px solid #ef4444';
          pingFeedback.style.color = '#ef4444';
          pingFeedback.textContent = 'Please enter an endpoint URL before testing.';
          return;
        }

        pingFeedback.style.display = 'block';
        pingFeedback.style.background = 'rgba(59, 130, 246, 0.15)';
        pingFeedback.style.border = '1px solid #3b82f6';
        pingFeedback.style.color = '#60a5fa';
        pingFeedback.textContent = 'Pinging Google Apps Script endpoint...';

        const originalUrl = API.getBackendUrl();
        API.setBackendUrl(val);

        const startTime = performance.now();
        const res = await API.callBackend('ping', {}, 'Pinging endpoint...');
        const elapsed = Math.round(performance.now() - startTime);

        if (res && res.success) {
          pingFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
          pingFeedback.style.border = '1px solid #10b981';
          pingFeedback.style.color = '#34d399';
          pingFeedback.innerHTML = `🟢 <b>Connected (200 OK)</b> &bull; Latency: <b>${elapsed}ms</b> &bull; Server message: <i>${escapeHtml(res.message || 'Sorina Backend online')}</i> (Timestamp: ${escapeHtml(res.timestamp || new Date().toLocaleTimeString())})`;
        } else {
          if (originalUrl) API.setBackendUrl(originalUrl);
          pingFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
          pingFeedback.style.border = '1px solid #ef4444';
          pingFeedback.style.color = '#ef4444';
          pingFeedback.innerHTML = `🔴 <b>Connection Failed</b> &bull; Response time: ${elapsed}ms &bull; ${escapeHtml(res && res.message ? res.message : 'Server returned 404/500 or is unreachable. Ensure the web app is deployed with access set to Anyone.')}`;
        }
      };
    }

    if (saveEndpointBtn) {
      saveEndpointBtn.onclick = () => {
        const val = (endpointInput.value || '').trim();
        API.setBackendUrl(val);
        API.toastSuccess('Endpoint URL Saved & Applied');
        renderDatabaseTab();
      };
    }

    if (initDbBtn) {
      initDbBtn.onclick = async () => {
        const confirmed = confirm('Are you sure you want to initialize/sync all 17 tables on the connected Google Sheets database?\\n\\nThis will provision any missing tables, set up header rows, and apply column data formatting.');
        if (!confirmed) return;

        initResult.style.display = 'block';
        initResult.style.background = 'rgba(59, 130, 246, 0.15)';
        initResult.style.border = '1px solid #3b82f6';
        initResult.style.color = '#60a5fa';
        initResult.textContent = 'Provisioning tables across Google Sheets backend...';

        const res = await API.callBackend('ieInitDatabase', { token: devToken, sessionToken: devToken }, 'Initializing database tables...');

        if (res && res.success) {
          initResult.style.background = 'rgba(16, 185, 129, 0.15)';
          initResult.style.border = '1px solid #10b981';
          initResult.style.color = '#34d399';
          initResult.innerHTML = `✅ <b>Database Initialized Successfully!</b><br><span style="font-size: 12.5px; color: #cbd5e1;">${escapeHtml(res.message || 'All 17 operational and security sheets are verified and ready for live transactions.')}</span>`;
          API.toastSuccess('Database Initialized');
        } else {
          initResult.style.background = 'rgba(239, 68, 68, 0.15)';
          initResult.style.border = '1px solid #ef4444';
          initResult.style.color = '#ef4444';
          initResult.innerHTML = `❌ <b>Database Initialization Failed:</b> ${escapeHtml(res && res.message ? res.message : 'Could not initialize Google Sheets. Check endpoint URL and Apps Script permissions.')}`;
          API.toastNotification(res && res.message ? res.message : 'Database initialization failed', true);
        }
      };
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
