// Ausfuehrbare Tests des Lesepfads fuer Zahlungsmethoden.
//
// Getestet wird AUSSCHLIESSLICH die eigene Logik in
// supabase/functions/list-payment-methods/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. KEIN echter Stripe-Aufruf.
//
// Die wichtigste Zusicherung ist LP1 und sie ist NEGATIV: ohne vorhandenen
// Stripe-Kunden darf KEINER angelegt werden. Bis zum 23.09.2026 legte das
// blosse Oeffnen des Bildschirms einen Kunden bei Stripe an und schrieb
// `stripe_customer_id` — ein Schreibvorgang im Lesepfad, fuer jeden
// Angemeldeten, der vielleicht nie zahlt (Art. 5 Abs. 1 lit. c DSGVO).
//
// GRENZE: Ob Stripe die Methoden real so liefert, ist angenommen, nicht
// bewiesen — siehe Kopf von _shared/testing/fakeStripe.ts.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleListPaymentMethods } from "../functions/list-payment-methods/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";
import { FakeStripe } from "../functions/_shared/testing/fakeStripe.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

const NUTZER = "11111111-1111-1111-1111-111111111111";
const KUNDE = "cus_pruefstand";

function setup(o: { kunde?: string | null; user?: string | null } = {}) {
  const db = new FakeSupabase({
    "profiles.select": [{
      data: {
        stripe_customer_id: o.kunde === undefined ? KUNDE : o.kunde,
        display_name: "Prüfstand", email: "pruefstand@example.invalid",
      },
    }],
  });
  db.authUser = o.user === undefined ? { id: NUTZER } : (o.user ? { id: o.user } : null);
  const stripe = new FakeStripe({
    "paymentMethods.list": [
      { data: [{ id: "pm_1", card: { brand: "visa", last4: "4242", exp_month: 1, exp_year: 2030 } }] },
      { data: [] },
    ],
    "customers.retrieve": [{ invoice_settings: { default_payment_method: "pm_1" } }],
    "customers.create": [{ id: "cus_neu" }],
  });
  return { db, stripe, deps: { supabase: asAny(db), stripe: asAny(stripe) } };
}

const anfrage = (auth = true) =>
  new Request("https://x/list-payment-methods", {
    method: "POST",
    headers: auth ? { Authorization: "Bearer jwt" } : {},
  });

Deno.test("LP1: ohne Stripe-Kunden bleibt die Liste leer und es wird KEINER angelegt", async () => {
  const { stripe, deps } = setup({ kunde: null });
  const res = await handleListPaymentMethods(anfrage(), deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).methods, []);
  assertFalse(stripe.called("customers.create"), "ein Lesepfad hat einen Stripe-Kunden angelegt");
  assertFalse(stripe.called("paymentMethods.list"), "ohne Kunden wurde trotzdem bei Stripe gefragt");
});

Deno.test("LP2: mit Stripe-Kunden werden die Methoden geliefert", async () => {
  const { stripe, deps } = setup();
  const res = await handleListPaymentMethods(anfrage(), deps);
  assertEquals(res.status, 200);
  const { methods } = await res.json();
  assertEquals(methods.length, 1);
  assertEquals(methods[0].last4, "4242");
  assertEquals(methods[0].isDefault, true);
  assert(stripe.called("paymentMethods.list"));
});

Deno.test("LP3: auch mit Kunden wird nie ein neuer angelegt", async () => {
  // Gegenprobe zu LP1: sonst waere „legt nie einen an" mit „fragt nie etwas
  // ab" verwechselbar.
  const { stripe, deps } = setup();
  await handleListPaymentMethods(anfrage(), deps);
  assertFalse(stripe.called("customers.create"));
});

Deno.test("LP4: ohne Authorization-Kopf 401", async () => {
  const { deps } = setup();
  assertEquals((await handleListPaymentMethods(anfrage(false), deps)).status, 401);
});

Deno.test("LP5: ohne gueltigen Nutzer 401", async () => {
  const { stripe, deps } = setup({ user: null });
  assertEquals((await handleListPaymentMethods(anfrage(), deps)).status, 401);
  assertFalse(stripe.called("customers.create"));
});
