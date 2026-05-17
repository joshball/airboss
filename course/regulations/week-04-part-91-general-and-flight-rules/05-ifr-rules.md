---
title: IFR rules -- §§91.167-91.185
week: 4
section_order: "05"
last_verified: 2026-04-29
cites:
  knowledge_nodes:
    - flight-planning/ifr-cross-country
  acs_leaves:
    - PA.I.E.K1
  handbook_sections:
    - airboss-ref:regs/cfr-14/91/167
    - airboss-ref:regs/cfr-14/91/169
    - airboss-ref:regs/cfr-14/91/175
    - airboss-ref:regs/cfr-14/91/185
---

# IFR rules: 91.167 through 91.185

This lesson covers the IFR ops cluster: fuel and alternate planning (§91.167 / §91.169), equipment checks (§91.171), takeoff and approach minimums (§91.175), altitudes and courses (§91.177 / §91.179 / §91.181), required reports (§91.183), and the lost-comm procedure (§91.185). Together these nine sections define the legal envelope of any IFR flight in the United States.

The structural shape: §91.167-§91.171 is "before takeoff" -- fuel, alternates, equipment. §91.175-§91.179 is "the flight itself" -- takeoff and approach, altitudes, courses. §91.181-§91.183 is "what you tell ATC." §91.185 is "what to do when you can't."

§91.175 is the section pilots quote in oral exams more than any other in this cluster. The "1-2-3 rule" for alternates lives in §91.169, not §91.175. Confusing the two is the most common IFR planning error.

## What you'll be able to do

- Apply §91.167 IFR fuel reserves (45 minutes after the alternate, plus the destination-to-alternate leg)
- Apply §91.169 the "1-2-3 rule" for when an alternate is required and the alternate weather minimums
- State §91.171 VOR check requirements (30 days, max acceptable error)
- Apply §91.175 the takeoff visibility, descent below DH/MDA, contact-approach, and visual-approach rules
- State §91.177 minimum altitudes for IFR operations (off-route 2,000 above the highest obstacle within 4 NM, or 1,000 in non-mountainous terrain)
- Apply §91.185 lost communication procedure: A-V-E-F (route) and M-E-A (altitude)

## Why this matters

The IFR cluster is the test of the IFR student's mastery of the regulation. A non-pilot can follow weather, ATC, and good airmanship. The IFR pilot knows the regulation that backs the airmanship. The §91.167-§91.185 cluster is the one most-cited in IFR enforcement cases and on every IFR oral.

The structural pattern of the cluster also rewards memorization once. Fuel and alternate (§91.167-§91.169) are pre-takeoff. Equipment (§91.171) is pre-takeoff. Approach minimums (§91.175) are at-the-airport. Altitudes/courses (§91.177-§91.181) are en-route. Lost comm (§91.185) is the contingency. Once the pattern is internalized, the section numbers become locator markers, not new content.

## The discovery question

You file IFR from KSQL to KSAC tomorrow afternoon. KSAC forecast at your ETA: 1,200 broken, 4 SM visibility. Forecast for the period one hour before to one hour after: 800 broken, 3 SM. Your filed alternate is KSMF (Sacramento Mather, 8 NM east). KSMF forecast at your ETA: 2,000 broken, 5 SM. Your fuel: 36 gallons usable in a 172, planning a 45-minute flight at 8 gph in cruise.

Pause.

Three checks. First, is an alternate required? Second, does KSMF qualify as an alternate? Third, do you have legal IFR fuel?

The first check routes through §91.169(b) -- the "1-2-3 rule." An alternate must be filed unless, at the time of arrival and one hour before to one hour after, the destination ceiling is at least 2,000 feet AND visibility is at least 3 SM. KSAC's forecast is 800-1,200 broken with 3-4 SM. The ceiling fails the 2,000-foot test. Alternate required.

The second check routes through §91.169(c) -- the alternate minimums. Standard alternate weather (when the airport has an instrument approach with published alternate minimums): 600-2 for precision approach, 800-2 for non-precision approach. KSMF forecast at your ETA: 2,000-5. Comfortably above either standard. KSMF qualifies. (You should also confirm the alternate is allowed -- some airports have NA-as-alternate restrictions.)

The third check routes through §91.167 -- IFR fuel. You need: (1) fuel to fly to the destination, (2) fuel from the destination to the alternate, plus (3) 45 minutes at normal cruise after that. Plan: 45-minute flight to KSAC + 6-minute hop KSAC->KSMF + 45 minutes reserve = ~96 minutes total fuel. At 8 gph, that's 12.8 gallons. With 36 usable, you have ~23 gallons margin. Legal.

