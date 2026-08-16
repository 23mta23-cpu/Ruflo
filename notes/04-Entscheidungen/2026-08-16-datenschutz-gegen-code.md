# Datenschutzerklärung gegen Code

**Datum:** 2026-08-16 · **Von:** Claude (CTO-Rolle)
**Anlass:** Derselbe Durchgang wie bei den AGB, jetzt für die
Datenschutzerklärung. Sie nennt fünf Speicherdauern — **zwei davon entsprachen
nicht der Wirklichkeit**, eine dritte ist offen.

## 1. „IP-Adressen (Logs): 7 Tage" · BEHOBEN

`rate_limits.key` enthält die IP im Klartext (`ip:1.2.3.4:endpunkt`). Der
Schlüssel ist Primärschlüssel — die Zeile wird bei jedem Aufruf nur
**aktualisiert**, nie gelöscht. Eine IP, die einmal einen geschützten Endpunkt
aufgerufen hat, blieb damit **unbegrenzt** gespeichert.

`check_rate_limit` räumt jetzt bei jedem Aufruf Zeilen älter als 7 Tage ab.
Bewusst **ohne Scheduler**: pg_cron ist hier nicht eingerichtet, und ein
zusätzlicher Cron-Weg wäre ein weiteres Teil, das ausfallen kann, ohne dass es
jemand merkt. Die Funktion läuft ohnehin bei jedem geschützten Endpunkt — also
mindestens so oft, wie neue IPs hinzukommen.

## 2. „Consent-Log: 3 Jahre (Art. 5 Abs. 2 DSGVO)" · BEHOBEN

**Es gab überhaupt kein Consent-Log.** Die DSGVO-Einwilligung lag ausschließlich
im `localStorage` bzw. `AsyncStorage` des Nutzergeräts (`werkr_consent_v1`).

Das heißt: der Nutzer kann sie löschen, und Werkant hatte **nichts** in der
Hand. Art. 7 Abs. 1 DSGVO verlangt aber ausdrücklich, dass der Verantwortliche
die Einwilligung **nachweisen können** muss. Ein Wert auf dem Gerät des
Betroffenen ist kein Nachweis — und die Datenschutzerklärung behauptete
zusätzlich, es werde eines drei Jahre lang geführt.

Das ist **dieselbe Fehlerklasse wie der Widerrufs-Haken** (0710, heute früh):
eine Zustimmung, die nur im Bildschirmzustand existiert und im Streitfall nicht
vorgelegt werden kann. Zweimal am selben Tag, an zwei unabhängigen Stellen.

`dsgvo_consents` (0730) hält jetzt fest: Fassungskennung, **Wortlaut**, die drei
Haken einzeln (Pflicht / Analytics / PStTG), Zeitpunkt — und den Widerruf
(Art. 7 Abs. 3) als Eintrag statt als Löschung, sonst ist genau der Vorgang
hinterher nicht mehr nachweisbar. Der Wortlaut ist per Trigger unveränderlich.

Die Einwilligung wird **vor** der Registrierung eingeholt, deshalb darf auch
`anon` schreiben; ein anonymer Eintrag ist besser als gar keiner. Lesen darf
jeder nur seine eigenen.

## 3. „Chat-Nachrichten: 6 Monate nach Auftragsabschluss" · OFFEN

**Nichts löscht Chat-Nachrichten.** Es gibt keinen Löschlauf, keinen Trigger,
keinen Cron. `messages` wächst unbegrenzt.

**Hier habe ich bewusst nichts gebaut.** Ein automatischer Löschlauf gegen
Produktionsdaten entfernt Inhalte, die Nutzer sehen und auf die sie sich im
Streitfall berufen — das ist keine Entscheidung, die nebenbei in einer
Migration getroffen wird. Drei Dinge müssen vorher geklärt sein:

1. **Was ist „Auftragsabschluss"?** `contracts.status = 'completed'`? Oder auch
   `cancelled`? Nachrichten zu einem Auftrag, über den gestritten wird, dürfen
   nicht verschwinden, während die Reklamation läuft.
2. **Was ist mit Nachrichten ohne Vertrag?** Vor-Vertrags-Rückfragen (0510)
   hängen an keinem Abschluss — für sie nennt die Erklärung gar keine Frist.
3. **Beweislage.** §147 AO verlangt 10 Jahre für Transaktionsdaten. Ein Chat,
   in dem ein Preis vereinbart wurde, ist im Zweifel Teil davon.

Solange das offen ist, ist die Erklärung an dieser Stelle eine Zusage, die
nicht eingehalten wird. Das ist unschön, aber weniger schlimm als
Nachrichten zu löschen, die jemand braucht.

## Geprüft und in Ordnung

| Zusage | Befund |
|---|---|
| Konto-/Profildaten: bis Kontolöschung | `delete-account` existiert |
| Transaktionsdaten: 10 Jahre (§147 AO) | wird nicht gelöscht — richtig so |
| PStTG ab 30 Transaktionen / 2.000 € | `PSTG_TX_THRESHOLD = 30`, `PSTG_REV_THRESHOLD_EUR = 2000` |
| Mindestalter 18 | greift |

## Absicherung

`scripts/db-test/datenschutz-nachweise.sql`, 8 Assertions, in CI.
`scripts/agb-code-check.py` deckt jetzt auch die Datenschutz-Zahlen ab (18 statt 14).

Mutationsproben: IP-Aufräumen entfernt → rot · Aufräumfrist auf 1 Sekunde →
rot · Unveränderlichkeits-Trigger ausgehebelt → rot · select-Policy auf „alle"
→ rot.

### Zwei eigene Fehler beim Absichern

**Die Aufräumfrist auf 1 Sekunde zu setzen blieb zunächst grün.** Grund:
`now()` ist innerhalb einer Transaktion eingefroren, und mein Ratentest führte
alle Aufrufe darin aus — die Zeile war dort nie „älter" als der Schwellwert. In
Produktion liegen Sekunden bis Minuten dazwischen, und eine zu kurze Frist
hätte den Zähler jedes Mal zurückgesetzt: **die Ratenbegrenzung wäre praktisch
abgeschaltet gewesen, ohne dass ein Test rot wird.** Behoben mit einem Test,
der `window_start` künstlich 30 Sekunden in die Vergangenheit setzt.

**Und eine Mutation war schlicht falsch gebaut:** `if false and A or B or C`
schaltet wegen der Bindungsstärke von `AND` nur `A` aus. Der Trigger feuerte
weiter, ich hätte beinahe einen funktionierenden Test für kaputt erklärt. Eine
Mutation, die nicht wirkt, sagt nichts über den Test aus — beim ersten
unerwarteten Grün ist die Mutation selbst zu prüfen, nicht sofort der Test.
