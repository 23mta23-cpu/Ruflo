-- 0910: Ein Angebot unter der Mindestgebuehr ergibt eine NEGATIVE Auszahlung.
--
-- ANLASS (14.09.2026): Beim Umstellen von `calcPlatformFee` auf den echten
-- Code fielen zwei Eigenschafts-Tests um, die seit jeher richtig waren:
--
--     "never produces a negative fee or net for non-negative inputs"
--     "fee is always less than or equal to the gross amount"
--
-- Der Grund ist der Mindestbetrag von 3,00 EUR (feeEngine, und in 0530 als
-- `greatest(v_price * 0.08, 3.00)`):
--
--     Auftragswert  2,00 EUR  ->  Gebuehr 3,00  ->  Auszahlung -1,00
--
-- Der Anbieter zahlte fuer seine Arbeit. App und Datenbank rechnen gleich,
-- der Fehler ist also konsistent und damit umso leiser.
--
-- WAS SCHON DA IST: `chk_offers_price_positive` (0040) verlangt `price > 0`.
-- Negative Preise und Null sind also seit jeher abgewiesen.
--
-- Ich hatte das zunaechst ANDERS behauptet: beim ersten Hinsehen stand in
-- meiner Notiz, offers.price habe seit 0021 gar keine Einschraenkung. Das war
-- falsch, ich hatte nur die create-table-Anweisung angesehen und nicht
-- weitergesucht. Aufgefallen ist es erst durch die Mutationsprobe: bei
-- ausgehebelter Grenze blieben die Tests fuer negativ und null trotzdem gruen,
-- sie scheiterten naemlich an 0040. Genau die Falle, die in CLAUDE.md steht:
-- ein Negativtest, der am falschen Riegel scheitert, beweist nichts.
--
-- OFFEN BLEIBT damit genau der Bereich `0 < price <= 3,00`. Klein, aber es ist
-- der Bereich, in dem der Anbieter draufzahlt.
--
-- DIE GRENZE: > 3,00. Das ist genau die Bedingung "die Auszahlung ist
-- positiv", nicht mehr und nicht weniger:
--
--     Preis  3,01  ->  Gebuehr 3,00  ->  Auszahlung 0,01   (zulaessig)
--     Preis  3,00  ->  Gebuehr 3,00  ->  Auszahlung 0,00   (gesperrt)
--
-- Im Nachbarschafts-Track faellt keine Provision an, der Helfer bekommt 100 %.
-- Dieselbe Grenze schadet dort nicht und haelt die Regel einfach: eine
-- Bedingung, die eine andere Tabelle befragen muesste, waere ein Trigger, und
-- ein Trigger ist hier mehr Angriffsflaeche als Gewinn.
--
-- Bewusst KEINE Produktentscheidung ueber einen sinnvollen Mindestauftrag.
-- Das ist eine Founder-Frage; hier wird nur verhindert, dass jemand
-- draufzahlt.

-- ── Die Einschraenkung ─────────────────────────────────────────────────────
--
-- NOT VALID: so kann die Migration an Bestandsdaten NICHT scheitern. Neue und
-- geaenderte Zeilen werden trotzdem ab sofort geprueft. Der Versuch, sie
-- nachtraeglich zu bestaetigen, steht darunter und faengt seinen eigenen
-- Fehler ab: ein Marktplatz, der wegen einer Altlast nicht mehr deployt, ist
-- schlimmer als eine Einschraenkung, die eine Runde spaeter vollstaendig gilt.
alter table public.offers
  drop constraint if exists offers_price_positiver_payout;

alter table public.offers
  add constraint offers_price_positiver_payout
  check (price > 3.00) not valid;

comment on constraint offers_price_positiver_payout on public.offers is
  'Untergrenze = Mindestgebuehr (3,00). Darunter uebersteigt die Provision '
  'den Auftragswert und die Auszahlung wird negativ. Siehe 0910.';

do $$
begin
  alter table public.offers validate constraint offers_price_positiver_payout;
  raise notice '0910: Bestandsdaten sauber, Einschraenkung vollstaendig gueltig.';
exception when check_violation then
  raise notice '0910: Es gibt Altzeilen unter 3,00 EUR. Die Einschraenkung gilt '
               'ab sofort fuer NEUE Zeilen; die Altzeilen bitte ansehen: '
               'select id, job_id, price from public.offers where price <= 3.00;';
end $$;
