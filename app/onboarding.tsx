import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Logo & Tagline */}
      <View style={styles.logoSection}>
        <View style={styles.logoMark}>
          <Ionicons name="hammer" size={28} color={C.gold} />
        </View>
        <Text style={styles.logoText}>WERKR</Text>
        <Text style={styles.tagline}>Deutschlands vertrauenswürdigste{'\n'}Handwerker-Plattform</Text>
      </View>

      {/* Role Selection */}
      <View style={styles.cardsSection}>
        <Text style={styles.chooseLabel}>Wie möchten Sie WERKR nutzen?</Text>

        {/* Card: Auftraggeber */}
        <TouchableOpacity
          style={[styles.roleCard, styles.roleCardKunde]}
          onPress={() => router.push('/(tabs)/')}
          activeOpacity={0.85}
        >
          <View style={[styles.roleIconWrap, { backgroundColor: C.goldBg }]}>
            <Ionicons name="search-outline" size={32} color={C.gold} />
          </View>
          <View style={styles.roleTextWrap}>
            <Text style={styles.roleTitle}>Ich suche Hilfe</Text>
            <Text style={styles.roleSubtitle}>Auftraggeber / Kunde</Text>
            <Text style={styles.roleDesc}>
              Finden Sie geprüfte Handwerker und Nachbarschaftshelfer in Ihrer Nähe.
            </Text>
          </View>
          <View style={[styles.roleArrow, { backgroundColor: C.goldBg }]}>
            <Ionicons name="arrow-forward" size={18} color={C.gold} />
          </View>
        </TouchableOpacity>

        {/* Card: Auftragnehmer */}
        <TouchableOpacity
          style={[styles.roleCard, styles.roleCardAnbieter]}
          onPress={() => router.push('/onboarding-kyc')}
          activeOpacity={0.85}
        >
          <View style={[styles.roleIconWrap, { backgroundColor: C.greenBg }]}>
            <Ionicons name="briefcase-outline" size={32} color={C.green} />
          </View>
          <View style={styles.roleTextWrap}>
            <Text style={styles.roleTitle}>Ich biete Hilfe an</Text>
            <Text style={styles.roleSubtitle}>Auftragnehmer / Anbieter</Text>
            <Text style={styles.roleDesc}>
              Bieten Sie Ihre Dienste an, verwalten Sie Aufträge und verdienen Sie mehr.
            </Text>
          </View>
          <View style={[styles.roleArrow, { backgroundColor: C.greenBg }]}>
            <Ionicons name="arrow-forward" size={18} color={C.green} />
          </View>
        </TouchableOpacity>

        {/* Trust indicators */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={14} color={C.sub} />
            <Text style={styles.trustText}>Verifizierte Profile</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed-outline" size={14} color={C.sub} />
            <Text style={styles.trustText}>Sicherer Escrow</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="star-outline" size={14} color={C.sub} />
            <Text style={styles.trustText}>Bewertungssystem</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.footerText}>
            Bereits registriert?{' '}
            <Text style={styles.footerLink}>Einloggen</Text>
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerLegal}>
          Mit der Nutzung stimmen Sie unseren{' '}
          <Text style={styles.footerLegalLink}>AGB</Text>
          {' '}und der{' '}
          <Text style={styles.footerLegalLink}>Datenschutzrichtlinie</Text>
          {' '}zu.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },

  // Logo section
  logoSection:     { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  logoMark:        { width: 60, height: 60, borderRadius: 16, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1, borderColor: C.border },
  logoText:        { fontSize: 32, fontWeight: '800', color: C.ink, letterSpacing: 2.5, marginBottom: 10 },
  tagline:         { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, letterSpacing: 0.2 },

  // Cards
  cardsSection:    { flex: 1, paddingHorizontal: 20 },
  chooseLabel:     { fontSize: 13, color: C.muted, fontWeight: '500', textAlign: 'center', marginBottom: 16, letterSpacing: 0.3, textTransform: 'uppercase' },

  roleCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 14 },
  roleCardKunde:   { borderColor: C.border, borderTopColor: C.gold, borderTopWidth: 2 },
  roleCardAnbieter:{ borderColor: C.border, borderTopColor: C.green, borderTopWidth: 2 },

  roleIconWrap:    { width: 58, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 },
  roleTextWrap:    { flex: 1 },
  roleTitle:       { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 2 },
  roleSubtitle:    { fontSize: 12, color: C.muted, fontWeight: '500', marginBottom: 6 },
  roleDesc:        { fontSize: 13, color: C.sub, lineHeight: 18 },
  roleArrow:       { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 10, flexShrink: 0 },

  // Trust
  trustRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 8 },
  trustItem:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText:       { fontSize: 12, color: C.muted },
  trustDot:        { width: 3, height: 3, borderRadius: 2, backgroundColor: C.border },

  // Footer
  footer:          { paddingHorizontal: 20, paddingBottom: 24, alignItems: 'center', gap: 10 },
  footerText:      { fontSize: 14, color: C.sub },
  footerLink:      { color: C.ink, fontWeight: '700' },
  footerLegal:     { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 17 },
  footerLegalLink: { color: C.sub, textDecorationLine: 'underline' },
});
