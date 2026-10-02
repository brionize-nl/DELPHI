// ── Werkplaats (GitHub) ──
const GH_REPOS = ['brionize-nl/DELPHI', 'brionize-nl/Brionicle'];
let wpCache = {};

async function loadWerkplaats() {
  const content = $('#wp-content');
  const refreshBtn = $('#btn-wp-refresh');
  const repoFilter = $('#wp-repo-filter').value;
  refreshBtn.classList.add('spinning');

  const repos = repoFilter ? [repoFilter] : GH_REPOS;
  let hasData = false;
  let html = '';

  for (const repo of repos) {
    const [branches, pulls, commits] = await Promise.all([
      ghFetch(`repos/${repo}/branches?per_page=10`),
      ghFetch(`repos/${repo}/pulls?state=all&per_page=5&sort=updated`),
      ghFetch(`repos/${repo}/commits?per_page=8`)
    ]);

    if (!branches && !pulls && !commits) continue;
    hasData = true;
    const repoName = repo.split('/')[1];

    html += `<div class="repo-section">`;
    html += `<div class="repo-section-header"><h3>${escapeHtml(repoName)}</h3><span class="repo-badge">${branches ? branches.length + ' branches' : ''}</span></div>`;

    if (pulls && pulls.length) {
      html += pulls.map(pr => `
        <a href="${escapeHtml(pr.html_url)}" target="_blank" rel="noopener" class="gh-item">
          <svg class="gh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 012 2v7"/><path d="M6 9v12"/></svg>
          <div class="gh-item-body">
            <div class="gh-item-title">#${pr.number} ${escapeHtml(pr.title)}</div>
            <div class="gh-item-meta">
              <span>${escapeHtml(pr.user?.login || '')}</span>
              <span>${timeAgo(new Date(pr.updated_at).getTime())}</span>
              <span>${escapeHtml(pr.head?.ref || '')}</span>
            </div>
          </div>
          <span class="gh-pr-status ${pr.merged_at ? 'merged' : pr.state}">${pr.merged_at ? 'merged' : pr.state}</span>
        </a>
      `).join('');
    }

    if (commits && commits.length) {
      html += `<div style="margin-top:8px;margin-bottom:6px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;font-weight:600">Recente commits</div>`;
      html += commits.slice(0, 5).map(c => {
        const author = c.commit?.author?.name || c.author?.login || 'onbekend';
        const msg = (c.commit?.message || '').split('\n')[0];
        const sha = (c.sha || '').slice(0, 7);
        return `
          <a href="${escapeHtml(c.html_url || '#')}" target="_blank" rel="noopener" class="gh-item">
            <svg class="gh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6"/></svg>
            <div class="gh-item-body">
              <div class="gh-item-title">${escapeHtml(msg)}</div>
              <div class="gh-item-meta">
                <span>${escapeHtml(author)}</span>
                <span>${sha}</span>
                <span>${timeAgo(new Date(c.commit?.author?.date || 0).getTime())}</span>
              </div>
            </div>
          </a>`;
      }).join('');
    }

    html += `</div>`;
  }

  if (!hasData) {
    html = `<div class="gh-not-connected">
      <p><strong>GitHub niet verbonden</strong></p>
      <p>Stel een Personal Access Token in op de VPS:</p>
      <p><code>sudo install -m 600 /dev/stdin /etc/caddy/github-api-key</code></p>
      <p style="margin-top:4px;font-size:12px;color:var(--text-muted)">Daarna: <code>sudo bash setup.sh</code></p>
    </div>`;
  }

  content.innerHTML = html;
  refreshBtn.classList.remove('spinning');

  const filter = $('#wp-repo-filter');
  if (filter.options.length <= 1) {
    GH_REPOS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r.split('/')[1];
      filter.appendChild(opt);
    });
  }
}

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'zojuist';
  if (diff < 3600) return Math.floor(diff / 60) + ' min geleden';
  if (diff < 86400) return Math.floor(diff / 3600) + ' uur geleden';
  const days = Math.floor(diff / 86400);
  return days + ' dag' + (days > 1 ? 'en' : '') + ' geleden';
}

$('#btn-wp-refresh').addEventListener('click', loadWerkplaats);
$('#wp-repo-filter').addEventListener('change', loadWerkplaats);

