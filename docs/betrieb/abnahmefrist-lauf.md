# Der geplante Lauf für die Abnahmefrist

**Was er tut:** Einmal täglich die Verträge holen, bei denen die fiktive
Abnahme nach § 640 Abs. 2 BGB eingetreten ist, und für jeden `release-escrow`
aufrufen. Ohne diesen Lauf passiert die automatische Freigabe **nicht** — die
Datenbank kennt die Frist, aber sie führt von sich aus kein Geld ab.

## Einrichten in Supabase (einmalig, vor dem Start)

**Wichtig, und beim ersten Entwurf dieser Anleitung falsch:** `release-escrow`
steht in `supabase/config.toml` auf `verify_jwt = true`. Das Supabase-Gateway
weist einen Aufruf ohne gültiges JWT ab, **bevor** er die Funktion erreicht.
Der Lauf muss deshalb ZWEI Kopfzeilen schicken:

* `Authorization: Bearer <service_role_key>` — damit das Gateway durchlässt
* `x-admin-secret: <Werkant_ADMIN_SECRET>` — damit die Funktion den
  automatischen Weg nimmt

Ein Aufruf mit nur dem Secret wäre am Gateway hängen geblieben, ohne dass
irgendwo ein Fehler sichtbar geworden wäre: die Frist wäre verstrichen und
nichts wäre passiert.

Voraussetzung: `Werkant_ADMIN_SECRET` ist als Edge-Function-Secret gesetzt
(dasselbe, das `pstg-annual-report` benutzt).

```sql
-- ── 1. Erweiterungen ──────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 2. Geheimnisse in die Datenbank-Einstellungen ─────────────────────────
-- NICHT in den Cron-Text: `cron.job.command` ist im Klartext lesbar für
-- jeden mit SQL-Zugriff. Als Datenbank-Einstellung stehen sie an einer
-- Stelle und tauchen im Auftragsplan nicht auf.
alter database postgres set app.werkant_admin_secret = 'HIER_DAS_ADMIN_SECRET';
alter database postgres set app.werkant_service_key  = 'HIER_DER_SERVICE_ROLE_KEY';

-- ── 3. Auftrag anlegen ────────────────────────────────────────────────────
select cron.schedule(
  'abnahmefrist-taeglich',
  '0 4 * * *',                      -- 04:00 UTC, also nachts in Köln
  $$
  select net.http_post(
    url     := 'https://chnphpmpdpllnpqtvwhx.supabase.co/functions/v1/release-escrow',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.werkant_service_key', true),
      'x-admin-secret', current_setting('app.werkant_admin_secret', true)
    ),
    body    := jsonb_build_object('contract_id', v.contract_id)
  )
  from public.abnahme_faellige_vertraege(200) v;
  $$
);
```

### Vorher gefahrlos ausprobieren

Solange es keine fälligen Verträge gibt, ist der Lauf ein Leerlauf. Das lässt
sich vorher prüfen und der Lauf einmal von Hand auslösen, ohne bis 4 Uhr zu
warten:

```sql
-- Wie viele Verträge wären jetzt dran? Zu Beginn: 0.
select count(*) from public.abnahme_faellige_vertraege(500);

-- Den Lauf einmal sofort ausführen (derselbe Befehl wie im Auftrag):
select net.http_post(
  url     := 'https://chnphpmpdpllnpqtvwhx.supabase.co/functions/v1/release-escrow',
  headers := jsonb_build_object(
    'Content-Type',   'application/json',
    'Authorization',  'Bearer ' || current_setting('app.werkant_service_key', true),
    'x-admin-secret', current_setting('app.werkant_admin_secret', true)
  ),
  body    := jsonb_build_object('contract_id', v.contract_id)
)
from public.abnahme_faellige_vertraege(200) v;

-- Antworten ansehen (pg_net schreibt sie asynchron, ein paar Sekunden warten):
select id, status_code, content from net._http_response order by id desc limit 5;
```

**Was NICHT nach einem Fehler aussieht, aber einer ist:** `status_code = 401`
heißt, das Gateway hat abgewiesen — dann stimmt der Service-Key nicht.
`status_code = 403` oder eine Antwort mit `"Forbidden"` heißt, das
Admin-Secret stimmt nicht. Beides bleibt sonst unbemerkt, weil der Auftrag
selbst „erfolgreich" gelaufen ist.

### Nicht in dieser Umgebung geprüft

`pg_cron` und `pg_net` gibt es in der Sandbox nicht; die Migration, die
Berechtigungen und der Funktionsaufruf sind gegen echtes Postgres geprüft
(`scripts/db-test/abnahme-frist.sql`), die Aufrufform gegen den Handler
(`supabase/tests/release-escrow_test.ts`, Test 640-8). Der Zeitplan selbst
ist es nicht — deshalb der Probelauf oben, bevor man sich darauf verlässt.

## Warum täglich und nicht stündlich

Die Frist läuft in Tagen. Ein stündlicher Lauf verschiebt die Auszahlung um
höchstens 23 Stunden nach vorne und erzeugt 24-mal so viele Aufrufe. Nachts,
damit eine Auszahlung nicht mitten in einem Gespräch zwischen Kunde und
Betrieb passiert.

## Was passiert, wenn der Lauf ausfällt

Nichts Schlimmes, und das ist Absicht: die Verträge bleiben fällig und werden
beim nächsten Lauf abgearbeitet. Es gibt keinen Zeitpunkt, an dem eine
verpasste Ausführung etwas endgültig verloren gehen lässt.

Umgekehrt ist ein doppelter Lauf ebenfalls ungefährlich — `payout_claim`
liefert je Vertrag genau eine Operation, und `release-escrow` gleicht vor
jedem Transfer mit Stripe ab.

## Was der Lauf NICHT entscheidet

Ob die fiktive Abnahme eingetreten ist. Das entscheidet ausschließlich
`payout_claim(…, p_fiktive_abnahme := true)` in der Datenbank, innerhalb
derselben Transaktion und Zeilensperre wie die Auszahlung. Zwischen dem
Zusammenstellen der Liste und dem Aufruf kann der Kunde noch einen Mangel
gemeldet haben — dann greift die Prüfung dort und nicht die veraltete Liste.

Das `x-admin-secret` sagt nur: *dieser Aufruf kommt vom geplanten Lauf*.

## Prüfen, ob er läuft

```sql
select * from cron.job where jobname = 'abnahmefrist-taeglich';
select * from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'abnahmefrist-taeglich')
 order by start_time desc limit 10;

-- Verträge, die auf ihre automatische Freigabe warten:
select count(*) from public.abnahme_faellige_vertraege(500);
```

Steht die letzte Zahl über Tage hinweg still oben, läuft der Auftrag nicht.
