// Sieht ein bewusst anderer Weg aus wie ein Mangel?
//
// ANLASS (21.09.2026, beim Nachziehen des Founder-Befunds zum Gewerbeschein):
// In app/anbieter.tsx stand die Verifizierungs-Leiste fest verdrahtet. Eine
// Helferin aus der Nachbarschaft bekam damit ein durchgestrichenes
// „Gewerbeschein" und „Steuer-ID" zu sehen -- obwohl app/onboarding-kyc.tsx
// auf diesem Weg beides NIE abfragt. Darunter stand „Dokumente wurden von
// Werkant einmalig geprüft", ohne dass es dort Dokumente gaebe.
//
// Das ist die Umkehrung des Trichter-Befunds: dort wurde zu viel
// versprochen, hier zu wenig zugestanden. Beides ist eine Aussage ueber den
// Anbieter, die der eigene Code nicht deckt.
//
// GEGENPROBE H ist Pflicht: ohne sie waere „alle Abzeichen ausblenden" der
// einfachste gruene Haken.
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

function profil(nachbarschaft) {
  return [{
    id: NUTZER_ID,
    business_name: nachbarschaft ? 'Maria aus der Nachbarschaft' : 'Elektro Wassermann GmbH',
    trade_id: nachbarschaft ? null : 'elektro',
    is_nachbarschaft: nachbarschaft,
    kyc_status: 'approved', available: true, is_pro: false,
    rating_avg: 4.8, rating_count: 12,
    meister_verified: false,
    has_steuer_id: !nachbarschaft,
    has_gewerbeschein: !nachbarschaft,
    has_meisterbrief: false,
    category_ids: nachbarschaft ? ['umzug'] : ['elektro'],
    min_hourly_rate: nachbarschaft ? 15 : 45,
    radius_km: 10, bio: 'Prüfstand.', created_at: new Date().toISOString(),
  }];
}

