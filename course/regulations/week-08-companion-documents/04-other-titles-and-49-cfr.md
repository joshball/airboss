---
title: Other titles -- 49 CFR 1552 (TSA), 49 CFR 830 (NTSB), and the cross-title rules
week: 8
section_order: "04"
last_verified: 2026-04-29
cites:
  knowledge_nodes:
    - regulations/pilot-privileges-limitations
  acs_leaves:
    - PA.IX.A.K1
    - PA.IX.D.K1
  handbook_sections:
    - airboss-ref:regs/cfr-49/830
    - airboss-ref:regs/cfr-49/1552
---

# Other titles -- where pilot rules live outside Title 14

Most pilot regulations live in 14 CFR. Most. The exceptions matter because pilots routinely think "I only need to know Title 14" and then run into rules that govern their flying without living in their familiar Part. Two regulations sit outside Title 14 entirely:

- **49 CFR Part 1552** -- the TSA's Alien Flight Student Program, which constrains CFIs who train non-citizens.
- **49 CFR Part 830** -- the NTSB's accident and incident reporting rules. Every pilot is subject to Part 830, but the regulation lives in a different Title under a different agency.

This lesson maps the cross-title territory. It is short on text but high on consequence -- a CFI who doesn't know 49 CFR 1552 can commit a felony by training the wrong student; a pilot who doesn't know 49 CFR Part 830 can fail to report a serious incident and compound a single bad day with a regulatory violation.

## What you'll be able to do

- Articulate why pilot-relevant rules sometimes live outside 14 CFR -- the institutional structure that puts FAA rules in Title 14, TSA rules in Title 49, and NTSB rules in Title 49
- State the 49 CFR 1552 trigger conditions: which CFIs, which students, which training, and what verification is required
- State the 49 CFR Part 830 trigger conditions: which events require immediate notification and which require a written report
- Distinguish "accident" from "serious incident" for Part 830 reporting purposes
- Locate Part 830 cleanly during a checkride or actual emergency without losing time looking in 14 CFR

## Why this matters

The CFR is divided by agency, not by activity. Title 14 is the FAA's home. Title 49 is the Department of Transportation's home, with subtitles for the FAA's parent department, the TSA, the NTSB, and PHMSA. Pilot-relevant content lives across all of them.

If a CFI thinks "I only need 14 CFR" they will:

- Provide flight training to a non-citizen without TSA-required vetting (49 CFR 1552 violation)
- Fail to report a runway-incursion or near-miss to the NTSB (49 CFR 830 violation)
- Misunderstand what triggers an NTSB investigation (because the trigger is in Title 49, not Title 14)

A pilot who knows where to look -- and knows the boundary is institutional, not arbitrary -- avoids the trap.

## The discovery question

A foreign student walks into your flight school. They want primary flight instruction toward a private pilot certificate. They have a valid B-1/B-2 visa, an apartment in town, and the funds to pay. The school's manager says "they're enrolled, you can start training." Can you?

Pause.

§61.183 lists CFI eligibility. Nothing in §61.183 mentions citizenship or visa status. Title 14 is silent on the question. If this is all you know, the answer looks like "yes, train them."

