---
title: 'User Stories: Reference versioning tooling'
product: cross-cutting
feature: reference-versioning-tooling
type: user-stories
status: unread
review_status: pending
---

# User Stories: Reference versioning tooling

## Personas

- **Operator (Joshua).** Runs the annual eCFR rollover. Has merge rights on the airboss repo. Reads the diff report, decides what to advance, opens the PR.
- **Lesson author (CFI / SME).** Writes lessons with `airboss-ref:` URLs. Cares that the validator stays clean across editions; not directly involved in running the diff job.

## Stories

### S1. Operator runs the annual rollover

> As the operator, when the eCFR republishes Title 14 in January, I want to ingest the new edition and run a single command to discover which sections changed, so I can advance lesson pins for unchanged sections automatically and review only the deltas.

Acceptance:

- After running Phase 3's `cfr-ingest --edition=YYYY-01-01`, both the prior and current editions exist in the registry.
- `bun run airboss-ref diff` writes a JSON report and prints a summary in under 10s.
- The summary lists `auto-advance` count, `needs-review` count, and the top-10 needs-review entries with one-line snippets so I can prioritize.
- The full report is at a known path I can grep / inspect without re-running the job.

### S2. Operator advances unchanged-section pins

> As the operator, after reviewing the diff report, I want to apply the auto-advance subset to lesson markdown so unchanged-section pins move forward without manual edits, and I can focus my review effort on the actual deltas.

Acceptance:

- `bun run airboss-ref advance --report=<path>` rewrites lesson pins for `auto-advance` candidates.
- Files I didn't intend to modify (lessons pinned to other editions, lessons in unrelated content trees) are untouched.
- `git diff` is reviewable -- one URL change per occurrence, no formatting churn.
- I can run the command twice with no further changes (idempotent).
- I can stage and commit the result on the rollover branch and open the PR myself.

### S3. Operator reads the needs-review report

> As the operator, when a section's text changed between editions, I want a structured record of every changed section with a diff snippet, so I can hand the file to a lesson author for triage.

Acceptance:

- The JSON report's `outcomes` array carries a `diffSnippet` for every `needs-review` entry.
- The snippet is a unified-diff fragment showing the change in context.
- The author can read the report (or a per-entry view I generate from it) without re-running the diff job.

### S4. Lesson author keeps the validator clean

> As a lesson author, when I update a pin from `?at=2026` to `?at=2027` because the diff job said it was safe, I want the validator to keep passing without my needing to know about the diff job at all.

Acceptance:

- After the operator runs `advance`, my lesson's pin is `?at=<current accepted>`.
- `bun run check` is clean -- no row-6 WARNING, no row-2 ERROR.
- The lesson's prose still renders correctly via the renderer (Phase 4) -- canonical_short, canonical_title, etc. all reflect the new edition's content.

### S5. Operator handles a renumbering edition

> As the operator, when the eCFR renumbers a section (e.g. `§91.103` becomes `§91.103a`), I want the diff job to flag the renumbering with the alias kind, so I can decide whether to silent-advance, content-change-review, or manually re-pin.

Acceptance:

- Sections with `silent` aliases auto-advance to the new ID.
- Sections with `content-change` aliases are flagged as needs-review and the report shows the new ID.
- Sections with `cross-section` aliases are flagged as needs-review with a prominent "do NOT auto-advance" note; the rewriter never advances them.
- Sections with `split` / `merge` aliases are flagged as needs-review with the merge target(s) listed.

### S6. Operator runs against a fixture pair (test ergonomics)

> As an operator validating a change to the diff job itself, I want to run the CLI against fixture XML pairs without ingesting them into the on-disk registry, so I can iterate on the tooling without contaminating the real registry.

Acceptance:

- `bun run airboss-ref diff --fixture-pair=<oldXml>,<newXml>` ingests both fixtures into a fresh in-memory registry, runs the diff, and writes the report.
- The on-disk registry (under `regulations/`) is untouched.
- Any operator can clone the repo and run the smoke command without touching the cache directory.

### S7. Operator runs `advance` against a dirty tree (failure path)

> As the operator, when I forget to commit my work-in-progress before running `advance`, I want the command to refuse rather than mix unrelated edits into the rollover commit.

Acceptance:

- `bun run airboss-ref advance --report=<path>` with non-empty `git status --porcelain` exits with code 2 and a clear stderr message naming the dirty state.
- No file is rewritten.
