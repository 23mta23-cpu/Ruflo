import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ProviderLayout() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  // Rollen-Riegel. Bis hierher hatte dieses Layout KEINEN -- es enthielt nur
  // Badge-Logik. Die Kunden-Home hat die Gegenrichtung seit dem
  // Founder-Report vom 16.07. abgesichert (app/(tabs)/index.tsx: Anbieter ohne
  // aktives 'customer'-Flag zurueck ins Dashboard), hier fehlte das Gegenstueck.
  //
  // Praktische Folge ohne den Riegel: `/auftraege` und `/nachrichten` gibt es
  // in BEIDEN Routen-Gruppen, und Gruppen erzeugen kein Adress-Segment. Wer
  // abgemeldet ein Lesezeichen oeffnet oder einen geteilten Link anklickt,
  // bekam unter `/auftraege` das Handwerker-Dashboard samt "Escrow (aktiv)"
  // und "Ausgezahlt gesamt" zu sehen -- dieselbe Vermischung wie im
  // Founder-Report, nur ueber die Adresse statt ueber die Navigation.
  //
  // Das ist eine Abmilderung, nicht die Wurzel: die Adressen bleiben
  // mehrdeutig, bis die Anbieter-Gruppe ein eigenes Pfad-Segment bekommt.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (role !== 'provider') { router.replace('/(tabs)/'); return; }
    // Ein Anbieter darf bewusst in die Kundenansicht wechseln (ein Konto, zwei
    // Welten). Hat er das getan, gehoert er nicht hierher. Spiegelbildlich zu
    // (tabs)/index.tsx -- die Bedingungen schliessen sich aus, es kann keine
    // Weiterleitungsschleife entstehen.
    AsyncStorage.getItem('werkr_active_view').then((v) => {
      if (v === 'customer') router.replace('/(tabs)/');
    });
  }, [authLoading, user, role, router]);

  // Waehrend der Pruefung nichts zeigen: sonst blitzt die Anbieter-Oberflaeche
  // fuer einen Moment auf, bevor umgeleitet wird.
  const darfHierSein = !authLoading && !!user && role === 'provider';
  // In-App-Signal für neue Aufträge (BUG 9): Zahl offener Aufträge in den
  // eigenen Kategorien, auf die noch kein eigenes Angebot existiert.
  // Realtime-Insert-Subscription hält den Badge aktuell, ohne Read-Tracking-
  // Migration — bewusst als Näherung (Zähler verschwindet nach Angebotsabgabe).
  const [openCount, setOpenCount] = useState(0);
  // Ungelesene Nachrichten im eigenen Anbieter-Thread (provider_id = ich).
  const [unreadMsgs, setUnreadMsgs] = useState(0);

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

    async function loadUnread() {
      try {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', user!.id)
          .is('read_at', null)
          .neq('sender_id', user!.id);
        if (mounted) setUnreadMsgs(count ?? 0);
      } catch { /* Badge ist Komfort — Fehler still ignorieren */ }
    }

    loadCount();
    loadUnread();
    const channel = supabase
      .channel('provider-new-jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, loadCount)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'offers' }, loadCount)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, loadUnread)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [user]);

  if (!darfHierSein) return null;

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
        name="nachrichten"
        options={{
          title: 'Nachrichten',
          tabBarBadge: unreadMsgs > 0 ? (unreadMsgs > 9 ? '9+' : unreadMsgs) : undefined,
          tabBarBadgeStyle: { backgroundColor: C.primary, color: C.surface, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
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
      {/* Kein Tab — erreichbar über Dashboard-Kacheln und Profil → Statistik.
          Ohne diesen Eintrag legt expo-router automatisch einen Tab an. */}
      <Tabs.Screen name="statistik" options={{ href: null }} />
    </Tabs>
  );
}
