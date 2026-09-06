-- ═══════════════════════════════════════════════════════════════════════════
-- Abnahmefrist und fiktive Abnahme nach § 640 Abs. 2 BGB
--
-- ANLASS (06.09.2026): Die Gründungspartner-Seite versprach an zwei Stellen
-- "Meldet er sich nicht, läuft die Frist ab und die Freigabe erfolgt
-- automatisch — Schweigen ist kein Druckmittel gegen Sie." Es gab davon
-- nichts: release-escrow weist jeden ab, der nicht der Kunde ist, es gab
-- keinen Zeitplan, keine Fristspalte und nicht einmal einen Startpunkt — der
-- Anbieter konnte Fertigstellung gar nicht melden. Bleibt der Kunde still,
-- lag das Geld dauerhaft fest: schlechter als eine offene Rechnung, wo der
-- Handwerker wenigstens mahnen könnte.
--
-- RECHTSGRUNDLAGE, und warum sie den Bauplan bestimmt
-- § 640 Abs. 2 Satz 1 BGB: Als abgenommen gilt ein Werk auch, wenn der
-- Unternehmer dem Besteller nach Fertigstellung eine ANGEMESSENE FRIST zur
-- Abnahme gesetzt hat und der Besteller die Abnahme nicht innerhalb dieser
-- Frist UNTER ANGABE MINDESTENS EINES MANGELS verweigert hat.
-- § 640 Abs. 2 Satz 2 BGB: Ist der Besteller ein Verbraucher, gilt das nur,
-- wenn der Unternehmer ihn zusammen mit der Fristsetzung auf die Folgen einer
-- nicht erklärten oder ohne Angabe von Mängeln verweigerten Abnahme
-- HINGEWIESEN hat; der Hinweis muss in TEXTFORM erfolgen.
--
-- Daraus folgen drei Dinge, die hier hart verdrahtet sind:
--   1. Ohne gemeldete Fertigstellung läuft keine Frist.
--   2. Ohne gespeicherten Hinweistext gibt es KEINE fiktive Abnahme. Der
--      Hinweis ist Tatbestandsmerkmal, nicht Höflichkeit.
--   3. Ein gemeldeter Mangel hält die Frist an. `disputes.description`
--      verlangt bereits mindestens 30 Zeichen — das IST die "Angabe
--      mindestens eines Mangels".
--
-- Der Wortlaut wird gespeichert, nicht nur ein Häkchen. Dieselbe Lehre wie
-- bei den Widerrufs-Zustimmungen (0710): ein Haken, der einen Knopf
-- freischaltet und mit dem Bildschirm verschwindet, ist im Streitfall
-- unbeweisbar. Festzuhalten ist der Text samt Fassungskennung.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Frist ──────────────────────────────────────────────────────────────────
-- 14 Tage. "Angemessen" im Sinne des § 640 Abs. 2 ist einzelfallabhängig;
-- für Verbraucher-Werkverträge dieser Größenordnung sind zwei Wochen
-- deutlich auf der sicheren Seite. Als Funktion und nicht als verstreute
-- Zahl, damit eine Änderung an EINER Stelle passiert.
create or replace function public.abnahme_frist_tage()
returns integer language sql immutable as $$ select 14 $$;

comment on function public.abnahme_frist_tage is
  'Länge der Abnahmefrist in Tagen (§ 640 Abs. 2 BGB, "angemessene Frist").';

alter table public.contracts
  add column if not exists fertig_gemeldet_am      timestamptz,
  add column if not exists abnahme_faellig_am      timestamptz,
  add column if not exists abnahme_hinweis         text,
  add column if not exists abnahme_hinweis_fassung text,
  add column if not exists abnahme_fiktiv_am       timestamptz;

comment on column public.contracts.fertig_gemeldet_am is
  'Wann der Anbieter die Fertigstellung gemeldet hat. Startpunkt der Abnahmefrist.';
comment on column public.contracts.abnahme_faellig_am is
  'Ende der Abnahmefrist. Danach ist die fiktive Abnahme möglich (§ 640 Abs. 2 BGB).';
comment on column public.contracts.abnahme_hinweis is
  'WORTLAUT des Hinweises nach § 640 Abs. 2 Satz 2 BGB, wie er dem Kunden gezeigt wurde. Tatbestandsmerkmal — ohne ihn keine fiktive Abnahme. Nicht nur ein Häkchen (Lehre aus 0710).';
comment on column public.contracts.abnahme_hinweis_fassung is
  'Fassungskennung des Hinweistextes, damit später nachvollziehbar ist, welche Formulierung galt.';
comment on column public.contracts.abnahme_fiktiv_am is
  'Gesetzt, wenn die Auszahlung über die fiktive Abnahme lief und nicht über eine ausdrückliche Freigabe des Kunden.';

-- Der geplante Lauf sucht ausschliesslich faellige Vertraege. Ohne diesen
-- Index waere das ein Seq Scan ueber alle Vertraege, jede Stunde.
create index if not exists idx_contracts_abnahme_faellig
  on public.contracts (abnahme_faellig_am)
  where status = 'active' and escrow_released_at is null;

