import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { shadow } from '../constants/theme';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getJobById } from '../lib/jobs';
import { getOffersForJob, acceptOffer } from '../lib/offers';
import { requireVerifiedEmail } from '../lib/auth';
import { getContractByJobId, type ContractWithJobAndProvider } from '../lib/contracts';
import type { Job, Offer } from '../lib/database.types';
import { FEATURES } from '../constants/features';
import { ProgressRing } from '../components/ui/ProgressRing';
import { isNachbarschaftsfaehigeKategorie } from '../data/categories';
import { trackEvent, trackError } from '../lib/analytics';
import { toast } from '../components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────

type StepStatus = 'done' | 'current' | 'pending';

interface TimelineStep {
  id: number;
  label: string;
  sub: string;
  status: StepStatus;
}

// ── Helpers ───────────────────────────────────────────────────

function fmtDt(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}

function eur(v: number): string {
  return `€${v.toFixed(2).replace('.', ',')}`;
}

function buildTimeline(contract: ContractWithJobAndProvider, job: Job): TimelineStep[] {
  const isCompleted = contract.status === 'completed';
  const hasEscrow = !!contract.escrow_captured_at;

  return [
    {
      id: 1,
      label: 'Auftrag erstellt',
      sub: fmtDt(job.created_at),
      status: 'done',
    },
    {
      id: 2,
      label: 'Angebot erhalten',
      sub: `${fmtDt(contract.created_at)} · ${eur(contract.price_gross)} vereinbart`,
      status: 'done',
    },
    {
      id: 3,
      label: 'Angebot angenommen',
      sub: `${fmtDt(contract.created_at)} · Vertrag digital signiert`,
      status: 'done',
    },
    {
      id: 4,
      label: 'Zahlung hinterlegt',
      sub: hasEscrow
        ? `${fmtDt(contract.escrow_captured_at!)} · ${eur(contract.customer_total)} via Stripe Escrow`
        : 'Zahlung ausstehend',
      status: hasEscrow ? 'done' : 'current',
    },
    {
      id: 5,
      label: 'Termin',
      sub: job.scheduled_at
        ? fmtDt(job.scheduled_at)
        : 'Termin ausstehend — Anbieter wird sich melden',
      status: isCompleted ? 'done' : (hasEscrow ? 'current' : 'pending'),
    },
    {
      id: 6,
      label: 'Zahlung freigeben',
      sub: isCompleted && contract.completed_at
        ? fmtDt(contract.completed_at)
        : 'Nach Auftragsabschluss',
      status: isCompleted ? 'done' : 'pending',
    },
  ];
}

// ── Sub-components ─────────────────────────────────────────────

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <View style={[styles.dot, { backgroundColor: C.primary }]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }
  if (status === 'current') {
    return (
      <View style={[styles.dot, { backgroundColor: C.amber }]}>
        <Ionicons name="time-outline" size={12} color="#fff" />
      </View>
    );
  }
  return <View style={[styles.dot, { backgroundColor: C.bg, borderWidth: 2, borderColor: C.border }]} />;
}

