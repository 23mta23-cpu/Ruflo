#!/usr/bin/env python3
"""Ein Dokument darf niemanden zu einer Datei schicken, die es nicht gibt.

ANLASS (28.09.2026): `docs/go-live-checklist.md` schickte den Founder in die
GitHub-Einstellungen, um zwei Secrets fuer `.github/workflows/deploy-web.yml`
zu setzen. Diesen Workflow gibt es seit `9d3015b` nicht mehr; der Web-Bau
heisst `static.yml`, und beide Verbraucher haben einen Rueckfall, die Secrets
sind also gar nicht noetig. Schlimmer war die zweite Fundstelle: CLAUDE.md
nannte die Anbieter-Bildschirme unter `app/(provider)/`, umbenannt zu
`app/betrieb/` in PR #173. Das ist die Wegweiser-Zeile, die JEDE Session zu
Beginn liest.

GEMESSEN vor dem Bau (damit es niemand zweimal tut):
  Weite Fassung  (jeder Dateiname in Backticks, alle Dokumente):
      253 Kandidaten, fast alle Fehlalarme. Ein blosser Dateiname wie
      `run.sh` ist in Prosa eine Kurzform, kein Pfad zum Eintippen.
  Mittlere Fassung (nur Pfade MIT Verzeichnis):
      25 Kandidaten, 24 davon Prosa-Kurzformen der Art
      `stripe-webhook/handler.ts` (ohne `supabase/functions/` davor).
  Diese Fassung (nur Pfade ab einem echten Wurzelverzeichnis,
                 nur gegenwartsbezogene Dokumente):
      282 Pfad-Nennungen in 42 Dokumenten, 2 begruendete Ausnahmen,
      0 Fehlalarme.

Die Messung entscheidet, ob es einen Pruefer gibt. Bei 24 von 25 Fehlalarmen
haette ihn der erste Lauf abgeschaltet; bei 2 von 282 lohnt er sich.

MUTATIONEN (gemessen, je eine pro Richtung):
  R1  CLAUDE.md-Wegweiser zurueck auf `app/(provider)/`       -> rot
  R1  `deploy-web.yml` wieder in der Checkliste               -> rot
  R2  eine veraltete Ausnahme eingetragen                     -> rot, R1 gruen
  R3  Auswahl auf `docs/architecture/*.md` verkleinert, so dass
      beide Ausnahmen weiter vorkommen                        -> rot ALLEIN
      (R1 und R2 bleiben gruen)
  R4  App-Struktur unter eine Session-Ueberschrift geschoben  -> rot ALLEIN
      (als Mindestzahl war R4 GRUEN geblieben: nur 2 von 9 Nennungen
       fielen weg. Deshalb die Marke statt eines Zaehlers.)
  Gegenproben: Reihenfolge getauscht, Satz umformuliert, ein Pfad genannt,
  den es gibt -> alle drei gruen. Ohne sie waere ein Pruefer denkbar, der bei
  jeder Beruehrung anschlaegt, und der wird abgeschaltet und nie wieder an.

  Die erste Fassung von R3 (docs-Auswahl trifft gar nichts) wurde ueber
  RICHTUNG 2 rot, nicht ueber die Mindestzahl: die Ausnahmen verschwanden
  mit der Auswahl. Eine Zusicherung, fuer die man keine Mutation findet,
  die NUR sie rot macht, ist eine Kopie.

ABSICHTLICH NICHT GEPRUEFT:
  - `docs/SESSION_HANDOFF.md` ist eine Chronik: sie beschreibt Vergangenes,
    und ein Pfad, den es damals gab, darf dort stehen bleiben.
  - `docs/adr/` sind datierte Entscheidungs-Datensaetze. ADR 0004 nennt
    `(provider)/profil.tsx`; das war zum Zeitpunkt der Entscheidung richtig.
    Einen ADR nachtraeglich umzuschreiben hiesse, die Historie zu faelschen.
  - `notes/` ebenso (14 Nennungen gemessen, alle historisch korrekt:
    alte dreistellige Migrationsnamen, ein fremdes Repo, ein archivierter
    Bildschirm, der im selben Satz als archiviert bezeichnet wird).
  - Pfade OHNE Wurzelverzeichnis. Siehe Messung oben.
"""