The trap: pilots routinely miss the leg from destination to alternate. They plan fuel destination + 45 minutes and forget the alternate leg. §91.167 requires the full sequence.

## §91.167 IFR fuel

```text
§91.167  Fuel requirements for flight in IFR conditions.

(a) No person may operate a civil aircraft in IFR conditions unless it
    carries enough fuel (considering weather reports and forecasts and
    weather conditions) to--

    (1) Complete the flight to the first airport of intended landing;
    (2) Except as provided in paragraph (b) of this section, fly from
        that airport to the alternate airport; and
    (3) Fly after that for 45 minutes at normal cruising speed.

(b) Paragraph (a)(2) of this section does not apply if part 97 of this
    chapter prescribes a standard instrument approach procedure to, or
    a special instrument approach procedure has been issued to the
    operator for, the first airport of intended landing and, for at
    least 1 hour before and 1 hour after the estimated time of arrival,
    the weather reports or forecasts (or any combination of them)
    indicate ceiling and visibility at or above the following:

    (1) For aircraft other than helicopters: A ceiling of 2,000 feet
        above the airport elevation and visibility of 3 statute miles.
    (2) For helicopters: A ceiling of 1,000 feet above the airport
        elevation and visibility of 2 statute miles.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structural pattern:

- **Destination + alternate + 45 minutes.** The full sequence is required when an alternate is required. The 45 minutes is at normal cruising speed.
- **Alternate not required (skip the alternate leg) when (b) is met.** The destination has a published instrument approach AND the forecast shows 2,000 ceiling and 3 SM visibility one hour before to one hour after the ETA. This is the §91.167(b) carve-out, sometimes called the "1-2-3 carve-out."

When no alternate is required, the fuel calculation drops the alternate leg: destination + 45 minutes. The check is at takeoff and is based on filed/forecast data.

## §91.169 alternate-airport requirements

```text
§91.169  IFR flight plan: Information required.

(a) Information required. Unless otherwise authorized by ATC, each
    person filing an IFR flight plan must include in it the following
    information:

(b) Exception to applicability. ...alternate airport is required unless
    appropriate weather reports or forecasts indicate that, at the
    estimated time of arrival, the ceiling will be at least 2,000 feet
    above airport elevation and the visibility will be at least 3
    statute miles.

(c) IFR alternate airport weather minima.
    (1) If an instrument approach procedure has been published in part
        97 for that airport, the alternate airport minima specified in
        that procedure or, if none are specified, the following minima:
        (i) Precision approach procedure: Ceiling 600 feet, visibility 2 SM.
        (ii) Non-precision approach procedure: Ceiling 800 feet, visibility 2 SM.
    (2) If no instrument approach procedure has been published in part
        97 for that airport, ceiling and visibility minima are those
        allowing descent from the MEA, approach, and landing under
        basic VFR.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The "1-2-3 rule" mnemonic: 1 hour before to 1 hour after, 2,000 feet ceiling, 3 SM visibility. If any of those three numbers fails, you must file an alternate.

The standard alternate minimums:

| Approach type | Ceiling | Visibility |
| ------------- | ------- | ---------- |
| Precision     | 600 ft  | 2 SM       |
| Non-precision | 800 ft  | 2 SM       |

These are *forecast* minimums for the alternate at your ETA at the alternate. Once you arrive at the alternate after diversion, you fly the published approach minimums (DH/MDA), not the alternate minimums. The "alternate minima" are a planning standard, not an approach standard.

## §91.171 VOR equipment checks for IFR operations

