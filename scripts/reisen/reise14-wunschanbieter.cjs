// Kern-Reise 14 — der Wunschanbieter aus dem Profil-Einstieg.
//
// ANLASS (22.09.2026). `app/anbieter.tsx` hat unter jedem Anbieterprofil den
// Knopf „Unverbindliche Anfrage stellen" und uebergab seit jeher
// `params: { providerId: id }`. `app/auftrag-aufgeben.tsx` hat diesen
// Parameter NIRGENDS gelesen. Wer sich ein Profil ansah, den Knopf drueckte
// und einen Auftrag aufgab, schrieb in Wahrheit eine Ausschreibung an alle.
//
// WARUM EINE BROWSER-REISE UND NICHT NUR EIN QUELLTEXT-PRUEFER:
// `scripts/nav-parameter-check.py` sieht, dass der Name im Ziel VORKOMMT --
// nicht, ob am Ende ein Name auf dem Bildschirm steht oder `undefined`, und
// erst recht nicht, ob die Kennung in der angelegten Zeile landet. Herkunft
// ist eine Quelltext-Frage, Wirkung eine Browser-Frage.
//
// GEPRUEFT WIRD:
//   W  Mit Wunschanbieter: der Betrieb steht beim Namen da, und es steht
//      dabei, dass die Anfrage unverbindlich bleibt.
//   O  GEGENPROBE ohne Wunschanbieter: kein Hinweis, kein Name.
//   U  Unbekannter Betrieb: der Bildschirm sagt es und erfindet keinen Namen.
//   S  Die Kennung landet in der angelegten Auftragszeile.
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  // Detail nur im Fehlerfall: ein Pruefer, der neben PASS das Gegenteil
  // schreibt, wird nicht mehr geglaubt (Lehre vom 22.09.).
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  — ' + detail : ''}`);
  return ok;
}

const WUNSCH_ID = '00000000-0000-4000-8000-0000000000aa';
const WUNSCH_NAME = 'Elektrotechnik Yildiz GmbH';

const BETRIEB = {
  id: WUNSCH_ID, business_name: WUNSCH_NAME, trade_id: 'elektro',
  kyc_status: 'approved', available: true, is_nachbarschaft: false,
  rating_avg: 4.7, rating_count: 12, meister_verified: true, is_pro: true,
  has_steuer_id: true, category_ids: ['elektro'], min_hourly_rate: 45,
  radius_km: 25, bio: 'Prüfstand.', created_at: new Date().toISOString(),
};

