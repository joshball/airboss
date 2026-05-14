# Walkthroughs

End-to-end narrative guides for each shipped feature. A walkthrough covers:

- What the feature is + who it's for
- The user journey (what you click, what happens)
- A code map (which files do what)
- Key decisions (trade-offs, non-obvious choices)
- Operator notes (how to run, seed, reset, debug)
- Links to the work-package docs (spec, design, tasks, test-plan, review)

**When to write one:** when a feature ships its first real version and a
new developer (or future-you) needs to get oriented fast. Update the
walkthrough when the feature's behavior or shape changes; archive it if
the feature is retired.

## Index

| Feature                               | Status        | Walkthrough                                                                                            | Work package                                                                                    |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Spaced Memory Items                   | shipped       | [spaced-memory-items.md](spaced-memory-items.md)                                                       | [work-packages/spaced-memory-items/](../work-packages/spaced-memory-items/)                     |
| Architecture tour (2026-05-13 flight) | living        | [20260513-flight/00-architecture-tour.md](20260513-flight/00-architecture-tour.md)                     | --                                                                                              |
| Cert Dashboard                        | shipped       | [20260513-flight/01-cert-dashboard.md](20260513-flight/01-cert-dashboard.md)                           | [work-packages/cert-dashboard/](../work-packages/cert-dashboard/)                               |
| Lens UI                               | in flight     | [20260513-flight/02-lens-ui.md](20260513-flight/02-lens-ui.md)                                         | [work-packages/lens-ui/](../work-packages/lens-ui/)                                             |
| Goal Composer                         | in flight     | [20260513-flight/03-goal-composer.md](20260513-flight/03-goal-composer.md)                             | [work-packages/goal-composer/](../work-packages/goal-composer/)                                 |
| Course Tree -- Arbitrary Depth        | shipped       | [20260513-flight/04-course-tree-arbitrary-depth.md](20260513-flight/04-course-tree-arbitrary-depth.md) | [work-packages/course-tree-arbitrary-depth/](../work-packages/course-tree-arbitrary-depth/)     |
| Weather Engine                        | shipped       | [20260513-flight/05-wx-engine.md](20260513-flight/05-wx-engine.md)                                     | [work-packages/wx-engine/](../work-packages/wx-engine/)                                         |
| Command Palette                       | shipped (3.5) | [20260513-flight/06-command-palette.md](20260513-flight/06-command-palette.md)                         | [work-packages/command-palette/](../work-packages/command-palette/)                             |
| Decision Reps                         | planned       | --                                                                                                     | [work-packages/decision-reps/](../work-packages/decision-reps/)                                 |
| Calibration Tracker                   | planned       | --                                                                                                     | [work-packages/calibration-tracker/](../work-packages/calibration-tracker/)                     |
| Knowledge Graph                       | planned       | --                                                                                                     | [work-packages/knowledge-graph/](../work-packages/knowledge-graph/)                             |
| Study Plan + Session Engine           | planned       | --                                                                                                     | [work-packages/study-plan-and-session-engine/](../work-packages/study-plan-and-session-engine/) |
| Learning Dashboard                    | planned       | --                                                                                                     | [work-packages/learning-dashboard/](../work-packages/learning-dashboard/)                       |

The 2026-05-13 set was written as offline reading for a long flight. Reading plan: [20260513-flight/READING-ORDER.md](20260513-flight/READING-ORDER.md).

## Template

Use [_template.md](_template.md) when starting a new walkthrough. Keep
the structure consistent so readers can jump to the section they need.
