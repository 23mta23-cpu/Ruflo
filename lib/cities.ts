// Cities where job creation is actually live. WERKR markets nationwide
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
  const target = normalize(city);
  return ACTIVE_CITIES.some((c) => normalize(c) === target);
}
