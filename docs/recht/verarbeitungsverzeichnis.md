# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

Verantwortlicher: siehe `constants/legal.ts` (`COMPANY`). Stand 07.09.2026.

> **Solange `LEGAL_PLACEHOLDER = true` ist, trägt der Kopf dieses Verzeichnisses
> Platzhalter.** Es ist damit vorbereitet, aber nicht vorlagefähig — Name,
> Anschrift und vertretungsberechtigte Person müssen echt sein.

**Wie dieses Verzeichnis entstanden ist:** abgeleitet aus den 26 Tabellen der
Migrationen und den 14 Edge Functions, nicht aus einer Vorlage. Wer eine
Tabelle hinzufügt, ergänzt hier eine Zeile — sonst beschreibt das Verzeichnis
etwas anderes als die Datenbank.

**Kein Datenschutzbeauftragter bestellt.** Art. 37 DSGVO / § 38 BDSG verlangen
das ab 20 ständig mit automatisierter Verarbeitung beschäftigten Personen oder
bei umfangreicher Verarbeitung besonderer Kategorien. Beides liegt nicht vor.
Bei Wachstum neu zu bewerten.

---

## 1. Kundenkonto und Auftragsabwicklung

| | |
|---|---|
| **Zweck** | Vermittlung von Handwerksleistungen, Vertragsabwicklung |
| **Betroffene** | Auftraggeber (Verbraucher) |
| **Datenkategorien** | Name, E-Mail, Rolle, Anzeigename, Profilbild; Auftragstitel, Beschreibung, Kategorie, Postleitzahl; die genaue Anschrift getrennt in `job_addresses` |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertrag) |
| **Tabellen** | `profiles`, `jobs`, `job_addresses`, `offers`, `contracts`, `appointment_proposals` |
| **Empfänger** | der beauftragte Anbieter (nur die für die Ausführung nötigen Daten) |
| **Löschfrist** | Konto: auf Verlangen sofort (Edge Function `delete-account`). Vertragsdaten: 10 Jahre nach § 147 AO / § 257 HGB |

**Besonderheit, bewusst so gebaut:** die genaue Anschrift steht in einer eigenen
Tabelle (`job_addresses`, Migration 0570) und ist erst für den **zugewiesenen**
Anbieter lesbar — nicht für jeden, der ein Angebot abgibt. Datenminimierung
nach Art. 5 Abs. 1 lit. c.

---

## 2. Anbieterkonto, Verifizierung und Berufszulassung

| | |
|---|---|
| **Zweck** | Prüfung der Berechtigung zur Leistungserbringung, Auszahlung |
| **Betroffene** | Anbieter (Gewerbetreibende) |
| **Datenkategorien** | Firmenname, Anschrift, Steuernummer/USt-IdNr., Gewerbeschein, Meisterbrief, Stripe-Kontokennung, KYC-Status |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b und lit. c (Handwerksordnung, PStTG) |
| **Tabellen** | `provider_profiles`, `verification_documents` |
| **Empfänger** | Stripe (Identitätsprüfung), BZSt (PStTG-Meldung) |
| **Löschfrist** | Nachweise: 10 Jahre nach § 147 AO |

**Zugriffsbeschränkung, im Code durchgesetzt:** `provider_profiles` enthält
`steuer_id` und `stripe_account_id`. Deshalb geben Vertragsbildschirme die Zeile
nicht frei, sondern rufen `vertrag_partner()` (Migration 0800) — eine Funktion,
die ausschließlich Namen zurückgibt. Eine Zeilen-Policy hätte immer die ganze
Zeile freigegeben.

---

## 3. Zahlungsabwicklung und Treuhand

