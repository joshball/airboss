---
title: 'Lesson -- load-bearing constraints vs. conservative defaults'
date: 2026-05-06
source_event: 'ADR 019 amendment 2026-05 (optional edition + drift sentinels)'
related:
  - docs/decisions/019-reference-identifier-system/decision.md
  - docs/decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md
  - docs/decisions/README.md
---

# Lesson -- load-bearing constraints vs. conservative defaults

## What happened

ADR 019 (Reference Identifier System) was ratified on 2026-04-27. Nine days later (2026-05-06), an amendment was filed relaxing one of its constraints: edition pinning, which the ADR specified as **mandatory** for every citation.

The amendment was triggered by a concrete case: 15 free-text knowledge-node citations to AFH FAA-H-8083-3B (a prior edition of the Airplane Flying Handbook). With mandatory pinning, every one of those citations had to either keep an FAA-H-8083-3B reference row alive or get manually rewritten to FAA-H-8083-3C. With *optional* pinning plus drift-sentinel checks, 14 of 15 could auto-resolve to the current edition with no manual work, and the supersedes chain would only need to back-fill the small minority that genuinely required the older edition (page-pinned, quote-pinned).

Nothing in ADR 019 was structurally wrong. The URI scheme, the registry, the lifecycle, the chain -- all still correct. What needed amending was one constraint that had been over-specified.

## Why we didn't get this right the first time

ADR 019 was authored at a moment when:

- One ingested edition existed for each handbook. No live edition transitions had been worked through; the "what does it feel like to ship a new edition?" experience was theoretical.
- Free-text citations from the FIRC era still littered the corpus. Nobody had tried to mechanically resolve those.
- The post-pivot architecture was being designed in parallel with the corpus migration. ADR 019 was both locking down a contract AND being the first system that ever tried to make citations resolvable.

In that light, mandatory pinning is a defensible first-version stance:

- It's the conservative default. "Always require a pin" is correct for the dangerous cases (page numbers, quotes, paragraph numbers after renumbering) and over-strict but safe for everything else. When you don't yet know which citations are dangerous, requiring a pin everywhere doesn't *break* anything; it just adds friction.
- It avoided the harder design problem. Drift sentinels require thinking about what the resolver looks up to detect drift, which is a per-corpus question. Mandatory pinning sidesteps that entirely.
- It mirrored academic citation conventions. Real citations in real papers always carry an edition.
- The friction the proposal eliminates was invisible at the time. We hadn't yet hit a real edition transition. We hadn't yet tried to resolve 15 free-text 3B citations. The friction is real, but you only feel it in motion.

So nothing went wrong. ADR 019 made a defensible call with the information available, and the call held up structurally. What we're amending is one constraint, because *now* we have evidence that the constraint costs more than it pays for at the chapter-and-doc level.

This is what good architecture looks like in practice: lock down the contract early enough that work can move; relax constraints later when usage reveals which ones were over-strict.

## The lesson

Three patterns to apply in future architecture decisions.

### 1. Distinguish "load-bearing constraint" from "conservative default"

Mandatory pinning was a **conservative default** -- required to be safe, but not actually load-bearing for the design's correctness. The URI scheme would have worked the same with optional pinning. The registry would have worked the same. The chain would have worked the same. The constraint was bolted on for safety, not because anything else depended on it.

When an ADR specifies a constraint, the author should be able to answer: "What in this design *fails* if this constraint is relaxed?"

- If the answer is "the resolver returns the wrong row" or "the lifecycle state machine breaks" -- that's load-bearing. Specify it strictly.
- If the answer is "nothing structural; it just gets less safe in some cases" -- that's a conservative default. Specify it AND name it as such, with a one-line note about when it might be revisited.

ADR 019 §1.3 doesn't make this distinction. It says "Mandatory" in bold and lists pin formats. A future-proof version would have said:

