# A.1.2 -- Automatic Dependent Surveillance-Broadcast (ADS-B)

Research doc for lesson development. This subtopic is required at the overview level, but CFIs still need enough detail to teach both utility and limits.

## What the FAA Wants Taught

AC 61-83K A.1.2 gives a short overview, but it clearly expects instructors to understand the concept:

- ADS-B replaces radar technology with satellites to track aircraft movement
- ADS-B provides major advantages
- ADS-B is a foundational NextGen technology
- real-time ADS-B is now the preferred surveillance method for ATC
- GA benefits from ADS-B traffic, weather, and flight-information services
- safety and efficiency improve with advanced ADS-B

The parent A.1 section requires **an overview of ADS-B**, not a deep avionics course. The goal is that CFIs can teach:

- what ADS-B does;
- the difference between ADS-B Out and ADS-B In;
- what services pilots do and do not get;
- the main regulatory anchors;
- the main limitations students routinely misunderstand.

## How to Explain ADS-B Simply

For AC fidelity, keep the AC's high-level wording. For cockpit understanding, explain it like this:

- the aircraft determines its position from an approved position source, typically GPS / GNSS;
- ADS-B Out broadcasts that position and related data;
- ADS-B In receives traffic, weather, and other information when the aircraft is equipped for it.

Useful definitions:

- **Automatic** -- no pilot interrogation is needed for the broadcast
- **Dependent** -- it depends on onboard equipment and position source quality
- **Surveillance** -- it supports tracking and situational awareness
- **Broadcast** -- it sends information outward rather than replying only to radar interrogation

## ADS-B Out vs ADS-B In

This distinction is one of the most important teaching points.

- **ADS-B Out**
  - transmits the aircraft's position and related data
  - is the regulatory requirement in specified airspace

- **ADS-B In**
  - receives traffic, weather, and flight-information products
  - is not broadly mandated, but it is what gives the pilot cockpit-display benefits

If a pilot says, "I have ADS-B, so I can see traffic," the first question is:

- Do you mean **Out**, **In**, or both?

## Services CFIs Should Be Able to Explain

### Traffic

- direct ADS-B traffic comes from other participating aircraft
- **TIS-B** rebroadcasts traffic information derived from radar / ATC sources
- not every aircraft will appear on the display

### Weather and Flight Information

- **FIS-B** provides weather and flight-information products to properly equipped receivers
- the critical teaching point is not just that the service exists, but that it has limits

## Critical Limitations CFIs Must Teach

### 1. Traffic Display Does Not Equal "All Traffic"

Teach this directly:

- aircraft without the needed equipment may not appear;
- radar coverage and rebroadcast logic matter;
- terrain and reception environment matter;
- visual scanning and see-and-avoid still matter in VFR.

### 2. FIS-B Weather Is Strategic, Not Tactical

This is one of the highest-value ADS-B teaching points for line instructors.

Teach:

- displayed weather products can be meaningfully delayed;
- the pilot must evaluate product age and latency;
- datalink weather supports strategic awareness and planning;
- it is not for tactical threading between convective cells.

The internal question bank currently uses the common training shorthand that NEXRAD may be about **15 to 20 minutes old**. Keep that teaching point tied to current FAA/AIM weather-product guidance when developing final lesson material.

### 3. ADS-B Does Not Provide Separation

It improves awareness. It does not transfer responsibility for:

- maintaining visual lookout in VFR;
- monitoring the actual flight path and system behavior;
- understanding what the display is not showing.

### 4. Position Source Quality Matters

If the position source degrades, the quality of ADS-B information tied to it can degrade as well.

## Regulatory Anchors

### `14 CFR § 91.225` -- Where ADS-B Out Is Required

For training purposes, the operationally important list is:

- Class A airspace
- Class B airspace
- Class C airspace
- within 30 NM of listed primary Class B airports from the surface to 10,000 feet MSL
- above the ceiling and within the lateral boundaries of Class B or Class C airspace up to 10,000 feet MSL
- Class E airspace in the contiguous 48 states and DC at and above 10,000 feet MSL, excluding airspace at and below 2,500 feet above the surface
- Class E airspace over the Gulf of Mexico at and above 3,000 feet MSL out to 12 NM from the U.S. coastline

Also teach at a high level that:

- some aircraft without engine-driven electrical systems have limited exceptions;
- ATC deviations can be requested in some cases;
- if the aircraft is equipped with ADS-B Out, it generally must be operated in transmit mode.

### `14 CFR § 91.227` -- What the Equipment Must Do

At the FIRC level, the key point is:

- `§ 91.227` sets performance requirements for ADS-B Out equipment;
- a Mode C transponder by itself is not enough to satisfy the ADS-B Out requirement.

### Frequency Architecture

- **1090ES**
  - required in Class A / above FL180
  - international standard

- **978 UAT**
  - available below FL180
  - commonly associated with GA use and FIS-B services

## Reference Sources

### Primary

- `AC 61-83K`, Appendix A, Section A.1.2
- `docs/faa-docs/part-91.md`
  - `§ 91.225`
  - `§ 91.227`

### FAA Publications to Use for Supporting Detail

- current `AIM` ADS-B and weather-product sections
- current FAA ADS-B educational material
- current FAA guidance on datalink weather product limitations

### Internal References

- `OVERVIEW.md` in this directory
- `docs/firc/question-bank/a-1/test-questions-a.1.2.md`
- `SCN 1.4` and `SCN 1.5`

## Teaching Ideas

### Scenario Concepts

- **Where is the missing traffic?** -- compare cockpit traffic display with the actual traffic picture and ask what might not be shown
- **Strategic, not tactical** -- weather display shows a tempting gap; the student must explain why that is unsafe decision material
- **Do I have Out, In, or both?** -- give equipment configurations and ask what the pilot can transmit, receive, and legally do
- **Compliance planning** -- student wants to enter ADS-B rule airspace in an older aircraft; what exactly must be verified?

### Discussion Prompts

- "What is the most dangerous sentence a student can say about ADS-B traffic?"
- "What does ADS-B help with, and what does it never replace?"
- "How would you explain FIS-B latency to a student without turning it into a lecture?"
- "What part of the ADS-B story is regulatory, and what part is cockpit technique?"

### Common Misconceptions to Address

- "ADS-B shows all traffic."
- "ADS-B Out means I can see traffic."
- "FIS-B weather is real-time."
- "ADS-B only matters for IFR."
- "Mode C already satisfies the rule."
- "If the display is quiet, the sky is clear."

## Our Existing Content

### Questions

- `Q-A1-27` through `Q-A1-36`
- Strong current coverage of:
  - ADS-B versus radar
  - Out versus In
  - regulatory anchors in `§§ 91.225` and `91.227`
  - traffic-display limitations
  - FIS-B latency and misuse

### Scenarios

- `SCN 1.4` -- traffic display does not show all traffic
- `SCN 1.5` -- weather-display delay and misuse

This is already a strong scenario pair because it teaches the two biggest student traps:

- "the traffic screen shows everything"
- "the weather picture is current enough for tactical use"

## Highest-Priority Gaps

- No dedicated scenario where a CFI helps a pilot determine **ADS-B Out compliance** for a specific operation
- No visual teaching aid summarizing `§ 91.225` airspace
- No short explanation artifact showing the difference among direct ADS-B traffic, TIS-B, and ADS-R

If only one addition gets made, create an **ADS-B compliance and airspace-decision** scenario. The concept is important, practical, and not yet scenario-covered as directly as the limitation side.
