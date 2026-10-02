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
