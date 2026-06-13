import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { showAlert } from '../../lib/alert';

// ── Types ─────────────────────────────────────────────────────────────────────

type SlotStatus = 'free' | 'booked' | 'blocked';

type DayAvailability = 'available' | 'busy' | 'off';

interface TimeSlot {
  hour: number;
  status: SlotStatus;
  label?: string;
}

interface DayChip {
  offsetIndex: number;
  shortName: string;
  dateNum: number;
  availability: DayAvailability;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GERMAN_DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const AVAILABLE_OFFSETS = new Set([0, 2, 4, 5, 6, 8, 9]);
const BUSY_OFFSETS = new Set([1, 3, 7]);

const DAY0_SLOTS: TimeSlot[] = [
  { hour: 8,  status: 'booked',  label: 'Familie K. · Heizungswartung' },
  { hour: 9,  status: 'booked',  label: 'Familie K. · Heizungswartung' },
  { hour: 10, status: 'free' },
  { hour: 11, status: 'free' },
  { hour: 12, status: 'blocked' },
  { hour: 13, status: 'booked',  label: 'Herr S. · Heizkörper' },
  { hour: 14, status: 'booked',  label: 'Herr S. · Heizkörper' },
  { hour: 15, status: 'free' },
  { hour: 16, status: 'free' },
  { hour: 17, status: 'free' },
  { hour: 18, status: 'blocked' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDayChips(weekOffset: number): DayChip[] {
  const base = new Date();
  base.setDate(base.getDate() + weekOffset * 7);

  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);

    const offset = weekOffset === 0 ? i : i + weekOffset * 7;

    let availability: DayAvailability = 'off';
    if (AVAILABLE_OFFSETS.has(i % 14)) availability = 'available';
    else if (BUSY_OFFSETS.has(i % 14)) availability = 'busy';

    return {
      offsetIndex: i,
      shortName: GERMAN_DAY_SHORT[d.getDay()],
      dateNum: d.getDate(),
      availability,
    };
  });
}

