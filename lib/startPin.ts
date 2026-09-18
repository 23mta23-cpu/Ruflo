import { supabase } from './supabase';
import type { StartPinZustand } from './startPinText';

/**
 * Die Start-PIN, Kunden- und Betriebsseite.
 *
 * Der VERGLEICH findet hier NICHT statt. Wuerde die App die Zahl holen und
 * selbst vergleichen, koennte der Betrieb sie im Netzverkehr mitlesen und der
 * Beleg waere wertlos. Er liegt in `arbeit_beginnen()` (0960), und die gibt
 * ausschliesslich einen Zustand zurueck, nie die Zahl.
 */

/**
 * Die Zahl zum Vertrag, fuer den AUFTRAGGEBER. Beim Betrieb liefert die
 * Policy aus 0960 nichts zurueck -- das ist kein Fehler, sondern der Zweck.
 */
export async function startPinLesen(contractId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vertrag_start_pins')
    .select('pin')
    .eq('contract_id', contractId)
    .maybeSingle<{ pin: string }>();
  if (error) return null;
  return data?.pin ?? null;
}

/** Der Betrieb loest die Zahl ein. Rueckgabe: der Zustand aus 0960. */
export async function arbeitBeginnen(
  contractId: string,
  pin: string,
): Promise<StartPinZustand> {
  const { data, error } = await supabase.rpc('arbeit_beginnen', {
    p_vertrag: contractId,
    p_pin: pin,
  });
  // Ein Netzfehler darf nicht als "falsche PIN" durchgehen: der Betrieb
  // saehe einen Fehlversuch, den es nie gab, und wuerde sich der Sperre
  // naehern, ohne etwas falsch gemacht zu haben.
  if (error || typeof data !== 'string') return 'fehler';
  return data as StartPinZustand;
}
