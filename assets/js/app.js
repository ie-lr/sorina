/**
 * app.js
 * -----------------------------------------------------------------------
 * Application bootstrap: loads dynamic branding from Settings,
 * initializes login form, PWA installation, and session restoration.
 * -----------------------------------------------------------------------
 */

const App = (function () {
  let appSettings = null;

  async function initApp() {
    // 1. Fetch & Apply School Branding
    await applyBranding();

    // 2. Initialize PWA
    PWA.registerServiceWorker();
    PWA.initInstallPrompt();

    // 3. Initialize Gateway Login Form
    Auth.initLoginForm();

    // 4. Wire Endpoint Config Link
    wireEndpointConfig();

    // 5. Check if user already has an active session
    await Auth.checkExistingSession();
  }

  /**
   * Fetches settings from backend and applies them to page title, header, and tokens.
   */
  async function applyBranding() {
    try {
      const res = await API.callBackend('getSettings');
      if (res && res.success && res.settings) {
        appSettings = res.settings;
        try { localStorage.setItem('_sorina_school_settings_cache', JSON.stringify(appSettings)); } catch(e) {}

        const schoolName = appSettings.schoolName || 'Sorina Daycare & Primary School System';
        const motto = appSettings.schoolMotto || 'Excellence in Knowledge, Character & Integrity';
        const logo = appSettings.logoUrl || 'assets/images/school-logo.png';

        // Update document title
        document.title = schoolName;

        // Update Header elements
        const nameEl = document.getElementById('headerSchoolName');
        const mottoEl = document.getElementById('headerMotto');
        const logoEl = document.getElementById('headerLogo');

        if (nameEl) nameEl.textContent = schoolName;
        if (mottoEl) mottoEl.textContent = motto;
        if (logoEl && logo) logoEl.src = logo;

        // Update Gateway Pane elements
        const paneName = document.getElementById('paneSchoolName');
        const paneMotto = document.getElementById('paneMotto');
        const paneLogo = document.getElementById('paneLogo');

        if (paneName) paneName.textContent = schoolName;
        if (paneMotto) paneMotto.textContent = motto;
        if (paneLogo && logo) paneLogo.src = logo;

        // Apply custom brand colors if provided
        if (appSettings.primaryColor) {
          document.documentElement.style.setProperty('--color-primary', appSettings.primaryColor);
        }
        if (appSettings.secondaryColor) {
          document.documentElement.style.setProperty('--color-secondary', appSettings.secondaryColor);
        }
        if (appSettings.accentColor) {
          document.documentElement.style.setProperty('--color-accent', appSettings.accentColor);
        }
      }
    } catch (e) {
      try { const cached=JSON.parse(localStorage.getItem('_sorina_school_settings_cache')||'null'); if(cached){ appSettings=cached; } } catch(_) {}
      console.warn('Could not load custom branding:', e);
    }
  }

  /**
   * Modal dialog to configure backend Web App URL for deployment.
   */
  function wireEndpointConfig() {
    const link = document.getElementById('backendSettingsLink');
    if (!link) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const currentUrl = API.getBackendUrl();
      showModal({
        title: 'Backend Web App Endpoint Configuration',
        content: `
          <div style="font-size: 13.5px; line-height: 1.6; color: var(--color-text);">
            <p>Paste the deployed <b>Google Apps Script Web App URL</b> below:</p>
            <div class="form-group">
              <label class="form-label" for="cfgBackendUrl">Web App URL (exec):</label>
              <input type="url" id="cfgBackendUrl" class="input-field" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHtml(currentUrl)}">
              <div class="form-hint">Leave blank to use the built-in offline simulation mode.</div>
            </div>
          </div>
        `,
        confirmText: 'Save Endpoint',
        onConfirm: () => {
          const input = document.getElementById('cfgBackendUrl');
          if (input) {
            API.setBackendUrl(input.value.trim());
            showToast('Endpoint configuration saved.', 'success');
            applyBranding();
          }
        }
      });
    });
  }

  /**
   * Helper to display a clean modal dialog.
   */
  function showModal({ title, content, confirmText = 'OK', cancelText = 'Cancel', onConfirm = null }) {
    const container = document.getElementById('modalContainer');
    if (!container) return;

    const modalId = 'modal_' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="btn btn-light btn-sm close-modal-btn">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <button class="btn btn-light cancel-modal-btn">${escapeHtml(cancelText)}</button>
          <button class="btn btn-primary confirm-modal-btn">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    container.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.close-modal-btn').onclick = close;
    modal.querySelector('.cancel-modal-btn').onclick = close;
    modal.querySelector('.confirm-modal-btn').onclick = async () => {
      const btn = modal.querySelector('.confirm-modal-btn');
      if (!onConfirm) { close(); return; }
      try {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Processing...';
        const result = await onConfirm();
        if (result !== false) close();
        else { btn.disabled = false; btn.textContent = btn.dataset.originalText || 'Confirm'; }
      } catch (err) {
        console.error('[Modal] confirm action failed', err);
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Confirm';
        if (window.API && API.toastNotification) API.toastNotification(err.message || 'Unable to complete this action.', true);
      }
    };
  }

  /**
   * Helper to show a temporary toast alert.
   */
  function showToast(message, type = 'info') {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        border-radius: var(--radius-sm);
        font-weight: 600;
        font-size: 14px;
        z-index: 2000;
        box-shadow: var(--shadow-lg);
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    if (type === 'success') {
      toast.style.background = 'var(--color-success)';
      toast.style.color = '#ffffff';
    } else if (type === 'error') {
      toast.style.background = 'var(--color-danger)';
      toast.style.color = '#ffffff';
    } else {
      toast.style.background = 'var(--color-primary)';
      toast.style.color = '#ffffff';
    }

    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 3500);
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
    initApp: initApp,
    applyBranding: applyBranding,
    showModal: showModal,
    showToast: showToast,
    getSettings: () => appSettings || (() => { try { return JSON.parse(localStorage.getItem('_sorina_school_settings_cache')||'null'); } catch(e){ return null; } })()
  };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', App.initApp);
