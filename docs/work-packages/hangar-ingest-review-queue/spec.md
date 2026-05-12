---
id: hangar-ingest-review-queue
title: 'Spec: Hangar Ingest-Review Queue'
product: hangar
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-08
owner: agent
depends_on:
  - handbook-figure-pairing
unblocks: []
tags:
  - hangar
  - ingest
  - review-queue
legacy_fields:
  feature: hangar-ingest-review-queue
  type: spec
  review_status: pending
---

# Spec: Hangar Ingest-Review Queue

A generic review surface inside `apps/hangar/` for triaging the residual issues left behind by automated ingest pipelines. The first concrete instances are the leftover figure-pairing orphans surfaced by the just-shipped [handbook-figure-pairing](../handbook-figure-pairing/spec.md) pipeline; the design is plugin-shaped so a new ingest pipeline can register its own issue types without touching the queue infrastructure.

## Problem

After [handbook-figure-pairing](../handbook-figure-pairing/spec.md) tightened `figures.py`, the seven-handbook fleet still emits a residual `caption-without-figure` long tail (21 entries, classified `image-extracted-elsewhere` and similar). Today the only triage path is:

1. Read `handbooks/<slug>/<edition>/warnings.json` directly, or
2. Run `tools/handbook-ingest/bin/orphan_report.py` for a markdown table.

There is no surface for **acting** on a finding. To pair a stranded caption with the right image, an author has to:

- Open the source PDF in an external viewer.
- Eyeball the candidate images on neighboring pages.
- Hand-edit pipeline source to push a fix, then re-extract.

