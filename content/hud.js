/**
 * XHit - In-Page Floating HUD Dock
 * Injects a modern, non-intrusive floating control widget directly on X (Twitter).
 */

class XHitHUD {
  constructor(engine) {
    this.engine = engine;
    this.root = null;
    this.card = null;
    this.isMinimized = false;
    this.init();
  }

  init() {
    if (document.getElementById('xhit-hud-root')) {
      return;
    }

    this.root = document.createElement('div');
    this.root.id = 'xhit-hud-root';
    this.root.innerHTML = this.renderTemplate();
    document.documentElement.appendChild(this.root);

    this.card = this.root.querySelector('.xhit-card');
    this.bindEvents();
    this.bindEngine();
  }

  renderTemplate() {
    return `
      <div class="xhit-card">
        <!-- Header -->
        <div class="xhit-header" id="xhit-drag-handle">
          <div class="xhit-brand">
            <div class="xhit-logo-icon">✕</div>
            <div class="xhit-title">X<span>Hit</span></div>
          </div>
          <div class="xhit-header-actions">
            <button class="xhit-icon-btn" id="xhit-btn-minimize" title="Minimize / Expand">_</button>
            <button class="xhit-icon-btn" id="xhit-btn-close" title="Hide HUD">×</button>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="xhit-status-bar">
          <div class="xhit-badge xhit-badge-idle" id="xhit-status-badge">
            <span class="xhit-badge-dot"></span>
            <span id="xhit-status-text">Ready</span>
          </div>
          <div class="xhit-user-tag" id="xhit-user-tag">@detecting...</div>
        </div>

        <!-- Body -->
        <div class="xhit-body">
          <!-- Stats Grid -->
          <div class="xhit-stats-grid">
            <div class="xhit-stat-box highlight">
              <span class="xhit-stat-label">Total Wiped</span>
              <span class="xhit-stat-num" id="xhit-stat-total">0</span>
            </div>
            <div class="xhit-stat-box">
              <span class="xhit-stat-label">Posts</span>
              <span class="xhit-stat-num" id="xhit-stat-posts">0</span>
            </div>
            <div class="xhit-stat-box">
              <span class="xhit-stat-label">Replies</span>
              <span class="xhit-stat-num" id="xhit-stat-replies">0</span>
            </div>
            <div class="xhit-stat-box">
              <span class="xhit-stat-label">Reposts/Likes</span>
              <span class="xhit-stat-num" id="xhit-stat-other">0</span>
            </div>
          </div>

          <!-- Controls -->
          <div class="xhit-controls">
            <button class="xhit-btn xhit-btn-primary" id="xhit-action-btn">
              ⚡ Wipe All
            </button>
            <button class="xhit-btn xhit-btn-secondary" id="xhit-pause-btn" style="display: none;">
              ⏸ Pause
            </button>
            <button class="xhit-btn xhit-btn-danger" id="xhit-stop-btn" style="display: none;">
              ⏹ Stop
            </button>
          </div>

          <!-- Activity Log Area -->
          <div class="xhit-log-area" id="xhit-log-area">
            <div class="xhit-log-entry active">Ready to clean profile.</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="xhit-footer">
          <label class="xhit-option-row" title="Simulate without actually deleting">
            <input type="checkbox" id="xhit-chk-dryrun">
            <span>Dry Run</span>
          </label>
          <label class="xhit-option-row" title="Automatically advance: Posts -> Replies -> Likes">
            <input type="checkbox" id="xhit-chk-alltabs" checked>
            <span>All Tabs</span>
          </label>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const minBtn = this.root.querySelector('#xhit-btn-minimize');
    const closeBtn = this.root.querySelector('#xhit-btn-close');
    const actionBtn = this.root.querySelector('#xhit-action-btn');
    const pauseBtn = this.root.querySelector('#xhit-pause-btn');
    const stopBtn = this.root.querySelector('#xhit-stop-btn');
    const dryRunChk = this.root.querySelector('#xhit-chk-dryrun');
    const allTabsChk = this.root.querySelector('#xhit-chk-alltabs');
    const dragHandle = this.root.querySelector('#xhit-drag-handle');

    // Minimize toggle
    minBtn.addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      this.card.classList.toggle('xhit-minimized', this.isMinimized);
      minBtn.textContent = this.isMinimized ? '□' : '_';
    });

    // Close HUD (can be re-opened from extension popup)
    closeBtn.addEventListener('click', () => {
      this.root.style.display = 'none';
    });

    // Action button (Start Wipe)
    actionBtn.addEventListener('click', () => {
      if (!this.engine.isRunning) {
        this.engine.start();
      }
    });

    // Pause / Resume
    pauseBtn.addEventListener('click', () => {
      if (this.engine.isPaused) {
        this.engine.resume();
      } else {
        this.engine.pause();
      }
    });

    // Stop
    stopBtn.addEventListener('click', () => {
      this.engine.stop();
    });

    // Options checkboxes
    dryRunChk.addEventListener('change', (e) => {
      this.engine.setOptions({ dryRun: e.target.checked });
      this.log(`Dry-run mode ${e.target.checked ? 'enabled' : 'disabled'}`);
    });

    allTabsChk.addEventListener('change', (e) => {
      this.engine.setOptions({ wipeAllTabs: e.target.checked });
    });

    // Dragging support
    this.setupDraggable(dragHandle);

    // Initial user detection
    const user = this.engine.detectCurrentUser();
    const userTag = this.root.querySelector('#xhit-user-tag');
    if (user) {
      userTag.textContent = `@${user}`;
    }
  }

  bindEngine() {
    this.engine.onUpdate((event, data) => {
      this.updateUI(event, data);
    });
  }

  updateUI(event, data) {
    const statusBadge = this.root.querySelector('#xhit-status-badge');
    const statusText = this.root.querySelector('#xhit-status-text');
    const userTag = this.root.querySelector('#xhit-user-tag');

    const totalEl = this.root.querySelector('#xhit-stat-total');
    const postsEl = this.root.querySelector('#xhit-stat-posts');
    const repliesEl = this.root.querySelector('#xhit-stat-replies');
    const otherEl = this.root.querySelector('#xhit-stat-other');

    const actionBtn = this.root.querySelector('#xhit-action-btn');
    const pauseBtn = this.root.querySelector('#xhit-pause-btn');
    const stopBtn = this.root.querySelector('#xhit-stop-btn');

    // Update username
    if (data.currentUser) {
      userTag.textContent = `@${data.currentUser}`;
    }

    // Update stats
    if (data.stats) {
      totalEl.textContent = data.stats.total || 0;
      postsEl.textContent = data.stats.posts || 0;
      repliesEl.textContent = data.stats.replies || 0;
      otherEl.textContent = (data.stats.reposts || 0) + (data.stats.likes || 0);
    }

    // Update Buttons & Status Badge
    if (data.isRunning) {
      actionBtn.style.display = 'none';
      pauseBtn.style.display = 'flex';
      stopBtn.style.display = 'flex';

      if (data.isPaused) {
        statusBadge.className = 'xhit-badge xhit-badge-paused';
        statusText.textContent = 'Paused';
        pauseBtn.textContent = '▶ Resume';
      } else {
        statusBadge.className = 'xhit-badge xhit-badge-running';
        statusText.textContent = 'Wiping...';
        pauseBtn.textContent = '⏸ Pause';
      }
    } else {
      actionBtn.style.display = 'flex';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      statusBadge.className = 'xhit-badge xhit-badge-idle';
      statusText.textContent = 'Ready';
    }

    // Handle specific event logs
    if (event === 'item_deleted') {
      const prefix = data.options?.dryRun ? '[DRY RUN] Would delete' : 'Deleted';
      this.log(`${prefix} ${data.type || 'Item'}`);
    } else if (event === 'cooldown') {
      this.log(`Rate limit cooldown: ${data.secondsLeft}s left`, 'warning');
    } else if (event === 'transition') {
      this.log(`Navigating to ${data.nextStage}...`, 'active');
    } else if (event === 'completed') {
      this.log('✨ All targets wiped clean!', 'active');
      statusText.textContent = 'Completed!';
    } else if (event === 'scrolling') {
      this.log(`Scanning older posts (scroll #${data.attempt})...`);
    } else if (event === 'toast_warning') {
      this.log(data.message, 'warning');
    } else if (event === 'redirecting') {
      this.log(`Redirecting to profile @${data.user}...`, 'active');
    }
  }

  log(msg, type = '') {
    const logArea = this.root.querySelector('#xhit-log-area');
    if (!logArea) return;

    const entry = document.createElement('div');
    entry.className = `xhit-log-entry ${type}`;
    const time = new Date().toLocaleTimeString().split(' ')[0];
    entry.textContent = `[${time}] ${msg}`;

    logArea.appendChild(entry);
    while (logArea.children.length > 5) {
      logArea.removeChild(logArea.firstChild);
    }
    logArea.scrollTop = logArea.scrollHeight;
  }

  setupDraggable(handle) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.root.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      // Switch positioning to top/left on drag
      this.root.style.bottom = 'auto';
      this.root.style.right = 'auto';
      this.root.style.left = `${initialX}px`;
      this.root.style.top = `${initialY}px`;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = initialX + dx;
      let newY = initialY + dy;

      // Keep within bounds
      newX = Math.max(10, Math.min(window.innerWidth - 340, newX));
      newY = Math.max(10, Math.min(window.innerHeight - 80, newY));

      this.root.style.left = `${newX}px`;
      this.root.style.top = `${newY}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  show() {
    this.root.style.display = 'block';
  }
}

window.XHitHUD = XHitHUD;
