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

## Entscheidungen im Lauf

*(wird fortgeschrieben)*
