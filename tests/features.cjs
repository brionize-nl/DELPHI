// Native-browser feature tests. Local API fixtures; never touches a real repo.
const {chromium}=require(process.env.DELPHI_PLAYWRIGHT || 'playwright');
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=path.join(__dirname,'../public');const chats=new Map();const bodies=[];let maxParallel=0,inFlight=0,aborted=0,failModels=false;
const reports=[{project:'DELPHI',repo:'brionize-nl/DELPHI',status:'findings',scanned:1,skipped:2,fixes:[],findings:[{file:'test.js',status:'reported',issues:[{line:2,message:'<img src=x onerror="window.pwned=1">',evidence:'console.log(missing);'}]}]}];
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')) {
  assert.equal(req.headers['x-api-key'],'test-key');res.setHeader('Content-Type','application/json');
  if(req.url==='/api/history/list')return res.end(JSON.stringify([...chats.values()].map(({id,title,updated,created})=>({id,title,updated,created}))));
  if(req.url==='/api/history/deleted')return res.end('[]');
  if(req.url==='/api/history' && req.method==='POST') {let body='';for await(const chunk of req)body+=chunk;const c=JSON.parse(body);chats.set(c.id,c);return res.end('{}');}
  if(req.url.startsWith('/api/history/'))return res.end(JSON.stringify(chats.get(decodeURIComponent(req.url.slice(13))) || {}));
  if(req.url==='/api/inspections')return res.end(JSON.stringify(reports));
  if(req.url.endsWith('/tags')) {if(failModels){res.statusCode=503;return res.end('{}');}return res.end(JSON.stringify({models:[{name:'alpha'},{name:'beta'}]}));}
  if(req.url==='/api/gemini/v1beta/openai/models')return res.end(JSON.stringify({data:[{id:'gemini-test'}]}));
  if(req.url.endsWith('/api/chat') || req.url.endsWith('/chat/completions')) {
   let body='';for await(const c of req)body+=c;const data=JSON.parse(body);bodies.push(data);
   const prompt=data.messages.at(-1).content;
   if(prompt==='één fout' && data.model==='beta') {res.statusCode=503;return res.end('{}');}
   inFlight++;maxParallel=Math.max(maxParallel,inFlight);
   res.setHeader('Content-Type',req.url.endsWith('/completions')?'text/event-stream':'application/x-ndjson');
   const emit=(text,done)=>req.url.endsWith('/completions')?'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n'+(done?'data: [DONE]\n\n':''):JSON.stringify({message:{content:text},done})+'\n';
   res.write(emit('Antwoord <img src=x onerror="window.pwned=1"> ',false));
   const timer=setTimeout(()=>res.end(emit(data.model,true)),prompt==='langzaam'?3000:data.model==='alpha'?200:80);
   res.on('close',()=>{clearTimeout(timer);inFlight--;if(!res.writableEnded)aborted++;});return;
  }
  if(req.url.includes('/commits'))return res.end(JSON.stringify(Array.from({length:5},(_,i)=>({sha:'abcdef'+i,html_url:'https://github.com/brionize-nl/DELPHI/commit/'+i,commit:{message:'Commit <script> '+i,author:{date:new Date().toISOString()}}}))));
  if(req.url.includes('/contents/'))return res.end(JSON.stringify({size:1,content:Buffer.from('Context').toString('base64')}));
  if(req.url.includes('/pulls') || req.url.includes('/branches'))return res.end('[]');
  return res.end('{}');
 }
 const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);
 try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}
 catch {res.statusCode=404;res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});let tested=0;
 try {
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
  await context.addInitScript(()=>{
   localStorage.setItem('olla_apikey','test-key');
   class Recognition { constructor(){window.speechFixture=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){this.onend?.();} }
   window.SpeechRecognition=Recognition;
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>!modelSelect.disabled && historyReady && !historyRunning);
  await page.fill('#prompt','Concept');await page.click('#btn-voice');
  await page.evaluate(()=>speechFixture.onresult({resultIndex:0,results:[Object.assign([{transcript:'hé wereld'}],{isFinal:true})]}));
  assert.equal(await page.inputValue('#prompt'),'Concept hé wereld');assert.equal(bodies.length,0);
  await page.evaluate(()=>speechFixture.onerror({error:'not-allowed'}));assert.match(await page.locator('#voice-status').innerText(),/geweigerd/);tested++;
  await page.fill('#prompt','Sneltoets');await page.keyboard.press('Control+Enter');await page.waitForFunction(()=>!generating && conversations[activeConvId].messages.length===2);
  assert.equal(bodies.at(-1).messages.at(-1).content,'Sneltoets');
  for(let i=1;i<=5;i++){await page.keyboard.press('Control+'+i);assert.equal(await page.evaluate(()=>activeTab),['chat','werkplaats','launchpad','chains','inspector'][i-1]);}
  await page.keyboard.press('Control+n');assert.equal(await page.evaluate(()=>activeTab),'chat');
  await page.click('#btn-settings');await page.keyboard.press('Escape');assert.equal(await page.locator('.modal-overlay.open').count(),0);tested++;
  await page.evaluate(()=>{
   const now=Date.now()+1000;conversations.searchA={id:'searchA',title:'<img src=x onerror="window.pwned=1">',messages:[{role:'user',content:'hé éléphant'},{role:'assistant',content:'Antwoord ✓',provider:'ollama'}],created:now,updated:now,provider:'ollama'};
   conversations.searchB={id:'searchB',title:'Andere titel',messages:[{role:'user',content:'Verder'}],created:now,updated:now};saveConversations();renderConvList();
  });
  await page.waitForFunction(()=>!historyRunning);await page.clock.install();await page.clock.pauseAt(new Date());
  await page.fill('#conv-search','éléphant');await page.clock.runFor(299);assert.ok(await page.locator('.conv-item').count()>1);
  await page.clock.runFor(1);assert.equal(await page.locator('.conv-item').count(),1);assert.equal(await page.locator('.conv-item mark').innerText(),'éléphant');tested++;
  const downloadPromise=page.waitForEvent('download');await page.locator('.conv-item .export').click();const download=await downloadPromise;
  const target=path.join(os.tmpdir(),'delphi-export-'+Date.now()+'.md');await download.saveAs(target);
  const markdown=fs.readFileSync(target,'utf8');fs.unlinkSync(target);assert.ok(markdown.startsWith('# Gesprek: <img'));assert.ok(markdown.includes('## Gebruiker\nhé éléphant'));assert.ok(markdown.includes('## Ollama\nAntwoord ✓'));tested++;
  await page.fill('#conv-search','<img');await page.clock.runFor(300);assert.equal(await page.locator('#conv-list img').count(),0);assert.equal(await page.evaluate(()=>window.pwned),undefined);
  await page.clock.resume();await page.fill('#conv-search','');await page.waitForTimeout(350);
  await page.selectOption('#provider-select','gemini');await page.waitForFunction(()=>modelSelect.value==='gemini-test');assert.equal(await page.evaluate(()=>PROVIDERS.gemini.chatPath),'/api/gemini/v1beta/openai/chat/completions');await page.selectOption('#provider-select','ollama');await page.waitForFunction(()=>modelSelect.value==='alpha');
  await page.evaluate(()=>{saveCustomLinks([{name:'malicious',url:'javascript:alert(1)'},{name:'Mail',url:'mailto:test@example.com'}]);renderCustomLinks();});assert.equal(await page.locator('#lp-custom-grid a').count(),1);
  if(await page.locator('#view-dashboard').count()) {
   await page.click('[data-tab="dashboard"]');await page.waitForFunction(()=>!dashboardBusy && document.querySelector('#dashboard-status').textContent==='Dashboard bijgewerkt.');
   assert.equal(await page.locator('#dashboard-commits li').count(),5);assert.equal(await page.locator('#dashboard-models li').count(),2);assert.equal(await page.locator('#dashboard-inspections li').count(),1);
   assert.equal(await page.locator('#dashboard-commits script').count(),0);assert.ok(Number(await page.locator('#dashboard-count').innerText())>=3);
   failModels=true;await page.click('#btn-dashboard-refresh');await page.waitForFunction(()=>!dashboardBusy && document.querySelector('#dashboard-status').textContent.includes('niet beschikbaar'));
   assert.equal(await page.locator('#dashboard-commits li').count(),5);assert.equal(await page.locator('#dashboard-inspections li').count(),1);failModels=false;
   await page.click('#btn-dashboard-refresh');await page.waitForFunction(()=>!dashboardBusy && document.querySelector('#dashboard-status').textContent==='Dashboard bijgewerkt.');
   await page.keyboard.press('Control+1');await page.keyboard.press('Control+6');assert.equal(await page.evaluate(()=>activeTab),'dashboard');tested++;
  }
  // Later feature PRs extend this test on the same branch stack.
  assert.deepEqual(errors,[]);
  const fallback=await browser.newContext({serviceWorkers:'block'});await fallback.addInitScript(()=>{localStorage.setItem('olla_apikey','test-key');Object.defineProperty(window,'SpeechRecognition',{value:undefined});Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined});});
  const fallbackPage=await fallback.newPage();await fallbackPage.goto(url);assert.equal(await fallbackPage.locator('#btn-voice').isVisible(),false);await fallback.close();
  await page.setViewportSize({width:375,height:812});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS: '+tested+' feature groups; speech draft/denial/fallback, shortcuts, full-text debounce/highlight, UTF-8 Markdown download, Gemini paths and URL/XSS safety.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
