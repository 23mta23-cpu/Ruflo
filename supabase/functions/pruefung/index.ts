// deploy-touch 2026-09-14
//
// Das Pruef-Postfach: Betreiber sehen die wartenden Verifizierungen, oeffnen
// die Dokumente und entscheiden. Logik in handler.ts, hier nur Auth, Daten und
// die signierten Links.
//
// AUSDRUECKLICH KEINE KI. Begruendung in lib/pruefung.ts: ein Modell, das
// Dokumente beurteilt, holte Werkant die Hochrisiko-Pflichten aus Anhang III
// der KI-VO ins Haus, die seit 02.08.2026 gelten. Hier lesen `if`-Abfragen
// Felder aus, die ohnehin vorliegen.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import {
  assertOnlyFields, assertString, assertUuid, parseJsonObject,
  ValidationError, validationErrorResponse,
} from "../_shared/validate.ts";
import { istBetreiber, entscheidungPruefen, ablehnungsText } from "./handler.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

/** Wie lange ein Dokumentlink gilt. Kurz: er zeigt auf einen Gewerbeschein. */
const LINK_SEKUNDEN = 300;

const json = (koerper: unknown, status = 200) =>
  new Response(JSON.stringify(koerper), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Nicht angemeldet." }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Nicht angemeldet." }, 401);

    const begrenzt = await enforceRateLimit(
      supabase, `user:${user.id}:pruefung`, { limit: 60, windowSeconds: 60 }, CORS,
    ) ?? await enforceRateLimit(
      supabase, `ip:${getClientIp(req)}:pruefung`, { limit: 120, windowSeconds: 60 }, CORS,
    );
    if (begrenzt) return begrenzt;

    // Das eigentliche Tor. Nicht gesetzte Liste heisst: niemand.
    if (!istBetreiber(user.email, Deno.env.get("WERKANT_ADMIN_EMAILS"))) {
      // Absichtlich dieselbe Antwort wie fuer „nicht angemeldet": wer nicht
      // Betreiber ist, soll nicht erfahren, dass es diesen Weg gibt.
      return json({ error: "Nicht gefunden." }, 404);
    }

    let koerper: Record<string, unknown>;
    try {
      koerper = await parseJsonObject(req);
      assertOnlyFields(koerper, ["aktion", "providerId", "grund"]);
    } catch (e) {
      if (e instanceof ValidationError) return validationErrorResponse(e, CORS);
      throw e;
    }

    const aktion = String(koerper.aktion ?? "");

    // ── Liste der wartenden Einreichungen ────────────────────────────────
    if (aktion === "liste") {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select("id, business_name, trade_id, gewerbeschein_path, meisterbrief_path, "
          + "kyc_submitted_at, has_steuer_id, is_nachbarschaft, category_ids")
        .eq("kyc_status", "in_review")
        .order("kyc_submitted_at", { ascending: true });
      if (error) return json({ error: "Liste nicht lesbar." }, 500);

      // Der erzeugte Supabase-Typ leitet fuer diese Auswahl eine Union mit
      // GenericStringError ab; einmal sauber festlegen statt an jeder Stelle
      // zu kaempfen.
      type Einreichung = {
        id: string;
        business_name: string | null;
        trade_id: string | null;
        gewerbeschein_path: string | null;
        meisterbrief_path: string | null;
        kyc_submitted_at: string | null;
        has_steuer_id: boolean | null;
        is_nachbarschaft: boolean | null;
        category_ids: string[] | null;
      };
      const zeilen = (data ?? []) as unknown as Einreichung[];
      const ids = zeilen.map((z) => z.id);
      const namen = new Map<string, string | null>();
      // Wer hat die 18+-Erklaerung hinterlegt (0990)? Ohne diese Auskunft
      // kaeme jeder Nachbarschaftshelfer mit dem Befund „keine Erklaerung"
      // an -- die Vorpruefung wuerde also das Fehlen der ABFRAGE melden und
      // nicht das Fehlen der Erklaerung.
      const erklaert = new Set<string>();
      if (ids.length) {
        const { data: profile } = await supabase
          .from("profiles").select("id, full_name").in("id", ids);
        for (const p of (profile ?? []) as { id: string; full_name: string | null }[]) {
          namen.set(p.id, p.full_name);
        }
        const { data: erkl } = await supabase
          .from("volljaehrigkeits_erklaerungen").select("helfer_id").in("helfer_id", ids);
        for (const e of (erkl ?? []) as { helfer_id: string }[]) erklaert.add(e.helfer_id);
      }

      const mitLinks = await Promise.all(zeilen.map(async (z) => {
        const link = async (pfad: unknown) => {
          if (typeof pfad !== "string" || !pfad) return null;
          const { data: s } = await supabase.storage
            .from("verification-docs").createSignedUrl(pfad, LINK_SEKUNDEN);
          return s?.signedUrl ?? null;
        };
        return {
          ...z,
          full_name: namen.get(z.id) ?? null,
          hat_volljaehrigkeitserklaerung: erklaert.has(z.id),
          gewerbeschein_url: await link(z.gewerbeschein_path),
          meisterbrief_url: await link(z.meisterbrief_path),
        };
      }));

      return json({ einreichungen: mitLinks, link_gilt_sekunden: LINK_SEKUNDEN });
    }

    // ── Was sonst noch auf einen Menschen wartet ─────────────────────────
    //
    // ANLASS (21.09.2026): Beim Auszaehlen aller Tabellen, in denen etwas auf
    // eine Entscheidung wartet, kam heraus, dass NIEMAND `disputes` und
    // `inhalts_meldungen` liest. Bei den Reklamationen haengt Geld daran:
    // 0770 bricht die automatische Auszahlung mit `dispute_open` ab, eine
    // offene Reklamation friert den Treuhandbetrag ein -- fuer beide Seiten,
    // unbefristet, waehrend der Bildschirm dem Kunden zwei Werktage zusagt.
    //
    // AUSDRUECKLICH NUR LESEND. Eine Entscheidung ueber eine Reklamation
    // bewegt Geld (voll erstatten, teilweise, freigeben); das ist ein
    // Produktentwurf mit Geldfolgen und gehoert dem Founder. Sichtbarkeit ist
    // die Haelfte des Problems und hat keine Geldfolgen.
    if (aktion === "wartendes") {
      const { data: rek } = await supabase
        .from("disputes")
        .select("id, case_id, category, description, status, created_at, "
          + "contract:contracts!contract_id(id, customer_total, provider_payout)")
        .neq("status", "resolved")
        .order("created_at", { ascending: true })
        .limit(50);

      const { data: meld } = await supabase
        .from("inhalts_meldungen")
        .select("id, inhalt_art, fundstelle, begruendung, eingegangen_am, melder_name")
        .is("entscheidung", null)
        .order("eingegangen_am", { ascending: true })
        .limit(50);

      // Die Begruendung wird GEKUERZT herausgegeben. Der Betreiber muss
      // einschaetzen koennen, wie dringend ein Fall ist; den vollen Text
      // braucht erst die Entscheidung, und die faellt vorerst im Dashboard.
      const kurz = (t: unknown, n = 240) =>
        typeof t === "string" && t.length > n ? `${t.slice(0, n)}…` : (t ?? null);

      type Rek = Record<string, unknown> & { description?: unknown };
      type Meld = Record<string, unknown> & { begruendung?: unknown };

      return json({
        // `as unknown as` wie bei der Liste oben: der erzeugte Supabase-Typ
        // leitet fuer eine Auswahl mit Verbund eine Union mit
        // GenericStringError ab. Einmal sauber festlegen statt an jeder
        // Stelle dagegen zu kaempfen.
        reklamationen: ((rek ?? []) as unknown as Rek[])
          .map((r) => ({ ...r, description: kurz(r.description) })),
        meldungen: ((meld ?? []) as unknown as Meld[])
          .map((m) => ({ ...m, begruendung: kurz(m.begruendung) })),
      });
    }

    // ── Betriebsstatus: was laeuft im Hintergrund, und was liegt liegen ──
    //
    // ANLASS (22.09.2026, gemessen): die Datenbank hat drei Betreiber-
    // Selbstauskuenfte, und kein BILDSCHIRM rief eine davon auf. `/health`
    // ruft sie zwar, gibt daraus aber nur Booleans an den Waechter-Workflow
    // -- Zahlen bewusst nicht, seit ein Wettbewerber daran das Wachstum der
    // Angebotsseite mitlesen konnte. Der Betreiber hatte keinen Ort fuer
    // den Stand, obwohl der Kopfkommentar in `health/index.ts` genau das
    // behauptete („steht ohnehin im Pruef-Postfach").
    //
    // Die drei Funktionen sind fuer `authenticated` gesperrt (BN10) und
    // laufen deshalb hier mit `service_role`, hinter demselben Tor wie der
    // Rest des Pruef-Postfachs.
    //
    // JEDE Auskunft wird EINZELN gefangen. Faellt eine aus, sollen die
    // anderen beiden trotzdem dastehen: `null` heisst in
    // `lib/betriebsstatus.ts` ausdruecklich „nicht abrufbar" und wird als
    // dringend gemeldet -- nicht als „alles in Ordnung".
    if (aktion === "betriebsstatus") {
      const eineAuskunft = async (name: string) => {
        try {
          const { data, error } = await supabase.rpc(name);
          if (error) {
            console.error(`betriebsstatus: ${name} fehlgeschlagen:`, error.message);
            return null;
          }
          // Die drei Funktionen sind `returns table (...)` und liefern
          // deshalb eine LISTE mit genau einer Zeile, kein Objekt.
          return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
        } catch (e) {
          console.error(`betriebsstatus: ${name} warf:`, e);
          return null;
        }
      };

      const [zustellung, abnahme, pstg] = await Promise.all([
        eineAuskunft("zustellung_status"),
        eineAuskunft("abnahme_lauf_status"),
        eineAuskunft("pstg_meldung_status"),
      ]);
      return json({ zustellung, abnahme, pstg });
    }

    // ── Entscheiden ──────────────────────────────────────────────────────
    if (aktion === "freigeben" || aktion === "ablehnen") {
      const providerId = assertUuid(koerper.providerId, "providerId");
      const grund = koerper.grund === undefined
        ? "" : assertString(koerper.grund, "grund", { maxLength: 2000 });

      const gepruft = aktion === "freigeben"
        ? entscheidungPruefen({ art: "freigeben", providerId })
        : entscheidungPruefen({ art: "ablehnen", providerId, grund });
      if (!gepruft.ok) return json({ error: gepruft.fehler }, gepruft.code);

      // Nur aus 'in_review' heraus. Ohne diese Bedingung liesse sich ein
      // laengst freigegebener Betrieb per Nachzuegler-Anfrage wieder
      // ablehnen, und zwei gleichzeitige Klicks entschieden zweimal.
      const { data: geaendert, error } = await supabase
        .from("provider_profiles")
        .update({
          kyc_status: gepruft.status,
          kyc_rejected_reason: gepruft.grund,
          kyc_verified: gepruft.status === "approved",
        })
        .eq("id", providerId)
        .eq("kyc_status", "in_review")
        .select("id");
      if (error) return json({ error: "Entscheidung nicht gespeichert." }, 500);
      if (!geaendert?.length) {
        return json({ error: "Diese Einreichung wartet nicht (mehr) auf eine Prüfung." }, 409);
      }

      // Die Mitteilung gehoert zugestellt, nicht in eine Spalte geschrieben.
      // Genau dieser Unterschied war der Befund aus 0860.
      const mitteilung = gepruft.status === "approved"
        ? { titel: "Ihre Verifizierung ist abgeschlossen",
            text: "Ihr Betrieb ist freigegeben. Sie können ab sofort Angebote abgeben.",
            route: "/betrieb/dashboard" }
        : { ...ablehnungsText(gepruft.grund ?? ""), route: "/onboarding-kyc?track=handwerker" };

      const { error: mErr } = await supabase.from("notifications").insert({
        empfaenger: providerId,
        art: "system",
        titel: mitteilung.titel,
        text: mitteilung.text,
        route: mitteilung.route,
        quelle_tabelle: "provider_profiles",
        quelle_id: providerId,
        // Eine Ablehnung ist eine Beschraenkung des Dienstes: sie SCHULDET
        // eine Uebermittlung (Art. 4 P2B-VO, DSA Art. 17). Eine Freigabe ist
        // eine gute Nachricht ohne Rechtsfolge, die zaehlt nicht in den
        // Rueckstand.
        pflicht: gepruft.status === "rejected",
      });
      if (mErr) console.warn("pruefung: Mitteilung nicht angelegt:", mErr.message);

      return json({ ok: true, status: gepruft.status });
    }

    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (err) {
    console.error("pruefung:", err);
    return json({ error: "Interner Fehler." }, 500);
  }
});