import os
import re
import sys
import glob

WURZELN = (
    ".github/", "supabase/", "app/", "lib/", "scripts/", "docs/",
    "notes/", "constants/", "components/", "__tests__/", "archive/",
)

# Mit Dateiendung ODER auf einen Schraegstrich endend: `app/(provider)/` hat
# keine Endung und war trotzdem die teuerste Fundstelle.
PFAD = re.compile(
    r"`([A-Za-z0-9_.][A-Za-z0-9_./()-]*"
    r"(?:\.(?:ts|tsx|sql|ya?ml|json|md|sh|cjs|py|html)|/))`"
)

# Jede Ausnahme mit Grund. Schluessel ist (Datei, Pfad).
AUSNAHMEN = {
    ("docs/architecture/STRIPE-CONNECT-ONBOARDING-PLAN.md",
     "supabase/tests/connect-onboarding_test.ts"):
        "Steht unter 'Neue Dateien:'. Ein Plan darf nennen, was noch zu bauen ist.",
    ("docs/architecture/STRIPE-CONNECT-ONBOARDING-PLAN.md",
     "app/betrieb/stripe-rueckkehr.tsx"):
        "Steht unter 'Neue Dateien:'. Siehe oben.",
}

# GEMESSEN am 28.09.2026: 42 Dokumente, 282 Nennungen. Die Untergrenze liegt
# deutlich darunter und ist damit kein Fehlalarm bei normalem Wachstum; sie
# faengt den Fall, dass die Dateiauswahl still nichts mehr trifft und der
# Pruefer trivial gruen wird. Geraten waere sie ein eingebauter Fehlalarm.
MIN_DOKUMENTE = 30
MIN_NENNUNGEN = 200


# CLAUDE.md ist ZWEI Dokumente in einem: bis zur ersten Ueberschrift
# "## Session ..." ist es der Wegweiser (Pruef-Regeln, Projekt-Wissen,
# Design System, App-Struktur), danach eine datierte Chronik wie der Handoff.
# Ein Rueckblick, der einen toten Pfad NENNT ("umbenannt zu app/betrieb/"),
# ist kein Wegweiser. Genau daran ist dieser Pruefer beim ersten Lauf nach
# seiner eigenen Dokumentation angeschlagen: wer nach einem Muster sucht,
# darf es nicht danebenschreiben.
# Seit 29.09.2026 steht die Chronik in docs/lehren/CHRONIK.md. Geschichte ist
# in CLAUDE.md nur noch der automatische headroom-Block (er beschreibt
# beobachtete Aufrufe frueherer Sitzungen, mit den Pfaden von damals).
# `## Session ` bleibt als Grenze, falls doch wieder ein datierter Abschnitt
# hier landet.
CHRONIK_AB = {"CLAUDE.md": re.compile(r"^(## Session |<!-- headroom:learn:start -->)")}

# GRENZE, die dazugehoert: ein toter Pfad, der NUR in einem datierten
# Abschnitt steht, faellt hier nicht auf. Dieselbe Grenze wie beim Handoff.
#
# Damit die Chronik-Grenze nicht still den Wegweiser mitnimmt, muss diese
# Marke VOR ihr stehen. Eine blosse Mindestzahl reicht dafuer NICHT:
# GEMESSEN am 28.09.2026 verlor das Verschieben der App-Struktur nur 2 von
# 9 Nennungen (die uebrigen 7 stehen darueber), und ein Zaehler-Boden blieb
# gruen. Zugesichert wird deshalb die Zeile selbst, um die es geht.
PFLICHT_IM_WEGWEISER = {"CLAUDE.md": ["**App-Struktur:**"]}


