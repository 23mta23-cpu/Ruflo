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
