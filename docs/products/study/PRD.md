# Study PRD

Product requirements for the `apps/study` surface. The detailed feature specs live in [docs/work-packages/](../../work-packages/); this PRD is the index that says what the product is and links the work that delivered each piece.

## Information architecture

The study app ships five top-level sections, locked by the `ia-flow.spec.ts`
nav contract and the `page-anchor` static guard:

| Section   | Path           | Owns                                                 |
| --------- | -------------- | ---------------------------------------------------- |
| Home      | `/study`       | Daily CTA, today's session, pressure tiles           |
| Learn     | `/study/learn` | Cards (`/memory`), Reps (`/reps`), Read (`/library`) |
| Program   | `/program`     | Quals / Goal / Plan / Coverage tabs                  |
| Insights  | `/insights`    | Stats, Calibration, Lens (handbook + weakness)       |
| Reference | `/reference`   | Knowledge graph, Glossary, Library link              |

Memory and Reps URLs intentionally stay where they are; the Learn section is the unifying nav surface, not a relocation. Legacy paths (`/dashboard`, `/credentials`, `/goals`, `/plans`, `/calibration`, `/lens/*`, `/knowledge/*`, `/glossary/*`) 301-redirect to their canonical homes via `apps/study/src/lib/server/legacy-redirects.ts`. See work package: [study-app-ia-cleanup](../../.archive/work-packages/study-app-ia-cleanup/).

## Course reader

Instructor-authored courses live at `/courses` (index), `/courses/[slug]` (detail), and `/courses/[slug]/[stepCode]` (step reader). The detail page picks `courseLens` or `courseWithCertOverlayLens` based on whether the learner's primary goal holds at least one syllabus -- when active, the cert overlay surfaces "this step satisfies cert leaf X" chips on each step and a cert-gaps panel below the tree. The step reader renders the linked knowledge node body via the shared `KnowledgeNodeBody` component, with conditional rendering for transition-kind nodes (bridge styling) and encoded-text family nodes (Decode/Understand/Triage tab strip per `WX_DECODE_PRODUCT_SLUGS`). Goal composition gets a Courses block on `/program/goals/[id]` for adding instructor courses alongside syllabi and ad-hoc nodes (`addCourse`/`removeCourse`/`setCourseWeight` form actions). A `<CourseStepChart slug="..." />` component is shipped as a placeholder for future WX chart embedding. See work package: [course-reader-and-editor](../../work-packages/course-reader-and-editor/spec.md).

## Spaced rep adapts to recent sim performance

When a learner has been grading low on a sim scenario, the study scheduler lifts the cards and reps tied to the knowledge nodes that scenario exercises. The signal is `getRecentSimWeakness` (sim BC) -> `simWeaknessByNode` (study BC bridge) -> per-node pressure on the strengthen slice's card / rep scorers, multiplied by `ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR`. Slot rows attributed to that lift carry the `STRENGTHEN_SIM_WEAKNESS_CARD` or `STRENGTHEN_SIM_WEAKNESS_REP` reason code so the runner UI can cite the recent flight as the reason the card is here.

Authored sim-scenario -> knowledge-node mapping lives in [`SIM_SCENARIO_NODE_MAPPINGS`](../../../libs/constants/src/sim.ts). See work package: [sim-card-mapping](../../work-packages/sim-card-mapping/spec.md).

## Links

- [Study BC sim bridge](STUDY_BC_SIM_BRIDGE.md) -- how the cross-BC bridge is wired
- [Roadmap](ROADMAP.md) -- deferred + upcoming work
- [ADR 011 -- Knowledge Graph Learning System](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [ADR 014 -- Engine Scoring Coefficients](../../decisions/014-engine-scoring-coefficients.md)
- [ADR 015 -- Sim Surface Loose Coupling](../../decisions/015-sim-surface-loose-coupling.md)
