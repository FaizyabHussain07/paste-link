// ============================================
// script.js — PasteLink Home Page
// Features: password protect, burn-after-read,
//           preview tab, expiry pills, dark mode
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
const linkId = document.getElementById('linkId');
const copyBtn = document.getElementById('copyBtn');
const copyIcon = copyBtn.querySelector('.copy-icon');
const checkIcon = copyBtn.querySelector('.check-icon');
const openBtn = document.getElementById('openBtn');
const newBtn = document.getElementById('newBtn');
const resultFullLink = document.getElementById('resultFullLink');
const qrLink = document.getElementById('qrLink');
const themeToggle = document.getElementById('themeToggle');
const iconSun = themeToggle.querySelector('.icon-sun');
const iconMoon = themeToggle.querySelector('.icon-moon');
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

const MAX_CHARS = 50000;
let selectedExpiry = 3600; // default 1 hour
let generatedURL = '';

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

// ---- Tabs ----
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Expiry pills ----
document.querySelectorAll('#expiryPills .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#expiryPills .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedExpiry = parseInt(pill.dataset.val, 10);
  });
});

// ---- Stats ----
textInput.addEventListener('input', updateStats);

function updateStats() {
  const txt = textInput.value;
  const chars = txt.length;
  const words = txt.trim() === '' ? 0 : txt.trim().split(/\s+/).length;

  charStat.textContent = `${chars.toLocaleString()} chars`;
  wordStat.textContent = `${words.toLocaleString()} words`;

  // Hide previous result when user types
  if (resultWrap.style.display !== 'none') {
    resultWrap.style.display = 'none';
  }
  hideError();
}

// ---- Unique ID generator ----
function genId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

// ---- Hash password (SHA-256) ----
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Expiry label ----
function expiryLabel(secs) {
  if (secs < 3600) return `${secs / 60} minute${secs / 60 > 1 ? 's' : ''}`;
  if (secs < 86400) return `${secs / 3600} hour${secs / 3600 > 1 ? 's' : ''}`;
  return `${secs / 86400} day${secs / 86400 > 1 ? 's' : ''}`;
}

// ---- Save ----
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
  resultWrap.style.display = 'none';

  try {
    const customId = genId(8);
    const burnAfter = burnToggle.checked;
    const pw = passwordInput.value.trim();
    const pwHash = pw ? await hashPassword(pw) : null;

    await database.savePaste({
      customId,
      content,
      expirySeconds: selectedExpiry,
      burnAfterRead: burnAfter,
      hasPassword: !!pwHash,
      passwordHash: pwHash,
    });

    showToast('Link created successfully!', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>');


    // Build URL
    generatedURL = `${window.location.origin}/view.html?id=${customId}`;
    linkId.textContent = customId;
    resultFullLink.textContent = generatedURL;
    openBtn.href = generatedURL;

    // QR Code via free API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedURL)}`;
    qrImage.src = qrUrl;

    // Meta info
    let metaParts = [`Auto-deletes in ${expiryLabel(selectedExpiry)}`];
    if (burnAfter) metaParts.push('· Burns after first read');
    if (pw) metaParts.push('· Password protected');
    resultMeta.textContent = metaParts.join(' ');

    resultWrap.style.display = 'block';
    resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error(err);
    showError('Could not save link. Please try again or check your connection.');
  } finally {
    setSaving(false);
  }
});

// ---- Copy link ----
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(generatedURL);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = generatedURL;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showToast('Link copied!', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>');

  copyBtn.classList.add('copied');
  copyIcon.style.display = 'none';
  checkIcon.style.display = 'block';
  setTimeout(() => {
    copyBtn.classList.remove('copied');
    copyIcon.style.display = 'block';
    checkIcon.style.display = 'none';
  }, 2200);
});

// ---- QR Modal ----
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

// ---- Download ----
downloadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  downloadMenu.classList.toggle('show');
});

document.addEventListener('click', () => {
  downloadMenu.classList.remove('show');
});

downloadTxt.addEventListener('click', () => {
  triggerDownload(textInput.value, 'txt');
});

downloadDoc.addEventListener('click', () => {
  triggerDownload(textInput.value, 'doc');
});

// ---- New paste ----
newBtn.addEventListener('click', () => {
  textInput.value = '';
  passwordInput.value = '';
  burnToggle.checked = false;
  updateStats();
  resultWrap.style.display = 'none';
  qrImage.src = '';
  hideError();
  // Reset expiry pills
  document.querySelectorAll('#expiryPills .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#expiryPills .pill[data-val="3600"]').classList.add('active');
  selectedExpiry = 3600;
  textInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---- Helpers ----
function setSaving(v) {
  saveBtn.disabled = v;
  saveBtnText.textContent = v ? 'Saving…' : 'Create Share Link';
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorAlert.style.display = 'flex';
}

function hideError() {
  errorAlert.style.display = 'none';
}