```text
§91.171  VOR equipment check for IFR operations.

(a) No person may operate a civil aircraft under IFR using the VOR
    system of radio navigation unless the VOR equipment of that
    aircraft--
    (1) Is maintained, checked, and inspected under an approved
        procedure; or
    (2) Has been operationally checked within the preceding 30 days,
        and was found to be within the limits of the permissible
        indicated bearing error...

(b) Maximum permissible indicated bearing error:
    (1) VOT or radio repair station signal: +/- 4 degrees.
    (2) Ground checkpoint: +/- 4 degrees.
    (3) Airborne checkpoint: +/- 6 degrees.
    (4) Dual VOR check: +/- 4 degrees between the two indications.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The 30-day VOR check is a record-keeping rule with operational teeth. The check must be logged with the date, place, bearing error, and signature. The log lives in the aircraft's avionics records.

The four check types:

| Check type          | Tolerance | Source                                               |
| ------------------- | --------- | ---------------------------------------------------- |
| VOT (test signal)   | +/- 4 deg | Designated test signal at major airports             |
| Ground checkpoint   | +/- 4 deg | Designated point on airport, published in chart supp |
| Airborne checkpoint | +/- 6 deg | Designated airborne point, published in chart supp   |
| Dual VOR check      | +/- 4 deg | Difference between two VORs in the same aircraft     |

A pilot launching IFR with a VOR check older than 30 days is in §91.171 territory. The §91.13 catch-all attaches.

GPS-only aircraft: §91.171 applies only when *using* the VOR system. An aircraft equipped with VORs but flying RNAV the entire flight is not technically required to have a VOR check; in practice, regular checks are good airmanship.

## §91.175 takeoff and landing under IFR

§91.175 is dense. Three structural sections to memorize:

1. **§91.175(a)-(c) takeoff under IFR.** Part 91 has *no* takeoff minimums. The pilot may legally take off in zero/zero (subject to the §91.103 careless test). Part 121/125/135 operators have takeoff minimums. The Part 91 pilot's freedom here is the source of more accidents than the §91.155 cloud clearance rule.

2. **§91.175(c) descent below DH/MDA.** The pilot may descend below decision height (DH) or minimum descent altitude (MDA) only when:
   - The aircraft is continuously in a position to land in the touchdown zone using normal maneuvers and a normal rate of descent; and
   - Flight visibility meets the published minimums for the approach; and
   - At least one of the §91.175(c)(3) visual references is identifiable (10 listed: approach light system, threshold, threshold markings, threshold lights, runway end identifier lights, visual approach slope indicator, touchdown zone or markings, touchdown zone lights, runway or runway markings, runway lights).

3. **§91.175(d)-(e) contact and visual approaches.** Visual approaches are pilot-requested or ATC-issued; contact approaches are pilot-requested only. Both require 1 SM flight visibility, clear of clouds, and a clearance.

The §91.175(c) "10 visual references" list is tested cold on the IFR oral. State all 10 from memory:

1. Approach light system
2. Threshold
3. Threshold markings
4. Threshold lights
5. Runway end identifier lights (REIL)
6. Visual approach slope indicator (VASI/PAPI)
7. Touchdown zone or touchdown zone markings
8. Touchdown zone lights
9. Runway or runway markings
10. Runway lights

If the approach lights are the only visible reference, the pilot may descend to no lower than 100 feet above touchdown zone elevation, unless the red terminating bars or red side row bars are also visible.

## §91.177 minimum altitudes for IFR operations

```text
§91.177  Minimum altitudes for IFR operations.

(a) ...no person may operate an aircraft under IFR below--

    (1) The applicable minimum altitudes prescribed in parts 95 and 97
        of this chapter; or

    (2) If no applicable minimum altitude is prescribed in those parts--
        (i) In the case of operations over an area designated as a
            mountainous area in part 95, an altitude of 2,000 feet above
            the highest obstacle within a horizontal distance of 4 nautical
            miles from the course to be flown; or
        (ii) In any other case, an altitude of 1,000 feet above the highest
             obstacle within a horizontal distance of 4 nautical miles
             from the course to be flown.

Note: paraphrase. Read the actual reg before referencing in exam.
```

The pattern:

- **On a published route (airway, terminal procedure):** the published minimum altitude (MEA, MOCA, MCA) applies.
- **Off a published route, mountainous:** 2,000 feet above the highest obstacle within 4 NM.
- **Off a published route, non-mountainous:** 1,000 feet above the highest obstacle within 4 NM.

The §91.177 floor coexists with §91.119 (general minimum altitudes from Part 91 subpart B). The pilot must meet whichever is higher. Off-route, off-airway, the §91.177 obstacle clearance is usually higher than §91.119 and is the operative floor.

## §91.179 and §91.181: courses and altitudes

§91.179 sets IFR cruising altitudes (analogous to §91.159 for VFR). The hemispheric rule applies above 18,000 MSL with the FL flight-level naming, and the assigned altitude rule applies below 18,000 MSL (ATC assigns the altitude; the pilot maintains).

§91.181 requires that, when operating IFR, the pilot must operate "along the centerline of the airway" or "the direct course between the radio fixes" defining a direct route. Off-airway, the pilot must operate along the assigned course.

## §91.183 IFR communication and reports

§91.183 requires the pilot to maintain a continuous watch on the assigned ATC frequency and to report:

- Time and altitude over each compulsory reporting point
- Position over a non-compulsory reporting point on request
- Any unforecast weather and any other information related to safety
- The "in-and-out" reports: VFR-on-top altitude changes, missed approach, VFR conditions if the flight is being conducted at the lowest assigned altitude

The §91.183 reports list is testable on the IFR oral.

## §91.185 lost communication procedure

```text
§91.185  IFR operations: Two-way radio communications failure.

