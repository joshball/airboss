---
# === Identity ===
id: airspace-vfr-weather-minimums
title: VFR Weather Minimums
domain: airspace
cross_domains:
  - weather
  - regulations

# === Knowledge character ===
# factual: the numeric table itself (3-152, 500/1000/2000, etc.) is a
#   memorized artifact from 14 CFR 91.155.
# conceptual: the table is a surface expression of deeper physics --
#   see-and-avoid closure, startle+decide latency, IFR-emergence geometry,
#   and the 10,000 MSL speed-regime boundary. A pilot who only memorizes
#   the numbers cannot reconstruct them when pressured; a pilot who
#   understands the physics can derive a reasonable answer from scratch.
# judgment: in operational use the numbers set a legal floor, not a
#   safe-to-fly ceiling. Choosing whether to accept marginal-VMC or to
#   declare a diversion is a judgment call these minimums inform but do
#   not resolve.
knowledge_types:
  - factual
  - conceptual
  - judgment
technical_depth: working
stability: stable

# === Cert relevance (multi-dimensional) ===
relevance:
  - cert: private
    bloom: remember
    priority: core
  - cert: private
    bloom: apply
    priority: core
  - cert: instrument
    bloom: apply
    priority: core
  - cert: commercial
    bloom: apply
    priority: supporting
  - cert: cfi
    bloom: evaluate
    priority: core
  - cert: cfi
    bloom: create
    priority: core

# === Graph edges ===
requires:
  - airspace-classes-and-dimensions
  - wx-reading-metars-tafs
deepens: []
applied_by:
  - wx-go-nogo-decision
  - plan-vfr-cross-country
  - proc-special-vfr
taught_by:
  - teach-vfr-weather-minimums
related:
  - airspace-special-use
  - wx-ceiling-visibility-trends
  - reg-pilot-privileges-limitations

# === Content & delivery ===
modalities:
  - reading
  - cards
  - reps
  - visualization
estimated_time_minutes: 45
review_time_minutes: 8

# === References ===
references:
  - source: 14 CFR
    detail: 91.155 -- Basic VFR weather minimums
    note: The authoritative table. Structured by airspace class and altitude band. This is what the Reveal phase cites.
  - source: 14 CFR
    detail: 91.157 -- Special VFR weather minimums
    note: Escape hatch for operating in Class B/C/D/E surface area below standard mins. Referenced in Connect.
  - source: AIM
    detail: 3-1-4 -- Basic VFR weather minimums
    note: Plain-language restatement of 91.155 plus operational commentary. Often easier to quote to a student than the CFR.
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 15 -- Airspace. Basic VFR weather minimums table and discussion.
    note: The standard PPL-ground treatment. Useful for first exposure; thin on reasoning, which is why this node exists.
  - source: PHAK (FAA-H-8083-25C)
    detail: Chapter 13 -- Aviation Weather. Ceiling and visibility context.
    note: Bridges the weather domain (what ceiling and visibility actually are) to the airspace domain (what the numbers have to be).
  - source: AC 00-6B
    detail: Aviation Weather -- visibility and cloud reporting definitions.
    note: Foundation for understanding what "3 SM visibility" means operationally vs. as reported in a METAR.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - scenario
mastery_criteria: >
  Learner can (1) state the class-by-class VFR weather minimums from
  memory with no more than a 10% error on any single value (visibility
  or cloud clearance), (2) explain the physical reasoning behind the
  3 SM / 152 and 500 / 1000 / 2000 numbers without reference to the
  regulation, (3) correctly identify the altitude-band transition at
  10,000 MSL and explain why it exists, and (4) apply the minimums to
  a novel scenario that combines a specific airspace class, altitude,
  and reported weather, producing a go / no-go / divert answer with
  reasoning.
---

# VFR Weather Minimums

## Context

You are halfway through a VFR cross-country, 3,500 MSL over gently rising terrain, heading toward a towered field 45 nm away. The morning has been clear and smooth. Over the last twenty minutes the sky has started to fill in: scattered cumulus below you, a broken deck building ahead, visibility softening into a pale haze. The METAR you pulled before departure showed 10 SM and few clouds at 5,000. That METAR is now ninety minutes old. You have not talked to anyone yet.