> Pinning is mandatory by default. This is conservative -- some locator-precision classes (doc-only, chapter-level) don't structurally require a pin and may be relaxed once we have edition-transition experience to identify which classes are safe.

That single sentence would have made this amendment a one-paragraph addition to the ADR rather than a 200-line amendment doc. More importantly, it would have *signaled to readers* that the author saw the constraint as conservative, not load-bearing -- so that when usage clarified the picture, relaxing the constraint would be a continuation of the original design intent rather than a contradiction of it.

### 2. The "annual diff job" is a smell

ADR 019 §5 describes mechanically advancing pins year over year via a hash-compare diff job that rewrites every citation when its underlying text doesn't change.

This is a good fallback. It's also a tell: the design is comfortable with the idea that every PR after every edition transition touches a lot of files mechanically. That's the moment to ask "could the design instead make most of those changes unnecessary?" -- which is exactly what drift sentinels do.

When a design includes a mechanical sweep tool to make a constraint tolerable, the constraint is probably wrong.

Sweep tools are appropriate for genuinely irreversible work:

- Renaming a column.
- Deleting a deprecated API.
- Schema migrations where the new shape genuinely differs from the old.

Sweep tools are a smell when used to absorb friction the design is creating on purpose:

- "Every citation gets re-pinned during the annual cycle, even when nothing changed."
- "Every consumer of constant X gets rewritten when X is renamed, even though X had a single semantic meaning the whole time."
- "Every file gets a header comment update when the project's name changes."

If you find yourself writing the sweep-tool spec, pause. Ask whether the design is requiring the sweep, or whether the sweep is genuinely the only way to do the work. Most of the time, a tighter constraint definition or a sentinel mechanism eliminates the need.

### 3. Walk a worked example through the current state

ADR 019 has a §12 "Worked example -- happy path" and a §13 "Worked example -- failure modes." Both walk through authoring a *new* lesson with current-edition references. Neither walks through "we have 15 free-text citations to a now-prior edition; what does the system do?"

The AFH 3B situation isn't an edge case -- it's the project's current reality. Free-text legacy was right there in `course/knowledge/`. ADR 019 didn't model it. If it had, the question "do we really need every citation to pin an edition?" would have come up at ratification, not 9 days later.

The general rule: an ADR should walk through the project's *current state* -- including its messy parts -- not just its desired-state happy path.

A "current state" worked example walks through:

- Free-text legacy data the design has to handle.
- Inconsistent naming from earlier eras.
- Half-migrated state where some content uses the new pattern and some uses the old.
- Deferred work the design depends on but hasn't shipped yet.
- Parts of the corpus authored before the design existed.

The migration story is part of the design, not a separate concern. If the design only models future-state happy paths, the migration story is missing -- and migration is where most ADRs reveal where they were over- or under-specified.

## How to apply this

`docs/decisions/README.md` now carries a self-review checklist with these three questions. Authors run their drafts through the checklist before submitting for review. Reviewers can also use it to push back on drafts.

The checklist is:

1. For each constraint: is this load-bearing for the design's correctness, or a conservative default? Name it explicitly in the ADR text.
2. Does the design include a mechanical sweep tool to absorb friction? If yes, is that friction necessary, or could the design eliminate it?
3. Does at least one worked example walk through the project's *current state*, not just future-state happy paths?

A `must`, `mandatory`, `required`, or `always` in an ADR that doesn't survive question 1 is a conservative default and should be labeled as such. A sweep tool that doesn't survive question 2 is a sign the design has an over-specified constraint somewhere upstream. A worked-example section that doesn't survive question 3 should be expanded to include the messy current state.

## Inverse: when these patterns DON'T apply

This lesson is about identifying over-specified constraints. The opposite failure mode -- under-specified constraints, leaving load-bearing behavior implicit -- is its own problem and is not what this lesson addresses. If a constraint is genuinely load-bearing (removing it breaks the design), specify it strictly and document why. The point is to know which kind of constraint each one is, not to make every constraint optional.
