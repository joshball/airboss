---
id: card-question-tier
title: 'Spec: Card Question-Tier + Provenance'
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
  - provenance
  - faa-vs-cfi
  - acs
legacy_fields:
  feature: card-question-tier
  type: spec
---

# Spec: Card Question-Tier + Provenance

Promote three concepts that today live as free-form `tags[]` strings on `study.card` into typed, first-class columns: **what audience the card serves** (FAA written test vs CFI essentials vs both), **what authoritative source backs the answer** (CFR / AC / AIM / PHAK / AFH), and **which ACS task elements the card maps to** (PA.I.C.K1, etc.).

## Why this WP exists

The user's framing, distilled:

- The FAA written test asks questions that are technically right but operationally bad. Outdated regs, gotcha phrasing, distinctions without real difference. Students must memorize for the test, AND want to learn what real CFIs say matters. These are often different cards.
- The card system today buries that distinction inside `tags[]`. `tags: [weather, vfr-mins, class-b]` does not tell the learner whether this card exists because the FAA tests it or because pilots actually need it.
- A typed primitive lets the learner filter cards by **what they NEED for the FAA written**, separately from **what their CFI says is essential**, and lets the surface render side-by-side FAA-card and CFI-card pairs on the same fact when both exist.

Source authority and ACS K-code mapping ride the same wave: today they're tag-encoded (`tags: [..., ac-00-45h, PA.I.C.K2a]`), which makes filtering, citation rendering, and ACS coverage analysis grep jobs instead of typed reads. Promoting them to typed columns lets the BC return them as structured data and lets future surfaces (citation chips on review, "all cards for PA.I.C.K2a" lenses, source-authority badges) read clean shapes.

## Scope

### In

- Three new nullable columns on `study.card`:
  - `question_tier text` -- `'faa-written' | 'cfi-essential' | 'both'`, NULL = unknown
  - `source_authority jsonb` -- array of `{ kind, cite }` objects; `kind` constrained to `cfr | ac | aim | phak | afh | other`; NULL = unknown
  - `acs_codes text[]` -- array of ACS task element codes (`PA.I.C.K1`, `IR.II.A.K2c`, etc.); NULL = unknown
- New constants in `libs/constants/src/study.ts`:
  - `QUESTION_TIERS`, `QUESTION_TIER_VALUES`, `QUESTION_TIER_LABELS`, type `QuestionTier`
  - `SOURCE_AUTHORITY_KINDS`, `SOURCE_AUTHORITY_KIND_VALUES`, `SOURCE_AUTHORITY_KIND_LABELS`, type `SourceAuthorityKind`
  - `SourceAuthority` interface (`{ kind: SourceAuthorityKind; cite: string }`)
  - `ACS_CODE_PATTERN` regex (uppercase rating prefix + dotted task path) for shape validation
- yaml-cards parser (`scripts/db/seed-cards.ts`) extended to accept the three new optional fields and reject malformed shapes with a per-field path error
- BC plumbing: `CreateCardInput`, `UpdateCardInput`, `newCardSchema`, `updateCardSchema`, `createCard`, `updateCard` accept and persist the three new fields
- DB CHECK constraints: `card_question_tier_check` (NULL OR in `QUESTION_TIER_VALUES`), and a jsonb-shape check on `source_authority` (every element must have a known `kind` per `SOURCE_AUTHORITY_KIND_VALUES` and a non-empty `cite`)
- Pilot: 5-6 weather cards re-authored in their node.md files with one or more of the new fields populated, as proof of round-trip
- `0000_initial.sql` regenerated with the three columns + constraints (no Drizzle migrations -- single greenfield SQL per CLAUDE.md)
- Tests:
  - `scripts/db/seed-cards.test.ts` -- yaml-cards parser accepts the new fields, rejects bad shapes (unknown `question_tier`, unknown `source_authority.kind`, empty `cite`, non-array `acs_codes`)
  - `libs/bc/study/src/cards.test.ts` -- `createCard` round-trips the three fields, validation rejects bad shapes
