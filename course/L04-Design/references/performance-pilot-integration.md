---
title: Integrating Performance Pilot Ideas into FIRC Boss Training
source_review: ./performance-pilot-review.md
status: draft
created: 2026-04-14
author: Joshua Ball
---

# Integrating Performance-Pilot Thinking into Our Training

The book's core bet -- that mental training, deliberate practice, and self-coaching drive skill more than raw hours -- lines up exactly with what we're trying to do differently from AF FIRC and the other refresher courses. This doc maps the book's protocols (and the modern learning-science extensions they're missing) onto concrete features and content choices in FIRC Boss.

See companion review: [performance-pilot-review.md](./performance-pilot-review.md).

## Design principles this reinforces

- **Hours are not the unit of progress.** Scenario engagement, corrected errors, and retained knowledge are.
- **Learning is a mental activity that happens between events, not only during them.** Pre-brief and debrief get as much weight as the scenario itself.
- **Repetition programs whatever it repeats.** We must design scenarios so the *right* habits get reinforced, and surface errors quickly enough that they don't calcify.
- **The target state of a refresher is not "know the rules again."** It is "unconscious competence with conscious awareness" -- proficient habits plus an awake monitoring mind.

These should be cross-referenced into [../../../docs/platform/DESIGN_PRINCIPLES.md](../../../docs/platform/DESIGN_PRINCIPLES.md) once we've decided which are durable.

## The book's protocols, mapped to our system

| Book protocol                                     | FIRC Boss surface                                                       | Notes                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pre-flight objectives framed as post-flight Qs    | Scenario **pre-brief** screen: 2-3 learning objectives, stated as the questions the debrief will ask back | Already aligned with L03 objectives -- wire the objective IDs into both the pre-brief and post-brief views    |
| Mental imagery before the real event              | Optional **"walk through it"** pre-scenario step -- text/audio guided rehearsal of the scenario's key decision points | Low cost to build; high pedagogical value; maps to "visualize then execute"                                   |
| Drills vs. scrimmages                             | Two scenario types: **micro-scenario** (single decision, 60-120s) and **full scenario** (multi-phase) | We're already scenario-first; formalize the micro/drill layer so learners can rep a single ADM decision 10x   |
| 1-10 self-rating per maneuver, recalibrated       | **Self-rating slider** at debrief per objective, persisted across attempts so the learner can see their scale drift | Compare self-rating vs. engine score -- divergence is itself a coaching signal                                |
| Full-flight replay before debrief                 | **Timeline replay** of the scenario's tick history before the debrief UI expands | The engine records ticks; surface them as a scrubbable timeline with decision points marked                   |
| Self-coaching journal                             | Per-learner **journal** -- free-text notes tied to scenarios and objectives, visible only to them | Writing increases awareness (this is real, and is also the testing/generation effect in modern lit)           |
| Trigger routine for performance state             | Optional **pre-scenario grounding step** (2-3 breaths, recall a past success) -- skippable, not mandated | Nice-to-have; don't over-index                                                                                |
| Cross-crawl / lazy-8s brain integration           | **Skip.** The mechanism in the book isn't real. If we want physical warm-up we should ground it in current research and not sell it as "brain integration" | See review for why                                                                                            |

## The book's gaps that we should fill from elsewhere

The book is from ~2015 racing-psychology tradition and is missing the last 30 years of cognitive-science-of-learning. Since FIRC Boss is being built from scratch, we have no reason to inherit the gaps.

| Gap in the book                 | What we should do                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Spacing effect                  | Questions and scenarios must return on a spaced schedule; don't let a learner "finish" a topic and never see it again      |
| Retrieval practice              | Learning happens when the learner has to *produce* an answer, not recognize one. Favor short-answer and scenario decisions over pure MCQ where we can score them |
| Interleaving                    | Mix topic areas within a session rather than block-training one topic to mastery then moving on                            |
| Desirable difficulties          | Slight frustration -> better retention. Don't over-scaffold. Let learners struggle briefly before feedback                 |
| Variable practice / transfer    | The same ADM principle must appear in different scenarios (IFR, VFR, different aircraft, different students) or it won't generalize |
| Error-rich practice             | Scenarios should provoke the *common CFI errors* (get-there-itis, student-induced pressure, normalization of deviance) and let learners recover, not avoid them |
| Naturalistic decision-making    | Klein's recognition-primed decision model fits CFI work better than DECIDE/3P checklists; scenarios should reward pattern-matching under time pressure |
| Overconfidence / self-belief failure modes | Where the book celebrates belief, we should also surface miscalibration -- a learner's self-rating vs. measured performance is the teachable gap |

## Concrete changes to consider (not commitments)

These should be proposed into [../../../docs/platform/IDEAS.md](../../../docs/platform/IDEAS.md) for biweekly review, then promoted into feature specs if they survive.

1. **Pre-brief / debrief as first-class screens, not afterthoughts.** The scenario is the middle of a three-act structure. Pre-brief states objectives as questions; debrief answers them with the learner's timeline, self-rating, and engine score side-by-side.
2. **Micro-scenario layer.** Drills. 60-120 seconds. Single decision. Re-runnable. Complements the full scenario.
3. **Timeline replay before debrief.** Scrub the tick stream, see decision points, annotate. Cheap given the engine already records.
4. **Self-rating + divergence signal.** Learner rates, engine rates, we show the gap. The gap is the lesson.
5. **Spaced resurfacing.** Questions the learner missed, and scenarios they scored low on, come back on a spacing schedule rather than at the end of the course.
6. **Interleaved module delivery.** A session draws from multiple A.x topics rather than one-topic-per-session.
7. **Mental-imagery pre-scenario step (opt-in).** Short guided rehearsal before harder scenarios; A/B whether it helps retention.
8. **Learner journal, portable.** Exportable notes. Ownership signals seriousness.
9. **Never say "game" externally.** Internally, lean into the performance-training framing. The book gives us clean language for this: "deliberate practice," "mental programming," "drills," "peak performance" -- FAA-safe and accurate.

## What we explicitly do not take from the book

- The left/right brain framing. Doesn't match current neuroscience.
- Cross-crawls and lazy-8s as "brain integration." Skip.
- "Perfect practice makes perfect" as a slogan. Replace with: *you rehearse what you repeat -- design the rehearsal carefully, and include recovery from errors as a rehearsed skill.*
- Uncritical self-belief boosterism. In aviation, well-calibrated confidence beats high confidence.

## Next step

Decide whether the ideas above belong as principles, features, or scenario-design rules. My recommendation is to promote #1 (pre-brief/debrief structure), #3 (timeline replay), and #5 (spaced resurfacing) into feature specs, and keep the rest in IDEAS.md for the next review cycle.
