# Stand 2026-10-04 — Übergabe (kompakt)

Diese Datei ist der AKTUELLE Stand, nicht die Geschichte. Sie bleibt kurz:
beim Abschluss eines Blocks den Abschnitt unten überschreiben, nicht oben
anbauen. Die alte Chronik (54 Stände, 331 KB) liegt in
`docs/archiv/SESSION_HANDOFF-bis-2026-10-01.md`, die Lehren daraus in
`docs/lehren/CHRONIK.md`. Beides nur gezielt mit grep durchsuchen.

## Wo das Produkt steht
- Arbeitszweig `claude/session-handoff-docs-1qxv3d`, rund 145 Commits vor
  `main`. Die Live-Seite (`github.io`) zeigt `main`, also NICHT den Stand hier.
  Founder-Screenshots stammen deshalb oft von einem älteren Stand.
- 54 Bildschirme, 108 Migrationen (bis `1060`), 16 Edge Functions.
- Prüfungen (04.10.): Jest 910, DB-Tests 391, `bash scripts/reisen/run.sh`
  886 PASS, EXIT=0 (mit Reise 24). UI-Mutationen je Block in einem Export
  gemessen, alle rot.
- Zuletzt erledigt (Founder-Screenshots 03.10.): Melden im Chat vor Vertrag
  (1050), Track-Trennung beidseitig (1060: Betrieb bietet nicht auf
  Nachbarschaftshilfe), Angebotskarte rechnet über `calcFees` mit Material,
  Push ohne E-Mail-Adresse, Profiltext „8 % der Arbeitsleistung",
  Vertrag: Widerruf je Track mit § 356 Abs. 4 / § 357a Abs. 2 BGB und
  Knopf „Problem melden".
- 05.10.: Angebotskarte und `/angebot` zeigen Material als eigene Zeile
  (nicht doppelt im Freitext), kein „Anbieter erhält" mehr beim Kunden;
  Vertrag nennt in der Nachbarschaftshilfe den Helfer. Jest 913.
- Support-Assistent „Willi" neu (`lib/supportBot.ts`): Themen gewichtet,
  Antworten je Rolle, Knöpfe zur richtigen Stelle, keine erfundene
  Bewertung, keine Versprechen ohne Daten. Bewusst kein Sprachmodell.
  Reise 24 + `__tests__/supportBot.test.ts`.
- ECC (Everything Claude Code) liegt vollständig unter `~/.claude/ecc`,
  Zugriff über den Skill `ecc` (Index); neuer Container:
  `bash scripts/setup-ecc.sh`. Bewusst nicht nativ installiert (~16.000
  Token pro Anfrage).
- Die 4-Stunden-Weckruf-Routine ist auf Founder-Wunsch **pausiert**
  (`trig_01RPa1JSZJobZcAZd94fk4aL`).

## Bekannte Risiken
- Android-Tastatur im Chat: `KeyboardAvoidingView` nur auf iOS; ab Android
  15 (Edge-to-Edge) kann das Eingabefeld unter der Tastatur liegen. Nur am
  Gerät messbar, Punkt 3 der Geräte-Checkliste.
- Kein vollständiger Vorgang ist je von einem Menschen durchlaufen worden.
- Nachrichten-Policy (0510) lässt einen Betrieb weiter eine Rückfrage an
  einem Nachbarschafts-Auftrag stellen (bewusst, damit Altverträge ihren
  Chat behalten). Bieten kann er dort nicht mehr.
- Widerrufstexte sind Hinweise, keine Rechtsberatung; die Zwei-Verträge-
  Frage (Arbeit + Vermittlung) liegt weiter beim Anwalt
  (`docs/recht/rechts-audit-2026-09-13.md`).

## Offen
- **Punkt 0 dringend:** `WERKANT_ADMIN_EMAILS` setzen. Ein Betrieb wartet
  seit dem 16.09. über der Frist auf seine Freigabe.
- `RESEND_API_KEY`, Stripe, `LEGAL_PLACEHOLDER` (echte Ladungsanschrift),
  EAS-Projekt, Gerätetest (Checkliste auf der Founder-Liste), DAC7, die
  beiden pg_cron-Zeitpläne, Zahlungsmittel speichern ja/nein,
  Transaktionsdaten nach zehn Jahren.
- Antwort erbeten: Angebote nachbessern statt zurückziehen und neu abgeben?
- Antwort erbeten: claude-flow entfernen (MCP-Eintrag verbindet nie, Hooks
  laufen bei jeder Anfrage)?
- Setup-Skript: headroom und caveman sind nur im laufenden Container
  installiert (vier Zeilen stehen in der Antwort vom 28.09.).
- Faktor 2,0 bei großer Schrift, nur falls gewünscht.
- Lücke: `/angebot` (Angebots-Detail beim Kunden) hat keine Browser-Reise.
- Support Stufe 2 nach dem Start: Hilfe-Seite mit denselben Antworten;
  KI-Assistent erst nach AVV/DSGVO-Prüfung und echten Fragen.
- **PR nach `main`**, sobald der Founder den Stand ausliefern will. Erst
  dann sieht er Name, Bewertung und Gebühren auf der Angebotskarte live.
