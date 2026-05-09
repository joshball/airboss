---
id: bug-acs-slug-shape-mismatch
title: ACS slug-shape disagreement causes citation chips to 404
product: study
severity: major
status: fixed
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

## Resolution

Fixed by the ACS canonical-slug rename (2026-05-09). Path (b) won: the
`-acs-` infix is now present in every shape -- `ACS_PUBLICATION_SLUGS`,
the on-disk `acs/<slug>/manifest.json` directory + slug field, the
syllabus `course/syllabi/<slug>/` directory, the credentials YAMLs, the
URL builder, and the DB `study.reference.document_slug` column all share
a single canonical form (`ppl-airplane-acs-6c`, `ir-airplane-acs-8c`,
`cpl-airplane-acs-7b`, `cfi-airplane-acs-25`, `atp-airplane-acs-11a`).
The seed-mapping registry survives only as the authored source of the
canonical FAA `edition` designator (`FAA-S-ACS-6C`, ...) and as a
per-test injection surface. Schema is greenfield (no migrations needed);
reseeding produces the canonical shape end-to-end.

## Investigation notes

- Surfaced in the multi-agent cleanup aggregate (2026-05-04) at
  `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` section 4.
- Two reasonable fixes were considered: (a) drop `-acs-` from the DB
  column, or (b) add `-acs-` to the catalog. (b) was chosen because the
  YAML row + `study.reference.document_slug` column already used the
  `-acs-` form, so it was the smaller-blast-radius rename.

## Cross-references

- Sibling bug: `bug-ac-url-helper-drift` (AC URLs, same symptom -- citation
  chips 404 -- but unrelated root cause).
