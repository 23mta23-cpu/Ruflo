import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { C } from '../constants/colors';
import { servicegebuehrKurz } from '../lib/preisHinweis';
import { shadow } from '../constants/theme';
import { categoryById } from '../data/categories';
import { showAlert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { mitZeitgrenze } from '../lib/retry';
import { NichtGefunden } from '../components/ui/NichtGefunden';
import { T } from '../constants/typography';
// Öffentliche Anbieter-Sicht (View provider_public, Migration 0560): nur
// unbedenkliche Felder + has_*-Flags statt sensibler Werte.
type ProviderPublic = {
  id: string;
  business_name: string | null;
  bio: string | null;
  category_ids: string[];
  trade_id: string | null;
  radius_km: number | null;
  min_hourly_rate: number | null;
  available: boolean;
  is_nachbarschaft: boolean;
  is_pro: boolean;
  kyc_status: string | null;
  meister_verified: boolean;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  has_steuer_id: boolean;
  // Die Ansicht provider_public (0560) liefert diese beiden seit jeher; der
  // Bildschirm hat sie nur nie gelesen und stattdessen `kycApproved` fuer
  // ALLES benutzt — auch fuer ein Abzeichen „Haftpflicht", das es gar nicht
  // gibt.
  has_gewerbeschein: boolean;
  has_meisterbrief: boolean;
};
import { trackEvent, trackError } from '../lib/analytics';
import { toast } from '../components/ui/Toast';

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  job_title: string | null;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={C.gold}
        />
      ))}
    </View>
  );
}

function VerifiedBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.badge, ok ? styles.badgeOk : styles.badgeMissing]}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={13}
        color={ok ? C.primary : C.muted}
      />
      <Text style={[styles.badgeText, !ok && { color: C.muted }]}>{label}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

/**
 * Eine Kachel in der Handlungsreihe (Design-Entscheidung A2, 14.09.2026).
 *
 * Gleich breit, mit Wort, mit mindestens 44 px Hoehe. Vorher standen zwei
 * dieser Handlungen als blosse 22-px-Symbole in der Kopfzeile, ohne
 * Beschriftung und ohne Zielflaeche.
 */
