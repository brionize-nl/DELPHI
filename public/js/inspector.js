let inspectionReports = [];
let inspectionViewed = null;
let inspectionBusy = false;

async function refreshInspections() {
  if (inspectionBusy) return;
  $('#inspection-status').textContent='Inspecties ophalen…';
  try {
    inspectionReports=await (await apiFetch('/api/inspections')).json();
    const root=$('#inspection-projects');root.replaceChildren();
    let newest=0;
    for(const report of inspectionReports) {
      const row=document.createElement('section');row.className='chain-step';
      const title=document.createElement('h3');title.textContent=report.project;
      const status=document.createElement('p');
      const labels={pending:'Fixes wachten op review',clean:'Geen nieuwe problemen gevonden',findings:'Bevindingen beschikbaar',error:'Scan mislukt','not-scanned':'Nog niet gescand',merged:'Gemerged',ignored:'Genegeerd','dry-run':'Testscan, geen branch gepubliceerd',scanning:'Scan bezig'};
      status.textContent=(labels[report.status] || report.status)+' · '+report.fixes.length+' fixes';
      const time=document.createElement('small');
      time.textContent=report.finished?'Laatste scan: '+new Date(report.finished).toLocaleString('nl-NL')+' · volgende cronrun: rond '+new Date(report.next_scan).toLocaleString('nl-NL')+' · '+report.scanned+' bestanden gecontroleerd, '+report.skipped+' overgeslagen':'';
      const view=document.createElement('button');view.textContent='Bekijk';view.addEventListener('click',()=>viewInspection(report));
      row.append(title,status,time,view);root.appendChild(row);
      newest=Math.max(newest,report.finished || 0);
    }
    const signature=inspectionReports.filter(r=>r.status==='pending' && r.fixes.length).map(r=>r.project+':'+r.head).sort().join('|');
    if(signature && signature!==getSetting('inspection_notified','')) {
      notifyCompletion('Watchdog fixes klaar','Bekijk de Inspectie-tab voor nieuwe fixes.',0,true);
      setSetting('inspection_notified',signature);
    }
    inspectionViewed=null;$('#inspection-detail').textContent='Kies een project om de bevindingen te bekijken.';
    $('#inspection-status').textContent=newest?'Inspecties bijgewerkt.':'De watchdog heeft nog geen rapporten geschreven.';
  } catch(e) {$('#inspection-status').textContent=e.message;}
}

function viewInspection(report) {
  inspectionViewed=null;const root=$('#inspection-detail');root.replaceChildren();
  const heading=document.createElement('h3');heading.textContent=report.project+' — inspectierapport';root.appendChild(heading);
  for(const finding of report.findings || []) {
    const row=document.createElement('section');row.className='chain-step';
    const title=document.createElement('h4');title.textContent=finding.file+' — '+finding.status;row.appendChild(title);
    for(const issue of finding.issues || []) {const p=document.createElement('p');p.textContent='Regel '+issue.line+': '+issue.message;row.appendChild(p);}
    if(finding.reason) {const p=document.createElement('p');p.textContent=finding.reason;row.appendChild(p);}
    root.appendChild(row);
  }
  if(report.message){const message=document.createElement('p');message.textContent=report.message;root.appendChild(message);}
  if(report.status!=='pending' || !report.head)return;
  const info=document.createElement('p');info.textContent='Acties gelden voor de volledige '+report.branch+'-branch. Bekijk alle verschillen vóór het mergen.';
  const diff=document.createElement('pre');const compare=document.createElement('button');compare.textContent='Bekijk diff';
  const merge=document.createElement('button');merge.textContent='Merge alle fixes';merge.disabled=true;
  const ignore=document.createElement('button');ignore.textContent='Negeer branch';
  compare.addEventListener('click',()=>inspectionAction(async()=>{
    const result=await githubRequest('repos/'+report.repo+'/compare/main...'+encodeURIComponent(report.branch));
    if(result.head_commit.sha!==report.head)throw new Error('Fixes-branch gewijzigd; ververs de inspecties.');
    diff.textContent=result.files.map(f=>f.filename+'\n'+(f.patch || '(Geen tekst-diff)')).join('\n\n') || 'Geen verschillen';
    inspectionViewed={project:report.project,head:report.head};merge.disabled=false;
  }));
  merge.addEventListener('click',()=>inspectionAction(async()=>{
    if(inspectionViewed?.head!==report.head || inspectionViewed.project!==report.project)throw new Error('Bekijk eerst de diff.');
    const ref=await githubRequest('repos/'+report.repo+'/git/ref/heads/'+encodeRepoPath(report.branch));
    if(ref.object.sha!==report.head)throw new Error('Branch gewijzigd; opnieuw bekijken.');
    if(!confirm('Alle gevalideerde fixes van '+report.project+' mergen naar main?'))return;
    await githubRequest('repos/'+report.repo+'/merges','POST',{base:'main',head:report.head,commit_message:'Merge validated DELPHI watchdog fixes'});
    await apiFetch('/api/inspections/'+encodeURIComponent(report.project),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'merged',head:report.head})});
    try {await githubRequest('repos/'+report.repo+'/git/refs/heads/'+encodeRepoPath(report.branch),'DELETE');}
    catch {throw new Error('Fixes gemerged; opruimen van de fixes-branch mislukt. Verwijder die in Werkplaats voordat de volgende scan start.');}
    $('#inspection-status').textContent='Fixes gemerged; ververs om de nieuwe status te zien.';merge.disabled=true;ignore.disabled=true;
  }));
  ignore.addEventListener('click',()=>inspectionAction(async()=>{
    const ref=await githubRequest('repos/'+report.repo+'/git/ref/heads/'+encodeRepoPath(report.branch));
    if(ref.object.sha!==report.head)throw new Error('Branch gewijzigd; ververs eerst.');
    if(!confirm('De fixes-branch voor '+report.project+' verwijderen en deze fixes negeren?'))return;
    await githubRequest('repos/'+report.repo+'/git/refs/heads/'+encodeRepoPath(report.branch),'DELETE');
    await apiFetch('/api/inspections/'+encodeURIComponent(report.project),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'ignored',head:report.head})});
    $('#inspection-status').textContent='Fixes genegeerd; ververs om de nieuwe status te zien.';merge.disabled=true;ignore.disabled=true;
  }));
  root.append(info,compare,merge,ignore,diff);
}
async function inspectionAction(action) {
  if(inspectionBusy)return;inspectionBusy=true;$('#btn-inspection-refresh').disabled=true;
  try{await action();}catch(e){$('#inspection-status').textContent=e.message;}
  finally{inspectionBusy=false;$('#btn-inspection-refresh').disabled=false;}
}
$('#btn-inspection-refresh').addEventListener('click',refreshInspections);
