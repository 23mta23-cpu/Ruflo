---
typ: prozess
aktualisiert: 2026-07-02
zweck: Persistente Bug-Inbox — damit gemeldete Fehler nie wieder zwischen Chat-Sessions verloren gehen
---

# 🐞 Bug-Inbox

> **Regel (für Tayyip UND jede KI-Session):** Jeder gemeldete Fehler — egal ob aus
> Chat, Cowork, Simulator-Test oder E-Mail — wird SOFORT hier eingetragen, bevor
> irgendetwas anderes passiert. Jede neue Session liest diese Datei zuerst
> (verlinkt aus `notes/Übergabe.md`). Status: ⬜ offen · ✅ gefixt · ⚪ kein Bug.

| Datum | Fehler (kurz) | Quelle | Status | Beleg |
|---|---|---|---|---|
| 2026-07-02 | Stripe-Plugin-Crash (`merchantIdentifier` fehlte in app.json) | Sandbox-Test | ✅ gefixt | `e61ec32` |
| 2026-07-02 | `npm install` ERESOLVE (react-dom ^19.2.3 → 19.2.7) | Tayyip Mac-Terminal | ✅ gefixt | `0166d33` |
| 2026-07-02 | CocoaPods `React-Core-prebuilt` "Missing attribute source" (Leerzeichen im Ordnerpfad) | Tayyip Mac-Terminal | ✅ gelöst | Ordner umbenannt, Build grün |
| 2026-07-02 | Suche-Screen: endloser Lade-Spinner unter den Kategorie-Chips | Tayyip Simulator-Screenshot | ✅ gefixt | `4dfa400` (8s-Timeout) |
| 2026-07-02 | `mailto:support@werkr.de` wirft Fehler im Simulator | Tayyip Simulator-Log | ⬜ offen (Guard geplant) | Audit 🟡 Nr. 2 |
| 2026-07-02 | CoreHaptics-Logspam im Simulator | Tayyip Simulator-Log | ⚪ kein Bug (Simulator hat keine Haptik) | — |
| 2026-07-02 | Kategorie-Chips in Suche extrem hoch/gestreckt (Screenshot 17:16) | Tayyip Simulator-Screenshot | ✅ gefixt | horizontale ScrollView ohne `flexGrow: 0` dehnte sich vertikal aus; gleicher Fehler auch in `instant-preise.tsx` gefunden + gefixt |

| 2026-07-02 | Landing-Seite: Nav-Bar (Logo + „Jetzt starten") überlappt mit iOS-Statusleiste/Notch | Tayyip Simulator-Screenshot + Nachfrage | ✅ gefixt | `951d7c8` — einziger Screen ohne SafeAreaView |
| 2026-07-02 | Kein automatischer E-Mail-Versand (Warteliste, Auftragsbestätigung) | Tayyip Nachfrage | ⬜ offen — bewusst noch nicht gebaut, siehe Entscheidung unten | — |

| 2026-07-02 | Web: Seiten ohne Seitenränder/-verhältnisse (volle Browserbreite) | Tayyip iPhone-Feedback | ✅ gefixt | `db4f65d` — globaler 480px-Web-Rahmen für ALLE Routen |
| 2026-07-02 | Nachbarschaft-Onboarding: nur 5 Auswahl-Kategorien, zu wenig | Tayyip Screenshot 21:09 | ✅ gefixt | `db4f65d` — 12 Kategorien (Möbelaufbau, Einkaufshilfe, Tierbetreuung, Senioren, Babysitting, Wäsche) |
| 2026-07-02 | „Bei manchen Seiten kann ich nicht klicken" | Tayyip iPhone-Feedback | ⬜ offen — WELCHE Screens? Screenshot nötig | — |
| 2026-07-02 | Web (iOS Safari): Header rutscht unter die Statusleiste, sobald Safari die Browserleiste einklappt (Screenshots 21:56, Support-Chat) | Tayyip iPhone-Screenshots | ✅ gefixt | `public/index.html` mit `viewport-fit=cover` — erst damit liefert Safari `env(safe-area-inset-*)` und alle SafeAreaViews greifen im Web. Root Cause: `app/+html.tsx` wird bei `web.output: "single"` von Expo ignoriert |
| 2026-07-02 | Support-Chat: „★ 4.9"-Badge ragt rechts aus dem Bildschirm (schmale iPhones) | Tayyip iPhone-Screenshot 21:56 | ✅ gefixt | Header-Texte `numberOfLines={1}` + `minWidth: 0`, Badge `flexShrink: 0` |
| 2026-07-02 | Tab-Bar: feste Höhe 60 ohne `insets.bottom` → liegt unter dem Home-Indicator (Notch-iPhones + Web mit viewport-fit=cover) | Eigen-Audit nach Screenshots | ✅ gefixt | `(tabs)/_layout.tsx` nutzt jetzt `useSafeAreaInsets()` |
| 2026-07-02 | Kategorie-Chip-Reihen: nur 8px End-Padding rechts (Home, Nachbarschaft, Instant-Preise) | Tayyip iPhone-Screenshot 21:54 | ✅ gefixt | `paddingRight: 20` — konsistent mit linkem Rand |

| 2026-07-03 | Live-Seite zeigte abwechselnd App, alte Prototyp-Weiterleitung, zuletzt 404 | Eigen-Verifikation nach Deploy | ✅ Root Cause gefunden + Fix deployed | Pages-Quelle stand auf „Branch main /(root)" statt „GitHub Actions" — GitHub servierte den ROHEN Repo-Inhalt und raste bei jedem Push gegen unser Actions-Artefakt. Beweis: `app/landing.tsx` war öffentlich abrufbar. Fix: static.yml stellt build_type per API fest auf `workflow` |

## Aus alten Chats/Cowork (nicht rekonstruierbar)

Fehler, die vor dem 2026-07-02 nur mündlich in Chats/Cowork gemeldet wurden, sind
nicht dokumentiert und damit verloren. **Tayyip:** Wenn dir alte Meldungen wieder
einfallen → einfach hier eintragen oder im Chat nennen, sie werden dann sofort
hier aufgenommen und geprüft.
