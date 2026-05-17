---
title: Airworthiness and preflight -- §91.7 and §91.103
week: 4
section_order: "02"
last_verified: 2026-04-29
cites:
  knowledge_nodes:
    - flight-planning/vfr-cross-country
  acs_leaves:
    - PA.I.B.K1
    - PA.I.B.K2
    - PA.I.D.K1
  handbook_sections:
    - airboss-ref:regs/cfr-14/91/103
    - airboss-ref:regs/cfr-14/91/7
    - airboss-ref:regs/cfr-14/91/213
---

# Airworthiness and preflight

§91.7 and §91.103 are the two pre-takeoff anchors. Before the airplane moves, the PIC has determined it is airworthy (§91.7) and has familiarized themselves with all available information concerning the flight (§91.103). Both sections sound obvious. Both sections contain traps that show up in enforcement cases and on every checkride.

§91.7 is the anchor for the PIC's role in continuing airworthiness. The pilot is not the mechanic and does not certify the airplane; the FAA's airworthiness certificate does that, conditional on continuing maintenance under Part 43. But the PIC owns the determination *for this flight* that the airplane is airworthy, and that determination is non-delegable.

§91.103 is the preflight action requirement -- the broadest single planning rule in Part 91. Pilots learn it as "NWKRAFT" or "AVIATE" (mnemonics that capture only the explicit list); the actual rule is more demanding. The Walker (1991) Chief Counsel letter is the canonical interpretation of "all available information" and is on every CFI candidate's reading list.

## What you'll be able to do

- State §91.7(a) and (b) cold and explain how PIC airworthiness determination relates to Part 43 continuing maintenance
- Apply the §91.7(b) discontinuation requirement (when an airplane becomes unairworthy in flight)
- Recite the §91.103 explicit list (a) and (b) and explain why the introductory clause "all available information" is broader than the list
- Apply the Walker (1991) Chief Counsel interpretation of "all available information"
- Distinguish §91.103 from the §91.213 inoperative equipment process (a different problem, a different process)

## Why this matters

The FAA cites §91.7 and §91.103 in a substantial fraction of all preventable accident cases. After-action investigations regularly find: the airplane had an open MEL item the PIC didn't know about, the pilot launched in weather that NOTAM-restricted the destination, the pilot lacked W&B data for the actual loading, or the pilot relied on a stale weight-and-balance. Each of these is a §91.103 violation as well as an underlying safety issue. The §91.13 catch-all attaches.

§91.7 is similarly broad. A pilot who launches with a known mechanical issue not addressed under §91.213 owns an unairworthiness violation regardless of how it played out in flight. The "I'll fly it home and fix it there" instinct is exposed.

These two rules frame every flight that ever takes off. Read them slowly.

## The discovery question

You are launching from KPAO to KSBA tomorrow morning. Three friends, daytime, 172, broken layer at 8,000 feet forecast holding through your flight time. You have 130 hours. You go to your iPad, pull METARs, check the TAF for KSBA, and look at the standard preflight items.

Pause.

What does §91.103 actually require? The standard "weather, fuel, runway, NOTAMs" preflight is good airmanship. The regulation is broader. It requires "all available information" concerning the flight -- weather reports and forecasts are explicit, but so are runway lengths at airports of intended use, and so is fuel needed *for the flight*, and so is alternates if the flight cannot be completed as planned.

Now add: KSBA has a NOTAM about runway 25R closed for construction. The construction is documented in the airport diagram update on the FAA's NOTAM Search. Did you check it? The NOTAM is "available information." If you launch and the alternate runway has different lengths or weights, your performance calculation changes. If you didn't check, you're in §91.103 territory before you take off.

The Walker (1991) letter says "all available information" includes information the pilot does not have but reasonably could obtain. It does not stop at the FSS briefing. It includes airport status, NOTAMs, weather updates, forecasts, performance data for the actual aircraft, weight and balance, and any other data material to the safe completion of the flight.

