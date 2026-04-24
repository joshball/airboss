# ADR 014: Engine scoring coefficient naming

Status: **Proposed**.

Date proposed: 2026-04-24.

Deciders: product, engineering.

Blocks: Phase 4 of the magic-strings audit (`docs/work/reviews/20260424-magic-strings-audit.md`).

## Context

The session-item scoring engine in `libs/bc/study/src/engine.ts` contains ~20 bare numeric literals that are domain-meaningful tuning dials (weights for Continue / Strengthen / Expand slice candidates, overdue ratio thresholds, rep accuracy thresholds, etc.). These bypass the project rule that literal values live in `libs/constants/`.

The magic-strings audit flagged them for extraction but deferred the work because:

1. The numbers have behavioural coverage in `libs/bc/study/src/engine.test.ts`. An extraction that changes any value would fail tests; silent changes risk drift between spec intent and behaviour.
2. Naming the coefficients requires a stance on the product model -- what does each weight *mean* in product terms? `CONTINUE.LAST_SESSION_DOMAIN_WEIGHT` implies a design narrative that doesn't exist in one place today.
3. Some literals are tuning dials (0.9, 0.6) and some are thresholds (0.6 rep accuracy, 2x overdue ratio). They deserve different naming schemes (dials in an `ENGINE_WEIGHTS` namespace vs thresholds that are product decisions).

## Decision needed

1. Name the coefficients as a flat `ENGINE_SCORING` constant vs a nested shape per slice (Continue / Strengthen / Expand / Diversify).
2. Document each coefficient's product meaning before extraction, not after.
3. Agree on the test strategy: the extraction PR must produce byte-identical output from `engine.test.ts`; run before/after snapshot of every test's `expect()` to prove invariance.

## Scope of the follow-up PR

- Add `libs/constants/src/engine.ts` with named constants.
- Sweep `engine.ts` literals; no semantic change.
- Add a section to the BC test suite that asserts coefficient identity (import the constant and compare to the pre-extraction baseline fixture).
- Update CLAUDE.md "Critical Rules" to cite `ENGINE_SCORING` as the canonical tuning location.

## Consequences

- Future tuning changes route through named constants, making scoring changes reviewable.
- Adds one more constants module; trivial cost.
- If this ADR is NOT accepted, engine scoring stays as bare literals and the project rule has a permanent exception (also acceptable, but document the exception in CLAUDE.md).

## References

- `docs/work/reviews/20260424-magic-strings-audit.md` -- original audit finding
- PR #117 (refactor: magic-strings sweep) -- Phases 1-3, 5, 6 landed; Phase 4 deferred
- `libs/bc/study/src/engine.ts` -- scoring implementation
- `libs/bc/study/src/engine.test.ts` -- test coverage
