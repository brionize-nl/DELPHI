// ── Launchpad (eigen links) ──
function loadCustomLinks() {
  try {
    const raw = localStorage.getItem('delphi_links');
    const links = raw ? JSON.parse(raw) : [];
    return Array.isArray(links) ? links.filter(l => l && typeof l.name==='string' && typeof l.url==='string' && safeUrl(l.url)).map(l=>({...l,url:safeUrl(l.url)})) : [];
  } catch { return []; }
}

function saveCustomLinks(links) {
  try { localStorage.setItem('delphi_links', JSON.stringify(links)); } catch {}
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
      <button onclick="event.preventDefault();event.stopPropagation();removeLink(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px" title="Verwijder">&times;</button>
    </a>
  `).join('');
}

window.removeLink = function(i) {
  const links = loadCustomLinks();
  if (!confirm(`"${links[i]?.name}" verwijderen?`)) return;
  links.splice(i, 1);
  saveCustomLinks(links);
  renderCustomLinks();
};

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