This is the typical Part 91 preflight trap. Pilots rely on the explicit list ("NWKRAFT") and miss the introductory clause that makes the list non-exhaustive.

## What §91.7 actually says

```text
§91.7  Civil aircraft airworthiness.

(a) No person may operate a civil aircraft unless it is in an
    airworthy condition.

(b) The pilot in command of a civil aircraft is responsible for
    determining whether that aircraft is in condition for safe flight.
    The pilot in command shall discontinue the flight when unairworthy
    mechanical, electrical, or structural conditions occur.

Note: paraphrase. Read the actual reg before referencing in exam.
```

Two operative concepts:

1. **"In an airworthy condition."** The airplane meets its type-certificate basis (it conforms to the certificated configuration) and is in a condition for safe operation. Both halves matter. A type-certificated airplane that has been modified in a way that voids the certificate is not airworthy. A type-certificated airplane with an open mechanical defect is not airworthy until the defect is addressed under Part 43, Part 39, or §91.213.
2. **"PIC is responsible for determining."** This is the pilot's role. The pilot is not the mechanic; the IA who signed the most recent annual inspection certified the aircraft was airworthy on that date, but the §91.7(b) determination is *for this flight*. The pilot performs a preflight inspection, reviews the maintenance logs, and makes the call.

### The two halves of airworthiness

The FAA's *Order 8130.2J* and AC 43.13 documents lay out the two-element test:

- **Type-certificate conformity.** The airplane conforms to the type certificate, including all installed equipment, modifications (Supplemental Type Certificates, field approvals), and configuration documented in the Aircraft Flight Manual. Any modification not approved violates conformity.
- **Condition for safe operation.** The airplane is in a serviceable condition. No mechanical defects affecting safety, no missing required equipment, no items broken that affect safe flight.

A pilot can verify the first element by checking that maintenance records reflect approved modifications and required inspections. The pilot verifies the second element through the preflight inspection and the mechanical history (any open defects, any deferred items?).

### Required inspections (the maintenance side)

The PIC's airworthiness determination depends on knowing which inspections are required and current. The high-yield list:

- **Annual inspection** -- §91.409(a). Every 12 calendar months. Required for all aircraft except experimental and certain special-use categories.
- **100-hour inspection** -- §91.409(b). For aircraft used for hire or for flight instruction by the operator providing the aircraft. Every 100 hours time-in-service. Concurrent with the annual unless deferred (the 100-hour can be extended by 10 hours for the purpose of repositioning the aircraft to where the inspection will be performed).
- **Transponder inspection** -- §91.413. Every 24 calendar months for transponders.
- **Pitot-static inspection** -- §91.411. Every 24 calendar months for IFR ops (altimeter, altitude reporting, static system).
- **ELT** -- §91.207. Battery replacement at the half-life, ELT inspection annually.
- **VOR** -- §91.171. Every 30 days for IFR ops (we cover this in lesson 5).
- **Airworthiness Directives (AD)** -- §39. Compliance with applicable ADs is required; the IA's annual inspection includes a review of AD compliance.

Deep treatment of these inspections is in Week 5 (Part 91 subpart E -- maintenance). For Week 4, the point is: §91.7(a) requires the airplane to be airworthy, which means all required inspections are current and all applicable ADs are complied with.

### The §91.7(b) discontinuation requirement

If an airplane becomes unairworthy *in flight* -- a magneto fails, a vacuum pump quits, the alternator dies in IMC -- §91.7(b) requires the PIC to discontinue the flight. "Discontinue" does not mean "land immediately"; it means to stop operating in a manner that depends on the failed system. A pilot whose alternator fails at FL080 in VMC discontinues the IFR flight and proceeds VFR if conditions permit. A pilot whose engine has a partial power loss discontinues the cruise and lands at the nearest suitable airport.

The trap: pilots sometimes interpret §91.7(b) as authorizing continuing flight if the failure does not seem critical ("the alternator is fine, I have hours of battery"). The regulation does not authorize that judgment. If the airplane is no longer airworthy (a required system has failed), the flight discontinues. §91.3(b) emergency-deviation may apply for the diversion, but the obligation to discontinue is in §91.7(b).

