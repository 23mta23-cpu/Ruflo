// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
//
// Diese Datei enthält BEWUSST keine Stornierungslogik mehr. Sie erzeugt die
// realen Abhängigkeiten und delegiert an `handleCancelContract` in handler.ts —
// dieselbe Funktion, die der Testharness unter supabase/tests/ aufruft.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, handleCancelContract } from "./handler.ts";
import { benachrichtigen, versandBauen } from "../_shared/benachrichtigen.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Hier stand bis 14.09.2026 ein eigener Push-Versand, der mit
// `if (!tokens.length) return;` begann. Auf dem Web ist `profiles.push_token`
// immer null — die Mitteilung verfiel dann still, ohne Fehler. Die Wahl
// zwischen Push und E-Mail steht jetzt an EINER Stelle:
// ../_shared/benachrichtigen.ts.
const versand = versandBauen(supabase);

async function zustellen(
  empfaenger: string[], titel: string, text: string, daten: Record<string, string> = {},
) {
  const bilanz = await benachrichtigen(empfaenger, titel, text, daten, versand);
  if (bilanz.ohneWeg || bilanz.fehlgeschlagen) {
    console.warn("cancel-contract: Zustellung", JSON.stringify(bilanz));
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return await handleCancelContract(req, { supabase, stripe, zustellen });
});
