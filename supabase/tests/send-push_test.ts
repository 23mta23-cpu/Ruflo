// kanalWaehlen — welcher Kanal, und wenn keiner: warum nicht.
//
// ANLASS (12.09.2026): In send-push stand
//
//     if (!token) return { sent: false, reason: "no_token" };
//
// Das sah nach einem harmlosen Sonderfall aus und war fuer die Web-App der
// NORMALFALL: lib/notifications.ts registriert bei Platform.OS === 'web'
// ueberhaupt keinen Token. Alle neun Benachrichtigungs-Ausloeser endeten
// damit still hier, ohne Fehler und ohne Zustellung.

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { kanalWaehlen } from "../functions/send-push/kanal.ts";

const basis = {
  token: null as string | null,
  email: "kunde@example.de",
  mailErlaubt: true,
  mailEingerichtet: true,
};

Deno.test("mit Token gewinnt Push", () => {
  assertEquals(kanalWaehlen({ ...basis, token: "ExponentPushToken[x]" }), { kanal: "push" });
});

Deno.test("ohne Token faellt es auf E-Mail zurueck (der Web-Normalfall)", () => {
  assertEquals(kanalWaehlen(basis), { kanal: "e-mail" });
});

Deno.test("abbestellt schlaegt alles andere", () => {
  // Wer Benachrichtigungen abbestellt hat, bekommt auch keinen Rueckfall.
  assertEquals(
    kanalWaehlen({ ...basis, mailErlaubt: false }),
    { kanal: "keiner", grund: "abbestellt" },
  );
});

Deno.test("ohne Adresse geht nichts, und der Grund sagt das", () => {
  assertEquals(
    kanalWaehlen({ ...basis, email: "   " }),
    { kanal: "keiner", grund: "keine_adresse" },
  );
  assertEquals(
    kanalWaehlen({ ...basis, email: null }),
    { kanal: "keiner", grund: "keine_adresse" },
  );
});

Deno.test("fehlender Resend-Schluessel ist unser Problem, nicht seins", () => {
  assertEquals(
    kanalWaehlen({ ...basis, mailEingerichtet: false }),
    { kanal: "keiner", grund: "mail_nicht_eingerichtet" },
  );
});

Deno.test("die Gruende nennen den, der sie aendern kann", () => {
  // Reihenfolge: erst der Wille des Nutzers, dann seine Daten, zuletzt unsere
  // Einrichtung. Wer abbestellt hat, soll nicht "mail_nicht_eingerichtet"
  // lesen -- das waere eine Ausrede statt einer Auskunft.
  assertEquals(
    kanalWaehlen({ token: null, email: null, mailErlaubt: false, mailEingerichtet: false }),
    { kanal: "keiner", grund: "abbestellt" },
  );
  assertEquals(
    kanalWaehlen({ token: null, email: null, mailErlaubt: true, mailEingerichtet: false }),
    { kanal: "keiner", grund: "keine_adresse" },
  );
});

Deno.test("unbekannte Einwilligung gilt als erlaubt (Spalte hat Vorgabe true)", () => {
  assertEquals(kanalWaehlen({ ...basis, mailErlaubt: null }), { kanal: "e-mail" });
  assertEquals(kanalWaehlen({ ...basis, mailErlaubt: undefined }), { kanal: "e-mail" });
});
