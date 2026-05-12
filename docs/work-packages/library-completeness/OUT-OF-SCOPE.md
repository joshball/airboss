---
title: 'Out of Scope: Library Completeness'
product: study
feature: library-completeness
type: out-of-scope
status: unread
---

# Out of Scope: Library Completeness

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

The source [spec.md](./spec.md) is a discussion document, not a standard
work-package spec. The deferred items below were extracted from the
2026-05-01 ratifications block (§"Ratifications (2026-05-01)"), the
recommended-sequence list (§"Recommended sequence"), and the inline
"deferred" decisions in §"Smells worth fixing along the way." Only
concrete decisions with named triggers are captured here; the open
questions, smells without triggers, and one-line speculative ideas
remain in the discussion narrative.

## Summary

| Item                                                                        | Status       | Trigger to revisit                                                                                 |
| --------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| FAA Order 8900.1 Vol 5 ingestion (WP-O8900-V5)                              | Deferred     | When CFI training content benefits from Vol 5                                                      |
| `handbooks-noningested.yaml` cleanup                                        | Deferred     | When `migrate-references-to-structured.ts` has zero consumers, OR after knowledge-node re-pointing |
| AC catalog ingestion gaps 3+4 from broad survey                             | Deferred     | When the in-place AC corpus is next refreshed (separate prior fix to WP-AC-V)                      |
| "Other publications" cohort (AOPA ASI, Order 8260-3, etc.)                  | Rejected     | Never -- umbrella link-only cards by ratification 2.C                                              |
| "Other interesting" candidates dropped (GA-JSC, Part 67, CAP/WINGS, plates) | Rejected     | Never -- ratification 5 dropped or deferred-without-trigger; revisit only on new ask               |
| Library page card-state indicator UX WP                                     | Follow-on WP | When the substrate-honest library page surfaces user confusion between Read / Browse / External    |

## FAA Order 8900.1 Vol 5 ingestion (WP-O8900-V5)

Status: Deferred

What was deferred:
Ingestion of FAA Order 8900.1 Volume 5 (Airman Certification) as a
new corpus. ADR 019 §1.2 already provisions the URI form
(`airboss-ref:orders/faa/8900-1/vol-5/ch-1`); the source URL
(`https://drs.faa.gov/browse/excelExternalWindow/8900.1`) was verified
HTTP 200 on 2026-04-30. The pipeline shape is a per-volume per-chapter
PDF tree, analogous to the handbook pipeline. Sequence position 11 in
the recommended sequence.

Why:
Per §4.E and ratification 4.E: 8900.1 is enormous (~10,000+ pages)
and most of it is air-carrier inspector guidance, not pilot-facing.
A Vol 5 carve-out (Airman Certification) is the only volume that
touches flight instruction directly; the rest stays out of scope.
Even Vol 5 doesn't earn ingestion cost without a downstream content
need.

Trigger to revisit:
Per ratification 4.E: "we ship CFI training content that benefits
from Vol 5." The signal is a CFI-track WP (FIRC content, CFI
endorsement coverage, examiner-prep material) that would cite Vol 5
sections inline. Until that ship-ready content exists, the Vol 5
corpus is dead weight.

Implementation pattern when triggered:
Author `scripts/sources/config/orders/8900-1.yaml` analogous to the
handbook configs. Use the chapter-source-ingestion pattern from
ADR 022 with `outline_strategy: content` and `section_strategy: toc`.
Citation URI is `airboss-ref:orders/faa/8900-1/vol-5/ch-<N>`.

References:

- [spec.md](./spec.md) §4.E (Pipeline recommendation: deferred)
- [spec.md](./spec.md) §"Ratifications (2026-05-01)" row 4.E
- [spec.md](./spec.md) §"Recommended sequence" item 11
- [ADR 019](../../decisions/019-reference-identifier-system/decision.md) §1.2

## `handbooks-noningested.yaml` cleanup

Status: Deferred

What was deferred:
Deleting the four redundant rows in
`course/references/handbooks-noningested.yaml` (aih, ifh, iph,
risk-mgmt) now that the WP-SUB two-shape seeder lands the same
content from the handbooks-extras whole-doc manifests; and retiring
the `scripts/db/migrate-references-to-structured.ts` bridge that
hardcodes the noningested slug+edition pairs.

Why:
Per the §"Smells worth fixing along the way" #1 audit on 2026-05-02:
the slug + edition pairs in `handbooks-noningested.yaml` do not
match cleanly to the handbooks-extras pairs. Different
`(slug, edition)` pairs land as different `reference` rows. The
migrator at `scripts/db/migrate-references-to-structured.ts:139-148`
hardcodes the noningested pairs for citation -> authored-row
matching. Deleting the YAML rows now would make those lookups upsert
synthetic rows -- the exact failure mode the YAML's own comment
documents. Knowledge-node `source` strings still reference the
legacy slugs.

Trigger to revisit:
Per the §"Smells" #1 audit: "the migrator's last consumer is gone
(verify via `bun scripts/db/migrate-references-to-structured.ts
--dry-run` showing zero rows touched), OR a content audit re-points
knowledge-node `source` strings to the new slugs."

