import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JOB_DRAFT_KEY } from '../lib/jobDraft';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { toast } from '../components/ui/Toast';
import { showAlert } from '../lib/alert';
import { checkContent, BLOCK_REASON_LABELS } from '../lib/contentFilter';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { createJob } from '../lib/jobs';
import { requireVerifiedEmail } from '../lib/auth';
import { authErrorMessage } from '../lib/auth';
import { isActiveCity, ACTIVE_CITIES } from '../lib/cities';
import { joinWaitlist } from '../lib/waitlist';
import { FEATURES } from '../constants/features';
import {
  categoryById, NACHBARSCHAFT_STARTKATEGORIEN, isNachbarschaftsfaehigeKategorie,
  CATEGORIES as CENTRAL_CATEGORIES, MEISTERPFLICHT_IDS,
} from '../data/categories';
import { trackEvent, trackError } from '../lib/analytics';

type Category = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  regulated?: boolean; // §1 HwO Anlage A — Meisterpflicht
};

// Modell D (docs/produkt/Nachbarschaftsunterstuetzung-Modell-D.md): Nachbarschaft
// ist KEINE gleichrangige Kategorie im Handwerker-Trichter mehr. Der Wizard läuft
// im Nachbarschafts-Modus nur, wenn er gezielt mit ?track=nachbarschaft geöffnet
// wird (Fallback in auftrag-detail bzw. „Jetzt buchen" im Helfer-Profil).
// Handwerks-Gewerke aus der zentralen Konfiguration (Single Source of Truth,
// wie Home-Raster/Suche) — vorher eine eigene, abweichende Liste mit anderen
// ids (sanitaer/elektrik statt heizung-sanitaer/elektro) und hartkodierten
// regulated-Flags. Befund (Founder-Audit 07.07.): Renovierung, Tischler und
// Fliesen wurden auf Home/Suche beworben, waren im Wizard aber gar nicht
// wählbar — ein Kunde konnte für diese Gewerke keinen Auftrag anlegen.
const B2B_CATEGORIES: Category[] = CENTRAL_CATEGORIES
  .filter((c) => c.segment === 'B2B' && c.active)
  .map((c) => ({
    id: c.id,
    label: c.name,
    icon: c.icon as Category['icon'],
    regulated: MEISTERPFLICHT_IDS.has(c.id),
  }));

const CATEGORIES: Category[] = [
  { id: 'handwerker', label: 'Handwerker', icon: 'construct-outline' },
  ...B2B_CATEGORIES,
  { id: 'garten', label: 'Gartenarbeit', icon: 'leaf-outline' },
  { id: 'reinigung', label: 'Haushaltsreinigung', icon: 'sparkles-outline' },
];

// Nachbarschafts-Modus: nur die freigegebenen Startkategorien, aus der
// zentralen Konfiguration abgeleitet (Meisterpflicht-Gewerke strukturell
// ausgeschlossen — sie sind nie Teil dieser Liste).
const NB_START_CATEGORIES: Category[] = NACHBARSCHAFT_STARTKATEGORIEN.map((id) => {
  const c = categoryById(id)!;
  return { id: c.id, label: c.name, icon: c.icon as Category['icon'] };
});

// Haupttrichter bei aktivem Nachbarschafts-Track (Modell D+): Handwerks-
// Kategorien plus die freigegebenen Startkategorien, ohne Duplikate
// („garten" existiert in beiden Listen).
const HAUPT_CATEGORIES: Category[] = FEATURES.NACHBARSCHAFT
  ? [...CATEGORIES, ...NB_START_CATEGORIES.filter((nb) => !CATEGORIES.some((h) => h.id === nb.id))]
  : CATEGORIES;
const NB_BUDGET_OPTIONS = ['< €20', '€20–50', '€50–100', 'Auf Anfrage'];
const HW_BUDGET_OPTIONS = ['< €100', '€100–500', '€500–2.000', 'Auf Anfrage'];

