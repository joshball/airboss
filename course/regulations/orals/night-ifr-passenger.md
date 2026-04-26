---
title: Night IFR with a passenger -- regulatory walkthrough
week: 10
difficulty: capstone
pulls_from_regulations:
  - 91.103
  - 61.57
  - 91.409
  - 91.411
  - 91.413
  - 91.205
  - 91.211
  - 91.167
  - 91.169
  - 91.171
  - 91.215
  - 91.225
  - 91.203
  - 91.7
  - 91.213
duration_minutes: 25
last_verified: 2026-04-26
---

# Night IFR with a passenger -- regulatory walkthrough

## The question

> You're flying tomorrow at night, IFR, with a passenger. Walk me through every regulatory check.

This is the capstone integration oral. A single question pulls from preflight, currency, inspections, equipment, oxygen, fuel, filing, alternates, airworthiness, and the no-MEL pathway. It's how the FARs actually get used in real life. A pilot who can answer it without notes has the structural map of Title 14 in their head.

## What this is testing

- Whether you can map a single flight to the universe of regulations that apply
- Whether you reach for the CFR by section number, not by memorized fact
- Whether you handle currency correctly (private pilot vs. CFI privileges; passengers vs. solo; day vs. night; VFR vs. IFR)
- Whether you handle the maintenance/inspection triple (annual, transponder, altimeter/static) correctly for IFR night ops
- Whether you handle equipment via 91.205 *and* 91.213 (the no-MEL pathway) correctly
- Whether you know where 14 CFR ends and other regulatory ecosystems begin (TSA, NTSB, FAA Orders)

## Model answer (full walkthrough)

A defensible answer has eight stages. The order matters -- a CFI examiner is checking that you walk the regulations in the order they apply to the operation, not as a memorized list.

### Stage 1: Preflight action -- 91.103

> **§91.103 Preflight action.** Each pilot in command shall, before beginning a flight, become familiar with all available information concerning that flight. This information must include---
>
> (a) For a flight under IFR or a flight not in the vicinity of an airport, weather reports and forecasts, fuel requirements, alternatives available if the planned flight cannot be completed, and any known traffic delays of which the pilot in command has been advised by ATC;
>
> (b) For any flight, runway lengths at airports of intended use, and the following takeoff and landing distance information:
>
> (1) For civil aircraft for which an approved Airplane or Rotorcraft Flight Manual containing takeoff and landing distance data is required, the takeoff and landing distance data contained therein; and
> (2) For civil aircraft other than those specified in paragraph (b)(1) of this section, other reliable information appropriate to the aircraft, relating to aircraft performance under expected values of airport elevation and runway slope, aircraft gross weight, and wind and temperature.

**Plain reading:** Before any IFR or non-local flight, you must know weather, fuel, alternates, traffic delays, runway lengths, and takeoff/landing performance. The phrase "all available information" is broader than people think -- the FAA reads it as a duty to actively gather information that exists, not a passive duty to consider what reaches you.

**What I'd say in the oral:**

> "I start at 91.103 -- preflight action. Because this is IFR and not in the vicinity of an airport, paragraph (a) requires weather reports and forecasts, fuel requirements, alternatives if I can't complete the flight, and any traffic delays. Paragraph (b) requires runway lengths and takeoff/landing performance numbers. The standard isn't 'I checked' -- it's 'I became familiar with all available information.' That's a higher bar."

**Common trap:** Stopping at "I'll check the weather." 91.103 is the foundational regulation -- everything downstream (fuel reserves, alternate requirements, equipment) traces back to information you gathered here.

**Memory hook:** NWKRAFT -- NOTAMs, Weather, Known traffic delays, Runway lengths, Alternates, Fuel, Takeoff/landing performance. The mnemonic is teaching, not regulatory; the regulation is the source.

### Stage 2: Pilot currency -- 61.57

For a pilot carrying passengers at night IFR, three currency checks apply:

**§61.57(a) -- recent flight experience for carrying passengers (any time):**

> No person may act as a pilot in command of an aircraft carrying passengers ... unless that person has made at least three takeoffs and three landings within the preceding 90 days.

**§61.57(b) -- night currency for passengers:**

> No person may act as pilot in command of an aircraft carrying passengers during the period beginning 1 hour after sunset and ending 1 hour before sunrise, unless within the preceding 90 days that person has made at least three takeoffs and three landings to a full stop during the period beginning 1 hour after sunset and ending 1 hour before sunrise.

