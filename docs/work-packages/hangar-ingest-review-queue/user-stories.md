---
title: 'User Stories: Hangar Ingest-Review Queue'
product: hangar
feature: hangar-ingest-review-queue
type: user-stories
status: unread
review_status: pending
---

# User Stories: Hangar Ingest-Review Queue

Joshua is the only persona for v1: content authority, builder, and CFI. Stories are written from his point of view, with the same first-person framing the [DESIGN_PRINCIPLES.md](../../platform/DESIGN_PRINCIPLES.md) "user-zero" pattern uses.

## Story 1: Resolve the residual figure-pairing orphans

> As the content authority, I want a single page that lists every unpaired figure caption left by the ingest pipeline, so I can clear the residual long tail without opening seven `warnings.json` files in a terminal.

Acceptance:

- I can open `/ingest-review` and see all 21 live caption-orphans grouped by handbook.
- Each row tells me the caption text, the page number, and the detected mode the pipeline assigned it.
- I can click any row and land on a focused page that shows me everything I need to make a decision: caption, candidate images, page link.

## Story 2: Pair a caption with the right image in two clicks

> As the content authority, I want to bind a stranded caption to its real image by clicking the image and clicking Pair, so I can resolve a figure without leaving the hangar.

Acceptance:

- The candidate strip shows me every unpaired image on the caption's page +- 2 with thumbnails I can recognise.
- I can click a thumbnail to select it and click `Pair` to bind it.
- The issue moves to the resolved state and the next ingest run honours my pairing.

## Story 3: Mark captions that have no figure

> As the content authority, I want to mark a real caption that has no image (legend caption, sub-figure header) as resolved without picking a fake image, so I don't pollute the manifest with bogus pairings.

Acceptance:

- The detail page exposes `Mark no figure` and `Mark false caption` actions next to `Pair`.
- Marking a caption as no-figure clears it from the queue without writing an image binding.
- Marking it as false-caption is recorded so the regex can be tuned over time (the queue's audit trail tells me which false positives keep recurring).

## Story 4: Carry overrides across re-ingests

> As the content authority, I want my decisions to survive when the handbook is re-extracted from a fresh PDF, so I don't redo the same triage every time the pipeline changes.

Acceptance:

- After resolving an issue, running `bun scripts/ingest-review/export-overrides.ts` writes my decision to a YAML sidecar in `scripts/sources/config/handbooks/`.
- The sidecar is byte-stable: re-running the export produces no diff if I haven't made new decisions.
- A re-extract of the handbook reads the sidecar and applies my pairings before producing the post-fix manifest.
- A clean clone with no DB and the YAML sidecar checked in produces the same end state as the live system after I imported the YAML.

## Story 5: Trust the queue when a new corpus comes online

> As the content authority, when a new ingest pipeline (regulations, knowledge graph drift) starts producing issues, I want them to show up in the same queue I'm already trained on, so I don't have to learn a second triage surface.

Acceptance:

- The queue is filterable by corpus / source / kind / status.
- Adding a new corpus does not require changes to the queue's UI -- only a new plugin in `libs/bc/ingest-review/src/plugins/` and any per-corpus action set.
- The plugin contract is small enough that a new one ships in a single PR with a working producer + candidate finder + action handler.
