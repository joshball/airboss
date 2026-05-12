---
id: card-question-tier
title: 'Test Plan: Card Question-Tier + Provenance'
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
  - test-plan
legacy_fields:
  feature: card-question-tier
  type: test-plan
---

# Test Plan: Card Question-Tier + Provenance

Manual acceptance tests for [spec.md](./spec.md). Prefix `CARD-TIER-`. Phase 1 only -- backfill (Phase 2) and surfaces (Phase 3) get their own test plans when authored.

## Setup

- `bun install` clean.
- `bun run db reset --force` completes clean. Six pilot cards from `course/knowledge/weather/{reading-metars-tafs,density-altitude,thunderstorm-hazards}/node.md` land in `study.card`.
- `bun run check branch` is green on the feature branch.

## Schema (CARD-TIER-1 .. 5)

### CARD-TIER-1: new columns exist with expected types

1. Run `bun run db psql -c '\d study.card'`.
2. **Expected:** `question_tier text`, `source_authority jsonb`, `acs_codes text[]` all present and nullable. Existing columns (`tags jsonb`, `kind text`, etc.) unchanged.

### CARD-TIER-2: question_tier CHECK rejects bad values

1. Run `bun run db psql -c "INSERT INTO study.card (id, user_id, front, back, domain, card_type, kind, question_tier) VALUES ('test_bad_tier', '<abby_id>', 'q', 'a', 'weather', 'basic', 'recall', 'not-a-tier')"`.
2. **Expected:** insert fails with constraint violation `card_question_tier_check`.

### CARD-TIER-3: question_tier CHECK accepts valid values + null

1. Insert a card with `question_tier = 'faa-written'`. Then `'cfi-essential'`. Then `'both'`. Then NULL.
2. **Expected:** all four inserts succeed.

### CARD-TIER-4: source_authority shape CHECK rejects bad kind

1. Try `INSERT INTO study.card (... source_authority) VALUES (... '[{"kind":"made-up","cite":"x"}]'::jsonb)`.
2. **Expected:** insert fails with `card_source_authority_kinds_check`.

### CARD-TIER-5: source_authority shape CHECK rejects empty cite

1. Try `INSERT INTO study.card (... source_authority) VALUES (... '[{"kind":"phak","cite":""}]'::jsonb)`.
2. **Expected:** insert fails with `card_source_authority_kinds_check`.

## Seeder (CARD-TIER-10 .. 15)

### CARD-TIER-10: yaml-cards parser accepts the three new fields

1. `bun run db reset --force`.
2. Watch for `seed-cards: abby@airboss.test` block. Should report 6 nodes touched (more if other nodes carry yaml-cards) with no errors.
3. **Expected:** zero parse errors. Six pilot cards land in the DB with the new fields populated.

### CARD-TIER-11: yaml-cards parser rejects unknown question_tier

1. Add `question_tier: bogus` to one card in any node.md.
2. Run `bun run db reset --force`.
3. **Expected:** seeder fails with `<relpath>: yaml-cards[<j>].question_tier 'bogus' is not in QUESTION_TIER_VALUES`.
4. Revert.

### CARD-TIER-12: yaml-cards parser rejects unknown source_authority kind

1. Add `source_authority: [{ kind: noaa, cite: "x" }]` to one card.
2. Run `bun run db reset --force`.
3. **Expected:** seeder fails with `<relpath>: yaml-cards[<j>].source_authority[0].kind 'noaa' is not in SOURCE_AUTHORITY_KIND_VALUES`.
4. Revert.

### CARD-TIER-13: yaml-cards parser rejects empty cite

1. Add `source_authority: [{ kind: phak, cite: "" }]` to one card.
2. Run `bun run db reset --force`.
3. **Expected:** seeder fails with `<relpath>: yaml-cards[<j>].source_authority[0].cite must be a non-empty string`.
4. Revert.

### CARD-TIER-14: yaml-cards parser rejects malformed acs_codes

1. Add `acs_codes: ["lowercase.bad"]` to one card.
2. Run `bun run db reset --force`.
3. **Expected:** seeder fails with a per-field error citing the bad code shape.
4. Revert.

