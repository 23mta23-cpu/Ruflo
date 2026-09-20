#!/usr/bin/env python3
"""Die AGB duerfen nicht bestreiten, was die Datenbank automatisch tut.

ANLASS (Founder am Geraet, 20.09.2026): „Zusaetzlich auch wegen des Strikes,
da gibt es dann keine rechtlichen Probleme oder?"

Beim Nachmessen stand es so im Produkt:

  app/agb.tsx §8(4):  „Eine automatisierte Entscheidung ueber Massnahmen
                       findet nicht statt."
  0720 apply_leak_strikes(): Trigger AFTER INSERT auf chat_leak_flags, vergibt
                       bei je drei Funden einen Strike — ohne Zutun eines
                       Menschen. Ab drei aktiven Strikes sperrt die Policy
                       „Provider creates offers on open jobs" das Bieten.
  app/datenschutz.tsx: legt genau diese Automatik als Art.-22-Entscheidung
                       offen.

Die beiden eigenen Rechtstexte sagten also das Gegenteil voneinander, und der
AGB-Satz war schlicht unwahr. Das ist dieselbe Klasse wie „der Code
widerspricht den eigenen AGB" (16.08., Strike-Verfall) — nur andersherum: hier
war der Code richtig und der Text falsch.

Der Pruefer haelt die drei Stellen aneinander. Er beurteilt keinen Wortlaut;
er prueft, dass eine BESTREITUNG nicht neben einer AUTOMATIK steht.

GRENZE: er kennt genau diese eine Automatik. Eine zweite, neue automatische
Massnahme faengt er nicht — sie muesste hier eingetragen werden.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
AGB = WURZEL / 'app' / 'agb.tsx'
DATENSCHUTZ = WURZEL / 'app' / 'datenschutz.tsx'
MIGRATIONEN = WURZEL / 'supabase' / 'migrations'
# Die Funktion steht in 0720, der Trigger daran in 0500. Beim ersten Lauf hat
# dieser Pruefer sich genau daran selbst gefangen: er las nur 0720, fand keinen
# `create trigger` und schloss daraus, die Automatik sei weg. Deshalb wird
# jetzt ueber ALLE Migrationen gelesen — eine Automatik besteht aus Funktion
# UND Trigger, und die beiden koennen in verschiedenen Dateien stehen.

# Saetze, die eine Automatik ausdruecklich bestreiten. Absichtlich woertlich
# und kurz gehalten: ein schlauer Abgleich haette hier Fehlalarme, und ein
# Pruefer mit Fehlalarmen wird abgeschaltet und nie wieder an.
BESTREITUNGEN = [
    'Eine automatisierte Entscheidung über Maßnahmen findet nicht statt',
    'Eine automatisierte Entscheidung findet nicht statt',
    'ohne automatisierte Entscheidung',
]


def sql_ohne_kommentare(text: str) -> str:
    return '\n'.join(re.sub(r'--.*$', '', z) for z in text.split('\n'))


def main() -> int:
    befunde = []
    agb = AGB.read_text(encoding='utf-8')
    sql = sql_ohne_kommentare('\n'.join(
        d.read_text(encoding='utf-8') for d in sorted(MIGRATIONEN.glob('*.sql'))))
    ds = DATENSCHUTZ.read_text(encoding='utf-8')

    # Gibt es die Automatik ueberhaupt (noch)?
    automatik = (
        'apply_leak_strikes' in sql
        and 'insert into public.provider_strikes' in sql
        and re.search(r'create trigger\s+trg_apply_leak_strikes\b', sql) is not None
    )

    if automatik:
        for satz in BESTREITUNGEN:
            if satz in agb:
                befunde.append(
                    f'Die AGB sagen „{satz}", aber 0720 vergibt den Strike per '
                    'Trigger ohne Zutun eines Menschen. Ein unwahrer Satz in den '
                    'eigenen AGB, und er widerspricht der Datenschutzerklaerung.')
        if 'ohne Zutun eines Menschen' not in agb:
            befunde.append(
                'Die AGB benennen die eine automatische Massnahme nicht. '
                'Art. 17 Abs. 3 DSA verlangt die Angabe, ob automatisierte '
                'Mittel eingesetzt wurden; §8(4) ist die Stelle dafuer.')
        if 'Automatisierte Entscheidungen' not in ds or 'ohne Zutun eines Menschen' not in ds:
            befunde.append(
                'Die Datenschutzerklaerung legt die automatische Entscheidung '
                'nicht mehr offen (Art. 22 Abs. 3, Art. 13 Abs. 2 lit. f DSGVO).')
    else:
        # Die Automatik ist weg — dann darf die Bestreitung wieder dastehen,
        # aber die Offenlegung waere dann falsch. Auch das ist ein Befund.
        if 'ohne Zutun eines Menschen' in ds:
            befunde.append(
                'Die Datenschutzerklaerung legt eine automatische Entscheidung '
                'offen, die es in den Migrationen nicht mehr gibt.')

    for b in befunde:
        print(f'BEFUND: {b}')
    if befunde:
        print(f'\n{len(befunde)} Befund(e) im Abgleich AGB / Datenschutz / Code.')
        return 1
    print('AGB, Datenschutzerklaerung und Strike-Automatik stimmen ueberein.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
