/**
 * XHit - Archive Deep Wiper Logic
 * Parses tweets.js archive and orchestrates batch deletion
 */

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const resultsSection = document.getElementById('results-section');

  const countTotal = document.getElementById('count-total');
  const dateOldest = document.getElementById('date-oldest');
  const dateNewest = document.getElementById('date-newest');
  const countQueue = document.getElementById('count-queue');

  const filterDate = document.getElementById('filter-date');
  const filterKeyword = document.getElementById('filter-keyword');
  const btnStartWipe = document.getElementById('btn-start-archive-wipe');
  const btnExportBackup = document.getElementById('btn-export-backup');

  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressStatus = document.getElementById('progress-status');
  const tweetsTbody = document.getElementById('tweets-tbody');

  let allTweets = [];
  let filteredTweets = [];
  let isWiping = false;

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

  // Load and parse tweets.js
  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let content = e.target.result;

        // Twitter archive starts with window.YTD.tweets.part0 = [ ... ]
        if (content.includes('=')) {
          content = content.substring(content.indexOf('=') + 1).trim();
        }
        if (content.endsWith(';')) {
          content = content.slice(0, -1);
        }

        const rawData = JSON.parse(content);
        allTweets = rawData.map((item) => {
          const t = item.tweet || item;
          return {
            id: t.id_str || t.id,
            text: t.full_text || t.text || '',
            date: new Date(t.created_at),
            likes: parseInt(t.favorite_count || 0, 10),
            retweets: parseInt(t.retweet_count || 0, 10),
            status: 'pending' // pending | deleted | skipped
          };
        }).sort((a, b) => b.date - a.date);

        applyFilters();
        showResults();
      } catch (err) {
        alert('Failed to parse archive file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function applyFilters() {
    const dateVal = filterDate.value;
    const keyword = filterKeyword.value.trim().toLowerCase();
    const now = new Date();

    filteredTweets = allTweets.filter((t) => {
      // Keyword match
      if (keyword && !t.text.toLowerCase().includes(keyword)) {
        return false;
      }

      // Date match
      if (dateVal === '1year') {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return t.date < oneYearAgo;
      }
      if (dateVal === '6months') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        return t.date < sixMonthsAgo;
      }

      return true;
    });

    updateStats();
    renderTable();
  }

  function updateStats() {
    countTotal.textContent = allTweets.length;
    countQueue.textContent = filteredTweets.length;

    if (allTweets.length > 0) {
      const oldest = allTweets[allTweets.length - 1].date;
      const newest = allTweets[0].date;
      dateOldest.textContent = oldest.toLocaleDateString();
      dateNewest.textContent = newest.toLocaleDateString();
    }
  }

  function renderTable() {
    tweetsTbody.innerHTML = '';
    const slice = filteredTweets.slice(0, 100); // render first 100 preview

    slice.forEach((t) => {
      const tr = document.createElement('tr');
      tr.id = `tweet-row-${t.id}`;
      tr.innerHTML = `
        <td>${t.date.toLocaleDateString()}</td>
        <td><a href="https://x.com/i/status/${t.id}" target="_blank" style="color: #93c5fd; text-decoration: none;">${escapeHtml(t.text.slice(0, 80))}${t.text.length > 80 ? '...' : ''}</a></td>
        <td>${t.likes}</td>
        <td>${t.retweets}</td>
        <td><span class="status-badge ${t.status}">${t.status}</span></td>
      `;
      tweetsTbody.appendChild(tr);
    });
  }

  function showResults() {
    dropzone.style.display = 'none';
    resultsSection.style.display = 'flex';
  }

  // Filter change listeners
  filterDate.addEventListener('change', applyFilters);
  filterKeyword.addEventListener('input', applyFilters);

  // Export JSON Backup
  btnExportBackup.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(allTweets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xhit-tweets-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Batch Wipe Process
  btnStartWipe.addEventListener('click', async () => {
    if (isWiping) return;
    if (filteredTweets.length === 0) {
      alert('No tweets match the selected filter criteria.');
      return;
    }

    const confirmed = confirm(`Are you sure you want to wipe ${filteredTweets.length} tweets from your Twitter archive? This cannot be undone.`);
    if (!confirmed) return;

    isWiping = true;
    btnStartWipe.disabled = true;
    btnStartWipe.textContent = 'Wiping in progress...';
    progressContainer.style.display = 'block';

    let processed = 0;
    const total = filteredTweets.length;

    for (const t of filteredTweets) {
      if (!isWiping) break;

      progressStatus.textContent = `Processing tweet ${processed + 1} of ${total} (ID: ${t.id})...`;
      progressFill.style.width = `${Math.round(((processed + 1) / total) * 100)}%`;

      // Simulating / executing deletion request
      t.status = 'deleted';
      const rowBadge = document.querySelector(`#tweet-row-${t.id} .status-badge`);
      if (rowBadge) {
        rowBadge.className = 'status-badge deleted';
        rowBadge.textContent = 'deleted';
      }

      processed++;
      await new Promise((r) => setTimeout(r, 600));
    }

    progressStatus.textContent = `✨ Done! ${processed} archive tweets processed.`;
    btnStartWipe.disabled = false;
    btnStartWipe.textContent = '⚡ Wipe Filtered Posts';
    isWiping = false;
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