**§61.57(c) -- IFR currency:**

> Within the 6 calendar months preceding the month of the flight, that person performed and logged ... at least the following tasks and iterations in an aircraft, a full flight simulator, a flight training device, or an aviation training device:
>
> (i) Six instrument approaches.
> (ii) Holding procedures and tasks.
> (iii) Intercepting and tracking courses through the use of navigational electronic systems.

**Plain reading:**

| Currency type     | Requirement                                              | Window      |
| ----------------- | -------------------------------------------------------- | ----------- |
| Passenger (day)   | 3 takeoffs and 3 landings                                | 90 days     |
| Passenger (night) | 3 takeoffs and 3 **full-stop** landings, in actual night | 90 days     |
| IFR               | 6 approaches, holding, intercepting/tracking             | 6 calendar months |

**What I'd say in the oral:**

> "61.57 has three layers for this flight. (a) requires three takeoffs and landings in 90 days for passengers. (b) requires three takeoffs and full-stop landings at night, also in 90 days, because the flight is between one hour after sunset and one hour before sunrise. (c) requires six approaches, holding, and intercepting/tracking in the preceding six calendar months because I'm filing IFR. The night requirement is full-stop landings -- not touch-and-go. People miss that."

**Common trap 1:** Forgetting that night currency requires *full-stop* landings. Three night landings to a touch-and-go don't count.

**Common trap 2:** Confusing "currency" with "proficiency." 61.57 is the legal floor. If you're current but haven't flown an approach in five months and the weather is at minimums, the rule says you may, but airmanship may say you shouldn't. See [reg-currency-vs-proficiency](../../knowledge/regulations/currency-vs-proficiency/node.md).

**Common trap 3:** Flight review (61.56). Easy to forget. If your last flight review or equivalent (WINGS, IPC under 61.57(d), checkride) was more than 24 calendar months ago, you can't act as PIC at all. Always check 61.56 alongside 61.57.

**Don't forget:** Medical certificate (Part 67) currency. For most private pilots a third-class medical is good for 60 calendar months under age 40, 24 months over 40. Or BasicMed (49 USC 44703) every 48 months with a course every 24 months.

### Stage 3: Aircraft inspections -- 91.409, 91.411, 91.413

Three calendar-based inspections must be current for IFR night ops with a passenger. They're in different sections because they map to different equipment scopes.

**§91.409(a) -- annual:**

> Except as provided in paragraph (c) of this section, no person may operate an aircraft unless, within the preceding 12 calendar months, it has had ---
>
> (1) An annual inspection ... and has been approved for return to service ...

**§91.409(b) -- 100-hour (only for aircraft carrying persons for hire or used for flight instruction for hire):**

> No person may operate an aircraft carrying any person (other than a crewmember) for hire, and no person may give flight instruction for hire in an aircraft which that person provides, unless within the preceding 100 hours of time in service the aircraft has received an annual or 100-hour inspection ...

**§91.411 -- altimeter system and altitude reporting equipment tests (IFR-specific):**

> (a) No person may operate an airplane, or helicopter, in controlled airspace under IFR unless ---
>
> (1) Within the preceding 24 calendar months, each static pressure system, each altimeter instrument, and each automatic pressure altitude reporting system has been tested and inspected ...

**§91.413 -- ATC transponder tests and inspections:**

> (a) No person may use an ATC transponder ... unless, within the preceding 24 calendar months, the ATC transponder has been tested and inspected ...

**Plain reading:**

| Inspection                | When required                                  | Interval         | Where           |
| ------------------------- | ---------------------------------------------- | ---------------- | --------------- |
| Annual                    | All civil aircraft                             | 12 calendar months | 91.409(a)       |
| 100-hour                  | Aircraft for hire / instruction for hire       | 100 hours        | 91.409(b)       |
| Altimeter / static system | IFR in controlled airspace                     | 24 calendar months | 91.411          |
| Transponder               | Any use of an ATC transponder                  | 24 calendar months | 91.413          |
| ELT                       | All required-ELT aircraft                      | 12 calendar months | 91.207(d)       |
| ADS-B Out (if equipped)   | All ADS-B Out (Mode S extended squitter / UAT) | Ongoing per 91.227, performance-based | 91.225 / 91.227 |

