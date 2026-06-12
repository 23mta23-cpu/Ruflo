import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { DsgvoConsent } from '../components/ui/DsgvoConsent';
import { GlobalAlert } from '../components/ui/GlobalAlert';
import { C } from '../constants/colors';

export default function RootLayout() {
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts(Ionicons.font);

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

  if (!fontsLoaded || consentGiven === null) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
          <ActivityIndicator size="large" color={C.ink} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="onboarding-kyc" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(provider)" />
        <Stack.Screen name="nachbarschaft" options={{ presentation: 'card' }} />
        <Stack.Screen name="suche" options={{ presentation: 'card' }} />
        <Stack.Screen name="profil" options={{ presentation: 'card' }} />
        <Stack.Screen name="meine-anbieter" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="nachrichten" options={{ presentation: 'card' }} />
        <Stack.Screen name="zahlungsmethoden" options={{ presentation: 'card' }} />
        <Stack.Screen name="vertrag" options={{ presentation: 'card' }} />
        <Stack.Screen name="bewertung" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reklamation" options={{ presentation: 'modal' }} />
        <Stack.Screen name="einstellungen" options={{ presentation: 'card' }} />
      </Stack>
      {consentGiven === false && (
        <DsgvoConsent visible={true} onAccept={handleAccept} />
      )}
      <GlobalAlert />
    </SafeAreaProvider>
  );
}
