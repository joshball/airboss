---
title: IFR currency -- §61.57(c), the grace period, and the IPC
week: 2
section_order: "05"
covers_regulations:
  - 61.51
  - 61.57
ties_to_knowledge_nodes:
  - reg-currency-vs-proficiency
last_verified: 2026-04-29
---

# IFR currency -- six-six-HIT, the grace, the IPC

§61.57(c) is the most-asked, most-mis-answered currency regulation in the IFR community. Pilots can recite "six-six-HIT" before they can recite their own birthday and still get the underlying mechanics wrong on a checkride. The trap is that the regulation has *three different states* the pilot can be in -- current, lapsed but in grace, lapsed past grace -- and each state demands a different remedy.

This lesson is the deep-dive promised in [03-currency-vs-recency-vs-proficiency.md](03-currency-vs-recency-vs-proficiency.md). We unpack §61.57(c)/(d)/(e), what counts as an approach, the safety pilot rules in §91.109, and the simulator/ATD credit options in §61.57(c)(2)/(3).

## What you'll be able to do

- State precisely what §61.57(c) requires for IFR currency
- Diagnose a pilot's currency state (current / in grace / past grace) from their logbook entries
- Apply the safety pilot rules of §91.109(c) to determine when an IFR-currency-flying pilot needs another pilot in the right seat
- Distinguish what counts as an "instrument approach" for §61.57(c) credit
- Counsel a pilot on the IPC requirements when grace expires

## Why this matters

A pilot who is past the IFR currency grace period and tries to "just do six approaches" is committing a §61.57(c) violation every time they exercise IFR PIC privileges. Working CFIs see this constantly: the pilot returns from a 14-month break convinced they are one safety-pilot session away from being current, and they're wrong by a factor of two. A CFII who lets that pilot file IFR is exposed under §61.197 (CFI privileges).

The proficiency dimension is also worse for IFR than for VFR. A current-but-not-proficient VFR pilot in clear weather has a wide margin. A current-but-not-proficient IFR pilot in IMC has none. The 6-6-HIT rule is a *floor* and an unusually thin one; AC 61-98 explicitly recommends pilots maintain currency well in excess of the regulatory minimum.

## The discovery question

A pilot you fly with logged the following IFR currency entries:

```text
2025-10-15  GPS approach RWY 13L (KPAO, simulated, safety pilot Smith)
2025-10-15  ILS approach RWY 23 (KPAO, simulated, safety pilot Smith)
2025-10-15  Holding pattern at OAK VOR
2025-10-15  Course tracking, OAK to SAU VOR
2025-11-22  RNAV(GPS) approach RWY 30 (KSQL, actual)
2025-11-22  ILS approach RWY 30 (KSQL, actual)
```

Today is May 28, 2026. The pilot calls and asks: "Am I current to file IFR tomorrow morning?"

Pause. What do you ask, and how do you check?

The pilot has done six approaches, holding, and intercepting/tracking. The question is whether they're all within the preceding 6 *calendar* months. Today is May 28, 2026; "preceding 6 calendar months" includes November 2025, December 2025, January 2026, February 2026, March 2026, April 2026, May 2026 -- the back-end (current) calendar month is free, the front end (October 2025) is past.

October 15, 2025 entries: out of window. Four approaches and two procedural items expired.
November 22, 2025 entries: in window. Two approaches.

Recount: 2 approaches, 0 holding, 0 tracking *in window*. The pilot is *not* current. They need 4 more approaches, holding, and tracking before they file IFR.

This kind of read is exactly what working CFIIs do when a pilot calls. The reading is the work. Doing the math wrong puts the pilot one §61.13 enforcement letter away from a violation.

## What §61.57(c) actually says

