/**
 * Was laeuft im Hintergrund, und was liegt liegen?
 *
 * ANLASS (22.09.2026): drei Betreiber-Selbstauskuenfte in der Datenbank, und
 * kein Bildschirm zeigte sie. An zweien haengen Fristen mit Rechtsfolge.
 *
 * Geprueft wird hier die REGEL. Ob der Bildschirm die Saetze hinschreibt,
 * prueft Reise 15 im Browser -- die Rechnung kann gedeckt sein und die
 * Anzeige nicht (Lehre vom 22.09. frueh).
 */
import {
  betriebsstatus, dringendeAnzahl, zustellungMeldung, abnahmeMeldung, pstgMeldung,
  auszahlungMeldung,
} from '../lib/betriebsstatus';

const ZUSTELLUNG_OK = {
  offene_pflichtmitteilungen: 0, aelteste_offene_stunden: 0,
  stau: false, zeitplan_vorhanden: true,
};
const ABNAHME_OK = {
  zeitplan_vorhanden: true, letzter_lauf_am: '2026-09-22T03:00:00Z',
  letzter_lauf_erfolgreich: true, faellige_vertraege: 0,
  aeltester_faelliger_tage: 0, stau: false,
};
const AUSZAHLUNG_OK = {
  gesperrt: 0, gesperrt_cents: 0, aeltester_fall_stunden: 0,
  haengend: 0, haengend_cents: 0, stau: false,
};
const PSTG_OK = {
  melde_jahr: 2025, frist: '2026-01-31', tage_bis_frist: 131,
  meldepflichtige: 0, vorbereitet: 0, abgegeben: 0,
  lauf_fehlt: false, abgabe_fehlt: false, frist_verstrichen: false,
};

describe('zustellungMeldung (DSA Art. 17, Art. 4 P2B-VO)', () => {
  it('meldet einen fehlenden Zeitplan als dringend', () => {
    // Ohne stuendlichen Lauf erreicht eine geschuldete Uebermittlung
    // NIEMANDEN -- sie liegt nur in der Tabelle.
    const m = zustellungMeldung({ ...ZUSTELLUNG_OK, zeitplan_vorhanden: false });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/Zustell-Lauf/);
  });

  it('meldet unzugestellte Mitteilungen als dringend und nennt die Zahl', () => {
    const m = zustellungMeldung({
      ...ZUSTELLUNG_OK, offene_pflichtmitteilungen: 3, aelteste_offene_stunden: 26, stau: true,
    });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/3 Mitteilungen/);
    expect(m.text).toMatch(/26 Stunden/);
  });

  it('schreibt die Einzahl aus, statt ein „en" anzuhaengen', () => {
    // Deutsche Mehrzahl wird nie zusammengesetzt (Lehre vom 08.09.).
    const m = zustellungMeldung({ ...ZUSTELLUNG_OK, offene_pflichtmitteilungen: 1, stau: true });
    expect(m.text).toMatch(/1 Mitteilung unzugestellt/);
    expect(m.text).not.toMatch(/Mitteilungen/);
  });

  it('GEGENPROBE: bei gutem Stand meldet es „ok" und sagt trotzdem etwas', () => {
    // Ohne diese Probe waere „immer dringend" ein bestandener Test -- und ein
    // Bildschirm, auf dem alles rot ist, wird nicht mehr gelesen.
    const m = zustellungMeldung(ZUSTELLUNG_OK);
    expect(m.stufe).toBe('ok');
    expect(m.text.length).toBeGreaterThan(10);
  });

  it('meldet eine fehlende Auskunft als dringend, nicht als „in Ordnung"', () => {
    expect(zustellungMeldung(null).stufe).toBe('dringend');
  });
});