(a) General. Unless otherwise authorized by ATC, each pilot who has
    two-way radio communications failure when operating under IFR shall
    comply with the rules of this section.

(b) VFR conditions. If the failure occurs in VFR conditions, or if VFR
    conditions are encountered after the failure, each pilot shall
    continue the flight under VFR and land as soon as practicable.

(c) IFR conditions. If the failure occurs in IFR conditions, or if
    paragraph (b) of this section cannot be complied with, each pilot
    shall continue the flight according to the following:
    (1) Route.
        (i) By the route assigned in the last ATC clearance received;
        (ii) If being radar vectored, by the direct route from the point
             of radio failure to the fix, route, or airway specified in
             the vector clearance;
        (iii) In the absence of an assigned route, by the route that ATC
              has advised may be expected in a further clearance; or
        (iv) In the absence of an assigned route or a route that ATC has
             advised may be expected in a further clearance, by the route
             filed in the flight plan.

    (2) Altitude. At the highest of the following altitudes or flight
        levels for the route segment being flown:
        (i) The altitude or flight level assigned in the last ATC
            clearance received;
        (ii) The minimum altitude (converted, if appropriate, to minimum
             flight level as prescribed in §91.121(c)) for IFR operations; or
        (iii) The altitude or flight level ATC has advised may be
              expected in a further clearance.

Note: paraphrase. Read the actual reg before referencing in exam.
```

Two mnemonics:

- **Route -- AVEF:** Assigned, Vectored, Expected, Filed.
- **Altitude -- MEA:** the highest of: Minimum altitude for the segment, Expected altitude, Assigned altitude.

Lost comm is also the time to squawk 7600 and turn on the speakers; ATC is going to clear airspace around your projected route based on the AVEF/MEA logic.

## Common misreadings

**§91.167 fuel without the alternate leg.** Pilots plan destination + 45 minutes and forget the destination-to-alternate leg when an alternate is required. The full sequence is destination + alternate + 45 minutes.

**"1-2-3" rule applied to §91.175 instead of §91.169.** The 1-2-3 rule governs whether you must *file* an alternate (§91.169). It does not govern what minimums you fly the *approach to* (§91.175) once you arrive. Different sections, different concepts.

**§91.175(c) "the visual references must be in sight at the missed approach point."** The rule is that one of the 10 visual references must be *distinctly visible and identifiable* at the time the descent below DH/MDA is initiated. If the references are visible at MAP but become obscured during descent, the pilot may continue the descent provided the references were visible at the descent point. Pilots cite this rule overly conservatively.

**§91.169 standard alternate minimums applied to flying the approach.** The 600-2 / 800-2 alternate minimums apply only to *filing* the alternate. Once you divert to the alternate, you fly the published DH/MDA, not the alternate minimums.

**§91.185 altitude as "the highest of MEA / assigned / expected."** The order in the regulation is "the altitude or flight level assigned in the last ATC clearance received; the minimum altitude for IFR operations; or the altitude or flight level ATC has advised may be expected." Pilots remember this as "MEA" (in the wrong order). The mnemonic is the reverse: read the regulation before final exam.

## Where these sit in the regulatory map

§91.167-§91.171 live in subpart B (Flight Rules) under the IFR pre-takeoff cluster. §91.175-§91.181 live in subpart B under the IFR ops cluster. §91.183-§91.185 live in subpart B under IFR communications. All nine sections are subpart B; they are pre-takeoff, in-flight, and contingency rules that the IFR pilot must apply continuously.

The §91.13 catch-all attaches to violations of any of these sections.

## Related sections

- §91.13 careless or reckless -- attaches to all
- §91.103 preflight action -- requires knowing the §91.169 forecasts and the §91.171 VOR check status before launch
- §91.155 / §91.157 -- VFR weather minimums; §91.175(d) visual approach requires 1 SM flight visibility, clear of clouds, similar to special VFR
- AC 00-6 weather -- the FAA's weather-services handbook
- AC 91-78 use of class G airspace at airports without an operating control tower

## The next lesson

§91.211 oxygen and §91.215 transponder: the supplemental rules. Oxygen rules govern operations above 12,500 MSL; transponder rules govern airspace and altitude. Both layer on top of the IFR cluster.