Somewhere in the clouds ahead, an instrument student in a 172 is flying a practice approach into your destination. They are legal. They are in the cloud. They cannot see you.

This is the situation the VFR weather minimums exist to regulate. Not paperwork. Not test trivia. The minimums answer one question: **how much clear air do two aircraft need between them so that when they surprise each other, both pilots have time to live?**

Before looking up a single number, sit with the forces in play:

- IFR traffic can legally be inside that cloud. You cannot see into it.
- When an IFR aircraft pops out of the cloud's edge, the first time you see each other is the first time either of you can do anything about it.
- Closure rates between two small aircraft in cruise can easily exceed 200 kt. A jet on an arrival profile below 10,000 MSL is capped at 250 kt indicated, and that cap exists precisely because of this problem.
- Human pilots need time to see the target, recognize it as a threat, decide on an action, move the controls, and wait for the airplane to respond. The aircraft does not maneuver the instant you decide it should.

The VFR weather minimums are the engineering answer to that problem. The reg is 14 CFR 91.155. But the reg is downstream of the reasoning -- the reasoning came first, and the reasoning is the part you actually need when the weather is getting worse and you are not sure what the numbers were again.

## Problem

You are that VFR pilot. 3,500 MSL. Class E airspace (you verified this on the chart -- the magenta shading stops at the field, and you are above 1,200 AGL anyway). Eight miles from destination. Scattered cumulus drifting across your course at your altitude; a broken deck another 500 ft above. Ground visibility at the field is reported at 5 SM in haze. In the air, looking forward, you would call it somewhere between 3 and 5 miles.

Three questions, in order:

1. What are the legal minimums here?
2. Why those specific numbers? Not "because the FAA said so." What problem do those numbers solve?
3. If you could not remember the numbers, could you reconstruct a safe approximation from first principles, well enough to make a decision?

Question 3 is the one that matters. Memorizing a table is fragile. Reconstructing the table from the physics is durable.

## Discover

Work through these before reading the Reveal section. If you jump ahead, the discovery phase cannot do its job -- the numbers will look arbitrary rather than derived.

### Guided questions

1. **The closure problem.** An IFR aircraft exits a cloud horizontally, in cruise, at 150 kt. You are flying level at 120 kt on a converging course. Call the total closure rate at the moment of contact 250 kt for round numbers (roughly the sum of the two speeds on a head-on geometry). You need: 4 seconds to see and identify the threat, 2 seconds of startle response, 2 seconds to decide and begin control input, and 2 more seconds for the aircraft to actually change trajectory. That is 10 seconds of reaction time. **How far apart, in feet and then in statute miles, do you need to first see each other?** Work it out before reading on.

2. **The vertical-versus-horizontal asymmetry.** When an IFR aircraft emerges from a cloud, in which direction is it moving? Almost always roughly horizontally -- it is flying a route, not climbing or descending through the sidewall of a cumulus. Given that, if you are above the cloud, how much warning do you get? If you are below the cloud, how much warning do you get? If you are beside the cloud, how much warning do you get? **Which of these three positions is the most dangerous, and what does that tell you about the relative size of the horizontal versus vertical clearance requirements?**

3. **Why below is not symmetric with above.** A cloud base is where lift-condensation happens. An IFR descent profile typically goes *through* the base from above on approach. An IFR climb goes up through the top. **Which edge of the cloud is more likely to have traffic popping out at cruise airspeeds with the pilot configured to see outside, versus heads-down on instruments?** Why might the regulator want slightly more room below a cloud than above it? Hint: also think about which way *you* can most easily maneuver in a small aircraft below a cloud base versus above a cloud top.

4. **The 10,000 MSL boundary.** Below 10,000 MSL, the speed limit for all aircraft under 14 CFR 91.117 is 250 kt indicated. Above 10,000 MSL, that limit goes away (with some exceptions near Class B and C). What does that mean for closure rates? Now: if closure rates double, does the required clear-air separation need to double, or can the reaction time shrink to compensate? **Predict** what happens to the visibility requirement at 10,000 MSL, and predict what happens to the cloud clearance requirements. Work out numbers before looking.