function OfferCard({
  offer,
  track,
  onAccept,
  accepting,
}: {
  offer: Offer;
  track: 'handwerker' | 'nachbarschaft';
  onAccept: () => void;
  accepting: boolean;
}) {
  const isNB = track === 'nachbarschaft';
  // Mirror DB accept_offer fee logic exactly
  const werkrSchutzFee  = isNB ? 1.99 : 0;
  const customerFee     = isNB ? 0 : Math.round(Math.max(offer.price * 0.025, 1.50) * 100) / 100;
  const commission      = isNB ? 0 : Math.round(Math.max(offer.price * 0.08, 3.00) * 100) / 100;
  const customerTotal   = offer.price + werkrSchutzFee + customerFee;
  const providerPayout  = offer.price - commission;

  const feeLabel = isNB
    ? `Werkant-Schutz: €1,99 · Anbieter erhält: ${eur(providerPayout)}`
    : `Servicegebühr: ${eur(customerFee)} · Anbieter erhält: ${eur(providerPayout)}`;

  return (
    <View style={styles.offerCard}>
      <View style={styles.offerTopRow}>
        <View style={styles.offerAvatar}>
          <Ionicons name="person-outline" size={18} color={C.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.offerPrice}>{eur(offer.price)}</Text>
          {offer.duration_hours ? (
            <Text style={styles.offerMeta}>ca. {offer.duration_hours}h · {eur(offer.price / offer.duration_hours)}/h</Text>
          ) : null}
          <Text style={styles.offerMeta}>
            Eingegangen: {new Date(offer.created_at).toLocaleDateString('de-DE')}
          </Text>
        </View>
      </View>
      {offer.description ? (
        <Text style={styles.offerDesc}>"{offer.description}"</Text>
      ) : null}
      <View style={styles.offerFeeRow}>
        <Text style={styles.offerFeeText}>{feeLabel}</Text>
      </View>
      <TouchableOpacity
        style={[styles.acceptOfferBtn, accepting && { opacity: 0.6 }]}
        onPress={onAccept}
        disabled={accepting}
        activeOpacity={0.85}
      >
        {accepting
          ? <ActivityIndicator color={C.surface} size="small" />
          : <>
              <Ionicons name="checkmark-circle-outline" size={16} color={C.surface} />
              <Text style={styles.acceptOfferBtnText}>Angebot annehmen · {eur(customerTotal)} gesamt</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────

export default function AuftragDetailScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contract, setContract] = useState<ContractWithJobAndProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !isSupabaseConfigured) return;
    setLoading(true);
    Promise.all([getJobById(jobId), getOffersForJob(jobId)])
      .then(([j, o]) => {
        setJob(j);
        setOffers(o);
        if (o.length > 0) trackEvent('offer_viewed', { count: o.length });
        if (j && j.status !== 'open' && j.status !== 'matched') {
          return getContractByJobId(jobId).then(setContract);
        }
      })
      .catch(() => toast.error('Auftrag konnte nicht geladen werden — bitte erneut versuchen'))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`job-detail-${jobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers', filter: `job_id=eq.${jobId}` },
        () => {
          getOffersForJob(jobId).then(setOffers).catch(() => toast.error('Angebote konnten nicht geladen werden'));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts', filter: `job_id=eq.${jobId}` },
        () => {
          getContractByJobId(jobId).then(setContract).catch(() => { /* Realtime-Refresh, still */ });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  async function handleAcceptOffer(offerId: string) {
    if (!jobId || !user || !isSupabaseConfigured) return;
    if (!(await requireVerifiedEmail(user))) return;
    setAcceptingId(offerId);
    try {
      await acceptOffer(offerId, jobId);
      trackEvent('offer_accepted', { track: job?.track ?? 'handwerker' });
      const [updatedJob, updatedContract] = await Promise.all([
        getJobById(jobId),
        getContractByJobId(jobId),
      ]);
      setJob(updatedJob);
      setOffers([]);
      setContract(updatedContract);
      if (updatedContract) {
        trackEvent('contract_created', { track: updatedContract.track ?? 'handwerker' });
        // Ohne Zahlung kein Escrow — direkt weiter zur Zahlung, sonst bleibt
        // der Vertrag dauerhaft 'pending' und der Anbieter wartet vergeblich.
        router.push({ pathname: '/zahlung', params: { contractId: updatedContract.id } });
      } else {
        showAlert(
          'Angebot angenommen',
          'Der Vertrag wurde erstellt. Dein Anbieter erhält eine Benachrichtigung und meldet sich bald bei dir.',
        );
      }
    } catch {
      trackError('offer_accept');
      showAlert('Fehler', 'Das Angebot konnte nicht angenommen werden. Bitte versuche es erneut.');
    } finally {
      setAcceptingId(null);
    }
  }

  function handleCancelContract() {
    if (!contract || !jobId) return;
    const hours = job?.scheduled_at
      ? (new Date(job.scheduled_at).getTime() - Date.now()) / 3_600_000
      : 72;
    router.push({
      pathname: '/stornierung',
      params: {
        contractId: contract.id,
        jobTitle: job?.title ?? '',
        hoursUntil: Math.round(hours).toString(),
      },
    });
  }

  const jobTitle = job?.title ?? 'Auftragsdetails';
  const jobCity = job ? (`${job.address_plz ?? ''} ${job.address_city ?? ''}`).trim() || '—' : '—';
  const jobStatus = job?.status ?? 'open';
  const isOpen = jobStatus === 'open' || jobStatus === 'matched';

  // Modell D — bedarfsgetriebener Nachbarschafts-Fallback (docs/produkt/
  // Nachbarschaftsunterstuetzung-Modell-D.md): nur für Handwerker-Aufträge in den
  // freigegebenen Startkategorien, solange noch kein Angebot eingegangen ist.
  // Hinter FEATURES.NACHBARSCHAFT, wie jeder andere Nachbarschafts-Einstiegspunkt.
  const showNachbarschaftFallback =
    FEATURES.NACHBARSCHAFT &&
    isOpen &&
    offers.length === 0 &&
    job?.track !== 'nachbarschaft' &&
    !!job?.category &&
    isNachbarschaftsfaehigeKategorie(job.category);

  useEffect(() => {
    if (showNachbarschaftFallback) trackEvent('fallback_shown');
  }, [showNachbarschaftFallback]);

  const providerName = contract?.provider?.business_name || 'Anbieter';
  const providerRating = contract?.provider?.rating_avg;
  const providerRatingCount = contract?.provider?.rating_count ?? 0;
  const providerInitials = providerName.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || 'AB';

  const timeline = job && contract ? buildTimeline(contract, job) : null;
  const doneCount = timeline ? timeline.filter((s) => s.status === 'done').length : 0;
  const escrowProgress = timeline ? doneCount / timeline.length : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router, '/(tabs)/auftraege')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auftragsdetails</Text>
        <TouchableOpacity
          onPress={() => showAlert('Link kopiert', 'Auftragslink wurde in die Zwischenablage kopiert.')}
          style={styles.backBtn}
        >
          <Ionicons name="share-outline" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {loading && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color={C.ink} />
          </View>
        )}

        {/* Status Hero */}
        <View style={[styles.card, styles.heroCard]}>
          <Text style={styles.ref}>{jobId ? `#${jobId.slice(0, 8).toUpperCase()}` : '#AUF-2406-1234'}</Text>
          <Text style={styles.serviceName}>{jobTitle}</Text>
          {!isOpen && (
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>{providerName}</Text>
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-circle" size={12} color={C.primary} />
                <Text style={styles.verifiedText}>Verifiziert</Text>
              </View>
            </View>
          )}
          <View style={[styles.statusPill, isOpen && { backgroundColor: C.amberBg }]}>
            <View style={[styles.statusDot, isOpen && { backgroundColor: C.amber }]} />
            <Text style={[styles.statusText, isOpen && { color: C.amber }]}>
              {isOpen ? `Warte auf Angebote (${offers.length})` : 'In Bearbeitung'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={15} color={C.sub} />
            <Text style={styles.infoText}>{jobCity}</Text>
          </View>
          {job?.created_at && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={15} color={C.sub} />
              <Text style={styles.infoText}>
                Erstellt: {new Date(job.created_at).toLocaleDateString('de-DE')}
              </Text>
            </View>
          )}
        </View>

        {/* Pending Offers Section (only when job is open) */}
        {isOpen && (
          <>
            <Text style={styles.sectionTitle}>
              {offers.length === 0 ? 'Noch keine Angebote' : `${offers.length} Angebot${offers.length !== 1 ? 'e' : ''} eingegangen`}
            </Text>
            {offers.length === 0 ? (
              <>
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
                  <Ionicons name="time-outline" size={32} color={C.border} />
                  <Text style={{ fontSize: 14, color: C.muted, marginTop: 8, textAlign: 'center' }}>
                    Anbieter können jetzt Angebote einreichen.{'\n'}Du wirst benachrichtigt, sobald eines eingegangen ist.
                  </Text>
                </View>
                {showNachbarschaftFallback && (
                  <TouchableOpacity
                    style={styles.nbFallbackCard}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/nachbarschaft', params: { category: job!.category } })}
                  >
                    <View style={styles.nbFallbackIcon}>
                      <Ionicons name="people-outline" size={20} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nbFallbackTitle}>Kein Angebot? Ein Nachbar kann das übernehmen</Text>
                      <Text style={styles.nbFallbackBody}>
                        Geprüfte Nachbarschaftshilfe für diese Aufgabe — €1,99 Werkant-Schutz, Helfer erhält 100 %.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.sub} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  track={job?.track ?? 'handwerker'}
                  accepting={acceptingId === offer.id}
                  onAccept={() => {
                    showAlert(
                      'Angebot annehmen?',
                      `Möchtest du das Angebot für ${eur(offer.price)} annehmen? Ein verbindlicher Vertrag wird erstellt.`,
                      [
                        { text: 'Abbrechen', style: 'cancel' },
                        { text: 'Annehmen', onPress: () => handleAcceptOffer(offer.id) },
                      ],
                    );
                  }}
                />
              ))
            )}
          </>
        )}

        {/* Timeline + contract details — shown once a contract exists */}
        {!isOpen && (<>
          <Text style={styles.sectionTitle}>Auftragsverlauf</Text>
          <View style={styles.card}>
            {(timeline ?? []).map((step, idx) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <StepDot status={step.status} />
                  {idx < (timeline ?? []).length - 1 && (
                    <View style={[
                      styles.connector,
                      step.status === 'done' ? { backgroundColor: C.primary } : { backgroundColor: C.border },
                    ]} />
                  )}
                </View>
                <View style={[styles.stepContent, idx < (timeline ?? []).length - 1 && { paddingBottom: 20 }]}>
                  <Text style={[
                    styles.stepLabel,
                    step.status === 'pending' && { color: C.muted },
                  ]}>
                    {step.label}
                  </Text>
                  <Text style={[
                    styles.stepSub,
                    step.status === 'current' && { color: C.amber },
                  ]}>
                    {step.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Escrow Status — Signature-Element: Fortschritts-Ring statt flachem Balken */}
          <View style={[styles.card, { backgroundColor: C.primaryBg, borderColor: C.primary }]}>
            <View style={styles.escrowRow}>
              <ProgressRing
                progress={escrowProgress}
                label={timeline ? `${doneCount}/${timeline.length}` : undefined}
                sublabel="Schritte"
                size={72}
                trackColor="#D5E5DC"
              />
              <View style={{ flex: 1 }}>
                <View style={styles.escrowHeader}>
                  <Ionicons name="lock-closed" size={18} color={C.primary} />
                  <Text style={styles.escrowTitle}>Zahlung gesichert</Text>
                </View>
                <Text style={styles.escrowBody}>
                  {contract
                    ? `${eur(contract.customer_total)} werden nach Ihrer Freigabe an ${providerName} ausgezahlt.`
                    : 'Betrag wird nach Freigabe an den Anbieter ausgezahlt.'}
                </Text>
              </View>
            </View>
            <Text style={styles.escrowNote}>Stripe Escrow · Nie direkt an den Handwerker zahlen.</Text>
          </View>

          {/* Provider Card */}
          <Text style={styles.sectionTitle}>Anbieter</Text>
          <View style={styles.card}>
            <View style={styles.providerCardRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{providerInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.providerCardName}>{providerName}</Text>
                {contract?.provider?.rating_avg ? (
                  <View style={styles.providerCardRatingRow}>
                    <Ionicons name="star" size={12} color={C.gold} />
                    <Text style={styles.providerCardRating}>
                      {providerRating?.toFixed(1)} · {providerRatingCount} Bewertungen
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.providerCardRating}>Noch keine Bewertungen</Text>
                )}
              </View>
            </View>
            <View style={styles.providerActions}>
              <TouchableOpacity
                style={styles.providerActionBtn}
                onPress={() => router.push({ pathname: '/chat', params: { jobId: jobId ?? '', providerId: contract?.provider_id ?? '' } })}
              >
                <Ionicons name="chatbubble-outline" size={15} color={C.ink} />
                <Text style={styles.providerActionText}>Chat öffnen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.providerActionBtn}
                onPress={() => router.push({ pathname: '/anbieter', params: { id: contract?.provider_id ?? '' } })}
              >
                <Ionicons name="person-outline" size={15} color={C.ink} />
                <Text style={styles.providerActionText}>Profil ansehen</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Price Breakdown */}
          <Text style={styles.sectionTitle}>Preisübersicht</Text>
          <View style={styles.card}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Serviceleistung</Text>
              <Text style={styles.priceValue}>{contract ? eur(contract.price_gross) : '—'}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Werkant-Schutz</Text>
              <Text style={[styles.priceValue, { color: C.muted }]}>{contract ? eur(contract.werkr_schutz_fee) : '—'}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service-Gebühr (2,5%)</Text>
              <Text style={[styles.priceValue, { color: C.muted }]}>{contract ? eur(contract.customer_service_fee) : '—'}</Text>
            </View>
            <View style={[styles.priceRow, styles.priceTotalRow]}>
              <Text style={styles.priceTotalLabel}>Hinterlegt (gesamt)</Text>
              <Text style={styles.priceTotalValue}>{contract ? eur(contract.customer_total) : '—'}</Text>
            </View>
            <Text style={styles.priceNote}>Service-Gebühr wird vor jeder Auftragsannahme ausgewiesen.</Text>
          </View>

          {/* Stornierung */}
          {contract?.status !== 'cancelled' && contract?.status !== 'completed' && (
            <TouchableOpacity
              style={styles.stornoBtn}
              activeOpacity={0.7}
              onPress={handleCancelContract}
            >
              <Ionicons name="close-circle-outline" size={16} color={C.red} />
              <Text style={styles.stornoBtnText}>Termin stornieren</Text>
            </TouchableOpacity>
          )}
        </>)}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Actions Bar — only when contracted */}
      {!isOpen && <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBarBtn} onPress={() => router.push({ pathname: '/vertrag', params: { contractId: contract?.id ?? '' } })}>
          <Ionicons name="document-text-outline" size={18} color={C.sub} />
          <Text style={styles.actionBarBtnText}>Vertrag</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBarBtn} onPress={() => router.push({ pathname: '/reklamation', params: { contractId: contract?.id ?? '' } })}>
          <Ionicons name="alert-circle-outline" size={18} color={C.red} />
          <Text style={[styles.actionBarBtnText, { color: C.red }]}>Problem</Text>
        </TouchableOpacity>
        {contract?.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionBarBtn, styles.actionBarBtnPrimary]}
            onPress={() => router.push({ pathname: '/zahlung', params: { contractId: contract.id } })}
          >
            <Ionicons name="lock-closed-outline" size={18} color={C.surface} />
            <Text style={[styles.actionBarBtnText, { color: C.surface }]}>Bezahlen</Text>
          </TouchableOpacity>
        )}
        {contract?.status === 'active' && (
          <TouchableOpacity
            style={[styles.actionBarBtn, styles.actionBarBtnPrimary]}
            onPress={() => router.push({ pathname: '/auftrag-abschliessen', params: { contractId: contract.id } })}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={C.surface} />
            <Text style={[styles.actionBarBtnText, { color: C.surface }]}>Abschließen</Text>
          </TouchableOpacity>
        )}
      </View>}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { padding: 4, width: 36 },
  headerTitle:  { flex: 1, textAlign: 'center', ...T.lg, ...T.bold, color: C.ink },
  scroll:       { paddingHorizontal: 16, paddingTop: 4 },

  card:         { ...shadow.sm,  backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, padding: 16, marginBottom: 12 },
  heroCard:     { borderLeftWidth: 4, borderLeftColor: C.primary },

  nbFallbackCard:  { ...shadow.sm,  flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd, borderRadius: 16, padding: 14, marginBottom: 12 },
  nbFallbackIcon:  { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nbFallbackTitle: { fontSize: 13.5, fontWeight: '700', color: C.ink, marginBottom: 2 },
  nbFallbackBody:  { fontSize: 12, color: C.sub, lineHeight: 17 },

  ref:          { ...T.xs, fontSize: 12, ...T.semibold, color: C.muted, letterSpacing: 0.5, marginBottom: 4 },
  serviceName:  { ...T.xl, ...T.black, color: C.ink, marginBottom: 8 },
  providerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  providerName: { ...T.body, ...T.semibold, color: C.ink },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.primaryBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { ...T.xs, ...T.semibold, color: C.primary },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  statusDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  statusText:   { ...T.xs, fontSize: 12, ...T.bold, color: C.primary },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoText:     { ...T.sm, color: C.sub },

  sectionTitle: { ...T.label, color: C.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  stepRow:      { flexDirection: 'row', gap: 12 },
  stepLeft:     { alignItems: 'center', width: 24 },
  dot:          { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  connector:    { width: 2, flex: 1, minHeight: 16, marginTop: 4 },
  stepContent:  { flex: 1, paddingBottom: 0 },
  stepLabel:    { ...T.body, ...T.semibold, color: C.ink, marginBottom: 2 },
  stepSub:      { ...T.caption, fontSize: 12, color: C.sub },

  escrowRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  escrowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  escrowTitle:  { ...T.body, ...T.bold, color: C.ink },
  escrowBody:   { ...T.sm, color: C.sub, marginBottom: 10 },
  escrowNote:   { fontSize: 11, color: C.sub },

  avatar:             { width: 48, height: 48, borderRadius: 24, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:         { fontSize: 18, fontWeight: '700', color: C.gold },
  providerCardRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  providerCardName:   { ...T.base, ...T.bold, color: C.ink },
  providerCardRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  providerCardRating: { ...T.caption, fontSize: 12, color: C.muted },
  providerActions:    { flexDirection: 'row', gap: 10 },
  providerActionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 9 },
  providerActionText: { fontSize: 13, fontWeight: '600', color: C.ink },

  priceRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel:     { ...T.sm, color: C.sub },
  priceValue:     { ...T.sm, ...T.semibold, color: C.ink },
  priceTotalRow:  { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 },
  priceTotalLabel:{ ...T.body, ...T.bold, color: C.ink },
  priceTotalValue:{ ...T.body, ...T.black, color: C.ink },
  priceNote:      { ...T.xs, color: C.muted, marginTop: 8 },

  stornoBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.red, borderRadius: 10, paddingVertical: 11, marginBottom: 12, backgroundColor: C.surface },
  stornoBtnText:     { ...T.sm, ...T.semibold, color: C.red },

  offerCard:         { ...shadow.sm,  backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.hair, borderRadius: 16, padding: 16, marginBottom: 10 },
  offerTopRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  offerAvatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  offerPrice:        { ...T['2xl'], ...T.black, color: C.ink, marginBottom: 2 },
  offerMeta:         { ...T.xs, color: C.muted, marginTop: 1 },
  offerDesc:         { ...T.sm, color: C.sub, fontStyle: 'italic', marginBottom: 10 },
  offerFeeRow:       { backgroundColor: C.bg, borderRadius: 8, padding: 10, marginBottom: 10 },
  offerFeeText:      { ...T.xs, color: C.muted },
  acceptOfferBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13 },
  acceptOfferBtnText:{ ...T.body, ...T.bold, color: C.surface },

  actionBar:         { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  // Tap-Fläche ≥ 48px (BFSG/WCAG 2.5.5 Zielgröße) — vorher paddingVertical 10
  // ergab ~40px, vom Founder als „zu klein" gemeldet.
  actionBarBtn:      { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12 },
  actionBarBtnPrimary: { flex: 2, backgroundColor: C.primary, borderColor: C.primary },
  actionBarBtnText:  { ...T.sm, ...T.semibold, color: C.ink },
});