async function oeffne(b, nachbarschaft) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, { daten: { provider_public: profil(nachbarschaft), reviews: [], contracts: [] } });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/anbieter?id=${NUTZER_ID}`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForTimeout(3500);
  const text = await p.locator('body').innerText();
  return { ctx, text };
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  // -- N: Nachbarschaftshilfe --------------------------------------------
  {
    const { ctx, text } = await oeffne(b, true);
    // „Steuer-ID" kommt nur als Abzeichen vor. „Gewerbeschein" taucht im
    // erklaerenden Satz auf und taugt deshalb NICHT als Merkmal.
    pruefe('N1 Kein Steuer-ID-Abzeichen bei Nachbarschaftshilfe',
      !text.includes('Steuer-ID'),
      text.includes('Steuer-ID') ? 'Abzeichen steht da' : '');
    pruefe('N2 Stattdessen steht da, dass Werkant das Profil freigegeben hat',
      text.includes('Von Werkant freigegeben'));
    pruefe('N3 Und dass hier kein Gewerbeschein verlangt wird',
      /kein Gewerbe\b/.test(text) && /weder verlangt noch geprüft/.test(text));
    pruefe('N4 Kein Satz ueber geprüfte Dokumente, die es hier nicht gibt',
      !text.includes('Dokumente wurden von Werkant einmalig geprüft'));
    await ctx.close();
  }

  // -- H GEGENPROBE: Handwerksbetrieb -------------------------------------
  //
  // Ohne diesen Teil waere „alle Abzeichen weglassen" gruen.
  {
    const { ctx, text } = await oeffne(b, false);
    pruefe('H1 GEGENPROBE: der Betrieb zeigt weiterhin Gewerbeschein und Steuer-ID',
      text.includes('Gewerbeschein') && text.includes('Steuer-ID'));
    pruefe('H2 GEGENPROBE: und NICHT den Nachbarschafts-Hinweis',
      !text.includes('Von Werkant freigegeben') && !/kein Gewerbe\b/.test(text));
    pruefe('H3 GEGENPROBE: der Satz ueber die geprüften Dokumente steht dort',
      text.includes('Dokumente wurden von Werkant einmalig geprüft'));
    await ctx.close();
  }

  // -- S: die Trefferliste der Suche ---------------------------------------
  //
  // ANLASS (22.09.2026): `app/suche.tsx` listet BEIDE Wege gemischt, waehlte
  // `is_nachbarschaft` aber gar nicht aus. Eine Helferin und ein
  // Meisterbetrieb waren in der Karte nicht zu unterscheiden -- bei
  // verschiedenem Pruefumfang und verschiedener Gebuehr.
  async function suche(zeilen) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { daten: { provider_public: zeilen, reviews: [], contracts: [] } });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/suche`, { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(3500);
    const text = await p.locator('body').innerText();
    return { ctx, text };
  }

  function trefferZeile(nachbarschaft, name) {
    return {
      id: nachbarschaft ? '00000000-0000-4000-8000-0000000000n1'.replace('n', 'c')
                        : '00000000-0000-4000-8000-0000000000c2',
      business_name: name, display_name: name,
      bio: 'Prüfstand.', min_hourly_rate: nachbarschaft ? 15 : 45,
      category_ids: nachbarschaft ? ['umzug'] : ['elektro'],
      available: true, rating_avg: 4.7, rating_count: 9,
      stripe_onboarded: true, kyc_status: 'approved',
      is_nachbarschaft: nachbarschaft,
    };
  }

  {
    const { ctx, text } = await suche([
      trefferZeile(false, 'Elektro Wassermann GmbH'),
      trefferZeile(true, 'Maria aus der Nachbarschaft'),
    ]);
    const sichtbar = text.includes('Elektro Wassermann') || text.includes('Maria aus der Nachbarschaft');
    pruefe('S1 Die Trefferliste zeigt ueberhaupt Anbieter',
      sichtbar, sichtbar ? '' : 'keiner der beiden Vorgabe-Anbieter steht da');
    pruefe('S2 Der Betrieb ist als solcher benannt',
      /Handwerksbetrieb · von Werkant geprüft/.test(text));
    pruefe('S3 Die Nachbarschaftshilfe auch',
      /Nachbarschaftshilfe · von Werkant freigegeben/.test(text));
    await ctx.close();
  }

  // GEGENPROBE: steht die Nachbarschafts-Zeile IMMER da, unterscheidet sie
  // nichts. Ohne diesen Teil waere ein festes Literal gruen.
  {
    const { ctx, text } = await suche([
      trefferZeile(false, 'Elektro Wassermann GmbH'),
      trefferZeile(false, 'Sanitaer Bruns GmbH'),
    ]);
    pruefe('S4 GEGENPROBE: ohne Nachbarschaftshilfe steht deren Zeile nicht da',
      !/Nachbarschaftshilfe · von Werkant freigegeben/.test(text)
        && /Handwerksbetrieb · von Werkant geprüft/.test(text));
    await ctx.close();
  }

  // -- M: die Startseite -----------------------------------------------------
  //
  // ANLASS (22.09.2026): Zwei goldene Haken neben Anbieternamen, beide an
  // `meister_verified` -- also „Meisterbrief geprüft". Das stand nirgends,
  // und fuer eine Bedienungshilfe waren sie gar nicht vorhanden. Dazu der
  // Vertrauens-Strip mit „Gewerbeschein geprüft" als Literal, neben einem
  // Umschalter, der ausdruecklich auf Nachbarschaftshilfe wechselt.
  async function startseite(meister) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    // GEMESSEN: mit der Anbieter-Rolle leitet `/` auf /betrieb/dashboard um.
    // Der erste Lauf mass deshalb den falschen Bildschirm -- und die
    // Gegenprobe M3 war dort muehelos gruen, weil dort gar kein Abzeichen
    // vorkommt. Eine Gegenprobe, die auf dem falschen Bildschirm besteht,
    // beweist nichts.
    await alsAnbieter(ctx, { rolle: 'customer', daten: { provider_public: [{
      id: NUTZER_ID, business_name: 'Elektro Wassermann GmbH', trade_id: 'elektro',
      rating_avg: 4.9, rating_count: 21, meister_verified: meister,
      is_nachbarschaft: false, created_at: new Date().toISOString(),
      stripe_onboarded: true, available: true, kyc_status: 'approved',
    }], reviews: [], contracts: [] } });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/`, { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(3500);
    const text = await p.locator('body').innerText();
    return { ctx, text, weg: new URL(p.url()).pathname };
  }

  {
    const { ctx, text, weg } = await startseite(true);
    pruefe('M0 Wir messen wirklich die Kunden-Startseite',
      weg === '/' || weg === '/index', `gelandet auf ${weg}`);
    pruefe('M1 Der Meisterbrief-Haken traegt jetzt sein Wort',
      /\bMeister\b/.test(text));
    pruefe('M2 Der Vertrauens-Strip verspricht keinen Gewerbeschein fuer alle',
      !/Gewerbeschein geprüft/.test(text) && /einzeln freigegeben/.test(text),
      (text.match(/Gewerbeschein geprüft/) || [''])[0]);
    await ctx.close();
  }

  // GEGENPROBE: ohne Meisterbrief darf das Wort nicht dastehen. Ohne diesen
  // Teil waere ein fest eingebautes Abzeichen gruen.
  {
    const { ctx, text } = await startseite(false);
    pruefe('M3 GEGENPROBE: ohne Meisterbrief steht das Abzeichen nicht da',
      !/\bMeister\b/.test(text),
      (text.match(/.{0,20}Meister.{0,20}/) || [''])[0]);
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0
    ? '\nDie Verifizierungs-Leiste nennt je Weg das, was Werkant wirklich prueft.'
    : `\n${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler ? 1 : 0);
})();
