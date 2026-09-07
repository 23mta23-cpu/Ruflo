// Frueher: Staedte, in denen die Auftragsanlage freigeschaltet war.
//
// Seit der Founder-Entscheidung vom 14.07.2026 ist Werkant deutschlandweit
// offen; bestaetigt am 07.09.2026 ("es soll in ganz Deutschland genutzt
// werden"). isActiveCity() laesst deshalb jede Stadt durch, und die
// Warteliste ist kein Riegel mehr, sondern nur noch ein Angebot fuer
// Gegenden, in denen noch wenige Betriebe dabei sind.
//
// ACTIVE_CITIES und normalize() bleiben absichtlich stehen: sollte spaeter
// doch nach Dichte gesteuert werden, ist der Baustein da. Wer sie wieder
// scharf schaltet, muss die Texte in app/landing.tsx, app/suche.tsx,
// app/(tabs)/index.tsx und app/onboarding-kyc.tsx mitziehen -- die sagen
// heute bewusst nichts mehr ueber einzelne Staedte.
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
