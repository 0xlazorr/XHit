# ⚡ XHit — The Ultimate Twitter / X Post Eraser & Account Cleaner

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20%7C%20No%20Servers-success.svg)](#privacy--security)
[![License](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.2.0-crimson.svg)](https://github.com/0xlazorr/XHit/releases)

**XHit** is a powerful, locally-run Chrome extension designed to cleanly and completely wipe your presence on Twitter / X. Featuring a hybrid architecture that pairs direct internal GraphQL API mutations with instant DOM automation fallbacks, XHit delivers 10x–20x faster account purging with zero server dependencies, rate-limit protection, background tab execution, and an ultra-modern UI/UX.

---

## 🌟 Key Highlights

- **⚡ High-Throughput Hybrid Engine (v1.2.0)**:
  - **Direct Fast-Path Web API**: Issues native GraphQL mutations (`DeleteTweet`, `DeleteRetweet`, `UnfavoriteTweet`) using active browser session tokens (`ct0` CSRF + Bearer auth). Cuts per-tweet execution time from ~2.5s down to **~150ms–250ms** (10x–20x speedup).
  - **Instant DOM Fallback**: Automatically degrades to optimized, instant DOM simulation if API hashes or permissions require fallback.
  - **Background Tab & Minimized Window Execution**: Uses non-blocking instant scrolling and keepalive pings to prevent Chrome's `requestAnimationFrame` and timer throttling from halting wipes while tabs are inactive or minimized.
- **⚡ One-Click "Select Delete All" & Quick Presets**:
  - **⚡ Wipe All**: Complete account purge across all tabs.
  - **💬 Replies Only**: Wipe comment and thread history while preserving original tweets.
  - **🔁 RTs & Likes**: Clear your engagement footprint.
- **🔄 Automated Multi-Tab Progression**: Cleans your **Posts** (`/username`), automatically transitions to **Replies & Comments** (`/username/with_replies`), and finishes with **Likes** (`/username/likes`).
- **📁 Twitter Archive Deep Wiper (`tweets.js` & CSV Support)**:
  - Twitter caps public timelines to ~3,200 posts. For accounts with 5,000 to 20,000+ posts, load your official Twitter archive (`data/tweets.js`) or any tweet/bookmark CSV (including `TwitterBookmarks.csv`) to deep-wipe every post via direct API calls in an isolated tab with zero DOM virtualization limits.
  - Filter by date or engagement, and export clean **JSON** and **CSV** backups.
- **🔒 100% Local & Private**: Runs entirely within your browser session. No API keys, no passwords, no telemetry, and zero third-party servers.

---

## 🚀 Quick Start & Installation

XHit runs as an unpacked Chrome extension locally in any Chromium browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi).

### 1. Download or Clone the Repository

```bash
git clone https://github.com/0xlazorr/XHit.git
```

Or download and extract the ZIP from the [GitHub Releases](https://github.com/0xlazorr/XHit/releases) page.

### 2. Load into Chrome

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `XHit` folder (the folder containing `manifest.json`).
5. XHit is now installed! Pin it to your toolbar by clicking the puzzle icon on Chrome's toolbar.

---

## 📖 How to Use

### Method 1: Live Timeline Wiper (Most Common)

```
[Open x.com] ──> [Click XHit Icon] ──> [Select Delete All] ──> [Wipe Everything] ──> [Done 🎉]
```

1. Log into your account at [x.com](https://x.com).
2. Click the **XHit** icon in your browser toolbar.
3. Click **"Select Delete All"** (or choose individual targets: Posts, Replies, Reposts, Likes).
4. Click **⚡ WIPE EVERYTHING NOW**.
5. XHit will:
   - Automatically detect your username handle (`@your_handle`).
   - If you're on the home feed or explore page, automatically navigate to your profile.
   - Delete all your posts and retweets on the main tab.
   - Smoothly auto-scroll to fetch older posts.
   - Automatically transition to `/with_replies` to wipe all comments and thread replies.
   - Automatically transition to `/likes` to unlike all posts.
   - Display celebratory notification when completely clean!

> [!TIP]
> Keep the browser tab open while wiping. You can minimize the floating HUD dock using the `_` button in the in-page dock if you want it out of view.

---

### Method 2: Twitter Archive Deep Wiper (For Older Accounts > 3,200 Posts)

Twitter's web interface restricts public profile scrolling to approximately **3,200 tweets**. If your account is older or has thousands of tweets:

1. Request your Twitter Data Archive:
   - Go to `Settings and privacy` → `Your account` → `Download an archive of your data`.
   - Twitter will email you a `.zip` archive once ready.
2. Unpack the zip archive and locate the file:
   ```text
   data/tweets.js
   ```
3. Open the **XHit Archive Wiper**:
   - Click the XHit extension popup → Click **"Archive Wiper (tweets.js)"** at the bottom.
4. Drag and drop your `tweets.js` file into the upload zone.
5. Filter by date (e.g. "All Time", "Older than 1 Year", or keyword filter).
6. (Optional) Click **💾 Export Backup (JSON)** to preserve an offline archive for yourself.
7. Click **⚡ Wipe Filtered Posts** to begin deep deletion!

---

## ⚙️ Configuration & Speed Modes

| Speed Profile | Delay Per Action | Recommended For |
| :--- | :--- | :--- |
| **Safe (Anti-Ban)** | 1400ms – 2400ms | Highly active accounts, accounts with recent warnings, or large overnight wipes. |
| **Balanced** *(Default)* | 700ms – 1200ms | Recommended for most users. Fast, efficient, and well within standard rate limits. |
| **Turbo** | 300ms – 500ms | Quick cleanups of smaller batches (< 100 items). |

### Target Options

- **Posts & Tweets**: Wipes original tweets authored by you.
- **Replies & Comments**: Wipes replies to other users and thread replies.
- **Reposts (Retweets)**: Automatically clicks "Undo Repost" on all retweets.
- **Liked Posts**: Unlikes tweets on your likes timeline.
- **Multi-Tab Wipe**: When enabled, automatically progresses through all tabs.
- **Dry Run (Preview Only)**: Simulates deletion, highlights target tweets with a red border, and tallies the total without making any destructive calls.

---

## 🧩 Extension Architecture

```
XHit/
├── manifest.json              # Chrome Manifest V3 configuration
├── LICENSE                    # MIT Open Source License
├── README.md                  # Comprehensive user and developer guide
├── icons/                     # Crisp vector & high-res icons (16, 32, 48, 128)
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                     # Browser Action Popup
│   ├── popup.html             # Sleek dark-mode user interface
│   ├── popup.css              # Cyberpunk / Obsidian styling
│   └── popup.js               # Tab communication & settings coordinator
├── content/                   # In-Page Content Scripts
│   ├── engine.js              # DOM automation, scroll manager & rate limit shield
│   ├── hud.js                 # In-page draggable HUD widget
│   ├── hud.css                # Scoped CSS for in-page HUD
│   └── content.js             # Runtime message listener & orchestrator
├── background/                # Service Worker
│   └── background.js          # Tab routing, badge counter & lifecycle manager
└── archive/                   # Archive Wiper Subsystem
    ├── archive.html           # tweets.js parser UI
    ├── archive.css            # Clean dashboard styles
    └── archive.js             # Batch archive processor & JSON exporter
```

---

## 🛡️ Privacy & Security

- **100% Client-Side**: XHit executes exclusively inside your local Chrome browser session.
- **No Third-Party Requests**: The extension makes **zero network requests** to external servers or telemetry collectors.
- **No Credentials Stored**: XHit never asks for, reads, or stores your Twitter username, password, 2FA tokens, or cookies. It operates solely through authenticated DOM interactions within your active session.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>1. Will using XHit get my Twitter account banned?</b></summary>
XHit is specifically engineered with randomized human-like delays (jitter) and automated toast detection for rate limits. When a rate limit warning is detected, XHit cools down for 30 seconds before continuing. Using the <b>Safe</b> or <b>Balanced</b> speed mode keeps activity well within typical user interaction patterns.
</details>

<details>
<summary><b>2. Can deleted tweets be recovered?</b></summary>
No. Deletions on Twitter / X are permanent. If you want to keep a record of your thoughts or media, use the <b>Export Backup (JSON)</b> button in the Archive Wiper or download your official Twitter archive before wiping.
</details>

<details>
<summary><b>3. Why did the wiping stop after a few scrolls?</b></summary>
If XHit scrolls 4 consecutive times without finding any tweets authored by you, it concludes that the current timeline is completely clean. If <i>Multi-Tab Wipe</i> is enabled, it will automatically navigate to the next tab (e.g. from Posts to Replies).
</details>

<details>
<summary><b>4. Does it delete Direct Messages (DMs)?</b></summary>
No. Direct Messages are end-to-end conversations stored separately in Twitter's messaging system. XHit focuses on public posts, comments, retweets, and likes.
</details>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
