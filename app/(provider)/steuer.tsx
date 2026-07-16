import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const CURRENT_YEAR = new Date().getFullYear();
const TRANSACTIONS_LIMIT = 30;
const REVENUE_LIMIT = 2000;

type TxRow = {
  id: string;
  completedAt: string;
  jobTitle: string;
  customerName: string;
  priceGross: number;
  providerCommission: number;
};

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  const isNear = pct >= 0.75;
  return (
    <View style={styles.progressTrack}>
      <View
        style={[styles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: isNear ? C.amber : C.primary }]}
      />
    </View>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.sectionHeadingIcon}>
        <Ionicons name={icon as any} size={16} color={C.sub} />
      </View>
      <View>
        <Text style={styles.sectionHeadingTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionHeadingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export default function ProviderSteuerScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };
    // Safety: der Ladezustand darf nie ewig haengen (z. B. Netz-Stall).
    const timer = setTimeout(() => {
      if (!done) { toast.error('Steuerdaten konnten nicht geladen werden — bitte erneut öffnen'); finish(); }
    }, 8000);
    const yearStart = `${CURRENT_YEAR}-01-01T00:00:00.000Z`;
    const yearEnd = `${CURRENT_YEAR + 1}-01-01T00:00:00.000Z`;

    supabase
      .from('contracts')
      .select('id, completed_at, price_gross, provider_commission, job:jobs!job_id(title), customer:profiles!customer_id(full_name)')
      .eq('provider_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', yearStart)
      .lt('completed_at', yearEnd)
      .order('completed_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Daten konnten nicht geladen werden');
          finish();
          return;
        }
        const rows: TxRow[] = (data ?? []).map((c: any) => ({
          id: c.id,
          completedAt: c.completed_at,
          jobTitle: c.job?.title ?? 'Auftrag',
          customerName: c.customer?.full_name?.split(' ')[0] ?? 'Kunde',
          priceGross: c.price_gross ?? 0,
          providerCommission: c.provider_commission ?? 0,
        }));
        setTransactions(rows);
        finish();
      }, (err: unknown) => {
        // Rejected promise (Netzwerkfehler) — sonst dreht der Spinner ewig.
        toast.error('Steuerdaten konnten nicht geladen werden');
        finish();
      });
    return () => clearTimeout(timer);
  }, [user]);

  const txCount = transactions.length;
  const grossIncome = transactions.reduce((sum, t) => sum + t.priceGross, 0);
  const totalCommission = transactions.reduce((sum, t) => sum + t.providerCommission, 0);
  const netIncome = grossIncome - totalCommission;

  const revenueEuros = grossIncome;

  const txPct = txCount / TRANSACTIONS_LIMIT;
  const revPct = revenueEuros / REVENUE_LIMIT;
  const isOverThreshold = txCount >= TRANSACTIONS_LIMIT || revenueEuros >= REVENUE_LIMIT;

  const tips = [
    {
      icon: 'storefront-outline',
      title: 'Kleinunternehmerregelung (§19 UStG)',
      body: 'Als Kleinunternehmer können Sie von der Umsatzsteuer befreit sein, wenn Ihr Jahresumsatz unter €22.000 (Vorjahr) bzw. €50.000 (laufendes Jahr) liegt. In diesem Fall stellen Sie Rechnungen ohne Umsatzsteuer aus.',
    },
    {
      icon: 'construct-outline',
      title: 'Betriebsausgaben absetzen',
      body: 'Werkzeug, Berufskleidung, Fahrtkosten (0,30 € pro km), Telefon- & Internetkosten (anteilig) sowie Fortbildungen sind als Betriebsausgaben steuermindernd absetzbar. Bewahren Sie alle Belege auf.',
    },
    {
      icon: 'car-outline',
      title: 'Fahrtkosten',
      body: 'Fahrten zu Kunden können mit der Entfernungspauschale (0,30 €/km einfach) oder mit einem Fahrtenbuch geltend gemacht werden. Werkant speichert Ihre Auftragsorte für eine einfache Dokumentation.',
    },
  ];

  function formatEuro(euros: number): string {
    return `€${euros.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Steuer & DAC7</Text>
            <Text style={styles.subtitle}>Geschäftsjahr {CURRENT_YEAR}</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.ink} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Steuer & DAC7</Text>
          <Text style={styles.subtitle}>Geschäftsjahr {CURRENT_YEAR}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={C.primary} />
          <Text style={styles.headerBadgeText}>Werkant meldet für Sie</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* PStTG / DAC7 Status */}
        <View style={[styles.card, isOverThreshold ? styles.cardGreen : styles.cardAmber]}>
          <View style={styles.pstTgHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pstTgLabel}>DAC7 · Plattformen-Steuertransparenzgesetz</Text>
              <Text style={styles.pstTgTitle}>Meldestatus {CURRENT_YEAR}</Text>
            </View>
            <Badge
              label={isOverThreshold ? 'Meldepflichtig' : 'Nähert sich Schwellwert'}
              variant={isOverThreshold ? 'red' : 'amber'}
            />
          </View>

          <Divider margin={14} />

          <View style={styles.thresholdRow}>
            <View style={styles.thresholdLabelRow}>
              <Text style={styles.thresholdLabel}>Transaktionen</Text>
              <Text style={[styles.thresholdValue, txPct >= 0.75 ? styles.valueAmber : styles.valueGreen]}>
                {txCount} / {TRANSACTIONS_LIMIT}
              </Text>
            </View>
            <ProgressBar value={txCount} max={TRANSACTIONS_LIMIT} />
            <Text style={styles.thresholdNote}>
              Noch {Math.max(0, TRANSACTIONS_LIMIT - txCount)} Transaktionen bis zur Meldepflicht
            </Text>
          </View>

          <View style={[styles.thresholdRow, { marginTop: 14 }]}>
            <View style={styles.thresholdLabelRow}>
              <Text style={styles.thresholdLabel}>Jahresumsatz</Text>
              <Text style={[styles.thresholdValue, revPct >= 0.75 ? styles.valueAmber : styles.valueGreen]}>
                {formatEuro(grossIncome)} / €{REVENUE_LIMIT.toLocaleString('de-DE')}
              </Text>
            </View>
            <ProgressBar value={revenueEuros} max={REVENUE_LIMIT} />
            <Text style={styles.thresholdNote}>
              Noch €{Math.max(0, REVENUE_LIMIT - revenueEuros).toLocaleString('de-DE')} bis zur Meldepflicht
            </Text>
          </View>

          <Divider margin={14} />

          <View style={styles.meldungBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.amber} />
            <Text style={styles.meldungText}>
              Ab 30 Transaktionen <Text style={{ fontWeight: '700' }}>ODER</Text> €2.000 Umsatz:{' '}
              meldepflichtig nach PStTG, Frist <Text style={{ fontWeight: '700' }}>31. Jan {CURRENT_YEAR + 1}</Text>
            </Text>
          </View>
        </View>

        {/* Steuer-Jahresreport */}
        <View style={styles.card}>
          <SectionHeading
            icon="document-text-outline"
            title="Steuer-Jahresreport"
            subtitle={`Automatisch generiert für ${CURRENT_YEAR}`}
          />

          <Divider margin={14} />

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Einnahmen (brutto)</Text>
            <Text style={styles.breakdownValue}>{formatEuro(grossIncome)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelRow}>
              <Text style={styles.breakdownLabel}>Plattform-Provision</Text>
            </View>
            <Text style={[styles.breakdownValue, { color: C.red }]}>−{formatEuro(totalCommission)}</Text>
          </View>

          <View style={styles.breakdownDivider} />

          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { fontWeight: '700', color: C.ink, fontSize: 14 }]}>
              Netto-Einnahmen
            </Text>
            <Text style={[styles.breakdownValue, { color: C.primary, fontWeight: '700', fontSize: 18 }]}>
              {formatEuro(netIncome)}
            </Text>
          </View>

          <Divider margin={14} />

          <Text style={styles.reportNote}>
            Dieser Bericht enthält alle steuerrelevanten Daten für Ihre Einkommensteuererklärung.
          </Text>

          <AnimatedButton style={styles.downloadBtn} onPress={() => toast.info(`Jahresbericht ${CURRENT_YEAR} ist ab 01. Jan ${CURRENT_YEAR + 1} verfügbar`)}>
            <Ionicons name="download-outline" size={16} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.downloadBtnText}>PDF-Report herunterladen</Text>
              <Text style={styles.downloadBtnSubtext}>Verfügbar ab 01. Jan {CURRENT_YEAR + 1}</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
          </AnimatedButton>
        </View>

        {/* Transaktionsverlauf */}
        <View style={styles.card}>
          <SectionHeading
            icon="receipt-outline"
            title="Transaktionsverlauf"
            subtitle={`${txCount} Transaktionen ${CURRENT_YEAR}`}
          />

          <Divider margin={14} />

          {transactions.length === 0 ? (
            <Text style={styles.emptyTx}>Noch keine abgeschlossenen Aufträge in {CURRENT_YEAR}</Text>
          ) : (
            transactions.slice(0, 5).map((tx, i) => (
              <View key={tx.id}>
                <View style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txDate}>{formatDate(tx.completedAt)}</Text>
                    <Text style={styles.txCustomer}>{tx.customerName}</Text>
                    <Text style={styles.txService}>{tx.jobTitle}</Text>
                    <Text style={styles.txId}>WRK-{tx.id.slice(-8).toUpperCase()}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txGross}>{formatEuro(tx.priceGross)}</Text>
                    <Text style={styles.txFee}>−{formatEuro(tx.providerCommission)} Provision</Text>
                    <Text style={styles.txNet}>{formatEuro(tx.priceGross - tx.providerCommission)} netto</Text>
                  </View>
                </View>
                {i < Math.min(transactions.length, 5) - 1 && <Divider margin={10} />}
              </View>
            ))
          )}

          {transactions.length > 5 && (
            <TouchableOpacity style={styles.allTxBtn} activeOpacity={0.75}>
              <Text style={styles.allTxBtnText}>Alle {transactions.length} Transaktionen anzeigen</Text>
              <Ionicons name="chevron-forward-outline" size={14} color={C.sub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Steuer-Tipps */}
        <View style={styles.card}>
          <SectionHeading
            icon="bulb-outline"
            title="Steuer-Tipps"
            subtitle="Für Selbstständige & Dienstleister"
          />

          <Divider margin={14} />

          {tips.map((tip, i) => (
            <TouchableOpacity
              key={i}
              style={styles.tipRow}
              onPress={() => setExpandedTip(expandedTip === i ? null : i)}
              activeOpacity={0.75}
            >
              <View style={styles.tipHeader}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name={tip.icon as any} size={16} color={C.sub} />
                </View>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Ionicons
                  name={expandedTip === i ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={14}
                  color={C.muted}
                />
              </View>
              {expandedTip === i && <Text style={styles.tipBody}>{tip.body}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Werkant Value Proposition */}
        <View style={styles.valueBox}>
          <View style={styles.valueBoxHeader}>
            <View style={styles.valueBoxIconBg}>
              <Ionicons name="shield-checkmark" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.valueBoxTitle}>Werkant trackt Ihre PStTG-Meldepflicht automatisch</Text>
            </View>
          </View>
          <Text style={styles.valueBoxBody}>
            Transaktionen und Umsatz werden laufend erfasst, damit Sie die Meldeschwelle immer im Blick haben. Die Übermittlung an das Bundeszentralamt für Steuern (BZSt) erfolgt gemäß PStTG bis zum gesetzlichen Stichtag.
          </Text>
          <View style={styles.valueBoxFeatures}>
            {[
              'Automatische Schwellenwert-Verfolgung',
              `Meldefrist im Blick: 31. Jan ${CURRENT_YEAR + 1}`,
              'Vollständige Transaktionshistorie',
            ].map((feature, i) => (
              <View key={i} style={styles.valueBoxFeatureRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.primary} />
                <Text style={styles.valueBoxFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: C.bg },
  header:                 { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  title:                  { fontSize: 24, fontWeight: '700', color: C.ink },
  subtitle:               { fontSize: 12, color: C.muted, marginTop: 2 },
  headerBadge:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  headerBadgeText:        { fontSize: 11, fontWeight: '600', color: C.primary },
  scrollContent:          { paddingHorizontal: 16, paddingBottom: 20 },
  card:                   { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 14 },
  cardAmber:              { borderColor: C.goldBd },
  cardGreen:              { borderColor: C.primaryBd },
  pstTgHeader:            { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pstTgLabel:             { fontSize: 10, fontWeight: '600', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  pstTgTitle:             { fontSize: 16, fontWeight: '700', color: C.ink },
  thresholdRow:           {},
  thresholdLabelRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  thresholdLabel:         { fontSize: 12, color: C.sub, fontWeight: '600' },
  thresholdValue:         { fontSize: 13, fontWeight: '700' },
  valueAmber:             { color: C.amber },
  valueGreen:             { color: C.primary },
  thresholdNote:          { fontSize: 10, color: C.muted, marginTop: 4 },
  progressTrack:          { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:           { height: 6, borderRadius: 3 },
  meldungBox:             { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderRadius: 8, padding: 12 },
  meldungText:            { flex: 1, fontSize: 12, color: C.amber, lineHeight: 18 },
  sectionHeadingRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeadingIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  sectionHeadingTitle:    { fontSize: 15, fontWeight: '700', color: C.ink },
  sectionHeadingSubtitle: { fontSize: 11, color: C.muted, marginTop: 1 },
  breakdownRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabelRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel:         { fontSize: 13, color: C.sub },
  breakdownValue:         { fontSize: 14, fontWeight: '700', color: C.ink },
  breakdownDivider:       { height: 1, backgroundColor: C.border, marginVertical: 10 },
  reportNote:             { fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 14 },
  downloadBtn:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderStyle: 'dashed' },
  downloadBtnText:        { fontSize: 13, fontWeight: '600', color: C.muted },
  downloadBtnSubtext:     { fontSize: 11, color: C.muted, marginTop: 2 },
  emptyTx:                { fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 12 },
  txRow:                  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  txLeft:                 { flex: 1 },
  txDate:                 { fontSize: 10, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  txCustomer:             { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 1 },
  txService:              { fontSize: 12, color: C.sub, marginBottom: 3 },
  txId:                   { fontSize: 10, color: C.muted, fontFamily: 'monospace' },
  txRight:                { alignItems: 'flex-end' },
  txGross:                { fontSize: 15, fontWeight: '700', color: C.ink },
  txFee:                  { fontSize: 11, color: C.red, marginTop: 2 },
  txNet:                  { fontSize: 12, fontWeight: '700', color: C.primary, marginTop: 2 },
  allTxBtn:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, marginTop: 6 },
  allTxBtnText:           { fontSize: 13, color: C.sub, fontWeight: '600' },
  tipRow:                 { marginBottom: 4 },
  tipHeader:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  tipIconWrap:            { width: 30, height: 30, borderRadius: 7, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  tipTitle:               { flex: 1, fontSize: 13, fontWeight: '600', color: C.ink },
  tipBody:                { fontSize: 12, color: C.sub, lineHeight: 19, paddingLeft: 40, paddingBottom: 8 },
  valueBox:               { backgroundColor: C.primaryBg, borderRadius: 14, borderWidth: 1, borderColor: C.primaryBd, padding: 18, marginBottom: 4 },
  valueBoxHeader:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  valueBoxIconBg:         { width: 42, height: 42, borderRadius: 11, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primaryBd },
  valueBoxTitle:          { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20 },
  valueBoxBody:           { fontSize: 12, color: C.sub, lineHeight: 19, marginBottom: 14 },
  valueBoxFeatures:       { gap: 8 },
  valueBoxFeatureRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueBoxFeatureText:    { fontSize: 12, color: C.primary, fontWeight: '500' },
});
