# Sim Vision

The training environment where flight instructors renew their certificates by doing, not reading.

## What It Is

Sim is the learner-facing app. A CFI logs in, works through scenario-based modules, answers knowledge checks, and earns FAA-compliant FIRC credit. The experience is adaptive, immersive, and honest -- not a slideshow with a quiz at the end.

## What Makes It Different

- **Decisions, not knowledge.** Every scenario puts the learner in a real situation with time pressure and incomplete information. You don't read about what to do -- you do it.
- **The debrief is the lesson.** After each scenario, the system shows the chain of events, what you missed, and what you should have done. NTSB framing: no blame, just understanding.
- **FAA compliance is invisible.** From the learner's perspective, it's training. The FAA time tracking, topic coverage, and evidence packets happen in the background.
- **Replay is the point.** Same scenario, different student behavior. Same student, different conditions. Replaying a scenario you almost got is how mastery develops.

## Who Uses It

Flight instructors renewing their CFI certificate. They have between 500 and 10,000+ hours. They know flying. They need to refresh judgment, not facts.

## Relationship to Hangar

Sim reads from the `published` schema -- content that hangar has authored and published. Sim never sees drafts. It always runs against a specific `release_id`, so the question "which version did this user complete?" is always answerable.

## Relationship to Ops

Ops manages enrollments (creates them, issues certificates). Sim writes progress and evidence. They share the same database but don't call each other directly.

## Success Metric

A learner logs in, completes the course, and earns a FAA-compliant FIRC certificate. Every decision they made is recorded. Every FAA topic has enough time logged. Every competency has evidence.
