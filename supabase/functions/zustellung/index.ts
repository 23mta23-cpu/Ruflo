// zustellung — verschickt offene Pflichtmitteilungen per E-Mail.
//
// HINTERGRUND: `strike_zustellung_vermerken()` und
// `beschraenkung_zustellung_vermerken()` liegen seit 0750 bzw. 0810 in der
// Datenbank, und bis zum 12.09.2026 hat sie NIEMAND aufgerufen, weil es
// keinen Versandweg gab. Die Begründung wurde geschrieben und blieb liegen.
//
// Geschuldet ist die Übermittlung, nicht der Text:
//   * AGB §7(4) / Art. 4 P2B-VO — Begründung für den Anbieter.
//   * DSA Art. 17 Abs. 1 — Begründung an den Betroffenen übermitteln.
//
// E-Mail und nicht Push, mit Absicht: Push existiert auf dem Web gar nicht
// (`lib/notifications.ts` gibt bei Platform.OS === 'web' sofort auf), und eine
// Mitteilung über eine Kontosperrung muss den Betroffenen auch dann erreichen,
// wenn er die App nie wieder öffnet.
//
// Aufruf: wie release-escrow über den geplanten Lauf, mit
// `Authorization: Bearer <service_role>` (sonst weist das Gateway ab) und
// `x-admin-secret`. Einrichtung in docs/betrieb/abnahmefrist-lauf.md.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { mitteilungenZustellen, statusFuer } from "./handler.ts";
import type { Offen } from "./handler.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-secret",
};

const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

/** Reiner Text in eine schlichte, lesbare E-Mail. Kein Marketing-Layout: das
 *  hier ist eine Rechtsmitteilung, keine Kampagne. */
function html(titel: string, text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  const kopf = titel
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1A1917;line-height:1.6">`
    + `<h2 style="color:#1B5C40;font-size:18px">${kopf}</h2>`
    + `<p style="white-space:pre-wrap">${escaped}</p>`
    + `<p style="color:#6C6862;font-size:13px;margin-top:28px">`
    + `Diese Nachricht wurde Ihnen zugestellt, weil sie eine Maßnahme zu Ihrem `
    + `Werkant-Konto betrifft. Sie können ihr widersprechen; wie, steht im Text oben.`
    + `</p></div>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: JSON_HEADERS,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Vor der Secret-Prüfung, wie in pstg-annual-report: bremst das
  // zeichenweise Durchprobieren, bevor überhaupt verglichen wird.
  const rateLimited = await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:zustellung`,
    { limit: 5, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  // Konstantzeit-Vergleich, damit die Antwortzeit das Secret nicht
  // zeichenweise verrät (Security-Befund L4 bei pstg-annual-report).
  const secret = req.headers.get("x-admin-secret");
  const expected = Deno.env.get("Werkant_ADMIN_SECRET");
  const secretOk = (() => {
    if (!expected || !secret || secret.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= secret.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  })();
  if (!secretOk) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: JSON_HEADERS,
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM_EMAIL");
  if (!apiKey || !from) {
    // NICHT als Erfolg melden. Ohne Schlüssel ist die Pflicht nicht erfüllt,
    // und `zustellung_stau` in /health soll das weiter anzeigen.
    console.error("zustellung: RESEND_API_KEY oder WAITLIST_FROM_EMAIL fehlt");
    return new Response(
      JSON.stringify({ error: "mail_not_configured", versendet: 0 }),
      { status: 503, headers: JSON_HEADERS },
    );
  }

  const { data, error } = await supabase.rpc("unzugestellte_pflichtmitteilungen", {
    p_limit: 50,
  });
  if (error) {
    console.error("zustellung: Abfrage fehlgeschlagen:", error);
    return new Response(JSON.stringify({ error: "query_failed" }), {
      status: 500, headers: JSON_HEADERS,
    });
  }

  const offen = (data ?? []) as Offen[];

  // Die Schleife liegt in handler.ts, damit sie ausfuehrbar pruefbar ist:
  // "erst quittieren, wenn Resend angenommen hat" ist eine Rechtszusage, und
  // `deno check` kann sie nicht pruefen. Hier werden nur die echten
  // Abhaengigkeiten gebaut.
  const bilanz = await mitteilungenZustellen(offen, {
    versenden: async (m) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [m.email],
          subject: m.titel,
          html: html(m.titel, m.text),
        }),
      });
      return { ok: res.ok, status: res.status };
    },
    quittieren: async (id) => {
      const { error: qErr } = await supabase.rpc("zustellung_quittieren", {
        p_id: id,
        p_weg: "e-mail",
      });
      return { fehler: qErr };
    },
  });

  return new Response(JSON.stringify(bilanz), {
    status: statusFuer(bilanz), headers: JSON_HEADERS,
  });
});
