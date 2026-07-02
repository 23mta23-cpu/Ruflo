// Structural safety rail against an accidental live launch before the
// escrow/Treuhand construction has been confirmed by a banking/regulatory
// lawyer (ZAG §1 Abs. 1 — see notes/01-Status/Go-Live-Blocker.md P0 and
// docs/premortem_werkr.md, "Todesursache 2").
//
// Only gates LIVE money movement — Stripe test-mode keys (sk_test_...) are
// never blocked, so local/staging development and the app's existing
// "Zahlungs-Testmodus" flow keep working unchanged. The gate only engages
// once a real sk_live_... key is configured, which is exactly the moment
// real customer money would start moving.

export function assertZagSignoffForLiveMode(stripeSecretKey: string): Response | null {
  const isLiveKey = stripeSecretKey.startsWith("sk_live_");
  if (!isLiveKey) return null;

  const signoff = Deno.env.get("ZAG_LEGAL_SIGNOFF");
  if (signoff === "confirmed") return null;

  return new Response(
    JSON.stringify({
      error:
        "Live payments are disabled: ZAG_LEGAL_SIGNOFF is not set to 'confirmed'. " +
        "A banking/regulatory lawyer must confirm the escrow construction (§1 Abs. 1 ZAG) " +
        "before this Edge Function secret is set. See notes/01-Status/Go-Live-Blocker.md.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}
