// Tippt JEDEN Knopf an und meldet jeden Fehler, den die Seite dabei wirft.
//
// ANLASS (16.09.2026): `Share.share` warf im Browser
// `Error: Share is not supported in this browser`. Auf `/widerruf` lag kein
// try/catch darum: der Nutzer fuellte das Formular aus, tippte „Widerruf
// erklaeren", und es passierte NICHTS. Gefunden hat das kein Pruefer, sondern
// der Founder am Geraet -- und auch der erst, nachdem er nach etwas anderem
// gefragt hatte.
//
// WAS DIESER PRUEFER KANN: er tippt jeden Knopf an und faengt jeden
// `pageerror`. Ein Handler, der wirft, ist IMMER ein Fehler -- diese Klasse
// hat keine Fehlalarme.
//
// WAS ER NICHT KANN, und das ist wichtig: er sagt NICHT, ob ein Knopf etwas
// Sinnvolles tut. Ein generischer „wirkt der Knopf?"-Pruefer laesst sich
// nicht bauen: die Beruehrungsanimation von TouchableOpacity aendert selbst
// schon das DOM, ein DOM-Vergleich kann einen stummen Knopf also nicht von
// einem wirksamen unterscheiden. GEMESSEN am 16.09.: ein kuenstlich auf
// `onPress={() => {}}` gesetzter Knopf blieb im DOM-Vergleich unauffaellig.
// Fachliche Wirkung gehoert deshalb in die Reisen (z. B. Reise 9 misst
// Schreibaufrufe an `provider_availability`), nicht in einen Pauschaltest.
//
// WARUM DIE MINDESTZAHL UNTEN STEHT: mein erster Erkundungslauf verwarf still
// zwei Drittel aller Knoepfe (mehrzeilige Beschriftungen wie „Mo\n14" trafen
// den Text-Regex nicht) und meldete trotzdem „0 ohne Wirkung". Ein Pruefer,
// der nicht sagt, wie viel er geprueft hat, kann gruen sein, ohne etwas
// gesehen zu haben. Deshalb: Knoepfe ueber den INDEX greifen, nie ueber den
// Text, und die Gesamtzahl zusichern.
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const SCREENS = [
  ['/landing', null], ['/onboarding', null], ['/auftrag-aufgeben?category=elektro', null],
  ['/login', null], ['/registrierung?role=anbieter', null], ['/suche', null],
  ['/einstellungen', null], ['/widerruf', null], ['/agb', null],
  ['/datenschutz', null], ['/impressum', null], ['/vertrauen', null],
  ['/support-chat', null], ['/melden', null],
  ['/betrieb/dashboard', 'anbieter'], ['/betrieb/auftraege', 'anbieter'],
  ['/betrieb/kalender', 'anbieter'], ['/betrieb/profil', 'anbieter'],
  ['/betrieb/profil-bearbeiten', 'anbieter'], ['/betrieb/nachrichten', 'anbieter'],
  ['/betrieb/statistik', 'anbieter'], ['/betrieb/pro', 'anbieter'],
  ['/anbieter?id=00000000-0000-4000-8000-000000000001', 'anbieter'],
];

// Untergrenze, damit „0 Fehler" nicht aus einer leeren Auswahl stammen kann.
//
// GEMESSEN am 16.09.2026: 154 angetippt, 8 uebergangen. Die Zahl ist gemessen,
// NICHT geschaetzt -- mein erster Versuch stand auf 220 („etwa 300, grosszuegig
// nach unten"), und der Lauf brach ab, obwohl nichts kaputt war. Wer eine
// Untergrenze raet, baut sich einen Fehlalarm ein.
// 140 laesst Luft fuer einen entfernten Bildschirm; ein groesserer Einbruch
// ist ein Befund und gehoert angesehen.
const MINDESTENS = 140;

