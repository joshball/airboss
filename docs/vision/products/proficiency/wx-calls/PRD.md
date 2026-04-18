---
name: WX Calls
id: prd:prof:wx-calls
tagline: Real weather, real decisions -- practice the call that keeps you alive
status: idea
priority: 2
prd_depth: full
category: proficiency
platform_mode:
  - daily-desk
  - pre-flight
audience:
  - student-pilot
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: medium
personal_need: 4
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - weather-data
  - scenarios
  - regulations
last_worked: null
---

# WX Calls

## What it does

Real METARs, TAFs, PIREPs, radar images, and prog charts. You get a mission profile and a weather picture -- then you make the call. Go or no-go. Divert or continue. Land or go missed. Then see what experienced pilots and CFIs said about the same weather. Trains weather decision-making with real data, every day, without leaving the ground.

## What it looks like

A scenario card presents the setup: aircraft type, pilot experience level, mission (business meeting, personal trip, training flight), departure and destination airports. Below that, the weather products -- raw METAR, TAF, area forecast, maybe a radar snapshot or prog chart. You interpret the data, assess the risks, and make your call with a brief written justification. Then the analysis reveals: expert assessment, key risk factors, common traps, and what actually happened (for historical scenarios).

Key screens:

- **Today's scenario** -- fresh daily scenario built from real or recent weather
- **Weather products** -- METAR, TAF, PIREP, radar, prog chart displayed together
- **Decision input** -- go/no-go or divert/continue, confidence slider, free-text justification
- **Expert analysis** -- expert assessment, risk factor breakdown, regulation references, what-happened outcome
- **Scenario browser** -- filter by weather type (icing, thunderstorms, fog, mountain, crosswind), difficulty, season
- **History** -- your past calls, accuracy trend, risk areas where you make bad calls

## Who it's for

- **Private pilots (primary)** -- weather kills more GA pilots than almost anything else. Weather decision-making is the single most improvable safety skill, and it can be practiced daily without flying.
- **Student pilots** -- building weather judgment before they need it. Learning to read METARs and TAFs is rote; learning to make decisions from them is practice.
- **Instrument pilots** -- weather decisions are more nuanced with an instrument rating. Icing, thunderstorm avoidance, alternate requirements, approach minimums in marginal conditions.
- **Returning pilots** -- weather judgment atrophies during a lapse. This rebuilds the pattern recognition that experienced pilots use.
- **CFIs** -- scenario library for teaching weather decision-making. Use a scenario as a pre-flight discussion prompt.

## Core features

- Daily fresh scenario built from real-time or recent weather data
- Mission profiles that vary pilot experience, aircraft capability, and trip urgency (pressure to go)
- Weather product display: METAR decode, TAF timeline, PIREPs, radar imagery, prog charts
- Decision input with confidence rating and written justification
- Expert analysis with risk factor identification and teaching points
- Historical scenario library -- famous weather accidents (JFK Jr., Kobe Bryant helicopter, Comair 5191 fog conditions) and tricky forecasts
- Category filtering: icing, thunderstorms, fog/low ceilings, mountain weather, crosswind, density altitude, winter ops
- Difficulty levels: clear-cut go/no-go decisions up to genuinely ambiguous marginal conditions
- Trend tracking: accuracy over time, systematic biases (always goes, always cancels, underestimates icing)
- CFI annotation mode -- add teaching notes to scenarios for use with students

## Technical challenges

- Weather API reliability. NOAA/ADDS APIs are free but can be slow, rate-limited, or change format. Need caching and fallback strategies. Aviation weather APIs (aviationweather.gov) are the primary source.
- Not all weather is interesting. Clear skies everywhere is not a useful scenario. Need automated or manual curation to select days and airports with genuinely instructive weather.
- Expert analysis is the labor-intensive part. Every scenario needs a quality writeup explaining the key factors, the right call, and why. Can't be fully automated -- weather judgment is contextual. Could use structured templates to reduce effort.
- Historical scenario preservation. Weather data is ephemeral -- METARs and radar images from last Tuesday are gone in days. Need a capture pipeline to snapshot interesting weather pictures before they disappear.
- The "right answer" problem. Some weather scenarios are genuinely ambiguous -- reasonable pilots disagree. Need to present the analysis as a framework for thinking, not a definitive right/wrong answer. Except when the answer IS clear-cut (VFR into IMC = no-go, always).

## Audience challenges

- Pilots who "always go" may resist a product that tells them to cancel. The framing matters -- this isn't about being conservative, it's about being calibrated. Sometimes the right call IS to go. The product teaches you to know the difference.
- Weather knowledge prerequisites vary wildly. A student pilot who can barely decode a METAR and an ATP who reads prog charts daily need different experiences. Difficulty levels must span this range.
- Competition from free weather briefing tools (ForeFlight, 1800wxbrief). Differentiation is the decision practice layer -- those tools give you weather, this product makes you DO something with it and tells you how your judgment compares.
- Getting CFIs to contribute expert analysis. Crowdsourcing quality commentary requires incentives and quality control. Could start with a small panel of trusted CFIs.

## MVP

- 30 curated weather scenarios across 4 categories (thunderstorms, low ceilings/fog, icing, crosswind)
- Web-based scenario display with METAR and TAF decode
- Go/no-go decision input with confidence rating
- Expert analysis reveal with risk factors and teaching points
- Scenario browser with category and difficulty filtering

## Ideal launch

- Daily auto-generated scenarios from real-time weather at selected airports
- Full weather product suite: radar imagery, prog charts, PIREPs, winds aloft
- Historical accident weather scenarios with NTSB tie-in
- Crowdsourced CFI expert analysis with quality moderation
- Trend dashboard showing decision biases and accuracy over time
- Integration with Ten-Minute Ticker (prd:prof:ten-minute-ticker) as a session content source
- Seasonal scenario campaigns (thunderstorm season, winter ops, mountain wave)
- Pre-flight mode: practice the call for TODAY's real weather at YOUR departure airport

## Content dependencies

- Aviation weather APIs (aviationweather.gov METAR, TAF, PIREP, radar)
- Weather scenario capture pipeline (snapshot and archive interesting weather days)
- Expert analysis for each curated scenario (CFI-authored teaching points)
- NTSB accident reports for historical weather scenarios
- Regulation references for weather minimums and requirements (FAR 91.155, 91.167, 91.175)

## Builds on / feeds into

- **Feeds into** [Ten-Minute Ticker](../ten-minute-ticker/) (prd:prof:ten-minute-ticker) -- weather scenarios as a content source for daily mixed sessions
- **Feeds into** [Spaced Memory Items](../spaced-memory-items/) (prd:prof:spaced-memory-items) -- weather decode knowledge gaps become review cards (METAR codes, TAF format, icing categories)
- **Feeds into** [Calibration Tracker](../calibration-tracker/) (prd:prof:calibration-tracker) -- go/no-go confidence ratings build weather decision calibration profile
- **Feeds into** [Recency Recovery](../../event-prep/recency-recovery/) (prd:evt:recency-recovery) -- weather exercises serve the weather domain during recovery
- **Complements** [Decision Reps](../decision-reps/) (prd:prof:decision-reps) -- Decision Reps handles 60-second micro-scenarios; WX Calls goes deep on weather-specific decisions with full product suites
