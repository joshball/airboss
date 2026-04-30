---
title: Parts 145 and 121 -- name and locate
week: 7
section_order: "04"
covers_regulations:
  - 121.1
  - 121.7
  - 145.1
  - 145.3
  - 145.51
  - 145.53
  - 145.201
ties_to_knowledge_nodes: []
last_verified: 2026-04-29
---

# Parts 145 and 121 -- name and locate

This is a literacy lesson, not a deep dive. As a CFI you do not operate under Part 121 or Part 145. You may, in your career, never knowingly cross either part. But you should be able to recognize when an aircraft you're about to rent has just come out of a Part 145 repair station, and when a friend who flew you somewhere is talking about a Part 121 operation versus a Part 135 charter. Both come up.

## What you'll be able to do

- State what Part 145 covers and recognize when an aircraft's maintenance was performed under it
- State what Part 121 covers and recognize when an operation is conducted under it
- Locate the applicability sections of both parts in 60 seconds
- Distinguish "the airline part" (121) from "the on-demand commercial part" (135)

## Why this matters

Two scenarios where a CFI will encounter these parts:

1. **Maintenance.** A rental aircraft you're about to fly was returned to service after an annual inspection at a Part 145 repair station. The logbook entry will reference the repair station's certificate number and rating. You should be able to read that entry and know what it means.
2. **Career advice.** Your commercial students will eventually ask about the airlines. The airlines are 121 operations. The minimums are different from 135. The path through 135 to 121 is the canonical career arc, and the differences between 135 and 121 are how a student gauges how much further they have to go.

We name and locate both parts. We do not work them in detail. If you end up at a 121 carrier or a 145 station, your employer will train you on the part in depth.

## The discovery question

You're about to fly a club 172 you haven't flown in two months. You open the airframe logbook. The most recent entry reads:

```text
Annual inspection completed in accordance with 14 CFR 43 Appendix D.
Aircraft returned to service. /s/ John Smith, A&P 1234567 IA
Repair Station No. ABC123Y, certified under 14 CFR Part 145.
```

What did the entry just tell you?

Pause.

Three things:

1. The annual was performed by an Authorized Inspector (the IA designation), satisfying [@cite](airboss-ref:regs/cfr-14/91/409?at=2026).
2. The work was done at a Part 145 repair station, identified by its certificate number.
3. The repair station holds an FAA certificate under Part 145 with specific *ratings* (airframe, powerplant, propeller, accessory, instrument, radio, limited-X) that authorize what work it can do.

This is enough to satisfy you that the aircraft is airworthy from a regulatory standpoint. You do not need to read Part 145 to fly the airplane. You do need to recognize that this is a 145 entry and that the certificate number can be looked up if anything seems wrong.

## Part 145 -- repair stations

```text
Part 145 -- Repair Stations

Subpart A -- General                          (145.1 to 145.5)
  Applicability, definitions.

Subpart B -- Certification                    (145.51 to 145.63)
  How to get a repair station certificate, ratings,
  certificate duration.

Subpart C -- Housing, Facilities, Equipment, Materials, and Data
                                              (145.101 to 145.109)
  What the repair station must have on premises.

Subpart D -- Personnel                        (145.151 to 145.163)
  Required management positions, technician qualifications.

Subpart E -- Operating Rules                  (145.201 to 145.223)
  How the repair station does its work, recordkeeping,
  return-to-service procedures.

Subpart F -- Records, Reports, and Inspections (145.219 to 145.223)
  Service difficulty reports, work order records.
```

The two sections to know:

- [@cite](airboss-ref:regs/cfr-14/145/1?at=2026) -- applicability. A repair station is a *certificated* organization that performs maintenance, alteration, or preventive maintenance on aircraft, airframes, engines, propellers, appliances, or component parts. Without the certificate, the organization is not a 145 station -- a single A&P working solo is not a repair station; they're an individual mechanic operating under Part 65.
- [@cite](airboss-ref:regs/cfr-14/145/51?at=2026) -- certification. Specifies the application process and the *ratings* a repair station can hold.

Repair station ratings are the operational shape of the certificate:

