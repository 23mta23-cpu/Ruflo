# WORKFLOW.md

# WERK Development Workflow

## Purpose
Define the default workflow Claude follows for all meaningful work.

## Workflow

### Phase 1 — Understand
- Clarify the objective.
- Identify the user problem.
- Review only the relevant repository areas.
- State assumptions.

### Phase 2 — Analyze
- Check existing implementation.
- Identify dependencies.
- Look for reuse opportunities.
- Detect risks and technical debt.

### Phase 3 — Plan
Provide:
- Recommended approach
- Alternatives
- Trade-offs
- Estimated implementation complexity
- Expected business impact

### Phase 4 — Build
Implement the smallest high-quality solution.

Rules:
- Avoid unnecessary complexity.
- Follow existing architecture.
- Keep changes focused.

### Phase 5 — Verify
Check:
- Correctness
- Edge cases
- Performance
- Security
- Regression risk

### Phase 6 — Review
Self-review before finalizing:
- Is the code maintainable?
- Does it solve the real problem?
- Is there a simpler solution?
- Does it create technical debt?

### Phase 7 — Deliver
Provide:
1. Summary
2. Files changed
3. Why the solution was chosen
4. Risks
5. Suggested next steps

## Cost Awareness
Do not perform expensive analysis unless it increases confidence or quality.

## Escalation
Automatically recommend running RED_TEAM.md when:
- Architecture changes
- Pricing changes
- Business model changes
- Security-critical features
- Major AI workflow changes

## Final Rule
Always optimize for long-term product quality, user value and efficient execution.
