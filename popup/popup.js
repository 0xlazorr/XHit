/**
 * XHit - Popup UI Controller
 * Handles user controls, target toggles, real-time status, and tab communication
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const headerStatus = document.getElementById('header-status');
  const statusLabel = document.getElementById('status-label');
  const contextCard = document.getElementById('context-card');
  const contextIcon = document.getElementById('context-icon');
  const contextTitle = document.getElementById('context-title');
  const contextSubtitle = document.getElementById('context-subtitle');
  const btnOpenX = document.getElementById('btn-open-x');

  // Stats
  const statTotal = document.getElementById('stat-total');
  const statPosts = document.getElementById('stat-posts');
  const statReplies = document.getElementById('stat-replies');
  const statOther = document.getElementById('stat-other');

  // Checkboxes & Settings
  const btnSelectAll = document.getElementById('btn-select-all');
  const chkPosts = document.getElementById('chk-posts');
  const chkReplies = document.getElementById('chk-replies');
  const chkReposts = document.getElementById('chk-reposts');
  const chkLikes = document.getElementById('chk-likes');
  const chkAllTabs = document.getElementById('chk-all-tabs');
  const chkDryRun = document.getElementById('chk-dry-run');
  const selectSpeed = document.getElementById('select-speed');

  // Action buttons
  const btnMainAction = document.getElementById('btn-main-action');
  const btnMainText = document.getElementById('btn-main-text');
  const runningControls = document.getElementById('running-controls');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');

  // Footer links
  const linkShowHud = document.getElementById('link-show-hud');
  const linkArchiveWiper = document.getElementById('link-archive-wiper');

  let activeTab = null;
  let isTwitterTab = false;
  let currentUser = null;
  let currentState = null;

  // 1. Detect Active Tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
    if (activeTab && activeTab.url) {
      const url = new URL(activeTab.url);
      isTwitterTab = url.hostname === 'x.com' || url.hostname === 'twitter.com';
    }
  } catch (err) {
    console.error('Error querying tab:', err);
  }

  // 2. Update Context Card
  if (!isTwitterTab) {
    contextIcon.textContent = '⚠️';
    contextTitle.textContent = 'Not on X / Twitter';
    contextSubtitle.textContent = 'Navigate to x.com to use XHit';
    btnOpenX.style.display = 'block';
    btnMainAction.disabled = true;
    btnMainAction.style.opacity = '0.5';
    btnMainAction.style.cursor = 'not-allowed';
  } else {
    // Ping content script to verify connection
    pingContentScript();
  }

  // Helper: Ping content script
  function pingContentScript() {
    if (!activeTab) return;
    chrome.tabs.sendMessage(activeTab.id, { action: 'CHECK_READY' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        contextIcon.textContent = '⏳';
        contextTitle.textContent = 'Connecting to X...';
        contextSubtitle.textContent = 'Please refresh x.com tab if stuck';
      } else {
        currentUser = response.currentUser;
        contextIcon.textContent = '✓';
        contextTitle.textContent = currentUser ? `@${currentUser}` : 'Connected to X.com';
        contextSubtitle.textContent = 'Ready to clean';
        if (response.snapshot) {
          syncUIWithSnapshot(response.snapshot);
        }
      }
    });
  }

  // Helper: Sync UI with engine snapshot
  function syncUIWithSnapshot(snapshot) {
    currentState = snapshot;
    const { isRunning, isPaused, stats, options } = snapshot;

    // Update stats
    statTotal.textContent = stats.total || 0;
    statPosts.textContent = stats.posts || 0;
    statReplies.textContent = stats.replies || 0;
    statOther.textContent = (stats.reposts || 0) + (stats.likes || 0);

    // Update running controls
    if (isRunning) {
      headerStatus.classList.add('running');
      statusLabel.textContent = isPaused ? 'Paused' : 'Wiping...';
      btnMainAction.style.display = 'none';
      runningControls.style.display = 'flex';
      btnPause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
    } else {
      headerStatus.classList.remove('running');
      statusLabel.textContent = 'Ready';
      btnMainAction.style.display = 'flex';
      runningControls.style.display = 'none';
    }
  }

  // Load saved settings from chrome.storage
  chrome.storage.local.get(['xhit_settings', 'xhit_state'], (result) => {
    if (result.xhit_settings) {
      const s = result.xhit_settings;
      chkPosts.checked = s.deletePosts ?? true;
      chkReplies.checked = s.deleteReplies ?? true;
      chkReposts.checked = s.deleteReposts ?? true;
      chkLikes.checked = s.deleteLikes ?? true;
      chkAllTabs.checked = s.wipeAllTabs ?? true;
      chkDryRun.checked = s.dryRun ?? false;
      selectSpeed.value = s.speed || 'balanced';
    }
    if (result.xhit_state) {
      syncUIWithSnapshot(result.xhit_state);
    }
  });

  // Save settings helper
  function saveCurrentSettings() {
    const settings = {
      deletePosts: chkPosts.checked,
      deleteReplies: chkReplies.checked,
      deleteReposts: chkReposts.checked,
      deleteLikes: chkLikes.checked,
      wipeAllTabs: chkAllTabs.checked,
      dryRun: chkDryRun.checked,
      speed: selectSpeed.value
    };
    chrome.storage.local.set({ xhit_settings: settings });
    if (isTwitterTab && activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'SET_OPTIONS', options: settings });
    }
    return settings;
  }

  // Bind change listeners
  [chkPosts, chkReplies, chkReposts, chkLikes, chkAllTabs, chkDryRun, selectSpeed].forEach((el) => {
    el.addEventListener('change', saveCurrentSettings);
  });

  // "Select Delete All" Master Toggle
  btnSelectAll.addEventListener('click', () => {
    chkPosts.checked = true;
    chkReplies.checked = true;
    chkReposts.checked = true;
    chkLikes.checked = true;
    chkAllTabs.checked = true;
    saveCurrentSettings();

    // Visual button feedback
    btnSelectAll.textContent = '✓ All Selected';
    setTimeout(() => {
      btnSelectAll.textContent = 'Select Delete All';
    }, 1500);
  });

  // Main Action: WIPE EVERYTHING NOW
  btnMainAction.addEventListener('click', () => {
    if (!isTwitterTab || !activeTab) return;

    const options = saveCurrentSettings();

    // Check if at least one category selected
    if (!options.deletePosts && !options.deleteReplies && !options.deleteReposts && !options.deleteLikes) {
      alert('Please select at least one target to delete!');
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, { action: 'START', options }, (res) => {
      if (res && res.snapshot) {
        syncUIWithSnapshot(res.snapshot);
      }
    });
  });

  // Pause / Resume
  btnPause.addEventListener('click', () => {
    if (!isTwitterTab || !activeTab) return;
    const action = currentState?.isPaused ? 'RESUME' : 'PAUSE';
    chrome.tabs.sendMessage(activeTab.id, { action }, (res) => {
      if (res && res.snapshot) {
        syncUIWithSnapshot(res.snapshot);
      }
    });
  });

  // Stop
  btnStop.addEventListener('click', () => {
    if (!isTwitterTab || !activeTab) return;
    chrome.tabs.sendMessage(activeTab.id, { action: 'STOP' }, (res) => {
      if (res && res.snapshot) {
        syncUIWithSnapshot(res.snapshot);
      }
    });
  });

  // Open X Tab Button
  btnOpenX.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_TWITTER_PROFILE' });
    window.close();
  });

  // Show Floating HUD Link
  linkShowHud.addEventListener('click', () => {
    if (isTwitterTab && activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'SHOW_HUD' });
      window.close();
    }
  });

  // Archive Wiper Link
  linkArchiveWiper.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_ARCHIVE_VIEW' });
    window.close();
  });

  // Polling interval while popup is open to keep live stats in sync
  const pollInterval = setInterval(() => {
    if (isTwitterTab && activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' }, (res) => {
        if (!chrome.runtime.lastError && res && res.snapshot) {
          syncUIWithSnapshot(res.snapshot);
        }
      });
    }
  }, 600);

  window.addEventListener('unload', () => {
    clearInterval(pollInterval);
  });
});
