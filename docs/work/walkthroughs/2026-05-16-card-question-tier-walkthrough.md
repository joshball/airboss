---
title: card-question-tier -- manual walkthrough (schema + seeder + classify CLI)
date: 2026-05-16
wp: card-question-tier
status: ready-for-walk
machine: scaffold
branch: scaffold
prompt: scaffold the owed card-question-tier manual-test walkthrough from spec + shipped code
---

# card-question-tier -- manual walkthrough

Walk this end-to-end before flipping `human_review_status: signed-off` on the [card-question-tier WP](../../work-packages/card-question-tier/spec.md). This is a scaffold drafted from [spec.md](../../work-packages/card-question-tier/spec.md) and [test-plan.md](../../work-packages/card-question-tier/test-plan.md) and the shipped code. Joshua runs the test and signs off. The WP does not close until he does.

After each step, check one box:

- [ ] **PASS** -- behaves as the expected-result column says
- [ ] **ISSUE** -- file via `bun run bug new <slug>` and report
- [ ] **REJECT** -- the shape itself is wrong; re-discuss before sign-off

## What this verifies

Card question-tier adds three columns to `study.card` -- `question_tier`, `source_authority`, `acs_codes` -- with CHECK constraints, teaches the yaml-cards seeder and the `createCard` BC to round-trip them, backfills the columns across the course corpus, and ships an interactive `classify-card-tier` CLI for hand-classifying `question_tier`.

