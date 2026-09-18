/**
 * Was der Betrieb liest, wenn er die Start-PIN eintippt.
 *
 * GRENZE, ausdruecklich: dieser Test prueft den WORTLAUT und die Zuordnung
 * Zustand -> Meldung. Er kann NICHT beweisen, dass die Zahlen im Text die der
 * Datenbank sind -- ein Wertvergleich kann eine Bindung nicht belegen, wenn
 * beide Seiten denselben Wert haben (16.08., 16.09.). Dafuer gibt es
 * `scripts/startpin-beleg-check.py`, der 0960 gegen lib/startPinText.ts liest.
 */
import {
  startPinMeldung,
  istVollstaendigeEingabe,
  STARTPIN_VERSUCHE,
  STARTPIN_SPERRE_MINUTEN,
  type StartPinZustand,
} from '../lib/startPinText';

const ALLE: StartPinZustand[] = [
  'ok', 'falsch', 'gesperrt', 'schon_begonnen', 'keine_pin', 'nicht_berechtigt', 'fehler',
];

describe('startPinMeldung', () => {
  it('kennt jeden Zustand und gibt nie eine leere Meldung', () => {
    for (const z of ALLE) {
      const m = startPinMeldung(z);
      expect(m.titel.length).toBeGreaterThan(3);
      expect(m.text.length).toBeGreaterThan(10);
    }
  });

  it('meldet Erfolg AUSSCHLIESSLICH bei ok', () => {
    // Der gefaehrliche Fall ist nicht "ok ist kein Erfolg", sondern ein
    // Fehlversuch, der wie ein Erfolg aussieht: der Betrieb faengt an zu
    // arbeiten und der Beleg fehlt.
    for (const z of ALLE) {
      expect(startPinMeldung(z).erfolg).toBe(z === 'ok');
    }
  });

  it('sagt bei einem Netzfehler NICHT, die Zahl sei falsch', () => {
    // Sonst zaehlt der Betrieb im Kopf einen Fehlversuch mit, den es nie gab.
    const m = startPinMeldung('fehler');
    expect(m.text).not.toMatch(/falsch|stimmt nicht/i);
    expect(m.titel).not.toMatch(/falsch|stimmt nicht/i);
  });

  it('nennt bei der Sperre dieselben Zahlen wie die Konstanten', () => {
    const m = startPinMeldung('gesperrt');
    expect(m.text).toContain(String(STARTPIN_VERSUCHE));
    expect(m.text).toContain(String(STARTPIN_SPERRE_MINUTEN));
  });

  it('sagt dem Betrieb bei der Sperre, dass der Auftraggeber es erfaehrt', () => {
    // Das ist keine Nettigkeit: 0960 schickt die Mitteilung wirklich los
    // (SP13). Ein Text, der es verschweigt, waere eine Luecke zwischen dem,
    // was passiert, und dem, was der Betroffene weiss.
    expect(startPinMeldung('gesperrt').text).toMatch(/Auftraggeber/);
  });

  it('erklaert bei keine_pin den Grund statt einen Fehler zu behaupten', () => {
    expect(startPinMeldung('keine_pin').text).toMatch(/Nachbarschaftshilfe/);
  });
});

describe('istVollstaendigeEingabe', () => {
  it('nimmt genau vier Ziffern', () => {
    expect(istVollstaendigeEingabe('0000')).toBe(true);
    expect(istVollstaendigeEingabe('9814')).toBe(true);
  });

  it('weist alles andere ab', () => {
    for (const e of ['', '1', '123', '12345', '12a4', ' 1234', '1234 ', 'abcd']) {
      expect(istVollstaendigeEingabe(e)).toBe(false);
    }
  });
});
