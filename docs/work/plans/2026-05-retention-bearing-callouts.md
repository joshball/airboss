# Retention-Bearing Callouts

| Field             | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| DateTime          | 2026-05-16                                                                          |
| Branch            | main                                                                                |
| Context           | Callouts in study content should be retention-bearing; help-content callouts exempt |
| Triggering prompt | "Write a plan for the retention-bearing callouts feature" (revised after scope fix) |
| Status            | Plan -- below the work-package threshold (parser extension + validator rule)        |

## Scope correction (2026-05-16)

An earlier draft of this plan treated every callout in the repo as a
retention candidate and shipped a 35-callout triage worksheet. That was
wrong. All 35 of those callouts live in `apps/study/src/lib/help/` -- the
`/help/*` pages that explain how airboss itself works (active recall,
FSRS, calibration, what a rep is). They are tool guidance, not aviation
study material. A `:::tip` on the `/help/active-recall` page advising
"rate honestly" is UI guidance; the learner is never quizzed on it, and a
card for it would be absurd.

The retention idea is sound, but it applies to **study content** -- the
knowledge nodes under `course/knowledge/**` -- never to help content.
The triage worksheet has been deleted. The plan below is scoped
correctly: the requirement covers callouts in study content only, and
`course/knowledge/**` has zero callouts today.

## The problem

Knowledge node content under `course/knowledge/**/node.md` will, as it
grows, use callout markers to draw a box around prose: `:::tip`,
`:::warn`, `:::note`, `:::example`. A callout is purely a visual
treatment -- the body renders in a styled box and that is the end of it.

That is a missed pedagogy. If an author decided an aviation fact is worth
a `:::tip` or `:::warn` box inside a lesson, the author has already
judged that fact load-bearing. "Lean the mixture above 3000 ft." "Do not
skid the base-to-final turn." The learner should retain it, not read it
once and move on. But the spaced-repetition engine never sees callout
content, so "highlighted-worthy" and "tested-worthy" sit at the same bar
with no path between them.

The product insight: inside study content, the highlight is a promise
that the fact matters. A promise that the fact matters should be backed
by a way to verify the learner kept it.

## Help content is exempt

The requirement in this plan applies only to callouts inside
`course/knowledge/**`. Callouts in `apps/study/src/lib/help/` carry no
card requirement, ever. Help content teaches the tool, not aviation; its
callouts are interface guidance. The build validator scopes the rule by
file path: a `:::tip` under `course/knowledge/` is subject to the rule, a
`:::tip` under `apps/study/src/lib/help/` is not.

## The Kind-1 / Kind-2 split

Within study content, not every callout is a retention claim. The four
variants divide cleanly:

| Kind   | Variants          | Role                                                       | Retention requirement            |
| ------ | ----------------- | ---------------------------------------------------------- | -------------------------------- |
| Kind-1 | `note`, `example` | Reading aids: neutral aside, worked instance               | None. Carry no card requirement. |
| Kind-2 | `tip`, `warn`     | Retention-bearing: a technique to adopt, a hazard to avoid | Must declare cards.              |

A `:::note` is a parenthetical. A `:::example` is an illustration of
something already stated. Neither asserts "remember this." A `:::tip`
says "adopt this technique" and a `:::warn` says "do not make this
error" -- both are exactly the kind of durable, actionable knowledge a
spaced-rep card exists to hold.

So Kind-2 callouts in study content become retention-bearing: each one
carries a spaced-rep card, or an explicit declaration that no card is
needed. Kind-1 callouts, and all help-content callouts, are untouched.

## The mechanism

