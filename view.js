// ============================================
// view.js — PasteLink View Page
// Features: password unlock, burn-after-read,
//           raw view, copy text, expiry timer,
//           char/word/line stats
// ============================================

import { database } from './db.js';

// ---- Helpers ----
function showToast(msg, icon = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${icon} <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---- DOM ----
const loadingState = document.getElementById('loadingState');
const passwordGate = document.getElementById('passwordGate');
const gateInput = document.getElementById('gateInput');
const gateSubmit = document.getElementById('gateSubmit');
const gateError = document.getElementById('gateError');
const viewWrap = document.getElementById('viewWrap');
const viewContent = document.getElementById('viewContent');
const viewExpiry = document.getElementById('viewExpiry');
const viewBurn = document.getElementById('viewBurn');
const notFoundWrap = document.getElementById('notFoundWrap');
const copyContentBtn = document.getElementById('copyContentBtn');
const copyContentText = document.getElementById('copyContentText');
const rawBtn = document.getElementById('rawBtn');
const rawOverlay = document.getElementById('rawOverlay');
const rawContent = document.getElementById('rawContent');
const closeRaw = document.getElementById('closeRaw');
const viewCharCount = document.getElementById('viewCharCount');
const viewWordCount = document.getElementById('viewWordCount');
const viewLineCount = document.getElementById('viewLineCount');
const themeToggle = document.getElementById('themeToggle');
const iconSun = themeToggle.querySelector('.icon-sun');
const iconMoon = themeToggle.querySelector('.icon-moon');

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem('pl_theme');
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(dark ? 'dark' : 'light');
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('pl_theme', t);
  iconSun.style.display = t === 'dark' ? 'block' : 'none';
  iconMoon.style.display = t === 'dark' ? 'none' : 'block';
}
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
});
initTheme();

// ---- State ----
let pasteDoc = null;
let pasteData = null;
let docRef = null;

// ---- Hash password ----
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Format expiry ----
function formatExpiry(expiresAt) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return `Expires in ${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
  if (h > 0) return `Expires in ${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `Expires in ${m}m ${s % 60}s`;
  return `Expires in ${s}s`;
}

// ---- Show content ----
function showContent(text, data) {
  viewContent.textContent = text;

  // Stats
  const chars = text.length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const lines = text.split('\n').length;
  viewCharCount.textContent = `${chars.toLocaleString()} characters`;
  viewWordCount.textContent = `${words.toLocaleString()} words`;
  viewLineCount.textContent = `${lines.toLocaleString()} lines`;

  // Expiry
  if (data.expiresAt) {
    viewExpiry.textContent = formatExpiry(data.expiresAt);
    // Live countdown (Updates every second)
    const timer = setInterval(() => {
      const label = formatExpiry(data.expiresAt);
      viewExpiry.textContent = label;

      if (label === 'Expired') {
        clearInterval(timer);
        setTimeout(() => {
          showNotFound(); // Hide content and show 404
        }, 500);
      }
    }, 1000);
  }

  // Burn badge
  if (data.burnAfterRead) {
    viewBurn.style.display = 'inline-flex';
  }

  // Page title
  const preview = text.substring(0, 50).replace(/\n/g, ' ');
  document.title = `${preview}… — PasteLink`;

  loadingState.style.display = 'none';
  viewWrap.style.display = 'block';
}

// ---- Burn after read ----
async function burnPaste() {
  if (!pasteData || !pasteData.customId) return;
  try {
    await database.deletePaste(pasteData.customId);
  } catch (e) {
    console.warn('Could not delete burned paste:', e);
  }
}

// ---- Load paste ----
async function loadPaste() {
  const params = new URLSearchParams(window.location.search);
  const customId = params.get('id');

  if (!customId) {
    showNotFound();
    return;
  }

  try {
    const result = await database.getPaste(customId);

    if (!result) {
      showNotFound();
      return;
    }

    pasteData = result.data;
    docRef = result.ref;

    // Password check
    if (pasteData.hasPassword) {
      loadingState.style.display = 'none';
      passwordGate.style.display = 'flex';
      gateInput.focus();
      return;
    }

    // Show content
    showContent(pasteData.content, pasteData);

    // Burn after read
    if (pasteData.burnAfterRead) {
      await burnPaste();
    }

  } catch (err) {
    console.error(err);
    showNotFound();
  }
}


// ---- Password gate ----
async function submitPassword() {
  const pw = gateInput.value.trim();
  if (!pw) return;

  gateSubmit.disabled = true;
  gateSubmit.textContent = 'Checking…';
  gateError.style.display = 'none';

  const hash = await hashPassword(pw);

  if (hash === pasteData.passwordHash) {
    passwordGate.style.display = 'none';
    showContent(pasteData.content, pasteData);
    if (pasteData.burnAfterRead) {
      await burnPaste();
    }
  } else {
    gateError.style.display = 'block';
    gateInput.value = '';
    gateInput.focus();
    gateSubmit.disabled = false;
    gateSubmit.textContent = 'Unlock';
  }
}

gateSubmit.addEventListener('click', submitPassword);
gateInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitPassword(); });

// ---- Copy text ----
copyContentBtn.addEventListener('click', async () => {
  const text = viewContent.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showToast('Text copied to clipboard!', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>');
});

// ---- Raw view ----
rawBtn.addEventListener('click', () => {
  rawContent.textContent = viewContent.textContent;
  rawOverlay.style.display = 'flex';
});
closeRaw.addEventListener('click', () => { rawOverlay.style.display = 'none'; });
rawOverlay.addEventListener('click', e => {
  if (e.target === rawOverlay) rawOverlay.style.display = 'none';
});

// ---- Not found ----
function showNotFound() {
  loadingState.style.display = 'none';
  passwordGate.style.display = 'none';
  viewWrap.style.display = 'none';
  notFoundWrap.style.display = 'flex';
}

// ---- Init ----
loadPaste();
