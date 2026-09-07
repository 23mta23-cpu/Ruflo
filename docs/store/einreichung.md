# App Store und Google Play — Einreichung

Stand 07.09.2026. Alle Angaben aus dem Code abgeleitet
(`docs/recht/verarbeitungsverzeichnis.md`), nicht aus einer Vorlage.

> **Falsche Angaben in diesen Formularen sind kein Formfehler.** Apple und
> Google gleichen sie gegen das tatsächliche Verhalten der App ab; eine
> Abweichung führt zur Ablehnung, bei Wiederholung zum Ausschluss des
> Entwicklerkontos.

---

## 0. Was einer Einreichung heute noch im Weg steht

| Punkt | Zustand |
|---|---|
| `extra.eas.projectId` | `werkr-placeholder-replace-with-real-eas-id` → kein Build möglich |
| `eas.json` → `submit.production.ios` | drei Platzhalter (`appleId`, `ascAppId`, `appleTeamId`) |
| `eas.json` → `submit.production.android` | `google-service-account.json` fehlt |
| `constants/legal.ts` | `LEGAL_PLACEHOLDER = true` → Impressum trägt Platzhalter |
| **Prüfkonto für App Review** | siehe §5 — der kritischste Punkt |

`python3 scripts/berechtigungen-check.py --gate` meldet die ersten vier.

---

## 1. Apple — App Privacy („Nutrition Label")

Für jede Kategorie: wird sie erhoben, ist sie mit der Identität verknüpft, wird
sie zum **Tracking** genutzt.

**Tracking: nein — durchgängig.** Es gibt keine Werbe-SDKs, keinen
Drittanbieter-Analysedienst und keine Weitergabe an Datenmakler.
`lib/analytics.ts` schreibt in einen lokalen Ringpuffer (max. 200 Ereignisse),
ist zustimmungsgebunden und **standardmäßig aus**. Kein externer Sink
angebunden.

| Kategorie | Erhoben | Verknüpft | Tracking | Zweck | Woher im Code |
|---|---|---|---|---|---|
| Name | ja | ja | nein | App-Funktionalität | `profiles.full_name`, `provider_profiles.company_name` |
| E-Mail-Adresse | ja | ja | nein | App-Funktionalität, Account | Registrierung, `email_verifications` |
| Telefonnummer | ja | ja | nein | App-Funktionalität | `provider_profiles.phone`, `profiles.phone` |
| Physische Anschrift | ja | ja | nein | App-Funktionalität | `job_addresses`, `provider_profiles.address_*` |
| Zahlungsinformationen | ja | ja | nein | App-Funktionalität | **über das Stripe-SDK**, nicht von Werkant gespeichert |
| Fotos oder Videos | ja | ja | nein | App-Funktionalität | KYC-Nachweise (Gewerbeschein, Meisterbrief) |
| Nutzerinhalte (sonstige) | ja | ja | nein | App-Funktionalität | Nachrichten, Bewertungen, Auftragsbeschreibungen |
| Nutzerkennung | ja | ja | nein | App-Funktionalität | `auth.users.id`, Push-Token |
| Grober/genauer Standort | **nein** | – | – | – | kein Standortzugriff im Code |
| Kontakte | **nein** | – | – | – | – |
| Suchverlauf, Browserverlauf | **nein** | – | – | – | – |
| Absturzdaten, Nutzungsdaten | **nein** | – | – | – | kein Sentry/Crashlytics |
| Werbedaten | **nein** | – | – | – | – |

**Zahlungsinformationen sind anzugeben**, obwohl Werkant sie nicht speichert:
`@stripe/stripe-react-native` ist in die App eingebettet, und Apple rechnet
Daten, die ein eingebettetes SDK erhebt, der App zu. Werkant selbst hält nur
Vorgangskennungen (`contract_payment_intents`).

---

## 2. Google Play — Data Safety

Dieselbe Grundlage, andere Gliederung. Zusätzlich zu §1 anzugeben:

| Frage | Antwort |
|---|---|
| Werden Daten verschlüsselt übertragen? | **Ja** — ausschließlich HTTPS |
| Können Nutzer die Löschung ihrer Daten verlangen? | **Ja** — in der App unter Einstellungen, Edge Function `delete-account` |
| Gibt es eine Web-Adresse zur Löschung? | **erforderlich, siehe §4** |
| Werden Daten mit Dritten geteilt? | **Ja** — Stripe (Zahlung), Supabase (Verarbeitung), Resend (E-Mail-Versand). Alle als Auftragsverarbeiter, nicht zu eigenen Zwecken |
| Datenerhebung optional? | Nein — die genannten Daten sind für die Vermittlung erforderlich |
| Wurde die App unabhängig auf Sicherheit geprüft? | **Nein** — Penetrationstest ist offen |

**„Werden Daten mit Dritten geteilt" ist mit Ja zu beantworten.** Auch eine
Auftragsverarbeitung ist im Sinne des Formulars eine Weitergabe. Ein Nein wäre
hier eine Falschangabe.

---

## 3. Alterseinstufung

**Empfehlung: 18+ / „Nur für Erwachsene" ist NICHT nötig — 17+ bzw. USK 12
ebenfalls nicht.** Angemessen ist die niedrigste Stufe mit dem Hinweis auf
**unmoderierte Nutzerkommunikation**.

