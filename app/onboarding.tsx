import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { shadow } from '../constants/theme';
import { requestNotificationPermission, setupAndroidChannel } from '../lib/notifications';

export default function OnboardingScreen() {
  const router = useRouter();

  async function goCustomer() {
    await setupAndroidChannel();
    await requestNotificationPermission();
    router.replace('/(tabs)/');
  }

  async function goProvider() {
    await setupAndroidChannel();
    await requestNotificationPermission();
    router.push('/onboarding-kyc');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={styles.logoBlock}>
          <View style={styles.logoMark}>
            <Ionicons name="hammer" size={26} color={C.gold} />
          </View>
          <View style={styles.logoTextRow}>
            <Text style={styles.logoText}>WERKR</Text>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.tagline}>
            Deutschlands vertrauenswürdigste{'\n'}Handwerker-Plattform
          </Text>
        </View>

        {/* ── Choose label ── */}
        <Text style={styles.chooseLabel}>Wie möchten Sie WERKR nutzen?</Text>

        {/* ── Card A: Auftraggeber / Kunde — PRIMARY (large, warm) ── */}
        <AnimatedButton
          style={styles.cardPrimary}
          onPress={goCustomer}
        >
          {/* Double-Bezel: inner tinted surface */}
          <View style={styles.cardPrimaryInner}>
            <View style={styles.cardPrimaryTop}>
              <View style={styles.cardIconLg}>
                <Ionicons name="home-outline" size={26} color={C.gold} />
              </View>
              <View style={styles.cardPrimaryBadge}>
                <Text style={styles.cardPrimaryBadgeText}>EMPFOHLEN</Text>
              </View>
            </View>
            <Text style={styles.cardTitleLg}>Ich suche Hilfe</Text>
            <Text style={styles.cardRoleLg}>Auftraggeber / Kunde</Text>
            <Text style={styles.cardDescLg}>
              Geprüfte Handwerker und Nachbarschaftshelfer in Ihrer Nähe finden.
            </Text>
            <View style={styles.cardCtaRow}>
              <Text style={[styles.cardCtaText, { color: C.gold }]}>Loslegen</Text>
              <View style={styles.cardCtaArrow}>
                <Ionicons name="arrow-forward" size={13} color={C.gold} />
              </View>
            </View>
          </View>
        </AnimatedButton>

        {/* ── Card B: Auftragnehmer / Anbieter — SECONDARY (compact, clean) ── */}
        <AnimatedButton
          style={styles.cardSecondary}
          onPress={goProvider}
        >
          <View style={styles.cardSecondaryLeft}>
            <View style={[styles.cardIconSm, { backgroundColor: C.primaryBg }]}>
              <Ionicons name="construct-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitleSm}>Ich biete Hilfe an</Text>
              <Text style={styles.cardRoleSm}>Auftragnehmer / Anbieter</Text>
            </View>
          </View>
          <View style={styles.cardCtaRow}>
            <Text style={[styles.cardCtaText, { color: C.primary }]}>Bewerben</Text>
            <View style={[styles.cardCtaArrow, { backgroundColor: C.primaryBg }]}>
              <Ionicons name="arrow-forward" size={13} color={C.primary} />
            </View>
          </View>
        </AnimatedButton>

        {/* ── Trust badges ── */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={13} color={C.sub} />
            <Text style={styles.trustText}>Geprüfte Profile</Text>
          </View>
          <View style={styles.trustSep} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed-outline" size={13} color={C.sub} />
            <Text style={styles.trustText}>Escrow-Zahlung</Text>
          </View>
          <View style={styles.trustSep} />
          <View style={styles.trustItem}>
            <Ionicons name="star-outline" size={13} color={C.sub} />
            <Text style={styles.trustText}>Bewertungssystem</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <TouchableOpacity style={styles.loginRow} activeOpacity={0.7} onPress={() => router.push('/landing')}>
          <Text style={styles.loginText}>Bereits registriert? </Text>
          <Text style={styles.loginLink}>Einloggen</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Mit der Nutzung stimmen Sie unseren{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/agb')}>AGB</Text>
          {' '}und der{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/datenschutz')}>Datenschutzrichtlinie</Text>
          {' '}zu.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flexGrow: 1, paddingHorizontal: 22, paddingTop: 36, paddingBottom: 36, alignItems: 'center' },

  // Logo block
  logoBlock:      { alignItems: 'center', marginBottom: 36 },
  logoMark:       { width: 64, height: 64, borderRadius: 18, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoTextRow:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  logoText:       { fontSize: 34, fontWeight: '700', color: C.ink, letterSpacing: 3 },
  logoDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, marginBottom: 7, marginLeft: 3 },
  tagline:        { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, letterSpacing: 0.2 },

  // Choose label
  chooseLabel:    { fontSize: 12, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16, alignSelf: 'flex-start' },

  // ── Primary card (customer) — large, warm, Double-Bezel depth ────────────
  cardPrimary: {
    width: '100%', borderRadius: 18, marginBottom: 12,
    borderWidth: 1.5, borderColor: C.goldBd,
    backgroundColor: C.goldBg,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 5,
  },
  cardPrimaryInner: { padding: 22 },
  cardPrimaryTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  cardIconLg:       { width: 52, height: 52, borderRadius: 13, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.goldBd },
  cardPrimaryBadge: { backgroundColor: C.goldBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.goldBd },
  cardPrimaryBadgeText: { fontSize: 9, fontWeight: '700', color: C.amber, letterSpacing: 0.8 },
  cardTitleLg:      { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.3, marginBottom: 3 },
  cardRoleLg:       { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  cardDescLg:       { fontSize: 14, color: C.sub, lineHeight: 21, marginBottom: 18 },
  // ── Secondary card (provider) — compact, clean ───────────────────────────
  cardSecondary: {
    width: '100%', borderRadius: 14, marginBottom: 12, padding: 16,
    borderWidth: 1, borderColor: C.primaryBd,
    backgroundColor: C.surface,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  cardSecondaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIconSm:       { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitleSm:      { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 2 },
  cardRoleSm:       { fontSize: 11, color: C.muted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  // ── Shared CTA row ────────────────────────────────────────────────────────
  cardCtaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCtaText: { fontSize: 14, fontWeight: '700' },
  cardCtaArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },

  // Trust row
  trustRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 24 },
  trustItem:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  trustText:      { fontSize: 11, color: C.sub, fontWeight: '500' },
  trustSep:       { width: 1, height: 14, backgroundColor: C.border },

  // Login
  loginRow:       { flexDirection: 'row', marginBottom: 16 },
  loginText:      { fontSize: 14, color: C.sub },
  loginLink:      { fontSize: 14, fontWeight: '700', color: C.ink, textDecorationLine: 'underline' },

  // Legal
  legal:          { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 17 },
  legalLink:      { color: C.sub, textDecorationLine: 'underline' },
});
