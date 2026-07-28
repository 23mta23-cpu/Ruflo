# Store-Texte (App Store + Google Play), Deutsch

Fertig zum Einfügen. Jede Aussage ist am Code belegt — Quellen stehen unten
unter „Belegstellen". Stimme wie im Köln-Akquise-Startpaket: faktentreu,
Ehrlichkeit als Argument, keine Superlative.

**Voraussetzung:** Diese Texte werden erst mit dem nativen EAS-Build gebraucht
(`docs/release/APP_STORE_PLAY_STORE_CHECKLIST.md`). Version 1.0.0.

---

## Apple App Store

### Name (max. 30 Zeichen)
```
Werkant – Handwerker finden
```

### Untertitel (max. 30 Zeichen)
```
Geld erst nach Abschluss frei
```

### Werbetext (max. 170 Zeichen, jederzeit ohne Review änderbar)
```
Auftrag beschreiben, Angebote vergleichen, beauftragen. Dein Geld liegt treuhänderisch fest und geht erst an den Betrieb, wenn die Arbeit erledigt ist.
```

### Beschreibung (max. 4.000 Zeichen)
```
Werkant bringt private Auftraggeber und geprüfte Handwerksbetriebe zusammen — mit einem Zahlungsweg, bei dem niemand in Vorleistung gehen muss.

SO LÄUFT EIN AUFTRAG

1. Auftrag beschreiben. Gewerk wählen, Problem schildern, Ort angeben. Ohne Konto starten — anmelden musst du dich erst, wenn du absendest.
2. Angebote erhalten. Passende Betriebe in deiner Umgebung sehen den Auftrag und geben ihren Preis ab. Du vergleichst in Ruhe.
3. Rückfragen stellen. Etwas unklar? Betriebe können vor dem Angebot nachfragen, du antwortest direkt im Chat. Jeder Betrieb hat einen eigenen Gesprächsfaden — die anderen lesen nicht mit.
4. Beauftragen. Mit der Beauftragung zahlst du den Betrag ein. Er liegt treuhänderisch fest (Stripe).
5. Termin abstimmen. Terminvorschläge laufen im Chat, annehmen oder ablehnen mit einem Tippen.
6. Abschließen und bewerten. Erst wenn du den Auftrag abschließt, wird das Geld an den Betrieb ausgezahlt.

WERKANT-GEPRÜFT

Betriebe weisen ihren Gewerbeschein nach. Bei den zehn meisterpflichtigen Gewerken — Heizung & Sanitär, Elektro, Maler, Tischler, Fliesen, Dachdecker, Zimmerer, Maurer, Metallbau, Rollladen — zusätzlich den Meisterbrief. Ohne Upload dieser Nachweise lässt sich die Anbieter-Anmeldung nicht abschliessen.

DIE GEWERKE

Heizung & Sanitär, Elektro, Renovierung, Maler, Tischler, Fliesen, Dachdecker, Zimmerer & Holzbau, Maurer & Betonbau, Metallbau & Schlosserei, Rollladen & Sonnenschutz, Bodenleger, Gebäudereinigung.

NACHBARSCHAFTSHILFE

Für kleinere Aufgaben gibt es einen zweiten Bereich: Garten, Umzugshilfe, Einkaufshilfe, Reinigung, IT-Support, Möbelaufbau sowie Wäsche & Bügeln. Hier helfen Privatpersonen aus der Nachbarschaft, nicht Betriebe — entsprechend ohne Meisterbrief und ohne Gewerbeschein.

WAS ES KOSTET

Als Auftraggeber zahlst du den vereinbarten Preis plus 2,5 % Servicegebühr, mindestens 1,50 €. Bei Nachbarschaftshilfe stattdessen 1,99 € Werkant-Schutz pro Auftrag. Keine Grundgebühr, kein Abo.

FÜR BETRIEBE

Kein Lead-Kauf, keine Vorkasse, keine Laufzeit. 8 % Provision vom Auftragswert, mindestens 3 €, fällig ausschließlich bei einem abgeschlossenen und bezahlten Auftrag. Kein Auftrag heißt keine Kosten. Privatpersonen im Nachbarschaftsbereich zahlen keine Provision.

EHRLICH GESAGT

Werkant startet gerade in Köln und Leverkusen. Wir haben keine Nutzerzahlen, mit denen wir werben könnten, und behaupten das auch nicht. Was wir haben, ist ein Zahlungsweg, der beide Seiten schützt, und eine Prüfung, die den Meisterbrief tatsächlich verlangt.

Der Werkant Schutz ist eine freiwillige Servicezusage — weder eine Garantie im Sinne des § 443 BGB noch eine Versicherung. Abgesichert wird der über Werkant gezahlte Auftragsbetrag bis zum Transaktionslimit. Deine gesetzlichen Gewährleistungsrechte gegenüber dem Betrieb bleiben davon unberührt.
```

