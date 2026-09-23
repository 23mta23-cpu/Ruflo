/**
 * Was passiert, wenn ein Betrieb sein eigenes Angebot zurueckziehen will.
 *
 * ANLASS (23.09.2026, gemessene Klasse): Der Knopf „Zurueckziehen" auf dem
 * Betriebs-Dashboard setzte
 *
 *     update offers set status='declined' where id=? and status='pending'
 *
 * ab, LAS DAS ERGEBNIS NICHT, entfernte die Zeile aus der Liste und meldete
 * „Angebot zurueckgezogen". Zwei Ausgaenge waren damit nicht unterscheidbar:
 *
 *   1. Ein Fehler (Netz, RLS, Spaltenrecht). Nichts wurde geschrieben, der
 *      Betrieb liest trotzdem eine Erfolgsmeldung.
 *   2. NULL betroffene Zeilen. PostgREST meldet dafuer KEINEN Fehler. Genau
 *      dann ist das Angebot nicht mehr `pending` — der Kunde hat es in der
 *      Zwischenzeit angenommen oder die Frist ist abgelaufen. Im Annahmefall
 *      besteht ein Vertrag, und der Betrieb geht davon aus, keinen zu haben.
 *
 * Fall 2 ist der teure: eine Falschaussage mit Rechtsfolge. Deshalb drei
 * getrennte Ausgaenge statt eines pauschalen „zurueckgezogen", und der
 * Bildschirm laedt im Fall 2 neu, damit der Betrieb den echten Stand sieht.
 *
 * Reine Regel ohne Netz-Import, damit Jest sie wirklich aufrufen kann
 * (Lehre vom 16.09.2026: ein Test, der die Implementierung abschreibt,
 * prueft nichts).
 */
export type RueckzugAusgang = 'zurueckgezogen' | 'nicht_mehr_offen' | 'fehlgeschlagen';

export type Rueckzug = {
  ausgang: RueckzugAusgang;
  meldung: string;
  /** Nur wahr, wenn wirklich eine Zeile umgestellt wurde. */
  ausListeEntfernen: boolean;
  /** Der Bildschirm zeigt einen veralteten Stand und muss neu laden. */
  neuLaden: boolean;
};

export function rueckzugErgebnis(fehler: boolean, betroffeneZeilen: number): Rueckzug {
  if (fehler) {
    return {
      ausgang: 'fehlgeschlagen',
      meldung: 'Das Angebot konnte nicht zurückgezogen werden. Bitte noch einmal versuchen.',
      ausListeEntfernen: false,
      neuLaden: false,
    };
  }
  if (betroffeneZeilen < 1) {
    return {
      ausgang: 'nicht_mehr_offen',
      meldung: 'Das Angebot ist nicht mehr offen: der Kunde hat es angenommen, oder es ist abgelaufen. Ihre Übersicht wurde aktualisiert.',
      ausListeEntfernen: false,
      neuLaden: true,
    };
  }
  return {
    ausgang: 'zurueckgezogen',
    meldung: 'Angebot zurückgezogen',
    ausListeEntfernen: true,
    neuLaden: false,
  };
}
