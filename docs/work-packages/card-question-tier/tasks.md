---
id: card-question-tier
title: 'Tasks: Card Question-Tier + Provenance'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks: []
tags:
  - cards
  - schema
  - tasks
legacy_fields:
  feature: card-question-tier
  type: tasks
---

# Tasks: Card Question-Tier + Provenance

Phased plan for [spec.md](./spec.md). Phase 1 ships the schema + seeder + a six-card pilot in one PR. Phase 2 backfills the remaining ~245 existing course cards. Phase 3 mounts the surfaces (filter chips, side-by-side panel, ACS lens) on top of the typed shape -- each surface is its own follow-on WP.

## Pre-flight

- [x] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) end-to-end.
- [x] Read [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts) -- the `card` table the new columns extend.
- [x] Read [libs/constants/src/study.ts](../../../libs/constants/src/study.ts) -- `CARD_TYPES`, `CARD_KINDS`, `CONTENT_SOURCES`, `CARD_STATUSES` shape the new constants follow.
- [x] Read [scripts/db/seed-cards.ts](../../../scripts/db/seed-cards.ts) -- the yaml-cards parser the seeder change extends.
- [x] Read [libs/bc/study/src/cards.ts](../../../libs/bc/study/src/cards.ts) -- `createCard` + `CreateCardInput`.
- [x] Read [libs/bc/study/src/validation.ts](../../../libs/bc/study/src/validation.ts) -- `newCardSchema` and `updateCardSchema`.

## Phase 1 -- schema + seeder + six-card pilot (this PR)

Single PR titled `feat(cards): question-tier + source-authority + acs-codes as first-class fields`.

### Constants

- [x] Add `QUESTION_TIERS`, `QUESTION_TIER_VALUES`, `QUESTION_TIER_LABELS`, `type QuestionTier` to `libs/constants/src/study.ts` next to `CARD_KINDS` (line ~243).
- [x] Add `SOURCE_AUTHORITY_KINDS`, `SOURCE_AUTHORITY_KIND_VALUES`, `SOURCE_AUTHORITY_KIND_LABELS`, `type SourceAuthorityKind` and the `SourceAuthority` interface (`{ kind: SourceAuthorityKind; cite: string }`).
- [x] Add `ACS_CODE_PATTERN` regex for ACS task-element shape validation (`/^[A-Z]{2}\.[IVX]+\.[A-Z]+\.[KRS]\d+[a-z]?$/`).
- [x] Re-export the new symbols from `libs/constants/src/index.ts`.

### Schema

- [x] Extend `card` table in `libs/bc/study/src/schema.ts`:
  - `questionTier: text('question_tier').$type<QuestionTier>()` (nullable)
  - `sourceAuthority: jsonb('source_authority').$type<SourceAuthority[]>()` (nullable)
  - `acsCodes: text('acs_codes').array()` (nullable)
- [x] Add CHECK constraint `card_question_tier_check`: `"question_tier" IS NULL OR "question_tier" IN (<QUESTION_TIER_VALUES>)`.
- [x] Add CHECK constraint `card_source_authority_kinds_check` using jsonb path validation: every element of the array must have a `kind` matching `SOURCE_AUTHORITY_KIND_VALUES` and a non-empty `cite`. (Implementation: SQL function expression over `jsonb_array_elements`.)
- [x] Update `0000_initial.sql` to mirror the schema change (per CLAUDE.md "no Drizzle migrations" rule -- regenerate via `bunx drizzle-kit generate` or hand-edit the existing single SQL file).

### Validation

- [x] Extend `newCardSchema` and `updateCardSchema` in `libs/bc/study/src/validation.ts` with:
  - `questionTier: z.enum(QUESTION_TIER_VALUES).nullish()`
  - `sourceAuthority: z.array(z.object({ kind: z.enum(SOURCE_AUTHORITY_KIND_VALUES), cite: z.string().trim().min(1).max(200) })).max(10).nullish()`
  - `acsCodes: z.array(z.string().trim().regex(ACS_CODE_PATTERN)).max(20).nullish()`

### BC

- [x] Extend `CreateCardInput` and `UpdateCardInput` in `libs/bc/study/src/cards.ts` with the three optional fields.
- [x] `createCard` passes the three fields through to the insert.
- [x] `updateCard` copies the three fields when present in the input.

### Seeder

