/**
 * XHit - Background Service Worker (Manifest V3)
 * Manages badge counters, cross-tab events, and extension lifecycle
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[XHit] Extension installed / updated:', details.reason);

  // Set default initial state in storage
  chrome.storage.local.set({
    xhit_settings: {
      speed: 'balanced',
      wipeAllTabs: true,
      deletePosts: true,
      deleteReplies: true,
      deleteReposts: true,
      deleteLikes: true,
      dryRun: false
    }
  });

  // Set badge appearance
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
});

// Update badge when deletion progress updates
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.xhit_state) {
    const state = changes.xhit_state.newValue;
    if (state && state.isRunning) {
      const count = state.stats?.total || 0;
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : 'ON' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// Message listener for background tasks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_ARCHIVE_VIEW') {
    chrome.tabs.create({ url: chrome.runtime.getURL('archive/archive.html') });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'OPEN_TWITTER_PROFILE') {
    const handle = request.handle || '';
    chrome.tabs.create({ url: handle ? `https://x.com/${handle}` : 'https://x.com/' });
    sendResponse({ success: true });
    return true;
  }

  // Retrieve Twitter/X session cookies for background & archive wiper execution
  if (request.action === 'GET_SESSION_TOKENS') {
    chrome.cookies.get({ url: 'https://x.com', name: 'ct0' }, (ct0Cookie) => {
      chrome.cookies.get({ url: 'https://x.com', name: 'auth_token' }, (authCookie) => {
        sendResponse({
          success: !!ct0Cookie,
          ct0: ct0Cookie ? ct0Cookie.value : null,
          authToken: authCookie ? authCookie.value : null
        });
      });
    });
    return true;
  }

  // Keep-alive heartbeat for long-running batch deletions
  if (request.action === 'KEEP_ALIVE') {
    sendResponse({ alive: true, timestamp: Date.now() });
    return true;
  }
});
