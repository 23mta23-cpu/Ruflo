# Kaltstart: die Gegenrichtung fehlte

**17.09.2026 · Entscheidung als CTO/Solution-Architekt · umgesetzt in 0950**

## Der Befund

`notify-matching-providers` laeuft genau EINMAL, beim Anlegen eines Auftrags.
Danach ruft sie niemand mehr. Daraus folgt eine Aussage auf dem
Kundenbildschirm, die mit jedem Tag falscher wird:

| Zeitpunkt | Wirklichkeit | Was `app/auftrag-detail.tsx` sagte |
|---|---|---|
| Tag 0 | kein passender Betrieb im PLZ-Bereich | „In Ihrer Gegend ist noch kein passender Betrieb dabei" |
| Tag 3 | ein Betrieb hat sich angemeldet, ist freigegeben, sieht den Auftrag sogar in seiner Anfragen-Liste | unveraendert derselbe Satz |

Das ist dieselbe Fehlerklasse wie alles andere in dieser Woche: eine Tatsache
wird als aktuell angezeigt, und es gibt keinen Mechanismus, der sie aktuell
haelt. 0920 hat die Zahl eingefuehrt und genau einen Schreiber dafuer gebaut.

## Die Entscheidung

Gebaut wird die **Gegenrichtung**: nicht nur „Auftrag sucht Betriebe", sondern
auch „Betrieb trifft auf wartende Auftraege". Als **Datenbank-Trigger**, nicht
als Edge Function.

Begruendung fuer den Trigger:

1. Er laeuft in derselben Transaktion wie die Freigabe. Einen freigegebenen
   Betrieb ohne Abgleich kann es damit nicht geben.
2. Er braucht **kein einziges Secret des Founders**. Push und Mail haengen an
   `RESEND_API_KEY` bzw. Stripe; beides fehlt. Ein Weg, der erst spaeter
   funktioniert, ist heute kein Weg.
3. Beide Empfaenger haben seit 0860 bzw. heute eine Glocke, die in den
   Mitteilungs-Bildschirm fuehrt.

## Der Fehler in meinem eigenen ersten Entwurf

Die erste Fassung zaehlte `jobs.benachrichtigte_betriebe` einfach hoch. Beim
**Schreiben des Tests** kam heraus: derselbe Betrieb zaehlt dann zweimal,
sobald er spaeter ein Gewerk dazunimmt, und dreimal, wenn er zwischendurch auf
unsichtbar stand. Der Kunde saehe „3 Betriebe wurden informiert", wo einer
steht.

Ein Zaehler, der nicht weiss, WEN er zaehlt, kann Doppelzaehlung nicht
verhindern. Deshalb `job_benachrichtigungen` (wer wurde ueber welchen Auftrag
informiert) und die Zahl daraus abgeleitet. Sie ist damit nachpruefbar statt
frei laufend. Die Edge Function schreibt denselben Nachweis.

Ich haette den Test fast an die Implementierung angepasst: die Zeile
`if v_a <> 2` stand schon da. Gefunden nur, weil die Zahl beim Hinschreiben
nicht zur Wirklichkeit passte.

## Was gemessen ist

16 Mutationen gegen 0950, jede einzeln, jede zurueckgesetzt. Zwoelf machen
genau eine Zusicherung rot. Vier bleiben gruen, und das ist die Aussage:

* `if not found then continue` verhindert **keine** Doppelzaehlung. Das tut der
  Nachweis. Die Bedingung spart Arbeit, sonst nichts. Steht so im Code.
* Die Uebergangsbedingung ist eine Beschleunigung, keine Absicherung.
* Eine offene Lese-Policy wird schon von `rechte.sql` (RG) abgefangen, bevor
  `kaltstart.sql` ueberhaupt laeuft.

## Was NICHT entschieden wurde

Die Anfragen-Liste des Betriebs zeigt weiterhin **alle** offenen Auftraege des
eigenen Zweigs, ohne Filter auf Gewerk oder Region (20 neueste). Im Kaltstart
ist das Absicht: mehr Sichtbarkeit fuer die wenigen Auftraege, die es gibt.

Die Spannung dabei ist echt und bleibt offen: die neue Mitteilung sagt „in
Ihrem Postleitzahlenbereich", die Liste dahinter ist ungefiltert. Bei wenigen
Auftraegen faellt das nicht auf, ab etwa fuenfzig offenen Auftraegen schon.
Dann gehoert die Liste sortiert (passende zuerst), nicht gefiltert.

## Offene Frage an den Founder (beim Bauen gefunden, NICHT entschieden)

Ein Betrieb **ohne** abgeschlossene Verifizierung kann heute ein Angebot
abgeben. Geprueft im Code, nicht vermutet:

* `offers`-Insert-Policy (zuletzt 0720) verlangt: eigene Kennung, bestaetigte
  E-Mail, weniger als drei aktive Strikes, offener Auftrag, richtiger Zweig.
  **Kein `kyc_verified`.**
* Die Weiche in `app/betrieb/angebot-erstellen.tsx` prueft nur, ob ueberhaupt
  eine `provider_profiles`-Zeile existiert.
* `provider_public` (Suche, Startseite, Profilaufruf) verlangt dagegen
  `available = true and kyc_verified = true`.

Daraus folgt: ein Kunde kann ein Angebot von einem Betrieb bekommen, dessen
Profil er **nicht aufrufen kann**. Das passt schlecht zu „Werkant-geprueft".

Deshalb sind die beiden Benachrichtigungswege heute verschieden streng:
`notify-matching-providers` benachrichtigt jeden verfuegbaren Betrieb, der
Trigger aus 0950 nur freigegebene. Ich habe das **absichtlich nicht
vereinheitlicht**: die Frage dahinter ist eine Produktentscheidung
(„darf ein ungeprueftes Gewerbe bieten?"), und sie um 23 Uhr im Vorbeigehen
zu beantworten hiesse, die Bietregeln fuer alle zu aendern -- ausgerechnet
waehrend ein echter Betrieb auf seine Freigabe wartet.

**Empfehlung:** bieten duerfen nur freigegebene Betriebe, und zwar in der
Policy, nicht nur im Client. Dann werden beide Wege gleich streng. Das
gehoert entschieden, bevor die ersten Kunden echte Angebote sehen.
