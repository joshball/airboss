---
title: 'Out of Scope: Extract provenance + per-section signoff'
product: platform
feature: extract-provenance-and-signoff
type: out-of-scope
status: unread
---

# Out of Scope: Extract provenance + per-section signoff

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                               | Status       | Trigger to revisit                                                                   |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Re-extracting the existing corpora | Rejected     | Never -- see detail below                                                            |
| Auto-signoff via LLM               | Follow-on WP | When operator signoff bandwidth becomes the bottleneck for library expansion         |
| Sub-section / paragraph signoff    | Deferred     | When section-granularity signoff misses a real corruption that paragraph would catch |
| Cross-edition signoff inheritance  | Rejected     | Never -- see detail below                                                            |

## Re-extracting the existing corpora

Status: Rejected

What was rejected:
A re-extraction pass over the committed derivative tree (handbooks, regulations, AC, ACS, AIM)
to populate provenance frontmatter and sidecars.

Why:
Per spec §Out of Scope: "The provenance schema can backfill from current manifests + recompute
`body_sha256` per file; no re-extract needed." Backfilling from existing manifests is cheaper
and safer than a fresh re-extract (no LLM cost, no risk of new corruption). Re-extracting
defeats the purpose of provenance -- the existing committed content IS the source-of-truth for
"what was extracted at signoff time."

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §Why this WP exists](./spec.md) -- the AFH MOSAIC double-apply case is the cautionary tale

## Auto-signoff via LLM

Status: Follow-on WP

What was deferred:
LLM-assisted spot-checking that auto-signs off sections after comparing extracted markdown
against the source PDF. Would let signoff scale without operator bandwidth.

Why:
Per spec §Out of Scope: "The signoff workflow is human-in-the-loop. LLM-assisted spot-checking
could be a follow-up WP." Signoff is a trust anchor; the v1 contract demands a human in the
loop. LLM-assisted review changes the trust model and needs its own WP to spec the acceptance
criteria (false-positive rate, false-negative rate, what "verified by LLM" means in the audit
trail).

Trigger to revisit:
When operator signoff bandwidth becomes the bottleneck for library expansion. Concrete signal:
a new corpus lands, the auto-extracted queue grows past what one operator can review in a
reasonable cadence (e.g. >500 sections backlogged for >2 weeks).

Implementation pattern when triggered:
Mirror the WP-spec template at `docs/work-packages/extract-provenance-and-signoff/spec.md`.
Spec: a new signoff state `llm-spot-checked` that lives alongside `spot-checked` / `verified`,
with its own provenance field naming the model + prompt version. The hangar admin queue
surfaces LLM-checked items for human confirmation.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §3. Per-section signoff state](./spec.md)

## Sub-section / paragraph signoff

Status: Deferred

What was deferred:
Signoff at the sub-section or paragraph granularity (e.g. signing off paragraphs 7-1-1, 7-1-2
independently). Today, signoff is per-section file.

Why:
Per spec §Out of Scope: "Section is the unit; sub-section signoff is overkill until proven
necessary." The AFH MOSAIC double-apply case happened at the section file level (entire
sections were duplicated); section-level signoff catches it. Paragraph-level signoff multiplies
the audit surface by ~10x without a known failure mode it would prevent.

Trigger to revisit:
When section-granularity signoff misses a real corruption case that paragraph-level would
have caught. Concrete signal: a known issue (e.g. an errata applies to one paragraph but the
operator signed off on the whole section before the errata, and the apply downgrades the
entire section's state instead of just the affected paragraph).

Implementation pattern when triggered:
Mirror the section signoff sidecar shape at `<section>.signoff.json`. Add a
`paragraphs[].signoff` map keyed by paragraph ID (`7-1-1`, `7-1-2`). The verify-derivatives
command grows a per-paragraph diff path.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §3. Per-section signoff state](./spec.md)

## Cross-edition signoff inheritance

Status: Rejected

What was rejected:
Carrying signoff state from edition X forward to edition X+1 when the FAA cuts a new edition
of a handbook. E.g. preserving the operator's signoff on PHAK 25C sections into PHAK 25D.

Why:
Per spec §Out of Scope: "When edition X+1 lands, signoff from X does NOT carry forward;
everything starts at `auto-extracted`. This is correct (different content, different
verification)." Different bytes = different content; the operator must re-verify. Inheriting
signoff would silently mark unverified content as verified, defeating the trust anchor.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md)
