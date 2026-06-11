# ADR-0003: Legal Compliance Stack (Germany)

**Status:** Accepted  
**Date:** 2026-06-11

## Decisions & Implementations

| Law | Requirement | Implementation |
|-----|-------------|----------------|
| JArbSchG | No minors on platform | Real DOB field with calcAge() — hard block if <18, shows exact age in error |
| § 1 MiLoG | Min wage €12.41/h | UI enforces €13/h minimum (above Mindestlohn) — slider cannot go below |
| PStTG / DAC7 | Report to BZSt at ≥30 tx or ≥€2,000 | Steuer-Dashboard shows live progress bars, auto-report triggers at threshold |
| DSGVO | Consent before data processing | DsgvoConsent modal on first launch, stored in AsyncStorage, revocable in Settings |
| § 312 BGB | Distance selling — cancellation right | Vertrag shows 14-day Widerrufsrecht (waived after job start) |
| GwG | AML for marketplace | KYC with Steuer-ID + Gewerbeschein for Handwerker track |

## Pending before launch
- [ ] Impressum & Datenschutzerklärung pages (legal text by attorney)
- [ ] Penetration test (use ruflo-security-audit)
- [ ] Stripe Connect live KYC (replaces mock IBAN field)
- [ ] BZSt DAC7 API integration (replaces manual export)
