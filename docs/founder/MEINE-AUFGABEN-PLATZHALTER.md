# Meine Founder-Aufgaben — Platzhalter zum Ausfüllen

> Alles hier kann NUR der Founder erledigen (externe Konten, echte Firmendaten,
> Secrets, Entscheidungen). Der Code ist fertig. Trage die echten Werte ein und
> hake ab. Reihenfolge = Priorität.

**Stand 27.09.2026**, gemessen gegen die Produktion (`/health`, nur lesend):

| | gemessen |
|---|---|
| `mail` (RESEND) | **false** — Punkt 1 |
| `stripe` / `stripe_webhook` | **false** — Punkt 3 |
| `admin_secret` | true |
| `pruef_offen` | **1**, und `pruef_stau: true` — Punkt 0 |
| `abnahme_lauf` / `zustellung_lauf` | **false** — Punkt 9 |

Die Antwort von `/health` kennt die Felder `reklamationen_*`, `meldungen_*` und
`pstg_*` **nicht**, die im Code längst stehen. Das heißt: die ausgelieferte
Fassung ist älter als der Arbeitszweig. Siehe Punkt 10.

---

## 0. Ein Betrieb wartet SEIT WOCHEN auf seine Freigabe  ☐

Gemessen am 27.09.2026: `pruef_offen: 1`, `pruef_stau: true`. Ein Betrieb hat
sich verifizieren lassen und wartet über der zulässigen Frist. Freigeben kann
ihn **niemand**, denn:

`WERKANT_ADMIN_EMAILS` ist nicht gesetzt. Eine leere Liste heißt im Code
ausdrücklich „niemand ist Betreiber" — das ist so gewollt und wird nicht
aufgeweicht, weil dahinter Gewerbescheine, Steuer-IDs und Ausweise liegen.

- [ ] Supabase → Project Settings → Edge Functions → Secrets:
      `WERKANT_ADMIN_EMAILS = deine@adresse.de` (Komma-getrennt für mehrere)
- [ ] Danach `/pruefung` in der App öffnen und den wartenden Betrieb
      freigeben oder mit Begründung ablehnen (Art. 4 P2B-VO verlangt die
      Begründung, das Formular erzwingt sie)
- Da der Mailversand aus ist (Punkt 1), erfährt der Betrieb von der
  Entscheidung derzeit nur über die Glocke in der App.

---

## 1. RESEND_API_KEY — HARTER BLOCKER (5 Min)  ☐
Ohne diesen Key kann NIEMAND seine E-Mail bestätigen → keine Aufträge, keine Angebote.

- [ ] Bei https://resend.com Konto anlegen, Domain `werkant.de` verifizieren
- [ ] API-Key erzeugen → hier eintragen: `RESEND_API_KEY = ______________________`
- [ ] Supabase → Project Settings → Edge Functions → Secrets → Key eintragen
- [ ] Test: in der App registrieren → Bestätigungsmail muss ankommen

## 2. Firmendaten / Impressum  ☐
Trage die echten Werte ein; danach in `constants/legal.ts` übernehmen und dort
`LEGAL_PLACEHOLDER = false` setzen (sagt mir Bescheid, ich mach das Eintragen).

- Firmenname (voll): `Werkant UG (haftungsbeschränkt)` — bestätigt? ☐  sonst: ____________
- Straße + Nr.:       `________________________`
- PLZ + Ort:          `________________________`
- Vertretungsberechtigt (Geschäftsführer): `________________________`
- Registergericht + HRB-Nr. (nach Eintragung): `________________________`
- USt-IdNr. (falls vorhanden): `________________________`
- Kontakt-E-Mail (Impressum): `________________________`
- Kontakt-Telefon: `________________________`
- In Gründung? (noch nicht im Handelsregister) → JA / NEIN

## 3. Stripe — Zahlungsflow live  ☐
Code fertig (`create-payment-intent`, `stripe-webhook`, `release-escrow`).

- [ ] Stripe-Konto verifizieren, Connect aktivieren (Auszahlungen an Anbieter)
- [ ] `STRIPE_SECRET_KEY = sk_live_______________________`
- [ ] `STRIPE_WEBHOOK_SECRET = whsec_______________________`
- [ ] Beide als Supabase Edge-Function-Secrets setzen
- [ ] Webhook-Endpoint im Stripe-Dashboard auf die Live-Function zeigen lassen
- Ablauf im Detail: `docs/release/LIVE_CUTOVER_RUNBOOK.md`

## 4. Geschäftskonto (für die UG)  ☐
- [ ] Business-Bankkonto eröffnen (z. B. für Stripe-Auszahlungen)
- IBAN: `________________________`
- Bank: `________________________`

## 5. Gewerbe / Behörden  ☐
- [ ] UG beim Notar gründen, Handelsregister-Eintrag abwarten
- [ ] Gewerbeanmeldung beim Gewerbeamt
- [ ] (später) Anwalt: AGB-Prüfung P2B-Verordnung — `constants/legal.ts` prüfen lassen

## 6. DAC7-Jahresmeldung: einmal im Januar, sonst Bußgeld  ☐
Keine Launch-Blockade, aber eine **Frist mit Bußgeld** (§ 13 PStTG: bis zum
31. Januar für das Vorjahr; § 25 PStTG: bis 50.000 €).

