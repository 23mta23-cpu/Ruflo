import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { isoTag, wochenTage } from '../../lib/kalenderWoche';

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
  /** Kalendertag als YYYY-MM-DD. Siehe Kommentar an getWeekDays(). */
  iso: string;
  /** Monatsname des TAGES, nicht des heutigen Monats (Wochen laufen ueber
   *  Monatsgrenzen: der 31.08. und der 01.09. liegen in derselben Woche). */
  monat: string;
  slots: TimeSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Bis 16.08.2026 stand hier `getWeekDays()` ohne Parameter: der Kalender zeigte
// ausschliesslich die LAUFENDE Woche, ohne jede Moeglichkeit zu blaettern.
// loadBooked() hat zusaetzlich alles ausserhalb dieser Woche verworfen. Ein
// bestaetigter Termin am 28.08. war fuer den Anbieter damit nicht schwer zu
// finden, sondern UNSICHTBAR -- er konnte einen gebuchten Auftrag schlicht
// verpassen. Founder-Befund: "Im kalender kann ich nur die woche sehen? Was
// ist wenn es am naechsten monat ist".
//
// Jeder Tag traegt jetzt sein volles Datum (iso). Das ist nicht Kosmetik: die
// Buchungen wurden vorher unter `${wochentag}-${stunde}` abgelegt, ein
// Schluessel, der sich jede Woche wiederholt -- beim Blaettern waeren die
// Termine der einen Woche in der anderen erschienen.
function getWeekDays(wochenVersatz: number): DayData[] {
  const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const fullLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const tage = wochenTage(wochenVersatz);

  return dayLabels.map((label, i) => {
    const d = tage[i];
    const date = d.getDate();

    // Build default slots 08:00–18:00
    const slots: TimeSlot[] = Array.from({ length: 11 }, (_, h) => ({
      hour: 8 + h,
      status: 'blocked' as SlotStatus,
    }));

    // Default: Mo/Mi/Fr have some free slots
    if (i === 0) {
      slots[2] = { hour: 10, status: 'free' };
      slots[6] = { hour: 14, status: 'free' };
    }
    if (i === 2) {
      slots[1] = { hour: 9, status: 'free' };
      slots[3] = { hour: 11, status: 'free' };
    }
    if (i === 4) {
      slots[0] = { hour: 8, status: 'free' };
      slots[1] = { hour: 9, status: 'free' };
    }

    return {
      dayIndex: i,
      label: fullLabels[i],
      shortLabel: label,
      date,
      iso: isoTag(d),
      monat: d.toLocaleDateString('de-DE', { month: 'long' }),
      slots,
    };
  });
}


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
  const { user } = useAuth();
  const [wochenVersatz, setWochenVersatz] = useState(0);
  const weekDays = React.useMemo(() => getWeekDays(wochenVersatz), [wochenVersatz]);
  const [selectedDay, setSelectedDay] = useState<number>(0); // Mon default

  // Frei/Gesperrt-Umschaltungen liegen bewusst NICHT mehr in weekDays: die
  // Wochenansicht wird beim Blaettern neu berechnet, und alles, was in ihr
  // steht, waere dabei still verlorengegangen. Schluessel ist der Kalendertag,
  // nicht der Wochentag -- sonst faerbte eine Sperrung am Montag auch alle
  // anderen Montage.
  //
  // EHRLICH: das ueberlebt nur die Sitzung. Es gibt keine Tabelle fuer
  // Anbieter-Verfuegbarkeiten; "Urlaub eintragen" sagt selbst, dass es noch
  // nicht gebaut ist. Diese Aenderung macht das Blaettern moeglich, sie macht
  // die Verfuegbarkeit nicht dauerhaft.
  const [ueberschreibungen, setUeberschreibungen] = useState<Record<string, SlotStatus>>({});

  const today = new Date();
  const heuteIso = isoTag(today);

  // Gebuchte Slots als SEPARATER, pro Ladung komplett neu aufgebauter Overlay-
  // State (statt in weekDays hineinzumergen): dadurch idempotent — der Screen
  // kann bei jedem Fokus neu laden (Stale-Tab-Klasse, #89), stornierte
  // Buchungen verschwinden, und die manuellen Frei/Gesperrt-Toggles in
  // weekDays bleiben unberührt.
  const [booked, setBooked] = useState<Record<string, { jobInfo: string; customer: string }>>({});

  const loadBooked = useCallback(() => {
    if (!user) return;
    supabase
      .from('contracts')
      .select('job:jobs!job_id(title, scheduled_at), customer:profiles!customer_id(full_name)')
      .eq('provider_id', user.id)
      .in('status', ['active', 'pending'])
      .then(({ data, error }) => {
        if (error) { toast.error('Kalender konnte nicht geladen werden'); return; }
        // Alle Termine nach Kalendertag ablegen, nicht nach Wochentag. Der
        // vorherige Schluessel `${wochentag}-${stunde}` wiederholt sich jede
        // Woche; zusammen mit dem Wochenfilter war das der Grund, warum ein
        // Termin ausserhalb der laufenden Woche gar nicht erst ankam.
        const map: Record<string, { jobInfo: string; customer: string }> = {};
        for (const row of data ?? []) {
          const scheduledAt = (row.job as any)?.scheduled_at;
          if (!scheduledAt) continue;
          const d = new Date(scheduledAt);
          map[`${isoTag(d)}-${d.getHours()}`] = {
            jobInfo: (row.job as any)?.title ?? 'Auftrag',
            customer: (row.customer as any)?.full_name ?? 'Kunde',
          };
        }
        setBooked(map);
      });
  }, [user]);

  useFocusEffect(useCallback(() => { loadBooked(); }, [loadBooked]));

  /** Status eines Slots: Buchung schlaegt Umschaltung schlaegt Vorgabe. */
  function statusVon(tag: DayData, stunde: number): SlotStatus {
    if (booked[`${tag.iso}-${stunde}`]) return 'booked';
    const eigen = ueberschreibungen[`${tag.iso}-${stunde}`];
    if (eigen) return eigen;
    return tag.slots.find((s) => s.hour === stunde)?.status ?? 'blocked';
  }

  function handleToggleSlot(hour: number) {
    const tag = weekDays[selectedDay];
    if (statusVon(tag, hour) === 'booked') return;
    setUeberschreibungen((prev) => ({
      ...prev,
      [`${tag.iso}-${hour}`]: statusVon(tag, hour) === 'free' ? 'blocked' : 'free',
    }));
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
            setUeberschreibungen((prev) => {
              const next = { ...prev };
              for (const tag of weekDays) {
                for (const slot of tag.slots) {
                  if (statusVon(tag, slot.hour) === 'free') next[`${tag.iso}-${slot.hour}`] = 'blocked';
                }
              }
              return next;
            });
          },
        },
      ]
    );
  }

  function handleUrlaub() {
    toast.info('Urlaub eintragen — mehrtägige Sperrung kommt im nächsten Release.');
  }

  const selectedDayData = weekDays[selectedDay];

  const freeCount   = selectedDayData.slots.filter((s) => statusVon(selectedDayData, s.hour) === 'free').length;
  const bookedCount = selectedDayData.slots.filter((s) => statusVon(selectedDayData, s.hour) === 'booked').length;

  const montag = weekDays[0];
  const sonntag = weekDays[6];
  const wochenTitel = montag.monat === sonntag.monat
    ? `${montag.monat} ${new Date(montag.iso).getFullYear()}`
    : `${montag.monat}/${sonntag.monat}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kalender</Text>
          {/* KW und Monat der ANGEZEIGTEN Woche — vorher immer die von heute,
              was beim Blaettern schlicht falsch gewesen waere. */}
          <Text style={styles.subtitle}>KW {getISOWeek(new Date(montag.iso))} · {wochenTitel}</Text>
        </View>
        {/* Bis 15.08.2026 eine Attrappe: TouchableOpacity ganz OHNE onPress,
            mit sync-outline beschildert. Sie liess sich druecken und tat
            nichts -- ein Anbieter tippt darauf, weil er frische Termine
            erwartet, und haelt danach womoeglich veraltete Daten fuer
            aktuell. Ein Bedienelement, das nichts tut, ist schlimmer als
            keines.
            Jetzt an den vorhandenen loadBooked() gehaengt. Das Symbol ist
            bewusst refresh statt sync: es aktualisiert die eigenen Termine,
            es gleicht KEINEN externen Kalender ab -- die Beschilderung darf
            nicht mehr versprechen als die Funktion. */}
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={loadBooked}
          accessibilityRole="button"
          accessibilityLabel="Termine aktualisieren"
          hitSlop={12}
        >
          <Ionicons name="refresh-outline" size={18} color={C.sub} />
        </TouchableOpacity>
      </View>


      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Wochen blaettern ── */}
        <View style={styles.wochenLeiste}>
          <TouchableOpacity
            style={styles.wochenPfeil}
            onPress={() => setWochenVersatz((v) => v - 1)}
            accessibilityRole="button"
            accessibilityLabel="Vorherige Woche"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </TouchableOpacity>

          {/* "Heute" erscheint nur, wenn man nicht ohnehin dort steht — sonst
              ist es ein Knopf, der nichts bewirkt. */}
          {wochenVersatz === 0 ? (
            <Text style={styles.wochenLabel}>Diese Woche</Text>
          ) : (
            <TouchableOpacity
              onPress={() => { setWochenVersatz(0); setSelectedDay((new Date().getDay() + 6) % 7); }}
              accessibilityRole="button"
              accessibilityLabel="Zurück zu dieser Woche"
              hitSlop={12}
            >
              <Text style={styles.wochenLabelAktiv}>
                {wochenVersatz > 0 ? `+${wochenVersatz}` : wochenVersatz} Wochen · Zu heute
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.wochenPfeil}
            onPress={() => setWochenVersatz((v) => v + 1)}
            accessibilityRole="button"
            accessibilityLabel="Nächste Woche"
            hitSlop={12}
          >
            <Ionicons name="chevron-forward" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* ── Week Strip ── */}
        <View style={styles.weekStrip}>
          {weekDays.map((day, i) => {
            // Vorher nur Tageszahl + Wochentag verglichen — beim Blaettern
            // haette das den 16. eines beliebigen Monats als "heute" markiert.
            const isToday = day.iso === heuteIso;
            const isSelected = selectedDay === i;
            // Vorher `day.slots.some(status === 'booked')`. In slots steht aber
            // NIE eine Buchung: die kommen aus dem separaten booked-Overlay.
            // Der Punkt ist damit nie erschienen — ein Anbieter, der die Woche
            // ueberfliegt, sah keinen Hinweis auf seine Termine.
            const hasBooked = day.slots.some((s) => booked[`${day.iso}-${s.hour}`]);

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
                  {day.shortLabel}
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
            <View style={[styles.chipDot, { backgroundColor: C.primary }]} />
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
            {selectedDayData.iso === heuteIso ? 'Heute — ' : ''}
            {selectedDayData.label}, {selectedDayData.date}. {selectedDayData.monat}
          </Text>
          {selectedDayData.slots.map((slot) => {
            const b = booked[`${selectedDayData.iso}-${slot.hour}`];
            return (
              <SlotCard
                key={slot.hour}
                slot={b
                  ? { hour: slot.hour, status: 'booked', jobInfo: b.jobInfo, customer: b.customer }
                  : { hour: slot.hour, status: statusVon(selectedDayData, slot.hour) }}
                onToggle={handleToggleSlot}
              />
            );
          })}
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legende</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.primaryBg, borderColor: C.primary }]} />
            <Text style={styles.legendText}>Frei — für Buchungen verfügbar</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.amberBg, borderColor: C.amber }]} />
            <Text style={styles.legendText}>Gebucht — Auftrag bestätigt</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.bgWarm, borderColor: C.border }]} />
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
  title:                { fontSize: 24, fontWeight: '700', color: C.ink },
  subtitle:             { fontSize: 12, color: C.muted, marginTop: 2 },
  syncBtn:              { marginTop: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  // Wochen blaettern
  wochenLeiste:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  wochenPfeil:          { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  wochenLabel:          { fontSize: 13, fontWeight: '700', color: C.sub, flex: 1, minWidth: 0, textAlign: 'center' },
  wochenLabelAktiv:     { fontSize: 13, fontWeight: '700', color: C.primary, textAlign: 'center' },

  // Warning banner
  warningBanner:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.amberBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.goldBd, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4 },
  warningLeft:          { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningTitle:         { fontSize: 12, fontWeight: '700', color: C.amber },
  warningBody:          { fontSize: 11, color: C.amber, opacity: 0.8, marginTop: 1 },
  warningCta:           { fontSize: 12, fontWeight: '700', color: C.amber, marginLeft: 8 },

  // Week strip
  weekStrip:            { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  dayPill:              { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  dayPillSelected:      { backgroundColor: C.primary, borderColor: C.primary },
  dayPillToday:         { borderColor: C.primary, borderWidth: 1.5 },
  dayLabel:             { fontSize: 10, fontWeight: '600', color: C.muted, marginBottom: 3 },
  dayLabelSelected:     { color: 'rgba(255,255,255,0.6)' },
  dayDate:              { fontSize: 14, fontWeight: '700', color: C.ink },
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

  slotFree:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  slotLeft:             { flex: 1 },
  slotTime:             { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 2 },
  slotFreeLabel:        { fontSize: 11, color: C.primary },
  slotFreeIndicator:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },

  slotBlocked:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  slotBlockedLabel:     { fontSize: 11, color: C.muted },
  slotBlockedIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },

  slotBooked:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.goldBd, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
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
  qaBtnDestructive:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBd, borderRadius: 10, paddingVertical: 13 },
  qaBtnDestructiveText: { fontSize: 13, color: C.red, fontWeight: '600' },
});
