// ── Presets ──
const PRESETS = [
  { id: 'coder', name: 'Developer', system: 'Je bent een senior software developer. Je schrijft clean, goed gecommentarieerde code. Je antwoordt in het Nederlands maar code en technische termen blijven in het Engels. Je geeft altijd werkende, complete oplossingen — geen pseudocode of TODO\'s. Als je iets niet zeker weet, zeg je dat eerlijk.', temp: 0.3 },
  { id: 'sysadmin', name: 'Sysadmin', system: 'Je bent een ervaren Linux systeembeheerder. Je helpt met server configuratie, netwerken, Docker, Nginx, security, monitoring en automatisering. Je geeft precieze commando\'s met uitleg. Je waarschuwt altijd voor risico\'s en maakt backups voordat je iets verandert.', temp: 0.3 },
  { id: 'schrijver', name: 'Schrijver', system: 'Je bent een getalenteerde Nederlandse schrijver. Je schrijft meeslepende, originele teksten met een eigen stem. Je beheerst verschillende stijlen: zakelijk, literair, journalistiek en informeel. Schrijf altijd in correct, vloeiend Nederlands. Wees creatief en origineel — vermijd clichés. Pas je toon aan op het verzoek. Gebruik beeldend taalgebruik zonder overdreven te zijn.', temp: 1.2 },
  { id: 'assistent', name: 'Assistent', system: 'Je bent een behulpzame, vriendelijke Nederlandse assistent. Je antwoordt beknopt en duidelijk. Je geeft praktische antwoorden zonder onnodig jargon.', temp: 0.7 },
  { id: 'creatief', name: 'Creatief', system: 'Je bent een creatieve schrijver die in het Nederlands werkt. Je schrijft meeslepende teksten met een eigen stem. Je bent origineel, beeldend en durft risico\'s te nemen in je schrijfstijl.', temp: 1.2 },
  { id: 'uitleg', name: 'Uitlegger', system: 'Je bent een geduldig en helder docent. Je legt complexe onderwerpen uit in eenvoudige taal, met voorbeelden en analogieen. Je past je niveau aan op basis van de vraag. Je gebruikt stap-voor-stap uitleg wanneer nodig.', temp: 0.5 },
];

// ── State ──
const chat = $('#chat');
const welcome = $('#welcome');
const promptEl = $('#prompt');
const sendBtn = $('#btn-send');
const providerSelect = $('#provider-select');
const modelSelect = $('#model-select');
const presetSelect = $('#preset-select');
const statusDot = $('#status');
const convNameEl = $('#conv-name');
const convList = $('#conv-list');
const sidebar = $('#sidebar');

let conversations = {};
let activeConvId = null;
let generating = false;
let abortCtrl = null;

// ── Storage ──
function loadConversations() {
  try {
    const raw = localStorage.getItem('olla_convs');
    if (raw) conversations = JSON.parse(raw);
  } catch {}
  // Migrate from old single-chat format
  if (!Object.keys(conversations).length) {
    try {
      const old = localStorage.getItem('ollama_history');
      if (old) {
        const msgs = JSON.parse(old);
        if (msgs.length) {
          const id = genId();
          conversations[id] = {
            id, title: titleFromMessages(msgs), messages: msgs,
            created: Date.now(), updated: Date.now(), model: localStorage.getItem('ollama_model') || ''
          };
          activeConvId = id;
        }
        localStorage.removeItem('ollama_history');
      }
    } catch {}
    // Migrate settings keys
    ['apikey','model','system','temperature'].forEach(k => {
      const old = localStorage.getItem('ollama_' + k);
      if (old) { setSetting(k, old); localStorage.removeItem('ollama_' + k); }
    });
  }
}

