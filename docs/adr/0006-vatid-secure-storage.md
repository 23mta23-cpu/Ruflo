# ADR-0006 — Sichere Speicherung der USt-IdNr. (vatId)

**Status:** Akzeptiert (Umsetzung ausstehend — Backend-Release Voraussetzung)  
**Datum:** 2026-06-12  
**Autor:** WERKR Engineering

---

## Kontext

Die `AccountProfile.vatId` (USt-IdNr., Format DE + 9 Ziffern) wird derzeit via
`@react-native-async-storage/async-storage` im Klartext gespeichert
(`lib/account.ts`, Key `werkr_account_v1`).

AsyncStorage ist auf beiden Plattformen **unverschlüsselt**:
- iOS: `NSUserDefaults`-äquivalent — kein Keychain-Schutz
- Android: SharedPreferences — kein Android Keystore-Schutz

Die vatId ist ein steuerliches Identifikationsmerkmal nach §27a UStG (B2B-Nutzer).
Ein Gerätezugriff durch Dritte (z. B. bei gestohlenen Geräten, Backup-Extraktion)
legt die Steuernummer offen. Das Risiko ist gemäß DSGVO Art. 32 ("angemessene
technisch-organisatorische Maßnahmen") zu minimieren.

Security-Audit-Finding: **H-6** (HIGH).

---

## Entscheidung

`vatId` wird in **`expo-secure-store`** (iOS Keychain / Android Keystore AES-256)
gespeichert, getrennt vom übrigen `AccountProfile`.

### Umsetzungsplan

```
lib/account.ts  →  vatId wird NICHT mehr in AsyncStorage persistiert
lib/secure.ts   →  neues Modul für expo-secure-store (vatId, future: IBAN-Token)
```

```typescript
// lib/secure.ts (geplant)
import * as SecureStore from 'expo-secure-store';

const VAT_KEY = 'werkr_vatid_v1';

export async function loadVatId(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(VAT_KEY); }
  catch { return null; }
}

export async function saveVatId(vatId: string | null): Promise<void> {
  if (vatId) await SecureStore.setItemAsync(VAT_KEY, vatId);
  else await SecureStore.deleteItemAsync(VAT_KEY).catch(() => {});
}
```

`AccountProfile.vatId` bleibt als In-Memory-Feld erhalten; es wird nur nicht
mehr in AsyncStorage serialisiert. Beim `loadAccount()` wird es aus SecureStore
ergänzt.

### Migration

Einmalig beim nächsten App-Start: Wenn `werkr_account_v1.vatId !== null` →
in SecureStore migrieren → aus AsyncStorage-Blob entfernen.

---

## Abhängigkeiten / Voraussetzungen

- `expo-secure-store` bereits im Expo SDK 56 enthalten → kein neues Package.
- Muss **vor** dem ersten Production-Release umgesetzt werden.
- Web-Plattform (`expo-secure-store` web-stub): Fällt auf `localStorage` zurück —
  für die Web-Version ist der SecureStore-Support eingeschränkt; vatId bleibt
  dort bis zur Backend-Session-only-Strategie im LocalStorage (dokumentiertes
  Restzrisiko).

---

## Verworfene Alternativen

| Option | Verworfen weil |
|--------|----------------|
| Verschlüsselung in AsyncStorage mit eigenem Key | Key muss irgendwo liegen — kein echter Sicherheitsgewinn ohne Keychain |
| vatId nur serverseitig speichern | Setzt Backend voraus — gültig für v2, Übergang nötig |
| Keine Speicherung (re-entry bei jedem Start) | UX unzumutbar für B2B-Nutzer |

---

## Konsequenzen

- **Positiv:** vatId unter Hardware-Schutz (Secure Enclave / SE); DSGVO Art. 32
  Anforderung erfüllt.
- **Positiv:** Vorlage für zukünftige sensible Felder (IBAN-Token, Personalausweis-Hash).
- **Negativ:** `expo-secure-store` Web ist eingeschränkt — dokumentiertes Restrisiko
  für Webapp-Nutzer bis Backend-Umstellung.
- **Negativ:** Gerätewechsel ohne Cloud-Backup erfordert erneute Eingabe der vatId
  (akzeptabel für B2B-Nutzer, da selten).

---

## Verknüpfte ADRs

- ADR-0004: Security & Consent Architecture
- ADR-0005: Backend-API-Spec (serverseitige VIES-Validierung)
