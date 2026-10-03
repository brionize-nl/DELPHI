// Werkplaats writes: every action is explicit; editing uses GitHub's file SHA.
let editorRepo = '';
let editorDefaultBranch = 'main';
let editorLoaded = null;
let editorRequest = 0;
let editorBusy = false;
let editorComparison = null;
let editorProposal = null;

function editorStatus(text) { $('#editor-status').textContent = text; }
function editorSelection() { return {repo: $('#editor-repo').value, branch: $('#editor-branch').value, path: $('#editor-path').value.trim()}; }
function sameSelection(a, b) { return a && a.repo === b.repo && a.branch === b.branch && a.path === b.path; }
function writableBranch(branch) { return branch && ![editorDefaultBranch, 'main', 'master'].includes(branch); }
function validPath(path) { return path && !path.startsWith('/') && !path.split('/').some(p => !p || p === '.' || p === '..'); }
function renderCode() {
  const code = $('#editor-code').value;
  // Escaped, line-numbered source view. User/model text never becomes HTML.
  $('#editor-preview').innerHTML = code.split('\n').map((line, i) => '<span class="source-line"><span class="line-no">' + (i + 1) + '</span>' + highlightSource(line) + '</span>').join('');
}
function highlightSource(line) {
  const tokens = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*|\b(?:const|let|function|return|if|else|for|while|async|await|class|import|export|def|True|False|null)\b)/g;
  let result = '', cursor = 0;
  for (const match of line.matchAll(tokens)) {
    result += escapeHtml(line.slice(cursor, match.index));
    const cls = match[0].startsWith('//') ? 'comment' : /^["']/.test(match[0]) ? 'string' : 'keyword';
    result += '<span class="source-' + cls + '">' + escapeHtml(match[0]) + '</span>';
    cursor = match.index + match[0].length;
  }
  return result + escapeHtml(line.slice(cursor));
}
async function githubRequest(path, method = 'GET', value) {
  const response = await apiFetch('/api/github/' + path, {method, ...(value === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)})});
  return response.status === 204 ? null : response.json();
}
async function commitEditorFile(selection, message, content, loaded) {
  const prefix='repos/'+selection.repo;
  if(selection.repo!=='brionize-nl/DELPHI' || !selection.path.startsWith('public/') || selection.path==='public/sw.js') {
    return githubRequest(prefix+'/contents/'+encodeRepoPath(selection.path),'PUT',{message,branch:selection.branch,content:encodeBase64(content),...(loaded?{sha:loaded.sha}:{})});
  }
  // Update the edited asset and cache version in one commit, never half-publish.
  const ref=await githubRequest(prefix+'/git/ref/heads/'+encodeRepoPath(selection.branch));
  let existing=null;
  try {existing=await githubRequest(prefix+'/contents/'+encodeRepoPath(selection.path)+'?ref='+ref.object.sha);}
  catch(e) {if(!e.message.includes('404'))throw e;}
  if(loaded ? existing?.sha!==loaded.sha : existing)throw new Error('Bestand gewijzigd of bestaat al; laad het opnieuw.');
  const sw=await githubRequest(prefix+'/contents/public/sw.js?ref='+ref.object.sha);
  const original=decodeBase64(sw.content);
  if(!/delphi-pwa-v\d+/.test(original))throw new Error('Serviceworker-cacheversie niet gevonden');
  const cache=original.replace(/delphi-pwa-v(\d+)/,(_,n)=>'delphi-pwa-v'+(Number(n)+1));
  const base=await githubRequest(prefix+'/git/commits/'+ref.object.sha);
  const tree=await githubRequest(prefix+'/git/trees','POST',{base_tree:base.tree.sha,tree:[{path:selection.path,mode:'100644',type:'blob',content},{path:'public/sw.js',mode:'100644',type:'blob',content:cache}]});
  const commit=await githubRequest(prefix+'/git/commits','POST',{message,tree:tree.sha,parents:[ref.object.sha]});
  await githubRequest(prefix+'/git/refs/heads/'+encodeRepoPath(selection.branch),'PATCH',{sha:commit.sha,force:false});
  const file=await githubRequest(prefix+'/contents/'+encodeRepoPath(selection.path)+'?ref='+commit.sha);
  return {content:file,commit};
}
async function editorAction(action) {
  if (editorBusy) return;
  editorBusy = true;
  const controls=[...$$('#editor-tools button, #editor-tools input, #editor-tools select, #editor-tools textarea')];
  const previous=controls.map(c=>c.disabled);
  controls.forEach(c=>c.disabled=true);
  try { await action(); } catch (e) { logError('editor', e); editorStatus(e.message); }
  finally { editorBusy = false; controls.forEach((c,i)=>c.disabled=previous[i]); }
}

