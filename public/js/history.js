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