5. **Class G is special -- why?** Class G is uncontrolled. No ATC separation service. No filed IFR routes at low altitude (IFR in Class G is legal but rare and does not receive separation from VFR). In daylight, close to the ground (within 1,200 ft AGL), the mix of traffic is almost entirely VFR aircraft doing pattern work, flight training, ag work, or low-level cruising. **If there is effectively no IFR traffic to worry about at low altitude in Class G during the day, what happens to the purpose of the minimums?** What do they still need to protect against, and what do they no longer need to protect against?

### Exercises

**Exercise D1 -- Derive the horizontal clearance.**

Given: closure rate 250 kt, reaction window 10 seconds.

- Convert 250 kt to feet per second. (1 kt is very close to 1.688 ft/sec, so 250 kt is approximately 422 ft/sec.)
- Multiply by 10 seconds: approximately 4,220 ft.
- Round up to a number a pilot could estimate at a glance from the cockpit. 2,000 ft is 1/3 statute mile. 4,000 ft is 2/3 statute mile.

Now compare against the horizontal clearance in the table you have not read yet. The table will say **2,000 ft horizontal** in most airspace classes. That is roughly half of the 4,220 ft "full reaction window" figure. Why the gap? Two reasons to consider:

- The IFR aircraft coming out of the cloud is not at 0 kt -- but the *closure rate* component perpendicular to the cloud wall is often much lower than a full 250 kt head-on. In many real geometries the effective horizontal closure into your path is closer to 100-150 kt.
- The regulator is setting a legal floor, not a comfortable margin. Real IMC dispatch planning uses bigger numbers.

The point is not that 2,000 ft is derivable exactly. The point is that 2,000 ft is the **same order of magnitude** as a reasoned reaction-window estimate, and it is clearly larger than any vertical number, which tells you the regulator was thinking about this same geometry.

**Exercise D2 -- Derive the vertical clearances, 500 below and 1,000 above.**

Given: IFR aircraft emerging at the base of a cloud is descending through the base at typical approach descent rates (say 500 fpm) in cruise configuration. IFR aircraft emerging at the top of a cloud is climbing at typical climb rates (say 700-1,000 fpm).

- For the **below** case: you are under the cloud, VFR. The IFR aircraft emerges downward through the base. How much vertical room do you need so that in your 10-second reaction window, the IFR aircraft does not collapse the remaining gap? At 500 fpm that is approximately 8.3 ft/sec, or about 83 ft in 10 seconds. You need reaction room, not catching-up room. 500 ft gives you six full reaction windows of margin. That is the floor.
- For the **above** case: you are above the cloud top. An IFR aircraft climbing out of the top is *coming toward you*. At 1,000 fpm that is approximately 166 ft in 10 seconds. 500 ft would still technically cover 10 seconds with margin, but consider the harder problem: above the cloud, you cannot easily descend away from the threat (you would descend *into* the cloud you are trying to stay clear of). Your escape vector is limited to turning or climbing. 1,000 ft gives the climbing IFR aircraft level-off room before intrusion. 500 ft does not.

Again, these are *order-of-magnitude justifications*, not proofs. The derivation shows the numbers are not arbitrary: 1,000 > 500 because the geometry is less forgiving above than below.

**Exercise D3 -- Predict the 10,000 MSL jump.**

Given your reasoning in question 4, write out -- *before looking* -- your prediction for:

- Visibility requirement above 10,000 MSL: ____ SM
- Cloud clearance below: ____ ft
- Cloud clearance above: ____ ft
- Cloud clearance horizontal: ____ ft or ____ SM

When you check against the Reveal section, notice which ones you predicted correctly from physics and which ones surprised you. The ones that surprised you are the ones to examine -- there is a design reason the regulator chose those specific values.

## Reveal

### The regulation: 14 CFR 91.155

