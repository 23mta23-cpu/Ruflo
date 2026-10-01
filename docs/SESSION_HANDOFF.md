# Stand 2026-10-01 — Übergabe (kompakt)

Diese Datei ist der AKTUELLE Stand, nicht die Geschichte. Sie bleibt kurz:
beim Abschluss eines Blocks den Abschnitt unten überschreiben, nicht oben
anbauen. Die alte Chronik (54 Stände, 331 KB) liegt in
`docs/archiv/SESSION_HANDOFF-bis-2026-10-01.md`, die Lehren daraus in
`docs/lehren/CHRONIK.md`. Beides nur gezielt mit grep durchsuchen.

## Wo das Produkt steht
- Arbeitszweig `claude/session-handoff-docs-1qxv3d`, über 110 Commits vor
  `main`. Die Live-Seite (`github.io`) zeigt `main`, also NICHT den Stand hier.
- 54 Bildschirme, 106 Migrationen (bis `1040`), 16 Edge Functions.
- Prüfungen: Jest 863, DB-Tests 385, `bash scripts/reisen/run.sh` 861 PASS
  (Lauf 63, EXIT=0, 29.09.).
- Zuletzt erledigt: große Systemschrift bis iOS AX1 (Faktor 1,65) ohne
  Überstand; Faktor 2,0 bewusst geparkt (21 von 63, fast nur Kopfleisten).
  Geräte-Checkliste für den Founder. Token-Diät: CLAUDE.md 170 KB auf ~10 KB,
  99 themenfremde Skills/Agenten entfernt, diese Übergabe archiviert.
- Die 4-Stunden-Weckruf-Routine ist auf Founder-Wunsch **pausiert**
  (`trig_01RPa1JSZJobZcAZd94fk4aL`).

## Bekannte Risiken
- Android-Tastatur im Chat: `KeyboardAvoidingView` nur auf iOS; ab Android
  15 (Edge-to-Edge) kann das Eingabefeld unter der Tastatur liegen. Nur am
  Gerät messbar, Punkt 3 der Geräte-Checkliste.
- Kein vollständiger Vorgang ist je von einem Menschen durchlaufen worden.

## Offen
- **Punkt 0 dringend:** `WERKANT_ADMIN_EMAILS` setzen. Ein Betrieb wartet
  seit dem 16.09. über der Frist auf seine Freigabe.
- `RESEND_API_KEY`, Stripe, `LEGAL_PLACEHOLDER` (echte Ladungsanschrift),
  EAS-Projekt, Gerätetest (Checkliste auf der Founder-Liste), DAC7, die
  beiden pg_cron-Zeitpläne, Zahlungsmittel speichern ja/nein,
  Transaktionsdaten nach zehn Jahren.
- Antwort erbeten: Angebote nachbessern statt zurückziehen und neu abgeben?
- Setup-Skript: headroom und caveman sind nur im laufenden Container
  installiert (vier Zeilen stehen in der Antwort vom 28.09.).
- Faktor 2,0 bei großer Schrift, nur falls gewünscht.
- **PR nach `main`**, sobald der Founder den Stand ausliefern will.
