# Werkant — Security Go-Live Checkliste

**Stand:** 2026-07-09 · Rolle: CTO/Security · Für: Founder (23mta23)

Diese Liste trennt **was bereits im Code abgesichert ist** (von mir verifiziert)
von **was nur du im Dashboard klicken kannst**. Punkt für Punkt abhakbar.

---

## ✅ Bereits abgesichert (im Code verifiziert, 2026-07-09)

- [x] **Row-Level-Security auf ALLEN 13 Tabellen aktiv** — Fremde sehen nie fremde Daten (54 `auth.uid()`-Besitzerprüfungen, Default = deny).
- [x] **UPDATE/DELETE besitzer-/partei-gescoped** — z. B. `contracts` nur durch Vertragsparteien, `offers`-Ablehnung nur durch den Anbieter selbst.
- [x] **Rollen-Eskalation blockiert** — Trigger verhindert, dass ein Nutzer seine eigene Rolle/Compliance-Felder ändert.
- [x] **Passwörter gehasht** (bcrypt via Supabase Auth) — nie im Klartext, für niemanden lesbar.
- [x] **Kein Geheimschlüssel im App-Code** — nur der öffentliche anon-Key (durch RLS wertlos ohne Login); Service-/Stripe-Secrets nur serverseitig.
- [x] **Stripe-Webhook signaturgeprüft** — gefälschte Zahlungs-Events werden mit 400 abgelehnt.
- [x] **Öffentliche Edge Functions**: Rate-Limiting + Auth-Check + Eingabe-Validierung (cancel-contract, create-payment-intent, release-escrow, delete-account, list-payment-methods, pstg-annual-report, send-push, waitlist-doi).
- [x] **Konto-Löschung (DSGVO)** löscht/pseudonymisiert nur den eigenen Account.
- [x] **Warteliste-E-Mails** nicht auslesbar (nur Eintragen erlaubt, Lesen gesperrt).

---

## 🔲 Von dir im Dashboard zu erledigen

### JETZT (vor weiteren Tests mit echten Daten)

- [ ] **1. RLS live gegenprüfen.**
  Supabase → **Table Editor** → jede Tabelle: das Schild-/„RLS enabled" muss **grün** sein. (Migrationen schalten es ein — hier nur bestätigen, dass es nicht aus Versehen aus ist.)

