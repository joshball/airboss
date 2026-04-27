---
title: Gear-up landing on a night IFR cross-country
week: 10
difficulty: capstone
pulls_from_regulations:
  - 91.3
  - 91.7
  - 91.13
  - 91.405
  - 91.407
  - 91.417
  - 61.51
  - 61.193
  - 91.123
duration_minutes: 25
---

# Gear-up landing on a night IFR cross-country

## The question

> "You're the CFI. Your student lands gear-up on a night IFR cross-country. Walk me through your regulatory obligations from the second of impact to the FAA ramp check the next morning."

This is a post-incident integration capstone. It tests whether you can navigate the regulations *under stress*, in the right order, while distinguishing FAA enforcement obligations from NTSB reporting obligations from Pilot's Bill of Rights protections. Most pilots have never had to walk this; the goal is to walk it once now so it's not the first time later.

## What this is testing

- Whether you know which obligations are immediate vs. follow-up
- Whether you distinguish FAA enforcement (Title 14) from NTSB reporting (Title 49)
- Whether you exercise Pilot's Bill of Rights protections deliberately
- Whether you know what becomes of the airplane (preservation under NTSB 830.10)
- Whether you understand the post-maintenance return-to-service rules
- Whether you keep your CFI candor without compounding the problem

## Model answer (full walkthrough)

Eight stages, in order. The order is load-bearing -- the wrong sequence creates new violations on top of the original event.

### Stage 1: §91.3(b) -- emergency authority and command

> **§91.3(b)** In an in-flight emergency requiring immediate action, the pilot in command may deviate from any rule of this part to the extent required to meet that emergency.

The instant the gear is up at touchdown, this is an emergency. PIC authority under §91.3 attaches. The student is in the left seat, but as the CFI you may already be PIC depending on logging arrangements -- per the **Hicks letter (2010)** a CFI manipulating the controls is acting as PIC.

**What I'd say in the oral:**

> "First obligation is operational, not regulatory: control the airplane. Stop the slide, evacuate if there's fire, account for the student. Once we're clear -- 91.3(b) gives me deviation authority for the emergency, so any rule I'm about to break is defensible if the deviation was 'to the extent required.' I'm thinking about that as I act."

**Common trap:** Hesitating because of regulatory uncertainty. 91.3(b) exists exactly to prevent that. Act first; the regulatory frame protects the action.

### Stage 2: ATC -- §91.123 and the obligation to communicate

If the airplane is on a runway, ATC needs to know. Even if the airplane is on a runway at an uncontrolled airport, traffic in the area needs CTAF advisory.

> **§91.123** No pilot in command may, except in an emergency, deviate from a clearance...

> **§91.123(c)** Each pilot in command who, in an emergency, or in response to a traffic alert and collision avoidance system resolution advisory, deviates from an ATC clearance or instruction shall notify ATC of that deviation as soon as possible.

**What I'd say in the oral:**

> "If we're at a towered field, the tower already knows -- they watched it. If uncontrolled, I make the CTAF call: 'Centennial traffic, 172 Two-Three Tango, gear up on runway 35 right, stand by, Centennial.' I need to clear the runway -- towed if necessary. ATC notification of the deviation per 91.123(c) is technically required but immaterial in this case because the deviation IS the emergency."

### Stage 3: §91.7 -- airworthiness determination after the event

> **§91.7(a)** No person may operate a civil aircraft unless it is in an airworthy condition.

The airplane just landed gear-up. It is not airworthy. It does not move under its own power off this airport without 91.7 + 91.405 + 91.407 first being satisfied.

**What I'd say in the oral:**

> "The airplane is not airworthy. It cannot be flown out. Period. Even taxiing to the FBO is potentially a 91.7 problem -- prop strike is the immediate concern, but bent gear, twisted firewall, fuselage damage all make the airplane unairworthy. I'm not going to taxi it; it gets towed."

