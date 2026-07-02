# ENGINEERING.md

# WERK Engineering Operating Standard

## Purpose

This file defines how Claude Code should design, implement, review, test and improve software for the WERK project.

The goal is not to produce code quickly.

The goal is to produce code that is:

- simple
- secure
- maintainable
- scalable
- testable
- understandable
- commercially useful

Every engineering decision must support the company goal: building a serious, revenue-generating AI product.

---

## Core Engineering Philosophy

Prefer boring, proven engineering over clever engineering.

Prefer clarity over magic.

Prefer maintainability over short-term shortcuts.

Prefer small, safe changes over large risky rewrites.

Prefer product value over technical vanity.

Never build technology only because it is interesting.

Build what increases user value, revenue, reliability, speed or defensibility.

---

## Cost and Token Discipline

Engineering work must be cost-aware.

Assume the founder has limited savings and limited runway.

Do not waste tokens, tool calls, API calls, context or compute.

Before reading, searching, refactoring or generating code, ask:

- Is this necessary?
- Does this improve correctness?
- Does this reduce risk?
- Does this increase product value?
- Is there a cheaper path?

Never scan the entire repository blindly.

Start with structure, then inspect only relevant files.

---

## Repository First Rule

Before implementing any meaningful change:

1. Understand the relevant architecture.
2. Identify affected modules.
3. Inspect existing conventions.
4. Check existing abstractions.
5. Reuse existing patterns where reasonable.
6. Avoid duplicate logic.
7. Avoid unnecessary rewrites.

Never implement in isolation.

Every change must fit the repository.

---

## Implementation Standard

For every implementation:

- choose the simplest working design
- keep functions small
- use clear names
- avoid unnecessary abstractions
- minimize side effects
- validate inputs
- handle errors intentionally
- write code that another senior developer can understand quickly

Avoid:

- over-engineering
- premature optimization
- hidden global state
- untyped data where types are available
- large files with unrelated responsibilities
- duplicated business logic
- unclear naming
- silent failures

---

## Architecture Rules

Good architecture should make change easier, not harder.

Use modular boundaries.

Separate:

- UI
- business logic
- data access
- external integrations
- authentication
- authorization
- configuration
- shared utilities

Do not mix business logic directly into UI components when avoidable.

Do not let external APIs leak throughout the codebase.

Create clean boundaries around third-party services.

---

## AI Product Engineering Rules

WERK is an AI product.

AI features must be treated as product-critical systems, not demos.

For AI functionality, consider:

- prompt quality
- evaluation
- latency
- cost
- hallucination risk
- safety
- logging
- fallback behavior
- user trust
- data privacy
- model dependency risk

Never assume an AI output is correct.

Design for verification, guardrails and graceful failure.

---

## Security Standard

Security is not optional.

Always consider:

- authentication
- authorization
- session handling
- secret management
- input validation
- output sanitization
- rate limiting
- abuse prevention
- data privacy
- audit logs
- least privilege
- dependency risk

Never hardcode secrets.

Never expose private keys.

Never trust client-side validation alone.

Never log sensitive data unnecessarily.

---

## Privacy and Compliance Awareness

Treat user data as sensitive by default.

Before storing or processing data, ask:

- Do we need this data?
- How long should it be stored?
- Who can access it?
- Can it be deleted?
- Is consent required?
- Is legal review needed?

Flag GDPR, privacy, IP, liability or terms-of-service risks early.

Do not provide final legal conclusions.

Recommend qualified legal review when needed.

---

## Testing Standard

Every meaningful change should include appropriate verification.

Prefer tests that protect business-critical behavior.

Consider:

- unit tests
- integration tests
- API tests
- UI tests
- regression tests
- security checks
- manual smoke tests

Do not write meaningless tests just to increase coverage.

Tests should prove important behavior.

Before finalizing work, explain what was tested and what remains untested.

---

## Error Handling

Errors must be intentional.

Do not hide failures.

Do not swallow exceptions silently.

Provide useful error messages.

Protect users from internal details.

Log enough for debugging.

Avoid leaking secrets or private data.

---

## Performance Standard

Do not optimize prematurely.

But do not create obvious bottlenecks.

Watch for:

- unnecessary API calls
- expensive database queries
- repeated rendering
- large payloads
- blocking operations
- unbounded loops
- memory leaks
- slow AI calls
- unnecessary model calls

Performance improvements should be measured or clearly justified.

---

## Refactoring Rules

Refactor when it reduces risk, complexity or future cost.

Do not refactor unrelated code during feature work unless necessary.

Before refactoring:

- understand current behavior
- identify risk
- preserve functionality
- make small changes
- test after each step

Never rewrite large parts of the system without a clear business or architectural reason.

---

## Git and Change Discipline

Changes should be small and reviewable.

Before making changes:

- identify files to edit
- explain why
- avoid unrelated changes

After making changes:

- summarize what changed
- list affected files
- explain testing
- identify risks
- recommend next steps

Commit messages should be clear and specific.

---

## Code Review Standard

Review code like a senior engineer protecting a company.

Check:

- correctness
- readability
- maintainability
- security
- performance
- architecture fit
- test coverage
- edge cases
- unnecessary complexity

Do not approve weak code to move faster.

Speed without quality creates future debt.

---

## Dependency Policy

Do not add dependencies casually.

Before adding a dependency, evaluate:

- necessity
- maintenance quality
- security history
- bundle size
- licensing
- community adoption
- long-term risk

Prefer built-in or existing project dependencies when sufficient.

---

## Documentation Standard

Document decisions, not obvious code.

Good documentation explains:

- why something exists
- how to use it
- what assumptions were made
- what trade-offs were accepted
- what future risks exist

Avoid outdated or redundant documentation.

---

## UX Engineering Standard

Engineering must support a great user experience.

Always consider:

- loading states
- error states
- empty states
- mobile behavior
- accessibility
- responsiveness
- clarity
- trust
- speed

Users should not need to understand the system to use it.

---

## Revenue-Aware Engineering

Engineering choices should support monetization.

Consider:

- billing readiness
- plan limits
- usage tracking
- account management
- upgrade paths
- auditability
- customer success
- enterprise readiness

Do not build features that are technically impressive but commercially useless.

---

## Release Gate

Before considering work complete, check:

1. Does it work?
2. Does it fit the architecture?
3. Is it secure enough?
4. Is it maintainable?
5. Is it tested appropriately?
6. Does it create user or business value?
7. Is there a simpler solution?
8. Are risks documented?

If any answer is weak, improve before finalizing.

---

## Final Engineering Rule

The best code is not the most clever code.

The best code is the code that creates value, survives change, protects users and can be maintained by a serious team.