| | |
|---|---|
| **Zweck** | Zahlung, Einbehalt bis zur Abnahme, Auszahlung, Erstattung |
| **Betroffene** | Auftraggeber und Anbieter |
| **Datenkategorien** | Betrag, Gebühren, Zahlungsvorgangskennungen, Auszahlungsvorgänge, Streitfälle |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b, lit. c (§ 147 AO) |
| **Tabellen** | `contract_payment_intents`, `payout_operations`, `disputes` |
| **Empfänger** | Stripe Payments Europe Ltd. |
| **Löschfrist** | 10 Jahre (§ 147 AO) |

**Zahlungsdaten selbst werden nicht gespeichert.** Kartendaten liegen
ausschließlich bei Stripe; Werkant hält nur Kennungen. Die ZAG-Frage zur
Treuhandkonstruktion ist offen — siehe `docs/recht/ki-vo-und-bfsg.md` §4.

---

## 4. Nachrichten zwischen Auftraggeber und Anbieter

| | |
|---|---|
| **Zweck** | Abstimmung zum Auftrag, Nachweis im Streitfall |
| **Datenkategorien** | Nachrichteninhalt, Zeitpunkt, Lesestatus |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b; für die Aufbewahrung im Streitfall lit. f |
| **Tabellen** | `messages`, `chat_leak_flags`, `chat_reports` |
| **Löschfrist** | mit dem Auftrag; bei laufendem Streitfall bis zu dessen Abschluss |

`chat_leak_flags` (Migration 0340) und `chat_reports` (0700) halten Hinweise auf
Regelverstöße fest. **Kein automatischer Strike aus einer Meldung** — sonst
genügten drei Meldungen, um einen Anbieter zu sperren.

---

## 5. Bewertungen

| | |
|---|---|
| **Zweck** | Qualitätssignal für andere Nutzer |
| **Datenkategorien** | Sterne, Text, Anzeigename, Auftragsbezug |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b, lit. f |
| **Tabellen** | `reviews` |
| **Empfänger** | öffentlich sichtbar |
| **Löschfrist** | mit dem Anbieterkonto |

---

## 6. Meldungen rechtswidriger Inhalte und Beschränkungen (DSA)

| | |
|---|---|
| **Zweck** | Erfüllung von Art. 16, 17, 18 DSA |
| **Betroffene** | Meldende Personen (**auch ohne Konto**), von Maßnahmen Betroffene |
| **Datenkategorien** | Name, E-Mail und Begründung des Melders; Tatsachenvortrag, Grundlage und Dauer der Maßnahme |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c (VO (EU) 2022/2065) |
| **Tabellen** | `inhalts_meldungen`, `beschraenkungen`, `provider_strikes` |
| **Empfänger** | bei Verdacht auf eine Straftat mit Gefahr für Leben oder Sicherheit: Strafverfolgungsbehörden (Art. 18 DSA) |
| **Löschfrist** | Meldungen und Maßnahmen: 3 Jahre nach Abschluss (Verjährung, Nachweis gegenüber Aufsicht) |

Name und E-Mail des Melders sind **Pflichtangaben** nach Art. 16 Abs. 2 lit. c
— sie werden nicht freiwillig erhoben, sondern weil die Verordnung sie verlangt.

---

## 7. Steuerliche Meldung (PStTG / DAC7)

| | |
|---|---|
| **Zweck** | Meldung an das Bundeszentralamt für Steuern |
| **Betroffene** | Anbieter mit meldepflichtigen Umsätzen |
| **Datenkategorien** | Name, Anschrift, Steuernummer, Umsatzhöhe, Anzahl der Tätigkeiten |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c (§§ 13 ff. PStTG) |
| **Tabellen** | `pstg_reports` |
| **Empfänger** | Bundeszentralamt für Steuern |
| **Löschfrist** | 10 Jahre (§ 147 AO) |

Die Registrierung beim BZSt ist **offen** — der Code steht, der behördliche
Teil fehlt.

---

## 8. Einwilligungen und Nachweise