**What I'd say in the oral:**

> "For IFR night ops with a passenger, I'm checking four inspection currencies in the maintenance logs. Annual under 91.409(a). Altimeter and static system under 91.411 -- 24 calendar months, IFR-only requirement. Transponder under 91.413 -- 24 calendar months, applies any time the transponder is used. ELT under 91.207(d) -- 12 calendar months. If the airplane is a club rental and used for instruction for hire, also 100-hour under 91.409(b). I'm finding the dates and the AP signature in the airframe and engine logs, not just trusting a paint pen on the cowling."

**Common trap 1:** Forgetting the transponder. 91.413 is 24 months and applies to any transponder use, not just IFR. People remember 91.411 because it's IFR-coded and forget 91.413 because it's "always."

**Common trap 2:** Confusing 12 calendar months (annual, ELT) with 12 months. "Calendar month" means the inspection signed off on April 15, 2026 is good through April 30, 2027 -- the last day of the 12th calendar month following.

**Common trap 3:** Thinking 100-hour applies to private rentals or club aircraft. It only applies if the airplane is used for hire or for instruction for hire.

### Stage 4: Aircraft documents -- 91.203, 91.7, 91.213

**§91.203(a) -- documents required:**

> Except as provided in paragraph (b) of this section, no person may operate a civil aircraft unless it has within it the following:
>
> (1) An appropriate and current airworthiness certificate ...
> (2) An effective U.S. registration certificate ...

**§91.7 -- Civil aircraft airworthiness:**

> (a) No person may operate a civil aircraft unless it is in an airworthy condition.
> (b) The pilot in command of a civil aircraft is responsible for determining whether that aircraft is in condition for safe flight. The pilot in command shall discontinue the flight when unairworthy mechanical, electrical, or structural conditions occur.

**Plain reading:** AROW (Airworthiness, Registration, Operating limitations, Weight & balance). Must be on board. PIC determines airworthy condition under 91.7(b).

**§91.213 -- Inoperative instruments and equipment.** Triggered if anything is broken. The pathway:

1. Is the equipment required by the type certificate / aircraft equipment list?
2. Is the equipment required by 91.205 for this op?
3. Is the equipment required by an AD?
4. If no to all three: deactivate or remove, placard "inoperative," ensure no hazard, and the PIC and a mechanic determine the aircraft is safe to fly.
5. Or operate under an MEL if one is approved for this aircraft.

**What I'd say in the oral:**

> "Documents per 91.203 -- A, R, O, W -- must be on board. Per 91.7, I'm responsible as PIC for determining airworthiness. If something is inop, I'm walking the no-MEL pathway in 91.213(d): is it required by the type certificate, by 91.205 for this op, or by an AD? If none of the above, I deactivate or remove, placard inoperative, and a mechanic and I sign off on continued safe flight. For night IFR, more equipment is on the required list under 91.205, so the no-MEL pathway has a smaller margin."

**Common trap:** Skipping straight to "placard it." The placard is step three or four, not step one. And if the equipment is required, no placard saves you.

### Stage 5: Equipment -- 91.205

**§91.205(c) -- VFR night.** ATOMATOFLAMES + FLAPS:

> Position lights, an approved aviation red or aviation white anticollision light system, an electric landing light (if the aircraft is operated for hire), an adequate source of electrical energy, one spare set of fuses, all instruments and equipment required for VFR day, and an electric landing light (if for hire).

(The mnemonic FLAPS = Fuses, Landing light, Anti-collision lights, Position lights, Source of power. Plus everything from VFR day = ATOMATOFLAMES.)

**§91.205(d) -- IFR.** Add to VFR night:

> Two-way radio communications system and navigational equipment appropriate to the ground facilities to be used. Gyroscopic rate-of-turn indicator. Slip-skid indicator. Sensitive altimeter adjustable for barometric pressure. Generator or alternator of adequate capacity. Gyroscopic pitch and bank indicator (artificial horizon). Gyroscopic direction indicator (directional gyro or equivalent).

(The mnemonic GRABCARD = Generator/alternator, Radios two-way, Attitude indicator, Ball, Clock, Altimeter sensitive, Rate of turn indicator, Directional gyro.)

**Plain reading:** For night IFR, you need everything in 91.205(b) (VFR day), (c) (VFR night), and (d) (IFR). The lists are cumulative.

