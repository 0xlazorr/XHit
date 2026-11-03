/**
 * XHit - In-Page Floating HUD Dock & Audio/FX Engine
 * Premium glassmorphic interface, dynamic island minimized mode, live tweet spotlight,
 * instant speed switcher, audio synthesis, and celebration confetti.
 */

// Web Audio API Sound Synthesizer (Zero external dependencies)
class XHitAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const time = this.ctx.currentTime + idx * 0.1;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.25);
      });
    } catch (e) {}
  }
}

// Particle Confetti Burst
function launchXHitConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '2147483646';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#ef4444', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#ffffff'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.65,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.9) * 18,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12
    });
  }

  let animationFrame;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45; // gravity
      p.alpha -= 0.012;
      p.rotation += p.vRot;

      if (p.alpha > 0) {
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive > 0) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      canvas.remove();
      cancelAnimationFrame(animationFrame);
    }
  }
  animate();
}

class XHitHUD {
  constructor(engine) {
    this.engine = engine;
    this.root = null;
    this.card = null;
    this.isMinimized = false;
    this.audio = new XHitAudioEngine();
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

          <!-- Dynamic Island Mini Capsule View -->
          <div class="xhit-mini-pill" id="xhit-mini-pill">
            <span class="xhit-mini-count" id="xhit-mini-count">0 Wiped</span>
            <span id="xhit-mini-status">Ready</span>
          </div>

          <div class="xhit-header-actions">
            <button class="xhit-icon-btn" id="xhit-btn-audio" title="Toggle Sound FX">🔊</button>
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

          <!-- Live Tweet Spotlight -->
          <div class="xhit-spotlight" id="xhit-spotlight">
            <div class="xhit-spotlight-header">
              <span>Target Spotlight</span>
              <span id="xhit-spotlight-category" style="color: #ef4444;">Standby</span>
            </div>
            <div class="xhit-spotlight-text" id="xhit-spotlight-text">Ready to wipe timeline items.</div>
          </div>

          <!-- Speed Pills Switcher directly in HUD -->
          <div class="xhit-speed-pills">
            <button class="xhit-speed-pill" data-speed="safe" title="Safe Mode: ~1.8s delay with jitter">Safe</button>
            <button class="xhit-speed-pill active" data-speed="balanced" title="Balanced Mode: ~0.8s delay">Balanced</button>
            <button class="xhit-speed-pill" data-speed="turbo" title="Turbo Mode: ~0.4s delay">Turbo</button>
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
          <div class="xhit-dock-actions">
            <button class="xhit-icon-btn" id="xhit-btn-snap" title="Snap to opposite corner">⇄</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const minBtn = this.root.querySelector('#xhit-btn-minimize');
    const closeBtn = this.root.querySelector('#xhit-btn-close');
    const audioBtn = this.root.querySelector('#xhit-btn-audio');
    const snapBtn = this.root.querySelector('#xhit-btn-snap');
    const miniPill = this.root.querySelector('#xhit-mini-pill');

    const actionBtn = this.root.querySelector('#xhit-action-btn');
    const pauseBtn = this.root.querySelector('#xhit-pause-btn');
    const stopBtn = this.root.querySelector('#xhit-stop-btn');
    const dryRunChk = this.root.querySelector('#xhit-chk-dryrun');
    const allTabsChk = this.root.querySelector('#xhit-chk-alltabs');
    const dragHandle = this.root.querySelector('#xhit-drag-handle');
    const speedPills = this.root.querySelectorAll('.xhit-speed-pill');

    // Minimize toggle
    const toggleMinimize = () => {
      this.isMinimized = !this.isMinimized;
      this.card.classList.toggle('xhit-minimized', this.isMinimized);
      minBtn.textContent = this.isMinimized ? '□' : '_';
    };

    minBtn.addEventListener('click', toggleMinimize);
    miniPill.addEventListener('click', toggleMinimize);

    // Audio toggle
    audioBtn.addEventListener('click', () => {
      this.audio.enabled = !this.audio.enabled;
      audioBtn.textContent = this.audio.enabled ? '🔊' : '🔇';
      if (this.audio.enabled) {
        this.audio.playPop();
      }
    });

    // Snap dock to left/right corner
    let isSnappedLeft = false;
    snapBtn.addEventListener('click', () => {
      isSnappedLeft = !isSnappedLeft;
      this.root.style.top = 'auto';
      this.root.style.bottom = '24px';
      if (isSnappedLeft) {
        this.root.style.right = 'auto';
        this.root.style.left = '24px';
      } else {
        this.root.style.left = 'auto';
        this.root.style.right = '24px';
      }
    });

    // Close HUD
    closeBtn.addEventListener('click', () => {
      this.root.style.display = 'none';
    });

    // Start
    actionBtn.addEventListener('click', () => {
      this.audio.init();
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

    // Speed Pill Selection
    speedPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        speedPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const speed = pill.getAttribute('data-speed');
        this.engine.setOptions({ speed });
        this.log(`Speed mode set to ${speed.toUpperCase()}`);
        this.audio.playPop();
      });
    });

    // Checkboxes
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

    const miniCount = this.root.querySelector('#xhit-mini-count');
    const miniStatus = this.root.querySelector('#xhit-mini-status');

    const actionBtn = this.root.querySelector('#xhit-action-btn');
    const pauseBtn = this.root.querySelector('#xhit-pause-btn');
    const stopBtn = this.root.querySelector('#xhit-stop-btn');

    const spotlightCategory = this.root.querySelector('#xhit-spotlight-category');
    const spotlightText = this.root.querySelector('#xhit-spotlight-text');

    // Update username
    if (data.currentUser) {
      userTag.textContent = `@${data.currentUser}`;
    }

    // Update stats
    if (data.stats) {
      const tot = data.stats.total || 0;
      totalEl.textContent = tot;
      postsEl.textContent = data.stats.posts || 0;
      repliesEl.textContent = data.stats.replies || 0;
      otherEl.textContent = (data.stats.reposts || 0) + (data.stats.likes || 0);
      miniCount.textContent = `${tot} Wiped`;
    }

    // Update Buttons & Status Badge
    if (data.isRunning) {
      actionBtn.style.display = 'none';
      pauseBtn.style.display = 'flex';
      stopBtn.style.display = 'flex';

      if (data.isPaused) {
        statusBadge.className = 'xhit-badge xhit-badge-paused';
        statusText.textContent = 'Paused';
        miniStatus.textContent = 'Paused';
        pauseBtn.textContent = '▶ Resume';
      } else {
        statusBadge.className = 'xhit-badge xhit-badge-running';
        statusText.textContent = 'Wiping...';
        miniStatus.textContent = 'Wiping...';
        pauseBtn.textContent = '⏸ Pause';
      }
    } else {
      actionBtn.style.display = 'flex';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      statusBadge.className = 'xhit-badge xhit-badge-idle';
      statusText.textContent = 'Ready';
      miniStatus.textContent = 'Ready';
    }

    // Handle specific event logs & effects
    if (event === 'item_deleted') {
      const prefix = data.options?.dryRun ? '[DRY RUN] Would delete' : 'Deleted';
      this.log(`${prefix} ${data.type || 'Item'}`);
      this.audio.playPop();

      if (spotlightCategory && data.type) {
        spotlightCategory.textContent = data.type;
      }
      if (spotlightText && data.snippet) {
        spotlightText.textContent = `"${data.snippet}"`;
      }
    } else if (event === 'item_target') {
      if (spotlightCategory && data.type) {
        spotlightCategory.textContent = `Wiping ${data.type}...`;
      }
      if (spotlightText && data.snippet) {
        spotlightText.textContent = `"${data.snippet}"`;
      }
    } else if (event === 'cooldown') {
      this.log(`Rate limit cooldown: ${data.secondsLeft}s left`, 'warning');
    } else if (event === 'transition') {
      this.log(`Navigating to ${data.nextStage}...`, 'active');
    } else if (event === 'completed') {
      this.log('✨ All targets wiped clean!', 'active');
      statusText.textContent = 'Completed!';
      miniStatus.textContent = 'Clean!';
      this.audio.playChime();
      launchXHitConfetti();
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

      newX = Math.max(10, Math.min(window.innerWidth - (this.isMinimized ? 180 : 340), newX));
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
