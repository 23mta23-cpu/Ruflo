// Die Zustell-Schleife am Geldweg ausfuehren, nicht nur typpruefen.
//
// Die Zusage, die hier haengt: eine Mitteilung wie „€840,00 wurden ausgezahlt"
// muss den Empfaenger erreichen, auch wenn er kein Telefon mit der App hat.
// Bis 14.09.2026 tat sie das nicht: fuenf Functions trugen je ein eigenes
// `sendPush(tokens)` mit `if (!tokens.length) return;` — und auf dem Web ist
// `push_token` immer null.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  benachrichtigen, mailRumpf, type Profil, type Versand,
} from "../functions/_shared/benachrichtigen.ts";

type Spur = { pushs: string[]; mails: string[] };

function versand(profile: Record<string, Profil | null>, spur: Spur, opt: {
  mailEingerichtet?: boolean;
  pushWirft?: boolean;
  mailWirft?: boolean;
} = {}): Versand {
  return {
    mailEingerichtet: opt.mailEingerichtet ?? true,
    profilLesen: (id) => Promise.resolve(profile[id] ?? null),
    push: (token) => {
      if (opt.pushWirft) return Promise.reject(new Error("Expo 400"));
      spur.pushs.push(token);
      return Promise.resolve();
    },
    mail: (email) => {
      if (opt.mailWirft) return Promise.reject(new Error("Resend 422"));
      spur.mails.push(email);
      return Promise.resolve();
    },
  };
}

const mitApp: Profil  = { push_token: "ExpoTok[a]", email: "a@example.com", mail_benachrichtigungen: true };
const imWeb: Profil   = { push_token: null,         email: "w@example.com", mail_benachrichtigungen: true };
const abbestellt: Profil = { push_token: null,      email: "n@example.com", mail_benachrichtigungen: false };
const ohneMail: Profil   = { push_token: null,      email: null,            mail_benachrichtigungen: true };

Deno.test("Web-Nutzer ohne Token bekommt eine E-Mail — der ganze Anlass", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(
    ["w"], "Zahlung erhalten", "€840,00 wurden ausgezahlt.", { screen: "/betrieb/auftraege" },
    versand({ w: imWeb }, spur),
  );
  assertEquals(b, { empfaenger: 1, push: 0, mail: 1, ohneWeg: 0, fehlgeschlagen: 0 });
  assertEquals(spur.mails, ["w@example.com"]);
});

Deno.test("wer die App hat, bekommt Push und KEINE Mail", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(["a"], "T", "B", {}, versand({ a: mitApp }, spur));
  assertEquals(b.push, 1);
  assertEquals(b.mail, 0);
  assertEquals(spur.pushs, ["ExpoTok[a]"]);
});

Deno.test("abbestellt heisst abbestellt, auch bei einer Geldmitteilung", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(["n"], "T", "B", {}, versand({ n: abbestellt }, spur));
  assertEquals(b.ohneWeg, 1);
  assertEquals(spur.mails, []);
});

Deno.test("ohne Adresse und ohne Token gibt es keinen Weg", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(["o"], "T", "B", {}, versand({ o: ohneMail }, spur));
  assertEquals(b.ohneWeg, 1);
});

Deno.test("ohne eingerichteten Mailversand faellt niemand durch, es wird gezaehlt", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(
    ["w"], "T", "B", {}, versand({ w: imWeb }, spur, { mailEingerichtet: false }),
  );
  assertEquals(b, { empfaenger: 1, push: 0, mail: 0, ohneWeg: 1, fehlgeschlagen: 0 });
});

Deno.test("ein unbekannter Empfaenger haelt die uebrigen nicht auf", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(["gibtsnicht", "w"], "T", "B", {}, versand({ w: imWeb }, spur));
  assertEquals(b.ohneWeg, 1);
  assertEquals(b.mail, 1);
  assertEquals(spur.mails, ["w@example.com"]);
});

Deno.test("ein gescheiterter Versand wirft NICHT — der Geldweg laeuft weiter", async () => {
  // Wenn Stripe ausgezahlt hat, ist das Geld unterwegs. Eine nicht zugestellte
  // Mail darf daran nichts mehr aendern, und schon gar nicht die Function
  // abbrechen lassen.
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(
    ["w"], "T", "B", {}, versand({ w: imWeb }, spur, { mailWirft: true }),
  );
  assertEquals(b, { empfaenger: 1, push: 0, mail: 0, ohneWeg: 0, fehlgeschlagen: 1 });
});

Deno.test("ein gescheiterter Push haelt den naechsten Empfaenger nicht auf", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen(
    ["a", "w"], "T", "B", {}, versand({ a: mitApp, w: imWeb }, spur, { pushWirft: true }),
  );
  assertEquals(b.fehlgeschlagen, 1);
  assertEquals(b.mail, 1);
});

Deno.test("keine Empfaenger ist kein Fehler", async () => {
  const spur: Spur = { pushs: [], mails: [] };
  const b = await benachrichtigen([], "T", "B", {}, versand({}, spur));
  assertEquals(b, { empfaenger: 0, push: 0, mail: 0, ohneWeg: 0, fehlgeschlagen: 0 });
});

Deno.test("Nutzertext im Mailrumpf wird maskiert", async () => {
  // Auftragstitel kommen vom Kunden und landen in HTML.
  const html = mailRumpf('Bad <script>alert(1)</script>', 'Betrieb "Müller & Sohn"');
  assertEquals(html.includes("<script>"), false);
  assertEquals(html.includes("&lt;script&gt;"), true);
  assertEquals(html.includes("Müller &amp; Sohn"), true);
});
