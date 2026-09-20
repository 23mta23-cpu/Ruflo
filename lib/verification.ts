// Verifizierungs-Dokumente (Gewerbeschein / Meisterbrief) — Migration 037.
//
// Ablauf: Anbieter wählt Datei (expo-document-picker) → Upload in den privaten
// Bucket verification-docs unter {uid}/{kind}-{ts}.{ext} → beim Abschluss des
// Onboardings setzt submitForReview() die Pfade + kyc_status 'in_review'
// (einziger clientseitig erlaubter Statusübergang, Guard in 037).
//
// Kein Ausweis-Upload: Altersnachweis läuft über Stripe-Connect-KYC (PAuswG §20).

import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

export type DocKind = 'gewerbeschein' | 'meisterbrief';

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB — wie Bucket-Limit + UI-Copy
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

export interface PickedDoc {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
}

/** Pure Validierung — separat testbar. Gibt Fehlertext oder null zurück. */
export function validateDoc(doc: { mimeType?: string | null; size?: number | null }): string | null {
  if (!doc.mimeType || !ALLOWED_MIME.includes(doc.mimeType)) {
    return 'Nur JPG, PNG oder PDF möglich.';
  }
  if (!doc.size || doc.size <= 0) return 'Datei ist leer oder unlesbar.';
  if (doc.size > MAX_DOC_BYTES) return 'Datei ist größer als 10 MB.';
  return null;
}

/** Pure Pfad-Konstruktion — separat testbar. */
export function buildDocPath(userId: string, kind: DocKind, mimeType: string, now = Date.now()): string {
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  return `${userId}/${kind}-${now}.${ext}`;
}

/** Datei wählen; null bei Abbruch. Wirft Error mit deutscher Meldung bei ungültiger Datei. */
export async function pickDoc(): Promise<PickedDoc | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_MIME,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const doc: PickedDoc = {
    name: a.name ?? 'dokument',
    uri: a.uri,
    mimeType: a.mimeType ?? '',
    size: a.size ?? 0,
  };
  const err = validateDoc(doc);
  if (err) throw new Error(err);
  return doc;
}

/** Upload in verification-docs. Gibt den Storage-Pfad zurück. */
export async function uploadDoc(kind: DocKind, doc: PickedDoc): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Bitte melden Sie sich an, um Dokumente hochzuladen.');

  const path = buildDocPath(session.user.id, kind, doc.mimeType);
  const blob = await (await fetch(doc.uri)).blob();
  const { error } = await supabase.storage
    .from('verification-docs')
    .upload(path, blob, { contentType: doc.mimeType, upsert: false });
  if (error) throw new Error('Upload fehlgeschlagen. Bitte erneut versuchen.');
  return path;
}

/**
 * Wie lange gewartet wird, bevor der Bildschirm einen Ausweg anbietet.
 *
 * ANLASS (14.09.2026, Design-Entscheidung A1): Beim Hochladen drehte sich ein
 * ActivityIndicator — kein Name, keine Groesse, kein Ende, kein Abbruch. Ein
 * Handwerker fotografiert seinen Meisterbrief; so eine Aufnahme hat 6 bis
 * 10 MB, und er laedt sie im Mobilfunknetz hoch, oft im Keller oder auf der
 * Baustelle. Sein einziger Ausweg war, die App zu beenden. Genau dort gibt er
 * uns sein wichtigstes Dokument.
 *
 * 45 s ist kein Fehler, sondern die Grenze, ab der wir es ansprechen.
 */
export const UPLOAD_ZEITGRENZE_MS = 45_000;

export type UploadErgebnis =
  | { art: 'fertig'; path: string }
  | { art: 'abgebrochen' }
  | { art: 'zeit' };

/**
 * Eine Byte-Groesse, wie sie ein Mensch liest.
 *
 * Bewusst mit Komma und einer Nachkommastelle ab 1 MB: "6,2 MB" sagt mehr als
 * "6488064 Bytes" und mehr als "6 MB".
 */
