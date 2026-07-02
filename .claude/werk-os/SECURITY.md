# SECURITY.md

# WERK Security Principles

## Purpose
This file defines security, privacy and abuse-prevention principles for the WERK project.

Claude must consider this file whenever building authentication, authorization, AI workflows, APIs, data handling, payments, user accounts or integrations.

## Core Principle
Security is not a later feature.

Security is part of product quality, user trust and company value.

## Default Security Mindset
Assume:
- Users make mistakes.
- Attackers abuse weak flows.
- Secrets leak if handled carelessly.
- AI outputs can be wrong.
- Logs can expose sensitive data.
- Integrations can fail.
- Permissions are often misconfigured.

Build defensively.

## Authentication
Authentication must be:
- Clear
- Secure
- Reliable
- Easy to recover
- Resistant to abuse

Consider:
- Password policy
- MFA where appropriate
- Session expiration
- Secure cookies
- Account recovery
- Brute-force protection
- OAuth security

## Authorization
Never assume that authenticated means authorized.

Check:
- User roles
- Team permissions
- Resource ownership
- Admin access
- API access
- Organization boundaries

Every sensitive action must verify permission.

## Secrets Management
Never hardcode secrets.

Never expose secrets in:
- frontend code
- logs
- test files
- screenshots
- generated examples
- documentation

Use environment variables or secret managers.

## Data Privacy
Before storing data ask:
- Do we need this data?
- Who can access it?
- How long is it kept?
- Can the user delete it?
- Is it sensitive?
- Is it used for AI processing?
- Is consent needed?

Collect the minimum data required.

## AI Security
AI features need special controls.

For every AI workflow consider:
- Prompt injection
- Data leakage
- Hallucination
- Unsafe automation
- User verification
- Model cost abuse
- Tool abuse
- Unauthorized context access

AI must not execute sensitive actions without appropriate safeguards.

## Input Validation
Validate all external input:
- User input
- API input
- Webhooks
- File uploads
- AI-generated content
- Third-party responses

Never trust client-side validation alone.

## Rate Limiting and Abuse Prevention
Protect:
- Login attempts
- Signup flows
- AI calls
- Public APIs
- Webhooks
- Expensive operations
- Payment flows

Prevent users from accidentally or intentionally creating excessive cost.

## Logging
Logs should help debugging without leaking sensitive data.

Avoid logging:
- passwords
- tokens
- API keys
- personal data
- payment details
- private prompts
- sensitive AI context

## Payments and Billing
For payment-related features:
- Use trusted providers
- Verify webhooks
- Avoid storing card data
- Handle failed payments safely
- Prevent privilege escalation through billing state
- Keep audit trails

## File Uploads
If file uploads exist:
- Validate file type
- Validate size
- Scan or restrict risky files where appropriate
- Store securely
- Prevent public access unless intended
- Avoid executing uploaded content

## Security Review Triggers
Perform deeper security review when changing:
- Authentication
- Authorization
- Payments
- AI tool execution
- User data storage
- Admin features
- Public APIs
- Webhooks
- Integrations
- File handling

## Legal and Compliance Awareness
Claude is not a lawyer.

Identify legal and compliance risks early.

Recommend qualified legal review for:
- Terms of service
- Privacy policy
- GDPR issues
- Data processing agreements
- AI liability
- IP ownership
- Enterprise contracts
- Regulated industries

## Security Output Format
For security-relevant tasks, respond with:

1. Security assessment
2. Main risks
3. Recommended safeguards
4. Required validations
5. Abuse cases
6. Logging/audit needs
7. Open legal/compliance questions
8. Next actions

## Final Rule
A feature that creates revenue but destroys trust is not a good feature.

Protect user trust, company reputation and long-term defensibility.
