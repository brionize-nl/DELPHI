// ── Launchpad (eigen links, gesynchroniseerd via VPS) ──
function loadCustomLinks() {
  try {
    const raw = localStorage.getItem('delphi_links');
    const links = raw ? JSON.parse(raw) : [];
    return Array.isArray(links) ? links.filter(l => l && typeof l.name==='string' && typeof l.url==='string' && safeUrl(l.url)).map(l=>({...l,url:safeUrl(l.url)})) : [];
  } catch { return []; }
}

function saveCustomLinks(links) {
  try { localStorage.setItem('delphi_links', JSON.stringify(links)); } catch {}
  syncLinksToVPS(links);
}

function renderCustomLinks() {
  const grid = $('#lp-custom-grid');
  const links = loadCustomLinks();
  if (!links.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = links.map((l, i) => `
    <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="lp-card">
      <span class="lp-dot" style="background:var(--accent)"></span>
      <div class="lp-card-info"><div class="lp-card-name">${escapeHtml(l.name)}</div><div class="lp-card-desc">${escapeHtml(l.url.replace(/^https?:\/\//, '').split('/')[0])}</div></div>
      <button class="lp-remove-btn" data-index="${i}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px" title="Verwijder">&times;</button>
    </a>
  `).join('');
}

$('#lp-custom-grid').addEventListener('click', e => {
  const btn = e.target.closest('.lp-remove-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const i = Number(btn.dataset.index);
  const links = loadCustomLinks();
  if (!confirm(`"${links[i]?.name}" verwijderen?`)) return;
  links.splice(i, 1);
  saveCustomLinks(links);
  renderCustomLinks();
});

$('#btn-lp-add').addEventListener('click', () => {
  const name = $('#lp-add-name').value.trim();
  let url = $('#lp-add-url').value.trim();
  if (!name || !url) return;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  url = safeUrl(url);
  if (!url) { alert('Gebruik een http-, https- of mailto-link'); return; }
  const links = loadCustomLinks();
  links.push({ name, url });
  saveCustomLinks(links);
  $('#lp-add-name').value = '';
  $('#lp-add-url').value = '';
  renderCustomLinks();
});

async function syncLinksToVPS(links) {
  try {
    await apiFetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links }) });
  } catch (e) { logError('launchpad-sync', e); }
}

async function syncLinksFromVPS() {
  try {
    const settings = await (await apiFetch('/api/settings')).json();
    if (!Array.isArray(settings.links)) return;
    const local = loadCustomLinks();
    const remoteFiltered = settings.links.filter(l => l && typeof l.name === 'string' && typeof l.url === 'string' && safeUrl(l.url));
    if (JSON.stringify(local) !== JSON.stringify(remoteFiltered)) {
      const merged = [...local];
      for (const remote of remoteFiltered) {
        if (!merged.some(l => l.name === remote.name && l.url === remote.url)) merged.push(remote);
      }
      try { localStorage.setItem('delphi_links', JSON.stringify(merged)); } catch {}
      if (merged.length > local.length) syncLinksToVPS(merged);
      renderCustomLinks();
    }
  } catch (e) { logError('launchpad-sync', e); }
}

if (apiKey()) syncLinksFromVPS();
