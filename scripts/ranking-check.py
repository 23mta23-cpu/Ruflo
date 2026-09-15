#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bindet AGB §2 Abs. 4/5 (Ranking und Verteilung) an den Code, der es tut.

Anlass 15.09.2026: Die AGB nannten als Ranking-Parameter „räumliche Nähe".
Es gibt im ganzen Baum keine Entfernungsberechnung — `provider_public` führt
weder Ort noch Koordinaten, und der Umkreis-Filter in `app/suche.tsx` war
genau deshalb schon vorher ausgebaut worden. Art. 5 VO (EU) 2019/1150
verlangt die Angabe der MASSGEBLICHEN Parameter; ein genannter Parameter, den
es nicht gibt, ist eine Falschangabe (und gegenüber Verbrauchern § 5b Abs. 2
UWG). Der Fehler stand monatelang da, weil nichts die beiden Seiten verglich.

Geprüft wird in BEIDE Richtungen, denn beide Richtungen sind Verstöße:
  (a) Die AGB nennen einen Parameter, für den es keinen Code gibt.
      -> versprochen, aber nicht gebaut.
  (b) Der Code sortiert/filtert nach etwas, das die AGB nicht nennen.
      -> gebaut, aber verschwiegen (Art. 5 Abs. 1).

GRENZEN, damit ihm niemand zu viel zutraut:
  * Der Prüfer kennt eine FESTE Liste von Parametern (unten). Ein völlig neuer
    Sortierschlüssel, der in keiner Zeile der Liste vorkommt, fällt ihm nicht
    auf. Wer einen neuen `.order(...)` einbaut, trägt ihn hier ein.
  * Er liest Belege als Zeichenketten, nicht als ausgewerteten Code. Ein
    `.order('rating_avg')` in totem Code würde er als Beleg zählen.
  * Er prüft die AGB, nicht die Datenschutzerklärung oder Marketingtexte.
