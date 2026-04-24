---
title: 'review-flow-v2'
status: draft
size: small
depends_on: [help-system Wave 1 merged]
created: 2026-04-24
---

# Review Flow v2

## One-sentence summary

Overhaul the memory review screen so confidence, rating, and undo all feel like first-class affordances instead of keyboard-only power-user gestures.

## Why

SMI walkthrough items 7, 8, 9, 12, 13, 16 all point at the same root cause: the review screen was built keyboard-first and the visual layer lags behind. Confidence looks like a prompt, rating buttons hide their scheduling consequence, and the undo toast shifts layout. Net effect is the review session feels mechanical rather than deliberate.

Source items: `docs/work/todos/20260424-02-smi-walkthrough-feedback.md` items 7, 8, 9, 12, 13, 16.

## In scope

- Question screen: render confidence buttons as clickable 1-5 chicklets on the question card itself (not as a post-space interstitial). Space key skips confidence. Keyboard 1-5 still works.
- Reveal screen: let the user adjust the confidence they entered on the question screen if it felt wrong once they saw the answer.
- Rating buttons: two-line chicklets. Top line is the label from `REVIEW_RATING_LABELS` (`Wrong / Hard / Right / Easy`). Bottom line is the next-review interval ("show again in 10 min", "show again in 3d", etc.). Labels come from a new constant in `libs/constants/src/study.ts` so copy is never inline.
- Undo toast: reposition below the card, longer visible timeout, fade in/out with no layout shift.
- Replace the bare `?` after "Card 1 of 12" with a recognizable help chicklet (coordinates with help-system Wave 1/PageHelp tokens, which already ship the chicklet primitive).

## Out of scope

- `Card 1 of 12` as a dropdown-to-jump. Item 15 is deferred; resume/redo behavior belongs in `review-sessions-url`, and jumping around a live session muddies the FSRS schedule. Revisit after sessions have URL identity.
- Revisit of "Wild Guess" confidence label (item 16). User half-retracted the suggestion; leave for a later copy pass.
- Any schema change. This is pure UI + one constants addition.
- Snooze/flag affordances. They live in `snooze-and-flag`. This WP leaves the "Snooze" slot empty in chrome and defers the actual button.

## Product decisions the user needs to make

1. **Confidence placement**

   - Options: question screen (inline)/post-space interstitial/reveal screen.
   - Recommendation: question screen (inline), per user's decision in the walkthrough. Encode and move on.
   - Affects: review route component layout, keyboard handler map.

2. **Confidence-adjust on reveal**

   - Options: show current confidence value read-only on reveal/let the user change it on reveal/drop the second pass.
   - Recommendation: allow change on reveal. User explicitly asked for "go back/adjust on the next page if they got their confidence wrong." Store only the final value; do not retain intermediate.
   - Affects: reveal component, review write path (single confidence column on `study.review`; no schema change).

3. **Rating interval copy**

   - Options: relative ("in 3d")/absolute ("Apr 27")/both.
   - Recommendation: relative on the button, absolute in a tooltip on hover. Keeps the chicklet compact; power users who want the exact date can hover.
   - Affects: new constant shape + formatter in `libs/bc/study`.

4. **Undo scope**

   - Options: undo reverts last rating only/undo reverts rating and confidence/undo is a short window (5s) vs long (15s).
   - Recommendation: undo reverts the last card's rating + confidence together, 10-second window, fade out. Rationale: the two are a single mental action.
   - Affects: undo toast component, review BC `undoLastReview` path.

5. **Help-chicklet placement in review header**

   - Options: single chicklet next to "Card 1 of 12"/chicklet on every labeled element (card counter, domain tag, confidence strip, rating strip).
   - Recommendation: single chicklet near the counter that opens a keyboard-reference panel; inline PageHelp tokens on domain tag, confidence strip, rating strip so they can be targeted by tooltip coverage in Wave 2 of the help system.
   - Affects: review route header chrome.

## Data model

No schema changes. One constants addition:

```typescript
// libs/constants/src/study.ts
export const REVIEW_RATING_LABELS = {
  [REVIEW_RATINGS.AGAIN]: 'Wrong',
  [REVIEW_RATINGS.HARD]: 'Hard',
  [REVIEW_RATINGS.GOOD]: 'Right',
  [REVIEW_RATINGS.EASY]: 'Easy',
} as const;
```

## UI sketch

Route: `/memory/review` (existing).

Question screen:

```text
+----------------------------------------------+
| Card 3 of 12    [?]   Airspace               |
+----------------------------------------------+
|                                              |
|   91.155(b)(2) traffic-pattern exception:    |
|   what does it allow and where?              |
|                                              |
+----------------------------------------------+
|  Confidence:  [1] [2] [3] [4] [5]   skip␣    |
+----------------------------------------------+
|                  [ Show answer ]             |
+----------------------------------------------+
```

Reveal screen:

```text
+----------------------------------------------+
| Card 3 of 12    [?]   Airspace               |
+----------------------------------------------+
|  Front: ...                                   |
|  Back: ...                                    |
+----------------------------------------------+
|  Confidence was: [3]   (click to adjust)     |
+----------------------------------------------+
|  [ Wrong   ] [ Hard   ] [ Right  ] [ Easy  ] |
|  [ <10min  ] [ 1d     ] [ 3d     ] [ 6d    ] |
+----------------------------------------------+

(undo toast, below card, after a rating)
   Rated Right.  undo                 [fade]
```

## Open questions (non-blocking)

- Exact format of the interval bottom-line when it's less than an hour: `<10 min` or `10m` or `in ~10 min`. Pick at build time.
- Whether the confidence "adjust" on reveal should restyle the original chicklets or show a disabled-looking pill with an edit affordance. UX call at build time.

## Build sequencing notes

All changes land together. Internal order inside the PR:

1. Add `REVIEW_RATING_LABELS` constant + interval formatter helper.
2. Rewrite review route to render the new chrome (confidence chicklets, rating two-line buttons, help chicklet placement).
3. Rewrite the undo toast.
4. Reconnect the reveal screen's confidence-adjust path.

## References

- `docs/work/todos/20260424-02-smi-walkthrough-feedback.md` items 7, 8, 9, 12, 13, 16
- `docs/work/handoffs/20260424-session-state-smi-walkthrough.md` work package scope summaries
- `docs/work-packages/spaced-memory-items/spec.md` existing review flow baseline
- `libs/constants/src/study.ts` existing `REVIEW_RATINGS` constant
- `docs/work/handoffs/20260424-help-system-fix-pass.md` help chicklet primitive shipped in Wave 1
