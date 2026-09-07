# Was gilt und was nicht — KI-VO, BFSG, DSA, ZAG

Stand 07.09.2026. Anlass: der Founder will veröffentlichen und fragte
ausdrücklich nach dem EU AI Act. Diese Seite hält fest, was **gemessen** wurde,
was daraus folgt, und wann die Feststellung ungültig wird.

**Kein Ersatz für Rechtsberatung.** Die ZAG-Frage unten gehört einem Anwalt
vorgelegt, bevor echtes Geld fließt.

---

## 1. KI-Verordnung (EU) 2024/1689 — **nicht einschlägig**

### Was gemessen wurde

Durchsucht: `app/`, `lib/`, `components/`, `hooks/`, `contexts/`,
`supabase/functions/` — 139 Dateien.

| Gesucht | Gefunden |
|---|---|
| LLM-Anbindung (OpenAI, Anthropic, Google, Hugging Face) | nichts |
| ML-Laufzeit (TensorFlow, ONNX, ML Kit) | nichts |
| Embeddings / Vektorsuche | nichts |
| KI-Werbeaussage in der Oberfläche | nichts |

Das Anbieter-Matching in `supabase/functions/notify-matching-providers/index.ts`
ist ein `.filter()` über Gewerk, Umkreis und Verfügbarkeit. Regelbasiert, kein
gelerntes Modell.

Die Warnung im Chat vor Kontaktdaten und Zahlungen außerhalb der Plattform
(`lib/chatGuard.ts`) sind reguläre Ausdrücke.

### Was daraus folgt

Werkant ist weder Anbieter noch Betreiber eines **KI-Systems** im Sinne von
Art. 3 Nr. 1 KI-VO. Die Verordnung greift nicht — weder die
Hochrisiko-Anforderungen noch die Transparenzpflichten aus Art. 50.

Dass dieses Repository mit einem Sprachmodell entwickelt wird, ändert daran
nichts: geregelt ist das in Verkehr gebrachte System, nicht das Werkzeug seiner
Herstellung.

### Wann das ungültig wird

Mit dem ersten eingebauten Modell. Dagegen läuft `scripts/ki-einsatz-check.py`
in der CI: er schlägt an, sobald eine KI-Abhängigkeit oder ein KI-Aufruf in den
Produktcode kommt, und nennt dann die drei Punkte, die zu prüfen sind — Risiko\-
klasse, Art. 50 Transparenz, und ob `beschraenkungen.automatisiert` sowie
AGB §11 Absatz 4 zu berichtigen sind.

Er ist ein Wecker, kein Gutachten: eine KI, die über eine selbstgebaute
HTTP-Schnittstelle ohne diese Namen angesprochen wird, findet er nicht.

---

## 2. Digital Services Act (EU) 2022/2065 — **einschlägig, umgesetzt**

Das ist die Verordnung, die für Werkant tatsächlich zählt. Werkant ist eine
**Online-Plattform**: ein Hostingdienst, der Informationen im Auftrag der Nutzer
speichert und öffentlich verbreitet (Anbieterprofile, Aufträge, Bewertungen).

Als **Kleinstunternehmen** greifen drei Ausnahmen:

| Norm | Wirkung |
|---|---|
| Art. 19 | gesamter Abschnitt 3 (Art. 19–28) entfällt — **außer** Art. 24 Abs. 3 |
| Art. 29 | Abschnitt 4 (Art. 29–32) entfällt, also auch die Händler-Rückverfolgbarkeit |
| Art. 15 Abs. 2 | kein Transparenzbericht |

**Verbindlich und umgesetzt:**

| Pflicht | Wo |
|---|---|
| Art. 11 Kontaktstelle Behörden (mit Sprachen) | `constants/legal.ts` → `DSA`, Impressum |
| Art. 12 Kontaktstelle Nutzer | ebenda |
| Art. 14 Moderationsregeln in den AGB | AGB §11 |
| Art. 16 Melde- und Abhilfeverfahren | `app/melden.tsx`, Edge Function `inhalts-meldung`, Tabelle `inhalts_meldungen` |
| Art. 17 Begründung bei Beschränkungen | `beschraenkungen`, `beschraenkung_erteilen()`, `beschraenkung_begruendung()` |
| Art. 18 Straftaten | Feld `straftat_verdacht`, AGB §11 Abs. 8 |
| Art. 24 Abs. 3 Nutzerzahl auf Anfrage | `aktive_nutzer_monat()` |

**Ausdrücklich NICHT versprochen**, weil nicht geschuldet: ein internes
Beschwerdemanagement nach Art. 20 und eine zertifizierte Streitbeilegungsstelle
nach Art. 21. Beides steht in Abschnitt 3. Eine Stelle zu benennen, die es nicht
gibt, wäre schlechter als keine Angabe.

