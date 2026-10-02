# DELPHI

Persoonlijke AI-cockpit op `https://ollama.brionize.nl`. Vanilla HTML/CSS/JS, Caddy, Ollama en Python standaardbibliotheek. Geen bundler, database of betaalde dienst.

## Gebruik

- **Chat**: kies een project/preset, laad desgewenst repo-context, praat met Ollama. De bestaande provideropties blijven behouden; nieuwe AI-functies gebruiken uitsluitend Ollama.
- **Geschiedenis**: automatisch bewaren op de VPS na wijzigingen/antwoorden. Lokale opslag en een persistente wachtrij houden gesprekken beschikbaar bij verbindingsproblemen. Ververs handmatig om wijzigingen van andere apparaten op te halen. Verwijderde id's blijven als tombstones op de server staan om heropstanding uit oude lokale kopieën te voorkomen. Serverconflicten worden gemeld; een nieuwere serverversie krijgt voorrang bij verversen.
- **Werkplaats**: laad branches, kies een bestand of typ een pad. Bewerk bestaande bestanden met hun SHA, of vink nieuw bestand aan. Commits gaan uitsluitend naar werkbranches. Bekijk de diff vóór merge; de merge gebruikt de bekeken commit. Pull requests vragen naast Contents read/write ook Pull requests read/write op de GitHub PAT. Ollama-voorstellen worden eerst getoond en vereisen expliciet overnemen en committen.
- **Ketentaken**: laad Ollama-modellen, kies een ingebouwde keten of bewaar eigen JSON met 1–10 stappen. `{{input}}` ontvangt de vorige uitvoer. Stoppen breekt het huidige verzoek af. Kopieer het resultaat of zet het in de Werkplaats-editor voor review.
- **Meldingen**: Instellingen → Meldingen toestaan. Lange chats en voltooide ketens kunnen een melding tonen. Nieuwe watchdog-fixes melden bij het ophalen van inspecties. Meldingen werken zolang de app kan uitvoeren; een volledig gesloten app krijgt geen server-push. Er is geen pushdienst of continue polling. Apparaten/browserinstellingen bepalen daadwerkelijke levering. De mobiele route gebruikt [ServiceWorkerRegistration.showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification); toestemming wordt na een klik gevraagd volgens [requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static).
- **Inspectie**: ververs rapporten, bekijk alle verschillen en merge of negeer de volledige fixes-branch. Beveiligingsbestanden en broncode die authenticatie/HTML-injectie afhandelt worden door de watchdog overgeslagen. “Geen nieuwe problemen” betekent alleen dat de gecontroleerde bestanden geen nieuwe bevindingen hadden; scan-aantallen staan in het rapport.

## VPS-installatie

```bash
cd ~/DELPHI
git switch main
git pull --ff-only
sudo bash setup.sh
```

`setup.sh` behoudt de bestaande proxy-routes en voegt `/api/history`, `/api/history/*`, `/api/inspections` en `/api/inspections/*` toe. Nieuwe publieke assetdirectories worden leesbaar voor Caddy gemaakt. De JSON-API draait op `127.0.0.1:3001` als gebruiker `delphi` via `delphi-api.service`; de API controleert ook zelf de Caddy-toegangssleutel. Gesprekken staan in `/data/chats/` (maximaal 8 MB per gesprek), rapporten in `/data/watchdog/inspections/`. Incomplete writes worden atomair vervangen.

API/Caddy-sleutel: `/etc/caddy/ollama-api-key`; installatie maakt een root-managed kopie in `/etc/delphi/api-key`. Het GitHub-token (PAT of bestaande GitHub OAuth-aanmelding) blijft op de VPS. `/etc/delphi/github-key` is uitsluitend voor watchdog Git-auth, nooit onderdeel van een remote-URL, CLI-argument of rapport.

Als `/etc/caddy/github-api-key` bestaat, installeert setup de cronjob in `/etc/cron.d/delphi-watchdog`. Iedere vier uur, als `delphi`, worden de vier blueprint-projecten gescand. Git en Node worden zo nodig via de OS-pakketten geïnstalleerd; Node wordt alleen voor `node --check` gebruikt, niet als backend of build tool. Het model wordt uit de reeds geïnstalleerde Ollama-modellen gekozen. Geen automatische modeldownloads.

Model aanpassen: `/etc/delphi/watchdog.env`, op deze VPS `DELPHI_WATCHDOG_MODEL=llama3.2:latest` (kleiner bestaand model na live timingtest).

```bash
sudo systemctl status delphi-api caddy ollama
sudo -u delphi /opt/delphi/server/watchdog.sh --project DELPHI --dry-run --max-files 1
sudo -u delphi /opt/delphi/server/watchdog.sh --project DELPHI
```

