---
status: pending
review_status: pending
---

# User stories -- regulations course Weeks 3-10

The course exists for a small set of pilots, each at a different point in the regulatory learning curve. Each story names whom the pull is for, what they walk away with, and which weeks carry the most weight for them.

## Story 1 -- The CFI candidate

**As a** pilot a few months from a CFI initial checkride,
**I want** a structured walk through the FARs that I can hand to a friend or use to backfill my own gaps,
**so that** when an examiner asks me anything from "where does logging live?" to "walk me through a night IFR flight with a passenger," I can route the question through the structural map and answer without panic.

Weeks that carry the most weight:

- Week 3 (subpart H) is the centerpiece -- this person is becoming a CFI
- Week 4-5 (Part 91 deep dive) is what gets tested in the oral
- Week 9 (enforcement) is what every CFI fears for the wrong reasons; learning the actual mechanics replaces fear with procedure
- Week 10 (capstone) is the dry run

Failure mode for this user: shallow Week 3. If 61.193 and 61.195 don't get pulled apart cleanly, the user walks into the checkride confusing privileges with limitations. Mitigated by the spec's binding requirement to deep-dive each named section, not just reference them.

## Story 2 -- The IFR student

**As a** private pilot working on the instrument rating,
**I want** to understand the IFR-specific regulations (filing, fuel, alternates, equipment, inspections) cleanly enough that the regulatory side of the rating doesn't tax me on top of the procedural side,
**so that** during oral exams and during real flights, I can answer regulatory questions in seconds and spend the cognitive load on the flying.

Weeks that carry the most weight:

- Week 4 (91.167, 91.169, 91.171, the IFR ops sections 91.175-185) is where this user lives
- Week 5 (91.205 IFR equipment, 91.411 altimeter check) is the second tier
- Week 8 (Chief Counsel letters, AIM IFR procedures) provides the interpretation context
- The capstone `night-ifr-passenger.md` is the integration test

Failure mode for this user: a Week 4 lesson that lists the sections without explaining the practical relationship between them (the 1-2-3 rule's interaction with destination weather, the alternate filing minimums vs the alternate approach minimums, the 30-day VOR check trap). Mitigated by the spec's "discovery-first" binding and the Common Misreadings requirement.

## Story 3 -- The regs-curious private pilot

**As a** private pilot who has held the cert for years and never read the FARs end-to-end,
**I want** a structured course that walks the parts I touch every flight and names the parts I don't, so I stop being scared of the regulations,
**so that** when a flight school friend asks "is this legal?" I can either answer or know exactly which section to look up.

Weeks that carry the most weight:

- Week 4 (Part 91 general / flight rules) covers what they fly under every flight
- Week 5 (equipment / maintenance) demystifies the maintenance-log opening
- Week 8 (companion documents) tells them about the AIM, ACs, and Chief Counsel letters that they may have heard mentioned but never explored
- Week 9 (enforcement) lets them stop fearing the boogeyman and understand the compliance program as the FAA's actual default posture

Failure mode for this user: Week 8 reads as a dry catalog of document types. Mitigated by the spec's "lead with WHY" and by including specific named Chief Counsel letters (Mangiamele, Hicks, Walker, Murphy) with what each decided.

## Story 4 -- The FIRC-renewal CFI

**As a** working CFI doing biennial renewal,
**I want** a refresher on the parts I don't teach often (135, 141 deeper, AC catalog updates, NTSB Part 830) so I'm not the one CFI in the FIRC class who doesn't know how 91.175 changed,
**so that** I keep my edge and don't show up to a checkride or a ramp check unprepared.

Weeks that carry the most weight:

- Week 6 (special ops + integration) -- the parts most CFIs let atrophy
- Week 7 (Parts 141 and 135) -- the operational layer most freelance CFIs don't think about until a student leaves them for a 135 operator
- Week 8 (Chief Counsel letters) -- the canonical interpretations every CFI should know but few have actually read
- Week 9 (enforcement) -- the part that's been substantially rewritten with the Compliance Program

Failure mode for this user: Week 7 stays at "what is Part 135" without telling them which 135 reg most often touches their daily life. Mitigated by the spec's "when does it touch me as a CFI" framing for Week 7 and by the cumulative oral pulling 135-relevant questions into Week 10's capstone variants.

## What none of the stories ask for

- **A regulation database.** They have eCFR. The course adds navigation, structure, and integration -- not the rules themselves.
- **Memorization.** Currency, recency, and proficiency are three separate concepts; the course teaches the analytical machinery, not flashcard recall. Spaced rep handles the recall side downstream.
- **Hand-holding through the easy parts.** Subparts that don't matter to working CFIs (Part 61 subpart D recreational, Part 91 subpart F large turbine) get named and located, not deep-dived. The course's economy of attention is the design.

## Crosscutting requirement -- the integration orals

Every story above ends in the capstone. The orals are the integration mechanism. A user who can deliver `night-ifr-passenger.md` without notes has internalized the entire course. A user who can also deliver `friend-flight-review.md` and `ppl-applies-for-ir.md` (the two we author here) has done it three different ways, which is what durable knowledge looks like.

This is why the two new capstones are not "nice to have." They're the tests-of-the-test that close out the course.
