import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = 'alle' | 'sanitaer' | 'elektro' | 'montage' | 'reinigung' | 'garten' | 'umzug';

type InstantService = {
  id: string;
  category: Category;
  icon: string;
  title: string;
  desc: string;
  price: number;
  duration: string;
  popular?: boolean;
  new?: boolean;
};

// ── Data ───────────────────────────────────────────────────────────────────────

const SERVICES: InstantService[] = [
  {
    id: 's1',
    category: 'sanitaer',
    icon: 'water-outline',
    title: 'Wasserhahn tauschen',
    desc: 'Incl. Material & Abdichtung. 1 Einhebelmischer Standard.',
    price: 120,
    duration: '60 Min.',
    popular: true,
  },
  {
    id: 's2',
    category: 'sanitaer',
    icon: 'thermometer-outline',
    title: 'Heizkörper-Thermostat (1×)',
    desc: 'Thermostat demontieren, neues Ventil einbauen, Funktion prüfen.',
    price: 89,
    duration: '45 Min.',
    popular: true,
  },
  {
    id: 's3',
    category: 'sanitaer',
    icon: 'fitness-outline',
    title: 'Abfluss reinigen',
    desc: 'Chemisch-mechanische Reinigung eines verstopften Abflusses.',
    price: 75,
    duration: '30 Min.',
  },
  {
    id: 's4',
    category: 'elektro',
    icon: 'flash-outline',
    title: 'Steckdose / Schalter tauschen',
    desc: 'Unterputz, inkl. Abklemmung. Ohne Leitungsverlegung.',
    price: 65,
    duration: '30 Min.',
  },
  {
    id: 's5',
    category: 'elektro',
    icon: 'bulb-outline',
    title: 'Leuchtmittel wechseln (10×)',
    desc: 'Bis 3 m Höhe ohne Gerüst. Inkl. LED-Leuchtmittel.',
    price: 49,
    duration: '30 Min.',
    new: true,
  },
  {
    id: 's6',
    category: 'elektro',
    icon: 'wifi-outline',
    title: 'Router / Netzwerk einrichten',
    desc: 'Einrichtung inkl. WLAN-Optimierung. Bis 1 Stunde.',
    price: 59,
    duration: '60 Min.',
  },
  {
    id: 's7',
    category: 'montage',
    icon: 'cube-outline',
    title: 'IKEA-Möbel aufbauen (1 Teil)',
    desc: 'PAX, KALLAX, BILLY o.ä. bis 2 m Breite.',
    price: 49,
    duration: '60 Min.',
    popular: true,
  },
  {
    id: 's8',
    category: 'montage',
    icon: 'home-outline',
    title: 'Türschloss tauschen',
    desc: 'Profilzylinder inkl. 3 Schlüssel. Ohne Bohrarbeit.',
    price: 149,
    duration: '45 Min.',
  },
  {
    id: 's9',
    category: 'montage',
    icon: 'tv-outline',
    title: 'TV-Wandhalterung montieren',
    desc: 'Bis 65 Zoll, inkl. Bohren & Kabelkanal.',
    price: 79,
    duration: '60 Min.',
    new: true,
  },
  {
    id: 's10',
    category: 'reinigung',
    icon: 'sparkles-outline',
    title: 'Grundreinigung (3 Zimmer)',
    desc: 'Küche, Bad, 1 Zimmer. Fenster nicht inkl.',
    price: 129,
    duration: '3–4 Std.',
    popular: true,
  },
  {
    id: 's11',
    category: 'reinigung',
    icon: 'window-outline',
    title: 'Fenster putzen (10 Scheiben)',
    desc: 'Innen & Außen. Bis EG / 1.OG.',
    price: 69,
    duration: '90 Min.',
  },
  {
    id: 's12',
    category: 'garten',
    icon: 'leaf-outline',
    title: 'Rasenmähen (bis 200 m²)',
    desc: 'Inkl. Kantenschneiden & Grünabfuhr.',
    price: 39,
    duration: '60 Min.',
    popular: true,
  },
  {
    id: 's13',
    category: 'garten',
    icon: 'cut-outline',
    title: 'Heckenschneiden (10 m)',
    desc: 'Gleichmäßig, inkl. Schnittgut-Entsorgung.',
    price: 59,
    duration: '90 Min.',
  },
  {
    id: 's14',
    category: 'umzug',
    icon: 'cube-outline',
    title: 'Umzugshilfe (2 Stunden)',
    desc: '1 Helfer, Ort egal (Köln). Eigenes Fahrzeug nötig.',
    price: 79,
    duration: '2 Std.',
    new: true,
  },
];

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'alle',      label: 'Alle',       icon: 'apps-outline' },
  { id: 'sanitaer',  label: 'Sanitär',    icon: 'water-outline' },
  { id: 'elektro',   label: 'Elektro',    icon: 'flash-outline' },
  { id: 'montage',   label: 'Montage',    icon: 'construct-outline' },
  { id: 'reinigung', label: 'Reinigung',  icon: 'sparkles-outline' },
  { id: 'garten',    label: 'Garten',     icon: 'leaf-outline' },
  { id: 'umzug',     label: 'Umzug',      icon: 'car-outline' },
];