-- ── Fertigstellung melden ──────────────────────────────────────────────────
-- Nur der Anbieter des Vertrags. Setzt die Frist und hält den Hinweistext
-- fest. Idempotent: ein zweiter Aufruf verlängert die Frist NICHT — sonst
-- könnte ein Anbieter durch wiederholtes Melden den Kunden zermürben, und
-- umgekehrt eine versehentliche Doppelmeldung die Frist ungewollt schieben.
create or replace function public.fertigstellung_melden(p_contract_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c       public.contracts%rowtype;
  v_faellig timestamptz;
  v_text    text;
begin
  select * into v_c from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'contract_not_found' using errcode = 'P0002'; end if;

  if v_c.provider_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_c.status <> 'active' then
    raise exception 'contract_not_active' using errcode = 'P0001';
  end if;
  if v_c.escrow_captured_at is null then
    -- Ohne hinterlegtes Geld ist die Fertigstellungsmeldung sinnlos: am Ende
    -- der Frist gäbe es nichts auszuzahlen.
    raise exception 'escrow_not_captured' using errcode = 'P0001';
  end if;

  if v_c.fertig_gemeldet_am is not null then
    return v_c;  -- schon gemeldet, Frist bleibt wie sie ist
  end if;

  v_faellig := now() + (public.abnahme_frist_tage() || ' days')::interval;

  -- Der Hinweis nach § 640 Abs. 2 Satz 2 BGB. Er muss die FOLGE ausdrücklich
  -- benennen — ein blosses "bitte freigeben" genügt dem Gesetz nicht.
  v_text :=
    'Der Betrieb hat die Fertigstellung gemeldet. Bitte sehen Sie sich die Arbeit an. '
    || 'Wenn Sie bis zum ' || to_char(v_faellig at time zone 'Europe/Berlin', 'DD.MM.YYYY')
    || ' weder die Abnahme erklären noch einen Mangel benennen, gilt die Arbeit nach '
    || '§ 640 Absatz 2 BGB als abgenommen. Das hinterlegte Geld wird dann an den '
    || 'Betrieb ausgezahlt. Wenn etwas nicht in Ordnung ist, melden Sie den Mangel '
    || 'im Auftrag — solange er offen ist, läuft keine Frist gegen Sie und das Geld '
    || 'bleibt liegen.';

  update public.contracts
     set fertig_gemeldet_am      = now(),
         abnahme_faellig_am      = v_faellig,
         abnahme_hinweis         = v_text,
         abnahme_hinweis_fassung = '640-2-v1'
   where id = p_contract_id
   returning * into v_c;

  return v_c;
end;
$$;

comment on function public.fertigstellung_melden is
  'Anbieter meldet Fertigstellung: setzt die Abnahmefrist und hält den Hinweistext nach § 640 Abs. 2 Satz 2 BGB fest. Idempotent — verlängert eine laufende Frist nicht.';

revoke all on function public.fertigstellung_melden(uuid) from public;
grant execute on function public.fertigstellung_melden(uuid) to authenticated;

-- ── Ist die fiktive Abnahme eingetreten? ───────────────────────────────────
-- Eine Stelle, an der die Voraussetzungen des § 640 Abs. 2 stehen. Sowohl der
-- geplante Lauf als auch payout_claim fragen HIER, damit die Liste der
-- fälligen Verträge und die tatsächliche Berechtigung nicht auseinanderlaufen
-- können.
create or replace function public.abnahme_fiktiv_eingetreten(p_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    c.status = 'active'
    and c.escrow_captured_at is not null
    and c.escrow_released_at is null
    and coalesce(c.customer_refunded_amount, 0) = 0
    and c.dispute_state is distinct from 'open'
    and c.dispute_state is distinct from 'lost'
    -- Satz 1: Fertigstellung gemeldet und Frist gesetzt und abgelaufen.
    and c.fertig_gemeldet_am is not null
    and c.abnahme_faellig_am is not null
    and c.abnahme_faellig_am <= now()
    -- Satz 2: ohne belegten Hinweis in Textform tritt die Wirkung NICHT ein.
    and c.abnahme_hinweis is not null
    -- Satz 1: "unter Angabe mindestens eines Mangels verweigert" —
    -- ein offener Mangel hält die Wirkung auf.
    and not exists (
      select 1 from public.disputes d
       where d.contract_id = c.id and d.status <> 'resolved'
    )
  from public.contracts c
  where c.id = p_contract_id;
$$;

comment on function public.abnahme_fiktiv_eingetreten is
  'Prüft die Voraussetzungen des § 640 Abs. 2 BGB für EINEN Vertrag. Einzige Wahrheitsquelle — der geplante Lauf und payout_claim fragen beide hier.';

-- ── Fällige Verträge für den geplanten Lauf ────────────────────────────────
create or replace function public.abnahme_faellige_vertraege(p_limit integer default 100)
returns table (contract_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.contracts c
   where c.status = 'active'
     and c.escrow_released_at is null
     and c.abnahme_faellig_am is not null
     and c.abnahme_faellig_am <= now()
     and public.abnahme_fiktiv_eingetreten(c.id)
   order by c.abnahme_faellig_am
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

comment on function public.abnahme_faellige_vertraege is
  'Verträge, bei denen die fiktive Abnahme eingetreten ist. Nur für den geplanten Lauf (service_role).';

revoke all on function public.abnahme_faellige_vertraege(integer) from public, anon, authenticated;

-- ── payout_claim: zweiter zulässiger Weg ───────────────────────────────────
-- Bisher galt ausschliesslich "der Aufrufer ist der Kunde". Der automatische
-- Weg hat keinen Aufrufer — seine Berechtigung ist die abgelaufene Frist.
--
-- Bewusst ein AUSDRÜCKLICHER Parameter statt "p_caller ist null": ein still
-- durchgereichtes null (etwa eine undefinierte user.id in der Edge Function)
-- würde sonst unbemerkt den automatischen Weg freischalten. Ein Weg, der sich
-- versehentlich öffnen lässt, ist keine Schranke.
--
-- Der 2-Argument-Aufruf aus release-escrow bleibt unverändert gültig: er
-- trifft dieselbe Funktion mit p_fiktive_abnahme = false.
drop function if exists public.payout_claim(uuid, uuid);

create or replace function public.payout_claim(
  p_contract_id     uuid,
  p_caller          uuid,
  p_fiktive_abnahme boolean default false
)
returns public.payout_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c      public.contracts%rowtype;
  v_ziel   text;
  v_betrag integer;
  v_op     public.payout_operations;
begin
  select * into v_c from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'contract_not_found' using errcode = 'P0002'; end if;

  if p_fiktive_abnahme then
    -- Kein Aufrufer erlaubt: wer sich ausweisen kann, geht den normalen Weg.
    -- Sonst liesse sich über diesen Zweig die Eigentumsprüfung umgehen.
    if p_caller is not null then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    -- Innerhalb DERSELBEN Transaktion und unter derselben Zeilensperre wie
    -- die Auszahlung. Zwischen "Liste der fälligen Verträge" und diesem
    -- Punkt kann der Kunde noch einen Mangel gemeldet haben — dann greift
    -- die Prüfung hier und nicht die veraltete Liste.
    if not public.abnahme_fiktiv_eingetreten(p_contract_id) then
      raise exception 'abnahme_nicht_eingetreten' using errcode = 'P0001';
    end if;
  else
    if v_c.customer_id is distinct from p_caller then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
  end if;

  if v_c.status <> 'active' then
    raise exception 'contract_not_active' using errcode = 'P0001';
  end if;
  if v_c.escrow_captured_at is null then
    raise exception 'escrow_not_captured' using errcode = 'P0001';
  end if;
  if v_c.escrow_released_at is not null then
    raise exception 'already_released' using errcode = 'P0001';
  end if;
  if coalesce(v_c.customer_refunded_amount, 0) > 0 then
    raise exception 'already_refunded' using errcode = 'P0001';
  end if;
  if v_c.dispute_state = 'open' then
    raise exception 'dispute_open' using errcode = 'P0001';
  end if;

  select stripe_account_id into v_ziel
    from public.provider_profiles where id = v_c.provider_id;
  if v_ziel is null or v_ziel = '' then
    raise exception 'provider_without_stripe_account' using errcode = 'P0001';
  end if;

  v_betrag := (round(v_c.provider_payout::numeric, 2) * 100)::integer;
  if v_betrag <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  -- Festhalten, dass diese Auszahlung ohne ausdrückliche Freigabe lief. Für
  -- den Beleg und für jede spätere Rückfrage des Kunden.
  if p_fiktive_abnahme and v_c.abnahme_fiktiv_am is null then
    update public.contracts set abnahme_fiktiv_am = now() where id = p_contract_id;
  end if;

  insert into public.payout_operations (
    contract_id, amount_cents, currency, destination_account_id,
    idempotency_key, transfer_group, attempt_count
  ) values (
    p_contract_id, v_betrag, 'eur', v_ziel,
    'payout-op-' || p_contract_id::text, p_contract_id::text, 1
  )
  on conflict (contract_id) do update
    set attempt_count = public.payout_operations.attempt_count + 1,
        updated_at    = now()
  returning * into v_op;

  return v_op;
end;
$$;

comment on function public.payout_claim is
  'Beansprucht die Auszahlung eines Vertrags atomar. Zwei zulässige Wege: der Kunde selbst (p_caller), oder die fiktive Abnahme nach § 640 Abs. 2 BGB (p_fiktive_abnahme, dann OHNE Aufrufer). Prüft alle Bedingungen erneut in der Transaktion. Finalisiert NICHT.';

revoke all on function public.payout_claim(uuid, uuid, boolean) from public, anon, authenticated;
