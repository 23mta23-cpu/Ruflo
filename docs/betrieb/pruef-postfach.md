# Prüf-Postfach: wie eine Verifizierung freigegeben wird

**Angelegt 14.09.2026.** Anlass ist die Founder-Frage: *„Wie prüft es Werkant,
muss ich das dann machen?"*

## Wie es vorher war

Ja, von Hand, und niemand sagte Ihnen Bescheid.

1. Der Betrieb lädt hoch → `kyc_status` springt auf `in_review`
2. Dann passierte nichts
3. Sie hätten ins Supabase-Dashboard gemusst, Storage → `verification-docs`,
   die Datei über die Nutzer-Kennung suchen, herunterladen, ansehen, und
   danach im Table-Editor `kyc_status` auf `approved` setzen

`0370_verification_documents.sql` sagt es wörtlich: *„Anbieter lädt Dokumente
hoch → **Founder prüft**"* und *„liest über service_role (Supabase Dashboard)"*.

## Wie es jetzt geht

**Bildschirm:** `/pruefung` in der App. Anmelden, aufrufen, fertig.

Pro wartendem Betrieb sehen Sie:

- Betriebsname, Gewerk, Kontoname, Wartezeit in Stunden
- Die Dokumente als Links, die **fünf Minuten** gelten (sie zeigen auf einen
  Gewerbeschein, also nicht länger)
- Die **Vorprüfungen**, farbig nach Schwere
- Ein Feld für den Ablehnungsgrund, zwei Knöpfe

**Freigeben** ist gesperrt, solange etwas rot ist.
**Ablehnen** verlangt mindestens 20 Zeichen Begründung (Art. 4 P2B-VO).

Beide Entscheidungen erzeugen eine **Mitteilung an den Betrieb** in
`notifications`. Die Ablehnung ist als `pflicht` markiert und zählt damit in
den Zustell-Rückstand: eine Begründung in einer Spalte ist keine Übermittlung,
das war der Befund aus `0860`.

## Was Sie einmal einrichten müssen

**Eine Umgebungsvariable** in den Supabase Edge Function Secrets:

```
WERKANT_ADMIN_EMAILS = ihre-adresse@example.com
```

Mehrere Adressen durch Komma trennen. **Ist sie nicht gesetzt, ist niemand
Betreiber** und `/pruefung` zeigt „Seite nicht gefunden". Das ist Absicht:
Standard ist Verweigerung, und wer nicht Betreiber ist, soll nicht erfahren,
dass es diesen Weg gibt.

Das Tor steht **im Server**. Der Bildschirm zeigt nur an, was die Edge Function
herausgibt; er entscheidet nichts über Berechtigung.

## Die Vorprüfungen: was sie tun und was nicht

Sie stehen in `lib/pruefung.ts` und sind `if`-Abfragen über Felder, die ohnehin
vorliegen.

| Prüfung | Schwere |
|---|---|
| Kein Gewerbeschein | sperrt |
| Kein gültiges Gewerk | sperrt |
| Meisterpflichtiges Gewerk ohne Meisterbrief (§ 1 HwO Anlage A) | sperrt |
| Betriebsname und Kontoname ohne gemeinsames Wort | ansehen |
| Wartet länger als 48 Stunden | ansehen |
| Grenze eines zulassungsfreien Gewerks | Hinweis |
| Keine Steuer-ID | Hinweis |

**Sie entscheiden nichts.** Ob ein Dokument echt ist, entscheiden Sie.

## Warum keine KI

Ein Modell, das einen Meisterbrief ansieht und „echt" sagt, übernimmt eine
Haftung, die eine UG nicht tragen kann. Es zöge Werkant außerdem in die
Hochrisiko-Pflichten aus **Anhang III der KI-VO (EU) 2024/1689**, die seit dem
**2. August 2026 gelten**: Konformitätsbewertung, Registrierung,
Protokollierung, menschliche Aufsicht, technische Dokumentation.

`if`-Abfragen leiten nichts ab und sind kein KI-System nach Art. 3 Nr. 1.
Keine Ausweispflicht, kein Anhang III. `scripts/ki-einsatz-check.py` wacht
darüber, dass das so bleibt.

## Eine Falle, die die CI gefangen hat

Die Edge Function war fertig, getestet und typgeprüft, und sie wäre **nie
ausgerollt worden**: ein neuer Ordner unter `supabase/functions/` reicht nicht,
er muss in `supabase/config.toml` deklariert sein. Genau dafür gibt es in der
CI einen eigenen Schritt, und er hat zugeschlagen:

```
Function 'pruefung' fehlt in supabase/config.toml — sie wuerde nie deployt werden.
```

Wer hier eine Function ergänzt, ergänzt auch `config.toml`. Der Schritt lässt
sich lokal nachfahren:

```bash
for d in supabase/functions/*/; do n=$(basename "$d"); [ "$n" = "_shared" ] && continue
  grep -q "^\[functions\.$n\]" supabase/config.toml || echo "FEHLT: $n"; done
```

## Was noch fehlt

**Eine aktive Benachrichtigung an Sie.** Heute macht der Rückstand sich nur im
`/health`-Endpunkt bemerkbar:

```json
{ "pruef_offen": 3, "pruef_stau": true }
```

`pruef_stau` wird wahr, sobald etwas länger als 24 Stunden wartet. Eine Mail
an Sie setzt den pg_cron-Zeitplan voraus, der noch nicht eingerichtet ist
(`zustellung_lauf: false` im selben Endpunkt). Sobald der steht, hängt die
Erinnerung daran.