// Beispieltexte für Schritt 2 pro Kategorie — vorher hart auf "Badezimmer
// fliesen" kodiert, egal welche Kategorie gewählt war (Founder-Fund:
// "Umzugshilfe anklicken, Vorschläge vom Badezimmer"). 'default' greift
// für Kategorien ohne eigenen Eintrag (z. B. spätere Erweiterungen).
const STEP2_PLACEHOLDER: Record<string, { title: string; desc: string }> = {
  'heizung-sanitaer': { title: 'z. B. Badezimmer fliesen, Heizkörper reparieren', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Badezimmer fliesen, ca. 12 m², Wandfliesen 20x20cm)…' },
  elektro: { title: 'z. B. Steckdosen installieren, Sicherungskasten prüfen', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. 3 neue Steckdosen im Wohnzimmer, Sicherungskasten defekt)…' },
  renovierung: { title: 'z. B. Wohnzimmer renovieren, Laminat verlegen', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Wohnzimmer 20 m² neu streichen, Laminat verlegen)…' },
  maler: { title: 'z. B. Wände streichen, Tapezieren', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. 2 Zimmer streichen, ca. 40 m² Wandfläche)…' },
  tischler: { title: 'z. B. Einbauschrank montieren, Tür reparieren', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Einbauschrank im Flur montieren, Maße 2×2,5 m)…' },
  fliesen: { title: 'z. B. Bad fliesen, Küche fliesen', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Badezimmer neu fliesen, ca. 12 m² Wandfliesen)…' },
  garten: { title: 'z. B. Rasen mähen, Hecke schneiden', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Rasen 200 m² mähen, Hecke 15 m schneiden)…' },
  reinigung: { title: 'z. B. Wohnung reinigen, Fenster putzen', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. 3-Zimmer-Wohnung Grundreinigung, alle Fenster)…' },
  umzugshilfe: { title: 'z. B. Umzug 2-Zimmer-Wohnung, Möbeltransport', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Umzug 3. OG ohne Aufzug, ca. 15 Kartons + Sofa)…' },
  einkaufshilfe: { title: 'z. B. Wocheneinkauf, Apotheke', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Wocheneinkauf im Supermarkt, Einkaufsliste wird bereitgestellt)…' },
  'it-support': { title: 'z. B. WLAN einrichten, PC läuft langsam', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Drucker einrichten, neuen Router anschließen)…' },
  moebelaufbau: { title: 'z. B. Kleiderschrank aufbauen, Regal montieren', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. Kleiderschrank 2×2m aus Bausatz aufbauen)…' },
  waesche: { title: 'z. B. Wäsche waschen und bügeln', desc: 'Beschreiben Sie, was gemacht werden soll (z.B. 1 Korb Wäsche waschen, trocknen, bügeln)…' },
  default: { title: 'Kurz und knapp, worum es geht', desc: 'Beschreiben Sie, was gemacht werden soll — je genauer, desto passendere Angebote erhalten Sie…' },
};

const URGENCY_OPTIONS = ['Nicht dringend', 'Diese Woche', 'Heute/Morgen'];

// Gast-Entwurf: füllt ein Gast alle Schritte aus und tippt am Ende „Auftrag
// abschicken", muss er sich erst anmelden — bisher gingen dabei ALLE Eingaben
// verloren („danach muss ich alles neu angeben", Founder-Feedback). Wir sichern
// den Entwurf vor der Anmeldung und stellen ihn beim nächsten Öffnen wieder her.
// Schlüssel zentral in lib/jobDraft.ts, damit die Auth-Screens nach dem Login
// zurück in den Wizard leiten können (kein Schlüssel-Drift).
const DRAFT_KEY = JOB_DRAFT_KEY;

const TIME_OPTIONS = [
  {
    id: 'flexibel',
    icon: 'calendar-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Ich bin flexibel',
    subtitle: 'Ich kann innerhalb von 2 Wochen',
    badge: null,
  },
  {
    id: 'diese-woche',
    icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Diese Woche',
    subtitle: 'Ich brauche jemanden in den nächsten 7 Tagen',
    badge: null,
  },
  {
    id: 'dringend',
    icon: 'flash-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Dringend (heute/morgen)',
    subtitle: '',
    badge: 'Express-Aufschlag möglich',
  },
];

const LABEL_BY_TIME_ID: Record<string, string> = {
  flexibel: 'Flexibel (2 Wochen)',
  'diese-woche': 'Diese Woche',
  dringend: 'Dringend (heute/morgen)',
};

