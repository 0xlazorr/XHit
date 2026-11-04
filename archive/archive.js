/**
 * XHit - Archive Deep Wiper Logic
 * Hybrid High-Speed Archive Wiper: JSON, tweets.js, & CSV Support
 * Direct GraphQL Web API Deletion with Auto Rate-Limit Recovery
 */

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const resultsSection = document.getElementById('results-section');

  const countTotal = document.getElementById('count-total');
  const dateOldest = document.getElementById('date-oldest');
  const dateNewest = document.getElementById('date-newest');
  const countQueue = document.getElementById('count-queue');

  const filterChips = document.querySelectorAll('.filter-chip');
  const filterKeyword = document.getElementById('filter-keyword');
  const selectSort = document.getElementById('select-sort');
  const btnStartWipe = document.getElementById('btn-start-archive-wipe');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnExportCsv = document.getElementById('btn-export-csv');

  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressStatus = document.getElementById('progress-status');
  const tweetsTbody = document.getElementById('tweets-tbody');

  let allTweets = [];
  let filteredTweets = [];
  let activeFilterType = 'all';
  let isWiping = false;

  const BEARER_TOKEN = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  const DELETE_TWEET_QUERY_ID = 'VaenaVgh5q5ih7kvyVjgtg';
  const DELETE_BOOKMARK_QUERY_ID = 'Wlmlj2-xzyS1GN3a6cj-mQ';

  // Dropzone interactions
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      loadFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadFile(e.target.files[0]);
    }
  });

  // Load and parse tweets.js, JSON, or CSV
  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const isCsv = file.name.toLowerCase().endsWith('.csv') || content.trim().startsWith('Tweet Id') || content.trim().startsWith('"Tweet Id"');

        if (isCsv) {
          allTweets = parseCSV(content);
        } else {
          // Twitter archive starts with window.YTD.tweets.part0 = [ ... ]
          let jsonContent = content;
          if (jsonContent.includes('=')) {
            jsonContent = jsonContent.substring(jsonContent.indexOf('=') + 1).trim();
          }
          if (jsonContent.endsWith(';')) {
            jsonContent = jsonContent.slice(0, -1);
          }

          const rawData = JSON.parse(jsonContent);
          allTweets = rawData.map((item) => {
            const t = item.tweet || item;
            return {
              id: String(t.id_str || t.id),
              text: t.full_text || t.text || '',
              date: new Date(t.created_at),
              likes: parseInt(t.favorite_count || 0, 10),
              retweets: parseInt(t.retweet_count || 0, 10),
              status: 'pending' // pending | deleted | error
            };
          });
        }

        if (allTweets.length === 0) {
          throw new Error('No valid tweets or records found in this file.');
        }

        applyFilters();
        showResults();
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Robust CSV parser supporting quotes and commas
  function parseCSV(text) {
    const lines = [];
    let currentLine = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentLine.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentLine.push(currentCell.trim());
        if (currentLine.some((c) => c.length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    if (currentCell.length > 0 || currentLine.length > 0) {
      currentLine.push(currentCell.trim());
      lines.push(currentLine);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map((h) => h.toLowerCase());
    const idIdx = headers.findIndex((h) => h.includes('tweet id') || h === 'id');
    const textIdx = headers.findIndex((h) => h.includes('full text') || h.includes('text') || h.includes('content'));
    const dateIdx = headers.findIndex((h) => h.includes('created at') || h.includes('date') || h.includes('time'));
    const likesIdx = headers.findIndex((h) => h.includes('favorite count') || h.includes('likes'));
    const rtIdx = headers.findIndex((h) => h.includes('retweet count') || h.includes('retweets'));

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i];
      const id = idIdx >= 0 ? cols[idIdx] : cols[0];
      if (!id || !/^\d+$/.test(id)) continue;

      const text = textIdx >= 0 ? cols[textIdx] : '';
      const dateVal = dateIdx >= 0 && cols[dateIdx] ? new Date(cols[dateIdx]) : new Date();
      const likes = likesIdx >= 0 ? parseInt(cols[likesIdx] || '0', 10) : 0;
      const retweets = rtIdx >= 0 ? parseInt(cols[rtIdx] || '0', 10) : 0;

      parsed.push({
        id: String(id),
        text: text || '',
        date: isNaN(dateVal.getTime()) ? new Date() : dateVal,
        likes: isNaN(likes) ? 0 : likes,
        retweets: isNaN(retweets) ? 0 : retweets,
        status: 'pending'
      });
    }

    return parsed;
  }

  function applyFilters() {
    const keyword = filterKeyword.value.trim().toLowerCase();
    const now = new Date();

    filteredTweets = allTweets.filter((t) => {
      if (keyword && !t.text.toLowerCase().includes(keyword)) {
        return false;
      }

      if (activeFilterType === '1year') {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return t.date < oneYearAgo;
      }
      if (activeFilterType === '2years') {
        const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        return t.date < twoYearsAgo;
      }
      if (activeFilterType === 'zerolikes') {
        return t.likes === 0;
      }

      return true;
    });

    applySorting();
    updateStats();
    renderTable();
  }

  function applySorting() {
    const sortVal = selectSort.value;
    filteredTweets.sort((a, b) => {
      if (sortVal === 'date-desc') return b.date - a.date;
      if (sortVal === 'date-asc') return a.date - b.date;
      if (sortVal === 'likes-desc') return b.likes - a.likes;
      if (sortVal === 'likes-asc') return a.likes - b.likes;
      return 0;
    });
  }

  function updateStats() {
    countTotal.textContent = allTweets.length;
    countQueue.textContent = filteredTweets.length;

    if (allTweets.length > 0) {
      const sortedByDate = [...allTweets].sort((a, b) => a.date - b.date);
      dateOldest.textContent = sortedByDate[0].date.toLocaleDateString();
      dateNewest.textContent = sortedByDate[sortedByDate.length - 1].date.toLocaleDateString();
    }
  }

  function renderTable() {
    tweetsTbody.innerHTML = '';
    const slice = filteredTweets.slice(0, 100);

    slice.forEach((t) => {
      const tr = document.createElement('tr');
      tr.id = `tweet-row-${t.id}`;
      tr.innerHTML = `
        <td style="color: #9ca3af; font-family: ui-monospace, monospace; font-size: 12px;">${t.date.toLocaleDateString()}</td>
        <td>
          <a href="https://x.com/i/status/${t.id}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: 500;">
            ${escapeHtml(t.text.slice(0, 85))}${t.text.length > 85 ? '...' : ''}
          </a>
        </td>
        <td style="font-weight: 700; color: #f472b6;">♥ ${t.likes}</td>
        <td style="font-weight: 700; color: #34d399;">↻ ${t.retweets}</td>
        <td><span class="status-badge ${t.status}">${t.status}</span></td>
      `;
      tweetsTbody.appendChild(tr);
    });
  }

  function showResults() {
    dropzone.style.display = 'none';
    resultsSection.style.display = 'flex';
  }

  // Filter Chip clicks
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilterType = chip.getAttribute('data-filter');
      applyFilters();
    });
  });

  filterKeyword.addEventListener('input', applyFilters);
  selectSort.addEventListener('change', () => {
    applySorting();
    renderTable();
  });

  // Export JSON Backup
  btnExportJson.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(allTweets, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `xhit-tweets-backup-${getISODate()}.json`);
  });

  // Export CSV Backup
  btnExportCsv.addEventListener('click', () => {
    let csv = 'Tweet Id,Created At,Favorite Count,Retweet Count,Full Text\n';
    allTweets.forEach((t) => {
      const escapedText = `"${t.text.replace(/"/g, '""')}"`;
      csv += `${t.id},"${t.date.toISOString()}",${t.likes},${t.retweets},${escapedText}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `xhit-tweets-backup-${getISODate()}.csv`);
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  // Fetch session CSRF token from background worker
  async function getSessionTokens() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_SESSION_TOKENS' }, (response) => {
        if (response && response.success && response.ct0) {
          resolve(response);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Direct GraphQL API Call to Delete a Tweet
  async function callDeleteTweetAPI(tweetId, ct0) {
    const url = `https://x.com/i/api/graphql/${DELETE_TWEET_QUERY_ID}/DeleteTweet`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'authorization': BEARER_TOKEN,
        'content-type': 'application/json',
        'x-csrf-token': ct0,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session'
      },
      body: JSON.stringify({
        variables: { tweet_id: String(tweetId), dark_request: false },
        queryId: DELETE_TWEET_QUERY_ID
      })
    });

    if (res.status === 429) {
      return { rateLimited: true };
    }
    if (res.ok) {
      return { success: true };
    }
    return { success: false, status: res.status };
  }

  // Batch Wipe Process with High-Throughput API Execution
  btnStartWipe.addEventListener('click', async () => {
    if (isWiping) {
      isWiping = false;
      btnStartWipe.textContent = '⚡ Wipe Filtered Posts';
      progressStatus.textContent = 'Wiping halted by user.';
      return;
    }

    if (filteredTweets.length === 0) {
      alert('No tweets match the selected filter criteria.');
      return;
    }

    // Verify session
    progressStatus.textContent = 'Verifying active Twitter session...';
    progressContainer.style.display = 'block';

    const session = await getSessionTokens();
    if (!session || !session.ct0) {
      alert('Active X (Twitter) login session not detected! Please ensure you are logged into x.com in this browser, then try again.');
      progressContainer.style.display = 'none';
      return;
    }

    const confirmed = confirm(`Are you sure you want to wipe ${filteredTweets.length} tweets from your Twitter account? This action calls Twitter's API directly and is permanent.`);
    if (!confirmed) {
      progressContainer.style.display = 'none';
      return;
    }

    isWiping = true;
    btnStartWipe.textContent = '⏹ Stop Wipe';
    btnStartWipe.classList.remove('btn-primary');
    btnStartWipe.classList.add('btn-secondary');

    let processed = 0;
    let deletedCount = 0;
    const total = filteredTweets.length;

    for (const t of filteredTweets) {
      if (!isWiping) break;

      progressStatus.textContent = `⚡ Wiping tweet ${processed + 1} of ${total} (ID: ${t.id})...`;
      progressFill.style.width = `${Math.round(((processed + 1) / total) * 100)}%`;

      const res = await callDeleteTweetAPI(t.id, session.ct0);

      if (res.rateLimited) {
        progressStatus.textContent = '⚠️ Twitter rate limit encountered! Cooling down for 30s...';
        for (let s = 30; s > 0 && isWiping; s--) {
          progressStatus.textContent = `⏳ Cooling down: resuming in ${s}s...`;
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!isWiping) break;
        // Retry current item
        const retryRes = await callDeleteTweetAPI(t.id, session.ct0);
        t.status = retryRes.success ? 'deleted' : 'skipped';
      } else if (res.success) {
        t.status = 'deleted';
        deletedCount++;
      } else {
        t.status = 'skipped';
      }

      const rowBadge = document.querySelector(`#tweet-row-${t.id} .status-badge`);
      if (rowBadge) {
        rowBadge.className = `status-badge ${t.status}`;
        rowBadge.textContent = t.status;
      }

      processed++;
      // High-efficiency throughput delay (180ms - 250ms per tweet)
      await new Promise((r) => setTimeout(r, 200));
    }

    progressStatus.textContent = `✨ Done! Processed ${processed} posts (${deletedCount} wiped clean from Twitter).`;
    progressFill.style.width = '100%';
    btnStartWipe.textContent = '⚡ Wipe Filtered Posts';
    btnStartWipe.classList.remove('btn-secondary');
    btnStartWipe.classList.add('btn-primary');
    isWiping = false;
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
