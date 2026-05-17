# Retention-Bearing Callouts

| Field             | Value                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| DateTime          | 2026-05-16                                                                         |
| Branch            | worktree-agent-acdb5c4678f253479                                                   |
| Context           | Help-content callouts highlight prose but never reach the spaced-rep engine        |
| Triggering prompt | "Write a plan + triage list for the retention-bearing callouts feature"            |
| Status            | Plan -- below the work-package threshold (parser extension + validator + backfill) |

## The problem

Help content under `apps/study/src/lib/help/content/bodies/**/*.ts` uses callout markers to draw a box around prose: `:::tip`, `:::warn`, `:::note`, `:::example`. Today a callout is purely a visual treatment. The body text renders in a styled box and that is the end of it.

That is a missed pedagogy. If an author decided a sentence is worth a `:::tip` or `:::warn` box, the author has already judged that sentence to be load-bearing. The learner should retain it, not read it once and move on. But the spaced-repetition engine never sees callout content, so "highlighted-worthy" and "tested-worthy" sit at the same bar with no path between them.

The product insight: the highlight is a promise that the content matters. A promise that the content matters should be backed by a way to verify the learner kept it. Right now there is no such backing.

## The Kind-1 / Kind-2 split

Not every callout is a retention claim. The four variants divide cleanly:

| Kind   | Variants          | Role                                                       | Retention requirement            |
| ------ | ----------------- | ---------------------------------------------------------- | -------------------------------- |
| Kind-1 | `note`, `example` | Reading aids: neutral aside, worked instance               | None. Carry no card requirement. |
| Kind-2 | `tip`, `warn`     | Retention-bearing: a technique to adopt, a hazard to avoid | Must declare cards.              |

A `:::note` is a parenthetical. A `:::example` is an illustration of something already stated. Neither asserts "remember this." A `:::tip` says "adopt this technique" and a `:::warn` says "do not make this error" -- both are exactly the kind of durable, actionable knowledge a spaced-rep card exists to hold.

So Kind-2 callouts become retention-bearing: each one carries a spaced-rep card, or an explicit declaration that no card is needed. Kind-1 callouts are untouched.

## The mechanism

Phase 3 of the help-directive work (in flight in a parallel PR, see Phase A below) makes callout bodies nested-markdown-body: the text between `:::tip` and its closing `:::` is parsed as a full markdown body, not a flat string. That means a callout body can itself contain a directive.

The directive it carries is `:::cards` -- the same `:::cards` directive Phase 1 shipped, which seeds spaced-rep cards from authored card items. A Kind-2 callout body may nest exactly one `:::cards` directive.

The point is co-authoring. The author writes the takeaway box and the card it implies in the same place, at the same time. The highlight and the test live in the same lines of the same file, so they cannot drift apart. If the takeaway is later reworded, the card is right there to reword with it. There is no separate card file to forget about.

### Worked example -- a `:::warn` carrying a card

```text
:::warn
Don't pick Easy just to finish faster. FSRS reads Easy as a signal to
stretch the next interval, and you'll regret it in two weeks when the
card comes due cold and you've lost it. If it was Good, rate Good.

:::cards
- q: What does rating a card Easy tell the FSRS scheduler to do?
  a: Stretch the next interval -- Easy signals the card is over-learned.
:::
:::
```

The learner reads the hazard in the box, and the same hazard returns as a card on a spaced-rep schedule. The highlight is now retention-bearing.

### Worked example -- a `:::tip` that needs no card

```text
:::tip
Start session is the common path. Browse is for authoring or reviewing
the catalog. New scenario is for when you want to add reps to the library.

:::cards none:::
:::
```

`:::cards none:::` is the inline-closed single-line form. It is a deliberate statement by the CFI-author: "I considered a card here and there is none." Navigation orientation like the example above is genuinely not retention material. Marking it `none` makes the absence a recorded decision, not an oversight a reviewer has to second-guess.

## The enforcement

A build-time validator rule: every `:::tip` and every `:::warn` must contain exactly one `:::cards` directive, whose body is either card items or the literal token `none` (`:::cards none:::`).

- Zero `:::cards` in a Kind-2 callout -> build error.
- More than one `:::cards` in a Kind-2 callout -> build error.
- `:::cards` inside a `:::note` or `:::example` -- not required, and not an error if absent (Kind-1 carries no requirement).

The rule is switched ON only after the backfill is complete. Turning it on against the current corpus would fail the build on all 35 existing callouts at once.

This models Phase 2's lint pattern exactly. Phase 2's validator rule went green only after its content migration had been applied: the rule and the corpus it polices land in the right order, migrate the corpus first, then flip the rule. We follow the same sequence here: backfill the 35 callouts (Phase B), then switch on enforcement (Phase C).

## The phases

### Phase A -- callout directive family (dependency, in flight)

Phase 3 of the help-directive work ships the callout directive family, nested-markdown bodies for callouts, and the inline-closed `:::cards none:::` form. This is happening in a parallel PR right now (branch `feat/callout-phase3`). Phases B, C, and D of this plan depend on Phase A having merged. Nothing in this plan can start until the parser supports a `:::cards` directive nested inside a `:::tip` or `:::warn` body.

### Phase B -- the 35-callout backfill

There are 35 Kind-2 callouts in the help corpus today: 25 `:::tip` and 10 `:::warn`. Each one is triaged by Joshua or a CFI-reviewer. For each callout the reviewer either:

- writes a spaced-rep card (one or more `:::cards` items co-located in the callout body), or
- marks `:::cards none:::` with a one-line reason.

The triage worksheet is `docs/work/plans/2026-05-retention-callout-triage.md`. It enumerates all 35 callouts with their full body text and an annotation slot per entry. Any entry left unmarked at backfill time defaults to `:::cards none:::`.

### Phase C -- switch on the build enforcement

Once the corpus is clean (every Kind-2 callout carries exactly one `:::cards`), the validator rule from "The enforcement" above is switched on in the build. From that point a new `:::tip` or `:::warn` without a `:::cards` directive fails the build.

### Phase D -- author guidance doc update

Update the help-authoring guidance so new callouts follow the pattern from day one. A new `:::tip` or `:::warn` is authored with its `:::cards` (items or `none`) in the same edit. The guidance states the Kind-1 / Kind-2 split, the co-authoring rule, and the meaning of `:::cards none:::` as a deliberate decision rather than a skipped step.

## Out of scope

- Auto-generating cards from callout text. Explicitly rejected by the user. Auto-generated cards are low quality: a card the author wrote deliberately, with a real question and a real answer, is worth keeping; a card a script extracted from a sentence is not. The author writes the card.
- `:::note` and `:::example` carrying cards. Kind-1 callouts are reading aids and carry no retention requirement. Adding cards to them is not part of this plan.
- A hazard-severity ladder (`note < caution < warning < danger`). The current two-variant set (`tip`, `warn`) is sufficient. If a finer severity scale is ever wanted, that is a separate deliberate decision with its own plan, not something to fold in here.

## Open questions for Joshua

- None blocking. The mechanism (`:::cards` nested in Kind-2 bodies), the enforcement rule (exactly one `:::cards`, items or `none`), and the phase order (backfill then flip) are all decided. The only work that needs a human is the Phase B triage itself, which is what the triage worksheet is for.