const PLATFORM_FEE = 0.025;

// ── Main screen ────────────────────────────────────────────────────────────────

export default function InstantPreiseScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category>('alle');
  const [selected, setSelected] = useState<InstantService | null>(null);

  const visible = activeCategory === 'alle'
    ? SERVICES
    : SERVICES.filter((s) => s.category === activeCategory);

  if (selected) {
    const fee   = parseFloat((selected.price * PLATFORM_FEE).toFixed(2));
    const total = selected.price + fee;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sofort buchen</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {/* Service card */}
          <View style={styles.detailCard}>
            <View style={styles.detailIconWrap}>
              <Ionicons name={selected.icon as any} size={32} color={C.primary} />
            </View>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <Text style={styles.detailDesc}>{selected.desc}</Text>
            <View style={styles.detailMeta}>
              <View style={styles.detailMetaChip}>
                <Ionicons name="time-outline" size={13} color={C.sub} />
                <Text style={styles.detailMetaText}>{selected.duration}</Text>
              </View>
              <View style={styles.detailMetaChip}>
                <Ionicons name="shield-checkmark-outline" size={13} color={C.primary} />
                <Text style={[styles.detailMetaText, { color: C.primary }]}>WERKR Garantie</Text>
              </View>
            </View>
          </View>

          {/* Price breakdown */}
          <View style={styles.priceBox}>
            <Text style={styles.priceBoxTitle}>Preisübersicht</Text>
            <PriceRow label="Festpreis (Handwerker)" value={`€${selected.price.toFixed(2).replace('.', ',')}`} />
            <PriceRow label={`WERKR Service-Gebühr (2,5%)`} value={`+ €${fee.toFixed(2).replace('.', ',')}`} muted />
            <View style={styles.priceDivider} />
            <PriceRow label="Gesamtbetrag" value={`€${total.toFixed(2).replace('.', ',')}`} bold />
            <Text style={styles.priceNote}>Festpreis inkl. Anfahrt. Kein Nachschlag nach Auftragsstart.</Text>
          </View>

          {/* How instant booking works */}
          <View style={styles.howBox}>
            <Text style={styles.howTitle}>Wie funktioniert Sofort-Buchen?</Text>
            <HowStep num="1" label="Termin wählen" sub="Sie wählen Datum & Uhrzeit." />
            <HowStep num="2" label="Zahlung absichern" sub="Betrag wird in Escrow gesperrt." />
            <HowStep num="3" label="Handwerker kommt" sub="Verifizierter Profi erscheint pünktlich." />
            <HowStep num="4" label="Freigabe & fertig" sub="Ihr OK → Auszahlung an den Anbieter." />
          </View>
        </ScrollView>

        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push({
              pathname: '/zahlung',
              params: { jobTitle: selected.title, basePrice: String(selected.price) },
            })}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={18} color={C.surface} />
            <Text style={styles.ctaBtnText}>Jetzt sofort buchen — €{total.toFixed(2).replace('.', ',')}</Text>
          </TouchableOpacity>
          <Text style={styles.ctaHint}>Escrow-gesichert · Kostenlos stornierbar bis 24h vorher</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sofort-Festpreise</Text>
          <Text style={styles.headerSub}>Buchen ohne Angebot — Preis ist Preis</Text>
        </View>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.75}
            >
              <Ionicons name={cat.icon as any} size={14} color={active ? C.surface : C.sub} />
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Services list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {visible.map((s) => {
          const fee   = parseFloat((s.price * PLATFORM_FEE).toFixed(2));
          const total = s.price + fee;

          return (
            <TouchableOpacity
              key={s.id}
              style={styles.card}
              onPress={() => setSelected(s)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View style={styles.cardIcon}>
                  <Ionicons name={s.icon as any} size={22} color={C.primary} />
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{s.title}</Text>
                  {s.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Beliebt</Text>
                    </View>
                  )}
                  {s.new && !s.popular && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newText}>Neu</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>{s.desc}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="time-outline" size={12} color={C.muted} />
                  <Text style={styles.cardMetaText}>{s.duration}</Text>
                  <Text style={styles.cardMetaSep}>·</Text>
                  <Ionicons name="shield-checkmark-outline" size={12} color={C.primary} />
                  <Text style={[styles.cardMetaText, { color: C.primary }]}>Garantiert</Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={styles.cardPrice}>€{total.toFixed(0)}</Text>
                <Text style={styles.cardPriceSub}>inkl. Gebühr</Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function PriceRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: 13, color: muted ? C.muted : C.sub, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '800' : '600', color: bold ? C.ink : C.sub }}>{value}</Text>
    </View>
  );
}

