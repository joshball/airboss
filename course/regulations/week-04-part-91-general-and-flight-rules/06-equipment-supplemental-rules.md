---
title: Oxygen and transponder rules -- §91.211 and §91.215
week: 4
section_order: "06"
last_verified: 2026-04-29
cites:
  knowledge_nodes:
    - flight-planning/vfr-cross-country
  acs_leaves:
    - PA.I.B.K1
    - PA.I.B.K2
  handbook_sections:
    - airboss-ref:regs/cfr-14/91/126
    - airboss-ref:regs/cfr-14/91/127
    - airboss-ref:regs/cfr-14/91/130
    - airboss-ref:regs/cfr-14/91/131
    - airboss-ref:regs/cfr-14/91/135
---

# Oxygen and transponder rules

This lesson covers two equipment-and-altitude rules that pilots routinely conflate with the §91.205 equipment list (Week 5) or with the §91.155 weather table (previous lesson). §91.211 governs supplemental oxygen by altitude and duration. §91.215 governs transponder use by altitude and airspace. Both layer on top of the §91.205 equipment list and the §91.155 / §91.169 weather/IFR rules; both are pre-takeoff and in-flight checks the PIC must apply continuously.

The structural pattern: §91.211 is "altitude triggers the requirement, duration scales it." §91.215 is "altitude or airspace triggers the requirement." Once the pattern is internalized, the section numbers become locator markers, not new rules to memorize.

## What you'll be able to do

- State the §91.211 oxygen altitudes (12,500-14,000 MSL after 30 minutes; above 14,000 MSL crew; above 15,000 MSL passengers offered)
- Apply §91.211 to a flight that crosses through the trigger altitude during cruise
- State the §91.215 transponder altitudes and airspace (the "Mode C veil," 10,000 MSL ceiling, Class B/C, etc.)
- Distinguish §91.215 from §91.225 (ADS-B Out), which is its own section in Week 5
- Apply both rules to a flight that involves an unscheduled climb or routing change

## Why this matters

Oxygen is the first regulation pilots break in cross-country flight without realizing it. A pilot crossing the 12,500 MSL line in clear weather at cruise routinely loses track of the duration limit. After 30 minutes above 12,500 MSL, the required-flight-crew oxygen rule attaches.

The §91.215 transponder rule is the most-cited Part 91 violation outside of altitude/weather rules. Pilots transitioning between airspaces (under a Class B shelf, descending through the Mode C veil, climbing through 10,000 MSL) mismanage the transponder mode and produce traffic-conflict reports that trigger FAA contact.

Both rules are also the technical answer to "what equipment do I need for this airplane on this flight." A pilot quoting only §91.205 misses §91.211 and §91.215, both of which are active equipment requirements above their trigger altitudes.

## The discovery question

You depart KSAC at 1,500 MSL eastbound across the Sierra. You climb to 11,500 MSL initially, then ATC clears you to 13,500 MSL for terrain and traffic separation. The leg from initial-climb to descent into KRNO will take 45 minutes at 13,500 MSL. You and your right-seat friend are healthy, both have done 13,500 in the past with no symptoms. You don't have built-in oxygen. You have a portable bottle you've used twice.

Pause.

Three checks. First, when does §91.211 attach? Second, do you and your friend each need oxygen, or only you? Third, what changes if you climb to 14,500 instead?

The first check routes through §91.211(a)(1). At cabin pressure altitudes above 12,500 MSL up to 14,000 MSL, *the required minimum flight crew* must use oxygen for that portion of the flight that exceeds 30 minutes in duration above 12,500. Your 45-minute leg at 13,500 is 45 minutes above 12,500 -- exceeds the 30-minute threshold. The required flight crew (you, the PIC, and the SIC if required) must use oxygen for the *full duration* of the flight above 12,500, not just the portion past 30 minutes.

