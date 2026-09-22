import { empfaengerSatz, empfaengerHinweis, pruefungTitel, pruefungSatz, anbieterArt, pruefungKurz, pruefungSozial, schutzSatz } from '../lib/empfaengerText';

describe('empfaengerSatz / empfaengerHinweis', () => {
  it('verspricht auf dem Nachbarschaftsweg KEINEN Gewerbeschein', () => {
    // Der eigentliche Befund vom 21.09.2026. Ein Helfer legt dort keinen
    // vor (app/onboarding-kyc.tsx), also darf der Satz ihn nicht nennen.
    expect(empfaengerSatz('nachbarschaft', null)).not.toMatch(/Gewerbeschein/i);
    expect(empfaengerHinweis('nachbarschaft', null)).not.toMatch(/Gewerbeschein/i);
  });

  it('nennt ihn auf dem Handwerksweg weiterhin', () => {
    // Gegenprobe: „nirgends Gewerbeschein" waere der einfachste gruene Haken
    // und wuerde die Zusage loeschen, die Werkant tatsaechlich einloest.
    expect(empfaengerSatz('handwerker', null)).toMatch(/geprüftem Gewerbeschein/);
    expect(empfaengerHinweis('handwerker', null)).toMatch(/geprüftem Gewerbeschein/);
  });

  it('sagt auf dem Nachbarschaftsweg, WAS stattdessen geprueft wurde', () => {
    // Ein Satz, der nur weglaesst, sagt dem Kunden nichts. Belegbar ist die
    // Freigabe durch einen Menschen im Pruef-Postfach.
    expect(empfaengerSatz('nachbarschaft', null)).toMatch(/freigegeben/i);
    expect(empfaengerHinweis('nachbarschaft', null)).toMatch(/freigegeben/i);
  });

  it('gibt fuer beide Wege verschiedene Saetze', () => {
    expect(empfaengerSatz('nachbarschaft', null)).not.toBe(empfaengerSatz('handwerker', null));
    expect(empfaengerHinweis('nachbarschaft', null)).not.toBe(empfaengerHinweis('handwerker', null));
  });
});

