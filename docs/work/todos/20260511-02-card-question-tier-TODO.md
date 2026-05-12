# 2026-05-11 -- card-question-tier WP author + Phase 1 implementation

Worktree: `.claude/worktrees/agent-ae78c351cb0aa162b`
Branch: `feat/card-question-tier-schema`
Triggering prompt: extend card schema with FAA-vs-CFI distinction, source authority, and ACS codes as first-class typed fields.

## Phase 0 -- WP authoring (this PR)

- [x] Read CLAUDE.md, study constants, schema, seed-cards, sample node.md files, ACS yaml, recent WP frontmatter
- [x] Author `docs/work-packages/card-question-tier/spec.md`
- [x] Author `docs/work-packages/card-question-tier/tasks.md`
- [x] Author `docs/work-packages/card-question-tier/test-plan.md`
- [x] Author `docs/work-packages/card-question-tier/design.md`
- [x] Author `docs/work-packages/card-question-tier/user-stories.md`
- [x] Author `docs/work-packages/card-question-tier/OUT-OF-SCOPE.md`

## Phase 1 -- schema + seeder + pilot cards (this PR)

- [x] Add `QUESTION_TIERS` + `SOURCE_AUTHORITY_KINDS` constants in `libs/constants/src/study.ts`
- [x] Re-export from `libs/constants/src/index.ts`
- [x] Add `questionTier`, `sourceAuthority`, `acsCodes` columns to `card` table in `libs/bc/study/src/schema.ts`
- [x] Update `0000_initial.sql` with the three new columns
- [x] Extend `newCardSchema` and `updateCardSchema` in `libs/bc/study/src/validation.ts`
- [x] Extend `CreateCardInput` + `createCard` in `libs/bc/study/src/cards.ts`
- [x] Extend yaml-cards parser in `scripts/db/seed-cards.ts` to read the three new fields
- [x] Pilot 5-6 cards across density-altitude / reading-metars-tafs / thunderstorm-hazards
- [x] Run `bun run db reset --force` -- clean
- [x] Add unit tests for the parser
- [x] Run `bun run check branch` -- 0 errors / 0 warnings
- [x] Run `bun tools/md-format/bin.ts` on touched markdown files
- [x] Stage individually, commit, push, open PR

## Phase 2 -- backfill (NOT this PR; documented in tasks.md)

- [ ] Walk all 250+ existing cards
- [ ] Infer `acs_codes` from existing `tags[]` PA.* / IR.* / CA.* code patterns; remove from tags
- [ ] Infer `source_authority` from existing tags (ac-XX, aim-X-X-X, phak-XX, afh-X-X)
- [ ] Promote existing free-form `source_ref:` to structured `source_authority`
- [ ] Hand-classify `question_tier` per card (cannot be inferred)
