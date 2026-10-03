let dashboardBusy = false;

async function checkHealth() {
  const checks = [
    { name: 'Ollama', fn: () => apiFetch('/api/ollama/api/tags').then(r => r.json()).then(d => (d.models?.length || 0) + ' modellen') },
    { name: 'GitHub API', fn: () => ghFetch('rate_limit').then(d => d ? 'Bereikbaar' : 'Niet beschikbaar') },
    { name: 'LocalStorage', fn: () => { const k = '__health'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return 'Beschikbaar'; } },
    { name: 'Service Worker', fn: async () => { const reg = await navigator.serviceWorker?.getRegistration(); return reg?.active ? 'Actief' : 'Niet geregistreerd'; } }
  ];
  const root = $('#dashboard-health'); root.replaceChildren();
  for (const check of checks) {
    const li = document.createElement('li');
    let ok = false, detail = '';
    try { detail = await check.fn(); ok = true; } catch (e) { detail = e.message || 'Fout'; logError('health:' + check.name, e); }
    li.textContent = (ok ? '✅ ' : '❌ ') + check.name + ' — ' + detail;
    root.appendChild(li);
  }
}

function renderErrorLog() {
  const root = $('#dashboard-errors'); root.replaceChildren();
  const log = getErrorLog();
  if (!log.length) { root.textContent = 'Geen fouten gelogd.'; return; }
  for (const entry of log.slice(-15).reverse()) {
    const li = document.createElement('li');
    const time = new Date(entry.t).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    li.textContent = time + ' [' + entry.s + '] ' + entry.m;
    root.appendChild(li);
  }
  if (log.length > 15) {
    const more = document.createElement('li');
    more.textContent = '… en ' + (log.length - 15) + ' oudere fouten';
    root.appendChild(more);
  }
}

async function loadDashboard() {
  if (dashboardBusy || !$('#view-dashboard')) return;
  dashboardBusy=true;$('#btn-dashboard-refresh').disabled=true;
  $('#dashboard-status').textContent='Dashboard ophalen…';
  $('#dashboard-count').textContent=Object.values(conversations).filter(c=>Array.isArray(c.messages) && c.messages.some(m=>m.role!=='system')).length;
  const ids=['dashboard-inspections','dashboard-commits','dashboard-models'];
  for(const id of ids)$('#'+id).textContent='Laden…';
  try {
    const results=await Promise.allSettled([
      apiFetch('/api/inspections').then(r=>r.json()),
      ghFetch('repos/brionize-nl/DELPHI/commits?per_page=5'),
      apiFetch('/api/ollama/api/tags').then(r=>r.json())
    ]);
    const labels={pending:'Fixes wachten op review',clean:'Geen nieuwe bevindingen',findings:'Bevindingen ter beoordeling',error:'Scan mislukt','not-scanned':'Nog niet gescand',merged:'Gemerged',ignored:'Genegeerd',scanning:'Scan bezig','dry-run':'Testscan'};
    let unavailable=0;
    results.forEach((result,index)=>{
      const root=$('#'+ids[index]);root.replaceChildren();
      const value=result.status==='fulfilled'?result.value:null;
      const data=index===2?value?.models:value;
      if(!Array.isArray(data)) {root.textContent='Niet beschikbaar. Ververs om opnieuw te proberen.';unavailable++;return;}
      for(const entry of (index===1?data.slice(0,5):data)) {
        if(!entry || typeof entry!=='object')continue;
        const row=document.createElement('li');
        if(index===0) {
          const label=entry.status==='clean' && !entry.scanned?'Geen nieuwe bestanden onderzocht':(labels[entry.status] || 'Onbekende status');
          row.textContent=String(entry.project || 'Onbekend')+' — '+label+' · '+(Array.isArray(entry.fixes)?entry.fixes.length:0)+' fixes';
        } else if(index===1) {
          const text=String(entry.sha || '').slice(0,7)+' — '+String(entry.commit?.message || '').split('\n')[0];
          const href=safeUrl(entry.html_url || '');
          if(href) {const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noopener';link.textContent=text;row.appendChild(link);}
          else row.textContent=text;
        } else row.textContent=String(entry.name || 'Onbekend model');
        root.appendChild(row);
      }
      if(!root.children.length)root.textContent='Geen gegevens beschikbaar.';
    });
    $('#dashboard-status').textContent=unavailable?'Dashboard geladen; '+unavailable+' onderdeel niet beschikbaar.':'Dashboard bijgewerkt.';
  } catch { $('#dashboard-status').textContent='Dashboard kon niet worden bijgewerkt. Probeer opnieuw.'; }
  finally {dashboardBusy=false;$('#btn-dashboard-refresh').disabled=false;}
  checkHealth();
  renderErrorLog();
}
$('#btn-dashboard-refresh')?.addEventListener('click',loadDashboard);
$('#btn-clear-errors')?.addEventListener('click',()=>{clearErrorLog();renderErrorLog();});
