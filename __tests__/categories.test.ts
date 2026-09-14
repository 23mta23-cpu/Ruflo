import {
  CATEGORIES, activeCategories, categoryById, empfohlenerSatz,
  NACHBARSCHAFT_STARTKATEGORIEN, isNachbarschaftsfaehigeKategorie,
  kundenKategorien, abgrenzungVon, MEISTERPFLICHT_IDS,
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

  describe('empfohlenerSatz', () => {
    it('ohne Auswahl gibt es keine Empfehlung', () => {
      expect(empfohlenerSatz([])).toBeNull();
      expect(empfohlenerSatz(['unbekannt'])).toBeNull();
    });

    it('nennt Satz und Gewerk fuer Gewerke ueber dem Boden', () => {
      expect(empfohlenerSatz(['heizung-sanitaer'])).toEqual({ rate: 45, kategorie: 'Heizung & Sanitär' });
    });

    it('mehrere Gewerke: der hoechste Satz, und genau der wird benannt', () => {
      expect(empfohlenerSatz(['reinigung', 'heizung-sanitaer'])?.rate).toBe(45);
      expect(empfohlenerSatz(['reinigung', 'heizung-sanitaer'])?.kategorie).toBe('Heizung & Sanitär');
    });

    it('Gewerke auf Bodenhoehe erzeugen KEINE Empfehlung', () => {
      expect(empfohlenerSatz(['reinigung'])).toBeNull();
    });
  });

  describe('Nachbarschafts-Startkategorien (Modell D + Stufe-2-Ausbau 08.07.)', () => {
    it('are exactly the seven approved start categories', () => {
      expect([...NACHBARSCHAFT_STARTKATEGORIEN].sort()).toEqual(
        ['einkaufshilfe', 'garten', 'it-support', 'moebelaufbau', 'reinigung', 'umzugshilfe', 'waesche'],
      );
    });

    it('excludes categories with contact to vulnerable groups (children/elderly) or animal-liability without a trust mechanism', () => {
      for (const excluded of ['nachhilfe', 'seniorenhilfe', 'babysitting', 'tierbetreuung']) {
        expect(NACHBARSCHAFT_STARTKATEGORIEN).not.toContain(excluded);
      }
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

    it('zurückgestellte Kategorien mit Kontakt zu vulnerablen Gruppen bleiben unsichtbar (Sicherheitslinie Modell D + Stufe 2)', () => {
      const ids = kundenKategorien(true).map((c) => c.id);
      for (const blocked of ['babysitting', 'seniorenhilfe', 'nachhilfe']) {
        expect(ids).not.toContain(blocked);
      }
    });

    it('Stufe-2-Kategorien (08.07., gleiche Risikokriterien wie Stufe 1) sind sichtbar', () => {
      const ids = kundenKategorien(true).map((c) => c.id);
      for (const freigegeben of ['reinigung', 'it-support', 'moebelaufbau', 'waesche']) {
        expect(ids).toContain(freigegeben);
      }
    });
  });
});

/* Founder am Gerät (08.09.2026): „warum muss es mindestens 50€ die stunde
   sein das ergibt sich mir nicht?" Danach Founder-Entscheidung: die
   Gewerk-Sätze werden Empfehlung, gesperrt wird nur noch am Boden.
   Die drei Gründe stehen bei empfohlenerSatz() in data/categories.ts. */
import { satzFehler, MINDESTPREIS_BODEN } from '../data/categories';

describe('satzFehler', () => {
  it('unter dem Boden wird abgewiesen, mit der Zahl in der Meldung', () => {
    const f = satzFehler(8);
    expect(f).toContain('13,00');
  });

  it('genau auf dem Boden ist erlaubt', () => {
    expect(satzFehler(MINDESTPREIS_BODEN)).toBeNull();
  });

  it('unter dem GEWERK-Satz, aber ueber dem Boden, wird NICHT mehr gesperrt', () => {
    // Genau der Fall aus dem Bildschirmfoto: 15 €/h bei einem Gewerk, das
    // 50 nahelegt. Vorher gesperrt, jetzt erlaubt.
    expect(satzFehler(15)).toBeNull();
  });

  it('keine Zahl eingetragen wird abgewiesen', () => {
    expect(satzFehler(NaN)).toContain('Stundensatz');
  });
});

// ---------------------------------------------------------------------------
// Abgrenzung: keine B2B-Sammelkategorie ohne Grenze
// ---------------------------------------------------------------------------

describe('Abgrenzung meisterfreier B2B-Gewerke (§ 1 HwO)', () => {
  const ohneMeisterbrief = CATEGORIES.filter(
    (c) => c.segment === 'B2B' && !c.requiredDocs.includes('MEISTERBRIEF'),
  );

  it('es gibt überhaupt solche Gewerke, sonst prüft der Rest nichts', () => {
    expect(ohneMeisterbrief.length).toBeGreaterThan(0);
  });

  it('jedes von ihnen sagt, wo es aufhört', () => {
    // Der Kern des Befunds vom 14.09.2026: 'renovierung' verlangte nur
    // Gewerbeschein und Steuernummer und bekam im Onboarding einen grünen
    // Haken samt „Ihr Gewerbeschein ist ausreichend". Jedes benannte Gewerk
    // hatte sein Gate, der Sammelbegriff daneben hatte keins. Diese Zusage
    // gilt ab jetzt auch für jede künftige Kategorie.
    for (const c of ohneMeisterbrief) {
      expect(typeof c.abgrenzung).toBe('string');
      expect((c.abgrenzung ?? '').length).toBeGreaterThan(60);
    }
  });

  it('jede Abgrenzung verweist auf die Handwerkskammer, nicht auf Werkant', () => {
    // Welche Tätigkeit im Einzelfall „wesentlich" im Sinne des § 1 Abs. 2 HwO
    // ist, entscheidet die Kammer. Ein Text, der das selbst beantwortet,
    // erteilt eine Auskunft, die Werkant nicht erteilen darf.
    for (const c of ohneMeisterbrief) {
      expect(c.abgrenzung).toMatch(/Handwerkskammer/);
    }
  });

  it('die Renovierungs-Abgrenzung nennt die Gewerke, die sie ausschließt', () => {
    const t = abgrenzungVon('renovierung') ?? '';
    for (const gewerk of ['Maler', 'Fliesen', 'Maurer', 'Tischler', 'Elektro']) {
      expect(t).toContain(gewerk);
    }
    expect(t).toMatch(/Meisterbrief/);
  });

  it('meisterpflichtige Gewerke brauchen keine — sie haben ihr Gate', () => {
    for (const id of MEISTERPFLICHT_IDS) {
      expect(abgrenzungVon(id)).toBeNull();
    }
  });

  it('abgrenzungVon liefert null statt zu werfen', () => {
    for (const id of [null, undefined, '', 'gibt-es-nicht']) {
      expect(abgrenzungVon(id)).toBeNull();
    }
  });
});
