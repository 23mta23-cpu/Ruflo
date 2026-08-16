/**
 * Tests fuer createJob() in lib/jobs.ts — der Weg der Strasse in die Datenbank.
 *
 * Anlass (16.08.2026, Founder-Befund): „wo muss dann adresse reingeschrieben
 * werden wohin muss der handwerker hin?" — die Strasse wurde im Formular gar
 * nicht erhoben. Migration 0570 hatte `job_addresses` samt enger RLS gebaut,
 * lib/jobs.ts nahm `addressStreet` entgegen, das Anbieter-Dashboard zeigte sie
 * an. Nur uebergeben hat sie nie jemand.
 *
 * Der Browser-Test (scripts/reisen/reise1-kunde.cjs) kann diesen Teil NICHT
 * beweisen: er laeuft ohne Konto, jeder Netzaufruf an Supabase wird bewusst
 * abgefangen, und die Reise endet bei „Anmeldung erforderlich" — also VOR dem
 * eigentlichen Anlegen. Deshalb hier, gegen einen nachgebildeten Client:
 * geprueft wird, WAS an die Datenbank ginge.
 */

type Antwort = { data?: unknown; error?: unknown };

const aufrufe: Array<{ tabelle: string; zeile: unknown }> = [];
let jobsAntwort: Antwort = { data: { id: 'job-1' }, error: null };
let adressAntwort: Antwort = { error: null };

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (tabelle: string) => ({
      insert: (zeile: unknown) => {
        aufrufe.push({ tabelle, zeile });
        if (tabelle === 'job_addresses') return Promise.resolve(adressAntwort);
        return {
          select: () => ({ single: () => Promise.resolve(jobsAntwort) }),
        };
      },
    }),
  },
}));

import { createJob, JobAddressNotSavedError } from '../lib/jobs';

const BASIS = {
  customerId: 'kunde-1',
  title: 'Heizkoerper wird nicht warm',
  description: 'Wird seit zwei Wochen nicht mehr warm.',
  category: 'Sanitär',
  addressPlz: '50667',
  addressCity: 'Köln',
};

beforeEach(() => {
  aufrufe.length = 0;
  jobsAntwort = { data: { id: 'job-1' }, error: null };
  adressAntwort = { error: null };
});

const adressZeilen = () => aufrufe.filter((a) => a.tabelle === 'job_addresses');

describe('createJob — Strasse', () => {
  it('schreibt die Strasse nach job_addresses, verknuepft mit dem Auftrag', async () => {
    await createJob({ ...BASIS, addressStreet: 'Aachener Straße 12a' });

    expect(adressZeilen()).toHaveLength(1);
    expect(adressZeilen()[0].zeile).toEqual({
      job_id: 'job-1',
      address_street: 'Aachener Straße 12a',
    });
  });

  it('haelt die Strasse aus der jobs-Zeile heraus (0570: Bieter duerfen sie vor der Vergabe nicht sehen)', async () => {
    await createJob({ ...BASIS, addressStreet: 'Aachener Straße 12a' });

    const jobZeile = aufrufe.find((a) => a.tabelle === 'jobs')!.zeile as Record<string, unknown>;
    expect(jobZeile).not.toHaveProperty('address_street');
    expect(jobZeile.address_city).toBe('Köln');
  });

  it('legt bei leerer Strasse keine leere Adresszeile an', async () => {
    // `addressStreet` ist Pflicht-Parameter (sonst faellt das Weglassen keinem
    // auf — genau so ging sie seit #140 verloren). Ein leerer String ist damit
    // die ausdrueckliche Aussage „keine Strasse", nicht ein Versehen.
    await createJob({ ...BASIS, addressStreet: '' });
    expect(adressZeilen()).toHaveLength(0);
  });

  it('verschluckt einen fehlgeschlagenen Adress-Schreibvorgang NICHT', async () => {
    adressAntwort = { error: { message: 'network' } };

    await expect(createJob({ ...BASIS, addressStreet: 'Aachener Straße 12a' }))
      .rejects.toBeInstanceOf(JobAddressNotSavedError);
  });

  it('reicht den bereits angelegten Auftrag mit, damit der Wizard ihn nicht doppelt anlegt', async () => {
    adressAntwort = { error: { message: 'network' } };

    // Der Auftrag STEHT an dieser Stelle schon in der Datenbank. Wuerde der
    // Wizard das als gewoehnlichen Fehler behandeln, tippt der Kunde erneut
    // auf „Absenden" und hat zwei Auftraege.
    const fehler = await createJob({ ...BASIS, addressStreet: 'Aachener Straße 12a' })
      .catch((e) => e);

    expect(fehler).toBeInstanceOf(JobAddressNotSavedError);
    expect((fehler as JobAddressNotSavedError).job).toEqual({ id: 'job-1' });
  });
});