function saveConversations() {
  try { localStorage.setItem('olla_convs', JSON.stringify(conversations)); } catch {}
  queueHistory();
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function titleFromMessages(msgs) {
  const first = msgs.find(m => m.role === 'user');
  if (!first) return 'Nieuw gesprek';
  const text = first.content.slice(0, 60);
  return text.length < first.content.length ? text + '...' : text;
}

// ── Providers en API ──
const PROVIDERS = {
  ollama: {
    name: 'Ollama', chatPath: '/api/ollama/api/chat', modelsPath: '/api/ollama/api/tags',
    parseModels: data => (data.models || []).map(m => m.name),
    buildBody: (model, messages, temperature) => ({model, messages, stream: true, options: {temperature}}),
    parseStream: 'ollama'
  },
  claude: {
    name: 'Claude', chatPath: '/api/claude/v1/messages',
    defaultModels: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'],
    buildBody: (model, messages, temperature) => ({
      model, messages: messages.filter(m => m.role !== 'system'), stream: true,
      max_tokens: 4096, temperature: Math.min(1, temperature),
      ...(messages.find(m => m.role === 'system')?.content && {system: messages.find(m => m.role === 'system').content})
    }), parseStream: 'claude'
  },
  openai: {
    name: 'ChatGPT', chatPath: '/api/openai/v1/chat/completions', modelsPath: '/api/openai/v1/models',
    parseModels: data => (data.data || []).filter(m => m.id.startsWith('gpt-')).map(m => m.id).sort(),
    buildBody: (model, messages, temperature) => ({model, messages, stream: true, temperature}), parseStream: 'openai'
  },
  gemini: {
    name: 'Gemini', chatPath: '/api/gemini/v1beta/openai/chat/completions', modelsPath: '/api/gemini/v1beta/openai/models',
    parseModels: data => (data.data || []).filter(m => m.id.startsWith('gemini-')).map(m => m.id).sort(),
    buildBody: (model, messages, temperature) => ({model, messages, stream: true, temperature}), parseStream: 'openai'
  },
  mistral: {
    name: 'Mistral', chatPath: '/api/mistral/v1/chat/completions', modelsPath: '/api/mistral/v1/models',
    parseModels: data => (data.data || []).map(m => m.id).sort(),
    buildBody: (model, messages, temperature) => ({model, messages, stream: true, temperature}), parseStream: 'openai'
  }
};
function activeProvider() { return PROVIDERS[providerSelect.value]; }
let modelsRequest = 0;
async function loadModels() {
  const request = ++modelsRequest;
  const providerId = providerSelect.value;
  const provider = activeProvider();
  modelSelect.disabled = true;
  modelSelect.innerHTML = '<option value="">Laden...</option>';
  statusDot.classList.remove('ok');
  try {
    const models = provider.modelsPath ? provider.parseModels(await (await apiFetch(provider.modelsPath)).json()) : provider.defaultModels;
    if (request !== modelsRequest) return;
    modelSelect.innerHTML = '';
    if (!models.length) throw new Error('Geen modellen beschikbaar');
    const saved = getSetting('model_' + providerId, providerId === 'ollama' ? getSetting('model', '') : '');
    models.forEach(model => {
      const opt = document.createElement('option');
      opt.value = model; opt.textContent = model.replace(':latest', '');
      modelSelect.appendChild(opt);
    });
    modelSelect.value = models.includes(saved) ? saved : models[0];
    setSetting('model_' + providerId, modelSelect.value);
    modelSelect.disabled = false;
    statusDot.classList.add('ok');
    statusDot.title = provider.name + ': modellen geladen';
  } catch (error) {
    if (request !== modelsRequest) return;
    modelSelect.innerHTML = '<option value="">Niet beschikbaar</option>';
    statusDot.title = error.message;
    appendError(provider.name + ': ' + error.message);
  }
}
providerSelect.value = getSetting('provider', 'ollama');
if (!activeProvider()) providerSelect.value = 'ollama';
providerSelect.addEventListener('change', () => {
  setSetting('provider', providerSelect.value);
  loadModels();
});
modelSelect.addEventListener('change', () => setSetting('model_' + providerSelect.value, modelSelect.value));

// Verwerk volledige regels, inclusief gesplitste UTF-8 en de laatste regel zonder newline.
async function readChatStream(body, format, onChunk) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', dataLines = [], stopped = false;
  function dispatch(raw) {
    if (!raw || raw === '[DONE]') { if (raw) stopped = true; return; }
    const chunk = JSON.parse(raw);
    if (chunk.error || chunk.type === 'error') throw new Error(chunk.error?.message || chunk.error || 'Providerfout');
    const text = format === 'ollama' ? chunk.message?.content : format === 'claude' ? (chunk.delta?.type === 'text_delta' ? chunk.delta.text : '') : chunk.choices?.[0]?.delta?.content;
    onChunk(text || '', chunk);
    if (chunk.done || chunk.type === 'message_stop') stopped = true;
  }
  function line(value) {
    value = value.replace(/\r$/, '');
    if (format === 'ollama') { if (value.trim()) dispatch(value); }
    else if (!value) { dispatch(dataLines.join('\n')); dataLines = []; }
    else if (value.startsWith('data:')) dataLines.push(value.slice(5).replace(/^ /, ''));
  }
  try {
    while (!stopped) {
      const {done, value} = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, {stream: true});
      let newline;
      while (!stopped && (newline = buffer.indexOf('\n')) !== -1) {
        line(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
      }
      if (done) { if (!stopped && buffer) line(buffer); if (!stopped && dataLines.length) dispatch(dataLines.join('\n')); break; }
    }
  } finally { try { await reader.cancel(); } finally { reader.releaseLock(); } }
}