### §91.7 and §91.213 (inoperative equipment, MEL)

§91.213 is the procedure for operating an aircraft with inoperative equipment without violating §91.7. The two paths:

- **MEL operation.** If the aircraft has an MEL (Minimum Equipment List), inoperative items are deferred per the MEL conditions and the airplane remains airworthy.
- **No-MEL operation.** Most GA aircraft have no MEL. Under §91.213(d), a pilot can operate with inoperative equipment if the equipment is *not* required by:
  1. Type certificate
  2. AD
  3. §91.205 (VFR/IFR equipment list)
  4. Operating rules (e.g., §91.207 ELT, §91.215 transponder)

  AND the inoperative item is removed from service or deactivated and labeled "inoperative," AND the pilot determines the airplane is safe for flight.

§91.213 is its own deep dive (Week 5). For Week 4, the point is: if an inoperative item is properly handled under §91.213, the airplane is still airworthy under §91.7. If it isn't, the airplane isn't.

## What §91.103 actually says

```text
§91.103  Preflight action.

Each pilot in command shall, before beginning a flight, become familiar
with all available information concerning that flight. This information
must include --

  (a) For a flight under IFR or a flight not in the vicinity of an
      airport, weather reports and forecasts, fuel requirements,
      alternatives available if the planned flight cannot be
      completed, and any known traffic delays of which the pilot in
      command has been advised by ATC;

  (b) For any flight, runway lengths at airports of intended use, and
      the following takeoff and landing distance information --

      (1) For civil aircraft for which an approved Airplane or
          Rotorcraft Flight Manual containing takeoff and landing
          distance data is required, the takeoff and landing distance
          data contained therein; and

      (2) For civil aircraft other than those specified in paragraph
          (b)(1) of this section, other reliable information appropriate
          to the aircraft, relating to aircraft performance under
          expected values of airport elevation and runway slope, aircraft
          gross weight, and wind and temperature.

Note: paraphrase. Read the actual reg before referencing in exam.
```

Three things to extract:

1. **"All available information."** The introductory clause. The list in (a) and (b) is not exhaustive; it is illustrative. The pilot must seek out *all* information concerning the flight that is reasonably available. The Walker (1991) letter expanded this to mean: information the pilot can obtain through reasonable effort, including NOTAMs, weather updates, performance data, weight and balance.
2. **(a) -- IFR or non-local flights.** Weather reports and forecasts, fuel, alternates, traffic delays. The IFR fuel requirements live in §91.167 (lesson 5); the alternate requirements live in §91.169.
3. **(b) -- any flight.** Runway lengths at airports of intended use, and the takeoff/landing distance computations for the actual airplane in the actual conditions. The "(b)(1)" path applies when the airplane has an AFM with performance charts; the "(b)(2)" path applies to airplanes without an AFM (very few modern airplanes; mostly homebuilts and antiques).

### NWKRAFT (or AVIATE) -- the mnemonic and what it misses

CFIs commonly teach the mnemonic NWKRAFT or AVIATE for §91.103:

- **N** otams
- **W** eather
- **K** nown ATC delays
- **R** unway lengths at airports of intended use
- **A** lternates
- **F** uel requirements
- **T** akeoff and landing performance / distance

Or AVIATE:

- **A** lternates
- **V** isibility / weather
- **I** information (NOTAMs, traffic)
- **A** irspace
- **T** akeoff and landing distance
- **E** missions (aka fuel)

The mnemonics are useful pedagogy but capture only the explicit list. The introductory clause makes them under-inclusive. The Walker letter says: anything else *material to the safe completion of the flight* counts as "available information." Examples that do not appear in the mnemonics:

