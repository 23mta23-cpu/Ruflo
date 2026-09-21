import { empfaengerSatz, empfaengerHinweis, pruefungTitel, pruefungSatz } from '../lib/empfaengerText';

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

describe('pruefungTitel / pruefungSatz (Vorteils-Kachel der Startseite)', () => {
  it('behauptet mit Nachbarschaftsweg nicht, JEDER Anbieter habe einen Gewerbeschein', () => {
    // Die Kachel stand als Literal da: „Anbieter weisen ihren Gewerbeschein
    // nach." Mit aktivem Nachbarschaftsweg ist das eine Aussage ueber alle.
    expect(pruefungTitel(true)).not.toMatch(/Gewerbeschein/i);
    expect(pruefungSatz(true)).toMatch(/Betriebe weisen ihren Gewerbeschein nach/);
    expect(pruefungSatz(true)).toMatch(/kein Gewerbe/);
  });

  it('nennt ohne Nachbarschaftsweg weiterhin Gewerbeschein und Meisterbrief', () => {
    // Gegenprobe: „nie einen Gewerbeschein nennen" waere der einfachste
    // gruene Haken und wuerde die Zusage loeschen, die Werkant einloest.
    expect(pruefungTitel(false)).toMatch(/Gewerbeschein und Meisterbrief/);
    expect(pruefungSatz(false)).toMatch(/Meisterbrief/);
    expect(pruefungSatz(false)).not.toMatch(/kein Gewerbe/);
  });

  it('behauptet auf keinem Weg eine Alterspruefung', () => {
    // Der Nachbarschaftsweg nimmt eine ERKLAERUNG entgegen (0990), er prueft
    // nicht. Bis zum 20.09.2026 las der Kunde „18+ verifiziert".
    for (const t of [pruefungSatz(true), pruefungSatz(false)]) {
      expect(t).not.toMatch(/18\+|Alter.{0,15}(geprüft|verifiziert)/i);
    }
  });

  it('sagt auf beiden Wegen, dass keine Ausweiskopien erhoben werden', () => {
    expect(pruefungSatz(true)).toMatch(/Ausweiskopien/);
    expect(pruefungSatz(false)).toMatch(/Ausweiskopien/);
  });

  it('gibt fuer beide Faelle verschiedene Texte', () => {
    expect(pruefungTitel(true)).not.toBe(pruefungTitel(false));
    expect(pruefungSatz(true)).not.toBe(pruefungSatz(false));
  });
});
