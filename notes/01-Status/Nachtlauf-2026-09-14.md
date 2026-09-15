# Nachtlauf 14./15.09.2026 — Auftrag und Plan

**Founder-Auftrag (14.09., vor dem Schlafen):** selbständig weiterarbeiten bis
ca. 15.09.2026, 10:00 deutscher Zeit. Subagenten und die Rollen-Agenten
(CTO, CFO, CCO) nutzen, Schreibstil prüfen, ältere Texte gegen die moderneren
Referenzen halten, die bereitgestellten Repos verwenden, sinnvoll selbst
entscheiden und notieren.

**Reset-fest:** Wer nach einem Kontextverlust hier liest, setzt an der ersten
offenen Zeile fort.

## Beantwortete Fragen (14.09., vor dem Lauf)

| Frage | Antwort |
|---|---|
| Wie prüft Werkant Dokumente? | **Gar nicht automatisch.** Der Founder prüft von Hand im Supabase-Dashboard, und **niemand benachrichtigt ihn** über einen Eingang. Kein Admin-Bildschirm, keine Edge Function. Steht so in `0370_verification_documents.sql`. |
| Muss das nach KI-VO ausgewiesen werden? | Heute **nein** — es gibt kein KI-System. Würden wir die Echtheitsprüfung automatisieren, griffen die Anhang-III-Pflichten, die **seit 02.08.2026 in Kraft** sind. |
| Entscheidung | **Keine KI-Prüfung.** Regelbasierte Vorprüfungen (`if`-Abfragen) nehmen Arbeit ab, ohne zu entscheiden. Kein KI-System nach Art. 3 Nr. 1. |

## Arbeitsliste

- [ ] **A. Prüf-Postfach** — Founder-Bildschirm für die KYC-Freigabe, mit
      Benachrichtigung bei Eingang, Dokumentansicht, Freigabe und Ablehnung
      mit Begründung. Regelbasierte Vorprüfungen, keine KI.
- [ ] **B. Stil-Prüfung älterer Texte** gegen `.claude/design-references/`
      (`warm-editorial`, `airbnb`) und die neun Design-Folien vom 13./14.09.
- [ ] **C. Marktplatz-Abgleich** Airbnb / MyHammer / Check24 → konkrete Lücken,
      keine Oberflächen-Kopie.
- [ ] **D. Offene Kleinigkeit vom 14.09.:** Untergrenze auf `offers.price`
      (ein Auftrag unter 3,00 € ergäbe eine negative Auszahlung).
- [ ] **E. P2B-VO Art. 8 und 9** (Klauseln) — aus dem Rechts-Audit offen.

## Stand 15.09., 00:20 — erledigt

| Block | Kern |
|---|---|
| **A. Prüf-Postfach** ✅ | `/pruefung` in der App, Edge Function `pruefung`, Vorprüfungen in `lib/pruefung.ts`, `health` meldet `pruef_offen` und `pruef_stau`. Doku: `docs/betrieb/pruef-postfach.md`. |
| **Haftpflicht** ✅ | „Haftpflicht verifiziert" war unwahr: das Wort kam im ganzen Code zweimal vor, beide Male als Behauptung. Kein Feld, kein Upload. Dazu die erfundene Antwortzeit „~30 Min.". |
| **Fünf Zusagen** ✅ | „Sie zahlen erst, wenn Sie zufrieden sind" (falsch), „Ausweis verifiziert" (zweimal, einmal an `meister_verified` gebunden), Du-Form im Support-Chat, drei Firmenschreibweisen, „© 2025". |
| **Fristen und Siegel** ✅ | Drei Reklamationsfristen für denselben Fall, ein erfundenes „Eskalationsteam", „PCI DSS Level 1 verschlüsselt" (sachlich falsch), „DSGVO-konform"/„PStTG-konform" als Siegel. |
| **D. `offers.price`** ✅ | Migration 0910, Untergrenze 3,00. Dabei eine eigene Falschbehauptung korrigiert. |
| **Escrow** ✅ | 52 sichtbare Stellen auf „Treuhandkonto" umgestellt, neuer `fachwort-check.py`. |
| **B. Stil-Audit** ✅ | `docs/text/stil-audit-2026-09-14.md`, 25 Befunde. Die schwersten sind abgearbeitet. |
| **C. Marktabgleich** ✅ | `docs/markt/wettbewerbsabgleich-2026-09.md`. MyHammer war hinter Cloudflare, das ist dort offen benannt. |

## Neue Prüfer aus diesem Lauf

| Prüfer | Was er fängt |
|---|---|
| `scripts/fachwort-check.py` | englische Fachwörter in sichtbarem Text |
| `versprechen-check.py` (erweitert) | liest die ganze Oberfläche; abgeleitete Regeln für Haftpflicht, Ausweis und Werbung mit Selbstverständlichkeiten |
| `scripts/kachel-text-check.cjs` | Beschriftung, die INNERHALB ihrer Kachel abgeschnitten wird |

## Noch offen aus den Berichten

- **Leerer Zustand** verspricht nichts („Sie werden benachrichtigt", ohne Frist)
- **Die guten Regeln sind unsichtbar**: nur echte Kunden bewerten (teilweise erledigt über die Vertrauens-Abzeichen), Provision nur bei Abschluss (ebenso)
- **Ortsanker** fehlt: „Deutschlandweit" auf der Startseite, während beide Wettbewerber mit der PLZ beginnen
- **P2B-VO Art. 8 und 9** (Klauseln)
- Kleinere Stil-Befunde aus `docs/text/stil-audit-2026-09-14.md`

## Entscheidungen im Lauf

1. **Keine KI für die Dokumentenprüfung.** Begründung in `lib/pruefung.ts` und
   in der Antwort an den Founder: Haftung plus Anhang III der KI-VO, seit
   02.08.2026 in Kraft. Regelbasierte Vorprüfungen nehmen Arbeit ab, ohne zu
   entscheiden.
2. **Berechtigung im Server, nicht im Bildschirm.** `WERKANT_ADMIN_EMAILS`,
   Standard ist Verweigerung, Antwort 404 statt 403.
3. **Escrow vollständig ersetzen statt halb.** Eine halbe Umstellung zeigt dem
   Nutzer beide Wörter und ist schlechter als konsequente Fachsprache.
4. **`offers.price` als NOT VALID.** Eine Migration, die wegen einer Altlast
   nicht deployt, ist schlimmer als eine Einschränkung, die eine Runde später
   vollständig gilt.
