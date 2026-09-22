#!/usr/bin/env python3
"""
Eine Betreiber-Selbstauskunft, die kein Bildschirm abruft.

ANLASS (22.09.2026, gemessen). Die Datenbank hatte DREI Selbstauskuenfte:

    abnahme_lauf_status()   0850
    zustellung_status()     0880
    pstg_meldung_status()   1010

Kein BILDSCHIRM rief eine davon auf; sonst standen alle Aufrufe in
`scripts/db-test/`. Migration 1010 traegt sogar den Namen
„pstg_meldung_sichtbar" -- sichtbar war sie nur fuer einen psql-Aufruf.
Dieselbe Klasse wie „eine Mitteilung ohne Empfaenger-Bildschirm" (16.09.),
nur eine Ebene hoeher: die SICHTBARKEIT selbst war unsichtbar.

An zwei der drei haengen Fristen mit Rechtsfolge (DSA Art. 17 und Art. 4
P2B-VO bei der Zustellung, § 13 und § 25 PStTG bei der Jahresmeldung).

WARUM `health` NICHT ALS RUFER ZAEHLT -- und warum das keine Bequemlichkeit
ist: `/health` ruft alle drei, gibt daraus aber ausschliesslich BOOLEANS an
den Waechter-Workflow. Zahlen bewusst nicht, seit ein Wettbewerber daran das
Wachstum der Angebotsseite mitlesen konnte (`health-keine-zahlen-check.py`
haelt das fest). Ein Endpunkt, der einem Workflow „irgendwo klemmt es"
zuruft, ersetzt keinen Ort, an dem ein Mensch den Stand LIEST.

Der Kopfkommentar in `health/index.ts` behauptete genau das Gegenteil: „die
Zahl steht ohnehin im Pruef-Postfach, wo der Betreiber hinsieht." Bis zum
22.09.2026 stand sie dort nicht. Ein Kommentar ist kein Beleg.

GEMESSEN: 3 Kandidaten, vor dem Fix 3 Befunde, 0 Fehlalarme. Deshalb dieser
Pruefer -- anders als bei der Klasse „unbeschriftetes Symbol", wo 9 von 11
Kandidaten Fehlalarme gewesen waeren und deshalb bewusst keiner gebaut wurde.

EIGENER FEHLER, damit ihn niemand wiederholt: mein erster Grep durchsuchte
`app/ lib/ components/ scripts/` und NICHT `supabase/functions/`. Daraus
wurde „niemand ruft sie" -- ein erfundener Befund. Wo ein Pruefer nicht
hinsieht, ueberlebt nicht nur ein Fehler, dort entsteht auch einer.

WAS ER PRUEFT: jede `*_status()`-Funktion, die eine Migration anlegt, muss aus
`app/`, `lib/`, `components/` oder einer Edge Function AUSSER `health`
gerufen werden. Ein Aufruf in `scripts/db-test/` zaehlt ausdruecklich NICHT
-- ein Test ist kein Nutzer.

ZWEITE ZUSICHERUNG (22.09.2026 nachts, nach einer Mutationsprobe): jeder
Schluessel, den die Aktion `betriebsstatus` in ihre Antwort schreibt, muss in
`lib/pruefungApi.ts` auch gelesen werden.

ANLASS: die Probe „auszahlung_status wird nicht mehr gerufen" liess Reise 15
VOLLSTAENDIG GRUEN. Der Grund war kein Produktfehler, sondern der Pruefstand:
er ersetzt die Edge Function komplett, also kann eine Mutation IN der Function
dort nichts rot machen. Damit war die Uebergabe zwischen Function und Client
von gar nichts gedeckt -- ein Tippfehler im Schluesselnamen (`auszahlung`
gegen `auszahlungen`) waere durch tsc, durch `deno check`, durch Jest und
durch die Reise gefallen.

**Vor jeder Mutationsprobe fragen: laeuft der mutierte Code im Pruefstand
ueberhaupt?** Wird er dort ersetzt, beweist eine gruene Reise nichts.

GRENZE, damit ihm niemand zu viel zutraut: er sieht den AUFRUF und die
UEBERGABE, nicht die Anzeige. Dass die Zahl am Ende auf dem Bildschirm steht,
prueft `scripts/reisen/reise15-betriebsstatus.cjs` im Browser. Herkunft ist
eine Quelltext-Frage, Wirkung eine Browser-Frage.
"""
import os
import re
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Gemessen am 22.09.2026: 3. Eine Untergrenze verhindert, dass eine leere
# Auswahl als „0 Befunde" durchgeht -- „0 Befunde" ist sonst mit einem
# kaputten Suchmuster vereinbar.
MINDESTENS = 3

ANLEGEN = re.compile(
    r'create\s+or\s+replace\s+function\s+public\.([A-Za-z0-9_]*status)\s*\(\s*\)',
    re.I)


def ohne_kommentare_sql(text: str) -> str:
    """`--`-Kommentare entfernen, Zeilenstruktur erhalten.

    Mit LEERSTRING ersetzen, nie mit Leerzeichen -- am 08.09. entstanden aus
    einem Leerzeichen acht Fehlalarme.
    """
    return re.sub(r'--[^\n]*', '', text)


