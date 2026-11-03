/**
 * XHit - Enhanced Popup UI Controller
 * Interactive presets, segmented speed selector, audio FX toggle, and real-time synchronization
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Header & Context
  const headerStatus = document.getElementById('header-status');
  const statusLabel = document.getElementById('status-label');
  const btnAudioToggle = document.getElementById('btn-audio-toggle');
  const contextTitle = document.getElementById('context-title');
  const contextSubtitle = document.getElementById('context-subtitle');
  const userAvatarBadge = document.getElementById('user-avatar-badge');
  const btnOpenX = document.getElementById('btn-open-x');

  // Stats
  const statTotal = document.getElementById('stat-total');
  const statPosts = document.getElementById('stat-posts');
  const statReplies = document.getElementById('stat-replies');
  const statOther = document.getElementById('stat-other');

  // Presets
  const presetAll = document.getElementById('preset-all');
  const presetReplies = document.getElementById('preset-replies');
  const presetSocial = document.getElementById('preset-social');
  const presetPills = [presetAll, presetReplies, presetSocial];

  // Checkboxes
  const btnSelectAll = document.getElementById('btn-select-all');
  const chkPosts = document.getElementById('chk-posts');
  const chkReplies = document.getElementById('chk-replies');
  const chkReposts = document.getElementById('chk-reposts');
  const chkLikes = document.getElementById('chk-likes');
  const chkAllTabs = document.getElementById('chk-all-tabs');
  const chkDryRun = document.getElementById('chk-dry-run');

  // Speed Segmented Buttons
  const speedButtons = document.querySelectorAll('.speed-segment-btn');
  let currentSpeed = 'balanced';

  // Action Buttons
  const btnMainAction = document.getElementById('btn-main-action');
  const runningControls = document.getElementById('running-controls');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');

  // Footer Links
  const linkShowHud = document.getElementById('link-show-hud');
  const linkArchiveWiper = document.getElementById('link-archive-wiper');

  let activeTab = null;
  let isTwitterTab = false;
  let currentUser = null;
  let currentState = null;
  let audioEnabled = true;

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

  // 2. Context Presentation
  if (!isTwitterTab) {
    userAvatarBadge.textContent = '!';
    userAvatarBadge.style.borderColor = '#ef4444';
    contextTitle.textContent = 'Not on X / Twitter';
    contextSubtitle.textContent = 'Navigate to x.com to use XHit';
    btnOpenX.style.display = 'block';
    btnMainAction.disabled = true;
    btnMainAction.style.opacity = '0.5';
    btnMainAction.style.cursor = 'not-allowed';
  } else {
    pingContentScript();
  }

  function pingContentScript() {
    if (!activeTab) return;
    chrome.tabs.sendMessage(activeTab.id, { action: 'CHECK_READY' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        contextTitle.textContent = 'Connecting to X...';
        contextSubtitle.textContent = 'Please refresh x.com tab if stuck';
      } else {
        currentUser = response.currentUser;
        if (currentUser) {
          contextTitle.textContent = `@${currentUser}`;
          userAvatarBadge.textContent = currentUser.charAt(0).toUpperCase();
        } else {
          contextTitle.textContent = 'Connected to X.com';
          userAvatarBadge.textContent = '✓';
        }
        contextSubtitle.textContent = 'Active & Ready';
        if (response.snapshot) {
          syncUIWithSnapshot(response.snapshot);
        }
      }
    });
  }

  function syncUIWithSnapshot(snapshot) {
    currentState = snapshot;
    const { isRunning, isPaused, stats } = snapshot;

    statTotal.textContent = stats.total || 0;
    statPosts.textContent = stats.posts || 0;
    statReplies.textContent = stats.replies || 0;
    statOther.textContent = (stats.reposts || 0) + (stats.likes || 0);

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

  // Load saved settings
  chrome.storage.local.get(['xhit_settings', 'xhit_state'], (result) => {
    if (result.xhit_settings) {
      const s = result.xhit_settings;
      chkPosts.checked = s.deletePosts ?? true;
      chkReplies.checked = s.deleteReplies ?? true;
      chkReposts.checked = s.deleteReposts ?? true;
      chkLikes.checked = s.deleteLikes ?? true;
      chkAllTabs.checked = s.wipeAllTabs ?? true;
      chkDryRun.checked = s.dryRun ?? false;
      currentSpeed = s.speed || 'balanced';
      updateSpeedButtonsUI(currentSpeed);
      if (s.audioEnabled !== undefined) {
        audioEnabled = s.audioEnabled;
        btnAudioToggle.textContent = audioEnabled ? '🔊' : '🔇';
      }
    }
    if (result.xhit_state) {
      syncUIWithSnapshot(result.xhit_state);
    }
  });

  function saveCurrentSettings() {
    const settings = {
      deletePosts: chkPosts.checked,
      deleteReplies: chkReplies.checked,
      deleteReposts: chkReposts.checked,
      deleteLikes: chkLikes.checked,
      wipeAllTabs: chkAllTabs.checked,
      dryRun: chkDryRun.checked,
      speed: currentSpeed,
      audioEnabled
    };
    chrome.storage.local.set({ xhit_settings: settings });
    if (isTwitterTab && activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'SET_OPTIONS', options: settings });
    }
    return settings;
  }

  function updateSpeedButtonsUI(speed) {
    speedButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-speed') === speed);
    });
  }

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSpeed = btn.getAttribute('data-speed');
      updateSpeedButtonsUI(currentSpeed);
      saveCurrentSettings();
    });
  });

  // Presets Handlers
  function activatePreset(pill, posts, replies, reposts, likes, allTabs) {
    presetPills.forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');

    chkPosts.checked = posts;
    chkReplies.checked = replies;
    chkReposts.checked = reposts;
    chkLikes.checked = likes;
    chkAllTabs.checked = allTabs;
    saveCurrentSettings();
  }

  presetAll.addEventListener('click', () => {
    activatePreset(presetAll, true, true, true, true, true);
  });

  presetReplies.addEventListener('click', () => {
    activatePreset(presetReplies, false, true, false, false, false);
  });

  presetSocial.addEventListener('click', () => {
    activatePreset(presetSocial, false, false, true, true, true);
  });

  // Checkbox bindings
  [chkPosts, chkReplies, chkReposts, chkLikes, chkAllTabs, chkDryRun].forEach((el) => {
    el.addEventListener('change', () => {
      presetPills.forEach((p) => p.classList.remove('active'));
      saveCurrentSettings();
    });
  });

  // Master "Select Delete All"
  btnSelectAll.addEventListener('click', () => {
    activatePreset(presetAll, true, true, true, true, true);
    btnSelectAll.textContent = '✓ All Selected';
    setTimeout(() => {
      btnSelectAll.textContent = 'Select Delete All';
    }, 1500);
  });

  // Audio Toggle
  btnAudioToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    btnAudioToggle.textContent = audioEnabled ? '🔊' : '🔇';
    saveCurrentSettings();
  });

  // WIPE EVERYTHING NOW
  btnMainAction.addEventListener('click', () => {
    if (!isTwitterTab || !activeTab) return;

    const options = saveCurrentSettings();
    if (!options.deletePosts && !options.deleteReplies && !options.deleteReposts && !options.deleteLikes) {
      alert('Please select at least one category to delete!');
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

  btnOpenX.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_TWITTER_PROFILE' });
    window.close();
  });

  linkShowHud.addEventListener('click', () => {
    if (isTwitterTab && activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'SHOW_HUD' });
      window.close();
    }
  });

  linkArchiveWiper.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_ARCHIVE_VIEW' });
    window.close();
  });

  // Poll engine while popup is open
  const pollInterval = setInterval(() => {
    if (isTwitterTab && activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' }, (res) => {
        if (!chrome.runtime.lastError && res && res.snapshot) {
          syncUIWithSnapshot(res.snapshot);
        }
      });
    }
  }, 500);

  window.addEventListener('unload', () => {
    clearInterval(pollInterval);
  });
});
