---
typ: entscheidung
datum: 2026-07-07
status: verbindlich (CTO-Entscheidung im Arbeitsmodus; Founder kann überstimmen)
entscheider: Claude (per Founder-Anweisung „wähl selbst eine sinnvolle Option und notier sie")
---

# Design: gezielter Konsistenz-Audit statt komplettem Neuentwurf

## Kontext

Founder-Frage 07.07.: „Ist das auch das richtige, du hattest Open Design?!
Oder müssen wir alles auf den Kopf stellen?" — auf Nachfrage präzisiert:
Wunsch nach kompletter Überarbeitung der Designsprache.

## Entscheidung

**Kein kompletter Neuentwurf.** Stattdessen: gezielter visueller
Konsistenz-Audit mit dem `design-review`-Skill („Designer Who Codes" —
Audit + atomare Fixes + Vorher/Nachher-Screenshots) gegen die bestehenden
Design-Tokens (`constants/colors.ts`, `constants/typography.ts`).

## Begründung

1. **Kollidiert mit bestehender Entscheidung:** `docs/SESSION_HANDOFF.md`
   §6 „Do Not Repeat" verbietet explizit ein Redesign akzeptierter Screens
   ohne Nutzersignal oder echten Defekt. Kein Nutzersignal liegt vor
   (0 Anbieter, 0 Transaktionen).
2. **Timing:** Ein Neuentwurf bindet Tage, die aktuell in die Kölner
   Anbieter-Akquise fließen sollten — der eigentliche Engpass laut
   `docs/SESSION_HANDOFF.md` §4.
3. **Kein konkreter Mangel benannt:** Aus den vom Founder geteilten
   Screenshots ist kein visueller Defekt erkennbar — Bone-Palette,
   Hero-Grün, neues Symbol „Das Treffen" wirken konsistent.
4. **Open-Design-Skills waren nie als App-Redesign-Werkzeug gedacht** —
   sie wurden für Dokumente/Artefakte installiert (Akquise-One-Pager,
   Entscheidungsvorlagen), nicht als Ersatz für die verbindliche
   App-Designsprache (minimalist-ui + ui-ux-pro-max,
   `notes/04-Entscheidungen/Design-Sprache-Skills.md`).

## Was stattdessen gemacht wird

`design-review`-Skill-Durchlauf gegen die wichtigsten Screens
(Landing, Home, Onboarding, Login, Wizard) — Fokus: Konsistenz nach dem
heutigen Rebrand (WERKR→Werkant, Symbol „Das Treffen", mehrere
Bugfix-Sessions). Prüft auf Token-Abweichungen (falsche Farben/Gewichte),
nicht auf einen neuen visuellen Stil. Atomare Fixes mit Vorher/Nachher-
Screenshots, keine Layout-Neuentwürfe.

## Eskalationspfad

Falls der Audit gravierende, dem Founder plausible Mängel findet (nicht
nur Kleinigkeiten), wird das explizit gemeldet, bevor größer eingegriffen
wird — kein stillschweigender Rutsch in einen Neuentwurf.
