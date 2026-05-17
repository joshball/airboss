# Retention-Callout Triage

| Field             | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| DateTime          | 2026-05-16                                                                     |
| Branch            | worktree-agent-acdb5c4678f253479                                               |
| Context           | Phase B backfill worksheet for retention-bearing callouts                      |
| Triggering prompt | "Write a plan + triage list for the retention-bearing callouts feature"        |
| Companion plan    | [2026-05-retention-bearing-callouts.md](2026-05-retention-bearing-callouts.md) |

## How to use this worksheet

This is the Phase B backfill worksheet for the retention-bearing callouts plan. It enumerates every `:::tip` and `:::warn` callout in the help content: 35 total (25 tip + 10 warn).

For each entry below, mark the `Decision` slot:

- `card` -- this callout is retention material; write a spaced-rep card for it (a `:::cards` directive with question/answer items, co-located in the callout body).
- `none` -- no card needed; the callout will carry `:::cards none:::` (a recorded "considered, no card" decision).

Annotate inline after the `--`. Any entry left unmarked at backfill time defaults to `:::cards none:::`.

Total entries: 35.

## apps/study/src/lib/help/content/bodies/concepts/active-recall.ts

### 1. `tip` at line 58

File: `apps/study/src/lib/help/content/bodies/concepts/active-recall.ts` (opener line 58)

Body:

> **Cards.** Question shown, answer hidden. You produce the answer (aloud, in your head, or on paper), then reveal and rate. The rate step _is_ the calibration signal -- see [[calibration::concept-calibration]].

Decision: [ ] card  [ ] none  -- 

### 2. `tip` at line 62

File: `apps/study/src/lib/help/content/bodies/concepts/active-recall.ts` (opener line 62)

Body:

> **Reps.** A [scenario](/help/reps-session) poses a decision. You pick _before_ seeing the outcome. No peeking, no "what would you do if" -- commit, then see.

Decision: [ ] card  [ ] none  -- 

### 3. `tip` at line 66

File: `apps/study/src/lib/help/content/bodies/concepts/active-recall.ts` (opener line 66)

Body:

> **Knowledge nodes.** Discovery-first pedagogy: the page leads with a question or situation, lets you reason toward the answer, _then_ reveals the regulation as confirmation. This applies active recall to the learning phase, not just review.

Decision: [ ] card  [ ] none  -- 

### 4. `warn` at line 70

File: `apps/study/src/lib/help/content/bodies/concepts/active-recall.ts` (opener line 70)

Body:

> **Anti-patterns we actively avoid.** We don't show an answer next to a question. We don't let you "skip to the outcome" on a rep scenario. We don't lead knowledge nodes with "Per 14 CFR 91.109..." -- that's passive review pretending to be teaching.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/adm-srm.ts

### 5. `tip` at line 21

File: `apps/study/src/lib/help/content/bodies/concepts/adm-srm.ts` (opener line 21)

Body:

> ADM and SRM are the reason [[calibration::concept-calibration]] exists in airboss. A well-calibrated pilot makes better PAVE and 5P checks. A poorly-calibrated pilot talks themselves into decisions the data wouldn't support.

Decision: [ ] card  [ ] none  -- 

### 6. `tip` at line 82

File: `apps/study/src/lib/help/content/bodies/concepts/adm-srm.ts` (opener line 82)

Body:

> **Reps.** Scenario-based decision-making items directly exercise DECIDE. The scenario poses a situation, you choose an action, then see the outcome. Getting outcomes wrong (and being honest about your confidence when you committed) is how you build the metacognitive loop the framework depends on.

Decision: [ ] card  [ ] none  -- 

### 7. `tip` at line 86

File: `apps/study/src/lib/help/content/bodies/concepts/adm-srm.ts` (opener line 86)

Body:

> **Calibration.** The confidence-rating system is ADM in miniature. Every review where you say "I'm sure" and you're wrong is a small data point about overconfidence. Over a few hundred reviews, the Brier score gives you an objective measure of something the FAA has asked pilots to measure subjectively for decades. See [[calibration::concept-calibration]].

Decision: [ ] card  [ ] none  -- 

### 8. `warn` at line 90

File: `apps/study/src/lib/help/content/bodies/concepts/adm-srm.ts` (opener line 90)

Body:

> What airboss _doesn't_ do: substitute for scenario-based training with an instructor. ADM at the desk builds the framework; ADM in the airplane -- diversions, holds, partial-panel approaches under the hood -- proves the framework. Both are needed.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/calibration.ts

### 9. `tip` at line 71

File: `apps/study/src/lib/help/content/bodies/concepts/calibration.ts` (opener line 71)

Body:

> **Flying.** Every risk-management framework the FAA teaches (PAVE, 5P, 3P, DECIDE) relies on the pilot's ability to assess their own limits. A pilot who trains calibration at the desk gets a more accurate internal barometer at the hold-short line.

