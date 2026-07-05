import React, { useState, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { StripeProvider } from '../lib/stripe';
import { DsgvoConsent } from '../components/ui/DsgvoConsent';
import { ToastProvider } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { C } from '../constants/colors';
import { AuthProvider } from '../contexts/AuthContext';
import { addNotificationResponseListener, registerForPushNotificationsAsync } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';

function NotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    // Register push token on mount (fire-and-forget — persists token to DB)
    registerForPushNotificationsAsync().catch(() => {});
    const sub = addNotificationResponseListener((screen, params) => {
      router.push(params && Object.keys(params).length ? { pathname: screen as any, params } : (screen as any));
    });
    return () => sub.remove();
  }, [router]);

  // Handle Supabase password-recovery deep links:
  // werkr://reset-password#access_token=...&refresh_token=...&type=recovery
  useEffect(() => {
    async function handleUrl(url: string) {
      const fragment = url.split('#')[1] ?? '';
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params['type'] === 'recovery' && params['access_token'] && params['refresh_token']) {
        await supabase.auth.setSession({
          access_token: params['access_token'],
          refresh_token: params['refresh_token'],
        });
        router.push('/reset-password');
      }
    }
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => { handleUrl(url).catch(() => {}); });
    return () => sub.remove();
  }, [router]);

  return null;
}

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('werkr_consent_v1').then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        setConsentGiven(parsed?.accepted === true);
      } catch {
        setConsentGiven(raw === 'true');
      }
    });
    trackEvent('app_open');
  }, []);

  async function handleAccept(analytics: boolean) {
    const record = {
      accepted: true,
      analytics,
      pstg: true,
      version: '1.0',
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem('werkr_consent_v1', JSON.stringify(record));
    setConsentGiven(true);
  }

  if (consentGiven === null) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 40, gap: 12, backgroundColor: C.bg }}>
          <Skeleton height={18} borderRadius={9} />
          <Skeleton width="75%" height={14} borderRadius={7} />
          <Skeleton width="55%" height={12} borderRadius={6} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier="merchant.de.werkr.app">
      <AuthProvider>
      <ToastProvider>
      <StatusBar style="dark" />
      <NotificationRouter />
      {/* Web frame: centers every screen in a phone-width canvas instead of
          stretching edge-to-edge in the browser. No-op on native. */}
      <View style={webFrame.outer}>
      <View style={webFrame.inner}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="landing" />
        <Stack.Screen name="login" options={{ presentation: 'card' }} />
        <Stack.Screen name="registrierung" options={{ presentation: 'card' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="onboarding-kyc" />
        <Stack.Screen name="bewerbung-eingegangen" options={{ presentation: 'card' }} />
        <Stack.Screen name="bewerbung-abgelehnt" options={{ presentation: 'card' }} />
        <Stack.Screen name="passwort-vergessen" options={{ presentation: 'card' }} />
        <Stack.Screen name="reset-password" options={{ presentation: 'card' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(provider)" />
        <Stack.Screen name="nachbarschaft" options={{ presentation: 'card' }} />
        <Stack.Screen name="nachbarschaft-profil" options={{ presentation: 'card' }} />
        <Stack.Screen name="suche" options={{ presentation: 'card' }} />
        <Stack.Screen name="anbieter" options={{ presentation: 'card' }} />
        <Stack.Screen name="profil" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="auftrag-aufgeben" options={{ presentation: 'card' }} />
        <Stack.Screen name="auftrag-detail" options={{ presentation: 'card' }} />
        <Stack.Screen name="angebot" options={{ presentation: 'card' }} />
        <Stack.Screen name="vertrag" options={{ presentation: 'card' }} />
        <Stack.Screen name="zahlung" options={{ presentation: 'card' }} />
        <Stack.Screen name="auftrag-abschliessen" options={{ presentation: 'card' }} />
        <Stack.Screen name="bewertung" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reklamation" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stornierung" options={{ presentation: 'modal' }} />
        <Stack.Screen name="einstellungen" options={{ presentation: 'card' }} />
        <Stack.Screen name="benachrichtigungen" options={{ presentation: 'card' }} />
        <Stack.Screen name="zahlungsmethoden" options={{ presentation: 'card' }} />
        <Stack.Screen name="garantie" options={{ presentation: 'card' }} />
        <Stack.Screen name="meine-anbieter" options={{ presentation: 'card' }} />
        <Stack.Screen name="nachrichten" options={{ presentation: 'card' }} />
        <Stack.Screen name="support-chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="rechnung" options={{ presentation: 'card' }} />
        <Stack.Screen name="agb" options={{ presentation: 'card' }} />
        <Stack.Screen name="datenschutz" options={{ presentation: 'card' }} />
        <Stack.Screen name="impressum" options={{ presentation: 'card' }} />
        <Stack.Screen name="widerruf" options={{ presentation: 'card' }} />
      </Stack>
      {consentGiven === false && (
        <DsgvoConsent visible={true} onAccept={handleAccept} />
      )}
      </View>
      </View>
      </ToastProvider>
      </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

// "App im Rahmen": im Browser wird jede Route auf Handy-Breite zentriert,
// mit Bone-Hintergrund links/rechts. Auf iOS/Android sind beide Views
// wirkungslose flex:1-Container.
const webFrame = StyleSheet.create({
  outer: {
    flex: 1,
    ...(Platform.OS === 'web' ? { alignItems: 'center' as const, backgroundColor: '#EAE7E0' } : null),
  },
  inner: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? { maxWidth: 480, backgroundColor: C.bg, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border }
      : null),
  },
});