Implementation pattern when triggered:
Retire the migrator script first (it's a documented one-shot), then
delete the four redundant YAML rows, then cross-update any
remaining knowledge nodes whose `source` strings still reference
the legacy slugs. Leave the `afh` 3B-prior-edition row until that
content is audited and re-pointed at 3C.

References:

- [spec.md](./spec.md) §"Smells worth fixing along the way" item 1
- [spec.md](./spec.md) §"Audit 2026-05-02 (Phase G smell #1 review)"
- `scripts/db/migrate-references-to-structured.ts:139-148`

## AC catalog ingestion gaps 3+4 from broad survey

Status: Deferred

What was deferred:
Resolving "gaps 3+4" from the broad-extraction survey on the AC
corpus before running WP-AC-V (sequence item #5). Gaps 3+4 refer
to AC extraction issues where 9 of 12 cached ACs produced `doc.md`
derivatives but 3 did not.

Why:
Per §"Recommended sequence" item 5: WP-AC-V seeds the 9
already-extracted ACs. The 3 ingestion-gap ACs are blocked on a
separate prior fix that has its own root cause (per the
broad-extraction survey). Including the gap fix in WP-AC-V would
expand its scope and conflate the seed step (mechanical) with the
extractor fix (debugging).

Trigger to revisit:
When the in-place AC corpus is next refreshed -- either because the
broad-survey gap-3/4 root cause is being fixed for unrelated
reasons, or because content authoring needs the missing 3 ACs. The
trigger is concrete: it's the next PR that opens
`scripts/sources/config/ac/` for any reason.

Implementation pattern when triggered:
Re-run the AC extractor with the gap-3/4 root cause fixed, verify
all 12 cached ACs produce `doc.md` derivatives, then run the WP-AC-V
seed for all 12 instead of 9. The AC pipeline shape is unchanged.

References:

- [spec.md](./spec.md) §"Recommended sequence" item 5 (WP-AC-V)
- [spec.md](./spec.md) §"Corpus catalog" AC row ("12 cached / 17 YAML")

## "Other publications" cohort (AOPA ASI, Order 8260-3, etc.)

Status: Rejected

What was rejected:
Promoting the 8 "Other publications" reference rows (AOPA ASI,
FAA Order 8260-3, Jeppesen plates, generic ACS/PTS, etc.) from
link-only umbrella cards to ingested corpora.

Why:
Per ratification 2.C: "Other publications stay link-only umbrella
cards. Order 8260-3 noted as watch-list, no commitment." These rows
are heterogeneous (AOPA-owned content, Jeppesen-owned plates,
historical orders, generic ACS/PTS) with no shared ingestion
pipeline shape and varying access rights. The decision was to keep
them link-only and surface them on `/library` as umbrella cards
that link out to the publisher.

Re-decision bar:
Order 8260-3 is on a watch-list -- if a downstream product needs
its content, it would re-decide for that single doc, not for the
"Other publications" cohort as a whole. Any non-watch-list row
would need a product-level justification to overturn ratification
2.C.

References:

- [spec.md](./spec.md) §"Ratifications (2026-05-01)" row 2.C
- [spec.md](./spec.md) §"Corpus catalog" "Other publications (8)" row

## "Other interesting" candidates dropped (GA-JSC, Part 67, CAP/WINGS, plates)

Status: Rejected

What was rejected:
The §5 "Other interesting" candidates as standalone corpus WPs.
Specifically: GA Joint Steering Committee safety bulletins, 14 CFR
Part 67 medical certification (as a standalone surfacing beyond
the CFR-14 seed), CAP-coordinated content (WINGS program docs), and
FAA-approved approach plates / sectionals (Jeppesen / FAA).

Why:
Per ratification 5: "Other candidates (GA-JSC, Part 67, CAP/WINGS,
plates) dropped or deferred." Only Safety Briefing magazine was
opted in (sequence item #12). The rest were surfaced as an explicit
menu so the user could pick rather than defer forever; the answer
was "no." 14 CFR Part 67 surfaces automatically once CFR-14 is
seeded via WP-CFR-V (sequence item #4); no separate WP needed.

Re-decision bar:
Each candidate would need a fresh product-level ask to re-open. The
ratification is explicit; do not surface these as deferred items
in a future review pass.

References:

- [spec.md](./spec.md) §5 ("Other interesting" candidates)
- [spec.md](./spec.md) §"Ratifications (2026-05-01)" row 5

## Library page card-state indicator UX WP

Status: Follow-on WP

What was deferred to a follow-on WP:
A small UX work package that adds a card-state indicator to the
`/library` page distinguishing "Read in-app" / "Browse" / "External
link only" affordances on each reference card. Today the loader sets
`isReadable=true|false` but the card visuals don't surface the
distinction between an umbrella card (POH, NTSB umbrella) and a real
ingested card.

Why:
Per §"Smells worth fixing along the way" item 5 and the §"Open
questions" first bullet: "Library page conflates 'ingested +
readable' with 'umbrella + link-only.'" Risk: users tap the umbrella
POH card expecting content, get bounced to the FAA. The fix is a
small UX pass, not a substrate change; it belongs in its own WP
after the substrate is honest (WP-SUB shipped 2026-05-01) and the
remaining corpus WPs surface user-facing card variety.

Trigger to spawn:
When the substrate-honest library page surfaces user confusion
between Read / Browse / External -- in practice, after the
remaining §6 corpus WPs land enough non-handbook content to make
the umbrella-vs-ingested distinction visible on the page.

Implementation pattern when spawned:
A small UX-only WP that adds a card-state badge or icon to the
library card component and surfaces the state via the loader
output. The substrate already supports the distinction (`isReadable`
is the readable signal); the WP is purely presentational.

References:

- [spec.md](./spec.md) §"Smells worth fixing along the way" item 5
- [spec.md](./spec.md) §"Open questions" first bullet
