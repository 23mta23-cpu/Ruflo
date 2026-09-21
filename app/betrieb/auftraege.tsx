import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { aktionsleistenRand } from '../../lib/sichererRand';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { euro } from '../../lib/geld';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { shadow } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';
import { useAuth } from '../../contexts/AuthContext';
import { getMyContractsAsProvider, fertigstellungMelden, type ContractWithJobAndCustomer } from '../../lib/contracts';
import { anzahlText } from '../../lib/mengenText';
import { meineBewerteteVertraege, bewertungsschnitte, type Bewertungsschnitt } from '../../lib/reviews';
import { darfBewerten, fristLage, fristText } from '../../lib/bewertungsFrist';
import { supabase, SUPABASE_FUNCTIONS_URL } from '../../lib/supabase';
import { sendPushToUser } from '../../lib/notifications';
import { toast } from '../../components/ui/Toast';
import { withOneRetry } from '../../lib/retry';
import { sortiereAnfragen, plzBereich, passungText, type Passung } from '../../lib/anfragenSortierung';


type Tab = 'anfragen' | 'aktiv' | 'ausstehend' | 'abgeschlossen';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function customerInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
}

/**
 * Bewertung eines KUNDEN, so wie andere Betriebe sie sehen.
 *
 * Kein Eintrag heisst: noch niemand hat diesen Kunden bewertet. Dann steht
 * hier nichts -- eine 0 oder „keine Bewertungen" waere eine Aussage ueber
 * den Kunden, die niemand getroffen hat.
 */
function KundenSterne({ wert }: { wert?: { schnitt: number; anzahl: number } }) {
  if (!wert) return null;
  return (
    <View style={styles.kundenSterne}>
      <Ionicons name="star" size={12} color={C.gold} />
      <Text style={styles.kundenSterneText}>
        {wert.schnitt.toFixed(1).replace('.', ',')} · {anzahlText(wert.anzahl, 'Bewertung', 'Bewertungen')}
      </Text>
    </View>
  );
}