**Common trap:** Trying to "just taxi to the ramp." A prop-struck engine cannot be operated until torn down per the manufacturer's prop-strike inspection procedure (Lycoming Service Bulletin / Continental Service Information).

### Stage 4: §91.405, §91.407 -- maintenance and return to service

> **§91.405(a)** Each owner or operator of an aircraft ... shall have that aircraft inspected as prescribed in subpart E of this part and shall, between required inspections ... have discrepancies repaired ...

> **§91.407(a)** No person may operate any aircraft that has undergone maintenance, preventive maintenance, rebuilding, or alteration unless ... it has been approved for return to service by a person authorized under §43.7 ...

**What I'd say in the oral:**

> "Per 91.405 and 91.407, the airplane stays grounded until an A&P (or higher authority depending on damage) signs it off as approved for return to service. That's not me. I document the event in the airplane logs per 91.417 -- date, what happened, current tach -- and the airplane goes to a shop. The owner / club / school's responsibility under 91.405 is to handle that next; mine is to make sure the airplane isn't moved until it's signed off."

### Stage 5: 49 CFR 830 -- NTSB notification

The next layer is *outside Title 14*. The NTSB has its own reporting rule. **49 CFR Part 830** governs accident and incident reporting.

> **49 CFR § 830.5** -- Immediate notification.
>
> The operator of any civil aircraft ... shall immediately, and by the most expeditious means available, notify the nearest National Transportation Safety Board (NTSB) office, when:
>
> (a) An aircraft accident...

The definitions matter. Per **49 CFR § 830.2**:

- **Aircraft accident** = "an occurrence associated with the operation of an aircraft ... in which any person suffers death or serious injury, or in which the aircraft receives **substantial damage**."
- **Substantial damage** = "damage or failure which adversely affects the structural strength, performance, or flight characteristics of the aircraft, and which would normally require major repair or replacement of the affected component."

A gear-up landing typically involves:
- Prop strike (engine teardown required)
- Fuselage skin damage
- Possibly bent firewall

That is substantial damage. The event is an aircraft accident under 830.2. NTSB notification is required immediately.

**What I'd say in the oral:**

> "This is a 49 CFR 830 accident, almost certainly. Substantial damage from prop strike, possible fuselage damage. I notify the nearest NTSB regional office immediately. Same call typically goes to the FSDO -- the FAA expects the same notification, and they'll usually take a single call and coordinate. NTSB Form 6120.1 -- the written report -- follows within 10 days per 830.15. The operator (the school or owner) files it; I assist."

**Common trap 1:** Treating "accident" as a colloquial term. 830.2 has a precise definition. A gear-up landing usually qualifies; an off-airport landing without damage usually doesn't. Read the definition before deciding.

**Common trap 2:** Forgetting the NTSB is *not* the FAA. Two separate agencies. NTSB notification is required by 49 CFR 830 regardless of whether the FAA pursues enforcement.

### Stage 6: §830.10 -- preservation of wreckage

> **49 CFR § 830.10(a)** The operator of an aircraft involved in an accident ... is responsible for preserving to the extent possible any aircraft wreckage, cargo, and mail aboard the aircraft, and all records ... until the Board takes custody...

The airplane stays where it is, or moves only as far as necessary to clear safety hazards (like blocking a runway), until the NTSB releases it.

**What I'd say in the oral:**

> "830.10 -- preservation of wreckage. We don't move the airplane any further than necessary to clear the runway and any safety hazards. We don't poke at it. We don't try to figure out 'what happened.' We don't move the gear handle, the throttle, or anything else. Photographs are fine; touching is not. The airplane is custody of NTSB until released."

### Stage 7: FAA enforcement — the LOI and PBR2

The FAA may pursue enforcement under the **compliance program** (FAA Order 8000.373) or via legal enforcement action. Most likely path for a single gear-up: a **Letter of Investigation** (LOI) from the FSDO inviting a written response, possibly resolved without certificate action under the compliance program.

If certificate action is pursued, the **Pilot's Bill of Rights 2 (PBR2)** applies. Key protections:

