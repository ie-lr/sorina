/**
 * api.js
 * -----------------------------------------------------------------------
 * Fetch wrapper for communicating with the Apps Script Web App backend.
 * 
 * Features:
 * - Global loader overlay for every action.
 * - Subtle {Success} toast for major requests, suppressing noisy browser alerts.
 * - Automatic offline data storage and background synchronization.
 * - Token management and IDOR-safe headers.
 * -----------------------------------------------------------------------
 */

const API = (function () {
  let activeRequests = 0;
  const OFFLINE_QUEUE_KEY = 'ie_offline_sync_queue';

  function getBackendUrl() {
    const cfg = String((window.APP_CONFIG && window.APP_CONFIG.backendUrl) || '').trim();
    if (cfg) return cfg; // config.js is the single source of truth
    return String(localStorage.getItem('sorina_backend_url') || '').trim();
  }

  function setBackendUrl(url) {
    if (url) localStorage.setItem('sorina_backend_url', url.trim());
  }

  /**
   * Shows global loader overlay.
   */
  function showLoader(msg = 'Processing...') {
    activeRequests++;
    const loader = document.getElementById('globalLoader');
    if (loader) {
      const textEl = loader.querySelector('.loader-text');
      if (textEl) textEl.textContent = msg;
      loader.classList.remove('hidden');
    }
  }

  /**
   * Hides global loader overlay when all requests resolve.
   */
  function hideLoader() {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      const loader = document.getElementById('globalLoader');
      if (loader) loader.classList.add('hidden');
    }
  }

  /**
   * Displays a clean, non-intrusive {Success} badge / toast at top-right.
   */
  function toastSuccess(customText = '{Success}') {
    const toast = document.getElementById('globalToast');
    if (!toast) return;
    toast.textContent = customText;
    toast.classList.remove('hidden', 'fade-out');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.classList.remove('show', 'fade-out');
        toast.classList.add('hidden');
      }, 300);
    }, 2500);
  }

  /**
   * Displays an alert/notification toast.
   */
  function toastNotification(text, isError = false) {
    const toast = document.getElementById('globalToast');
    if (!toast) return;
    toast.textContent = text;
    toast.style.background = isError ? 'var(--color-danger, #d32f2f)' : 'var(--color-primary, #082f50)';
    toast.classList.remove('hidden', 'fade-out');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.classList.remove('show', 'fade-out');
        toast.classList.add('hidden');
        toast.style.background = '';
      }, 300);
    }, 3000);
  }

  /**
   * Attaches session token.
   */
  function withSession(payload) {
    const token = sessionStorage.getItem('sorina_session_token');
    const out = Object.assign({}, payload);
    if (token) out.sessionToken = token;
    return out;
  }

  /**
   * Returns offline queue.
   */
  function getOfflineQueue() {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Adds an action to offline queue for automatic sync when internet connects.
   */
  function queueOfflineAction(action, payload) {
    const queue = getOfflineQueue();
    queue.push({
      id: 'OFFLINE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      action: action,
      payload: payload,
      queuedAt: new Date().toISOString()
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    toastSuccess('{Saved Locally - Offline}');
    updateOfflineStatusUI();
  }

  /**
   * Flushes offline queue automatically when back online.
   */
  async function syncOfflineQueue() {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    console.info(`[OfflineSync] Syncing ${queue.length} pending operations...`);
    const remaining = [];

    for (const item of queue) {
      try {
        const res = await callBackendDirect(item.action, item.payload);
        if (!res.success && res.message && res.message.includes('Could not connect')) {
          remaining.push(item);
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    updateOfflineStatusUI();
    if (remaining.length === 0) {
      toastSuccess('{Sync Complete}');
    }
  }

  /**
   * Updates offline banner UI.
   */
  function updateOfflineStatusUI() {
    const banner = document.getElementById('offlineIndicator');
    const queue = getOfflineQueue();
    if (!banner) return;

    if (!navigator.onLine) {
      banner.textContent = `You are currently offline. ${queue.length > 0 ? `(${queue.length} changes queued to sync)` : 'System is storing changes locally.'}`;
      banner.classList.remove('hidden');
    } else if (queue.length > 0) {
      banner.textContent = `Syncing ${queue.length} offline changes...`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // Network connection event listeners
  window.addEventListener('online', () => {
    updateOfflineStatusUI();
    syncOfflineQueue();
  });
  window.addEventListener('offline', () => {
    updateOfflineStatusUI();
  });

  /**
   * Direct fetch without triggering loader or recursive queue.
   */
  async function callBackendDirect(action, payload = {}) {
    const url = getBackendUrl();
    const bodyData = withSession(Object.assign({ action: action }, payload));

    if (!url) {
      return { success: false, message: 'Backend URL is not configured. No data can be read or saved.' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData)
    });
    return await res.json();
  }

  /**
   * Sends an action to backend with global loader and truthful status reporting.
   * @param {string} action
   * @param {Object} [payload={}]
   * @param {string} [loaderText='Processing...']
   * @return {Promise<Object>}
   */
  async function callBackend(action, payload = {}, loaderText = 'Processing...') {
    showLoader(loaderText);

    const isWriteAction = [
      'addStudent', 'updateStudent', 'deleteStudent', 'dropStudent', 'undropStudent', 'setGradeLock',
      'saveTeacher', 'deleteTeacher', 'submitGrades', 'teacherSubmitGrades',
      'recordPayment', 'saveFinance', 'clearFinance', 'saveClassFee', 'saveFeeItem', 'deleteFeeItem',
      'saveExpense', 'deleteExpense',
      'saveLessonPlan', 'reviewLessonPlan',
      'sendMessage', 'adminSendIeMessage', 'markMessagesRead',
      'createAdmin', 'updateAdminProfile', 'updateAdminPermissions', 'removeAdmin',
      'sendIdCardsToPrinting',
      'addSubject', 'updateSubject', 'deleteSubject', 'saveSubjects', 'saveCurriculumSubjects', 'savePermissions',
      'updateSettings', 'saveAnnouncement', 'deleteAnnouncement', 'changePassword'
    ].includes(action);

    // If offline and attempting grade submission, block offline queueing and return immediate error
    if (!navigator.onLine && (action === 'submitGrades' || action === 'teacherSubmitGrades')) {
      hideLoader();
      const errorMsg = 'Cannot submit grades while offline. Please restore your internet connection and reload the grade sheet.';
      toastNotification(errorMsg, true);
      return { success: false, offline: true, message: errorMsg };
    }

    // If completely offline and this is a write action, queue it and inform caller
    if (!navigator.onLine && isWriteAction) {
      queueOfflineAction(action, payload);
      hideLoader();
      return { success: false, offline: true, message: 'You are currently offline. Changes queued to sync when internet reconnects.' };
    }

    const url = getBackendUrl();
    const bodyData = withSession(Object.assign({ action: action }, payload));

    if (!url) {
      hideLoader();
      const msg = 'The school system is not connected to its database yet. Please contact the school administrator.';
      toastNotification(msg, true);
      return { success: false, message: msg };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyData)
      });

      hideLoader();

      if (!res.ok) {
        console.error(`[API:HTTPError] Backend responded with HTTP ${res.status} for action "${action}".`);
        const msg = res.status === 404
          ? 'Backend endpoint returned 404 Not Found. Ensure your Google Apps Script Web App is deployed with "Who has access" set to "Anyone".'
          : `Backend server error (${res.status}). Database could not process this request.`;
        toastNotification(msg, true);
        return { success: false, message: msg };
      }

      const json = await res.json();

      // Check if system operation is suspended
      if (json && json.suspended) {
        toastNotification(json.message || 'System suspended by administration.', true);
      }

      return json;

    } catch (err) {
      hideLoader();
      console.error('[API:NetworkError]', err);

      // If network fails on a write action, alert the user and do NOT claim success
      if (isWriteAction) {
        const errorMsg = 'Failed to reach database: ' + (err.message || 'Network error') + '. Check your internet connection or Google Apps Script deployment URL.';
        toastNotification(errorMsg, true);
        return {
          success: false,
          offline: true,
          message: errorMsg
        };
      }

      // No local fallback: only real database results are ever shown.
      return {
        success: false,
        message: 'Could not reach the database: ' + (err.message || 'network error') + '.'
      };
    }
  }
  // Initial status check
  setTimeout(updateOfflineStatusUI, 300);

  return {
    callBackend: callBackend,
    withSession: withSession,
    getBackendUrl: getBackendUrl,
    setBackendUrl: setBackendUrl,
    showLoader: showLoader,
    hideLoader: hideLoader,
    toastSuccess: toastSuccess,
    toastNotification: toastNotification,
    syncOfflineQueue: syncOfflineQueue
  };
})();
