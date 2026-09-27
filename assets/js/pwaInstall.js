/**
 * pwaInstall.js
 * -----------------------------------------------------------------------
 * Drives the "Install App" / "Download App" button across all platforms (Section 7.1).
 * Supports native prompts (Android/Desktop) & manual instructions (iOS Safari).
 * Self-hides when already running in standalone mode.
 * -----------------------------------------------------------------------
 */

const PWA = (function () {
  let deferredPrompt = null;

  /** Registers the PWA service worker. */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch(err => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  /** Detects whether app is running in standalone/installed mode. */
  function isRunningStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  /** Sets up install prompt listener. */
  function initInstallPrompt() {
    const installBtn = document.getElementById('installAppBtn');
    if (!installBtn) return;

    if (isRunningStandalone()) {
      installBtn.classList.add('hidden');
      return;
    }

    // Android / Chrome / Edge native beforeinstallprompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.classList.remove('hidden');
      installBtn.innerHTML = '📲 Install App';
    });

    // Detect iOS Safari
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos && !isRunningStandalone()) {
      installBtn.classList.remove('hidden');
      installBtn.innerHTML = '📲 Add to Home Screen';
    }

    installBtn.addEventListener('click', handleInstallClick);

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      installBtn.classList.add('hidden');
      console.log('[PWA] App successfully installed.');
    });
  }

  /** Triggers native prompt or shows iOS Safari guide modal. */
  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
      }
      deferredPrompt = null;
      const installBtn = document.getElementById('installAppBtn');
      if (installBtn) installBtn.classList.add('hidden');
      return;
    }

    // If on iOS Safari, show instruction modal
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      showIosInstructions();
    } else {
      alert('To install this portal:\n- In Chrome/Edge: Click the install icon in the address bar.\n- On Mobile: Tap the browser menu (⋮) and select "Add to Home screen".');
    }
  }

  function showIosInstructions() {
    let modal = document.getElementById('iosInstallModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'iosInstallModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width: 400px; text-align: center;">
          <div class="modal-header">
            <h3>Install on iOS</h3>
            <button class="btn btn-light btn-sm" onclick="document.getElementById('iosInstallModal').remove()">✕</button>
          </div>
          <div style="padding: 10px 0; font-size: 14px; text-align: left; line-height: 1.6;">
            <p>To install <b>Sorina School Portal</b> on your iPhone or iPad:</p>
            <ol style="padding-left: 20px;">
              <li>Tap the <b>Share</b> button <span style="font-size: 18px;">⎋</span> at the bottom of Safari.</li>
              <li>Scroll down and tap <b>"Add to Home Screen"</b> <span style="font-size: 18px;">➕</span>.</li>
              <li>Tap <b>"Add"</b> in the top right corner.</li>
            </ol>
            <p style="color: var(--color-text-muted); font-size: 12px;">You can then launch the portal from your home screen just like a native app!</p>
          </div>
          <div class="modal-footer" style="justify-content: center;">
            <button class="btn btn-primary" onclick="document.getElementById('iosInstallModal').remove()">Got it</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  return {
    registerServiceWorker: registerServiceWorker,
    initInstallPrompt: initInstallPrompt,
    isRunningStandalone: isRunningStandalone
  };
})();
