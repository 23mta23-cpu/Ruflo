// Test-Double für den Supabase-Client — bewusst KEIN PostgREST-Nachbau.
//
// GRENZE (wichtig für die Aussagekraft jedes Tests, der ihn benutzt):
// Dieser Double wertet Filter NICHT aus. Er protokolliert die gebaute Abfrage
// (Tabelle, Operation, Payload, Filterkette) und liefert eine vom Test
// vorgegebene Antwort zurück. Er beweist damit, WELCHE Abfrage der Handler
// baut und welche er NICHT baut — nicht, was Postgres daraus machen würde.
//
// Die tatsächliche Wirkung der Compare-and-Swap-Bedingungen
// (.eq("status","pending").is("escrow_captured_at", null)) ist gegen echtes
// Postgres in scripts/db-test/webhook-idempotency.sql belegt. Diese Semantik
// wird hier NICHT erfunden und darf aus einem grünen Test hier nicht
// abgeleitet werden.

export type DbCall = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Array<{ fn: string; args: unknown[] }>;
  columns?: string;
  terminal?: "maybeSingle" | "single" | "await";
};

export type ScriptedResponse = { data?: unknown; error?: unknown };

export class FakeSupabase {
  /** Alle Aufrufe in Reihenfolge — Grundlage für Reihenfolge-Assertions. */
  readonly calls: DbCall[] = [];
  readonly rpcCalls: Array<{ fn: string; args: unknown }> = [];
  private queues: Record<string, ScriptedResponse[]>;

  /** queues: Schlüssel "tabelle.operation", Werte in Aufrufreihenfolge. */
  constructor(queues: Record<string, ScriptedResponse[]> = {}) {
    this.queues = queues;
  }

  private next(table: string, op: string): ScriptedResponse {
    const q = this.queues[`${table}.${op}`];
    if (q && q.length > 0) return q.shift()!;
    return { data: null, error: null };
  }

  from(table: string) {
    const self = this;
    const call: DbCall = { table, op: "select", filters: [] };
    self.calls.push(call);

    const builder = {
      select(columns?: string) { call.columns = columns; return builder; },
      insert(payload: unknown) { call.op = "insert"; call.payload = payload; return builder; },
      update(payload: unknown) { call.op = "update"; call.payload = payload; return builder; },
      upsert(payload: unknown, opts?: unknown) {
        call.op = "upsert"; call.payload = payload;
        call.filters.push({ fn: "upsertOpts", args: [opts] });
        return builder;
      },
      delete() { call.op = "delete"; return builder; },
      eq(a: unknown, b: unknown) { call.filters.push({ fn: "eq", args: [a, b] }); return builder; },
      is(a: unknown, b: unknown) { call.filters.push({ fn: "is", args: [a, b] }); return builder; },
      in(a: unknown, b: unknown) { call.filters.push({ fn: "in", args: [a, b] }); return builder; },
      or(a: unknown) { call.filters.push({ fn: "or", args: [a] }); return builder; },
      limit(n: number) { call.filters.push({ fn: "limit", args: [n] }); return builder; },
      maybeSingle() { call.terminal = "maybeSingle"; return Promise.resolve(self.next(table, call.op)); },
      single() { call.terminal = "single"; return Promise.resolve(self.next(table, call.op)); },
      // Direktes await ohne maybeSingle/single (z. B. .insert(), .update().eq())
      then(res: (v: ScriptedResponse) => unknown, rej?: (e: unknown) => unknown) {
        call.terminal = call.terminal ?? "await";
        return Promise.resolve(self.next(table, call.op)).then(res, rej);
      },
    };
    return builder;
  }

  rpc(fn: string, args: unknown) {
    this.rpcCalls.push({ fn, args });
    return Promise.resolve({ data: null, error: null });
  }

  readonly storage = {
    from: () => ({
      list: () => Promise.resolve({ data: [], error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
    }),
  };

  /** Alle Aufrufe auf eine Tabelle, optional gefiltert nach Operation. */
  callsOn(table: string, op?: DbCall["op"]): DbCall[] {
    return this.calls.filter((c) => c.table === table && (!op || c.op === op));
  }
  /** Kompakte Reihenfolge-Darstellung, z. B. ["contracts.update", "messages.insert"]. */
  sequence(): string[] {
    return this.calls.map((c) => `${c.table}.${c.op}`);
  }
}
