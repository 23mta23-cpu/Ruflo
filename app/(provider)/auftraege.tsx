import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { showAlert } from '../../lib/alert';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  getMyContractsAsProvider,
  completeContract,
  ContractWithJobAndCustomer,
} from '../../lib/contracts';
import {
  getMyOffersAsProvider,
  offerStatusLabel,
  OfferWithJob,
} from '../../lib/offers';

// ── Types ─────────────────────────────────────────────────────

type Tab = 'angebote' | 'aktiv' | 'abgeschlossen' | 'storniert';

type ActiveJob = {
  id: string;
  customer: string;
  initials: string;
  service: string;
  serviceIcon: string;
  address: string;
  price: number;
  dateLabel: string;
  status: 'inBearbeitung' | 'heute' | 'morgen';
};

type DoneJob = {
  id: string;
  customer: string;
  initials: string;
  service: string;
  price: number;
  dateLabel: string;
  payoutDate: string;
};

type CancelledJob = {
  id: string;
  customer: string;
  initials: string;
  service: string;
  price: number;
  dateLabel: string;
  reason: string;
};

// ── Mock data (shown when Supabase is not configured) ──────────

const ACTIVE_JOBS: ActiveJob[] = [
  {
    id: 'A1',
    customer: 'Maria K.',
    initials: 'MK',
    service: 'Wohnungsreinigung',
    serviceIcon: 'sparkles-outline',
    address: 'Kölner Str. 22, Köln',
    price: 85,
    dateLabel: 'Heute 14:00',
    status: 'heute',
  },
  {
    id: 'A2',
    customer: 'Thomas R.',
    initials: 'TR',
    service: 'Umzugshilfe',
    serviceIcon: 'cube-outline',
    address: 'Aachener Str. 55, Köln',
    price: 220,
    dateLabel: 'Morgen 09:00',
    status: 'morgen',
  },
  {
    id: 'A3',
    customer: 'Julia M.',
    initials: 'JM',
    service: 'Gartenarbeit',
    serviceIcon: 'leaf-outline',
    address: 'Venloer Str. 12, Köln',
    price: 65,
    dateLabel: '15.06. 11:00',
    status: 'inBearbeitung',
  },
];

const DONE_JOBS: DoneJob[] = [
  {
    id: 'D1',
    customer: 'Anna S.',
    initials: 'AS',
    service: 'Malerarbeiten',
    price: 340,
    dateLabel: '10.06.',
    payoutDate: '04.06.',
  },
  {
    id: 'D2',
    customer: 'Klaus B.',
    initials: 'KB',
    service: 'Elektriker',
    price: 120,
    dateLabel: '05.06.',
    payoutDate: '28.05.',
  },
];

const CANCELLED_JOBS: CancelledJob[] = [
  {
    id: 'C1',
    customer: 'Stefan H.',
    initials: 'SH',
    service: 'Rohrreparatur',
    price: 95,
    dateLabel: '08.06.',
    reason: 'Auftraggeber hat storniert',
  },
];

// ── Data mappers ───────────────────────────────────────────────

function resolveCustomerName(c: ContractWithJobAndCustomer): string {
  return c.customer?.full_name || 'Kunde';
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + '.';
}

function fmtAddress(c: ContractWithJobAndCustomer): string {
  const parts = [c.job.address_plz, c.job.address_city].filter(Boolean);
  return parts.join(', ');
}

function contractToActiveJob(c: ContractWithJobAndCustomer): ActiveJob {
  const name = resolveCustomerName(c);
  return {
    id: c.id,
    customer: name,
    initials: initials(name),
    service: c.job.title,
    serviceIcon: 'construct-outline',
    address: fmtAddress(c),
    price: c.price_gross,
    dateLabel: fmtDate(c.created_at),
    status: 'inBearbeitung',
  };
}