describe('abnahmeMeldung', () => {
  it('nennt beim fehlenden Zeitplan die Geldfolge', () => {
    const m = abnahmeMeldung({ ...ABNAHME_OK, zeitplan_vorhanden: false });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/Treuhandkonto/);
  });

  it('meldet ueberfaellige Auftraege mit Zahl und Alter', () => {
    const m = abnahmeMeldung({
      ...ABNAHME_OK, faellige_vertraege: 2, aeltester_faelliger_tage: 5, stau: true,
    });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/2 Aufträge/);
    expect(m.text).toMatch(/5 Tagen/);
    expect(m.text).not.toMatch(/Auftrage/);
  });

  it('GEGENPROBE: bei gutem Stand „ok"', () => {
    expect(abnahmeMeldung(ABNAHME_OK).stufe).toBe('ok');
  });
});

describe('pstgMeldung (§ 13, § 25 PStTG)', () => {
  it('trennt „Lauf fehlt" von „Abgabe fehlt"', () => {
    // 1010 hat die beiden Zustaende ausdruecklich getrennt, weil ein
    // einziges Kennzeichen den zweiten verdeckt, sobald der erste behoben
    // ist. Der Satz muss diese Trennung tragen.
    const lauf = pstgMeldung({ ...PSTG_OK, meldepflichtige: 4, lauf_fehlt: true, tage_bis_frist: 60 });
    const abgabe = pstgMeldung({ ...PSTG_OK, meldepflichtige: 4, abgabe_fehlt: true, tage_bis_frist: 60 });
    expect(lauf.text).toMatch(/Meldelauf/);
    expect(abgabe.text).toMatch(/BZSt/);
    expect(lauf.text).not.toBe(abgabe.text);
  });

  it('ist ab 30 Tagen vor der Frist dringend, davor ein Hinweis', () => {
    // Ein Fall mit Rest auf beiden Seiten der Grenze -- glatte Faelle
    // verbergen Rundungsfehler (Lehre vom 16.09.).
    const knapp = pstgMeldung({ ...PSTG_OK, meldepflichtige: 4, lauf_fehlt: true, tage_bis_frist: 30 });
    const frueh = pstgMeldung({ ...PSTG_OK, meldepflichtige: 4, lauf_fehlt: true, tage_bis_frist: 31 });
    expect(knapp.stufe).toBe('dringend');
    expect(frueh.stufe).toBe('hinweis');
  });

  it('nennt bei verstrichener Frist das Bussgeld', () => {
    const m = pstgMeldung({
      ...PSTG_OK, meldepflichtige: 4, abgabe_fehlt: true,
      tage_bis_frist: -3, frist_verstrichen: true,
    });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/§ 25/);
  });

  it('GEGENPROBE: ohne Meldepflichtige ist nichts zu tun', () => {
    const m = pstgMeldung(PSTG_OK);
    expect(m.stufe).toBe('ok');
    expect(m.text).toMatch(/2025/);
  });

  it('meldet abgegeben als ok, auch wenn es Meldepflichtige gab', () => {
    const m = pstgMeldung({ ...PSTG_OK, meldepflichtige: 4, vorbereitet: 4, abgegeben: 4 });
    expect(m.stufe).toBe('ok');
  });
});

