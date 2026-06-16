import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../../constants/colors';
<<<<<<< HEAD
import { T } from '../../constants/typography';
=======
import { toast } from '../../components/ui/Toast';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { AnimatedButton } from '../../components/ui/AnimatedButton';

const PRO_STATUS_KEY = 'werkr_pro_status_v1';

interface ProState {
  status: 'inactive' | 'active' | 'trialing' | 'cancel_scheduled';
  periodEnd: string | null;       // ISO date string
  activatedAt: string | null;     // ISO date string
  trialUsed: boolean;
}

const PRO_DEFAULTS: ProState = {
  status: 'inactive',
  periodEnd: null,
  activatedAt: null,
  trialUsed: false,
};

async function loadProState(): Promise<ProState> {
  try {
    const raw = await AsyncStorage.getItem(PRO_STATUS_KEY);
    return raw ? { ...PRO_DEFAULTS, ...(JSON.parse(raw) as Partial<ProState>) } : { ...PRO_DEFAULTS };
  } catch { return { ...PRO_DEFAULTS }; }
}

async function saveProState(patch: Partial<ProState>): Promise<ProState> {
  const current = await loadProState();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(PRO_STATUS_KEY, JSON.stringify(next));
  return next;
}
>>>>>>> main

// Pro-Subscription UI.
// Backend-Integration ausstehend:
//   POST /api/pro/subscribe  → Stripe Billing subscription creation
//   GET  /api/pro/status     → { active, currentPeriodEnd }

const FEATURES = [
  'Prominente Platzierung in der Suche',
  'Detaillierte Umsatz-Statistiken',
  'Unbegrenzte Angebote pro Monat',
  'Sofort-Benachrichtigungen bei neuen Anfragen',
  'Eigene Profilseite mit Portfolio-Fotos',
  'Prioritäts-Support (Antwort < 4h)',
  'PStTG-Jahresbericht als PDF-Download',
];

type TableRow = {
  label: string;
  free: string;
  pro: string;
};

const TABLE_ROWS: TableRow[] = [
  { label: 'Angebote/Monat', free: '10', pro: 'Unbegrenzt' },
  { label: 'Suchplatzierung', free: 'Standard', pro: 'Priorität' },
  { label: 'Statistiken', free: 'Basis', pro: 'Vollständig' },
  { label: 'Support', free: 'E-Mail', pro: 'Priorität' },
  { label: 'PStTG-Bericht', free: '—', pro: '✓' },
];

type FaqItem = {
  q: string;
  a: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Wann wird abgerechnet?',
    a: 'Am 1. des Monats, erstmalig heute bei Aktivierung.',
  },
  {
    q: 'Kann ich jederzeit kündigen?',
    a: 'Ja, monatlich zum Monatsende. Sie zahlen nie mehr als einen Monat im Voraus.',
  },
  {
    q: 'Gibt es eine Probezeit?',
    a: 'Die ersten 14 Tage sind kostenlos. Danach €29/Monat.',
  },
];

<<<<<<< HEAD
const ROI_OPTIONS = [
  { label: '5–10 / Monat', avgOrders: 7, avgOrderValue: 180 },
  { label: '10–20 / Monat', avgOrders: 15, avgOrderValue: 180 },
  { label: '20–40 / Monat', avgOrders: 30, avgOrderValue: 180 },
  { label: '40+ / Monat', avgOrders: 50, avgOrderValue: 180 },
];
const PRO_PRICE = 29;
const FREE_OFFER_LIMIT = 10;

export default function ProScreen() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [roiIdx, setRoiIdx] = useState(1);

  function handleSubscribe() {
    showAlert(
      'Pro aktivieren',
      'Pro startet mit dem offiziellen Launch. Alle Beta-Tester erhalten einen kostenlosen Pro-Monat als Dankeschön. Sie werden per E-Mail benachrichtigt.',
      [{ text: 'OK' }],
    );
  }

=======
type ProStatus = 'loading' | 'inactive' | 'active' | 'trialing' | 'cancel_scheduled';

