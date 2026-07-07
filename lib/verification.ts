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
 * Einreichung zur Prüfung: Pfade + kyc_status 'in_review' in einem Update
 * (Guard 037 verlangt gewerbeschein_path beim Übergang).
 */
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
