const { chromium } = require(process.env.DELPHI_PLAYWRIGHT || 'playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const repoRoot=path.resolve(__dirname,'..');
const root = path.join(repoRoot,'public');
const cacheName=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/delphi-pwa-v\d+/)[0];
const {spawn}=require('child_process');
const os=require('os');
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'delphi-qa-'));
fs.writeFileSync(path.join(dataDir,'test-key'),'test-key');
let apiPort;let apiProcess;
const reports=[{project:'DELPHI',repo:'brionize-nl/DELPHI',branch:'DELPHI-fixes',status:'pending',head:'head-sha',finished:Date.now(),next_scan:Date.now()+14400000,scanned:1,skipped:0,fixes:[{file:'test.js'}],findings:[{file:'test.js',status:'validated',issues:[{line:1,message:'Test bug'}]}]}];
let chatBody; const history = new Map(); const writes=[]; let branches=[{name:"main"}];
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    assert.equal(req.headers['x-api-key'], 'test-key');
    if (req.url === '/api/inspections') return res.end(JSON.stringify(reports));
    if (req.url.startsWith('/api/inspections/')) {let body='';req.on('data',c=>body+=c);req.on('end',()=>{const d=JSON.parse(body);reports[0].status=d.status;res.end('{}');});return;}
    if(req.url.startsWith('/api/history')) {
      const proxy=http.request({hostname:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers:req.headers},upstream=>{res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);});
      proxy.on('error',()=>{res.statusCode=502;res.end('{}');});req.pipe(proxy);return;
    }
    if (req.url.endsWith('/api/chat')) {
      let body = ''; req.on('data', c => body += c); req.on('end', () => {
        chatBody = JSON.parse(body);
        if(chatBody.stream===false) {res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({message:{content:'Stap resultaat '+chatBody.messages.at(-1).content.slice(0,20)}}));}
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.end(JSON.stringify({message: {content: 'Test antwoord'}, done: true}) + '\n');
      }); return;
    }
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET' && req.url.startsWith('/api/github/')) {
      let body='';req.on('data',c=>body+=c);req.on('end',()=>{const data=body?JSON.parse(body):null;writes.push({url:req.url,method:req.method,data});
      if(req.url.endsWith('/git/refs')) branches.push({name:data.ref.replace('refs/heads/','')});
      if(req.method==='DELETE') {branches=branches.filter(b=>!req.url.endsWith(b.name));res.statusCode=204;return res.end();}
      if(req.url.endsWith('/git/trees')) return res.end(JSON.stringify({sha:'tree-sha'}));
      if(req.url.endsWith('/git/commits')) return res.end(JSON.stringify({sha:'atomic-sha'}));
      res.end(JSON.stringify({content:{sha:'new-file-sha'},commit:{sha:'new-commit-sha'},html_url:'https://github.com/test/pr/2'}));});return;
    }
    if (/\/api\/github\/repos\/[^/]+\/[^/]+$/.test(req.url)) return res.end(JSON.stringify({default_branch:'main'}));
    if(req.url.includes('/git/commits/')) return res.end(JSON.stringify({tree:{sha:'base-tree-sha'}}));
    if (req.url.includes('/git/ref/heads/')) return res.end(JSON.stringify({object:{sha:'head-sha'}}));
    if (req.url.includes('/compare/')) return res.end(JSON.stringify({head_commit:{sha:'head-sha'},status:'ahead',files:[{filename:'test.js',patch:'+const test = 1;'}]}));
    if (req.url.includes('/contents/')) return res.end(JSON.stringify({type:'file',sha:'old-file-sha',size:10,content:Buffer.from('Repo instructie').toString('base64')}));
    if (req.url.endsWith('/tags')) return res.end(JSON.stringify({models: [{name: 'test:latest'}]}));
    if (req.url.includes('/branches')) return res.end(JSON.stringify(branches));
    if (req.url.includes('/pulls')) return res.end(JSON.stringify([{number: 1, title: 'Test PR', html_url: 'https://github.com/brionize-nl/DELPHI/pull/1', state: 'open'}]));
    return res.end(JSON.stringify([{sha: 'abcdefg', commit: {message: 'Test commit', author: {name: 'Tester', date: new Date().toISOString()}}}]));
  }
  const file = req.url === '/original' ? path.resolve('work/original.html') : path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});
