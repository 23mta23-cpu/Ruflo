import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

interface Provider {
  id: string;
  initials: string;
  name: string;
  service: string;
  lastJob: string;
  rating: number;
  jobCount: number;
}

const STAMMKUNDEN: Provider[] = [
  { id: '1', initials: 'YG', name: 'Yilmaz GmbH',    service: 'Heizung & Sanitär', lastJob: 'vor 3 Wochen', rating: 4.9, jobCount: 7 },
  { id: '2', initials: 'MS', name: 'M. Schmidt',      service: 'Elektro',           lastJob: 'vor 2 Mo.',    rating: 4.7, jobCount: 3 },
  { id: '3', initials: 'TK', name: 'T. Kunz',         service: 'Nachbarschaft',     lastJob: 'vor 1 Mo.',    rating: 5.0, jobCount: 5 },
];

export function StammkundenRow() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="heart" size={16} color={C.gold} />
          <Text style={styles.title}>Meine Stammkunden</Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.seeAll}>Alle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {STAMMKUNDEN.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => router.push('/profil')}
            activeOpacity={0.8}
          >
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{p.initials}</Text>
              </View>
              <View style={styles.jobBadge}>
                <Text style={styles.jobBadgeText}>{p.jobCount}×</Text>
              </View>
            </View>

            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.service} numberOfLines={1}>{p.service}</Text>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={10} color={C.gold} />
              <Text style={styles.ratingText}>{p.rating}</Text>
            </View>

            <Text style={styles.lastJob}>{p.lastJob}</Text>

            <TouchableOpacity
              style={styles.rebookBtn}
              onPress={() => router.push('/chat')}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={12} color={C.surface} />
              <Text style={styles.rebookText}>Wieder buchen</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add new */}
        <TouchableOpacity
          style={styles.addCard}
          onPress={() => router.push('/(tabs)/')}
          activeOpacity={0.7}
        >
          <View style={styles.addIcon}>
            <Ionicons name="add" size={22} color={C.muted} />
          </View>
          <Text style={styles.addText}>Neuen{'\n'}Anbieter{'\n'}finden</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { marginBottom: 24 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:        { fontSize: 17, fontWeight: '700', color: C.ink },
  seeAll:       { fontSize: 13, color: C.muted, fontWeight: '500' },
  scroll:       { paddingLeft: 20, paddingRight: 8, gap: 12 },
  card:         { width: 130, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center' },
  avatarWrap:   { position: 'relative', marginBottom: 10 },
  avatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.gold },
  avatarText:   { fontSize: 16, fontWeight: '800', color: C.gold },
  jobBadge:     { position: 'absolute', bottom: -4, right: -4, backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 2, borderColor: C.surface },
  jobBadgeText: { fontSize: 9, fontWeight: '800', color: C.surface },
  name:         { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 2, textAlign: 'center' },
  service:      { fontSize: 11, color: C.muted, marginBottom: 6, textAlign: 'center' },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  ratingText:   { fontSize: 11, fontWeight: '600', color: C.gold },
  lastJob:      { fontSize: 10, color: C.muted, marginBottom: 10, textAlign: 'center' },
  rebookBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, width: '100%', justifyContent: 'center' },
  rebookText:   { fontSize: 11, fontWeight: '700', color: C.surface },
  addCard:      { width: 100, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  addIcon:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  addText:      { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16 },
});