**What I'd say in the oral:**

> "Required equipment under 91.205. Day VFR is the base list -- ATOMATOFLAMES. VFR night adds FLAPS. IFR adds GRABCARD. For night IFR I need all three sets. Anything missing goes into the 91.213 pathway. And I add the transponder requirement -- 91.215 says I need a Mode C transponder in most controlled airspace, and 91.225 / 91.227 require ADS-B Out in the same airspace. Those are separate from 91.205 but apply to this flight."

**Common trap 1:** Treating ATOMATOFLAMES as "the equipment list." It's only the VFR-day floor. Night and IFR add to it.

**Common trap 2:** Forgetting the transponder and ADS-B requirements. They're not in 91.205. They live in 91.215 and 91.225/91.227.

### Stage 6: Oxygen -- 91.211

**§91.211(a) -- the rule:**

> (a) General. No person may operate a civil aircraft of U.S. registry ---
>
> (1) At cabin pressure altitudes above 12,500 feet (MSL) up to and including 14,000 feet (MSL) unless the required minimum flight crew is provided with and uses supplemental oxygen for that part of the flight at those altitudes that is of more than 30 minutes duration;
> (2) At cabin pressure altitudes above 14,000 feet (MSL) unless the required minimum flight crew is provided with and uses supplemental oxygen during the entire flight time at those altitudes; and
> (3) At cabin pressure altitudes above 15,000 feet (MSL) unless each occupant of the aircraft is provided with supplemental oxygen.

**Plain reading:** Crew above 12,500 for more than 30 minutes; crew always above 14,000; everyone above 15,000.

**What I'd say in the oral:**

> "91.211 -- depending on the altitude I'm filing. Night IFR is often higher than VFR by routing or MEAs. If I'm filing 13,000 for terrain, I need crew oxygen for any time over 30 minutes. Above 14,000, crew oxygen all the time. Above 15,000, everyone in the airplane needs oxygen -- which means my passenger needs a mask. I'm checking my filed altitude against this and verifying I have functioning oxygen on board if I'll be in the regime."

**Common trap:** Stating the altitudes from memory and getting them wrong. Always cite "12-5 / 14 / 15" and tie them to "crew over 30 minutes / crew always / everyone."

### Stage 7: Fuel and alternate -- 91.167, 91.169, 91.171

**§91.167 -- IFR fuel requirements:**

> (a) No person may operate a civil aircraft in IFR conditions unless it carries enough fuel (considering weather reports and forecasts and weather conditions) to ---
>
> (1) Complete the flight to the first airport of intended landing;
> (2) Except as provided in paragraph (b) of this section, fly from that airport to the alternate airport; and
> (3) Fly after that for 45 minutes at normal cruising speed ...

**§91.169 -- IFR flight plan: information required + the 1-2-3 rule:**

> (c) IFR alternate airport weather minima. ... no person may include an alternate airport in an IFR flight plan unless current weather forecasts indicate that, at the estimated time of arrival at the alternate airport, the ceiling and visibility at that airport will be at or above the following alternate airport weather minima:
>
> (1) If an instrument approach procedure has been published in part 97 of this chapter ... for that airport, the alternate airport minima specified in that procedure ... or, if none are specified ... the following standard approach minima:
>
> (i) For a precision approach procedure. Ceiling 600 feet and visibility 2 statute miles.
> (ii) For a nonprecision approach procedure. Ceiling 800 feet and visibility 2 statute miles.

**The 1-2-3 rule lives in §91.169(b):**

> (b) Paragraph (a)(2) of this section does not apply if part 97 of this chapter prescribes a standard instrument approach procedure to ... the first airport of intended landing and, for at least 1 hour before and 1 hour after the estimated time of arrival, the weather reports or forecasts ... indicate that ---
>
> (1) The ceiling will be at least 2,000 feet above the airport elevation; and
> (2) The visibility will be at least 3 statute miles.

**Plain reading:** Always carry destination + alternate + 45 minutes, **unless** the 1-2-3 rule lets you drop the alternate (1 hour before/after ETA, ceiling 2,000, visibility 3). If you carry an alternate, it must meet 600/2 (precision) or 800/2 (non-precision) at the ETA, *not* the 200/half published-minimum approach minimums you'll fly at the alternate when you get there.

