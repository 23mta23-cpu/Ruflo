// Eine Mitteilung an einen Nutzer bringen — auf dem Weg, den dieser Nutzer hat.
//
// ANLASS (14.09.2026): Am 12.09. bekam `send-push` einen Rueckfall auf E-Mail,
// weil `lib/notifications.ts` auf dem Web ueberhaupt keinen Push-Token
// registriert und deshalb JEDE Mitteilung an JEDEN Web-Nutzer still verfiel.
//
// Fuenf weitere Functions haben diesen Rueckfall nie bekommen. Jede trug ihr
// eigenes `sendPush(tokens: string[], ...)` mit derselben ersten Zeile:
//
//     if (!tokens.length) return;
//
// Und jede holte sich die Token selbst:
//
//     .select("push_token") ... return data?.push_token ? [data.push_token] : [];
//
// Auf dem Web ist `push_token` immer null. Damit erreichte
//
//     „€840,00 für „Bad sanieren" wurden ausgezahlt."   (release-escrow)
//     „Escrow für „…" hinterlegt. Die Arbeit kann beginnen."  (stripe-webhook)
//     „Ihr Auftrag wurde storniert."                    (cancel-contract)
//     die PStTG-Meldung ans BZSt                        (pstg-annual-report)
//
// KEINEN EINZIGEN Web-Nutzer. Ausgerechnet die Mitteilungen am Geldweg, waehrend
// die Chat-Mitteilungen seit dem 12.09. ankommen. Genau verkehrt herum.
//
// Die Ursache ist nicht der fehlende Rueckfall, sondern dass es ihn sechsmal
// geben musste. Deshalb steht die Zustellung ab jetzt hier, einmal.
//
// KEINE Drosselung auf diesem Weg, anders als in send-push: dort gibt es sie
// fuer Chat-Mitteilungen, die in Serie auftreten. Hier tritt nichts in Serie
// auf — eine Auszahlung, eine Stornierung, eine Jahresmeldung. Eine Drossel
// waere die Gelegenheit, genau die Mitteilung zu verlieren, die zaehlt.

import { kanalWaehlen } from "../send-push/kanal.ts";
import { escapeHtml } from "./html.ts";

export type Profil = {
  push_token: string | null;
  email: string | null;
  mail_benachrichtigungen: boolean | null;
};

/** Alles, was nach draussen geht — injiziert, damit die Schleife pruefbar ist. */
export type Versand = {
  profilLesen: (empfaenger: string) => Promise<Profil | null>;
  push: (token: string, titel: string, text: string, daten: Record<string, string>) => Promise<void>;
  mail: (email: string, titel: string, text: string) => Promise<void>;
  /** Ob RESEND_API_KEY und WAITLIST_FROM_EMAIL gesetzt sind. */
  mailEingerichtet: boolean;
};

export type Bilanz = {
  /** Wie viele Empfaenger uebergeben wurden. */
  empfaenger: number;
  push: number;
  mail: number;
  /** Kein Weg vorhanden: abbestellt, keine Adresse, Mail nicht eingerichtet. */
  ohneWeg: number;
  /** Weg vorhanden, Zustellung dennoch gescheitert. */
  fehlgeschlagen: number;
};

/**
 * An mehrere Empfaenger zustellen.
 *
 * WIRFT NIE. Eine gescheiterte Mitteilung darf den Geldweg nicht anhalten:
 * Wenn Stripe ausgezahlt hat, ist das Geld unterwegs, und daran aendert eine
 * nicht zugestellte Mail nichts mehr. Verschwiegen wird es trotzdem nicht —
 * die Bilanz sagt genau, was passiert ist, und der Aufrufer schreibt sie ins
 * Protokoll.
 *
 * Ein gescheiterter Empfaenger haelt die uebrigen nicht auf.
 */
export async function benachrichtigen(
  empfaenger: string[],
  titel: string,
  text: string,
  daten: Record<string, string>,
  v: Versand,
): Promise<Bilanz> {
  const bilanz: Bilanz = {
    empfaenger: empfaenger.length, push: 0, mail: 0, ohneWeg: 0, fehlgeschlagen: 0,
  };

  for (const id of empfaenger) {
    try {
      const profil = await v.profilLesen(id);
      const wahl = kanalWaehlen({
        token: profil?.push_token,
        email: profil?.email,
        mailErlaubt: profil?.mail_benachrichtigungen,
        mailEingerichtet: v.mailEingerichtet,
      });

      if (wahl.kanal === "keiner") { bilanz.ohneWeg++; continue; }
      if (wahl.kanal === "push") {
        await v.push(profil!.push_token!, titel, text, daten);
        bilanz.push++;
        continue;
      }
      await v.mail((profil!.email ?? "").trim(), titel, text);
      bilanz.mail++;
    } catch (err) {
      console.warn("benachrichtigen: Empfaenger", id, "fehlgeschlagen:", err);
      bilanz.fehlgeschlagen++;
    }
  }

  return bilanz;
}

/** Der E-Mail-Rumpf, wortgleich zu send-push — eine Mitteilung soll gleich
 *  aussehen, egal welche Function sie ausgeloest hat. */
export function mailRumpf(titel: string, text: string): string {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1A1917;line-height:1.6">`
    + `<h2 style="color:#1B5C40;font-size:18px">${escapeHtml(titel)}</h2>`
    + `<p>${escapeHtml(text)}</p>`
    + `<p style="color:#6C6862;font-size:13px;margin-top:24px">`
    + `Sie erhalten diese E-Mail zu einem Ihrer Werkant-Vorgänge. `
    + `In den Einstellungen können Sie Vorgangsmails abbestellen.`
    + `</p></div>`;
}

/** Den echten Versand aus einem Supabase-Client und der Umgebung bauen. */
// deno-lint-ignore no-explicit-any
export function versandBauen(supabase: any): Versand {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM_EMAIL");

  return {
    mailEingerichtet: Boolean(apiKey && from),

    profilLesen: async (empfaenger: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("push_token, email, mail_benachrichtigungen")
        .eq("id", empfaenger)
        .maybeSingle();
      return (data ?? null) as Profil | null;
    },

    push: async (token, titel, text, daten) => {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ to: token, title: titel, body: text, data: daten, sound: "default" }),
      });
      if (!res.ok) throw new Error(`Expo ${res.status}`);
    },

    mail: async (email, titel, text) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject: titel, html: mailRumpf(titel, text) }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}`);
    },
  };
}
