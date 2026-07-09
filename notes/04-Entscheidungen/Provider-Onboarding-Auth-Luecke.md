# Entscheidung: Provider-Onboarding Auth-Lücke + Fake-Success-Fix

**Datum:** 2026-07-09
**Rolle:** CTO / Solution-Architekt
**Status:** Teil-Fix umgesetzt, Produktentscheidung offen (Founder)

## Befund (Selbst-Audit „Finde deine Fehler")

Der Provider-Onboarding-Flow ist **nicht an die Authentifizierung angebunden**:

- `onboarding.tsx` → „Als Anbieter" → `router.push('/onboarding-kyc')` — **legt keinen Account an** (kein `signUp`, kein Passwort-Feld).
- `app/onboarding-kyc.tsx` erfasst Name, E-Mail, Telefon, Steuer-ID, IBAN, Dokumente — aber **kein Passwort und keine strukturierte PLZ/Stadt**.
- Beim Absenden ruft es `updateProviderProfile()`. Diese Funktion (`lib/providerProfiles.ts:126`) macht bei fehlender Session **still `return`** (kein Fehler), und ein innerer `catch` (Zeile 143) verschluckt zusätzlich **jeden** DB-Fehler ohne ihn zu werfen.
- Ergebnis: Ein neuer Anbieter (nie eingeloggt) durchläuft den ganzen KYC-Flow, es wird **nichts gespeichert**, und er landet trotzdem auf `/bewerbung-eingegangen` → **Fake-Erfolg**. Das WERK-Team bekommt die Bewerbung nie, der Anbieter wartet vergeblich.

## Sofort-Fix (umgesetzt)

`onboarding-kyc.tsx` prüft vor dem Persistieren die Session (`getSession()`).
Ohne Konto: klarer Hinweis, **keine** Weiterleitung auf die Erfolgsseite.
Damit ist die Lüge beseitigt — der Flow ist ehrlich.

## Bewusst NICHT getan (und warum)

Full-Provider-Selbstregistrierung blind bauen (Passwort-/PLZ-/Stadt-Felder +
`signUp(role='provider')` verdrahten) wäre ein **spekulatives Feature**, kein
Fehler-Fix — und das Backend ist aus dieser Umgebung nicht testbar (Proxy 502).
Das würde ungetesteten Auth-Code in den transaktionalen Kern schieben.

## Offene Produktentscheidung (Founder)

Wie sollen Anbieter im Beta onboarden? Drei sinnvolle Modelle:

1. **Manuelles Vetting (empfohlen für Köln-Start):** Anbieter werden manuell
   akquiriert (läuft bereits: „Kölner Anbieter-Akquise"). Das Team legt das
   Konto an, der Anbieter füllt KYC eingeloggt. Passt zum „24h-Prüfung"-Wording
   und zum bestehenden Warteliste-Feature (Migration 0350/0360). In-App
   „Als Anbieter registrieren" würde dann auf die **Anbieter-Warteliste**
   führen statt auf den KYC-Prototyp.
2. **Self-Serve-Signup:** KYC um Passwort + PLZ/Stadt erweitern, `signUp(
   role='provider')` beim Absenden, Konto sofort mit `kyc_status='in_review'`.
   Mehr Reibung entfernt, aber mehr Missbrauchsfläche vor dem Vetting.
3. **Hybrid:** Warteliste + eingeladene Anbieter bekommen einen Magic-Link zum
   KYC.

**Empfehlung:** Modell 1 für den Köln-Start (geringste Komplexität, passt zur
manuellen Akquise), Modell 2 später wenn skaliert wird. Nächster konkreter
Schritt bei Bestätigung: „Als Anbieter registrieren" auf die Warteliste
routen und den KYC-Prototyp hinter Login stellen.