Shipped: Phase 1 schema + seeder + pilot (PR #855), Phase 2 inference backfill (PR #949), the `cardType=calculation -> basic` fix on 12 weather cards (PR #843), the `classify-card-tier` CLI (PR #954).

### Out of scope for this walkthrough

The Phase 3 UI surfaces -- the FAA-vs-CFI panel, the tier filter, the ACS lens, the source-authority badge -- were **deferred to dedicated WPs** and have **not shipped**. Do not look for any of them in the study UI; their absence is expected, not a defect. This walkthrough covers only what shipped: the schema, the seeder, the BC round-trip, the backfill data, and the classify CLI.

## Setup

Run from the **parent repo** (the worktree this walkthrough was authored in does not carry `.env`).

```bash
cd /Users/joshua/src/_me/aviation/airboss
git checkout main && git pull --ff-only origin main
bun install
bun run db reset --force
```

`bun run db reset --force` reseeds the corpus, including the six pilot weather cards from `course/knowledge/weather/{reading-metars-tafs,density-altitude,thunderstorm-hazards}/node.md`.

`<abby_id>` below means Abby's user id. Get it once: `bun run db psql -c "SELECT id FROM identity.user WHERE email = 'abby@airboss.test'"`.

No dev server needed -- this walk is all CLI and `db psql`.

## Steps

### 1. The three columns exist with expected types

- **Command:** `bun run db psql -c '\d study.card'`
- **Expected:** `question_tier text`, `source_authority jsonb`, `acs_codes text[]` all present and nullable. Existing columns (`tags jsonb`, `kind text`, etc.) unchanged (test-plan CARD-TIER-1).
- [ ] PASS / ISSUE / REJECT

### 2. question_tier CHECK rejects a bad value

- **Command:** `bun run db psql -c "INSERT INTO study.card (id, user_id, front, back, domain, card_type, kind, question_tier) VALUES ('test_bad_tier', '<abby_id>', 'q', 'a', 'weather', 'basic', 'recall', 'not-a-tier')"`
- **Expected:** the insert fails with constraint violation `card_question_tier_check` (test-plan CARD-TIER-2).
- [ ] PASS / ISSUE / REJECT

### 3. question_tier CHECK accepts valid values and null

- **Command:** insert a card four times with `question_tier` set to `faa-written`, then `cfi-essential`, then `both`, then NULL
- **Expected:** all four inserts succeed (test-plan CARD-TIER-3). Clean up the test rows afterwards.
- [ ] PASS / ISSUE / REJECT

### 4. source_authority CHECK rejects a bad kind and an empty cite

- **Command:** try `INSERT ... source_authority VALUES (... '[{"kind":"made-up","cite":"x"}]'::jsonb)`, then `... '[{"kind":"phak","cite":""}]'::jsonb`
- **Expected:** both inserts fail with `card_source_authority_kinds_check` -- the bad kind and the empty cite each rejected (test-plan CARD-TIER-4, CARD-TIER-5).
- [ ] PASS / ISSUE / REJECT

### 5. The seeder accepts the three new fields

- **Command:** `bun run db reset --force`, watch the `seed-cards: abby@airboss.test` block
- **Expected:** zero parse errors. The six pilot cards land in `study.card` with the new fields populated. The block reports at least six nodes touched (more if other nodes carry yaml-cards) (test-plan CARD-TIER-10).
- [ ] PASS / ISSUE / REJECT

### 6. The seeder rejects an unknown question_tier

- **Command:** add `question_tier: bogus` to one yaml-card in any `node.md`, run `bun run db reset --force`, then revert
- **Expected:** the seeder fails with `<relpath>: yaml-cards[<j>].question_tier 'bogus' is not in QUESTION_TIER_VALUES` (test-plan CARD-TIER-11).
- [ ] PASS / ISSUE / REJECT

### 7. The seeder rejects an unknown source_authority kind and an empty cite

- **Command:** add `source_authority: [{ kind: noaa, cite: "x" }]` to a card and reseed; revert; then add `source_authority: [{ kind: phak, cite: "" }]` and reseed; revert
- **Expected:** the first fails with `... source_authority[0].kind 'noaa' is not in SOURCE_AUTHORITY_KIND_VALUES`; the second fails with `... source_authority[0].cite must be a non-empty string` (test-plan CARD-TIER-12, CARD-TIER-13).
- [ ] PASS / ISSUE / REJECT

### 8. The seeder rejects malformed acs_codes

- **Command:** add `acs_codes: ["lowercase.bad"]` to one card, run `bun run db reset --force`, then revert
- **Expected:** the seeder fails with a per-field error citing the bad code shape (test-plan CARD-TIER-14).
- [ ] PASS / ISSUE / REJECT

### 9. Omitting all three fields produces nulls

- **Command:** after a clean `bun run db reset --force`, pick a card with none of the new fields and run `bun run db psql -c "SELECT question_tier, source_authority, acs_codes FROM study.card WHERE front LIKE '<excerpt>%' LIMIT 1"`
- **Expected:** all three columns NULL (test-plan CARD-TIER-15).
- [ ] PASS / ISSUE / REJECT

### 10. createCard round-trips the three fields

- **Command:** `bun test libs/bc/study/src/cards.test.ts -t question_tier`
- **Expected:** the test passes -- `createCard` with `questionTier`, `sourceAuthority`, `acsCodes` set returns a row carrying those values, and `getCard` re-reads the same shape. The BC validation also rejects an unknown `questionTier`, a malformed `acsCodes` entry, and a bad `sourceAuthority` kind with a `ZodError` (test-plan CARD-TIER-20 through CARD-TIER-23).
- [ ] PASS / ISSUE / REJECT

### 11. Pilot cards carry the expected tier and provenance

- **Command:** run the pilot-card queries from the test-plan (CARD-TIER-30 through CARD-TIER-35), e.g. `bun run db psql -c "SELECT acs_codes, source_authority FROM study.card WHERE front LIKE 'What does the SPECI%'"`
- **Expected:** the SPECI card maps to `PA.I.C.K2a` with an `AC 00-45H` source entry; the TAF change-groups card maps to `PA.I.C.K2c`; the density-altitude calculation card has multi-source authority including a PHAK entry; the rule-of-thumb card is `cfi-essential`; the 20 NM lateral-separation card is `both`; the anvil-rule card is `cfi-essential`.
- [ ] PASS / ISSUE / REJECT

### 12. Backfill populated the corpus

- **Command:** `bun run db psql -c "SELECT count(*) FILTER (WHERE source_authority IS NOT NULL) AS sa, count(*) FILTER (WHERE acs_codes IS NOT NULL) AS acs, count(*) AS total FROM study.card"`
- **Expected:** the bulk of cards carry `source_authority` and `acs_codes` (Phase 2 PR #949 inferred them from tags and frontmatter -- roughly 256 of 262 source_authority, 235 of 262 acs_codes at backfill time). `question_tier` stays null on entries not yet hand-classified -- that is expected, the classify CLI in step 14 is the hand pass.
- [ ] PASS / ISSUE / REJECT

### 13. The calculation-to-basic fix landed on the 12 weather cards

- **Command:** `bun run db psql -c "SELECT count(*) FROM study.card WHERE domain = 'weather' AND card_type = 'calculation'"`
- **Expected:** 0 -- PR #843 reclassified the 12 weather `cardType=calculation` cards to `basic`. No weather card should still read `calculation`.
- [ ] PASS / ISSUE / REJECT

### 14. The classify-card-tier CLI runs interactively

- **Command:** `bun scripts/db/classify-card-tier.ts --dry-run`
- **Expected:** the CLI walks `course/knowledge/**/node.md`, finds yaml-cards entries with `question_tier` unset, and for each prints a context block (node slug, section heading, front/back, ACS codes, source authority, a suggested tier with reasoning) and prompts for a keypress: `f` faa-written, `c` cfi-essential, `b` both, `s` skip, `q` quit, `?` help. In `--dry-run` no file is written. Press `q` to exit.
- [ ] PASS / ISSUE / REJECT

### 15. The classify CLI honours its scoping flags

- **Command:** `bun scripts/db/classify-card-tier.ts --node <a weather node slug> --dry-run`, then `bun scripts/db/classify-card-tier.ts --auto-suggest`
- **Expected:** `--node` restricts the walk to one node id; `--auto-suggest` prints suggestions for every unclassified card with no interactive prompts and no writes.
- [ ] PASS / ISSUE / REJECT

### 16. check pipeline is green

- **Command:** `bun run check all`
- **Expected:** quick plus types both green, 0 errors, 0 warnings; svelte-check across the apps clean (test-plan CARD-TIER-40, CARD-TIER-41).
- [ ] PASS / ISSUE / REJECT

## Sign-off

Only flip when every step above is PASS:

```bash
bun run wp set card-question-tier human-review signed-off
```

(Per the ADR-025 lint, only Joshua's email can flip `human_review_status`. The `status: shipped` move is gated on `human_review_status: signed-off`.)

Note: the deferred Phase 3 UI surfaces are not part of this sign-off. They ship under their own WPs and get their own walkthroughs.

## Related

- [spec.md](../../work-packages/card-question-tier/spec.md) -- schema, seeder, provenance model
- [test-plan.md](../../work-packages/card-question-tier/test-plan.md) -- full CARD-TIER- case matrix
- [design.md](../../work-packages/card-question-tier/design.md) -- column shapes and constraints
- [OUT-OF-SCOPE.md](../../work-packages/card-question-tier/OUT-OF-SCOPE.md) -- deferred Phase 3 UI surfaces
