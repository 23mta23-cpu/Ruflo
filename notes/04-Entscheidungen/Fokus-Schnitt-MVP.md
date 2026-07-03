---
typ: entscheidung
datum: 2026-07-03
status: umgesetzt (Stufe 1)
entscheider: Tayyip (Pfad B freigegeben) + CTO-Empfehlung A im Reality-Check
---

# Fokus-Schnitt MVP — ein Track, sichtbare Schicht neu

## Kontext
Strategische Neuanalyse (03.07.) ergab: WERKR baute zwei Marktplätze
gleichzeitig (Handwerker B2B + Nachbarschaft C2C) für niemanden Bestimmtes.
Der Sofortpreis-/Festpreiskatalog (`instant-preise.tsx`) war ein bereits
**verworfenes** Konzept — diese Verwerfung war nirgends dokumentiert und hat
eine komplette Fehlanalyse verursacht. Diese Notiz ist auch die Lehre daraus:
**Strategie-Entscheidungen gehören ins Entscheidungs-Log, sonst wiederholt
jede Session den Irrtum.**

## Entscheidung
1. **Repo bleibt** (Reality-Check: Kopplung niedrig, 323 Tests schützen exakt
   die Übernahme-Assets, Rebuild = 2–3 Monate ohne Mehrwert).
2. **Ein Track:** Handwerker-Kleinaufträge, Angebots-Flow mit verbindlichem
   Festpreis-Angebot des Anbieters. Köln, Dichte vor Fläche.
3. **Eingefroren** (ausgeblendet via `constants/features.ts`, Code erhalten):
   - `NACHBARSCHAFT: false` — Wiederauftau-Kriterium: ≥50 echte bezahlte
     Handwerker-Aufträge UND DRV-Statusfeststellung eingeleitet.
   - `PRO_ABO: false` — Wiederauftau-Kriterium: ≥20 aktive Anbieter mit
     regelmäßigen Aufträgen.
4. **Archiviert:** `app/instant-preise.tsx` → `archive/instant-preise.tsx`
   (verworfenes Konzept, Route entfernt; Löschung nur mit Founder-Freigabe).
5. **Ehrlichkeit:** Support-Bot heißt jetzt „Automatischer Assistent"
   (war „KI-Assistent" — es ist ein Keyword-Matcher, kein LLM).
   Landing-Copy auf einen Track geschärft.
6a. **Positionierung (Tayyip, 03.07., Korrektur):** WERKR ist KEINE
   Kleinauftrags-Nische. Wir denken groß: **B2C UND B2B**, von der
   Reparatur bis zum großen Projekt. „Kleinaufträge" darf nicht als
   Marken-Positionierung erscheinen (Landing-Hero korrigiert auf
   „Handwerk für Privat & Gewerbe"). Die Kleinauftrags-Verengung war
   eine CTO-Strategie-Empfehlung für die GTM-Taktik — sie gilt, wenn
   überhaupt, operativ im Vertrieb, nie im Produkt-Text. `kosten.html`
   bleibt bewusst kleinauftrags-fokussiert (SEO-Fangseite für diese
   Suchintention, kein Marken-Statement). Der Fokus-Schnitt selbst
   (ein Track Handwerker, Nachbarschaft eingefroren) bleibt bestehen.

6. **Wording-Verbot (Tayyip, 03.07.):** „Festpreis"/„Sofortpreis" darf
   NIRGENDS als Versprechen, CTA oder Positionierung erscheinen — das
   Konzept ist verworfen. Erlaubt ist nur neutrale Angebotslogik
   („Anfrage stellen", „Angebote erhalten", „verbindliches Angebot",
   „vereinbarter Preis"). Umgesetzt in Home, Landing, Garantie, Angebots-/
   Vertrags-/Chat-Labels, Anbieter-Angebotserstellung („Gesamtpreis") und
   kosten.html. Kein 24–48h-Preisversprechen.

## Umgesetzte Schnitte (Stufe 1)
- `constants/features.ts` (neu) — zentrale Flags mit Wiederauftau-Kriterien
- Home: Nachbarschafts-Kachel + Studenten-Demo hinter Flag; Such-Placeholder
- Suche: nur B2B-Kategorien/-Demos, solange Track eingefroren
- Onboarding-KYC: Track-Switcher hinter Flag (Default Handwerker)
- Provider-Dashboard + Provider-Profil: Pro-Banner/-Zeile hinter Flag
- Landing: Hero-Copy ein Track, Pro-Satz raus
- Support-Chat: ehrliches Label, Gebühren-Antwort ohne C2C/Pro

## Nächste Stufe (freigegeben, in Arbeit)
UX/UI-Neugestaltung der sichtbaren Kern-Journey
(Home → Suche → Anbieter → Auftrag → Angebot → Vertrag) — grundlegendes
Neudenken erlaubt, Logik/`lib`/Backend bleiben unangetastet.

## Nicht angefasst (bewusst)
Migrationen/RLS, Edge Functions (inkl. zagGate), feeEngine, Verträge,
Tests, Nachbarschafts-Screens (eingefroren, nicht gelöscht), Prototyp.
