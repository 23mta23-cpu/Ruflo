// Misst, ob auf erreichbaren Screens etwas ueber den rechten Bildschirmrand
// hinauslaeuft.
//
// ANLASS (16.08.2026, Founder-Screenshot): Im Auftrags-Assistenten lief das
// Stadt-Feld rund 100px ueber den Rand hinaus und sah aus wie ein Kaesten ohne
// Ende. Ursache war `min-width: auto` -- ein Flex-Element weigert sich von Haus
// aus, unter seine Inhaltsbreite zu schrumpfen. Beide Eingabefelder meldeten
// 233px Eigenbreite: 233 + 10 Abstand + 233 = 476px in einer 356px breiten
// Zeile.
//
// Warum SYMPTOM statt MUSTER: eine Suche nach `flex: 1` ohne `minWidth: 0`
// liefert in diesem Projekt 101 Treffer, fast alle harmlos -- kurze Labels
// passen ohnehin. Ein Pruefer mit 101 Fehlalarmen wird beim ersten Mal
// abgeschaltet. Gemessen wird deshalb, was der Nutzer tatsaechlich sieht.
//
// GRENZE, ehrlich: das hier ist react-native-web. Ein Layoutfehler, der NUR
// auf Yoga auftritt (etwa langer Text in einer Kachel mit numberOfLines), ist
// von hier aus nicht sichtbar -- siehe CLAUDE.md. Dieser Pruefer faengt die
// Klasse, die beide Seiten teilen, nicht die native Restmenge.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

// Schmalste verbreitete Geraetebreiten. 360 ist der enge Fall, an dem
// Layoutfehler zuerst sichtbar werden.
const BREITEN = [390, 375, 360];

// Grosse Systemschrift, nachgestellt. 1 heisst: nichts veraendern.
// Details stehen bei `vergroessereSchrift` weiter unten.
const FAKTOR = Number(process.env.SCHRIFT_FAKTOR || '1');

// Stellen, die bei grosser Schrift NUR auf dem Geraet richtig sind. Der
// Pruefstand kann sie nicht sehen: react-native-web meldet `fontScale` immer
// als 1, eine Weiche darauf greift hier also nie. Jede Ausnahme nennt ihren
// Beleg im Quelltext. Zwei Verfallspruefungen halten die Liste ehrlich:
//   - der Beleg fehlt im Quelltext  -> die Weiche ist weg, FAIL
//   - die Stelle laeuft gar nicht mehr ueber -> die Ausnahme ist ueberfluessig
//     und prueft nichts mehr, FAIL
const AUSNAHMEN_GROSSE_SCHRIFT = [
  {
    route: '/landing',
    text: 'Handwerk & Nachbarschaftshilfe',
    grund: 'weiche Trennstellen ab fontScale 1,1 (lib/grosseSchrift.ts, per Jest geprueft)',
    beleg: ['app/landing.tsx', "trennbar('Handwerk & Nachbar\\u00ADschafts\\u00ADhilfe,', fontScale)"],
  },
];
const ausnahmeGenutzt = new Set();

// Zweites Feld: 'anbieter' heisst "mit angemeldeter Anbieter-Sitzung oeffnen".
//
// ANLASS (Founder am Geraet, 07.09.2026): die Reiter-Leiste in
// /betrieb/auftraege lief ueber den Rand ("Abgeschlossen" abgeschnitten),
// waehrend dieser Pruefer "nichts laeuft ueber den Rand" meldete. Er mass
// fuenf Bildschirme, KEINEN im Anbieterbereich — dort haengt alles an
// Anmeldung UND Rolle. Genau deshalb findet der Founder dort Dinge und die
// Pruefer nicht.
const SCREENS = [
  ['/landing', null],
  ['/onboarding', null],
  ['/auftrag-aufgeben?category=elektro', null],
  ['/registrierung?role=anbieter', null],
  ['/onboarding-kyc?track=handwerker', null],
  ['/onboarding-kyc?track=nachbarschaft', null],
  ['/login', null],
  ['/suche', null],
  ['/einstellungen', null],
  ['/betrieb/dashboard', 'anbieter'],
  ['/betrieb/auftraege', 'anbieter'],
  ['/betrieb/kalender', 'anbieter'],
  ['/betrieb/profil', 'anbieter'],
  ['/betrieb/profil-bearbeiten', 'anbieter'],
  ['/betrieb/nachrichten', 'anbieter'],
  ['/betrieb/statistik', 'anbieter'],
  ['/betrieb/pro', 'anbieter'],
  // Das Kunden-Profil eines Anbieters. Fehlte bis 14.09.2026 — und damit die
  // Handlungsreihe (A2), deren vier gleich breite Kacheln bei 360 px genau
  // die Klasse "Beschriftung passt nicht in ihre Kachel" treffen.
  ['/anbieter?id=00000000-0000-4000-8000-000000000001', 'anbieter'],

  // Drittes Feld: eine Beschriftung, die nach dem Laden angetippt wird.
  //
  // ANLASS (16.09.2026): /betrieb/auftraege oeffnet auf dem Reiter
  // „Anfragen". Die Auftragskarten -- Kundenname, Abzeichen und Bewertung in
  // EINER Zeile mit `space-between` -- liegen hinter den anderen Reitern und
  // wurden deshalb nie vermessen. Genau dort weigert sich ein Flex-Kind ohne
  // `minWidth: 0`, unter seine Inhaltsbreite zu schrumpfen, und schiebt das
  // Abzeichen ueber den Rand.
  ['/betrieb/auftraege', 'anbieter', 'Aktiv'],
  ['/betrieb/auftraege', 'anbieter', 'Ausstehend'],
  ['/betrieb/auftraege', 'anbieter', 'Erledigt'],
];

