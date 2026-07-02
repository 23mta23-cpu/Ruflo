# ARCHITECTURE.md

# WERK Architecture Principles

## Purpose
This file defines architectural principles for the WERK project.

Claude must use this file before making structural, technical or infrastructure decisions.

## Core Architecture Principle
Build the simplest architecture that can support the current product while keeping the path open for scale.

Do not over-engineer early.

Do not create architecture that blocks future growth.

## Architecture Goals
WERK architecture should be:

- Simple
- Modular
- Secure
- Testable
- Observable
- Maintainable
- Scalable
- Cost-conscious
- Easy to reason about

## Before Changing Architecture
Ask:

- What problem does this solve?
- Is this problem real now or hypothetical?
- Can the existing architecture handle it?
- Is there a simpler fix?
- What complexity does this add?
- What future maintenance burden does this create?
- Would a senior architect approve this?

## System Design Principles
Prefer:

- Clear module boundaries
- Explicit data flow
- Small services/modules
- Strong typing where possible
- Secure defaults
- Good error handling
- Observability
- Reusable abstractions only when justified

Avoid:

- Premature microservices
- Hidden dependencies
- Tight coupling
- Large God services
- Overly clever abstractions
- Duplicate business logic
- Unnecessary frameworks

## Modularity
Each module should have:

- Clear responsibility
- Clear inputs
- Clear outputs
- Minimal dependencies
- Tests where appropriate

If a module has too many responsibilities, recommend refactoring.

## Data Architecture
For every data-related decision consider:

- Source of truth
- Data ownership
- Data validation
- Data privacy
- Data lifecycle
- Auditability
- Backup/recovery
- Performance
- Cost

Avoid duplicating data unless there is a clear reason.

## API Design
APIs should be:

- Consistent
- Predictable
- Versionable where needed
- Secure by default
- Well validated
- Easy to test
- Easy to document

Never expose internal implementation details unnecessarily.

## AI Architecture
AI features must be designed carefully.

For every AI workflow define:

- Input
- Context
- Model/tool usage
- Output
- Validation
- Failure handling
- Cost per execution
- Privacy implications
- User verification path

Do not create AI workflows that are impossible to debug.

## Security Architecture
Security must be considered from the beginning.

Always consider:

- Authentication
- Authorization
- Secrets management
- Input validation
- Rate limiting
- Logging
- Audit trails
- Least privilege
- Data privacy
- Abuse prevention

## Scalability
Do not optimize for imaginary scale.

But avoid decisions that obviously cannot scale.

Classify scalability needs as:

- Current
- Near-term
- Future
- Hypothetical

Only build for current and near-term needs unless future risk is severe.

## Infrastructure
Infrastructure should be:

- Reliable
- Cost-aware
- Easy to deploy
- Easy to monitor
- Easy to rollback
- Secure by default

Avoid expensive infrastructure before product-market validation unless absolutely required.

## Observability
Important systems should have:

- Logs
- Errors
- Metrics
- Traces where needed
- Alerts for critical failures

If something can fail silently, it probably will.

## Architecture Review Output
For major technical decisions, respond with:

1. Architecture recommendation
2. Current architecture fit
3. Alternatives considered
4. Trade-offs
5. Risks
6. Security implications
7. Scalability implications
8. Cost implications
9. Recommended next step

## Final Rule
Architecture is not about looking sophisticated.

Architecture is about making the product easier to build, operate, scale and improve.