async function loadEditorRepo() {
  const request = ++editorRequest;
  editorLoaded = null; editorComparison = null;
  const repo = $('#editor-repo').value;
  editorStatus('Branches ophalen…');
  const [metadata, branches] = await Promise.all([githubRequest('repos/' + repo), githubRequest('repos/' + repo + '/branches?per_page=100')]);
  if (request !== editorRequest) return;
  editorRepo = repo; editorDefaultBranch = metadata.default_branch || 'main';
  const select = $('#editor-branch'); select.replaceChildren();
  branches.forEach(b => { const option = document.createElement('option'); option.value = b.name; option.textContent = b.name; select.appendChild(option); });
  select.value = branches.some(b => b.name === editorDefaultBranch) ? editorDefaultBranch : branches[0]?.name || '';
  $('#editor-code').value = ''; renderCode();
  editorStatus('Kies een bestand, of maak eerst een werkbranch.');
}

async function readEditorFile() {
  const selection = editorSelection();
  if (!validPath(selection.path) || !selection.branch) throw new Error('Kies een branch en een geldig bestandspad');
  const request = ++editorRequest;
  const file = await githubRequest('repos/' + selection.repo + '/contents/' + encodeRepoPath(selection.path) + '?ref=' + encodeURIComponent(selection.branch));
  if (request !== editorRequest || !sameSelection(selection, editorSelection())) return;
  if (file.type !== 'file' || file.size > 1000000 || typeof file.content !== 'string') throw new Error('Alleen tekstbestanden tot 1 MB kunnen worden bewerkt');
  const content = decodeBase64(file.content);
  if (content.includes('\0')) throw new Error('Binair bestand kan niet worden bewerkt');
  editorLoaded = {...selection, sha: file.sha, content};
  $('#editor-code').value = content; renderCode();
  editorStatus(writableBranch(selection.branch) ? 'Bestand geladen; wijzigingen gaan naar ' + selection.branch : 'Hoofdbranch: alleen lezen. Maak een werkbranch om te bewerken.');
}

