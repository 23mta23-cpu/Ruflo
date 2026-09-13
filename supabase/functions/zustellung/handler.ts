// Die Zustell-Schleife — ausfuehrbar testbar.
//
// WARUM EIGENE DATEI: Diese Schleife traegt eine RECHTLICHE Zusage, keine
// Bequemlichkeit. Quittiert wird erst, wenn Resend die Annahme bestaetigt hat.
// Eine Quittung ohne Versand waere schlimmer als gar keine: der Rueckstand in
// `zustellung_status()` verschwaende, die Pflicht aus DSA Art. 17 und
// AGB §7(4) bliebe — und niemand saehe es mehr.
//
// Genau diese Eigenschaft laesst sich mit `deno check` nicht pruefen. Im Haus
// ist belegt, wohin das fuehrt: die Logik des Stripe-Webhooks wurde bis PR #159
// NIE ausgefuehrt, die CI pruefte nur Typen. Typpruefung ist kein Test.
//
// Der Inhalt ist eine WORTGLEICHE Uebernahme der Schleife aus index.ts. Bei der
// Verschiebung wurde keine Bedingung, kein Zaehler, kein Rueckgabewert und kein
// Fehlerpfad geaendert — nur `fetch` und `supabase.rpc` sind jetzt injizierte
// Abhaengigkeiten, damit ein Test den Nicht-Versand nachweisen kann.

export interface Offen {
  id: string;
  empfaenger: string;
  email: string;
  art: string;
  titel: string;
  text: string;
}

/** Gibt zurueck, ob die Gegenstelle die Mail ANGENOMMEN hat. */
export type MailVersand = (m: Offen) => Promise<{ ok: boolean; status: number }>;

/** Vermerkt die Zustellung. `fehler` ungleich null heisst: nicht vermerkt. */
export type Quittung = (id: string) => Promise<{ fehler: unknown }>;

export interface Bilanz {
  offen: number;
  versendet: number;
  fehlgeschlagen: number;
}

export async function mitteilungenZustellen(
  offen: Offen[],
  deps: { versenden: MailVersand; quittieren: Quittung },
): Promise<Bilanz> {
  let versendet = 0;
  let fehlgeschlagen = 0;

  for (const m of offen) {
    try {
      const res = await deps.versenden(m);

      if (!res.ok) {
        // Erst quittieren, wenn Resend die Annahme bestaetigt hat. Eine
        // Quittung ohne Versand waere schlimmer als gar keine: der Rueckstand
        // verschwaende, die Pflicht bliebe.
        fehlgeschlagen++;
        console.error(`zustellung: Resend ${res.status} fuer Mitteilung ${m.id}`);
        continue;
      }

      const { fehler } = await deps.quittieren(m.id);
      if (fehler) {
        // Die Mail ist raus, die Quittung nicht. Beim naechsten Lauf geht sie
        // erneut raus — doppelt zugestellt ist unschoen, nicht zugestellt waere
        // ein Rechtsverstoss.
        fehlgeschlagen++;
        console.error(`zustellung: Quittung fehlgeschlagen fuer ${m.id}:`, fehler);
        continue;
      }
      versendet++;
    } catch (e) {
      // Eine einzelne kaputte Adresse darf die uebrigen Pflichtmitteilungen
      // nicht aufhalten.
      fehlgeschlagen++;
      console.error(`zustellung: Versand fehlgeschlagen fuer ${m.id}:`, e);
    }
  }

  return { offen: offen.length, versendet, fehlgeschlagen };
}

/** 207, sobald auch nur eine Mitteilung liegengeblieben ist: ein Lauf, der
 *  teilweise gescheitert ist, darf nicht als Erfolg in der Betriebsansicht
 *  stehen. */
export function statusFuer(bilanz: Bilanz): number {
  return bilanz.fehlgeschlagen > 0 ? 207 : 200;
}
