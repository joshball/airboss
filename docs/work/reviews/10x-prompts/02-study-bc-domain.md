# Chunk 2 -- Study BC domain logic

Paste the block below as the first message in a fresh Claude Code session.

---

```text
/ball-review-10x

Scope is locked. Do NOT re-negotiate it -- review exactly what is listed below.

## What to review
The Study bounded context: `libs/bc/study/`. This is the brain of the study product.

Specifically all files under `libs/bc/study/src/`, including:

- Card model and SRS: `cards.ts`, `cards-public.ts`, `srs.ts`, `reviews.ts`, `snooze.ts`, `feedback.ts`
- Sessions and reps: `sessions.ts`, `review-sessions.ts`
- Plans and goals: `plans.ts`, `plans.validation.ts`, `goals.ts`
- Knowledge graph: `knowledge.ts` (and tests for cert/citations/progress)
- Library by cert: `library-by-cert.ts`, `library-by-cert.orphan.test.ts`
- Calibration / lens / mastery: `calibration.ts`, `lenses.ts`, `mastery.ts`
- Engine + scoring: `engine.ts`, `engine-targeting.ts` (per ADR 014, scoring constants must come from `ENGINE_SCORING` in `libs/constants/src/engine.ts` -- flag any inline numeric literals in scoring functions)
- Scenarios + deck spec: `scenarios.ts`, `deck-spec.ts`, `saved-decks.ts`
- Handbooks integration: `handbooks.ts`, `handbooks-errata.ts`, `handbook-validation.ts`
- Citations: anything under `libs/bc/study/src/citations/`
- Syllabi, credentials, dashboard, stats, sim-bias: `syllabi.ts`, `credentials.ts`, `credentials.validation.ts`, `dashboard.ts`, `stats.ts`, `sim-bias.ts`
- Schema: `schema.ts`, `composite-fks.schema.test.ts`, `card-cross-references.ts`
- Validation + formatters + test-support: `validation.ts`, `formatters.ts`, `test-support.ts`

## What is NOT in scope
- `apps/study/` -- routes/UI. Reviewed separately as chunk 1.
- `libs/auth/`, `libs/audit/` -- reviewed separately as chunk 3.
- `libs/sources/`, `libs/aviation/` -- reviewed separately as chunk 4.
- `libs/bc/sim/`, `libs/bc/avionics/`, `libs/bc/citations/`, `libs/bc/hangar/` -- different BCs.

If study BC code calls out to other libs, READ those files for context but do not raise findings outside `libs/bc/study/`.

## Project context the reviewers must respect
- Read `CLAUDE.md` at repo root and `libs/bc/study/CLAUDE.md` if present.
- Hard rules: Drizzle ORM only (no raw SQL), no `any`, no magic numbers (constants belong in `libs/constants/`), IDs via `createId()` from `@ab/utils` only -- never raw `nanoid()`/`ulid()`, `@ab/*` aliases for cross-lib imports.
- ADR 011 governs the discovery-first knowledge graph pedagogy -- check `docs/decisions/011-knowledge-graph-learning-system/decision.md` before reviewing `knowledge.ts`.
- ADR 014 governs engine scoring constants -- check `docs/decisions/014-*/decision.md` (or grep for `ENGINE_SCORING`).
- Co-located tests are the convention -- every `foo.ts` should have a `foo.test.ts` near it. Flag missing test coverage in the testing review.

## Reviewers to launch (floor -- detect stack and add more if appropriate)
Core: correctness, security, perf, architecture, a11y (skip if no UI), patterns, testing, dx.
Stack-specific: schema (this BC defines `study` namespace tables), backend (BC functions are server-side data access).
Skip: ux, svelte, tauri/rust/dotnet/maui.

## Spec context
Check `docs/work-packages/` for packages that match areas in this BC: `library-completeness`, `library-substrate`, `cert-progress`, `knowledge-graph`, `plans`, `reps`, `calibration`, `lens`, `goals`, `srs`, `scenarios`. If a relevant spec exists, pass its `spec.md` content to the agents reviewing that area so they can check implementation against intended behavior.

Also check ADR 011, 014, and any others under `docs/decisions/` whose subject matches files in scope.

## Output
Each agent writes one review file to `docs/work/reviews/{YYYY-MM-DD}-study-bc-domain-{category}.md`. After all agents complete, build the summary table and report findings. Do NOT auto-fix -- present the punch list and await my call on `/ball-review-fix`.
```