- Weight and balance for the actual loading
- Aircraft systems status (open squawks, deferred items, MEL status)
- TFRs (Temporary Flight Restrictions)
- SAA (Special Activity Airspace) / SUA (Special Use Airspace) status
- Runway slope and surface condition
- Density altitude calculations
- Personal minimums and risk-management consideration
- Currency of the pilot for the operation (passenger, night, IFR)

A pilot who completed NWKRAFT and skipped weight and balance has not satisfied §91.103. The mnemonic is a starting point, not a finish line.

### The Walker (1991) Chief Counsel letter

*Letter to Mr. Walker* (FAA Office of Chief Counsel, 1991) is the canonical interpretation of "all available information." The letter responded to a question about whether a pilot was required to check NOTAMs.

The Chief Counsel's read:

- The §91.103 phrase "all available information" is broad and includes NOTAMs.
- A pilot is required to obtain information that is *reasonably available*, even if not explicitly listed in (a) or (b).
- A pilot who fails to check available NOTAMs and operates into a NOTAM-affected area has violated §91.103.
- The standard is what a reasonably prudent pilot would obtain, not what was technically possible.

The Walker letter is on every CFI's bookshelf because it is the FAA's clearest statement that §91.103 is broader than the explicit list. After Walker, FSDOs cite §91.103 against pilots who fly into a NOTAM-restricted area, who exceed runway capability without checking, who fly into TFRs that were published, etc. The defense "the regulation only requires the explicit list" does not work post-Walker.

### What "all available information" looks like in practice

A defensible §91.103 preflight, for a typical VFR cross-country in a 172:

1. **Weather** -- METAR for departure, destination, alternates. Area Forecast (AFD), Terminal Aerodrome Forecasts (TAFs) for any airport within an hour of arrival. AIRMETs and SIGMETs. Pilot reports along the route. Surface analysis, prog charts, radar.
2. **NOTAMs** -- via FAA NOTAM Search or 1-800-WX-BRIEF. NOTAMs for departure airport, destination, en-route VORs, and any alternate.
3. **TFRs and SUA** -- check for any TFRs (presidential, sporting events, fires, etc.) along the route. Check SUA / Restricted area / MOA status.
4. **Fuel planning** -- fuel required + reserves (§91.151 for VFR, §91.167 for IFR) + contingency fuel.
5. **Weight and balance** -- compute for actual loading; CG within envelope; gross weight not exceeded.
6. **Performance** -- takeoff and landing distance for actual conditions (density altitude, weight, wind). Climb performance. Cruise fuel burn at planned altitude.
7. **Runway data** -- runway length, surface, slope, condition. Crosswind component vs. demonstrated crosswind for the airplane.
8. **Alternates** -- for VFR, where you'd go if weather deteriorates. For IFR, the §91.169 alternate analysis.
9. **Traffic delays** -- known ATC delays; flight plan filing if going through busy airspace.
10. **Aircraft status** -- maintenance current, no open squawks, all required equipment operational or properly addressed under §91.213.
11. **Pilot status** -- currency, recency, proficiency, fitness for duty (§61.53).

Each of these is "available information." A pilot who checked weather and skipped W&B has not done a §91.103-compliant preflight. The agency's reading is consistent.

### §91.9 -- the AFM, marking, and placard requirement

Adjacent to §91.103: §91.9 requires that the airplane's AFM, markings, and placards be available and complied with. A pilot who operates outside AFM limits is in §91.9 violation; a pilot who operates an airplane without the required AFM aboard is also in violation. The PIC's preflight under §91.103 includes verifying the AFM is present and current, and the operating limitations in the AFM are honored.

## Where §91.7 and §91.103 sit

§91.7 is in subpart A (General). §91.103 opens subpart B (Flight Rules - General).

