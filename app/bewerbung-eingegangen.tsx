import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '../constants/colors';
import { showAlert } from '../lib/alert';

export default function BewerbungEingegangen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.root}>
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <View style={styles.outerRing}>
              <View style={styles.innerCircle}>
                <Ionicons name="time-outline" size={32} color={C.gold} />
              </View>
            </View>
          </View>

          <Text style={styles.heading}>Bewerbung eingegangen!</Text>
          <Text style={styles.subtext}>
            Wir überprüfen Ihre Unterlagen sorgfältig. Das dauert in der Regel 1–3 Werktage.
          </Text>

          <View style={styles.timelineCard}>
            <View style={styles.timelineRow}>
              <View style={styles.timelineIndicator}>
                <View style={[styles.stepDot, styles.stepDotGreen]}>
                  <Ionicons name="checkmark" size={14} color={C.surface} />
                </View>
                <View style={[styles.connector, styles.connectorSolid]} />
              </View>
              <View style={styles.timelineText}>
                <Text style={styles.stepLabel}>Bewerbung eingereicht</Text>
                <Text style={styles.stepSub}>Heute, soeben</Text>
              </View>
            </View>

            <View style={styles.timelineRow}>
              <View style={styles.timelineIndicator}>
                <View style={[styles.stepDot, styles.stepDotAmber]}>
                  <Ionicons name="time-outline" size={14} color={C.surface} />
                </View>
                <View style={[styles.connector, styles.connectorDashed]} />
              </View>
              <View style={styles.timelineText}>
                <Text style={styles.stepLabel}>Dokumentenprüfung</Text>
                <Text style={styles.stepSub}>Aktueller Schritt · ~1–2 Werktage</Text>
              </View>
            </View>

            <View style={[styles.timelineRow, styles.timelineRowLast]}>
              <View style={styles.timelineIndicator}>
                <View style={[styles.stepDot, styles.stepDotMuted]} />
              </View>
              <View style={styles.timelineText}>
                <Text style={[styles.stepLabel, styles.stepLabelMuted]}>
                  Freischaltung &amp; Stripe-Anbindung
                </Text>
                <Text style={styles.stepSub}>Nach Genehmigung</Text>
              </View>
            </View>
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.nextHeading}>Was passiert als nächstes?</Text>
            <View style={styles.nextRow}>
              <Ionicons name="mail-outline" size={20} color={C.gold} style={styles.nextIcon} />
              <Text style={styles.nextText}>
                Sie erhalten eine E-Mail, sobald Ihr Profil genehmigt ist.
              </Text>
            </View>
            <View style={styles.nextRow}>
              <Ionicons name="card-outline" size={20} color={C.gold} style={styles.nextIcon} />
              <Text style={styles.nextText}>
                Danach richten Sie Ihr Stripe-Konto ein — in ca. 5 Minuten.
              </Text>
            </View>
            <View style={styles.nextRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={C.gold}
                style={styles.nextIcon}
              />
              <Text style={styles.nextText}>
                Ab dann können Sie Anfragen annehmen und Angebote senden.
              </Text>
            </View>
          </View>

          <View style={styles.supportRow}>
            <Text style={styles.supportText}>Fragen? </Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:support@werkr.de')}>
              <Text style={styles.supportLink}>Kontakt aufnehmen</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/landing')}>
            <Text style={styles.primaryBtnText}>Zur Startseite</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() =>
              showAlert(
                'Bewerbung in Prüfung',
                'Ihre Bewerbung wird geprüft. Bei Rückfragen erhalten Sie eine E-Mail.',
              )
            }
          >
            <Text style={styles.outlineBtnText}>Meine Bewerbung prüfen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const OUTER = 80;
const INNER = 60;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  outerRing: {
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    borderWidth: 2,
    borderColor: C.gold,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 15,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  timelineCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineRowLast: {
    marginBottom: 0,
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 28,
    marginRight: 14,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotGreen: {
    backgroundColor: C.green,
  },
  stepDotAmber: {
    backgroundColor: C.amber,
  },
  stepDotMuted: {
    backgroundColor: C.border,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.muted,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 3,
  },
  connectorSolid: {
    backgroundColor: C.border,
  },
  connectorDashed: {
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    borderStyle: 'dashed',
    width: 0,
    alignSelf: 'center',
  },
  timelineText: {
    flex: 1,
    paddingBottom: 20,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
    marginBottom: 2,
  },
  stepLabelMuted: {
    color: C.muted,
    fontWeight: '500',
  },
  stepSub: {
    fontSize: 12,
    color: C.sub,
  },
  nextCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 20,
    gap: 14,
  },
  nextHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: C.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nextIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  nextText: {
    flex: 1,
    fontSize: 14,
    color: C.ink,
    lineHeight: 20,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportText: {
    fontSize: 14,
    color: C.sub,
  },
  supportLink: {
    fontSize: 14,
    color: C.gold,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
    paddingTop: 8,
  },
  primaryBtn: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.surface,
  },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  outlineBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.gold,
  },
});
