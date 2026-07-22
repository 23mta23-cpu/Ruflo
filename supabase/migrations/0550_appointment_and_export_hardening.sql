-- 0550: Härtung nach Pentest — L2 (propose_appointment Kunden-Zweig)
--
-- Security-Befund L2: Im Kunden-Zweig von propose_appointment fehlte die
-- Prüfung, dass p_provider_id überhaupt am Auftrag beteiligt ist. Ein Kunde
-- konnte die RPC mit beliebiger Profil-UUID aufrufen und so eine
-- 'appointment'-Nachricht (Definer umgeht die messages-Insert-Policy) an einen
-- unbeteiligten Nutzer erzeugen — unsolicited Kontakt. Jetzt verlangt der
-- Kunden-Zweig einen bestehenden Bezug: ein Angebot ODER einen Nachrichten-
-- Thread des (job, provider)-Paares.

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
  -- Anbieter-Zweig: dieselbe Eignung wie beim Nachrichten-Insert (0510).
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
  -- Kunden-Zweig (L2): der vorgeschlagene Anbieter muss am Auftrag beteiligt
  -- sein (Angebot oder bestehender Thread) — kein unsolicited Kontakt.
  if v_uid = v_cust and v_uid <> p_provider_id then
    if not exists (select 1 from public.offers
                   where job_id = p_job_id and provider_id = p_provider_id)
       and not exists (select 1 from public.messages
                       where job_id = p_job_id and provider_id = p_provider_id) then
      raise exception 'No conversation with this provider';
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
