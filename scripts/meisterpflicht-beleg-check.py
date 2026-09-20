#!/usr/bin/env python3
"""Die Meisterpflicht-Liste steht an zwei Stellen. Sie muessen gleich sein.

ANLASS (20.09.2026): bis 0980 wurde die Meisterpflicht nach der Freigabe
nirgends mehr geprueft. Die Datenbank kannte die Gewerke der Anlage A gar
nicht, also musste 0980 die Liste dorthin bringen -- und damit gibt es sie
zweimal:

  data/categories.ts               requiredDocs enthaelt 'MEISTERBRIEF'
  supabase/migrations/0980_*.sql   Tabelle meisterpflicht_gewerke

Eine zweite Liste ist eine Quelle fuer Abweichung. Faellt ein Gewerk in der
Oberflaeche unter die Meisterpflicht, in der Datenbank aber nicht, dann zeigt
der Auftrags-Trichter dem Kunden den Meisterpflicht-Hinweis und JEDER Betrieb
darf trotzdem bieten. Andersherum sperrt die Datenbank ein Gewerk, von dem die
Oberflaeche nichts sagt, und ein Betrieb sieht nur eine Fehlermeldung.

WARUM EIN QUELLTEXT-ABGLEICH UND KEIN TEST: ein Wertvergleich zur Laufzeit
koennte die BINDUNG nicht beweisen, solange beide Seiten zufaellig dasselbe
enthalten. Das ist im Projekt zweimal passiert (COMPANY.email gegen
MAIL.kontakt am 16.08., der Provisionssatz am 16.09.). Die Herkunft ist eine
Frage an den Quelltext.

GRENZE: geprueft wird die LISTE, nicht die Rechtslage. Ob ein Gewerk zur
Anlage A gehoert, entscheidet die Handwerksordnung und im Zweifel die
Handwerkskammer, nicht diese Datei.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
TS = WURZEL / 'data' / 'categories.ts'
SQL = WURZEL / 'supabase' / 'migrations' / '0980_meisterpflicht_gate.sql'


def aus_typescript() -> dict:
    """Jedes Gewerk, dessen requiredDocs 'MEISTERBRIEF' enthaelt."""
    text = TS.read_text(encoding='utf-8')
    muster = re.compile(
        r"\{\s*id:\s*'([a-z0-9-]+)',\s*name:\s*'([^']+)'.*?requiredDocs:\s*\[([^\]]*)\]",
        re.S)
    return {m.group(1): m.group(2) for m in muster.finditer(text)
            if 'MEISTERBRIEF' in m.group(3)}


def aus_sql() -> dict:
    """Die Zeilen des insert in meisterpflicht_gewerke."""
    text = SQL.read_text(encoding='utf-8')
    block = re.search(
        r"insert into public\.meisterpflicht_gewerke \(gewerk, name\) values(.*?);",
        text, re.S)
    if not block:
        return {}
    return dict(re.findall(r"\('([a-z0-9-]+)',\s*'([^']+)'\)", block.group(1)))


def main() -> int:
    ts, sql = aus_typescript(), aus_sql()
    befunde = []

    if not ts:
        befunde.append('In data/categories.ts steht kein einziges meisterpflichtiges '
                       'Gewerk. Entweder hat sich das Format geaendert, oder dieser '
                       'Pruefer liest ins Leere.')
    if not sql:
        befunde.append('In 0980 ist die Tabelle meisterpflicht_gewerke nicht mehr '
                       'befuellt. Ohne Liste sperrt das Tor niemanden.')

    for kennung in sorted(set(ts) - set(sql)):
        befunde.append(f'„{kennung}" ist in der Oberflaeche meisterpflichtig, in der '
                       'Datenbank nicht. Der Kunde bekommt den Hinweis, und bieten '
                       'darf trotzdem jeder.')
    for kennung in sorted(set(sql) - set(ts)):
        befunde.append(f'„{kennung}" sperrt die Datenbank, die Oberflaeche sagt davon '
                       'nichts. Der Betrieb saehe nur eine Fehlermeldung.')
    for kennung in sorted(set(ts) & set(sql)):
        if ts[kennung] != sql[kennung]:
            befunde.append(f'„{kennung}" heisst in der Oberflaeche „{ts[kennung]}" und in '
                           f'der Datenbank „{sql[kennung]}". Der Anzeigename ist der '
                           'Rueckfall fuer Auftraege ohne category_id (seit 0410 '
                           'moeglich) -- weicht er ab, faellt genau dieser Weg aus.')

    for b in befunde:
        print(f'BEFUND: {b}')
    if befunde:
        print(f'\n{len(befunde)} Befund(e) im Abgleich der Meisterpflicht-Listen.')
        return 1
    print(f'Meisterpflicht: Oberflaeche und Datenbank nennen dieselben '
          f'{len(ts)} Gewerke.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
