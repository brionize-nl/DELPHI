const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function getSetting(key, fallback) {
  try { return localStorage.getItem('olla_' + key) || fallback; } catch { return fallback; }
}
function setSetting(key, val) {
  try { localStorage.setItem('olla_' + key, val); } catch {}
}
function apiKey() { return getSetting('apikey', ''); }

async function apiFetch(path, opts = {}) {
  const key = apiKey();
  if (!key) { openSettings(); throw new Error('Geen Caddy toegangssleutel ingesteld'); }
  const res = await fetch(path, {...opts, headers: {...opts.headers, 'X-API-Key': key}});
  if (!res.ok) {
    let detail = '';
    try { const data = await res.json(); detail = data.error?.message || (typeof data.error === 'string' ? data.error : ''); } catch {}
    if (res.status === 401 && !detail) { openSettings(); throw new Error('Ongeldige Caddy toegangssleutel'); }
    if (res.status === 503) throw new Error(detail || 'Provider niet ingesteld op de server');
    throw new Error(detail || `API fout: ${res.status}`);
  }
  return res;
}
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
const TABS = ['chat', 'werkplaats', 'launchpad'];

tabBar.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === activeTab) return;
  activeTab = tab;
  tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  TABS.forEach(v => {
    const el = $('#view-' + v);
    if (el) el.classList.toggle('hidden', v !== tab);
  });
  chatControls.style.display = tab === 'chat' ? '' : 'none';
  if (tab === 'werkplaats') loadWerkplaats();
  if (tab === 'launchpad') renderCustomLinks();
});

document.addEventListener('DOMContentLoaded', () => {
// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'n') { e.preventDefault(); newConv(); }
  }
  if (e.key === 'Escape') {
    $$('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    closeSidebar();
  }
});

// ── Init ──
loadConversations();
initPresets();
updateSendButton();

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

promptEl.focus();

});
