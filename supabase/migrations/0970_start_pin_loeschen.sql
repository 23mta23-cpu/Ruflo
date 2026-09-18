-- 0970: Eine Zahl, die niemand mehr braucht, gehoert weg.
--
-- ANLASS (Selbst-Check 18.09.2026, am eigenen Werk). In 0960 ist die Start-PIN
-- bewusst als ZUGANGSMITTEL behandelt: sie steht deshalb NICHT in der Auskunft
-- nach Art. 15 DSGVO, sondern unter `nicht_enthalten`, mit derselben
-- Begruendung wie bei `email_verifications` -- eine Auskunftsdatei wird
-- weitergeleitet und abgelegt.
--
-- Dieselbe Zahl blieb danach aber fuer immer in der Tabelle stehen. Beides
-- zusammen geht nicht: was heikel genug ist, um es aus einer Datei
-- herauszuhalten, ist heikel genug, um es zu loeschen, sobald es seinen Zweck
-- erfuellt hat (Art. 5 Abs. 1 lit. c, Datenminimierung; Art. 17 Abs. 1 lit. a).
--
-- Verschaerfend: `delete-account` loescht `contracts` NICHT (HGB § 257, zehn
-- Jahre Aufbewahrung der Finanzbelege), und `vertrag_start_pins` haengt per
-- Fremdschluessel daran. Die Zahl haette ein geloeschtes Konto um zehn Jahre
-- ueberlebt.
--
-- WAS BLEIBT, und warum: `eingeloest_am`, `fehlversuche` und `gesperrt_bis`.
-- Das ist der BELEG, um dessentwillen die ganze Funktion existiert -- wann die
-- Arbeit begonnen hat und ob jemand es dreimal falsch versucht hat. Der Beleg
-- braucht die Zahl nicht, nur ihr Ergebnis.

-- Die Zahl darf jetzt fehlen. NULL heisst: erfuellt ihren Zweck nicht mehr.
alter table public.vertrag_start_pins
  alter column pin drop not null;

comment on column public.vertrag_start_pins.pin is
  'Die vierstellige Zahl, solange sie gebraucht wird. NULL heisst eingeloest oder Vertrag beendet -- dann ist sie geloescht, weil ein Zugangsmittel ohne Zweck nicht aufbewahrt wird (Art. 5 Abs. 1 lit. c DSGVO).';

