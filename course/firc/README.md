# FIRC course material (dormant)

The FIRC course content lives here. As of the post-pivot doc sweep, this corpus is **dormant** -- not archived, not deleted, just paused. It reactivates when `apps/firc/` ships per the [Multi-Product Architecture](../../docs/platform/MULTI_PRODUCT_ARCHITECTURE.md) and the airboss-firc migration described in [CLAUDE.md](../../CLAUDE.md).

See [ADR 017](../../docs/decisions/017-source-artifact-storage-policy/) for the broader pattern of FIRC-era surfaces being held dormant rather than deleted.

## Why it's still here

- The 503-question bank, 43+ scenario scripts, competency graph, traceability matrix, and FAA submission artifacts represent significant content work.
- They are FIRC-specific in their *framing* (AC 61-83K topic structure, 16-hour time accounting, FAA submission workflow) but most of the underlying scenarios, questions, and instructional design ideas transfer to broader pilot training.
- When the FIRC surface migrates from airboss-firc into `apps/firc/`, this directory is the content side of that migration.

## Layer model (FIRC-specific)

The FIRC course was authored against a 5-layer information architecture mirroring how the FAA expects FIRC providers to document course design. This structure is **only used here**; post-pivot content (`course/knowledge/`, `course/regulations/`, etc.) does not follow it.

| Layer                     | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| [L01-FAA/](L01-FAA/)                 | Regulatory foundation -- AC 61-83K, CFR references, TCO, submission packet |
| [L02-Knowledge/](L02-Knowledge/)     | Per-topic research dossiers (A.1-A.13)                                  |
| [L03-Objectives/](L03-Objectives/)   | Learning objectives, competency graph, prerequisites                    |
| [L04-Design/](L04-Design/)           | Module structure, lesson flow, course design decisions                  |
| [L05-Implementation/](L05-Implementation/) | Scenarios, question bank, FIRC-era feature specs                        |

## What to do here right now

Nothing. Do not author new FIRC content here. Do not modify existing FIRC content unless you are doing so as part of an explicit reawakening of the FIRC surface (which would require a new ADR superseding the dormancy decision).

If you find yourself wanting to write here, you probably want one of:

- **`course/knowledge/`** -- atomic ADR-011 knowledge graph nodes, live in `apps/study/`
- **`course/regulations/`** -- post-pivot FAR navigation course (the new way to do regulatory content)
- **`docs/vision/products/`** -- a new product PRD
- **`docs/work-packages/`** -- an implementation feature

## What to do here later

When `apps/firc/` migrates, this content gets re-evaluated:

1. Identify scenarios + questions that still apply (most will)
2. Re-tag against the post-pivot vocabulary and surface taxonomy
3. Migrate citations from FIRC-internal links into the knowledge graph
4. Decide which L02 research dossiers become real knowledge nodes vs. archived references

That's a deliberate project, not a casual edit.