Now -- and only now -- the table. Every number below is a consequence of the reasoning you just did. The regulation is the regulator's summary of the same physics.

| Airspace                                               | Flight visibility | Distance from clouds                                |
| ------------------------------------------------------ | ----------------- | --------------------------------------------------- |
| Class A                                                | N/A               | N/A (IFR only)                                      |
| Class B                                                | 3 SM              | Clear of clouds                                     |
| Class C                                                | 3 SM              | 500 ft below / 1,000 ft above / 2,000 ft horizontal |
| Class D                                                | 3 SM              | 500 ft below / 1,000 ft above / 2,000 ft horizontal |
| Class E, less than 10,000 MSL                          | 3 SM              | 500 ft below / 1,000 ft above / 2,000 ft horizontal |
| Class E, 10,000 MSL and above                          | 5 SM              | 1,000 ft below / 1,000 ft above / 1 SM horizontal   |
| Class G, day, 1,200 AGL or less                        | 1 SM              | Clear of clouds                                     |
| Class G, day, more than 1,200 AGL but < 10,000 MSL     | 1 SM              | 500 ft below / 1,000 ft above / 2,000 ft horizontal |
| Class G, night, 1,200 AGL or less                      | 3 SM              | 500 ft below / 1,000 ft above / 2,000 ft horizontal |
| Class G, night, more than 1,200 AGL but < 10,000 MSL   | 3 SM              | 500 ft below / 1,000 ft above / 2,000 ft horizontal |
| Class G, 10,000 MSL and above                          | 5 SM              | 1,000 ft below / 1,000 ft above / 1 SM horizontal   |

**Key exception for Class G night traffic patterns.** 14 CFR 91.155(b)(2) allows an airplane operating within 1/2 mile of the runway at an airport in Class G airspace at night to use 1 SM visibility and clear-of-clouds, provided the airport's traffic pattern is used and the aircraft is in the pattern. This is the "touch-and-go at night at an uncontrolled field with 1 SM" case -- narrow in scope, easy to misquote, worth memorizing as an exception rather than a rule. `TODO(verify): exact wording and subparagraph numbering of the night pattern exception against current 14 CFR 91.155(b) text.`

**Key exception for Class B.** Student pilots and sport pilots are not permitted to solo in Class B at all (or only with specific endorsements and airport restrictions -- see 14 CFR 61.95). The 3 SM / clear-of-clouds minimum in the table is the *weather* minimum; certificate and endorsement requirements are separate.

### Why Class B is "clear of clouds" and not 500/1000/2000

Class B surrounds the busiest airports in the country. ATC provides separation between all IFR *and all VFR* aircraft inside Class B. If ATC is separating you from the IFR traffic, you do not need a geometric buffer to protect yourself from a surprise emergence -- the controller already did. The clear-of-clouds requirement remains because you still need to see outside to comply with see-and-avoid against other VFR traffic ATC is also working. The visibility stays at 3 SM because the controller is not flying the airplane for you, and you still need enough forward visibility to navigate, identify the runway environment, and react to the unexpected.

Class B is the one place the physics-derived 500/1000/2000 numbers are waived, and the reason is that a piece of the physics -- the surprise IFR emergence -- has been eliminated by the service itself.

### Why the 10,000 MSL band is 5 SM and 1,000/1,000/1 SM

Above 10,000 MSL, the 250 kt speed limit of 14 CFR 91.117 no longer applies (except in specific airspace such as below the ceiling of a Class B, within 4 nm of the primary Class C/D airport at or below 2,500 AGL, and certain other locations). Closure rates in the high teens and low twenties can push past 500 kt total. Your 10-second reaction window, applied to a 500 kt closure, gives roughly 8,400 ft of required horizontal separation -- which is almost exactly the 1 SM (5,280 ft) horizontal clearance the reg requires. The visibility requirement jumps to 5 SM for the same reason: at higher closure speeds, the forward distance you need to see a threat and react to it grows. The vertical clearances become symmetric at 1,000 ft because above 10,000 MSL the aircraft mix shifts toward faster, higher-performance traffic with higher climb and descent rates, which flattens the above-versus-below asymmetry that justified 500 below at lower altitudes.

