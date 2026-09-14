/**
 * Rechtstexte gegen den Code, den sie beschreiben.
 *
 * ANLASS (14.09.2026): Beim Ergaenzen der Datenschutzerklaerung wollte ich
 * schreiben „Ein Vermerk allein fuehrt zu keiner automatischen Sperre; ueber
 * Massnahmen entscheidet ein Mensch". Das waere FALSCH gewesen. Ich hatte eine
 * Notiz uebertragen, die fuer `chat_reports` (0700) gilt, nicht fuer
 * `chat_leak_flags`: dort haengt seit 0500/0720 ein Trigger dran, und die
 * Kette 3 Funde -> 1 Strike -> 3 Strikes -> keine Angebote mehr laeuft ohne
 * jeden Menschen. Genau die Klasse Fehler, die dieses Projekt „gruene Haken,
 * die nichts pruefen" nennt — nur diesmal in einem Rechtstext.
 *
 * Ein Prosa-Satz kann aus dem Code herauslaufen, ohne dass irgendetwas rot
 * wird. Diese Datei bindet die Zahlen der Texte an die Migrationen.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
import { DSGVO_ZUSTIMMUNG, DSGVO_TEXT_VERSION } from '../lib/dsgvoConsent';

const wurzel = join(__dirname, '..');
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8');

const datenschutz = lies('app/datenschutz.tsx');
const mig0720 = lies('supabase/migrations/0720_strike_verfall_und_begruendung.sql');

// ---------------------------------------------------------------------------
// Altersgrenze: die richtige Norm
// ---------------------------------------------------------------------------

describe('18-Jahre-Grenze nennt die tragende Norm', () => {
  it('nicht mehr JArbSchG — das regelt die Beschäftigung durch einen Arbeitgeber', () => {
    // Geprueft wird der WERT, den der Nutzer liest, nicht die Datei: die
    // Erklaerung im Quelltext nennt das alte Gesetz natuerlich weiter.
    // Werkant ist kein Arbeitgeber seiner Nutzer, und das JArbSchG schliesst
    // niemanden von einer Plattform aus. „(§ JArbSchG)" war zudem ein
    // Paragrafenzeichen ohne Nummer.
    expect(DSGVO_ZUSTIMMUNG).not.toMatch(/JArbSchG/);
    expect(lies('app/onboarding-kyc.tsx')).not.toMatch(/JArbSchG/);
  });

  it('nennt stattdessen die Geschäftsfähigkeit (§§ 106, 107 BGB)', () => {
    expect(DSGVO_ZUSTIMMUNG).toMatch(/§§ 106 und 107 BGB/);
  });

  it('die Fassungskennung wurde mitgezählt', () => {
    // Der Satz steht im Einwilligungs-Nachweis. Bleibt die Kennung stehen,
    // ordnet die Datenbank neue Zustimmungen dem alten Wortlaut zu.
    expect(DSGVO_TEXT_VERSION).not.toBe('dsgvo-2026-08-16');
  });
});

// ---------------------------------------------------------------------------
// Empfänger: wer die Daten tatsächlich bekommt
// ---------------------------------------------------------------------------

describe('Empfängerliste ist vollständig (Art. 13 Abs. 1 lit. e DSGVO)', () => {
  it('nennt Expo — jede Push-Nachricht läuft über exp.host', () => {
    // Fünf Edge Functions rufen https://exp.host/--/api/v2/push/send auf.
    // Gerätekennung und Nachrichteninhalt verlassen dabei die EU.
    expect(datenschutz).toMatch(/Expo/);
    expect(datenschutz).toMatch(/APNs/);
    expect(datenschutz).toMatch(/FCM/);
  });

  it('sagt auch, wie man die Übermittlung abstellt', () => {
    expect(datenschutz).toMatch(/Push jederzeit in den\s+Einstellungen abschalten/);
  });

  it('die Push-Funktionen rufen wirklich exp.host — sonst prüft das Obige nichts', () => {
    expect(lies('supabase/functions/send-push/index.ts')).toContain('exp.host');
  });
});

// ---------------------------------------------------------------------------
// Automatisierte Entscheidung: offenlegen, nicht bestreiten
// ---------------------------------------------------------------------------

describe('Automatisierte Entscheidung (Art. 13 Abs. 2 lit. f, Art. 22 DSGVO)', () => {
  it('es gibt überhaupt einen solchen Abschnitt', () => {
    expect(datenschutz).toMatch(/Automatisierte Entscheidungen/);
    expect(datenschutz).toMatch(/Art\. 22 DSGVO/);
  });

  it('bestreitet die Automatik nicht', () => {
    // Der Satz, den ich beinahe geschrieben haette.
    expect(datenschutz).not.toMatch(/kein Fall des Art\. 22/);
    expect(datenschutz).not.toMatch(/führt zu keiner automatischen Sperre/);
  });

  it('nennt die drei Sicherungen aus Art. 22 Abs. 3: Begründung, Mensch, Widerspruch', () => {
    expect(datenschutz).toMatch(/schriftliche Begründung/);
    expect(datenschutz).toMatch(/Überprüfung durch einen Menschen/);
    expect(datenschutz).toMatch(/widersprechen/);
  });

  it('die Chat-Prüfung wird als Zweck genannt, nicht nur die Folge', () => {
    expect(datenschutz).toMatch(/Prüfung von Chat-Nachrichten auf Kontaktdaten/);
  });
});

// ---------------------------------------------------------------------------
// Die Bindung: stimmen die Zahlen im Text mit der Migration überein?
// ---------------------------------------------------------------------------

describe('Text und Migration 0720 sagen dasselbe', () => {
  it('12-Monats-Fenster für die Funde', () => {
    expect(mig0720).toMatch(/created_at > now\(\) - interval '12 months'/);
    expect(datenschutz).toMatch(/innerhalb von 12 Monaten dreimal/);
  });

  it('drei Funde ergeben einen Strike', () => {
    expect(mig0720).toMatch(/floor\(v_funde \/ 3\.0\)/);
  });

  it('drei aktive Strikes sperren das Bieten', () => {
    expect(mig0720).toMatch(/aktive_strikes\(auth\.uid\(\)\) < 3/);
    expect(datenschutz).toMatch(/drei gleichzeitig aktiven Strikes/);
  });

  it('ein Strike verfällt nach 12 Monaten', () => {
    expect(mig0720).toMatch(/verfaellt_am timestamptz not null default \(now\(\) \+ interval '12 months'\)/);
    expect(datenschutz).toMatch(/verfällt 12 Monate nach seiner Vergabe/);
  });

  it('die Sperre trifft NUR neue Angebote — der Text verspricht nichts Weiteres', () => {
    // aktive_strikes() steht in genau einer Policy, der offers-INSERT.
    // Traefe es auch Chat oder Auszahlung, waere der Satz im Text falsch.
    const policyStellen = (mig0720.match(/aktive_strikes\(auth\.uid\(\)\)/g) ?? []).length;
    expect(policyStellen).toBe(1);
    expect(datenschutz).toMatch(/Es geht allein um neue Angebote/);
  });

  it('eine schlechte Bewertung löst keinen Strike aus', () => {
    const mig0500 = lies('supabase/migrations/0500_quality_strikes_automation.sql');
    expect(mig0500).toMatch(/löst KEINEN automatischen Strike aus/);
    expect(datenschutz).toMatch(/Eine schlechte Bewertung löst dagegen KEINEN Strike aus/);
  });
});
