# 005: Published Content Model (PARTIALLY SUPERSEDED)

> **Partially superseded 2026-04-26.** The "lean published snapshot, separate from authoring" principle survives the pivot and applies wherever airboss publishes content (knowledge graph, glossary, future scenario packs). The specific `published.*` table set described below targets the FIRC course (scenarios, student models, modules, questions, micro lessons, competencies) and is dormant per [ADR 017](017-firc-compliance-dormant.md) until a content pack ships.
>
> Today the platform's content surfaces (knowledge graph, glossary, study cards, sim scenarios) follow per-BC publishing patterns rather than the FIRC-style monolithic release pipeline. The release-versioning concept (see [ADR 006](006-CONTENT_VERSIONING.md)) still applies; the table-by-table FIRC schema does not.
>
> **What's still authoritative:** the publish-isolation principle, the all-releases-retained model, the immutable-once-published rule, the no-drafts-in-published rule.
>
> **What's stale:** the specific table list (FIRC-flavored), the hangar -> sim publish flow (the post-pivot flow varies by surface).

Decided 2026-03-25.

## Context

Hangar has rich authoring data (drafts, versions, reviews, metadata). Sim needs lean, published-only content. We need isolation so sim can't read drafts and isn't coupled to hangar's schema.

## Decision

Separate `published.*` schema. Hangar's publish action transforms and copies content there.

### How It Works

```
hangar (author) ---publish---> published.* (lean) <---read--- sim
                \
                 --snapshot--> compliance.* (FAA package)
```

### Published Tables (Lean, Versioned)

All content tables include `release_id` -- the published schema holds all published releases, not just the latest. Sim queries with a release filter. Old releases are retained as long as any student references them.

| Table                         | Fields                                                                                                                          | Notes                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `published.release`           | id, version, faa_status, significance, changelog, published_at                                                                  | One row per release                                                                                      |
| `published.release_changeset` | release_id, item_type, item_id, change_type, significance, faa_review_required, faa_approved, previous_version, new_version     | Per-item change tracking                                                                                 |
| `published.scenario`          | id, content_version, release_id, title, tick_script, student_model_id, briefing, competencies, faa_topics, difficulty, duration | No drafts, no workflow state, no author metadata. `correct_answer` is server-only, never sent to client. |
| `published.student_model`     | id, release_id, name, parameters                                                                                                | Direct copy                                                                                              |
| `published.module`            | id, release_id, title, scenario_ids, time_allocation                                                                            | Flattened                                                                                                |
| `published.question`          | id, release_id, content_version, text, type, options, correct_answer, topic, module_id, pool_id                                 | Active only. `correct_answer` is server-only, never sent to client.                                      |
| `published.micro_lesson`      | id, release_id, content_version, title, content, trigger_context                                                                | Active only                                                                                              |
| `published.competency`        | id, release_id, content_version, domain, skill, behaviors                                                                       | Copy                                                                                                     |

### Why Separate Schema (Option C)

- **Real isolation.** Sim can't read drafts. Schema mismatch between authoring and playback tables is the point.
- **Optimized for read.** Published tables are flat, fast, no authoring noise.
- **Independent evolution.** Hangar's schema can change without breaking sim. The publish action is the translation layer.
- **Same pattern for FAA snapshots.** Publish to `published.*` for sim. Snapshot to `compliance.*` for FAA.
- **Data duplication is minimal.** Published is a subset, flattened. Acceptable tradeoff for isolation.

### Publish is Atomic

The publish action runs in a single database transaction. Either all tables for a release update or none do. Partial publishes are not possible.

### Hot Updates

New releases are available immediately on publish (database write, not file deploy). Sim picks up new releases on next session start or lesson boundary. No redeploy needed for content changes.

Sim loads content for a student's assigned release at session start. Patches (same release, updated content) take effect at next lesson load. New releases follow the upgrade rules in [ADR 006](006-CONTENT_VERSIONING.md).

### Rollback

To roll back a bad release: publish a new patch release from hangar's versioned content history. The bad release remains in published tables (students may reference it), but new sessions get the fix. There is no "unpublish" -- always roll forward.

### Retention

Published releases are retained as long as any active enrollment references them. Cleanup of unreferenced old releases is a background ops task, not automatic.

### Future Option

SQLite read-only bundle as an additional publish target. Export published content as SQLite DB for edge deployment or truly stateless sim instances. Add later without changing architecture.
