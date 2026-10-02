# DECISIONS.md — Besluitenlog

Alle besluiten die tijdens het sparren genomen zijn. Elke AI leest dit eerst.

---

## 2024-10-02 — DELPHI architectuur

**Besluit:** DELPHI wordt modulair herbouwd in 7 fases.
**Reden:** Monolithische index.html (2300 regels) is onwerkbaar voor meerdere AI's.
**Status:** ✅ Doen
**Details:** Zie `DELPHI-BLUEPRINT.md`

---

## 2024-10-02 — Geen koppeling met andere projecten

**Besluit:** DELPHI is volledig onafhankelijk van sysdash en brionize-ai-framework.
**Reden:** Eigenaar wil projecten gescheiden houden. Liever opnieuw bouwen dan afhankelijkheden creëren.
**Status:** ✅ Doen

---

## 2024-10-02 — Ollama als bugfixer

**Besluit:** Ollama mag bugs fixen, niet alleen rapporteren. Fixes worden gevalideerd (node --check) voordat ze gecommit worden op een fixes-branch. Eigenaar merged.
**Reden:** 80% van bugs (syntax, undefined vars, null checks) kan Ollama prima oplossen. Validatie vangt fouten op.
**Status:** ✅ Doen (fase 7)

---

## 2024-10-02 — Merge vanuit PWA

**Besluit:** DELPHI krijgt merge/negeer knoppen in de UI. Geen terminal of GitHub website nodig.
**Reden:** Eigenaar wil alles kunnen doen vanuit de telefoon.
**Status:** ✅ Doen (fase 4 + 7)

---

## 2024-10-02 — Afstuderen van features

**Besluit:** Wanneer een feature volwassen is en onafhankelijk kan draaien, krijgt het een eigen repo.
**Reden:** DELPHI is de werkplaats, niet het eindproduct.
**Status:** ✅ Doen

---

## 2024-10-02 — Eén set regels voor alle AI's

**Besluit:** AGENTS.md en CLAUDE.md zijn identiek. Geen AI krijgt andere regels.
**Reden:** Alle AI's versterken elkaar, ze zijn geen concurrenten.
**Status:** ✅ Doen

---

## Backlog (geparkeerd)

_Nog geen geparkeerde items._

## 2026-10-02 — Resterende blueprint-fasen uitvoeren

**Besluit:** Eigenaar geeft Codex toestemming om fases 2–7 achtereenvolgens te bouwen, te testen en op GitHub klaar te zetten.
**Reden:** De volledige persoonlijke cockpit afronden.
**Aanpak:** Python standaardbibliotheek voor JSON-opslag en watchdog; vanilla JS voor alle UI. Geen diensten of afhankelijkheden met kosten. Bestaande functies behouden, per fase testen, eigen branch en pull request. VPS-uitrol zodra de SSH-verbinding beschikbaar is. Features blijven voorlopig in DELPHI; afstuderen is een afzonderlijk eigenaarsbesluit.
**Impact:** Nieuwe server routes, systemd service en cronjob; bestaande proxy-auth en provider routes blijven behouden. Watchdog mag uitsluitend bestaande bronbestanden verbeteren op een aparte fixes-branch en nooit zelf mergen.
**Prioriteit/scope:** Eerst servergeschiedenis, daarna projectcontext, schrijfacties, ketens, meldingen en watchdog.

## 2026-10-02 — Productie-uitrol en privé-repositorytoegang

**Uitvoering binnen eigenaarsopdracht:** Alle blueprint-fasen op GitHub gemerged en op de bestaande `n8n-vm` uitgerold. De bestaande GitHub-aanmelding van brionize-nl vervangt op de VPS de repo-beperkte sleutel die `brionize-ai-framework` niet kon bereiken. Sleutels blijven in root-managed keyfiles en zijn niet in de repository opgenomen. De vorige configuratie/sleutel zijn root-only gebackupt.
**Modelkeuze:** Bestaande Ollama-modellen hergebruiken; `llama3.1:8b` voor de cronjob. Geen extra download of betaalde dienst.
**Notificaties:** Lokale browser/PWA-meldingen met toestemming na een klik; geen gesloten-app pushdienst. Watchdog-rapporten worden op aanvraag geladen, zonder continue polling.

## 2026-10-02 — Bewijs vóór automatische watchdog-fixes

**Uitvoering binnen de bugfix-regels:** Een live modeltest verzon een typecontrole bij correct JavaScript. Daarom geldt voor automatische commits een onafhankelijk falende syntaxcontrole vóór de wijziging en een geslaagde controle erna. Logische AI-bevindingen verschijnen als onbewezen voorstellen met bronbewijs en diff en vereisen handmatige beoordeling. Modeltekst alleen geldt nooit als bewijs. Dit beperkt automatische reparaties om de harde regel “geen nieuwe features” te kunnen handhaven.

**Aanvulling modelkeuze na live timingtest:** De 8B-inspectie overschreed de begrensde testscan. De productiecron gebruikt nu het reeds aanwezige `llama3.2:latest`; onafhankelijke bewijs- en syntaxcontroles blijven vereist. Geen extra download.
