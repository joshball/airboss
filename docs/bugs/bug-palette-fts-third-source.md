---
id: bug-palette-fts-third-source
title: 'Palette FTS: add course_step.body_md as third FTS source once table stabilises'
product: study
severity: minor
status: fixed
discovered_pr: 936
discovered_date: 2026-05-13
fix_pr: 988
fix_wp: command-palette
tags:
  - palette
  - search
  - phase-3.5
  - scope-deviation
---

# Palette FTS: add `course_step.body_md` as third FTS source once table stabilises

## Context

Phase 3.5 PR C (PR #936) shipped the phrase-FTS loader in `libs/help/src/loaders/fts-passages.ts`. The original brief listed **three** source tables to query:

1. `study.reference_section.content_md` -- shipped ✓
2. `study.knowledge_node.content_md` -- shipped ✓
3. `study.lesson.body` -- **not shipped**

## What happened

The `study.lesson` table does not exist. The closest analogue is `study.course_step.body_md`, currently in flight under the `course-tree-arbitrary-depth` work package (Phase A merged at #934, Phase B at #935, more phases pending). The agent deferred this source with an inline TODO rather than land against an unstable schema.

## Impact

When a user types an I-3 phrase query (`"dusk vs sunset"`, `pilot rest before night flying`), passage results return from references and knowledge nodes but NOT from authored lesson bodies. The user's own course content is invisible to phrase search.

Low severity because:

- The two shipped sources cover the bulk of relevant content (handbook chapters, CFR sections, AIM sections, AC sections, knowledge nodes).
- Authored lesson bodies typically reference / cite the underlying references the FTS already covers.

## Fix

Once `course-tree-arbitrary-depth` stabilises (`course_step.body_md` field shape locked, FTS-suitable text content guaranteed), add a third parallel query to `loadFtsPassages` mirroring the existing two:

- JOIN `course_step` to its parent course / cert path for `result.href` resolution
- Map to a new `SearchResultType` -- likely `airboss.lesson` (already reserved in the taxonomy union) or `airboss.course-step` if we prefer the literal name
- Populate `passageHighlight` via the same `ts_headline` pattern
- Re-rank globally across all three sources

Verify by typing a phrase that's known to appear in a course step body but NOT in any handbook / KB node, and confirm the course step lands in `PalettePassageView`.

## Related

- PR #936 -- the FTS loader (scope-deviated here)
- PR #934 / #935 -- course-tree-arbitrary-depth (the upstream blocker)
- Work package: [command-palette](../work-packages/command-palette/spec.md)

## Resolution

`libs/help/src/loaders/fts-passages.ts` now queries `study.course_step.body_md`
joined to `study.course` as a third parallel FTS source, mirroring the existing
`reference_section` + `knowledge_node` queries. Course-step hits map to
`SearchResultType: 'airboss.lesson'`, build their `href` via
`ROUTES.COURSE_STEP(slug, code)`, and cluster on `course_id` so future
course-root + step collapse bonds correctly. Archived courses are excluded;
rows with empty `body_md` are filtered out at the SQL level. The integration
test now seeds a course + section-level course_step and asserts the loader
returns the row with `<mark>` highlight markup, correct href, and correct
clusterKey.
