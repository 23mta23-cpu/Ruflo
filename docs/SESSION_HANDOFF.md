# WERKR/Werkant Session Handoff

> Stand: 2026-07-07, Ende Session `claude/github-setup-analysis-zamu41`.
> Zweck: Neue Session versteht Stand, Entscheidungen und Richtung OHNE
> Chat-Historie und OHNE erledigte Arbeit zu wiederholen.
> Zuerst CLAUDE.md lesen, dann diese Datei. Bei Reset: eigenständig
> weitermachen (Arbeitsmodus-Regel 2026-07-07), nicht rückfragen.

## 1. Executive State
- **Was:** Deutscher Trust-first-Vermittlungsmarktplatz für Dienstleistungen
  (Expo SDK 56 / Supabase / Stripe Connect). Kern: Handwerk; Nachbarschaft
  (Modell D+) seit 06.07. LIVE geschaltet; Vision breiter (Dolmetschen,
  Transporte, Garten, Bau … — Founder-Brief 07.07.).
- **Phase:** Beta/Demo, Web live (https://23mta23-cpu.github.io/Ruflo/),
  Stripe Testmodus, 0 echte Anbieter/Transaktionen.
- **Repo-Zustand:** Default-Branch = `main` (von Tayyip umgestellt).
  3 gemergte Alt-Branches als `archive/*` kopiert — Originale + alter
  Default (`claude/project-context-review-e7mq0u`) können in der GitHub-UI
  gelöscht werden (Proxy erlaubt kein Löschen aus der Session; Stand 07.07.
  noch offen). `gh-pages` obsolet (Deploy = Actions/static.yml), Löschung
  erst nach Sichtprüfung.
- **Qualität (verifiziert 07.07.):** tsc 0 Fehler · Jest 332/332 ·
  expo export web grün · Live-Deploy verifiziert per Bundle-Marker
  (`NACHBARSCHAFT:!0` im kompilierten Bundle).

## 2. Rebranding: CUTOVER AUSGEFÜHRT 07.07. (Founder-Anweisung, vor DPMA-Check)
- Founder entschied: nicht auf DPMA warten. Risiko bewusst getragen — 0 Nutzer,
  Umbenennung bliebe billig. DPMA/EUIPO-Check bleibt TROTZDEM offen (Tayyip) —
  bei Kollision: Namen tauschen, Symbol „Das Treffen" bleibt.
- Umgesetzt: ~190 Ersetzungen WERKR→Werkant (54 Dateien inkl. Rechtstexte,
  Prototyp /demo, kosten.html); app.json name/scheme; werkr.de→werkant.de.
  Storage-Keys/DB-Felder (werkr_*) bewusst UNVERÄNDERT (Datenkontinuität).
- Symbol-Geometrie-Revision: Haus B +16 statt +22 → Overlap-Haus 14 breit mit
  sichtbarem Dach (Peak 29/20.4). Alle SVGs (docs/brand/) + PNGs (assets/)
  regeneriert; Icon-Generator: PIL-Script in Git-Historie dieses Commits.
- components/ui/BrandMark.tsx (react-native-svg neu) in Landing-Nav/-Footer +
  Home-Kopf; Wortmarke lowercase „werkant"; Splash/Adaptive-BG Hero-Grün.
- Visuell verifiziert (Playwright-Screenshot: Symbol rendert im Web-Export).

## [Historie] Rebranding-Prozess (Stand vor Cutover)
- **Name „Werkant"** gewählt (zeitlos, kein -ando-Trend-Suffix, Kunstwort,
  reisefähig). Grobchecks grün (0 Web-Treffer, werkant.de/.com ohne
  DNS-Eintrag). **WARTET auf Tayyips DPMA/EUIPO-Check (Klassen 35/37/42) +
  Domain-Registrierung.** Verworfen: Handfest (Kollision 35/42, Tayyips
  Recherche), Werkando/Handvero/… (-o/-ando-Veto), Zunft, Rufwerk, Trewo,
  Treuvo, Fairando, Verlano — Details im Branding-Artifact + Notizen.
