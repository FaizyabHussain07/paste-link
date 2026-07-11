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
const TOUR_DONE_KEY = 'pl_tour_done';
const RESULT_TOUR_DONE_KEY = 'pl_result_tour_done';
let activeTourDriver = null;
let resultTourShown = false;
let resultTourPending = false;

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

      if (!localStorage.getItem(RESULT_TOUR_DONE_KEY)) {
        setTimeout(() => queueResultTour(), 650);
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

function trackTourEvent(eventName) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventName })
  }).catch(() => {});
}

function resolveTourFactory() {
  if (typeof window.driver === 'undefined' || !window.driver?.js) return null;
  if (typeof window.driver.js.driver === 'function') return window.driver.js.driver;
  if (typeof window.driver.js === 'function') return window.driver.js;
  return null;
}

function launchTour(steps, options = {}) {
  const driverFactory = resolveTourFactory();
  if (!driverFactory || !Array.isArray(steps) || !steps.length) return null;

  const driverObj = driverFactory({
    showProgress: true,
    stagePadding: 10,
    smoothScroll: true,
    allowClose: true,
    popoverClass: 'pl-tour-popover',
    steps,
    onDestroyStarted: () => {
      if (!driverObj.hasNextStep() || driverObj.getState().activeIndex === steps.length - 1) {
        trackTourEvent(options.completeEvent || 'tour_completed');
      } else {
        trackTourEvent(options.skipEvent || 'tour_skipped');
      }
      if (options.doneKey) {
        localStorage.setItem(options.doneKey, 'true');
      }
      activeTourDriver = null;
      if (resultTourPending) {
        resultTourPending = false;
        setTimeout(() => startResultTour(), 120);
      }
      driverObj.destroy();
    }
  });

  activeTourDriver = driverObj;
  setTimeout(() => {
    trackTourEvent(options.startEvent || 'tour_started');
    driverObj.drive();
  }, 500);

  return driverObj;
}

function startCreatePageTour() {
  const steps = [
    { element: '.create-help-card', popover: { title: 'Create a secure paste', description: 'Start with your message, then choose the privacy controls that fit your workflow.' } },
    { element: '#textInput', popover: { title: 'Paste your content', description: 'Drop your text, code, notes, or sensitive draft here.' } },
    { element: '#expiryPills', popover: { title: 'Choose the expiry', description: 'Set how long the paste stays available before it expires automatically.' } },
    { element: '#passwordInput', popover: { title: 'Add an optional password', description: 'Lock access to the link if you want only the right viewer to open it.' } },
    { element: '.toggle-label', popover: { title: 'Burn after read', description: 'Enable one-time destruction so the content is removed after the first open.' } },
    { element: '#saveBtn', popover: { title: 'Create the share link', description: 'When ready, generate a secure link you can send immediately.' } }
  ];

  launchTour(steps, {
    startEvent: 'tour_started',
    completeEvent: 'tour_completed',
    skipEvent: 'tour_skipped',
    doneKey: TOUR_DONE_KEY,
  });
}

function queueResultTour() {
  if (localStorage.getItem(RESULT_TOUR_DONE_KEY)) return;
  resultTourPending = true;

  if (activeTourDriver) {
    activeTourDriver.destroy();
    return;
  }

  startResultTour();
}

function startResultTour() {
  if (resultTourShown || localStorage.getItem(RESULT_TOUR_DONE_KEY)) return;
  resultTourShown = true;

  const steps = [
    { element: '#resultWrap', popover: { title: 'Your secure link is ready', description: 'PasteLink generated a private share URL for your content.' } },
    { element: '#linkDisplayURL', popover: { title: 'Share the generated link', description: 'This is the final URL you can send to anyone you trust.' } },
    { element: '#copyBtn', popover: { title: 'Copy the link fast', description: 'Use the copy action to send it through WhatsApp, Telegram, Email, or chat.' } },
    { element: '#openBtn', popover: { title: 'Open in a new tab', description: 'Preview the live view link instantly from a separate tab.' } },
    { element: '#qrLink', popover: { title: 'Open the QR code', description: 'Scan the QR code on mobile to open the page without typing the link.' } },
    { element: '#downloadBtn', popover: { title: 'Download the content', description: 'Save the text locally as a plain text or Word document file.' } },
    { element: '#newBtn', popover: { title: 'Start another paste', description: 'Clear the current state and create another secure share in one click.' } }
  ];

  launchTour(steps, {
    startEvent: 'tour_result_started',
    completeEvent: 'tour_result_completed',
    skipEvent: 'tour_result_skipped',
    doneKey: RESULT_TOUR_DONE_KEY,
  });
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

  if (typeof window.driver !== 'undefined' && typeof window.driver.js !== 'undefined') {
    const hasSeenTour = localStorage.getItem(TOUR_DONE_KEY);
    const isCreatePage = !!document.getElementById('editorBox');
    const isHomePage = !!document.querySelector('.hero') && !isCreatePage;

    if (!hasSeenTour && isCreatePage) {
      startCreatePageTour();
    } else if (!hasSeenTour && isHomePage) {
      const homeSteps = [
        { element: '.hero', popover: { title: 'PasteLink Pro', description: 'Create temporary, private share links with secure controls.' } },
        { element: '.hero-cta', popover: { title: 'Start from the home page', description: 'Use the primary action to open the creator page in one click.' } },
        { element: '#demo', popover: { title: 'Watch the product demo', description: 'See how the workflow feels in a real, end-to-end example.' } },
        { element: '.features', popover: { title: 'Explore the privacy features', description: 'Review the main product capabilities at a glance.' } },
        { element: '.faq-section', popover: { title: 'Review the FAQ', description: 'Check common security and privacy questions quickly.' } }
      ];

      launchTour(homeSteps, {
        startEvent: 'tour_started',
        completeEvent: 'tour_completed',
        skipEvent: 'tour_skipped',
        doneKey: TOUR_DONE_KEY,
      });
    }
  }
});