```text
§61.57(c) Instrument experience. Except as provided in paragraph (e) of
this section, a person may act as pilot in command under IFR or in weather
conditions less than the minimums prescribed for VFR only if:

  (1) Use of an aircraft for maintaining instrument experience.
      Within the 6 calendar months preceding the month of the flight,
      that person performed and logged at least the following tasks
      and iterations in an aircraft of the appropriate category for
      the instrument privileges sought, in actual weather conditions
      or under simulated conditions using a view-limiting device
      that involves having performed the following --

      (i) Six instrument approaches;
      (ii) Holding procedures and tasks;
      (iii) Intercepting and tracking courses through the use of
            navigational electronic systems;

  (2) Use of a flight simulator, flight training device, or aviation
      training device. ...

  (3) Combined use of an aircraft, flight simulator, flight training
      device, or aviation training device. ...

  (4) ...

(d) Instrument proficiency check. Except as provided in paragraph (e)
    of this section, a person who has failed to meet the instrument
    experience requirements of paragraph (c) for more than six calendar
    months may reestablish instrument currency only by completing an
    instrument proficiency check.

(e) ...

Note: paraphrase of §61.57(c)(d). Read the actual reg before referencing
in exam.
```

Five things to extract:

1. **Six approaches** in the preceding 6 calendar months. Not 5; not "six-month period from when you started." Six approaches with documentation showing each one in compliance.
2. **Holding procedures and tasks.** One satisfies the requirement. There is no count specified -- one holding entry in the 6-month window suffices.
3. **Intercepting and tracking courses.** Same. The reg says "intercepting and tracking" with no count specified. CFIIs typically log this as one entry covering a substantive course intercept and a tracking segment.
4. **In an aircraft of the appropriate category.** An ASEL pilot maintains IFR currency in an airplane (ASEL or AMEL); helicopter currency is its own category. The category is the airplane / rotorcraft / powered-lift level, not the class.
5. **Actual or simulated.** The pilot can be flying in actual IMC or under a view-limiting device with a safety pilot. Simulated counts identically. The trap with simulated: §91.109(c) requires a safety pilot meeting specific requirements (which we treat below).

## What counts as an "instrument approach"

§61.57(c) does not define "instrument approach" in the section itself. AC 61-98 and the FAA's Instrument Procedures Handbook (IPH, FAA-H-8083-16) supply the working definition.

A logged instrument approach for §61.57(c) credit:

- **Must be a published procedure** (FAA, ICAO, or military). A self-made simulated approach to a non-charted runway does not count. The published approach can be ILS, LOC, VOR, NDB, GPS, RNAV(GPS), RNP, LDA, SDF, or LPV.
- **Must be flown to MDA or DH (decision height/altitude)**. The pilot must descend to the MDA/DH or initiate a missed approach from the MDA/DH. An approach broken off above MDA/DH (canceling early because of comfortable VMC) does not count for currency.
- **Pilot must be in actual or simulated instrument conditions** to the FAF (final approach fix). If the pilot is in VMC and flying the approach as a visual exercise without simulated conditions, the approach does not count.
- **Counts once per flight per procedure**. Two practice approaches to KSQL ILS 30 on the same flight, both flown to minimums, count as two approaches. Two attempts on the same approach (one missed, one continued) count as two only if the second was a separate full procedure flown to minimums.

The practical implication: a CFII flying with a current-track pilot under the hood logs the procedure as the pilot flies it. The CFII's logbook entry mirrors the pilot's. Both can later cite the entry; the pilot for §61.57(c) currency, the CFII for dual-given hours under §61.51(j).

The trap on canceling early: in VMC with circling-to-land at the destination, pilots often cancel IFR before reaching MDA. That approach does not count for currency. To get currency credit, the pilot must descend to MDA / DH or initiate a missed (under simulated conditions if VMC). This is one of the highest-yield checkride questions for the IFR oral and one of the highest-yield CFII gotchas in real practice.

## The safety pilot rules -- §91.109(c) and §61.51(g)(2)

A pilot who flies simulated instrument conditions (under a view-limiting device) requires a safety pilot in the other control seat. §91.109(c) sets the safety pilot requirements:

