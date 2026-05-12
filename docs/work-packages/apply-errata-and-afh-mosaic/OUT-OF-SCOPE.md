---
title: 'Out of Scope: Apply Errata and AFH MOSAIC'
product: study
feature: apply-errata-and-afh-mosaic
type: out-of-scope
status: unread
---

# Out of Scope: Apply Errata and AFH MOSAIC

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                              | Status       | Trigger to revisit                                                                              |
| ------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| CFR / AC / ACS / AIM amendment handling           | Follow-on WP | When a non-handbook FAA corpus needs an amendment lifecycle modelled                            |
| Cross-edition supersession                        | Rejected     | Never -- see detail below                                                                       |
| Auto-apply of newly-discovered errata             | Deferred     | When 3 distinct addendum layouts are proven via unit tests + dry-run zero-diff against human    |
| Retroactive learner notification                  | Deferred     | When more than ~10 learners hit an amended section after first read in a 30-day window          |
| Onboarding the other 14 handbooks for ingestion   | Deferred     | When an `actionable` discovery candidate fires on a non-AFH/PHAK handbook the user wants to use |
| Hangar UI for discovery and apply                 | Follow-on WP | When `apps/hangar/` lands and content-authoring surfaces are prioritised                        |
| DRS portal scraping                               | Rejected     | Never -- see detail below                                                                       |
| Section-level "what changed since last read" UI   | Deferred     | When dashboard surfaces are ready to consume `handbook_section_errata` per-user                 |
| Email notifications for new errata candidates     | Rejected     | Never -- see detail below                                                                       |
| Cross-edition errata (multi-edition single sheet) | Rejected     | Never -- see detail below                                                                       |
| Expanding diff to show full prior section in UI   | Deferred     | When learner feedback shows the patched-paragraph view is insufficient context                  |
| Phase R9 follow-up review (`/ball-review-full`)   | Deferred     | When the WP is reopened for a polish pass after manual walkthrough                              |

## CFR / AC / ACS / AIM amendment handling

Status: Follow-on WP

What was deferred:
A general "FAA corpus amendment lifecycle" capability covering CFR amendments, Advisory Circular revisions, ACS edition changes, and AIM updates. The schema (`study.handbook_section_errata`), parser registry (`tools/handbook-ingest/ingest/errata_parsers/`), and discovery surface (`scripts/sources/discover/`) are handbook-only. Equivalent infrastructure does not exist for non-handbook corpora.

Why:
ADR 020 is explicitly handbook-scoped. The errata model (PDF addendum + per-section patch) is wrong for CFRs (eCFR diff feeds), ACs (full-document supersession), and ACS (per-task code stability). Forcing one model across four different lifecycles would over-couple unrelated change shapes.

Trigger to revisit:
When a non-handbook FAA corpus needs an amendment lifecycle modelled (most likely CFR, given how often Part 91 changes). At that point, run `/ball-wp-spec` for a fresh WP that picks a per-corpus model.

References:

- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) -- "handbook-only" scope statement
- [spec.md](spec.md) Non-goals section
- [tasks.md](tasks.md) Phase R8 ADR 020 amendment

## Cross-edition supersession

Status: Rejected

What was rejected:
Applying an erratum to a handbook edition that is no longer the current ingested edition. The `--apply-errata` CLI refuses this with a clear error per [spec.md](spec.md) Edge cases.

Why:
FAA practice is one-erratum-per-edition. When the FAA publishes a new edition, prior-edition errata are folded in (or made obsolete). Modelling supersession across editions would duplicate the publisher's work and create confusing dual-source-of-truth states. The user can check out an older codebase or accept missing application.

Trigger to revisit:
Never -- unless FAA practice changes and errata begin spanning multiple editions. Re-decision would require evidence of this shift in published practice.

References:

- [spec.md](spec.md) Non-goals section, Edge cases table
- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md)

## Auto-apply of newly-discovered errata

Status: Deferred

What was deferred:
Skipping human review and automatically applying a discovered erratum once the discovery scan finds it. Today every apply requires explicit `--apply-errata <id>` CLI invocation; discovery only writes a candidate to `_pending.md`.

Why:
Loud failure over silent corruption. The parser misreading a layout could silently rewrite section text with wrong content. The cost of one bad auto-apply (incorrect FAA text shown to a learner) is much higher than the cost of a human pressing one CLI command per addendum.

Trigger to revisit:
When 3 distinct addendum layouts are proven via unit tests + dry-run zero-diff against human-applied output. Currently only `additive-paragraph` (AFH MOSAIC) and `bullet-edits` (PHAK MOSAIC) layouts are implemented -- two of three. The third proven layout opens the gate.

Implementation pattern when triggered:
Add an `--auto-apply` flag to `scripts/sources.ts discover-errata` that fires the existing apply pipeline (`tools/handbook-ingest/ingest/cli.py --apply-errata`) per candidate. Gate the flag behind a check that the parser is on a verified-stable list. Mirror the existing idempotency guard in `apply_errata.py`.

