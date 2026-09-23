import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GastLoginHinweis } from '../components/ui/GastLoginHinweis';
import { toast } from '../components/ui/Toast';

type Card = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
};

const BRAND_ICON_NAME: Record<string, string> = {
  Visa:       'card-outline',
  Mastercard: 'card-outline',
  SEPA:       'business-outline',
};

// WAS DIESER BILDSCHIRM KANN UND WAS NICHT (23.09.2026)
//
// Er LIEST, welche Zahlungsmethoden Stripe zu diesem Konto kennt. Mehr ist
// nicht gebaut, und deshalb steht hier auch nichts anderes mehr:
//
//   - „Standard" und der Papierkorb aenderten frueher NUR den React-Zustand.
//     Die Karte verschwand vor den Augen des Nutzers und war beim naechsten
//     Oeffnen wieder da. Eine Zusicherung ueber ein Zahlungsmittel, die
//     nirgends ankommt, ist schlimmer als ein fehlender Knopf.
//   - „Kreditkarte hinzufuegen" meldete „Stripe Checkout oeffnet sich" und
//     oeffnete nichts. Dasselbe bei der SEPA-Zeile.
//   - Die Liste kann ausserdem GAR NICHTS enthalten: `create-payment-intent`
//     uebergibt Stripe keinen `customer`, eine bezahlte Karte wird also nie
//     an das Konto geheftet. Ob Werkant Karten fuer spaeter speichern soll,
//     ist eine Produkt- und Einwilligungsfrage (Art. 6 DSGVO, SCA-Mandat) und
//     keine, die nebenbei in einem Fix entschieden wird. Sie steht als
//     offener Punkt im Handoff.
export default function ZahlungsmethodenScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  // Ein Netzfehler darf nicht aussehen wie „nichts hinterlegt" -- sonst
  // liest der Nutzer eine Aussage ueber sein Konto, die niemand geprueft hat.
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    supabase.functions
      .invoke<{ methods: Card[] }>('list-payment-methods')
      .then(({ data, error }) => {
        if (error) { setFehler(true); toast.error('Zahlungsmethoden konnten nicht geladen werden'); return; }
        setCards(data?.methods ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Karten haengen an einem Stripe-Kunden, der an einem Konto haengt. Ohne
  // Sitzung zeigte der Screen "Keine Karten hinterlegt" -- das klingt nach
  // "fuegen Sie eine hinzu", obwohl das ohne Konto gar nicht geht
  // (Founder-Report 09.08.2026).
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Zahlungsmethoden</Text>
          <View style={{ width: 36 }} />
        </View>
        <GastLoginHinweis
          icon="card-outline"
          text="Zahlungsmethoden hinterlegen und verwalten Sie, sobald Sie angemeldet sind."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zahlungsmethoden</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Security badge */}
        <View style={styles.securityBanner}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Gesichert durch Stripe</Text>
            <Text style={styles.securityText}>
              {/* „mit PCI DSS Level 1 verschlüsselt" war sachlich falsch:
                  PCI DSS ist ein Regelwerk, kein Verschlüsselungsverfahren,
                  und „Level 1" ist eine Einstufung des Dienstleisters, keine
                  Schlüssellänge. Was stimmt, steht jetzt da. */}
              Ihre Kartendaten gehen direkt an Stripe und werden dort verarbeitet. Werkant sieht und speichert keine Kartennummern.
            </Text>
          </View>
        </View>

        {/* Saved cards */}
        <Text style={styles.sectionLabel}>Gespeicherte Karten</Text>

        {cards.map((card) => (
          <View key={card.id} style={[styles.cardRow, card.isDefault && styles.cardRowDefault]}>
            <View style={styles.cardLeft}>
              <View style={styles.cardBrandWrap}>
                <Ionicons name={(BRAND_ICON_NAME[card.brand] ?? 'card-outline') as any} size={20} color={C.sub} />
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
          </View>
        ))}

        {loading ? (
          <View style={styles.emptyCards}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : fehler ? (
          <View style={styles.emptyCards}>
            <Ionicons name="cloud-offline-outline" size={32} color={C.border} />
            <Text style={styles.emptyText}>Die Liste konnte nicht geladen werden.</Text>
            <Text style={styles.emptyHint}>
              Das ist keine Aussage über Ihr Konto: bitte später noch einmal öffnen.
            </Text>
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.emptyCards}>
            <Ionicons name="card-outline" size={32} color={C.border} />
            <Text style={styles.emptyText}>Keine Zahlungsmethode gespeichert</Text>
            <Text style={styles.emptyHint}>
              Werkant speichert keine Kartendaten. Sie geben sie bei jeder Zahlung direkt bei Stripe ein.
            </Text>
          </View>
        ) : null}

        {/* Escrow info */}
        <View style={styles.escrowInfo}>
          <Ionicons name="lock-closed-outline" size={16} color={C.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.escrowTitle}>Zahlung über Treuhandkonto</Text>
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
  backBtn:          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { ...T.h3, fontWeight: '700', color: C.ink },
  scroll:           { paddingHorizontal: 16, paddingBottom: 48 },
  securityBanner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.primaryBg, borderRadius: 12, padding: 14, marginBottom: 24, marginTop: 8, borderWidth: 1, borderColor: C.primary + '40' },
  securityIcon:     { width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  securityTitle:    { ...T.sm, ...T.bold, color: C.primary, marginBottom: 3 },
  securityText:     { ...T.caption, color: C.primary, opacity: 0.85 },
  sectionLabel:     { ...T.label, color: C.sub, letterSpacing: 0.7, marginBottom: 10 },
  cardRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRowDefault:   { borderColor: C.gold, borderWidth: 1.5 },
  cardLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardBrandWrap:    { width: 44, height: 32, borderRadius: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardBrand:        { ...T.body, ...T.bold, color: C.ink },
  cardNumber:       { ...T.body, color: C.sub },
  defaultBadge:     { backgroundColor: C.goldBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: C.gold },
  cardExpiry:       { ...T.xs, fontSize: 12, color: C.muted },
  emptyCards:       { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText:        { ...T.body, color: C.muted },
  emptyHint:        { ...T.caption, color: C.muted, textAlign: 'center', paddingHorizontal: 24 },
  escrowInfo:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.amberBg, borderRadius: 12, padding: 14, marginTop: 24, borderWidth: 1, borderColor: C.amber + '40' },
  escrowTitle:      { ...T.sm, ...T.bold, color: C.amber, marginBottom: 3 },
  escrowText:       { ...T.caption, color: C.amber, opacity: 0.9 },
});
