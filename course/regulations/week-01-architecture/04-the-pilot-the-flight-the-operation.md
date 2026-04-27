---
title: The pilot, the flight, the operation
week: 1
section_order: "04"
covers_regulations:
  - 91.3
  - 91.13
  - 91.103
  - 61.56
  - 61.57
ties_to_knowledge_nodes: []
---

# The pilot, the flight, the operation

This is the framing that organizes the entire course. Once you see it, you'll never look at Title 14 the same way again. Every regulatory question maps onto one of three subjects:

- **The pilot** -- who is allowed to fly, and what keeps them allowed
- **The flight** -- what rules apply to any individual flight
- **The operation** -- what rules apply to organized commercial / training operations

Three subjects. Three corresponding regulatory homes. Once you internalize this, finding the right Part for a question becomes near-automatic.

## What you'll be able to do

- Map any regulatory question to one of the three subjects in under five seconds
- Predict which Part contains the answer based on the subject
- Recognize when a question crosses subjects (which is most non-trivial questions)
- Use this framing to read regulations in the right order during oral exams

## Why this matters

Pilots without the framing approach the regulations as an undifferentiated soup. A question comes in and they panic and start grepping their memory for keywords. Pilots with the framing route the question first: "this is a pilot question -- Part 61." Then they go to Part 61 and look up the specifics. Routing first, lookup second. This is how working CFIs answer questions on the fly.

The framing also explains why some regulations seem to overlap. Equipment shows up in 91, in 135, in 141. That's because each operating regime adds its own equipment requirements *on top of* 91. The framing tells you they're not redundant -- they're stacked.

## The discovery question

Sort these questions into intuitive groups:

1. Can a 200-hour private pilot carry passengers at night?
2. Does this airplane need a transponder for IFR ops?
3. Does the local flight school need to be Part 141 to teach private pilots?
4. What endorsement is required for an instrument-rated pilot to fly tailwheel?
5. What weather forecast is required at the alternate airport for an IFR flight?
6. Can a Part 135 charter operator fly without a chief pilot?

Pause and group them.

You probably grouped:

- **Pilot questions** (1, 4) — about the human's qualifications
- **Flight questions** (2, 5) — about a specific flight's requirements
- **Operation questions** (3, 6) — about how a school or charter is run

Now match each group to a Part:

- Pilot questions → **Part 61**
- Flight questions → **Part 91**
- Operation questions → **Part 141 (training schools), Part 135 (charter), Part 121 (airline)**

That's the framing. The three subjects map directly onto the three regulatory homes.

## The three subjects

### 1. The pilot — Part 61 (with Part 67 for medical)

Everything about who is allowed to act as a pilot, and what keeps them allowed:

- Eligibility (age, citizenship, English proficiency)
- Aeronautical experience (hours, types of flight)
- Knowledge tests
- Practical tests (checkrides)
- Endorsements
- Currency requirements (recent flight experience)
- Flight reviews / proficiency checks
- Medical certificates (Part 67) and BasicMed (Part 68 + 49 USC 44703)
- Instructor certification, privileges, limitations (Subpart H)

If the question is about *the human*, you're in 61 (or 67 if medical-specific).

### 2. The flight — Part 91

Everything about what rules apply to any individual flight in U.S. airspace:

- Preflight obligations (91.103 — what you must know before flying)
- Right-of-way (91.111 — 91.115)
- Weather minimums (91.155 — 91.159)
- Equipment requirements (91.205, 91.207, 91.213)
- Maintenance and inspection currency (91.405 — 91.417)
- IFR fuel, alternates, and approach procedures (91.167 — 91.185)
- Oxygen (91.211)
- Transponder (91.215, 91.225)
- Special operations (aerobatic, parachute, towing — subpart D)
- PIC authority (91.3) and the careless/reckless catch-all (91.13)

If the question is about *whether this flight can happen and under what conditions*, you're in 91.

### 3. The operation — Parts 141, 135, 121, 119, 145

Everything about organized operations -- training schools, charters, airlines, repair stations:

- **Part 141** -- pilot schools (structured curriculum, TCO, stage checks)
- **Part 142** -- training centers (type rating training)
- **Part 119** -- the certification framework that 121 and 135 hang off of
- **Part 121** -- domestic, flag, and supplemental airline operations
- **Part 125** -- airplanes 6,000+ lbs, non-airline
- **Part 135** -- on-demand commercial (charter, air taxi)
- **Part 145** -- repair stations

