---
title: Altimeter, transponder, and records -- 91.411 + 91.413 + 91.417 + 91.419
week: 5
section_order: "05"
covers_regulations:
  - 91.411
  - 91.413
  - 91.417
  - 91.419
ties_to_knowledge_nodes:
  - reg-altimeter-transponder-checks-91-411-91-413
  - reg-maintenance-records-91-417
last_verified: 2026-04-29
---

# Altimeter, transponder, and records

Four sections that together close out subpart E and complete the equipment-and-maintenance picture:

- **91.411** -- altimeter and static system check (24 calendar months, IFR only)
- **91.413** -- transponder check (24 calendar months, all operations)
- **91.417** -- maintenance records (what gets logged, what stays where, retention periods)
- **91.419** -- transfer of records on aircraft sale

The 411/413 distinction is the trap students fail. Both are 24-calendar-month checks; both involve avionics; both apply to broadly similar populations of airplanes. They are *different* in scope, applicability, and operational consequence. Mixing them up loses points and, worse, leaves a pilot in violation when the 411 has expired but the 413 is current.

The records sections (417, 419) are dry but operationally critical. A pilot who buys an airplane and discovers two months later that the prior owner withheld required records has a problem -- 91.419 is the rule that should have prevented it.

## What you'll be able to do

- Distinguish 91.411 from 91.413 cold: applicability, scope, operational consequence
- Apply both 24-calendar-month timers to a specific airplane and operation
- List the records that "stay in the airplane" (under 91.417) versus the records that "stay in the maintenance logs"
- Recall the 91.417 retention periods (perpetual vs. 1-year-after-work)
- Apply 91.419 to an aircraft purchase / sale: what the seller must transfer, what the buyer should verify

## Why this matters

The 411 / 413 / 417 trio is checkride bait. Examiners ask "walk me through every inspection currency check on this airplane for an IFR flight tomorrow" and they're explicitly looking for the 411 / 413 in addition to the 409 inspections. A candidate who names only the annual is failing the question.

For the working pilot, these checks are the gatekeepers for the IFR-capable airplane. An owner whose 411 lapsed cannot legally fly IFR -- only VFR -- until the next altimeter and static system test is completed, even if everything else on the airplane is current. The math is simple, but the consequence is operationally significant.

The records sections are dry but they are how the *system* enforces airworthiness. Without 91.417, an owner could repeatedly defer the same item, fail to record discrepancies, or operate an airplane that doesn't actually have a current annual. The records discipline is what makes the rest of the maintenance system enforceable.

## The discovery question

You are a CFI helping a pilot prepare for an IFR cross-country tomorrow morning. The pilot is planning IFR all the way -- climb on a clearance, cruise in IMC, ILS approach to KSBA. The airplane is a Cirrus SR22 with a current annual (signed 4 months ago) and 60 hours of time-in-service since.

Before you sign the pilot's logbook tonight (you're providing flight following on the ground for them and it's a long story), you flip through the airframe records. Walk through every inspection currency check that affects whether this airplane can legally fly the planned IFR mission.

Pause.

The complete IFR currency check for the airplane:

1. **Annual (91.409(a))** -- 12 calendar months. Signed 4 months ago; current.
2. **100-hour (91.409(b))** -- only if the airplane is for-hire or used for instruction-for-hire by the owner-instructor; for a personal Cirrus, not applicable.
3. **Altimeter and static system (91.411)** -- 24 calendar months for IFR. Required for IFR. Need to check the date of the last 411 inspection.
4. **Transponder (91.413)** -- 24 calendar months, **all operations** (not just IFR). Required regardless of operation. Need to check the date of the last 413 inspection.
5. **ELT (91.207(d))** -- 12 calendar months inspection (independent of battery rule).
6. **Pitot-static system airframe inspection components covered by 91.411** -- the 411 covers the altimeter, the encoding altimeter (for transponder altitude reporting), and the static system. The transponder's "Mode C correspondence" check is part of 91.411 by reference.
7. **Any AD compliance per 91.403.**