describe('auszahlungMeldung (1030)', () => {
  // ANLASS: `payout_operations.status = 'manual_review'` kam im ganzen
  // Projekt nur in der Migration vor, die ihn setzt, und in den Deno-Tests.
  it('meldet eine gesperrte Auszahlung mit Zahl, Betrag und Alter', () => {
    const m = auszahlungMeldung({
      ...AUSZAHLUNG_OK, gesperrt: 2, gesperrt_cents: 64_215,
      aeltester_fall_stunden: 31, stau: true,
    });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/2 Auszahlungen sind gesperrt/);
    expect(m.text).toMatch(/642,15 €/);
    expect(m.text).toMatch(/31 Stunden/);
  });

  it('sagt, dass der Transfer schon gelaufen sein kann', () => {
    // Das ist der Unterschied zu den drei anderen Auskuenften: dort geht es
    // um Zeitplaene, hier um Geld, das Stripe moeglicherweise schon bewegt
    // hat. Wer das nicht liest, haelt es fuer eine Warteschlange.
    const m = auszahlungMeldung({ ...AUSZAHLUNG_OK, gesperrt: 1, gesperrt_cents: 100 });
    expect(m.text).toMatch(/bereits gelaufen/);
  });

  it('schreibt Einzahl und Mehrzahl aus, statt sie zusammenzusetzen', () => {
    const eins = auszahlungMeldung({ ...AUSZAHLUNG_OK, gesperrt: 1, gesperrt_cents: 100 });
    expect(eins.text).toMatch(/1 Auszahlung ist gesperrt/);
    expect(eins.text).not.toMatch(/Auszahlungn|Auszahlunge\b/);
  });

  it('meldet auch eine nie abgeschlossene Auszahlung', () => {
    const m = auszahlungMeldung({
      ...AUSZAHLUNG_OK, haengend: 1, haengend_cents: 29_880, stau: true,
    });
    expect(m.stufe).toBe('dringend');
    expect(m.text).toMatch(/298,80 €/);
  });

  it('nennt die GESPERRTEN zuerst, wenn beides zutrifft', () => {
    // Eine gesperrte Operation verlangt eine Entscheidung, eine haengende
    // vielleicht nur Geduld. Der wichtigere Satz gehoert nach vorn.
    const m = auszahlungMeldung({
      gesperrt: 1, gesperrt_cents: 500, aeltester_fall_stunden: 2,
      haengend: 3, haengend_cents: 900, stau: true,
    });
    expect(m.text).toMatch(/gesperrt/);
    expect(m.text).not.toMatch(/beansprucht/);
  });

  it('GEGENPROBE: ohne Vorgang meldet es „ok" und sagt trotzdem etwas', () => {
    const m = auszahlungMeldung(AUSZAHLUNG_OK);
    expect(m.stufe).toBe('ok');
    expect(m.text.length).toBeGreaterThan(10);
  });

  it('meldet eine fehlende Auskunft als dringend, nicht als „in Ordnung"', () => {
    expect(auszahlungMeldung(null).stufe).toBe('dringend');
  });
});

describe('betriebsstatus (die Liste)', () => {
  it('gibt immer alle drei aus, auch wenn alles in Ordnung ist', () => {
    // Ein Abschnitt, der bei gutem Stand LEER waere, sieht aus wie „nicht
    // geladen" -- dieselbe Klasse wie ein Netzfehler, der sich als leerer
    // Posteingang tarnt (21.09.).
    const l = betriebsstatus(ZUSTELLUNG_OK, ABNAHME_OK, PSTG_OK, AUSZAHLUNG_OK);
    expect(l).toHaveLength(4);
    expect(l.map((m) => m.kennung).sort())
      .toEqual(['abnahme', 'auszahlung', 'pstg', 'zustellung']);
  });

  it('stellt Dringendes nach oben', () => {
    const l = betriebsstatus(
      ZUSTELLUNG_OK,
      { ...ABNAHME_OK, zeitplan_vorhanden: false },
      { ...PSTG_OK, meldepflichtige: 4, lauf_fehlt: true, tage_bis_frist: 200 },
      AUSZAHLUNG_OK,
    );
    expect(l[0].kennung).toBe('abnahme');
    expect(l[0].stufe).toBe('dringend');
    expect(l[3].stufe).toBe('ok');
  });

  it('zaehlt nur die dringenden', () => {
    expect(dringendeAnzahl(betriebsstatus(ZUSTELLUNG_OK, ABNAHME_OK, PSTG_OK, AUSZAHLUNG_OK))).toBe(0);
    expect(dringendeAnzahl(betriebsstatus(null, null, null, null))).toBe(4);
  });

  it('jede Meldung traegt einen Satz, nie nur eine Ueberschrift', () => {
    for (const m of betriebsstatus(null, null, null, null)) {
      expect(m.text.trim().length).toBeGreaterThan(20);
    }
  });
});
