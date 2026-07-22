import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getUnreadCounts } from '../../lib/messages';

export default function TabLayout() {
  // Feste height ohne Inset schob die Tab-Bar unter den Home-Indicator
  // (native Geräte mit Notch + iOS Safari mit viewport-fit=cover).
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // Badge „neue Nachricht": Summe ungelesener Nachrichten über alle
  // (Auftrag, Anbieter)-Threads. Realtime hält den Zähler aktuell (Insert =
  // neue Nachricht, Update = Lesehaken gesetzt → Zähler sinkt).
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    let mounted = true;

    async function loadCount() {
      try {
        const counts = await getUnreadCounts(user!.id);
        if (!mounted) return;
        setUnread(Object.values(counts).reduce((a, b) => a + b, 0));
      } catch { /* Badge ist Komfort — Fehler still ignorieren */ }
    }

    loadCount();
    const channel = supabase
      .channel('customer-unread-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadCount)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, loadCount)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderColor: C.border,
          borderWidth: 1,
          borderTopWidth: 1,
          borderTopColor: C.border,
          borderRadius: 24,
          marginHorizontal: 12,
          marginBottom: 8,
          shadowColor: '#1A1917',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Entdecken',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="auftraege"
        options={{
          title: 'Aufträge',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nachrichten"
        options={{
          title: 'Nachrichten',
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: C.primary, color: C.surface, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="konto"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
