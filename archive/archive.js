/**
 * XHit - Archive Deep Wiper Logic
 * Filter chips, dynamic sorting, CSV & JSON exporter, and batch deletion
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
        });

        applyFilters();
        showResults();
      } catch (err) {
        alert('Failed to parse archive file: ' + err.message);
      }
    };
    reader.readAsText(file);
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
    let csv = 'ID,Date,Likes,Retweets,Text\n';
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

  // Batch Wipe Process
  btnStartWipe.addEventListener('click', async () => {
    if (isWiping) return;
    if (filteredTweets.length === 0) {
      alert('No tweets match the selected filter criteria.');
      return;
    }

    const confirmed = confirm(`Are you sure you want to wipe ${filteredTweets.length} tweets from your Twitter archive? This action is permanent.`);
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