### Why Class G at low altitude, day, is 1 SM / clear of clouds

Low Class G in the daytime is dominated by slow VFR traffic doing pattern work, training, ag work, and low cruising. IFR traffic at 500 AGL over a farm field is essentially not a real threat. The minimums relax to let this low-and-slow community operate on days when ceilings preclude higher-altitude cruising. At night, the aircraft mix does not change much, but *you* change: visual cues degrade, spatial disorientation risk rises, and the regulator tightens the numbers to 3 SM and 500/1000/2000 to compensate for the pilot-side physics rather than the traffic-side physics.

### The summary sentence

Every number in the table comes from one of three physical arguments:

- **See-and-avoid geometry** (closure rate times reaction time -> horizontal clearance and visibility).
- **IFR-emergence asymmetry** (which cloud edge does IFR traffic come out of, and can the VFR pilot escape that direction -> vertical clearance above vs. below).
- **Pilot-side degradation** (night, IMC mix, unfamiliar airspace -> tighter numbers to compensate for reduced human performance).

The regulation confirms your reasoning. If you forget the table in flight, you can reconstruct a defensible floor from the reasoning -- and if the reasoning says "more room than the reg requires," take more room. The reg is the floor, not the plan.

### Location skill

When you are at an unfamiliar airport or transitioning between classes:

1. Check the **sectional chart** or the **airport's chart supplement entry** to confirm the airspace class and ceiling/floor at your altitude.
2. Open the **AIM, section 3-1-4**, for the plain-language minimums table. This is usually the fastest in-flight reference if you have ForeFlight or an equivalent.
3. For the regulatory text (edge cases, exceptions, Special VFR hooks), go to **14 CFR 91.155**.
4. For Special VFR specifically (operating below standard mins in Class B/C/D/E surface area), go to **14 CFR 91.157** -- different rules, different conditions, different request procedure.

Default muscle memory: AIM first for the table, CFR second for the fine print.

## Practice

### Cards (spaced repetition)

Authored inline. `bun run knowledge seed --user <email>` materializes these as `study.card` rows linked to this node, and they flow through the normal `/memory/review` FSRS queue. The numeric table is the factual pillar; the `-why` cards exist to keep the reasoning resident in memory, not just the values.

