# Der Bestätigungslink versprach einen Ablauf, den es nicht gab

*Befund 13.09.2026, beim Durchsehen der Edge Functions ohne ausführbaren Test.*

## Was die Seite sagte und was der Code tat

Bei einem unbekannten Token lieferte `verify-email` wörtlich:

> „Dieser Bestätigungslink wurde bereits verwendet **oder ist abgelaufen**."

Einen Ablauf gab es nicht. Die Abfrage war `.eq("token", token)` und sonst
nichts. `sent_at` wurde beim Versand gespeichert und **nie gelesen**; keine
Aufräumung entfernte alte Zeilen. Ein Link aus einer Mail von vor einem Jahr
hätte unverändert funktioniert.

Das ist dieselbe Klasse wie AGB §7(3) („innerhalb von 12 Monaten"), wo der Code
ohne Datumsgrenze zählte: **eine Zusage im sichtbaren Text, die niemand gegen
den Code gelegt hat.**

## Warum das mehr als ein Textfehler ist

Die Bestätigung ist ein Vertrauens-Tor: `auth_email_confirmed()` entscheidet,
ob jemand Aufträge einstellen und Angebote abgeben darf. Ein unbefristet
gültiger Link in einem alten Postfach oder einer weitergeleiteten Mail hält
dieses Tor dauerhaft offen.

Dazu kam eine stille Datenhaltung: Zeilen von Nutzern, die nie geklickt haben,
blieben mitsamt E-Mail-Adresse für immer liegen (Art. 5 Abs. 1 lit. e DSGVO).

## Entschieden: sieben Tage

Bewusst **nicht kürzer**. Die Mail kann im Spam liegen oder am Wochenende
ungelesen bleiben, und wer den Link verpasst, fordert in der App ohne Umstand
eine neue an — genau das sagt die Seite auch. Ein kurzes Fenster sperrt nur
Menschen aus, ohne einen Angreifer aufzuhalten, der die Mail ohnehin sofort
hatte.

Abgelaufene Zeilen werden beim Aufruf gleich gelöscht: sie tragen eine
E-Mail-Adresse und haben keinen Zweck mehr.

## Zwei Fälle, die man leicht falsch macht

**Unlesbarer Zeitstempel gilt als abgelaufen.** Bei einem Wert, den niemand
deuten kann, ist die sichere Richtung die strengere.

**Ein Zeitstempel aus der Zukunft sperrt nicht aus.** Uhrversatz zwischen
Datenbank und Laufzeit darf einen frischen Link nicht entwerten. Der Fall läuft
über die negative Differenz, nicht über die Frist — sonst gölte so ein Link
sonst ewig.

## Gegenprobe

Sechs Tests (`supabase/tests/verify-email_test.ts`), darunter die Grenze genau
auf der Frist und eine Sekunde darüber. **Mutation:** den Ablauf wieder
ausgebaut (`return true`) — zwei Tests rot, danach zurückgesetzt.