```text
Subpart B -- Flight Rules - General

§91.101  Applicability
§91.103  Preflight action
§91.105  Flight crewmembers at stations
§91.107  Use of safety belts, shoulder harnesses, and child restraint systems
§91.109  Flight instruction; simulated instrument flight and certain flight tests
§91.111  Operating near other aircraft
§91.113  Right-of-way rules: Except water operations
§91.115  Right-of-way rules: Water operations
§91.117  Aircraft speed
§91.119  Minimum safe altitudes: General
§91.121  Altimeter settings
§91.123  Compliance with ATC clearances and instructions
...
§91.151  Fuel requirements for flight in VFR conditions
§91.155  Basic VFR weather minimums
§91.157  Special VFR weather minimums
§91.159  VFR cruising altitude or flight level
...
§91.167  Fuel requirements for flight in IFR conditions
§91.169  IFR flight plan: Information required
§91.171  VOR equipment check for IFR operations
§91.175  Takeoff and landing under IFR
...
§91.211  Supplemental oxygen
§91.213  Inoperative instruments and equipment
§91.215  ATC transponder and altitude reporting equipment and use
```

§91.103 is the first rule of subpart B for a reason: it is what you do *before* the flight. Everything else in subpart B applies during the flight. The structural pattern is "preflight, then occupants, then traffic and altitudes, then VFR, then IFR, then equipment."

## Common misreadings

- **"§91.103 only requires what's explicitly listed."** Wrong. The introductory clause "all available information" is the operative phrase. Walker (1991) confirms the list is not exhaustive.
- **"NOTAMs aren't in §91.103, so I don't have to check them."** Wrong. NOTAMs are "available information." The Walker letter specifically addresses this. Failing to check available NOTAMs and flying into a NOTAM-restricted area violates §91.103.
- **"Weight and balance isn't required by §91.103."** Wrong. W&B is "information appropriate to the aircraft, relating to aircraft performance" under §91.103(b)(2), and is universally treated as required. A flight that exceeds gross weight or CG is a §91.9 (AFM limits) violation as well.
- **"§91.7 means the IA owns airworthiness."** Wrong. The IA's annual inspection certifies airworthiness on the date of inspection. §91.7(b) puts the determination *for this flight* on the PIC. Both are required; both are checked.
- **"If something fails in flight, I'm protected by §91.3(b) emergency authority."** Partial. §91.3(b) authorizes deviation from rules to meet the emergency. §91.7(b) requires you to discontinue the flight when an unairworthy condition develops. The PIC discontinues (lands at nearest suitable, diverts, etc.) and is protected by §91.3(b) for the deviations that get them there safely.
- **"§91.103 is satisfied by the FSS briefing."** Wrong. The FSS briefing is one source of information. NOTAMs, TFRs, SUA status, weight and balance, performance computations, and runway data are not part of a typical FSS briefing. The pilot is responsible for the broader set.
- **"My iPad app pulled the standard preflight, so I'm covered."** Wrong unless the app pulled what was needed. ForeFlight, Garmin Pilot, etc., are good tools but they do not replace the pilot's responsibility to know what information is material to the flight. A pilot who flew into a TFR because their app didn't display it is still in §91.103 violation.
- **"§91.103 doesn't apply if it's a quick local flight."** Wrong. §91.103(a) applies to IFR flights and non-local flights specifically; §91.103(b) (runway lengths and performance) applies to *any* flight, including local flights. A local flight in marginal conditions still requires preflight action.
- **"§91.7(a) means the airplane has to be perfect."** Wrong. The airplane has to be airworthy, which can include legally-deferred items under §91.213 or the MEL. Perfect is the goal; airworthy is the regulation.

## Related sections

- [@cite](airboss-ref:regs/cfr-14/91/7?at=2026) -- airworthiness
- [@cite](airboss-ref:regs/cfr-14/91/9?at=2026) -- AFM, markings, placards
- [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) -- preflight action
- [@cite](airboss-ref:regs/cfr-14/91/151?at=2026) -- VFR fuel reserves (lesson 4)
- [@cite](airboss-ref:regs/cfr-14/91/167?at=2026) -- IFR fuel reserves (lesson 5)
- [@cite](airboss-ref:regs/cfr-14/91/169?at=2026) -- IFR alternates (lesson 5)
- [@cite](airboss-ref:regs/cfr-14/91/213?at=2026) -- inoperative instruments and equipment
- [@cite](airboss-ref:regs/cfr-14/91/409?at=2026) -- annual and 100-hour inspections (Week 5)
- AIM 5-1 -- preflight planning
- AC 91-92 -- pilot's guide to a preflight briefing
- Walker (1991) Chief Counsel letter -- "all available information"

