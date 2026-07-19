import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Zurück mit Fallback: Bei Cold-Deep-Links (geteilter Link, Browser-Neustart)
 * gibt es keine History — router.back() wäre ein toter Button und der Nutzer
 * säße fest (Tester-Agent-Befund 17.07.). Dann stattdessen zur Startseite.
 */
export function safeBack(router: Router, fallback: string = '/'): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as never);
  }
}

/**
 * Harter Stack-Reset nach abgeschlossenen Flows (Auftrag eingereicht,
 * Login mit Entwurf-Resume): router.replace() ersetzt nur den obersten
 * Eintrag — die alte Wizard-Instanz (z. B. „Schritt 4 von 4") bleibt
 * darunter im Stack und taucht bei „Zurück" wieder auf (Founder-Befund
 * 19.07.). dismissAll() räumt den Stack bis zur Wurzel, replace tauscht
 * dann auch die Wurzel gegen das Ziel.
 */
export function resetTo(router: Router, href: string | { pathname: string; params?: Record<string, string> }): void {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch { /* Tabs-Root o. Ä. — nichts zu dismissen */ }
  router.replace(href as never);
}