async function trichter(b, { wunsch, betriebDa = true }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, {
    rolle: 'customer',
    daten: {
      provider_public: betriebDa ? [BETRIEB] : [],
      jobs: { id: '00000000-0000-4000-8000-0000000000bb' },
      // `requireVerifiedEmail` fragt diese Funktion, BEVOR der Auftrag
      // angelegt wird. Ohne die Antwort bricht das Absenden still ab -- und
      // die Reise haette einen Produktfehler gemeldet, den es nicht gibt.
      auth_email_confirmed: true,
    },
  });
  const p = await ctx.newPage();
  const ziel = wunsch
    ? `${BASIS}/auftrag-aufgeben?providerId=${wunsch}`
    : `${BASIS}/auftrag-aufgeben`;
  await p.goto(ziel, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return { ctx, p };
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── W: mit Wunschanbieter ───────────────────────────────────────────────
  {
    const { ctx, p } = await trichter(b, { wunsch: WUNSCH_ID });
    // Zuerst zusichern, WELCHEN Bildschirm wir messen. Eine Gegenprobe auf
    // einer Weiterleitung besteht muehelos (Lehre vom 22.09.).
    pruefe('W0 Gemessen wird der Auftrags-Trichter',
      new URL(p.url()).pathname.endsWith('/auftrag-aufgeben'), p.url());

    const text = await p.locator('body').innerText();
    pruefe('W1 Der gewaehlte Betrieb steht beim Namen da',
      text.includes(WUNSCH_NAME),
      text.split('\n').slice(0, 6).join(' | '));
    pruefe('W2 Es steht dabei, dass andere Betriebe trotzdem bieten koennen',
      /andere Betriebe/i.test(text) || /Andere Betriebe/.test(text));
    // Ein Quelltext-Pruefer sieht `standZeile(a, b)` und ist zufrieden, auch
    // wenn `undefined` gerendert wird. Dieselbe Klasse hier.
    pruefe('W3 Kein „undefined" im sichtbaren Text',
      !/undefined/i.test(text));
    await ctx.close();
  }

  // ── O GEGENPROBE: ohne Wunschanbieter ───────────────────────────────────
  //
  // Ohne diese Probe waere ein Hinweis, der IMMER dasteht, gruen -- und der
  // Kunde laese auf jedem gewoehnlichen Auftrag, seine Anfrage gehe „zuerst
  // an" irgendwen.
  {
    const { ctx, p } = await trichter(b, { wunsch: null });
    const text = await p.locator('body').innerText();
    pruefe('O1 Ohne Wunsch steht kein „zuerst an" da', !/zuerst an/i.test(text));
    pruefe('O2 Und auch kein Betriebsname', !text.includes(WUNSCH_NAME));
    await ctx.close();
  }

  // ── U: der gewaehlte Betrieb ist nicht mehr da ──────────────────────────
  //
  // DREI Zustaende, nicht zwei. Ein Ersatzname waere hier besonders
  // schaedlich, weil er in einer Zusage stuende.
  {
    const { ctx, p } = await trichter(b, { wunsch: WUNSCH_ID, betriebDa: false });
    const text = await p.locator('body').innerText();
    pruefe('U1 Der Bildschirm sagt, dass der Betrieb nicht verfuegbar ist',
      /nicht mehr verfügbar/i.test(text),
      text.split('\n').slice(0, 8).join(' | '));
    pruefe('U2 Und erfindet keinen Namen', !text.includes(WUNSCH_NAME));
    // Schritt 1 ist das Kategorie-Raster und hat KEINE Eingabefelder -- die
    // erste Fassung hat das geprueft und einen richtigen Bildschirm als
    // Fehler gemeldet. Gemessen wird, dass der Trichter weiter bedienbar ist.
    pruefe('U3 Er bleibt bedienbar: das Kategorie-Raster steht da',
      /Wählen Sie eine Kategorie/.test(text)
      && (await p.getByText(/^Weiter$/).first().isVisible().catch(() => false)));
    await ctx.close();
  }

  // ── S: die Kennung landet in der angelegten Zeile ───────────────────────
  //
  // Das ist die eigentliche Zusicherung. W1 bis W3 pruefen, was DASTEHT --
  // ob der Wunsch auch GESPEICHERT wird, sieht man nur am Schreibaufruf.
  //
  // Der Trichter beginnt beim Kategorie-Raster und hat dort KEIN Eingabefeld.
  // Deshalb eine Schleife, die in jeder Runde tut, was der aktuelle Schritt
  // verlangt -- und nicht eine feste Reihenfolge, die beim ersten
  // uebersprungenen Schritt ins Leere greift.
  async function durchlaufen(ctx, p) {
    for (let runde = 0; runde < 8; runde++) {
      const abschicken = p.locator('[role="button"]:visible')
        .filter({ hasText: /^\s*Auftrag abschicken\s*$/ }).first();
      if (await abschicken.isVisible().catch(() => false)) break;

      // Die Kategorie-Kachel traegt `accessibilityRole="button"`, aber
      // `filter({ hasText: /^Elektro$/ })` findet sie NICHT -- gemessen: 22
      // Knoepfe sichtbar, exakter Regex 0 Treffer, `getByText` exakt 1. Der
      // Klick auf den Textknoten wirkt, weil das Ereignis zum Knopf
      // hochblubbert (dasselbe Muster nutzt Reise 1 seit jeher).
      const kachel = p.getByText('Elektro', { exact: true }).first();
      if (await kachel.isVisible().catch(() => false)) {
        await kachel.click().catch(() => {});
        await p.waitForTimeout(900);
      }

      const feld = (platzhalter) => p.locator('input:visible, textarea:visible')
        .and(p.locator(`[placeholder*="${platzhalter}" i]`)).first();
      for (const [platzhalter, wert] of [
        ['Steckdosen installieren', 'Steckdose im Flur setzen'],
        ['Beschreiben Sie', 'Im Flur fehlt eine Steckdose, bitte eine setzen.'],
        ['Straße und Hausnummer', 'Elsaßstraße 7'],
        ['PLZ', '50677'],
        ['Stadt', 'Köln'],
      ]) {
        const f = feld(platzhalter);
        if (await f.isVisible().catch(() => false)) await f.fill(wert).catch(() => {});
      }

      const zeitfenster = p.getByText('Ich bin flexibel').first();
      if (await zeitfenster.isVisible().catch(() => false)) {
        await zeitfenster.click().catch(() => {});
        await p.waitForTimeout(600);
      }

      const weiter = p.getByText(/^Weiter$/).first();
      if (!(await weiter.isVisible().catch(() => false))) break;
      if (await weiter.isDisabled().catch(() => false)) break;
      await weiter.click().catch(() => {});
      await p.waitForTimeout(1200);
    }

    const abschicken = p.locator('[role="button"]:visible')
      .filter({ hasText: /^\s*Auftrag abschicken\s*$/ }).first();
    const amZiel = await abschicken.isVisible().catch(() => false);
    if (amZiel) {
      // Einwilligung zur Weitergabe -- ohne sie bleibt der Knopf gesperrt.
      // Das ist richtig so und wird in Reise 1 eigens zugesichert.
      if (await abschicken.isDisabled().catch(() => false)) {
        const haken = p.locator('[role="button"]:visible')
          .filter({ hasText: /einverstanden|Weitergabe|stimme/i }).first();
        if (await haken.isVisible().catch(() => false)) {
          await haken.click().catch(() => {});
          await p.waitForTimeout(600);
        }
      }
      await abschicken.click().catch(() => {});
      await p.waitForTimeout(2500);
    }
    const anlegen = (ctx.__aufrufe || [])
      .filter((a) => a.name === 'jobs' && a.verb === 'POST');
    return { amZiel, anlegen };
  }

  {
    const { ctx, p } = await trichter(b, { wunsch: WUNSCH_ID });
    const { amZiel, anlegen } = await durchlaufen(ctx, p);
    pruefe('S1 Der Trichter erreicht den Absende-Schritt', amZiel,
      (await p.locator('body').innerText()).split('\n').slice(0, 6).join(' | '));
    pruefe('S2 Genau ein Auftrag wurde angelegt',
      anlegen.length === 1, `${anlegen.length} POST auf jobs`);
    const zeile = anlegen[0] && anlegen[0].koerper;
    pruefe('S3 Die angelegte Zeile nennt den Wunschanbieter',
      !!zeile && zeile.requested_provider_id === WUNSCH_ID,
      zeile ? JSON.stringify(zeile) : 'kein Koerper');
    await ctx.close();
  }

  // ── S GEGENPROBE: ohne Wunsch bleibt die Spalte leer ────────────────────
  //
  // Ohne sie waere „schreibt immer irgendeine Kennung hinein" bestanden.
  {
    const { ctx, p } = await trichter(b, { wunsch: null });
    const { anlegen } = await durchlaufen(ctx, p);
    pruefe('S4 Ohne Wunsch wird auch ein Auftrag angelegt',
      anlegen.length === 1, `${anlegen.length} POST auf jobs`);
    const zeile = anlegen[0] && anlegen[0].koerper;
    pruefe('S5 Und die Spalte bleibt leer',
      !!zeile && (zeile.requested_provider_id === null
        || zeile.requested_provider_id === undefined),
      zeile ? JSON.stringify(zeile.requested_provider_id) : 'kein Koerper');
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0 ? '\nReise 14: alles gruen.' : `\nReise 14: ${fehler} FAIL.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
