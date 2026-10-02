# DELPHI — Blueprint v2

## Wat is DELPHI?
Persoonlijke AI Command Center PWA op een Oracle ARM64 VPS (gratis tier).
Eén gebruiker, geen publiek, geen scaling, geen multi-user.

- **Repo**: `brionize-nl/DELPHI`
- **Hosting**: Oracle VPS, Caddy reverse proxy
- **AI**: Ollama (lokaal, gratis, onbeperkt)
- **GitHub**: Fine-grained PAT (Contents read+write)
- **Tech**: Vanilla HTML/CSS/JS, geen frameworks, geen build tools

## Huidige staat
Eén `index.html` (~2300 regels) met drie tabs:
- **Chat** — praat met Ollama (presets: Coder, Analyst, Schrijver)
- **Werkplaats** — GitHub branches, PRs, commits (alleen lezen)
- **Launchpad** — links naar tools, projecten, infra

Problemen: geen chat-geheugen, alles in één bestand, werkplaats kan alleen lezen,
geen notificaties, geen automatisering.

---

## Fase 1: Modulair opsplitsen

Splits `index.html` op in losse bestanden. **Geen frameworks, geen build tools.**
Gewoon `<script src="">` en `<link rel="stylesheet">`.

```
public/
├── index.html            ← shell: nav, tabs, layout, geen logica
├── sw.js                 ← service worker (cache versie bumpen bij changes)
├── manifest.json         ← PWA manifest
├── css/
│   └── delphi.css        ← alle styling
├── js/
│   ├── app.js            ← init, tab-switching, gedeelde utilities
│   ├── chat.js           ← chat UI + Ollama API communicatie
│   ├── werkplaats.js     ← GitHub API lezen + schrijven
│   ├── launchpad.js      ← links beheer (localStorage)
│   ├── history.js        ← chat-geheugen (opslaan/laden via server)
│   ├── chains.js         ← ketentaken (prompt-chaining)
│   ├── projects.js       ← project-contexten + systeemprompts
│   ├── inspector.js      ← Ollama watchdog resultaten tonen
│   └── notify.js         ← browser/PWA notificaties
├── data/
│   └── projects.json     ← project-definities + systeemprompts
```

### Regels
- `index.html` bevat ALLEEN de HTML structuur — geen `<script>` logica
- Elk JS bestand is een module met één verantwoordelijkheid
- Gedeelde functies (API calls, DOM helpers) in `app.js`
- CSS in één bestand, georganiseerd per component
- Service worker versie bumpen bij ELKE content-wijziging

### Hoe opsplitsen
1. Knip alle `<style>` uit `index.html` → `css/delphi.css`
2. Knip chat-gerelateerde JS → `js/chat.js`
3. Knip werkplaats JS → `js/werkplaats.js`
4. Knip launchpad JS → `js/launchpad.js`
5. Knip init/tab/utilities → `js/app.js`
6. Wat overblijft in `index.html`: alleen HTML tags + `<script src="">` imports
7. Test: alles werkt exact hetzelfde als voorheen

---

## Fase 2: Chat-geheugen

Chats opslaan op de VPS als JSON bestanden. Geen database.

### Server-kant
Nieuw bestand `server/history.sh` (of Node/Python, wat je wilt):
- `GET /api/history/list` → lijst van opgeslagen chats (bestandsnamen + eerste regel)
- `GET /api/history/{id}` → één chat ophalen
- `POST /api/history` → chat opslaan als JSON
- `DELETE /api/history/{id}` → chat verwijderen

