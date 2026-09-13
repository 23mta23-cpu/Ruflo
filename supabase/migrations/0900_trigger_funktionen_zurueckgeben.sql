-- 0900: Zwei Trigger-Funktionen aus 0860 standen fuer anon offen.
--
-- ANLASS (13.09.2026, Selbst-Check): `strike_benachrichtigen()` und
-- `beschraenkung_benachrichtigen()` sind SECURITY DEFINER und wurden in 0860
-- angelegt — also NACH 0820, das die Ausfuehrungsrechte im Schema public von
-- „erlaubt" auf „verboten" gedreht hat. Die Schleife in 0820 erfasst nur, was
-- es zu ihrem Zeitpunkt gab; alles Spaetere bekommt wieder die Vorgaben aus
-- 0420 (`alter default privileges … grant execute on functions to
-- authenticated, service_role`) plus das EXECUTE, das PostgreSQL jeder neuen
-- Funktion an PUBLIC gibt.
--
-- Ergebnis in der Produktion: beide fuer anon UND authenticated ausfuehrbar.
--
-- AUSNUTZBARKEIT, ehrlich: gering. Beide geben `trigger` zurueck, und ein
-- direkter Aufruf scheitert an „trigger functions can only be called as
-- triggers". Das ist aber ein Zufall der Rueckgabeart, kein Schutz. 0820 hat
-- die Grundregel auf Verbot gestellt, und eine Ausnahme, die nur deshalb
-- harmlos ist, weil PostgreSQL zufaellig dazwischengeht, bleibt eine Ausnahme.
--
-- Mein Fehler beim Schreiben von 0860: ich habe aus „Trigger-Funktionen
-- BRAUCHEN kein EXECUTE" (richtig, PostgreSQL prueft es beim Ausloesen nicht)
-- geschlossen, dass man ihnen keines ENTZIEHEN muss. Das folgt nicht.

revoke execute on function public.strike_benachrichtigen() from public, anon, authenticated;
revoke execute on function public.beschraenkung_benachrichtigen() from public, anon, authenticated;

-- Trigger-Funktionen brauchen ueberhaupt kein EXECUTE, auch service_role
-- nicht: PostgreSQL prueft das Recht beim Ausloesen nicht. Deshalb hier
-- bewusst KEIN `grant … to service_role` — was niemand aufrufen kann, kann
-- auch nicht missbraucht werden.

comment on function public.strike_benachrichtigen() is
  'Trigger auf provider_strikes (0860). Ausfuehrungsrecht bewusst entzogen (0900): Trigger brauchen keines, und 0820 hat die Grundregel auf Verbot gestellt.';
comment on function public.beschraenkung_benachrichtigen() is
  'Trigger auf beschraenkungen (0860). Ausfuehrungsrecht bewusst entzogen (0900), siehe strike_benachrichtigen.';
