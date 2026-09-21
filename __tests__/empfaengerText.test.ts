import { empfaengerSatz, empfaengerHinweis } from '../lib/empfaengerText';

describe('empfaengerSatz / empfaengerHinweis', () => {
  it('verspricht auf dem Nachbarschaftsweg KEINEN Gewerbeschein', () => {
    // Der eigentliche Befund vom 21.09.2026. Ein Helfer legt dort keinen
    // vor (app/onboarding-kyc.tsx), also darf der Satz ihn nicht nennen.
    expect(empfaengerSatz('nachbarschaft')).not.toMatch(/Gewerbeschein/i);
    expect(empfaengerHinweis('nachbarschaft')).not.toMatch(/Gewerbeschein/i);
  });

  it('nennt ihn auf dem Handwerksweg weiterhin', () => {
    // Gegenprobe: „nirgends Gewerbeschein" waere der einfachste gruene Haken
    // und wuerde die Zusage loeschen, die Werkant tatsaechlich einloest.
    expect(empfaengerSatz('handwerker')).toMatch(/geprüftem Gewerbeschein/);
    expect(empfaengerHinweis('handwerker')).toMatch(/geprüftem Gewerbeschein/);
  });

  it('sagt auf dem Nachbarschaftsweg, WAS stattdessen geprueft wurde', () => {
    // Ein Satz, der nur weglaesst, sagt dem Kunden nichts. Belegbar ist die
    // Freigabe durch einen Menschen im Pruef-Postfach.
    expect(empfaengerSatz('nachbarschaft')).toMatch(/freigegeben/i);
    expect(empfaengerHinweis('nachbarschaft')).toMatch(/freigegeben/i);
  });

  it('gibt fuer beide Wege verschiedene Saetze', () => {
    expect(empfaengerSatz('nachbarschaft')).not.toBe(empfaengerSatz('handwerker'));
    expect(empfaengerHinweis('nachbarschaft')).not.toBe(empfaengerHinweis('handwerker'));
  });
});