That loop is wrong-shaped for a content-authoring task. The fix lives outside the heuristic; it is a per-figure manual decision the pipeline can never make. The figure-pairing WP itself flagged this in its [Design alternatives](../handbook-figure-pairing/spec.md#manual-override-sidecar-files) -- "Reserved as an option for the residual long-tail." This WP delivers that option, generalised.

## Why it belongs in hangar

`apps/hangar/` is the content-authoring and admin surface (per [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)). The audience for ingest-review is the same as the audience for `/sources/` and `/glossary/`: the content authority maintaining the corpus. A separate app would fragment the workflow ("fix the source, then go to the queue, then come back to re-ingest"). Putting it inside hangar lets a single session walk source -> ingest run -> queue -> resolved.

## Goals

1. Surface every unresolved ingest issue in one queue, grouped by corpus and source. v1 covers the figure-pairing residuals; v2+ adds new producers without touching the queue UI.
2. Let an authorized user resolve each issue with a small fixed action set (per-issue-type) and capture the override in the database.
3. Round-trip overrides to YAML sidecars per handbook so re-ingestion picks them up. A clean re-extract from a fresh clone reproduces every override that has been exported.
4. Keep the candidate display cheap: thumbnail strip of pre-extracted figure PNGs from the developer-local cache; PDF context is one external link.
5. Stay generic enough that the next corpus (regulations, ACS, knowledge graph drift) can register an issue type without rewriting the queue plumbing.

## Non-goals

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Scope (v1)

Two concrete plugins, deliberately on opposite sides of the same heuristic so the abstraction is forced to handle both directions:

| Plugin id                 | What it produces                                                        | Today's count |
| ------------------------- | ----------------------------------------------------------------------- | ------------- |
| `handbook.caption-orphan` | Issues for residual `caption-without-figure` entries in `warnings.json` | 21            |
| `handbook.image-orphan`   | Issues for residual `figure-without-caption` entries in `warnings.json` | 0             |

The image-orphan side is empty today (the figure-pairing fix landed). Including it in v1 forces the schema and the plugin contract to handle "needs an image" and "image needs a caption" symmetrically. Otherwise the second plugin always retrofits the abstraction.

## Issue actions

Each issue kind exposes a small, fixed action set. The plugin owns the action handlers; the queue UI only renders the buttons.

### `handbook.caption-orphan`

| Action               | Effect                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `pair`               | Bind the caption to a chosen image from the candidate strip                                     |
| `mark-no-figure`     | Caption is real but no image was meant to ship with it (legend-only caption, sub-figure header) |
| `mark-false-caption` | Regex false positive that survived the line-anchor (still a body-text reference)                |

### `handbook.image-orphan`

| Action            | Effect                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `pair`            | Bind the image to a chosen caption from the candidate strip                                  |
| `mark-extraneous` | Image is real corpus content but not a figure (running header, watermark, decorative repeat) |
| `mark-decorative` | Inline icon or symbol the size floor was right to drop                                       |

Every action writes a single `ingest_override` row keyed by the issue id. Actions are idempotent: re-applying the same action overwrites the prior payload.

## Generic schema (sketch)

Two tables in the `hangar` Postgres namespace, defined in a new BC `libs/bc/ingest-review/`. Full Drizzle definitions land in [design.md](./design.md).

```text
hangar.ingest_issue
  id                 text primary key (issue_<ULID>)
  corpus             text not null   -- 'handbook', 'regs', 'knowledge', ...
  source_id          text not null   -- 'ifh', 'phak', '14-cfr-91', ...
  edition            text            -- 'FAA-H-8083-15B' (nullable for non-versioned corpora)
  page_num           integer         -- 1-indexed where applicable
  kind               text not null   -- 'handbook.caption-orphan' | 'handbook.image-orphan' | ...
  external_id        text not null   -- stable id from the producer (warnings.json `id`)
  payload            jsonb not null  -- producer-defined; opaque to the queue
  first_seen_at      timestamptz not null
  last_seen_at       timestamptz not null
  unique (kind, external_id)

hangar.ingest_override
  id                 text primary key (override_<ULID>)
  issue_id           text not null references ingest_issue(id) on delete cascade
  action             text not null   -- 'pair' | 'mark-no-figure' | 'mark-false-caption' | ...
  payload            jsonb not null  -- producer-defined; e.g. { "image_xref": 1234, "image_page": 7 }
  created_by_user_id text not null references identity.user(id)
  created_at         timestamptz not null
  unique (issue_id)   -- one current override per issue; history via audit_log
```

History is captured by the existing `audit_log` (per `libs/audit/`); the queue reads only the current row.

## Plugin shape

A plugin registers three handlers in code (no DB row). The queue's loader and UI dispatch by `kind`.

```ts
interface IngestIssuePlugin<P, A> {
  kind: IngestIssueKind;             // string literal in @ab/constants
  // 1. Producer: read pipeline output and yield issues for upsert.
  produceIssues(ctx: ProducerContext): AsyncIterable<IssueRecord<P>>;
  // 2. Candidate finder: given an issue, return ranked options for the UI.
  findCandidates(issue: IssueRecord<P>, ctx: CandidateContext): Promise<Candidate[]>;
  // 3. Action handler: validate + persist a chosen action.
  applyAction(issue: IssueRecord<P>, action: A, ctx: ActionContext): Promise<void>;
  // 4. YAML serializer: shape one override into the per-corpus sidecar.
  serializeForYaml(issue: IssueRecord<P>, override: OverrideRecord<A>): YamlSidecarEntry;
}
```

The producer writes to `ingest_issue` via upsert (keyed on `(kind, external_id)`), so re-running it on a re-extracted handbook updates the live set without losing override history. Issues whose `external_id` has disappeared from a fresh ingest are soft-removed (status flipped) but kept for audit; their override stays, idle.

Full TypeScript surface lands in [design.md](./design.md).

## Override storage: DB-first, YAML on export

Two-step pipeline so neither side becomes the bottleneck:

1. **Hangar UI -> DB.** Every action writes `ingest_override` directly. Iteration is fast; history is in `audit_log`. The queue is the editing surface.
2. **DB -> YAML sidecar.** A new script `bun scripts/ingest-review/export-overrides.ts` reads the `ingest_override` table for a given corpus, groups by source, and writes per-handbook YAML to `scripts/sources/config/handbooks/<slug>-overrides.yaml`. Idempotent: running export twice produces a byte-identical file.
3. **YAML -> ingest pipeline.** The figure-pairing pipeline reads the sidecar at the start of `extract_figures` and applies overrides as a final pass after the existing geometric tiers. Sidecar absent -> pipeline behaves identically to today. Sidecar present -> documented overrides are applied even on a fresh clone before any DB exists.
4. **Reproducibility.** A clean clone has YAML but no DB. A first-time `bun scripts/ingest-review/import-overrides.ts` rebuilds the DB from the sidecar so the hangar UI picks up where YAML left off. Idempotent in both directions.

This means YAML is the source of truth for **ingest**; DB is the source of truth for **editing**. The two are kept in sync by explicit export / import scripts run as part of normal session housekeeping (and added to `bun run check` later if drift becomes an issue).

## Candidate window

Reuse the existing tier logic from [`figures.py`](../../../tools/handbook-ingest/ingest/figures.py): for a `caption-orphan`, the candidate set is every unpaired image on `page_num +- 2`. The thumbnail strip displays them in encounter order with their page number and dimensions. For an `image-orphan`, the candidate set is every unpaired caption on `page_num +- 2`.

The producer writes the candidate references into the issue's `payload` at upsert time so the UI never has to re-open the PDF; the candidate finder just rebuilds the structured list for rendering.

## Success criteria

1. Joshua walks through the live 21 caption-orphan residuals in `handbooks/{ifh,phak,iph,avwx}/.../warnings.json` and resolves each via the hangar UI in one session. Each click writes an `ingest_override` row.
2. Running `bun scripts/ingest-review/export-overrides.ts` after that session produces a per-handbook YAML sidecar with a stable byte-equal output on re-run.
3. Re-extracting one handbook (`bun scripts/sources/handbooks ingest --slug ifh --re-extract`) consumes the YAML sidecar and applies the 21 manual pairings; the resulting `warnings.json` contains zero `caption-without-figure` rows for the resolved entries.
4. A fresh clone (no DB) loads the sidecar via `bun scripts/ingest-review/import-overrides.ts` and the hangar UI shows the resolved issues in their resolved state.
5. The plugin contract is exercised by both `handbook.caption-orphan` and `handbook.image-orphan` plugins (even though the latter has zero live issues -- the integration test seeds one to prove the abstraction).
6. `bun run check` passes; the new BC's runtime barrel does not leak `@ab/db/connection` to the browser bundle.

## Risks

- **DB / YAML drift.** Authors edit DB; the pipeline reads YAML; the two diverge if export is forgotten. Mitigation: surface a "Pending export" badge on the hangar nav when `ingest_override` rows exist whose `created_at > last export timestamp`, and document the export step in the queue's empty-state copy. A future check-pipeline step can fail the build on drift, but is out of scope for v1.
- **Override staleness across handbook revisions.** When the FAA publishes a new handbook edition, page numbers and image xrefs shift. An override keyed on `(page_num, image_xref)` may now point to the wrong image. Mitigation: the issue's `external_id` is composed from a content-stable hash (e.g. caption text + figure number) where possible; a stale override surfaces as "Override target not found" in the next ingest run and re-enters the queue with a `stale` flag.
- **Plugin architecture over-engineering.** Two plugins is a thin proof of generalisation; abstracting too aggressively for "future corpora" is the failure mode the figure-pairing WP itself called out. Mitigation: the plugin interface is intentionally narrow (producer / candidate-finder / action-handler / serializer); anything richer waits until a third plugin arrives with a real divergent need.
- **Schema namespace.** `hangar.ingest_issue` could grow into a hundred-thousand-row table once knowledge-graph drift detection arrives. Indexes per corpus / kind / source are mandatory from day one (see [design.md](./design.md)).
- **Audit-log volume.** Every action writes to `audit_log`. For 21 issues this is trivial; for a future 10k-issue knowledge-drift batch it becomes meaningful. Mitigation: route the writes through the existing `libs/audit/` helpers; revisit if a future plugin pushes drift volume past 1k overrides.

## Decisions made (do not re-litigate)

These were settled before WP authoring; this section records them so the build phase doesn't re-debate.

- **Override storage:** DB-first, YAML on export (per Override storage above).
- **Candidate window:** page +- 2 from the issue's page_num (per Candidate window above).
- **PDF view:** External `file://` link only; no embedded viewer in v1.
- **Plugin count for v1:** Two (`handbook.caption-orphan`, `handbook.image-orphan`), even though only one has live issues.
- **BC location:** New BC `libs/bc/ingest-review/` (rationale + alternatives in [design.md](./design.md)).
- **Route prefix:** `/ingest-review` (sibling of `/sources`, `/review`); reuses neither namespace.

## Open questions for the user

None at spec-author time. Decisions to affirm before build:

- "Two plugins for v1" stance. If the user prefers one (`caption-orphan` only) and adds the second when image-orphan issues actually appear, scope drops by one plugin without changing the BC or queue UI. The argument for keeping both is that the abstraction is otherwise unforced.
- BC name `libs/bc/ingest-review/`. Alternative names: `libs/bc/triage/`, `libs/bc/queue/`. Picked `ingest-review` because every consumer is an ingest pipeline; the audience is the same as `apps/hangar/review/` but the BC name needs to disambiguate from review-doc tracking. See [VOCABULARY.md](../../platform/VOCABULARY.md) before building if a different name is preferred.
- Sidecar filename convention: `<slug>-overrides.yaml` next to `<slug>.yaml`. Alternative: a sub-directory `overrides/<slug>.yaml`. Flat picked for symmetry with the existing config layout; revisit if the override files grow large.