Opslag: `/data/chats/` op de VPS, elk bestand is `{timestamp}.json`:
```json
{
  "id": "2025-01-15T14-30-00",
  "title": "Eerste regel van het gesprek",
  "project": "brionicle",
  "preset": "coder",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### Caddy route
```
handle /api/history/* {
    reverse_proxy localhost:3001
}
```

### Frontend (history.js)
- Zijbalk of dropdown met chatgeschiedenis
- Klik om oude chat te openen en verder te gaan
- Auto-save: elke chat wordt opgeslagen na elk antwoord
- Zoeken in chatgeschiedenis

---

## Fase 3: Project-contexten

Per project een systeemprompt die automatisch naar Ollama gaat.

### data/projects.json
```json
[
  {
    "id": "brionicle",
    "name": "Brionicle",
    "repo": "brionize-nl/Brionicle",
    "description": "Interactieve wereldkaart met live cameras",
    "system": "Je werkt aan Brionicle, een vanilla JS PWA met Leaflet kaart. Geen frameworks. On-demand laden. Zie AGENTS.md voor alle regels.",
    "files": ["AGENTS.md", "blueprint.md"]
  },
  {
    "id": "delphi",
    "name": "DELPHI",
    "repo": "brionize-nl/DELPHI",
    "description": "AI Command Center PWA",
    "system": "Je werkt aan DELPHI, een vanilla JS PWA op Oracle VPS met Ollama. Modulair, geen frameworks.",
    "files": ["DELPHI-BLUEPRINT.md"]
  },
  {
    "id": "sysdash",
    "name": "SysDash",
    "repo": "brionize-nl/sysdash",
    "description": "Systeem monitoring dashboard",
    "system": "Je werkt aan SysDash. Python agents, Supabase, n8n workflows, Discord meldingen.",
    "files": ["docs/BLUEPRINT.md"]
  }
]
```

### Frontend (projects.js)
- Dropdown in chat-tab: kies project
- Bij selectie: systeemprompt wordt automatisch meegestuurd naar Ollama
- Optioneel: relevante bestanden uit de repo ophalen via GitHub API als extra context

---

## Fase 4: Werkplaats uitbreiden (lezen + schrijven)

De Werkplaats-tab kan nu alleen lezen. Uitbreiden met schrijf-acties.

### Nieuwe acties via GitHub API (PAT heeft al Contents read+write):
| Actie | API endpoint | Methode |
|---|---|---|
| Branch aanmaken | `/repos/{owner}/{repo}/git/refs` | POST |
| Bestand lezen | `/repos/{owner}/{repo}/contents/{path}` | GET |
| Bestand bewerken | `/repos/{owner}/{repo}/contents/{path}` | PUT |
| Bestand aanmaken | `/repos/{owner}/{repo}/contents/{path}` | PUT |
| PR openen | `/repos/{owner}/{repo}/pulls` | POST |
| Branches vergelijken | `/repos/{owner}/{repo}/compare/{base}...{head}` | GET |
| Branch mergen | `/repos/{owner}/{repo}/merges` | POST |
| Branch verwijderen | `/repos/{owner}/{repo}/git/refs/heads/{branch}` | DELETE |

### Frontend (werkplaats.js)
- **Code viewer**: bestand selecteren en bekijken met syntax highlighting
- **Edit mode**: bestand bewerken in een textarea, commit message invoeren, committen
- **Branch management**: nieuwe branch, vergelijk met main, merge, verwijder
- **PR management**: PR openen met titel en beschrijving
- **Ollama integratie**: selecteer code → "Ollama, fix dit" → review → commit

### Alle calls gaan via bestaande Caddy route:
```
/api/github/* → strip prefix → reverse_proxy https://api.github.com
```
Met de PAT als Bearer token (al ingericht).

---

## Fase 5: Ketentaken (prompt-chaining)

Automatisch meerdere Ollama-stappen achter elkaar uitvoeren.

### Hoe het werkt
Een "keten" is een lijst van stappen. Output van stap N wordt input van stap N+1.

```json
{
  "name": "Code Review Keten",
  "steps": [
    { "preset": "coder", "prompt": "Analyseer deze code op bugs en problemen:\n\n{{input}}" },
    { "preset": "analyst", "prompt": "Prioriteer deze bevindingen op ernst:\n\n{{input}}" },
    { "preset": "schrijver", "prompt": "Schrijf een duidelijk rapport van deze analyse:\n\n{{input}}" }
  ]
}
```

### Voorgedefinieerde ketens
1. **Code Review**: Analyseer → Prioriteer → Rapport
2. **Bug Fix**: Analyseer error → Schrijf fix → Review fix
3. **Documentatie**: Lees code → Schrijf uitleg → Maak README
4. **Refactor**: Analyseer structuur → Stel verbeteringen voor → Schrijf nieuwe versie

### Frontend (chains.js)
- Keten selecteren of zelf samenstellen
- Input invoeren (code, error, tekst)
- Elke stap toont: status (wachtend/bezig/klaar), output
- Hele keten draait automatisch door
- Eindresultaat kopieerbaar of direct commitbaar via Werkplaats

---

## Fase 6: Browser notificaties

PWA push notifications zonder externe diensten.

### notify.js
- Bij eerste bezoek: vraag notificatie-permissie
- Triggers:
  - Lange Ollama-taak klaar (chat of keten)
  - Watchdog heeft fixes gevonden
  - Keten voltooid
- Notification API: `new Notification('DELPHI', { body: '...' })`
- Werkt op telefoon als PWA geïnstalleerd is

---

## Fase 7: Ollama Watchdog

24/7 automatische code-inspectie en bugfixing voor ALLE projecten.

### Architectuur
```
watchdog.sh (cronjob op VPS, elke 4-6 uur)
      │
      ├── Git fetch per project
      │     ├── brionize-nl/DELPHI
      │     ├── brionize-nl/Brionicle
      │     ├── brionize-nl/sysdash
      │     └── brionize-nl/brionize-ai-framework
      │
      ├── Per bestand (JS/HTML/CSS):
      │     ├── Stuur naar Ollama: "check op bugs, errors, security, dode code"
      │     ├── Ollama vindt iets? → genereer fix
      │     ├── Valideer fix: node --check, syntax, basics
      │     ├── ✅ Pass → commit op {project}-fixes branch
      │     └── ❌ Fail → schrijf rapport naar inspections/{project}/
      │
      └── Stuur samenvatting naar DELPHI API
```

### server/watchdog.sh
```bash
#!/bin/bash
PROJECTS=("DELPHI" "Brionicle" "sysdash" "brionize-ai-framework")
REPOS_DIR="/data/watchdog/repos"
INSPECTIONS_DIR="/data/watchdog/inspections"
OLLAMA_URL="http://localhost:11434/api/generate"

for PROJECT in "${PROJECTS[@]}"; do
    # 1. Fetch latest
    cd "$REPOS_DIR/$PROJECT" && git fetch origin main && git reset --hard origin/main

    # 2. Loop door bestanden
    find . -name "*.js" -o -name "*.html" -o -name "*.css" | while read FILE; do
        # 3. Stuur naar Ollama
        CONTENT=$(cat "$FILE")
        RESPONSE=$(curl -s "$OLLAMA_URL" -d "{
            \"model\": \"codellama\",
            \"prompt\": \"Check deze code op bugs, errors en security issues. Geef alleen gevonden problemen en fixes, niets anders.\n\nBestand: $FILE\n\n$CONTENT\",
            \"stream\": false
        }")

        # 4. Als Ollama een fix voorstelt → valideer en commit
        # (implementatie details in het script)
    done
done
```

### Cronjob
```
0 */4 * * * /opt/delphi/server/watchdog.sh >> /var/log/watchdog.log 2>&1
```

### Regels (hard)
- **Nooit** direct op main pushen — altijd `{project}-fixes` branch
- **Nooit** security-code aanraken (Caddyfile, .env, auth, API keys)
- **Nooit** nieuwe features toevoegen — alleen bugs, errors, dode code
- **Nooit** bestanden verwijderen
- **Altijd** valideren voor commit (`node --check` voor JS)
- **Altijd** rapport schrijven, ook als fix slaagt

### DELPHI Inspectie-tab (inspector.js)

Nieuwe tab of sectie in Launchpad:

```
┌─────────────────────────────────────────────┐
│  🔍 Watchdog Inspectie                      │
│                                             │
│  DELPHI           2 fixes klaar   [Bekijk]  │
│  Brionicle        0 fixes         ✓ schoon  │
│  sysdash          1 fix klaar     [Bekijk]  │
│  ai-framework     0 fixes         ✓ schoon  │
│                                             │
│  Laatste scan: 2 uur geleden                │
│  Volgende scan: over 2 uur                  │
└─────────────────────────────────────────────┘
```

Per project inklikken:
```
┌─────────────────────────────────────────────┐
│  DELPHI — 2 fixes                           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ chat.js — regel 42                    │  │
│  │ Bug: undefined variable 'msg'         │  │
│  │ Fix: 'msg' → 'message'               │  │
│  │                                       │  │
│  │ [Bekijk diff]  [Merge ✓]  [Negeer ✗]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ werkplaats.js — regel 118             │  │
│  │ Bug: missing null check               │  │
│  │ Fix: added if(data) guard             │  │
│  │                                       │  │
│  │ [Bekijk diff]  [Merge ✓]  [Negeer ✗]  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Bekijk diff**: GitHub API `GET /repos/{owner}/{repo}/compare/main...{project}-fixes`
**Merge**: GitHub API `POST /repos/{owner}/{repo}/merges` (base: main, head: fixes)
**Negeer**: GitHub API `DELETE /repos/{owner}/{repo}/git/refs/heads/{project}-fixes`