function ProfilAktion({ icon, label, onPress, farbe = C.ink }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  farbe?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.aktion}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={19} color={farbe} />
      <Text style={styles.aktionText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AnbieterProfilScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [bookmarkd, setBookmarked] = useState(false);
  // Zum Springen auf die Bewertungen (Handlungsreihe unter dem Kopfbereich).
  const scrollRef = useRef<ScrollView>(null);
  const bewertungenY = useRef(0);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderPublic | null>(null);
  const [ladefehler, setLadefehler] = useState(false);
  const [versuch, setVersuch] = useState(0);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [allReviewsLoaded, setAllReviewsLoaded] = useState(false);
  const [loadingAllReviews, setLoadingAllReviews] = useState(false);

  useEffect(() => { trackEvent('provider_profile_view'); }, []);

  async function loadAllReviews() {
    if (!id || loadingAllReviews) return;
    setLoadingAllReviews(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name), contract:contracts!contract_id(job:jobs!job_id(title))')
        .eq('reviewed_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setReviews((data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name: r.reviewer?.full_name ?? null,
        job_title: r.contract?.job?.title ?? null,
      })));
      setAllReviewsLoaded(true);
    } catch {
      trackError('reviews_load_all');
      showAlert('Fehler', 'Bewertungen konnten nicht geladen werden. Bitte später erneut versuchen.');
    } finally {
      setLoadingAllReviews(false);
    }
  }

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    setLadefehler(false);

    async function load() {
      try {
      // ZEITGRENZE (Befund 06.09.2026, Kalt-Durchlauf aller Bildschirme):
      // Dieser Bildschirm ist oeffentlich — er fragt sofort ab, statt wie die
      // uebrigen erst die Anmeldung zu verlangen. Antwortet die Gegenstelle
      // nicht (Funkloch, Aufzug, Hotel-WLAN mit Anmeldeseite), dann loest
      // dieses `await` NIE auf: supabase-js hat keine eingebaute Zeitgrenze,
      // `finally` wird nie erreicht, `loading` bleibt fuer immer true. Gemessen
      // wurde eine vollstaendig weisse Flaeche mit 1 Zeichen Text — nach 11
      // Sekunden immer noch. Ein Ladekreis ohne Text sieht aus wie ein Absturz.
      // Gleiche Ursache und gleiche Loesung wie am 16.08. bei /rechnung und
      // /vertrag.
      const [profileRes, reviewsRes, contractsRes] = await mitZeitgrenze(Promise.all([
        supabase
          .from('provider_public')
          .select('id, business_name, bio, category_ids, trade_id, radius_km, min_hourly_rate, available, is_nachbarschaft, is_pro, kyc_status, meister_verified, rating_avg, rating_count, created_at, has_steuer_id, has_gewerbeschein, has_meisterbrief')
          .eq('id', id)
          .maybeSingle(),

        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name), contract:contracts!contract_id(job:jobs!job_id(title))')
          .eq('reviewed_id', id)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', id)
          .eq('status', 'completed'),
      ])) ?? [];

      // Die Zeitgrenze lieferte nichts. Das ist NICHT „nicht gefunden" — der
      // Anbieter existiert womoeglich, nur die Leitung schwieg. Diesen
      // Unterschied stehen zu lassen waere derselbe Fehler, den der
      // catch-Block unten schon einmal beheben musste.
      if (!profileRes) {
        setLadefehler(true);
        return;
      }

      setProvider(profileRes.data ?? null);

      const mapped: ReviewRow[] = (reviewsRes?.data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name: r.reviewer?.full_name ?? null,
        job_title: r.contract?.job?.title ?? null,
      }));
      setReviews(mapped);
      setCompletedCount(contractsRes?.count ?? 0);
      } catch {
        setLadefehler(true);
        // Netzfehler sichtbar melden — sonst erscheint er ununterscheidbar als
        // „Anbieter nicht gefunden", obwohl der Anbieter existiert (Befund
        // Senior-Test-Expert-Audit).
        trackError('provider_load');
        toast.error('Anbieter konnte nicht geladen werden, bitte erneut versuchen');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, versuch]);

  async function handleShare() {
    if (!provider) return;
    try {
      await Share.share({
        message: `${provider.business_name ?? 'Anbieter'} auf Werkant: ${provider.trade_id ? (categoryById(provider.trade_id)?.name ?? provider.trade_id) : ''}, ${(provider.rating_avg ?? 0).toFixed(1)}★ (${provider.rating_count} Bewertungen)`,
      });
    } catch {
      // Share cancelled
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.primary} />
          {/* Der Ladekreis allein ergab eine weisse Flaeche mit 1 Zeichen
              Text — nicht unterscheidbar von einem Absturz. Wer nicht weiss,
              ob geladen wird oder etwas kaputt ist, wartet nicht, sondern
              geht. */}
          <Text style={{ ...T.body, color: C.sub }}>Profil wird geladen …</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (ladefehler) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <NichtGefunden
          titel="Profil konnte nicht geladen werden"
          text="Die Verbindung kam nicht zustande. Der Anbieter ist deshalb nicht zwingend weg, bitte noch einmal versuchen."
          knopf="Erneut versuchen"
          onKnopf={() => setVersuch((v) => v + 1)}
        />
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="person-outline" size={48} color={C.border} />
          <Text style={{ fontSize: 16, color: C.muted, marginTop: 12, textAlign: 'center' }}>
            Anbieter nicht gefunden.
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => safeBack(router)} style={{ marginTop: 20 }}>
            <Text style={{ color: C.primary, fontWeight: '600' }}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (provider.business_name ?? '??')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sinceYear = new Date(provider.created_at).getFullYear();
  const kycApproved = provider.kyc_status === 'approved';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        {/* Merken und Teilen standen hier als 22-px-Symbole ohne Beschriftung
            und ohne 44-px-Ziel (Founder-Befund „Kacheln zu klein", und
            WCAG 2.5.8). Sie stehen jetzt in der Handlungsreihe unter dem
            Kopfbereich, mit Wort und mit Flaeche. */}
        <View style={{ width: 44 }} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Double-Bezel hero card: outer tinted shell → inner white card */}
        <View style={styles.heroOuter}>
          <View style={styles.heroInner}>
            {/* Avatar + name */}
            <View style={styles.profileBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.name}>{provider.business_name ?? 'Anbieter'}</Text>

              <View style={styles.tradeRow}>
                <View style={styles.tradeBadge}>
                  <Ionicons name="construct-outline" size={13} color={C.sub} />
                  <Text style={styles.tradeText}>{provider.trade_id ? (categoryById(provider.trade_id)?.name ?? provider.trade_id) : 'Handwerk'}</Text>
                </View>
                {provider.meister_verified && (
                  <View style={styles.meisterBadge}>
                    <Ionicons name="ribbon" size={12} color={C.gold} />
                    <Text style={styles.meisterText}>Meisterbetrieb</Text>
                  </View>
                )}
                {provider.is_pro && (
                  <View style={styles.proBadge}>
                    <Ionicons name="star" size={12} color={C.surface} />
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                )}
              </View>

              {/* Rating-Lockup: die große Zahl als Vertrauens-Moment
                  (Airbnb-Referenz, .claude/design-references/airbnb) */}
              {provider.rating_count > 0 ? (
                <View style={styles.ratingLockup}>
                  <Text style={styles.ratingBig}>{(provider.rating_avg ?? 0).toFixed(1)}</Text>
                  <View style={styles.ratingLockupRight}>
                    <Stars rating={provider.rating_avg} size={14} />
                    <Text style={styles.ratingCount}>{provider.rating_count} verifizierte Bewertungen</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.newBadge}>
                  <Ionicons name="sparkles-outline" size={13} color={C.primary} />
                  <Text style={styles.newBadgeText}>Neu auf Werkant · frisch verifiziert</Text>
                </View>
              )}
            </View>

            {/* Stats strip — inside the hero card */}
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedCount}</Text>
                <Text style={styles.statLabel}>Aufträge</Text>
              </View>
              {/* Hier stand fest verdrahtet „~30 Min. Antwortzeit" — fuer JEDEN
                  Betrieb, ohne dass irgendwo eine Antwortzeit gemessen wird.
                  Entfernt statt geschaetzt: eine erfundene Zahl ueber die
                  Erreichbarkeit eines Handwerkers ist eine Zusage. */}
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>Seit {sinceYear}</Text>
                <Text style={styles.statLabel}>Auf Werkant</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{provider.available ? 'Offen' : 'Belegt'}</Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Handlungsreihe — Design-Entscheidung A2 (14.09.2026).
            Bewusst NICHT „Anfragen": das ist der klebende Knopf unten, und
            zwei Wege zum selben Ziel haben hier schon einmal verwirrt (siehe
            Kommentar an der CTA-Leiste). Bewusst auch kein „Anrufen" und kein
            „Zuletzt gesehen": eine Telefonnummer vor dem Vertragsschluss ist
            genau das, was AGB §7 verhindern soll, und Anwesenheitsdaten haben
            hier keinen Zweck (Art. 5 Abs. 1 lit. c DSGVO). */}
        <View style={styles.aktionsReihe}>
          <ProfilAktion
            icon={bookmarkd ? 'bookmark' : 'bookmark-outline'}
            farbe={bookmarkd ? C.gold : C.ink}
            label={bookmarkd ? 'Gemerkt' : 'Merken'}
            onPress={() => setBookmarked((b) => !b)}
          />
          <ProfilAktion icon="share-outline" label="Teilen" onPress={handleShare} />
          {provider.rating_count > 0 && (
            <ProfilAktion
              icon="star-outline"
              label="Bewertungen"
              onPress={() => scrollRef.current?.scrollTo({ y: bewertungenY.current, animated: true })}
            />
          )}
          {/* Art. 16 DSA verlangt einen leicht zugaenglichen Meldeweg UND eine
              genaue Angabe des Speicherorts. `app/melden.tsx` nimmt Art und
              Fundstelle seit jeher als Parameter entgegen — nur hat sie ihm
              nie jemand uebergeben, und erreichbar war er allein ueber das
              Impressum. Der Nutzer musste die Adresse selbst zusammensuchen. */}
          <ProfilAktion
            icon="flag-outline"
            label="Melden"
            onPress={() => router.push({
              pathname: '/melden',
              params: {
                art: 'profil',
                id: id ?? '',
                fundstelle: `Anbieterprofil „${provider.business_name ?? 'ohne Namen'}" (${id ?? 'ohne Kennung'})`,
              },
            })}
          />
        </View>

        {/* Verification strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verifizierung</Text>
          {/* „Haftpflicht" stand hier bis 14.09.2026 mit gruenem Haken, gebunden
              an kycApproved. Das Wort kam im GANZEN Code genau zweimal vor, und
              beide Male war es eine Behauptung gegenueber dem Kunden: es gibt
              keine Spalte, kein Feld im Onboarding, keinen Upload und keine
              Pruefung fuer eine Betriebshaftpflicht. Werkant hat noch nie eine
              Police gesehen.
              Ein Kunde laesst einen Fremden in seine Wohnung, weil dort ein
              Haken steht. Dieselbe Klasse wie der erfundene Stundensatz
              (`?? 13`), aber mit schwererer Folge. § 5 UWG.
              Die Abzeichen haengen jetzt an den Feldern, die provider_public
              wirklich liefert (0560). */}
          <View style={styles.badgeRow}>
            <VerifiedBadge label="Gewerbeschein" ok={kycApproved && provider.has_gewerbeschein === true} />
            <VerifiedBadge label="Steuer-ID"     ok={provider.has_steuer_id === true} />
            {provider.meister_verified && (
              <VerifiedBadge label="Meisterbrief" ok={true} />
            )}
          </View>
          <Text style={styles.verifyNote}>
            Dokumente wurden von Werkant einmalig geprüft. Werkant ist Vermittler. Die Verantwortung für die Leistung liegt beim Anbieter.
          </Text>
        </View>

        {/* Leistungen & Konditionen — echte Anbieter-Daten, keine Plattform-Preise */}
        {(provider.category_ids?.length > 0 || provider.min_hourly_rate || provider.radius_km) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leistungen</Text>
            {provider.category_ids?.length > 0 && (
              <View style={styles.serviceChips}>
                {provider.category_ids.map((cid) => (
                  <View key={cid} style={styles.serviceChip}>
                    <Text style={styles.serviceChipText}>{categoryById(cid)?.name ?? cid}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.condRow}>
              {provider.min_hourly_rate ? (
                <View style={styles.condItem}>
                  <Ionicons name="cash-outline" size={15} color={C.sub} />
                  <Text style={styles.condText}>Stundensatz ab €{provider.min_hourly_rate}</Text>
                </View>
              ) : null}
              {provider.radius_km ? (
                <View style={styles.condItem}>
                  <Ionicons name="navigate-outline" size={15} color={C.sub} />
                  <Text style={styles.condText}>Einsatzradius {provider.radius_km} km</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.priceNote}>
              Der Preis für Ihren Auftrag ergibt sich aus dem individuellen Angebot des Anbieters.
            </Text>
          </View>
        )}

        {/* About */}
        {provider.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Über uns</Text>
            <Text style={styles.bioText}>{provider.bio}</Text>
          </View>
        ) : null}

        {/* Reviews */}
        <View
          style={styles.section}
          // Ohne dieses onLayout spraenge die Kachel „Bewertungen" auf 0 und
          // taete sichtbar nichts. Ein Knopf, der aussieht, als wirke er, und
          // nicht wirkt, ist dieselbe Klasse wie ein Knopf ohne onPress.
          onLayout={(e) => { bewertungenY.current = e.nativeEvent.layout.y; }}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kundenbewertungen</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Stars rating={provider.rating_avg} />
              <Text style={styles.reviewSummary}>{(provider.rating_avg ?? 0).toFixed(1)}</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <Text style={{ fontSize: 13, color: C.muted, paddingBottom: 8 }}>Noch keine Bewertungen.</Text>
          ) : (
            reviews.map((r) => {
              const authorName = r.reviewer_name ?? 'Anonym';
              const dateStr = new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerInitial}>{authorName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewerName}>{authorName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Stars rating={r.rating} />
                        <Text style={styles.reviewDate}>{dateStr}</Text>
                      </View>
                    </View>
                    {r.job_title ? (
                      <View style={styles.reviewService}>
                        <Text style={styles.reviewServiceText} numberOfLines={1}>{r.job_title}</Text>
                      </View>
                    ) : null}
                  </View>
                  {r.comment ? (
                    <Text style={styles.reviewText}>{r.comment}</Text>
                  ) : null}
                </View>
              );
            })
          )}

          {provider.rating_count > 5 && !allReviewsLoaded && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.allReviewsBtn}
              onPress={loadAllReviews}
              activeOpacity={0.75}
              disabled={loadingAllReviews}
            >
              {loadingAllReviews ? (
                <ActivityIndicator size="small" color={C.gold} />
              ) : (
                <>
                  <Text style={styles.allReviewsBtnText}>Alle {provider.rating_count} Bewertungen anzeigen</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.gold} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaWrap}>
        {/* Ein CTA statt zwei identischer Ziele — 'Nachricht' führte zum
            selben Wizard und stiftete nur Verwirrung */}
        <View style={styles.ctaBar}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.ctaPrimary}
            onPress={() => router.push({ pathname: '/auftrag-aufgeben', params: { providerId: id ?? '' } })}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaPrimaryText}>Unverbindliche Anfrage stellen</Text>
            <Ionicons name="arrow-forward" size={18} color={C.surface} />
          </TouchableOpacity>
        </View>
        <Text style={styles.ctaFeeNote}>{servicegebuehrKurz()}, im Checkout ausgewiesen</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.bg },

  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerActions:      { flexDirection: 'row', alignItems: 'center' },

  scroll:             { paddingBottom: 24 },

  // Double-Bezel hero: outer tinted shell with primary border, inner white card
  heroOuter:          { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, backgroundColor: C.primaryBg, borderWidth: 1.5, borderColor: C.primaryBd, padding: 6, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  heroInner:          { borderRadius: 13, backgroundColor: C.surface, overflow: 'hidden' },

  profileBlock:       { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatar:             { width: 84, height: 84, borderRadius: 42, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:         { fontSize: 28, fontWeight: '700', color: C.surface },
  name:               { fontSize: 22, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 10 },
  tradeRow:           { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' },
  tradeBadge:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tradeText:          { fontSize: 13, color: C.sub, fontWeight: '500' },
  meisterBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  meisterText:        { fontSize: 12, color: C.gold, fontWeight: '700' },
  proBadge:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  proText:            { fontSize: 12, color: C.surface, fontWeight: '700', letterSpacing: 0.5 },
  ratingLockup:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  ratingBig:          { fontSize: 34, fontWeight: '700', color: C.ink, letterSpacing: -1 },
  ratingLockupRight:  { gap: 3 },
  ratingCount:        { fontSize: 12, color: C.sub },
  newBadge:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryBg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  newBadgeText:       { fontSize: 12, fontWeight: '600', color: C.primary },
  serviceChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  serviceChip:        { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  serviceChipText:    { fontSize: 12.5, fontWeight: '600', color: C.ink },
  condRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 4 },
  condItem:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  condText:           { fontSize: 13, color: C.sub, fontWeight: '500' },

  statsStrip:         { flexDirection: 'row', borderTopWidth: 1, borderColor: C.border },
  statItem:           { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue:          { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  statLabel:          { fontSize: 11, color: C.muted },
  statDivider:        { width: 1, backgroundColor: C.border },

  // Handlungsreihe unter der Kopfkarte (A2, 14.09.2026)
  // Die Masse sind GEMESSEN, nicht geschaetzt (scripts/kachel-text-check.cjs).
  // Mit gap 8, paddingHorizontal 4 und 11,5 px war „Bewertungen" 73 px breit
  // und die Kachel bei 375 px nur 69, bei 360 px nur 66 — der Text war auf
  // beiden verbreiteten Geraetebreiten abgeschnitten.
  //
  // rand-ueberstand-check.cjs meldete dabei GRUEN: numberOfLines={1} kuerzt
  // INNERHALB der Kachel, es laeuft nichts ueber den Rand. Dieselbe Blindheit
  // wie am 07.09. bei der Reiter-Leiste, nur eine Ebene tiefer.
  aktionsReihe:       { flexDirection: 'row', gap: 6, marginHorizontal: 16, marginTop: 4, marginBottom: 4 },
  aktion:             { flex: 1, minWidth: 0, minHeight: 60, alignItems: 'center', justifyContent: 'center',
                        gap: 5, paddingVertical: 10, paddingHorizontal: 2,
                        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14 },
  aktionText:         { fontSize: 11, fontWeight: '700', color: C.sub },

  section:            { marginTop: 8, backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, padding: 20 },
  sectionTitle:       { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 14 },
  sectionHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },

  badgeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeOk:            { backgroundColor: C.primaryBg, borderColor: C.primary },
  badgeMissing:       { backgroundColor: C.bg, borderColor: C.border },
  badgeText:          { fontSize: 12, fontWeight: '600', color: C.primary },
  verifyNote:         { fontSize: 11, color: C.muted, lineHeight: 16 },

  rateRange:          { fontSize: 14, fontWeight: '700', color: C.gold },
  serviceRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  serviceName:        { flex: 1, fontSize: 13, color: C.ink },
  servicePrice:       { fontSize: 13, fontWeight: '600', color: C.sub },
  priceNote:          { fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 16 },

  bioText:            { fontSize: 14, color: C.sub, lineHeight: 21 },

  reviewSummary:      { fontSize: 14, fontWeight: '700', color: C.ink },
  reviewCard:         { ...shadow.sm,  backgroundColor: C.bg, borderRadius: 16, padding: 14, marginBottom: 10 },
  reviewHeader:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reviewerAvatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reviewerInitial:    { fontSize: 14, fontWeight: '700', color: C.sub },
  reviewerName:       { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 2 },
  reviewDate:         { fontSize: 11, color: C.muted },
  reviewService:      { backgroundColor: C.goldBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 100 },
  reviewServiceText:  { fontSize: 10, fontWeight: '600', color: C.gold },
  reviewText:         { fontSize: 13, color: C.sub, lineHeight: 19 },
  allReviewsBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, marginTop: 4 },
  allReviewsBtnText:  { fontSize: 14, color: C.gold, fontWeight: '600' },

  ctaWrap:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 28 },
  ctaBar:             { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  ctaFeeNote:         { textAlign: 'center', fontSize: 10, color: C.muted, paddingBottom: 4 },
  ctaPrimary:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14 },
  ctaPrimaryText:     { fontSize: 15, fontWeight: '700', color: C.surface },
});
