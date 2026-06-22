import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { showAlert } from '../lib/alert';
import { getContractByIdFull } from '../lib/contracts';
import type { ContractFull } from '../lib/contracts';
import { supabase } from '../lib/supabase';
import { sendPushToUser } from '../lib/notifications';
import { useAuth } from '../contexts/AuthContext';

type Step = 1 | 2 | 3;

type CategoryId = 'quality' | 'noshow' | 'price' | 'damage' | 'communication' | 'other';

type DisputeStatus = 'open' | 'provider_response_pending' | 'under_review' | 'resolved';

interface DisputeSubmission {
  caseId: string;
  status: DisputeStatus;
  category: CategoryId;
  description: string;
  photoCount: number;
  submittedAt: string;
  orderId: string;
  escrowAmount: number;
}

interface Category {
  id: CategoryId;
  icon: string;
  title: string;
  sub: string;
}

function generateCaseId(): string {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(Math.floor(now.getTime() / 1000) % 9999).padStart(4, '0');
  return `RKL-${yymm}-${seq}`;
}

const CATEGORIES: Category[] = [
  { id: 'quality',       icon: 'construct-outline',                  title: 'Schlechte Arbeitsqualität',      sub: 'Mängel, unfertige Arbeit, Schäden' },
  { id: 'noshow',        icon: 'calendar-outline',                   title: 'Nicht erschienen',               sub: 'Anbieter kam nicht zum vereinbarten Termin' },
  { id: 'price',         icon: 'cash-outline',                       title: 'Preiserhöhung ohne Absprache',   sub: 'Mehr verlangt als im Vertrag vereinbart' },
  { id: 'damage',        icon: 'warning-outline',                    title: 'Sachschaden entstanden',         sub: 'Eigentum wurde beschädigt' },
  { id: 'communication', icon: 'chatbubble-outline',                  title: 'Kommunikationsprobleme',         sub: 'Keine Reaktion, unhöfliches Verhalten' },
  { id: 'other',         icon: 'ellipsis-horizontal-circle-outline', title: 'Sonstiges',                      sub: 'Anderes Problem beschreiben' },
];

const TIMELINE_STEPS = [
  { title: 'WERKR prüft den Fall',      detail: 'Innerhalb von 24h' },
  { title: 'Anbieter wird kontaktiert', detail: 'Stellungnahme angefordert' },
  { title: 'Entscheidung & Escrow',     detail: 'Freigabe oder Rückerstattung' },
];

