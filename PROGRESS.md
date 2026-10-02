# DELPHI — Voortgang

## Fases (uit DELPHI-BLUEPRINT.md)

| Fase | Omschrijving | Status | Door wie |
|------|-------------|--------|----------|
| 1 | Modulair opsplitsen | ✅ Klaar | Codex |
| 2 | Chat-geheugen | ✅ Live op VPS; getest | Codex |
| 3 | Project-contexten | ✅ Live op VPS; getest | Codex |
| 4 | Werkplaats schrijven | ✅ Live op VPS; getest | Codex |
| 5 | Ketentaken | ✅ Live op VPS; getest | Codex |
| 6 | Notificaties | ✅ Live op VPS; getest | Codex |
| 7 | Watchdog | ✅ Live op VPS; getest | Codex |

## Regels voor dit bestand
- Voordat je aan een fase begint: zet status op 🔧 en je naam erbij
- Als je klaar bent: zet status op ✅
- Altijd eerst pullen, dan updaten, dan pushen

## Verificatie 2026-10-02

- Fases 2–7 op `codex/delphi-blueprint-complete`.
- Python HTTP/Git integratietests, volledige browser-QA, mobiele layout, offline-cache en Caddy-configvalidatie geslaagd.
- GitHub/Ollama/browsermeldingen gebruikt als fixtures in browser-QA; echte VPS-integratie volgt bij uitrol.
- Meldingen zijn lokale browser/PWA-meldingen, geen push naar een gesloten app.

## Oplevering 2026-10-02

- PR #2 gemerged: https://github.com/brionize-nl/DELPHI/pull/2
- Productie: https://ollama.brionize.nl — cache `delphi-pwa-v11`.
- Live gecontroleerd: alle publieke assets, auth (401 zonder sleutel), JSON opslag/ophalen/verwijderen, Caddy GitHub-proxy en toegang tot alle vier repositories.
- Live headless browser: echte Ollama-chatstream met `llama3.2:latest`, VPS autosave, GitHub branches en bronbestand, drie echte ketenstappen en de vier inspectieprojecten; geen JS-fouten. Testchats verwijderd.
- Zes Python HTTP/Git-tests ook op de Oracle ARM64 VPS geslaagd.
- Services `caddy`, `ollama`, `delphi-api` en `cron` actief. Watchdog cron: iedere vier uur. Standaardmodel: reeds geïnstalleerde `llama3.1:8b`.
- Eerste beperkte watchdog-scans voor alle vier projecten geslaagd (`--max-files 1 --max-bytes 5000 --model llama3.2:latest`). Rapporten bevatten bevindingen; geen fixes gepubliceerd. Dit is een smoke test, geen volledige audit van alle bestanden.
- Bestaande VPS-sleutel had geen toegang tot de privé-repo `brionize-ai-framework`; de bestaande brionize-nl GitHub-aanmelding is versleuteld over SSH in de beveiligde server-keyfiles gezet. Geen tokens in repo/logs. Vorige sleutel bewaard als root-only backup.
- Werkplaats-schrijf-/merge- en watchdog-fixpaden zijn met gecontroleerde fixtures/lokale Git-repositories getest; de live smoketest heeft geen echte projectcode aangepast.
- Browsermeldingen zijn gebouwd en dispatch is getest. OS-levering/permission op telefoon vereist de eigen browserinstelling; gesloten-app push valt buiten deze implementatie zonder pushdienst.
- Rollbackbackup: `/opt/delphi/backups/20261002T162610Z/`. Credentialbackup: `/opt/delphi/backups/credentials-20261002/`.

## Laatste controles — 2026-10-02

✅ Codex, gemerged via PR #5 en live: watchdog-bevindingen onderbouwen met bronbewijs, extra uitsluiting van sleutel/config-bestanden, begrensde looptijd en live GitHub-schrijfcontrole.

