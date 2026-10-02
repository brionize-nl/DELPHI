# CLAUDE.md — DELPHI

## Project
DELPHI — AI Command Center. PWA cockpit voor het aansturen van AI-taken via n8n en GitHub.
Eigenaar: Brionize (enige gebruiker).

## Architectuur

```
PWA (ollama.brionize.nl) ←→ n8n (VPS) ←→ GitHub (brionize-nl/DELPHI)
                          ←→ Ollama (localhost:11434)
                          ←→ Caddy (reverse proxy + auth)
```

### Componenten
- **PWA**: `index.html` shell, `css/delphi.css` en losse scripts in `js/` — chat, werkplaats, launchpad
- **Caddy**: reverse proxy met API key auth, routes voor Ollama + toekomstige providers
- **n8n**: workflow engine voor GitHub webhooks, taakbeheer, notificaties
- **Ollama**: lokale LLM server (llama3.2, deepseek-r1:8b, llama3.1:8b)
- **VPS**: Oracle ARM64, Ubuntu, hostname n8n-vm

### Mapstructuur
```
DELPHI/
  public/           ← PWA bestanden (HTML/CSS/JS, icons, SW, manifest)
  workflows/n8n/    ← geexporteerde n8n workflow JSON bestanden
  modelfiles/       ← Ollama Modelfile presets
  Caddyfile         ← reverse proxy template (placeholders, nooit echte keys)
  setup.sh          ← VPS deploy script
```

## Regels

1. **Geen frameworks** — vanilla HTML/CSS/JS, modulair volgens `DELPHI-BLUEPRINT.md`
2. **Geen API keys in code** — Caddy doet auth, setup.sh vervangt placeholders via sed
3. **Geen betaalde diensten** — Ollama is gratis lokaal, n8n is self-hosted
4. **Nederlands** — alle UI tekst in het Nederlands
5. **Dark theme** — bestaande kleuren behouden (CSS :root variabelen)
6. **Responsive** — werkt op mobiel (768px breakpoint)
7. **PWA** — installeerbaar, offline-capable via service worker
8. **Eenvoudig** — geen overbodige abstracties, simpele rechte code

## Deploy
Op de VPS: `sudo bash setup.sh`
- Kopieert `public/` naar `/opt/ollama-pwa/public/`
- Vervangt API key placeholders in Caddyfile
- Herstart Caddy en Ollama

## Niet doen
- Geen Node.js, npm, build tools
- Geen externe JavaScript libraries
- Geen API keys in de repo of frontend
- Geen continuous polling (on-demand)
- Geen breaking changes aan bestaande `/api/*` routes


## Frontend modules

- `app.js`: gedeelde DOM/storage/API helpers, tabs en initialisatie na DOMContentLoaded.
- `chat.js`: gesprekken, providers, streaming, instellingen en chat UI.
- `werkplaats.js`: GitHub overzicht en verversen.
- `launchpad.js`: eigen links in localStorage.
- Klassieke scripts laden in deze volgorde; gedeelde helpers blijven direct beschikbaar. Geen bundler of ES-module imports.
- Bij elke content-wijziging de cacheversie in `public/sw.js` verhogen en nieuwe statische bestanden toevoegen.
