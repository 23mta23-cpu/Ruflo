/**
 * Was laeuft im Hintergrund, und was liegt liegen?
 *
 * ANLASS (22.09.2026, gemessen). Die Datenbank hat DREI Betreiber-
 * Selbstauskuenfte, und kein BILDSCHIRM rief eine davon auf:
 *
 *   abnahme_lauf_status()   0850
 *   zustellung_status()     0880
 *   pstg_meldung_status()   1010
 *   auszahlung_status()     1030 (am 22.09. nachts dazugekommen)
 *
 * PRAEZISER, nachdem ich es zuerst zu stark behauptet hatte: `/health` ruft
 * alle drei -- aber nur, um BOOLEANS an den Waechter-Workflow zu geben
 * (bewusst keine Zahlen, seit ein Wettbewerber das Wachstum der
 * Angebotsseite mitlesen konnte). Der Betreiber selbst hatte keinen Ort,
 * an dem er den Stand sieht. Mein erster Grep hatte
 * `supabase/functions/` gar nicht durchsucht und daraus „niemand ruft sie"
 * gemacht -- wo ein Pruefer nicht hinsieht, erfindet er auch Befunde.
 *
 * Der Kopfkommentar in `health/index.ts` sagte dazu: „die Zahl steht
 * ohnehin im Pruef-Postfach, wo der Betreiber hinsieht." Das stimmte bis
 * jetzt nicht. Ein Kommentar ist kein Beleg (Lehre vom 21.09.).
 *
 * Das ist dieselbe Klasse wie „eine Mitteilung ohne Empfaenger-Bildschirm"
 * (16.09.) und „ein Eingang ohne Wirkung ist ein Knopf ohne onPress" --
 * nur eine Ebene hoeher: die SICHTBARKEIT selbst war unsichtbar. Und sie
 * wiegt schwerer als die vorigen Faelle, weil an zwei der drei Auskuenfte
 * Fristen mit Rechtsfolge haengen:
 *
 *   * Zustellung: Strike- und Beschraenkungs-Mitteilungen sind als
 *     UEBERMITTLUNG geschuldet (DSA Art. 17, Art. 4 P2B-VO). Ohne den
 *     stuendlichen Lauf liegen sie in der Tabelle und erreichen niemanden.
 *   * PStTG: § 13 setzt die Frist auf den 31. Januar, § 25 stellt das
 *     Versaeumnis unter Bussgeld.
 *   * Abnahme: ohne den taeglichen Lauf bleibt Geld im Treuhandkonto
 *     liegen, obwohl die Frist durch ist -- zulasten des Betriebs.
 *
 * REINE FUNKTION, ohne Netz- und ohne Platform-Import, damit der Test das
 * Echte importiert statt es abzuschreiben (Lehre vom 16.09.).
 */
import { anzahlText } from './mengenText';

/** Wie dringend ist der Zustand? Reihenfolge ist Anzeigereihenfolge. */
export type Stufe = 'dringend' | 'hinweis' | 'ok';

export type Meldung = {
  /** Stabiler Schluessel, damit eine Zusicherung daran haengen kann. */
  kennung: 'zustellung' | 'abnahme' | 'pstg' | 'auszahlung';
  titel: string;
  stufe: Stufe;
  /** Ein Satz, der sagt, was zu tun ist. Nie leer. */
  text: string;
};

export type ZustellungRoh = {
  offene_pflichtmitteilungen?: number | null;
  aelteste_offene_stunden?: number | null;
  stau?: boolean | null;
  zeitplan_vorhanden?: boolean | null;
} | null;

export type AbnahmeRoh = {
  zeitplan_vorhanden?: boolean | null;
  letzter_lauf_am?: string | null;
  letzter_lauf_erfolgreich?: boolean | null;
  faellige_vertraege?: number | null;
  aeltester_faelliger_tage?: number | null;
  stau?: boolean | null;
} | null;

export type PstgRoh = {
  melde_jahr?: number | null;
  frist?: string | null;
  tage_bis_frist?: number | null;
  meldepflichtige?: number | null;
  vorbereitet?: number | null;
  abgegeben?: number | null;
  lauf_fehlt?: boolean | null;
  abgabe_fehlt?: boolean | null;
  frist_verstrichen?: boolean | null;
} | null;

/**
 * Ab wann eine fehlende DAC7-Meldung nicht mehr nur ein Hinweis ist.
 *
 * 30 Tage, weil die Meldung selbst Arbeit ist (Lauf anstossen, Zeilen
 * pruefen, beim BZSt einreichen) und eine Woche vorher zu spaet waere.
 */
