---
title: 'Plan: monthly source-corpus drift check'
type: plan
status: proposed
created: 2026-05-17
---

## Why

The FAA source corpus (CFR, AIM, ACs, handbooks) is fetched into a developer-local cache by `bun run sources download`. The downloader is idempotent -- it HEAD-checks each URL and skips files whose bytes have not changed (see `scripts/sources/download/freshness.ts`). But nothing runs it on a schedule, and nothing tells the developer when an upstream document has a newer revision.

Two concrete failure modes this plan closes:

1. **Silent staleness.** A handbook or AC gets a new edition upstream (FAA-H-8083-28B -> 28C, AC 61-65J -> 61-65K). The cache keeps serving the old bytes until someone manually re-runs `sources download`. The 25 weather-product reference pages cite specific section numbers -- a new edition can renumber them (this already happened: the AIM renumbered its Chapter 7 paragraphs, caught only by the manual Tier-3 citation verification in PR #1020).
2. **No "what changed" report.** `sources download` prints "N files, M skipped" but does not surface *which* documents have a newer revision available. A developer has no at-a-glance answer to "is anything out of date?"

This is small infrastructure -- a scheduled job plus a report mode. Not a work package (no user-facing feature, no user stories). A plan is the right weight.

## What exists already (do not rebuild)

- `bun run sources download` -- idempotent corpus fetch. HEAD-checks etag / last-modified / content-length.
- `scripts/sources/download/freshness.ts` -- the freshness decision tree (no manifest / size mismatch / etag match / etc.). This is the drift-detection primitive; the report mode reads its verdicts.
- `bun run sources discover-errata` -- scrapes FAA landing pages for newly-published revisions / errata sheets. (Its landing-page URLs are being repaired in a separate fix-PR.)
- `bun run sources verify-urls` -- HEAD-checks every catalogued URL.
- `scripts/scheduler/` -- launchd-driven local scheduler, installed by the `scheduled-jobs` skill.
- `scripts/scheduled-jobs/` -- existing jobs: `cert-goals-drop-trigger-watch`, `citation-audit`, `now-md-drift`. The new job follows this exact pattern.

The pieces exist. This plan wires them into a monthly cadence plus a reporting surface.

## Scope

Three steps. Each is a small PR.

### Step 1 -- `bun run sources report`

A new subcommand on the `sources` dispatcher (`scripts/sources.ts`) that does NOT download. It:

- Walks every catalogued document (AC, AIM, handbooks, CFR -- the same catalogue `download` uses).
- For each, runs the existing `freshness.ts` check (HEAD only -- no body fetch).
- Also folds in `discover-errata`'s findings (newly-published revisions the scraper detected).
- Prints a summary table: per document -- `fresh` / `newer revision available` / `errata published` / `HEAD failed`.
- Exits 0 always (it is a report, not a gate). A `--strict` flag may exit non-zero when anything is non-fresh, for use by the scheduled job's alerting.

Follow the existing dispatcher help-block pattern (`what` / `why` / `how` / `links`) used by every other `sources` subcommand.

### Step 2 -- monthly scheduled job

Author `scripts/scheduled-jobs/source-corpus-drift/` following the shape of the existing `now-md-drift` and `citation-audit` jobs. The job:

- Runs `bun run sources report --strict` once a month.
- On drift detected, writes its findings somewhere durable (a dated file under `docs/work/`, the pattern the other jobs use) and surfaces a notification per the `scheduled-jobs` skill's notification mechanism.
- Does NOT auto-download. Detecting drift and *deciding* to update are separate -- a new FAA edition can renumber sections (see "Why" above), so an update is a reviewed change, never silent. The job reports; a human runs `sources download` + the citation re-verification.

Register it via `bun run schedule install`. Monthly cadence (the FAA publishes on no fixed schedule; monthly is frequent enough to catch a new edition within weeks, infrequent enough to be quiet).

### Step 3 -- hangar surface (optional, separate follow-up)

Surface the drift report inside the hangar app as a review-queue item ("AC 61-65 has revision K upstream; cache has J"). Hangar already has the job-queue infra (`libs/hangar-jobs/`) and a `/roadmap`-style surface. This is the most user-visible piece but also the heaviest, and it depends on Steps 1-2 existing first.

**Decision for Step 3:** defer. Steps 1-2 deliver the value (a developer runs `sources report`, or the monthly job notifies them). The hangar surface is polish -- build it only once a content author other than the developer needs the signal. Recorded as a deferred follow-up, not dropped.

## Sequencing

Step 1 -> Step 2 (the job calls the report command, so the command must exist first). Step 3 deferred. Steps 1 and 2 are small enough to be one PR each, or even one combined PR if the job is thin.

## Anti-scope

- No auto-download / auto-update. Drift detection and the decision to update stay separate, by design.
- No new database tables. The report is a transient CLI artifact + a dated file under `docs/work/`.
- No change to `freshness.ts` or `discover-errata` logic -- the report consumes them as-is.
- Step 3 (hangar surface) is out of scope for this plan's first cut; deferred with the trigger above.

## Verification

- `bun run sources report` runs clean and prints the table; `--strict` exits non-zero when something is stale.
- The scheduled job installs via `bun run schedule install` and appears in `bun run schedule list`.
- `bun run check` clean.
