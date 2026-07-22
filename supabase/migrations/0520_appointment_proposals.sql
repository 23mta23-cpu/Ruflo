-- 0520: Terminvorschläge im Chat annehmen/ablehnen (Founder-Wunsch 22.07.)
--
-- Bisher: der Anbieter schlägt EINEN Wunschtermin im Angebot vor (offers.
-- scheduled_at → jobs.scheduled_at bei Annahme). Es gab keine Aushandlung.
-- Neu: beide Parteien können im (job, provider)-Thread einen Termin vorschlagen,
-- die Gegenseite nimmt an oder lehnt ab. Bei Annahme wird jobs.scheduled_at
-- gesetzt und eine System-Nachricht in den Chat geschrieben.
--
-- Server-autoritativ über zwei security-definer-RPCs (kein direktes Insert/
-- Update-Recht) — der Client kann Status/Termin nicht fälschen.

-- Nachrichtentyp: normaler Text, System-Ereignis, oder Terminvorschlag.
alter table public.messages
  add column if not exists type text not null default 'text'
    check (type in ('text', 'system', 'appointment'));

create table if not exists public.appointment_proposals (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  provider_id  uuid not null references public.profiles(id),  -- Thread-Anbieter
  proposed_by  uuid not null references public.profiles(id),  -- wer vorgeschlagen hat
  proposed_at  timestamptz not null,                          -- der Wunschtermin
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'rejected', 'superseded')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_appt_job_provider
  on public.appointment_proposals(job_id, provider_id);

alter table public.appointment_proposals enable row level security;

-- Nur Thread-Parteien lesen; geschrieben wird ausschließlich über die RPCs.
drop policy if exists appt_select on public.appointment_proposals;
create policy appt_select on public.appointment_proposals
  for select using (
    auth.uid() = provider_id
    or auth.uid() = (select customer_id from public.jobs where id = job_id)
  );

-- ── propose_appointment: Termin vorschlagen ──────────────────────────────────
create or replace function public.propose_appointment(
  p_job_id uuid, p_provider_id uuid, p_when timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_cust uuid;
  v_role text;
  v_id   uuid;
begin
  select customer_id into v_cust from public.jobs where id = p_job_id;
  -- Aufrufer muss Partei des (job, provider)-Threads sein.
  if v_uid <> p_provider_id and v_uid <> v_cust then
    raise exception 'Not a party to this conversation';
  end if;
  -- Anbieter-Zweig: dieselbe Eignung wie beim Nachrichten-Insert (0510) —
  -- sonst könnte sich jeder über p_provider_id = eigene id als „Anbieter"
  -- ausgeben. Verifiziert, nicht gesperrt, Track passend.
  if v_uid = p_provider_id and v_uid <> v_cust then
    if not auth_email_confirmed() then
      raise exception 'Email not verified';
    end if;
    if exists (select 1 from public.provider_profiles pp
               where pp.id = v_uid and pp.strike_count >= 3) then
      raise exception 'Account suspended';
    end if;
    if not exists (
      select 1 from public.jobs j
      where j.id = p_job_id
        and (
          j.track = 'nachbarschaft'
          or not exists (
            select 1 from public.provider_profiles pp
            where pp.id = v_uid and pp.is_nachbarschaft
          )
        )
    ) then
      raise exception 'Track not allowed for this provider';
    end if;
  end if;
  if p_when <= now() then
    raise exception 'Appointment must be in the future';
  end if;

  v_role := case when v_uid = p_provider_id then 'provider' else 'customer' end;

  insert into public.appointment_proposals (job_id, provider_id, proposed_by, proposed_at)
    values (p_job_id, p_provider_id, v_uid, p_when)
    returning id into v_id;

  insert into public.messages (job_id, sender_id, sender_role, body, provider_id, type)
    values (p_job_id, v_uid, v_role,
            'Terminvorschlag: ' || to_char(p_when at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI'),
            p_provider_id, 'appointment');

  return v_id;
end;
$$;

-- ── respond_appointment: annehmen/ablehnen (nur die Gegenseite) ──────────────
create or replace function public.respond_appointment(
  p_proposal_id uuid, p_accept boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_prop public.appointment_proposals;
  v_cust uuid;
  v_role text;
begin
  -- for update: serialisiert konkurrierende Antworten (Doppel-Tap / zwei Geräte),
  -- damit der pending-Guard nicht von beiden Transaktionen passiert wird.
  select * into v_prop from public.appointment_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_prop.status <> 'pending' then raise exception 'Proposal already resolved'; end if;

  select customer_id into v_cust from public.jobs where id = v_prop.job_id;
  -- Aufrufer muss Thread-Partei UND die Gegenseite (nicht der Vorschlagende) sein.
  if v_uid <> v_prop.provider_id and v_uid <> v_cust then
    raise exception 'Not a party to this conversation';
  end if;
  if v_uid = v_prop.proposed_by then
    raise exception 'Cannot respond to your own proposal';
  end if;

  v_role := case when v_uid = v_prop.provider_id then 'provider' else 'customer' end;

  update public.appointment_proposals
     set status = case when p_accept then 'accepted' else 'rejected' end
   where id = p_proposal_id;

  if p_accept then
    -- Den globalen Job-Termin NUR setzen, wenn dieser Thread der Vertrags-Thread
    -- ist (zugewiesener Anbieter). Vor Vertragsschluss ist die Zusage eine reine
    -- Chat-Abstimmung und darf den Job-Termin nicht aus einem von mehreren
    -- konkurrierenden Anbieter-Threads überschreiben (Review-Befund K1).
    update public.jobs set scheduled_at = v_prop.proposed_at
      where id = v_prop.job_id and provider_id = v_prop.provider_id;
    -- Andere offene Vorschläge desselben Threads sind damit überholt.
    update public.appointment_proposals set status = 'superseded'
      where job_id = v_prop.job_id and provider_id = v_prop.provider_id
        and status = 'pending' and id <> p_proposal_id;
    insert into public.messages (job_id, sender_id, sender_role, body, provider_id, type)
      values (v_prop.job_id, v_uid, v_role,
              'Termin bestätigt: ' || to_char(v_prop.proposed_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI'),
              v_prop.provider_id, 'system');
  else
    insert into public.messages (job_id, sender_id, sender_role, body, provider_id, type)
      values (v_prop.job_id, v_uid, v_role, 'Terminvorschlag abgelehnt',
              v_prop.provider_id, 'system');
  end if;
end;
$$;

revoke all on function public.propose_appointment(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.respond_appointment(uuid, boolean) from public, anon;
grant execute on function public.propose_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.respond_appointment(uuid, boolean) to authenticated;