Die Funktion dafür gibt es (`pstg-annual-report`), aber sie läuft **nicht von
selbst**: es gibt keinen Zeitplan, der sie aufruft. Seit dem 21.09.2026 meldet
sich der Wächter `wartet-jemand.yml` täglich, sobald etwas offen ist:

- „nichts vorbereitet" → die Funktion wurde nie aufgerufen
- „vorbereitet, aber nicht abgegeben" → die Zeilen stehen in `pstg_reports`,
  die XML-Meldung ging aber nie ans BZSt

Was zu tun ist, wenn der Wächter anschlägt:

- [ ] `WERKANT_ADMIN_SECRET` als Supabase-Edge-Function-Secret setzen (falls
      noch nicht geschehen)
- [ ] Einmal im Januar aufrufen:
      `curl -X POST "$SB/functions/v1/pstg-annual-report" -H "x-admin-secret: …"`
- [ ] XML-Meldung beim BZSt einreichen, danach `submitted_at` in
      `pstg_reports` setzen, sonst bleibt der Wächter zu Recht rot
- [ ] Offene Entscheidung: soll der Aufruf automatisch am 1. Januar laufen?
      Er benachrichtigt die betroffenen Anbieter, also eine Handlung nach
      außen. Deshalb habe ich sie nicht ohne Dein Wort eingerichtet.

## 7. App Store / Play Store (kann später)  ☐
- Checkliste: `docs/release/APP_STORE_PLAY_STORE_CHECKLIST.md`
- [ ] EAS-Projekt anlegen, Screenshots aus echtem Build
- [ ] Privacy-Policy-URL im Store-Formular eintragen

## 8. Optional: Social-Login freischalten  ☐
- Code fertig, zeigt ohne Freischaltung eine saubere Fehlermeldung.
- [ ] Google/Apple OAuth im Supabase-Dashboard aktivieren (Details:
  `docs/todo/OFFENE-FOUNDER-TODOS.md`)

## 9. Die beiden Zeitpläne laufen nicht  ☐

Gemessen: `abnahme_lauf: false`, `zustellung_lauf: false`. Es gibt in der
Datenbank keine pg_cron-Einträge `abnahmefrist-taeglich` und
`zustellung-stuendlich`; im Repo legt sie auch nichts an.

Was daran hängt: die Abnahmefrist gibt Treuhandgeld frei, wenn der Kunde sich
nicht meldet, und die Zustellung bringt Pflichtmitteilungen heraus
(DSA Art. 17, Art. 4 P2B-VO). Beides steht still.

- [ ] Entscheiden, ob pg_cron in dieser Supabase-Instanz eingerichtet wird
- [ ] Falls ja: die beiden Zeitpläne anlegen (Namen wie oben, sonst findet die
      Selbstauskunft sie nicht)
- Ablesbar ist der Zustand jederzeit unter `/pruefung`, Abschnitt
  „Hintergrund-Läufe".

## 10. Der Arbeitszweig ist nicht ausgeliefert  ☐

Stand 27.09.2026: **81 Commits** liegen auf `claude/session-handoff-docs-1qxv3d`
vor `main`. Die Antwort von `/health` belegt es unabhängig vom Commit-Zähler:
ihr fehlen Felder, die im Code seit Tagen stehen.

Das ist keine Kleinigkeit, sondern die Ursache einer wiederkehrenden
Verwechslung: Du prüfst am Gerät die Live-Seite, meldest einen Fehler, und er
ist auf dem Zweig längst behoben. Am 21.09. war einer von vier gemeldeten
Befunden genau das.

- [ ] Entscheiden: PR nach `main` öffnen und mergen?
- Ein Merge auf `main` spielt über die Supabase-GitHub-Integration
  **Migrationen UND Edge Functions** in die Produktion ein und veröffentlicht
  die Web-Fassung. Deshalb frage ich und mache es nicht von selbst.

## 11. Zwei offene Produktentscheidungen  ☐

Beide brauchen nur ein Ja oder Nein, kein Konto und kein Secret.

- [ ] **Sollen Zahlungsmittel für später gespeichert werden?** Heute nicht:
      `create-payment-intent` übergibt Stripe keinen `customer`, deshalb kann
      `/zahlungsmethoden` nie etwas anzeigen. Ein Ja bräuchte zusätzlich eine
      Einwilligung mit Wortlaut (Art. 6 DSGVO, SCA-Mandat) und einen Weg zum
      Entfernen.
- [ ] **Was passiert mit Transaktionsdaten nach zehn Jahren?** Die
      Datenschutzerklärung sagt „10 Jahre (§147 AO, §257 HGB)" zu; aufbewahrt
      wird, gelöscht danach nichts. Vor 2036 ohne Anwendungsfall, aber die
      Zusage steht.

---

## Danach: EIN kompletter Testdurchlauf durch DICH am iPhone
Ich konnte im Sandbox nicht gegen die echte Datenbank testen — dieser Durchlauf
ist der einzige verlässliche „grün":

1. Registrieren → Bestätigungsmail klicken
2. Als Kunde: Auftrag aufgeben
3. Als Anbieter (2. Konto): Angebot abgeben
4. Als Kunde: Angebot annehmen
5. Chatten (Nachricht hin und her)
6. (nach Stripe) Zahlung + Freigabe

Läuft dieser Durchlauf sauber durch → App ist launch-fähig.
