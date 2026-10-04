/**
 * Der Support-Assistent „Willi" (`app/support-chat.tsx`).
 *
 * ANLASS (03.10.2026, Founder am Geraet): „Der Bot-Helfer ist nicht richtig
 * zum Helfen." Gemessen an der alten Fassung im Bildschirm:
 *   - Die Reihenfolge entschied, nicht die Frage. „Wie storniere ich meinen
 *     Auftrag?" traf zuerst „auftrag" und bekam den Auftragsstatus.
 *     „Widerrufsrecht" enthaelt „echt" und landete beim Menschen-Hinweis.
 *   - Er versprach, was er nicht kann: „Nennen Sie mir Ihre Auftragsnummer
 *     und ich helfe Ihnen weiter", „senden Sie mir Ihre E-Mail-Adresse",
 *     „ich kann die Dringlichkeit einschaetzen". Er sieht keine Daten.
 *   - Der Weg zur Stornierung („Problem melden" -> „Stornierung beantragen")
 *     existiert nicht.
 *   - Kunde und Betrieb bekamen dieselbe Antwort; Widerruf, Rechnung,
 *     Passwort, Konto loeschen, Auszahlung, Start-PIN fehlten ganz.
 *   - Keine Antwort fuehrte irgendwohin: nur Text, kein Knopf.
 *
 * Jetzt: Themen mit gewichteten Mustern (das spezifischste gewinnt),
 * Antworten je Rolle, und zu jeder Antwort die Knoepfe, die direkt an die
 * richtige Stelle der App fuehren. Bewusst KEIN Sprachmodell: keine Kosten,
 * keine Datenweitergabe, und keine erfundene Auskunft zu Geld oder Recht.
 */
import { MAIL, REKLAMATION_FRIST_WERKTAGE } from '../constants/legal';
import { BEWERTUNGSFRIST_TAGE } from './bewertungsFrist';
import { provisionKurz, servicegebuehrKurz } from './preisHinweis';
import { Werkant_SCHUTZ_FEE } from './feeEngine';
import { euro } from './geld';

export type Rolle = 'customer' | 'provider' | null;

export type Aktion =
  | { art: 'route'; label: string; route: string }
  | { art: 'mail'; label: string };

export type BotAntwort = { thema: string; text: string; aktionen: Aktion[] };

/** Der vorbereitete Weg zu einem Menschen. Geht nur auf Tipp hinaus. */
export function supportMailUrl(): string {
  const betreff = encodeURIComponent('Support-Anfrage');
  const text = encodeURIComponent('Auftragsnummer (falls vorhanden):\nWas ist passiert:\nSeit wann:\n');
  return `mailto:${MAIL.support}?subject=${betreff}&body=${text}`;
}

const MAIL_AKTION: Aktion = { art: 'mail', label: 'E-Mail an das Team' };

const auftraege = (r: Rolle): Aktion => r === 'provider'
  ? { art: 'route', label: 'Zu den Aufträgen', route: '/betrieb/auftraege' }
  : { art: 'route', label: 'Meine Aufträge', route: '/(tabs)/auftraege' };

export const MENSCH_TEXT =
  'Ich bin ein automatischer Assistent und sehe Ihre Aufträge nicht. Einen '
  + 'Live-Chat mit Mitarbeitenden gibt es (noch) nicht.\n\n'
  + `Ein Mensch antwortet per E-Mail an ${MAIL.support}, in der Regel innerhalb `
  + `von ${REKLAMATION_FRIST_WERKTAGE} Werktagen (Mo–Fr). Der Knopf unten öffnet `
  + 'eine vorbereitete E-Mail: Auftragsnummer, was passiert ist, seit wann.';

/**
 * Normalisieren, damit `\b` greift: JavaScript zaehlt ä, ö, ü, ß nicht zu
 * den Wortzeichen. „prüf" haette sonst eine Wortgrenze mitten im Wort.
 */
export function normalisiere(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ').trim();
}

type Thema = {
  id: string;
  /** [Muster auf dem normalisierten Text, Gewicht]. Spezifisch = hoch. */
  muster: Array<[RegExp, number]>;
  antwort: (r: Rolle) => { text: string; aktionen: Aktion[] };
};

