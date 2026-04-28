---
title: 'User stories: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: user-stories
status: done
review_status: done
---

# User stories: Avionics App Scaffold

Joshua wears four hats on this product. The stories below are grouped by hat. Each hat asks "what does the surface coming alive get me right now, before any drill or scoring lands?"

## Joshua-as-pilot (rebuilding instrument scan)

Joshua is a returning CFI rebuilding PPL/IR/CPL/CFI knowledge after a long break. The instrument scan -- the disciplined sweep across attitude, airspeed, altitude, heading, VSI -- is one of the muscle skills atrophy hits hardest. Glass-cockpit panels added a fresh learning curve when he was away from the controls.

| As                                  | I want                                                                                      | So that                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A returning IR pilot                | A glass PFD that responds to my inputs the way a real one does                              | I can rehearse the visual vocabulary of a tape display before I see it in the airplane next        |
| A pilot who flew round-dial first   | A PFD I can stare at side-by-side with my mental model of a steam-gauge panel               | The translation between the two cockpits stops costing me thinking-time when I scan                |
| A pilot drilling at home            | The PFD to feel right, not just look right -- the readout needs to settle, not snap         | The thing I rehearse is calibrated to real instrument inertia, not to a snappier-feels-better demo |
| A pilot who studies in short bursts | To open `https://avionics.airboss.test/pfd` and immediately have an instrument to play with | The activation cost is zero; the friction of "set up the demo" is something I'd skip three times   |

## Joshua-as-CFI (showing students)

Joshua flies with students who are new to glass. Picking apart what the PFD is doing in real time -- "see how the airspeed tape's green band tells you your normal range without you having to recall a number?" -- benefits from a tool he can flip on a tablet next to a coffee.

| As                                        | I want                                                                    | So that                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A CFI in a ground-school chair            | A glass PFD I can drive with sliders while I talk                         | I can demonstrate the bank-pointer / pitch-ladder relationship without booking the airplane      |
| A CFI explaining V-speeds                 | Visible airspeed arcs on the tape with white/green/yellow/red             | I can point at a band and say "that's where you don't go" instead of describing it abstractly    |
| A CFI explaining the "thousand-foot roll" | An altitude tape where the thousand-foot digit rolls smoothly and visibly | The mental model of "the thousand-foot digit doesn't slam, it rolls" gets reinforced visually    |
| A CFI debriefing                          | A way to set up a specific airspeed/altitude/attitude state quickly       | I can produce the configuration we just landed in and walk back through what each indicator said |

## Joshua-as-platform-owner (proving the surface)

Joshua is also the system architect. The avionics surface has been on the build-order list since the architecture doc was written. Until it has a running app, every later product idea that wants a glass surface is blocked behind "but does the avionics surface actually exist?"

| As                 | I want                                                                                        | So that                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The platform owner | A reachable URL that demonstrates the avionics surface                                        | The next product idea ("EFIS scan trainer", "panel quiz") doesn't have to invent the surface; it lands on shaped infrastructure |
| The platform owner | The BC contract (`Attitude`, `AirData`, `NavData`) defined and exported                       | The first product feature reads against an established type surface, not an inline app-local interface                          |
| The platform owner | Schema namespace `avionics` reserved                                                          | The first migration to add a real avionics table doesn't relitigate the namespace question                                      |
| The platform owner | A rejection of the deferred `extract-sim-instruments` extraction                              | The "extract sim instruments because avionics needs them" plan stops being a phantom obligation; the right plan replaces it     |
| The platform owner | The chrome on `/avionics/*` to look and feel like the same product as `/sim/*` and `/study/*` | The platform feels like one airboss to a learner moving between surfaces, not three separate apps that share a logo             |
| The platform owner | Multi-spawn `bun run dev` to bring up four apps cleanly                                       | Adding a fourth app didn't break the developer's "everything up at once" loop                                                   |

## Joshua-as-future-learner (the surface coming alive)

This is the hardest-to-articulate story but the one this WP is most for. The scaffold ships before any drill exists. Its value to a future learner is purely "the path to the avionics product line is open."

| As                                        | I want                                                                                | So that                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A learner six months from now             | An EFIS scan trainer that runs as part of airboss                                     | I can rep the scan during my BFR prep without standing up a separate avionics tool            |
| A learner three weeks from now            | A panel quiz that asks "what does this airspeed tape band mean?" and grades my answer | I can revise tape-symbology knowledge alongside spaced-rep cards on the same platform         |
| An IFR student                            | A partial-panel drill that hides the attitude indicator                               | I can practice the partial-panel scan against a glass display, not just round dials           |
| A learner moving between airboss surfaces | The chrome and theme to feel consistent                                               | I trust the platform's identity even as I touch surfaces with very different visual languages |

None of those four stories is satisfiable yet. The PFD scaffold is what makes any of them satisfiable next.

## Story-driven priorities

| Story group              | What this WP delivers                                                                                                          | What stays unsatisfied (deferred to future WPs)                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Joshua-as-pilot          | A PFD he can play with that feels right                                                                                        | A drill that scores his scan; coupling to a real flight model                                                  |
| Joshua-as-CFI            | A demo URL on a tablet                                                                                                         | A multi-student session view; recorded scenarios for asynchronous review                                       |
| Joshua-as-platform-owner | A reachable surface, BC contract, namespace, dev wiring, theme reuse, route lock, and resolution of the deferred extraction WP | Cross-app navigation between sim's cockpit and avionics's PFD; shared instrument lib at `libs/activities/pfd/` |
| Joshua-as-future-learner | The surface exists                                                                                                             | Every actual product feature                                                                                   |

## References

- [docs/platform/PIVOT.md](../../../../platform/PIVOT.md) -- the relearning workflow this surface eventually serves
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- where avionics sits among the surfaces
- [Spec](spec.md), [Design](design.md), [Tasks](tasks.md), [Test plan](test-plan.md)