The 411 and 413 are the two that frequently lapse without anyone noticing because they are 24-month timers, easy to forget, and run independently of the annual. A common scenario: an annual was signed 4 months ago by a shop that didn't do the 411 and 413 (which is normal -- the avionics shop typically does those, separate from the airframe shop). The owner has been flying the airplane VFR and the lapsed 411 hasn't mattered. When the pilot flies an IFR cross-country tomorrow, a lapsed 411 is a 91.411 violation.

This is the question every CFI signing off on an IFR cross-country needs to answer correctly.

## What 91.411 actually says

```text
§91.411  Altimeter system and altitude reporting equipment tests
and inspections.

(a) No person may operate an airplane, or helicopter, in controlled
    airspace under IFR unless --

  (1) Within the preceding 24 calendar months, each static
      pressure system, each altimeter instrument, and each
      automatic pressure altitude reporting system has been tested
      and inspected and found to comply with appendices E and F
      of part 43 of this chapter;

  (2) Except for the use of system drain and alternate static
      pressure valves, following any opening and closing of the
      static pressure system, that system has been tested and
      inspected and found to comply with paragraph (a), appendix E,
      of part 43 of this chapter; and

  (3) Following installation or maintenance on the automatic
      pressure altitude reporting system of the ATC transponder
      where data correspondence error could be introduced, the
      integrated system has been tested, inspected, and found to
      comply with paragraph (c), appendix E, of part 43 of this
      chapter.

(b) The tests required by paragraph (a) of this section must be
    conducted by --

  (1) The manufacturer of the airplane, or helicopter, on which the
      tests and inspections are to be performed;
  (2) A certificated repair station properly equipped to perform
      those functions and holding --
    (i) An instrument rating, Class I;
    (ii) A limited instrument rating appropriate to the make and
         model of appliance to be tested;
    (iii) A limited rating appropriate to the test to be performed;
    (iv) An airframe rating appropriate to the airplane, or
         helicopter, to be tested; or
  (3) A certificated mechanic with an airframe rating (static
      pressure system tests and inspections only).

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural insight:

```text
91.411 applies when:
  - Operating IN CONTROLLED AIRSPACE
  - Under IFR

Required:
  - Static pressure system test (24 calendar months)
  - Altimeter instrument test (24 calendar months)
  - Automatic pressure altitude reporting system test (24 calendar
    months) -- the encoder feeding the transponder

Plus:
  - Re-test after opening/closing the static system
  - Re-test after installation/maintenance on the encoder

Who can sign:
  - The manufacturer (rare in field)
  - A certificated repair station with the right ratings
  - For static pressure tests only: a certificated mechanic with an
    airframe rating
```

The applicability is *narrow*: 91.411 applies to **IFR operations in controlled airspace**. A pilot operating VFR (even in IMC equivalent on top, even at 17,000 ft on flight following) does not trigger 91.411. The trigger is IFR, in controlled airspace.

The 24-calendar-month interval is calendar-based, not time-in-service. Same math as the flight review and the IPC: an airplane with a 411 inspection completed in October 2024 is good through October 31, 2026.

The "controlled airspace" qualifier is interesting in practice but rarely operationally meaningful. Almost all IFR operations are conducted in controlled airspace; the rule applies to nearly every IFR flight. The qualifier exists for the rare uncontrolled-airspace IFR cases (a few specific oceanic and Alaskan operations).

### Three things in one inspection

The 91.411 inspection is one event covering three components:

1. **Static pressure system.** The plumbing from the static port to all instruments. Leak checks, pitot heat operation, drain valve operation.
2. **Altimeter.** Tests at multiple altitudes against a calibrated reference, scale error, friction, hysteresis.
3. **Automatic pressure altitude reporting system (encoder).** The component that feeds altitude to the transponder for Mode C reply. Calibration to the altimeter, the "Mode C correspondence" within 125 ft per 14 CFR Part 43 Appendix E.

The encoder is the bridge between 91.411 and 91.413: the encoder is part of the altitude reporting that 91.215(b) requires for Mode C, and 91.411 is what verifies the encoder reports correctly.

## What 91.413 actually says

```text
§91.413  ATC transponder tests and inspections.

