import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { toast } from '../../components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type SlotStatus = 'free' | 'booked' | 'blocked';

interface TimeSlot {
  hour: number;
  status: SlotStatus;
  jobInfo?: string;
  customer?: string;
}

interface DayData {
  dayIndex: number; // 0=Mon, 6=Sun
  label: string;
  shortLabel: string;
  date: number;
  slots: TimeSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekDays(): DayData[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const fullLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  return dayLabels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = d.getDate();

    // Build default slots 08:00–18:00
    const slots: TimeSlot[] = Array.from({ length: 11 }, (_, h) => ({
      hour: 8 + h,
      status: 'blocked' as SlotStatus,
    }));

    // Monday overrides
    if (i === 0) {
      slots[2] = { hour: 10, status: 'booked', jobInfo: 'Sanitär · Rohrreinigung', customer: 'Familie Müller' };
      slots[6] = { hour: 14, status: 'free' };
    }

    // Wednesday: a few free slots
    if (i === 2) {
      slots[1] = { hour: 9, status: 'free' };
      slots[3] = { hour: 11, status: 'free' };
    }

    // Friday: partially free
    if (i === 4) {
      slots[0] = { hour: 8, status: 'free' };
      slots[1] = { hour: 9, status: 'free' };
      slots[4] = { hour: 12, status: 'booked', jobInfo: 'Elektro · Steckdosen', customer: 'Herr Schmidt' };
    }

    return { dayIndex: i, label, shortLabel: label, date, slots };
  });
}

// Last calendar update: 8 days ago (triggers warning banner)
const DAYS_SINCE_UPDATE = 8;

