# Benachrichtigungen: eine Tabelle als Wahrheit, Zustellung messbar

**Stand:** 12.09.2026 · **Status:** entschieden, Block A in Arbeit
**Entscheidung von mir**, auf Founder-Anweisung („wähl selbst eine sinnvolle
Option und notier sie, statt mich zu fragen").

## Anlass

Founder-Frage: „Was ist denn mit Benachrichtigungen, Pop-ups und Mails, wenn
eine Anfrage reinkommt, angenommen wird, reingestellt wird? Haben wir dort auch
eine Logik oder müssen wir es bauen?"

Aufgenommen statt geraten. Es ist beides.

## Was schon da war (Bestandsaufnahme 12.09.2026)

Neun Auslöser mit Push, alle über `sendPushToUser` bzw. die Edge Function
`send-push`:

| Ereignis | Quelle |
|---|---|
| Auftrag eingestellt → passende Betriebe | `notifyMatchingProviders` (Push **und** Mail) |
| Angebot abgegeben → Kunde | `app/betrieb/angebot-erstellen.tsx` |
| Angebot angenommen → Betrieb | `lib/offers.ts` |
| Escrow hinterlegt → Betrieb | `stripe-webhook` |
| Fertig gemeldet → Kunde | `app/betrieb/auftraege.tsx` |
| Auszahlung + Abschluss | `release-escrow` |
| Storniert | `cancel-contract` |
| PStTG-Jahresbericht | `pstg-annual-report` |

Der Geldweg ist also abgedeckt. Drei Lücken bleiben.

## Die drei Lücken

**1. Push existiert auf dem Web nicht.** `lib/notifications.ts` gibt bei
`Platform.OS === 'web'` sofort auf, es wird kein Token registriert. Die heute
live stehende App verschickt damit **keine einzige** Push-Nachricht. Alles
oben wirkt erst ab dem ersten nativen Build.

**2. Kein Push bei Chat-Nachricht und Terminvorschlag.** Gemessen: weder
`lib/messages.ts` noch `lib/appointments.ts` enthalten einen Push-Aufruf. Das
ist die häufigste Interaktion überhaupt.

**3. Strikes und DSA-Beschränkungen werden nirgendwohin zugestellt.** Der
ernste Punkt. `strike_zustellung_vermerken()` und
`beschraenkung_zustellung_vermerken()` existieren, und **niemand ruft sie
auf**, weil es keinen Versandweg gibt. Die Begründung wird geschrieben und
bleibt liegen.

Das ist kein Komfortmangel:

- **AGB §7(4)** verspricht dem Anbieter eine Begründung (Art. 4 P2B-VO,
  unmittelbar geltendes EU-Recht).
- **DSA Art. 17 Abs. 1** verlangt, die Begründung dem Betroffenen zu
  **übermitteln**. Ein Text in einer Spalte ist keine Übermittlung.

Der Kommentar in `0750` sagt das sogar selbst („Zustellung ist damit NICHT
erledigt"), und danach hat es niemand gebaut, ich eingeschlossen.

**Zusatzbefund:** Es gibt **keine Tabelle `notifications`**.
`app/benachrichtigungen.tsx` baut die Liste bei jedem Öffnen aus `jobs`,
`messages` und `offers` neu zusammen. `read` steht fest auf `false` im Code,
„als gelesen markieren" lebt nur im Bildschirmzustand. Ereignisse ohne eigene
Zeile (Auszahlung, Strike, Beschränkung) tauchen nie auf.

## Die Entscheidung

**Eine Tabelle `notifications` als einzige Wahrheit darüber, was einem Nutzer
zugestellt werden muss, plus eine messbare Zustellung.**

Drei Eigenschaften, auf die es ankommt:

1. **Die Mitteilung entsteht in derselben Transaktion wie das Ereignis.**
   Ein Strike ohne zugehörige Mitteilung darf es nicht geben können. Deshalb
   ein Trigger auf `provider_strikes` und `beschraenkungen`, nicht ein Aufruf
   aus dem Client. Der Client kann abstürzen, die Transaktion nicht.
2. **Unzugestellte Pflichtmitteilungen sind sichtbar.** `health` meldet einen
   Rückstau, wie schon beim Abnahmefrist-Lauf (`0850`). Solange Resend nicht
   eingerichtet ist, bleibt die Zustellung offen, und **genau das steht dann
   auch da**, statt unsichtbar zu bleiben.
3. **Der Kanal ist austauschbar.** Die Zeile weiß, dass sie zugestellt werden
   muss, nicht wie. Push, Mail oder beides entscheidet der Versender.

### Warum kein reiner Push

Weil Push auf dem Web nicht existiert und ein Strike den Betroffenen auch dann
erreichen muss, wenn er die App nie wieder öffnet. Eine Pflichtmitteilung, die
nur in der App sichtbar ist, ist bei einem gesperrten Konto wertlos.

### Warum nicht alles auf einmal

Blöcke, in dieser Reihenfolge, nach Schwere sortiert und nicht nach Aufwand:

- **A.** Tabelle, RLS, `benachrichtigung_anlegen()`, Trigger für Strike und
  Beschränkung, `health`-Anzeige für den Rückstau. Rechtlich relevant.
- **B.** `app/benachrichtigungen.tsx` liest die Tabelle statt sie nachzubauen;
  echter Gelesen-Status.
- **C.** E-Mail-Versand über Resend für Pflichtmitteilungen und die
  Geld-Ereignisse.
- **D.** Push für Chat und Terminvorschlag — lohnt erst mit dem ersten
  nativen Build, vorher wirkt es nirgends.

## Was bewusst NICHT gebaut wird

**Kein Benachrichtigungs-Fanout für jedes Ereignis.** Die neun bestehenden
Push-Auslöser bleiben, wie sie sind. Sie doppelt in die Tabelle zu schreiben,
brächte eine zweite Wahrheit über denselben Vorgang. In die Tabelle kommt, was
**zugestellt werden muss** (Pflichtmitteilungen) und was **sonst nirgends
steht** (Auszahlung, Strike, Beschränkung).

## Woran das später gemessen wird

- `health` meldet `zustellung_stau: false`, obwohl offene Pflichtmitteilungen
  existieren → der Prüfer sieht seinen eigenen Gegenstand nicht.
- Ein Strike ohne Mitteilungszeile → der Trigger greift nicht.
- Eine Mitteilung, die ein Fremder lesen kann → RLS ist falsch.

Alle drei sind Mutationen, die in `scripts/db-test/` rot werden müssen.
