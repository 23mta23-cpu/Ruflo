/**
 * Tests fuer lib/strikes.ts — welche Strikes zaehlen und wie lange noch.
 *
 * AGB §7(3) sagt "3 Strikes innerhalb von 12 Monaten". Bis 16.08.2026 zaehlte
 * der Code ueber die gesamte Kontodauer und liess Strikes nie verfallen. Die
 * Frist ist damit keine Nebensache, sondern die Zusage selbst — deshalb wird
 * sie hier geprueft, und zwar mit eingesetztem `jetzt`: ein Test, der nur an
 * bestimmten Tagen gruen ist, ist kein Test.
 */

// lib/strikes.ts zieht ueber ./supabase die Expo-Module nach, die Jest in der
// node-Umgebung nicht uebersetzen kann. Geprueft wird hier ohnehin nur die
// reine Fristenrechnung — der Datenzugriff ist Sache der DB-Tests (RLS).
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { istAktiv, tageBisVerfall, type Strike } from '../lib/strikes';

const JETZT = new Date(2026, 7, 16, 12, 0);

function strike(p: Partial<Strike> = {}): Strike {
  return {
    id: 's1',
    grund: 'kontaktdaten_umgehung',
    begruendung: 'Testbegruendung, lang genug fuer die Pruefung.',
    erteilt_am: new Date(2026, 7, 1).toISOString(),
    verfaellt_am: new Date(2027, 7, 1).toISOString(),
    aufgehoben_am: null,
    ...p,
  };
}

describe('istAktiv', () => {
  it('zaehlt einen frischen Strike', () => {
    expect(istAktiv(strike(), JETZT)).toBe(true);
  });

  it('zaehlt einen verfallenen Strike NICHT mehr (AGB 7(3))', () => {
    expect(istAktiv(strike({ verfaellt_am: new Date(2026, 6, 30).toISOString() }), JETZT)).toBe(false);
  });

  it('zaehlt einen nach Beschwerde aufgehobenen Strike nicht (AGB 7(5))', () => {
    expect(istAktiv(strike({ aufgehoben_am: new Date(2026, 7, 10).toISOString() }), JETZT)).toBe(false);
  });

  it('behandelt den Verfallszeitpunkt selbst als abgelaufen', () => {
    // Genau jetzt abgelaufen heisst abgelaufen — im Zweifel zugunsten des
    // Anbieters, sonst haengt eine Sperre an einer Sekunde.
    expect(istAktiv(strike({ verfaellt_am: JETZT.toISOString() }), JETZT)).toBe(false);
  });
});

describe('tageBisVerfall', () => {
  it('rechnet die Restfrist in ganzen Tagen', () => {
    expect(tageBisVerfall(strike({ verfaellt_am: new Date(2026, 7, 26, 12, 0).toISOString() }), JETZT)).toBe(10);
  });

  it('rundet angebrochene Tage auf, statt sie zu verschlucken', () => {
    expect(tageBisVerfall(strike({ verfaellt_am: new Date(2026, 7, 17, 1, 0).toISOString() }), JETZT)).toBe(1);
  });

  it('meldet 0 fuer einen bereits verfallenen Strike, nie eine negative Zahl', () => {
    expect(tageBisVerfall(strike({ verfaellt_am: new Date(2026, 6, 1).toISOString() }), JETZT)).toBe(0);
  });
});
