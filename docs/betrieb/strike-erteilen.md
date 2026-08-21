# Strike erteilen, aufheben, Zustellung vermerken

**Stand 21.08.2026 (Migration 0750).** Gilt für die Verstöße, die Werkant
nicht automatisch erkennt — also für drei der vier Gründe aus AGB §7(2).

Der vierte (Kontakt oder Zahlung außerhalb der Plattform) wird weiterhin
automatisch vergeben, wenn innerhalb von 12 Monaten drei Chat-Funde
zusammenkommen. Da musst du nichts tun.

---

## Bevor du einen Strike vergibst

Ein Strike ist gegenüber einem gewerblichen Anbieter eine Maßnahme im Sinne
der P2B-Verordnung (EU) 2019/1150. Drei davon sperren sein Konto dauerhaft.
Drei Dinge müssen deshalb vorher stimmen:

1. **Der Grund steht in AGB §7(2).** Etwas anderes kannst du nicht eintragen —
   das Werkzeug weist es ab. Wenn ein Verhalten nicht in den AGB steht, ist
   der Weg nicht der Strike, sondern die AGB zu ändern (§10, sechs Wochen
   Ankündigungsfrist).
2. **Du kannst die Tatsachen benennen.** Nicht „unzuverlässig", sondern was
   wann passiert ist und woraus sich das ergibt. Art. 4 P2B-VO verlangt die
   maßgeblichen Tatsachen, nicht das Ergebnis. Das Werkzeug verlangt
   mindestens 40 Zeichen — das ist die Untergrenze, nicht das Ziel.
3. **Du kannst die Begründung zustellen.** §7(4) schuldet sie „per E-Mail
   (dauerhafter Datenträger), spätestens zum Zeitpunkt der Maßnahme". Siehe
   den Abschnitt „Zustellung" unten — das ist derzeit der wunde Punkt.

---

## Schritt 1 — Strike erteilen

Im Supabase-SQL-Editor:

```sql
select strike_erteilen(
  'UUID-DES-ANBIETERS',
  'nichterscheinen',          -- oder: preiserhoehung, falsche_angaben,
                              --        kontaktdaten_umgehung, sonstiges
  'Zum vereinbarten Termin am 03.08.2026 um 09:00 Uhr ist der Anbieter nicht '
  'erschienen und hat weder abgesagt noch auf die Nachfrage des Kunden im '
  'Chat reagiert (Auftrag 1234abcd).'
);
```

Zurück kommt die ID des Strikes — **notieren**, du brauchst sie für Schritt 2.

Was das Werkzeug dir abnimmt: es setzt den AGB-Wortlaut des Grundes davor,
hängt die 12-Monats-Frist mit dem konkreten Verfallsdatum an und nennt den
Beschwerdeweg nach §7(5). Diese drei Teile kannst du nicht vergessen.

Was es dir **nicht** abnimmt: die Tatsachen. Die kennst nur du.

> Trag Strikes nicht mit einem rohen `insert into provider_strikes` ein. Das
> geht technisch, umgeht aber genau die drei Pflichtteile — und das Ergebnis
> sieht in der Akte aus wie ein ordentlicher Strike.

---

## Schritt 2 — Zustellung, und warum sie heute hakt

**Werkant verschickt diese Begründung nicht von selbst.** Es gibt keinen
Versandweg: `RESEND_API_KEY` ist nicht gesetzt, und ein Postfach
`kontakt@werkant.de` existiert noch nicht (siehe
`docs/ops/RESEND-MAIL-GATE.md` und `docs/betrieb/postfaecher-einrichten.md`).

Der Anbieter sieht den Strike samt Begründung zwar in seinem Betriebs-
Dashboard. Ein Dashboard ist aber kein dauerhafter Datenträger im Sinne von
Art. 4 P2B-VO — der Anbieter kann den Inhalt dort nicht unveränderlich
aufbewahren. **Bis der Mailweg steht, ist die Zustellung Handarbeit.**

Also: Begründungstext aus der Akte kopieren und von deiner E-Mail-Adresse an
den Anbieter senden. Danach den Vorgang festhalten:

```sql
-- Text zum Kopieren
select begruendung from provider_strikes where id = 'STRIKE-ID';

-- Zustellung belegen
select strike_zustellung_vermerken(
  'STRIKE-ID',
  'E-Mail an anbieter@example.de am 21.08.2026, 10:15 Uhr'
);
```

Solange `begruendung_zugestellt_am` leer ist, ist die Maßnahme formal
unvollständig. Offene Fälle findest du so:

```sql
select id, provider_id, grund, erteilt_am
  from provider_strikes
 where begruendung_zugestellt_am is null
   and aufgehoben_am is null
 order by erteilt_am;
```

---

## Schritt 3 — Beschwerde, AGB §7(5)

Erweist sich die Maßnahme als unbegründet, wird sie **aufgehoben, nicht
gelöscht**. Dass eine Beschwerde Erfolg hatte, gehört zur Akte; ein gelöschter
Strike ließe sich später weder belegen noch erklären.

```sql
select strike_aufheben(
  'STRIKE-ID',
  'Beschwerde begruendet: der Termin war nachweislich am 02.08. abgesagt worden.'
);
```

Die Sperre fällt damit sofort weg — die Angebots-Policy fragt `aktive_strikes()`
ab, und ein aufgehobener Strike zählt dort nicht mehr mit.

---

## Was von selbst passiert

- **Der Zähler folgt der Akte.** `provider_profiles.strike_count` wird bei
  jedem Erteilen, Aufheben und Löschen nachgeführt (Trigger aus 0750). Vorher
  tat er das nur beim automatischen Grund — ein Strike von Hand ließ die
  angezeigte Zahl auf dem alten Stand stehen, während die Sperre schon griff.
- **Strikes verfallen.** Nach 12 Monaten zählt ein Strike nicht mehr, ohne
  dass jemand etwas tut (AGB §7(3)).
- **Die Werkzeuge sind für Angemeldete gesperrt.** Ausführbar nur als
  `postgres`/`service_role`, also im SQL-Editor. Ein Anbieter kann weder sich
  selbst freistellen noch einen Mitbewerber belegen.

Geprüft in `scripts/db-test/strike-werkzeug.sql` (12 Zusicherungen, jede per
Mutation als rot-fähig nachgewiesen).
