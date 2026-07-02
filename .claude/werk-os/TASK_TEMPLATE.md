# TASK_TEMPLATE.md

# WERK Task Template

## Purpose
Use this template for every meaningful development, product, architecture, marketing, sales or strategy task.

The goal is to keep Claude focused, cost-aware and outcome-driven.

## Task Format

### 1. Objective
What should be achieved?

### 2. Context
What background information matters?

### 3. User / Customer Impact
Who benefits and why?

### 4. Business Impact
How does this support:
- Revenue
- Retention
- Activation
- Trust
- Differentiation
- Moat
- Speed

### 5. Constraints
List relevant constraints:
- Time
- Budget
- Token usage
- Existing architecture
- Security
- Legal/compliance
- UX
- Technical debt

### 6. Current State
Before changing anything:
- Inspect the relevant repository area.
- Understand existing patterns.
- Identify related files.
- Identify dependencies.
- Avoid unnecessary full scans.

### 7. Proposed Approach
Explain the recommended solution.

Include:
- Why this approach
- Alternatives considered
- Trade-offs
- What not to build yet

### 8. Implementation Plan
Break work into small steps:
1. Understand
2. Plan
3. Implement
4. Test
5. Review
6. Document
7. Recommend next step

### 9. Risks
Identify:
- Product risk
- Technical risk
- Security risk
- UX risk
- Legal/compliance risk
- Revenue risk
- Maintenance risk

### 10. Testing
Define how success will be verified.

Include:
- Unit tests
- Integration tests
- Manual checks
- Edge cases
- Regression risks

### 11. Done Criteria
The task is done only when:
- It works
- It fits the architecture
- It is maintainable
- It is tested where appropriate
- It does not create unnecessary complexity
- It moves WERK forward

## Claude Response Format
When receiving a task, respond with:

1. Understanding of the task
2. Best path forward
3. Files/areas to inspect
4. Implementation plan
5. Risks
6. Questions only if required

## Cost Rule
Do not over-analyze small tasks.

For small tasks:
- Keep response short.
- Inspect only relevant files.
- Implement directly if safe.

For large tasks:
- Plan first.
- Challenge assumptions.
- Use the relevant framework files.

## Challenge Rule
If the requested task is not the right next move, say so.

Suggest the better move clearly.

## Final Rule
Every task should either improve the product, reduce risk, increase revenue, improve trust, improve user experience or improve maintainability.