**Wann sich das ändert:** ab 50 Mitarbeitenden **oder** 10 Mio. € Umsatz fällt
die Kleinstunternehmen-Ausnahme weg. Dann sind zu erweitern: `constants/legal.ts`
(Block `DSA`), AGB §11, und der Rechtsbehelfstext in `beschraenkung_erteilen()`.

Ablauf für den Betrieb: `docs/betrieb/dsa-meldungen.md`.

---

## 3. BFSG — **derzeit nicht verpflichtend, wird trotzdem gebaut**

§ 3 Abs. 3 BFSG nimmt **Kleinstunternehmen bei Dienstleistungen** aus:
weniger als 10 Beschäftigte **und** höchstens 2 Mio. € Jahresumsatz oder
Bilanzsumme. Werkant erbringt eine Dienstleistung im elektronischen
Geschäftsverkehr und liegt darunter.

Die Ausnahme gilt **nur für Dienstleistungen**. Wer Produkte in Verkehr bringt,
ist auch als Kleinstunternehmen erfasst — für Werkant heute ohne Belang.

**Gebaut wird trotzdem barrierefrei**, aus drei Gründen, die nichts mit dem BFSG
zu tun haben:

1. Die Ausnahme fällt mit dem zehnten Beschäftigten weg. Barrierefreiheit
   nachzurüsten ist um ein Vielfaches teurer, als sie einzubauen.
2. Apple und Google prüfen Barrierefreiheit unabhängig vom deutschen Recht.
3. Ein Knopf, der einer Vorlesefunktion nur „Schaltfläche" meldet, ist auch
   ohne Gesetz kaputt.

Was dafür läuft: `scripts/a11y-symbolknoepfe-check.py` (WCAG 4.1.2, Name/Rolle/
Wert) in der CI, `components/ui/Reveal.tsx` respektiert
`prefers-reduced-motion` (WCAG 2.3.3).

---

## 4. ZAG / Treuhand — **offen, gehört einem Anwalt vorgelegt**

Das ist der einzige Punkt auf dieser Seite mit **strafrechtlichem** Risiko
(§ 63 ZAG), und er ist nicht durch Code lösbar.

Werkant hält Zahlungen zurück, bis der Auftrag abgenommen ist. Das ist in
Deutschland grundsätzlich ein erlaubnispflichtiger Zahlungsdienst.

**Die Frage an den Anwalt ist keine offene Prüfung, sondern eine konkrete:**

> Werkant nutzt Stripe Connect mit getrennten Charges und Transfers. Das Geld
> liegt zu keinem Zeitpunkt auf einem Konto von Werkant, sondern durchgehend bei
> Stripe (Stripe Payments Europe, lizenziertes E-Geld-Institut). Werkant löst
> die Auszahlung aus, verwahrt sie aber nicht.
>
> 1. Greift damit die Bereichsausnahme des § 2 Abs. 1 Nr. 2 ZAG
>    (Handelsvertreterausnahme)?
> 2. Falls ja: unter welchen Bedingungen — insbesondere, wer gegenüber dem
>    Kunden als Erfüllungsempfänger auftritt und wie die AGB das abbilden
>    müssen?
> 3. Ändert die fiktive Abnahme nach § 640 Abs. 2 BGB (Migration 0770) etwas
>    daran, dass die Auszahlung ohne Zutun des Kunden ausgelöst wird?

Belege für den Anwalt: `supabase/functions/_shared/zagGate.ts`,
`supabase/migrations/0650_payout_operations.sql`, `0770_abnahme_frist.sql`.

**Bis das beantwortet ist, darf kein echtes Geld fließen.** Das ist kein
Vorsichtsargument, sondern die Konsequenz aus § 63 ZAG.

---

## 5. Was diese Seite nicht abdeckt

- **P2B-VO (EU) 2019/1150** — Ranking-Transparenz gegenüber gewerblichen
  Anbietern. Art. 5 ist einschlägig, AGB §2(4) beschreibt die Reihenfolge, und
  `scripts/agb-code-check.py` prüft die Zusage gegen `app/suche.tsx`.
  Art. 11 (internes Beschwerdemanagement) entfällt für kleine Unternehmen.
- **PStTG / DAC7** — Meldepflicht als Plattformbetreiber. Code steht
  (`lib/pstTg.ts`, Migrationen 0120/0220), die Registrierung beim BZSt ist
  offen.
- **DSGVO** — Verarbeitungsverzeichnis nach Art. 30 siehe
  `docs/recht/verarbeitungsverzeichnis.md`.