| | |
|---|---|
| **Zweck** | Nachweis erteilter Einwilligungen und Erklärungen |
| **Datenkategorien** | Zeitpunkt, Fassung, Wortlaut, gekürzte IP-Adresse |
| **Rechtsgrundlage** | Art. 7 Abs. 1 DSGVO (Nachweispflicht), Art. 6 Abs. 1 lit. c |
| **Tabellen** | `dsgvo_consents`, `widerruf_consents` |
| **Löschfrist** | 3 Jahre nach Widerruf der Einwilligung |

`widerruf_consents` (Migration 0710) hält den **Wortlaut** samt Fassungskennung
fest, nicht nur ein Häkchen — ein Häkchen ist im Streitfall kein Nachweis.

---

## 9. Sicherheit und Missbrauchsabwehr

| | |
|---|---|
| **Zweck** | Begrenzung automatisierter Zugriffe |
| **Datenkategorien** | gekürzte IP-Adresse oder Nutzerkennung, Zeitfenster, Zähler |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f (Betriebssicherheit) |
| **Tabellen** | `rate_limits` |
| **Löschfrist** | **7 Tage**, automatisch (Migration 0730) |

---

## 10. Warteliste und E-Mail-Bestätigung

| | |
|---|---|
| **Zweck** | Anbieter-Akquise mit Double-Opt-In (§ 7 UWG), Bestätigung der E-Mail |
| **Datenkategorien** | E-Mail, Postleitzahl, Gewerk, Bestätigungszeitpunkt |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. a (Einwilligung) |
| **Tabellen** | `waitlist`, `email_verifications` |
| **Löschfrist** | unbestätigte Einträge nach 30 Tagen; bestätigte bis zum Widerruf |

---

## Auftragsverarbeiter (Art. 28 DSGVO)

Aus dem Code ermittelt, nicht aus einer Liste übernommen:

| Dienst | Wofür | Ort | AVV |
|---|---|---|---|
| Supabase | Datenbank, Anmeldung, Dateiablage, Edge Functions | EU-Region | **offen** |
| Stripe Payments Europe Ltd. | Zahlung, Treuhand, Auszahlung, KYC | Irland | **offen** |
| Resend | Versand von E-Mails | EU/US | **offen** |
| Expo / EAS | Push-Benachrichtigungen, Build | US | **offen** |
| GitHub Pages | Auslieferung der Web-App | US | **offen** |

**Alle fünf AVV sind noch nicht unterzeichnet.** Ohne sie ist jede Übermittlung
an diese Dienste ohne Rechtsgrundlage nach Art. 28 — das ist ein Blocker für den
Marktstart, kein Formalismus.

Für Expo und GitHub Pages (Drittland USA) ist zusätzlich die Grundlage der
Übermittlung nach Kapitel V zu dokumentieren (Angemessenheitsbeschluss
EU-US Data Privacy Framework oder Standardvertragsklauseln).

---

## Technische und organisatorische Maßnahmen (Art. 32)

| Maßnahme | Wo |
|---|---|
| Zugriffskontrolle auf Zeilenebene (RLS), Grundsatz „alles verboten" | jede Tabelle, geprüft in `scripts/db-test/` (218 Assertions) |
| Verschlüsselung im Transport | ausschließlich HTTPS |
| Trennung sensibler Felder | `job_addresses` (0570), `vertrag_partner()` (0800) |
| Rate-Limits auf allen öffentlichen Endpunkten | `supabase/functions/_shared/rateLimit.ts` |
| Geheimnisse ausschließlich serverseitig | ADR-0004: niemals `service_role` im Client |
| Selbstauskunft und Löschung als Funktion | `export-my-data`, `delete-account` |
| Protokollierung von Einwilligungen | `dsgvo_consents`, `widerruf_consents` |

**Offen:** ein Penetrationstest (Blocker-Liste P2). Bis dahin ist Art. 32 durch
Bauweise und Tests belegt, nicht durch eine unabhängige Prüfung.
