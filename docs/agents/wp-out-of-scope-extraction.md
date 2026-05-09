# WP Out-of-Scope Extraction Discipline

Work package specs and tasks accumulate one-line "Out of scope" bullets without rationale. Six months later, no agent (and often no human) can tell whether a deferred item is "rejected forever," "wait for trigger X," or "land as a follow-on WP." This discipline extracts those bullets into a per-WP `OUT-OF-SCOPE.md` file with structured per-item entries that capture the **why**, the **trigger to revisit**, and the **implementation pattern** to mirror when the trigger fires.

## The rule

When an agent **reads** any file under `docs/work-packages/<slug>/`, it must check whether `docs/work-packages/<slug>/OUT-OF-SCOPE.md` exists. If it doesn't:

1. If the WP's `spec.md` or `tasks.md` has any "Out of scope" / "Deferred" items, extract them into a new `OUT-OF-SCOPE.md` (use the canonical template at [wp-out-of-scope-template.md](./wp-out-of-scope-template.md)).
2. If there are no such items, create `OUT-OF-SCOPE.md` with frontmatter + body stating "This WP has no deferred items." (so the file's existence signals "extraction was checked").
3. Replace the in-place "Out of scope" section in `spec.md` / `tasks.md` with a one-line pointer to `OUT-OF-SCOPE.md`.
4. Open a small PR for the extraction. PR title: `docs(wp): extract out-of-scope -- <slug>`.
5. Continue with the original work.

## When the trigger fires

The trigger is **read of any file** under `docs/work-packages/<slug>/`, not edit-touch. Reading `spec.md`, `tasks.md`, `test-plan.md`, `design.md`, or `user-stories.md` for any reason -- review, drift check, follow-on WP planning, agent-handoff orientation -- is enough to trigger the check. The check is a single `ls` for `OUT-OF-SCOPE.md`; if it exists, the discipline is satisfied and you continue. If it doesn't, extract before continuing the original work.

This is a deliberate choice: extraction is cheap, deferred-context loss is expensive. Read-touch covers more situations than edit-touch and avoids the failure mode where an agent reads a WP, builds something based on it, and never noticed that "X was deferred because Y" was sitting one paragraph above the section it cared about.

## What "no deferred items" looks like

Some WPs genuinely have nothing deferred. They still get an `OUT-OF-SCOPE.md` so the next agent can confirm "the extraction was performed; there really is nothing here" rather than "maybe nobody got around to it." Use this body:

```markdown
---
title: 'Out of Scope: <WP Name>'
product: <product>
feature: <slug>
type: out-of-scope
status: unread
---

# Out of Scope: <WP Name>

This WP has no deferred items. Every concern surfaced during spec was either
shipped in scope or rejected outright as part of the spec discussion (no
revisit trigger). See spec.md for the in-scope contract.
```

## Three Status values, no more

Each extracted item gets exactly one of:

| Status         | Meaning                                                           | Trigger field      |
| -------------- | ----------------------------------------------------------------- | ------------------ |
| `Deferred`     | We will likely build this when a specific signal fires.           | Required, concrete |
| `Rejected`     | We considered it and decided no. Don't build without re-decision. | "Never -- see why" |
| `Follow-on WP` | We will build this, but in a separate WP with its own spec.       | "When <signal>"    |

If an item doesn't fit any of these three, surface it for a decision rather than inventing a fourth status.

## Conflict handling

No lock. Two agents extracting the same WP simultaneously will hit a merge conflict on the second PR. The fix is trivial: both agents extract from the same source, so both versions of `OUT-OF-SCOPE.md` are equivalent in content. Take either. Conflict frequency outside multi-agent burst sessions is basically zero.

This is the right tradeoff. A lock file would block extraction during the exact moments the user is dispatching parallel work. The cost of a rare merge conflict is much lower than the cost of an extraction never happening.

## Tooling

Two CLI sub-commands under `bun run track`:

- **`bun run track oos-audit`** -- read-only report. Lists WPs that have "Out of scope" / "Deferred" sections in `spec.md` or `tasks.md` but no `OUT-OF-SCOPE.md`. Use to gauge backlog size.
- **`bun run track oos-pick`** -- emits a self-contained prompt for the 3 most-recently-shipped WPs needing extraction. Paste into a fresh `claude` session to grind down the queue in batch.

Authoring template: [wp-out-of-scope-template.md](./wp-out-of-scope-template.md).

## Why this discipline exists

The triggering example: `docs/work-packages/course-primitive/spec.md`. The "Out of scope" section is eight one-line bullets ("Course-to-course prerequisites", "Parallel-ladder schema", ...). Each was a real decision with rationale, but the rationale lives in the broader spec narrative, in ADR 016, in `LEARNING_PHILOSOPHY.md` principle 11, and in the conversation history that produced the decision. A future agent reading the bullet has none of that context. They will either:

- Build the deferred feature without realizing it was deferred (silent scope creep), or
- Avoid the deferred feature forever even when its trigger has fired (silent indefinite drift).

The structured extraction prevents both failure modes by forcing the **why** + **trigger** + **implementation pattern** to be captured at decision time, in the same directory as the spec, with a Status that classifies the deferral.

## Backfill policy

**No automatic backfill.** Existing WPs without `OUT-OF-SCOPE.md` get extracted naturally as agents touch them, or in batches via `bun run track oos-pick` when the user wants to grind down the queue. The discipline applies going forward; extraction of existing WPs is opportunistic.