De watchdog gebruikt tijdelijke shallow clones, wijzigt geen bestaande gebruikerscheckouts en pusht uitsluitend `{project}-fixes`, zonder force. Een bestaande fixes-branch wordt niet overschreven. Per run worden maximaal 30 gewijzigde bronbestanden per project bekeken (20 KB per bestand, maximaal 45 minuten per project); volgende runs gaan verder dankzij blobregistratie. Per bestand vraagt de watchdog maximaal één concrete bevinding en één korte edit (1000 uitvoertokens). Elk modelantwoord volgt een JSON-schema met concrete uitleg, exacte broncitaten en unieke tekstvervangingen. Schema-echo’s, verkeerd bronbewijs en ambigue edits worden afgewezen; oude scanregistraties worden bij een protocolwijziging opnieuw beoordeeld. Elk voorstel moet klein zijn en slagen voor syntax/diff-validatie. JavaScript gebruikt `node --check` voor zowel klassieke scripts als ES-modules, HTML controleert scripts en documentafsluiting, CSS controleert delimiters. Dit zijn basiscontroles, geen bewijs van functionele juistheid. Bij DELPHI-fixes wordt de PWA-cacheversie automatisch verhoogd. Er wordt nooit automatisch gemerged. Ieder project krijgt een rapport, ook bij fouten. `--dry-run` schrijft rapporten maar pusht niet en verandert geen scanregistratie. Een lock voorkomt overlappende cronruns.

Log: `/data/watchdog/watchdog.log`. Bewaar een root-only backup van de bestaande publieke bestanden/Caddy-config voor deployment. Maak periodiek backups van `/data/chats` en `/data/watchdog`; rapporten en logs hebben nog geen automatische retentie.

## Tests

```bash
python3 -m unittest discover -s tests -v
bash -n setup.sh server/install.sh server/watchdog.sh
```

De Python-tests gebruiken echte lokale HTTP- en Git-repositories: authenticatie, JSON roundtrip, stale writes, tombstones, inspectiereview, syntaxafwijzing, beschermde bestanden, fixes-branch en cacheversie. Zij pushen nooit naar GitHub.

`tests/browser.cjs` is optionele ontwikkel-QA met een extern beschikbare Playwright-installatie; er worden geen dependencies of npm-configuratie aan de app toegevoegd:

```bash
DELPHI_PLAYWRIGHT=/pad/naar/playwright node tests/browser.cjs
```

De browsertest start de echte Python-historyserver, controleert de cockpit op desktop/mobiel en offline-cache, en gebruikt fixtures voor Ollama/GitHub. Notification-dispatch wordt gecontroleerd met een nagebootste toestemming/delivery-API; echte OS-meldingen moeten op het apparaat worden gecontroleerd.

## Productiestatus

Alle zeven blueprint-fasen zijn op 2026-10-02 uitgerold. Live chat, opslag, drie ketenstappen, GitHub reads en inspectierapporten zijn gecontroleerd. De vier repositories zijn bereikbaar. De cronjob is actief en de eerste beperkte scans hebben rapporten geschreven. Zie `PROGRESS.md` voor testomvang, backups en resterende apparaatcontrole van meldingen.

De watchdog gebruikt [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) en controleert de modelinhoud daarna zelf. Grotere bestanden worden expliciet overgeslagen; een deelrun is zichtbaar in de Inspectie-tab.

Watchdog-bevindingen zijn AI-voorstellen, geen bewezen fouten. Automatische fixbranches vereisen een reproduceerbare syntaxfout vóór de wijziging en een geslaagde controle erna; overige voorstellen verschijnen met bronbewijs en diff voor handmatige beoordeling in Werkplaats. Hiermee kan een verzonnen typecheck of feature geen automatische commit worden.

Productiecontrole (2 oktober 2026): cache v13, Python-tests lokaal en op Oracle ARM64, browserregressie, echte Ollama-chat en drie ketenstappen. GitHub-schrijven is live getest via tijdelijke branches/QA-PR #4, inclusief UTF-8, conflictbewaking, cachebump, compare, merge en opruimen; main werd door deze QA niet gewijzigd. Alle ingestelde projectcontextbestanden zijn bereikbaar. Vergelijkingen gebruiken de echte branchref en `base_commit` van GitHub; wijzigingen aan hoofd- of doelbranch vereisen opnieuw bekijken.

## Nieuwe chat-tools (PR, eigenaar merged)

Dicteren start via de microfoonknop en vult alleen een concept in; Enter verstuurt. Zonder browserondersteuning blijft de knop verborgen. Browsertoestemming en HTTPS zijn vereist. Audio kan door de browser online worden verwerkt; zie [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Headless QA test transcript/permission/fallback met fixtures; echte microfoonherkenning vraagt een geschikte browser en apparaat.

Ctrl/Cmd+Enter verstuurt, Ctrl/Cmd+N opent een gesprek, Ctrl/Cmd+1–5 wisselt tabs en Escape sluit modals. Zoeken doorzoekt titel en berichttekst met 300ms debounce en markeert letterlijke treffers. De downloadknop bij ieder gesprek exporteert UTF-8 Markdown; de bestaande algemene exportknop blijft beschikbaar.

Gemini gebruikt de [officiële OpenAI-compatibiliteitsroute](https://ai.google.dev/gemini-api/docs/openai), met serverauthenticatie. Geen nieuwe sleutels of externe providerverzoeken voor deze features. Browser-QA: `DELPHI_PLAYWRIGHT=/pad/naar/playwright node tests/features.cjs`; bestaande regressie: `node tests/browser.cjs` met dezelfde variabele.