def ohne_kommentare_ts(text: str) -> str:
    def blockweg(m: re.Match) -> str:
        return '\n' * m.group(0).count('\n')
    text = re.sub(r'/\*.*?\*/', blockweg, text, flags=re.S)
    return re.sub(r'//[^\n]*', '', text)


def dateien(basis: str, endungen):
    pfad = os.path.join(WURZEL, basis)
    if not os.path.isdir(pfad):
        return
    for root, _, fs in os.walk(pfad):
        for f in sorted(fs):
            if f.endswith(endungen):
                yield os.path.join(root, f)


def main() -> int:
    # 1. Welche Selbstauskuenfte gibt es?
    auskuenfte = {}
    for d in sorted(dateien('supabase/migrations', ('.sql',))):
        inhalt = ohne_kommentare_sql(open(d, encoding='utf-8').read())
        for m in ANLEGEN.finditer(inhalt):
            # Eine spaetere Migration kann dieselbe Funktion ersetzen; die
            # LETZTE Fundstelle ist die gueltige.
            auskuenfte[m.group(1)] = os.path.relpath(d, WURZEL)

    # 2. Wer ruft sie? `scripts/` zaehlt bewusst NICHT mit.
    rufer = []
    for basis, endungen in (('supabase/functions', ('.ts',)),
                            ('app', ('.tsx', '.ts')),
                            ('lib', ('.ts',)),
                            ('components', ('.tsx', '.ts'))):
        for d in dateien(basis, endungen):
            rel = os.path.relpath(d, WURZEL)
            # Begruendung im Kopf: `health` gibt nur Booleans an einen
            # Workflow. Das ist kein Ort, an dem ein Mensch den Stand liest.
            if rel.startswith('supabase/functions/health/'):
                continue
            rufer.append((rel, ohne_kommentare_ts(open(d, encoding='utf-8').read())))

    print(f'{len(auskuenfte)} Betreiber-Selbstauskunft/-auskuenfte gefunden')
    if len(auskuenfte) < MINDESTENS:
        print(f'FEHLER: nur {len(auskuenfte)} gefunden, erwartet mindestens '
              f'{MINDESTENS}. Findet der Pruefer nichts, prueft er auch nichts.')
        return 1

    befunde = []
    for name, herkunft in sorted(auskuenfte.items()):
        treffer = [p for p, inhalt in rufer
                   if re.search(r'\b' + re.escape(name) + r'\b', inhalt)]
        if treffer:
            print(f'  OK        {name}  ({herkunft})  <- {treffer[0]}')
        else:
            befunde.append(
                f'{herkunft}: `{name}()` wird von keinem Bildschirm und keiner '
                f'Edge Function gerufen. Ein Aufruf in scripts/db-test/ zaehlt '
                f'nicht -- ein Test ist kein Nutzer.')

    # ── Zweite Zusicherung: die Uebergabe Function -> Client ─────────────
    fn = os.path.join(WURZEL, 'supabase/functions/pruefung/index.ts')
    api = os.path.join(WURZEL, 'lib/pruefungApi.ts')
    if os.path.exists(fn) and os.path.exists(api):
        quelle = ohne_kommentare_ts(open(fn, encoding='utf-8').read())
        # Der `json({...})`-Aufruf am Ende der Aktion `betriebsstatus`.
        m = re.search(r'aktion === "betriebsstatus".*?return json\(\{([^}]*)\}\)',
                      quelle, re.S)
        if not m:
            befunde.append('supabase/functions/pruefung/index.ts: die Aktion '
                           '`betriebsstatus` gibt kein Objekt zurueck, das sich '
                           'lesen laesst -- die Uebergabe ist damit ungeprueft.')
        else:
            # Der SCHLUESSEL, nicht der Wert. Die erste Fassung suchte den
            # Namen VOR `,` oder `}` -- bei `auszahlungen: auszahlung` ist
            # das der Wert, und die Mutation „Tippfehler im Schluessel"
            # blieb gruen. Eine Zusicherung, die den Fehler nicht sehen
            # kann, den sie verhindern soll: zum wiederholten Mal dieselbe
            # Klasse.
            schluessel = []
            for teil in m.group(1).split(','):
                teil = teil.strip()
                if not teil:
                    continue
                # `name: wert` -> name;  Kurzform `name` -> name.
                k = teil.split(':')[0].strip()
                if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', k):
                    schluessel.append(k)
            gelesen = ohne_kommentare_ts(open(api, encoding='utf-8').read())
            print(f'  {len(schluessel)} Feld(er) in der Antwort: {", ".join(schluessel)}')
            for k in schluessel:
                if not re.search('j[.]' + re.escape(k) + '(?![A-Za-z0-9_])', gelesen):
                    befunde.append(
                        f'lib/pruefungApi.ts: `{k}` steht in der Antwort der Edge '
                        f'Function, wird aber nie gelesen. Ein Tippfehler im '
                        f'Schluesselnamen faellt sonst nirgends auf -- der '
                        f'Pruefstand ersetzt die Function.')

    if befunde:
        print(f'\n{len(befunde)} Befund(e):')
        for b in befunde:
            print(f'  {b}')
        print('\nEine Selbstauskunft, die niemand abruft, ist eine Sichtbarkeit, '
              'die selbst unsichtbar ist.')
        return 1
    print('OK -- jede Selbstauskunft wird im Produkt abgerufen.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
