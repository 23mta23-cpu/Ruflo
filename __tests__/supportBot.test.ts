import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  antwort, rueckfall, schnellthemen, supportMailUrl, alleAntworten, MENSCH_TEXT, normalisiere,
} from '../lib/supportBot';
import { provisionKurz, servicegebuehrKurz } from '../lib/preisHinweis';
import { MAIL } from '../constants/legal';

const thema = (frage: string, rolle: 'customer' | 'provider' = 'customer') => antwort(frage, rolle)?.thema ?? null;

describe('die Frage entscheidet, nicht die Reihenfolge', () => {
  // Founder 03.10.2026: „Der Bot-Helfer ist nicht richtig zum Helfen."
  // Die ersten vier Zeilen landeten in der alten Fassung beim falschen Thema.
  it.each([
    ['Wie storniere ich meinen Auftrag?', 'storno'],          // war: Auftragsstatus
    ['Wie funktioniert das Widerrufsrecht?', 'widerruf'],      // war: Mensch („echt" in „Recht")
    ['Ich habe ein Problem mit der Zahlung', 'zahlung'],
    ['Ich möchte mein Konto löschen', 'konto_loeschen'],       // war: Kontoeinstellungen
    ['Preiserhöhung ohne Absprache', 'reklamation'],
    ['Der Handwerker ist nicht gekommen', 'reklamation'],
    ['Er hat mir seine Handynummer geschickt', 'melden'],
    ['Passwort vergessen', 'passwort'],
    ['Wo finde ich meine Rechnung?', 'rechnung'],
    ['Was ist die Start-PIN?', 'termin'],
    ['Was ist Nachbarschaftshilfe?', 'nachbarschaft'],
    ['Was kostet das?', 'gebuehren'],
    ['Ich will mit einem Menschen sprechen', 'mensch'],
    ['Wie bewerte ich den Betrieb?', 'bewertung'],
    ['Wo ist mein Auftrag?', 'auftrag'],
  ])('%s', (frage, erwartet) => {
    expect(thema(frage)).toBe(erwartet);
  });

  it.each([
    ['Wann bekomme ich mein Geld?', 'auszahlung'],
    ['Wie gebe ich ein Angebot ab?', 'angebot'],
    ['Wann werde ich freigeschaltet?', 'verifizierung'],
  ])('Betrieb: %s', (frage, erwartet) => {
    expect(thema(frage, 'provider')).toBe(erwartet);
  });

  it('Umlaute stoeren die Wortgrenze nicht', () => {
    expect(normalisiere('Prüfung Größe')).toBe('pruefung groesse');
  });
});

describe('Kunde und Betrieb bekommen ihre eigene Antwort', () => {
  it('Gebuehren: Betrieb liest die Provision, Kunde die Servicegebuehr und den Schutz', () => {
    expect(antwort('Gebühren', 'provider')!.text).toContain(provisionKurz());
    const k = antwort('Gebühren', 'customer')!.text;
    expect(k).toContain(servicegebuehrKurz());
    expect(k).toMatch(/1,99/);
    expect(k).not.toContain(provisionKurz());
  });

  it.each(['Wie storniere ich?', 'Treuhandkonto', 'Auszahlung', 'Termin'])('%s unterscheidet sich je Rolle', (f) => {
    expect(antwort(f, 'provider')!.text).not.toBe(antwort(f, 'customer')!.text);
  });

  it('Stornieren fuehrt jede Rolle zu IHREN Auftraegen', () => {
    const route = (r: 'customer' | 'provider') => antwort('stornieren', r)!.aktionen
      .flatMap((a) => (a.art === 'route' ? [a.route] : []));
    expect(route('customer')).toContain('/(tabs)/auftraege');
    expect(route('provider')).toContain('/betrieb/auftraege');
  });
});

describe('verspricht nichts, was er nicht kann', () => {
  const texte = [...alleAntworten().map((a) => a.text), MENSCH_TEXT, rueckfall(1).text, rueckfall(2).text];

  it.each([
    /nennen Sie mir/i, /senden Sie mir/i, /verbinde ich/i, /Echtzeit/i,
    /Dringlichkeit/i, /Stornierung beantragen/i, /helfe Ihnen weiter/i,
  ])('kein %s', (muster) => {
    for (const t of texte) expect(t).not.toMatch(muster);
  });

  it('sagt selbst, dass er keine Auftraege sieht', () => {
    expect(MENSCH_TEXT).toMatch(/sehe Ihre Aufträge nicht/);
  });

  it('der Bildschirm zeigt keine erfundene Bewertung mehr', () => {
    const src = readFileSync(join(__dirname, '../app/support-chat.tsx'), 'utf8');
    expect(src).not.toMatch(/ratingChip|>4\.9</);
    expect(src).toMatch(/from '\.\.\/lib\/supportBot'/);
  });
});

describe('jeder Knopf fuehrt an eine Stelle, die es gibt', () => {
  const app = join(__dirname, '../app');
  const gibtEs = (route: string) => {
    const pfad = route.split('?')[0].replace(/^\//, '');
    return existsSync(join(app, `${pfad}.tsx`)) || existsSync(join(app, pfad, 'index.tsx'));
  };

  it('alle Routen aus allen Antworten', () => {
    const routen = alleAntworten().flatMap((a) => a.aktionen)
      .flatMap((a) => (a.art === 'route' ? [a.route] : []));
    expect(routen.length).toBeGreaterThan(10);
    for (const r of routen) expect([r, gibtEs(r)]).toEqual([r, true]);
  });

  it('Gegenprobe: eine erfundene Route faellt auf', () => {
    expect(gibtEs('/stornierung-beantragen')).toBe(false);
  });

  it('die E-Mail geht an den Support und ist vorbereitet', () => {
    expect(supportMailUrl()).toMatch(new RegExp(`^mailto:${MAIL.support.replace('.', '\\.')}\\?subject=`));
    expect(decodeURIComponent(supportMailUrl())).toMatch(/Auftragsnummer/);
  });
});

describe('Themen-Knoepfe und Rueckfall', () => {
  it.each(['customer', 'provider'] as const)('jeder Themen-Knopf (%s) bekommt eine echte Antwort', (rolle) => {
    for (const s of schnellthemen(rolle)) expect([s.label, antwort(s.frage, rolle)]).not.toEqual([s.label, null]);
  });

  it('Unverstandenes: erst Stichworte, beim zweiten Mal der Weg zum Menschen', () => {
    expect(antwort('xyzzy', 'customer')).toBeNull();
    expect(rueckfall(1).aktionen).toHaveLength(0);
    expect(rueckfall(2).aktionen.some((a) => a.art === 'mail')).toBe(true);
  });
});
