# Entscheidung: SEO-Kostenrechner + Deploy-Trigger für aktuellen Branch

**Datum:** 2026-07-02 · **Autonom entschieden** (Standing Instruction: wählen & notieren)

## 1. SEO-Kostenrechner (`kosten.html`)

Statische, selbst-enthaltene Seite (kein CDN, WERKR-Design-Tokens) mit:
- Interaktivem Sofort-Rechner (12 häufigste Kleinaufträge, Richtwerte Köln 2026)
- Preistabelle + FAQ mit `FAQPage`-JSON-LD (Chance auf Google-Rich-Results)
- Klarer Kennzeichnung als unverbindliche Richtwerte (PAngV-vorsichtig)
- CTA auf App/Warteliste; Zwei-Track-Botschaft (Profi vs. Alltagshelfer ab ~15 €/Std.)

Live nach Deploy unter: `https://23mta23-cpu.github.io/Ruflo/kosten.html`

**Warum eine Seite statt 20 Einzelseiten:** Erst beweisen, dass die Seite
indexiert und Traffic zieht (Google Search Console), dann pro Top-Keyword
eigene Unterseiten ausrollen. Kein spekulativer Content-Friedhof.

**Preis-Richtwerte:** konservative Spannen, als „unverbindliche Richtwerte
Stand 2026" gekennzeichnet — keine Preiszusagen (Abmahnrisiko vermieden).

## 2. Deploy-Trigger erweitert

`deploy-web.yml` deployte nur von `main`/zwei alten Branches — die Website
lief also auf veraltetem Stand ohne unsere letzten ~10 Fixes (SafeArea,
Chips, Warteliste, Positionierung). Aktueller Arbeits-Branch
`claude/werkr-platform-context-b088z6` wurde zu den Triggern hinzugefügt.

**Risiko akzeptiert:** Jeder Push deployt jetzt die Beta-Website neu. Da die
Seite ohnehin als „Geschlossener Testbetrieb (Beta)" gekennzeichnet ist und
Stripe im Testmodus läuft, ist aktueller Code dort besser als veralteter.
Rückbau: Branch-Eintrag wieder entfernen, sobald auf `main` konsolidiert wird.