const THEMEN: Thema[] = [
  {
    id: 'storno',
    muster: [[/\bstorn/, 3], [/\babsag/, 3], [/\babbrech/, 2], [/\bcancel/, 3], [/\bnicht mehr (brauch|noetig)/, 2]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Öffnen Sie unter „Aufträge" den Auftrag und tippen Sie „Stornieren". '
          + 'Storniert der Betrieb, bekommt der Kunde den vollen Betrag zurück, '
          + 'egal wann.\n\nWer zum Termin nicht erscheint, ohne zu stornieren, '
          + 'riskiert einen Strike (AGB §7).',
        aktionen: [auftraege(r), { art: 'route', label: 'AGB lesen', route: '/agb' }],
      }
      : {
        text: 'Öffnen Sie den Auftrag unter „Meine Aufträge".\n\n'
          + '• Noch kein Angebot angenommen: „Auftrag stornieren", kostenlos.\n'
          + '• Mit Vertrag: „Termin stornieren". Vom Auftragswert bekommen Sie '
          + 'mehr als 48 Stunden vor dem Termin alles zurück, 24 bis 48 Stunden '
          + 'vorher die Hälfte, danach nichts.\n\n'
          + 'Den genauen Betrag sehen Sie, bevor Sie bestätigen. Storniert der '
          + 'Betrieb, bekommen Sie immer alles zurück. Ihr Widerrufsrecht bleibt '
          + 'davon unberührt.',
        aktionen: [auftraege(r), { art: 'route', label: 'Widerruf', route: '/widerruf' }],
      },
  },
  {
    id: 'widerruf',
    muster: [[/\bwiderruf/, 3], [/\bruecktritt/, 2], [/\b14 tage/, 1]],
    antwort: (r) => ({
      text: (r === 'provider'
        ? 'Ihre Kunden können als Verbraucher einen online geschlossenen Vertrag '
        : 'Als Verbraucher können Sie einen online geschlossenen Vertrag ')
        + '14 Tage lang ohne Angabe von Gründen widerrufen.\n\n'
        + '• Wer den früheren Beginn verlangt und bestätigt, dass das Widerrufsrecht '
        + 'dann erlischt, verliert es, sobald die Arbeit vollständig erledigt ist.\n'
        + '• Wer nach Arbeitsbeginn widerruft, zahlt die bis dahin geleistete Arbeit '
        + 'anteilig.\n'
        + '• Nachbarschaftshilfe: Gegenüber einem privaten Helfer gibt es kein '
        + `gesetzliches Widerrufsrecht, nur für den Werkant-Schutz (${euro(Werkant_SCHUTZ_FEE)}).\n\n`
        + 'Belehrung und Muster-Formular finden Sie unter Einstellungen.',
      aktionen: [{ art: 'route', label: 'Widerrufsbelehrung & Formular', route: '/widerruf' }],
    }),
  },
  {
    id: 'passwort',
    muster: [[/\bpasswort/, 3], [/\bkennwort/, 3], [/\beinlogg/, 2], [/\blogin/, 2], [/\banmeld\w* (geht|klappt|funktioniert) nicht/, 3]],
    antwort: () => ({
      text: 'Tippen Sie auf der Anmeldeseite „Passwort vergessen" und geben Sie Ihre '
        + 'E-Mail-Adresse ein. Sie bekommen einen Link, mit dem Sie ein neues '
        + 'Passwort setzen.\n\nKommt nichts an, sehen Sie bitte im Spam-Ordner nach.',
      aktionen: [{ art: 'route', label: 'Passwort zurücksetzen', route: '/passwort-vergessen' }],
    }),
  },
  {
    id: 'konto_loeschen',
    muster: [[/\b(konto|account|profil)\w* (loesch|kuendig|entfern)/, 4], [/\bloesch/, 2], [/\bdaten ?export/, 3],
      [/\bdsgvo\b/, 2], [/\bdatenschutz/, 2], [/\bmeine daten\b/, 2]],
    antwort: () => ({
      text: 'Unter Einstellungen finden Sie beides:\n\n'
        + '• „Meine Daten exportieren": eine vollständige Datei mit Ihren Angaben, '
        + 'Aufträgen, Nachrichten und Bewertungen.\n'
        + '• „Konto löschen": Sie bestätigen einmal, dann wird gelöscht. Daten, '
        + 'die wir gesetzlich aufbewahren müssen (etwa Rechnungen), bleiben so lange '
        + 'gesperrt erhalten.\n\nWas wir wofür speichern, steht in der Datenschutzerklärung.',
      aktionen: [
        { art: 'route', label: 'Einstellungen', route: '/einstellungen' },
        { art: 'route', label: 'Datenschutz', route: '/datenschutz' },
      ],
    }),
  },
  {
    id: 'rechnung',
    muster: [[/\brechnung/, 3], [/\bbeleg/, 3], [/\bquittung/, 3]],
    antwort: (r) => ({
      text: r === 'provider'
        ? 'Über die einbehaltene Plattformgebühr erhalten Sie eine Gebührenrechnung. '
          + 'Ihre abgeschlossenen Aufträge finden Sie unter „Aufträge".'
        : 'Ist ein Auftrag abgeschlossen und ausgezahlt, steht unter „Meine Aufträge" '
          + 'beim Auftrag der Knopf „Beleg". Er zeigt Preis, Gebühren und Zahlung.',
      aktionen: [auftraege(r)],
    }),
  },
  {
    id: 'auszahlung',
    muster: [[/\bauszahl/, 3], [/\bpayout/, 3], [/\bwann (bekomme|kriege|erhalte) ich (mein |das )?geld/, 3], [/\berstatt/, 3], [/\bgeld zurueck/, 3]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Ausgezahlt wird innerhalb von 2 Werktagen, nachdem der Kunde die Arbeit '
          + 'freigegeben hat oder die Abnahmefrist abgelaufen ist.\n\n'
          + `Abgezogen werden ${provisionKurz()}. In der Nachbarschaftshilfe gibt es `
          + 'keinen Abzug.\n\nDafür muss Ihr Auszahlungskonto bei Stripe eingerichtet sein.',
        aktionen: [{ art: 'route', label: 'Auszahlungskonto', route: '/betrieb/onboarding-stripe' }, auftraege(r)],
      }
      : {
        text: 'Geld zurück bekommen Sie bei einer Stornierung (je nach Zeitpunkt, '
          + 'siehe „Stornierung") oder wenn der Betrieb storniert, dann immer alles. '
          + 'Erstattet wird auf das Zahlungsmittel, mit dem Sie bezahlt haben.\n\n'
          + 'Bei einem Mangel melden Sie das über „Problem" im Auftrag: dann bleibt '
          + 'das Geld gesperrt, bis die Sache geklärt ist.',
        aktionen: [auftraege(r)],
      },
  },
  {
    id: 'zahlung',
    muster: [[/\bzahl/, 2], [/\btreuhand/, 3], [/\bescrow/, 3], [/\bgeld\b/, 1], [/\bstripe/, 2], [/\bkarte\b/, 2],
      [/\bueberweis/, 2], [/\babbuch/, 2], [/\bpaypal/, 2]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Der Kunde zahlt bei Vertragsschluss auf ein Treuhandkonto bei Stripe. '
          + 'Im Vertrag sehen Sie, ob das Geld bereitliegt. Ausgezahlt wird nach der '
          + 'Freigabe.\n\nNehmen Sie nie Geld am Treuhandkonto '
          + 'vorbei an: Das verstößt gegen die AGB und nimmt beiden Seiten den Schutz.',
        aktionen: [auftraege(r), { art: 'route', label: 'Auszahlungskonto', route: '/betrieb/onboarding-stripe' }],
      }
      : {
        text: 'Ihr Geld liegt auf einem Treuhandkonto bei Stripe, sobald Sie zahlen. '
          + 'Der Betrieb bekommt es erst, wenn Sie die Arbeit freigeben. Melden Sie '
          + 'sich nach der Fertigstellung 14 Tage lang nicht, gilt die Arbeit als '
          + 'abgenommen (§ 640 Abs. 2 BGB); darauf weisen wir Sie vorher hin.\n\n'
          + 'Ihre Kartendaten gehen direkt an Stripe, Werkant sieht sie nicht. '
          + 'Zahlen Sie nie bar oder per Überweisung am Treuhandkonto vorbei: dann '
          + 'gilt der Werkant-Schutz nicht.',
        aktionen: [auftraege(r), { art: 'route', label: 'Werkant-Schutz', route: '/garantie' }],
      },
  },
  {
    id: 'reklamation',
    muster: [[/\breklam/, 3], [/\bmangel|\bmaengel/, 3], [/\bbeschwer/, 3], [/\bschaden/, 3], [/\bpfusch/, 3],
      [/\bnicht (erschienen|gekommen|aufgetaucht)/, 3], [/\bpreiserhoeh|\bmehr (geld )?verlangt/, 3],
      [/\bunfertig|\bkaputt/, 2], [/\bproblem/, 1], [/\bstreit/, 2]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Meldet ein Kunde einen Mangel, bleibt die Auszahlung gesperrt, bis die '
          + `Sache geklärt ist. Werkant prüft innerhalb von ${REKLAMATION_FRIST_WERKTAGE} `
          + 'Werktagen und meldet sich bei beiden Seiten.\n\nHaben Sie selbst ein Problem '
          + 'mit einem Kunden, schreiben Sie uns mit der Auftragsnummer.',
        aktionen: [auftraege(r), MAIL_AKTION],
      }
      : {
        text: 'Öffnen Sie den Auftrag und tippen Sie unten auf „Problem". Dort wählen '
          + 'Sie, was passiert ist: Mängel, nicht erschienen, Preiserhöhung ohne '
          + 'Absprache, Sachschaden, Kommunikation oder Sonstiges.\n\n'
          + 'Melden Sie innerhalb der Abnahmefrist, bleibt das Geld gesperrt, bis die '
          + `Sache geklärt ist. Werkant prüft innerhalb von ${REKLAMATION_FRIST_WERKTAGE} `
          + 'Werktagen und meldet sich bei beiden Seiten.',
        aktionen: [auftraege(r)],
      },
  },
  {
    id: 'melden',
    muster: [[/\bmeld(en|e|ung)\b/, 2], [/\b(handy|telefon)?nummer/, 2], [/\bwhatsapp/, 3], [/\bspam\b/, 3],
      [/\bbeleidig/, 3], [/\bbetrug|\bbetrueger|\bfake\b/, 3], [/\bbelaestig/, 3]],
    antwort: () => ({
      text: 'Eine Nachricht im Chat melden Sie, indem Sie sie gedrückt halten und '
        + 'einen Grund wählen. Das geht auch vor dem Vertrag.\n\nEin Profil melden Sie '
        + 'auf der Profilseite über „Melden".\n\nGeben Sie Telefonnummern erst nach '
        + 'dem Vertrag weiter, und zahlen Sie nur über Werkant: Wer Sie zu Zahlung '
        + 'außerhalb drängt, verstößt gegen die AGB.',
      aktionen: [{ art: 'route', label: 'Zu den Nachrichten', route: '/(tabs)/nachrichten' }],
    }),
  },
  {
    id: 'bewertung',
    muster: [[/\bbewert/, 3], [/\bsterne?\b/, 2], [/\brating/, 2], [/\brezension/, 3]],
    antwort: (r) => ({
      text: `Bewerten können Sie nach Abschluss eines Auftrags, ${BEWERTUNGSFRIST_TAGE} Tage lang. `
        + 'Das gilt in beide Richtungen, und nur wer den Auftrag wirklich hatte, kann '
        + 'bewerten.\n\nWer bewertet wurde, darf einmal öffentlich antworten; die '
        + 'Bewertung selbst bleibt unverändert. Halten Sie eine Bewertung für erfunden, '
        + 'melden Sie sie: Wir prüfen und sagen Ihnen, was wir entschieden haben.',
      aktionen: [
        { art: 'route', label: 'Bewertung melden', route: '/melden?art=bewertung' },
        auftraege(r),
      ],
    }),
  },
  {
    id: 'termin',
    muster: [[/\btermin/, 2], [/\bstart-?pin\b|\bpin\b/, 3], [/\bverschieb/, 2], [/\bwann kommt/, 3], [/\buhrzeit/, 2]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Den Termin finden Sie im Vertrag. Vor Ort nennt Ihnen der Kunde die '
          + 'Start-PIN; tippen Sie sie im Vertrag ein. Damit ist belegt, dass Sie '
          + 'angefangen haben. Nachbarschaftshilfe hat keine PIN.\n\nÄnderungen am '
          + 'Termin sprechen Sie im Chat mit dem Kunden ab.',
        aktionen: [auftraege(r)],
      }
      : {
        text: 'Den Termin finden Sie im Vertrag. Wenn der Betrieb vor Ort anfängt, '
          + 'nennen Sie ihm die Start-PIN aus dem Vertrag. Geben Sie die PIN erst vor '
          + 'Ort weiter, nicht vorab per Nachricht. Nachbarschaftshilfe hat keine PIN.'
          + '\n\nÄnderungen am Termin sprechen Sie im Chat mit dem Betrieb ab.',
        aktionen: [auftraege(r)],
      },
  },
  {
    id: 'angebot',
    muster: [[/\bangebot/, 2], [/\bbiet/, 2], [/\bkostenvoranschlag/, 3]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Passende Anfragen sehen Sie unter „Aufträge". Geben Sie einen Festpreis '
          + 'oder Stundensatz an. Materialkosten weisen Sie getrennt aus, darauf fällt '
          + 'keine Provision an.\n\nEin offenes Angebot können Sie zurückziehen, solange '
          + 'der Kunde es nicht angenommen hat.',
        aktionen: [auftraege(r)],
      }
      : {
        text: 'Angebote erscheinen in Ihrem Auftrag, mit Namen, Bewertung, Preis und '
          + 'Gebühren. Sie können annehmen, ablehnen oder erst eine Frage stellen.\n\n'
          + 'Mit der Annahme entsteht der Vertrag. Bezahlt wird auf das Treuhandkonto; '
          + 'der Betrieb bekommt das Geld erst nach Ihrer Freigabe.',
        aktionen: [auftraege(r)],
      },
  },
  {
    id: 'verifizierung',
    muster: [[/\bverifiz/, 3], [/\bfreischalt|\bfreigeschalt|\bfreigab/, 3], [/\bgewerbeschein/, 3], [/\bmeisterbrief/, 3],
      [/\bpruef/, 1], [/\bausweis/, 2]],
    antwort: (r) => r === 'provider'
      ? {
        text: 'Wir prüfen Gewerbeschein und Steuernummer von Hand, bei '
          + 'meisterpflichtigen Gewerken auch den Meisterbrief. Eine Ausweiskopie '
          + 'verlangen wir nicht.\n\nSie bekommen eine E-Mail, sobald Ihr Konto '
          + 'freigeschaltet ist. Ein festes Zeitversprechen gibt es im Beta-Betrieb '
          + 'nicht. Dauert es Ihnen zu lange, schreiben Sie uns mit Ihrer registrierten '
          + 'Adresse.',
        aktionen: [{ art: 'route', label: 'Mein Profil', route: '/betrieb/profil' }, MAIL_AKTION],
      }
      : {
        text: 'Als Kunde brauchen Sie keine Verifizierung. Jeden Betrieb prüfen wir vor '
          + 'der Freischaltung von Hand: Gewerbeschein, Steuernummer und bei '
          + 'meisterpflichtigen Gewerken den Meisterbrief.',
        aktionen: [{ art: 'route', label: 'Werkant-Schutz', route: '/garantie' }],
      },
  },
  {
    id: 'gebuehren',
    muster: [[/\bgebuehr/, 3], [/\bprovision/, 3], [/\bkoste/, 2], [/\bpreis\b/, 1], [/\b8 ?%/, 3], [/\babo\b/, 2]],
    antwort: (r) => ({
      text: r === 'provider'
        ? `Handwerk: ${provisionKurz()}. Ausgewiesene Materialkosten sind provisionsfrei. `
          + 'Sie zahlen nur bei einem abgeschlossenen Auftrag: keine Lead-Gebühr, kein Abo.'
          + '\n\nNachbarschaftshilfe: keine Provision.'
        : `Handwerk: ${servicegebuehrKurz()} auf den Auftragswert.\n\n`
          + `Nachbarschaftshilfe: ${euro(Werkant_SCHUTZ_FEE)} Werkant-Schutz pro Auftrag.\n\n`
          + 'Den genauen Betrag sehen Sie vor jeder Zahlung.',
      aktionen: [{ art: 'route', label: 'AGB §6 lesen', route: '/agb' }],
    }),
  },
  {
    id: 'nachbarschaft',
    muster: [[/\bnachbar/, 3], [/\bhelfer/, 2], [/\bprivatperson/, 2]],
    antwort: () => ({
      text: 'Nachbarschaftshilfe ist für einfache Hilfe unter Privatleuten: Garten, '
        + 'Umzugshilfe, Einkaufen, Reinigung, Möbelaufbau, Wäsche, IT-Hilfe.\n\n'
        + '• Helfer sind Privatpersonen, keine Betriebe, und bekommen den Preis '
        + `vollständig. Der Kunde zahlt ${euro(Werkant_SCHUTZ_FEE)} Werkant-Schutz.\n`
        + '• Handwerk mit Gewerbe, etwa Elektro oder Sanitär, läuft im Bereich '
        + 'Handwerk. Ein Betrieb bietet nur dort.',
      aktionen: [{ art: 'route', label: 'Werkant-Schutz', route: '/garantie' }],
    }),
  },
  {
    id: 'auftrag',
    muster: [[/\bauftra(g|eg)/, 1], [/\bstatus/, 1], [/\bbestellung/, 1], [/\bjob\b/, 1]],
    antwort: (r) => ({
      text: r === 'provider'
        ? 'Unter „Aufträge" finden Sie neue Anfragen, Ihre offenen Angebote und '
          + 'laufende Aufträge. Tippen Sie einen an für Vertrag, Chat und Termin.'
        : 'Unter „Meine Aufträge" finden Sie alle Aufträge mit ihrem Stand. Tippen Sie '
          + 'einen an: dort sind Angebote, Vertrag, Chat, Zahlung und „Problem".',
      aktionen: [auftraege(r)],
    }),
  },
  {
    id: 'konto',
    muster: [[/\bprofil/, 1], [/\beinstellung/, 1], [/\bkonto\b/, 1], [/\be-?mail/, 1], [/\badresse/, 1], [/\bbenachrichtig|\bpush\b/, 2]],
    antwort: (r) => ({
      text: 'Profil, Zahlungsmethoden, Benachrichtigungen und Datenschutz finden Sie '
        + 'unter Einstellungen.',
      aktionen: r === 'provider'
        ? [{ art: 'route', label: 'Mein Profil', route: '/betrieb/profil' }, { art: 'route', label: 'Einstellungen', route: '/einstellungen' }]
        : [{ art: 'route', label: 'Einstellungen', route: '/einstellungen' }],
    }),
  },
  {
    id: 'mensch',
    muster: [[/\bmensch/, 4], [/\bmitarbeiter/, 4], [/\becht\w* person/, 4], [/\banruf/, 3], [/\bhotline/, 4], [/\bkontakt\b/, 2], [/\bsupport team|\bteam\b/, 2]],
    antwort: () => ({ text: MENSCH_TEXT, aktionen: [MAIL_AKTION] }),
  },
];