- Phasing: this WP ships the schema + seeder + pilot in one PR. Backfill of the remaining ~245 existing course cards is a follow-on phase (Phase 2 in tasks.md), not this PR.

### Out

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) for the full list with rationale and revisit triggers.

Headline exclusions:

- UI surfaces that render the new fields (filter chips, side-by-side FAA-vs-CFI panel, source-authority badge, ACS-code lens). Schema lands first; UI rides on top in dedicated WPs.
- Bulk backfill of `acs_codes` and `source_authority` from existing tag patterns -- Phase 2 in [tasks.md](./tasks.md), separate PR.
- Renaming or removing the existing `tags[]` column. Tags stay as the free-form augmentation channel; promoted concepts simply move out of it. Once the backfill phase strips the now-redundant tag values, `tags[]` will hold only what isn't already typed elsewhere.

## Pilot cards (this PR)

Six cards across three weather nodes get the new fields populated, as a round-trip proof:

| Node                      | Card front (excerpt)                                      | Fields demonstrated                                |
| ------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `wx-reading-metars-tafs`  | "What does the SPECI type indicator on a METAR tell you?" | `acs_codes: [PA.I.C.K2a]`, `source_authority`      |
| `wx-reading-metars-tafs`  | TAF change-groups cloze (FM / TEMPO / PROB)               | `acs_codes: [PA.I.C.K2c]`, `source_authority`      |
| `wx-density-altitude`     | "Compute density altitude. PA = 6,572 ft, OAT = 96 F"     | `source_authority` (PHAK Ch 11), `question_tier`   |
| `wx-density-altitude`     | DA rule of thumb (120 ft / deg C)                         | `source_authority`, `question_tier: cfi-essential` |
| `wx-thunderstorm-hazards` | "Standard pilot rule for lateral separation from cell"    | `question_tier: both`, `source_authority`          |
| `wx-thunderstorm-hazards` | "Why is no flight permitted under an overhanging anvil?"  | `question_tier: cfi-essential`, `source_authority` |

The pilot intentionally exercises every shape: question_tier alone, source_authority alone, acs_codes alone, all three together, and at least one card with multi-source `source_authority` (PHAK + AC).

## Surfaces unblocked (future WPs, not built here)

- **FAA-vs-CFI side-by-side panel** -- when a fact has both a `faa-written` card and a `cfi-essential` card on the same node, surface them paired so the learner sees the FAA framing next to the CFI framing.
- **Tier filter on review queue** -- learner wants "today, drill only my FAA-written cards" or "today, drill only what my CFI flagged."
- **ACS coverage lens** -- per ACS task element, show "you have N cards covering PA.I.C.K2a; here's where they live."
- **Source-authority badge on the card detail page** -- structured citations render as chips that deep-link into the flightbag reference reader.
- **Provenance trust signals** -- "this card cites 14 CFR 91.155" gets a CFR badge; the learner trusts the answer because the source is named.

These are all cheap once the schema exists. None of them are built in this WP.

## References

- The user's framing prompt (this WP author task), 2026-05-11
- [docs/decisions/011-knowledge-graph-learning-system/decision.md](../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy; the FAA-vs-CFI distinction is a special case of "what knowledge does this card test, and why."
- [docs/decisions/025-wp-frontmatter-contract/decision.md](../../decisions/025-wp-frontmatter-contract/decision.md) -- frontmatter contract this WP follows.
- [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts) -- `card` table definition the new columns extend.
- [libs/constants/src/study.ts](../../../libs/constants/src/study.ts) -- where the new constants land alongside `CARD_TYPES`, `CARD_KINDS`, `CONTENT_SOURCES`.
- [scripts/db/seed-cards.ts](../../../scripts/db/seed-cards.ts) -- yaml-cards parser the seeder change extends.
- [course/syllabi/ppl-airplane-acs-6c/areas/01-preflight-preparation.yaml](../../../course/syllabi/ppl-airplane-acs-6c/areas/01-preflight-preparation.yaml) -- ACS K-code shape and `code` format (`PA.I.C.K1`, `PA.I.C.K2a`).

## Out of Scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
