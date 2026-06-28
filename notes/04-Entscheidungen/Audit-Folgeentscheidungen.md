---
typ: entscheidung
datum: 2026-06-28
status: angenommen
---

# Entscheidung: 4 offene Audit-Punkte (autonom entschieden)

Nach dem Screen-für-Screen-Audit blieben 4 Punkte offen, die ich selbst sinnvoll
entschieden und umgesetzt habe (statt nachzufragen).

## 1. Reklamations-SLA → „innerhalb von 2 Werktagen"
**Problem:** Drei widersprüchliche Werte (24 h / 72 h / 2 Werktage).
**Entscheidung:** Einheitlich **„2 Werktagen"** — matcht die WERKR-Garantie-Aussage
und `app/agb.tsx`; konservativ (kein Über-Versprechen wie 24 h).
**Geändert:** Prototyp Reklamation-Screen (72 h → 2 WT, „72h Prüffrist" → „2 Werktage Prüffrist"),
Prototyp + App SupportChat-Bot (24 h → 2 WT).
**Bewusst NICHT geändert:** Verifizierungs-/KYC-SLA (24 h bzw. 24–48 h), Stornofristen
(48 h/24 h), Auszahlungsdauer (1–3 Werktage) — das sind andere Prozesse.

## 2. AuftragAufgeben: redundantes Feld entfernt
**Problem:** Step 2 erfasste „Dringlichkeit" (`urgency`), wurde nirgends verwendet;
Step 3 fragt dasselbe („Wann?") und landet in der Zusammenfassung.
**Entscheidung:** `urgency`-State + UI-Block entfernt. Step 3 (`time`) bleibt die Quelle.

## 3. Support-Mail → support@werkr.de
**Problem:** Support/Hilfe mal `hilfe@`, mal `support@`.
**Entscheidung:** **support@werkr.de** (im Code mit Abstand dominant, 7×). `hilfe@` (2×) ersetzt.
**Bewusst erhalten** (zweckgebunden): datenschutz@, widerruf@, anbieter@, kontakt@, steuer@, streit@ (VSBG).

## 4. Escrow-Banner: €240 → €246
**Problem:** „Escrow … €240 gesichert/gesperrt/eingefroren" unterschlug die Servicegebühr.
**Entscheidung:** Banner zeigen den **tatsächlich hinterlegten Gesamtbetrag €246,00**
(Auftraege, Reklamation, Benachrichtigungen). Der **Auftragswert €240** bleibt überall
dort, wo er als Leistung/Job-Wert gemeint ist (Zahlung-Breakdown, Auszahlungsberechnung).

## Verifikation
- `urgency`-Reste: 0 · `hilfe@`-Reste: 0 · Reklamations-SLA einheitlich · Escrow-Banner €246
- TypeScript 0 Fehler · Jest 308/308 grün.

## Verweise
- [[../01-Status/Projekt-Status]] · [[../01-Status/Go-Live-Blocker]]
