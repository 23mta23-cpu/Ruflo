/**
 * Tests fuer lib/vertragsLage.ts.
 *
 * ANLASS: Founder-Screenshot vom 07.09.2026. Ein Vertrag, beide Seiten
 * unterschrieben, nichts gezahlt — und die App sagte gleichzeitig „Aktiv"
 * (oben), „Ausstehend" (in der Liste) und bot „Zahlung starten" an. Dazu eine
 * Escrow-Leiste, deren erster Punkt „Betrag eingefroren" gruen leuchtete.
 */
import { vertragsLage } from '../lib/vertragsLage';

describe('vertragsLage', () => {
  it('nennt einen unterschriebenen, aber unbezahlten Vertrag NICHT aktiv', () => {
    // Genau der Fall aus dem Screenshot.
    const l = vertragsLage({
      status: 'pending',
      customer_signed_at: '2026-08-16T01:04:00Z',
      provider_signed_at: '2026-08-16T01:04:00Z',
      escrow_captured_at: null,
    });
    expect(l.marke).toBe('Zahlung ausstehend');
    expect(l.zahlbar).toBe(true);
  });

  it('faerbt die Geldleiste NICHT nach Unterschriften', () => {
    // Der eigentliche Befund: der Bildschirm behauptete hinterlegtes Geld,
    // weil beide unterschrieben hatten.
    const l = vertragsLage({
      status: 'pending',
      customer_signed_at: '2026-08-16T01:04:00Z',
      provider_signed_at: '2026-08-16T01:04:00Z',
      escrow_captured_at: null,
    });
    expect(l.geldSchritt).toBe(0);
  });

  it('zaehlt den ersten Geldschritt erst, wenn wirklich einbezahlt wurde', () => {
    expect(vertragsLage({ status: 'active', escrow_captured_at: '2026-08-16T02:00:00Z' }).geldSchritt).toBe(1);
  });

  it('erkennt die gemeldete Fertigstellung als zweiten Schritt', () => {
    const l = vertragsLage({
      status: 'active',
      escrow_captured_at: '2026-08-16T02:00:00Z',
      fertig_gemeldet_am: '2026-08-28T10:00:00Z',
    });
    expect(l.geldSchritt).toBe(2);
    expect(l.marke).toBe('Warten auf Abnahme');
  });

  it('zaehlt die Auszahlung als dritten Schritt', () => {
    expect(vertragsLage({
      status: 'completed',
      escrow_captured_at: '2026-08-16T02:00:00Z',
      escrow_released_at: '2026-09-01T08:00:00Z',
    }).geldSchritt).toBe(3);
  });

  it('bietet Zahlung NUR an, solange nichts hinterlegt ist', () => {
    // Sonst stuende der Knopf „Zahlung starten" auf einem bezahlten Vertrag —
    // und wer ihn druecken wuerde, zahlte ein zweites Mal.
    for (const c of [
      { status: 'active', escrow_captured_at: '2026-08-16T02:00:00Z' },
      { status: 'completed', escrow_released_at: '2026-09-01T08:00:00Z' },
      { status: 'cancelled' },
      { status: 'disputed', escrow_captured_at: '2026-08-16T02:00:00Z' },
    ]) {
      expect(vertragsLage(c).zahlbar).toBe(false);
    }
  });

  it('haelt Storno und Klaerung auseinander', () => {
    expect(vertragsLage({ status: 'cancelled' }).marke).toBe('Storniert');
    expect(vertragsLage({ status: 'disputed', escrow_captured_at: 'x' }).marke).toBe('In Klärung');
  });

  it('behauptet bei einem Mangel NICHT, das Geld sei ausgezahlt', () => {
    const l = vertragsLage({ status: 'disputed', escrow_captured_at: 'x', fertig_gemeldet_am: 'y' });
    expect(l.geldSchritt).toBe(2);
    expect(l.erklaerung).toContain('hinterlegt');
  });

  it('kommt mit einem fehlenden Vertrag zurecht, ohne etwas zu behaupten', () => {
    const l = vertragsLage(null);
    expect(l.geldSchritt).toBe(0);
    expect(l.marke).toBe('Zahlung ausstehend');
  });

  it('nennt einen ausgezahlten Vertrag abgeschlossen, auch ohne status', () => {
    // Der Webhook setzt escrow_released_at; laeuft das Setzen von status
    // hinterher, darf der Bildschirm nicht behaupten, es sei noch offen.
    expect(vertragsLage({ escrow_released_at: '2026-09-01T08:00:00Z' }).marke).toBe('Abgeschlossen');
  });
});