(a) No persons may use an ATC transponder that is specified in
    §91.215(a), §121.345(c), or §135.143(c) of this chapter unless,
    within the preceding 24 calendar months, the ATC transponder
    has been tested and inspected and found to comply with
    appendix F of part 43 of this chapter; and

(b) Following any installation or maintenance on an ATC transponder
    where data correspondence error could be introduced, the
    integrated system has been tested, inspected, and found to
    comply with paragraph (c), appendix E, of part 43 of this
    chapter.

(c) The tests and inspections specified in this section must be
    conducted by --

  (1) A certificated repair station properly equipped to perform
      those functions and holding --
    (i) A radio rating, Class III;
    (ii) A limited radio rating appropriate to the make and model
         transponder to be tested;
    (iii) A limited rating appropriate to the test to be performed;
    (iv) A limited rating for a manufacturer issued for the
         transponder in question; ...

  (2) A holder of a continuous airworthiness maintenance program ...

  (3) The manufacturer of the aircraft on which the transponder to
      be tested is installed, if the transponder was installed by
      that manufacturer.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural insight:

```text
91.413 applies when:
  - The aircraft has an ATC transponder installed
  - Operating ANY OPERATION (VFR, IFR, controlled or uncontrolled)

Required:
  - Transponder test (24 calendar months)

Plus:
  - Re-test after installation/maintenance where data correspondence
    error could be introduced

Who can sign:
  - A certificated repair station with the right ratings
  - The manufacturer
  - Specific operators with continuous airworthiness programs
```

### The 411 vs. 413 distinction

| Feature                        | 91.411 (altimeter / static / encoder) | 91.413 (transponder) |
| ------------------------------ | ------------------------------------- | -------------------- |
| Applicability                  | IFR in controlled airspace             | All operations with installed transponder |
| Interval                       | 24 calendar months                     | 24 calendar months   |
| Components covered             | Static system, altimeter, encoder      | Transponder unit only |
| Who can sign                   | Repair station with appropriate rating; airframe-rated mechanic for static-only | Repair station with radio rating |
| Operational consequence if expired | Cannot fly IFR; can fly VFR        | Cannot operate the transponder; airplane may not be operated in 91.215(b) airspace |

The two checks are normally done together at the avionics shop, but they are independent regulatory requirements. A pilot who is told "your 411 is expired" should also check the 413 -- they may both be due, or only one might.

The post-installation re-test in 91.411(a)(3) and 91.413(b) is the data-correspondence check. When work is done that could introduce an altitude reporting error, the re-test verifies the altimeter and the transponder report the same altitude (within 125 ft per Part 43 Appendix E).

### Operational consequence of 91.413 expiration

If 91.413 has expired and the airplane has a transponder, the pilot cannot operate the transponder under 91.413(a). Per 91.215(c), if a transponder is installed and operable, the pilot must operate it. So an installed transponder with an expired 413 puts the pilot in a bind: 91.413 prohibits operation; 91.215(c) requires operation if installed and operable.

The resolution: an expired 413 makes the transponder *not approved for use* (a regulatory issue, not a hardware issue). The transponder is no longer "operable" in the regulatory sense. The pilot can request an ATC deviation under 91.215(d) or fly the airplane only in airspace that doesn't require Mode C. The deviation pathway is the most common operational answer.

## What 91.417 actually says