$('#editor-repo').addEventListener('change', () => editorAction(loadEditorRepo));
$('#editor-branch').addEventListener('change', () => { editorRequest++; editorLoaded = null; editorComparison = null; editorStatus('Branch gewijzigd; laad het bestand opnieuw.'); });
$('#editor-path').addEventListener('input', () => { editorRequest++; editorComparison = null; });
$('#editor-code').addEventListener('input', renderCode);
$('#btn-editor-repo').addEventListener('click', () => editorAction(loadEditorRepo));
$('#btn-editor-read').addEventListener('click', () => editorAction(readEditorFile));
$('#btn-editor-files').addEventListener('click', () => editorAction(async () => {
  const {repo, branch} = editorSelection();
  if (!branch) throw new Error('Laad eerst de branches');
  const tree = await githubRequest('repos/' + repo + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1');
  const list = $('#editor-file-list'); list.replaceChildren();
  tree.tree.filter(f => f.type === 'blob').forEach(f => { const option = document.createElement('option'); option.value = f.path; list.appendChild(option); });
  editorStatus(tree.truncated ? 'Gedeeltelijke bestandslijst geladen; voer andere paden handmatig in.' : 'Bestandslijst geladen.');
}));
$('#btn-editor-branch').addEventListener('click', () => editorAction(async () => {
  const {repo, branch} = editorSelection(); const name = $('#editor-new-branch').value.trim();
  if (!name || !branch || !writableBranch(name)) throw new Error('Voer een nieuwe werkbranch in en kies een startbranch');
  const ref = await githubRequest('repos/' + repo + '/git/ref/heads/' + encodeRepoPath(branch));
  await githubRequest('repos/' + repo + '/git/refs', 'POST', {ref: 'refs/heads/' + name, sha: ref.object.sha});
  await loadEditorRepo(); $('#editor-branch').value = name;
  editorStatus('Werkbranch aangemaakt: ' + name);
}));
$('#btn-editor-commit').addEventListener('click', () => editorAction(async () => {
  const selection = editorSelection(); const message = $('#editor-message').value.trim();
  if (!writableBranch(selection.branch)) throw new Error('Commit alleen op een werkbranch');
  if (!validPath(selection.path) || !message) throw new Error('Bestandspad en commitbericht zijn verplicht');
  const loaded = sameSelection(editorLoaded, selection) ? editorLoaded : null;
  if (!loaded && !$('#editor-create').checked) throw new Error('Laad eerst het bestand of vink nieuw bestand aan');
  if (!confirm('Commit ' + selection.path + ' op ' + selection.branch + '?')) return;
  const result = await commitEditorFile(selection, message, $('#editor-code').value, loaded);
  editorLoaded = {...selection, sha: result.content.sha, content: $('#editor-code').value};
  editorComparison = null;
  editorStatus('Gecommit: ' + result.commit.sha.slice(0, 7));
}));

async function compareEditorBranch() {
  const {repo, branch} = editorSelection();
  if (!writableBranch(branch)) throw new Error('Kies een werkbranch');
  const head = await githubRequest('repos/' + repo + '/git/ref/heads/' + encodeRepoPath(branch));
  const comparison = await githubRequest('repos/' + repo + '/compare/' + encodeURIComponent(editorDefaultBranch) + '...' + head.object.sha);
  editorComparison = {repo, branch, base: editorDefaultBranch, baseSha: comparison.base_commit.sha, sha: head.object.sha};
  $('#editor-diff').textContent = comparison.files.map(f => f.filename + '\n' + (f.patch || '(Geen tekst-diff beschikbaar)')).join('\n\n') || 'Geen verschillen';
  editorStatus('Vergelijking: ' + comparison.status + ' · ' + comparison.files.length + ' bestanden');
}
$('#btn-editor-compare').addEventListener('click', () => editorAction(compareEditorBranch));
$('#btn-editor-merge').addEventListener('click', () => editorAction(async () => {
  const {repo, branch} = editorSelection();
  if (!writableBranch(branch) || !editorComparison || editorComparison.repo !== repo || editorComparison.branch !== branch) throw new Error('Bekijk eerst de branch-diff');
  const ref = await githubRequest('repos/' + repo + '/git/ref/heads/' + encodeRepoPath(branch));
  if (ref.object.sha !== editorComparison.sha) { editorComparison = null; throw new Error('Branch gewijzigd; vergelijk opnieuw'); }
  const base = await githubRequest('repos/' + repo + '/git/ref/heads/' + encodeRepoPath(editorComparison.base));
  if (base.object.sha !== editorComparison.baseSha) { editorComparison = null; throw new Error('Hoofdbranch gewijzigd; vergelijk opnieuw'); }
  if (!confirm(branch + ' mergen naar ' + editorComparison.base + '?')) return;
  await githubRequest('repos/' + repo + '/merges', 'POST', {base: editorComparison.base, head: editorComparison.sha, commit_message: 'Merge ' + branch + ' via DELPHI'});
  editorComparison = null; editorStatus('Branch gemerged.'); loadWerkplaats();
}));
$('#btn-editor-delete').addEventListener('click', () => editorAction(async () => {
  const {repo, branch} = editorSelection();
  if (!writableBranch(branch)) throw new Error('De hoofdbranch kan niet worden verwijderd');
  if (!confirm('Branch ' + branch + ' verwijderen? Niet-gemergede commits verdwijnen uit deze branch.')) return;
  await githubRequest('repos/' + repo + '/git/refs/heads/' + encodeRepoPath(branch), 'DELETE');
  await loadEditorRepo(); editorStatus('Branch verwijderd.');
}));
$('#btn-editor-pr').addEventListener('click', () => editorAction(async () => {
  const {repo, branch} = editorSelection(); const title = $('#editor-pr-title').value.trim();
  if (!writableBranch(branch) || !title) throw new Error('Werkbranch en PR-titel zijn verplicht');
  const result = await githubRequest('repos/' + repo + '/pulls', 'POST', {title, body: $('#editor-pr-body').value, base: editorDefaultBranch, head: branch});
  editorStatus('PR aangemaakt: ' + result.html_url); loadWerkplaats();
}));
$('#btn-editor-ai').addEventListener('click', () => editorAction(async () => {
  const model = $('#chain-model')?.value || (providerSelect.value === 'ollama' ? modelSelect.value : '');
  if (!model) throw new Error('Selecteer eerst een Ollama-model in Chat of Ketentaken');
  const selection = editorSelection(); const code = $('#editor-code').value;
  if (!code.trim()) throw new Error('Laad of schrijf eerst code');
  editorStatus('Ollama maakt een voorstel…');
  const response = await apiFetch('/api/ollama/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model, stream: false, messages: [{role: 'system', content: 'Repareer bugs in de code. Geef uitsluitend het volledige gecorrigeerde bestand, zonder markdown fences of uitleg. Voeg geen features toe.'}, {role: 'user', content: 'Bestand: ' + selection.path + '\nOpdracht: ' + $('#editor-ai-instruction').value + '\n\n' + code}]})});
  const data = await response.json();
  if (!data.message?.content) throw new Error('Geen voorstel ontvangen');
  editorProposal = {selection, original: code, content: data.message.content.replace(/^```[^\n]*\n/, '').replace(/\n```\s*$/, '')};
  $('#editor-ai-proposal').textContent = editorProposal.content;
  editorStatus('Voorstel klaar. Controleer het en neem het expliciet over voordat je commit.');
}));
$('#btn-editor-accept').addEventListener('click', () => {
  if (!editorProposal || !sameSelection(editorProposal.selection, editorSelection()) || editorProposal.original !== $('#editor-code').value) { editorStatus('Code of bestand gewijzigd; maak een nieuw voorstel.'); return; }
  $('#editor-code').value = editorProposal.content; editorProposal = null; renderCode(); editorStatus('Voorstel overgenomen; nog niet gecommit.');
});
