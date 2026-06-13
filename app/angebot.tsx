import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { showAlert } from '../lib/alert';

export default function AngebotScreen() {
  const router = useRouter();

  function handleAccept() {
    router.push('/vertrag');
  }

  function handleDecline() {
    showAlert(
      'Angebot ablehnen?',
      'Das Angebot wird abgelehnt. Der Handwerker wird informiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Ablehnen', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Angebot prüfen</Text>
        <Badge label="Neu" variant="amber" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={styles.providerCard}
          onPress={() => router.push('/anbieter')}
          activeOpacity={0.85}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>Y</Text>
          </View>
          <View style={styles.providerInfo}>
            <View style={styles.providerNameRow}>
              <Text style={styles.providerName} numberOfLines={1}>Yilmaz GmbH</Text>
              <Ionicons name="checkmark-circle" size={16} color={C.gold} />
            </View>
            <Text style={styles.providerTrade}>Sanitär & Heizung</Text>
            <View style={styles.providerMeta}>
              <Ionicons name="star" size={12} color={C.gold} />
              <Text style={styles.providerRating}>4,7</Text>
              <Text style={styles.providerReviews}>(134)</Text>
              <View style={styles.metaDot} />
              <Ionicons name="time-outline" size={12} color={C.muted} />
              <Text style={styles.providerResponse}>~2h Antwort</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Angebotsdetails</Text>
          <InfoRow label="Leistung" value="Heizkörper-Diagnose & Thermostat tauschen" />
          <InfoRow label="Festpreis" value="€ 120,00" goldValue />
          <InfoRow label="Termin" value="Mo., 09. Jun 2025 · 14:00 Uhr" />
          <InfoRow label="Dauer" value="1–2 Stunden" />
          <InfoRow label="Adresse" value="Musterstraße 12, 50667 Köln" />
          <Divider margin={12} />
          <InfoRow label="Plattformgebühr (8%)" value="€ 9,60" muted />
          <InfoRow label="Gesamtbetrag" value="€ 120,00" bold />
        </View>

        <View style={styles.escrowBanner}>
          <Ionicons name="lock-closed" size={18} color={C.green} />
          <Text style={styles.escrowText}>
            Ihr Betrag wird bis zur Fertigstellung eingefroren. Freigabe erfolgt erst nach Ihrer Bestätigung.
          </Text>
        </View>

        <View style={styles.cancellationBanner}>
          <Ionicons name="warning-outline" size={18} color={C.amber} />
          <Text style={styles.cancellationText}>
            Kostenlose Stornierung bis 24 Stunden vor Termin möglich.
          </Text>
        </View>

        <View style={styles.messageBubble}>
          <View style={styles.messageBubbleHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={C.sub} />
            <Text style={styles.messageBubbleLabel}>Nachricht vom Anbieter</Text>
          </View>
          <Text style={styles.messageBubbleText}>
            "Bitte stellen Sie sicher, dass ein Erwachsener anwesend ist. Ich bringe alle Materialien mit."
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={handleAccept}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color={C.surface} />
          <Text style={styles.acceptBtnText}>Angebot annehmen & Vertrag abschließen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={handleDecline}
          activeOpacity={0.85}
        >
          <Text style={styles.declineBtnText}>Ablehnen</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  goldValue?: boolean;
  bold?: boolean;
  muted?: boolean;
};

function InfoRow({ label, value, goldValue, bold, muted }: InfoRowProps) {
  return (
    <View style={infoRowStyles.row}>
      <Text style={infoRowStyles.label}>{label}</Text>
      <Text
        style={[
          infoRowStyles.value,
          goldValue && infoRowStyles.goldValue,
          bold && infoRowStyles.boldValue,
          muted && infoRowStyles.mutedValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: C.sub,
    flex: 1,
  },
  value: {
    fontSize: 13,
    color: C.ink,
    flex: 1,
    textAlign: 'right',
  },
  goldValue: {
    color: C.gold,
    fontWeight: '800',
  },
  boldValue: {
    fontWeight: '800',
  },
  mutedValue: {
    color: C.muted,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
  },
  scrollContent: {
    paddingBottom: 190,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: C.gold,
  },
  providerInfo: {
    flex: 1,
    gap: 3,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  providerTrade: {
    fontSize: 12,
    color: C.sub,
  },
  providerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    rowGap: 2,
    marginTop: 2,
  },
  providerRating: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },
  providerReviews: {
    fontSize: 12,
    color: C.muted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.muted,
  },
  providerResponse: {
    fontSize: 12,
    color: C.muted,
  },
  section: {
    backgroundColor: C.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  escrowBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.greenBg,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
  },
  escrowText: {
    flex: 1,
    fontSize: 13,
    color: C.green,
    lineHeight: 19,
  },
  cancellationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.amberBg,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
  },
  cancellationText: {
    flex: 1,
    fontSize: 13,
    color: C.amber,
    lineHeight: 19,
  },
  messageBubble: {
    backgroundColor: '#F0EFEB',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
  },
  messageBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  messageBubbleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  messageBubbleText: {
    fontSize: 13,
    color: C.ink,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 16,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.surface,
  },
  declineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: C.red,
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.red,
  },
});