```text
§91.417  Maintenance records.

(a) Except for work performed in accordance with §§91.411 and 91.413,
    each registered owner or operator shall keep the following
    records for the periods specified in paragraph (b) of this
    section:

  (1) Records of the maintenance, preventive maintenance, and
      alteration and records of the 100-hour, annual, progressive,
      and other required or approved inspections, as appropriate,
      for each aircraft (including the airframe) and each engine,
      propeller, rotor, and appliance of an aircraft. The records
      must include --

    (i) A description (or reference to data acceptable to the
        Administrator) of the work performed;
    (ii) The date of completion of the work performed; and
    (iii) The signature, and certificate number, of the person
          approving the aircraft for return to service.

  (2) Records containing the following information:
    (i) The total time in service of the airframe, each engine,
        each propeller, and each rotor.
    (ii) The current status of life-limited parts of each
         airframe, engine, propeller, rotor, and appliance.
    (iii) The time since last overhaul of all items installed on
          the aircraft which are required to be overhauled on a
          specified time basis.
    (iv) The current inspection status of the aircraft, including
         the time since the last inspection required by the
         inspection program under which the aircraft and its
         appliances are maintained.
    (v) The current status of applicable airworthiness directives
        (AD) ...
    (vi) Copies of the forms prescribed by §43.9(d) of this chapter
         for each major alteration to the airframe and currently
         installed engines, rotors, propellers, and appliances.

(b) The owner or operator shall retain the following records for
    the periods prescribed:

  (1) The records specified in paragraph (a)(1) of this section
      shall be retained until the work is repeated or superseded
      by other work or for 1 year after the work is performed.

  (2) The records specified in paragraph (a)(2) of this section
      shall be retained and transferred with the aircraft at the
      time the aircraft is sold.

  (3) A list of defects furnished to a registered owner or operator
      under §43.11 of this chapter shall be retained until the
      defects are repaired and the aircraft is approved for return
      to service.

(c) The owner or operator shall make all maintenance records
    required to be kept by this section available for inspection
    by the Administrator or any authorized representative of the
    National Transportation Safety Board (NTSB). ...

(d) ... (special rules for fuel system corrosion etc.)

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural insight that organizes this entire section:

```text
Records 91.417 cares about, by retention period:

  RETAINED UNTIL WORK IS SUPERSEDED, OR 1 YEAR AFTER PERFORMED:
    Routine maintenance entries, 100-hour entries, annual entries,
    repair entries.
    Why short retention: the entry is a record of a specific
    maintenance event that is operationally meaningful only until
    the next equivalent event supersedes it.

  RETAINED PERPETUALLY (transferred with the aircraft on sale):
    Total time in service of airframe, each engine, prop, rotor.
    Status of life-limited parts.
    Time since overhaul on time-based-overhaul items.
    Current inspection status.
    Current AD status.
    Major alteration forms (FAA Form 337).
    Why permanent: these track the aircraft's lifetime history;
    they cannot be reconstructed from current inspections.
```

### What stays in the airplane vs. the maintenance logs

This is the operational distinction students miss. Let's draw it cleanly:

```text
"In the aircraft" (per 91.203 and 91.9):
  - Airworthiness certificate
  - Registration certificate
  - Operating limitations (POH/AFM and placards)
  - Weight and balance current

"In the maintenance logs" (per 91.417):
  - Airframe logbook (annual entries, AD compliance, inspections)
  - Engine logbook
  - Propeller logbook
  - Each appliance with its own log (autopilot, transponder, etc.)
  - 411 and 413 records
  - Form 337s for major alterations