If the question is about *the organization conducting the activity*, you're in the operation Parts.

## The cumulative-stack model

Here is the load-bearing point that pilots most commonly miss:

> **Part 91 applies to every civil flight in U.S. airspace. Always. Period.**
>
> When a flight is also a Part 135 flight (charter), Part 135 *adds* requirements on top of Part 91.
>
> When a flight is also a Part 141 training flight, Part 141 *adds* requirements on top of Part 91.
>
> When a flight is also a Part 121 airline flight, Part 121 *adds* requirements on top of Part 91.

This stacks rather than replaces:

```text
                  +-------+
                  | 121   |   adds airline requirements
                  +-------+
              +-----------+
              | 135       |   adds on-demand commercial requirements
              +-----------+
          +---------------+
          | 141           |   adds training school requirements
          +---------------+
   +-----------------------+
   | 91 (every civil flight)|   the floor
   +-----------------------+
```

So a Part 135 charter pilot must comply with **both** 135.213 (135's preflight rule) **and** 91.103 (91's preflight rule). Not pick one. Both.

A Part 141 student on a solo cross-country must comply with **both** 91.155 (VFR weather minimums) **and** 141 Appendix B (the syllabus mins, often higher).

When 135 or 141 is *more restrictive* than 91, the more restrictive rule wins (because both apply). When 135 or 141 is silent, 91 governs.

This is the whole reason the architecture works. Part 91 is the foundation; everything else is layered.

## Where to look for any question -- the routing table

Internalize this. Ten seconds per question:

| Question contains the words...                  | Look in (first)   | Then check (often)         |
| ------------------------------------------------ | ----------------- | -------------------------- |
| "Can this pilot..."                              | Part 61           | Part 67 if medical-related |
| "Is this medical..."                              | Part 67 / Part 68 |                            |
| "What endorsement..."                             | Part 61 + AC 61-65|                            |
| "Currency / flight review / IPC..."               | Part 61           |                            |
| "What's required to..." (about a flight)         | Part 91           | + 135 / 141 if commercial  |
| "Equipment for..."                                | Part 91 subpart C |                            |
| "Inspection due..."                               | Part 91 subpart E | + Part 43                  |
| "Weather minimums..."                             | Part 91 subpart B | + AIM Chapter 7            |
| "IFR alternate / fuel / filing..."               | Part 91 subpart B (91.167 - 91.171) |          |
| "Approach / DH / MDA..."                          | Part 91.175 + Part 97 |                       |
| "Oxygen at altitude..."                           | Part 91.211       |                            |
| "Transponder / ADS-B..."                          | Part 91.215 / 91.225 |                          |
| "Aerobatic / parachute / towing..."               | Part 91 subpart D |                            |
| "Is this flight school's syllabus OK?"            | Part 141          | + 91 (the floor)           |
| "Can this charter / air taxi..."                  | Part 135          | + 91, + 119                |
| "Does this airline..."                            | Part 121          | + 91, + 119                |
| "Repair station maintenance..."                   | Part 145          | + 43                       |
| "Did something happen we have to report?"         | 49 CFR 830       | (NOT Title 14)             |
| "Is this airspace this class?"                    | Part 71          | + chart                    |
| "Does this AD apply?"                             | Part 39           |                            |

This table is the muscle memory we are building. By the end of the course you'll have it without the table.

## The cross-cutting questions

Some questions hit multiple subjects. The framing helps you identify *which sequence* to consult:

### "I'm flying tomorrow at night, IFR, with a passenger."

(This is the canonical capstone — see [orals/night-ifr-passenger.md](../orals/night-ifr-passenger.md).)

Hits all three:

