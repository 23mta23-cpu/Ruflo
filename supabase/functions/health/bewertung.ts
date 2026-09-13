// Was „ok" bedeutet und wann /health 503 antwortet — ausfuehrbar testbar.
//
// Diese Regel sieht harmlos aus und traegt eine bewusste Entscheidung, die
// jemand spaeter mit guter Absicht „korrigieren" wuerde:
//
//   `ok` haengt AUSSCHLIESSLICH an mail und db, NICHT an den Staus.
//
// Grund: `ok` bedeutet seit jeher „die Secrets sitzen". Ein Rueckstand ist ein
// BETRIEBSproblem, kein fehlendes Secret. Wuerde ein Stau `ok` auf false
// ziehen, antwortete /health mit 503, und ein Ueberwachungsdienst, der nur den
// Statuscode liest, koennte beides nicht mehr unterscheiden: „Werkant ist
// falsch eingerichtet" und „Werkant hat gerade etwas abzuarbeiten".
//
// Die Staus stehen deshalb im Rumpf und sind dort einzeln lesbar.

export interface Secrets {
  mail: boolean;
  db: boolean;
}

/** „Die Secrets sitzen." Nicht: „alles ist in Ordnung." */
export function istOk(s: Secrets): boolean {
  return s.mail && s.db;
}

/**
 * 503, wenn ein kritisches Secret fehlt — damit ein geplanter Lauf ohne
 * eigenes Regelwerk am Statuscode erkennt, dass es nicht losgehen kann.
 */
export function statusFuer(ok: boolean): number {
  return ok ? 200 : 503;
}
