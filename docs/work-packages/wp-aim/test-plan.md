---
title: 'WP-AIM -- test plan'
type: test-plan
status: done
---

# Test plan

## Automated

- **Manifest validator**: `aimManifestSchema` parses `aim/2026-04/manifest.json` cleanly. Negative case: a manifest with an unknown `kind` value fails parse.
- **Seed integration**: a synthetic AIM manifest with 1 chapter, 1 section under it, 1 paragraph under that produces 4 rows (1 reference + 3 sections) with correct parent ids and depths.
- **Idempotency**: re-running the seed against an unchanged manifest produces zero `sectionsChanged` (the existing pattern in `section-tree.test.ts`).
- **Tree-walk**: section without a matching chapter parent throws a clear error, not a null-parent FK violation.

## Manual

- `bun run db reset --force && bun run db seed` -> `study.reference WHERE document_slug='aim'` returns 1 row; `study.reference_section WHERE reference_id = ...` returns 745 rows.
- `/library` shows the AIM card with "Read in-app" badge.
- Clicking the card opens the chapter index.
- Clicking chapter 1 opens its section list.
- Clicking section 1-1 renders the paragraph list / paragraph bodies.
- AIM card appears under topic spines for `regulations`, `procedures`, `navigation`. Absent from cert spines (cert-agnostic).

## Out of scope

- Search UI (deferred per spec).
- Cross-edition refresh.
- Citation deep-link interop with WP-CFR (lands when CFR ships).
