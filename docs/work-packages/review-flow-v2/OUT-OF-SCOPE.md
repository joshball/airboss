---
title: 'Out of Scope: Review Flow v2'
product: study
feature: review-flow-v2
type: out-of-scope
status: unread
---

# Out of Scope: Review Flow v2

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                            | Status       | Trigger to revisit                                                  |
| ------------------------------- | ------------ | ------------------------------------------------------------------- |
| Jump-to-card dropdown (item 15) | Follow-on WP | When sessions have URL identity (see `review-sessions-url`)         |
| "Wild Guess" confidence label   | Deferred     | Next copy / labels pass on the review screen                        |
| Schema change on review path    | Rejected     | Never -- see detail below                                           |
| Snooze / flag affordances       | Follow-on WP | Tracked in `snooze-and-flag`; this WP only reserves the chrome slot |

## Jump-to-card dropdown (item 15)

Status: Follow-on WP

What was deferred:
Turning the `Card 1 of 12` counter into a dropdown that lets the user jump to an arbitrary card in the current run. SMI walkthrough item 15.

Why:
Resume / redo / jump behavior belongs in the `review-sessions-url` work package. Jumping around a live session also muddies the FSRS schedule (peeks vs. ordered traversal), and the product decision about whether jumps count as peeks needs to be made alongside session URL identity, not in isolation. Per the verdict pass, this shipped via PR #169 once the URL substrate landed.

Trigger to revisit:
When `review-sessions-url` lands its (a) Resume layer so sessions have stable identity. At that point, decide whether jumps are allowed and whether they count as peeks before wiring the dropdown.

Implementation pattern when triggered:
Follow the chrome pattern in `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte` (the session-aware review route). The shipped jump-to-card dropdown in PR #169 is the working precedent.

References:

- `docs/work-packages/review-flow-v2/spec.md` "Out of scope"
- `docs/work-packages/review-sessions-url/spec.md` Out of scope section that mirrors this deferral
- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 15
- PR #169 (jump-to-card dropdown + "No idea" confidence label)

## "Wild Guess" confidence label

Status: Deferred

What was deferred:
Revisiting the "Wild Guess" confidence label (SMI walkthrough item 16). The user partially retracted the suggestion during the walkthrough, so the change was not locked.

Why:
Copy decisions on confidence labels are downstream of the overall review chrome shape. With the new two-line chicklets and adjust-on-reveal path shipped, the label question is a pure micro-copy revision and not worth blocking the chrome rewrite over.

Trigger to revisit:
Next copy / labels pass on the review screen, or fresh SMI walkthrough feedback that re-raises item 16.

Implementation pattern when triggered:
Update the confidence label constants alongside `REVIEW_RATING_LABELS` at `libs/constants/src/study.ts:279`. Confidence labels are already token-driven through the same constants module, so the change is a one-line edit plus tests.

References:

- `docs/work-packages/review-flow-v2/spec.md` "Out of scope"
- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 16
- `libs/constants/src/study.ts` `REVIEW_RATING_LABELS`

## Schema change on review path

Status: Rejected

What was rejected:
Any schema change as part of the v2 review chrome rewrite. The spec is explicit: "This is pure UI + one constants addition."

Why:
The chrome rewrite is presentation-only. Adding a column or table here would expand scope past the user-visible goal (make confidence / rating / undo feel first-class) and would require an unrelated round of schema review. The single confidence column on `study.review` already supports both question-screen entry and reveal-screen adjust, with only the final value retained.

Trigger to revisit:
Never -- see detail above. A future review change that genuinely needs new data (for example, retaining the intermediate confidence value, or tracking adjust-on-reveal frequency) should open its own WP with explicit schema scope.

References:

- `docs/work-packages/review-flow-v2/spec.md` "Out of scope" and "Data model"
- `libs/constants/src/study.ts` `REVIEW_RATING_LABELS`

## Snooze / flag affordances

Status: Follow-on WP

What was deferred:
The actual Snooze button, the reason popover, the per-card content feedback pills, and the replacement flow. This WP leaves the "Snooze" slot empty in chrome but defers the substrate.

Why:
Snooze / flag is a multi-table, BC-touching feature with its own product decisions (typed reasons, durations, mid-session replacement policy). Bundling it into a chrome rewrite would mix presentation work with schema and BC work and make either piece harder to review. The `snooze-and-flag` WP exists specifically to land the substrate.

Trigger to revisit:
Already triggered. The follow-on lives at `docs/work-packages/snooze-and-flag/` and shipped per its verdict pass.

Implementation pattern when triggered:
Follow `docs/work-packages/snooze-and-flag/spec.md`. The shipped popover lives at `libs/ui/src/components/SnoozeReasonPopover.svelte`; constants at `libs/constants/src/study.ts` (`SNOOZE_REASONS`, `SNOOZE_DURATION_LEVEL_VALUES`, `CARD_FEEDBACK_SIGNAL_VALUES`).

References:

- `docs/work-packages/review-flow-v2/spec.md` "Out of scope"
- `docs/work-packages/snooze-and-flag/spec.md`
- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` items 10, 11
