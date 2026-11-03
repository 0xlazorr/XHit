/**
 * XHit - Ultimate Twitter / X Post Eraser Engine
 * Robust DOM Automation, Rate-Limit Protection, & Virtualization Scroll Manager
 */

class XHitEngine {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentStage = 'posts'; // 'posts' | 'replies' | 'likes'
    this.currentUser = null;
    this.options = {
      deletePosts: true,
      deleteReplies: true,
      deleteReposts: true,
      deleteLikes: true,
      wipeAllTabs: true,
      dryRun: false,
      speed: 'balanced' // 'safe' | 'balanced' | 'turbo'
    };
    this.stats = {
      posts: 0,
      replies: 0,
      reposts: 0,
      likes: 0,
      skipped: 0,
      errors: 0,
      total: 0
    };

    this.processedElements = new WeakSet();
    this.consecutiveEmptyScrolls = 0;
    this.maxEmptyScrolls = 4;
    this.listeners = [];
  }

  // Event listener subscription for HUD & Popup
  onUpdate(callback) {
    this.listeners.push(callback);
  }

  notify(event, data = {}) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, { ...this.getSnapshot(), ...data });
      } catch (err) {
        console.error('[XHit] Listener error:', err);
      }
    });

    // Also sync to chrome.storage for popup persistence
    try {
      chrome.storage.local.set({
        xhit_state: {
          isRunning: this.isRunning,
          isPaused: this.isPaused,
          stats: this.stats,
          stage: this.currentStage
        }
      });
    } catch (e) {
      // Storage might not be available if extension reloaded
    }
  }

  getSnapshot() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      stats: { ...this.stats },
      options: { ...this.options },
      currentStage: this.currentStage,
      currentUser: this.currentUser
    };
  }

  setOptions(newOpts) {
    this.options = { ...this.options, ...newOpts };
  }

  // Detect currently logged in user handle
  detectCurrentUser() {
    // Strategy 1: SideNav Account Switcher Button text contains @handle
    const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (accountSwitcher) {
      const spans = accountSwitcher.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && text.startsWith('@') && text.length > 1) {
          this.currentUser = text.substring(1).toLowerCase();
          return this.currentUser;
        }
      }
    }

    // Strategy 2: Profile link in side navigation
    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href');
      if (href && href.length > 1) {
        this.currentUser = href.replace('/', '').trim().toLowerCase();
        return this.currentUser;
      }
    }

    // Strategy 3: Check current path if on profile page
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && !['home', 'explore', 'notifications', 'messages', 'i', 'settings'].includes(pathParts[0].toLowerCase())) {
      this.currentUser = pathParts[0].toLowerCase();
      return this.currentUser;
    }

    return null;
  }

  // Timing delays based on speed profile
  getDelay() {
    switch (this.options.speed) {
      case 'turbo':
        // 300ms - 500ms
        return Math.floor(Math.random() * 200) + 300;
      case 'safe':
        // 1400ms - 2400ms (Human-like behavior)
        return Math.floor(Math.random() * 1000) + 1400;
      case 'balanced':
      default:
        // 700ms - 1200ms
        return Math.floor(Math.random() * 500) + 700;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Wait for an element to match a selector
  async waitForElement(selector, root = document, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = root.querySelector(selector);
      if (el) return el;
      await this.sleep(100);
    }
    return null;
  }

  // Wait for element to be removed from DOM
  async waitForRemoval(element, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!element || !document.contains(element)) return true;
      await this.sleep(100);
    }
    return false;
  }

  // High-fidelity click simulation for React 18+ Fiber synthetic events
  simulateClick(element) {
    if (!element) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent('mousedown', opts));
    element.dispatchEvent(new MouseEvent('mouseup', opts));
    element.dispatchEvent(new MouseEvent('click', opts));
    if (typeof element.click === 'function') {
      element.click();
    }
  }

  // Close menus/modals by pressing Escape and clearing backdrops
  pressEscape() {
    const keyOpts = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
    document.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

    // Fallback: dismiss dropdown/mask if still mounted
    const mask = document.querySelector('[data-testid="mask"]');
    if (mask) {
      this.simulateClick(mask);
    } else {
      document.body.click();
    }
  }

  // Check for rate limit or error toast
  checkRateLimitToast() {
    const toasts = document.querySelectorAll('[data-testid="toast"]');
    for (const toast of toasts) {
      const text = toast.textContent?.toLowerCase() || '';
      if (text.includes('rate limit') || text.includes('try again later') || text.includes('something went wrong')) {
        return true;
      }
    }
    return false;
  }

  // Start the wiping engine
  async start() {
    if (this.isRunning) return;

    const user = this.currentUser || this.detectCurrentUser();
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const isProfilePage = pathParts.length > 0 && user && pathParts[0].toLowerCase() === user.toLowerCase();

    // If user is on home/explore/notifications, automatically redirect to their profile!
    if (user && !isProfilePage) {
      this.notify('redirecting', { user, message: `Redirecting to your profile @${user}...` });
      sessionStorage.setItem('xhit_auto_start', '1');
      window.location.href = `https://x.com/${user}`;
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.consecutiveEmptyScrolls = 0;

    this.notify('started', { message: 'Engine started.' });

    try {
      await this.runLoop();
    } catch (err) {
      console.error('[XHit] Critical error in engine loop:', err);
      this.notify('error', { message: `Engine error: ${err.message}` });
    } finally {
      this.isRunning = false;
      this.notify('stopped', { message: 'Engine finished or stopped.' });
    }
  }

  // Pause engine
  pause() {
    this.isPaused = true;
    this.notify('paused', { message: 'Execution paused.' });
  }

  // Resume engine
  resume() {
    this.isPaused = false;
    this.notify('resumed', { message: 'Execution resumed.' });
  }

  // Stop engine
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.notify('stopped', { message: 'Engine stopped by user.' });
  }

  // Main processing loop
  async runLoop() {
    while (this.isRunning) {
      // Handle Pause
      while (this.isPaused && this.isRunning) {
        await this.sleep(300);
      }
      if (!this.isRunning) break;

      // Rate limit check
      if (this.checkRateLimitToast()) {
        this.notify('toast_warning', { message: 'Rate limit detected! Cooling down for 30s...' });
        for (let i = 30; i > 0 && this.isRunning; i--) {
          this.notify('cooldown', { secondsLeft: i });
          await this.sleep(1000);
        }
      }

      // Find all tweet articles currently in DOM
      const tweetArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      let processedAnyInBatch = false;

      for (const article of tweetArticles) {
        if (!this.isRunning) break;
        while (this.isPaused && this.isRunning) await this.sleep(300);

        if (this.processedElements.has(article)) {
          continue;
        }

        // Determine tweet type & action
        const actionResult = await this.processTweet(article);
        this.processedElements.add(article);

        if (actionResult.success) {
          processedAnyInBatch = true;
          this.consecutiveEmptyScrolls = 0;
          await this.sleep(this.getDelay());
        } else if (actionResult.skipped) {
          this.stats.skipped++;
          this.notify('item_skipped', { reason: actionResult.reason });
        }
      }

      // If no tweets were processed in this batch, scroll down to load more
      if (!processedAnyInBatch || tweetArticles.length === 0) {
        const scrolled = await this.scrollTimeline();
        if (!scrolled) {
          // Reached end of current tab/stage
          const transitioned = await this.handleStageTransition();
          if (!transitioned) {
            // All tabs completed!
            this.notify('completed', { message: 'All items wiped clean!' });
            break;
          }
        }
      }

      await this.sleep(300);
    }
  }

  // Inspect and process a single tweet element
  async processTweet(article) {
    try {
      // 1. Check if on Likes tab and Unlike option is enabled
      const isLikesTab = window.location.pathname.endsWith('/likes');
      if (isLikesTab && this.options.deleteLikes) {
        const unlikeBtn = article.querySelector('button[data-testid="unlike"]');
        if (unlikeBtn) {
          return await this.handleUnlike(article, unlikeBtn);
        }
      }

      // 2. Check if it is a Repost (Retweet)
      const unretweetBtn = article.querySelector('button[data-testid="unretweet"]');
      if (unretweetBtn && this.options.deleteReposts) {
        return await this.handleUnretweet(article, unretweetBtn);
      }

      // 3. Check for Post / Reply deletion
      const isRepliesTab = window.location.pathname.includes('/with_replies');
      const targetAllowed = isRepliesTab ? this.options.deleteReplies : this.options.deletePosts;

      if (!targetAllowed) {
        return { skipped: true, reason: 'Target category disabled in settings' };
      }

      // Check Caret button (three dots menu)
      const caretBtn = article.querySelector('button[data-testid="caret"], div[data-testid="caret"], [aria-label="More"]');
      if (!caretBtn) {
        return { skipped: true, reason: 'No caret menu found (not author)' };
      }

      return await this.handleDeletePost(article, caretBtn, isRepliesTab);
    } catch (err) {
      console.error('[XHit] Error processing tweet:', err);
      this.stats.errors++;
      this.notify('item_error', { error: err.message });
      this.pressEscape();
      return { skipped: true, reason: err.message };
    }
  }

  // Handle post/reply deletion via caret menu
  async handleDeletePost(article, caretBtn, isReply) {
    if (this.options.dryRun) {
      this.highlightElement(article, '#ef4444');
      if (isReply) this.stats.replies++;
      else this.stats.posts++;
      this.stats.total++;
      this.notify('item_deleted', { type: isReply ? 'Reply' : 'Post', dryRun: true });
      await this.sleep(this.getDelay());
      return { success: true };
    }

    // Scroll into view
    article.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    // Open caret dropdown
    this.simulateClick(caretBtn);

    // Wait for dropdown menu to appear in body/#layers
    const dropdown = await this.waitForElement('[data-testid="Dropdown"], [role="menu"]', document, 2000);
    if (!dropdown) {
      this.pressEscape();
      return { skipped: true, reason: 'Dropdown menu failed to open' };
    }

    // Find "Delete" item inside dropdown
    const menuItems = Array.from(dropdown.querySelectorAll('[role="menuitem"], [data-testid="Dropdown"] > div'));
    let deleteItem = null;

    for (const item of menuItems) {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes('delete') || text.includes('supprimer') || text.includes('löschen') || text.includes('eliminar') || text.includes('borrar')) {
        deleteItem = item;
        break;
      }
    }

    if (!deleteItem) {
      // This is an ad, promoted post, or someone else's tweet
      this.pressEscape();
      await this.sleep(200);
      return { skipped: true, reason: 'Not author post (no delete option)' };
    }

    // Click "Delete" item
    this.simulateClick(deleteItem);

    // Wait for confirmation dialog sheet
    const confirmBtn = await this.waitForElement('[data-testid="confirmationSheetConfirm"]', document, 2500);
    if (!confirmBtn) {
      this.pressEscape();
      return { skipped: true, reason: 'Confirmation dialog not found' };
    }

    // Confirm deletion
    this.simulateClick(confirmBtn);

    // Wait for dialog removal
    await this.waitForRemoval(confirmBtn, 2000);

    if (isReply) {
      this.stats.replies++;
    } else {
      this.stats.posts++;
    }
    this.stats.total++;

    this.notify('item_deleted', {
      type: isReply ? 'Reply' : 'Post',
      stats: this.stats
    });

    return { success: true };
  }

  // Handle Unretweet / Undo Repost
  async handleUnretweet(article, unretweetBtn) {
    if (this.options.dryRun) {
      this.highlightElement(article, '#3b82f6');
      this.stats.reposts++;
      this.stats.total++;
      this.notify('item_deleted', { type: 'Repost', dryRun: true });
      await this.sleep(this.getDelay());
      return { success: true };
    }

    article.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(150);

    // Click unretweet button to show popover
    this.simulateClick(unretweetBtn);

    // Wait for confirmation menu item
    const confirmItem = await this.waitForElement('[data-testid="unretweetConfirm"]', document, 2000);
    if (!confirmItem) {
      this.pressEscape();
      return { skipped: true, reason: 'Undo repost confirm button not found' };
    }

    // Click "Undo Repost"
    this.simulateClick(confirmItem);
    await this.sleep(300);

    this.stats.reposts++;
    this.stats.total++;
    this.notify('item_deleted', { type: 'Repost', stats: this.stats });

    return { success: true };
  }

  // Handle Unlike
  async handleUnlike(article, unlikeBtn) {
    if (this.options.dryRun) {
      this.highlightElement(article, '#ec4899');
      this.stats.likes++;
      this.stats.total++;
      this.notify('item_deleted', { type: 'Like', dryRun: true });
      await this.sleep(this.getDelay());
      return { success: true };
    }

    article.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(150);

    // Click unlike button
    this.simulateClick(unlikeBtn);
    await this.sleep(250);

    this.stats.likes++;
    this.stats.total++;
    this.notify('item_deleted', { type: 'Like', stats: this.stats });

    return { success: true };
  }

  // Visual highlight for dry-run
  highlightElement(el, color) {
    el.style.outline = `3px solid ${color}`;
    el.style.transition = 'outline 0.3s ease';
    setTimeout(() => {
      el.style.outline = '';
    }, 1200);
  }

  // Scroll down smoothly to load more items in virtual list
  async scrollTimeline() {
    this.consecutiveEmptyScrolls++;
    if (this.consecutiveEmptyScrolls > this.maxEmptyScrolls) {
      return false; // Reached end of list
    }

    this.notify('scrolling', { attempt: this.consecutiveEmptyScrolls });

    const scrollAmount = Math.floor(window.innerHeight * 0.85);
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

    // Wait for X to load new nodes
    await this.sleep(1200 + this.getDelay());
    return true;
  }

  // Automatic multi-tab stage transitions for complete account wiping
  async handleStageTransition() {
    if (!this.options.wipeAllTabs) {
      return false;
    }

    const user = this.currentUser || this.detectCurrentUser();
    if (!user) {
      return false;
    }

    const currentPath = window.location.pathname.toLowerCase();

    // Stage 1: Posts (/<user>) -> Move to Replies (/<user>/with_replies)
    if (!currentPath.includes('/with_replies') && !currentPath.includes('/likes')) {
      if (this.options.deleteReplies) {
        this.currentStage = 'replies';
        this.consecutiveEmptyScrolls = 0;
        this.notify('transition', { nextStage: 'Replies & Comments', url: `/${user}/with_replies` });
        sessionStorage.setItem('xhit_auto_start', '1');
        window.location.href = `https://x.com/${user}/with_replies`;
        return true;
      }
    }

    // Stage 2: Replies -> Move to Likes (/<user>/likes)
    if (currentPath.includes('/with_replies')) {
      if (this.options.deleteLikes) {
        this.currentStage = 'likes';
        this.consecutiveEmptyScrolls = 0;
        this.notify('transition', { nextStage: 'Likes', url: `/${user}/likes` });
        sessionStorage.setItem('xhit_auto_start', '1');
        window.location.href = `https://x.com/${user}/likes`;
        return true;
      }
    }

    // All selected stages completed!
    return false;
  }
}

// Make accessible to content scripts
window.XHitEngine = XHitEngine;