describe('empfaengerSatz / empfaengerHinweis mit Wunschanbieter (1020)', () => {
  // ANLASS: Der Knopf „Unverbindliche Anfrage stellen" auf einem
  // Anbieterprofil uebergab eine Kennung, die der Trichter nie gelesen hat.
  // Jetzt wird sie gespeichert -- und dann muss der Satz BEIDES sagen.
  it('nennt den gewaehlten Betrieb beim Namen', () => {
    expect(empfaengerSatz('handwerker', 'Elektro Yildiz')).toMatch(/Elektro Yildiz/);
    expect(empfaengerHinweis('handwerker', 'Elektro Yildiz')).toMatch(/Elektro Yildiz/);
  });

  it('sagt zusaetzlich, dass die Anfrage unverbindlich bleibt', () => {
    // Ohne diesen Halbsatz wartet der Kunde moeglicherweise auf eine Antwort,
    // die nie kommt. Ein Wunsch bindet niemanden.
    expect(empfaengerSatz('handwerker', 'Elektro Yildiz')).toMatch(/unverbindlich/i);
  });

  it('laesst die Zusage des Weges stehen', () => {
    // Gegenprobe: „nur noch der Wunschbetrieb" waere der einfachste gruene
    // Haken und wuerde die Aussage ueber die Pruefung verschlucken.
    expect(empfaengerSatz('handwerker', 'Elektro Yildiz')).toMatch(/geprüftem Gewerbeschein/);
    expect(empfaengerSatz('nachbarschaft', 'Mara Grün')).toMatch(/freigegeben/i);
  });

  it('schweigt ohne Wunschanbieter -- auch bei leerem Namen', () => {
    // Ein Betrieb ohne Namen darf keinen halben Satz erzeugen
    // („Ihre Anfrage geht zuerst an .").
    expect(empfaengerSatz('handwerker', null)).not.toMatch(/zuerst an/);
    expect(empfaengerSatz('handwerker', '   ')).not.toMatch(/zuerst an/);
    expect(empfaengerSatz('handwerker', '   ')).toBe(empfaengerSatz('handwerker', null));
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

describe('anbieterArt (Sorte in der Trefferliste)', () => {
  it('nennt den Weg beim Namen', () => {
    expect(anbieterArt(true)).toMatch(/Nachbarschaftshilfe/);
    expect(anbieterArt(false)).toMatch(/Handwerksbetrieb/);
  });

  it('behauptet bei Nachbarschaftshilfe keine Dokumentenpruefung', () => {
    // Dort legt niemand einen Gewerbeschein oder eine Steuernummer vor.
    expect(anbieterArt(true)).not.toMatch(/Gewerbeschein|Steuer/i);
    expect(anbieterArt(true)).toMatch(/freigegeben/);
  });

  it('bleibt beim Betrieb bei der staerkeren, belegbaren Aussage', () => {
    // Gegenprobe: „ueberall nur freigegeben" waere der einfachste gruene
    // Haken und wuerde die Pruefung verschweigen, die es wirklich gibt.
    expect(anbieterArt(false)).toMatch(/geprüft/);
    expect(anbieterArt(false)).not.toMatch(/freigegeben/);
  });

  it('gibt fuer beide Wege verschiedene Texte', () => {
    expect(anbieterArt(true)).not.toBe(anbieterArt(false));
  });

  it('setzt keinen Gedankenstrich', () => {
    for (const t of [anbieterArt(true), anbieterArt(false)]) {
      expect(t).not.toMatch(/[—–]/);
    }
  });
});

describe('pruefungKurz (Vertrauens-Strip der Startseite)', () => {
  it('verspricht mit Nachbarschaftsweg keinen Gewerbeschein', () => {
    expect(pruefungKurz(true)).not.toMatch(/Gewerbeschein/i);
    expect(pruefungKurz(true)).toMatch(/freigegeben/);
  });

  it('nennt ihn ohne Nachbarschaftsweg weiterhin', () => {
    // Gegenprobe: die schwaechere Aussage ueberall waere der einfachste
    // gruene Haken und wuerde die Pruefung verschweigen, die es gibt.
    expect(pruefungKurz(false)).toMatch(/Gewerbeschein/);
  });

  it('bleibt kurz genug fuer drei Spalten', () => {
    // Drei Spalten neben einem 15-px-Symbol. Gemessen wird die Absicht,
    // nicht die Pixel: ein Satz gehoert dort nicht hin.
    for (const t of [pruefungKurz(true), pruefungKurz(false)]) {
      expect(t.length).toBeLessThanOrEqual(30);
    }
  });
});

describe('pruefungSozial (Vertrauenszeile der Startseite)', () => {
  it('behauptet mit Nachbarschaftsweg nichts ueber „jeden Anbieter"', () => {
    const { fett, rest } = pruefungSozial(true);
    expect(fett).not.toMatch(/Jeder Anbieter/);
    expect(`${fett}${rest}`).toMatch(/Nachbarschaftshilfe ohne Gewerbe/);
  });

  it('nennt den Gewerbeschein weiterhin, aber den Betrieben zugeordnet', () => {
    expect(pruefungSozial(true).rest).toMatch(/Betriebe mit geprüftem Gewerbeschein/);
  });

  it('bleibt ohne Nachbarschaftsweg bei der staerkeren Aussage', () => {
    // Gegenprobe: die schwaechere Fassung ueberall waere der einfachste
    // gruene Haken.
    expect(pruefungSozial(false).fett).toMatch(/Jeder Anbieter/);
    expect(pruefungSozial(false).rest).toMatch(/Meisterbrief/);
  });

  it('gibt fuer beide Faelle verschiedene Texte', () => {
    expect(pruefungSozial(true).fett).not.toBe(pruefungSozial(false).fett);
    expect(pruefungSozial(true).rest).not.toBe(pruefungSozial(false).rest);
  });
});

describe('schutzSatz (Eingang der Garantieseite)', () => {
  it('ordnet den Gewerbenachweis den Betrieben zu, statt ihn allen zu versprechen', () => {
    expect(schutzSatz(true)).toMatch(/Bei Handwerksbetrieben kommt der geprüfte Gewerbenachweis/);
  });

  it('laesst Treuhandkonto und Vertrag fuer jeden Auftrag stehen', () => {
    // Die gelten wirklich fuer beide Wege. Eine Zusage zuruecknehmen, die
    // eingeloest wird, waere genauso falsch wie eine, die es nicht wird.
    expect(schutzSatz(true)).toMatch(/jeden Auftrag über ein Treuhandkonto/);
    expect(schutzSatz(true)).toMatch(/schriftlichen Vertrag/);
  });

  it('bleibt ohne Nachbarschaftsweg bei der kompakten Fassung', () => {
    expect(schutzSatz(false)).toMatch(/geprüfte Gewerbenachweise/);
    expect(schutzSatz(false)).not.toMatch(/Bei Handwerksbetrieben/);
  });

  it('sagt nicht mehr „an den Betrieb", weil auch Helfer ausgezahlt werden', () => {
    for (const t of [schutzSatz(true), schutzSatz(false)]) {
      expect(t).not.toMatch(/an den Betrieb ausgezahlt/);
    }
  });
});
