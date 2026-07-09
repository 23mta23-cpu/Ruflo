import { supabase } from './supabase';
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
  return err.message;
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

  if (profileError) throw new Error('Profil konnte nicht geladen werden.');

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
    if (insertError) throw new Error('Profil konnte nicht geladen werden.');
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