// ── Slot Card ─────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  onToggle,
}: {
  slot: TimeSlot;
  onToggle: (hour: number) => void;
}) {
  const hour = slot.hour;
  const label = `${String(hour).padStart(2, '0')}:00`;

  if (slot.status === 'booked') {
    return (
      <View style={styles.slotBooked}>
        <View style={styles.slotBookedLeft}>
          <Text style={styles.slotTime}>{label}</Text>
          <View style={styles.slotBookedInfo}>
            <Text style={styles.slotBookedCustomer}>{slot.customer}</Text>
            <Text style={styles.slotBookedJob}>{slot.jobInfo}</Text>
          </View>
        </View>
        <Badge label="Gebucht" variant="amber" />
      </View>
    );
  }

  if (slot.status === 'free') {
    return (
      <TouchableOpacity style={styles.slotFree} onPress={() => onToggle(hour)} activeOpacity={0.75}>
        <View style={styles.slotLeft}>
          <Text style={styles.slotTime}>{label}</Text>
          <Text style={styles.slotFreeLabel}>Frei · Tippen zum Sperren</Text>
        </View>
        <View style={styles.slotFreeIndicator} />
      </TouchableOpacity>
    );
  }

  // blocked
  return (
    <TouchableOpacity style={styles.slotBlocked} onPress={() => onToggle(hour)} activeOpacity={0.75}>
      <View style={styles.slotLeft}>
        <Text style={[styles.slotTime, { color: C.muted }]}>{label}</Text>
        <Text style={styles.slotBlockedLabel}>Gesperrt · Tippen zum Freigeben</Text>
      </View>
      <View style={styles.slotBlockedIndicator} />
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderKalenderScreen() {
  const [weekDays, setWeekDays] = useState<DayData[]>(getWeekDays());
  const [selectedDay, setSelectedDay] = useState<number>(0); // Mon default

  const today = new Date();

  function handleToggleSlot(hour: number) {
    setWeekDays((prev) =>
      prev.map((day, i) => {
        if (i !== selectedDay) return day;
        return {
          ...day,
          slots: day.slots.map((slot) => {
            if (slot.hour !== hour || slot.status === 'booked') return slot;
            return { ...slot, status: slot.status === 'free' ? 'blocked' : 'free' };
          }),
        };
      })
    );
  }

  function handleWeekBlock() {
    Alert.alert(
      'Woche sperren',
      'Alle freien Slots dieser Woche werden gesperrt. Gebuchte Termine bleiben bestehen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Sperren',
          style: 'destructive',
          onPress: () => {
            setWeekDays((prev) =>
              prev.map((day) => ({
                ...day,
                slots: day.slots.map((slot) =>
                  slot.status === 'free' ? { ...slot, status: 'blocked' as SlotStatus } : slot
                ),
              }))
            );
          },
        },
      ]
    );
  }

  function handleUrlaub() {
    toast.info('Urlaub eintragen — mehrtägige Sperrung kommt im nächsten Release.');
  }

  const selectedDayData = weekDays[selectedDay];

  const freeCount  = selectedDayData.slots.filter((s) => s.status === 'free').length;
  const bookedCount = selectedDayData.slots.filter((s) => s.status === 'booked').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kalender</Text>
          <Text style={styles.subtitle}>KW {getISOWeek(today)} · {today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn}>
          <Ionicons name="sync-outline" size={18} color={C.sub} />
        </TouchableOpacity>
      </View>

      {/* Stale update warning banner */}
      {DAYS_SINCE_UPDATE > 7 && (
        <TouchableOpacity style={styles.warningBanner} activeOpacity={0.8}>
          <View style={styles.warningLeft}>
            <Ionicons name="warning-outline" size={16} color={C.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Letztes Update: vor {DAYS_SINCE_UPDATE} Tagen</Text>
              <Text style={styles.warningBody}>Kunden sehen möglicherweise veraltete Verfügbarkeit.</Text>
            </View>
          </View>
          <Text style={styles.warningCta}>Jetzt aktualisieren →</Text>
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Week Strip ── */}
        <View style={styles.weekStrip}>
          {weekDays.map((day, i) => {
            const isToday =
              day.date === today.getDate() &&
              ((today.getDay() + 6) % 7) === i;
            const isSelected = selectedDay === i;
            const hasBooked = day.slots.some((s) => s.status === 'booked');

            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dayPill,
                  isSelected && styles.dayPillSelected,
                  isToday && !isSelected && styles.dayPillToday,
                ]}
                onPress={() => setSelectedDay(i)}
                activeOpacity={0.75}
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayDate, isSelected && styles.dayDateSelected]}>
                  {day.date}
                </Text>
                {hasBooked && (
                  <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Day summary chips ── */}
        <View style={styles.daySummary}>
          <View style={styles.daySummaryChip}>
            <View style={[styles.chipDot, { backgroundColor: C.green }]} />
            <Text style={styles.daySummaryText}>{freeCount} Frei</Text>
          </View>
          <View style={styles.daySummaryChip}>
            <View style={[styles.chipDot, { backgroundColor: C.amber }]} />
            <Text style={styles.daySummaryText}>{bookedCount} Gebucht</Text>
          </View>
          <View style={styles.daySummaryChip}>
            <View style={[styles.chipDot, { backgroundColor: C.border }]} />
            <Text style={styles.daySummaryText}>{selectedDayData.slots.length - freeCount - bookedCount} Gesperrt</Text>
          </View>
        </View>

        <Divider margin={0} />

        {/* ── Slots list ── */}
        <View style={styles.slotsContainer}>
          <Text style={styles.slotsHeading}>
            {selectedDayData.shortLabel === weekDays[((today.getDay() + 6) % 7)]?.label
              ? 'Heute — '
              : ''}{selectedDayData.label ?? selectedDayData.shortLabel}, {selectedDayData.date}. {today.toLocaleDateString('de-DE', { month: 'long' })}
          </Text>
          {selectedDayData.slots.map((slot) => (
            <SlotCard
              key={slot.hour}
              slot={slot}
              onToggle={handleToggleSlot}
            />
          ))}
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legende</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.greenBg, borderColor: C.green }]} />
            <Text style={styles.legendText}>Frei — für Buchungen verfügbar</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.amberBg, borderColor: C.amber }]} />
            <Text style={styles.legendText}>Gebucht — Auftrag bestätigt</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#F0EFEB', borderColor: C.border }]} />
            <Text style={styles.legendText}>Gesperrt — nicht buchbar</Text>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActions}>
          <AnimatedButton style={styles.qaBtnDestructive} onPress={handleWeekBlock}>
            <Ionicons name="lock-closed-outline" size={16} color={C.red} />
            <Text style={styles.qaBtnDestructiveText}>Woche sperren</Text>
          </AnimatedButton>
          <AnimatedButton style={styles.qaBtn} onPress={handleUrlaub}>
            <Ionicons name="airplane-outline" size={16} color={C.sub} />
            <Text style={styles.qaBtnText}>Urlaub eintragen</Text>
          </AnimatedButton>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── ISO week number helper ────────────────────────────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: C.bg },

  // Header
  header:               { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:                { fontSize: 24, fontWeight: '800', color: C.ink },
  subtitle:             { fontSize: 12, color: C.muted, marginTop: 2 },
  syncBtn:              { marginTop: 6, padding: 4 },

  // Warning banner
  warningBanner:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.amberBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0D5A8', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4 },
  warningLeft:          { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningTitle:         { fontSize: 12, fontWeight: '700', color: C.amber },
  warningBody:          { fontSize: 11, color: C.amber, opacity: 0.8, marginTop: 1 },
  warningCta:           { fontSize: 12, fontWeight: '700', color: C.amber, marginLeft: 8 },

  // Week strip
  weekStrip:            { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  dayPill:              { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  dayPillSelected:      { backgroundColor: C.ink, borderColor: C.ink },
  dayPillToday:         { borderColor: C.ink, borderWidth: 1.5 },
  dayLabel:             { fontSize: 10, fontWeight: '600', color: C.muted, marginBottom: 3 },
  dayLabelSelected:     { color: 'rgba(255,255,255,0.6)' },
  dayDate:              { fontSize: 14, fontWeight: '800', color: C.ink },
  dayDateSelected:      { color: C.surface },
  dayDot:               { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.amber, marginTop: 4 },
  dayDotSelected:       { backgroundColor: C.surface },

  // Day summary
  daySummary:           { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  daySummaryChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  daySummaryText:       { fontSize: 11, color: C.sub, fontWeight: '600' },
  chipDot:              { width: 7, height: 7, borderRadius: 3.5 },

  // Slots
  slotsContainer:       { paddingHorizontal: 16, paddingTop: 16 },
  slotsHeading:         { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 10, paddingHorizontal: 4 },

  slotFree:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#B8DFCA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  slotLeft:             { flex: 1 },
  slotTime:             { fontSize: 13, fontWeight: '800', color: C.ink, marginBottom: 2 },
  slotFreeLabel:        { fontSize: 11, color: C.green },
  slotFreeIndicator:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },

  slotBlocked:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  slotBlockedLabel:     { fontSize: 11, color: C.muted },
  slotBlockedIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },

  slotBooked:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.amberBg, borderWidth: 1, borderColor: '#F0C87A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  slotBookedLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotBookedInfo:       { flex: 1 },
  slotBookedCustomer:   { fontSize: 12, fontWeight: '700', color: C.ink },
  slotBookedJob:        { fontSize: 11, color: C.amber, marginTop: 1 },

  // Legend
  legend:               { marginHorizontal: 16, marginTop: 20, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  legendTitle:          { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 10 },
  legendRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  legendDot:            { width: 20, height: 20, borderRadius: 5, borderWidth: 1 },
  legendText:           { fontSize: 12, color: C.sub },

  // Quick actions
  quickActions:         { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  qaBtn:                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13 },
  qaBtnText:            { fontSize: 13, color: C.sub, fontWeight: '600' },
  qaBtnDestructive:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.redBg, borderWidth: 1, borderColor: '#E8AAAA', borderRadius: 10, paddingVertical: 13 },
  qaBtnDestructiveText: { fontSize: 13, color: C.red, fontWeight: '600' },
});
