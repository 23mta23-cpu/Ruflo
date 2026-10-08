#!/usr/bin/env python3
"""Kein Datenabfluss an einen Dienst, der nirgends steht.

ANLASS (08.10.2026, Founder mit einem Anwalts-Beitrag: „Ueber die
Cloud-Konnektoren flossen Kundendaten ungeprueft auf US-Server."). Die Frage
„welches Tool zapft welche Datenbank an" soll nicht von Hand beantwortet
werden muessen, sondern bei jedem Lauf.

Geprueft:
  1. Jeder externe Host im Produktcode (Edge Functions, lib, app,
     components) gehoert zu einem bekannten Dienst, und jeder solche Dienst
     steht im Verarbeitungsverzeichnis UND in der Datenschutzerklaerung.
     Ein neuer Host (etwa eine KI-API) faellt sofort auf.
  2. Kein KI- oder Tracking-SDK in package.json, das nicht dort steht.
  3. Umgekehrt: jeder Auftragsverarbeiter aus dem Verarbeitungsverzeichnis
     ist in der Datenschutzerklaerung genannt (Art. 13 Abs. 1 lit. e DSGVO).
Ausnahmen (eigene Adressen, reine Links) tragen einen Grund und muessen im
Code noch vorkommen (Pruefregel 9).
"""
import json
import re
import sys
from pathlib import Path

W = Path(__file__).resolve().parent.parent
VVZ = W / "docs/recht/verarbeitungsverzeichnis.md"
DSE = W / "app/datenschutz.tsx"
ORDNER = ["supabase/functions", "lib", "app", "components"]

# Host-Endung -> Dienst (so, wie er im Verarbeitungsverzeichnis heisst).
DIENSTE = {
    "api.resend.com": "Resend",
    "exp.host": "Expo",
    "api.stripe.com": "Stripe",
    "supabase.co": "Supabase",
    "github.io": "GitHub",
}
# Kein Abfluss: eigene Adressen oder reine Verweise im Text.
AUSNAHMEN = {
    "werkant.de": "eigene Domain (Links, Absender)",
    "ldi.nrw.de": "Link auf die Aufsichtsbehoerde in der Datenschutzerklaerung",
}
# SDKs, die Daten an Dritte schicken koennen: muessen als Dienst stehen.
SDK_MUSTER = {
    r"stripe": "Stripe",
    r"expo-notifications": "Expo",
    r"anthropic|openai|langchain|generative-ai|@google/genai|mistral|cohere": "KI-Anbieter",
    r"posthog|sentry|mixpanel|amplitude|segment|firebase|datadog|hotjar": "Tracking",
}
HOST = re.compile(r"https://([a-z0-9.-]+\.[a-z]{2,})", re.I)


def code_zeilen(datei: Path):
    for nr, zeile in enumerate(datei.read_text(encoding="utf-8").splitlines(), 1):
        s = zeile.strip()
        if s.startswith(("//", "*", "/*", "#")):
            continue
        # Import-Adressen (esm.sh, deno.land) laden CODE beim Deploy, sie
        # empfangen keine Nutzerdaten. Nur die URL im import entfernen.
        zeile = re.sub(r"""(?:from|import)\s*["']https://[^"']+["']""", "", zeile)
        yield nr, zeile


def main() -> int:
    fehler = []
    vvz, dse = VVZ.read_text(encoding="utf-8"), DSE.read_text(encoding="utf-8")
    genutzt, ausnahme_gesehen = {}, set()

    for o in ORDNER:
        for datei in sorted((W / o).rglob("*.ts*")):
            if "node_modules" in datei.parts or datei.name.endswith(".d.ts"):
                continue
            for nr, zeile in code_zeilen(datei):
                for host in HOST.findall(zeile):
                    host = host.lower()
                    ausn = next((a for a in AUSNAHMEN if host.endswith(a)), None)
                    if ausn:
                        ausnahme_gesehen.add(ausn)
                        continue
                    dienst = next((d for h, d in DIENSTE.items() if host.endswith(h)), None)
                    if not dienst:
                        fehler.append(f"{datei.relative_to(W)}:{nr}: unbekannter Host {host} "
                                      "-- Dienst ins Verarbeitungsverzeichnis, Datenschutzerklaerung, AVV")
                    else:
                        genutzt.setdefault(dienst, f"{datei.relative_to(W)}:{nr}")

    pkg = json.loads((W / "package.json").read_text(encoding="utf-8"))
    for name in {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}:
        for muster, dienst in SDK_MUSTER.items():
            if re.search(muster, name, re.I):
                genutzt.setdefault(dienst, f"package.json: {name}")

    for dienst, wo in sorted(genutzt.items()):
        if dienst not in vvz:
            fehler.append(f"{dienst} ({wo}) fehlt im Verarbeitungsverzeichnis")
        if dienst not in dse:
            fehler.append(f"{dienst} ({wo}) fehlt in der Datenschutzerklaerung")

    # Umgekehrt: jeder Auftragsverarbeiter aus der Tabelle steht in der DSE.
    tabelle = re.search(r"\| Dienst \| Wofür.*?\n\n", vvz, re.S)
    for zeile in (tabelle.group(0).splitlines()[2:] if tabelle else []):
        name = zeile.strip("| ").split("|")[0].strip().split(" ")[0]
        if name and name not in dse:
            fehler.append(f"Auftragsverarbeiter {name} steht im Verzeichnis, nicht in der Datenschutzerklaerung")

    for a, grund in AUSNAHMEN.items():
        if a not in ausnahme_gesehen:
            fehler.append(f"Ausnahme {a} ({grund}) kommt im Code nicht mehr vor: streichen")

    for f in fehler:
        print("FAIL", f)
    print(f"{len(genutzt)} Dienste im Code, {len(fehler)} Befunde.")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