```text
§91.109(c). Aircraft. No person may operate a civil aircraft in simulated
instrument flight unless --

  (1) The other control seats are occupied by a safety pilot who possesses
      at least:

      (i) A private pilot certificate (or commercial certificate) with
          category and class ratings appropriate to the aircraft being
          flown; and

      (ii) Adequate vision forward and to each side of the aircraft, or
           a competent observer in the aircraft adequately compensates
           for the latter limitation.

  (2) The aircraft is equipped with fully functioning dual controls; or,
      in the case of a single-engine airplane equipped with a separate
      throwover control system, the safety pilot can take control if
      necessary.
```

Three implications:

1. **Safety pilot must be a rated pilot in category and class.** A non-pilot family member is not a safety pilot. A glider pilot is not a safety pilot for an airplane. An ASEL safety pilot for an AMEL flight is questionable -- the safety pilot must hold ratings appropriate to the aircraft being flown.
2. **Safety pilot is not a passenger.** The flight is a two-pilot operation when simulated conditions are flown. Both pilots are crew.
3. **Safety pilot logs PIC time -- when, exactly?** §61.51(e)(1)(iii) lets the *acting PIC* log PIC. If the safety pilot is acting as PIC (e.g., the flying pilot is a non-current IFR pilot under simulated conditions, and the safety pilot has agreed to be the legal PIC for the flight), the safety pilot logs PIC for the simulated portion. If the flying pilot is acting as PIC and is just exercising the privilege of flying simulated instrument conditions, the safety pilot logs SIC time (or no flight time at all, depending on the operational arrangement).

The Hicks (2010) Chief Counsel letter clarifies that two pilots can both log PIC for the same simulated instrument time when the flying pilot is sole manipulator and the safety pilot is the *legal* PIC of the flight -- §61.51(e)(1)(i) for the safety pilot, §61.51(e)(1)(ii) for the flying pilot.

The practical case: a non-IFR-current pilot wants to do six approaches under the hood to recover currency. The pilot is not currently authorized to act as PIC under IFR (their IFR currency is lapsed). A current safety pilot in the right seat acts as the legal PIC; the flying pilot logs PIC under §61.51(e)(1)(ii) (sole manipulator, rated in category and class) plus the §61.57(c) currency events. The safety pilot logs PIC under §61.51(e)(1)(i) (acting PIC).

The Hicks letter is high-yield material. CFII oral exams ask the safety-pilot question constantly.

## §61.57(c)(2) -- simulator and ATD credit

A pilot can satisfy some or all of the §61.57(c)(1) requirements in approved simulators or training devices.

```text
§61.57(c)(2). A person may accomplish the requirements in paragraphs
(c)(1)(i) through (c)(1)(iii) of this section in a flight simulator,
flight training device, or aviation training device, provided the
device represents the category of aircraft for the instrument rating
privileges to be maintained and the pilot performs the tasks and
iterations in simulated instrument conditions.

A person may complete a portion of the requirements in paragraph (c)(1)
of this section in a flight simulator, flight training device, or
aviation training device under the conditions specified in paragraph
(c)(3) of this section.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The categories of approved devices:

- **Full Flight Simulator (FFS).** Level B/C/D simulators. Most expensive. Used by airlines and large training centers.
- **Flight Training Device (FTD).** Level 4-7. Less expensive than FFS but FAA-approved with a Level of Approval certificate. Includes reasonably accurate aircraft handling and full visual systems.
- **Aviation Training Device (ATD).** Includes the Basic ATD (BATD) and Advanced ATD (AATD) categories. Devices like Redbird FMX, Frasca, Elite ATDs, certain home computer setups with appropriate certification. The FAA approves these per AC 61-136.

The credit structure (per §61.57(c)(2)/(3)):

| Device                                    | Credit toward §61.57(c)                        |
| ----------------------------------------- | ---------------------------------------------- |
| Full flight simulator (FFS) -- Level B/C/D | 100% of §61.57(c)(1) requirements              |
| Flight training device (FTD) Level 4-7    | 100% of §61.57(c)(1) requirements              |
| Aviation training device (AATD)           | 100% of §61.57(c)(1) requirements              |
| Aviation training device (BATD)           | 100% of §61.57(c)(1) requirements              |

All approved categories give full credit toward currency. The *practical* difference between an ATD currency session and a real-airplane currency session is not regulatory but pedagogical -- many CFIIs note that the pilot who maintains currency only in an ATD has decreasing real-airplane proficiency, even though both pilots are equally legal.

§61.57(c)(3) covers combined credit -- the pilot can use a mix of aircraft and devices. There is no minimum aircraft component required for currency under (c)(3); a pilot could maintain currency entirely in an AATD if they wished.

The trap: simulator currency credit applies *to the aircraft category*, not to specific aircraft types. An ATD configured to represent a 172 maintains airplane category currency; the pilot can then exercise IFR PIC in any airplane they're rated for, not just 172s. The category match is what §61.57(c)(2) requires.

## §61.57(d) -- the grace period

```text
§61.57(d). A person who has failed to meet the instrument experience
requirements of paragraph (c) for more than six calendar months may
reestablish instrument currency only by completing an instrument
proficiency check.