// ── Presets ──
function initPresets() {
  presetSelect.innerHTML = '<option value="">Geen preset</option>';
  PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    presetSelect.appendChild(opt);
  });
  const saved = getSetting('preset', '');
  if (saved) presetSelect.value = saved;
}

presetSelect.addEventListener('change', () => {
  setSetting('preset', presetSelect.value);
  const conv = conversations[activeConvId];
  if (conv) { conv.preset = presetSelect.value; conv.updated = Date.now(); saveConversations(); }
});

function presetSystemPrompt() {
  const presetId = presetSelect.value;
  if (presetId) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (preset) return preset.system;
  }
  return getSetting('system', '');
}

function getActiveSystemPrompt() { return [projectSystemPrompt(), presetSystemPrompt()].filter(Boolean).join('\n\n'); }

function getActiveTemperature() {
  const presetId = presetSelect.value;
  if (presetId) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (preset) return preset.temp;
  }
  return parseFloat(getSetting('temperature', '0.7'));
}

// ── Conversations sidebar ──

function dateGroup(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 86400000;
  if (diff < 1 && d.getDate() === now.getDate()) return 'Vandaag';
  if (diff < 2) return 'Gisteren';
  if (diff < 7) return 'Deze week';
  if (diff < 30) return 'Deze maand';
  return d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
}

function switchConv(id) {
  if(id!==activeConvId)document.dispatchEvent(new Event('delphi:chat-draft-reset'));
  if (generating && abortCtrl) abortCtrl.abort();
  activeConvId = id;
  setSetting('active', id);
  const conv = conversations[id];
  if (!conv) return;

  $('#project-select').value = conv.project || '';
  presetSelect.value = conv.preset || '';
  convNameEl.textContent = conv.title;
  chat.querySelectorAll('.msg').forEach(m => m.remove());
  const contextual = conv.messages.some(m => m.role === 'system');
  const contextNote = $('#chat-context');
  contextNote.hidden = !contextual;
  contextNote.textContent = contextual ? 'Gesprekscontext: ' + conv.title + ' — bevindingen kunnen onbewezen zijn.' : '';
  welcome.style.display = conv.messages.some(m => m.role !== 'system') || contextual ? 'none' : '';

  conv.messages.filter(m => m.role !== 'system').forEach(m => appendMsg(m.role, m.content, false, {provider: m.provider || conv.provider || 'ollama', model: m.model || conv.model || ''}));
  chat.scrollTop = chat.scrollHeight;
  renderConvList($('#conv-search').value);
}

function newConv() {
  document.dispatchEvent(new Event('delphi:chat-draft-reset'));
  if (generating && abortCtrl) abortCtrl.abort();
  const id = genId();
  conversations[id] = {
    id, title: 'Nieuw gesprek', messages: [],
    created: Date.now(), updated: Date.now(), project: $('#project-select').value, preset: presetSelect.value, provider: providerSelect.value, model: modelSelect.value
  };
  saveConversations();
  switchConv(id);
  closeSidebar();
  promptEl.focus();
}

function deleteConv(id) {
  const conv = conversations[id];
  if (!conv) return;
  if (!confirm(`"${conv.title}" verwijderen?`)) return;
  removeHistory(id);
  delete conversations[id];
  saveConversations();
  if (activeConvId === id) {
    const ids = Object.keys(conversations);
    if (ids.length) {
      switchConv(Object.values(conversations).sort((a, b) => b.updated - a.updated)[0].id);
    } else {
      newConv();
    }
  } else {
    renderConvList($('#conv-search').value);
  }
}

