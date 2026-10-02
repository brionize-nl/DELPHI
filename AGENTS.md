# AGENTS.md — DELPHI

## Project
DELPHI — AI Command Center PWA op Oracle ARM64 VPS (gratis tier).
Eigenaar: Brionize (enige gebruiker). Geen publiek, geen scaling.

## Wie werkt hier
Meerdere AI's werken aan deze repo. Iedereen volgt dezelfde regels.

### Samenwerking
1. **NOOIT direct op main pushen** — altijd eigen branch, eigenaar merged
2. **Branch naamgeving**: `{ai}/beschrijving` (bijv. `claude/watchdog`, `codex/modular-split`, `ollama/fixes`)
3. **Check open branches** voordat je begint — niet aan bestanden werken waar een ander mee bezig is
4. **Lees `DELPHI-BLUEPRINT.md`** — dat is het faseplan, volg het

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

### Mapstructuur (doelstructuur na fase 1)
```
DELPHI/
├── public/
│   ├── index.html          ← shell: nav, tabs, layout — GEEN logica
│   ├── sw.js               ← service worker
│   ├── manifest.json
│   ├── css/
│   │   └── delphi.css      ← alle styling
│   ├── js/
│   │   ├── app.js          ← init, tabs, gedeelde utilities
│   │   ├── chat.js         ← chat + Ollama communicatie
│   │   ├── werkplaats.js   ← GitHub API lezen + schrijven
│   │   ├── launchpad.js    ← links beheer
│   │   ├── history.js      ← chat-geheugen
│   │   ├── chains.js       ← ketentaken (prompt-chaining)
│   │   ├── projects.js     ← project-contexten
│   │   ├── inspector.js    ← watchdog resultaten tonen
│   │   └── notify.js       ← browser notificaties
│   └── data/
│       └── projects.json   ← project-definities + systeemprompts
├── server/
│   ├── history.sh          ← chat opslaan/laden als JSON
│   └── watchdog.sh         ← Ollama 24/7 inspectie
├── Caddyfile               ← template met placeholders
├── setup.sh                ← VPS deploy script
└── DELPHI-BLUEPRINT.md     ← volledig faseplan
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

## Niet doen
- Geen Node.js, npm, build tools
- Geen externe JS libraries (tenzij absoluut noodzakelijk, dan CDN)
- Geen API keys in de repo of frontend
- Geen continuous polling — on-demand of cronjob
- Geen breaking changes aan bestaande `/api/*` routes
- Geen features buiten het blueprint — lees `DELPHI-BLUEPRINT.md`
- Niet direct op main pushen