- [x] Extend `ParsedCard` in `scripts/db/seed-cards.ts` with the three new optional fields.
- [x] Extend `extractCardsFromBody` to read and validate `question_tier`, `source_authority`, `acs_codes` per yaml-cards entry. Per-entry error path includes the field name.
- [x] Extend the `createCard` call in `seedCardsForUser` to pass through the three new fields.

### Pilot cards (round-trip proof)

- [x] Edit `course/knowledge/weather/reading-metars-tafs/node.md` -- promote 2 cards (SPECI indicator + TAF change-groups cloze) with `acs_codes` + `source_authority`.
- [x] Edit `course/knowledge/weather/density-altitude/node.md` -- promote 2 cards (DA computation + 120 ft / deg C rule) with `source_authority` and one `question_tier`.
- [x] Edit `course/knowledge/weather/thunderstorm-hazards/node.md` -- promote 2 cards (20 NM rule + anvil rule) with `question_tier` + `source_authority`.

### Tests

- [x] Extend / create `scripts/db/seed-cards.test.ts` covering: parser accepts the new fields, parser rejects unknown `question_tier`, unknown `source_authority.kind`, empty `cite`, malformed `acs_codes`.
- [x] Extend `libs/bc/study/src/cards.test.ts` covering: `createCard` round-trips the three fields when set; rejects bad shapes; defaults to null when omitted.

### Verification

- [x] `bun run db reset --force` completes clean. Six pilot cards present in `study.card` with the expected new-column values.
- [x] `bun run check branch` -- 0 errors, 0 warnings.
- [x] `bun tools/md-format/bin.ts` on touched markdown files.
- [x] Spot-check via `bun run db psql -c 'SELECT front, question_tier, source_authority, acs_codes FROM study.card WHERE acs_codes IS NOT NULL LIMIT 5'` -- six pilot cards round-trip cleanly.

### Ship

- [x] Stage individually by name (no `git add -A`).
- [x] Commit `feat(cards): question-tier + source-authority + acs-codes as first-class fields`.
- [x] Push, open PR via `gh pr create`. PR body summarises the three new fields, the six pilot cards, and the deferred backfill.

## Phase 2 -- backfill the remaining ~245 cards (follow-on PR)

Not part of this WP's first-slice ship. Documented here so it doesn't fall off the radar.

- [ ] Author `scripts/db/backfill-card-provenance.ts`. The script walks every node.md, reads each yaml-cards block, and:
  - Infers `acs_codes` from any tag matching `ACS_CODE_PATTERN`. Removes those tags from `tags[]`.
  - Infers `source_authority` from tag patterns: `ac-XX` / `ac-XX-XX` -> `{ kind: 'ac', cite: 'AC <upper>' }`; `aim-X-X-X` -> `{ kind: 'aim', cite: 'AIM <X-X-X>' }`; `phak-XX` -> `{ kind: 'phak', cite: 'PHAK Ch <XX>' }`; `afh-X-X` -> `{ kind: 'afh', cite: 'AFH <X-X>' }`; `cfr-XX-XXX-XXX` (rare today) -> `{ kind: 'cfr', cite: '<XX> CFR <XXX>.<XXX>' }`. Removes the matched tags from `tags[]`.
  - For cards with the existing free-form `source_ref:` field, parses out the canonical citation prefix (e.g. "PHAK Ch 11; body Discover" -> `{ kind: 'phak', cite: 'PHAK Ch 11' }`) and seeds `source_authority` from it. Leaves `source_ref` populated for the prose context (it carries body-section pointers the structured field doesn't).
  - Leaves `question_tier` NULL. The FAA-vs-CFI distinction has to be hand-classified per card; no inference is reliable.
- [ ] Run the backfill in dry-run mode first; review the diff per node before applying.
- [ ] Apply, regenerate `0000_initial.sql` if the seeder changed shape, run `bun run db reset --force` to confirm the new node.md files round-trip clean.
- [ ] Manual hand-classification of `question_tier` happens iteratively as the user works through nodes; not a single batch.

## Phase 3 -- surfaces (each its own follow-on WP)

- [ ] WP `card-tier-filter`: review-queue and browse-cards filter for `question_tier`; chips on the card detail page.
- [ ] WP `card-faa-vs-cfi-pair`: when both a `faa-written` card and a `cfi-essential` card cover the same fact (same node + overlapping `acs_codes`), render them paired on the detail page.
- [ ] WP `acs-coverage-lens`: per ACS task element, list cards that map to it; surface coverage gaps.
- [ ] WP `source-authority-chips`: structured-citation chips on the card detail page that deep-link into the flightbag reference reader.
