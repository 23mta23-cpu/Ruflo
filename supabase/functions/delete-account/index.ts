import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// GDPR Art. 17 — Right to erasure.
// Financial records (contracts, invoices) must be retained for 10 years (HGB §238).
// We therefore pseudonymize the profile row: all PII is removed / replaced with a
// deletion marker while contract/job rows remain for audit and tax purposes.
// stripe_customer_id is left in place so Stripe-side deletion can be triggered
// separately by the ops team.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const userId = user.id;

  // Check for active contracts: refuse deletion if escrow is outstanding
  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("id")
    .or(`customer_id.eq.${userId},provider_id.eq.${userId}`)
    .in("status", ["pending", "active"])
    .limit(1);

  if (activeContracts && activeContracts.length > 0) {
    return json({
      error: "Aktive Aufträge verhindern die Löschung. Bitte schließe oder storniere alle laufenden Aufträge zuerst.",
    }, 409);
  }

  // Pseudonymize profile — remove all PII fields.
  const deletedMarker = `deleted_${userId.slice(0, 8)}`;
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      display_name: deletedMarker,
      full_name:    null,
      phone:        null,
      email:        null,
      avatar_url:   null,
      push_token:   null,
      plz:          null,
      city:         null,
      company_name: null,
      ust_id:       null,
    })
    .eq("id", userId);

  if (profileErr) {
    console.error("Profile pseudonymization failed:", profileErr);
    return json({ error: "Löschung fehlgeschlagen — bitte wende dich an support@werkr.de" }, 500);
  }

  // Mark provider profile unavailable (prevents them appearing in search)
  await supabase
    .from("provider_profiles")
    .update({ available: false, stripe_onboarded: false })
    .eq("id", userId);

  // Revoke all auth sessions (global sign-out).
  // The user's auth account remains so FK constraints on contracts/jobs stay valid;
  // a manual admin step can hard-delete auth.users after the HGB retention period.
  const { error: signOutErr } = await supabase.auth.admin.signOut(userId, "global");
  if (signOutErr) {
    // Non-fatal: profile is already anonymized.
    console.warn("Global sign-out failed:", signOutErr.message);
  }

  console.log(`Account pseudonymized: user_id=${userId}`);

  return json({ deleted: true });
});
