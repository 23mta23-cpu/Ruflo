#!/usr/bin/env python3
"""Fordert die App nur Berechtigungen an, fuer die es auch eine Funktion gibt?

ANLASS (07.09.2026): app.json verlangte Kamera, Fotomediathek, Mikrofon
("Werkant benoetigt das Mikrofon fuer Sprachnachrichten im Chat") und PRAEZISEN
Standort. Es gibt keine Sprachnachrichten, keine Kamera, keinen Standort — weder
expo-camera noch expo-av noch expo-image-picker noch expo-location sind
ueberhaupt Abhaengigkeiten. Fuenf Zweckerklaerungen und sechs
Android-Berechtigungen ohne jede Funktion dahinter.

Das ist dieselbe Klasse wie ein Knopf ohne onPress: etwas sagt zu, was es nicht
tut. Nur teurer — Apple lehnt danach ab (App Review 5.1.1: Berechtigungen ohne
erkennbaren Zweck, dazu eine Zweckerklaerung, die eine nicht vorhandene Funktion
beschreibt), Google ebenso, und datenschutzrechtlich ist es eine angekuendigte
Verarbeitung ohne Zweck.

Zwei Betriebsarten:
  ohne Schalter   Fehler im Repo sind rot. Punkte, die nur der Founder setzen
                  kann (EAS-Kennung, echte Firmendaten), werden GENANNT, machen
                  den Lauf aber nicht rot — sonst waere die Pruefung dauerhaft
                  rot und wuerde abgeschaltet.
  --gate          Auch die Founder-Punkte sind rot. Das ist die Pruefung
                  unmittelbar vor einer Store-Einreichung.
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Welche Berechtigung wird durch welches Paket ueberhaupt erst nutzbar.
# Ein Eintrag hier heisst: "diese Berechtigung ist nur zu rechtfertigen, wenn
# mindestens eines dieser Pakete eine Abhaengigkeit ist."
IOS = {
    'NSCameraUsageDescription':          ['expo-camera', 'expo-image-picker'],
    'NSPhotoLibraryUsageDescription':    ['expo-image-picker', 'expo-media-library'],
    'NSPhotoLibraryAddUsageDescription': ['expo-image-picker', 'expo-media-library'],
    'NSMicrophoneUsageDescription':      ['expo-av', 'expo-audio', 'expo-camera'],
    'NSLocationWhenInUseUsageDescription':       ['expo-location'],
    'NSLocationAlwaysAndWhenInUseUsageDescription': ['expo-location'],
    'NSContactsUsageDescription':        ['expo-contacts'],
    'NSCalendarsUsageDescription':       ['expo-calendar'],
    'NSFaceIDUsageDescription':          ['expo-local-authentication'],
    'NSMotionUsageDescription':          ['expo-sensors'],
}

ANDROID = {
    'android.permission.CAMERA':                  ['expo-camera', 'expo-image-picker'],
    'android.permission.READ_EXTERNAL_STORAGE':   ['expo-image-picker', 'expo-media-library'],
    'android.permission.WRITE_EXTERNAL_STORAGE':  ['expo-media-library'],
    'android.permission.READ_MEDIA_IMAGES':       ['expo-image-picker', 'expo-media-library'],
    'android.permission.ACCESS_FINE_LOCATION':    ['expo-location'],
    'android.permission.ACCESS_COARSE_LOCATION':  ['expo-location'],
    'android.permission.RECORD_AUDIO':            ['expo-av', 'expo-audio', 'expo-camera'],
    'android.permission.RECEIVE_BOOT_COMPLETED':  ['expo-notifications'],
    'android.permission.VIBRATE':                 ['expo-notifications'],
    'android.permission.POST_NOTIFICATIONS':      ['expo-notifications'],
}

# expo-document-picker taucht bewusst NIRGENDS auf: der Dateiwaehler laeuft auf
# iOS ueber die Dateien-App und auf Android ueber SAF. Beide brauchen KEINE
# Berechtigung. Wer hier eine eintraegt, weil "es laedt ja etwas hoch", baut den
# Befund von heute wieder ein.


def main() -> int:
    gate = '--gate' in sys.argv
    app = json.loads((REPO / 'app.json').read_text(encoding='utf-8'))['expo']
    pkg = json.loads((REPO / 'package.json').read_text(encoding='utf-8'))
    deps = set(pkg.get('dependencies', {})) | set(pkg.get('devDependencies', {}))

    fehler: list[str] = []
    offen: list[str] = []

    plist = app.get('ios', {}).get('infoPlist', {})
    for schluessel, pakete in IOS.items():
        if schluessel in plist and not (deps & set(pakete)):
            fehler.append(
                f"ios.infoPlist.{schluessel} gesetzt, aber keines von {pakete} ist "
                f"eine Abhaengigkeit.\n      Text: {plist[schluessel]!r}"
            )

    erlaubt = app.get('android', {}).get('permissions', []) or []
    for rechte in erlaubt:
        pakete = ANDROID.get(rechte)
        if pakete is None:
            fehler.append(
                f"android.permissions enthaelt {rechte} — diesem Skript unbekannt. "
                f"Entweder eintragen (mit dem Paket, das sie braucht) oder streichen."
            )
        elif not (deps & set(pakete)):
            fehler.append(f"android.permissions enthaelt {rechte}, aber keines von {pakete} ist eine Abhaengigkeit.")

    # Ein Recht in beiden Listen ist ein Widerspruch, den der Build still in eine
    # Richtung aufloest — dann steht in der fertigen App etwas anderes als hier.
    gesperrt = set(app.get('android', {}).get('blockedPermissions', []) or [])
    for rechte in gesperrt & set(erlaubt):
        fehler.append(f"{rechte} steht gleichzeitig in permissions UND blockedPermissions.")

    # Zweckerklaerungen muessen eine Funktion beschreiben, die es gibt. Den Text
    # kann kein Skript beurteilen — die Existenz des Pakets schon, und das ist
    # oben abgedeckt. Hier nur der Hinweis auf leere Erklaerungen.
    for schluessel, text in plist.items():
        if schluessel.endswith('UsageDescription') and (not isinstance(text, str) or len(text.strip()) < 15):
            fehler.append(f"ios.infoPlist.{schluessel} hat keinen brauchbaren Zwecktext: {text!r}")

    # --- Punkte, die nur der Founder setzen kann ---------------------------
    eas = app.get('extra', {}).get('eas', {}).get('projectId', '')
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', str(eas)):
        offen.append(f"extra.eas.projectId ist keine echte Kennung ({eas!r}) — `npx eas-cli init` im Konto des Founders.")

    legal = (REPO / 'constants' / 'legal.ts').read_text(encoding='utf-8')
    if re.search(r'^export const LEGAL_PLACEHOLDER = true', legal, re.M):
        offen.append("constants/legal.ts: LEGAL_PLACEHOLDER = true — Impressum traegt noch Platzhalter.")
    if re.search(r'^export const IN_FOUNDING = true', legal, re.M):
        offen.append("constants/legal.ts: IN_FOUNDING = true — UG noch nicht eingetragen.")

    for zeile in fehler:
        print(f"  FEHLER: {zeile}")
    for zeile in offen:
        print(f"  OFFEN (Founder): {zeile}")

    if fehler:
        print(f"\n{len(fehler)} Befund(e) im Repo — Berechtigung ohne Funktion dahinter.")
        return 1
    if gate and offen:
        print(f"\n{len(offen)} offene(r) Founder-Punkt(e) — keine Store-Einreichung moeglich.")
        return 1
    print(f"Berechtigungen: keine ohne Funktion. Offen beim Founder: {len(offen)}.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