Decision: [ ] card  [ ] none  -- 

### 10. `tip` at line 75

File: `apps/study/src/lib/help/content/bodies/concepts/calibration.ts` (opener line 75)

Body:

> **Checkride orals.** Examiners watch how you handle questions at the edge of your knowledge. A candidate who says "I don't know, I'd look that up in [X]" is calibrated and passes. One who confabulates fails.

Decision: [ ] card  [ ] none  -- 

### 11. `warn` at line 79

File: `apps/study/src/lib/help/content/bodies/concepts/calibration.ts` (opener line 79)

Body:

> **The trap is skipping the confidence prompt.** Skipping preserves speed; it also burns the signal that trains you. The prompt appears on a deterministic ~50% of reviews (see [[memory review::memory-review]]). Rate honestly, including 1s when you genuinely don't know.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/desirable-difficulty.ts

### 12. `tip` at line 51

File: `apps/study/src/lib/help/content/bodies/concepts/desirable-difficulty.ts` (opener line 51)

Body:

> If a session doesn't force at least some wrong answers, the [[scheduler::concept-fsrs]] has nothing to calibrate against. Aim for roughly 15-20% Again ratings. That's the sweet spot for desirable difficulty.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/fsrs.ts

### 13. `tip` at line 21

File: `apps/study/src/lib/help/content/bodies/concepts/fsrs.ts` (opener line 21)

Body:

> You don't need to know the math to use the scheduler. You do need to rate honestly. "Good" when you forgot corrupts the model for that card for weeks.

Decision: [ ] card  [ ] none  -- 

### 14. `tip` at line 120

File: `apps/study/src/lib/help/content/bodies/concepts/fsrs.ts` (opener line 120)

Body:

> 1. **Rate what happened, not what you wish happened.** Again is not a failure -- the scheduler _needs_ to see forgetting to estimate stability. Forcing Good when you forgot teaches the model a lie.
> 2. **Don't chase intervals.** If the scheduler brings a card back in 2 days and you think it should be 2 weeks, it has more data than you do. Let it run.
> 3. **Calibration feeds the model, not the scheduler.** Your confidence rating doesn't change FSRS. It feeds [[calibration::concept-calibration]], a separate system.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/interleaving.ts

### 15. `tip` at line 60

File: `apps/study/src/lib/help/content/bodies/concepts/interleaving.ts` (opener line 60)

Body:

> If a session feels jarring because a weather card lands right after a performance card, that's interleaving doing its job. Don't seek out blocked decks to "get comfortable" with a topic -- comfort is not the goal; retention at the checkride is.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/knowledge-graph.ts

### 16. `tip` at line 38

File: `apps/study/src/lib/help/content/bodies/concepts/knowledge-graph.ts` (opener line 38)

Body:

> Discovery-first pedagogy applies at the teach-node level. Topic nodes present the concept directly; teach nodes lead with a situation or question and let the learner reason toward the same concept. See [ADR 011](/knowledge) for the full principle.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/proficiency-currency.ts

### 17. `warn` at line 21

File: `apps/study/src/lib/help/content/bodies/concepts/proficiency-currency.ts` (opener line 21)

Body:

> You can be current and not proficient. It is legal. It is also how pilots get hurt.

Decision: [ ] card  [ ] none  -- 

### 18. `tip` at line 64

File: `apps/study/src/lib/help/content/bodies/concepts/proficiency-currency.ts` (opener line 64)

Body:

> **Knowledge proficiency.** The scheduler keeps you sharp on regulations, procedures, and systems whether or not your next flight review is coming up. A current pilot with unused knowledge is a pilot who will fumble a question from ATC.

Decision: [ ] card  [ ] none  -- 

### 19. `tip` at line 68

File: `apps/study/src/lib/help/content/bodies/concepts/proficiency-currency.ts` (opener line 68)

Body:

> **Decision proficiency.** Reps are scenario-based; they exercise ADM/SRM without needing a logbook entry. A pilot who can't talk through a partial-panel diversion at the kitchen table won't do better with the real thing at 6,000 feet and the alternator light on.

Decision: [ ] card  [ ] none  -- 

### 20. `warn` at line 72

File: `apps/study/src/lib/help/content/bodies/concepts/proficiency-currency.ts` (opener line 72)

Body:

> **What airboss doesn't do.** Track your 90-day currency or the calendar for your flight review. Those are logbook responsibilities and software that specializes in them does them better. airboss is the study side of the house -- it assumes you're handling the currency side somewhere else.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/session-slices.ts

### 21. `tip` at line 63

File: `apps/study/src/lib/help/content/bodies/concepts/session-slices.ts` (opener line 63)

Body:

> Relearning cards always rank first in Strengthen. The scheduler's prediction is that a missed card becomes trustworthy again only after a few short-interval hits.

