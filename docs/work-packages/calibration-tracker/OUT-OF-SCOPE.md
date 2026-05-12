---
title: 'Out of Scope: Calibration Tracker'
product: study
feature: calibration-tracker
type: out-of-scope
status: unread
---

# Out of Scope: Calibration Tracker

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                        | Status       | Trigger to revisit                                                                 |
| ------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| Adjustable confidence sampling rate         | Deferred     | When user-zero asks for 100% sampling or a different cadence after MVP use         |
| Charting library                            | Deferred     | When CSS-only chart visibly breaks for a learner (responsiveness, dense buckets)   |
| Historical comparison                       | Deferred     | When 90+ days of calibration data exist and user wants to compare periods          |
| Calibration-based study recommendations     | Follow-on WP | When the cert-syllabus / goal-composer surface is ready to consume recommendations |
| Calibration leaderboard / social comparison | Rejected     | Never -- see detail below                                                          |
| Per-node calibration                        | Deferred     | When cards and reps are linked to knowledge graph nodes                            |
| Export calibration data (CSV)               | Deferred     | When user-zero asks for it for external analysis                                   |
| Per-phase-of-flight calibration (reps)      | Deferred     | When decision-reps phase tagging is consistently populated                         |
| Sharing calibration data with other users   | Rejected     | Never without explicit consent + privacy design                                    |

## Adjustable confidence sampling rate

Status: Deferred

What was deferred:
A configurable per-user sampling rate for the ConfidenceSlider component. Today the slider appears on a hardcoded ~50% of reviews/reps (deterministic hash) per [spec.md](spec.md) Behavior section, ConfidenceSlider subsection.

Why:
50% sampling balances data density against survey fatigue for the MVP. Configuring it adds a user-preferences surface that does not yet exist on the study app. The default hits the data-collection floor for meaningful calibration without forcing the learner to rate every card.

Trigger to revisit:
When user-zero asks for 100% sampling (for faster calibration self-discovery in the first month) or a different cadence after MVP use, per [PRD.md](PRD.md) Open Questions item 1.

Implementation pattern when triggered:
Add a `confidence_sampling_rate` column on the per-user preferences row (when that table exists). Read it in the review and rep flows where the deterministic hash is computed. Mirror the existing constants approach: add `CONFIDENCE_SAMPLING_RATES` in `libs/constants/`.

References:

- [spec.md](spec.md) Out of Scope section
- [PRD.md](PRD.md) Open Questions section, item 1
- [PRD.md](PRD.md) Beyond MVP section

## Charting library

Status: Deferred

What was deferred:
Adopting a dedicated charting library for the calibration page. The MVP uses CSS-only charts (bars are styled divs with percentage widths; trend is a sparkline) per [spec.md](spec.md) Calibration page subsection.

Why:
CSS-only renders fast, ships zero extra dependencies, and matches the data shape (5 buckets + a 30-point trend). Adding a charting library would add bundle weight and styling friction for visuals that fit on a napkin.

Trigger to revisit:
When CSS-only chart visibly breaks for a learner -- responsiveness on narrow viewports, dense bucket overlays, or per-domain comparisons that need shared axes. Practically: when a screenshot of the calibration page is "ugly" enough that the user files a bug.

Implementation pattern when triggered:
Evaluate a library that ships well with Svelte 5 (e.g., layerchart, d3 wrappers). Replace the CSS divs in `apps/study/src/routes/(app)/calibration/+page.svelte`. Keep the BC functions (`getCalibration`, `getCalibrationTrend`) unchanged -- only the render layer swaps.

References:

- [spec.md](spec.md) Out of Scope section
- [spec.md](spec.md) Behavior section, Calibration page subsection

## Historical comparison

Status: Deferred

What was deferred:
A "you were more overconfident 3 months ago" surface that shows calibration drift over time at the bucket or score level. Today only the 30-day trend is rendered per [spec.md](spec.md) Calibration page subsection.

Why:
Historical comparison requires enough longitudinal data per user to make the comparison meaningful. The 30-day trend already exists; longer windows duplicate the same shape with sparser data and add UI complexity without proportional learning value.

Trigger to revisit:
When 90+ days of calibration data exist for user-zero AND the user wants to compare periods (e.g., "before vs after switching study cadence").

Implementation pattern when triggered:
Extend `getCalibrationTrend(userId, days)` in `libs/bc/study/src/calibration.ts` to accept a date range parameter. Add a period-selector on the calibration page that re-fires the load with different windows. Re-use the existing sparkline component.

References:

- [spec.md](spec.md) Out of Scope section
- [PRD.md](PRD.md) Beyond MVP section

## Calibration-based study recommendations

Status: Follow-on WP

What was deferred:
A surface that uses calibration data to recommend study targets. "You are overconfident on Weather -- spend more time there" per [PRD.md](PRD.md) Open Questions item 4.

Why:
Recommendations cross from descriptive (here's your calibration) into prescriptive (here's what you should study). The right home is the session engine or cert-syllabus surface, not the calibration page itself. Bolting recommendations onto the calibration page would entangle the metric with the action.

