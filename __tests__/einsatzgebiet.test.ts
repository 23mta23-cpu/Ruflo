/**
 * Der Text muss dieselbe Regel beschreiben, die auswahl.ts anwendet. Ein
 * erklaerender Satz, der etwas anderes sagt als der Code, ist schlimmer als
 * gar keiner: der Betrieb richtet sich danach.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PLZ_BEREICH_STELLEN, plzGueltig, bereichVon, einsatzgebiet, einsatzgebietText,
} from '../lib/einsatzgebiet';

describe('plzGueltig', () => {
  it('nimmt fuenf Ziffern', () => {
    expect(plzGueltig('50667')).toBe(true);
    expect(plzGueltig(' 50667 ')).toBe(true);
  });
  it('und sonst nichts', () => {
    for (const x of ['5066', '506677', '50a67', '', null, undefined, 'Köln']) {
      expect(plzGueltig(x as string)).toBe(false);
    }
  });
});

describe('bereichVon', () => {
  it('nimmt genau so viele Stellen wie die Regel', () => {
    expect(bereichVon('50667')).toBe('50');
    expect(bereichVon('50667')).toHaveLength(PLZ_BEREICH_STELLEN);
    expect(bereichVon('01067')).toBe('01');   // fuehrende Null bleibt
  });
  it('gibt bei unbrauchbarer Postleitzahl nichts zurueck', () => {
    expect(bereichVon('abc')).toBe('');
    expect(bereichVon(null)).toBe('');
  });
});

describe('einsatzgebietText', () => {
  it('sagt bei fehlender Postleitzahl die Wahrheit', () => {
    const t = einsatzgebietText(null);
    expect(t).toMatch(/keine Anfragen/);
    // Kein Trost, der nicht stimmt.
    expect(t).not.toMatch(/passende Anfragen erhalten|wir melden uns/i);
  });

  it('nennt den Bereich und das Muster', () => {
    const t = einsatzgebietText('50667');
    expect(t).toContain('50');
    expect(t).toContain('50xxx');
    // Nicht den Wortlaut pinnen, sondern die AUSSAGE: dass es eine Grenze
    // gibt und dass ausserhalb nichts ankommt. Die erste Fassung verlangte
    // „erreichen Sie nicht" woertlich und wurde von einem eingeschobenen
    // „leider" rot -- ein Test mit Fehlalarmen wird abgeschaltet.
    expect(t).toMatch(/außerhalb/);
    expect(t).toMatch(/\bnicht\b/);
  });

  it('siezt und setzt keinen Gedankenstrich', () => {
    for (const p of [null, '50667', '01067']) {
      const t = einsatzgebietText(p);
      expect(t).not.toMatch(/\b(du|dein|dir)\b/i);
      expect(t).not.toMatch(/—| – /);
    }
  });
});

describe('Bindung an die Regel im Server', () => {
  // Quelltextfrage: ob die Zahl hier dieselbe ist wie dort, sieht man nur am
  // Quelltext beider Seiten (Lehre vom 16.08.2026).
  const auswahl = readFileSync(
    join(__dirname, '..', 'supabase', 'functions', 'notify-matching-providers', 'auswahl.ts'),
    'utf8');

  it('auswahl.ts schneidet genau PLZ_BEREICH_STELLEN Ziffern ab', () => {
    const m = auswahl.match(/slice\(0,\s*(\d+)\)/);
    expect(m).not.toBeNull();
    expect(Number((m as RegExpMatchArray)[1])).toBe(PLZ_BEREICH_STELLEN);
  });

  it('und vergleicht mit startsWith, nicht mit Gleichheit', () => {
    // Waere es ein Gleichheitsvergleich, traefe der Text („beginnt mit 50")
    // nicht mehr zu.
    expect(auswahl).toMatch(/startsWith\(plzPrefix\)/);
  });

  it('eine fehlende PLZ am Auftrag schliesst wirklich alle aus', () => {
    expect(auswahl).toMatch(/plzPrefix\.length === 2/);
  });
});

describe('Der Betrieb kann seine Postleitzahl auch wirklich setzen', () => {
  // Bis zum 16.09.2026 stand sie auf KEINEM Anbieter-Bildschirm, obwohl sie
  // allein entscheidet, welche Auftraege gemeldet werden. Das ist eine
  // Quelltextfrage: ob ein Feld existiert und gespeichert wird, sieht man
  // nicht am Rueckgabewert einer reinen Funktion.
  const editor = readFileSync(
    join(__dirname, '..', 'app', 'betrieb', 'profil-bearbeiten.tsx'), 'utf8');

  it('das Formular hat ein Postleitzahl-Feld', () => {
    // Auf die VERDRAHTUNG pruefen, nicht auf die Beschriftung: der Text
    // „Postleitzahl Ihres Betriebs" steht auch im accessibilityLabel, und die
    // erste Fassung dieser Zusicherung kam deshalb an einer ausgetauschten
    // Beschriftung vorbei.
    expect(editor).toMatch(/value=\{plz\}/);
    expect(editor).toMatch(/onChangeText=\{\(v\) => setPlz\(/);
    expect(editor).toMatch(/const \[plz, setPlz\] = useState/);
  });

  it('und erklaert die Regel an Ort und Stelle', () => {
    expect(editor).toMatch(/einsatzgebietText\(plz\)/);
  });

  it('gespeichert wird auf profiles, nicht auf provider_profiles', () => {
    // provider_profiles hat die Spalte gar nicht; ein Schreibversuch dorthin
    // liefe ins Leere und das Feld waere wieder eine Attrappe.
    expect(editor).toMatch(/from\('profiles'\)[\s\S]{0,80}update\(\{\s*plz/);
  });

  it('eine halbe Postleitzahl wird abgewiesen', () => {
    expect(editor).toMatch(/plzGueltig\(plz\)/);
  });
});