const PSTG_DRINGEND_AB_TAGEN = 30;

function zahl(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function zustellungMeldung(r: ZustellungRoh): Meldung {
  const titel = 'Pflichtmitteilungen';
  if (!r) {
    return { kennung: 'zustellung', titel, stufe: 'dringend',
      text: 'Der Stand ist nicht abrufbar. Ob Strike- und Beschränkungs-Mitteilungen zugestellt werden, ist damit unbekannt.' };
  }
  if (r.zeitplan_vorhanden !== true) {
    return { kennung: 'zustellung', titel, stufe: 'dringend',
      text: 'Kein stündlicher Zustell-Lauf eingerichtet. Strike- und Beschränkungs-Mitteilungen bleiben liegen, geschuldet sind sie als Übermittlung (DSA Art. 17, Art. 4 P2B-VO).' };
  }
  const offen = zahl(r.offene_pflichtmitteilungen);
  if (r.stau === true || offen > 0) {
    const stunden = zahl(r.aelteste_offene_stunden);
    // Beide Formen ausschreiben, nie zusammensetzen (lib/mengenText.ts).
    return { kennung: 'zustellung', titel, stufe: 'dringend',
      text: `${anzahlText(offen, 'Mitteilung', 'Mitteilungen')} unzugestellt, die älteste seit ${anzahlText(stunden, 'Stunde', 'Stunden')}. Der Zeitplan steht, der Versand kommt nicht durch.` };
  }
  return { kennung: 'zustellung', titel, stufe: 'ok',
    text: 'Stündlicher Lauf eingerichtet, nichts liegt unzugestellt.' };
}

export function abnahmeMeldung(r: AbnahmeRoh): Meldung {
  const titel = 'Abnahme-Frist';
  if (!r) {
    return { kennung: 'abnahme', titel, stufe: 'dringend',
      text: 'Der Stand ist nicht abrufbar. Ob fällige Aufträge ausgezahlt werden, ist damit unbekannt.' };
  }
  if (r.zeitplan_vorhanden !== true) {
    return { kennung: 'abnahme', titel, stufe: 'dringend',
      text: 'Kein täglicher Lauf eingerichtet. Abgelaufene Abnahmefristen lösen keine Auszahlung aus, das Geld bleibt im Treuhandkonto liegen.' };
  }
  const faellig = zahl(r.faellige_vertraege);
  if (r.stau === true || faellig > 0) {
    const tage = zahl(r.aeltester_faelliger_tage);
    // „Auftrage" war genau der Fehler vom 08.09., und der Test hat ihn beim
    // ersten Lauf wieder gefangen. Der Umlaut laesst sich nicht anhaengen.
    return { kennung: 'abnahme', titel, stufe: 'dringend',
      text: `${anzahlText(faellig, 'Auftrag', 'Aufträge')} überfällig, der älteste seit ${anzahlText(tage, 'Tag', 'Tagen')}. Der Zeitplan steht, der Lauf greift nicht.` };
  }
  return { kennung: 'abnahme', titel, stufe: 'ok',
    text: 'Täglicher Lauf eingerichtet, nichts ist überfällig.' };
}

export function pstgMeldung(r: PstgRoh): Meldung {
  const titel = 'DAC7-Jahresmeldung';
  if (!r) {
    return { kennung: 'pstg', titel, stufe: 'dringend',
      text: 'Der Stand ist nicht abrufbar. Ob die Meldung nach § 13 PStTG aussteht, ist damit unbekannt.' };
  }
  const jahr = r.melde_jahr ?? null;
  const pflichtige = zahl(r.meldepflichtige);
  const fehlt = r.lauf_fehlt === true || r.abgabe_fehlt === true;

  if (pflichtige === 0 && !fehlt) {
    return { kennung: 'pstg', titel, stufe: 'ok',
      text: jahr ? `Für ${jahr} ist niemand meldepflichtig.` : 'Niemand ist meldepflichtig.' };
  }
  if (!fehlt) {
    return { kennung: 'pstg', titel, stufe: 'ok',
      text: `${anzahlText(pflichtige, 'meldepflichtiger Anbieter', 'meldepflichtige Anbieter')} für ${jahr}, Meldung abgegeben.` };
  }

  // Was genau fehlt, gehoert in den Satz: „vorbereitet" und „abgegeben" sind
  // zwei Zustaende, und ein einziges Kennzeichen wuerde den zweiten
  // verdecken, sobald der erste behoben ist (Begruendung aus 1010).
  const was = r.lauf_fehlt === true
    ? 'Der Meldelauf ist noch nicht gelaufen.'
    : 'Die Zeilen sind vorbereitet, aber noch nicht beim BZSt abgegeben.';
  const tage = zahl(r.tage_bis_frist);

  if (r.frist_verstrichen === true) {
    return { kennung: 'pstg', titel, stufe: 'dringend',
      text: `${was} Die Frist zum 31. Januar ist verstrichen (§ 13 PStTG); § 25 stellt das Versäumnis unter Bußgeld.` };
  }
  const stufe: Stufe = tage <= PSTG_DRINGEND_AB_TAGEN ? 'dringend' : 'hinweis';
  return { kennung: 'pstg', titel, stufe,
    text: `${was} ${anzahlText(pflichtige, 'Anbieter', 'Anbieter')} für ${jahr}, noch ${anzahlText(tage, 'Tag', 'Tage')} bis zum 31. Januar (§ 13 PStTG).` };
}

export type AuszahlungRoh = {
  gesperrt?: number | null;
  gesperrt_cents?: number | null;
  aeltester_fall_stunden?: number | null;
  haengend?: number | null;
  haengend_cents?: number | null;
  stau?: boolean | null;
} | null;

/** Cent in eine lesbare Euro-Angabe. Die Datenbank rechnet in ganzen Cent. */
function euroAusCent(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Haengende Auszahlungen (1030).
 *
 * ANLASS (22.09.2026): `payout_operations.status = 'manual_review'` kam im
 * ganzen Projekt nur in der Migration vor, die ihn setzt, und in den
 * Deno-Tests. In mehreren der Faelle, die ihn ausloesen, ist der Transfer bei
 * Stripe BEREITS GELAUFEN -- es geht also nicht um einen Zeitplan, sondern um
 * Geld, das schon bewegt wurde und falsch liegen kann.
 */
export function auszahlungMeldung(r: AuszahlungRoh): Meldung {
  const titel = 'Auszahlungen';
  if (!r) {
    return { kennung: 'auszahlung', titel, stufe: 'dringend',
      text: 'Der Stand ist nicht abrufbar. Ob eine Auszahlung festhängt, ist damit unbekannt.' };
  }
  const gesperrt = zahl(r.gesperrt);
  const haengend = zahl(r.haengend);

  if (gesperrt > 0) {
    const stunden = zahl(r.aeltester_fall_stunden);
    return { kennung: 'auszahlung', titel, stufe: 'dringend',
      text: `${anzahlText(gesperrt, 'Auszahlung ist', 'Auszahlungen sind')} gesperrt (${euroAusCent(zahl(r.gesperrt_cents))}), `
        + `die älteste seit ${anzahlText(stunden, 'Stunde', 'Stunden')}. `
        + 'Der Transfer kann bei Stripe bereits gelaufen sein; jeder weitere Versuch wird abgewiesen.' };
  }
  if (haengend > 0) {
    return { kennung: 'auszahlung', titel, stufe: 'dringend',
      text: `${anzahlText(haengend, 'Auszahlung wurde', 'Auszahlungen wurden')} beansprucht, aber nie abgeschlossen `
        + `(${euroAusCent(zahl(r.haengend_cents))}). Zwischen Beanspruchen und Abschluss liegt ein einziger Stripe-Aufruf.` };
  }
  return { kennung: 'auszahlung', titel, stufe: 'ok',
    text: 'Keine Auszahlung gesperrt, keine hängt fest.' };
}

const RANG: Record<Stufe, number> = { dringend: 0, hinweis: 1, ok: 2 };

/**
 * Alle drei Auskuenfte, dringend zuerst.
 *
 * „ok" bleibt ausdruecklich in der Liste. Ein Abschnitt, der bei gutem Stand
 * LEER waere, sieht aus wie „nicht geladen" -- dieselbe Klasse wie ein
 * Netzfehler, der sich als leerer Posteingang tarnt (21.09.).
 */
export function betriebsstatus(
  zustellung: ZustellungRoh, abnahme: AbnahmeRoh, pstg: PstgRoh,
  auszahlung: AuszahlungRoh,
): Meldung[] {
  return [
    zustellungMeldung(zustellung), abnahmeMeldung(abnahme),
    pstgMeldung(pstg), auszahlungMeldung(auszahlung),
  ].sort((a, b) => RANG[a.stufe] - RANG[b.stufe]);
}

/** Wie viele davon verlangen eine Handlung? Fuer die Marke am Abschnitt. */
export function dringendeAnzahl(meldungen: Meldung[]): number {
  return meldungen.filter((m) => m.stufe === 'dringend').length;
}