### Keywords (max. 100 Zeichen, kommagetrennt, KEINE Leerzeichen nach Komma)
```
elektriker,maler,sanitär,dachdecker,fliesenleger,renovierung,umzug,garten,angebote,betrieb
```

### Was ist neu (Version 1.0.0)
```
Erste Version. Aufträge beschreiben, Angebote vergleichen, im Chat nachfragen, Termine abstimmen und treuhänderisch bezahlen — das Geld geht erst nach Abschluss an den Betrieb.
```

---

## Google Play

### Titel (max. 30 Zeichen)
```
Werkant – Handwerker finden
```

### Kurzbeschreibung (max. 80 Zeichen)
```
Handwerker beauftragen. Zahlung liegt fest, bis der Auftrag erledigt ist.
```

### Vollständige Beschreibung (max. 4.000 Zeichen)
Identisch mit der App-Store-Beschreibung oben. Play erlaubt keine Formatierung
außer Zeilenumbrüchen — die Versalien-Zwischenüberschriften funktionieren dort
genauso.

---

## Was NICHT in die Texte darf

Diese Liste ist kein Stilhinweis, sondern eine Fehlerklasse, die in diesem
Projekt zweimal live gegangen ist (#142, #144: versprochene Ausweisprüfung,
„Trust-Team", Antwortzeiten, „Entscheidung binnen 5 Werktagen"). Alles davon
musste wieder entfernt werden.

| Nicht schreiben | Warum |
|---|---|
| Nutzerzahlen, „tausende Betriebe", „beliebteste …" | Es gibt keine Nutzerbasis. Nachweislich falsch = § 5 UWG. |
| Antwortzeiten, Reaktionszeiten, „Support in 24 h" | Es gibt kein Support-Team mit Schichtplan. |
| „Versicherung", „Garantie", „garantiert" | Der Werkant Schutz ist ausdrücklich beides nicht (`app/garantie.tsx`). |
| „Ausweis geprüft", „Identität verifiziert" | Ausweiskopien werden bewusst NICHT angenommen (§ 20 PAuswG-Risiko, Migration 0370). Identität läuft über Stripe. |
| „Top-Betriebe zuerst", bezahlte Sichtbarkeit | § 2 Abs. 4 AGB schliesst bezahlte Platzierung aus, und im Code gibt es sie nicht — Ranking läuft über Bewertung. |
| Pro-Mitgliedschaft, Premium-Funktionen | Eingefroren (CFO-Entscheid 27.07.), es gibt keinen Kaufweg. |
| Fotos zum Auftrag hochladen | Nur Platzhalter, kommt mit dem nativen Build. |
| Push-Benachrichtigungen als Feature auf iOS | Funktioniert erst mit dem nativen Build, nicht in der Web-Version. |
| Tierbetreuung, Babysitting, Seniorenbegleitung | Bewusst zurückgestellt (Modell-D-Sicherheitslinie), im Katalog nicht buchbar. |

## Belegstellen

| Aussage im Text | Quelle |
|---|---|
| 8 % / min. 3 € Provision, 2,5 % / min. 1,50 € Servicegebühr, 1,99 € Nachbarschaft | `lib/feeEngine.ts`, gegen die DB getestet in `scripts/db-test/escrow.sql` |
| Auszahlung erst nach Abschluss | `supabase/functions/release-escrow/index.ts` |
| 13 Profi-Gewerke, davon 10 meisterpflichtig | `data/categories.ts` (`segment: 'B2B'`, `requiredDocs` mit `MEISTERBRIEF`) |
| 7 Nachbarschafts-Startkategorien | `data/categories.ts` → `NACHBARSCHAFT_STARTKATEGORIEN` |
| Rückfrage vor dem Angebot, getrennte Gesprächsfäden | Migration 0510, `app/chat.tsx` |
| Terminvorschläge im Chat | Migration 0520 |
| Ohne Konto starten, Entwurf überlebt die Anmeldung | `werkr_job_draft_v1`, `__tests__/jobDraft.test.ts` |
| Schutz ist keine Garantie/Versicherung | `app/garantie.tsx` (wörtlich übernommen) |