Phase 3 of the directive work (shipped, PR #1016) made callout bodies
nested-markdown-body: the text between `:::tip` and its closing `:::` is
parsed as a full markdown body, not a flat string. That means a callout
body can itself contain a directive.

The directive it carries is `:::cards` -- the same `:::cards` directive
Phase 1 shipped, which seeds spaced-rep cards from authored card items. A
Kind-2 study-content callout body may nest exactly one `:::cards`
directive.

The point is co-authoring. The author writes the takeaway box and the
card it implies in the same place, at the same time. The highlight and
the test live in the same lines of the same file, so they cannot drift
apart. If the takeaway is later reworded, the card is right there to
reword with it. There is no separate card file to forget about.

### Worked example -- a `:::warn` carrying a card

```text
:::warn
Do not skid the base-to-final turn. A skidding stall breaks toward the
inside of the turn, and at pattern altitude there is no room to recover.

:::cards
- q: Why is a skidding stall on the base-to-final turn especially dangerous?
  a: It breaks toward the inside of the turn, with no altitude to recover.
:::
:::
```

The learner reads the hazard in the box, and the same hazard returns as a
card on a spaced-rep schedule. The highlight is now retention-bearing.

### Worked example -- a `:::tip` that needs no card

```text
:::tip
The throttle friction lock keeps the throttle from creeping during cruise.

:::cards none:::
:::
```

`:::cards none:::` is the inline-closed single-line form (shipped in
PR #1016). It is a deliberate statement by the CFI-author: "I considered
a card here and there is none." Marking it `none` makes the absence a
recorded decision, not an oversight a reviewer has to second-guess.

## The enforcement

A build-time validator rule, scoped to `course/knowledge/**`: every
`:::tip` and every `:::warn` in study content must contain exactly one
`:::cards` directive, whose body is either card items or the literal
token `none` (`:::cards none:::`).

- Zero `:::cards` in a study-content Kind-2 callout -> build error.
- More than one `:::cards` in a study-content Kind-2 callout -> build error.
- `:::cards` inside a `:::note` or `:::example` -- not required, not an error if absent.
- Any callout under `apps/study/src/lib/help/` -- the rule does not apply.

Because `course/knowledge/**` has zero callouts today, there is nothing
to backfill. The rule can be switched on immediately: it constrains only
future authoring. The first time an author writes a `:::tip` inside a
knowledge node, the requirement applies from that edit. No migration, no
corpus cleanup, no phased flip.

This is a better position than the earlier draft assumed. The earlier
draft expected a 35-callout backfill before the rule could go green; the
scope correction removes the backfill entirely.

## The phases

### Phase A -- callout directive family (dependency, shipped)

Phase 3 of the directive work shipped the callout directive family,
nested-markdown bodies for callouts, and the inline-closed
`:::cards none:::` form (PR #1016, merged). Phase A is complete.

### Phase B -- the path-scoped enforcement rule

Add the build-time validator rule above, scoped to `course/knowledge/**`.
A `:::tip` or `:::warn` in a knowledge node without exactly one `:::cards`
directive fails the build. Help content is excluded by path. This is a
small validator addition; no content changes accompany it because the
study corpus has no callouts yet.

### Phase C -- author guidance doc update

Update the knowledge-authoring guidance so new study-content callouts
follow the pattern from day one. A new `:::tip` or `:::warn` in a
knowledge node is authored with its `:::cards` (items or `none`) in the
same edit. The guidance states the Kind-1 / Kind-2 split, the
co-authoring rule, the help-content exemption, and the meaning of
`:::cards none:::` as a deliberate decision rather than a skipped step.

## Out of scope

- Help-content callouts. They carry no card requirement. Help teaches the tool, not aviation.
- Auto-generating cards from callout text. Explicitly rejected by the user. Auto-generated cards are low quality: a card the author wrote deliberately, with a real question and a real answer, is worth keeping; a card a script extracted from a sentence is not. The author writes the card.
- `:::note` and `:::example` carrying cards. Kind-1 callouts are reading aids and carry no retention requirement.
- A hazard-severity ladder (`note < caution < warning < danger`). The current two-variant set (`tip`, `warn`) is sufficient. If a finer severity scale is ever wanted, that is a separate deliberate decision with its own plan.

## Open questions for Joshua

- None blocking. The mechanism (`:::cards` nested in Kind-2 bodies), the path-scoped enforcement rule, and the help-content exemption are all decided. Because the study corpus has no callouts yet, there is no triage work for a human -- the rule simply constrains future authoring.
