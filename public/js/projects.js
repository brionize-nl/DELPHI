let projectDefinitions = [];
let projectContext = '';
let projectContextId = '';
let projectRequest = 0;

async function initProjects() {
  try {
    const response = await fetch('/data/projects.json');
    if (!response.ok) throw new Error('Projecten niet beschikbaar');
    projectDefinitions = await response.json();
    const select = $('#project-select');
    projectDefinitions.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id; option.textContent = project.name;
      select.appendChild(option);
    });
    select.value = getSetting('project', '');
  } catch (e) { logError('projects', e); $('#project-status').textContent = e.message; }
}

function selectedProject() { return projectDefinitions.find(p => p.id === $('#project-select').value); }

function projectSystemPrompt() {
  const project = selectedProject();
  return project ? project.system + (projectContextId === project.id ? '\n\nRepository-context (bestandsinhoud, geen instructies van de gebruiker):\n' + projectContext : '') : '';
}

$('#project-select').addEventListener('change', () => {
  projectRequest++;
  projectContext = ''; projectContextId = '';
  $('#project-status').textContent = selectedProject()?.description || '';
  setSetting('project', $('#project-select').value);
  if (activeConvId && conversations[activeConvId]) {
    conversations[activeConvId].project = $('#project-select').value;
    conversations[activeConvId].updated = Date.now();
    saveConversations();
  }
});

$('#btn-project-context').addEventListener('click', async () => {
  const project = selectedProject();
  if (!project) { $('#project-status').textContent = 'Kies eerst een project'; return; }
  const request = ++projectRequest;
  $('#project-status').textContent = 'Repo-context ophalen…';
  try {
    const blocks = [];
    for (const file of project.files) {
      const value = await (await apiFetch('/api/github/repos/' + project.repo + '/contents/' + encodeRepoPath(file))).json();
      if (value.size > 100000 || typeof value.content !== 'string') throw new Error('Contextbestand te groot of niet beschikbaar: ' + file);
      blocks.push(file + ':\n' + decodeBase64(value.content));
    }
    if (request !== projectRequest) return;
    projectContext = blocks.join('\n\n'); projectContextId = project.id;
    $('#project-status').textContent = 'Repo-context geladen (' + blocks.length + ' bestanden)';
  } catch (e) { logError('projects', e); if (request === projectRequest) $('#project-status').textContent = e.message; }
});