function contractToDoneJob(c: ContractWithJobAndCustomer): DoneJob {
  const name = resolveCustomerName(c);
  return {
    id: c.id,
    customer: name,
    initials: initials(name),
    service: c.job.title,
    price: c.provider_payout ?? c.price_gross,
    dateLabel: fmtDate(c.completed_at ?? c.created_at),
    payoutDate: fmtDate(c.completed_at ?? c.created_at),
  };
}

function contractToCancelledJob(c: ContractWithJobAndCustomer): CancelledJob {
  const name = resolveCustomerName(c);
  return {
    id: c.id,
    customer: name,
    initials: initials(name),
    service: c.job.title,
    price: c.price_gross,
    dateLabel: fmtDate(c.cancelled_at ?? c.created_at),
    reason: c.status === 'disputed' ? 'Streitfall offen' : 'Auftrag storniert',
  };
}

// ── Config ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  inBearbeitung: { label: 'In Bearbeitung', bg: '#E8F0FE', color: '#1A56DB' },
  heute:         { label: 'Heute',           bg: '#FEF3E2', color: C.amber },
  morgen:        { label: 'Morgen',          bg: '#F3F4F6', color: C.sub },
};

const OFFER_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: C.amberBg, color: C.amber },
  accepted: { bg: C.greenBg, color: C.green },
  declined: { bg: '#FDEAEA', color: C.red },
  expired:  { bg: C.bg,      color: C.muted },
};

// ── Sub-components ─────────────────────────────────────────────

function Avatar({ initials: i }: { initials: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{i}</Text>
    </View>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const config: Record<Tab, { icon: string; label: string }> = {
    angebote:      { icon: 'paper-plane-outline',       label: 'gesendeten' },
    aktiv:         { icon: 'briefcase-outline',         label: 'aktiven' },
    abgeschlossen: { icon: 'checkmark-circle-outline',  label: 'abgeschlossenen' },
    storniert:     { icon: 'close-circle-outline',      label: 'stornierten' },
  };
  const { icon, label } = config[tab];

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon as 'briefcase-outline'} size={30} color={C.muted} />
      </View>
      <Text style={styles.emptyTitle}>Noch keine {label} Aufträge</Text>
      <Text style={styles.emptySubtitle}>
        {tab === 'angebote'
          ? 'Deine gesendeten Angebote erscheinen hier.'
          : tab === 'aktiv'
          ? 'Angenommene Jobs erscheinen hier.'
          : tab === 'abgeschlossen'
          ? 'Abgeschlossene Aufträge erscheinen hier.'
          : 'Stornierte Aufträge erscheinen hier.'}
      </Text>
    </View>
  );
}

function OfferCard({ offer }: { offer: OfferWithJob }) {
  const colors = OFFER_STATUS_COLORS[offer.status] ?? OFFER_STATUS_COLORS.expired;
  const dateStr = new Date(offer.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + '.';

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.offerJobIcon}>
          <Ionicons name="construct-outline" size={16} color={C.gold} />
        </View>
        <View style={styles.cardCustomerInfo}>
          <Text style={styles.cardCustomerName} numberOfLines={1}>{offer.job.title}</Text>
          <Text style={styles.cardDateSub}>{offer.job.address_city}, {offer.job.address_plz}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusChipText, { color: colors.color }]}>
            {offerStatusLabel(offer.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardPriceRow}>
        <Text style={styles.cardPrice}>€{offer.price.toFixed(2).replace('.', ',')}</Text>
        <View style={styles.dateChip}>
          <Ionicons name="calendar-outline" size={11} color={C.muted} />
          <Text style={[styles.dateChipText, { color: C.muted }]}>{dateStr}</Text>
        </View>
      </View>

      {!!offer.description && (
        <Text style={styles.offerDesc} numberOfLines={2}>{offer.description}</Text>
      )}
    </View>
  );
}

