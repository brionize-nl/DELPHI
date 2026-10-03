# DELPHI — Blueprint v2

## Wat is DELPHI?
Persoonlijke AI Command Center PWA op een Oracle ARM64 VPS (gratis tier).
Eén gebruiker, geen publiek, geen scaling, geen multi-user.

- **URL**: `https://ollama.brionize.nl`
- **Repo**: `brionize-nl/DELPHI`
- **Hosting**: Oracle VPS, Caddy reverse proxy
- **AI**: Ollama (lokaal, gratis, onbeperkt)
- **GitHub**: Fine-grained PAT (Contents read+write)
- **Tech**: Vanilla HTML/CSS/JS, geen frameworks, geen build tools

---

## Huidige staat

Alle 7 blueprint-fasen zijn afgerond en live (2026-10-02). De app heeft 6 tabs:

| Tab | Module | Beschrijving |
|-----|--------|-------------|
| Chat | `chat.js` | Praat met Ollama, presets (Coder/Analyst/Schrijver), project-context, dicteren, sneltoetsen, bestand slepen |
| Werkplaats | `werkplaats.js` + `editor.js` | GitHub branches, bestanden lezen/bewerken, commits, PRs, merges, Ollama-voorstellen |
| Launchpad | `launchpad.js` | Links naar tools, projecten, infra — synct naar VPS |
| Inspectie | `inspector.js` | Watchdog rapporten bekijken, diff, merge of negeer |
| Dashboard | `dashboard.js` | Systeemstatus, gespreksteller, commits, modellen |
| Vergelijking | `compare.js` | Twee Ollama-modellen parallel vergelijken |

### Achtergrondmodules
| Module | Beschrijving |
|--------|-------------|
| `app.js` | Init, tabs, gedeelde utilities (`apiFetch`, `ghFetch`, `logError`), auto-sync |
| `history.js` | Chat-geheugen: opslaan, laden, sync, zoeken, export |
| `chains.js` | Ketentaken: prompt-chaining met Ollama |
| `projects.js` | Project-contexten en systeemprompts |
| `notify.js` | Browser/PWA notificaties |
| `voice.js` | Dicteren via SpeechRecognition |

---

## Architectuur

```
Browser (PWA, vanilla JS)
    ↓
Caddy (ollama.brionize.nl, API key auth)
    ↓
├── Ollama (localhost:11434) — AI chat, ketentaken, watchdog
├── Python API (localhost:3001) — history, settings, inspections
└── GitHub API (via Caddy proxy) — werkplaats, watchdog
    ↓
VPS opslag: /data/chats/, /data/watchdog/inspections/
```

### Beveiliging
- X-API-Key authenticatie via Caddy (`/etc/delphi/api-key`)
- Browser stuurt key mee uit localStorage (`olla_apikey`)
- GitHub PAT alleen op VPS, nooit in frontend
- Caddyfile gebruikt placeholders (`__KEYNAME__`), setup.sh vervangt ze
- CSP-header actief
- Onbekende `/api/*` routes geven 404

---

## Bestandsstructuur

