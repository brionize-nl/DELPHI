// VPS history, with a local copy and a persistent retry queue for offline work.
let historyReady = false;
let historyRunning = false;
function historyQueueSetting(key) {
  try { const value=JSON.parse(getSetting(key,'[]'));return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]); } catch {return new Set();}
}
let historyPending = historyQueueSetting('history_pending');
let historyDeleted = historyQueueSetting('history_deleted');
let historyChangedDuringSync = false;

function persistHistoryQueue() {
  setSetting('history_pending', JSON.stringify([...historyPending]));
  setSetting('history_deleted', JSON.stringify([...historyDeleted]));
}

function historyStatus(text) { $('#history-status').textContent = text; }

function queueHistory() {
  if (historyRunning) historyChangedDuringSync = true;
  Object.values(conversations).forEach(c => { if (c.messages.length) historyPending.add(c.id); });
  persistHistoryQueue();
  if (historyReady) syncHistory();
}

function removeHistory(id) {
  if (historyRunning) historyChangedDuringSync = true;
  historyDeleted.add(id);
  historyPending.delete(id);
  persistHistoryQueue();
  if (historyReady) syncHistory();
}

async function syncHistory() {
  if (historyRunning || !apiKey()) return;
  historyRunning = true;
  historyChangedDuringSync = false;
  let succeeded = false;
  $('#btn-history-sync').disabled = true;
  historyStatus('Synchroniseren…');
  try {
    for (const id of [...historyDeleted]) {
      await apiFetch('/api/history/' + encodeURIComponent(id), {method: 'DELETE'});
      historyDeleted.delete(id);
      persistHistoryQueue();
    }
    const deleted = await (await apiFetch('/api/history/deleted')).json();
    if (!Array.isArray(deleted)) throw new Error('Ongeldige verwijdergeschiedenis');
    deleted.forEach(id=>{delete conversations[id];historyPending.delete(id);});
    const list = await (await apiFetch('/api/history/list')).json();
    if (!Array.isArray(list)) throw new Error('Ongeldige geschiedenis');
    for (const entry of list) {
      if (historyDeleted.has(entry.id)) continue;
      const local = conversations[entry.id];
      if (!local || entry.updated > local.updated) {
        const remote = await (await apiFetch('/api/history/' + encodeURIComponent(entry.id))).json();
        // A local edit may have happened while awaiting the response.
        if (!historyDeleted.has(remote.id) && (!conversations[remote.id] || remote.updated > conversations[remote.id].updated)) {
          conversations[remote.id] = remote;
          historyPending.delete(remote.id);
        }
      }
    }
    const remoteDates = new Map(list.map(c => [c.id, c.updated]));
    Object.values(conversations).forEach(c => {
      if (c.messages.length && (!remoteDates.has(c.id) || c.updated > remoteDates.get(c.id))) historyPending.add(c.id);
    });
    for (const id of [...historyPending]) {
      if (historyDeleted.has(id) || !conversations[id]) { historyPending.delete(id); continue; }
      const snapshot = JSON.stringify(conversations[id]);
      await apiFetch('/api/history', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: snapshot});
      if (JSON.stringify(conversations[id]) === snapshot) historyPending.delete(id);
      persistHistoryQueue();
    }
    historyReady = true;
    succeeded = true;
    try { localStorage.setItem('olla_convs', JSON.stringify(conversations)); } catch {}
    if (!generating) {
      if (activeConvId && conversations[activeConvId]) switchConv(activeConvId);
      else {
        const latest=Object.values(conversations).sort((a,b)=>b.updated-a.updated)[0];
        if(latest)switchConv(latest.id);else newConv();
      }
    }
    renderConvList($('#conv-search').value);
    historyStatus(historyPending.size ? 'Nieuwe wijzigingen wachten op sync' : 'Opgeslagen op VPS');
  } catch (e) {
    historyStatus('Lokaal bewaard — ' + e.message);
  } finally {
    historyRunning = false;
    $('#btn-history-sync').disabled = false;
    persistHistoryQueue();
    if (succeeded && historyChangedDuringSync) queueMicrotask(syncHistory);
  }
}

