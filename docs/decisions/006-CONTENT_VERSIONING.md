# 006: Content Versioning and Release Model

Decided 2026-03-25.

## Context

Content changes constantly (typo fixes to curriculum restructures). The FAA requires traceability. Students need stability during their course. These are competing concerns.

## Decision

### Two-Tier Versioning

**Content version** -- every individual change to a content item. Auto-incremented. Granular audit trail.

**Release version** -- a curated snapshot. Semver. "These specific content versions, together, are the course."

### Semver for Releases

| Level             | Meaning                                                 | Example                       |
| ----------------- | ------------------------------------------------------- | ----------------------------- |
| **major** (X.0.0) | Code/schema changes needed, structural reshaping        | New data model for scenarios  |
| **minor** (0.X.0) | Curriculum restructure, lessons added/removed/reordered | Module B gets a new lesson    |
| **patch** (0.0.X) | Spelling, wording, cosmetic, non-structural             | Typo fix in scenario briefing |

### FAA Approval is a Separate Axis

FAA status is tracked per-change and per-release, independent of semver:

```
Release {
  version: "2.3.14"
  faa_status: approved | pending_review | exempt
  faa_approval_ref: "LOA-2026-07"
}
```

A major version might not need FAA review (internal restructure, same content). A minor version might need it (new TSA lesson responding to regulation change). These don't correlate.

### Release Changeset

Every release records what changed per item:

```
release_changeset {
  release_id
  item_type       -- module | lesson | scenario | question
  item_id
  change_type     -- added | removed | reordered | edited | rewritten
  significance    -- patch | minor | major
  faa_review_required  -- boolean
  faa_approved         -- boolean | null
  previous_version
  new_version
}
```

This powers upgrade decisions and FAA tracking at the item level.

### Mid-Course Update Rules

Four independent axes for any update decision:

1. **Content versioning** -- what changed (semver significance)
2. **FAA approval** -- does this change need regulatory review
3. **Upgrade eligibility** -- CAN this student upgrade given their progress
4. **Upgrade desirability** -- SHOULD they, and do they want to

#### By Version Tier

| Tier      | Availability                          | Rationale                                        |
| --------- | ------------------------------------- | ------------------------------------------------ |
| **patch** | Immediate, mid-lesson                 | Fixes shouldn't wait. No structural impact.      |
| **minor** | Per-module, based on student progress | Curriculum changed. Needs per-module evaluation. |
| **major** | Next session                          | May require code changes. Clean restart needed.  |

#### Per-Module Logic (minor/major)

For each module in the student's course:

| Student's state | Content changed?  | FAA approved?   | Action                                     |
| --------------- | ----------------- | --------------- | ------------------------------------------ |
| Not started     | Yes               | Approved/exempt | Auto-upgrade                               |
| Not started     | Yes               | Pending         | Stay on current                            |
| In progress     | Patch only        | n/a             | Auto-upgrade                               |
| In progress     | Structural change | Approved        | Offer upgrade at lesson boundary           |
| In progress     | Structural change | Pending         | Stay on current                            |
| Completed       | Any               | Any             | No action. Optional redo if student wants. |

#### FAA Rule

**Never auto-upgrade a student into unapproved content.** Pending FAA approval = stay on current approved version for that module.

### Audit Trail

Every lesson attempt records:

```
LessonAttempt {
  learner_id
  session_id
  lesson_id
  release_version       -- which release they started on
  end_release_version   -- may differ if patch applied mid-lesson
  started_at
  completed_at
}
```

Content versions seen are tracked relationally, not as JSON:

```
LessonAttemptContent {
  attempt_id
  item_type             -- scenario | question | micro_lesson | competency
  item_id
  content_version
  release_id
}
```

Queryable: "Which students saw content version X of scenario Y?" -- a question FAA auditors will ask.

Always answerable: "What exact content did this learner see, for every lesson, at every moment?"

### Multi-Version Serving

Published tables hold all published releases, keyed by `release_id`. Sim queries with a release filter based on the student's assigned release version. Students on different releases see different content from the same schema.

When a student is assigned to a release, they stay on it until upgrade rules (above) move them. Hangar keeps every version of every content item for re-publishing if needed.

### Transparency

Students should see:

- What version they're on
- What's coming (upcoming release notes)
- What changed if they're being upgraded
- Options if a major/minor change affects their progress (continue current, restart, selective upgrade)
- Clear warnings about time investment for redoing completed modules
