# AGENTS.md — DELPHI

## Project
DELPHI — AI Command Center PWA op Oracle ARM64 VPS (gratis tier).
Eigenaar: Brionize (enige gebruiker). Geen publiek, geen scaling.

## Wie werkt hier
Meerdere AI's werken aan deze repo. Iedereen volgt dezelfde regels.

### Eerste keer? Lees deze bestanden in volgorde:
1. `AGENTS.md` — regels (dit bestand)
2. `WORKFLOW.md` — het vaste werkproces (5 stappen: idee → sparren → besluit → bouwen → opleveren)
3. `DECISIONS.md` — alle besluiten die al genomen zijn
4. `DELPHI-BLUEPRINT.md` — het technische faseplan
5. `PROGRESS.md` — wie doet wat, wat is klaar

### Samenwerking
1. **NOOIT direct op main pushen** — altijd eigen branch, eigenaar merged
2. **Branch naamgeving**: `{ai}/beschrijving` (bijv. `claude/watchdog`, `codex/modular-split`, `ollama/fixes`)
3. **Check open branches** voordat je begint — niet aan bestanden werken waar een ander mee bezig is
4. **Volg het werkproces** — zie `WORKFLOW.md`, geen stap overslaan
5. **Check besluiten** — zie `DECISIONS.md`, niet opnieuw bespreken wat al besloten is

## Architectuur

```
PWA (ollama.brionize.nl) ←→ Caddy (reverse proxy + API key auth)
                         ←→ Ollama (localhost:11434)
                         ←→ GitHub API (via Caddy, Bearer token)
```

### Componenten
- **PWA**: modulaire vanilla HTML/CSS/JS
- **Caddy**: reverse proxy, API key auth, routes voor Ollama + GitHub API
- **Ollama**: lokale LLM server (gratis, onbeperkt)
- **VPS**: Oracle ARM64, Ubuntu

### Mapstructuur
```
DELPHI/
├── public/
│   ├── index.html          ← shell: nav, tabs, layout — GEEN logica
│   ├── sw.js               ← service worker (cache: delphi-pwa-vN)
│   ├── manifest.json
│   ├── css/
│   │   └── delphi.css      ← alle styling (dark theme, responsive)
│   ├── js/
│   │   ├── app.js          ← init, tabs, utilities, auto-sync
│   │   ├── chat.js         ← chat + Ollama streaming
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
│   ├── watchdog.sh         ← Ollama 24/7 inspectie
│   ├── watchdog.py         ← watchdog Python module
│   ├── install.sh          ← VPS installatie
│   ├── delphi-api.service  ← systemd service
│   └── git-askpass.sh      ← Git authenticatie helper
├── Caddyfile               ← template met placeholders
├── setup.sh                ← VPS deploy script
└── DELPHI-BLUEPRINT.md     ← technische blauwdruk
```

## Regels (voor iedereen, niet-onderhandelbaar)

1. **Geen frameworks** — geen React, Vue, Angular, Svelte
2. **Geen build tools** — geen Webpack, Vite, esbuild, npm
3. **Geen database** — JSON bestanden op disk
4. **Geen betaalde diensten** — alleen gratis (Ollama, GitHub free, Oracle free tier)
5. **Geen API keys in code** — Caddy doet auth, setup.sh vervangt placeholders
6. **Geen koppeling met andere projecten** — DELPHI is onafhankelijk van sysdash en brionize-ai-framework
7. **Nederlands** — alle UI tekst in het Nederlands
8. **Dark theme** — bestaande CSS variabelen behouden
9. **Responsive** — werkt op mobiel (768px breakpoint)
10. **PWA** — installeerbaar, service worker cache (versie bumpen bij ELKE wijziging!)
11. **Modulair** — elk JS bestand doet één ding, index.html bevat alleen HTML
12. **Simpel** — geen overbodige abstracties, rechte code

## Deploy
Op de VPS: `cd ~/DELPHI && git pull && sudo bash setup.sh`

## Service Worker
Cache naam: `delphi-pwa-vN` — **versie bumpen bij ELKE content-wijziging**.
Zonder bump krijgen gebruikers de oude gecachte versie.

## Afstuderen
Wanneer een feature volwassen en werkend is, krijgt die een eigen repo — volledig los van DELPHI.
DELPHI is de werkplaats, niet het eindproduct. Voorbeelden:
- Watchdog → `brionize-nl/watchdog`
- Ketentaken-engine → eigen repo
- DELPHI zelf blijft de cockpit die alles aanstuurt

Criteria voor afstuderen:
1. Feature is volledig werkend en getest
2. Feature kan onafhankelijk draaien zonder de rest van DELPHI
3. Eigenaar beslist wanneer het zover is

## Niet doen
- Geen Node.js, npm, build tools
- Geen externe JS libraries (tenzij absoluut noodzakelijk, dan CDN)
- Geen API keys in de repo of frontend
- Geen continuous polling — on-demand of cronjob
- Geen breaking changes aan bestaande `/api/*` routes
- Geen features buiten het blueprint — lees `DELPHI-BLUEPRINT.md`
- Niet direct op main pushen