export default function ProScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ProStatus>('loading');
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    loadProState().then((s) => {
      setStatus(s.status);
      setPeriodEnd(s.periodEnd);
      setTrialUsed(s.trialUsed);
    });
  }, []);

  function nextMonthEnd(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0); // last day of current month + 1 month = last day of next month
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function handleSubscribe() {
    setWorking(true);

    // Beta: activate locally. When Stripe Billing is live, replace with:
    // POST /api/pro/subscribe → Stripe creates subscription → webhook sets status
    const end = nextMonthEnd();
    const next = await saveProState({
      status: trialUsed ? 'active' : 'trialing',
      periodEnd: end,
      activatedAt: new Date().toISOString(),
      trialUsed: true,
    });
    setStatus(next.status);
    setPeriodEnd(end);
    setTrialUsed(true);
    setWorking(false);
    toast.success(trialUsed ? `Pro aktiv bis ${end}` : `30 Tage kostenlos bis ${end}`);
  }

  async function handleCancel() {
    Alert.alert(
      'Pro kündigen?',
      'Dein Pro-Zugang bleibt bis Monatsende aktiv. Danach wird er automatisch beendet (AGB §6 Abs. 3).',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Kündigen', style: 'destructive',
          onPress: async () => {
            setWorking(true);
            const next = await saveProState({ status: 'cancel_scheduled' });
            setStatus(next.status);
            setWorking(false);
            toast.warning(`Pro endet am ${periodEnd ?? 'Monatsende'}`);
          },
        },
      ],
    );
  }

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ padding: 20, gap: 12 }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = status === 'active' || status === 'trialing' || status === 'cancel_scheduled';

>>>>>>> main
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>WERKR Pro</Text>
            <Text style={styles.headerSub}>Für Anbieter</Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopBorder} />
          <View style={styles.heroInner}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="star" size={40} color={C.gold} />
            </View>
            <Text style={styles.heroTitle}>WERKR Pro</Text>
            <Text style={styles.heroPrice}>€29 <Text style={styles.heroPriceSub}>/ Monat</Text></Text>
            <Text style={styles.heroCancellation}>
              Monatlich kündbar · keine Mindestlaufzeit
            </Text>
          </View>
        </View>

