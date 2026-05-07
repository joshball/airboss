---
id: bug-ac-url-helper-drift
title: AC URL helper produces stray dot in path
product: study
severity: major
status: open
discovered_pr: 636
discovered_date: 2026-05-04
fix_pr: null
fix_wp: null
repro: |
  urlForReference('airboss-ref:ac/91-21-1/d/section-1') -> /ac/91-21.1/d/1
tags: [citations, references]
---

# AC URL helper produces stray dot in path

`libs/sources/src/url-for-reference.ts:urlForAc` synthesizes the AC document
slug into the path with a stray dot, so AC citation chips currently 404.

Repro: `urlForReference('airboss-ref:ac/91-21-1/d/section-1')` returns
`/ac/91-21.1/d/1` instead of the expected URL contract shape.

## Investigation notes

- Surfaced in the multi-agent cleanup aggregate (2026-05-04) at
  `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` section 4.
- The representative-pages e2e spec does not generate AC tests because of
  this drift; whichever fix lands here should add an AC row to that spec.
- Likely a single-line normalization issue in `urlForAc`. Compare against
  the handbook helper, which has been updated to handle dotted slugs.

## Cross-references

- See also `bug-acs-slug-shape-mismatch` for the parallel ACS issue
  (different root cause: that one is a slug-shape disagreement between the
  publication catalog and the DB column).