## Drills

### Locate the section

| Question                                                  | Section                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Where is the airworthiness operating prohibition?         | [@cite](airboss-ref:regs/cfr-14/91/7?at=2026) (a)                                                |
| Where is the PIC airworthiness-determination requirement? | [@cite](airboss-ref:regs/cfr-14/91/7?at=2026) (b)                                                |
| Where is the in-flight discontinuation requirement?       | [@cite](airboss-ref:regs/cfr-14/91/7?at=2026) (b)                                                |
| Where is the AFM-and-placard requirement?                 | [@cite](airboss-ref:regs/cfr-14/91/9?at=2026)                                                    |
| Where is the preflight action requirement?                | [@cite](airboss-ref:regs/cfr-14/91/103?at=2026)                                                  |
| Where is "all available information"?                     | [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) intro                                            |
| Where are the runway-length and performance requirements? | [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) (b)                                              |
| Where is the canonical NOTAM interpretation?              | Walker (1991) Chief Counsel letter                                                               |
| Where is the inoperative-equipment process?               | [@cite](airboss-ref:regs/cfr-14/91/213?at=2026)                                                  |
| Where do annual and 100-hour inspections live?            | [@cite](airboss-ref:regs/cfr-14/91/409?at=2026)                                                  |
| Where do transponder and pitot-static inspections live?   | [@cite](airboss-ref:regs/cfr-14/91/411?at=2026), [@cite](airboss-ref:regs/cfr-14/91/413?at=2026) |
| Where do ADs live (the regulation, not specific ADs)?     | Part 39                                                                                          |

### Apply the rules

> A pilot is launching a 172 on a local VFR flight. They check the weather (METAR), check fuel (full tanks), and start up. Have they satisfied §91.103?

Answer: No. §91.103(b) applies to any flight and requires runway lengths at airports of intended use plus performance information. The pilot has not addressed runway, weight and balance, alternates, NOTAMs, or aircraft systems status. A "local" flight does not exempt §91.103.

> A pilot pre-flighted, started, taxied, and during runup discovered the right magneto drops 200 RPM (limit 150). They taxi back, talk to a mechanic who says "fly it home and we'll fix it tomorrow, the magneto isn't going to quit before then." The pilot flies home VFR. Charges?

Answer: §91.7(a) -- operating an aircraft that is not in an airworthy condition. The magneto drop exceeds AFM limits, which is a §91.9 violation and a §91.7 violation. Possibly §91.13(a) careless. The mechanic's verbal assurance is not a deferral under §91.213 -- §91.213 requires written documentation and proper procedures. The pilot owns §91.7 regardless of the mechanic's advice.

> A pilot files IFR from KPAO to KSBA, gets a clearance, takes off. En route, the alternator fails. They are in VMC at 8,000 feet. Do they have to land immediately?

Answer: No, but they must discontinue the flight under §91.7(b). The alternator is a required system for IFR (§91.205(d)(7) -- electrical generator); flight on battery is finite. The pilot discontinues IFR (cancels the IFR flight plan, proceeds VFR if conditions permit), advises ATC, and lands at the nearest suitable airport that meets their needs. §91.3(b) covers any deviations needed to get there safely. "Discontinue" does not mean "land immediately" but does mean "stop operating in a way that depends on the failed system."

> A pilot does the standard NWKRAFT preflight, but doesn't compute weight and balance because the airplane is well within typical loading. They take off in a 172 with three friends and full tanks. The airplane is 50 lb over gross. Charges?

