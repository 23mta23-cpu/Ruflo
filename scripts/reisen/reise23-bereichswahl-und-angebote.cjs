// Kern-Reise 23 — drei Founder-Befunde vom 28.09.2026 am Geraet.
//
// A  „Wenn ich einen Auftrag abgeben moechte, bitte einmal auf Handwerk
//    klicken koennen und einmal Nachbarschaftshilfe, so ist das zu viel bis
//    zum Scrollen." Schritt 1 zeigte BEIDE Raster untereinander; wer zur
//    Nachbarschaftshilfe wollte, scrollte an acht Handwerks-Kacheln vorbei
//    und sah nicht, dass darunter noch etwas kommt.
//
// B  „Bei Auftraege, wenn ich Anfragen anklicke, ist es schmal, bei aktiv
//    ausstehend und erledigt wird es dicker." Der aktive Reiter trug
//    fontWeight '700', der inaktive '500'. Fetter Text ist BREITER, also
//    wuchs der gewaehlte Reiter und die waagerecht scrollbare Zeile floss
//    neu um.
//
// C  „Zusaetzlich sehe ich nirgends, wo meine aktiven Angebote sind."
//    Es gab sie -- ausschliesslich auf /betrieb/dashboard. Wer unter
//    „Auftraege" suchte, fand nichts. Dieselbe Klasse wie „eine Mitteilung
//    ohne Empfaenger-Bildschirm" (16.09.): die Daten sind da, der Weg nicht.
//
// WARUM BROWSER UND NICHT QUELLTEXT: bei A und C sieht ein Quelltext-Pruefer
// den Zweig und ist zufrieden, ohne zu wissen, ob er RENDERT. Bei B ist die
// Breite ueberhaupt nur im Browser messbar -- ein Grep sieht zwei
// fontWeight-Angaben und kann nicht sagen, ob die Zeile deshalb umfliesst.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  — ' + detail : ''}`);
  return ok;
}

const ANGEBOT_ID = '00000000-0000-4000-8000-0000000000d1';
const AUFTRAG_ID = '00000000-0000-4000-8000-0000000000d2';
const TITEL = 'Verteilerkasten im Keller erneuern';
const PREIS = 437;

// Eine Handwerks-Kachel, die es NUR im Handwerks-Raster gibt, und eine, die
// es nur in der Nachbarschaftshilfe gibt. Ohne diese Trennung liesse sich
// „zeigt den richtigen Bereich" nicht von „zeigt alles" unterscheiden.
const NUR_HANDWERK = 'Dachdecker';
const NUR_NACHBARSCHAFT = 'Umzugshilfe';

function consentSetzen(ctx) {
  return ctx.addInitScript(() => {
    try {
      localStorage.setItem('werkr_consent_v1', JSON.stringify({
        accepted: true, analytics: false, pstg: true,
        version: '1.0', timestamp: new Date().toISOString(),
      }));
    } catch { /* privates Fenster */ }
  });
}

