# Archiv

Hier liegt, was zum Produkt gehoert hat und heute nicht mehr benutzt wird.
Geloescht wird nichts: eine Datei im Archiv laesst sich nachlesen, eine
geloeschte muss man aus der Historie holen.

Regel: Wer etwas hierher schiebt, schreibt in diese Liste, **warum**. Ohne
Grund weiss in drei Monaten niemand mehr, ob das Stueck tot war oder nur
gerade niemand Zeit hatte.

## Bestand

### `instant-preise.tsx`
Bildschirm mit Festpreisen fuer Standardleistungen. Aus dem MVP-Schnitt
herausgenommen (`notes/04-Entscheidungen/Fokus-Schnitt-MVP.md`): Festpreise
setzen eine Kalkulation voraus, die es ohne Auftragsdaten nicht gibt.

### `werkr-prototype.html` (archiviert 16.09.2026)
Der interaktive HTML-Prototyp aus der Zeit vor der Expo-App. Bis zum
16.09.2026 wurde er von `.github/workflows/static.yml` als `/demo`
mitveroeffentlicht und war damit **oeffentlich erreichbar**.

Drei Gruende fuer das Abschalten, in dieser Reihenfolge:

1. Er trug den Satz **„Haftpflicht & Qualifikation beider Parteien
   verifiziert"** und die Abzeichenliste `['Haftpflicht','Steuer-ID',
   'Meisterbrief']`. Genau diese Zusage wurde am 14.09.2026 aus der App
   entfernt, weil Werkant nie eine Police gesehen hat. Sie stand danach
   weiter live, nur eine Ebene tiefer.
2. Er trug 24 Mal die alte Marke „Werkr" und 76 Gedankenstriche.
3. Kein Pruefer sah ihn: `versprechen-check.py`, `ton-check.py` und
   `gedankenstrich-check.py` lasen nur `app/` und `components/`. Diese
   Luecke ist mit `scripts/ausgelieferte-seiten-check.py` geschlossen.

Die Datei bleibt liegen, weil sie als Entwurfsdokument taugt. Sie darf
nicht wieder ausgeliefert werden, solange die Zusagen darin nicht stimmen.

### `datenschutz-statisch-2026-06.html` (archiviert 16.09.2026)
Die statische Datenschutzerklaerung, die als `/datenschutz.html`
ausgeliefert wurde. Stand: Juni 2026, 6 472 Zeichen. Die Fassung in der App
(`app/datenschutz.tsx`) hat 12 131 Zeichen und nennt zusaetzlich Resend als
Auftragsverarbeiter, die Aufbewahrungsfristen und die
Auftragsverarbeitung nach Art. 28 DSGVO.

Zwei Fassungen desselben Pflichttextes gleichzeitig live: im Streitfall
gilt die, die der Betroffene erreicht hat, und das war die kuerzere. Der
Pfad `/datenschutz.html` bleibt bestehen und leitet jetzt auf die Fassung
in der App weiter, damit gespeicherte Verweise nicht ins Leere laufen.

### `werkr-design-system-v2.css` (archiviert 16.09.2026)
Das CSS-Design-System aus der Prototyp-Zeit. Verbindlich sind seit dem
Rebrand `constants/colors.ts` und `constants/typography.ts`; das CSS wurde
von keiner ausgelieferten Datei mehr geladen.

### `marktreife_audit_werkr_DE.md` (archiviert 16.09.2026)
Marktreife-Audit aus der Zeit vor dem Rebrand. Inhaltlich ueberholt durch
`docs/recht/rechts-audit-2026-09-13.md` und
`docs/markt/wettbewerbsabgleich-2026-09.md`. Kein Verweis mehr im Baum.
