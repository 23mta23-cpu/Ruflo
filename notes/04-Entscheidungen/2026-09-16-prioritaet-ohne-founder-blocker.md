# Was zuerst, wenn die Founder-Blocker liegen bleiben

Stand 16.09.2026, entschieden als CTO/CCO. Anlass: Founder-Frage
„Wie machen wir jetzt weiter ohne erstmal meine Themen?"

## Der Stand, gemessen statt erinnert

`/health` gegen die Produktion:

    stripe: false · mail: false · beide pg_cron-Laeufe aus
    pruef_offen: 1 · pruef_stau: true

Technisch ist das Produkt weit: Geldweg, Vertrag, Abnahme, Bewertungen mit
Antwortrecht, DSA-Meldeweg, Widerruf, Kalender. 486 Browser-Zusicherungen,
668 Tests, 285 DB-Assertions.

Betrieblich steht es still, und zwar an vier Secrets, die nur der Founder
setzen kann.

## Was ich daraus NICHT gemacht habe

**Kein Aufweichen der Betreiber-Pruefung.** `WERKANT_ADMIN_EMAILS` ist der
einzige Weg zur Freigabe, und die leere Liste bedeutet „niemand ist
Betreiber". Eine Alternative ohne Secret waere eine Rechteausweitung: wer
Gewerbescheine, Steuer-IDs und Ausweise sehen darf, wird nicht aus Bequem-
lichkeit erweitert. Das bleibt beim Founder.

**Keine weiteren Pruefer um ihrer selbst willen.** Der Ertrag sinkt sichtbar:
am selben Tag habe ich einen generischen Knopf-Pruefer gebaut, gemessen, und
verworfen (siehe CLAUDE.md, „der generische Knopf-Pruefer, der nicht geht").

**Keine neuen Funktionen aus der Empfehlungsliste.** PIN beim Arbeitsbeginn,
Empfehlungen 6 bis 8: alle sinnvoll, keine davon loest den Engpass.

## Der Engpass ist nicht die Funktionsliste

Es gibt EINEN echten Nutzer in der Produktion: ein Betrieb, der auf seine
Freigabe wartet. Der naechste Schritt des Unternehmens haengt daran, dass
dieser eine Durchlauf funktioniert, nicht daran, dass etwas Weiteres gebaut
wird.

Beim Nachsehen, was passiert, wenn der Founder freigibt:

    Der Betriebsbereich hat fuenf Reiter und KEINEN Weg zu
    /benachrichtigungen.

Dorthin schreiben drei Vorgaenge, die ausschliesslich Betriebe betreffen:

| Vorgang | Quelle | Rechtsgrund |
|---|---|---|
| Freigabe/Ablehnung der Verifizierung | `supabase/functions/pruefung` | Art. 4 P2B-VO bei Ablehnung |
| Strike samt Begruendung | `strike_benachrichtigen()` (0860) | Art. 4 P2B-VO |
| Beschraenkung des Dienstes | `beschraenkung_benachrichtigen()` (0860) | Art. 4 P2B-VO, DSA Art. 17 |

Zwei davon sind geschuldete **Uebermittlungen**, nicht Eintraege in einer
Tabelle. Mailversand ist aus. Der Betrieb haette also von seiner Freigabe
nichts erfahren, und von einem Strike auch nicht.

Das ist dieselbe Klasse wie alles andere in diesem Projekt: etwas ist
gebaut, geprueft und rechtlich sauber, und erreicht den Menschen nicht.

## Entschieden

1. **Der Eingang zu den Mitteilungen** im Betriebs-Dashboard, mit der Zahl
   der ungelesenen. Gebaut, mit Reise 10 belegt (sechs Zusicherungen, eine
   davon Gegenprobe) und gegen den kaputten Zustand gefahren: drei werden rot.
2. **Danach der Kaltstart**: was der Kunde sieht, wenn in seinem
   PLZ-Bereich kein Betrieb frei ist. `0920` haelt die Zahl fest, der
   leere Zustand nennt sie. Ungeprueft ist, was danach passiert.
3. **Erst dann neue Funktionen.**

## Was dabei NICHT geprueft werden kann

Ob Mail und Push hinausgehen, haengt an `zustellung_lauf` (pg_cron, aus) und
`RESEND_API_KEY`. Reise 10 prueft den Weg IN DER APP. Das ist die Haelfte,
die ohne den Founder ueberhaupt pruefbar ist, und sie ist die wichtigere:
eine App, die es zeigt, funktioniert auch ohne Mail.