The second check routes through §91.211(a)(2)-(3). Above 14,000 MSL, the *crew* must use oxygen at all times. Above 15,000 MSL, oxygen must be made available to passengers. Below 14,000 MSL, the rule attaches only to required flight crew. Your right-seat friend (who is not a required flight crew member -- you're solo PIC) is not covered by §91.211 below 14,000 MSL. They may take oxygen if they want; the regulation doesn't require it.

The third check: at 14,500 MSL, the rule shifts to §91.211(a)(2) -- the crew must use oxygen at all times above 14,000, not just past 30 minutes. The 30-minute grace is gone. The instant you climb above 14,000, oxygen is required.

This is the typical Part 91 oxygen trap. Pilots remember "12,500" and forget the 30-minute grace; or remember the grace and forget that it disappears at 14,000.

## §91.211 oxygen requirements

```text
§91.211  Supplemental oxygen.

(a) General. No person may operate a civil aircraft of U.S. registry--

    (1) At cabin pressure altitudes above 12,500 feet (MSL) up to and
        including 14,000 feet (MSL) unless the required minimum flight
        crew is provided with and uses supplemental oxygen for that
        part of the flight at those altitudes that is of more than 30
        minutes duration;

    (2) At cabin pressure altitudes above 14,000 feet (MSL) unless the
        required minimum flight crew is provided with and uses
        supplemental oxygen during the entire flight time at those
        altitudes; and

    (3) At cabin pressure altitudes above 15,000 feet (MSL) unless each
        occupant of the aircraft is provided with supplemental oxygen.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural pattern, by altitude band:

| Cabin pressure altitude | Required flight crew oxygen | Passenger oxygen          |
| ----------------------- | --------------------------- | ------------------------- |
| <= 12,500 MSL           | Not required                | Not required              |
| 12,501 - 14,000 MSL     | Required after 30 minutes   | Not required              |
| 14,001 - 15,000 MSL     | Required at all times       | Not required              |
| > 15,000 MSL            | Required at all times       | Provided to each occupant |

Three operative concepts:

1. **"Cabin pressure altitude."** In an unpressurized airplane, this is your altitude. In a pressurized airplane (rare in Part 91 light aircraft), the cabin altitude may be lower than the actual altitude.
2. **"Required minimum flight crew."** In a Part 91 single-pilot operation, that's the PIC. In a two-pilot operation requiring a SIC, both pilots. Passengers are not "required flight crew."
3. **"30 minutes duration."** This is cumulative time above 12,500, not 30-minute legs. A flight that climbs to 13,000 for 20 minutes, descends, then climbs to 13,000 for 15 minutes -- the rule attaches at the 30-minute mark of cumulative time above 12,500.

The "provided with" language in (a)(3) is sometimes misread as "they must use." The regulation requires the airplane to have oxygen available for each occupant above 15,000 MSL; the occupants are not required to use it. Pilots brief passengers on oxygen use and let them decide.

The §91.211 requirement is satisfied by *supplemental* oxygen -- portable bottles or built-in systems that deliver oxygen above ambient. The system must meet the FAA's requirements for medical-grade oxygen and for the regulator output.

## §91.215 transponder requirements

```text
§91.215  ATC transponder and altitude reporting equipment and use.

(a) ...
(b) Operation: ...no person may operate an aircraft in the airspace
    described in paragraph (b) of this section, unless that aircraft
    is equipped with an operable coded radar beacon transponder having
    either Mode 3/A 4096 code capability... or an air traffic control
    radar beacon system (ATCRBS) transponder having a Mode 3/A 4096
    code capability or a Mode S capability... and that aircraft is
    equipped with automatic pressure altitude reporting equipment
    having a Mode C capability...

(b)(1) All aircraft. In Class A, Class B, and Class C airspace.
(b)(2) All aircraft. In all airspace within 30 nautical miles of an
       airport listed in appendix D, section 1, of this part, from the
       surface upward to 10,000 feet MSL.
(b)(3) All aircraft. In all airspace above the ceiling and within the
       lateral boundaries of a Class B or Class C airspace area
       designated for an airport upward to 10,000 feet MSL.
(b)(4) All aircraft. ...within the airspace of an airport listed in
       appendix D, section 2, of this part.
(b)(5) All aircraft. In the airspace from the surface to 10,000 feet
       MSL within a 10-nautical-mile radius of any airport listed in
       appendix D, section 1, of this part, excluding the airspace
       below 1,200 feet outside of the lateral boundaries of the
       surface area of the airspace designated for that airport.
(b)(5)(ii) All aircraft except any aircraft which was not originally
       certificated with an engine-driven electrical system or which
       has not subsequently been certified with such a system installed,
       balloon, or glider...

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural pattern of §91.215(b):

| Trigger                                              | Transponder + Mode C required  |
| ---------------------------------------------------- | ------------------------------ |
| Class A airspace (above FL180)                       | Yes                            |
| Class B airspace (and within 30 NM of B primary)     | Yes (the "Mode C veil")        |
| Class C airspace                                     | Yes                            |
| Above 10,000 MSL (excluding within 2,500 AGL)        | Yes                            |
| Within Class B/C lateral boundaries below 10,000 MSL | Yes                            |
| Specific airports listed in appendix D               | Yes                            |
| Otherwise                                            | Not required (but recommended) |

Two structural points:

1. **Mode C veil.** The 30-NM-radius airspace around a Class B primary airport, surface to 10,000 MSL, requires Mode C (altitude reporting). The exception in §91.215(b)(5)(ii) preserves operations of aircraft never certified with an engine-driven electrical system (older Cubs, gliders, balloons).
2. **Above 10,000 MSL.** Mode C is required above 10,000 MSL, *except* in airspace at and below 2,500 AGL (mountain valleys above 10,000 MSL, etc.).

§91.215 also has a "transponder operation" rule (§91.215(c)): when in controlled airspace, the transponder must be on and squawking the assigned code. This is the rule pilots break by squawking 1200 inside Class B; it triggers ATC contact and enforcement.

## §91.225 ADS-B Out (cross-reference, Week 5)

§91.225 / §91.227 ADS-B Out is the modern overlay on §91.215. The trigger airspace is similar (Mode C veil, Class A/B/C, above 10,000 MSL with the 2,500 AGL exception). The Week 5 lesson covers ADS-B in detail. For Week 4 purposes: where §91.215 requires a transponder + Mode C, §91.225 also requires ADS-B Out as of the 2020 ADS-B mandate.

## Common misreadings

**§91.211 30-minute grace applied above 14,000.** The 30-minute grace is only between 12,500 and 14,000 MSL. Above 14,000, oxygen attaches immediately. Pilots routinely confuse the bands.

**§91.211 applied to passengers.** Below 14,000 MSL, §91.211 governs only the *required flight crew*. Passengers may go without oxygen even if the PIC is required to use it (between 12,500 and 14,000 MSL after 30 minutes). The passenger requirement begins at 15,000 MSL and is "provided with," not "must use."

**§91.215 Mode C veil sized incorrectly.** The veil is 30 NM from the primary, surface to 10,000 MSL. Pilots remember "30 NM" and forget the altitude ceiling, or remember "to 10,000" and forget the 30 NM boundary. Both define the volume.

**§91.215 above 10,000 MSL exception.** The exception for "at and below 2,500 AGL" applies only to aircraft operating in mountainous terrain. Pilots quote it as a general "below 2,500 AGL" exception, ignoring the AGL component over flat terrain.

**§91.215 squawk code in uncontrolled airspace.** Pilots think 1200 is the only code in uncontrolled airspace. Outside controlled airspace, ATC may still assign a code if you request flight following; the assigned code applies regardless of the airspace classification.

## Where these sit in the regulatory map

§91.211 lives in subpart C (Equipment, Instrument, and Certificate Requirements -- but not the same as the "C-D-E" group that contains §91.205). §91.215 lives in subpart C as well. Both are equipment rules with altitude/airspace triggers, layered on top of the §91.205 base equipment list (which is covered in Week 5).

The §91.13 catch-all attaches to violations of either rule.

## Related sections

- §91.13 careless or reckless -- attaches
- §91.103 preflight action -- requires knowing the route's altitude/airspace before launch
- §91.205 equipment by op type -- the base equipment list (Week 5)
- §91.225 / §91.227 ADS-B Out -- the modern overlay (Week 5)
- §91.131-§91.135 Class B/C/D operations -- where transponder rules layer on top of clearance rules
- AC 61-107 operations of aircraft at altitudes above 25,000 feet MSL and/or Mach .75

## The next steps -- drills and oral

Week 4 drills: 25 prompts pulling from Part 91 subparts A and B, locate / apply / distinguish format. Week 4 oral: VFR cross-country, marginal weather, walking through every regulatory check before launch.

The two come together in Week 6, where the integration scenarios will pull §91.3 / §91.13 / §91.103 / §91.155 / §91.211 / §91.215 into a single multi-step problem. Mastery of this lesson plus the previous four sets up the Week 6 walkthrough.