// Schriftgroesse und Zeilenhoehe jedes Textes mit `f` malnehmen, so wie
// React Native es auf dem Geraet mit der Systemschrift tut (fontScale gilt
// fuer fontSize UND lineHeight, auch fuer Ionicons, die intern ein <Text>
// sind). Erst ALLE Werte lesen, dann schreiben: ein verschachtelter Text ohne
// eigene Groesse erbt sonst die schon vergroesserte und wird zweimal
// vergroessert.
function vergroessereSchrift(f) {
  const ziele = [];
  document.querySelectorAll('*').forEach((el) => {
    const hatText = [...el.childNodes].some((k) => k.nodeType === 3 && k.textContent.trim());
    if (!hatText && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    const cs = getComputedStyle(el);
    ziele.push([el, parseFloat(cs.fontSize), parseFloat(cs.lineHeight)]);
  });
  for (const [el, gr, zh] of ziele) {
    el.style.fontSize = `${gr * f}px`;
    if (!Number.isNaN(zh)) el.style.lineHeight = `${zh * f}px`;
  }
}

let fehler = 0;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  for (const breite of BREITEN) {
    for (const [route, modus, reiter] of SCREENS) {
      const ctx = await b.newContext({ viewport: { width: breite, height: 844 } });
      if (modus === 'anbieter') {
        await alsAnbieter(ctx);
      } else {
        await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
          accepted: true, analytics: false, pstg: true, version: '1.0',
          timestamp: new Date().toISOString(),
        })));
        await ctx.route('**://*.supabase.co/**', (r) => r.abort());
        await ctx.route('**://*.stripe.com/**', (r) => r.abort());
      }
      const p = await ctx.newPage();
      await p.goto(BASIS + route, { waitUntil: 'networkidle' });
      // Anbieter-Bildschirme brauchen laenger: AuthContext holt erst die
      // Sitzung, dann die Rolle, dann rendert das Layout.
      await p.waitForTimeout(modus === 'anbieter' ? 3000 : 1800);

      if (reiter) {
        // `:visible` ist Pflicht: expo-router laesst inaktive Bildschirme im
        // DOM stehen. Und den Handler traegt der AEUSSERE Knopf, nicht der
        // Text darin -- deshalb ueber die Rolle greifen.
        const knopf = p.locator('[role="button"]:visible').filter({ hasText: reiter }).first();
        if ((await knopf.count()) === 0) {
          console.log(`FAIL  ${route} [${reiter}] -- den Reiter gibt es nicht`);
          fehler++;
          await ctx.close();
          continue;
        }
        await knopf.click();
        await p.waitForTimeout(700);
      }

      if (FAKTOR !== 1) await p.evaluate(vergroessereSchrift, FAKTOR);

      const raus = await p.evaluate(() => {
        const w = window.innerWidth;
        const treffer = [];

        // Waagerecht scrollbare Leisten ragen ABSICHTLICH ueber den Rand --
        // eine Kategorienleiste zum Wischen ist kein Layoutfehler. Ohne diese
        // Ausnahme meldete der Pruefer die Kategorien auf /suche als Fehler
        // und waere damit sofort unbrauchbar gewesen.
        const inWaagerechterLeiste = (el) => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
          }
          return false;
        };

        document.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          // 1px Toleranz gegen Rundung. Nur sichtbare Elemente mit Breite.
          if (r.width > 0 && r.height > 0 && r.right > w + 1) {
            if (inWaagerechterLeiste(el)) return;
            const eigen = (el.textContent || '').trim().slice(0, 30);
            treffer.push({ text: eigen, ueber: Math.round(r.right - w) });
          }
        });
        // Nur den aeussersten Uebeltaeter je Textinhalt melden, sonst listet
        // jeder Elternknoten denselben Fehler noch einmal.
        const gesehen = new Set();
        return treffer.filter((t) => {
          if (gesehen.has(t.text)) return false;
          gesehen.add(t.text); return true;
        }).slice(0, 4);
      });

      const gemeldet = raus.filter((t) => {
        if (FAKTOR === 1) return true;
        const a = AUSNAHMEN_GROSSE_SCHRIFT.find((x) => x.route === route && t.text.startsWith(x.text));
        if (!a) return true;
        ausnahmeGenutzt.add(a);
        return false;
      });
      if (gemeldet.length) {
        fehler++;
        console.log(`FAIL  ${String(breite).padEnd(4)} ${route}`);
        for (const t of gemeldet) console.log(`        +${t.ueber}px  "${t.text}"`);
      }
      await ctx.close();
    }
  }

  if (FAKTOR !== 1) {
    const fs = require('fs');
    for (const a of AUSNAHMEN_GROSSE_SCHRIFT) {
      if (!fs.readFileSync(a.beleg[0], 'utf8').includes(a.beleg[1])) {
        fehler++;
        console.log(`FAIL  Ausnahme ${a.route} "${a.text}": Beleg fehlt in ${a.beleg[0]} (${a.grund})`);
      } else if (!ausnahmeGenutzt.has(a)) {
        fehler++;
        console.log(`FAIL  Ausnahme ${a.route} "${a.text}" wird nicht mehr gebraucht -- entfernen`);
      }
    }
  }

  const gesamt = BREITEN.length * SCREENS.length;
  console.log(fehler === 0
    ? `\n=== ${gesamt} Messungen, nichts laeuft ueber den Rand ===`
    : `\n=== ${fehler} von ${gesamt} Messungen mit Ueberstand ===`);
  await b.close();
  process.exit(fehler ? 1 : 0);
})();
