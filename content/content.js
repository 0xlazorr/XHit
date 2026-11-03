/**
 * XHit - Content Script Orchestrator
 * Connects the Engine and HUD with Chrome Runtime messaging
 */

(function () {
  // Prevent duplicate injection
  if (window.__XHIT_LOADED__) return;
  window.__XHIT_LOADED__ = true;

  console.log('[XHit] Initializing XHit Extension on', window.location.hostname);

  const engine = new window.XHitEngine();
  const hud = new window.XHitHUD(engine);

  // Auto-start after page navigation if triggered by stage transition or auto-redirect
  try {
    if (sessionStorage.getItem('xhit_auto_start') === '1') {
      sessionStorage.removeItem('xhit_auto_start');
      setTimeout(() => {
        engine.start();
      }, 1200);
    }
  } catch (e) {
    console.warn('[XHit] Could not check sessionStorage:', e);
  }

  // Message receiver from popup and background service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'CHECK_READY': {
        const user = engine.detectCurrentUser();
        sendResponse({
          ready: true,
          currentUser: user,
          url: window.location.href,
          snapshot: engine.getSnapshot()
        });
        break;
      }

      case 'START': {
        if (request.options) {
          engine.setOptions(request.options);
        }
        engine.start();
        sendResponse({ success: true, snapshot: engine.getSnapshot() });
        break;
      }

      case 'PAUSE': {
        engine.pause();
        sendResponse({ success: true, snapshot: engine.getSnapshot() });
        break;
      }

      case 'RESUME': {
        engine.resume();
        sendResponse({ success: true, snapshot: engine.getSnapshot() });
        break;
      }

      case 'STOP': {
        engine.stop();
        sendResponse({ success: true, snapshot: engine.getSnapshot() });
        break;
      }

      case 'SET_OPTIONS': {
        if (request.options) {
          engine.setOptions(request.options);
        }
        sendResponse({ success: true, snapshot: engine.getSnapshot() });
        break;
      }

      case 'GET_STATUS': {
        sendResponse({ success: true, snapshot: engine.getSnapshot() });
        break;
      }

      case 'SHOW_HUD': {
        hud.show();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
        break;
    }

    return true; // Keep message channel open for async response
  });
})();
