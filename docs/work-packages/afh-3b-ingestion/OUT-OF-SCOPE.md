---
title: 'Out of Scope: AFH 3B section-tree ingestion'
product: course
feature: afh-3b-ingestion
type: out-of-scope
status: unread
---

# Out of Scope: AFH 3B section-tree ingestion

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Non-goals" + "Out of scope -- captured for future work" sections of [spec.md](./spec.md). The WP itself is `status: abandoned` (per [spec.md](./spec.md) frontmatter); the deferral context still matters because the 15 knowledge nodes citing 3B continue to resolve to a stub today, and any future "should we ingest 3B?" conversation reopens the same questions captured below.

## Summary

| Item                                               | Status   | Trigger to revisit                                                                                 |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Library cert/topic/regulations/handbook UI changes | Rejected | Never -- see detail below                                                                          |
| Auditing or rewriting the 15 nodes citing 3B       | Deferred | When a node is being edited for an unrelated reason, OR a renderer pass flags missing reader pages |
| Deprecating 3B at the corpus level                 | Rejected | Never -- see detail below                                                                          |
| Repointing knowledge-node citations from 3B to 3C  | Deferred | Explicit content-audit request, OR a node is being edited for an unrelated reason                  |

## Library cert/topic/regulations/handbook UI changes

Status: Rejected

What was rejected:
Any UI changes to the library cert/topic/regulations/handbook surfaces as part of this WP. The substrate already handles two editions of one slug; this WP would just populate the second one.

Why:
Per [spec.md](./spec.md) "Non-goals" section: the substrate is sufficient as-is. Bundling UI changes with content ingestion would conflate two unrelated review surfaces (does the ingestion produce correct rows? vs does the UI present them well?). A re-decision would have to clear: a discovered UI gap that *only* surfaces when 3B is ingested -- e.g., the supersedes chain renders incorrectly when both editions exist. None has surfaced in the existing 3C ingest.

References:

- [spec.md](./spec.md) Non-goals section
- [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md)

## Auditing or rewriting the 15 nodes citing 3B

Status: Deferred

What was deferred:
A content audit pass over the 15 knowledge nodes that cite `FAA-H-8083-3B` directly in their `source` strings (stall-recovery, EFATO, traffic pattern, four-forces, slow-flight, and others -- run `grep -rn "8083-3B" course/knowledge/` for the live list). Auditing would check whether the cited claim is unchanged in 3C and, if so, repoint to the current edition.

Why:
Per [spec.md](./spec.md) "Non-goals" section: "Not auditing or rewriting the 15 citing nodes. They keep working as-is." Once both editions are ingested, the 15 nodes citing 3B keep resolving correctly through the supersedes chain. A bulk audit is a content task with its own review criteria (does the claim still hold in 3C? has the chapter been reorganized? did the figure number change?) and is best done node-by-node when an author is already in that node for an unrelated reason.

Trigger to revisit:
Either (a) a knowledge node citing 3B is being edited for an unrelated reason, in which case the editor checks whether the citation should repoint, or (b) a renderer pass surfaces a "no reader page" gap as a learner complaint or visible degradation.

Implementation pattern when triggered:
Per-node, in-place edit. Read the cited claim against the 3B section, then against the corresponding 3C section. If unchanged, repoint by updating the `source` string in the node YAML. If the chapter reorganized between editions (the load-bearing reason 3B citations cannot be mechanically repointed -- see [spec.md](./spec.md) Scope §2), surface a per-node decision to the author.

References:

- [spec.md](./spec.md) Non-goals
- [spec.md](./spec.md) Why this matters (the 15-node count and grep recipe)

## Deprecating 3B at the corpus level

Status: Rejected

What was rejected:
Removing 3B from the reference corpus once 3C is ingested. The supersedes chain hides 3B from primary cert library surfaces but does NOT remove the readable content.

Why:
Per [spec.md](./spec.md) "Non-goals" section: "Not deprecating 3B at the corpus level. Keeping it readable is the whole point." Citations into 3B from existing knowledge nodes must keep resolving to real content; deprecation would break the very citations this WP exists to make readable. A re-decision would have to clear: a future where every 3B citation has been migrated AND there is a measurable cost to keeping the corpus row (storage, render time, search noise). None of those costs are visible today.

References:

- [spec.md](./spec.md) Non-goals section
- [spec.md](./spec.md) Acceptance bullet on `/library/cert/private` showing 3C as current edition (3B remains readable, just not the current edition)

## Repointing knowledge-node citations from 3B to 3C

Status: Deferred

What was deferred:
A content-audit pass that walks the 15 nodes citing 3B and repoints each to 3C wherever the chapter content is unchanged. This is a finer-grained version of the "Auditing or rewriting" item above; it specifies the *action* (repoint to 3C) once the audit decides the content matches.

Why:
Per [spec.md](./spec.md) "Out of scope -- captured for future work" section: "Defer until either (a) those nodes are being edited for an unrelated reason, or (b) a renderer pass flags them. Triggered: NEVER autonomously; only on explicit content-audit request." The deferral is explicit in the spec: never autonomous. A bulk repoint risks introducing silent citation drift where the 3C section says something different from what the 3B section said when the node was authored.

Trigger to revisit:
Explicit content-audit request from the user (Joshua), OR a knowledge node is being edited for an unrelated reason and the author chooses to repoint as part of that edit.

Implementation pattern when triggered:
Per-node, in-place. Read the cited claim against the 3B section AND the corresponding 3C section. If unchanged, update the `source` string in the node YAML to the 3C reference. If changed (chapter reorganized, claim refined, figure renumbered), surface a per-node decision -- do NOT auto-repoint. The supersedes chain handles the reader-side fallback regardless of which edition the node cites.

References:

- [spec.md](./spec.md) Out of scope -- captured for future work
- [spec.md](./spec.md) Scope §2 (chapter reorganization between editions is the load-bearing reason mechanical repointing fails)