1. **The pilot** (Part 61): Am I current for IFR? For passengers? For night passengers?
2. **The flight** (Part 91): What does this airplane need for IFR night ops? Fuel, alternate, equipment, oxygen?
3. **The operation** (Part 91 only — this isn't a 135 or 141 op): no Part-141/135 layer

Walk subjects in order: pilot first (otherwise the rest doesn't matter), flight second.

### "My student is leaving me to fly for a Part 135 operator."

Hits two:

1. **The pilot** (Part 61): Does my student have the cert / hours / currency for what 135 will require?
2. **The operation** (Part 135 + 119 + 91): What does the operator need from this pilot? Hour minimums? Pilot proficiency check (.293)? Drug testing? Letter of authorization?

### "My friend asks me for a flight review."

Hits two:

1. **The pilot** (Part 61.56 + 61.193 + 61.195): Am I authorized to give it? Does my friend qualify for it?
2. **The flight** (Part 91): The actual flight portion of the review must comply with 91.

(See [orals/friend-flight-review.md](../orals/friend-flight-review.md).)

## Common misreadings

- **"Part 135 replaces Part 91 for charters."** No. Part 135 is *additive*. A charter pilot must comply with both. When in doubt, comply with whichever is stricter.
- **"Part 141 is required for serious training."** No. Part 61 schools can produce the same certificate at different hour minimums. Part 141 has structure (TCO, syllabus, stage checks, fewer hours). Part 61 has freedom (no syllabus required, but more hours typically). Both produce the same certificate. The right framing: "what kind of training organization am I, and what does my organization choose?"
- **"91 is for non-commercial; 135 is for commercial."** No. Part 91 applies to all civil flight. Commercial flying that isn't an airline (defined narrowly) is the 135 layer added to 91.
- **"All commercial flying is 135."** No. Many commercial pilots fly Part 91 ops -- corporate flight departments, banner towing (with specific approvals), pipeline patrol, ferry flights. The dividing line is whether the operation requires a 119 certificate (carriers and commercial operators), not whether the pilot is paid.
- **"Part 121 vs 135 is plane size."** Not exactly. The line is about scheduled service, fleet, and aircraft category. A 9-seat Pilatus on scheduled commuter service is 135. A 9-seat King Air operating on-demand could be 135. A 30-seat aircraft on scheduled service is typically 121. Don't try to memorize the exact line; know that 119 distinguishes them.

## Drills

### Route each question

For each question, name the three-subject category and the first Part to consult:

| Question                                                                  | Subject       | Part |
| ------------------------------------------------------------------------- | ------------- | ---- |
| Can a 100-hour pilot carry their grandmother in a 172?                    | Pilot         | 61   |
| Does this 172 need a transponder for IFR in Class B?                      | Flight        | 91   |
| Does the local flight school need to be 141 to teach my student?          | Operation     | 141  |
| What endorsement is required for high-performance airplanes?              | Pilot         | 61   |
| What's the IFR alternate weather forecast minimum?                        | Flight        | 91   |
| Can the school's 172 be used for hire without a 100-hour inspection?      | Flight        | 91 (specifically .409) |
| Can a charter operator have one chief pilot for two operating bases?      | Operation     | 119 + 135 |
| What must I do if I have an accident?                                     | (not Title 14) | 49 CFR 830 |
| Is my BasicMed valid for an IFR flight with passengers?                   | Pilot         | 61.113(i) + Part 68 |
| What altitude requires supplemental oxygen for the crew?                  | Flight        | 91.211 |

### Spot the cross-cutting question

Some questions hit multiple subjects. Identify the *sequence* of Parts to consult:

| Question                                                              | Sequence |
| --------------------------------------------------------------------- | -------- |
| "I'm flying IFR at night with a passenger tomorrow."                  | Pilot (61) -> Flight (91) |
| "My commercial student wants to start flying for a 135 operator."      | Pilot (61) -> Operation (135 + 119) |
| "I'm a CFI giving a flight review in the student's club airplane."     | Pilot (61) -> Flight (91) |
| "Can I put my 141 student on a solo cross-country in marginal weather?" | Pilot (61.93) -> Flight (91.155) -> Operation (141 syllabus mins) |

## Where this lesson sits

Final foundation lesson of Week 1. After this you have:

- The structural map ([01](01-title-14-shape.md))
- The citation syntax ([02](02-how-to-read-a-citation.md))
- The companion documents ([03](03-companion-documents.md))
- The framing for routing any question (this lesson)

Week 2 starts with Part 61 -- the pilot. We will refer back to this framing every week. By Week 10 the framing should be invisible because it's automatic.

## Related

- [orals/night-ifr-passenger.md](../orals/night-ifr-passenger.md) -- the capstone that hits all three subjects
- [SYLLABUS.md](../SYLLABUS.md) -- shows how the 10 weeks are organized along these three subjects
- [Week 2: Part 61 deep](../week-02-part-61-deep/overview.md) -- the pilot, in full
