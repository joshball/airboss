# FAA Submission Guide

## What You're Submitting

For a FIRC, you submit a **Training Course Outline (TCO) package** for approval. The goal: convince the FAA this is a controlled, complete, auditable training program.

## The Submission Package

### 1. Training Course Outline (TCO) -- REQUIRED

The core document. See [TCO.md](TCO.md) for the full draft.

Includes:

- Course overview (purpose, audience, delivery method)
- Curriculum structure (modules, objectives, time)
- Core topic coverage (all 13 mapped)
- Instructional methods (SBT, risk-based, interactive)
- Assessment plan (how evaluated, passing criteria >= 70%, remediation)
- Completion requirements (time, modules, assessments)

### 2. Traceability Matrix -- CRITICAL

The make-or-break document. See [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md).

Shows for every FAA core topic:

- Where it is taught
- How it is assessed
- What evidence proves learning
- Approximate instructional time

### 3. Time & Interaction Model

Explains:

- How 16 hours is enforced
- How inactivity is handled (pauses timer)
- How interaction is enforced (continuous decisions required)

Our system is actually better here than current FIRCs (constant decision-making vs passive watching).

### 4. Assessment & Evidence Description

Explains:

- Scenario scoring methodology
- Knowledge check approach
- Improvement tracking
- Competency thresholds

### 5. System Description (High Level)

- How the platform works
- How progress is tracked
- How cheating is prevented

### 6. Records & Reporting

- What records are kept
- How completions are issued
- How audits work

---

## What You Do NOT Submit

This is critical for protecting competitive advantage.

**Do NOT submit:**

- Detailed scenario scripts
- Student behavior models
- Adaptive algorithms
- Spaced repetition logic
- Scoring formulas
- Internal analytics
- Competency graph details (beyond what's needed for traceability)

**DO submit:**

- What is taught
- How it is measured
- How it is controlled

---

## Protecting Your Advantage

### Your Moat (things competitors can't easily copy)

1. **Competency model** - How we define and decompose instructor skills
2. **Tick-based scenario engine** - Real-time instructional judgment simulation
3. **Student behavior simulation** - Personality-driven, non-scripted responses
4. **Adaptive + spaced repetition system** - When to show what, how to reinforce
5. **Assessment logic** - How we evaluate judgment (not just knowledge)

These should NEVER be fully exposed in submissions.

---

## Submission Process

### Step 1 -- Prepare TCO Package

Build all documents. Use the "Generate FAA Package" button in the course management app.

### Step 2 -- Submit to FAA

- Typically AFS-800 (Flight Standards Service)
- Usually email or formal submission
- Sometimes through an FAA contact/inspector

### Step 3 -- FAA Review

They will:

- Read your TCO
- Check traceability (the matrix is what they review most carefully)
- Check time model
- Check assessments

### Step 4 -- Back-and-Forth (Expect This)

There WILL be:

- Clarification questions
- Requests for more detail
- Possibly revision requests

Plan for 2-3 rounds of revision.

### Step 5 -- Possible Demo

Not always required, but for an unusual system like ours, they may want to see it run. Be prepared to demonstrate:

- A complete scenario flow
- Time tracking in action
- How assessment works
- How completion is determined

### Step 6 -- Approval

Then you are authorized to offer the FIRC.

---

## Post-Approval Reporting

After approval:

- Issue completion/graduation certificates
- Maintain records
- Provide records if requested by FAA
- You do NOT constantly report usage unless specifically required

### Certificate Types

- **Graduation Certificate** - For instructors meeting recent experience requirements (can use for renewal under SS 61.197)
- **Completion Certificate** - For others (attended but cannot establish recent experience)

---

## Strategic Framing

### Language to USE

- "Scenario-based instruction (SBT)"
- "Adaptive, interactive instruction system"
- "Risk-based training"
- "Competency-based progression"
- "Continuous assessment"
- "Individualized learning paths"
- "Reinforcement and retention system"
- "Experiential learning through scenario-based outcomes and guided remediation"

### Language to AVOID

- "Game" or "game-based"
- "Fun" or "engaging" (as primary selling point)
- "Revolutionary" or "disruptive"
- "Players" (use "learners" or "participants")
- "Levels" or "XP" (use "competency progression")

### The Key Insight

On paper: an FAA-aligned, scenario-based FIRC with a TCO, syllabus, objectives, assessments, timing, and records.

In reality: a replayable instructional game engine.

The FAA is expecting "slide deck with quiz." You give them "structured curriculum with interactive scenarios." But on paper, it looks completely traditional.

---

## Course Validation (Pre-Submission)

Before submitting to the FAA, run validation:

- Simulated users (e2e test runs)
- Verify time distribution across topics
- Verify topic coverage completeness
- Check difficulty balance
- Check completion rates
- Verify all traceability matrix entries have working scenarios

This prevents submitting something broken.

---

## Change Management (Post-Approval)

AC 61-83K expects providers to keep material current.

When regulations change:

1. Detect the change (monitoring pipeline)
2. Identify affected scenarios/content
3. Update content
4. Version the change
5. Potentially notify FAA of material changes
6. Roll out to users

Keep checking FAA FIRC policy/resources for updates.
