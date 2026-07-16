import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { C } from '../constants/colors';
import { shadow } from '../constants/theme';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { createReview } from '../lib/reviews';
import { showAlert } from '../lib/alert';
import { getContractByIdFull } from '../lib/contracts';
import type { ContractFull } from '../lib/contracts';
import { activeCategories } from '../data/categories';

function tradeName(tradeId: string | null | undefined): string {
  if (!tradeId) return '';
  return activeCategories().find((c) => c.id === tradeId)?.name ?? tradeId;
}

function formatEuro(v: number | null | undefined): string {
  if (v == null) return '—';
  return `€${Math.round(v)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

const STAR_LABELS = ['', 'Schlecht', 'Ausbaufähig', 'OK', 'Gut', 'Ausgezeichnet'];

const POSITIVE_TAGS = ['Pünktlich', 'Sauber gearbeitet', 'Freundlich', 'Gutes Preis-Leistung', 'Zuverlässig'];
const NEGATIVE_TAGS = ['Unpünktlich', 'Schlechte Qualität', 'Kommunikationsprobleme', 'Unvollständige Arbeit'];

export default function BewertungScreen() {
  const router = useRouter();
  const { contractId, reviewedId } = useLocalSearchParams<{ contractId?: string; reviewedId?: string }>();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contract, setContract] = useState<ContractFull | null>(null);

  useEffect(() => {
    if (!contractId) return;
    // .catch verhindert eine unbehandelte Rejection, falls der Vertrag nicht
    // lädt — die Bewertung selbst nutzt contractId/reviewedId aus den Params,
    // die Vertragsdaten sind nur fürs Anzeigen (Anbietername).
    getContractByIdFull(contractId).then(setContract).catch(() => {});
  }, [contractId]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  // Reset tags when star rating changes (positive ↔ negative set changes)
  function handleSetRating(star: number) {
    if ((star >= 4) !== (rating >= 4)) setSelectedTags([]);
    setRating(star);
  }

  const displayRating = hovered || rating;

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successScreen}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={64} color={C.primary} />
          </View>
          <Text style={styles.successTitle}>Danke für Ihre Bewertung!</Text>
          <Text style={styles.successText}>
            Ihre Bewertung hilft anderen Kunden und motiviert unsere Handwerker zur Höchstleistung.
          </Text>
          <View style={styles.successStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= rating ? 'star' : 'star-outline'}
                size={28}
                color={C.gold}
              />
            ))}
          </View>
          <AnimatedButton
            style={styles.doneBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>Zurück zu Aufträgen</Text>
          </AnimatedButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bewertung</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Wie war dein Erlebnis?</Text>
          <Text style={styles.mainSub}>Ihr Feedback wird nach der Bewertung veröffentlicht.</Text>
        </View>

        {/* Provider info card */}
        <View style={styles.providerCard}>
          <View style={styles.providerAvatarWrap}>
            <View style={styles.providerAvatar}>
              <Text style={styles.providerAvatarText}>
                {(contract?.provider?.business_name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{contract?.provider?.business_name ?? '—'}</Text>
            <Text style={styles.providerTrade}>{tradeName(contract?.job?.category)}</Text>
            <View style={styles.providerMeta}>
              {contractId ? (
                <View style={styles.providerMetaItem}>
                  <Ionicons name="document-text-outline" size={12} color={C.muted} />
                  <Text style={styles.providerMetaText}>WRK-{contractId.slice(-8).toUpperCase()}</Text>
                </View>
              ) : null}
              {contract?.completed_at ? (
                <View style={styles.providerMetaItem}>
                  <Ionicons name="calendar-outline" size={12} color={C.muted} />
                  <Text style={styles.providerMetaText}>{formatDate(contract.completed_at)}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.providerPriceWrap}>
            <Text style={styles.providerPriceValue}>{formatEuro(contract?.customer_total)}</Text>
            <Text style={styles.providerPriceLabel}>bezahlt</Text>
          </View>
        </View>

        {/* Star selector */}
        <View style={styles.starSection}>
          <Text style={styles.starSectionLabel}>Ihre Bewertung</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleSetRating(star)}
                onPressIn={() => setHovered(star)}
                onPressOut={() => setHovered(0)}
                activeOpacity={0.7}
                style={styles.starBtn}
              >
                <Ionicons
                  name={star <= displayRating ? 'star' : 'star-outline'}
                  size={44}
                  color={star <= displayRating ? C.gold : C.border}
                />
              </TouchableOpacity>
            ))}
          </View>
          {displayRating > 0 ? (
            <View style={styles.starLabelWrap}>
              <Text style={styles.starLabel}>{STAR_LABELS[displayRating]}</Text>
            </View>
          ) : (
            <Text style={styles.starHint}>Tippen Sie auf einen Stern</Text>
          )}
        </View>

        {/* Category quick picks (shown after rating selected) */}
        {rating > 0 && (
          <View style={styles.quickPicksSection}>
            <Text style={styles.quickPicksLabel}>Was hat besonders gut / schlecht funktioniert?</Text>
            <View style={styles.quickPicksRow}>
              {(rating >= 4 ? POSITIVE_TAGS : NEGATIVE_TAGS).map((label) => {
                const active = selectedTags.includes(label);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.quickPickChip, active && styles.quickPickChipActive]}
                    onPress={() => toggleTag(label)}
                    activeOpacity={0.75}
                  >
                    {active && <Ionicons name="checkmark" size={13} color={rating >= 4 ? C.primary : C.red} />}
                    <Text style={[styles.quickPickText, active && (rating >= 4 ? styles.quickPickTextPos : styles.quickPickTextNeg)]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Comment input */}
        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>Dein Kommentar</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Beschreiben Sie Ihre Erfahrung — was lief gut, was hätte besser sein können?"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Photo button (visual only) */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoBtn} activeOpacity={0.7}>
            <View style={styles.photoBtnIcon}>
              <Ionicons name="camera-outline" size={24} color={C.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoBtnTitle}>Fotos hinzufügen</Text>
              <Text style={styles.photoBtnSub}>Bis zu 5 Bilder · optional</Text>
            </View>
            <Ionicons name="add-circle-outline" size={22} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* Legal note */}
        <View style={styles.legalNote}>
          <Ionicons name="shield-outline" size={14} color={C.muted} />
          <Text style={styles.legalNoteText}>
            Bewertungen werden nach Veröffentlichung anonym angezeigt. Falsche Angaben können zur Sperrung führen.
          </Text>
        </View>

      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaBar}>
        <AnimatedButton
          style={[styles.ctaBtn, (rating === 0 || submitting) && styles.ctaBtnDisabled]}
          onPress={async () => {
            if (rating === 0 || submitting) return;
            setSubmitting(true);
            try {
              if (contractId && reviewedId && user) {
                const fullComment = [
                  ...selectedTags,
                  ...(comment.trim() ? [comment.trim()] : []),
                ].join(' · ') || null;
                await createReview({
                  contractId,
                  reviewedId,
                  reviewerId: user.id,
                  rating,
                  comment: fullComment ?? undefined,
                });
                setSubmitted(true);
              } else {
                showAlert('Fehler', 'Bewertung konnte nicht gespeichert werden.', [{ text: 'OK' }]);
              }
            } catch (err: any) {
              showAlert('Fehler', err?.message ?? 'Bewertung konnte nicht gespeichert werden.', [{ text: 'OK' }]);
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={rating === 0 || submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color={C.surface} />
            : <Ionicons name="star" size={18} color={rating === 0 ? C.muted : C.surface} />
          }
          <Text style={[styles.ctaBtnText, (rating === 0 || submitting) && styles.ctaBtnTextDisabled]}>
            {submitting ? 'Wird gespeichert…' : 'Bewertung abschicken'}
          </Text>
        </AnimatedButton>
        {rating === 0 && (
          <Text style={styles.ctaHint}>Bitte wählen Sie zuerst eine Sternebewertung</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: C.bg },
  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:                { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:            { ...T.h3, color: C.ink },
  titleSection:           { paddingHorizontal: 20, paddingBottom: 20 },
  mainTitle:              { ...T.h1, fontSize: 26, color: C.ink, marginBottom: 6 },
  mainSub:                { ...T.body, color: C.sub },
  providerCard:           { ...shadow.sm,  flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, marginHorizontal: 20, padding: 16, marginBottom: 24 },
  providerAvatarWrap:     { position: 'relative', marginRight: 14 },
  providerAvatar:         { width: 52, height: 52, borderRadius: 26, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  providerAvatarText:     { fontSize: 22, fontWeight: '700', color: C.gold },
  providerVerifiedBadge:  { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.surface },
  providerInfo:           { flex: 1 },
  providerName:           { ...T.body, fontWeight: '700', color: C.ink, marginBottom: 2 },
  providerTrade:          { ...T.caption, fontSize: 12, color: C.sub, marginBottom: 6 },
  providerMeta:           { gap: 3 },
  providerMetaItem:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  providerMetaText:       { ...T.caption, color: C.muted },
  providerPriceWrap:      { alignItems: 'flex-end' },
  providerPriceValue:     { fontSize: 20, fontWeight: '700', color: C.ink },
  providerPriceLabel:     { fontSize: 11, color: C.muted, marginTop: 2 },
  starSection:            { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 28 },
  starSectionLabel:       { ...T.label, color: C.sub, marginBottom: 16 },
  starsRow:               { flexDirection: 'row', gap: 8, marginBottom: 14 },
  starBtn:                { padding: 4 },
  starLabelWrap:          { backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 },
  starLabel:              { fontSize: 15, fontWeight: '700', color: C.gold },
  starHint:               { fontSize: 13, color: C.muted },
  quickPicksSection:      { paddingHorizontal: 20, paddingBottom: 24 },
  quickPicksLabel:        { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 10 },
  quickPicksRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickPickChip:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  quickPickChipActive:    { backgroundColor: C.surface, borderWidth: 1.5 },
  quickPickText:          { fontSize: 13, color: C.ink, fontWeight: '500' },
  quickPickTextPos:       { color: C.primary, fontWeight: '700' },
  quickPickTextNeg:       { color: C.red, fontWeight: '700' },
  commentSection:         { paddingHorizontal: 20, paddingBottom: 20 },
  commentLabel:           { ...T.label, color: C.sub, marginBottom: 10 },
  commentInput:           { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, color: C.ink, minHeight: 130 },
  charCount:              { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 5 },
  photoSection:           { paddingHorizontal: 20, paddingBottom: 20 },
  photoBtn:               { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16 },
  photoBtnIcon:           { width: 46, height: 46, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  photoBtnTitle:          { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 2 },
  photoBtnSub:            { fontSize: 12, color: C.muted },
  legalNote:              { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  legalNoteText:          { flex: 1, fontSize: 11, color: C.muted, lineHeight: 17 },
  ctaBar:                 { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaBtn:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15 },
  ctaBtnDisabled:         { backgroundColor: C.border },
  ctaBtnText:             { fontSize: 16, fontWeight: '700', color: C.surface },
  ctaBtnTextDisabled:     { color: C.muted },
  ctaHint:                { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 },
  successScreen:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIconWrap:        { width: 100, height: 100, borderRadius: 50, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle:           { fontSize: 24, fontWeight: '700', color: C.ink, marginBottom: 12, textAlign: 'center' },
  successText:            { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successStars:           { flexDirection: 'row', gap: 6, marginBottom: 36 },
  doneBtn:                { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40 },
  doneBtnText:            { fontSize: 16, fontWeight: '700', color: C.surface },
});