export default function ProviderAuftraegeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('anfragen');
  // Die Anfragen tragen ihre Passung mit (lib/anfragenSortierung.ts): welche
  // zum eigenen Gewerk und zur eigenen Region gehoeren. GEFILTERT wird nicht --
  // im Kaltstart ist Sichtbarkeit fuer die wenigen Auftraege mehr wert als
  // Genauigkeit. Sortiert und benannt wird schon, sonst schickt die Mitteilung
  // aus 0950 den Betrieb in eine Liste, in der er suchen muss.
  const [leads, setLeads] = useState<Array<{
    id: string; title: string; description: string | null;
    address_city: string | null; address_plz: string | null;
    category_id: string | null; created_at: string; passung: Passung;
  }>>([]);
  const [contracts, setContracts] = useState<ContractWithJobAndCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [bewertet, setBewertet] = useState<Set<string>>(new Set());
  // Founder am 21.09.2026: „Warum kann ich Auftraege in der Liste nicht
  // anklicken?" Die Beschreibung war auf zwei Zeilen begrenzt, und die Karte
  // reagierte auf nichts. Wer den ganzen Text lesen wollte, musste in
  // „Angebot erstellen" — also in den Bildschirm, der ein BINDENDES Angebot
  // abgibt. Lesen darf nicht durch eine Verpflichtung hindurchfuehren.
  const [ausgeklappt, setAusgeklappt] = useState<Set<string>>(new Set());
  const [kundenschnitt, setKundenschnitt] = useState<Record<string, Bewertungsschnitt>>({});

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // Track-Trennung (Founder-Befund 20.07.): Nachbarschaftshelfer sehen
      // nur Nachbarschafts-Anfragen, Handwerksbetriebe nur Handwerk.
      const { data: me } = await supabase
        .from('provider_profiles')
        .select('is_nachbarschaft, category_ids, profile:profiles!id(plz)')
        .eq('id', user.id)
        .maybeSingle<{
          is_nachbarschaft: boolean;
          category_ids: string[] | null;
          profile: { plz: string | null } | null;
        }>();
      const myTrack = me?.is_nachbarschaft ? 'nachbarschaft' : 'handwerker';
      const meinProfil = {
        gewerke: me?.category_ids ?? [],
        plzBereich: plzBereich(me?.profile?.plz ?? null),
      };
      const [data, leadsRes] = await withOneRetry(() => Promise.all([
        getMyContractsAsProvider(user.id),
        supabase
          .from('jobs')
          .select('id, title, description, address_city, address_plz, category_id, created_at')
          .eq('status', 'open')
          .eq('track', myTrack)
          .neq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]));
      setContracts(data);
      setLeads(sortiereAnfragen(
        (leadsRes.data ?? []) as Array<{
          id: string; title: string; description: string | null;
          address_city: string | null; address_plz: string | null;
          category_id: string | null; created_at: string;
        }>,
        meinProfil,
      ));
      // Getrennt vom Rest: schlaegt nur diese Abfrage fehl, sollen die
      // Auftraege trotzdem stehen. Der Knopf fehlt dann, statt dass der ganze
      // Bildschirm leer bleibt.
      try { setBewertet(await meineBewerteteVertraege(user.id)); } catch { /* Knopf entfaellt */ }
      // Was der Betrieb ueber einen Kunden schreibt, lesen die naechsten
      // Betriebe. Ohne diese Zeile waere die Gegenbewertung eine Eingabe
      // ohne Wirkung.
      try {
        setKundenschnitt(await bewertungsschnitte(data.map((c) => c.customer_id).filter(Boolean) as string[]));
      } catch { /* Zeile entfaellt */ }
    } catch {
      if (contracts.length === 0) toast.error('Aufträge konnten nicht geladen werden, zum Neuladen herunterziehen');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Bei jedem Fokus neu laden (Tabs bleiben gemountet) — sonst zeigt der
  // Screen nach Rueckkehr veraltete Daten (gleiche Klasse wie Auftraege-Tab-Fix).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleComplete(contractId: string) {
    setCompleting(true);
    try {
      const contract = contracts.find((c) => c.id === contractId);

      // Die Fertigstellungsmeldung setzt die Abnahmefrist nach § 640 Abs. 2 BGB
      // in Gang (Migration 0770). Vorher ging von hier NUR eine Push-Nachricht
      // raus: reagierte der Kunde nicht, lag das Geld dauerhaft fest — und die
      // Werbeseite versprach trotzdem eine automatische Freigabe.
      // Schlaegt das fehl, wird KEINE Push verschickt: eine Nachricht "bitte
      // freigeben, sonst laeuft die Frist" ohne laufende Frist waere falsch.
      const frist = await fertigstellungMelden(contractId);

      // Notify customer to release escrow (fire-and-forget).
      // jobs.status is set to 'completed' by release-escrow (service_role) when the
      // customer confirms — no client-side update here (no RLS UPDATE policy for jobs).
      if (contract?.customer_id) {
        sendPushToUser(
          contract.customer_id,
          'Auftrag erledigt · Zahlung freigeben',
          `Ihr Handwerker hat die Arbeit für „${contract.job?.title ?? 'Ihren Auftrag'}" als erledigt markiert. Bitte sehen Sie sich das Ergebnis an und geben Sie die Zahlung frei${frist.abnahme_faellig_am ? ` bis zum ${new Date(frist.abnahme_faellig_am).toLocaleDateString('de-DE')}` : ''}.`,
          { screen: '/auftrag-abschliessen', contractId },
        );
      }
      setConfirmId(null);
      await load();
      toast.success(
        frist.abnahme_faellig_am
          ? `Fertigstellung gemeldet. Der Kunde hat bis zum ${new Date(frist.abnahme_faellig_am).toLocaleDateString('de-DE')} Zeit; danach wird automatisch freigegeben.`
          : 'Auftrag als erledigt markiert, Kunde gibt die Zahlung frei',
      );
    } catch {
      toast.error('Fehler, bitte erneut versuchen');
    } finally {
      setCompleting(false);
    }
  }

  async function handleProviderCancel(contractId: string) {
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/cancel-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contract_id: contractId, reason: 'Anbieter hat storniert' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? 'Stornierung fehlgeschlagen');
      }
      setCancelId(null);
      await load();
      toast.success('Auftrag storniert, Kunde wird vollständig erstattet');
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Fehler beim Stornieren');
    } finally {
      setCancelling(false);
    }
  }

  const active    = contracts.filter((c) => c.status === 'active');
  const pending   = contracts.filter((c) => c.status === 'pending');
  const completed = contracts.filter((c) => c.status === 'completed');

  const escrowTotal = active.reduce((s, c) => s + (c.customer_total ?? 0), 0);
  const payoutTotal = completed.reduce((s, c) => s + (c.provider_payout ?? 0), 0);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'anfragen',      label: 'Anfragen',      count: leads.length     },
    { key: 'aktiv',         label: 'Aktiv',         count: active.length    },
    { key: 'ausstehend',    label: 'Ausstehend',    count: pending.length   },
    // "Erledigt" statt "Abgeschlossen": bei 360 px sind in einer Kachel 74 px
    // Platz, "Abgeschlossen" braucht 81 px (gemessen). Kuerzen ist hier das
    // Einzige, was wirkt — siehe den Kommentar bei tabBtn.
    { key: 'abgeschlossen', label: 'Erledigt',      count: completed.length },
  ];

  const displayList = tab === 'anfragen' ? leads : tab === 'aktiv' ? active : tab === 'ausstehend' ? pending : completed;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Aufträge</Text>
      </View>

      {/* Earnings banner */}
      <View style={styles.earningsBanner}>
        <View style={styles.earningsItem}>
          <View style={[styles.earningsIconWrap, { backgroundColor: C.amberBg }]}>
            <Ionicons name="lock-closed-outline" size={13} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.earningsLabel}>Treuhand (aktiv)</Text>
            <Text style={[styles.earningsValue, { color: C.amber }]}>
              {euro(escrowTotal)}
            </Text>
          </View>
        </View>
        <View style={styles.earningsSep} />
        <View style={styles.earningsItem}>
          <View style={[styles.earningsIconWrap, { backgroundColor: C.primaryBg }]}>
            <Ionicons name="cash-outline" size={13} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.earningsLabel}>Ausgezahlt gesamt</Text>
            <Text style={[styles.earningsValue, { color: C.primary }]}>{euro(payoutTotal)}</Text>
          </View>
        </View>
      </View>

      {/* Tab-Leiste, waagerecht scrollbar.
          NACHGEMESSEN (08.09.2026), und das Ergebnis war groesser als der
          urspruengliche Befund: bei 360 px bleiben je Kachel 74 px, und mit
          angehaengtem Zaehler passt KEINE der vier Beschriftungen —
            Anfragen (3)      86 px
            Ausstehend        80 px   (schon OHNE Zaehler)
            Ausstehend (1)   104 px
            Erledigt (42)     86 px
          Eine Vier-Reiter-Leiste in fester Breite ist auf schmalen Geraeten
          nicht machbar. Kuerzen allein traegt nicht: bei zweistelligen Zahlen
          bricht es wieder.
          Deshalb inhaltsbreite Kacheln in einer scrollbaren Leiste. Der
          vierte Reiter ragt bei 360 px teilweise hinaus — das ist ein
          sichtbarer Hinweis zum Wischen, kein abgeschnittenes Wort, das wie
          ein Fehler aussieht. Waagerecht scrollbare Leisten sind in
          scripts/rand-ueberstand-check.cjs ausdruecklich ausgenommen. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        style={styles.tabBarAussen}
      >
        {tabs.map((t) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            {/* KEIN adjustsFontSizeToFit: das ist in React Native iOS-only und
                in react-native-web nicht umgesetzt — auf dem Web, wo der
                Founder den Fehler gesehen hat, tut es NICHTS. Nachgemessen:
                mit und ohne das Attribut blieb "Abgeschlossen" bei 360 px
                81 px breit in einer 78-px-Kachel.
                numberOfLines bleibt: es begrenzt auf eine Zeile. */}
            <Text
              style={[styles.tabText, tab === t.key && styles.tabTextActive]}
              numberOfLines={1}
            >
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
        >
          {displayList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="clipboard-outline" size={28} color={C.muted} />
              </View>
              <Text style={styles.emptyTitle}>Keine Aufträge</Text>
              <Text style={styles.emptyText}>
                {tab === 'anfragen' ? 'Aktuell gibt es keine offenen Anfragen in Ihrer Region. Sie werden benachrichtigt, sobald eine passt.' :
                 tab === 'aktiv' ? 'Sobald ein Kunde Ihr Angebot annimmt, erscheint der Auftrag hier.' :
                 tab === 'ausstehend' ? 'Ausstehende Zahlungsbestätigungen erscheinen hier.' :
                 'Abgeschlossene Aufträge werden hier archiviert.'}
              </Text>
            </View>
          ) : null}

          {/* ── ANFRAGEN: offene Aufträge, auf die geboten werden kann ── */}
          {tab === 'anfragen' && leads.map((l) => (
            <View key={l.id} style={styles.jobCard}>
              <View style={styles.timePill}>
                <Text style={styles.timePillText}>{formatDate(l.created_at)}</Text>
              </View>
              <View style={styles.jobBody}>
                {/* Nur was nachpruefbar ist. „Empfohlen" waere eine Behauptung
                    ueber eine Auswahl, die es nicht gibt. */}
                {passungText(l.passung) ? (
                  <View style={styles.passung}>
                    <Ionicons name="checkmark-circle" size={13} color={C.primary} />
                    <Text style={styles.passungText}>{passungText(l.passung)}</Text>
                  </View>
                ) : null}
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{l.title}</Text>
                {l.description ? (
                  <Text
                    style={{ fontSize: 13, color: C.sub, marginTop: 4 }}
                    numberOfLines={ausgeklappt.has(l.id) ? undefined : 2}
                  >{l.description}</Text>
                ) : null}
                {/* Die Laenge entscheidet, nicht eine gemessene Zeilenzahl:
                    `onTextLayout` gibt es auf react-native-web nicht, ein
                    darauf gebauter Knopf waere im Web unsichtbar. 120 Zeichen
                    sind bei 13 px und Kartenbreite sicher mehr als zwei
                    Zeilen. */}
                {(l.description?.length ?? 0) > 120 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    aria-expanded={ausgeklappt.has(l.id)}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                    onPress={() => setAusgeklappt((v) => {
                      const n = new Set(v);
                      if (n.has(l.id)) n.delete(l.id); else n.add(l.id);
                      return n;
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary }}>
                      {ausgeklappt.has(l.id) ? 'Weniger anzeigen' : 'Ganze Beschreibung lesen'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  {[l.address_plz, l.address_city].filter(Boolean).join(' ') || 'Region unbekannt'}
                </Text>
                <TouchableOpacity
                  style={{ marginTop: 12, backgroundColor: C.primary, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => router.push({ pathname: '/betrieb/angebot-erstellen', params: { jobId: l.id } })}
                  accessibilityRole="button"
                >
                  <Text style={{ color: C.surface, fontSize: 14, fontWeight: '700' }}>Angebot erstellen</Text>
                </TouchableOpacity>
                {/* Rückfrage bei unklarem Auftrag — ohne verbindliches Angebot
                    (Founder-Wunsch 22.07.): Chat-Thread mit dem Kunden. */}
                <TouchableOpacity
                  style={{ marginTop: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, minHeight: 46, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => router.push({ pathname: '/chat', params: { jobId: l.id } })}
                  accessibilityRole="button"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.ink} />
                  <Text style={{ color: C.ink, fontSize: 14, fontWeight: '700' }}>Rückfrage stellen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* ── AKTIV ── */}
          {tab === 'aktiv' && active.map((c) => (
            <View key={c.id} style={styles.jobCard}>
              <View style={styles.timePill}>
                <Text style={styles.timePillText}>{formatDate(c.created_at)}</Text>
              </View>
              <View style={styles.jobBody}>
                <View style={styles.jobRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.jobTitleRow}>
                      <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                      <Badge label="Aktiv" variant="green" />
                    </View>
                    <KundenSterne wert={kundenschnitt[c.customer_id ?? '']} />
                    <Text style={styles.jobService}>{c.job?.title ?? 'Auftrag'}</Text>
                    <View style={styles.jobAddressRow}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.jobAddress}>{c.job?.address_city ?? '…'}</Text>
                    </View>
                  </View>
                  <Text style={styles.jobPrice}>€{(c.provider_payout ?? 0).toFixed(0)}</Text>
                </View>
                <View style={styles.jobActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.actionSecondary}
                    onPress={() => router.push({ pathname: '/chat', params: { jobId: c.job_id } })}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
                    <Text style={styles.actionSecondaryText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.actionCancel}
                    onPress={() => setCancelId(c.id)}
                  >
                    <Ionicons name="close-circle-outline" size={14} color={C.clay} />
                    <Text style={styles.actionCancelText}>Stornieren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.actionPrimary}
                    activeOpacity={0.8}
                    onPress={() => setConfirmId(c.id)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={C.surface} />
                    <Text style={styles.actionPrimaryText}>Fertig</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {/* ── AUSSTEHEND ── */}
          {tab === 'ausstehend' && pending.map((c) => (
            <View key={c.id} style={styles.jobCard}>
              <View style={styles.countdownChip}>
                <Ionicons name="time-outline" size={13} color={C.gold} />
                <Text style={styles.countdownText}>Ausstehend</Text>
              </View>
              <View style={styles.jobBody}>
                <View style={styles.jobRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobDate}>{formatDate(c.created_at)}</Text>
                    <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                    <KundenSterne wert={kundenschnitt[c.customer_id ?? '']} />
                    <Text style={styles.jobService}>{c.job?.title ?? 'Auftrag'}</Text>
                    <View style={styles.jobAddressRow}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.jobAddress}>{c.job?.address_city ?? '…'}</Text>
                    </View>
                  </View>
                  <Text style={styles.jobPrice}>€{(c.provider_payout ?? 0).toFixed(0)}</Text>
                </View>
                <View style={styles.jobActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.actionSecondary}
                    onPress={() => router.push({ pathname: '/chat', params: { jobId: c.job_id } })}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
                    <Text style={styles.actionSecondaryText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {/* ── ABGESCHLOSSEN ── */}
          {tab === 'abgeschlossen' && (
            <>
              {completed.length > 0 && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View>
                      <Text style={styles.summaryTitle}>Ausgezahlt gesamt</Text>
                      <Text style={styles.summaryNote}>{completed.length} Aufträge</Text>
                    </View>
                    <Text style={styles.summaryAmount}>
                      €{payoutTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <Divider margin={12} />
                  <View style={styles.summaryMetaRow}>
                    <View style={styles.summaryMeta}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={C.primary} />
                      <Text style={styles.summaryMetaText}>{completed.length} Jobs abgeschlossen</Text>
                    </View>
                  </View>
                </View>
              )}

              {completed.map((c) => (
                <View key={c.id} style={styles.doneCard}>
                  <View style={styles.doneCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.doneDate}>{formatDate(c.created_at)}</Text>
                      <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                      <KundenSterne wert={kundenschnitt[c.customer_id ?? '']} />
                      <Text style={styles.jobService}>{c.job?.title ?? 'Auftrag'}</Text>
                    </View>
                    <View style={styles.doneRight}>
                      <Text style={styles.doneAmount}>€{(c.provider_payout ?? 0).toFixed(0)}</Text>
                      <Badge label="Ausgezahlt" variant="green" />
                    </View>
                  </View>

                  {/* Gegenbewertung (0930). Die Datenbank erlaubt sie seit
                      0310 in beide Richtungen, einen Eingang gab es nie --
                      und der Hilfe-Chat sagt sie dem Nutzer zu. Eine Zusage
                      ohne Eingang ist keine. */}
                  {bewertet.has(c.id) ? (
                    <Text style={styles.bewertenFertig}>Sie haben diesen Kunden bereits bewertet.</Text>
                  ) : darfBewerten(c.completed_at) ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.bewertenBtn}
                      onPress={() => router.push({
                        pathname: '/bewertung',
                        params: { contractId: c.id, reviewedId: c.customer_id },
                      })}
                    >
                      <Ionicons name="star-outline" size={15} color={C.primary} />
                      <Text style={styles.bewertenBtnText}>Kunden bewerten</Text>
                    </TouchableOpacity>
                  ) : (
                    // Nicht verschweigen, sondern den Grund nennen. Ein Knopf,
                    // der wortlos verschwindet, sieht aus wie ein Fehler.
                    <Text style={styles.bewertenFertig}>{fristText(fristLage(c.completed_at))}</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Confirmation modal */}
      <Modal
        visible={confirmId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmId(null)}
      >
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setConfirmId(null)}>
          <Pressable accessibilityRole="button" style={[styles.modalSheet, { paddingBottom: aktionsleistenRand(insets.bottom) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBg}>
                <Ionicons name="checkmark-circle" size={28} color={C.primary} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Job abschließen?</Text>
            <Text style={styles.modalBody}>
              Der Auftrag wird als erledigt markiert. Der Kunde erhält eine Benachrichtigung und gibt die Zahlung frei. Danach erscheint der Betrag in Ihrem Guthaben.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" style={styles.modalCancel} onPress={() => setConfirmId(null)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.modalConfirm, completing && { opacity: 0.6 }]}
                onPress={() => confirmId && handleComplete(confirmId)}
                disabled={completing}
              >
                {completing
                  ? <ActivityIndicator color={C.surface} size="small" />
                  : <Text style={styles.modalConfirmText}>Bestätigen</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Provider cancellation modal */}
      <Modal
        visible={cancelId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelId(null)}
      >
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setCancelId(null)}>
          <Pressable accessibilityRole="button" style={[styles.modalSheet, { paddingBottom: aktionsleistenRand(insets.bottom) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconRow}>
              <View style={[styles.modalIconBg, { backgroundColor: C.clayBg, borderColor: C.clayBd }]}>
                <Ionicons name="close-circle" size={28} color={C.clay} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Auftrag stornieren?</Text>
            <Text style={styles.modalBody}>
              Der Auftrag wird storniert und der Kunde erhält eine vollständige Rückerstattung. Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" style={styles.modalCancel} onPress={() => setCancelId(null)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.modalCancelConfirm, cancelling && { opacity: 0.6 }]}
                onPress={() => cancelId && handleProviderCancel(cancelId)}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator color={C.surface} size="small" />
                  : <Text style={styles.modalConfirmText}>Stornieren</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:              { fontSize: 24, fontWeight: '700', color: C.ink },
  centered:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Earnings banner — Double-Bezel depth, branded tint
  earningsBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 20, marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  earningsItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  earningsIconWrap:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  earningsLabel:      { fontSize: 11, color: C.muted, fontWeight: '500', marginBottom: 2 },
  earningsValue:      { fontSize: 16, fontWeight: '700', color: C.ink },
  earningsSep:        { width: 1, height: 36, backgroundColor: C.border, marginHorizontal: 14 },

  // Tab bar — on-brand active state
  tabBarAussen:       { flexGrow: 0, marginBottom: 16 },
  tabBar:             { flexDirection: 'row', gap: 3, paddingHorizontal: 20, alignItems: 'center' },
  // Inhaltsbreit statt flex: 1 — Begruendung an der Leiste oben.
  // Die eigene Umrandung je Kachel ersetzt den frueheren gemeinsamen Rahmen;
  // in einer scrollbaren Leiste haette der an der falschen Stelle geendet.
  tabBtn:             { paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tabBtnActive:       { backgroundColor: C.primary },
  tabText:            { fontSize: 12, fontWeight: '500', color: C.sub, textAlign: 'center' },
  tabTextActive:      { color: C.surface, fontWeight: '700' },

  scrollContent:      { paddingHorizontal: 20, paddingBottom: 36 },

  // Empty state — composed with context text
  emptyWrap:          { alignItems: 'center', paddingTop: 56, paddingHorizontal: 24, gap: 10 },
  emptyIconWrap:      { width: 64, height: 64, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:         { fontSize: 15, fontWeight: '700', color: C.ink },
  emptyText:          { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },

  // Job cards — tinted shadow, stronger hierarchy
  jobCard:            { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, marginBottom: 12, overflow: 'hidden', shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  timePill:           { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 9 },
  timePillText:       { fontSize: 11, fontWeight: '700', color: C.surface, letterSpacing: 0.4 },
  jobBody:            { padding: 16 },
  passung:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  passungText:        { ...T.label, color: C.primary },
  jobRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  jobTitleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  jobDate:            { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  jobCustomer:        { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 2 },
  kundenSterne:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  kundenSterneText:   { fontSize: 12, color: C.sub },
  jobService:         { fontSize: 12, color: C.sub, lineHeight: 17, marginBottom: 5 },
  jobAddressRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  jobAddress:         { fontSize: 11, color: C.muted },
  jobPrice:           { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },

  // Action buttons
  jobActions:         { flexDirection: 'row', gap: 8, marginTop: 14 },
  // minHeight 44 (Apple HIG): alle drei massen 35 hoch. Sichtbar erst, seit
  // der Pruefer den Reiter „Aktiv" antippt.
  actionSecondary:    { minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  actionSecondaryText:{ fontSize: 12, color: C.sub, fontWeight: '500' },
  actionCancel:       { minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.clayBg, borderWidth: 1, borderColor: C.clayBd, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  actionCancelText:   { fontSize: 12, color: C.clay, fontWeight: '600' },
  actionPrimary:      { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.primary, borderRadius: 9, paddingVertical: 9 },
  actionPrimaryText:  { fontSize: 13, color: C.surface, fontWeight: '700' },

  countdownChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 9 },
  countdownText:      { fontSize: 11, fontWeight: '700', color: C.amber, letterSpacing: 0.3 },

  // Summary card — dark ink, strong payout emphasis
  summaryCard:        { backgroundColor: C.ink, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  summaryRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryTitle:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  summaryNote:        { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  summaryAmount:      { fontSize: 30, fontWeight: '700', color: C.surface, letterSpacing: -1 },
  summaryMetaRow:     { flexDirection: 'row', gap: 16 },
  summaryMeta:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetaText:    { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // Done cards
  doneCard:           { ...shadow.sm,  backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, padding: 14, marginBottom: 10 },
  doneCardRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  doneDate:           { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  doneRight:          { alignItems: 'flex-end', gap: 6 },
  doneAmount:         { fontSize: 18, fontWeight: '700', color: C.ink },
  bewertenBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 44 },
  bewertenBtnText:  { fontSize: 13, fontWeight: '700', color: C.primary },
  bewertenFertig:   { fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 17 },

  // Confirmation modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 28 },
  modalIconRow:       { alignItems: 'center', marginBottom: 16 },
  modalIconBg:        { width: 60, height: 60, borderRadius: 18, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd, alignItems: 'center', justifyContent: 'center' },
  modalTitle:         { fontSize: 20, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 10 },
  modalBody:          { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalActions:       { flexDirection: 'row', gap: 12 },
  modalCancel:        { flex: 1, paddingVertical: 14, borderRadius: 11, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  modalCancelText:    { fontSize: 15, fontWeight: '600', color: C.sub },
  modalConfirm:       { flex: 1, paddingVertical: 14, borderRadius: 11, backgroundColor: C.primary, alignItems: 'center' },
  modalCancelConfirm: { flex: 1, paddingVertical: 14, borderRadius: 11, backgroundColor: C.clay, alignItems: 'center' },
  modalConfirmText:   { fontSize: 15, fontWeight: '700', color: C.surface },
});
