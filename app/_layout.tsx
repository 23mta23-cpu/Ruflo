import React, { useState, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Skeleton } from '../components/ui/Skeleton';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { DsgvoConsent } from '../components/ui/DsgvoConsent';
import { GlobalAlert } from '../components/ui/GlobalAlert';
import { C } from '../constants/colors';
import { AuthProvider } from '../contexts/AuthContext';

// Web only: the browser's default focus outline sits around the native <input>,
// which on RN-Web is rendered *inside* our bordered field wrapper. That makes the
// blue ring look larger than and offset from the white field. We replace it with a
// branded, border-radius-aware focus ring so focus stays visible but aligned.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'werkr-web-input-overrides';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input, textarea, select { outline: none !important; }
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08) !important;
        border-color: #0f172a !important;
        border-radius: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  // V2 Design System — Plus Jakarta Sans + CSS custom properties
  const FONT_ID = 'werkr-ds-font';
  if (!document.getElementById(FONT_ID)) {
    const link = document.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }
  const DS_ID = 'werkr-ds-v2';
  if (!document.getElementById(DS_ID)) {
    // Link the canonical CSS file from public/
    const link = document.createElement('link');
    link.id = DS_ID;
    link.rel = 'stylesheet';
    link.href = '/Ruflo/werkr-design-system-v2.css';
    document.head.appendChild(link);
    // Inline fallback for tokens that need to be available before the link loads
    const ds = document.createElement('style');
    ds.id = DS_ID + '-inline';
    ds.textContent = `
      body, #root {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
        background-color: #f8fafc !important;
        -webkit-font-smoothing: antialiased;
        letter-spacing: -0.015em;
      }
      /* Mobile web — iOS Safari safe area fix (viewport-fit=cover in +html.tsx) */
      @media (max-width: 599px) {
        body {
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
        }
        #root {
          min-height: 100svh;
        }
      }
      @media (min-width: 600px) {
        body {
          background: linear-gradient(155deg, #dde3ed 0%, #e8eef6 50%, #edf1f7 100%) !important;
          display: flex; align-items: flex-start; justify-content: center;
          min-height: 100vh; padding: 28px 16px; box-sizing: border-box;
        }
        #root {
          max-width: 430px; width: 100%;
          min-height: calc(100svh - 56px);
          border-radius: 44px; overflow: hidden;
          box-shadow: 0 0 0 1px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.09), 0 40px 100px rgba(15,23,42,0.10);
          background: #f8fafc; position: relative;
        }
        #root::before {
          content: ''; position: absolute; top: 14px; left: 50%;
          transform: translateX(-50%); width: 120px; height: 4px;
          background: rgba(15,23,42,0.12); border-radius: 2px; z-index: 9999; pointer-events: none;
        }
      }
      [role="button"] { cursor: pointer; transition: opacity 0.12s ease, transform 0.12s ease !important; }
      [role="button"]:hover { opacity: 0.87 !important; }
      [role="button"]:active { transform: scale(0.96) !important; opacity: 1 !important; }
      input, textarea { transition: border-color 0.15s ease, box-shadow 0.2s ease !important; }
      * { scroll-behavior: smooth; }
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      ::selection { background: rgba(234,88,12,0.12); color: inherit; }
      @keyframes werkrPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
    `;
    document.head.appendChild(ds);
  }
}

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
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 64 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <Skeleton width={32} height={32} radius={8} />
            <Skeleton width={80} height={20} radius={8} />
          </View>
          <Skeleton height={180} radius={16} style={{ marginBottom: 16 }} />
          <Skeleton height={56} radius={14} style={{ marginBottom: 12 }} />
          <Skeleton height={56} radius={14} style={{ marginBottom: 24 }} />
          <Skeleton width="50%" height={13} radius={6} style={{ alignSelf: 'center' }} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
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
        <Stack.Screen name="meine-anbieter" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="nachrichten" options={{ presentation: 'card' }} />
        <Stack.Screen name="zahlungsmethoden" options={{ presentation: 'card' }} />
        <Stack.Screen name="angebot" options={{ presentation: 'card' }} />
        <Stack.Screen name="vertrag" options={{ presentation: 'card' }} />
        <Stack.Screen name="auftrag-abschliessen" options={{ presentation: 'card' }} />
        <Stack.Screen name="bewertung" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reklamation" options={{ presentation: 'modal' }} />
        <Stack.Screen name="einstellungen" options={{ presentation: 'card' }} />
        <Stack.Screen name="registrierung" options={{ presentation: 'card' }} />
        <Stack.Screen name="login" options={{ presentation: 'card' }} />
        <Stack.Screen name="auftrag-aufgeben" options={{ presentation: 'card' }} />
        <Stack.Screen name="auftrag-detail" options={{ presentation: 'card' }} />
        <Stack.Screen name="bewerbung-eingegangen" options={{ presentation: 'card' }} />
        <Stack.Screen name="benachrichtigungen" options={{ presentation: 'card' }} />
        <Stack.Screen name="rechnung" options={{ presentation: 'card' }} />
        <Stack.Screen name="widerruf" options={{ presentation: 'card' }} />
        <Stack.Screen name="datenschutz" options={{ presentation: 'card' }} />
        <Stack.Screen name="agb" options={{ presentation: 'card' }} />
        <Stack.Screen name="impressum" options={{ presentation: 'card' }} />
        <Stack.Screen name="support-chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="anbieter" options={{ presentation: 'card' }} />
      </Stack>
      {consentGiven === false && (
        <DsgvoConsent visible={true} onAccept={handleAccept} />
      )}
      <GlobalAlert />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
