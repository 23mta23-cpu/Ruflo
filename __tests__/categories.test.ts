import {
  CATEGORIES, activeCategories, categoryById, minRateFor,
  NACHBARSCHAFT_STARTKATEGORIEN, isNachbarschaftsfaehigeKategorie,
  kundenKategorien,
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

  describe('Nachbarschafts-Startkategorien (Modell D)', () => {
    it('are exactly the three approved start categories', () => {
      expect([...NACHBARSCHAFT_STARTKATEGORIEN].sort()).toEqual(
        ['einkaufshilfe', 'garten', 'umzugshilfe'],
      );
    });

    it('are all active C2C categories without Meisterpflicht', () => {
      for (const id of NACHBARSCHAFT_STARTKATEGORIEN) {
        const c = categoryById(id);
        expect(c).toBeDefined();
        expect(c!.segment).toBe('C2C');
        expect(c!.active).toBe(true);
        expect(c!.requiredDocs).not.toContain('MEISTERBRIEF');
      }
    });

    it('isNachbarschaftsfaehigeKategorie matches ids and display labels', () => {
      expect(isNachbarschaftsfaehigeKategorie('garten')).toBe(true);
      expect(isNachbarschaftsfaehigeKategorie('Gartenarbeit')).toBe(true); // Wizard-Label
      expect(isNachbarschaftsfaehigeKategorie('Umzugshilfe')).toBe(true);
      expect(isNachbarschaftsfaehigeKategorie('Einkaufshilfe')).toBe(true);
    });

    it('isNachbarschaftsfaehigeKategorie rejects Meisterpflicht and unknown trades', () => {
      expect(isNachbarschaftsfaehigeKategorie('elektro')).toBe(false);
      expect(isNachbarschaftsfaehigeKategorie('Elektrik')).toBe(false);
      expect(isNachbarschaftsfaehigeKategorie('Sanitär & Heizung')).toBe(false);
      expect(isNachbarschaftsfaehigeKategorie('heizung-sanitaer')).toBe(false);
      expect(isNachbarschaftsfaehigeKategorie('Malerarbeiten')).toBe(false);
      expect(isNachbarschaftsfaehigeKategorie('')).toBe(false);
    });
  });

  describe('kundenKategorien (Modell D+ — kundensichtbare Kategorien)', () => {
    it('flag aus: exakt die aktiven B2B-Kategorien, kein C2C', () => {
      const ids = kundenKategorien(false).map((c) => c.id);
      expect(ids).toEqual(
        activeCategories().filter((c) => c.segment === 'B2B').map((c) => c.id),
      );
      expect(ids.some((id) => categoryById(id)?.segment === 'C2C')).toBe(false);
    });

    it('flag an: B2B plus GENAU die freigegebenen Startkategorien', () => {
      const ids = kundenKategorien(true).map((c) => c.id);
      for (const nb of NACHBARSCHAFT_STARTKATEGORIEN) expect(ids).toContain(nb);
      const c2c = ids.filter((id) => categoryById(id)?.segment === 'C2C');
      expect([...c2c].sort()).toEqual([...NACHBARSCHAFT_STARTKATEGORIEN].sort());
    });

    it('zurückgestellte Kategorien bleiben auch mit Flag unsichtbar (Sicherheitslinie Modell D)', () => {
      const ids = kundenKategorien(true).map((c) => c.id);
      for (const blocked of ['babysitting', 'seniorenhilfe', 'tierbetreuung', 'nachhilfe', 'it-support', 'reinigung', 'waesche', 'moebelaufbau']) {
        expect(ids).not.toContain(blocked);
      }
    });
  });
});
