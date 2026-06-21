import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider } from '../lib/stripe';
import { DsgvoConsent } from '../components/ui/DsgvoConsent';
import { ToastProvider } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { C } from '../constants/colors';
import { AuthProvider } from '../contexts/AuthContext';
import { addNotificationResponseListener } from '../lib/notifications';

function NotificationRouter() {
  const router = useRouter();
  useEffect(() => {
    const sub = addNotificationResponseListener((screen, params) => {
      router.push(params && Object.keys(params).length ? { pathname: screen as any, params } : (screen as any));
    });
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="landing" />
        <Stack.Screen name="login" options={{ presentation: 'card' }} />
        <Stack.Screen name="registrierung" options={{ presentation: 'card' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="onboarding-kyc" />
        <Stack.Screen name="bewerbung-eingegangen" options={{ presentation: 'card' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(provider)" />
        <Stack.Screen name="nachbarschaft" options={{ presentation: 'card' }} />
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
        <Stack.Screen name="instant-preise" options={{ presentation: 'card' }} />
      </Stack>
      {consentGiven === false && (
        <DsgvoConsent visible={true} onAccept={handleAccept} />
      )}
      </ToastProvider>
      </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
