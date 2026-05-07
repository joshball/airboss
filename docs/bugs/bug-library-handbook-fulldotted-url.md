---
id: bug-library-handbook-fulldotted-url
title: /library/handbook/afh/1/1.1 hand-typed URL is invalid by URL contract
product: study
severity: nit
status: open
discovered_pr: null
discovered_date: 2026-05-04
fix_pr: null
fix_wp: null
repro: |
  Hand-type /library/handbook/afh/1/1.1 in the address bar -- 404. The
  link generator at /lens/handbook/afh/1 has been fixed, but the literal
  full-dotted URL is still invalid by the URL contract. No internal link
  emits this shape.
tags: [library, handbook, urls]
---

# /library/handbook/afh/1/1.1 hand-typed URL is invalid by URL contract

Hand-typed `/library/handbook/afh/1/1.1` returns 404. The link generator
at `/lens/handbook/afh/1` has been corrected, but the literal full-dotted
URL is still invalid by the URL contract. No link in the codebase emits
this shape, so this only bites users who construct the URL by hand.

## Investigation notes

- Surfaced in the multi-agent cleanup aggregate (2026-05-04) at
  `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` section 4.
- Fix is local to the section loader: accept the full-dotted form as an
  alias and normalize to the canonical chapter/section shape before the
  DB lookup.
- nit severity because no link in the codebase emits this URL shape; it
  is a guarded-typing affordance, not a broken-link bug.

## Cross-references

- The same loader is used for AFH and AFM-handbook variants; whichever
  fix lands should cover both.