```yaml-cards
- front: "VFR weather minimums in Class B: visibility and cloud clearance?"
  back: "3 SM visibility, clear of clouds. (No 500/1000/2000 buffer -- ATC separates all traffic inside Class B, so the surprise-emergence geometry the buffer protects against has already been handled.)"
  cardType: basic
  tags: [vfr-mins, class-b, 91.155]
- front: "VFR weather minimums in Class C or D: visibility and cloud clearance?"
  back: "3 SM, 500 below / 1000 above / 2000 horizontal."
  cardType: basic
  tags: [vfr-mins, class-c, class-d, 91.155]
- front: "VFR weather minimums in Class E below 10,000 MSL: visibility and cloud clearance?"
  back: "3 SM, 500 below / 1000 above / 2000 horizontal."
  cardType: basic
  tags: [vfr-mins, class-e, 91.155]
- front: "VFR weather minimums in Class E at or above 10,000 MSL: visibility and cloud clearance?"
  back: "5 SM, 1000 below / 1000 above / 1 SM horizontal. (Higher numbers because above 10,000 MSL the 250 kt speed limit of 91.117 no longer applies, so closure rates can push past 500 kt.)"
  cardType: basic
  tags: [vfr-mins, class-e, high-altitude, 91.155]
- front: "VFR weather minimums in Class G, day, 1,200 AGL or less: visibility and cloud clearance?"
  back: "1 SM, clear of clouds."
  cardType: basic
  tags: [vfr-mins, class-g, day, 91.155]
- front: "VFR weather minimums in Class G, day, more than 1,200 AGL but less than 10,000 MSL: visibility and cloud clearance?"
  back: "1 SM, 500 below / 1000 above / 2000 horizontal."
  cardType: basic
  tags: [vfr-mins, class-g, day, 91.155]
- front: "VFR weather minimums in Class G at night (below 10,000 MSL): visibility and cloud clearance?"
  back: "3 SM, 500 below / 1000 above / 2000 horizontal. (Tighter than Class G day because the pilot's visual acquisition degrades at night, not because the traffic mix changed.)"
  cardType: basic
  tags: [vfr-mins, class-g, night, 91.155]
- front: "91.155(b)(2) traffic-pattern exception: what does it allow and where?"
  back: "At an airport in Class G at night, within 1/2 mile of the runway and operating within the traffic pattern, you may operate at 1 SM visibility and clear of clouds. Narrow in scope and easy to misquote -- memorize as an exception, not a rule."
  cardType: regulation
  tags: [vfr-mins, class-g, night, pattern, 91.155]
- front: "Why does the 10,000 MSL altitude boundary change the VFR minimums?"
  back: "Below 10,000 MSL, 91.117 caps indicated airspeed at 250 kt. Above 10,000 MSL, that cap is lifted (with specific exceptions near Class B/C and below FL180). Closure rates can approach 500 kt. Reaction-window math (closure x 10 sec) puts the required horizontal separation near 1 SM, so the reg jumps to 5 SM vis and 1 SM horizontal. The aircraft mix above 10k also flattens the above/below cloud asymmetry, so vertical clearances become symmetric at 1000/1000."
  cardType: basic
  tags: [vfr-mins, reasoning, 91.117, 91.155]
- front: "Why is horizontal cloud clearance (2000 ft) larger than vertical (500/1000)?"
  back: "An IFR aircraft emerges from a cloud almost always horizontally (flying a route, not climbing/descending through a sidewall). A VFR aircraft beside a cloud gets zero vertical separation and must rely entirely on horizontal buffer. Closure x reaction-time math puts the needed horizontal buffer in the 2000-4000 ft band; the reg picks 2000 ft as the floor."
  cardType: basic
  tags: [vfr-mins, reasoning, geometry]
- front: "Why is vertical cloud clearance asymmetric -- 500 below vs. 1000 above -- at low altitude?"
  back: "Below the cloud, IFR traffic emerges downward through the base at approach descent rates (~500 fpm); you can escape by descending further. Above the cloud, IFR traffic climbs up through the top at climb rates (~1000 fpm) and you cannot escape by climbing (you'd enter the cloud you're clearing). The 1000 ft above requirement gives the climbing IFR aircraft level-off room before intrusion."
  cardType: basic
  tags: [vfr-mins, reasoning, geometry]
- front: "Why is Class B 'clear of clouds' rather than 500/1000/2000?"
  back: "Inside Class B, ATC provides separation between ALL IFR and ALL VFR traffic. The geometric buffer exists to protect against surprise emergence from IMC; if ATC has already separated you from IFR traffic, that threat model is eliminated. The 3 SM visibility still stands because you still need to see outside for VFR-vs-VFR see-and-avoid and for runway identification."
  cardType: basic
  tags: [vfr-mins, class-b, reasoning]
```

### Reps (scenario-based decision practice)

- `rep:vfr-mins-deteriorating-xc-class-e`
- `rep:vfr-mins-night-pattern-class-g`
- `rep:vfr-mins-transition-class-e-to-g`
- `rep:vfr-mins-above-10k-cruise-decision`
- `rep:vfr-mins-special-vfr-request-class-d`

### Drills

- `drill:vfr-mins-table-recall-timed`
- `drill:vfr-mins-class-identification-from-chart`

### Calculations

**Calculation P1 -- Closure-rate-to-clearance sanity check.**

Two light aircraft, each cruising at 130 KTAS on exactly converging head-on tracks. Compute total closure in ft/sec. Given a 10-second see-startle-decide-react budget, what horizontal separation does each pilot need when the other becomes visible? Compare to the 2,000 ft horizontal requirement in most classes. What does the gap tell you about how much real-world reaction time 2,000 ft actually buys?

