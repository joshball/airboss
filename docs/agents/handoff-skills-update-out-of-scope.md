# Hand-off: agent-skills repo -- WP out-of-scope discipline

This is a brief to hand to an agent operating in `~/src/_me/ai/agent-skills/` (the source-of-truth repo for the project's `/ball-wp-spec`, `/ball-wp-build`, `/ball-wp-drift`, `/ball-wp-coverage`, `/ball-wp-migrate` skills, mirrored into `~/.claude/skills/`). The work updates those skill files so every agent that touches a WP also enforces the new out-of-scope extraction discipline.

## Context

The airboss project shipped a per-WP `OUT-OF-SCOPE.md` discipline. Previously, WP `spec.md` and `tasks.md` files carried one-line "Out of scope" bullets ("Course-to-course prerequisites", "Aux course attachment points", ...) without rationale. Six months later, no agent (and often no human) could tell whether a deferred item was "rejected forever," "wait for trigger X," or "land as a follow-on WP." The discipline forces structured per-item entries: **what** was deferred, **why**, the **trigger** to revisit, the **implementation pattern** to mirror when the trigger fires, and a **Status** classification (`Deferred` / `Rejected` / `Follow-on WP`).

The discipline is **read-touch triggered**: any time an agent reads a file under `docs/work-packages/<slug>/`, it must check whether `OUT-OF-SCOPE.md` exists in that directory. If not, extract before continuing the original work. This avoids the failure mode where an agent reads a WP, builds based on it, and never noticed that "X was deferred because Y" was sitting one paragraph above the section it cared about.

Source-of-truth docs in airboss:

- `docs/agents/wp-out-of-scope-extraction.md` -- the rule + workflow
- `docs/agents/wp-out-of-scope-template.md` -- the canonical OUT-OF-SCOPE.md shape

Tooling in airboss:

- `bun run track oos-audit` -- read-only report (WPs with deferred items but no OUT-OF-SCOPE.md)
- `bun run track oos-pick` -- emits a self-contained prompt for the 3 most-recently-shipped WPs needing extraction

## The canonical rule wording

When an agent reads any file under `docs/work-packages/<slug>/`, it must check whether `docs/work-packages/<slug>/OUT-OF-SCOPE.md` exists. If it doesn't:

1. If the WP's `spec.md` or `tasks.md` has any "Out of scope" / "Deferred" items, extract them into a new `OUT-OF-SCOPE.md` (use the canonical template at `docs/agents/wp-out-of-scope-template.md`).
2. If there are no such items, create `OUT-OF-SCOPE.md` with frontmatter + body stating "This WP has no deferred items." (so the file's existence signals "extraction was checked").
3. Replace the in-place "Out of scope" section in `spec.md` / `tasks.md` with a one-line pointer to `OUT-OF-SCOPE.md`.
4. Open a small PR for the extraction. PR title: `docs(wp): extract out-of-scope -- <slug>`.
5. Continue with the original work.

## Skills to update

Look at `~/.claude/skills/` (which symlinks into `~/src/_me/ai/agent-skills/skills/`). Update at minimum:

- **`wp/ball-wp-spec/SKILL.md`** -- the WP authoring skill. New WPs author `OUT-OF-SCOPE.md` at the same time as `spec.md`; deferred items go into the new file from the start, not in a one-line bullet inside `spec.md`. The skill should also instruct agents to check for `OUT-OF-SCOPE.md` on any pre-existing WP they read for context.
- **`wp/ball-wp-build/SKILL.md`** -- the phased build orchestrator. Before reading any WP file, check for `OUT-OF-SCOPE.md`. Extract before building if missing. Captures the "agent reads spec to build feature, builds something deferred without noticing" failure mode.
- **`wp/ball-wp-drift/SKILL.md`** -- the spec/code drift detector. Update to also flag missing `OUT-OF-SCOPE.md` as a drift signal (deferred items unaccounted-for vs current code).
- **`wp/ball-wp-coverage/SKILL.md`** -- the coverage scanner. Update to mention that newly-discovered features without WPs should be scaffolded with both `spec.md` and `OUT-OF-SCOPE.md`.
- **`wp/ball-wp-migrate/SKILL.md`** -- the WP migration scaffold. Migrated WPs land with `OUT-OF-SCOPE.md` populated from the source material's deferred / rejected items.
- **`wp/aliases/wp/SKILL.md`** -- the short alias. Inherits the above through the underlying skill, but verify the alias-doc (if any) doesn't shortcut around the discipline.

Run `grep -lr "work-packages" ~/src/_me/ai/agent-skills/skills/` to confirm no other skill is silently reading WPs without enforcing the discipline.

## Concrete change instructions per skill

For each skill listed above, add a section near the top (after the worktree-safety preamble and before the first phase or main task) titled **"Before reading any WP file"** with this wording:

```markdown
## Before reading any WP file

When this skill reads any file under `docs/work-packages/<slug>/`, the
WP out-of-scope extraction discipline applies. Check whether
`docs/work-packages/<slug>/OUT-OF-SCOPE.md` exists. If it doesn't,
extract per the airboss canonical rule:

- Discipline doc: `docs/agents/wp-out-of-scope-extraction.md`
- Template: `docs/agents/wp-out-of-scope-template.md`
- Audit tool: `bun run track oos-audit`
- Batch pick: `bun run track oos-pick`

Extract into a new `OUT-OF-SCOPE.md`, replace the in-place "Out of
scope" section in spec.md / tasks.md with a one-line pointer to the
new file, open a small PR titled `docs(wp): extract out-of-scope --
<slug>`, then resume the original work.

For projects that have not yet adopted the discipline (no
`docs/agents/wp-out-of-scope-extraction.md` in the project), skip this
step and proceed with the original work. The discipline is
airboss-specific today; other projects port it as they adopt it.
```

For `wp/ball-wp-spec/SKILL.md` specifically, add to the "Phase 4: Generate Documents" section: when generating `spec.md` for a new feature, also generate `OUT-OF-SCOPE.md` at the same time. Items the user marks "out of scope" during spec discussion go into `OUT-OF-SCOPE.md` directly (not as a one-line bullet in `spec.md`). The `spec.md` should carry a one-line pointer:

```markdown
## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
```

## Portability note

The rule lives in airboss right now and is referenced from the canonical airboss docs. Other projects (`legion-overwatch`, `airboss-firc`, etc.) should port the rule into their own CLAUDE.md and `docs/agents/` as they adopt the discipline. The airboss canonical rule + template docs are the source-of-truth that other projects reference until each project drops its own copy.

When updating each skill: write the "Before reading any WP file" section to be project-agnostic. The wording above (with the `docs/agents/wp-out-of-scope-extraction.md` reference and the "for projects that have not yet adopted" escape) is portable. Don't hard-code "airboss" into the skill text; the discipline is the thing, the canonical project just happens to be airboss today.

## What you (the agent-skills agent) should do

1. Read `~/.claude/skills/ball-wp-spec/SKILL.md`, `ball-wp-build/SKILL.md`, `ball-wp-drift/SKILL.md`, `ball-wp-coverage/SKILL.md`, `ball-wp-migrate/SKILL.md` to ground yourself.
2. Apply the "Before reading any WP file" section to each, in the right place (after worktree-safety, before main phases).
3. Add the spec-time integration to `ball-wp-spec/SKILL.md` per the section above.
4. Run a quick grep across all skills to confirm no other skill silently reads WPs.
5. Open a PR in the agent-skills repo with title: `feat(wp-skills): enforce OUT-OF-SCOPE.md extraction discipline`. Body should reference this hand-off doc by full path so the user can trace the source.
6. Notify the user when done with the PR URL.

## What you (the agent-skills agent) should NOT do

- Do not modify the airboss repo from inside the agent-skills repo. Your changes are only to skill files.
- Do not change the canonical rule wording. It lives in airboss; if it needs to change, that's a separate airboss PR. Skills reference the rule, they do not redefine it.
- Do not add a fourth Status value. The three (`Deferred` / `Rejected` / `Follow-on WP`) are the contract.
- Do not make read-touch into edit-touch. Read-touch was a deliberate choice (extraction is cheap, deferred-context loss is expensive).