Ausschlaggebend ist der Chat zwischen Auftraggeber und Anbieter: er ist
Nutzer-zu-Nutzer-Kommunikation und wird nicht vorab moderiert. Beide Formulare
fragen das ausdrücklich ab, und ein Nein wäre falsch.

Zusätzlich anzugeben:
- **Nutzergenerierte Inhalte: ja** (Bewertungen, Auftragsbeschreibungen, Chat)
- **Meldefunktion vorhanden: ja** — im Chat sowie über „Inhalt melden"
  (Art. 16 DSA, `app/melden.tsx`)
- **Digitale Käufe: nein** — vermittelt werden Leistungen in der realen Welt

**Zur In-App-Kauf-Frage bei Apple (Richtlinie 3.1.1):** Werkant vermittelt
Handwerksleistungen, die außerhalb der App erbracht werden. Solche Zahlungen
sind ausdrücklich **von der In-App-Kauf-Pflicht ausgenommen** und dürfen über
Stripe laufen. Das ist derselbe Fall wie bei Lieferdiensten und Handwerker-
Portalen. Sollte die Prüfung das anders sehen, ist auf 3.1.3(e)
(„Person-to-Person Services") zu verweisen.

**In den AGB steht das mindestens 18 Jahre-Erfordernis** (§3 Abs. 1). Die
Alterseinstufung des Stores bildet die Inhalte ab, nicht die vertragliche
Mindestaltersgrenze — beides steht nebeneinander und widerspricht sich nicht.

---

## 4. Pflicht-Adressen

| Zweck | Adresse | Zustand |
|---|---|---|
| Datenschutzerklärung | `https://23mta23-cpu.github.io/Ruflo/datenschutz` | steht (in `app.json` → `extra.privacyPolicyUrl`) |
| Support | Postfach aus `constants/legal.ts` | **hängt am Postfach** |
| Konto-Löschung (Google Play, Pflicht) | öffentlich erreichbare Seite mit Beschreibung des Löschwegs | **fehlt** |
| Impressum | `https://23mta23-cpu.github.io/Ruflo/impressum` | steht, trägt aber Platzhalter |

Google verlangt seit 2024 eine **von außen erreichbare Seite**, die den
Löschweg beschreibt — der Knopf in der App allein genügt nicht. Apple verlangt
umgekehrt die Löschung **in** der App; beides ist vorhanden bzw. zu ergänzen.

---

## 5. Prüfkonto für App Review — der kritischste Punkt

Beide Stores prüfen die App mit einem echten Konto und laufen dabei durch den
Kernablauf. **Heute ist dieser Ablauf nicht durchführbar:**

```
health: {"mail":false, "stripe":false, ...}
```

Konkret bedeutet das für die Prüfung:

1. **Registrierung scheitert an der Bestätigungsmail** — ohne `RESEND_API_KEY`
   kommt keine an. Der Prüfer kommt nicht über den ersten Bildschirm hinaus.
   Das ist eine sichere Ablehnung („App Completeness", Richtlinie 2.1).
2. **Zahlung ist nicht auslösbar** — es liegt kein Stripe-Schlüssel vor, auch
   kein Testschlüssel.
3. **Anbieter können sich nicht selbst registrieren** (bewusst: Warteliste mit
   persönlichem Vetting). Für die Prüfung muss deshalb ein **fertig
   eingerichtetes Anbieterkonto** hinterlegt werden, sonst sieht der Prüfer nur
   die halbe App und stuft sie als unvollständig ein.

**Vor der Einreichung anzulegen und in den Prüfhinweisen zu hinterlegen:**

- ein Kundenkonto mit bestätigter E-Mail
- ein Anbieterkonto mit abgeschlossenem KYC und freigeschaltetem Gewerk
- ein Auftrag, der so weit gediehen ist, dass ein Angebot sichtbar ist
- der Hinweis, dass Anbieter-Registrierung über eine Warteliste läuft und warum
- Stripe im **Testmodus** mit der Karte `4242 4242 4242 4242`, damit der Prüfer
  eine Zahlung durchspielen kann, ohne dass echtes Geld fließt

> Diese Konten gehören in die Produktion und sind die **Ausnahme** von der Regel
> in `AGENTS.md`, keine Testkonten aus einem Agentenlauf anzulegen. Sie sind
> bewusst und dauerhaft, gehören dokumentiert wie `b1debug1907@example.com`,
> und dürfen nicht gelöscht werden.

---

## 6. Reihenfolge

1. Apple Developer Program und Google Play Console anlegen
2. `npx eas-cli init` → echte `projectId`
3. `eas.json` → die drei Apple-Kennungen, Google-Dienstkonto ablegen
4. Resend und Stripe einrichten (**ohne beides ist §5 nicht erfüllbar**)
5. Prüfkonten anlegen und im Store hinterlegen
6. `constants/legal.ts` ausfüllen, `LEGAL_PLACEHOLDER = false`
7. `python3 scripts/berechtigungen-check.py --gate` muss grün sein
8. Screenshots (6,7" und 6,5" für Apple; Telefon und 7-Zoll-Tablet für Google)
9. Einreichen

Punkt 4 ist die eigentliche Hürde, nicht Punkt 9.
