/**
 * Tests fuer die Postfach-Konstante in constants/legal.ts.
 *
 * Anlass (16.08.2026): Der Founder sagte, es gebe noch KEIN einziges Postfach.
 * Die App verwies an 16 Stellen auf sechs verschiedene Adressen — keine davon
 * empfing Post. Wer dem Impressum (§5 DDG) oder der Widerrufsbelehrung
 * (Art. 246a §1 Abs. 2 EGBGB) folgte, schrieb ins Leere.
 *
 * Der Schalter `EIN_POSTFACH` lenkt alle Wege auf eine Adresse, solange es nur
 * eine gibt. Das ist genau dann etwas wert, wenn es AUSNAHMSLOS wirkt — eine
 * einzige Adresse, die daran vorbeiläuft, ist wieder ein Weg ins Leere.
 */

import { MAIL, COMPANY, EIN_POSTFACH_AKTIV } from '../constants/legal';

const PFLICHTWEGE = [
  // §5 Abs. 1 Nr. 2 DDG — Impressum
  ['Impressum', COMPANY.email],
  // Art. 13 DSGVO — Kontakt des Verantwortlichen
  ['Datenschutz', COMPANY.emailPrivacy],
  // Art. 246a §1 Abs. 2 EGBGB — Adresse fuer den Widerruf
  ['Widerruf', COMPANY.emailWithdrawal],
] as const;

describe('Postfaecher', () => {
  it('nennt fuer jeden Zweck eine vollstaendige Adresse', () => {
    for (const [zweck, adresse] of Object.entries(MAIL)) {
      expect(`${zweck}: ${adresse}`).toMatch(/: [a-z0-9._%+-]+@werkant\.de$/);
    }
  });

  it('deckt die drei gesetzlich vorgeschriebenen Wege ab', () => {
    // Diese drei duerfen nie leer oder undefined werden — an ihnen haengen
    // Impressumspflicht, Auskunftsrecht und Widerrufsrecht.
    for (const [zweck, adresse] of PFLICHTWEGE) {
      expect(`${zweck}: ${adresse ?? ''}`).toMatch(/@werkant\.de$/);
    }
  });

  it('fuehrt in beiden Betriebsarten schluessig auf Adressen', () => {
    const adressen = new Set(Object.values(MAIL));
    if (EIN_POSTFACH_AKTIV) {
      // Solange nur ein Postfach existiert, ist genau eine Adresse richtig.
      // Zwei waeren schlimmer als sechs: dann glaubt man, es sei aufgeraeumt,
      // und eine der beiden laeuft weiter ins Leere.
      expect(adressen.size).toBe(1);
    } else {
      // Mehr-Postfach-Betrieb: jeder Zweck bekommt seine eigene Adresse.
      expect(adressen.size).toBe(Object.keys(MAIL).length);
    }
  });

  it('bindet auch die Impressums-Felder an das Verzeichnis, nicht an Literale', () => {
    // COMPANY.email & Co. waren bis 16.08.2026 eigene Zeichenketten. Damit
    // haette der Schalter sie NICHT erreicht — das Impressum haette weiter
    // auf ein Postfach gezeigt, das es nicht gibt.
    //
    // EHRLICH: dieser Vergleich allein BEWEIST die Bindung nicht. Im
    // Ein-Postfach-Betrieb ist MAIL.kontakt zufaellig derselbe Text wie das
    // alte Literal, also faellt ein Rueckfall auf das Literal hier gar nicht
    // auf (Mutationsprobe blieb gruen). Den Quelltext prueft deshalb
    // scripts/postfach-check.py, das jede geschriebene Adresse ausserhalb der
    // postfach()-Aufrufe ablehnt. Dieser Test haelt nur die Zusage fest.
    expect(COMPANY.email).toBe(MAIL.kontakt);
    expect(COMPANY.emailPrivacy).toBe(MAIL.datenschutz);
    expect(COMPANY.emailWithdrawal).toBe(MAIL.widerruf);
  });
});
