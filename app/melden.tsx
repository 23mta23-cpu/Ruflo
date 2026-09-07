/**
 * Meldung eines mutmaßlich rechtswidrigen Inhalts — Art. 16 DSA.
 *
 * Bewusst OHNE Anmeldepflicht. Art. 16 Abs. 1 richtet sich an „Personen und
 * Einrichtungen", nicht an Nutzer der Plattform: wer hier etwas Rechtswidriges
 * sieht, muss es melden können, ohne vorher ein Konto anzulegen. Ein Meldeweg
 * hinter einer Anmeldung ist keiner.
 *
 * Abgrenzung zum Melden im Chat (chat_reports, 0700): das ist
 * Hausregel-Moderation zwischen zwei Beteiligten — Kontaktdaten, Zahlung
 * außerhalb, Beleidigung, Spam. Hier geht es um rechtswidrige Inhalte in jeder
 * Inhaltsart. Beide Wege bleiben nebeneinander bestehen.
 *
 * Die Pflichtangaben stehen in Art. 16 Abs. 2 lit. a–d und sind alle
 * erforderlich; das Formular sagt bei jeder, warum.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { S, R } from '../constants/theme';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import {
  meldeInhalt, INHALT_ARTEN, MIN_BEGRUENDUNG, type InhaltArt,
} from '../lib/dsa';
import { MAIL } from '../constants/legal';
import { showAlert } from '../lib/alert';

export default function MeldenScreen() {
  const router = useRouter();
  // Kommt die Meldung aus einem Bildschirm heraus, sind Art und Fundstelle
  // schon bekannt — dann muss sie niemand abtippen.
  const params = useLocalSearchParams<{ art?: string; id?: string; fundstelle?: string }>();

  const [art, setArt] = useState<InhaltArt>(
    (INHALT_ARTEN.find((a) => a.wert === params.art)?.wert ?? 'sonstiges') as InhaltArt,
  );
  const [fundstelle, setFundstelle] = useState(params.fundstelle ?? '');
  const [begruendung, setBegruendung] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [guterGlaube, setGuterGlaube] = useState(false);
  const [straftat, setStraftat] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [quittung, setQuittung] = useState<string | null>(null);

  const begruendungFehlt = Math.max(0, MIN_BEGRUENDUNG - begruendung.trim().length);
  const bereit =
    fundstelle.trim().length >= 3 &&
    begruendungFehlt === 0 &&
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) &&
    guterGlaube;

  async function absenden() {
    if (!bereit || sendet) return;
    setSendet(true);
    try {
      const q = await meldeInhalt({
        inhaltArt: art,
        inhaltId: params.id ?? null,
        fundstelle,
        begruendung,
        melderName: name,
        melderEmail: email,
        treuUndGlauben: true,
        straftatVerdacht: straftat,
      });
      setQuittung(q.id);
    } catch (e) {
      showAlert('Meldung nicht übermittelt', e instanceof Error ? e.message : 'Bitte später erneut versuchen.');
    } finally {
      setSendet(false);
    }
  }

  if (quittung) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück"
            onPress={() => safeBack(router)} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={s.title}>Meldung eingegangen</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={s.inhalt}>
          <View style={s.quittungBox}>
            <Ionicons name="checkmark-circle-outline" size={30} color={C.primary} />
            <Text style={s.quittungTitel}>Wir haben Ihre Meldung erhalten</Text>
            <Text style={s.text}>
              Ihre Vorgangsnummer lautet:
            </Text>
            <Text style={s.nummer} selectable>{quittung}</Text>
            <Text style={s.text}>
              Wir prüfen die Meldung sorgfältig und ohne Willkür und teilen Ihnen
              unsere Entscheidung mit. Gegen die Entscheidung können Sie
              Widerspruch einlegen; unabhängig davon steht Ihnen der Rechtsweg
              offen.
            </Text>
            <Text style={s.hinweisKlein}>
              Rückfragen zu diesem Vorgang: {MAIL.kontakt}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück"
          onPress={() => safeBack(router)} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.title}>Inhalt melden</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.inhalt} keyboardShouldPersistTaps="handled">
          <Text style={s.text}>
            Hier können Sie einen Inhalt melden, den Sie für rechtswidrig halten.
            Eine Anmeldung ist dafür nicht nötig.
          </Text>
          <Text style={s.hinweisKlein}>
            Geht es um einen Verstoß gegen unsere Regeln — etwa Kontaktdaten im
            Chat oder eine Zahlung an der Plattform vorbei —, nutzen Sie bitte
            das Melden direkt in der Unterhaltung.
          </Text>

          <Text style={s.label}>Worum geht es?</Text>
          <View style={s.chips}>
            {INHALT_ARTEN.map((a) => (
              <TouchableOpacity
                key={a.wert}
                accessibilityRole="button"
                accessibilityState={{ selected: art === a.wert }}
                onPress={() => setArt(a.wert)}
                style={[s.chip, art === a.wert && s.chipAktiv]}
              >
                <Text style={[s.chipText, art === a.wert && s.chipTextAktiv]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Wo genau?</Text>
          <Text style={s.hilfe}>
            Die Adresse der Seite oder eine Beschreibung, die den Inhalt eindeutig
            auffindbar macht. Ohne diese Angabe können wir ihn nicht prüfen.
          </Text>
          <TextInput
            style={s.feld}
            value={fundstelle}
            onChangeText={setFundstelle}
            placeholder="z. B. werkant.de/anbieter/…"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />

          <Text style={s.label}>Warum halten Sie den Inhalt für rechtswidrig?</Text>
          <Text style={s.hilfe}>
            Bitte so genau wie möglich. Eine Meldung ohne Begründung können wir
            nicht sorgfältig prüfen.
          </Text>
          <TextInput
            style={[s.feld, s.feldGross]}
            value={begruendung}
            onChangeText={setBegruendung}
            placeholder="Beschreiben Sie den Sachverhalt"
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
          />
          {begruendungFehlt > 0 ? (
            <Text style={s.hilfe}>Noch {begruendungFehlt} Zeichen.</Text>
          ) : null}

          <Text style={s.label}>Ihr Name</Text>
          <TextInput
            style={s.feld} value={name} onChangeText={setName}
            placeholder="Vor- und Nachname" placeholderTextColor={C.muted}
          />

          <Text style={s.label}>Ihre E-Mail-Adresse</Text>
          <Text style={s.hilfe}>
            Wir brauchen sie, um Ihnen den Eingang und später unsere Entscheidung
            mitzuteilen.
          </Text>
          <TextInput
            style={s.feld} value={email} onChangeText={setEmail}
            placeholder="name@beispiel.de" placeholderTextColor={C.muted}
            autoCapitalize="none" keyboardType="email-address"
          />

          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: guterGlaube }}
            onPress={() => setGuterGlaube((v) => !v)}
            style={s.hakenZeile}
          >
            <Ionicons
              name={guterGlaube ? 'checkbox' : 'square-outline'}
              size={22}
              color={guterGlaube ? C.primary : C.muted}
            />
            <Text style={s.hakenText}>
              Ich erkläre, dass meine Angaben nach bestem Wissen richtig und
              vollständig sind.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: straftat }}
            onPress={() => setStraftat((v) => !v)}
            style={s.hakenZeile}
          >
            <Ionicons
              name={straftat ? 'checkbox' : 'square-outline'}
              size={22}
              color={straftat ? C.clay : C.muted}
            />
            <Text style={s.hakenText}>
              Es besteht der Verdacht auf eine Straftat, die eine Gefahr für das
              Leben oder die Sicherheit einer Person begründet.
            </Text>
          </TouchableOpacity>
          {straftat ? (
            <Text style={s.dringend}>
              Bei akuter Gefahr wählen Sie bitte sofort die 110. Diese Meldung
              ersetzt keinen Notruf.
            </Text>
          ) : null}

          <AnimatedButton
            onPress={absenden}
            disabled={!bereit || sendet}
            style={[s.absendeBtn, (!bereit || sendet) && s.absendeBtnAus]}
          >
            <Text style={s.absendeText}>
              {sendet ? 'Wird übermittelt …' : 'Meldung absenden'}
            </Text>
          </AnimatedButton>

          <Text style={s.hinweisKlein}>
            Ihre Angaben werden zur Prüfung der Meldung verarbeitet. Näheres in
            der Datenschutzerklärung.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 17, fontWeight: '700', color: C.ink },
  inhalt:       { paddingHorizontal: 20, paddingBottom: 40, gap: S.sm },
  text:         { ...T.body, color: C.ink, lineHeight: 21 },
  hilfe:        { ...T.caption, color: C.sub, lineHeight: 16 },
  hinweisKlein: { ...T.caption, color: C.muted, lineHeight: 16, marginTop: S.sm },
  label:        { ...T.label, color: C.sub, marginTop: S.md },
  feld:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, ...T.body, color: C.ink, minWidth: 0 },
  feldGross:    { minHeight: 120 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 9 },
  chipAktiv:    { borderColor: C.primary, backgroundColor: C.primaryBg },
  chipText:     { ...T.caption, color: C.sub },
  chipTextAktiv:{ color: C.primary, fontWeight: '700' },
  hakenZeile:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: S.md },
  hakenText:    { ...T.caption, color: C.ink, flex: 1, minWidth: 0, lineHeight: 17 },
  dringend:     { ...T.caption, color: C.clay, fontWeight: '700', lineHeight: 16 },
  quittungBox:  { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: S.lg, gap: S.sm, alignItems: 'flex-start' },
  quittungTitel:{ ...T.h3, color: C.ink },
  nummer:       { ...T.body, fontWeight: '700', color: C.primary },
  absendeBtn:   { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', marginTop: S.lg },
  absendeBtnAus:{ backgroundColor: C.muted },
  absendeText:  { ...T.btn, color: C.surface },
});
