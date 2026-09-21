# Drei Warteschlangen, die niemand liest, und an einer hängt Geld

Stand 21.09.2026, nachts. Vierte Anwendung derselben Methode, diesmal nicht
auf Texte, sondern auf **Tabellen**: welche Zeilen warten auf eine
Entscheidung, und wer sieht sie?

## Das Ergebnis

| Tabelle | Wer schreibt | Wer liest |
|---|---|---|
| `disputes` (Reklamationen) | `app/reklamation.tsx` | **niemand** (nur der Datenexport des Betroffenen) |
| `inhalts_meldungen` (DSA Art. 16) | Edge Function `inhalts-meldung` | **niemand** (dito) |
| `chat_reports` | `lib/chatReport.ts` | **niemand** |
| `provider_profiles` (KYC) | Onboarding | `/pruefung` seit 14.09. |

Der Datenexport zählt nicht: dort liest ein Betroffener seine eigenen Daten,
kein Betreiber einen Vorgang.

## Warum das bei den Reklamationen kein Höflichkeitsproblem ist

`0770` bricht die automatische Auszahlung mit `dispute_open` ab (Zeile 263)
und lässt Verträge mit offener Reklamation auch aus dem Abnahme-Lauf heraus
(Zeile 155). **Eine offene Reklamation friert den Treuhandbetrag ein.**

Gleichzeitig sagt `app/reklamation.tsx` dem Kunden zu, Werkant prüfe den Fall
„innerhalb von 2 Werktagen" (`REKLAMATION_FRIST_WERKTAGE`).

Die Kette also: Kunde meldet einen Mangel → Geld friert ein → Bildschirm sagt
eine Frist zu → **niemand erfährt, dass es die Meldung gibt** → das Geld
bleibt für beide Seiten liegen, unbefristet.

Bei den Inhalts-Meldungen ist es Art. 16 DSA: eine Meldung entgegennehmen und
nicht bearbeiten ist kein Versäumnis im Ton, sondern eines im Gesetz.

Dieselbe Klasse wie `pruef_offen` am 14.09., und dieselbe wie alles andere in
dieser Woche: gebaut, geprüft, rechtlich sauber formuliert, und erreicht
niemanden.

## Was jetzt dasteht

- `/health` zählt `reklamationen_offen` / `reklamationen_stau` und
  `meldungen_offen` / `meldungen_stau`.
- `.github/workflows/wartet-jemand.yml` meldet alle drei Warteschlangen
  getrennt, mit dem jeweils passenden Satz. Bei den Reklamationen steht die
  Folge dabei: *solange sie offen ist, ist der Treuhandbetrag eingefroren.*
- Der Lauf bleibt still, solange nichts wartet. Das ist der Unterschied
  zwischen einem Alarm und einem Rauschen, und der Grund, warum `health.yml`
  seit dem 06.08. ausgesetzt ist.

**`chat_reports` steht bewusst NICHT im Zähler.** Die Tabelle hat keinen
Erledigt-Zustand (0700: sie ist ein Prüfsignal ohne Auto-Strike). Ein Zähler,
der nur wachsen kann, wird nach zwei Wochen weggeklickt — und dann ist auch
der Rest des Alarms tot.

## Was das NICHT löst, und das ist der ehrliche Teil

**Es gibt weiterhin keinen Bildschirm, auf dem man eine Reklamation
entscheidet.** Der Betreiber sieht jetzt, DASS etwas wartet; handeln muss er
über das Supabase-Dashboard.

Das ist Absicht und keine Bequemlichkeit: eine Entscheidung über eine
Reklamation bewegt Geld (voll erstatten, teilweise, freigeben). Ein
Betreiber-Bildschirm dafür ist ein Produktentwurf mit Geldfolgen, kein
Aufräumen — und den baue ich nicht nachts allein. Dieselbe Linie wie am
16.09. bei `WERKANT_ADMIN_EMAILS`: die Sicherheitsgrenze wird nicht
aufgeweicht, um einen Blocker zu lösen.

**Empfehlung für den nächsten Block:** `/pruefung` um zwei weitere Postfächer
erweitern, zunächst NUR lesend (Fall, Frist, Vertrag, Betrag, Fundstelle).
Sichtbarkeit ist die Hälfte des Problems und hat keine Geldfolgen. Die
Entscheidungswege danach, mit dem Founder.

## Prüfungen

Der Entscheidungsteil des Workflows wurde gegen erfundene `/health`-Antworten
gefahren, 5/5:

| Fall | Erwartet |
|---|---|
| alles leer | still |
| wartende Verifizierung | Alarm |
| offene Reklamation | Alarm |
| unentschiedene Meldung | Alarm |
| **fehlendes Feld** | Alarm, kein stilles Grün |

Der letzte ist der wichtigste: wird `/health` umbenannt oder ist die Function
alt, darf der Wächter nicht schweigen. Genau so war der Health-Check von
PR #144 bis zum 27.07. still grün, ohne je etwas zu prüfen.

**Grenze:** die Zähler selbst laufen in einer Edge Function gegen die
Produktionsdatenbank und sind hier nicht testbar. Geprüft ist die
Entscheidung, nicht die Zählung.
