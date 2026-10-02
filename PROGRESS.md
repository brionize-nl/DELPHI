# DELPHI — Voortgang

## Fases (uit DELPHI-BLUEPRINT.md)

| Fase | Omschrijving | Status | Door wie |
|------|-------------|--------|----------|
| 1 | Modulair opsplitsen | ✅ Klaar | Codex |
| 2 | Chat-geheugen | ✅ Gebouwd en lokaal getest; uitrol wacht | Codex |
| 3 | Project-contexten | ✅ Gebouwd en lokaal getest; uitrol wacht | Codex |
| 4 | Werkplaats schrijven | ✅ Gebouwd en lokaal getest; uitrol wacht | Codex |
| 5 | Ketentaken | ✅ Gebouwd en lokaal getest; uitrol wacht | Codex |
| 6 | Notificaties | ✅ Gebouwd en lokaal getest; uitrol wacht | Codex |
| 7 | Watchdog | ✅ Gebouwd en lokaal getest; uitrol wacht | Codex |

## Regels voor dit bestand
- Voordat je aan een fase begint: zet status op 🔧 en je naam erbij
- Als je klaar bent: zet status op ✅
- Altijd eerst pullen, dan updaten, dan pushen

## Verificatie 2026-10-02

- Fases 2–7 op `codex/delphi-blueprint-complete`.
- Python HTTP/Git integratietests, volledige browser-QA, mobiele layout, offline-cache en Caddy-configvalidatie geslaagd.
- GitHub/Ollama/browsermeldingen gebruikt als fixtures in browser-QA; echte VPS-integratie volgt bij uitrol.
- Meldingen zijn lokale browser/PWA-meldingen, geen push naar een gesloten app.
