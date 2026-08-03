// Test-Double für den Stripe-Client — protokolliert Aufrufe, liefert
// skriptierte Antworten. KEIN Nachbau von Stripe-Verhalten.
//
// GRENZE: Ob Stripe sich real so verhält (kumuliertes `amount_refunded`,
// Snapshot-Semantik der Events, Idempotency-Key-Lebensdauer, fehlende
// Reihenfolgegarantie), ist hier ANGENOMMEN, nicht bewiesen. Diese Doubles
// prüfen ausschliesslich unsere eigene Handlerlogik gegen diese Annahmen.
// Eine Verifikation gegen den echten Stripe-Testmodus steht aus.

export type StripeCall = { method: string; args: unknown[] };

export class FakeStripe {
  readonly calls: StripeCall[] = [];
  private scripted: Record<string, unknown[]>;
  private failing: Set<string>;

  constructor(scripted: Record<string, unknown[]> = {}, failing: string[] = []) {
    this.scripted = scripted;
    this.failing = new Set(failing);
  }

  private record(method: string, args: unknown[]): unknown {
    this.calls.push({ method, args });
    if (this.failing.has(method)) throw new Error(`FakeStripe: ${method} soll fehlschlagen`);
    const q = this.scripted[method];
    if (q && q.length > 0) return q.shift();
    return {};
  }

  readonly refunds = {
    create: (params: unknown, opts?: unknown) =>
      Promise.resolve(this.record("refunds.create", [params, opts])),
  };
  readonly charges = {
    retrieve: (id: string) => Promise.resolve(this.record("charges.retrieve", [id])),
  };
  readonly balanceTransactions = {
    retrieve: (id: string) => Promise.resolve(this.record("balanceTransactions.retrieve", [id])),
  };
  readonly paymentIntents = {
    retrieve: (id: string, opts?: unknown) =>
      Promise.resolve(this.record("paymentIntents.retrieve", [id, opts])),
    cancel: (id: string) => Promise.resolve(this.record("paymentIntents.cancel", [id])),
  };
  readonly accounts = {
    retrieve: (id: string) => Promise.resolve(this.record("accounts.retrieve", [id])),
  };
  readonly transfers = {
    create: (params: unknown, opts?: unknown) =>
      Promise.resolve(this.record("transfers.create", [params, opts])),
    list: (params: unknown) => Promise.resolve(this.record("transfers.list", [params])),
  };

  called(method: string): boolean { return this.calls.some((c) => c.method === method); }
  callsTo(method: string): StripeCall[] { return this.calls.filter((c) => c.method === method); }
}

/** Push-Double: zeichnet auf, ob und was versendet wurde. */
export function makeFakePush() {
  const sent: Array<{ tokens: string[]; title: string; body: string }> = [];
  const fn = (tokens: string[], title: string, body: string) => {
    sent.push({ tokens, title, body });
    return Promise.resolve();
  };
  return { fn, sent };
}
