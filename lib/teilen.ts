import { Platform, Share } from 'react-native';

/**
 * Text weitergeben, auf jedem Geraet auf dem Weg, den es dort gibt.
 *
 * ANLASS (gemessen am 16.09.2026): `Share.share` aus react-native ist auf
 * react-native-web die Web Share API. Die gibt es in den meisten
 * Desktop-Browsern NICHT, und react-native-web wirft dann
 * `Error: Share is not supported in this browser`.
 *
 * Gemessen im Pruefstand: auf `/widerruf` lag KEIN try/catch um den Aufruf.
 * Der Nutzer fuellte das Formular vollstaendig aus, tippte „Widerruf
 * erklaeren", und es passierte NICHTS -- kein Formular, keine Meldung, kein
 * Erfolgsbildschirm. Dieselbe Klasse wie die Kalender-Knoepfe, nur im
 * gesetzlichen Widerrufsweg (§ 355 BGB, Art. 246a EGBGB).
 *
 * `app/einstellungen.tsx` hatte das richtige Muster laengst (Web-Weiche mit
 * Download). Es stand nur an einer Stelle statt an allen.
 *
 * Rueckgabe sagt, WAS passiert ist, damit der Bildschirm daraus die richtige
 * Meldung bauen kann statt Erfolg zu behaupten.
 */
export type TeilenErgebnis = 'geteilt' | 'heruntergeladen' | 'abgebrochen' | 'fehlgeschlagen';

export async function teileText(
  text: string,
  dateiname: string,
  titel?: string,
  typ = 'text/plain;charset=utf-8',
): Promise<TeilenErgebnis> {
  if (Platform.OS !== 'web') {
    try {
      const res = await Share.share(titel ? { message: text, title: titel } : { message: text });
      // Auf iOS meldet Share, ob der Nutzer abgebrochen hat.
      return (res as { action?: string })?.action === 'dismissedAction' ? 'abgebrochen' : 'geteilt';
    } catch {
      return 'fehlgeschlagen';
    }
  }

  // Web: erst der native Weg, wenn der Browser ihn hat (Safari, viele Handys).
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: object) => Promise<void> }) : undefined;
  if (nav?.share) {
    try {
      await nav.share(titel ? { text, title: titel } : { text });
      return 'geteilt';
    } catch {
      // Abbruch durch den Nutzer ODER kein Kanal. Weiter zum Download: eine
      // Datei zu bekommen ist besser als gar nichts.
    }
  }

  return ladeHerunter(text, dateiname, typ) ? 'heruntergeladen' : 'fehlgeschlagen';
}

/** Text als Datei anbieten. Getrennt, damit ein Test ihn ohne Browser prueft. */
function ladeHerunter(text: string, dateiname: string, typ: string): boolean {
  try {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
    const url = URL.createObjectURL(new Blob([text], { type: typ }));
    const a = document.createElement('a');
    a.href = url;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/** Der Satz, den ein Bildschirm nach dem Teilen anzeigen soll. */
export function teilenMeldung(ergebnis: TeilenErgebnis, dateiname: string): string {
  switch (ergebnis) {
    case 'geteilt':          return 'Der Text wurde weitergegeben.';
    case 'heruntergeladen':  return `Ihr Browser kann nicht direkt teilen. Der Text liegt jetzt als „${dateiname}" in Ihren Downloads.`;
    case 'abgebrochen':      return 'Abgebrochen. Es wurde nichts weitergegeben.';
    case 'fehlgeschlagen':   return 'Der Text konnte nicht weitergegeben werden. Bitte kopieren Sie ihn von Hand.';
  }
}
