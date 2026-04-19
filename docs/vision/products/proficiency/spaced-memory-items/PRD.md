---
name: Spaced Memory Items
id: prd:prof:spaced-memory-items
tagline: Aviation spaced repetition -- building it IS studying
status: idea
priority: 1
prd_depth: full
category: proficiency
platform_mode:
  - daily-desk
  - pre-flight
  - audio-passive
audience:
  - student-pilot
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: medium
personal_need: 5
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - regulations
  - memory-items
  - approach-plates
  - weather-codes
  - airspace-rules
last_worked: null
---

# Spaced Memory Items

## What it does

Anki-style spaced repetition tuned for aviation knowledge. Memory items, FAR/AIM sections, holding entries, approach minimums, weather symbols -- all delivered on an optimal review schedule. Cards are created by studying, so the act of building your deck IS the learning. Every other product in the platform feeds cards into this system.

## What it looks like

Mobile-first card review. Swipe right for "got it," swipe left for "again." Each card shows front (question/prompt) then back (answer/explanation). A dashboard shows due counts by category, streak, and interval distribution. A card editor lets you create cards from templates -- regulation fill-in, approach plate quiz, diagram labeling, memory item recall. Import/export supports shared decks.

Key screens:

- **Review queue** -- one card at a time, swipe-based, shows interval stats after answer
- **Dashboard** -- due today, upcoming, mastered, categories breakdown
- **Card editor** -- template picker, rich text, image support for plates/diagrams
- **Deck browser** -- filter by category, search, sort by difficulty or interval

## Who it's for

- **Returning pilots (primary)** -- rebuilding knowledge that has atrophied. Need structured recall, not re-reading the FAR/AIM cover to cover.
- **Instrument pilots** -- approach minimums, holding entries, weather codes, lost-comm procedures. High-density recall material that decays fast without practice.
- **Student pilots** -- building initial knowledge base. Cards created during ground school become long-term retention tools.
- **CFIs** -- staying sharp on regulations and procedures they teach. Also curating decks for their students.

## Core features

- SM-2 (or similar) spacing algorithm with aviation-specific tuning
- Card templates for aviation formats: regulation fill-in, approach plate quiz, diagram label, memory item, frequency/code recall
- Auto-generation of cards from regulations (parse FAR/AIM sections into Q&A pairs)
- Category tagging by domain: regs, weather, airspace, procedures, avionics, aerodynamics
- Import/export for deck sharing (JSON + Anki-compatible)
- Confidence rating before reveal (feeds into Calibration Tracker prd:prof:calibration-tracker when built)
- Audio mode -- read question aloud, pause, read answer (commute-friendly)
- Card statistics: ease factor, interval history, lapse count, time-to-answer
- Reverse cards (auto-generate both directions from a single entry)
- Deck subscriptions -- follow curated decks that update as regs change

## Technical challenges

- Spacing algorithm selection and tuning. SM-2 is proven but dated -- FSRS is newer and may perform better. Need to pick one and commit, with data collection to evaluate later.
- Card quality enforcement. Bad cards (ambiguous questions, wrong answers, trivial content) actively harm learning. Need review/flagging and possibly quality templates that constrain bad input.
- Aviation-specific card types require custom rendering -- approach plate images, sectional chart snippets, instrument panel diagrams. Not just text-on-text.
- Offline support for mobile. Review sessions must work without connectivity -- queue sync when back online.
- Regulation change tracking. When a FAR changes, cards referencing it need flagging or auto-update.

## Audience challenges

- Pilots already have Anki. The pitch is "aviation-specific templates and curated content" -- that has to be meaningfully better than a generic Anki deck download.
- Building a card deck feels like homework. The "building IS studying" message needs to land in the UX, not just marketing.
- Content curation at scale. Community-contributed cards will vary wildly in quality without strong moderation tools.
- Audio-passive mode is a differentiator but adds production complexity (TTS quality, card formats that work without visuals).

## MVP

- Web-based card review with SM-2 scheduling
- 5 card templates: text Q&A, regulation fill-in, memory item, multiple choice, image-based
- Manual card creation and editing
- Category tagging and filtered review
- Due count dashboard with basic stats

## Ideal launch

- Mobile app with offline sync and swipe-based review
- Audio-passive mode with TTS
- Auto-generation from FAR/AIM sections
- Shared deck marketplace with quality ratings
- Integration hooks so other products (Decision Reps, Route Walkthrough) auto-create cards from user activity

## Content dependencies

- FAR/AIM text (public domain, needs parsing)
- Memory item lists (V-speeds, frequencies, codes -- widely published)
- Approach plate images (FAA charts are public, need rendering pipeline)
- Weather code references (METAR/TAF decode tables)
- Airspace rules and dimensions

## Builds on / feeds into

- **Feeds into** [Calibration Tracker](../../proficiency/calibration-tracker/) (prd:prof:calibration-tracker) -- confidence ratings before reveal become calibration data
- **Receives from** [Decision Reps](../decision-reps/) (prd:prof:decision-reps) -- missed decision scenarios generate review cards
- **Receives from** [Route Walkthrough](../../pre-flight/route-walkthrough/) (prd:pre:route-walkthrough) -- route-specific knowledge gaps become cards
- **Receives from** [NTSB Story](../../audio/ntsb-story/) (prd:aud:ntsb-story) -- key lessons from accident cases become memory items
