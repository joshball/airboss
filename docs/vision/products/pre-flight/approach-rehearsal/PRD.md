---
name: Approach Rehearsal
id: prd:pre:approach-rehearsal
tagline: Practice reading plates before you brief them for real
status: idea
priority: 2
prd_depth: full
category: pre-flight
platform_mode:
  - pre-flight
  - daily-desk
audience:
  - instrument-pilot
  - cfi
  - returning-pilot
  - career-track
complexity: medium
personal_need: 5
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - approach-plates
  - regulations
  - airspace-rules
  - memory-items
last_worked: null
---

# Approach Rehearsal

## What it does

Pick any approach plate -- by airport, runway, and type, or paste in your own -- and walk the plate as a scored exercise. Questions hit the critical items: What's the MDA/DA? What's the missed approach procedure? What entry works from the northwest? What's the CDI sensitivity inside the FAF? Is DME required? Builds chart-reading speed, accuracy, and the habit of catching non-standard items that kill pilots.

## What it looks like

The approach plate fills the screen. Questions appear one at a time, overlaid or alongside the plate. Some are timed (how fast can you find the MDA?), some are interpretive (can you fly this approach with your equipment?). After answering, the relevant area of the plate highlights with an explanation. A session summary shows accuracy, speed, and which plate elements you consistently miss. Items you got wrong can auto-generate spaced rep cards.

Key screens:

- **Plate selector** -- search by airport ID, runway, approach type (ILS, RNAV, VOR, LOC, NDB), or paste/upload a plate image
- **Rehearsal screen** -- plate displayed with question overlay, timer for speed drills, answer input
- **Answer review** -- plate with highlighted area, explanation, regulation reference, gotcha callout
- **Session summary** -- accuracy by question type, speed trends, weak areas, cards generated
- **Gotcha gallery** -- collection of non-standard items found during practice (circling restrictions, non-standard missed, DME required, etc.)

## Who it's for

- **Instrument pilots (primary)** -- approach plates are dense, information-rich documents. Speed and accuracy of reading them is a trainable skill. Most pilots brief plates but don't deliberately practice reading them.
- **Returning instrument pilots** -- plate formats may have changed during their lapse (RNAV approaches didn't exist 20 years ago). Rebuilding plate-reading fluency is critical before an IPC.
- **CFIs** -- teaching tool for instrument students. "Walk this plate" as a lesson exercise. Also keeps their own plate-reading sharp across approach types they don't fly regularly.
- **Career-track pilots** -- ATP and Part 135 checkrides demand fast, accurate plate interpretation under pressure.

## Core features

- Approach plate display with search by airport, runway, and approach type
- Question engine covering: minimums (MDA/DA/DH), missed approach procedure, initial approach fix, step-down fixes, equipment required, CDI sensitivity, hold entries, circling restrictions, notes and cautions
- Timed mode for speed drills -- how fast can you extract key information?
- Non-standard item detection -- questions specifically target common gotchas (non-standard alternate minimums, inoperative components, required equipment, unusual missed approach routing)
- Auto-generation of prd:prof:spaced-memory-items spaced rep cards from missed questions
- Plate comparison -- same airport, different approaches. What changes between the ILS and the RNAV?
- Hold entry practice -- given a plate with a hold, what's the correct entry from any heading?
- Equipment check -- "Can you fly this approach in a C172 with no DME and no WAAS?" Requires knowing what the plate requires vs. what substitutions are legal
- Progress tracking by question type and approach category
- Plate annotation -- mark up plates with personal notes during practice

## Technical challenges

- Approach plate data acquisition. FAA CIFP (Coded Instrument Flight Procedures) data has the raw procedure data but not the visual plate. FAA digital terminal procedures charts are public PDFs but extracting structured question data from images is hard. Two paths: use CIFP data to generate questions programmatically, or use plate images with manually authored questions.
- Plate rendering. Displaying approach plates clearly on mobile screens is difficult -- they're designed for 5x7" paper. Need zoom, pan, and smart highlighting without losing context.
- Question generation at scale. Manually authoring questions for thousands of approach plates doesn't scale. Need semi-automated generation from CIFP data, with human review for quality.
- Hold entry geometry. Calculating correct hold entries requires knowing the inbound course, the pilot's heading, and the entry sector rules. This is computable but the edge cases (direct entry boundaries, teardrop vs. parallel judgment calls) need careful handling.
- Keeping plate data current. Approach plates change on a 56-day AIRAC cycle. Need a pipeline to detect and flag stale plates.

## Audience challenges

- Instrument pilots may already brief plates before flights and feel they don't need separate practice. The pitch is deliberate practice vs. routine briefing -- you brief to prepare for a specific flight, you rehearse to build the skill of reading any plate faster and more accurately.
- Competition from ForeFlight and other EFB apps that display plates. Differentiation is the active questioning -- those apps show plates, this product tests your understanding of them.
- Non-instrument-rated pilots have no use for this product. The audience is narrower than most products in the platform.
- Plate format literacy. If a user can't read a plate at all, they need a tutorial before rehearsal. Decide whether to include "plate reading 101" or require baseline competence.

## MVP

- Plate display for 50 curated approaches (major airports, common approach types)
- 8-10 question types covering minimums, missed approach, equipment, and key fixes
- Scored rehearsal with answer explanations
- Auto-generate prd:prof:spaced-memory-items cards from missed questions
- Session summary with accuracy by question type

## Ideal launch

- Full FAA approach plate library with 56-day update cycle
- Semi-automated question generation from CIFP data
- Timed speed drills with personal best tracking
- Gotcha gallery -- community-sourced collection of non-standard approach items
- Hold entry trainer with visual sector overlay
- Equipment check scenarios for common GA aircraft configurations
- Plate comparison tool for multiple approaches at the same airport
- Pre-flight mode: rehearse the specific approaches you'll fly today

## Content dependencies

- FAA digital terminal procedure charts (public, PDF format, 56-day cycle)
- FAA CIFP data (coded instrument flight procedures, machine-readable)
- Regulation references for equipment substitution rules (FAR 91.205, 91.175, 97.x)
- Hold entry geometry rules and sector definitions
- Common GA aircraft equipment profiles (C172, PA-28, SR22 -- what's installed, what's not)

## Builds on / feeds into

- **Feeds into** [Spaced Memory Items](../../proficiency/spaced-memory-items/) (prd:prof:spaced-memory-items) -- missed plate questions become review cards
- **Feeds into** [Calibration Tracker](../../proficiency/calibration-tracker/) (prd:prof:calibration-tracker) -- confidence ratings during plate exercises build calibration data
- **Feeds into** [Recency Recovery](../../event-prep/recency-recovery/) (prd:evt:recency-recovery) -- plate rehearsal exercises serve the procedures/navigation recovery domain
- **Complements** [Route Walkthrough](../route-walkthrough/) (prd:pre:route-walkthrough) -- route walkthrough covers the full flight, approach rehearsal goes deep on the plate
