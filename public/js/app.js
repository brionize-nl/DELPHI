const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function getSetting(key, fallback) {
  try { return localStorage.getItem('olla_' + key) || fallback; } catch { return fallback; }
}
function setSetting(key, val) {
  try { localStorage.setItem('olla_' + key, val); } catch {}
}
function apiKey() { return getSetting('apikey', ''); }

const ERROR_LOG_KEY = 'olla_errorlog';
const ERROR_LOG_MAX = 50;
function logError(source, error) {
  const msg = error instanceof Error ? error.message : String(error);
  try { console.error('[' + source + ']', msg); } catch {}
  try {
    const log = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
    log.push({ t: Date.now(), s: source, m: msg });
    if (log.length > ERROR_LOG_MAX) log.splice(0, log.length - ERROR_LOG_MAX);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log));
  } catch {}
}
function getErrorLog() {
  try { return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]'); } catch { return []; }
}
function clearErrorLog() {
  try { localStorage.removeItem(ERROR_LOG_KEY); } catch {}
}
window.addEventListener('error', e => logError('window', e.message || 'Onbekende fout'));
window.addEventListener('unhandledrejection', e => logError('promise', e.reason instanceof Error ? e.reason.message : String(e.reason || 'Onbekende afwijzing')));

async function apiFetch(path, opts = {}) {
  const key = apiKey();
  if (!key) { openSettings(); throw new Error('Geen Caddy toegangssleutel ingesteld'); }
  const res = await fetch(path, {...opts, headers: {...opts.headers, 'X-API-Key': key}});
  if (!res.ok) {
    let detail = '';
    try { const data = await res.json(); detail = data.error?.message || (typeof data.error === 'string' ? data.error : ''); } catch {}
    if (res.status === 401 && !detail) { openSettings(); throw new Error('Ongeldige Caddy toegangssleutel'); }
    if (res.status === 503) { const err = detail || 'Provider niet ingesteld op de server'; logError('api', err); throw new Error(err); }
    const err = detail || `API fout: ${res.status}`; logError('api', err); throw new Error(err);
  }
  return res;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function ghFetch(path) {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch('/api/github/' + path, { headers: { 'X-API-Key': key } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ── Tabs ──
let activeTab = 'chat';
const tabBar = $('#tab-bar');
const chatControls = $('.header-controls');
const TABS = ['chat', 'werkplaats', 'launchpad', 'chains', 'inspector', 'dashboard'];

function changeTab(tab) {
  if (!TABS.includes(tab)) return;
  if (tab === activeTab) return;
  activeTab = tab;
  tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  TABS.forEach(v => {
    const el = $('#view-' + v);
    if (el) el.classList.toggle('hidden', v !== tab);
  });
  chatControls.style.display = tab === 'chat' ? '' : 'none';
  if (tab === 'werkplaats') loadWerkplaats();
  if (tab === 'inspector') refreshInspections();
  if (tab === 'launchpad') renderCustomLinks();
  if (tab === 'dashboard' && typeof loadDashboard==='function') loadDashboard();
}
tabBar.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (btn) changeTab(btn.dataset.tab);
});

document.addEventListener('DOMContentLoaded', async () => {
// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  if (e.isComposing) return;
  if (e.key === 'Escape') {
    $$('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.dispatchEvent(new Event('delphi:close-modals'));
    closeSidebar();
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey || $('.modal-overlay.open')) return;
  const key = e.key.toLowerCase();
  if (key === 'n') { e.preventDefault(); changeTab('chat'); newConv(); }
  else if (/^[1-9]$/.test(key) && TABS[Number(key)-1]) { e.preventDefault(); changeTab(TABS[Number(key)-1]); }
  else if (key === 'enter' && activeTab === 'chat') { e.preventDefault(); if (!generating) send(promptEl.value); }
});

// ── Init ──
loadConversations();
initPresets();
updateSendButton();
await initProjects();

if (Object.keys(conversations).length) {
  const saved = getSetting('active', '');
  const id = (saved && conversations[saved]) ? saved : Object.values(conversations).sort((a, b) => b.updated - a.updated)[0]?.id;
  if (id) switchConv(id);
  else newConv();
} else {
  newConv();
}

renderConvList();

if (apiKey()) {
  loadModels();
  syncHistory();
} else {
  openSettings();
}

// ── Collapsible sidebar sections ──
['tools', 'projects', 'infra'].forEach(section => {
  const toggle = $('#toggle-' + section);
  const links = $('#' + section + '-links');
  const saved = getSetting('section_' + section, 'open');
  if (saved === 'closed') { toggle.classList.add('collapsed'); links.classList.add('hidden'); }
  toggle.addEventListener('click', () => {
    const closed = toggle.classList.toggle('collapsed');
    links.classList.toggle('hidden', closed);
    setSetting('section_' + section, closed ? 'closed' : 'open');
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

let lastAutoSync = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !apiKey()) return;
  if (Date.now() - lastAutoSync < 30000) return;
  lastAutoSync = Date.now();
  syncHistory();
  if (typeof syncLinksFromVPS === 'function') syncLinksFromVPS();
});

promptEl.focus();

});

function encodeRepoPath(path) { return path.split('/').map(encodeURIComponent).join('/'); }
function decodeBase64(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, '')), c => c.charCodeAt(0))); }
function encodeBase64(content) {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeUrl(value) {
  try { const url = new URL(String(value), location.origin); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
