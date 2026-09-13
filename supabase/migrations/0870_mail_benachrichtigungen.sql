-- E-Mail als Rueckfallweg, wenn kein Push moeglich ist.
--
-- ANLASS (Selbst-Check 12.09.2026 gegen die Founder-Frage): Der Founder fragte
-- nach Benachrichtigungen, "wenn eine Anfrage reinkommt, angenommen wird".
-- Ich hatte geantwortet, dafuer gebe es neun Push-Ausloeser -- und dabei
-- uebersehen, was das in der Praxis bedeutet:
--
--   supabase/functions/send-push/index.ts:
--     if (!token) return { sent: false, reason: "no_token" };
--
-- Push wird auf dem Web gar nicht registriert (lib/notifications.ts gibt bei
-- Platform.OS === 'web' sofort auf). Fuer JEDEN Nutzer der heute live
-- stehenden Web-App landen damit ALLE neun Ausloeser in diesem stillen
-- Rueckgabewert. Die Benachrichtigungen existieren im Code und erreichen
-- niemanden.
--
-- Der Rueckfallweg braucht eine Einwilligung, die der Server SEHEN kann. Die
-- bestehende Push-Abschaltung liegt in AsyncStorage (werkr_prefs_v1) auf dem
-- Geraet; sie setzt profiles.push_token auf null. „Kein Token" heisst deshalb
-- ZWEIERLEI: Web-Nutzer oder bewusst abgeschaltet. Ohne diese Spalte wuerde
-- der Rueckfall genau denen mailen, die Benachrichtigungen abbestellt haben.

alter table public.profiles
  add column if not exists mail_benachrichtigungen boolean not null default true;

comment on column public.profiles.mail_benachrichtigungen is
  'Darf Werkant Vorgangsmails schicken (Angebot erhalten, angenommen, Zahlung frei), wenn kein Push moeglich ist? Standard an. Pflichtmitteilungen nach AGB §7(4) und DSA Art. 17 gehen unabhaengig davon raus -- die schuldet Werkant, sie sind nicht abbestellbar.';

-- Der Spalten-Waechter aus 0050 darf sie nicht blockieren: sie gehoert dem
-- Nutzer. Geprueft wird, ob der Trigger sie ueberhaupt kennt; steht sie nicht
-- in seiner Sperrliste, ist nichts zu tun.
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'prevent_profile_field_escalation';
  if v_def is not null and v_def ilike '%mail_benachrichtigungen%' then
    raise exception 'mail_benachrichtigungen steht in der Sperrliste des Profil-Waechters';
  end if;
end $$;