function buildSlotsForDay(dayIndex: number): TimeSlot[] {
  if (dayIndex === 0) return DAY0_SLOTS;
  return HOURS.map((h) => ({ hour: h, status: 'blocked' as SlotStatus }));
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function getAvailabilityDotColor(av: DayAvailability): string {
  if (av === 'available') return C.green;
  if (av === 'busy') return C.amber;
  return C.muted;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DayColumn({
  chip,
  isSelected,
  onPress,
}: {
  chip: DayChip;
  isSelected: boolean;
  onPress: () => void;
}) {
  const dotColor = getAvailabilityDotColor(chip.availability);

  return (
    <TouchableOpacity
      style={[styles.dayChip, isSelected && styles.dayChipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.dayShortName, isSelected && styles.dayTextSelected]}>
        {chip.shortName}
      </Text>
      <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>
        {String(chip.dateNum).padStart(2, '0')}
      </Text>
      <View style={[styles.availDot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : dotColor }]} />
    </TouchableOpacity>
  );
}

function SlotRow({
  slot,
  onFreePress,
  onBookedPress,
}: {
  slot: TimeSlot;
  onFreePress: (hour: number) => void;
  onBookedPress: () => void;
}) {
  const timeLabel = formatHour(slot.hour);

  if (slot.status === 'free') {
    return (
      <TouchableOpacity
        style={styles.slotFree}
        onPress={() => onFreePress(slot.hour)}
        activeOpacity={0.75}
      >
        <Text style={styles.slotTime}>{timeLabel}</Text>
        <View style={styles.slotContent}>
          <Text style={styles.slotFreeText}>Frei</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (slot.status === 'booked') {
    return (
      <TouchableOpacity
        style={styles.slotBooked}
        onPress={onBookedPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.slotTime, styles.slotTimeBooked]}>{timeLabel}</Text>
        <View style={styles.slotContent}>
          <Text style={styles.slotBookedLabel} numberOfLines={1}>
            {slot.label}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={C.amber} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.slotBlocked}>
      <Text style={styles.slotTimeBlocked}>{timeLabel}</Text>
      <View style={styles.slotContent}>
        <Text style={styles.slotBlockedText}>Blockiert</Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderKalenderScreen() {
  const router = useRouter();
  const stripRef = useRef<ScrollView>(null);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [todayAvailable, setTodayAvailable] = useState(true);

  const chips = buildDayChips(weekOffset);
  const slots = buildSlotsForDay(selectedDay);

  function handlePrevWeek() {
    if (weekOffset <= 0) return;
    setWeekOffset((w) => w - 1);
    setSelectedDay(0);
  }

  function handleNextWeek() {
    setWeekOffset((w) => w + 1);
    setSelectedDay(0);
    stripRef.current?.scrollTo({ x: 0, animated: false });
  }

  function handleToggleToday(value: boolean) {
    if (!value) {
      showAlert(
        'Heute deaktivieren?',
        'Sie werden heute nicht mehr für neue Anfragen angezeigt. Bestehende Buchungen bleiben bestehen.',
      );
    }
    setTodayAvailable(value);
  }

  function handleFreeSlot(hour: number) {
    showAlert(
      'Slot bearbeiten',
      'Hier können Sie Verfügbarkeit & Sperrzeiten verwalten. Kommt nach Backend-Integration.',
    );
  }

  function handleBookedSlot() {
    router.push('/chat');
  }

  const displayDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kalender</Text>
          <Text style={styles.subtitle}>{displayDate}</Text>
        </View>
      </View>

      {/* ── Heute verfügbar toggle ── */}
      <View style={styles.availRow}>
        <View style={styles.availLeft}>
          <View style={[styles.availDotLarge, { backgroundColor: todayAvailable ? C.green : C.muted }]} />
          <Text style={styles.availText}>Heute verfügbar für neue Anfragen</Text>
        </View>
        <Switch
          value={todayAvailable}
          onValueChange={handleToggleToday}
          trackColor={{ false: C.border, true: C.green }}
          thumbColor={C.surface}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Week navigation + day strip ── */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            style={[styles.weekArrow, weekOffset === 0 && styles.weekArrowDisabled]}
            onPress={handlePrevWeek}
            activeOpacity={weekOffset === 0 ? 1 : 0.75}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={weekOffset === 0 ? C.muted : C.ink}
            />
          </TouchableOpacity>

          <ScrollView
            ref={stripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}
          >
            {chips.map((chip, i) => (
              <DayColumn
                key={i}
                chip={chip}
                isSelected={selectedDay === i}
                onPress={() => setSelectedDay(i)}
              />
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.weekArrow} onPress={handleNextWeek} activeOpacity={0.75}>
            <Ionicons name="chevron-forward" size={18} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* ── Time slot grid ── */}
        <View style={styles.slotGrid}>
          {slots.map((slot) => (
            <SlotRow
              key={slot.hour}
              slot={slot}
              onFreePress={handleFreeSlot}
              onBookedPress={handleBookedSlot}
            />
          ))}
        </View>

        {/* ── Pro sync banner ── */}
        <TouchableOpacity
          style={styles.proBanner}
          onPress={() => router.push('/(provider)/pro')}
          activeOpacity={0.85}
        >
          <Ionicons name="star" size={15} color={C.amber} />
          <Text style={styles.proBannerText}>
            Google Kalender Sync — verfügbar mit Pro
          </Text>
          <Ionicons name="chevron-forward" size={15} color={C.amber} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 52;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title:    { fontSize: 24, fontWeight: '800', color: C.ink },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },

  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    marginBottom: 2,
  },
  availLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  availDotLarge: { width: 10, height: 10, borderRadius: 5 },
  availText:     { fontSize: 13, fontWeight: '600', color: C.ink, flex: 1 },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  weekArrow: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  weekArrowDisabled: { opacity: 0.3 },

  dayStrip: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },

  dayChip: {
    width: 48,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayChipSelected: { backgroundColor: C.ink, borderColor: C.ink },
  dayShortName:    { fontSize: 10, fontWeight: '600', color: C.muted },
  dayNum:          { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 2 },
  dayTextSelected: { color: C.surface },
  availDot:        { width: 6, height: 6, borderRadius: 3, marginTop: 5 },

  slotGrid: {
    paddingHorizontal: 16,
    gap: 5,
  },

  slotFree: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SLOT_HEIGHT,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.green,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  slotBooked: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SLOT_HEIGHT,
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: '#F0C87A',
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  slotBlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SLOT_HEIGHT,
    backgroundColor: '#F0EFEB',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 12,
  },

  slotTime: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
    width: 44,
  },
  slotTimeBooked:  { color: C.amber },
  slotTimeBlocked: { fontSize: 13, fontWeight: '800', color: C.muted, width: 44 },

  slotContent: { flex: 1 },

  slotFreeText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.green,
  },
  slotBookedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  slotBlockedText: {
    fontSize: 12,
    color: C.muted,
  },

  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.amberBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0D5A8',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 20,
  },
  proBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: C.amber,
  },
});
