import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { showAlert } from '../lib/alert';

type Card = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
};

const MOCK_CARDS: Card[] = [
  { id: '1', brand: 'Visa',       last4: '4242', expiry: '09/27', isDefault: true  },
  { id: '2', brand: 'Mastercard', last4: '5555', expiry: '03/26', isDefault: false },
];

const BRAND_ICONS: Record<string, string> = {
  Visa:       '💳',
  Mastercard: '💳',
  SEPA:       '🏦',
};

export default function ZahlungsmethodenScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(MOCK_CARDS);

  function setDefault(id: string) {
    setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
  }

  function removeCard(id: string) {
    showAlert(
      'Karte entfernen',
      'Möchten Sie diese Zahlungsmethode wirklich entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => setCards((prev) => prev.filter((c) => c.id !== id)),
        },
      ],
    );
  }

  function addCard() {
    showAlert(
      'Karte hinzufügen',
      'Stripe Checkout öffnet sich, um Ihre Zahlungsdaten sicher zu hinterlegen.',
      [{ text: 'OK' }],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zahlungsmethoden</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Security badge */}
        <View style={styles.securityBanner}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={20} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Gesichert durch Stripe</Text>
            <Text style={styles.securityText}>
              Ihre Zahlungsdaten werden mit PCI DSS Level 1 verschlüsselt. WERKR speichert keine Kartennummern.
            </Text>
          </View>
        </View>

        {/* Saved cards */}
        <Text style={styles.sectionLabel}>Gespeicherte Karten</Text>

        {cards.map((card) => (
          <View key={card.id} style={[styles.cardRow, card.isDefault && styles.cardRowDefault]}>
            <View style={styles.cardLeft}>
              <View style={styles.cardBrandWrap}>
                <Text style={styles.cardBrandEmoji}>{BRAND_ICONS[card.brand] ?? '💳'}</Text>
              </View>
              <View>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardBrand}>{card.brand}</Text>
                  <Text style={styles.cardNumber}>···· {card.last4}</Text>
                  {card.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Standard</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardExpiry}>Gültig bis {card.expiry}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              {!card.isDefault && (
                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => setDefault(card.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardActionText}>Standard</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.cardActionBtn, styles.cardActionDelete]}
                onPress={() => removeCard(card.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={15} color={C.red} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {cards.length === 0 && (
          <View style={styles.emptyCards}>
            <Ionicons name="card-outline" size={32} color={C.border} />
            <Text style={styles.emptyText}>Keine Karten hinterlegt</Text>
          </View>
        )}

        {/* Add card */}
        <TouchableOpacity style={styles.addBtn} onPress={addCard} activeOpacity={0.8}>
          <View style={styles.addBtnIcon}>
            <Ionicons name="add" size={20} color={C.ink} />
          </View>
          <Text style={styles.addBtnText}>Kreditkarte hinzufügen</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>

        {/* SEPA */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>SEPA-Lastschrift</Text>
        <View style={styles.sepaCard}>
          <View style={styles.sepaLeft}>
            <View style={styles.cardBrandWrap}>
              <Text style={styles.cardBrandEmoji}>🏦</Text>
            </View>
            <View>
              <Text style={styles.cardBrand}>SEPA Lastschrift</Text>
              <Text style={styles.cardExpiry}>Noch nicht hinterlegt</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => showAlert('SEPA', 'IBAN-Eingabe öffnet sich über Stripe Elements.')}
            activeOpacity={0.7}
          >
            <Text style={styles.cardActionText}>Hinzufügen</Text>
          </TouchableOpacity>
        </View>

        {/* Escrow info */}
        <View style={styles.escrowInfo}>
          <Ionicons name="lock-closed-outline" size={16} color={C.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.escrowTitle}>Escrow-Zahlung</Text>
            <Text style={styles.escrowText}>
              Zahlungen werden erst nach Ihrer Auftragsfreigabe an den Anbieter übertragen. Kein Risiko für Sie.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  backBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { fontSize: 18, fontWeight: '800', color: C.ink },
  scroll:           { paddingHorizontal: 16, paddingBottom: 48 },
  securityBanner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.greenBg, borderRadius: 12, padding: 14, marginBottom: 24, marginTop: 8, borderWidth: 1, borderColor: C.green + '40' },
  securityIcon:     { width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  securityTitle:    { fontSize: 13, fontWeight: '700', color: C.green, marginBottom: 3 },
  securityText:     { fontSize: 12, color: C.green, lineHeight: 17, opacity: 0.85 },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  cardRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRowDefault:   { borderColor: C.gold, borderWidth: 1.5 },
  cardLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardBrandWrap:    { width: 44, height: 32, borderRadius: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cardBrandEmoji:   { fontSize: 18 },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardBrand:        { fontSize: 14, fontWeight: '700', color: C.ink },
  cardNumber:       { fontSize: 14, color: C.sub },
  defaultBadge:     { backgroundColor: C.goldBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: C.gold },
  cardExpiry:       { fontSize: 12, color: C.muted },
  cardActions:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardActionBtn:    { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  cardActionDelete: { backgroundColor: C.redBg, borderColor: C.red, width: 34, height: 34, paddingHorizontal: 0, alignItems: 'center', justifyContent: 'center' },
  cardActionText:   { fontSize: 12, fontWeight: '600', color: C.ink },
  addBtn:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, marginTop: 4 },
  addBtnIcon:       { width: 36, height: 36, borderRadius: 9, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  addBtnText:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.ink },
  sepaCard:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  sepaLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyCards:       { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText:        { fontSize: 14, color: C.muted },
  escrowInfo:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.amberBg, borderRadius: 12, padding: 14, marginTop: 24, borderWidth: 1, borderColor: C.amber + '40' },
  escrowTitle:      { fontSize: 13, fontWeight: '700', color: C.amber, marginBottom: 3 },
  escrowText:       { fontSize: 12, color: C.amber, lineHeight: 17, opacity: 0.9 },
});