Trigger to revisit:
When the cert-syllabus / goal-composer surface is ready to consume calibration as a recommendation signal. Likely co-lands with the per-node calibration trigger below.

Implementation pattern when triggered:
Author a fresh WP via `/ball-wp-spec`. The follow-on WP would expose `getCalibrationRecommendations(userId)` in `libs/bc/study/src/calibration.ts` returning ranked domains with miscalibration deltas, consumed by the session engine.

References:

- [spec.md](spec.md) Out of Scope section
- [PRD.md](PRD.md) Open Questions section, item 4
- [PRD.md](PRD.md) Beyond MVP section

## Calibration leaderboard / social comparison

Status: Rejected

What was rejected:
A public or peer-visible leaderboard of calibration scores. Anonymous opt-in versions of the same idea (the "Greenie Board" noted in [PRD.md](PRD.md) Integration With Other Products) are also out of scope for this WP.

Why:
Calibration is self-knowledge, not performance measurement, per [PRD.md](PRD.md) "What This Is NOT" section. Surfacing it competitively turns the metric into a target the learner games (the user learns to game the rating, not to be calibrated). Privacy and consent design for any social surface is non-trivial; [PRD.md](PRD.md) Open Questions item 5 explicitly defers all sharing past MVP.

Trigger to revisit:
Never as a default leaderboard. A future opt-in anonymous Greenie Board would need its own WP with explicit consent + privacy design; that is tracked as a separate idea in [IDEAS.md](../../platform/IDEAS.md), not as a "deferred trigger" on this WP.

References:

- [spec.md](spec.md) Out of Scope section
- [PRD.md](PRD.md) What This Is NOT section
- [PRD.md](PRD.md) Open Questions section, item 5
- [PRD.md](PRD.md) Integration With Other Products section, Future products subsection

## Per-node calibration

Status: Deferred

What was deferred:
Calibration aggregated per knowledge-graph node, so the surface shows "you are overconfident specifically about holding pattern entries" rather than the broader "you are overconfident about navigation" today.

Why:
Cards and reps are not yet linked to knowledge graph nodes. The aggregation is impossible without the link; building the UI before the data exists would either silently show empty buckets or require fake stub data.

Trigger to revisit:
When cards and reps are linked to knowledge graph nodes (the same trigger that opens the per-node analytics family). Per [PRD.md](PRD.md) Knowledge Graph integration subsection.

Implementation pattern when triggered:
Mirror the existing per-domain aggregation in `libs/bc/study/src/calibration.ts`. Add a `node_id` filter parameter on `getCalibration`; the query joins through whichever table links cards/reps to nodes when that lands.

References:

- [PRD.md](PRD.md) Integration With Other Products section, Knowledge Graph subsection
- [PRD.md](PRD.md) Beyond MVP section
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)

## Export calibration data (CSV)

Status: Deferred

What was deferred:
A "download as CSV" affordance on the calibration page so the user can pull their per-bucket and per-domain data for external analysis.

Why:
Export is a low-value affordance until the user has a concrete analysis to run on the data. Adding an export route adds surface area (CSV format, column ordering, header naming) for no proven downstream use yet.

Trigger to revisit:
When user-zero asks for it for external analysis (likely after enough longitudinal data accumulates to be worth exporting).

Implementation pattern when triggered:
Add `/calibration/export.csv` as a `+server.ts` route in `apps/study/src/routes/(app)/calibration/`. Stream from `getCalibration` and `getCalibrationTrend`. Mirror any existing CSV-export surface in the app for header conventions.

References:

- [PRD.md](PRD.md) Beyond MVP section

## Per-phase-of-flight calibration (reps)

Status: Deferred

What was deferred:
A calibration breakdown by phase of flight for decision-reps (e.g., takeoff vs cruise vs approach). Today calibration aggregates across all rep attempts regardless of phase.

Why:
Phase-of-flight tagging on rep attempts is not yet a stable required field. Aggregating by an incomplete tag would silently lump untagged rows into a "no phase" bucket and mislead the learner.

Trigger to revisit:
When decision-reps phase tagging is consistently populated (i.e., every new rep records a phase, and a backfill covers older attempts).

Implementation pattern when triggered:
Add a `phase` filter parameter on `getCalibration`. Join against the rep-attempt phase column when filtering. Add a phase selector on the calibration page mirroring the existing per-domain breakdown.

References:

- [PRD.md](PRD.md) Beyond MVP section
- [PRD.md](PRD.md) Integration With Other Products section, Decision Reps subsection

## Sharing calibration data with other users

Status: Rejected

What was rejected:
Any surface that lets a third party (CFI, mentor, peer) see another user's calibration data, even with that user's consent in v1.

Why:
Privacy and consent design is non-trivial. The user's calibration data is sensitive self-knowledge; sharing it would need explicit per-share consent, audit trail, revocation, and likely a privacy ADR before any UI design begins. Deferring past MVP keeps the surface clean while the question matures.

Trigger to revisit:
Never without explicit consent + privacy design. A future "CFI sees student calibration" surface would need its own WP with a privacy review.

References:

- [PRD.md](PRD.md) Open Questions section, item 5
- [PRD.md](PRD.md) What This Is NOT section