let renameId = null;
function openRename(id) {
  renameId = id;
  $('#rename-input').value = conversations[id]?.title || '';
  $('#rename-modal').classList.add('open');
  setTimeout(() => $('#rename-input').focus(), 50);
}

$('#btn-rename-save').addEventListener('click', () => {
  if (renameId && conversations[renameId]) {
    const val = $('#rename-input').value.trim();
    if (val) {
      conversations[renameId].title = val;
      conversations[renameId].updated = Date.now();
      saveConversations();
      if (renameId === activeConvId) convNameEl.textContent = val;
      renderConvList($('#conv-search').value);
    }
  }
  $('#rename-modal').classList.remove('open');
});

$('#btn-rename-cancel').addEventListener('click', () => {
  $('#rename-modal').classList.remove('open');
});

$('#rename-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) $('#rename-modal').classList.remove('open');
});

$('#rename-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); $('#btn-rename-save').click(); }
});

// ── Sidebar toggle ──
function openSidebar() { sidebar.classList.add('open'); }
function closeSidebar() { sidebar.classList.remove('open'); }
$('#btn-menu').addEventListener('click', openSidebar);
$('#sidebar-backdrop').addEventListener('click', closeSidebar);
$('#btn-new-conv').addEventListener('click', newConv);

// ── Markdown ──
function renderMd(text) {
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.trimEnd();
    const langLabel = lang || 'code';
    return `<pre><div class="code-header"><span class="code-lang">${langLabel}</span><button class="copy-btn" onclick="copyCode(this)">kopieer</button></div><code>${escaped}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, header, sep, body) => {
    const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^### (.+)$/gm, '<strong>$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong>$1</strong>');
  html = html.replace(/^# (.+)$/gm, '<strong>$1</strong>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
    try {
      const url = new URL(target.replace(/&amp;/g, '&'), location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return label;
      return '<a href="' + escapeHtml(url.href) + '" target="_blank" rel="noopener">' + label + '</a>';
    } catch { return label; }
  });
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}

window.copyCode = function(btn) {
  const code = btn.closest('pre').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'gekopieerd!';
    setTimeout(() => btn.textContent = 'kopieer', 1500);
  });
};

// ── Messages ──
function appendMsg(role, content, scroll = true, meta = {}) {
  const div = document.createElement('div');
  div.className = `msg msg-${role === 'user' ? 'user' : 'ai'}`;

  if (role === 'user') {
    div.textContent = content;
  } else {
    const model = `${PROVIDERS[meta.provider || providerSelect.value]?.name || 'Ollama'} · ${(meta.model || modelSelect.value).replace(':latest', '')}`;
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="msg-head"><span class="model-tag">${escapeHtml(model)}</span><span class="msg-time">${time}</span></div>` + renderMd(content);
  }

  chat.appendChild(div);
  if (scroll) chat.scrollTop = chat.scrollHeight;
  return div;
}

