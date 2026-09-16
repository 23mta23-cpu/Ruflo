import { sichtBestimmen } from '../lib/bewertungsSicht';

const KUNDE = 'cccccccc-0000-0000-0000-000000000001';
const ANBIETER = 'pppppppp-0000-0000-0000-000000000002';

const VERTRAG = {
  vertragId: 'v1',
  customer_id: KUNDE,
  provider_id: ANBIETER,
  customer_total: 102.5,
  provider_payout: 92,
  customer: { full_name: 'Tayyip M.' },
  provider: { business_name: 'Elektro Schmitz' },
};

describe('Bewertungsrichtung', () => {
  it('der Kunde bewertet den Anbieter: Firmenname und gezahlter Betrag', () => {
    const s = sichtBestimmen(VERTRAG, ANBIETER);
    expect(s.richtung).toBe('anbieter');
    expect(s.name).toBe('Elektro Schmitz');
    expect(s.betrag).toBe(102.5);
    expect(s.betragLabel).toBe('bezahlt');
  });

  it('der Anbieter bewertet den Kunden: Kundenname und erhaltener Betrag', () => {
    // Vor dem 16.09. zeigte der Bildschirm hier den EIGENEN Firmennamen und
    // den Betrag, den der Kunde gezahlt hat, unter „bezahlt".
    const s = sichtBestimmen(VERTRAG, KUNDE);
    expect(s.richtung).toBe('kunde');
    expect(s.name).toBe('Tayyip M.');
    expect(s.betrag).toBe(92);
    expect(s.betragLabel).toBe('erhalten');
  });

  it('die Schlagworte sind nicht dieselben Listen', () => {
    const a = sichtBestimmen(VERTRAG, ANBIETER);
    const k = sichtBestimmen(VERTRAG, KUNDE);
    expect(k.tagsPositiv).not.toEqual(a.tagsPositiv);
    expect(k.tagsNegativ).not.toEqual(a.tagsNegativ);
  });

  it('kein Schlagwort ueber einen Kunden spricht von Arbeitsqualitaet', () => {
    // „Sauber gearbeitet" oder „Gutes Preis-Leistung" ueber einen Kunden ist
    // sinnlos; genau das stand vorher da.
    const k = sichtBestimmen(VERTRAG, KUNDE);
    for (const t of [...k.tagsPositiv, ...k.tagsNegativ]) {
      expect(t).not.toMatch(/gearbeitet|Preis-Leistung|Qualität|Arbeit/);
    }
  });

  it('der Antworthinweis nennt die richtige Gegenseite', () => {
    expect(sichtBestimmen(VERTRAG, ANBIETER).antwortHinweis).toContain('Anbieter');
    expect(sichtBestimmen(VERTRAG, KUNDE).antwortHinweis).toContain('Kunde');
  });

  it('die Richtung haengt an reviewedId, nicht an der Rolle des Angemeldeten', () => {
    // Die Rolle koennte aus einer veralteten Sitzung stammen. Uebergeben wird
    // nur, wer bewertet wird.
    const fremd = 'ffffffff-0000-0000-0000-000000000003';
    expect(sichtBestimmen(VERTRAG, fremd).richtung).toBe('anbieter');
  });

  it('ohne Vertrag faellt die Sicht auf die haeufigere Richtung zurueck', () => {
    const s = sichtBestimmen(null, ANBIETER);
    expect(s.richtung).toBe('anbieter');
    expect(s.name).toBe('Anbieter');
    expect(s.betrag).toBeNull();
  });

  it('ein leerer Name wird nicht angezeigt', () => {
    // '   ' ist nicht null und haette als Name durchgereicht eine leere Zeile
    // und ein leeres Anfangszeichen im Avatar ergeben.
    const s = sichtBestimmen({ ...VERTRAG, customer: { full_name: '   ' } }, KUNDE);
    expect(s.name).toBe('Kunde');
  });

  it('kein Text enthaelt einen Gedankenstrich', () => {
    for (const id of [KUNDE, ANBIETER]) {
      const s = sichtBestimmen(VERTRAG, id);
      for (const t of [s.frage, s.antwortHinweis, s.betragLabel, ...s.tagsPositiv, ...s.tagsNegativ]) {
        expect(t).not.toMatch(/[—–]/);
      }
    }
  });
});