References:

- [spec.md](spec.md) Open questions resolved section, item 5
- [spec.md](spec.md) Out of Scope section
- [user-stories.md](user-stories.md) Trust and safety section
- [tasks.md](tasks.md) Phase R5 (additive-paragraph) and Phase R5 PHAK (bullet-edits)

## Retroactive learner notification

Status: Deferred

What was deferred:
A surface that tells a learner "X sections you have read have been amended since you read them" on their dashboard or via a digest. The `handbook_section_errata` data already supports it; only the UI and per-user read-tracking integration is missing.

Why:
The data model is in place but no learner dashboard surface exists today to consume it. Adding the notification surface without a host page is premature; learners would only see it via direct route navigation.

Trigger to revisit:
When more than ~10 learners hit an amended section after first read in a 30-day window. Practically: once a learner dashboard surface (post-study-MVP) exists to host the notification.

Implementation pattern when triggered:
Query `handbook_section_errata.applied_at` against per-user `handbook_section_read.last_read_at` (when that table exists). Surface on the dashboard as a "Recently amended" list with deep links to the section's diff panel (the `AmendmentPanel` component already implements per-section diff display).

References:

- [spec.md](spec.md) Out of Scope section
- [user-stories.md](user-stories.md) Future surface section
- [spec.md](spec.md) Behavior section, "Reader UI: amendment badge + diff panel"

## Onboarding the other 14 handbooks for ingestion

Status: Deferred

What was deferred:
Full ingestion (config YAML + chapter/section markdown + plugin parser overrides) of the 14 FAA aviation handbooks beyond AFH and PHAK. Source-byte coverage (downloading the PDFs into the cache) IS in scope and shipped in Phase R7; parsing them is not.

Why:
Each handbook requires per-book quirks (chapter numbering, page-label formats, figure handling) authored as a plugin under `tools/handbook-ingest/ingest/handbooks/`. The cost of ingesting all 17 before learners actually use them is wasted work; the discovery scan tells us which ones to prioritise.

Trigger to revisit:
When an `actionable` discovery candidate fires on a non-AFH/PHAK handbook the user wants to use. The signal is built-in: `scripts/sources/discover/index.ts` already classifies candidates as `signal-only` (handbook not ingested) and surfaces them in `_pending.md`. When the same handbook surfaces 2+ times the gating decision shifts to "ingest it now."

Implementation pattern when triggered:
Mirror the existing `tools/handbook-ingest/ingest/handbooks/phak.py` plugin. Author a YAML config at `tools/handbook-ingest/ingest/config/<slug>.yaml`. Run `bun run sources extract handbooks <slug>` and iterate until the section index matches the published TOC.

References:

- [spec.md](spec.md) Non-goals section, Source-byte coverage expansion subsection
- [tasks.md](tasks.md) Phase R7 Section 13 (source-byte coverage for all 17 handbooks)

## Hangar UI for discovery and apply

Status: Follow-on WP

What was deferred:
A `apps/hangar/` content-authoring UI that wraps the discovery scan and apply-errata CLI. Authors triage candidates, view diffs, and trigger applies from a browser rather than a terminal.

Why:
`apps/hangar/` does not exist yet per the project memory note "FIRC compliance surface dormant in hangar." Every CLI command in this WP is designed to be wrappable later: each prints structured output and has a `--json` discipline so a future hangar route can call it via dispatcher or HTTP wrapper.

Trigger to revisit:
When `apps/hangar/` lands and content-authoring surfaces are prioritised. The follow-on WP would author the hangar route, not re-author the apply logic.

Implementation pattern when triggered:
Author a new WP via `/ball-wp-spec`. The CLI surfaces in `scripts/sources.ts` and `tools/handbook-ingest/ingest/cli.py` already include the comment `# Future: hangar UI wraps this command via dispatcher.` per Phase R8 Section 19. Mirror the dispatcher pattern in `scripts/track.ts`.

References:

- [spec.md](spec.md) Out of Scope section
- [tasks.md](tasks.md) Phase R8 Section 19
- [user-stories.md](user-stories.md) Future surface section

## DRS portal scraping

Status: Rejected

What was rejected:
Programmatic scraping of the FAA Dynamic Regulatory System (DRS) portal to discover errata. The discovery report includes a manual DRS search link only.

Why:
DRS is JavaScript-heavy, session-stateful, and rate-limited in ways that punish scrapers. The parent-page scrape (one HTML page per handbook) gives 95% of the signal with 5% of the engineering cost. A DRS scraper would be brittle, would break on every portal redesign, and would add ongoing maintenance load disproportionate to the signal gained.

Trigger to revisit:
Never -- unless the FAA shifts errata distribution off the handbook parent pages and onto DRS-only routes. Re-decision would require evidence that the parent-page scrape is missing material errata.

