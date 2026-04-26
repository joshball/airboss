# Design Principles

The beliefs and approaches that shape how airboss works. These aren't rules -- they're the lens through which we evaluate every feature, every interaction, every design decision.

Review these when designing features. Review features against these. If a feature doesn't serve at least one principle, question why it exists.

See also: [VISION.md](VISION.md) for what airboss is, [LEARNING_PHILOSOPHY.md](LEARNING_PHILOSOPHY.md) for the discovery-first pedagogy, [IDEAS.md](IDEAS.md) for ideas not yet promoted to principles, and [VOCABULARY.md](VOCABULARY.md) for the language we use.

---

## 1. Debrief Culture

**Source:** Military aviation debrief model. Rank doesn't protect you. Transparency drives learning.

The system embodies the culture of the debrief room:

- **Anonymous public data.** How do pilots perform in each scenario? What do most people miss? Where do learners struggle? Aggregate performance is shared (anonymously) because that's how the squadron improves.
- **No shame in failure.** Bolters happen. The system celebrates failure as learning, not as punishment. "This is where learning happens" is not a platitude -- it's a design constraint.
- **NTSB-style analysis.** When you fail a scenario, the debrief explains the chain of events, not just the outcome. Same spirit as accident investigation: no blame, just understanding.
- **Experience doesn't soften feedback.** Even experienced pilots should see where they missed cues. A 10,000-hour ATP who misses an early stall indicator gets the same feedback as a 500-hour student.

**How to apply:** Every post-scenario experience should feel like a debrief, not a report card. Show the chain, not the score. Make failure data useful, not shameful.

---

## 2. Decisions Under Pressure

**Source:** [VISION.md](VISION.md) -- "knowledge without decision-making" is the gap airboss closes.

Traditional training teaches knowledge. We train judgment. The difference is time pressure, incomplete information, and consequences.

- Every scenario should require **real-time decisions** with imperfect information.
- Decision affordances vary by surface: pilot decisions in `apps/sim/` (control inputs, configuration changes, divert/continue), instructor interventions in a future FIRC surface (Ask → Prompt → Coach → Direct → Take Controls).
- Scoring rewards **noticing earlier**, not knowing more.

**How to apply:** If a feature can be reduced to "read text, answer question," it's not using the engine properly. Push toward simulation, time pressure, and consequence.

---

## 3. Never a Trick

**Source:** Pre-pivot VISION ("It does NOT reward psychic guessing, menu gaming, or memorizing scripts"). Survives the pivot unchanged.

The system rewards good flying and good judgment, not pattern recognition of how the platform itself works. If a learner can pass by memorizing platform behavior instead of developing real skill, the platform is broken.

- No giveaway UI cues that telegraph the "right" answer.
- Decision affordances are always the same per surface, so there's no menu to game.
- Scenario conditions vary (student behavior in instructor surfaces; weather/traffic/aircraft state in pilot surfaces), so memorized scripts don't work.
- Scoring is multi-dimensional (timing, appropriateness, safety, communication), not binary.

**How to apply:** After building a scenario or feature, ask: "Can someone pass this by gaming the platform instead of learning?" If yes, redesign.

---

## 4. Replay is the Product

**Source:** [VISION.md](VISION.md) -- daily / between-flights practice is the core loop, not one-shot completion.

We want pilots to spend 100+ hours over a flying career. Replay value comes from variation, not repetition.

- Same scenario, different conditions (weather, traffic, weight) = different decisions.
- Same conditions, different aircraft profile = different feel.
- Spaced rep + recent-weakness lift means the *queue* of scenarios changes daily.
- Debrief after each run shows what you missed, creating motivation to retry.

**How to apply:** Every scenario should have meaningful variation. If replaying feels identical, the conditions or student model aren't varied enough. Spaced rep should never serve the same card the same way twice in a row.

---

## 5. Emotional Safety

**Source:** Pre-pivot VISION. Survives the pivot unchanged -- if anything, more important when the user is rebuilding decade-old skills.

Learning requires vulnerability. The platform must make it safe to fail, to say "I don't know," to try risky decisions.

- **No permanent penalties.** Everything is replayable.
- **Debrief > Score.** Instead of "65%", show "You missed early stall indicators" and "You delayed go-around by 4 seconds."
- **Trust and honesty.** "I don't know" is a valid response on calibration prompts, logged for adaptive scheduling, never punished.
- **Progressive challenge.** The platform adapts to the learner, not the other way around.

**How to apply:** If a feature makes a user feel judged, stupid, or trapped, redesign it. The system should feel like a supportive but honest instructor.

---

## 6. Confirmation, Not Guesswork

**Source:** App-wide UX review, 2026-04-22.

Every create and edit flow must tell the user what just happened. Silent redirects break trust -- the user has to infer success from context. Two patterns, applied consistently:

- **Create-then-redirect.** Server redirects to the detail page (for single-record flows like memory) or list page (for multi-item flows like reps and plans) with `?created=<id>` in the query. The destination reads the query param on load, renders a dismissible `role="status"` banner ("Card saved. View it" / "Scenario 'X' saved" / "Plan saved. Start a session"), and when landing on a list, anchors or highlights the just-created row.
- **Edit-then-stay.** Server returns `{ success: true, message?: string }` from the action (never redirects to self silently). Client shows a `role="status"` toast that auto-dismisses after ~3 seconds. The `/plans/[id]` update action is the canonical implementation.

For browse pages, the "make current state visible" pattern: when filters are applied, render removable filter chips above the results plus a "Showing X of Y matching: ..." summary. Every filter chip links to the same page URL with that one filter removed; a "Clear all" link clears everything.

**How to apply:** After a user clicks Save, they should never have to guess whether the thing actually saved. If you can't see the confirmation from across the room, it's not loud enough. If a page's URL carries filter state, the page must show that state visibly -- not just in the form controls the user may have scrolled past.

---

## Adding New Principles

Principles are promoted from [IDEAS.md](IDEAS.md) when they've proven their value -- either through implementation experience or through repeated use in design decisions. A principle should be:

1. **Actionable** -- it changes how you build, not just how you think
2. **Testable** -- you can evaluate a feature against it
3. **Stable** -- it won't change with the next feature

To propose a new principle, add it to IDEAS.md first. If it keeps coming up in design decisions, promote it here.
