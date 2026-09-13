import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { GastLoginHinweis } from '../components/ui/GastLoginHinweis';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchPublicProviders } from '../lib/providerPublic';
import {
  zusammenfuehren, ungeleseneAnzahl, LEER_TITEL, LEER_TEXT, type Mitteilung,
} from '../lib/benachrichtigungen';

// Die Sortier- und Zusammenfuehr-Regeln liegen in lib/benachrichtigungen.ts,
// damit sie mit Jest pruefbar sind. Dieser Bildschirm holt Daten und zeigt sie.
type NotifType =
  | 'offer' | 'escrow' | 'message' | 'review' | 'system' | 'pstg'
  | 'strike' | 'beschraenkung' | 'auszahlung';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `Heute, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return 'Gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string; bg: string }> = {
  offer:   { icon: 'document-text',        color: C.gold,  bg: C.goldBg  },
  escrow:  { icon: 'lock-closed',          color: C.amber, bg: C.amberBg },
  message: { icon: 'chatbubble',           color: C.ink,   bg: C.bg     },
  review:  { icon: 'star',                 color: C.gold,  bg: C.goldBg  },
  pstg:    { icon: 'shield',               color: C.amber, bg: C.amberBg },
  system:  { icon: 'information-circle',   color: C.sub,   bg: C.surface },
  // Pflichtmitteilungen in Ton (C.clay), nicht in Rot: sie sind ernst, aber
  // kein Absturz. C.red bleibt Fehlern vorbehalten.
  strike:        { icon: 'alert-circle',   color: C.clay,  bg: C.bgWarm  },
  beschraenkung: { icon: 'hand-left',      color: C.clay,  bg: C.bgWarm  },
  auszahlung:    { icon: 'cash',           color: C.primary, bg: C.primaryBg },
};

export default function BenachrichtigungenScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Mitteilung[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const abgeleitet: Mitteilung[] = [];
    const gespeichert: Mitteilung[] = [];
    try {
    // Zuerst die gespeicherten Mitteilungen (0860). Nur hier ueberlebt der
    // Gelesen-Status, und nur hier stehen Strike und DSA-Beschraenkung.
    const { data: gespeicherteZeilen } = await supabase
      .from('notifications')
      .select('id, art, titel, text, route, erstellt_am, gelesen_am, pflicht')
      .order('erstellt_am', { ascending: false })
      .limit(50);
    for (const z of gespeicherteZeilen ?? []) {
      gespeichert.push({
        id: (z as any).id,
        art: (z as any).art,
        titel: (z as any).titel,
        text: (z as any).text,
        iso: (z as any).erstellt_am,
        gelesen: (z as any).gelesen_am != null,
        route: (z as any).route,
        gespeichert: true,
        pflicht: (z as any).pflicht === true,
      });
    }

    // Alle Aufträge des Kunden — auch OFFENE ohne Vertrag, damit Vor-Vertrags-
    // Rückfragen (0510) im Center erscheinen (Test-Befund M1).
    const { data: myJobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const jobIds = (myJobs ?? []).map((j) => j.id);

    if (jobIds.length) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, body, created_at, job_id, sender_id, provider_id')
        .in('job_id', jobIds)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      // Anbieternamen der Threads in EINEM Query (Thread = (job, provider)).
      const provIds = Array.from(new Set((msgs ?? []).map((m) => (m as any).provider_id).filter(Boolean)));
      const nameById = new Map<string, string>();
      if (provIds.length) {
        const { data: provs } = await supabase
          .from('provider_public').select('id, business_name').in('id', provIds as string[]);
        for (const p of provs ?? []) nameById.set(p.id, (p as any).business_name ?? 'Anbieter');
      }

      for (const m of msgs ?? []) {
        const pid = (m as any).provider_id as string | null;
        const biz = (pid && nameById.get(pid)) || 'Anbieter';
        abgeleitet.push({
          id: `msg-${m.id}`,
          art: 'message',
          titel: `Neue Nachricht: ${biz}`,
          text: m.body,
          iso: m.created_at,
          gelesen: false,
          // providerId IMMER mitgeben — sonst öffnet der Chat einen toten
          // Thread und Nachrichten gehen still verloren (Test-Befund H1).
          route: `/chat?jobId=${m.job_id}&providerId=${pid ?? ''}`,
          gespeichert: false,
          pflicht: false,
        });
      }
    }

    // Offene Angebote auf den Aufträgen des Kunden
    if (jobIds.length) {
      const { data: offers } = await supabase
        .from('offers')
        .select('id, price, created_at, job_id, provider_id, job:jobs!job_id(title)')
        .eq('status', 'pending')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
        .limit(10);

      const offProvMap = await fetchPublicProviders((offers ?? []).map((o: any) => o.provider_id), 'business_name');
      for (const o of offers ?? []) {
        const biz = offProvMap[(o as any).provider_id]?.business_name ?? 'Anbieter';
        const title = (o.job as any)?.title ?? 'Auftrag';
        const price = o.price != null ? ` · €${o.price.toFixed(0)}` : '';
        abgeleitet.push({
          id: `offer-${o.id}`,
          art: 'offer',
          titel: `Neues Angebot von ${biz}`,
          text: `${title}${price}`,
          iso: o.created_at,
          gelesen: false,
          // Angebot = (job, offer.provider_id)-Thread → providerId mitgeben (H1).
          route: `/chat?jobId=${o.job_id}&providerId=${(o as any).provider_id ?? ''}`,
          gespeichert: false,
          pflicht: false,
        });
      }
    }

    setNotifs(zusammenfuehren(gespeichert, abgeleitet));
    } catch {
      // Netzwerk-/Query-Fehler -> Spinner darf nicht ewig drehen.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const unreadCount = ungeleseneAnzahl(notifs);

  /**
   * Gelesen-Status dauerhaft setzen, wo es eine Zeile dafuer gibt.
   *
   * GRENZE, ehrlich benannt: abgeleitete Hinweise (Angebot, Chat-Nachricht)
   * haben keine Zeile in `notifications`. Ihr Gelesen-Status lebt weiterhin
   * nur im Bildschirmzustand und ist beim naechsten Oeffnen wieder da. Das zu
   * aendern hiesse, jedes Angebot und jede Nachricht zusaetzlich in die
   * Tabelle zu spiegeln -- eine zweite Wahrheit ueber denselben Vorgang.
   * Fuer Pflichtmitteilungen, auf die es ankommt, haelt der Status.
   */
  async function merkeGelesen(m: Mitteilung) {
    if (!m.gespeichert) return;
    try {
      await supabase.rpc('benachrichtigung_gelesen', { p_id: m.id });
    } catch {
      // Der Haken im Bildschirm bleibt trotzdem gesetzt. Beim naechsten
      // Oeffnen steht die Mitteilung wieder als ungelesen da, und das ist
      // die richtige Richtung: lieber zweimal zeigen als einmal verlieren.
    }
  }

  function markAllRead() {
    for (const n of notifs) if (!n.gelesen) merkeGelesen(n);
    setNotifs((prev) => prev.map((n) => ({ ...n, gelesen: true })));
  }

  function handlePress(n: Mitteilung) {
    if (!n.gelesen) merkeGelesen(n);
    setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, gelesen: true } : x));
    if (n.route) router.push(n.route as any);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Benachrichtigungen</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={12}>
            <Text style={styles.markRead}>Alle lesen</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.ink} />
        </View>
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!user ? (
          <GastLoginHinweis
            icon="notifications-outline"
            text="Benachrichtigungen zu Ihren Aufträgen und Nachrichten sehen Sie, sobald Sie angemeldet sind."
          />
        ) : !loading && notifs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={C.border} />
            {/* Ein leerer Bildschirm ohne Erklaerung sieht aus wie ein Fehler. */}
            <Text style={styles.emptyText}>{LEER_TITEL}</Text>
            <Text style={styles.emptySub}>{LEER_TEXT}</Text>
          </View>
        ) : (
          notifs.map((n, i) => {
            const cfg = TYPE_CONFIG[n.art] ?? TYPE_CONFIG.system;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.item, !n.gelesen && styles.itemUnread]}
                onPress={() => handlePress(n)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemTop}>
                    <Text style={[styles.itemTitle, !n.gelesen && styles.itemTitleUnread]} numberOfLines={1}>
                      {n.titel}
                    </Text>
                    {!n.gelesen && <View style={styles.unreadDot} />}
                  </View>
                  {/* Pflichtmitteilungen tragen den vollen Begruendungstext
                      (Art. 17 Abs. 3 DSA). Vier Zeilen statt zwei, damit
                      erkennbar ist, worum es geht, bevor man tippt. */}
                  <Text style={styles.itemBody} numberOfLines={n.pflicht ? 4 : 2}>{n.text}</Text>
                  <Text style={styles.itemTime}>{formatTime(n.iso)}</Text>
                </View>

                <Ionicons name="chevron-forward" size={15} color={C.muted} />
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.footer}>
          Push-Benachrichtigungen können in Einstellungen verwaltet werden.
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:           { ...T.lg, ...T.bold, color: C.ink },
  badge:           { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:       { ...T.xs, ...T.bold, color: C.surface },
  markRead:        { ...T.sm, ...T.medium, color: C.sub },
  scroll:          { paddingHorizontal: 20, paddingTop: 4 },
  item:            { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  itemUnread:      { borderColor: C.ink, backgroundColor: C.bg },
  iconWrap:        { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemContent:     { flex: 1 },
  itemTop:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle:       { ...T.sm, ...T.semibold, color: C.ink, flex: 1, marginRight: 8 },
  itemTitleUnread: { fontWeight: '700' },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, flexShrink: 0 },
  itemBody:        { ...T.caption, color: C.sub, marginBottom: 5 },
  itemTime:        { ...T.xs, color: C.muted },
  empty:           { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:       { ...T.base, color: C.ink, fontWeight: '700' as const },
  // minWidth: 0 und eine Breitengrenze, damit der Satz nicht ueber den Rand
  // laeuft (wiederkehrende Klasse im Projekt).
  emptySub:        { ...T.base, color: C.muted, textAlign: 'center' as const,
                     minWidth: 0, maxWidth: 300, lineHeight: 21, marginTop: 4 },
  footer:          { ...T.xs, color: C.muted, textAlign: 'center', marginTop: 8 },
});