**Calculation P2 -- Descending IFR traffic and the 500 ft below floor.**

An IFR aircraft on a stabilized approach is descending through a cloud base at 500 fpm, groundspeed 100 kt. You are VFR beneath the base. Compute: (a) vertical speed in ft/sec, (b) the vertical distance the IFR aircraft covers in a 10-second reaction window, and (c) the multiple of that distance represented by the 500 ft below-cloud requirement. What does this tell you about the margin built into the 500 ft floor?

**Calculation P3 -- The 10,000 MSL visibility jump.**

Assume total closure rate above 10,000 MSL can approach 500 kt. Convert to ft/sec. Multiply by a 12-second reaction window (slightly longer because threats at altitude are often harder to visually acquire). Express the result in statute miles. Compare to the 5 SM requirement. Does the reg appear to build in margin, or is it cutting it close?

## Connect

### "What changes if..." prompts

- **What changes if you are a student pilot?** 14 CFR 61.89 restricts solo flight for student pilots to specific weather conditions -- generally 3 SM day visibility and clear of clouds, tighter than some of the above. The airspace minimum is the floor; the certificate minimum may be tighter. Check both.
- **What changes if you want to fly VFR into a Class B, C, D, or E surface area when the reported ceiling is below 1,000 ft or visibility is below 3 SM?** This is the Special VFR case -- 14 CFR 91.157. You must request it from ATC, receive a clearance, and operate at 1 SM visibility clear of clouds in daytime. Night Special VFR requires the pilot to hold an instrument rating and the aircraft to be IFR-equipped. See `proc-special-vfr`.
- **What changes above FL180?** Class A -- IFR only. VFR minimums do not apply because VFR operations are not permitted.
- **What changes for balloon, glider, or ultralight operations?** 14 CFR 91.155 applies. Some operating rules for specific aircraft categories modify related requirements, but the visibility and cloud-clearance table is universal for powered airplanes operating under Part 91. `TODO(verify): balloons and gliders have additional special rules under Part 91 subpart E/F that modify basic VFR minimums -- confirm the exact modifications before teaching this phrase to a student.`
- **What changes if the reported visibility is 3 SM but you are looking into a sun angle or haze layer and your actual forward visibility is less?** Legally the flight visibility is what you observe from the cockpit -- not what the tower reported. If you cannot see 3 SM from the cockpit, you are in violation regardless of the reported number. This is a judgment call the pilot owns.
- **What changes if the ceiling is 1,000 ft and you are flying under 1,000 AGL in Class E?** Class E starts at 700 or 1,200 AGL depending on chart shading. If you are under the Class E base, you are in Class G, and the Class G minimums apply. Airspace is altitude-dependent and the applicable minimums change with it.

### Linked nodes for further exploration

- `airspace-classes-and-dimensions` -- what each class is and where it starts and ends in three dimensions. Prerequisite.
- `wx-reading-metars-tafs` -- how to read the reported visibility and ceiling you are comparing against these minimums. Prerequisite.
- `wx-ceiling-visibility-trends` -- how to interpret trend data (BECMG, TEMPO, PROB30) when planning VFR. Related.
- `wx-go-nogo-decision` -- the broader ADM framework where these minimums are one input among several. Applied-by.
- `plan-vfr-cross-country` -- the operational context where minimums interact with fuel, alternates, and time. Applied-by.
- `proc-special-vfr` -- the escape hatch when minimums are not met but operation is still desired. Applied-by.
- `reg-pilot-privileges-limitations` -- how certificate level affects which of these minimums apply. Related.
- `airspace-special-use` -- MOAs, restricted areas, prohibited areas that overlay these classes. Related.
- `teach-vfr-weather-minimums` -- the CFI-level pedagogical node for teaching this topic to a student. Taught-by.

## Verify

### Novel application scenario

You are 15 nm out on a VFR cross-country to a non-towered field. Your current position is 2,000 AGL in Class G (you verified the chart shows the Class E base in this area is at 1,200 AGL -- but your chart shows the faded-magenta wide border, putting the Class E base at 1,200 AGL and leaving you still in Class G right now; ahead, you will enter an area where Class E floors at 700 AGL). You are descending at 500 fpm toward a planned pattern entry at 1,000 AGL. It is 1600 local, daytime.

