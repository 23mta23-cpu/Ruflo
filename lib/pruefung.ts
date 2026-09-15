/**
 * Vorpruefungen fuer die Anbieter-Verifizierung.
 *
 * ANLASS (Founder-Frage 14.09.2026: „Wie prueft es Werkant, muss ich das dann
 * machen?"). Die Antwort war: ja, von Hand im Supabase-Dashboard, und niemand
 * sagt es ihm. Kein Bildschirm, keine Edge Function, keine Benachrichtigung.
 * `0370_verification_documents.sql` sagt es woertlich: „Founder prueft" und
 * „liest ueber service_role (Supabase Dashboard)".
 *
 * AUSDRUECKLICH KEINE KI, und das ist eine Entscheidung, keine Bequemlichkeit:
 *
 *   Ein Modell, das einen Meisterbrief ansieht und „echt" sagt, uebernimmt eine
 *   Haftung, die eine UG nicht tragen kann. Es zoege Werkant ausserdem in die
 *   Hochrisiko-Pflichten aus Anhang III der KI-VO (EU) 2024/1689, die seit dem
 *   02.08.2026 gelten: Konformitaetsbewertung, Registrierung, Protokollierung,
 *   menschliche Aufsicht, technische Dokumentation.
 *
 *   Was hier steht, sind `if`-Abfragen ueber Felder, die ohnehin vorliegen.
 *   Kein System, das aus Eingaben Ausgaben ABLEITET (Art. 3 Nr. 1 KI-VO), also
 *   kein KI-System, also keine Ausweispflicht und kein Anhang III.
 *   `scripts/ki-einsatz-check.py` wacht darueber, dass das so bleibt.
 *
 * Die Vorpruefungen ENTSCHEIDEN NICHTS. Sie sortieren, was ein Mensch ohnehin
 * ansehen muss, und sagen ihm, worauf er zuerst schauen sollte.
 */

import { MEISTERPFLICHT_IDS, categoryById } from '../data/categories';

/** Was aus der Datenbank kommt. Bewusst genau die Felder, die es gibt. */
export type Einreichung = {
  id: string;
  business_name: string | null;
  trade_id: string | null;
  gewerbeschein_path: string | null;
  meisterbrief_path: string | null;
  kyc_submitted_at: string | null;
  has_steuer_id?: boolean | null;
  /** Der Klarname aus dem Konto, fuer den Abgleich mit dem Betriebsnamen. */
  full_name?: string | null;
};

export type Schwere = 'sperrt' | 'ansehen' | 'hinweis';

export type Befund = {
  schwere: Schwere;
  text: string;
};

/** Wie viele Stunden die Einreichung schon wartet, oder null. */
export function wartetSeitStunden(e: Einreichung, jetzt: Date = new Date()): number | null {
  if (!e.kyc_submitted_at) return null;
  const t = new Date(e.kyc_submitted_at).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((jetzt.getTime() - t) / 3_600_000));
}

/**
 * Die Vorpruefungen.
 *
 * `sperrt` heisst: eine Freigabe waere hier ein Fehler, unabhaengig davon, wie
 * die Dokumente aussehen. `ansehen` heisst: hier zuerst hinschauen.
 * `hinweis` ist Kontext.
 */
export function vorpruefen(e: Einreichung, jetzt: Date = new Date()): Befund[] {
  const befunde: Befund[] = [];

  if (!e.gewerbeschein_path) {
    befunde.push({ schwere: 'sperrt', text: 'Kein Gewerbeschein hochgeladen.' });
  }

  const gewerk = e.trade_id ? categoryById(e.trade_id) : undefined;
  if (!e.trade_id || !gewerk) {
    befunde.push({ schwere: 'sperrt', text: 'Kein gültiges Gewerk gewählt.' });
  } else if (MEISTERPFLICHT_IDS.has(e.trade_id) && !e.meisterbrief_path) {
    befunde.push({
      schwere: 'sperrt',
      text: `${gewerk.name} ist meisterpflichtig (§ 1 HwO Anlage A), es liegt kein Meisterbrief vor.`,
    });
  }

  if (!e.business_name || e.business_name.trim().length < 3) {
    befunde.push({ schwere: 'ansehen', text: 'Kein brauchbarer Betriebsname angegeben.' });
  } else if (e.full_name && !namenPassen(e.business_name, e.full_name)) {
    befunde.push({
      schwere: 'ansehen',
      text: `Betriebsname „${e.business_name}" und Kontoname „${e.full_name}" haben kein gemeinsames Wort. Steht der Kontoinhaber im Gewerbeschein?`,
    });
  }

  if (e.has_steuer_id === false) {
    befunde.push({
      schwere: 'hinweis',
      text: 'Keine Steuer-ID hinterlegt. Kein Hindernis für die Freigabe; vor Erreichen der PStTG-Schwelle wird sie erfragt.',
    });
  }

  if (gewerk && !MEISTERPFLICHT_IDS.has(gewerk.id) && gewerk.abgrenzung) {
    befunde.push({
      schwere: 'hinweis',
      text: `${gewerk.name} ist zulassungsfrei. Grenze: ${gewerk.abgrenzung}`,
    });
  }

  const stunden = wartetSeitStunden(e, jetzt);
  if (stunden !== null && stunden >= 48) {
    befunde.push({
      schwere: 'ansehen',
      text: `Wartet seit ${Math.floor(stunden / 24)} Tagen. Ein Betrieb, der so lange wartet, ist meist schon weg.`,
    });
  }

  return befunde;
}

/** Darf ohne weiteres freigegeben werden, oder spricht etwas dagegen? */
export function freigabeGesperrt(befunde: Befund[]): boolean {
  return befunde.some((b) => b.schwere === 'sperrt');
}

/**
 * Haben Betriebsname und Kontoname ein gemeinsames Wort?
 *
 * Bewusst grob: „Elektro Wassermann GmbH" und „Tayyip Wassermann" teilen
 * „wassermann". Rechtsformen und Gewerkwoerter zaehlen nicht mit, sonst
 * passte jedes „GmbH" auf jedes andere.
 */
const FUELLWOERTER = new Set([
  'gmbh', 'ug', 'ag', 'kg', 'ohg', 'gbr', 'e.k.', 'ek', 'co', 'und', '&',
  'haftungsbeschraenkt', 'haftungsbeschränkt', 'betrieb', 'meisterbetrieb',
  'elektro', 'sanitaer', 'sanitär', 'heizung', 'bau', 'service', 'technik',
  'sohn', 'soehne', 'söhne', 'inhaber',
]);

export function namenPassen(betrieb: string, konto: string): boolean {
  const zerlegen = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-zäöüß\s&.-]/g, ' ')
      .split(/[\s.&-]+/)
      .filter((w) => w.length >= 3 && !FUELLWOERTER.has(w));

  const a = new Set(zerlegen(betrieb));
  if (a.size === 0) return true;   // nur Fuellwoerter: nichts zu vergleichen
  return zerlegen(konto).some((w) => a.has(w));
}
