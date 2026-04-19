---
name: Route Walkthrough
id: prd:pre:route-walkthrough
tagline: Walk every flight before you fly it
status: idea
priority: 1
prd_depth: full
category: pre-flight
platform_mode:
  - pre-flight
  - daily-desk
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - commercial-pilot
complexity: high
personal_need: 4
depends_on:
  - airport-data
  - airspace-data
surfaces:
  - web
  - mobile
content_reuse:
  - airports
  - airspace-rules
  - weather-data
  - approach-plates
  - terrain-data
last_worked: null
---

# Route Walkthrough

## What it does

Enter a route -- origin, destination, waypoints -- and get a guided 10-minute mental walkthrough of that specific flight. Departure environment, climb-out concerns, enroute terrain and airspace, weather hazards, arrival briefing, approach options, diversion airports. ForeFlight plans the route; this prepares the PILOT. Nobody owns the 20 minutes before a flight where you load the scenario into your head.

## What it looks like

Start screen: enter airport identifiers or paste a route string (KAPA RAMMS DBL KGJT). System generates a phase-by-phase walkthrough. Each phase is a screen with the key information, risks, and decisions for THAT leg on THAT day.

Key screens:

- **Route entry** -- type identifiers, paste route string, or import from EFB
- **Departure brief** -- runway options, obstacle departure procedures, noise abatement, initial heading/altitude, departure frequency, terrain in the climb
- **Enroute phases** -- one per segment. Airspace transitions, MEAs, terrain, weather along route, frequency changes, diversion options
- **Arrival brief** -- ATIS expectations, approach options with minimums, missed approach procedure, taxi hotspots, FBO/parking
- **Decision challenges** -- 3 "what would you do if..." questions specific to this route and conditions
- **Knowledge gaps** -- items from the walkthrough you should review (feeds Spaced Memory Items)

## Who it's for

- **Returning pilots (primary)** -- haven't flown these routes in years. Need to rebuild situational awareness before the engine starts.
- **Instrument pilots** -- approach briefings, alternates, weather decision points. The walkthrough structures what experienced IFR pilots do mentally.
- **CFIs** -- pre-lesson route briefing tool. Walk through the training area with a student before the flight.
- **Commercial pilots** -- unfamiliar airports, new routes, special procedures. Quick route familiarization.

## Core features

- Route parsing from multiple formats: airport pairs, full route strings, GPS flight plan import
- Phase-by-phase walkthrough: departure, climb, cruise segments, descent, arrival
- Airport data integration: runways, frequencies, procedures, FBO info, taxi diagrams
- Airspace overlay: what you'll fly through, what clearances you need, altitude constraints
- Terrain awareness: MEAs, obstacle clearance, mountainous terrain callouts
- Weather integration: current and forecast conditions along route, hazard areas
- Approach options comparison: available approaches with minimums, equipment requirements
- Diversion airport suggestions with distance and available approaches
- "What if" decision prompts tailored to the specific route
- Knowledge gap identification -- items flagged for review in Spaced Memory Items
- Route history -- save and revisit previous walkthroughs

## Technical challenges

- **Data integration is the hard part.** FAA CIFP (coded instrument flight procedures) and NASR (airport/airspace data) are free but complex to parse. METAR/TAF APIs exist but change. NOTAMs are notoriously unstructured. This is the highest-complexity product in the initial set.
- Keeping data current. Airport data changes (runway closures, new procedures, TFRs). Stale data is worse than no data -- it builds false confidence.
- Route parsing ambiguity. "KAPA DBL KGJT" is simple, but real IFR routes with airways, intersections, and SIDs/STARs require proper parsing.
- Generating useful walkthroughs vs. walls of text. Need to surface what matters for THIS route, not dump every fact about every waypoint.
- Mobile rendering of charts, terrain profiles, and airspace diagrams in a useful format.

## Audience challenges

- ForeFlight already shows most of this data. The pitch is curation and preparation -- "we show you what to think about, not just the raw data." That distinction needs to be clear in 30 seconds.
- Pilots who already brief routes mentally may not see the value. Target is pilots who DON'T brief well, or who are rusty, or flying somewhere unfamiliar.
- Data accuracy trust. One wrong frequency or outdated procedure and pilots won't use it again. Need prominent "verify with current publications" disclaimers AND actually keep data current.
- Competing with free resources (SkyVector, AirNav, FAA charts). Value is the structured walkthrough format, not the raw data.

## MVP

- Airport pair entry (origin + destination, no complex routes)
- Static airport data: runways, elevation, frequencies, available approaches
- Departure and arrival briefs with key information highlighted
- 3 "what if" questions per route (from a template library, not AI-generated)
- Manual data -- curate 50 airports thoroughly rather than automate poorly

## Ideal launch

- Full route string parsing with airway/intersection support
- Live weather integration along route
- Terrain profile visualization
- NOTAM integration with relevance filtering
- Approach plate viewer with briefing prompts
- Auto-generated decision prompts based on route-specific hazards
- EFB import (ForeFlight, Garmin Pilot flight plan formats)
- Knowledge gap items auto-pushed to Spaced Memory Items

## Content dependencies

- FAA NASR data (airports, frequencies, runways -- 56-day cycle)
- FAA CIFP data (instrument procedures -- 56-day cycle)
- Terrain elevation data (SRTM or similar)
- Airspace boundary data (FAA shapefiles)
- Weather APIs (aviationweather.gov, CheckWX, or similar)
- NOTAM data (FAA NOTAM API)

## Builds on / feeds into

- **Feeds into** [Spaced Memory Items](../../proficiency/spaced-memory-items/) (prd:prof:spaced-memory-items) -- knowledge gaps identified during walkthrough become review cards
- **Feeds into** [Decision Reps](../../proficiency/decision-reps/) (prd:prof:decision-reps) -- route-specific "what if" scenarios become pre-flight decision reps
- **Receives from** [NTSB Story](../../audio/ntsb-story/) (prd:aud:ntsb-story) -- accident cases at airports along your route surface as awareness items
