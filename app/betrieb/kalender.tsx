import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal,
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
import { isoTag, wochenTage, wochenVersatzZu, wochenZeitraum, monatsRaster } from '../../lib/kalenderWoche';
import {
  ladeFreieStunden, setzeStunde, sperreZeitraum, gibZeitraumFrei, slotSchluessel,
} from '../../lib/verfuegbarkeit';

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

    // KEINE erfundenen freien Stunden mehr.
    //
    // Hier standen fest im Code ein paar freie Stunden an Mo/Mi/Fr. Das
    // behauptet Verfuegbarkeit, die kein Anbieter je zugesagt hat — und im
    // Zweifel gegenueber einem Kunden, der darauf einen Termin vorschlaegt.
    // Frei ist jetzt nur, was in provider_availability steht (0740).

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

/** Die Stunden, die der Kalender anzeigt: 08:00–18:00. Eine Stelle statt
    dreier verstreuter Array.from({length: 11}). */
const STUNDEN_VON_BIS = Array.from({ length: 11 }, (_, i) => 8 + i);

const MONATE_LANG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export default function ProviderKalenderScreen() {
  const { user } = useAuth();
  const [wochenVersatz, setWochenVersatz] = useState(0);
  // Monatsspringer. Founder-Befund 07.09.2026: mit '‹' und '›' allein waeren
  // es bis Januar 2027 rund 70 Tipper gewesen.
  const [springerOffen, setSpringerOffen] = useState(false);
  const [springerMonat, setSpringerMonat] = useState(() => {
    const h = new Date();
    return { jahr: h.getFullYear(), monat: h.getMonth() };
  });
  const weekDays = React.useMemo(() => getWeekDays(wochenVersatz), [wochenVersatz]);
  // Vorher fest 0 = Montag. Wer den Kalender am Donnerstag oeffnete, landete
  // auf dem Montag — drei Tage in der Vergangenheit, wo sich ohnehin nichts
  // mehr eintragen laesst. Der Bildschirm beginnt jetzt bei heute.
  const [selectedDay, setSelectedDay] = useState<number>(() => (new Date().getDay() + 6) % 7);

  // Die als FREI gemeldeten Stunden, aus provider_availability (0740).
  // Seit 16.08.2026 dauerhaft: vorher lagen die Umschaltungen nur im
  // Bildschirmzustand und waren beim naechsten Oeffnen weg — und gelesen hat
  // sie ohnehin niemand.
  const [freieStunden, setFreieStunden] = useState<Set<string>>(new Set());

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

  const ladeVerfuegbarkeit = useCallback(() => {
    if (!user) return;
    const tage = wochenTage(wochenVersatz);
    ladeFreieStunden(user.id, isoTag(tage[0]), isoTag(tage[6])).then(setFreieStunden);
  }, [user, wochenVersatz]);

  useFocusEffect(useCallback(() => { loadBooked(); }, [loadBooked]));
  // Beim Blaettern neu laden — sonst zeigt die naechste Woche die Stunden der
  // vorigen.
  useEffect(() => { ladeVerfuegbarkeit(); }, [ladeVerfuegbarkeit]);

  /** Status einer Stunde: eine Buchung schlaegt alles, sonst gilt die Meldung. */
  function statusVon(tag: DayData, stunde: number): SlotStatus {
    if (booked[`${tag.iso}-${stunde}`]) return 'booked';
    return freieStunden.has(slotSchluessel(tag.iso, stunde)) ? 'free' : 'blocked';
  }

  async function handleToggleSlot(hour: number) {
    if (!user) return;
    const tag = weekDays[selectedDay];
    if (statusVon(tag, hour) === 'booked') return;
    const schluessel = slotSchluessel(tag.iso, hour);
    const jetztFrei = !freieStunden.has(schluessel);

    // Sofort anzeigen, damit das Antippen sich nicht traege anfuehlt — aber
    // bei einem Fehler zuruecknehmen UND es sagen. Eine Umschaltung, die
    // aussieht als haette sie gewirkt und beim naechsten Oeffnen weg ist, ist
    // genau der Zustand, den diese Aenderung beheben soll.
    setFreieStunden((prev) => {
      const next = new Set(prev);
      if (jetztFrei) next.add(schluessel); else next.delete(schluessel);
      return next;
    });

    const ok = await setzeStunde(user.id, tag.iso, hour, jetztFrei);
    if (!ok) {
      setFreieStunden((prev) => {
        const next = new Set(prev);
        if (jetztFrei) next.delete(schluessel); else next.add(schluessel);
        return next;
      });
      toast.error('Konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
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
          onPress: async () => {
            if (!user) return;
            const ok = await sperreZeitraum(user.id, weekDays[0].iso, weekDays[6].iso);
            if (ok) {
              ladeVerfuegbarkeit();
            } else {
              toast.error('Konnte nicht gespeichert werden. Bitte erneut versuchen.');
            }
          },
        },
      ]
    );
  }

  /** Alle Stunden EINES Tages freigeben — statt elf Mal zu tippen. */
  async function handleTagFrei(tagIso: string) {
    if (!user) return;
    const stunden = STUNDEN_VON_BIS;
    const ok = await gibZeitraumFrei(user.id, tagIso, tagIso, stunden);
    if (ok) ladeVerfuegbarkeit();
    else toast.error('Konnte nicht gespeichert werden. Bitte erneut versuchen.');
  }

  /** Die ganze angezeigte Woche freigeben — das Gegenstueck zu "Woche sperren".
      Ohne diese Aktion waeren es 77 Tipper, um ueberhaupt buchbar zu werden. */
  function handleWocheFrei() {
    Alert.alert(
      'Woche freigeben',
      `Alle Stunden von ${STUNDEN_VON_BIS[0]}:00 bis ${STUNDEN_VON_BIS[STUNDEN_VON_BIS.length - 1]}:00 werden in dieser Woche als frei gemeldet. Einzelne Stunden können Sie danach wieder sperren.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Freigeben',
          onPress: async () => {
            if (!user) return;
            const ok = await gibZeitraumFrei(user.id, weekDays[0].iso, weekDays[6].iso, STUNDEN_VON_BIS);
            if (ok) ladeVerfuegbarkeit();
            else toast.error('Konnte nicht gespeichert werden. Bitte erneut versuchen.');
          },
        },
      ],
    );
  }

  function handleUrlaub() {
    toast.info('Urlaub eintragen: mehrtägige Sperrung kommt im nächsten Release.');
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

          {/* Vorher stand hier "+3 Wochen · Zu heute". Eine Zahl ohne Datum
              beantwortet die einzige Frage nicht, die man an dieser Stelle
              hat: WELCHE Woche sehe ich gerade? Jetzt steht der Zeitraum da,
              und ein Tipp darauf oeffnet den Monatsspringer. */}
          <TouchableOpacity
            style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' }}
            onPress={() => {
              const montagJetzt = wochenTage(wochenVersatz)[0];
              setSpringerMonat({ jahr: montagJetzt.getFullYear(), monat: montagJetzt.getMonth() });
              setSpringerOffen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Anderen Zeitraum wählen"
          >
            <Text style={styles.wochenLabel}>
              {wochenVersatz === 0 ? 'Diese Woche' : wochenZeitraum(wochenVersatz)}
              {'  '}
              <Ionicons name="chevron-down" size={12} color={C.sub} />
            </Text>
          </TouchableOpacity>

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

        {/* Erstnutzung: solange KEINE Stunde frei ist, ist der Betrieb nicht
            buchbar — und drei Zaehler ("0 Frei · 0 Gebucht · 11 Gesperrt")
            sagen das zwar, aber nicht, was zu tun ist. Ein leerer Kalender ist
            ein Erstnutzungs-Zustand und gehoert wie einer behandelt. */}
        {freeCount === 0 && bookedCount === 0 ? (
          <View style={styles.leerHinweis}>
            <Ionicons name="information-circle-outline" size={18} color={C.gold} />
            <Text style={styles.leerHinweisText}>
              An diesem Tag ist keine Stunde freigegeben. Kundinnen und Kunden
              können Sie dann nicht buchen. Geben Sie die Zeiten frei, zu denen
              Sie arbeiten.
            </Text>
          </View>
        ) : null}

        {/* ── Sammelaktionen ────────────────────────────────────────────────
            Standen bis 07.09.2026 GANZ UNTEN — hinter elf Stunden-Zeilen und
            einer dreizeiligen Legende. Der Founder sah auf dem Geraet elf Mal
            "Gesperrt · Tippen zum Freigeben" und keinen Ausweg, weil der
            Ausweg zwei Bildschirmlaengen hinter dem Problem lag.

            Eine Sammelaktion gehoert VOR die Menge, auf die sie wirkt. So
            macht es auch der Gastgeber-Kalender bei Airbnb: Zeitraum waehlen
            und freigeben/sperren steht ueber dem Kalender, nicht dahinter. */}
        <View style={styles.quickActions}>
          <AnimatedButton style={styles.qaBtnPrimary} onPress={handleWocheFrei}>
            <Ionicons name="checkmark-done-outline" size={16} color={C.surface} />
            <Text style={styles.qaBtnPrimaryText}>Woche freigeben</Text>
          </AnimatedButton>
          <AnimatedButton style={styles.qaBtnDestructive} onPress={handleWeekBlock}>
            <Ionicons name="lock-closed-outline" size={16} color={C.red} />
            <Text style={styles.qaBtnDestructiveText}>Woche sperren</Text>
          </AnimatedButton>
        </View>
        <View style={styles.quickActions}>
          <AnimatedButton style={styles.qaBtn} onPress={() => handleTagFrei(selectedDayData.iso)}>
            <Ionicons name="today-outline" size={16} color={C.sub} />
            <Text style={styles.qaBtnText}>Diesen Tag freigeben</Text>
          </AnimatedButton>
          <AnimatedButton style={styles.qaBtn} onPress={handleUrlaub}>
            <Ionicons name="airplane-outline" size={16} color={C.sub} />
            <Text style={styles.qaBtnText}>Urlaub eintragen</Text>
          </AnimatedButton>
        </View>

        <Divider margin={0} />

        {/* ── Slots list ── */}
        <View style={styles.slotsContainer}>
          <Text style={styles.slotsHeading}>
            {selectedDayData.iso === heuteIso ? 'Heute · ' : ''}
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
            <Text style={styles.legendText}>Frei · für Buchungen verfügbar</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.amberBg, borderColor: C.amber }]} />
            <Text style={styles.legendText}>Gebucht · Auftrag bestätigt</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: C.bgWarm, borderColor: C.border }]} />
            <Text style={styles.legendText}>Gesperrt · nicht buchbar</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Monatsspringer ────────────────────────────────────────────────
          Founder-Befund 07.09.2026 am Geraet: "Ich moechte auch Kalender fuer
          die naechsten Wochen etc. anklicken koennen oder 2027 — gerade ist
          es schlecht geregelt mit +1 etc."
          Nachgemessen war es schlimmer als beschrieben: es gab AUSSCHLIESSLICH
          Wochenschritte, fuer Januar 2027 also rund 70 Tipper. Und das Label
          nannte einen Versatz statt eines Datums, sodass man beim Blaettern
          nicht einmal sah, wo man gelandet war.
          Jahr und Monat sind getrennt bedienbar, weil ein Jahressprung sonst
          zwoelf Monatstipper braeuchte — derselbe Fehler eine Ebene hoeher. */}
      <Modal
        visible={springerOffen}
        transparent
        animationType="fade"
        onRequestClose={() => setSpringerOffen(false)}
      >
        <TouchableOpacity
          style={styles.springerHintergrund}
          activeOpacity={1}
          onPress={() => setSpringerOffen(false)}
          accessibilityRole="button"
          accessibilityLabel="Auswahl schließen"
        >
          <TouchableOpacity style={styles.springerBlatt} activeOpacity={1} onPress={() => {}}>
            <View style={styles.springerKopf}>
              <TouchableOpacity
                style={styles.springerPfeil}
                onPress={() => setSpringerMonat((m) => m.monat === 0
                  ? { jahr: m.jahr - 1, monat: 11 } : { ...m, monat: m.monat - 1 })}
                accessibilityRole="button" accessibilityLabel="Vorheriger Monat" hitSlop={10}
              >
                <Ionicons name="chevron-back" size={20} color={C.ink} />
              </TouchableOpacity>
              <Text style={styles.springerTitel}>
                {MONATE_LANG[springerMonat.monat]} {springerMonat.jahr}
              </Text>
              <TouchableOpacity
                style={styles.springerPfeil}
                onPress={() => setSpringerMonat((m) => m.monat === 11
                  ? { jahr: m.jahr + 1, monat: 0 } : { ...m, monat: m.monat + 1 })}
                accessibilityRole="button" accessibilityLabel="Nächster Monat" hitSlop={10}
              >
                <Ionicons name="chevron-forward" size={20} color={C.ink} />
              </TouchableOpacity>
            </View>

            {/* Jahre: der eigentliche Wunsch ("oder 2027"). Ohne diese Zeile
                waere ein Jahressprung zwoelf Monatstipper. */}
            <View style={styles.jahrLeiste}>
              {[0, 1, 2].map((v) => {
                const j = new Date().getFullYear() + v;
                const aktiv = springerMonat.jahr === j;
                return (
                  <TouchableOpacity
                    key={j}
                    style={[styles.jahrChip, aktiv && styles.jahrChipAktiv]}
                    onPress={() => setSpringerMonat((m) => ({ ...m, jahr: j }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aktiv }}
                  >
                    <Text style={[styles.jahrChipText, aktiv && styles.jahrChipTextAktiv]}>{j}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.wochenKopfZeile}>
              {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((t, i) => (
                <Text key={i} style={styles.wochenKopfTag}>{t}</Text>
              ))}
            </View>

            <View style={styles.monatsRaster}>
              {monatsRaster(springerMonat.jahr, springerMonat.monat).map((d) => {
                const imMonat = d.getMonth() === springerMonat.monat;
                const istHeute = isoTag(d) === isoTag(new Date());
                const inAngezeigterWoche = wochenVersatzZu(d) === wochenVersatz;
                return (
                  <TouchableOpacity
                    key={isoTag(d)}
                    style={[
                      styles.rasterTag,
                      inAngezeigterWoche && styles.rasterTagWoche,
                      istHeute && styles.rasterTagHeute,
                    ]}
                    onPress={() => {
                      setWochenVersatz(wochenVersatzZu(d));
                      setSelectedDay((d.getDay() + 6) % 7);
                      setSpringerOffen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={d.toLocaleDateString('de-DE', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  >
                    <Text style={[
                      styles.rasterTagText,
                      !imMonat && styles.rasterTagFremd,
                      istHeute && styles.rasterTagHeuteText,
                    ]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.springerHeute}
              onPress={() => {
                setWochenVersatz(0);
                setSelectedDay((new Date().getDay() + 6) % 7);
                setSpringerOffen(false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.springerHeuteText}>Zu dieser Woche</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  springerHintergrund:  { flex: 1, backgroundColor: 'rgba(26,25,23,0.45)', justifyContent: 'center', padding: 20 },
  springerBlatt:        { backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 12 },
  springerKopf:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  springerPfeil:        { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  springerTitel:        { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.ink },
  jahrLeiste:           { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  jahrChip:             { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border },
  jahrChipAktiv:        { backgroundColor: C.primaryBg, borderColor: C.primary },
  jahrChipText:         { fontSize: 13, fontWeight: '700', color: C.sub },
  jahrChipTextAktiv:    { color: C.primary },
  wochenKopfZeile:      { flexDirection: 'row' },
  wochenKopfTag:        { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.muted },
  monatsRaster:         { flexDirection: 'row', flexWrap: 'wrap' },
  rasterTag:            { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  rasterTagWoche:       { backgroundColor: C.primaryBg },
  rasterTagHeute:       { borderWidth: 1.5, borderColor: C.primary },
  rasterTagText:        { fontSize: 14, fontWeight: '600', color: C.ink },
  rasterTagFremd:       { color: C.muted },
  rasterTagHeuteText:   { color: C.primary, fontWeight: '700' },
  springerHeute:        { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  springerHeuteText:    { fontSize: 14, fontWeight: '700', color: C.primary },
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
  leerHinweis:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold },
  leerHinweisText:      { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, color: C.ink },
  legend:               { marginHorizontal: 16, marginTop: 20, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  legendTitle:          { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 10 },
  legendRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  legendDot:            { width: 20, height: 20, borderRadius: 5, borderWidth: 1 },
  legendText:           { fontSize: 12, color: C.sub },

  // Quick actions
  qaBtnPrimary:         { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 12, backgroundColor: C.primary },
  qaBtnPrimaryText:     { fontSize: 14, fontWeight: '700', color: C.surface },
  quickActions:         { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  qaBtn:                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13 },
  qaBtnText:            { fontSize: 13, color: C.sub, fontWeight: '600' },
  qaBtnDestructive:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBd, borderRadius: 10, paddingVertical: 13 },
  qaBtnDestructiveText: { fontSize: 13, color: C.red, fontWeight: '600' },
});
