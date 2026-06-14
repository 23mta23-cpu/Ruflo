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
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.';
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
    .single<{ role: UserRole }>();

  if (profileError || !profile) throw new Error('Profil konnte nicht geladen werden.');
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
}): Promise<{ userId: string }> {
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
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registrierung fehlgeschlagen.');
  return { userId: data.user.id };
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

export async function getUserRole(): Promise<UserRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: UserRole }>();

  return data?.role ?? null;
}
