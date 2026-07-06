// Schlanke, consent-respektierende Event-Erfassung (Launch-Basis).
//
// Design (docs/analytics/EVENTS.md):
// - Kein externer Dienst angebunden — Events landen in einem lokalen
//   AsyncStorage-Ringpuffer (max. 200) und im Dev-Log. Der Sink ist bewusst
//   eine einzige Funktion (flushSink), damit PostHog/Plausible/Supabase
//   später ohne Änderung der Aufrufstellen angeschlossen werden kann.
// - Consent: Events werden NUR erfasst, wenn der Nutzer Analyse zugestimmt
//   hat (werkr_consent_v1.analytics, überschreibbar per Einstellungs-Toggle
//   werkr_prefs_v1.analytics). Default: aus.
// - Keine personenbezogenen Daten: Aufrufstellen dürfen nur technische
//   Properties übergeben (Kategorie-Id, Track, Fehler-Kontext) — niemals
//   Namen, E-Mail, PLZ, Freitext oder Ids, die Rückschlüsse erlauben.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_KEY = 'werkr_consent_v1';
const PREFS_KEY = 'werkr_prefs_v1';
const EVENTS_KEY = 'werkr_events_v1';
const MAX_EVENTS = 200;
const CONSENT_CACHE_MS = 60_000;

export type AnalyticsEvent = {
  name: string;
  props?: Record<string, string | number | boolean>;
  ts: string;
};

let consentCache: { allowed: boolean; readAt: number } | null = null;

async function analyticsAllowed(): Promise<boolean> {
  if (consentCache && Date.now() - consentCache.readAt < CONSENT_CACHE_MS) {
    return consentCache.allowed;
  }
  let allowed = false;
  try {
    const [consentRaw, prefsRaw] = await Promise.all([
      AsyncStorage.getItem(CONSENT_KEY),
      AsyncStorage.getItem(PREFS_KEY),
    ]);
    const consent = consentRaw ? JSON.parse(consentRaw) : null;
    allowed = consent?.analytics === true;
    // Einstellungs-Toggle überschreibt den Erst-Consent in beide Richtungen
    const prefs = prefsRaw ? JSON.parse(prefsRaw) : null;
    if (typeof prefs?.analytics === 'boolean') allowed = prefs.analytics;
  } catch {
    allowed = false;
  }
  consentCache = { allowed, readAt: Date.now() };
  return allowed;
}

/** Nach Consent-Änderung aufrufen (Einstellungen), damit der Cache nicht nachhängt. */
export function invalidateConsentCache(): void {
  consentCache = null;
}

async function flushSink(event: AnalyticsEvent): Promise<void> {
  // Lokaler Ringpuffer — einziger Anschlusspunkt für einen echten Provider.
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const events: AnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // Analytics darf nie die App stören
  }
  if (__DEV__) console.log('[analytics]', event.name, event.props ?? '');
}

/**
 * Fire-and-forget Event-Erfassung. Niemals awaiten an Aufrufstellen,
 * niemals PII in props.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
): void {
  analyticsAllowed()
    .then((ok) => {
      if (!ok) return;
      return flushSink({ name, props, ts: new Date().toISOString() });
    })
    .catch(() => {});
}

/** Kurzform für Fehler-Erfassung — context ist ein technischer Ort, keine Message. */
export function trackError(context: string): void {
  trackEvent('error_occurred', { context });
}

/** Für Debug-/Support-Zwecke: lokal gepufferte Events lesen. */
export async function getBufferedEvents(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
