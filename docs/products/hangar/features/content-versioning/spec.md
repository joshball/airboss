---
title: "Spec: Content Versioning"
product: hangar
feature: content-versioning
type: spec
status: done
---

# Spec: Content Versioning

Content lifecycle workflow and version history for all content items. Expands the status workflow from 3 states (draft/published/archived) to 6 states (draft -> review -> approved -> published -> archived). Adds a version history viewer showing all changes with diffs, and the ability to rollback to any previous version.

## Data Model

### Expand COURSE_STATUS

Current: `draft`, `published`, `archived`
New: `draft`, `review`, `approved`, `published`, `archived`

Add `review` and `approved` states. The `validated` state from the PRD is handled by the validation engine (Feature 1) rather than as a content status -- validation is a gate on the `approved -> published` transition, not a status in itself.

### No new tables

The `audit.content_version` table already records every change with version number, diff, author, reason, and timestamp. The version history viewer reads from this table. No schema changes needed.

### New constants

Add `CONTENT_ACTIONS.STATUS_CHANGE` for status transition audit logging.

## Behavior

### Status Workflow

```
draft -> review -> approved -> published -> archived
  ^        |          |
  |        v          v
  +---- (reject) -- (reject)
```

| Transition            | Who    | Gate                                              |
| --------------------- | ------ | ------------------------------------------------- |
| draft -> review       | Author | None                                              |
| review -> approved    | Admin  | None                                              |
| review -> draft       | Admin  | Rejection reason required                         |
| approved -> published | Admin  | Validation engine must pass (no ERROR violations) |
| approved -> draft     | Admin  | Rejection reason required                         |
| published -> archived | Admin  | None                                              |
| any -> draft          | Admin  | Reset (rejection reason required)                 |

### Status Change Action

A new form action on each content edit page: `?/status`. Accepts `newStatus` and optional `reason`. Validates the transition is allowed, updates the item's `status` field, and logs:

1. `logAction` with `CONTENT_ACTIONS.STATUS_CHANGE`
2. `logContentVersion` with the status change as the diff

### Version History

A new route at `/scenarios/{id}/history` (and equivalent for other content types) shows the version history for a content item. Reads from `audit.content_version` ordered by version descending.

Each version entry shows:

- Version number
- Author
- Timestamp
- Reason (if provided)
- Diff summary (which fields changed)

### Rollback

From the version history, an "Restore this version" action reverts the content item to a previous version's state. This:

1. Reads the version's `diff.after` data
2. Updates the content item with that data
3. Resets status to `draft`
4. Logs a new content version with reason "Rolled back to version N"

### Diff View

Clicking a version in the history shows a before/after comparison. Simple field-level diff: for each field that changed, show the old and new values. Not a character-level diff -- field-level is sufficient for structured content.

## Validation

| Field             | Rule                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `newStatus`       | Must be a valid `COURSE_STATUS` value                              |
| Status transition | Must follow the allowed transitions above                          |
| Rejection reason  | Required when transitioning to `draft` from `review` or `approved` |

## Edge Cases

| Case                                     | Behavior                                                            |
| ---------------------------------------- | ------------------------------------------------------------------- |
| No version history exists                | Version history page shows "No history yet"                         |
| Content has no `diff.after` in a version | Rollback not available for that version                             |
| Status change on published content       | Only `published -> archived` allowed. No editing published content. |
| Concurrent status changes                | Last write wins (standard upsert behavior)                          |

## Out of Scope

- Review assignments (who should review this content) -- future feature
- Approval workflows with multiple approvers -- single admin approval for now
- Rich staging pipeline (draft -> approved-for-testing -> testing -> released) -- captured in IDEAS.md for future
- Delete requires reason -- captured in IDEAS.md for Feature 3 future iteration