function HowStep({ num, label, sub }: { num: string; label: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
      <View style={styles.howNum}>
        <Text style={styles.howNumText}>{num}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{label}</Text>
        <Text style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{sub}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },

  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 18, fontWeight: '700', color: C.ink },
  headerSub:      { fontSize: 12, color: C.sub, marginTop: 1 },

  catRow:         { paddingLeft: 20, paddingRight: 8, gap: 8, paddingBottom: 12 },
  catChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  catChipActive:  { backgroundColor: C.primary, borderColor: C.primary },
  catLabel:       { fontSize: 13, fontWeight: '600', color: C.sub },
  catLabelActive: { color: C.surface },

  list:           { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },

  card:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 },
  cardLeft:       { flexShrink: 0 },
  cardIcon:       { width: 48, height: 48, borderRadius: 14, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  cardBody:       { flex: 1, gap: 4 },
  cardTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle:      { fontSize: 14, fontWeight: '700', color: C.ink, flexShrink: 1 },
  popularBadge:   { backgroundColor: C.clayBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  popularText:    { fontSize: 10, fontWeight: '700', color: C.clay },
  newBadge:       { backgroundColor: C.primaryBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newText:        { fontSize: 10, fontWeight: '700', color: C.primary },
  cardDesc:       { fontSize: 12, color: C.sub, lineHeight: 17 },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText:   { fontSize: 11, color: C.muted },
  cardMetaSep:    { fontSize: 11, color: C.border, marginHorizontal: 2 },
  cardRight:      { alignItems: 'flex-end', flexShrink: 0 },
  cardPrice:      { fontSize: 17, fontWeight: '700', color: C.ink },
  cardPriceSub:   { fontSize: 10, color: C.muted },

  // Detail view
  detailCard:     { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  detailIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  detailTitle:    { fontSize: 20, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8 },
  detailDesc:     { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  detailMeta:     { flexDirection: 'row', gap: 10 },
  detailMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  detailMetaText: { fontSize: 12, fontWeight: '600', color: C.sub },

  priceBox:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14 },
  priceBoxTitle:  { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 12 },
  priceDivider:   { height: 1, backgroundColor: C.border, marginVertical: 8 },
  priceNote:      { fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 16 },

  howBox:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  howTitle:       { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 14 },
  howNum:         { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howNumText:     { fontSize: 13, fontWeight: '700', color: C.primary },

  ctaBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28, gap: 6 },
  ctaBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  ctaBtnText:     { fontSize: 15, fontWeight: '700', color: C.surface },
  ctaHint:        { fontSize: 11, color: C.muted, textAlign: 'center' },
});