The destination field reports via automated weather: 4 SM visibility, ceiling 1,500 broken, temperature 12 C / dewpoint 10 C.

Work the problem on paper before looking at the analysis:

1. What airspace class are you in right now, at this altitude?
2. What class will you be in at pattern altitude over the field?
3. What are the minimums in each?
4. Do reported conditions meet the minimums in each?
5. What is the required cloud clearance during the last part of your descent when the ceiling is 1,500 AGL and pattern altitude is 1,000 AGL?
6. Go, no-go, or divert? Why?

**Expected reasoning path.** At 2,000 AGL in Class G daytime above 1,200 AGL, minimums are 1 SM and 500/1000/2000. Reported 4 SM beats 1 SM with margin. The Class G segment is not the binding problem. At pattern altitude near the destination, you will be in Class E (the faded-magenta Class E floor at 700 AGL applies there), below 10,000 MSL, so minimums become 3 SM and 500/1000/2000. Reported 4 SM still beats 3 SM -- visibility is not the binding constraint.

The binding constraint is the cloud clearance. A 1,500 ft broken ceiling means a broken deck starting 1,500 ft above the reporting station. Pattern altitude is typically 1,000 AGL. That puts the cloud base at 1,500 AGL and your pattern altitude at 1,000 AGL, giving you 500 ft between pattern and the broken deck. In Class E below 10,000 MSL, you need 500 ft below the cloud -- you are exactly at the legal minimum, with zero margin, and a "broken" deck means 5/8 to 7/8 coverage, so you will be under cloud for most of the pattern. One sag in the ceiling and you are illegal without warning. Additionally, the temperature/dewpoint spread of 2 C means the ceiling is likely dropping, not holding.

Defensible answer: **divert or delay**. Legal at this moment, not safely legal for the next 20 minutes given the trend. A VFR pilot who accepts this situation without a plan is accepting an ongoing coin flip. The minimums are met; the margin is not. That distinction is the whole point of having reasoning behind the numbers rather than just the numbers.

### CFI teaching exercise

A private-pilot student, reading through 91.155 for the first time, raises their hand in a ground session:

> "The table says Class E below 10,000 has 2,000 ft horizontal clearance from clouds. And Class G day above 1,200 AGL also has 2,000 ft horizontal. So why even distinguish the two? The horizontal number is the same. It feels like the FAA just wrote the same thing twice."

The student is looking at the table and seeing what the table shows them -- that in that specific row-and-column intersection, the horizontal value is identical. They have not yet seen that the *purpose* of the two minimums is different, and that the identical horizontal number is a coincidence of the constraint being met by two different reasoning paths.

**Design a teaching response**, not an answer. The response should:

1. Validate the observation -- the student is not wrong that the horizontal numbers are identical.
2. Reframe the question from "why two rows" to "what is each row protecting against."
3. Walk the student through the Class E case (controlled airspace with mixed IFR/VFR, IFR traffic can legally be in clouds, VFR must stay 2,000 ft horizontal to give see-and-avoid reaction room against surprise IFR emergence).
4. Walk the student through the Class G case (uncontrolled, IFR traffic rare at low altitude, the horizontal clearance is less about IFR emergence and more about staying visually oriented and maintaining visual separation from other VFR traffic who may also be hugging the cloud base).
5. End with a probing question that tests whether the student has absorbed the reasoning: something like "if we doubled the amount of IFR traffic in Class G at low altitude, would you expect the horizontal clearance requirement to change? Why or why not?"

The pedagogical hook is **not** "here is the reason the numbers are the same." The hook is "the numbers being the same is the least interesting thing about these two rows -- the interesting thing is what each row exists to protect against." A student who learns to ask "what problem is this number solving?" instead of "what is this number?" has learned the durable version of the minimums.

Score yourself (or your student) on whether the response hits all five moves, and whether the final probing question actually requires the student to reason rather than recite.
