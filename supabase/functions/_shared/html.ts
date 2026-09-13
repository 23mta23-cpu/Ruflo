// Nutzertexte, die in eine Mail geraten, muessen maskiert werden.
//
// ANLASS (12.09.2026, Selbst-Check): `notify-matching-providers` setzte den
// Auftragstitel roh in das HTML der Mail an passende Anbieter. Den Titel
// schreibt der KUNDE. Ein Titel wie
//
//     Heizung defekt<a href="https://…">Jetzt anmelden</a>
//
// haette damit einen fremden Link in eine Mail gebracht, die nachweislich von
// Werkant kommt und deren Absender-Domain korrekt signiert ist. Das ist der
// wirksamste Phishing-Traeger, den eine Plattform verschenken kann. Skripte
// filtern die meisten Mailprogramme; Links und Text filtern sie nicht.
//
// Vier von fuenf Versandwegen maskierten bereits (send-push, waitlist-doi,
// zustellung, und verify-email setzt nur eine selbst gebaute URL ein). Diese
// Stelle war die einzige Ausnahme. Damit daraus keine dritte Kopie derselben
// Funktion wird, steht sie hier.
//
// NICHT fuer `subject` benutzen: eine Betreffzeile ist kein HTML, dort wuerde
// aus einem "&" ein sichtbares "&amp;".
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