export default function ReklamationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { contractId } = useLocalSearchParams<{ contractId?: string }>();
  const [step, setStep] = useState<Step>(1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [description, setDescription] = useState('');
  const [photos] = useState<string[]>([]);
  const [dispute, setDispute] = useState<DisputeSubmission | null>(null);
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!contractId) return;
    getContractByIdFull(contractId).then(setContract);
  }, [contractId]);

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory) ?? null;

  function handleBack() {
    if (step === 1) {
      router.back();
    } else if (step === 2) {
      setStep(1);
    }
  }

  function handleNextStep1() {
    if (selectedCategory) setStep(2);
  }

  async function handleNextStep2() {
    if (!description || description.length < 30 || !selectedCategory) return;
    if (!contractId || !user) {
      showAlert('Fehler', 'Kein Auftrag oder Sitzung gefunden.');
      return;
    }
    setSubmitting(true);
    const caseId = generateCaseId();
    const { error } = await supabase.from('disputes').insert({
      contract_id: contractId,
      reporter_id: user.id,
      case_id: caseId,
      category: selectedCategory,
      description,
    });
    setSubmitting(false);
    if (error) {
      showAlert('Fehler', 'Reklamation konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
      return;
    }
    // Notify the provider a dispute was filed against them (fire-and-forget).
    if (contract?.provider_id) {
      sendPushToUser(
        contract.provider_id,
        '⚠️ Reklamation eingereicht',
        `Für Ihren Auftrag „${contract.job?.title ?? 'Auftrag'}" wurde eine Reklamation (${caseId}) eingereicht. Bitte prüfen Sie Ihre Aufträge.`,
        { screen: '/(provider)/auftraege', contractId: contractId ?? '' },
      );
    }

    const submission: DisputeSubmission = {
      caseId,
      status: 'open',
      category: selectedCategory,
      description,
      photoCount: photos.length,
      submittedAt: new Date().toISOString(),
      orderId: contractId ? `WRK-${contractId.slice(-8).toUpperCase()}` : '—',
      escrowAmount: contract?.customer_total ?? 0,
    };
    setDispute(submission);
    setStep(3);
  }

  function handlePhotoUpload() {
    showAlert('Fotos hinzufügen', 'Foto-Anhänge sind ab dem offiziellen Launch verfügbar. Sie können Beweise bis dahin per E-Mail an support@werkr.de einsenden.');
  }

  function handleBackToAuftraege() {
    router.replace('/(tabs)/auftraege');
  }

  function handleSupport() {
    showAlert('Support', 'support@werkr.de · Mo–Fr 9–18 Uhr');
  }

  if (step === 3) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.successScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={64} color={C.green} />
          </View>

          <Text style={styles.successTitle}>Reklamation eingereicht</Text>
          <Text style={styles.successBody}>
            Fall {dispute?.caseId ?? '—'} wurde erfolgreich eröffnet. Status: <Text style={{ fontWeight: '700' }}>Offen</Text>. Das WERKR-Team meldet sich innerhalb von 24 Stunden.
          </Text>

          <View style={styles.timelineCard}>
            {TIMELINE_STEPS.map((item, index) => (
              <View key={item.title} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                  {index < TIMELINE_STEPS.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.greenBtn}
            onPress={handleBackToAuftraege}
            activeOpacity={0.85}
          >
            <Ionicons name="briefcase-outline" size={18} color={C.surface} />
            <Text style={styles.greenBtnText}>Zurück zu Aufträgen</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSupport} activeOpacity={0.7} style={styles.supportLink}>
            <Text style={styles.supportLinkText}>Support kontaktieren</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reklamation</Text>
          <Text style={styles.headerSub}>Schritt {step}/3</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3].map((seg) => (
          <View
            key={seg}
            style={[
              styles.progressSegment,
              seg <= step && styles.progressSegmentActive,
              seg < 3 && { marginRight: 4 },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <View>
              <Text style={styles.stepHeading}>Was ist das Problem?</Text>

              {/* Amber info banner */}
              <View style={styles.infoBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={C.amber} style={styles.infoBannerIcon} />
                <Text style={styles.infoBannerText}>
                  Das WERKR-Eskalationsteam prüft Ihren Fall innerhalb von 24h.
                </Text>
              </View>

              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.categoryIconWrap, isSelected && styles.categoryIconWrapSelected]}>
                      <Ionicons
                        name={cat.icon as any}
                        size={22}
                        color={isSelected ? C.red : C.sub}
                      />
                    </View>
                    <View style={styles.categoryTextWrap}>
                      <Text style={[styles.categoryTitle, isSelected && styles.categoryTitleSelected]}>
                        {cat.title}
                      </Text>
                      <Text style={styles.categorySub}>{cat.sub}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={C.red} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <View>
              <Text style={styles.stepHeading}>Problem beschreiben</Text>

              {/* Job summary card */}
              <View style={styles.jobCard}>
                <View style={styles.jobCardTop}>
                  <Text style={styles.jobId}>
                    {contractId ? `WRK-${contractId.slice(-8).toUpperCase()}` : '—'}
                  </Text>
                  {contract?.customer_total != null && (
                    <View style={styles.escrowBadge}>
                      <Text style={styles.escrowBadgeText}>
                        €{Math.round(contract.customer_total)} Escrow gesperrt
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.jobCompany}>{contract?.provider?.business_name ?? '—'}</Text>
                <Text style={styles.jobMeta}>{contract?.job?.title ?? '—'}</Text>
              </View>

              {/* Active category chip */}
              {activeCategory && (
                <View style={styles.activeCategoryChip}>
                  <Ionicons name={activeCategory.icon as any} size={14} color={C.surface} />
                  <Text style={styles.activeCategoryChipText}>{activeCategory.title}</Text>
                </View>
              )}

              {/* Description input */}
              <Text style={styles.inputLabel}>Problembeschreibung</Text>
              <TextInput
                style={styles.textarea}
                value={description}
                onChangeText={setDescription}
                placeholder="Beschreiben Sie das Problem so genau wie möglich..."
                placeholderTextColor={C.muted}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
              <View style={styles.charCountRow}>
                <Text style={[styles.charCount, description.length < 30 && styles.charCountWarn]}>
                  {description.length < 30
                    ? `Mindestens ${30 - description.length} Zeichen noch`
                    : `${description.length} / 1000`}
                </Text>
              </View>

              {/* Photo upload */}
              <TouchableOpacity
                style={styles.photoUpload}
                onPress={handlePhotoUpload}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={28} color={C.muted} />
                <Text style={styles.photoUploadTitle}>Beweise hochladen</Text>
                <Text style={styles.photoUploadSub}>Bis zu 5 Fotos · optional</Text>
              </TouchableOpacity>

              {/* Legal warning */}
              <View style={styles.legalBox}>
                <Ionicons name="information-circle-outline" size={16} color={C.amber} style={{ marginTop: 1 }} />
                <Text style={styles.legalText}>
                  Falsche Angaben können zur Sperrung des Kontos führen (AGB §8).
                </Text>
              </View>
            </View>
          )}

        </ScrollView>

        {/* CTA button */}
        <View style={styles.ctaBar}>
          {step === 1 && (
            <TouchableOpacity
              style={[styles.ctaBtn, !selectedCategory && styles.ctaBtnDisabled]}
              onPress={handleNextStep1}
              disabled={!selectedCategory}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaBtnText, !selectedCategory && styles.ctaBtnTextDisabled]}>
                Weiter
              </Text>
              <Ionicons name="arrow-forward" size={18} color={selectedCategory ? C.surface : C.muted} />
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity
              style={[styles.ctaBtn, (description.length < 30 || submitting) && styles.ctaBtnDisabled]}
              onPress={handleNextStep2}
              disabled={description.length < 30 || submitting}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaBtnText, (description.length < 30 || submitting) && styles.ctaBtnTextDisabled]}>
                {submitting ? 'Wird eingereicht…' : 'Reklamation einreichen'}
              </Text>
              {!submitting && <Ionicons name="arrow-forward" size={18} color={description.length >= 30 ? C.surface : C.muted} />}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  // Layout
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: C.red,
    marginTop: 1,
  },
  headerRight: {
    width: 36,
  },

  // Progress bar
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  progressSegmentActive: {
    backgroundColor: C.red,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 4,
  },

  // Step heading
  stepHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 16,
    letterSpacing: -0.4,
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  infoBannerIcon: {
    marginTop: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: C.amber,
    fontWeight: '600',
    lineHeight: 19,
  },

  // Category cards
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  categoryCardSelected: {
    borderColor: C.red,
    backgroundColor: C.redBg,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapSelected: {
    backgroundColor: C.redBg,
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 2,
  },
  categoryTitleSelected: {
    color: C.red,
  },
  categorySub: {
    fontSize: 12,
    color: C.sub,
    lineHeight: 17,
  },

  // Job summary card
  jobCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  jobCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  jobId: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: 0.2,
  },
  escrowBadge: {
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  escrowBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.amber,
  },
  jobCompany: {
    ...T.h4,
    color: C.ink,
    marginBottom: 3,
  },
  jobMeta: {
    fontSize: 12,
    color: C.sub,
  },

  // Active category chip
  activeCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: C.red,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 18,
    gap: 6,
  },
  activeCategoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.surface,
  },

  // Description input
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.sub,
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    ...T.body,
    color: C.ink,
    minHeight: 130,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 16,
  },
  charCount: {
    fontSize: 12,
    color: C.muted,
  },
  charCountWarn: {
    color: C.amber,
    fontWeight: '600',
  },

  // Photo upload
  photoUpload: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    marginBottom: 16,
    gap: 6,
  },
  photoUploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
  photoUploadSub: {
    fontSize: 12,
    color: C.muted,
  },

  // Legal box
  legalBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 8,
    marginBottom: 8,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: C.amber,
    fontWeight: '600',
    lineHeight: 18,
  },

  // CTA bar
  ctaBar: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.red,
    borderRadius: 12,
    paddingVertical: 15,
  },
  ctaBtnDisabled: {
    backgroundColor: C.border,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.surface,
  },
  ctaBtnTextDisabled: {
    color: C.muted,
  },

  // ── Success (step 3) ──
  successScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
  },
  successIconWrap: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  successBody: {
    fontSize: 15,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
  },

  // Timeline
  timelineCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 18,
    marginBottom: 32,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
    marginRight: 14,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.border,
    marginTop: 3,
  },
  timelineDotActive: {
    backgroundColor: C.primary,
  },
  timelineLine: {
    width: 2,
    height: 32,
    backgroundColor: C.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 2,
  },
  timelineDetail: {
    fontSize: 12,
    color: C.sub,
  },

  // Success buttons
  greenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 32,
    width: '100%',
    marginBottom: 16,
  },
  greenBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.surface,
  },
  supportLink: {
    paddingVertical: 8,
  },
  supportLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.sub,
    textDecorationLine: 'underline',
  },
});
