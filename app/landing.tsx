import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

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
  { icon: 'checkmark-circle-outline' as const, label: 'TÜV-geprüft ready' },
];

export default function LandingScreen() {
  const router = useRouter();

  return (
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
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>Jetzt in Köln & Umgebung verfügbar</Text>
          </View>
          <Text style={styles.heroTitle}>WERKR</Text>
          <Text style={styles.heroTagline}>
            Handwerker & Nachbarschaftshilfe —{'\n'}einfach, sicher, fair
          </Text>
          <Text style={styles.heroSub}>
            Finden Sie geprüfte Profis in Ihrer Nähe. Alle Zahlungen über Escrow gesichert.
            Transparent — nur 8% Plattformgebühr, keine versteckten Kosten.
          </Text>
          <View style={styles.heroCtas}>
            <TouchableOpacity
              style={styles.ctaPrimary}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={18} color={C.surface} />
              <Text style={styles.ctaPrimaryText}>Jetzt Handwerker finden</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.8}
            >
              <Ionicons name="construct-outline" size={18} color={C.ink} />
              <Text style={styles.ctaSecondaryText}>Als Anbieter registrieren</Text>
            </TouchableOpacity>
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
              <Ionicons name={badge.icon} size={16} color={C.green} />
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

          <View style={styles.featuresGrid}>
            {FEATURES.map((feat) => (
              <View key={feat.title} style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feat.icon} size={24} color={C.gold} />
                </View>
                <Text style={styles.featureTitle}>{feat.title}</Text>
                <Text style={styles.featureDesc}>{feat.desc}</Text>
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

          <View style={styles.stepsGrid}>
            {HOW_STEPS.map((step, i) => (
              <View key={step.num} style={styles.stepCard}>
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                </View>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={step.icon} size={22} color={C.ink} />
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
                {i < HOW_STEPS.length - 1 && (
                  <View style={styles.stepConnector}>
                    <Ionicons name="arrow-forward" size={16} color={C.border} />
                  </View>
                )}
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
              <Text style={[styles.feeValue, { color: C.green, fontSize: 18, fontWeight: '800' }]}>€220,80</Text>
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
          <TouchableOpacity
            style={styles.providerCtaBtn}
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward" size={18} color={C.surface} />
            <Text style={styles.providerCtaBtnText}>Jetzt als Anbieter registrieren</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <Text style={styles.footerCopy}>© 2025 WERKR GmbH · Köln, Deutschland</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const MAX_W = 1100;

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },
  scroll:             { alignItems: 'center' },

  // Nav
  nav:                { width: '100%', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  navContent:         { maxWidth: MAX_W, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14, alignSelf: 'center' },
  navBrand:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navLogo:            { width: 34, height: 34, borderRadius: 9, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  navTitle:           { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: 1.5 },
  navActions:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLoginBtn:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  navLoginText:       { fontSize: 14, fontWeight: '600', color: C.ink },
  navStartBtn:        { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: C.ink },
  navStartText:       { fontSize: 14, fontWeight: '700', color: C.surface },

  // Hero
  hero:               { width: '100%', backgroundColor: C.bg, paddingVertical: Platform.OS === 'web' ? 80 : 48, paddingHorizontal: 24 },
  heroContent:        { maxWidth: 680, width: '100%', alignSelf: 'center', alignItems: Platform.OS === 'web' ? 'center' : 'flex-start' },
  heroBadge:          { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 24, alignSelf: 'flex-start' },
  heroBadgeDot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green },
  heroBadgeText:      { fontSize: 12, fontWeight: '600', color: C.green },
  heroTitle:          { fontSize: Platform.OS === 'web' ? 72 : 48, fontWeight: '900', color: C.ink, letterSpacing: 3, marginBottom: 12 },
  heroTagline:        { fontSize: Platform.OS === 'web' ? 28 : 20, fontWeight: '700', color: C.ink, lineHeight: Platform.OS === 'web' ? 38 : 30, marginBottom: 18, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  heroSub:            { fontSize: 16, color: C.sub, lineHeight: 26, marginBottom: 36, maxWidth: 560, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  heroCtas:           { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 14, marginBottom: 36, width: Platform.OS === 'web' ? 'auto' : '100%' },
  ctaPrimary:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16 },
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
  section:            { width: '100%', paddingVertical: Platform.OS === 'web' ? 72 : 48, paddingHorizontal: 24 },
  sectionInner:       { maxWidth: MAX_W, width: '100%', alignSelf: 'center' },
  sectionLabel:       { fontSize: 11, fontWeight: '700', color: C.gold, letterSpacing: 1.5, marginBottom: 10, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  sectionTitle:       { fontSize: Platform.OS === 'web' ? 36 : 26, fontWeight: '800', color: C.ink, marginBottom: 14, textAlign: Platform.OS === 'web' ? 'center' : 'left', lineHeight: Platform.OS === 'web' ? 46 : 34 },
  sectionSub:         { fontSize: 16, color: C.sub, lineHeight: 26, textAlign: Platform.OS === 'web' ? 'center' : 'left', marginBottom: 48, maxWidth: 600, alignSelf: Platform.OS === 'web' ? 'center' : 'flex-start' },

  // Features grid
  featuresGrid:       { flexDirection: Platform.OS === 'web' ? 'row' : 'column', flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap', gap: 20 },
  featureCard:        { flexGrow: Platform.OS === 'web' ? 1 : undefined, flexBasis: Platform.OS === 'web' ? 280 : undefined, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 28, borderTopWidth: 3, borderTopColor: C.gold },
  featureIcon:        { width: 52, height: 52, borderRadius: 13, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  featureTitle:       { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 10 },
  featureDesc:        { fontSize: 14, color: C.sub, lineHeight: 22 },

  // Steps grid
  stepsGrid:          { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 4, alignItems: Platform.OS === 'web' ? 'flex-start' : 'stretch', marginTop: 12 },
  stepCard:           { flex: Platform.OS === 'web' ? 1 : undefined, alignItems: Platform.OS === 'web' ? 'center' : 'flex-start', padding: 20, position: 'relative' },
  stepNumCircle:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 2, borderColor: C.gold },
  stepNum:            { fontSize: 15, fontWeight: '800', color: C.gold },
  stepIconWrap:       { width: 50, height: 50, borderRadius: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stepTitle:          { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  stepDesc:           { fontSize: 13, color: C.sub, lineHeight: 20, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  stepConnector:      { position: 'absolute', right: -8, top: 30, display: Platform.OS === 'web' ? 'flex' : 'none' },

  // Fee card
  feeCard:            { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, maxWidth: 480, alignSelf: Platform.OS === 'web' ? 'center' : 'stretch' },
  feeRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  feeLabel:           { fontSize: 14, color: C.sub },
  feeValue:           { fontSize: 15, fontWeight: '700', color: C.ink },
  feeDivider:         { height: 1, backgroundColor: C.border, marginVertical: 8 },
  feeNote:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, backgroundColor: C.bg, borderRadius: 8, padding: 10 },
  feeNoteText:        { flex: 1, fontSize: 12, color: C.muted, lineHeight: 18 },

  // Provider CTA section
  providerCta:        { width: '100%', backgroundColor: C.goldBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E8D69A', paddingVertical: Platform.OS === 'web' ? 72 : 48, paddingHorizontal: 24 },
  providerCtaIcon:    { width: 72, height: 72, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E8D69A', alignSelf: Platform.OS === 'web' ? 'center' : 'flex-start' },
  providerCtaTitle:   { fontSize: Platform.OS === 'web' ? 36 : 26, fontWeight: '800', color: C.ink, marginBottom: 6, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  providerCtaSub:     { fontSize: 18, fontWeight: '600', color: C.gold, marginBottom: 16, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  providerCtaDesc:    { fontSize: 15, color: C.sub, lineHeight: 24, marginBottom: 32, textAlign: Platform.OS === 'web' ? 'center' : 'left', maxWidth: 580, alignSelf: Platform.OS === 'web' ? 'center' : 'flex-start' },
  providerCtaStats:   { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: '#E8D69A', paddingVertical: 20, marginBottom: 32, maxWidth: 400, alignSelf: Platform.OS === 'web' ? 'center' : 'stretch' },
  providerStat:       { flex: 1, alignItems: 'center' },
  providerStatValue:  { fontSize: 28, fontWeight: '900', color: C.ink, marginBottom: 4 },
  providerStatLabel:  { fontSize: 12, color: C.sub, fontWeight: '500' },
  providerStatDivider:{ width: 1, backgroundColor: C.border },
  providerCtaBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 13, paddingVertical: 18, paddingHorizontal: 32, maxWidth: 360, alignSelf: Platform.OS === 'web' ? 'center' : 'stretch' },
  providerCtaBtnText: { fontSize: 16, fontWeight: '700', color: C.surface },

  // Footer
  footer:             { width: '100%', backgroundColor: C.ink, paddingVertical: 48, paddingHorizontal: 24 },
  footerLogo:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start' },
  footerLogoIcon:     { width: 30, height: 30, borderRadius: 8, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  footerLogoText:     { fontSize: 18, fontWeight: '800', color: C.surface, letterSpacing: 1.5 },
  footerTagline:      { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24, textAlign: Platform.OS === 'web' ? 'center' : 'left' },
  footerLinks:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start', marginBottom: 20 },
  footerLink:         { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  footerSep:          { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  footerCopy:         { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: Platform.OS === 'web' ? 'center' : 'left' },
});