-- ── Beim Einloesen ─────────────────────────────────────────────────────────
-- `arbeit_beginnen` haelt das Ergebnis fest und wirft die Zahl weg. Ab hier
-- belegt `eingeloest_am` alles, was zu belegen ist.
create or replace function public.arbeit_beginnen(p_vertrag uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zeile   public.vertrag_start_pins%rowtype;
  v_kunde   uuid;
  v_begonn  timestamptz;
begin
  select c.customer_id, c.arbeit_begonnen_am into v_kunde, v_begonn
    from public.contracts c
   where c.id = p_vertrag and c.provider_id = auth.uid();
  if not found then
    -- Bewusst derselbe Zustand fuer "gibt es nicht" und "gehoert einem
    -- anderen": sonst liesse sich ueber die Antwort herausfinden, welche
    -- Vertragskennungen existieren.
    return 'nicht_berechtigt';
  end if;

  if v_begonn is not null then
    return 'schon_begonnen';
  end if;

  select * into v_zeile from public.vertrag_start_pins
   where contract_id = p_vertrag for update;
  if not found or v_zeile.pin is null then
    -- Seit 0970 ist NULL ein eigener Fall: die Zahl wurde geloescht, weil sie
    -- ihren Zweck erfuellt hat oder der Vertrag beendet ist.
    return 'keine_pin';
  end if;

  if v_zeile.gesperrt_bis is not null and v_zeile.gesperrt_bis > now() then
    return 'gesperrt';
  end if;

  if v_zeile.gesperrt_bis is not null and v_zeile.gesperrt_bis <= now() then
    update public.vertrag_start_pins
       set fehlversuche = 0, gesperrt_bis = null
     where contract_id = p_vertrag;
    v_zeile.fehlversuche := 0;
  end if;

  if v_zeile.pin <> coalesce(p_pin, '') then
    update public.vertrag_start_pins
       set fehlversuche = v_zeile.fehlversuche + 1,
           gesperrt_bis = case when v_zeile.fehlversuche + 1 >= 3
                               then now() + interval '15 minutes' end
     where contract_id = p_vertrag;

    if v_zeile.fehlversuche + 1 >= 3 then
      perform public.benachrichtigung_anlegen(
        v_kunde,
        'system',
        'Dreimal die falsche Start-PIN',
        'Bei Ihrem Auftrag wurde dreimal eine falsche Start-PIN eingegeben. '
        || 'Die Eingabe ist jetzt fuer 15 Minuten gesperrt. Wenn Sie die Zahl '
        || 'niemandem genannt haben, melden Sie sich bitte bei uns, bevor Sie '
        || 'jemanden hereinlassen.',
        '/vertrag?contractId=' || p_vertrag::text,
        'contracts',
        p_vertrag,
        false
      );
      -- Der dritte Fehlversuch ist zugleich der Moment der Sperre. 'falsch'
      -- zurueckzugeben waere zwar wahr, liesse die App aber sagen "noch ein
      -- Versuch", obwohl keiner mehr kommt.
      return 'gesperrt';
    end if;
    return 'falsch';
  end if;

  -- Richtig. Ergebnis festhalten, Zahl loeschen (0970).
  update public.vertrag_start_pins
     set fehlversuche = 0, gesperrt_bis = null, eingeloest_am = now(),
         pin = null
   where contract_id = p_vertrag;
  update public.contracts
     set arbeit_begonnen_am = now()
   where id = p_vertrag;
  return 'ok';
end;
$$;

revoke execute on function public.arbeit_beginnen(uuid, text) from public, anon, authenticated;
grant execute on function public.arbeit_beginnen(uuid, text) to authenticated;

-- ── Beim Ende des Vertrags ─────────────────────────────────────────────────
-- Abgeschlossen oder storniert: die Zahl wird nie wieder gebraucht. Auch dann
-- nicht, wenn sie nie eingeloest wurde -- ein Auftrag, der vorbei ist, faengt
-- nicht mehr an.
create or replace function public.start_pin_aufraeumen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('completed', 'cancelled')
     and new.status is distinct from old.status then
    update public.vertrag_start_pins
       set pin = null
     where contract_id = new.id and pin is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_start_pin_aufraeumen on public.contracts;
create trigger trg_start_pin_aufraeumen
  after update on public.contracts
  for each row execute function public.start_pin_aufraeumen();

revoke execute on function public.start_pin_aufraeumen() from public, anon, authenticated;

comment on function public.start_pin_aufraeumen() is
  'Loescht die Start-PIN, sobald der Vertrag abgeschlossen oder storniert ist. Der Beleg (eingeloest_am, fehlversuche) bleibt.';

-- ── Bestand ────────────────────────────────────────────────────────────────
-- Vertraege, die schon vorbei sind, tragen ihre Zahl sonst weiter. Idempotent:
-- ein zweiter Lauf findet nichts mehr.
--
-- GRENZE, ausdruecklich: dieser Nachzug ist von `scripts/db-test/run.sh` NICHT
-- gedeckt. Die Harness legt jeden Vertrag frisch an, also gibt es dort keinen
-- Bestand, den er treffen koennte -- die Mutation „Bestand wird nicht
-- nachgezogen" bleibt gemessen gruen. Er wirkt nur gegen echte Daten.
update public.vertrag_start_pins p
   set pin = null
  from public.contracts c
 where c.id = p.contract_id
   and p.pin is not null
   and (c.status in ('completed', 'cancelled') or c.arbeit_begonnen_am is not null);