Note: paraphrase. Read the actual reg before referencing in exam.
```

This is the famous "grace period" -- though the regulation doesn't use that word. The state machine:

```text
State: Current
  - Most recent 6/6/HIT events are within the preceding 6 calendar months
  - Pilot may exercise IFR PIC privileges
  - Window resets each time a new 6/6/HIT event is logged

State: Lapsed (in grace)
  - More than 6 calendar months since most recent 6/6/HIT event
  - Pilot may NOT exercise IFR PIC privileges
  - Pilot may regain currency by completing 6/6/HIT under simulated conditions
    (with safety pilot per §91.109(c))
  - Grace ends 6 calendar months after currency lapsed (i.e., 12 calendar
    months after the most recent currency event)

State: Past grace
  - More than 12 calendar months since most recent 6/6/HIT event
  - Pilot may NOT exercise IFR PIC privileges
  - Pilot must complete an Instrument Proficiency Check (IPC) per §61.57(d)
  - IPC is administered by an authorized CFII or examiner per AC 61-98
  - Completing an IPC starts a fresh 6-calendar-month currency clock
```

The grace period is the most-misread part of §61.57. A pilot 9 months out from their last currency event is *in grace* -- they cannot fly IFR but they can still self-recover. A pilot 13 months out is *past grace* -- they need an IPC. The 6-month grace window is the difference.

A pilot who realizes they've lapsed at month 8 can call a CFI and arrange a session under simulated conditions with a safety pilot. They fly 6 approaches, holding, and tracking. They are now current.

A pilot who realizes they've lapsed at month 14 is past grace. The same six approaches under simulated conditions are not enough -- they need an IPC, with an IPC-eligible CFII or examiner, to the standard of an instrument practical test (per the Airman Certification Standards / Practical Test Standards for the instrument rating). The IPC is a structured event lasting 2-4 hours of flight typically; AC 61-98 provides the recommended content.

## What an IPC actually involves

AC 61-98D specifies the recommended IPC content. The IPC is conducted "to the standard of the practical test" for the instrument rating. The CFII or examiner administering the IPC evaluates the pilot's performance against the published ACS / PTS for the instrument rating.

Recommended IPC tasks (AC 61-98 Appendix):

| Task category                         | Example tasks                                                           |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Preflight (ground)                    | Weather review, NOTAM check, weight and balance, performance, go/no-go |
| Departure                             | IFR clearance copy and readback, departure procedure                    |
| En route                              | Course intercepts, holding, cruise climb/descent, course changes        |
| Approach (precision)                  | ILS or LPV to minimums                                                  |
| Approach (non-precision)              | RNAV(GPS), VOR, LOC, or LOC-BC to minimums                              |
| Approach (partial panel)              | At least one approach with primary instrument failure                   |
| Missed approach                       | At least one full missed approach procedure                             |
| Approach with circling                | Circling-to-land procedure (when conditions permit)                     |
| Emergencies                           | Lost communication procedures, system failure response                  |
| Landing                               | Approach to a normal full-stop landing                                  |

Total recommended duration: 2-3 hours of flight plus 1+ hour of ground (preflight + post-flight).

The IPC endorsement language is in AC 61-65 (Endorsement A.74 and adjacent). The CFII signs the logbook; the new 6-calendar-month currency clock starts.

The IPC has no upper grace -- a pilot who has been out of currency for 5 years still recovers via IPC. The IPC content is the same; the CFII just plans for more re-training before the eval.

## §61.57(e) -- the equivalent of an IPC

§61.57(e) clarifies that an instrument practical test (the test that initially issues the instrument rating) also satisfies the §61.57(c) currency requirement. A pilot who earns their instrument rating on March 1, 2026 is current under §61.57(c) until September 30, 2026 -- the practical test counts as the initial currency event.

Similarly, an instrument-rating add-on (e.g., AMEL with instrument privileges added to an existing ASEL/instrument rating) counts.

## Common misreadings

- **"I just need six approaches."** Wrong. §61.57(c) requires *six approaches plus holding plus intercepting/tracking*, all in the preceding 6 calendar months. Six approaches alone do not suffice.
- **"Approaches in VMC count if I shoot them as practice."** Wrong. The pilot must be in actual or simulated instrument conditions through the FAF, and must descend to MDA/DH. A practice approach in clear weather without a hood does not count.
- **"I broke off the approach at 800 AGL because we had the runway in sight. That counts."** Wrong (usually). The approach must be flown to MDA/DH or to the missed approach point. Breaking off above MDA/DH because the field is in sight forfeits the currency credit.
- **"Currency in actual is the same as currency in simulated."** True for §61.57(c) credit, but the proficiency they build is different. AC 61-98 recommends *some* approaches be flown in actual to maintain real-IMC skill. Pilots who maintain currency only in clear weather under the hood often have brittle real-IMC performance.
- **"The grace period gives me 6 months from when I lapsed to do anything I want."** Wrong. The grace period gives the pilot 6 months from when they lapsed to *recover currency by completing 6/6/HIT*. They cannot exercise IFR PIC privileges *during* the grace period; they can only re-establish currency.
- **"After grace, I just need to do six more approaches."** Wrong. After grace expires (12 calendar months from the last currency event), an IPC is required. The IPC is a checkride-grade event, not a currency repetition.
- **"My safety pilot can be any rated pilot."** Mostly right but check §91.109(c). The safety pilot needs ratings appropriate to the aircraft being flown -- ASEL is fine for an ASEL flight, but a glider pilot would not satisfy §91.109(c) for an airplane flight.
- **"I can use a sim for the flight portion of an IPC."** Partially true. AC 61-98 permits portions of the IPC in approved simulators / FTDs / AATDs (specifically the precision approach, non-precision approach, and certain enroute tasks). At least some of the IPC must be flown in an aircraft. Check the current AC and the examiner's interpretation.
- **"BasicMed pilots can't fly IFR."** Wrong. BasicMed pilots may exercise instrument privileges if they meet §61.57(c). The medical certificate type does not affect currency requirements -- only the privileges of the certificate.

## Drills

### Locate the section

| Question                                                                     | Section / source     |
| ---------------------------------------------------------------------------- | -------------------- |
| Where is the IFR currency requirement?                                       | §61.57(c)            |
| Where is the IFR grace period?                                               | §61.57(d)            |
| Where is the IPC requirement after grace expires?                            | §61.57(d)            |
| Where is the simulator/ATD credit for IFR currency?                          | §61.57(c)(2)         |
| Where is the safety pilot rule?                                              | §91.109(c)           |
| Where does a safety pilot's PIC logging come from?                           | §61.51(e)(1)         |
| Where does the IPC content come from?                                        | AC 61-98             |
| Where does the IPC endorsement wording come from?                            | AC 61-65             |
| Where does the instrument practical test count as currency?                  | §61.57(e)            |

### Apply the rules

> A pilot's most recent 6/6/HIT entries are dated October 12, 2025 (six approaches + holding + tracking, all in one flight). Today is May 28, 2026. Are they current?

Answer: October 12, 2025 -> May 28, 2026 is 7 calendar months and change. The "preceding 6 calendar months" window from May 2026 includes November, December, January, February, March, April, and May (current month free). October 2025 is past. Currency is lapsed. The pilot is in grace through October 31, 2026 (12 calendar months from the prior currency event); during grace, they can re-establish via 6/6/HIT under simulated conditions with a safety pilot, but cannot exercise IFR PIC privileges.

> A pilot's most recent 6/6/HIT events are May 2024. Today is October 28, 2026. They want to recover IFR currency. What do they need?

Answer: 28 calendar months since last currency event. Way past grace (which ends at 12 months). They need an IPC per §61.57(d), administered by an authorized CFII or examiner, to the standard of the instrument PTS / ACS. The IPC will likely require multiple training sessions before the eval given the lapse. After IPC, the new 6-calendar-month clock starts.

> A 1500-hour ATP-rated pilot is also a CFII. They flew 4 approaches in actual IMC last week with a student. They're trying to recover currency. Did the approaches count?

Answer: Yes for the CFII's logbook -- approaches in actual IMC where the pilot is sole manipulator (whether teaching or recovering) count under §61.57(c)(1)(i). The CFII logged dual-given for instructional time and PIC for sole-manipulator-rated time per §61.51(j). The approaches count for the CFII's currency.

> A current IFR pilot files IFR for a flight tomorrow. They want to bring a non-pilot family member as a passenger. The passenger has never flown before and is nervous. The pilot is comfortable in actual IMC and proficient. Are there regulatory issues?

Answer: §61.57(a) (3 takeoffs and landings within 90 days for passenger ops) applies separately -- check that. §61.57(c) is satisfied. §91.109(c) does not apply (the pilot is in actual IMC, not simulated, so no safety pilot is required). The passenger is a passenger, not a safety pilot. No issue.

> Same scenario, but the pilot wants to file under simulated instrument conditions for currency-building, with the family member in the right seat. Is that legal?

Answer: No. §91.109(c) requires a safety pilot for simulated instrument conditions. A non-pilot family member cannot serve as safety pilot. The pilot must either (a) fly the approaches in actual conditions where no safety pilot is needed, or (b) bring a rated safety pilot per §91.109(c) and the family member rides in back as a passenger.

> A pilot completes 6 approaches in an AATD, 1 holding pattern, and 1 tracking exercise -- all in one 90-minute simulator session. Are they current under §61.57(c)?

Answer: Yes. §61.57(c)(2) gives full credit for an approved AATD. The 90-minute session counts identically to a 90-minute aircraft session for currency. The AATD must be approved per AC 61-136 and the operator's letter of authorization.

## Where this lesson sits

This is lesson 5 of week 2. We deep-dived §61.57(c)/(d)/(e), the IPC, and the safety pilot rules.

- Previous: [04-flight-review-and-equivalents.md](04-flight-review-and-equivalents.md) -- §61.56 deep-dive
- Next: [06-medical-certificates.md](06-medical-certificates.md) -- Part 67 + Part 68 (BasicMed) + 49 USC 44703

## Related

- Knowledge graph: [reg-currency-vs-proficiency](../../knowledge/regulations/currency-vs-proficiency/node.md)
- Live source: [Part 61](airboss-ref:regs/cfr-14/61?at=2026)
- Live source: [recent flight experience](airboss-ref:regs/cfr-14/61/57?at=2026)
- Live source: [logging](airboss-ref:regs/cfr-14/61/51?at=2026)
- Live source: [simulated instrument flight rules](airboss-ref:regs/cfr-14/91/109?at=2026)
- Companion: AC 61-98 (currency requirements and IPC content)
- Companion: AC 61-65 (endorsement bible -- IPC endorsement A.74)
- Companion: AC 61-136 (FAA approval of ATDs)
- Chief Counsel: Hicks (2010) -- safety pilot PIC logging
- Reference: FAA-H-8083-16 (Instrument Procedures Handbook) -- working definition of instrument approach
