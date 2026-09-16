# PIN beim Arbeitsbeginn — Entwurf, und eine Korrektur meiner eigenen Schätzung

Stand 16.09.2026. **Nicht gebaut.** Dieses Papier sagt, wie es zu bauen wäre
und warum es nicht das ist, was ich am 15.09. geschrieben habe.

## Die Korrektur

In `docs/markt/wettbewerbsabgleich-2026-09.md` steht unter „Was daraus folgt":

> **PIN beim Arbeitsbeginn.** Eine Spalte, ein Bildschirm, ein Beleg.

Das war zu einfach gedacht. Beim Entwerfen fielen drei Dinge auf, die jede für
sich den Nutzen der Funktion aufheben, wenn man sie übergeht.

### 1. Eine Spalte in `contracts` geht nicht

Der Betrieb darf die PIN **nicht lesen können** — sonst beweist sie nichts.
Beide Parteien lesen aber denselben Vertrag: die Leserechte auf `contracts`
gelten zeilenweise, nicht spaltenweise pro Person. PostgreSQL kann ein
Leserecht auf eine Spalte einer *Rolle* entziehen, nicht einer *Zeile*.

Also: eine eigene Tabelle `vertrag_start_pins` mit genau einer Regel —
`select` nur, wenn `auth.uid()` der Auftraggeber des Vertrags ist.

### 2. Vierstellig heißt zehntausend Versuche

Ohne Begrenzung ist eine vierstellige PIN in Sekunden durchprobiert, und der
„Beleg, dass die richtigen zwei Personen zusammengekommen sind" ist wertlos.
Nötig sind: Zählung der Fehlversuche je Vertrag, Sperre nach wenigen
Versuchen, und eine Meldung an den Auftraggeber, wenn jemand es versucht hat.

Das ist derselbe Gedanke wie `enforceRateLimit` bei den Edge Functions, nur
auf Datenbankebene, weil der Vergleich dort stattfinden muss (siehe 3).

### 3. Der Vergleich gehört auf den Server, nicht in die App

Würde die App die PIN holen und selbst vergleichen, könnte der Betrieb sie im
Netzverkehr mitlesen. Der Vergleich gehört in eine `SECURITY DEFINER`-Funktion
`arbeit_beginnen(p_vertrag, p_pin)`, die
- prüft, dass der Aufrufer der Betrieb dieses Vertrags ist,
- die Fehlversuche prüft und hochzählt,
- bei Übereinstimmung `contracts.arbeit_begonnen_am` setzt,
- und ausschliesslich wahr/falsch zurückgibt, nie die PIN.

Dabei gilt die Lehre vom 07.09.: `SECURITY DEFINER` hebelt die Policy der
Tabelle aus, die Einschränkung muss **in der Funktion** stehen. Und das
Ausführungsrecht kommt über `PUBLIC`, nicht über `authenticated` — der
Widerruf muss `from public, anon, authenticated` lauten.

## Was zu bauen wäre

| Teil | Inhalt |
|---|---|
| Migration | `vertrag_start_pins` (vertrag_id, pin, fehlversuche, gesperrt_bis), `contracts.arbeit_begonnen_am`; Trigger erzeugt die PIN beim Anlegen des Vertrags; `arbeit_beginnen()` als einzige Schreibstelle |
| Rechte | PIN lesbar nur für den Auftraggeber; `arbeit_begonnen_am` nur über die Funktion schreibbar (Muster wie 0920/0930) |
| `lib/` | `arbeitBeginnen(vertragId, pin)`, Fehlerfälle als Text, den ein Mensch versteht |
| Kunde | PIN auf dem Vertrags-Bildschirm, mit einem Satz dazu, wozu sie da ist |
| Betrieb | Eingabefeld beim Auftrag, danach sichtbarer Zeitpunkt „Arbeitsbeginn belegt" |

## Prüfungen, die dazugehören

- **DB-Test:** der Betrieb kann die PIN NICHT lesen (Gegenprobe: der Kunde
  kann es); eine falsche PIN setzt nichts; nach N Fehlversuchen ist gesperrt;
  eine richtige PIN nach der Sperre wirkt trotzdem nicht; `arbeit_begonnen_am`
  ist von Hand nicht setzbar.
- **Mutationen:** Leserecht auf die PIN geöffnet, Zähler entfernt, Sperre
  entfernt, Aufrufer-Prüfung entfernt, Zeitstempel vom Client übernommen.
  Jede muss rot werden, plus zwei Gegenproben.
- **Zusage und Mechanismus:** sobald die App irgendwo sagt, wozu die PIN da
  ist, gehört die Aussage in `scripts/agb-code-check.py` — dieselbe Klasse
  wie die 14 Tage aus 0930.

## Was zuerst zu klären ist

1. **Wer nennt wem die Zahl?** Der Kunde dem Betrieb (Uber-Muster) oder
   umgekehrt? Uber wechselte später zum umgekehrten Weg, weil der Fahrgast
   die Zahl oft nicht parat hatte. Für Werkant spricht mehr für den
   Uber-Weg: der Kunde entscheidet, wer die Tür passiert.
2. **Was passiert, wenn niemand die PIN einlöst?** Wenn daraus eine Folge
   erwächst (Hinweis, Prüfsignal, Strike), ist das eine Zusage und braucht
   einen Mechanismus. Wenn nicht, gehört das ausdrücklich hingeschrieben,
   damit niemand später eine Wirkung hineinliest.
3. **Nachbarschaftshilfe auch?** Dort ist der Betrag klein und die Hürde
   zählt mehr als der Beleg.

Punkt 2 ist die eigentliche Produktfrage und keine technische. Sie sollte vor
der ersten Zeile Code entschieden sein.
