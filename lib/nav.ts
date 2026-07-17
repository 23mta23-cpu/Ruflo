import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Zurück mit Fallback: Bei Cold-Deep-Links (geteilter Link, Browser-Neustart)
 * gibt es keine History — router.back() wäre ein toter Button und der Nutzer
 * säße fest (Tester-Agent-Befund 17.07.). Dann stattdessen zur Startseite.
 */
export function safeBack(router: Router): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
