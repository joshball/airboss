---
name: Aviation Weather syllabus
status: skeleton
parent: README.md
---

# Aviation Weather -- syllabus

Week-by-week structure. Two cadences supported: a 4-week intensive (one week per product family) or a quarter-length deep dive (one week per product). The skeleton below describes the deep version; the intensive collapses related weeks.

Every week covers the same three stages from [DESIGN_PRINCIPLES.md §7](../../docs/platform/DESIGN_PRINCIPLES.md): decode → understand → triage. The integration weeks (10, 12) are where the stages compose across products.

## Week 1 -- Why weather is the hardest read

- Why pilots fail weather more than any other product family
- The skill ladder: decode is not understanding; understanding is not triage
- The atmosphere as a system: pressure systems, fronts, air masses, lapse rates, diurnal cycles
- How synthetic briefings enable Socratic teaching the real world can't
- First exposure: a generated briefing pack with full commentary

## Week 2 -- Surface observations (METAR, SPECI)

- The station model
- METAR field grammar: ICAO id, time, wind, vis, weather, sky, temp/dew, altimeter, remarks
- Auto vs human-augmented stations
- SPECI vs METAR: when an off-cycle observation is filed
- Triage: 12 METARs along a route; rank by relevance to your flight

## Week 3 -- Terminal forecasts (TAF)

- TAF as "what the forecaster is willing to commit to"
- FM groups (becoming), TEMPO groups (intermittent), PROB groups (probability)
- The 5-statute-mile / 5000-ft proximity rule
- Why a TAF is not a METAR projected forward
- Triage: TAF + current METAR + observed trend; what's the realistic arrival picture?

## Week 4 -- Area products (Area Forecast, GFA)

- Area Forecast structure (where it survives) vs Graphical Forecasts for Aviation
- Reading clouds, weather, and IFR/MVFR/VFR layers
- Time slices and their boundaries
- Triage: GFA along a route at three time slices; where does the picture change?

## Week 5 -- Hazards (AIRMET, SIGMET, Convective SIGMET, CWA)

- AIRMET Sierra (IFR/mountain obscuration), Tango (turbulence), Zulu (icing)
- G-AIRMET as the graphical successor
- SIGMET (severe non-convective) and Convective SIGMET
- Center Weather Advisory (CWA): short-term, ATC-driven
- Triage: hazard products vs your route, vs your aircraft, vs your experience

## Week 6 -- Winds and temps aloft (FB)

- The FB grid: stations × altitudes
- Wind decoding above and below 100 kt
- Temperature: signed convention, missing values
- The climb decision: "headwind at 6 vs 8 -- which costs more?"
- Triage: pick a cruise altitude given winds, fuel, terrain, and turbulence forecast

## Week 7 -- PIREPs (UA, UUA)

- The PIREP report format
- Why PIREPs are the most underused product in general aviation
- Filing PIREPs as a CFI duty
- Reading other people's PIREPs as ground truth that beats forecast
- Triage: PIREPs along your route -- what does the model not know yet?

## Week 8 -- Surface analysis and prog charts

- Reading a surface analysis: isobars, fronts, pressure centers, station plots
- Prog charts: 12, 24, 48-hour outlooks
- The truth-model storytelling drill: chart at T=0 vs T=6 vs T=12, narrate the evolution
- Triage: which features matter for your departure window?

## Week 9 -- Radar and satellite

- NWS radar mosaic: reflectivity, velocity, the meaning of color ramps
- Visible vs IR satellite; cloud tops and movement
- What radar cannot see (thin precipitation, freezing rain at altitude, embedded TS at night)
- Triage: radar + satellite + PIREPs as a 3-source confirmation pattern

## Week 10 -- Integration: a generated cross-country brief

- The full briefing pack as one artifact
- Order of operations: what do you read first, second, third?
- The "boring" briefing -- when nothing is alarming, what do you still verify?
- The "alarming" briefing -- when everything is alarming, how do you triage the noise?
- A canonical event lesson: walk one famous historical wx situation end-to-end

## Week 11 -- Icing (FIP/CIP) and turbulence (GTG)

- Forecast Icing Potential and Current Icing Potential
- Graphical Turbulence Guidance: low-altitude vs high-altitude products
- Freezing levels and their interaction with cloud bases
- Triage: icing + turbulence + your aircraft equipment list

## Week 12 -- Capstone: triage under time pressure

- Generated 4-hour cross-country brief, full pack
- 90-second triage: which 5 items shape your go/no-go?
- Translate-with-time-penalty: any item can be decoded on demand at 15s cost
- Decision and debrief
- Repeat with a different generated brief; compare your decision pattern

## Drill cadence

Throughout the course, three drill types run concurrently:

- **Decode reps**: spaced rep on individual codes/symbols (knowledge graph nodes)
- **Understand reps**: read a single product, summarize the picture
- **Triage drills**: rank N items, make a call, get debriefed

Drills compose only over codes the learner has mastered at decode + understand. See [drills/README.md](drills/README.md).

## Capstone oral

A capstone preflight oral, conducted against a generated briefing for a hypothetical real-day cross-country. The learner walks the entire pack aloud (or via written response) and makes a documented go/no-go call with reasoning. Authored against the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/) once it ships.