- [ ] **2. Leaked-Password-Schutz an.**
  Supabase → **Authentication → Policies** (bzw. „Password Security") → **„Check against HaveIBeenPwned" aktivieren**. Blockt bekannte geleakte Passwörter. 1 Klick.

- [ ] **3. Mindest-Passwortlänge ≥ 8** (besser 10) setzen.
  Supabase → **Authentication → Policies → Minimum password length**.

- [ ] **4. 2FA auf DEINEN Admin-Konten.**
  Der häufigste echte Angriff ist nicht die DB, sondern ein übernommenes Admin-Login:
  - Supabase-Account → 2FA aktivieren.
  - GitHub-Account (`23mta23-cpu`) → **Settings → Password and authentication → Two-factor** aktivieren.

### VOR dem öffentlichen Launch

- [ ] **5. E-Mail-Bestätigung wieder AN.**
  Supabase → **Authentication → Providers → Email → „Confirm email"** aktivieren. (Fürs geschlossene Test-Beta darf es aus bleiben — vor Public an.)

- [ ] **6. Site-URL & Redirect-URLs korrigieren** (behebt den `localhost:3000`-Link in der Bestätigungsmail):
  Supabase → **Authentication → URL Configuration**
  - Site URL: `https://23mta23-cpu.github.io/Ruflo`
  - Redirect URLs: `https://23mta23-cpu.github.io/Ruflo/**` und `werkant://**`

- [ ] **7. Edge-Function-Secrets prüfen** (dürfen nur hier liegen, nie im Code):
  Supabase → **Edge Functions → Secrets**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, ggf. `RESEND_API_KEY`, Admin-Secrets. Vorhanden & korrekt?

- [ ] **8. Backups bestätigen.**
  Supabase → **Database → Backups**: tägliche Backups aktiv. Auf Pro-Plan **Point-in-Time-Recovery** erwägen.

- [ ] **9. E-Mail-Rate-Limits / SMTP.**
  Für Produktion eigenen SMTP/Resend hinterlegen (Supabase-Default-Mailer ist rate-limitiert und nicht für Produktion gedacht).

- [ ] **10. Custom Domain + HTTPS** (optional, Vertrauen): eigene Domain statt `github.io`.

---

## Wer macht was
- **Code/Repo-Absicherung:** erledigt & versioniert (siehe „bereits abgesichert").
- **Dashboard-Punkte 1–10:** nur der Konto-Inhaber (du) — ich habe hierauf bewusst keinen Zugriff (Prinzip der geringsten Rechte).

## Nicht von hier prüfbar (ehrlich)
Die Live-Dashboard-Einstellungen deiner Supabase-Instanz sind aus der Entwicklungsumgebung nicht erreichbar. Deshalb sind Punkte 1–10 als deine Aufgabe gelistet — sag Bescheid, wenn du sie durch hast, dann gehen wir sie gemeinsam durch.

---

## 🚦 App-Code Go-Live (die 3 Founder-Eingaben, an den Code gekoppelt)

**Stand: 2026-07-16.** Diese drei Punkte sind die letzten echten Start-Blocker.
Alles andere im Code ist abgesichert (siehe oben). Reihenfolge egal, aber alle
drei müssen VOR dem öffentlichen Launch erledigt sein.

### A) Echte Impressum-/Firmendaten (Pflicht — sonst abmahnfähig, §5 DDG/§5 TMG)
Datei: **`constants/legal.ts`** — einzige Quelle für ALLE Rechtsseiten.
1. In `COMPANY` die Platzhalter durch echte Werte ersetzen:
   - `managingDirector: '[Ihr Name]'` → dein voller Name
   - `street: 'Musterstraße 1'` → echte Geschäftsadresse (ladungsfähig, kein Postfach)
   - `phone` / `phoneHref` → echte erreichbare Nummer
   - `registerNumber` / `vatId` → sobald Handelsregister/USt-IdNr. vorliegen
2. `export const LEGAL_PLACEHOLDER = true;` → **`false`** setzen.
   → Blendet die gelben „Platzhalter"-Banner auf Impressum/AGB/Datenschutz/Widerruf automatisch aus.
3. Nach Handelsregister-Eintrag: `IN_FOUNDING = true` → **`false`** (entfernt den „i. Gr."-Zusatz).
*Selbst-Check danach:* Impressum-Screen öffnen — kein gelber Banner mehr, echte Daten sichtbar.

### B) `RESEND_API_KEY` setzen (Pflicht — sonst kann sich NIEMAND registrieren)
Ohne diesen Schlüssel verschickt `verify-email` keine Bestätigungsmail → das
E-Mail-Gate blockt jedes Anlegen von Aufträgen/Angeboten. **Nicht optional.**
1. Account auf **resend.com**, Domain `werkant.de` verifizieren (DNS: SPF/DKIM).
2. API-Key erzeugen.
3. Supabase → **Edge Functions → Secrets** → `RESEND_API_KEY` = der Key.
*Selbst-Check danach:* Test-Registrierung → Bestätigungsmail kommt an → Link stempelt `email_verified_at`.

### C) Stripe von Test auf Live (Pflicht — sonst fließt kein echtes Geld)
1. Stripe-Dashboard aus dem Test- in den **Live-Modus** schalten (Konto vollständig verifiziert).
2. Supabase → **Edge Functions → Secrets**:
   - `STRIPE_SECRET_KEY` → **Live**-Secret (`sk_live_…`)
   - `STRIPE_WEBHOOK_SECRET` → aus dem **Live**-Webhook-Endpoint neu erzeugen
3. Öffentlichen Publishable-Key in der App-Env auf `pk_live_…` umstellen (EAS-/Env-Config, NICHT hartkodieren).
*Selbst-Check danach:* echte Test-Zahlung mit realer Karte über kleinen Betrag → Escrow gesperrt → Freigabe → Auszahlung.

### Reihenfolge-Empfehlung
B zuerst (Registrierung muss gehen, um überhaupt zu testen) → A (Rechtstexte) →
C (Live-Geld, ganz zuletzt, wenn der Rest steht). Sag mir bei jedem Punkt Bescheid,
dann gehe ich ihn mit dir Klick für Klick durch — so wie bei der Edge-Function-Einrichtung.

---

## ⚖️ CCO-Audit Rechtstexte (2026-07-17, Agent-Befund — vor Go-Live fixen)

Strukturell sind alle 4 Rechts-Screens überraschend vollständig. 8 Lücken, priorisiert
(F1–F3 vor Go-Live, Rest kann mit Anwaltsprüfung zusammen):

- [x] **F1 (hoch, umgesetzt 17.07.) `app/agb.tsx`**: Stornierungsklausel fehlt komplett — §4 sperrt Geld in
  Escrow, aber nichts regelt, wer wann stornieren darf und was mit dem Escrow passiert.
- [x] **F2 (hoch, umgesetzt 17.07.) `app/widerruf.tsx`**: Wertersatz-Hinweis (§357a BGB) fehlt in „Folgen
  des Widerrufs" — ohne Belehrung verfällt der Wertersatz-Anspruch.
- [x] **F3 (hoch, umgesetzt 17.07.) `app/datenschutz.tsx`**: Empfänger Supabase + Resend fehlen (nur Stripe/
  AWS/BZSt genannt) — Art. 13 verlangt die tatsächlichen Empfänger inkl. Drittland.
- [x] **F4 (mittel, umgesetzt 17.07.)** Impressum+AGB: ODR-Plattform-Hinweis obsolet (EU-OS-Plattform seit
  20.07.2025 eingestellt) — durch reinen VSBG-Hinweis ersetzen.
- [x] **F5 (niedrig, umgesetzt 17.07.) Impressum**: „§5 TMG" → „§5 DDG" (seit Mai 2024).
- [x] **F6 (mittel, Entwurf umgesetzt 17.07. — Anwaltsprüfung ausstehend) AGB**: P2B-VO (EU 2019/1150) nicht abgebildet (Ranking-Transparenz,
  Begründung bei Sperrung, internes Beschwerdemanagement für gewerbliche Anbieter).
- [x] **F7 (mittel, umgesetzt 17.07.) Widerruf**: „Folgen des Widerrufs" unvollständig (Rückzahlung mit
  demselben Zahlungsmittel, fristwahrende Absendung).
- [x] **F8 (niedrig, umgesetzt 17.07.) Datenschutz**: Art. 13 Abs. 2 lit. e (Pflicht zur Bereitstellung +
  Folgen der Nichtbereitstellung, relevant für KYC).

Kein Rechtsrat — finale Freigabe bleibt beim Fachanwalt (siehe Kommentare in agb.tsx).