export default function AuftragAufgebenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ track?: string; category?: string }>();
  // Nachbarschafts-Modus nur über gezielten Einstieg + aktives Flag
  const nbMode = FEATURES.NACHBARSCHAFT && params.track === 'nachbarschaft';
  const { user } = useAuth();
  React.useEffect(() => {
    trackEvent('job_wizard_started', { track: nbMode ? 'nachbarschaft' : 'handwerker' });
  }, [nbMode]);

  // Kategorie-Kacheln auf Home/Suche gaben bisher keine Auswahl weiter — der
  // Wizard startete bei Schritt 1 mit exakt demselben Raster, das der Nutzer
  // gerade schon gesehen hatte ("2 Seiten, die dasselbe zeigen", Founder-
  // Feedback). Ist die Kategorie per Link bereits bekannt und gültig, direkt
  // mit Schritt 2 starten statt sie ein zweites Mal abzufragen.
  const validCategoryIds = new Set([...CATEGORIES, ...NB_START_CATEGORIES].map((c) => c.id));
  const initialCategory = params.category && validCategoryIds.has(params.category) ? params.category : '';
  // Untere Schranke fürs Zurück-Blättern: Schritt 1 wurde für diesen Aufruf
  // übersprungen, darf beim Zurück-Navigieren also auch nicht wieder
  // auftauchen — sonst landet man exakt wieder auf der Seite, die man
  // gerade schon auf Home gesehen hat.
  const entryStep = initialCategory ? 2 : 1;

  const [step, setStep] = useState(entryStep);
  const [success, setSuccess] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobRef, setJobRef] = useState('');
  const [jobId, setJobId] = useState('');

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentError, setContentError] = useState<string | null>(null);
  const [plz, setPlz] = useState('');
  const [city, setCity] = useState('');
  const [urgency, setUrgency] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [budget, setBudget] = useState('');
  const [consent, setConsent] = useState(false);

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); }, []);

  // Gast-Entwurf beim Öffnen wiederherstellen (nur passend zum aktuellen Track).
  // Nach dem Wiederherstellen einmalig löschen — ein späterer, frischer Start
  // soll nicht überraschend wieder alte Eingaben zeigen.
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw) as Record<string, unknown>;
        // Track-Fremdling NICHT löschen — er soll im passenden Modus noch
        // wiederherstellbar bleiben (z. B. Nachbarschafts-Entwurf).
        if (!!d.nbMode !== nbMode) return;
        if (typeof d.selectedCategory === 'string' && d.selectedCategory) setSelectedCategory(d.selectedCategory);
        if (typeof d.jobTitle === 'string') setJobTitle(d.jobTitle);
        if (typeof d.description === 'string') setDescription(d.description);
        if (typeof d.plz === 'string') setPlz(d.plz);
        if (typeof d.city === 'string') setCity(d.city);
        if (typeof d.urgency === 'string') setUrgency(d.urgency);
        if (typeof d.selectedTime === 'string') setSelectedTime(d.selectedTime);
        if (typeof d.preferredTime === 'string') setPreferredTime(d.preferredTime);
        if (typeof d.budget === 'string') setBudget(d.budget);
        if (typeof d.step === 'number' && d.step >= 1 && d.step <= 4) setStep(d.step);
        toast.info('Ihr Entwurf wurde wiederhergestellt');
        // Nur nach echter Wiederherstellung löschen (Einmal-Restore).
        AsyncStorage.removeItem(DRAFT_KEY);
      } catch { /* korrupter Entwurf — ignorieren */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistDraft() {
    return AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
      nbMode, selectedCategory, jobTitle, description, plz, city,
      urgency, selectedTime, preferredTime, budget, step,
    }));
  }

  const step1Valid = selectedCategory !== '';
  const step2Valid =
    jobTitle.length >= 5 &&
    description.length >= 30 &&
    plz.length === 5 &&
    /^\d{5}$/.test(plz) &&
    city.length >= 2;
  const step3Valid = selectedTime !== '';
  const step4Valid = consent;

  function handleBack() {
    if (step <= entryStep) {
      safeBack(router);
    } else {
      setStep((s) => s - 1);
    }
  }

  function handleNext() {
    if (step === 2) {
      const check = checkContent(description);
      if (!check.allowed) {
        setContentError(`Diese Dienstleistung ist auf Werkant nicht erlaubt: ${BLOCK_REASON_LABELS[check.reason ?? ''] ?? check.reason ?? ''}.`);
        return;
      }
      setContentError(null);
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (isSupabaseConfigured && user) {
        if (!isActiveCity(city)) {
          await joinWaitlist({
            email: user.email ?? '',
            city: city.trim(),
            plz,
            source: 'auftrag-aufgeben',
            userId: user.id,
          });
          setWaitlisted(true);
          setSuccess(true);
          return;
        }
        if (!(await requireVerifiedEmail(user))) return;
        const track = nbMode ? ('nachbarschaft' as const) : ('handwerker' as const);
        const job = await createJob({
          customerId: user.id,
          title: jobTitle.trim(),
          description: description.trim(),
          category: getCategoryLabel(selectedCategory),
          addressPlz: plz,
          addressCity: city.trim(),
          track,
        });
        setJobRef(`AUF-${job.id.slice(-8).toUpperCase()}`);
        setJobId(job.id);
        trackEvent(track === 'nachbarschaft' ? 'nachbarschaft_job_submitted' : 'job_submitted', { category: selectedCategory });
      } else {
        // Entwurf sichern, BEVOR wir zur Anmeldung wechseln — sonst sind alle
        // Eingaben nach Rückkehr weg. Beim erneuten Öffnen des Wizards wird der
        // Entwurf automatisch wiederhergestellt (siehe useEffect oben).
        await persistDraft();
        showAlert(
          'Anmeldung erforderlich',
          'Bitte melden Sie sich an oder registrieren Sie sich, um Ihren Auftrag einzureichen. Ihre Eingaben bleiben gespeichert.',
          [
            { text: 'Anmelden', onPress: () => router.push('/login') },
            { text: 'Abbrechen', style: 'cancel' },
          ],
        );
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      trackError('job_submit');
      showAlert('Fehler', authErrorMessage(err), [{ text: 'OK' }]);
    } finally {
      setSubmitting(false);
    }
  }

  function getCategoryLabel(id: string) {
    return CATEGORIES.find((c) => c.id === id)?.label ?? categoryById(id)?.name ?? id;
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name={waitlisted ? 'time-outline' : 'checkmark'} size={36} color={C.primary} />
          </View>
          {waitlisted ? (
            <>
              <Text style={styles.successHeading}>Sie stehen auf der Warteliste!</Text>
              <Text style={styles.successBody}>
                Werkant ist aktuell nur in {ACTIVE_CITIES.join(', ')} live. Wir informieren Sie
                per E-Mail, sobald Werkant in {city.trim()} startet.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.successHeading}>Auftrag eingereicht!</Text>
              <Text style={styles.successBody}>
                Wir leiten Ihre Anfrage an passende, geprüfte Anbieter weiter.
                Ihren Auftrag und eingehende Angebote finden Sie jederzeit unter
                „Aufträge" — wir benachrichtigen Sie bei jedem neuen Angebot.
              </Text>
              <View style={styles.refChip}>
                <Text style={styles.refText}>#{jobRef || 'AUF-…'}</Text>
              </View>
              <TouchableOpacity
                style={styles.btnGreen}
                onPress={() => jobId
                  ? router.replace({ pathname: '/auftrag-detail', params: { jobId } })
                  : router.replace('/(tabs)/auftraege')}
              >
                <Text style={styles.btnGreenText}>Auftrag ansehen</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => router.replace('/(tabs)/')}
          >
            <Text style={styles.btnOutlineText}>Zur Startseite</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Zurück">
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.stepLabel}>Schritt {step} von 4</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.progressBar}>
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              style={[
                styles.progressSegment,
                n <= step ? styles.progressActive : styles.progressInactive,
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Login-Hinweis VOR der Eingabe-Arbeit — verhindert, dass Nutzer
              4 Schritte ausfüllen und beim Absenden an der Anmeldung scheitern.
              An entryStep statt hart an Schritt 1 gebunden: bei Direkteinstieg
              über eine Home-Kategorie (Schritt 1 übersprungen) sonst nie sichtbar. */}
          {step === entryStep && !user && isSupabaseConfigured && (
            <TouchableOpacity
              style={styles.loginHint}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={17} color={C.primary} />
              <Text style={styles.loginHintText}>
                Tipp: Zuerst kostenlos anmelden — dann geht Ihre Anfrage am Ende
                direkt raus, ohne dass Eingaben verloren gehen.
              </Text>
              <Ionicons name="chevron-forward" size={14} color={C.primary} />
            </TouchableOpacity>
          )}
          {step === 1 && (
            <Step1
              selectedCategory={selectedCategory}
              onSelect={(id) => {
                setSelectedCategory(id);
                trackEvent('job_category_selected', { category: id, track: nbMode ? 'nachbarschaft' : 'handwerker' });
                // Schritt 1 hat nur diese eine Entscheidung — ein zweiter Klick auf
                // "Weiter" wäre reine Reibung. Kurze Verzögerung lässt die Auswahl
                // (und ggf. Meisterpflicht-/Nachbarschafts-Hinweis) sichtbar werden,
                // bevor automatisch weitergeblättert wird. "Weiter"-Button bleibt als
                // manueller Fallback nutzbar.
                if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                autoAdvanceRef.current = setTimeout(() => setStep((s) => (s === 1 ? s + 1 : s)), 400);
              }}
              nbMode={nbMode}
            />
          )}
          {step === 2 && (
            <Step2
              category={selectedCategory}
              jobTitle={jobTitle}
              onTitleChange={setJobTitle}
              description={description}
              onDescriptionChange={(v) => { setDescription(v); if (contentError) setContentError(null); }}
              plz={plz}
              onPlzChange={setPlz}
              city={city}
              onCityChange={setCity}
              urgency={urgency}
              onUrgencyChange={setUrgency}
              contentError={contentError}
            />
          )}
          {step === 3 && (
            <Step3
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
              preferredTime={preferredTime}
              onPreferredTimeChange={setPreferredTime}
            />
          )}
          {step === 4 && (
            <Step4
              budget={budget}
              onBudgetChange={setBudget}
              consent={consent}
              onConsentChange={setConsent}
              selectedCategory={selectedCategory}
              description={description}
              plz={plz}
              selectedTime={selectedTime}
              getCategoryLabel={getCategoryLabel}
              isNachbarschaft={nbMode}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 4 ? (
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                !(step === 1
                  ? step1Valid
                  : step === 2
                  ? step2Valid
                  : step3Valid) && styles.btnDisabled,
              ]}
              onPress={handleNext}
              disabled={
                step === 1 ? !step1Valid : step === 2 ? !step2Valid : !step3Valid
              }
            >
              <Text style={styles.btnPrimaryText}>Weiter</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnGreen, !step4Valid && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!step4Valid || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.surface} />
              ) : (
                <Text style={styles.btnGreenText}>Auftrag abschicken</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Step1Props = {
  selectedCategory: string;
  onSelect: (id: string) => void;
  nbMode: boolean;
};

function Step1({ selectedCategory, onSelect, nbMode }: Step1Props) {
  const gridCategories = nbMode ? NB_START_CATEGORIES : HAUPT_CATEGORIES;
  const selectedCat = gridCategories.find((c) => c.id === selectedCategory);
  return (
    <View>
      <Text style={styles.stepTitle}>{nbMode ? 'Wobei soll geholfen werden?' : 'Was benötigen Sie?'}</Text>
      <Text style={styles.stepSubtitle}>
        {nbMode ? 'Nachbarschaftshilfe — wählen Sie eine Aufgabe' : 'Wählen Sie eine Kategorie'}
      </Text>
      <View style={styles.categoryGrid}>
        {gridCategories.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTile, active && styles.categoryTileActive]}
              onPress={() => onSelect(cat.id)}
            >
              <View style={[styles.categoryTileIcon, active && styles.categoryTileIconActive]}>
                <Ionicons
                  name={cat.icon}
                  size={22}
                  color={active ? C.surface : C.primary}
                />
              </View>
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                {cat.label}
              </Text>
              {/* Kein Meisterpflicht-Badge mehr pro Kachel — bei vielen
                  regulierten Gewerken war das Raster voller Badges (Rauschen,
                  Founder-Befund 17.07.). Die rechtlich relevante Erklärung
                  zeigt der Banner unten NACH Auswahl der Kategorie. */}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedCat?.regulated && (
        <View style={styles.meisterBanner}>
          <Ionicons name="ribbon-outline" size={18} color={C.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.meisterBannerTitle}>Meisterpflicht-Gewerk (§1 HwO)</Text>
            <Text style={styles.meisterBannerText}>
              Werkant vermittelt für dieses Gewerk ausschließlich zugelassene Meisterbetriebe.
              Ihr Auftrag wird nur an Anbieter mit gültigem Meisterbrief weitergeleitet.
            </Text>
          </View>
        </View>
      )}

      {nbMode && (
        <View style={styles.nbHint}>
          <Ionicons name="people-outline" size={18} color={C.primary} />
          <Text style={styles.nbHintText}>
            Nachbarschaftshilfe: geprüfte private Helfer, €1,99 Werkant-Schutz pro
            Auftrag, Helfer erhält 100 % des vereinbarten Preises.
          </Text>
        </View>
      )}

      {/* Modell D+ — Erwartungssatz: nur bei Kategorien, die auch nachbarschafts-
          fähig sind, damit der spätere Fallback keine Überraschung ist. */}
      {!nbMode && FEATURES.NACHBARSCHAFT && selectedCat && !selectedCat.regulated &&
        isNachbarschaftsfaehigeKategorie(selectedCat.label) && (
        <View style={styles.nbHint}>
          <Ionicons name="people-outline" size={18} color={C.primary} />
          <Text style={styles.nbHintText}>
            Falls kein Betrieb verfügbar ist, prüfen wir für diese Aufgabe
            zusätzlich geprüfte Nachbarschaftshilfe.
          </Text>
        </View>
      )}
    </View>
  );
}

