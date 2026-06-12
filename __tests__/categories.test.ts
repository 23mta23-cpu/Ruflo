import {
  CATEGORIES, activeCategories, categoryById, minRateFor,
} from '../data/categories';

describe('ServiceCategory config', () => {
  it('has unique ids', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category respects §1 MiLoG floor (≥ €13/h)', () => {
    for (const c of CATEGORIES) {
      expect(c.minHourlyRate).toBeGreaterThanOrEqual(13);
    }
  });

  it('B2B categories require Gewerbeschein + Steuernummer', () => {
    for (const c of CATEGORIES.filter((x) => x.segment === 'B2B')) {
      expect(c.requiredDocs).toEqual(
        expect.arrayContaining(['GEWERBESCHEIN', 'STEUERNUMMER']),
      );
    }
  });

  it('every category requires identity verification (18+ Gate)', () => {
    for (const c of CATEGORIES) {
      expect(c.requiredDocs).toContain('IDENTITAET');
    }
  });

  it('activeCategories excludes inactive entries', () => {
    expect(activeCategories().every((c) => c.active)).toBe(true);
    expect(activeCategories().find((c) => c.id === 'dolmetscher')).toBeUndefined();
  });

  it('categoryById resolves and misses safely', () => {
    expect(categoryById('elektro')?.name).toBe('Elektro');
    expect(categoryById('unbekannt')).toBeUndefined();
  });

  describe('minRateFor', () => {
    it('defaults to MiLoG €13 for empty/unknown selection', () => {
      expect(minRateFor([])).toBe(13);
      expect(minRateFor(['unbekannt'])).toBe(13);
    });

    it('uses strictest minimum across mixed selection', () => {
      expect(minRateFor(['reinigung'])).toBe(13);
      expect(minRateFor(['heizung-sanitaer'])).toBe(45);
      expect(minRateFor(['reinigung', 'heizung-sanitaer'])).toBe(45);
    });
  });
});
