import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { shadow } from '../constants/theme';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { joinWaitlist } from '../lib/waitlist';

const FEATURES = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Geprüfte Profis',
    desc: 'Jeder Anbieter wird mit Gewerbeschein, Ausweis und Steuer-ID verifiziert. Sie buchen ausschließlich geprüfte Fachkräfte.',
  },
  {
    icon: 'lock-closed-outline' as const,
    title: 'Escrow-Zahlung',
    desc: 'Ihr Geld bleibt bis zur Fertigstellung eingefroren. Erst nach Ihrer Freigabe erhält der Handwerker die Zahlung via Stripe.',
  },
  {
    icon: 'star-outline' as const,
    title: 'Bewertungssystem',
    desc: 'Transparente 5-Sterne-Bewertungen nach jedem Auftrag. Strike-System bei Regelverstößen — Qualität wird belohnt.',
  },
];

const HOW_STEPS = [
  { num: '1', icon: 'search-outline' as const, title: 'Handwerker finden',      desc: 'Suchen Sie nach Kategorie, Entfernung und Verfügbarkeit.' },
  { num: '2', icon: 'chatbubble-outline' as const, title: 'Anfrage stellen',    desc: 'Schreiben Sie direkt in der App — kostenlos und unverbindlich.' },
  { num: '3', icon: 'document-text-outline' as const, title: 'Vertrag digital', desc: 'Festpreis, Termin, Escrow — alles in einem digitalen Vertrag.' },
  { num: '4', icon: 'checkmark-circle-outline' as const, title: 'Job abschließen', desc: 'Freigabe nach Ihrer Zufriedenheit. Zahlung wird automatisch ausgezahlt.' },
];

const TRUST_BADGES = [
  { icon: 'shield-outline' as const,       label: 'PStTG-konform'     },
  { icon: 'card-outline' as const,         label: 'Stripe Escrow'     },
  { icon: 'person-outline' as const,       label: '18+ Verifiziert'   },
  { icon: 'lock-closed-outline' as const,       label: 'DSGVO-konform'    },
];

