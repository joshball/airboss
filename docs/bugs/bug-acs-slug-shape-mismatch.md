---
id: bug-acs-slug-shape-mismatch
title: ACS slug-shape disagreement causes citation chips to 404
product: study
severity: major
status: open
discovered_pr: null
discovered_date: 2026-05-04
fix_pr: null
fix_wp: null
repro: |
  ACS_PUBLICATION_SLUGS ships `ir-airplane-8c` but
  study.reference.document_slug stores `ir-airplane-acs-8c`.
  URL builder + route disagree, so /acs/<slug>/... 404s.
tags: [citations, acs, references]
---

# ACS slug-shape disagreement causes citation chips to 404

The ACS publication catalog (`ACS_PUBLICATION_SLUGS`) ships slugs like
`ir-airplane-8c`, but the `study.reference.document_slug` column stores
`ir-airplane-acs-8c`. The URL builder uses the catalog form, the route
loader keys off the DB form, so ACS citation chips currently 404.

## Investigation notes

- Surfaced in the multi-agent cleanup aggregate (2026-05-04) at
  `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` section 4.
- Two reasonable fixes: (a) drop `-acs-` from the DB column to match the
  catalog, or (b) add `-acs-` to the catalog. (a) is the smaller diff but
  needs a data-migration script.
- Whichever direction lands, regenerate the ACS pages in the
  representative-pages e2e spec.

## Cross-references

- Sibling bug: `bug-ac-url-helper-drift` (AC URLs, same symptom -- citation
  chips 404 -- but unrelated root cause).
