/**
 * Wer bekommt die Mitteilung über einen neuen Auftrag?
 *
 * ANLASS (20.09.2026): `supabase/functions/notify-matching-providers/auswahl.ts`
 * wurde am 20.07. aus index.ts herausgelöst, ausdrücklich mit der Begründung
 * „ein Filter, der die Trennung zweier Rechtsräume trägt, gehört ausgeführt".
 * Danach wurde kein Test dafür geschrieben. Zwei Monate lang war er wieder nur
 * typgeprüft, genau der Zustand, den das Herauslösen beenden sollte.
 *
 * `npx tsc --noEmit` prüft `supabase/functions/` ohnehin nicht (AGENTS.md);
 * `deno check` prüft Typen, keine Wirkung. Hier läuft er.
 */
import { passendeAnbieter } from '../supabase/functions/notify-matching-providers/auswahl';

const MEISTER = [
  { gewerk: 'elektro', name: 'Elektro' },
  { gewerk: 'maler', name: 'Maler' },
];

const betrieb = (extra: Record<string, unknown> = {}) => ({
  id: 'b1', is_nachbarschaft: false, meister_verified: false,
  profile: { plz: '50667' }, ...extra,
});

describe('passendeAnbieter', () => {
  it('nimmt den Betrieb im selben PLZ-Bereich', () => {
    const treffer = passendeAnbieter(
      { address_plz: '50670', track: 'handwerker', category_id: 'bodenleger' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(1);
  });

  it('lässt einen fremden PLZ-Bereich aus', () => {
    const treffer = passendeAnbieter(
      { address_plz: '10115', track: 'handwerker', category_id: 'bodenleger' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('meldet niemandem, wenn dem Auftrag die PLZ fehlt', () => {
    // Ausdrücklich so entschieden: lieber keine Mitteilung als eine an alle.
    const treffer = passendeAnbieter(
      { address_plz: null, track: 'handwerker', category_id: 'bodenleger' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('trennt Handwerk und Nachbarschaft in BEIDE Richtungen (§ 1 HwO)', () => {
    const hwJob = { address_plz: '50667', track: 'handwerker', category_id: 'bodenleger' };
    const nbJob = { address_plz: '50667', track: 'nachbarschaft', category_id: 'garten' };
    const helfer = betrieb({ is_nachbarschaft: true });
    expect(passendeAnbieter(hwJob, [helfer], MEISTER)).toHaveLength(0);
    expect(passendeAnbieter(nbJob, [betrieb()], MEISTER)).toHaveLength(0);
    expect(passendeAnbieter(nbJob, [helfer], MEISTER)).toHaveLength(1);
  });

  it('meldet einen Anlage-A-Auftrag nicht an einen Betrieb ohne geprüften Meisterbrief', () => {
    const treffer = passendeAnbieter(
      { address_plz: '50667', track: 'handwerker', category_id: 'elektro' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('meldet ihn dem Betrieb MIT geprüftem Meisterbrief', () => {
    const treffer = passendeAnbieter(
      { address_plz: '50667', track: 'handwerker', category_id: 'elektro' },
      [betrieb({ meister_verified: true })], MEISTER,
    );
    expect(treffer).toHaveLength(1);
  });

  it('greift auch ohne category_id über den Anzeigenamen', () => {
    // jobs.category_id darf seit 0410 NULL sein. Genau das war der Weg vorbei.
    const treffer = passendeAnbieter(
      { address_plz: '50667', track: 'handwerker', category_id: null, category: 'Elektro' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('sperrt ein zulassungsfreies Gewerk NICHT', () => {
    // Gegenprobe. Ohne sie wäre „alle sperren" ein bestandener Test, und genau
    // das war am 07.09. beinahe die Wirkung eines Rechteentzugs.
    const treffer = passendeAnbieter(
      { address_plz: '50667', track: 'handwerker', category_id: 'bodenleger', category: 'Bodenleger' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(1);
  });

  it('filtert ohne Gewerkliste gar nicht nach Meisterpflicht', () => {
    // Kommt die Liste nicht aus der Datenbank, geht die Mitteilung hinaus wie
    // bisher. Die Sperre selbst sitzt in der Angebots-Policy; hier zu blocken,
    // weil eine Abfrage fehlschlug, nähme Betrieben ohne Grund die Aufträge.
    const treffer = passendeAnbieter(
      { address_plz: '50667', track: 'handwerker', category_id: 'elektro' },
      [betrieb()], [],
    );
    expect(treffer).toHaveLength(1);
  });
});

describe('Wunschanbieter (Migration 1020)', () => {
  // ANLASS: Der Knopf „Unverbindliche Anfrage stellen" auf einem
  // Anbieterprofil uebergab seit jeher eine Kennung, die niemand gelesen hat.
  // Jetzt steht sie am Auftrag -- und darf an einer Postleitzahlen-Naeherung
  // nicht wieder still scheitern.
  it('nimmt den Wunschanbieter auch aus einem fremden PLZ-Bereich', () => {
    const treffer = passendeAnbieter(
      {
        address_plz: '10115', track: 'handwerker', category_id: 'bodenleger',
        requested_provider_id: 'b1',
      },
      [betrieb()], MEISTER,
    );
    expect(treffer.map((t) => t.id)).toEqual(['b1']);
  });

  it('nimmt einen fremden PLZ-Bereich OHNE Wunsch weiterhin nicht', () => {
    // Gegenprobe: ohne sie waere „die Region zaehlt gar nicht mehr" ein
    // bestandener Test.
    const treffer = passendeAnbieter(
      { address_plz: '10115', track: 'handwerker', category_id: 'bodenleger' },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('hebelt die Track-Trennung NICHT aus (§ 1 HwO)', () => {
    // Ein Wunsch ist keine Erlaubnis. Wer auf diesen Auftrag nicht bieten
    // darf, bekommt auch keine Mitteilung darueber -- eine Mitteilung, die in
    // eine Sperre fuehrt, ist schlechter als keine.
    const treffer = passendeAnbieter(
      {
        address_plz: '50667', track: 'handwerker', category_id: 'bodenleger',
        requested_provider_id: 'nb1',
      },
      [betrieb({ id: 'nb1', is_nachbarschaft: true })], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('hebelt die Meisterpflicht NICHT aus (0980)', () => {
    const treffer = passendeAnbieter(
      {
        address_plz: '50667', track: 'handwerker', category_id: 'elektro',
        category: 'Elektro', requested_provider_id: 'b1',
      },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });

  it('nimmt einen anderen Betrieb nicht fuer den gewuenschten', () => {
    const treffer = passendeAnbieter(
      {
        address_plz: '10115', track: 'handwerker', category_id: 'bodenleger',
        requested_provider_id: 'jemand-anders',
      },
      [betrieb()], MEISTER,
    );
    expect(treffer).toHaveLength(0);
  });
});