export function dateiGroesse(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Hochladen mit einem Ausweg: der Nutzer bricht ab, oder die Zeitgrenze greift.
 *
 * EHRLICHE GRENZE, die in der Oberflaeche auch so steht: Der Supabase-Client
 * kann eine laufende Uebertragung NICHT abbrechen — `FileOptions` kennt kein
 * `signal` (geprueft in @supabase/storage-js 2.108). Abgebrochen wird also das
 * WARTEN, nicht die Uebertragung. Die Datei kann danach trotzdem im Bucket
 * landen.
 *
 * Das ist unschaedlich, weil `buildDocPath` `Date.now()` enthaelt: jeder
 * Versuch bekommt einen eigenen Pfad, ein zweiter Anlauf kollidiert nicht, und
 * ins Profil kommt nur der Pfad des Versuchs, der wirklich fertig wurde.
 * Zurueck bleiben hoechstens verwaiste Objekte im Bucket — Hausputz, kein
 * Korrektheitsproblem.
 *
 * KEIN Prozentbalken. React Native liefert fuer diesen Weg keine echten
 * uebertragenen Bytes, und ein Balken, der auf einer Uhr statt auf Bytes
 * laeuft, ist eine Luege — dieselbe Klasse wie ein gruener Haken, der nichts
 * prueft. Lieber Name, Groesse und ein ehrliches "wird uebertragen".
 */
export async function uploadDocMitAusstieg(
  kind: DocKind,
  doc: PickedDoc,
  abbruch: Promise<void>,
  zeitgrenzeMs: number = UPLOAD_ZEITGRENZE_MS,
): Promise<UploadErgebnis> {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<UploadErgebnis>([
      uploadDoc(kind, doc).then((path) => ({ art: 'fertig' as const, path })),
      abbruch.then(() => ({ art: 'abgebrochen' as const })),
      new Promise<UploadErgebnis>((auf) => {
        uhr = setTimeout(() => auf({ art: 'zeit' as const }), zeitgrenzeMs);
      }),
    ]);
  } finally {
    if (uhr) clearTimeout(uhr);
  }
}

/**
 * Einreichung zur Prüfung: Pfade + kyc_status 'in_review' in einem Update
 * (Guard 037 verlangt gewerbeschein_path beim Übergang).
 */
/**
 * Nachbarschaftshelfer: Erklaerung festhalten UND zur Pruefung einreichen.
 *
 * ANLASS (20.09.2026): Diesen Weg gab es nicht. `submitForReview` verlangt
 * einen Gewerbeschein, der Nachbarschaftszweig hat keinen, und er rief die
 * Funktion auch gar nicht auf. Ein Helfer blieb deshalb dauerhaft auf
 * `kyc_status = 'pending'` -- das Pruef-Postfach sah ihn nie, und eine
 * Entscheidung bekam er nie.
 *
 * Die Reihenfolge ist nicht beliebig: erst der Nachweis, dann der Uebergang.
 * Der Schutz in 0990 laesst den Uebergang nur zu, WENN die Erklaerung schon
 * in der Datenbank steht. Andersherum gaebe es einen Helfer in der Pruefung
 * ohne Nachweis.
 */
export async function erklaereVolljaehrigkeitUndEinreichen(
  fassung: string,
  angezeigterText: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Keine Sitzung.');

  const { error: nachweisFehler } = await supabase
    .from('volljaehrigkeits_erklaerungen')
    .upsert({
      helfer_id: session.user.id,
      fassung,
      angezeigter_text: angezeigterText,
      erklaert_am: new Date().toISOString(),
    }, { onConflict: 'helfer_id' });
  if (nachweisFehler) throw new Error('Einreichung fehlgeschlagen. Bitte erneut versuchen.');

  const { error } = await supabase
    .from('provider_profiles')
    .update({ kyc_status: 'in_review' })
    .eq('id', session.user.id);
  if (error) throw new Error('Einreichung fehlgeschlagen. Bitte erneut versuchen.');
}

export async function submitForReview(paths: {
  gewerbeschein: string;
  meisterbrief?: string | null;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Keine Sitzung.');

  const { error } = await supabase
    .from('provider_profiles')
    .update({
      gewerbeschein_path: paths.gewerbeschein,
      meisterbrief_path: paths.meisterbrief ?? null,
      kyc_status: 'in_review',
    })
    .eq('id', session.user.id);
  if (error) throw new Error('Einreichung fehlgeschlagen. Bitte erneut versuchen.');
}
