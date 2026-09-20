# Der Nachbarschaftszweig wurde nie geprüft, und die Selbstauskunft wurde weggeworfen

Stand 20.09.2026, abends. Kein Founder-Befund. Entstanden aus der Frage, warum
`versprechen-check.py` den Meisterpflicht-Fund vom Nachmittag NICHT gefangen
hat. Der Prüfer benennt seine Grenze selbst: „die übrigen Regeln bleiben eine
Liste bekannter Rückfälle. Eine neue unwahre Behauptung fällt NICHT auf."

Also die Klasse einmal von Hand abgefahren: **jede Stelle im sichtbaren Text,
an der Werkant eine Prüfung behauptet.** 62 Fundstellen. Die meisten in
Ordnung. Zwei nicht, und beide betreffen denselben Zweig.

## Befund 1: die Selbstauskunft wurde weggeworfen

`app/onboarding-kyc.tsx` fragt den Nachbarschaftshelfer nach seinem
Geburtsdatum, prüft im Browser gegen `MINDESTALTER` und zeigt bei Bedarf einen
Fehler. Darunter stand „Altersnachweis bestätigt".

Beim Absenden wird `nbDob` **nicht mitgeschickt**. Der Aufruf setzt Name,
Telefon, Bio, Stundensatz, Gewerke und `is_nachbarschaft`. Das Datum lebte in
`useState` und war mit dem Bildschirm weg.

`app/nachbarschaft-profil.tsx` sagte dem Kunden dazu: **„18+ verifiziert"**.

Es gab weder eine Prüfung noch einen Nachweis. Dieselbe Klasse wie die
Widerrufs-Zustimmung am 16.08. („Nachweise gehören in die Datenbank, nicht in
useState") — nur geht es hier darum, wer in eine fremde Wohnung gelassen wird.

## Befund 2: es gab keine Prüfung, in die er hätte kommen können

`submitForReview()` ist der einzige Weg zu `kyc_status = 'in_review'`, und der
Schutz aus 0370/0650 verlangt dafür einen `gewerbeschein_path`. Der
Nachbarschaftszweig ruft die Funktion **gar nicht auf**.

Ein Helfer blieb also dauerhaft auf `'pending'`. Das Pruef-Postfach sah ihn
nie, `provider_public` (nur `approved`) auch nicht, und eine Entscheidung bekam
er nie.

`app/bewerbung-eingegangen.tsx` sagt ihm trotzdem wörtlich zu, geprüft würden
„ihre Profilangaben + 18+-Selbstauskunft". **Beschrieben war eine Prüfung, die
niemand durchführen konnte.**

## Was jetzt dasteht

**0990** legt den Nachweis an und öffnet den Übergang:
- `volljaehrigkeits_erklaerungen`: Wortlaut, Fassung, Zeitpunkt. **Ohne
  Geburtsdatum** — belegt werden muss „diese Person hat am TAG mit DIESEM
  Wortlaut erklärt, volljährig zu sein", und dafür ist das Datum nicht
  erforderlich (Art. 5 Abs. 1 lit. c DSGVO). Wer die Identität wirklich
  braucht, bekommt sie über Stripe bei der Auszahlung, so steht es auch in der
  Datenschutzerklärung.
- Der Schutz aus 0650 wird nicht gelockert, sondern um einen zweiten Fall
  **ergänzt**: Nachbarschaftshelfer, mindestens ein Gewerk, Erklärung liegt
  vor. Ohne Nachweis kein Übergang, sonst wäre die Erklärung wieder optional,
  und optionale Nachweise verschwinden.

Dazu:
- `lib/volljaehrigkeit.ts` mit dem Wortlaut. Er sagt ausdrücklich, dass es eine
  eigene Angabe ist und Werkant sie nicht prüft.
- Der Wortlaut **steht jetzt im Formular**. Einen Text als Nachweis
  festzuhalten, den niemand gesehen hat, wäre derselbe Fehler noch einmal.
- `lib/pruefung.ts` bekommt den Nachbarschaftszweig. **Ohne diese
  Unterscheidung stünde bei jedem Helfer „Kein Gewerbeschein hochgeladen" als
  `sperrt`** — eine Warteschlange, aus der niemand herauskommt.
- Die Texte werden ehrlich: „18+ verifiziert" → „Das Mindestalter von 18 Jahren
  hat der Helfer selbst erklärt; geprüft wird es nicht." Und
  „Altersnachweis bestätigt" → „Angabe vollständig".

## Was das NICHT löst

`/nachbarschaft` zeigt weiterhin **niemanden**. Die Abfrage dort verlangt
zusätzlich `stripe_onboarded = true`, und das schreibt ausschließlich der
Stripe-Webhook beim Connect-Onboarding — ein Weg, der nicht gebaut ist
(`0650`: „Aktuell füllt sie NICHTS"). Das ist ein zweiter, unabhängiger Grund
und bleibt beim Founder.

Der Helfer kann trotzdem Aufträge bekommen und darauf bieten: die
Angebots-Policy verlangt keine Freigabe, und `notify-matching-providers`
filtert nur `available` und `category_ids`. **Sichtbar ist er nicht, bieten
darf er.** Ob das so bleiben soll, ist die offene Founder-Frage aus dem
Handoff vom 18.09. — sie wird durch diesen Block nicht entschieden, aber sie
ist jetzt die einzige verbliebene Unklarheit in diesem Zweig.

## Zweimal in dieselbe dokumentierte Falle

Die Mutationsprobe gegen 0990 ließ zwei Mutationen grün, und beide Male lag es
an meinem Test, nicht am Code:

- **VJ7 lief gegen einen belegten Datensatz.** `helfer_id` ist Primärschlüssel;
  das Ziel hatte seit VJ2 schon eine Zeile. Abgewiesen hat der Unique-Index,
  nicht die Policy — die Mutation „Schreibpolicy erlaubt jeden" blieb deshalb
  grün. **Die Falle steht seit 16.08. in CLAUDE.md**, wörtlich: „Negativtests
  immer gegen einen unbelegten Datensatz fahren, sonst maskiert die Constraint
  eine kaputte Policy."
- **VJ11 scheiterte an der falschen Bedingung.** Ich übergab `fassung: 'v1'`,
  zwei Zeichen, und damit schlug die Prüfung an `fassung` an statt der an
  `angezeigter_text`. Dieselbe Klasse wie 0710: zwei Bedingungen, die denselben
  Fall abdecken.

Dazu kam VJ12: die Bedingung `is_nachbarschaft` in der Schreib-Policy war durch
keine Mutation rot zu bekommen, weil der Guard sie ein zweites Mal prüft.
Entweder ein Test für den Fall, den nur die erste abfängt, oder die Bedingung
gehört weg. Jetzt gibt es den Test.

## Mutationsproben

`0990`: 12 Proben, 10 rot, 2 Gegenproben grün (nach den drei Korrekturen oben).
`volljaehrigkeit.test.ts`: 10 Tests, davon einer ausdrücklich als Gegenprobe
für den unberührten Handwerkszweig.

## Prüfungen

- `bash scripts/db-test/run.sh`: 348 Assertions (12 neu, 5 Gegenproben).
- Jest 43 Suiten / 727 Tests, tsc 0, `deno check` grün.
