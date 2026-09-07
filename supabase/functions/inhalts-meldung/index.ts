// inhalts-meldung — Melde- und Abhilfeverfahren nach Art. 16 DSA.
//
// Diese Datei enthaelt BEWUSST keine Pruef- oder Speicherlogik. Sie erzeugt die
// realen Abhaengigkeiten und delegiert an `handleInhaltsMeldung` in handler.ts —
// dieselbe Funktion, die der Testharness unter supabase/tests/ aufruft.
//
// KEIN JWT (config.toml: verify_jwt = false). Art. 16 Abs. 1 richtet sich an
// "Personen und Einrichtungen", nicht an Nutzer der Plattform.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, handleInhaltsMeldung } from "./handler.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return await handleInhaltsMeldung(req, { supabase });
});
