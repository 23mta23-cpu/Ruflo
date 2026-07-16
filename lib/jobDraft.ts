import AsyncStorage from '@react-native-async-storage/async-storage';

// Zentraler Schlüssel für den Gast-Auftrags-Entwurf (auftrag-aufgeben.tsx
// sichert ihn vor der Anmeldung, stellt ihn beim Öffnen wieder her). Hier
// zentral, damit Wizard und Auth-Screens denselben Schlüssel nutzen (kein Drift).
export const JOB_DRAFT_KEY = 'werkr_job_draft_v1';

/**
 * Fortsetzungsziel für einen wartenden Gast-Entwurf nach dem Login, inkl.
 * Track — sonst würde ein Nachbarschafts-Entwurf beim Wiederherstellen
 * (Track-Prüfung im Wizard) verworfen. `null`, wenn kein Entwurf wartet.
 */
export async function getJobDraftResume(): Promise<null | { track?: 'nachbarschaft' }> {
  try {
    const raw = await AsyncStorage.getItem(JOB_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { nbMode?: boolean };
    return d?.nbMode ? { track: 'nachbarschaft' } : {};
  } catch {
    return null;
  }
}
