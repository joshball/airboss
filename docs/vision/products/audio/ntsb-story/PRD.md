---
name: NTSB Story
id: prd:aud:ntsb-story
tagline: Real accidents, real decisions -- learn from what went wrong
status: idea
priority: 1
prd_depth: full
category: audio
platform_mode:
  - audio-passive
  - daily-desk
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - career-track
  - aviation-curious
complexity: medium
personal_need: 5
depends_on: []
surfaces:
  - web
  - mobile
  - audio
content_reuse:
  - ntsb-cases
  - scenarios
  - weather-data
last_worked: null
---

# NTSB Story

## What it does

Narrative retelling of real NTSB accident cases, stopped at key decision points. The listener/reader makes the call before hearing what the pilot actually did. Like "Black Box Down" or "Air Disasters" but interactive and educational -- not just entertainment. Audio format means it works during commute, exercise, yard work. Every story becomes a Decision Rep scenario. This structures the accident-case consumption that pilots already do into deliberate learning.

## What it looks like

A story opens with context: weather, pilot experience, aircraft type, mission. The narrative builds through the flight. At each decision point, the story pauses. "What would you do?" In the web/mobile version, you pick from options. In audio mode, you just think -- the pause gives you time. The story continues with what the pilot actually did and the consequences. After each decision, a teaching point connects the moment to a principle. The story ends with a full analysis.

Key screens:

- **Story player** -- narrative text with embedded decision points, audio play controls, teaching point callouts
- **Story library** -- browse by category (weather, mechanical, terrain, human factors), aircraft type, outcome severity, length
- **Decision review** -- after finishing, see all your choices vs. the pilot's vs. the recommended action
- **Story series** -- curated sequences (e.g., "5 VFR-into-IMC cases," "Mountain flying accidents," "Fuel management failures")

## Who it's for

- **Returning pilots (primary)** -- accident cases are the most engaging way to rebuild safety awareness. Stories stick. Statistics don't.
- **All active pilots** -- this is continuing education that doesn't feel like it. The NTSB database is rich, free, and underused because the reports are dry.
- **CFIs** -- story-based teaching is powerful. Use cases as lesson material, discussion starters, or assigned pre-lesson listening.
- **Aviation-curious (secondary)** -- broader audience than any other product. People who aren't pilots listen to aviation accident podcasts. Gateway to the platform.
- **Career-track pilots** -- 135/121 accident cases, CRM failures, organizational pressures. Different flavor from GA cases.

## Core features

- Narrative stories built from real NTSB reports with decision-point pauses
- Audio playback with pause-at-decision-point functionality
- Interactive decision choices (web/mobile) with confidence rating
- Teaching points after each decision, linked to regulations/AIM/best practices
- Category system: weather, mechanical, terrain, human factors, CRM, fuel, spatial disorientation
- Aircraft-type and operation-type tagging (GA, 135, 121, helicopter, experimental)
- Story series -- curated sequences around themes
- Bookmarking and note-taking within stories
- Decision summary after story completion
- Auto-generation of Decision Rep scenarios from story decision points
- Transcript + audio for every story (read or listen)

## Technical challenges

- **Writing quality narratives takes time.** NTSB reports are public domain but dry and clinical. Transforming them into engaging stories while maintaining accuracy requires aviation knowledge and writing skill. This is a content production challenge, not a technical one.
- **Audio production pipeline.** Options: human narration (highest quality, expensive, slow), TTS (fast, cheap, quality improving rapidly), or hybrid (human for narration, TTS for supporting content). TTS quality in 2026 is probably good enough for MVP.
- **Decision point design.** The options at each pause need to be plausible, distinct, and have a defensible best answer. Same challenge as Decision Reps but embedded in narrative context.
- **Respecting real accidents.** These are real people who were hurt or killed. Tone must be educational and respectful, never sensationalized. Need editorial guidelines and review process.
- **NTSB data extraction.** Reports are PDFs and HTML. Structured data exists (NTSB database) but the narrative detail is in the full reports. Need a pipeline to identify good teaching cases and extract key facts.

## Audience challenges

- Competition from established podcasts and YouTube channels (Blancolirio, Air Safety Institute, 74 Gear). Differentiation is the interactive decision points and structured learning -- passive consumption becomes active practice.
- Audio-first means the product needs to work without visuals. Decision points in audio are harder -- "think about what you'd do" with a timed pause, rather than tapping a choice. The web version adds interactivity but audio must stand alone.
- Content pipeline sustainability. Each story requires significant writing effort. Need a production cadence that delivers regular new content without burning out. Start with one story per week.
- Accident cases can be emotionally heavy. Some listeners will find certain cases (especially recent ones or ones involving students) difficult. Content warnings and sensitivity in presentation.

## MVP

- 10 curated stories from well-known GA accident cases
- Web-based story player with decision points and teaching notes
- Audio playback with pause-at-decision functionality (TTS)
- Category browsing and bookmarking
- Decision summary at story end

## Ideal launch

- 50+ stories spanning GA, 135, helicopter, and experimental operations
- High-quality TTS or hybrid narration
- Mobile app with offline audio download
- Story series with thematic progression
- Auto-generation of Decision Rep scenarios from story decision points
- CFI tools: assign stories, track student engagement, discussion prompts
- Community story submissions with editorial review pipeline
- RSS/podcast feed for audio subscribers

## Content dependencies

- NTSB accident database (public, structured data for case identification)
- NTSB full reports (public domain PDFs/HTML for narrative source material)
- Weather data for accident dates (historical METARs/TAFs for realism)
- Airport and terrain data for geographic context
- Regulation references for teaching points

## Builds on / feeds into

- **Feeds into** [Decision Reps](../../proficiency/decision-reps/) (prd:prof:decision-reps) -- each story's decision points become standalone micro-scenarios
- **Feeds into** [Spaced Memory Items](../../proficiency/spaced-memory-items/) (prd:prof:spaced-memory-items) -- key lessons and facts from each story become review cards
- **Feeds into** [Route Walkthrough](../../pre-flight/route-walkthrough/) (prd:pre:route-walkthrough) -- accident cases at airports along a planned route surface as awareness items
