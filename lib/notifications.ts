/**
 * Werkant Push Notification Layer
 *
 * Handles:
 *  - Permission requests + Expo push token registration
 *  - Storing the push token on the user's profile in Supabase
 *  - Remote push delivery via sendPushToUser() -> send-push Edge Function -> Expo
 *  - Navigation on notification tap
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Opt-out lebt in werkr_prefs_v1.pushNotifs (Einstellungen-Toggle).
// Wird hier zentral geprüft, damit App-Start/Sign-in den Token nicht
// wieder registrieren, nachdem der Nutzer Push abgeschaltet hat.
const PREFS_KEY = 'werkr_prefs_v1';

export async function isPushOptedOut(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as { pushNotifs?: boolean };
    return p.pushNotifs === false;
  } catch {
    return false;
  }
}

// ── Foreground behaviour ───────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// ── Android channel ───────────────────────────────────────────────────────────

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('werkr-default', {
    name: 'Werkant',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f0f0f',
  });
}

// ── Permission + token ────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Register push token for the current authenticated user.
 * Stores in profiles.push_token column (requires migration 009).
 * Safe to call on app start — silently skips if push not supported.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (await isPushOptedOut()) return;

  const token = await getExpoPushToken();
  if (!token) return;

  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}

/**
 * Push-Abmeldung: entfernt den Token serverseitig, damit send-push den
 * Nutzer wirklich nicht mehr erreicht (Toggle war vorher nur lokal).
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('id', user.id);
  } catch (e) {
    console.warn('unregisterPushToken failed:', e);
  }
}

// ── Server-push helper (client → send-push Edge Function → Expo → device) ─────
// Routes through the send-push Edge Function so service_role reads the token
// (RLS blocks direct cross-user push_token reads from the client).
// Requires: caller and target share at least one job or contract.
// Fire-and-forget: errors are logged, never thrown to callers.
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const supabaseUrl = (supabase as any).supabaseUrl as string;
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ to_user_id: userId, title, body, data }),
    });
  } catch (e) {
    console.warn('sendPushToUser failed:', e);
  }
}

/**
 * Nach dem Anlegen eines Auftrags passende Anbieter informieren
 * (Edge Function: Push + optionale Resend-Mail). Fire-and-forget.
 */
export async function notifyMatchingProviders(jobId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const supabaseUrl = (supabase as any).supabaseUrl as string;
    await fetch(`${supabaseUrl}/functions/v1/notify-matching-providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch (e) {
    console.warn('notifyMatchingProviders failed:', e);
  }
}

/** Convenience: request permission, get token, persist to DB for current session user. */
export async function registerForPushNotificationsAsync(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await registerPushToken(user.id);
}

// ── Notification response handler (tap → navigate) ────────────────────────────

export type NotificationNavigator = (screen: string, params?: Record<string, string>) => void;

export function addNotificationResponseListener(
  navigate: NotificationNavigator,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string>;
    const screen = data?.screen;
    if (!screen) return;

    const params: Record<string, string> = {};
    if (data.jobId)      params.jobId      = data.jobId;
    if (data.contractId) params.contractId = data.contractId;

    navigate(screen, params);
  });
}
