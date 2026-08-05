# PaymentIntent-Historie — Architekturplan
*Stand 2026-08-05. Read-only-Analyse, keine Implementierung.*

## 1. Der Befund

`contracts.stripe_payment_intent` ist eine **einzelne** Spalte (`0021`, Z. 74).
Sie speichert immer nur den **zuletzt** erzeugten PaymentIntent. Alle
Erstattungs-, Rückbuchungs- und Betrugsereignisse suchen den Vertrag über genau
diese Spalte. Trifft ein Ereignis zu einem **älteren** PaymentIntent ein, findet
es keine Zeile — und hinterlässt weder Spur noch Alarm.

Der Handler weiss das und sagt es selbst: `stripe-webhook/handler.ts` vermerkt
bei einem zweiten PaymentIntent „mögliche Doppelbelastung, manuell prüfen" und
bricht ab.

## 2. Alle Schreibwege

Genau **einer**:

| Ort | Vorgang |
|---|---|
| `create-payment-intent/index.ts:148` | `.update({ stripe_payment_intent: pi.id })` — überschreibt bedingungslos |

Clientseitig gesperrt durch den Trigger aus `0300` (Z. 61) und `0630` (Z. 107):
`contracts.stripe_payment_intent is managed by Edge Functions only`.

**Wann entsteht ein zweiter PaymentIntent?** `create-payment-intent` gibt einen
bestehenden Intent zurück, solange er `requires_payment_method` oder
`requires_confirmation` ist. In jedem anderen Zustand — insbesondere `canceled`
— fällt der Code durch und erzeugt einen neuen. Der alte bleibt bei Stripe
bestehen und ist weiterhin erstattungs- und rückbuchungsfähig.

## 3. Alle Lesewege

Acht Filter, alle in `stripe-webhook/handler.ts`:

| Zeile | Zweig | Folge bei Nichttreffer |
|---|---|---|
| 343 | `charge.refunded` (Vorzustand) | `vertragFehlt = true` → 200, **keine Spur** |
| 371 | `charge.refunded` (Schreiben) | wie oben |
| 466, 482 | `charge.dispute.created` / `closed` | `console.warn`, 200 |
| 538 | `charge.refund.updated` | Korrektur läuft ins Leere |
| 661, 670, 704 | `funds_withdrawn` / `reinstated`, Frühwarnung | seit PR #164 500 bei DB-Fehler, aber **200 bei Nichttreffer** |

Ausserdem: `cancel-contract/handler.ts` gleicht seit PR #163 über
`refunds.list(payment_intent)` ab — mit dem **gespeicherten**, also ebenfalls nur
dem letzten Intent.

**Nicht betroffen:** Der DSGVO-Export (`export-my-data`) listet die Spalte
nicht auf; die App und `lib/` lesen sie nirgends ausser in den Typdefinitionen.

## 4. Bestehende Daten

Es gibt **keine Produktionsdaten** dazu: Stripe ist bewusst nicht eingerichtet,
es existiert kein Schlüssel und damit nie ein PaymentIntent. Ein Backfill hat
folglich höchstens Testzeilen zu berücksichtigen. Das ist der günstigste
denkbare Zeitpunkt für diese Änderung — sie wird nie wieder so billig sein.

Der DB-Test `webhook-idempotency.sql` (Y10) prüft bereits, dass sich zwei
Verträge **nicht** denselben PaymentIntent teilen dürfen — sonst würfe die
`.maybeSingle()`-Suche zur Laufzeit. Diese Eigenschaft muss das neue Schema
erhalten.

## 5. Minimales Schema

```sql
create table public.contract_payment_intents (
  payment_intent_id text primary key,          -- der natürliche Schlüssel
  contract_id       uuid not null references public.contracts(id) on delete restrict,
  amount_cents      integer not null check (amount_cents > 0),
  currency          text    not null default 'eur',
  status            text,                       -- letzter bekannter Stripe-Status
  is_current        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index contract_payment_intents_one_current
  on public.contract_payment_intents (contract_id) where is_current;
create index contract_payment_intents_contract_idx
  on public.contract_payment_intents (contract_id);
```

**Warum `payment_intent_id` als Primärschlüssel:** Er ist bei Stripe global
eindeutig und ist genau der Wert, mit dem jedes Webhook-Ereignis ankommt. Die
Suche wird damit ein Primärschlüsselzugriff, und ein Vertrag kann denselben
Intent nicht zweimal führen. Die Eigenschaft aus Y10 bleibt erhalten.

**Warum der partielle Unique-Index:** Genau ein Intent je Vertrag darf `current`
sein. Das ersetzt die alte Spalte semantisch, ohne die Historie zu verlieren.

**RLS:** Wie `payout_operations` (0650) und `rate_limits` (0250) — RLS
aktiviert, **keine Policy**. Default-Deny für anon und authenticated; Zugriff
ausschliesslich über `service_role`. Die Tabelle enthält Zahlungskennungen und
Beträge; kein Client hat daran etwas zu suchen.

## 6. Verbindung zu `contracts`

