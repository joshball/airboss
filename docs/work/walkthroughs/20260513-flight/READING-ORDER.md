# Flight Reading Order -- 2026-05-13

A ten-hour offline reading plan for the airboss walkthroughs in this directory.

You wrote every line. This is re-orientation, not introduction. The plan paces seven docs across ~7 hours of focused reading, leaves time for napping, meals, and code-side exploration in your editor, and gives you a clean stopping point if turbulence eats an hour.

## At a glance

```text
H+0:00   Settle, open editor, set offline mode                15 min
H+0:15   00-architecture-tour                                  90 min
H+1:45   Stretch, water                                        15 min
H+2:00   01-cert-dashboard                                     45 min
H+2:45   02-lens-ui                                            45 min
H+3:30   Meal / nap                                            60 min
H+4:30   03-goal-composer                                      45 min
H+5:15   04-course-tree-arbitrary-depth                        60 min
H+6:15   Walk the cabin, water                                 15 min
H+6:30   05-wx-engine                                          90 min
H+8:00   Break                                                 30 min
H+8:30   06-command-palette                                    75 min
H+9:45   Buffer / open editor and trace what's still fuzzy     15 min
H+10:00  Land
```

## What each doc gives you

| #   | Doc                                                                    | Read time | Why this order                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | [00 -- architecture tour](00-architecture-tour.md)                     | 90 min    | First. Reseats the mental model: monorepo shape, BC two-barrel split, browser-bundling rules, ADRs, scripts, work packages. Everything after assumes you have this loaded.                                      |
| 01  | [01 -- cert-dashboard](01-cert-dashboard.md)                           | 45 min    | The most self-contained. Grounds the cert / syllabus / goal / lens vocabulary that ADR 016 spreads across the next two docs.                                                                                    |
| 02  | [02 -- lens-ui](02-lens-ui.md)                                         | 45 min    | The lens framework in production. Same cert/syllabus/goal/lens model, second angle.                                                                                                                             |
| 03  | [03 -- goal-composer](03-goal-composer.md)                             | 45 min    | The third leg of the model. Sits on top of cert-dashboard data + lens framework. After this, ADR 016 phases 7-9 are all loaded.                                                                                 |
| 04  | [04 -- course-tree-arbitrary-depth](04-course-tree-arbitrary-depth.md) | 60 min    | A structural refactor. Touches BC + lens + renderer. Pairs naturally with goal-composer (courses are the third source for `getGoalNodeUnion`).                                                                  |
| 05  | [05 -- wx-engine](05-wx-engine.md)                                     | 90 min    | The most architecturally novel feature. Truth-aware generators, 4 layers x 3 stages. The PR that landed the wx-scenario course section depended on course-tree-arbitrary-depth, so this reads better after #04. |
| 06  | [06 -- command-palette](06-command-palette.md)                         | 75 min    | The largest UI feature. Dense. Read last because it depends on the help library + the autocomplete primitive + the FTS pattern.                                                                                 |

Total active reading: ~7h 30m. Total elapsed (with breaks): ~9h 45m.

## Two alternate paths

If you finish a doc early or want to skip a section:

### "Just the new stuff" (5 hours)

If your time is short and you've already re-read CLAUDE.md recently:

1. 00-architecture-tour -- sections 3 (BC pattern), 7 (browser bundling), 12 (cheat sheet). 30 min.
2. 04-course-tree-arbitrary-depth. 60 min.
3. 05-wx-engine. 90 min.
4. 06-command-palette. 75 min.

Skip 01/02/03 unless ADR 016 phase work is the next thing on your queue.

### "Cert system deep dive" (4 hours)

If you're heading back into cert / syllabus / goal / lens territory:

1. 00-architecture-tour section 8 (ADRs). 15 min.
2. [ADR 016 decision.md](../../../decisions/016-cert-syllabus-goal-model/decision.md). 30 min.
3. 01-cert-dashboard. 45 min.
4. 02-lens-ui. 45 min.
5. 03-goal-composer. 45 min.
6. Re-read the predecessor WP at [docs/work-packages/cert-syllabus-and-goal-composer/](../../../work-packages/cert-syllabus-and-goal-composer/). 60 min.

## What to keep open in your editor

Even offline, the editor + filesystem is more useful than the doc alone. Keep these tabs open:

- [package.json](../../../../package.json) -- script names, workspaces.
- [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts) -- every route.
- [libs/constants/src/engine.ts](../../../../libs/constants/src/engine.ts) -- `ENGINE_SCORING` dials.
- [libs/bc/study/src/index.ts](../../../../libs/bc/study/src/index.ts) -- the runtime barrel; canonical example of the split.
- [libs/bc/study/src/schema.ts](../../../../libs/bc/study/src/schema.ts) -- search by feature when you read each walkthrough.
- [CLAUDE.md](../../../../CLAUDE.md) -- the master rules. Re-read once.

## What to bring back from the flight

Not deliverables -- you don't have a DB to test against. Notes only. Suggested:

- One scribbled note per doc on anything you'd want to refactor, simplify, or rebuild now that you've re-read it cold.
- One list of "dead-on-arrival" decisions that should be revisited (deferred items that are now overdue, OOS items whose trigger has fired).
- One list of follow-on WPs you'd queue if you had a quiet week.

If you write them in your phone, copy them into a new session todo at `docs/work/todos/20260514-NN-flight-notes.md` when you land.

## After the flight

The "Walkthroughs owed" line in [NOW.md](../../NOW.md) should drop from six entries to one (the spaced-memory-items walkthrough already lives in the parent directory). Update NOW.md to reflect what's now written.

The walkthroughs in this directory are session-scoped: they live under `docs/work/walkthroughs/20260513-flight/`. The 60-day rolling archive at [docs/work/walkthroughs/INDEX.md](../INDEX.md) covers them. If any feature evolves significantly, update the walkthrough in place; if a feature is retired, archive the file.

Safe flight.
