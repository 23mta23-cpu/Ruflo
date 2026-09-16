/**
 * Wer bewertet hier wen?
 *
 * ANLASS (16.09.2026): Die Datenbank erlaubt die Bewertung seit 0310 in beide
 * Richtungen, der Bildschirm `app/bewertung.tsx` war aber durchgehend aus der
 * Sicht des Kunden geschrieben: er zeigte den Firmennamen, den vom KUNDEN
 * gezahlten Betrag unter der Beschriftung „bezahlt" und Schlagworte wie
 * „Sauber gearbeitet" oder „Gutes Preis-Leistung". Auf einen Kunden passt
 * davon nichts.
 *
 * Solange es keinen Eingang fuer die Gegenbewertung gab, fiel das niemandem
 * auf. Mit dem Eingang wuerde es sofort auffallen -- und zwar dem Anbieter,
 * der dann seinen EIGENEN Firmennamen bewertet haette.
 */

export type Vertragssicht = {
  vertragId: string | null | undefined;
  customer_id?: string | null;
  provider_id?: string | null;
  customer_total?: number | null;
  provider_payout?: number | null;
  customer?: { full_name?: string | null } | null;
  provider?: { business_name?: string | null } | null;
};

export type Sicht = {
  /** 'anbieter' = ein Kunde bewertet einen Anbieter. 'kunde' = umgekehrt. */
  richtung: 'anbieter' | 'kunde';
  /** Name der bewerteten Seite, wie er auf dem Bildschirm stehen soll. */
  name: string;
  /** Betrag und seine Beschriftung, aus der Sicht des Bewertenden. */
  betrag: number | null;
  betragLabel: string;
  /** Ueberschrift ueber der Bewertung. */
  frage: string;
  /** Satz zum Antwortrecht der Gegenseite. */
  antwortHinweis: string;
  tagsPositiv: string[];
  tagsNegativ: string[];
};

const TAGS_ANBIETER_GUT = ['Pünktlich', 'Sauber gearbeitet', 'Freundlich', 'Gutes Preis-Leistung', 'Zuverlässig'];
const TAGS_ANBIETER_SCHLECHT = ['Unpünktlich', 'Schlechte Qualität', 'Kommunikationsprobleme', 'Unvollständige Arbeit'];

// Eigene Liste, keine Kopie: „Sauber gearbeitet" sagt ueber einen Kunden
// nichts, und „Gutes Preis-Leistung" ergibt aus dieser Richtung keinen Sinn.
const TAGS_KUNDE_GUT = ['Klare Absprachen', 'Gut erreichbar', 'Zugang war vorbereitet', 'Freundlich', 'Zügige Freigabe'];
const TAGS_KUNDE_SCHLECHT = ['Unklare Angaben', 'Schlecht erreichbar', 'Zugang war nicht möglich', 'Späte Freigabe'];

/**
 * `reviewedId` entscheidet, nicht die Rolle des Angemeldeten: der Bildschirm
 * bekommt beides aus den Parametern, und die Rolle koennte aus einer
 * veralteten Sitzung stammen.
 */
export function sichtBestimmen(vertrag: Vertragssicht | null, reviewedId: string | null | undefined): Sicht {
  const bewerteIchDenKunden =
    !!reviewedId && !!vertrag?.customer_id && reviewedId === vertrag.customer_id;

  if (bewerteIchDenKunden) {
    return {
      richtung: 'kunde',
      name: vertrag?.customer?.full_name?.trim() || 'Kunde',
      betrag: vertrag?.provider_payout ?? null,
      betragLabel: 'erhalten',
      frage: 'Wie war die Zusammenarbeit?',
      antwortHinweis: 'Der Kunde darf einmal öffentlich antworten. Ihre Bewertung kann er dabei nicht ändern.',
      tagsPositiv: TAGS_KUNDE_GUT,
      tagsNegativ: TAGS_KUNDE_SCHLECHT,
    };
  }

  return {
    richtung: 'anbieter',
    name: vertrag?.provider?.business_name?.trim() || 'Anbieter',
    betrag: vertrag?.customer_total ?? null,
    betragLabel: 'bezahlt',
    frage: 'Wie war Ihr Erlebnis?',
    antwortHinweis: 'Der Anbieter darf einmal öffentlich antworten. Ihre Bewertung kann er dabei nicht ändern.',
    tagsPositiv: TAGS_ANBIETER_GUT,
    tagsNegativ: TAGS_ANBIETER_SCHLECHT,
  };
}
