// Cities where job creation is actually live. Werkant markets nationwide
// awareness from day 1 (see docs/premortem_werkr.md), but only operates
// where provider density supports real matches -- everywhere else routes
// to the waitlist (lib/waitlist.ts) instead of an empty job board.
export const ACTIVE_CITIES = ['Köln'];

function normalize(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

export function isActiveCity(city: string): boolean {
  // Founder-Entscheidung 14.07.2026: deutschlandweit freigeschaltet —
  // jede Stadt ist aktiv, die Warteliste greift nicht mehr.
  // ACTIVE_CITIES + normalize bleiben für spätere Dichte-Steuerung erhalten.
  void normalize; void ACTIVE_CITIES;
  return city.trim().length > 0;
}
