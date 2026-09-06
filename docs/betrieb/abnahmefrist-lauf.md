# Der geplante Lauf für die Abnahmefrist

**Was er tut:** Einmal täglich die Verträge holen, bei denen die fiktive
Abnahme nach § 640 Abs. 2 BGB eingetreten ist, und für jeden `release-escrow`
aufrufen. Ohne diesen Lauf passiert die automatische Freigabe **nicht** — die
Datenbank kennt die Frist, aber sie führt von sich aus kein Geld ab.

## Einrichten in Supabase (einmalig, vor dem Start)

Voraussetzung: `Werkant_ADMIN_SECRET` ist als Edge-Function-Secret gesetzt
(dasselbe, das `pstg-annual-report` benutzt).

```sql
-- Im SQL-Editor des Projekts, als postgres.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'abnahmefrist-taeglich',
  '0 4 * * *',                      -- 04:00 UTC, also nachts in Köln
  $$
  select net.http_post(
           url     := 'https://<projekt>.supabase.co/functions/v1/release-escrow',
           headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'x-admin-secret', current_setting('app.werkant_admin_secret', true)),
           body    := jsonb_build_object('contract_id', v.contract_id))
    from public.abnahme_faellige_vertraege(200) v;
  $$
);
```

Das Secret gehört **nicht** in den Cron-Text. Einmalig setzen mit
`alter database postgres set app.werkant_admin_secret = '…';` — dann steht es
in den Datenbank-Einstellungen und nicht im Klartext im Auftragsplan, den
jeder mit SQL-Zugriff lesen kann.

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
