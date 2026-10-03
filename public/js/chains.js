const CHAIN_TEMPLATES = {
  review: {name: 'Code Review', steps: [{preset:'coder',prompt:'Analyseer deze code op bugs en problemen:\n\n{{input}}'},{preset:'analyst',prompt:'Prioriteer deze bevindingen op ernst:\n\n{{input}}'},{preset:'schrijver',prompt:'Schrijf een duidelijk rapport:\n\n{{input}}'}]},
  fix: {name:'Bug Fix',steps:[{preset:'coder',prompt:'Analyseer deze fout:\n\n{{input}}'},{preset:'coder',prompt:'Schrijf een volledige fix voor deze analyse:\n\n{{input}}'},{preset:'analyst',prompt:'Review deze fix. Benoem beperkingen en geef de uiteindelijke code:\n\n{{input}}'}]},
  docs: {name:'Documentatie',steps:[{preset:'coder',prompt:'Leg uit wat deze code doet:\n\n{{input}}'},{preset:'schrijver',prompt:'Schrijf een heldere uitleg:\n\n{{input}}'},{preset:'schrijver',prompt:'Maak een README in markdown:\n\n{{input}}'}]},
  refactor: {name:'Refactor',steps:[{preset:'coder',prompt:'Analyseer de structuur:\n\n{{input}}'},{preset:'analyst',prompt:'Stel concrete verbeteringen voor:\n\n{{input}}'},{preset:'coder',prompt:'Schrijf een nieuwe versie op basis hiervan:\n\n{{input}}'}]}
};
let chainController = null;
let chainResult = '';

async function ollamaComplete(model, messages, signal, temperature = 0.3) {
  const response = await apiFetch('/api/ollama/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, signal, body:JSON.stringify({model, messages, stream:false, options:{temperature}})});
  const result = await response.json();
  if (result.error || !result.message?.content) throw new Error(result.error || 'Ollama gaf geen antwoord');
  return result.message.content;
}

async function loadChainModels() {
  $('#chain-status').textContent = 'Ollama-modellen ophalen…';
  try {
    const data = await (await apiFetch('/api/ollama/api/tags')).json();
    const select = $('#chain-model'); const previous = select.value;
    select.replaceChildren();
    (data.models || []).forEach(m => { const o=document.createElement('option');o.value=m.name;o.textContent=m.name;select.appendChild(o); });
    if ([...select.options].some(o=>o.value === previous)) select.value = previous;
    $('#chain-status').textContent = select.options.length ? 'Klaar om te starten.' : 'Geen Ollama-modellen beschikbaar.';
  } catch (e) { logError('chains', e); $('#chain-status').textContent = e.message; }
}

function showChainTemplate() {
  if ($('#chain-template').value === 'custom') $('#chain-definition').value = getSetting('custom_chain', JSON.stringify(CHAIN_TEMPLATES.review, null, 2));
  else $('#chain-definition').value = JSON.stringify(CHAIN_TEMPLATES[$('#chain-template').value], null, 2);
}
$('#chain-template').addEventListener('change', showChainTemplate);
$('#btn-chain-models').addEventListener('click', loadChainModels);
$('#btn-chain-save').addEventListener('click', () => {
  try { validateChain(JSON.parse($('#chain-definition').value)); setSetting('custom_chain', $('#chain-definition').value); $('#chain-status').textContent='Eigen keten bewaard.'; }
  catch(e) { $('#chain-status').textContent=e.message; }
});
function validateChain(chain) {
  if (!chain || typeof chain.name !== 'string' || !Array.isArray(chain.steps) || !chain.steps.length || chain.steps.length > 10) throw new Error('Keten vereist een naam en 1–10 stappen');
  chain.steps.forEach(s=>{ if (!s || typeof s.prompt !== 'string' || !s.prompt.includes('{{input}}') || !['coder','analyst','schrijver','sysadmin','assistent','creatief','uitleg'].includes(s.preset)) throw new Error('Elke stap vereist een bekende preset en een prompt met {{input}}'); });
  return chain;
}
$('#btn-chain-run').addEventListener('click', async () => {
  if (chainController) return;
  let chain;
  try { chain=validateChain(JSON.parse($('#chain-definition').value)); }
  catch(e) { $('#chain-status').textContent=e.message;return; }
  const model=$('#chain-model').value; let input=$('#chain-input').value.trim();
  if (!model || !input) { $('#chain-status').textContent='Kies een Ollama-model en voer input in.';return; }
  const controller=new AbortController();chainController=controller;chainResult='';
  $('#btn-chain-run').disabled=true;$('#btn-chain-stop').disabled=false;
  $('#btn-chain-copy').disabled=true;$('#btn-chain-editor').disabled=true;
  const start=Date.now();const context=projectSystemPrompt();
  const root=$('#chain-steps');root.replaceChildren();
  const rows=chain.steps.map((step,i)=>{
    const row=document.createElement('section');row.className='chain-step';
    const heading=document.createElement('h3');heading.textContent=(i+1)+'. '+step.preset+' — wachtend';
    const output=document.createElement('pre');row.append(heading,output);root.appendChild(row);return {heading,output};
  });
  try {
    for(let i=0;i<chain.steps.length;i++) {
      controller.signal.throwIfAborted();const step=chain.steps[i];
      rows[i].heading.textContent=(i+1)+'. '+step.preset+' — bezig';
      $('#chain-status').textContent='Stap '+(i+1)+' van '+chain.steps.length;
      const preset=PRESETS.find(p=>p.id===step.preset);
      const system=[context,preset?.system || 'Je bent een kritische analist. Prioriteer bevindingen op ernst en onderbouw in het Nederlands.'].filter(Boolean).join('\n\n');
      input=await ollamaComplete(model,[{role:'system',content:system},{role:'user',content:step.prompt.replaceAll('{{input}}',input)}],controller.signal,preset?.temp ?? 0.3);
      rows[i].output.textContent=input;rows[i].heading.textContent=(i+1)+'. '+step.preset+' — klaar';
    }
    chainResult=input;$('#chain-status').textContent='Keten voltooid.';
    $('#btn-chain-copy').disabled=false;$('#btn-chain-editor').disabled=false;
    if (typeof notifyCompletion === 'function') notifyCompletion('Keten voltooid',chain.name+' is klaar.',Date.now()-start, true);
  } catch(e) {
    if (e.name !== 'AbortError') logError('chains', e);
    $('#chain-status').textContent=e.name==='AbortError'?'Keten gestopt.':e.message;
    rows.forEach(r=>{if(r.heading.textContent.endsWith('bezig'))r.heading.textContent=r.heading.textContent.replace('bezig',e.name==='AbortError'?'gestopt':'fout');});
  } finally { chainController=null;$('#btn-chain-run').disabled=false;$('#btn-chain-stop').disabled=true; }
});
$('#btn-chain-stop').addEventListener('click',()=>chainController?.abort());
$('#btn-chain-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(chainResult);$('#chain-status').textContent='Resultaat gekopieerd.';}catch{$('#chain-status').textContent='Kopiëren geweigerd; selecteer het resultaat handmatig.';}});
$('#btn-chain-editor').addEventListener('click',()=>{
  if(!chainResult)return;
  if($('#editor-code').value && !confirm('Bestaande tekst in de editor vervangen door dit resultaat?'))return;
  $('#editor-code').value=chainResult;renderCode();
  $('[data-tab="werkplaats"]').click();$('#editor-tools').open=true;
  editorStatus('Ketenresultaat in editor. Controleer code en werkbranch vóór commit.');
});
showChainTemplate();