| Rating               | Authorizes                                                        |
| -------------------- | ----------------------------------------------------------------- |
| Airframe             | Work on airframes (limited or unlimited by class)                 |
| Powerplant           | Work on engines (limited or unlimited by class)                   |
| Propeller            | Work on propellers                                                |
| Radio                | Work on radio / avionics equipment                                |
| Instrument           | Work on instruments                                               |
| Accessory            | Work on accessories (pumps, generators, actuators, etc.)          |
| Limited              | A specific scope authorized by the FSDO (e.g. limited to one model) |

A 145 station may hold multiple ratings. The certificate lists them. A station with airframe + powerplant ratings can do a full annual inspection in-house. A station with only an instrument rating can rebuild a directional gyro but not return an airplane to service.

The big idea: Part 145 governs the *organization* doing maintenance. Part 43 governs the *work* itself (the methods, techniques, and standards). A logbook entry shows both: the work was done per Part 43 standards, by personnel authorized under Part 145.

## Part 121 -- the airline part

```text
Part 121 -- Operating Requirements: Domestic, Flag, and Supplemental
            Operations

Subpart A -- General                          (121.1 to 121.15)
  Applicability, definitions, the three operation kinds:
  domestic, flag (international), supplemental (charter-like).

Subparts B-D -- (mostly procedural / certification)

Subpart E -- Approval of Routes: Domestic and Flag Operations
                                              (121.91 to 121.107)
  Route certification, en-route alternates.

Subpart F -- Approval of Areas and Routes for Supplemental Operations
                                              (121.111 to 121.127)
  Charter / freighter route approvals.

Subpart G -- Manual Requirements              (121.131 to 121.141)
  The operations manuals required.

Subpart H -- Aircraft Requirements            (121.151 to 121.169)
  What aircraft can be used.

Subpart I -- Airplane Performance
              Operating Limitations           (121.171 to 121.197)
  The famous "60% / climb gradient" performance rules.

Subparts J-M -- (special airworthiness, instruments, equipment)

Subpart N -- Training Program                 (121.400 to 121.420)
  The training program structure -- initial, transition, recurrent.

Subpart O -- Crewmember Qualifications        (121.431 to 121.453)
  PIC, SIC, flight engineer requirements.

Subpart P -- Aircraft Dispatcher Qualifications (121.461 to 121.469)
  The dispatcher cert.

Subpart Q -- Flight Time Limitations and Rest Requirements:
              Domestic Operations             (121.470 to 121.474)
  The famous "FAR 117" rest rules (now in subparts Q, R, S).

Subparts R-S -- flight time limitations for flag / supplemental

Subpart T -- Flight Operations                (121.531 to 121.595)
  The day-to-day rules for the flight itself.

Subparts U-Z -- airworthiness, maintenance, recordkeeping.
```

Three sections to know cold:

- [@cite](airboss-ref:regs/cfr-14/121/1?at=2026) -- applicability. Part 121 governs *scheduled* air carriers (with carve-outs for some smaller scheduled operators that fall to 135).
- [@cite](airboss-ref:regs/cfr-14/121/7?at=2026) -- definitions. The "domestic / flag / supplemental" trichotomy that organizes the rest of the part.
- [@cite](airboss-ref:regs/cfr-14/121/471?at=2026) and neighbors -- duty / rest. Famous in pilot circles as "FAR 117" -- the post-Colgan rest reform that moved most flight-time and duty rules into a uniform framework.

Three kinds of 121 operation:

| Kind          | What it is                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| Domestic      | Scheduled service entirely within the 48 contiguous states (with extensions to AK/HI) |
| Flag          | Scheduled service across international borders (the "flag-carrier" model)     |
| Supplemental  | Charter or non-scheduled airline-style operations, large aircraft             |

For a CFI sending a student to "the airlines," 121 domestic is what they'll experience at most regional and major carriers. 121 flag is the international long-haul model.

## How 121 differs from 135

The two on-demand-vs-scheduled distinction is the headline, but operationally:

