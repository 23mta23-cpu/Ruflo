# KI-Leitlinie Werkant

Stand 08.10.2026. Gilt für den Founder, künftige Mitarbeitende und jeden
KI-Agenten in diesem Repository. Hinweise, keine Rechtsberatung.

## 1. Was freigegeben ist
- **Claude Code auf diesem Repository.** Es sieht Code, Testdaten und die
  lokale Test-Datenbank. Keine Produktionsdaten, keine Geheimnisse
  (AGENTS.md: Tests lokal, keine Testkonten in der Produktion, Secrets nur in
  den Dashboards).
- **Im Produkt arbeitet keine KI.** Der Support-Assistent ist regelbasiert
  (`lib/supportBot.ts`), siehe `docs/recht/ki-vo-und-bfsg.md` §1.
- **Ein neuer externer Dienst** (auch eine KI-API) kommt nur mit Eintrag im
  Verarbeitungsverzeichnis, in der Datenschutzerklärung und mit AVV.
  `python3 scripts/abfluss-check.py` schlägt sonst fehl.

## 2. Was nie in ein KI-Werkzeug gehört (auch nicht als Bildschirmfoto)
- Daten echter Kunden und Betriebe: Namen, Adressen, Telefonnummern,
  Chat-Inhalte, Auftragsbeschreibungen.
- Nachweise aus dem Prüf-Postfach: Gewerbeschein, Meisterbrief,
  Steuernummer.
- Zahlungsdaten, Stripe-Auszüge, Verträge echter Parteien.
- Geheimnisse: `service_role`, Stripe-Secret, `RESEND_API_KEY`,
  Admin-Secrets.
- Exporte aus der Produktionsdatenbank.

Für Fehlerbilder: im Prüfstand nachstellen oder die Daten vorher schwärzen.

## 3. Konto-Einstellungen
- In den Datenschutz-Einstellungen von claude.ai die Nutzung der Chats zum
  Modelltraining ausschalten.
- Ein Privatkonto hat keinen AVV. Sollen je Kundendaten mit KI verarbeitet
  werden: geschäftlicher Zugang (Team, Enterprise oder API) mit AVV, und
  erst danach.
- Konnektoren (Gmail, Google Drive) nur verbinden, wenn eine Aufgabe sie
  braucht: sie öffnen der KI das ganze Postfach.

## 4. Wer entscheidet
Im Zweifel nicht eingeben und den Founder fragen. Neue Werkzeuge gibt der
Founder frei und trägt sie hier ein.

## 5. Schulung
Diese Seite beim Einstieg lesen und bestätigen. Zehn Minuten.