def zeilen(pfad: str):
    """Liefert (Nummer, Zeile) und bricht an der Chronik-Grenze ab."""
    grenze = CHRONIK_AB.get(pfad)
    with open(pfad, encoding="utf-8") as f:
        for nr, z in enumerate(f, 1):
            if grenze and grenze.match(z):
                return
            yield nr, z


def dokumente() -> list[str]:
    fest = [d for d in ("CLAUDE.md", "AGENTS.md") if os.path.exists(d)]
    aus_docs = [
        d for d in sorted(glob.glob("docs/**/*.md", recursive=True))
        if "SESSION_HANDOFF" not in d and "/adr/" not in d
        # Datierte Lehren, ausgelagert aus CLAUDE.md (29.09.2026): ein Pfad,
        # den es damals gab, darf dort stehen bleiben.
        and "docs/lehren/CHRONIK.md" not in d
    ]
    return fest + aus_docs


def main() -> int:
    doks = dokumente()
    nennungen = 0
    fehlend: list[tuple[str, int, str, str]] = []
    gesehen: set[tuple[str, str]] = set()

    for d in doks:
        for nr, zeile in zeilen(d):
            for p in PFAD.findall(zeile):
                if not p.startswith(WURZELN):
                    continue
                nennungen += 1
                if os.path.exists(p):
                    continue
                gesehen.add((d, p))
                if (d, p) in AUSNAHMEN:
                    continue
                fehlend.append((d, nr, p, zeile.strip()[:100]))

    fehler = 0

    # Richtung 1: kein Wegweiser darf ins Leere zeigen.
    if fehlend:
        fehler += len(fehlend)
        print(f"{len(fehlend)} Pfad(e) in gegenwartsbezogenen Dokumenten existieren nicht:\n")
        for d, nr, p, z in fehlend:
            print(f"  {d}:{nr}")
            print(f"    {p}")
            print(f"    {z}\n")

    # Richtung 2: eine Ausnahmeliste ohne Verfallspruefung prueft irgendwann
    # weniger, als ihr Name sagt.
    verfallen = sorted(set(AUSNAHMEN) - gesehen)
    if verfallen:
        fehler += len(verfallen)
        print(f"{len(verfallen)} Ausnahme(n) kommen nicht mehr vor und gehoeren entfernt:\n")
        for d, p in verfallen:
            print(f"  {d}: {p}")
        print()

    # Richtung 3: die Dateiauswahl selbst darf nicht still leerlaufen.
    if len(doks) < MIN_DOKUMENTE or nennungen < MIN_NENNUNGEN:
        fehler += 1
        print(
            f"Die Auswahl trifft zu wenig: {len(doks)} Dokumente "
            f"(erwartet mindestens {MIN_DOKUMENTE}), {nennungen} Pfad-Nennungen "
            f"(erwartet mindestens {MIN_NENNUNGEN}).\n"
            "Entweder ist die Dateiauswahl kaputt, oder es wurde viel geloescht.\n"
        )

    for datei, marken in PFLICHT_IM_WEGWEISER.items():
        text = "".join(zeile for _, zeile in zeilen(datei))
        for marke in marken:
            if marke not in text:
                fehler += 1
                print(
                    f"{datei}: {marke!r} steht nicht mehr vor der "
                    "Chronik-Grenze.\n"
                    "Ist der Wegweiser-Teil unter eine Session-Ueberschrift "
                    "gerutscht? Dann wird er still nicht mehr geprueft.\n"
                )

    if fehler:
        print(f"FAIL: {fehler} Befund(e).")
        return 1

    print(
        f"PASS: {nennungen} Pfad-Nennungen in {len(doks)} Dokumenten, "
        f"alle vorhanden ({len(AUSNAHMEN)} begruendete Ausnahmen)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
