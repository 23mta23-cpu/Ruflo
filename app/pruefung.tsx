// Das Prüf-Postfach — Betreiber-Ansicht für die Anbieter-Verifizierung.
//
// ANLASS (Founder-Frage 14.09.2026: „Wie prüft es Werkant, muss ich das dann
// machen?"). Die Antwort war: ja, von Hand im Supabase-Dashboard, über Storage
// und Table-Editor, und niemand sagt ihm, dass etwas wartet.
//
// DAS TOR STEHT IM SERVER, nicht hier. Wer nicht in WERKANT_ADMIN_EMAILS steht,
// bekommt von der Edge Function 404 und sieht hier „Nicht gefunden". Dieser
// Bildschirm zeigt nur an, was der Server herausgibt; er entscheidet nichts
// über Berechtigung.
//
// KEINE KI. Die Vorprüfungen in lib/pruefung.ts sind `if`-Abfragen über Felder,
// die ohnehin vorliegen. Sie sortieren, sie entscheiden nicht.
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { safeBack } from '../lib/nav';
import { toast } from '../components/ui/Toast';
import { NichtGefunden } from '../components/ui/NichtGefunden';
import { categoryById } from '../data/categories';
import {
  vorpruefen, freigabeGesperrt, wartetSeitStunden, type Befund,
} from '../lib/pruefung';
import {
  einreichungenLaden, entscheiden, MIN_ABLEHNUNGSGRUND,
  type EinreichungMitLinks,
} from '../lib/pruefungApi';

function BefundZeile({ b }: { b: Befund }) {
  const farbe = b.schwere === 'sperrt' ? C.red : b.schwere === 'ansehen' ? C.gold : C.sub;
  const zeichen = b.schwere === 'sperrt'
    ? 'close-circle-outline'
    : b.schwere === 'ansehen' ? 'alert-circle-outline' : 'information-circle-outline';
  return (
    <View style={s.befund}>
      <Ionicons name={zeichen} size={15} color={farbe} style={{ marginTop: 1 }} />
      <Text style={[s.befundText, { color: farbe }]}>{b.text}</Text>
    </View>
  );
}

function Dokument({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <TouchableOpacity
      style={s.dokument}
      accessibilityRole="link"
      accessibilityLabel={`${label} öffnen`}
      onPress={() => Linking.openURL(url)}
    >
      <Ionicons name="document-text-outline" size={17} color={C.primary} />
      <Text style={s.dokumentText}>{label} öffnen</Text>
      <Ionicons name="open-outline" size={15} color={C.sub} />
    </TouchableOpacity>
  );
}