References:

- [spec.md](spec.md) Out of Scope section
- [spec.md](spec.md) Open questions resolved section, item 6

## Section-level "what changed since last read" UI

Status: Deferred

What was deferred:
A per-section badge or banner that tells the learner "this section changed since you last viewed it on YYYY-MM-DD." The `handbook_section_errata.applied_at` plus a per-user `last_read_at` would drive it.

Why:
Per-user `handbook_section_read` tracking does not exist yet. The errata side of the data is shipped; the read-tracking side requires a separate table and write path on every section view.

Trigger to revisit:
When dashboard surfaces are ready to consume `handbook_section_errata` per-user. Likely co-lands with the retroactive learner notification trigger above.

Implementation pattern when triggered:
Add `study.handbook_section_read` with `(user_id, section_id, last_read_at)`. Cross-join with `handbook_section_errata` where `applied_at > last_read_at`. Surface in the `AmendmentPanel` component at `libs/ui/src/handbooks/AmendmentPanel.svelte` as an alternate badge label ("Updated since your last visit").

References:

- [spec.md](spec.md) Out of Scope section
- [spec.md](spec.md) Behavior section, "Reader UI: amendment badge + diff panel"

## Email notifications for new errata candidates

Status: Rejected

What was rejected:
Email digest of "N new errata candidates detected this week" sent to the developer.

Why:
The existing surfaces are sufficient: `_pending.md` cache file + dispatcher banner + auto-opened GitHub issue (when `GH_TOKEN` set). Email adds an additional notification channel with its own deliverability, opt-in, and retention concerns for no incremental signal value.

Trigger to revisit:
Never -- unless the existing channels (cache file, banner, GH issue) prove inadequate (e.g., the user stops opening GitHub issues for weeks at a time). At that point, re-decide rather than add a channel.

References:

- [spec.md](spec.md) Out of Scope section
- [spec.md](spec.md) Open questions resolved section, item 4

## Cross-edition errata (multi-edition single sheet)

Status: Rejected

What was rejected:
Modelling a single erratum that applies to multiple editions of a handbook simultaneously (e.g., AFH 3C and AFH 4A both receiving the same patch).

Why:
FAA practice is one-erratum-per-edition. When a new edition publishes, prior-edition errata are folded into the new edition's source text, not re-issued as a separate sheet against both editions.

Trigger to revisit:
Never -- unless FAA practice changes and a sheet explicitly says "applies to editions X and Y." Re-decision would require evidence of this shift in published practice.

References:

- [spec.md](spec.md) Out of Scope section

## Expanding diff to show full prior section in UI

Status: Deferred

What was deferred:
A reader-side affordance that lets a learner reading an old erratum entry expand the diff to see the *full prior section* (not just the patched paragraph) for context. The storage supports it: `handbook_section_errata.original_text` is populated when `patch_kind` is `replace_paragraph`; the UI currently only shows the patched paragraph in the diff.

Why:
The patched-paragraph view answers the actual learning question for MOSAIC ("what did the FAA add or change?") in the common case. Expanding to full-section context adds UI complexity for an edge use case.

Trigger to revisit:
When learner feedback shows the patched-paragraph view is insufficient context. Practically: once the AmendmentPanel has been in front of learners long enough to surface a "but what was the rest of the section saying?" complaint.

Implementation pattern when triggered:
Extend `libs/ui/src/handbooks/ErrataEntry.svelte` with an "Expand to full section" toggle. The full prior text is reconstructed from the section's pre-errata markdown (preserved at `<edition>/<chapter>/<section>.md` with the patch reversed) or by re-rendering the original FAA source content alongside the diff.

References:

- [user-stories.md](user-stories.md) Future surface section, last bullet
- [spec.md](spec.md) Behavior section, "Reader UI: amendment badge + diff panel"

## Phase R9 follow-up review (`/ball-review-full`)

Status: Deferred

What was deferred:
The full 10-axis `/ball-review-full` pass on the apply-errata branch, plus the fixer run, plus the PR follow-up review documented in Phase R9 of [tasks.md](tasks.md).

Why:
The WP shipped via multiple PRs in sequence (R1-R5 AFH, R5 PHAK, R6, R6.12a, R7, R8). Each PR had its own review at merge time. A consolidated 10-axis review would re-audit work that has already been reviewed in pieces.

Trigger to revisit:
When the WP is reopened for a polish pass after manual walkthrough, or when a related WP (e.g. CFR amendments) reuses this codebase and a fresh review is warranted.

Implementation pattern when triggered:
Run `/ball-review-full` against the consolidated changes since `c5b88500` (the spec-author commit). Apply every finding per the project rule "ALWAYS FIX EVERYTHING from a review."

References:

- [tasks.md](tasks.md) Phase R9 Sections 20-22
- [tasks.md](tasks.md) Phase status section, R9 line
