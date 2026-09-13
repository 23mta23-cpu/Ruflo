// Die Zustell-Schleife ausfuehren, nicht nur typpruefen.
//
// Die Zusage, die hier haengt: eine Pflichtmitteilung gilt erst als zugestellt,
// wenn die Gegenstelle sie ANGENOMMEN hat. Quittiert man frueher, verschwindet
// der Rueckstand aus `zustellung_status()` — und damit das einzige Signal, dass
// Werkant die Uebermittlung noch schuldet (DSA Art. 17, AGB §7(4)).
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  mitteilungenZustellen, statusFuer, type Offen,
} from "../functions/zustellung/handler.ts";

function mitteilung(id: string): Offen {
  return {
    id,
    empfaenger: `emp-${id}`,
    email: `${id}@example.com`,
    art: "strike",
    titel: "Maßnahme an Ihrem Konto",
    text: "Begründung.",
  };
}

Deno.test("angenommene Mail wird quittiert", async () => {
  const quittiert: string[] = [];
  const bilanz = await mitteilungenZustellen([mitteilung("a")], {
    versenden: () => Promise.resolve({ ok: true, status: 200 }),
    quittieren: (id) => { quittiert.push(id); return Promise.resolve({ fehler: null }); },
  });
  assertEquals(bilanz, { offen: 1, versendet: 1, fehlgeschlagen: 0 });
  assertEquals(quittiert, ["a"]);
});

Deno.test("abgelehnte Mail wird NICHT quittiert", async () => {
  // Der Kern. Eine Quittung ohne Versand waere schlimmer als gar keine:
  // der Rueckstand verschwaende, die Pflicht bliebe, und niemand saehe es.
  const quittiert: string[] = [];
  const bilanz = await mitteilungenZustellen([mitteilung("a")], {
    versenden: () => Promise.resolve({ ok: false, status: 422 }),
    quittieren: (id) => { quittiert.push(id); return Promise.resolve({ fehler: null }); },
  });
  assertEquals(quittiert, [], "abgelehnte Mitteilung darf nicht quittiert werden");
  assertEquals(bilanz, { offen: 1, versendet: 0, fehlgeschlagen: 1 });
});

Deno.test("geworfener Fehler wird NICHT quittiert", async () => {
  const quittiert: string[] = [];
  const bilanz = await mitteilungenZustellen([mitteilung("a")], {
    versenden: () => Promise.reject(new Error("Netz weg")),
    quittieren: (id) => { quittiert.push(id); return Promise.resolve({ fehler: null }); },
  });
  assertEquals(quittiert, []);
  assertEquals(bilanz.fehlgeschlagen, 1);
});

Deno.test("gescheiterte Quittung zaehlt als fehlgeschlagen", async () => {
  // Die Mail ist raus, der Vermerk nicht. Beim naechsten Lauf geht sie erneut
  // raus. Doppelt zugestellt ist unschoen, nicht zugestellt waere ein
  // Rechtsverstoss — deshalb NICHT als Erfolg zaehlen.
  const bilanz = await mitteilungenZustellen([mitteilung("a")], {
    versenden: () => Promise.resolve({ ok: true, status: 200 }),
    quittieren: () => Promise.resolve({ fehler: { message: "rpc kaputt" } }),
  });
  assertEquals(bilanz, { offen: 1, versendet: 0, fehlgeschlagen: 1 });
});

Deno.test("eine kaputte Adresse haelt die uebrigen nicht auf", async () => {
  // Ohne das koennte ein einziger unzustellbarer Empfaenger jede weitere
  // Pflichtmitteilung blockieren — dauerhaft, denn er bliebe ja offen und
  // stuende beim naechsten Lauf wieder an erster Stelle.
  const quittiert: string[] = [];
  const bilanz = await mitteilungenZustellen(
    [mitteilung("a"), mitteilung("kaputt"), mitteilung("c")],
    {
      versenden: (m) => m.id === "kaputt"
        ? Promise.reject(new Error("ungueltige Adresse"))
        : Promise.resolve({ ok: true, status: 200 }),
      quittieren: (id) => { quittiert.push(id); return Promise.resolve({ fehler: null }); },
    },
  );
  assertEquals(quittiert, ["a", "c"]);
  assertEquals(bilanz, { offen: 3, versendet: 2, fehlgeschlagen: 1 });
});

Deno.test("leerer Rueckstand ist kein Fehler", async () => {
  const bilanz = await mitteilungenZustellen([], {
    versenden: () => Promise.reject(new Error("darf nicht aufgerufen werden")),
    quittieren: () => Promise.reject(new Error("darf nicht aufgerufen werden")),
  });
  assertEquals(bilanz, { offen: 0, versendet: 0, fehlgeschlagen: 0 });
  assertEquals(statusFuer(bilanz), 200);
});

Deno.test("ein teilweise gescheiterter Lauf meldet nicht 200", async () => {
  assertEquals(statusFuer({ offen: 2, versendet: 1, fehlgeschlagen: 1 }), 207);
  assertEquals(statusFuer({ offen: 2, versendet: 2, fehlgeschlagen: 0 }), 200);
});