export default function PruefungScreen() {
  const router = useRouter();
  const [laedt, setLaedt] = useState(true);
  const [betreiber, setBetreiber] = useState(true);
  const [fehler, setFehler] = useState('');
  const [liste, setListe] = useState<EinreichungMitLinks[]>([]);
  const [gruende, setGruende] = useState<Record<string, string>>({});
  const [arbeitet, setArbeitet] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    setFehler('');
    const e = await einreichungenLaden();
    if (e.art === 'kein_betreiber') { setBetreiber(false); setLaedt(false); return; }
    if (e.art === 'fehler') { setFehler(e.text); setLaedt(false); return; }
    setListe(e.einreichungen);
    setLaedt(false);
  }, []);

  useFocusEffect(useCallback(() => { laden(); }, [laden]));

  async function handeln(id: string, aktion: 'freigeben' | 'ablehnen') {
    setArbeitet(id);
    const grund = (gruende[id] ?? '').trim();
    const a = await entscheiden(id, aktion, aktion === 'ablehnen' ? grund : undefined);
    setArbeitet(null);
    if (!a.ok) { toast.error(a.text); return; }
    toast.success(aktion === 'freigeben' ? 'Freigegeben' : 'Abgelehnt, Begründung ist unterwegs');
    setListe((l) => l.filter((x) => x.id !== id));
  }

  // Absichtlich derselbe Bildschirm wie fuer eine Adresse, die es nicht gibt.
  // Wer nicht Betreiber ist, soll nicht erfahren, dass es diesen Weg gibt.
  if (!betreiber) {
    return (
      <NichtGefunden
        titel="Seite nicht gefunden"
        text="Diese Adresse gibt es nicht. Vielleicht hat sich ein Tippfehler eingeschlichen."
        knopf="Zur Startseite"
        onKnopf={() => router.replace('/')}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.kopf}>
        <TouchableOpacity
          style={s.zurueck}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => safeBack(router)}
        >
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.titel}>Prüf-Postfach</Text>
        <TouchableOpacity
          style={s.zurueck}
          accessibilityRole="button"
          accessibilityLabel="Neu laden"
          onPress={laden}
        >
          <Ionicons name="refresh-outline" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      {laedt ? (
        <View style={s.mitte}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : fehler ? (
        <View style={s.mitte}>
          <Text style={s.fehler}>{fehler}</Text>
          <TouchableOpacity onPress={laden} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={s.nochmal}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : liste.length === 0 ? (
        <View style={s.mitte}>
          <Ionicons name="checkmark-done-outline" size={44} color={C.border} />
          <Text style={s.leerTitel}>Nichts offen</Text>
          <Text style={s.leerText}>
            Es wartet keine Verifizierung. Neue Einreichungen erscheinen hier,
            sobald ein Betrieb seine Unterlagen abgeschickt hat.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={s.anzahl}>
            {liste.length === 1 ? '1 Betrieb wartet' : `${liste.length} Betriebe warten`}
          </Text>

          {liste.map((e) => {
            const befunde = vorpruefen(e);
            const gesperrt = freigabeGesperrt(befunde);
            const stunden = wartetSeitStunden(e);
            const grund = gruende[e.id] ?? '';
            const grundReicht = grund.trim().length >= MIN_ABLEHNUNGSGRUND;
            const laeuft = arbeitet === e.id;

            return (
              <View key={e.id} style={s.karte}>
                <Text style={s.name}>{e.business_name ?? 'Ohne Betriebsnamen'}</Text>
                <Text style={s.meta}>
                  {e.trade_id ? (categoryById(e.trade_id)?.name ?? e.trade_id) : 'Ohne Gewerk'}
                  {e.full_name ? ` · ${e.full_name}` : ''}
                  {stunden !== null ? ` · wartet ${stunden} h` : ''}
                </Text>

                <View style={s.dokumente}>
                  <Dokument label="Gewerbeschein" url={e.gewerbeschein_url} />
                  <Dokument label="Meisterbrief" url={e.meisterbrief_url} />
                </View>

                {befunde.length > 0 && (
                  <View style={s.befunde}>
                    {befunde.map((b, i) => <BefundZeile key={i} b={b} />)}
                  </View>
                )}

                <Text style={s.hinweis}>
                  Die Punkte oben sind Vorprüfungen über die vorliegenden Felder.
                  Ob ein Dokument echt ist, entscheiden Sie.
                </Text>

                <TextInput
                  style={s.feld}
                  value={grund}
                  onChangeText={(t) => setGruende((g) => ({ ...g, [e.id]: t }))}
                  placeholder={`Grund bei Ablehnung, mindestens ${MIN_ABLEHNUNGSGRUND} Zeichen`}
                  placeholderTextColor={C.muted}
                  multiline
                  editable={!laeuft}
                />

                <View style={s.knoepfe}>
                  <TouchableOpacity
                    style={[s.knopf, s.ablehnen, (!grundReicht || laeuft) && s.aus]}
                    disabled={!grundReicht || laeuft}
                    accessibilityRole="button"
                    accessibilityLabel="Ablehnen"
                    onPress={() => handeln(e.id, 'ablehnen')}
                  >
                    <Text style={[s.knopfText, { color: grundReicht && !laeuft ? C.red : C.muted }]}>
                      Ablehnen
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.knopf, s.freigeben, (gesperrt || laeuft) && s.aus]}
                    disabled={gesperrt || laeuft}
                    accessibilityRole="button"
                    accessibilityLabel="Freigeben"
                    onPress={() => handeln(e.id, 'freigeben')}
                  >
                    {laeuft
                      ? <ActivityIndicator size="small" color={C.surface} />
                      : <Text style={[s.knopfText, { color: gesperrt ? C.muted : C.surface }]}>
                          Freigeben
                        </Text>}
                  </TouchableOpacity>
                </View>

                {gesperrt && (
                  <Text style={s.gesperrtText}>
                    Freigabe gesperrt, solange oben etwas rot ist.
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  kopf:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 paddingHorizontal: 16, paddingVertical: 10 },
  zurueck:     { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  titel:       { ...T.h3, color: C.ink },

  mitte:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  fehler:      { ...T.body, color: C.red, textAlign: 'center' },
  nochmal:     { ...T.btn, color: C.primary },
  leerTitel:   { ...T.h3, color: C.ink, marginTop: 6 },
  leerText:    { ...T.body, color: C.sub, textAlign: 'center', maxWidth: 320 },

  anzahl:      { ...T.label, color: C.sub, marginBottom: 10 },

  karte:       { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1,
                 borderColor: C.border, padding: 16, marginBottom: 14 },
  name:        { ...T.h3, color: C.ink },
  meta:        { ...T.caption, color: C.sub, marginTop: 3, marginBottom: 12 },

  dokumente:   { gap: 8, marginBottom: 12 },
  dokument:    { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
                 paddingHorizontal: 12, backgroundColor: C.primaryBg, borderRadius: 10 },
  dokumentText:{ ...T.btn, color: C.primary, flex: 1, minWidth: 0 },

  befunde:     { gap: 7, marginBottom: 10 },
  befund:      { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  befundText:  { ...T.caption, flex: 1, minWidth: 0 },

  hinweis:     { ...T.caption, color: C.muted, marginBottom: 12 },

  feld:        { ...T.body, color: C.ink, borderWidth: 1, borderColor: C.border,
                 borderRadius: 10, padding: 12, minHeight: 72, textAlignVertical: 'top',
                 backgroundColor: C.bg, marginBottom: 12 },

  knoepfe:     { flexDirection: 'row', gap: 10 },
  knopf:       { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center',
                 justifyContent: 'center', borderRadius: 12 },
  ablehnen:    { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  freigeben:   { backgroundColor: C.primary },
  aus:         { opacity: 0.45 },
  knopfText:   { ...T.btn },

  gesperrtText:{ ...T.caption, color: C.red, marginTop: 8, textAlign: 'center' },
});
