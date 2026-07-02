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

## Aus alten Chats/Cowork (nicht rekonstruierbar)

Fehler, die vor dem 2026-07-02 nur mündlich in Chats/Cowork gemeldet wurden, sind
nicht dokumentiert und damit verloren. **Tayyip:** Wenn dir alte Meldungen wieder
einfallen → einfach hier eintragen oder im Chat nennen, sie werden dann sofort
hier aufgenommen und geprüft.
