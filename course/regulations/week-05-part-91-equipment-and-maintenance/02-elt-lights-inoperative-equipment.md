---
title: ELTs, lights, and inoperative equipment -- 91.207 + 91.209 + 91.213
week: 5
section_order: "02"
last_verified: 2026-04-29
cites:
  knowledge_nodes:
    - flight-planning/vfr-cross-country
  acs_leaves:
    - PA.I.B.K1
    - PA.I.B.K2
  handbook_sections:
    - airboss-ref:regs/cfr-14/91/207
    - airboss-ref:regs/cfr-14/91/209
    - airboss-ref:regs/cfr-14/91/213
---

# ELTs, lights, and inoperative equipment

Three sections that look unrelated. They aren't. Each answers a question pilots fail on checkrides because the *exception structure* is buried in the section body:

- **91.207** -- when does an airplane need an ELT, and when may a pilot fly without one?
- **91.209** -- when must lights be on, and what is "operating" the lights?
- **91.213** -- something required by 91.205 is broken; what now?

The three together form the "what's actually working" half of the equipment story. Lesson 01 told you what's *required*. This lesson tells you what to do when something required isn't *working*, and clarifies two specific equipment items (the ELT and the lights) that have their own dedicated sections.

## What you'll be able to do

- Apply 91.207 to determine ELT requirement, testing intervals, battery replacement triggers, and recognized exemptions
- Recall and apply 91.209 lighting rules including the sunset-to-sunrise window, the anticollision exception, and the "operating" definition
- Walk the no-MEL pathway in 91.213(d) for an inoperative item, including all four steps (required-by-205-or-AD; placard; logbook entry; placard wording)
- Distinguish a Minimum Equipment List operation under 91.213(a)(b)(c) from a no-MEL operation under 91.213(d)
- Counsel a pilot on whether a specific inop item grounds the flight or is dispatchable through 91.213(d)

## Why this matters

Almost every Part 91 GA airplane operates without an MEL. The pilot's only legal pathway when something is inop is 91.213(d). Pilots who don't understand (d) end up either grounding flights they could have legally made or, worse, launching with equipment the regulation does not permit them to defer.

The ELT section is on every checkride because the testing-and-battery rules are specific and easy to misstate, and the exemption list contains real operational opportunities (training flights within 50 nm of the home base, ferry flights, demonstration flights) that pilots often forget exist.

91.209 is the section that catches pilots who launch at "civil twilight" thinking position lights aren't required yet. They are. The reg uses sunset-to-sunrise, not civil twilight.

## The discovery question

A pilot is preflighting their personally-owned 172 for a VFR cross-country. They notice on the panel that the alternator-out warning light has burned out (the bulb is dead). The alternator itself is working fine; it's only the warning light that's broken. The flight is VFR day. The aircraft has no MEL.

Pause.

Is this a 91.213 question, and what is the resolution?

The alternator is required by 91.205(d)(7) for IFR but not for VFR day. The alternator-out warning *light* is not specifically called out by 91.205. So is it required equipment?

Read 91.213(d)(2)(ii). The pilot or a certificated mechanic determines whether the inop item is required by:

- 91.205 (the equipment list)
- An equipment list issued for the specific aircraft (the type certificate's KOEL or the POH equipment list)
- An airworthiness directive (AD)
- The aircraft's certificate basis (the type design)

Most POHs include a Kinds of Operations Equipment List (KOEL) that specifies whether each piece of equipment is required for VFR day, VFR night, IFR, etc. The 172 POH KOEL typically lists the alternator failure warning light as required equipment. So even though 91.205 doesn't list it, the *type-design equipment list* may.

The pilot needs to: (1) check the KOEL; (2) if not required by 91.205, KOEL, AD, or type design, proceed through the 91.213(d) deferral steps.

This is the typical case. The 91.213(d) decision tree is the single most-used regulatory tree in dispatch.

## What 91.207 actually says

```text
§91.207  Emergency locator transmitters.

(a) Except as provided in paragraphs (e) and (f) of this section, no
    person may operate a U.S.-registered civil airplane unless --

  (1) There is attached to the airplane an approved automatic type
      emergency locator transmitter that is in operable condition for
      the following operations, except that after June 21, 1995, an
      emergency locator transmitter that meets the requirements of
      TSO-C91 may not be used for new installations: ...

(b) Each emergency locator transmitter required by paragraph (a) of
    this section must be attached to the airplane in such a manner
    that the probability of damage to the transmitter in the event
    of crash impact is minimized.

(c) Batteries used in the emergency locator transmitters required by
    paragraphs (a) and (b) of this section must be replaced (or
    recharged, if the batteries are rechargeable) --

  (1) When the transmitter has been in use for more than 1 cumulative
      hour; or

  (2) When 50 percent of their useful life ... has expired ...

(d) Each emergency locator transmitter ... must be inspected within
    12 calendar months after the last inspection ...

(e) ... (exceptions: ferry flights, training flights within 50 nm of
    departure, demonstration flights, design and test flights, ...)

(f) Notwithstanding paragraph (a) of this section, a person may --
  (1) Ferry a newly acquired airplane from the place where possession
      of it was taken to a place where the emergency locator
      transmitter is to be installed; and
  (2) Ferry an airplane with an inoperative emergency locator
      transmitter from a place where repairs or replacements cannot
      be made to a place where they can be made.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structure to internalize:

1. **Most U.S.-registered civil airplanes need an ELT.** The exemptions in (e) and (f) are narrow and operational.
2. **The ELT must be in operable condition.** A non-operable ELT is a 91.207(a) violation, not just a 91.213 deferral candidate.
3. **The 121.5 MHz ELT is being phased out.** TSO-C91 (older 121.5 MHz units) may not be used for *new installations* after June 21, 1995. The current standard is TSO-C126 (406 MHz with GPS encoding).
4. **Battery replacement triggers** are specific and frequently misstated:
    - More than 1 cumulative hour of transmitter use, OR
    - 50% of the battery's useful life has expired (manufacturer rated)
5. **12-calendar-month inspection.** Same calendar-month math as the rest of Part 91 -- inspected within the 12 calendar months following the last inspection.

### The 91.207 exemptions

91.207(e) and (f) provide narrow exemptions:

| Operation                                                              | Exemption                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Aircraft engaged in scheduled flights by air carriers under Part 121   | (e)(1) -- exempt by virtue of Part 121 ELT alternatives |
| Training flights within 50 nm of the airport at which the flight began | (e)(2) -- ELT not required                              |
| Flights for the purpose of design and testing                          | (e)(3) -- exempt                                        |
| Ferry flight from acquisition to installation site                     | (f)(1) -- exempt                                        |
| Ferry flight to a repair facility for an inop ELT                      | (f)(2) -- exempt                                        |
| Aircraft engaged in agricultural operations                            | (e)(8) -- exempt                                        |
| New aircraft delivery flights                                          | (f)(1) -- exempt                                        |

The training flight exemption is the most operationally relevant. A flight school doing a flight review or a primary training flight that stays within 50 nm of the airport may operate an airplane with an inop ELT *without* ferrying it -- the exemption removes the ELT requirement for that operation. The 50 nm is great-circle distance from the airport at which the flight began.

The trap: the exemption applies "while engaged in" the training flight. A "cross-country with my CFI" past 50 nm is not within the exemption -- it's a cross-country flight, not a training flight within 50 nm of departure. The exemption is specific.

### The cumulative-hour math

A pilot who tested the ELT for 5 minutes (the test is described in 91.207(d)) has accumulated 5 minutes of transmitter use. That doesn't trigger battery replacement (need 1 hour cumulative). A pilot who fired the ELT during a hard landing for 30 minutes before someone shut it off has accumulated 30 minutes -- still no replacement trigger. A second event of 35 minutes -- now 65 minutes cumulative -- triggers replacement.

Most operators replace the battery when the manufacturer's calendar life expires (the 50% useful-life rule), not based on cumulative-hour tracking. The cumulative-hour rule exists for the rare case where a real activation has consumed significant battery life.

## What 91.209 actually says

```text
§91.209  Aircraft lights.

No person may, during the period from sunset to sunrise (or, in
Alaska, during the period a prominent unlighted object cannot be seen
from a distance of 3 statute miles or the sun is more than 6 degrees
below the horizon) --

(a) Operate an aircraft unless it has lighted position lights;

(b) Park or move an aircraft in, or in dangerous proximity to, a
    night flight operations area of an airport unless the aircraft --
  (1) Is clearly illuminated;
  (2) Has lighted position lights; or
  (3) Is in an area that is marked by obstruction lights.

(c) Anchor an aircraft unless the aircraft --
  (1) Has lighted anchor lights; or
  (2) Is in an area where anchor lights are not required on
      vessels.

(d) Operate an aircraft, that is equipped with an anticollision light
    system, unless it has lighted anticollision lights. However, the
    anticollision lights need not be lighted when the pilot in command
    determines that, because of operating conditions, it would be in
    the interest of safety to turn the lights off.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural insight: **91.209 has two timing windows.**

```text
Position lights:        sunset to sunrise
Anticollision lights:   any time the aircraft is operating, day or
                        night, IF an anticollision system is installed
```

Most pilots get the position-light window right (sunset-to-sunrise, not civil twilight). They get the anticollision-light window wrong. 91.209(d) requires the anticollision lights to be on *whenever the aircraft is operating*, not just at night. The day-VFR pilot taxiing out for a noon flight is required by 91.209(d) to have the strobes on, unless the pilot determines safety is best served by turning them off (rain reflecting strobe glare, taxiing in a busy ramp at night with operations dazzled, formation flying, etc.).

The "in the interest of safety" exception is the pilot's call, not the controller's. ATC asking you to turn strobes off is a request, not a clearance. You may decline if you think safety requires them on.

The anchor-lights paragraph (c) is for seaplanes. Niche; mention and move on.

### "Operating" -- when does 91.209 trigger?

"Operate" in 91.209 covers everything from taxi through landing. A pilot who has the engine running with the airplane stopped is operating. A pilot taxiing is operating. The position-lights and anticollision-lights requirements apply throughout the operation. The anticollision-light "from sunset to sunrise" position-light requirement does not extend to before-engine-start time when the airplane is parked unattended -- that's the (b) provision (parking near a night-ops area requires illumination, position lights, *or* obstruction lights in the area).

### Why position lights are sunset-to-sunrise (not twilight)

Pilots routinely confuse the night currency window in 61.57(b) -- which uses "1 hour after sunset to 1 hour before sunrise" -- with the lights window in 91.209 -- which uses "sunset to sunrise" plain. The night-currency window is *narrower* (you can carry pax at sunset-plus-30-minutes if you have current daytime landings, because the night-currency rule starts an hour after sunset). The lights window is *wider* (lights must be on from sunset, not from sunset plus an hour).

The result: there is a 1-hour window after sunset where a pilot legally could carry passengers on day currency alone, but during which 91.209 requires position lights to be on. No conflict; the rules answer different questions.

### Civil twilight is not in the rule

The pilot logbook tradition of marking "night" by reference to civil twilight (sun more than 6 degrees below horizon, occurring later than sunset by some minutes depending on latitude and season) is for *logging* under [@cite](airboss-ref:regs/cfr-14/61/51?at=2026). 91.209 uses sunset-to-sunrise plain. The Alaska variation is the exception -- 91.209 explicitly references the 6-degrees-below-horizon test for Alaska latitudes where the standard sunset-sunrise math doesn't behave.

## What 91.213 actually says

```text
§91.213  Inoperative instruments and equipment.

(a) Except as provided in paragraph (d) of this section, no person
    may take off an aircraft with inoperative instruments or
    equipment installed unless the following conditions are met:

  (1) An approved Minimum Equipment List exists for that aircraft.
  (2) The aircraft has within it a letter of authorization, issued
      by the FAA Flight Standards district office having
      jurisdiction over the area in which the operator is located,
      authorizing operation of the aircraft under the Minimum
      Equipment List. ...
  (3) The approved Minimum Equipment List must --
    (i) Be prepared in accordance with the limitations specified
        in paragraph (b) of this section; and
    (ii) Provide for the operation of the aircraft with the
         instruments and equipment in an inoperable condition.
  (4) The aircraft records ... contain an entry describing the
      inoperative instruments and equipment.

(b) The following instruments and equipment may not be included in
    a Minimum Equipment List: [items required by airworthiness rule,
    AD, type certificate, etc.]

(c) ... [paragraph for ferry permits etc.]

(d) Except for operations conducted in accordance with paragraph (a)
    or (c) of this section, a person may take off an aircraft in
    operations conducted under this part with inoperative instruments
    and equipment without an approved Minimum Equipment List provided --

  (1) The flight operation is conducted in a --
    (i) Rotorcraft, non-turbine-powered airplane, glider, lighter-
        than-air aircraft, powered parachute, or weight-shift-
        control aircraft for which a master minimum equipment list
        has not been developed; or
    (ii) Small rotorcraft, nonturbine-powered small airplane,
         glider, or lighter-than-air aircraft for which a Master
         Minimum Equipment List has been developed;

  (2) The inoperative instruments and equipment are not --
    (i) Part of the VFR-day type certification instruments and
        equipment prescribed in the applicable airworthiness
        regulations under which the aircraft was type certificated;
    (ii) Indicated as required on the aircraft's equipment list, or
         on the Kinds of Operations Equipment List for the kind of
         flight operation being conducted;
    (iii) Required by §91.205 or any other rule of this part for
          the specific kind of flight operation being conducted;
          or
    (iv) Required to be operational by an airworthiness directive;
         and

  (3) The inoperative instruments and equipment are --
    (i) Removed from the aircraft, the cockpit control placarded,
        and the maintenance recorded in accordance with §43.9 of
        this chapter; or
    (ii) Deactivated and placarded "Inoperative." If deactivation
         of the inoperative instrument or equipment involves
         maintenance, it must be accomplished and recorded in
         accordance with part 43 of this chapter; and

  (4) A determination is made by a pilot, who is certificated and
      appropriately rated under part 61 of this chapter, or by a
      person, who is certificated and appropriately rated to
      perform maintenance on the aircraft, that the inoperative
      instrument or equipment does not constitute a hazard to the
      aircraft.

Note: paraphrase. Read the actual reg before referencing in exam.
```

This is one of the most operationally important sections in Part 91. Read it twice.

### The two pathways

```text
91.213 has two pathways:

  PATHWAY 1: With an MEL  (paragraphs (a), (b), (c))
    The operator has an FAA-approved Minimum Equipment List
    and a letter of authorization. The MEL specifies which
    items can be deferred and under what conditions. Most
    GA pilots never see this pathway -- it's for fleets,
    airlines, fractionals, and corporate operators.

  PATHWAY 2: No MEL  (paragraph (d))
    The aircraft has no FAA-approved MEL. The pilot uses
    the four-step (d) test to determine whether to fly with
    the inop item. This is the path 99% of GA pilots use.
```

Most flight schools, individual owners, and clubs operate without an MEL. Their pathway is 91.213(d). Period.

### The 91.213(d) four-step test

For the no-MEL pathway, the pilot (or a certificated mechanic) runs through four questions:

```text
Step 1: Is the inop item required by 91.205?
        If YES -> cannot defer; flight grounded.
        If NO  -> continue.

Step 2: Is the inop item required by the type-design equipment list
        (KOEL or POH equipment list) for this kind of operation?
        If YES -> cannot defer; flight grounded.
        If NO  -> continue.

Step 3: Is the inop item required by an airworthiness directive (AD)?
        If YES -> cannot defer; flight grounded.
        If NO  -> continue.

Step 4: Is the inop item required by any other rule of Part 91 for
        this specific kind of operation?
        If YES -> cannot defer; flight grounded.
        If NO  -> proceed with deferral.
```

If all four are NO, the pilot proceeds with deferral:

```text
Deferral process (all required, in order):

  (a) Either:
      - Remove the inop item from the airplane and placard the
        cockpit control; OR
      - Deactivate the item and placard it "INOPERATIVE."

  (b) The placard must be visible to the pilot.

  (c) Record the maintenance in accordance with 14 CFR 43.9
      (the maintenance entry).

  (d) The pilot (or a mechanic) determines the inop item does not
      constitute a hazard to the aircraft.
```

The placard is the *third step*, not the first. Pilots commonly think "if I just placard it INOPERATIVE I can fly." Wrong. Placard is what you do *after* you've established (1) the item isn't required by any of the four authorities and (2) it doesn't constitute a hazard. Placard alone is not authorization to defer.

### Step 1 in detail -- the 91.205 lookup

The 91.205 lookup is the easy part if you've internalized the cumulative structure (lesson 01). Map the operation to the right paragraph:

- VFR day -> 91.205(b) only
- VFR night -> 91.205(b) + (c)
- IFR -> 91.205(b) + (c) (if night) + (d)

If the inop item appears in the relevant paragraph, deferral is *not* available. Period. Fix the item or change the operation.

Example: an inop attitude indicator on a VFR day flight. 91.205(d)(8) requires an attitude indicator for IFR; 91.205(b) does not list one for VFR day. So Step 1 is "NO -- not required by 91.205 for VFR day." The pilot continues to Step 2 (KOEL).

### Step 2 -- the KOEL trap

Most modern airplanes (Cessna 172R/S, Cirrus SR series, Diamonds, Pipers, etc.) have a Kinds of Operations Equipment List in the POH that lists every piece of equipment and its required-or-not status for each kind of flight (VFR day / VFR night / IFR). The KOEL is *part of the type design* -- it is required equipment by virtue of the type certificate, even if the equipment is not in 91.205.

The KOEL frequently lists items 91.205 does *not* list:

- Engine fire warning system (some twins and turbines)
- Stall warning horn
- Manifold pressure gauge for non-supercharged constant-speed prop airplanes
- Fuel flow indicator
- Standby vacuum / standby attitude indicator
- Annunciator panel components

The KOEL also frequently has a *more restrictive* requirement than 91.205 for IFR flight. A KOEL might require a working autopilot for single-pilot IFR, even though 91.205(d) does not require an autopilot at all.

A pilot who clears Step 1 (the item is not in 91.205) and skips Step 2 has missed the most common KOEL trap.

### Step 3 -- ADs

Airworthiness Directives can require equipment to be operational. Some ADs apply to engine controls, propellers, structural inspection items, etc. -- and an AD can require an inoperative-equipment cleanup before further flight. The AD review is part of the airframe/engine logbook check; an unsuspecting pilot who hasn't audited the AD list against the inop item may miss this.

For most simple inop items (a burned-out anticollision light, a non-working fuel quantity gauge for one tank), no AD specifically requires the operability. But for some items (cylinder compression on certain engines, prop-blade inspection equipment, emergency-egress lighting on some twins), an AD may bind.

### Step 4 -- "any other Part 91 rule"

Step 4 is the catch-all. Examples:

- A non-working transponder for a flight that crosses Class B / C / mode-C-veil airspace -> [@cite](airboss-ref:regs/cfr-14/91/215?at=2026) is the binding rule.
- A non-working ADS-B Out for a flight in rule airspace -> [@cite](airboss-ref:regs/cfr-14/91/225?at=2026) binds.
- A non-working oxygen system above FL150 -> [@cite](airboss-ref:regs/cfr-14/91/211?at=2026) binds.

Step 4 is where a pilot who didn't think about the airspace or altitude requirements gets caught. The flight planner's audit must include all the operational requirements for the *specific flight*, not just 91.205.

### The "does not constitute a hazard" determination

After clearing the four no-defer authorities, the pilot must determine the inop item does not constitute a hazard. This is judgment, not a regulation. Examples:

- A burned-out cabin map light is not a hazard; defer.
- A non-functioning landing-gear up-and-locked indicator on a retractable, in icing conditions, on a long approach with marginal weather, *is* a hazard; do not defer even if 91.205 doesn't require it.

The pilot's judgment is final at this step. A mechanic can also make the determination; in practice on a no-MEL airplane the pilot is making it.

### The MEL pathway -- 91.213(a), (b), (c)

For airplanes with an FAA-approved MEL, the pathway is different. The MEL is an FAA-approved subset of the Master Minimum Equipment List (MMEL) issued for the aircraft type. The MEL is operator-specific; it lists each piece of equipment and the conditions under which it can be deferred (often with a category code -- A, B, C, D -- specifying repair intervals).

For the MEL to govern, the operator needs:

- A current copy of the MEL aboard the aircraft
- A letter of authorization from the FSDO authorizing operation under the MEL
- Each deferred item entered in the aircraft maintenance records

When the MEL applies, 91.213(a) is the operative pathway and 91.213(d) does not apply. An MEL-equipped airplane *cannot* use the no-MEL deferral structure.

Most GA pilots will encounter an MEL in fractional ownership programs, leasebacks to flight schools that have evolved into MEL-track operators, and corporate fleets. Ferry flights and acquired airplanes en route to first installation use the special flight permit (ferry permit) under 91.213(c) and 14 CFR 21.197.

## Common misreadings

- **"Placard alone is enough to fly with broken equipment."** Wrong. The placard is the third step in 91.213(d), after the four-authority check and before the hazard determination. Placarding without the rest of the process is not legal deferral.
- **"91.213(d) lets me defer anything."** Wrong. 91.213(d)(2) lists four authorities (91.205, KOEL, AD, "other Part 91 rule") that prohibit deferral. If any of them require the item, it cannot be deferred under (d).
- **"The 50-nm ELT exemption applies to any flight under 50 nm."** Wrong. 91.207(e)(2) is specific: "training flights" within 50 nm of the airport at which the flight began. A non-training cross-country at 40 nm does not qualify. The exemption is operationally narrow.
- **"The ELT battery has to be replaced every 12 months."** Wrong. 91.207(c) requires battery replacement (1) when the transmitter has been in use for more than 1 cumulative hour, or (2) when 50% of useful life has expired. The 12-month timer in 91.207(d) is *inspection*, not battery replacement.
- **"Anticollision lights are night-only."** Wrong. 91.209(d) requires anticollision lights to be on whenever the aircraft is operating, day or night, if an anticollision system is installed. The pilot can turn them off when safety dictates, but the default is on.
- **"Position lights are required from civil twilight to civil twilight."** Wrong. 91.209(a) is sunset-to-sunrise plain. Civil twilight is the [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) logging concept, not a 91.209 trigger.
- **"If 91.205 doesn't list it, I can fly without it."** Wrong. The KOEL or aircraft equipment list (Step 2 of the 91.213(d) test) often requires items 91.205 doesn't. Always check both.
- **"An MEL gives me more flexibility than no-MEL."** Mixed. An MEL gives a fleet operator a structured deferral process with specific repair intervals. For a single-aircraft owner, no MEL means using 91.213(d), which has *fewer* deferral authorities and is in some cases more restrictive than a corresponding MEL would be. Flight schools moving to a fleet with an MEL gain dispatch flexibility but lose the simplicity of a single-section pathway.
- **"I can fly a training flight 60 nm from base without an ELT."** Wrong. 91.207(e)(2) is 50 nm. Beyond 50 nm, the exemption ends and the ELT requirement applies.
- **"The ELT exemption applies to all flights between airports under 50 nm apart."** Wrong. The exemption is "training flights" within 50 nm of the airport "at which the flight began." A non-training A-to-B flight under 50 nm is not within the exemption.

## Related sections

- 91.205 -- equipment requirements; cumulative VFR day / night / IFR
- 91.211 -- supplemental oxygen; covered in Week 6 with subpart D
- 91.215 -- transponder; lesson 03
- 91.225 / 91.227 -- ADS-B Out; lesson 03
- 91.405 / 91.407 / 91.409 -- maintenance responsibilities and inspections; lesson 04
- 91.417 -- maintenance records; lesson 05
- 14 CFR 43.9 -- maintenance record entries (cited by 91.213(d)(3)(i))
- 14 CFR 21.197 -- special flight permits (cited by 91.213(c))

## Drills

### Locate the section

| Question                                           | Section / source                                         |
| -------------------------------------------------- | -------------------------------------------------------- |
| Where is the ELT requirement?                      | [@cite](airboss-ref:regs/cfr-14/91/207?at=2026)          |
| Where is the ELT battery replacement rule?         | [@cite](airboss-ref:regs/cfr-14/91/207?at=2026)(c)       |
| Where is the ELT 12-month inspection?              | [@cite](airboss-ref:regs/cfr-14/91/207?at=2026)(d)       |
| Where is the ELT exemption for training flights?   | [@cite](airboss-ref:regs/cfr-14/91/207?at=2026)(e)(2)    |
| Where is the ferry-flight ELT exemption?           | [@cite](airboss-ref:regs/cfr-14/91/207?at=2026)(f)       |
| Where is the position-lights window?               | [@cite](airboss-ref:regs/cfr-14/91/209?at=2026)(a)       |
| Where is the anticollision-lights "any time" rule? | [@cite](airboss-ref:regs/cfr-14/91/209?at=2026)(d)       |
| Where is the Alaska night-lights variation?        | [@cite](airboss-ref:regs/cfr-14/91/209?at=2026)          |
| Where is the no-MEL deferral pathway?              | [@cite](airboss-ref:regs/cfr-14/91/213?at=2026)(d)       |
| Where is the MEL deferral pathway?                 | [@cite](airboss-ref:regs/cfr-14/91/213?at=2026)(a)(b)(c) |
| Where is the placard-and-record requirement?       | [@cite](airboss-ref:regs/cfr-14/91/213?at=2026)(d)(3)    |
| Where is the hazard determination requirement?     | [@cite](airboss-ref:regs/cfr-14/91/213?at=2026)(d)(4)    |

### Apply the rules

> A renter rolls up to a 1996 Cessna 172R for a 2-hour solo VFR day flight. The fuel quantity gauge for the right tank reads zero with the tank full. The pilot opens the POH KOEL: it lists the right fuel quantity gauge as required for VFR day, VFR night, and IFR. Can the pilot defer the gauge under 91.213(d)?

Answer: No. Step 2 (KOEL) blocks the deferral. The KOEL lists the right fuel gauge as required for VFR day. Even though the pilot might argue 91.205(b)(8) only requires "a fuel quantity gauge for each tank" and the left gauge works (so 91.205 might be technically satisfied if the rule reads "a" gauge per tank -- which it does), the KOEL requires *the* right-tank gauge. Step 2 binds. The flight is grounded until the gauge is fixed.

> The same airplane, same flight, but it's the cabin map light that is burned out. The KOEL does not list a cabin map light as required for any kind of flight. Can the pilot defer?

Answer: Yes, with the 91.213(d) process. Step 1: 91.205 doesn't list a cabin map light -- NO. Step 2: KOEL doesn't list it -- NO. Step 3: no AD on cabin map lights -- NO. Step 4: no other Part 91 rule for VFR day requires it -- NO. All four NO; deferral available. Process: deactivate or remove the bulb, placard the switch INOPERATIVE, record in maintenance log under 14 CFR 43.9, pilot determines no hazard. Then fly.

> A flight school is doing pattern work in a 172 with an inop ELT. The flight stays within 12 nm of the home airport. Is this legal under 91.207?

Answer: Yes. 91.207(e)(2) exempts training flights within 50 nm of the airport where the flight began. The pattern work is well within. The ELT is not required for this operation. Note: this exemption is operation-specific; if the same airplane is later used for a non-training cross-country, the inop ELT becomes a 91.207(a) violation.

> A pilot is taxiing for takeoff at noon on a CAVOK day. The strobes are off. ATC has not asked them to turn the strobes on. Is the pilot in compliance with 91.209?

Answer: Probably not. 91.209(d) requires the anticollision lights to be on whenever the aircraft is operating, *unless* the pilot determines that turning them off serves safety. There is no implicit exception for daytime good-weather ops. The pilot needs an articulable safety reason for the strobes being off (rain, formation, etc.) -- and absent one, 91.209(d) is being violated.

## Where this lesson sits

Lesson 2 of week 5. We covered the ELT rule (91.207), the lights rule (91.209), and the inop-equipment dispatch rule (91.213).

- Previous: [01-documents-and-required-equipment.md](01-documents-and-required-equipment.md) -- 91.203, 91.205, 91.7, 91.9
- Next: [03-transponder-and-ads-b.md](03-transponder-and-ads-b.md) -- 91.215, 91.225, 91.227

## Related

- Live source: [Part 91](airboss-ref:regs/cfr-14/91?at=2026)
- Live source: [emergency locator transmitters](airboss-ref:regs/cfr-14/91/207?at=2026)
- Live source: [aircraft lights](airboss-ref:regs/cfr-14/91/209?at=2026)
- Live source: [inoperative instruments and equipment](airboss-ref:regs/cfr-14/91/213?at=2026)
- Live source: [equipment requirements](airboss-ref:regs/cfr-14/91/205?at=2026)
- Companion: AC 91-44 (ELT)
- Companion: 14 CFR 43.9 (maintenance record entries)
- Companion: AC 91-67 (operating limitations and AFM use)
