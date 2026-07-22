-- 0570: Kundenadresse (Straße) erst nach Vergabe sichtbar (Security-Befund M1)
--
-- Bisher: die Policy „Providers browse open jobs" (0410/0470) gibt jedem
-- verifizierten Anbieter die VOLLE offene Job-Zeile inkl. jobs.address_street.
-- RLS ist zeilen-, nicht spaltenweise → jeder Bieter konnte die Straße des
-- Kunden VOR der Vergabe auslesen (Privacy, mittel).
--
-- Fix ohne Umbau der Browse-Queries: die Straße in eine separate Tabelle mit
-- enger RLS auslagern (nur Auftrags-Kunde + ZUGEWIESENER Anbieter) und aus
-- jobs entfernen. Browse liest jobs weiter (jetzt ohne Straße); Stadt/PLZ
-- bleiben für die Regionsanzeige öffentlich.

create table if not exists public.job_addresses (
  job_id         uuid primary key references public.jobs(id) on delete cascade,
  address_street text,
  created_at     timestamptz not null default now()
);

alter table public.job_addresses enable row level security;

-- Lesen: Kunde des Auftrags ODER der zugewiesene Anbieter (jobs.provider_id).
drop policy if exists "job_address read parties" on public.job_addresses;
create policy "job_address read parties" on public.job_addresses
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );

-- Schreiben/Ändern: nur der Auftrags-Kunde.
drop policy if exists "job_address customer insert" on public.job_addresses;
create policy "job_address customer insert" on public.job_addresses
  for insert with check (
    exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
  );
drop policy if exists "job_address customer update" on public.job_addresses;
create policy "job_address customer update" on public.job_addresses
  for update using (
    exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
  );

grant select, insert, update on public.job_addresses to authenticated;

-- Bestehende Straßen migrieren + Spalte aus jobs entfernen (idempotent: nur
-- solange die Spalte noch existiert).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'address_street'
  ) then
    insert into public.job_addresses (job_id, address_street)
      select id, address_street from public.jobs where address_street is not null
      on conflict (job_id) do nothing;
    alter table public.jobs drop column address_street;
  end if;
end $$;