- Werkplaats schrijven volledig live getest via tijdelijke branches en QA-PR #4: UTF-8 create/update, conflicten, cachebump, echte vergelijking, PR, merge en opruimen; main bleef ongewijzigd.
- Watchdog model-hallucinatie aangetoond op correct JavaScript; automatische publicatie nu beperkt tot onafhankelijk bewezen syntaxreparaties. Logische AI-voorstellen blijven expliciet onbewezen en handmatig te beoordelen. Geheim/configbestanden uitgesloten, schema-echo en verkeerd bronbewijs afgewezen.

- Cache v13 live; Caddy/Ollama/JSON-API actief. Nieuwe rollbackbackup: `/opt/delphi/backups/20261002T165126Z/`.
- De Python-tests slagen lokaal én op Oracle ARM64. Browserregressie geslaagd; echte live chatstream, VPS-autosave, GitHub-lezen en 3 Ollama-ketenstappen geslaagd na de uitrol. Geen JavaScript-fouten.
- Alle geconfigureerde projectcontextbestanden zijn met de echte GitHub-API gecontroleerd en bereikbaar. QA-PR #4 is gemerged in een tijdelijke testbranch; beide testbranches zijn verwijderd.

- Watchdog-antwoorden begrensd tot één korte bevinding/edit per bestand, maximaal 1000 uitvoertokens. Browser-ES-modules mogen niet ten onrechte als syntaxfout worden behandeld; klassieke én module-grammatica worden gecontroleerd.

- Bronregels zijn genummerd voor modelreferentie; foutmeldingen onderscheiden afgewezen modelbewijs van transportproblemen. Onbruikbare antwoorden krijgen geen commit en blijven herprobeerbaar.

- Nieuwe v5-smoketest voor alle vier repositories afgerond (`--max-files 1 --max-bytes 4000`). DELPHI/Brionicle: onbewezen AI-voorstellen, niet gecommit; sysdash: geen nieuw geschikt bestand binnen deze kleine testlimiet; brionize-ai-framework: ambigue edit correct afgewezen en herprobeerbaar. Geen fixes-branches gepubliceerd. Normale cronlimiet blijft 20 KB/30 bestanden/45 minuten per project. Dit is geen volledige audit.
- Nul onderzochte bestanden wordt in de UI expliciet als zodanig benoemd.

## Security-uitrol — 2026-10-02

- Claude-securitybranch geïntegreerd: onbekende `/api/*` routes geven 404, bestaande expliciete routes blijven bereikbaar; CSP-header toegevoegd.
- Setup-diagnose gebruikt de expliciete Ollama-route; cache v14 vernieuwt ook de gecachte paginaheaders.
- Publicatie via GitHub-PR, daarna VPS-pull; geen wachtwoordpush op de VPS nodig.

- Live negatieve auth-test vond dat Caddy `handle` vóór `respond` sorteert. Alle routering is nu in een expliciete `route` geplaatst: sleutelcontrole vóór iedere proxy/URI-wijziging. Onauthenticated API-routes moeten allemaal 401 teruggeven, cache v15.

## Feature-briefing 2026-10-02

🔧 Codex: acht features; providers gemerged via PR #10. ✅ Chat-tools gebouwd/getest op `codex/chat-tools`: dicteren (mockresultaten/permission/fallback), sneltoetsen, UTF-8 Markdown-downloads per gesprek en full-text zoeken met 300ms debounce en veilige markering. Daarna vier afzonderlijke PR’s. Feature-merges door eigenaar.

✅ Dashboard gebouwd/getest op `codex/dashboard` (na chat-tools): zesde tab, gespreksteller, inspecties, laatste 5 DELPHI-commits en lokale modellen; onafhankelijk afgehandelde API-fouten, alleen ophalen bij openen/verversen.

✅ Bestand slepen gebouwd/getest op `codex/chat-files`: UTF-8 FileReader, maximaal 100 KB per bestand/sleepactie, tekst/code, concept zonder upload/auto-send, visuele dropfeedback.

✅ Modelvergelijking op `codex/model-compare`: twee lokale modellen, dezelfde context/vraag, parallelle streams, afzonderlijke foutstatus, annuleren en mobiele split-view.
