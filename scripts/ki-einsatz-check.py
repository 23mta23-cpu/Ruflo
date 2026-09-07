#!/usr/bin/env python3
"""Schlägt an, sobald Werkant ein KI-System einsetzt.

ANLASS (07.09.2026): Der Founder fragte nach dem EU AI Act. Gemessen ergab
sich: Werkant setzt KEIN KI-System ein — kein LLM, kein ML-Modell, keine
Embeddings, und das Matching in notify-matching-providers ist ein `.filter()`.
Damit greift die KI-VO (EU) 2024/1689 nicht.

Diese Feststellung ist ein Momentaufnahme-Befund und wird mit dem ersten
eingebauten Modell falsch. Ein Dossier, das dann noch "keine KI" behauptet,
ist schlimmer als keines — deshalb dieser Prüfer.

WAS ER LEISTET: er meldet, wenn eine KI-Abhängigkeit oder ein KI-Aufruf in den
Produktcode kommt. Dann ist zu prüfen, in welche Risikoklasse der Einsatz
fällt, und Art. 50 (Transparenzpflichten) ist fast immer einschlägig, sobald
Nutzer mit dem System interagieren.

WAS ER NICHT LEISTET: er beurteilt nicht, ob ein Einsatz zulässig ist, und er
findet keine KI, die über eine selbstgebaute HTTP-Schnittstelle ohne diese
Namen angesprochen wird. Er ist ein Wecker, kein Gutachten.

GRENZE der Suche: geprüft wird der PRODUKTcode (app/, lib/, components/,
supabase/functions/, hooks/, contexts/). Werkzeuge unter scripts/ und die
Entwicklungsumgebung sind ausdrücklich ausgenommen — dass dieses Repo mit einem
Sprachmodell entwickelt wird, ist für die KI-VO ohne Belang: geregelt ist das
in Verkehr gebrachte System, nicht das Werkzeug seiner Herstellung.
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PRODUKT = ['app', 'lib', 'components', 'hooks', 'contexts', 'supabase/functions']
ENDUNGEN = {'.ts', '.tsx', '.js', '.jsx'}

# Namen, die einen KI-Einsatz belegen. Bewusst eng: ein Prüfer mit Fehlalarmen
# wird abgeschaltet und nie wieder an.
MUSTER = [
    (r'\bopenai\b',                       'OpenAI'),
    (r'@anthropic-ai/|\banthropic\.\w',   'Anthropic SDK'),
    (r'\bgoogle-?generativeai\b|@google/generative-ai', 'Google Generative AI'),
    (r'\bhuggingface\b|@huggingface/',    'Hugging Face'),
    (r'\b@tensorflow/|\bonnxruntime\b',   'TensorFlow / ONNX'),
    (r'\bmlkit\b|@react-native-ml-kit',   'ML Kit'),
    (r'\bembeddings?\.(create|generate)\b', 'Embedding-Erzeugung'),
    (r'\bchat\.completions\b',            'Chat-Completions-Schnittstelle'),
    (r'\bgpt-[45]\b|\bclaude-\w+-\d',     'Modellkennung im Produktcode'),
]

# package.json getrennt prüfen: eine Abhängigkeit zählt auch dann, wenn sie
# noch nirgends aufgerufen wird — sie ist die Vorbereitung.
PAKETE = ['openai', '@anthropic-ai/sdk', '@google/generative-ai',
          '@huggingface/inference', '@tensorflow/tfjs', 'onnxruntime-react-native']


def main() -> int:
    treffer: list[str] = []

    import json
    pkg = json.loads((REPO / 'package.json').read_text(encoding='utf-8'))
    deps = set(pkg.get('dependencies', {})) | set(pkg.get('devDependencies', {}))
    for name in PAKETE:
        if name in deps:
            treffer.append(f"package.json: Abhängigkeit {name}")

    dateien = 0
    for ordner in PRODUKT:
        wurzel = REPO / ordner
        if not wurzel.exists():
            continue
        for pfad in wurzel.rglob('*'):
            if pfad.suffix not in ENDUNGEN or not pfad.is_file():
                continue
            dateien += 1
            try:
                text = pfad.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            for zeile_nr, zeile in enumerate(text.splitlines(), 1):
                # Kommentare übergehen: dieser Prüfer soll auf EINSATZ anschlagen,
                # nicht auf eine Notiz, die den Nicht-Einsatz beschreibt.
                nackt = zeile.strip()
                if nackt.startswith(('//', '*', '/*', '#')):
                    continue
                for muster, was in MUSTER:
                    if re.search(muster, zeile, re.I):
                        rel = pfad.relative_to(REPO)
                        treffer.append(f"{rel}:{zeile_nr}: {was} — {nackt[:90]}")

    # Eine leere Suche wäre still grün — dieselbe Klasse wie ein leerer Glob.
    if dateien < 50:
        print(f"ABBRUCH: nur {dateien} Produktdateien durchsucht (erwartet >= 50) — falscher Pfad?")
        return 1

    if treffer:
        print("KI-Einsatz im Produktcode gefunden:")
        for t in treffer:
            print(f"  {t}")
        print()
        print("Damit ist die Feststellung in docs/recht/ki-vo-und-bfsg.md überholt.")
        print("Zu prüfen, bevor das ausgeliefert wird:")
        print("  - Risikoklasse nach KI-VO (EU) 2024/1689 bestimmen.")
        print("  - Art. 50: interagieren Nutzer mit dem System, müssen sie es erfahren.")
        print("  - Art. 17 DSA: werden damit Entscheidungen über Beschränkungen")
        print("    getroffen, ist 'automatisiert' in beschraenkungen auf true zu setzen")
        print("    und AGB §11 Absatz 4 zu berichtigen.")
        print("  - Das Dossier fortschreiben, nicht diesen Prüfer abschalten.")
        return 1

    print(f"Kein KI-Einsatz im Produktcode ({dateien} Dateien geprüft). KI-VO nicht einschlägig.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
