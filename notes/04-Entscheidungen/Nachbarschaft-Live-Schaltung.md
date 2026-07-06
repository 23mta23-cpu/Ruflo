---
typ: entscheidung
datum: 2026-07-06
status: verbindlich
entscheider: Founder (Tayyip) — Anweisung „Nachbarschaftsthematik ist essenziell,
  damit wir breiter sind neben den Handwerkern"
---

# Nachbarschaft (Modell D+) live geschaltet — Beta-/Demo-Phase

## Entscheidung

`FEATURES.NACHBARSCHAFT` steht ab sofort standardmäßig auf **an**
(`EXPO_PUBLIC_ENABLE_NACHBARSCHAFT !== 'false'`, Kill-Switch dokumentiert im
Flag-File). Damit sind sichtbar: Wizard-Track-Modus, Nachbarschafts-Fallback im
Auftrags-Detail, Helfer-Onboarding (2 Schritte), Startkategorien in Suche/Home,
Landing-Copy-Variante.

Diese Founder-Anweisung (2026-07-06) **ersetzt die Wiederauftau-Kriterien** aus
`Fokus-Schnitt-MVP.md` (≥50 bezahlte Aufträge + eingeleitete DRV-Feststellung)
**für die Beta-/Demo-Phase**. Sie ändert NICHT das Integrationsmodell: Es gilt
weiterhin Modell D+ (bedarfsgetriebener Fallback im selben Trichter), kein
zweiter gleichwertiger Marktplatz (Modell A bleibt verworfen).

## Ehrliche Risiko-Einordnung (CTO-Sicht, festgehalten vor Aktivierung)

- `docs/premortem_werkr.md` Todesursache 1 (Trust-Kollision Meisterbetrieb vs.
  €12/Std.-Helfer) bleibt real. Mitigation: Modell-D-Mechanik (Fallback nur im
  Auftrags-Detail, getrennte Ratings/Badges, 3 Startkategorien, Meisterpflicht-
  und B2B-Ausschluss hart kodiert).
- Aktuell Beta-/Demo-Modus ohne echte Transaktionen → das Risiko ist heute
  gering; es wird real, sobald die Kölner Handwerker-Akquise läuft. **Vor den
  ersten Akquise-Gesprächen prüfen, wie die App auf Handwerker wirkt** —
  Pause-Kriterium der Modell-D-Notiz gilt unverändert (bei Vorbehalten:
  Fallback nur kundenseitig sichtbar halten).
- Vor echtem Geldfluss im Nachbarschafts-Track zwingend: DRV-Statusfeststellung
  einleiten, steuerliche Prüfung PStTG/DAC7, §22 Nr. 3 EStG-Freigrenze
  aktualisiert prüfen, ZAG-Freigabe (identisch Handwerker-Track).

## Unverändert gültig

- Go-/Pause-/Pivot-Kriterien der Modell-D-Notiz.
- `PRO_ABO` bleibt eingefroren.
- Ehrlichkeitsregeln (Demo-Kennzeichnung, keine erfundenen Zahlen).