But the answer is **no, not until you've completed TSA's Alien Flight Student Program (AFSP) verification under 49 CFR Part 1552**. The TSA, not the FAA, governs which CFIs may train which non-U.S.-citizen students. The rule lives in Title 49 (TSA's home) because it's a security regulation, not an aviation-instruction regulation. A CFI who provides flight instruction to a non-citizen without AFSP verification has committed a federal violation, with potential criminal penalties.

This is the canonical example of a rule that doesn't live in 14 CFR. The pilot or CFI has to know it exists in the first place to find it.

## How the CFR is organized across titles

```text
Title 14 (Aeronautics and Space)        -- the FAA's home
  Chapter I -- FAA: Parts 1-200 (the parts pilots know)
  Chapter II -- DOT (Office of the Secretary): Parts 200-399
  Chapter III -- Commercial Space Transportation: Parts 400-499

Title 49 (Transportation)                -- the broader DOT home
  Subtitle A -- Office of the Secretary of Transportation
  Subtitle B -- Other DOT agencies
    Chapter I -- PHMSA: Parts 100-180 (hazardous materials)
    Chapter III -- FMCSA: Parts 300-399 (motor carriers)
    Chapter VIII -- NTSB: Parts 800-899 (NTSB rules)
    Chapter IX -- Maritime: Parts 900-999
    Chapter XII -- TSA: Parts 1500-1699 (security; includes AFSP)
```

The pattern: Title 14 is FAA. Title 49 is DOT, including TSA (Chapter XII) and NTSB (Chapter VIII). When a rule is fundamentally about *security* or *accident investigation*, it lives in Title 49 even though pilots are subject to it. When a rule is fundamentally about *aviation operations* or *certification*, it lives in Title 14.

The pilot mental model: if the question is "what may the FAA do?" the answer lives in Title 14. If the question is "what may the TSA do?" or "what does the NTSB require?" the answer lives in Title 49.

## 49 CFR Part 1552 -- the Alien Flight Student Program

The TSA created the AFSP after September 2001 to vet non-U.S.-citizen flight students before they receive flight training in the United States. The rule is in 49 CFR Part 1552.

### The trigger -- who and what

Part 1552 applies when:

```text
1. The student is NOT a U.S. citizen or U.S. national
   - U.S. citizens are exempt entirely
   - U.S. nationals (limited group: certain American Samoans) are also exempt
   - Lawful permanent residents (green card holders) are NOT exempt -- they
     count as "alien flight students" and must complete AFSP

2. The training is "flight training" within the AFSP definition:
   - Training toward a U.S. pilot certificate or rating
   - Training in any aircraft, simulator, or flight training device
   - Recurrent training does NOT trigger AFSP for category 1/2 students
     (already-vetted students from prior training)
   - Type ratings DO trigger AFSP for the relevant category
```

The student categories under 49 CFR 1552.1(b):

| Category   | Aircraft weight                | Vetting requirement                                              |
| ---------- | ------------------------------ | ---------------------------------------------------------------- |
| Category 1 | 12,500 lbs MTOW or more        | Full AFSP vetting before training begins                         |
| Category 2 | Less than 12,500 lbs MTOW      | Full AFSP vetting before training begins                         |
| Category 3 | Recurrent training in aircraft | Reduced vetting (subsequent-event after initial AFSP completion) |

For a primary flight student in a Cessna 172, this is Category 2. The student submits biographical and biometric data through the TSA's flight training portal, pays a fee, and is approved (or denied) for training. The CFI may not begin training until the TSA approval is in hand.

### The CFI's obligations

The CFI must:

- **Verify** the student's TSA approval before any flight training. The CFI checks the AFSP system or receives confirmation from the school.
- **Confirm citizenship** before initiating training. For citizens, this is documented (passport, birth certificate). For non-citizens, the AFSP record is the documentation.
- **Maintain records** of the verification for 5 years.
- **Notify TSA** of certain triggering events (the student's denial, withdrawal, etc.).

The penalty for non-compliance includes both administrative consequences (CFI certificate action under §61.193 / §61.195 enforcement) and *criminal* penalties under 49 USC 46303 and 18 USC 1546 (false statements / immigration fraud, if the CFI knew or should have known the student was unauthorized).

### Practical mechanics

In a typical Part 141 school:

1. A foreign student applies. The school's administrative office (or designated AFSP coordinator) initiates the TSA application.
2. The student completes the TSA Form 1900 (or current equivalent) with biographical and biometric data.
3. The TSA runs the vetting (criminal background, terrorism watchlist, immigration status).
4. The TSA issues approval (or denial). Approval includes specific category and time-limited validity.
5. The school's AFSP coordinator forwards confirmation to the CFI.
6. The CFI may begin training only after step 5.

In a typical Part 61 / freelance scenario:

1. The CFI realizes the student is non-citizen.
2. The CFI initiates the TSA application themselves (CFIs can be the AFSP-responsible party for their own students).
3. The same vetting / approval process runs.
4. The CFI may begin training only after approval.

The trap: a CFI who agrees to train someone without checking citizenship status, then realizes mid-flight that the student isn't a citizen, has already committed the violation. The CFI must verify *before* training begins.

## 49 CFR Part 830 -- NTSB accident and incident reporting

Part 830 is the NTSB's home for the rules every pilot must follow when something goes wrong. The most-missed regulation when pilots think only in Title 14.

### Why it lives in Title 49

The NTSB is institutionally separate from the FAA. The FAA enforces aviation rules; the NTSB investigates accidents. Each agency has its own home in the CFR. The NTSB's investigative authority comes from 49 USC Chapter 11 and is implemented in 49 CFR Parts 800-899. Part 830 is the part that tells pilots and operators when to call the NTSB.

The institutional separation matters during an event. After an accident:

- The NTSB investigates the cause (49 CFR 831, parallel to 830).
- The FAA evaluates compliance with operational rules (14 CFR enforcement).
- These are *separate* processes. A pilot can be fully cleared by the NTSB and still face FAA enforcement, or vice versa.

### The structure of Part 830

```text
49 CFR Part 830 -- Notification and Reporting of Aircraft Accidents
                   or Incidents and Overdue Aircraft, and Preservation
                   of Aircraft Wreckage, Mail, Cargo, and Records

§830.1  Applicability
§830.2  Definitions
§830.5  Immediate notification -- when you must call the NTSB now
§830.6  Information required for immediate notification
§830.10 Preservation of wreckage, mail, cargo, and records
§830.15 Reports and statements to be filed -- the written report
```

Five sections. Three of them are structural. The two that govern day-to-day pilot obligation are §830.5 (when to call) and §830.15 (when to file the written report).

### §830.2 -- key definitions

- **Aircraft accident** -- An occurrence associated with the operation of an aircraft, taking place between the time any person boards the aircraft with the intention of flight and the time all such persons have disembarked, in which any person suffers death or serious injury, or in which the aircraft receives substantial damage.
- **Serious injury** -- (1) Requires hospitalization for more than 48 hours within 7 days of the injury; (2) Results in a fracture (excluding simple fractures of fingers, toes, or nose); (3) Causes severe hemorrhages, nerve, muscle, or tendon damage; (4) Involves any internal organ; or (5) Involves second- or third-degree burns or any burns affecting more than 5% of the body surface.
- **Substantial damage** -- Damage or failure that adversely affects the structural strength, performance, or flight characteristics, and would normally require major repair or replacement of the affected component. **Excludes**: engine failure or damage limited to an engine; bent fairings or cowlings; dented skin; small puncture holes; ground damage to rotor or propeller blades; damage to landing gear, wheels, tires, flaps, engine accessories, brakes, or wingtips.
- **Incident** -- An occurrence other than an accident, associated with the operation of an aircraft, that affects or could affect the safety of operations.

The "substantial damage" definition is the trap. Bent landing gear or a damaged prop alone is not substantial damage; engine damage alone is not substantial damage. Substantial damage means structural / performance / flight-characteristics impact requiring major repair. A bent firewall, a torn skin on a flight surface, a separated tail -- those qualify. A bent prop after a runway overrun where the airplane is otherwise intact -- usually does not.

### §830.5 -- when you must call the NTSB *immediately*

The NTSB must be notified by the most expeditious means available when an accident or any of the following listed serious incidents occurs:

```text
§830.5(a) Accidents (any aircraft accident as defined in §830.2)

§830.5(b) Listed serious incidents:

  (1) Flight control system malfunction or failure
  (2) Inability of any required flight crewmember to perform their
      normal flight duties as a result of injury or illness
  (3) Failure of any internal turbine engine component that results
      in the escape of debris other than out the exhaust path
  (4) In-flight fire
  (5) Aircraft collision in flight
  (6) Damage to property, other than the aircraft, estimated to
      exceed $25,000 for repair (including materials and labor)
  (7) For large multiengine aircraft (more than 12,500 pounds MGTW):
      (i) In-flight failure of electrical systems requiring sustained
          use of an emergency bus powered by a backup source
      (ii) In-flight failure of hydraulic systems requiring use of
           backup
      (iii) Sustained loss of power or thrust on more than 50% of
            engines
      (iv) An evacuation of an aircraft in which an emergency egress
           system is utilized
  (8) Release of all or a portion of a propeller blade from an aircraft,
      excluding release caused solely by ground contact
  (9) A complete loss of information, excluding flickering, from more
      than 50% of an aircraft's cockpit displays known as ... (EFIS or
      analog primary flight displays etc.)
  (10) Aircraft collision with terrain (CFIT) -- usually an accident
       under §830.2 but listed here as a backup
  (11) ATC reporting on the radio that the aircraft is missing or
       overdue
```

The §830.5 list mixes accident-by-default cases with serious-incident cases. A CFI or pilot who is not sure whether something qualifies should err on the side of calling. The NTSB takes the call, evaluates, and decides whether to investigate. Failing to call when required is a §830.5 violation; calling unnecessarily is not.

### §830.15 -- the written report

For accidents, the operator must file a written report on NTSB Form 6120.1 within 10 days of the accident. For incidents listed in §830.5(a) or specifically requested by the NTSB, the form is filed within 7 days of a request.

The form documents:

- Aircraft data (make, model, registration)
- Operator and pilot data
- Flight data (departure, intended destination, time, conditions)
- Sequence of events
- Damage assessment
- Injuries

The form is the formal record of the accident. The pilot's narrative on the form is signed under penalty of perjury; the NTSB takes representations seriously. CFIs sometimes help pilots fill out Form 6120.1 after an accident; the help is appropriate as long as the CFI doesn't become the source of false statements.

### §830.10 -- preservation of wreckage

After an accident, the wreckage may not be moved, except to:

- Remove persons trapped in the wreckage
- Protect the wreckage from further damage
- Protect public health and safety

The pilot or operator must preserve the wreckage until the NTSB releases it. Moving wreckage to "make it neat" is a §830.10 violation. The NTSB needs the scene as it landed, with the controls in the position they came to rest, the throttle settings, the configurations -- everything as it was at the end of the event. This information is destroyed if the wreckage is moved or "tidied."

The exception for safety is genuine: a fire still burning, a collapsed structure threatening someone, an unsafe scene -- those allow movement. But the standard is high.

## Other 49 CFR rules pilots may encounter

| Part               | Topic                                     | When you encounter it                                         |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------- |
| 49 CFR 175 / PHMSA | Hazardous materials in aircraft           | Carrying batteries, oxygen, radioactive medical samples, etc. |
| 49 CFR 1542        | Airport security                          | Operating into commercial airports                            |
| 49 CFR 1544        | Aircraft operator security (Part 121/135) | Working as a Part 121/135 pilot                               |
| 49 CFR 1552        | Alien Flight Student Program (TSA)        | CFIs training non-citizens                                    |
| 49 CFR 1554        | Repair station security                   | Operating at or with a Part 145 repair station                |
| 49 CFR 1562        | Operations at airports listed             | Specific airports with elevated security requirements         |
| 49 CFR Part 830    | NTSB accident/incident reporting          | Every pilot, every flight, every potential event              |
| 49 USC 44703       | BasicMed statutory authority              | Cited by §61.23(c)/Part 68                                    |

The pattern: aviation security and accident-investigation rules live in Title 49. Aviation operations and certification live in Title 14. Knowing the institutional split means knowing where to look when a question doesn't fit Title 14.

## Common misreadings

- **"All pilot rules are in 14 CFR."** Wrong. NTSB reporting (Part 830) is in 49 CFR. TSA security (Part 1552 and others) is in 49 CFR. PHMSA hazmat is in 49 CFR. Treat 49 CFR as part of the pilot's regulatory map.
- **"NTSB Part 830 only matters if I crash."** Wrong. Part 830 covers serious incidents short of accidents -- in-flight fire, flight control malfunction, certain engine events, certain damage events. A pilot who has any of these has a §830.5 obligation even without crashing.
- **"Substantial damage means anything broken."** Wrong. The §830.2 definition specifically excludes engine-only damage, dented skin, small puncture holes, bent landing gear without structural impact, and damage to props or rotor blades from ground contact. The substantial-damage threshold is structural / performance / flight-characteristics, not "anything broken."
- **"49 CFR 1552 only applies to Part 141 schools."** Wrong. The rule applies to *any* CFI providing flight training to a non-citizen, including freelance Part 61 CFIs. The CFI is responsible for the AFSP verification regardless of school affiliation.
- **"A green-card holder doesn't trigger AFSP."** Wrong. Lawful permanent residents are still "alien flight students" under the TSA's definition. Only U.S. citizens (and certain U.S. nationals) are exempt.
- **"The pilot makes the NTSB report."** Half-true. The pilot OR the operator OR the owner has the §830.5 obligation. Whoever calls discharges the obligation. In single-pilot Part 91, the pilot is also the operator and owner, so the pilot calls.
- **"Calling the NTSB is the same as calling the FAA."** Wrong. They're separate agencies with separate regulations. The FAA gets called for some things (e.g., per local FSDO request after an event). The NTSB gets called for §830.5 events. Often both will eventually be involved, but the calls are separate and trigger separate processes.
- **"I can move the wreckage to a hangar to keep it dry."** Wrong, unless the conditions for §830.10 movement (life safety, further damage prevention, public-health protection) are clearly met. Routine "tidying up" is a violation. When in doubt, leave it and let the NTSB tell you when you can move it.

## Where this lesson sits

This is the fourth lesson of Week 8. It locates the pilot-relevant Title 49 rules: TSA (1552) and NTSB (830). The next lesson integrates everything Week 8 has covered into the actual escalation path -- where the answer to a regulatory question lives.

Week 9 (enforcement) will deep-dive Part 830 reporting in operational practice. This lesson establishes its location and triggers.

## Related sections

- §61.193 -- CFI privileges (the underlying authority a CFI exercises when training)
- §61.195 -- CFI limitations (cross-references AFSP indirectly through the "may not provide" structures)
- §91.3 -- pilot in command authority and responsibility (overlaps NTSB reporting)
- 49 CFR 1552 -- AFSP
- 49 CFR Part 830 -- NTSB reporting
- 49 USC 44703 -- BasicMed statutory authority (cross-title)
- Week 1 [03-companion-documents.md](../week-01-architecture/03-companion-documents.md) -- the introduction
- Week 9 -- enforcement and reporting (deep-dive)
- Week 10 -- capstone (integration)

## Drills

| Question                                                                    | Where it lives                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Where is the TSA Alien Flight Student Program rule?                         | 49 CFR Part 1552                                            |
| Where is the NTSB accident reporting rule?                                  | 49 CFR Part 830                                             |
| When must I notify the NTSB *immediately*?                                  | 49 CFR 830.5                                                |
| What's the written-report form for an accident, and when is it due?         | NTSB Form 6120.1, within 10 days                            |
| What's the NTSB definition of "substantial damage"?                         | 49 CFR 830.2                                                |
| What's the NTSB definition of "serious injury"?                             | 49 CFR 830.2                                                |
| Where is the BasicMed statutory authority?                                  | 49 USC 44703(j)                                             |
| Where do hazmat carriage rules live?                                        | 49 CFR Part 175 (PHMSA)                                     |
| When may wreckage be moved after an accident?                               | 49 CFR 830.10 (rescue / safety / further-damage prevention) |
| Does a green-card holder trigger AFSP?                                      | Yes -- only citizens are exempt                             |
| Is engine-only damage "substantial damage" for NTSB purposes?               | No -- excluded by 49 CFR 830.2 definition                   |
| Does a Part 141 freelance CFI need to verify AFSP for non-citizen students? | Yes -- 49 CFR 1552 applies regardless of school affiliation |
| Is calling the NTSB the same as calling the FAA?                            | No -- separate agencies, separate rules, separate processes |
| What triggers a §830.5 immediate notification beyond accidents?             | Listed serious incidents -- see §830.5(b)                   |

## Live source

- [@cite](airboss-ref:regs/cfr-49/1552?at=2026) -- TSA Alien Flight Student Program
- [@cite](airboss-ref:regs/cfr-49/830?at=2026) -- NTSB accident reporting
- [@cite](airboss-ref:regs/cfr-49/830/2?at=2026) -- §830.2 definitions
- [@cite](airboss-ref:regs/cfr-49/830/5?at=2026) -- §830.5 immediate notification
- [@cite](airboss-ref:regs/cfr-49/830/10?at=2026) -- §830.10 wreckage preservation
- [@cite](airboss-ref:regs/cfr-49/830/15?at=2026) -- §830.15 reports
- [@cite](airboss-ref:regs/cfr-14/61/193?at=2026) -- §61.193 CFI privileges
- [@cite](airboss-ref:regs/cfr-14/91/3?at=2026) -- §91.3 PIC authority
