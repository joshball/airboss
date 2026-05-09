# OUT-OF-SCOPE.md Template

The canonical shape for `docs/work-packages/<slug>/OUT-OF-SCOPE.md`. Copy the block below verbatim, replace placeholders, fill the per-item sections from the source spec / tasks / ADRs.

The discipline that drives this template: [wp-out-of-scope-extraction.md](./wp-out-of-scope-extraction.md).

## Template

````markdown
---
title: 'Out of Scope: <WP Name>'
product: <product>
feature: <feature-slug>
type: out-of-scope
status: unread
---

# Out of Scope: <WP Name>

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                  | Status       | Trigger to revisit                                 |
| --------------------- | ------------ | -------------------------------------------------- |
| <one-line item name>  | Deferred     | <one-line trigger>                                 |
| <one-line item name>  | Rejected     | Never -- see detail below                          |
| <one-line item name>  | Follow-on WP | When <weather course content authoring begins>     |

## <Item 1 name>

Status: Deferred / Rejected / Follow-on WP

What was deferred / rejected / postponed:
<concrete description -- table name, column name, file path, etc.>

Why:
<the reasoning -- principle reference, prior decision, scope discipline>

Trigger to revisit (if Deferred):
<concrete signal -- "when authoring the second weather course",
"when more than 3 learners hit X situation", etc.>

Implementation pattern when triggered (if Deferred):
<reference to similar shipped pattern -- "mirror credential_prereq
at libs/bc/study/src/schema.ts:1893", "follow the WP-spec template
at docs/work-packages/cert-syllabus-and-goal-composer/spec.md">

References:

- <link to philosophy principle>
- <link to ADR>
- <link to prior conversation / decision>

## <Item 2 name>

(repeat...)
````

## Status values (only three)

| Status         | Meaning                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Deferred`     | We will likely build this when a specific signal fires. The "Trigger to revisit" and "Implementation pattern when triggered" rows are required. |
| `Rejected`     | We considered it and decided no. Don't build without re-decision. The trigger row reads "Never -- see detail below" and the body explains why.  |
| `Follow-on WP` | We will build this, but as a separate WP with its own spec. The trigger row names the signal that launches the follow-on.                       |

If a deferred item doesn't fit any of these three, surface it for a decision rather than inventing a fourth status. The classification matters: it's the difference between "wait" and "no" and "later, separately."

## Per-item sections in detail

### What was deferred / rejected / postponed

Concrete. Name the column, file path, BC function, table, route, lens, or whatever artifact would have shipped if this hadn't been deferred. "Course-to-course prerequisites" is too vague; "the `course_prereq` table (peer of `credential_prereq` at `libs/bc/study/src/schema.ts:1893`)" is the right shape.

### Why

The reasoning that led to the deferral / rejection. Reference the principle (LEARNING_PHILOSOPHY.md principle N), the ADR (ADR 016), the scope discipline rule, or the conversation note that produced the decision. If the reasoning is "no real authoring use yet," say so explicitly.

### Trigger to revisit

For `Deferred`: the concrete signal that should make us reopen this. Not "someday" or "if useful." Examples:

- "When authoring the second weather course (currently only one)"
- "When more than 3 learners hit the situation where X"
- "When the cert dashboard surfaces the gap between courses"
- "When ACS publishes a second edition (currently 25 only)"

For `Rejected`: write "Never -- see detail below" and use the Why section to explain why we'll never build it (or why a re-decision would have to clear a high bar).

For `Follow-on WP`: name the WP that will land it, or the signal that will spawn one ("when the goal-composer-ui WP is ready to land," "after the next ADR-revision cycle").

### Implementation pattern when triggered

For `Deferred`: reference the closest shipped pattern. The next agent can mirror it. Examples:

- "Mirror `credential_prereq` at `libs/bc/study/src/schema.ts:1893`"
- "Follow the WP-spec template at `docs/work-packages/cert-syllabus-and-goal-composer/spec.md`"
- "Add a column on `course_step` per the seed-validator pattern in `libs/bc/study/src/seed-courses.ts`"

For `Rejected`: omit (the section is "if Deferred").

For `Follow-on WP`: reference the follow-on WP's expected location or, if not yet authored, the WP-spec template the agent should run.

### References

Links to the source documents. ADRs, philosophy principles, prior WPs, conversation notes, IDEAS.md entries. The references are how the next reader confirms the deferral was real and not an agent's confabulation.

## Workflow

1. Open the source `spec.md` and `tasks.md`. Locate every "Out of scope" / "Out (explicitly" / "Deferred" section. Read the surrounding spec narrative for the rationale.
2. Read the linked ADRs and principle docs for the deeper why.
3. Walk the WP's directory git history (`git log --oneline -- docs/work-packages/<slug>/`) for any commit messages that explain deferral choices.
4. For each item: classify as `Deferred` / `Rejected` / `Follow-on WP`. Fill every section.
5. Replace the in-place "Out of scope" section in `spec.md` / `tasks.md` with one line:

   ```markdown
   ## Out of scope

   See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
   ```

6. Format: `bun run track format docs/work-packages/<slug>/OUT-OF-SCOPE.md docs/work-packages/<slug>/spec.md docs/work-packages/<slug>/tasks.md`.
7. Open one PR per WP. Title format: `docs(wp): extract out-of-scope -- <slug>`.

## Frontmatter fields

The frontmatter is intentionally minimal. The file is documentation, not a tracked work artifact. The fields are:

| Field     | Required | Notes                                                     |
| --------- | -------- | --------------------------------------------------------- |
| `title`   | yes      | `Out of Scope: <WP Name>`                                 |
| `product` | yes      | Same value as the parent WP's `product` field             |
| `feature` | yes      | The WP slug (parent directory name)                       |
| `type`    | yes      | Always `out-of-scope`                                     |
| `status`  | yes      | `unread` initially; user flips to `read` after walking it |