---

## Bestaande configuratie (niet opnieuw bouwen)

### Caddyfile (al werkend)
- `ollama.brionize.nl` met X-API-Key authenticatie
- `/api/v1/*` → Ollama (localhost:11434)
- `/api/github/*` → GitHub API met Bearer token
- Statische bestanden uit `/opt/ollama-pwa/public/`

### setup.sh (al werkend)
- Placeholder vervanging: `__PROVIDER_API_KEY__` en `__GITHUB_API_KEY__`
- Keys uit `/etc/caddy/provider-api-key` en `/etc/caddy/github-api-key`
- Kopieert bestanden naar `/opt/ollama-pwa/`
- Herstart Caddy

### Service Worker (sw.js)
- Cache naam: `delphi-pwa-vN` — versie bumpen bij ELKE wijziging
- Zonder bump krijgen gebruikers de oude versie

---

## Niet doen (harde regels)

- **Geen frameworks** — geen React, Vue, Angular, Svelte
- **Geen build tools** — geen Webpack, Vite, esbuild
- **Geen database** — JSON bestanden op disk
- **Geen betaalde diensten** — alles gratis
- **Geen koppeling met sysdash** — volledig onafhankelijk
- **Geen koppeling met brionize-ai-framework** — volledig onafhankelijk
- **Geen API keys voor externe AI** — alleen Ollama (lokaal)
- **Geen continuous polling** — on-demand of cronjob
- **Geen scraping** — alleen officiële API's
- **Geen overbodige abstracties** — simpele, rechte code

---

## Bouwvolgorde

Één fase tegelijk. Volledig werkend en getest voordat de volgende begint.

1. **Modulair opsplitsen** — index.html → losse bestanden (geen nieuwe functionaliteit)
2. **Chat-geheugen** — opslaan/laden van gesprekken
3. **Project-contexten** — systeemprompts per project
4. **Werkplaats schrijven** — branches, commits, PRs, merges vanuit de UI
5. **Ketentaken** — prompt-chaining met Ollama
6. **Notificaties** — browser/PWA push notifications
7. **Watchdog** — Ollama 24/7 inspectie + fix + merge vanuit DELPHI

Elke fase sluit de vorige niet uit en breekt de vorige niet.