type Step2Props = {
  category: string;
  jobTitle: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  plz: string;
  onPlzChange: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  urgency: string;
  onUrgencyChange: (v: string) => void;
  contentError: string | null;
};

function Step2({ category, jobTitle, onTitleChange, description, onDescriptionChange, plz, onPlzChange, city, onCityChange, urgency, onUrgencyChange, contentError }: Step2Props) {
  const remaining = 500 - description.length;
  const tooShort = description.length < 30;
  const ph = STEP2_PLACEHOLDER[category] ?? STEP2_PLACEHOLDER.default;
  return (
    <View>
      <Text style={styles.stepTitle}>Beschreiben Sie den Auftrag</Text>

      <Text style={styles.fieldLabel}>Kurzbezeichnung</Text>
      <TextInput
        style={styles.input}
        placeholder={ph.title}
        placeholderTextColor={C.muted}
        value={jobTitle}
        onChangeText={(v) => onTitleChange(v.slice(0, 80))}
        returnKeyType="next"
      />

      <Text style={styles.fieldLabel}>Was soll gemacht werden?</Text>
      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={4}
        placeholder={ph.desc}
        placeholderTextColor={C.muted}
        value={description}
        onChangeText={(v) => onDescriptionChange(v.slice(0, 500))}
        textAlignVertical="top"
      />
      <View style={styles.charRow}>
        {tooShort && description.length > 0 && (
          <Text style={styles.charWarning}>Mindestens 30 Zeichen</Text>
        )}
        <Text style={[styles.charCount, remaining < 50 && styles.charCountWarn]}>
          {description.length}/500
        </Text>
      </View>
      {contentError && (
        <View style={styles.contentErrorBox}>
          <Ionicons name="ban-outline" size={14} color="#dc2626" />
          <Text style={styles.contentErrorText}>{contentError}</Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>Wo soll gearbeitet werden?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput
          style={[styles.input, { flex: 0.45 }]}
          placeholder="PLZ, z.B. 50667"
          placeholderTextColor={C.muted}
          value={plz}
          onChangeText={(v) => onPlzChange(v.replace(/\D/g, '').slice(0, 5))}
          keyboardType="numeric"
          maxLength={5}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, { flex: 0.55 }]}
          placeholder="Stadt"
          placeholderTextColor={C.muted}
          value={city}
          onChangeText={onCityChange}
          returnKeyType="next"
        />
      </View>

      <TouchableOpacity
        style={styles.photoRow}
        onPress={() =>
          showAlert('Fotos hinzufügen', 'Kamera-Zugriff kommt mit App-Store-Release')
        }
      >
        <Ionicons name="camera-outline" size={22} color={C.gold} />
        <Text style={styles.photoLabel}>Fotos hinzufügen</Text>
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Dringlichkeit</Text>
      <View style={styles.chipRow}>
        {URGENCY_OPTIONS.map((opt) => {
          const active = urgency === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onUrgencyChange(opt)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type Step3Props = {
  selectedTime: string;
  onSelectTime: (id: string) => void;
  preferredTime: string;
  onPreferredTimeChange: (v: string) => void;
};

function Step3({ selectedTime, onSelectTime, preferredTime, onPreferredTimeChange }: Step3Props) {
  return (
    <View>
      <Text style={styles.stepTitle}>Wann soll der Auftrag stattfinden?</Text>
      {TIME_OPTIONS.map((opt) => {
        const active = selectedTime === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.timeCard, active && styles.timeCardActive]}
            onPress={() => onSelectTime(opt.id)}
          >
            <View style={styles.timeCardIcon}>
              <Ionicons name={opt.icon} size={24} color={active ? C.gold : C.sub} />
            </View>
            <View style={styles.timeCardText}>
              <Text style={[styles.timeCardTitle, active && styles.timeCardTitleActive]}>
                {opt.title}
              </Text>
              {opt.subtitle !== '' && (
                <Text style={styles.timeCardSubtitle}>{opt.subtitle}</Text>
              )}
              {opt.badge !== null && (
                <View style={styles.amberBadge}>
                  <Text style={styles.amberBadgeText}>{opt.badge}</Text>
                </View>
              )}
            </View>
            {active && (
              <Ionicons name="checkmark-circle" size={22} color={C.gold} />
            )}
          </TouchableOpacity>
        );
      })}

      <Text style={styles.fieldLabel}>Bevorzugte Uhrzeit (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. Nachmittags, nach 14:00"
        placeholderTextColor={C.muted}
        value={preferredTime}
        onChangeText={onPreferredTimeChange}
      />
    </View>
  );
}

type Step4Props = {
  budget: string;
  onBudgetChange: (v: string) => void;
  consent: boolean;
  onConsentChange: (v: boolean) => void;
  selectedCategory: string;
  description: string;
  plz: string;
  selectedTime: string;
  getCategoryLabel: (id: string) => string;
  isNachbarschaft: boolean;
};

function Step4({
  budget,
  onBudgetChange,
  consent,
  onConsentChange,
  selectedCategory,
  description,
  plz,
  selectedTime,
  getCategoryLabel,
  isNachbarschaft,
}: Step4Props) {
  const budgetOptions = isNachbarschaft ? NB_BUDGET_OPTIONS : HW_BUDGET_OPTIONS;
  const descSnippet = description.length > 60 ? description.slice(0, 60) + '…' : description;
  const timeLabel = LABEL_BY_TIME_ID[selectedTime] ?? selectedTime;
  return (
    <View>
      <Text style={styles.stepTitle}>Fast geschafft!</Text>

      <Text style={styles.fieldLabel}>Ihr Budget (optional)</Text>
      <View style={styles.chipRow}>
        {budgetOptions.map((opt) => {
          const active = budget === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onBudgetChange(active ? '' : opt)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.feeNote}>
        {isNachbarschaft
          ? 'Helfer erhält 100% des Betrags · zzgl. €1,99 Werkant-Schutz (Escrow + Käuferschutz) für den Auftraggeber.'
          : 'Kunden zahlen zzgl. 2,5% Service-Gebühr (mind. €1,50) — wird vor Auftragsannahme ausgewiesen.'}
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Zusammenfassung</Text>
        <SummaryRow label="Kategorie" value={getCategoryLabel(selectedCategory)} />
        <SummaryRow label="Beschreibung" value={descSnippet} />
        <SummaryRow label="PLZ" value={plz} />
        <SummaryRow label="Zeitrahmen" value={timeLabel} />
        {budget !== '' && <SummaryRow label="Budget" value={budget} />}
        <Text style={styles.summaryNote}>
          Ihre Daten werden nur an geprüfte Anbieter weitergegeben.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.consentRow}
        onPress={() => onConsentChange(!consent)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
          {consent && <Ionicons name="checkmark" size={14} color={C.surface} />}
        </View>
        <Text style={styles.consentText}>
          Ich stimme zu, dass Werkant mein Anliegen an passende Anbieter weiterleitet.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  stepLabel: { ...T.body, ...T.medium, color: C.sub },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressActive: { backgroundColor: C.primary },
  progressInactive: { backgroundColor: C.border },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  stepTitle: {
    ...T['2xl'],
    ...T.bold,
    color: C.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  stepSubtitle: { ...T.body, color: C.sub, marginBottom: 20 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  categoryTile: {
    width: '47%',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  categoryTileActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryBg,
  },
  categoryTileIcon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: C.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  categoryTileIconActive: { backgroundColor: C.primary },
  categoryLabel: { ...T.sm, ...T.medium, color: C.sub, textAlign: 'center' },
  categoryLabelActive: { color: C.primary, fontWeight: '700' },
  fieldLabel: {
    ...T.sm,
    ...T.semibold,
    color: C.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    ...T.body,
    color: C.ink,
    minHeight: 110,
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  charCount: { ...T.xs, color: C.muted, marginLeft: 'auto' },
  charCountWarn: { color: C.red },
  charWarning: { ...T.xs, color: C.red },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...T.body,
    color: C.ink,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
  },
  photoLabel: { fontSize: 14, color: C.gold, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  chipActive: { borderColor: C.gold, backgroundColor: C.goldBg },
  chipText: { ...T.sm, ...T.medium, color: C.sub },
  chipTextActive: { color: C.gold },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  timeCardActive: { borderColor: C.gold, backgroundColor: C.goldBg },
  timeCardIcon: { width: 36, alignItems: 'center' },
  timeCardText: { flex: 1 },
  timeCardTitle: { ...T.base, ...T.semibold, color: C.ink },
  timeCardTitleActive: { color: C.gold },
  timeCardSubtitle: { ...T.sm, color: C.sub, marginTop: 2 },
  amberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.amberBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  amberBadgeText: { fontSize: 11, color: C.amber, fontWeight: '600' },
  feeNote: { ...T.xs, color: C.muted, marginTop: 8, marginBottom: 20 },
  summaryCard: {
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: { ...T.base, ...T.bold, color: C.ink, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { ...T.sm, color: C.sub, flex: 1 },
  summaryValue: { ...T.sm, ...T.medium, color: C.ink, flex: 2, textAlign: 'right' },
  summaryNote: { ...T.caption, color: C.sub, marginTop: 8, fontStyle: 'italic' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { flex: 1, ...T.sm, color: C.sub },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  loginHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  loginHintText: { flex: 1, fontSize: 12, color: C.primary, lineHeight: 17, fontWeight: '500' },
  btnPrimary: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnPrimaryText: { color: C.surface, fontSize: 16, fontWeight: '700' },
  btnGreen: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnGreenText: { color: C.surface, fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnOutlineText: { color: C.ink, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
  contentErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.redBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  contentErrorText: { flex: 1, fontSize: 12, color: C.red, lineHeight: 17 },
  meisterBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  meisterBannerTitle: { fontSize: 13, fontWeight: '700', color: C.amber, marginBottom: 3 },
  meisterBannerText: { fontSize: 12, color: C.amber, lineHeight: 17 },
  nbHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBd,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  nbHintText: { flex: 1, fontSize: 12, color: C.primary, lineHeight: 17 },
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 16,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successHeading: {
    ...T['2xl'],
    ...T.bold,
    color: C.ink,
    textAlign: 'center',
  },
  successBody: {
    ...T.base,
    color: C.sub,
    textAlign: 'center',
  },
  refChip: {
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 4,
  },
  refText: { fontSize: 14, color: C.gold, fontWeight: '700' },
});
