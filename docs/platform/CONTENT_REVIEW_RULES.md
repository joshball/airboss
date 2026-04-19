# Content & UI Review Rules

Rules for reviewing sim content, UI labels, and scenario design. Apply these during authoring, code review, and periodic content audits. Every rule has a test -- if you can't answer the test question with "yes," the content fails.

These rules are extracted from design principles and playtest feedback. They are not aspirational -- they are requirements.

---

## R1. No naked numbers

Every numeric value shown to a user must answer: **what does this number mean, and what is good vs bad?**

- A percentage without context ("45%") is meaningless. What is 45% of? What would 80% mean? What would 20% mean?
- A duration without framing ("1:34") doesn't tell the user if that's fast or slow.
- A count without reference ("3 of 5") needs to say what the 5 things are.

**Test:** Can a first-time user understand what this number means without reading documentation?

---

## R2. No internal codes in the UI

Internal identifiers, enum values, topic codes, and competency abbreviations must never appear raw to the user.

- "A.11" means nothing. "LOC Prevention (A.11)" means something.
- "CJ-1" means nothing. "Critical Judgment" means something. If the code is needed for cross-reference, show it secondary: "Critical Judgment (CJ-1)".
- Database IDs, pool IDs, module numbers as bare numbers -- none of these belong in the UI.

**Test:** Would a pilot who has never seen our codebase understand every label on this screen?

---

## R3. Everything the user can interact with must be defined on screen

If the user must choose between options (buttons, levels, actions), each option must have a visible definition and an example -- not just a label.

- A button labeled "Ask" with no explanation forces the user to guess what "Ask" means in this context.
- A scoring dimension labeled "Timing" with no question or explanation is a label, not feedback.
- A badge labeled "Degrading" on a student state tells you the word but not what it means for your next action.

**Test:** Can the user make an informed choice using only what's on screen, without prior training or documentation?

---

## R4. Never reveal what the user should discover

Content that tells the user what will happen defeats the purpose of the exercise. The user should discover the problem, not read about it in advance.

- A briefing that says "the student overshoots final" removes the recognition challenge.
- A title that names the crisis type ("Base-to-Final Overshoot") spoils the diagnosis.
- Metadata that reveals the scoring focus ("tests LOC intervention timing") teaches the user to game it.

**Test:** After reading the briefing, does the user already know what will go wrong? If yes, rewrite.

---

## R5. Build context before presenting a challenge

The user should be immersed in the situation before any crisis develops. Context-building serves two purposes: it makes the scenario realistic, and it activates the user's judgment before they need it.

- Start from a normal state -- approaching the airport, checking ATIS, reviewing conditions.
- Present the environment one element at a time: weather, student profile, airport layout, time of day.
- Ask open-ended questions that make the user think about the situation before anything goes wrong.
- The user should feel like they're already instructing before the first decision point.

**Test:** Is there a "settling in" period where the user builds situational awareness before the crisis? Or does the scenario drop them into the problem cold?

---

## R6. Show the situation, not just describe it

Static text descriptions are a last resort. If information can be shown visually -- a diagram, a map, a position indicator -- it should be.

- An airport diagram with wind arrows, plane position, and runway heading communicates more than "Runway 27, wind 210 at 18 gusting 25."
- Altitude, speed, and heading shown as instruments or callouts on a diagram are immediately scannable.
- Student profile shown as a quick-reference card (hours, ratings, tendencies) is faster than a paragraph.

**Test:** Is there any information on this screen that would be clearer as a visual than as text?

---

## R7. Feedback must explain itself

Every piece of feedback must answer: **why did I get this score, and what would I do differently?**

- "Timing 0%" is not feedback. "You waited until the stall horn activated to intervene. The safe window was 8 seconds earlier, when the student first increased bank past 30 degrees" is feedback.
- "Student at Risk" is an outcome, not feedback. The debrief chain of events is the feedback.
- Bar charts without narrative are data, not insight.

**Test:** After reading this feedback, does the user know exactly what to change on their next attempt?

---

## R8. Labels must be human-first, code-second

When displaying tags, topics, competencies, or categories, lead with the human-readable name. The code or abbreviation follows in parentheses only if needed for cross-reference.

- "LOC Prevention (A.11)" not "A.11"
- "Critical Judgment" not "CJ-1"
- "Case I -- Visual" not "Difficulty: 30%"

If a label requires a separate lookup table to understand, it is not a label -- it is a code.

**Test:** Read every badge, tag, and label on the screen out loud. Do they make sense as English?

---

## R9. Clickable references must go somewhere useful

Topic tags, competency references, and regulatory citations shown in the UI should be linked to their definition or source material.

- An "A.11" badge should link to the LOC Prevention topic reference.
- A "CJ-1" tag should link to or expand the Critical Judgment definition.
- A "14 CFR 61.56" citation should link to the regulation text.

Dead-end labels that reference something the user can't access are frustrating. Either link it or don't show it.

**Test:** Can the user click/tap every reference on this screen and learn more? If not, why is the reference shown?

---

## R10. No magic thresholds

If the system uses a threshold, cutoff, or requirement, explain where it comes from.

- "16 hours FAA-qualified time" -- what makes time "FAA-qualified"? Where does 16 come from?
- "All 13 topics >= 45 minutes" -- why 45? Why 13? (Answer: AC 61-83K)
- "Minimum score of 70%" -- why 70? (Answer: AC 61-83K SS 13.7)

Requirements that come from regulation should cite the regulation. Requirements that come from our design should be explained in the UI or in a help reference.

**Test:** For every requirement or threshold shown, can the user find out where it comes from?

---

## Applying These Rules

### During authoring

Before marking content as ready for review, check every screen, label, and value against R1-R10.

### During code review

Reviewer checks: does the PR introduce any naked numbers (R1), internal codes (R2), undefined interactions (R3), spoilers (R4), or unexplained thresholds (R10)?

### During content audits

Run through the sim as a user. For every screen, ask each test question. Log violations in a review doc.

### During scenario design

R4 and R5 are the critical scenario-specific rules. Every scenario briefing and tick script must be checked against them.