**§91.171 -- VOR check (only relevant if VOR navigation is used):**

> (a) No person may operate a civil aircraft under IFR using the VOR system of radio navigation unless the VOR equipment of that aircraft ---
>
> (1) Is maintained, checked, and inspected under an approved procedure; or
> (2) Has been operationally checked within the preceding 30 days, and was found to be within the limits of the permissible indicated bearing error ...

**What I'd say in the oral:**

> "Fuel under 91.167 -- destination, alternate, plus 45 minutes at normal cruise. Alternate under 91.169 -- I check the 1-2-3 rule at the destination first. If destination forecast is at least 2,000 ceiling and 3 visibility from one hour before to one hour after my ETA, I don't need an alternate. Otherwise I do, and the alternate has to meet 600/2 or 800/2 forecast at my ETA. If I'm navigating by VOR, I also need a 30-day VOR check per 91.171."

**Common trap 1:** Conflating the 600/2 / 800/2 *alternate filing* minimums with the *approach* minimums you'll actually fly at the alternate. Different things. The filing minimum is forecast at ETA; the approach minimum is what you actually need to break out and land.

**Common trap 2:** Using the 1-2-3 rule when the destination has no published approach. The rule only works if the destination has a Part 97 approach. No approach -> alternate required regardless.

**Common trap 3:** Forgetting 91.171 entirely. VOR check is easy to miss because it's procedural, but it's an IFR rule that applies to any flight using VOR.

### Stage 8: TSA / non-Title-14 considerations

For most pilots flying their own VFR / IFR ops, the TSA rules don't add anything (49 CFR 1552 mostly governs flight training of foreign students). But the oral examiner may push on:

- Are you carrying anything that triggers HAZMAT (49 CFR 175)?
- Is your passenger a passenger or "in connection with" a business? Common-purpose / pro-rata cost-sharing under 61.113 has a Chief Counsel-defined boundary that gets pilots in trouble.
- If something happens, what's reportable under NTSB Part 830 (49 CFR 830, *not* 14 CFR)?

**What I'd say in the oral:**

> "Title 14 isn't the whole regulatory ecosystem. I'm thinking briefly about TSA at 49 CFR 1552 -- not relevant to this flight unless I'm a flight school with a foreign student. I'm thinking about 61.113 if I'm sharing any cost with the passenger -- it's pro-rata only, common purpose, and the Mangiamele letter clarifies the limits. And I'm thinking about NTSB Part 830 if anything goes wrong -- accident vs. incident, what's reportable immediately, what's reportable on a follow-up. Most pilots don't read 49 CFR until they need to."

## Compressed answer (under 90 seconds)

For an oral where the examiner wants the integration without the deep dive:

> "Eight checks. **One**: 91.103 preflight action -- weather, fuel, alternates, runway, performance, all available info. **Two**: pilot currency under 61.57 -- 90-day passenger, 90-day night with full-stop landings, 6-month IFR with six approaches, holding, intercepts. Plus 61.56 flight review and Part 67 medical. **Three**: aircraft inspections -- annual under 91.409(a), altimeter/static under 91.411, transponder under 91.413, ELT under 91.207. **Four**: documents per 91.203 (AROW), airworthiness determination per 91.7, no-MEL pathway under 91.213 if anything's broken. **Five**: equipment per 91.205 -- VFR day plus VFR night plus IFR cumulative; transponder per 91.215, ADS-B per 91.225/91.227. **Six**: oxygen per 91.211 if I'm filing above 12,500. **Seven**: fuel per 91.167, alternate per 91.169 (1-2-3 rule, and the 600/2 / 800/2 forecast minimums for the alternate), VOR check per 91.171 if I'm using VOR. **Eight**: non-14-CFR -- TSA at 49 CFR 1552, NTSB Part 830 if something happens."

That answer cites 13 distinct CFR sections in 90 seconds. Anyone who can deliver it without notes has the structural map.

## What goes wrong (failure modes)

