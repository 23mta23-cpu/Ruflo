import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { euro as eur } from '../lib/geld';
import { vertragsLage } from '../lib/vertragsLage';

/** Die vier Toene aus lib/vertragsLage.ts auf die Badge-Varianten. */
const BADGE_TON = { gruen: 'green', gold: 'amber', rot: 'red', grau: 'muted' } as const;
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { R } from '../constants/theme';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { toast } from '../components/ui/Toast';
import { getContractByIdFull, getContractByJobId, ladePartnernamen, type ContractFull, type Partnernamen } from '../lib/contracts';
import { mitZeitgrenze } from '../lib/retry';
import { NichtGefunden } from '../components/ui/NichtGefunden';
import { useAuth } from '../contexts/AuthContext';
import { startPinLesen, arbeitBeginnen } from '../lib/startPin';
import { startPinMeldung, istVollstaendigeEingabe, type StartPinZustand } from '../lib/startPinText';
import { teileText } from '../lib/teilen';
import { terminWeitergabeText, terminDateiname } from '../lib/terminText';


function fmtDt(iso: string | null) {
  if (!iso) return '…';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VertragScreen() {
  const router = useRouter();
  const { contractId, jobId } = useLocalSearchParams<{ contractId?: string; jobId?: string }>();
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [partner, setPartner] = useState<Partnernamen | null>(null);
  // Hoehe der klebenden Fussleiste, gemessen statt geraten.
  //
  // ANLASS (Founder-Screenshot 07.09.2026): Die Leiste ist `position:
  // absolute` und ueberdeckte den Inhalt — „ZAHLUNGSABWICKLUNG (ESCROW)" war
  // mittendrin abgeschnitten, die Unterschriftszeile ebenfalls.
  // Nachgerechnet: die Leiste misst rund 122 px (16 + Hinweis 26 + Knopf 52 +
  // 28), reserviert waren 100.
  // Eine neue feste Zahl waere derselbe Fehler eine Nummer groesser: sobald
  // jemand die Schriftgroesse hochstellt, waechst die Leiste mit und die Zahl
  // stimmt wieder nicht. Deshalb gemessen.
  const [leistenHoehe, setLeistenHoehe] = useState(0);
  const [loading, setLoading] = useState(!!(contractId || jobId));
  const { user } = useAuth();
  // Start-PIN (0960). Der Kunde sieht die Zahl, der Betrieb tippt sie ein.
  // Beim Betrieb liefert die Policy nichts zurueck -- das ist kein Fehler,
  // sondern der Zweck: eine Zahl, die er lesen kann, belegt nichts.
  // Drei Zustaende, nicht zwei: `undefined` heisst „wird noch geladen",
  // `null` heisst „es gibt keine mehr" (eingeloest oder Vertrag beendet, 0970).
  // Ohne die Unterscheidung stuenden vier Punkte da, wo nie wieder eine Zahl
  // kommt -- ein Ladezustand, der nie endet.
  const [startPin, setStartPin] = useState<string | null | undefined>(undefined);
  const [pinEingabe, setPinEingabe] = useState('');
  const [pinLaeuft, setPinLaeuft] = useState(false);
  const [pinZustand, setPinZustand] = useState<StartPinZustand | null>(null);
  const [begonnenAm, setBegonnenAm] = useState<string | null>(null);
  // Termin an eine Vertrauensperson weitergeben. Die Sorge, die eine Person
  // hat, bevor ein Fremder in die Wohnung kommt -- Punkt 4 aus dem
  // Wettbewerbsabgleich.
  const [teiltGerade, setTeiltGerade] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Mit Zeitgrenze: ohne sie stand hier bei gestoerter Verbindung ZEHN
        // SEKUNDEN lang nur die Ueberschrift (gemessen 16.08.2026).
        // Die Namen kommen aus einer eigenen Funktion (0800) — die
        // Vertragsabfrage laedt den Anbieter gar nicht, deshalb stand hier
        // bisher immer das Wort „Anbieter" statt eines Namens.
        let geladen: ContractFull | null = null;
        if (contractId) {
          geladen = await mitZeitgrenze(getContractByIdFull(contractId));
        } else if (jobId) {
          const byJob = await mitZeitgrenze(getContractByJobId(jobId));
          if (byJob) geladen = await mitZeitgrenze(getContractByIdFull(byJob.id));
        }
        setContract(geladen);
        if (geladen?.id) {
          const namen = await mitZeitgrenze(ladePartnernamen([geladen.id]));
          setPartner(namen?.[geladen.id] ?? null);
          setBegonnenAm(geladen.arbeit_begonnen_am ?? null);
          // Getrennt vom Rest und ohne Zeitgrenze-Abbruch des Ganzen: faellt
          // nur diese Abfrage aus, fehlt die Zahl, statt dass der ganze
          // Vertrag nicht laedt.
          startPinLesen(geladen.id).then(setStartPin).catch(() => { /* Zahl entfaellt */ });
        }
      } catch {
        // Der Hinweis bleibt, aber er ist nicht mehr die einzige Absicherung:
        // ohne Vertrag zeigt der Bildschirm unten gar keinen mehr an. Ein
        // Toast verschwindet nach Sekunden, ein erfundener Vertrag blieb
        // stehen.
        toast.error('Vertrag konnte nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }
    if (contractId || jobId) load();
  }, [contractId, jobId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Digitaler Vertrag</Text>
        </View>
        {/* Der Ladezustand bestand nur aus einem Kringel — kein einziges
            Wort. Wer nicht sieht, bekam gar nichts; und auf einem
            Vertragsbildschirm will auch ein Sehender wissen, ob noch geladen
            wird oder schon etwas schiefging. */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.primary} />
          <Text style={{ ...T.body, color: C.sub }}>Vertrag wird geladen …</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Ohne Vertrag KEINEN Vertrag anzeigen.
  //
  // Vorher baute der Bildschirm aus Vorschau- und Ersatzwerten einen
  // vollstaendigen Vertrag samt Nummer und Status "Ausstehend" — der Kommentar
  // im Ladepfad sagte selbst, der Nutzer koenne ihn "fuer seinen echten
  // Vertrag halten". Die Gegenmassnahme war ein Toast; der verschwindet nach
  // Sekunden, der erfundene Vertrag blieb.
  if (!loading && !contract) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            onPress={() => safeBack(router)}
            hitSlop={12}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Digitaler Vertrag</Text>
          <View style={{ width: 44 }} />
        </View>
        <NichtGefunden
          titel="Vertrag nicht gefunden"
          text="Zu diesem Auftrag besteht noch kein Vertrag. Vielleicht gehört er auch nicht zu Ihrem Konto. Ein Vertrag entsteht erst, wenn Sie ein Angebot annehmen."
          knopf="Zu meinen Aufträgen"
          onKnopf={() => safeBack(router, '/(tabs)/auftraege')}
        />
      </SafeAreaView>
    );
  }

  // Derive display values — use real data when available, fallback for preview
  // Fehlt ein Name, wird das BENANNT und nicht mit der Rollenbezeichnung
  // ueberdeckt: „Anbieter" sah aus wie ein Name und war keiner. Ein Vertrag,
  // der eine Partei nicht nennt, ist als Dokument wertlos — dann muss man das
  // auch sehen und nachfragen koennen.
  const customerName = partner?.kunde ?? contract?.customer?.full_name ?? null;
  const providerName = partner?.anbieter ?? null;
  const jobTitle     = contract?.job?.title ?? 'Dienstleistung';
  const priceGross   = contract?.price_gross ?? 0;
  const providerPayout = contract?.provider_payout ?? 0;
  const customerTotal  = contract?.customer_total ?? 0;
  const customerServiceFee = contract?.customer_service_fee ?? 0;
  const providerCommission = contract?.provider_commission ?? 0;
  const jobCity      = contract?.job?.address_city ?? '…';
  const contractDate = contract?.created_at
    ? new Date(contract.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '…';
  const contractIdShort = contractId
    ? `WRK-${contractId.slice(0, 8).toUpperCase()}`
    : 'WRK-PREVIEW';

  // Wer schaut hier zu? Der Vertrag zeigt beiden Seiten dasselbe Dokument,
  // aber NICHT dieselbe Zahl: der Kunde liest sie, der Betrieb tippt sie ein.
  const binKunde   = !!user && contract?.customer_id === user.id;
  const binBetrieb = !!user && contract?.provider_id === user.id;
  // Nachbarschaftshilfe bekommt keine PIN (0960). Ohne Zahl und ohne
  // belegten Zeitpunkt gibt es hier nichts zu zeigen.
  //
  // Der Kunde sieht den Abschnitt nur, solange es etwas zu sehen gibt: eine
  // Zahl oder den belegten Zeitpunkt. Ist die Zahl geloescht und nichts
  // belegt (stornierter Vertrag), gibt es nichts zu zeigen.
  const pinAbschnitt = (contract?.track ?? 'handwerker') !== 'nachbarschaft'
    && (binBetrieb || (binKunde && (startPin !== null || !!begonnenAm)));
  const pinMeldung = pinZustand ? startPinMeldung(pinZustand) : null;

  async function pinEinloesen() {
    if (!contract?.id || !istVollstaendigeEingabe(pinEingabe)) return;
    setPinLaeuft(true);
    try {
      const zustand = await arbeitBeginnen(contract.id, pinEingabe);
      setPinZustand(zustand);
      if (zustand === 'ok') {
        // Den Zeitpunkt NICHT aus der Uhr des Geraets nehmen: der Beleg kommt
        // vom Server, und ein Geraet mit falscher Uhr wuerde hier eine andere
        // Zeit anzeigen als im Vertrag steht.
        const frisch = await getContractByIdFull(contract.id);
        setBegonnenAm(frisch?.arbeit_begonnen_am ?? null);
        setPinEingabe('');
      }
    } catch {
      setPinZustand('fehler');
    } finally {
      setPinLaeuft(false);
    }
  }

  async function terminWeitergeben() {
    if (!contract) return;
    setTeiltGerade(true);
    try {
      // Die Start-PIN wird hier NICHT uebergeben, und `terminWeitergabeText`
      // nimmt sie auch gar nicht entgegen. Eine weitergeleitete Nachricht mit
      // der Zahl haette genau das aufgehoben, wofuer die Zahl da ist.
      const text = terminWeitergabeText({
        leistung: contract.job?.title ?? null,
        betrieb: partner?.anbieter ?? null,
        stadt: contract.job?.address_city ?? null,
        wann: contract.job?.scheduled_at ?? null,
        vertragNummer: contractIdShort,
      });
      const ergebnis = await teileText(
        text,
        terminDateiname(contractIdShort),
        'Handwerkertermin',
      );
      // Kein Erfolg behaupten, den es nicht gab: `teileText` sagt, WAS
      // passiert ist (16.09.).
      if (ergebnis === 'geteilt') toast.success('Termin weitergegeben');
      else if (ergebnis === 'heruntergeladen') toast.success('Als Datei gespeichert, zum Weiterschicken');
      else if (ergebnis === 'fehlgeschlagen') toast.error('Weitergeben hat nicht geklappt');
    } finally {
      setTeiltGerade(false);
    }
  }

  const lage = vertragsLage(contract);
  const isSigned = !!contract?.customer_signed_at && !!contract?.provider_signed_at;
  const providerSignedAt = contract?.provider_signed_at ? fmtDt(contract.provider_signed_at) : undefined;
  const customerSignedAt = contract?.customer_signed_at ? fmtDt(contract.customer_signed_at) : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Digitaler Vertrag</Text>
        {/* Vorher: `isSigned ? 'Aktiv' : 'Ausstehend'` — abgeleitet aus den
            UNTERSCHRIFTEN. Damit stand „Aktiv" auf einem Vertrag, fuer den
            noch gezahlt werden musste, waehrend die Auftragsliste denselben
            Vorgang „Ausstehend" nannte. Jetzt beide aus lib/vertragsLage.ts. */}
        <Badge label={lage.marke} variant={BADGE_TON[lage.ton]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: leistenHoehe + 24 }}>

        <View style={styles.contractIdBar}>
          <Ionicons name="document-text-outline" size={14} color={C.sub} />
          <Text style={styles.contractId}>Vertrag #{contractIdShort}</Text>
          <Text style={styles.contractDate}>{contractDate}</Text>
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vertragsparteien</Text>
          <View style={styles.partiesRow}>
            <PartyCard icon="person"    label="Auftraggeber"  name={customerName} verified />
            <Ionicons name="swap-horizontal" size={20} color={C.muted} />
            <PartyCard icon="briefcase" label="Auftragnehmer" name={providerName} verified />
          </View>
        </View>

        <Divider margin={0} />

        {/* Start-PIN (0960). Der Kunde nennt die Zahl an der Tuer, der Betrieb
            tippt sie ein. Verglichen wird auf dem Server -- wuerde die App die
            Zahl holen und selbst vergleichen, koennte der Betrieb sie im
            Netzverkehr mitlesen und der Beleg waere wertlos. */}
        {pinAbschnitt && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Arbeitsbeginn</Text>

              {begonnenAm ? (
                <View style={styles.pinBelegt}>
                  <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                  <Text style={styles.pinBelegtText}>
                    Belegt am {fmtDt(begonnenAm)}
                  </Text>
                </View>
              ) : binKunde ? (
                <>
                  <View style={styles.pinKasten}>
                    <Text style={styles.pinZahl} accessibilityLabel={
                      startPin ? `Ihre Start-PIN: ${startPin.split('').join(' ')}` : 'Start-PIN wird geladen'
                    }>
                      {startPin ?? '\u00b7\u00b7\u00b7\u00b7'}
                    </Text>
                  </View>
                  <Text style={styles.pinText}>
                    Nennen Sie diese vier Ziffern dem Betrieb, wenn er vor der Tür
                    steht. Erst wenn er sie einträgt, ist der Arbeitsbeginn belegt.
                    Der Betrieb kann die Zahl nicht einsehen.
                  </Text>
                  {/* Ausdruecklich: keine Folge. Eine Wirkung ohne Mechanismus
                      waere eine Zusage, die niemand haelt. */}
                  <Text style={styles.pinNebensatz}>
                    Wird sie nicht eingelöst, hat das keine Folgen für Ihren Auftrag.
                  </Text>
                  {/* Ohne die Zahl. Wer die Nachricht weiterleitet, soll
                      wissen WER kommt, nicht wie er hereinkommt. */}
                  <TouchableOpacity
                    style={styles.teilenKnopf}
                    onPress={terminWeitergeben}
                    disabled={teiltGerade}
                    accessibilityRole="button"
                    accessibilityLabel="Termin an eine Vertrauensperson weitergeben"
                  >
                    <Ionicons name="share-outline" size={16} color={C.primary} />
                    <Text style={styles.teilenKnopfText}>
                      {teiltGerade ? 'Einen Moment …' : 'Termin jemandem weitergeben'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.pinNebensatz}>
                    Weitergegeben werden Leistung, Betrieb, Ort und Zeit. Die vier
                    Ziffern bleiben bei Ihnen.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.pinText}>
                    Lassen Sie sich vom Auftraggeber die vier Ziffern nennen und
                    tragen Sie sie hier ein. Damit ist der Arbeitsbeginn für beide
                    Seiten belegt.
                  </Text>
                  <View style={styles.pinZeile}>
                    <TextInput
                      style={styles.pinFeld}
                      value={pinEingabe}
                      onChangeText={(t) => { setPinEingabe(t.replace(/[^0-9]/g, '').slice(0, 4)); setPinZustand(null); }}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="0000"
                      placeholderTextColor={C.muted}
                      accessibilityLabel="Vier Ziffern der Start-PIN"
                    />
                    <AnimatedButton
                      style={[styles.pinKnopf, (!istVollstaendigeEingabe(pinEingabe) || pinLaeuft) && styles.pinKnopfAus]}
                      onPress={pinEinloesen}
                      disabled={!istVollstaendigeEingabe(pinEingabe) || pinLaeuft}
                      accessibilityRole="button"
                      accessibilityLabel="Arbeitsbeginn belegen"
                    >
                      <Text style={styles.pinKnopfText}>
                        {pinLaeuft ? 'Einen Moment …' : 'Beginn belegen'}
                      </Text>
                    </AnimatedButton>
                  </View>
                  {/* Solange nichts eingetippt ist, sagt der Bildschirm, was
                      fehlt. Ein blasser Knopf ohne Satz ist ein Knopf, der
                      wortlos nichts tut. */}
                  {!istVollstaendigeEingabe(pinEingabe) && !pinMeldung && (
                    <Text style={styles.pinNebensatz}>
                      Vier Ziffern eingeben, dann lässt sich der Beginn belegen.
                    </Text>
                  )}
                  {pinMeldung && (
                    <View style={[styles.pinMeldung, pinMeldung.erfolg && styles.pinMeldungGut]}>
                      <Ionicons
                        name={pinMeldung.erfolg ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                        size={18}
                        color={pinMeldung.erfolg ? C.primary : C.clay}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.pinMeldungTitel}>{pinMeldung.titel}</Text>
                        <Text style={styles.pinMeldungText}>{pinMeldung.text}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
            <Divider margin={0} />
          </>
        )}

        {/* Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vereinbarte Leistung</Text>
          <ContractRow label="Leistung"    value={jobTitle} />
          <ContractRow label="Vereinbarter Preis" value={eur(priceGross)} highlight />
          <ContractRow label="Ort"         value={jobCity} />
          <ContractRow label="Stornierung" value="Kostenlos bis 48h vorher" />
          <View style={styles.feeDivider} />
          <ContractRow label="Plattformgebühr (8%)" value={eur(providerCommission)} />
          <ContractRow label="Auszahlung Anbieter"  value={eur(providerPayout)} highlight />
          {customerServiceFee > 0 && (
            <>
              <View style={styles.feeDivider} />
              <ContractRow label="Service-Gebühr (Kunde)" value={eur(customerServiceFee)} />
              <ContractRow label="Gesamtbetrag (Kunde)"   value={eur(customerTotal)} highlight />
            </>
          )}
        </View>

        <Divider margin={0} />

        {/* Escrow */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zahlungsabwicklung über Treuhandkonto</Text>
          {/* Die Punkte haengen jetzt AUSSCHLIESSLICH an Geld-Merkmalen.
              Vorher wurde der erste gruen, sobald beide unterschrieben hatten —
              der Bildschirm behauptete also hinterlegtes Geld, das nie
              geflossen war. Unterschriften sagen aus, dass man sich geeinigt
              hat; ueber Geld sagen sie nichts. */}
          <View style={styles.escrowBox}>
            {[
              { titel: 'Betrag hinterlegt',
                sub: lage.geldSchritt >= 1
                  ? `${eur(customerTotal)} liegen treuhänderisch bei Stripe`
                  : `${eur(customerTotal)} werden bei der Zahlung hinterlegt` },
              { titel: 'Fertigstellung gemeldet',
                sub: lage.geldSchritt >= 2
                  ? 'Der Betrieb hat die Arbeit als fertig gemeldet'
                  : 'Der Betrieb meldet, wenn die Arbeit fertig ist' },
              { titel: 'Ausgezahlt',
                sub: lage.geldSchritt >= 3
                  ? 'Das Geld ist beim Betrieb'
                  : 'Nach Ihrer Freigabe oder Ablauf der Abnahmefrist' },
            ].map((schritt, i) => (
              <React.Fragment key={schritt.titel}>
                {i > 0 && <View style={styles.escrowLine} />}
                <View style={styles.escrowStep}>
                  <View style={[styles.escrowDot,
                    { backgroundColor: lage.geldSchritt > i ? C.primary : C.border }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.escrowStepTitle}>{schritt.titel}</Text>
                    <Text style={styles.escrowStepSub}>{schritt.sub}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        <Divider margin={0} />

        {/* Legal */}
        <View style={styles.section}>
          <View style={styles.legalBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.sub} />
            <Text style={styles.legalText}>
              <Text style={{ fontWeight: '700' }}>Widerrufsrecht (§ 312g i.V.m. § 355 BGB): </Text>
              Sie können diesen Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen. Das Widerrufsrecht erlischt vorzeitig, wenn die Leistung vor Ablauf der Frist vollständig erbracht wird und Sie dem ausdrücklich zugestimmt haben.
            </Text>
          </View>
        </View>

        <Divider margin={0} />

        <View style={styles.section}>
          <View style={styles.strikeNotice}>
            <Ionicons name="alert-circle-outline" size={16} color={C.amber} />
            <Text style={styles.strikeNoticeText}>
              Preiserhöhung ohne Zustimmung, Nichterscheinen oder Abbruch ohne
              Grund können wir prüfen. Fällt die Prüfung gegen den Betrieb aus,
              vermerken wir das schriftlich und mit Begründung in seinem Konto
              (AGB §7). Melden Sie so etwas über „Problem melden".
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unterschriften</Text>
          <SignatureRow
            name={providerName}
            role="Auftragnehmer"
            signed={!!contract?.provider_signed_at}
            time={providerSignedAt}
          />
          <SignatureRow
            name={customerName}
            role="Auftraggeber"
            signed={!!contract?.customer_signed_at}
            time={customerSignedAt}
          />
        </View>

      </ScrollView>

      {/* CTA — am Vertragsstatus ausgerichtet: pending → zahlen, active → abschließen */}
      {/* Vorher an `status === 'pending'` — waehrend das Abzeichen oben aus den
          Unterschriften kam. Beide fragen jetzt dieselbe Stelle. */}
      {lage.zahlbar && (
        <View style={styles.ctaBar} onLayout={(e) => setLeistenHoehe(e.nativeEvent.layout.height)}>
          <Text style={styles.ctaHint}>Mit Bestätigung akzeptieren Sie alle Vertragsbedingungen</Text>
          <AnimatedButton
            style={styles.ctaBtn}
            onPress={() => router.push({ pathname: '/zahlung', params: { contractId: contractId ?? '' } })}
          >
            <Ionicons name="checkmark-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Vertrag bestätigen & Zahlung starten</Text>
          </AnimatedButton>
        </View>
      )}
      {contract?.status === 'active' && (
        <View style={styles.ctaBar} onLayout={(e) => setLeistenHoehe(e.nativeEvent.layout.height)}>
          <AnimatedButton
            style={[styles.ctaBtn, { backgroundColor: C.primary }]}
            onPress={() => router.push({ pathname: '/auftrag-abschliessen', params: { contractId: contractId ?? '' } })}
          >
            <Ionicons name="checkmark-done-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Auftrag abschließen</Text>
          </AnimatedButton>
        </View>
      )}
    </SafeAreaView>
  );
}

function PartyCard({ icon, label, name, verified }: { icon: string; label: string; name: string | null; verified?: boolean }) {
  // Ohne Namen wird das SICHTBAR gemacht, statt die Rollenbezeichnung als
  // Namen auszugeben. Vorher stand dort schlicht „Anbieter" — das sah aus wie
  // ein Firmenname und war keiner, in einem Dokument, auf das man sich im
  // Streitfall beruft.
  const fehlt = !name;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: fehlt ? C.gold : C.border, borderRadius: 10, padding: 12 }}>
      <Ionicons name={icon as any} size={20} color={C.sub} style={{ marginBottom: 6 }} />
      <Text style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: fehlt ? C.gold : C.ink, textAlign: 'center' }}>
        {name ?? 'Name fehlt'}
      </Text>
      {fehlt
        ? <Text style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 4 }}>Bitte beim Support melden</Text>
        : verified && <Ionicons name="checkmark-circle" size={14} color={C.gold} style={{ marginTop: 4 }} />}
    </View>
  );
}

function ContractRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start', gap: 12 }}>
      <Text style={{ fontSize: 13, color: C.sub, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: highlight ? '700' : '600', color: C.ink, flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function SignatureRow({ name, role, signed, time }: { name: string | null; role: string; signed: boolean; time?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: signed ? C.primary : C.border, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{name ?? 'Name fehlt'}</Text>
        <Text style={{ fontSize: 12, color: C.sub }}>{role}</Text>
      </View>
      {signed
        ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={18} color={C.primary} />
            <Text style={{ fontSize: 11, color: C.primary }}>{time}</Text>
          </View>
        : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={18} color={C.amber} />
            <Text style={{ fontSize: 11, color: C.amber }}>Ausstehend</Text>
          </View>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { ...T.h3, flex: 1, color: C.ink },
  contractIdBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  contractId:       { flex: 1, fontSize: 12, color: C.sub },
  contractDate:     { fontSize: 12, color: C.muted },
  section:          { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle:     { ...T.label, color: C.sub, marginBottom: 14 },
  partiesRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinKasten:        { alignSelf: 'flex-start', backgroundColor: C.primaryBg, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 12, marginBottom: 12 },
  pinZahl:          { fontSize: 32, lineHeight: 40, fontWeight: '700', color: C.primary, letterSpacing: 8 },
  pinText:          { ...T.body, color: C.sub },
  pinNebensatz:     { ...T.caption, color: C.muted, marginTop: 8 },
  pinZeile:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  // minWidth: 0, damit das Feld bei 360 px schrumpfen darf und nicht ueber
  // den Rand laeuft (dokumentierte Falle, 15.08.).
  pinFeld:          { width: 96, minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, backgroundColor: C.surface, paddingHorizontal: 12, fontSize: 20, lineHeight: 26, fontWeight: '700', color: C.ink, letterSpacing: 4, textAlign: 'center' },
  pinKnopf:         { flex: 1, minWidth: 0, minHeight: 48, borderRadius: R.sm, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  pinKnopfAus:      { backgroundColor: C.muted },
  pinKnopfText:     { ...T.btn, color: C.surface },
  pinMeldung:       { flexDirection: 'row', gap: 10, marginTop: 12, padding: 12, borderRadius: R.sm, backgroundColor: C.bgWarm },
  pinMeldungGut:    { backgroundColor: C.primaryBg },
  pinMeldungTitel:  { ...T.body, fontWeight: '700', color: C.ink },
  pinMeldungText:   { ...T.caption, color: C.sub, marginTop: 2 },
  pinBelegt:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinBelegtText:    { ...T.body, color: C.ink, flex: 1, minWidth: 0 },
  teilenKnopf:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 14, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  teilenKnopfText:  { ...T.btn, color: C.primary },
  escrowBox:        { paddingLeft: 8 },
  escrowStep:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  escrowDot:        { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  escrowLine:       { width: 2, height: 20, backgroundColor: C.border, marginLeft: 5 },
  escrowStepTitle:  { ...T.sm, fontWeight: '600', color: C.ink },
  escrowStepSub:    { ...T.caption, fontSize: 12, color: C.sub, marginTop: 1 },
  strikeNotice:     { flexDirection: 'row', gap: 10, backgroundColor: C.amberBg, borderRadius: 10, padding: 12 },
  strikeNoticeText: { flex: 1, fontSize: 12, color: C.amber, lineHeight: 18 },
  feeDivider:       { height: 1, backgroundColor: C.border, marginVertical: 8 },
  legalBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.bgWarm, borderRadius: 10, padding: 12 },
  legalText:        { ...T.caption, flex: 1, color: C.sub, lineHeight: 17 },
  ctaBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaHint:          { ...T.caption, color: C.muted, textAlign: 'center', marginBottom: 10 },
  ctaBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  ctaBtnText:       { ...T.body, fontWeight: '700', color: C.surface },
});