- The FAA must inform you that you are the subject of an investigation
- You have the right to obtain ATC tapes and FAA records relevant to the investigation
- You have the right to counsel
- Statements you make to the FAA can be used against you

**What I'd say in the oral:**

> "Within days, I'll likely get a Letter of Investigation. The first step is *not* to immediately write a defensive narrative. The first step is to request all relevant ATC tapes, weather records, and FAA documentation under PBR2 -- I'm entitled to that under the Act. I read the request, I read what the FAA has, and I respond in writing with counsel review. I do not casually call the FSDO and 'explain' -- everything I say can be used against me. The compliance program -- 8000.373 -- gives the FAA discretion to resolve via remedial training rather than certificate action; demonstrating accountability and a learning posture toward the event maximizes that path."

**Common trap 1:** Calling the FSDO immediately to "be cooperative." Cooperative is good; uncoached statements are bad. PBR2 exists exactly because pilots used to incriminate themselves out of nervous helpfulness.

**Common trap 2:** Filing a NASA ASRS report and assuming it provides total immunity. ASRS provides limited protection: a one-time waiver of certificate action for inadvertent violations *not* involving criminal activity, accidents, or lack of qualification. A gear-up landing involving substantial damage is typically classified as an accident, which removes ASRS waiver eligibility -- though the report still provides confidentiality and can support the compliance-program disposition. File it, but don't rely on it as a shield.

### Stage 8: The CFI dimension -- §61.193 / §61.195

You're the instructor on board. CFI obligations are separate from PIC obligations.

> **§61.193** -- Privileges. A person who holds a flight instructor certificate is authorized within the limitations of that person's flight instructor certificate and ratings to give...

> **§61.195** -- Limitations. (a) Hours of training. ... (h) Aircraft Ratings. A flight instructor may not conduct flight training in any aircraft for which the flight instructor does not hold ...

If the student was solo: not your event. If the student was with you (likely scenario for a 'student lands gear-up' setup): you were giving instruction, you may be acting as PIC under the Hicks letter, and your CFI cert is in scope for the FAA's review.

**What I'd say in the oral:**

> "Per Hicks I was acting as PIC. My CFI cert is in scope. The FAA will look at: was I qualified to give this instruction in this airplane? Did the student's experience and currency justify a night IFR cross-country at this stage? Did I give the appropriate pre-flight ground briefing including the gear-extension checklist? Was I monitoring during the approach? My logbook entries from previous lessons with this student matter -- they show my training trajectory. My response to the LOI emphasizes my pre-flight risk assessment, my in-flight monitoring, and what I taught the student about gear-extension verification. The compliance program responds well to a CFI who can demonstrate they were doing the work and learning from the event."

## Compressed answer (under 2 minutes)

For an examiner who wants the integration without the deep dive:

> "**One**: 91.3(b) emergency authority -- act first, the rule frame supports it. Control the airplane, evacuate if needed. **Two**: notify ATC if applicable per 91.123(c); make the CTAF call at uncontrolled. **Three**: 91.7 -- airplane is not airworthy, do not move under power. **Four**: 91.405 / 91.407 -- airplane stays grounded until A&P signs off return to service. Document in 91.417 logs. **Five**: 49 CFR 830.5 -- this is almost certainly an aircraft accident under 830.2 (substantial damage from prop strike); immediate NTSB notification, same notification to FSDO, written report within 10 days. **Six**: 49 CFR 830.10 -- preserve wreckage; don't touch the airplane any more than required to clear safety hazards. **Seven**: FAA enforcement -- expect an LOI; under PBR2, request all ATC and FAA records before responding; written response with counsel review; the compliance program (Order 8000.373) is the preferred resolution path. **Eight**: as CFI, my cert is in scope per Hicks; my logbook and the student's training history are the evidence. Stay calm, document everything, don't volunteer statements without preparation."

That answer cites 5 CFR sections plus 4 NTSB sections plus 2 FAA Orders plus the Hicks Chief Counsel letter plus PBR2 plus ASRS in under 2 minutes. The capstone-level expectation.

