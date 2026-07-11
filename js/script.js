// ============================================
// script.js — PasteLink Home Page
// Features: password protect, burn-after-read,
//           preview tab, expiry pills, dark mode
// ============================================

import { database } from './db.js';

// ---- Helpers ----
function showToast(msg, icon = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${icon} <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function triggerDownload(content, type) {
  const blob = new Blob([content], { type: type === 'doc' ? 'application/msword' : 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pastelink-pro-${Date.now()}.${type}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- DOM ----
const textInput = document.getElementById('textInput');
const saveBtn = document.getElementById('saveBtn');
const saveBtnText = document.getElementById('saveBtnText');
const charStat = document.getElementById('charStat');
const wordStat = document.getElementById('wordStat');
const passwordInput = document.getElementById('passwordInput');
const burnToggle = document.getElementById('burnToggle');
const errorAlert = document.getElementById('errorAlert');
const errorMsg = document.getElementById('errorMsg');
const resultWrap = document.getElementById('resultWrap');
const resultMeta = document.getElementById('resultMeta');
const linkDisplayURL = document.getElementById('linkDisplayURL');
const copyBtn = document.getElementById('copyBtn');
const copyIcon = copyBtn ? copyBtn.querySelector('.copy-icon') : null;
const checkIcon = copyBtn ? copyBtn.querySelector('.check-icon') : null;
const openBtn = document.getElementById('openBtn');
const newBtn = document.getElementById('newBtn');
const resultFullLink = document.getElementById('resultFullLink');
const qrLink = document.getElementById('qrLink');
const themeToggle = document.getElementById('themeToggle');
const iconSun = themeToggle ? themeToggle.querySelector('.icon-sun') : null;
const iconMoon = themeToggle ? themeToggle.querySelector('.icon-moon') : null;
const writePanel = document.getElementById('writePanel');
const previewPanel = document.getElementById('previewPanel');
const previewContent = document.getElementById('previewContent');
const qrOverlay = document.getElementById('qrOverlay');
const qrImage = document.getElementById('qrImage');
const closeQr = document.getElementById('closeQr');
const downloadBtn = document.getElementById('downloadBtn');
const downloadMenu = document.getElementById('downloadMenu');
const downloadTxt = document.getElementById('downloadTxt');
const downloadDoc = document.getElementById('downloadDoc');
const demoVideo = document.getElementById('demoVideo');
const demoPlayBtn = document.getElementById('demoPlayBtn');
const demoPlayer = document.getElementById('demoPlayer');

const MAX_CHARS = 50000;
let selectedExpiry = 3600;
let generatedURL = '';
const isCreatePage = Boolean(textInput && saveBtn && passwordInput && burnToggle);

// ---- Theme ----
function initTheme() {
  if (!themeToggle || !iconSun || !iconMoon) return;
  const saved = localStorage.getItem('pl_theme');
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(dark ? 'dark' : 'light');
}

function setTheme(t) {
  if (!themeToggle || !iconSun || !iconMoon) return;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('pl_theme', t);
  iconSun.style.display = t === 'dark' ? 'block' : 'none';
  iconMoon.style.display = t === 'dark' ? 'none' : 'block';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

initTheme();

if (demoVideo && demoPlayBtn && demoPlayer) {
  demoPlayBtn.addEventListener('click', async () => {
    demoPlayer.classList.add('is-playing');
    demoPlayBtn.setAttribute('aria-hidden', 'true');
    try {
      await demoVideo.play();
    } catch (err) {
      console.error('Demo video playback failed', err);
      demoPlayer.classList.remove('is-playing');
      demoPlayBtn.setAttribute('aria-hidden', 'false');
    }
  });

  demoVideo.addEventListener('play', () => {
    demoPlayer.classList.add('is-playing');
    demoPlayBtn.setAttribute('aria-hidden', 'true');
  });

  demoVideo.addEventListener('pause', () => {
    demoPlayer.classList.remove('is-playing');
    demoPlayBtn.setAttribute('aria-hidden', 'false');
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (isCreatePage) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      if (target === 'write') {
        writePanel.classList.remove('hidden');
        previewPanel.classList.add('hidden');
      } else {
        writePanel.classList.add('hidden');
        previewPanel.classList.remove('hidden');
        const txt = textInput.value;
        if (txt.trim()) {
          previewContent.textContent = txt;
          previewContent.innerHTML = `<span style="white-space:pre-wrap;word-break:break-word">${escapeHtml(txt)}</span>`;
        } else {
          previewContent.innerHTML = '<span class="preview-empty">Nothing to preview yet.</span>';
        }
      }
    });
  });

  document.querySelectorAll('#expiryPills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#expiryPills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedExpiry = parseInt(pill.dataset.val, 10);
    });
  });

  textInput.addEventListener('input', updateStats);

  function updateStats() {
    const txt = textInput.value;
    const chars = txt.length;
    const words = txt.trim() === '' ? 0 : txt.trim().split(/\s+/).length;

    charStat.textContent = `${chars.toLocaleString()} chars`;
    wordStat.textContent = `${words.toLocaleString()} words`;

    if (resultWrap && resultWrap.style.display !== 'none') {
      resultWrap.style.display = 'none';
    }
    hideError();
  }

  function genId(len = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => chars[b % chars.length]).join('');
  }

  async function hashPassword(pw) {
    const enc = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function expiryLabel(secs) {
    if (secs < 3600) return `${secs / 60} minute${secs / 60 > 1 ? 's' : ''}`;
    if (secs < 86400) return `${secs / 3600} hour${secs / 3600 > 1 ? 's' : ''}`;
    return `${secs / 86400} day${secs / 86400 > 1 ? 's' : ''}`;
  }

  saveBtn.addEventListener('click', async () => {
    const content = textInput.value.trim();

    if (!content) {
      showError('Please enter some text first.');
      return;
    }
    if (content.length > MAX_CHARS) {
      showError(`Text too long. Max ${MAX_CHARS.toLocaleString()} characters.`);
      return;
    }

    setSaving(true);
    hideError();
    if (resultWrap) resultWrap.style.display = 'none';

    const customId = genId(8);
    const burnAfter = burnToggle.checked;
    const pw = passwordInput.value.trim();
    let pwHash = null;

    try {
      if (pw) {
        pwHash = await hashPassword(pw);
      }

      await database.savePaste({
        customId,
        content,
        expirySeconds: selectedExpiry,
        burnAfterRead: burnAfter,
        hasPassword: !!pwHash,
        passwordHash: pwHash,
      });

      showToast('Link created successfully!', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>');

      generatedURL = `${window.location.origin}/view.html?id=${customId}`;
      if (linkDisplayURL) linkDisplayURL.textContent = generatedURL;
      if (resultFullLink) {
        resultFullLink.href = generatedURL;
        resultFullLink.textContent = generatedURL;
      }
      if (openBtn) openBtn.href = generatedURL;

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedURL)}`;
      if (qrImage) qrImage.src = qrUrl;

      const metaParts = [`Auto-deletes in ${expiryLabel(selectedExpiry)}`];
      if (burnAfter) metaParts.push('· Burns after first read');
      if (pw) metaParts.push('· Password protected');
      if (resultMeta) resultMeta.textContent = metaParts.join(' ');

      if (resultWrap) {
        resultWrap.style.display = 'block';
        resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      console.error('Save error:', err);
      if (resultWrap) resultWrap.style.display = 'none';

      let message = 'Could not save link. Please try again or check your connection.';
      if (err.name === 'AbortError') {
        message = 'Request timeout. Your connection might be slow. Please try again.';
      } else if (err.message) {
        message = err.message;
      }
      showError(message);
    } finally {
      setSaving(false);
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const urlToCopy = (resultFullLink && resultFullLink.href) ? resultFullLink.href : generatedURL;
      try {
        await navigator.clipboard.writeText(urlToCopy);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = urlToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Link copied!', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>');

      copyBtn.classList.add('copied');
      if (copyIcon) copyIcon.style.display = 'none';
      if (checkIcon) checkIcon.style.display = 'block';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        if (copyIcon) copyIcon.style.display = 'block';
        if (checkIcon) checkIcon.style.display = 'none';
      }, 2200);
    });
  }

  if (qrLink && qrOverlay && qrImage && closeQr) {
    qrLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (qrImage.src) {
        qrOverlay.style.display = 'flex';
      }
    });

    closeQr.addEventListener('click', () => {
      qrOverlay.style.display = 'none';
    });

    qrOverlay.addEventListener('click', (e) => {
      if (e.target === qrOverlay) qrOverlay.style.display = 'none';
    });
  }

  if (downloadBtn && downloadMenu) {
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      downloadMenu.classList.remove('show');
    });

    if (downloadTxt) {
      downloadTxt.addEventListener('click', () => {
        triggerDownload(textInput.value, 'txt');
      });
    }

    if (downloadDoc) {
      downloadDoc.addEventListener('click', () => {
        triggerDownload(textInput.value, 'doc');
      });
    }
  }

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      textInput.value = '';
      passwordInput.value = '';
      burnToggle.checked = false;
      updateStats();
      if (resultWrap) resultWrap.style.display = 'none';
      if (qrImage) qrImage.src = '';
      hideError();

      document.querySelectorAll('#expiryPills .pill').forEach(p => p.classList.remove('active'));
      const defaultPill = document.querySelector('#expiryPills .pill[data-val="3600"]');
      if (defaultPill) defaultPill.classList.add('active');
      selectedExpiry = 3600;
      textInput.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (qrLink && qrImage) {
    qrLink.addEventListener('click', () => {
      if (qrImage.src) {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'qr_usage' })
        }).catch(err => console.error('Failed to track QR usage', err));
      }
    });
  }
}

function setSaving(v) {
  if (!saveBtn || !saveBtnText) return;
  saveBtn.disabled = v;
  saveBtnText.textContent = v ? 'Saving…' : 'Create Share Link';
}

function showError(msg) {
  if (errorMsg) errorMsg.textContent = msg;
  if (errorAlert) errorAlert.style.display = 'flex';
}

function hideError() {
  if (errorAlert) errorAlert.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
  const pastesEl = document.getElementById('stat-pastes');
  const viewsEl = document.getElementById('stat-views');
  const expiryEl = document.getElementById('stat-expiry');
  const countriesEl = document.getElementById('stat-countries');

  if (pastesEl) {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data && !data.error) {
        pastesEl.textContent = (data.totalPastes || 0).toLocaleString();
        viewsEl.textContent = (data.totalViews || 0).toLocaleString();
        expiryEl.textContent = data.popularExpiry || '1h';
        countriesEl.textContent = (data.activeCountries || 14) + '+';
      }
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }

  if (typeof window.driver !== 'undefined' && window.driver?.js) {
    const hasSeenTour = localStorage.getItem('pl_tour_done');
    const isCreatePage = !!document.getElementById('editorBox');
    const isHomePage = !!document.querySelector('.hero') && !isCreatePage;

    if (!hasSeenTour && (isCreatePage || isHomePage)) {
      const steps = isCreatePage
        ? [
            { element: '.create-help-card', popover: { title: 'Welcome to PasteLink Pro', description: 'Create a secure private paste in a few quick steps.' } },
            { element: '#textInput', popover: { title: 'Paste Your Content', description: 'Add the text, code, or note you want to share.' } },
            { element: '#expiryPills', popover: { title: 'Choose Expiry Time', description: 'Select a lifetime for your paste: 10 minutes, 1 hour, 12 hours, 1 day, or 7 days.' } },
            { element: '#passwordInput', popover: { title: 'Add an Optional Password', description: 'Set a password if you want only the intended viewer to open the link.' } },
            { element: '.toggle-label', popover: { title: 'Burn After Read', description: 'Turn this on if the paste should delete immediately after the first open.' } },
            { element: '#saveBtn', popover: { title: 'Create the Share Link', description: 'Click here to generate a secure, private link instantly.' } }
          ]
        : [
            { element: '.hero', popover: { title: 'PasteLink Pro', description: 'Create temporary, private share links with secure controls.' } },
            { element: '.hero-cta', popover: { title: 'Start From the Home Page', description: 'Use the main call-to-action to open the creator page in one click.' } },
            { element: '#demo', popover: { title: 'Watch the Product Demo', description: 'Use the walkthrough to understand how the app feels in real usage.' } },
            { element: '.features', popover: { title: 'Explore the Main Features', description: 'See the key privacy and sharing controls at a glance.' } },
            { element: '.faq-section', popover: { title: 'Review the FAQ', description: 'Check the most common questions about security, privacy, and expiry.' } }
          ];

      const driverFactory = typeof window.driver?.js?.driver === 'function'
        ? window.driver.js.driver
        : typeof window.driver?.js === 'function'
          ? window.driver.js
          : null;

      if (!driverFactory) return;

      const driverObj = driverFactory({
        showProgress: true,
        steps,
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep() || driverObj.getState().activeIndex === steps.length - 1) {
            fetch('/api/track', { method: 'POST', body: JSON.stringify({ event: 'tour_completed' }) }).catch(() => {});
          } else {
            fetch('/api/track', { method: 'POST', body: JSON.stringify({ event: 'tour_skipped' }) }).catch(() => {});
          }
          localStorage.setItem('pl_tour_done', 'true');
          driverObj.destroy();
        }
      });

      setTimeout(() => {
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'tour_started' }) }).catch(() => {});
        driverObj.drive();
      }, 500);
    }
  }
});