```

The logbooks travel with the airplane on sale (under 91.419) but they are *not* required to be in the airplane during operation. A pilot showing up at a ramp check is not in 91.417 violation if the airframe logbook isn't aboard. The airworthiness and registration certificates *must* be aboard (per 91.203).

A best practice: keep a "logbook copy" or a digital record (photos, FAA Forms) onboard for ramp-check defense. Most flight schools and rental fleets do this.

### The 91.411 / 91.413 records exception

91.417(a) opens with "Except for work performed in accordance with §§91.411 and 91.413..." -- meaning the 411 and 413 records have their own retention rules. Those records are typically retained as a separate cycle (the avionics shop logs them and provides the owner with a current summary; the records travel with the airplane on sale).

In practice, the 411 and 413 entries appear in the airframe maintenance log alongside the annual entries, even though they're technically separate records. Most owners maintain a single airframe logbook that includes everything for traceability.

### AD records -- 91.417(a)(2)(v)

The AD compliance record is the single most-audited maintenance record. The FAA's AD database is the authoritative source for "what ADs apply to this airframe / engine / prop." The owner's records must show compliance with each AD that applies.

A typical AD entry shows: AD number, applicability statement, date of compliance, method of compliance (one-time / repetitive / etc.), next due date or hours, signature.

When buying an airplane, the AD review is the single most important records check. Missing AD compliance can be a six-figure problem. A buyer or pre-purchase mechanic walks through the FAA AD database, cross-references each AD against the airframe/engine/prop, and verifies the records show compliance.

### Major alterations and FAA Form 337

A "major alteration" under 14 CFR Part 43 Appendix A (different list from preventive maintenance) requires a Form 337 -- the FAA's official document recording the alteration. Major alterations include:

- Installing a new engine model (not just an overhaul)
- Replacing an autopilot
- Installing a new avionics suite
- Structural modifications (extended-range fuel tanks, etc.)

The Form 337 is filed with the FAA and a copy is kept in the maintenance records *permanently*. A buyer should see a Form 337 for every major alteration ever performed on the airplane.

## What 91.419 actually says

```text
§91.419  Transfer of maintenance records.

Any owner or operator who sells a U.S.-registered aircraft shall
transfer to the purchaser, at the time of sale, the following
records of that aircraft, in plain language form or in coded form
at the election of the purchaser, if the coded form provides for
the preservation and retrieval of information in a manner
acceptable to the Administrator:

(a) The records specified in §91.417(a)(2).

(b) The records specified in §91.417(a)(1) which are not
    superseded by records produced or contained in the records
    described in paragraph (a) of this section.

Note: paraphrase. Read the actual reg before referencing in exam.
```

Short and operational:

```text
On sale of a U.S.-registered aircraft, the seller transfers to
the buyer:

  - All 91.417(a)(2) records (the perpetual records: total time,
    AD status, inspection status, life-limited parts, Form 337s,
    etc.)
  - All 91.417(a)(1) records not superseded (the non-superseded
    routine maintenance entries from the past)