| Area                | Part 135                                                                          | Part 121                                                                                            |
| ------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Operation type      | Charter, on-demand, smaller scheduled                                             | Scheduled airline, large aircraft                                                                   |
| Pilot minimums      | [@cite](airboss-ref:regs/cfr-14/135/243?at=2026) -- typically 1,200 hr for IFR PIC | ATP required for PIC ([@cite](airboss-ref:regs/cfr-14/61/153?at=2026)); 1,500 hr or R-ATP carve-out |
| Crew requirement    | Often single-pilot                                                                | Always two-pilot, often three with relief crew                                                      |
| Dispatcher          | None typically                                                                    | Required (subpart P) -- shared operational control with the captain                                 |
| Training            | Operator's program (subpart H)                                                    | Operator's program (subpart N) -- usually more extensive, full-motion sim                           |
| Rest rules          | Subpart F                                                                         | Subparts Q-S ("FAR 117")                                                                            |
| Maintenance program | Subpart J / continuing airworthiness                                              | Subparts U-Z / continuous airworthiness maintenance program (CAMP)                                  |
| Operations manual   | Required, lighter                                                                 | Required, much heavier (subpart G)                                                                  |

Both 121 and 135 hang off a Part 119 certificate. The certificate's ops specs determine which part applies.

## When you might hear about these parts

| Situation                                                                          | Part involved |
| ---------------------------------------------------------------------------------- | ------------- |
| Reading a logbook entry after an annual or major repair                            | 145           |
| A student asks about flying for Delta / American / United                          | 121           |
| A student asks about flying for a regional that you've never heard of              | 121 (most regionals are 121 domestic) |
| A student asks about flying for NetJets / Wheels Up / a fractional owner-pilot     | 135 typically (some now 91K -- fractional ownership rules) |
| You're considering buying an avionics upgrade -- the shop must be 145-certificated for the work | 145 |
| The maintenance facility your club uses *isn't* a 145 station, just an A&P/IA      | Part 43 + Part 65 (individual mechanic), not 145 |

## Common misreadings

- **"All commercial maintenance is done at a Part 145 station."** Wrong. An individual A&P with IA can perform an annual inspection on a small aircraft. Part 145 is for *certificated organizations*; many small-shop maintainers are not 145 stations. The work is just as legal under Part 43 + Part 65.
- **"Every airline operation is Part 121."** Mostly right but not always. A charter that operates under 135, even if the aircraft looks airliner-sized, is 135. Some scheduled commuters under specific seat / weight thresholds operate under 135 instead of 121. The line is in [@cite](airboss-ref:regs/cfr-14/119/21?at=2026), not in the airline's branding.
- **"NetJets is a 121 operation."** Wrong as of current rules. Fractional ownership operations are governed by Part 91 subpart K (the "91K" rules) plus, for many fractional flights, Part 135. Not 121.
- **"FAR 117 is a separate part of the regulations."** Wrong. The popular term "FAR 117" refers to the post-Colgan rewrite of flight-time / duty / rest rules, which lives in *Part 117 of 14 CFR* (yes, there's also a Part 117) -- a part that *only* applies to 121 air carriers. For 135, the rest rules are in 135 subpart F, not in Part 117. Pilots conflate these all the time.
- **"A 145 station can do anything to my airplane."** Wrong. The repair station's *ratings* limit the scope of work. A 145 station with only an instrument rating cannot perform a 100-hour inspection. Always cross-check the station's rating against the work required.

## Where this lesson sits

- Previous: [03-part-135-and-119.md](03-part-135-and-119.md) -- on-demand commercial
- Next: this is the last lesson of week 7
- Forward: Week 8 covers AIM, ACs, Chief Counsel literacy

## Related material

- Live source: [Part 121](airboss-ref:regs/cfr-14/121?at=2026)
- Live source: [§121.1 applicability](airboss-ref:regs/cfr-14/121/1?at=2026)
- Live source: [Part 145](airboss-ref:regs/cfr-14/145?at=2026)
- Live source: [§145.1 applicability](airboss-ref:regs/cfr-14/145/1?at=2026)
- Live source: [§145.51 certification](airboss-ref:regs/cfr-14/145/51?at=2026)
- Live source: [Part 117 -- 121 rest rules](airboss-ref:regs/cfr-14/117?at=2026)
- Companion: AC 145-9 (guide for repair-station inspection)
- Back reference: [Week 4-6 Part 91 maintenance lessons](../week-04-part-91-deep/) -- 91.405 and neighbors that drive 145 work
