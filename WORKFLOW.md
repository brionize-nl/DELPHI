# WORKFLOW.md — Hoe we werken

## Rollen
- **Product Owner** (Brionize) — komt met ideeën, neemt besluiten, keurt op, merged
- **AI Team** (Claude, Codex, Gemini, Mistral, Ollama) — spart, bouwt, reviewt, inspecteert

## Het vaste proces

Elk nieuw idee of feature doorloopt ALTIJD deze 5 stappen. Geen stap overslaan.

### Stap 1: IDEE
Product Owner komt met een idee of wens.
AI's vragen NIET meteen "zal ik het bouwen?" maar gaan naar stap 2.

### Stap 2: SPARREN
Het team bespreekt het idee op alle facetten:

- [ ] **Wat** — Wat doet het precies? Wat is het eindresultaat?
- [ ] **Waarom** — Welk probleem lost het op? Wat is de meerwaarde?
- [ ] **Hoe** — Technische aanpak? Welke bestanden, welke API's?
- [ ] **Kosten** — Gratis? Past binnen de regels? (geen betaalde diensten)
- [ ] **Impact** — Raakt het bestaande features? Wat kan breken?
- [ ] **Scope** — Hoe groot is het? Opsplitsen in kleinere stukken?
- [ ] **Prioriteit** — Is dit nu nodig, of kan het later?
- [ ] **Afstuderen** — Wordt dit ooit een eigen repo? Wanneer?

Elk punt wordt besproken. Niets overslaan. Pas als alles afgevinkt is → stap 3.

### Stap 3: BESLUIT
De Product Owner beslist:
- ✅ **Doen** — ga bouwen (welke fase, welke AI, welke branch)
- ⏸️ **Parkeren** — goed idee maar nu niet (komt in de backlog)
- ❌ **Niet doen** — met reden

Het besluit wordt vastgelegd in `DECISIONS.md` met datum en reden.
**Pas na een besluit mag er gebouwd worden.**

### Stap 4: BOUWEN
- AI pakt het op volgens de samenwerking-regels (eigen branch, PROGRESS.md updaten)
- Bouwt alleen wat besloten is — niet meer, niet minder
- Bij twijfel: terug naar Product Owner, niet zelf invullen

### Stap 5: OPLEVEREN
- Feature is klaar → AI maakt een **Pull Request** aan op GitHub
- De PR verschijnt in de **Werkplaats-tab** van DELPHI met een Merge-knop
- Product Owner bekijkt de PR daar en klikt op Merge
- Niet goed → terug naar stap 4 met feedback
- Na merge: deployen op de VPS met `cd ~/DELPHI && git pull && sudo bash setup.sh`
- Volwassen en onafhankelijk? → afstuderen naar eigen repo

---

## Als de Product Owner afdwaalt

Het team mag (en moet) zeggen:
> "We zijn nu X aan het bespreken. Wil je dit eerst afmaken, of parkeren we het en pakken we Y op?"

Geen oordeel, gewoon terugsturen naar het proces. De Product Owner waardeert dat.

---

## Backlog

Geparkeerde ideeën komen hier. Niet vergeten, wel georganiseerd.
Zie `DECISIONS.md` voor alle geparkeerde items.