```
DELPHI/
├── public/
│   ├── index.html          ← shell: nav, tabs, layout — GEEN logica
│   ├── sw.js               ← service worker (cache: delphi-pwa-v27)
│   ├── manifest.json
│   ├── icon-192.svg
│   ├── icon-512.svg
│   ├── css/
│   │   └── delphi.css      ← alle styling (dark theme, responsive)
│   ├── js/
│   │   ├── app.js          ← init, tabs, utilities, auto-sync
│   │   ├── chat.js         ← chat UI + Ollama streaming
│   │   ├── werkplaats.js   ← GitHub API lezen + schrijven
│   │   ├── editor.js       ← code editor voor werkplaats
│   │   ├── launchpad.js    ← links beheer + VPS sync
│   │   ├── history.js      ← chat-geheugen (VPS opslag)
│   │   ├── chains.js       ← ketentaken (prompt-chaining)
│   │   ├── projects.js     ← project-contexten + systeemprompts
│   │   ├── inspector.js    ← watchdog resultaten tonen
│   │   ├── notify.js       ← browser/PWA notificaties
│   │   ├── voice.js        ← dicteren (SpeechRecognition)
│   │   ├── dashboard.js    ← systeemstatus, modellen, commits
│   │   └── compare.js      ← modelvergelijking (2 modellen parallel)
│   └── data/
│       └── projects.json   ← project-definities + systeemprompts
├── server/
│   ├── api.py              ← Python API (history, settings, inspections)
│   ├── watchdog.sh          ← Ollama 24/7 inspectie
│   ├── watchdog.py          ← watchdog Python module
│   ├── install.sh           ← VPS installatie
│   ├── delphi-api.service   ← systemd service
│   └── git-askpass.sh       ← Git authenticatie helper
├── tests/
│   ├── *.py                 ← Python HTTP/Git tests
│   ├── browser.cjs          ← Playwright browser QA
│   └── features.cjs         ← Feature-specifieke browser tests
├── Caddyfile               ← template met placeholders
├── setup.sh                ← VPS deploy script
├── AGENTS.md               ← regels voor AI's
├── DELPHI-BLUEPRINT.md     ← dit bestand
├── PROGRESS.md             ← voortgang per fase
├── DECISIONS.md            ← besluitenlog
├── WORKFLOW.md             ← werkproces
└── README.md               ← gebruikersdocumentatie
```

---

## Fases (alle afgerond)

| Fase | Omschrijving | Status |
|------|-------------|--------|
| 1 | Modulair opsplitsen | ✅ Klaar |
| 2 | Chat-geheugen | ✅ Live |
| 3 | Project-contexten | ✅ Live |
| 4 | Werkplaats schrijven | ✅ Live |
| 5 | Ketentaken | ✅ Live |
| 6 | Notificaties | ✅ Live |
| 7 | Watchdog | ✅ Live |

### Extra features (na fases)
- Dicteren, sneltoetsen, Markdown-export, zoeken in geschiedenis
- Dashboard (tab 6)
- Bestand slepen in chat
- Modelvergelijking (twee modellen parallel)
- Watchdog bespreken in chat
- Vergelijking automatisch opslaan
- Error logging en Health Agent
- Welkomtegels en link-sync
- Auto-sync bij terugkeer (visibilitychange)

---

## Infra

| Dienst | Doel | Kosten |
|--------|------|--------|
| Oracle Cloud VPS | ARM64, Ubuntu 24.04 | Gratis tier |
| Caddy | Reverse proxy, TLS, auth | Gratis |
| Ollama | Lokale LLM (llama3.1:8b, llama3.2:latest) | Gratis |
| GitHub API | Werkplaats, watchdog | Gratis (PAT) |
| Python API | History, settings, inspections | Standaardbibliotheek |

**VPS IP**: `84.235.182.106` (hostname: `n8n-vm`)
**VPS paden**: code in `~/DELPHI`, productie in `/opt/ollama-pwa/public/` + `/opt/delphi/server/`
**Services**: `caddy`, `ollama`, `delphi-api`, cron (watchdog elke 4 uur)

---

## Deploy

```bash
cd ~/DELPHI
git switch main
git pull --ff-only
sudo cp -r public/* /opt/ollama-pwa/public/
sudo cp server/api.py /opt/delphi/server/api.py
sudo systemctl restart delphi-api
```

Of met setup.sh (vervangt ook placeholders): `sudo bash setup.sh`

---

## Niet doen (harde regels)

- **Geen frameworks** — geen React, Vue, Angular, Svelte
- **Geen build tools** — geen Webpack, Vite, esbuild
- **Geen database** — JSON bestanden op disk
- **Geen betaalde diensten** — alles gratis
- **Geen API keys in code** — Caddy/setup.sh doet auth
- **Geen continuous polling** — on-demand of cronjob
- **Geen scraping** — alleen officiële API's
