import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { FEATURES } from '../../constants/features';
import { Badge } from '../../components/ui/Badge';
import { getPStTGStats, getPStTGWarningMessage, submitTaxId, type PStTGStats } from '../../lib/pstTg';
import { toast } from '../../components/ui/Toast';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { Reveal } from '../../components/ui/Reveal';
import { T } from '../../constants/typography';
import { shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  plz: string | null;
  createdAt: string | null;
}

interface MyOffer {
  offerId: string;
  jobId: string;
  title: string;
  price: number;
}

interface TodayJob {
  contractId: string;
  jobId: string;
  time: string;
  customerName: string;
  service: string;
  address: string | null;
  status: 'active' | 'pending';
}

interface WeekDay {
  day: string;
  net: number;
}

interface DashData {
  businessName: string;
  rating: number;
  ratingCount: number;
  available: boolean;
  todayCount: number;
  todayEarnings: number;
  openRequestsCount: number;
  weekEarnings: WeekDay[];
  leads: Lead[];
  myOffers: MyOffer[];
  todayJobs: TodayJob[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function buildWeekSkeleton(): WeekDay[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return { day: DAYS_DE[d.getDay()], net: 0, _date: d.toISOString().slice(0, 10) };
  }) as WeekDay[];
}

function toTimeStr(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

// ── Data loader ───────────────────────────────────────────────────────────────

async function loadDashboard(userId: string): Promise<DashData> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoIso = weekAgo.toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [profileRes, contractsRes, myOffersRes, leadsRes] = await Promise.all([
    supabase
      .from('provider_profiles')
      .select('business_name, rating_avg, rating_count, available, kyc_status')
      .eq('id', userId)
      // maybeSingle: fehlt die Anbieter-Zeile (z. B. verwaistes Konto nach
      // DB-Reset), soll das Dashboard trotzdem Verträge/Leads zeigen statt die
      // ganze Ladung abzubrechen. profile-Nutzung ist bereits null-sicher.
      .maybeSingle<{ business_name: string | null; rating_avg: number | null; rating_count: number | null; available: boolean; kyc_status: string | null }>(),
    supabase
      .from('contracts')
      .select('id, status, escrow_captured_at, completed_at, provider_commission, job:jobs!job_id(id, title, address_street, scheduled_at), customer:profiles!customer_id(full_name)')
      .eq('provider_id', userId)
      .or(`status.in.(active,pending),and(status.eq.completed,completed_at.gte.${weekAgoIso})`),
    supabase
      .from('offers')
      .select('id, job_id, price, job:jobs!job_id(id, title)')
      .eq('provider_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    // Offene Auftraege als Leads — lesbar fuer verifizierte Anbieter (RLS 0410)
    supabase
      .from('jobs')
      .select('id, title, description, address_city, address_plz, created_at')
      .eq('status', 'open')
      .neq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const profile = profileRes.data;
  const contracts = contractsRes.data ?? [];
  const myOffersRows = myOffersRes.data ?? [];
  const leadRows = leadsRes.data ?? [];

  // Build week earnings (last 7 days)
  const skeleton = buildWeekSkeleton() as Array<WeekDay & { _date: string }>;
  for (const c of contracts) {
    if ((c as any).status !== 'completed') continue;
    const cDate = new Date((c as any).completed_at).toISOString().slice(0, 10);
    const slot = skeleton.find((s) => s._date === cDate);
    if (slot) slot.net += (c as any).provider_commission ?? 0;
  }
  const weekEarnings: WeekDay[] = skeleton.map(({ day, net }) => ({ day, net: Math.round(net) }));

  // Today's scheduled contracts
  const todayJobs: TodayJob[] = [];
  let todayEarnings = 0;
  let todayCount = 0;

  for (const c of contracts) {
    const anyC = c as any;
    const scheduledAt = anyC.job?.scheduled_at as string | null;

    if (anyC.status === 'completed' && anyC.completed_at && new Date(anyC.completed_at) >= todayStart) {
      todayEarnings += anyC.provider_commission ?? 0;
    }

    if ((anyC.status === 'active' || anyC.status === 'pending') && scheduledAt && isToday(scheduledAt)) {
      todayCount++;
      todayJobs.push({
        contractId: anyC.id,
        jobId: anyC.job?.id ?? '',
        time: toTimeStr(scheduledAt),
        customerName: anyC.customer?.full_name ?? 'Kunde',
        service: anyC.job?.title ?? 'Auftrag',
        address: anyC.job?.address_street ?? null,
        status: anyC.escrow_captured_at ? 'active' : 'pending',
      });
    }
  }
  todayJobs.sort((a, b) => a.time.localeCompare(b.time));

  const myOffers: MyOffer[] = (myOffersRows as any[]).map((row) => ({
    offerId: row.id ?? '',
    jobId: row.job_id ?? '',
    title: (row.job as any)?.title ?? 'Auftrag',
    price: row.price ?? 0,
  }));

  const leads: Lead[] = (leadRows as any[]).map((j) => ({
    id: j.id ?? '',
    title: j.title ?? '—',
    description: j.description ?? null,
    city: j.address_city ?? null,
    plz: j.address_plz ?? null,
    createdAt: j.created_at ?? null,
  }));

  return {
    businessName: profile?.business_name ?? 'Mein Betrieb',
    rating: profile?.rating_avg ?? 0,
    ratingCount: profile?.rating_count ?? 0,
    available: profile?.available ?? true,
    todayCount,
    todayEarnings: Math.round(todayEarnings),
    openRequestsCount: leads.length,
    weekEarnings,
    leads,
    myOffers,
    todayJobs,
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProviderHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [dash, setDash] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pstTg, setPstTg] = useState<PStTGStats | null>(null);
  const [taxIdModal, setTaxIdModal] = useState(false);
  const [taxIdInput, setTaxIdInput] = useState('');
  const [taxIdSaving, setTaxIdSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) { setLoading(false); return; }
    try {
      // Check KYC status before loading dashboard — redirect on rejection
      if (!isRefresh) {
        const { data: kycRow } = await supabase
          .from('provider_profiles')
          .select('kyc_status')
          .eq('id', user.id)
          .maybeSingle<{ kyc_status: string | null }>();
        if (kycRow?.kyc_status === 'rejected') {
          router.replace('/bewerbung-abgelehnt');
          return;
        }
      }
      const [data, stats] = await Promise.all([
        loadDashboard(user.id),
        getPStTGStats(),
      ]);
      setDash(data);
      setPstTg(stats);
    } catch {
      toast.error('Dashboard konnte nicht geladen werden');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [user]);

  // Bei jedem Fokus neu laden (Tabs bleiben gemountet) — sonst zeigt der
  // Screen nach Rueckkehr veraltete Daten (gleiche Klasse wie Auftraege-Tab-Fix).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pstTgWarning = pstTg ? getPStTGWarningMessage(pstTg) : null;

  async function handleSubmitTaxId() {
    setTaxIdSaving(true);
    try {
      await submitTaxId(taxIdInput);
      const updated = await getPStTGStats();
      setPstTg(updated);
      setTaxIdModal(false);
      setTaxIdInput('');
      toast.success('Steuer-ID hinterlegt — Konto entsperrt');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ungültige Eingabe');
    } finally {
      setTaxIdSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const weekMax = Math.max(...(dash?.weekEarnings ?? []).map((d) => d.net), 1);
  const weekTotal = (dash?.weekEarnings ?? []).reduce((s, d) => s + d.net, 0);
  const todayDayShort = DAYS_DE[new Date().getDay()];

  const summaryCards = [
    { icon: 'calendar-outline', label: 'Heute',           value: dash ? `${dash.todayCount} Termin${dash.todayCount !== 1 ? 'e' : ''}` : '—', color: C.primary, chipBg: C.primaryBg },
    { icon: 'cash-outline',     label: 'Einnahmen heute', value: dash ? `€${dash.todayEarnings}` : '—',                                         color: C.primary, chipBg: C.primaryBg },
    { icon: 'mail-outline',     label: 'Neue Aufträge',   value: dash ? `${dash.openRequestsCount} offen` : '—',                                color: C.amber,   chipBg: C.amberBg   },
    { icon: 'star',             label: 'Bewertung',       value: dash && dash.ratingCount > 0 ? dash.rating.toFixed(1) : '—',                     color: C.gold,    chipBg: C.goldBg    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
      >

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Guten Tag,</Text>
            <Text style={styles.name}>{dash?.businessName ?? '…'}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/(provider)/profil')} accessibilityRole="button" accessibilityLabel="Profil">
              <Ionicons name="person-circle-outline" size={28} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero „Nächste Aktion" — Referenz-Stil (Founder 16.07.), Werkant-Marke:
            grosse gerundete Karte in Markengruen statt Bonbon-Gradient. */}
        {(() => {
          const openReq = dash?.openRequestsCount ?? 0;
          const today = dash?.todayCount ?? 0;
          return (
          <Reveal delay={20}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.hero}
              onPress={() => router.push('/(provider)/auftraege')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Dein Fokus heute</Text>
                <Text style={styles.heroTitle}>
                  {openReq > 0
                    ? `${openReq} neue${openReq === 1 ? 'r' : ''} Auftrag${openReq === 1 ? '' : 'e'} wartet`
                    : today > 0
                      ? `${today} Termin${today === 1 ? '' : 'e'} heute`
                      : 'Alles erledigt — ruhiger Tag'}
                </Text>
                <Text style={styles.heroSub}>
                  {openReq > 0
                    ? 'Jetzt Angebot abgeben und Auftrag sichern'
                    : today > 0
                      ? 'Deine geplanten Termine ansehen'
                      : 'Neue Aufträge erscheinen hier, sobald sie eingehen'}
                </Text>
              </View>
              <View style={styles.heroArrow}>
                <Ionicons name="arrow-forward" size={20} color={C.primary} />
              </View>
            </TouchableOpacity>
          </Reveal>
          );
        })()}

        {/* PStTG FREEZE GATE */}
        {pstTg?.frozen && (
          <TouchableOpacity
            style={styles.pstTgFreezeBar}
            onPress={() => setTaxIdModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="alert-circle" size={18} color={C.surface} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pstTgFreezeTitle}>Konto eingefroren — PStTG §3</Text>
              <Text style={styles.pstTgFreezeSub}>
                {pstTg.jobCount} Aufträge / €{pstTg.totalRevenue.toFixed(0)} Umsatz in {pstTg.year} erreicht.
                Steuer-ID hinterlegen zum Entsperren.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.surface} />
          </TouchableOpacity>
        )}

        {/* PStTG WARNING (near threshold) */}
        {!pstTg?.frozen && pstTgWarning && (
          <TouchableOpacity
            style={styles.pstTgWarnBar}
            onPress={() => setTaxIdModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={16} color={C.amber} />
            <Text style={styles.pstTgWarnText}>{pstTgWarning}</Text>
          </TouchableOpacity>
        )}

        {/* Availability warning — only if set to unavailable */}
        {dash && !dash.available && (
          <TouchableOpacity
            style={styles.calWarning}
            onPress={() => router.push('/(provider)/profil-bearbeiten')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={16} color={C.amber} />
            <Text style={styles.calWarningText}>
              Du bist als nicht verfügbar markiert — Kunden sehen dich nicht in der Suche
            </Text>
            <Ionicons name="chevron-forward" size={14} color={C.amber} />
          </TouchableOpacity>
        )}

        {/* Summary Cards — ruhiges 2er-Raster statt horizontalem Scroll */}
        <Reveal delay={40}>
          <View style={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <View key={card.label} style={styles.summaryCard}>
                <View style={[styles.iconChip, { backgroundColor: card.chipBg }]}>
                  <Ionicons name={card.icon as any} size={16} color={card.color} />
                </View>
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </Reveal>

        {/* Pro Upgrade Banner (eingefroren — Fokus-Schnitt MVP) */}
        {FEATURES.PRO_ABO && (
        <TouchableOpacity
          style={styles.proBanner}
          onPress={() => router.push('/(provider)/pro')}
          activeOpacity={0.85}
        >
          <View style={styles.proBannerLeft}>
            <Ionicons name="star" size={18} color={C.gold} />
            <View>
              <Text style={styles.proBannerTitle}>Werkant Pro — €29/Monat</Text>
              <Text style={styles.proBannerSub}>Bevorzugte Platzierung, erweiterte Statistiken & mehr</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.gold} />
        </TouchableOpacity>
        )}

        {/* Wocheneinnahmen */}
        <Reveal delay={80}>
        <Text style={styles.groupTitle}>Einnahmen diese Woche</Text>
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTotal}>€{weekTotal.toLocaleString('de-DE')}</Text>
            <View style={styles.chartNote}>
              <Ionicons name="information-circle-outline" size={12} color={C.muted} />
              <Text style={styles.chartNoteText}>Netto nach 8% Plattformgebühr</Text>
            </View>
          </View>
          <View style={styles.chart}>
            {(dash?.weekEarnings ?? []).map((d) => {
              const heightPct = d.net / weekMax;
              const isToday = d.day === todayDayShort;
              return (
                <View key={d.day} style={styles.barCol}>
                  <Text style={styles.barValue}>{d.net > 0 ? `€${d.net}` : ''}</Text>
                  <View style={styles.barTrack}>
                    <View style={[
                      styles.barFill,
                      { height: `${Math.max(heightPct * 100, d.net > 0 ? 4 : 0)}%` as any },
                      isToday && styles.barFillToday,
                    ]} />
                  </View>
                  <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>
        </Reveal>

        {/* Neue Auftraege — offene Jobs als Leads (Kern des Anbieter-Funnels) */}
        {(dash?.leads ?? []).length > 0 && (
          <Reveal delay={130}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitleText}>Neue Aufträge</Text>
              <Badge label={`${dash!.leads.length} offen`} variant="amber" />
            </View>
            {dash!.leads.map((lead) => (
              <View key={lead.id} style={styles.requestCard}>
                <Text style={styles.requestCustomer}>{lead.title}</Text>
                <View style={[styles.requestMeta, { marginTop: 4 }]}>
                  <Ionicons name="location-outline" size={12} color={C.muted} />
                  <Text style={styles.requestMetaText}>
                    {[lead.plz, lead.city].filter(Boolean).join(' ') || 'Ort auf Anfrage'}
                    {lead.createdAt ? ` · ${new Date(lead.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                </View>
                {lead.description ? (
                  <Text style={styles.requestNote}>"{lead.description.slice(0, 90)}{lead.description.length > 90 ? '…' : ''}"</Text>
                ) : null}
                <AnimatedButton
                  style={[styles.acceptBtn, { marginTop: 12 }]}
                  onPress={() => router.push({ pathname: '/(provider)/angebot-erstellen', params: { jobId: lead.id } } as any)}
                >
                  <Ionicons name="create-outline" size={16} color={C.surface} />
                  <Text style={styles.acceptBtnText}>Angebot abgeben</Text>
                </AnimatedButton>
              </View>
            ))}
          </Reveal>
        )}

        {/* Eigene abgegebene Angebote — warten auf Kunden-Antwort */}
        {(dash?.myOffers ?? []).length > 0 && (
          <Reveal delay={160}>
            <Text style={styles.groupTitle}>Deine offenen Angebote</Text>
            <View style={styles.jobGroup}>
              {dash!.myOffers.map((o, idx) => (
                <React.Fragment key={o.offerId}>
                  <View style={styles.jobRow}>
                    <View style={[styles.iconChip, { backgroundColor: C.amberBg }]}>
                      <Ionicons name="hourglass-outline" size={16} color={C.amber} />
                    </View>
                    <View style={styles.jobInfo}>
                      <Text style={styles.jobCustomer} numberOfLines={1}>{o.title}</Text>
                      <Text style={styles.jobService}>€{o.price.toFixed(2).replace('.', ',')} · wartet auf den Kunden</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.withdrawBtn}
                      activeOpacity={0.7}
                      onPress={async () => {
                        await supabase.from('offers').update({ status: 'declined' })
                          .eq('id', o.offerId).eq('status', 'pending');
                        setDash((prev) => prev ? {
                          ...prev,
                          myOffers: prev.myOffers.filter((m) => m.offerId !== o.offerId),
                        } : prev);
                        toast.info('Angebot zurückgezogen');
                      }}
                    >
                      <Text style={styles.withdrawBtnText}>Zurückziehen</Text>
                    </TouchableOpacity>
                  </View>
                  {idx < dash!.myOffers.length - 1 && <View style={styles.jobSep} />}
                </React.Fragment>
              ))}
            </View>
          </Reveal>
        )}

        {/* Heute geplant — gruppierte Liste in einer Karte */}
        {(dash?.todayJobs ?? []).length > 0 && (
          <Reveal delay={190}>
            <Text style={styles.groupTitle}>Heute geplant</Text>
            <View style={styles.jobGroup}>
              {dash!.todayJobs.map((job, idx) => (
                <React.Fragment key={job.contractId}>
                  <TouchableOpacity
                    style={styles.jobRow}
                    onPress={() => router.push({ pathname: '/vertrag', params: { contractId: job.contractId } } as any)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.jobTime}>
                      <Text style={styles.jobTimeText}>{job.time}</Text>
                    </View>
                    <View style={styles.jobInfo}>
                      <Text style={styles.jobCustomer}>{job.customerName}</Text>
                      <Text style={styles.jobService}>{job.service}</Text>
                      {job.address && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Ionicons name="location-outline" size={11} color={C.muted} />
                          <Text style={styles.jobAddress}>{job.address}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Badge
                        label={job.status === 'active' ? 'Escrow aktiv' : 'Bestätigt'}
                        variant={job.status === 'active' ? 'green' : 'amber'}
                      />
                      <Ionicons name="chevron-forward" size={16} color={C.muted} />
                    </View>
                  </TouchableOpacity>
                  {idx < dash!.todayJobs.length - 1 && <View style={styles.jobSep} />}
                </React.Fragment>
              ))}
            </View>
          </Reveal>
        )}

        {/* Empty state if no activity today */}
        {dash && dash.todayCount === 0 && dash.leads.length === 0 && dash.myOffers.length === 0 && (
          <Reveal delay={130}>
            <View style={styles.emptyState}>
              <Ionicons name="sunny-outline" size={36} color={C.border} />
              <Text style={styles.emptyTitle}>Ruhiger Tag</Text>
              <Text style={styles.emptyText}>Keine Termine oder offenen Anfragen für heute.</Text>
            </View>
          </Reveal>
        )}

      </ScrollView>

      {/* ── PStTG TaxID Modal ── */}
      <Modal visible={taxIdModal} transparent animationType="slide" onRequestClose={() => setTaxIdModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Steuer-ID hinterlegen</Text>
                <Text style={styles.modalSub}>Pflicht nach §3 PStTG ab 30 Aufträgen / €2.000</Text>
              </View>
              <TouchableOpacity onPress={() => setTaxIdModal(false)} hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }} accessibilityRole="button" accessibilityLabel="Schließen">
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalHint}>
              <Ionicons name="document-text-outline" size={20} color={C.muted} />
              <Text style={styles.modalHintText}>
                Die 11-stellige Steuer-ID finden Sie auf Ihrem letzten Steuerbescheid oben rechts.
              </Text>
            </View>

            <TextInput
              style={styles.modalInput}
              value={taxIdInput}
              onChangeText={(v) => setTaxIdInput(v.replace(/\D/g, '').slice(0, 11))}
              placeholder="12345678901"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              maxLength={11}
            />
            {taxIdInput.length > 0 && taxIdInput.length < 11 && (
              <Text style={styles.modalHintSmall}>{11 - taxIdInput.length} Zeichen fehlen noch</Text>
            )}

            <TouchableOpacity
              style={[styles.modalBtn, (taxIdInput.length !== 11 || taxIdSaving) && styles.modalBtnDisabled]}
              onPress={handleSubmitTaxId}
              disabled={taxIdInput.length !== 11 || taxIdSaving}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color={C.surface} />
              <Text style={styles.modalBtnText}>Steuer-ID speichern & Konto entsperren</Text>
            </TouchableOpacity>

            <Text style={styles.modalLegal}>
              Ihre Steuer-ID wird gemäß §12 PStTG verschlüsselt an das Bundeszentralamt für Steuern gemeldet.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  hero:             { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.primary, marginHorizontal: 16, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 20, marginBottom: 14, shadowColor: C.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 4 },
  heroLabel:        { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: 5 },
  heroTitle:        { fontSize: 20, fontWeight: '700', color: C.surface, lineHeight: 26 },
  heroSub:          { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 5, lineHeight: 18 },
  heroArrow:        { width: 42, height: 42, borderRadius: 21, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  greeting:         { fontSize: 14, color: C.sub },
  name:             { ...T.h2, color: C.ink },
  headerRight:      { alignItems: 'flex-end', gap: 4 },
  dateText:         { fontSize: 12, color: C.muted },
  profileBtn:       { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pstTgFreezeBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.red, marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12 },
  pstTgFreezeTitle: { fontSize: 13, fontWeight: '700', color: C.surface },
  pstTgFreezeSub:   { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 16 },
  pstTgWarnBar:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, marginHorizontal: 16, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  pstTgWarnText:    { flex: 1, fontSize: 12, color: C.amber, lineHeight: 17 },
  calWarning:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, marginHorizontal: 16, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  calWarningText:   { flex: 1, fontSize: 12, color: C.amber, fontWeight: '500' },
  modalOverlay:     { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: C.ink },
  modalSub:         { fontSize: 12, color: C.muted, marginTop: 3 },
  modalHint:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.bg, borderRadius: 10, padding: 12, marginBottom: 16 },
  modalHintText:    { flex: 1, fontSize: 12, color: C.sub, lineHeight: 17 },
  modalInput:       { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, fontWeight: '600', color: C.ink, letterSpacing: 2, textAlign: 'center', marginBottom: 6 },
  modalHintSmall:   { fontSize: 11, color: C.amber, textAlign: 'center', marginBottom: 16 },
  modalBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  modalBtnDisabled: { opacity: 0.4 },
  modalBtnText:     { fontSize: 14, fontWeight: '700', color: C.surface },
  modalLegal:       { fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 15 },
  summaryGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  iconChip:         { width: 30, height: 30, borderRadius: 9, backgroundColor: C.bgWarm, alignItems: 'center', justifyContent: 'center' },
  proBanner:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 20, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  proBannerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  proBannerTitle:   { fontSize: 14, fontWeight: '700', color: C.gold },
  proBannerSub:     { fontSize: 11, color: C.amber, marginTop: 1 },
  summaryCard:      { flexBasis: '40%', flexGrow: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 8 },
  summaryValue:     { fontSize: 16, fontWeight: '700', color: C.ink },
  summaryLabel:     { fontSize: 11, color: C.muted },
  groupTitle:       { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  groupTitleText:   { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  groupHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  chartSection:     { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  chartHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTotal:       { fontSize: 20, fontWeight: '700', color: C.primary },
  chart:            { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barCol:           { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue:         { fontSize: 8, color: C.sub, marginBottom: 3, textAlign: 'center' },
  barTrack:         { width: '100%', flex: 1, justifyContent: 'flex-end', backgroundColor: C.bg, borderRadius: 4, overflow: 'hidden' },
  barFill:          { width: '100%', backgroundColor: C.border, borderRadius: 4 },
  barFillToday:     { backgroundColor: C.primary },
  barLabel:         { fontSize: 10, color: C.muted, marginTop: 5, fontWeight: '500' },
  barLabelToday:    { color: C.ink, fontWeight: '700' },
  chartNote:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chartNoteText:    { fontSize: 10, color: C.muted },
  requestCard:      { ...shadow.xs, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 14 },
  requestCustomer:  { ...T.body, fontWeight: '700', color: C.ink, marginBottom: 2 },
  requestMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestMetaText:  { ...T.caption, color: C.muted },
  requestNote:      { fontSize: 12, color: C.sub, fontStyle: 'italic', marginTop: 6 },
  withdrawBtn:      { paddingVertical: 8, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 9, borderWidth: 1.5, borderColor: C.border },
  withdrawBtnText:  { fontSize: 12, fontWeight: '600', color: C.sub },
  acceptBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.primary },
  acceptBtnText:    { fontSize: 13, fontWeight: '700', color: C.surface },
  jobGroup:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginHorizontal: 16, paddingHorizontal: 14 },
  jobRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  jobSep:           { height: 1, backgroundColor: C.hair, marginLeft: 54 },
  jobTime:          { backgroundColor: C.bgWarm, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  jobTimeText:      { fontSize: 14, fontWeight: '700', color: C.ink },
  jobInfo:          { flex: 1 },
  jobCustomer:      { ...T.sm, fontWeight: '700', color: C.ink },
  jobService:       { ...T.caption, fontSize: 12, color: C.sub, marginTop: 1 },
  jobAddress:       { ...T.caption, color: C.muted },
  emptyState:       { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  emptyTitle:       { fontSize: 16, fontWeight: '600', color: C.sub },
  emptyText:        { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },
});