Answer: §91.9 (operating outside AFM limits -- gross weight) and §91.103 (failure to obtain "all available information" appropriate to the aircraft -- specifically W&B). Possibly §91.13(a) careless if the over-gross condition contributed to a safety issue (poor climb, unable to clear obstacles, etc.). The pilot's reliance on the mnemonic without computing W&B is the classic §91.103 trap.

> A pilot flies into a TFR they did not check, around an outdoor concert. They were not notified by ATC and cite that as defense. Charges?

Answer: §91.103 -- failure to obtain "all available information." The TFR was published. ATC did not notify the pilot, but the pilot was responsible for checking. Walker (1991) is on point: the regulation requires the pilot to obtain information that is reasonably available, including TFRs. ATC notification is a courtesy, not a substitute for the pilot's responsibility. Likely also §91.137 (TFR violation) and §91.13(a).

> A pilot does a complete preflight, but the airplane has an open squawk in the maintenance log: "intercom intermittent, deferred." The pilot doesn't read the maintenance log and flies. The intercom works fine for the flight. Any §91.103 issue?

Answer: §91.103 issue is borderline. The pilot's W&B, performance, weather, and runway data are all in order. The intercom is not required equipment under §91.205, so the deferred-squawk path under §91.213(d) likely covers it (assuming the squawk was properly placarded "INOP" and removed from service). The pilot should have checked the maintenance log as part of "all available information" but the omission is unlikely to result in a §91.103 charge if no operational consequence followed. The bigger issue would be if the open squawk had been a required item -- then §91.7 attaches.

> A pilot in a 172 launches from KPAO with an MEL. (172s typically don't have MELs. Assume hypothetically.) The MEL has a deferred item for the airspeed indicator. The pilot didn't read the MEL deferral conditions, which require operation under VFR only. The pilot files IFR and takes off. Charges?

Answer: §91.7 -- operating outside MEL conditions makes the airplane unairworthy. §91.103 -- failure to obtain available information about the airplane's operational status. §91.213 -- failure to comply with MEL conditions. Probably §91.13(a). The MEL deferral is conditional; ignoring the conditions voids the deferral.

> A CFI student is flying a solo cross-country and notices halfway that the heading indicator has precessed badly. It's not a required item under §91.205 for VFR day. They continue the flight using the magnetic compass. Any issue?

Answer: No §91.7 issue if the heading indicator is not required. §91.205(b) lists required VFR day instruments; gyroscopic heading indicator is not among them (it's required for IFR under §91.205(d)). The pilot's decision to continue using the wet compass is acceptable airmanship and does not constitute "discontinuing" under §91.7(b) since the airplane remains airworthy without the failed item. Logging the squawk and addressing it post-flight is the right discipline.

## Where this lesson sits

This is lesson 2 of week 4. We covered §91.7 (airworthiness, PIC determination, in-flight discontinuation), §91.9 (AFM and placards), and §91.103 (preflight action and the Walker letter on "all available information").

- Previous: [01-pic-authority-and-careless-reckless.md](01-pic-authority-and-careless-reckless.md) -- §91.3 and §91.13
- Next: [03-occupant-rules-and-right-of-way.md](03-occupant-rules-and-right-of-way.md) -- §91.105 / §91.107 seatbelts, §91.111-§91.115 right-of-way, §91.119 minimum altitudes

## Related

- Live source: [Part 91](airboss-ref:regs/cfr-14/91?at=2026)
- Live source: [airworthiness](airboss-ref:regs/cfr-14/91/7?at=2026)
- Live source: [AFM and placards](airboss-ref:regs/cfr-14/91/9?at=2026)
- Live source: [preflight action](airboss-ref:regs/cfr-14/91/103?at=2026)
- Live source: [inoperative equipment](airboss-ref:regs/cfr-14/91/213?at=2026)
- Companion: AIM 5-1 (preflight planning)
- Companion: AC 91-92 (preflight briefing)
- Chief Counsel: Walker (1991) -- "all available information"
- Forward reference: Week 5 -- §91.213 deep dive, §91.205 equipment, §91.409 inspections, ADs
