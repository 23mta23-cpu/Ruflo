/**
 * Welche offenen Auftraege zeigt der Betriebsbereich zuerst?
 *
 * Der Fall, auf den es ankommt, ist NICHT die Sortierung selbst. Es ist, dass
 * NICHTS verschwindet: im Kaltstart ist Sichtbarkeit fuer die wenigen
 * Auftraege mehr wert als Genauigkeit. Ein Filter waere die bequemere
 * Loesung und die falsche.
 */
import {
  sortiereAnfragen,
  passungVon,
  passungText,
  plzBereich,
  type Anfrage,
  type BetriebsProfil,
} from '../lib/anfragenSortierung';

const BETRIEB: BetriebsProfil = { gewerke: ['elektro', 'sanitaer'], plzBereich: '50' };

const A = (id: string, category_id: string | null, plz: string | null): Anfrage =>
  ({ id, category_id, address_plz: plz });

const BEIDES  = A('beides',  'elektro', '50667');
const GEWERK  = A('gewerk',  'elektro', '80331');
const REGION  = A('region',  'garten',  '50823');
const NICHTS  = A('nichts',  'garten',  '80331');

describe('sortiereAnfragen', () => {
  it('bringt Gewerk und Region nach oben, dann Gewerk, dann Region', () => {
    const sortiert = sortiereAnfragen([NICHTS, REGION, GEWERK, BEIDES], BETRIEB);
    expect(sortiert.map((a) => a.id)).toEqual(['beides', 'gewerk', 'region', 'nichts']);
  });

  it('wirft NICHTS weg', () => {
    // Der eigentliche Punkt. Ein Filter waere die bequemere Loesung und die
    // falsche: im Kaltstart soll ein Betrieb auch den Nachbarort sehen.
    const rein = [NICHTS, REGION, GEWERK, BEIDES];
    expect(sortiereAnfragen(rein, BETRIEB)).toHaveLength(rein.length);
  });

  it('haelt die eingehende Reihenfolge innerhalb einer Gruppe', () => {
    // Die Abfrage liefert neueste zuerst. Wer innerhalb der Gruppe umsortiert,
    // schiebt einen alten Auftrag ueber einen frischen.
    const a = A('a1', 'elektro', '50667');
    const b = A('b2', 'elektro', '50999');
    const c = A('c3', 'elektro', '50111');
    expect(sortiereAnfragen([a, b, c], BETRIEB).map((x) => x.id))
      .toEqual(['a1', 'b2', 'c3']);
  });

  it('kommt ohne Gewerke und ohne Postleitzahl zurecht', () => {
    const ohne: BetriebsProfil = { gewerke: [], plzBereich: null };
    const sortiert = sortiereAnfragen([BEIDES, NICHTS], ohne);
    expect(sortiert.map((a) => a.id)).toEqual(['beides', 'nichts']);
    expect(sortiert.every((a) => !a.passung.gewerk && !a.passung.region)).toBe(true);
  });
});

describe('passungVon', () => {
  it('erkennt Gewerk und Region einzeln', () => {
    expect(passungVon(BEIDES, BETRIEB)).toEqual({ gewerk: true,  region: true });
    expect(passungVon(GEWERK, BETRIEB)).toEqual({ gewerk: true,  region: false });
    expect(passungVon(REGION, BETRIEB)).toEqual({ gewerk: false, region: true });
    expect(passungVon(NICHTS, BETRIEB)).toEqual({ gewerk: false, region: false });
  });

  it('behauptet ohne Gewerk-Kennung keine Passung', () => {
    // `jobs.category_id` kann null sein. Eine fehlende Kennung ist keine
    // Uebereinstimmung, sondern eine fehlende Angabe.
    expect(passungVon(A('x', null, '50667'), BETRIEB).gewerk).toBe(false);
  });

  it('vergleicht nur den zweistelligen Bereich, nicht die ganze Zahl', () => {
    expect(passungVon(A('x', 'elektro', '50999'), BETRIEB).region).toBe(true);
    expect(passungVon(A('x', 'elektro', '51999'), BETRIEB).region).toBe(false);
  });
});

describe('plzBereich', () => {
  it('nimmt die ersten zwei Ziffern', () => {
    expect(plzBereich('50667')).toBe('50');
  });

  it('gibt null zurueck, wo keine zwei Ziffern stehen', () => {
    // Lieber keine Aussage als eine falsche: ohne Postleitzahl passt niemand.
    // Dieselbe Entscheidung wie in notify-matching-providers/auswahl.ts.
    for (const e of ['', '5', 'AB', ' 5', null, undefined]) {
      expect(plzBereich(e as string | null)).toBeNull();
    }
  });
});

describe('passungText', () => {
  it('sagt nur, was nachpruefbar ist', () => {
    expect(passungText({ gewerk: true,  region: true  })).toBe('Ihr Gewerk, Ihre Region');
    expect(passungText({ gewerk: true,  region: false })).toBe('Ihr Gewerk');
    expect(passungText({ gewerk: false, region: true  })).toBe('Ihre Region');
  });

  it('schreibt ohne Passung gar nichts hin', () => {
    // „Empfohlen" oder „Fuer Sie" waere eine Behauptung ueber eine Auswahl,
    // die es nicht gibt.
    expect(passungText({ gewerk: false, region: false })).toBeNull();
  });
});
