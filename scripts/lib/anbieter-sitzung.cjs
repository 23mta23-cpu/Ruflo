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
// GRENZE, ausdruecklich: ohne `opts.daten` ist das ein GEOMETRIE-Pruefstand,
// kein Datentest. Die Bildschirme rendern mit LEEREN Listen. Ein Layoutfehler,
// der erst bei vielen oder langen Datensaetzen auftritt, faellt dann NICHT auf.
// Was er faengt, ist die Klasse "Beschriftung passt nicht in ihre Kachel" —
// und genau die war es.
//
// ERWEITERUNG 16.09.2026: `opts.daten` legt Antworten je Tabelle fest, und
// `ctx.__aufrufe` sammelt die schreibenden Aufrufe. Damit laesst sich die
// VERDRAHTUNG des Geldwegs pruefen, die scripts/reisen/README.md bisher
// ausdruecklich als ungeprueft auswies ("offene Auftraege sehen, Angebot
// abgeben, Annahme ... das ist der halbe Marktplatz").
//
// Was das NICHT ist: ein Test der Datenbankregeln. Ob `accept_offer` wirklich
// einen Vertrag anlegt und ob die RLS-Policies greifen, steht in
// scripts/db-test/. Hier wird nur geprueft, dass der Bildschirm den richtigen
// Aufruf mit den richtigen Werten absetzt — also genau die Klasse Fehler, die
// ein Knopf ohne onPress waere.

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
  const daten = opts.daten || {};
  // Schreibende Aufrufe mitschreiben. Ohne das koennte man zwar klicken, aber
  // nicht feststellen, ob etwas passiert ist — und ein Klick, der nichts
  // ausloest, ist genau der Fehler, den diese Reise sucht.
  ctx.__aufrufe = [];

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
    // `.single()` und `.maybeSingle()` schicken
    // `Accept: application/vnd.pgrst.object+json` und erwarten EIN OBJEKT.
    // Antwortet der Pruefstand mit einer Liste, wirft supabase-js, der
    // Bildschirm bleibt leer oder zeigt eine Fehlermeldung, und die Reise misst
    // einen Fehler, den es nicht gibt. Am 16.09. sind daran ZWEI Zusicherungen
    // gescheitert: der Auftrag lud nicht (jobs, .single()) und das
    // Angebotsformular meldete "Verifizierung fehlt" (provider_profiles,
    // .maybeSingle()). Deshalb steckt die Regel jetzt in `json` selbst und
    // nicht in einem einzelnen Zweig.
    const willEins = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (koerper, status = 200) => {
      let aus = koerper;
      if (willEins && status === 200) {
        aus = Array.isArray(koerper) ? (koerper[0] ?? null) : koerper;
        if (aus === null) {
          // PostgREST antwortet auf .single()/.maybeSingle() ohne Treffer mit 406.
          return route.fulfill({
            status: 406,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ code: 'PGRST116', message: 'Kein Treffer' }),
          });
        }
      }
      return route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(aus),
      });
    };

    // Anmeldung: die Sitzung kommt aus dem localStorage, aber supabase-js
    // fragt beim Start einmal nach dem Nutzer.
    if (url.includes('/auth/v1/user')) return json(sitzungsObjekt().user);
    if (url.includes('/auth/v1/')) return json(sitzungsObjekt());

    // Vorgegebene Daten ZUERST: eine Reise muss jede dieser Antworten
    // ueberschreiben koennen. Stuenden die festen Zweige davor, liesse sich
    // z. B. `provider_public` nicht auf den Anbieter DIESES Vertrags setzen,
    // und der Freigabe-Bildschirm zeigte "Anbieter" statt eines Namens --
    // ein Pruefstand, der die eigene Vorgabe verschluckt.
    const verbFrueh = route.request().method();
    const trefferFrueh = url.match(/\/rest\/v1\/(?:rpc\/)?([A-Za-z0-9_]+)/)
      || url.match(/\/functions\/v1\/([A-Za-z0-9_-]+)/);
    const nameFrueh = trefferFrueh ? trefferFrueh[1] : null;
    if (nameFrueh) {
      if (verbFrueh !== 'GET') {
        let koerper = null;
        try { koerper = JSON.parse(route.request().postData() || 'null'); }
        catch (e) { koerper = route.request().postData(); }
        ctx.__aufrufe.push({ name: nameFrueh, verb: verbFrueh, koerper, url });
      }
      if (Object.prototype.hasOwnProperty.call(daten, nameFrueh)) {
        const wert = daten[nameFrueh];
        return json(typeof wert === 'function' ? wert(verbFrueh, route.request()) : wert);
      }
    }

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

    // Die oeffentliche Anbieter-Ansicht (0560), aus der /anbieter liest.
    //
    // BEWUSST MIT BEWERTUNGEN und mit einem LANGEN Betriebsnamen: die
    // Handlungsreihe im Profil zeigt die vierte Kachel („Bewertungen") nur
    // bei rating_count > 0. Mit einem leeren Anbieter wuerden drei Kacheln
    // gemessen und der engste Fall — vier Kacheln bei 360 px — nie. Genau so
    // entsteht ein gruener Haken, der nichts prueft (Befund 07.09.2026).
    if (url.includes('/rest/v1/provider_public')) {
      return json([{
        id: NUTZER_ID,
        business_name: 'Elektrotechnik Wassermann & Söhne GmbH',
        trade_id: 'elektro', kyc_status: 'approved', available: true,
        rating_avg: 4.8, rating_count: 37, meister_verified: true, is_pro: true,
        has_steuer_id: true, category_ids: ['elektro'], min_hourly_rate: 45,
        radius_km: 25, bio: 'Prüfstand.', created_at: new Date().toISOString(),
      }]);
    }


    // Vertraege des Betriebs, BEWUSST mit einem langen Kundennamen.
    //
    // ANLASS (16.09.2026): ohne sie war die Auftragsliste des Betriebs leer,
    // und die Karten mit Kundenname, Abzeichen und Bewertung wurden nie
    // vermessen. Der Name steht in einer Zeile mit `justify-content:
    // space-between` neben einem Abzeichen -- genau die Stelle, an der ein
    // Flex-Kind ohne `minWidth: 0` sich weigert zu schrumpfen und das
    // Abzeichen ueber den Rand schiebt.
    //
    // Eine Reise, die eigene `contracts` uebergibt, ueberschreibt das weiter
    // oben; dieser Zweig greift nur, wo niemand etwas vorgibt.
    if (url.includes('/rest/v1/contracts')) {
      const kunde = { full_name: 'Dr. Maximiliane Sonnenschein-Wassermann' };
      const auftrag = { id: '22222222-0000-4000-8000-000000000001',
                        title: 'Sicherungskasten erneuern und Zaehlerschrank pruefen',
                        category: 'elektro', address_city: 'Köln', address_plz: '50667',
                        status: 'active' };
      const grund = {
        job_id: auftrag.id, customer_id: '33333333-0000-4000-8000-000000000001',
        provider_id: NUTZER_ID, price_gross: 320, customer_total: 329.99,
        provider_payout: 294.4, track: 'handwerker',
        created_at: new Date().toISOString(),
        job: auftrag, customer: kunde,
      };
      return json([
        { ...grund, id: '44444444-0000-4000-8000-000000000001', status: 'active' },
        { ...grund, id: '44444444-0000-4000-8000-000000000002', status: 'pending' },
        { ...grund, id: '44444444-0000-4000-8000-000000000003', status: 'completed',
          completed_at: new Date().toISOString() },
      ]);
    }

    // Bewertungen, und zwar BEWUSST zwei verschiedene.
    //
    // ANLASS (16.09.2026): `provider_public` oben meldet rating_count 37,
    // `/rest/v1/reviews` fiel aber auf die leere Liste durch. Der Bildschirm
    // zeigte deshalb "Noch keine Bewertungen" -- und keine einzige
    // Bewertungskarte wurde je vermessen. Genau die Klasse, vor der der
    // Kommentar bei provider_public warnt, eine Ebene tiefer.
    //
    // Die zweite Zeile ist die wichtige: reviewed_id == NUTZER_ID und
    // antwort == null heisst, das Antwortfeld aus 0930 rendert. Es ist eine
    // Zeile aus Eingabefeld und zwei Knoepfen -- der Fall, in dem bei 360 px
    // ein fehlendes `minWidth: 0` ueber den Rand laeuft.
    if (url.includes('/rest/v1/reviews')) {
      return json([
        {
          id: '11111111-0000-4000-8000-000000000001',
          rating: 5, comment: 'Sauber gearbeitet und puenktlich gewesen.',
          created_at: new Date().toISOString(),
          reviewed_id: NUTZER_ID,
          antwort: 'Danke, das geben wir gern ans Team weiter.',
          reviewer: { full_name: 'Frau Sonnenschein-Wassermann' },
          contract: { job: { title: 'Sicherungskasten erneuern' } },
        },
        {
          id: '11111111-0000-4000-8000-000000000002',
          rating: 2, comment: 'Termin wurde zweimal verschoben.',
          created_at: new Date().toISOString(),
          reviewed_id: NUTZER_ID,
          antwort: null,
          reviewer: { full_name: 'Herr Kurz' },
          contract: { job: { title: 'Steckdose setzen' } },
        },
      ]);
    }

    // Alles Uebrige: leere Liste. Die Bildschirme muessen mit nichts
    // zurechtkommen — das ist ohnehin der Zustand eines neuen Betriebs.
    return json([]);
  });
}

module.exports = { alsAnbieter, NUTZER_ID, PROJEKT_REF };
