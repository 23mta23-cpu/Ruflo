# Auskunft und Löschung werden jetzt mechanisch vollständig gehalten

*13.09.2026. Zwei Prüfer, ein gemeinsames Muster.*

## Das Muster

Beide Funktionen zählen **einzeln auf**, was sie anfassen:

- `export-my-data` listet die Tabellen, die in die Art.-15-Auskunft gehören.
- `delete-account` listet die Profilspalten, die beim Löschen geleert werden.

Eine Aufzählung veraltet lautlos. Kommt eine Tabelle oder eine Spalte dazu und
zieht niemand die Liste nach, läuft die Funktion **weiterhin fehlerfrei durch**
— sie tut nur nicht mehr, was sie verspricht. Es gibt keinen Fehler, keinen
roten Test, kein Signal.

Genau das ist in der Nacht zum 13.09. zweimal passiert: `notifications` fehlte
in der Auskunft, und beim Nachmessen fehlten **acht weitere** Tabellen.

## Die zwei Kriterien

| Prüfer | Regel |
|---|---|
| `auskunft-vollstaendig-check.py` | Zeigt RLS dem Nutzer die Zeile ohnehin, gehört die Tabelle in die Auskunft — oder mit Grund in `nicht_enthalten`. |
| `loeschung-vollstaendig-check.py` | Jede Profilspalte wird beim Löschen geleert — oder nennt den Grund, warum nicht. |

Die Gründe stehen bewusst an unterschiedlichen Orten. Bei der **Auskunft**
gehören sie in die Antwort an den Nutzer: Art. 15 Abs. 1 verlangt Transparenz
darüber, *was* verarbeitet wird, und eine Kategorie wegzulassen, ohne es zu
sagen, wäre die schlechtere Lücke. Bei der **Löschung** gibt es niemanden mehr,
dem man etwas sagen könnte — dort gehört der Grund in den Prüfer.

## Was beim Löschen bewusst stehenbleibt

`delete-account` löscht das Profil nicht, es pseudonymisiert es: HGB §238/§257
verlangen zehn Jahre Aufbewahrung für Finanzbelege, und `contracts` und `jobs`
hängen am Profil.

Von 21 Spalten werden 10 geleert. Die übrigen 11 tragen jetzt jeweils einen
Grund — darunter drei Klassen:

- **Anker und Deutung:** `id`, `role`, `account_type`, `created_at`. Ohne sie
  wäre ein aufbewahrter Beleg nicht mehr zuzuordnen oder nicht mehr zu lesen.
- **PStTG:** `pstg_revenue`, `pstg_tx_count`, `pstg_year`, `pstg_locked`.
  § 2 PStTG verpflichtet zur Meldung ans BZSt.
- **Fremdsystem:** `stripe_customer_id` bleibt ausdrücklich stehen, damit die
  Löschung auf Stripe-Seite noch ausgelöst werden kann.

## Die Spaltenliste stammt aus der Datenbank, nicht aus meiner Annahme

Der erste Auszug fand **13 von 21** Spalten. Aufgefallen ist das nur, weil der
Prüfer eine Untergrenze hat und abbricht, statt eine zu kurze Liste für
vollständig zu halten — dieselbe Vorsichtsmaßnahme wie in `ton-check.py`.

Ursache: `alter table public.profiles` steht oft in einer eigenen Zeile mit
mehreren kommagetrennten `add column` darunter. Der Auszug liest jetzt die
ganze Anweisung bis zum Semikolon — und **nur** die: in `0180` folgt direkt
danach ein `alter table public.jobs` mit `address_city`, das sonst als
Profilspalte gezählt worden wäre.

Gegengeprüft gegen ein Postgres, in das alle Migrationen eingespielt wurden:
21 Spalten, keine fehlt, keine zu viel.

## Gegenproben

| Prüfer | Mutation | Ergebnis |
|---|---|---|
| Auskunft | `notifications` aus dem Export genommen | rot |
| Löschung | `phone` aus der Aufzählung genommen | rot |
| Löschung | neue Spalte `geburtsdatum` in einer Migration | rot |

