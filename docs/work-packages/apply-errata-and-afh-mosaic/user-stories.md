---
title: 'User Stories: Apply Errata and AFH MOSAIC'
product: study
feature: apply-errata-and-afh-mosaic
type: user-stories
status: unread
---

# User Stories: Apply Errata and AFH MOSAIC

## Reading post-errata content

- As a learner studying for a checkride, I want to read the FAA's most recent published text for any handbook section, so I am not preparing on stale rules.
- As a learner reading AFH Chapter 2, I want sport-pilot LSA information to reflect MOSAIC, so my understanding matches what an examiner will test.
- As a learner who studied a section before MOSAIC, I want a visible signal that the section has been amended since I last read it, so I know to re-read instead of relying on memory.

## Understanding what changed

- As a learner who clicks the amendment badge, I want to see the original text and the replacement text side-by-side, so I can compare what the FAA said before and what it says now.
- As a learner reading an entirely-new subsection (e.g., "Light-sport Category Aircraft Maintenance"), I want it framed clearly as added content, so I do not assume it was always there.
- As a learner who wants the canonical source, I want the source URL on every amendment entry, so I can read the FAA's exact addendum PDF.

## Trusting the platform

- As a learner who picks airboss for citation correctness, I want the platform to apply published errata to the section text, so I never read text that disagrees with the current FAA bound + addenda.
- As a learner whose CFI insists they "cite the FAA's exact words," I want the platform to live up to that promise by applying every published errata correction.

## Maintaining the platform (developer perspective)

- As a developer, I want a `bun run sources discover-errata` command that surfaces newly-published FAA errata, so I do not have to manually monitor handbook pages.
- As a developer, I want the discovery to run automatically (server startup, weekly cron, on-download piggyback), so I do not have to remember to run it.
- As a developer, I want a GitHub issue auto-opened when new candidates are detected, so the work surfaces in my normal triage flow.
- As a developer, I want the discovery to surface candidates for handbooks we do not yet ingest, so I have signal for when to onboard a new handbook.
- As a developer applying an erratum, I want a single command (`bun run sources extract handbooks <doc> --apply-errata <id>`) that downloads, parses, applies, and updates the DB transactionally, so I do not assemble the steps myself.
- As a developer, I want `--reapply-errata` to be idempotent and ordered, so I can re-run after a parser change without manually undoing anything.
- As a developer, I want errata application to be reviewable as a normal PR (regenerated section markdown + per-section errata notes + manifest update + DB migration if any), so the audit trail lives in git.

## Adding a new handbook (developer perspective)

- As a developer onboarding a new handbook, I want to add one file in `tools/handbook-ingest/ingest/handbooks/<slug>.py`, register it, and write a YAML config, so the engine adopts the book without modification.
- As a developer onboarding a new errata layout, I want to add one file in `tools/handbook-ingest/ingest/errata_parsers/<layout>.py`, write unit tests against fixture PDFs, and reference the parser by name from any handbook's YAML, so layout knowledge is shared across handbooks.

## Reviewing discovery results (developer perspective)

- As a developer triaging discovery output, I want each candidate to indicate whether it is `actionable` (handbook is ingested) or `signal-only` (handbook is not), so I can prioritize.
- As a developer dismissing a candidate (false positive, duplicate), I want a one-line YAML edit to record the dismissal, so the discovery does not re-surface it next week.
- As a developer reading the discovery report, I want the manual DRS search URL included for each handbook, so I can sanity-check the parent-page scrape against the FAA's authoritative portal.

## Trust and safety

- As a learner, I want errata to never silently corrupt section content. Application is logged; if the parser misreads a layout, the apply fails loudly rather than writing wrong text. ("Loud failure over silent corruption.")
- As a developer, I want auto-apply gated on parser maturity (≥3 distinct addendum layouts proven), so I do not ship a flow that could quietly miswrite the FAA's text.

## Future surface (deferred)

- As a learner, I want to see "X sections you have read have been amended since you read them" on my dashboard, so I can re-review them. (Not in v1; data model supports it.)
- As a content author in the hangar, I want a UI to triage discovery candidates, apply errata, and review the resulting diff before commit, so the CLI is a fallback rather than the primary surface. (The hangar app does not yet exist; this WP's CLI is structured to be wrappable.)
- As a learner reading an old erratum entry, I want to expand the diff to see the *full prior section* (not just the patched paragraph) for context. (Future work; storage supports the original_text but the UI currently only shows the patched paragraph.)
