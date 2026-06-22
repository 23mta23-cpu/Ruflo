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

        {/* ── Card A: Auftraggeber / Kunde ── */}
        <AnimatedButton
          style={[styles.card, styles.cardGold]}
          onPress={goCustomer}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: C.goldBg }]}>
            <Ionicons name="home-outline" size={30} color={C.gold} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Ich suche Hilfe</Text>
            <Text style={styles.cardRole}>Auftraggeber / Kunde</Text>
            <Text style={styles.cardDesc}>
              Finden Sie geprüfte Handwerker und Nachbarschaftshelfer in Ihrer Nähe — in wenigen Minuten beauftragt.
            </Text>
            <View style={styles.cardCta}>
              <Text style={[styles.cardCtaText, { color: C.gold }]}>Loslegen</Text>
              <Ionicons name="arrow-forward" size={15} color={C.gold} />
            </View>
          </View>
        </AnimatedButton>

        {/* ── Card B: Auftragnehmer / Anbieter ── */}
        <AnimatedButton
          style={[styles.card, styles.cardGreen]}
          onPress={goProvider}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: C.greenBg }]}>
            <Ionicons name="construct-outline" size={30} color={C.green} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Ich biete Hilfe an</Text>
            <Text style={styles.cardRole}>Auftragnehmer / Anbieter</Text>
            <Text style={styles.cardDesc}>
              Registrieren Sie sich als Handwerker oder Nachbarschaftshelfer und erhalten Sie neue Aufträge direkt auf Ihr Handy.
            </Text>
            <View style={styles.cardCta}>
              <Text style={[styles.cardCtaText, { color: C.green }]}>Jetzt bewerben</Text>
              <Ionicons name="arrow-forward" size={15} color={C.green} />
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
  logoText:       { fontSize: 34, fontWeight: '800', color: C.ink, letterSpacing: 3 },
  logoDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, marginBottom: 7, marginLeft: 3 },
  tagline:        { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, letterSpacing: 0.2 },

  // Choose label
  chooseLabel:    { fontSize: 12, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16, alignSelf: 'flex-start' },

  // Cards
  card:           { ...shadow.md, width: '100%', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 14 },
  cardGold:       { borderColor: C.border, borderTopColor: C.gold, borderTopWidth: 2.5 },
  cardGreen:      { borderColor: C.border, borderTopColor: C.green, borderTopWidth: 2.5 },
  cardIconWrap:   { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cardBody:       {},
  cardTitle:      { fontSize: 19, fontWeight: '800', color: C.ink, marginBottom: 2 },
  cardRole:       { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  cardDesc:       { fontSize: 14, color: C.sub, lineHeight: 20, marginBottom: 14 },
  cardCta:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardCtaText:    { fontSize: 14, fontWeight: '700' },

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