"""
import os
import re
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGB = os.path.join(WURZEL, 'app', 'agb.tsx')


def lies(pfad):
    with open(pfad, encoding='utf-8') as f:
        return f.read()


def agb_absaetze():
    """Nur §2 Abs. 4 und Abs. 5 — der Rest der AGB geht den Prüfer nichts an."""
    text = lies(AGB)
    anfang = text.find('(4) Ranking-Transparenz')
    if anfang < 0:
        raise SystemExit('FEHLER: „(4) Ranking-Transparenz" steht nicht mehr in app/agb.tsx. '
                         'Wurde der Absatz umbenannt, muss dieser Pruefer mitgezogen werden.')
    ende = text.find('`,', anfang)
    if ende < 0:
        raise SystemExit('FEHLER: Ende des Ranking-Absatzes nicht gefunden.')
    return text[anfang:ende]


def belegt(belege):
    """True, sobald EIN Beleg im Baum steht. Beleg = (relativer Pfad, Text)."""
    for pfad, nadel in belege:
        voll = os.path.join(WURZEL, pfad)
        if not os.path.exists(voll):
            continue
        if nadel in lies(voll):
            return True
    return False


# name          : wofuer der Parameter steht (fuer die Meldung)
# in_agb        : Ausdruck, der den Parameter im AGB-Text erkennt
# belege        : Stellen, die beweisen, dass der Code es wirklich tut
PARAMETER = [
    {
        'name': 'Bewertungsdurchschnitt als Sortierschluessel',
        'in_agb': r'Bewertungsdurchschnitt',
        'belege': [('app/(tabs)/index.tsx', ".order('rating_avg'"),
                   ('app/suche.tsx', ".order('rating_avg'")],
    },
    {
        'name': 'Anzahl der Bewertungen als zweiter Sortierschluessel',
        'in_agb': r'Anzahl der Bewertungen',
        'belege': [('app/(tabs)/index.tsx', ".order('rating_count'"),
                   ('app/suche.tsx', ".order('rating_count'")],
    },
    {
        'name': 'eigene Rubrik nach Registrierungsdatum',
        'in_agb': r'Registrierungsdatum',
        'belege': [('app/(tabs)/index.tsx', ".order('created_at'")],
    },
    {
        'name': 'Verfuegbarkeit als Voraussetzung der Anzeige',
        'in_agb': r'als verf[üu]gbar markiert',
        'belege': [('app/(tabs)/index.tsx', ".eq('available', true)")],
    },
    {
        'name': 'freigeschaltetes Konto (Verifizierung) als Voraussetzung',
        'in_agb': r'freigeschaltetes Konto',
        'belege': [('supabase/migrations/0560_provider_public_view.sql',
                    "where pp.kyc_status = 'approved'")],
    },
    {
        'name': 'eingerichtetes Auszahlungskonto als Voraussetzung',
        'in_agb': r'Auszahlungskonto',
        'belege': [('app/(tabs)/index.tsx', ".eq('stripe_onboarded', true)"),
                   ('app/suche.tsx', ".eq('stripe_onboarded', true)")],
    },
    {
        'name': 'raeumliche Entfernung beeinflusst die Reihenfolge',
        # Erkennt sowohl die heutige Verneinung als auch eine spaetere Behauptung;
        # unterschieden wird unten ueber `verneint`.
        'in_agb': r'r[äa]umliche[nr]? (?:N[äa]he|Entfernung)',
        'verneint': r'beeinflusst die Reihenfolge nicht',
        'belege': [('app/suche.tsx', 'distanceKm'),
                   ('lib/entfernung.ts', 'export')],
    },
    {
        'name': 'Verteilung der Auftragsanfragen ueber den PLZ-Bereich',
        'in_agb': r'zweistelligen Postleitzahlenbereich',
        'belege': [('supabase/functions/notify-matching-providers/auswahl.ts',
                    'plz.startsWith(plzPrefix)')],
    },
]

# Richtung (b): Sortier- und Filterschluessel, die im Code stehen und deshalb
# in den AGB vorkommen MUESSEN. Der Schluessel ist die Code-Stelle, der Wert
# der Ausdruck, der ihn in den AGB nachweist.
CODE_MUSS_IN_AGB = [
    (('app/(tabs)/index.tsx', ".order('rating_avg'"), r'Bewertungsdurchschnitt',
     'Sortierung nach rating_avg'),
    (('app/(tabs)/index.tsx', ".order('rating_count'"), r'Anzahl der Bewertungen',
     'Sortierung nach rating_count'),
    (('app/(tabs)/index.tsx', ".order('created_at'"), r'Registrierungsdatum',
     'Sortierung nach created_at (Rubrik „Neu dabei")'),
    (('app/(tabs)/index.tsx', ".eq('available', true)"), r'als verf[üu]gbar markiert',
     'Filter auf available'),
    (('app/(tabs)/index.tsx', ".eq('stripe_onboarded', true)"), r'Auszahlungskonto',
     'Filter auf stripe_onboarded'),
    (('supabase/functions/notify-matching-providers/auswahl.ts', 'plz.startsWith(plzPrefix)'),
     r'zweistelligen Postleitzahlenbereich', 'PLZ-Auswahl der Benachrichtigten'),
]


def main():
    text = agb_absaetze()
    befunde = []

    for p in PARAMETER:
        genannt = re.search(p['in_agb'], text) is not None
        if not genannt:
            continue
        verneint = 'verneint' in p and re.search(p['verneint'], text) is not None
        hat_code = belegt(p['belege'])
        if verneint and hat_code:
            befunde.append(
                'AGB §2: „%s" wird VERNEINT, im Code gibt es aber einen Beleg dafuer.\n'
                '        Entweder die Verneinung streichen oder den Code.' % p['name'])
        elif not verneint and not hat_code:
            befunde.append(
                'AGB §2 nennt „%s", im Code steht davon nichts.\n'
                '        Erwarteter Beleg an einer dieser Stellen: %s' % (
                    p['name'], ', '.join('%s: %s' % b for b in p['belege'])))

    for (pfad, nadel), in_agb, was in CODE_MUSS_IN_AGB:
        if not belegt([(pfad, nadel)]):
            befunde.append(
                'Code-Beleg verschwunden: %s in %s.\n'
                '        Entweder ist die Stelle umgezogen (dann diesen Pruefer mitziehen)\n'
                '        oder die AGB behaupten jetzt etwas Unwahres.' % (nadel, pfad))
            continue
        if re.search(in_agb, text) is None:
            befunde.append(
                'Der Code macht „%s", die AGB sagen es nicht (Art. 5 Abs. 1 P2B-VO).\n'
                '        Beleg: %s in %s' % (was, nadel, pfad))

    if befunde:
        print('Ranking-Abgleich AGB §2 gegen Code: %d Beanstandung(en)\n' % len(befunde))
        for b in befunde:
            print('  - ' + b)
        return 1

    print('Ranking-Abgleich: AGB §2 Abs. 4/5 und Code stimmen ueberein '
          '(%d Parameter, %d Code-Belege).' % (len(PARAMETER), len(CODE_MUSS_IN_AGB)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
