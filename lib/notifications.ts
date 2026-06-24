/**
 * WERKR Push Notification Layer
 *
 * Handles:
 *  - Permission requests + Expo push token registration
 *  - Storing the push token on the user's profile in Supabase
 *  - Local notification scheduling (instant feedback)
 *  - Navigation on notification tap
 *
 * Push delivery relies on Expo's push service calling Supabase Edge Functions
 * (to be implemented as a follow-up). Local notifications work today.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

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
    name: 'WERKR',
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
  const token = await getExpoPushToken();
  if (!token) return;

  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}

// ── Local notifications (works without Expo push account) ────────────────────

export async function notifyNewOffer(params: {
  providerName: string;
  jobTitle: string;
  price: number;
  jobId: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Neues Angebot erhalten',
      body: `${params.providerName} hat ein Angebot für „${params.jobTitle}" abgegeben — €${params.price.toFixed(2)}`,
      data: { screen: '/angebot', jobId: params.jobId },
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyOfferAccepted(params: {
  jobTitle: string;
  customerName: string;
  contractId: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Angebot angenommen',
      body: `${params.customerName} hat Ihr Angebot für „${params.jobTitle}" angenommen.`,
      data: { screen: '/chat', contractId: params.contractId },
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyNewMessage(params: {
  senderName: string;
  preview: string;
  jobId: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Neue Nachricht von ${params.senderName}`,
      body: params.preview.length > 80 ? `${params.preview.slice(0, 77)}…` : params.preview,
      data: { screen: '/chat', jobId: params.jobId },
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyContractCompleted(params: {
  jobTitle: string;
  payout: number;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Auftrag abgeschlossen',
      body: `„${params.jobTitle}" wurde abgeschlossen. Auszahlung: €${params.payout.toFixed(2)}`,
      data: { screen: '/(tabs)/auftraege' },
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyEscrowReleased(params: {
  jobTitle: string;
  amount: number;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Zahlung freigegeben',
      body: `Escrow-Zahlung von €${params.amount.toFixed(2)} für „${params.jobTitle}" wurde freigegeben.`,
      data: { screen: '/(provider)/index' },
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyReclamationUpdate(params: {
  jobTitle: string;
  status: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reklamation: Status-Update',
      body: `Reklamation für „${params.jobTitle}": ${params.status}`,
      data: { screen: '/(tabs)/auftraege' },
      sound: true,
    },
    trigger: null,
  });
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
