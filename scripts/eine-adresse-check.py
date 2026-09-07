#!/usr/bin/env python3
"""Baut sich jemand die Server-Adresse selbst zusammen?

ANLASS (07.09.2026, am LIVE-Bundle nachgewiesen): Sechs Bildschirme hatten
je eine eigene Zeile

    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

und riefen damit `${SUPABASE_URL}/functions/v1/...` auf. In der
veroeffentlichten Fassung ist die Umgebungsvariable leer (static.yml setzt
`secrets.… || ''`), die Konstante also der leere String — die App rief
https://23mta23-cpu.github.io/functions/v1/release-escrow auf, worauf GitHub
Pages mit 405 antwortet.

Kaputt waren damit: Zahlung, Freigabe des Treuhandbetrags, Stornierung durch
beide Seiten, Kontoloeschung (Art. 17 DSGVO) und Datenexport (Art. 15). Also
jeder Knopf, hinter dem eine Edge Function steht. Sichtbar war davon nichts.

WARUM EIN QUELLTEXT-PRUEFER und kein Test: Das ist eine Frage der VERDRAHTUNG
— haengt der Aufruf an der einen aufgeloesten Adresse oder an einer eigenen?
Ein Laufzeit-Test kann das nicht belegen, weil beide Varianten in der
Entwicklungsumgebung (mit gesetzter Variable) denselben Wert ergeben und
gruen waeren. Dieselbe Lehre wie beim Impressum-Test, der eine Bindung nicht
beweisen konnte, weil beide Seiten zufaellig denselben Text hatten.

GRENZE: geprueft wird auf die bekannten Schreibweisen. Wer die Adresse ueber
eine Zwischenvariable mit anderem Namen zusammensetzt, faellt hier nicht auf.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
ERLAUBT = {'lib/supabase.ts'}   # die eine Stelle, an der die Adresse entsteht

# Direkter Zugriff auf die Umgebungsvariable ausserhalb von lib/supabase.ts.
UMGEBUNG = re.compile(r"process\.env[\.\[]\s*'?\"?EXPO_PUBLIC_SUPABASE_URL")
# Ein Functions-Aufruf, der NICHT ueber SUPABASE_FUNCTIONS_URL laeuft.
AUFRUF = re.compile(r"`\$\{(?!SUPABASE_FUNCTIONS_URL)[^}]+\}/functions/v1/")

def main() -> int:
    fehler = 0
    geprueft = 0
    for pfad in sorted(list((WURZEL / 'app').rglob('*.tsx'))
                       + list((WURZEL / 'lib').rglob('*.ts'))
                       + list((WURZEL / 'components').rglob('*.tsx'))):
        rel = pfad.relative_to(WURZEL).as_posix()
        if rel in ERLAUBT:
            continue
        geprueft += 1
        text = pfad.read_text(encoding='utf-8')
        for nr, zeile in enumerate(text.splitlines(), 1):
            if UMGEBUNG.search(zeile):
                print(f"FAIL  {rel}:{nr} baut die Adresse selbst aus process.env")
                print(f"      -> stattdessen SUPABASE_FUNCTIONS_URL aus lib/supabase importieren")
                fehler += 1
            if AUFRUF.search(zeile):
                print(f"FAIL  {rel}:{nr} ruft eine Edge Function ueber eine eigene Basisadresse auf")
                fehler += 1

    print(f"\n{geprueft} Dateien geprueft, {fehler} Abweichung(en).")
    if fehler == 0:
        print("Alle Aufrufe von Edge Functions haengen an der einen aufgeloesten Adresse.")
    return 1 if fehler else 0

if __name__ == '__main__':
    sys.exit(main())