- **Bildmarke „Das Treffen"** (Runde 3, 07.07.): zwei Häuser, Schnittmenge =
  drittes kleines Haus (Mint). Bélo-Prinzip-Bedeutungsstapel: Nachbarschaft +
  Zuhause + Begegnung + fair geregelter Raum. Assets:
  `docs/brand/das-treffen-logo.svg` + `das-treffen-icon.svg`.
  Verworfen: Werkzeug-Richtungen (Gehrung/Anriss, Runde 1), W-im-Siegelring
  (Runde 2, Founder-Veto „schau Apple/Airbnb"). Siegelring nur noch als
  künftiges „Werkant-geprüft"-Badge.
  Entscheidungsnotiz: `notes/04-Entscheidungen/Marke-Logo-Siegel-System.md`.
- **Rename im Code erst NACH Tayyips DPMA-Go.** Dann: app.json, Rechtstexte,
  Landing, Prototyp, Wortmarke als Pfade (45°-Detail ins „k"), Icons.

## 3. Seit 04.07. erledigt (nicht wiederholen)
- Tooling: Karpathy-Skill + 8 Open-Design-Skills in `.claude/skills/`,
  `docs/TOOLING_SETUP.md` (headroom-ai-Reinstall-Anleitung).
- Nachbarschaft Modell D+ live: `FEATURES.NACHBARSCHAFT` Default an,
  Kill-Switch `EXPO_PUBLIC_ENABLE_NACHBARSCHAFT=false`,
  Notiz `notes/04-Entscheidungen/Nachbarschaft-Live-Schaltung.md`.
- **KYC-Verifizierung real verdrahtet** (PR #11): Migration 037
  (Bucket `verification-docs`, in_review-Status, DB-Guard-Übergang),
  `lib/verification.ts`, Upload-Pflicht-Gates in onboarding-kyc
  (Gewerbeschein Schritt 3; Meisterbrief bei §1-HwO-Gewerk Schritt 4),
  `docs/verification/REVIEW_WORKFLOW.md` (HWK-Gegencheck, Freigabe-SQL,
  DSGVO-Regeln). OCR bewusst verschoben (Trigger in Marken-Notiz).
  Altersnachweis: 18+-Gate + Stripe-Connect-KYC, KEINE Ausweiskopien
  (§20 PAuswG).

## 4. Offene Punkte (nur Tayyip)
1. DPMA/EUIPO-Check „Werkant" + werkant.de/.com registrieren (~25 €/Jahr).
2. Migration 037 im Supabase-SQL-Editor ausführen (sonst keine echten Uploads).
3. Alt-Branches in GitHub-UI löschen (s. o.).
4. RESEND_API_KEY setzen (E-Mail-Versand fertig gebaut, wartet).
5. Anbieter-Akquise Köln starten (`docs/vertrieb/Anbieter-Akquise-Koeln.md`).
6. ZAG-Anwalt vor Escrow-Live; UG-Gründung.

## 5. Nächste Code-Schritte (Reihenfolge, eigenständig abarbeitbar)
1. ~~Rename + Brand-Assets~~ ERLEDIGT 07.07. (Cutover, s. §2). Rest-TODO:
   Wortmarke als Pfade individualisieren (45°-Detail ins „k") vor Store-Release.
2. ~~Rejected-Flow~~ ERLEDIGT 07.07. (PR #17): echter Ablehnungsgrund in
   bewerbung-abgelehnt.tsx, Re-Submit-Weg über onboarding-kyc.
3. ~~delete-account DSGVO-Löschung~~ ERLEDIGT 07.07. (PR #17).
4. P2-Rest: providerId im Wizard (braucht Backend-Feld), Wizard-State über
   Login (Architektur), Reviews-Platzhalter (ab >5 echten Reviews).
   ERLEDIGT: EMPFOHLEN-Badge raus, ctaMsg-Styles raus (PR #17).
5. Kunden-Journey-Konsistenz ERLEDIGT 07.07. (PR #16): zentrale
   kundenKategorien()-Quelle; Tech-Debt notiert: Wizard nutzt eigene
   Kategorie-IDs (sanitaer/elektrik) vs. zentrale (heizung-sanitaer/elektro)
   — bei nächstem Wizard-Touch konsolidieren.

## 6. Arbeitsregeln (unverändert + neu)
- Founder-Regeln 07.07.: unklare Anfragen → beste Option selbst wählen und
  NOTIEREN statt fragen · Arbeit regelmäßig gegen Anforderungen selbst
  prüfen · ehrlich vor nett, Prämissen hinterfragen · konkret mit Zahlen ·
  Unsicherheit offenlegen · auf den Punkt.
- Push-Weg: Feature-Branch → PR → Merge nach `main` (löst Pages-Deploy aus,
  ~5–7 Min; Verifikation per Bundle-Marker, NICHT Actions-API).
- Do-Not-Repeat-Liste des Alt-Handoffs gilt weiter (kein Festpreis-Modell,
  kein Redesign akzeptierter Screens ohne Anlass, keine Gesamtanalyse ohne
  Anlass, Strategie nie aus Code-Menge ableiten).
