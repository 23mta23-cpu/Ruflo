// Eine angemeldete ANBIETER-Sitzung fuer Playwright-Pruefungen — ohne Netz,
// ohne Konto in der Produktion.
//
// ANLASS (Founder am Geraet, 07.09.2026): In der Auftrags-Uebersicht des
// Anbieters lief die Reiter-Leiste ueber den Rand, "Abgeschlossen" war
// abgeschnitten. Der Rand-Pruefer meldete gleichzeitig "27 Messungen, nichts
// laeuft ueber den Rand" — weil er genau fuenf Bildschirme misst und KEINEN im
// Anbieterbereich.
//
// Das ist die eigentliche Ursache dafuer, dass der Founder dort immer wieder
// Dinge findet: `app/betrieb/*` haengt an Anmeldung UND Anbieter-Rolle, und die
// Browser-Reisen enden vorher (Reise 2 beim Gewerbeschein). Steht so in
// CLAUDE.md — die Konsequenz war nur nie gezogen.
//
// Warum ein STUB und nicht ein echtes Konto:
//   - AGENTS.md verbietet Testkonten in der Produktion, aus gutem Grund.
//   - Ein Abbruch aller Supabase-Aufrufe reicht NICHT: getSession() liest zwar
//     aus dem localStorage, die ROLLE holt AuthContext aber ueber das Netz und
//     faellt nach 4 s auf null zurueck — dann leitet betrieb/_layout weg.
//   Also werden die wenigen Abfragen beantwortet, die ueber das Rendern
//   entscheiden. Alles Uebrige kommt als leere Liste.
//
// GRENZE, ausdruecklich: das ist ein GEOMETRIE-Pruefstand, kein Datentest. Die
// Bildschirme rendern mit LEEREN Listen. Ein Layoutfehler, der erst bei vielen
// oder langen Datensaetzen auftritt, faellt hier NICHT auf. Was er faengt, ist
// die Klasse "Beschriftung passt nicht in ihre Kachel" — und genau die war es.

const PROJEKT_REF = 'chnphpmpdpllnpqtvwhx';
const NUTZER_ID = '00000000-0000-4000-8000-000000000001';

/** Sitzung im Format, das supabase-js v2 im localStorage erwartet. */
function sitzungsObjekt() {
  const inEinerStunde = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: 'pruefstand-kein-echtes-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: inEinerStunde,
    refresh_token: 'pruefstand-kein-echtes-token',
    user: {
      id: NUTZER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'pruefstand@example.invalid',
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: { full_name: 'Prüfstand Betrieb' },
    },
  };
}

/**
 * Bereitet einen Playwright-Kontext als angemeldeter Anbieter vor.
 * @param ctx  BrowserContext
 * @param opts.rolle  'provider' (Vorgabe) oder 'customer'
 */
async function alsAnbieter(ctx, opts = {}) {
  const rolle = opts.rolle || 'provider';

  await ctx.addInitScript(
    ([ref, sitzung, consent]) => {
      localStorage.setItem('werkr_consent_v1', consent);
      localStorage.setItem(`sb-${ref}-auth-token`, sitzung);
    },
    [
      PROJEKT_REF,
      JSON.stringify(sitzungsObjekt()),
      JSON.stringify({
        accepted: true, analytics: false, pstg: true,
        version: '1.0', timestamp: new Date().toISOString(),
      }),
    ],
  );

  await ctx.route('**://*.stripe.com/**', (r) => r.abort());
  await ctx.route('**://exp.host/**', (r) => r.abort());

  await ctx.route('**://*.supabase.co/**', (route) => {
    const url = route.request().url();
    const json = (koerper, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(koerper),
    });

    // Anmeldung: die Sitzung kommt aus dem localStorage, aber supabase-js
    // fragt beim Start einmal nach dem Nutzer.
    if (url.includes('/auth/v1/user')) return json(sitzungsObjekt().user);
    if (url.includes('/auth/v1/')) return json(sitzungsObjekt());

    // Die eine Abfrage, die ueber das Rendern entscheidet.
    if (url.includes('/rest/v1/profiles')) {
      return json([{ id: NUTZER_ID, role: rolle, account_type: 'private',
                     full_name: 'Prüfstand Betrieb', email_verified_at: new Date().toISOString() }]);
    }
    if (url.includes('/rest/v1/provider_profiles')) {
      return json([{ id: NUTZER_ID, business_name: 'Prüfstand Betrieb GmbH',
                     trade_id: 'elektro', is_nachbarschaft: false, kyc_status: 'approved',
                     available: true, rating_avg: null, rating_count: 0,
                     meister_verified: false, stripe_onboarded: true }]);
    }

    // Alles Uebrige: leere Liste. Die Bildschirme muessen mit nichts
    // zurechtkommen — das ist ohnehin der Zustand eines neuen Betriebs.
    return json([]);
  });
}

module.exports = { alsAnbieter, NUTZER_ID, PROJEKT_REF };
