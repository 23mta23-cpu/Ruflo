---
typ: status
aktualisiert: 2026-09-07
zweck: Der komplette Weg bis zum Launch — gemessen, nicht erinnert
---

# Go-Live-Blocker — bis Apple, Google und Web

> **Gemessen am 07.09.2026**, nicht aus dem Gedächtnis fortgeschrieben.
>
> ```
> health: {"ok":false,"mail":false,"mail_from":false,
>          "stripe":false,"stripe_webhook":false,"db":true}
> Pages:  200
> ```
>
> **Der Code ist nicht der Engpass.** Heute kann sich niemand per E-Mail
> bestätigen lassen und niemand bezahlen — es liegt nicht einmal ein
> Stripe-Testschlüssel vor. Alles unter „Nur du" blockiert alles andere.
>
> Legende: ⬜ offen · 🟡 teilweise · ✅ erledigt · 👤 Founder · ⚖️ Anwalt ·
> 💼 Steuerberater · 🤖 Code
>
> Ersetzt keine Rechtsberatung.

---

## A — Nur du. Ohne diese Punkte hilft kein Code

Nach Reihenfolge, nicht nach Aufwand. 1 und 2 blockieren alles Weitere.

1. ⬜ 👤💼 **UG (haftungsbeschränkt) gründen** + Gewerbeanmeldung.
   Ohne Eintragung kein gültiges Impressum → kein Store-Review, kein Marktauftritt.
   Danach `constants/legal.ts` ausfüllen und `LEGAL_PLACEHOLDER = false`,
   `IN_FOUNDING = false` setzen. `scripts/berechtigungen-check.py --gate` prüft das.
2. ⬜ ⚖️ **ZAG / Treuhand anwaltlich klären.** Der einzige Punkt mit
   strafrechtlichem Risiko (§ 63 ZAG). Die Frage ist ausformuliert in
   `docs/recht/ki-vo-und-bfsg.md` §4 — drei konkrete Fragen, keine offene Prüfung.
   **Bis zur Antwort darf kein echtes Geld fließen.**
3. ⬜ 👤 **Ein Postfach, das Post empfängt** (`kontakt@werkant.de`).
   Hängt an: Impressum (§ 5 DDG), Widerruf (Art. 246a EGBGB), DSGVO-Auskunft,
   DSA-Kontaktstellen (Art. 11/12), Entscheidung über Meldungen (Art. 16 Abs. 5).
   Wege und Kosten: `docs/betrieb/postfaecher-einrichten.md`.
4. ⬜ 👤 **Resend einrichten** (`RESEND_API_KEY`) — sonst kommt keine
   Bestätigungsmail an und niemand kann sich registrieren.
5. ⬜ 👤 **Stripe**: Konto, Live-Modus, Connect-KYC.
   Aktuell liegt **kein** Schlüssel vor, auch kein Test-Key.
6. ⬜ 👤 **AVV unterzeichnen**: Supabase, Stripe, Resend, Expo, GitHub.
   Alle fünf offen. Ohne sie fehlt jeder Übermittlung die Grundlage nach Art. 28
   DSGVO. Liste in `docs/recht/verarbeitungsverzeichnis.md`.
7. ⬜ 👤 **BZSt-Registrierung** als Plattformbetreiber (PStTG/DAC7).
   Code steht, der behördliche Teil fehlt.
8. ⬜ 👤 **Apple Developer Program** (99 $/Jahr) und **Google Play** (25 $).
9. ⬜ 👤 **EAS Project ID** echt setzen (`npx eas-cli init`) — steht auf
   `werkr-placeholder-replace-with-real-eas-id`, damit läuft kein Build.
10. ⬜ 👤 **Drei GitHub-Secrets** für das Ausrollen: `SUPABASE_ACCESS_TOKEN`,
    `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
    Danach läuft `Actions → Deploy Supabase` ohne Handarbeit im SQL-Editor.

---

## B — Sofort fällig, sobald A.10 steht

11. ⬜ 👤 **Migrationen 0770–0810 ausrollen** (`ziel: migrationen`, erst Probelauf).
12. ⬜ 👤 **Edge Functions ausrollen** (`ziel: functions`). Enthält den neuen
    Aufrufweg in `release-escrow` und die neue Function `inhalts-meldung`.
    Ohne diesen Schritt liegen beide nur im Repo.
13. ⬜ 👤 **Nächtlicher Abnahmefrist-Lauf** einrichten —
    `docs/betrieb/abnahmefrist-lauf.md`. Erst **nach** 11 und 12.

---

## C — Erledigt (Code)

- ✅ 🤖 **DSA umgesetzt** — Art. 11, 12, 14, 16, 17, 18, 24 Abs. 3.
  Einstufung und Ausnahmen: `docs/recht/ki-vo-und-bfsg.md` §2,
  Betrieb: `docs/betrieb/dsa-meldungen.md`.
- ✅ 🤖 **KI-VO geprüft: nicht einschlägig** — kein KI-System im Produkt
  (139 Dateien). `scripts/ki-einsatz-check.py` schlägt an, sobald sich das ändert.
- ✅ 🤖 **BFSG geprüft** — Kleinstunternehmen-Ausnahme nach § 3 Abs. 3 greift.
  Barrierefrei wird trotzdem gebaut, Gründe im Dossier.
- ✅ 🤖 **Verarbeitungsverzeichnis** (Art. 30 DSGVO) aus dem echten Datenmodell.
- ✅ 🤖 **Berechtigungen bereinigt** — Kamera, Mikrofon, Fotomediathek und
  Standort waren angefordert, ohne dass es die Funktionen gibt. Das allein wäre
  eine Ablehnung bei Apple und Google gewesen.
- ✅ 🤖 **Deploy-Weg** für Migrationen und Edge Functions.
- ✅ 🤖 **Abnahmefrist** nach § 640 Abs. 2 BGB.
- ✅ 🤖 **Widerrufs-Zustimmung** im Wortlaut gespeichert (0710).
- ✅ 🤖 **Strike-System** mit Begründung, 12-Monats-Frist, Zustellvermerk (0750).

---

## D — Vor der Einreichung, meine Aufgabe

14. ⬜ 🤖👤 **Penetrationstest** (lokal, gegen `dist/` und lokales Postgres —
    nicht gegen die Produktion).
15. ⬜ 🤖 **Store-Angaben vorbereiten**: Data-Safety-Formular (Play),
    App-Privacy (Apple), Alterseinstufung, Screenshots, Beschreibungstexte.
16. ⬜ 🤖 **Konto-Löschung im Store nachweisen** — Apple verlangt sie in der App
    (existiert: `delete-account`) **und** als öffentlich erreichbaren Link.

---

## Was das für den Zeitplan heißt

Der schnellste Weg ist nicht mehr Code. Er läuft über A.1 bis A.5 — Gründung,
Anwalt, Postfach, Resend, Stripe. Diese fünf sind nicht parallelisierbar durch
mich und bestimmen das Datum.

Alles, was ich ohne dich tun kann, ist in C erledigt oder in D geplant.