```

In practice, the seller transfers all logbooks, all 337s, all AD compliance records, and any specific records pertaining to the airplane. The phrase "in plain language form or in coded form" is a holdover from the pre-digital era; today this means the buyer can ask for paper copies if they prefer.

The buyer's responsibility: verify that the records are complete and consistent before closing. If a logbook page is missing, if an AD compliance entry can't be located, the buyer should hold up the sale until clarified. Once the sale closes, the buyer is responsible for the airplane's records and any gaps that emerge later.

A common pre-purchase practice: an A&P/IA does a "records inspection" alongside the physical pre-purchase inspection. The records review can take half a day on a 30-year-old airplane and is worth every dollar.

## Common misreadings

- **"91.411 applies whenever I'm flying IFR."** Half-true. 91.411 applies to IFR operations *in controlled airspace*. In the rare uncontrolled-airspace IFR case, 91.411 does not technically apply. Operationally, almost all IFR is in controlled airspace, so the rule applies to nearly every IFR flight.
- **"91.411 is annual."** Wrong. 91.411 is 24 calendar months.
- **"91.413 only applies to IFR."** Wrong. 91.413 applies to any operation with an installed transponder. VFR pilots whose 413 has lapsed cannot operate the transponder, which means they cannot fly in 91.215(b) airspace (Class A/B/C, Mode C veil, etc.) without an ATC deviation.
- **"The annual covers the 411 and 413."** Wrong. The annual is a 91.409(a) inspection of the airplane's airworthiness against the type design. The 411 and 413 are *separate* avionics inspections covering specific components. The annual signoff does not refresh the 411 or 413.
- **"The maintenance logbooks have to be in the airplane."** Wrong. 91.417 records are kept "by the owner or operator" -- they don't have to travel with the airplane. The airworthiness and registration certificates must be aboard (per 91.203). The logbooks can be in the hangar, in the office, or digital. Best practice is to have a copy or summary onboard for ramp-check defense.
- **"All maintenance records must be kept forever."** Wrong. 91.417(b)(1) is the 1-year retention for routine maintenance entries. 91.417(b)(2) is the perpetual retention for the lifetime records (total time, ADs, life-limited parts, etc.).
- **"On sale, the seller can keep the maintenance records as a souvenir."** Wrong. 91.419 requires transfer of the records to the buyer at the time of sale. The seller has no right to retain them. (The seller can make copies for their own files if they like, but the originals go with the airplane.)
- **"AD compliance is just a checkbox."** Wrong. AD compliance must be documented with the date, method of compliance, and next due. A checkbox without the documentation will not survive a ramp check or an enforcement action.
- **"The 411 covers the transponder."** Wrong. 91.411 covers the static system, the altimeter, and the *encoder* (the altitude-reporting unit feeding the transponder). 91.413 covers the *transponder unit itself*. They overlap on the encoder data correspondence test but they are separate inspections.

## Related sections

- 91.203 -- documents required in the aircraft
- 91.205 -- equipment requirements (the IFR list in (d) drives the 411 trigger)
- 91.213 -- inop equipment dispatch (lesson 02)
- 91.215 -- transponder (lesson 03)
- 91.225 / 91.227 -- ADS-B Out (lesson 03)
- 91.405 -- maintenance required (lesson 04)
- 91.407 -- post-maintenance return-to-service (lesson 04)
- 91.409 -- inspections; annual / 100-hour (lesson 04)
- 14 CFR Part 39 -- airworthiness directives
- 14 CFR Part 43 -- maintenance, preventive maintenance, rebuilding, alteration
- 14 CFR Part 43 Appendix E -- altimeter / static system test procedures
- 14 CFR Part 43 Appendix F -- transponder test procedures

## Drills

### Locate the section

| Question                                                                | Section / source         |
| ----------------------------------------------------------------------- | ------------------------ |
| Where is the altimeter / static / encoder 24-month check?                | [@cite](airboss-ref:regs/cfr-14/91/411?at=2026)            |
| Where is the transponder 24-month check?                                 | [@cite](airboss-ref:regs/cfr-14/91/413?at=2026)            |
| Where is the data correspondence post-installation re-test?              | [@cite](airboss-ref:regs/cfr-14/91/411?at=2026)(a)(3) and [@cite](airboss-ref:regs/cfr-14/91/413?at=2026)(b) |
| Where is the maintenance records list?                                   | [@cite](airboss-ref:regs/cfr-14/91/417?at=2026)            |
| Where is the 1-year retention vs. perpetual retention split?             | [@cite](airboss-ref:regs/cfr-14/91/417?at=2026)(b)         |
| Where is the AD compliance records requirement?                          | [@cite](airboss-ref:regs/cfr-14/91/417?at=2026)(a)(2)(v)  |
| Where is the major alteration / Form 337 requirement?                    | [@cite](airboss-ref:regs/cfr-14/91/417?at=2026)(a)(2)(vi) |
| Where is the records-on-sale transfer rule?                              | [@cite](airboss-ref:regs/cfr-14/91/419?at=2026)            |
| Where are the altimeter test procedures?                                 | 14 CFR Part 43 Appendix E |
| Where are the transponder test procedures?                               | 14 CFR Part 43 Appendix F |

### Apply the rules

> A C172 has the following currencies: annual signed October 1, 2025; 411 inspection March 15, 2024; 413 inspection March 15, 2024. Today is April 29, 2026. The pilot wants to fly an IFR cross-country today. Legal?

Answer: No. 91.411 was signed March 15, 2024 -- valid for 24 calendar months -> through March 31, 2026. Expired by 1 month. The pilot cannot legally fly IFR in controlled airspace. 91.413 is also expired (same 24-month interval, same lapse). The pilot can fly VFR (with the transponder issue addressed -- see below), but not IFR.

The expired 413 also creates an issue: the airplane has a transponder installed, but the transponder cannot be operated (91.413(a)). 91.215(c) requires operation when in 91.215(b) airspace. The pilot needs a 91.215(d) ATC deviation to fly through Class C/B/Mode C veils, or must avoid those airspaces. VFR through Class E only is feasible without the transponder operating.

> Same airplane, same currencies, but the pilot only wants to fly VFR today. Is the airplane legal?

Answer: VFR-wise, yes -- 91.411 is IFR-only. The annual and 100-hour (if applicable) determine VFR legality. But the transponder is not operable per 91.413(a) -- so flight through any 91.215(b) airspace requires the 91.215(d) deviation. A VFR flight in pure Class E (no Mode C veil, no Class B/C transitions) is legal. A VFR flight through SFO's Mode C veil at 4,500 ft is not without a deviation.

> A pilot just had their transponder replaced (a new Mode S unit installed). The avionics shop signed off the 413 and the 411 data correspondence test. Today is the next morning. Are 91.411 and 91.413 fully satisfied?

Answer: 91.413 -- yes, the new transponder is freshly inspected. 91.411 -- the data correspondence portion has been done (per 91.411(a)(3)), but the *full* 91.411 inspection (static, altimeter, encoder) was not necessarily redone unless the avionics shop also performed it. If the prior 411 inspection was within 24 calendar months and the data correspondence was re-verified after the transponder install, 91.411 remains satisfied for the rest of the original 24-month window.

> A pilot is selling their C182 to a buyer. The buyer asks for "all the records." Walk through what the seller must transfer.

Answer: 91.419 requires transfer of:

- The 91.417(a)(2) records (the perpetual records): total time in service of airframe / engine / prop, life-limited part status, time since overhaul, current inspection status, AD compliance status, Form 337s for major alterations.
- The 91.417(a)(1) records not yet superseded: the most recent annual, the most recent 100-hour (if applicable), the most recent 411 and 413, recent maintenance entries.

Practically, this means the airframe logbook, engine logbook, propeller logbook, all Form 337s, AD compliance records, and the most recent 411/413 records. The seller hands them to the buyer at closing. Best practice: the buyer's pre-purchase A&P/IA reviews the records before closing.

> A renter pilots a C172 from a flight school. Mid-cross-country, the pilot's iPad shows the airplane's transponder is sending altitude reports 200 ft above the altimeter. Is this a 91.411 issue?

Answer: Yes. 91.411(a)(3) requires the data correspondence between the encoder and the altimeter to comply with Part 43 Appendix E -- which limits the difference to 125 ft. A 200-ft discrepancy is outside the tolerance. The maintenance event that caused this discrepancy (or the gradual drift) is a 91.411 issue. The pilot should land, the school should re-inspect under 91.411 before further flight, and they should investigate whether the encoder or altimeter has drifted.

The CFI / dispatcher implication: if a pilot reports altitude correspondence issues, the airplane is grounded for IFR until the avionics shop re-runs 91.411(a)(3).

## Where this lesson sits

Lesson 5 of week 5. We covered the altimeter / static / encoder check (91.411), the transponder check (91.413), the maintenance records (91.417), and the records transfer on sale (91.419).

- Previous: [04-maintenance-responsibilities-and-inspections.md](04-maintenance-responsibilities-and-inspections.md) -- 91.405, 91.407, 91.409
- Next (Week 6): [week-06-part-91-special-ops/](../week-06-part-91-special-ops/) -- subpart D special ops, 91.211 oxygen, 91.103 / 91.111 / 91.117 (and related)

## Related

- Live source: [Part 91](airboss-ref:regs/cfr-14/91?at=2026)
- Live source: [altimeter / static / encoder check](airboss-ref:regs/cfr-14/91/411?at=2026)
- Live source: [transponder check](airboss-ref:regs/cfr-14/91/413?at=2026)
- Live source: [maintenance records](airboss-ref:regs/cfr-14/91/417?at=2026)
- Live source: [records on sale](airboss-ref:regs/cfr-14/91/419?at=2026)
- Companion: 14 CFR Part 43 Appendix E (altimeter / static system test procedures)
- Companion: 14 CFR Part 43 Appendix F (transponder test procedures)
- Companion: FAA AD database (the authoritative source for AD compliance research)