Die zweite Löschungs-Mutation ist die wichtigere: sie bildet den echten
Hergang nach, nicht das Wegnehmen einer bestehenden Zeile.

**Beim Zurücksetzen dieser Mutation ging etwas schief, und die Kontrolle hat es
gefangen:** die Migration endete ohne Zeilenumbruch, mein angehängter Marker
nahm beim Entfernen einen mit. `git diff --stat` nach der Probe zeigte es;
zurückgesetzt wurde mit `git checkout --`, was hier zulässig war, weil die
Datei außer der Mutation nichts Ungespeichertes trug.

## Grenzen, hingeschrieben

- Der Löschungs-Prüfer sieht, **dass** eine Spalte in der Aufzählung vorkommt,
  nicht **worauf** sie gesetzt wird. `phone: phone` statt `phone: null` fällt
  nicht auf.
- Der Auskunfts-Prüfer prüft die **Tabelle**, nicht die Spalten. Eine neue
  Spalte in einer bereits enthaltenen Tabelle mit ausdrücklicher Spaltenliste
  (`contracts`, `beschraenkungen`) fällt nicht auf.
- Beide lesen die Migrationen, nicht die Produktionsdatenbank.

---

## Nachtrag 13.09.2026: ein Double-Opt-in, das nichts verhinderte

Beim Nachprüfen der eigenen `waitlist-doi`-Änderung fiel etwas Größeres auf.

Die Warteliste hat seit `0360` ein Double-Opt-in: `confirmed_at` wird gesetzt,
wenn jemand den Link in der Mail anklickt. Nachgesehen, **wer diese Spalte
auswertet: niemand.** Es gibt im ganzen Baum keinen Code, der die Warteliste
zum Versand liest — beim Start würde sie von Hand aus dem Supabase-Dashboard
exportiert, und ein Export der Tabelle enthält die unbestätigten Adressen
gleich mit.

Damit war das Double-Opt-in eine Maschinerie, die **nichts verhindert**.
Dieselbe Klasse wie `provider_profiles.strike_count`: ein Wert, der sich setzen
lässt und nicht wirkt. Die Folge wäre hier eine Werbemail an Adressen ohne
Einwilligung, also § 7 Abs. 2 Nr. 3 UWG.

**Kein Verbot, sondern eine bequemere richtige Tür:** `0890` legt die Ansicht
`public.warteliste_versand` an, die ausschließlich bestätigte Einträge zeigt.
Wer beim Start „die Warteliste" exportiert, greift zu ihr, weil sie so heißt.
Der Kommentar an `waitlist.confirmed_at` verweist darauf.

**Eine Ansicht ist dabei ein Rechte-Schlupfloch,** und das war der zweite Teil
der Arbeit: sie läuft mit den Rechten ihres Eigentümers und umgeht die RLS der
Tabelle. Wäre sie für `authenticated` lesbar, könnte jeder Angemeldete die
Wartelisten-Adressen abrufen — und `waitlist` erlaubt absichtlich ein `insert`
für Nichtangemeldete. Deshalb ausdrücklich nur `service_role`.

Drei Tests (WV1 bis WV3), zwei Mutationen: Filter entfernt → WV1 rot, `revoke`
entfernt → WV2 rot.

## Und ein Fehler, den ich mit der eigenen Korrektur eingebaut hatte

Der neue Ablauf in `waitlist-doi` schickte einen abgelaufenen Link auf die
Seite „Dieser Link wurde bereits verwendet … **Sie müssen nichts weiter tun.**"
Wer seinen Link zu spät anklickt, hätte damit geglaubt, er stehe auf der
Warteliste — und stünde nicht drauf.

Eine beruhigende Auskunft an den Falschen ist schlimmer als eine unbequeme an
den Richtigen. Der abgelaufene Fall hat jetzt eine eigene Seite, die sagt, was
zu tun ist.
