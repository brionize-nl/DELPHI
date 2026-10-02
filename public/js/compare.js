let compareController = null;
let compareModelsRequest = 0;
function comparisonInputs(disabled) {
  for(const id of ['compare-model-left','compare-model-right','compare-prompt'])$('#'+id).disabled=disabled;
  $('#btn-compare-run').disabled=disabled || $('#compare-model-left').options.length<2;
  $('#btn-compare-stop').disabled=!disabled;
}
async function openComparison() {
  const modal=$('#compare-modal');if(!modal)return;
  modal.classList.add('open');$('#compare-prompt').value=promptEl.value;
  if(compareController)return;
  const request=++compareModelsRequest;comparisonInputs(true);$('#btn-compare-stop').disabled=true;
  $('#compare-status').textContent='Lokale modellen ophalen…';
  try {
    const data=await (await apiFetch('/api/ollama/api/tags')).json();
    if(request!==compareModelsRequest)return;
    const models=[...new Set((Array.isArray(data.models)?data.models:[]).map(m=>m.name).filter(m=>typeof m==='string' && m))];
    const preferred=providerSelect.value==='ollama'?modelSelect.value:getSetting('model_ollama','');
    for(const side of ['left','right']) {
      const select=$('#compare-model-'+side);select.replaceChildren();
      models.forEach(model=>{const option=document.createElement('option');option.value=model;option.textContent=model;select.appendChild(option);});
    }
    $('#compare-model-left').value=models.includes(preferred)?preferred:(models[0] || '');
    $('#compare-model-right').value=models.find(model=>model!==$('#compare-model-left').value) || '';
    for(const side of ['left','right']) {$('#compare-output-'+side).replaceChildren();$('#compare-status-'+side).textContent='';}
    $('#compare-status').textContent=models.length>=2?'Kies twee modellen en stel je vraag.':'Er zijn minstens twee lokale modellen nodig.';
    comparisonInputs(false);$('#compare-prompt').focus();
  } catch(error) {if(request===compareModelsRequest){comparisonInputs(false);$('#btn-compare-run').disabled=true;$('#compare-status').textContent=error.message;}}
}
function closeComparison() {
  compareModelsRequest++;compareController?.abort();$('#compare-modal')?.classList.remove('open');
}

function saveComparisonConv(model, prompt, response) {
  const id = genId();
  const preview = prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt;
  conversations[id] = {
    id,
    title: 'Vergelijking: ' + model + ' — ' + preview,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: response, provider: 'ollama', model }
    ],
    created: Date.now(),
    updated: Date.now(),
    provider: 'ollama',
    model
  };
  saveConversations();
  return id;
}

async function runComparison() {
  if(compareController)return;
  const prompt=$('#compare-prompt').value.trim();
  const models=[$('#compare-model-left').value,$('#compare-model-right').value];
  if(!prompt || models.some(m=>!m) || models[0]===models[1]) {$('#compare-status').textContent='Voer een vraag in en kies twee verschillende modellen.';return;}
  const controller=new AbortController();compareController=controller;
  const messages=[...buildMessages(conversations[activeConvId] || {messages:[]}).map(m=>({...m})),{role:'user',content:prompt}];
  const temperature=getActiveTemperature();comparisonInputs(true);$('#compare-status').textContent='Twee antwoorden worden opgebouwd…';
  const outcomes=await Promise.allSettled(['left','right'].map(async(side,index)=>{
    const output=$('#compare-output-'+side);output.replaceChildren();$('#compare-title-'+side).textContent=models[index];$('#compare-status-'+side).textContent='Bezig…';
    let text='';
    try {
      const response=await apiFetch('/api/ollama/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(PROVIDERS.ollama.buildBody(models[index],messages,temperature))});
      if(!response.body)throw new Error('Geen antwoordstream ontvangen');
      await readChatStream(response.body,'ollama',chunk=>{text+=chunk;output.innerHTML=renderMd(text);}); // renderMd escapes source before Markdown rendering.
      if(!text)throw new Error('Geen antwoord ontvangen');
      $('#compare-status-'+side).textContent='Klaar';
      return text;
    } catch(error) {$('#compare-status-'+side).textContent=error.name==='AbortError'?'Gestopt':error.message;throw error;}
  }));
  if(compareController===controller) {
    compareController=null;comparisonInputs(false);
    const saved = [];
    outcomes.forEach((result, index) => {
      if (result.status === 'fulfilled') saved.push(saveComparisonConv(models[index], prompt, result.value));
    });
    if (saved.length) renderConvList();
    const statusMsg = controller.signal.aborted
      ? 'Vergelijking gestopt.'
      : outcomes.every(r => r.status === 'fulfilled')
        ? 'Vergelijking voltooid — ' + saved.length + ' gesprekken opgeslagen.'
        : 'Vergelijking afgerond; bekijk de status per model.';
    $('#compare-status').textContent = statusMsg;
  }
}
$('#btn-compare')?.addEventListener('click',openComparison);
$('#btn-compare-run')?.addEventListener('click',runComparison);
$('#btn-compare-stop')?.addEventListener('click',()=>compareController?.abort());
$('#btn-compare-close')?.addEventListener('click',closeComparison);
$('#compare-modal')?.addEventListener('click',event=>{if(event.target===event.currentTarget)closeComparison();});
document.addEventListener('delphi:close-modals',closeComparison);
