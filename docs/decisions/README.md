# Architecture decisions

This directory holds Architecture Decision Records (ADRs) for airboss. ADRs are numbered, dated, and immutable once accepted. Amendments live next to the ADR they amend (`NNN-topic/amendment-YYYY-MM-<slug>.md`) and update without rewriting the ratified document.

See [docs/agents/best-practices.md](../agents/best-practices.md) for code-level patterns. ADRs are for decisions; patterns are for how to apply them.

## Lessons captured from past ADRs

Cross-cutting lessons learned from how prior ADRs aged in practice:

- [lessons/2026-05-load-bearing-vs-conservative-defaults.md](lessons/2026-05-load-bearing-vs-conservative-defaults.md) -- Distinguish constraints that are load-bearing (the design fails without them) from conservative defaults (the design just gets less safe). Failing to label this in ADR 019 led to a 9-days-later amendment.

## Self-review checklist

Before submitting an ADR for ratification, walk through these three questions. They are the distilled lessons from past ADRs that aged poorly. Answer each in the ADR itself (in a §"Self-review" section or inline) so reviewers can see the author's thinking.

### 1. For each constraint: is it load-bearing or a conservative default?

A **load-bearing constraint** is one the design's correctness depends on. Removing it breaks resolution, breaks the lifecycle, breaks the contract.

A **conservative default** is one that's safer than necessary -- it covers the dangerous cases AND a long tail of harmless ones. Removing it makes some specific case riskier; it doesn't break the design.

For each `must`, `mandatory`, `required`, or `always` in the ADR, ask: "What in this design *fails* if this constraint is relaxed?" If the answer is "nothing structural; it just gets less safe in some cases," label the constraint as a conservative default in the ADR text, with a one-line note about when it might be revisited (e.g., "revisit per X class once we have Y experience"). That single sentence turns a future amendment into a small note rather than a re-litigation of the original decision.

### 2. Does the design include a mechanical sweep tool to absorb friction?

A **sweep tool** is one whose job is "rewrite a lot of files mechanically because the design forces them to be touched." Annual diff jobs, mass migration scripts, codemods that touch every consumer of a constant.

Sweep tools are appropriate for genuinely irreversible work: renaming a column, deleting a column, schema migrations, breaking API changes. They are a smell when the friction they absorb is friction the design is creating on purpose.

If the design includes a sweep tool, ask: "Could the design instead make most of those changes unnecessary?" Often the answer is yes -- some constraint can be relaxed (per question 1), or some sentinel can detect when a sweep is genuinely needed vs. when it's no-op churn.

### 3. Does at least one worked example walk through the project's current state?

A "happy path" worked example walks through how the design works for *new* content authored against the design.

A "current state" worked example walks through how the design handles the project's *messy parts*: free-text legacy data, inconsistent naming from earlier eras, the half-migrated state, the deferred work, the parts authored before the design existed.

The current state IS the design's first user. If the design only models future-state happy paths, the migration story is missing -- and migration is where most ADRs reveal where they were over- or under-specified.

## ADR conventions

- **Numbered.** Three-digit prefix, gapless after ADR 003 (003 was retired; numbering continues from 004).
- **Single file or directory.** Simple decisions are `NNN-topic.md`. Complex decisions with context, multiple revisions, and review notes use `NNN-topic/` with `decision.md`, `context.md`, optionally `revisit.md`, and inline review files.
- **Status field.** `proposed`, `accepted`, `superseded`, `archived`.
- **Amendments live next to the ADR.** `NNN-topic/amendment-YYYY-MM-<slug>.md`. Don't rewrite the ratified document; record the change.
- **Date format.** `YYYY-MM-DD`. Always absolute, never relative.

## Process

1. Author drafts an ADR. Runs through the self-review checklist above.
2. Tag `status: proposed`.
3. Walk it with the user (or designated reviewer). Iterate.
4. When ratified, change to `status: accepted`. Don't edit body content after this point; use amendments.
5. If superseded by a later decision, change to `status: superseded` and link forward.