## What goes wrong (failure modes)

| Failure mode                                              | Diagnosis |
| --------------------------------------------------------- | --------- |
| Tries to taxi the airplane after the slide stops           | 91.7 violation; prop strike means engine cannot be operated until torn down |
| Reports to FAA but forgets NTSB                            | Mistakes the agency. 49 CFR 830 is NTSB; separate from FAA enforcement |
| Doesn't preserve wreckage                                  | 49 CFR 830.10 violation -- moving the airplane to "see what happened" destroys evidence |
| Calls the FSDO immediately to explain what happened        | Self-incrimination; bypass of PBR2 protections; destroys compliance-program leverage |
| Assumes an ASRS filing provides total immunity            | ASRS waiver eligibility excludes accidents; file it for confidentiality, but don't rely on it |
| Forgets to document the event in the airplane logs        | 91.417 record-keeping miss; complicates A&P sign-off |
| Treats this as PIC-only event, ignores CFI cert in scope  | Per Hicks, the CFI manipulating controls is PIC; CFI cert is in scope regardless |
| Mistakes "accident" for a colloquial term                  | 49 CFR 830.2 has a precise definition. Read it; don't guess |

## Variant prompts

| Variant                                                                    | What changes |
| -------------------------------------------------------------------------- | ------------ |
| "Same scenario, but no prop strike -- bellied in on a grass strip without damage." | Likely *not* an accident under 830.2 (no substantial damage). Could still be an incident under 830.5(a)(1)-(11) if it triggers any specific incident category. Check the list. NTSB notification not automatic; FAA notification still customary. |
| "Same scenario, but the student was solo."                                  | You're not on board. CFI cert still in scope because the FAA will look at your endorsement under 61.87 / 61.93 (whether the solo XC was authorized for these conditions). Your logbook entries for this student are evidence. |
| "Same scenario, but the airplane was a club rental and you're the renter."   | Now you're owner-equivalent under 91.405, *and* PIC. Compounds responsibility. |
| "Same scenario at a towered airport, ATC asks you to taxi clear before the firetrucks arrive." | 91.123(c) deviation in response to ATC. Document; explain. |
| "Same scenario, but the student is your friend's family member, not your formal student." | If you weren't logged as instructor giving instruction, this becomes a 91.3 PIC question only -- your CFI cert isn't directly in scope, but your private/commercial cert is. |
| "Same scenario, but you smell alcohol on the student's breath." | Adds 91.17 (8-hour, 0.04, no-influence). Adds 67.107 / 67.207 / 67.307 medical disqualification questions. Reporting obligations expand. |

## Related material

- **Knowledge graph:** TBD nodes -- `reg-91-7-airworthiness`, `reg-49-cfr-830-accident-incident-reporting`, `reg-pbr2-protections`
- **Lessons that feed this oral:**
  - [Week 4: Part 91 general and flight rules](../week-04-part-91-general-and-flight-rules/overview.md) -- 91.3, 91.7, 91.13, 91.123
  - [Week 5: Part 91 equipment and maintenance](../week-05-part-91-equipment-and-maintenance/overview.md) -- 91.405, 91.407, 91.417
  - [Week 9: Enforcement and NTSB Part 830](../week-09-enforcement/overview.md) -- the post-incident dimension
  - [Week 3: Part 61 CFI](../week-03-part-61-cfi/overview.md) -- 61.193, 61.195
- **Authoritative interpretations:**
  - **Hicks letter (2010)** -- CFI manipulating controls is acting as PIC
  - **FAA Order 8000.373** -- Compliance philosophy / compliance program
- **Sibling capstones:**
  - [night-ifr-passenger.md](night-ifr-passenger.md) -- the pre-flight regulatory check
  - [friend-flight-review.md](friend-flight-review.md) -- the CFI signoff scenario
  - [ppl-applies-for-ir.md](ppl-applies-for-ir.md) -- the qualification scenario