const GRUSS = /^(hallo|hi|hey|moin|servus|guten (morgen|tag|abend))\b/;
const DANK = /\b(danke|vielen dank|super|prima|top)\b/;

/**
 * Die Antwort auf eine Frage, oder `null`, wenn nichts sicher passt.
 * Gewinner ist das Thema mit der hoechsten Summe; bei Gleichstand das, das
 * weiter oben in THEMEN steht (spezifische Themen stehen oben).
 */
export function antwort(frage: string, rolle: Rolle): BotAntwort | null {
  const t = normalisiere(frage);
  if (!t) return null;
  let bester: { thema: Thema; punkte: number } | null = null;
  for (const thema of THEMEN) {
    const punkte = thema.muster.reduce((s, [re, w]) => (re.test(t) ? s + w : s), 0);
    if (punkte > 0 && (!bester || punkte > bester.punkte)) bester = { thema, punkte };
  }
  if (bester) return { thema: bester.thema.id, ...bester.thema.antwort(rolle) };
  if (GRUSS.test(t)) {
    return { thema: 'gruss', text: 'Hallo! Wobei kann ich helfen? Schreiben Sie Ihre Frage oder tippen Sie ein Thema unten.', aktionen: [] };
  }
  if (DANK.test(t)) {
    return { thema: 'dank', text: 'Gern geschehen. Brauchen Sie noch etwas, fragen Sie einfach.', aktionen: [] };
  }
  return null;
}