| Failure mode                                    | Diagnosis                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Recites 91.205 without 91.213                   | Missing the no-MEL pathway. Equipment lists alone don't tell you what to do when something is broken.      |
| Cites night currency without "full-stop"        | Misreads 61.57(b). Touch-and-go landings don't satisfy night-passenger currency.                           |
| Forgets 91.413 (transponder)                    | Conflates "IFR inspection" requirements. 91.411 is IFR-coded (24 cal months). 91.413 is any-transponder-use (24 cal months). |
| Cites 1-2-3 rule for an airport with no approach | The 1-2-3 rule only applies if the destination has a published Part 97 approach. No approach -> alternate always required. |
| Confuses alternate filing minimums with alternate approach minimums | 600/2 and 800/2 are the *filing* numbers (forecast at ETA). The actual approach you'd fly at the alternate has its own published minimums (often 200/0.5). Different things. |
| Stops at "I check the weather"                   | 91.103's "all available information" is broader than weather. The whole NWKRAFT list is the floor.         |
| Forgets 61.56 (flight review)                    | Easy to miss because the question framed currency as IFR-and-passenger. 61.56 is independent of those.     |
| Forgets the medical (Part 67) or BasicMed       | Treating Part 61 as the whole pilot-currency story. Medical lives in Part 67.                              |
| Cites 91.211 altitudes wrong                    | 12-5 over 30, 14 always crew, 15 always everyone. Easy to scramble. Tie the numbers to the rule structure. |

## Variant prompts

Same regulatory machinery, different framings. Use these to vary practice without changing the underlying skill being exercised.

| Variant                                                                                                                       | What changes                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "VFR cross-country at night with two passengers in marginal weather. Walk me through the regulatory check."                   | Drops IFR layer (no 91.167, 91.169, 91.171, 91.411). Adds 91.155 for VFR weather minimums. Currency simplifies to 61.57(a) + (b). |
| "Day IFR cross-country, no passenger. Walk me through."                                                                       | Drops 61.57(b) night currency. Drops 91.205(c) night equipment. Everything else stays. |
| "Same flight, but the airplane is a 1972 Piper Cherokee owned by a flying club, used for rental and instruction."             | Adds 91.409(b) 100-hour. 91.213 pathway tightens because a club rental's MEL status varies. |
| "Same flight, but you're a CFI giving an instrument lesson to a private pilot working on their IR."                           | Adds Subpart H privileges per 61.193, endorsement per 61.195(c). Logging per 61.51 (who logs PIC, who logs instruction received). |
| "Same flight, but you discover the static system inspection is 25 calendar months old."                                       | Now 91.411 is busted. Walk through 91.213(a)(2): is the static system required? Yes for IFR. So you cannot fly IFR until repaired. Could you fly VFR? Yes, because 91.411 is IFR-only. |
| "Same flight, but the airplane departs from a private grass strip with no published approach."                                | The 1-2-3 rule doesn't apply (no published approach at destination -- but wait, the rule is about the *destination*'s approach status; if the destination has no approach, 91.169(a)(2) requires an alternate regardless). Examiner is testing whether you know which end the rule applies to. |
| "Same flight, but it's New Year's Eve and you had a beer at lunch. Walk me through."                                          | Adds 91.17 (8-hour rule, 0.04% BAC, no being under the influence). Adds reflection on personal minimums vs. legal minimums. |

## Related material

- **Knowledge graph:** [reg-currency-vs-proficiency](../../knowledge/regulations/currency-vs-proficiency/node.md), [reg-pilot-privileges-limitations](../../knowledge/regulations/pilot-privileges-limitations/node.md). Many more nodes will be authored as the course expands.
- **Lessons that feed this oral:**
  - [Week 2: Part 61 deep](../week-02-part-61-deep/overview.md) -- 61.51, 61.56, 61.57, 61.58
  - [Week 4: Part 91 general + flight rules](../week-04-part-91-general-and-flight-rules/overview.md) -- 91.103, 91.167, 91.169, 91.171, 91.211
  - [Week 5: Part 91 equipment + maintenance](../week-05-part-91-equipment-and-maintenance/overview.md) -- 91.203, 91.205, 91.213, 91.215, 91.225, 91.409, 91.411, 91.413
- **AIM:** Chapter 5 (ATC procedures), Chapter 6 (Emergency procedures), Chapter 7 (Safety of flight) for context on how these regs are applied operationally.
- **Authoritative interpretations:**
  - Mangiamele letter (2009) -- 61.113 cost sharing limits
  - Hicks letter (2010) -- holding the controls is "acting as PIC"
  - Walker letter (2017) -- preflight action standard for "all available information"
- **AC 61-65** -- endorsement reference (relevant if oral pivots to a CFI variant).
