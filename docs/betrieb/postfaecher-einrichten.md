# Postfächer einrichten — Stand und Anleitung

**Stand 16.08.2026.** Es existiert noch **kein einziges Postfach**. Die App
verwies bis heute an 16 Stellen auf sechs verschiedene Adressen. Keine davon
empfing Post. Wer dem Impressum, der Datenschutzerklärung oder der
Widerrufsbelehrung folgte, schrieb ins Leere.

Das ist inzwischen im Code abgefangen: alle Adressen laufen über **eine**
Konstante, und ein Schalter dort lenkt sie auf **ein** Postfach. Du musst
also nur eines anlegen, nicht sechs.

---

## Was Pflicht ist und was nicht

| Adresse | Wofür | Pflicht? |
|---|---|---|
| `kontakt@` | Impressum, Beschwerde gegen Sperrung (AGB §7(5)) | **Ja** — §5 Abs. 1 Nr. 2 DDG, Art. 11 P2B-VO |
| `datenschutz@` | Auskunft, Löschung, Widerspruch | **Ja** — Art. 13 DSGVO |
| `widerruf@` | Widerrufserklärung | **Ja** — Art. 246a §1 Abs. 2 EGBGB |
| `support@` | allgemeine Hilfe | Nein, aber die häufigste Nennung in der App (11×) |
| `steuer@` | Rückfragen zur PStTG-/DAC7-Meldung | Nein |
| `verify@` | Gewerbeschein, Meisterbrief | Nein |

**Wichtig:** Vorgeschrieben ist eine *erreichbare* Adresse, nicht ein
bestimmter Name davor. Ein einziges Postfach erfüllt alle drei Pflichten.
Sechs Adressen, von denen fünf ins Leere laufen, erfüllen keine davon.

---

## Schritt 1 — ein Postfach anlegen (heute)

Bei deinem Domain-Anbieter für `werkant.de` ein Postfach **`kontakt@werkant.de`**
anlegen. Das ist die Adresse, die schon jetzt im Impressum und in AGB §7(5)
steht — also die, an der am meisten hängt.

Im Code ist nichts zu tun: `constants/legal.ts` steht bereits auf
Ein-Postfach-Betrieb und leitet alle sechs Wege dorthin.

## Schritt 2 — Aliase nachziehen (wenn du magst)

Die meisten Anbieter erlauben Aliase (Weiterleitungen) ohne Zusatzkosten.
`support@`, `datenschutz@`, `widerruf@`, `steuer@`, `verify@` als Alias auf
`kontakt@` legen. Danach in `constants/legal.ts`:

```ts
const EIN_POSTFACH: string | null = null;
```

Ab da zeigt die App wieder die sprechenden Adressen — **ohne dass ein
einziger Bildschirm angefasst werden muss.**

## Schritt 3 — Versandadresse (separat, für Resend)

Die App *empfängt* über die Postfächer oben und *versendet* über Resend. Das
ist eine andere Sache und braucht:

1. Domain `werkant.de` in Resend verifizieren
2. Die DNS-Einträge setzen, die Resend anzeigt (**SPF**, **DKIM**, gern auch
   **DMARC** — ohne die landet die Post im Spam)
3. `WAITLIST_FROM_EMAIL` als Supabase-Secret setzen, z. B.
   `Werkant <noreply@werkant.de>`

**Solange das fehlt**, nutzt der Code den Resend-Testabsender
`onboarding@resend.dev`. Das funktioniert für erste Versuche, ist aber für
echte Kunden nicht tragbar — die Mail kommt sichtbar von einer fremden Domain.

> Der eigentliche Blocker bleibt `RESEND_API_KEY`. Ohne ihn geht **gar keine**
> Mail raus: keine Registrierungsbestätigung (damit keine Anmeldung), keine
> Wartelisten-Bestätigung, und keine Strike-Begründung — die AGB §7(4) und
> Art. 4 P2B-VO auf einem **dauerhaften Datenträger** verlangen. Ein Dashboard
> ist keiner.

---

## Was du noch prüfen solltest

**Die Telefonnummer im Impressum ist ein Platzhalter:** `+49 (0)221 000 000 0`.
§5 Abs. 1 Nr. 2 DDG verlangt Angaben, die eine *unmittelbare Kommunikation*
ermöglichen. Eine Nummer, unter der niemand erreichbar ist, erfüllt das nicht
und ist schlechter als gar keine. Entweder eine echte eintragen oder die Zeile
streichen — nach herrschender Meinung genügt die E-Mail-Adresse allein, wenn
sie zeitnah beantwortet wird.

Ebenfalls noch Platzhalter in `constants/legal.ts`: Geschäftsführer, Straße,
Handelsregisternummer, USt-IdNr. Die beiden letzten stehen ehrlich auf
„in Beantragung" — das ist für eine UG i. Gr. in Ordnung. Name und Anschrift
sind es nicht: sie sind Pflichtangaben und stehen aktuell auf
„[Ihr Name]" und „Musterstraße 1".

---

## Wie es abgesichert ist

`scripts/postfach-check.py` läuft in CI und lehnt jede E-Mail-Adresse ab, die
irgendwo im Produkt geschrieben wird statt über die Konstante zu laufen —
auch in `constants/legal.ts` selbst, außer in der einen Zeile, die den
Schalter setzt.

Das war nötig, weil ein Jest-Test das **nicht** fangen konnte: im
Ein-Postfach-Betrieb ist `MAIL.kontakt` zufällig derselbe Text wie das alte
Literal `'kontakt@werkant.de'`. Ein Rückfall auf das Literal fällt zur
Laufzeit also gar nicht auf — die Mutationsprobe blieb grün. Sichtbar ist er
nur im Quelltext.
