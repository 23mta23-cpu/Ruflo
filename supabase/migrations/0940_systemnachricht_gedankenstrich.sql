-- 0940: Der Gedankenstrich lebte in den DATEN weiter
--
-- ANLASS (Founder-Bildschirmfoto, 16.09.2026): im Chat stand
-- „Angebot angenommen — Auftrag ist beauftragt."
--
-- Der Wortlaut kam aus 0530. Migration 0830 hat ihn im CODE bereits ersetzt
-- („Angebot angenommen. Der Auftrag ist beauftragt."), aber die Zeilen, die
-- vorher geschrieben wurden, stehen unveraendert in `messages`. Eine
-- Systemnachricht ist ein DATENSATZ, kein Quelltext.
--
-- Das ist die Grenze von `scripts/gedankenstrich-check.py`: er liest
-- Quelldateien. Was einmal in der Datenbank steht, sieht er nie. Dieselbe
-- Klasse wie die ausgelieferten HTML-Dateien, die kein Textpruefer las.
--
-- Der Gedankenstrich ist eine ausdrueckliche Founder-Vorgabe („keine ‚-'
-- sehen"), und der Satz steht im wichtigsten Moment des Verlaufs.

update public.messages
   set body = 'Angebot angenommen. Der Auftrag ist beauftragt.'
 where type = 'system'
   and body like 'Angebot angenommen %'
   and body like '%—%';

-- Kein `drop`/`create`: ein zweiter Lauf trifft keine Zeile mehr, weil die
-- Bedingung dann nicht mehr passt. Damit ist die Migration idempotent.
