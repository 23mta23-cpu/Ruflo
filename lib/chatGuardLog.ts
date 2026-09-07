// Das Schreiben der Leck-Vermerke — getrennt von den reinen Textregeln in
// lib/chatGuard.ts, damit jene ohne Datenbank (und damit in Jest) pruefbar
// sind.
//
// GRENZE, die hier hingehoert: geschrieben wird vom Client des ABSENDERS, und
// die Zeilen-Policy in 0340 laesst auch nur ihn schreiben. Wer die App
// umgeht, erzeugt keinen Vermerk. Der unabhaengige Weg ist die Meldung durch
// den Empfaenger (chat_reports, 0700) — und seit 07.09.2026 der Hinweis, den
// kontaktHinweis() auf dem Geraet des LESERS erzeugt.
import { supabase } from './supabase';
import type { LeakType } from './chatGuard';

export function logLeakEvent(jobId: string, senderId: string, types: LeakType[]) {
  supabase
    .from('chat_leak_flags')
    .insert({ job_id: jobId, sender_id: senderId, leak_types: types })
    .then(({ error }) => {
      if (error) console.warn('logLeakEvent failed:', error);
    });
}