function appendError(text) {
  const div = document.createElement('div');
  div.className = 'msg msg-error';
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ── Send ──
async function send(text) {
  if (!text.trim() || generating) return;
  if (modelSelect.disabled || !modelSelect.value) { appendError('Kies eerst een beschikbaar model'); return; }
  document.dispatchEvent(new Event('delphi:chat-draft-reset'));
  const providerId = providerSelect.value;
  const provider = activeProvider();
  const selectedModel = modelSelect.value;
  const started = Date.now();
  text = text.trim();

  if (!activeConvId) newConv();
  const conv = conversations[activeConvId];
  if (!conv) return;

  welcome.style.display = 'none';
  conv.messages.push({ role: 'user', content: text });
  appendMsg('user', text);

  if (conv.title === 'Nieuw gesprek' && conv.messages.length === 1) {
    conv.title = titleFromMessages(conv.messages);
    convNameEl.textContent = conv.title;
    renderConvList($('#conv-search').value);
  }

  conv.updated = Date.now();
  conv.model = selectedModel;
  conv.provider = providerId;
  conv.project = $('#project-select').value;
  conv.preset = presetSelect.value;
  renderConvList($('#conv-search').value);
  saveConversations();

  promptEl.value = '';
  autoResize();
  generating = true;
  updateSendButton();

  const aiDiv = document.createElement('div');
  aiDiv.className = 'msg msg-ai';
  const model = `${provider.name} · ${selectedModel.replace(':latest', '')}`;
  const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  aiDiv.innerHTML = `<div class="msg-head"><span class="model-tag">${escapeHtml(model)}</span><span class="msg-time">${time}</span></div><div class="typing"><span></span><span></span><span></span></div>`;
  chat.appendChild(aiDiv);
  chat.scrollTop = chat.scrollHeight;

  let fullResponse = '';
  abortCtrl = new AbortController();

  try {
    const body = provider.buildBody(selectedModel, buildMessages(conv), getActiveTemperature());
    const res = await apiFetch(provider.chatPath, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body), signal: abortCtrl.signal
    });
    if (!res.body) throw new Error('Geen antwoordstream ontvangen');
    await readChatStream(res.body, provider.parseStream, (text, chunk) => {
      fullResponse += text;
      if (text) {
        aiDiv.innerHTML = `<div class="msg-head"><span class="model-tag">${escapeHtml(model)}</span><span class="msg-time">${time}</span></div>` + renderMd(fullResponse);
        if (conversations[activeConvId] === conv) chat.scrollTop = chat.scrollHeight;
      }
      if (chunk.done && chunk.eval_count && chunk.eval_duration) {
        $('#input-hint').textContent = `${chunk.eval_count} tokens · ${(chunk.eval_count / (chunk.eval_duration / 1e9)).toFixed(1)} t/s`;
        setTimeout(() => { $('#input-hint').textContent = ''; }, 5000);
      }
    });

    // Final render
    if (fullResponse) {
      aiDiv.innerHTML = `<div class="msg-head"><span class="model-tag">${escapeHtml(model)}</span><span class="msg-time">${time}</span></div>` + renderMd(fullResponse);
    }

    if (!fullResponse) {
      aiDiv.remove();
      appendError('Geen antwoord ontvangen');
    } else {
      conv.messages.push({ role: 'assistant', content: fullResponse, provider: providerId, model: selectedModel });
      conv.updated = Date.now();
      saveConversations();
      notifyCompletion('Antwoord klaar', conv.title, Date.now() - started);
    }
  } catch (e) {
    aiDiv.remove();
    if (e.name !== 'AbortError') {
      appendError(e.message);
    }
  }

  generating = false;
  abortCtrl = null;
  updateSendButton();
  promptEl.focus();
}

function startContextConversation(title, context, draft = '') {
  newConv();
  const conv = conversations[activeConvId];
  conv.title = String(title).slice(0, 200);
  conv.messages.push({role: 'system', content: String(context)});
  conv.updated = Date.now();
  saveConversations();
  switchConv(conv.id);
  changeTab('chat');
  promptEl.value = draft;
  autoResize();
  promptEl.focus();
}

function buildMessages(conv) {
  // Combine context into one system message: Claude consumes the first system message.
  const system = [getActiveSystemPrompt(), ...conv.messages.filter(m => m.role === 'system').map(m => m.content)].filter(Boolean).join('\n\n');
  const msgs = system ? [{role: 'system', content: system}] : [];
  msgs.push(...conv.messages.filter(m => m.role !== 'system').map(({role, content}) => ({role, content})));
  return msgs;
}

function updateSendButton() {
  if (generating) {
    sendBtn.className = 'stop-btn';
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    sendBtn.title = 'Stop generatie';
    sendBtn.disabled = false;
    sendBtn.onclick = () => { if (abortCtrl) abortCtrl.abort(); };
  } else {
    sendBtn.className = 'send-btn';
    sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    sendBtn.title = 'Verstuur (Enter)';
    sendBtn.disabled = false;
    sendBtn.onclick = () => send(promptEl.value);
  }
}

// ── Input handling ──
promptEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (generating) return;
    send(promptEl.value);
  }
});

function autoResize() {
  promptEl.style.height = 'auto';
  promptEl.style.height = Math.min(promptEl.scrollHeight, 200) + 'px';
}
promptEl.addEventListener('input', autoResize);

$$('.welcome-prompt').forEach(btn => {
  btn.addEventListener('click', () => {
    promptEl.value = btn.dataset.prompt;
    send(promptEl.value);
  });
});

// ── Settings ──
function openSettings() {
  $('#api-key').value = apiKey();
  $('#system-prompt').value = getSetting('system', '');
  const temp = getSetting('temperature', '0.7');
  $('#temperature').value = temp;
  $('#temp-display').textContent = temp;
  $('#settings-modal').classList.add('open');
}

