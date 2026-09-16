import { provisionKurz, provisionLang, nachbarschaftGebuehrLang } from '../lib/preisHinweis';
import { PROVIDER_COMMISSION_RATE, MIN_PROVIDER_FEE, Werkant_SCHUTZ_FEE } from '../lib/feeEngine';

describe('Was ein Betrieb zahlt', () => {
  it('nennt denselben Satz wie die Gebuehrenquelle', () => {
    // GRENZE: das beweist Gleichheit, nicht Herkunft. Ob die Zahl eingesetzt
    // oder abgeschrieben ist, prueft scripts/agb-code-check.py -- hier blieb
    // die Mutation „als Literal" gemessen gruen.
    expect(provisionKurz()).toContain(String(PROVIDER_COMMISSION_RATE * 100));
  });

  it('nennt dieselbe Mindestgebuehr wie die Quelle', () => {
    expect(provisionKurz()).toContain(MIN_PROVIDER_FEE.toFixed(2).replace('.', ','));
  });

  it('sagt WOVON die Prozente sind', () => {
    // Founder am Geraet: „Es steht i.was mit 8% provision wo was warum es ist
    // nicht klar was gemeint ist." Ohne Bezugsgroesse ist ein Prozentsatz
    // keine Preisangabe.
    expect(provisionKurz()).toMatch(/vom Rechnungsbetrag/);
  });

  it('sagt WANN sie anfaellt und dass Anfragen nichts kosten', () => {
    const t = provisionLang();
    expect(t).toMatch(/abgeschlossen und bezahlt/);
    expect(t).toMatch(/Anfragen/);
  });

  it('die Nachbarschaftshilfe nennt dieselbe Schutzpauschale wie die Quelle', () => {
    expect(nachbarschaftGebuehrLang()).toContain(Werkant_SCHUTZ_FEE.toFixed(2).replace('.', ','));
  });

  it('verspricht keine Leistung, die es nicht gibt', () => {
    // Dieselbe Stelle, an der das Projekt dreimal falsch abgebogen ist.
    for (const t of [provisionLang(), nachbarschaftGebuehrLang()]) {
      for (const erfunden of ['Versicherung', 'Haftpflicht', 'Garantie', 'kostenlos']) {
        expect(t).not.toContain(erfunden);
      }
    }
  });

  it('kein Text enthaelt einen Gedankenstrich', () => {
    for (const t of [provisionKurz(), provisionLang(), nachbarschaftGebuehrLang()]) {
      expect(t).not.toMatch(/[—–]/);
    }
  });
});