Decision: [ ] card  [ ] none  -- 

### 22. `warn` at line 84

File: `apps/study/src/lib/help/content/bodies/concepts/session-slices.ts` (opener line 84)

Body:

> Expand is capped because learning new material while due reviews pile up is how you end up buried. The engine refuses to expand when Strengthen is above a threshold count.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/concepts/spaced-rep.ts

### 23. `warn` at line 64

File: `apps/study/src/lib/help/content/bodies/concepts/spaced-rep.ts` (opener line 64)

Body:

> **We don't replace judgment with the queue either.** If you just returned from a 6-month break, rating honestly will show catastrophic stability collapse on most cards. That's the scheduler doing its job -- it's the truth about your memory. Re-learn them. Don't rate Good to make the numbers look better.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/memory-card.ts

### 24. `tip` at line 52

File: `apps/study/src/lib/help/content/bodies/memory-card.ts` (opener line 52)

Body:

> Prefer Suspend or Archive to deleting. Deletion drops the card and its entire review history, which means you lose the scheduler's model and can't recover it.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/memory-dashboard.ts

### 25. `tip` at line 33

File: `apps/study/src/lib/help/content/bodies/memory-dashboard.ts` (opener line 33)

Body:

> Due now > 0 is the signal to run the review queue. Let the scheduler pick the cards; adding new cards when the backlog is deep just inflates tomorrow's load. See [[FSRS::concept-fsrs]] for how due dates are chosen.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/memory-new.ts

### 26. `tip` at line 19

File: `apps/study/src/lib/help/content/bodies/memory-new.ts` (opener line 19)

Body:

> If the back of a card has a comma, an "and," or a numbered list longer than three items, split it. Two narrow cards always beat one wide card. You'll review them faster, rate them more accurately, and the scheduler will converge on the right interval for each.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/memory-review.ts

### 27. `tip` at line 21

File: `apps/study/src/lib/help/content/bodies/memory-review.ts` (opener line 21)

Body:

> Review a few cards a day; consistency beats cramming. Ten minutes every morning will push your due queue farther out and make each session shorter than one 90-minute marathon per week ever will.

Decision: [ ] card  [ ] none  -- 

### 28. `warn` at line 93

File: `apps/study/src/lib/help/content/bodies/memory-review.ts` (opener line 93)

Body:

> Don't pick Easy just to finish faster. FSRS reads Easy as a signal to stretch the next interval, and you'll regret it in two weeks when the card comes due cold and you've lost it. If it was Good, rate Good.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/reps-browse.ts

### 29. `tip` at line 40

File: `apps/study/src/lib/help/content/bodies/reps-browse.ts` (opener line 40)

Body:

> Filters compose via URL params. Share a filtered URL to show someone a specific slice of the catalog - all state is in the querystring.

Decision: [ ] card  [ ] none  -- 

### 30. `warn` at line 62

File: `apps/study/src/lib/help/content/bodies/reps-browse.ts` (opener line 62)

Body:

> Clicking Reset (clear filters) goes back to page 1. Pagination state does not survive a filter change because the result set changes size.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/reps-new.ts

### 31. `tip` at line 19

File: `apps/study/src/lib/help/content/bodies/reps-new.ts` (opener line 19)

Body:

> Pick a moment from a real flight (yours or one you read about) where the right call was not obvious at the time. The friction is the learning.

Decision: [ ] card  [ ] none  -- 

### 32. `warn` at line 68

File: `apps/study/src/lib/help/content/bodies/reps-new.ts` (opener line 68)

Body:

> The "correct" option is randomised by the session shuffle, so do not put A as the correct answer pattern-wise. The app handles positional cues, but you writing "obviously A, always A" is a giveaway in the text itself.

Decision: [ ] card  [ ] none  -- 

### 33. `tip` at line 97

File: `apps/study/src/lib/help/content/bodies/reps-new.ts` (opener line 97)

Body:

> Scenarios start in Active status by default. To hold one back for editing, switch status to Draft on the next edit pass - drafts do not enter session selection.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/reps.ts

### 34. `tip` at line 42

File: `apps/study/src/lib/help/content/bodies/reps.ts` (opener line 42)

Body:

> Start session is the common path. Browse is for authoring or reviewing the catalog. New scenario is for when you want to add reps to the library.

Decision: [ ] card  [ ] none  -- 

## apps/study/src/lib/help/content/bodies/session-start.ts

### 35. `tip` at line 19

File: `apps/study/src/lib/help/content/bodies/session-start.ts` (opener line 19)

Body:

> Hover any \`?\` icon on \`/session/start\` for a short definition. Click it to pin the popover, or press Enter while focused to open it from the keyboard. "Learn more" jumps you back to the relevant section of this page or the matching concept page.

Decision: [ ] card  [ ] none  -- 
