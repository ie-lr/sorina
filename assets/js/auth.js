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
    const emailGroup = document.getElementById('adminEmailGroup');
    const mfaGroup = document.getElementById('mfaCodeGroup');
    const userLabel = document.getElementById('usernameLabel');
    const userInput = document.getElementById('loginUsername');
    const heading = document.getElementById('loginHeading');
    const subtitle = document.getElementById('loginSubtitle');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeRole = tab.dataset.role;

        hideAlert();

        if (activeRole === 'admin') {
          userLabel.textContent = 'Administrator Username';
          userInput.placeholder = 'e.g. admin or Principal';
          heading.textContent = 'Administrator Sign In';
          subtitle.textContent = 'Authorized school administrators and staff only.';
          emailGroup.classList.remove('hidden');
          mfaGroup.classList.remove('hidden');
        } else if (activeRole === 'teacher') {
          userLabel.textContent = 'Teacher ID or Name';
          userInput.placeholder = 'e.g. TCH-101';
          heading.textContent = 'Teacher Portal Sign In';
          subtitle.textContent = 'Access your assigned classes, enter grades, and submit lesson plans.';
          emailGroup.classList.add('hidden');
          mfaGroup.classList.add('hidden');
        } else {
          // Student
          userLabel.textContent = 'Student ID';
          userInput.placeholder = 'e.g. STU-2026-001';
          heading.textContent = 'Student Portal Sign In';
          subtitle.textContent = 'Enter your Student ID and password to access your grades and records.';
          emailGroup.classList.add('hidden');
          mfaGroup.classList.add('hidden');
        }
      });
    });

    // Form submit
    const form = document.getElementById('gatewayLoginForm');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // Forgot password
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPasswordModal();
      });
    }
  }

  async function handleFormSubmit(e) {
    if (e) e.preventDefault();
    hideAlert();

    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const emailInput = document.getElementById('loginEmail');
    const mfaInput = document.getElementById('loginMfa');
    const submitBtn = document.getElementById('loginSubmitBtn');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const mfaCode = mfaInput ? mfaInput.value.trim() : '';

    if (!username || !password) {
      showAlert('Please enter both your identifier/username and password.');
      return;
    }

    if (activeRole === 'admin' && !email) {
      showAlert('Admin sign-in requires your verified administrator email address.');
      return;
    }

    // Button loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying credentials...';

    try {
      const payload = {
        username: username,
        password: password,
        userType: activeRole,
        email: email,
        mfaCode: mfaCode
      };

      const res = await API.callBackend('login', payload);

      if (res && res.success && res.sessionToken) {
        // Save session
        sessionStorage.setItem('sorina_session_token', res.sessionToken);
        sessionStorage.setItem('sorina_user_role', res.user.role || activeRole);
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
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Portal';
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
      <div class="user-badge">
        <span>👤</span>
        <b>${escapeHtml(user.name || user.username)}</b>
        <span style="opacity: 0.8; font-size: 11px;">(${escapeHtml(user.role)})</span>
      </div>
      <button type="button" class="btn btn-light btn-sm" id="signOutBtn">Sign Out</button>
    `;

    document.getElementById('signOutBtn').onclick = handleLogout;
  }

  async function handleLogout() {
    try {
      await API.callBackend('logout');
    } catch (e) {}

    sessionStorage.removeItem('sorina_session_token');
    sessionStorage.removeItem('sorina_user_role');
    sessionStorage.removeItem('sorina_user_data');

    const appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.innerHTML = '';

    const actions = document.getElementById('headerActions');
    if (actions) actions.innerHTML = '';

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.remove('hidden');

    hideAlert();
    App.showToast('You have been signed out.', 'info');
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
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
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

  return {
    initLoginForm: initLoginForm,
    checkExistingSession: checkExistingSession,
    handleLogout: handleLogout
  };
})();