/**
 * Rueckfall bei unverstandener Frage: NICHT dieselbe Nachfrage wiederholen
 * (Founder-Feedback 26.07. „fragt immer dasselbe"), sondern eskalieren.
 */
export function rueckfall(fehlversuch: number): BotAntwort {
  if (fehlversuch <= 1) {
    return { thema: 'rueckfall', aktionen: [], text: 'Das habe ich nicht sicher verstanden. Versuchen Sie es mit einem Stichwort, '
      + 'zum Beispiel: Stornierung, Zahlung, Problem, Rechnung, Widerruf, Passwort. '
      + 'Oder tippen Sie ein Thema unten.' };
  }
  return { thema: 'rueckfall', text: MENSCH_TEXT, aktionen: [MAIL_AKTION] };
}

export type Schnellthema = { label: string; frage: string; icon: string };

/** Die Themen-Knoepfe, je Rolle die haeufigsten Fragen. */
export function schnellthemen(rolle: Rolle): Schnellthema[] {
  if (rolle === 'provider') {
    return [
      { label: 'Auszahlung', frage: 'Wann bekomme ich mein Geld?', icon: 'wallet-outline' },
      { label: 'Verifizierung', frage: 'Wann werde ich freigeschaltet?', icon: 'shield-checkmark-outline' },
      { label: 'Angebot abgeben', frage: 'Wie gebe ich ein Angebot ab?', icon: 'document-text-outline' },
      { label: 'Gebühren', frage: 'Welche Gebühren zahle ich?', icon: 'cash-outline' },
      { label: 'Stornieren', frage: 'Wie storniere ich einen Auftrag?', icon: 'close-circle-outline' },
      { label: 'Mensch erreichen', frage: 'Ich möchte mit einem Menschen sprechen.', icon: 'mail-outline' },
    ];
  }
  return [
    { label: 'Stornieren', frage: 'Wie storniere ich meinen Auftrag?', icon: 'close-circle-outline' },
    { label: 'Problem melden', frage: 'Ich habe ein Problem mit der Arbeit.', icon: 'alert-circle-outline' },
    { label: 'Zahlung & Treuhand', frage: 'Wie funktioniert das Treuhandkonto?', icon: 'card-outline' },
    { label: 'Gebühren', frage: 'Welche Gebühren fallen an?', icon: 'cash-outline' },
    { label: 'Widerruf', frage: 'Wie funktioniert der Widerruf?', icon: 'return-down-back-outline' },
    { label: 'Mensch erreichen', frage: 'Ich möchte mit einem Menschen sprechen.', icon: 'mail-outline' },
  ];
}

/** Fuer den Pruefstand: alle Themen-Kennungen. */
export const THEMEN_IDS = THEMEN.map((t) => t.id);
/** Fuer den Pruefstand: jede Antwort in beiden Rollen. */
export function alleAntworten(): BotAntwort[] {
  const rollen: Rolle[] = ['customer', 'provider', null];
  return THEMEN.flatMap((t) => rollen.map((r) => ({ thema: t.id, ...t.antwort(r) })));
}
