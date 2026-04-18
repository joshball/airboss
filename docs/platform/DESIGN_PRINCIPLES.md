# Design Principles

The beliefs and approaches that shape how FIRC Boss works. These aren't rules -- they're the lens through which we evaluate every feature, every interaction, every design decision.

Review these when designing features. Review features against these. If a feature doesn't serve at least one principle, question why it exists.

See also: [IDEAS.md](IDEAS.md) for ideas not yet promoted to principles, and [VOCABULARY.md](VOCABULARY.md) for the language we use.

---

## 1. Debrief Culture

**Source:** Military aviation debrief model. Rank doesn't protect you. Transparency drives learning.

The system embodies the culture of the debrief room:

- **Anonymous public data.** How do people perform in each scenario? What do most people miss? Where do instructors struggle? The Greenie Board shows everyone's grades because that's how the squadron improves.
- **No shame in failure.** Bolters happen. The system celebrates failure as learning, not as punishment. "This is where learning happens" is not a platitude -- it's a design constraint.
- **NTSB-style analysis.** When you fail a scenario, the debrief explains the chain of events, not just the outcome. Same spirit as accident investigation: no blame, just understanding.
- **Commanders get debriefed too.** Even experienced CFIs should see where they missed cues. The system does not soften feedback based on experience level. A 10,000-hour CFI who misses an early stall indicator gets the same feedback as a 500-hour one.

**How to apply:** Every post-scenario experience should feel like a debrief, not a report card. Show the chain, not the score. Make failure data useful, not shameful.

---

## 2. Two Systems, Layered

**Source:** VISION.md core concept.

The FAA sees a conservative, traditional curriculum. Users experience an adaptive, game-like training engine. Both are real. Neither is fake.

- The FAA system is the **compliance layer**: structured curriculum, traceability matrix, time tracking, evidence packets.
- The real system is the **experience layer**: adaptive scenarios, spaced repetition, mastery-based progression, personalization.

**How to apply:** Every feature must satisfy both layers. A scenario must map to FAA topics AND be a compelling training experience. Never build compliance-only features that users endure. Never build experience-only features that can't be traced.

---

## 3. Decisions Under Pressure

**Source:** VISION.md -- "knowledge without decision-making" is the problem we're solving.

Traditional training teaches knowledge. We train judgment. The difference is time pressure, incomplete information, and consequences.

- Every scenario should require **real-time decisions** with imperfect information.
- The intervention ladder (Ask -> Prompt -> Coach -> Direct -> Take Controls) is the core interaction, not multiple choice.
- Scoring rewards **noticing earlier**, not knowing more.

**How to apply:** If a feature can be reduced to "read text, answer question," it's not using the engine properly. Push toward simulation, time pressure, and consequence.

---

## 4. Never a Trick

**Source:** VISION.md -- "It does NOT reward psychic guessing, menu gaming, or memorizing scripts."

The system rewards good instructing, not game-playing. If a student can pass by memorizing patterns instead of developing judgment, the system is broken.

- No giveaway UI cues that telegraph the "right" answer.
- Intervention options are always the same (the ladder), so there's no menu to game.
- Student behavior varies (skill, compliance, freeze tendency), so scripts don't work.
- Scoring is multi-dimensional (timing, appropriateness, safety, communication), not binary.

**How to apply:** After building a scenario or feature, ask: "Can someone pass this by gaming instead of learning?" If yes, redesign.

---

## 5. Replay is the Product

**Source:** VISION.md -- "This is what gets people from 16 -> 100 hours."

The FAA requires 16 hours. We want people to spend 100+. Replay value comes from variation, not repetition.

- Same scenario, different student behavior = different experience.
- Same student, different weather/conditions = different decisions.
- Debrief after each run shows what you missed, creating motivation to retry.
- The Greenie Board creates social motivation (anonymous, but comparative).

**How to apply:** Every scenario should have meaningful variation. If replaying feels identical, the student model or conditions aren't varied enough.

---

## 6. Emotional Safety

**Source:** VISION.md.

Learning requires vulnerability. The system must make it safe to fail, to say "I don't know," to try risky interventions.

- **No permanent penalties.** Everything is replayable.
- **Debrief > Score.** Instead of "65%", show "You missed early stall indicators" and "You delayed intervention by 4 seconds."
- **Trust and honesty.** "No" and "I don't know" are valid responses, logged for improvement, never punished.
- **Progressive challenge.** The system adapts to the learner, not the other way around.

**How to apply:** If a feature makes a user feel judged, stupid, or trapped, redesign it. The system should feel like a supportive but honest instructor.

---

## Adding New Principles

Principles are promoted from [IDEAS.md](IDEAS.md) when they've proven their value -- either through implementation experience or through repeated use in design decisions. A principle should be:

1. **Actionable** -- it changes how you build, not just how you think
2. **Testable** -- you can evaluate a feature against it
3. **Stable** -- it won't change with the next feature

To propose a new principle, add it to IDEAS.md first. If it keeps coming up in design decisions, promote it here.