### CARD-TIER-15: omitting all three fields produces nulls

1. Pick a card without the new fields (most existing cards qualify).
2. After `bun run db reset --force`, `bun run db psql -c "SELECT question_tier, source_authority, acs_codes FROM study.card WHERE front LIKE '<excerpt>%' LIMIT 1"`.
3. **Expected:** all three columns NULL.

## BC + validation (CARD-TIER-20 .. 23)

### CARD-TIER-20: createCard round-trips the three fields

1. Run `bun test libs/bc/study/src/cards.test.ts -t question_tier` (or run the new test directly).
2. **Expected:** the test passes -- `createCard({..., questionTier: 'faa-written', sourceAuthority: [{kind:'cfr', cite:'14 CFR 91.155'}], acsCodes: ['PA.I.C.K1']})` returns a row with those three values populated, and re-reading via `getCard` returns the same shape.

### CARD-TIER-21: validation rejects unknown question_tier via BC

1. Direct call: `await createCard({..., questionTier: 'bogus' as QuestionTier})`.
2. **Expected:** Zod `ZodError` thrown citing `questionTier`.

### CARD-TIER-22: validation rejects malformed acs_codes via BC

1. Direct call: `await createCard({..., acsCodes: ['BadCode']})`.
2. **Expected:** Zod `ZodError` thrown citing `acsCodes.0`.

### CARD-TIER-23: validation rejects bad source_authority kind via BC

1. Direct call: `await createCard({..., sourceAuthority: [{kind: 'noaa' as SourceAuthorityKind, cite: 'x'}]})`.
2. **Expected:** Zod `ZodError` thrown citing `sourceAuthority.0.kind`.

## Pilot cards (CARD-TIER-30 .. 35)

Each pilot card is a separate scenario. Run `bun run db reset --force` once, then verify each row.

### CARD-TIER-30: SPECI card maps to PA.I.C.K2a

1. `bun run db psql -c "SELECT acs_codes, source_authority FROM study.card WHERE front LIKE 'What does the SPECI%'"`.
2. **Expected:** `acs_codes = {PA.I.C.K2a}`, `source_authority` includes a `{kind: ac, cite: 'AC 00-45H'}` entry.

### CARD-TIER-31: TAF change-groups card maps to PA.I.C.K2c

1. `bun run db psql -c "SELECT acs_codes, source_authority FROM study.card WHERE front LIKE 'TAF change groups%'"`.
2. **Expected:** `acs_codes = {PA.I.C.K2c}`.

### CARD-TIER-32: density-altitude calculation card has multi-source authority

1. `bun run db psql -c "SELECT source_authority FROM study.card WHERE front LIKE 'Compute density altitude. PA = 6,572%'"`.
2. **Expected:** `source_authority` is a non-empty jsonb array with at least one PHAK entry.

### CARD-TIER-33: 120 ft/deg C rule card carries question_tier

1. `bun run db psql -c "SELECT question_tier FROM study.card WHERE front LIKE 'Density-altitude rule of thumb%'"`.
2. **Expected:** `question_tier = 'cfi-essential'` (this is a CFI's mental-math heuristic; the FAA written tests it indirectly).

### CARD-TIER-34: 20 NM rule card is question_tier=both

1. `bun run db psql -c "SELECT question_tier FROM study.card WHERE front LIKE 'What is the standard pilot rule for lateral separation%'"`.
2. **Expected:** `question_tier = 'both'` (FAA written + CFI essential; same fact serves both audiences).

### CARD-TIER-35: anvil-rule card is question_tier=cfi-essential

1. `bun run db psql -c "SELECT question_tier FROM study.card WHERE front LIKE 'Why is no flight permitted under an overhanging anvil%'"`.
2. **Expected:** `question_tier = 'cfi-essential'`.

## Check pipeline (CARD-TIER-40 .. 41)

### CARD-TIER-40: bun run check branch passes

1. `bun run check branch`.
2. **Expected:** all steps green, 0 errors, 0 warnings on the feature branch's diff.

### CARD-TIER-41: bun run check all passes

1. `bun run check all`.
2. **Expected:** quick + types both green. svelte-check across 5 apps clean.
