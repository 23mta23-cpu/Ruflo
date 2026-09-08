-- Der Hinweis nach § 640 Abs. 2 Satz 2 BGB ohne Gedankenstrich, Fassung v2.
--
-- ANLASS: Founder-Anweisung vom 07.09.2026, keine Gedankenstriche in Texten,
-- die ein Nutzer liest. Dieser hier ist mir zunaechst entgangen, weil
-- scripts/gedankenstrich-check.py `supabase/migrations/` nicht gelesen hat.
-- Die Luecke ist mit dieser Aenderung geschlossen (der Pruefer deckt
-- Migrationen jetzt mit ab).
--
-- WARUM EINE EIGENE MIGRATION UND EINE NEUE FASSUNGSKENNUNG:
-- `contracts.abnahme_hinweis` haelt den WORTLAUT fest, der diesem Kunden
-- gezeigt wurde, `abnahme_hinweis_fassung` sagt, welche Fassung das war. Der
-- Hinweis ist die Voraussetzung dafuer, dass die Abnahmefiktion nach
-- § 640 Abs. 2 BGB ueberhaupt eintritt; im Streitfall wird genau dieser Text
-- vorgelegt. Zwei verschiedene Wortlaute unter derselben Kennung wuerden den
-- Nachweis entwerten, auch wenn nur ein Satzzeichen abweicht.
--
-- Inhaltlich unveraendert: dieselbe Frist, dieselbe Folge, dieselbe Norm.
-- Geaendert ist ein Gedankenstrich zu einem Punkt.
--
-- Bereits gespeicherte Hinweise bleiben unangetastet. Sie tragen v1 und sind
-- damit weiterhin dem Wortlaut zuordenbar, der ihnen gezeigt wurde.

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
    || 'im Auftrag. Solange er offen ist, läuft keine Frist gegen Sie und das Geld '
    || 'bleibt liegen.';

  update public.contracts
     set fertig_gemeldet_am      = now(),
         abnahme_faellig_am      = v_faellig,
         abnahme_hinweis         = v_text,
         abnahme_hinweis_fassung = '640-2-v2'
   where id = p_contract_id
   returning * into v_c;

  return v_c;
end;
$$;

-- Rechte neu setzen: 0820 hat das Ausfuehrungsrecht per Voreinstellung
-- entzogen. Nach einem `create or replace` darauf zu vertrauen, dass die alte
-- Rechteliste haengen bleibt, waere geraten statt gewusst -- und ohne dieses
-- Recht koennte kein Betrieb mehr die Fertigstellung melden.
revoke execute on function public.fertigstellung_melden(uuid) from public;
grant execute on function public.fertigstellung_melden(uuid) to authenticated;