function WaitlistSection() {
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && city.trim().length >= 2;

  async function handleJoin() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await joinWaitlist({ email, city, source: 'landing' });
      setDone(true);
    } catch {
      // Silent — waitlist signup is a non-critical nice-to-have, not worth an error dialog.
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionInner}>
          <View style={[styles.waitlistCard, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="checkmark-circle" size={28} color={C.primary} />
            <Text style={styles.waitlistDoneText}>
              Danke! Wir melden uns, sobald WERKR in Ihrer Stadt startet.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionInner}>
        <Text style={styles.sectionLabel}>NOCH NICHT IN IHRER STADT?</Text>
        <Text style={styles.sectionTitle}>Auf die Warteliste</Text>
        <Text style={styles.sectionSub}>
          WERKR startet operativ in Köln und wird nach und nach auf weitere Städte wie
          Düsseldorf ausgeweitet. Tragen Sie sich ein — wir informieren Sie, sobald es bei
          Ihnen losgeht.
        </Text>
        <View style={styles.waitlistCard}>
          <TextInput
            style={styles.waitlistInput}
            placeholder="E-Mail-Adresse"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.waitlistInput}
            placeholder="Stadt, z.B. Düsseldorf"
            placeholderTextColor={C.muted}
            value={city}
            onChangeText={setCity}
          />
          <TouchableOpacity
            style={[styles.waitlistBtn, !valid && styles.waitlistBtnDisabled]}
            onPress={handleJoin}
            disabled={!valid || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator size="small" color={C.surface} />
              : <Text style={styles.waitlistBtnText}>Eintragen</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  // Width-based, NOT Platform-based: mobile Safari is Platform 'web' too —
  // branching on Platform gave phones the desktop layout (side-by-side CTAs
  // overflowing the screen, 72px title).
  const isWide = useWindowDimensions().width >= 768;

  return (
    // edges top: without it the nav bar renders underneath the iOS status
    // bar / notch (logo and CTA overlapped by the clock on real devices).
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView
      style={styles.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {/* ── Nav Bar ── */}
      <View style={styles.nav}>
        <View style={styles.navContent}>
          <View style={styles.navBrand}>
            <View style={styles.navLogo}>
              <Ionicons name="hammer" size={18} color={C.gold} />
            </View>
            <Text style={styles.navTitle}>WERKR</Text>
          </View>
          <View style={styles.navActions}>
            <TouchableOpacity
              style={styles.navLoginBtn}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.8}
            >
              <Text style={styles.navLoginText}>Einloggen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navStartBtn}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.85}
            >
              <Text style={styles.navStartText}>Jetzt starten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Hero ── */}
      <View style={[styles.hero, isWide && wide.hero]}>
        <View style={[styles.heroContent, isWide && wide.heroContent]}>
          {/* Minimal left-aligned availability label */}
          <Text style={styles.heroLabel}>Start in Köln — bald bundesweit</Text>
          <Text style={[styles.heroTitle, isWide && wide.heroTitle]}>WERKR</Text>
          <Text style={[styles.heroTagline, isWide && wide.heroTagline]}>
            Handwerker & Nachbarschaftshilfe —{'\n'}einfach, sicher, fair
          </Text>
          <Text style={[styles.heroSub, isWide && wide.heroSub]}>
            Für alles, wofür kein Handwerker mehr rausfährt: Kleinaufträge, Reparaturen,
            Alltagshilfe. Geprüfte Profis und Nachbarschaftshelfer in Ihrer Nähe — Zahlung
            über Escrow gesichert, nur 8% Plattformgebühr, keine versteckten Kosten.
          </Text>
          <View style={[styles.heroCtas, isWide && wide.heroCtas]}>
            <AnimatedButton
              style={styles.ctaPrimary}
              onPress={() => router.push('/onboarding')}
            >
              <Ionicons name="search-outline" size={18} color={C.surface} />
              <Text style={styles.ctaPrimaryText}>Jetzt Handwerker finden</Text>
            </AnimatedButton>
            <AnimatedButton
              style={styles.ctaSecondary}
              onPress={() => router.push('/onboarding')}
            >
              <Ionicons name="construct-outline" size={18} color={C.ink} />
              <Text style={styles.ctaSecondaryText}>Als Anbieter registrieren</Text>
            </AnimatedButton>
          </View>
          {/* Beta / UG i.G. disclaimer */}
          <View style={styles.betaDisclaimer}>
            <Ionicons name="flask-outline" size={14} color={C.amber} />
            <Text style={styles.betaDisclaimerText}>
              Geschlossener Testbetrieb (Beta) — Nutzung auf eigene Gefahr. WERKR ist reiner Vermittler. Vertrag entsteht ausschließlich zwischen den Parteien. Alle Zahlungen laufen im Stripe-Testmodus.
            </Text>
          </View>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <View style={styles.socialAvatarRow}>
              {['M', 'Y', 'S', 'T'].map((letter, i) => (
                <View key={i} style={[styles.socialAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }]}>
                  <Text style={styles.socialAvatarText}>{letter}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.socialProofText}>
              <Text style={styles.socialProofBold}>400+ Handwerker</Text> bereits registriert
            </Text>
          </View>
        </View>
      </View>

      {/* ── Trust Badges ── */}
      <View style={styles.trustStrip}>
        <View style={styles.trustStripInner}>
          {TRUST_BADGES.map((badge) => (
            <View key={badge.label} style={styles.trustBadge}>
              <Ionicons name={badge.icon} size={16} color={C.primary} />
              <Text style={styles.trustBadgeText}>{badge.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Features ── */}
      <View style={styles.section}>
        <View style={styles.sectionInner}>
          <Text style={styles.sectionLabel}>WARUM WERKR</Text>
          <Text style={styles.sectionTitle}>Gebaut für Vertrauen</Text>
          <Text style={styles.sectionSub}>
            Jede Funktion wurde entwickelt, um Auftraggeber und Handwerker fair zu schützen.
          </Text>

          {/* Vertical list with left border accent */}
          <View style={styles.featuresList}>
            {FEATURES.map((feat) => (
              <View key={feat.title} style={styles.featureItem}>
                <Ionicons name={feat.icon} size={20} color={C.primary} style={styles.featureItemIcon} />
                <View style={styles.featureItemBody}>
                  <Text style={styles.featureTitle}>{feat.title}</Text>
                  <Text style={styles.featureDesc}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── How It Works ── */}
      <View style={[styles.section, { backgroundColor: C.surface }]}>
        <View style={styles.sectionInner}>
          <Text style={styles.sectionLabel}>SO FUNKTIONIERT'S</Text>
          <Text style={styles.sectionTitle}>In 4 Schritten zum Job</Text>

          {/* Numbered list with dividers */}
          <View style={styles.stepsList}>
            {HOW_STEPS.map((step, i) => (
              <View key={step.num} style={[styles.stepRow, i < HOW_STEPS.length - 1 && styles.stepRowBorder]}>
                <Text style={styles.stepNum}>{step.num}</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Fee Transparency ── */}
      <View style={styles.section}>
        <View style={styles.sectionInner}>
          <Text style={styles.sectionLabel}>TRANSPARENTE KOSTEN</Text>
          <Text style={styles.sectionTitle}>Nur 8% — keine Überraschungen</Text>
          <View style={styles.feeCard}>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Job-Betrag</Text>
              <Text style={styles.feeValue}>€240,00</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>WERKR Gebühr (8%)</Text>
              <Text style={[styles.feeValue, { color: C.red }]}>−€19,20</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { fontWeight: '700', color: C.ink }]}>Auszahlung Anbieter</Text>
              <Text style={[styles.feeValue, { color: C.primary, fontSize: 18, fontWeight: '700' }]}>€220,80</Text>
            </View>
            <View style={styles.feeNote}>
              <Ionicons name="information-circle-outline" size={14} color={C.muted} />
              <Text style={styles.feeNoteText}>Kunden zahlen den vollen Betrag. Die Gebühr wird vom Anbieter-Auszahlungsbetrag abgezogen.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Provider CTA ── */}
      <View style={styles.providerCta}>
        <View style={styles.sectionInner}>
          <View style={styles.providerCtaIcon}>
            <Ionicons name="construct" size={32} color={C.gold} />
          </View>
          <Text style={styles.providerCtaTitle}>
            Geld verdienen als Anbieter
          </Text>
          <Text style={styles.providerCtaSub}>
            0€ Startgebühr, nur 8% pro Auftrag
          </Text>
          <Text style={styles.providerCtaDesc}>
            Registrieren Sie sich als Handwerker oder Nachbarschaftshelfer und erhalten Sie neue Aufträge direkt auf Ihr Handy.
            Profis mit Pro-Abo (€29/mo) erhalten Featured-Platzierung und Analytics.
          </Text>
          <View style={styles.providerCtaStats}>
            <View style={styles.providerStat}>
              <Text style={styles.providerStatValue}>€0</Text>
              <Text style={styles.providerStatLabel}>Startgebühr</Text>
            </View>
            <View style={styles.providerStatDivider} />
            <View style={styles.providerStat}>
              <Text style={styles.providerStatValue}>8%</Text>
              <Text style={styles.providerStatLabel}>Pro Auftrag</Text>
            </View>
            <View style={styles.providerStatDivider} />
            <View style={styles.providerStat}>
              <Text style={styles.providerStatValue}>24h</Text>
              <Text style={styles.providerStatLabel}>Verifizierung</Text>
            </View>
          </View>
          <AnimatedButton
            style={styles.providerCtaBtn}
            onPress={() => router.push('/onboarding')}
          >
            <Ionicons name="arrow-forward" size={18} color={C.surface} />
            <Text style={styles.providerCtaBtnText}>Jetzt als Anbieter registrieren</Text>
          </AnimatedButton>
        </View>
      </View>

      {/* ── Waitlist (nationwide, other cities) ── */}
      <WaitlistSection />

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <View style={styles.sectionInner}>
          <View style={styles.footerLogo}>
            <View style={styles.footerLogoIcon}>
              <Ionicons name="hammer" size={14} color={C.gold} />
            </View>
            <Text style={styles.footerLogoText}>WERKR</Text>
          </View>
          <Text style={styles.footerTagline}>
            Deutschlands vertrauenswürdigste Handwerker-Plattform
          </Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink} onPress={() => router.push('/agb')}>AGB</Text>
            <Text style={styles.footerSep}>·</Text>
            <Text style={styles.footerLink} onPress={() => router.push('/datenschutz')}>Datenschutz</Text>
            <Text style={styles.footerSep}>·</Text>
            <Text style={styles.footerLink} onPress={() => router.push('/impressum')}>Impressum</Text>
            <Text style={styles.footerSep}>·</Text>
            <Text style={styles.footerLink}>PStTG-Konformität</Text>
          </View>
          <Text style={styles.footerDisclaimer}>
            WERKR ist reiner Vermittler gemäß § 2 Abs. 1 Nr. 1 PStTG. Verträge entstehen ausschließlich zwischen Auftraggeber und Auftragnehmer. Kein Versicherungsschutz durch WERKR. Geschlossener Beta-Betrieb — Stripe Testmodus aktiv (WERKR UG i.G.).
          </Text>
          <Text style={styles.footerCopy}>© 2025 WERKR UG (i.G.) · Köln, Deutschland</Text>
        </View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const MAX_W = 1100;

const styles = StyleSheet.create({
  // safeArea uses the nav bar's surface color so the notch area blends
  // with the white nav instead of showing a beige stripe above it.
  safeArea:           { flex: 1, backgroundColor: C.surface },
  root:               { flex: 1, backgroundColor: C.bg },
  scroll:             { alignItems: 'center' },

  // Nav
  nav:                { width: '100%', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  navContent:         { maxWidth: MAX_W, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14, alignSelf: 'center' },
  navBrand:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navLogo:            { width: 34, height: 34, borderRadius: 9, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  navTitle:           { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: 1.5 },
  navActions:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLoginBtn:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  navLoginText:       { fontSize: 14, fontWeight: '600', color: C.ink },
  navStartBtn:        { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: C.primary },
  navStartText:       { fontSize: 14, fontWeight: '700', color: C.surface },

  // Hero — warm bone canvas, dark ink on light
  hero:               { width: '100%', backgroundColor: C.bg, paddingVertical: 48, paddingHorizontal: 24 },
  heroContent:        { maxWidth: 680, width: '100%', alignSelf: 'center', alignItems: 'flex-start' },
  // Minimal left-aligned label (replaces pill badge)
  heroLabel:          { ...T.label, color: C.primary, marginBottom: 20, alignSelf: 'flex-start' },
  heroTitle:          { fontSize: 48, fontWeight: '700', color: C.ink, letterSpacing: 2, marginBottom: 12 },
  heroTagline:        { ...T.h1, color: C.ink, lineHeight: 30, marginBottom: 18, textAlign: 'left' },
  heroSub:            { fontSize: 16, color: C.sub, lineHeight: 26, marginBottom: 36, maxWidth: 560, textAlign: 'left' },
  heroCtas:           { flexDirection: 'column', gap: 14, marginBottom: 36, width: '100%' },
  ctaPrimary:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  ctaPrimaryText:     { fontSize: 16, fontWeight: '700', color: C.surface },
  ctaSecondary:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16, borderWidth: 1.5, borderColor: C.border },
  ctaSecondaryText:   { fontSize: 16, fontWeight: '600', color: C.ink },
  socialProof:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  socialAvatarRow:    { flexDirection: 'row', alignItems: 'center' },
  socialAvatar:       { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface },
  socialAvatarText:   { fontSize: 12, fontWeight: '700', color: C.gold },
  socialProofText:    { fontSize: 13, color: C.sub },
  socialProofBold:    { fontWeight: '700', color: C.ink },

  // Trust strip
  trustStrip:         { width: '100%', backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 18, paddingHorizontal: 24 },
  trustStripInner:    { maxWidth: MAX_W, width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 24, alignSelf: 'center' },
  trustBadge:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustBadgeText:     { fontSize: 13, fontWeight: '600', color: C.ink },

  // Section
  section:            { width: '100%', paddingVertical: 48, paddingHorizontal: 24 },
  sectionInner:       { maxWidth: MAX_W, width: '100%', alignSelf: 'center' },
  sectionLabel:       { fontSize: 11, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 10, textAlign: 'left' },
  sectionTitle:       { fontSize: 26, fontWeight: '700', color: C.ink, marginBottom: 14, textAlign: 'left', lineHeight: 34 },
  sectionSub:         { fontSize: 16, color: C.sub, lineHeight: 26, textAlign: 'left', marginBottom: 48, maxWidth: 600, alignSelf: 'flex-start' },

  // Features — vertical list with left border accent
  featuresList:       { flexDirection: 'column', gap: 0 },
  featureItem:        { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20, paddingLeft: 16, borderLeftWidth: 3, borderLeftColor: C.primaryBd, marginBottom: 16 },
  featureItemIcon:    { marginRight: 14, marginTop: 2 },
  featureItemBody:    { flex: 1 },
  featureTitle:       { fontSize: 17, fontWeight: '600', color: C.ink, marginBottom: 6 },
  featureDesc:        { fontSize: 14, color: C.sub, lineHeight: 22 },

  // Steps — numbered list with bottom dividers
  stepsList:          { flexDirection: 'column', marginTop: 12 },
  stepRow:            { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20, gap: 20 },
  stepRowBorder:      { borderBottomWidth: 1, borderBottomColor: C.border },
  stepNum:            { ...T.label, color: C.primary, minWidth: 24, paddingTop: 2 },
  stepBody:           { flex: 1 },
  stepTitle:          { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6 },
  stepDesc:           { fontSize: 13, color: C.sub, lineHeight: 20 },

  // Fee card
  feeCard:            { ...shadow.sm, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, maxWidth: 480, alignSelf: 'stretch' },
  feeRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  feeLabel:           { fontSize: 14, color: C.sub },
  feeValue:           { fontSize: 15, fontWeight: '700', color: C.ink },
  feeDivider:         { height: 1, backgroundColor: C.border, marginVertical: 8 },
  feeNote:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, backgroundColor: C.bg, borderRadius: 8, padding: 10 },
  feeNoteText:        { flex: 1, fontSize: 12, color: C.muted, lineHeight: 18 },

  // Provider CTA — clean surface with simple border
  providerCta:        { width: '100%', backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 48, paddingHorizontal: 24 },
  providerCtaIcon:    { width: 72, height: 72, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.goldBd, alignSelf: 'flex-start' },
  providerCtaTitle:   { fontSize: 26, fontWeight: '700', color: C.ink, marginBottom: 6, textAlign: 'left' },
  providerCtaSub:     { fontSize: 18, fontWeight: '600', color: C.gold, marginBottom: 16, textAlign: 'left' },
  providerCtaDesc:    { fontSize: 15, color: C.sub, lineHeight: 24, marginBottom: 32, textAlign: 'left', maxWidth: 580, alignSelf: 'flex-start' },
  providerCtaStats:   { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 20, marginBottom: 32, maxWidth: 400, alignSelf: 'stretch' },
  providerStat:       { flex: 1, alignItems: 'center' },
  providerStatValue:  { fontSize: 28, fontWeight: '700', color: C.ink, marginBottom: 4 },
  providerStatLabel:  { fontSize: 12, color: C.sub, fontWeight: '500' },
  providerStatDivider:{ width: 1, backgroundColor: C.border },
  providerCtaBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 13, paddingVertical: 18, paddingHorizontal: 32, maxWidth: 360, alignSelf: 'stretch', shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  providerCtaBtnText: { fontSize: 16, fontWeight: '700', color: C.surface },

  // Waitlist
  waitlistCard:       { ...shadow.sm, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, maxWidth: 420, alignSelf: 'stretch', gap: 12, alignItems: 'stretch' },
  waitlistInput:      { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink, backgroundColor: C.bg },
  waitlistBtn:        { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  waitlistBtnDisabled:{ opacity: 0.4 },
  waitlistBtnText:    { fontSize: 14, fontWeight: '700', color: C.surface },
  waitlistDoneText:   { flex: 1, fontSize: 14, color: C.ink, lineHeight: 20, textAlign: 'center' },

  // Footer — intentionally dark
  footer:             { width: '100%', backgroundColor: C.ink, paddingVertical: 48, paddingHorizontal: 24 },
  footerLogo:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'flex-start' },
  footerLogoIcon:     { width: 30, height: 30, borderRadius: 8, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  footerLogoText:     { fontSize: 18, fontWeight: '700', color: C.surface, letterSpacing: 1.5 },
  footerTagline:      { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24, textAlign: 'left' },
  footerLinks:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', marginBottom: 20 },
  footerLink:         { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  footerSep:          { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  footerDisclaimer:   { fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'left', lineHeight: 16, marginBottom: 10, maxWidth: 600, alignSelf: 'stretch' },
  footerCopy:         { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'left' },

  // Beta disclaimer in hero
  betaDisclaimer:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderRadius: 10, borderWidth: 1, borderColor: C.goldBd, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 24, maxWidth: 560, alignSelf: 'flex-start' },
  betaDisclaimerText: { flex: 1, fontSize: 11, color: C.amber, lineHeight: 16 },
});

// Desktop / tablet overrides (>= 768px viewport width)
const wide = StyleSheet.create({
  hero:        { paddingVertical: 80 },
  heroContent: { alignItems: 'center' },
  heroTitle:   { fontSize: 72 },
  heroTagline: { lineHeight: 38, textAlign: 'center' },
  heroSub:     { textAlign: 'center' },
  heroCtas:    { flexDirection: 'row', width: 'auto' },
});
