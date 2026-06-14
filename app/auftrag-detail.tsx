import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { getJobById } from '../lib/jobs';
import { getOffersForJob, acceptOffer } from '../lib/offers';
import type { Job, Offer } from '../lib/database.types';

type StepStatus = 'done' | 'current' | 'pending';

interface TimelineStep {
  id: number;
  label: string;
  sub: string;
  status: StepStatus;
}

const STEPS: TimelineStep[] = [
  { id: 1, label: 'Auftrag erstellt',      sub: '13.06.2026, 09:15',                            status: 'done'    },
  { id: 2, label: 'Angebot erhalten',      sub: '13.06.2026, 10:30 · €320,00 Festpreis',        status: 'done'    },
  { id: 3, label: 'Angebot angenommen',    sub: '13.06.2026, 11:05 · Vertrag digital signiert', status: 'done'    },
  { id: 4, label: 'Zahlung hinterlegt',    sub: '13.06.2026, 11:06 · €320,00 via Stripe Escrow',status: 'done'    },
  { id: 5, label: 'Termin',                sub: 'Mo., 16.06.2026 · 14:00 Uhr · ausstehend',     status: 'current' },
  { id: 6, label: 'Zahlung freigeben',     sub: 'Nach Auftragsabschluss',                        status: 'pending' },
];

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <View style={[styles.dot, { backgroundColor: C.green }]}>
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
  onAccept,
  accepting,
}: {
  offer: Offer;
  onAccept: () => void;
  accepting: boolean;
}) {
  const eur = (v: number) => `€${v.toFixed(2).replace('.', ',')}`;
  const commission = Math.round(offer.price * 0.08 * 100) / 100;
  const customerFee = Math.round(offer.price * 0.025 * 100) / 100;

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
        <Text style={styles.offerFeeText}>
          WERKR-Schutz: €1,99 · Servicegebühr: {eur(customerFee)} · Anbieter erhält: {eur(offer.price - commission)}
        </Text>
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
              <Text style={styles.acceptOfferBtnText}>Angebot annehmen · {eur(offer.price + customerFee + 1.99)} gesamt</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

export default function AuftragDetailScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !isSupabaseConfigured) return;
    setLoading(true);
    Promise.all([getJobById(jobId), getOffersForJob(jobId)])
      .then(([j, o]) => { setJob(j); setOffers(o); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  async function handleAcceptOffer(offerId: string) {
    if (!jobId || !user || !isSupabaseConfigured) return;
    setAcceptingId(offerId);
    try {
      await acceptOffer(offerId, jobId, user.id);
      showAlert(
        'Angebot angenommen',
        'Der Vertrag wurde erstellt. Dein Anbieter erhält eine Benachrichtigung und meldet sich bald bei dir.',
        [{ text: 'Zum Auftrag', onPress: () => {
          if (jobId) {
            getJobById(jobId).then(setJob).catch(() => {});
            getOffersForJob(jobId).then(setOffers).catch(() => {});
          }
        }}],
      );
    } catch {
      showAlert('Fehler', 'Das Angebot konnte nicht angenommen werden. Bitte versuche es erneut.');
    } finally {
      setAcceptingId(null);
    }
  }

  const jobTitle = job?.title ?? 'Badezimmer fließen';
  const jobCity = job ? `${job.address_plz} ${job.address_city}` : 'Kölner Str. 22, 50667 Köln';
  const jobStatus = job?.status ?? 'contracted';
  const isOpen = jobStatus === 'open' || jobStatus === 'matched';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
              <Text style={styles.providerName}>{job?.provider_id ? 'Anbieter zugewiesen' : 'Yilmaz GmbH'}</Text>
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-circle" size={12} color={C.green} />
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
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <Ionicons name="time-outline" size={32} color={C.border} />
                <Text style={{ fontSize: 14, color: C.muted, marginTop: 8, textAlign: 'center' }}>
                  Anbieter können jetzt Angebote einreichen.{'\n'}Du wirst benachrichtigt, sobald eines eingegangen ist.
                </Text>
              </View>
            ) : (
              offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  accepting={acceptingId === offer.id}
                  onAccept={() => {
                    showAlert(
                      'Angebot annehmen?',
                      `Möchtest du das Angebot für €${offer.price.toFixed(2).replace('.', ',')} annehmen? Ein verbindlicher Vertrag wird erstellt.`,
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
          {STEPS.map((step, idx) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <StepDot status={step.status} />
                {idx < STEPS.length - 1 && (
                  <View style={[
                    styles.connector,
                    step.status === 'done' ? { backgroundColor: C.green } : { backgroundColor: C.border },
                  ]} />
                )}
              </View>
              <View style={[styles.stepContent, idx < STEPS.length - 1 && { paddingBottom: 20 }]}>
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

        {/* Escrow Status */}
        <View style={[styles.card, { backgroundColor: C.greenBg, borderColor: C.green }]}>
          <View style={styles.escrowHeader}>
            <Ionicons name="lock-closed" size={18} color={C.green} />
            <Text style={styles.escrowTitle}>Zahlung gesichert</Text>
          </View>
          <Text style={styles.escrowBody}>
            €320,00 werden nach Ihrer Freigabe an Yilmaz GmbH ausgezahlt.
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(4 / 6) * 100}%` as any }]} />
          </View>
          <Text style={styles.escrowNote}>Stripe Escrow · Nie direkt an den Handwerker zahlen.</Text>
        </View>

        {/* Provider Card */}
        <Text style={styles.sectionTitle}>Anbieter</Text>
        <View style={styles.card}>
          <View style={styles.providerCardRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>YG</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerCardName}>Yilmaz GmbH</Text>
              <Text style={styles.providerCardTrade}>Sanitär & Heizung</Text>
              <Text style={styles.providerCardRating}>4.7 ★ · 134 Bewertungen</Text>
            </View>
          </View>
          <View style={styles.providerActions}>
            <TouchableOpacity style={styles.providerActionBtn} onPress={() => router.push('/chat')}>
              <Ionicons name="chatbubble-outline" size={15} color={C.ink} />
              <Text style={styles.providerActionText}>Chat öffnen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.providerActionBtn} onPress={() => router.push('/anbieter')}>
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
            <Text style={styles.priceValue}>€320,00</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service-Gebühr (2,5%)</Text>
            <Text style={[styles.priceValue, { color: C.muted }]}>€8,00</Text>
          </View>
          <View style={[styles.priceRow, styles.priceTotalRow]}>
            <Text style={styles.priceTotalLabel}>Hinterlegt (gesamt)</Text>
            <Text style={styles.priceTotalValue}>€328,00</Text>
          </View>
          <Text style={styles.priceNote}>Service-Gebühr wird vor jeder Auftragsannahme ausgewiesen.</Text>
        </View>

        {/* Stornierung */}
        <TouchableOpacity
          style={styles.stornoBtn}
          activeOpacity={0.7}
          onPress={() =>
            showAlert(
              'Termin stornieren?',
              'Kostenlose Stornierung bis 24 Stunden vor dem Termin. Danach fallen Stornierungsgebühren an.\n\nDer hinterlegte Betrag (€320,00) wird umgehend zurückerstattet.',
              [
                { text: 'Abbrechen', style: 'cancel' },
                {
                  text: 'Stornieren',
                  style: 'destructive',
                  onPress: () => {},
                },
              ],
            )
          }
        >
          <Ionicons name="close-circle-outline" size={16} color={C.red} />
          <Text style={styles.stornoBtnText}>Termin stornieren</Text>
        </TouchableOpacity>
        </>)}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Actions Bar — only when contracted */}
      {!isOpen && <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBarBtn} onPress={() => router.push('/vertrag')}>
          <Ionicons name="document-text-outline" size={18} color={C.sub} />
          <Text style={styles.actionBarBtnText}>Vertrag</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBarBtn} onPress={() => router.push('/reklamation')}>
          <Ionicons name="alert-circle-outline" size={18} color={C.red} />
          <Text style={[styles.actionBarBtnText, { color: C.red }]}>Problem</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBarBtn, styles.actionBarBtnPrimary]}
          onPress={() => router.push('/auftrag-abschliessen')}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={C.surface} />
          <Text style={[styles.actionBarBtnText, { color: C.surface }]}>Abschließen</Text>
        </TouchableOpacity>
      </View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { padding: 4, width: 36 },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:       { paddingHorizontal: 16, paddingTop: 4 },

  card:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  heroCard:     { borderLeftWidth: 4, borderLeftColor: C.green },

  ref:          { fontSize: 12, color: C.muted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  serviceName:  { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 8 },
  providerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  providerName: { fontSize: 14, fontWeight: '600', color: C.ink },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { fontSize: 11, color: C.green, fontWeight: '600' },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.greenBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  statusDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  statusText:   { fontSize: 12, fontWeight: '700', color: C.green },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoText:     { fontSize: 13, color: C.sub },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  stepRow:      { flexDirection: 'row', gap: 12 },
  stepLeft:     { alignItems: 'center', width: 24 },
  dot:          { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  connector:    { width: 2, flex: 1, minHeight: 16, marginTop: 4 },
  stepContent:  { flex: 1, paddingBottom: 0 },
  stepLabel:    { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 2 },
  stepSub:      { fontSize: 12, color: C.sub, lineHeight: 17 },

  escrowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  escrowTitle:  { fontSize: 14, fontWeight: '700', color: C.ink },
  escrowBody:   { fontSize: 13, color: C.sub, marginBottom: 10 },
  progressTrack:{ height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: C.green, borderRadius: 3 },
  escrowNote:   { fontSize: 11, color: C.sub },

  avatar:             { width: 48, height: 48, borderRadius: 24, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:         { fontSize: 18, fontWeight: '700', color: C.gold },
  providerCardRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  providerCardName:   { fontSize: 15, fontWeight: '700', color: C.ink },
  providerCardTrade:  { fontSize: 12, color: C.sub, marginTop: 1 },
  providerCardRating: { fontSize: 12, color: C.muted, marginTop: 3 },
  providerActions:    { flexDirection: 'row', gap: 10 },
  providerActionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 9 },
  providerActionText: { fontSize: 13, fontWeight: '600', color: C.ink },

  priceRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel:     { fontSize: 13, color: C.sub },
  priceValue:     { fontSize: 13, fontWeight: '600', color: C.ink },
  priceTotalRow:  { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 },
  priceTotalLabel:{ fontSize: 14, fontWeight: '700', color: C.ink },
  priceTotalValue:{ fontSize: 14, fontWeight: '800', color: C.ink },
  priceNote:      { fontSize: 11, color: C.muted, marginTop: 8 },

  stornoBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.red, borderRadius: 10, paddingVertical: 11, marginBottom: 12, backgroundColor: C.surface },
  stornoBtnText:     { fontSize: 13, fontWeight: '600', color: C.red },

  offerCard:         { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 10 },
  offerTopRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  offerAvatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  offerPrice:        { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 2 },
  offerMeta:         { fontSize: 11, color: C.muted, marginTop: 1 },
  offerDesc:         { fontSize: 13, color: C.sub, fontStyle: 'italic', marginBottom: 10, lineHeight: 18 },
  offerFeeRow:       { backgroundColor: C.bg, borderRadius: 8, padding: 10, marginBottom: 10 },
  offerFeeText:      { fontSize: 11, color: C.muted, lineHeight: 16 },
  acceptOfferBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 10, paddingVertical: 13 },
  acceptOfferBtnText:{ fontSize: 14, fontWeight: '700', color: C.surface },

  actionBar:         { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  actionBarBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10 },
  actionBarBtnPrimary: { flex: 2, backgroundColor: C.green, borderColor: C.green },
  actionBarBtnText:  { fontSize: 13, fontWeight: '600', color: C.ink },
});