// „Abmelden" und „Konto löschen" wuerden die Sitzung bzw. die Vorgabedaten
// zerstoeren. Sie sind in Reise 1 und im Loeschweg eigens abgedeckt.
//
// Die OAuth-Knoepfe navigieren die Seite WEG (zum Anbieter). Im Pruefstand
// ist Supabase abgeblockt, der Browser landet auf `chrome-error://…` mit
// `origin: null`, und dort wirft jeder localStorage-Zugriff einen
// SecurityError. GEMESSEN am 16.09.2026 -- ein Artefakt des Pruefstands, kein
// Produktfehler: im echten Browser laeuft die App nach dem Sprung gar nicht
// mehr. Der Ruecksprung aus OAuth ist in app/login.tsx gesondert behandelt.
const UEBERGEHEN = /Abmelden|Konto löschen|Konto unwiderruflich|Mit (Apple|Google) anmelden/i;

let fehler = 0;
let geprueft = 0;
let uebergangen = 0;
const befunde = [];

async function kontext(b, modus) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  if (modus === 'anbieter') { await alsAnbieter(ctx); return ctx; }
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0',
    timestamp: new Date().toISOString(),
  })));
  await ctx.route('**://*.supabase.co/**', (r) => r.abort());
  await ctx.route('**://*.stripe.com/**', (r) => r.abort());
  return ctx;
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  for (const [route, modus] of SCREENS) {
    const ctx = await kontext(b, modus);
    const warten = modus === 'anbieter' ? 2500 : 1500;

    // Erst zaehlen, dann pro Knopf eine frische Seite: nach einem Klick kann
    // sich der Bildschirm aendern, und der naechste Index zeigte sonst auf
    // etwas anderes.
    const zaehler = await ctx.newPage();
    await zaehler.goto(BASIS + route, { waitUntil: 'networkidle' }).catch(() => {});
    await zaehler.waitForTimeout(warten);
    const anzahl = await zaehler.locator('[role="button"]:visible').count();
    const beschriftungen = await zaehler.locator('[role="button"]:visible').allInnerTexts().catch(() => []);
    await zaehler.close();

    for (let i = 0; i < anzahl; i++) {
      const name = (beschriftungen[i] || '').trim().replace(/\n/g, ' ') || `Knopf #${i + 1}`;
      if (UEBERGEHEN.test(name)) { uebergangen++; continue; }

      const s = await ctx.newPage();
      const seitenfehler = [];
      s.on('pageerror', (e) => seitenfehler.push(String(e)));
      await s.goto(BASIS + route, { waitUntil: 'networkidle' }).catch(() => {});
      await s.waitForTimeout(warten);

      const ziel = s.locator('[role="button"]:visible').nth(i);
      if (await ziel.count() === 0) { await s.close(); uebergangen++; continue; }
      try {
        await ziel.click({ timeout: 4000 });
      } catch {
        // Ein nicht klickbarer Knopf (verdeckt, deaktiviert) ist hier kein
        // Befund -- aber er wird gezaehlt, nicht still verschluckt.
        await s.close(); uebergangen++; continue;
      }
      await s.waitForTimeout(1000);
      geprueft++;
      if (seitenfehler.length > 0) {
        fehler++;
        befunde.push(`${route}  „${name}"  ${seitenfehler[0].slice(0, 120)}`);
      }
      await s.close();
    }
    await ctx.close();
  }
  await b.close();

  console.log(`${geprueft} Knoepfe angetippt, ${uebergangen} uebergangen.`);
  if (befunde.length) {
    console.log(`\n${befunde.length} Knopf/Knoepfe werfen beim Antippen:\n`);
    befunde.forEach((z) => console.log('  FAIL  ' + z));
  }
  if (geprueft < MINDESTENS) {
    console.log(`\nABBRUCH: nur ${geprueft} Knoepfe angetippt, erwartet >= ${MINDESTENS}.`);
    console.log('  Entweder fehlen Bildschirme, oder die Sitzung greift nicht.');
    process.exit(1);
  }
  console.log(fehler === 0
    ? '\n=== Kein Knopf wirft beim Antippen ==='
    : `\n=== ${fehler} Knopf/Knoepfe werfen beim Antippen ===`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
