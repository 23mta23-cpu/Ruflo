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
  einreichungenLaden, entscheiden, wartendesLaden, MIN_ABLEHNUNGSGRUND,
  type EinreichungMitLinks, type WartendeReklamation, type WartendeMeldung,
} from '../lib/pruefungApi';
import { reklamationsLage, meldungsLage, wartetSeitText, type Dringlichkeit } from '../lib/wartendes';
import { euro } from '../lib/geld';

/**
 * Reklamationen und Inhalts-Meldungen, NUR LESEND.
 *
 * ANLASS (21.09.2026): Beide Tabellen werden geschrieben und von niemandem
 * gelesen. Bei den Reklamationen haengt Geld daran -- 0770 bricht die
 * automatische Auszahlung mit `dispute_open` ab, eine offene Reklamation
 * friert den Treuhandbetrag ein, fuer beide Seiten und unbefristet, waehrend
 * `app/reklamation.tsx` dem Kunden zwei Werktage zusagt.
 *
 * Hier wird NICHTS entschieden. Eine Entscheidung ueber eine Reklamation
 * bewegt Geld (voll erstatten, teilweise, freigeben); das ist ein
 * Produktentwurf mit Geldfolgen und gehoert dem Founder. Sichtbarkeit ist die
 * Haelfte des Problems und hat keine Geldfolgen -- deshalb dieser Schritt
 * zuerst und allein.
 */
const KATEGORIE_NAMEN: Record<string, string> = {
  quality: 'Qualität', noshow: 'Nicht erschienen', price: 'Preis',
  damage: 'Schaden', communication: 'Kommunikation', other: 'Sonstiges',
};

function LageMarke({ lage }: { lage: Dringlichkeit }) {
  if (lage === 'frisch') return null;
  const rot = lage === 'ueberfaellig';
  return (
    <View style={[s.marke, { backgroundColor: rot ? C.redBg : C.goldBg }]}>
      <Text style={[s.markeText, { color: rot ? C.red : C.gold }]}>
        {rot ? 'Überfällig' : 'Heute fällig'}
      </Text>
    </View>
  );
}

function WartendeAbschnitte({
  reklamationen, meldungen,
}: { reklamationen: WartendeReklamation[]; meldungen: WartendeMeldung[] }) {
  // `jetzt` einmal pro Rendern, als Parameter weitergereicht. Ein `useMemo`
  // mit `new Date()` innen friert das Datum beim ersten Oeffnen ein, und
  // Reiter-Bildschirme bleiben in expo-router tagelang eingehaengt (Lehre
  // vom 08.09.).
  const jetzt = new Date();
  if (reklamationen.length === 0 && meldungen.length === 0) return null;
  return (
    <>
      {reklamationen.length > 0 && (
        <View style={s.abschnitt}>
          <Text style={s.abschnittTitel}>
            {reklamationen.length === 1 ? '1 Reklamation' : `${reklamationen.length} Reklamationen`}
          </Text>
          <Text style={s.abschnittHinweis}>
            Solange eine Reklamation offen ist, bleibt der Treuhandbetrag
            gesperrt. Entschieden wird vorerst im Supabase-Dashboard.
          </Text>
          {reklamationen.map((r) => (
            <View key={r.id} style={s.karte}>
              <View style={s.zeile}>
                <Text style={s.name}>{KATEGORIE_NAMEN[r.category] ?? r.category}</Text>
                <LageMarke lage={reklamationsLage(r.created_at, jetzt)} />
              </View>
              <Text style={s.meta}>
                {r.case_id} · {wartetSeitText(r.created_at, jetzt)}
                {r.contract?.customer_total != null
                  ? ` · ${euro(r.contract.customer_total)} gesperrt`
                  : ''}
              </Text>
              {r.description ? <Text style={s.auszug}>{r.description}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {meldungen.length > 0 && (
        <View style={s.abschnitt}>
          <Text style={s.abschnittTitel}>
            {meldungen.length === 1 ? '1 Inhalts-Meldung' : `${meldungen.length} Inhalts-Meldungen`}
          </Text>
          <Text style={s.abschnittHinweis}>
            Art. 16 DSA verlangt eine sorgfältige und zeitnahe Bearbeitung.
            Entschieden wird vorerst im Supabase-Dashboard.
          </Text>
          {meldungen.map((m) => (
            <View key={m.id} style={s.karte}>
              <View style={s.zeile}>
                <Text style={s.name}>{m.inhalt_art}</Text>
                <LageMarke lage={meldungsLage(m.eingegangen_am, jetzt)} />
              </View>
              <Text style={s.meta}>
                {m.melder_name} · {wartetSeitText(m.eingegangen_am, jetzt)}
              </Text>
              <Text style={s.meta}>{m.fundstelle}</Text>
              {m.begruendung ? <Text style={s.auszug}>{m.begruendung}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

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
  const [reklamationen, setReklamationen] = useState<WartendeReklamation[]>([]);
  const [meldungen, setMeldungen] = useState<WartendeMeldung[]>([]);
  const [gruende, setGruende] = useState<Record<string, string>>({});
  const [arbeitet, setArbeitet] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    setFehler('');
    const e = await einreichungenLaden();
    if (e.art === 'kein_betreiber') { setBetreiber(false); setLaedt(false); return; }
    if (e.art === 'fehler') { setFehler(e.text); setLaedt(false); return; }
    setListe(e.einreichungen);

    // Die beiden anderen Warteschlangen. Sie duerfen den Bildschirm NICHT
    // umwerfen: bleibt diese Abfrage aus, ist die Verifizierungsliste
    // trotzdem da. Deshalb kein gemeinsamer Fehlerzustand.
    const w = await wartendesLaden();
    if (w.art === 'ok') { setReklamationen(w.reklamationen); setMeldungen(w.meldungen); }
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
      ) : (liste.length === 0 && reklamationen.length === 0 && meldungen.length === 0) ? (
        <View style={s.mitte}>
          <Ionicons name="checkmark-done-outline" size={44} color={C.border} />
          <Text style={s.leerTitel}>Nichts offen</Text>
          <Text style={s.leerText}>
            Es wartet keine Verifizierung, keine Reklamation und keine Meldung.
            Neue Vorgänge erscheinen hier von selbst.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {liste.length > 0 && (
            <Text style={s.anzahl}>
              {liste.length === 1 ? '1 Betrieb wartet' : `${liste.length} Betriebe warten`}
            </Text>
          )}

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

          <WartendeAbschnitte reklamationen={reklamationen} meldungen={meldungen} />
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
  abschnitt:       { marginTop: 26 },
  abschnittTitel:  { ...T.label, color: C.sub, marginBottom: 4 },
  abschnittHinweis:{ ...T.caption, color: C.sub, marginBottom: 10 },
  zeile:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  marke:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  markeText:       { ...T.caption, fontWeight: '700' },
  auszug:          { ...T.sm, color: C.sub, marginTop: 2 },

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