$('#temperature').addEventListener('input', e => {
  $('#temp-display').textContent = e.target.value;
});

$('#btn-settings').addEventListener('click', () => { openSettings(); closeSidebar(); });
$('#btn-settings2').addEventListener('click', openSettings);

$('#btn-cancel').addEventListener('click', () => {
  $('#settings-modal').classList.remove('open');
});

$('#btn-save').addEventListener('click', () => {
  setSetting('apikey', $('#api-key').value.trim());
  setSetting('system', $('#system-prompt').value.trim());
  setSetting('temperature', $('#temperature').value);
  $('#settings-modal').classList.remove('open');
  loadModels();
  syncHistory();
});

$('#btn-clear-all').addEventListener('click', () => {
  if (!confirm('ALLE gesprekken en instellingen wissen?')) return;
  Object.keys(conversations).forEach(removeHistory);
  conversations = {};
  saveConversations();
  activeConvId = null;
  setSetting('active', '');
  $('#settings-modal').classList.remove('open');
  newConv();
});

$('#settings-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) $('#settings-modal').classList.remove('open');
});

// Files become a draft only: no uploads or automatic sends.
(() => {
  const area=$('#view-chat .input-area');if(!area)return;
  const limit=100*1024;let dragDepth=0,busy=false,draftEpoch=0;
  const hasFiles=event=>Array.from(event.dataTransfer?.types || []).includes('Files');
  function clearDrag(){dragDepth=0;area.classList.remove('file-dragging');}
  document.addEventListener('delphi:chat-draft-reset',()=>{draftEpoch++;if(busy)$('#input-hint').textContent='Bestand lezen geannuleerd voor dit concept.';});
  area.addEventListener('dragenter',event=>{if(!hasFiles(event))return;event.preventDefault();dragDepth++;area.classList.add('file-dragging');});
  area.addEventListener('dragover',event=>{if(!hasFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect='copy';});
  area.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)clearDrag();});
  area.addEventListener('dragend',clearDrag);
  function read(file) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Bestand kon niet worden gelezen'));reader.onabort=()=>reject(new Error('Bestand lezen geannuleerd'));reader.readAsText(file,'UTF-8');
    });
  }
  area.addEventListener('drop',async event=>{
    if(!hasFiles(event))return;event.preventDefault();clearDrag();
    const files=Array.from(event.dataTransfer.files);if(!files.length)return;
    if(busy){$('#input-hint').textContent='Wacht tot het bestand gelezen is.';return;}
    const sourceExtensions=['txt','md','js','mjs','cjs','ts','tsx','jsx','py','html','css','json','yaml','yml','sh','bash','sql','xml','svg','csv','toml','ini','conf','log','rs','go','java','c','h','cpp','php','rb'];
    if(files.some(f=>f.size>limit) || files.reduce((sum,f)=>sum+f.size,0)>limit) {$('#input-hint').textContent='Maximaal 100 KB per bestand en per sleepactie.';return;}
    if(files.some(f=>!f.type.startsWith('text/') && !sourceExtensions.includes(f.name.split('.').pop().toLowerCase()))) {$('#input-hint').textContent='Gebruik tekst- of broncodebestanden; binaire bestanden zijn niet ondersteund.';return;}
    busy=true;const epoch=draftEpoch;$('#input-hint').textContent='Bestand lezen…';
    try {
      const texts=await Promise.all(files.map(read));
      if(epoch!==draftEpoch)return;
      const blocks=texts.map((text,index)=>{
        if(text.includes('\0'))throw new Error('Dit bestand bevat binaire inhoud.');
        const extension=files[index].name.includes('.')?files[index].name.split('.').pop().toLowerCase().replace(/[^a-z0-9+-]/g,'').slice(0,12):'text';
        const longest=(text.match(/`+/g) || []).reduce((length,run)=>Math.max(length,run.length),2);
        const fence='`'.repeat(longest+1);
        return fence+extension+'\n'+text+'\n'+fence;
      });
      promptEl.value+=(promptEl.value?'\n\n':'')+blocks.join('\n\n');autoResize();promptEl.focus();
      $('#input-hint').textContent=files.length+' bestand(en) als concept toegevoegd. Controleer en verstuur zelf.';
    } catch(error) {if(epoch===draftEpoch)$('#input-hint').textContent=error.message;}
    finally {busy=false;}
  });
})();