$('#btn-history-sync').addEventListener('click', syncHistory);

// Search all cached/synced content; text nodes keep literal search terms safe.
function highlightHistory(element, value, needle) {
  const text=String(value); const lower=text.toLowerCase(); let start=0,index;
  if(!needle) { element.textContent=text; return; }
  while((index=lower.indexOf(needle,start))!==-1) {
    element.appendChild(document.createTextNode(text.slice(start,index)));
    const mark=document.createElement('mark');mark.textContent=text.slice(index,index+needle.length);element.appendChild(mark);
    start=index+needle.length;
  }
  element.appendChild(document.createTextNode(text.slice(start)));
}
function renderConvList(filter = $('#conv-search').value) {
  convList.replaceChildren(); const needle=filter.trim().toLowerCase();
  const sorted=Object.values(conversations).sort((a,b)=>b.updated-a.updated);
  const filtered=sorted.filter(c=>!needle || (c.title+' '+c.messages.map(m=>m.content).join(' ')).toLowerCase().includes(needle));
  let lastGroup='';
  for(const conv of filtered) {
    const group=dateGroup(conv.updated);
    if(group!==lastGroup) {const heading=document.createElement('div');heading.className='conv-date';heading.textContent=group;convList.appendChild(heading);lastGroup=group;}
    const item=document.createElement('div');item.className='conv-item'+(conv.id===activeConvId?' active':'');item.dataset.id=conv.id;
    const title=document.createElement('button');title.type='button';title.className='conv-title';title.title=conv.title;
    const label=document.createElement('span');highlightHistory(label,conv.title,needle);title.appendChild(label);
    const meta=document.createElement('small');meta.textContent=(PROVIDERS[conv.provider || 'ollama']?.name || 'Ollama')+' · '+(conv.model || 'onbekend');title.appendChild(meta);
    if(needle) {
      const body=conv.messages.map(m=>m.content).join(' ');const index=body.toLowerCase().indexOf(needle);
      if(index!==-1) {const snippet=document.createElement('small');snippet.className='search-snippet';const begin=Math.max(0,index-25);highlightHistory(snippet,(begin?'…':'')+body.slice(begin,index+needle.length+65),needle);title.appendChild(snippet);}
    }
    title.addEventListener('click',()=>{changeTab('chat');switchConv(conv.id);closeSidebar();});
    const actions=document.createElement('div');actions.className='conv-actions';
    for(const [kind,text,name,action] of [['export','↓','Download Markdown',()=>exportConversation(conv.id)],['ren','✎','Hernoemen',()=>openRename(conv.id)],['del','×','Verwijderen',()=>deleteConv(conv.id)]]) {
      const button=document.createElement('button');button.type='button';button.className='conv-action '+kind;button.title=name;button.setAttribute('aria-label',name+' — '+conv.title);button.textContent=text;button.addEventListener('click',action);actions.appendChild(button);
    }
    item.append(title,actions);convList.appendChild(item);
  }
  if(!filtered.length) {const empty=document.createElement('p');empty.className='history-empty';empty.textContent=needle?'Geen resultaten':'Nog geen gesprekken';convList.appendChild(empty);}
}
let historySearchTimer;
$('#conv-search').addEventListener('input',()=>{clearTimeout(historySearchTimer);historySearchTimer=setTimeout(()=>renderConvList(),300);});

function conversationMarkdown(conv) {
  let markdown='# Gesprek: '+conv.title+'\n\n';
  for(const message of conv.messages) {
    const role=message.role==='user'?'Gebruiker':message.role==='system'?'Systeemcontext':(PROVIDERS[message.provider || conv.provider || 'ollama']?.name || 'Ollama');
    markdown+='## '+role+'\n'+message.content+'\n\n---\n\n';
  }
  return markdown;
}
function exportConversation(id) {
  const conv=conversations[id];if(!conv)return;
  const url=URL.createObjectURL(new Blob([conversationMarkdown(conv)],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;
  const filename=conv.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').replace(/^[. ]+|[. ]+$/g,'').slice(0,80) || 'gesprek';
  link.download=filename+'.md';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('#btn-export').addEventListener('click',()=>exportConversation(activeConvId));
