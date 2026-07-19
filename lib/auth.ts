import { Platform } from 'react-native';
import { supabase } from './supabase';
import { showAlert } from './alert';
import { UserRole } from './database.types';

// ── Error mapping ─────────────────────────────────────────────

export function authErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Ein unbekannter Fehler ist aufgetreten.';
  const msg = err.message.toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'E-Mail-Adresse oder Passwort falsch.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Bitte bestätigen Sie Ihre E-Mail-Adresse. Prüfen Sie Ihren Posteingang.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an.';
  }
  if (msg.includes('password should be') || msg.includes('too short')) {
    return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('load failed')) {
    return 'Der Server ist gerade nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es in Kürze erneut.';
  }
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return 'Diese Anmelde-Methode ist noch nicht freigeschaltet. Bitte nutzen Sie vorerst E-Mail und Passwort.';
  }
  return err.message;
}

// ── OAuth (Apple / Google) ────────────────────────────────────

export type OAuthProvider = 'apple' | 'google';

/**
 * Social-Login über Supabase OAuth.
 * Web: voller Redirect zu Supabase → Provider → zurück auf die Login-Route;
 * supabase-js (detectSessionInUrl-Default) übernimmt die Tokens beim
 * Rücksprung, AuthContext.onAuthStateChange setzt die Session, der
 * Login-Screen leitet dann weiter.
 * Native: kommt mit dem EAS-Build (SIWA-Capability + In-App-Browser) —
 * bis dahin klare Ansage statt totem Button.
 * Voraussetzung serverseitig: Provider im Supabase-Dashboard aktivieren
 * (siehe docs/todo/OFFENE-FOUNDER-TODOS.md) — sonst kommt „provider is
 * not enabled" zurück (gemappt in authErrorMessage).
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  if (Platform.OS !== 'web') {
    showAlert(
      'In der App-Version verfügbar',
      `${provider === 'apple' ? 'Apple' : 'Google'}-Login kommt mit der App-Store-Version. Bitte nutzen Sie bis dahin E-Mail und Passwort.`,
      [{ text: 'OK' }],
    );
    return;
  }
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) throw error;
}

// ── Auth operations ───────────────────────────────────────────

export async function signIn(
  email: string,
  password: string,
): Promise<{ userId: string; role: UserRole }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Anmeldung fehlgeschlagen.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle<{ role: UserRole }>();

  if (profileError) throw new Error(`Profil konnte nicht geladen werden. (${profileError.message})`);

  // Selbstheilung: Auth-User ohne Profil (z. B. nach DB-Reset, bei dem der
  // handle_new_user-Trigger nicht rückwirkend feuert) bekommt sein Profil
  // aus den Session-Metadaten neu angelegt, statt den Login hart zu blockieren.
  if (!profile) {
    const meta = data.user.user_metadata ?? {};
    const metaRole = meta.role === 'provider' ? 'provider' : 'customer';
    const name =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (data.user.email ? data.user.email.split('@')[0] : 'Nutzer');
    const { error: insertError } = await supabase.from('profiles').insert({
      id: data.user.id,
      role: metaRole,
      full_name: name,
      display_name: name,
      email: data.user.email ?? null,
      phone: typeof meta.phone === 'string' ? meta.phone : null,
      plz: typeof meta.plz === 'string' ? meta.plz : null,
      city: typeof meta.city === 'string' ? meta.city : null,
    });
    if (insertError) throw new Error(`Profil konnte nicht angelegt werden. (${insertError.message})`);
    if (metaRole === 'provider') {
      // Fehler hier ignorieren: Provider-Profil ist optional beim ersten Login,
      // Screens tolerieren die fehlende Zeile (Migration 033). Trigger/Backfill
      // ziehen es serverseitig nach.
      await supabase.from('provider_profiles').insert({ id: data.user.id });
    }
    return { userId: data.user.id, role: metaRole };
  }

  return { userId: data.user.id, role: profile.role };
}

export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  plz: string;
  city: string;
  role: UserRole;
  accountType?: 'private' | 'business';
  companyName?: string;
  ustId?: string;
}): Promise<{ userId: string; needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        phone: params.phone,
        plz: params.plz,
        city: params.city,
        role: params.role,
        account_type: params.accountType ?? 'private',
        company_name: params.companyName ?? null,
        ust_id: params.ustId ?? null,
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registrierung fehlgeschlagen.');
  // Ist die E-Mail-Bestätigung aktiv, liefert Supabase KEINE Session zurück —
  // der Nutzer muss erst den Link in der Mail klicken. Ohne Session darf er
  // nicht in den geschützten Bereich navigiert werden.
  return { userId: data.user.id, needsEmailConfirmation: data.session == null };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── E-Mail-Verifikation (Gate für transaktionale Aktionen) ────
// "Confirm email" ist im Supabase-Dashboard deaktiviert (Free-Tier-SMTP-
// Limit) — Nutzer sind sofort eingeloggt. Verifiziert wird über die eigene
// verify-email Edge Function (Resend-DOI → profiles.email_verified_at).
// Die DB erzwingt das Gate serverseitig (Migration 0400); diese Helfer
// liefern die freundliche UX davor.

const SUPABASE_URL = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';

export async function isEmailVerified(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('email_verified_at')
    .eq('id', userId)
    .maybeSingle<{ email_verified_at: string | null }>();
  return data?.email_verified_at != null;
}

/** Schickt die Bestätigungs-Mail (erneut) über die verify-email Edge Function. */
export async function sendVerificationEmail(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Nicht eingeloggt');
  const base = SUPABASE_URL || (supabase as any).supabaseUrl || '';
  const res = await fetch(`${base}/functions/v1/verify-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Mail konnte nicht gesendet werden');
}

/**
 * true = verifiziert, weitermachen. false = Hinweis mit "Mail erneut senden"
 * wurde gezeigt. Serverseitig erzwingt Migration 0400 das Gate ohnehin —
 * das hier ist die freundliche Vorstufe.
 */
export async function requireVerifiedEmail(
  user: { id: string; email?: string | null; email_confirmed_at?: string | null } | null | undefined,
): Promise<boolean> {
  if (!user) return false;
  // Alt-Nutzer mit Supabase-Bestätigung sind verifiziert (Backfill in 0400).
  if (user.email_confirmed_at != null) return true;
  if (await isEmailVerified(user.id)) return true;
  showAlert(
    'E-Mail bestätigen',
    'Bitte bestätige zuerst deine E-Mail-Adresse (Link in deinem Postfach). Erst danach kannst du Aufträge aufgeben oder Angebote abgeben und annehmen.',
    [
      { text: 'Später' },
      {
        text: 'Mail erneut senden',
        onPress: () => {
          sendVerificationEmail()
            .then(() => showAlert('Verschickt', 'Bestätigungs-Mail ist unterwegs — bitte auch den Spam-Ordner prüfen.'))
            .catch(() => showAlert('Senden fehlgeschlagen', 'Bitte in ein paar Minuten erneut versuchen.'));
        },
      },
    ],
  );
  return false;
}
