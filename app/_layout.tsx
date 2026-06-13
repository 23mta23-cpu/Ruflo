import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { DsgvoConsent } from '../components/ui/DsgvoConsent';
import { GlobalAlert } from '../components/ui/GlobalAlert';
import { C } from '../constants/colors';

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
    const ds = document.createElement('style');
    ds.id = DS_ID;
    ds.textContent = `
      /* ─── Design tokens ─── */
      :root {
        --bg-canvas: #f8fafc; --bg-surface: #ffffff; --bg-surface-2: #f1f5f9;
        --ink: #0f172a; --text-2: #334155; --muted: #64748b; --disabled: #94a3b8;
        --craft: #ea580c; --craft-bg: rgba(234,88,12,0.06);
        --nbhd: #059669;  --nbhd-bg: rgba(5,150,105,0.06);
        --border: #e2e8f0; --border-sub: #f1f5f9;
        --shadow-bento: 0px 2px 4px rgba(15,23,42,0.01), 0px 12px 32px rgba(15,23,42,0.03);
        --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
        --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* ─── Base ─── */
      body, #root {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
        background-color: #f8fafc !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        letter-spacing: -0.015em;
      }

      /* ─── Phone frame on large screens ─── */
      @media (min-width: 600px) {
        body {
          background: linear-gradient(155deg, #dde3ed 0%, #e8eef6 50%, #edf1f7 100%) !important;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          min-height: 100vh;
          padding: 28px 16px;
          box-sizing: border-box;
        }
        #root {
          max-width: 430px;
          width: 100%;
          min-height: calc(100svh - 56px);
          border-radius: 44px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(15,23,42,0.07),
            0 2px 4px rgba(15,23,42,0.04),
            0 12px 40px rgba(15,23,42,0.08),
            0 40px 100px rgba(15,23,42,0.10);
          background: #f8fafc;
          position: relative;
        }
        /* Notch accent on the frame */
        #root::before {
          content: '';
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 4px;
          background: rgba(15,23,42,0.12);
          border-radius: 2px;
          z-index: 9999;
          pointer-events: none;
        }
      }

      /* ─── Global micro-interactions ─── */
      [role="button"] {
        cursor: pointer;
        transition: opacity 0.14s ease, transform 0.12s ease !important;
      }
      [role="button"]:hover { opacity: 0.86 !important; }
      [role="button"]:active { transform: scale(0.96) !important; opacity: 1 !important; }

      /* ─── Input transitions ─── */
      input, textarea {
        transition: border-color 0.15s ease, box-shadow 0.2s ease !important;
      }

      /* ─── Smooth scrolling ─── */
      * { scroll-behavior: smooth; }

      /* ─── Thin premium scrollbar ─── */
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

      /* ─── Brand selection colour ─── */
      ::selection { background: rgba(234,88,12,0.12); color: inherit; }

      /* ─── Screen entrance animation ─── */
      @keyframes werkrFadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes werkrFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
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
    </SafeAreaProvider>
  );
}