`contracts.stripe_payment_intent` **bleibt bestehen** und wird weiter gepflegt —
als Spiegel des jeweils aktuellen Intents. Begründung: Sie ist über den
`0300`/`0630`-Trigger geschützt, wird von `cancel-contract` gelesen, und ihr
Entfernen würde den Diff über mehrere Functions ziehen. Ein Spiegel, der von
einer Quelle abgeleitet wird, ist billiger als eine Migration aller Lesestellen.

Die Webhook-Suche wechselt auf die neue Tabelle:
`contract_payment_intents → contract_id → contracts`.

## 7. Migrationsstrategie

1. **Migration `0660`:** Tabelle, Indizes, RLS anlegen. Rein additiv.
2. **Backfill im selben Skript:**
   ```sql
   insert into public.contract_payment_intents
     (payment_intent_id, contract_id, amount_cents, currency, status, is_current)
   select c.stripe_payment_intent, c.id,
          (round(c.customer_total::numeric, 2) * 100)::integer, 'eur', null, true
     from public.contracts c
    where c.stripe_payment_intent is not null
   on conflict (payment_intent_id) do nothing;
   ```
   Idempotent durch `on conflict`. Der Betrag wird aus `customer_total`
   abgeleitet — er ist für Altzeilen nicht exakt rekonstruierbar, wenn ein
   früherer Intent auf einen anderen Betrag lautete. **Das ist hinnehmbar, weil
   es keine solchen Altzeilen gibt** (siehe §4); für neue Zeilen schreibt
   `create-payment-intent` den echten Betrag.
3. **`create-payment-intent`** schreibt künftig beides: die neue Zeile (mit
   `is_current = true`, vorherige auf `false`) und den Spiegel in `contracts`.
   Beides in **einer** RPC, sonst entsteht genau die Teilfehler-Lücke, die im
   Auszahlungspfad schon einmal Geld gekostet hat.
4. **Webhook-Lesewege** einzeln auf die neue Tabelle umstellen.
5. Erst danach: die alte Spalte als „nur noch Spiegel" kommentieren.

## 8. Umgang mit historischen PaymentIntents

Ein Ereignis zu einem **nicht mehr aktuellen** Intent ist kein Fehler, sondern
der Normalfall bei Erstattungen und Rückbuchungen. Es muss:

- den Vertrag finden (über die Tabelle),
- den Vorgang **verbuchen**,
- und **sichtbar machen**, dass er einen alten Intent betrifft.

Was es **nicht** tun darf: den aktuellen Intent überschreiben oder den Vertrag
so behandeln, als sei die Zahlung neu erfasst worden.

## 9. Tests

**Gegen echtes Postgres:** Backfill zweimal ausgeführt (Idempotenz) · genau ein
`is_current` je Vertrag erzwungen · derselbe Intent an zwei Verträgen abgewiesen ·
Default-Deny unter echter `authenticated`-Rolle · echte Nebenläufigkeit beim
Wechsel des aktuellen Intents (überlappende `dblink`-Verbindungen wie in
`payout-ledger.sql`).

**Mit Doubles:** Webhook findet den Vertrag über einen **alten** Intent ·
Erstattung auf einen alten Intent wird verbucht und als solche erkennbar ·
`cancel-contract` gleicht gegen **alle** Intents des Vertrags ab, nicht nur den
letzten · zweiter Intent macht den ersten nicht `current`.

**Erst mit echtem Stripe-Testmodus:** ob ein stornierter Intent wirklich noch
Ereignisse erzeugt und in welcher Reihenfolge.

## 10. Rollback

Additiv, daher zweistufig wie bei `0650`:

**Stufe 1 — Code zurück, Schema behalten.** Die Lesewege wieder auf
`contracts.stripe_payment_intent` stellen. Die Tabelle bleibt als Beleg liegen
und stört nicht, weil der Spiegel weitergepflegt wurde.

**Stufe 2 — Schema zurück:** `drop table public.contract_payment_intents;`
Vorher prüfen, ob Zeilen mit `is_current = false` existieren — das sind Intents,
die es in `contracts` nie gab; ihr Verlust ist der eigentliche Schaden:
```sql
select contract_id, payment_intent_id, status
  from public.contract_payment_intents where not is_current;
```

## 11. Offene Founder-Entscheidungen

**FOUNDER-ENTSCHEIDUNG ERFORDERLICH — 1: Was soll bei einer Doppelbelastung
geschehen?** Heute bricht der Webhook ab und schreibt „manuell prüfen". Mit der
Historie liesse sich erkennen, dass zwei Intents desselben Vertrags bezahlt
wurden. Ob dann automatisch der zweite erstattet wird, ist eine
Geldverteilungsentscheidung und wird von diesem Plan **nicht** vorweggenommen.

**FOUNDER-ENTSCHEIDUNG ERFORDERLICH — 2: Sollen alte Intents beim Storno
mitgeprüft werden?** `cancel-contract` gleicht heute nur gegen den gespeicherten
Intent ab. Prüfte es alle, würde eine Erstattung auf einem alten Intent
mitgezählt — und die Differenz fiele kleiner aus. Das verändert den
tatsächlich erstatteten Betrag und ist damit fachlich, nicht technisch.

**Nicht zu entscheiden, aber zu beachten:** Diese Änderung ist erst dann
wirklich prüfbar, wenn Stripe eingerichtet ist. Bis dahin bleibt sie
Doubles-getestet.
