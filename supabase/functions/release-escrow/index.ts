// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
//
// Diese Datei enthält BEWUSST keine Auszahlungslogik mehr. Sie erzeugt die
// realen Abhängigkeiten und delegiert an `handleReleaseEscrow` in handler.ts —
// dieselbe Funktion, die der Testharness unter supabase/tests/ aufruft.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, handleReleaseEscrow } from "./handler.ts";
import { benachrichtigen, versandBauen } from "../_shared/benachrichtigen.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Hier stand bis 14.09.2026 ein eigener Push-Versand, der mit
// `if (!tokens.length) return;` begann. Auf dem Web ist `profiles.push_token`
// immer null — „€840,00 wurden ausgezahlt" erreichte damit keinen einzigen
// Web-Nutzer, still und ohne Fehler. Die Wahl zwischen Push und E-Mail steht
// jetzt an EINER Stelle: ../_shared/benachrichtigen.ts.
const versand = versandBauen(supabase);

async function zustellen(
  empfaenger: string[], titel: string, text: string, daten: Record<string, string> = {},
) {
  const bilanz = await benachrichtigen(empfaenger, titel, text, daten, versand);
  // Bewusst ins Protokoll und nicht ins Ergebnis: die Auszahlung ist an dieser
  // Stelle bereits gelaufen. Verschwiegen wird es aber nicht.
  if (bilanz.ohneWeg || bilanz.fehlgeschlagen) {
    console.warn("release-escrow: Zustellung", JSON.stringify(bilanz));
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return await handleReleaseEscrow(req, { supabase, stripe, zustellen, stripeSecretKey: STRIPE_SECRET_KEY });
});