<<<<<<< HEAD
        {/* ── ROI Calculator ── */}
        <Text style={styles.sectionTitle}>Lohnt sich Pro für dich?</Text>
        <View style={styles.roiCard}>
          <Text style={styles.roiQuestion}>Wie viele Aufträge machst du pro Monat?</Text>
          <View style={styles.roiChips}>
            {ROI_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.roiChip, roiIdx === i && styles.roiChipActive]}
                onPress={() => setRoiIdx(i)}
              >
                <Text style={[styles.roiChipText, roiIdx === i && styles.roiChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
=======
        {/* Status Banner (wenn aktiv) */}
        {isActive && (
          <View style={[styles.statusBanner, status === 'cancel_scheduled' ? styles.statusAmber : styles.statusGreen]}>
            <Ionicons
              name={status === 'cancel_scheduled' ? 'warning-outline' : 'checkmark-circle'}
              size={18}
              color={status === 'cancel_scheduled' ? C.amber : C.green}
            />
            <Text style={[styles.statusText, { color: status === 'cancel_scheduled' ? C.amber : C.green }]}>
              {status === 'cancel_scheduled'
                ? `Pro läuft bis ${periodEnd ?? 'Monatsende'} — dann beendet`
                : status === 'trialing'
                  ? `Kostenlose Testphase aktiv bis ${periodEnd ?? 'Monatsende'}`
                  : 'Pro ist aktiv'}
            </Text>
>>>>>>> main
          </View>
          {(() => {
            const opt = ROI_OPTIONS[roiIdx];
            const freeRevenue = Math.min(opt.avgOrders, FREE_OFFER_LIMIT) * opt.avgOrderValue * 0.92;
            const proRevenue = opt.avgOrders * opt.avgOrderValue * 0.92 - PRO_PRICE;
            const extraPerMonth = proRevenue - freeRevenue;
            const breakEvenOrders = Math.ceil(PRO_PRICE / (opt.avgOrderValue * 0.92));
            return (
              <View style={styles.roiResult}>
                <View style={styles.roiRow}>
                  <View style={styles.roiCol}>
                    <Text style={styles.roiColLabel}>Kostenlos</Text>
                    <Text style={styles.roiColValue}>
                      €{Math.round(freeRevenue).toLocaleString('de-DE')}
                    </Text>
                    <Text style={styles.roiColSub}>/ Monat</Text>
                  </View>
                  <View style={styles.roiArrow}>
                    <Ionicons name="arrow-forward" size={18} color={C.gold} />
                  </View>
                  <View style={[styles.roiCol, styles.roiColPro]}>
                    <Text style={[styles.roiColLabel, { color: C.gold }]}>Pro</Text>
                    <Text style={[styles.roiColValue, { color: C.gold }]}>
                      €{Math.round(proRevenue).toLocaleString('de-DE')}
                    </Text>
                    <Text style={styles.roiColSub}>/ Monat</Text>
                  </View>
                </View>
                {extraPerMonth > 0 ? (
                  <View style={styles.roiGain}>
                    <Ionicons name="trending-up" size={15} color={C.green} />
                    <Text style={styles.roiGainText}>
                      +€{Math.round(extraPerMonth).toLocaleString('de-DE')} mehr — Pro amortisiert sich ab {breakEvenOrders} Aufträgen
                    </Text>
                  </View>
                ) : (
                  <View style={styles.roiGain}>
                    <Ionicons name="information-circle-outline" size={15} color={C.muted} />
                    <Text style={[styles.roiGainText, { color: C.muted }]}>
                      Angebotslimit nicht erreicht — Kostenlos reicht für dieses Volumen
                    </Text>
                  </View>
                )}
                <Text style={styles.roiDisclaimer}>
                  Rechnung: 8% Plattformgebühr abgezogen · Auftragsvolumen Ø €{opt.avgOrderValue} · Werblicher Richtwert
                </Text>
              </View>
            );
          })()}
        </View>

<<<<<<< HEAD
        {/* ── Features list ── */}
        <Text style={styles.sectionTitle}>Enthaltene Leistungen</Text>
        <View style={styles.featureCard}>
          {FEATURES.map((feature, i) => (
            <View
              key={feature}
              style={[
                styles.featureRow,
                i < FEATURES.length - 1 && styles.featureRowBorder,
              ]}
            >
              <View style={styles.checkIconWrap}>
                <Ionicons name="checkmark-circle" size={20} color={C.green} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
=======
        {/* Pricing Card */}
        {!isActive && (
          <View style={styles.pricingCard}>
            <View style={styles.pricingRow}>
              <Text style={styles.price}>€29</Text>
              <Text style={styles.pricePer}>/Monat</Text>
            </View>
            <Text style={styles.pricingNote}>
              Jederzeit kündbar — 1 Monat zum Monatsende (AGB §6 Abs. 3)
            </Text>
            <AnimatedButton
              style={[styles.ctaBtn, working && styles.ctaBtnDisabled]}
              onPress={handleSubscribe}
              disabled={working}
            >
              {working
                ? <ActivityIndicator color={C.surface} size="small" />
                : <>
                  <Ionicons name="star" size={18} color={C.surface} />
                  <Text style={styles.ctaBtnText}>Pro aktivieren</Text>
                </>
              }
            </AnimatedButton>
          </View>
        )}

        {/* Features List */}
        <Text style={styles.sectionTitle}>Was du bekommst</Text>

        {PRO_FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={20} color={C.gold} />
>>>>>>> main
            </View>
          ))}
        </View>

        {/* ── Comparison table ── */}
        <Text style={styles.sectionTitle}>Vergleich</Text>
        <View style={styles.tableCard}>
          {/* Table header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableLabelHeader]}>Funktion</Text>
            <Text style={[styles.tableCell, styles.tableColHeader, styles.tableColFree]}>Kostenlos</Text>
            <Text style={[styles.tableCell, styles.tableColHeader, styles.tableColPro]}>Pro</Text>
          </View>
          {/* Table rows */}
          {TABLE_ROWS.map((row, i) => (
            <View
              key={row.label}
              style={[
                styles.tableRow,
                i % 2 === 1 && styles.tableRowAlt,
              ]}
            >
              <Text style={[styles.tableCell, styles.tableLabelCell]}>{row.label}</Text>
              <Text style={[styles.tableCell, styles.tableFreeCell]}>{row.free}</Text>
              <Text style={[styles.tableCell, styles.tableProCell]}>{row.pro}</Text>
            </View>
          ))}
        </View>

<<<<<<< HEAD
        {/* ── Testimonial ── */}
        <View style={styles.testimonialCard}>
          <Ionicons name="chatbubble-ellipses" size={22} color={C.muted} style={styles.testimonialIcon} />
          <Text style={styles.testimonialQuote}>
            "Seit Pro habe ich 40% mehr Anfragen."
          </Text>
          <View style={styles.testimonialMeta}>
            <Text style={styles.testimonialAuthor}>Michael S., Elektro Köln</Text>
            <View style={styles.testimonialRating}>
              <Ionicons name="star" size={13} color={C.gold} />
              <Text style={styles.testimonialRatingText}>4.9</Text>
            </View>
          </View>
        </View>

        {/* ── FAQ ── */}
        <Text style={styles.sectionTitle}>Häufige Fragen</Text>
        <View style={styles.faqCard}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openFaq === item.q;
            return (
              <View
                key={item.q}
                style={[
                  styles.faqItem,
                  i < FAQ_ITEMS.length - 1 && styles.faqItemBorder,
                ]}
              >
                <TouchableOpacity
                  style={styles.faqTrigger}
                  onPress={() => setOpenFaq(isOpen ? null : item.q)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={16}
                    color={C.muted}
                  />
                </TouchableOpacity>
                {isOpen && (
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Bottom CTA ── */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleSubscribe}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>14 Tage kostenlos testen</Text>
          </TouchableOpacity>
          <Text style={styles.ctaNote}>
            Bereits Pro? Verwaltung unter{' '}
            <Text style={styles.ctaNoteLink}>stripe.com/billing</Text>
          </Text>
        </View>
=======
        {/* Cancel CTA (wenn aktiv und nicht schon gekündigt) */}
        {(status === 'active' || status === 'trialing') && (
          <AnimatedButton
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={working}
          >
            <Text style={styles.cancelBtnText}>
              {status === 'trialing' ? 'Testphase beenden' : 'Pro kündigen'}
            </Text>
          </AnimatedButton>
        )}
>>>>>>> main

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: C.bg },
  scrollContent:       { paddingBottom: 48 },

  // Header
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn:             { padding: 4 },
  headerCenter:        { alignItems: 'center' },
  headerTitle:         { fontSize: 17, fontWeight: '700', color: C.gold },
  headerSub:           { fontSize: 11, color: C.muted, marginTop: 1 },

  // Hero card
  heroCard:            { marginHorizontal: 16, marginTop: 12, marginBottom: 24, backgroundColor: C.goldBg, borderRadius: 16, borderWidth: 1, borderColor: C.gold, overflow: 'hidden' },
  heroTopBorder:       { height: 3, backgroundColor: C.gold },
  heroInner:           { alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28 },
  heroIconWrap:        { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle:           { fontSize: 26, fontWeight: '900', color: C.ink, marginBottom: 8, letterSpacing: -0.5 },
  heroPrice:           { fontSize: 36, fontWeight: '900', color: C.gold, marginBottom: 6 },
  heroPriceSub:        { fontSize: 18, fontWeight: '500', color: C.sub },
  heroCancellation:    { fontSize: 12, color: C.sub, textAlign: 'center' },

  // Section title
  sectionTitle:        { ...T.btnSm, color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 10 },

  // Features list
  featureCard:         { marginHorizontal: 16, marginBottom: 24, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  featureRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  featureRowBorder:    { borderBottomWidth: 1, borderBottomColor: C.border },
  checkIconWrap:       { width: 24, alignItems: 'center' },
  featureText:         { flex: 1, fontSize: 14, fontWeight: '500', color: C.ink, lineHeight: 20 },

  // Comparison table
  tableCard:           { marginHorizontal: 16, marginBottom: 24, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tableRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14 },
  tableRowAlt:         { backgroundColor: C.bg },
  tableHeader:         { backgroundColor: C.ink, paddingVertical: 12 },
  tableCell:           { flex: 1, ...T.sm },
  tableLabelHeader:    { fontWeight: '700', color: C.surface },
  tableColHeader:      { fontWeight: '700', textAlign: 'center' },
  tableColFree:        { color: C.muted },
  tableColPro:         { color: C.gold },
  tableLabelCell:      { color: C.sub, fontWeight: '500' },
  tableFreeCell:       { color: C.muted, textAlign: 'center' },
  tableProCell:        { color: C.green, fontWeight: '700', textAlign: 'center' },

  // Testimonial
  testimonialCard:     { marginHorizontal: 16, marginBottom: 24, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 20 },
  testimonialIcon:     { marginBottom: 10 },
  testimonialQuote:    { fontSize: 16, fontWeight: '700', color: C.ink, lineHeight: 24, marginBottom: 12, fontStyle: 'italic' },
  testimonialMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testimonialAuthor:   { fontSize: 13, color: C.sub, fontWeight: '600' },
  testimonialRating:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  testimonialRatingText: { fontSize: 13, fontWeight: '700', color: C.gold },

  // FAQ
  faqCard:             { marginHorizontal: 16, marginBottom: 28, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  faqItem:             {},
  faqItemBorder:       { borderBottomWidth: 1, borderBottomColor: C.border },
  faqTrigger:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, gap: 12 },
  faqQuestion:         { flex: 1, fontSize: 14, fontWeight: '600', color: C.ink },
  faqAnswer:           { fontSize: 13, color: C.sub, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 14 },

  // ROI calculator
  roiCard:             { marginHorizontal: 16, marginBottom: 24, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, overflow: 'hidden' },
  roiQuestion:         { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 12 },
  roiChips:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  roiChip:             { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.bg },
  roiChipActive:       { borderColor: C.gold, backgroundColor: C.goldBg },
  roiChipText:         { fontSize: 12, fontWeight: '500', color: C.sub },
  roiChipTextActive:   { color: C.gold, fontWeight: '700' },
  roiResult:           { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  roiRow:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  roiCol:              { flex: 1, alignItems: 'center' },
  roiColPro:           { borderWidth: 1, borderColor: C.gold, borderRadius: 10, padding: 8, backgroundColor: C.goldBg },
  roiColLabel:         { ...T.label, color: C.muted, marginBottom: 4 },
  roiColValue:         { fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: -0.5 },
  roiColSub:           { fontSize: 11, color: C.muted, marginTop: 2 },
  roiArrow:            { paddingHorizontal: 8 },
  roiGain:             { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenBg, borderRadius: 8, padding: 10, marginBottom: 10 },
  roiGainText:         { flex: 1, fontSize: 12, fontWeight: '600', color: C.green, lineHeight: 17 },
  roiDisclaimer:       { fontSize: 10, color: C.muted, lineHeight: 14, fontStyle: 'italic' },

  // CTA section
  ctaSection:          { paddingHorizontal: 16, alignItems: 'center' },
  ctaBtn:              { width: '100%', backgroundColor: C.ink, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ctaBtnText:          { fontSize: 16, fontWeight: '800', color: C.surface },
  ctaNote:             { fontSize: 12, color: C.muted, textAlign: 'center' },
  ctaNoteLink:         { color: C.sub, textDecorationLine: 'underline' },
});
