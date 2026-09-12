// Die Kanalwahl, ohne jede Abhängigkeit — damit sie prüfbar ist.
//
// ANLASS (12.09.2026): In index.ts stand
//
//     if (!token) return { sent: false, reason: "no_token" };
//
// Das sah nach einem harmlosen Sonderfall aus und war für die Web-App der
// NORMALFALL: lib/notifications.ts registriert bei Platform.OS === 'web'
// überhaupt keinen Token. Alle neun Benachrichtigungs-Auslöser endeten damit
// still hier, ohne Fehler und ohne Zustellung.
//
// Eigene Datei und nicht in index.ts, weil dort `createClient` auf Modulebene
// läuft: ein Test, der nur diese Funktion braucht, scheiterte sonst an
// "supabaseUrl is required".

export type Kanal =
  | { kanal: "push" }
  | { kanal: "e-mail" }
  | { kanal: "keiner"; grund: "abbestellt" | "keine_adresse" | "mail_nicht_eingerichtet" };

export function kanalWaehlen(p: {
  token: string | null | undefined;
  email: string | null | undefined;
  mailErlaubt: boolean | null | undefined;
  mailEingerichtet: boolean;
}): Kanal {
  if (p.token) return { kanal: "push" };
  // Reihenfolge nach Verantwortung: zuerst der Wille des Nutzers, dann seine
  // Daten, zuletzt unsere Einrichtung. So nennt der Grund immer den, der ihn
  // ändern kann. Wer abbestellt hat, soll nicht "mail_nicht_eingerichtet"
  // lesen — das wäre eine Ausrede statt einer Auskunft.
  if (p.mailErlaubt === false) return { kanal: "keiner", grund: "abbestellt" };
  if (!p.email || !p.email.trim()) return { kanal: "keiner", grund: "keine_adresse" };
  if (!p.mailEingerichtet) return { kanal: "keiner", grund: "mail_nicht_eingerichtet" };
  return { kanal: "e-mail" };
}

/**
 * Nutzertexte (Auftragstitel, Betriebsname) landen in HTML.
 * Steht seit 12.09.2026 in ../_shared/html.ts, weil notify-matching-providers
 * sie ebenfalls braucht. Hier nur weitergereicht, damit die bestehenden
 * Importeure unveraendert bleiben.
 */
export { escapeHtml } from "../_shared/html.ts";

// ── Takt fuer haeufige Mitteilungen ────────────────────────────────────────
//
// ANLASS (12.09.2026, unmittelbare Folge des Rueckfalls oben): Seit Push auf
// dem Web auf E-Mail ausweicht, erzeugt JEDE Chat-Nachricht eine E-Mail — und
// auf dem Web ist das derzeit jeder Nutzer. Zehn Nachrichten in einem Gespraech
// sind zehn Mails.
//
// Das ist nicht nur laestig. Die Kette ist: viele Mails -> Beschwerden ->
// Ruf der Absender-Domain -> und dann kommen ausgerechnet die Mitteilungen
// nicht mehr an, die Werkant SCHULDET (Strike nach AGB §7(4), Beschraenkung
// nach DSA Art. 17). Der bequemste Kanal beschaedigt den pflichtigen.
//
// Gedrosselt wird nur die E-Mail, NICHT der Push: eine Geraete-Mitteilung pro
// Nachricht ist erwartbar und kostet keinen Ruf.
//
// Gedrosselt wird auch nur, was haeufig ist. „Angebot angenommen" oder
// „Zahlung freigeben" kommen selten und sind einzeln wichtig — sie einer
// Drossel zu unterwerfen hiesse, das Seltene fuer das Haeufige zu bestrafen.
export const MAIL_TAKT_FENSTER_S = 1800;  // 30 Minuten
export const MAIL_TAKT_ANZAHL    = 1;

/** Ist das eine Mitteilungsart, die in Serie auftritt? */
export function istHaeufig(screen: unknown): boolean {
  return screen === "/chat";
}

/** Der Schluessel ist pro Empfaenger, nicht pro Gespraech: zwei Gespraeche
 *  gleichzeitig sind fuer den Posteingang dasselbe Problem wie eines. */
export function taktSchluessel(empfaenger: string): string {
  return `mailtakt:${empfaenger}:chat`;
}