(async () => {
  apiProcess=spawn('python3',[path.join(repoRoot,'server/api.py'),'--port','0','--data',dataDir,'--key-file',path.join(dataDir,'test-key')]);
  await new Promise((resolve,reject)=>{apiProcess.stdout.on('data',data=>{const match=data.toString().match(/listening on (\d+)/);if(match){apiPort=Number(match[1]);resolve();}});apiProcess.on('error',reject);apiProcess.on('exit',code=>reject(new Error('API exited '+code)));});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless: true});
  try {
    const context = await browser.newContext({serviceWorkers: 'block'});
    await context.addInitScript(() => localStorage.setItem('olla_apikey', 'test-key'));
    const page = await context.newPage(); const errors = [];
    await page.clock.install({time: new Date('2026-10-02T15:00:00Z')});
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(url); await page.waitForFunction(() => !document.querySelector('#model-select').disabled);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    await page.selectOption('#project-select','delphi');
    await page.click('#btn-project-context');
    await page.waitForFunction(()=>document.querySelector('#project-status').textContent.includes('Repo-context geladen'));
    await page.fill('#prompt', 'Test vraag'); await page.press('#prompt', 'Enter');
    await page.waitForFunction(() => document.querySelector('.msg-ai')?.textContent.includes('Test antwoord'));
    assert.equal(chatBody.messages.at(-1).content, 'Test vraag');
    assert.ok(chatBody.messages[0].content.includes('modulaire vanilla JS'));
    assert.ok(chatBody.messages[0].content.includes('Repo instructie'));
    await page.waitForFunction(() => document.querySelector('#history-status').textContent === 'Opgeslagen op VPS');
    const savedChats=fs.readdirSync(path.join(dataDir,'chats')).filter(n=>!n.startsWith('.')).map(n=>JSON.parse(fs.readFileSync(path.join(dataDir,'chats',n))));
    assert.equal(savedChats.some(c=>c.messages.some(m=>m.content==='Test antwoord')),true);
    await page.reload(); await page.waitForSelector('.msg-ai');
    assert.match(await page.locator('#chat').innerText(), /Test antwoord/);
    await page.click('[data-tab="werkplaats"]'); await page.waitForSelector('.gh-item');
    assert.match(await page.locator('#wp-content').innerText(), /Test PR/);
    await page.selectOption('#wp-repo-filter', 'brionize-nl/DELPHI');
    await page.waitForFunction(() => document.querySelectorAll('.repo-section').length === 1);
    page.on('dialog', d => d.accept());
    await page.click('#editor-tools > summary');
    await page.click('#btn-editor-repo'); await page.waitForFunction(()=>document.querySelector('#editor-branch').options.length>0);
    await page.fill('#editor-path','test.js'); await page.click('#btn-editor-read'); await page.waitForFunction(()=>document.querySelector('#editor-code').value==='Repo instructie');
    await page.fill('#editor-message','Update'); await page.click('#btn-editor-commit');
    await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.includes('Commit alleen'));
    assert.equal(writes.length,0);
    await page.fill('#editor-new-branch','delphi/test'); await page.click('#btn-editor-branch');
    await page.waitForFunction(()=>document.querySelector('#editor-branch').value==='delphi/test');
    await page.click('#btn-editor-read'); await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.includes('Bestand geladen'));
    await page.fill('#editor-code','const test = "hé";'); await page.click('#btn-editor-commit');
    await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.startsWith('Gecommit'));
    const write=writes.find(w=>w.method==='PUT');assert.equal(write.data.sha,'old-file-sha'); assert.equal(Buffer.from(write.data.content,'base64').toString(),'const test = "hé";');
    await page.evaluate(()=>commitEditorFile({repo:'brionize-nl/DELPHI',branch:'delphi/test',path:'public/test.js'},'Atomic test','const test = 2;',{sha:'old-file-sha'}));
    const treeWrite=writes.find(w=>w.url.endsWith('/git/trees')); assert.equal(treeWrite.data.tree.length,2);assert.equal(treeWrite.data.tree[1].path,'public/sw.js');
    assert.equal(writes.find(w=>w.method==='PATCH').data.force,false);
    await page.click('#btn-editor-compare');await page.waitForFunction(()=>document.querySelector('#editor-diff').textContent.includes('test.js'));
    await page.click('#btn-editor-merge');await page.waitForFunction(()=>document.querySelector('#editor-status').textContent==='Branch gemerged.');
    assert.equal(writes.find(w=>w.url.endsWith('/merges')).data.head,'head-sha');
    await page.locator('#editor-tools details').last().locator('summary').click();
    await page.fill('#editor-pr-title','Test PR');await page.click('#btn-editor-pr');await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.startsWith('PR aangemaakt'));
    await page.click('[data-tab="launchpad"]');
    await page.fill('#lp-add-name', 'Mijn link'); await page.fill('#lp-add-url', 'example.com'); await page.click('#btn-lp-add');
    assert.equal(await page.locator('#lp-custom-grid a').getAttribute('href'), 'https://example.com');
    await page.click('#lp-custom-grid button');
    assert.equal(await page.locator('#lp-custom-grid a').count(), 0);
    await page.click('[data-tab="chains"]');await page.click('#btn-chain-models');await page.waitForFunction(()=>document.querySelector('#chain-model').options.length>0);
    await page.fill('#chain-input','Chain test');await page.click('#btn-chain-run');
    await page.waitForFunction(()=>document.querySelector('#chain-status').textContent==='Keten voltooid.');
    assert.equal(await page.locator('.chain-step').count(),3);assert.equal(await page.locator('.chain-step h3').allTextContents().then(a=>a.every(x=>x.endsWith('klaar'))),true);
    await page.click('#btn-chain-editor');assert.ok(await page.locator('#editor-code').inputValue().then(x=>x.includes('Stap resultaat')));
    await page.click('[data-tab="inspector"]');await page.waitForFunction(()=>document.querySelector('#inspection-projects').textContent.includes('Fixes wachten'));
    await page.click('#inspection-projects button');
    assert.ok(await page.locator('#inspection-detail').innerText().then(x=>x.includes('Test bug')));
    await page.getByRole('button',{name:'Bekijk diff',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#inspection-detail pre').textContent.includes('test.js'));
    await page.getByRole('button',{name:'Merge alle fixes',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#inspection-status').textContent.startsWith('Fixes gemerged'));
    assert.equal(reports[0].status,'merged');
    await page.setViewportSize({width: 390, height: 844});
    await page.click('[data-tab="chat"]'); await page.click('#btn-menu');
    assert.match(await page.locator('#sidebar').getAttribute('class'), /open/);
    await page.click('#sidebar-backdrop');
    assert.ok(!((await page.locator('#sidebar').getAttribute('class')).includes('open')));
    await page.click('#btn-settings2'); await page.fill('#system-prompt', 'Test systeem'); await page.click('#btn-save');
    assert.equal(await page.evaluate(() => localStorage.getItem('olla_system')), 'Test systeem');
    assert.equal(await page.evaluate(()=>{const div=document.createElement('div');div.innerHTML=renderMd('<img src=x onerror=alert(1)> [bad](javascript:alert(1))');return div.querySelector('img,a')===null;}),true);
    assert.deepEqual(errors, []);
    await page.click('[data-tab="chains"]');
    await page.screenshot({path:path.join(dataDir,'cockpit-mobile.png'),animations:'disabled'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth));
    await context.close();
    const offline = await browser.newContext(); const p = await offline.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(url); await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    const cached = await p.evaluate(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname),cacheName);
    for (const asset of ['/css/delphi.css', '/js/app.js', '/js/chat.js', '/js/werkplaats.js', '/js/launchpad.js']) assert.ok(cached.includes(asset), asset);
    await offline.grantPermissions(['notifications']);
    await p.evaluate(async()=>{
      Object.defineProperty(Notification,'permission',{get:()=> 'granted', configurable:true});
      const registration=await navigator.serviceWorker.ready;
      window.notificationCalls=[];
      registration.showNotification=async(title,options)=>window.notificationCalls.push({title,options});
      navigator.serviceWorker.getRegistration=async()=>registration;
      await notifyCompletion('Test','Melding test',0,true);
    });
    assert.equal(await p.evaluate(()=>window.notificationCalls[0].title),'DELPHI — Test');

    await offline.setOffline(true); await p.reload();
    await p.click('#btn-cancel'); await p.click('[data-tab="launchpad"]');
    assert.ok(await p.locator('#lp-add-name').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: real Python history server autosave; chat streaming/persisted history; project context; GitHub commits/branches/PR/merge; chains; inspection review; notification dispatch; links; mobile layout; settings; cache/offline. GitHub/Ollama/notification delivery mocked.');
  } finally { await browser.close(); server.close();apiProcess?.kill();fs.rmSync(dataDir,{recursive:true,force:true}); }
})().catch(e => {console.error(e); process.exitCode = 1; server.close();apiProcess?.kill();fs.rmSync(dataDir,{recursive:true,force:true});});
