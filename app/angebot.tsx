import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { shadow } from '../constants/theme';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { showAlert } from '../lib/alert';
import { useAuth } from '../contexts/AuthContext';
import { getJobById } from '../lib/jobs';
import { getOffersForJob, acceptOffer, declineOffer } from '../lib/offers';
import { requireVerifiedEmail } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { calcFees } from '../lib/feeEngine';
import type { Job, Offer } from '../lib/database.types';
import { NichtGefunden } from '../components/ui/NichtGefunden';

type ProviderMeta = { business_name: string | null; rating_avg: number | null; rating_count: number };

function eur(v: number): string {
  return `€ ${v.toFixed(2).replace('.', ',')}`;
}

type InfoRowProps = { label: string; value: string; gold?: boolean; bold?: boolean; muted?: boolean };
function InfoRow({ label, value, gold, bold, muted }: InfoRowProps) {
  return (
    <View style={row.wrap}>
      <Text style={row.label}>{label}</Text>
      <Text style={[row.value, gold && row.gold, bold && row.bold, muted && row.muted]}>{value}</Text>
    </View>
  );
}

export default function AngebotScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();

  const [job,      setJob]      = useState<Job | null>(null);
  const [offer,    setOffer]    = useState<Offer | null>(null);
  const [provider, setProvider] = useState<ProviderMeta | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!jobId) { setLoading(false); return; }
    async function load() {
      try {
        const [j, offers] = await Promise.all([
          getJobById(jobId!),
          getOffersForJob(jobId!),
        ]);
        setJob(j);
        const first = offers[0] ?? null;
        setOffer(first);
        if (first) {
          const { data } = await supabase
            .from('provider_public')
            .select('business_name, rating_avg, rating_count')
            .eq('id', first.provider_id)
            // maybeSingle: fehlendes Anbieter-Profil soll das Angebot nicht
            // komplett in den Fehlerzustand werfen — nur die Meta bleibt leer.
            .maybeSingle<ProviderMeta>();
          setProvider(data);
        }
      } catch {
        // keep null state — show error below
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  async function handleAccept() {
    if (!offer || !job || !user) return;
    if (!(await requireVerifiedEmail(user))) return;
    setAccepting(true);
    try {
      const contract = await acceptOffer(offer.id, job.id);
      router.replace({ pathname: '/zahlung', params: { contractId: contract.id } });
    } catch {
      showAlert('Fehler', 'Angebot konnte nicht angenommen werden. Bitte versuchen Sie es erneut.');
    } finally {
      setAccepting(false);
    }
  }

  function handleDecline() {
    showAlert(
      'Angebot ablehnen?',
      'Das Angebot wird abgelehnt. Der Handwerker wird informiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ablehnen',
          style: 'destructive',
          onPress: async () => {
            if (offer) {
              try { await declineOffer(offer.id); } catch { /* schon bearbeitet — Navigation reicht */ }
            }
            safeBack(router);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!offer || !job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Angebot prüfen</Text>
          <View style={{ width: 36 }} />
        </View>
        {/* Hier stand bis 16.08.2026 nur die Zeile "Kein Angebot gefunden" —
            ohne einen Grund und ohne einen Weg zurueck. Wer ueber eine
            Push-Benachrichtigung kommt und das liest, weiss weder warum noch
            wohin. Dieselbe Auskunft wie auf /rechnung und /vertrag. */}
        <NichtGefunden
          titel="Angebot nicht gefunden"
          text="Dieses Angebot wurde zurückgezogen oder bereits bearbeitet — oder es gehört nicht zu Ihrem Konto."
          knopf="Zu meinen Aufträgen"
          onKnopf={() => safeBack(router, '/(tabs)/auftraege')}
        />
      </SafeAreaView>
    );
  }

  const isNB     = job.track === 'nachbarschaft';
  const fees     = calcFees(offer.price, job.track, false);
  const initials = (provider?.business_name ?? 'A').charAt(0).toUpperCase();
  const provName = provider?.business_name ?? 'Anbieter';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Angebot prüfen</Text>
        <Badge label="Neu" variant="amber" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Provider card */}
        <TouchableOpacity
          style={styles.providerCard}
          onPress={() => router.push({ pathname: '/anbieter', params: { id: offer.provider_id } })}
          activeOpacity={0.85}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{initials}</Text>
          </View>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName} numberOfLines={1}>{provName}</Text>
            {provider?.rating_avg ? (
              <View style={styles.providerMeta}>
                <Ionicons name="star" size={12} color={C.gold} />
                <Text style={styles.providerRating}>{provider.rating_avg.toFixed(1)}</Text>
                <Text style={styles.providerReviews}>({provider.rating_count})</Text>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </TouchableOpacity>

        {/* Offer details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Angebotsdetails</Text>
          <InfoRow label="Leistung" value={job.title} />
          <InfoRow label="Angebotspreis" value={eur(offer.price)} gold />
          {offer.duration_hours ? (
            <InfoRow label="Dauer" value={`ca. ${offer.duration_hours} Std.`} />
          ) : null}
          {job.address_city ? (
            <InfoRow label="Adresse" value={`${job.address_plz ?? ''} ${job.address_city}`.trim()} />
          ) : null}
          {offer.description ? (
            <>
              <Divider margin={12} />
              <Text style={styles.descLabel}>Nachricht vom Anbieter</Text>
              <Text style={styles.descText}>{offer.description}</Text>
            </>
          ) : null}
          <Divider margin={12} />
          {isNB
            ? <InfoRow label="Werkant-Schutz" value={eur((fees as any).werkrSchutz)} muted />
            : <InfoRow label="Service-Gebühr (2,5%)" value={eur((fees as any).customerServiceFee)} muted />
          }
          <InfoRow label="Gesamtbetrag" value={eur(fees.customerTotal)} bold />
        </View>

        {/* Info banners */}
        <View style={styles.escrowBanner}>
          <Ionicons name="lock-closed" size={18} color={C.primary} />
          <Text style={styles.escrowText}>
            Ihr Geld liegt sicher bei uns, bis die Arbeit fertig ist. Ausgezahlt
            wird es erst, wenn Sie bestätigen.
          </Text>
        </View>
        <View style={styles.cancellationBanner}>
          <Ionicons name="warning-outline" size={18} color={C.amber} />
          {/* Founder-Befund 16.08.2026: "Die erklaerung ist zu ki geschrieben
              es soll schon menschlich sein."
              Hier stand: "Kostenlose Stornierung bis 48 Stunden vor Termin.
              Bei 24-48h: 50% Rueckerstattung." Nominalstil, Doppelpunkt-Liste,
              "24-48h" — so schreibt niemand.
              Beim Umschreiben fiel auf, dass der Satz auch UNVOLLSTAENDIG war,
              und zwar zulasten des Kunden: dass er in den letzten 24 Stunden
              GAR NICHTS zurueckbekommt, stand nirgends. Ebensowenig, dass eine
              Absage des Handwerkers immer voll erstattet wird — das ist der
              beruhigende Teil und fehlte auch.
              Werte gegen lib/cancellationRefund.ts geprueft:
              >48h = 100%, 24-48h = 50%, <=24h = 0%, Anbieter-Absage = 100%. */}
          <Text style={styles.cancellationText}>
            Bis 48 Stunden vor dem Termin sagen Sie kostenlos ab. Danach
            behalten wir die Hälfte ein, in den letzten 24 Stunden den ganzen
            Betrag. Sagt der Handwerker ab, bekommen Sie immer alles zurück.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator color={C.surface} />
            : <>
                <Ionicons name="checkmark-circle" size={20} color={C.surface} />
                <Text style={styles.acceptBtnText}>Angebot annehmen & Vertrag abschließen</Text>
              </>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.85}>
          <Text style={styles.declineBtnText}>Ablehnen</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const row = StyleSheet.create({
  wrap:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  label: { fontSize: 13, color: C.sub, flex: 1 },
  value: { fontSize: 13, color: C.ink, flex: 1, textAlign: 'right' },
  gold:  { color: C.gold, fontWeight: '700' },
  bold:  { fontWeight: '700' },
  muted: { color: C.muted },
});

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { flex: 1, fontSize: 18, fontWeight: '700', color: C.ink },
  scrollContent:    { paddingBottom: 190 },
  providerCard:     { ...shadow.sm,  flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, marginHorizontal: 20, marginBottom: 16, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.hair },
  avatarCircle:     { width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:     { fontSize: 18, fontWeight: '700', color: C.gold },
  providerInfo:     { flex: 1, gap: 3 },
  providerName:     { fontSize: 15, fontWeight: '700', color: C.ink },
  providerMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  providerRating:   { fontSize: 12, fontWeight: '700', color: C.ink },
  providerReviews:  { fontSize: 12, color: C.muted },
  section:          { backgroundColor: C.surface, marginHorizontal: 20, marginBottom: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  sectionTitle:     { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  descLabel:        { fontSize: 11, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  descText:         { fontSize: 13, color: C.ink, lineHeight: 20, fontStyle: 'italic' },
  escrowBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.primaryBg, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 14 },
  escrowText:       { flex: 1, fontSize: 13, color: C.primary, lineHeight: 19 },
  cancellationBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.amberBg, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 14 },
  cancellationText: { flex: 1, fontSize: 13, color: C.amber, lineHeight: 19 },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 32, gap: 10 },
  acceptBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 16 },
  acceptBtnText:    { fontSize: 15, fontWeight: '700', color: C.surface },
  declineBtn:       { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: C.red },
  declineBtnText:   { fontSize: 15, fontWeight: '600', color: C.red },
});
