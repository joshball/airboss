---
title: 'WP-AIH -- test plan'
product: study
feature: wp-aih-section-tree
type: test-plan
status: unread
review_status: pending
created: 2026-05-02
---

# WP-AIH -- test plan

## Automated

- `bun run check` -- type + lint clean.
- `bun test libs/sources/src/handbooks-extras/ingest.test.ts` -- updated count (5 -> 4), id list, slug-presence loop.
- `bun test libs/bc/study/src/manifest-validation.test.ts` -- AIH fixture parses as `kind: 'handbook'`.
- `bun test scripts/sources/config/loader.test.ts` -- extras YAML loads with the AIH row removed.
- `bun run sources verify-urls` -- the new chapter URLs and ancillaries return 200.

## Manual

1. `bun run sources download --only handbooks` completes without errors. Cache shows 10 chapter PDFs under `~/Documents/airboss-handbook-cache/handbooks/aviation-instructor/FAA-H-8083-9/`.
2. `bun run sources extract handbooks aviation-instructor --edition FAA-H-8083-9` runs to completion. Manifest at `handbooks/aviation-instructor/FAA-H-8083-9/manifest.json` contains a non-empty `sections[]` with 10 chapter rows.
3. `bun run sources register --include-handbooks-extras` (or the equivalent register pipeline) refreshes `handbooks/handbooks-extras-index.json` without an AIH row.
4. `bun run db reset --force && bun run db seed` runs clean.
5. Open `/library`, search for AIH. Card shows readable + section-tree. Click drills into 10 chapters.
6. Open chapter 1 (Risk Management and SRM). Verify body renders, sections exist, no truncation. Spot-check the "Use of Resources" subsections (depth 5 in source) -- they should appear flattened to depth 3 with content intact.
7. Open chapter 9 (Techniques of Flight Instruction). Same spot-check.
8. Open a study card that cites AIH and confirm the citation deep-link resolves to the section.

## Acceptance gate

- All automated checks green.
- Manual flow above completed by the user.
- L4/L5 flatten produces no missing-content surprises (or surprises documented).