async function trichter(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await consentSetzen(ctx);
  await ctx.route('**chnphpmpdpllnpqtvwhx.supabase.co**', (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/auftrag-aufgeben`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  return { ctx, p };
}

async function auftraege(b, { fehlerBei = [], angebote = [{
  id: ANGEBOT_ID, job_id: AUFTRAG_ID, price: PREIS,
  created_at: new Date().toISOString(),
  job: { id: AUFTRAG_ID, title: TITEL },
}] } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, { fehlerBei, daten: { offers: () => angebote } });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return { ctx, p };
}

/** Breiten aller Reiter, in der Reihenfolge, in der sie stehen. */
async function reiterBreiten(p) {
  return p.evaluate(() => {
    const beschriftungen = ['Anfragen', 'Angebote', 'Aktiv', 'Ausstehend', 'Erledigt'];
    const knoepfe = [...document.querySelectorAll('[role="button"]')]
      .filter((el) => beschriftungen.some((b) => (el.innerText || '').trim().startsWith(b)));
    return knoepfe.map((el) => ({
      text: (el.innerText || '').trim().split('\n')[0],
      breite: Math.round(el.getBoundingClientRect().width),
    }));
  });
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── A: Schritt 1 fragt zuerst nach dem Bereich ──────────────────────────
  {
    const { ctx, p } = await trichter(b);
    pruefe('A0 Gemessen wird der Trichter',
      new URL(p.url()).pathname.includes('auftrag-aufgeben'), p.url());

    const text = await p.locator('body').innerText();
    pruefe('A1 Der Bildschirm fragt nach dem Bereich',
      /Wählen Sie zuerst den Bereich/.test(text),
      text.split('\n').slice(0, 6).join(' | '));
    pruefe('A2 Beide Bereiche stehen zur Wahl',
      /Handwerk/.test(text) && /Nachbarschaftshilfe/.test(text));

    // Der eigentliche Befund: das lange Raster darf hier NOCH NICHT stehen.
    pruefe('A3 Das Kategorie-Raster steht noch nicht da',
      !text.includes(NUR_HANDWERK) && !text.includes(NUR_NACHBARSCHAFT),
      `Handwerks-Kachel: ${text.includes(NUR_HANDWERK)}, NB-Kachel: ${text.includes(NUR_NACHBARSCHAFT)}`);

    // Und beide Karten muessen OHNE Scrollen erreichbar sein -- sonst waere
    // der Befund nur eine Ebene tiefer geschoben.
    const unterkante = await p.evaluate(() => {
      const treffer = [...document.querySelectorAll('[role="button"]')]
        .filter((el) => /Nachbarschaftshilfe/.test(el.innerText || ''));
      if (!treffer.length) return null;
      return Math.round(treffer[0].getBoundingClientRect().bottom);
    });
    pruefe('A4 Die zweite Karte liegt im ersten Bildschirm (kein Scrollen)',
      unterkante !== null && unterkante <= 844,
      `Unterkante bei ${unterkante} px, Fenster 844 px`);

    // Handwerk oeffnen
    await p.getByText('Handwerk', { exact: true }).first().click().catch(() => {});
    await p.waitForTimeout(900);
    const nachHandwerk = await p.locator('body').innerText();
    pruefe('A5 Nach „Handwerk" steht das Handwerks-Raster da',
      nachHandwerk.includes(NUR_HANDWERK), nachHandwerk.slice(0, 120));
    pruefe('A6 Und die Nachbarschafts-Kacheln sind NICHT dabei',
      !nachHandwerk.includes(NUR_NACHBARSCHAFT));

    // Zurueck und den anderen Bereich oeffnen
    await p.getByText(/Bereich wechseln/).first().click().catch(() => {});
    await p.waitForTimeout(700);
    await p.getByText('Nachbarschaftshilfe', { exact: true }).first().click().catch(() => {});
    await p.waitForTimeout(900);
    const nachNb = await p.locator('body').innerText();
    pruefe('A7 Nach „Nachbarschaftshilfe" steht deren Raster da',
      nachNb.includes(NUR_NACHBARSCHAFT), nachNb.slice(0, 120));
    pruefe('A8 Und die Handwerks-Kacheln sind NICHT dabei',
      !nachNb.includes(NUR_HANDWERK));
    await ctx.close();
  }

  // ── B: die Reiter-Zeile springt beim Wechseln nicht ─────────────────────
  {
    const { ctx, p } = await auftraege(b);
    pruefe('B0 Gemessen wird die Auftragsliste des Betriebs',
      new URL(p.url()).pathname.endsWith('/betrieb/auftraege'), p.url());

    const vorher = await reiterBreiten(p);
    pruefe('B1 Die Reiter sind messbar', vorher.length >= 4,
      JSON.stringify(vorher));

    await p.getByText(/^Ausstehend/).first().click().catch(() => {});
    await p.waitForTimeout(700);
    const nachher = await reiterBreiten(p);

    const gleich = vorher.length === nachher.length
      && vorher.every((v, i) => v.text === nachher[i].text && v.breite === nachher[i].breite);
    pruefe('B2 Keine Breite aendert sich beim Reiterwechsel', gleich,
      `vorher ${JSON.stringify(vorher)} / nachher ${JSON.stringify(nachher)}`);
    await ctx.close();
  }

  // ── C: die eigenen Angebote sind unter „Auftraege" zu finden ────────────
  {
    const { ctx, p } = await auftraege(b);
    const reiter = await p.locator('body').innerText();
    pruefe('C1 Es gibt einen Reiter „Angebote"', /Angebote/.test(reiter));

    await p.getByText(/^Angebote/).first().click().catch(() => {});
    await p.waitForTimeout(900);
    const t = await p.locator('body').innerText();
    pruefe('C2 Das eigene Angebot steht da', t.includes(TITEL), t.slice(0, 160));
    pruefe('C3 Mit seinem Preis', /437/.test(t));
    pruefe('C4 Und es laesst sich zurueckziehen',
      await p.locator('[role="button"]:visible')
        .filter({ hasText: 'Zurückziehen' }).first().isVisible().catch(() => false));
    await ctx.close();
  }

  // ── D: Gegenprobe — ein Netzfehler darf nicht „keine Angebote" heissen ──
  {
    const { ctx, p } = await auftraege(b, { fehlerBei: ['offers'] });
    await p.getByText(/^Angebote/).first().click().catch(() => {});
    await p.waitForTimeout(900);
    const t = await p.locator('body').innerText();
    pruefe('D1 Der Fehler wird benannt',
      /Angebote konnten nicht geladen werden/.test(t), t.slice(0, 160));
    pruefe('D2 Und NICHT als „Sie haben keine Angebote" getarnt',
      !/Hier stehen Ihre abgegebenen Angebote/.test(t));
    await ctx.close();
  }

  // ── E: Gegenprobe — ohne Angebote steht der Leer-Text, nicht der Fehler ─
  {
    const { ctx, p } = await auftraege(b, { angebote: [] });
    await p.getByText(/^Angebote/).first().click().catch(() => {});
    await p.waitForTimeout(900);
    const t = await p.locator('body').innerText();
    pruefe('E1 Ohne Angebote steht der Leer-Text da',
      /Hier stehen Ihre abgegebenen Angebote/.test(t), t.slice(0, 160));
    pruefe('E2 Und kein Fehlertext',
      !/Angebote konnten nicht geladen werden/.test(t));
    await ctx.close();
  }

  // ── F: Nachbarschaft — der Helfer sieht, was er wirklich bekommt ────────
  //
  // BEFUND aus derselben Founder-Nachricht („beim Angebot erstellen ist alles
  // richtig oder?"): der Bildschirm zog dem Helfer 1,99 ab und zeigte bei
  // 600 EUR eine Auszahlung von 598,01. Migration 0830 zahlt aber 600,00
  // (v_provider_commission := 0). Die Anzeige log um 1,99 zu seinen Lasten
  // und widersprach dem Satz beim Anmelden: „Keine Provision."
  //
  // GEMESSEN wird der Bildschirm, nicht die Rechenregel -- die ist durch
  // Jest gedeckt und war es auch VORHER, mit dem falschen Erwartungswert.
  {
    const JOB_ID = '00000000-0000-4000-8000-0000000000d9';
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      daten: {
        jobs: () => ({
          id: JOB_ID, customer_id: '00000000-0000-4000-8000-0000000000da',
          provider_id: null, title: 'Wohnung ausräumen',
          description: 'Vier Kartons müssen getragen werden, zweiter Stock.',
          category: 'Umzugshilfe', category_id: 'umzugshilfe',
          address_plz: '50667', address_city: 'Köln',
          track: 'nachbarschaft', status: 'open',
          created_at: new Date(Date.now() - 3600_000).toISOString(),
        }),
      },
    });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/angebot-erstellen?jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);

    pruefe('F0 Gemessen wird der Angebots-Bildschirm',
      new URL(p.url()).pathname.endsWith('/betrieb/angebot-erstellen'), p.url());

    const preisFeld = p.locator('input:visible').first();
    await preisFeld.fill('600').catch(() => {});
    await p.waitForTimeout(900);
    const t = await p.locator('body').innerText();

    pruefe('F1 Keine Provision wird ausgewiesen',
      /Keine Provision/i.test(t) || /Werkant-Gebühr[\s\S]{0,40}keine/i.test(t),
      t.slice(0, 200));
    pruefe('F2 Der alte Abzug steht NICHT mehr da',
      !/598,01/.test(t) && !/1,99 Flat/.test(t),
      t.slice(0, 200));
    // NICHT „600,00 kommt irgendwo vor": das steht auch als Leistungspreis
    // da. Genau daran ist die erste Fassung gescheitert -- unter der
    // Mutation „wieder 1,99 abziehen" blieb sie GRUEN. Ein Beleg muss
    // eindeutig der sein, um den es geht. Gelesen wird die Zeile, die den
    // Nettobetrag benennt.
    const zeilen = t.split('\n').map((z) => z.trim()).filter(Boolean);
    const i = zeilen.findIndex((z) => /^Nettobetrag/i.test(z));
    const nettoZeile = i >= 0 ? zeilen.slice(i, i + 3).join(' ') : '';
    pruefe('F3 Die Nettobetrag-Zeile nennt den vollen Preis',
      /600,00/.test(nettoZeile) && !/598,01/.test(nettoZeile),
      `Zeile: ${nettoZeile || 'kein Nettobetrag gefunden'}`);
  }

  await b.close();
  console.log(fehler === 0 ? '\nReise 23: alles bestanden.' : `\nReise 23: ${fehler} FAIL.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
