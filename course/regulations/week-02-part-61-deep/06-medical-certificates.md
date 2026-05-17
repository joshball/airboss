---
title: Medical certificates -- Part 67 and BasicMed (Part 68 + 49 USC 44703)
week: 2
section_order: "06"
last_verified: 2026-04-29
cites:
  knowledge_nodes:
    - regulations/pilot-privileges-limitations
  acs_leaves:
    - PA.I.A.K2
  handbook_sections:
    - airboss-ref:regs/cfr-14/67
    - airboss-ref:regs/cfr-14/68
    - airboss-ref:regs/cfr-14/61/23
---

# Medical certificates -- Part 67 and BasicMed

The medical-certificate question is the second-most-asked regulatory question a working CFI hears (after "am I current?"). It is also one of the easier questions to get wrong, because medical-certification rules live across *three* regulatory homes: §61.23 (the currency-and-class anchor), Part 67 (the medical standards themselves), and Part 68 + 49 USC 44703 + AC 68-1 (the BasicMed alternative).

This lesson is the deep-dive promised in [01-subpart-walk.md](01-subpart-walk.md). We orient on §61.23 first (Part 61's anchor for medicals), then walk Part 67 (class durations and standards), then walk BasicMed (the parallel alternative).

## What you'll be able to do

- State which medical class is required for each certificate / privilege combination
- Apply the §61.23 duration rules including the age-based wrinkle for third-class medicals
- Distinguish a §61.23(c)(2) medical from a §61.23(c)(3) BasicMed authorization
- List the BasicMed eligibility and aircraft restrictions cold
- Counsel a pilot through §61.53 (medical deficiency) including the "knew or should have known" standard
- Articulate when a special issuance is needed and where to look in 14 CFR

## Why this matters

Medical certificates are the regulatory boundary between a person who can act as PIC and a person who cannot. A pilot who has a current cert but knows of a disqualifying medical condition is in a §61.53 violation every time they exercise PIC. A pilot who lets their third-class medical lapse without a BasicMed alternative cannot legally fly until they renew. A pilot who *thinks* they're under BasicMed but missed the 4-year online course renewal is non-current.

The high-stakes nature comes from §67.403 (medical fraud) -- intentionally misstating a medical history on the application carries criminal as well as administrative consequences. Career-ending. We come back to §67.403 in Week 9 (enforcement). Here we focus on the day-to-day mechanics.

## The discovery question

A 56-year-old private pilot called you yesterday. Their last third-class medical was issued April 2024 (under the post-2008 expansion to 60 calendar months for under-40-but-this-pilot-is-over-40 rule that doesn't apply here -- the relevant rule is the under-40 / over-40 split). They have BasicMed paperwork from 2021 that was never refreshed. They want to fly today with a passenger.

Pause.

The third-class medical for an over-40 pilot expires at the end of the 24th calendar month after the month of the exam. April 2024 -> April 30, 2026. Today is well into 2026 -- depending on the exact date, the medical may still be valid, but if today is past April 30, 2026 it has expired.

The BasicMed authorization needs renewal:

- The medical exam by a state-licensed physician is good for 4 calendar years from the month of the exam.
- The online course (the BasicMed course) is good for 24 calendar months from the date of completion.

A 2021 BasicMed exam needs the exam re-done (more than 4 years old). A 2021 BasicMed course completion is also expired (way more than 24 months old).

So: if the third-class is still valid (April 30, 2026 or earlier), the pilot is fine to fly today using the third-class. If past April 30, 2026, the pilot needs *either* a new third-class *or* a new BasicMed cycle (new physician exam *and* new online course completion).

This is the typical question. CFIs and pilots get this wrong because the BasicMed cycles are tracked in two separate places (the physician exam date vs. the online course completion date) and pilots often refresh one without the other.

## §61.23 -- the Part 61 anchor

§61.23 is the section every pilot starts with. It sets the medical class requirement by privilege:

```text
§61.23  Medical certificates: Requirement and duration.

(a) Operations requiring a medical certificate. Except as provided in
    paragraphs (b) and (c) of this section, a person --

  (1) Must hold a first-class medical certificate when exercising the
      privileges of an airline transport pilot certificate;

  (2) Must hold at least a second-class medical certificate when
      exercising the privileges of a commercial pilot certificate; and

  (3) Must hold at least a third-class medical certificate when --

      (i) Exercising the privileges of a private pilot certificate, a
          recreational pilot certificate, or a student pilot certificate
          (except for the limited duration medical for sport pilots);

      (ii) Exercising the privileges of a flight instructor certificate
           and is acting as the pilot in command or is serving as a
           required pilot flight crewmember;

      (iii) Taking a practical test in an aircraft for which the FAA
            requires a third-class medical certificate.

(b) Operations not requiring a medical certificate. ... (sport pilot,
    glider, balloon, etc.)

(c) Operations requiring either a medical certificate or other
    documentation. (BasicMed paragraph)

(d) Duration of medical certificates. (the calendar-month math)

Note: paraphrase. Read the actual reg before referencing in exam.
```

The structure to internalize:

1. **First class** for ATP privileges.
2. **Second class** for commercial privileges.
3. **Third class** for private, recreational, student, and CFI-while-acting-as-PIC.
4. **No medical** for sport pilot, glider, free balloon (per §61.23(b)).
5. **BasicMed** as an alternative to third-class for *most* private pilot privileges (per §61.23(c)).

### Class durations -- §61.23(d)

The §61.23(d) duration table is the single most-asked piece of medical regulation. The math:

| Class  | Privilege exercised                            | Duration                                                                                              |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| First  | ATP privileges                                 | 12 calendar months from month of exam (under age 40); 6 calendar months (age 40+)                     |
| First  | Privileges below ATP (private/commercial)      | Drops to second-class duration                                                                        |
| First  | Privileges below first / second                | Drops to third-class duration                                                                         |
| Second | Commercial privileges                          | 12 calendar months from month of exam, regardless of age                                              |
| Second | Below commercial (private)                     | Drops to third-class duration                                                                         |
| Third  | Private, recreational, student, CFI privileges | 60 calendar months from month of exam (under age 40); 24 calendar months from month of exam (age 40+) |

The calendar-month math: a third-class medical for an over-40 pilot, exam dated March 15, 2024, is good through March 31, 2026. The pilot gets the back-end month for free.

The "drops" rule is what trips pilots up: a first-class medical doesn't disappear when the pilot stops exercising ATP privileges -- it just *drops* to whatever duration the exercised privilege requires. A first-class medical issued to a 35-year-old is good for 12 calendar months as a first-class (ATP), but it's good for 60 calendar months as a third-class (private). The calendar runs concurrently: that same exam was issued in March 2024; for ATP it expires March 2025; for private privileges it remains valid through March 2029.

This matters when a pilot transitions from airline work to recreational flying without taking a new exam. The first-class doesn't have to be renewed for them to keep flying as a private pilot under the third-class duration.

### §61.23(c) -- BasicMed integration

§61.23(c) is the home of the BasicMed alternative. It says: a pilot may exercise the privileges of a private pilot certificate without a third-class medical certificate, provided they comply with §61.23(c)(2) requirements -- which are essentially the BasicMed conditions in Part 68.

The trap: §61.23(c) does not let you exercise *commercial* privileges. BasicMed is a private-privileges-only alternative. A commercial pilot earning compensation must hold a current second-class medical (or higher).

## Part 67 -- the medical standards themselves

Part 67 is a separate part within 14 CFR. It sets the *medical standards* for each class:

```text
Part 67 -- Medical Standards and Certification

Subpart A  General                          (sections 67.1 to 67.15)
  Eligibility, application, exam by AME, the FAA medical decision

Subpart B  First-Class Airman Medical Certificate (sections 67.101 to 67.123)
Subpart C  Second-Class Airman Medical Certificate (sections 67.201 to 67.223)
Subpart D  Third-Class Airman Medical Certificate (sections 67.301 to 67.323)
  Each subpart: eye, ear/nose/throat/equilibrium, mental, neurologic,
    cardiovascular, general medical condition

Subpart E  Certification Procedures           (sections 67.401 to 67.415)
  Special issuance, denial, revocation, reconsideration, the §67.403
  fraudulent-application section
```

The structure: each class has its own subpart, each subpart has the same anatomy (eye / ENT / mental / neuro / cardio / general). The standards differ by class -- first-class has the strictest standards, third-class the loosest.

### What "the standards" actually look like

For the third-class medical (subpart D, the most common):

- **§67.301 -- General.** Must not have any medical condition that the FAA determines makes the applicant unable to safely perform the duties or exercise the privileges of the certificate.
- **§67.303 -- Eye.** Distant vision 20/40 or better with or without correction; near vision 20/40 with correction.
- **§67.305 -- Ear, nose, throat, equilibrium.** Specific audiometric requirements; no significant disorder.
- **§67.307 -- Mental.** No history of psychosis, bipolar disorder, severe personality disorder, or substance dependence/abuse. The mental requirements are read closely; CFIs and AMEs encounter cases regularly.
- **§67.309 -- Neurologic.** No epilepsy or seizure disorder, no disturbance of consciousness without satisfactory medical explanation.
- **§67.311 -- Cardiovascular.** No myocardial infarction, no angina pectoris, no coronary heart disease that has required treatment, no cardiac valve replacement, no permanent cardiac pacemaker.
- **§67.313 -- General medical condition.** Diabetes (insulin-dependent is disqualifying without special issuance), uncontrolled blood pressure, certain cancers.

Most disqualifying conditions are not absolute -- they are "disqualifying without special issuance" (Authorization for Special Issuance under §67.401). Pilots with diabetes, controlled cardiac conditions, mental health histories, etc. routinely fly under special issuance, but the AME and the FAA medical office are involved in each case.

### The AME exam process

A medical exam is conducted by an Aviation Medical Examiner (AME) -- a designated FAA medical examiner, listed on the FAA's AME locator. The pilot completes Form 8500-8 (the FAA medical application) online via MedXPress, prints the confirmation, and brings it to the AME.

The AME reviews the form, conducts the physical, and issues *or* denies *or* defers the application. Issuance is on the spot (the AME prints the medical certificate). Denial is a formal FAA process; deferral sends the case to the FAA medical office for review.

The FAA medical office has roughly 10,000+ deferred cases at any time. Deferral can take 30 days to 18 months depending on the question. The pilot can fly during a deferral period only if they hold a previously valid medical that is still within its duration.

### §67.403 -- fraudulent application

```text
§67.403  Applications, certificates, logbooks, reports, and records:
Falsification, reproduction, or alteration; incorrect statements.

(a) No person may make or cause to be made --

  (1) Any fraudulent or intentionally false statement on any
      application for a medical certificate or on a request for
      any reconsideration thereof;

  (2) Any fraudulent or intentionally false entry in any logbook,
      record, or report that is required to be kept, made, or
      used to show compliance with any requirement for the issuance
      or exercise of the privileges, of any certificate issued under
      this part;

  ... (other fraud / forgery / alteration provisions)

(b) ... (consequence: ground for denial, suspension, or revocation)

Note: paraphrase. Read the actual reg before referencing in exam.
```

§67.403 is one of the FAA's strongest enforcement tools. A pilot who lies about a medical condition on Form 8500-8 has committed a §67.403 violation. The consequences include immediate certificate suspension, often combined with criminal referral to the U.S. Attorney's Office. This is the career-ending provision; we treat it more fully in Week 9.

The "knew or should have known" standard applies. A pilot who has a documented medical history their physician told them about, who then fails to disclose on Form 8500-8, cannot defend on the ground of "I didn't think it mattered." The standard of disclosure is broad.

## BasicMed -- §61.23(c) + Part 68 + 49 USC 44703 + AC 68-1

BasicMed is a parallel pathway for private pilots, created by Public Law 114-190 (2016) and codified in Part 68 plus 49 USC 44703(j). It allows certain private pilots to exercise private privileges *without* a third-class medical certificate, provided they meet the BasicMed conditions.

### Eligibility -- who can use BasicMed

```text
A pilot may operate under BasicMed if:

  1. They have held an FAA medical certificate (any class) at any time
     after July 14, 2006, that was not revoked, suspended, or denied
     at last issuance.

  2. The most recent medical certificate has not been revoked or
     suspended for a medical reason since the last expiration.

  3. They complete a BasicMed medical exam by a state-licensed physician
     (M.D., D.O., or osteopath) every 4 calendar years (47 calendar
     months from the month of the most recent BasicMed exam).

  4. They complete the FAA's BasicMed online course every 24 calendar
     months (recurrent training).

  5. They do not have a "specifically disqualifying" medical condition
     listed in 49 USC 44703(j) without a special issuance for that
     condition.
```

The "specifically disqualifying" conditions in the statute (49 USC 44703(j)(2)) include:

- Myocardial infarction
- Cardiac valve replacement
- Permanent cardiac pacemaker
- Coronary heart disease requiring treatment
- Heart replacement
- Conditions involving loss of consciousness due to seizure (other than febrile)
- Bipolar disorder
- Substance abuse disorder

A pilot with one of these conditions cannot use BasicMed unless they obtain an FAA special issuance for the condition first. After the special issuance is granted, the pilot can fly under BasicMed.

### Aircraft restrictions

Under BasicMed, the pilot may operate:

```text
- Aircraft authorized to carry no more than 6 occupants total
  (pilot + 5 passengers)
- Aircraft with a maximum certificated takeoff weight of not more than
  6,000 pounds
- Aircraft with no more than one engine (under 6,000 lbs MGW with up
  to 6 occupants)
- Or specific multi-engine and turbine-powered aircraft within the
  6,000-lb limit
```

Operations:

- VFR or IFR (BasicMed does NOT restrict to VFR -- contrary to widespread misconception)
- Day or night
- Within the United States and certain authorized airspace (see AC 68-1 for international)
- Speeds below 250 KIAS (a mandatory limit under the BasicMed statute)

The trap: BasicMed pilots can fly IFR and at night. Pilots and CFIs incorrectly believe BasicMed is a VFR-only or day-only license. It is not. The currency rules under §61.57 still apply, but the BasicMed alternative does not impose additional restrictions on operation type beyond the aircraft and occupancy limits.

### What BasicMed does *not* cover

- Commercial privileges (a commercial pilot earning compensation cannot use BasicMed)
- ATP privileges (different requirement entirely -- ATP needs first-class)
- Operations outside the U.S. (specific international rules; AC 68-1 covers)
- Operations beyond aircraft limits

### The two-cycle structure

BasicMed has *two parallel cycles* the pilot must maintain:

```text
Cycle 1: Physician exam
  - Required by 49 USC 44703(j) and §61.23(c)(2)
  - Performed by state-licensed M.D. or D.O.
  - Documented on the BasicMed Comprehensive Medical Examination Checklist
    (FAA Form 8700-2 or equivalent)
  - Valid for 4 calendar years from the month of the exam
  - Pilot keeps the form in their logbook (with the form itself or a copy)

Cycle 2: Online course
  - Required by 49 USC 44703(j) and §61.23(c)(2)
  - Available at faasafety.gov (and other FAA-approved providers)
  - Free, ~2 hours of online content
  - Valid for 24 calendar months from the month of completion
  - Pilot keeps the certificate of completion in their logbook
```

The two cycles run independently. A pilot who refreshes their physician exam every 4 years but skips the online course every 2 years is *not* current under BasicMed; the operations are illegal even though the medical exam is valid. CFIs counseling BasicMed pilots routinely audit *both* dates in the pilot's documents before the pilot launches.

## §61.53 -- prohibitions related to medical conditions

§61.53 is a separate operational rule that applies regardless of medical certificate type:

```text
§61.53  Prohibition on operations during medical deficiency.

(a) Operations that require a medical certificate. Except as provided
    for in paragraph (b) of this section, a person who holds a medical
    certificate issued under part 67 of this chapter shall not act as
    pilot in command, or in any other capacity as a required pilot
    flight crewmember, while that person:

  (1) Knows or has reason to know of any medical condition that would
      make the person unable to meet the requirements for the medical
      certificate necessary for the pilot operation; or

  (2) Is taking medication or receiving other treatment for a medical
      condition that results in the person being unable to meet the
      requirements for the medical certificate necessary for the pilot
      operation.

(b) Operations that do not require a medical certificate. (sport pilot,
    BasicMed)
   ... contains parallel rules requiring the pilot to evaluate fitness
   based on knowledge of medical condition and current medications.

Note: paraphrase. Read the actual reg before referencing in exam.
```

§61.53 is the always-on rule. Even with a current medical certificate, a pilot cannot act as PIC if they know they have a disqualifying condition. The classic case: a pilot whose third-class medical was issued 6 months ago is later diagnosed with a seizure disorder. The pilot's third-class medical is still valid on its face, but §61.53 prohibits them from acting as PIC because they now know of a disqualifying condition under §67.309 (neurologic).

The reciprocal rule: a pilot taking medication for a condition that would be disqualifying may not act as PIC while the medication is being taken (or for a specified period after, depending on the medication). Common cases include sedating antihistamines, narcotic pain medications, and certain psychiatric medications.

The FAA publishes a list of "Allowed Medications" and "Do Not Issue Medications" that AMEs use during exams; pilots can consult the same list before self-grounding. The AME is the formal source; the FAA's Aerospace Medicine page hosts the up-to-date list.

The "knew or should have known" standard applies. A pilot who has been told by their personal physician that they have an arrhythmia, and who continues to fly without disclosing or self-grounding, is in §61.53 violation if the arrhythmia would meet a §67.311 (cardiovascular) standard.

## Common misreadings

- **"BasicMed is for VFR only."** Wrong. BasicMed pilots may fly IFR and at night. The pilot must still meet §61.57(c) IFR currency requirements separately.
- **"BasicMed and third-class are the same except for the doctor."** Wrong. They are different regulatory pathways with different aircraft limits, different exam requirements, and different cycles. A BasicMed pilot is *not* exercising the privileges of a third-class medical -- they are using the BasicMed alternative under §61.23(c).
- **"My third-class lasts 5 years if I'm under 40."** Mostly right -- 60 calendar months from the month of exam for under-40 third-class. Over 40 is 24 calendar months.
- **"My medical expires the day of the month it was issued."** Wrong. Medicals expire at the end of the calendar month following the duration. A medical issued April 15, 2026 (over-40 third-class) expires April 30, 2028.
- **"BasicMed lets me fly any airplane up to 6,000 lbs."** Right with caveats. Up to 6 occupants total and not more than 6,000 lbs MGW. Pilots planning to fly multi-engine or turbine should check the specific BasicMed aircraft authorization rules.
- **"§61.53 only applies during the exam window."** Wrong. §61.53 is a continuous obligation. A pilot diagnosed with a disqualifying condition the day after a medical exam is in violation if they fly the next day, even though the medical is "valid" on paper.
- **"Special issuance is hard to get."** Mixed. For some conditions (well-controlled hypertension, treated diabetes, certain cardiac conditions, ADHD with appropriate documentation) special issuance is routinely granted. For others (psychotic episodes, severe substance abuse, recent cardiac surgery without follow-up) special issuance is rare. The FAA's Aerospace Medicine page documents typical special-issuance pathways.
- **"BasicMed doesn't require an FAA exam ever."** Wrong for first-time BasicMed users. To use BasicMed, the pilot must have held an FAA medical at some point after July 14, 2006. A pilot with no prior FAA medical (a fresh student, for example) cannot start with BasicMed -- they need to obtain at least one FAA medical first, then transition.

## Drills

### Locate the section

| Question                                                  | Section / source                        |
| --------------------------------------------------------- | --------------------------------------- |
| Where is the medical class requirement?                   | §61.23                                  |
| Where is the BasicMed alternative for private privileges? | §61.23(c)                               |
| Where is the medical class duration table?                | §61.23(d)                               |
| Where is the always-on medical-deficiency rule?           | §61.53                                  |
| Where are the third-class medical standards?              | Part 67 subpart D                       |
| Where is the medical fraud rule?                          | §67.403                                 |
| Where is the BasicMed statutory authority?                | 49 USC 44703(j)                         |
| Where is the BasicMed aircraft limit?                     | 49 USC 44703(j); Part 68                |
| Where does the BasicMed online course live?               | faasafety.gov                           |
| Where does the BasicMed physician form live?              | FAA Form 8700-2 (or AC 68-1 attachment) |
| Where does AC 68-1 live (BasicMed guidance)?              | faa.gov advisory circulars              |
| Where does the AME pilot exam form live?                  | FAA Form 8500-8 (via MedXPress)         |

### Apply the rules

> A 35-year-old private pilot got a third-class medical on April 15, 2026. They turn 40 on October 12, 2026. When does their medical expire?

Answer: The duration math uses the pilot's age *at the time of the exam*. They were 35 at exam, so the third-class is good for 60 calendar months from the month of exam. April 2026 + 60 months = April 2031. Good through April 30, 2031. Hitting age 40 mid-cycle does not shorten the duration.

> A 50-year-old commercial pilot got a second-class medical on June 1, 2025. They are now flying recreationally as a private pilot. Today is July 8, 2026. Are they current?

Answer: For commercial privileges, the second-class is good for 12 calendar months -- expired June 30, 2026. For private privileges, the second-class drops to third-class duration. Over-40 third-class is 24 calendar months. From June 2025: good through June 30, 2027 for private privileges. Yes, they're current for private flying.

> A pilot completed a BasicMed physician exam on March 15, 2024 and the BasicMed online course on April 1, 2024. Today is October 28, 2026. Are they current under BasicMed?

Answer: The physician exam (March 15, 2024) is good for 4 calendar years -- through March 31, 2028. Still valid. The online course (April 1, 2024) is good for 24 calendar months -- through April 30, 2026. **Expired.** The pilot is not current under BasicMed. They need to retake the online course before flying again.

> A first-time student pilot wants to start training under BasicMed because they don't want to deal with an AME. Can they?

Answer: No. BasicMed eligibility requires a previously held FAA medical certificate (any class) issued at any point after July 14, 2006. A first-time student has no FAA medical history. They must obtain at least one FAA medical (typically third-class for student-pilot privileges) before they can transition to BasicMed.

> A pilot has a current first-class medical issued in February 2026 (age 28). They want to do a contracted commercial flight in June 2026. Are they covered?

Answer: Yes. The first-class duration for ATP privileges is 12 calendar months for under-40 (good through February 2027). For commercial privileges, the first-class drops to second-class duration -- 12 calendar months -- good through February 2027. June 2026 is well within. The pilot is covered.

> A pilot is taking a sedating antihistamine for seasonal allergies. They have a current third-class medical. They want to fly tomorrow morning at 7 a.m. The last antihistamine dose was 8 p.m. last night. Is there a regulatory issue?

Answer: §61.53 prohibits flying when "taking medication or receiving other treatment for a medical condition that results in the person being unable to meet the requirements for the medical certificate." Sedating antihistamines (Benadryl / diphenhydramine, etc.) are on the FAA's "Do Not Issue" list precisely because they can impair pilot performance. The pilot must wait long enough that the medication's effects are clearly clear -- typically 24-48 hours after the last dose for diphenhydramine. Whether 11 hours is enough depends on the specific medication and the pilot's metabolism; the safe answer is to consult the FAA's medication list and AME guidance before flying. The medical certificate alone does not authorize flying with active sedating-medication effects.

> A pilot diagnosed with insulin-dependent diabetes 6 months ago has been managing the condition with their primary care physician. They have not yet contacted the FAA. They have an annual third-class medical exam coming up in 3 months. Should they keep flying in the meantime?

Answer: §61.53 requires the pilot to ground themselves *now*. Insulin-dependent diabetes is a §67.313 disqualifying condition. The fact that the formal medical exam isn't for 3 months doesn't matter; the pilot now knows of a disqualifying condition and may not act as PIC under §61.53(a)(1). They should also disclose the condition on Form 8500-8 at the next exam (failure would be §67.403 fraud). Many pilots in this situation pursue a special issuance, which routinely includes diabetics with appropriate management; the FAA's Aerospace Medicine office is the entry point.

## Where this lesson sits

This is lesson 6 of week 2. We covered Part 67 (the airman medical), §61.23 (the Part 61 anchor), Part 68 + 49 USC 44703 (BasicMed), and §61.53 (the always-on medical-fitness rule).

- Previous: [05-ifr-currency.md](05-ifr-currency.md) -- §61.57(c) and the IPC
- Next (Week 3): [week-03-part-61-cfi/](../week-03-part-61-cfi/) -- Subpart H deep-dive on the CFI

## Related

- Live source: [Part 61](airboss-ref:regs/cfr-14/61?at=2026)
- Live source: [medical certificate requirement and duration](airboss-ref:regs/cfr-14/61/23?at=2026)
- Live source: [medical deficiency](airboss-ref:regs/cfr-14/61/53?at=2026)
- Live source: [private pilot privileges (BasicMed in (i))](airboss-ref:regs/cfr-14/61/113?at=2026)
- Companion: AC 68-1 (BasicMed)
- Companion: 49 USC 44703(j) -- BasicMed statutory authority
- Companion: faasafety.gov -- BasicMed online course
- Reference: FAA Form 8500-8 (MedXPress) -- the AME application
- Reference: FAA Form 8700-2 (or AC 68-1 attachment) -- the BasicMed physician form