function ActiveCard({ job, onChat, onVertrag, onAbschliessen }: {
  job: ActiveJob;
  onChat: () => void;
  onVertrag: () => void;
  onAbschliessen: () => void;
}) {
  const statusCfg = STATUS_CONFIG[job.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Avatar initials={job.initials} />
        <View style={styles.cardCustomerInfo}>
          <Text style={styles.cardCustomerName}>{job.customer}</Text>
          <View style={styles.dateChip}>
            <Ionicons name="time-outline" size={11} color={C.amber} />
            <Text style={styles.dateChipText}>{job.dateLabel}</Text>
          </View>
        </View>
        <View style={[styles.statusChip, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusChipText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      <View style={styles.serviceBadge}>
        <Ionicons name={job.serviceIcon as 'sparkles-outline'} size={13} color={C.gold} />
        <Text style={styles.serviceBadgeText}>{job.service}</Text>
      </View>

      <View style={styles.cardAddressRow}>
        <Ionicons name="location-outline" size={13} color={C.muted} />
        <Text style={styles.cardAddressText}>{job.address}</Text>
      </View>

      <View style={styles.cardPriceRow}>
        <Text style={styles.cardPrice}>€{job.price.toFixed(2).replace('.', ',')}</Text>
        <View style={styles.escrowRow}>
          <Ionicons name="lock-closed" size={12} color={C.green} />
          <Text style={styles.escrowText}>Escrow gesichert</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onChat}>
          <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
          <Text style={styles.actionBtnText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onVertrag}>
          <Ionicons name="document-text-outline" size={14} color={C.sub} />
          <Text style={styles.actionBtnText}>Vertrag</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onAbschliessen}>
          <Ionicons name="checkmark-circle-outline" size={14} color={C.surface} />
          <Text style={[styles.actionBtnText, styles.actionBtnPrimaryText]}>Abschließen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DoneCard({ job, onReview }: { job: DoneJob; onReview: () => void }) {
  return (
    <View style={[styles.card, styles.cardDimmed]}>
      <View style={styles.cardTopRow}>
        <Avatar initials={job.initials} />
        <View style={styles.cardCustomerInfo}>
          <Text style={styles.cardCustomerName}>{job.customer}</Text>
          <Text style={styles.cardDateSub}>{job.dateLabel}</Text>
        </View>
        <View style={styles.doneChip}>
          <Ionicons name="checkmark-circle" size={12} color={C.green} />
          <Text style={styles.doneChipText}>Abgeschlossen</Text>
        </View>
      </View>

      <View style={styles.serviceBadge}>
        <Ionicons name="construct-outline" size={13} color={C.gold} />
        <Text style={styles.serviceBadgeText}>{job.service}</Text>
      </View>

      <View style={styles.cardPriceRow}>
        <Text style={styles.cardPrice}>€{job.price.toFixed(2).replace('.', ',')}</Text>
        <View style={styles.payoutRow}>
          <Ionicons name="arrow-down-circle-outline" size={13} color={C.green} />
          <Text style={styles.payoutText}>Auszahlung: {job.payoutDate}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFull]} onPress={onReview}>
          <Ionicons name="star-outline" size={14} color={C.gold} />
          <Text style={[styles.actionBtnText, { color: C.gold }]}>Bewertung ansehen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CancelledCard({ job }: { job: CancelledJob }) {
  return (
    <View style={[styles.card, styles.cardCancelled]}>
      <View style={styles.cardTopRow}>
        <Avatar initials={job.initials} />
        <View style={styles.cardCustomerInfo}>
          <Text style={[styles.cardCustomerName, { color: C.sub }]}>{job.customer}</Text>
          <Text style={styles.cardDateSub}>{job.dateLabel}</Text>
        </View>
        <View style={styles.cancelledChip}>
          <Text style={styles.cancelledChipText}>Storniert</Text>
        </View>
      </View>

      <View style={[styles.serviceBadge, { backgroundColor: '#F3F4F6' }]}>
        <Ionicons name="construct-outline" size={13} color={C.muted} />
        <Text style={[styles.serviceBadgeText, { color: C.muted }]}>{job.service}</Text>
      </View>

      <View style={styles.cardAddressRow}>
        <Ionicons name="information-circle-outline" size={13} color={C.red} />
        <Text style={[styles.cardAddressText, { color: C.red }]}>{job.reason}</Text>
      </View>

      <View style={styles.cardPriceRow}>
        <Text style={[styles.cardPrice, { color: C.muted, textDecorationLine: 'line-through' }]}>
          €{job.price.toFixed(2).replace('.', ',')}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = 60;

export default function ProviderAuftraegeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('aktiv');
  const [contracts, setContracts] = useState<ContractWithJobAndCustomer[]>([]);
  const [offers, setOffers] = useState<OfferWithJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      getMyContractsAsProvider(user.id),
      getMyOffersAsProvider(user.id),
    ])
      .then(([c, o]) => { setContracts(c); setOffers(o); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;

    const providerId = user.id;
    const channel = supabase
      .channel(`provider-auftraege-${providerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers', filter: `provider_id=eq.${providerId}` },
        () => {
          Promise.all([
            getMyContractsAsProvider(providerId),
            getMyOffersAsProvider(providerId),
          ]).then(([c, o]) => { setContracts(c); setOffers(o); }).catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts', filter: `provider_id=eq.${providerId}` },
        () => {
          Promise.all([
            getMyContractsAsProvider(providerId),
            getMyOffersAsProvider(providerId),
          ]).then(([c, o]) => { setContracts(c); setOffers(o); }).catch(() => {});
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const useReal = isSupabaseConfigured && !loadError;

  const activeJobs = useReal
    ? contracts.filter((c) => c.status === 'active' || c.status === 'pending').map(contractToActiveJob)
    : ACTIVE_JOBS;

  const doneJobs = useReal
    ? contracts.filter((c) => c.status === 'completed').map(contractToDoneJob)
    : DONE_JOBS;

  const cancelledJobs = useReal
    ? contracts.filter((c) => c.status === 'cancelled' || c.status === 'disputed').map(contractToCancelledJob)
    : CANCELLED_JOBS;

  const displayOffers = useReal ? offers : [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'angebote',      label: 'Angebote' },
    { key: 'aktiv',         label: 'Aktiv' },
    { key: 'abgeschlossen', label: 'Abgeschlossen' },
    { key: 'storniert',     label: 'Storniert' },
  ];

  async function handleAbschliessen(job: ActiveJob) {
    showAlert(
      'Auftrag abschließen?',
      `Den Auftrag für ${job.customer} jetzt als abgeschlossen markieren? Der Escrow-Betrag wird nach Kundenbewertung freigegeben.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Abschließen',
          onPress: async () => {
            if (!isSupabaseConfigured || !user?.id) return;
            try {
              await completeContract(job.id);
              const updated = await getMyContractsAsProvider(user.id);
              setContracts(updated);
            } catch {
              showAlert('Fehler', 'Auftrag konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
            }
          },
        },
      ],
    );
  }

  function handleReview() {
    showAlert('Bewertung abgeben', 'Bewertungen können nach offiziellem Auftragsabschluss abgegeben werden. Die Funktion wird mit dem Launch freigeschaltet.');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meine Aufträge</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.tabItem}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={C.gold} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        >
          {tab === 'angebote' && (
            displayOffers.length === 0
              ? <EmptyState tab="angebote" />
              : displayOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)
          )}

          {tab === 'aktiv' && (
            activeJobs.length === 0
              ? <EmptyState tab="aktiv" />
              : activeJobs.map((job) => (
                  <ActiveCard
                    key={job.id}
                    job={job}
                    onChat={() => router.push('/chat' as never)}
                    onVertrag={() => router.push('/vertrag' as never)}
                    onAbschliessen={() => handleAbschliessen(job)}
                  />
                ))
          )}

          {tab === 'abgeschlossen' && (
            doneJobs.length === 0
              ? <EmptyState tab="abgeschlossen" />
              : doneJobs.map((job) => (
                  <DoneCard
                    key={job.id}
                    job={job}
                    onReview={handleReview}
                  />
                ))
          )}

          {tab === 'storniert' && (
            cancelledJobs.length === 0
              ? <EmptyState tab="storniert" />
              : cancelledJobs.map((job) => (
                  <CancelledCard key={job.id} job={job} />
                ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: C.bg },

  header:               { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle:          { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },

  tabBarScroll:         { borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  tabBarContent:        { paddingHorizontal: 20 },
  tabItem:              { marginRight: 24, paddingBottom: 10, alignItems: 'center' },
  tabLabel:             { fontSize: 14, fontWeight: '500', color: C.muted },
  tabLabelActive:       { color: C.gold, fontWeight: '700' },
  tabUnderline:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.gold, borderRadius: 2 },

  loadingWrap:          { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent:        { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  emptyState:           { alignItems: 'center', paddingTop: 56, paddingBottom: 24 },
  emptyIconWrap:        { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:           { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6 },
  emptySubtitle:        { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },

  card:                 {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardDimmed:           { opacity: 0.9 },
  cardCancelled:        { backgroundColor: '#FAFAFA', borderColor: C.border },

  cardTopRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:               { width: 38, height: 38, borderRadius: 19, backgroundColor: C.goldBg, borderWidth: 1, borderColor: '#E8D8A0', alignItems: 'center', justifyContent: 'center' },
  avatarText:           { fontSize: 13, fontWeight: '800', color: C.gold },
  offerJobIcon:         { width: 38, height: 38, borderRadius: 10, backgroundColor: C.goldBg, borderWidth: 1, borderColor: '#E8D8A0', alignItems: 'center', justifyContent: 'center' },
  cardCustomerInfo:     { flex: 1, gap: 3 },
  cardCustomerName:     { fontSize: 14, fontWeight: '700', color: C.ink },
  cardDateSub:          { fontSize: 11, color: C.muted, fontWeight: '500' },

  dateChip:             { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.amberBg, borderRadius: 5, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3 },
  dateChipText:         { fontSize: 11, fontWeight: '600', color: C.amber },

  statusChip:           { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipText:       { fontSize: 11, fontWeight: '700' },

  doneChip:             { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  doneChipText:         { fontSize: 11, fontWeight: '700', color: C.green },

  cancelledChip:        { backgroundColor: '#FDEAEA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  cancelledChipText:    { fontSize: 11, fontWeight: '700', color: C.red },

  serviceBadge:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.goldBg, borderRadius: 7, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, marginBottom: 8 },
  serviceBadgeText:     { fontSize: 12, fontWeight: '600', color: C.gold },

  cardAddressRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  cardAddressText:      { fontSize: 12, color: C.muted },

  cardPriceRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardPrice:            { fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.3 },
  escrowRow:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  escrowText:           { fontSize: 11, fontWeight: '600', color: C.green },
  payoutRow:            { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payoutText:           { fontSize: 12, color: C.green, fontWeight: '600' },

  offerDesc:            { fontSize: 12, color: C.sub, lineHeight: 18, marginTop: 6 },

  cardDivider:          { height: 1, backgroundColor: C.border, marginVertical: 12 },

  actionRow:            { flexDirection: 'row', gap: 8 },
  actionBtn:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText:        { fontSize: 12, fontWeight: '600', color: C.sub },
  actionBtnPrimary:     { flex: 1, justifyContent: 'center', backgroundColor: C.primary, borderColor: C.primary },
  actionBtnPrimaryText: { color: C.surface, fontWeight: '700' },
  actionBtnFull:        { flex: 1, justifyContent: 'center', backgroundColor: C.goldBg, borderColor: C.gold },
});
