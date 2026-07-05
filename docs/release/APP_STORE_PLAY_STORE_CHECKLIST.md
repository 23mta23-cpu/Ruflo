# WERKR — App Store / Play Store Readiness Checklist

_Stand: 2026-07-05. ✓ = im Repo vorhanden/verifiziert · ⚠ = teilweise · ☐ = externes To-do (Tayyip)._

## Rechtliches & Pflichtseiten

- ✓ **Impressum** — `app/impressum.tsx`, verlinkt aus Landing-Footer und Konto.
- ✓ **AGB** — `app/agb.tsx` (§307/312 BGB-konform aufgebaut, Fee-Modell beider Tracks ausgewiesen).
- ✓ **Datenschutzerklärung** — `app/datenschutz.tsx`; DSGVO-Consent-Gate beim ersten Start (`components/ui/DsgvoConsent.tsx`) mit Analyse-Opt-in und PStTG/DAC7-Hinweis.
- ✓ **Widerruf** — `app/widerruf.tsx` + Muster-Widerrufsformular.
- ✓ **Account-Löschung** — `delete-account` Edge Function (3/h rate-limited, blockiert bei aktiven Verträgen); Einstieg über Konto → Einstellungen. Apple-Pflicht (Account Deletion in-App) damit erfüllt.
- ☐ **Privacy Policy als öffentliche URL** — Stores verlangen eine erreichbare Web-URL; die GitHub-Pages-Route `/datenschutz` kann verwendet werden, muss aber im Store-Formular eingetragen werden.

## Store-Formulare & Review

- ☐ **Demo-/Test-Account** für App Review anlegen (E-Mail+Passwort, Kunde UND Anbieter), in Review Notes eintragen.
- ☐ **Review Notes** schreiben: Beta-/Demo-Modus erklären (Demo-Anbieter sind gekennzeichnet), Zahlung im Testmodus, Nachbarschaft hinter Feature-Flag.
- ☐ **Support-Kontakt**: öffentliche Support-E-Mail festlegen (aktuell nur Support-Chat in-App).
- ☐ **Screenshots** (6.7", 6.1", iPad optional; Android Phone + 7"/10") — aus echtem Build, nicht aus Web-Export.
- ☐ **App-Privacy-Angaben (Apple) / Data Safety (Google)**: erhoben werden E-Mail, Name, PLZ/Adresse (Auftrag), Zahlungsdaten via Stripe; Analytics nur nach Opt-in, lokal gepuffert (kein externer Versand, Stand heute).

## Permissions

- ✓ **Push-Benachrichtigungen** — Opt-in-Flow über System-Dialog (`lib/notifications.ts`), Zweck: Angebots-/Vertrags-Updates. Kein Zwang.
- ✓ Keine Kamera-/Standort-/Kontakte-Permissions im aktuellen Scope.

## Zahlungen & Gebühren

- ✓ Gebühren transparent vor Abschluss: 8 % + 2,5 % (Handwerker) bzw. €1,99 WERKR-Schutz (Nachbarschaft) — in Wizard Schritt 4, AGB, Garantie-Seite.
- ✓ Physische Dienstleistungen → Stripe statt In-App-Purchase ist Store-konform (Apple 3.1.5(a)).
- ✓ **Escrow/ZAG-Status:** Live-Zahlungsfreigabe bleibt hinter `zagGate` (`ZAG_LEGAL_SIGNOFF`); ohne anwaltliche Freigabe liefert create-payment-intent einen sauberen Fehler. Web zeigt bewusst „Zahlung nur in der App".
- ☐ **Stripe Live-Keys** erst nach ZAG-Freigabe und Sequenzierungs-Entscheidung (escrow-loser Concierge-Start empfohlen).

## Feature Flags & bekannte Einschränkungen

- **`NACHBARSCHAft`/`PRO_ABO` = aus** in Produktion; Nachbarschaft aktivierbar per `EXPO_PUBLIC_ENABLE_NACHBARSCHAFT=true` (nur Test-Builds). Der Deploy-Workflow `static.yml` setzt die Variable NICHT — vor jedem Release-Build prüfen.
- **Known Limitations (Review Notes + intern):**
  - Marktplatz im Beta-/Demo-Modus, solange 0 verifizierte Anbieter (Demo-Karten gekennzeichnet).
  - `waitlist-doi` sendet ohne `RESEND_API_KEY` keine Mail (HTTP 200 + Server-Log) — ☐ Key setzen.
  - Wizard-Eingaben überleben den Login-Redirect nicht (Hinweis auf Schritt 1 vorhanden, bekanntes P2).
  - `providerId` vom Profil-CTA wird im Wizard noch nicht als gezielte Anfrage verarbeitet (P2, Trigger: erster echter Anbieter).
  - Analytics: nur lokaler Ringpuffer, kein externer Versand (docs/analytics/EVENTS.md).

## Build & Geräteprüfung

- ✓ `app.json`: Bundle-Id `de.werkr.app` (iOS+Android), Version 1.0.0.
- ✓ Safe Areas/Notch/Home-Indicator: `useSafeAreaInsets` in Tab-Bar, `viewport-fit=cover` (Web), SafeAreaView auf allen Screens; verifiziert per 390×844-, 360×740- und 768×1024-Checks.
- ☐ **EAS Build + echtes Gerät**: mindestens je 1 iOS- und 1 Android-Gerät vor Einreichung (Push-Token, PaymentSheet, Deep-Link `werkr://payment-complete`).
- ☐ App-Icons/Splash final prüfen (assets/ vorhanden, Store-Auflösungen generieren EAS/Expo automatisch).

## Go/No-Go vor Einreichung

1. Alle ☐-Punkte oben erledigt oder bewusst verschoben.
2. `npx tsc --noEmit` 0 Fehler, Jest grün, Kern-Journey-E2E grün.
3. Feature-Flag-Zustand für den Build explizit bestätigt.
4. ZAG-Gate-Zustand dokumentiert (kein Live-Escrow ohne Freigabe).
