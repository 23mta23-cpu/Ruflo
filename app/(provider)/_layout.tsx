import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ProviderLayout() {
  const { user } = useAuth();
  // In-App-Signal für neue Aufträge (BUG 9): Zahl offener Aufträge in den
  // eigenen Kategorien, auf die noch kein eigenes Angebot existiert.
  // Realtime-Insert-Subscription hält den Badge aktuell, ohne Read-Tracking-
  // Migration — bewusst als Näherung (Zähler verschwindet nach Angebotsabgabe).
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    let mounted = true;

    async function loadCount() {
      try {
        const { data: me } = await supabase
          .from('provider_profiles')
          .select('category_ids, is_nachbarschaft')
          .eq('id', user!.id)
          .maybeSingle<{ category_ids: string[]; is_nachbarschaft: boolean }>();
        let q = supabase.from('jobs').select('id, offers!left(provider_id)').eq('status', 'open').eq('track', me?.is_nachbarschaft ? 'nachbarschaft' : 'handwerker').limit(50);
        if (me?.category_ids?.length) q = q.in('category_id', me.category_ids);
        const { data: jobs } = await q;
        if (!mounted) return;
        const fresh = (jobs ?? []).filter((j) =>
          !(j.offers as { provider_id: string }[] | null)?.some((o) => o.provider_id === user!.id));
        setOpenCount(fresh.length);
      } catch { /* Badge ist Komfort — Fehler still ignorieren */ }
    }

    loadCount();
    const channel = supabase
      .channel('provider-new-jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, loadCount)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'offers' }, loadCount)
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
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Übersicht',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="auftraege"
        options={{
          title: 'Aufträge',
          tabBarBadge: openCount > 0 ? (openCount > 9 ? '9+' : openCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: C.primary, color: C.surface, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kalender"
        options={{
          title: 'Kalender',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Kein Tab — erreichbar über Profil → Auszahlungen */}
      <Tabs.Screen name="onboarding-stripe" options={{ href: null }} />
      {/* Kein Tab — erreichbar über Dashboard-Banner und Profil */}
      <Tabs.Screen name="pro" options={{ href: null }} />
      {/* Kein Tab — geöffnet aus Aufträge-Tab wenn Angebot erstellt wird */}
      <Tabs.Screen name="angebot-erstellen" options={{ href: null }} />
      {/* Kein Tab — erreichbar über Profil → Mein Profil bearbeiten */}
      <Tabs.Screen name="profil-bearbeiten" options={{ href: null }} />
    </Tabs>
  );
}
