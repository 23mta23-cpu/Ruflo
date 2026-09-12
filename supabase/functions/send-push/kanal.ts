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

/** Nutzertexte (Auftragstitel, Betriebsname) landen in HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
