/**
 * Wie steht dieser Vertrag wirklich?
 *
 * ANLASS (Founder-Screenshots 07.09.2026): Derselbe Vertrag hiess an drei
 * Stellen drei verschiedene Dinge.
 *   - Im Vertrag oben:  „Aktiv"      — abgeleitet aus den UNTERSCHRIFTEN
 *   - In der Liste:     „Ausstehend" — abgeleitet aus contracts.status
 *   - Unten ein Knopf:  „Vertrag bestaetigen & Zahlung starten"
 * Alle drei gleichzeitig, auf demselben Vorgang. Der Nutzer kann daraus keine
 * Geschichte bauen — und das Abzeichen war schlicht falsch: es nannte einen
 * Vertrag aktiv, fuer den noch gezahlt werden musste.
 *
 * Schlimmer war die Escrow-Leiste: „Betrag eingefroren" wurde gruen, sobald
 * beide unterschrieben hatten. Der Geldzustand steht aber in
 * escrow_captured_at, und der steuerte erst den ZWEITEN Punkt. Der Bildschirm
 * behauptete also hinterlegtes Geld, das nie geflossen war — dieselbe Klasse
 * wie die erfundenen Belege auf /rechnung und /vertrag vom 16.08.2026.
 *
 * Hier steht die Ableitung EINMAL. Wer den Zustand anzeigt, fragt hier.
 * Unterschriften sagen aus, dass man sich geeinigt hat. Ueber Geld sagen sie
 * nichts.
 */

export type Vertragsdaten = {
  status?: string | null;
  escrow_captured_at?: string | null;
  escrow_released_at?: string | null;
  fertig_gemeldet_am?: string | null;
  abnahme_faellig_am?: string | null;
  customer_signed_at?: string | null;
  provider_signed_at?: string | null;
};

export type Marke = 'gruen' | 'gold' | 'rot' | 'grau';

export type Vertragslage = {
  /** Was oben im Abzeichen steht — dasselbe Wort wie in der Liste. */
  marke: string;
  ton: Marke;
  /** Darf jetzt gezahlt werden? */
  zahlbar: boolean;
  /** Wie weit die Geldleiste WIRKLICH ist: 0 = nichts, 1 = hinterlegt,
   *  2 = Arbeit gemeldet, 3 = ausgezahlt. */
  geldSchritt: 0 | 1 | 2 | 3;
  /** Ein Satz, der den Zustand erklaert, statt ihn nur zu benennen. */
  erklaerung: string;
};

export function vertragsLage(c: Vertragsdaten | null | undefined): Vertragslage {
  const status = c?.status ?? null;
  const hinterlegt = !!c?.escrow_captured_at;
  const ausgezahlt = !!c?.escrow_released_at;
  const gemeldet = !!c?.fertig_gemeldet_am;

  // Die Geldleiste haengt AUSSCHLIESSLICH an Geld-Merkmalen. Keine
  // Unterschrift, kein Status faerbt hier etwas ein.
  const geldSchritt: 0 | 1 | 2 | 3 = ausgezahlt ? 3 : gemeldet ? 2 : hinterlegt ? 1 : 0;

  if (status === 'cancelled') {
    return { marke: 'Storniert', ton: 'grau', zahlbar: false, geldSchritt,
      erklaerung: 'Dieser Auftrag wurde storniert.' };
  }
  if (status === 'disputed') {
    return { marke: 'In Klärung', ton: 'rot', zahlbar: false, geldSchritt,
      erklaerung: 'Es wurde ein Mangel gemeldet. Das Geld bleibt so lange hinterlegt.' };
  }
  if (status === 'completed' || ausgezahlt) {
    return { marke: 'Abgeschlossen', ton: 'gruen', zahlbar: false, geldSchritt,
      erklaerung: 'Der Auftrag ist abgeschlossen und das Geld ausgezahlt.' };
  }
  if (status === 'pending' || !hinterlegt) {
    // Der Fall aus dem Screenshot. Beide hatten unterschrieben, gezahlt war
    // nichts — und oben stand trotzdem „Aktiv".
    return { marke: 'Zahlung ausstehend', ton: 'gold', zahlbar: true, geldSchritt,
      erklaerung: 'Der Vertrag steht. Sobald Sie zahlen, wird der Betrag hinterlegt und der Betrieb kann anfangen.' };
  }
  if (gemeldet) {
    return { marke: 'Warten auf Abnahme', ton: 'gold', zahlbar: false, geldSchritt,
      erklaerung: 'Der Betrieb hat die Fertigstellung gemeldet. Bitte sehen Sie sich die Arbeit an und geben Sie frei.' };
  }
  return { marke: 'Aktiv', ton: 'gruen', zahlbar: false, geldSchritt,
    erklaerung: 'Das Geld ist hinterlegt. Der Betrieb kann arbeiten; ausgezahlt wird nach Ihrer Freigabe.' };
}
