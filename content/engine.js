/**
 * XHit - Ultimate Twitter / X Post Eraser Engine
 * Hybrid High-Efficiency Engine: Direct GraphQL Web API + Instant DOM Fallback
 * Optimized for Background Tabs, Zero Virtualization Thrashing, and Anti-Rate-Limit Protection
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
    this.processedTweetIds = new Set();
    this.consecutiveEmptyScrolls = 0;
    this.maxEmptyScrolls = 4;
    this.listeners = [];

    // Web Client GraphQL Configuration
    this.bearerToken = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    this.queryIds = {
      DeleteTweet: 'VaenaVgh5q5ih7kvyVjgtg',
      DeleteRetweet: 'iQtK4dl5hBmXewYZuEOKVw',
      UnfavoriteTweet: 'ZYKSe-w7KEslx3JhSIk5LA',
      DeleteBookmark: 'Wlmlj2-xzyS1GN3a6cj-mQ'
    };

    // Flag for API fast-path viability
    this.useApi = true;
    this.scanBundlesForQueryIds();

    // Background keepalive interval
    this.keepAliveInterval = null;
    this.setupKeepAlive();
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
      currentUser: this.currentUser,
      useApi: this.useApi
    };
  }

  setOptions(newOpts) {
    this.options = { ...this.options, ...newOpts };
  }

  // Prevent background tab throttling via periodic pings and visibility tracking
  setupKeepAlive() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning) {
        console.log('[XHit] Tab entered background. High-efficiency instant mode active.');
      }
    });

    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      if (this.isRunning) {
        try {
          chrome.runtime.sendMessage({ action: 'KEEP_ALIVE' }).catch(() => {});
        } catch (e) {}
      }
    }, 12000);
  }

  // Extract ct0 CSRF cookie from document
  getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)ct0=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Optional background scan of script tags for updated GraphQL query hashes
  scanBundlesForQueryIds() {
    try {
      const scripts = Array.from(document.querySelectorAll('script[src*="client-web"]'));
      for (const s of scripts) {
        const src = s.getAttribute('src');
        if (src && (src.includes('main') || src.includes('endpoints') || src.includes('api'))) {
          // Asynchronously inspect in idle if necessary
          fetch(src)
            .then((res) => res.text())
            .then((text) => {
              const delMatch = text.match(/queryId\s*:\s*["']([a-zA-Z0-9_-]+)["'].*?operationName\s*:\s*["']DeleteTweet["']/s) ||
                               text.match(/operationName\s*:\s*["']DeleteTweet["'].*?queryId\s*:\s*["']([a-zA-Z0-9_-]+)["']/s);
              if (delMatch && delMatch[1]) this.queryIds.DeleteTweet = delMatch[1];

              const rtMatch = text.match(/queryId\s*:\s*["']([a-zA-Z0-9_-]+)["'].*?operationName\s*:\s*["']DeleteRetweet["']/s) ||
                              text.match(/operationName\s*:\s*["']DeleteRetweet["'].*?queryId\s*:\s*["']([a-zA-Z0-9_-]+)["']/s);
              if (rtMatch && rtMatch[1]) this.queryIds.DeleteRetweet = rtMatch[1];

              const favMatch = text.match(/queryId\s*:\s*["']([a-zA-Z0-9_-]+)["'].*?operationName\s*:\s*["']UnfavoriteTweet["']/s) ||
                               text.match(/operationName\s*:\s*["']UnfavoriteTweet["'].*?queryId\s*:\s*["']([a-zA-Z0-9_-]+)["']/s);
              if (favMatch && favMatch[1]) this.queryIds.UnfavoriteTweet = favMatch[1];
            })
            .catch(() => {});
        }
      }
    } catch (e) {}
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

  // Extract Tweet ID directly from tweet element's status link
  extractTweetId(article) {
    if (!article) return null;
    const links = article.querySelectorAll('a[href*="/status/"]');
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/status\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  // High-efficiency timing delays (optimized for API throughput with safe jitter)
  getDelay() {
    switch (this.options.speed) {
      case 'turbo':
        // 80ms - 180ms (Instant API burst)
        return Math.floor(Math.random() * 100) + 80;
      case 'safe':
        // 700ms - 1200ms (Conservative rate limit buffer)
        return Math.floor(Math.random() * 500) + 700;
      case 'balanced':
      default:
        // 250ms - 450ms (Optimal efficiency & stability)
        return Math.floor(Math.random() * 200) + 250;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Wait for an element to match a selector (fast polling)
  async waitForElement(selector, root = document, timeout = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = root.querySelector(selector);
      if (el) return el;
      await this.sleep(60);
    }
    return null;
  }

  // Wait for element to be removed from DOM
  async waitForRemoval(element, timeout = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!element || !document.contains(element)) return true;
      await this.sleep(60);
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

  // Direct GraphQL API Call: DeleteTweet
  async apiDeleteTweet(tweetId) {
    const csrf = this.getCsrfToken();
    if (!csrf) return { success: false, reason: 'Missing CSRF cookie' };

    const queryId = this.queryIds.DeleteTweet;
    const url = `https://x.com/i/api/graphql/${queryId}/DeleteTweet`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'authorization': this.bearerToken,
          'content-type': 'application/json',
          'x-csrf-token': csrf,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session'
        },
        body: JSON.stringify({
          variables: { tweet_id: String(tweetId), dark_request: false },
          queryId
        })
      });

      if (res.status === 429) {
        return { rateLimited: true, reason: 'Rate limited (HTTP 429)' };
      }
      if (res.ok) {
        return { success: true };
      }
      return { success: false, status: res.status, reason: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }

  // Direct GraphQL API Call: DeleteRetweet (Undo Repost)
  async apiDeleteRetweet(sourceTweetId) {
    const csrf = this.getCsrfToken();
    if (!csrf) return { success: false, reason: 'Missing CSRF cookie' };

    const queryId = this.queryIds.DeleteRetweet;
    const url = `https://x.com/i/api/graphql/${queryId}/DeleteRetweet`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'authorization': this.bearerToken,
          'content-type': 'application/json',
          'x-csrf-token': csrf,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session'
        },
        body: JSON.stringify({
          variables: { source_tweet_id: String(sourceTweetId) },
          queryId
        })
      });

      if (res.status === 429) return { rateLimited: true };
      if (res.ok) return { success: true };
      return { success: false, status: res.status };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }

  // Direct GraphQL API Call: UnfavoriteTweet (Unlike)
  async apiUnlike(tweetId) {
    const csrf = this.getCsrfToken();
    if (!csrf) return { success: false, reason: 'Missing CSRF cookie' };

    const queryId = this.queryIds.UnfavoriteTweet;
    const url = `https://x.com/i/api/graphql/${queryId}/UnfavoriteTweet`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'authorization': this.bearerToken,
          'content-type': 'application/json',
          'x-csrf-token': csrf,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session'
        },
        body: JSON.stringify({
          variables: { tweet_id: String(tweetId) },
          queryId
        })
      });

      if (res.status === 429) return { rateLimited: true };
      if (res.ok) return { success: true };
      return { success: false, status: res.status };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }

  // Start the wiping engine
  async start() {
    if (this.isRunning) return;

    const user = this.currentUser || this.detectCurrentUser();
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const isProfilePage = pathParts.length > 0 && user && pathParts[0].toLowerCase() === user.toLowerCase();

    // If user is on home/explore/notifications, automatically redirect to their profile
    if (user && !isProfilePage) {
      this.notify('redirecting', { user, message: `Redirecting to your profile @${user}...` });
      sessionStorage.setItem('xhit_auto_start', '1');
      window.location.href = `https://x.com/${user}`;
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.consecutiveEmptyScrolls = 0;

    this.notify('started', { message: 'Engine started in high-efficiency hybrid mode.' });

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

  pause() {
    this.isPaused = true;
    this.notify('paused', { message: 'Execution paused.' });
  }

  resume() {
    this.isPaused = false;
    this.notify('resumed', { message: 'Execution resumed.' });
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.notify('stopped', { message: 'Engine stopped by user.' });
  }

  // Main processing loop
  async runLoop() {
    while (this.isRunning) {
      while (this.isPaused && this.isRunning) {
        await this.sleep(200);
      }
      if (!this.isRunning) break;

      // Rate limit check
      if (this.checkRateLimitToast()) {
        await this.handleRateLimitCooldown(30);
      }

      // Find all tweet articles currently in DOM
      const tweetArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      let processedAnyInBatch = false;

      for (const article of tweetArticles) {
        if (!this.isRunning) break;
        while (this.isPaused && this.isRunning) await this.sleep(200);

        if (this.processedElements.has(article)) {
          continue;
        }

        const actionResult = await this.processTweet(article);
        this.processedElements.add(article);

        if (actionResult.success) {
          processedAnyInBatch = true;
          this.consecutiveEmptyScrolls = 0;
          await this.sleep(this.getDelay());
        } else if (actionResult.rateLimited) {
          await this.handleRateLimitCooldown(30);
          break; // break inner loop and retry after cooldown
        } else if (actionResult.skipped) {
          this.stats.skipped++;
          this.notify('item_skipped', { reason: actionResult.reason });
        }
      }

      // If no tweets were processed in this batch, scroll down to load more
      if (!processedAnyInBatch || tweetArticles.length === 0) {
        const scrolled = await this.scrollTimeline();
        if (!scrolled) {
          const transitioned = await this.handleStageTransition();
          if (!transitioned) {
            this.notify('completed', { message: 'All items wiped clean!' });
            break;
          }
        }
      }

      await this.sleep(150);
    }
  }

  async handleRateLimitCooldown(seconds = 30) {
    this.notify('toast_warning', { message: `Rate limit detected! Cooling down for ${seconds}s...` });
    for (let i = seconds; i > 0 && this.isRunning; i--) {
      this.notify('cooldown', { secondsLeft: i });
      await this.sleep(1000);
    }
  }

  // Inspect and process a single tweet element (Fast-Path API + DOM Fallback)
  async processTweet(article) {
    try {
      const tweetId = this.extractTweetId(article);
      if (tweetId && this.processedTweetIds.has(tweetId)) {
        article.remove();
        return { skipped: true, reason: 'Already wiped' };
      }

      const textEl = article.querySelector('[data-testid="tweetText"]');
      const snippet = textEl ? textEl.textContent.trim().slice(0, 65) : 'Post';

      // 1. Check if on Likes tab and Unlike option is enabled
      const isLikesTab = window.location.pathname.endsWith('/likes');
      if (isLikesTab && this.options.deleteLikes) {
        const unlikeBtn = article.querySelector('button[data-testid="unlike"]');
        if (unlikeBtn || tweetId) {
          return await this.handleUnlike(article, unlikeBtn, tweetId, snippet);
        }
      }

      // 2. Check if it is a Repost (Retweet)
      const unretweetBtn = article.querySelector('button[data-testid="unretweet"]');
      if (unretweetBtn && this.options.deleteReposts) {
        return await this.handleUnretweet(article, unretweetBtn, tweetId, snippet);
      }

      // 3. Check for Post / Reply deletion
      const isRepliesTab = window.location.pathname.includes('/with_replies');
      const targetAllowed = isRepliesTab ? this.options.deleteReplies : this.options.deletePosts;

      if (!targetAllowed) {
        return { skipped: true, reason: 'Target category disabled in settings' };
      }

      const caretBtn = article.querySelector('button[data-testid="caret"], div[data-testid="caret"], [aria-label="More"]');
      if (!caretBtn && !tweetId) {
        return { skipped: true, reason: 'No caret menu or ID found (not author)' };
      }

      return await this.handleDeletePost(article, caretBtn, tweetId, isRepliesTab, snippet);
    } catch (err) {
      console.error('[XHit] Error processing tweet:', err);
      this.stats.errors++;
      this.notify('item_error', { error: err.message });
      this.pressEscape();
      return { skipped: true, reason: err.message };
    }
  }

  // Handle post/reply deletion (API First -> DOM Fallback)
  async handleDeletePost(article, caretBtn, tweetId, isReply, snippet) {
    const itemType = isReply ? 'Reply' : 'Post';
    this.notify('item_target', { type: itemType, snippet });

    if (this.options.dryRun) {
      this.highlightElement(article, '#ef4444');
      if (isReply) this.stats.replies++;
      else this.stats.posts++;
      this.stats.total++;
      if (tweetId) this.processedTweetIds.add(tweetId);
      this.notify('item_deleted', { type: itemType, snippet, dryRun: true });
      await this.sleep(this.getDelay());
      return { success: true };
    }

    // --- FAST PATH: Direct GraphQL API Deletion ---
    if (this.useApi && tweetId) {
      const apiResult = await this.apiDeleteTweet(tweetId);
      if (apiResult.success) {
        if (isReply) this.stats.replies++;
        else this.stats.posts++;
        this.stats.total++;
        this.processedTweetIds.add(tweetId);

        // Instantly remove from DOM to prevent layout thrashing and keep memory low
        article.remove();

        this.notify('item_deleted', {
          type: itemType,
          snippet,
          stats: this.stats,
          method: 'api'
        });
        return { success: true };
      } else if (apiResult.rateLimited) {
        return { rateLimited: true };
      }
      // If API failed due to non-429 (e.g. hash mismatch), fall back to DOM
      console.warn('[XHit] API Delete failed, falling back to DOM automation:', apiResult.reason);
    }

    // --- FALLBACK PATH: Instant DOM Automation ---
    if (!caretBtn) {
      return { skipped: true, reason: 'Cannot delete via DOM (no caret button)' };
    }

    // Instant alignment (avoid smooth scroll stalling in background tabs)
    article.scrollIntoView({ behavior: 'instant', block: 'center' });
    await this.sleep(80);

    this.simulateClick(caretBtn);

    const dropdown = await this.waitForElement('[data-testid="Dropdown"], [role="menu"]', document, 1500);
    if (!dropdown) {
      this.pressEscape();
      return { skipped: true, reason: 'Dropdown menu failed to open' };
    }

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
      this.pressEscape();
      await this.sleep(100);
      return { skipped: true, reason: 'Not author post (no delete option)' };
    }

    this.simulateClick(deleteItem);

    const confirmBtn = await this.waitForElement('[data-testid="confirmationSheetConfirm"]', document, 1800);
    if (!confirmBtn) {
      this.pressEscape();
      return { skipped: true, reason: 'Confirmation dialog not found' };
    }

    this.simulateClick(confirmBtn);
    await this.waitForRemoval(confirmBtn, 1200);

    // Remove element immediately from DOM
    article.remove();
    if (tweetId) this.processedTweetIds.add(tweetId);

    if (isReply) this.stats.replies++;
    else this.stats.posts++;
    this.stats.total++;

    this.notify('item_deleted', {
      type: itemType,
      snippet,
      stats: this.stats,
      method: 'dom'
    });

    return { success: true };
  }

  // Handle Unretweet / Undo Repost
  async handleUnretweet(article, unretweetBtn, tweetId, snippet) {
    this.notify('item_target', { type: 'Repost', snippet });

    if (this.options.dryRun) {
      this.highlightElement(article, '#3b82f6');
      this.stats.reposts++;
      this.stats.total++;
      if (tweetId) this.processedTweetIds.add(tweetId);
      this.notify('item_deleted', { type: 'Repost', snippet, dryRun: true });
      await this.sleep(this.getDelay());
      return { success: true };
    }

    // --- Fast Path: API Unretweet ---
    if (this.useApi && tweetId) {
      const apiResult = await this.apiDeleteRetweet(tweetId);
      if (apiResult.success) {
        this.stats.reposts++;
        this.stats.total++;
        this.processedTweetIds.add(tweetId);
        article.remove();
        this.notify('item_deleted', { type: 'Repost', snippet, stats: this.stats, method: 'api' });
        return { success: true };
      } else if (apiResult.rateLimited) {
        return { rateLimited: true };
      }
    }

    // --- Fallback: DOM Unretweet ---
    if (!unretweetBtn) return { skipped: true, reason: 'No unretweet button' };
    article.scrollIntoView({ behavior: 'instant', block: 'center' });
    await this.sleep(80);

    this.simulateClick(unretweetBtn);
    const confirmItem = await this.waitForElement('[data-testid="unretweetConfirm"]', document, 1500);
    if (!confirmItem) {
      this.pressEscape();
      return { skipped: true, reason: 'Undo repost confirm button not found' };
    }

    this.simulateClick(confirmItem);
    await this.sleep(150);
    article.remove();
    if (tweetId) this.processedTweetIds.add(tweetId);

    this.stats.reposts++;
    this.stats.total++;
    this.notify('item_deleted', { type: 'Repost', snippet, stats: this.stats, method: 'dom' });
    return { success: true };
  }

  // Handle Unlike
  async handleUnlike(article, unlikeBtn, tweetId, snippet) {
    this.notify('item_target', { type: 'Like', snippet });

    if (this.options.dryRun) {
      this.highlightElement(article, '#ec4899');
      this.stats.likes++;
      this.stats.total++;
      if (tweetId) this.processedTweetIds.add(tweetId);
      this.notify('item_deleted', { type: 'Like', snippet, dryRun: true });
      await this.sleep(this.getDelay());
      return { success: true };
    }

    // --- Fast Path: API Unlike ---
    if (this.useApi && tweetId) {
      const apiResult = await this.apiUnlike(tweetId);
      if (apiResult.success) {
        this.stats.likes++;
        this.stats.total++;
        this.processedTweetIds.add(tweetId);
        article.remove();
        this.notify('item_deleted', { type: 'Like', snippet, stats: this.stats, method: 'api' });
        return { success: true };
      } else if (apiResult.rateLimited) {
        return { rateLimited: true };
      }
    }

    // --- Fallback: DOM Unlike ---
    if (!unlikeBtn) return { skipped: true, reason: 'No unlike button' };
    article.scrollIntoView({ behavior: 'instant', block: 'center' });
    await this.sleep(60);

    this.simulateClick(unlikeBtn);
    await this.sleep(120);
    article.remove();
    if (tweetId) this.processedTweetIds.add(tweetId);

    this.stats.likes++;
    this.stats.total++;
    this.notify('item_deleted', { type: 'Like', snippet, stats: this.stats, method: 'dom' });
    return { success: true };
  }

  // Visual highlight for dry-run
  highlightElement(el, color) {
    el.style.outline = `3px solid ${color}`;
    el.style.transition = 'outline 0.2s ease';
    setTimeout(() => {
      if (el) el.style.outline = '';
    }, 800);
  }

  // Instant scroll to load more items in virtual list (works cleanly in background tabs)
  async scrollTimeline() {
    this.consecutiveEmptyScrolls++;
    if (this.consecutiveEmptyScrolls > this.maxEmptyScrolls) {
      return false; // Reached end of list
    }

    this.notify('scrolling', { attempt: this.consecutiveEmptyScrolls });

    const scrollAmount = Math.floor(window.innerHeight * 0.9);
    // Instant scroll to ensure background tabs trigger scroll events without requestAnimationFrame stalls
    window.scrollBy({ top: scrollAmount, behavior: 'instant' });

    // Wait for X to load new nodes (shortened from 1200ms+ to 500ms + jitter)
    await this.sleep(500 + this.getDelay());
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

    // All selected stages completed
    return false;
  }
}

// Make accessible to content scripts
window.XHitEngine = XHitEngine;
