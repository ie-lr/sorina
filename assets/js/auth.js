/**
 * auth.js
 * -----------------------------------------------------------------------
 * Gateway login handling, session storage, and post-login dynamic role routing.
 * Loads role modules dynamically post-auth (Section 12.2).
 * -----------------------------------------------------------------------
 */

const Auth = (function () {
  let activeRole = 'student';

  function initLoginForm() {
    const tabs = document.querySelectorAll('.role-tab-btn');
    const forms = {
      student: document.getElementById('studentLoginForm'),
      teacher: document.getElementById('teacherLoginForm'),
      admin: document.getElementById('adminLoginForm'),
      ie: document.getElementById('ieLoginForm')
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeRole = tab.dataset.role;

        hideAlert();

        // Switch to selected role form
        Object.keys(forms).forEach(r => {
          if (forms[r]) forms[r].classList.toggle('hidden', r !== activeRole);
        });
      });
    });

    // Support direct links to specific portal forms (e.g. index.html?role=admin or index.html#admin)
    const urlParams = new URLSearchParams(window.location.search);
    const requestedRole = (urlParams.get('role') || window.location.hash.replace('#', '') || '').toLowerCase();
    if (requestedRole && forms[requestedRole]) {
      const targetTab = document.querySelector(`.role-tab-btn[data-role="${requestedRole}"]`);
      if (targetTab) targetTab.click();
    }

    // 1. Student Login Form Submit
    if (forms.student) {
      forms.student.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        const id = document.getElementById('studentLoginId')?.value.trim();
        const pass = document.getElementById('studentLoginPass')?.value.trim();
        const btn = document.getElementById('studentLoginBtn');
        if (!id || !pass) {
          showAlert('Please enter both your Student ID and password.');
          return;
        }
        await executeLogin({ username: id, password: pass, userType: 'student' }, btn, 'Sign In as Student');
      });
    }

    // 2. Teacher Login Form Submit
    if (forms.teacher) {
      forms.teacher.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        const id = document.getElementById('teacherLoginId')?.value.trim();
        const pass = document.getElementById('teacherLoginPass')?.value.trim();
        const btn = document.getElementById('teacherLoginBtn');
        if (!id || !pass) {
          showAlert('Please enter both your Teacher ID and password.');
          return;
        }
        await executeLogin({ username: id, password: pass, userType: 'teacher' }, btn, 'Sign In as Teacher');
      });
    }

    // 3. Admin Login Form Submit
    if (forms.admin) {
      forms.admin.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        const user = document.getElementById('adminLoginUser')?.value.trim();
        const pass = document.getElementById('adminLoginPass')?.value.trim();
        const email = document.getElementById('adminLoginEmail')?.value.trim();
        const mfa = document.getElementById('adminLoginMfa')?.value.trim();
        const btn = document.getElementById('adminLoginBtn');
        if (!user || !pass) {
          showAlert('Please enter both your administrator username and password.');
          return;
        }
        if (!email) {
          showAlert('Admin sign-in requires your matching verified email address.');
          return;
        }
        await executeLogin({ username: user, password: pass, userType: 'admin', email: email, mfaCode: mfa }, btn, 'Sign In as Administrator');
      });
    }

    // 4. IE Developer Login Form Submit
    if (forms.ie) {
      forms.ie.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        const user = document.getElementById('ieLoginUser')?.value.trim();
        const pass = document.getElementById('ieLoginPass')?.value.trim();
        const btn = document.getElementById('ieLoginBtn');
        if (!user || !pass) {
          showAlert('Developer credentials required.');
          return;
        }

        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Authenticating to IE Console...';
        }

        try {
          const res = await API.callBackend('ieLogin', { username: user, password: pass }, 'Verifying developer access key...');
          if (res && res.success && res.token) {
            sessionStorage.setItem('ie_dev_token', res.token);
            App.showToast('Developer authentication verified. Opening Operations Console...', 'success');
            setTimeout(() => {
              window.location.href = 'ie-portal.html';
            }, 600);
          } else {
            showAlert(res.message || 'Invalid developer credentials.');
          }
        } catch (err) {
          showAlert('Network error connecting to developer backend.');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Authenticate & Open IE Console';
          }
        }
      });
    }

    // Forgot password triggers
    document.querySelectorAll('.forgot-pass-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPasswordModal();
      });
    });
  }

  async function executeLogin(payload, submitBtn, defaultBtnText) {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying credentials...';
    }

    try {
      const res = await API.callBackend('login', payload);

      if (res && res.success && res.sessionToken) {
        // Save session
        sessionStorage.setItem('sorina_session_token', res.sessionToken);
        sessionStorage.setItem('sorina_user_role', res.user.role || payload.userType);
        sessionStorage.setItem('sorina_user_data', JSON.stringify(res.user));

        App.showToast(`Welcome back, ${res.user.name || res.user.username}!`, 'success');

        // Transition from login to portal
        document.getElementById('loginScreen').classList.add('hidden');
        renderHeaderUser(res.user);
        await routeToRolePanel(res.user.role, res.user);
      } else {
        showAlert(res.message || 'Login failed. Please verify your credentials.');
      }
    } catch (err) {
      showAlert('Network error occurred during login. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultBtnText;
      }
    }
  }

  /**
   * Checks if user already has an active session in sessionStorage.
   */
  async function checkExistingSession() {
    const token = sessionStorage.getItem('sorina_session_token');
    const rawUser = sessionStorage.getItem('sorina_user_data');

    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const check = await API.callBackend('verifySession');
        if (check && check.success) {
          document.getElementById('loginScreen').classList.add('hidden');
          renderHeaderUser(user);
          await routeToRolePanel(user.role, user);
          return;
        }
      } catch (e) {
        // Invalid session
      }
      handleLogout();
    }
  }

  /**
   * Lazily loads and mounts the role panel module into #appRoot.
   */
  async function routeToRolePanel(role, user) {
    const appRoot = document.getElementById('appRoot');
    if (!appRoot) return;
    appRoot.innerHTML = '<div style="text-align: center; padding: 60px;"><div class="stat-label">Loading portal components...</div></div>';

    const r = String(role || '').toLowerCase();

    if (r === 'superadmin' || r === 'admin') {
      await loadScript('assets/js/admin.js');
      if (window.AdminPanel && typeof window.AdminPanel.mount === 'function') {
        window.AdminPanel.mount(appRoot, user);
      }
    } else if (r === 'teacher') {
      await loadScript('assets/js/teacher.js');
      if (window.TeacherPanel && typeof window.TeacherPanel.mount === 'function') {
        window.TeacherPanel.mount(appRoot, user);
      }
    } else {
      // Student / Parent
      await loadScript('assets/js/student.js');
      if (window.StudentPanel && typeof window.StudentPanel.mount === 'function') {
        window.StudentPanel.mount(appRoot, user);
      }
    }
  }

  function renderHeaderUser(user) {
    const container = document.getElementById('headerActions');
    if (!container) return;

    container.innerHTML = `
      <div class="user-badge" style="display: flex; align-items: center; gap: 6px;">
        ${user.photo ? `<img src="${escapeHtml(user.photo)}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.55);" alt="Profile">` : `<img src="assets/icons/circle-user-round.png" style="width: 16px; height: 16px;" alt="">`}
        <b>${escapeHtml(user.name || user.username)}</b>
        <span style="opacity: 0.8; font-size: 11px;">(${escapeHtml(user.role)})</span>
      </div>
      <button type="button" class="btn btn-light btn-sm" id="signOutBtn">Sign Out</button>
    `;

    const btn = document.getElementById('signOutBtn');
    if (btn) btn.onclick = handleLogout;
  }

  // Delegated global click listener: ensures ALL sidebar and settings logout buttons work immediately
  document.addEventListener('click', (e) => {
    const logoutTarget = e.target.closest('#signOutBtn, #adminLogoutBtn, #teacherLogoutBtn, #studentLogoutBtn, #adminSettingsLogoutBtn, #teacherSettingsSignOutBtn, #studentSettingsSignOutBtn, [data-action="logout"]');
    if (logoutTarget) {
      e.preventDefault();
      e.stopPropagation();
      handleLogout();
    }
  });

  async function handleLogout() {
    try {
      if (window.API && typeof window.API.callBackend === 'function') {
        window.API.callBackend('logout').catch(() => {});
      }
    } catch (e) {}

    try {
      sessionStorage.clear();
      localStorage.removeItem('sorina_session_token');
      localStorage.removeItem('sorina_user_role');
      localStorage.removeItem('sorina_user_data');
    } catch (e) {}

    const appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.innerHTML = '';

    const actions = document.getElementById('headerActions');
    if (actions) actions.innerHTML = '';

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.remove('hidden');

    hideAlert();
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('You have been signed out.', 'info');
    }

    setTimeout(() => {
      window.location.reload();
    }, 150);
  }

  function showForgotPasswordModal() {
    App.showModal({
      title: 'Reset Password',
      content: `
        <div style="font-size: 14px; line-height: 1.5;">
          <p>Enter your registered email address to receive password reset instructions:</p>
          <div class="form-group">
            <label class="form-label" for="resetEmail">Email Address:</label>
            <input type="email" id="resetEmail" class="input-field" placeholder="your.email@example.com" required>
          </div>
        </div>
      `,
      confirmText: 'Send Reset Link',
      onConfirm: async () => {
        const emailInput = document.getElementById('resetEmail');
        if (!emailInput || !emailInput.value.trim()) return;

        const res = await API.callBackend('forgotPassword', { email: emailInput.value.trim() });
        App.showToast(res.message || 'Reset instructions sent if email is found.', 'info');
      }
    });
  }

  function showAlert(msg) {
    const el = document.getElementById('loginAlert');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function hideAlert() {
    const el = document.getElementById('loginAlert');
    if (el) el.classList.add('hidden');
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const cleanSrc = src.split('?')[0];
      const existing = document.querySelector(`script[src*="${cleanSrc}"]`);
      if (existing) {
        existing.remove();
      }
      const s = document.createElement('script');
      s.src = src.includes('?') ? src : `${src}?t=${Date.now()}`;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.body.appendChild(s);
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

  const exportObj = {
    initLoginForm: initLoginForm,
    checkExistingSession: checkExistingSession,
    handleLogout: handleLogout,
    logout: handleLogout
  };

  window.Auth = exportObj;
  window.logout = handleLogout;

  return exportObj;
})();
